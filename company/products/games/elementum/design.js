// Elementum — real problems, the workbench, the Schola and the Bibliotheca (Barbara, 2026-11-21/22).
// Every problem belongs to someone in town (scenarios.js). Walk up and ask about it (Notebook) — the answers are kept; say what the
// problem really is (The problem); then build it yourself and test it (Build & test). Nobody coaches you: the test report only says
// what happened. You learn at the Schola (listen to lessons; get paid for reading a book and summarising it) and in the Bibliotheca
// (books by subject, or the computer finds one). Point at any word in a book, lesson or notebook and its meaning appears.
// Workshops: eng_struct (pieces + glue, physics), eng_garden, eng_water, eng_heat. Saved on this device (localStorage).
window.DESIGN=(function(){
const $=s=>document.querySelector(s);const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const SC=window.SCENARIOS,ENG=window.ENG;
const SAVE_KEY="elementum.problems";let ST;try{ST=JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");}catch(e){ST={};}
ST.sc=ST.sc||{};ST.prof=ST.prof||{};ST.heard=ST.heard||[];ST.read=ST.read||[];
const save=()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(ST));}catch(e){}};
const S=id=>ST.sc[id]||(ST.sc[id]={facts:[]});const lvOf=id=>Math.min(2,S(id).level||0),Lv=id=>SC.byId[id].levels[lvOf(id)];
let hooks={},openFlag=false,cur=null,tab="ask",W=null,ui={},sim=null,result=null,report="",raf=0,lastT=0,mode="";
function show(){openFlag=true;$("#design").classList.remove("hidden");}
function close(){try{readTick();}catch(e){}if(cur&&S(cur).next!==undefined){S(cur).level=S(cur).next;delete S(cur).next;}if(cur&&W)saveWork();save();openFlag=false;sim=null;cancelAnimationFrame(raf);try{speechSynthesis.cancel();}catch(e){}$("#design").classList.add("hidden");hideTip();if(hooks.onClose)hooks.onClose();}
function head(title,extra){return `<div class="dhead"><b>${esc(title)}</b>${extra||""}<button id="dClose">✕ Close</button></div>`;}
function wireClose(){$("#dClose").onclick=close;}
// ---------------- a problem: notebook (ask), the problem (frame), build & test ----------------
function openProblem(id,o){hooks=o||{};cur=id;mode="problem";const s=S(id);if(s.next!==undefined){s.level=s.next;delete s.next;save();}
  tab=s.facts.length<3?"ask":!s.framed?"frame":hooks.at==="owner"?"ask":"build";W=null;sim=null;result=null;report="";ui={};show();render();}
function unlocked(t){const s=S(cur);return t==="ask"||(t==="frame"&&s.facts.length>=3)||(t==="build"&&s.framed);}
function render(){const sc=SC.byId[cur],s=S(cur),L=Lv(cur);const tabs=[["ask","Notebook"],["frame","The problem"],["build","Build & test"]];
  let h=head(sc.title,`<span class="lv">${esc(sc.owner)} · level ${lvOf(cur)+1}${s.solved?" · solved":""}</span>`)+`<div class="dsteps">${tabs.map(([k,t])=>`<button data-tab="${k}" class="${k===tab?"on":""}" ${unlocked(k)?"":"disabled"}>${t}</button>`).join("")}</div><div class="dbody">`;
  if(tab==="ask"){const F=sc.facts(L),here=hooks.at==="owner";h+=`<p class="tip">${here?`${esc(sc.owner)}: “${esc(sc.says)}”`:`Only ${esc(sc.owner)} can answer these — find them in town to ask.`}</p><div class="qs">`;
    F.forEach(([q,a],i)=>{const got=s.facts.includes(i);h+=`<button data-ask="${i}" class="${got?"got":""}" ${here||got?"":"disabled"}>${esc(q)}</button>${got?`<p class="ans dict">“${esc(a)}”</p>`:""}`;});
    h+=`</div>${s.facts.length>=3?"":`<p class="tip">${s.facts.length}/3 questions asked.</p>`}`;}
  else if(tab==="frame"){const fr=frameQs(sc,L),ans=s.frameAns||{};h+=`<p class="tip">Before building, say what the problem really is.</p>`;
    for(const k of ["who","need","hard","test"]){const f=fr[k];h+=`<div class="fq"><b>${esc(f.q)}</b>${f.o.map((t,i)=>`<label><input type="${f.multi?"checkbox":"radio"}" name="f_${k}" value="${i}" ${(ans[k]||[]).includes(i)?"checked":""}> ${esc(t)}</label>`).join("")}<p class="fwhy" id="why_${k}"></p></div>`;}
    h+=`<button class="go" id="frameCheck">Check</button>${s.framed?`<p class="ok">Done — on to building.</p>`:""}`;}
  else if(hooks.at!=="bench"){h+=`<p class="tip">Building and testing happen at the <b>workbench in the Bibliotheca</b> (the library). Go there, open the workbench, and pick this project.</p>`;}
  else{h+=buildHTML(sc,L);}
  h+=`</div>`;$("#designBody").innerHTML=h;wireClose();
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{if(!unlocked(b.dataset.tab))return;tab=b.dataset.tab;sim=null;result=null;report="";render();});
  document.querySelectorAll("[data-ask]").forEach(b=>b.onclick=()=>{const i=+b.dataset.ask;if(!s.facts.includes(i)){s.facts.push(i);save();if(hooks.onAsk)hooks.onAsk(sc,i);}render();});
  if($("#frameCheck"))$("#frameCheck").onclick=()=>checkFrame(sc,L);
  if(tab==="build"&&hooks.at==="bench")wireBuild(sc,L);dictify($("#designBody"));}
// the frame: four questions; the right answers come from the problem itself, the wrong ones are plausible but off
function frameQs(sc,L){const R=SC.WRONG,pick=(arr,n,seed)=>arr.slice(seed%arr.length).concat(arr).slice(0,n);const h=sc.id.length;
  const mix=(right,wrong)=>{const o=[...right,...wrong];const ord=o.map((t,i)=>[((i+1)*(h+7))%11+i/100,t]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);return {o:ord,a:right.map(r=>ord.indexOf(r))};};
  const who=mix([`${sc.owner}, who has this problem`],pick(R.who,2,h)),need=mix([sc.need],pick(R.need,2,h+1)),test=mix([sc.test],pick(R.test,2,h+2)),hard=mix(sc.cons(L),pick(R.hard,2,h+3));
  return {who:{q:"Who has the problem?",...who},need:{q:"What do they need?",...need},hard:{q:"What makes it hard? (pick every one that's true)",multi:true,...hard},test:{q:"How will we know it works?",...test}};}
function checkFrame(sc,L){const fr=frameQs(sc,L),s=S(cur);let all=true;s.frameAns={};
  for(const k in fr){const picked=[...document.querySelectorAll(`[name=f_${k}]:checked`)].map(i=>+i.value);s.frameAns[k]=picked;const ok=picked.length===fr[k].a.length&&picked.every(i=>fr[k].a.includes(i));
    const w=$("#why_"+k);w.className="fwhy "+(ok?"good":"bad");w.textContent=ok?"✓":"Not quite.";if(!ok)all=false;}
  if(all){s.framed=true;save();tab="build";render();}else{ST.prof.frame=(ST.prof.frame||0)+1;save();}}
// ---------------- the workbench ----------------
function eng(){return ENG[SC.byId[cur].eng];}
function loadWork(L){const s=S(cur),E=eng();W=s.work&&s.work.lv===lvOf(cur)?E.de(L,s.work.data):E.init(L);const T=E.tools(L);if(!ui.tool)ui={tool:T.defTool,joint:T.defJoint,len:null};}
function saveWork(){const s=S(cur);if(!W)return;s.work={lv:lvOf(cur),data:eng().ser(W)};save();}
function buildHTML(sc,L){const E=eng();if(!W)loadWork(L);const T=E.tools(L);let h=`<p class="tip dict">${esc(E.info(L))}</p><div class="tools">`;
  T.main.forEach(t=>{h+=`<button data-tool="${t.id}" class="${ui.tool===t.id?"on":""}" title="${esc(t.what||"")}"><i style="background:${t.color}"></i>${esc(t.name)}${t.price?`<small>${esc(t.price)}</small>`:""}</button>`;});h+=`</div>`;
  if(T.lengthInput)h+=`<div class="tools len"><label>Length of the next piece: <input id="dLen" type="number" min="0.5" max="8" step="0.5" value="${ui.len||""}" placeholder="longest"> m</label></div>`;
  if(T.joint)h+=`<div class="tools glues ${ui.tool==="glue"?"":"dim"}">${esc(T.jointLabel)} ${T.joint.map(g=>`<button data-joint="${g.id}" class="${ui.joint===g.id?"on":""}" title="${esc(g.what)}"><i style="background:${g.color}"></i>${esc(g.name)}<small>${esc(g.price)}</small></button>`).join("")}</div>`;
  if(T.opts)h+=`<div class="tools opts">${T.opts.map(o=>`<label>${esc(o.name)} <select data-opt="${o.id}">${o.vals.map((v,i)=>`<option value="${v}" ${String(W.o[o.id])===String(v)?"selected":""}>${v}${o.cost[i]?` (${o.cost[i]})`:""}</option>`).join("")}</select></label>`).join("")}</div>`;
  if(T.needPart)h+=`<p class="tip" id="dPart">${ui.part?"Adding layers to: "+ui.part:"Click a wall, the roof or the floor, then a material."}</p>`;
  h+=`<div class="cv"><canvas id="dCanvas"></canvas></div><div class="brow"><span id="dCost"></span><button id="dTest" class="go">▶ Test</button><button id="dStop">↺ Back to building</button><button id="dClear">Start over</button></div>
    <p class="teach" id="dReport">${report}</p>`;return h;}
function wireBuild(sc,L){const E=eng(),T=E.tools(L);
  document.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>{const id=b.dataset.tool;
    if(E.useTool){if(!sim){const r=E.useTool(W,L,ui,id);if(r.msg)say(r.msg);if(r.changed){saveWork();draw();}}return;}
    ui.tool=id;document.querySelectorAll("[data-tool]").forEach(x=>x.classList.toggle("on",x===b));const gl=document.querySelector(".glues");if(gl)gl.classList.toggle("dim",id!=="glue");});
  document.querySelectorAll("[data-joint]").forEach(b=>b.onclick=()=>{ui.joint=b.dataset.joint;ui.tool="glue";document.querySelectorAll("[data-joint]").forEach(x=>x.classList.toggle("on",x===b));document.querySelectorAll("[data-tool]").forEach(x=>x.classList.toggle("on",x.dataset.tool==="glue"));const gl=document.querySelector(".glues");if(gl)gl.classList.remove("dim");});
  document.querySelectorAll("[data-opt]").forEach(sel=>sel.onchange=()=>{const r=E.setOpt(W,L,sel.dataset.opt,sel.value);if(r.changed){saveWork();draw();}});
  if($("#dLen"))$("#dLen").onchange=()=>{const v=parseFloat($("#dLen").value);if(!(v>0))return;const r=E.setLen?E.setLen(W,L,ui,v):{};ui.len=v;if(r.msg)say(r.msg);if(r.changed){saveWork();draw();}};
  $("#dTest").onclick=()=>{if(sim&&!result)return;const c=E.cost(W,L);if(c>L.budget){say(`That costs ${c} — the budget is ${L.budget}.`);return;}saveWork();sim=E.start(W,L);result=null;say("");lastT=0;loop();};
  $("#dStop").onclick=()=>{sim=null;result=null;draw();};$("#dClear").onclick=()=>{if(sim)return;W=E.init(L);ui.sel=null;saveWork();draw();};
  const cv=$("#dCanvas");const P=e=>E.pt(cv,e,L);
  cv.onpointerdown=e=>{if(sim)return;try{cv.setPointerCapture(e.pointerId);}catch(_){}ui.painting=true;const r=E.down(W,L,P(e),ui);if(r.msg)say(r.msg);if(r.changed)saveWork();if(T.needPart&&$("#dPart"))$("#dPart").textContent=ui.part?"Adding layers to: "+ui.part+" — click a material, or Take off a layer":"Click a wall, the roof or the floor, then a material.";draw();};
  cv.onpointermove=e=>{if(sim)return;const r=E.move(W,L,P(e),ui);if(r.changed)saveWork();draw();};
  cv.onpointerup=e=>{ui.painting=false;if(sim)return;const r=E.up(W,L,P(e),ui);if(r.msg)say(r.msg);if(r.changed)saveWork();draw();};
  cv.onpointerleave=()=>{ui.hover=null;ui.painting=false;draw();};draw();}
function say(t){report=t||"";const el=$("#dReport");if(el){el.innerHTML=report;delete el.dataset.dict;dictify(el.parentElement);}}
function draw(){const cv=$("#dCanvas");if(!cv)return;const L=Lv(cur),E=eng();const w=Math.min(cv.parentElement.clientWidth||760,880);const hgt=Math.round(w*(E.canvasRatio||.5));if(cv.width!==w||cv.height!==hgt){cv.width=w;cv.height=hgt;}
  E.draw(cv,W,L,sim,null,ui);if(result){const x=cv.getContext("2d");x.fillStyle=result.ok?"rgba(40,140,70,.9)":"rgba(170,40,30,.9)";x.fillRect(0,cv.height-30,cv.width,30);x.fillStyle="#fff";x.font="700 16px system-ui";x.fillText(result.ok?"It works!":"It didn't work.",12,cv.height-10);}
  const el=$("#dCost");if(el){const c=E.cost(W,L);el.innerHTML=`Cost: <b class="${c>L.budget?"over":""}">${c}</b> / ${L.budget}`;}}
function finish(r){result=r;const id=cur,s=S(id),E=eng();
  if(r.ok){const lv=lvOf(id),first=!s.solved;s.solved=true;s.next=Math.min(2,lv+1);s.best={lv,eng:SC.byId[id].eng,data:E.ser(W)};save();say(`<b>It works!</b>${r.note?" "+r.note:""}${E.why?`<br><b>Magistra Cornelia:</b> ${E.why(sim)}`:""}`);if(hooks.onSolved)hooks.onSolved(SC.byId[id],lv,first,s.best);}
  else{const ex=E.explain(sim);ST.prof[ex.tag]=(ST.prof[ex.tag]||0)+1;save();const wf=E.whyFail?E.whyFail(sim):"";say(`${ex.msg}${wf?`<br><b>Magistra Cornelia — why it didn't work:</b> ${wf}`:""}`);}draw();}
function loop(t){cancelAnimationFrame(raf);if(!openFlag||!sim)return;raf=requestAnimationFrame(loop);const dt=lastT&&t?Math.min(1/15,(t-lastT)/1000):1/60;lastT=t||0;if(result)return;
  const E=eng();E.step(sim,dt);const r=E.judge(sim);draw();if(r)finish(r);}
// ---------------- your projects: every problem you've heard about ----------------
function openProjects(o){hooks=o||{};cur=null;mode="projects";show();const bench=hooks.at==="bench";const known=SC.list.filter(sc=>S(sc.id).facts.length);
  let h=head(bench?"The workbench":"Your projects")+`<div class="dbody">${bench?`<p class="tip">Pick a project to build and test here. The books are on the shelves around you if you want to look something up first.</p>`:`<p class="tip">You build and test at the workbench in the Bibliotheca.</p>`}`;if(!known.length)h+=`<p class="tip">You haven't heard about any problems yet. People all over town grumble about their troubles — listen, walk up and ask.</p>`;
  h+=`<div class="chs">${known.map(sc=>{const s=S(sc.id);return `<button data-open="${sc.id}"><b>${esc(sc.title)}</b><small>${esc(sc.owner)} · level ${lvOf(sc.id)+1} · ${s.solved?"solved":s.framed?"building":s.facts.length>=3?"say what the problem is":`ask ${esc(sc.owner)} more (${s.facts.length}/3)`}</small></button>`;}).join("")}</div>`;
  h+=`<p class="tip">${SC.list.filter(sc=>S(sc.id).solved).length} of ${SC.list.length} problems in town solved.</p></div>`;$("#designBody").innerHTML=h;wireClose();
  document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openProblem(b.dataset.open,Object.assign({},hooks,{at:bench?"bench":"list"})));}
// ---------------- the Schola: listen to lessons; reading class pays (server: /api/elementum/summary) ----------------
const FREE_BOOKS=[["The Tale of Peter Rabbit","Beatrix Potter"],["The Velveteen Rabbit","Margery Williams"],["Just So Stories","Rudyard Kipling"],["The Wonderful Wizard of Oz","L. Frank Baum"],
  ["Alice's Adventures in Wonderland","Lewis Carroll"],["The Secret Garden","Frances Hodgson Burnett"],["Black Beauty","Anna Sewell"],["The Adventures of Pinocchio","Carlo Collodi"],["Aesop's Fables","Aesop"],["The Jungle Book","Rudyard Kipling"]];
function openSchool(o){hooks=o||{};cur=null;mode="school";show();schoolHome();}
function schoolHome(){const L=SC.LESSONS;let h=head("Schola — Magistra Cornelia's class")+`<div class="dbody"><h3>Lessons</h3><p class="tip">Pick a lesson and listen. Magistra Cornelia reads it to the class.</p><div class="shelf">`;
  Object.entries(L).forEach(([k,l])=>{h+=`<button data-lesson="${k}" class="${ST.heard.includes(k)?"read":""}">${esc(l.t)}</button>`;});
  h+=`</div><h3>Reading class — the school pays you for reading</h3><p class="tip">Read a whole book, then write what it was about in your own words. The better your summary, the more you earn (up to 40 denarii a book). Free books to read online:</p><div class="shelf">`;
  FREE_BOOKS.forEach(([t,a])=>{h+=`<a class="bk" target="_blank" rel="noopener" href="https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(t)}">${esc(t)} <small>${esc(a)}</small></a>`;});
  h+=`</div><p class="tip">Or any book you have at home.</p><div class="sum"><input id="sTitle" maxlength="80" placeholder="Book title"><input id="sAuthor" maxlength="60" placeholder="Author (if you know)"><textarea id="sText" rows="6" maxlength="3000" placeholder="What happened in the book? Who are the characters, what was the problem, how did it end — and what did you think?"></textarea><button id="sGo" class="go">Hand it in</button></div>
    <p class="teach" id="sOut">${ST.read.length?`You've handed in ${ST.read.length} book summar${ST.read.length>1?"ies":"y"} and earned ${ST.read.reduce((a,r)=>a+(r.coins||0),0)} denarii.`:""}</p></div>`;
  $("#designBody").innerHTML=h;wireClose();
  document.querySelectorAll("[data-lesson]").forEach(b=>b.onclick=()=>lesson(b.dataset.lesson));
  $("#sGo").onclick=()=>{const title=$("#sTitle").value.trim(),author=$("#sAuthor").value.trim(),text=$("#sText").value.trim();const out=$("#sOut");
    if(title.length<2){out.textContent="Write the book's title.";return;}if(text.split(/\s+/).length<40){out.textContent="Write a bit more — at least 40 words.";return;}
    if(ST.read.some(r=>r.title.toLowerCase()===title.toLowerCase())){out.textContent="You already handed in that book. Read a new one!";return;}
    out.textContent="Magistra Cornelia is reading your summary…";$("#sGo").disabled=true;
    fetch("/api/elementum/summary",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({title,author,text,grade:hooks.grade||4})})
      .then(r=>r.json()).then(j=>{$("#sGo").disabled=false;if(!j||j.error){out.textContent=j&&j.error||"The school is closed right now.";return;}
        ST.read.push({title,score:j.score,coins:j.coins,t:Date.now()});save();if(hooks.pay&&j.coins)hooks.pay(j.coins,`for your summary of ${title}`);
        out.innerHTML=`<b>Score: ${j.score}/100 — you earned ${j.coins} denarii.</b><br>${esc(j.feedback||"")}`;$("#sText").value="";})
      .catch(()=>{$("#sGo").disabled=false;out.textContent="Couldn't reach the school — are you signed in on play.hardywu.com?";});};}
function lesson(k){const l=SC.LESSONS[k];if(!ST.heard.includes(k)){ST.heard.push(k);save();}
  $("#designBody").innerHTML=head(l.t,`<button id="lBack">← Lessons</button>`)+`<div class="dbody book"><p class="dict">${l.x}</p><p class="tip">Magistra Cornelia is reading this lesson aloud.</p></div>`;wireClose();$("#lBack").onclick=()=>{try{speechSynthesis.cancel();}catch(e){}schoolHome();};dictify($("#designBody"));
  try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(l.t+". "+l.x.replace(/<[^>]+>/g,""));u.rate=.95;speechSynthesis.speak(u);}catch(e){}}
// ---------------- the Bibliotheca: shelves by subject, and a computer that finds a book (server: /api/elementum/library) ----------------
const LIB_KEY="elementum.library";let LIB;try{LIB=JSON.parse(localStorage.getItem(LIB_KEY)||"{}");}catch(e){LIB={};}LIB.pages=LIB.pages||[];
const SHELVES={"Science":["Why is the sky blue?","How do magnets work?","What makes a rainbow?","How do plants make their food?","What is gravity?"],"Space":["How big is the Sun?","Why does the Moon change shape?","What is a black hole?","How far away are the stars?"],
  "Animals":["How do bees make honey?","Why do cats purr?","How do fish breathe underwater?","How do birds fly?"],"Ancient Rome":["How did the Romans build aqueducts?","What did Roman children eat?","How were Roman roads built?","What was the Colosseum?"],
  "Math":["What is pi?","Why does a circle have 360 degrees?","Who invented the number zero?","What are prime numbers?"],"Building":["How do bridges stay up?","Why are triangles strong?","What is a cantilever?","How do skyscrapers stand in the wind?"],
  "Gardens":["How do bees pollinate flowers?","What do ladybugs eat?","How do plants grow from seeds?","What is compost?"],"Water & weather":["Why does it rain?","What is a hurricane?","How do floods happen?","Where does tap water come from?"],
  "Heat & cold":["How does insulation work?","Why are dark things hotter in the sun?","How did people keep food cold long ago?","What is temperature?"],"Designs":["How does a truss bridge work?","How does a beam bridge work?","How does an arch bridge work?","How does a suspension bridge work?","What is a cantilever bridge?","Why are A-frames so stable?","How does a roof truss work?","What are guy ropes and why do they hold things up?","What is companion planting?","How does a French drain work?","How do rain gardens work?","How does a straw-bale house stay warm?","How does a passive solar house work?"],
  "Inventions":["How does a lever work?","How does a pulley work?","Who invented the printing press?","How do clocks work?"]};
function forYou(){const q=[];SC.list.forEach(sc=>{const s=S(sc.id);if(s.facts.length&&!s.solved)q.push(...sc.books);});return [...new Set(q)].slice(0,8);}
function openLibrary(o){hooks=o||{};cur=null;mode="library";show();reading=false;if(hooks.stories)nextBook(true);else if(hooks.shelf)libShelf(hooks.shelf,true);else if(hooks.computer)libComputer(true);else libHome();}
function libHome(msg){const fy=forYou();let h=head("Bibliotheca — the library")+`<div class="dbody">${msg?`<p class="bad">${esc(msg)}</p>`:""}
  ${fy.length?`<h3>About your projects</h3><div class="shelf">${fy.map(q=>`<button data-libq="${esc(q)}">${esc(q)}</button>`).join("")}</div>`:""}
  <h3>Shelves</h3><div class="shelf">${Object.keys(SHELVES).map(k=>`<button data-shelf="${esc(k)}">${esc(k)}</button>`).join("")}<button data-computer="1">The computer</button></div>
  ${LIB.pages.length?`<h3>Books you've read</h3><div class="shelf">${LIB.pages.slice(-10).reverse().map(p=>`<button data-libq="${esc(p.q)}" class="read">${esc(p.title)}</button>`).join("")}</div>`:""}</div>`;
  $("#designBody").innerHTML=h;wireClose();wireLib();}
function libShelf(k,direct){const qs=SHELVES[k]||[];$("#designBody").innerHTML=head(`Shelf: ${k}`,direct?"":`<button id="libBack">← Library</button>`)+`<div class="dbody"><p class="tip">Pick a book off the shelf.</p><div class="shelf books">${qs.map(q=>`<button data-libq="${esc(q)}" class="spine">${esc(q)}</button>`).join("")}</div></div>`;wireClose();if($("#libBack"))$("#libBack").onclick=()=>libHome();wireLib();}
function libComputer(direct){$("#designBody").innerHTML=head("The library computer",direct?"":`<button id="libBack">← Library</button>`)+`<div class="dbody"><p class="tip">Can't find it on the shelves? Type what you want to know and the computer finds a book for you.</p><div class="libask"><input id="libQ" maxlength="140" placeholder="What do you want to know?" autocomplete="off"><button id="libGo" class="go">Find a book</button></div></div>`;
  wireClose();if($("#libBack"))$("#libBack").onclick=()=>libHome();const go=()=>{const q=$("#libQ").value.trim();if(q.length>2)libAsk(q);};$("#libGo").onclick=go;$("#libQ").onkeydown=e=>{e.stopPropagation();if(e.key==="Enter")go();};setTimeout(()=>{try{$("#libQ").focus();}catch(e){}},50);}
// ---------------- Stories (2026-11-26, Barbara: "another room … 2-40 pages, all fantasy and fiction … historical and realistic"): stories.js. They live in
// Fabulae, the story room upstairs in the library (game.js storyRoom): a bookcase for each kind opens that kind; the lectern opens them all.
// A story is shown a page at a time (about 250 words a page, like a printed book), the page you got to is remembered, 🔊 reads it aloud from
// that page on, and every word can be pointed at for its meaning (the dictionary), like the other books.
// 2026-11-26 (Barbara: "track how long she reads different genres and then the AI can generate things she will like … a comment pop-up after she finishes a book"):
// LIB.time counts seconds spent reading each kind of story; "✨ For you" suggests unread stories of her favourite kinds and asks the AI (server:
// /api/elementum/story) to write a brand-new one for her, kept on this device (LIB.mine). After the last page: "What did you think?" with faces and
// a comment box — the rating feeds the suggestions, and the words go to Hardy.
const STORY=()=>(window.STORIES||[]).concat(LIB.mine||[]),words=s=>s.paras.reduce((a,p)=>a+p.split(/\s+/).length,0);LIB.stories=LIB.stories||[];LIB.at=LIB.at||{};LIB.time=LIB.time||{};LIB.rate=LIB.rate||{};LIB.notes=LIB.notes||[];LIB.mine=LIB.mine||[];
const libSave=()=>{try{localStorage.setItem(LIB_KEY,JSON.stringify(LIB));}catch(e){}};
function pagesOf(s){if(s._pages)return s._pages;const P=[];let cur=[],n=0;s.paras.forEach(p=>{const w=p.split(/\s+/).length,head=/^Chapter \d+/.test(p)&&p.length<80;
    if(cur.length&&(head||n+w>290)&&n>=140){P.push(cur);cur=[];n=0;}cur.push(p);n+=w;});if(cur.length)P.push(cur);return s._pages=P;}
const KINDS=["Fantasy","Historical fiction","Realistic fiction","Science fiction","Mystery","Adventure","Funny","Fables"];
function libStories(direct,only){try{speechSynthesis.cancel();}catch(e){}if(only==="all")only="";const L=STORY(),G=KINDS.filter(k=>L.some(s=>s.genre===k));
  const list=L.filter(s=>!only||s.genre===only||(only==="short"&&pagesOf(s).length<=8)||(only==="long"&&pagesOf(s).length>8));
  let h=head(only&&KINDS.includes(only)?`📚 ${only}`:"📚 Fabulae — every story",direct?"":`<button id="libBack">← Library</button>`)+`<div class="dbody"><p class="tip">${list.length} ${list.length===1?"story":"stories"}, from 2 to 40 pages. Pick one to read, or have it read to you. Point at any word to see what it means.</p>
  ${only?"":forYou2()}
  <div class="shelf"><button data-sf="" class="${only?"":"on"}">All</button><button data-sf="short" class="${only==="short"?"on":""}">Up to 8 pages</button><button data-sf="long" class="${only==="long"?"on":""}">Longer</button>${G.map(g=>`<button data-sf="${esc(g)}" class="${only===g?"on":""}">${esc(g)}</button>`).join("")}</div>
  <div class="shelf books">${list.map(s=>{const n=pagesOf(s).length,at=LIB.at[s.id],rd=LIB.stories.includes(s.id);return `<button data-story="${esc(s.id)}" class="spine${rd?" read":""}">${s.ai?"✨ ":""}${esc(s.t)}<small>${esc(s.genre)} · ${n} pages${at&&at<n-1?` · on page ${at+1}`:rd?" · read ✓":""}</small></button>`;}).join("")}</div></div>`;
  $("#designBody").innerHTML=h;wireClose();if($("#libBack"))$("#libBack").onclick=()=>libHome();
  document.querySelectorAll("[data-sf]").forEach(b=>b.onclick=()=>libStories(direct,b.dataset.sf));document.querySelectorAll("[data-story]").forEach(b=>b.onclick=()=>storyPage(b.dataset.story,direct,only));
  if($("#aiStory"))$("#aiStory").onclick=()=>aiStory(direct,only);}
// no picking (Barbara, 2026-11-26: "there should be no picking books"): the library hands you your book. If you're in the middle of one you
// go back to it; otherwise it chooses the next one for you — the kinds you read most and liked, ones you haven't read, shorter ones first while
// you're new, longer ones once you've finished a few. "Something else" swaps it for another choice; ✨ asks the AI for a brand-new one.
let skipped=[];
function chooseNext(){const L=STORY(),fav=favKinds(),done=LIB.stories.length;const open=L.filter(s=>LIB.at[s.id]>0&&LIB.at[s.id]<pagesOf(s).length-1&&!LIB.stories.includes(s.id));if(open.length&&!skipped.includes(open[open.length-1].id))return {s:open[open.length-1],cont:true};
  const want=Math.min(40,3+done*3),un=L.filter(s=>!LIB.stories.includes(s.id)&&!skipped.includes(s.id)&&!(LIB.rate[s.id]<=1)),pool=un.length?un:L.filter(s=>!skipped.includes(s.id));
  const score=s=>(fav.includes(s.genre)?(3-fav.indexOf(s.genre))*10:0)-Math.abs(pagesOf(s).length-want)+(s.ai?6:0)+((s.id.charCodeAt(0)+done*7)%5);
  const best=pool.slice().sort((a,b)=>score(b)-score(a))[0]||L[0];return {s:best,cont:false};}
function nextBook(direct){try{speechSynthesis.cancel();}catch(e){}const {s,cont}=chooseNext();if(!s)return;const n=pagesOf(s).length,at=LIB.at[s.id]||0,fav=favKinds();
  const peek=s.paras.filter(p=>!/^Chapter \d+/.test(p)).slice(0,2).join(" ").split(/\s+/).slice(0,45).join(" ")+"…";
  $("#designBody").innerHTML=head("📖 Your next book",direct?"":`<button id="libBack">← Library</button>`)+`<div class="dbody"><div class="nextbook">
    <p class="tip">${cont?"You're in the middle of this one:":fav.length?`Chosen for you — you like ${fav.map(esc).join(" and ")}.`:"Chosen for you."}</p>
    <h2>${s.ai?"✨ ":""}${esc(s.t)}</h2><p class="tip">${esc(s.genre)} · ${n} pages${cont?` · you're on page ${at+1}`:""}</p><p class="peek">${esc(peek)}</p>
    <p><button id="nbRead" class="go big">${cont?`📖 Keep reading (page ${at+1})`:"📖 Start reading"}</button></p>
    <p><button id="nbOther">🔀 Something else</button> <button id="aiStory">✨ Write me a brand-new story</button></p><p class="bad" id="aiMsg"></p>
    ${LIB.stories.length?`<p class="tip">You've finished ${LIB.stories.length} ${LIB.stories.length===1?"book":"books"}.</p>`:""}</div></div>`;
  wireClose();if($("#libBack"))$("#libBack").onclick=()=>libHome();$("#nbRead").onclick=()=>{skipped=[];storyPage(s.id,direct,"",cont?at:0);};
  $("#nbOther").onclick=()=>{skipped.push(s.id);if(skipped.length>=STORY().length-1)skipped=[];nextBook(direct);};$("#aiStory").onclick=()=>aiStory(direct,"");}
function favKinds(){const sc={};KINDS.forEach(k=>sc[k]=(LIB.time[k]||0));for(const id in LIB.rate){const s=STORY().find(x=>x.id===id);if(s)sc[s.genre]=(sc[s.genre]||0)+(LIB.rate[id]-2)*120;}return KINDS.filter(k=>sc[k]>30).sort((a,b)=>sc[b]-sc[a]).slice(0,3);}
function forYou2(){const fav=favKinds(),L=STORY().filter(s=>!LIB.stories.includes(s.id)&&(!fav.length||fav.includes(s.genre))).slice(0,4),mins=k=>{const m=Math.round((LIB.time[k]||0)/60);return m<1?"under 1":m;};
  return `<div class="foryou"><h3>✨ For you</h3><p class="tip">${fav.length?`You read <b>${fav.map(k=>`${esc(k)}</b> (${mins(k)} min)`).join(", <b>")}</b> the most.`:"Read a few stories and the library will learn what you like."}</p>
    ${L.length?`<div class="shelf books">${L.map(s=>`<button data-story="${esc(s.id)}" class="spine">${s.ai?"✨ ":""}${esc(s.t)}<small>${esc(s.genre)} · ${pagesOf(s).length} pages</small></button>`).join("")}</div>`:""}
    <p><button id="aiStory" class="go">✨ Write me a brand-new story</button> <small class="tip">the library's story writer makes one just for you, in the kinds you like</small></p><p class="bad" id="aiMsg"></p></div>`;}
function aiStory(direct,only){const b=$("#aiStory"),m=$("#aiMsg");b.disabled=true;b.textContent="✍️ Writing your story… (about half a minute)";
  const loved=STORY().filter(s=>(LIB.rate[s.id]||0)>=3).slice(-5).map(s=>s.t),notes=LIB.notes.slice(-4).map(n=>n.c);
  fetch("/api/elementum/story",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({likes:favKinds(),loved,notes,pages:5})}).then(r=>r.json()).then(j=>{
    if(!j||j.error||!Array.isArray(j.paras)){b.disabled=false;b.textContent="✨ Write me a brand-new story";m.textContent=(j&&j.error)||"The story writer couldn't write one right now.";return;}
    const s={id:"ai-"+Date.now().toString(36),t:String(j.t).slice(0,80),genre:KINDS.includes(j.genre)?j.genre:"Adventure",paras:j.paras.map(String),ai:true};LIB.mine.push(s);LIB.mine=LIB.mine.slice(-20);libSave();storyPage(s.id,direct,only,0);})
  .catch(()=>{b.disabled=false;b.textContent="✨ Write me a brand-new story";m.textContent="Couldn't reach the library — are you on play.hardywu.com and signed in?";});}
let reading=false;
let readT=null;function readTick(){if(readT){const sec=Math.min(180,(Date.now()-readT.t)/1000);if(sec>2){LIB.time[readT.g]=(LIB.time[readT.g]||0)+sec;libSave();}readT=null;}}
function storyPage(id,direct,only,pg){readTick();const s=STORY().find(s=>s.id===id);if(!s)return libStories(direct,only);const P=pagesOf(s),N=P.length;readT={g:s.genre,t:Date.now()};const firstFinish=pg===N-1&&!LIB.stories.includes(id);
  if(pg===undefined){pg=LIB.at[id]||0;if(pg>=N-1)pg=0;}pg=Math.max(0,Math.min(N-1,pg));LIB.at[id]=pg;if(pg===N-1&&!LIB.stories.includes(id))LIB.stories.push(id);libSave();
  const L=STORY(),nx=L[(L.indexOf(s)+1)%L.length],last=pg===N-1,nav=`<div class="pnav"><button id="pgPrev" ${pg?"":"disabled"}>← Page ${pg}</button><span>Page ${pg+1} of ${N}</span>${last?`<button id="stNext">📖 My next book →</button>`:`<button id="pgNext" class="go">Page ${pg+2} →</button>`}</div>`;
  $("#designBody").innerHTML=head(s.t,`<button id="stBack">← Your next book</button>`)+`<div class="dbody book"><p class="tip">${esc(s.genre)} · ${N} pages <button id="stRead" class="go">${reading?"⏹ Stop reading":"🔊 Read it to me"}</button></p>
    ${P[pg].map(p=>/^Chapter \d+/.test(p)&&p.length<80?`<h3>${esc(p)}</h3>`:`<p>${esc(p)}</p>`).join("")}${last?`<p class="tip">— The End —</p>${rateCard(s)}`:""}${nav}</div>`;
  const go=k=>{storyPage(id,direct,only,k);};wireClose();$("#stBack").onclick=()=>{reading=false;readTick();nextBook(direct);};
  if($("#pgPrev"))$("#pgPrev").onclick=()=>{reading=false;try{speechSynthesis.cancel();}catch(e){}go(pg-1);};if($("#pgNext"))$("#pgNext").onclick=()=>{reading=false;try{speechSynthesis.cancel();}catch(e){}go(pg+1);};
  if($("#stNext"))$("#stNext").onclick=()=>{reading=false;readTick();nextBook(direct);};
  dictify($("#designBody"));{let el=$("#designBody");while(el){el.scrollTop=0;el=el.parentElement;}}
  const speakPage=()=>{try{speechSynthesis.cancel();const parts=(pg===0?[s.t+"."]:[]).concat(P[pg]);let k=0;const next=()=>{if(!reading||!openFlag)return;if(k>=parts.length){if(!last)go(pg+1);else reading=false;if(last&&$("#stRead"))$("#stRead").textContent="🔊 Read it to me";return;}
      const u=new SpeechSynthesisUtterance(parts[k++]);u.rate=.95;u.onend=next;speechSynthesis.speak(u);};next();}catch(e){}};
  $("#stRead").onclick=()=>{reading=!reading;$("#stRead").textContent=reading?"⏹ Stop reading":"🔊 Read it to me";if(reading)speakPage();else try{speechSynthesis.cancel();}catch(e){}};
  if(reading)speakPage();if(last)wireRate(s,firstFinish);}
function rateCard(s){const r=LIB.rate[s.id]||0;return `<div class="rate"><h3>💬 What did you think of “${esc(s.t)}”?</h3><div class="faces">${[["😍",4,"Loved it"],["🙂",3,"Liked it"],["😐",2,"It was OK"],["🙁",1,"Didn't like it"]].map(([e,v,t])=>`<button data-rate="${v}" class="${r===v?"on":""}" title="${t}">${e}<small>${t}</small></button>`).join("")}</div>
  <textarea id="rateC" maxlength="600" placeholder="Was it exciting? Too easy, too hard? What should the next story be about? (optional)"></textarea><button id="rateSend" class="go">Send to Hardy</button> <span class="tip" id="rateMsg"></span></div>`;}
function wireRate(s,first){let v=LIB.rate[s.id]||0;document.querySelectorAll("[data-rate]").forEach(b=>b.onclick=()=>{v=+b.dataset.rate;LIB.rate[s.id]=v;libSave();document.querySelectorAll("[data-rate]").forEach(x=>x.classList.toggle("on",x===b));});
  const T=$("#rateC");if(T){T.onkeydown=e=>e.stopPropagation();T.onkeyup=e=>e.stopPropagation();}if(first&&$(".rate"))setTimeout(()=>{const r=$(".rate");if(r)r.scrollIntoView({behavior:"smooth",block:"center"});},400);
  $("#rateSend").onclick=()=>{const c=(T.value||"").trim(),m=$("#rateMsg");if(!v&&c.length<2){m.textContent="Pick a face or write something first.";return;}if(c)LIB.notes.push({id:s.id,c:c.slice(0,300)});LIB.notes=LIB.notes.slice(-20);libSave();
    const face={4:"😍 loved it",3:"🙂 liked it",2:"😐 it was OK",1:"🙁 didn't like it"}[v]||"";fetch("/api/feedback",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({message:`Story “${s.t}” (${s.genre}${s.ai?", written by the AI":""}): ${face}${c?" — "+c:""}`,path:"/play/elementum/",playing:"Elementum — finished a story in the library"})})
      .then(r=>{m.textContent=r.ok?"Sent — thank you!":"Saved here; couldn't send it to Hardy.";if(r.ok)T.value="";}).catch(()=>{m.textContent="Saved here; couldn't send it to Hardy.";});};}
function wireLib(){document.querySelectorAll("[data-libq]").forEach(b=>b.onclick=()=>libAsk(b.dataset.libq));document.querySelectorAll("[data-shelf]").forEach(b=>b.onclick=()=>libShelf(b.dataset.shelf));document.querySelectorAll("[data-computer]").forEach(b=>b.onclick=()=>libComputer());}
function libAsk(q){const proj=SC.list.find(sc=>sc.books.includes(q)&&S(sc.id).facts.length);
  $("#designBody").innerHTML=head("Bibliotheca — the library")+`<div class="dbody"><p class="tip">Finding a book about “${esc(q)}”…</p><div class="spin"></div></div>`;wireClose();
  fetch("/api/elementum/library",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({q,grade:hooks.grade||4,focus:proj?proj.title:""})})
    .then(r=>r.json()).then(j=>{if(!openFlag||mode!=="library")return;if(!j||j.error){libHome(j&&j.error||"The library is closed right now.");return;}libPage(q,j);}).catch(()=>{if(openFlag&&mode==="library")libHome("Couldn't reach the library — are you on play.hardywu.com and signed in?");});}
function libPage(q,j){if(!LIB.pages.some(p=>p.q===q)){LIB.pages.push({q,title:j.title});LIB.pages=LIB.pages.slice(-60);try{localStorage.setItem(LIB_KEY,JSON.stringify(LIB));}catch(e){}}
  let h=head(j.title,`<button id="libBack">← Library</button>`)+`<div class="dbody book">${(j.paras||[]).map(p=>`<p>${esc(p)}</p>`).join("")}${j.tryit?`<p class="tryit"><b>Try it:</b> ${esc(j.tryit)}</p>`:""}
    ${(j.sources||[]).length?`<p class="src">From: ${j.sources.map(s=>`<a href="${esc(s.uri)}" target="_blank" rel="noopener noreferrer">${esc(s.title||"source")}</a>`).join(" · ")}</p>`:""}
    ${j.suggest?`<iframe class="gsug" sandbox="allow-popups allow-popups-to-escape-sandbox" title="Google search suggestions"></iframe>`:""}</div>`;
  $("#designBody").innerHTML=h;wireClose();$("#libBack").onclick=()=>libHome();dictify($("#designBody"));const fr=document.querySelector(".gsug");if(fr)fr.srcdoc=`<base target="_blank"><style>body{margin:0;zoom:.75}</style>${j.suggest}`;}
// ---------------- the dictionary: point at (or tap) a word and its meaning appears (server: /api/elementum/define) ----------------
const DEF={};let tipEl=null;
function dictify(root){if(!root)return;root.querySelectorAll(".dict, .book p, .ans, #dReport").forEach(el=>{if(el.dataset.dict)return;el.dataset.dict=1;wrapWords(el);});}
function wrapWords(el){const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);const nodes=[];while(walk.nextNode())nodes.push(walk.currentNode);
  nodes.forEach(n=>{if(!/[A-Za-z]{4,}/.test(n.nodeValue)||n.parentElement.closest("a,button,.dw,b"))return;const f=document.createDocumentFragment();
    n.nodeValue.split(/([A-Za-z][A-Za-z'’-]{3,})/).forEach((part,i)=>{if(i%2){const sp=document.createElement("span");sp.className="dw";sp.textContent=part;f.appendChild(sp);}else if(part)f.appendChild(document.createTextNode(part));});n.parentNode.replaceChild(f,n);});}
function showTip(sp){const w=sp.textContent.toLowerCase().replace(/[’']s$/,"").replace(/[^a-z'-]/g,"");if(!tipEl){tipEl=document.createElement("div");tipEl.className="dtip";document.body.appendChild(tipEl);}
  const r=sp.getBoundingClientRect();tipEl.style.left=Math.min(innerWidth-290,Math.max(8,r.left))+"px";tipEl.style.top=(r.bottom+6)+"px";tipEl.innerHTML=`<b>${esc(w)}</b> <span>…</span>`;tipEl.style.display="block";tipEl.dataset.w=w;
  const fill=d=>{if(tipEl.dataset.w===w)tipEl.innerHTML=`<b>${esc(w)}</b> ${esc(d)}`;};
  if(DEF[w]){fill(DEF[w]);return;}const ctx=(sp.parentElement.textContent||"").slice(0,200);
  fetch("/api/elementum/define",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({w,ctx,grade:hooks.grade||4})}).then(r=>r.json()).then(j=>{DEF[w]=j.d||j.error||"No meaning found.";fill(DEF[w]);}).catch(()=>fill("The dictionary needs play.hardywu.com."));}
function hideTip(){if(tipEl)tipEl.style.display="none";}
let tipTimer=0;document.addEventListener("mouseover",e=>{const sp=e.target.closest&&e.target.closest(".dw");clearTimeout(tipTimer);if(sp)tipTimer=setTimeout(()=>showTip(sp),350);else hideTip();});
document.addEventListener("click",e=>{const sp=e.target.closest&&e.target.closest(".dw");if(sp)showTip(sp);});
return {openProblem,openProjects,openSchool,openLibrary,close,isOpen:()=>openFlag,state:()=>ST,S,level:lvOf,
  solved:id=>!!S(id).solved,asked:id=>S(id).facts.length,best:id=>S(id).best,
  _test:{get W(){return W;},set W(v){W=v;},get sim(){return sim;},get result(){return result;},get ui(){return ui;},Lv,eng,draw,loop,finish}};
})();
