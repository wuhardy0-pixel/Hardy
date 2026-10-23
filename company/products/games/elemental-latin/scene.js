// Elemental Latin — the 3D side: a walkable world, a battle arena, and spell effects.
// Uses Three.js r158 (three.min.js next to this file). The Latin rules live in index.html;
// this file only draws what those rules decide. Everything is reachable as window.g3.
(function(){
const $=s=>document.querySelector(s);
const ELC={fire:0xff7b3a,water:0x4cc3ff,earth:0xc69a5a,air:0xdff1ff,lightning:0xffe26a,ice:0xa9f1ff,light:0xfff4c2,shadow:0xa98ae0,heal:0x7dff9a,gold:0xffd36a,none:0xffffff};
const LOOK={magus:{robe:0x5b3fa8,trim:0xe8b84a,hat:"cone"},knight:{robe:0x2f7d4f,trim:0xcfe8b0,hat:"hood"},ninja:{robe:0x1b1b26,trim:0xd13b3b,hat:"mask"},queen:{robe:0xbfe9ff,trim:0xffffff,hat:"tiara"},vamp:{robe:0x5a0f1f,trim:0x111111,hat:"collar"},genie:{robe:0x1fa3a3,trim:0xffd36a,hat:"turban"}};
const canvas=$("#gl");
const R=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
R.setPixelRatio(Math.min(1.75,window.devicePixelRatio||1));
if("outputColorSpace" in R)R.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();const BG=new THREE.Color(0x120d1f);scene.background=BG;scene.fog=new THREE.Fog(BG,13,36);
const cam=new THREE.PerspectiveCamera(48,1,.1,120);
const hemi=new THREE.HemisphereLight(0xcfd8ff,0x3a2a4a,.95);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe9c4,1.25);sun.position.set(4,9,4);scene.add(sun);
const root=new THREE.Group();scene.add(root);const fxg=new THREE.Group();scene.add(fxg);
const C=h=>new THREE.Color(h);
const mat=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.8,metalness:.05},o||{}));
const glowMat=(c,i)=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:i||1,roughness:.3});
const rnd=(a,b)=>a+Math.random()*(b-a);
const rnd3=k=>new THREE.Vector3(rnd(-k,k),rnd(-k,k),rnd(-k,k));
let tweens=[];
function tween(dur,fn,done){tweens.push({t:0,dur,fn,done});}
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

// ---- particles: two pools, sparks (small) and puffs (big), additive so they glow
function dotTex(){const c=document.createElement("canvas");c.width=c.height=64;const x=c.getContext("2d");const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(.35,"rgba(255,255,255,.7)");g.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
const TEX=dotTex();
function pool(n,size){const geo=new THREE.BufferGeometry();const pos=new Float32Array(n*3),col=new Float32Array(n*3);for(let i=0;i<n;i++)pos[i*3+1]=-99;
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3));geo.setAttribute("color",new THREE.BufferAttribute(col,3));
  const m=new THREE.PointsMaterial({size,map:TEX,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
  const pts=new THREE.Points(geo,m);pts.frustumCulled=false;scene.add(pts);
  const P=[];for(let i=0;i<n;i++)P.push({life:0});let next=0;
  return{emit(p,v,c,life,o){o=o||{};const q=P[next];next=(next+1)%n;q.x=p.x;q.y=p.y;q.z=p.z;q.vx=v.x;q.vy=v.y;q.vz=v.z;q.life=q.max=life;q.r=c.r;q.g=c.g;q.b=c.b;q.grav=o.grav||0;q.drag=o.drag||0;},
    step(dt){for(let i=0;i<n;i++){const q=P[i];if(q.life>0){q.life-=dt;if(q.grav)q.vy-=q.grav*dt;if(q.drag){const k=Math.max(0,1-q.drag*dt);q.vx*=k;q.vy*=k;q.vz*=k;}q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;const a=Math.max(0,q.life/q.max);pos[i*3]=q.x;pos[i*3+1]=q.y;pos[i*3+2]=q.z;col[i*3]=q.r*a;col[i*3+1]=q.g*a;col[i*3+2]=q.b*a;}else if(pos[i*3+1]>-90){pos[i*3+1]=-99;col[i*3]=col[i*3+1]=col[i*3+2]=0;}}
      geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;}};}
const SPARK=pool(900,.17),PUFF=pool(300,.55);

// ---- characters
function emojiSprite(ch){const c=document.createElement("canvas");c.width=c.height=96;const x=c.getContext("2d");x.font="72px serif";x.textAlign="center";x.textBaseline="middle";x.fillText(ch,48,52);const t=new THREE.CanvasTexture(c);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));return s;}
function hatFor(g,o,y){const k=o.hatId&&o.hatId!=="none"?o.hatId:o.hat;
  if(k==="cone"){const h=new THREE.Mesh(new THREE.ConeGeometry(.26,.55,14),mat(o.robe));h.position.y=y+.2;g.add(h);const b=new THREE.Mesh(new THREE.TorusGeometry(.27,.05,8,20),mat(o.robe));b.rotation.x=Math.PI/2;b.position.y=y-.04;g.add(b);}
  else if(k==="hood"){const h=new THREE.Mesh(new THREE.ConeGeometry(.27,.4,12),mat(o.robe));h.position.y=y+.1;g.add(h);}
  else if(k==="mask"){const b=new THREE.Mesh(new THREE.TorusGeometry(.22,.04,8,20),mat(o.trim));b.rotation.x=Math.PI/2;b.position.y=y-.08;g.add(b);}
  else if(k==="tiara"){const t=new THREE.Mesh(new THREE.TorusGeometry(.18,.025,8,20),mat(0xffffff,{metalness:.8,roughness:.2}));t.rotation.x=Math.PI/2;t.position.y=y+.02;g.add(t);}
  else if(k==="collar"){const c=new THREE.Mesh(new THREE.CylinderGeometry(.34,.28,.3,12,1,true),mat(0x111111,{side:THREE.DoubleSide}));c.position.y=y-.3;g.add(c);}
  else if(k==="turban"){const t=new THREE.Mesh(new THREE.SphereGeometry(.26,14,10),mat(o.trim));t.scale.y=.7;t.position.y=y+.02;g.add(t);}
  else if(k==="tophat"){const b=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.42,16),mat(0x111111));b.position.y=y+.2;g.add(b);const br=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.03,20),mat(0x111111));br.position.y=y;g.add(br);}
  else if(k==="wizard"){const b=new THREE.Mesh(new THREE.BoxGeometry(.5,.05,.5),mat(0x111111));b.position.y=y+.04;b.rotation.y=Math.PI/4;g.add(b);const t=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.25),mat(0xe8b84a));t.position.set(.22,y-.06,0);g.add(t);}
  else if(k==="crown"){const r=new THREE.Mesh(new THREE.CylinderGeometry(.2,.17,.16,10,1,true),mat(0xffd36a,{metalness:.9,roughness:.25,side:THREE.DoubleSide}));r.position.y=y+.04;g.add(r);for(let i=0;i<5;i++){const s=new THREE.Mesh(new THREE.ConeGeometry(.04,.12,6),mat(0xffd36a,{metalness:.9,roughness:.25}));const a=i/5*Math.PI*2;s.position.set(Math.cos(a)*.19,y+.16,Math.sin(a)*.19);g.add(s);}}
  else if(k==="halo"){const h=new THREE.Mesh(new THREE.TorusGeometry(.2,.025,8,24),glowMat(0xffe26a,1.5));h.rotation.x=Math.PI/2;h.position.y=y+.22;g.add(h);}}
function mage(o){const g=new THREE.Group();const P={};const el=o.el||"light";
  const legs=new THREE.Mesh(new THREE.CylinderGeometry(.26,.3,.35,10),mat(0x2a2235));legs.position.y=.18;g.add(legs);
  const robe=new THREE.Mesh(new THREE.CylinderGeometry(.24,.46,.85,14),mat(o.robe));robe.position.y=.72;g.add(robe);
  const belt=new THREE.Mesh(new THREE.TorusGeometry(.3,.035,8,20),mat(o.trim,{metalness:.5,roughness:.4}));belt.rotation.x=Math.PI/2;belt.position.y=.9;g.add(belt);
  const chest=new THREE.Mesh(new THREE.SphereGeometry(.3,14,12),mat(o.robe));chest.scale.set(1,.8,.8);chest.position.y=1.15;g.add(chest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.22,16,14),mat(0xf1c8a0));head.position.y=1.52;g.add(head);P.head=head;
  const eyeM=mat(0x1a1020);[-.08,.08].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.03,8,8),eyeM);e.position.set(x,1.55,-.2);g.add(e);});
  const la=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.42,4,8),mat(o.robe));la.position.set(-.36,1.1,0);la.rotation.z=.25;g.add(la);
  const ra=new THREE.Group();ra.position.set(.36,1.3,0);g.add(ra);P.arm=ra;
  const ram=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.42,4,8),mat(o.robe));ram.position.set(0,-.22,0);ra.add(ram);
  const staff=new THREE.Mesh(new THREE.CylinderGeometry(.03,.035,1.5,8),mat(0x6b4a2a));staff.position.set(.08,-.1,-.15);ra.add(staff);
  const orb=new THREE.Mesh(new THREE.SphereGeometry(.11,12,10),glowMat(ELC[el],1.2));orb.position.set(.08,.7,-.15);ra.add(orb);P.orb=orb;
  const glow=new THREE.PointLight(ELC[el],.7,3);orb.add(glow);P.glow=glow;
  hatFor(g,o,1.7);
  g.scale.setScalar(o.scale||1);g.userData=P;g.userData.h=1.1*(o.scale||1);return g;}
function beast(c,scale){const g=new THREE.Group();const col=ELC[c.el]||0xffffff;const body=mat(col,{roughness:.6});const dark=mat(C(col).multiplyScalar(.5).getHex());
  const b=new THREE.Mesh(new THREE.SphereGeometry(.5,16,12),body);b.scale.set(1,.8,1.3);b.position.y=.6;g.add(b);
  const h=new THREE.Mesh(new THREE.SphereGeometry(.3,14,12),body);h.position.set(0,.95,-.65);g.add(h);
  const eye=glowMat(0xffffff,.9);[-.12,.12].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.05,8,8),eye);e.position.set(x,1.0,-.9);g.add(e);});
  [[-.3,-.4],[.3,-.4],[-.3,.4],[.3,.4]].forEach(([x,z])=>{const l=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.5,8),dark);l.position.set(x,.25,z);g.add(l);});
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.12,.9,8),dark);tail.rotation.x=-Math.PI/2-.4;tail.position.set(0,.6,.95);g.add(tail);
  const kind=/Draco|Salamandra|Hydra/.test(c.la)?"spikes":/Gryphus|Phoenix/.test(c.la)?"wings":"ears";
  if(kind==="spikes")for(let i=0;i<4;i++){const s=new THREE.Mesh(new THREE.ConeGeometry(.08,.3,6),dark);s.position.set(0,1.0,-.4+i*.3);g.add(s);}
  if(kind==="wings")[-1,1].forEach(sg=>{const w=new THREE.Mesh(new THREE.BoxGeometry(1.1,.05,.5),mat(col));w.position.set(sg*.8,.9,0);w.rotation.z=sg*.5;g.add(w);g.userData["wing"+(sg>0?"R":"L")]=w;});
  if(kind==="ears")[-.15,.15].forEach(x=>{const e=new THREE.Mesh(new THREE.ConeGeometry(.08,.2,6),dark);e.position.set(x,1.25,-.6);g.add(e);});
  const spr=emojiSprite(c.art);spr.position.set(0,1.8,-.3);spr.scale.set(.6,.6,1);g.add(spr);
  g.scale.setScalar(scale||1);g.userData.body=b;g.userData.head=h;g.userData.h=.9*(scale||1);return g;}
function setEmissive(g,hex,k){g.traverse(m=>{if(m.isMesh&&m.material&&m.material.emissive&&!m.userData.keepGlow){if(hex===null){if(m.userData.em0!==undefined){m.material.emissive.setHex(m.userData.em0);m.material.emissiveIntensity=m.userData.ei0;}}else{if(m.userData.em0===undefined){m.userData.em0=m.material.emissive.getHex();m.userData.ei0=m.material.emissiveIntensity;}m.material.emissive.setHex(hex);m.material.emissiveIntensity=k;}}});}
function fadeOut(g,dur,done){const mats=[];g.traverse(m=>{if(m.isMesh||m.isSprite){m.material.transparent=true;mats.push(m.material);}});tween(dur,t=>mats.forEach(m=>m.opacity=1-t),()=>{g.visible=false;done&&done();});}

// ---- the world: terrain built from MAPROWS (defined by the game)
let worldG=null,tiles=[],playerW=null,lookKey="";
const TH={w:.25,m:1.1,v:.95,i:.55,s:.5,l:.55,f:.55,g:.5,t:.5,a:.5,c:.5};
function tileTop(x,y){const k=(MAPROWS[y]||"")[x];return TH[k]||.5;}
function tx(x){return x-(MW-1)/2;}function tz(y){return y-(MH-1)/2;}
function tree(col,h){const g=new THREE.Group();const tr=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.25,6),mat(0x4a3220));tr.position.y=.12;g.add(tr);const c=new THREE.Mesh(new THREE.ConeGeometry(.22,h,8),mat(col));c.position.y=.25+h/2;g.add(c);return g;}
function house(){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(.4,.3,.4),mat(0xd9c4a0));b.position.y=.15;g.add(b);const r=new THREE.Mesh(new THREE.ConeGeometry(.34,.25,4),mat(0x9b3b2b));r.position.y=.42;r.rotation.y=Math.PI/4;g.add(r);return g;}
function buildWorld(){const g=new THREE.Group();tiles=[];
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){const k=MAPROWS[y][x];const T=TERRAIN[k];const h=TH[k]||.5;const col=C(T.color);
    const box=new THREE.Mesh(new THREE.BoxGeometry(1,h,1),mat(col.getHex(),k==="w"?{roughness:.25,metalness:.2,emissive:0x0b2a4a,emissiveIntensity:.5}:{}));box.position.set(tx(x),h/2,tz(y));box.userData.tile={x,y};g.add(box);tiles.push(box);
    const px=tx(x),pz=tz(y),top=h;
    if(k==="f"){for(let i=0;i<2;i++){const t=tree(0x1f5f2e,rnd(.45,.7));t.position.set(px+rnd(-.3,.3),top,pz+rnd(-.3,.3));g.add(t);}}
    else if(k==="s"){for(let i=0;i<2;i++){const t=tree(0x2b1e44,rnd(.5,.8));t.position.set(px+rnd(-.3,.3),top,pz+rnd(-.3,.3));g.add(t);}}
    else if(k==="m"){const c=new THREE.Mesh(new THREE.ConeGeometry(.45,.9,7),mat(0x5a5a6e));c.position.set(px,top+.45,pz);g.add(c);const sn=new THREE.Mesh(new THREE.ConeGeometry(.16,.3,7),mat(0xe8f0ff));sn.position.set(px,top+.78,pz);g.add(sn);}
    else if(k==="v"){const c=new THREE.Mesh(new THREE.ConeGeometry(.42,.7,7),mat(0x3a1a12));c.position.set(px,top+.35,pz);g.add(c);const lava=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),glowMat(0xff6a2a,2));lava.position.set(px,top+.7,pz);lava.userData.keepGlow=true;g.add(lava);}
    else if(k==="i"){for(let i=0;i<3;i++){const s=new THREE.Mesh(new THREE.ConeGeometry(.08,rnd(.2,.45),5),mat(0xcfefff,{roughness:.2}));s.position.set(px+rnd(-.35,.35),top,pz+rnd(-.35,.35));s.position.y+=s.geometry.parameters.height/2;g.add(s);}}
    else if(k==="l"){const p=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.9,8),glowMat(0xfff4c2,.8));p.position.set(px,top+.45,pz);p.userData.keepGlow=true;g.add(p);}
    else if(k==="t"){const h1=house();h1.position.set(px-.22,top,pz+.15);g.add(h1);const h2=house();h2.position.set(px+.22,top,pz-.2);h2.rotation.y=.4;g.add(h2);}
    else if(k==="a"){for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const p=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,.55,8),mat(0xe9dcc3));p.position.set(px+Math.cos(a)*.38,top+.27,pz+Math.sin(a)*.38);g.add(p);}}
    else if(k==="c"){const t=new THREE.Mesh(new THREE.ConeGeometry(.32,.5,6),mat(0xd98c3a));t.position.set(px-.1,top+.25,pz);g.add(t);const fire=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),glowMat(0xffa23a,2.5));fire.position.set(px+.3,top+.08,pz+.1);fire.userData.keepGlow=true;g.add(fire);const fl=new THREE.PointLight(0xffa23a,1.2,3);fire.add(fl);}}
  // a rim of distant peaks so the map doesn't float in nothing
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2;const r=rnd(12,15);const c=new THREE.Mesh(new THREE.ConeGeometry(rnd(1.5,3),rnd(2,4.5),6),mat(0x241a3a));c.position.set(Math.cos(a)*r,0,Math.sin(a)*r);g.add(c);}
  const ground=new THREE.Mesh(new THREE.CircleGeometry(30,32),mat(0x1a1430));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;g.add(ground);
  return g;}
function myLook(){const S=window.__latin&&window.__latin.S;const look=(S&&S.look)||{};const o=LOOK[look.outfit]||LOOK.magus;return Object.assign({},o,{hatId:look.hat,el:"light"});}
function ensurePlayerW(){const k=JSON.stringify(myLook());if(playerW&&lookKey===k)return playerW;if(playerW){playerW.parent&&playerW.parent.remove(playerW);}lookKey=k;playerW=mage(Object.assign(myLook(),{scale:.55}));return playerW;}
let mode="idle",camShake=0,camBase=new THREE.Vector3(0,5,6),camLook=new THREE.Vector3(),walking=false;
function placePlayer(){const p=ensurePlayerW();p.position.set(tx(W.x),tileTop(W.x,W.y),tz(W.y));if(!p.parent)root.add(p);}
function world(){if(!worldG)worldG=buildWorld();root.clear();root.add(worldG);mode="world";placePlayer();hemi.color.setHex(0xcfd8ff);scene.fog.near=16;scene.fog.far=40;snapCam();}
function walk(x,y,dir,done){const p=ensurePlayerW();const from=p.position.clone(),to=new THREE.Vector3(tx(x),tileTop(x,y),tz(y));if(dir)p.rotation.y=Math.atan2(-dir[0],-dir[1]);walking=true;
  tween(.28,t=>{const e=ease(t);p.position.lerpVectors(from,to,e);p.position.y+=Math.sin(t*Math.PI)*.18;},()=>{walking=false;done&&done();});
  for(let i=0;i<4;i++)PUFF.emit(from.clone().add(new THREE.Vector3(rnd(-.1,.1),.05,rnd(-.1,.1))),new THREE.Vector3(rnd(-.2,.2),.4,rnd(-.2,.2)),C(0x8a7a6a).multiplyScalar(.35),.5,{drag:2});}

// ---- the arena
let arenaG=null,me=null,foe=null,famM=null,storm=null,shields={me:null,foe:null};
const ME_POS=new THREE.Vector3(1.0,0,1.2),FOE_POS=new THREE.Vector3(-.5,0,-3.0),FAM_POS=new THREE.Vector3(2.4,0,.4);
function arena(){const S=window.__latin.S;const f=S.foe;const T=tileAt(W.x,W.y)||{};const biome=T.el?T.el[0]:null;
  root.clear();arenaG=new THREE.Group();root.add(arenaG);mode="battle";shields={me:null,foe:null};storm=null;
  const floorCol=C(T.color||"#3a2a4a").multiplyScalar(.9).getHex();
  const floor=new THREE.Mesh(new THREE.CircleGeometry(4.6,40),mat(floorCol));floor.rotation.x=-Math.PI/2;arenaG.add(floor);
  const rim=new THREE.Mesh(new THREE.RingGeometry(4.6,6.5,40),mat(0x1a1430));rim.rotation.x=-Math.PI/2;rim.position.y=-.01;arenaG.add(rim);
  const royale=S.mode==="royale",town=S.mode==="arena";
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2+.3;const x=Math.cos(a)*4.4,z=Math.sin(a)*4.4;
    if(royale||town){const p=new THREE.Mesh(new THREE.CylinderGeometry(.14,.17,2.2,10),mat(royale?0xffd36a:0xe9dcc3,royale?{metalness:.6,roughness:.35}:{}));p.position.set(x,1.1,z);arenaG.add(p);
      const cap=new THREE.Mesh(new THREE.BoxGeometry(.5,.14,.5),mat(royale?0xffd36a:0xe9dcc3));cap.position.set(x,2.25,z);arenaG.add(cap);}
    else{const s=new THREE.Mesh(new THREE.BoxGeometry(.4,rnd(1,1.7),.4),mat(0x4a4458));s.position.set(x,.6,z);s.rotation.set(rnd(-.15,.15),rnd(0,3),rnd(-.15,.15));arenaG.add(s);
      if(biome==="fire"){const l=new THREE.Mesh(new THREE.SphereGeometry(.14,8,6),glowMat(0xff6a2a,2));l.position.set(x*.8,.1,z*.8);l.userData.keepGlow=true;arenaG.add(l);}
      if(biome==="ice"){const c=new THREE.Mesh(new THREE.ConeGeometry(.14,rnd(.6,1.1),5),mat(0xcfefff,{roughness:.2}));c.position.set(x*.85,.4,z*.85);arenaG.add(c);}
      if(biome==="air"||biome==="earth"){const t=tree(0x1f5f2e,rnd(.9,1.4));t.position.set(x*1.15,0,z*1.15);t.scale.setScalar(1.6);arenaG.add(t);}
      if(biome==="shadow"){const t=tree(0x2b1e44,rnd(1,1.6));t.position.set(x*1.15,0,z*1.15);t.scale.setScalar(1.7);arenaG.add(t);}
      if(biome==="light"){const p=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,1.6,8),glowMat(0xfff4c2,.8));p.position.set(x*.9,.8,z*.9);p.userData.keepGlow=true;arenaG.add(p);}
      if(biome==="water"){const w=new THREE.Mesh(new THREE.CircleGeometry(.6,12),mat(0x1f4f7a,{roughness:.2,metalness:.3}));w.rotation.x=-Math.PI/2;w.position.set(x*.9,.01,z*.9);arenaG.add(w);}}}
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2;const r=rnd(13,17);const c=new THREE.Mesh(new THREE.ConeGeometry(rnd(2,4),rnd(3,6),6),mat(0x241a3a));c.position.set(Math.cos(a)*r,0,Math.sin(a)*r);arenaG.add(c);}
  const skyCol={fire:0xffb09a,water:0x9fd8ff,earth:0xd8c9a8,air:0xeaf4ff,lightning:0xfff0a8,ice:0xd8f6ff,light:0xfff8d8,shadow:0x8a74b8}[biome]||0xcfd8ff;hemi.color.setHex(skyCol);
  scene.fog.near=10;scene.fog.far=30;
  // the player
  me=mage(Object.assign(myLook(),{scale:1}));me.position.copy(ME_POS);arenaG.add(me);
  // the opponent
  if(f.kind==="creature"){foe=beast(f,.9+(f.lvl||1)*.08);}else{const col=C(ELC[f.el]).multiplyScalar(.55).getHex();foe=mage({robe:col,trim:ELC[f.el],hat:/Magister/.test(f.la)?"cone":/Octavia/.test(f.la)?"tiara":/Gaius/.test(f.la)?"hood":"none",el:f.el,scale:1+(S.wins||0)*.02});}
  foe.position.copy(FOE_POS);foe.rotation.y=Math.PI;arenaG.add(foe);
  // the familiar beside you
  famM=null;const fm=window.__latin.fam&&window.__latin.fam();if(fm){famM=beast(fm,.45);famM.position.copy(FAM_POS);arenaG.add(famM);}
  // Ludus Royale: the storm wall closes in
  if(royale){storm=new THREE.Mesh(new THREE.CylinderGeometry(1,1,7,48,1,true),new THREE.MeshBasicMaterial({color:0x9b6bff,transparent:true,opacity:.22,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));storm.position.y=3.5;arenaG.add(storm);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.95,1,48),new THREE.MeshBasicMaterial({color:0xc9a6ff,transparent:true,opacity:.7,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.02;storm.userData.ring=ring;arenaG.add(ring);
    const r=2.4+(S.royale?S.royale.left:6)*.8;storm.scale.set(r,1,r);ring.scale.set(r,r,1);scene.fog.far=18;}
  snapCam();}
function who(side){return side==="foe"?foe:side==="fam"?(famM||me):me;}
function hand(g){const P=g.userData;const v=new THREE.Vector3();if(P.orb)P.orb.getWorldPosition(v);else if(P.head)P.head.getWorldPosition(v);else{g.getWorldPosition(v);v.y+=1;}return v;}
function centre(g){const v=new THREE.Vector3();g.getWorldPosition(v);v.y+=g.userData.h||1;return v;}

// ---- spell effects
function armCast(g){const P=g.userData;if(!P.arm)return;const a=P.arm;tween(.22,t=>{a.rotation.x=-1.7*ease(t);},()=>tween(.45,t=>{a.rotation.x=-1.7*(1-ease(t));}));if(P.orb)tween(.5,t=>{const k=1+Math.sin(t*Math.PI)*.9;P.orb.scale.setScalar(k);P.glow.intensity=.7+Math.sin(t*Math.PI)*2.5;});}
function flash(p,hex,power,dur){const l=new THREE.PointLight(hex,power||3,6);l.position.copy(p);fxg.add(l);tween(dur||.35,t=>{l.intensity=(power||3)*(1-t);},()=>fxg.remove(l));}
function burst(p,el,n){const c1=C(ELC[el]),c2=C(ELC[el]).lerp(C(0xffffff),.6);n=n||40;for(let i=0;i<n;i++){const v=rnd3(1).normalize().multiplyScalar(rnd(1.5,4.5));SPARK.emit(p,v,Math.random()<.5?c1:c2,rnd(.35,.7),{grav:el==="water"||el==="earth"?4:el==="fire"?-1:1,drag:2});}
  if(el==="shadow"||el==="air"||el==="earth")for(let i=0;i<10;i++)PUFF.emit(p,rnd3(1).multiplyScalar(1.2),C(ELC[el]).multiplyScalar(el==="shadow"?.5:.3),.6,{drag:2});
  const ring=new THREE.Mesh(new THREE.RingGeometry(.3,.4,32),new THREE.MeshBasicMaterial({color:ELC[el],transparent:true,opacity:.9,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));ring.position.copy(p);ring.lookAt(cam.position);fxg.add(ring);
  tween(.4,t=>{ring.scale.setScalar(1+t*4);ring.material.opacity=.9*(1-t);},()=>fxg.remove(ring));}
function bolt(a,b,hex){const lines=[];for(let k=0;k<3;k++){const pts=[];const n=9;for(let i=0;i<=n;i++){const p=a.clone().lerp(b,i/n);if(i>0&&i<n)p.add(rnd3(.22));pts.push(p);}
  const geo=new THREE.BufferGeometry().setFromPoints(pts);const l=new THREE.Line(geo,new THREE.LineBasicMaterial({color:k===0?0xffffff:hex,transparent:true,opacity:1,blending:THREE.AdditiveBlending}));fxg.add(l);lines.push(l);}
  tween(.3,t=>{lines.forEach((l,i)=>{l.visible=Math.sin(t*40+i)>-.3;l.material.opacity=1-t;});},()=>lines.forEach(l=>fxg.remove(l)));
  for(let i=0;i<12;i++){const p=a.clone().lerp(b,Math.random());SPARK.emit(p,rnd3(2),C(hex),.3,{grav:3});}}
function beam(a,b,hex){const d=b.clone().sub(a);const len=d.length();const geo=new THREE.CylinderGeometry(.06,.06,len,10,1,true);const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  m.position.copy(a).add(d.multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());fxg.add(m);
  tween(.4,t=>{m.scale.set(1+t*3,1,1+t*3);m.material.opacity=.95*(1-t);},()=>fxg.remove(m));}
function rocks(a,b,T,done){const n=4;let left=n;for(let i=0;i<n;i++){const r=new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(.1,.18)),mat(0x8a6a44));fxg.add(r);const off=rnd3(.35);const delay=i*.08;
  tween(T+delay,t=>{const u=Math.max(0,(t*(T+delay)-delay)/T);const p=a.clone().lerp(b,u).add(off.clone().multiplyScalar(1-u));p.y+=1.4*u*(1-u)*4*.35;r.position.copy(p);r.rotation.x+=.2;r.rotation.y+=.15;},()=>{fxg.remove(r);burst(b,"earth",12);if(--left===0&&done)done();});}}
function spell(el,side,onHit){const from=who(side),to=side==="foe"?me:foe;if(!from||!to)return onHit&&setTimeout(onHit,300);
  armCast(from);const a=hand(from),b=centre(to);const col=C(ELC[el]),col2=C(ELC[el]).lerp(C(0xffffff),.5);const dir=b.clone().sub(a);const dist=dir.length();dir.normalize();
  let T=.6;
  if(el==="lightning"){bolt(a,b,ELC[el]);flash(a,ELC[el],4,.2);T=.15;}
  else if(el==="light"){beam(a,b,ELC[el]);flash(a,ELC[el],3,.3);T=.3;}
  else if(el==="earth"){rocks(a,b,.7);T=.75;}
  else{const dur=.45,spd=dist/(T-.05);const per={shadow:3,air:6,ice:6}[el]||8;
    tween(dur,t=>{for(let i=0;i<per;i++){const sp=rnd3(el==="air"?.9:.45);const v=dir.clone().multiplyScalar(spd).add(sp);if(el==="water")v.y+=1.2;if(el==="fire")v.y+=.3;
      const p=a.clone().add(rnd3(.08));(el==="shadow"?PUFF:SPARK).emit(p,v,Math.random()<.5?col:col2,T+.25,{grav:el==="water"?2.5:el==="ice"?1:el==="fire"?-.5:0,drag:el==="air"?1.5:0});
      if(el==="air"&&i===0){const s=Math.sin(t*30),c=Math.cos(t*30);SPARK.emit(a.clone().lerp(b,t).add(new THREE.Vector3(s*.5,c*.5,0)),rnd3(.3),col2,.4);}}});
    flash(a,ELC[el],2.5,.5);}
  setTimeout(()=>{burst(b,el);flash(b,ELC[el],el==="earth"||el==="fire"?5:3,.4);shake(el==="earth"?.26:el==="lightning"?.18:.12);onHit&&onHit();},T*1000);}
function fizzle(side){const g=who(side);if(!g)return;armCast(g);const p=hand(g);for(let i=0;i<14;i++)PUFF.emit(p,new THREE.Vector3(rnd(-.3,.3),rnd(.3,1),rnd(-.3,.3)),C(0x9a9a9a).multiplyScalar(.35),.9,{drag:1.5});for(let i=0;i<8;i++)SPARK.emit(p,new THREE.Vector3(rnd(-.6,.6),rnd(-1,.2),rnd(-.6,.6)),C(0xcccccc),.5,{grav:4});
  const P=g.userData;if(P.glow)tween(.6,t=>{P.glow.intensity=Math.random()<.5?0:1.2;},()=>{P.glow.intensity=.7;});}
function shieldOn(side,el){shieldOff(side,false);const g=who(side);if(!g)return;const c=centre(g);const r=side==="foe"&&foe&&foe.userData.body?1.3:1.0;
  const s=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),new THREE.MeshBasicMaterial({color:ELC[el],transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  const w=new THREE.Mesh(new THREE.IcosahedronGeometry(r*1.02,1),new THREE.MeshBasicMaterial({color:ELC[el],wireframe:true,transparent:true,opacity:.5,depthWrite:false}));s.add(w);s.position.copy(c);s.userData.el=el;fxg.add(s);shields[side]=s;
  s.scale.setScalar(.1);tween(.35,t=>s.scale.setScalar(ease(t)));burst(c,el,18);flash(c,ELC[el],2,.4);}
function shieldOff(side,broke){const s=shields[side];if(!s)return;shields[side]=null;const el=s.userData.el;
  if(broke){const p=s.position.clone();for(let i=0;i<50;i++)SPARK.emit(p.clone().add(rnd3(.9)),rnd3(1).normalize().multiplyScalar(rnd(2,5)),C(ELC[el]),.6,{grav:5});flash(p,ELC[el],4,.3);shake(.15);fxg.remove(s);}
  else tween(.3,t=>{s.material.opacity=.28*(1-t);s.scale.setScalar(1+t*.4);},()=>fxg.remove(s));}
function heal(side){const g=who(side);if(!g)return;armCast(g);const base=new THREE.Vector3();g.getWorldPosition(base);
  tween(.9,t=>{for(let i=0;i<3;i++){const a=Math.random()*Math.PI*2;SPARK.emit(base.clone().add(new THREE.Vector3(Math.cos(a)*.6,.1,Math.sin(a)*.6)),new THREE.Vector3(0,rnd(1.2,2.4),0),C(ELC.heal),.8,{drag:.5});}});
  flash(centre(g),ELC.heal,3,.9);setEmissive(g,0x2fa65a,.6);setTimeout(()=>setEmissive(g,null),700);}
function charge(side){const g=who(side);if(!g)return;armCast(g);const P=g.userData;const base=centre(g);
  tween(1,t=>{const a=t*Math.PI*6;for(let i=0;i<2;i++){const aa=a+i*Math.PI;SPARK.emit(base.clone().add(new THREE.Vector3(Math.cos(aa)*.8,(t-.5)*1.4,Math.sin(aa)*.8)),new THREE.Vector3(0,.6,0),C(ELC.gold),.5);}});
  if(P.orb)tween(.8,t=>{P.orb.scale.setScalar(1+t*.9);P.glow.intensity=.7+t*3;});flash(base,ELC.gold,3,1);}
function uncharge(side){const g=who(side);if(!g||!g.userData.orb)return;const P=g.userData;P.orb.scale.setScalar(1);P.glow.intensity=.7;}
function call(ok){if(!me||!foe)return;armCast(me);const a=hand(me),b=centre(foe);
  for(let k=0;k<3;k++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.25,.03,8,32),new THREE.MeshBasicMaterial({color:ELC.gold,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));ring.position.copy(a);fxg.add(ring);const d=b.clone().sub(a);
    tween(.8+k*.15,t=>{const u=Math.max(0,(t*(.8+k*.15)-k*.15)/.8);ring.position.copy(a).add(d.clone().multiplyScalar(u));ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d.clone().normalize());ring.scale.setScalar(1+u*6);ring.material.opacity=.9*(1-u);},()=>fxg.remove(ring));}
  setTimeout(()=>{if(!foe)return;if(ok){setEmissive(foe,0xffd36a,.9);flash(b,ELC.gold,4,.6);burst(b,"light",30);}else{const r0=foe.rotation.y;tween(.5,t=>{foe.rotation.y=r0+Math.sin(t*Math.PI*4)*.25;});}},700);}
function tamed(done){if(!foe)return done&&done();const g=foe;const p=centre(g);
  tween(.9,t=>{g.scale.multiplyScalar(1-.05*(1-t));g.position.y=t*1.2;g.rotation.y+=.2;},()=>{g.visible=false;const orb=new THREE.Mesh(new THREE.SphereGeometry(.18,12,10),glowMat(ELC.gold,2));orb.position.copy(p);orb.position.y+=1.2;fxg.add(orb);const to=centre(me);
    tween(.6,t=>{orb.position.lerpVectors(p.clone().setY(p.y+1.2),to,ease(t));SPARK.emit(orb.position,rnd3(.5),C(ELC.gold),.4);},()=>{fxg.remove(orb);burst(to,"light",40);flash(to,ELC.gold,5,.6);done&&done();});});}
function defeat(side){const g=who(side);if(!g)return;setEmissive(g,0x330000,.4);const r0=g.rotation.x;const s=side==="foe"?-1:1;
  tween(.6,t=>{g.rotation.x=r0+s*ease(t)*Math.PI/2*(g.userData.body?.6:1);g.position.y=-ease(t)*.1;},()=>fadeOut(g,.5));
  shake(.2);for(let i=0;i<20;i++)PUFF.emit(centre(g),rnd3(1).multiplyScalar(.8),C(0x6a5a7a).multiplyScalar(.3),.9,{drag:1.5});}
function flinch(side){const g=who(side);if(!g)return;setEmissive(g,0xff2a2a,1.1);const p0=g.position.clone();const d=side==="foe"?-1:1;
  tween(.28,t=>{g.position.copy(p0);g.position.z+=d*Math.sin(t*Math.PI)*.35;g.position.x+=Math.sin(t*Math.PI*6)*.05;},()=>{g.position.copy(p0);setEmissive(g,null);});}
function shake(k){camShake=Math.max(camShake,k);}
function pop(side,text,cls){const g=who(side);if(!g)return;const p=centre(g);p.y+=.3;const v=p.project(cam);const x=(v.x+1)/2*innerWidth,y=(1-v.y)/2*innerHeight;const el=document.createElement("span");el.className=cls||"";el.textContent=text;el.style.left=x+"px";el.style.top=y+"px";$("#nums").appendChild(el);setTimeout(()=>el.remove(),1000);}
function stormTo(left){if(!storm)return;const r=2.4+left*.8;const s0=storm.scale.x;tween(.8,t=>{const r1=s0+(r-s0)*ease(t);storm.scale.set(r1,1,r1);storm.userData.ring.scale.set(r1,r1,1);});shake(.1);}

// ---- camera
function bandCentre(){const bar=$("#bar"),bot=mode==="world"?$("#world"):$("#stage");const top=bar?bar.getBoundingClientRect().bottom:0;const b=bot&&bot.offsetParent!==null?bot.getBoundingClientRect().top:innerHeight;return (top+b)/2;}
let bandY=.5,bandT=0;
function camTargets(){if(mode==="world"&&playerW){const p=playerW.position;camBase.set(p.x,p.y+6.0,p.z+6.8);camLook.set(p.x,p.y+.2,p.z-1.4);}else{camBase.set(2.6,3.3,6.3);camLook.set(-.4,.8,-2.2);}}
function snapCam(){camTargets();cam.position.copy(camBase);}
function aimCam(dt){camTargets();cam.position.lerp(camBase,mode==="world"?1-Math.pow(.001,dt):1-Math.pow(.01,dt));
  if(camShake>0){cam.position.add(rnd3(camShake*.5));camShake=Math.max(0,camShake-dt*.8);}
  cam.lookAt(camLook);
  const c=Math.max(-.3,Math.min(.3,1-2*bandY));cam.rotateX(-Math.atan(c*Math.tan(cam.fov*Math.PI/360)));}
function resize(){const w=innerWidth,h=innerHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}
addEventListener("resize",resize);resize();

// ---- taps on the world move you one step toward the tile you tapped
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
canvas.addEventListener("pointerdown",e=>{if(mode!=="world"||walking||!window.__latin.S||window.__latin.S.mode)return;ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(ndc,cam);const hit=ray.intersectObjects(tiles,false)[0];if(!hit)return;const t=hit.object.userData.tile;const dx=Math.sign(t.x-W.x),dy=Math.sign(t.y-W.y);if(!dx&&!dy)return;if(Math.abs(t.x-W.x)>=Math.abs(t.y-W.y))window.__latin.move(dx,0);else window.__latin.move(0,dy);});

// ---- the frame loop
const clock=new THREE.Clock();let tAcc=0;
function frame(){requestAnimationFrame(frame);const dt=Math.min(.05,clock.getDelta());tAcc+=dt;
  tweens=tweens.filter(w=>{w.t+=dt;const t=Math.min(1,w.t/w.dur);w.fn(t);if(t>=1){w.done&&w.done();return false;}return true;});
  SPARK.step(dt);PUFF.step(dt);
  bandT+=dt;if(bandT>.4){bandT=0;bandY=bandCentre()/innerHeight;}
  // idle life
  if(mode==="battle"){if(me){me.position.y=ME_POS.y+Math.sin(tAcc*2)*.02;}if(foe&&foe.visible){const b=foe.userData.body;if(b){foe.position.y=FOE_POS.y+Math.abs(Math.sin(tAcc*2.4))*.08;const k=1+Math.sin(tAcc*3)*.03;b.scale.set(k,.8*k,1.3);if(foe.userData.wingL){foe.userData.wingL.rotation.z=-.5-Math.sin(tAcc*6)*.35;foe.userData.wingR.rotation.z=.5+Math.sin(tAcc*6)*.35;}}else foe.position.y=FOE_POS.y+Math.sin(tAcc*2+1)*.02;}
    if(famM){famM.position.y=FAM_POS.y+Math.abs(Math.sin(tAcc*3))*.05;}
    ["me","foe"].forEach(s=>{const sh=shields[s];if(sh){sh.rotation.y+=dt*.6;sh.rotation.x+=dt*.2;const g=who(s);if(g)sh.position.copy(centre(g));}});
    if(storm){storm.rotation.y+=dt*.15;storm.material.opacity=.2+Math.sin(tAcc*2)*.05;}}
  else if(mode==="world"&&playerW&&!walking){playerW.position.y=tileTop(W.x,W.y)+Math.sin(tAcc*2)*.015;}
  aimCam(dt);R.render(scene,cam);}
frame();

window.g3={world,walk,arena,spell,fizzle,shieldOn,shieldOff,heal,charge,uncharge,call,tamed,defeat,flinch,pop,shake,stormTo,
  idle(){mode=mode;},refreshLook(){lookKey="";if(mode==="world")placePlayer();},get mode(){return mode;},get scene(){return scene;},get cam(){return cam;}};
})();
