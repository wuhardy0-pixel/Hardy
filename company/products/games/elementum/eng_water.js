// Elementum workshop engine: WATER (2026-11-22). A piece of town seen from above, 1 m squares, each with a height. Rain falls,
// springs bubble, and water runs downhill square by square (a simple flow simulation) until it soaks in or leaves by a drain or the
// river. You dig channels, pile sandbags, lay pipes, set out barrels and gravel soak pits. Goals: keep houses dry, get water to a
// garden or a trough, or save rainwater in barrels.
(function(){
const C=16,R=10;
const TOOLS={dig:{name:"Dig a channel",color:"#6a4a2a",cost:1,what:"Lowers the ground half a meter. Water runs along channels — always downhill."},
  sand:{name:"Sandbags",color:"#d8c08a",cost:1,what:"Raises the ground half a meter. Water can't climb over a wall that's higher than it."},
  pipe:{name:"Pipe",color:"#7d8794",cost:2,what:"Click a square, then another: water in the first runs through to the second — only if the second is lower. 2 per meter."},
  barrel:{name:"Rain barrel",color:"#8a5a2e",cost:3,what:"Catches water that flows into its square and keeps it (up to 3 barrels' worth each)."},
  gravel:{name:"Gravel soak pit",color:"#a8a49a",cost:2,what:"Water soaks into the ground here, little by little."},
  erase:{name:"Undo square",color:"#c33",cost:0,what:"Click a square to put it back the way it was."}};
// L: {map:id, rain:[from,to,amount per tick], spring:[[x,y,rate]], ticks, dry:true (houses stay dry), wet:{kind:"garden"|"trough", need}, store:need, budget}
// maps are built from simple shapes: a slope, a hollow, a street, houses, a garden, a river, drains
const MAPS={
  // the house sits on a slope that runs down to the river; rain from uphill runs straight through it
  hollow:L=>{const g=grid((x,y)=>1.1-.06*x-.025*y);put(g,6,3,3,3,"house");put(g,14,0,2,10,"river",-1.2);return g;},
  // a street that slopes down to the drain at the far end; houses on the slopes either side
  street:L=>{const g=grid((x,y)=>.9-.05*x+.06*Math.abs(y-4.5));put(g,0,4,15,2,"street",-.08);put(g,3,0,3,3,"house");put(g,9,7,3,3,"house");put(g,15,0,1,10,"drain",-1.5);return g;},
  // the yard is a shallow bowl; the drain is in a corner
  yard:L=>{const g=grid((x,y)=>.5-.01*x-.01*y+.02*Math.sin(x*1.3)*Math.cos(y*1.1)-.12*Math.max(0,1-Math.hypot((x-7.5)/4.5,(y-4.5)/2.8)));put(g,4,2,8,5,"yard");put(g,0,0,1,1,"drain",-1.5);return g;},
  // the spring is up the hill; the land runs mostly east, the garden is down to the south-east
  springGarden:L=>{const g=grid((x,y)=>1.3-.07*x-.025*y);put(g,1,1,1,1,"spring");put(g,9,6,4,3,"garden");put(g,15,0,1,10,"drain",-1.5);return g;},
  drought:L=>{const g=grid((x,y)=>.5+.03*y);put(g,4,1,6,3,"house",.2);put(g,3,7,7,2,"garden",0);return g;},
  // the river is on the left; the slope runs down to it — through the bakery
  riverBakery:L=>{const g=grid((x,y)=>.2+.06*x+.01*Math.abs(y-4.5));put(g,0,0,2,10,"river",-1.2);put(g,6,3,3,4,"house");return g;},
  // the roof sheds its rain to the front, right onto the doorstep; the garden is further down
  roofDoor:L=>{const g=grid((x,y)=>.8-.04*y-.01*Math.abs(x-7.5));put(g,5,1,6,3,"house",.3);put(g,7,4,2,1,"door");put(g,3,7,10,2,"garden",-.03);return g;},
  // the spring is up on the left, the trough down on the right, a barn in between
  trough:L=>{const g=grid((x,y)=>1.4-.07*x-.03*Math.abs(y-3));put(g,0,3,1,1,"spring");put(g,6,1,2,5,"house",.4);put(g,13,7,2,1,"trough",-.05);put(g,15,0,1,10,"drain",-1.5);return g;},
  // a flat, low field; a deep ditch along the right
  wetField:L=>{const g=grid((x,y)=>.35-.008*x+.015*Math.sin(x*1.7+y));put(g,3,2,9,6,"field",-.06);put(g,15,0,1,10,"drain",-1.5);return g;},
  // one spring: the garden is dry (south), the field floods (east)
  twoSides:L=>{const g=grid((x,y)=>1.0-.055*x-.01*y);put(g,1,1,1,1,"spring");put(g,1,6,5,3,"garden");put(g,9,1,5,4,"field",-.15);put(g,15,0,1,10,"drain",-1.5);return g;}};
function grid(f){const h=[],k=[];for(let y=0;y<R;y++){h.push([]);k.push([]);for(let x=0;x<C;x++){h[y].push(+f(x,y).toFixed(3));k[y].push("ground");}}return {h,k};}
function put(g,x,y,w,hh,kind,dh){for(let j=y;j<y+hh;j++)for(let i=x;i<x+w;i++){if(i<0||j<0||i>=C||j>=R)continue;g.k[j][i]=kind;if(dh)g.h[j][i]=+(g.h[j][i]+dh).toFixed(3);}}
function base(L){return MAPS[L.map](L);}
function init(L){return {mods:{},pipes:[],items:{}};}
const key=(x,y)=>x+","+y;
function ser(W){return W;}function de(L,j){return {mods:Object.assign({},j&&j.mods||{}),pipes:(j&&j.pipes||[]).slice(),items:Object.assign({},j&&j.items||{})};}
function cost(W){let c=0;for(const k in W.mods)c+=Math.abs(W.mods[k])/.5*1;W.pipes.forEach(p=>c+=2*Math.ceil(Math.hypot(p[2]-p[0],p[3]-p[1])));for(const k in W.items)c+=TOOLS[W.items[k]].cost;return c;}
function heights(W,L){const g=base(L);for(const k in W.mods){const [x,y]=k.split(",").map(Number);g.h[y][x]+=W.mods[k];}return g;}
function start(W,L){const g=heights(W,L);const w=g.h.map(r=>r.map(()=>0));const s={L,W,g,w,t:0,peak:{},got:{},stored:{},soak:0,lost:0,inflow:{},done:false,
  barrels:Object.entries(W.items).filter(([k,t])=>t==="barrel").map(([k])=>k),gravel:Object.entries(W.items).filter(([k,t])=>t==="gravel").map(([k])=>k)};return s;}
const DRY_LIM=.04;
function step(s,dt){const n=Math.max(1,Math.round(dt*40));for(let i=0;i<n&&!judge(s);i++)tick(s);}
function tick(s){const L=s.L,g=s.g,w=s.w;s.t++;if(s.t>=L.ticks){s.done=true;return;}
  const raining=L.rain&&s.t>=L.rain[0]&&s.t<L.rain[1];
  for(let y=0;y<R;y++)for(let x=0;x<C;x++){const k=g.k[y][x];
    if(raining){let amt=L.rain[2];if(k==="house"){const out=roofOut(g,x,y);if(out){w[out[1]][out[0]]+=amt;continue;}}w[y][x]+=amt;}
    if(k==="spring")w[y][x]+=0;}
  (L.spring||[]).forEach(([x,y,r])=>{w[y][x]+=r;});
  // flow: each square shares water with lower neighbours (level = ground + water)
  const d=w.map(r=>r.map(()=>0));
  for(let y=0;y<R;y++)for(let x=0;x<C;x++){const ww=w[y][x];if(ww<=1e-5)continue;const lv=g.h[y][x]+ww;let tot=0;const nb=[];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=C||ny>=R)continue;const nl=g.h[ny][nx]+w[ny][nx];if(nl<lv){nb.push([nx,ny,lv-nl]);tot+=lv-nl;}}
    if(!tot)continue;const move=Math.min(ww,tot/2)*.5;for(const [nx,ny,dd] of nb){const f=move*dd/tot;d[y][x]-=f;d[ny][nx]+=f;if(g.k[ny][nx]==="house")s.inflow[key(x,y)]=(s.inflow[key(x,y)]||0)+f;}}
  for(let y=0;y<R;y++)for(let x=0;x<C;x++)w[y][x]=Math.max(0,w[y][x]+d[y][x]);
  // pipes carry water downhill
  s.W.pipes.forEach(([ax,ay,bx,by])=>{const la=g.h[ay][ax]+w[ay][ax],lb=g.h[by][bx]+w[by][bx];if(la>lb+.01&&w[ay][ax]>0){const f=Math.min(w[ay][ax],.08,(la-lb)/2);w[ay][ax]-=f;w[by][bx]+=f;}});
  // where water leaves: drains, the river, gravel pits, barrels, a bit soaks in everywhere
  for(let y=0;y<R;y++)for(let x=0;x<C;x++){const k=g.k[y][x],kk=key(x,y);
    if(k==="drain"||k==="river"){s.lost+=w[y][x];w[y][x]=0;continue;}if(s.W.mods[kk]<0)s.chan=(s.chan||0)+w[y][x]*.02;
    if(s.barrels.includes(kk)){const room=3-(s.stored[kk]||0);const f=Math.min(room,w[y][x]);s.stored[kk]=(s.stored[kk]||0)+f;w[y][x]-=f;}
    if(s.gravel.includes(kk)){const f=Math.min(w[y][x],.05);w[y][x]-=f;s.soak+=f;}
    const soak=Math.min(w[y][x],k==="garden"||k==="field"?.0012:.0006);w[y][x]-=soak;
    if(k==="garden"||k==="field"||k==="trough")s.got[kk]=(s.got[kk]||0)+soak+(k==="trough"?w[y][x]*.02:0);
    if(k==="house"||k==="street"||k==="yard"||k==="door"||k==="field")s.peak[kk]=Math.max(s.peak[kk]||0,w[y][x]);}}
function roofOut(g,x,y){for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){let nx=x,ny=y;while(nx>=0&&ny>=0&&nx<C&&ny<R&&g.k[ny][nx]==="house"){nx+=dx;ny+=dy;}if(nx>=0&&ny>=0&&nx<C&&ny<R)return [nx,ny];}return null;}
function why(s){const L=s.L,r=goals(s);let fell=0;for(let y=0;y<R;y++)for(let x=0;x<C;x++)fell+=0;const stored=Object.values(s.stored).reduce((a,b)=>a+b,0);
  const tot=s.lost+s.soak+stored+0.0001;const out=[];
  if(L.dry)out.push(`The ${L.dry===true?"house":[].concat(L.dry).join(" and ")} stayed dry — the deepest water there was ${Math.round(r.dry*100)} cm.`);
  out.push(`Of the water that moved, ${Math.round(s.lost/tot*100)}% ran away down the drain or river, ${Math.round(s.soak/tot*100)}% soaked into your gravel pits${stored?`, and ${Math.round(stored/tot*100)}% went into your barrels`:""}.`);
  if(Object.values(s.W.mods).some(v=>v<0))out.push("Your channels were lower than the ground around them, so water ran into them and followed them downhill.");
  if(Object.values(s.W.mods).some(v=>v>0))out.push("Your sandbag walls were higher than the water, so it had to go around them.");
  if(s.W.pipes.length)out.push("Your pipe ended lower than it started, so water flowed through it.");
  if(L.wet)out.push(`The ${L.wet.kind} got ${r.wet.toFixed(2)} of water (it needed ${L.wet.need}).`);if(L.store)out.push(`The barrels saved ${r.store.toFixed(1)} (you needed ${L.store}).`);return out.join(" ");}
function whyFail(s){const L=s.L,r=goals(s);const out=[];
  if(L.dry&&r.dry>(L.dryLim||DRY_LIM))out.push(`Water always flows from higher ground to lower ground, and it keeps going until it can't go any lower. The ${L.dry===true?"house":[].concat(L.dry).join(" / ")} sits lower than the ground around it on at least one side, so rain falling there ran downhill straight into it. To keep it dry, the water needs another way down that's lower still — a channel that slopes all the way to the drain or river — or a wall higher than the water so it has to go around.`);
  if(L.wet&&r.wet<L.wet.need)out.push(`The water from the spring took the easiest way downhill, and that way didn't pass through the ${L.wet.kind}. Water can't climb: a channel only carries it if every square is a little lower than the one before. And if the channel is much deeper than the ${L.wet.kind}, the water stays down in the channel instead of spreading out.`);
  if(L.store&&r.store<L.store)out.push("The barrels caught only the water that flowed right into their squares. Most of the rain ran past them downhill. Barrels work best where water already collects — like right where a roof drips — or where channels lead water into them.");
  return out.join(" ");}
function cellsOf(s,kind){const out=[];for(let y=0;y<R;y++)for(let x=0;x<C;x++)if(s.g.k[y][x]===kind)out.push(key(x,y));return out;}
function goals(s){const L=s.L,r={};if(L.dry){const kinds=[].concat(L.dry===true?["house"]:L.dry);r.dry=Math.max(0,...kinds.flatMap(k=>cellsOf(s,k)).map(k=>s.peak[k]||0));}
  if(L.wet){const cs=cellsOf(s,L.wet.kind);r.wet=cs.length?cs.reduce((a,k)=>a+(s.got[k]||0),0)/cs.length:0;}
  if(L.store)r.store=Object.values(s.stored).reduce((a,b)=>a+b,0);return r;}
function judge(s){const L=s.L,r=goals(s);if(L.dry&&r.dry>(L.dryLim||DRY_LIM))return {ok:false};if(!s.done)return null;
  const ok=(!L.wet||r.wet>=L.wet.need)&&(!L.store||r.store>=L.store);return {ok};}
function explain(s){const L=s.L,r=goals(s);const out=[];
  if(L.dry&&r.dry>(L.dryLim||DRY_LIM)){const from=Object.entries(s.inflow).sort((a,b)=>b[1]-a[1])[0];let dir="";if(from){const [x,y]=from[0].split(",").map(Number);const hs=cellsOf(s,(L.dry===true?"house":[].concat(L.dry)[0]));
      if(hs.length){const [hx,hy]=hs[0].split(",").map(Number);dir=y<hy?"the top side":y>hy+1?"the bottom side":x<hx?"the left":"the right";}}
    out.push(`Water got into the ${L.dry===true?"house":[].concat(L.dry).join(" / ")}: ${Math.round(r.dry*100)} cm deep (allowed ${Math.round((L.dryLim||DRY_LIM)*100)} cm)${dir?", flowing in mostly from "+dir:""}.`);}
  if(L.wet&&r.wet<L.wet.need)out.push(`The ${L.wet.kind} got ${r.wet.toFixed(2)} of water on average (needed ${L.wet.need}).`);
  if(L.store&&r.store<L.store)out.push(`The barrels saved ${r.store.toFixed(1)} (needed ${L.store}).`);
  return {tag:L.dry&&r.dry>(L.dryLim||DRY_LIM)?"flood":L.wet?"dry":"store",msg:out.join(" ")||"It didn't work this time."};}
// ---------------- drawing ----------------
function view(cv){const sc=Math.min(cv.width/(C+.5),cv.height/(R+1.2));const ox=(cv.width-C*sc)/2,oy=(cv.height-R*sc)/2+8;return {sc,ox,oy,X:x=>ox+(x+.5)*sc,Y:y=>oy+(y+.5)*sc};}
const KCOL={ground:null,house:"#b07a50",street:"#8d8a86",river:"#3f7fc0",drain:"#333a44",garden:"#4f8a30",field:"#9a8a40",spring:"#6fc8f0",yard:"#c0a070",door:"#5a3a22",trough:"#7a5a3a"};
function draw(cv,W,L,s,idea,ui){const x=cv.getContext("2d"),v=view(cv),g=s?s.g:heights(W,L);x.fillStyle="#3a4a2a";x.fillRect(0,0,cv.width,cv.height);
  let hmin=1e9,hmax=-1e9;g.h.forEach(r=>r.forEach(h=>{hmin=Math.min(hmin,h);hmax=Math.max(hmax,h);}));
  for(let y=0;y<R;y++)for(let xx=0;xx<C;xx++){const h=g.h[y][xx],k=(h-hmin)/Math.max(.01,hmax-hmin);const px=v.ox+xx*v.sc,py=v.oy+y*v.sc;
    x.fillStyle=`rgb(${Math.round(70+100*k)},${Math.round(110+90*k)},${Math.round(50+50*k)})`;x.fillRect(px,py,v.sc,v.sc);const kc=KCOL[g.k[y][xx]];
    if(kc){x.fillStyle=kc;x.globalAlpha=.85;x.fillRect(px+1,py+1,v.sc-2,v.sc-2);x.globalAlpha=1;}
    if(g.k[y][xx]==="house"){x.strokeStyle="#6b3a22";x.lineWidth=1;x.beginPath();x.moveTo(px+2,py+v.sc-2);x.lineTo(px+v.sc-2,py+2);x.stroke();}
    if(g.k[y][xx]==="garden"||g.k[y][xx]==="field"){x.fillStyle="#2f6a1e";for(let i=0;i<3;i++)x.fillRect(px+4+i*v.sc/3,py+4,2,v.sc-8);}
    const m=W.mods[key(xx,y)];if(m){x.fillStyle=m<0?"rgba(60,35,15,.55)":"#d8c08a";if(m>0){for(let i=0;i<m/.5;i++)x.fillRect(px+3,py+v.sc-6-i*6,v.sc-6,5);}else x.fillRect(px+4,py+4,v.sc-8,v.sc-8);}
    const it=W.items[key(xx,y)];if(it==="barrel"){x.fillStyle="#8a5a2e";x.beginPath();x.arc(px+v.sc/2,py+v.sc/2,v.sc*.36,0,7);x.fill();x.strokeStyle="#3a2614";x.stroke();if(s){const f=(s.stored[key(xx,y)]||0)/3;x.fillStyle="#3f8fd8";x.beginPath();x.arc(px+v.sc/2,py+v.sc/2,v.sc*.3*Math.sqrt(f),0,7);x.fill();}}
    if(it==="gravel"){x.fillStyle="#cfcac0";for(let i=0;i<9;i++){x.beginPath();x.arc(px+5+(i%3)*v.sc/3.2,py+5+Math.floor(i/3)*v.sc/3.2,2.4,0,7);x.fill();}}
    if(s){const ww=s.w[y][xx];if(ww>.002){x.fillStyle=`rgba(40,120,220,${Math.min(.85,.2+ww*3)})`;x.fillRect(px,py,v.sc,v.sc);}}}
  W.pipes.forEach(([ax,ay,bx,by])=>{x.strokeStyle="#5a606a";x.lineWidth=5;x.beginPath();x.moveTo(v.X(ax),v.Y(ay));x.lineTo(v.X(bx),v.Y(by));x.stroke();x.fillStyle="#5a606a";x.beginPath();x.arc(v.X(bx),v.Y(by),5,0,7);x.fill();});
  if(ui.pipeFrom){x.strokeStyle="#fff";x.lineWidth=2;x.strokeRect(v.ox+ui.pipeFrom[0]*v.sc+1,v.oy+ui.pipeFrom[1]*v.sc+1,v.sc-2,v.sc-2);}
  if(ui.hover&&!s){x.strokeStyle="#fff";x.lineWidth=1;x.strokeRect(v.ox+ui.hover.x*v.sc+1,v.oy+ui.hover.y*v.sc+1,v.sc-2,v.sc-2);x.fillStyle="#fff";x.font="600 12px system-ui";
    if(ui.hover.x>=0&&ui.hover.y>=0&&ui.hover.x<C&&ui.hover.y<R)x.fillText(`height ${g.h[ui.hover.y][ui.hover.x].toFixed(2)} m (${g.k[ui.hover.y][ui.hover.x]})`,8,14);}
  if(s){const r=goals(s),L_=s.L;x.fillStyle="rgba(0,0,0,.55)";x.fillRect(0,0,cv.width,22);x.fillStyle="#fff";x.font="600 13px system-ui";
    x.fillText(`${L_.rain&&s.t>=L_.rain[0]&&s.t<L_.rain[1]?"Raining · ":""}${L_.dry?`deepest water in ${L_.dry===true?"house":[].concat(L_.dry).join("/")}: ${(r.dry*100).toFixed(0)} cm (max ${Math.round((L_.dryLim||DRY_LIM)*100)}) `:""}${L_.wet?`· ${L_.wet.kind} watered ${r.wet.toFixed(2)} / ${L_.wet.need} `:""}${L_.store?`· saved ${r.store.toFixed(1)} / ${L_.store}`:""}`,8,15);
    if(L_.rain&&s.t>=L_.rain[0]&&s.t<L_.rain[1]){x.strokeStyle="rgba(200,220,255,.5)";for(let i=0;i<40;i++){const rx=(i*71+s.t*9)%cv.width,ry=(i*37+s.t*23)%cv.height;x.beginPath();x.moveTo(rx,ry);x.lineTo(rx-2,ry+8);x.stroke();}}}}
function drawIdea(cv,L,id){const W=init(L);(IDEAS[id]&&IDEAS[id].apply||(()=>{}))(W,L);draw(cv,W,L,null,null,{});}
function pt(cv,e){const r=cv.getBoundingClientRect(),v=view(cv);const px=(e.clientX-r.left)*cv.width/r.width,py=(e.clientY-r.top)*cv.height/r.height;return {x:Math.floor((px-v.ox)/v.sc),y:Math.floor((py-v.oy)/v.sc)};}
function inGrid(p){return p.x>=0&&p.y>=0&&p.x<C&&p.y<R;}
function apply(W,L,p,tool,ui){const k=key(p.x,p.y),g=base(L),bk=g.k[p.y][p.x];
  if(tool==="erase"){delete W.mods[k];delete W.items[k];W.pipes=W.pipes.filter(q=>!(q[0]===p.x&&q[1]===p.y||q[2]===p.x&&q[3]===p.y));return true;}
  if(["house","river","drain","spring"].includes(bk))return false;
  if(tool==="dig"){const m=(W.mods[k]||0)-.5;if(m<-1)return false;W.mods[k]=m;return true;}
  if(tool==="sand"){const m=(W.mods[k]||0)+.5;if(m>1)return false;W.mods[k]=m;return true;}
  if(tool==="barrel"||tool==="gravel"){W.items[k]=tool;return true;}return false;}
function down(W,L,p,ui){if(!inGrid(p))return {};if(ui.tool==="pipe"){if(!ui.pipeFrom){ui.pipeFrom=[p.x,p.y];return {changed:false};}const [ax,ay]=ui.pipeFrom;ui.pipeFrom=null;if(ax===p.x&&ay===p.y)return {};
    if(Math.hypot(p.x-ax,p.y-ay)>8)return {msg:"Pipes can be at most 8 m long."};W.pipes.push([ax,ay,p.x,p.y]);return {changed:true};}
  ui.last=key(p.x,p.y);return {changed:apply(W,L,p,ui.tool,ui)};}
function move(W,L,p,ui){ui.hover=p;if(ui.painting&&inGrid(p)&&ui.tool!=="pipe"&&key(p.x,p.y)!==ui.last&&ui.tool!=="dig"&&ui.tool!=="sand"){ui.last=key(p.x,p.y);return {changed:apply(W,L,p,ui.tool,ui)};}
  if(ui.painting&&inGrid(p)&&(ui.tool==="dig"||ui.tool==="sand")&&key(p.x,p.y)!==ui.last){ui.last=key(p.x,p.y);if(!W.mods[key(p.x,p.y)])return {changed:apply(W,L,p,ui.tool,ui)};}return {};}
function up(){return {};}
// ideas, with a sketch; the solvability check also uses them
const line=(W,L,pts,tool)=>{for(let i=0;i<pts.length-1;i++){let [x,y]=pts[i];const [x2,y2]=pts[i+1];while(x!==x2||y!==y2){apply(W,L,{x,y},tool);if(x!==x2)x+=Math.sign(x2-x);else y+=Math.sign(y2-y);}apply(W,L,{x:x2,y:y2},tool);}};
const IDEAS={
  channel:{name:"Dig a channel",note:"A ditch that runs downhill carries water away — or to where you want it.",apply:(W,L)=>{const sk=SKETCH[L.map];if(sk&&sk.channel){line(W,L,sk.channel,"dig");line(W,L,sk.channel,"dig");}if(sk&&sk.channel2){line(W,L,sk.channel2,"dig");line(W,L,sk.channel2,"dig");}if(sk&&sk.ditch)line(W,L,sk.ditch,"dig");}},
  wall:{name:"Sandbag wall",note:"A wall of sandbags makes the water go around.",apply:(W,L)=>{const sk=SKETCH[L.map];[sk&&sk.wall,sk&&sk.wall2].forEach(w=>{if(w){line(W,L,w,"sand");line(W,L,w,"sand");}});}},
  pipe:{name:"A pipe",note:"A pipe carries water from a high place to a lower one.",apply:(W,L)=>{const sk=SKETCH[L.map];if(sk&&sk.pipe)W.pipes.push(sk.pipe.slice());}},
  barrels:{name:"Rain barrels",note:"Catch the rain where it collects and keep it for dry days.",apply:(W,L)=>{const sk=SKETCH[L.map];if(sk&&sk.barrels)sk.barrels.forEach(([x,y])=>W.items[key(x,y)]="barrel");}},
  soak:{name:"Soak pits",note:"Gravel pits let water sink into the ground instead of standing in puddles.",apply:(W,L)=>{const sk=SKETCH[L.map];if(sk&&sk.gravel)sk.gravel.forEach(([x,y])=>W.items[key(x,y)]="gravel");}}};
// where a sensible channel / wall / pipe / barrels would go on each map (only a guide — players make their own)
const SKETCH={hollow:{wall:[[5,2],[5,6]],wall2:[[6,2],[9,2]],channel:[[4,0],[4,9],[13,9]],gravel:[[5,7],[9,6]]},
  street:{channel:[[2,3],[7,3],[7,4]],wall:[[2,3],[6,3]],wall2:[[8,6],[12,6]],gravel:[[4,4],[10,5]]},
  yard:{channel:[[7,4],[3,4],[3,1],[1,1],[1,0]],gravel:[[6,3],[8,3],[6,4],[8,4],[7,5],[9,5],[5,5],[10,4]]},
  springGarden:{ditch:[[1,2],[1,7],[12,7]],pipe:[1,1,9,6]},
  drought:{barrels:[[3,1],[3,2],[10,1],[10,2],[3,3],[10,3],[5,4],[8,4]]},
  riverBakery:{wall:[[9,1],[9,8]],wall2:[[6,2],[8,2]],channel:[[10,0],[10,9],[2,9]]},
  roofDoor:{barrels:[[7,4],[8,4]],channel:[[6,4],[6,6],[7,6]],wall:[[6,4],[6,5]]},
  trough:{ditch:[[0,4],[0,7],[14,7]],pipe:[0,3,13,7]},
  wetField:{channel:[[3,8],[14,8]],channel2:[[7,2],[7,8]],gravel:[[5,4],[9,4],[11,6]]},
  twoSides:{ditch:[[1,2],[1,7],[5,7]],wall:[[8,0],[8,6]]}};
function tools(L){return {main:(L.tools||Object.keys(TOOLS)).concat(["erase"]).filter((v,i,a)=>a.indexOf(v)===i).map(id=>({id,name:TOOLS[id].name,color:TOOLS[id].color,price:TOOLS[id].cost?(id==="pipe"?"2/m":id==="dig"||id==="sand"?"1 per click":TOOLS[id].cost+" each"):"",what:TOOLS[id].what})),defTool:(L.tools||["dig"])[0]};}
function info(L){const g=[];if(L.dry)g.push(`keep the ${L.dry===true?"house":[].concat(L.dry).join(" and ")} dry`);if(L.wet)g.push(`get water to the ${L.wet.kind}`);if(L.store)g.push(`save ${L.store} barrels' worth of rain`);
  return `Goal: ${g.join(", and ")}. Hover a square to see how high it is — water flows from high to low. Click to dig or pile sandbags (drag to do many).`;}
function build(L,ideas){const W=init(L);ideas.forEach(id=>IDEAS[id].apply(W,L));return W;}
window.ENG=window.ENG||{};
window.ENG.water={name:"Water",tools,init,ser,de,cost,start,step,judge,explain,why,whyFail,draw,drawIdea,ideas:id=>IDEAS[id],pt,down,move,up,info,build,canvasRatio:R/C+.06,MAPS,apply};
})();
