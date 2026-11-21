// Elementum workshop engine: GARDEN (2026-11-22). A garden seen from above, 1 m squares. Pests come in from the edges (or hatch on the
// plants), head for the crop and eat it; bees come to pollinate the flowers. You place protections — nets, fences, copper rings,
// marigolds, ladybugs, bird boxes, scarecrows, beer traps, a cat, metal bins, wildflowers, moth traps — and the test runs the days.
// Poison is there too: it kills the pests, but also the bees (and then nothing gets pollinated).
(function(){
const C=12,R=8;
const TOOLS={
  net:{name:"Net",color:"#d8e4ec",cost:2,on:"plant",what:"Covers one plant: flying bugs, caterpillars, birds and moths can't reach it. Bees can't either!"},
  fence:{name:"Fence",color:"#8a5a2e",cost:2,on:"empty",what:"Rabbits can't get through a fence square. Slugs and bugs can."},
  copper:{name:"Copper ring",color:"#d07a3a",cost:1,on:"empty",what:"Slugs won't cross copper. Put a ring of it around the plants."},
  marigold:{name:"Marigolds",color:"#f0a020",cost:1,on:"empty",what:"Their smell keeps aphids and whiteflies away from nearby squares."},
  ladybug:{name:"Ladybug house",color:"#d23a2a",cost:3,on:"empty",what:"Ladybugs eat aphids and whiteflies nearby. A natural helper."},
  birdbox:{name:"Bird box",color:"#6b4a2c",cost:3,on:"empty",what:"Small birds nest here and eat caterpillars nearby."},
  scarecrow:{name:"Scarecrow",color:"#c9a24a",cost:3,on:"empty",what:"Scares birds away from nearby plants — but birds get used to it after a few days."},
  tape:{name:"Shiny tape",color:"#c0c8d8",cost:1,on:"empty",what:"Flashes in the sun and scares birds from the squares right next to it."},
  trap:{name:"Beer trap",color:"#e8c060",cost:1,on:"empty",what:"Slugs crawl in at night and can't get out (a few each night)."},
  cat:{name:"Cat",color:"#e08a3a",cost:4,on:"empty",what:"Catches mice nearby."},
  bin:{name:"Metal bin",color:"#7d8794",cost:2,on:"plant",what:"Puts the grain in a metal bin: mice can't chew through it."},
  flowers:{name:"Wildflowers",color:"#c060d0",cost:1,on:"empty",what:"Bees love them: more bees come to the garden (and pollinate the crop)."},
  mothtrap:{name:"Moth trap",color:"#a0a070",cost:2,on:"empty",what:"A sticky trap with a smell that catches moths before they lay eggs."},
  poison:{name:"Bug poison",color:"#8a3ab0",cost:0,on:"empty",what:"Kills pests nearby… and bees, ladybugs and birds too."},
  erase:{name:"Remove",color:"#c33",cost:0,on:"any",what:"Click a square to take its item away."}};
const PESTS={aphid:{name:"aphids",fly:true,eat:.8,life:45,color:"#7ac04a",spd:1.2,small:true,avoid:"marigold"},whitefly:{name:"whiteflies",fly:true,eat:.8,life:45,color:"#f4f4f4",spd:1.3,small:true,avoid:"marigold"},
  cater:{name:"caterpillars",hatch:true,eat:2,life:60,color:"#4f9a2e",spd:.4},slug:{name:"slugs",night:true,eat:2.5,life:60,color:"#8a6a4a",spd:1.4,ground:true},
  bird:{name:"birds",fly:true,big:true,eat:3,life:40,color:"#3a3a44",spd:2.2},rabbit:{name:"rabbits",eat:4,life:60,color:"#a8a098",spd:1.4,ground:true,walks:true},
  mouse:{name:"mice",eat:3,life:60,color:"#8a8a8a",spd:1.6,ground:true,walks:true,grain:true},moth:{name:"codling moths",fly:true,eat:2,life:50,color:"#c8b88a",spd:1.5}};
const DAY_T=30,NIGHT=[.7,1];   // ticks per day; the night part of each day
const near=(a,b,r)=>Math.hypot(a.x-b.x,a.y-b.y)<=r;
// L: {crop, plants:[[x,y,w,h],...] areas, pests:{kind:perDay}, days, need, bees (fraction to pollinate, 0 = no flowers), budget, grain}
function plantCells(L){const out=[];(L.plants||[[4,2,4,4]]).forEach(([x,y,w,h])=>{for(let i=0;i<w;i++)for(let j=0;j<h;j++)out.push({x:x+i,y:y+j});});return out;}
function init(L){return {items:{}};}
const key=(x,y)=>x+","+y;
function ser(W){return {items:W.items};}function de(L,j){return {items:Object.assign({},j&&j.items||{})};}
function cost(W){let c=0;for(const k in W.items)c+=TOOLS[W.items[k]].cost;return c;}
function isPlant(L,x,y){return plantCells(L).some(p=>p.x===x&&p.y===y);}
function rngFrom(seed){let s=seed||1;return ()=>(s=(s*16807)%2147483647)/2147483647;}
function start(W,L){const rnd=rngFrom(12345);const plants=plantCells(L).map(p=>({x:p.x,y:p.y,hp:100,pol:false,net:W.items[key(p.x,p.y)]==="net",bin:W.items[key(p.x,p.y)]==="bin"}));
  const items=Object.entries(W.items).map(([k,t])=>{const [x,y]=k.split(",").map(Number);return {x,y,t,charge:5};});
  return {L,W,rnd,plants,items,pests:[],bees:[],t:0,day:0,dmg:{},beesKilled:0,netBlockedBees:0,entries:{},fx:[],done:false,eaten:{},blocked:{},repel:0,came:{},polBy:0};}
const itemAt=(s,x,y)=>s.items.find(i=>i.x===x&&i.y===y);
function blocked(s,p,x,y){if(x<0||y<0||x>=C||y>=R)return false;const it=itemAt(s,x,y);if(!it)return false;
  if(it.t==="fence"&&p.kind==="rabbit")return true;if(it.t==="copper"&&p.kind==="slug")return true;return false;}
function repelled(s,p,x,y){const P=PESTS[p.kind];if(P.avoid&&s.items.some(i=>i.t===P.avoid&&near(i,{x,y},1.5)))return true;
  if(p.kind==="bird"){const dayN=s.day;if(s.items.some(i=>i.t==="scarecrow"&&near(i,{x,y},3)&&s.rnd()<Math.max(.15,.95-.22*dayN)))return true;if(s.items.some(i=>i.t==="tape"&&near(i,{x,y},1.5)))return true;}return false;}
function spawnEdge(s){const r=s.rnd();if(r<.25)return {x:-.5,y:s.rnd()*R};if(r<.5)return {x:C-.5,y:s.rnd()*R};if(r<.75)return {x:s.rnd()*C,y:-.5};return {x:s.rnd()*C,y:R-.5};}
function step(s,dt){const n=Math.max(1,Math.round(dt*30));for(let i=0;i<n&&!judge(s);i++)tick(s);}
function tick(s){const L=s.L,rnd=s.rnd;s.t++;s.day=Math.floor(s.t/DAY_T);const frac=(s.t%DAY_T)/DAY_T,night=frac>=NIGHT[0];
  if(s.day>=L.days){s.done=true;return;}
  // arrivals
  for(const [kind,perDay] of Object.entries(L.pests||{})){const P=PESTS[kind];if(P.night&&!night)continue;const rate=perDay/(P.night?DAY_T*(NIGHT[1]-NIGHT[0]):DAY_T);
    if(rnd()<rate){if(P.hatch){const cand=s.plants.filter(p=>!p.net&&p.hp>0);if(cand.length){const p=cand[Math.floor(rnd()*cand.length)];s.pests.push({kind,x:p.x+rnd()*.6-.3,y:p.y+rnd()*.6-.3,ent:"hatched"});}}
      else{const e=spawnEdge(s);s.pests.push({kind,x:e.x,y:e.y,ent:Math.round(e.x)+","+Math.round(e.y)});}s.came[kind]=(s.came[kind]||0)+1;}}
  const flowers=s.items.filter(i=>i.t==="flowers").length;
  if(L.bees&&!night&&rnd()<(.06+.05*flowers)){const e=spawnEdge(s);s.bees.push({x:e.x,y:e.y,life:60});}
  // poison: kills everything small nearby, every day it's out there
  for(const it of s.items){if(it.t!=="poison")continue;s.pests=s.pests.filter(p=>!(near(p,it,2.2)&&!PESTS[p.kind].big&&!PESTS[p.kind].walks));const before=s.bees.length;s.bees=s.bees.filter(b=>!near(b,it,2.6));s.beesKilled+=before-s.bees.length;}
  // helpers eat pests
  for(const it of s.items){const eat=(kinds,r,p)=>{const v=s.pests.find(q=>kinds.includes(q.kind)&&near(q,it,r));if(v&&rnd()<p){s.pests.splice(s.pests.indexOf(v),1);s.fx.push({x:v.x,y:v.y,t:6,c:"#fff"});s.eaten[it.t]=(s.eaten[it.t]||0)+1;}};
    if(it.t==="ladybug"&&!s.items.some(i=>i.t==="poison"&&near(i,it,2.6)))eat(["aphid","whitefly"],2.6,.55);
    if(it.t==="birdbox")eat(["cater"],3.2,.35);if(it.t==="cat")eat(["mouse"],3.2,.3);if(it.t==="mothtrap")eat(["moth"],3.2,.5);
    if(it.t==="trap"&&night&&it.charge>0){const v=s.pests.find(q=>q.kind==="slug"&&near(q,it,1.6));if(v){s.pests.splice(s.pests.indexOf(v),1);it.charge--;s.eaten.trap=(s.eaten.trap||0)+1;}}
    if(it.t==="trap"&&!night)it.charge=5;}
  // pests move toward the nearest crop they can eat, and eat it
  for(const p of [...s.pests]){const P=PESTS[p.kind];if(P.night&&!night)continue;p.age=(p.age||0)+1;if(p.age>P.life){s.pests.splice(s.pests.indexOf(p),1);continue;}
    const can=s.plants.filter(pl=>pl.hp>0&&(P.grain?!pl.bin:true)&&!(pl.net&&!P.ground)&&!(L.grain&&!P.grain));
    let tgt=null,bd=1e9;for(const pl of can){const d=Math.hypot(pl.x-p.x,pl.y-p.y)+(repelled(s,p,pl.x,pl.y)?20:0);if(d<bd){bd=d;tgt=pl;}}
    if(!tgt){p.x+=rnd()-.5;p.y+=rnd()-.5;if(p.x<-1||p.y<-1||p.x>C||p.y>R)s.pests.splice(s.pests.indexOf(p),1);continue;}
    const dx=tgt.x-p.x,dy=tgt.y-p.y,d=Math.hypot(dx,dy);
    if(d<.35){if(repelled(s,p,tgt.x,tgt.y)){s.repel++;p.x+=(rnd()-.5)*2;p.y+=(rnd()-.5)*2;continue;}tgt.hp=Math.max(0,tgt.hp-P.eat);s.dmg[p.kind]=(s.dmg[p.kind]||0)+P.eat;s.entries[p.ent]=(s.entries[p.ent]||0)+P.eat;
      if(p.kind==="bird"&&rnd()<.2)s.pests.splice(s.pests.indexOf(p),1);continue;}
    const sp=P.spd*.18,nx=p.x+dx/d*sp+(rnd()-.5)*.12,ny=p.y+dy/d*sp+(rnd()-.5)*.12;
    const cx=Math.round(nx),cy=Math.round(ny);
    if(blocked(s,p,cx,cy)){s.blocked[p.kind]=(s.blocked[p.kind]||0)+1;const alt=[[nx,p.y],[p.x,ny],[p.x+(rnd()-.5)*.6,p.y+(rnd()-.5)*.6]].find(([ax,ay])=>!blocked(s,p,Math.round(ax),Math.round(ay)));if(alt){p.x=alt[0];p.y=alt[1];}continue;}
    if(P.fly&&repelled(s,p,cx,cy)&&!repelled(s,p,Math.round(p.x),Math.round(p.y))){p.x+=(rnd()-.5)*.4;p.y+=(rnd()-.5)*.4;continue;}
    p.x=nx;p.y=ny;}
  // bees visit flowering crops (not under nets) and pollinate them
  for(const b of [...s.bees]){b.life--;const tgt=s.plants.find(pl=>!pl.pol&&pl.hp>20&&!pl.net)||null;if(tgt&&Math.hypot(tgt.x-b.x,tgt.y-b.y)<.3)s.polBy++;
    if(!tgt||b.life<=0){s.bees.splice(s.bees.indexOf(b),1);if(!tgt&&s.plants.some(pl=>!pl.pol&&pl.net))s.netBlockedBees++;continue;}
    const dx=tgt.x-b.x,dy=tgt.y-b.y,d=Math.hypot(dx,dy);if(d<.3){tgt.pol=true;s.bees.splice(s.bees.indexOf(b),1);continue;}b.x+=dx/d*.35;b.y+=dy/d*.35;}
  s.fx=s.fx.filter(f=>--f.t>0);}
function score(s){const hp=s.plants.reduce((a,p)=>a+p.hp,0)/s.plants.length/100,pol=s.plants.filter(p=>p.pol).length/s.plants.length;return {hp,pol};}
function judge(s){if(!s.done)return null;const L=s.L,{hp,pol}=score(s);const ok=hp>=L.need&&(!L.bees||pol>=L.bees);return {ok,note:ok&&s.items.some(i=>i.t==="poison")?"It worked — but poison hurts helpful animals. Could you do it without?":""};}
function explain(s){const L=s.L,{hp,pol}=score(s);const tot=Object.values(s.dmg).reduce((a,b)=>a+b,0)||1;
  const parts=Object.entries(s.dmg).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${PESTS[k].name} ${Math.round(v/tot*100)}%`);
  const ent=Object.entries(s.entries).filter(([k])=>k!=="hatched").sort((a,b)=>b[1]-a[1])[0];
  let m=`After ${L.days} days the ${L.crop} ${L.grain?"is":"are"} ${Math.round(hp*100)}% healthy (needed ${Math.round(L.need*100)}%).`;
  if(parts.length)m+=` Damage: ${parts.join(", ")}.`+(ent?` Most came in from the ${side(ent[0])} side.`:"");
  if(L.bees)m+=` ${Math.round(pol*100)}% of the flowers were pollinated (needed ${Math.round(L.bees*100)}%).`+(s.beesKilled?` ${s.beesKilled} bees died near the poison.`:"")+(s.plants.some(p=>p.net)&&pol<L.bees?` Bees couldn't get under the nets.`:"");
  const tag=L.bees&&pol<L.bees?(s.beesKilled?"poison":"bees"):Object.keys(s.dmg).length?"pest_"+Object.entries(s.dmg).sort((a,b)=>b[1]-a[1])[0][0]:"garden";return {tag,msg:m};}
function why(s){const L=s.L,{hp,pol}=score(s);const nm={ladybug:"Your ladybugs ate",birdbox:"Birds from your bird box ate",cat:"Your cat caught",mothtrap:"Your moth traps caught",trap:"Your beer traps caught"},what={ladybug:"bugs",birdbox:"caterpillars",cat:"mice",mothtrap:"moths",trap:"slugs"};
  const out=[`The ${L.crop} ended ${Math.round(hp*100)}% healthy.`];for(const k in s.eaten)out.push(`${nm[k]} ${s.eaten[k]} ${what[k]}.`);
  const nets=s.plants.filter(p=>p.net).length;if(nets)out.push(`${nets} plant${nets>1?"s were":" was"} under nets, so flying pests and birds couldn't reach ${nets>1?"them":"it"}.`);
  if(s.blocked.rabbit)out.push("Your fence turned the rabbits back every time they tried to get in.");if(s.blocked.slug)out.push("The slugs wouldn't cross your copper ring.");
  if(s.repel)out.push(`The smell of your marigolds turned pests away ${s.repel} times, and shiny tape and scarecrows kept birds off.`.replace(", and shiny tape and scarecrows kept birds off",s.items.some(i=>i.t==="scarecrow"||i.t==="tape")?", and the scarecrow and tape scared birds off":""));
  if(L.bees)out.push(`Bees still reached the flowers — ${Math.round(pol*100)}% were pollinated${s.items.some(i=>i.t==="flowers")?", helped by your wildflowers bringing more bees":""}.`);
  if(s.items.some(i=>i.t==="poison"))out.push("It worked with poison — but the poison also killed helpful animals.");return out.join(" ");}
function side(k){const [x,y]=k.split(",").map(Number);return x<=0?"left":x>=C-1?"right":y<=0?"top":"bottom";}
// ---------------- drawing ----------------
function view(cv){const sc=Math.min(cv.width/(C+1),cv.height/(R+1));const ox=(cv.width-C*sc)/2,oy=(cv.height-R*sc)/2;return {sc,X:x=>ox+(x+.5)*sc,Y:y=>oy+(y+.5)*sc,ix:px=>Math.round((px-ox)/sc-.5),iy:py=>Math.round((py-oy)/sc-.5),ox,oy};}
function drawItem(x,v,t,cx,cy,sc){const s=sc*.38;x.save();x.translate(cx,cy);
  if(t==="fence"){x.fillStyle="#8a5a2e";for(let i=-1;i<=1;i++)x.fillRect(i*s*.6-s*.1,-s,s*.2,s*2);x.fillRect(-s,-s*.5,s*2,s*.18);x.fillRect(-s,s*.3,s*2,s*.18);}
  else if(t==="copper"){x.strokeStyle="#d07a3a";x.lineWidth=s*.3;x.beginPath();x.arc(0,0,s*.8,0,7);x.stroke();}
  else if(t==="marigold"||t==="flowers"){const cols=t==="marigold"?["#f0a020","#e07010"]:["#c060d0","#f0d040","#6080f0","#f06080"];for(let i=0;i<5;i++){const a=i*1.26;x.fillStyle=cols[i%cols.length];x.beginPath();x.arc(Math.cos(a)*s*.5,Math.sin(a)*s*.5,s*.32,0,7);x.fill();}}
  else if(t==="ladybug"){x.fillStyle="#d23a2a";x.beginPath();x.arc(0,0,s*.6,0,7);x.fill();x.fillStyle="#111";[[-.25,-.15],[.25,-.15],[0,.25]].forEach(([a,b])=>{x.beginPath();x.arc(a*s,b*s,s*.13,0,7);x.fill();});x.fillRect(-s*.03,-s*.6,s*.06,s*1.2);}
  else if(t==="birdbox"){x.fillStyle="#6b4a2c";x.fillRect(-s*.5,-s*.3,s,s*.9);x.beginPath();x.moveTo(-s*.65,-s*.3);x.lineTo(0,-s*.85);x.lineTo(s*.65,-s*.3);x.fill();x.fillStyle="#222";x.beginPath();x.arc(0,s*.1,s*.18,0,7);x.fill();}
  else if(t==="scarecrow"){x.strokeStyle="#7a5232";x.lineWidth=s*.15;x.beginPath();x.moveTo(0,-s*.5);x.lineTo(0,s);x.moveTo(-s*.8,-s*.1);x.lineTo(s*.8,-s*.1);x.stroke();x.fillStyle="#e8d090";x.beginPath();x.arc(0,-s*.6,s*.3,0,7);x.fill();x.fillStyle="#6b4a2c";x.fillRect(-s*.45,-s*.95,s*.9,s*.18);}
  else if(t==="tape"){x.strokeStyle="#c0c8d8";x.lineWidth=s*.2;x.beginPath();x.moveTo(-s*.8,-s*.6);x.quadraticCurveTo(0,s*.8,s*.8,-s*.6);x.stroke();}
  else if(t==="trap"){x.fillStyle="#e8c060";x.beginPath();x.arc(0,0,s*.55,0,7);x.fill();x.fillStyle="#a07020";x.beginPath();x.arc(0,0,s*.35,0,7);x.fill();}
  else if(t==="cat"){x.fillStyle="#e08a3a";x.beginPath();x.ellipse(0,s*.2,s*.6,s*.4,0,0,7);x.fill();x.beginPath();x.arc(0,-s*.35,s*.33,0,7);x.fill();x.beginPath();x.moveTo(-s*.3,-s*.5);x.lineTo(-s*.2,-s*.85);x.lineTo(-s*.05,-s*.55);x.moveTo(s*.3,-s*.5);x.lineTo(s*.2,-s*.85);x.lineTo(s*.05,-s*.55);x.fill();}
  else if(t==="mothtrap"){x.fillStyle="#a0a070";x.beginPath();x.moveTo(-s*.6,s*.4);x.lineTo(0,-s*.6);x.lineTo(s*.6,s*.4);x.closePath();x.fill();}
  else if(t==="poison"){x.fillStyle="#8a3ab0";x.fillRect(-s*.3,-s*.3,s*.6,s*.9);x.fillRect(-s*.12,-s*.6,s*.24,s*.3);}
  x.restore();}
function draw(cv,W,L,s,idea,ui){const x=cv.getContext("2d"),v=view(cv);x.fillStyle="#6a9a48";x.fillRect(0,0,cv.width,cv.height);
  const night=s&&((s.t%DAY_T)/DAY_T)>=NIGHT[0];
  for(let i=0;i<C;i++)for(let j=0;j<R;j++){x.fillStyle=(i+j)%2?"#73a250":"#6c9a4a";x.fillRect(v.ox+i*v.sc,v.oy+j*v.sc,v.sc,v.sc);}
  const plants=s?s.plants:plantCells(L).map(p=>({x:p.x,y:p.y,hp:100}));
  for(const p of plants){const cx=v.X(p.x),cy=v.Y(p.y);x.fillStyle="#7a5a3a";x.fillRect(cx-v.sc/2+1,cy-v.sc/2+1,v.sc-2,v.sc-2);
    const k=p.hp/100;x.fillStyle=L.grain?`rgb(${200*k+60},${170*k+40},${80*k+30})`:`rgb(${60+120*(1-k)},${150*k+60},${50})`;
    if(L.grain){x.fillRect(cx-v.sc*.3,cy-v.sc*.3,v.sc*.6,v.sc*.6);}else{x.beginPath();x.arc(cx,cy,v.sc*.32*Math.max(.3,k),0,7);x.fill();}
    if(L.bees&&(s?!p.pol:true)){x.fillStyle="#fff";x.beginPath();x.arc(cx+v.sc*.18,cy-v.sc*.18,v.sc*.07,0,7);x.fill();}if(s&&p.pol){x.fillStyle="#f0c030";x.beginPath();x.arc(cx+v.sc*.18,cy-v.sc*.18,v.sc*.09,0,7);x.fill();}}
  for(const [k,t] of Object.entries(W.items)){const [ix,iy]=k.split(",").map(Number);const cx=v.X(ix),cy=v.Y(iy);
    if(t==="net"||t==="bin"){x.strokeStyle=t==="net"?"rgba(230,240,250,.9)":"#7d8794";x.lineWidth=t==="net"?1:3;if(t==="bin"){x.strokeRect(cx-v.sc*.4,cy-v.sc*.4,v.sc*.8,v.sc*.8);}else for(let q=-.4;q<=.41;q+=.2){x.beginPath();x.moveTo(cx+q*v.sc,cy-v.sc*.45);x.lineTo(cx+q*v.sc,cy+v.sc*.45);x.moveTo(cx-v.sc*.45,cy+q*v.sc);x.lineTo(cx+v.sc*.45,cy+q*v.sc);x.stroke();}}
    else drawItem(x,v,t,cx,cy,v.sc);}
  if(s){for(const p of s.pests){const P=PESTS[p.kind],cx=v.ox+(p.x+.5)*v.sc,cy=v.oy+(p.y+.5)*v.sc;x.fillStyle=P.color;
      if(p.kind==="bird"){x.strokeStyle=P.color;x.lineWidth=2;x.beginPath();x.moveTo(cx-6,cy-3);x.lineTo(cx,cy+2);x.lineTo(cx+6,cy-3);x.stroke();}
      else if(p.kind==="rabbit"){x.beginPath();x.ellipse(cx,cy,6,4,0,0,7);x.fill();x.fillRect(cx+2,cy-9,2,6);x.fillRect(cx+5,cy-9,2,6);}
      else if(p.kind==="cater"){for(let i=0;i<4;i++){x.beginPath();x.arc(cx-5+i*3.4,cy,2.4,0,7);x.fill();}}
      else{x.beginPath();x.arc(cx,cy,P.small?2.2:P.ground?4:3.2,0,7);x.fill();if(p.kind==="slug"){x.fillRect(cx,cy-1,6,2);}}}
    for(const b of s.bees){const cx=v.ox+(b.x+.5)*v.sc,cy=v.oy+(b.y+.5)*v.sc;x.fillStyle="#f0c030";x.beginPath();x.ellipse(cx,cy,4,3,0,0,7);x.fill();x.fillStyle="#222";x.fillRect(cx-1,cy-3,2,6);}
    s.fx.forEach(f=>{x.strokeStyle="rgba(255,255,255,.8)";x.beginPath();x.arc(v.ox+(f.x+.5)*v.sc,v.oy+(f.y+.5)*v.sc,8-f.t,0,7);x.stroke();});
    if(night){x.fillStyle="rgba(10,20,60,.35)";x.fillRect(0,0,cv.width,cv.height);}
    const {hp,pol}=score(s);x.fillStyle="rgba(0,0,0,.55)";x.fillRect(0,0,cv.width,24);x.fillStyle="#fff";x.font="600 13px system-ui";
    x.fillText(`Day ${Math.min(L.days,s.day+1)} of ${L.days}${night?" (night)":""} · crop health ${Math.round(hp*100)}% (need ${Math.round(L.need*100)}%)${L.bees?` · pollinated ${Math.round(pol*100)}% (need ${Math.round(L.bees*100)}%)`:""}`,8,16);}
  if(ui.hover&&!s){x.strokeStyle="#fff";x.lineWidth=2;x.strokeRect(v.ox+ui.hover.x*v.sc+1,v.oy+ui.hover.y*v.sc+1,v.sc-2,v.sc-2);}}
function drawIdea(cv,L,id){const W={items:{}};draw(cv,W,L,null,null,{});}
// ---------------- placing ----------------
function pt(cv,e){const r=cv.getBoundingClientRect(),v=view(cv);return {x:v.ix((e.clientX-r.left)*cv.width/r.width),y:v.iy((e.clientY-r.top)*cv.height/r.height)};}
function down(W,L,p,ui){if(p.x<0||p.y<0||p.x>=C||p.y>=R)return {};const k=key(p.x,p.y),T=TOOLS[ui.tool];if(!T)return {};
  if(ui.tool==="erase"){if(W.items[k]){delete W.items[k];return {changed:true};}return {};}const plant=isPlant(L,p.x,p.y);
  if(T.on==="plant"&&!plant)return {msg:`${T.name}s go on the crop squares.`};if(T.on==="empty"&&plant)return {msg:`${T.name} goes on an empty square, not on the crop.`};
  if(W.items[k]===ui.tool){delete W.items[k];return {changed:true};}W.items[k]=ui.tool;return {changed:true};}
function move(W,L,p,ui){ui.hover=p;if(ui.painting&&ui.tool&&ui.tool!=="erase"&&p.x>=0&&p.y>=0&&p.x<C&&p.y<R&&!W.items[key(p.x,p.y)]){const T=TOOLS[ui.tool];const plant=isPlant(L,p.x,p.y);if((T.on==="plant")===plant||T.on==="any"){W.items[key(p.x,p.y)]=ui.tool;return {changed:true};}}return {};}
function up(W,L,p,ui){return {};}
// ideas: a sketch of where things would go
function ring(L,t,dd){dd=dd||1;const pl=plantCells(L),xs=pl.map(p=>p.x),ys=pl.map(p=>p.y);if(dd===2&&(Math.min(...xs)<2||Math.min(...ys)<2||Math.max(...xs)>C-3||Math.max(...ys)>R-3))dd=1;const x0=Math.min(...xs)-dd,x1=Math.max(...xs)+dd,y0=Math.min(...ys)-dd,y1=Math.max(...ys)+dd,o={};
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)if((x===x0||x===x1||y===y0||y===y1)&&x>=0&&y>=0&&x<C&&y<R)o[key(x,y)]=t;return o;}
function IDEA_ITEMS(id,L,o){const pl=plantCells(L);o=o||{};const around=(t,n)=>{const r=Object.keys(ring(L,t)).filter(k=>!o[k]);const step=Math.max(1,r.length/n);for(let i=0;i<n&&i*step<r.length;i++)o[r[Math.floor(i*step)]]=t;};
  if(id==="nets")pl.forEach(p=>o[key(p.x,p.y)]="net");if(id==="bins")pl.forEach(p=>o[key(p.x,p.y)]="bin");
  if(id==="fence")Object.assign(o,ring(L,"fence",2));if(id==="copper")Object.assign(o,ring(L,"copper"));
  const k=n=>Math.max(1,Math.ceil(pl.length/n));
  if(id==="helpers"){around("ladybug",k(5));around("marigold",k(3));}if(id==="birds")around("birdbox",k(6));if(id==="scare"){around("scarecrow",k(10));around("tape",k(3));}
  if(id==="traps")around("trap",k(3));if(id==="cat")around("cat",k(8));if(id==="bees")around("flowers",k(4));if(id==="moths")around("mothtrap",k(5));if(id==="poison")around("poison",3);return o;}
const IDEAS={nets:{name:"Nets over the crop",note:"Nothing that flies or crawls up can reach it. But bees can't either."},fence:{name:"Fence all around",note:"Keeps rabbits out — if there are no gaps."},
  copper:{name:"Copper ring",note:"A ring of copper around the bed: slugs won't cross it."},helpers:{name:"Nature's helpers",note:"Ladybugs to eat aphids, marigolds to keep them away. No poison, bees stay safe."},
  birds:{name:"Bird boxes",note:"Birds that nest nearby eat caterpillars."},scare:{name:"Scare the birds",note:"A scarecrow and shiny tape. Birds learn the scarecrow isn't real after a few days."},
  traps:{name:"Slug traps",note:"Beer traps catch a few slugs each night."},cat:{name:"A cat",note:"Cats catch mice."},bins:{name:"Metal bins",note:"Mice can't chew through metal."},
  bees:{name:"Flowers for bees",note:"Wildflowers bring bees, and bees pollinate the crop."},moths:{name:"Moth traps",note:"Catch the moths before they lay eggs in the fruit."},poison:{name:"Bug poison",note:"Kills the bugs fast. What else might it kill?"}};
function tools(L){return {main:(L.tools||Object.keys(TOOLS)).concat(["erase"]).filter((v,i,a)=>a.indexOf(v)===i).map(id=>({id,name:TOOLS[id].name,color:TOOLS[id].color,price:TOOLS[id].cost?TOOLS[id].cost+" each":"free",what:TOOLS[id].what})),defTool:(L.tools||["net"])[0]};}
function info(L){const ps=Object.keys(L.pests||{}).map(k=>PESTS[k].name).join(", ");return `Protect the ${L.crop} for ${L.days} days from ${ps}. At least ${Math.round(L.need*100)}% must stay healthy${L.bees?` and ${Math.round(L.bees*100)}% of the flowers must be pollinated by bees`:""}. Click squares to place things (drag to place many).`;}
function build(L,ideas){const W=init(L);ideas.forEach(id=>IDEA_ITEMS(id,L,W.items));return W;}
window.ENG=window.ENG||{};
window.ENG.garden={name:"Garden",tools,init,ser,de,cost,start,step,judge,explain,why,draw,drawIdea,ideas:id=>IDEAS[id],pt,down,move,up,info,build,canvasRatio:R/C,TOOLS,PESTS};
})();
