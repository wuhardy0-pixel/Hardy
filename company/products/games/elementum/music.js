// ---------------- music (2026-11-25, Barbara: "add music"). Made by the game itself, note by note, so it's our own tune (no files, no licences).
// It follows where you are: a bright tune in town by day, a calmer one out in the wilds, a soft slow one at night, and a fast one with
// drums when monsters are close or you're in the arena. The tunes fade into each other. 🎵 turns only the music off (remembered on this
// device); 🔊/🔇 still silences everything. Each player hears their own music, like in any game: it follows where *you* are.
(()=>{
const NOTE=n=>440*Math.pow(2,(n-69)/12);
// each mood: speed, chords (as note numbers of the root, 4 beats each), a scale the tune picks from, and how it's played
const MOODS={
  town:{bpm:104,chords:[[60,"M"],[67,"M"],[69,"m"],[65,"M"],[60,"M"],[65,"M"],[67,"M"],[60,"M"]],scale:[0,2,4,5,7,9,11],lead:"triangle",arp:true,vol:1,seed:11},
  wild:{bpm:84,chords:[[62,"m"],[60,"M"],[58,"M"],[60,"M"],[62,"m"],[65,"M"],[60,"M"],[62,"m"]],scale:[0,3,5,7,10],lead:"sine",arp:false,vol:.9,seed:23},
  night:{bpm:64,chords:[[57,"m"],[53,"M"],[55,"M"],[52,"m"],[57,"m"],[50,"m"],[52,"M"],[57,"m"]],scale:[0,2,3,7,8],lead:"sine",arp:false,vol:.75,sparse:true,seed:37},
  fight:{bpm:138,chords:[[57,"m"],[57,"m"],[53,"M"],[55,"M"],[57,"m"],[60,"M"],[55,"M"],[52,"M"]],scale:[0,2,3,5,7,8,10],lead:"sawtooth",arp:true,drums:true,vol:.85,seed:51},
};
const TRI={M:[0,4,7],m:[0,3,7]};
// one fixed tune per mood (the same every time, so you get to know it): 8 bars × 8 eighth notes
function rng(s){return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
for(const k in MOODS){const M=MOODS[k],R=rng(M.seed),tune=[];let d=2;
  for(let b=0;b<8;b++){const root=M.chords[b][0]%12,bar=[];
    for(let e=0;e<8;e++){const rest=M.sparse?(e%2||R()<.35):(R()<(e%2?.45:.12));if(rest){bar.push(null);continue;}
      d=Math.max(0,Math.min(M.scale.length*2-1,d+[-2,-1,-1,0,1,1,2][Math.floor(R()*7)]));
      if(e===0){const tones=TRI[M.chords[b][1]].map(t=>(root+t)%12);let best=d,bd=99;for(let q=0;q<M.scale.length*2;q++){const pc=(M.scale[q%M.scale.length]+(k==="night"?9:k==="fight"?9:k==="wild"?2:0))%12;if(tones.includes(pc)&&Math.abs(q-d)<bd){bd=Math.abs(q-d);best=q;}}d=best;}
      bar.push(d);}
    tune.push(bar);}
  M.tune=tune;M.key=k==="night"||k==="fight"?69:k==="wild"?74:72;}
let A=null,out=null,mood=null,next=0,step=0,on=true,cur={},timer=0;
try{on=localStorage.getItem("elementum.music")!=="0";}catch(e){}
function ctx(){if(A)return A;try{A=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}out=A.createGain();out.gain.value=on?.11:0;
  const lp=A.createBiquadFilter();lp.type="lowpass";lp.frequency.value=5200;out.connect(lp);lp.connect(A.destination);
  for(const k in MOODS){const g=A.createGain();g.gain.value=0;g.connect(out);cur[k]=g;}return A;}
function tone(bus,type,f,t,len,v,att=.01,cut=0){const o=A.createOscillator(),g=A.createGain();o.type=type;o.frequency.value=f;let last=o;
  if(cut){const lp=A.createBiquadFilter();lp.type="lowpass";lp.frequency.value=cut;o.connect(lp);last=lp;}
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+att);g.gain.exponentialRampToValueAtTime(.0005,t+len);last.connect(g);g.connect(bus);o.start(t);o.stop(t+len+.05);}
let noise=null;function hit(bus,t,kind){if(kind==="kick"){const o=A.createOscillator(),g=A.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(42,t+.15);g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.connect(g);g.connect(bus);o.start(t);o.stop(t+.25);return;}
  if(!noise){noise=A.createBuffer(1,A.sampleRate*.3,A.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  const s=A.createBufferSource(),f=A.createBiquadFilter(),g=A.createGain();s.buffer=noise;f.type=kind==="hat"?"highpass":"bandpass";f.frequency.value=kind==="hat"?7000:1800;
  g.gain.setValueAtTime(kind==="hat"?.18:.45,t);g.gain.exponentialRampToValueAtTime(.001,t+(kind==="hat"?.05:.18));s.connect(f);f.connect(g);g.connect(bus);s.start(t);s.stop(t+.3);}
// play one eighth note of the mood that's on (the others are faded out, so only one plays at a time)
function play(k,t,s){const M=MOODS[k],bus=cur[k],e8=60/M.bpm/2,bar=Math.floor(s/8)%8,e=s%8,[root,q]=M.chords[bar],tri=TRI[q];
  if(e===0)tri.forEach((x,i)=>tone(bus,"sine",NOTE(root+x),t,e8*8,.09,.25));                       // soft chord
  if(e===0||e===4||(M.drums&&e%2===0))tone(bus,"triangle",NOTE(root-24+(e===4&&!M.drums?7:0)),t,e8*(M.drums?1.6:3.5),.32,.01); // bass
  if(M.arp&&e%(M.drums?1:2)===0)tone(bus,"triangle",NOTE(root+12+tri[(e/(M.drums?1:2))%3]),t,e8*1.4,.05,.005,2600);
  const d=M.tune[bar][e];if(d!=null){const n=M.key+M.scale[d%M.scale.length]+12*Math.floor(d/M.scale.length)-12;tone(bus,M.lead,NOTE(n),t,e8*(M.sparse?3.5:1.8),M.lead==="sawtooth"?.06:.16,.01,M.lead==="sawtooth"?1800:0);}
  if(M.drums){if(e===0||e===3||e===4)hit(bus,t,"kick");if(e===2||e===6)hit(bus,t,"snare");hit(bus,t,"hat");}}
function want(){try{const {P,ENEMIES,inArena,isNight,inTown}=window.__world;if(P.down)return "night";if(inArena(P.pos)||ENEMIES.some(d=>!d.down&&d.g.position.distanceTo(P.pos)<22))return "fight";
  if(isNight())return "night";return inTown(P.pos)?"town":"wild";}catch(e){return "wild";}}
function tick(){if(!A||A.state!=="running")return;const w=want();
  if(w!==mood){const t=A.currentTime;for(const k in cur){cur[k].gain.cancelScheduledValues(t);cur[k].gain.setValueAtTime(cur[k].gain.value,t);cur[k].gain.linearRampToValueAtTime(k===w?MOODS[k].vol:0,t+(w==="fight"?1.2:3.5));}
    if(!mood)next=t+.1;mood=w;}
  // the tune moves on in eighth notes at the speed of the mood that's playing; the fading one keeps going until it's quiet
  while(next<A.currentTime+.25){const M=MOODS[mood];for(const k in cur)if(k===mood||cur[k].gain.value>.01)play(k,next,step);step++;next+=60/M.bpm/2;}}
function start(){if(!ctx())return;if(A.state==="suspended")A.resume();if(!timer)timer=setInterval(tick,90);}
function setOn(v){on=v;try{localStorage.setItem("elementum.music",v?"1":"0");}catch(e){}if(out)out.gain.setTargetAtTime(v?.11:0,A.currentTime,.3);paint();if(v)start();}
let b=null;const paint=()=>{if(!b)return;b.textContent=on?"🎵":"🎵";b.style.opacity=on?"1":".45";b.style.textDecoration=on?"none":"line-through";b.title=on?"Music on — click to turn the music off":"Music off — click to turn it on";b.setAttribute("aria-label",b.title);b.setAttribute("aria-pressed",on);};
b=document.createElement("button");b.id="musicBtn";b.type="button";b.style.cssText="position:fixed;left:10px;top:calc(46% + 48px);z-index:90;width:40px;height:40px;padding:0;margin:0;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(20,20,24,.62);color:#fff;font-size:18px;line-height:1;cursor:pointer";
b.addEventListener("click",e=>{e.stopPropagation();setOn(!on);b.blur();});["pointerdown","mousedown","touchstart"].forEach(k=>b.addEventListener(k,e=>e.stopPropagation()));document.body.appendChild(b);paint();
// browsers only let sound start after a click or a key, so the music begins with the first one (the Start button counts)
const first=()=>{start();["pointerdown","keydown","touchstart"].forEach(k=>removeEventListener(k,first,true));};["pointerdown","keydown","touchstart"].forEach(k=>addEventListener(k,first,true));
document.addEventListener("visibilitychange",()=>{if(!A)return;if(document.hidden)A.suspend();else start();});
// for checking: play a few seconds of one mood into a recording (no speakers needed) and say how loud it was
async function render(k,secs){const keep=[A,cur,noise],O=new OfflineAudioContext(1,44100*secs,44100);A=O;noise=null;cur={};const bus=O.createGain();bus.connect(O.destination);cur[k]=bus;
  let t=0,s=0;while(t<secs-.3){play(k,t,s);s++;t+=60/MOODS[k].bpm/2;}[A,cur,noise]=keep;const buf=await O.startRendering(),d=buf.getChannelData(0);let q=0,pk=0;for(const v of d){q+=v*v;pk=Math.max(pk,Math.abs(v));}return {rms:+Math.sqrt(q/d.length).toFixed(3),peak:+pk.toFixed(2),notes:s};}
window.__music={want,render,get mood(){return mood;},get on(){return on;},setOn,get ctx(){return A;}};
})();
