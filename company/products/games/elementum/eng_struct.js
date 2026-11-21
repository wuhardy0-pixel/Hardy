// Elementum workshop engine: STRUCTURES (2026-11-22). A side view on a 0.5 m grid: you join pieces of wood, planks, rope, iron and
// stone with flour paste, wood glue, pine pitch or nails; the test is a physics simulation (XPBD: each piece is a stiff spring with a
// breaking force, long pieces buckle when squeezed, glue holds the pull at each joint). The scenario says what has to be held up:
//   span     — a cart crosses a gap                    ramp     — a wheelchair rolls up to a step
//   platform — a weight sits on a deck high up (wind)  roof     — a roof/canopy must stay on through wind, rain or snow
//   hang     — a weight hangs from a hook point (swing, crane, sign, clothesline)
(function(){
const MATS={
  stick:{name:"Wood stick",color:"#c08a4e",w:4,kgm:1.2,k:3e5,T:4000,C:3000,cost:2,max:3,what:"Light and cheap. Snaps if pulled too hard; long sticks bend sideways (buckle) when squeezed."},
  plank:{name:"Plank",color:"#8a5a2e",w:9,kgm:4,k:4e5,T:4500,C:3500,cost:4,max:3,deck:true,what:"Decks, floors and roofs: the cart rolls and the weight sits only on planks."},
  rope:{name:"Rope",color:"#e0c88a",w:2,kgm:.3,k:2e5,T:4200,C:0,cost:1,max:8,rope:true,what:"Very strong when pulled (tension). Goes floppy when pushed."},
  iron:{name:"Iron bar",color:"#8b96a4",w:4,kgm:6,k:1.6e6,T:14000,C:10000,cost:10,max:3,what:"Strong both ways — but heavy and expensive."},
  stone:{name:"Stone block",color:"#b0aca2",w:11,kgm:18,k:2e6,T:400,C:30000,cost:3,max:1.5,nobuckle:true,what:"Heavy. Hugely strong when squeezed, cracks when pulled."}};
const GLUES={
  paste:{name:"Flour paste",S:1800,cost:0,color:"#f4efe2",what:"Flour + water. Free, but weak."},
  glue:{name:"Wood glue",S:4500,cost:1,color:"#f0d070",what:"Good, strong joints for wood."},
  pitch:{name:"Pine pitch",S:6500,cost:2,color:"#3a2614",what:"The Romans' sticky resin, cooked from pine sap."},
  nails:{name:"Iron nails",S:9500,cost:3,color:"#5a5f68",what:"The strongest joint."}};
const ANCHOR_S=60000,G=9.81,SNAP=.5,H2=1/2400;
const g2=v=>Math.round(v*2)/2,clamp01=v=>Math.max(0,Math.min(1,v));
// ---------------- the ground and the fixed points (anchors) for each kind ----------------
function anchors(L){if(L.anchors)return L.anchors;const S=L.S,H=L.H,a=[];
  if(L.kind==="hang"){for(let x=(L.x0??0)-1;x<=(L.x1??S)+1;x++)a.push([x,0]);return a;}
  if(L.kind==="span")return [[0,0],[S,0],[0,-1],[S,-1],[0,-2],[S,-2],[-1,0],[S+1,0]];
  if(L.kind==="ramp"){for(let x=0;x<S;x++)a.push([x,0]);for(let y=.5;y<=H;y+=.5)a.push([S,y]);a.push([S+1,H]);return a;}
  if(L.kind==="roof"&&L.base!=="ground"){a.push([0,H],[S,H],[0,H-1],[S,H-1]);if(L.mid)a.push([S/2,H]);return a;}
  const x0=L.x0!==undefined?L.x0:-1,x1=L.x1!==undefined?L.x1:S+1;for(let x=x0;x<=x1;x++)a.push([x,0]);return a;}
function groundY(L,x){if(L.kind==="span")return x<=0||x>=L.S?0:-4.2;if(L.kind==="ramp")return x>=L.S?L.H:0;if(L.wall)return x<=0?99:-99;return 0;}
// ---------------- world: loose pieces you place, and the joints you glue ----------------
// A piece is a straight bar of one material {mat,x1,y1,x2,y2}. Nothing is joined until you glue it: click where ends touch (or an end
// touches a fixed point on the wall/ground) and that becomes a joint {x,y,glue,ends:[[piece,end],…],anchor}. Unglued ends are loose.
let PID=1;
function init(L){return {pieces:[],joints:[]};}
const plen=p=>Math.hypot(p.x2-p.x1,p.y2-p.y1),endXY=(p,e)=>e?[p.x2,p.y2]:[p.x1,p.y1];
function ser(W){return {pieces:W.pieces.map(p=>({id:p.id,mat:p.mat,x1:p.x1,y1:p.y1,x2:p.x2,y2:p.y2})),joints:W.joints.map(j=>({x:j.x,y:j.y,glue:j.glue,ends:j.ends.slice(),anchor:!!j.anchor}))};}
function de(L,j){const W=init(L);if(!j||!j.pieces)return W;W.pieces=j.pieces.filter(p=>MATS[p.mat]).map(p=>Object.assign({},p));W.pieces.forEach(p=>{PID=Math.max(PID,p.id+1);});
  W.joints=(j.joints||[]).filter(q=>GLUES[q.glue]).map(q=>({x:q.x,y:q.y,glue:q.glue,ends:q.ends.filter(([id])=>W.pieces.some(p=>p.id===id)),anchor:q.anchor}));return W;}
function cost(W){let c=0;W.pieces.forEach(p=>c+=Math.ceil(MATS[p.mat].cost*plen(p)));W.joints.forEach(j=>c+=GLUES[j.glue].cost);return c;}
const anchorAt=(L,x,y,r)=>anchors(L).find(([ax,ay])=>Math.hypot(ax-x,ay-y)<(r||.3));
// turn pieces + joints into the physics graph: a node per joint, and a node per loose end
function graph(W,L){const nodes=[],ends={},members=[];const AN=anchors(L);
  AN.forEach(([x,y])=>nodes.push({x,y,anchor:true,glue:"anchor"}));
  W.joints.forEach(j=>{let n;if(j.anchor){n=nodes.find(q=>q.anchor&&Math.abs(q.x-j.x)<.01&&Math.abs(q.y-j.y)<.01);if(n){n.jglue=j.glue;}}
    if(!n){n={x:j.x,y:j.y,glue:j.glue};nodes.push(n);}j.ends.forEach(([id,e])=>ends[id+":"+e]=n);});
  W.pieces.forEach(p=>{const a=ends[p.id+":0"]||(nodes.push({x:p.x1,y:p.y1,glue:"loose",loose:true}),nodes[nodes.length-1]);const b=ends[p.id+":1"]||(nodes.push({x:p.x2,y:p.y2,glue:"loose",loose:true}),nodes[nodes.length-1]);
    members.push({a,b,mat:p.mat,pid:p.id});});return {nodes:nodes.filter(n=>!n.anchor||members.some(m=>m.a===n||m.b===n)),members};}
// ---------------- physics ----------------
const LOOSE={S:0};
function start(W,L){const gr=graph(W,L);const ns=gr.nodes.map(n=>({x:n.x,y:n.y,px:n.x,py:n.y,vx:0,vy:0,m:.3,anchor:n.anchor,glue:n.anchor?(n.jglue?GLUES[n.jglue]:null):n.loose?LOOSE:GLUES[n.glue],gname:n.anchor?n.jglue:n.glue,loose:n.loose,src:n}));
  const ms=gr.members.map(m=>{const mt=MATS[m.mat],a=ns[gr.nodes.indexOf(m.a)],b=ns[gr.nodes.indexOf(m.b)],Ln=Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y);a.m+=mt.kgm*Ln/2;b.m+=mt.kgm*Ln/2;
    const C=mt.nobuckle?mt.C:mt.C*Math.min(1,Math.pow(2.5/Math.max(Ln,.01),2));
    // a joint holds the pull with its glue; to an anchor (the wall, the ground) it's bolted — except where the scenario says the old ties were weak (hurricanes)
    // a joint holds the pull with its glue; a joint on the wall or ground holds with its glue too where the scenario's old ties were weak (hurricanes)
    const jS=n=>n.anchor?(L.anchorGlue&&n.glue?n.glue.S:ANCHOR_S):n.loose?1e9:n.glue.S;const ga=jS(a),gb=jS(b);
    return {a,b,L:Ln,mt,mat:m.mat,k:mt.k,T:Math.min(mt.T,ga,gb),Tm:mt.T,C,broken:false,F:0,deck:!!mt.deck,toAnchor:a.anchor||b.anchor,pid:m.pid};});
  const s={ns,ms,t:0,L,load:{w:L.load||0},first:null,maxDisp:0,loose:ns.filter(n=>n.loose).length};
  if(L.kind==="span"||L.kind==="ramp")s.load={x:-1.6,y:0,w:L.load,cart:true};
  if(L.kind==="platform"&&!topDeck(s))s.load.fell="notop";
  if(L.kind==="roof"){s.cover0=cover(s);if(s.cover0<.9)s.load.fell="nocover";}
  if(L.kind==="hang"){let best=null,bd=.45;for(const n of ns){const d=Math.hypot(n.x-L.hook[0],n.y-L.hook[1]);if(d<bd&&s.ms.some(m=>m.a===n||m.b===n)){bd=d;best=n;}}s.hook=best;if(!best)s.load.fell="nohook";}
  return s;}
function deckAt(s,x){let best=null;for(const m of s.ms){if(m.broken||!m.deck)continue;const x0=Math.min(m.a.x,m.b.x),x1=Math.max(m.a.x,m.b.x);if(x<x0-.02||x>x1+.02||x1-x0<.05)continue;
    const t=(x-m.a.x)/(m.b.x-m.a.x);const y=m.a.y+(m.b.y-m.a.y)*t;if(!best||y>best.y)best={m,t:clamp01(t),y,slope:(m.b.y-m.a.y)/(m.b.x-m.a.x)};}return best;}
function topDeck(s){const L=s.L,decks=s.ms.filter(m=>!m.broken&&m.deck&&Math.abs(m.a.y-m.b.y)<.6&&(L.deckX?Math.max(m.a.x,m.b.x)>L.deckX[0]&&Math.min(m.a.x,m.b.x)<L.deckX[1]:true));
  if(!decks.length)return null;const top=Math.max(...decks.map(m=>(m.a.y+m.b.y)/2));const ms=decks.filter(m=>(m.a.y+m.b.y)/2>top-.3);return {ms,x:ms.reduce((a,m)=>a+(m.a.x+m.b.x)/2,0)/ms.length,y:top};}
function cover(s){const L=s.L,iv=[];s.ms.forEach(m=>{if(m.broken||!m.deck)return;if(Math.min(m.a.y,m.b.y)<L.H-.35)return;iv.push([Math.min(m.a.x,m.b.x),Math.max(m.a.x,m.b.x)]);});
  iv.sort((a,b)=>a[0]-b[0]);let c=0,x=0;for(const [a,b] of iv){const lo=Math.max(a,x,0),hi=Math.min(b,L.S);if(hi>lo){c+=hi-lo;x=hi;}}return c/L.S;}
function windNow(s){const L=s.L;if(!L.wind)return (L.kind==="platform"||L.kind==="hang")&&s.t>1?40:0;const ramp=Math.min(1,Math.max(0,(s.t-1)/3));return L.wind*ramp*(L.gust?(.65+.35*Math.sin(s.t*2.4)):1);}
function step(s,dt){const n=Math.max(10,Math.round(dt/H2));for(let i=0;i<n&&!judge(s);i++)sub(s,H2);}
function sub(s,h){const L=s.L;s.t+=h;const free=s.ns.filter(n=>!n.anchor);
  for(const n of free)n.vy-=G*h;
  const wnd=windNow(s);if(wnd){const up=free.filter(n=>n.y>.1);up.forEach(n=>{n.vx+=wnd/Math.max(1,up.length)/n.m*h;});}
  const c=s.load;
  if(c.cart){if(!c.fell&&!c.done){c.x+=1.1*h;const end=L.kind==="ramp"?L.S:L.S;
      if(c.x<0){c.y=0;}else if(c.x>end){c.y=L.kind==="ramp"?L.H:0;if(c.x>end+1.2)c.done=true;}
      else{const d=deckAt(s,c.x);if(!d){c.fell="gap";c.fx=c.x;}else{if(!c.on&&c.x<.4&&Math.abs(d.y)>.35)c.fell="entry";
          if(L.kind==="ramp"&&Math.abs(d.slope)>(L.maxSlope||.3)){c.fell="steep";c.fx=c.x;}
          if(L.kind==="ramp"&&c.x>end-.4&&Math.abs(d.y-L.H)>.35)c.fell="exit";
          c.on=d;c.y=d.y;const W_=c.w*G*Math.min(1,(c.x+.3)/.6),a=d.m.a,b=d.m.b;if(!a.anchor)a.vy-=W_*(1-d.t)/a.m*h;if(!b.anchor)b.vy-=W_*d.t/b.m*h;if(d.y<-3.4)c.fell="water";}}}
    else if(c.fell){c.vy=(c.vy||0)-G*h;c.y+=c.vy*h;}}
  else if(L.kind==="platform"&&!c.fell){const top=topDeck(s);if(top){c.x=top.x;c.y=top.y;const W_=c.w*G*Math.min(1,s.t/1.2)/top.ms.length;top.ms.forEach(m=>[m.a,m.b].forEach(n=>{if(!n.anchor)n.vy-=W_/2/n.m*h;}));if(top.y<L.H-.6)c.fell="low";}else c.fell="fell";}
  else if(L.kind==="roof"&&!c.fell){const k=Math.min(1,s.t/1.2);s.ms.forEach(m=>{if(m.broken||!m.deck)return;const W_=(L.rain||0)*m.L*G*k,U=(L.uplift||0)*m.L*(wnd/(L.wind||1));[m.a,m.b].forEach(n=>{if(!n.anchor)n.vy+=(-W_+U)/2/n.m*h;});});}
  else if(L.kind==="hang"&&!c.fell&&s.hook){const n=s.hook;if(!n.anchor)n.vy-=c.w*G*Math.min(1,s.t/1.2)/n.m*h;}
  for(const n of free){n.px=n.x;n.py=n.y;n.x+=n.vx*h;n.y+=n.vy*h;const gy=groundY(L,n.x);if(n.y<gy&&gy>-50){n.y=gy;n.vx*=.5;}}
  for(const m of s.ms){if(m.broken)continue;const a=m.a,b=m.b;let dx=b.x-a.x,dy=b.y-a.y;const len=Math.hypot(dx,dy)||1e-6;const C=len-m.L;
    if(m.mt.rope&&C<0){m.F=0;continue;}const wa=a.anchor?0:1/a.m,wb=b.anchor?0:1/b.m,w=wa+wb;if(!w)continue;const al=1/(m.k/m.L)/(h*h);const dl=-C/(w+al);
    dx/=len;dy/=len;a.x-=wa*dl*dx;a.y-=wa*dl*dy;b.x+=wb*dl*dx;b.y+=wb*dl*dy;m.F=-dl/(h*h);
    const lim=m.F>0?m.T:m.C;if(Math.abs(m.F)>lim){m.broken=true;if(!s.first)s.first={m,kind:m.F>0?"tension":"compression",by:m.F>0&&m.T<m.Tm?(m.toAnchor&&L.anchorGlue?"tie":"glue"):(m.F<0&&!m.mt.nobuckle&&m.C<m.mt.C*.99?"buckle":"material"),F:Math.abs(m.F),lim};}}
  for(const n of free){n.vx=(n.x-n.px)/h*.9995;n.vy=(n.y-n.py)/h*.9995;if(!n.loose)s.maxDisp=Math.max(s.maxDisp,Math.hypot(n.x-n.src.x,n.y-n.src.y));}
  if(L.kind==="roof"&&!c.fell&&s.t>2&&cover(s)<.85)c.fell="blown";
  if(L.kind==="hang"&&!c.fell&&s.hook&&(s.hook.y<L.hook[1]-.6||!s.ms.some(m=>!m.broken&&(m.a===s.hook||m.b===s.hook))))c.fell="dropped";}
function judge(s){const L=s.L,c=s.load;
  if(c.cart){if(c.done)return s.first?{ok:true,note:"It made it — but something broke on the way. Can you make it so nothing breaks?"}:{ok:true};if(c.fell)return {ok:false};if(s.t>L.S/1.1+8)return {ok:false};return null;}
  if(c.fell)return {ok:false};const T=L.kind==="roof"?10:8;if(s.t>T){if(s.first&&L.kind!=="roof")return {ok:false};if(L.kind==="roof"&&s.maxDisp>1)return {ok:false,sag:true};return {ok:true,note:s.first?"It held — but a piece broke. Can you make it so nothing breaks?":""};}return null;}
// the test report: only what happened — which piece, pulled or squeezed, how hard, what it could take. Working out why is up to you.
function explain(s){const f=s.first,c=s.load,L=s.L;const name=m=>`${MATS[m.mat].name.toLowerCase()} (${m.L.toFixed(1)} m)`;const where=m=>`at ${((m.a.src.x+m.b.src.x)/2).toFixed(1)} m across, ${((m.a.src.y+m.b.src.y)/2).toFixed(1)} m up`;
  if(c.fell==="notop")return {tag:"gap",msg:`There was no level floor of planks at least ${L.H} m up${L.deckX?` between ${L.deckX[0]} and ${L.deckX[1]} m`:""} to put the weight on.`};
  if(c.fell==="nocover")return {tag:"gap",msg:`The planks didn't cover the whole ${L.S} m at ${L.H} m up — there were gaps.`};
  if(c.fell==="nohook")return {tag:"gap",msg:`Nothing was glued together at the hook point (${L.hook[0]} m across, ${L.hook[1]} m up), so there was nothing to hang the load from.`};
  if(c.fell==="steep")return {tag:"steep",msg:`At ${c.fx.toFixed(1)} m the slope was too steep and the wheelchair rolled back.`};
  if(c.fell==="exit")return {tag:"gap",msg:`The top of the ramp didn't meet the step at ${L.H} m.`};
  const loose=s.loose?` (${s.loose} piece end${s.loose>1?"s were":" was"} not glued to anything.)`:"";
  if(f){const m=f.m;
    if(f.by==="tie")return {tag:"tie",msg:`The joint holding a ${name(m)} to the wall/ground came apart ${where(m)}: pulled with ${Math.round(f.F)} N, the ${GLUES[(m.a.anchor?m.a:m.b).gname||"glue"].name.toLowerCase()} held ${Math.round(f.lim)} N.${loose}`};
    if(f.by==="glue")return {tag:"glue",msg:`A joint let go at the end of a ${name(m)} ${where(m)}: pulled with ${Math.round(f.F)} N, the joint held ${Math.round(f.lim)} N.${loose}`};
    if(f.kind==="tension")return {tag:"tension",msg:`A ${name(m)} ${where(m)} was <b>pulled</b> apart: ${Math.round(f.F)} N, and it can take ${Math.round(f.lim)} N.${loose}`};
    if(f.by==="buckle")return {tag:"buckle",msg:`A ${name(m)} ${where(m)} was <b>squeezed</b> and bent sideways: ${Math.round(f.F)} N, and at that length it takes ${Math.round(f.lim)} N.${loose}`};
    return {tag:"compression",msg:`A ${name(m)} ${where(m)} was <b>squeezed</b> until it broke: ${Math.round(f.F)} N, and it can take ${Math.round(f.lim)} N.${loose}`};}
  if(c.fell==="gap")return {tag:"gap",msg:`At ${c.fx.toFixed(1)} m the ${L.kind==="ramp"?"wheelchair":"cart"} had no plank under it.${loose}`};
  if(c.fell==="entry")return {tag:"gap",msg:`The ${L.kind==="ramp"?"wheelchair":"cart"} couldn't get on: no plank started level with the ground at the edge.${loose}`};
  if(c.fell==="water")return {tag:"fold",msg:`Nothing broke, but it sagged until the cart went into the ravine.${loose}`};
  if(c.fell==="blown")return {tag:"tie",msg:`The wind lifted part of the ${L.base==="ground"?"canopy":"roof"} away.${loose}`};
  if(c.fell==="dropped")return {tag:"fold",msg:`The hook point sagged and dropped.${loose}`};
  if(c.fell==="fell"||c.fell==="low")return {tag:"tip",msg:`The weight came down — the floor ended up below ${L.H-.6} m.${loose}`};
  return {tag:"fold",msg:`Nothing broke, but it moved and bent too much.${loose}`};}
// ---------------- design ideas (outlines drawn on the grid as a guide) ----------------
const seg=(a,b)=>[g2(a[0]),g2(a[1]),g2(b[0]),g2(b[1])];
function trussSpan(S,y0,H){const n=Math.ceil(S/2),d=S/n,g=[];for(let i=0;i<n;i++){const a=i*d,b=a+d;g.push(seg([a,y0],[b,y0]));if(i>0)g.push(seg([a,y0],[a,y0+H]));if(i>0&&i<n-1)g.push(seg([a,y0+H],[b,y0+H]));
    if(i===0)g.push(seg([a,y0],[b,y0+H]));else if(i===n-1)g.push(seg([a,y0+H],[b,y0]));else g.push(i<n/2?seg([a,y0],[b,y0+H]):seg([a,y0+H],[b,y0]));}return g;}
function tower(x0,w,H,braced,extra){const g=[],bays=Math.max(1,Math.ceil(w/2)),bw=w/bays;let ys=[];for(let y=0;y<H-1e-6;y+=1)ys.push(y);ys.push(H);(extra||[]).forEach(e=>{if(e>0&&e<H)ys.push(e);});ys=[...new Set(ys.map(v=>+v.toFixed(3)))].sort((a,b)=>a-b);
  for(let i=0;i<ys.length-1;i++){const a=ys[i],b=ys[i+1];for(let k=0;k<=bays;k++)g.push([x0+k*bw,a,x0+k*bw,b]);
    if(braced)for(let k=0;k<bays;k++)g.push((i+k)%2?[x0+(k+1)*bw,a,x0+k*bw,b]:[x0+k*bw,a,x0+(k+1)*bw,b]);if(i&&braced)for(let k=0;k<bays;k++)g.push([x0+k*bw,a,x0+(k+1)*bw,a]);}return g;}
const IDEAS={
  beam:{name:"Simple beam",note:"Planks straight across. Cheap — but long ones bend and snap.",g:L=>{const n=Math.ceil(L.S/3),d=L.S/n,g=[];for(let i=0;i<n;i++)g.push(seg([i*d,0],[(i+1)*d,0]));return g;}},
  truss:{name:"Truss",note:"Triangles above the deck share the load. Triangles can't fold.",g:L=>trussSpan(L.S,0,1.5)},
  arch:{name:"Arch",note:"Stone blocks in a curve under the deck, each pushing on the next.",g:L=>{const S=L.S,g=[],ay=x=>g2(-2+Math.sin(x/S*Math.PI)*1.6);for(let x=0;x<S;x++){g.push(seg([x,ay(x)],[x+1,ay(x+1)]),seg([x,0],[x+1,0]));if(x>0)g.push(seg([x,0],[x,ay(x)]));g.push(x<S/2?seg([x,0],[x+1,ay(x+1)]):seg([x,ay(x)],[x+1,0]));}return g;}},
  susp:{name:"Suspension",note:"Towers at each end, ropes hang the deck.",g:L=>{const S=L.S,g=[],m=Math.ceil(S/1.5),d=S/m,sag=x=>2.5-1.8*(1-Math.pow(2*x/S-1,2));g.push(seg([0,0],[0,2.5]),seg([S,0],[S,2.5]),seg([-1,0],[0,2.5]),seg([S+1,0],[S,2.5]));
    for(let i=0;i<m;i++){g.push(seg([i*d,0],[(i+1)*d,0]),seg([i*d,sag(i*d)],[(i+1)*d,sag((i+1)*d)]));if(i)g.push(seg([i*d,0],[i*d,sag(i*d)]));}return g;}},
  legs:{name:"Straight legs",note:"Posts holding a floor. Quick — but rectangles fold sideways.",g:L=>{const x0=L.deckX?L.deckX[0]:0,w=L.deckX?L.deckX[1]-L.deckX[0]:2,g=[];for(let i=0;i<L.H;i+=1)g.push(seg([x0,i],[x0,Math.min(L.H,i+1)]),seg([x0+w,i],[x0+w,Math.min(L.H,i+1)]));g.push(seg([x0,L.H],[x0+w,L.H]));return g;}},
  braced:{name:"Braced frame",note:"Diagonal braces make triangles, so it can't fold.",g:L=>{const x0=L.deckX?L.deckX[0]:0,w=L.deckX?L.deckX[1]-L.deckX[0]:2,b=Math.max(1,Math.ceil(w/2)),bw=w/b;return tower(x0,w,L.H,true).concat([...Array(b)].map((_,k)=>[x0+k*bw,L.H,x0+(k+1)*bw,L.H]));}},
  props:{name:"Braced, with props",note:"A braced frame plus props out to the sides: a wide base is hard to tip.",g:L=>{const x0=L.deckX?L.deckX[0]:0,w=L.deckX?L.deckX[1]-L.deckX[0]:2;return IDEAS.braced.g(L).concat([[x0-1,0,x0,2],[x0+w+1,0,x0+w,2]]);}},
  rampPosts:{name:"Ramp on posts",note:"A long gentle slope of planks on posts. Posts alone can fold.",g:L=>{const g=[],y=x=>L.H*x/L.S;for(let x=0;x<L.S;x+=2){g.push([x,y(x),x+2,y(x+2)]);if(x>0)g.push([x,0,x,y(x)]);}return g;}},
  rampBraced:{name:"Braced ramp",note:"Posts with diagonal braces under the slope — triangles everywhere.",g:L=>{const g=[],y=x=>L.H*x/L.S;for(let x=0;x<L.S;x+=2){g.push([x,y(x),x+2,y(x+2)]);if(x>0)g.push([x,0,x,y(x)]);g.push([x,0,x+2,y(x+2)]);}return g;}},
  flatRoof:{name:"Flat planks",note:"Planks laid across. Simple — but they sag and lift off in wind.",g:L=>{const n=Math.ceil(L.S/3),d=L.S/n,g=[];const y=L.H;for(let i=0;i<n;i++)g.push(seg([i*d,y],[(i+1)*d,y]));if(L.base==="ground")g.push(seg([0,0],[0,y]),seg([L.S,0],[L.S,y]));return g;}},
  gable:{name:"Truss roof",note:"Sloping rafters, a tie beam and a king post: a triangle that sheds wind and rain.",g:L=>{const S=L.S,y=L.H,h=Math.min(2,S/3),g=[[0,y,S/2,y+h],[S/2,y+h,S,y],[S/2,y,S/2,y+h]];
    const n=Math.max(2,Math.ceil(S/2)),d=S/n;for(let i=0;i<n;i++)g.push([i*d,y,(i+1)*d,y]);for(let i=1;i<n;i++){const x=i*d;if(Math.abs(x-S/2)<.01)continue;const ry=y+h*(1-Math.abs(x-S/2)/(S/2));g.push([x,y,x,ry]);g.push(x<S/2?[x,y,x+d,y+h*(1-Math.abs(x+d-S/2)/(S/2))]:[x,y,x-d,y+h*(1-Math.abs(x-d-S/2)/(S/2))]);}
    if(L.base==="ground")g.push(seg([0,0],[0,y]),seg([S,0],[S,y]),seg([0,0],[1,y]),seg([S,0],[S-1,y]),seg([0,y-1],[1,y]),seg([S,y-1],[S-1,y]));return g;}},
  aframe:{name:"A-frame",note:"Two leaning legs on each side meeting at the top: wide at the bottom, so it can't tip.",g:L=>{const [hx,hy]=L.hook;const lx=Math.max((L.x0??0)-1,Math.floor(hx-hy/2)),rx=Math.min((L.x1??L.S)+1,Math.ceil(hx+hy/2));
    const mid=(a)=>[a+(hx-a)/2,hy/2];const [l2x]=mid(lx),[r2x]=mid(rx);return [[lx,0,l2x,hy/2],[l2x,hy/2,hx,hy],[rx,0,r2x,hy/2],[r2x,hy/2,hx,hy],[l2x,hy/2,hx,hy/2],[hx,hy/2,r2x,hy/2],[hx,hy/2,hx,hy],[lx,0,hx,hy/2],[rx,0,hx,hy/2]];}},
  posts:{name:"Two posts and a bar",note:"Straight posts with a bar across. Rectangles fold sideways.",g:L=>{const [hx,hy]=L.hook,a=L.x0??0,b=L.x1??L.S;return [seg([a,0],[a,hy]),seg([b,0],[b,hy]),seg([a,hy],[hx,hy]),seg([hx,hy],[b,hy])];}},
  arm:{name:"Arm truss",note:"A top bar and a sloping bottom bar with braces between: a long triangle.",g:L=>{const [hx,hy]=L.hook,base=L.wall?0:(L.x1??1),n=Math.max(2,Math.ceil((hx-base)/1)),d=(hx-base)/n,g=[];
    const T=i=>[base+i*d,hy],B=i=>[base+i*d,hy-1+i/n];for(let i=0;i<n;i++){g.push([...T(i),...T(i+1)]);g.push([...B(i),...(i+1===n?T(n):B(i+1))]);if(i>0)g.push([...T(i),...B(i)]);g.push([...B(i),...T(i+1)]);}
    if(!L.wall){const x0=L.x0??0;g.push(...tower(x0,base-x0,hy,true,[hy-1]));}return g;}},
  trussbar:{name:"Trussed bar",note:"Two bars with braces between them span the gap without sagging.",g:L=>{const [hx,hy]=L.hook,a=L.x0??0,b=L.x1??L.S,n=Math.max(2,Math.ceil((b-a)/2)),d=(b-a)/n,g=[];
    g.push([a,0,a,hy],[a,hy,a,hy+1],[b,0,b,hy],[b,hy,b,hy+1],[a-1,0,a,1.5],[b+1,0,b,1.5]);for(let i=0;i<n;i++){const x=a+i*d,y=x+d;g.push([x,hy,y,hy],[x,hy+1,y,hy+1],i<n/2?[x,hy,y,hy+1]:[x,hy+1,y,hy]);if(i>0)g.push([x,hy,x,hy+1]);}return g;}},
  cantilever:{name:"Cantilever truss",note:"An arm held out with a top tie and a bottom strut: a long triangle.",g:L=>{const [hx,hy]=L.hook,g=[],base=L.wall?0:(L.x1??1);const steps=Math.ceil((hx-base)/1.5);for(let i=0;i<steps;i++){const a=base+(hx-base)*i/steps,b=base+(hx-base)*(i+1)/steps;g.push(seg([a,hy],[b,hy]),seg([a,hy-1],[b,hy-(i===steps-1?0:1)]),seg([a,hy-1],[b,hy]));}
    if(!L.wall)g.push(...tower(L.x0??0,base-(L.x0??0),hy,true));return g;}},
  bracket:{name:"Bracket",note:"A shelf held by a diagonal strut from the wall below: a triangle.",g:L=>{const y=L.H,w=L.deckX?L.deckX[1]:2,g=[];for(let x=0;x<w;x+=1)g.push(seg([x,y],[Math.min(w,x+1),y]));g.push(seg([0,y-1.5],[1.5,y]),seg([0,y-1],[1,y]));return g;}},
  guyed:{name:"Rope ties",note:"Ropes from high up on the wall (or the ground) hold the far end up — rope loves being pulled.",g:L=>{if(L.kind==="hang"&&!L.wall){const [hx,hy]=L.hook,a=L.x0??0,b=L.x1??L.S,P=hy+.5;
      return [[a,0,a,P,"stick"],[b,0,b,P,"stick"],[a,P,hx,hy,"rope"],[hx,hy,b,P,"rope"],[a-1,0,a,P,"stick"],[b+1,0,b,P,"stick"]];}
    const y=L.kind==="hang"?L.hook[1]:L.H,w=L.kind==="hang"?L.hook[0]:(L.deckX?L.deckX[1]:2),g=[];for(let x=0;x<w;x+=1)g.push(seg([x,y],[Math.min(w,x+1),y]));g.push(seg([0,y+2],[w,y]),seg([0,y+1],[w/2,y]));return g;}}};
function ideaGhost(id,L){return IDEAS[id]?IDEAS[id].g(L):[];}
// ---------------- drawing ----------------
function view(cv,L){let x0=-2.5,x1=L.S+2.5,y0=-.8,y1=(L.H||0)+2.5;if(L.kind==="span"){y0=-4.6;y1=3.6;}if(L.kind==="hang"){y1=L.hook[1]+2;x1=Math.max(x1,L.hook[0]+2);}if(L.kind==="roof"){y1=L.H+3;}if(L.wall){x0=-1.5;}
  const W_=cv.width,H_=cv.height,sc=Math.min(W_/(x1-x0),H_/(y1-y0));const ox=(W_-(x1-x0)*sc)/2-x0*sc,oy=H_-((H_-(y1-y0)*sc)/2)+y0*sc;return {sc,X:x=>ox+x*sc,Y:y=>oy-y*sc,ix:px=>(px-ox)/sc,iy:py=>(oy-py)/sc,x0,x1,y0,y1};}
function drawScene(x,v,L){const cv=x.canvas;x.fillStyle="#cfe8f5";x.fillRect(0,0,cv.width,cv.height);
  x.strokeStyle="rgba(40,70,100,.1)";x.lineWidth=1;for(let gx=Math.ceil(v.x0/SNAP)*SNAP;gx<=v.x1;gx+=SNAP){x.beginPath();x.moveTo(v.X(gx),0);x.lineTo(v.X(gx),cv.height);x.stroke();}
  for(let gy=Math.ceil(v.y0/SNAP)*SNAP;gy<=v.y1;gy+=SNAP){x.beginPath();x.moveTo(0,v.Y(gy));x.lineTo(cv.width,v.Y(gy));x.stroke();}
  const dirt="#7a6a52",grass="#5f9a46",rect=(a,b,c,d,col)=>{x.fillStyle=col;x.fillRect(v.X(a),v.Y(d),v.X(c)-v.X(a),v.Y(b)-v.Y(d));};
  if(L.kind==="span"){rect(0,-4.6,L.S,-3.6,"#4f8fc8");rect(v.x0,-4.6,0,0,dirt);rect(L.S,-4.6,v.x1,0,dirt);rect(v.x0,-.08,0,0,grass);rect(L.S,-.08,v.x1,0,grass);}
  else if(L.wall){rect(-1.5,v.y0,0,v.y1,"#b2603e");x.strokeStyle="rgba(0,0,0,.25)";for(let yy=Math.ceil(v.y0);yy<v.y1;yy+=.5){x.beginPath();x.moveTo(v.X(-1.5),v.Y(yy));x.lineTo(v.X(0),v.Y(yy));x.stroke();}rect(0,v.y0,v.x1,0,dirt);rect(0,-.08,v.x1,0,grass);}
  else{rect(v.x0,v.y0,v.x1,0,dirt);rect(v.x0,-.08,v.x1,0,grass);}
  if(L.kind==="ramp")rect(L.S,0,v.x1,L.H,"#b8a88a");
  if(L.kind==="roof"&&L.base!=="ground"){rect(-.4,0,0,L.H,"#d9c7a6");rect(L.S,0,L.S+.4,L.H,"#d9c7a6");if(L.mid)rect(L.S/2-.2,0,L.S/2+.2,L.H,"#d9c7a6");}
  x.font="600 12px system-ui";x.fillStyle="#2a3a4a";
  if(L.kind==="span")x.fillText(`${L.S} m`,v.X(L.S/2)-12,v.Y(-3.9));if(L.kind==="ramp")x.fillText(`step ${L.H} m`,v.X(L.S)+6,v.Y(L.H)-6);
  if(L.kind==="platform"||(L.kind==="roof"&&L.base==="ground")){x.setLineDash([6,5]);x.strokeStyle="#2f6fa8";x.beginPath();x.moveTo(v.X(L.deckX?L.deckX[0]:v.x0),v.Y(L.H));x.lineTo(v.X(L.deckX?L.deckX[1]:v.x1),v.Y(L.H));x.stroke();x.setLineDash([]);x.fillStyle="#2f6fa8";x.fillText(`${L.H} m`,v.X(L.deckX?L.deckX[0]:v.x0)+4,v.Y(L.H)-5);}
  if(L.kind==="hang"){const hx=v.X(L.hook[0]),hy=v.Y(L.hook[1]);x.strokeStyle="#c8432f";x.lineWidth=2;x.beginPath();x.arc(hx,hy,9,0,7);x.stroke();x.fillStyle="#c8432f";x.fillText("hook",hx+12,hy-8);}
  anchors(L).forEach(([ax,ay])=>{x.fillStyle="#3a3d44";x.beginPath();x.arc(v.X(ax),v.Y(ay),5,0,7);x.fill();});}
function drawIdea(cv,L,id){const x=cv.getContext("2d"),v=view(cv,L);drawScene(x,v,L);}
function stressColor(m){const r=Math.min(1,Math.abs(m.F)/(m.F>0?m.T:m.C||1));const c=r<.5?[60+r*2*190,190,70]:[250,190-(r-.5)*2*170,50];return `rgb(${c.map(Math.round).join(",")})`;}
function drawBar(x,v,a,b,mt,sel){x.strokeStyle=mt.color;x.lineWidth=Math.max(3,mt.w*v.sc/36);x.lineCap="round";if(mt.rope)x.setLineDash([3,3]);x.beginPath();x.moveTo(v.X(a[0]),v.Y(a[1]));x.lineTo(v.X(b[0]),v.Y(b[1]));x.stroke();x.setLineDash([]);
  if(sel){x.strokeStyle="rgba(255,216,74,.9)";x.lineWidth=2;x.beginPath();x.moveTo(v.X(a[0]),v.Y(a[1]));x.lineTo(v.X(b[0]),v.Y(b[1]));x.stroke();}}
function draw(cv,W,L,sim,idea,ui){const x=cv.getContext("2d"),v=view(cv,L);drawScene(x,v,L);
  if(sim){for(const m of sim.ms){if(m.broken)continue;drawBar(x,v,[m.a.x,m.a.y],[m.b.x,m.b.y],m.mt);x.strokeStyle=stressColor(m);x.lineWidth=Math.max(1.5,m.mt.w*v.sc/90);x.beginPath();x.moveTo(v.X(m.a.x),v.Y(m.a.y));x.lineTo(v.X(m.b.x),v.Y(m.b.y));x.stroke();}
    for(const m of sim.ms){if(!m.broken)continue;x.strokeStyle="rgba(200,40,30,.75)";x.lineWidth=2;x.setLineDash([4,4]);x.beginPath();x.moveTo(v.X(m.a.x),v.Y(m.a.y));x.lineTo(v.X((m.a.x+m.b.x)/2),v.Y((m.a.y+m.b.y)/2-.15));x.stroke();x.setLineDash([]);}
    for(const n of sim.ns){if(n.loose)continue;x.fillStyle=n.anchor?(n.glue?n.glue.color:"#3a3d44"):n.glue.color;x.strokeStyle="#222";x.beginPath();x.arc(v.X(n.x),v.Y(n.y),n.anchor?6:5,0,7);x.fill();x.stroke();}}
  else{for(const p of W.pieces)drawBar(x,v,[p.x1,p.y1],[p.x2,p.y2],MATS[p.mat],ui.sel===p.id);
    const glued=new Set();W.joints.forEach(j=>j.ends.forEach(([id,e])=>glued.add(id+":"+e)));
    for(const p of W.pieces)for(const e of [0,1]){if(glued.has(p.id+":"+e))continue;const [ex,ey]=endXY(p,e);x.strokeStyle="#222";x.fillStyle="#fff";x.lineWidth=1.5;x.beginPath();x.arc(v.X(ex),v.Y(ey),4.5,0,7);x.fill();x.stroke();}
    for(const j of W.joints){x.fillStyle=GLUES[j.glue].color;x.strokeStyle="#222";x.lineWidth=1.5;x.beginPath();x.arc(v.X(j.x),v.Y(j.y),6.5,0,7);x.fill();x.stroke();}
    const sp=W.pieces.find(p=>p.id===ui.sel);if(sp){x.fillStyle="#222";x.font="600 12px system-ui";x.fillText(plen(sp).toFixed(1)+" m",v.X((sp.x1+sp.x2)/2)+6,v.Y((sp.y1+sp.y2)/2)-8);}
    if(ui.hover){x.strokeStyle=ui.tool==="glue"?"#c99a1a":"#222";x.lineWidth=1;x.beginPath();x.arc(v.X(ui.hover.rx),v.Y(ui.hover.ry),ui.tool==="glue"?12:6,0,7);x.stroke();}}
  if(sim){const c=sim.load;x.font="600 12px system-ui";
    if(c.cart){const cx=v.X(c.x),cy=v.Y(c.y);x.fillStyle=L.kind==="ramp"?"#3f6fa8":"#b5482f";x.fillRect(cx-v.sc*.45,cy-v.sc*.6,v.sc*.9,v.sc*.42);x.fillStyle="#333";x.beginPath();x.arc(cx-v.sc*.28,cy-v.sc*.14,v.sc*.14,0,7);x.arc(cx+v.sc*.28,cy-v.sc*.14,v.sc*.14,0,7);x.fill();x.fillStyle="#222";x.fillText(`${c.w} kg`,cx-14,cy-v.sc*.7);}
    else if(L.kind==="platform"&&c.x!==undefined){const cx=v.X(c.x),cy=v.Y(c.y);x.fillStyle="#3f6fa8";x.fillRect(cx-v.sc*.6,cy-v.sc*1,v.sc*1.2,v.sc*1);x.fillStyle="#fff";x.fillText(`${c.w} kg`,cx-16,cy-v.sc*.45);}
    else if(L.kind==="hang"&&sim.hook){const cx=v.X(sim.hook.x),cy=v.Y(sim.hook.y);x.strokeStyle="#333";x.lineWidth=2;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx,cy+v.sc*.8);x.stroke();x.fillStyle="#6b4a2c";x.fillRect(cx-v.sc*.35,cy+v.sc*.8,v.sc*.7,v.sc*.5);x.fillStyle="#fff";x.fillText(`${c.w} kg`,cx-14,cy+v.sc*1.15);}
    const w=windNow(sim);if(w>0){x.strokeStyle="#5a8ab0";x.lineWidth=2;for(let i=0;i<4;i++){const yy=30+i*16;x.beginPath();x.moveTo(10,yy+20);x.lineTo(10+w/25,yy+20);x.stroke();}x.fillStyle="#2a4a6a";x.fillText(`wind ${Math.round(w)} N`,8,40);}
    if(L.kind==="roof"&&(L.rain||0)>0){x.strokeStyle="rgba(60,110,180,.5)";x.lineWidth=1;for(let i=0;i<30;i++){const rx=(i*53+sim.t*400)%cv.width,ry=(i*97+sim.t*600)%cv.height;x.beginPath();x.moveTo(rx,ry);x.lineTo(rx-3,ry+9);x.stroke();}}}}
// ---------------- hands on: place, size, drag, turn, glue ----------------
// Place: pick a material, type its length, click where it should start (it lies flat; drag its loose end to turn it).
// Drag a piece by its middle to move it; drag an end to turn it (the length stays). Glue: click where ends touch.
function pt(cv,e,L){const r=cv.getBoundingClientRect(),v=view(cv,L);const px=(e.clientX-r.left)*cv.width/r.width,py=(e.clientY-r.top)*cv.height/r.height;return {x:g2(v.ix(px)),y:g2(v.iy(py)),rx:v.ix(px),ry:v.iy(py),sc:v.sc};}
function okPoint(L,p){if(L.kind==="span"){if((p.x<0||p.x>L.S)&&p.y<0)return false;return p.y>=-3.5;}if(L.wall&&p.x<0)return false;if(L.kind==="ramp"&&p.x>L.S&&p.y<L.H)return false;return p.y>=0;}
function segDp(px,py,p){const dx=p.x2-p.x1,dy=p.y2-p.y1;const t=clamp01(((px-p.x1)*dx+(py-p.y1)*dy)/(dx*dx+dy*dy||1));return {d:Math.hypot(px-p.x1-dx*t,py-p.y1-dy*t),t};}
function unglue(W,id){W.joints.forEach(j=>j.ends=j.ends.filter(([pid])=>pid!==id));W.joints=W.joints.filter(j=>j.ends.length+(j.anchor?1:0)>=2||j.ends.length>=1&&j.anchor);}
function snapEnd(W,L,p,e){const [ex,ey]=endXY(p,e);let best=null,bd=.3;
  anchors(L).forEach(([ax,ay])=>{const d=Math.hypot(ax-ex,ay-ey);if(d<bd){bd=d;best=[ax,ay];}});
  W.pieces.forEach(q=>{if(q===p)return;for(const f of [0,1]){const [qx,qy]=endXY(q,f);const d=Math.hypot(qx-ex,qy-ey);if(d<bd){bd=d;best=[qx,qy];}}});
  if(!best){best=[g2(ex),g2(ey)];if(Math.hypot(best[0]-ex,best[1]-ey)>.2)return;}if(e){p.x2=best[0];p.y2=best[1];}else{p.x1=best[0];p.y1=best[1];}}
function down(W,L,p,ui){const tool=ui.tool;
  if(tool==="erase"){let best=null,bd=.35;for(const q of W.pieces){const d=segDp(p.rx,p.ry,q).d;if(d<bd){bd=d;best=q;}}if(best){unglue(W,best.id);W.pieces.splice(W.pieces.indexOf(best),1);ui.sel=null;return {changed:true};}
    const j=W.joints.find(j=>Math.hypot(j.x-p.rx,j.y-p.ry)<.3);if(j){W.joints.splice(W.joints.indexOf(j),1);return {changed:true,msg:"Joint unglued."};}return {};}
  if(tool==="glue"){const r=.3;const ex=W.joints.find(j=>Math.hypot(j.x-p.rx,j.y-p.ry)<r);if(ex){ex.glue=ui.joint;return {changed:true,msg:`Joint changed to ${GLUES[ui.joint].name.toLowerCase()}.`};}
    const ends=[];W.pieces.forEach(q=>[0,1].forEach(e=>{const [x,y]=endXY(q,e);if(Math.hypot(x-p.rx,y-p.ry)<r)ends.push([q,e,x,y]);}));const an=anchorAt(L,p.rx,p.ry,r);
    const free=ends.filter(([q,e])=>!W.joints.some(j=>j.ends.some(([id,f])=>id===q.id&&f===e)));
    if(free.length+(an?1:0)<2&&!(free.length>=1&&an))return {msg:ends.length?"Glue joins two things that touch: put another end (or a fixed dark point) right here first.":"Click right where piece ends touch."};
    const jx=an?an[0]:free[0][2],jy=an?an[1]:free[0][3];free.forEach(([q,e])=>{if(e){q.x2=jx;q.y2=jy;}else{q.x1=jx;q.y1=jy;}});
    W.joints.push({x:jx,y:jy,glue:ui.joint,ends:free.map(([q,e])=>[q.id,e]),anchor:!!an});return {changed:true};}
  // a press: wait to see if it's a click (place a new piece here) or a drag (turn the piece by its end, or move it by its middle)
  let tgt=null;for(const q of W.pieces)for(const e of [0,1]){const [x,y]=endXY(q,e);if(!tgt&&Math.hypot(x-p.rx,y-p.ry)<.25)tgt={kind:"end",q,e};}
  if(!tgt)for(const q of W.pieces){if(segDp(p.rx,p.ry,q).d<.2){tgt={kind:"move",q};break;}}
  ui.press={p,tgt,dragging:false};return {};}
function place(W,L,p,ui){const mt=MATS[ui.tool];if(!mt||!okPoint(L,p))return null;let len=Math.max(.5,Math.min(mt.max,ui.len||mt.max));len=g2(len);
  const q={id:PID++,mat:ui.tool,x1:p.x,y1:p.y,x2:p.x+len,y2:p.y};W.pieces.push(q);ui.sel=q.id;return q;}
function move(W,L,p,ui){ui.hover=p;const pr=ui.press;
  if(pr&&!pr.dragging&&Math.hypot(p.rx-pr.p.rx,p.ry-pr.p.ry)>.18){pr.dragging=true;const t=pr.tgt;
    if(t&&t.kind==="end"){unglue(W,t.q.id);ui.sel=t.q.id;ui.drag={kind:"end",q:t.q,e:t.e};}
    else if(t&&t.kind==="move"){unglue(W,t.q.id);ui.sel=t.q.id;ui.drag={kind:"move",q:t.q,ox:pr.p.rx,oy:pr.p.ry,p0:[t.q.x1,t.q.y1,t.q.x2,t.q.y2]};}
    else{const q=place(W,L,pr.p,ui);if(q)ui.drag={kind:"end",q,e:1};}}
  const d=ui.drag;if(!d)return {};
  if(d.kind==="end"){const q=d.q,len=plen(q),[ax,ay]=endXY(q,1-d.e);let ang=Math.atan2(p.ry-ay,p.rx-ax);const st=Math.PI/24;ang=Math.round(ang/st)*st;const nx=ax+Math.cos(ang)*len,ny=ay+Math.sin(ang)*len;if(d.e){q.x2=nx;q.y2=ny;}else{q.x1=nx;q.y1=ny;}}
  else{const q=d.q,dx=g2(p.rx-d.ox),dy=g2(p.ry-d.oy);q.x1=d.p0[0]+dx;q.y1=d.p0[1]+dy;q.x2=d.p0[2]+dx;q.y2=d.p0[3]+dy;}return {changed:false};}
function up(W,L,p,ui){const pr=ui.press;ui.press=null;const d=ui.drag;ui.drag=null;
  if(pr&&!pr.dragging){if(pr.tgt&&pr.tgt.kind==="move"){ui.sel=pr.tgt.q.id;return {changed:false};}const at=pr.tgt&&pr.tgt.kind==="end"?(()=>{const [x,y]=endXY(pr.tgt.q,pr.tgt.e);return {x,y,rx:x,ry:y};})():pr.p;const q=place(W,L,at,ui);return q?{changed:true}:{};}
  if(!d)return {};if(d.kind==="end")snapEnd(W,L,d.q,d.e);else{snapEnd(W,L,d.q,0);const q=d.q;const dx=q.x1-d.p0[0]-g2(p.rx-d.ox),dy=q.y1-d.p0[1]-g2(p.ry-d.oy);q.x2+=dx;q.y2+=dy;}return {changed:true};}
function setLen(W,L,ui,len){const q=W.pieces.find(p=>p.id===ui.sel);ui.len=len;if(!q)return {};const mt=MATS[q.mat];len=Math.max(.5,Math.min(mt.max,len));const a=Math.atan2(q.y2-q.y1,q.x2-q.x1);unglue(W,q.id);q.x2=q.x1+Math.cos(a)*len;q.y2=q.y1+Math.sin(a)*len;return {changed:true,msg:len<ui.len?`A ${mt.name.toLowerCase()} can be at most ${mt.max} m long.`:""};}
function tools(){return {main:Object.entries(MATS).map(([id,m])=>({id,name:m.name,color:m.color,price:m.cost+"/m",what:m.what,len:m.max})).concat([{id:"glue",name:"Glue",color:"#f0d070",what:"Click where piece ends touch (or an end touches a dark fixed point) to join them."},{id:"erase",name:"Remove",color:"#c33",what:"Click a piece to take it away, or a joint to unglue it."}]),
  joint:Object.entries(GLUES).map(([id,g])=>({id,name:g.name,color:g.color,price:g.cost?g.cost+" each":"free",what:g.what})),jointLabel:"Glue type:",defTool:"stick",defJoint:"glue",lengthInput:true};}
function info(L){const T={span:()=>`A cart of ${L.load} kg must roll across the ${L.S} m gap on planks.`,ramp:()=>`A wheelchair (${L.load} kg) must roll up planks onto the ${L.H} m step.`,
  platform:()=>`${L.load} kg must sit on a level plank floor at least ${L.H} m up${L.deckX?` between ${L.deckX[0]} and ${L.deckX[1]} m`:""}${L.wind?`, with wind up to ${L.wind} N`:""}.`,
  roof:()=>`Planks must cover all ${L.S} m at least ${L.H} m up, through ${L.gust?"hurricane gusts":"wind"} up to ${L.wind||0} N${L.rain?` and ${L.rain} kg of ${L.snow?"snow":"rain"} per meter`:""}.`,
  hang:()=>`${L.load} kg hangs from whatever is glued at the red hook (${L.hook[0]} m across, ${L.hook[1]} m up)${L.wind?`, with wind up to ${L.wind} N`:""}.`};return T[L.kind]()+" Dark dots are fixed points on the wall or ground.";}
// for the solvability check: build an idea's outline as glued pieces
function splitAll(segs){const pts=[];segs.forEach(([a,b,c,d])=>pts.push([a,b],[c,d]));const out=[];
  segs.forEach(([a,b,c,d,hint])=>{if(hint==="rope"){out.push([a,b,c,d,hint]);return;}const L=Math.hypot(c-a,d-b);if(L<.01)return;const on=pts.map(([x,y])=>{const t=((x-a)*(c-a)+(y-b)*(d-b))/(L*L);const px=a+(c-a)*t,py=b+(d-b)*t;return Math.hypot(px-x,py-y)<.01&&t>.001&&t<.999?t:null;}).filter(t=>t!==null);
    const ts=[0,...[...new Set(on.map(t=>+t.toFixed(4)))].sort((x,y)=>x-y),1];for(let i=0;i<ts.length-1;i++)out.push([a+(c-a)*ts[i],b+(d-b)*ts[i],a+(c-a)*ts[i+1],b+(d-b)*ts[i+1]].map(v=>+v.toFixed(4)));});return out;}
function build(L,ideaId,mat,joint,overrides){const W=init(L);splitAll(ideaGhost(ideaId,L)).forEach(([a,b,c,d,hint])=>{const horiz=Math.abs(b-d)<.01;let m=hint||mat;if(hint){W.pieces.push({id:PID++,mat:m,x1:a,y1:b,x2:c,y2:d});return;}
    const deckY=L.kind==="span"?0:L.kind==="ramp"||L.kind==="hang"?null:L.H;if(horiz&&deckY!==null&&Math.abs(b-deckY)<.01)m="plank";
    if(L.kind==="ramp"&&c>a&&Math.abs((d-b)/(c-a)-L.H/L.S)<.02)m="plank";
    if(L.kind==="roof"&&b>=L.H-.01&&d>=L.H-.01&&(horiz||Math.abs(c-a)>.4))m="plank";
    if(overrides)m=overrides(m,[a,b,c,d])||m;if(Math.hypot(c-a,d-b)>MATS[m].max+.01||Math.hypot(c-a,d-b)<.1)return;W.pieces.push({id:PID++,mat:m,x1:a,y1:b,x2:c,y2:d});});
  const pts={};W.pieces.forEach(p=>[0,1].forEach(e=>{const [x,y]=endXY(p,e);const k=x.toFixed(3)+","+y.toFixed(3);(pts[k]=pts[k]||[]).push([p.id,e]);}));
  for(const k in pts){const [x,y]=k.split(",").map(Number);const an=anchorAt(L,x,y,.01);if(pts[k].length+(an?1:0)>=2)W.joints.push({x,y,glue:joint,ends:pts[k],anchor:!!an});}return W;}
window.ENG=window.ENG||{};
window.ENG.struct={name:"Workshop",tools,init,ser,de,cost,start,step,judge,explain,draw,drawIdea,ideas:id=>IDEAS[id],pt,down,move,up,setLen,info,build,MATS,GLUES,canvasRatio:.5};
})();
