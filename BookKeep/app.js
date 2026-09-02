
window.addEventListener("error",e=>{
  console.error("BookKeep Lite error:",e.error||e.message);
  const status=document.getElementById("backendStatus");
  if(status) status.textContent="App error: "+(e.message||"Unknown error")+". Refresh after updating to the latest version.";
  // Surface errors visibly so problems are reportable, never silent.
  try{
    let b=document.getElementById("appErrorBanner");
    if(!b){
      b=document.createElement("div");
      b.id="appErrorBanner";
      b.style.cssText="position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;background:#7a1d1d;color:#ffd9d9;border:1px solid #b93b3b;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:600;max-width:90vw;cursor:pointer";
      b.title="Click to dismiss";
      b.onclick=()=>b.remove();
      document.body&&document.body.appendChild(b);
    }
    b.textContent="⚠ App error: "+(e.message||"unknown")+" — tell Claude this exact message.";
  }catch{}
});

const USERS_KEY="bookkeep_lite_users_v13";
const ACTIVE_USER_KEY="bookkeep_lite_active_user_v13";

function newUserDb(){
  return {
    accounts:[{id:crypto.randomUUID(),name:"Cash",type:"Cash",opening:0}],
    transactions:[],
    investments:[],
    transcripts:[],
    receipts:[],
    journalEntries:[],
    settings:{accountingMethod:"cash",agentMode:"local",agentEndpoint:"",agentModel:"",backendUrl:"http://127.0.0.1:5000",storageMode:"local"},
    learning:{
      categoryRules:{},knownCustomers:{},knownItems:{},
      rl:{categoryWeights:{},accountWeights:{},typeWeights:{},feedbackLog:[],stats:{approvals:0,edits:0,rejections:0}}
    }
  };
}

let users=JSON.parse(localStorage.getItem(USERS_KEY)||"null");
if(!users || typeof users!=="object" || !Object.keys(users).length){
  const firstId="user_"+crypto.randomUUID();
  users={[firstId]:{name:"My Books",db:newUserDb()}};
  localStorage.setItem(USERS_KEY,JSON.stringify(users));
}
let activeUserId=localStorage.getItem(ACTIVE_USER_KEY);
if(!activeUserId || !users[activeUserId]) activeUserId=Object.keys(users)[0];
// Retire the old placeholder label; Settings → Profile sets the real name.
for(const u of Object.values(users)){ if(u.name==="Default User") u.name="My Books"; }
let db=users[activeUserId].db;

function ensureDbShape(){
  // Migration/repair for users created by older versions.
  if(!db || typeof db!=="object") db=newUserDb();

  if(!Array.isArray(db.accounts)) db.accounts=[];
  if(!Array.isArray(db.transactions)) db.transactions=[];
  if(!Array.isArray(db.investments)) db.investments=[];
  if(!Array.isArray(db.transcripts)) db.transcripts=[];
  if(!Array.isArray(db.receipts)) db.receipts=[];
  if(!Array.isArray(db.journalEntries)) db.journalEntries=[];

  if(db.accounts.length===0){
    db.accounts.push({id:crypto.randomUUID(),name:"Cash",type:"Cash",opening:0});
  }

  // 2026-08-23: Cash (not Checking) is the default money account — this is a
  // cash-run family business. Retire the old default "Checking" account:
  // unused → delete (or rename to Cash if no Cash exists); used with no Cash
  // account → rename it and its journal lines to Cash. Used alongside a real
  // Cash account → leave it alone (merging histories is not safe to automate).
  {
    const chk=db.accounts.find(a=>String(a.name).trim().toLowerCase()==="checking");
    if(chk){
      const cashAcct=db.accounts.find(a=>String(a.name).trim().toLowerCase()==="cash");
      const used=db.transactions.some(t=>t.account===chk.id||t.toAccount===chk.id)
        ||db.investments.some(i=>i.account===chk.id)
        ||db.journalEntries.some(j=>(j.lines||[]).some(l=>String(l.account).trim().toLowerCase()==="checking"));
      if(!used){
        if(cashAcct) db.accounts=db.accounts.filter(a=>a!==chk);
        else { chk.name="Cash"; chk.type="Cash"; }
      }else if(!cashAcct){
        chk.name="Cash"; chk.type="Cash";
        for(const j of db.journalEntries)for(const l of j.lines||[])
          if(String(l.account).trim().toLowerCase()==="checking") l.account="Cash";
      }
    }
  }

  if(!db.settings || typeof db.settings!=="object") db.settings={};
  if(!db.settings.accountingMethod) db.settings.accountingMethod="cash";
  if(!db.settings.agentMode) db.settings.agentMode="local";
  if(db.settings.agentEndpoint==null) db.settings.agentEndpoint="";
  if(db.settings.agentModel==null) db.settings.agentModel="";
  if(!db.settings.backendUrl) db.settings.backendUrl="http://127.0.0.1:5000";
  if(!db.settings.storageMode) db.settings.storageMode="local";
  if(!db.settings.plan) db.settings.plan="free"; // BookKeep pricing: free / standard $10 (agent) / pro $50 (AI agent)

  if(!db.learning || typeof db.learning!=="object") db.learning={};
  if(!db.learning.categoryRules) db.learning.categoryRules={};
  if(!db.learning.knownCustomers) db.learning.knownCustomers={};
  if(!db.learning.knownItems) db.learning.knownItems={};
  if(!db.learning.rl) db.learning.rl={};
  if(!db.learning.rl.categoryWeights) db.learning.rl.categoryWeights={};
  if(!db.learning.rl.accountWeights) db.learning.rl.accountWeights={};
  if(!db.learning.rl.typeWeights) db.learning.rl.typeWeights={};
  if(!Array.isArray(db.learning.rl.feedbackLog)) db.learning.rl.feedbackLog=[];
  if(!db.learning.rl.stats) db.learning.rl.stats={approvals:0,edits:0,rejections:0};
  if(db.learning.rl.stats.approvals==null) db.learning.rl.stats.approvals=0;
  if(db.learning.rl.stats.edits==null) db.learning.rl.stats.edits=0;
  if(db.learning.rl.stats.rejections==null) db.learning.rl.stats.rejections=0;

  // Repair journal lines that stored the "Unknown" placeholder before v15:
  // entries with no account id now post to Cash instead.
  for(const j of db.journalEntries){
    for(const l of j.lines||[]){
      if(l.account==="Unknown") l.account="Cash";
    }
  }

  // Map informal revenue labels onto the standard chart (PRD: journal/ledger
  // names come from the chart, never raw item words). A name that matches one
  // of the user's own money accounts is never renamed — it's theirs.
  const CHART_RENAMES={"sales":"Sales Revenue","sales income":"Sales Revenue","sales / services":"Sales Revenue",
    "bet winnings":"Other Income","gift income":"Other Income","dividend income":"Other Income",
    "refund / reimbursement":"Other Income","tutoring income":"Service Revenue","babysitting income":"Service Revenue"};
  const isOwnAccount=name=>db.accounts.some(a=>String(a.name||"").toLowerCase().trim()===String(name||"").toLowerCase().trim());
  for(const j of db.journalEntries){
    for(const l of j.lines||[]){
      const r=CHART_RENAMES[String(l.account||"").toLowerCase()];
      if(r&&!isOwnAccount(l.account)) l.account=r;
    }
  }
  for(const t of db.transactions){
    const r=CHART_RENAMES[String(t.category||"").toLowerCase()];
    if(r) t.category=r;
  }

  // Transactions saved before account defaulting existed can have an empty or
  // dangling account id — they rendered as "Unknown". Attach them to Cash
  // (or the first real account).
  const fallbackAcct=db.accounts.find(a=>String(a.name).trim().toLowerCase()==="cash")||db.accounts[0];
  if(fallbackAcct){
    for(const t of db.transactions){
      if(!t.account || !db.accounts.some(a=>a.id===t.account)){
        if(t.type!=="transfer") t.account=fallbackAcct.id;
      }
    }
  }

  // Best-effort backfill: link journal entries to the transaction that
  // produced them (same date + amount), so edits can retire the old entry.
  const unlinked=db.journalEntries.filter(j=>!j.sourceTxId && !j.superseded);
  if(unlinked.length){
    const claimed=new Set(db.journalEntries.map(j=>j.sourceTxId).filter(Boolean));
    for(const j of unlinked){
      const amt=Math.max(...(j.lines||[]).map(l=>Number(l.debit||0)),0);
      const match=db.transactions.find(t=>!t.superseded && !claimed.has(t.id) &&
        t.date===j.date && Math.abs(Number(t.amount)-amt)<0.005);
      if(match){ j.sourceTxId=match.id; claimed.add(match.id); }
    }
  }

  // Evidence backfill (2026-08-23): transactions saved before manual-entry
  // evidence existed have no transcript. Reconstruct one from the stored
  // record — labeled as reconstructed, never passed off as a live capture —
  // so every active transaction has a signable Evidence row.
  const fmtAmt=n=>"$"+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");
  const evTypeLabels={income:"Income",expense:"Expense",transfer:"Transfer",invoice:"Customer invoice (A/R)",bill:"Vendor bill (A/P)",receive_invoice:"Invoice payment received",pay_bill:"Vendor bill paid",use_supplies:"Supplies used (adjustment)",buy_investment:"Bought investment",sell_investment:"Sold investment"};
  const journalsByTx={};
  for(const j of db.journalEntries){
    if(j.sourceTxId)(journalsByTx[j.sourceTxId]=journalsByTx[j.sourceTxId]||[]).push(j);
  }
  // Details first so the Evidence list excerpt shows WHAT happened; the
  // reconstruction disclaimer goes at the end.
  const reconstructedText=t=>{
    const acct=db.accounts.find(a=>a.id===t.account)?.name||"(no account)";
    const toAcct=t.toAccount?(db.accounts.find(a=>a.id===t.toAccount)?.name||null):null;
    return (t.note?`${t.note} — `:"")+
      `${evTypeLabels[t.type]||t.type} of ${fmtAmt(t.amount)} in ${acct}`+
      (toAcct?` to ${toAcct}`:"")+(t.category?` (${t.category})`:"")+
      `, dated ${t.date?fmtDate(t.date):"(no date)"}. `+
      `[Reconstructed evidence — no transcript was captured at the time.]`;
  };
  for(const t of db.transactions){
    if(t.superseded) continue;
    if(t.evidenceTranscriptId){
      // Format fixup: rows created by the first backfill buried the details
      // behind the disclaimer; rewrite them details-first.
      const tr=db.transcripts.find(x=>x.id===t.evidenceTranscriptId);
      if(tr?.reconstructed&&tr.text.startsWith("Reconstructed evidence for an earlier entry")) tr.text=reconstructedText(t);
      continue;
    }
    const js=(journalsByTx[t.id]||[]).filter(j=>!j.superseded);
    if(js.some(j=>j.transcriptId&&db.transcripts.some(x=>x.id===j.transcriptId))) continue; // already has evidence
    const tr={id:"T_"+crypto.randomUUID(),dateTime:new Date().toISOString(),date:t.date||"",
      speaker:users?.[activeUserId]?.name||"My Books",source:"manual",text:reconstructedText(t),reconstructed:true};
    db.transcripts.push(tr);
    t.evidenceTranscriptId=tr.id; // idempotency: never backfill the same transaction twice
    js.forEach(j=>{j.transcriptId=j.transcriptId||tr.id;});
  }

  // Opening balances: account.opening never reached the ledger, so statements
  // missed it (dashboard counted it, reports didn't). Post it once as a real
  // opening journal entry: Dr the account / Cr Owner's Equity.
  for(const a of db.accounts){
    const opening=Number(a.opening)||0;
    if(opening<=0) continue;
    if(db.journalEntries.some(j=>j.openingFor===a.id)) continue;
    const d=new Date();
    const todayStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const dates=[...db.journalEntries.map(j=>j.date),...db.transactions.map(t=>t.date)].filter(Boolean).sort();
    db.journalEntries.push({id:makeId("J"),transcriptId:null,sourceTxId:"opening:"+a.id,openingFor:a.id,
      date:(dates[0]&&dates[0]<todayStr)?dates[0]:todayStr,
      description:`Opening balance — ${a.name}`,
      lines:[{account:a.name,debit:opening,credit:0},{account:"Owner's Equity",debit:0,credit:opening}]});
  }

  // Year-typo repair: this business started in 2026, so entries dated 1900–2024
  // ("8/14/2016") are typos — bring them to the same month/day of the current
  // year. Original kept in dateFixedFrom.
  {
    const curY=new Date().getFullYear();
    const fixYear=s=>{
      const m=String(s||"").match(/^(\d{4})(-\d{2}-\d{2})$/);
      if(!m) return null;
      const y=Number(m[1]);
      return (y>=1900&&y<=curY-2)?String(curY)+m[2]:null;
    };
    for(const t of db.transactions){
      const f=fixYear(t.date);
      if(f){t.dateFixedFrom=t.date;t.date=f;}
    }
    for(const j of db.journalEntries){
      const f=fixYear(j.date);
      if(f){j.dateFixedFrom=j.date;j.date=f;}
    }
    for(const t of db.transcripts){
      const f=fixYear(t.date);
      if(f){t.dateFixedFrom=t.date;t.date=f;}
    }
  }

  // Persist repaired profile in memory; normal save will write it.
  if(users && activeUserId && users[activeUserId]) users[activeUserId].db=db;
}
ensureDbShape();

const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n)||0);
// Format in local time. toISOString() is UTC and shifted "today" to tomorrow
// for US users in the evening.
const localISODate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const today=()=>localISODate(new Date());
// Display dates the normal way (8/14/2026); storage stays ISO for sorting.
// Function declaration (hoisted): ensureDbShape's evidence backfill runs
// before this line executes on first load.
function fmtDate(iso){const m=String(iso||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${Number(m[2])}/${Number(m[3])}/${m[1]}`:String(iso||"");}
if($("#txDate")) $("#txDate").value=today();

// Edits are append-only: superseded records stay in the DB as the audit trail
// but are excluded from balances, lists, and the ledger.
const activeTxs=()=>db.transactions.filter(t=>!t.superseded);
const activeJournal=()=>(db.journalEntries||[]).filter(j=>!j.superseded);

// Write to localStorage without re-rendering — for capture points (transcripts,
// learning feedback) that must survive a refresh even if nothing is approved yet.
function persist(){
  users[activeUserId].db=db;
  try{
    localStorage.setItem(USERS_KEY,JSON.stringify(users));
    localStorage.setItem(ACTIVE_USER_KEY,activeUserId);
    const w=document.getElementById("storageFullWarn"); if(w) w.remove();
    return true;
  }catch(err){
    // Browser storage quota hit (photos are the usual culprit). Never silent.
    console.error("persist failed:",err);
    try{
      let b=document.getElementById("storageFullWarn");
      if(!b){
        b=document.createElement("div");
        b.id="storageFullWarn";
        b.style.cssText="position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;background:#7a1d1d;color:#ffd9d9;border:1px solid #b93b3b;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:600;max-width:90vw;cursor:pointer";
        b.title="Click to dismiss";
        b.onclick=()=>b.remove();
        document.body&&document.body.appendChild(b);
      }
      b.textContent="⚠ Browser storage is full — the newest change is NOT saved yet. Photos are being compressed to free space; try again in a few seconds.";
    }catch{}
    return false;
  }
}

// Photos from phone cameras are huge; shrink before storing (max 1200px JPEG).
async function shrinkImageDataUrl(dataUrl,maxDim=1200,quality=0.72){
  if(!dataUrl||!String(dataUrl).startsWith("data:image")) return dataUrl;
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=dataUrl;});
    const scale=Math.min(1,maxDim/Math.max(img.width,img.height));
    const c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(img.width*scale));
    c.height=Math.max(1,Math.round(img.height*scale));
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    const out=c.toDataURL("image/jpeg",quality);
    return out.length<String(dataUrl).length?out:dataUrl;
  }catch{return dataUrl;}
}

// One-time space rescue: compress oversized photos already stored in ANY profile.
setTimeout(async()=>{
  let freed=0;
  for(const u of Object.values(users)){
    for(const r of (u.db?.receipts||[])){
      if(r.imageData&&r.imageData.length>200000){
        const s=await shrinkImageDataUrl(r.imageData);
        if(s.length<r.imageData.length){freed+=r.imageData.length-s.length;r.imageData=s;}
      }
    }
  }
  if(freed>0){
    persist();
    console.log(`Compressed stored photos: freed ~${Math.round(freed/1024)} KB.`);
  }
},2500);
let backupDebounce=null;
function save(){
  persist();
  // Continuous protection: every change schedules a server backup (60s debounce).
  clearTimeout(backupDebounce);
  backupDebounce=setTimeout(()=>{if(typeof backupToServer==="function")backupToServer().catch(()=>{});},60000);
  renderAll();
  if(typeof renderLearningStats==="function")renderLearningStats();
  if(typeof renderUserSwitcher==="function")renderUserSwitcher();
}
function accountBalance(id){
  const a=db.accounts.find(x=>x.id===id); if(!a)return 0;
  let b=Number(a.opening)||0;
  for(const t of activeTxs()){
    if(t.type==="income"&&t.account===id)b+=t.amount;
    if(t.type==="expense"&&t.account===id)b-=t.amount;
    if(t.type==="receive_invoice"&&t.account===id)b+=t.amount;
    if(t.type==="pay_bill"&&t.account===id)b-=t.amount;
    if(t.type==="buy_investment"&&t.account===id)b-=t.amount;
    if(t.type==="sell_investment"&&t.account===id)b+=t.amount;
    if(t.type==="transfer"){if(t.account===id)b-=t.amount;if(t.toAccount===id)b+=t.amount;}
  }
  for(const i of db.investments){
    if(i.account!==id)continue;
    if(i.action==="buy")b-=i.shares*i.price;
    if(i.action==="sell")b+=i.shares*i.price;
  }
  return b;
}
function renderAccounts(){
  const opts=db.accounts.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
  if($("#txAccount")) $("#txAccount").innerHTML=opts;
  if($("#txToAccount")) $("#txToAccount").innerHTML=opts;
}
function openAR(){
  let invoices=0, received=0;
  for(const t of activeTxs()){
    if(t.type==="invoice") invoices+=t.amount;
    if(t.type==="receive_invoice") received+=t.amount;
  }
  return Math.max(0,invoices-received);
}
function openAP(){
  let bills=0, paid=0;
  for(const t of activeTxs()){
    if(t.type==="bill") bills+=t.amount;
    if(t.type==="pay_bill") paid+=t.amount;
  }
  return Math.max(0,bills-paid);
}
function recognizedForMonth(t,m,y){
  const d=new Date(t.date+"T00:00:00");
  if(d.getMonth()!==m||d.getFullYear()!==y) return null;
  const method=db.settings.accountingMethod;
  if(t.type==="use_supplies") return {kind:"expense",amount:t.amount}; // consumed materials count as expense either way
  if(method==="cash"){
    if(t.type==="income"||t.type==="receive_invoice") return {kind:"income",amount:t.amount};
    if(t.type==="expense"||t.type==="pay_bill") return {kind:"expense",amount:t.amount};
  }else{
    if(t.type==="income"||t.type==="invoice") return {kind:"income",amount:t.amount};
    if(t.type==="expense"||t.type==="bill") return {kind:"expense",amount:t.amount};
  }
  return null;
}
function renderDashboard(){
  const now=new Date(),m=now.getMonth(),y=now.getFullYear();let inc=0,exp=0;
  for(const t of activeTxs()){
    const r=recognizedForMonth(t,m,y);
    if(r){if(r.kind==="income")inc+=r.amount;else exp+=r.amount;}
  }
  $("#cashTotal").textContent=money(db.accounts.reduce((s,a)=>s+accountBalance(a.id),0));
  $("#monthIncome").textContent=money(inc);
  $("#monthExpense").textContent=money(exp);
  $("#methodLabel").textContent=db.settings.accountingMethod==="accrual"?"Accrual":"Cash";
  $("#arTotal").textContent=money(openAR());
  $("#apTotal").textContent=money(openAP());
  if($("#invTotal")){
    const inv=Object.values(computeHoldings()).reduce((s,h)=>s+h.cost,0);
    $("#invTotal").textContent=money(inv);
  }
  const recent=activeTxs().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  $("#recentList").innerHTML=recent.map(t=>txRow(t,false)).join("")||"<p class='muted'>No transactions yet.</p>";
}
function accountName(id){return db.accounts.find(a=>a.id===id)?.name||"Unknown"}
function txRow(t,editable=true){
  const sign=(t.type==="income"||t.type==="sell_investment")?"+":(t.type==="expense"||t.type==="use_supplies"||t.type==="buy_investment")?"-":"";
  const cls=t.type==="income"?"income":(t.type==="expense"||t.type==="use_supplies")?"expense":"";
  const labels={invoice:"Customer invoice (A/R)",bill:"Vendor bill (A/P)",receive_invoice:"Invoice payment received",pay_bill:"Vendor bill paid",use_supplies:"Supplies used (adjustment)",buy_investment:"Bought investment",sell_investment:"Sold investment"};
  const invInfo=(t.type==="buy_investment"||t.type==="sell_investment")&&t.ticker?` • ${t.shares} × ${String(t.ticker).toUpperCase()}`:"";
  // The trailing label must say where value really moved: bills/invoices touch
  // no cash yet, and supplies-used consumes filament, not money.
  const where=t.type==="use_supplies"?"from Supplies (no money moved)"
    :t.type==="bill"?"not paid yet (A/P)"
    :t.type==="invoice"?"they owe you (A/R)"
    :accountName(t.account);
  const desc=t.type==="transfer"?`${escapeHtml(accountName(t.account))} → ${escapeHtml(accountName(t.toAccount))}`:`${escapeHtml(labels[t.type]||t.category||t.type)}${escapeHtml(invInfo)} • ${escapeHtml(where)}`;
  const edited=t.revisionOf?` • edited`:"";
  return `<div class="row" data-txid="${t.id}"><div><b>${desc}</b><small>${fmtDate(t.date)}${t.note?` • ${escapeHtml(t.note)}`:""}${edited}</small></div>
    <div class="txRight"><strong class="amount ${cls}">${sign}${money(t.amount)}</strong>${editable?`<button class="ghost" data-edit-tx="${t.id}">✏️ Edit</button>`:""}</div></div>`;
}
function renderTransactions(){
  const el=$("#txList"); if(!el)return;
  const q=($("#txSearch")?.value||"").toLowerCase();
  const arr=activeTxs().sort((a,b)=>b.date.localeCompare(a.date)).filter(t=>JSON.stringify(t).toLowerCase().includes(q));
  el.innerHTML=arr.map(t=>txRow(t)).join("")||"<p class='muted'>No matching transactions.</p>";
}

// ---- Plans: Standard $10/mo, Pro $50/mo. Pro-only: the AI agent (LLM mode),
// invoices & bills (A/R, A/P), and materials/COGS adjustments.
// Tiers: free = full manual bookkeeping; standard = + helper agent (local);
// pro = + AI agent (LLM). The creator gets everything regardless of plan.
function planTier(){
  if(window.__bkId?.owner) return "pro";
  const p=db.settings.plan;
  return (p==="pro"||p==="standard")?p:"free";
}
function isPro(){return planTier()==="pro";}
function hasAgent(){return planTier()!=="free";}
function renderPlanUI(){
  const cur=(db.settings.plan==="pro"||db.settings.plan==="standard")?db.settings.plan:"free";
  if($("#planFree")) $("#planFree").classList.toggle("current",cur==="free");
  if($("#planStandard")) $("#planStandard").classList.toggle("current",cur==="standard");
  if($("#planPro")) $("#planPro").classList.toggle("current",cur==="pro");
  // Creator-granted personal discount changes the prices this member sees.
  const d=Math.max(0,Math.min(100,Number(window.__bkId?.discount||0)));
  const price=b=>b===0?`$0<span>/month</span>`:(d>0?`<s>$${b}</s> $${Math.round(b*(1-d/100))}<span>/month</span>`:`$${b}<span>/month</span>`);
  const fp=document.querySelector("#planFree .planPrice"), sp=document.querySelector("#planStandard .planPrice"), pp=document.querySelector("#planPro .planPrice");
  if(fp) fp.innerHTML=price(0);
  if(sp) sp.innerHTML=price(10);
  if(pp) pp.innerHTML=price(50);
  if($("#planStatus")) $("#planStatus").textContent=window.__bkId?.owner
    ?`👑 Creator account — every feature is free for you. (Plan card set to ${cur==="pro"?"Pro":"Standard"} — switching it changes nothing for you.)`
    :(cur==="pro"
      ?"Current plan: Pro — the AI agent understands anything you say."
      :cur==="standard"
        ?"Current plan: Standard — the helper agent is on. Pro upgrades it to the AI agent."
        :"Current plan: Free — full manual bookkeeping. Standard adds the agent you can talk to.")
      +(d>0?` 🎁 The creator gave you ${d}% off.`:"");
}

// Login status: the top-bar chip was removed (it duplicated the profile
// dropdown). Logging out lives in Settings → Profile instead.
function renderLoginStatus(){
  const old=document.getElementById("loginStatus"); if(old) old.remove();
  const btn=$("#logoutBtn"); if(!btn) return;
  const w=window.__bkId||{};
  if(w.name){
    btn.classList.remove("hidden");
    btn.textContent=`Log out ${w.name}${w.owner?" 👑":""}`;
    btn.title=w.email?`Logged in as ${w.email}`:"";
    btn.onclick=()=>{if(confirm(`Log out ${w.name}?`))location.href="/logout";};
  }else{
    btn.classList.add("hidden");
  }
}

// ---- Web-shop orders (creator only): hardywu.com orders land here and are
// booked as customer invoices (A/R) with one click.
async function renderOrdersPanel(){
  const panel=$("#ordersPanel"); if(!panel) return;
  if(!window.__bkId?.owner){panel.classList.add("hidden");return;}
  try{
    const data=await backendFetch("/api/orders");
    const orders=data.orders||[];
    window.__webOrders=orders;
    if(!orders.length){panel.classList.add("hidden");return;}
    panel.classList.remove("hidden");
    $("#ordersList").innerHTML=orders.map(o=>`
      <div class="row"><div><b>${o.qty} × ${escapeHtml(o.product_name||o.product)}</b> — ${money(o.total)}
        <small class="muted">from ${escapeHtml(o.buyer)}${o.color?` • ${escapeHtml(o.color)}`:""}${o.custom_text?` • “${escapeHtml(o.custom_text)}”`:""} • ${fmtDate(String(o.created_at).slice(0,10))}</small></div>
        <div class="txRight"><button class="primary" data-book-order="${escapeHtml(o.id)}">Book as invoice</button>
        <button class="ghost" data-dismiss-order="${escapeHtml(o.id)}" title="Remove without booking">✕</button></div></div>`).join("");
  }catch{panel.classList.add("hidden");}
}
if($("#ordersPanel")) $("#ordersPanel").addEventListener("click",async e=>{
  const dis=e.target.closest("[data-dismiss-order]");
  if(dis){
    if(!confirm("Remove this order without booking it?"))return;
    try{await backendFetch("/api/orders/update",{method:"POST",body:JSON.stringify({id:dis.dataset.dismissOrder,status:"dismissed"})});}catch(err){alert(err.message);return;}
    renderOrdersPanel();return;
  }
  const btn=e.target.closest("[data-book-order]"); if(!btn) return;
  const o=(window.__webOrders||[]).find(x=>x.id===btn.dataset.bookOrder); if(!o) return;
  const note=`${o.qty} × ${o.product_name||o.product} — web order from ${o.buyer}`+(o.color?` (${o.color}${o.custom_text?`, “${o.custom_text}”`:""})`:(o.custom_text?` (“${o.custom_text}”)`:""));
  const tx={id:crypto.randomUUID(),date:today(),type:"invoice",account:db.accounts[0]?.id||"",toAccount:null,
    category:"Sales Revenue",amount:Number(o.total)||0,note,dueDate:"",related:o.id};
  const t=recordTranscript(`Web order ${o.id}: ${note}. Total ${money(o.total)} — invoiced, to be paid on delivery.`,"manual",users[activeUserId]?.name||"User",tx.date);
  tx.evidenceTranscriptId=t.id;
  db.transactions.push(tx);
  const generated=transformTransactionToJournal(tx,t.id);
  db.journalEntries.push(...generated);
  generated.forEach(j=>backendSaveJournal(j).catch(err=>console.warn("Backend journal save failed:",err)));
  save();
  try{await backendFetch("/api/orders/update",{method:"POST",body:JSON.stringify({id:o.id,status:"booked"})});}catch{}
  renderOrdersPanel();
});

// ---- Creator (owner) tools: member list + personal discounts.
async function renderMembersPanel(){
  const panel=$("#membersPanel"); if(!panel) return;
  if(!window.__bkId?.owner){panel.classList.add("hidden");return;}
  panel.classList.remove("hidden");
  try{
    const data=await backendFetch("/api/members");
    $("#membersList").innerHTML=(data.members||[]).map(m=>`
      <div class="row"><div><b>${escapeHtml(m.name)}</b>${m.email?` <small class="muted">${escapeHtml(m.email)}</small>`:""}
        <small class="muted">member since ${escapeHtml(String(m.first_seen).slice(0,10))} • last seen ${escapeHtml(String(m.last_seen).slice(0,10))} • ${Number(m.visits)||0} visit${(Number(m.visits)||0)===1?"":"s"}</small></div>
        <div class="txRight"><label class="discountLbl">Discount %
          <input type="number" min="0" max="100" value="${Number(m.discount_pct)||0}" data-name="${escapeHtml(m.name)}" class="discountInput"></label>
        <button data-save-discount="${escapeHtml(m.name)}">Save</button>
        <button data-delete-member="${escapeHtml(m.name)}" class="danger" title="Remove this member">🗑️</button></div></div>`).join("")
      ||'<p class="muted">No members yet — people appear here after they log in from a phone.</p>';
  }catch(err){
    $("#membersList").innerHTML=`<p class="muted">Could not load members: ${escapeHtml(err.message)}</p>`;
  }
}
if($("#membersPanel")) $("#membersPanel").addEventListener("click",async e=>{
  const del=e.target.closest("[data-delete-member]");
  if(del){
    const name=del.dataset.deleteMember;
    if(!confirm(`Remove "${name}" from the member list?\n\nTheir discount is removed too. Their books on their own device and their backups are NOT touched — and they can rejoin just by logging in again.`))return;
    try{
      await backendFetch("/api/members/delete",{method:"POST",body:JSON.stringify({name})});
      renderMembersPanel();
    }catch(err){alert("Could not remove the member: "+err.message);}
    return;
  }
  const btn=e.target.closest("[data-save-discount]"); if(!btn) return;
  const name=btn.dataset.saveDiscount;
  const input=document.querySelector(`.discountInput[data-name="${CSS.escape(name)}"]`);
  const pct=Math.max(0,Math.min(100,Number(input?.value)||0));
  try{
    await backendFetch("/api/members/discount",{method:"POST",body:JSON.stringify({name,discount_pct:pct})});
    btn.textContent="✓ Saved";
    setTimeout(()=>{btn.textContent="Save";},1500);
  }catch(err){alert("Could not save the discount: "+err.message);}
});
function updateProLocks(){
  const pro=isPro(), agentOn=hasAgent();
  // All transaction types are free — only the agent is tiered.
  document.querySelectorAll("#txType option").forEach(o=>{
    if(o.dataset.baseLabel){o.textContent=o.dataset.baseLabel;}
    o.disabled=false;
  });
  const apiOpt=document.querySelector('#agentMode option[value="api"]');
  if(apiOpt){
    if(!apiOpt.dataset.baseLabel) apiOpt.dataset.baseLabel=apiOpt.textContent;
    apiOpt.disabled=!pro;
    apiOpt.textContent=apiOpt.dataset.baseLabel+(pro?"":" — Pro");
  }
  for(const id of ["agentInput","agentSend","micBtn"]){
    const el=$("#"+id); if(el) el.disabled=!agentOn;
  }
  if($("#agentInput")) $("#agentInput").placeholder=agentOn
    ?"Example: Sold computer for $100. Put it in Cash."
    :"🔒 The agent is part of the Standard plan ($10/month) — upgrade in Settings → Plan. Manual entry stays free.";
  renderPlanUI();
}
document.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>{
  const target=b.dataset.plan;
  if(target===(db.settings.plan||"standard")) return;
  if(target==="pro"&&!confirm("Upgrade this profile to Pro for $50/month?")) return;
  if(target==="standard"&&!confirm("Set this profile to Standard ($10/month)? The helper agent turns on; the AI agent stays Pro.")) return;
  if(target==="free"&&!confirm("Move down to Free? The agent locks — manual bookkeeping stays fully available.")) return;
  db.settings.plan=target;
  if(target!=="pro"&&db.settings.agentMode==="api"){
    db.settings.agentMode="local";
    if($("#agentMode")) $("#agentMode").value="local";
  }
  save();
  updateProLocks();
});

// One shared, human-phrased grouping for transaction types (values unchanged).
const TX_TYPE_GROUPS=[
  ["Money out",[["expense","Paid now (expense)"],["bill","Will pay later — got a bill (A/P)"],["pay_bill","Paying an earlier bill"]]],
  ["Money in",[["income","Got paid now (income)"],["invoice","Will be paid later — send invoice (A/R)"],["receive_invoice","Customer paid an earlier invoice"]]],
  ["My own accounts",[["transfer","Move money between my accounts"]]],
  ["Adjustments",[["use_supplies","Used up supplies/materials (no money moved)"]]],
  ["Investments",[["buy_investment","Bought stock/investment"],["sell_investment","Sold stock/investment"]]]
];
// Shared grouped chart-category <select> — used by the transaction editor AND
// the agent's "Edit entries" form, so picks are always chart names.
function chartCategorySelectHtml(cls,current){
  const groups=[["Revenue — money earned",CHART_REVENUE],
    ["Expenses — money spent and used up",CHART_EXPENSE],
    ["Assets bought — things you keep",CHART_BOUGHT_ASSETS],
    ["Materials used (adjustments)",["Cost of Goods Sold","R&D Expense"]]];
  const inChart=groups.some(([,cats])=>cats.includes(current));
  return `<select class="${cls}">`+groups.map(([label,cats])=>`<optgroup label="${escapeHtml(label)}">`+
      cats.map(c=>`<option value="${escapeHtml(c)}" ${c===current?"selected":""}>${escapeHtml(c)}</option>`).join("")+`</optgroup>`).join("")+
    (current&&!inChart?`<optgroup label="Current (not in chart)"><option value="${escapeHtml(current)}" selected>${escapeHtml(current)}</option></optgroup>`:"")+`</select>`;
}

function txTypeOptionsHtml(selected){
  return TX_TYPE_GROUPS.map(([label,opts])=>`<optgroup label="${label}">`+
    opts.map(([v,l])=>`<option value="${v}" ${v===selected?"selected":""}>${l}</option>`).join("")+`</optgroup>`).join("");
}

function openTxEditor(id){
  const t=db.transactions.find(x=>x.id===id&&!x.superseded); if(!t)return;
  const row=document.querySelector(`#txList .row[data-txid="${id}"]`); if(!row)return;
  const accountOptions=db.accounts.map(a=>`<option value="${a.id}" ${a.id===t.account?"selected":""}>${escapeHtml(a.name)}</option>`).join("");
  const typeOptions=txTypeOptionsHtml(t.type);
  row.innerHTML=`<div class="txEditor">
    <label>Date<input class="editDate" type="date" value="${t.date}"></label>
    <label>Type<select class="editType">${typeOptions}</select></label>
    <label>Account<select class="editAccount">${accountOptions}</select></label>
    <label>Category${chartCategorySelectHtml("editCategory",t.category)}</label>
    <label>Amount<input class="editAmount" type="number" step="0.01" min="0" value="${t.amount}"></label>
    <label class="full">Note<input class="editNote" value="${escapeHtml(t.note||"")}"></label>
    <div class="actions"><button class="primary" data-apply-tx="${id}">Save as new record</button><button data-cancel-tx="1">Cancel</button><button class="danger" data-del-tx="${id}">Delete this transaction</button></div>
  </div>`;
}

function applyTxEdit(id){
  const old=db.transactions.find(x=>x.id===id&&!x.superseded); if(!old)return;
  const row=document.querySelector(`#txList .row[data-txid="${id}"]`); if(!row)return;
  const amount=Number(row.querySelector(".editAmount").value);
  if(!(amount>0)){alert("Amount must be a positive number.");return;}
  const newDate=row.querySelector(".editDate").value||old.date;
  const yr=Number(String(newDate).slice(0,4));
  if(yr&&yr<new Date().getFullYear()-1&&!confirm(`The year is ${yr} — is that really right? (A typo like 2016 instead of 2026 hides the entry from "this month" totals.)`))return;
  const updated={
    ...old,
    id:crypto.randomUUID(),
    date:row.querySelector(".editDate").value||old.date,
    type:row.querySelector(".editType").value,
    account:row.querySelector(".editAccount").value,
    category:row.querySelector(".editCategory").value.trim()||old.category,
    amount,
    note:row.querySelector(".editNote").value.trim(),
    revisionOf:id,
    editedAt:new Date().toISOString()
  };
  // Append-only: the original stays as history; its journal entries retire too.
  old.superseded=true; old.supersededBy=updated.id;
  let transcriptId=null;
  for(const j of db.journalEntries){
    if(j.sourceTxId===id){ j.superseded=true; transcriptId=j.transcriptId||transcriptId; }
  }
  db.transactions.push(updated);
  const generated=transformTransactionToJournal(updated,transcriptId);
  db.journalEntries.push(...generated);
  generated.forEach(j=>backendSaveJournal(j).catch(err=>console.warn("Backend journal save failed:",err)));
  save();
}

function voidTransaction(id){
  const t=db.transactions.find(x=>x.id===id&&!x.superseded); if(!t)return;
  const what=`${fmtDate(t.date)} • ${money(t.amount)}${t.category?` • ${t.category}`:""}${t.note?` • ${t.note}`:""}`;
  if(!confirm(`Delete this transaction?\n\n${what}\n\nIt disappears from the books and reports, but stays in history (and CSV export) marked as deleted — nothing is silently erased.`))return;
  // Append-only delete: supersede with no replacement; its journal entries retire too.
  t.superseded=true;
  t.voidedAt=new Date().toISOString();
  for(const j of db.journalEntries){
    if(j.sourceTxId===id) j.superseded=true;
  }
  save();
}

// One delegated listener survives re-renders.
if($("#txList")) $("#txList").addEventListener("click",e=>{
  const edit=e.target.closest("[data-edit-tx]");
  if(edit){openTxEditor(edit.dataset.editTx);return;}
  const del=e.target.closest("[data-del-tx]");
  if(del){voidTransaction(del.dataset.delTx);return;}
  const apply=e.target.closest("[data-apply-tx]");
  if(apply){applyTxEdit(apply.dataset.applyTx);return;}
  if(e.target.closest("[data-cancel-tx]")) renderTransactions();
});

function renderInvestments(){ /* Investments UI removed; historical data stays in backups. */ }

function statementData(asOf){
  // Statements come straight from the general ledger (the T-accounts), so they
  // always reconcile with what the Ledger tab shows.
  const accounts=buildLedger(asOf);
  const assets={},liabilities={},equityRows={},incomeRows={},expenseRows={};

  for(const a of accounts){
    if(Math.abs(a.balance)<0.005) continue;
    const type=a.type!=="Uncategorized"?a.type:(a.normal==="debit"?"Asset":"Liability");
    if(type==="Asset") assets[a.name]=a.balance;                 // debit balance
    else if(type==="Liability") liabilities[a.name]=-a.balance;  // credit balance
    else if(type==="Equity") equityRows[a.name]=-a.balance;
    else if(type==="Revenue") incomeRows[a.name]=-a.balance;
    else if(type==="Expense") expenseRows[a.name]=a.balance;
  }

  const sum=o=>Object.values(o).reduce((s,v)=>s+v,0);
  const totalIncome=sum(incomeRows);
  const totalExpenses=sum(expenseRows);
  const netIncome=totalIncome-totalExpenses;
  const totalAssets=sum(assets);
  const totalLiabilities=sum(liabilities);
  // Equity = contributed equity accounts + current-period net income
  // (no closing entries yet). Double-entry guarantees the equation holds.
  const equity=sum(equityRows)+netIncome;
  const equationOk=Math.abs(totalAssets-(totalLiabilities+equity))<0.005;

  return {incomeRows,expenseRows,totalIncome,totalExpenses,netIncome,
          assets,liabilities,equityRows,totalAssets,totalLiabilities,equity,equationOk};
}

function reportTable(rows,totalLabel,total){
  const body=Object.entries(rows).map(([k,v])=>`<div class="reportRow"><span>${escapeHtml(k)}</span><strong>${money(v)}</strong></div>`).join("");
  return `${body||'<p class="muted">No activity.</p>'}<div class="reportTotal"><span>${totalLabel}</span><strong>${money(total)}</strong></div>`;
}

function isCashLikeName(name){
  const n=String(name||"").trim().toLowerCase();
  if(/cash|checking|saving|bank/.test(n)) return true;
  // Every money account the user owns counts as cash for the cash-flow
  // statement (an "Earnings" piggy bank is money too).
  return db.accounts.some(a=>String(a.name||"").trim().toLowerCase()===n);
}

function cashFlowData(asOf){
  // Derived from the ledger: for each journal entry that moves cash, classify
  // by what the cash was exchanged for (the counterpart lines).
  let operating=0,investing=0,financing=0;
  const items={Operating:{},Investing:{},Financing:{}};

  for(const j of db.journalEntries||[]){
    if(j.superseded) continue;
    if(asOf && String(j.date||"")>asOf) continue;
    let cashDelta=0;
    const counterTypes=new Set();
    const counterNames=[];
    for(const l of j.lines||[]){
      const delta=Number(l.debit||0)-Number(l.credit||0);
      if(isCashLikeName(l.account)) cashDelta+=delta;
      else if(/equipment|investment/i.test(l.account)){
        counterTypes.add("Investing"); // long-term assets only
        counterNames.push(l.account);
      }else{
        const cls=classifyLedgerAccount(l.account);
        counterTypes.add(cls?cls.type:"Uncategorized");
        counterNames.push(l.account);
      }
    }
    if(Math.abs(cashDelta)<0.005) continue;           // no cash moved
    if(counterTypes.size===0) continue;               // money↔money transfer: excluded
    let bucket="Operating"; // revenue, expenses, supplies, A/R collections, A/P payments
    if(counterTypes.has("Equity")) bucket="Financing";           // owner money in/out
    else if(counterTypes.has("Investing")) bucket="Investing";   // equipment & stocks
    if(bucket==="Financing") financing+=cashDelta;
    else if(bucket==="Investing") investing+=cashDelta;
    else operating+=cashDelta;
    const label=counterNames[0]||"Other";
    items[bucket][label]=(items[bucket][label]||0)+cashDelta;
  }
  return {operating,investing,financing,net:operating+investing+financing,items};
}

function renderReports(){
  if(!$("#reportDate")) return;
  const asOf=$("#reportDate").value||today();
  const d=statementData(asOf);

  const equitySection=Object.keys(d.equityRows||{}).length
    ? reportTable(d.equityRows,"Contributed Equity",Object.values(d.equityRows).reduce((s,v)=>s+v,0))
    : "";

  $("#balanceSheet").innerHTML=`
    <h3>Assets</h3>${reportTable(d.assets,"Total Assets",d.totalAssets)}
    <h3>Liabilities</h3>${reportTable(d.liabilities,"Total Liabilities",d.totalLiabilities)}
    <h3>Equity</h3>${equitySection}
    <div class="reportRow"><span>Net Income (current period)</span><strong>${money(d.netIncome)}</strong></div>
    <div class="reportTotal equity"><span>Total Equity</span><strong>${money(d.equity)}</strong></div>
    <p class="muted">${d.equationOk?"✓":"⚠"} Assets ${money(d.totalAssets)} = Liabilities ${money(d.totalLiabilities)} + Equity ${money(d.equity)} — built from the general ledger.</p>`;

  $("#incomeStatement").innerHTML=`
    <h3>Revenue</h3>${reportTable(d.incomeRows,"Total Revenue",d.totalIncome)}
    <h3>Expenses</h3>${reportTable(d.expenseRows,"Total Expenses",d.totalExpenses)}
    <div class="reportTotal net"><span>Net Income</span><strong>${money(d.netIncome)}</strong></div>`;

  const c=cashFlowData(asOf);
  const cfSection=(title,total,obj)=>{
    const rows=Object.entries(obj).sort((a,b)=>b[1]-a[1])
      .map(([k,v])=>`<div class="reportRow"><span>${v>=0?"Cash from":"Cash paid for"} ${escapeHtml(k)}</span><strong>${money(v)}</strong></div>`).join("");
    return `<h3>${title}</h3>${rows||'<p class="muted">No activity.</p>'}<div class="reportTotal"><span>Total ${title}</span><strong>${money(total)}</strong></div>`;
  };
  $("#cashFlowStatement").innerHTML=
    cfSection("Operating Activities",c.operating,c.items.Operating)+
    cfSection("Investing Activities",c.investing,c.items.Investing)+
    cfSection("Financing Activities",c.financing,c.items.Financing)+
    `<div class="reportTotal net"><span>Net Change in Cash</span><strong>${money(c.net)}</strong></div>
    <p class="muted">Transfers between your own money accounts are excluded. Using up supplies moves no money — that expense lives on the Income Statement.</p>`;
}

// One statement at a time (Balance Sheet | Income | Cash Flow | Analysis pills).
if($("#stmtTabs")) $("#stmtTabs").addEventListener("click",e=>{
  const btn=e.target.closest("[data-stmt]"); if(!btn)return;
  document.querySelectorAll("#stmtTabs [data-stmt]").forEach(b=>b.classList.toggle("primary",b===btn));
  document.querySelectorAll(".stmtPanel").forEach(p=>p.classList.toggle("hidden",p.id!==btn.dataset.stmt));
  if(btn.dataset.stmt==="analysisPanel") renderAnalysis();
});

// ================= FINANCIAL ANALYSIS (Reports → 📊) =================
// Every margin, return, health ratio, and per-share number, each with a
// plain-language explanation — computed straight from the ledger statements.
function renderAnalysis(){
  const out=$("#analysisOut"); if(!out) return;
  const asOf=$("#reportDate")?.value||today();
  const d=statementData(asOf);
  const c=cashFlowData(asOf);
  const pctf=x=>isFinite(x)?(x*100).toFixed(1)+"%":"—";
  const ratf=x=>isFinite(x)?x.toFixed(2):"—";
  const rev=d.totalIncome;
  const cogs=d.expenseRows["Cost of Goods Sold"]||0;
  const rnd=d.expenseRows["R&D Expense"]||0;
  const gross=rev-cogs;
  const opex=d.totalExpenses-cogs;
  const ni=d.netIncome;
  const shares=Math.max(1,Math.round(Number($("#epsShares")?.value)||Number(db.settings.sharesOutstanding)||100));
  if(db.settings.sharesOutstanding!==shares){db.settings.sharesOutstanding=shares;persist();}
  if($("#epsShares")) $("#epsShares").value=shares;
  const currentAssets=Object.entries(d.assets).filter(([k])=>!/equipment/i.test(k)).reduce((s,[,v])=>s+v,0);
  const row=(name,val,why)=>`<div class="reportRow analysisRow"><span>${name}<small class="muted">${why}</small></span><strong>${val}</strong></div>`;
  out.innerHTML=`
    <h3>Profitability & margins</h3>
    ${row("Revenue",money(rev),"everything earned")}
    ${row("Cost of Goods Sold",money(cogs),"materials inside what you sold")}
    ${row("Gross profit",money(gross),"revenue minus COGS")}
    ${row("Gross margin",pctf(gross/rev),"how much of each $1 of sales is left after materials")}
    ${row("Operating expenses",money(opex),"all other costs (rent, supplies, R&D…)")}
    ${row("Net margin",pctf(ni/rev),"profit kept from each $1 of sales after ALL costs")}
    ${row("R&D share of revenue",pctf(rnd/rev),"how much of sales goes into experiments and failed prints")}
    ${row("Net income",money(ni),"the bottom line")}
    <h3>Per share</h3>
    ${row("Earnings per share (EPS)",money(ni/shares),`net income ÷ ${shares} shares`)}
    ${row("Book value per share",money(d.equity/shares),"equity ÷ shares — what one share 'owns'")}
    <h3>Returns</h3>
    ${row("Return on assets (ROA)",pctf(ni/d.totalAssets),"profit per $1 of stuff the business owns")}
    ${row("Return on equity (ROE)",pctf(ni/d.equity),"profit per $1 the owner has in the business")}
    <h3>Financial health</h3>
    ${row("Current ratio",ratf(currentAssets/d.totalLiabilities),"short-term assets ÷ debts — higher is safer ('—' = no debts at all)")}
    ${row("Working capital",money(currentAssets-d.totalLiabilities),"cushion left after paying every bill")}
    ${row("Debt-to-equity",ratf(d.totalLiabilities/d.equity),"owed vs owned — lower is safer")}
    ${row("Accounts receivable",money(openAR()),"customers still owe you this")}
    ${row("Accounts payable",money(openAP()),"you still owe others this")}
    <h3>Cash flow</h3>
    ${row("Operating cash flow",money(c.operating),"cash made by actually running the business")}
    ${row("Investing cash flow",money(c.investing),"cash into/out of lasting things like equipment")}
    ${row("Financing cash flow",money(c.financing),"cash from the owner or borrowing")}
    ${row("Net change in cash",money(c.net),"did the pile of money grow?")}
    ${(()=>{const hold=Object.entries(computeHoldings()).filter(([,v])=>v.shares>0);
      if(!hold.length) return "";
      const tot=hold.reduce((s,[,v])=>s+v.cost,0);
      return `<h3>Investments (at cost)</h3>`+
        hold.map(([k,v])=>row(escapeHtml(k),`${v.shares} sh — ${money(v.cost)}`,`average ${money(v.cost/v.shares)} per share`)).join("")+
        row("Total invested",money(tot),"what you paid for what you still hold");})()}
    <p class="muted">Computed from the ledger as of ${fmtDate(asOf)}. "—" means it cannot be computed yet (e.g. margins need revenue, the current ratio needs a debt).</p>`;
}
if($("#genAnalysis")) $("#genAnalysis").onclick=renderAnalysis;
if($("#epsShares")){$("#epsShares").value=db.settings.sharesOutstanding||100;$("#epsShares").onchange=renderAnalysis;}

function renderUserSwitcher(){
  const sel=$("#userSwitcher");
  if(!sel) return;
  sel.innerHTML=Object.entries(users).map(([id,u])=>`<option value="${id}" ${id===activeUserId?"selected":""}>${escapeHtml(u.name)}</option>`).join("");
}

function switchUser(id){
  if(!users[id]) return;
  activeUserId=id;
  db=users[id].db;
  ensureDbShape();
  users[id].db=db;
  localStorage.setItem(USERS_KEY,JSON.stringify(users));
  localStorage.setItem(ACTIVE_USER_KEY,id);
  // refresh settings controls
  if($("#accountingMethod")) $("#accountingMethod").value=db.settings.accountingMethod;
  if($("#agentMode")) $("#agentMode").value=db.settings.agentMode;
  if($("#agentEndpoint")) $("#agentEndpoint").value=db.settings.agentEndpoint;
  if($("#agentModel")) $("#agentModel").value=db.settings.agentModel;
  if($("#userName")) $("#userName").value=users[id]?.name||"";
  renderAll();
  renderLearningStats();
  renderReports();
  renderUserSwitcher();
  if(typeof updateProLocks==="function") updateProLocks();
  if(typeof renderLoginStatus==="function") renderLoginStatus();
}


function makeId(prefix){return prefix+"_"+crypto.randomUUID();}

function recordTranscript(text,source="typed",speaker="User",dateOverride=null){
  const t={
    id:makeId("T"),
    dateTime:new Date().toISOString(),
    date:dateOverride||extractDateFromText(text),
    speaker,
    source,
    text
  };
  db.transcripts.push(t);
  persist(); // transcript-first: evidence must survive even if the plan is never approved
  backendSaveTranscript(t).catch(err=>console.warn("Backend transcript save failed:",err));
  return t;
}

function receiptForTranscript(tid){
  return (db.receipts||[]).filter(r=>r.transcriptId===tid);
}

function journalForTranscript(tid){
  return (db.journalEntries||[]).filter(j=>j.transcriptId===tid);
}

function accountNameByJournalName(name){return name;}

// Like accountName() but falls back to a real ledger account instead of "Unknown"
// when the entry has no account id.
function acctNameOr(id,fallback){
  const a=db.accounts.find(x=>x.id===id);
  return a?a.name:fallback;
}

// Holdings (shares + average cost per ticker), derived from active investment
// transactions in date order — the basis for automatic gain/loss on sales.
function computeHoldings(excludeId){
  const h={};
  const list=db.transactions.map((t,i)=>({t,i}))
    .filter(({t})=>!t.superseded&&(t.type==="buy_investment"||t.type==="sell_investment")&&t.id!==excludeId)
    .sort((a,b)=>String(a.t.date||"").localeCompare(String(b.t.date||""))||a.i-b.i);
  for(const {t} of list){
    const k=String(t.ticker||"?").toUpperCase();
    h[k]=h[k]||{shares:0,cost:0};
    const sh=Number(t.shares)||0;
    if(t.type==="buy_investment"){
      h[k].shares+=sh;
      h[k].cost+=Number(t.amount)||0;
    }else{
      const avg=h[k].shares>0?h[k].cost/h[k].shares:0;
      h[k].cost=Math.max(0,h[k].cost-avg*sh);
      h[k].shares=Math.max(0,h[k].shares-sh);
      if(h[k].shares<1e-9){h[k].shares=0;h[k].cost=0;}
    }
  }
  return h;
}

function transformTransactionToJournal(entry, transcriptId){
  const out=[];
  const amt=Number(entry.amount)||0;
  if(!amt) return out;

  // Lightweight accounting map.
  if(entry.type==="income"){
    const debit=entry.plannedAccountName || acctNameOr(entry.account,"Cash");
    const credit=entry.category || "Sales Revenue";
    out.push({
      id:makeId("J"),transcriptId,sourceTxId:entry.id,date:entry.date,description:entry.note||entry.category,
      lines:[
        {account:debit,debit:amt,credit:0},
        {account:credit,debit:0,credit:amt}
      ]
    });
  }else if(entry.type==="expense"){
    const debit=entry.category || "Expense";
    const credit=acctNameOr(entry.account,"Cash");
    out.push({
      id:makeId("J"),transcriptId,sourceTxId:entry.id,date:entry.date,description:entry.note||entry.category,
      lines:[
        {account:debit,debit:amt,credit:0},
        {account:credit,debit:0,credit:amt}
      ]
    });
  }else if(entry.type==="invoice"){
    out.push({
      id:makeId("J"),transcriptId,sourceTxId:entry.id,date:entry.date,description:entry.note||"Customer invoice",
      lines:[
        {account:"Accounts Receivable",debit:amt,credit:0},
        {account:entry.category||"Sales Revenue",debit:0,credit:amt}
      ]
    });
  }else if(entry.type==="receive_invoice"){
    out.push({
      id:makeId("J"),transcriptId,sourceTxId:entry.id,date:entry.date,description:entry.note||"Invoice payment",
      lines:[
        {account:acctNameOr(entry.account,"Cash"),debit:amt,credit:0},
        {account:"Accounts Receivable",debit:0,credit:amt}
      ]
    });
  }else if(entry.type==="bill"){
    out.push({
      id:makeId("J"),transcriptId,sourceTxId:entry.id,date:entry.date,description:entry.note||"Vendor bill",
      lines:[
        {account:entry.category||"Expense",debit:amt,credit:0},
        {account:"Accounts Payable",debit:0,credit:amt}
      ]
    });
  }else if(entry.type==="pay_bill"){
    out.push({
      id:makeId("J"),transcriptId,sourceTxId:entry.id,date:entry.date,description:entry.note||"Bill payment",
      lines:[
        {account:"Accounts Payable",debit:amt,credit:0},
        {account:acctNameOr(entry.account,"Cash"),debit:0,credit:amt}
      ]
    });
  }else if(entry.type==="transfer"){
    out.push({
      id:makeId("J"),transcriptId,sourceTxId:entry.id,date:entry.date,description:entry.note||"Transfer",
      lines:[
        {account:accountName(entry.toAccount)||"Destination",debit:amt,credit:0},
        {account:accountName(entry.account)||"Source",debit:0,credit:amt}
      ]
    });
  }else if(entry.type==="buy_investment"){
    out.push({
      id:makeId("J"),transcriptId,sourceTxId:entry.id,date:entry.date,
      description:entry.note||`Bought ${entry.shares} shares of ${String(entry.ticker||"").toUpperCase()}`,
      lines:[
        {account:"Investments",debit:amt,credit:0},
        {account:acctNameOr(entry.account,"Cash"),debit:0,credit:amt}
      ]
    });
  }else if(entry.type==="sell_investment"){
    // Average-cost method: proceeds to cash, cost basis out of Investments,
    // the difference is a realized gain (Investment Income) or Investment Loss.
    const k=String(entry.ticker||"?").toUpperCase();
    const h=computeHoldings(entry.id)[k]||{shares:0,cost:0};
    const avg=h.shares>0?h.cost/h.shares:0;
    const basis=Math.min(Math.round(avg*(Number(entry.shares)||0)*100)/100,h.cost);
    const gain=Math.round((amt-basis)*100)/100;
    const lines=[{account:acctNameOr(entry.account,"Cash"),debit:amt,credit:0}];
    if(basis>0) lines.push({account:"Investments",debit:0,credit:basis});
    if(gain>0.004) lines.push({account:"Investment Income",debit:0,credit:gain});
    else if(gain<-0.004) lines.splice(1,0,{account:"Investment Loss",debit:-gain,credit:0});
    out.push({
      id:makeId("J"),transcriptId,sourceTxId:entry.id,date:entry.date,
      description:entry.note||`Sold ${entry.shares} shares of ${k}`,
      lines
    });
  }else if(entry.type==="use_supplies"){
    // Adjusting entry (standard costing): value moves from the Supplies asset
    // to the expense the materials became — Cost of Goods Sold for materials
    // inside sold products, R&D Expense for tests/waste, Supplies Expense
    // for general use. No money account is touched.
    out.push({
      id:makeId("J"),transcriptId,sourceTxId:entry.id,date:entry.date,description:entry.note||"Supplies used",
      lines:[
        {account:entry.category||"Supplies Expense",debit:amt,credit:0},
        {account:"Supplies",debit:0,credit:amt}
      ]
    });
  }
  return out;
}

function balancedJournal(j){
  const d=j.lines.reduce((s,l)=>s+Number(l.debit||0),0);
  const c=j.lines.reduce((s,l)=>s+Number(l.credit||0),0);
  return Math.abs(d-c)<0.005;
}

function renderJournal(){
  const el=$("#journalList"); if(!el)return;
  const arr=activeJournal().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));

  // Conventional journal format: debit lines first, credit account indented below.
  el.innerHTML=arr.map(j=>{
    const debitLines=j.lines.filter(l=>Number(l.debit||0)>0);
    const creditLines=j.lines.filter(l=>Number(l.credit||0)>0);
    const totalDebit=j.lines.reduce((s,l)=>s+Number(l.debit||0),0);
    const totalCredit=j.lines.reduce((s,l)=>s+Number(l.credit||0),0);

    const rows=
      debitLines.map(l=>`<div class="jrnlRow"><span class="jrnlAcct">${escapeHtml(l.account)}</span><span class="jrnlAmt">${money(l.debit)}</span><span class="jrnlAmt"></span></div>`).join("")+
      creditLines.map(l=>`<div class="jrnlRow"><span class="jrnlAcct jrnlCreditAcct">${escapeHtml(l.account)}</span><span class="jrnlAmt"></span><span class="jrnlAmt">${money(l.credit)}</span></div>`).join("");

    return `<div class="journalCard">
      <div class="panelhead">
        <b>${fmtDate(j.date)} • ${escapeHtml(j.description||"")}</b>
        <span class="${balancedJournal(j)?"balanced":"unbalanced"}">${balancedJournal(j)?"Balanced":"Unbalanced"}</span>
      </div>
      <div class="jrnlTable">
        <div class="jrnlRow jrnlHead"><span>Account</span><span>Debit</span><span>Credit</span></div>
        ${rows}
        <div class="jrnlRow jrnlTotals"><span></span><span>${money(totalDebit)}</span><span>${money(totalCredit)}</span></div>
      </div>
      <small class="muted">Journal ID: ${j.id} • Transcript: ${j.transcriptId||"—"}</small>
      ${j.transcriptId?`<div class="actions evidenceActions"><button onclick="showEvidenceDetails('${j.transcriptId}')">See evidence</button></div>`:""}
    </div>`;
  }).join("")||"<p class='muted'>No journal entries yet.</p>";
}

// ============ POSTING ENGINE ("sort"): journal -> ledger T-accounts ============

function classifyLedgerAccount(name){
  const n=String(name||"").toLowerCase().trim();
  // The user's own money accounts are assets no matter what they're named —
  // an account called "Earnings" used as a piggy bank must not be read as
  // revenue (it would cancel real income out of the Income Statement).
  if(db.accounts.some(a=>String(a.name||"").toLowerCase().trim()===n)) return {type:"Asset",normal:"debit"};
  if(/receivable/.test(n)) return {type:"Asset",normal:"debit"};
  if(/payable|credit card|loan|liabilit/.test(n)) return {type:"Liability",normal:"credit"};
  if(/equity|capital/.test(n)) return {type:"Equity",normal:"credit"};
  if(/revenue|sales|income|earnings|winnings|\bbets?\b|\bwagers?\b|\bprizes?\b/.test(n)) return {type:"Revenue",normal:"credit"};
  if(/expense|rent|utilit|wages|filament|repair|cost of goods|cogs|research|development|r&d|loss/.test(n)) return {type:"Expense",normal:"debit"};
  if(/cash|checking|saving|bank|equipment|supplies|inventory|brokerage|investment/.test(n)) return {type:"Asset",normal:"debit"};
  return null; // unknown — infer from activity in buildLedger
}

function buildLedger(asOf=null){
  const reg=new Map();
  let seq=0;
  // Account IDs (A1, A2, …) follow first appearance in the append-only journal, so
  // they stay stable as new entries arrive. Postings are date-sorted per account.
  // Superseded (edited-away) entries and entries after asOf are excluded.
  for(const j of db.journalEntries||[]){
    if(j.superseded) continue;
    if(asOf && String(j.date||"")>asOf) continue;
    for(const l of j.lines||[]){
      const key=normalizeAccountName(l.account);
      if(!key) continue;
      if(!reg.has(key)){
        seq++;
        reg.set(key,{id:"A"+seq,name:l.account,cls:classifyLedgerAccount(l.account),postings:[],totalDr:0,totalCr:0});
      }
      const acc=reg.get(key);
      const dr=Number(l.debit||0),cr=Number(l.credit||0);
      if(dr>0){acc.postings.push({date:j.date,side:"dr",amount:dr,jId:j.id,tId:j.transcriptId,desc:j.description});acc.totalDr+=dr;}
      if(cr>0){acc.postings.push({date:j.date,side:"cr",amount:cr,jId:j.id,tId:j.transcriptId,desc:j.description});acc.totalCr+=cr;}
    }
  }
  return [...reg.values()].map(a=>{
    const cls=a.cls||{type:"Uncategorized",normal:a.totalDr>=a.totalCr?"debit":"credit"};
    a.postings.sort((x,y)=>String(x.date||"").localeCompare(String(y.date||"")));
    return {...a,type:cls.type,normal:cls.normal,balance:a.totalDr-a.totalCr};
  });
}

function renderLedger(){
  const el=$("#ledgerList"); if(!el)return;
  const accounts=buildLedger();

  el.innerHTML=accounts.map(a=>{
    const post=p=>`<div class="tacctPost" ${p.tId?`onclick="showEvidenceDetails('${p.tId}')"`:""} title="${escapeHtml(p.desc||"(no description)")}${p.tId?" — click for full evidence":""}">
        <small>${fmtDate(p.date)}</small><span>${money(p.amount)}</span>
      </div>`;
    const drPosts=a.postings.filter(p=>p.side==="dr").map(post).join("");
    const crPosts=a.postings.filter(p=>p.side==="cr").map(post).join("");

    // Ending balance sits on its normal side (or wherever the excess falls).
    const balSide=a.balance>=0?"dr":"cr";
    const balHtml=`<div class="tacctBal">Bal. ${money(Math.abs(a.balance))}</div>`;

    return `<div class="tacct">
      <div class="tacctTitle">${escapeHtml(a.name)} <small class="muted">${a.id}${a.type?" • "+a.type:""}</small></div>
      <div class="tacctBody">
        <div class="tacctSide dr">
          <div class="tacctSideHead">Debit</div>
          ${drPosts}
        </div>
        <div class="tacctSide cr">
          <div class="tacctSideHead">Credit</div>
          ${crPosts}
        </div>
      </div>
      <div class="tacctTotals">
        <div class="dr">${a.totalDr?money(a.totalDr):""}</div>
        <div class="cr">${a.totalCr?money(a.totalCr):""}</div>
      </div>
      <div class="tacctBalRow">
        <div class="dr">${balSide==="dr"?balHtml:""}</div>
        <div class="cr">${balSide==="cr"?balHtml:""}</div>
      </div>
    </div>`;
  }).join("")||"<p class='muted'>No postings yet. Approved journal entries are sorted here automatically.</p>";
}

function renderEvidence(){
  const el=$("#evidenceList"); if(!el)return;
  const arr=[...(db.transcripts||[])].sort((a,b)=>String(b.dateTime||"").localeCompare(String(a.dateTime||"")));
  el.innerHTML=arr.map(t=>{
    const rs=receiptForTranscript(t.id);
    const js=journalForTranscript(t.id).filter(j=>!j.superseded);
    // Show the important details (the entry summaries), not the raw chat;
    // the exact words remain untouched on the Details page.
    const summary=(t.source!=="manual"&&!t.reconstructed&&js.length)
      ?[...new Set(js.map(j=>j.description).filter(Boolean))].join(" • ")
      :String(t.text||"");
    const src=summary||String(t.text||"");
    const excerpt=src.length>80?src.slice(0,80)+"…":src;
    // Show the CURRENT effective date from the books (edits move it); the
    // transcript's own capture date stays stored untouched.
    const effDate=js[0]?.date||t.date;
    const badges=[
      js.length?`${js.length} journal`:"",
      rs.length?`✍️ ${rs.length} signed`:"needs signature"
    ].filter(Boolean).join(" • ");
    return `<div class="row evidenceRow">
      <div><b>${fmtDate(effDate)}</b> <span>${escapeHtml(excerpt)}</span>
        <small class="muted">${escapeHtml(t.speaker||"")} • ${t.reconstructed?"🧩 reconstructed":t.source==="voice"?"🎤 spoken":t.source==="manual"?"📝 manual form":"⌨️ typed"} • ${badges}</small>
      </div>
      <div class="actions">
        <button data-ev-sign="${t.id}" class="${rs.length?"signedBtn":""}" title="${rs.length?"Signed — click to add another signature":"Add a signature"}">${rs.length?"✓ Signed":"Sign"}</button>
        <button data-ev-detail="${t.id}" class="primary">Details</button>
        ${js.length?"":`<button data-ev-del="${t.id}" class="danger" title="This transcript produced no bookkeeping — safe to remove">🗑️</button>`}
      </div>
    </div>`;
  }).join("")||"<p class='muted'>No transcripts/evidence yet.</p>";
}

// Rebuild evidence from the books (button removed from the UI 2026-08-23 after
// the one-time cleanup was done; the logic stays for a future maintenance menu).
if($("#rebuildEvidence")) $("#rebuildEvidence").onclick=async()=>{
  const orphans=(db.transcripts||[]).filter(t=>!journalForTranscript(t.id).some(j=>!j.superseded));
  if(!confirm(`Rebuild all evidence from the transactions?\n\n• ${orphans.length} transcript(s) with no active bookkeeping will be deleted (their signatures too)\n• Any transaction missing evidence gets a reconstructed transcript\n• The backend evidence store is emptied and refilled with the clean set\n\nThis cannot be undone.`))return;
  const orphanIds=new Set(orphans.map(t=>t.id));
  db.transcripts=(db.transcripts||[]).filter(t=>!orphanIds.has(t.id));
  db.receipts=(db.receipts||[]).filter(r=>!orphanIds.has(r.transcriptId));
  for(const j of db.journalEntries){ if(j.transcriptId&&orphanIds.has(j.transcriptId)) j.transcriptId=null; }
  for(const t of db.transactions){ if(t.evidenceTranscriptId&&orphanIds.has(t.evidenceTranscriptId)) delete t.evidenceTranscriptId; }
  ensureDbShape(); // traces the transactions and reconstructs missing evidence
  save();
  let msg=`Evidence rebuilt: ${orphans.length} junk transcript(s) removed, ${db.transcripts.length} evidence record(s) now cover the books.`;
  try{
    await backendFetch("/api/evidence/wipe",{method:"POST",body:JSON.stringify({})});
    if(db.settings.storageMode==="backend"){
      await syncCurrentUserToBackend();
      msg+=" Backend store emptied and re-uploaded.";
    }else{
      msg+=" Backend store emptied (switch Storage mode to Backend and press Sync to upload the clean set).";
    }
  }catch(err){
    msg+=` Backend not updated (${err.message}).`;
  }
  alert(msg);
};

if($("#evidenceList")) $("#evidenceList").addEventListener("click",e=>{
  const sign=e.target.closest("[data-ev-sign]");
  if(sign){openEvidenceFor(sign.dataset.evSign);return;}
  const det=e.target.closest("[data-ev-detail]");
  if(det){showEvidenceDetails(det.dataset.evDetail);return;}
  const del=e.target.closest("[data-ev-del]");
  if(del){
    const tid=del.dataset.evDel;
    // Only transcripts with NO journal entries can be deleted (checked again
    // here, not just at render time) — bookkeeping evidence is protected.
    if(journalForTranscript(tid).filter(j=>!j.superseded).length){alert("This evidence is linked to journal entries and cannot be deleted.");return;}
    const t=db.transcripts.find(x=>x.id===tid);
    const rs=receiptForTranscript(tid);
    const extra=rs.length?` Its ${rs.length} signature/receipt record(s) will be removed too.`:"";
    const backendNote=db.settings.storageMode==="backend"?" (A copy may remain in the backend's tamper-evident store.)":"";
    if(!confirm(`Delete this evidence transcript?\n\n“${String(t?.text||"").slice(0,120)}”\n\nIt produced no bookkeeping entries.${extra} This cannot be undone.${backendNote}`))return;
    db.transcripts=db.transcripts.filter(x=>x.id!==tid);
    db.receipts=(db.receipts||[]).filter(r=>r.transcriptId!==tid);
    save();
  }
});

window.showEvidenceDetails=function(tid){
  const t=(db.transcripts||[]).find(x=>x.id===tid);
  if(!t) return;

  const rs=receiptForTranscript(tid);
  const js=journalForTranscript(tid).filter(j=>!j.superseded);

  // Switch to the dedicated in-app page.
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  $("#evidenceDetail").classList.add("active");

  const journalHtml=js.length ? js.map(j=>`
    <div class="detailCard">
      <div class="panelhead">
        <b>${fmtDate(j.date)} • ${j.description}</b>
        <span class="${balancedJournal(j)?"balanced":"unbalanced"}">${balancedJournal(j)?"Balanced":"Unbalanced"}</span>
      </div>
      ${j.lines.map(l=>`
        <div class="journalLine">
          <span>${l.account}</span>
          <span>${l.debit?`Dr ${money(l.debit)}`:""}</span>
          <span>${l.credit?`Cr ${money(l.credit)}`:""}</span>
        </div>`).join("")}
      <small class="muted">Journal ID: ${j.id}</small>
    </div>`).join("") : `<p class="muted">No linked journal entries.</p>`;

  const receiptsHtml=rs.length ? rs.map(r=>`
    <div class="detailCard">
      <div class="panelhead">
        <b>Receipt / Evidence ${r.id}</b>
        <small>${r.dateTime ? new Date(r.dateTime).toLocaleString() : ""}</small>
      </div>
      <div class="evidenceMeta">
        <div><small>Signer name</small><b>${r.person||"—"}</b></div>
        <div><small>Transcript ID</small><b>${r.transcriptId}</b></div>
      </div>

      <h4>Signature</h4>
      ${r.signatureData
        ? `<div class="signatureBox"><img src="${r.signatureData}" alt="Stored signature"></div>`
        : `<p class="muted">No signature stored.</p>`}

      <h4>Receipt / Invoice Image</h4>
      ${r.imageData
        ? `<div class="receiptImageBox"><img src="${r.imageData}" alt="Stored receipt or invoice"></div>`
        : `<p class="muted">No receipt or invoice image stored.</p>`}

      <div class="integrityBox">
        <b>Evidence Integrity</b>
        <p class="muted">This record is linked to transcript ${r.transcriptId}. If backend storage is enabled, the backend stores SHA-256 hashes and an audit-chain record for tamper detection.</p>
        <button class="verifyEvidenceBtn" data-receipt-id="${r.id}">Verify Backend Audit Chain</button>
        <div class="verifyResult muted"></div>
      </div>
    </div>`).join("") : `<p class="muted">No signatures or receipt images are linked to this transcript.</p>`;

  $("#evidenceDetailContent").innerHTML=`
    <div class="detailCard transcriptDetail">
      <div class="panelhead">
        <b>Transcript ${t.id}</b>
        <small>${t.dateTime ? new Date(t.dateTime).toLocaleString() : t.date}</small>
      </div>
      <div class="evidenceMeta">
        <div><small>Speaker</small><b>${t.speaker||"—"}</b></div>
        <div><small>Source</small><b>${t.source||"—"}</b></div>
        <div><small>Date</small><b>${(js[0]?.date||t.date)?fmtDate(js[0]?.date||t.date):"—"}</b></div>
      </div>
      <h4>Exact Transcript</h4>
      <div class="exactTranscript">${escapeHtml(t.text||"")}</div>
    </div>

    <h3>Double-Entry Journal Trail</h3>
    ${journalHtml}

    <h3>Signatures & Receipt Evidence</h3>
    ${receiptsHtml}
  `;

  document.querySelectorAll(".verifyEvidenceBtn").forEach(btn=>{
    btn.onclick=async()=>{
      const result=btn.parentElement.querySelector(".verifyResult");
      if(db.settings.storageMode!=="backend"){
        result.textContent="Backend storage is not enabled. Local browser evidence can be displayed, but backend audit-chain verification is unavailable.";
        return;
      }
      try{
        result.textContent="Verifying…";
        const v=await backendFetch("/api/audit/verify");
        if(v.ok){
          result.textContent=`✓ Audit chain verified (${v.events} events) and ${v.records_checked??0} stored records re-hashed successfully. Last chain hash: ${v.last_chain_hash}`;
        }else{
          const issues=[];
          if(v.chain_ok===false) issues.push(`audit chain broken at event ${v.broken_at}`);
          for(const p of v.problems||[]) issues.push(`${p.table} ${p.id}: ${p.problem}`);
          result.textContent=`⚠ Verification failed — ${issues.join("; ")||"unknown problem"}.`;
        }
      }catch(err){
        result.textContent="Verification failed: "+err.message;
      }
    };
  });
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

let pendingEvidenceTranscriptId=null;
window.openEvidenceFor=function(tid){
  pendingEvidenceTranscriptId=tid;
  const t=db.transcripts.find(x=>x.id===tid);
  $("#evidencePerson").value="";
  $("#evidenceImage").value="";
  clearSignatureCanvas();
  $("#evidenceModal").classList.remove("hidden");
}

function clearSignatureCanvas(){
  const canvas=$("#signatureCanvas"); if(!canvas)return;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
}

// When the app is served BY the backend (Flask :5000 or an HTTPS tunnel), the
// API lives at the same address — the stored 127.0.0.1 default would be wrong
// on a phone. Detect that and use the page's own origin.
function backendBase(){
  const configured=(db.settings.backendUrl||"").replace(/\/+$/,"");
  const servedByBackend=location.protocol==="https:"||location.port==="5000";
  if(servedByBackend&&(!configured||configured==="http://127.0.0.1:5000")) return location.origin.replace(/\/+$/,"");
  return configured;
}

async function backendFetch(path,options={}){
  const base=backendBase();
  if(!base) throw new Error("Backend URL is empty.");
  const res=await fetch(base+path,{
    ...options,
    headers:{"Content-Type":"application/json",...(options.headers||{})}
  });
  if(res.status===401&&(location.protocol==="https:"||location.port==="5000")){
    location.href="/login"; // remote session expired — back to the passcode page
    throw new Error("Please log in.");
  }
  if(!res.ok){
    let msg=`Backend error ${res.status}`;
    try{const j=await res.json();if(j.error)msg=j.error;}catch{}
    throw new Error(msg);
  }
  return res.json();
}

// ---- Backend saves: failed saves are queued, retried automatically, and shown in a banner
// (evidence must never be lost silently — the server ignores duplicate ids, so retries are safe).
const PENDING_SAVES_KEY="bookkeep_pending_backend_saves";
const BACKEND_PATHS={transcript:"/api/transcripts",journal:"/api/journal",receipt:"/api/receipts"};
let pendingSaves=(()=>{try{return JSON.parse(localStorage.getItem(PENDING_SAVES_KEY))||[]}catch{return[]}})();

function storePendingSaves(){
  localStorage.setItem(PENDING_SAVES_KEY,JSON.stringify(pendingSaves));
  updateSaveWarning();
}

function updateSaveWarning(){
  let el=document.getElementById("backendSaveWarn");
  if(!pendingSaves.length||db.settings.storageMode!=="backend"){if(el)el.remove();return;}
  if(!el){
    el=document.createElement("div");
    el.id="backendSaveWarn";
    el.title="Click to retry now";
    el.onclick=()=>flushPendingSaves();
    document.body.appendChild(el);
  }
  el.textContent=`⚠ ${pendingSaves.length} record${pendingSaves.length===1?"":"s"} not yet saved to the backend — kept locally, retrying automatically. Click to retry now.`;
}

async function backendPost(kind,payload){
  await backendFetch(BACKEND_PATHS[kind],{method:"POST",body:JSON.stringify(payload)});
}

function queuePendingSave(kind,payload){
  if(!pendingSaves.some(p=>p.kind===kind&&p.payload.id===payload.id)){
    pendingSaves.push({kind,payload,queuedAt:new Date().toISOString()});
    storePendingSaves();
  }
}

let flushingSaves=false;
async function flushPendingSaves(){
  if(flushingSaves||!pendingSaves.length||db.settings.storageMode!=="backend")return;
  flushingSaves=true;
  try{
    const remaining=[];
    for(const item of pendingSaves){
      try{await backendPost(item.kind,item.payload);}
      catch{remaining.push(item);}
    }
    pendingSaves=remaining;
    storePendingSaves();
  }finally{flushingSaves=false;}
}
setInterval(flushPendingSaves,45000);
window.addEventListener("online",flushPendingSaves);

async function backendSaveTranscript(t){
  if(db.settings.storageMode!=="backend") return;
  const payload={...t,userId:activeUserId,userName:users[activeUserId]?.name||"User"};
  try{await backendPost("transcript",payload);}
  catch(err){queuePendingSave("transcript",payload);throw err;}
}

async function backendSaveJournal(j){
  if(db.settings.storageMode!=="backend") return;
  const payload={...j,userId:activeUserId};
  try{await backendPost("journal",payload);}
  catch(err){queuePendingSave("journal",payload);throw err;}
}

async function backendSaveReceipt(r){
  if(db.settings.storageMode!=="backend") return;
  const payload={...r,userId:activeUserId};
  try{await backendPost("receipt",payload);}
  catch(err){queuePendingSave("receipt",payload);throw err;}
}

// ---- Automatic server backups: browser storage is fragile; keep dated JSON
// copies on the backend (runs in ANY storage mode whenever the server is up).
const LAST_BACKUP_KEY="bookkeep_last_backup_ts";
async function backupToServer(){
  const base=backendBase();
  if(!base) throw new Error("Backend URL is empty.");
  let saved=0;
  for(const [uid,u] of Object.entries(users)){
    const res=await fetch(base+"/api/backup",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({profileId:(u.name||"profile").replace(/\s+/g,"_")+"_"+uid.slice(-8),data:u.db})});
    if(!res.ok) throw new Error(`Backup failed (${res.status}).`);
    saved++;
  }
  localStorage.setItem(LAST_BACKUP_KEY,String(Date.now()));
  updateBackupStatus();
  return saved;
}
function updateBackupStatus(){
  const el=$("#backupStatus"); if(!el)return;
  const ts=Number(localStorage.getItem(LAST_BACKUP_KEY)||0);
  el.textContent=ts
    ?`Last server backup: ${new Date(ts).toLocaleString()}. Files live in BookKeep/backups_v13 (newest 14 per profile); restore with Import backup.`
    :"No server backup yet — a daily backup runs automatically whenever the backend is reachable.";
}
async function autoBackupTick(){
  const ts=Number(localStorage.getItem(LAST_BACKUP_KEY)||0);
  if(Date.now()-ts<20*3600*1000) return; // roughly daily
  try{await backupToServer();}catch{/* backend down — tries again next hour */}
}
setTimeout(autoBackupTick,4000);
setInterval(autoBackupTick,3600*1000);

async function syncCurrentUserToBackend(){
  if(db.settings.storageMode!=="backend") throw new Error("Change Storage mode to Backend + browser cache first.");
  $("#backendStatus").textContent="Syncing…";
  await flushPendingSaves();
  for(const t of db.transcripts||[]) await backendSaveTranscript(t);
  for(const j of db.journalEntries||[]) await backendSaveJournal(j);
  for(const r of db.receipts||[]) await backendSaveReceipt(r);
  $("#backendStatus").textContent=`Synced ${db.transcripts.length} transcripts, ${db.journalEntries.length} journal entries, and ${db.receipts.length} evidence records.`;
}
updateSaveWarning();

function renderAll(){renderAccounts();renderDashboard();renderTransactions();renderInvestments();if(typeof renderJournal==="function")renderJournal();if(typeof renderLedger==="function")renderLedger();if(typeof renderEvidence==="function")renderEvidence();if(typeof renderReports==="function")renderReports();if(typeof renderUserSwitcher==="function")renderUserSwitcher()}
renderAll();

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");$("#"+b.dataset.tab).classList.add("active");
});
// Category is a strict dropdown of chart accounts ("no mistake"): revenue
// names for money-in types, expense names for money-out, none for transfers.
const CHART_REVENUE=["Sales Revenue","Service Revenue","Interest Income","Other Income"];
const CHART_EXPENSE=["Supplies Expense","Rent Expense","Utilities Expense","Wages Expense","Other Expense"];
const CHART_BOUGHT_ASSETS=["Equipment","Supplies"]; // lasting things you buy: assets, not expenses
const CHART_MATERIALS_USED=["Cost of Goods Sold","R&D Expense","Supplies Expense"];
function chartCategoryGroupsForType(type){
  // Only entries that CREATE income or an expense need a category. Payments
  // of an earlier invoice/bill just settle A/R / A/P — category is meaningless there.
  if(["income","invoice"].includes(type)) return [["Revenue — money earned",CHART_REVENUE]];
  if(["expense","bill"].includes(type)) return [
    ["Expenses — money spent and used up",CHART_EXPENSE],
    ["Assets bought — things you keep",CHART_BOUGHT_ASSETS]
  ];
  if(type==="use_supplies") return [["Where did the materials go?",CHART_MATERIALS_USED]];
  return [];
}
function updateTxCategoryOptions(){
  const sel=$("#txCategory"); if(!sel) return;
  const type=$("#txType")?.value;
  const groups=chartCategoryGroupsForType(type);
  if(!groups.length){
    const why={transfer:"(not needed for transfers)",
      receive_invoice:"(automatic — pays down Accounts Receivable)",
      pay_bill:"(automatic — pays down Accounts Payable)",
      buy_investment:"(automatic — goes into the Investments asset)",
      sell_investment:"(automatic — computes gain/loss vs what you paid)"};
    sel.innerHTML=`<option value="">${why[type]||"(not needed)"}</option>`;
    sel.disabled=true;return;
  }
  sel.disabled=false;
  let html=groups.map(([label,cats])=>
    `<optgroup label="${label}">`+cats.map(c=>`<option value="${c}">${c}</option>`).join("")+`</optgroup>`).join("");
  // A/R and A/P are never picked by hand — the Type books them automatically.
  if(type==="invoice")
    html+=`<optgroup label="Booked automatically by this type"><option disabled>Accounts Receivable</option></optgroup>`;
  if(type==="bill")
    html+=`<optgroup label="Booked automatically by this type"><option disabled>Accounts Payable</option></optgroup>`;
  sel.innerHTML=html;
}
updateTxCategoryOptions();
updateProLocks();
function updateInvestmentFields(){
  const inv=["buy_investment","sell_investment"].includes($("#txType")?.value);
  if($("#tickerWrap")) $("#tickerWrap").classList.toggle("hidden",!inv);
  if($("#sharesWrap")) $("#sharesWrap").classList.toggle("hidden",!inv);
}
updateInvestmentFields();
if($("#txType")) $("#txType").onchange=()=>{
  $("#toAccountWrap").classList.toggle("hidden",$("#txType").value!=="transfer");
  updateTxCategoryOptions();
  updateInvestmentFields();
};
if($("#txSearch")) $("#txSearch").oninput=renderTransactions;

if($("#txForm")) $("#txForm").onsubmit=e=>{
  e.preventDefault();
  const tx={id:crypto.randomUUID(),date:$("#txDate").value,type:$("#txType").value,account:$("#txAccount").value,toAccount:$("#txType").value==="transfer"?$("#txToAccount").value:null,category:$("#txCategory").value.trim(),amount:Number($("#txAmount").value)||0,note:$("#txNote").value.trim(),dueDate:$("#txDueDate").value,related:$("#txRelated").value.trim()};
  if(tx.type==="buy_investment"||tx.type==="sell_investment"){
    tx.ticker=($("#txTicker")?.value||"").trim().toUpperCase();
    tx.shares=Number($("#txShares")?.value)||0;
    if(!tx.ticker||!(tx.shares>0)){alert("Investments need a stock symbol and a number of shares.");return;}
    if(tx.type==="sell_investment"){
      const held=computeHoldings()[tx.ticker]?.shares||0;
      if(tx.shares>held+1e-9){alert(`You only hold ${held} share(s) of ${tx.ticker} — cannot sell ${tx.shares}.`);return;}
    }
    if(!tx.note) tx.note=`${tx.type==="buy_investment"?"Bought":"Sold"} ${tx.shares} shares of ${tx.ticker}`;
  }
  db.transactions.push(tx);
  // Manual entries get evidence too: a transcript of exactly what the form said,
  // so they appear in the Evidence tab and can be signed like agent entries.
  const nm=id=>db.accounts.find(a=>a.id===id)?.name||"(no account)";
  const typeLabels={income:"Income",expense:"Expense",transfer:"Transfer",invoice:"Customer invoice (A/R)",bill:"Vendor bill (A/P)",receive_invoice:"Invoice payment received",pay_bill:"Vendor bill paid",use_supplies:"Supplies used (adjustment)",buy_investment:"Bought investment",sell_investment:"Sold investment"};
  const evText=tx.type==="use_supplies"
    ?`Manual entry: Used up ${money(tx.amount)} of supplies/materials (Supplies → ${tx.category||"Supplies Expense"})`+(tx.note?`. Note: ${tx.note}`:"")+`. Dated ${fmtDate(tx.date)}.`
    :`Manual entry: ${typeLabels[tx.type]||tx.type} of ${money(tx.amount)} in ${nm(tx.account)}`+
    (tx.type==="transfer"?` to ${nm(tx.toAccount)}`:"")+
    (tx.category?` — ${tx.category}`:"")+
    (tx.note?`. Note: ${tx.note}`:"")+
    `. Dated ${fmtDate(tx.date)}.`;
  const transcript=recordTranscript(evText,"manual",users[activeUserId]?.name||"User",tx.date);
  tx.evidenceTranscriptId=transcript.id;
  // Manual entries hit the journal too, so the ledger and statements stay complete.
  const generated=transformTransactionToJournal(tx,transcript.id);
  db.journalEntries.push(...generated);
  generated.forEach(j=>backendSaveJournal(j).catch(err=>console.warn("Backend journal save failed:",err)));
  $("#txAmount").value="";updateTxCategoryOptions();$("#txNote").value="";$("#txDueDate").value="";$("#txRelated").value="";
  save();
};

function renderLearningStats(){
  $("#learnedRuleCount").textContent=
    Object.keys(db.learning.categoryRules).length+
    Object.keys(db.learning.rl.categoryWeights).length;
  $("#knownTermCount").textContent=
    Object.keys(db.learning.knownCustomers).length+
    Object.keys(db.learning.knownItems).length;
  $("#rlApprovalCount").textContent=db.learning.rl.stats.approvals||0;
  $("#rlEditCount").textContent=db.learning.rl.stats.edits||0;
}
renderLearningStats();

$("#exportLearning").onclick=()=>{
  download("bookkeep-learning.json",JSON.stringify(db.learning,null,2),"application/json");
};
$("#clearLearning").onclick=()=>{
  if(confirm("Clear all category learning and remembered terms?")){
    db.learning={
      categoryRules:{},knownCustomers:{},knownItems:{},
      rl:{categoryWeights:{},accountWeights:{},typeWeights:{},feedbackLog:[],stats:{approvals:0,edits:0,rejections:0}}
    };
    save();renderLearningStats();
    $("#learningDetails").classList.add("hidden");
  }
};

$("#showLearning").onclick=()=>{
  const box=$("#learningDetails");
  if(!box.classList.contains("hidden")){box.classList.add("hidden");return;}
  const top=(obj,limit=15)=>Object.entries(obj)
    .map(([term,vals])=>[term,Object.entries(vals).sort((a,b)=>b[1]-a[1]).slice(0,3)])
    .filter(([,vals])=>vals.length)
    .sort((a,b)=>(b[1][0]?.[1]||0)-(a[1][0]?.[1]||0))
    .slice(0,limit);
  const renderGroup=(title,obj)=>`
    <h3>${title}</h3>
    ${top(obj).length?top(obj).map(([term,vals])=>
      `<div class="learnRow"><b>${escapeHtml(term)}</b><span>${vals.map(([v,w])=>`${escapeHtml(v)}: ${Number(w).toFixed(2)}`).join(" · ")}</span></div>`
    ).join(""):`<p class="muted">Nothing learned yet.</p>`}`;
  box.innerHTML=
    renderGroup("Category preferences",db.learning.rl.categoryWeights)+
    renderGroup("Account preferences",db.learning.rl.accountWeights)+
    renderGroup("Transaction-type preferences",db.learning.rl.typeWeights);
  box.classList.remove("hidden");
};
$("#agentMode").value=db.settings.agentMode;
$("#agentEndpoint").value=db.settings.agentEndpoint;
$("#agentModel").value=db.settings.agentModel;
$("#agentMode").onchange=()=>{
  if($("#agentMode").value==="api"&&!isPro()){
    alert("The AI agent (LLM API) is a Pro feature ($50/month). Upgrade in Settings → Plan.");
    $("#agentMode").value="local";
    return;
  }
  db.settings.agentMode=$("#agentMode").value;save();
};
$("#agentEndpoint").onchange=()=>{db.settings.agentEndpoint=$("#agentEndpoint").value.trim();save();};
$("#agentModel").onchange=()=>{db.settings.agentModel=$("#agentModel").value.trim();save();};
$("#accountingMethod").value=db.settings.accountingMethod;
$("#accountingMethod").onchange=()=>{db.settings.accountingMethod=$("#accountingMethod").value;save();};

// ================= BOOKKEEPING AGENT =================
let pendingAgentPlan = null;
// Evidence only for real transactions (product decision 2026-08-23): chat
// messages are buffered here and written as ONE transcript at approval time.
// Questions, errors, and cancelled proposals never become evidence.
let pendingEvidenceTexts = [];
let pendingEvidenceSource = "typed";

// Rolling chat memory: sent with each LLM call so answers to clarifying
// questions keep their context ("I owe $1,000 for it" → the printer).
let agentChatHistory=[];
function addAgentBubble(text, who="bot"){
  const div=document.createElement("div");
  div.className="bubble "+who;
  div.textContent=text; // textContent, not innerHTML: bubbles echo user/LLM text
  $("#agentChat").appendChild(div);
  $("#agentChat").scrollTop=$("#agentChat").scrollHeight;
  agentChatHistory.push({role:who==="user"?"user":"assistant",content:String(text).slice(0,600)});
  if(agentChatHistory.length>12) agentChatHistory=agentChatHistory.slice(-12);
}

// Single source of truth for amount matching: commas, decimals, and a k suffix.
// Every amount-capturing regex must be built from AMOUNT_SRC so formats can't drift.
const AMOUNT_SRC="(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?[kK]?";
const amountRe=(before,after,flags)=>new RegExp(before+"("+AMOUNT_SRC+")"+after,flags);

function cleanMoney(s){
  let str=String(s).replace(/[$,\s]/g,"");
  let mult=1;
  if(/k$/i.test(str)){mult=1000;str=str.slice(0,-1);}
  return (Number(str)||0)*mult;
}

function extractDateFromText(text){
  const lower=String(text||"").toLowerCase().replace(/\s+/g," ").trim();
  const now=new Date();
  const y=now.getFullYear();

  const iso=localISODate;
  const addDays=(base,delta)=>{
    const d=new Date(base.getFullYear(),base.getMonth(),base.getDate());
    d.setDate(d.getDate()+delta);
    return iso(d);
  };

  // "on the 14th" / "on the 14" — that day of the current month.
  const bareDay=lower.match(/\bon the (\d{1,2})(?:st|nd|rd|th)?\b(?!\s*(?:of\s+[a-z]|dollars?|bucks))/);
  if(bareDay){
    const day=Number(bareDay[1]);
    if(day>=1&&day<=31){
      const d=new Date(y,now.getMonth(),Math.min(day,new Date(y,now.getMonth()+1,0).getDate()));
      return iso(d);
    }
  }

  // --- Relative days ---
  if(/\btoday\b/.test(lower)) return addDays(now,0);
  if(/\byesterday\b/.test(lower)) return addDays(now,-1);
  if(/\bday before yesterday\b/.test(lower)) return addDays(now,-2);
  if(/\btomorrow\b/.test(lower)) return addDays(now,1);
  if(/\bday after tomorrow\b/.test(lower)) return addDays(now,2);

  // "2 days ago", "two days ago", "3 days from now", etc.
  const numWords={
    one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
    eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,
    seventeen:17,eighteen:18,nineteen:19,twenty:20
  };
  const readNum=s=>{
    s=String(s).toLowerCase();
    if(/^\d+$/.test(s)) return Number(s);
    return numWords[s] ?? null;
  };

  let m=lower.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+days?\s+ago\b/);
  if(m){
    const n=readNum(m[1]); if(n!=null) return addDays(now,-n);
  }

  m=lower.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+days?\s+(?:from now|later)\b/);
  if(m){
    const n=readNum(m[1]); if(n!=null) return addDays(now,n);
  }

  // --- Weekday phrases ---
  const weekdays={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};

  m=lower.match(/\blast\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if(m){
    const target=weekdays[m[1]];
    const cur=now.getDay();
    let delta=(cur-target+7)%7;
    if(delta===0) delta=7;
    return addDays(now,-delta);
  }

  m=lower.match(/\bthis\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if(m){
    const target=weekdays[m[1]];
    const cur=now.getDay();
    const delta=target-cur;
    return addDays(now,delta);
  }

  m=lower.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if(m){
    const target=weekdays[m[1]];
    const cur=now.getDay();
    let delta=(target-cur+7)%7;
    if(delta===0) delta=7;
    return addDays(now,delta);
  }

  // --- Numeric dates ---
  m=text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if(m){
    let year=Number(m[3]); if(year<100) year+=2000;
    return `${year}-${String(Number(m[1])).padStart(2,"0")}-${String(Number(m[2])).padStart(2,"0")}`;
  }

  m=text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if(m){
    return `${m[1]}-${String(Number(m[2])).padStart(2,"0")}-${String(Number(m[3])).padStart(2,"0")}`;
  }

  // --- Month names ---
  const months={
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12,
    jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12
  };

  m=lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(20\d{2}))?\b/);
  if(m){
    const mo=months[m[1]], day=Number(m[2]), year=m[3]?Number(m[3]):y;
    return `${year}-${String(mo).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }

  // "August 12th two years ago" style isn't needed yet, but support "August 12 last year".
  m=lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\s+last\s+year\b/);
  if(m){
    return `${y-1}-${String(months[m[1]]).padStart(2,"0")}-${String(Number(m[2])).padStart(2,"0")}`;
  }

  return addDays(now,0);
}

function normalizeAccountName(name){
  return String(name||"").trim().toLowerCase().replace(/\s+/g," ");
}
function accountByName(name){
  const n=normalizeAccountName(name);
  return db.accounts.find(a=>normalizeAccountName(a.name)===n) || null;
}

function findAccountMention(text){
  const lower=text.toLowerCase();
  for(const a of db.accounts){
    if(lower.includes(a.name.toLowerCase())) return a;
  }
  return null;
}

function extractRequestedAccountCreation(text){
  if(!/\b(create|make|add)\b.*\baccount\b/i.test(text) &&
     !/\bnew account\b/i.test(text)) return null;

  let name=null;
  let type=null;

  let m=text.match(/\bname it\s+["']?(.+?)(?=["']?(?:[.,;]|$|\s+with\s+type\b|\s+type\s+is\b|\s+and\s+the\s+type\b))/i);
  if(m) name=m[1].trim();

  if(!name){
    m=text.match(/\b(?:called|named)\s+["']?(.+?)(?=["']?(?:[.,;]|$|\s+with\s+type\b|\s+type\s+is\b|\s+and\s+the\s+type\b))/i);
    if(m) name=m[1].trim();
  }

  if(!name) return null;

  name=name
    .replace(/^["']|["']$/g,"")
    .replace(/\s+/g," ")
    .trim();

  m=text.match(/\b(?:with\s+type|type\s+is|account\s+type\s+is|the\s+type\s+is)\s+["']?([A-Za-z ]{2,30})/i);
  if(m){
    type=m[1]
      .replace(/[.,;].*$/,"")
      .replace(/\s+(?:and|then)\b.*$/i,"")
      .trim();
  }

  const typeMap={
    "cash":"Cash",
    "checking":"Checking",
    "savings":"Savings",
    "income":"Income",
    "revenue":"Income",
    "earnings":"Income",
    "expense":"Expense",
    "brokerage":"Brokerage",
    "credit card":"Credit Card"
  };

  if(type){
    const key=type.toLowerCase();
    type=typeMap[key] || type;
  }else{
    if(/\bearnings?\b|\brevenue\b/i.test(text)) type="Income";
    else type="Other";
  }

  return {name,type};
}

function splitSentences(text){
  return text
    .replace(/\s+/g," ")
    .split(/(?<=[.!?])\s+|;\s+/)
    .map(s=>s.trim())
    .filter(Boolean);
}

function parseSaleSentence(sentence, date, defaultAccountId){
  // Designed for examples such as:
  // "One is for daddy who bought a ruler for 1$"
  // "Then mommy bought a crab gauge for 5$"
  // "Sold computer for $100"
  const lower=sentence.toLowerCase();
  if(!(/\bbought\b|\bsold\b|\bsale\b|\bpurchased\b/.test(lower))) return null;
  // Buyer-vs-seller rule: "I/we bought…" is the user's OWN purchase (an
  // expense), never a sale. The expense path handles it.
  if(/\b(i|we)\s+(?:just\s+)?(?:bought|purchased)\b/.test(lower)) return null;

  const moneyMatch =
    sentence.match(amountRe("(?:for|at)\\s*\\$?\\s*","\\s*\\$?","i")) ||
    sentence.match(amountRe("\\$\\s*","","i"));
  if(!moneyMatch) return null;
  const amount=cleanMoney(moneyMatch[1]);

  let customer="";
  let item="Sale";

  // "mommy bought a crab gauge for 5"
  let m=sentence.match(/(?:^|\bthen\s+|\band\s+)?([A-Za-z][A-Za-z ]{0,30}?)\s+bought\s+(?:a|an|the)?\s*(.+?)\s+for\s*\$?\s*\d/i);
  if(m){
    customer=m[1].trim().replace(/^(one is for|one for)\s+/i,"");
    item=m[2].trim();
  } else {
    // "daddy who bought a ruler for 1"
    m=sentence.match(/(?:for\s+)?([A-Za-z][A-Za-z ]{0,30}?)\s+who\s+bought\s+(?:a|an|the)?\s*(.+?)\s+for\s*\$?\s*\d/i);
    if(m){
      customer=m[1].trim().replace(/^(one is for|one for)\s+/i,"");
      item=m[2].trim();
    } else {
      // "sold computer for 100"
      m=sentence.match(/\bsold\s+(?:a|an|the)?\s*(.+?)\s+for\s*\$?\s*\d/i);
      if(m) item=m[1].trim();
    }
  }

  // "bought a ruler from me" — the item is "ruler"; "from me/us" is the seller.
  item=item.replace(/\s+from\s+(?:me|us)\b.*$/i,"").replace(/[.,;]+$/,"").trim();
  customer=customer.replace(/[.,;]+$/,"").trim();

  return {
    id:crypto.randomUUID(),
    date,
    type:"income",
    account:defaultAccountId,
    toAccount:null,
    category:"Sales Revenue",
    amount,
    note:[item!=="Sale"?item:"",customer?`Customer: ${customer}`:""].filter(Boolean).join(" — "),
    dueDate:"",
    related:"",
    agentMeta:{item,customer}
  };
}

function parseMultipleSales(text, date, accountId){
  const entries=[];
  const sentences=splitSentences(text);

  // First parse sentence-by-sentence.
  for(const sentence of sentences){
    const e=parseSaleSentence(sentence,date,accountId);
    if(e) entries.push(e);
  }

  // Handle a sentence containing multiple clauses, e.g.
  // "Daddy bought a ruler for $1, then Mommy bought a crab gauge for $5."
  if(entries.length<2){
    // Lookahead must allow whitespace after the amount, or "$1,000 cash" backtracks
    // to matching just "1" — the phantom-$1 bug.
    const pattern=amountRe("([A-Za-z][A-Za-z ]{0,25}?)\\s+bought\\s+(?:a|an|the)?\\s*(.+?)\\s+for\\s*\\$?\\s*","\\s*\\$?(?=[\\s.,;]|$)","gi");
    let m;
    while((m=pattern.exec(text))!==null){
      const customer=m[1].trim().replace(/^(on\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+|then\s+|and\s+|one is for\s+)/i,"").trim();
      if(/^(i|we|me|us)$/i.test(customer)) continue; // own purchase, not a sale
      const item=m[2].trim().replace(/\s+from\s+(?:me|us)\b.*$/i,"").replace(/[.,;]+$/,"");
      const amount=cleanMoney(m[3]);
      const duplicate=entries.some(e=>Math.abs(e.amount-amount)<0.0001 && e.agentMeta?.item.toLowerCase()===item.toLowerCase());
      if(!duplicate){
        entries.push({
          id:crypto.randomUUID(),date,type:"income",account:accountId,toAccount:null,
          category:"Sales Revenue",amount,note:`${item}${customer?` — Customer: ${customer}`:""}`,
          dueDate:"",related:"",agentMeta:{item,customer}
        });
      }
    }
  }

  return entries;
}


const NUMBER_WORDS={
  one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
  eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,
  eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90
};

function wordNumberToValue(s){
  const words=s.toLowerCase().replace(/-/g," ").split(/\s+/).filter(Boolean);
  let total=0,current=0,found=false;
  for(const w of words){
    if(NUMBER_WORDS[w]!=null){current+=NUMBER_WORDS[w];found=true;}
    else if(w==="hundred"){current=(current||1)*100;found=true;}
    else if(w==="thousand"){total+=(current||1)*1000;current=0;found=true;}
  }
  return found?total+current:null;
}

const MONEY_WORD="(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)";
function normalizeMoneyWords(text){
  // "five dollars" -> "$5", "one thousand dollars" -> "$1000"
  return text.replace(new RegExp("\\b("+MONEY_WORD+"(?:[- ](?:"+MONEY_WORD+"|and))*)\\s+dollars?\\b","gi"),
    (m,w)=>{const v=wordNumberToValue(w);return v!=null?"$"+v:m;});
}


const RL_STOPWORDS=new Set([
  "the","a","an","for","to","from","and","or","of","in","on","at","i","we","my","our",
  "paid","bought","sold","sale","spent","received","dollars","dollar","customer","item",
  "then","who","is","was","with","account"
]);

function rlTerms(text, item=""){
  const base=(String(item||"")+" "+String(text||"")).toLowerCase()
    .replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
  const words=base.split(" ").filter(w=>w.length>=3 && !RL_STOPWORDS.has(w) && !/^\d+$/.test(w));
  const terms=new Set(words);
  if(item && String(item).trim().length>=3) terms.add(String(item).toLowerCase().trim());
  for(let i=0;i<words.length-1;i++) terms.add(words[i]+" "+words[i+1]);
  return [...terms].slice(0,20);
}

function weightBucket(kind){
  if(kind==="category") return db.learning.rl.categoryWeights;
  if(kind==="account") return db.learning.rl.accountWeights;
  return db.learning.rl.typeWeights;
}

function adjustRL(kind,terms,value,reward){
  if(!value) return;
  const bucket=weightBucket(kind);
  for(const term of terms){
    if(!bucket[term]) bucket[term]={};
    bucket[term][value]=(Number(bucket[term][value])||0)+reward;
    // Prevent runaway weights.
    bucket[term][value]=Math.max(-12,Math.min(20,bucket[term][value]));
  }
}

function bestRL(kind,text,item="",allowedValues=null){
  const terms=rlTerms(text,item);
  const bucket=weightBucket(kind);
  const scores={};
  for(const term of terms){
    for(const [value,w] of Object.entries(bucket[term]||{})){
      if(allowedValues && !allowedValues.includes(value)) continue;
      scores[value]=(scores[value]||0)+Number(w);
    }
  }
  const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  if(!sorted.length || sorted[0][1] < 1.0) return null;
  return {value:sorted[0][0],score:sorted[0][1],terms};
}

function rlFeedback(entry,mode,original=null){
  if(!entry) return;
  const meta=entry.agentMeta||{};
  const terms=rlTerms(`${entry.note||""} ${entry.category||""}`,meta.item||"");
  const currentAccount=entry.plannedAccountName || accountName(entry.account);
  const old=original||meta.originalPrediction||{};

  if(mode==="approve"){
    adjustRL("category",terms,entry.category,0.35);
    adjustRL("account",terms,currentAccount,0.25);
    adjustRL("type",terms,entry.type,0.25);
    db.learning.rl.stats.approvals++;
  }else if(mode==="edit"){
    if(old.category && old.category!==entry.category){
      adjustRL("category",terms,old.category,-1.0);
      adjustRL("category",terms,entry.category,2.0);
    }else adjustRL("category",terms,entry.category,0.4);

    if(old.account && old.account!==currentAccount){
      adjustRL("account",terms,old.account,-0.8);
      adjustRL("account",terms,currentAccount,1.7);
    }

    if(old.type && old.type!==entry.type){
      adjustRL("type",terms,old.type,-0.8);
      adjustRL("type",terms,entry.type,1.7);
    }
    db.learning.rl.stats.edits++;
  }else if(mode==="reject"){
    adjustRL("category",terms,entry.category,-0.6);
    adjustRL("account",terms,currentAccount,-0.4);
    adjustRL("type",terms,entry.type,-0.4);
    db.learning.rl.stats.rejections++;
  }

  db.learning.rl.feedbackLog.push({
    at:new Date().toISOString(),mode,
    terms:terms.slice(0,8),type:entry.type,category:entry.category,account:currentAccount
  });
  if(db.learning.rl.feedbackLog.length>200) db.learning.rl.feedbackLog=db.learning.rl.feedbackLog.slice(-200);
}

function learnedCategoryFor(text,item=""){
  const rl=bestRL("category",text,item);
  if(rl) return rl.value;

  const lower=text.toLowerCase();
  let best=null,bestLen=0;
  for(const [term,cat] of Object.entries(db.learning.categoryRules)){
    if(lower.includes(term) && term.length>bestLen){best=cat;bestLen=term.length;}
  }
  return best;
}

function rememberFromEntry(entry){
  if(!entry || !entry.category) return;
  const note=(entry.note||"").toLowerCase();
  // Learn meaningful item words/phrases, not generic bookkeeping words.
  const item=(entry.agentMeta?.item||"").toLowerCase().trim();
  if(item && item.length>=3) db.learning.categoryRules[item]=entry.category;
  const customer=(entry.agentMeta?.customer||"").trim();
  if(customer) db.learning.knownCustomers[customer.toLowerCase()]=customer;
  if(item) db.learning.knownItems[item]=entry.agentMeta.item;
}

function duplicateCandidates(entry){
  return activeTxs().filter(t=>
    t.date===entry.date &&
    t.type===entry.type &&
    Math.abs(Number(t.amount)-Number(entry.amount))<0.005 &&
    (t.note||"").toLowerCase()===(entry.note||"").toLowerCase()
  );
}

function confidenceForEntry(entry){
  let score=50;
  if(entry.amount>0) score+=15;
  if(entry.date) score+=7;
  if(entry.category && entry.category!=="Uncategorized") score+=7;
  if(entry.agentMeta?.item) score+=6;
  if(entry.agentMeta?.customer) score+=4;
  if(entry.account || entry.plannedAccountName) score+=3;

  const item=entry.agentMeta?.item||"";
  const text=`${entry.note||""} ${entry.category||""}`;
  const cat=bestRL("category",text,item);
  const acct=bestRL("account",text,item);
  const type=bestRL("type",text,item);
  if(cat && cat.value===entry.category) score+=Math.min(5,cat.score);
  const acctName=entry.plannedAccountName||accountName(entry.account);
  if(acct && acct.value===acctName) score+=Math.min(4,acct.score);
  if(type && type.value===entry.type) score+=Math.min(4,type.score);
  return Math.min(99,Math.round(score));
}


function parseExpenseClauses(text,date){
  const entries=[];
  const clauses=splitSentences(text).flatMap(s=>s.split(/\s+(?:and then|then|also)\s+/i));
  for(const clause of clauses){
    const lower=clause.toLowerCase();
    if(!/\b(spent|paid|purchased|bought)\b/.test(lower)) continue;
    // Avoid treating clear customer purchases as our expense.
    if(/\b[A-Za-z]+\s+bought\s+(?:a|an|the)\b/i.test(clause) && !/\bi\s+bought\b|\bwe\s+bought\b/i.test(clause)) continue;

    const mm =
      clause.match(amountRe("\\$\\s*","","i")) ||
      clause.match(amountRe("\\b","\\s*\\$","i")) ||
      clause.match(amountRe("\\b(?:spent|paid|purchased|bought)\\s+\\$?\\s*","","i"));
    if(!mm) continue;
    const amount=cleanMoney(mm[1]);

    let category="General Expense";
    let item="";
    let m=clause.match(/\b(?:on|for)\s+(.+?)(?:\s+from\s+[A-Za-z][A-Za-z0-9 _-]*|[.,]|$)/i);
    if(m) item=m[1].trim();
    else {
      m=clause.match(/\b(?:bought|purchased)\s+(?:a|an|the)?\s*(.+?)\s+(?:for|at)\s*\$?\d/i);
      if(m) item=m[1].trim();
    }
    if(item) category=item;

    const learned=learnedCategoryFor(`${item} ${clause}`,item);
    if(learned) category=learned;

    let account=findAccountMention(clause);
    if(!account){
      const from=clause.match(/\bfrom\s+([A-Za-z][A-Za-z0-9 _-]{1,30})(?:[.,]|$)/i);
      if(from) account=accountByName(from[1].trim());
    }
    let plannedName=null;
    if(!account){
      if(/\bcash\b/i.test(clause)){
        const cashAcct=accountByName("Cash");
        if(cashAcct) account=cashAcct; else plannedName="Cash";
      }else account=db.accounts[0];
    }

    const e={
      id:crypto.randomUUID(),date,type:"expense",account:account?.id||"",
      toAccount:null,category,amount,note:item||clause,dueDate:"",related:"",
      plannedAccountName:plannedName,
      agentMeta:{item:item||category,customer:""}
    };
    e.agentMeta.originalPrediction={category:e.category,account:account?.name||"",type:"expense"};
    e.agentMeta.confidence=confidenceForEntry(e);
    entries.push(e);
  }
  return entries;
}

function resolvePlannedDestination(text,createAccount,sales){
  if(!createAccount || !sales.length) return;
  const lower=text.toLowerCase();
  // "put both sales there", "put the sales there", "put them in Sales"
  const refersThere=/\bput\b.*\b(sales|both|them)\b.*\bthere\b/i.test(text);
  const explicitName=new RegExp("\\bput\\b.*\\b(?:sales|both|them)\\b.*\\b(?:in|into|to)\\s+"+createAccount.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i").test(text);
  if(refersThere || explicitName){
    for(const e of sales){
      e.account="";
      e.plannedAccountName=createAccount.name;
      if(e.agentMeta?.originalPrediction) e.agentMeta.originalPrediction.account=createAccount.name;
    }
  }
}


function parseGeneralIncomeClause(text,date){
  const lower=text.toLowerCase();

  // Handle income-like events beyond sales:
  // "won a bet for $10", "got paid $50", "received $20 gift",
  // "earned $25 tutoring", "made $40 babysitting"
  const incomeVerb=/\b(won|earned|made|received|got paid|was paid|gifted|got|gave me)\b/i;
  if(!incomeVerb.test(text)) return null;

  let amount=null;
  let mm=
    text.match(amountRe("\\$\\s*","","i")) ||
    text.match(amountRe("\\b","\\s*\\$","i")) ||
    text.match(amountRe("\\b(?:for|of)\\s+","\\s*(?:dollars?|usd)?\\b","i"));
  if(mm) amount=cleanMoney(mm[1]);
  if(!amount) return null;

  // Category must be a real chart account (PRD rule — never invented names
  // like "Bet Winnings"); what happened stays in the note.
  let category="Other Income";
  let note=text.trim();

  if(/\binterest\b/.test(lower)) category="Interest Income";
  else if(/\btutor|tutoring\b|\bbabysit|babysitting\b/.test(lower)) category="Service Revenue";
  else if(/\bdividend\b/.test(lower)) category="Investment Income";
  else if(/\bbet\b|\bwager\b|\bgift\b|\brefund\b|\bprize\b|\bwon\b/.test(lower)) category="Other Income";
  else if(/\bearned\b|\bmade\b|\bgot paid\b|\bwas paid\b/.test(lower)) category="Service Revenue";

  // Explicit account after "put it in X", "put into X", "deposit to X"
  let account=findAccountMention(text);
  let accountNamePlanned=null;
  let am=text.match(/\b(?:put|deposit|record)\s+(?:it|this|that)?\s*(?:in|into|to)\s+([A-Za-z][A-Za-z0-9 _-]{1,40})(?:[.,]|$)/i);
  if(am){
    const requested=am[1].trim();
    const existing=accountByName(requested);
    if(existing) account=existing;
    else accountNamePlanned=requested;
  }

  if(!account && !accountNamePlanned && /\bcash\b/i.test(lower)){
    const cashAcct=accountByName("Cash");
    if(cashAcct) account=cashAcct; else accountNamePlanned="Cash";
  }
  if(!account && !accountNamePlanned) account=db.accounts[0]||null;

  const e={
    id:crypto.randomUUID(),
    date,
    type:"income",
    account:account?.id||"",
    toAccount:null,
    category,
    amount,
    note,
    dueDate:"",
    related:"",
    plannedAccountName:accountNamePlanned,
    agentMeta:{item:category,customer:""}
  };
  e.agentMeta.originalPrediction={
    category:e.category,
    account:e.plannedAccountName||accountName(e.account),
    type:"income"
  };
  e.agentMeta.confidence=confidenceForEntry(e);
  return e;
}

function explicitDatePhrasePresent(text){
  const s=String(text||"").toLowerCase();
  return /\b(today|yesterday|tomorrow|day before yesterday|day after tomorrow|days? ago|days? from now|last\s+(sun|mon|tue|wed|thu|fri|sat)|next\s+(sun|mon|tue|wed|thu|fri|sat)|this\s+(sun|mon|tue|wed|thu|fri|sat)|\d{1,2}\/\d{1,2}\/\d{2,4}|20\d{2}-\d{1,2}-\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(s);
}

function validateResolvedDate(original,resolved){
  if(!resolved || !/^\d{4}-\d{2}-\d{2}$/.test(resolved)) return {ok:false,error:"Could not resolve the transaction date."};
  const d=new Date(resolved+"T00:00:00");
  if(Number.isNaN(d.getTime())) return {ok:false,error:"Resolved date is invalid."};

  // Keep relative requests within a sensible bookkeeping range.
  const todayD=new Date();
  const diffDays=Math.round((d - new Date(todayD.getFullYear(),todayD.getMonth(),todayD.getDate()))/86400000);
  if(/\bago\b|\byesterday\b|\bday before yesterday\b/i.test(original) && diffDays>0)
    return {ok:false,error:"A past-date phrase resolved to a future date."};
  if(/\btomorrow\b|\bfrom now\b|\blater\b|\bday after tomorrow\b/i.test(original) && diffDays<0)
    return {ok:false,error:"A future-date phrase resolved to a past date."};

  return {ok:true};
}

function resolveAccountReference(text,createdAccount=null){
  const lower=String(text||"").toLowerCase();
  const explicit=findAccountMention(text);
  if(explicit) return {account:explicit,planned:null};

  if(createdAccount && /\b(there|that account|new account|same account)\b/i.test(text)){
    return {account:null,planned:createdAccount.name};
  }

  const m=text.match(/\b(?:put|record|deposit|save)\s+(?:it|this|that|them|both|the sales|the money)?\s*(?:in|into|to)\s+([A-Za-z][A-Za-z0-9 _-]{1,40})(?:[.,]|$)/i);
  if(m){
    const requested=m[1].trim();
    const existing=accountByName(requested);
    return existing ? {account:existing,planned:null} : {account:null,planned:requested};
  }

  return {account:db.accounts[0]||null,planned:null};
}

function parseAgentCommand(text){
  text=normalizeMoneyWords(text);
  // Strip leading filler ("yes, okay, um…") so notes stay to the point.
  text=text.replace(/^\s*(?:(?:yes|yeah|ok|okay|um|uh|well|so)[,!.\s]+)+/i,"");
  const original=text.trim();
  const lower=original.toLowerCase();
  const date=extractDateFromText(original);
  const dateCheck=validateResolvedDate(original,date);
  if(!dateCheck.ok) return {error:dateCheck.error};

  const createAccount=extractRequestedAccountCreation(original);
  let explicitAccount=findAccountMention(original);
  let accountForEntries=explicitAccount;
  const mentionsCash=/\bcash\b/i.test(original);

  // If user asks to create an account and use it, entries can point to the account name
  // temporarily; actual ID is resolved when Save All is clicked.
  let plannedAccountName=createAccount?.name || null;

  // Investments: "Bought 2 shares of AAPL for $300 cash" / "Sold 1 share of
  // AAPL at $180 each". Gain/loss on sales is computed automatically.
  const invMatch=original.match(/\b(bought|buy|sold|sell)\s+(\d+(?:\.\d+)?)\s+shares?\s+of\s+([A-Za-z.]{1,6})\b/i);
  if(invMatch){
    const action=/^s/i.test(invMatch[1])?"sell_investment":"buy_investment";
    const shares=Number(invMatch[2]);
    const ticker=invMatch[3].toUpperCase();
    let amount=null;
    const each=original.match(amountRe("\\b(?:at|for)\\s+\\$?","\\s*(?:each|a share|per share)","i"));
    if(each) amount=cleanMoney(each[1])*shares;
    else{
      const tot=original.match(amountRe("\\bfor\\s+\\$?","","i"))||original.match(amountRe("\\$\\s*","","i"));
      if(tot) amount=cleanMoney(tot[1]);
    }
    if(amount>0){
      const acct=findAccountMention(original)||db.accounts[0]||null;
      const entry={id:crypto.randomUUID(),date,type:action,account:acct?.id||"",toAccount:null,category:"",amount,ticker,shares,note:original,dueDate:"",related:"",agentMeta:{}};
      return {actions:[{kind:"transaction",entry}],
        summary:`${action==="buy_investment"?"Buy":"Sell"} ${shares} share${shares===1?"":"s"} of ${ticker} for ${money(amount)} dated ${fmtDate(date)}.`,total:0};
    }
    return {error:"Tell me the total or per-share price, like “Bought 2 shares of AAPL for $300 cash.”"};
  }

  // Adjusting entry: materials consumed, no money moves ("we used up $30 of
  // filament this month") — textbook supplies method.
  if(/\b(used up|consumed|went through|wasted)\b/.test(lower) && /\b(supplies|filament|materials?|resin)\b/.test(lower)){
    const m=original.match(amountRe("\\$\\s*","","i"))||original.match(amountRe("\\b","\\s*(?:dollars?|bucks|cents?)\\b","i"));
    let amount=m?cleanMoney(m[1]):null;
    if(m&&/cents?\b/i.test(original.slice(m.index))) amount=amount/100;
    if(amount>0){
      // Standard costing: where did the materials go?
      let cat="Supplies Expense";
      if(/\b(wast\w*|fail\w*|test\w*|experiment\w*|r&d|research)\b/i.test(lower)) cat="R&D Expense";
      else if(/\b(sold|sale|cogs|cost of goods)\b/i.test(lower)) cat="Cost of Goods Sold";
      const entry={id:crypto.randomUUID(),date,type:"use_supplies",account:"",toAccount:null,category:cat,amount,note:original,dueDate:"",related:"",agentMeta:{}};
      return {actions:[{kind:"transaction",entry}],
        summary:`Record ${money(amount)} of materials used (Supplies → ${cat}) dated ${fmtDate(date)}.`,total:0};
    }
    return {error:"How much (in dollars) of supplies were used up? For example: “We used up $30 of filament this month.”"};
  }

  // MULTIPLE SALES FIRST — prevents accidentally adding all numbers in the sentence.
  const saleTargetId=accountForEntries?.id || "";
  const sales=parseMultipleSales(original,date,saleTargetId);
  for(const sale of sales){
    sale.agentMeta=sale.agentMeta||{};
    const learned=learnedCategoryFor(`${sale.agentMeta?.item||""} ${sale.note||""}`,sale.agentMeta?.item||"");
    if(learned) sale.category=learned;

    const rlType=bestRL("type",sale.note||"",sale.agentMeta?.item||"",["income","expense"]);
    if(rlType) sale.type=rlType.value;

    if(!accountForEntries){
      const rlAccount=bestRL("account",sale.note||"",sale.agentMeta?.item||"",db.accounts.map(a=>a.name));
      if(rlAccount){
        const learnedAccount=accountByName(rlAccount.value);
        if(learnedAccount) sale.account=learnedAccount.id;
      }
    }

    // No account picked: "cash" in the sentence targets a Cash account (created
    // if needed); otherwise default to the first real account, never "Unknown".
    if(!sale.account && !sale.plannedAccountName){
      if(mentionsCash){
        const cashAcct=accountByName("Cash");
        if(cashAcct) sale.account=cashAcct.id;
        else sale.plannedAccountName="Cash";
      }else{
        sale.account=db.accounts[0]?.id||"";
      }
    }

    sale.agentMeta.originalPrediction={
      category:sale.category,
      account:sale.plannedAccountName||accountName(sale.account),
      type:sale.type
    };
    sale.agentMeta.confidence=confidenceForEntry(sale);
  }

  const expenses=parseExpenseClauses(original,date);

  const actions=[];
  if(createAccount && !accountByName(createAccount.name)){
    actions.push({kind:"create_account",name:createAccount.name,type:createAccount.type});
  }

  resolvePlannedDestination(original,createAccount,sales);

  if(sales.length || expenses.length){
    // Propose creating any planned account (e.g. Cash) before the entries that use it.
    for(const e of [...sales,...expenses]){
      if(e.plannedAccountName && !accountByName(e.plannedAccountName) &&
         !actions.some(a=>a.kind==="create_account"&&normalizeAccountName(a.name)===normalizeAccountName(e.plannedAccountName))){
        actions.push({kind:"create_account",name:e.plannedAccountName,type:e.plannedAccountName==="Cash"?"Cash":"Other"});
      }
    }
    for(const sale of sales) actions.push({kind:"transaction",entry:sale});
    for(const expense of expenses) actions.push({kind:"transaction",entry:expense});

    const salesTotal=sales.reduce((s,e)=>s+e.amount,0);
    const expenseTotal=expenses.reduce((s,e)=>s+e.amount,0);
    const parts=[];
    if(sales.length) parts.push(`${sales.length} sale${sales.length===1?"":"s"} totaling ${money(salesTotal)}`);
    if(expenses.length) parts.push(`${expenses.length} expense${expenses.length===1?"":"s"} totaling ${money(expenseTotal)}`);
    return {
      actions,
      summary:`I found ${parts.join(" and ")} dated ${fmtDate(date)}.`,
      total:salesTotal,
      expenseTotal
    };
  }

  // Single-amount commands
  const allAmounts=[...original.matchAll(new RegExp("\\$\\s*("+AMOUNT_SRC+")|("+AMOUNT_SRC+")\\s*\\$","gi"))]
    .map(m=>cleanMoney(m[1]||m[2]));
  const amount=allAmounts.length ? allAmounts[0] : null;

  if(/\btransfer(red)?\b|\bmoved?\b/.test(lower)){
    if(!amount) return {error:"I found a transfer, but not the amount."};
    let from=null,to=null;
    for(const a of db.accounts){
      if(lower.includes("from "+a.name.toLowerCase())) from=a;
      if(lower.includes("to "+a.name.toLowerCase())) to=a;
    }
    if(!from||!to) return {error:"For a transfer, tell me both account names, such as “Transferred $500 from Cash to Savings.”"};
    actions.push({kind:"transaction",entry:{id:crypto.randomUUID(),date,type:"transfer",account:from.id,toAccount:to.id,category:"Transfer",amount,note:original,dueDate:"",related:""}});
    return {actions,summary:`Transfer ${money(amount)} from ${from.name} to ${to.name} dated ${fmtDate(date)}.`,total:amount};
  }

  if(/\binvoice\b|\bbilled customer\b|\bsent customer\b/.test(lower)){
    if(!amount) return {error:"I found an invoice, but not the amount."};
    actions.push({kind:"transaction",entry:{id:crypto.randomUUID(),date,type:"invoice",account:explicitAccount?.id||"",toAccount:null,category:"Sales Revenue",amount,note:original,dueDate:"",related:"",plannedAccountName:plannedAccountName}});
    return {actions,summary:`Create a customer invoice for ${money(amount)} dated ${fmtDate(date)}.`,total:amount};
  }

  if(/\bvendor bill\b|\breceived a bill\b|\bbill from\b/.test(lower)){
    if(!amount) return {error:"I found a vendor bill, but not the amount."};
    actions.push({kind:"transaction",entry:{id:crypto.randomUUID(),date,type:"bill",account:explicitAccount?.id||"",toAccount:null,category:"Vendor Bill",amount,note:original,dueDate:"",related:"",plannedAccountName:plannedAccountName}});
    return {actions,summary:`Record a vendor bill for ${money(amount)} dated ${fmtDate(date)}.`,total:amount};
  }

  if(/\bpaid\b|\bspent\b|\bexpense\b/.test(lower)){
    if(!amount) return {error:"I found an expense, but not the amount."};
    let category="General Expense";
    const fm=original.match(/\bfor\s+(.+?)(?:\s+from\b|[.,]|$)/i);
    if(fm) category=fm[1].trim();
    const learned=learnedCategoryFor(`${category} ${original}`,category);
    if(learned) category=learned;
    let chosenAccount=explicitAccount;
    let plannedName=null;
    if(!chosenAccount && mentionsCash){
      const cashAcct=accountByName("Cash");
      if(cashAcct) chosenAccount=cashAcct; else plannedName="Cash";
    }
    if(!chosenAccount && !plannedName){
      const rlAccount=bestRL("account",original,category,db.accounts.map(a=>a.name));
      chosenAccount=(rlAccount&&accountByName(rlAccount.value))||db.accounts[0];
    }
    const expenseEntry={id:crypto.randomUUID(),date,type:"expense",account:chosenAccount?.id||"",toAccount:null,category,amount,note:original,dueDate:"",related:"",plannedAccountName:plannedName,agentMeta:{}};
    expenseEntry.agentMeta.originalPrediction={category,account:plannedName||chosenAccount?.name||"",type:"expense"};
    expenseEntry.agentMeta.confidence=confidenceForEntry(expenseEntry);
    if(plannedName && !accountByName(plannedName)){
      actions.push({kind:"create_account",name:plannedName,type:"Cash"});
    }
    actions.push({kind:"transaction",entry:expenseEntry});
    return {actions,summary:`Record ${money(amount)} as ${category} dated ${fmtDate(date)}.`,total:amount};
  }

  if(actions.length){
    return {actions,summary:`I found ${actions.length} bookkeeping action${actions.length===1?"":"s"}.`,total:0};
  }

  const generalIncome=parseGeneralIncomeClause(original,date);
  if(generalIncome){
    // If user explicitly names a non-existing destination account, propose creating it.
    const newActions=[];
    if(generalIncome.plannedAccountName && !accountByName(generalIncome.plannedAccountName)){
      let inferredType=generalIncome.plannedAccountName==="Cash"?"Cash":
        /earn|income|revenue/i.test(generalIncome.plannedAccountName)?"Income":"Other";
      newActions.push({kind:"create_account",name:generalIncome.plannedAccountName,type:inferredType});
    }
    newActions.push({kind:"transaction",entry:generalIncome});
    return {
      actions:newActions,
      summary:`I found 1 income entry for ${money(generalIncome.amount)} (${generalIncome.category}) dated ${fmtDate(generalIncome.date)}.`,
      total:generalIncome.amount
    };
  }

  return {error:"I could not confidently split that into bookkeeping actions. Try describing the event and amount, for example: “Won a bet for $10. Put it in Earnings.”"};
}

function showAgentPreview(plan){
  pendingAgentPlan=plan;
  const rows=[];
  let saleTotal=0;
  let expenseTotal=0;

  plan.actions.forEach((a,i)=>{
    if(a.kind==="create_account"){
      rows.push(`<div class="agentActionCard"><b>${i+1}. Create account</b><div>${escapeHtml(a.name)}</div><small>Type: ${escapeHtml(a.type)}</small></div>`);
    }else if(a.kind==="transaction"){
      const e=a.entry;
      if(e.type==="income") saleTotal+=e.amount;
      if(e.type==="expense") expenseTotal+=e.amount;
      const acct=e.plannedAccountName || accountName(e.account);
      const details=e.agentMeta
        ? `${e.agentMeta.item}${e.agentMeta.customer?` — ${e.agentMeta.customer}`:""}`
        : e.category;
      rows.push(`<div class="agentActionCard">
        <b>${i+1}. ${e.type==="income"?"Sale":escapeHtml(e.type.replaceAll("_"," "))}</b>
        <div>${escapeHtml(details)}</div>
        <small>${money(e.amount)} • ${escapeHtml(acct||"Account to be selected/created")} • ${fmtDate(e.date)}</small>
        ${e.agentMeta?.confidence?`<small>Confidence: ${e.agentMeta.confidence}%</small>`:""}
        ${duplicateCandidates(e).length?`<small class="dupWarn">⚠ Possible duplicate already exists</small>`:""}
      </div>`);
    }
  });

  $("#agentPreview").innerHTML=`
    <b>Ready to save</b>
    <p>${escapeHtml(plan.summary)}</p>
    <div class="agentActionList">${rows.join("")}</div>
    ${saleTotal>0?`<div class="agentTotal"><span>Total sales</span><strong>${money(saleTotal)}</strong></div>`:""}
    ${expenseTotal>0?`<div class="agentTotal"><span>Total expenses</span><strong>${money(expenseTotal)}</strong></div>`:""}
    <div class="agentActions">
      <button id="agentConfirm" class="primary">Save all</button>
      <button id="agentEdit">Edit entries</button>
      <button id="agentCancel">Cancel</button>
    </div>`;

  $("#agentPreview").classList.remove("hidden");
  $("#agentConfirm").onclick=confirmAgentPlan;
  $("#agentEdit").onclick=editAgentPlan;
  $("#agentCancel").onclick=()=>{
    if(pendingAgentPlan){
      pendingAgentPlan.actions.filter(a=>a.kind==="transaction").forEach(a=>rlFeedback(a.entry,"reject"));
      persist();
      renderLearningStats();
    }
    pendingAgentPlan=null;
    pendingEvidenceTexts=[];
    pendingEvidenceSource="typed";
    $("#agentPreview").classList.add("hidden");
    addAgentBubble("Okay — I did not save anything (and no evidence was recorded). I lowered the score of those guesses so the local agent can improve.");
  };
}


function editAgentPlan(){
  if(!pendingAgentPlan) return;
  const txs=pendingAgentPlan.actions.filter(a=>a.kind==="transaction");
  if(!txs.length){addAgentBubble("There are no transaction entries to edit.");return;}

  const editor=document.createElement("div");
  editor.className="agentEditor";
  editor.innerHTML=`<h3>Edit proposed entries</h3>`+txs.map((a,i)=>{
    const e=a.entry;
    const accountOptions=db.accounts.map(ac=>`<option value="${ac.id}" ${ac.id===e.account?"selected":""}>${escapeHtml(ac.name)}</option>`).join("");
    const typeOptions=txTypeOptionsHtml(e.type);
    return `<div class="editRow" data-edit-index="${i}">
      <label>Description<input class="editNote" value="${escapeHtml(e.note||"")}"></label>
      <label>Category${chartCategorySelectHtml("editCategory",e.category||"")}</label>
      <label>Account<select class="editAccount">${accountOptions}</select></label>
      <label>Type<select class="editType">${typeOptions}</select></label>
      <label>Amount<input class="editAmount" type="number" step="0.01" value="${e.amount}"></label>
    </div>`;
  }).join("")+`<div class="agentActions"><button id="applyEdits" class="primary">Apply edits</button><button id="cancelEdits">Cancel</button></div>`;

  $("#agentPreview").appendChild(editor);

  $("#applyEdits").onclick=()=>{
    editor.querySelectorAll(".editRow").forEach((row,i)=>{
      const e=txs[i].entry;
      const original={
        category:e.category,
        account:e.plannedAccountName||accountName(e.account),
        type:e.type
      };
      e.note=row.querySelector(".editNote").value.trim();
      e.category=row.querySelector(".editCategory").value.trim()||"Uncategorized";
      e.account=row.querySelector(".editAccount").value;
      e.plannedAccountName=null;
      e.type=row.querySelector(".editType").value;
      e.amount=Number(row.querySelector(".editAmount").value)||0;
      e.agentMeta=e.agentMeta||{};
      e.agentMeta.wasEdited=true;
      e.agentMeta.editOriginal=original;
      rememberFromEntry(e);
    });
    pendingAgentPlan.total=txs.filter(a=>a.entry.type==="income").reduce((s,a)=>s+a.entry.amount,0);
    showAgentPreview(pendingAgentPlan);
    addAgentBubble("✏️ Edits applied. I will remember item-to-category corrections after you save.");
  };
  $("#cancelEdits").onclick=()=>editor.remove();
}

function confirmAgentPlan(){
  if(!pendingAgentPlan) return;

  // The transcript is written NOW, at approval — only real transactions leave
  // evidence. Multi-turn conversations are stored as one combined transcript.
  const evText=pendingEvidenceTexts.join("\n");
  if(evText){
    const t=recordTranscript(evText,pendingEvidenceSource,users[activeUserId]?.name||"User");
    window.__currentTranscriptId=t.id;
  }else{
    window.__currentTranscriptId=null;
  }
  pendingEvidenceTexts=[];
  pendingEvidenceSource="typed";

  // 1) Create requested accounts first.
  for(const a of pendingAgentPlan.actions){
    if(a.kind==="create_account" && !accountByName(a.name)){
      db.accounts.push({id:crypto.randomUUID(),name:a.name,type:a.type,opening:0});
    }
  }

  // 2) Save transactions, resolving planned account names after creation.
  for(const a of pendingAgentPlan.actions){
    if(a.kind!=="transaction") continue;
    const e={...a.entry};
    if(e.type==="sell_investment"){
      const held=computeHoldings()[String(e.ticker||"").toUpperCase()]?.shares||0;
      if((Number(e.shares)||0)>held+1e-9){
        addAgentBubble(`⚠️ Skipped selling ${e.shares} ${e.ticker} — you only hold ${held} share(s).`);
        continue;
      }
    }
    if(duplicateCandidates(e).length){
      addAgentBubble(`⚠️ Skipped a possible duplicate: ${money(e.amount)} — ${e.note||e.category}.`);
      continue;
    }
    rememberFromEntry(a.entry);
    if(a.entry.agentMeta?.wasEdited) rlFeedback(a.entry,"edit",a.entry.agentMeta.editOriginal);
    else rlFeedback(a.entry,"approve");
    if(e.plannedAccountName){
      const resolved=accountByName(e.plannedAccountName);
      if(resolved) e.account=resolved.id;
    }
    delete e.plannedAccountName;
    delete e.agentMeta;
    db.transactions.push(e);
    const generated=transformTransactionToJournal(e,window.__currentTranscriptId||null);
    db.journalEntries.push(...generated);
    generated.forEach(j=>backendSaveJournal(j).catch(err=>console.warn("Backend journal save failed:",err)));
  }

  const msg=pendingAgentPlan.summary;
  pendingAgentPlan=null;
  $("#agentPreview").classList.add("hidden");
  save();
  addAgentBubble(`✅ Saved all actions. ${msg}`);
}

const AGENT_ACTION_SCHEMA = {
  allowed:["create_account","transaction"],
  transactionTypes:["income","expense","transfer","invoice","bill","receive_invoice","pay_bill","use_supplies","buy_investment","sell_investment"]
};

function validateAgentPlan(plan){
  if(!plan || !Array.isArray(plan.actions) || plan.actions.length===0)
    return {ok:false,error:"The AI did not return any bookkeeping actions."};

  let calculatedSales=0;
  for(const a of plan.actions){
    if(!AGENT_ACTION_SCHEMA.allowed.includes(a.kind))
      return {ok:false,error:"The AI proposed an unsupported action."};

    if(a.kind==="create_account"){
      if(!a.name || typeof a.name!=="string")
        return {ok:false,error:"An account-creation action is missing a name."};
    }

    if(a.kind==="transaction"){
      const e=a.entry;
      if(!e || !AGENT_ACTION_SCHEMA.transactionTypes.includes(e.type))
        return {ok:false,error:"A transaction has an invalid type."};
      if(!Number.isFinite(Number(e.amount)) || Number(e.amount)<=0)
        return {ok:false,error:"Every transaction must have a positive numeric amount."};
      e.amount=Number(e.amount);
      e.id=e.id||crypto.randomUUID();
      e.date=e.date||today();
      e.category=e.category||"Uncategorized";
      e.note=e.note||"";
      e.dueDate=e.dueDate||"";
      e.related=e.related||"";
      if(e.type==="income") calculatedSales+=e.amount;
    }
  }

  if(plan.total!=null && Number.isFinite(Number(plan.total))){
    const declared=Number(plan.total);
    if(calculatedSales>0 && Math.abs(declared-calculatedSales)>0.005)
      return {ok:false,error:`Math check failed: AI said total ${money(declared)}, but the proposed income entries add to ${money(calculatedSales)}.`};
  }
  plan.total=calculatedSales || Number(plan.total)||0;
  return {ok:true,plan};
}

// Open (unsettled) invoices/bills, so the LLM can tell "paying an existing
// bill" (pay_bill) apart from a brand-new expense — else expenses double-count.
function openAgentItems(type,payType){
  const paid=activeTxs().filter(t=>t.type===payType).map(t=>Number(t.amount));
  const items=[];
  for(const t of activeTxs().filter(t=>t.type===type)){
    const i=paid.indexOf(Number(t.amount));
    if(i>=0){paid.splice(i,1);continue;} // matched by amount → already settled
    items.push({date:t.date,amount:t.amount,category:t.category,note:t.note});
  }
  return items.slice(-10);
}

function bookkeepingContext(){
  return {
    today:today(),
    accountingMethod:db.settings.accountingMethod,
    accounts:db.accounts.map(a=>({name:a.name,type:a.type})),
    openInvoices:openAgentItems("invoice","receive_invoice"),
    openBills:openAgentItems("bill","pay_bill"),
    instructions:[
      "Split one user message into as many distinct bookkeeping actions as necessary.",
      "Never combine separate sales unless the user explicitly asks for one combined entry.",
      "Do arithmetic from the individual entries and return the computed total.",
      "If an account requested by the user does not exist, propose create_account first.",
      "Do not invent an amount, account, customer, item, or date.",
      "If essential information is ambiguous, return needs_clarification and a question instead of guessing.",
      "For sales, use category Sales and preserve item/customer in the note.",
      "Return JSON only."
    ],
    responseShape:{
      needs_clarification:"boolean",
      question:"string or empty",
      summary:"string",
      total:"number",
      actions:[{
        kind:"create_account OR transaction",
        name:"for create_account",
        type:"for create_account",
        entry:{
          date:"YYYY-MM-DD",
          type:"income|expense|transfer|invoice|bill|receive_invoice|pay_bill",
          accountName:"existing or planned account name",
          toAccountName:"for transfers",
          category:"string",
          amount:"number",
          note:"string"
        }
      }]
    }
  };
}

function normalizeApiPlan(raw){
  if(raw.needs_clarification) return raw;
  const actions=(raw.actions||[]).map(a=>{
    if(a.kind==="create_account") return {...a,type:a.type||"Other"};
    const e={...(a.entry||{})};
    if(e.accountName){
      const acct=accountByName(e.accountName);
      e.account=acct?.id||"";
      e.plannedAccountName=acct?null:e.accountName;
    }
    if(e.toAccountName){
      const acct=accountByName(e.toAccountName);
      e.toAccount=acct?.id||"";
    }
    delete e.accountName; delete e.toAccountName;
    return {kind:"transaction",entry:e};
  });
  return {actions,summary:raw.summary||"I prepared the bookkeeping actions.",total:Number(raw.total)||0};
}

async function callBookkeepingAPI(text){
  let endpoint=db.settings.agentEndpoint.trim();
  if(!endpoint){
    // Default to the BookKeep backend's built-in agent endpoint.
    const base=backendBase();
    if(!base) throw new Error("Set the Backend URL (or a custom AI endpoint) in Settings first.");
    endpoint=base+"/api/agent";
  }

  const res=await fetch(endpoint,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:db.settings.agentModel||undefined,
      message:text,
      // Prior turns only — the current message is passed separately above.
      history:agentChatHistory.filter((h,i)=>!(i===agentChatHistory.length-1&&h.role==="user"&&h.content===String(text).slice(0,600))).slice(-8),
      context:bookkeepingContext()
    })
  });
  if(!res.ok){
    let msg=`AI server returned ${res.status}.`;
    try{const j=await res.json();if(j.error)msg=j.error;}catch{}
    throw new Error(msg);
  }
  return normalizeApiPlan(await res.json());
}

async function runAgent(){
  const text=$("#agentInput").value.trim();
  if(!text) return;
  addAgentBubble(text,"user");
  const source=micDictated?"voice":"typed";
  micDictated=false;
  pendingEvidenceTexts.push(text);
  if(source==="voice") pendingEvidenceSource="voice";
  $("#agentInput").value="";
  $("#agentSend").disabled=true;
  $("#agentSend").textContent="Thinking…";

  try{
    if(!hasAgent()){
      addAgentBubble("🔒 The agent is part of the Standard plan ($10/month) — this profile is on Free. Manual entry (Transactions tab) is always free. Upgrade in Settings → Plan.");
      pendingEvidenceTexts.pop();
      return;
    }
    let plan;
    if(db.settings.agentMode==="api"&&!isPro()){
      addAgentBubble("🔒 The AI agent is a Pro feature ($50/month) — this profile is on Standard. Upgrade in Settings → Plan, or I can keep using the free local parser.");
      db.settings.agentMode="local";
      if($("#agentMode"))$("#agentMode").value="local";
      save();
      plan=parseAgentCommand(text);
    }else if(db.settings.agentMode==="api"){
      plan=await callBookkeepingAPI(text);
      if(plan.needs_clarification){
        addAgentBubble(`❓ ${plan.question||"I need more information before I can prepare this entry."}`);
        return;
      }
    }else{
      plan=parseAgentCommand(text);
    }

    if(plan.error){addAgentBubble(plan.error);pendingEvidenceTexts.pop();return;}

    const checked=validateAgentPlan(plan);
    if(!checked.ok){
      addAgentBubble(`⚠️ I did not prepare this entry because validation caught a problem: ${checked.error}`);
      pendingEvidenceTexts.pop();
      return;
    }

    plan=checked.plan;
    addAgentBubble(`${plan.summary} I separated and validated the actions below. Please review them before saving.`);
    showAgentPreview(plan);
  }catch(err){
    addAgentBubble(`⚠️ ${err.message}`);
    pendingEvidenceTexts.pop();
  }finally{
    $("#agentSend").disabled=false;
    $("#agentSend").textContent="Ask Agent";
  }
}


let recognition=null;
let micActive=false;
let micShouldKeepListening=false;
let micRestartTimer=null;
let micDictated=false; // true once dictation contributed to the current input

function countApproxTokens(text){
  const parts=String(text||"").trim().match(/\w+|[^\s\w]/g);
  return parts ? parts.length : 0;
}

function trimToApproxTokens(text,maxTokens=200){
  const parts=String(text||"").trim().match(/\w+|[^\s\w]/g) || [];
  if(parts.length<=maxTokens) return String(text||"").trim();

  const kept=parts.slice(0,maxTokens);
  let out="";
  for(const p of kept){
    if(/^[^\w\s]$/.test(p)) out+=p;
    else out+=(out && !/\s$/.test(out) && !/[("'\/-]$/.test(out) ? " " : "")+p;
  }
  return out.trim();
}

function setupSpeechRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){
    $("#micStatus").textContent="Speech recognition is not supported in this browser. Chrome usually works best.";
    $("#micBtn").disabled=true;
    return;
  }

  recognition=new SR();
  recognition.continuous=true;
  recognition.interimResults=true;
  recognition.lang="en-US";

  recognition.onstart=()=>{
    micActive=true;
    $("#micBtn").textContent="⏹ Stop";
    $("#micStatus").textContent="Listening… pause as long as you need. Press Stop when finished.";
  };

  recognition.onresult=e=>{
    let finalText="", interim="";
    for(let i=e.resultIndex;i<e.results.length;i++){
      const tx=e.results[i][0].transcript;
      if(e.results[i].isFinal) finalText+=tx+" ";
      else interim+=tx;
    }

    if(finalText){
      micDictated=true;
      const combined=($("#agentInput").value+" "+finalText).replace(/\s+/g," ").trim();
      const limited=trimToApproxTokens(combined,200);
      $("#agentInput").value=limited;

      const tokenCount=countApproxTokens(limited);
      if(countApproxTokens(combined)>200){
        $("#micStatus").textContent="Reached the 200-token maximum. Recording stopped.";
        micShouldKeepListening=false;
        try{recognition.stop();}catch{}
        return;
      }
      $("#micStatus").textContent=`Listening… ${tokenCount}/200 tokens.`;
    }else if(interim){
      const current=countApproxTokens($("#agentInput").value);
      $("#micStatus").textContent=`Hearing: ${interim} • ${current}/200 tokens`;
    }
  };

  recognition.onerror=e=>{
    if(e.error==="no-speech" || e.error==="aborted"){
      $("#micStatus").textContent=micShouldKeepListening
        ? "Paused… still listening. Speak when ready."
        : "Microphone stopped.";
      return;
    }
    $("#micStatus").textContent="Microphone error: "+e.error;
  };

  recognition.onend=()=>{
    micActive=false;

    if(micShouldKeepListening && countApproxTokens($("#agentInput").value)<200){
      $("#micStatus").textContent="Paused… still listening. Speak when ready.";
      clearTimeout(micRestartTimer);
      micRestartTimer=setTimeout(()=>{
        if(!micShouldKeepListening) return;
        try{recognition.start();}catch{}
      },250);
      return;
    }

    micShouldKeepListening=false;
    $("#micBtn").textContent="🎤 Speak";
    const n=countApproxTokens($("#agentInput").value);
    $("#micStatus").textContent=$("#agentInput").value.trim()
      ? `Voice transcribed (${n}/200 tokens). Review it, then press Ask Agent.`
      : "Microphone idle.";
  };
}

$("#micBtn").onclick=()=>{
  if(!recognition) setupSpeechRecognition();
  if(!recognition)return;

  if(micShouldKeepListening){
    micShouldKeepListening=false;
    clearTimeout(micRestartTimer);
    $("#micBtn").textContent="🎤 Speak";
    $("#micStatus").textContent="Stopping microphone…";
    try{recognition.stop();}catch{}
    return;
  }

  if(countApproxTokens($("#agentInput").value)>=200){
    $("#micStatus").textContent="The message is already at the 200-token maximum.";
    return;
  }

  micShouldKeepListening=true;
  $("#micBtn").textContent="⏹ Stop";
  try{recognition.start();}catch{}
};

setupSpeechRecognition();

$("#agentInput").addEventListener("input",()=>{
  const original=$("#agentInput").value;
  if(!original.trim()) micDictated=false;
  const limited=trimToApproxTokens(original,200);

  if(countApproxTokens(original)>200){
    $("#agentInput").value=limited;
    $("#micStatus").textContent="Message limited to 200 tokens.";
  }else if(!micShouldKeepListening){
    $("#micStatus").textContent=`${countApproxTokens(limited)}/200 tokens`;
  }
});

$("#agentSend").onclick=runAgent;
$("#agentInput").addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey)&&e.key==="Enter") runAgent();
});
$("#clearAgent").onclick=()=>{
  agentChatHistory=[];
  pendingEvidenceTexts=[];
  pendingEvidenceSource="typed";
  $("#agentChat").innerHTML='<div class="bubble bot">Chat cleared. Tell me what happened and I will separate it into bookkeeping actions.</div>';
  $("#agentPreview").classList.add("hidden");
  pendingAgentPlan=null;
};
document.querySelectorAll("[data-prompt]").forEach(b=>b.onclick=()=>{
  $("#agentInput").value=b.dataset.prompt;
  $("#agentInput").focus();
});


$("#userSwitcher").onchange=e=>switchUser(e.target.value);
$("#addUserBtn").onclick=()=>{
  const name=prompt("Name for the new user:");
  if(!name || !name.trim()) return;
  const id="user_"+crypto.randomUUID();
  users[id]={name:name.trim(),db:newUserDb()};
  localStorage.setItem(USERS_KEY,JSON.stringify(users));
  switchUser(id);
};
$("#reportDate").value=today();
$("#refreshReports").onclick=renderReports;

const sigCanvas=$("#signatureCanvas");
if(sigCanvas){
  const ctx=sigCanvas.getContext("2d");
  clearSignatureCanvas();
  ctx.strokeStyle="#111";ctx.lineWidth=2;ctx.lineCap="round";
  let drawing=false;
  const pos=e=>{
    const r=sigCanvas.getBoundingClientRect();
    const p=e.touches?e.touches[0]:e;
    return {x:(p.clientX-r.left)*(sigCanvas.width/r.width),y:(p.clientY-r.top)*(sigCanvas.height/r.height)};
  };
  const start=e=>{drawing=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault();};
  const move=e=>{if(!drawing)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();e.preventDefault();};
  const end=e=>{drawing=false;e.preventDefault();};
  sigCanvas.addEventListener("mousedown",start);sigCanvas.addEventListener("mousemove",move);
  window.addEventListener("mouseup",end);
  sigCanvas.addEventListener("touchstart",start,{passive:false});sigCanvas.addEventListener("touchmove",move,{passive:false});
  sigCanvas.addEventListener("touchend",end,{passive:false});
}
$("#clearSignature").onclick=clearSignatureCanvas;
$("#closeEvidenceModal").onclick=()=>$("#evidenceModal").classList.add("hidden");
$("#saveEvidence").onclick=async()=>{
  try{
  if(!pendingEvidenceTranscriptId){alert("Something went wrong opening this evidence — please close the window and press Sign again.");return;}

  const signerName=$("#evidencePerson").value.trim();
  if(!signerName){
    alert("Please type the name of the person who signed.");
    $("#evidencePerson").focus();
    return;
  }

  let imageData="";
  const file=$("#evidenceImage").files[0];
  if(file){
    imageData=await new Promise((resolve,reject)=>{
      const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(file);
    });
    imageData=await shrinkImageDataUrl(imageData); // phone photos: ~20× smaller
  }
  const receipt={
    id:makeId("R"),
    transcriptId:pendingEvidenceTranscriptId,
    person:signerName,
    dateTime:new Date().toISOString(),
    signatureData:$("#signatureCanvas").toDataURL("image/png"),
    imageData
  };
  db.receipts.push(receipt);
  backendSaveReceipt(receipt).catch(err=>console.warn("Backend evidence save failed:",err));
  save();
  $("#evidenceModal").classList.add("hidden");
  addAgentBubble(`🧾 Evidence saved as ${receipt.id} for transcript ${receipt.transcriptId}.`);
  }catch(err){
    alert("Could not save the signature: "+(err?.message||err));
  }
};

$("#backendUrl").value=db.settings.backendUrl;
$("#storageMode").value=db.settings.storageMode;
$("#backendUrl").onchange=()=>{
  db.settings.backendUrl=$("#backendUrl").value.trim();
  save();
};
$("#storageMode").onchange=()=>{
  db.settings.storageMode=$("#storageMode").value;
  save();
  updateSaveWarning();
  flushPendingSaves();
  $("#backendStatus").textContent=db.settings.storageMode==="backend"?
    "Backend storage enabled. New evidence will also be sent to the backend.":
    "Browser-only storage is active.";
};
$("#testBackend").onclick=async()=>{
  try{
    const h=await backendFetch("/api/health");
    $("#backendStatus").textContent=`Backend connected: ${h.status}. Database: ${h.database}`;
  }catch(err){
    $("#backendStatus").textContent="Backend connection failed: "+err.message;
  }
};
$("#syncBackend").onclick=async()=>{
  try{await syncCurrentUserToBackend();}
  catch(err){$("#backendStatus").textContent="Sync failed: "+err.message;}
};
if($("#backupNow")) $("#backupNow").onclick=async()=>{
  $("#backupStatus").textContent="Backing up…";
  try{const n=await backupToServer();$("#backupStatus").textContent=`✓ Backed up ${n} profile(s) just now. Files live in BookKeep/backups_v13; restore with Import backup.`;}
  catch(err){$("#backupStatus").textContent="Backup failed: "+err.message+" (Is the backend running?)";}
};
updateBackupStatus();

$("#deleteUserBtn").onclick=()=>{
  const ids=Object.keys(users);
  const name=users[activeUserId]?.name||"this user";

  if(ids.length<=1){
    alert("You must keep at least one user profile. Use Delete Current User Data in Settings to clear this user's books.");
    return;
  }

  if(!confirm(`Delete the user profile "${name}" and all of its local data?`)) return;
  if(!confirm(`Really delete "${name}"? This cannot be undone unless you exported a backup.`)) return;

  delete users[activeUserId];
  activeUserId=Object.keys(users)[0];
  db=users[activeUserId].db;
  ensureDbShape();

  localStorage.setItem(USERS_KEY,JSON.stringify(users));
  localStorage.setItem(ACTIVE_USER_KEY,activeUserId);

  renderAll();
  renderLearningStats();
  renderReports();
  renderUserSwitcher();

  if($("#accountingMethod")) $("#accountingMethod").value=db.settings.accountingMethod;
  if($("#agentMode")) $("#agentMode").value=db.settings.agentMode;
  if($("#agentEndpoint")) $("#agentEndpoint").value=db.settings.agentEndpoint;
  if($("#agentModel")) $("#agentModel").value=db.settings.agentModel;
  if($("#backendUrl")) $("#backendUrl").value=db.settings.backendUrl;
  if($("#storageMode")) $("#storageMode").value=db.settings.storageMode;
  if($("#userName")) $("#userName").value=users[activeUserId]?.name||"";
};

$("#backToEvidence").onclick=()=>{
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  $("#evidence").classList.add("active");
  const tab=document.querySelector('.tab[data-tab="evidence"]');
  if(tab) tab.classList.add("active");
};

// Profile: rename the current user (shown as speaker on transcripts/evidence).
if($("#userName")) $("#userName").value=users[activeUserId]?.name||"";
if($("#saveUserName")) $("#saveUserName").onclick=()=>{
  const name=$("#userName").value.trim();
  if(!name){alert("Please type your name or business name.");return;}
  users[activeUserId].name=name;
  persist();
  renderUserSwitcher();
  $("#saveUserName").textContent="Saved ✓";
  setTimeout(()=>{ if($("#saveUserName")) $("#saveUserName").textContent="Save name"; },1500);
};

$("#themeBtn").onclick=()=>document.body.classList.toggle("dark");
$("#exportJson").onclick=()=>download("bookkeep-backup.json",JSON.stringify(db,null,2),"application/json");
$("#exportCsv").onclick=()=>{
  // Full audit trail: superseded (edited-away) records are included and flagged.
  const rows=[["date","type","account","to_account","category","amount","due_date","related","note","status","revision_of"],...db.transactions.map(t=>[t.date,t.type,accountName(t.account),accountName(t.toAccount),t.category,t.amount,t.dueDate||"",t.related||"",t.note,t.superseded?"superseded":"active",t.revisionOf||""])];
  download("transactions.csv",rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n"),"text/csv");
};
$("#importJson").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const x=JSON.parse(await f.text());if(x.accounts&&x.transactions&&x.investments){db=x;ensureDbShape();save()}else alert("Invalid backup file")}catch{alert("Could not read backup file")}};

function download(name,text,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

// Remote login (name only, by owner's choice — no passwords): the name typed on
// /login opens or creates that person's profile on this device automatically.
(async()=>{
  if(!(location.protocol==="https:"||location.port==="5000")) return;
  try{
    const w=await backendFetch("/api/whoami");
    window.__bkId=w; // {name, owner, discount} — drives the creator panel + discounted prices
    const name=(w?.name||"").trim();
    if(name){
      const match=Object.entries(users).find(([,u])=>String(u.name||"").trim().toLowerCase()===name.toLowerCase());
      if(match){
        if(match[0]!==activeUserId) switchUser(match[0]);
      }else{
        const id="user_"+crypto.randomUUID();
        users[id]={name,db:newUserDb()};
        localStorage.setItem(USERS_KEY,JSON.stringify(users));
        switchUser(id);
      }
      // Books follow the login: if this device has empty books for this name
      // but the server holds a backup, offer to load it (URL changes and new
      // devices no longer mean starting over).
      if(!(db.transactions||[]).length&&!(db.transcripts||[]).length){
        try{
          const slug=name.replace(/\s+/g,"_").replace(/[^A-Za-z0-9_-]/g,"");
          const b=await backendFetch("/api/backup/latest?profile="+encodeURIComponent(slug));
          if(b?.found&&b.data&&((b.data.transactions||[]).length||(b.data.transcripts||[]).length)){
            if(confirm(`Found a saved copy of "${name}"'s books on the server (from ${b.name.slice(-15,-5)}). Load it onto this device?`)){
              db=b.data;
              ensureDbShape();
              users[activeUserId].db=db;
              save();
            }
          }
        }catch{/* no backup or unreachable — start fresh */}
      }
    }
    updateProLocks(); // owner status may unlock Pro features (creator = free)
    renderMembersPanel();
    renderOrdersPanel();
    renderLoginStatus();
  }catch{/* not logged in remotely or backend unreachable — keep current profile */}
})();

