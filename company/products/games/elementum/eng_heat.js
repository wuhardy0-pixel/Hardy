// Elementum workshop engine: HEAT (2026-11-22). A room seen from the side: two walls, a roof, a floor and a window. You choose what each
// is made of (up to three layers each, from stone and brick to straw, wool and sawdust), the window, shade, roof color, night vents,
// sealing the drafts, water barrels for heat storage, a cellar, and a fire. Then a day (or several) of weather runs, hour by hour: sun,
// cold nights, hot afternoons. A simple heat model: heat flows through each part (slower through good insulation), heavy materials store
// heat, the sun warms dark roofs and comes in through windows, the fire burns wood. Goal: keep the room in its temperature range.
(function(){
const MATS={stone:{name:"Stone",color:"#a8a49a",R:.12,M:9,cost:2},brick:{name:"Brick",color:"#b2603e",R:.18,M:7,cost:2},wood:{name:"Wood boards",color:"#b08050",R:.45,M:2,cost:2},
  clay:{name:"Clay plaster",color:"#c9a37a",R:.08,M:4,cost:1},straw:{name:"Straw bales",color:"#e2c86a",R:2.4,M:1,cost:3},wool:{name:"Sheep's wool",color:"#f0ece0",R:2,M:.3,cost:4},
  sawdust:{name:"Sawdust",color:"#d8b888",R:1.5,M:.8,cost:1},thatch:{name:"Reed thatch",color:"#b8a060",R:1.6,M:1,cost:2},air:{name:"Air gap",color:"#e0f0ff",R:.4,M:0,cost:1}};
const PARTS={left:{name:"Left wall",A:10},right:{name:"Right wall",A:10},roof:{name:"Roof",A:16},floor:{name:"Floor",A:16}};
const OPTS={window:{name:"Window",vals:["none","small","large"],cost:[0,2,4]},shutters:{name:"Night shutters",vals:["no","yes"],cost:[0,2]},shade:{name:"Shade / awning",vals:["no","yes"],cost:[0,3]},
  roofColor:{name:"Roof color",vals:["dark","light"],cost:[0,1]},vents:{name:"Night vents",vals:["closed","open at night"],cost:[0,2]},seal:{name:"Seal the drafts",vals:["no","yes"],cost:[0,2]},
  barrels:{name:"Water barrels inside",vals:[0,1,2,3],cost:[0,3,6,9]},cellar:{name:"Dig a cellar",vals:["no","yes"],cost:[0,8]},fire:{name:"Fireplace",vals:["no","yes"],cost:[0,4]},
  pot:{name:"Clay pot cooler",vals:["no","yes"],cost:[0,2]},lamp:{name:"Warm brick / lamp",vals:["no","yes"],cost:[0,2]}};
// L: {climate:{min,max} outside °C day/night, sun:0..1, days, lo, hi, need (fraction of hours in range), fuel (wood per day, 0 = none), budget,
//     opts:[which options exist], start:{parts:{...}}, ice:(kg of ice that must last; then 'need' = fraction left), heat:(body heat W, e.g. chicks), draft: base leakiness}
function init(L){const W={parts:{left:["stone"],right:["stone"],roof:["wood"],floor:["stone"]},o:{window:"small",shutters:"no",shade:"no",roofColor:"dark",vents:"closed",seal:"no",barrels:0,cellar:"no",fire:"no",pot:"no",lamp:"no"}};
  if(L.start){Object.assign(W.parts,JSON.parse(JSON.stringify(L.start.parts||{})));Object.assign(W.o,L.start.o||{});}return W;}
function ser(W){return JSON.parse(JSON.stringify(W));}function de(L,j){const W=init(L);if(j&&j.parts){Object.assign(W.parts,j.parts);Object.assign(W.o,j.o||{});}return W;}
function cost(W,L){const st=init(L);let c=0;for(const p in W.parts){const extra=W.parts[p].filter((m,i)=>st.parts[p][i]!==m);extra.forEach(m=>c+=MATS[m].cost*Math.ceil(PARTS[p].A/8));}
  for(const k in W.o){const O=OPTS[k];if(!O||W.o[k]===st.o[k])continue;c+=O.cost[O.vals.indexOf(W.o[k])]||0;}return c;}
const R_SURF=.17;
function U(W,p,L){const R=R_SURF+W.parts[p].reduce((a,m)=>a+MATS[m].R,0);return 1/R;}
function outside(L,h){const c=L.climate;h=h%24;return (c.min+c.max)/2+(c.max-c.min)/2*Math.sin((h-9)/24*2*Math.PI);}
function sunAt(L,h){const hh=h%24;return hh<6||hh>18?0:Math.sin((hh-6)/12*Math.PI)*(L.sun||0);}
// heat storage in kJ per °C: the air and furniture, every layer of the walls (stone stores a lot, straw almost nothing), water barrels
function start(W,L){const mass=150+Object.keys(PARTS).reduce((a,p)=>a+PARTS[p].A*W.parts[p].reduce((s,m)=>s+MATS[m].M,0),0)*25+420*W.o.barrels;
  return {L,W,t:0,warm:L.ice?0:48,T:L.ice?1:(L.climate.min+L.climate.max)/2,C:mass,fuel:(L.fuel||0)*(L.days+2),fuelUsed:0,ice:L.ice||0,hist:[],inRange:0,hours:0,loss:{},gain:{},minT:99,maxT:-99,worst:null,done:false};}
function step(s,dt){const n=Math.max(1,Math.round(dt*16));for(let i=0;i<n&&!s.done;i++)hour(s);}
// the first two days only let the house settle (heavy walls take a day or more to warm up or cool down); then the measured days run
function hour(s){const L=s.L,W=s.W,h=s.t;if(h>=L.days*24+s.warm){s.done=true;return;}const sub=12;
  for(let k=0;k<sub;k++){const t=h+k/sub,To=outside(L,t),sun=sunAt(L,t),night=(t%24)<6||(t%24)>=19,flows={};
    const add=(name,w)=>{flows[name]=(flows[name]||0)+w;};
    for(const p of ["left","right","roof"]){let Teff=To;if(p==="roof")Teff=To+sun*(W.o.roofColor==="dark"?28:8)*(W.o.shade==="yes"&&L.highSun?.6:1);if(p!=="roof")Teff=To+sun*6;
      const A=PARTS[p].A-(p==="right"?({none:0,small:1.5,large:4}[W.o.window]):0);add(p,U(W,p,L)*A*(Teff-s.T));}
    const Tg=W.o.cellar==="yes"?11:(L.ground!==undefined?L.ground:12);add("floor",U(W,"floor",L)*PARTS.floor.A*(Tg-s.T)*(W.o.cellar==="yes"?2.2:1));
    const winA={none:0,small:1.5,large:4}[W.o.window];if(winA){const shut=W.o.shutters==="yes"&&night;add("window",(shut?1.6:5)*winA*(To-s.T));add("sun through the window",winA*sun*(W.o.shade==="yes"?(L.highSun?120:300):520));}
    const leak=(W.o.seal==="yes"?3:(L.draft||12));add("drafts",leak*(To-s.T));
    if(W.o.vents!=="closed"&&night&&To<s.T)add("night vents",30*(To-s.T));
    if(L.heat)add("body heat",L.heat);if(W.o.lamp==="yes")add("warm brick",60);
    if(W.o.fire==="yes"&&s.fuel>0&&s.T<L.lo+1.5){const burn=Math.min(s.fuel,1/sub);s.fuel-=burn;s.fuelUsed+=burn;add("fire",4000);}
    let net=0;for(const k2 in flows)net+=flows[k2];
    if(W.o.pot==="yes"&&s.T>8)net-=160;
    // with ice inside, the room stays near 1 °C and the heat melts ice instead (kg)
    if(s.ice>0){if(net>0)s.ice=Math.max(0,s.ice-net*(1/sub)*3600/334000);s.T=1;}else s.T+=net*(1/sub)*3600/(s.C*1000);
    for(const k2 in flows){if(flows[k2]<0)s.loss[k2]=(s.loss[k2]||0)-flows[k2];else s.gain[k2]=(s.gain[k2]||0)+flows[k2];}
    s.lastFlows=flows;}
  s.t++;if(s.t<=s.warm)return;s.hours++;const T=s.T;const ok=L.ice?true:(T>=L.lo&&T<=L.hi);if(ok)s.inRange++;
  if(T<s.minT){s.minT=T;s.coldAt=s.t%24;s.coldFlows=s.lastFlows;}if(T>s.maxT){s.maxT=T;s.hotAt=s.t%24;s.hotFlows=s.lastFlows;}
  s.hist.push({To:outside(L,s.t-s.warm),T:s.T,ice:s.ice});}
function judge(s){if(!s.done)return null;const L=s.L;if(L.ice)return {ok:s.ice>=L.ice*L.need};return {ok:s.inRange/s.hours>=L.need};}
function explain(s){const L=s.L;const name=k=>({left:"the left wall",right:"the right wall",roof:"the roof",floor:"the floor",window:"the window",drafts:"drafts","night vents":"the vents","sun through the window":"sun through the window",fire:"the fire","body heat":"body heat","warm brick":"the warm brick"})[k]||k;
  if(L.ice)return {tag:"ice",msg:`${Math.round(s.ice)} kg of ice was left of ${L.ice} kg (needed ${Math.round(L.need*100)}%). Heat came in through: ${Object.entries(s.gain).filter(([k])=>PARTS[k]||k==="drafts"||k==="window").sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>name(k)).join(", ")}.`};
  const fmt=h=>`${h%12||12} ${h<12?"am":"pm"}`;const out=[`In range ${Math.round(s.inRange/s.hours*100)}% of the time (needed ${Math.round(L.need*100)}%). Coldest ${s.minT.toFixed(1)} °C at ${fmt(s.coldAt)}, warmest ${s.maxT.toFixed(1)} °C at ${fmt(s.hotAt)}.`];
  if(s.minT<L.lo&&s.coldFlows){const f=Object.entries(s.coldFlows).filter(([k,v])=>v<0).sort((a,b)=>a[1]-b[1]);const tot=f.reduce((a,[,v])=>a-v,0)||1;out.push(`At the coldest time heat was leaving through ${f.slice(0,3).map(([k,v])=>`${name(k)} ${Math.round(-v/tot*100)}%`).join(", ")}.`);}
  if(s.maxT>L.hi&&s.hotFlows){const f=Object.entries(s.hotFlows).filter(([k,v])=>v>0).sort((a,b)=>b[1]-a[1]);const tot=f.reduce((a,[,v])=>a+v,0)||1;out.push(`At the hottest time heat was coming from ${f.slice(0,3).map(([k,v])=>`${name(k)} ${Math.round(v/tot*100)}%`).join(", ")}.`);}
  if(L.fuel&&s.fuel<=0)out.push("The firewood ran out.");return {tag:s.minT<L.lo?"cold":"hot",msg:out.join(" ")};}
function why(s){const L=s.L,W=s.W,st=init(L),out=[];
  if(!L.ice)out.push(`The room stayed between ${L.lo} and ${L.hi} °C ${Math.round(s.inRange/s.hours*100)}% of the time (coldest ${s.minT.toFixed(1)} °C, warmest ${s.maxT.toFixed(1)} °C).`);else out.push(`${Math.round(s.ice)} kg of the ${L.ice} kg of ice was still there.`);
  for(const p of ["roof","left","right"]){const a=U(st,p,L),b=U(W,p,L);if(b<a*.8)out.push(`Your ${p==="roof"?"roof":p+" wall"} now lets heat through ${(a/b).toFixed(1)} times more slowly (${W.parts[p].map(m=>MATS[m].name.toLowerCase()).join(" + ")}) — the trapped air in it slows heat down.`);}
  if(W.o.seal==="yes"&&st.o.seal!=="yes")out.push("Sealing the drafts stopped air from leaking in and out.");
  if(W.o.shade==="yes"&&st.o.shade!=="yes")out.push("The awning stopped the sun before it came through the window.");if(W.o.roofColor==="light"&&st.o.roofColor!=="light")out.push("The light roof reflected sunshine instead of soaking it up.");
  if(W.o.vents!=="closed"&&st.o.vents==="closed")out.push("Open vents let the cool night air in.");if(W.o.barrels>0)out.push("The water barrels soaked up heat when it was warm and gave it back when it got cold.");
  if(W.o.cellar==="yes")out.push("The cellar kept the floor close to the steady temperature of the ground.");if(W.o.pot==="yes")out.push("Water evaporating from the clay pot carried heat away.");
  if(L.fuel)out.push(`You used ${s.fuelUsed.toFixed(1)} loads of firewood.`);return out.join(" ");}
function whyFail(s){const L=s.L,W=s.W,out=[];
  out.push("Heat always moves from warm to cold — out of a warm room in winter, into a cool room in summer — and it moves faster through some materials than others.");
  if(L.ice)out.push("Heat from the warm air and the sun got through the walls and roof and melted the ice. Stone and wood let heat through quite fast; materials full of trapped, still air — sawdust, straw, wool — slow it right down. That's why old ice houses had walls stuffed with sawdust.");
  else if(s.minT<L.lo){const f=Object.entries(s.coldFlows||{}).filter(([k,v])=>v<0).sort((a,b)=>a[1]-b[1])[0];const where=f?{left:"the left wall",right:"the right wall",roof:"the roof",floor:"the floor",window:"the window",drafts:"gaps letting cold air in","night vents":"the open vents"}[f[0]]:"the walls";
    out.push(`At night the outside got cold and the room's heat poured out — most of it through ${where}. ${f&&f[0]==="drafts"?"Moving air carries heat away very fast; a draft is like leaving a door a little open.":f&&f[0]==="window"?"Thin glass lets heat straight through, especially at night.":"A thin layer of stone or wood is like a thin blanket. Air trapped in straw or wool is a thick one."}${L.fuel&&s.fuel<=0?" The fire couldn't keep up: it was making heat, but the heat leaked out as fast as it came, and the firewood ran out.":""}`);}
  else if(s.maxT>L.hi){const f=Object.entries(s.hotFlows||{}).filter(([k,v])=>v>0).sort((a,b)=>b[1]-a[1])[0];
    out.push(f&&f[0]==="roof"?"The sun beat down on the roof. Dark colors soak up sunlight and get very hot, and that heat came down into the room.":f&&f[0]==="sun through the window"?"Sunshine came straight through the window and warmed everything it touched, like a car in summer.":"Heat from outside and inside built up during the day with nothing to cool it.");
    out.push("Heavy things like stone and water warm up slowly, so they soak up heat in the day; cool night air can carry heat away if it's allowed in.");}
  return out.join(" ");}
// ---------------- drawing: a cut-through room and a temperature chart ----------------
function tempColor(T){const k=Math.max(0,Math.min(1,(T+5)/40));return `rgb(${Math.round(60+190*k)},${Math.round(120+60*Math.sin(k*Math.PI))},${Math.round(230-200*k)})`;}
function geo(cv){const w=cv.width,h=cv.height,rw=w*.46,rh=h*.48,x0=w*.06,y0=h*.2;return {w,h,rw,rh,x0,y0,th:Math.max(8,w*.018)};}
function draw(cv,W,L,s,idea,ui){const x=cv.getContext("2d"),G=geo(cv),cur=s&&s.hist.length?s.hist[s.hist.length-1]:null,hr=s?s.t:12;
  const sun=sunAt(L,hr);x.fillStyle=sun>0?`rgb(${150+60*sun},${200+30*sun},${235})`:"#1d2a4a";x.fillRect(0,0,G.w,G.h);
  if(sun>0){x.fillStyle="#ffd84a";x.beginPath();x.arc(G.x0+G.rw*((hr%24-6)/12),G.y0*.55,14,0,7);x.fill();}
  x.fillStyle="#6b5a40";x.fillRect(0,G.y0+G.rh+G.th*3,G.w*.58,G.h);
  // inside
  x.fillStyle=tempColor(cur?cur.T:(L.climate.min+L.climate.max)/2);x.fillRect(G.x0,G.y0,G.rw,G.rh);
  if(L.ice&&(!s||s.ice>0)){const f=s?s.ice/L.ice:1;x.fillStyle="#e8f6ff";x.fillRect(G.x0+G.rw*.2,G.y0+G.rh*(1-.5*f),G.rw*.6,G.rh*.5*f);}
  if(L.heat){x.fillStyle="#f0d050";for(let i=0;i<5;i++){x.beginPath();x.arc(G.x0+G.rw*(.25+i*.12),G.y0+G.rh-10,7,0,7);x.fill();}}
  // layers
  const layer=(p,rects)=>{W.parts[p].forEach((m,i)=>{const r=rects(i);x.fillStyle=MATS[m].color;x.fillRect(r[0],r[1],r[2],r[3]);x.strokeStyle=ui.part===p?"#ffd84a":"rgba(0,0,0,.35)";x.lineWidth=ui.part===p?3:1;x.strokeRect(r[0],r[1],r[2],r[3]);});};
  const t=G.th;layer("left",i=>[G.x0-t*(i+1),G.y0,t,G.rh]);layer("right",i=>[G.x0+G.rw+t*i,G.y0,t,G.rh]);layer("roof",i=>[G.x0-t*3,G.y0-t*(i+1),G.rw+t*6,t]);layer("floor",i=>[G.x0,G.y0+G.rh+t*i,G.rw,t]);
  if(W.o.roofColor==="light"){x.fillStyle="#f6f2e8";x.fillRect(G.x0-t*3,G.y0-t*(W.parts.roof.length)-4,G.rw+t*6,4);}else{x.fillStyle="#3a2a22";x.fillRect(G.x0-t*3,G.y0-t*(W.parts.roof.length)-4,G.rw+t*6,4);}
  const winA={none:0,small:.25,large:.55}[W.o.window];if(winA){x.fillStyle=s&&W.o.shutters==="yes"&&((hr%24)<6||(hr%24)>=19)?"#6b4a2c":"#a8d8f0";x.fillRect(G.x0+G.rw,G.y0+G.rh*.2,t*W.parts.right.length,G.rh*winA);}
  if(W.o.shade==="yes"){x.fillStyle="#c8432f";x.beginPath();x.moveTo(G.x0+G.rw+t*3,G.y0+G.rh*.15);x.lineTo(G.x0+G.rw+t*3+40,G.y0+G.rh*.25);x.lineTo(G.x0+G.rw+t*3,G.y0+G.rh*.25);x.fill();}
  if(W.o.fire==="yes"){x.fillStyle="#555";x.fillRect(G.x0+8,G.y0+G.rh-30,30,30);if(s&&s.lastFlows&&s.lastFlows.fire){x.fillStyle="#ff8a20";x.beginPath();x.arc(G.x0+23,G.y0+G.rh-10,8,0,7);x.fill();}}
  for(let i=0;i<W.o.barrels;i++){x.fillStyle="#3f6fa8";x.fillRect(G.x0+G.rw-30-i*22,G.y0+G.rh-26,18,26);}
  if(W.o.pot==="yes"){x.fillStyle="#b2603e";x.beginPath();x.arc(G.x0+G.rw*.5,G.y0+G.rh-14,13,0,7);x.fill();}
  if(W.o.cellar==="yes"){x.fillStyle="#4a3a28";x.fillRect(G.x0+G.rw*.3,G.y0+G.rh+t*W.parts.floor.length,G.rw*.4,22);}
  x.fillStyle="#fff";x.font="700 15px system-ui";x.fillText(cur?`${cur.T.toFixed(1)} °C inside`:"",G.x0+8,G.y0+22);x.font="600 12px system-ui";x.fillText(cur?`outside ${cur.To.toFixed(1)} °C`:"",G.x0+8,G.y0+40);
  if(L.ice&&s){x.fillText(`ice left: ${Math.round(s.ice)} kg of ${L.ice}`,G.x0+8,G.y0+56);}
  // chart
  const cx=G.w*.62,cw=G.w*.35,cy=G.h*.12,ch=G.h*.72,days=L.days,Tmin=Math.min(L.climate.min,L.lo)-6,Tmax=Math.max(L.climate.max,L.hi)+6;
  x.fillStyle="rgba(255,255,255,.9)";x.fillRect(cx,cy,cw,ch);const Y=T=>cy+ch-(T-Tmin)/(Tmax-Tmin)*ch,X=hh=>cx+hh/(days*24)*cw;
  if(!L.ice){x.fillStyle="rgba(80,190,100,.25)";x.fillRect(cx,Y(L.hi),cw,Y(L.lo)-Y(L.hi));}
  x.strokeStyle="#9aa";x.lineWidth=1;x.beginPath();for(let hh=0;hh<=days*24;hh++){const yy=Y(outside(L,hh));hh?x.lineTo(X(hh),yy):x.moveTo(X(hh),yy);}x.stroke();
  if(s&&s.hist.length){x.strokeStyle="#c8432f";x.lineWidth=2.5;x.beginPath();s.hist.forEach((p,i)=>{i?x.lineTo(X(i+1),Y(p.T)):x.moveTo(X(i+1),Y(p.T));});x.stroke();}
  x.fillStyle="#222";x.font="600 11px system-ui";x.fillText(L.ice?"inside (red), outside (gray)":`inside (red) · outside (gray) · green = ${L.lo}–${L.hi} °C`,cx+4,cy+14);x.fillText(`${days} day${days>1?"s":""}`,cx+cw-40,cy+ch-6);
  [Tmin+6,Math.round((Tmin+Tmax)/2),Tmax-6].forEach(T=>{x.fillText(Math.round(T)+"°",cx+3,Y(T)+4);});
  if(!s){x.fillStyle="#fff";x.font="600 12px system-ui";x.fillText("Click a wall, the roof or the floor, then a material to add a layer.",G.x0,G.h-12);}}
function drawIdea(cv,L,id){const W=init(L);(IDEAS[id]&&IDEAS[id].apply||(()=>{}))(W,L);draw(cv,W,L,null,null,{});}
function pt(cv,e){const r=cv.getBoundingClientRect();return {px:(e.clientX-r.left)*cv.width/r.width,py:(e.clientY-r.top)*cv.height/r.height,cv};}
function hitPart(cv,p,W){const G=geo(cv),t=G.th;const inR=(a,b,c,d)=>p.px>=a&&p.px<=a+c&&p.py>=b&&p.py<=b+d;
  if(inR(G.x0-t*4,G.y0,t*4,G.rh))return "left";if(inR(G.x0+G.rw,G.y0,t*4,G.rh))return "right";if(inR(G.x0-t*3,G.y0-t*4,G.rw+t*6,t*4))return "roof";if(inR(G.x0,G.y0+G.rh,G.rw,t*4))return "floor";return null;}
function down(W,L,p,ui){const part=hitPart(p.cv,p,W);if(part){ui.part=part;return {changed:false,msg:`${PARTS[part].name}: ${W.parts[part].map(m=>MATS[m].name).join(" + ")}. Click a material to add a layer (up to 3), or "Take off a layer".`,redraw:true};}return {};}
function move(W,L,p,ui){return {};}function up(){return {};}
// the tool bar: materials (added to the chosen part) and the options
function tools(L){return {main:Object.entries(MATS).filter(([id])=>!L.mats||L.mats.includes(id)).map(([id,m])=>({id,name:m.name,color:m.color,price:m.cost+" each",what:`Insulation value ${m.R}, heat storage ${m.M}. ${({stone:"Heavy: stores heat, lets it through fast.",brick:"Stores heat well.",wood:"A bit of insulation.",clay:"Seals and stores heat.",straw:"Excellent insulation — trapped air.",wool:"Excellent insulation, light.",sawdust:"Good, cheap insulation — used in ice houses.",thatch:"Good insulation for roofs.",air:"A still air gap insulates a little."})[id]}`})).concat([{id:"peel",name:"Take off a layer",color:"#c33",what:"Removes the outermost layer of the chosen part."}]),
  opts:Object.keys(OPTS).filter(k=>(L.opts||[]).includes(k)).map(k=>({id:k,name:OPTS[k].name,vals:OPTS[k].vals,cost:OPTS[k].cost})),defTool:"straw",needPart:true};}
function useTool(W,L,ui,tool){if(!ui.part)return {msg:"First click a wall, the roof or the floor."};const P=W.parts[ui.part];if(tool==="peel"){if(P.length>1){P.pop();return {changed:true};}return {msg:"That's the last layer."};}
  if(P.length>=3)return {msg:"Three layers is the most. Take one off first."};P.push(tool);return {changed:true};}
function setOpt(W,L,k,v){W.o[k]=OPTS[k].vals.includes(v)?v:(typeof OPTS[k].vals[0]==="number"?+v:v);return {changed:true};}
function info(L){return L.ice?`Keep at least ${Math.round(L.need*100)}% of the ${L.ice} kg of ice for ${L.days} days of ${L.climate.max} °C weather.`
  :`Keep the room between ${L.lo} and ${L.hi} °C at least ${Math.round(L.need*100)}% of the time, over ${L.days} day${L.days>1?"s":""} (outside: ${L.climate.min} to ${L.climate.max} °C)${L.fuel?`, with ${L.fuel} loads of firewood a day`:""}.`;}
const IDEAS={insulate:{name:"Insulate",note:"Straw, wool or sawdust in the walls and roof trap air and slow heat down — in both directions.",apply:(W,L)=>{["left","right","roof"].forEach(p=>W.parts[p].push(L.mats&&L.mats.includes("sawdust")?"sawdust":"straw"));}},
  mass:{name:"Heavy walls and water",note:"Stone, brick and water barrels soak up heat in the day and give it back at night.",apply:W=>{W.o.barrels=2;}},
  shade:{name:"Shade and a light roof",note:"Stop the sun before it gets in: an awning and a light-colored roof.",apply:W=>{W.o.shade="yes";W.o.roofColor="light";}},
  vent:{name:"Night cooling",note:"Open vents at night let cool air in; close them in the day.",apply:W=>{W.o.vents="open at night";}},
  seal:{name:"Seal the drafts",note:"Cold air sneaks in through gaps. Stuff them with wool and clay.",apply:W=>{W.o.seal="yes";}},
  fire:{name:"A fire",note:"Burn wood for heat — but only as much as you have.",apply:W=>{W.o.fire="yes";}},
  cellar:{name:"Go underground",note:"The ground stays cool in summer and mild in winter.",apply:W=>{W.o.cellar="yes";}},
  pot:{name:"Clay pot cooler",note:"Water soaking out of a clay pot evaporates and cools what's inside.",apply:W=>{W.o.pot="yes";}},
  lamp:{name:"A warm brick",note:"A brick warmed in the oven gives off heat all night.",apply:W=>{W.o.lamp="yes";}},
  shutters:{name:"Night shutters",note:"Windows lose lots of heat at night — close wooden shutters over them.",apply:W=>{W.o.shutters="yes";}}};
function build(L,ideas,thick){const W=init(L);ideas.forEach(id=>IDEAS[id].apply(W,L));if(thick)["left","right","roof"].forEach(p=>{while(W.parts[p].length<3)W.parts[p].push(thick);});return W;}
window.ENG=window.ENG||{};
window.ENG.heat={name:"Heat",tools,init,ser,de,cost,start,step,judge,explain,why,whyFail,draw,drawIdea,ideas:id=>IDEAS[id],pt,down,move,up,info,build,useTool,setOpt,canvasRatio:.55,MATS,OPTS};
})();
