// Elementum — the Schola's design challenges (Barbara, 2026-11-21). The way real engineers work:
//   1 Ask     — be curious: ask the neighbors about their problem; every answer goes in your notebook
//   2 Frame   — say who has the problem, what they need, what makes it hard, and how you'll know it works
//   3 Research— short lessons (the ones you need most come first), and the Bibliotheca for anything else
//   4 Pick    — choose a design idea; its outline is drawn on the workshop grid as a guide
//   5 Build   — put it together from wood, planks, rope, iron and stone, joined with paste, glue, pitch or nails, then test it
// The test is a real physics simulation (XPBD: every piece is a stiff spring with a breaking force; gravity, the cart or the tank,
// and wind). When something breaks, Magistra Cornelia says which piece, whether it was pulled or squeezed, and what to try.
// What you keep getting wrong is remembered (localStorage) so the teacher and the lesson list adapt to you.
window.DESIGN=(function(){
const $=s=>document.querySelector(s);const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const MATS={
  stick:{name:"Wood stick",color:"#c08a4e",w:4,kgm:1.2,k:3e5,T:4000,C:3000,cost:2,max:3,what:"Light and cheap. Snaps if pulled too hard; long sticks bend sideways (buckle) when squeezed."},
  plank:{name:"Plank",color:"#8a5a2e",w:9,kgm:4,k:4e5,T:4500,C:3500,cost:4,max:3,deck:true,what:"The road: the cart can only roll on planks. Heavier than a stick."},
  rope:{name:"Rope",color:"#e0c88a",w:2,kgm:.3,k:2e5,T:4200,C:0,cost:1,max:8,rope:true,what:"Very strong when pulled (tension). Goes floppy when pushed — it can't hold anything up from below."},
  iron:{name:"Iron bar",color:"#8b96a4",w:4,kgm:6,k:1.6e6,T:14000,C:10000,cost:10,max:3,what:"Strong both ways — but heavy and expensive."},
  stone:{name:"Stone block",color:"#b0aca2",w:11,kgm:18,k:2e6,T:400,C:30000,cost:3,max:1.5,nobuckle:true,what:"Heavy. Hugely strong when squeezed (compression), cracks when pulled. Perfect for arches."}};
const GLUES={
  paste:{name:"Flour paste",S:1800,cost:0,color:"#f4efe2",what:"Flour + water. Free, but weak."},
  glue:{name:"Wood glue",S:4500,cost:1,color:"#f0d070",what:"Good, strong joints for wood."},
  pitch:{name:"Pine pitch",S:6500,cost:2,color:"#3a2614",what:"The Romans' sticky resin, cooked from pine sap."},
  nails:{name:"Iron nails",S:9500,cost:3,color:"#5a5f68",what:"The strongest joint."}};
const ANCHOR_S=60000,G=9.81;
// ---------------- the challenges ----------------
const LEVELS={bridge:[{span:6,load:150,budget:110},{span:8,load:220,budget:180},{span:10,load:300,budget:320}],
  tower:[{h:4,load:200,wind:400,budget:110},{h:5,load:300,wind:600,budget:180},{h:6,load:400,wind:800,budget:200}]};
const CH={
  bridge:{title:"The footbridge over the creek",who:"Rufus and Sabina, at the creek in the park",
    facts:L=>[["How wide is the creek?",`From bank to bank it's ${L.span} meters.`],["What has to cross it?",`Us, pushing a hand-cart of shopping — about ${L.load} kg all together.`],
      ["Why did the old bridge fall?","It was just long planks lying across. They bent more and more in the middle until — crack!"],["What can we build it with?",`Wood sticks, planks, rope, iron bars and stone blocks from the builders' yard. The city gives ${L.budget} denarii.`],
      ["Can it rest in the water?","No — the creek floods in spring and washes everything away. It has to hang from the banks."]],
    frame:L=>({who:{q:"Who has the problem?",o:["The neighbors who cross the creek to get to the market","The fish in the creek","The guards at the gate"],a:[0],why:"The people who need to cross are the ones with the problem — they're who we're designing for."},
      need:{q:"What do they need?",o:["A safe way across the creek, even with a loaded cart","A taller fountain","A new statue for the park"],a:[0],why:"They need to get across safely, carrying things. That's the need — a bridge is just one way to meet it."},
      hard:{q:"What makes it hard? (pick all that are true)",multi:true,o:[`The creek is ${L.span} m wide`,`It must hold ${L.load} kg`,`We can spend only ${L.budget} denarii`,"It must be painted red","Nothing can stand in the water"],a:[0,1,2,4],why:"Those are the constraints: the facts our design must work within. Painting it red was never asked for!"},
      test:{q:"How will we know it works?",o:["A loaded cart rolls all the way across and nothing breaks","It looks pretty","It's the biggest bridge in the city"],a:[0],why:"A good test is something you can actually check. 'Pretty' and 'biggest' don't tell us if people can cross safely."}}),
    research:["forces","triangles","buckle","glue","arch","susp","beam"],
    designs:L=>[{id:"beam",name:"Beam bridge",note:"Planks straight across. Simple and cheap — but a long plank bends and breaks in the middle.",ghost:ghostBeam(L.span)},
      {id:"truss",name:"Truss bridge",note:"Triangles above the deck share the load. Triangles can't fold, so it stays stiff.",ghost:ghostTruss(L.span)},
      {id:"arch",name:"Arch bridge",note:"Stone blocks in a curve under the deck. Each block pushes on the next — stone loves being squeezed.",ghost:ghostArch(L.span)},
      {id:"susp",name:"Suspension bridge",note:"Towers at each bank, ropes hang the deck. Rope is strong when pulled.",ghost:ghostSusp(L.span)}]},
  tower:{title:"A tower for the water tank",who:"Hortensia and Kaeso, by their house",
    facts:L=>[["What happened to the tank?","The old wooden legs rotted and leaned over in the wind. Now it leaks everywhere!"],["How high must the tank be?",`At least ${L.h} meters up, so the water runs down the pipe into the kitchen.`],
      ["How heavy is it full?",`About ${L.load} kg. Water is heavy — one liter weighs one kilogram!`],["Is it windy here?","Very! The wind pushes the top sideways — the old tower wobbled like jelly."],
      ["How much can we spend?",`The street put together ${L.budget} denarii.`]],
    frame:L=>({who:{q:"Who has the problem?",o:["Hortensia and Kaeso, who need water in their kitchen","The birds on the roof","The baker next door"],a:[0],why:"The people who use the water are the ones the design is for."},
      need:{q:"What do they need?",o:["A tank held up high and steady, so water runs down to the kitchen","A bigger kitchen","A new well"],a:[0],why:"They need water pressure in the kitchen — that comes from the tank being high up and staying there."},
      hard:{q:"What makes it hard? (pick all that are true)",multi:true,o:[`The tank must be ${L.h} m up`,`The full tank weighs ${L.load} kg`,"The wind pushes it sideways",`We can spend only ${L.budget} denarii`,"It must be made of gold"],a:[0,1,2,3],why:"Height, weight, wind and money are the real constraints. Nobody asked for gold!"},
      test:{q:"How will we know it works?",o:["The full tank stays up at the right height, even in strong wind","It's the tallest thing in the street","It's finished quickly"],a:[0],why:"We test exactly what they need: the tank stays high and steady in the wind."}}),
    research:["forces","triangles","base","buckle","glue","heavy"],
    designs:L=>[{id:"legs",name:"Four straight legs",note:"Just posts holding a platform. Quick — but rectangles fold sideways in wind.",ghost:ghostLegs(L.h)},
      {id:"braced",name:"Braced tower",note:"Diagonal braces make triangles, so the wind can't fold it.",ghost:ghostBraced(L.h)},
      {id:"aframe",name:"Braced, with props",note:"A braced tower plus two props out to the sides: a wider base is much harder to tip over.",ghost:ghostA(L.h)}]}};
const LESSONS={
  forces:{t:"Pulled or squeezed?",x:"Every piece of a structure is either <b>pulled</b> (tension) or <b>squeezed</b> (compression). In a bridge, the bottom gets pulled and the top gets squeezed. Pick materials that are good at the job: rope and iron for pulling, stone and short wood for squeezing."},
  triangles:{t:"Triangles don't fold",x:"Push on the corner of a square made of sticks and it folds flat like a parallelogram. A triangle can't change shape unless a side breaks. That's why bridges, cranes and towers are full of triangles."},
  buckle:{t:"Long thin pieces buckle",x:"Squeeze a long spaghetti noodle from both ends and it bends sideways and snaps. Squeeze a short one and it's strong. Past about 2.5 m, twice as long = four times weaker when squeezed. Fix: shorter pieces, or brace the middle."},
  glue:{t:"Joints hold the pull",x:"When a piece is pulled, the glue at its ends must hold that pull too. A strong stick with weak glue still fails — at the joint. Squeezed pieces press the joint together, so the glue matters less there."},
  arch:{t:"Arches push outward",x:"In an arch, every block squeezes the next one, all the way down to the banks. Stone is super strong when squeezed, so stone arches can last 2,000 years — some Roman ones are still standing! The ends push outward, so they need solid ground."},
  susp:{t:"Hanging from ropes",x:"A suspension bridge hangs its deck from ropes or cables strung over tall towers. The ropes are pulled (perfect for rope); the towers are squeezed. The ropes must be tied down firmly at the ends."},
  beam:{t:"Why a long beam fails",x:"A plank across a gap bends: its top is squeezed and its bottom is stretched. The longer the gap, the more it bends — the force in the middle grows fast with length. Supports or a truss share the load."},
  base:{t:"A wide base stops tipping",x:"Wind pushes the top of a tower sideways. A tower with legs spread wide is much harder to tip than a narrow one — think of how you stand with your feet apart on a moving bus."},
  heavy:{t:"Water is heavy",x:"One liter of water weighs one kilogram. A small tank of 300 liters weighs as much as four grown-ups! Everything under it must carry that weight all the way down to the ground."}};
// ---------------- design outlines (ghost guides) ----------------
const g2=v=>Math.round(v*2)/2;function seg(a,b){return [g2(a[0]),g2(a[1]),g2(b[0]),g2(b[1])];}   // on the 0.5 m grid, so you can trace it exactly
function ghostBeam(S){const g=[];for(let x=0;x<S;x+=S/Math.ceil(S/3))g.push(seg([x,0],[Math.min(S,x+S/Math.ceil(S/3)),0]));return g;}
function ghostTruss(S){const n=Math.ceil(S/2),d=S/n,H=1.5,g=[];for(let i=0;i<n;i++){const a=i*d,b=a+d;g.push(seg([a,0],[b,0]));if(i>0)g.push(seg([a,0],[a,H]));if(i>0&&i<n-1)g.push(seg([a,H],[b,H]));
    if(i===0)g.push(seg([a,0],[b,H]));else if(i===n-1)g.push(seg([a,H],[b,0]));else g.push(i<n/2?seg([a,0],[b,H]):seg([a,H],[b,0]));}return g;}
function ghostArch(S){const g=[],ay=x=>g2(-2+Math.sin(x/S*Math.PI)*1.6);for(let x=0;x<S;x++){g.push(seg([x,ay(x)],[x+1,ay(x+1)]),seg([x,0],[x+1,0]));if(x>0)g.push(seg([x,0],[x,ay(x)]));
    g.push(x<S/2?seg([x,0],[x+1,ay(x+1)]):seg([x,ay(x)],[x+1,0]));}return g;}
function ghostSusp(S){const g=[],m=Math.ceil(S/1.5),d=S/m;g.push(seg([0,0],[0,2.5]),seg([S,0],[S,2.5]),seg([-1,0],[0,2.5]),seg([S+1,0],[S,2.5]));
  for(let i=0;i<m;i++)g.push(seg([i*d,0],[(i+1)*d,0]));const sag=x=>2.5-1.8*(1-Math.pow(2*x/S-1,2));for(let i=0;i<m;i++)g.push(seg([i*d,sag(i*d)],[(i+1)*d,sag((i+1)*d)]));for(let i=1;i<m;i++)g.push(seg([i*d,0],[i*d,sag(i*d)]));return g;}
function ghostLegs(H){const g=[];for(let i=0;i<H;i+=2){g.push(seg([0,i],[0,Math.min(H,i+2)]),seg([2,i],[2,Math.min(H,i+2)]));}g.push(seg([0,H],[2,H]));return g;}
function ghostBraced(H){const g=[];for(let i=0;i<H;i++){g.push(seg([0,i],[0,i+1]),seg([2,i],[2,i+1]),i%2?seg([2,i],[0,i+1]):seg([0,i],[2,i+1]));if(i)g.push(seg([0,i],[2,i]));}g.push(seg([0,H],[2,H]));return g;}
function ghostA(H){return ghostBraced(H).concat([seg([-1,0],[0,2]),seg([4,0],[2,2])]);}
// ---------------- saved progress + what the player struggles with ----------------
const SAVE_KEY="elementum.design";let S0;try{S0=JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");}catch(e){S0={};}
const ST=Object.assign({bridge:{},tower:{},prof:{frame:0,tension:0,compression:0,buckle:0,glue:0,fold:0,gap:0,tip:0,tries:0,solved:0}},S0);
const save=()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(ST));}catch(e){}};
const lvOf=id=>Math.min(2,ST[id].level||0),L=id=>LEVELS[id][lvOf(id)];
// ---------------- the workshop state ----------------
let cur=null,step="ask",openFlag=false,hooks={};   // cur: the challenge id
let W={nodes:[],members:[]},tool="stick",glue="glue",ghost=null,drag=null,sim=null,result=null,teacher="",hover=null;
const SNAP=.5;
function anchorsFor(id){const l=L(id);if(id==="bridge")return [[0,0],[l.span,0],[0,-2],[l.span,-2],[-1,0],[l.span+1,0],[0,-1],[l.span,-1]];return [[-1,0],[0,0],[1,0],[2,0],[3,0],[4,0]];}
function resetWork(){const id=cur;W={nodes:anchorsFor(id).map(([x,y])=>({x,y,anchor:true,glue:"anchor"})),members:[]};const s=ST[id];
  if(s.work&&s.work.lv===lvOf(id)){s.work.nodes.forEach(n=>{if(!n.anchor)W.nodes.push({x:n.x,y:n.y,glue:n.glue});});
    s.work.members.forEach(m=>{const a=findNode(m.ax,m.ay),b=findNode(m.bx,m.by);if(a&&b)W.members.push({a,b,mat:m.mat});});}}
function saveWork(){ST[cur].work={lv:lvOf(cur),nodes:W.nodes.map(n=>({x:n.x,y:n.y,anchor:!!n.anchor,glue:n.glue})),members:W.members.map(m=>({ax:m.a.x,ay:m.a.y,bx:m.b.x,by:m.b.y,mat:m.mat}))};save();}
const findNode=(x,y)=>W.nodes.find(n=>Math.abs(n.x-x)<.01&&Math.abs(n.y-y)<.01);
const mlen=m=>Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y);
function cost(){let c=0;W.members.forEach(m=>c+=Math.ceil(MATS[m.mat].cost*mlen(m)));W.nodes.forEach(n=>{if(!n.anchor&&W.members.some(m=>m.a===n||m.b===n))c+=GLUES[n.glue].cost;});return c;}
// ---------------- physics: XPBD springs ----------------
function startSim(){const id=cur,l=L(id);const ns=W.nodes.map(n=>({x:n.x,y:n.y,px:n.x,py:n.y,vx:0,vy:0,m:.3,anchor:n.anchor,glue:n.anchor?null:GLUES[n.glue],src:n,f:0}));
  const ms=W.members.map(m=>{const mt=MATS[m.mat],a=ns[W.nodes.indexOf(m.a)],b=ns[W.nodes.indexOf(m.b)],Ln=mlen(m);a.m+=mt.kgm*Ln/2;b.m+=mt.kgm*Ln/2;
    const C=mt.nobuckle?mt.C:mt.C*Math.min(1,Math.pow(2.5/Math.max(Ln,.01),2));
    return {a,b,L:Ln,mt,mat:m.mat,k:mt.k,T:Math.min(mt.T,a.glue?a.glue.S:ANCHOR_S,b.glue?b.glue.S:ANCHOR_S),Tm:mt.T,C,broken:false,F:0,src:m};});
  sim={ns,ms,t:0,load:id==="bridge"?{x:-1.6,y:0,on:null,w:l.load}:{w:l.load,wind:0},done:false,first:null,maxDisp:0,deadT:0};}
function deckAt(x){let best=null;for(const m of sim.ms){if(m.broken||!MATS[m.mat].deck)continue;const x0=Math.min(m.a.x,m.b.x),x1=Math.max(m.a.x,m.b.x);if(x<x0-.02||x>x1+.02||x1-x0<.05)continue;
    const t=(x-m.a.x)/(m.b.x-m.a.x);const y=m.a.y+(m.b.y-m.a.y)*t;if(!best||y>best.y)best={m,t:clamp01(t),y};}return best;}
const clamp01=v=>Math.max(0,Math.min(1,v));
function simStep(h){const id=cur,l=L(id),s=sim;s.t+=h;
  // outside forces: gravity, then the load
  for(const n of s.ns){if(n.anchor)continue;n.vy-=G*h;}
  if(id==="bridge"){const c=s.load;if(!c.fell&&!c.done){c.x+=1.1*h;
      if(c.x<0||c.x>l.span){c.on=null;c.y=0;if(c.x>l.span+1.2){c.done=true;}}
      else{const d=deckAt(c.x);if(!d){c.fell="gap";c.fx=c.x;}else{if(!c.on&&c.x<.4&&Math.abs(d.y)>.35){c.fell="entry";}c.on=d;c.y=d.y;const W_=c.w*G*Math.min(1,(c.x+.3)/.6),a=d.m.a,b=d.m.b;
          if(!a.anchor)a.vy-=W_*(1-d.t)/a.m*h;if(!b.anchor)b.vy-=W_*d.t/b.m*h;if(d.y<-3.4)c.fell="water";}}}
    else if(c.fell){c.vy=(c.vy||0)-G*h;c.y+=c.vy*h;}}
  else{const c=s.load;const top=tankDeck();c.wind=Math.min(l.wind,s.t>1.5?(s.t-1.5)/3*l.wind:0);
    if(s.t<=h*1.5&&!top){c.fell="notop";return;}
    if(top&&!c.fell){c.x=top.x;c.y=top.y;const parts=top.ms;parts.forEach(m=>{const W_=c.w*G*Math.min(1,s.t/1.2)/parts.length;[m.a,m.b].forEach(n=>{if(!n.anchor){n.vy-=W_/2/n.m*h;n.vx+=c.wind/parts.length/2/n.m*h;}});});
      if(top.y<l.h-.6)c.fell="low";}
    else if(!c.fell){c.fell="fell";}}
  for(const n of s.ns){if(n.anchor)continue;n.px=n.x;n.py=n.y;n.x+=n.vx*h;n.y+=n.vy*h;if(n.y<-4.2&&id==="bridge"){n.y=-4.2;n.vx*=.5;}if(id==="tower"&&n.y<0){n.y=0;n.vx*=.3;}}
  // members: a stiff spring each (XPBD), with the force it carries; past its limit it breaks
  for(const m of s.ms){if(m.broken)continue;const a=m.a,b=m.b;let dx=b.x-a.x,dy=b.y-a.y;const len=Math.hypot(dx,dy)||1e-6;const C=len-m.L;
    if(m.mt.rope&&C<0){m.F=0;continue;}const wa=a.anchor?0:1/a.m,wb=b.anchor?0:1/b.m,w=wa+wb;if(!w)continue;const al=1/(m.k/m.L)/(h*h);const dl=-C/(w+al);
    dx/=len;dy/=len;a.x-=wa*dl*dx;a.y-=wa*dl*dy;b.x+=wb*dl*dx;b.y+=wb*dl*dy;m.F=-dl/(h*h);   // m.F > 0: pulled (tension), < 0: squeezed
    const lim=m.F>0?m.T:m.C;if(Math.abs(m.F)>lim){m.broken=true;if(!s.first)s.first={m,kind:m.F>0?"tension":"compression",by:m.F>0&&m.T<m.Tm?"glue":(m.F<0&&!m.mt.nobuckle&&m.C<m.mt.C*.99?"buckle":"material"),F:Math.abs(m.F),lim};}}
  for(const n of s.ns){if(n.anchor)continue;n.vx=(n.x-n.px)/h*.9995;n.vy=(n.y-n.py)/h*.9995;s.maxDisp=Math.max(s.maxDisp,Math.hypot(n.x-n.src.x,n.y-n.src.y));}}
function tankDeck(){const l=L(cur);let best=null;const decks=sim.ms.filter(m=>!m.broken&&MATS[m.mat].deck&&Math.abs(m.a.y-m.b.y)<.6);
  if(!decks.length)return null;const top=Math.max(...decks.map(m=>(m.a.y+m.b.y)/2));const ms=decks.filter(m=>(m.a.y+m.b.y)/2>top-.3);
  const x=ms.reduce((s,m)=>s+(m.a.x+m.b.x)/2,0)/ms.length;return {ms,x,y:top};}
function judge(){const s=sim,l=L(cur),id=cur,c=s.load;
  if(id==="bridge"){if(c.done&&!s.first)return {ok:true};if(c.done&&s.first)return {ok:true,note:"It made it — but something broke on the way. Can you make it so nothing breaks?"};
    if(c.fell)return {ok:false};if(s.t>l.span/1.1+8)return {ok:false,stuck:true};return null;}
  if(c.fell)return {ok:false};if(s.t>8){if(s.first)return {ok:false};return {ok:true};}return null;}
// the teacher: what went wrong and what to try — and she remembers what you struggled with before
function explain(){const s=sim,c=s.load,P=ST.prof,id=cur;const f=s.first;let msg="",tag="";
  const name=m=>`${MATS[m.mat].name.toLowerCase()} (${m.L.toFixed(1)} m)`;
  if(f){const m=f.m;
    if(f.by==="glue"){tag="glue";msg=`The ${GLUES[(m.a.glue&&m.a.glue.S===m.T?m.a:m.b).src.glue].name.toLowerCase()} at the end of a ${name(m)} let go. That piece was being <b>pulled</b> with ${Math.round(f.F)} N, but the joint only holds ${Math.round(f.lim)} N. Try a stronger joint — pitch or nails — or share the pull between more pieces.`;}
    else if(f.kind==="tension"){tag="tension";msg=m.mat==="stone"?`A stone block cracked because it was <b>pulled</b> (${Math.round(f.F)} N). Stone is great when squeezed but weak when pulled. Use stone only where things push — like in an arch.`
      :`A ${name(m)} snapped because it was <b>pulled</b> too hard (tension: ${Math.round(f.F)} N, it can take ${Math.round(f.lim)} N). Pieces along the bottom of a bridge are pulled. Use rope or iron there, or add triangles so more pieces share the pull.`;}
    else if(f.by==="buckle"){tag="buckle";msg=`A ${name(m)} was <b>squeezed</b> and bent sideways — it buckled (${Math.round(f.F)} N, but at that length it can only take ${Math.round(f.lim)} N). Long thin pieces buckle. Make it shorter by adding a joint in the middle with a brace, or use iron or stone.`;}
    else{tag="compression";msg=`A ${name(m)} was <b>squeezed</b> until it broke (compression: ${Math.round(f.F)} N, it can take ${Math.round(f.lim)} N). Use stone or iron for pieces that get squeezed, or more pieces side by side.`;}}
  else if(c.fell==="gap"){tag="gap";msg=`The cart found nothing to roll on at ${c.fx.toFixed(1)} m. A bridge needs planks all the way across — no gaps, and joined end to end.`;}
  else if(c.fell==="entry"){tag="gap";msg="The cart couldn't get onto the bridge: the deck has to start level with the bank, right at the edge.";}
  else if(c.fell==="water"||c.fell==="low"||s.maxDisp>1.5){tag="fold";msg=id==="tower"?"Nothing broke, but the tower leaned and sagged until the tank dropped. Rectangles fold sideways — add diagonal braces to make triangles, or spread the legs wider."
      :"Nothing broke — but the bridge sagged so far the cart went into the water. Your shape can fold. Squares and single long pieces bend; triangles don't.";}
  else if(c.fell==="notop"){tag="gap";msg=`The tank needs a platform: put planks across the top, at least ${L(id).h} m up.`;}
  else if(c.fell==="fell"){tag="tip";msg="The tank fell off — the wind pushed the tower over. A wider base, braces from the legs to the ground, or a lower, heavier bottom keep it standing.";}
  else{tag="fold";msg="It didn't quite work. Watch the colors while it runs: red pieces are working hardest.";}
  if(tag){const before=P[tag]||0;P[tag]=before+1;if(before>=1)msg+=` <i>This happened before too — read the lesson “${LESSONS[{glue:"glue",tension:"forces",compression:"forces",buckle:"buckle",fold:"triangles",gap:"beam",tip:"base"}[tag]].t}” in Research.</i>`;}
  save();return msg;}
// ---------------- the panel ----------------
const STEPS=[["ask","1 Ask"],["frame","2 Frame"],["research","3 Research"],["pick","4 Pick a design"],["build","5 Build & test"]];
function unlocked(st){const s=ST[cur];return {ask:true,frame:(s.facts||[]).length>=3,research:!!s.framed,pick:!!s.framed&&(s.read||[]).length>=2,build:!!s.pick}[st];}
function open(id,o){hooks=o||{};cur=id;openFlag=true;const s=ST[id];if(s.next!==undefined){s.level=s.next;delete s.next;save();}step=s.solved?"build":s.pick?"build":s.framed?((s.read||[]).length>=2?"pick":"research"):(s.facts||[]).length>=3&&o&&o.at==="school"?"frame":"ask";
  if(o&&o.at==="creek"||o&&o.at==="house")step=step==="build"&&!s.solved?"build":(s.facts||[]).length<5?"ask":step;
  resetWork();sim=null;result=null;teacher="";$("#design").classList.remove("hidden");render();loop();}
// ---------------- the Bibliotheca: ask anything; the page is written for your grade from Google Search (server: /api/elementum/library) ----------------
const LIB_KEY="elementum.library";let LIB;try{LIB=JSON.parse(localStorage.getItem(LIB_KEY)||"{}");}catch(e){LIB={};}LIB.pages=LIB.pages||[];
const SHELVES=[["Science",["Why is the sky blue?","How do magnets work?","What makes a rainbow?","How do plants make their food?"]],["Space",["How big is the Sun?","Why does the Moon change shape?","What is a black hole?"]],
  ["Animals",["How do bees make honey?","Why do cats purr?","How do fish breathe underwater?"]],["Ancient Rome",["How did the Romans build aqueducts?","What did Roman children eat?","How were Roman roads built?"]],
  ["Math",["What is pi?","Why does a circle have 360 degrees?","Who invented the number zero?"]],["Inventions",["How does a lever work?","How does a pulley work?","Who invented the printing press?"]]];
const active=id=>(ST[id].facts||[]).length&&!ST[id].solved;
function forYou(){const out=[],P=ST.prof;
  if(active("bridge"))out.push("How do truss bridges work?","What are tension and compression?","How did the Romans build arch bridges?","How do suspension bridges stay up?");
  if(active("tower"))out.push("How do water towers work?","Why do towers need cross braces?","Why does a wide base stop things tipping over?");
  if(P.glue)out.push("Which is stronger, glue or nails?");if(P.buckle)out.push("Why do long thin columns buckle?");if(P.fold)out.push("Why are triangles the strongest shape?");if(P.tip)out.push("Why don't tall towers fall over in the wind?");
  if(!out.length)out.push("What is the engineering design process?","How are bridges built?","How do engineers test their ideas?");return [...new Set(out)].slice(0,7);}
const focusText=()=>[active("bridge")?"designing a footbridge across a creek from wood, rope, iron and stone":"",active("tower")?"designing a tower that holds a water tank up in the wind":""].filter(Boolean).join("; ");
function openLibrary(o){hooks=o||{};cur=null;openFlag=true;$("#design").classList.remove("hidden");libHome();}
function libHome(msg){const fy=forYou();let h=`<div class="dhead"><b>Bibliotheca — the library</b><button id="dClose">✕ Close</button></div><div class="dbody">
    <div class="libask"><input id="libQ" maxlength="140" placeholder="Ask the librarian anything…" autocomplete="off"><button id="libGo" class="go">Find a book</button></div>${msg?`<p class="bad">${esc(msg)}</p>`:""}
    <h3>For you</h3><div class="shelf">${fy.map(q=>`<button data-libq="${esc(q)}" class="fy">${esc(q)}</button>`).join("")}</div>
    ${SHELVES.map(([t,qs])=>`<h3>${esc(t)}</h3><div class="shelf">${qs.map(q=>`<button data-libq="${esc(q)}">${esc(q)}</button>`).join("")}</div>`).join("")}
    ${LIB.pages.length?`<h3>Your reading list</h3><div class="shelf">${LIB.pages.slice(-8).reverse().map(p=>`<button data-libq="${esc(p.q)}" class="read">${esc(p.title)}</button>`).join("")}</div>`:""}</div>
    <p class="teach"><b>Varro the librarian:</b> Every book here is written for you${hooks.grade?` (grade ${hooks.grade})`:""} from what Google finds on the web. The <i>For you</i> shelf is about what you're working on.</p>`;
  $("#designBody").innerHTML=h;$("#dClose").onclick=close;const go=()=>{const q=$("#libQ").value.trim();if(q.length>2)libAsk(q);};$("#libGo").onclick=go;$("#libQ").onkeydown=e=>{if(e.key==="Enter")go();};
  document.querySelectorAll("[data-libq]").forEach(b=>b.onclick=()=>libAsk(b.dataset.libq));}
function libAsk(q){$("#designBody").innerHTML=`<div class="dhead"><b>Bibliotheca — the library</b><button id="dClose">✕ Close</button></div><div class="dbody"><p class="tip">Varro is looking for a book about “${esc(q)}”…</p><div class="spin"></div></div>`;$("#dClose").onclick=close;
  fetch("/api/elementum/library",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({q,grade:hooks.grade||4,focus:focusText()})})
    .then(r=>r.json()).then(j=>{if(!openFlag||cur)return;if(!j||j.error){libHome(j&&j.error||"The library is closed right now.");return;}libPage(q,j);}).catch(()=>{if(openFlag&&!cur)libHome("Couldn't reach the library — are you on play.hardywu.com and signed in?");});}
function libPage(q,j){if(!LIB.pages.some(p=>p.q===q)){LIB.pages.push({q,title:j.title});LIB.pages=LIB.pages.slice(-40);try{localStorage.setItem(LIB_KEY,JSON.stringify(LIB));}catch(e){}}
  // reading about your problem counts as research for it in the Schola
  if(forYou().includes(q)||/bridge|tension|compression|triangle|arch|truss|suspension|tower|brace|tip|buckl|glue|nail|water tank/i.test(q))["bridge","tower"].forEach(id=>{if(active(id)){const s=ST[id];s.read=s.read||[];if(!s.read.includes("lib:"+q))s.read.push("lib:"+q);}});save();
  let h=`<div class="dhead"><b>${esc(j.title)}</b><button id="libBack">← Shelves</button><button id="dClose">✕ Close</button></div><div class="dbody book">${(j.paras||[]).map(p=>`<p>${esc(p)}</p>`).join("")}
    ${j.tryit?`<p class="tryit"><b>Try it:</b> ${esc(j.tryit)}</p>`:""}${(j.next||[]).length?`<h3>Curious? Ask next:</h3><div class="shelf">${j.next.map(n=>`<button data-libq="${esc(n)}">${esc(n)}</button>`).join("")}</div>`:""}
    ${(j.sources||[]).length?`<h3>Where this came from</h3><ul class="src">${j.sources.map(s=>`<li><a href="${esc(s.uri)}" target="_blank" rel="noopener noreferrer">${esc(s.title||"source")}</a></li>`).join("")}</ul>`:""}
    ${j.suggest?`<iframe class="gsug" sandbox="allow-popups allow-popups-to-escape-sandbox" title="Google search suggestions"></iframe>`:""}</div>`;
  $("#designBody").innerHTML=h;$("#dClose").onclick=close;$("#libBack").onclick=()=>libHome();document.querySelectorAll("[data-libq]").forEach(b=>b.onclick=()=>libAsk(b.dataset.libq));
  const fr=document.querySelector(".gsug");if(fr)fr.srcdoc=`<base target="_blank">${j.suggest}`;}
// inside the Schola: Magistra Cornelia's board of challenges — each says what to do next
function openSchool(o){hooks=o||{};cur=null;openFlag=true;$("#design").classList.remove("hidden");
  let h=`<div class="dhead"><b>Schola — Magistra Cornelia's class</b><button id="dClose">✕ Close</button></div><div class="dbody"><p class="tip">Engineers solve real people's problems. First be curious: find the neighbors who have a problem and ask them about it. Then come back here to frame it, research it, design, build and test.</p><div class="chs">`;
  for(const id in CH){const s=ST[id],n=(s.facts||[]).length,l=L(id);const where=id==="bridge"?"Rufus and Sabina, at the creek in the park (east end of the main street)":"Hortensia and Kaeso, in the yard behind the houses south of the main street";
    const status=s.solved?`Solved — now try level ${lvOf(id)+1}${s.level>2?"":""}.`:n>=3?(s.framed?"Framed — keep going!":"Ready to frame the problem."):`First ask ${where} about it (${n}/3 questions).`;
    h+=`<button data-ch="${id}" ${n>=3?"":"disabled"}><b>${esc(CH[id].title)}</b><small>Level ${lvOf(id)+1} · ${esc(status)}</small></button>`;}
  h+=`</div></div><p class="teach" id="dTeach"><b>Magistra Cornelia:</b> ${ST.prof.solved?"Welcome back, engineer! Pick a challenge.":"Welcome! Have you heard the neighbors talking? Some of them have problems we could solve."}</p>`;
  $("#designBody").innerHTML=h;$("#dClose").onclick=close;document.querySelectorAll("[data-ch]").forEach(b=>b.onclick=()=>open(b.dataset.ch,Object.assign({},hooks,{at:"school"})));}
function close(){if(cur&&ST[cur].next!==undefined){ST[cur].level=ST[cur].next;delete ST[cur].next;save();}openFlag=false;sim=null;$("#design").classList.add("hidden");if(cur)saveWork();if(hooks.onClose)hooks.onClose();}
function say(t){teacher=t;const el=$("#dTeach");if(el)el.innerHTML=t?`<b>Magistra Cornelia:</b> ${t}`:"";}
function render(){const id=cur,s=ST[id],l=L(id),ch=CH[id];
  let h=`<div class="dhead"><b>${esc(ch.title)}</b><span class="lv">Level ${lvOf(id)+1}</span><button id="dClose">✕ Close</button></div><div class="dsteps">${STEPS.map(([k,t])=>`<button data-step="${k}" class="${k===step?"on":""}" ${unlocked(k)?"":"disabled"}>${t}</button>`).join("")}</div>`;
  h+=`<div class="dbody">`;
  if(step==="ask"){const facts=ch.facts(l);h+=`<p class="tip">${esc(ch.who)} are talking about it. Be curious — ask them questions. Every answer goes in your notebook.</p><div class="qs">`;
    facts.forEach(([q,a],i)=>{const got=(s.facts||[]).includes(i);h+=`<button data-ask="${i}" class="${got?"got":""}">${esc(q)}</button>${got?`<p class="ans">“${esc(a)}”</p>`:""}`;});
    h+=`</div>`;const n=(s.facts||[]).length;h+=n>=3?`<p class="ok">Good questions! ${hooks.at==="school"?"":"Now go to the <b>Schola</b> (the school, north of the main street) to frame the problem with Magistra Cornelia."}</p>${hooks.at==="school"?`<button class="go" data-step="frame">Next: frame the problem →</button>`:""}`:`<p class="tip">Ask at least 3 questions (${n}/3).</p>`;}
  else if(step==="frame"){const fr=ch.frame(l),ans=s.frameAns||{};h+=`<p class="tip">Before building anything, engineers make sure they understand the problem. Answer these four, then check.</p>`;
    for(const k of ["who","need","hard","test"]){const f=fr[k];h+=`<div class="fq"><b>${esc(f.q)}</b>${f.o.map((t,i)=>`<label><input type="${f.multi?"checkbox":"radio"}" name="f_${k}" value="${i}" ${(ans[k]||[]).includes(i)?"checked":""}> ${esc(t)}</label>`).join("")}<p class="fwhy" id="why_${k}"></p></div>`;}
    h+=`<button class="go" id="frameCheck">Check my problem frame</button>`;if(s.framed)h+=`<p class="ok">Your problem frame is right. On to research!</p>`;}
  else if(step==="research"){const order=[...ch.research].sort((a,b)=>weak(b)-weak(a));h+=`<p class="tip">Read at least two lessons. The ones marked <b>for you</b> are about things that went wrong for you before. Want to know more? The <b>Bibliotheca</b> has books on anything.</p><div class="lessons">`;
    order.forEach(k=>{const ls=LESSONS[k],rd=(s.read||[]).includes(k);h+=`<details data-lesson="${k}" ${rd?"":""}><summary>${weak(k)?'<em>for you</em> ':""}${esc(ls.t)}${rd?" ✓":""}</summary><p>${ls.x}</p></details>`;});
    h+=`</div>${(s.read||[]).length>=2?`<button class="go" data-step="pick">Next: pick a design →</button>`:""}`;}
  else if(step==="pick"){h+=`<p class="tip">Pick an idea to try. Its outline will be drawn on your workshop grid as a guide — you build it yourself, and you can change anything.</p><div class="designs">`;
    ch.designs(l).forEach(d=>{h+=`<button data-pick="${d.id}" class="${s.pick===d.id?"on":""}"><canvas width="220" height="110" data-ghost="${d.id}"></canvas><b>${esc(d.name)}</b><small>${esc(d.note)}</small></button>`;});h+=`</div>`;}
  else if(step==="build"){h+=`<div class="tools">${Object.entries(MATS).map(([k,m])=>`<button data-mat="${k}" class="${tool===k?"on":""}" title="${esc(m.what)}"><i style="background:${m.color}"></i>${esc(m.name)}<small>${m.cost}/m</small></button>`).join("")}
      <button data-mat="erase" class="${tool==="erase"?"on":""}"><i style="background:#c33"></i>Erase</button></div>
      <div class="tools glues">Joints: ${Object.entries(GLUES).map(([k,g])=>`<button data-glue="${k}" class="${glue===k?"on":""}" title="${esc(g.what)}"><i style="background:${g.color}"></i>${esc(g.name)}<small>${g.cost?g.cost+" each":"free"}</small></button>`).join("")}</div>
      <div class="cv"><canvas id="dCanvas"></canvas></div>
      <div class="brow"><span id="dCost"></span><button id="dTest" class="go">▶ Test it</button><button id="dStop">↺ Back to building</button><button id="dClear">Clear</button></div>
      <p class="tip" id="dInfo">${esc(MATS[tool]?MATS[tool].what:"Click a piece to remove it.")} Drag from a dot to another point to add a piece; ends snap to the grid. ${id==="bridge"?`Make a road of planks from bank to bank (${l.span} m). The cart weighs ${l.load} kg.`:`Put a plank platform at least ${l.h} m up. The tank weighs ${l.load} kg; the wind pushes up to ${l.wind} N.`}</p>`;}
  h+=`</div><p class="teach" id="dTeach">${teacher?`<b>Magistra Cornelia:</b> ${teacher}`:""}</p>`;
  $("#designBody").innerHTML=h;wire();if(step==="build")drawWork();if(step==="pick")document.querySelectorAll("[data-ghost]").forEach(cv=>drawGhostThumb(cv,ch.designs(l).find(d=>d.id===cv.dataset.ghost).ghost));updCost();}
const weak=k=>{const P=ST.prof;return ({forces:P.tension+P.compression,triangles:P.fold,buckle:P.buckle,glue:P.glue,beam:P.gap,base:P.tip+P.fold}[k])||0;};
function wire(){const s=ST[cur],l=L(cur),ch=CH[cur];
  $("#dClose").onclick=close;document.querySelectorAll("[data-step]").forEach(b=>b.onclick=()=>{if(!unlocked(b.dataset.step))return;step=b.dataset.step;sim=null;result=null;
    if(step==="frame"&&!s.framed)say("Let's make sure we understand the problem before we build anything.");if(step==="build"&&!teacher)say(cur==="bridge"?"Start from your guide. Where will the pieces be pulled, and where squeezed?":"Remember the wind! Where will your tower bend?");render();});
  document.querySelectorAll("[data-ask]").forEach(b=>b.onclick=()=>{const i=+b.dataset.ask;s.facts=s.facts||[];if(!s.facts.includes(i))s.facts.push(i);save();if(hooks.onAsk)hooks.onAsk(ch.facts(l)[i]);render();});
  if($("#frameCheck"))$("#frameCheck").onclick=()=>{const fr=ch.frame(l);let all=true;s.frameAns={};
    for(const k in fr){const picked=[...document.querySelectorAll(`[name=f_${k}]:checked`)].map(i=>+i.value);s.frameAns[k]=picked;const ok=picked.length===fr[k].a.length&&picked.every(i=>fr[k].a.includes(i));
      const w=$("#why_"+k);w.className="fwhy "+(ok?"good":"bad");w.textContent=ok?"✓ "+fr[k].why:(fr[k].multi?"Not quite — look again at each one: is it a real fact about this problem?":"Not quite. Think about who and what this problem is really about.");if(!ok)all=false;}
    if(all){s.framed=true;say("Excellent problem frame. Now you know exactly what you're solving. Let's learn what we need.");}else{ST.prof.frame++;say("Engineers often get this step wrong — it's the most important one. Fix the ones marked and check again.");}
    save();if(all){step="research";render();}else{$("#dTeach").innerHTML=`<b>Magistra Cornelia:</b> ${teacher}`;}};
  document.querySelectorAll("[data-lesson]").forEach(d=>d.ontoggle=()=>{if(!d.open)return;s.read=s.read||[];if(!s.read.includes(d.dataset.lesson)){s.read.push(d.dataset.lesson);save();if(s.read.length===2)render();}});
  document.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{s.pick=b.dataset.pick;save();step="build";say(`A ${ch.designs(l).find(d=>d.id===s.pick).name.toLowerCase()} — good. The faint lines are your guide. Choose a material and glue, then drag from dot to dot.`);render();});
  document.querySelectorAll("[data-mat]").forEach(b=>b.onclick=()=>{tool=b.dataset.mat;document.querySelectorAll("[data-mat]").forEach(x=>x.classList.toggle("on",x===b));$("#dInfo").firstChild.textContent=MATS[tool]?MATS[tool].what+" ":"Click a piece to remove it. ";});
  document.querySelectorAll("[data-glue]").forEach(b=>b.onclick=()=>{glue=b.dataset.glue;document.querySelectorAll("[data-glue]").forEach(x=>x.classList.toggle("on",x===b));});
  if($("#dTest"))$("#dTest").onclick=()=>{if(cost()>l.budget){say(`That costs ${cost()} denarii — over the budget of ${l.budget}. Use cheaper materials or fewer pieces.`);return;}if(!W.members.length)return;saveWork();ST.prof.tries++;startSim();result=null;say("Here we go… watch the colors: green is easy, red is working very hard.");};
  if($("#dStop"))$("#dStop").onclick=()=>{sim=null;result=null;drawWork();};
  if($("#dClear"))$("#dClear").onclick=()=>{if(sim)return;W.members=[];W.nodes=W.nodes.filter(n=>n.anchor);saveWork();drawWork();updCost();};
  const cv=$("#dCanvas");if(cv){cv.onpointerdown=pDown;cv.onpointermove=pMove;cv.onpointerup=pUp;cv.onpointerleave=()=>{hover=null;drawWork();};}}
function updCost(){const el=$("#dCost");if(!el)return;const c=cost(),b=L(cur).budget;el.innerHTML=`Cost: <b class="${c>b?"over":""}">${c}</b> / ${b} denarii`;}
// ---------------- drawing ----------------
function view(cv){const id=cur,l=L(id);const x0=id==="bridge"?-2.5:-2.5,x1=id==="bridge"?l.span+2.5:5.5,y0=id==="bridge"?-4.6:-.6,y1=id==="bridge"?3.6:l.h+1.6;
  const W_=cv.width,H_=cv.height,sc=Math.min(W_/(x1-x0),H_/(y1-y0));const ox=(W_-(x1-x0)*sc)/2-x0*sc,oy=H_-((H_-(y1-y0)*sc)/2)+y0*sc;return {sc,X:x=>ox+x*sc,Y:y=>oy-y*sc,ix:px=>(px-ox)/sc,iy:py=>(oy-py)/sc,x0,x1,y0,y1};}
function drawScene(x,v){const id=cur,l=L(id),cv=x.canvas;x.fillStyle="#cfe8f5";x.fillRect(0,0,cv.width,cv.height);
  // grid
  x.strokeStyle="rgba(40,70,100,.12)";x.lineWidth=1;for(let gx=Math.ceil(v.x0/SNAP)*SNAP;gx<=v.x1;gx+=SNAP){x.beginPath();x.moveTo(v.X(gx),v.Y(v.y0));x.lineTo(v.X(gx),v.Y(v.y1));x.stroke();}
  for(let gy=Math.ceil(v.y0/SNAP)*SNAP;gy<=v.y1;gy+=SNAP){x.beginPath();x.moveTo(v.X(v.x0),v.Y(gy));x.lineTo(v.X(v.x1),v.Y(gy));x.stroke();}
  if(id==="bridge"){x.fillStyle="#4f8fc8";x.fillRect(v.X(0),v.Y(-3.6),v.X(l.span)-v.X(0),v.Y(v.y0)-v.Y(-3.6));
    x.fillStyle="#7a6a52";x.fillRect(v.X(v.x0),v.Y(0),v.X(0)-v.X(v.x0),v.Y(v.y0)-v.Y(0));x.fillRect(v.X(l.span),v.Y(0),v.X(v.x1)-v.X(l.span),v.Y(v.y0)-v.Y(0));
    x.fillStyle="#5f9a46";x.fillRect(v.X(v.x0),v.Y(0)-4,v.X(0)-v.X(v.x0),5);x.fillRect(v.X(l.span),v.Y(0)-4,v.X(v.x1)-v.X(l.span),5);
    x.fillStyle="#2a3a4a";x.font="600 13px system-ui";x.fillText(`${l.span} m`,v.X(l.span/2)-12,v.Y(-3.9));}
  else{x.fillStyle="#7a6a52";x.fillRect(0,v.Y(0),cv.width,cv.height-v.Y(0));x.fillStyle="#5f9a46";x.fillRect(0,v.Y(0)-4,cv.width,5);
    x.setLineDash([6,5]);x.strokeStyle="#2f6fa8";x.beginPath();x.moveTo(v.X(v.x0),v.Y(l.h));x.lineTo(v.X(v.x1),v.Y(l.h));x.stroke();x.setLineDash([]);x.fillStyle="#2f6fa8";x.font="600 13px system-ui";x.fillText(`tank at least ${l.h} m up`,v.X(v.x0)+6,v.Y(l.h)-6);
    const hs=$("#dCanvas");}}
function drawGhost(x,v,g){x.strokeStyle="rgba(30,60,110,.28)";x.lineWidth=Math.max(3,v.sc*.12);x.setLineDash([8,6]);x.lineCap="round";g.forEach(([a,b,c,d])=>{x.beginPath();x.moveTo(v.X(a),v.Y(b));x.lineTo(v.X(c),v.Y(d));x.stroke();});x.setLineDash([]);}
function drawGhostThumb(cv,g){const x=cv.getContext("2d"),v=view(cv);drawScene(x,v);drawGhost(x,v,g);}
function stressColor(m){const r=Math.min(1,Math.abs(m.F)/(m.F>0?m.T:m.C||1));const c=r<.5?[60+r*2*190,190,70]:[250,190-(r-.5)*2*170,50];return `rgb(${c.map(Math.round).join(",")})`;}
function drawWork(){const cv=$("#dCanvas");if(!cv)return;const wrap=cv.parentElement;const w=Math.min(wrap.clientWidth||760,860);if(cv.width!==w){cv.width=w;cv.height=Math.round(w*.5);}
  const x=cv.getContext("2d"),v=view(cv),l=L(cur),s=ST[cur];drawScene(x,v);const d=s.pick&&CH[cur].designs(l).find(d=>d.id===s.pick);if(d&&!sim)drawGhost(x,v,d.ghost);
  x.lineCap="round";
  const ms=sim?sim.ms:W.members.map(m=>({a:m.a,b:m.b,mat:m.mat,mt:MATS[m.mat]}));
  for(const m of ms){if(sim&&m.broken)continue;const mt=MATS[m.mat];x.strokeStyle=mt.color;x.lineWidth=Math.max(2,mt.w*v.sc/40);if(mt.rope)x.setLineDash([2,3]);
    x.beginPath();x.moveTo(v.X(m.a.x),v.Y(m.a.y));x.lineTo(v.X(m.b.x),v.Y(m.b.y));x.stroke();x.setLineDash([]);
    if(sim){x.strokeStyle=stressColor(m);x.lineWidth=Math.max(1.5,mt.w*v.sc/90);x.beginPath();x.moveTo(v.X(m.a.x),v.Y(m.a.y));x.lineTo(v.X(m.b.x),v.Y(m.b.y));x.stroke();}}
  if(sim)for(const m of sim.ms){if(!m.broken)continue;x.strokeStyle="rgba(200,40,30,.75)";x.lineWidth=2;x.setLineDash([4,4]);x.beginPath();x.moveTo(v.X(m.a.x),v.Y(m.a.y));x.lineTo(v.X((m.a.x+m.b.x)/2),v.Y((m.a.y+m.b.y)/2-.15));x.stroke();x.setLineDash([]);}
  const nodes=sim?sim.ns:W.nodes;for(const n of nodes){const an=n.anchor;x.fillStyle=an?"#3a3d44":(GLUES[(n.src||n).glue]||{}).color||"#fff";x.strokeStyle="#222";x.lineWidth=1.5;x.beginPath();x.arc(v.X(n.x),v.Y(n.y),an?6:4.5,0,7);x.fill();x.stroke();}
  if(drag&&drag.to){x.strokeStyle=MATS[tool]?MATS[tool].color:"#c33";x.lineWidth=4;x.globalAlpha=.6;x.beginPath();x.moveTo(v.X(drag.from.x),v.Y(drag.from.y));x.lineTo(v.X(drag.to.x),v.Y(drag.to.y));x.stroke();x.globalAlpha=1;
    const len=Math.hypot(drag.to.x-drag.from.x,drag.to.y-drag.from.y);x.fillStyle="#222";x.font="600 12px system-ui";x.fillText(len.toFixed(1)+" m",v.X(drag.to.x)+8,v.Y(drag.to.y)-8);}
  if(hover&&!sim){x.strokeStyle="#222";x.lineWidth=1;x.beginPath();x.arc(v.X(hover.x),v.Y(hover.y),7,0,7);x.stroke();}
  if(sim){const c=sim.load;if(cur==="bridge"){const cx=v.X(c.x),cy=v.Y(c.y);x.fillStyle="#b5482f";x.fillRect(cx-v.sc*.5,cy-v.sc*.62,v.sc,v.sc*.45);x.fillStyle="#333";x.beginPath();x.arc(cx-v.sc*.3,cy-v.sc*.12,v.sc*.13,0,7);x.arc(cx+v.sc*.3,cy-v.sc*.12,v.sc*.13,0,7);x.fill();
      x.fillStyle="#222";x.font="600 12px system-ui";x.fillText(`${c.w} kg`,cx-14,cy-v.sc*.7);}
    else if(c.x!==undefined){const cx=v.X(c.x),cy=v.Y(c.y);x.fillStyle="#3f6fa8";x.fillRect(cx-v.sc*.6,cy-v.sc*1.1,v.sc*1.2,v.sc*1.1);x.fillStyle="#fff";x.font="600 12px system-ui";x.fillText(`${c.w} kg`,cx-16,cy-v.sc*.5);
      if(c.wind>0){x.strokeStyle="#5a8ab0";x.lineWidth=2;for(let i=0;i<3;i++){const yy=cy-v.sc*(.3+i*.35);x.beginPath();x.moveTo(v.X(v.x0)+10,yy);x.lineTo(v.X(v.x0)+10+c.wind/20,yy);x.stroke();}x.fillStyle="#2a4a6a";x.fillText(`wind ${Math.round(c.wind)} N`,v.X(v.x0)+8,cy-v.sc*1.4);}}}
  if(result){x.fillStyle=result.ok?"rgba(40,140,70,.88)":"rgba(170,40,30,.88)";x.fillRect(0,0,cv.width,34);x.fillStyle="#fff";x.font="700 17px system-ui";x.fillText(result.ok?"It works!":"It failed — read what Magistra Cornelia says below",12,23);}}
// ---------------- building with the mouse / finger ----------------
function evPt(e){const cv=$("#dCanvas"),r=cv.getBoundingClientRect(),v=view(cv);const px=(e.clientX-r.left)*cv.width/r.width,py=(e.clientY-r.top)*cv.height/r.height;
  const x=Math.round(v.ix(px)/SNAP)*SNAP,y=Math.round(v.iy(py)/SNAP)*SNAP;return {x,y,rx:v.ix(px),ry:v.iy(py)};}
function okPoint(p){const l=L(cur);if(cur==="bridge"){if((p.x<0||p.x>l.span)&&p.y<0)return false;if(p.y<-3.5)return false;}else if(p.y<0)return false;return true;}
function pDown(e){if(sim)return;const p=evPt(e);if(tool==="erase"){let best=null,bd=.35;for(const m of W.members){const d=segD(p.rx,p.ry,m);if(d<bd){bd=d;best=m;}}
    if(best){W.members.splice(W.members.indexOf(best),1);W.nodes=W.nodes.filter(n=>n.anchor||W.members.some(m=>m.a===n||m.b===n));saveWork();drawWork();updCost();}return;}
  if(!okPoint(p))return;drag={from:findNode(p.x,p.y)||{x:p.x,y:p.y,fresh:true},to:null};e.target.setPointerCapture&&e.target.setPointerCapture(e.pointerId);}
function pMove(e){const p=evPt(e);hover=p;if(drag){drag.to=p;}drawWork();}
function pUp(e){if(!drag)return;const p=evPt(e),d=drag;drag=null;const mt=MATS[tool];if(!mt||!okPoint(p)){drawWork();return;}const len=Math.hypot(p.x-d.from.x,p.y-d.from.y);
  if(len<.4){drawWork();return;}if(len>mt.max+.01){say(`A ${mt.name.toLowerCase()} can be at most ${mt.max} m long. Add a joint in between.`);drawWork();return;}
  let a=d.from.fresh?(findNode(d.from.x,d.from.y)||null):d.from;if(!a){a={x:d.from.x,y:d.from.y,glue};W.nodes.push(a);}let b=findNode(p.x,p.y);if(!b){b={x:p.x,y:p.y,glue};W.nodes.push(b);}
  if(W.members.some(m=>m.a===a&&m.b===b||m.a===b&&m.b===a)){drawWork();return;}if(!a.anchor)a.glue=glue;if(!b.anchor)b.glue=glue;W.members.push({a,b,mat:tool});saveWork();drawWork();updCost();}
function segD(px,py,m){const ax=m.a.x,ay=m.a.y,bx=m.b.x,by=m.b.y,dx=bx-ax,dy=by-ay;const t=clamp01(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1));return Math.hypot(px-ax-dx*t,py-ay-dy*t);}
// ---------------- the test loop ----------------
let raf=0,lastT=0;
function loop(t){cancelAnimationFrame(raf);if(!openFlag)return;raf=requestAnimationFrame(loop);const dt=lastT&&t?Math.min(1/15,(t-lastT)/1000):1/60;lastT=t||0;if(!sim||result)return;
  const n=Math.max(10,Math.round(dt*2400));for(let i=0;i<n&&!judge();i++)simStep(1/2400);const r=judge();drawWork();
  if(r){result=r;const id=cur,s=ST[id];
    if(r.ok){const first=!s.solved;s.solved=true;ST.prof.solved++;const lv=lvOf(id);s.next=Math.min(2,lv+1);s.best={lv,nodes:W.nodes.map(n=>({x:n.x,y:n.y,anchor:!!n.anchor})),members:W.members.map(m=>({a:W.nodes.indexOf(m.a),b:W.nodes.indexOf(m.b),mat:m.mat}))};save();
      say(`${r.note?r.note+" ":""}It works! You framed the problem, researched it, picked an idea, built it and tested it — that's exactly how engineers work. ${lv<2?"Next time the challenge gets harder (level "+(lv+2)+").":"You've beaten the hardest level!"}`);
      if(hooks.onSolved)hooks.onSolved(id,s.best,lv,first);}
    else say(explain());drawWork();}}
return {open,openSchool,openLibrary,close,isOpen:()=>openFlag,state:()=>ST,facts:id=>(ST[id].facts||[]).length,solved:id=>!!ST[id].solved,best:id=>ST[id].best,level:id=>lvOf(id),
  _test:{use(id){cur=id;resetWork();},get W(){return W;},get sim(){return sim;},get result(){return result;},startSim,simStep,judge,explain,L,set tool(v){tool=v;},set glue(v){glue=v;},
    add(ax,ay,bx,by,mat,gl){let a=findNode(ax,ay);if(!a){a={x:ax,y:ay,glue:gl||glue};W.nodes.push(a);}let b=findNode(bx,by);if(!b){b={x:bx,y:by,glue:gl||glue};W.nodes.push(b);}if(!a.anchor)a.glue=gl||a.glue;if(!b.anchor)b.glue=gl||b.glue;W.members.push({a,b,mat});},
    clear(){W.members=[];W.nodes=W.nodes.filter(n=>n.anchor);},run(secs){startSim();result=null;for(let i=0;i<secs*60*40&&!judge();i++)simStep(1/60/40);return {r:judge(),first:sim.first&&{kind:sim.first.kind,by:sim.first.by,mat:sim.first.m.mat,F:Math.round(sim.first.F),lim:Math.round(sim.first.lim)},load:sim.load,why:judge()&&!judge().ok?explain():""};}}};
})();
