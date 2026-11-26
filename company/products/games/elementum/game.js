// Elementum — step 1: a body that moves in a world; step 2: guns, a range, health bars; step 3: 25 spells, monsters, mining, an inventory and a math forge.
// Three.js r158 (vendored as three.min.js). Third-person: the camera orbits behind the body, the body aims
// where the camera looks. Keyboard + mouse on a computer, joystick + drag + buttons on a phone. Test hooks: window.__el.
(function(){
const $=s=>document.querySelector(s);
const canvas=$("#gl");
const R=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
R.setPixelRatio(Math.min(2,window.devicePixelRatio||1));R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
if("outputColorSpace" in R)R.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();LOOK.world(scene);   // sky, painted horizon, grass, path, trees (look.js)
const cam=new THREE.PerspectiveCamera(60,1,.1,300);
FX.init(scene,cam);   // the ported Binbun3D effects (fx.js)
const HEMI=new THREE.HemisphereLight(0xcfe8ff,0x6a8a4a,1.0);scene.add(HEMI);
const sun=new THREE.DirectionalLight(0xfff0d8,1.6);sun.position.set(18,30,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:120});scene.add(sun);
const mat=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.85,metalness:.02},o||{}));
const glow=(c,i)=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:i||1,roughness:.3});
// while the world is being built, "random" is the same for every player (same trees, same buildings, same rocks); RNG becomes truly random at the end
const seedRnd=n=>{let a=n>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};};
let RNG=seedRnd(1);
const rnd=(a,b)=>a+RNG()*(b-a);const pick=a=>a[Math.floor(RNG()*a.length)];const rnd3=k=>new THREE.Vector3(rnd(-k,k),rnd(-k,k),rnd(-k,k));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let tweens=[];function tween(dur,fn,done){tweens.push({t:0,dur,fn,done});}
let tAcc=0;

// ---------------- the world ----------------
const ground=scene.children.find(o=>o.isMesh&&o.geometry.type==="PlaneGeometry");
const BLOCKS=[];const SOLIDS=[ground];// axis-aligned boxes the body can bump into and climb onto: {x,y,z,w,h,d}
function block(x,z,w,h,d,shade){const m=LOOK.blockMesh(w,h,d,shade||0xa6a6a9);m.position.set(x,h/2,z);m.castShadow=m.receiveShadow=true;scene.add(m);
  if(w===1.2&&d===1.2&&h>=5){m.material.visible=false;m.castShadow=false;const c=LOOK.column(h);c.position.set(x,0,z);scene.add(c);}   // the tall thin blocks are drawn as Roman columns
  const rec={x,y:0,z,w,h,d,mesh:m,marks:[]};m.userData.block=rec;m.renderOrder=2;BLOCKS.push(rec);SOLIDS.push(m);return m;}
block(6,-4,3,.5,3,0xb0b0b3);block(9,-4,3,1,3,0xa8a8ab);block(12,-4,3,1.5,3,0xa0a0a3);block(15,-4,3,2,3,0x98989b);block(19,-4,5,2.5,5,0x909093);
block(-8,6,6,2.2,1,0xa4a4a7);block(-8,10,1,2.2,8,0xa4a4a7);
block(-6,-9,2,1.1,2,0xb4b4b7);block(-10,-12,2,2.4,2,0x9c9c9f);block(2,12,8,.4,8,0xb8b8bb);
block(0,-30,1.2,6,1.2,0x8a8a8d);block(-20,0,1.2,6,1.2,0x8a8a8d);block(20,14,1.2,6,1.2,0x8a8a8d);block(-16,-22,1.2,6,1.2,0x8a8a8d);
for(let i=0;i<14;i++){const a=i/14*Math.PI*2;block(Math.cos(a)*34,Math.sin(a)*34,2,1+(i%3),2,0x9d9da0);}
// the shooting range: a low wall behind the dummies so shots have something to hit
block(0,-24,22,2.6,1,0x7e7e82);
// ---------------- the town (Oppidum): big walls, four gates; a safe zone — monsters never come in, and their spells can't hurt you inside ----------------
const TOWN={x0:-45,x1:45,z0:-36,z1:42,gate:3};   // walls on the edges; each gate is 6 m wide, in the middle of its side (east and west gates line up with the range, z = -5)
// Nova Urbs, the new city, joins on to the east (2026-11-21): the old east gate leads into it; both are safe from monsters
const CITY={x0:TOWN.x1,x1:135,z0:TOWN.z0,z1:TOWN.z1,gz:-5,XS:[50,72,94,116],ZS:[-5,17]};
// the gas station just outside the east gate is safe ground too (guards there; monsters keep out and can't hurt you)
const GAS_SAFE={x0:CITY.x1,x1:157,z0:-31,z1:-1};
const inTown=(p,m)=>{m=m||0;return (p.x>TOWN.x0-m&&p.x<CITY.x1+m&&p.z>TOWN.z0-m&&p.z<TOWN.z1+m)||(p.x>GAS_SAFE.x0-m&&p.x<GAS_SAFE.x1+m&&p.z>GAS_SAFE.z0-m&&p.z<GAS_SAFE.z1+m);};
{const H=6,T=1.6,TW=3,TH=8,gz=-5;const tone=0x9e968a;
  // north and south walls, with a gate at x = 0
  [TOWN.z0,TOWN.z1].forEach(z=>{const a=TOWN.gate+TW,len=TOWN.x1-a;block(a+len/2,z,len,H,T,tone);block(-(a+len/2),z,len,H,T,tone);
    block(TOWN.gate+TW/2,z,TW,TH,TW,0x8f877c);block(-(TOWN.gate+TW/2),z,TW,TH,TW,0x8f877c);});
  // the west wall, with a gate at z = -5 (Oppidum and Nova Urbs are one walled city now — no wall between them, 2026-11-22)
  [TOWN.x0].forEach(x=>{const a=gz-TOWN.gate-TW,b=gz+TOWN.gate+TW;block(x,(TOWN.z0+a)/2,T,H,a-TOWN.z0,tone);block(x,(b+TOWN.z1)/2,T,H,TOWN.z1-b,tone);
    block(x,gz-TOWN.gate-TW/2,TW,TH,TW,0x8f877c);block(x,gz+TOWN.gate+TW/2,TW,TH,TW,0x8f877c);});
  // an arch over each gate (looks only — you walk under it) and a sign on both sides
  const GATES=[[0,TOWN.z1,0],[0,TOWN.z0,0],[TOWN.x0,gz,1]];
  GATES.forEach(([x,z,side])=>{const w=TOWN.gate*2+TW*2;const arch=LOOK.blockMesh(side?TW:w,1.2,side?w:TW,0x8f877c);arch.position.set(x,TH-.6,z);arch.castShadow=true;scene.add(arch);
    const out=side?new THREE.Vector3(Math.sign(x),0,0):new THREE.Vector3(0,0,Math.sign(z));
    (x===TOWN.x1?[[1,"Nova Urbs — the new city",0x9dd8ff],[-1,"Oppidum — the old town",0x9dffb0]]:[[1,"The wilds — monsters ahead",0xffb08a],[-1,"Oppidum — safe inside these walls",0x9dffb0]]).forEach(([k,t,hex])=>{const s=label(t,hex);s.scale.set(5.2,.95,1);s.position.set(x,TH+.9,z).addScaledVector(out,k*1.8);scene.add(s);});});
  // banners on the towers
  [[TOWN.gate+TW/2,TOWN.z1],[-(TOWN.gate+TW/2),TOWN.z1],[TOWN.gate+TW/2,TOWN.z0],[-(TOWN.gate+TW/2),TOWN.z0]].forEach(([x,z])=>{const f=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.4),new THREE.MeshLambertMaterial({color:0xb5392b,side:THREE.DoubleSide}));f.position.set(x,TH-2,z+Math.sign(z)*1.55);scene.add(f);});}

// ---------------- particles, flashes, tracers ----------------
function dotTex(){const c=document.createElement("canvas");c.width=c.height=64;const x=c.getContext("2d");const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(.35,"rgba(255,255,255,.7)");g.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
function starTex(){const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");x.translate(64,64);x.fillStyle="#fff";for(let k=0;k<2;k++){x.beginPath();x.moveTo(0,-60);x.quadraticCurveTo(4,-4,60,0);x.quadraticCurveTo(4,4,0,60);x.quadraticCurveTo(-4,4,-60,0);x.quadraticCurveTo(-4,-4,0,-60);x.fill();x.rotate(Math.PI/4);x.scale(.55,.55);}const g=x.createRadialGradient(0,0,0,0,0,26);g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=g;x.beginPath();x.arc(0,0,26,0,7);x.fill();return new THREE.CanvasTexture(c);}
const TEX=dotTex(),STAR=starTex();
function pool(n,size){const geo=new THREE.BufferGeometry();const pos=new Float32Array(n*3),col=new Float32Array(n*3);for(let i=0;i<n;i++)pos[i*3+1]=-99;
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3));geo.setAttribute("color",new THREE.BufferAttribute(col,3));
  const m=new THREE.PointsMaterial({size,map:TEX,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});const pts=new THREE.Points(geo,m);pts.frustumCulled=false;scene.add(pts);
  const Q=[];for(let i=0;i<n;i++)Q.push({life:0});let next=0;
  return{emit(p,v,c,life,o){o=o||{};const q=Q[next];next=(next+1)%n;q.x=p.x;q.y=p.y;q.z=p.z;q.vx=v.x;q.vy=v.y;q.vz=v.z;q.life=q.max=life;q.r=c.r;q.g=c.g;q.b=c.b;q.grav=o.grav||0;q.drag=o.drag||0;},
    step(dt){for(let i=0;i<n;i++){const q=Q[i];if(q.life>0){q.life-=dt;if(q.grav)q.vy-=q.grav*dt;if(q.drag){const k=Math.max(0,1-q.drag*dt);q.vx*=k;q.vy*=k;q.vz*=k;}q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;const a=Math.max(0,q.life/q.max);pos[i*3]=q.x;pos[i*3+1]=q.y;pos[i*3+2]=q.z;col[i*3]=q.r*a;col[i*3+1]=q.g*a;col[i*3+2]=q.b*a;}else if(pos[i*3+1]>-90){pos[i*3+1]=-99;col[i*3]=col[i*3+1]=col[i*3+2]=0;}}
      geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;}};}
const SPARK=pool(800,.12),PUFF=pool(200,.5);
const C=h=>new THREE.Color(h);
// a few lights live in the scene for good and are borrowed for flashes: adding or removing a light makes every material rebuild (the lightning lag)
const FLASHES=[];for(let i=0;i<6;i++){const l=new THREE.PointLight(0xffffff,0,7);scene.add(l);FLASHES.push({l,until:0});}let flashN=0;
function flash(p,hex,power,dur){const f=FLASHES[flashN++%FLASHES.length];const l=f.l;l.color.setHex(hex);l.position.copy(p);l.intensity=power||3;const id=++f.until;tween(dur||.12,t=>{if(f.until===id)l.intensity=(power||3)*(1-t);},()=>{if(f.until===id)l.intensity=0;});}
function muzzle(p,dir,hex,size){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:STAR,color:hex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));s.position.copy(p).add(dir.clone().multiplyScalar(.12));s.scale.setScalar(size||.5);s.material.rotation=Math.random()*6;scene.add(s);
  tween(.07,t=>{s.scale.setScalar((size||.5)*(1+t*.8));s.material.opacity=1-t;},()=>scene.remove(s));flash(p,hex,4,.1);
  for(let i=0;i<6;i++)SPARK.emit(p,dir.clone().multiplyScalar(rnd(6,12)).add(rnd3(2)),C(0xffd27a),.15,{drag:6});}
function tracer(a,b,hex){const geo=new THREE.BufferGeometry().setFromPoints([a,b]);const m=new THREE.LineBasicMaterial({color:hex,transparent:true,opacity:.9,blending:THREE.AdditiveBlending});const l=new THREE.Line(geo,m);scene.add(l);
  tween(.09,t=>{m.opacity=.9*(1-t);},()=>scene.remove(l));}
function sparks(p,n,hex,normal){const c1=C(hex),c2=C(0xffffff);for(let i=0;i<n;i++){const v=rnd3(1).normalize();if(normal&&v.dot(normal)<0)v.negate();v.multiplyScalar(rnd(2,6));SPARK.emit(p,v,Math.random()<.6?c1:c2,rnd(.25,.5),{grav:9,drag:1.5});}
  for(let i=0;i<4;i++)PUFF.emit(p,rnd3(.6),C(0x888888).multiplyScalar(.5),.35,{drag:3});}
function ring(p,hex,size){const r=new THREE.Mesh(new THREE.RingGeometry(.3,.42,32),new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:.95,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));r.position.copy(p);r.lookAt(cam.position);scene.add(r);
  tween(.35,t=>{r.scale.setScalar(1+t*(size||5));r.material.opacity=.95*(1-t);},()=>scene.remove(r));}
let camShake=0;function shake(k){camShake=Math.max(camShake,k);}

// ---------------- the body ----------------
const body=new THREE.Group();scene.add(body);
// the hero from Gemini's concept art (look.js): teal cloak, cream tunic, orange crystal, brown boots
const HERO=LOOK.hero();const {hips,torso,head,armL,armR,legL,legR}=HERO;body.add(hips);
// the hero: KayKit's hooded ranger (models/hero.glb, CC0) with real animations; the shape-built body above shows until it loads (or if it can't)
let RIG=null;const gunMount=new THREE.Group();scene.add(gunMount);
// anything that isn't a weapon is held as its picture cut out in 3D (a stack of thin layers, so it has thickness from the side)
const itemMount=new THREE.Group();itemMount.visible=false;scene.add(itemMount);const HELD={k:"",mesh:null};
function heldMesh(k){const g=new THREE.Group(),geo=new THREE.PlaneGeometry(1,1),tex=picTex(k);
  for(let i=0;i<7;i++){const edge=i>0&&i<6;const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:tex,alphaTest:.5,side:THREE.DoubleSide,roughness:.6,color:edge?0x9a9a9a:0xffffff}));
    m.position.z=(i-3)*.012;m.castShadow=true;g.add(m);}
  return g;}
function setHeld(it){const k=it&&it.t!=="weapon"?picKey(it):"";itemMount.visible=!!k;if(k===HELD.k)return;HELD.k=k;
  if(HELD.mesh){itemMount.remove(HELD.mesh);HELD.mesh=null;}if(!k)return;
  const sz=it.t==="spell"?.5:it.t==="coin"?.3:.42;HELD.mesh=heldMesh(k);HELD.mesh.scale.setScalar(sz);HELD.mesh.position.set(0,sz*.38,0);itemMount.add(HELD.mesh);}
let SIT_CLIP=null;
LOOK.loadRig("/play/elementum/models/hero.glb",true,r=>{if(!r)return;RIG=r;if(THREE.GLTFLoader)new THREE.GLTFLoader().load("/play/elementum/models/villager.glb",g=>{const c=g.animations.find(c=>/Sit_Chair_Idle/.test(c.name));if(c){r.clips.Sit_Chair_Idle=c;SIT_CLIP=c;}});   // the hero has no sitting pose: borrow the villagers' (same skeleton)
  LOOK.heroHair(r);r.root.scale.setScalar(1.05);r.root.rotation.y=Math.PI;body.add(r.root);hips.visible=false;
  r.base("Idle",{snap:true});r.up("2H_Ranged_Aiming",{snap:true});});
const shadowDisc=new THREE.Mesh(new THREE.CircleGeometry(.35,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.18,depthWrite:false}));shadowDisc.rotation.x=-Math.PI/2;shadowDisc.position.y=.015;body.add(shadowDisc);
const P={pos:new THREE.Vector3(0,0,0),vel:new THREE.Vector3(),yaw:0,onGround:true,run:false,phase:0,speed:0,hp:100,maxHp:100,lastHit:-99,down:false,downed:0};
const RADIUS=.35,HEIGHT=1.8,WALK=4.2,RUN=7.5,JUMP=7.2,GRAV=22,STEP=.6;

// ---------------- guns ----------------
// the three weapon types from the design document, in gray-world form
const WEAPONS={
  rifle:{name:"Magna Rifle",weak:true,dmg:24,head:1.5,rate:9,mag:30,reload:1.6,spread:.012,auto:true,range:90,hex:0xffd27a,kick:.004,flash:.5},
  shotgun:{name:"Chaos Shotgun",dmg:9,pellets:10,head:1.5,rate:1.2,mag:6,reload:2.1,spread:.07,auto:false,range:18,hex:0xffb060,kick:.025,flash:.8},
  staff:{name:"Orator Staff",dmg:110,head:1,rate:.7,mag:4,reload:2.3,spread:0,auto:false,range:120,hex:0x8fd4ff,kick:.012,flash:.6,projectile:true},
  // crafted at the forge
  repeater:{name:"Fulmen Repeater",model:"rifle",tint:0x4a5fd0,dmg:14,head:1.5,rate:14,mag:50,reload:2,spread:.02,auto:true,range:80,kick:.003,flash:.4,what:"very fast, 50 rounds"},
  cannon:{name:"Terra Cannon",model:"shotgun",tint:0x8a5a32,size:1.25,dmg:150,head:1,rate:.6,mag:2,reload:2.8,spread:0,auto:false,range:100,kick:.04,flash:1.1,projectile:true,boltSize:2.6,boltSpeed:22,r:4.5,power:6,what:"huge blast, 2 shells"},
  arcus:{name:"Ventus Arcus",model:"rifle",tint:0xdfe8f0,stretch:1.35,dmg:85,head:2,rate:.9,mag:5,reload:2.2,spread:0,auto:false,range:160,kick:.02,flash:.6,what:"long range, 2× head shots"},
};
// elemental crystals from the design document: the crystal in the gun decides the element every shot carries
const CRYSTALS={carbo:{name:"Carbo",el:"fire",status:"burn"},nimbus:{name:"Nimbus",el:"water",status:"soak"},silex:{name:"Silex",el:"earth",status:"weight"},aether:{name:"Aether",el:"air",status:"stagger"},electrum:{name:"Electrum",el:"lightning",status:"charge"}};
const G={id:"rifle",crystal:"carbo",ammo:30,reloading:0,reloadT:1,cool:0,recoil:0,firing:false,firedOnce:false,mesh:null};
const crystalEl=()=>CRYSTALS[G.crystal].el;
function cycleCrystal(){const ids=Object.keys(CRYSTALS).filter(k=>k==="carbo"||countMat(k)>0);   // only crystals you have a core of (Carbo is the starter)
  if(ids.length<2){popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"mine crystal cores to switch","burn");return;}G.crystal=ids[(ids.indexOf(G.crystal)+1)%ids.length];tintGun();hud();if(G.mesh){const m=muzzleWorld();FX.stars(m,crystalEl(),3,.6);FX.flare(m,new THREE.Vector3(0,1,0),crystalEl(),.5,.3);}}
function tintGun(){if(!G.mesh)return;const hex=FX.HEX[crystalEl()];G.mesh.traverse(o=>{if(o.userData.crystal){o.material.color.setHex(hex);o.material.emissive.setHex(hex);}if(o.isPointLight)o.color.setHex(hex);});}
function gunModel(id){const g=new THREE.Group();const m=mat(0x3a3a40,{metalness:.35,roughness:.5}),m2=mat(0x58585e,{metalness:.3,roughness:.6});
  if(id==="rifle"){const b=new THREE.Mesh(new THREE.BoxGeometry(.07,.5,.12),m);b.position.y=-.2;g.add(b);const br=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.42,10),m2);br.position.set(0,-.62,-.02);g.add(br);const st=new THREE.Mesh(new THREE.BoxGeometry(.06,.18,.09),m2);st.position.set(0,.06,.03);g.add(st);const mag=new THREE.Mesh(new THREE.BoxGeometry(.05,.16,.06),m2);mag.position.set(0,-.22,.1);g.add(mag);g.userData.mag=mag;const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.045),glow(0xff7b3a,1.4));gem.position.set(0,-.3,-.09);gem.userData.crystal=true;g.add(gem);g.userData.muzzle=new THREE.Vector3(0,-.84,-.02);}
  else if(id==="shotgun"){const b=new THREE.Mesh(new THREE.BoxGeometry(.08,.42,.12),m);b.position.y=-.16;g.add(b);const br=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.5,10),m2);br.position.set(0,-.6,-.03);g.add(br);const br2=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.46,10),m2);br2.position.set(0,-.58,.03);g.add(br2);const pump=new THREE.Mesh(new THREE.BoxGeometry(.06,.14,.07),mat(0x6b4a2a));pump.position.set(0,-.5,0);g.add(pump);g.userData.mag=pump;const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.05),glow(0xff7b3a,1.4));gem.position.set(0,-.28,-.1);gem.userData.crystal=true;g.add(gem);g.userData.muzzle=new THREE.Vector3(0,-.86,-.03);}
  else{const rod=new THREE.Mesh(new THREE.CylinderGeometry(.02,.025,1.1,10),mat(0x6b4a2a));rod.position.y=-.35;g.add(rod);const orb=new THREE.Mesh(new THREE.SphereGeometry(.07,14,12),glow(0x8fd4ff,1.6));orb.position.y=-.95;orb.userData.crystal=true;g.add(orb);const l=new THREE.PointLight(0x8fd4ff,.6,2.5);orb.add(l);g.userData.mag=orb;g.userData.muzzle=new THREE.Vector3(0,-1.0,0);}
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
function equip(id,it){const w=WEAPONS[id];if(G.mesh)gunMount.remove(G.mesh);G.id=id;G.item=it||null;G.mesh=gunModel(w.model||id);G.mesh.scale.setScalar(1.35*(w.size||1));if(w.stretch)G.mesh.scale.y*=w.stretch;
  if(w.tint)G.mesh.traverse(o=>{if(o.isMesh&&!o.userData.crystal){o.material=o.material.clone();o.material.color.lerp(new THREE.Color(w.tint),.7);}});
  gunMount.add(G.mesh);G.ammo=it&&it.ammo!=null?it.ammo:w.mag;G.reloading=0;G.cool=0;$("#wname").textContent=WEAPONS[id].name;tintGun();hud();}
function muzzleWorld(){const v=G.mesh.userData.muzzle.clone();return G.mesh.localToWorld(v);}
function aimRay(spread){const r=new THREE.Raycaster();r.setFromCamera({x:0,y:0},cam);const d=r.ray.direction.clone();if(spread){d.add(rnd3(spread)).normalize();}r.ray.direction.copy(d);r.far=WEAPONS[G.id].range;
  r.ray.origin.add(d.clone().multiplyScalar(1.2));return r;}   // start a little in front of the camera so the body itself is never hit
function reload(){const w=WEAPONS[G.id];if(G.reloading||G.ammo===w.mag)return;G.reloading=w.reload;G.reloadT=w.reload;}
function fire(){const w=WEAPONS[G.id];if(!held()||held().t!=="weapon"||G.cool>0||G.reloading||P.down||!started||paused||bagOpen)return;if(G.ammo<=0){reload();return;}
  const el=crystalEl(),hex=FX.HEX[el];
  if(RIG&&!w.auto)RIG.up("2H_Ranged_Shoot",{once:true,dur:.35,restart:true,then:()=>RIG.up("2H_Ranged_Aiming")});
  G.ammo--;if(G.item)G.item.ammo=G.ammo;mpFx("shot");G.cool=1/w.rate;G.recoil=1;look.pitch=clamp(look.pitch-w.kick,-.5,1.1);shake(w.kick*2.5);
  const m=muzzleWorld();const d0=aimRay(0).ray.direction.clone();muzzle(m,d0,hex,w.flash);FX.flare(m,d0,el,w.flash*1.3,.22);FX.stars(m,el,1,w.flash*.9);
  if(w.projectile){const r=aimRay(0);const hit=firstHit(r);const to=hit?hit.point:r.ray.at(w.range,new THREE.Vector3());bolt(m,to.clone().sub(m).normalize(),el,{size:w.boltSize,speed:w.boltSpeed,r:w.r,dmg:w.dmg,power:w.power});share({k:"shot",w:G.id,el,a:V3r(m),b:[V3r(to)]});hud();return;}
  const n=w.pellets||1,ends=[];for(let i=0;i<n;i++){const r=aimRay(w.spread);const hit=firstHit(r);const to=hit?hit.point:r.ray.at(w.range,new THREE.Vector3());tracer(m,to,hex);ends.push(V3r(to));
    if(hit){const dm=hit.object.userData.dummy,nd=hit.object.userData.node,tr=hit.object.userData.tree,pp=hit.object.userData.person;const wn=()=>hit.face?hit.face.normal.clone().transformDirection(hit.object.matrixWorld):null;
      if(pp){dent(hit.point,to.clone().sub(m).normalize().negate(),pp.o.g);hurtPerson(pp,Math.round(w.dmg*.6),hit.point);continue;}
      if(hit.object.userData.player){hitPlayer(hit.object.userData.player,Math.round(w.dmg*.5*(w.pellets?1:1)),hit.point);continue;}
      if(nd){dent(hit.point,wn(),nd.g);mineHit(nd,w.dmg,hit.point);continue;}if(tr){dent(hit.point,wn(),tr.g);chopHit(tr,w.dmg,hit.point);continue;}if(dm){const headshot=hit.object.userData.part==="head";if(w.weak&&dm.enemy){damage(dm,1,hit.point,false,{el});if(tAcc-(G.weakTip||-9)>4){G.weakTip=tAcc;popNum(hit.point.clone().add(new THREE.Vector3(0,.8,0)),"too tough for the Magna Rifle — craft a weapon or cast spells","burn");}}
      else damage(dm,Math.round(w.dmg*(headshot?w.head:1)),hit.point,headshot,{el});}
      else{const nn=hit.face?hit.face.normal.clone().transformDirection(hit.object.matrixWorld):null;if(nn&&hit.object.userData.block){if(hit.object.material.visible)wallHit(hit.object.userData.block,hit.point,nn,w.pellets?.4:1);else dent(hit.point,nn);}
        if(hit.object===ground)mark(hit.point,new THREE.Vector3(0,1,0),rnd(.12,.2),el==="ice"?0xd8f2ff:0x15110c,.7);
        sparks(hit.point,8,hex,nn);FX.impact(hit.point,el,.45);if(i===0)FX.stars(hit.point,el,1,.5);}}}
  share({k:"shot",w:G.id,el,a:V3r(m),b:ends});hud();}
// the staff fires a slow glowing bolt that explodes where it lands
const BOLTS=[];
function bolt(from,dir,el,o){o=o||{};const g=FX.comet(el||"lightning",o.size||1.5);g.position.copy(from);g.userData.aim(dir);scene.add(g);
  BOLTS.push({g,v:dir.clone().multiplyScalar(o.speed||26),life:o.life||3,el:el||"lightning",r:o.r,dmg:o.dmg,power:o.power,c:o.c||null,grav:o.grav||0,slow:o.slow,orb:o.orb||null,zap:0});}
function explode(p,el,o){o=o||{};const R=o.r||3.2,DM=o.dmg||WEAPONS.staff.dmg;const hex=FX.HEX[el];ring(p,hex,6*R/3.2);FX.impact(p,el,R);FX.stars(p,el,4,2.2);flash(p,hex,8,.35);shake(.12);
  for(let i=0;i<60;i++)SPARK.emit(p,rnd3(1).normalize().multiplyScalar(rnd(3,9)),Math.random()<.5?C(hex):C(0xffffff),rnd(.3,.7),{grav:6,drag:1.2});for(let i=0;i<10;i++)PUFF.emit(p,rnd3(1.5),C(hex).multiplyScalar(.5),.5,{drag:2});
  if(o.c&&o.c.ghost)return;scorch(p,R*.7,el);hitArea(o.c||PLAYER_C(),p,R,DM,el,{falloff:true,slow:o.slow});
  if(!o.c||!o.c.enemy)BUILDINGS.forEach(bd=>{if(bd.down)return;for(const b of bd.blks){const q=new THREE.Vector3(clamp(p.x,b.x-b.w/2,b.x+b.w/2),clamp(p.y,b.y+.3,b.y+b.h-.3),clamp(p.z,b.z-b.d/2,b.z+b.d/2));if(q.distanceTo(p)<R){wallHit(b,q,faceNormal(b,q),3);break;}}});}
// ---------------- marks: blasts and fire leave black scorched grass; shots leave dents and soot on trees, rocks, stalls and people. They fade after a while ----------------
const MARKS=[],markGeo=new THREE.CircleGeometry(1,20),SCORCHED=[];
const markTex=(()=>{const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");   // a ragged burn: solid in the middle, broken into specks toward the edge
  for(let i=0;i<1400;i++){const a=Math.random()*6.28,r=60*Math.sqrt(Math.random());if(Math.random()>1.15-r/60*1.1)continue;const px=64+Math.cos(a)*r,py=64+Math.sin(a)*r;
    x.fillStyle=`rgba(255,255,255,${(.35+.5*(1-r/60)).toFixed(2)})`;x.beginPath();x.arc(px,py,rnd(2,6)*(1.4-r/60),0,6.28);x.fill();}
  return new THREE.CanvasTexture(c);})();
function mark(p,n,size,hex,op,parent,life){const m=new THREE.Mesh(markGeo,new THREE.MeshBasicMaterial({color:hex,map:markTex,transparent:true,opacity:op,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4}));
  m.scale.setScalar(size);m.position.copy(p).addScaledVector(n,.03);m.lookAt(p.clone().add(n));m.rotateZ(Math.random()*6.28);m.renderOrder=3;
  if(parent){parent.updateMatrixWorld(true);parent.attach(m);}else scene.add(m);
  MARKS.push({m,t:life||90,op});if(MARKS.length>240){const o=MARKS.shift();o.m.removeFromParent();o.m.material.dispose();}}
function scorch(p,r,el){if(p.y>1.5||r<.3)return;if(SCORCHED.some(q=>q.t>tAcc-3&&Math.hypot(q.x-p.x,q.z-p.z)<r*.5))return;SCORCHED.push({x:p.x,z:p.z,t:tAcc});if(SCORCHED.length>40)SCORCHED.shift();share({k:"scorch",x:R2(p.x),z:R2(p.z),r:R2(r),el});
  const g=new THREE.Vector3(p.x,.02,p.z),up=new THREE.Vector3(0,1,0),hex=el==="ice"?0xd8f2ff:el==="water"?0x24402e:0x0d0b08;
  mark(g,up,r*.8,hex,.9);for(let i=0;i<3;i++)mark(g.clone().add(new THREE.Vector3(rnd(-.4,.4)*r,0,rnd(-.4,.4)*r)),up,r*rnd(.3,.5),hex,.7);}
function dent(p,n,parent){if(n)mark(p,n,rnd(.07,.13),0x1a1410,.78,parent);}
function stepMarks(dt){for(let i=MARKS.length-1;i>=0;i--){const k=MARKS[i];k.t-=dt;if(k.t<6)k.m.material.opacity=k.op*Math.max(0,k.t/6);if(k.t<=0){k.m.removeFromParent();k.m.material.dispose();MARKS.splice(i,1);}}}
// shortest distance from point q to the segment a-b
function segDist(a,b,q){const ab=b.clone().sub(a);const t=clamp(q.clone().sub(a).dot(ab)/Math.max(1e-6,ab.lengthSq()),0,1);return a.clone().addScaledVector(ab,t).distanceTo(q);}
function stepBolts(dt){for(let i=BOLTS.length-1;i>=0;i--){const b=BOLTS[i];if(b.grav){b.v.y-=b.grav*dt;b.g.userData.aim(b.v);}const p0=b.g.position.clone();b.g.position.addScaledVector(b.v,dt);b.life-=dt;const p=b.g.position;const near=q=>segDist(p0,p,q);SPARK.emit(p,rnd3(.6),C(FX.HEX[b.el]),.3);
    const enemy=b.c&&b.c.enemy;if(b.orb){b.zap-=dt;if(b.zap<=0){b.zap=.4;zapNear(b.c,p,b.orb.r,b.orb.dmg);}}
    let hit=p.y<=0.05||b.life<=0;
    if(!hit&&!b.orb){if(enemy){if(!enemy.ghost&&!b.c.ghost&&!P.down&&!inTown(P.pos)&&near(P.pos.clone().add(new THREE.Vector3(0,1,0)))<.9)hit=true;}
      else for(const d of DUMMIES){if(!d.down&&near(d.g.position.clone().add(new THREE.Vector3(0,1.3,0)))<.8){hit=true;break;}}}
    if(!hit){const n=Math.max(1,Math.ceil(p0.distanceTo(p)/.25));for(let k=1;k<=n;k++){const q=p0.clone().lerp(p,k/n);const bl=blockAt(q);if(bl){p.copy(q);hit=true;if(!(b.c&&b.c.ghost))wallHit(bl,q,faceNormal(bl,q),b.power||3);break;}}}   // walk the stretch so a fast bolt can't skip through a thin wall
    if(hit){explode(p.clone(),b.el,b);b.g.userData.dispose();BOLTS.splice(i,1);}}}
// a jagged lightning line between two points (Electrum chains)
function boltLine(a,b,hex){const lines=[];for(let k=0;k<3;k++){const pts=[];const n=9;for(let i=0;i<=n;i++){const p=a.clone().lerp(b,i/n);if(i>0&&i<n)p.add(rnd3(.2));pts.push(p);}
  const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:k===0?0xffffff:hex,transparent:true,opacity:1,blending:THREE.AdditiveBlending}));scene.add(l);lines.push(l);}
  tween(.25,t=>{lines.forEach((l,i)=>{l.visible=Math.sin(t*40+i)>-.3;l.material.opacity=1-t;});},()=>lines.forEach(l=>scene.remove(l)));flash(b,hex,4,.2);}

// ---------------- walls: every shot leaves a dent; dents grow; enough hits break a hole you can see and shoot through ----------------
const HOLE_AT=6,HOLE_R=.32;
function crater(rim){const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");
  if(rim){const g=x.createRadialGradient(64,64,30,64,64,64);g.addColorStop(0,"rgba(60,45,30,.85)");g.addColorStop(.35,"rgba(90,72,52,.6)");g.addColorStop(1,"rgba(90,72,52,0)");x.fillStyle=g;x.fillRect(0,0,128,128);}
  else{const g=x.createRadialGradient(58,58,2,64,64,64);g.addColorStop(0,"rgba(35,26,18,.95)");g.addColorStop(.45,"rgba(70,55,40,.75)");g.addColorStop(.75,"rgba(120,100,78,.35)");g.addColorStop(1,"rgba(120,100,78,0)");x.fillStyle=g;x.fillRect(0,0,128,128);}
  x.strokeStyle="rgba(40,30,20,.7)";x.lineWidth=2;for(let i=0;i<7;i++){let a=Math.random()*6.3,r=rim?40:12,px=64+Math.cos(a)*r,py=64+Math.sin(a)*r;x.beginPath();x.moveTo(px,py);for(let k=0;k<3;k++){a+=rnd(-.5,.5);r+=rnd(6,10);px=64+Math.cos(a)*r;py=64+Math.sin(a)*r;x.lineTo(px,py);}x.stroke();}
  const t=new THREE.CanvasTexture(c);if("colorSpace" in t)t.colorSpace=THREE.SRGBColorSpace;return t;}
const DENT=new THREE.MeshLambertMaterial({map:crater(false),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});
const RIM=new THREE.MeshLambertMaterial({map:crater(true),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});
const MASK=new THREE.MeshBasicMaterial({colorWrite:false});   // writes depth only; walls draw after it (renderOrder 2), so the wall is cut away there
const TUNNEL=new THREE.MeshLambertMaterial({color:0xa89a82,side:THREE.BackSide});
function decal(p,n,r,m,order){const d=new THREE.Mesh(new THREE.CircleGeometry(1,24),m);d.position.copy(p).addScaledVector(n,.006);d.lookAt(p.clone().add(n));d.rotateZ(Math.random()*6.3);d.scale.setScalar(r);if(order!==undefined)d.renderOrder=order;scene.add(d);return d;}
const axisN=n=>{const a=[Math.abs(n.x),Math.abs(n.y),Math.abs(n.z)];const k=a.indexOf(Math.max(...a));return new THREE.Vector3(k===0?Math.sign(n.x):0,k===1?Math.sign(n.y):0,k===2?Math.sign(n.z):0);};
function holeAt(b,p){for(const m of b.marks){if(!m.hole)continue;const v=p.clone().sub(m.c);const along=v.dot(m.n);if(v.addScaledVector(m.n,-along).length()<m.r-.02)return true;}return false;}
function blockAt(p){for(const b of BLOCKS){if(b.pass)continue;if(Math.abs(p.x-b.x)<b.w/2&&Math.abs(p.z-b.z)<b.d/2&&p.y>b.y&&p.y<b.y+b.h&&!holeAt(b,p))return b;}return null;}
function faceNormal(b,p){return axisN(new THREE.Vector3((p.x-b.x)/(b.w/2),(p.y-b.y-b.h/2)/(b.h/2),(p.z-b.z)/(b.d/2)));}
function firstHit(r){for(const h of r.intersectObjects(hitTargets(),false)){const b=h.object.userData.block;if(b&&(b.pass||holeAt(b,h.point)))continue;return h;}return null;}
function wallHit(b,p0,n0,power){if(!b||!b.mesh.material.visible)return;if(b.city){if(b.city.down)return;buildingHurt(b.city,power);if(b.city.down)return;}{const bi=BLOCKS.indexOf(b);if(bi>=0&&bi<WORLD.STATIC)share({k:"wall",b:bi,p:[R2(p0.x),R2(p0.y),R2(p0.z)],n:[R2(n0.x),R2(n0.y),R2(n0.z)],pw:power});}const n=axisN(n0);const keep=o=>{(b.fx||(b.fx=[])).push(o);return o;};
  const half=n.x?b.w/2:n.y?b.h/2:b.d/2,ctr=new THREE.Vector3(b.x,b.y+b.h/2,b.z);const p=p0.clone();if(n.x)p.x=ctr.x+n.x*half;else if(n.y)p.y=ctr.y+n.y*half;else p.z=ctr.z+n.z*half;   // onto the face
  let m=b.marks.find(k=>k.n.equals(n)&&k.p.distanceTo(p)<Math.max(.22,k.r+.12));
  if(m&&m.hole)return;
  if(!m){m={p,n,lv:0,r:0,dec:null,hole:false};b.marks.push(m);}
  m.lv+=power;for(let i=0;i<6;i++)PUFF.emit(p,n.clone().multiplyScalar(rnd(.5,1.5)).add(rnd3(.6)),C(0xb8a888).multiplyScalar(.5),.5,{drag:2.5});
  if(m.lv<HOLE_AT){m.r=.06+.035*m.lv;if(m.dec)scene.remove(m.dec);m.dec=keep(decal(m.p,n,m.r,DENT));return;}
  // break through: keep the hole inside the face, cut both faces, line the tunnel, throw rubble
  const thick=half*2,r=HOLE_R;const ext=[n.x?0:(n.y?b.w/2:b.w/2),n.y?0:(n.x?b.h/2:b.h/2),n.z?0:(n.x?b.d/2:b.d/2)];
  if(n.y||(n.x&&(b.d<2*r+.2||b.h<2*r+.2))||(n.z&&(b.w<2*r+.2||b.h<2*r+.2))){m.lv=HOLE_AT-.5;return;}   // too small (or a top face): it stays a deep dent
  const c=m.p.clone();if(!n.x)c.x=clamp(c.x,ctr.x-ext[0]+r+.08,ctr.x+ext[0]-r-.08);c.y=clamp(c.y,ctr.y-ext[1]+r+.08,ctr.y+ext[1]-r-.08);if(!n.z)c.z=clamp(c.z,ctr.z-ext[2]+r+.08,ctr.z+ext[2]-r-.08);
  m.hole=true;m.c=c;m.r=r;if(m.dec){scene.remove(m.dec);m.dec=null;}
  const back=c.clone().addScaledVector(n,-thick);
  keep(decal(c,n,r*.999,MASK,1));keep(decal(back,n.clone().negate(),r*.999,MASK,1));
  keep(decal(c,n,r*1.5,RIM));keep(decal(back,n.clone().negate(),r*1.5,RIM));
  const tun=new THREE.Mesh(new THREE.CylinderGeometry(r,r,thick,20,1,true),TUNNEL);tun.position.copy(c).addScaledVector(n,-thick/2);tun.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);scene.add(tun);keep(tun);
  b.marks=b.marks.filter(k=>k===m||k.hole||k.p.distanceTo(c)>r+.05||(k.dec&&scene.remove(k.dec)&&false));
  for(let i=0;i<7;i++){const rk=new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(.05,.1)),mat(0xc9b896));rk.position.copy(c);scene.add(rk);const v=n.clone().multiplyScalar(rnd(1.5,3)).add(rnd3(1.2));v.y=Math.abs(v.y)+1;tween(.8,t=>{rk.position.copy(c).addScaledVector(v,t).add(new THREE.Vector3(0,-5*t*t,0));rk.rotation.x+=.2;},()=>scene.remove(rk));}
  for(let i=0;i<14;i++)PUFF.emit(c,rnd3(1),C(0xb8a888).multiplyScalar(.55),.8,{drag:2});shake(.05);}

// ---------------- spells: 25 of them, from the elements of the design document ----------------
// You find spells as drops (dummies, monsters) and hold them in the hotbar; click (or FIRE) casts the one in your hand.
// Monsters cast spells from the same table at you: theirs hit for 25% (EK), never hurt other monsters, and walls stop them.
const SPELLS={
  murus:{name:"Murus Terrae",what:"stone wall",el:"earth",uses:3,icon:"🪨",kind:"wall"},
  ignis:{name:"Pila Ignis",what:"fireball",el:"fire",uses:3,icon:"🔥",kind:"bolt",speed:20,size:2.8,r:4,dmg:85,power:4},
  fulmen:{name:"Fulmen",what:"lightning strike",el:"lightning",uses:3,icon:"⚡",kind:"strike",style:"bolt",r:2.8,dmg:90,delay:.45},
  ventus:{name:"Ventus Saltus",what:"wind leap",el:"air",uses:4,icon:"🌪️",kind:"leap"},
  aqua:{name:"Aqua Sanans",what:"healing spring",el:"water",uses:2,icon:"💧",kind:"spring",r:3,life:6,heal:12},
  imber:{name:"Imber Ignis",what:"rain of fire",el:"fire",uses:2,icon:"☄️",kind:"strike",style:"fire",count:6,spread:3.5,r:1.9,dmg:40,delay:.6},
  anulus:{name:"Flamma Anulus",what:"ring of fire",el:"fire",uses:3,icon:"⭕",kind:"nova",r:5.5,dmg:55},
  draco:{name:"Draco Spiritus",what:"dragon breath",el:"fire",uses:2,icon:"🐉",kind:"cone",range:7.5,dmg:9,life:1.8},
  hasta:{name:"Glacies Hasta",what:"ice spear",el:"ice",uses:4,icon:"🧊",kind:"bolt",speed:48,size:1.6,r:1.3,dmg:70,power:2,slow:3},
  campus:{name:"Gelu Campus",what:"frost field",el:"ice",uses:3,icon:"❄️",kind:"zone",r:4,life:5,dmg:8,slow:2},
  nix:{name:"Nix Turbo",what:"snowstorm around you",el:"ice",uses:2,icon:"🌨️",kind:"aura",r:6,life:5,dmg:9,slow:2},
  unda:{name:"Unda Magna",what:"tidal wave",el:"water",uses:2,icon:"🌊",kind:"wave",r:3.5,range:16,dmg:40,push:7},
  bulla:{name:"Bulla",what:"bubble shield (50)",el:"water",uses:2,icon:"🫧",kind:"shield",amount:50,life:10},
  fons:{name:"Fons Vitae",what:"heal 50 HP",el:"heal",uses:2,icon:"✨",kind:"heal",amount:50},
  saxum:{name:"Saxum",what:"rolling boulder",el:"earth",uses:3,icon:"🗿",kind:"bolt",speed:16,size:2.4,r:3,dmg:100,power:5,grav:9},
  motus:{name:"Terrae Motus",what:"earthquake",el:"earth",uses:2,icon:"🌋",kind:"nova",r:7,dmg:45,stun:2},
  spinae:{name:"Spinae",what:"stone spikes",el:"earth",uses:3,icon:"⛰️",kind:"line",range:12,dmg:60},
  turbo:{name:"Turbo",what:"tornado",el:"air",uses:2,icon:"🌀",kind:"tornado",r:3,life:4,dmg:10,speed:6},
  ala:{name:"Ala Venti",what:"wind wings: fast + high jumps",el:"air",uses:2,icon:"🪽",kind:"buff",life:8},
  sagittae:{name:"Sagittae Venti",what:"three wind blades",el:"air",uses:4,icon:"🍃",kind:"bolt",count:3,fan:.16,speed:36,size:1.1,r:1.1,dmg:35,power:1},
  tonitrus:{name:"Tonitrus",what:"thunder chain",el:"lightning",uses:3,icon:"🌩️",kind:"chain",range:16,jumps:4,dmg:55},
  globus:{name:"Globus Fulguris",what:"ball lightning",el:"lightning",uses:2,icon:"🔮",kind:"orb",speed:7,life:4,zap:4.5,dmg:18},
  umbra:{name:"Umbra Gradus",what:"shadow step",el:"shadow",uses:4,icon:"🌑",kind:"blink",dist:9},
  lux:{name:"Lux Clipeus",what:"3 s of no damage",el:"light",uses:2,icon:"🌟",kind:"invuln",life:3.5},
  nox:{name:"Nox",what:"shadow bolt that slows",el:"shadow",uses:4,icon:"🖤",kind:"bolt",speed:24,size:1.6,r:2,dmg:55,power:2,slow:1.5},
  tenebrae:{name:"Tenebrae",what:"darkness that slows",el:"shadow",uses:3,icon:"🌫️",kind:"zone",r:4.5,life:5,dmg:7,slow:2.5},
  radius:{name:"Radius Solis",what:"sun ray",el:"light",uses:3,icon:"☀️",kind:"ray",range:30,dmg:75},
  stella:{name:"Stella Cadens",what:"falling star",el:"gold",uses:1,icon:"🌠",kind:"strike",style:"meteor",r:5,dmg:150,delay:1.1},
};
const DROP_SPELLS=Object.keys(SPELLS);
const EK=.25;   // enemy spells hit for 25% of the player's version
const SPELL_ANIM={ray:"Spellcast_Long",bolt:"Spellcast_Shoot",strike:"Spellcast_Long",nova:"Spellcast_Raise",cone:"Spellcast_Shoot",zone:"Spellcast_Long",aura:"Spellcast_Raise",wave:"Spellcast_Shoot",shield:"Spellcast_Raise",heal:"Spellcast_Raise",line:"Spellcast_Raise",tornado:"Spellcast_Shoot",buff:"Spellcast_Raise",chain:"Spellcast_Long",orb:"Spellcast_Shoot",blink:"Spellcast_Shoot",invuln:"Spellcast_Raise",wall:"Spellcast_Raise",spring:"Spellcast_Raise"};
const ACTIVE=[];   // spells that last a while: {t, life, step(dt,e), end(e)}
function lasting(life,stepFn,endFn){const e={t:0,life,step:stepFn,end:endFn};ACTIVE.push(e);return e;}
function label(text,hex){const c=document.createElement("canvas");c.width=512;c.height=96;const x=c.getContext("2d");x.font="700 44px system-ui,sans-serif";{const w=x.measureText(text).width;if(w>496)x.font=`700 ${Math.max(16,Math.floor(44*496/w))}px system-ui,sans-serif`;}x.textAlign="center";x.textBaseline="middle";
  x.lineWidth=8;x.strokeStyle="rgba(0,0,0,.6)";x.strokeText(text,256,48);x.fillStyle="#"+new THREE.Color(hex).lerp(new THREE.Color(0xffffff),.45).getHexString();x.fillText(text,256,48);
  const t=new THREE.CanvasTexture(c);if("colorSpace" in t)t.colorSpace=THREE.SRGBColorSpace;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false,transparent:true}));sp.scale.set(2.4,.45,1);return sp;}
const fwdFlat=()=>new THREE.Vector3(-Math.sin(P.yaw),0,-Math.cos(P.yaw));
function aimPoint(far){const r=aimRay(0);r.far=far;const h=firstHit(r);if(h)return {p:h.point.clone(),hit:h};const p=r.ray.at(far,new THREE.Vector3());
  if(r.ray.direction.y<-.01){const t=-r.ray.origin.y/r.ray.direction.y;if(t>0&&t<far)p.copy(r.ray.at(t,new THREE.Vector3()));}return {p,hit:null};}
// who casts: the player (aims with the crosshair) or an enemy (aims at the player)
function casterOf(d){if(!d){const a=aimPoint(80);return {enemy:null,pos:P.pos.clone(),from:muzzleWorld(),aim:a.p,hit:a.hit,fwd:fwdFlat()};}
  const tp=(d.aimAt||P.pos).clone();tp.y=d.aimAt?0:tp.y;const from=d.g.position.clone().add(new THREE.Vector3(0,1.3,0)),aim=tp.clone().add(new THREE.Vector3(0,1,0));const f=aim.clone().sub(from);f.y=0;f.normalize();
  return {enemy:d,pos:d.g.position.clone(),from,aim,hit:null,fwd:f,tp};}
const PLAYER_C=()=>({enemy:null,pos:P.pos.clone(),fwd:fwdFlat()});
// everything a spell hits: an enemy's spell hits only you; yours hit dummies and monsters
function hitArea(c,p,r,dmg,el,o){o=o||{};const hits=[];if(c&&c.ghost)return hits;
  if(!c.enemy)for(const id in MP.others){const a=MP.others[id];if(o.skip&&o.skip.has(a))continue;const q=a.g.position;const dist=Math.hypot(q.x-p.x,q.z-p.z);if(dist<r&&Math.abs(p.y-q.y-1)<r+1.5){if(o.skip)o.skip.add(a);hitPlayer(a,Math.max(1,Math.round(dmg*.5*(o.falloff?(1-dist/r)*.6+.4:1))),q.clone().add(new THREE.Vector3(0,1.2,0)));}}
  if(!c.enemy)PEOPLE.forEach(pp=>{if(pp.down||(o.skip&&o.skip.has(pp)))return;const q=pp.o.g.position;const dist=Math.hypot(q.x-p.x,q.z-p.z);if(dist>=r||Math.abs(p.y-1)>r+1.5)return;if(o.skip)o.skip.add(pp);hurtPerson(pp,Math.max(1,Math.round(dmg*.5)),q.clone().add(new THREE.Vector3(0,1.2,0)));});
  if(c.enemy){if(o.skip&&o.skip.has(P)||inTown(P.pos))return hits;   // the town is a safe zone   // a spike line or a wave hits you once, not once per spike
    if(!P.down&&P.pos.clone().add(new THREE.Vector3(0,.9,0)).distanceTo(p)<r+.3){if(o.skip)o.skip.add(P);hurt(Math.max(2,Math.round(dmg*EK)));if(o.slow)P.slowT=Math.max(P.slowT,o.slow);if(o.push){const v=P.pos.clone().sub(p);v.y=0;v.normalize();P.vel.addScaledVector(v,o.push);P.vel.y=Math.max(P.vel.y,3);P.dash=.25;}hits.push(P);}return hits;}
  DUMMIES.forEach(d=>{if(d.down||(o.skip&&o.skip.has(d)))return;const q=d.g.position;const dist=Math.hypot(q.x-p.x,q.z-p.z);if(dist>=r||Math.abs(p.y-(q.y+1))>r+1.5)return;
    damage(d,Math.round(dmg*(o.falloff?(1-dist/r)*.6+.4:1)),q.clone().add(new THREE.Vector3(0,1.3,0)),false,{el,area:true});
    if(o.slow)d.slowT=Math.max(d.slowT||0,o.slow);if(o.stun)d.stunT=Math.max(d.stunT||0,o.stun);
    if(o.push){const v=q.clone().sub(p);v.y=0;if(v.lengthSq()<.01)v.copy(c.fwd);d.pushV=v.normalize().multiplyScalar(o.push);}
    if(o.pull){const v=p.clone().sub(q);v.y=0;d.pushV=v.multiplyScalar(o.pull);}
    if(o.skip)o.skip.add(d);hits.push(d);});
  NODES.forEach(n=>{if(!n.down&&!c.enemy&&Math.hypot(n.g.position.x-p.x,n.g.position.z-p.z)<r)mineHit(n,dmg*.5,n.g.position.clone().add(new THREE.Vector3(0,.8,0)));});
  return hits;}
function groundRing(p,r,hex,dur,op){const m=new THREE.Mesh(new THREE.RingGeometry(.85,1,48),new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:op||.9,depthWrite:false,side:THREE.DoubleSide}));
  m.rotation.x=-Math.PI/2;m.position.set(p.x,Math.max(.05,p.y+.05),p.z);scene.add(m);tween(dur,t=>{m.scale.setScalar(Math.max(.01,r*t));m.material.opacity=(op||.9)*(1-t*t);},()=>scene.remove(m));}
function disc(p,r,hex,op){const g=new THREE.Group();g.position.set(p.x,Math.max(0,p.y)+.04,p.z);
  const a=new THREE.Mesh(new THREE.CircleGeometry(r,40),new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:op,depthWrite:false}));a.rotation.x=-Math.PI/2;g.add(a);
  const b=new THREE.Mesh(new THREE.RingGeometry(r-.15,r+.05,48),new THREE.MeshBasicMaterial({color:new THREE.Color(hex).lerp(new THREE.Color(0xffffff),.5),transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide}));b.rotation.x=-Math.PI/2;b.position.y=.01;g.add(b);
  scene.add(g);return g;}
const fade=(g,k)=>g.children.forEach((m,i)=>{if(m.material){m.material.opacity=(i?.9:m.material.userData.op0||(m.material.userData.op0=m.material.opacity))*k;}});
function strikeAt(c,p,s,delay){const hex=FX.HEX[s.el];const warn=disc(p,s.r,hex,.12);
  let fall=null;if(s.style!=="bolt"){fall=FX.comet(s.el==="gold"?"gold":"fire",s.style==="meteor"?3.2:1.6);const top=p.clone().add(new THREE.Vector3(rnd(-6,6),24,rnd(-6,6)));fall.position.copy(top);fall.userData.aim(p.clone().sub(top).normalize());scene.add(fall);fall.userData.top=top;}
  tween(delay,t=>{warn.scale.setScalar(1.15-t*.15);fade(warn,.4+.6*t);if(fall)fall.position.lerpVectors(fall.userData.top,p,t*t);},()=>{scene.remove(warn);if(fall)fall.userData.dispose();
    if(s.style==="bolt"){const top=p.clone().add(new THREE.Vector3(rnd(-1,1),24,rnd(-1,1)));boltLine(top,p,hex);FX.beam(top,p,"lightning",.35,.35);}
    flash(p,hex,s.style==="meteor"?14:10,.4);FX.impact(p,s.el,s.r*.9);FX.stars(p,s.el,s.style==="meteor"?6:3,s.r*.6);groundRing(p,s.r*1.1,hex,.5);shake(s.style==="meteor"?.3:.12);
    for(let i=0;i<(s.style==="meteor"?70:30);i++)SPARK.emit(p,rnd3(1).normalize().multiplyScalar(rnd(3,8)),C(i%2?hex:0xffffff),rnd(.3,.7),{grav:8,drag:1.5});
    const bl=c.ghost?null:blockAt(p.clone().add(new THREE.Vector3(0,-.05,0)));if(bl)wallHit(bl,p,faceNormal(bl,p),3);
    hitArea(c,p.clone().add(new THREE.Vector3(0,.3,0)),s.r,s.dmg,s.el,{falloff:s.style!=="bolt"});});}
function spike(p,hex,i){const m=LOOK.M(new THREE.ConeGeometry(.35,1.6,6),LOOK.toon(0xb59a72),.02);m.position.set(p.x,-.8,p.z);m.rotation.z=rnd(-.2,.2);scene.add(m);
  tween(.15+i*.03,t=>{m.position.y=-.8+1.4*Math.min(1,t*1.2);},()=>{setTimeout(()=>tween(.4,t=>{m.position.y=.6-1.4*t;},()=>scene.remove(m)),700);});
  for(let k=0;k<4;k++)PUFF.emit(p.clone().add(new THREE.Vector3(0,.2,0)),new THREE.Vector3(rnd(-1,1),rnd(1,2.5),rnd(-1,1)),C(0xb8a07a).multiplyScalar(.5),.6,{drag:2});}
function zapNear(c,p,r,dmg){if(c&&c.ghost)return;const hex=FX.HEX.lightning;
  if(c&&c.enemy){const me=P.pos.clone().add(new THREE.Vector3(0,1,0));if(!P.down&&!inTown(P.pos)&&me.distanceTo(p)<r){boltLine(p,me,hex);hurt(Math.max(2,Math.round(dmg*EK)));}return;}
  let best=null,bd=r;DUMMIES.forEach(d=>{if(d.down)return;const q=d.g.position.clone().add(new THREE.Vector3(0,1.3,0));const dd=q.distanceTo(p);if(dd<bd){bd=dd;best=d;}});
  if(best){const q=best.g.position.clone().add(new THREE.Vector3(0,1.3,0));boltLine(p,q,hex);damage(best,dmg,q,false,{el:"lightning",chain:true});}}
function safeBlink(from,dir,dist){const p=from.clone();for(let k=0;k<dist;k+=.5){const q=p.clone().addScaledVector(dir,.5);if(blockAt(q.clone().add(new THREE.Vector3(0,.9,0)))||blockAt(q.clone().add(new THREE.Vector3(0,1.6,0)))||Math.abs(q.x)>185||Math.abs(q.z)>185)break;p.copy(q);}return p;}
function shadowPuff(p){for(let i=0;i<22;i++)PUFF.emit(p.clone().add(new THREE.Vector3(0,rnd(.2,1.8),0)),rnd3(1.6),C(0x5a3a8a).multiplyScalar(.6),.7,{drag:2});FX.stars(p.clone().add(new THREE.Vector3(0,1,0)),"shadow",3,1.2);}
// what each kind of spell does; c = the caster (casterOf), s = the spell. Returning false means "can't cast here" (no use spent)
const KINDS={
  bolt(c,s){const n=s.count||1;for(let i=0;i<n;i++){const a=(i-(n-1)/2)*(s.fan||0);const d=c.aim.clone().sub(c.from).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),a);
      bolt(c.from,d,s.el,{speed:s.speed,size:s.size,r:s.r,dmg:s.dmg,power:s.power,c,grav:s.grav,slow:s.slow});}
    flash(c.from,FX.HEX[s.el],5,.2);FX.flare(c.from,c.aim.clone().sub(c.from).normalize(),s.el,s.size*.5,.25);},
  strike(c,s){const n=s.count||1;const base=c.enemy&&!c.ghost?P.pos.clone():c.aim.clone();if(!c.hit)base.y=Math.max(0,base.y);
    for(let i=0;i<n;i++){const p=base.clone();if(s.spread){const a=Math.random()*6.3,r=Math.sqrt(Math.random())*s.spread;p.x+=Math.cos(a)*r;p.z+=Math.sin(a)*r;p.y=0;}setTimeout(()=>strikeAt(c,p,s,(c.enemy?.35:0)+s.delay),i*130);}},
  nova(c,s){const p=c.pos.clone().add(new THREE.Vector3(0,.2,0));const hex=FX.HEX[s.el];groundRing(p,s.r,hex,.55);groundRing(p,s.r*.7,0xffffff,.45,.6);flash(p.clone().add(new THREE.Vector3(0,1,0)),hex,8,.35);shake(s.stun?.25:.1);
    for(let i=0;i<48;i++){const a=i/48*6.3;SPARK.emit(p,new THREE.Vector3(Math.cos(a)*rnd(6,10),rnd(.5,2),Math.sin(a)*rnd(6,10)),C(i%2?hex:0xffffff),rnd(.4,.7),{drag:2});}
    if(s.stun)for(let i=0;i<14;i++)PUFF.emit(p,new THREE.Vector3(rnd(-6,6),rnd(.5,2),rnd(-6,6)),C(0xb8a07a).multiplyScalar(.5),.8,{drag:2.5});
    hitArea(c,p.clone().add(new THREE.Vector3(0,.8,0)),s.r,s.dmg,s.el,{stun:s.stun});},
  cone(c,s){let tick=0;lasting(s.life,(dt,e)=>{const me=c.enemy&&c.enemy.g;if(c.enemy&&(c.enemy.down))return;const f=me?(c.tp||P.pos).clone().sub(me.position).setY(0).normalize():fwdFlat(),from=me?me.position.clone().add(new THREE.Vector3(0,1.2,0)).addScaledVector(f,.6):muzzleWorld();
      for(let k=0;k<5;k++){const v=f.clone().multiplyScalar(rnd(7,11)).add(rnd3(1.6));v.y=Math.abs(v.y)*.4;SPARK.emit(from,v,C(Math.random()<.6?0xff7b3a:0xffd27a),rnd(.4,.7),{drag:1});}
      if(Math.random()<.5)PUFF.emit(from,f.clone().multiplyScalar(rnd(4,7)),C(0xff7b3a).multiplyScalar(.4),.6,{drag:1.5});
      tick-=dt;if(tick>0||c.ghost)return;tick=.2;
      if(me){const v=P.pos.clone().sub(me.position);v.y=0;if(!inTown(P.pos)&&v.length()<s.range&&v.normalize().dot(f)>.78)hurt(Math.max(1,Math.round(s.dmg*EK*2)));return;}
      DUMMIES.forEach(d=>{if(d.down)return;const v=d.g.position.clone().sub(P.pos);v.y=0;const dist=v.length();if(dist<s.range&&v.normalize().dot(f)>.78)damage(d,s.dmg,d.g.position.clone().add(new THREE.Vector3(0,1.3,0)),false,{el:"fire",area:true});});});},
  zone(c,s){const p=c.enemy&&!c.ghost?P.pos.clone():c.aim.clone();p.y=Math.max(0,c.enemy&&!c.ghost?0:p.y);const hex=FX.HEX[s.el];const g=disc(p,s.r,hex,.25);let tick=0;
    lasting(s.life,(dt,e)=>{fade(g,Math.min(1,e.life-e.t));for(let k=0;k<2;k++)if(Math.random()<dt*20){const a=Math.random()*6.3,r=Math.sqrt(Math.random())*s.r;SPARK.emit(p.clone().add(new THREE.Vector3(Math.cos(a)*r,.1,Math.sin(a)*r)),new THREE.Vector3(0,rnd(.5,1.5),0),C(0xdff6ff),.7,{grav:-.5});}
      tick-=dt;if(tick<=0){tick=1;hitArea(c,p.clone().add(new THREE.Vector3(0,.6,0)),s.r,s.dmg,s.el,{slow:s.slow});}},()=>scene.remove(g));},
  aura(c,s){const hex=FX.HEX[s.el],A=c.ghost?c.enemy.g.position:P.pos;const g=disc(A,s.r,hex,.18);let tick=0;
    lasting(s.life,(dt,e)=>{g.position.set(A.x,A.y+.04,A.z);fade(g,Math.min(1,e.life-e.t));for(let k=0;k<4;k++){const a=Math.random()*6.3,r=rnd(1,s.r);SPARK.emit(A.clone().add(new THREE.Vector3(Math.cos(a)*r,rnd(.3,2.5),Math.sin(a)*r)),new THREE.Vector3(-Math.sin(a)*4,rnd(-1,.3),Math.cos(a)*4),C(0xffffff),.6,{drag:.5});}
      tick-=dt;if(tick<=0){tick=.8;if(!c.ghost)hitArea(PLAYER_C(),P.pos.clone().add(new THREE.Vector3(0,.8,0)),s.r,s.dmg,s.el,{slow:s.slow});}},()=>scene.remove(g));},
  spring(c,s){const p=(c.ghost?c.pos:P.pos).clone();if(!c.ghost)p.y=Math.max(0,floorUnder());const g=disc(p,s.r,FX.HEX.water,.28);let tick=0;FX.stars(p.clone().add(new THREE.Vector3(0,1,0)),"water",4,1.5);
    lasting(s.life,(dt,e)=>{fade(g,Math.min(1,e.life-e.t));for(let k=0;k<3;k++)if(Math.random()<dt*20){const a=Math.random()*6.3,r=Math.sqrt(Math.random())*s.r;SPARK.emit(p.clone().add(new THREE.Vector3(Math.cos(a)*r,.05,Math.sin(a)*r)),new THREE.Vector3(0,rnd(1.5,3),0),C(Math.random()<.5?0x4cc3ff:0xbfeaff),.7,{grav:2});}
      if(!P.down&&Math.hypot(P.pos.x-p.x,P.pos.z-p.z)<s.r&&P.hp<P.maxHp){P.hp=Math.min(P.maxHp,P.hp+s.heal*dt);hud();}
      tick-=dt;if(tick<=0){tick=1;if(!c.ghost)hitArea(PLAYER_C(),p.clone().add(new THREE.Vector3(0,.8,0)),s.r,6,"water");}},()=>scene.remove(g));},
  wave(c,s){const skip=new Set(),f=c.fwd.clone(),o=c.pos.clone();const m=new THREE.Mesh(new THREE.CylinderGeometry(s.r,s.r,2,24,1,true,-.9,1.8),new THREE.MeshBasicMaterial({color:0x6fd0ff,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));scene.add(m);
    lasting(s.range/12,(dt,e)=>{const p=o.clone().addScaledVector(f,1+e.t*12);m.position.set(p.x,1,p.z);m.rotation.y=Math.atan2(f.x,f.z);m.material.opacity=.55*(1-e.t/e.life*.6);
      for(let k=0;k<6;k++)SPARK.emit(p.clone().add(new THREE.Vector3(rnd(-s.r,s.r)*Math.abs(f.z),rnd(.2,2),rnd(-s.r,s.r)*Math.abs(f.x))),f.clone().multiplyScalar(6).add(new THREE.Vector3(0,rnd(1,3),0)),C(Math.random()<.5?0x4cc3ff:0xffffff),.5,{grav:6});
      hitArea(c,p.clone().add(new THREE.Vector3(0,.8,0)),s.r,s.dmg,"water",{skip,push:s.push});},()=>scene.remove(m));},
  shield(c,s){P.shield=s.amount;P.shieldT=s.life;FX.stars(P.pos.clone().add(new THREE.Vector3(0,1.2,0)),"water",4,1.4);},
  heal(c,s){P.hp=Math.min(P.maxHp,P.hp+s.amount);hud();popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"+"+s.amount+" HP","spell");for(let i=0;i<30;i++)SPARK.emit(P.pos.clone().add(new THREE.Vector3(rnd(-.6,.6),rnd(0,1.8),rnd(-.6,.6))),new THREE.Vector3(0,rnd(1,3),0),C(i%2?0x7dff9a:0xffffff),.9,{grav:-1});FX.stars(P.pos.clone().add(new THREE.Vector3(0,1.3,0)),"heal",4,1.3);},
  line(c,s){const skip=new Set();const f=c.fwd.clone();const o=c.pos.clone();const hex=FX.HEX[s.el];
    for(let i=1;i<=Math.round(s.range/1.2);i++){const p=o.clone().addScaledVector(f,i*1.2);p.y=0;if(blockAt(p.clone().add(new THREE.Vector3(0,.5,0))))break;setTimeout(()=>{spike(p,hex,i);hitArea(c,p.clone().add(new THREE.Vector3(0,.6,0)),1.2,s.dmg,s.el,{skip});},i*55+(c.enemy?300:0));}},
  tornado(c,s){const f=c.enemy?c.fwd.clone():c.aim.clone().sub(c.pos).setY(0).normalize();const o=c.pos.clone().addScaledVector(f,1.5);o.y=0;const g=new THREE.Group();
    for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.ConeGeometry(1.2+k*.5,3.2,16,1,true),new THREE.MeshBasicMaterial({color:0xdff1ff,transparent:true,opacity:.35-k*.08,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=Math.PI;m.position.y=1.6+k*.2;g.add(m);}
    scene.add(g);let tick=0;lasting(s.life,(dt,e)=>{const p=o.clone().addScaledVector(f,e.t*s.speed);g.position.copy(p);g.children.forEach((m,i)=>m.rotation.y+=dt*(8+i*3));
      for(let k=0;k<3;k++){const a=Math.random()*6.3;PUFF.emit(p.clone().add(new THREE.Vector3(Math.cos(a)*1.2,rnd(0,3),Math.sin(a)*1.2)),new THREE.Vector3(-Math.sin(a)*5,1.5,Math.cos(a)*5),C(0xdff1ff).multiplyScalar(.45),.5,{drag:2});}
      tick-=dt;if(tick<=0){tick=.3;hitArea(c,p.clone().add(new THREE.Vector3(0,1,0)),s.r,s.dmg,"air",{pull:2});}},()=>scene.remove(g));},
  buff(c,s){P.buffT=s.life;for(let i=0;i<20;i++)PUFF.emit(P.pos.clone().add(new THREE.Vector3(0,1,0)),rnd3(2),C(0xdff1ff).multiplyScalar(.5),.6,{drag:2});FX.stars(P.pos.clone().add(new THREE.Vector3(0,1.4,0)),"air",4,1.3);},
  chain(c,s){const hex=FX.HEX.lightning;let from=c.from.clone();const hit=new Set();const f=fwdFlat();
    for(let j=0;j<s.jumps;j++){let best=null,bd=j?8:s.range;DUMMIES.forEach(d=>{if(d.down||hit.has(d))return;const q=d.g.position.clone().add(new THREE.Vector3(0,1.3,0));const v=q.clone().sub(P.pos);v.y=0;if(!j&&v.clone().normalize().dot(f)<.5)return;const dd=q.distanceTo(from);if(dd<bd){bd=dd;best=d;}});
      if(!best){if(!j){boltLine(from,c.aim,hex);}break;}hit.add(best);const q=best.g.position.clone().add(new THREE.Vector3(0,1.3,0));const a=from.clone();setTimeout(()=>{boltLine(a,q,hex);FX.stars(q,"lightning",2,1);damage(best,s.dmg,q,false,{el:"lightning",chain:true});},j*110);from=q;}
    flash(c.from,hex,6,.3);},
  ray(c,s){const dir=c.aim.clone().sub(c.from).normalize();let end=c.from.clone().addScaledVector(dir,s.range);const w=wallBetween(c.from,end);if(w)end=w.point.clone();
    FX.beam(c.from,end,"light",.3,.4);flash(end,FX.HEX.light,8,.35);FX.impact(end,"light",1.2);for(let i=0;i<20;i++)SPARK.emit(c.from.clone().lerp(end,Math.random()),rnd3(1),C(0xfff4c2),.5);
    if(c.ghost)return;if(c.enemy){if(!P.down&&!inTown(P.pos)&&segDist(c.from,end,P.pos.clone().add(new THREE.Vector3(0,1,0)))<1)hurt(Math.max(2,Math.round(s.dmg*EK)));return;}
    DUMMIES.forEach(d=>{if(d.down)return;const q=d.g.position.clone().add(new THREE.Vector3(0,1.2,0));if(segDist(c.from,end,q)<1.1)damage(d,s.dmg,q,false,{el:"light"});});},
  orb(c,s){const d=c.aim.clone().sub(c.from).normalize();bolt(c.from,d,"lightning",{speed:s.speed,size:2,r:2,dmg:s.dmg*2,power:2,c,life:s.life,orb:{r:s.zap,dmg:s.dmg}});},
  blink(c,s){if(c.enemy){const d=c.enemy;shadowPuff(d.g.position);const a=Math.random()*6.3;const to=(c.tp||P.pos).clone().add(new THREE.Vector3(Math.cos(a)*4,0,Math.sin(a)*4));to.y=0;
      if(!blockAt(to.clone().add(new THREE.Vector3(0,1,0)))){d.g.position.copy(to);shadowPuff(to);}return;}
    const from=P.pos.clone();const to=safeBlink(from,fwdFlat(),s.dist);if(to.distanceTo(from)<1)return false;shadowPuff(from);P.pos.copy(to);P.vel.set(0,0,0);shadowPuff(to);},
  invuln(c,s){P.invulnT=s.life;FX.stars(P.pos.clone().add(new THREE.Vector3(0,1.2,0)),"light",5,1.5);flash(P.pos.clone().add(new THREE.Vector3(0,1,0)),FX.HEX.light,6,.4);},
  // Murus Terrae: a stone wall rises 3 m ahead (side-on to where you face, snapped to the world grid); it takes dents and holes, and crumbles after 15 s
  wall(c,s){const PP=c.ghost?c.pos:P.pos,f=c.ghost?c.fwd:fwdFlat();const sideX=Math.abs(f.x)>Math.abs(f.z);const ctr=PP.clone().addScaledVector(f,3);
    const w=sideX?.7:4.2,d=sideX?4.2:.7,h=2.4;if(Math.abs(ctr.x-P.pos.x)<w/2+RADIUS&&Math.abs(ctr.z-P.pos.z)<d/2+RADIUS&&!c.ghost)return false;
    const m=block(ctr.x,ctr.z,w,h,d,0xd0b890);const b=BLOCKS[BLOCKS.length-1];b.temp=true;m.scale.y=.02;m.position.y=.02;
    tween(.35,t=>{const k=Math.max(.02,1-(1-t)*(1-t));m.scale.y=k;m.position.y=h*k/2;});
    for(let i=0;i<24;i++)PUFF.emit(ctr.clone().add(new THREE.Vector3(rnd(-w/2,w/2),.1,rnd(-d/2,d/2))),new THREE.Vector3(rnd(-1,1),rnd(1,3),rnd(-1,1)),C(0xb8a07a).multiplyScalar(.55),.8,{drag:2});
    FX.stars(ctr.clone().add(new THREE.Vector3(0,1.2,0)),"earth",3,1.5);shake(.12);
    setTimeout(()=>{if(!BLOCKS.includes(b))return;tween(.6,t=>{m.scale.y=Math.max(.02,1-t);m.position.y=h*m.scale.y/2;(b.fx||[]).forEach(o=>o.visible=false);if(Math.random()<.4)PUFF.emit(ctr.clone().add(new THREE.Vector3(rnd(-w/2,w/2),.3,rnd(-d/2,d/2))),rnd3(1),C(0xb8a07a).multiplyScalar(.5),.6,{drag:2});},()=>removeBlock(b));},15000);},
  // Ventus Saltus: a gust throws you forward and up, and knocks back what is in front of you
  leap(c,s){const f=fwdFlat();P.vel.set(f.x*15,8.5,f.z*15);P.onGround=false;P.dash=.45;if(RIG)RIG.full("Dodge_Forward",{once:true,restart:true,dur:.6,then:()=>RIG.clearFull()});
    const at=P.pos.clone().add(new THREE.Vector3(0,.8,0));for(let i=0;i<26;i++)PUFF.emit(at,f.clone().multiplyScalar(-rnd(1,4)).add(rnd3(1.2)),C(0xdff1ff).multiplyScalar(.5),.6,{drag:2.5});FX.stars(at,"air",3,1.4);
    hitArea(c,P.pos.clone().addScaledVector(f,2.5).add(new THREE.Vector3(0,.8,0)),3,22,"air",{push:6});},
};
function removeBlock(b){const i=BLOCKS.indexOf(b);if(i>=0)BLOCKS.splice(i,1);const j=SOLIDS.indexOf(b.mesh);if(j>=0)SOLIDS.splice(j,1);scene.remove(b.mesh);(b.fx||[]).forEach(o=>scene.remove(o));}
// the player casts the spell in hand; true when it went off
function castSpell(id){const s=SPELLS[id];if(!s||P.down||!started||paused||bagOpen||G.spellCool>0)return false;
  const c0=casterOf(null);if(KINDS[s.kind](c0,s)===false){popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"no room","burn");return false;}
  share({k:"cast",s:id,p:V3r(c0.pos),f:V3r(c0.from),m:V3r(c0.aim),w:V3r(c0.fwd)});G.spellCool=.6;mpFx(id);if(RIG&&s.kind!=="leap")RIG.up(SPELL_ANIM[s.kind]||"Spellcast_Shoot",{once:true,dur:.6,restart:true,then:()=>RIG.up("2H_Ranged_Aiming")});
  FX.stars(muzzleWorld(),s.el,2,.8);return true;}
function castAs(d,id){const s=SPELLS[id];if(!s||d.down)return;KINDS[s.kind](casterOf(d),s);}
// timers on you from spells: shield bubble, light shield, wind wings, frost
const bubble=new THREE.Mesh(new THREE.SphereGeometry(1.15,24,16),new THREE.MeshBasicMaterial({color:0x8fdcff,transparent:true,opacity:.22,depthWrite:false}));bubble.position.y=1;bubble.visible=false;body.add(bubble);
const halo=new THREE.Mesh(new THREE.SphereGeometry(1.25,24,16),new THREE.MeshBasicMaterial({color:0xfff4c2,transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending}));halo.position.y=1;halo.visible=false;body.add(halo);
const mightGlow=new THREE.Mesh(new THREE.TorusGeometry(.7,.05,8,32),new THREE.MeshBasicMaterial({color:0xffd36a,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));mightGlow.rotation.x=Math.PI/2;mightGlow.position.y=.15;mightGlow.visible=false;body.add(mightGlow);
function stepMagic(dt){G.spellCool=Math.max(0,(G.spellCool||0)-dt);
  for(let i=ACTIVE.length-1;i>=0;i--){const e=ACTIVE[i];e.t+=dt;e.step(dt,e);if(e.t>=e.life){ACTIVE.splice(i,1);e.end&&e.end(e);}}
  ["shieldT","invulnT","buffT","slowT","regenT","toughT","strongT","jumpT","mightT"].forEach(k=>{if(P[k]>0)P[k]=Math.max(0,P[k]-dt);});if(!P.shieldT)P.shield=0;
  bubble.visible=P.shield>0;mightGlow.visible=P.mightT>0;if(P.mightT>0){mightGlow.rotation.y+=dt*2;if(Math.random()<dt*12)SPARK.emit(P.pos.clone().add(new THREE.Vector3(rnd(-.5,.5),rnd(.2,1.8),rnd(-.5,.5))),new THREE.Vector3(0,1.2,0),C(0xffd36a),.6,{grav:-.5});}bubble.material.opacity=.15+.08*Math.sin(tAcc*6);halo.visible=P.invulnT>0;halo.material.opacity=.2+.12*Math.sin(tAcc*10);
  if(P.buffT>0&&Math.random()<dt*14)PUFF.emit(P.pos.clone().add(new THREE.Vector3(rnd(-.4,.4),rnd(.5,1.5),rnd(-.4,.4))),new THREE.Vector3(0,1,0),C(0xdff1ff).multiplyScalar(.4),.4,{drag:2});
  if(P.slowT>0&&Math.random()<dt*10)SPARK.emit(P.pos.clone().add(new THREE.Vector3(rnd(-.4,.4),rnd(.2,1.6),rnd(-.4,.4))),new THREE.Vector3(0,-.3,0),C(0xa9f1ff),.5);}

// ---------------- items: a Minecraft-style inventory — 9 hotbar slots (0-8) + 27 in the bag ----------------
// item = {t:"weapon",id,ammo} | {t:"spell",id,uses} | {t:"mat",id,n} | {t:"potion",id:"potion",n}
const MAT=CRAFT.MATERIALS;for(const k in MAT)MAT[k].id=k;const INV=new Array(36).fill(null);let SEL=0;
const WICON={rifle:"🔫",shotgun:"💥",staff:"🪄",repeater:"⚡",cannon:"💣",arcus:"🏹"};
// how to get each item: shown in the bag under the item, and all together in the 📖 Guide tab
function howToGet(it){if(!it)return "";const make=id=>CRAFT.RECIPES.some(r=>r.give?(r.give.t==="food"&&r.give.id===id)||(r.give.t==="scroll"&&it.t==="spell"&&SPELLS[it.id].el===r.give.el):(r.out||r.id)===id);
  const mons=k=>Object.values(ENEMY_TYPES).filter(T=>T.core===k||(T.drops||[]).includes(k)).map(T=>T.name);
  if(it.t==="coin")return "Sell things to Mercator, finish villagers' quests and jobs, solve Try Your Hardest problems, beat monsters.";
  if(it.t==="mat"){const k=it.id,m=MAT[k];
    if(k==="ferrum")return "Break the grey iron rocks (punch or shoot them) · buy from Mercator.";
    if(k==="lignum")return "Chop trees (punch or shoot them) · knock down training dummies · buy from Mercator.";
    if(m.core)return `Mine glowing ${m.el} crystals · buy from Mercator · dropped by ${mons(k).join(", ")||"monsters"}.`;
    return `Beat the ${mons(k).join(" or ")} out in the wilds.`;}
  if(it.t==="weapon")return "Make it at the ⚒️ Forge"+(it.id==="rifle"?" · or buy it from Mercator for 30 🪙.":".");
  if(it.t==="potion")return "Make it at the ⚒️ Forge · or buy it from Mercator.";
  if(it.t==="food")return "Buy it from the cook's 🍞 stall · or cook it at the ⚒️ Forge (Cook food).";
  if(it.t==="spell")return `Monsters drop spell scrolls · Mercator sells a few · make a ${SPELLS[it.id].el} scroll at the ⚒️ Forge.`;return "";}
// every thing you can hold has a real picture (product-photo style, made with Gemini 2026-11-20, in items/): bag, shop, forge, the ground, your hand
const PIC=k=>String(k).startsWith("data:")?k:"/play/elementum/items/"+k+".webp";
const EMOJI_PIC={};const emojiPic=e=>{if(!EMOJI_PIC[e]){const c=document.createElement("canvas");c.width=c.height=96;const x=c.getContext("2d");x.font='72px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif';x.textAlign="center";x.textBaseline="middle";x.fillText(e,48,54);EMOJI_PIC[e]=c.toDataURL();}return EMOJI_PIC[e];};
const picKey=it=>it.t==="build"?(it.thumb||emojiPic((BUILD.ITEMS[it.id]||{icon:"🛠️"}).icon)):it.t==="coin"?"coin":it.t==="weapon"?"weapon_"+it.id:it.t==="spell"?"scroll_"+SPELLS[it.id].el:it.t+"_"+it.id;
const img=(k,cls)=>`<img class="${cls||"ii"}" src="${PIC(k)}" alt="" draggable="false">`;
const ico=f=>f.pic?img(f.pic):f.icon,matIco=id=>img("mat_"+id,"in"),foodIco=id=>img("food_"+id,"in");
const recPic=r=>r.give?(r.give.t==="food"?"food_"+r.give.id:r.id):r.id==="potion"?"potion_sanans":r.id==="fortis"?"potion_fortis":"weapon_"+r.id;
const fnOf=it=>it&&it.t==="build"?it.fn||BUILD.ITEMFN[it.id]||null:null;
function itemInfo(it){let f=itemInfo0(it);if(f){f.pic=picKey(it);if(it.water>0){f=Object.assign({},f,{name:`${f.name} — 💧 ×${it.water}`});}}return f;}
function itemInfo0(it){if(!it)return null;if(it.t==="build"){const I=BUILD.ITEMS[it.id]||{icon:"🛠️",name:"thing"};const fk=fnOf(it);if(fk&&BUILD.FNS[fk])return {icon:it.id==="invention"?BUILD.FNS[fk].icon:I.icon,name:it.nm||`${I.name[0].toUpperCase()+I.name.slice(1)} you built`,what:`${it.ef&&BUILD.badEf(it.ef)?"🤢":BUILD.FNS[fk].icon} ${BUILD.FNS[fk].what}`,count:1};if(it.id==="book")return {icon:I.icon,name:"Book you made",what:"Hold it and click to read how things are built — sizes and all",count:1};if(it.nm){const T=BUILD.thingOf(it.id);return {icon:I.icon,name:it.nm,what:T.what[0].toUpperCase()+T.what.slice(1),count:1};}return it.id==="house"?{icon:"🏠",name:"House plans",what:"Take them to your empty house plot to build your house",count:1}:{icon:I.icon,name:`${I.name[0].toUpperCase()+I.name.slice(1)} you built`,what:it.id==="house"?"Hold the plans and click to build your house right there — or take them to your house plot":it.id==="horn"?"Hold it and click to blow it: soldiers come and fight the monsters near you":it.id==="bed"||it.id==="chest"?"Put it in your house, hold it and click to set it down anywhere — or give it to whoever ordered one":"Hold it and click to set it down — or give it to whoever ordered one",count:1};}if(it.t==="coin")return {icon:"🪙",name:"Denarii",what:"coins",count:it.n};if(it.t==="weapon")return {icon:WICON[it.id]||"🔫",name:WEAPONS[it.id].name,what:WEAPONS[it.id].what||""};
  if(it.t==="spell"){const s=SPELLS[it.id];return {icon:s.icon,name:s.name,what:s.what,count:it.uses,el:s.el};}
  if(it.t==="potion")return it.id==="fortis"?{icon:"⚗️",name:"Potio Fortis",what:"you + players near you: +50% damage and fast feet, 40 s",count:it.n}:{icon:"🧪",name:"Potio Sanans",what:"drink: +50 HP",count:it.n};
  if(it.t==="food"){const f=FOODS[it.id];return {icon:f.icon,name:f.name,what:f.what,count:it.n};}
  const m=MAT[it.id];return {icon:m.icon,name:m.name,what:m.what,count:it.n,num:m.num};}
const held=()=>INV[SEL];
function addItem(it){it=Object.assign({},it);if(it.t==="build"&&!it.thumb&&it.parts&&it.parts.length)it.thumb=BUILD.snap(it.parts,96);if(it.t==="coin"){COINS+=it.n;coinHud();return true;}
  if(it.t==="mat"||it.t==="potion"||it.t==="food"){for(const s of INV)if(s&&s.t===it.t&&s.id===it.id&&s.n<64&&!s.sp&&!it.sp){const k=Math.min(64-s.n,it.n);s.n+=k;it.n-=k;if(!it.n)break;}if(!it.n){invHud();return true;}}
  if(it.t==="spell"){const s=INV.find(s=>s&&s.t==="spell"&&s.id===it.id);if(s){s.uses=Math.min(12,s.uses+it.uses);invHud();return true;}}
  const i=freeSlot();if(i<0)return false;INV[i]=it;if(i===SEL)select(SEL);invHud();return true;}
// a new item never lands in the slot in your hand: the nearest free hotbar slot beside it (right, then left, further out), then the bag; your hand only if nothing else is free
function freeSlot(){for(let k=1;k<9;k++)for(const i of [SEL+k,SEL-k])if(i>=0&&i<9&&!INV[i])return i;
  for(let i=9;i<INV.length;i++)if(!INV[i])return i;return INV[SEL]?-1:SEL;}
function canAdd(it){if(freeSlot()>=0)return true;if(it.t==="spell")return INV.some(s=>s&&s.t==="spell"&&s.id===it.id);return INV.some(s=>s&&s.t===it.t&&s.id===it.id&&s.n<64);}
function countMat(id){return INV.reduce((a,s)=>a+(s&&s.t==="mat"&&s.id===id?s.n:0),0);}
function takeMat(id,n){for(let i=0;i<INV.length&&n>0;i++){const s=INV[i];if(s&&s.t==="mat"&&s.id===id){const k=Math.min(s.n,n);s.n-=k;n-=k;if(!s.n)INV[i]=null;}}invHud();}
// what is in your hand decides what click / FIRE does
function select(i){SEL=(i+9)%9;const it=held();gunMount.visible=!!(it&&it.t==="weapon");
  if(it&&it.t==="weapon"&&G.item!==it)equip(it.id,it);G.firing=false;invHud();hud();}
function useHeld(first){const it=held();if(P.inCar&&!(it&&(it.t==="weapon"||it.t==="spell"||(it.t==="build"&&it.id==="horn"))))return;if(!it){if(first)punch();return;}
  if(it.t==="weapon"){if(WEAPONS[G.id].auto||first)fire();return;}
  if(!first)return;
  if(it.t==="build"&&it.id==="horn"){blowHorn();return;}
  if(it.t==="build"&&it.id==="book"){ask("Your book",[["📖 Read it",()=>readBook()],["Set it down",()=>placeThing(SEL)],["Cancel",null]]);return;}
  if(it.t==="build"&&fnOf(it)&&BUILD.FNS[fnOf(it)].hand){inventUse(it);return;}
  if(it.t==="build"&&HOLDW[it.id]){waterUse(it);return;}
  if(it.t==="build"){placeThing(SEL);return;}
  if(it.t==="spell"){if(castSpell(it.id)){it.uses--;if(it.uses<=0)INV[SEL]=null;invHud();hud();}return;}
  if(it.t==="food"){if(eat(it)){it.n--;if(!it.n)INV[SEL]=null;invHud();hud();}return;}
  if(it.t==="potion"&&it.id==="fortis"){drinkFortis();mpFx("fortis");it.n--;if(!it.n)INV[SEL]=null;invHud();hud();return;}
  if(it.t==="potion"){if(P.hp>=P.maxHp){popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"already full","burn");return;}KINDS.heal(null,{amount:50});it.n--;if(!it.n)INV[SEL]=null;invHud();hud();return;}
  popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"craft with it: E","spell");}
let punchN=0;
function punch(K){K=K||1;const RR=K>1?.6:0;if(P.down||!started||paused||bagOpen||G.cool>0)return;G.cool=.45;punchN++;
  if(RIG)RIG.up(punchN%2?"Unarmed_Melee_Attack_Punch_A":"Unarmed_Melee_Attack_Punch_B",{once:true,dur:.4,restart:true,then:()=>RIG.up("2H_Ranged_Aiming")});mpFx("punch");
  setTimeout(()=>{const f=fwdFlat(),at=P.pos.clone().add(new THREE.Vector3(0,1.1,0)).addScaledVector(f,.9);let hit=false;
    DUMMIES.forEach(d=>{if(d.down||hit)return;const v=d.g.position.clone().sub(P.pos);v.y=0;const dist=v.length();if(dist<2.1+RR&&v.normalize().dot(f)>.45){hit=true;damage(d,Math.round((d.enemy?4:9)*K),d.g.position.clone().add(new THREE.Vector3(0,1.2,0)),false,{el:"plain"});}});
    if(!hit)for(const id in MP.others){const o=MP.others[id];const v=o.g.position.clone().sub(P.pos);v.y=0;if(!hit&&v.length()<1.8+RR&&v.normalize().dot(f)>.45){hit=true;hitPlayer(o,Math.round(8*Math.min(2.2,K)),o.g.position.clone().add(new THREE.Vector3(0,1.3,0)));}}
    if(!hit)PEOPLE.forEach(pp=>{if(pp.down||hit)return;const v=pp.o.g.position.clone().sub(P.pos);v.y=0;if(v.length()<1.8+RR&&v.normalize().dot(f)>.45){hit=true;hurtPerson(pp,Math.round(6*Math.min(2.2,K)),pp.o.g.position.clone().add(new THREE.Vector3(0,1.3,0)));}});
    if(!hit)TREES.forEach(tr=>{if(tr.down||hit)return;const v=tr.g.position.clone().sub(P.pos);v.y=0;if(v.length()<2&&v.normalize().dot(f)>.4){hit=true;chopHit(tr,Math.round(7*Math.min(2.5,K)),tr.g.position.clone().add(new THREE.Vector3(0,1.1,0)));}});
    if(!hit)NODES.forEach(n=>{if(n.down||hit)return;const v=n.g.position.clone().sub(P.pos);v.y=0;if(v.length()<2.3&&v.normalize().dot(f)>.4){hit=true;mineHit(n,Math.round(7*Math.min(2.5,K)),n.g.position.clone().add(new THREE.Vector3(0,.8,0)));}});
    if(hit){shake(.05);for(let i=0;i<8;i++)PUFF.emit(at,rnd3(1.2),C(0xffffff).multiplyScalar(.4),.35,{drag:3});}},150);}
function invHud(){const hb=$("#hotbar");if(!hb)return;let h="";for(let i=0;i<9;i++){const it=INV[i],f=itemInfo(it);
    h+=`<div class="slot${i===SEL?" sel":""}" data-i="${i}"><i>${i+1}</i>${f?`<span>${ico(f)}</span>${f.count>1||it.t==="spell"?`<b>${f.count}</b>`:""}${f.num?`<em>${f.num}</em>`:""}`:""}</div>`;}
  hb.innerHTML=h;}
// things lying in the world: walk close and they fly to you (a full bag leaves them on the ground)
const PICKUPS=[];
const PICTEX={};function picTex(k){if(!PICTEX[k]){const t=PICTEX[k]=new THREE.TextureLoader().load(PIC(k));if("colorSpace" in t)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}return PICTEX[k];}
function picSprite(k){return new THREE.Sprite(new THREE.SpriteMaterial({map:picTex(k),depthWrite:false,transparent:true,alphaTest:.1}));}
function iconSprite(text,px){const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");x.font=`${px||88}px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif`;x.textAlign="center";x.textBaseline="middle";x.fillText(text,64,70);
  const t=new THREE.CanvasTexture(c);if("colorSpace" in t)t.colorSpace=THREE.SRGBColorSpace;return new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false,transparent:true}));}
const DROP_ITEM=(...a)=>dropItem(...a);
function dropItem(at,it,life,sid,exact){if(it.t==="build"&&!it.thumb&&it.parts&&it.parts.length)it.thumb=BUILD.snap(it.parts,96);const f=itemInfo(it);const hex=it.t==="spell"?FX.HEX[SPELLS[it.id].el]:it.t==="weapon"?0xffd27a:0xffffff;
  const g=new THREE.Group();if(exact)g.position.set(at.x,at.y||0,at.z);else g.position.set(at.x+rnd(-.8,.8),at.drop?at.y:0,at.z+rnd(-.8,.8));let bob;
  if(it.t==="spell"){bob=picSprite(f.pic);bob.scale.setScalar(.8);const lb=label(f.name,hex);lb.position.y=1.65;g.add(lb);}
  else{bob=picSprite(f.pic);bob.scale.setScalar(.75);if((it.n||0)>1){const lb=label("×"+it.n,0xffffff);lb.scale.set(1.2,.22,1);lb.position.y=1.5;g.add(lb);}}
  bob.position.y=.9;g.add(bob);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.32,.44,30),new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;g.add(ring);
  scene.add(g);PICKUPS.push({g,it,bob,ring,t:Math.random()*5,life:life||300,sid:sid||null});/* everything on the ground lasts 5 minutes (Barbara, 2026-11-22) */return PICKUPS[PICKUPS.length-1];}
const DROP_FULL={},TAKING={};   // TAKING: things you picked up, waiting for the server to say they're yours
function shareDrop(d){if(!MP.ok||!d)return;d.sid=MP.id.slice(0,6)+Math.random().toString(36).slice(2,8);let it=d.it;if(it.t==="build"){DROP_FULL[d.sid]=it;it={t:"build",id:it.id,n:1};["wall","roof","fn","nm","ef","exp","sp","gas","water"].forEach(k=>{if(d.it[k]!==undefined)it[k]=d.it[k];});const p=compactParts(d.it.parts);if(p.length&&JSON.stringify(p).length<15000)it.parts=p;}
  setKey("drop:"+d.sid,{it,x:R2(d.g.position.x),y:R2(d.g.position.y),z:R2(d.g.position.z),s:d.sid,t:Math.round(Date.now()/1000)});}
// dropping your own things (G, or Drop in the bag): they land in front of you, stay 5 minutes, and only pull back to you once you have walked away
function dropOwn(i){const it=INV[i];if(!it||P.down)return false;const at=P.pos.clone().add(new THREE.Vector3(-Math.sin(P.yaw)*1.8,0,-Math.cos(P.yaw)*1.8));at.y=Math.max(0,floorUnder());at.drop=true;
  if(it.t==="weapon")it.ammo=null;const dp=dropItem(at,it,300);dp.hold=true;shareDrop(dp);INV[i]=null;if(i===SEL)select(SEL);invHud();hud();
  const f=itemInfo(it);popNum(P.pos.clone().add(new THREE.Vector3(0,2.3,0)),`dropped ${f.name}`,"spell",f.pic);return true;}
function stepPickups(dt){for(let i=PICKUPS.length-1;i>=0;i--){const d=PICKUPS[i];d.t+=dt;d.life-=dt;d.bob.position.y=.9+Math.sin(d.t*3)*.12;if(d.bob.isMesh)d.bob.rotation.y+=dt*2.2;d.ring.scale.setScalar(1+Math.sin(d.t*4)*.08);
    if(d.life<6)d.g.visible=Math.sin(d.t*16)>-.2;
    const dx=P.pos.x-d.g.position.x,dz=P.pos.z-d.g.position.z,dist=Math.hypot(dx,dz);
    const mag=carryMagnet(),reach=mag?14:3;if(d.hold&&dist>reach+.5)d.hold=false;
    if(!d.hold&&!P.down&&dist<reach&&Math.abs(P.pos.y-d.g.position.y)<(mag?6:2)&&(!mag||dist<3||d.it.t==="coin"||canAdd(d.it))){if(mag&&dist<3)d.g.position.y+=(P.pos.y-d.g.position.y)*Math.min(1,dt*6);if(dist<1&&d.sid&&MP.ok&&(d.it.t==="coin"||canAdd(d.it))){TAKING[d.sid]=d.it;share({k:"take",id:d.sid});scene.remove(d.g);PICKUPS.splice(i,1);continue;}if(dist<1){if(addItem(d.it)){const f=itemInfo(d.it);popNum(P.pos.clone().add(new THREE.Vector3(0,2.3,0)),`+${d.it.n||d.it.uses||1} ${f.name}`,"spell",f.pic);scene.remove(d.g);PICKUPS.splice(i,1);continue;}}
      else{const sp=mag?Math.min(16,6+dist*2):6;d.g.position.x+=dx/dist*dt*sp;d.g.position.z+=dz/dist*dt*sp;}}
    if(d.life<=0){if(d.sid)setKey("drop:"+d.sid,null);scene.remove(d.g);PICKUPS.splice(i,1);}}}
// ---------------- mining: crystal veins and iron rocks; shoot them to break them, they grow back ----------------
const NODES=[];
RNG=seedRnd(12);
const NODE_SPOTS=[["ferrum",14,9],["ferrum",-16,-3],["ferrum",22,-15],["ferrum",-14,44],["ferrum",8,48],["ferrum",-44,-46],
  ["carbo",150,28],["carbo",164,42],["nimbus",-50,6],["nimbus",-66,24],["silex",-28,56],["silex",-44,70],["aether",48,-48],["aether",64,-64],["electrum",6,58],["electrum",24,72]];
function makeNode(kind,x,z){for(let k=0;k<8&&BLOCKS.some(b=>Math.abs(x-b.x)<b.w/2+1.4&&Math.abs(z-b.z)<b.d/2+1.4);k++){x*=1.08;z*=1.08;}
  const g=new THREE.Group();g.position.set(x,0,z);const ore=kind==="ferrum";
  const rock=LOOK.M(new THREE.DodecahedronGeometry(.8),LOOK.toon(ore?0x7d7873:0x8f8a84),.02);rock.scale.set(1.25,.75,1.05);rock.position.y=.45;rock.rotation.y=RNG()*6;g.add(rock);
  const shards=[];
  if(ore){for(let i=0;i<9;i++){const f=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.18),new THREE.MeshStandardMaterial({color:0xc9ced6,metalness:.8,roughness:.3}));const a=RNG()*6.3,u=RNG()*1.2;f.position.set(Math.cos(a)*.75*Math.cos(u),.45+Math.sin(u)*.55,Math.sin(a)*.65*Math.cos(u));f.rotation.set(rnd(0,3),rnd(0,3),0);g.add(f);shards.push(f);}}
  else{const hex=FX.HEX[MAT[kind].el];for(let i=0;i<6;i++){const s=new THREE.Mesh(new THREE.OctahedronGeometry(.22),glow(hex,1.3));const a=i/6*6.3+rnd(-.3,.3),r=i?.45:0;s.position.set(Math.cos(a)*r,.95+(i?0:.25),Math.sin(a)*r);s.scale.set(.8,2.4+rnd(-.4,.6),.8);s.rotation.set(i?Math.sin(a)*.5:0,0,i?-Math.cos(a)*.5:0);g.add(s);shards.push(s);}}
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(g);const n={g,rock,kind,hp:ore?60:90,max:ore?60:90,down:false,shards};rock.userData.node=n;NODES.push(n);}
NODE_SPOTS.forEach(([k,x,z])=>makeNode(k,x,z));
function mineHit(n,dmg,at){if(n.down)return;n.hp-=dmg;const hex=n.kind==="ferrum"?0xd8dde4:FX.HEX[MAT[n.kind].el];sparks(at,10,hex);for(let i=0;i<3;i++)PUFF.emit(at,rnd3(1.5),C(0x9a948c).multiplyScalar(.5),.5,{drag:2});
  popNum(at,`${Math.max(0,Math.ceil(n.hp))}`,"burn");n.shards.forEach(s=>s.position.x+=rnd(-.02,.02));
  if(n.hp>0){share({k:"node",i:NODES.indexOf(n),h:Math.round(n.hp)});return;}nodeBreak(n,true);}
function nodeBreak(n,mine){const hex=n.kind==="ferrum"?0xd8dde4:FX.HEX[MAT[n.kind].el];n.down=true;const at2=n.g.position.clone();if(mine){shake(.06);share({k:"node",i:NODES.indexOf(n)});}for(let i=0;i<22;i++)SPARK.emit(at2.clone().add(new THREE.Vector3(0,.8,0)),rnd3(1).normalize().multiplyScalar(rnd(2,6)),C(hex),rnd(.4,.8),{grav:8});
  tween(.3,t=>n.g.scale.setScalar(Math.max(.01,1-t)),()=>{n.g.visible=false;});
  if(mine){if(n.kind==="ferrum")dropItem(at2,{t:"mat",id:"ferrum",n:ri(2,3)});else dropItem(at2,{t:"mat",id:n.kind,n:Math.random()<.35?2:1});}
  setTimeout(()=>{n.hp=n.max;n.down=false;n.g.visible=true;tween(.5,t=>n.g.scale.setScalar(Math.max(.01,t)));},45000);}
const ri=(a,b)=>a+Math.floor(RNG()*(b-a+1));
// a ray from a to b: does a wall stand in between? (holes let it through)
function wallBetween(a,b){const d=b.clone().sub(a);const len=d.length();const r=new THREE.Raycaster(a,d.normalize(),0,len);for(const h of r.intersectObjects(SOLIDS,false)){const bl=h.object.userData.block;if(bl&&(bl.pass||holeAt(bl,h.point)))continue;if(!bl)continue;return h;}return null;}

// ---------------- coins and the market: the merchant's stall in town buys what you find and sells what you need ----------------
let COINS=0;
const WPRICE={rifle:8,shotgun:25,staff:30,repeater:45,cannon:50,arcus:45};
function sellPrice(it){if(!it||it.t==="build")return 0;if(it.t==="food")return Math.max(1,Math.floor(FOODS[it.id].price/2));if(it.t==="mat")return MAT[it.id].sell||1;if(it.t==="potion")return it.id==="fortis"?12:8;if(it.t==="spell")return 3*Math.max(1,it.uses);if(it.t==="weapon")return WPRICE[it.id]||10;return 0;}
let OFFERS=[];let offersT=0;let HAG=null;const HAGNO=new Set();   // HAG: the deal Mercator is offering right now; HAGNO: stacks he won't haggle over again
const offerSlot=()=>Math.floor(Date.now()/120000);
function refreshOffers(){HAGNO.clear();HAG=null;refreshOffers.slot=offerSlot();const R0=seedRnd(refreshOffers.slot*7919+5);const sp=DROP_SPELLS.map(id=>[R0(),id]).sort((a,b)=>a[0]-b[0]).slice(0,3).map(a=>a[1]);
  OFFERS=[{t:"weapon",id:"rifle",price:30},{t:"potion",id:"potion",n:1,price:20},{t:"potion",id:"fortis",n:1,price:30},{t:"mat",id:"ferrum",n:1,price:MAT.ferrum.buy},{t:"mat",id:"lignum",n:1,price:MAT.lignum.buy},
    ...CRAFT.CORES.map(c=>({t:"mat",id:c,n:1,price:MAT[c].buy})),...sp.map(id=>({t:"spell",id,uses:SPELLS[id].uses,price:6*SPELLS[id].uses+8})),{t:"build",id:"invention",fn:"shovel",nm:"Shovel",n:1,parts:[{shape:"cylinder",r:1.6,h:95,y:62,mat:"wood"},{shape:"box",w:22,h:26,d:2,y:13,mat:"metal"},{shape:"box",w:14,h:3,d:3,y:110,mat:"wood"}],price:15}];}
refreshOffers();
function coinHud(){$("#coins").textContent="🪙 "+COINS;}
// the stall on the low platform north of the start, with KayKit's barbarian behind the counter
const MERCHANT={pos:new THREE.Vector3(2,.4,13.2),rig:null};
{const g=new THREE.Group();g.position.set(2,.4,12);scene.add(g);const wood=LOOK.toon(0x8a5a32),cloth=LOOK.toon(0xd8a03a),cloth2=LOOK.toon(0xf3ead6);
  {const c=LOOK.M(new THREE.BoxGeometry(3.6,1,1),wood,.02);c.position.y=.5;g.add(c);}
  [[-1.7,-.4],[1.7,-.4],[-1.7,1.6],[1.7,1.6]].forEach(([x,z])=>{const p=LOOK.M(new THREE.CylinderGeometry(.08,.08,2.8,8),wood,.01);p.position.set(x,1.4,z);g.add(p);});
  for(let i=0;i<6;i++){const s=LOOK.M(new THREE.BoxGeometry(.62,.08,2.3),i%2?cloth:cloth2,.01);s.position.set(-1.55+i*.62,2.85,.6);s.rotation.x=-.18;g.add(s);}
  ["🧪","🔩","🟡","🪵"].forEach((t,i)=>{const s=iconSprite(t);s.scale.setScalar(.45);s.position.set(-1.2+i*.8,1.25,0);g.add(s);});
  const sign=label("🪙 Mercator — trade here",0xffe08a);sign.scale.set(3.6,.68,1);sign.position.set(0,3.5,-.2);g.add(sign);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  const mh=new THREE.Group();mh.position.set(0,0,1.2);mh.rotation.y=Math.PI;g.add(mh);MERCHANT.o={g:mh,rig:null};
  LOOK.loadRig("/play/elementum/models/merchant.glb",false,r=>{if(!r)return;MERCHANT.rig=MERCHANT.o.rig=r;mh.add(r.root);r.root.traverse(o=>{if(o.name==="Mug")o.visible=true;});r.base("Idle",{snap:true});});
  {const m=block(2,12,3.6,1.4,1,0x8a5a32);m.material.visible=false;m.castShadow=false;}}   // the counter: you bump into it, shots stop at it
const nearMerchant=()=>P.pos.distanceTo(MERCHANT.pos)<4.2;
function sell(i){const it=INV[i];if(!it||it.t==="build"||!nearMerchant())return;const pr=sellPrice(it);COINS+=pr;
  if(it.t==="mat"||it.t==="potion"||it.t==="food"){it.n--;if(!it.n)INV[i]=null;}else INV[i]=null;
  if(i===SEL)select(SEL);invHud();hud();coinHud();if(MERCHANT.rig)MERCHANT.rig.full("Interact",{once:true,restart:true,dur:.8,then:()=>MERCHANT.rig.clearFull()});return pr;}
function buy(k,price){const o=OFFERS[k];if(!o||!nearMerchant())return "far";price=price===undefined?o.price:price;if(COINS<price)return "poor";const it=Object.assign({},o);delete it.price;delete it.deal;delete it.noHag;if(!addItem(it))return "full";
  COINS-=price;if(o.t==="spell")OFFERS.splice(k,1);coinHud();hud();if(MERCHANT.rig)MERCHANT.rig.full("Cheer",{once:true,restart:true,dur:1,then:()=>MERCHANT.rig.clearFull()});return "ok";}
// haggling: Mercator names a deal in words (a discount when you buy, a bonus when you sell a whole stack); work it out right and the deal is yours
function haggleBuy(k){const o=OFFERS[k];if(!o||o.noHag)return;if(!o.deal)o.deal=CRAFT.deal(o.price,MATH.lv,-1);HAG={k,o,d:o.deal,P:o.price};}
function haggleSell(i){const it=INV[i];if(!it||HAGNO.has(it))return;const P=sellPrice(it)*it.n;if(!it.deal||it.deal.P!==P)it.deal=Object.assign(CRAFT.deal(P,MATH.lv,1),{P});HAG={i,it,d:it.deal,P,sell:true};}
function haggle(ans){const H=HAG;HAG=null;if(!H||!nearMerchant())return {ok:false,msg:"Walk to the stall first."};
  if(H.sell){if(INV[H.i]!==H.it)return {ok:false,msg:""};
    if(ans!==H.d.pay){HAGNO.add(H.it);const lv=mathWrong();return {ok:false,msg:`“Ha! That's not what I said.” No deal — sell them one at a time at the normal price.`+lvNote(lv)};}
    COINS+=H.d.pay;INV[H.i]=null;if(H.i===SEL)select(SEL);invHud();hud();coinHud();if(MERCHANT.rig)MERCHANT.rig.full("Cheer",{once:true,restart:true,dur:1,then:()=>MERCHANT.rig.clearFull()});
    return {ok:true,msg:`🤝 Deal! +${H.d.pay} 🪙 (the normal price was ${H.P}).`+lvNote(mathRight())};}
  if(OFFERS[H.k]!==H.o)return {ok:false,msg:""};
  if(ans!==H.d.pay){H.o.noHag=true;const lv=mathWrong();return {ok:false,msg:`“Ha! Not quite.” Full price for that one, then.`+lvNote(lv)};}
  const lv=mathRight(),r=buy(H.k,H.d.pay);
  if(r!=="ok")return {ok:false,msg:{poor:`Right — it's ${H.d.pay} 🪙. But you don't have that many coins yet.`,full:"Your bag is full.",far:"Walk to the stall first."}[r]+lvNote(lv)};
  return {ok:true,msg:`🤝 Deal! You paid ${H.d.pay} 🪙 instead of ${H.P}.`+lvNote(lv)};}
function stepStall(dt){if(MERCHANT.rig)MERCHANT.rig.update(dt);if(offerSlot()!==refreshOffers.slot)refreshOffers();
}

// ---------------- town life: food that helps you, your house (bed + chest), a training center you build, a fountain, guards ----------------
// food: buy it at the Popina (the cook's stall), eat it from the hotbar. It heals a little and some give a boost for a while.
const FOODS={
  pomum:{name:"Apple",icon:"🍎",heal:8,price:3,what:"+8 HP"},
  panis:{name:"Bread",icon:"🍞",heal:20,price:6,what:"+20 HP"},
  uvae:{name:"Grapes",icon:"🍇",heal:10,price:5,buff:"jumpT",secs:30,what:"+10 HP · high jumps 30 s"},
  mel:{name:"Honey cake",icon:"🍯",heal:15,price:8,buff:"buffT",secs:30,what:"+15 HP · fast feet 30 s"},
  puls:{name:"Porridge",icon:"🥣",heal:0,price:10,buff:"regenT",secs:15,what:"+3 HP every second for 15 s"},
  caseus:{name:"Cheese",icon:"🧀",heal:5,price:12,buff:"toughT",secs:45,what:"take 25% less damage 45 s"},
  piscis:{name:"Grilled fish",icon:"🐟",heal:10,price:12,buff:"strongT",secs:45,what:"your hits do 25% more 45 s"},
};
// Potio Fortis: +50% damage and fast feet for 40 s — and every player within 12 m of you gets the same (multiplayer)
const MIGHT_S=40;
function drinkFortis(from){P.mightT=Math.max(P.mightT||0,MIGHT_S);P.buffT=Math.max(P.buffT||0,MIGHT_S);hud();const at=P.pos.clone().add(new THREE.Vector3(0,1.2,0));
  FX.stars(at,"gold",6,1.6);flash(at,FX.HEX.gold,7,.4);groundRing(P.pos.clone().add(new THREE.Vector3(0,.1,0)),12,FX.HEX.gold,.8,.7);
  popNum(P.pos.clone().add(new THREE.Vector3(0,2.4,0)),from?`${from} shared a Potio Fortis!`:"stronger and faster — shared with players near you","spell","potion_fortis");}
function eat(it){const f=FOODS[it.id];if(!f)return false;if(P.hp>=P.maxHp&&!f.buff&&NEEDS.food>=95){popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"already full","burn");return false;}
  P.hp=Math.min(P.maxHp,P.hp+f.heal);if(f.buff)P[f.buff]=Math.max(P[f.buff]||0,f.secs);hud();
  spikedEat(it);needUp("food",15+f.heal*1.5);popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),f.heal?"+"+f.heal+" HP":f.name,"spell","food_"+it.id);for(let i=0;i<14;i++)SPARK.emit(P.pos.clone().add(new THREE.Vector3(rnd(-.4,.4),rnd(.8,1.6),rnd(-.4,.4))),new THREE.Vector3(0,rnd(.8,2),0),C(0xffd27a),.6,{grav:-1});return true;}
// things you can walk up to and use with T (or the button that appears)
const ACTS=[];let ACT=null;
function stepActs(){let best=null,bd=1e9;for(const a of ACTS){if(a.hidden&&a.hidden())continue;if(Math.abs(P.pos.y-(a.pos.y||0))>1.6)continue;const d=Math.hypot(P.pos.x-a.pos.x,P.pos.z-a.pos.z);if(d<a.r&&d<bd){bd=d;best=a;}}
  ACT=best;const b=$("#trade");b.classList.toggle("hidden",!best||bagOpen||P.down||designOpen());if(best)b.textContent=`${typeof best.label==="function"?best.label():best.label}${touch?"":" (T)"}`;}
function useAct(){if(ACT&&!P.down&&!P.sleeping)ACT.run();}
function npc(url,x,z,face,idle){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=face;scene.add(g);const o={g,rig:null};
  LOOK.loadRig("/play/elementum/models/"+url,false,r=>{if(!r)return;o.rig=r;g.add(r.root);r.base(idle||"Idle",{snap:true});});TOWNFOLK.push(o);return o;}
const TOWNFOLK=[];
// the merchant from before becomes one of the "acts"
ACTS.push({pos:MERCHANT.pos,r:4.2,label:"🪙 Trade with Mercator",run:()=>toggleBag(true,"market"),hidden:()=>MERCHANT.pp&&MERCHANT.pp.down});
// --- the Popina: the cook's food stall
const COOK={pos:new THREE.Vector3(-16,0,15.2)};
{const g=new THREE.Group();g.position.set(-16,0,14);scene.add(g);const wood=LOOK.toon(0x7a4a28),red=LOOK.toon(0xc8432f),white=LOOK.toon(0xf6efe0);
  {const c=LOOK.M(new THREE.BoxGeometry(3.6,1,1),wood,.02);c.position.y=.5;g.add(c);}
  [[-1.7,-.4],[1.7,-.4],[-1.7,1.6],[1.7,1.6]].forEach(([x,z])=>{const p=LOOK.M(new THREE.CylinderGeometry(.08,.08,2.8,8),wood,.01);p.position.set(x,1.4,z);g.add(p);});
  for(let i=0;i<6;i++){const s=LOOK.M(new THREE.BoxGeometry(.62,.08,2.3),i%2?red:white,.01);s.position.set(-1.55+i*.62,2.85,.6);s.rotation.x=-.18;g.add(s);}
  ["🍞","🍎","🧀","🐟","🍯"].forEach((t,i)=>{const s=iconSprite(t);s.scale.setScalar(.42);s.position.set(-1.3+i*.65,1.22,0);g.add(s);});
  const pot=LOOK.M(new THREE.CylinderGeometry(.35,.28,.45,14),LOOK.toon(0x3a3a40),.01);pot.position.set(1.2,1.25,.1);g.add(pot);
  const sign=label("🍞 Popina — food that helps you",0xffd27a);sign.scale.set(3.8,.7,1);sign.position.set(0,3.5,-.2);g.add(sign);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});const m=block(-16,14,3.6,1.2,1,0x7a4a28);m.material.visible=false;m.castShadow=false;
  npc("cook.glb",-16,15.2,Math.PI);}
ACTS.push({pos:COOK.pos,r:4.2,label:"🍞 Buy food",run:()=>toggleBag(true,"food"),hidden:()=>COOK.pp&&COOK.pp.down});
// --- the houses: a row of six along the north wall, one for each player in your room (the server hands them out).
// The owner's name is over the door; the owner can lock it, and then only they can get in. Inside: a bed and a chest (the chest is yours).
const HOUSE_X=[-33,-23,-13,13,23,33],HOUSE_Z=34,HW=7,HD=5.4,HH=3;
const CHEST=new Array(18).fill(null);   // what you keep in your chest (on this device)
const HOUSES=HOUSE_X.map((x,slot)=>{const z=HOUSE_Z,t=.4,tone=0xd9c7a6;
  block(x,z+HD/2,HW,HH,t,tone);block(x-HW/2,z,t,HH,HD,tone);block(x+HW/2,z,t,HH,HD,tone);
  block(x-HW/4-.45,z-HD/2,HW/2-.9,HH,t,tone);block(x+HW/4+.45,z-HD/2,HW/2-.9,HH,t,tone);   // front, with a 1.8 m doorway
  const lint=LOOK.blockMesh(1.8,.6,t,tone);lint.position.set(x,HH-.3,z-HD/2);scene.add(lint);
  const roof=LOOK.M(new THREE.ConeGeometry(Math.hypot(HW,HD)/2+.6,2.2,4),LOOK.toon([0xb5482f,0x3f6fa8,0x4f8f3a,0x8a4fb0,0xc98a2b,0x2f8a8a][slot]),.03);roof.rotation.y=Math.PI/4;roof.scale.set(1,1,HD/HW);roof.position.set(x,HH+1.1,z);scene.add(roof);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(HW-.4,HD-.4),new THREE.MeshLambertMaterial({color:0x9a7a55}));floor.rotation.x=-Math.PI/2;floor.position.set(x,.02,z);floor.receiveShadow=true;scene.add(floor);
  // the door: an invisible block in the doorway that only stops you when it is locked and not yours, and a wooden leaf that swings
  const dm=block(x,z-HD/2,1.8,HH-.6,.3,0x7a4a28);dm.material.visible=false;dm.castShadow=false;const door=BLOCKS[BLOCKS.length-1];door.pass=true;
  const hinge=new THREE.Group();hinge.position.set(x-.9,0,z-HD/2);scene.add(hinge);const leaf=LOOK.M(new THREE.BoxGeometry(1.8,HH-.6,.12),LOOK.toon(0x7a4a28),.015);leaf.position.set(.9,(HH-.6)/2,0);hinge.add(leaf);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),LOOK.toon(0xd8ac4a));knob.position.set(1.6,1.1,-.1);hinge.add(knob);
  const bedP=new THREE.Vector3(x+2.2,0,z+1.3),chestP=new THREE.Vector3(x-2.5,0,z+1.8);
  const bed=new THREE.Group();bed.position.copy(bedP);scene.add(bed);
  {const f=LOOK.M(new THREE.BoxGeometry(1.3,.45,2.2),LOOK.toon(0x7a4a28),.02);f.position.y=.25;bed.add(f);const q=LOOK.M(new THREE.BoxGeometry(1.2,.18,1.7),LOOK.toon([0x3b6fb5,0xb53b3b,0x3bb56f,0xb59a3b,0x7a3bb5,0x3ba9b5][slot]),.01);q.position.set(0,.55,-.2);bed.add(q);
   const pil=LOOK.M(new THREE.BoxGeometry(.9,.18,.45),LOOK.toon(0xf6efe0),.01);pil.position.set(0,.58,.8);bed.add(pil);}
  const ch=new THREE.Group();ch.position.copy(chestP);scene.add(ch);
  {const b=LOOK.M(new THREE.BoxGeometry(1.1,.6,.7),LOOK.toon(0x8a5a32),.02);b.position.y=.3;ch.add(b);const l=LOOK.M(new THREE.CylinderGeometry(.35,.35,1.1,12,1,false,0,Math.PI),LOOK.toon(0x8a5a32),.02);l.rotation.z=Math.PI/2;l.position.y=.6;ch.add(l);}
  const h={slot,x,z,door,hinge,bed:bedP,chest:chestP,doorP:new THREE.Vector3(x,0,z-HD/2-1.2),name:"",locked:false,mine:false,sign:null,signKey:"",open:0};return h;});
const HOME={slept:false,restT:0,get h(){return HOUSES.find(h=>h.mine)||HOUSES[0];},get bed(){return this.h.bed;},get chest(){return this.h.chest;},get door(){return this.h.doorP;}};
HOUSES[0].mine=true;HOUSES[0].name="You";   // until the server answers (or when playing alone)
function houseSigns(){HOUSES.forEach(h=>{const txt=h.name?`🏠 ${h.mine?h.name+" (you)":h.name}${h.locked?" 🔒":""}`:"🏠 Free house";if(txt===h.signKey)return;h.signKey=txt;
  if(h.sign)scene.remove(h.sign);h.sign=label(txt,h.mine?0x9dffb0:h.name?0xffffff:0xbfbfbf);h.sign.scale.set(3.4,.64,1);h.sign.position.set(h.x,HH+2.8,h.z-HD/2);scene.add(h.sign);});}
houseSigns();
function setHouses(list){HOUSES.forEach(h=>{h.name="";h.locked=false;h.mine=false;});(list||[]).forEach(s=>{const h=HOUSES[s.slot];if(!h)return;h.name=s.name;h.locked=s.locked;h.mine=s.mine;});
  if(!HOUSES.some(h=>h.mine)){HOUSES[0].mine=true;HOUSES[0].name=HOUSES[0].name||"You";}
  if(MP.lockReq!==undefined){const h=HOME.h;h.locked=MP.lockReq;}houseSigns();}
function stepHouses(dt){HOUSES.forEach(h=>{const near=Math.hypot(P.pos.x-h.x,P.pos.z-(h.z-HD/2))<2.6;
    h.door.pass=!h.locked||h.mine;   // a locked door stops everyone but its owner
    const want=(!h.locked&&near)||(h.mine&&near)?1:0;h.open+=(want-h.open)*Math.min(1,dt*6);h.hinge.rotation.y=-h.open*1.6;});}
function toggleLock(){const h=HOME.h;h.locked=!h.locked;MP.lockReq=h.locked;houseSigns();popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),h.locked?"locked — only you can get in":"unlocked","spell");}
// sleeping (2026-11-22, "sleep should make you sleep for 10 hours"): the clock is the same for every player, so you really sleep through
// 10 hours on a sleep screen — it takes 1 real minute (Barbara: "make it feel like 1 minute"); you heal as you sleep, and you can wake up early. Getting hurt wakes you.
const SLEEP_H=10;
const hourNow=()=>{const DL=.62,t=DAY.t;return (t<DL?6+12*t/DL:18+12*(t-DL)/(1-DL))%24;};
const fmtH=h=>{h=Math.floor(h)%24;return `${h%12||12} ${h<12?"am":"pm"}`;};
function sleep(){startSleep(houseSpot(HOME.h));}
// (Barbara chose: sleep until morning on the shared clock, so the sleep screen and the corner clock always agree. At night you sleep until 7 am
// — at most about 2 real minutes; in the daytime it's a 1-minute nap. Either way you wake fully healed.)
const isNight=()=>{const h=hourNow();return h>=18||h<7;};
// someone already there? (two people can't sit on one chair or sleep in one bed)
const takenSpot=p=>Object.values(MP.others).find(o=>(o.po==="sit"||o.po==="sleep")&&Math.hypot(o.to.x-p.x,o.to.z-p.z)<.7&&Math.abs(o.to.y-p.y)<1.5);
const bedSpot=(x,y,z,r,parts)=>({x,y:y+(parts?seatOf({item:{id:"bed",parts}}):.64),z,r});
const houseSpot=h=>{const p=h.mine?MYHOUSE&&MYHOUSE.bedParts:(WORLD_KEYS["hbp:"+h.slot+"bed"]||{}).p;return bedSpot(h.bed.x,0,h.bed.z,0,p);};
function startSleep(spot){if(P.sleeping||P.down)return;if(spot){const t=takenSpot(spot);if(t){lawSay(`${t.name||"Someone"} is sleeping here.`);return;}}HOME.slept=true;const night=isNight();
  const T7=(7-6)/12*.62,ms=night?((T7-DAY.t+1)%1)*CLOCK.len*1000:60000;
  P.sleeping={spot:spot||null,back:P.pos.clone(),t0:Date.now(),until:Date.now()+Math.max(4000,ms),hp0:P.hp,from:hourNow(),night};G.firing=false;
  $("#sleepBox").classList.remove("hidden");$("#sleepWhat").innerHTML=night?"Sleeping until <b>7 am</b>.":"Taking a nap (about a minute).";}
function endSleep(full,why){const z=P.sleeping;if(!z)return;P.sleeping=null;if(z.spot&&!P.down){P.pos.copy(z.back);P.vel.set(0,0,0);P.fallTop=undefined;}$("#sleepBox").classList.add("hidden");if(full){P.hp=P.maxHp;P.slowT=P.dizzyT=P.sickT=P.flipT=0;NEEDS.sleep=100;}hud();needsHud();
  popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),why||(full?(z.night?"Good morning — fully rested!":"what a nap — fully rested!"):"you woke up early"),"spell");}
function stepSleep(){const z=P.sleeping;if(!z)return;const k=Math.min(1,(Date.now()-z.t0)/(z.until-z.t0));P.hp=z.hp0+(P.maxHp-z.hp0)*k;if(z.en0===undefined)z.en0=NEEDS.sleep;NEEDS.sleep=Math.max(NEEDS.sleep,z.en0+(100-z.en0)*k);P.vel.set(0,0,0);if(z.spot){P.pos.set(z.spot.x,z.spot.y,z.spot.z);P.fallTop=undefined;P.onGround=true;}
  $("#sleepBar").style.width=(k*100).toFixed(1)+"%";$("#sleepNow").textContent=fmtH(hourNow());const left=Math.ceil((z.until-Date.now())/1000);$("#sleepLeft").textContent=left>0?`about ${left>=60?Math.round(left/60)+" min":left+" s"} to go`:"";if(k>=1)endSleep(true);}
ACTS.push({get pos(){return HOME.bed;},r:2.2,hidden:()=>!HOME.h.built||!(MYHOUSE&&MYHOUSE.bed),label:()=>isNight()?"🛏️ Sleep until morning":"🛏️ Take a nap",run:sleep});
ACTS.push({get pos(){return HOME.chest;},r:2,hidden:()=>!HOME.h.built||!(MYHOUSE&&MYHOUSE.chest),label:"📦 Open your chest",run:()=>toggleBag(true,"chest")});
ACTS.push({get pos(){return HOME.door;},r:2,hidden:()=>!HOME.h.built,label:()=>HOME.h.locked?"🔓 Unlock your door":"🔒 Lock your door",run:toggleLock});
HOUSES.forEach(h=>ACTS.push({pos:h.doorP,r:1.8,hidden:()=>h.mine||!h.locked,label:()=>`🔒 ${h.name}'s house is locked`,run:()=>{}}));
// --- trees you can chop (punch or shoot them): wood for everything; they grow back
const TREES=[];
function makeTree(x,z){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);const s=rnd(.85,1.2);
  const trunk=LOOK.M(new THREE.CylinderGeometry(.22*s,.32*s,2.2*s,8),LOOK.toon(0x7a4a28),.015);trunk.position.y=1.1*s;g.add(trunk);
  [[0,2.6,0,1.1],[.5,2.2,.2,.8],[-.45,2.3,-.25,.85],[0,3.3,0,.75]].forEach(([a,b,c,r])=>{const l=LOOK.M(new THREE.IcosahedronGeometry(r*s,1),LOOK.toon(RNG()<.5?0x3f8f3a:0x4fa346),.02);l.position.set(a*s,b*s,c*s);g.add(l);});
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});const t={g,trunk,hp:35,max:35,down:false,s};trunk.userData.tree=t;TREES.push(t);return t;}
function chopHit(t,dmg,at){if(t.down)return;t.hp-=dmg;for(let i=0;i<6;i++)SPARK.emit(at,rnd3(1.5),C(0xb98a55),.5,{grav:6});for(let i=0;i<3;i++)PUFF.emit(t.g.position.clone().add(new THREE.Vector3(rnd(-1,1),rnd(2,3.4)*t.s,rnd(-1,1))),new THREE.Vector3(0,-1,0),C(0x4fa346).multiplyScalar(.5),.6,{drag:2});
  popNum(at,`${Math.max(0,Math.ceil(t.hp))}`,"burn");t.g.rotation.z=rnd(-.03,.03);
  if(t.hp>0){share({k:"tree",i:TREES.indexOf(t),h:Math.round(t.hp)});return;}treeFall(t,true);}
// a tree falls (loot only for whoever felled it; the others just see it fall), and grows back after 45 s
function treeFall(t,mine){t.down=true;const side=Math.random()<.5?1:-1;tween(.9,k=>{t.g.rotation.z=side*k*k*1.45;},()=>{tween(.5,k=>t.g.scale.setScalar(Math.max(.01,1-k)),()=>{t.g.visible=false;});});
  if(mine){dropItem(t.g.position.clone(),{t:"mat",id:"lignum",n:ri(2,4)});shake(.05);share({k:"tree",i:TREES.indexOf(t)});}
  setTimeout(()=>{t.hp=t.max;t.down=false;t.g.rotation.z=0;t.g.visible=true;tween(.8,k=>t.g.scale.setScalar(Math.max(.01,k)));},45000);}
// a grove inside the walls on each side, and woods out in the wilds
RNG=seedRnd(11);
for(let i=0;i<9;i++)makeTree(31+(i%3)*5+rnd(-1,1),-30+Math.floor(i/3)*7+rnd(-1,1));
for(let i=0;i<9;i++)makeTree(-41+(i%3)*5+rnd(-1,1),6+Math.floor(i/3)*6+rnd(-1,1));
[[160,10],[164,16],[158,18],[-52,-18],[-57,-24],[-50,-28],[-20,52],[-14,56],[-26,48],[30,52],[36,56],[28,-52],[34,-58],[-34,-56]].forEach(([x,z])=>makeTree(x,z));
// --- villagers: walk up to one with ❗ — they ask for help and pay in coins
const QUESTS={kills:{},dummies:0};
const VILLAGERS=[["Livia",-26,-15,1.2],["Marcus",27,8,-1.6],["Felix",-24,26,2.4],["Octavia",6,24,3.14]].map(([name,x,z,face])=>{
  const o=npc("villager.glb",x,z,face);const v={name,pos:new THREE.Vector3(x,0,z),o,q:null,mark:null,markKey:""};
  const lb=label(name,0xffffff);lb.scale.set(1.6,.3,1);lb.position.set(0,2.35,0);o.g.add(lb);return v;});
// --- each villager's cottage, with a garden beside it: roofs blow off, walls get smashed, gardens need fences — jobs you work out with math
const COTTAGE_AT={Livia:[-35,-25,-35,-19.5,6,3],Marcus:[37,8,37,14,6,3],Felix:[-35,26,-29.5,26,4,5],Octavia:[12,26,12,20,6,3]};   // x, z, garden x, z, width, depth
const CW=5,CD=4,CH=2.6,CR=1.4;   // cottage width (x), depth (z), wall height, roof rise
function makeCottage(v,i){const [x,z,gx,gz,gw,gd]=COTTAGE_AT[v.name];const c={x,z,pos:new THREE.Vector3(x,0,z),garden:new THREE.Vector3(gx,0,gz),gw,gd,roofHoles:[],wallHoles:[]};
  const tone=[0xe8d9b8,0xdfcfae,0xe6d2b0,0xeadcc0][i],wood=LOOK.toon(0x9a6a3a);block(x,z,CW,CH,CD,tone);
  {const d=LOOK.M(new THREE.BoxGeometry(.9,1.7,.08),LOOK.toon(0x6b4423),.01);d.position.set(x,.85,z+CD/2+.04);scene.add(d);}
  // a gable roof: two sloping slabs, with the holes (hidden until a storm) lying on top of them
  const rm=LOOK.toon([0xa8452c,0x6b5a9e,0x3f7f5a,0xb07a2a][i]),half=CD/2+.35,slope=Math.hypot(half,CR),ang=Math.atan2(CR,half);
  c.roofMat=new THREE.MeshLambertMaterial({color:0x22160e});c.wallMat=new THREE.MeshLambertMaterial({color:0x22160e});
  [1,-1].forEach(sd=>{const g=new THREE.Group();g.position.set(x,CH+CR/2,z+sd*half/2);g.rotation.x=sd*ang;scene.add(g);
    const slab=LOOK.M(new THREE.BoxGeometry(CW+.6,.16,slope),rm,.02);slab.castShadow=true;g.add(slab);
    [[-1.3,-.2],[.4,.35],[1.5,-.3]].forEach(([hx,hz])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.75,.05,.6),c.roofMat);m.position.set(hx*sd,.1,hz);m.visible=false;g.add(m);c.roofHoles.push(m);});});
  {const tri=new THREE.Shape();tri.moveTo(-CD/2,0);tri.lineTo(CD/2,0);tri.lineTo(0,CR);tri.closePath();const gm=new THREE.MeshLambertMaterial({color:tone,side:THREE.DoubleSide});
    [1,-1].forEach(sx=>{const m=new THREE.Mesh(new THREE.ShapeGeometry(tri),gm);m.rotation.y=Math.PI/2;m.position.set(x+sx*CW/2,CH,z);scene.add(m);});}
  [1,-1].forEach(sd=>[[-1.7,1.4],[-1,.6],[1.6,1.1]].forEach(([hx,hy])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.7,.6,.06),c.wallMat);m.position.set(x+hx*sd,hy,z+sd*(CD/2+.03));m.visible=false;scene.add(m);c.wallHoles.push(m);}));
  const sg=label(`${v.name}'s cottage`,0xfff2c8);sg.scale.set(2.6,.5,1);sg.position.set(x,CH+CR+.6,z);scene.add(sg);
  // the garden: soil, a few cabbages, the fence (once built) and the builder's rope outline (while a fence job is open)
  const x0=gx-gw/2,x1=gx+gw/2,z0=gz-gd/2,z1=gz+gd/2;
  {const soil=new THREE.Mesh(new THREE.PlaneGeometry(gw-.3,gd-.3),new THREE.MeshLambertMaterial({color:0x6b4a2b}));soil.rotation.x=-Math.PI/2;soil.position.set(gx,.03,gz);soil.receiveShadow=true;scene.add(soil);
    for(let k=0;k<6;k++){const b=LOOK.M(new THREE.SphereGeometry(.22,8,6),LOOK.toon(0x5fae4a),.01);b.scale.y=.7;b.position.set(gx+rnd(-gw/2+.6,gw/2-.6),.16,gz+rnd(-gd/2+.6,gd/2-.6));scene.add(b);}}
  const fg=new THREE.Group();fg.visible=false;scene.add(fg);const per=2*(gw+gd),N=Math.round(per/1.2);
  for(let k=0;k<N;k++){let t=k/N*per,px,pz;if(t<gw){px=x0+t;pz=z0;}else if((t-=gw)<gd){px=x1;pz=z0+t;}else if((t-=gd)<gw){px=x1-t;pz=z1;}else{t-=gw;px=x0;pz=z1-t;}
    const p=LOOK.M(new THREE.CylinderGeometry(.07,.08,1.1,6),wood,.01);p.position.set(px,.55,pz);fg.add(p);}
  [[gx,z0,gw,0],[gx,z1,gw,0],[x0,gz,gd,1],[x1,gz,gd,1]].forEach(([rx,rz,len,side])=>[.45,.85].forEach(y=>{const r=LOOK.M(new THREE.BoxGeometry(side?.06:len,.08,side?len:.06),wood,.008);r.position.set(rx,y,rz);fg.add(r);}));
  const pg=new THREE.Group();pg.visible=false;scene.add(pg);[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].forEach(([a,b])=>{const st=LOOK.M(new THREE.CylinderGeometry(.04,.05,.6,6),wood,.008);st.position.set(a,.3,b);pg.add(st);});
  pg.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]].map(([a,b])=>new THREE.Vector3(a,.5,b))),new THREE.LineBasicMaterial({color:0xd8b06a})));
  c.fence=fg;c.plan=pg;c.mark=iconSprite("🔨");c.mark.scale.setScalar(.7);c.mark.visible=false;scene.add(c.mark);return c;}
// st: "ok" (never damaged) | "broken" (a job is waiting) | "fixed" (your planks / iron plates / fence show)
function cottageState(c,kind,st){const cv=VILLAGERS.find(v=>v.home===c);if(cv)setKey(`cot:${cv.name}:${kind}`,st);
  if(kind==="fence"){c.plan.visible=st==="broken";if(st==="fixed")c.fenced=true;if(st==="fixed"&&!c.fence.visible){c.fence.visible=true;c.fence.scale.y=.02;tween(.7,k=>c.fence.scale.y=Math.max(.02,k));}else c.fence.visible=st==="fixed";return;}
  const hs=kind==="roof"?c.roofHoles:c.wallHoles,mat=kind==="roof"?c.roofMat:c.wallMat;hs.forEach(m=>m.visible=st!=="ok");mat.color.setHex(st==="broken"?0x22160e:kind==="roof"?0xd8a65e:0x9aa4ae);}
VILLAGERS.forEach((v,i)=>{v.home=makeCottage(v,i);});
const workQ=v=>v.q&&v.q.accepted&&v.q.k==="work"&&!v.q.fixed?v.q:null;
const JOBDO={roof:"fix the roof",patch:"patch the wall",fence:"build the fence"};
let QW=null;
VILLAGERS.forEach(v=>{const c=v.home,open=()=>{QW=v;forgeMsg="";toggleBag(true,"work");};
  ACTS.push({pos:c.pos,r:4.4,label:()=>`🔨 ${v.q.job==="roof"?"Fix the roof":"Patch the wall"} of ${v.name}'s cottage`,hidden:()=>{const q=workQ(v);return !q||q.job==="fence";},run:open});
  ACTS.push({pos:c.garden,r:Math.max(c.gw,c.gd)/2+1.6,label:()=>`🔨 Build ${v.name}'s garden fence`,hidden:()=>{const q=workQ(v);return !q||q.job!=="fence";},run:open});});
function workNow(v,ans){const q=workQ(v);if(!q)return {ok:false,msg:""};const w=q.w,c=v.home,at0=q.job==="fence"?c.garden:c.pos;
  if(Math.hypot(P.pos.x-at0.x,P.pos.z-at0.z)>6)return {ok:false,msg:"Walk over to the job first."};let lv="";
  if(!w.solved){if(ans!==w.n){w.tries++;lv=mathWrong();
      if(lv==="down"){q.w=Object.assign(CRAFT.job(q.job,MATH.lv),{tries:0});return {ok:false,msg:"That many won't fit. Here's the job worked out an easier way."+lvNote(lv)};}
      return {ok:false,msg:"That many won't fit — check your math and try again."};}
    w.solved=true;if(!w.tries)lv=mathRight();}
  if(countMat(w.m)<w.n)return {ok:false,msg:`Right — it takes ${w.n} ${w.unit}s. You only have ${countMat(w.m)} ${MAT[w.m].name}: ${w.m==="lignum"?"chop some trees":"mine the grey rocks"}, then come back.`+lvNote(lv)};
  takeMat(w.m,w.n);q.fixed=true;cottageState(c,q.job,"fixed");const at=at0.clone().add(new THREE.Vector3(0,q.job==="roof"?CH+1:1.2,0));
  FX.stars(at,"gold",6,1.6);for(let k=0;k<12;k++)PUFF.emit(at.clone().add(new THREE.Vector3(rnd(-1.5,1.5),0,rnd(-1,1))),new THREE.Vector3(rnd(-1,1),rnd(1,2),rnd(-1,1)),C(0xb8a07a).multiplyScalar(.5),.7,{drag:2});
  return {ok:true,msg:`✨ ${{roof:"The roof is fixed",patch:"The wall is patched",fence:"The fence stands"}[q.job]}! Go back to ${v.name} (✅) to get paid.`+lvNote(lv)};}
const MONSTER_NAMES=()=>Object.keys(ENEMY_TYPES);
function newQuest(v){let r=Math.random();let q;
  if(v.q&&v.q.k==="work"&&!v.q.fixed)cottageState(v.home,v.q.job,v.q.job==="fence"&&v.home.fenced?"fixed":"ok");   // a job nobody did: put the cottage back
  if(r<.42&&(!v.home.lot||v.home.lot.built)){const job=pick(["roof","patch","fence"]),w=Object.assign(CRAFT.job(job,MATH.lv),{tries:0});
    const text={roof:"A storm tore holes in my roof! Could you fix it with 🪵 planks? Come to my cottage — you'll have to work out how many planks it takes.",
      patch:"Something smashed holes in my cottage wall. Could you patch them with 🔩 iron plates? Work out how many at my cottage.",
      fence:v.home.fenced?"The wind knocked my garden fence flat! Could you rebuild it with 🪵 posts? Work out how many at my garden.":"The sheep keep eating my cabbages. Could you build a fence around my garden with 🪵 posts? Work out how many at my garden."}[job];
    q={k:"work",job,w,pay:12+2*MATH.lv+ri(0,6),text};cottageState(v.home,job,"broken");}
  else{r=(r-.42)/.58;
  if(r<.25){const n=ri(3,6);q={k:"bring",m:"lignum",n,pay:n*3,text:`My roof leaks. Could you bring me ${n} 🪵 Lignum? (Chop trees.)`};}
  else if(r<.45){const n=ri(2,4);q={k:"bring",m:"ferrum",n,pay:n*4+2,text:`I'm mending my tools. Bring me ${n} 🔩 Ferrum? (Mine the grey rocks.)`};}
  else if(r<.6){const c=pick(CRAFT.CORES);q={k:"bring",m:c,n:1,pay:16,text:`I collect crystals. Could you find me one ${MAT[c].icon} ${MAT[c].name}? (It grows out in the wilds.)`};}
  else if(r<.78){const n=ri(2,3);q={k:"dummies",n,pay:n*4,text:`Show me you can fight: knock down ${n} training dummies.`,base:QUESTS.dummies};}
  else{const e=pick(MONSTER_NAMES()),n=ri(1,3);q={k:"beat",e,n,pay:n*14,text:`The ${ENEMY_TYPES[e].name}s keep stealing our sheep. Beat ${n} of them out in the wilds.`,base:QUESTS.kills[e]||0};}}
  q.accepted=false;v.q=q;return q;}
function questProgress(q){if(q.k==="work")return q.fixed?1:0;if(q.k==="bring")return Math.min(q.n,countMat(q.m));if(q.k==="dummies")return Math.min(q.n,QUESTS.dummies-q.base);return Math.min(q.n,(QUESTS.kills[q.e]||0)-q.base);}
const qGoal=q=>q.k==="work"?1:q.n;
function questDone(q){return q.accepted&&questProgress(q)>=qGoal(q);}
const qShort=q=>q.k==="work"?(q.fixed?"🔨 done":"🔨 "+JOBDO[q.job]):`${q.k==="bring"?`${MAT[q.m].icon} ${MAT[q.m].name}`:q.k==="dummies"?"dummies":ENEMY_TYPES[q.e].name+"s"} ${questProgress(q)}/${q.n}`;
function questKill(d){if(d.enemy)QUESTS.kills[d.enemy]=(QUESTS.kills[d.enemy]||0)+1;else QUESTS.dummies++;}
let QV=null;
VILLAGERS.forEach(v=>ACTS.push({pos:v.pos,r:3,label:()=>!v.q||!v.q.accepted?`❗ Talk to ${v.name}`:questDone(v.q)?`✅ Hand in to ${v.name}`:`💬 ${v.name}: ${qShort(v.q)}`,run:()=>{QV=v;toggleBag(true,"quest");}}));
function questTurnIn(v){const q=v.q;if(!questDone(q))return false;if(q.k==="bring")takeMat(q.m,q.n);COINS+=q.pay;coinHud();
  const o=v.o;if(o.rig)o.rig.full("Cheer",{once:true,restart:true,dur:1.2,then:()=>o.rig.clearFull()});FX.stars(v.pos.clone().add(new THREE.Vector3(0,2,0)),"gold",4,1.2);newQuest(v);return q.pay;}
function stepVillagers(){VILLAGERS.forEach(v=>{if(!v.q)newQuest(v);const key=!v.q.accepted?"❗":questDone(v.q)?"✅":"💬";if(key===v.markKey)return;v.markKey=key;if(v.mark)scene.remove(v.mark);
  v.mark=iconSprite(key);v.mark.scale.setScalar(.7);v.mark.position.set(0,2.95,0);v.o.g.add(v.mark);});
  if(VILLAGERS[0].mark)VILLAGERS.forEach(v=>{if(v.mark)v.mark.position.y=2.95+Math.sin(tAcc*3)*.08;});
  const act=VILLAGERS.filter(v=>v.q.accepted);$("#quests").innerHTML=act.map(v=>`<div>${questDone(v.q)?"✅":"📜"} ${v.name}: ${esc(qShort(v.q))}</div>`).join("")+(typeof jobLine==="function"?jobLine():"");
  VILLAGERS.forEach(v=>{const q=workQ(v),c=v.home;c.mark.visible=!!q;if(q){const at=q.job==="fence"?c.garden:c.pos;c.mark.position.set(at.x,(q.job==="fence"?2:CH+CR+1.4)+Math.sin(tAcc*3)*.08,at.z);}});}
// --- the training center (Palaestra): a site you build; once it stands, the dummies inside shoot at you — but only while you are inside it
const TRAIN={built:false,x0:-11,x1:11,z0:-25,z1:-6,coins:25,site:[],plan:null,dummies:[]};
// the builder's plan never says how much wood and iron: it's written as math problems at your level
function trainPlan(){if(!TRAIN.plan){const L=ri(6,10),F=ri(4,7);TRAIN.plan={solved:false,tries:0,cost:{lignum:L,ferrum:F},parts:[{m:"lignum",...CRAFT.amount(L,MATH.lv)},{m:"ferrum",...CRAFT.amount(F,MATH.lv)}]};}return TRAIN.plan;}
const inTraining=p=>TRAIN.built&&p.x>TRAIN.x0&&p.x<TRAIN.x1&&p.z>TRAIN.z0&&p.z<TRAIN.z1;
{const rope=new THREE.LineBasicMaterial({color:0xd8b06a});const pts=[[TRAIN.x0,TRAIN.z1],[TRAIN.x0,TRAIN.z0+1],[TRAIN.x1,TRAIN.z0+1],[TRAIN.x1,TRAIN.z1],[2,TRAIN.z1]];
  pts.forEach(([x,z])=>{const s=LOOK.M(new THREE.CylinderGeometry(.06,.08,1.2,6),LOOK.toon(0x8a5a32),.01);s.position.set(x,.6,z);scene.add(s);TRAIN.site.push(s);});
  const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints([[-2,TRAIN.z1],...pts].map(([x,z])=>new THREE.Vector3(x,1,z))),rope);scene.add(l);TRAIN.site.push(l);
  const sg=label("🔨 Palaestra — training center: build it here",0xffd27a);sg.scale.set(4.6,.86,1);sg.position.set(0,2.4,TRAIN.z1+.6);scene.add(sg);TRAIN.sign=sg;}
function buildTraining(free){if(TRAIN.built)return "done";if(!free){const pl=trainPlan();if(!pl.solved)return "plan";for(const k in pl.cost)if(countMat(k)<pl.cost[k])return "mats";if(COINS<TRAIN.coins)return "coins";
  for(const k in pl.cost)takeMat(k,pl.cost[k]);COINS-=TRAIN.coins;coinHud();setKey("train",1);}TRAIN.built=true;TRAIN.site.forEach(o=>scene.remove(o));scene.remove(TRAIN.sign);
  const H=1.6,tone=0xc8b48a,walls=[[TRAIN.x0,(TRAIN.z0+TRAIN.z1)/2,.8,TRAIN.z1-TRAIN.z0],[TRAIN.x1,(TRAIN.z0+TRAIN.z1)/2,.8,TRAIN.z1-TRAIN.z0],[(TRAIN.x0-2)/2,TRAIN.z1,-2-TRAIN.x0,.8],[(TRAIN.x1+2)/2,TRAIN.z1,TRAIN.x1-2,.8]];
  walls.forEach(([x,z,w,d],i)=>{const m=block(x,z,w,H,d,tone);m.scale.y=.02;m.position.y=.02;tween(.6+i*.1,t=>{const k=Math.max(.02,t);m.scale.y=k;m.position.y=H*k/2;});
    for(let k=0;k<10;k++)PUFF.emit(new THREE.Vector3(x+rnd(-w/2,w/2),.2,z+rnd(-d/2,d/2)),new THREE.Vector3(rnd(-1,1),rnd(1,2.5),rnd(-1,1)),C(0xb8a07a).multiplyScalar(.5),.8,{drag:2});});
  [[-2.4,TRAIN.z1],[2.4,TRAIN.z1]].forEach(([x,z])=>{const p=LOOK.M(new THREE.CylinderGeometry(.18,.22,3.2,10),LOOK.toon(0xeee2c8),.015);p.position.set(x,1.6,z);scene.add(p);
    const f=new THREE.Mesh(new THREE.PlaneGeometry(.9,1.4),new THREE.MeshLambertMaterial({color:0x2f6fb5,side:THREE.DoubleSide}));f.position.set(x,2.4,z-.25);scene.add(f);});
  const sg=label("🏛️ Palaestra — the dummies fight back in here",0x9fd6ff);sg.scale.set(4.8,.9,1);sg.position.set(0,3.8,TRAIN.z1);scene.add(sg);
  TRAIN.dummies.forEach((d,i)=>{d.unbuilt=false;d.hp=d.max;d.g.visible=true;d.g.scale.setScalar(.01);tween(.5+i*.12,t=>d.g.scale.setScalar(Math.max(.01,t)),()=>{d.down=false;});});
  FX.stars(new THREE.Vector3(0,2,TRAIN.z1),"gold",6,2);shake(.15);return "ok";}
ACTS.push({pos:new THREE.Vector3(0,0,TRAIN.z1+1),r:3.2,label:"🔨 Build the training center",hidden:()=>TRAIN.built,run:()=>toggleBag(true,"build")});
// --- the contest board: "Try Your Hardest Math Problem!" — story problems for grades 5–8 (solve it AND explain it in writing), plus AMC 8 and MATHCOUNTS-style puzzles
const CONTEST={tier:null,q:null,draft:"",ans:"",msg:"",ok:false,solved:0,pos:new THREE.Vector3(8,0,3)};
{const g=new THREE.Group();g.position.copy(CONTEST.pos);g.rotation.y=Math.atan2(-8,-3);scene.add(g);const st=LOOK.toon(0xe6dccb),wd=LOOK.toon(0x8a5a32);
  const slab=LOOK.M(new THREE.BoxGeometry(2.2,1.5,.18),st,.02);slab.position.y=1.45;g.add(slab);
  [-0.9,0.9].forEach(x=>{const l=LOOK.M(new THREE.BoxGeometry(.16,.8,.16),wd,.01);l.position.set(x,.4,0);g.add(l);});
  const face=new THREE.Mesh(new THREE.PlaneGeometry(1.9,1.2),new THREE.MeshBasicMaterial({color:0x2a3b52}));face.position.set(0,1.45,.1);g.add(face);
  const ic=iconSprite("🏆");ic.scale.setScalar(.8);ic.position.set(0,1.5,.2);g.add(ic);
  const sg=label("🏆 Try Your Hardest!",0xffd27a);sg.scale.set(3.6,.68,1);sg.position.set(0,2.75,0);g.add(sg);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});const m=block(CONTEST.pos.x,CONTEST.pos.z,1.4,2,1.4,0x8a5a32);m.material.visible=false;m.castShadow=false;}
function contestNew(tier){CONTEST.tier=tier||CONTEST.tier||CRAFT.tierFor(MATH.lv);CONTEST.q={...CRAFT.contest(CONTEST.tier),tries:0,done:false};CONTEST.draft="";CONTEST.ans="";CONTEST.msg="";CONTEST.ok=false;}
// answer + writing: the explanation must be there (8+ words), like the real contest where the writing counts too
function contestAnswer(ans,why){const q=CONTEST.q;if(!q||q.done)return {ok:false,msg:""};
  if(String(why||"").trim().split(/\s+/).filter(w=>/\w/.test(w)).length<8)return {ok:false,msg:"✍️ First explain how you solved it — at least one or two full sentences (8 words or more). In the contest, your writing counts as much as the answer!"};
  if(ans===null||isNaN(ans))return {ok:false,msg:"Type your answer as a number."};
  if(ans===q.a){q.done=true;q.won=true;const T=CRAFT.TIERS[CONTEST.tier];COINS+=T.pay;coinHud();CONTEST.solved++;let extra="";
    if(CONTEST.tier==="mathcounts"){const id=pick(DROP_SPELLS);if(addItem({t:"spell",id,uses:SPELLS[id].uses}))extra=` and a ${SPELLS[id].icon} ${SPELLS[id].name} scroll`;}
    FX.stars(P.pos.clone().add(new THREE.Vector3(0,1.6,0)),"gold",7,1.6);return {ok:true,msg:`🏆 Correct${q.tries===0?" on the first try":""}! You earned ${T.pay} 🪙${extra}. ${q.why}`};}
  q.tries++;if(q.tries>=3){q.done=true;return {ok:false,msg:`Not this time — the answer is ${q.a}. ${q.why} Try another one: every hard problem you meet makes the next one easier.`};}
  return {ok:false,msg:`Not quite — ${3-q.tries} ${3-q.tries===1?"try":"tries"} left. Hint: ${q.hint}`};}
ACTS.push({pos:CONTEST.pos,r:3,label:"🏆 Try Your Hardest Math Problem!",run:()=>{if(!CONTEST.q)contestNew();toggleBag(true,"contest");}});
// --- a fountain in the square, and guards at the gates
{const g=new THREE.Group();g.position.set(-12,0,2);scene.add(g);const st=LOOK.toon(0xe6dccb);
  const basin=LOOK.M(new THREE.CylinderGeometry(2.2,2.4,.6,24),st,.02);basin.position.y=.3;g.add(basin);
  const water=new THREE.Mesh(new THREE.CircleGeometry(2,24),new THREE.MeshBasicMaterial({color:0x6fc8f0,transparent:true,opacity:.85}));water.rotation.x=-Math.PI/2;water.position.y=.55;g.add(water);
  const col=LOOK.M(new THREE.CylinderGeometry(.25,.35,1.8,12),st,.015);col.position.y=1.2;g.add(col);const bowl=LOOK.M(new THREE.CylinderGeometry(.8,.4,.35,16),st,.015);bowl.position.y=2.1;g.add(bowl);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});const m=block(-12,2,4.2,.6,4.2,0xe6dccb);m.material.visible=false;m.castShadow=false;TOWN.fountain=new THREE.Vector3(-12,2.3,2);}
// ---------------- the law in Oppidum: hurt a townsperson and a guard warns you; knock someone out (or hit a guard) and every guard swarms you.
// Guards are very strong and very fast, and they can't really be beaten. When they catch you, you go to the jail (Carcer) until your time is up.
const PEOPLE=[];
function personize(o,name,guard){const hb=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,1.9,8),new THREE.MeshBasicMaterial({visible:false}));hb.position.y=.95;o.g.add(hb);
  const pp={o,name,guard:!!guard,hp:guard?3000:100,max:guard?3000:100,down:false,hb,home:o.g.position.clone(),face:o.g.rotation.y,cool:0};hb.userData.person=pp;PEOPLE.push(pp);return pp;}
const GUARDS=[[-5.5,TOWN.z1-2.5,Math.PI],[5.5,TOWN.z1-2.5,Math.PI],[TOWN.x1-2.5,-12.5,-Math.PI/2],[TOWN.x0+2.5,2.5,Math.PI/2],[-2.5,TOWN.z0+2.5,0],[2.5,TOWN.z0+2.5,0]].map(([x,z,f])=>{
  const o=npc("guard.glb",x,z,f);const t=setInterval(()=>{if(!o.rig)return;clearInterval(t);o.rig.root.traverse(m=>{if(m.name==="1H_Sword"||m.name==="Round_Shield")m.visible=true;});},300);return personize(o,"Guard",true);});
VILLAGERS.forEach(v=>personize(v.o,v.name));TOWNFOLK.filter(o=>!PEOPLE.some(pp=>pp.o===o)).forEach(o=>{COOK.pp=personize(o,"Polina");});MERCHANT.pp=personize(MERCHANT.o,"Mercator");
{const l=label("Polina",0xffffff);l.scale.set(1.4,.28,1);l.position.set(COOK.pos.x,2.35,COOK.pos.z);scene.add(l);}
const JAIL={x:14.5,z:-29,w:6,d:5,cell:new THREE.Vector3(14.5,0,-29.5),out:new THREE.Vector3(14.5,0,-24)};
{const t=0x9a9488,H=3;block(JAIL.x,JAIL.z-JAIL.d/2,JAIL.w,H,.4,t);block(JAIL.x-JAIL.w/2,JAIL.z,.4,H,JAIL.d,t);block(JAIL.x+JAIL.w/2,JAIL.z,.4,H,JAIL.d,t);
  const front=block(JAIL.x,JAIL.z+JAIL.d/2,JAIL.w,H,.25,t);front.material.visible=false;front.castShadow=false;   // the barred front: bars you can see through
  const iron=LOOK.toon(0x3a3d44);for(let i=0;i<=12;i++){const b=LOOK.M(new THREE.CylinderGeometry(.05,.05,H,6),iron,.006);b.position.set(JAIL.x-JAIL.w/2+.25+i*(JAIL.w-.5)/12,H/2,JAIL.z+JAIL.d/2);scene.add(b);}
  const roof=LOOK.M(new THREE.BoxGeometry(JAIL.w+.6,.3,JAIL.d+.6),LOOK.toon(0x6b6458),.01);roof.position.set(JAIL.x,H+.15,JAIL.z);scene.add(roof);
  const sg=label("🔒 Carcer — the town jail",0xcfd6e0);sg.scale.set(3.8,.72,1);sg.position.set(JAIL.x,H+1.1,JAIL.z+JAIL.d/2);scene.add(sg);}
const LAW={warned:0,wanted:false,jailT:0,times:0,why:""};
function lawSay(t){const b=$("#law");b.textContent=t;b.classList.remove("hidden");clearTimeout(lawSay.t);lawSay.t=setTimeout(()=>{if(!LAW.wanted&&LAW.jailT<=0)b.classList.add("hidden");},4000);}
function hurtPerson(pp,n,at){if(pp.down||LAW.jailT>0)return;pp.hp-=n;popNum(at,pp.guard?`-${n}`:`-${n}`,"burn");
  if(pp.o.rig&&pp.guard&&pp.o.rig.clips.Hit_A&&!LAW.wanted)pp.o.rig.full("Hit_A",{once:true,restart:true,dur:.5,then:()=>pp.o.rig.clearFull()});
  if(pp.guard){if(pp.hp<=0){pp.hp=pp.max;}if(!LAW.wanted)crime(`You attacked a guard!`);return;}
  if(pp.hp<=0){knockOut(pp);share({k:"ko",name:pp.name});crime(`You knocked out ${pp.name}!`);return;}
  if(!LAW.wanted){LAW.warned++;lawSay(LAW.warned>=3?"🛡️ Guard: That's it!":`🛡️ Guard: Hey! Leave ${pp.name} alone! (${LAW.warned}/3)`);if(LAW.warned>=3)crime(`You kept hurting ${pp.name}!`);}}
function knockOut(pp){pp.down=true;pp.o.g.rotation.x=0;tween(.5,t=>{pp.o.g.rotation.z=t*Math.PI/2*.95;});setTimeout(()=>{pp.hp=pp.max;pp.down=false;tween(.6,t=>{pp.o.g.rotation.z=(1-t)*Math.PI/2*.95;});},60000);}
function crime(why){setKey("law:"+MP.id,1);LAW.wanted=true;LAW.why=why;lawSay(`🚨 ${why} The guards are coming for you!`);}
function jail(){if(P.inCar)exitCar();P.fallTop=undefined;setKey("law:"+MP.id,null);LAW.times++;LAW.wanted=false;LAW.warned=0;LAW.jailT=30+15*Math.min(4,LAW.times-1);P.pos.copy(JAIL.cell);P.vel.set(0,0,0);P.hp=Math.max(P.hp,30);hud();toggleBag(false);
  PEOPLE.forEach(pp=>{if(pp.guard){pp.hp=pp.max;pp.o.g.position.copy(pp.home);pp.o.g.rotation.set(0,pp.face,0);if(pp.o.rig){pp.o.rig.clearFull();pp.o.rig.base("Idle");}}});shake(.2);}
function stepLaw(dt){const b=$("#law");
  if(LAW.jailT>0){LAW.jailT-=dt;b.classList.remove("hidden");b.textContent=`🔒 Jail! ${LAW.why} Free in ${Math.ceil(LAW.jailT)} s`;
    P.pos.x=clamp(P.pos.x,JAIL.x-JAIL.w/2+.6,JAIL.x+JAIL.w/2-.6);P.pos.z=clamp(P.pos.z,JAIL.z-JAIL.d/2+.6,JAIL.z+JAIL.d/2-.6);
    if(LAW.jailT<=0){P.pos.copy(JAIL.out);b.classList.add("hidden");lawSay("🔓 You're free. Be kind to the people of Oppidum!");}return;}
  for(const pp of PEOPLE){if(!pp.guard)continue;const g=pp.o.g,r=pp.o.rig;pp.cool-=dt;
    let chase=LAW.wanted&&!P.down?P.pos:null;if(!chase)for(const id of WORLD.wanted){const a=MP.others[id];if(a){chase=a.g.position;break;}}const to=chase||pp.home;const v=to.clone().sub(g.position);v.y=0;const d=v.length();
    if(chase&&!LAW.wanted&&d<1.5){g.rotation.y=Math.atan2(v.x,v.z);if(r)r.base("Idle");}
    else if(LAW.wanted&&d<1.5){g.rotation.y=Math.atan2(v.x,v.z);if(r)r.base("Idle");if(pp.cool<=0){pp.cool=.9;if(r)r.full("1H_Melee_Attack_Chop",{once:true,restart:true,dur:.6,then:()=>r.clearFull()});
        setTimeout(()=>{if(!LAW.wanted)return;hurt(30);popNum(P.pos.clone().add(new THREE.Vector3(0,2.4,0)),"Guard!","burn");if(P.hp<=40||P.down){P.down=false;$("#down").classList.add("hidden");jail();lawSay("🚔 The guards caught you — off to jail!");}},300);}}
    else if(d>.3){const sp=chase?9.5:3;g.position.addScaledVector(v.normalize(),Math.min(d,sp*dt));g.rotation.y=Math.atan2(v.x,v.z);if(r)r.base(LAW.wanted?"Running_A":"Running_A",{speed:LAW.wanted?1.2:.6});}
    else{g.rotation.y=pp.face;if(r)r.base("Idle");}}}
// ---------------- Nova Urbs: the new city east of Oppidum (Barbara 2026-11-21: "better houses and more neighbors, like Chicago") ----------------
// Straight streets in a grid, brick buildings 2–4 floors high with water tanks on the roofs, shops, restaurants, a plaza, a park, the school
// and the library. Neighbors walk the streets: they shop, eat at the restaurants and stop to gossip. Hurt them or wreck their houses
// and the guards come for you — the same law as in Oppidum.
// city walls: north, south and east (the west side is Oppidum's east wall, its gate now leads into the city); a gate east to the wilds
{const H=6,T=1.6,TW=3,TH=8,tone=0x9e968a,gz=CITY.gz,g=TOWN.gate;
  [CITY.z0,CITY.z1].forEach(z=>block((CITY.x0+CITY.x1)/2+.8,z,CITY.x1-CITY.x0-1.6,H,T,tone));
  const a=gz-g-TW,b=gz+g+TW;block(CITY.x1,(CITY.z0+a)/2,T,H,a-CITY.z0,tone);block(CITY.x1,(b+CITY.z1)/2,T,H,CITY.z1-b,tone);
  block(CITY.x1,gz-g-TW/2,TW,TH,TW,0x8f877c);block(CITY.x1,gz+g+TW/2,TW,TH,TW,0x8f877c);
  [[CITY.x1,CITY.z0],[CITY.x1,CITY.z1]].forEach(([x,z])=>block(x,z,TW,TH,TW,0x8f877c));
  const arch=LOOK.blockMesh(TW,1.2,g*2+TW*2,0x8f877c);arch.position.set(CITY.x1,TH-.6,gz);arch.castShadow=true;scene.add(arch);
  [[1,"The wilds — monsters ahead",0xffb08a],[-1,"Nova Urbs — safe inside these walls",0x9dd8ff]].forEach(([k,t,hex])=>{const s=label(t,hex);s.scale.set(5.2,.95,1);s.position.set(CITY.x1+k*1.8,TH+.9,gz);scene.add(s);});}
// the old cypresses and bushes that stood where the city is now
scene.children.filter(o=>!o.userData.block&&o.position.x>CITY.x0+1&&o.position.x<CITY.x1+3&&o.position.z>CITY.z0-3&&o.position.z<CITY.z1+3&&(o.isGroup||o.geometry&&o.geometry.type==="SphereGeometry")).forEach(o=>scene.remove(o));
// streets: stone paving down the middle, lighter pavements along the houses
{const ld=new THREE.TextureLoader(),pave=(rx,ry)=>{const t=ld.load("/play/elementum/art/stone.webp");t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);if("colorSpace" in t)t.colorSpace=THREE.SRGBColorSpace;return t;};
  const road=(x,z,w,d,y,c)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshLambertMaterial({map:pave(w/3,d/3),color:c}));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;scene.add(m);};
  const zl=CITY.z1-CITY.z0-2,xl=CITY.x1-CITY.x0-2;
  CITY.XS.forEach(x=>{road(x,(CITY.z0+CITY.z1)/2,9,zl,.016,0xcfc6b6);road(x,(CITY.z0+CITY.z1)/2,5,zl,.018,0x8d8a86);});
  CITY.ZS.forEach(z=>{road((CITY.x0+CITY.x1)/2,z,xl,9,.017,0xcfc6b6);road((CITY.x0+CITY.x1)/2,z,xl,5,.019,0x8d8a86);});
  road(61,6,14,14,.02,0xd8cfbe);}   // the plaza
// brick fronts: one bay = 3 m wide, one floor = 3.3 m high, a window in each (drawn once per colour, then repeated)
const FACADE={};
function facadeTex(brick,trim){const key=brick+"/"+trim;if(FACADE[key])return FACADE[key];const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");
  const B=new THREE.Color(brick);x.fillStyle="#"+B.getHexString();x.fillRect(0,0,128,128);
  for(let r=0;r<16;r++)for(let k=0;k<6;k++){const s=.85+Math.random()*.3;x.fillStyle="#"+B.clone().multiplyScalar(s).getHexString();x.fillRect(k*24-(r%2)*12+1,r*8+1,22,6);}   // bricks with mortar between
  x.fillStyle="#"+new THREE.Color(trim).getHexString();x.fillRect(30,14,68,8);x.fillRect(28,98,72,7);   // stone lintel and sill
  x.fillStyle="#f4efe4";x.fillRect(36,22,56,76);const gl=x.createLinearGradient(40,26,88,94);gl.addColorStop(0,"#2c4660");gl.addColorStop(.55,"#4f7392");gl.addColorStop(1,"#22384c");
  x.fillStyle=gl;x.fillRect(40,26,22,70);x.fillRect(66,26,22,70);x.fillStyle="rgba(255,255,255,.18)";x.fillRect(42,28,6,40);x.fillRect(68,28,6,40);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if("colorSpace" in t)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return FACADE[key]=t;}
// a painted wooden sign board with the shop's name, as wide as the words need
function signBoard(text,hex){const c=document.createElement("canvas"),x=c.getContext("2d");x.font="700 64px Georgia,serif";const W=Math.ceil(x.measureText(text).width+90);c.width=W;c.height=110;
  x.font="700 64px Georgia,serif";x.fillStyle="#3a2618";x.fillRect(0,0,W,110);x.strokeStyle="#c9a24a";x.lineWidth=8;x.strokeRect(6,6,W-12,98);
  x.fillStyle="#"+new THREE.Color(hex||0xffe08a).lerp(new THREE.Color(0xffffff),.35).getHexString();x.textAlign="center";x.textBaseline="middle";x.fillText(text,W/2,58);
  const t=new THREE.CanvasTexture(c);if("colorSpace" in t)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;const h=.62;
  return new THREE.Mesh(new THREE.PlaneGeometry(h*W/110,h),new THREE.MeshLambertMaterial({map:t}));}
const WINDOW_GLOW=(()=>{const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");x.fillStyle="#000";x.fillRect(0,0,128,128);x.fillStyle="#fff";x.fillRect(40,26,22,70);x.fillRect(66,26,22,70);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;})();const NIGHT_MATS=[];
const BRICKS=[[0x9a4a32,0xe8dcc4],[0xb2603e,0xf0e6d0],[0x7a3b2c,0xd8ccb4],[0xc9a37a,0xffffff],[0x8c5a3c,0xe6d6b8],[0xa8a49a,0xf6f0e2],[0x6f4a3a,0xe0d2b6]];
const BUILDINGS=[],INTERIORS=[];
// one building: a solid block you bump into (shots dent it, enough damage brings it down), dressed with a brick front, cornice, door and stoop
// one solid brick block (with windows), at any height: you bump into it, shots dent it
function fblock(x,y,z,w,h,d,brick,trim){const m=block(x,z,w,h,d,0x999999);const b=BLOCKS[BLOCKS.length-1];m.position.y=y+h/2;b.y=y;
  const geo=new THREE.BoxGeometry(w,h,d),uv=geo.attributes.uv,dims=[[d,h],[d,h],[0,0],[0,0],[w,h],[w,h]];
  for(let f=0;f<6;f++)for(let k=0;k<4;k++){const i=f*4+k;uv.setXY(i,dims[f][0]?uv.getX(i)*Math.max(1,Math.round(dims[f][0]/3)):.02,dims[f][1]?uv.getY(i)*Math.max(1,Math.round(dims[f][1]/3.3)):.02);}
  m.geometry.dispose();m.geometry=geo;m.material=new THREE.MeshLambertMaterial({map:facadeTex(brick,trim),emissive:0xffd890,emissiveMap:WINDOW_GLOW,emissiveIntensity:0});NIGHT_MATS.push(m.material);return {m,b};}
// walk-in buildings (2026-11-22, "you can go inside"): the ground floor is a room — walls with a doorway and a wooden floor;
// the floors above sit on top as one block (you walk under it). Shops, the library, the school, the apartment house.
const GF=3.2,WT=.3;
function building(x,z,w,d,floors,face,o){o=o||{};const h=floors*3.3,[brick,trim]=o.colors||pick(BRICKS);const blks=[],parts=[];
  if(!o.enter){const f=fblock(x,0,z,w,h,d,brick,trim);blks.push(f.b);parts.push(f.m);}
  else{const fz=z+face*d/2,dx=x+(o.doorX||0),DW=1.8;const wall=(cx,cz,ww,dd,y,hh)=>{const f=fblock(cx,y||0,cz,ww,hh||GF,dd,brick,trim);blks.push(f.b);parts.push(f.m);};
    wall(x,z-face*(d/2-WT/2),w,WT);wall(x-w/2+WT/2,z,WT,d);wall(x+w/2-WT/2,z,WT,d);
    const lw=(dx-DW/2)-(x-w/2),rw=(x+w/2)-(dx+DW/2);if(lw>.05)wall(x-w/2+lw/2,fz-face*WT/2,lw,WT);if(rw>.05)wall(x+w/2-rw/2,fz-face*WT/2,rw,WT);wall(dx,fz-face*WT/2,DW,WT,2.5,GF-2.5);
    if(o.homeFloor){const yH=o.homeFloor*3.3;wall(x,z,w,d,GF,yH-GF);const fzH=z+face*(d/2-WT/2),BW=1.4;wall(x,z-face*(d/2-WT/2),w,WT,yH,GF);
      wall(x-w/4-BW/4,fzH,w/2-BW/2,WT,yH,GF);wall(x+w/4+BW/4,fzH,w/2-BW/2,WT,yH,GF);wall(x,fzH,BW,WT,yH+2.4,GF-2.4);   // a balcony door in the middle
      wall(x-w/2+WT/2,z,WT,d-WT*2,yH,GF);wall(x+w/2-WT/2,z,WT,d-WT*2,yH,GF);wall(x,z,w,d,yH+GF,h-yH-GF);   // the side walls and everything above (2026-11-26: they had slipped into the comment above, so the roof floated)
      INTERIORS.push({x0:x-w/2+WT,x1:x+w/2-WT,z0:z-d/2+WT,z1:z+d/2-WT,y0:yH,y1:yH+GF,c:new THREE.Vector3(x,yH+2.4,z),name:"home"});}
    else if(h>GF+.1&&!o.upstairs)wall(x,z,w,d,GF,h-GF);
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(w-WT*2,d-WT*2),new THREE.MeshLambertMaterial({color:o.floor||0x9a7a55}));fl.rotation.x=-Math.PI/2;fl.position.set(x,.025,z);fl.receiveShadow=true;scene.add(fl);parts.push(fl);
    INTERIORS.push({x0:x-w/2+WT,x1:x+w/2-WT,z0:z-d/2+WT,z1:z+d/2-WT,y0:0,y1:GF,c:new THREE.Vector3(x,2.4,z),name:o.name||""});}
  const m=parts[0],b=blks[0];
  const bd={x,z,w,d,h,face,blk:b,blks,parts:parts.slice(),name:o.name||"",owner:o.owner||pick(CITIZEN_NAMES),dmg:0,down:false,id:BUILDINGS.length,enter:!!o.enter};blks.forEach(k=>k.city=bd);
  const add=(mesh,px,py,pz)=>{mesh.position.set(px,py,pz);mesh.castShadow=true;scene.add(mesh);bd.parts.push(mesh);return mesh;};
  const T=LOOK.toon(trim),fz=z+face*d/2;
  add(LOOK.M(new THREE.BoxGeometry(w+.5,.45,d+.5),T,.02),x,h+.2,z);   // the cornice
  add(LOOK.M(new THREE.BoxGeometry(w+.2,.25,d+.2),T,.0),x,3.3,z);     // a band over the ground floor
  if(!o.noDoor&&!o.enter){add(LOOK.M(new THREE.BoxGeometry(1.2,2.3,.12),LOOK.toon(o.door||pick([0x3b5a3a,0x5a2e22,0x2e3e5a,0x1f1f24])),.01),x+(o.doorX||0),1.15,fz+face*.06);
    for(let s=0;s<3;s++)add(new THREE.Mesh(new THREE.BoxGeometry(1.8,.16,.4),LOOK.toon(0xb8b0a0)),x+(o.doorX||0),.08+s*.16,fz+face*(.2+(2-s)*.38));}
  if(o.tank){const g=new THREE.Group();g.position.set(x+rnd(-w/4,w/4),h+.4,z+rnd(-d/4,d/4));const wood=LOOK.toon(0x7a5232);
    [[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7]].forEach(([a,c])=>{const l=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1.6,5),wood);l.position.set(a,.8,c);g.add(l);});
    const tk=LOOK.M(new THREE.CylinderGeometry(1,1,1.8,14),wood,.02);tk.position.y=2.4;g.add(tk);const cap=LOOK.M(new THREE.ConeGeometry(1.15,.8,14),LOOK.toon(0x4a3a2c),.02);cap.position.y=3.7;g.add(cap);
    g.traverse(k=>{if(k.isMesh)k.castShadow=true;});scene.add(g);bd.parts.push(g);}
  if(o.awning){const aw=add(LOOK.M(new THREE.BoxGeometry(Math.min(w-.4,4.4),.12,1.6),LOOK.toon(o.awning),.015),x,2.9,fz+face*.8);aw.rotation.x=-face*.3;}
  if(o.name){const s=signBoard(o.name,o.signHex);const sw=s.geometry.parameters.width;if(sw>w-.4)s.scale.setScalar((w-.4)/sw);s.rotation.y=face>0?0:Math.PI;add(s,x,o.signY||4.05,fz+face*(o.signOut||.05));}
  bd.parts.forEach(p=>p.userData.y0=p.position.y);BUILDINGS.push(bd);return bd;}
const CITIZEN_NAMES=["Aurelia","Brutus","Cassia","Decimus","Elena","Flavia","Gaius","Hortensia","Iulia","Kaeso","Lucia","Maximus","Nonna","Otho","Paulina","Quintus","Rufus","Sabina","Titus","Valeria","Junia","Lucius","Mila","Nico"];
// what's where: shops and restaurants have names; the rest are homes (each with an owner, for the guards' warnings)
RNG=seedRnd(15);
const SPOTS={shop:[],eat:[],gossip:[],stroll:[]},LAMPS=[];
const BLOCK_X=[[54,68],[76,90],[98,112],[120,132]],BLOCK_Z=[[-33,-9],[-1,13],[21,39]];
const SPECIAL={"1,1,-1":{name:"Taberna — deep-dish pizza",awning:0xc8432f,eat:true,floors:3},"2,0,1":{name:"Thermopolium — hot food",awning:0xd8a03a,eat:true,floors:2},
  "0,2,-1":{name:"Pistrinum — bakery",awning:0x3f7f5a,eat:true,shop:true,floors:3},"2,1,-1":{name:"Macellum — grocer",awning:0x3f6fa8,shop:true,floors:2},
  "2,1,1":{name:"Hospitium — hotel",awning:0x7a2a4a,floors:4,hotel:true},"0,0,1":{name:"Taberna Tua — your shop",awning:0x6a6a70,floors:2,biz:true},"3,2,-1":{name:"Insula Alta — apartments",awning:0x2f5f8a,floors:6,apt:true},"3,0,1":{name:"Tonsor — barber",awning:0xb5392b,shop:true,floors:3},"1,0,1":{name:"Sutor — shoes",awning:0x8a4fb0,shop:true,floors:4}};
// ---------------- inside the buildings (2026-11-22): shops with a counter, shelves of goods and a shopkeeper; the library with
// labeled shelves and a computer; the school with desks and a blackboard. One warm lamp follows you into whichever room you're in.
const ROOM_LIGHT=new THREE.PointLight(0xffe2b0,0,14,1.4);scene.add(ROOM_LIGHT);
const inRoom=p=>INTERIORS.find(r=>(!r.lot||r.lot.built)&&p.x>r.x0&&p.x<r.x1&&p.z>r.z0&&p.z<r.z1&&p.y>=r.y0-.2&&p.y<r.y1);
// what each shop sells: food from FOODS, plus the barber's haircut and the shoemaker's running sandals
const SHOPS={Pistrinum:{keeper:"Faustina",items:["panis","mel","puls"]},Macellum:{keeper:"Gnaeus",items:["pomum","uvae","caseus","piscis"]},Taberna:{keeper:"Petronia",items:["panis","caseus","piscis"]},
  Thermopolium:{keeper:"Servius",items:["puls","piscis","mel"]},Tonsor:{keeper:"Tullius",items:["haircut"]},Sutor:{keeper:"Crispina",items:["sandals"]}};
const EXTRA={haircut:{name:"A new haircut",price:5,what:"A fresh look — a new hair color for your hero",pic:"hand_fist"},sandals:{name:"Running sandals",price:15,what:"Fast feet for two minutes",pic:"food_mel"}};
let CUR_SHOP=null;
function shopInside(bd,sp){const key=sp.name.split(" ")[0],S_=SHOPS[key];if(!S_)return;const f=bd.face,zb=bd.z-f*bd.d/2,zc=zb+f*1.7,wood=LOOK.toon(0x7a4a28);
  const counter=block(bd.x,zc,Math.min(bd.w-1.6,4.4),1.05,.7,0x7a4a28);counter.material=LOOK.toon(0x8a5a32);
  const shelf=LOOK.M(new THREE.BoxGeometry(bd.w-1.2,1.9,.45),wood,.02);shelf.position.set(bd.x,1.25,zb+f*.55);scene.add(shelf);bd.parts.push(shelf);
  S_.items.forEach((id,i)=>{const pic=id in FOODS?"food_"+id:EXTRA[id].pic;for(let k=0;k<3;k++){const sp2=picSprite(pic);sp2.scale.setScalar(.42);sp2.position.set(bd.x-(S_.items.length-1)*.6+i*1.2+(k-1)*.3,1.0+k*.45,zb+f*.85);scene.add(sp2);bd.parts.push(sp2);}});
  const o=npc(["cook.glb","villager.glb","merchant.glb"][bd.id%3],bd.x,zb+f*1.1,f>0?0:Math.PI);const lb=label(S_.keeper,0xffffff);lb.scale.set(1.4,.28,1);lb.position.y=2.35;o.g.add(lb);
  const t=setInterval(()=>{if(!o.rig)return;clearInterval(t);o.rig.root.traverse(m=>{if(/_Hat$/.test(m.name)||m.name==="Mug")m.visible=false;});},400);const pp=personize(o,S_.keeper);
  const front=new THREE.Vector3(bd.x,0,zc+f*1.1);SPOTS.shop.push({pos:front.clone().add(new THREE.Vector3(rnd(-1,1),0,0)),face:f>0?Math.PI:0,name:key});
  ACTS.push({pos:front,r:2.2,label:`Buy at the ${key}`,hidden:()=>pp.down,run:()=>{CUR_SHOP={key,S:S_,pos:front};toggleBag(true,"shop");}});}
function shopTab(box){const sh=CUR_SHOP;let h=`<p class="purse">🪙 <b>${COINS}</b> denarii</p>`;if(!sh||P.pos.distanceTo(sh.pos)>3.5){box.innerHTML=h+`<p class="tip">Walk up to a shop's counter to buy.</p>`;return;}
  h+=`<p class="tip">${esc(sh.S.keeper)} at the ${esc(sh.key)}: “What would you like?”</p><div class="list">`;
  sh.S.items.forEach((id,i)=>{const f=FOODS[id]||EXTRA[id];h+=`<button data-shopitem="${i}" class="${COINS<f.price?"poor":""}">${id in FOODS?foodIco(id):img(EXTRA[id].pic,"in")} <span>${esc(f.name)} <small>${esc(f.what)}</small></span><b>${f.price} 🪙</b></button>`;});
  box.innerHTML=h+`</div><p class="msg ${forgeOk?"ok":""}">${esc(forgeMsg)}</p>`;}
function shopBuy(i){const sh=CUR_SHOP;if(!sh)return;const id=sh.S.items[i],f=FOODS[id]||EXTRA[id];if(COINS<f.price){forgeOk=false;forgeMsg="Not enough coins yet.";return;}
  if(id in FOODS){if(!addItem({t:"food",id,n:1})){forgeOk=false;forgeMsg="Your bag is full.";return;}}
  else if(id==="haircut"){const hair=RIG&&RIG.bones.head&&RIG.bones.head.getObjectByName("heroHair");const col=pick([0x3a2418,0xc8a050,0x8a3a1a,0x1a1a1a,0xd8d0c0,0x6a3a8a,0x2a5a9a]);HAIR.c=col;if(hair)hair.traverse(m=>{if(m.isMesh)m.material.color.set(col);});}
  else if(id==="sandals"){P.buffT=Math.max(P.buffT||0,120);hud();}
  COINS-=f.price;coinHud();forgeOk=true;forgeMsg=id in FOODS?`${f.name} is in your bag.`:id==="haircut"?"Snip snip — what a new look!":"Off you go — fast feet!";}
// the library: shelves along the walls, each with a sign for its subject; a computer on a desk; Varro behind the desk
function libraryInside(bd){const f=bd.face,zb=bd.z-f*bd.d/2,wood=LOOK.toon(0x6b4423),cats=["Designs","Building","Science","Space","Animals","Ancient Rome","Math","Gardens","Water & weather","Heat & cold","Inventions"];
  const spots=[];for(let i=0;i<6;i++)spots.push([bd.x-bd.w/2+.6,bd.z-4.5+i*1.8,Math.PI/2]);for(let i=0;i<5;i++)spots.push([bd.x+bd.w/2-.6,bd.z-4.5+i*1.8,-Math.PI/2]);
  spots.forEach(([x,z,r],i)=>{const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=r;scene.add(g);bd.parts.push(g);const sh=LOOK.M(new THREE.BoxGeometry(1.6,2.4,.5),wood,.02);sh.position.y=1.2;g.add(sh);
    for(let k=0;k<4;k++)for(let b=0;b<9;b++){const bk=new THREE.Mesh(new THREE.BoxGeometry(.13,.42,.3),LOOK.toon([0xb5482f,0x3f6fa8,0x4f8f3a,0xc98a2b,0x8a4fb0,0xe8dcc4][(b+k+i)%6]));bk.position.set(-.65+b*.16,.5+k*.55,.12);g.add(bk);}
    const sign=signBoard(cats[i],0xbfe0ff);sign.scale.setScalar(.75);sign.position.set(0,2.65,.27);g.add(sign);
    {const m=block(x,z,Math.abs(Math.sin(r))>.5?.6:1.7,2.4,Math.abs(Math.sin(r))>.5?1.7:.6,0x6b4423);m.material.visible=false;m.castShadow=false;}
    const sp=new THREE.Vector3(x+Math.sin(r)*1.1,0,z+Math.cos(r)*1.1);ACTS.push({pos:sp,r:1.3,label:cats[i]==="Designs"?"📐 Design ideas — houses, chairs, cars, boats…":`Browse the shelf: ${cats[i]}`,run:cats[i]==="Designs"?openIdeas:()=>uiOpen(o=>DESIGN.openLibrary(Object.assign(o,{shelf:cats[i]})))});});
  const desk=block(bd.x,zb+f*3,3,1,1,0x6b4423);desk.material=LOOK.toon(0x6b4423);
  const mon=new THREE.Mesh(new THREE.BoxGeometry(.7,.5,.08),new THREE.MeshBasicMaterial({color:0x2a6ab0}));mon.position.set(bd.x+.6,1.35,zb+f*3);mon.rotation.y=f>0?0:Math.PI;scene.add(mon);bd.parts.push(mon);
  const base=new THREE.Mesh(new THREE.BoxGeometry(.5,.08,.3),LOOK.toon(0x333338));base.position.set(bd.x+.6,1.04,zb+f*3);scene.add(base);bd.parts.push(base);
  const lb=signBoard("Computer — ask it for any book",0xffe08a);lb.scale.setScalar(.6);lb.position.set(bd.x+.6,1.9,zb+f*3);lb.rotation.y=f>0?0:Math.PI;scene.add(lb);bd.parts.push(lb);
  LIBRARIAN.g.position.set(bd.x-.6,0,zb+f*2.2);LIBRARIAN.g.rotation.y=f>0?0:Math.PI;
  {const wx=bd.x,wz=bd.z+f*3.2;const top=block(wx,wz,3,1,1.4,0x7a5232);top.material=LOOK.toon(0x8a5a32);
    [["stick",-1,.3],["plank",0,-.2],["iron",1,.2]].forEach(([k,dx,dz])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(1.2,.08,.12),LOOK.toon({stick:0xc08a4e,plank:0x8a5a2e,iron:0x8b96a4}[k]));m.position.set(wx+dx*.6,1.05,wz+dz);m.rotation.y=dx*.4;scene.add(m);bd.parts.push(m);});
    const sg=signBoard("Workbench — build and test your ideas",0xffe08a);sg.scale.setScalar(.55);sg.position.set(wx,1.9,wz);sg.rotation.y=f>0?Math.PI:0;scene.add(sg);bd.parts.push(sg);
    ACTS.push({pos:new THREE.Vector3(wx,0,wz+f*1.2),r:1.6,label:"Workbench — build and test",run:openBench});
    ACTS.push({pos:new THREE.Vector3(wx,0,wz-f*1.2),r:1.6,label:"Workbench — build and test",run:openBench});}
  ACTS.push({pos:new THREE.Vector3(bd.x+.6,0,zb+f*4.1),r:1.6,label:"Use the computer",run:()=>uiOpen(o=>DESIGN.openLibrary(Object.assign(o,{computer:true})))});
  ACTS.push({pos:new THREE.Vector3(bd.x-.6,0,zb+f*4.1),r:1.4,label:"Talk to Varro",hidden:()=>LIBRARIAN.pp.down,run:()=>uiOpen(o=>DESIGN.openLibrary(o))});
  storyRoom(bd);}
// ---------------- Fabulae, the story room upstairs in the library (2026-11-26, Barbara: "make another room, not another bookshelf"; "2-40 pages, all fantasy and
// fiction … all types of fiction like historical and realistic"). Stairs along the back wall go up to a second floor: a bookcase for each kind of story,
// a rug, armchairs and a lectern with every story. Built for the library only (its building has no solid top: walls, a floor and a roof instead).
function storyRoom(bd){const x0=bd.x-bd.w/2+WT,x1=bd.x+bd.w/2-WT,zF=bd.z-bd.d/2+WT,zB=bd.z+bd.d/2-WT,Y=3.3,top=6.6,brick=0xd8cfbf,trim=0xffffff,hole0=36.9-30+bd.z;   // the stairs' strip: hole0..zB
  const up=(x,y,z,w,h,d,col)=>{const m=block(x,z,w,h,d,col);BLOCKS[BLOCKS.length-1].y=y;m.position.y=y+h/2;m.material=LOOK.toon(col);bd.parts.push(m);return m;};
  const sx=x0+7.05;   // the landing at the top of the stairs ends here; the floor of the back strip runs from the left wall to it
  up((x0+x1)/2,GF,(zF+hole0)/2,x1-x0,Y-GF,hole0-zF,0x7a5a3a);up((x0+sx)/2,GF,(hole0+zB)/2,sx-x0,Y-GF,zB-hole0,0x7a5a3a);
  for(let k=0;k<11;k++){const a=x1-.5*(k+1),b=x1-.5*k;up((a+b)/2,0,(hole0+zB)/2,.5,.3*(k+1),zB-hole0,k%2?0x8a6440:0x7a5634);}   // 11 steps of 30 cm, from the right-hand corner up to the left
  up((sx+x1-5.5)/2,0,(hole0+zB)/2,x1-5.5-sx,Y,zB-hole0,0x7a5634);   // the landing
  up((x1-5.5+1+x1)/2,Y,hole0-.05,x1-(x1-5.5+1),.95,.1,0x5a3a22);   // a rail along the stair hole, with the gap at the top of the stairs
  // walls of the upper floor (outside they look like the rest of the building) and the roof
  [[bd.x,bd.z-bd.d/2+WT/2,bd.w,WT],[bd.x,bd.z+bd.d/2-WT/2,bd.w,WT],[bd.x-bd.w/2+WT/2,bd.z,WT,bd.d],[bd.x+bd.w/2-WT/2,bd.z,WT,bd.d]].forEach(([cx,cz,w,d])=>{const f=fblock(cx,GF,cz,w,top-GF,d,brick,trim);bd.parts.push(f.m);});
  {const f=fblock(bd.x,top,bd.z,bd.w,bd.h-top,bd.d,brick,trim);bd.parts.push(f.m);}
  const add=(m,px,py,pz)=>{m.position.set(px,py,pz);scene.add(m);bd.parts.push(m);return m;};
  for(let i=0;i<4;i++){const w=add(new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.4),new THREE.MeshBasicMaterial({color:0xbfe6ff})),bd.x-4.5+i*3,Y+1.7,zF+.02);}   // windows over the street
  INTERIORS.push({x0,x1,z0:zF,z1:zB,y0:Y,y1:top,c:new THREE.Vector3(bd.x,Y+2.4,bd.z),name:"Fabulae — the story room"});
  // downstairs: a sign at the foot of the stairs
  {const s=signBoard("Upstairs: Fabulae — the story room",0xffe08a);s.scale.setScalar(.5);add(s,x1-1.2,2.4,zB-.05);s.rotation.y=Math.PI;}
  // the room: a bookcase for each kind of story along the side walls, a rug, armchairs, lamps and the lectern with all of them
  const kinds=["Fantasy","Historical fiction","Realistic fiction","Science fiction","Mystery","Adventure","Funny","Fables"],cols=[0x7a3fa0,0xa0602a,0x3f7fb0,0x2a8a8a,0x444a6a,0x3f8a3a,0xd08a20,0x8a5a32];
  kinds.forEach((k,i)=>{const left=i<4,zz=zF+2.6+(i%4)*3.1,xx=left?x0+.3:x1-.3,r=left?Math.PI/2:-Math.PI/2,g=new THREE.Group();g.position.set(xx,Y,zz);g.rotation.y=r;scene.add(g);bd.parts.push(g);
    const sh=LOOK.M(new THREE.BoxGeometry(2.4,2.5,.5),LOOK.toon(0x5a3a22),.02);sh.position.y=1.25;g.add(sh);
    for(let s=0;s<4;s++)for(let b=0;b<13;b++){const bk=new THREE.Mesh(new THREE.BoxGeometry(.14,.44,.3),LOOK.toon([cols[i],0xe8dcc4,cols[i],0x6b4423,cols[(i+3)%8]][(b+s)%5]));bk.position.set(-1.04+b*.17,.45+s*.56,.12);g.add(bk);}
    const sg=signBoard(k,0xffe08a);sg.scale.setScalar(.7);sg.position.set(0,2.75,.27);g.add(sg);
    up(xx+(left?.0:0),Y,zz,.5,2.5,2.4,0x5a3a22).material.visible=false;
    ACTS.push({pos:new THREE.Vector3(xx+(left?1.1:-1.1),Y,zz),r:1.5,label:`📚 ${k} — pick a story`,run:()=>uiOpen(o=>DESIGN.openLibrary(Object.assign(o,{stories:k})))});});
  const rug=add(new THREE.Mesh(new THREE.PlaneGeometry(6,8),new THREE.MeshLambertMaterial({color:0x8a2f2f})),bd.x,Y+.06,bd.z-1);rug.rotation.x=-Math.PI/2;
  const rug2=add(new THREE.Mesh(new THREE.PlaneGeometry(5.4,7.4),new THREE.MeshLambertMaterial({color:0xc9a25a})),bd.x,Y+.07,bd.z-1);rug2.rotation.x=-Math.PI/2;
  [[-1.8,-3.2,0],[1.8,-3.2,0],[-2,1.6,Math.PI],[2,1.6,Math.PI]].forEach(([dx,dz,r])=>{const g=new THREE.Group();g.position.set(bd.x+dx,Y,bd.z+dz);g.rotation.y=r;scene.add(g);bd.parts.push(g);const red=LOOK.toon(0x3f6a8a);
    const seat=new THREE.Mesh(new THREE.BoxGeometry(1,.45,.9),red);seat.position.y=.25;g.add(seat);const back=new THREE.Mesh(new THREE.BoxGeometry(1,.8,.2),red);back.position.set(0,.8,-.4);g.add(back);
    [-.5,.5].forEach(a=>{const arm=new THREE.Mesh(new THREE.BoxGeometry(.15,.35,.9),red);arm.position.set(a,.55,0);g.add(arm);});});
  [[-2.8,-4.6],[2.8,-4.6]].forEach(([dx,dz])=>{const p=add(new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.6,6),LOOK.toon(0x333338)),bd.x+dx,Y+.8,bd.z+dz);const sh=add(new THREE.Mesh(new THREE.ConeGeometry(.35,.35,10,1,true),new THREE.MeshBasicMaterial({color:0xffe6a8,side:THREE.DoubleSide})),bd.x+dx,Y+1.7,bd.z+dz);});
  const lec=up(bd.x,Y,bd.z-1,.8,1.1,.6,0x6b4423);const book=add(new THREE.Mesh(new THREE.BoxGeometry(.7,.06,.5),LOOK.toon(0xe8dcc4)),bd.x,Y+1.13,bd.z-1);book.rotation.x=-.25;
  {const s=signBoard("Fabulae — the story room",0xffe08a);s.scale.setScalar(.75);add(s,bd.x,Y+2.6,zF+.05);}
  ACTS.push({pos:new THREE.Vector3(bd.x,Y,bd.z-2),r:1.4,label:"📖 Every story — all kinds",run:()=>uiOpen(o=>DESIGN.openLibrary(Object.assign(o,{stories:"all"})))});
  ACTS.push({pos:new THREE.Vector3(bd.x,Y,bd.z),r:1.4,label:"📖 Every story — all kinds",run:()=>uiOpen(o=>DESIGN.openLibrary(Object.assign(o,{stories:"all"})))});}
// the school: a blackboard, rows of desks, Magistra Cornelia at the front; sit at a desk to listen
function schoolInside(bd){const f=bd.face,zb=bd.z-f*bd.d/2;
  const bb=new THREE.Mesh(new THREE.BoxGeometry(6,2,.1),new THREE.MeshLambertMaterial({color:0x2a4a3a}));bb.position.set(bd.x,1.8,zb+f*.4);scene.add(bb);bd.parts.push(bb);
  const chalk=signBoard("Today: listen, then think for yourself",0xffffff);chalk.scale.setScalar(.55);chalk.position.set(bd.x,2.3,zb+f*.47);chalk.rotation.y=f>0?0:Math.PI;scene.add(chalk);bd.parts.push(chalk);
  for(let r=0;r<3;r++)for(let c=0;c<4;c++){const x=bd.x-4.2+c*2.8,z=zb+f*(4.2+r*2.4);const dk=LOOK.M(new THREE.BoxGeometry(1.6,.08,.7),LOOK.toon(0x8a5a32),.01);dk.position.set(x,.78,z);scene.add(dk);bd.parts.push(dk);
    [[-.7,-.3],[.7,-.3],[-.7,.3],[.7,.3]].forEach(([a,b])=>{const l=new THREE.Mesh(new THREE.BoxGeometry(.06,.78,.06),LOOK.toon(0x6b4423));l.position.set(x+a,.39,z+b);scene.add(l);bd.parts.push(l);});
    ACTS.push({pos:new THREE.Vector3(x,0,z+f*.8),r:1.1,label:"Sit down and listen",run:()=>uiOpen(o=>DESIGN.openSchool(o))});}
  TEACHER.g.position.set(bd.x+2.5,0,zb+f*1.4);TEACHER.g.rotation.y=f>0?0:Math.PI;}
// Insula Alta: an apartment house with an elevator. Buy the flat on the 5th floor (80 denarii) and it's yours: a bed, your chest,
// a table, windows over the city. The elevator rides between the lobby and your floor.
const APT={owned:false,price:80,lobby:null,home:null,chest:null,bed:null,y:4*3.3};try{APT.owned=localStorage.getItem("elementum.apartment")==="1";}catch(e){}
function aptInside(bd){const f=bd.face,zb=bd.z-f*bd.d/2,ex=bd.x+bd.w/2-1.3,ez=zb+f*1.4,y=APT.y;
  const cab=(yy)=>{const g=new THREE.Group();g.position.set(ex,yy,ez);scene.add(g);bd.parts.push(g);const metal=LOOK.toon(0x9aa4b0);
    [[-.75,0],[.75,0]].forEach(([a])=>{const s2=LOOK.M(new THREE.BoxGeometry(.08,2.4,1.5),metal,.01);s2.position.set(a,1.2,0);g.add(s2);});const bk=LOOK.M(new THREE.BoxGeometry(1.6,2.4,.08),metal,.01);bk.position.set(0,1.2,-f*.75);g.add(bk);
    const top=LOOK.M(new THREE.BoxGeometry(1.6,.1,1.5),metal,.01);top.position.y=2.45;g.add(top);const sign=signBoard(yy?"Elevator · floor 5":"Elevator",0xffe08a);sign.scale.setScalar(.5);sign.position.set(0,2.75,f*.76);sign.rotation.y=f>0?0:Math.PI;g.add(sign);};
  cab(0);cab(y);APT.lobby=new THREE.Vector3(ex,0,ez+f*.9);APT.home=new THREE.Vector3(ex,y,ez+f*.9);
  // the flat: bed, chest, table and chair, a rug
  const hx=bd.x-1.4,wood=LOOK.toon(0x8a5a32);const bed=LOOK.M(new THREE.BoxGeometry(1.4,.5,2.2),LOOK.toon(0xe8dcc4),.01);bed.position.set(bd.x-bd.w/2+1.2,y+.25,bd.z);scene.add(bed);bd.parts.push(bed);
  const pil=LOOK.M(new THREE.BoxGeometry(1.2,.18,.45),LOOK.toon(0xffffff),.01);pil.position.set(bd.x-bd.w/2+1.2,y+.58,bd.z-.8);scene.add(pil);bd.parts.push(pil);
  const ch=LOOK.M(new THREE.BoxGeometry(1,.7,.6),wood,.015);ch.position.set(bd.x-bd.w/2+1,y+.35,bd.z+2);scene.add(ch);bd.parts.push(ch);
  const tb=LOOK.M(new THREE.CylinderGeometry(.6,.6,.06,14),wood,.01);tb.position.set(bd.x+.3,y+.78,bd.z-1.5);scene.add(tb);bd.parts.push(tb);const tl=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.75,8),wood);tl.position.set(bd.x+.3,y+.38,bd.z-1.5);scene.add(tl);bd.parts.push(tl);
  const rug=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.6),new THREE.MeshLambertMaterial({color:0xb5482f}));rug.rotation.x=-Math.PI/2;rug.position.set(bd.x,y+.02,bd.z+.5);scene.add(rug);bd.parts.push(rug);
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(bd.w-WT*2,bd.d-WT*2),new THREE.MeshLambertMaterial({color:0x9a7a55}));fl.rotation.x=-Math.PI/2;fl.position.set(bd.x,y+.015,bd.z);scene.add(fl);bd.parts.push(fl);
  // the balcony: a slab outside the door with an iron railing (low enough to climb over — careful!)
  {const bz=bd.z+f*(bd.d/2+.8),iron=LOOK.toon(0x2a2a30);const sl=block(bd.x,bz,3.2,.3,1.6,0x8a8a8a);sl.position.y=y-.15;BLOCKS[BLOCKS.length-1].y=y-.3;sl.material=LOOK.toon(0xb8b0a0);
    [[bd.x,bz+f*.75,3.2,.08],[bd.x-1.55,bz,.08,1.6],[bd.x+1.55,bz,.08,1.6]].forEach(([rx,rz,rw,rd])=>{const r=block(rx,rz,rw,.95,rd,0x2a2a30);r.position.y=y+.475;BLOCKS[BLOCKS.length-1].y=y;r.material=iron;});}
  APT.bed=new THREE.Vector3(bd.x-bd.w/2+1.2,y,bd.z);APT.chest=new THREE.Vector3(bd.x-bd.w/2+1,y,bd.z+2);
  ACTS.push({pos:APT.lobby,r:1.4,label:()=>APT.owned?"Elevator: up to your flat (floor 5)":"Elevator: the flat on floor 5 is for sale",run:()=>{
    if(APT.owned){ride(APT.home,"Going up… 1 · 2 · 3 · 4 · 5");return;}
    ask(`The flat on floor 5 has a bed, a chest, a balcony and windows over the city. It costs ${APT.price} denarii.`,[[`Buy it (${APT.price})`,()=>{
      if(COINS<APT.price){lawSay(`The flat costs ${APT.price} denarii — you have ${COINS}. Solve people's problems or read books at the school to earn more!`);return;}
      COINS-=APT.price;coinHud();APT.owned=true;try{localStorage.setItem("elementum.apartment","1");}catch(e){}lawSay("The flat on floor 5 is yours! Here's the key.");ride(APT.home,"Going up… 1 · 2 · 3 · 4 · 5");}],["Not now",null]]);}});
  ACTS.push({pos:APT.home,r:1.4,label:"Elevator: down to the lobby",run:()=>ride(APT.lobby,"Going down… 4 · 3 · 2 · 1 · lobby")});
  ACTS.push({pos:APT.bed,r:1.8,label:()=>isNight()?"Sleep until morning":"Take a nap",hidden:()=>!APT.owned,run:sleep});
  ACTS.push({pos:APT.chest,r:1.6,label:"Open your chest",hidden:()=>!APT.owned,run:()=>toggleBag(true,"chest")});}
// Hospitium: rent a room for the night — sleep until morning and wake up fully healed
function hotelInside(bd){const f=bd.face,zb=bd.z-f*bd.d/2,zc=zb+f*1.8;const desk=block(bd.x,zc,3.4,1.1,.8,0x5a2a3a);desk.material=LOOK.toon(0x6a3a4a);
  const bell=new THREE.Mesh(new THREE.SphereGeometry(.09,10,6,0,6.3,0,1.6),LOOK.toon(0xd8ac4a));bell.position.set(bd.x+.8,1.12,zc);scene.add(bell);bd.parts.push(bell);
  const o=npc("villager.glb",bd.x,zb+f*1,f>0?0:Math.PI);const lb=label("Claudia at the desk",0xffffff);lb.scale.set(2,.32,1);lb.position.y=2.35;o.g.add(lb);const pp=personize(o,"Claudia");
  const rug=new THREE.Mesh(new THREE.PlaneGeometry(2,bd.d-4),new THREE.MeshLambertMaterial({color:0x7a2a4a}));rug.rotation.x=-Math.PI/2;rug.position.set(bd.x,.03,bd.z+f*.8);scene.add(rug);bd.parts.push(rug);
  ACTS.push({pos:new THREE.Vector3(bd.x,0,zc+f*1.1),r:2,label:"Talk to Claudia at the desk",hidden:()=>pp.down,run:()=>ask("Claudia: “Would you like a room? It's 15 denarii, and you can sleep until morning.”",[["Rent a room (15)",()=>{if(COINS<15){lawSay("A room costs 15 denarii — you don't have enough.");return;}COINS-=15;coinHud();
    lawSay("Claudia: “Sleep well!”");startSleep();}],["No thanks",null]])});}
// a yes/no question box: nothing happens (and nothing is paid) unless you pick the first answer
function ask(text,answers){const box=$("#askBox");$("#askText").textContent=text;const row=$("#askBtns");row.innerHTML="";G.firing=false;if(document.exitPointerLock)document.exitPointerLock();
  answers.forEach(([lab,fn],i)=>{const b=document.createElement("button");b.textContent=lab;if(i)b.className="g";b.onclick=()=>{box.classList.add("hidden");if(fn)fn();};row.appendChild(b);});box.classList.remove("hidden");}
function ride(to,msg){const v=$("#vig");lawSay(msg);v.classList.add("on");setTimeout(()=>{P.pos.copy(to);P.fallTop=undefined;P.vel.set(0,0,0);v.classList.remove("on");},700);}
function stepRooms(){const r=inRoom(P.pos);if(r){ROOM_LIGHT.position.copy(r.c);ROOM_LIGHT.intensity=1.6;}else ROOM_LIGHT.intensity=0;}
// ---------------- your own business (2026-11-22, "you can start a business"): rent the empty shop, pick what to sell, buy stock, set a price.
// Neighbors come in and buy — fewer if the price is too high; at too low a price you lose money. Each business day (2 minutes) ends with a
// report: money in − money out = profit (after rent). A painted sign brings more customers. Saved on this device.
const BIZ_TYPES={lemonade:{name:"Lemonade stand",unit:"cups",cost:1,fair:3,color:0xf0d040},bakery:{name:"Bakery",unit:"loaves",cost:3,fair:6,color:0xc08a4e},
  flowers:{name:"Flower shop",unit:"bunches",cost:2,fair:5,color:0xd060a0},toys:{name:"Toy shop",unit:"toys",cost:6,fair:12,color:0x3f6fa8}};
const BIZ_DAY=120,BIZ_RENT=5;
let BIZ;try{BIZ=JSON.parse(localStorage.getItem("elementum.business")||"null");}catch(e){BIZ=null;}
BIZ=BIZ||{type:null,price:0,stock:0,sign:false,day:1,t:0,today:{came:0,sold:0,in:0,out:0},days:[]};
const bizSave=()=>{try{localStorage.setItem("elementum.business",JSON.stringify(BIZ));}catch(e){}};
const BIZ_AT={counter:null,spot:null,crates:[]};
function bizInside(bd){const f=bd.face,zb=bd.z-f*bd.d/2,zc=zb+f*1.7;const c=block(bd.x,zc,Math.min(bd.w-1.6,4.2),1.05,.7,0x8a5a32);c.material=LOOK.toon(0x8a5a32);
  BIZ_AT.counter=new THREE.Vector3(bd.x,0,zc+f*1.1);BIZ_AT.spot=new THREE.Vector3(bd.x+1,0,zc+f*1.2);BIZ_AT.bd=bd;BIZ_AT.f=f;BIZ_AT.zb=zb;
  SPOTS.shop.push({pos:BIZ_AT.spot,face:f>0?Math.PI:0,name:"your shop",biz:true});
  ACTS.push({pos:BIZ_AT.counter,r:2,label:()=>BIZ.type?`Your ${BIZ_TYPES[BIZ.type].name.toLowerCase()}`:"Start a business here",run:()=>toggleBag(true,"biz")});bizCrates();}
function bizCrates(){BIZ_AT.crates.forEach(c=>scene.remove(c));BIZ_AT.crates=[];if(!BIZ_AT.bd||!BIZ.type)return;const n=Math.min(12,Math.ceil(BIZ.stock/5));const T=BIZ_TYPES[BIZ.type];
  for(let i=0;i<n;i++){const m=LOOK.M(new THREE.BoxGeometry(.5,.4,.4),LOOK.toon(T.color),.01);m.position.set(BIZ_AT.bd.x-1.6+(i%6)*.62,.2+Math.floor(i/6)*.42,BIZ_AT.zb+BIZ_AT.f*.6);scene.add(m);BIZ_AT.crates.push(m);}}
// will this customer buy? at the fair price about 6 in 10 do; at double the price nobody; at half almost everyone
function bizTry(walker){if(!BIZ.type)return;const T=BIZ_TYPES[BIZ.type];BIZ.today.came++;if(BIZ.stock<=0){if(walker)say(walker,"Sold out? Oh well.",2.4);return;}
  const p=Math.max(0,Math.min(1,1.6-BIZ.price/T.fair));if(Math.random()<p){BIZ.stock--;BIZ.today.sold++;BIZ.today.in+=BIZ.price;COINS+=BIZ.price;coinHud();bizCrates();
    if(walker)say(walker,pick(["I'll take one!","Just what I wanted.","Lovely, thank you!"]),2.4);if(P.pos.distanceTo(BIZ_AT.counter)<12)popNum(BIZ_AT.counter.clone().add(new THREE.Vector3(0,2,0)),`+${BIZ.price} denarii`,"spell");}
  else if(walker)say(walker,pick(["Too expensive!","Hmm, not at that price.","Maybe another day."]),2.4);bizSave();}
function stepBiz(dt){if(!BIZ.type)return;BIZ.t+=dt;
  // customers from all over town (besides the neighbors you see walk in): more with a sign
  if(Math.random()<dt/(BIZ.sign?5:8))bizTry(null);
  if(BIZ.t>=BIZ_DAY){const d=BIZ.today;d.out+=BIZ_RENT;const profit=d.in-d.out;BIZ.days.push({day:BIZ.day,came:d.came,sold:d.sold,in:d.in,out:d.out,profit,price:BIZ.price});BIZ.days=BIZ.days.slice(-8);
    if(COINS<BIZ_RENT){BIZ.type=null;bizSave();bizCrates();lawSay(`You couldn't pay the ${BIZ_RENT} denarii rent, so your shop is closed. You can rent it again any time.`);return;}
    COINS-=BIZ_RENT;coinHud();lawSay(`Business day ${BIZ.day}: ${d.sold} sold, money in ${d.in} − money out ${d.out} = profit ${profit} denarii.`);BIZ.day++;BIZ.t=0;BIZ.today={came:0,sold:0,in:0,out:0};bizSave();}}
function bizTab(box){let h=`<p class="purse">🪙 <b>${COINS}</b> denarii</p>`;if(!BIZ_AT.counter||P.pos.distanceTo(BIZ_AT.counter)>4){box.innerHTML=h+`<p class="tip">Your shop is the empty one for rent in Nova Urbs, next to the plaza.</p>`;return;}
  if(!BIZ.type){h+=`<p class="tip">Start a business! Choose what to sell. Rent is ${BIZ_RENT} denarii per business day (2 minutes). You buy stock, set your price, and neighbors come in to buy.</p><div class="list">`;
    for(const [k,t] of Object.entries(BIZ_TYPES))h+=`<button data-bizstart="${k}"><span>${esc(t.name)} <small>${t.unit} cost you ${t.cost} each to make · people think ${t.fair} is a fair price</small></span></button>`;box.innerHTML=h+`</div>`;return;}
  const T=BIZ_TYPES[BIZ.type],d=BIZ.today;
  h+=`<h3>${esc(T.name)} — day ${BIZ.day} (${Math.ceil(BIZ_DAY-BIZ.t)} s left)</h3><p class="tip">Each of your ${T.unit} costs you ${T.cost} to make. You sell them for <b>${BIZ.price}</b>. In stock: <b>${BIZ.stock}</b>.</p>
    <div class="answer">Price: <input id="bizPrice" type="number" min="1" max="99" value="${BIZ.price}"><button id="bizSetPrice">Set price</button></div>
    <div class="list"><button data-bizbuy="10"><span>Make 10 more ${T.unit}</span><b>${10*T.cost} 🪙</b></button><button data-bizbuy="25"><span>Make 25 more ${T.unit}</span><b>${25*T.cost} 🪙</b></button>
    ${BIZ.sign?"":`<button data-bizsign="1"><span>Paint a sign — more customers</span><b>15 🪙</b></button>`}</div>
    <p class="tip">Today so far: ${d.came} came in, ${d.sold} bought. Money in ${d.in}, money out ${d.out} (rent ${BIZ_RENT} is paid at the end of the day).</p>`;
  if(BIZ.days.length)h+=`<table class="biz"><tr><th>Day</th><th>Price</th><th>Came</th><th>Sold</th><th>Money in</th><th>Money out</th><th>Profit</th></tr>${BIZ.days.slice().reverse().map(r=>`<tr><td>${r.day}</td><td>${r.price}</td><td>${r.came}</td><td>${r.sold}</td><td>${r.in}</td><td>${r.out}</td><td class="${r.profit<0?"neg":""}">${r.profit}</td></tr>`).join("")}</table>`;
  h+=`<p class="msg ${forgeOk?"ok":""}">${esc(forgeMsg)}</p><button data-bizclose="1">Close the business</button>`;box.innerHTML=h;}
function bizStart(k){BIZ.type=k;BIZ.price=BIZ_TYPES[k].fair;BIZ.stock=0;BIZ.t=0;BIZ.today={came:0,sold:0,in:0,out:0};BIZ.days=[];BIZ.day=1;forgeMsg="You rented the shop — you're in business! Make some stock to sell.";forgeOk=true;bizSave();bizCrates();}
function bizClick(t){if(t.dataset.bizstart){const k=t.dataset.bizstart,T=BIZ_TYPES[k];if(!T)return true;   // renting the shop asks first (Barbara, 2026-11-21)
    ask(`Rent this shop for a ${T.name.toLowerCase()}? Rent is ${BIZ_RENT} denarii every business day (2 minutes), paid at the end of each day, until you close the business.`,[[`Rent it (${BIZ_RENT} a day)`,()=>{bizStart(k);renderBag();}],["No thanks",null]]);return true;}
  if(t.dataset.bizbuy){const n=+t.dataset.bizbuy,T=BIZ_TYPES[BIZ.type],c=n*T.cost;if(COINS<c){forgeOk=false;forgeMsg=`That costs ${c} — you have ${COINS}.`;}else{COINS-=c;coinHud();BIZ.stock+=n;BIZ.today.out+=c;forgeOk=true;forgeMsg=`Made ${n} ${T.unit}.`;bizSave();bizCrates();}renderBag();return true;}
  if(t.dataset.bizsign){if(COINS<15){forgeOk=false;forgeMsg="A sign costs 15.";}else{COINS-=15;coinHud();BIZ.sign=true;BIZ.today.out+=15;forgeOk=true;forgeMsg="A bright new sign — more people will notice your shop.";bizSave();}renderBag();return true;}
  if(t.id==="bizSetPrice"){const v=parseInt(($("#bizPrice")||{}).value,10);if(v>0&&v<100){BIZ.price=v;bizSave();forgeOk=true;forgeMsg=`Price set to ${v}.`;}renderBag();return true;}
  if(t.dataset.bizclose){BIZ.type=null;bizSave();bizCrates();forgeMsg="";renderBag();return true;}return false;}
// a row of buildings along one side of a block; face = +1 fronts look north (+z), -1 south
RNG=seedRnd(16);
function row(ci,ri,face,x0,x1,zf,depth){const sp=SPECIAL[ci+","+ri+","+face];let x=x0;let first=true;
  while(x1-x>3.5){const w=Math.min(x1-x,first&&sp?7:rnd(4.6,6.8));const cx=x+w/2,cz=zf-face*depth/2;
    if(first&&sp){const bd=building(cx,cz,w-.25,depth,sp.floors,face,{name:sp.name,awning:sp.awning,tank:!sp.apt&&RNG()<.5,enter:true,homeFloor:sp.apt?4:0});if(sp.apt)aptInside(bd);else if(sp.biz)bizInside(bd);else if(sp.hotel)hotelInside(bd);else shopInside(bd,sp);
      const door=new THREE.Vector3(cx,0,zf+face*1.6);if(sp.shop)SPOTS.shop.push({pos:door,face:face>0?Math.PI:0,name:sp.name});
      if(sp.eat)for(const k of [-1,1])addTable(cx+k*2.1,zf+face*2.4);}
    else building(cx,cz,w-.25,depth,ri===1?ri+1+Math.floor(RNG()*2):2+Math.floor(RNG()*3),face,{tank:RNG()<.35});
    x+=w;first=false;}}
// restaurant tables on the pavement: a round table, two chairs; neighbors sit and eat (food from items/ on the plate)
function addTable(x,z){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);const wood=LOOK.toon(0x6b4423),cloth=LOOK.toon(0xf3ead6);
  const top=LOOK.M(new THREE.CylinderGeometry(.55,.55,.06,16),cloth,.01);top.position.y=.78;g.add(top);const leg=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,.76,8),wood);leg.position.y=.38;g.add(leg);
  [[-1,Math.PI/2],[1,-Math.PI/2]].forEach(([k,f])=>{const ch=new THREE.Group();ch.position.set(k*.95,0,0);const seat=LOOK.M(new THREE.BoxGeometry(.48,.06,.48),wood,.01);seat.position.y=.46;ch.add(seat);
    const back=LOOK.M(new THREE.BoxGeometry(.06,.55,.48),wood,.01);back.position.set(k*.22,.75,0);ch.add(back);[[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]].forEach(([a,c])=>{const l=new THREE.Mesh(new THREE.BoxGeometry(.05,.46,.05),wood);l.position.set(a,.23,c);ch.add(l);});
    g.add(ch);SPOTS.eat.push({pos:new THREE.Vector3(x+k*.95,0,z),face:f,table:g,taken:null,plate:new THREE.Vector3(x+k*.3,.84,z)});});
  g.traverse(k=>{if(k.isMesh)k.castShadow=true;});}
BLOCK_X.forEach(([x0,x1],ci)=>BLOCK_Z.forEach(([z0,z1],ri)=>{
  if(ci===0&&ri===1)return;                       // the plaza
  if(ci===3&&ri===1)return;                       // the park
  if(ri===2&&(ci===1||ci===2))return;             // the library and the school (below)
  if(ri===0)row(ci,ri,1,x0,x1,z1,11);
  else if(ri===2)row(ci,ri,-1,x0,x1,z0,11);
  else{row(ci,ri,-1,x0,x1,z0,6.8);row(ci,ri,1,x0,x1,z1,6.8);}}));
// the library and the school: big buildings with columns at the front (inside comes next)
const LIBRARY=building(83,30,13.5,17,3,-1,{enter:true,floor:0x7a5a3a,name:"Bibliotheca — the library",upstairs:true,colors:[0xd8cfbf,0xffffff],signHex:0xbfe0ff,signY:7.55,signOut:2.66,door:0x5a3a22});
const SCHOOL=building(105,30,13.5,17,3,-1,{enter:true,floor:0xa08060,name:"Schola — the school",colors:[0xb2603e,0xf0e6d0],signHex:0xffe08a,signY:7.55,signOut:2.66,door:0x2e3e5a,tank:true});
[LIBRARY,SCHOOL].forEach(bd=>{for(let i=0;i<6;i++){const c=LOOK.column(6.6);c.scale.set(.7,1,.7);c.position.set(bd.x-5.5+i*2.2,0,bd.z-bd.d/2-1.4);scene.add(c);bd.parts.push(c);c.userData.y0=0;}
  const pd=LOOK.M(new THREE.BoxGeometry(14,.5,2.6),LOOK.toon(0xe6dccb),.02);pd.position.set(bd.x,6.85,bd.z-bd.d/2-1.3);scene.add(pd);bd.parts.push(pd);pd.userData.y0=6.85;});
// the plaza: a fountain, benches, flower boxes — a place to meet and gossip
{const g=new THREE.Group();g.position.set(61,0,6);scene.add(g);const st=LOOK.toon(0xe6dccb);
  const basin=LOOK.M(new THREE.CylinderGeometry(2,2.2,.55,24),st,.02);basin.position.y=.28;g.add(basin);
  const water=new THREE.Mesh(new THREE.CircleGeometry(1.85,24),new THREE.MeshBasicMaterial({color:0x6fc8f0,transparent:true,opacity:.85}));water.rotation.x=-Math.PI/2;water.position.y=.5;g.add(water);
  const statue=LOOK.M(new THREE.CylinderGeometry(.3,.4,1.6,10),st,.015);statue.position.y=1.1;g.add(statue);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});const m=block(61,6,4,.55,4,0xe6dccb);m.material.visible=false;m.castShadow=false;CITY.fountain=new THREE.Vector3(61,2,6);
  [[56,1.5],[56,10.5],[66,1.5],[66,10.5]].forEach(([x,z])=>{const b=new THREE.Group();b.position.set(x,0,z);const w=LOOK.toon(0x7a5232);
    const s=LOOK.M(new THREE.BoxGeometry(2.2,.1,.6),w,.01);s.position.y=.45;b.add(s);const bk=LOOK.M(new THREE.BoxGeometry(2.2,.5,.08),w,.01);bk.position.set(0,.75,z<6?-.3:.3);b.add(bk);
    [-.9,.9].forEach(k=>{const l=new THREE.Mesh(new THREE.BoxGeometry(.08,.45,.5),LOOK.toon(0x333338));l.position.set(k,.22,0);b.add(l);});scene.add(b);});
  SPOTS.gossip.push({a:new THREE.Vector3(57.5,0,3.2),b:new THREE.Vector3(59,0,3.2),who:[]},{a:new THREE.Vector3(64,0,9),b:new THREE.Vector3(65.5,0,9),who:[]},{a:new THREE.Vector3(56,0,6),b:new THREE.Vector3(57.3,0,7),who:[]});}
// the park: lawn, trees, a path, benches
{const lawn=new THREE.Mesh(new THREE.PlaneGeometry(12,14),new THREE.MeshLambertMaterial({color:0x5f9a46}));lawn.rotation.x=-Math.PI/2;lawn.position.set(126,.015,6);lawn.receiveShadow=true;scene.add(lawn);
  [[121.3,1],[130.7,1],[121.3,11.5],[130.7,11.5]].forEach(([x,z])=>{const g=new THREE.Group();g.position.set(x,0,z);const t=LOOK.M(new THREE.CylinderGeometry(.2,.28,2.2,8),LOOK.toon(0x7a4a28),.015);t.position.y=1.1;g.add(t);
    [[0,2.6,0,1.1],[.5,2.2,.2,.8],[-.45,2.3,-.25,.85]].forEach(([a,b,c,r])=>{const l=LOOK.M(new THREE.IcosahedronGeometry(r,1),LOOK.toon(0x4fa346),.02);l.position.set(a,b,c);g.add(l);});g.traverse(k=>{if(k.isMesh)k.castShadow=true;});scene.add(g);});
  SPOTS.gossip.push({a:new THREE.Vector3(130.4,0,4),b:new THREE.Vector3(130.4,0,5.4),who:[]},{a:new THREE.Vector3(130.4,0,8.6),b:new THREE.Vector3(131.2,0,9.6),who:[]});}
// a few street lamps along the main street
for(let x=56;x<132;x+=11)for(const z of [-9.6,-.4]){const g=new THREE.Group();g.position.set(x,0,z);const p=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,3.6,8),LOOK.toon(0x2a2a30));p.position.y=1.8;g.add(p);
  const l=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),new THREE.MeshBasicMaterial({color:0xfff1c4}));l.position.y=3.7;g.add(l);scene.add(g);LAMPS.push(l);}
CITY.XS.forEach(x=>CITY.ZS.forEach(z=>SPOTS.stroll.push(new THREE.Vector3(x,0,z))));CITY.ZS.forEach(z=>[60,84,106,128].forEach(x=>SPOTS.stroll.push(new THREE.Vector3(x,0,z))));
// wrecking a house: shots dent it (wallHit), blasts too; enough damage and it comes down in a cloud of dust — and the guards come for you.
// It is rebuilt after two minutes. Everyone in your room sees it fall.
const BLD_HP=36;
function buildingHurt(bd,n){if(bd.down)return;bd.dmg+=n;
  if(!WORLD.remote&&!LAW.wanted&&LAW.jailT<=0){if(bd.dmg>=BLD_HP)crime(`You wrecked ${bd.name?"the "+bd.name.split(" —")[0]:bd.owner+"'s house"}!`);
    else if(tAcc-(bd.warnT||-9)>3){bd.warnT=tAcc;LAW.warned++;lawSay(LAW.warned>=3?"Guard: That's it!":`Guard: Hey! Stop damaging ${bd.name?"the "+bd.name.split(" —")[0]:bd.owner+"'s house"}! (${LAW.warned}/3)`);if(LAW.warned>=3)crime("You kept damaging the houses!");}}
  if(bd.dmg>=BLD_HP){collapse(bd);if(!WORLD.remote)setKey("bld:"+bd.id,1);}}
function collapse(bd){if(bd.down)return;bd.down=true;bd.blks.forEach(b=>b.pass=true);const c=new THREE.Vector3(bd.x,1,bd.z);shake(.25);
  for(let i=0;i<40;i++)PUFF.emit(c.clone().add(new THREE.Vector3(rnd(-bd.w/2,bd.w/2),rnd(0,bd.h*.6),rnd(-bd.d/2,bd.d/2))),rnd3(2),C(0xb8a888).multiplyScalar(.6),1.4,{drag:1.5});
  for(let i=0;i<14;i++){const rk=new THREE.Mesh(new THREE.BoxGeometry(rnd(.2,.5),rnd(.15,.3),rnd(.2,.4)),mat(0x9a5a3c));rk.position.set(bd.x+rnd(-bd.w/2,bd.w/2),rnd(1,bd.h),bd.z+rnd(-bd.d/2,bd.d/2));scene.add(rk);bd.parts.push(rk);rk.userData.rubble=true;
    const v=rnd3(2);v.y=0;tween(1.2,t=>{rk.position.addScaledVector(v,.016);rk.position.y=Math.max(.12,rk.position.y-t*.4);rk.rotation.x+=.05;});}
  tween(1.6,t=>{bd.parts.forEach(p=>{if(!p.userData.rubble)p.position.y=p.userData.y0-bd.h*t*t*1.02;});},()=>bd.parts.forEach(p=>{if(!p.userData.rubble)p.visible=false;}));
  bd.blks.forEach(b=>{(b.fx||[]).forEach(o=>scene.remove(o));b.fx=[];b.marks=[];});
  clearTimeout(bd.rebuild);bd.rebuild=setTimeout(()=>rebuild(bd),120000);}
function rebuild(bd){bd.parts=bd.parts.filter(p=>{if(p.userData.rubble){scene.remove(p);return false;}return true;});bd.parts.forEach(p=>{p.visible=true;p.position.y=p.userData.y0;});
  bd.down=false;bd.dmg=0;bd.blks.forEach(b=>b.pass=false);if(!WORLD.remote)setKey("bld:"+bd.id,null);}
// ---------------- the neighbors: they walk the streets of Nova Urbs, go shopping, eat at the restaurants and stop to gossip ----------------
const GOSSIP=[["Did you hear? The bridge over the creek fell down again.","Again? Someone should build a better one."],
  ["The bread at the Pistrinum is the best in town.","Their honey cake too!"],["How much is a loaf today?","Six denarii. Prices keep going up!"],
  ["Have you seen the new Schola?","My kids say the teacher is very kind."],["I'm going to the Bibliotheca later.","Bring me a book about the stars!"],
  ["The water tank on our roof is leaking.","Ask a builder. Or figure it out yourself!"],["Monsters at the east gate last night!","The guards chased them off."],
  ["My cart's wheel broke on the stones.","Wood or iron, which wheel lasts longer?"],["The deep-dish pizza at the Taberna...","...is as tall as a cake!"],
  ["Why does the fountain never run dry?","I wonder where the water comes from."],["Nice weather today.","Perfect for a walk in the park."]];
function dynGossip(){const g=[];if(LAW.times>0)g.push(["Someone got locked in the Carcer!","Serves them right."]);if(LAW.wanted)g.push(["The guards are after someone!","Stay away from trouble."]);
  if(TRAIN.built)g.push(["The Palaestra is finished.","I hear the dummies shoot back!"]);if(BUILDINGS.some(b=>b.down))g.push(["A whole house came down!","Who would do such a thing?"]);
  if(MP.you)g.push([`That ${MP.you} is always out fighting monsters.`,"Brave, or a bit wild?"]);
  if(typeof MKT!=="undefined"){for(const [k,n] of Object.entries(MKT.news||{}))g.push([`Did you hear? ${n.text}`,n.dir>0?`I'm buying ${STOCKS[k].name} shares!`:`I'd sell ${STOCKS[k].name} if I were you.`]);
    const k=pick(Object.keys(STOCKS)),h=MKT.hist[k];if(h.length>1){const a=h[h.length-2],b=MKT.px[k];g.push([`${STOCKS[k].name} went from ${a} to ${b}. Is that a lot?`,`That's ${b>=a?"up":"down"} ${Math.abs(b-a)} — about ${Math.round(Math.abs(b-a)/a*100)} percent!`]);}}
  return g;}
function speechBubble(text){const c=document.createElement("canvas");c.width=512;c.height=150;const x=c.getContext("2d");x.font="600 30px system-ui,sans-serif";
  const words=text.split(" ");const lines=[""];words.forEach(w=>{const t=(lines[lines.length-1]+" "+w).trim();if(x.measureText(t).width>440&&lines[lines.length-1])lines.push(w);else lines[lines.length-1]=t;});
  const W=Math.min(490,Math.max(...lines.map(l=>x.measureText(l).width))+40),H=lines.length*36+24;x.fillStyle="rgba(255,255,255,.95)";x.beginPath();x.roundRect(256-W/2,4,W,H,18);x.fill();
  x.beginPath();x.moveTo(240,H+3);x.lineTo(256,H+22);x.lineTo(268,H+3);x.fill();x.fillStyle="#2a2620";x.textAlign="center";x.textBaseline="top";lines.forEach((l,i)=>x.fillText(l,256,16+i*36));
  const t=new THREE.CanvasTexture(c);if("colorSpace" in t)t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false,transparent:true}));s.scale.set(3.2,.94,1);s.renderOrder=11;return s;}
function say(cz,text,secs){if(text&&!WORLD.remote&&MP.ok&&npcLead()){const i=CITIZENS.indexOf(cz);if(i>=0&&Object.keys(MP.others).length)share({k:"say",i,t:String(text).slice(0,140),s:secs||0});}if(cz.bub){cz.o.g.remove(cz.bub);cz.bub.material.map.dispose();}cz.bub=null;if(!text)return;if(cz.o.g.position.distanceTo(P.pos)>30)return;
  cz.bub=speechBubble(text);cz.bub.position.y=2.75;cz.o.g.add(cz.bub);cz.bubT=secs||3.2;}
// walking only along the streets: to the nearest street, along it to a corner, then along the next street (like city blocks)
const onX=p=>CITY.XS.some(x=>Math.abs(p.x-x)<.05),onZ=p=>CITY.ZS.some(z=>Math.abs(p.z-z)<.05);
function snapStreet(p){let best=null,bd=1e9;CITY.XS.forEach(x=>{const q=new THREE.Vector3(x,0,clamp(p.z,CITY.z0+3,CITY.z1-3));const d=q.distanceTo(p);if(d<bd){bd=d;best=q;}});
  CITY.ZS.forEach(z=>{const q=new THREE.Vector3(clamp(p.x,CITY.x0+3,CITY.x1-3),0,z);const d=q.distanceTo(p);if(d<bd){bd=d;best=q;}});return best;}
function route(from,to){const A=snapStreet(from),B=snapStreet(to),r=[A];const near=(arr,v)=>arr.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a);
  const sameX=onX(A)&&onX(B)&&Math.abs(A.x-B.x)<.05,sameZ=onZ(A)&&onZ(B)&&Math.abs(A.z-B.z)<.05;
  if(!sameX&&!sameZ){if(onX(A)&&onZ(B))r.push(new THREE.Vector3(A.x,0,B.z));else if(onZ(A)&&onX(B))r.push(new THREE.Vector3(B.x,0,A.z));
    else if(onX(A)){const z=near(CITY.ZS,(A.z+B.z)/2);r.push(new THREE.Vector3(A.x,0,z),new THREE.Vector3(B.x,0,z));}
    else{const x=near(CITY.XS,(A.x+B.x)/2);r.push(new THREE.Vector3(x,0,A.z),new THREE.Vector3(x,0,B.z));}}
  r.push(B,to.clone());return r;}
// a walking map of the whole walled city: points every 2 m that aren't inside anything, joined to their neighbours. People take the
// shortest way along it, so they go round houses, stalls, walls and the creek (crossing at the footbridge) — old town and new city alike.
const NAV={x0:TOWN.x0+2,x1:CITY.x1-2,z0:TOWN.z0+2,z1:TOWN.z1-2,step:2,ok:null,cols:0,rows:0,open:[]};
{const N=NAV;N.cols=Math.floor((N.x1-N.x0)/N.step)+1;N.rows=Math.floor((N.z1-N.z0)/N.step)+1;N.ok=new Uint8Array(N.cols*N.rows);const solid=BLOCKS.filter(b=>!b.pass&&b.h>.3&&b.y<1.5);   // walls at ground level (upper floors are overhead)
  for(let r=0;r<N.rows;r++)for(let c=0;c<N.cols;c++){const x=N.x0+c*N.step,z=N.z0+r*N.step;let ok=!(x>122.4&&x<129.6&&z>-1.6&&z<13.6&&Math.abs(z-6)>.9);
    if(ok)for(const b of solid){if(Math.abs(x-b.x)<b.w/2+.7&&Math.abs(z-b.z)<b.d/2+.7){ok=false;break;}}N.ok[r*N.cols+c]=ok?1:0;if(ok)N.open.push(r*N.cols+c);}}
const navPt=k=>new THREE.Vector3(NAV.x0+(k%NAV.cols)*NAV.step,0,NAV.z0+Math.floor(k/NAV.cols)*NAV.step);
function navNode(p){const N=NAV;let c=Math.round((p.x-N.x0)/N.step),r=Math.round((p.z-N.z0)/N.step);c=clamp(c,0,N.cols-1);r=clamp(r,0,N.rows-1);if(N.ok[r*N.cols+c])return r*N.cols+c;
  for(let d=1;d<10;d++)for(let dr=-d;dr<=d;dr++)for(let dc=-d;dc<=d;dc++){if(Math.max(Math.abs(dr),Math.abs(dc))!==d)continue;const rr=r+dr,cc=c+dc;if(rr<0||cc<0||rr>=N.rows||cc>=N.cols)continue;if(N.ok[rr*N.cols+cc])return rr*N.cols+cc;}return -1;}
function navRoute(from,to){const N=NAV,a=navNode(from),b=navNode(to);if(a<0||b<0)return [to.clone()];const prev=new Int32Array(N.cols*N.rows).fill(-1);prev[a]=a;const q=[a];let qi=0;
  while(qi<q.length){const k=q[qi++];if(k===b)break;const r=Math.floor(k/N.cols),c=k%N.cols;
    for(const [dr,dc] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]){const rr=r+dr,cc=c+dc;if(rr<0||cc<0||rr>=N.rows||cc>=N.cols)continue;const kk=rr*N.cols+cc;if(prev[kk]>=0||!N.ok[kk])continue;
      if(dr&&dc&&(!N.ok[r*N.cols+cc]||!N.ok[rr*N.cols+c]))continue;prev[kk]=k;q.push(kk);}}
  if(prev[b]<0)return [to.clone()];const path=[];for(let k=b;k!==a;k=prev[k])path.push(navPt(k));path.reverse();path.push(to.clone());return path;}
const strollPoint=()=>navPt(NAV.open[Math.floor(RNG()*NAV.open.length)]);
// the old town has places to go too: Mercator's stall, the Popina, and the fountain square for a chat
SPOTS.shop.push({pos:new THREE.Vector3(2,0,10.4),face:0,name:"Mercator"},{pos:new THREE.Vector3(-16,0,12.4),face:0,name:"Popina"});
SPOTS.gossip.push({a:new THREE.Vector3(-15.5,0,1.4),b:new THREE.Vector3(-15.5,0,2.8),who:[]},{a:new THREE.Vector3(-12,0,-1.6),b:new THREE.Vector3(-10.6,0,-1.6),who:[]});
RNG=seedRnd(14);
const CITIZENS=[];
const TINTS=[0xffffff,0xffd8c8,0xd8e8ff,0xe8ffd8,0xfff0c8,0xf0d8ff,0xd8fff4];
CITIZEN_NAMES.forEach((name,i)=>{const start=i%3===2?strollPoint():pick(SPOTS.stroll).clone().add(new THREE.Vector3(rnd(-2,2),0,rnd(-2,2)));
  const o=npc(["villager.glb","cook.glb","merchant.glb"][i%3],start.x,start.z,rnd(0,6.3));const tint=new THREE.Color(TINTS[i%TINTS.length]),hat=i%2===0;
  const t=setInterval(()=>{if(!o.rig)return;clearInterval(t);o.rig.root.traverse(m=>{if(m.isMesh&&m.material&&m.material.color){m.material=m.material.clone();m.material.color.copy(tint);}
    if(/_Hat$/.test(m.name))m.visible=hat;if(m.name==="Mug")m.visible=false;});},400);
  const cz={name,o,st:"idle",t:rnd(0,4),path:[],goal:null,bub:null,bubT:0,food:null};cz.pp=personize(o,name);CITIZENS.push(cz);});
// guards for the city too: two at the east gate, two on patrol spots
[[CITY.x1-2.5,-9.5,-Math.PI/2],[CITY.x1-2.5,-.5,-Math.PI/2],[61,-1.2,0],[94,13.6,Math.PI]].forEach(([x,z,f])=>{
  const o=npc("guard.glb",x,z,f);const t=setInterval(()=>{if(!o.rig)return;clearInterval(t);o.rig.root.traverse(m=>{if(m.name==="1H_Sword"||m.name==="Round_Shield")m.visible=true;});},300);personize(o,"Guard",true);});
// Livia, Marcus, Felix and Octavia come out of their cottages and walk the town too (their ❗ quests go with them)
VILLAGERS.forEach(v=>{const cz={name:v.name,o:v.o,st:"idle",t:rnd(3,10),path:[],goal:null,bub:null,bubT:0,pp:PEOPLE.find(pp=>pp.o===v.o),villager:v};v.cz=cz;CITIZENS.push(cz);});
const npcLead=()=>{if(!MP.ok)return true;for(const id in MP.others)if(id<MP.id)return false;return true;};
const NPCNET={t:0,n:0,lead:true,last:[]};
const npcCode=cz=>cz.st==="walk"?(cz.fast?"f":"w"):cz.st==="do"&&cz.goal?(cz.goal.k==="eat"?"e"+(cz.foodK||""):cz.goal.k==="shop"?(cz.goal.s.biz?"b":"s"):"i"):"i";
// the player who leads sends where everyone is twice a second (only those who moved)
function npcSend(dt){NPCNET.t-=dt;if(NPCNET.t>0||!MP.ok||!Object.keys(MP.others).length)return;NPCNET.t=.5;const all=NPCNET.n++%8===0,out=[];
  CITIZENS.forEach((cz,i)=>{if(cz.pp.down)return;const p=cz.o.g.position,a=[i,R2(p.x),R2(p.z),R2(cz.o.g.rotation.y),npcCode(cz)],k=a.join();if(!all&&NPCNET.last[i]===k)return;NPCNET.last[i]=k;out.push(a);});
  for(let i=0;i<out.length;i+=12)share({k:"npc",l:out.slice(i,i+12)});}
function npcNet(a){const cz=CITIZENS[a[0]|0];if(!cz)return;if(!cz.net)citizenLeave(cz);const was=cz.net?cz.net.c:"";cz.net={x:+a[1]||0,z:+a[2]||0,ry:+a[3]||0,c:String(a[4]||"i")};
  if(cz.net.c!==was){const r=cz.o.rig;if(cz.food){scene.remove(cz.food);cz.food=null;}if((cz.net.c==="s"||cz.net.c==="b")&&r)r.full("Interact",{once:true,restart:true,dur:1.2,then:()=>r.clearFull()});if(cz.net.c==="b"&&BIZ.type)bizTry(cz);
    if(cz.net.c[0]==="e"&&/^e[a-z]+$/.test(cz.net.c)){cz.food=picSprite("food_"+cz.net.c.slice(1));cz.food.scale.setScalar(.38);const s=SPOTS.eat.find(s=>Math.hypot(s.pos.x-cz.net.x,s.pos.z-cz.net.z)<.6);cz.food.position.copy(s?s.plate:new THREE.Vector3(cz.net.x,1,cz.net.z)).add(new THREE.Vector3(0,.1,0));scene.add(cz.food);}}}
function npcFollow(cz,dt){const g=cz.o.g,r=cz.o.rig,n=cz.net;const dx=n.x-g.position.x,dz=n.z-g.position.z,d=Math.hypot(dx,dz);if(d>8){g.position.set(n.x,0,n.z);}else{const k=Math.min(1,dt*3.2);g.position.x+=dx*k;g.position.z+=dz*k;}
  let a=n.ry-g.rotation.y;a=Math.atan2(Math.sin(a),Math.cos(a));g.rotation.y+=a*Math.min(1,dt*8);const c=n.c[0];g.position.y=c==="e"?.02:0;if(r)r.base(c==="e"?"Sit_Chair_Idle":c==="w"||c==="f"?"Walking_A":"Idle",c==="f"?{speed:1.8}:undefined);}
function citizenNext(cz){const r=Math.random();cz.goal=null;
  if(r<.3&&SPOTS.eat.some(s=>!s.taken&&(!s.lot||s.lot.built))){const s=pick(SPOTS.eat.filter(s=>!s.taken&&(!s.lot||s.lot.built)));s.taken=cz;cz.goal={k:"eat",s};}
  else if(r<.55&&SPOTS.shop.length){cz.goal={k:"shop",s:pick(SPOTS.shop.filter(s=>!s.lot||s.lot.built))};}
  else if(r<.8){const g=SPOTS.gossip.find(g=>g.who.length===1)||pick(SPOTS.gossip.filter(g=>g.who.length<2));if(g){g.who.push(cz);cz.goal={k:"gossip",s:g};}}
  if(!cz.goal)cz.goal={k:"stroll",s:{pos:strollPoint()}};
  const to=cz.goal.k==="gossip"?(cz.goal.s.who[0]===cz?cz.goal.s.a:cz.goal.s.b):cz.goal.s.pos;cz.path=navRoute(cz.o.g.position,to);cz.st="walk";}
function citizenLeave(cz){const g=cz.goal;if(g){if(g.k==="eat"){g.s.taken=null;if(cz.food){scene.remove(cz.food);cz.food=null;}}if(g.k==="gossip")g.s.who=g.s.who.filter(x=>x!==cz);}cz.goal=null;cz.st="idle";cz.t=rnd(.5,2);}
function stepCity(dt){const near=P.pos.x>CITY.x0-30,lead=npcLead();
  if(lead&&!NPCNET.lead)CITIZENS.forEach(cz=>{if(cz.net){cz.net=null;cz.o.g.position.y=0;if(cz.food){scene.remove(cz.food);cz.food=null;}cz.st="idle";cz.t=rnd(.3,2);}});NPCNET.lead=lead;if(lead)npcSend(dt);VILLAGERS.forEach(v=>v.pos.copy(v.o.g.position));
  if(CITY.fountain&&near&&Math.random()<dt*25)SPARK.emit(CITY.fountain,new THREE.Vector3(rnd(-1,1),rnd(2,3),rnd(-1,1)),C(Math.random()<.5?0x9fdcff:0xffffff),.9,{grav:6});
  for(const cz of CITIZENS){const g=cz.o.g,r=cz.o.rig;
    if(cz.bub){cz.bubT-=dt;if(cz.bubT<=0)say(cz,null);}
    if(cz.pp.down){if(cz.st!=="down"){citizenLeave(cz);cz.st="down";say(cz,null);}continue;}
    if(cz.st==="down"){cz.st="idle";cz.t=1;}
    if(!lead){if(cz.pp.hp<cz.pp.max&&cz.hpSeen!==cz.pp.hp){cz.hpSeen=cz.pp.hp;share({k:"flee",i:CITIZENS.indexOf(cz),x:R2(P.pos.x),z:R2(P.pos.z),h:Math.round(cz.pp.hp)});}if(cz.net){npcFollow(cz,dt);continue;}}
    if((cz.pp.hp<cz.pp.max&&cz.hpSeen!==cz.pp.hp)||cz.fleeFrom){cz.hpSeen=cz.pp.hp;const scare=cz.fleeFrom||P.pos;cz.fleeFrom=null;if(cz.st!=="walk"||cz.goal&&cz.goal.k!=="flee"){citizenLeave(cz);say(cz,pick(["Ow! Guards! Help!","Hey! Stop that!","Leave me alone!"]),2.5);
      const away=g.position.clone().sub(scare);away.y=0;away.setLength(14);cz.goal={k:"flee"};cz.path=navRoute(g.position,g.position.clone().add(away));cz.st="walk";cz.fast=true;}}
    if(cz.st==="idle"){cz.t-=dt;if(r)r.base("Idle");if(cz.t<=0)citizenNext(cz);continue;}
    if(cz.st==="walk"){const to=cz.path[0];if(!to){cz.st="arrive";continue;}const v=to.clone().sub(g.position);v.y=0;const d=v.length(),sp=cz.fast?3.2:1.35;
      if(d<.12){cz.path.shift();continue;}g.position.addScaledVector(v.normalize(),Math.min(d,sp*dt));let a=Math.atan2(v.x,v.z)-g.rotation.y;a=Math.atan2(Math.sin(a),Math.cos(a));g.rotation.y+=a*Math.min(1,dt*8);
      if(r)r.base("Walking_A",{speed:cz.fast?1.8:1});continue;}
    const G0=cz.goal;
    if(cz.st==="arrive"){cz.fast=false;if(!G0||G0.k==="stroll"||G0.k==="flee"){citizenLeave(cz);continue;}
      if(G0.k==="eat"){g.position.copy(G0.s.pos);g.rotation.y=G0.s.face;if(r)r.base("Sit_Chair_Idle");g.position.y=.02;cz.t=rnd(14,24);cz.st="do";
        const f=pick(["pomum","panis","uvae","mel","puls","caseus","piscis"]);cz.foodK=f;cz.food=picSprite("food_"+f);cz.food.scale.setScalar(.38);cz.food.position.copy(G0.s.plate).add(new THREE.Vector3(0,.1,0));scene.add(cz.food);
        if(Math.random()<.5)say(cz,pick(["Mmm, delicious!","Best food in town.","I'm so hungry!","Waiter, more please!"]));}
      else if(G0.k==="shop"){g.rotation.y=G0.s.face;cz.t=rnd(4,7);cz.st="do";if(r)r.full("Interact",{once:true,restart:true,dur:1.2,then:()=>r.clearFull()});
        if(G0.s.biz){if(BIZ.type)bizTry(cz);else say(cz,"This shop is empty. Someone should open a business here!",3);}
        else say(cz,pick(["One loaf of bread, please.","How much is this?","I'll take two!","Do you have anything cheaper?","Just looking, thanks."]));}
      else if(G0.k==="gossip"){const s=G0.s;cz.st="do";cz.t=30;g.position.copy(s.who[0]===cz?s.a:s.b);
        if(s.who.length===2&&s.who.every(x=>x.st==="do")){const [a,b]=s.who;a.o.g.lookAt(b.o.g.position.x,0,b.o.g.position.z);b.o.g.lookAt(a.o.g.position.x,0,a.o.g.position.z);
          const conv=pick([...GOSSIP,...dynGossip()]);a.t=b.t=rnd(9,13);say(a,conv[0],3.4);setTimeout(()=>{if(b.st==="do"&&b.goal===G0)say(b,conv[1],3.4);},3600);
          setTimeout(()=>{if(a.st==="do"&&a.goal===G0&&Math.random()<.6)say(a,pick(["Really?!","No way!","Ha ha!","I knew it.","Tell me more!"]),2.4);},7400);}}
      continue;}
    if(cz.st==="do"){cz.t-=dt;if(r&&!(G0&&G0.k==="eat"))r.base("Idle");if(cz.t<=0){g.position.y=0;citizenLeave(cz);}}}}

// ---------------- the town's problems (scenarios.js: 51 of them; design.js runs the notebook, the workbench and the tests) ----------------
// Each belongs to someone in town. They grumble about it (speech bubbles) and have a "?" over their head; walk up and press T to ask.
// P (or the Projects button) lists every problem you've heard about, so you can work on it anywhere. Solved = they pay you.
// the creek through the park (decoration now — people just walk round it), with a little plank footbridge
{const water=new THREE.Mesh(new THREE.PlaneGeometry(6,14.6),new THREE.MeshLambertMaterial({color:0x4f8fc8,transparent:true,opacity:.92}));water.rotation.x=-Math.PI/2;water.position.set(126,.03,6);scene.add(water);
  [123,129].forEach(x=>{const b=new THREE.Mesh(new THREE.BoxGeometry(.5,.25,14.6),LOOK.toon(0x7a6a52));b.position.set(x,.12,6);scene.add(b);});
  const deck=LOOK.M(new THREE.BoxGeometry(7.2,.14,1.6),LOOK.toon(0x8a5a2e),.012);deck.position.set(126,.32,6);scene.add(deck);
  [-1,1].forEach(k=>{const r=LOOK.M(new THREE.BoxGeometry(7.2,.08,.08),LOOK.toon(0x6b4423),.01);r.position.set(126,1.1,6+k*.75);scene.add(r);for(let i=0;i<5;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(.08,.8,.08),LOOK.toon(0x6b4423));p.position.set(123+i*1.5,.7,6+k*.75);scene.add(p);}});}
// Magistra Cornelia at the Schola's door; Varro at the Bibliotheca's
const TEACHER=npc("villager.glb",102.3,19.6,Math.PI);{const t=setInterval(()=>{if(!TEACHER.rig)return;clearInterval(t);TEACHER.rig.root.traverse(m=>{if(m.isMesh&&m.material&&m.material.color){m.material=m.material.clone();m.material.color.set(0xe8d8ff);}});},400);
  const lb=label("Magistra Cornelia",0xffffff);lb.scale.set(2.4,.36,1);lb.position.y=2.4;TEACHER.g.add(lb);TEACHER.pp=personize(TEACHER,"Cornelia");}
const LIBRARIAN=npc("merchant.glb",80.6,19.6,Math.PI);{const t=setInterval(()=>{if(!LIBRARIAN.rig)return;clearInterval(t);LIBRARIAN.rig.root.traverse(m=>{if(m.name==="Mug")m.visible=false;if(m.isMesh&&m.material&&m.material.color){m.material=m.material.clone();m.material.color.set(0xdfe8ff);}});},400);
  const lb=label("Varro the librarian",0xffffff);lb.scale.set(2.4,.36,1);lb.position.y=2.4;LIBRARIAN.g.add(lb);LIBRARIAN.pp=personize(LIBRARIAN,"Varro");}
function uiOpen(fn){if(!started||P.down)return;G.firing=false;if(document.exitPointerLock)document.exitPointerLock();fn({grade:MATH.lv,pay:(n,why)=>{COINS+=n;coinHud();lawSay(`+${n} denarii ${why}`);},onClose:()=>hud(),onSolved:problemSolved});}
libraryInside(LIBRARY);schoolInside(SCHOOL);   // walk in: the shelves, the computer, the desks
// who's who: everyone who can own a problem, wherever they are right now
function personNamed(n){const c=CITIZENS.find(c=>c.name===n);if(c)return c;const v=VILLAGERS.find(v=>v.name===n);if(v)return v.cz;
  const fixed={Polina:COOK.pp&&COOK.pp.o,Mercator:MERCHANT.o,Varro:LIBRARIAN,Cornelia:TEACHER}[n];if(!fixed)return null;return fixed.cz||(fixed.cz={name:n,o:fixed,pp:fixed.pp||PEOPLE.find(pp=>pp.o===fixed),bub:null,bubT:0,fixed:true});}
const PROB_OF=name=>window.SCENARIOS.list.filter(sc=>sc.owner===name);
const nextProblem=name=>PROB_OF(name).find(sc=>!DESIGN.solved(sc.id))||null;
const ASK={pos:new THREE.Vector3(),who:null,sc:null};
ACTS.push({pos:ASK.pos,r:2.8,label:()=>ASK.sc?(DESIGN.asked(ASK.sc.id)?`${ASK.who.name}: ${ASK.sc.title}`:`Ask ${ASK.who.name} about it`):"",hidden:()=>!ASK.sc,
  run:()=>uiOpen(o=>DESIGN.openProblem(ASK.sc.id,Object.assign(o,{at:"owner"})))});
function problemSolved(sc,lv,first){const pay=25*(lv+1);COINS+=pay;coinHud();const p=personNamed(sc.owner);if(p&&p.o.rig)p.o.rig.full("Cheer",{once:true,restart:true,dur:1.4,then:()=>p.o.rig.clearFull()});
  lawSay(`${sc.owner} paid you ${pay} denarii — "${sc.title}" is solved!`);}
const QMARK={},_wp=new THREE.Vector3();
function stepProblems(dt){let best=null,bd=2.8;
  for(const sc of window.SCENARIOS.list){const p=personNamed(sc.owner);if(!p||!p.o||!p.o.g)continue;const g=p.o.g;const wp=g.getWorldPosition(_wp);const open=nextProblem(sc.owner)===sc;
    if(!open)continue;const asked=DESIGN.asked(sc.id)>=3;let q=QMARK[sc.owner];if(!q){q=QMARK[sc.owner]=label("?",0xffd84a);q.scale.set(.9,.7,1);q.position.y=3.5;g.add(q);}q.visible=!asked&&!(p.pp&&p.pp.down);
    const d=Math.hypot(wp.x-P.pos.x,wp.z-P.pos.z);if(d<bd&&!(p.pp&&p.pp.down)&&!(p.villager&&asked)){bd=d;best={p,sc,x:wp.x,z:wp.z};}   // a villager's own ❗ quest comes back once you've asked about their problem
    if(p.fixed){if(p.bub){p.bubT-=dt;if(p.bubT<=0)say(p,null);}}
    if(d<16&&!asked&&!p.bub&&Math.random()<dt*.12)say(p,sc.says,3.6);}
  for(const n in QMARK){const sc=nextProblem(n);if(!sc)QMARK[n].visible=false;}
  ASK.who=best&&best.p;ASK.sc=best&&best.sc;if(best){ASK.pos.set(best.x,0,best.z);const t=P.pos.clone().sub(ASK.pos);t.y=0;if(t.length()>.01)ASK.pos.addScaledVector(t.normalize(),.25);}}
addEventListener("keydown",e=>{if(e.target&&e.target.matches&&e.target.matches("input,textarea"))return;if(e.code==="KeyP"&&started&&!bagOpen&&!designOpen())toggleBag(true,"orders");});
// ---------------- the job board in the plaza (2026-11-22, "more jobs to do"): small paid jobs around the city, one at a time ----------------
const JOB={cur:null,done:0,board:new THREE.Vector3(63.5,0,10.4),marks:[]};
{const g=new THREE.Group();g.position.set(63.5,0,11.6);scene.add(g);const wood=LOOK.toon(0x6b4423);[-1,1].forEach(k=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.12,2.2,.12),wood);p.position.set(k*1,1.1,0);g.add(p);});
  const bd=LOOK.M(new THREE.BoxGeometry(2.2,1.2,.1),LOOK.toon(0xc9a37a),.015);bd.position.y=1.6;g.add(bd);for(let i=0;i<5;i++){const n=new THREE.Mesh(new THREE.PlaneGeometry(.38,.48),new THREE.MeshLambertMaterial({color:0xf6f0e0}));n.position.set(-.8+i*.4,1.6+(i%2?.15:-.15),-.06);n.rotation.y=Math.PI;g.add(n);}
  const s2=signBoard("Job board",0xffe08a);s2.scale.setScalar(.7);s2.position.set(0,2.45,-.06);s2.rotation.y=Math.PI;g.add(s2);g.traverse(k=>{if(k.isMesh)k.castShadow=true;});}
ACTS.push({pos:JOB.board,r:2.4,label:"Job board",run:()=>toggleBag(true,"jobs")});
const JOB_TYPES={courier:{name:"Courier",pay:12,what:"Take a parcel to someone in town. They don't stand still — find them!"},sweep:{name:"Street sweeper",pay:10,what:"Pick up 8 pieces of litter around the city."},
  patrol:{name:"Guard patrol",pay:14,what:"Walk to all four corners of the city walls."},count:{name:"Shop helper",pay:10,what:"Help a shopkeeper count their stock — a math problem."}};
function jobClear(){JOB.marks.forEach(m=>{if(m.parent)m.parent.remove(m);});JOB.marks=[];JOB.cur=null;}
function jobStart(k){jobClear();const j={k,pay:JOB_TYPES[k].pay};
  if(k==="courier"){const c=pick(CITIZENS.filter(c=>!c.villager));j.to=c.name;const m=label("!",0x9dffb0);m.scale.set(.8,.7,1);m.position.y=3.9;c.o.g.add(m);JOB.marks.push(m);}
  if(k==="sweep"){j.left=[];const pts=NAV.open.map(navPt).filter(p=>p.x>CITY.x0+2);for(let i=0;i<8;i++){const p=pick(pts);const m=new THREE.Mesh(new THREE.BoxGeometry(.32,.04,.24),new THREE.MeshLambertMaterial({color:0xf2eee0}));m.position.set(p.x+rnd(-.6,.6),.03,p.z+rnd(-.6,.6));m.rotation.y=rnd(0,3);scene.add(m);JOB.marks.push(m);j.left.push(m);}}
  if(k==="patrol"){j.left=[[TOWN.x0+4,TOWN.z0+4],[TOWN.x0+4,TOWN.z1-4],[CITY.x1-4,CITY.z0+4],[CITY.x1-4,CITY.z1-4]].map(([x0,z0])=>{const q=navPt(navNode(new THREE.Vector3(x0,0,z0))),x=q.x,z=q.z;const m=new THREE.Mesh(new THREE.RingGeometry(1.2,1.5,32),new THREE.MeshBasicMaterial({color:0x9dffb0,transparent:true,opacity:.8,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(x,.06,z);scene.add(m);JOB.marks.push(m);return m;});}
  if(k==="count"){j.n=ri(6,48);j.q=CRAFT.problem(j.n,MATH.lv)||`A shelf has ${j.n} jars. How many jars are there?`;j.tries=2;}
  JOB.cur=j;}
function jobPay(){const j=JOB.cur;if(!j)return;COINS+=j.pay;coinHud();JOB.done++;lawSay(`Job done — +${j.pay} denarii!`);jobClear();}
const JOB_ACT={pos:new THREE.Vector3(),on:false};
ACTS.push({pos:JOB_ACT.pos,r:2.4,label:()=>JOB.cur&&JOB.cur.k==="courier"?`Give ${JOB.cur.to} the parcel`:"",hidden:()=>!JOB_ACT.on,run:()=>{lawSay(`${JOB.cur.to}: “Oh, a parcel for me? Thank you!”`);jobPay();}});
function stepJobs(){const j=JOB.cur;JOB_ACT.on=false;if(!j)return;
  if(j.k==="courier"){const c=CITIZENS.find(c=>c.name===j.to);if(c){const d=Math.hypot(c.o.g.position.x-P.pos.x,c.o.g.position.z-P.pos.z);if(d<2.4){JOB_ACT.on=true;JOB_ACT.pos.set(c.o.g.position.x,0,c.o.g.position.z);const t=P.pos.clone().sub(JOB_ACT.pos);t.y=0;if(t.length()>.01)JOB_ACT.pos.addScaledVector(t.normalize(),Math.min(.6,t.length()));}}}
  if(j.k==="sweep"){for(const m of [...j.left]){if(Math.hypot(m.position.x-P.pos.x,m.position.z-P.pos.z)<1.3){scene.remove(m);j.left.splice(j.left.indexOf(m),1);popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),`litter ${8-j.left.length}/8`,"spell");}}if(!j.left.length)jobPay();}
  if(j.k==="patrol"){for(const m of [...j.left]){m.rotation.z+=.02;if(Math.hypot(m.position.x-P.pos.x,m.position.z-P.pos.z)<2.2){scene.remove(m);j.left.splice(j.left.indexOf(m),1);popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),`checkpoint ${4-j.left.length}/4`,"spell");}}if(!j.left.length)jobPay();}}
const jobLine=()=>{const j=JOB.cur;if(!j)return "";return `<div>${esc(JOB_TYPES[j.k].name)}: ${j.k==="courier"?"take the parcel to "+esc(j.to):j.k==="sweep"?`litter ${8-j.left.length}/8`:j.k==="patrol"?`checkpoints ${4-j.left.length}/4`:"answer at the job board"}</div>`;};
function jobsTab(box){const j=JOB.cur;let h=`<p class="purse">🪙 <b>${COINS}</b> denarii · ${JOB.done} jobs done</p>`;
  if(P.pos.distanceTo(JOB.board)>4&&!j){box.innerHTML=h+`<p class="tip">The job board is in the plaza of Nova Urbs.</p>`;return;}
  if(!j){h+=`<p class="tip">Pick a job. One at a time — you get paid when it's done.</p><div class="list">`;for(const [k,t] of Object.entries(JOB_TYPES))h+=`<button data-job="${k}"><span>${esc(t.name)} <small>${esc(t.what)}</small></span><b>${t.pay} 🪙</b></button>`;box.innerHTML=h+`</div>`;return;}
  if(j.k==="count"){h+=`<p class="say">${esc(j.q)}</p><div class="answer"><input id="jobAns" type="number" inputmode="numeric"><button id="jobGo">Answer</button></div><p class="msg">${esc(j.msg||"")}</p>`;}
  else h+=`<p class="tip">Your job: ${esc(JOB_TYPES[j.k].name)} — ${esc(JOB_TYPES[j.k].what)}</p>${jobLine()}`;
  box.innerHTML=h+`<button data-jobquit="1">Give up this job</button>`;}
function jobClick(t){if(t.dataset.job){jobStart(t.dataset.job);if(JOB.cur.k!=="count")toggleBag(false);else renderBag();return true;}
  if(t.dataset.jobquit){jobClear();renderBag();return true;}
  if(t.id==="jobGo"){const j=JOB.cur,v=parseInt(($("#jobAns")||{}).value,10);if(!j)return true;if(v===j.n){toggleBag(false);jobPay();return true;}j.tries--;if(j.tries<=0){j.msg="Not quite — the shopkeeper counted it themselves. Try another job.";jobClear();}else j.msg="Not quite — count again.";renderBag();return true;}return false;}
// ---------------- the stock market (2026-11-22, "can you predict the stock market? you gain or lose every day") ----------------
// Crassus the banker has a booth in the plaza with a price board. Four town companies; every new day (dawn) their prices move — a bit of
// trend, a bit of luck, and the morning news (which hints at tomorrow). Buy and sell shares; your money goes up or down each day.
// Predict tomorrow (up or down) for a reward. Crassus asks math questions about the prices: percent change, profit, averages.
const STOCKS={bake:{name:"Pistrinum Bakery",vol:.03,drift:.004,p:20},mine:{name:"Ferrum Mines",vol:.07,drift:.003,p:35},ship:{name:"Navis Shipping",vol:.11,drift:.002,p:50},oil:{name:"Olea Oil",vol:.05,drift:.003,p:28}};
const NEWS={bake:[["Wheat harvest is huge this year — bread will be cheap to make.",1],["Mice got into the flour stores!",-1],["A festival is coming — everyone wants cakes.",1],["People say the new Thermopolium bakes better bread.",-1]],
  mine:[["Miners found a new crystal vein in Caverna!",1],["A tunnel collapsed in the mines.",-1],["The forge wants more iron than ever.",1],["Cave monsters scared the miners away.",-1]],
  ship:[["A big storm is coming at sea.",-1],["A ship came home loaded with spices!",1],["Pirates were seen near the coast.",-1],["New trade route opened to the east.",1]],
  oil:[["The olive trees are full of fruit.",1],["Frost hurt the olive groves.",-1],["Lamps everywhere need oil for the long nights.",1],["A rival oil press opened in the next town.",-1]]};
// one market for everyone (2026-11-22): the day number comes from the shared clock, and each day's news and price moves come from that
// number, so every player sees the same prices. What you own, your predictions and your questions are yours (saved on this device).
const CLOCK={len:480,epoch:Date.UTC(2026,10,20),offset:0};const worldDay=()=>Math.floor((Date.now()-CLOCK.epoch)/1000/CLOCK.len+CLOCK.offset/CLOCK.len);   // offset: tests only
const seeded=(a,b)=>{let h=(a*73856093)^(b*19349663)^0x5bd1e995;h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);h^=h>>>16;return (h>>>0)/4294967296;};
const KI={bake:1,mine:2,ship:3,oil:4};
function newsFor(d,k){if(seeded(d,KI[k]*7+1)>=.65)return null;const L=NEWS[k],n=L[Math.floor(seeded(d,KI[k]*7+2)*L.length)];return {text:n[0],dir:n[1]};}
const PXC={day:0,px:null,hist:null};
function pricesAt(day){if(!PXC.px||PXC.day>day){PXC.day=0;PXC.px={};PXC.hist={};for(const k in STOCKS){PXC.px[k]=STOCKS[k].p;PXC.hist[k]=[STOCKS[k].p];}}
  while(PXC.day<day){const d=PXC.day+1;for(const k in STOCKS){const S=STOCKS[k],n=newsFor(d-1,k),px=PXC.px[k];let ch=S.drift+(seeded(d,KI[k]*7+3)*2-1)*S.vol-.1*Math.log(px/S.p);   // a pull back toward the usual price, so nothing runs away forever
      if(n)ch+=n.dir*S.vol*(seeded(d,KI[k]*7+4)<.8?1.1:-.4);const np=Math.max(2,Math.round(px*(1+ch)));PXC.px[k]=np;PXC.hist[k].push(np);if(PXC.hist[k].length>12)PXC.hist[k].shift();}PXC.day=d;}return PXC;}
let MKT;try{MKT=JSON.parse(localStorage.getItem("elementum.market")||"null");}catch(e){MKT=null;}
MKT=Object.assign({own:{},cost:{},pred:null,q:null,stats:{right:0,wrong:0}},MKT||{});for(const k in STOCKS){MKT.own[k]=MKT.own[k]||0;MKT.cost[k]=MKT.cost[k]||0;}
const mktSave=()=>{try{const {own,cost,pred,q,stats}=MKT;localStorage.setItem("elementum.market",JSON.stringify({own,cost,pred,q,stats}));}catch(e){}};
function mktSync(){const d=worldDay();pricesAt(d);MKT.day=d;MKT.px=Object.assign({},PXC.px);MKT.hist={};for(const k in STOCKS)MKT.hist[k]=PXC.hist[k].slice();MKT.news={};for(const k in STOCKS){const n=newsFor(d,k);if(n)MKT.news[k]=n;}}
mktSync();
const mktWorth=()=>Object.keys(STOCKS).reduce((a,k)=>a+MKT.own[k]*MKT.px[k],0);
// settle a prediction once its day is over: was the price higher or lower than when you predicted?
function mktSettle(){const pr=MKT.pred;if(!pr||MKT.day<=pr.day)return "";const now=MKT.px[pr.k],ok=now!==pr.p&&(now>pr.p)===(pr.dir>0);MKT.pred=null;
  if(ok){COINS+=10;coinHud();MKT.stats.right++;return ` Your prediction for ${STOCKS[pr.k].name} was right: +10!`;}MKT.stats.wrong++;return ` Your prediction for ${STOCKS[pr.k].name} was wrong.`;}
mktSettle();
// a new day (for everyone at once): prices move, today's news comes out
function marketDay(){const before=mktWorth();mktSync();const pmsg=mktSettle();const after=mktWorth(),d=after-before;mktSave();drawBoard();MKT.q=null;
  if(before>0||pmsg)lawSay(`Market: your shares ${d>=0?"gained":"lost"} ${Math.abs(d)} denarii today (now worth ${after}).${pmsg}`);}
// Crassus's math questions about the prices — answer right for a coin or two
function mktQuestion(){const ks=Object.keys(STOCKS),k=pick(ks),h=MKT.hist[k],a=h.length>1?h[h.length-2]:Math.round(h[0]*.9),b=MKT.px[k],nm=STOCKS[k].name;const r=Math.random();
  if(r<.3){const pct=a===b?0:Math.round((b-a)/a*1000)/10;return {q:`${nm} was ${a} yesterday and is ${b} today. By what percent did it ${b>=a?"go up":"go down"}? (round to one decimal)`,a:Math.abs(pct),tol:.15};}
  if(r<.55){const n=ri(2,9),buy=Math.max(2,b+ri(-6,6));return {q:`You bought ${n} shares of ${nm} at ${buy} each. Now they're worth ${b} each. How much did you ${b>=buy?"gain":"lose"} in total?`,a:Math.abs(n*(b-buy)),tol:0};}
  if(r<.8&&h.length>=3){const l=h.slice(-3);const avg=Math.round((l[0]+l[1]+l[2])/3*10)/10;return {q:`The last three prices of ${nm} were ${l.join(", ")}. What is their average? (round to one decimal)`,a:avg,tol:.15};}
  const n=ri(3,15);return {q:`How much are ${n} shares of ${nm} worth at today's price of ${b}?`,a:n*b,tol:0};}
// the booth, the board (a canvas that's redrawn each day) and Crassus
const MKT_AT=new THREE.Vector3(57.5,0,10.6);let boardTex=null;
function drawBoard(){if(!boardTex)return;const c=boardTex.image,x=c.getContext("2d");x.fillStyle="#1a2a22";x.fillRect(0,0,c.width,c.height);x.fillStyle="#ffe08a";x.font="700 30px Georgia,serif";x.fillText(`Bursa — day ${MKT.day+1}`,16,36);
  Object.entries(STOCKS).forEach(([k,S],i)=>{const h=MKT.hist[k],p=MKT.px[k],prev=h.length>1?h[h.length-2]:p,up=p>=prev;const y=74+i*44;x.fillStyle="#f0ece0";x.font="600 22px system-ui";x.fillText(S.name,16,y);
    x.fillStyle=up?"#7fe08a":"#ff8a7a";x.fillText(`${p} ${up?"▲":"▼"}${Math.abs(p-prev)}`,300,y);x.strokeStyle=up?"#7fe08a":"#ff8a7a";x.lineWidth=2;x.beginPath();const mn=Math.min(...h),mx=Math.max(...h);
    h.forEach((v,j)=>{const px=410+j*8,py=y-4-(mx>mn?(v-mn)/(mx-mn):.5)*22;j?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();});boardTex.needsUpdate=true;}
{const g=new THREE.Group();g.position.set(57.5,0,11.9);scene.add(g);const wood=LOOK.toon(0x5a3a22);const c=LOOK.M(new THREE.BoxGeometry(2.6,1,.7),LOOK.toon(0x6b4423),.02);c.position.y=.5;g.add(c);
  [[-1.3,0],[1.3,0]].forEach(([a])=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.12,3.2,.12),wood);p.position.set(a,1.6,.3);g.add(p);});
  const cv=document.createElement("canvas");cv.width=520;cv.height=250;boardTex=new THREE.CanvasTexture(cv);if("colorSpace" in boardTex)boardTex.colorSpace=THREE.SRGBColorSpace;
  const bd=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.25),new THREE.MeshBasicMaterial({map:boardTex}));bd.position.set(0,2.6,.36);bd.rotation.y=Math.PI;g.add(bd);drawBoard();
  const sg=signBoard("Bursa — the stock market",0xffe08a);sg.scale.setScalar(.6);sg.position.set(0,3.45,.36);sg.rotation.y=Math.PI;g.add(sg);g.traverse(k=>{if(k.isMesh)k.castShadow=true;});
  {const m=block(57.5,11.9,2.6,1,.7,0x6b4423);m.material.visible=false;m.castShadow=false;}
  const o=npc("merchant.glb",57.5,12.7,Math.PI);const lb=label("Crassus the banker",0xffffff);lb.scale.set(2.2,.34,1);lb.position.y=2.35;o.g.add(lb);const t=setInterval(()=>{if(!o.rig)return;clearInterval(t);o.rig.root.traverse(m=>{if(m.name==="Mug")m.visible=false;if(m.isMesh&&m.material&&m.material.color){m.material=m.material.clone();m.material.color.set(0xd8d0f0);}});},400);
  MKT.npc=personize(o,"Crassus");}
ACTS.push({pos:MKT_AT,r:2.4,label:"Bursa — trade stocks with Crassus",hidden:()=>MKT.npc&&MKT.npc.down,run:()=>toggleBag(true,"stocks")});
function stocksTab(box){let h=`<p class="purse">🪙 <b>${COINS}</b> denarii · your shares are worth <b>${mktWorth()}</b></p>`;if(P.pos.distanceTo(MKT_AT)>4){box.innerHTML=h+`<p class="tip">Crassus's booth is in the plaza of Nova Urbs.</p>`;return;}
  h+=`<p class="tip">Prices change every new day (dawn). Buy low, sell high — or lose money if you guess wrong. The news below hints at tomorrow.</p><table class="biz"><tr><th style="text-align:left">Company</th><th>Price</th><th>Change</th><th>You own</th><th>You paid</th><th></th></tr>`;
  for(const [k,S] of Object.entries(STOCKS)){const hh=MKT.hist[k],p=MKT.px[k],prev=hh.length>1?hh[hh.length-2]:p;
    h+=`<tr><td style="text-align:left">${esc(S.name)}</td><td>${p}</td><td class="${p<prev?"neg":""}">${p>=prev?"+":""}${p-prev}</td><td>${MKT.own[k]}</td><td>${MKT.cost[k]}</td><td><button data-mbuy="${k}">Buy 1</button> <button data-mbuy5="${k}">Buy 5</button> <button data-msell="${k}" ${MKT.own[k]?"":"disabled"}>Sell 1</button> <button data-msellall="${k}" ${MKT.own[k]?"":"disabled"}>Sell all</button></td></tr>`;}
  h+=`</table><h3>Morning news</h3>${Object.keys(MKT.news).length?Object.entries(MKT.news).map(([k,n])=>`<p class="tip">${esc(STOCKS[k].name)}: “${esc(n.text)}”</p>`).join(""):`<p class="tip">A quiet day — no news.</p>`}`;
  h+=`<h3>Predict tomorrow</h3>${MKT.pred?`<p class="tip">You predicted ${esc(STOCKS[MKT.pred.k].name)} will go ${MKT.pred.dir>0?"up":"down"}. We'll see tomorrow!</p>`:`<p class="tip">Right = +10 denarii. ${MKT.stats.right} right, ${MKT.stats.wrong} wrong so far.</p><div class="shelf">${Object.entries(STOCKS).map(([k,S])=>`<button data-mpred="${k}:1">${esc(S.name)} up</button><button data-mpred="${k}:-1">down</button>`).join("")}</div>`}`;
  if(!MKT.q)MKT.q=mktQuestion();h+=`<h3>Crassus asks</h3><p class="say">${esc(MKT.q.q)}</p><div class="answer"><input id="mAns" type="number" step="0.1" inputmode="decimal"><button id="mGo">Answer</button></div>`;
  box.innerHTML=h+`<p class="msg ${forgeOk?"ok":""}">${esc(forgeMsg)}</p>`;}
function stocksClick(t){const d=t.dataset;
  if(d.mbuy||d.mbuy5){const k=d.mbuy||d.mbuy5,n=d.mbuy5?5:1,c=n*MKT.px[k];if(COINS<c){forgeOk=false;forgeMsg=`${n} share${n>1?"s":""} cost${n>1?"":"s"} ${c} — you have ${COINS}.`;}else{COINS-=c;coinHud();MKT.own[k]+=n;MKT.cost[k]+=c;forgeOk=true;forgeMsg=`Bought ${n} share${n>1?"s":""} of ${STOCKS[k].name} for ${c}.`;mktSave();}renderBag();return true;}
  if(d.msell||d.msellall){const k=d.msell||d.msellall,n=d.msellall?MKT.own[k]:1;if(!n)return true;const v=n*MKT.px[k],paid=Math.round(MKT.cost[k]*n/MKT.own[k]);COINS+=v;coinHud();MKT.cost[k]-=paid;MKT.own[k]-=n;forgeOk=v>=paid;forgeMsg=`Sold ${n} for ${v} (you paid ${paid}): ${v>=paid?"profit":"loss"} of ${Math.abs(v-paid)}.`;mktSave();renderBag();return true;}
  if(d.mpred){const [k,dir]=d.mpred.split(":");MKT.pred={k,dir:+dir,day:MKT.day,p:MKT.px[k]};mktSave();forgeOk=true;forgeMsg="Prediction made — come back tomorrow!";renderBag();return true;}
  if(t.id==="mGo"){const v=parseFloat(($("#mAns")||{}).value);const q=MKT.q;if(!q||isNaN(v))return true;if(Math.abs(v-q.a)<=q.tol+1e-9){COINS+=3;coinHud();forgeOk=true;forgeMsg="“Exactly right!” Crassus tips you 3 denarii.";mathRight();}else{forgeOk=false;forgeMsg=`“Not quite — it's ${q.a}.”`;mathWrong();}MKT.q=null;mktSave();renderBag();return true;}return false;}
// ---------------- cars and the gas station (2026-11-22, "add cars") ----------------
// Walk up to a car and press T to get in. W/S (or the stick) to drive and reverse, A/D to steer, Space to brake, T to get out.
// Cars use fuel; fill up at the gas station outside the east gate. Crash into a wall and you bounce off; hit someone and it hurts them
// (and in town the guards come for you).
const CARS=[];
// a car you built: your own design, its front (the side facing you at the workbench, −z) forward, the wheels turn
function makeCarOf(parts,x,z,yaw,color,remote){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=yaw;scene.add(g);const m=furnitureMesh(parts);m.rotation.y=Math.PI;g.add(m);const wheels=[],inner=m.children[0];
  inner.children.slice().forEach(w=>{const p=w.userData.part;if(!p||p.shape!=="cylinder"||Math.abs(Math.abs(p.rz||0)-90)>3||Math.abs(p.rx||0)>3||Math.abs(p.ry||0)>3)return;const b=new THREE.Group();b.position.copy(w.position);const s=new THREE.Group();b.add(s);inner.remove(w);w.position.set(0,0,0);s.add(w);inner.add(b);wheels.push(b);});
  g.traverse(k=>{if(k.isMesh)k.castShadow=true;});const car={g,wheels,speed:0,yaw,fuel:60,max:80,spin:0,hitCool:new Map(),color,parts,home0:{x,z,yaw,f:60}};if(!remote)CARS.push(car);return car;}
function makeCar(x,z,yaw,color,remote){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=yaw;scene.add(g);const paint=LOOK.toon(color),dark=LOOK.toon(0x222228);
  const body=LOOK.M(new THREE.BoxGeometry(2,.62,4.2),paint,.02);body.position.y=.62;g.add(body);
  const cab=LOOK.M(new THREE.BoxGeometry(1.76,.62,2.1),paint,.02);cab.position.set(0,1.24,-.25);g.add(cab);
  const glass=new THREE.MeshLambertMaterial({color:0x3a5a7a});[[0,1.24,.82,1.6,.5,.05],[0,1.24,-1.31,1.6,.5,.05],[.89,1.24,-.25,.05,.5,1.9],[-.89,1.24,-.25,.05,.5,1.9]].forEach(([a,b,c,w,h,d])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),glass);m.position.set(a,b,c);g.add(m);});
  [-.65,.65].forEach(a=>{const hl=new THREE.Mesh(new THREE.BoxGeometry(.34,.16,.05),new THREE.MeshBasicMaterial({color:0xfff2c0}));hl.position.set(a,.7,2.11);g.add(hl);const tl=new THREE.Mesh(new THREE.BoxGeometry(.34,.14,.05),new THREE.MeshBasicMaterial({color:0xd02020}));tl.position.set(a,.7,-2.11);g.add(tl);});
  const bump=LOOK.M(new THREE.BoxGeometry(2.05,.22,.2),dark,.01);bump.position.set(0,.36,2.15);g.add(bump);const bump2=bump.clone();bump2.position.z=-2.15;g.add(bump2);
  const wheels=[];[[.98,1.35],[-.98,1.35],[.98,-1.35],[-.98,-1.35]].forEach(([a,c])=>{const w=new THREE.Group();w.position.set(a,.38,c);const t=LOOK.M(new THREE.CylinderGeometry(.38,.38,.28,14),dark,.01);t.rotation.z=Math.PI/2;w.add(t);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.3,10),LOOK.toon(0xb8bcc4));hub.rotation.z=Math.PI/2;w.add(hub);g.add(w);wheels.push(w);});
  g.traverse(k=>{if(k.isMesh)k.castShadow=true;});const car={g,wheels,speed:0,yaw,fuel:60,max:80,spin:0,hitCool:new Map(),color,home0:{x,z,yaw,f:60}};if(!remote)CARS.push(car);return car;}
// parking along the city's main street, and two at the gas station
[[52,-6.6,Math.PI/2,0xc8432f],[70,-3.4,-Math.PI/2,0x3f6fa8],[100,-6.6,Math.PI/2,0xe8c040],[118,-3.4,-Math.PI/2,0x2f8a5a],[86,-6.6,Math.PI/2,0xf0f0f0]].forEach(a=>makeCar(...a));
// the gas station outside the east gate: a canopy, two pumps, a little shop
const GAS={pumps:[new THREE.Vector3(143,0,-17),new THREE.Vector3(149,0,-17)],price:4};
{const x=146,z=-17,steel=LOOK.toon(0xd8dce2),red=LOOK.toon(0xc8302a);const roof=LOOK.M(new THREE.BoxGeometry(12,.5,7),steel,.02);roof.position.set(x,4.6,z);roof.castShadow=true;scene.add(roof);
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(12.05,.2,7.05),red);stripe.position.set(x,4.45,z);scene.add(stripe);
  [[-5.5,-3],[5.5,-3],[-5.5,3],[5.5,3]].forEach(([a,c])=>{const p=LOOK.M(new THREE.BoxGeometry(.3,4.4,.3),steel,.01);p.position.set(x+a,2.2,z+c);scene.add(p);});
  GAS.pumps.forEach(v=>{const pm=LOOK.M(new THREE.BoxGeometry(.9,1.7,.6),red,.015);pm.position.set(v.x,.85,v.z);scene.add(pm);const sc=new THREE.Mesh(new THREE.PlaneGeometry(.6,.35),new THREE.MeshBasicMaterial({color:0x9fdcff}));sc.position.set(v.x,1.35,v.z+.31);scene.add(sc);
    const m=block(v.x,v.z,.9,1.7,.6,0xc8302a);m.material.visible=false;m.castShadow=false;});
  const pad=new THREE.Mesh(new THREE.PlaneGeometry(16,12),new THREE.MeshLambertMaterial({color:0x6a6a70}));pad.rotation.x=-Math.PI/2;pad.position.set(x,.015,z+1);scene.add(pad);
  building(x,z-9,6,4,1,1,{name:"Benzina — gas station",colors:[0xe8e4dc,0xc8302a],awning:0xc8302a,enter:true,floor:0x8a8a90});
  const road=new THREE.Mesh(new THREE.PlaneGeometry(14,7),new THREE.MeshLambertMaterial({color:0x5a5a60}));road.rotation.x=-Math.PI/2;road.position.set(CITY.x1+7,.014,CITY.gz);scene.add(road);
  makeCar(141,-13,Math.PI,0x8a4fb0);makeCar(151,-13,Math.PI,0xe08a3a);
  // two guards watch the pumps
  [[139.5,-21,Math.PI/2],[152.5,-21,-Math.PI/2]].forEach(([gx,gz,f])=>{const o=npc("guard.glb",gx,gz,f);const t=setInterval(()=>{if(!o.rig)return;clearInterval(t);o.rig.root.traverse(m=>{if(m.name==="1H_Sword"||m.name==="Round_Shield")m.visible=true;});},300);personize(o,"Guard",true);});
  const sg=label("Safe here — guarded",0x9dffb0);sg.scale.set(3.4,.6,1);sg.position.set(x,5.4,z+3.6);scene.add(sg);}
const CAR_ACT={pos:new THREE.Vector3(),car:null};
ACTS.push({pos:CAR_ACT.pos,r:2.8,label:()=>P.inCar?(nearPump()?`Fill up the tank (${fillCost()} denarii)`:P.inCar.boat?(isWater(P.pos.x,P.pos.z,false)&&landNear(P.pos).distanceTo(P.pos)>6?"Sail closer to the bank to get out":"Get out of the boat"):"Get out of the car"):CAR_ACT.car?(CAR_ACT.car.boat?"⛵ Get in your boat":CAR_ACT.car.own?`🚗 Your car (${CAR_ACT.car.locked?"🔒 locked":"🔓 unlocked"})`:CAR_ACT.car.ownerId&&CAR_ACT.car.locked?`🔒 ${CAR_ACT.car.ownerName}'s car is locked`:`Get in ${CAR_ACT.car.ownerId?CAR_ACT.car.ownerName+"'s":"the"} car (fuel ${Math.round(CAR_ACT.car.fuel/CAR_ACT.car.max*100)}%)`):"",hidden:()=>!P.inCar&&!CAR_ACT.car,
  run:()=>{if(P.inCar){if(nearPump()){const c=fillCost();if(!c)return lawSay("The tank is already full.");if(COINS<c)return lawSay(`Filling up costs ${c} — you have ${COINS}.`);COINS-=c;coinHud();P.inCar.fuel=P.inCar.max;lawSay("Tank full!");return;}exitCar();}else carUse(CAR_ACT.car);}});
const nearPump=()=>P.inCar&&GAS.pumps.some(v=>Math.hypot(v.x-P.pos.x,v.z-P.pos.z)<4);
const fillCost=()=>P.inCar?Math.ceil((P.inCar.max-P.inCar.fuel)/GAS.price):0;
// shared cars: taking one hides it for everyone else in the room; getting out parks it where you left it (keys "car:<n>")
const carKey=c=>"car:"+CARS.indexOf(c);
function enterCar(c){if(!c||P.down)return;if(c.taken&&c.taken!==MP.id){lawSay("Someone else is driving that car.");return;}if(c.ownerId&&c.locked){lawSay(`🔒 ${c.ownerName}'s car is locked.`);return;}carShareState(c,true);P.inCar=c;c.speed=0;G.firing=false;body.visible=false;gunMount.visible=false;itemMount.visible=false;look.yaw=c.yaw+Math.PI;lawSay("W / S to drive, A / D to steer, Space to brake, T to get out.");}
function exitCar(){const c=P.inCar;if(!c)return;P.inCar=null;carShareState(c,false);const side=new THREE.Vector3(Math.cos(c.yaw),0,-Math.sin(c.yaw));P.pos.copy(c.g.position).addScaledVector(side,1.8);if(c.boat)P.pos.copy(landNear(c.g.position));P.pos.y=0;P.vel.set(0,0,0);body.visible=true;select(SEL);}
function carBlocked(p){for(const b of BLOCKS){if(b.pass||b.y>1.5||b.h<.3)continue;if(Math.abs(p.x-b.x)<b.w/2+1.1&&Math.abs(p.z-b.z)<b.d/2+1.1)return b;}return null;}
function driveCar(dt,inp){if(P.down||LAW.jailT>0){exitCar();return;}const c=P.inCar;const thr=c.fuel>0?-inp.z:0,st=inp.x,brake=keys.Space;
  if(thr)c.speed+=thr*(thr*c.speed<0?20:10)*dt;else c.speed-=Math.sign(c.speed)*Math.min(Math.abs(c.speed),(2+.015*c.speed*c.speed)*dt);
  if(brake)c.speed*=Math.max(0,1-4*dt);c.speed=clamp(c.speed,-7,26);
  c.yaw-=st*1.9*dt*clamp(c.speed/6,-1,1);const f=new THREE.Vector3(Math.sin(c.yaw),0,Math.cos(c.yaw));
  const np=c.g.position.clone().addScaledVector(f,c.speed*dt);np.x=clamp(np.x,-188,188);np.z=clamp(np.z,-188,188);
  const hit=c.boat?(isWater(np.x,np.z,true)?null:{}):(carBlocked(np)||(isWater(np.x,np.z,false)?{}:null));if(hit){if(Math.abs(c.speed)>8){shake(Math.min(.4,Math.abs(c.speed)*.015));popNum(c.g.position.clone().add(new THREE.Vector3(0,2,0)),"Crash!","burn");if(Math.abs(c.speed)>16)hurt(Math.round((Math.abs(c.speed)-16)*3));}c.speed*=-.25;}
  else c.g.position.copy(np);
  c.fuel=Math.max(0,c.fuel-Math.abs(c.speed)*dt*.045);if(c.fuel<=0&&!c.outT){c.outT=1;lawSay("Out of fuel! Push… or walk to the gas station outside the east gate.");}if(c.fuel>0)c.outT=0;
  c.g.rotation.y=c.yaw;c.spin+=c.speed*dt/.38;c.wheels.forEach((w,i)=>{w.children[0].rotation.x=c.spin;if(i<2&&!c.parts)w.rotation.y=-st*.4;});c.g.rotation.z=-st*clamp(c.speed/26,-1,1)*.05;
  // running into people, monsters or other players hurts them
  const sp=Math.abs(c.speed);if(sp>5){const now=tAcc,cool=k=>{const t=c.hitCool.get(k)||0;if(now<t)return false;c.hitCool.set(k,now+1);return true;};const pos=c.g.position;
    PEOPLE.forEach(pp=>{if(!pp.down&&pp.o.g.position.distanceTo(pos)<1.9&&cool(pp))hurtPerson(pp,Math.round(sp*3),pp.o.g.position.clone().add(new THREE.Vector3(0,1,0)));});
    ENEMIES.forEach(e=>{if(!e.down&&e.g.position.distanceTo(pos)<2&&cool(e))damage(e,Math.round(sp*5),e.g.position.clone().add(new THREE.Vector3(0,1,0)),false,{el:"earth"});});
    for(const id in MP.others){const o=MP.others[id];if(o.g.position.distanceTo(pos)<2&&cool(o))hitPlayer(o,Math.round(sp*2),o.g.position.clone());}}
  P.pos.copy(c.g.position);P.vel.set(0,0,0);P.onGround=true;P.yaw=c.yaw+Math.PI;
  if(!G.firing&&performance.now()-(look.moved||0)>1500){let d=(c.yaw+Math.PI)-look.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));look.yaw+=d*Math.min(1,2.5*dt);}}   // the camera swings round behind the car (unless you are aiming)
function stepCars(){for(const c of CARS)if(c.taken&&c.taken!==MP.id&&!MP.others[c.taken]){c.goneT=(c.goneT||0)+1;if(c.goneT>300){c.taken=null;c.g.visible=!c.hidden;c.goneT=0;}}else c.goneT=0;   // a driver who left the game: the car comes back
  CAR_ACT.car=null;if(P.inCar){CAR_ACT.pos.copy(P.pos);return;}let bd=2.8;for(const c of CARS){if(!c.g.visible)continue;const d=Math.hypot(c.g.position.x-P.pos.x,c.g.position.z-P.pos.z);if(d<bd){bd=d;CAR_ACT.car=c;}}
  if(CAR_ACT.car){CAR_ACT.pos.copy(CAR_ACT.car.g.position);const t=P.pos.clone().sub(CAR_ACT.pos);t.y=0;if(t.length()>.01)CAR_ACT.pos.addScaledVector(t.normalize(),Math.min(1.2,t.length()));}
  for(const c of CARS){if(Math.abs(c.speed)>.01&&c!==P.inCar){c.speed*=.95;}}}
// ---------------- Harena, the battle ground (2026-11-22, a player-vs-player arena in the battle-royale style — our own design) ----------------
// West of town. Stone walls with gaps, ruins and crates for cover, loot chests, cars. The storm: every round a safe circle shrinks toward a
// random spot; outside it you get hurt. Rounds run on the clock, so everyone in the arena sees the same storm. Monsters stay out.
const ARENA={x:-135,z:55,r:44,round:150,chests:[],round_n:-1};
const inArena=p=>Math.hypot(p.x-ARENA.x,p.z-ARENA.z)<ARENA.r+2;
{const A=ARENA,stone=0x9e968a;
  for(let i=0;i<64;i++){if(i%16<2)continue;const t=i/64*Math.PI*2,x=A.x+Math.cos(t)*A.r,z=A.z+Math.sin(t)*A.r;block(x,z,1.6,3.2,1.6,stone);}   // a ring of stone pillars, four wide gates
  const ground=new THREE.Mesh(new THREE.CircleGeometry(A.r,64),new THREE.MeshLambertMaterial({color:0xb8a27a}));ground.rotation.x=-Math.PI/2;ground.position.set(A.x,.012,A.z);ground.receiveShadow=true;scene.add(ground);
  const rng=(()=>{let s=99;return()=>(s=(s*16807)%2147483647)/2147483647;})();
  for(let i=0;i<26;i++){const a=rng()*6.28,r=6+rng()*(A.r-10),x=A.x+Math.cos(a)*r,z=A.z+Math.sin(a)*r;const k=rng();
    if(k<.45)block(x,z,rng()<.5?5:1,rng()<.5?2.4:1.6,rng()<.5?1:5,0x8f877c);                       // broken walls
    else if(k<.8){const m=block(x,z,1.4,1.4,1.4,0x8a5a32);m.material=LOOK.toon(0x8a5a32);}                 // crates
    else{const m=block(x,z,1.2,5,1.2,0x8a8a8d);}}                                                      // standing columns
  [["Harena — the battle ground",0xff8a7a]].forEach(([t,h])=>{const s=label(t,h);s.scale.set(5,.9,1);s.position.set(A.x+A.r+1,4.5,A.z);scene.add(s);});
  const sign=label("Harena — battle ground →",0xff8a7a);sign.scale.set(4.5,.8,1);sign.position.set(TOWN.x0-4,4,-9);scene.add(sign);
  makeCar(A.x+A.r-8,A.z,Math.PI/2,0x222228);makeCar(A.x-10,A.z+20,0,0xb5482f);makeCar(A.x+5,A.z-25,Math.PI,0x4f8f3a);}
// the storm wall: a tall glowing cylinder at the edge of the safe circle
const STORM=new THREE.Mesh(new THREE.CylinderGeometry(1,1,60,64,1,true),new THREE.MeshBasicMaterial({color:0x8a3ab0,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false}));STORM.position.y=30;STORM.visible=false;scene.add(STORM);
// loot chests
function arenaLoot(){const r=Math.random();if(r<.3)return {t:"weapon",id:pick(["shotgun","repeater","cannon","arcus","staff"])};if(r<.5)return {t:"potion",id:Math.random()<.5?"potion":"fortis",n:1};
  if(r<.75){const id=pick(DROP_SPELLS);return {t:"spell",id,uses:SPELLS[id].uses};}if(r<.9)return {t:"food",id:pick(Object.keys(FOODS)),n:2};return {t:"coin",n:ri(5,15)};}
for(let i=0;i<10;i++){const a=i/10*6.28+.3,r=10+(i%3)*9,x=ARENA.x+Math.cos(a)*r,z=ARENA.z+Math.sin(a)*r;const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=-a;scene.add(g);
  const box=LOOK.M(new THREE.BoxGeometry(1.2,.7,.8),LOOK.toon(0x7a4a28),.02);box.position.y=.35;g.add(box);const lid=LOOK.M(new THREE.BoxGeometry(1.24,.22,.84),LOOK.toon(0xd8ac4a),.02);lid.position.y=.81;g.add(lid);
  const ch={g,lid,pos:new THREE.Vector3(x,0,z),open:false};ARENA.chests.push(ch);ACTS.push({pos:ch.pos,r:1.8,label:"Open the chest",hidden:()=>ch.open,run:()=>{ch.open=true;lid.rotation.x=-1.1;lid.position.z=-.3;setKey("box:"+i,{n:stormAt(Date.now()).n});const it=arenaLoot();
    if(it.t==="coin"){COINS+=it.n;coinHud();}else if(!addItem(it))dropItem(ch.pos.clone().add(new THREE.Vector3(0,0,1)),it,120);const f=itemInfo(it);popNum(ch.pos.clone().add(new THREE.Vector3(0,1.8,0)),`${f.name}${it.n>1?" ×"+it.n:""}`,"spell",f.pic);}});}
// the storm runs on the clock: one round every ARENA.round seconds; safe spot and size come from the round number (same for everyone)
function stormAt(now){const sec=now/1000,n=Math.floor(sec/ARENA.round),t=sec-n*ARENA.round;let s=n*9301+49297;const r1=()=>(s=(s*233280+49297)%233280)/233280;
  const a=r1()*6.28,d=r1()*(ARENA.r*.45),cx=ARENA.x+Math.cos(a)*d,cz=ARENA.z+Math.sin(a)*d;
  // phases: wait 30 s at full size; shrink to 60% (40 s); wait 20; shrink to 25% (35 s); wait 15; close completely (10 s)
  const R=ARENA.r+4,steps=[[30,R,R],[40,R,R*.6],[20,R*.6,R*.6],[35,R*.6,R*.25],[15,R*.25,R*.25],[10,R*.25,0]];let tt=t,rad=0,phase=0,left=0;
  for(let i=0;i<steps.length;i++){const [len,a0,b0]=steps[i];if(tt<=len){rad=a0+(b0-a0)*(tt/len);phase=i;left=len-tt;break;}tt-=len;}
  const ccx=ARENA.x+(cx-ARENA.x)*Math.min(1,phase/2),ccz=ARENA.z+(cz-ARENA.z)*Math.min(1,phase/2);return {n,rad,phase,left,cx:ccx,cz:ccz,dmg:[1,3,4,6,8,12][phase]};}
let stormHurtT=0;
function stepArena(dt){const st=stormAt(Date.now());STORM.position.x=st.cx;STORM.position.z=st.cz;STORM.scale.set(Math.max(.1,st.rad),1,Math.max(.1,st.rad));STORM.visible=Math.hypot(P.pos.x-ARENA.x,P.pos.z-ARENA.z)<ARENA.r+60;
  if(st.n!==ARENA.round_n){ARENA.round_n=st.n;ARENA.chests.forEach(c=>{c.open=false;c.lid.rotation.x=0;c.lid.position.z=0;});}
  const here=inArena(P.pos),out=Math.hypot(P.pos.x-st.cx,P.pos.z-st.cz)>st.rad;$("#vig").classList.toggle("storm",here&&out);
  if(here&&out&&!P.down){stormHurtT-=dt;if(stormHurtT<=0){stormHurtT=1;hurt(st.dmg);popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),`storm -${st.dmg}`,"burn");}}
  const hud=$("#arenaHud");if(here){hud.classList.remove("hidden");const n=Object.values(MP.others).filter(o=>inArena(o.g.position)).length+1;
    hud.textContent=`Harena · round ${st.n%1000} · ${st.phase%2===1?"the storm is closing in":st.phase===5?"final circle!":"storm moves in "+Math.ceil(st.left)+" s"} · ${n} player${n>1?"s":""} here${out?" · YOU'RE IN THE STORM — get inside the circle!":""}`;}
  else hud.classList.add("hidden");}
// ---------------- day and night (2026-11-22): an 8-minute day — 5 minutes of daylight, then dusk, a starry night, dawn ----------------
// The sun crosses the sky (and follows you, so shadows are everywhere); at night the sky darkens, stars come out, lamps and windows glow,
// and monsters see farther and roam wider.
const DAY={len:CLOCK.len,t:0,day:0,night:0};   // the time of day comes from the real clock, so every player sees the same sky
const STARS=(()=>{const n=700,pos=new Float32Array(n*3);for(let i=0;i<n;i++){const u=RNG(),v=RNG()*.9+.08,th=u*Math.PI*2,ph=Math.acos(v);pos[i*3]=Math.sin(ph)*Math.cos(th)*250;pos[i*3+1]=Math.cos(ph)*250;pos[i*3+2]=Math.sin(ph)*Math.sin(th)*250;}
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(pos,3));const m=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false}));m.renderOrder=-1;scene.add(m);return m;})();
const C_=h=>new THREE.Color(h),SKY_DAY=[C_(0xd8e9e0),C_(0x98cfe8),C_(0x5aa8dc)],SKY_DUSK=[C_(0xf2a878),C_(0x8a7ab0),C_(0x3a4a8a)],SKY_NIGHT=[C_(0x1a2440),C_(0x0e1530),C_(0x050914)];
const FOG_DAY=C_(0x9fc08a),FOG_NIGHT=C_(0x141c2c),_c1=new THREE.Color(),_c2=new THREE.Color();let clockSaveT=0;
function stepDay(dt){const sNow=(Date.now()-CLOCK.epoch)/1000/DAY.len+CLOCK.offset/DAY.len,nd=Math.floor(sNow)+1;DAY.t=sNow-Math.floor(sNow);if(nd!==DAY.day){const first=!DAY.day;DAY.day=nd;if(!first){lawSay(`Day ${townDay()} begins.`);marketDay();}}
  const t=DAY.t,DAYLEN=.62;const sunUp=t<DAYLEN?Math.sin(Math.PI*t/DAYLEN):0;            // 0 at dawn and dusk, 1 at noon
  const dusk=t<DAYLEN?Math.max(0,1-Math.min(t,DAYLEN-t)/.08):Math.max(0,1-Math.min(t-DAYLEN,1-t)/.06); // warm colors near sunrise/sunset
  const night=t<DAYLEN?0:Math.min(1,Math.min(t-DAYLEN,1-t)/.05);DAY.night=Math.max(0,night-0)*(1-dusk*.6);DAY.night=night;
  const day=Math.max(sunUp,.0);
  // sky, horizon, fog
  const sky=scene.userData.sky,band=scene.userData.band;const K=(arr,i)=>arr[i];
  for(let i=0;i<3;i++){_c1.copy(K(SKY_NIGHT,i)).lerp(K(SKY_DAY,i),Math.min(1,day*1.6));_c1.lerp(K(SKY_DUSK,i),dusk*.75);if(sky)sky.material.uniforms[["a","b","c"][i]].value.copy(_c1);}
  if(band)band.material.color.setScalar(.22+.78*Math.min(1,day*1.4+dusk*.4));
  _c2.copy(FOG_NIGHT).lerp(FOG_DAY,Math.min(1,day*1.6));if(dusk)_c2.lerp(C_(0xc89a78),dusk*.5);scene.fog.color.copy(_c2);scene.background.copy(_c2);
  // the sun (or the moon) and the sky light
  const ang=t<DAYLEN?Math.PI*t/DAYLEN:Math.PI*(t-DAYLEN)/(1-DAYLEN);const dir=new THREE.Vector3(Math.cos(ang)*.9,Math.sin(ang)*.8+.15,.35).normalize();
  sun.position.copy(P.pos).addScaledVector(dir,60);sun.target.position.copy(P.pos);sun.target.updateMatrixWorld();
  sun.intensity=t<DAYLEN?.25+1.35*sunUp:.28*night;sun.color.set(t<DAYLEN?(dusk>.3?0xffb070:0xfff0d8):0x9fb4ff);
  HEMI.intensity=.28+.72*Math.min(1,day*1.5);HEMI.color.set(day>.15?0xcfe8ff:0x6070a0);
  STARS.material.opacity=night*.9;STARS.position.copy(cam.position);
  const glowK=Math.max(night,dusk*.5);NIGHT_MATS.forEach(m=>m.emissiveIntensity=glowK*.85);LAMPS.forEach(l=>l.material.color.setScalar(.85+.6*glowK));
  const h=Math.floor(((t<DAYLEN?6+12*t/DAYLEN:18+12*(t-DAYLEN)/(1-DAYLEN))%24));$("#clock").textContent=`Day ${townDay()} · ${h%12||12} ${h<12?"am":"pm"}${night>.5?" · night":""}`;
}
scene.add(sun.target);
function stepLife(dt){stepDay(dt);stepAreas();stepCars();stepArena(dt);stepVillagers();stepCity(dt);stepOrders(dt);stepTown(dt);stepHomes();stepBoats();stepSoldiers(dt);stepPlaced();stepCastleGuard(dt);stepInvent(dt);stepRooms();stepJobs();stepBiz(dt);stepLaw(dt);stepMarks(dt);stepHouses(dt);TOWNFOLK.forEach(o=>{if(o.rig&&o.g.position.distanceTo(P.pos)<70)o.rig.update(dt);});HOME.restT=Math.max(0,HOME.restT-dt);
  if(TOWN.fountain&&Math.random()<dt*30)SPARK.emit(TOWN.fountain,new THREE.Vector3(rnd(-1.2,1.2),rnd(2,3),rnd(-1.2,1.2)),C(Math.random()<.5?0x9fdcff:0xffffff),.9,{grav:6});
  if(P.regenT>0&&!P.down&&P.hp<P.maxHp){P.hp=Math.min(P.maxHp,P.hp+3*dt);hud();}stepActs();
  const bf=[["mightT","⚗️"],["regenT","🥣"],["toughT","🧀"],["strongT","🐟"],["jumpT","🍇"],["buffT","💨"],["shieldT","🫧"],["invulnT","🌟"],["slowT","❄️"],["dizzyT","💫"],["sickT","🤢"],["flipT","🔄"]].filter(([k])=>P[k]>0).map(([k,i])=>`<span>${i} ${Math.ceil(P[k])}</span>`).join("");
  $("#buffs").innerHTML=bf;}

// ---------------- multiplayer: everyone playing right now shows up as a hooded hero with a name tag ----------------
// ~7 times a second we send where we are to the server (/api/elementum/state) and get everyone else back. Monsters stay each player's own.
const MP={id:(()=>{let s="";const a="abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";for(let i=0;i<12;i++)s+=a[Math.floor(Math.random()*a.length)];return s;})(),others:{},busy:false,t:0,fx:"",fxN:0,ok:false,you:""};
function mpFx(s){MP.fxN++;MP.fx=s+":"+MP.fxN;}
// rooms work like Kahoot: the public world, or a private room you give a name — the game hands you a 6-digit code, friends join with
// the code (or a link with ?room=CODE) and see the room's name. The code is never the name (Barbara, 2026-11-20).
const cleanRoom=c=>String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6)||"PUBLIC";
MP.room=cleanRoom(new URLSearchParams(location.search).get("room")||(()=>{try{return localStorage.getItem("elementum.room");}catch(e){return "";}})());MP.list=[];
MP.roomName=(()=>{try{return localStorage.getItem("elementum.roomName")||"";}catch(e){return "";}})();
function setRoom(code,name){const was=MP.room;MP.room=cleanRoom(code);if(name!==undefined||MP.room!==was)MP.roomName=MP.room==="PUBLIC"?"":(name||"");if(MP.room!==was){const k=Object.keys(WORLD.known);WORLD.known={};WORLD.out.length=0;WORLD.wid="";worldApply(()=>k.forEach(x=>applyKey(x,null)));WORLD.known={};}WORLD.seq=0;WORLD.wanted.clear();
  try{localStorage.setItem("elementum.room",MP.room);localStorage.setItem("elementum.roomName",MP.roomName);}catch(e){}
  for(const id in MP.others){scene.remove(MP.others[id].g);delete MP.others[id];}MP.list=[];
  try{const u=new URL(location.href);if(MP.room==="PUBLIC")u.searchParams.delete("room");else u.searchParams.set("room",MP.room);history.replaceState(null,"",u);}catch(e){}
  MP.t=0;renderRoom(true);}
const roomErr=(j,fallback)=>j&&j.error==="Please sign in."?"Sign in first, then try again.":(j&&j.error)||fallback;
function newRoom(name){fetch("/api/elementum/room",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({name:name||""})})
  .then(r=>r.json()).then(j=>{if(j.room){setRoom(j.room,j.name);$("#roomMsg").textContent="Room made! Give your friends the code "+j.room+".";}else $("#roomMsg").textContent=roomErr(j,"Could not make a room right now — try again.");})
  .catch(()=>{$("#roomMsg").textContent="Could not make a room right now — try again.";});}
function joinRoom(code){code=String(code||"").replace(/[^0-9]/g,"");if(code.length!==6){$("#roomMsg").textContent="The code is 6 numbers — ask whoever made the room.";return;}
  fetch("/api/elementum/room/"+code,{credentials:"include"}).then(r=>r.json()).then(j=>{if(j.room){setRoom(j.room,j.name);$("#roomMsg").textContent="You joined "+j.name+".";}else $("#roomMsg").textContent=roomErr(j,"No room with that code.");})
  .catch(()=>{$("#roomMsg").textContent="Could not reach the game right now — try again.";});}
let roomOpen=false;
function toggleRoom(open){roomOpen=open===undefined?!roomOpen:open;$("#room").classList.toggle("hidden",!roomOpen);if(roomOpen){G.firing=false;if(document.exitPointerLock)document.exitPointerLock();renderRoom(true);}}
// the buttons are drawn once (when the panel opens or the room changes); only the player list refreshes with each update — redrawing the
// buttons 7 times a second swallowed clicks, so "New private room" and "Join" seemed to do nothing (fixed 2026-11-20)
function roomPlayers(){const el=$("#roomPlayers");if(!el)return;const where=p=>inTown(p)?"🏰 in town":"⚔️ in the wilds";const me={name:(MP.you||"You")+" (you)",hp:Math.round(P.hp),x:P.pos.x,z:P.pos.z,y:0};
  const rows=[me,...MP.list].map(p=>{const d=Math.round(Math.hypot(p.x-P.pos.x,p.z-P.pos.z));return `<li><b>${esc(p.name)}</b><span>❤ ${p.hp} · ${where(new THREE.Vector3(p.x,0,p.z))}${p===me?"":` · ${d} m away`}</span></li>`;}).join("");
  el.innerHTML=`<h3>Playing here now (${MP.list.length+1})</h3><ul class="players">${rows}</ul>${MP.ok?"":`<p class="tip">Connecting… (multiplayer works on play.hardywu.com)</p>`}`;
  const t=$("#roomTitle");if(t&&MP.roomName&&t.textContent!==MP.roomName)t.textContent=MP.roomName;}
function renderRoom(full){if(!roomOpen)return;if(!full&&$("#roomPlayers")){roomPlayers();return;}
  const pub=MP.room==="PUBLIC";const link=location.origin+location.pathname+"?room="+MP.room;
  $("#roomBody").innerHTML=`<div class="code">${pub?`<small>You are in the</small><b class="long">Public world</b>`:`<b class="long" id="roomTitle">${esc(MP.roomName||"Private room")}</b><small>Room code</small><b>${MP.room}</b><button id="copyLink">📋 Copy invite link</button>`}</div>
    <p class="tip">${pub?"Everyone who isn't in a private room plays here. Make a private room to play only with friends.":"Only players with this code are in your world. Tell your friends the code, or send them the link."}</p>
    <div id="roomPlayers"></div>
    <h3>Join a friend's room</h3>
    <div class="join"><input id="roomCode" maxlength="6" inputmode="numeric" placeholder="6-digit code" autocomplete="off"><button id="joinRoom">Join</button></div>
    <h3>Make your own room</h3>
    <div class="join"><input id="roomName" maxlength="24" placeholder="Name your room" autocomplete="off"><button id="makeRoom">🔒 Make room</button></div>
    <p class="tip">You get a code to give your friends. Your room's name is what everyone sees.</p>
    ${pub?"":`<div class="row"><button id="goPublic" class="g">🌍 Back to the public world</button></div>`}<p class="msg" id="roomMsg"></p>`;
  roomPlayers();
  $("#joinRoom").onclick=()=>joinRoom($("#roomCode").value);$("#roomCode").onkeydown=e=>{if(e.key==="Enter")joinRoom($("#roomCode").value);};
  $("#makeRoom").onclick=()=>newRoom($("#roomName").value);$("#roomName").onkeydown=e=>{if(e.key==="Enter")newRoom($("#roomName").value);};
  if($("#goPublic"))$("#goPublic").onclick=()=>setRoom("PUBLIC");
  if($("#copyLink"))$("#copyLink").onclick=()=>{(navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(()=>{$("#roomMsg").textContent="Link copied — paste it to a friend.";},()=>{$("#roomMsg").textContent=link;});};}
function nameTag(text){const c=document.createElement("canvas");c.width=512;c.height=128;const x=c.getContext("2d");x.font="700 52px system-ui,sans-serif";x.textAlign="center";x.textBaseline="middle";
  const w=Math.min(500,x.measureText(text).width+48);x.fillStyle="rgba(20,20,24,.62)";x.beginPath();x.roundRect(256-w/2,22,w,84,40);x.fill();x.fillStyle="#fff";x.fillText(text,256,66);
  const t=new THREE.CanvasTexture(c);if("colorSpace" in t)t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false,depthTest:false,transparent:true}));s.scale.set(1.9,.48,1);s.renderOrder=10;return s;}
function mpAvatar(p){const g=new THREE.Group();g.position.set(p.x,p.y,p.z);scene.add(g);const o={g,rig:null,tag:null,name:"",hp:-1,to:new THREE.Vector3(p.x,p.y,p.z),yaw:p.yaw,lastFx:p.fx};
  const ring=new THREE.Mesh(new THREE.RingGeometry(.42,.52,28),new THREE.MeshBasicMaterial({color:0x7fd3ff,transparent:true,opacity:.7,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;g.add(ring);
  o.id=p.id;o.hb=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,1.9,8),new THREE.MeshBasicMaterial({visible:false}));o.hb.position.y=.95;o.hb.userData.player=o;g.add(o.hb);
  LOOK.loadRig("/play/elementum/models/hero.glb",false,r=>{if(!r||!o.g.parent)return;o.rig=r;LOOK.heroHair(r);r.root.scale.setScalar(1.05);r.root.rotation.y=Math.PI;g.add(r.root);r.base("Idle",{snap:true});});return o;}
function mpApply(list){const seen=new Set();
  for(const p of list){seen.add(p.id);let o=MP.others[p.id];if(!o)o=MP.others[p.id]=mpAvatar(p);
    o.to.set(p.x,p.y,p.z);o.yaw=p.yaw;o.sp=p.sp;o.air=p.air;o.po=p.po||"";o.bo=!!p.bo;o.might=/S/.test(p.bf||"");o.needs=(p.bf||"").replace(/[^FWZ]/g,"");o.bub=/B/.test(p.bf||"");o.halo=/H/.test(p.bf||"");o.hi=p.hi||"";o.hc=p.hc||0;
    // driving: show their car under them (and hide the walking hero)
    if((p.car||0)!==(o.carColor||0)){if(o.car){scene.remove(o.car.g);o.car=null;}o.carColor=p.car||0;if(o.carColor){const rc=[MYCAR.car,...Object.values(REMOTE_CARS)].find(c=>c&&c.parts&&c.taken===p.id);o.car=rc?makeCarOf(rc.parts,p.x,p.z,p.yaw-Math.PI,o.carColor,true):makeCar(p.x,p.z,p.yaw-Math.PI,o.carColor,true);}if(o.rig)o.rig.root.visible=!o.carColor;}
    if(o.name!==p.name||o.hp!==p.hp){o.name=p.name;o.hp=p.hp;if(o.tag){o.g.remove(o.tag);o.tag.material.map.dispose();}o.tag=nameTag(`${p.name}  ❤ ${p.hp}`);o.tag.position.y=2.55;o.g.add(o.tag);}
    if(p.fx&&p.fx!==o.lastFx){o.lastFx=p.fx;const [k,id]=p.fx.split(":");const at=o.g.position.clone().add(new THREE.Vector3(0,1.3,0));
      if(k==="fortis"){FX.stars(at,"gold",5,1.6);if(!P.down&&o.g.position.distanceTo(P.pos)<12)drinkFortis(o.name);}
      else if(k==="shot"){if(o.rig)o.rig.up("2H_Ranged_Shoot",{once:true,dur:.35,restart:true,then:()=>o.rig.up("2H_Ranged_Aiming")});muzzle(at.clone().add(new THREE.Vector3(-Math.sin(o.yaw)*.6,0,-Math.cos(o.yaw)*.6)),new THREE.Vector3(-Math.sin(o.yaw),0,-Math.cos(o.yaw)),0xffd27a,.4);}
      else if(k==="punch"){if(o.rig)o.rig.up("Unarmed_Melee_Attack_Punch_A",{once:true,dur:.4,restart:true,then:()=>o.rig.up("Unarmed_Idle")});}
      else if(SPELLS[k]){const el=SPELLS[k].el;if(o.rig)o.rig.up(SPELL_ANIM[SPELLS[k].kind]||"Spellcast_Shoot",{once:true,dur:.6,restart:true,then:()=>o.rig.up("2H_Ranged_Aiming")});FX.stars(at,el,3,1.2);flash(at,FX.HEX[el],4,.25);popNum(at.clone().add(new THREE.Vector3(0,1.2,0)),SPELLS[k].name,"spell","scroll_"+SPELLS[k].el);}}}
  for(const id in MP.others)if(!seen.has(id)){if(MP.others[id].car)scene.remove(MP.others[id].car.g);scene.remove(MP.others[id].g);delete MP.others[id];}
  const n=Object.keys(MP.others).length;$("#online").textContent=`👥 ${MP.room==="PUBLIC"?"Public":(MP.roomName&&!/^Room /.test(MP.roomName)?MP.roomName:"Room "+MP.room)} · ${MP.ok?n+1:"…"}`;}
// ---------------- the shared world: what you do, the others in your room see — and the other way round ----------------
// Each update sends what changed (events) and gets back what the others did. Things that last (the training center, cottages, items on the ground)
// are "keys", so someone who joins later sees them too. Monsters are shared too (see PACKS); the training dummies' health stays each player's own.
const WORLD={out:[],seq:0,remote:false,wanted:new Set(),STATIC:0,known:{},wid:"",dead:[]};
// everything that lasts is a key; "known" is what this room's keys are right now, as far as this player has seen
const noteKey=(key,val)=>{if(val===null||val===undefined)delete WORLD.known[key];else WORLD.known[key]=val;};
function share(ev){if(WORLD.remote)return;if(ev.k==="key")noteKey(ev.key,ev.val);WORLD.out.push(ev);if(WORLD.out.length>120)WORLD.out.splice(0,WORLD.out.length-120);}
const setKey=(key,val)=>share({k:"key",key,val});
const V3=a=>new THREE.Vector3(a[0],a[1],a[2]),R2=v=>Math.round(v*100)/100;
function worldApply(fn){WORLD.remote=true;try{fn();}catch(e){console.warn("world",e);}finally{WORLD.remote=false;}}
function applyKey(key,val){noteKey(key,val);
  if(key==="train"){if(val&&!TRAIN.built)buildTraining(true);return;}
  if(key.startsWith("cot:")){const [,name,kind]=key.split(":");const v=VILLAGERS.find(x=>x.name===name);if(!v)return;if(!val){cottageState(v.home,kind,"ok");return;}const q=workQ(v);if(q&&q.job===kind)return;cottageState(v.home,kind,val);return;}
  if(key.startsWith("drop:")){const id=key.slice(5);const i=PICKUPS.findIndex(d=>d.sid===id);
    if(val===null){if(i>=0){scene.remove(PICKUPS[i].g);PICKUPS.splice(i,1);}return;}
    if(i<0&&val&&val.it){const left=val.t?300-(Date.now()/1000-val.t):300;if(left<=0){if(left<-30)WORLD.dead.push(key);return;}dropItem(new THREE.Vector3(val.x,+val.y||0,val.z),val.it,Math.min(300,left),id,true);}return;}
  if(key.startsWith("pl:")){placedKeyApply(key.slice(3),val);return;}
  if(key.startsWith("hb:")||key.startsWith("hbp:")){if(val)WORLD_KEYS[key]=val;else delete WORLD_KEYS[key];return;}
  if(key.startsWith("bld:")){const bd=BUILDINGS[+key.slice(4)];if(!bd)return;if(val&&!bd.down)collapse(bd);else if(!val&&bd.down)rebuild(bd);return;}
  if(key.startsWith("mycar:")){carKeyApply(key.slice(6),val);return;}
  if(key.startsWith("car:")){const c=CARS[+key.slice(4)];if(!c||c.own||c.ownerId||c===P.inCar)return;if(!val)val=c.home0||carPos(c);if(val.f!==undefined)c.fuel=+val.f||0;
    if(val.d){c.taken=val.d;c.g.visible=val.d===MP.id&&!c.hidden;}else{c.taken=null;c.g.visible=!c.hidden;c.g.position.set(val.x,0,val.z);c.yaw=val.yaw;c.g.rotation.y=val.yaw;c.speed=0;}return;}
  if(key.startsWith("box:")){const c=ARENA.chests[+key.slice(4)];if(c&&val&&val.n===stormAt(Date.now()).n){ARENA.round_n=val.n;c.open=true;c.lid.rotation.x=-1.1;c.lid.position.z=-.3;}return;}
  if(key.startsWith("boat:")){boatKeyApply(key.slice(5),val);return;}
  if(key.startsWith("law:")){const id=key.slice(4);if(val)WORLD.wanted.add(id);else WORLD.wanted.delete(id);}}
function applyEv(ev){
  if(ev.k==="key")return applyKey(ev.key,ev.val);
  if(ev.k==="hit"){if(ev.to!==MP.id||P.down||LAW.jailT>0)return;hurt(Math.max(1,Math.min(200,ev.n|0)));popNum(P.pos.clone().add(new THREE.Vector3(0,2.5,0)),`${ev.m?String(ev.m).slice(0,30):ev.by||"a player"} -${ev.n|0}`,"burn");return;}
  if(ev.k==="tree"){const t=TREES[ev.i];if(t&&!t.down){if(ev.h>0){t.hp=Math.min(t.hp,ev.h);t.g.rotation.z=rnd(-.03,.03);}else{t.hp=0;treeFall(t,false);}}return;}
  if(ev.k==="node"){const n=NODES[ev.i];if(n&&!n.down){if(ev.h>0)n.hp=Math.min(n.hp,ev.h);else{n.hp=0;nodeBreak(n,false);}}return;}
  if(ev.k==="wall"){const b=BLOCKS[ev.b];if(b&&ev.b<WORLD.STATIC)wallHit(b,V3(ev.p),V3(ev.n),ev.pw||1);return;}
  if(ev.k==="scorch")return scorch(new THREE.Vector3(ev.x,0,ev.z),ev.r,ev.el);
  if(ev.k==="ko"){const pp=PEOPLE.find(x=>x.name===ev.name&&!x.guard);if(pp&&!pp.down)knockOut(pp);return;}
  if(ev.k==="horn"){const at=new THREE.Vector3(+ev.x||0,0,+ev.z||0);if(at.distanceTo(P.pos)<90){hornSound();callSoldiers(at,true);lawSay(`📯 ${ev.by||"Someone"} blew a horn — the soldiers are coming!`);}return;}
  if(ev.k==="mobs"){const pk=PACKS[ev.p|0];if(!pk||pk.mine||!Array.isArray(ev.l))return;ev.l.forEach((a,j)=>{if(pk[j])mobNet(pk[j],a);});return;}
  if(ev.k==="mdmg"){const d=ENEMIES[ev.i|0];if(!d||!d.pack.mine||d.down)return;d.hp=Math.max(0,d.hp-Math.max(0,Math.min(999,ev.n|0)));d.alert=8;d.pack.forEach(m=>{m.alert=Math.max(m.alert,8);});
    if(d.hp<=0){d.down=true;setTimeout(()=>enemyDown(d),0);}else mobAct(d,"hit");return;}   // (outside worldApply, so the loot gets shared)
  if(ev.k==="dummy"){const d=TRAIN.dummies[ev.i];if(d&&!d.down&&!d.unbuilt){if(ev.h>0)d.hp=Math.min(d.hp,ev.h);else{d.hp=0;d.down=true;dummyFall(d);}}return;}
  if(ev.k==="npc"){if(!npcLead()&&Array.isArray(ev.l))ev.l.forEach(npcNet);return;}
  if(ev.k==="say"){const cz=CITIZENS[ev.i|0];if(cz&&!npcLead()&&typeof ev.t==="string")say(cz,ev.t.slice(0,140),+ev.s||3);return;}
  if(ev.k==="flee"){const cz=CITIZENS[ev.i|0];if(cz&&npcLead()){cz.pp.hp=Math.min(cz.pp.hp,+ev.h||cz.pp.hp);cz.fleeFrom=new THREE.Vector3(+ev.x||0,0,+ev.z||0);}return;}
  if(ev.k==="shot")return ghostShot(ev);
  if(ev.k==="inv")return invFx(ev);
  if(ev.k==="cast")return ghostCast(ev);}
// how another player looks right now: what's in their hand, lying in bed, shield bubbles, hair
const HAIR={c:0};
const heldCode=it=>{if(!it)return "";if(it.t==="weapon")return "w:"+it.id+":"+crystalEl();if(it.t==="build"){const k=it.hk||(it.hk=Math.random().toString(36).slice(2,8));if(HOLDING!==k&&MP.ok){HOLDING=k;const p=compactParts(it.parts);setKey("hold:"+MP.id,{i:it.id,k,p:p.length&&JSON.stringify(p).length<15000?p:0});}return "b:"+it.id+":"+k;}return "p:"+picKey(it);};let HOLDING="";
function mpHeld(o,code){if(o.heldG){o.g.remove(o.heldG);o.heldG=null;}if(!code)return;const [t,id,x]=code.split(":");
  if(t==="w"&&WEAPONS[id]){const w=WEAPONS[id],g=gunModel(w.model||id);g.scale.setScalar(1.35*(w.size||1));if(w.stretch)g.scale.y*=w.stretch;const hex=FX.HEX[x];if(hex!==undefined)g.traverse(m=>{if(m.userData.crystal){m.material.color.setHex(hex);m.material.emissive.setHex(hex);}if(m.isPointLight)m.intensity=0;});g.rotation.x=Math.PI/2;g.userData.gun=true;o.heldG=g;}
  else if(t==="p"){o.heldG=heldMesh(id);o.heldG.scale.setScalar(.42);}
  else if(t==="b"&&BUILD.ITEMS[id]){const h=WORLD.known["hold:"+o.id];o.heldG=heldMesh(h&&h.k===x&&Array.isArray(h.p)?BUILD.snap(h.p,96):emojiPic(BUILD.ITEMS[id].icon));o.heldG.scale.setScalar(.42);}
  if(o.heldG)o.g.add(o.heldG);}
const _hv=new THREE.Vector3();
function mpLook(o,dt){const h=o.hi&&o.hi.startsWith("b:")?WORLD.known["hold:"+o.id]:null,hk=o.hi+(h?h.k:"");if(hk!==(o.hk||"")){o.hk=hk;try{mpHeld(o,o.hi);}catch(e){o.heldG=null;}}
  const r=o.rig,lie=o.po==="sleep";if(o.heldG){o.heldG.visible=!lie&&!o.carColor&&o.hp>0&&o.po!=="climb";if(r&&r.bones.handslotr){o.g.updateMatrixWorld(true);r.bones.handslotr.getWorldPosition(_hv);o.g.worldToLocal(_hv);o.heldG.position.copy(_hv);if(!o.heldG.userData.gun)o.heldG.position.x+=.25;}else o.heldG.position.set(.5,1.1,-.3);}
  if(r){r.root.rotation.x=lie?Math.PI/2:0;r.root.position.z=lie?-.95:0;r.root.position.y=lie?.12:0;if(o.hi&&r.upName==="Unarmed_Idle")r.up("2H_Ranged_Aiming");else if(!o.hi&&r.upName==="2H_Ranged_Aiming")r.up("Unarmed_Idle");else if(!r.upName)r.up(o.hi?"2H_Ranged_Aiming":"Unarmed_Idle");
    if(o.hc!==(o.hcSeen||0)){o.hcSeen=o.hc;const hair=r.bones.head&&r.bones.head.getObjectByName("heroHair");if(hair&&o.hc)hair.traverse(m=>{if(m.isMesh)m.material.color.set(o.hc);});}}
  [["bub",0x8fdcff,.2],["halo",0xfff4c2,.28]].forEach(([k,c,op])=>{const m=o[k+"M"];if(o[k]&&!m){const n=o[k+"M"]=new THREE.Mesh(new THREE.SphereGeometry(1.2,20,14),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op,depthWrite:false}));n.position.y=1;o.g.add(n);}else if(m)m.visible=o[k];});}
// what other players shoot and cast, drawn here (it does no damage here: hits are counted by whoever shot)
const V3r=v=>[R2(v.x),R2(v.y),R2(v.z)];
function ghostShot(ev){const a=V3(ev.a);if(a.distanceTo(P.pos)>120)return;const el=FX.HEX[ev.el]!==undefined?ev.el:"fire",hex=FX.HEX[el],w=WEAPONS[ev.w]||WEAPONS.rifle;FX.flare(a,V3(ev.b[0]).sub(a).normalize(),el,(w.flash||.4)*1.3,.22);
  if(w.projectile){const to=V3(ev.b[0]);bolt(a,to.sub(a).normalize(),el,{size:w.boltSize,speed:w.boltSpeed,r:w.r,dmg:0,c:{ghost:true,enemy:{g:body}}});return;}
  ev.b.slice(0,12).forEach(b=>{const p=V3(b);tracer(a,p,hex);sparks(p,5,hex);});}
function ghostCast(ev){const s=SPELLS[ev.s];if(!s)return;const pos=V3(ev.p);if(pos.distanceTo(P.pos)>120)return;const o=Object.values(MP.others).find(x=>x.name===ev.by),g={position:o?o.g.position:pos};
  const c={ghost:true,enemy:{g,ghost:true,down:false},pos,from:V3(ev.f),aim:V3(ev.m),hit:true,fwd:V3(ev.w),tp:V3(ev.m)},hex=FX.HEX[s.el],mid=pos.clone().add(new THREE.Vector3(0,1.2,0));
  if(s.kind==="blink"){shadowPuff(pos);return;}
  if(["shield","heal","buff","invuln","leap"].includes(s.kind)){FX.stars(mid,s.el,5,1.5);for(let i=0;i<18;i++)PUFF.emit(mid,rnd3(1.6),C(hex).multiplyScalar(.5),.6,{drag:2});return;}
  if(s.kind==="chain"){boltLine(c.from,c.aim,hex);flash(c.from,hex,6,.3);return;}
  KINDS[s.kind](c,s);}
// the whole picture of the room arrived (you just came in, were away, or the server restarted). Take it — and if the server lost its memory,
// give back what this room had; things that are gone from a room that was never lost are really gone.
function worldSnapshot(keys,wid){const pend=new Set(WORLD.out.filter(e=>e.k==="key").map(e=>e.key)),lost=!!(WORLD.wid&&wid&&WORLD.wid!==wid),old=Object.keys(WORLD.known).filter(k=>!(k in keys)&&!pend.has(k));
  const again=lost?old.filter(k=>!/^(law|hold):/.test(k)).map(k=>[k,WORLD.known[k]]):[];
  worldApply(()=>{if(!lost)old.forEach(k=>applyKey(k,null));for(const k in keys)if(!pend.has(k))applyKey(k,keys[k]);});
  again.forEach(([k,v])=>{keys[k]=v;setKey(k,v);});
  const gone=placedGone();for(const k in keys)if(k.startsWith("pl:")&&gone.includes(k.slice(3))){worldApply(()=>applyKey(k,null));setKey(k,null);}
  WORLD.dead.splice(0).forEach(k=>setKey(k,null));
  PLACED.mine.forEach(q=>{const k=keys["pl:"+q.pid];if((!k||(fnOf(q.item)==="pet"&&k.u!==MP.id))&&!pend.has("pl:"+q.pid))placedShare(q,false,true);});PLACED.room=MP.room;   // a pet also says who its owner is now (a new id after every reload)
  if(!keys["hold:"+MP.id])HOLDING="";if(MYCAR.car&&!keys["mycar:"+MYCAR.id])MYCAR.room=null;if(MYBOAT.boat&&!keys["boat:"+MYCAR.id])MYBOAT.room=null;}
// hitting another player: they lose that much health in their own game
function hitPlayer(o,n,at){if(!o||!o.id||n<=0)return;share({k:"hit",to:o.id,n:Math.round(n)});popNum(at||o.g.position.clone().add(new THREE.Vector3(0,2.2,0)),`-${Math.round(n)}`,"burn");
  if(at)dent(at,P.pos.clone().sub(at).setY(0).normalize(),o.g);}
function stepMP(dt){for(const id in MP.others){const o=MP.others[id];o.g.position.lerp(o.to,Math.min(1,dt*10));let d=o.yaw-o.g.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));o.g.rotation.y+=d*Math.min(1,dt*10);
    if(o.car){const pr=o.car.g.position.clone();o.car.g.position.copy(o.g.position);o.car.g.position.y=0;o.car.g.rotation.y=o.g.rotation.y-Math.PI;o.car.spin+=pr.distanceTo(o.car.g.position)/.38;o.car.wheels.forEach(w=>w.children[0].rotation.x=o.car.spin);if(o.rig)o.rig.root.visible=false;}
    if(!o.glow){o.glow=new THREE.Mesh(new THREE.TorusGeometry(.7,.05,8,32),new THREE.MeshBasicMaterial({color:0xffd36a,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));o.glow.rotation.x=Math.PI/2;o.glow.position.y=.15;o.g.add(o.glow);}
    if(o.needs&&Math.random()<dt*.7){const c=o.needs[Math.floor(Math.random()*o.needs.length)];floatIcon(o.g.position,{F:"🍗",W:"💧",Z:"💤"}[c]);}
    o.glow.visible=!!o.might;if(o.might){o.glow.rotation.z+=dt*2;if(Math.random()<dt*10)SPARK.emit(o.g.position.clone().add(new THREE.Vector3(rnd(-.5,.5),rnd(.2,1.8),rnd(-.5,.5))),new THREE.Vector3(0,1.2,0),C(0xffd36a),.6,{grav:-.5});}
    if(o.rig&&SIT_CLIP&&!o.rig.clips.Sit_Chair_Idle)o.rig.clips.Sit_Chair_Idle=SIT_CLIP;
    {const rb=o.bo?Object.values(REMOTE_BOATS).find(b=>b.d===o.id):null,bk=o.bo?(rb?rb.k:"std"):"";if(bk!==(o.boatK||"")){o.boatK=bk;if(o.boatG)o.g.remove(o.boatG);o.boatG=null;if(bk){o.boatG=rb&&rb.parts?furnitureMesh(rb.parts):placedMesh({id:"boat"});o.boatG.rotation.y=Math.PI;o.g.add(o.boatG);}}}
    mpLook(o,dt);
    if(o.rig){if(o.hp<=0){if(o.rig.fullName!=="Death_A")o.rig.full("Death_A",{once:true});}else if(o.rig.fullName==="Death_A")o.rig.clearFull();
      o.rig.base(o.po==="sit"&&o.rig.clips.Sit_Chair_Idle?"Sit_Chair_Idle":o.po==="climb"||o.po==="sleep"||o.bo?"Idle":o.air?"Jump_Idle":o.sp>5?"Running_A":o.sp>.4?"Walking_A":"Idle");o.rig.update(dt);}}
  MP.t-=dt;if(MP.t>0||MP.busy||!started)return;MP.t=.15;MP.busy=true;
  const sent=[];{let sz=0;while(WORLD.out.length&&sent.length<40&&sz<60000){const e=WORLD.out.shift();sz+=e.k==="key"&&e.val?JSON.stringify(e).length:200;sent.push(e);}}const it=held(),body={ev:sent,since:WORLD.seq,wid:WORLD.wid,lock:MP.lockReq,room:MP.room,id:MP.id,x:P.pos.x,y:P.pos.y,z:P.pos.z,yaw:P.yaw,sp:P.speed,air:!P.onGround,car:P.inCar&&!P.inCar.boat?P.inCar.color:0,po:P.sitting?"sit":P.climbing?"climb":P.sleeping?"sleep":"",bo:P.inCar&&P.inCar.boat?1:0,hp:Math.round(P.hp),bf:(NEEDS&&NEEDS.bad.food?"F":"")+(NEEDS&&NEEDS.bad.water?"W":"")+(NEEDS&&NEEDS.bad.sleep?"Z":"")+(P.mightT>0?"S":"")+(P.shield>0?"B":"")+(P.invulnT>0?"H":""),held:itemInfo(it)?itemInfo(it).icon:"",hi:P.inCar?"":heldCode(it),hc:HAIR.c,fx:MP.fx};if(P.sleeping&&P.sleeping.spot)Object.assign(body,{x:P.sleeping.spot.x,y:P.sleeping.spot.y,z:P.sleeping.spot.z,yaw:P.sleeping.spot.r});
  fetch("/api/elementum/state",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify(body)})
    .then(r=>r.ok?r.json():null).then(j=>{MP.busy=false;if(!j||!j.players){MP.ok=false;WORLD.out.unshift(...sent);return;}MP.ok=true;if(typeof j.born==="number"&&j.born>0)ROOMLIFE.born=j.born;
      if(body.room!==MP.room)return;   // you changed rooms while this was on its way: it's about the old room
      if(j.keys)worldSnapshot(j.keys,j.wid);if(j.wid)WORLD.wid=j.wid;worldApply(()=>{if(j.keys){PICKUPS.filter(d=>d.sid&&!(("drop:"+d.sid) in j.keys)).forEach(d=>{scene.remove(d.g);PICKUPS.splice(PICKUPS.indexOf(d),1);});}(j.events||[]).forEach(applyEv);});
      if(typeof j.seq==="number")WORLD.seq=j.seq;(j.lost||[]).forEach(id=>{const it=TAKING[id];if(!it)return;delete TAKING[id];if(DROP_FULL[id]){delete DROP_FULL[id];}if(!addItem(it))dropItem(P.pos.clone(),it,300);else{const f=itemInfo(it);popNum(P.pos.clone().add(new THREE.Vector3(0,2.3,0)),`+${it.n||it.uses||1} ${f.name}`,"spell",f.pic);}});
      (j.won||[]).forEach(v=>{if(v&&v.s){delete TAKING[v.s];if(DROP_FULL[v.s]){v.it=DROP_FULL[v.s];delete DROP_FULL[v.s];}}if(v&&v.it&&!addItem(v.it))dropItem(P.pos.clone(),v.it,300);else if(v&&v.it){const f=itemInfo(v.it);popNum(P.pos.clone().add(new THREE.Vector3(0,2.3,0)),`+${v.it.n||v.it.uses||1} ${f.name}`,"spell",f.pic);}});MP.you=j.you||"";if(j.room===MP.room&&j.roomName&&j.roomName!==MP.roomName){MP.roomName=j.roomName;try{localStorage.setItem("elementum.roomName",MP.roomName);}catch(e){}}MP.list=j.players;if(body.lock!==undefined&&MP.lockReq===body.lock)delete MP.lockReq;setHouses(j.houses);mpApply(j.players);if(roomOpen)renderRoom();}).catch(()=>{MP.busy=false;MP.ok=false;WORLD.out.unshift(...sent);});}

// ---------------- the range in town: dummies with health bars (and slow guns) ----------------
const DUMMIES=[];
function dummy(x,z,name){const D=LOOK.dummy();const {g,bodyM,headM,tgt,tgt2,bar:arms}=D,[bm,hm]=D.mats;g.position.set(x,0,z);   // straw training dummy from Gemini's concept (look.js)
  const gun=gunModel("rifle");gun.scale.setScalar(.9);gun.rotation.x=-Math.PI/2;gun.position.set(.6,1.55,.12);g.add(gun);   // a gun in its right hand, pointing where it faces (+z)
  scene.add(g);
  const d={g,name,hp:100,max:100,down:false,parts:[bodyM,headM,tgt,tgt2,arms],mats:[bm,hm],bar:null,gun,gunCool:rnd(2,5)};bodyM.userData={dummy:d,part:"body"};headM.userData={dummy:d,part:"head"};tgt.userData={dummy:d,part:"body"};tgt2.userData={dummy:d,part:"body"};arms.userData={dummy:d,part:"body"};
  makeBar(d);DUMMIES.push(d);return d;}
function makeBar(d){const bar=document.createElement("div");bar.className="dbar";bar.innerHTML=`<span>${d.name}</span><div><i></i></div>`;$("#bars").appendChild(bar);d.bar=bar;d.barI=bar.querySelector("i");d.barS=bar.querySelector("span");}
// the dummies only stand once the training center is built (buildTraining brings them in); until then nothing there can be hit
[[-6,-14,"Dummy A"],[-3,-16,"Dummy B"],[0,-15,"Dummy C"],[3,-16,"Dummy D"],[6,-14,"Dummy E"],[0,-9,"Dummy F (close)"]].forEach(([x,z,n])=>{const d=dummy(x,z,n);d.down=d.unbuilt=true;d.g.visible=false;TRAIN.dummies.push(d);});
// ---------------- new places outside the walls (2026-11-22): the forest and the caves ----------------
// Silva Obscura, the dark forest north of town: hundreds of trees (drawn as instanced meshes so it stays fast), some you can chop,
// mushrooms, and monster packs living deep inside.
RNG=seedRnd(13);
const FOREST={x:-35,z:128,r:48};
{const n=420,trunkG=new THREE.CylinderGeometry(.22,.34,2.4,7),crownG=new THREE.ConeGeometry(1.7,4.2,8),ballG=new THREE.IcosahedronGeometry(1.5,1);
  const trunks=new THREE.InstancedMesh(trunkG,LOOK.toon(0x5a3a22),n),cones=new THREE.InstancedMesh(crownG,LOOK.toon(0x24552c),n),balls=new THREE.InstancedMesh(ballG,LOOK.toon(0x3a7a34),n);
  const M4=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3(),Pv=new THREE.Vector3();let k=0;
  for(let i=0;i<n*3&&k<n;i++){const a=RNG()*6.283,r=Math.sqrt(RNG())*FOREST.r,x=FOREST.x+Math.cos(a)*r,z=FOREST.z+Math.sin(a)*r;
    if(Math.abs(x-FOREST.x)<3&&z<FOREST.z)continue;   // the path in
    const s=rnd(.8,1.5);Pv.set(x,1.2*s,z);S.set(s,s,s);M4.compose(Pv,Q,S);trunks.setMatrixAt(k,M4);
    if(k%3){Pv.set(x,2.4*s+1.8*s,z);M4.compose(Pv,Q,S);cones.setMatrixAt(k,M4);balls.setMatrixAt(k,new THREE.Matrix4().makeScale(0,0,0));}
    else{Pv.set(x,2.6*s+1*s,z);M4.compose(Pv,Q,S);balls.setMatrixAt(k,M4);cones.setMatrixAt(k,new THREE.Matrix4().makeScale(0,0,0));}k++;}
  [trunks,cones,balls].forEach(m=>{m.castShadow=true;m.receiveShadow=true;scene.add(m);});
  const floor=new THREE.Mesh(new THREE.CircleGeometry(FOREST.r+4,48),new THREE.MeshLambertMaterial({color:0x35552a}));floor.rotation.x=-Math.PI/2;floor.position.set(FOREST.x,.012,FOREST.z);floor.receiveShadow=true;scene.add(floor);
  for(let i=0;i<40;i++){const a=RNG()*6.28,r=RNG()*FOREST.r,x=FOREST.x+Math.cos(a)*r,z=FOREST.z+Math.sin(a)*r;const g=new THREE.Group();g.position.set(x,0,z);
    const st=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.3,6),LOOK.toon(0xf0e8d8));st.position.y=.15;g.add(st);const cap=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6,0,6.3,0,1.6),LOOK.toon(i%2?0xc8432f:0xd8a03a));cap.position.y=.3;g.add(cap);scene.add(g);}
  for(let i=0;i<14;i++){const a=RNG()*6.28,r=rnd(8,FOREST.r-4);makeTree(FOREST.x+Math.cos(a)*r,FOREST.z+Math.sin(a)*r);}   // ones you can chop
  const sg=label("Silva Obscura — the dark forest",0x9dffb0);sg.scale.set(5,.9,1);sg.position.set(FOREST.x,4,FOREST.z-FOREST.r-2);scene.add(sg);}
// Caverna, the mines south of town: a rock hill with tunnels inside. It's dark in there — torches light the way — and the walls are
// full of iron and crystal. Cave monsters live in the far chambers.
const CAVE={x0:-30,z0:-172,cell:6,map:["##########","#...#....#","#.#.#.##.#","#.#...#..#","#.###.#.##","#.....#..#","####.#####"],h:4.5,torches:[],in:false};
{const C=CAVE,rows=C.map.length,cols=C.map[0].length;C.x1=C.x0+cols*C.cell;C.z1=C.z0+rows*C.cell;
  const rock=LOOK.toon(0x6a625a);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if(C.map[r][c]!=="#")continue;const x=C.x0+c*C.cell+C.cell/2,z=C.z0+r*C.cell+C.cell/2;const m=block(x,z,C.cell,C.h,C.cell,0x6a625a);}
  // the roof (you walk under it) and a lumpy hill on top
  {const m=block((C.x0+C.x1)/2,(C.z0+C.z1)/2,C.x1-C.x0,3,C.z1-C.z0,0x5a524a);m.position.y=C.h+1.5;BLOCKS[BLOCKS.length-1].y=C.h;}
  for(let i=0;i<26;i++){const b=LOOK.M(new THREE.DodecahedronGeometry(rnd(3,7)),rock,.03);b.position.set(rnd(C.x0+4,C.x1-4),C.h+3+rnd(0,2),rnd(C.z0+4,C.z1-4));b.rotation.set(rnd(0,3),rnd(0,3),0);b.scale.y=.55;b.castShadow=true;scene.add(b);}
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(C.x1-C.x0,C.z1-C.z0),new THREE.MeshLambertMaterial({color:0x4a443e}));fl.rotation.x=-Math.PI/2;fl.position.set((C.x0+C.x1)/2,.013,(C.z0+C.z1)/2);scene.add(fl);
  // torches: a flame you can see, and a light that only switches on while you're inside
  const open=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(C.map[r][c]===".")open.push([C.x0+c*C.cell+C.cell/2,C.z0+r*C.cell+C.cell/2]);C.open=open;
  open.filter((_,i)=>i%3===0).slice(0,7).forEach(([x,z])=>{const f=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),new THREE.MeshBasicMaterial({color:0xffa040}));f.position.set(x+rnd(-1.5,1.5),2.4,z+rnd(-1.5,1.5));scene.add(f);
    const l=new THREE.PointLight(0xffa860,0,16,1.5);l.position.copy(f.position);scene.add(l);C.torches.push(l);});
  // rich veins: more crystal and iron than anywhere else
  const kinds=["ferrum","ferrum","carbo","nimbus","silex","aether","electrum","ferrum","electrum","silex"];open.filter((_,i)=>i%2===1).slice(0,10).forEach(([x,z],i)=>makeNode(kinds[i],x+rnd(-1.2,1.2),z+rnd(-1.2,1.2)));
  const mouth=C.map[rows-1].indexOf(".");const sg=label("Caverna — the mines",0xffd27a);sg.scale.set(4,.8,1);sg.position.set(C.x0+mouth*C.cell+C.cell/2,C.h+1.5,C.z1+.5);scene.add(sg);C.mouth=new THREE.Vector3(C.x0+mouth*C.cell+C.cell/2,0,C.z1+2);}
const inCave=p=>p.x>CAVE.x0&&p.x<CAVE.x1&&p.z>CAVE.z0&&p.z<CAVE.z1&&p.y<CAVE.h;
const inForest=p=>Math.hypot(p.x-FOREST.x,p.z-FOREST.z)<FOREST.r;
function stepAreas(){const was=CAVE.in;CAVE.in=inCave(P.pos);if(CAVE.in){HEMI.intensity*=.12;sun.intensity*=.05;}CAVE.torches.forEach(l=>l.intensity=CAVE.in?2.2:0);
  if(inForest(P.pos)){HEMI.intensity*=.7;sun.intensity*=.75;}
  if(CAVE.in&&!was)lawSay("Caverna: dark tunnels, rich veins — and something moving in the far chambers…");}
// ---------------- monsters: each has a home, wanders, hunts you when you come near and casts its own spells ----------------
// Quaternius "Ultimate Monsters" (CC0, models/monsters/*.glb). They live outside the town walls and never come in. Walls stop their spells; they come back 25 s after you beat them.
const QA={idle:"Idle",walk:"Walk",run:"Run",cast:"Weapon",hit:"HitReact",death:"Death",punch:"Punch"},KA={idle:"Idle",walk:"Walking_D_Skeletons",run:"Running_A",cast:"Spellcast_Shoot",hit:"Hit_A",death:"Death_A",punch:"1H_Melee_Attack_Chop"};
const ENEMY_TYPES={
  demon:{name:"Demon",url:"monsters/demon.glb",scale:.64,hp:180,spells:["ignis","imber"],drops:["cornu"],core:"carbo",home:[155,32],speed:2.4,keep:9,barY:2.3,anim:QA},
  yeti:{name:"Yeti",url:"monsters/yeti.glb",scale:.7,hp:200,spells:["hasta","campus"],drops:["villus"],core:"nimbus",home:[-58,15],speed:2.2,keep:9,barY:2.3,anim:QA},
  king:{name:"Mushroom King",url:"monsters/mushroom_king.glb",scale:.6,hp:220,spells:["spinae","saxum"],drops:["sporae"],core:"silex",home:[-36,62],speed:1.8,keep:8,barY:2.4,anim:QA},
  ninja:{name:"Ninja",url:"monsters/ninja.glb",scale:.63,hp:160,spells:["sagittae","umbra"],drops:["pannus"],core:"aether",home:[56,-56],speed:3.2,keep:8,barY:2.3,anim:QA},
  frog:{name:"Frog",url:"monsters/frog.glb",scale:.72,hp:170,spells:["globus","fulmen"],drops:["gemma"],core:"electrum",home:[15,64],speed:2.6,keep:10,barY:2.3,anim:QA},
  orc:{name:"Orc",url:"monsters/orc.glb",scale:.62,hp:240,spells:["motus","saxum"],drops:["dens"],core:"silex",home:[-62,-42],speed:2.3,keep:6,barY:2.4,anim:QA},
  dino:{name:"Dino",url:"monsters/dino.glb",scale:.62,hp:210,spells:["draco","anulus"],drops:["squama"],core:"carbo",home:[172,-6],speed:2.8,keep:5,barY:2.4,anim:QA},
  monkroose:{name:"Monkroose",url:"monsters/monkroose.glb",scale:.7,hp:170,spells:["turbo","sagittae"],drops:["pluma"],core:"aether",home:[-8,-74],speed:3,keep:9,barY:2.3,anim:QA},
  shade:{name:"Blue Demon",url:"monsters/blue_demon.glb",scale:.7,hp:200,spells:["nox","tenebrae","radius"],drops:["cinis"],core:"electrum",home:[46,76],speed:2.5,keep:10,barY:2.3,anim:QA},
  // the graveyard to the far west (2026-11-22, "add more monsters"): KayKit's skeletons (CC0), four packs
  skwar:{name:"Skeleton Warrior",url:"monsters/skeleton_warrior.glb",scale:1,hp:230,spells:["spinae","motus"],drops:["dens"],core:"silex",home:[-105,-12],speed:2.5,keep:7,barY:2.5,anim:KA},
  skmage:{name:"Skeleton Mage",url:"monsters/skeleton_mage.glb",scale:1,hp:170,spells:["nox","stella","tenebrae"],drops:["cinis"],core:"electrum",home:[-98,-78],speed:2.2,keep:12,barY:2.5,anim:KA},
  skrogue:{name:"Skeleton Rogue",url:"monsters/skeleton_rogue.glb",scale:1,hp:160,spells:["umbra","sagittae"],drops:["pannus"],core:"aether",home:[70,-105],speed:3.3,keep:8,barY:2.5,anim:KA},
  // the dark forest's packs, and the cave's (homes inside the tunnels; they stay close together)
  fninja:{name:"Forest Ninja",url:"monsters/ninja.glb",scale:.63,hp:190,spells:["umbra","nox","sagittae"],drops:["pannus"],core:"aether",home:[-52,140],speed:3.4,keep:9,barY:2.3,anim:QA},
  bogfrog:{name:"Bog Frog",url:"monsters/frog.glb",scale:.8,hp:200,spells:["unda","bulla","globus"],drops:["gemma"],core:"nimbus",home:[-18,112],speed:2.6,keep:8,barY:2.3,anim:QA},
  wildmonk:{name:"Wild Monkroose",url:"monsters/monkroose.glb",scale:.75,hp:190,spells:["turbo","ventus"],drops:["pluma"],core:"aether",home:[-35,160],speed:3.2,keep:9,barY:2.3,anim:QA},
  cavedemon:{name:"Cave Demon",url:"monsters/blue_demon.glb",scale:.68,hp:240,spells:["nox","tenebrae","ignis"],drops:["cinis"],core:"electrum",home:[CAVE.x0+8*6+3,CAVE.z0+6+3],speed:2.4,keep:3,spread:1.4,barY:2.3,anim:QA},
  tunnel:{name:"Tunnel Skeleton",url:"monsters/skeleton_warrior.glb",scale:.95,hp:200,spells:["spinae","saxum"],drops:["dens"],core:"silex",home:[CAVE.x0+1*6+3,CAVE.z0+6+3],speed:2.6,keep:3,spread:1.4,barY:2.5,anim:KA},
  rockorc:{name:"Rock Orc",url:"monsters/orc.glb",scale:.62,hp:260,spells:["motus","saxum","spinae"],drops:["dens"],core:"silex",home:[CAVE.x0+8*6+3,CAVE.z0+5*6+3],speed:2.3,keep:3,spread:1.4,barY:2.4,anim:QA},
  skmin:{name:"Skeleton Minion",url:"monsters/skeleton_minion.glb",scale:.9,hp:120,spells:["tenebrae","ignis"],drops:["cinis"],core:"carbo",home:[105,92],speed:3,keep:6,barY:2.3,anim:KA},
};
const ENEMIES=[];
function spawnEnemy(key,chief,i,pack){const T=ENEMY_TYPES[key];const k=chief?1.2:.82;const a=i*2.1,sp=T.spread||4,home=new THREE.Vector3(T.home[0]+(chief?0:Math.cos(a)*sp),0,T.home[1]+(chief?0:Math.sin(a)*sp));
  const g=new THREE.Group();g.position.copy(home);scene.add(g);
  const hex=FX.HEX[MAT[T.core].el];
  const rune=new THREE.Mesh(new THREE.RingGeometry(.75,.9,40),new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:.6,depthWrite:false}));rune.rotation.x=-Math.PI/2;rune.position.y=.02;g.add(rune);
  const hitM=new THREE.MeshBasicMaterial({visible:false});   // simple shapes the shots test against (the animated model itself is not ray-tested)
  const bodyP=new THREE.Mesh(new THREE.CylinderGeometry(.45*k,.45*k,1.2*k,10),hitM);bodyP.position.y=.65*k;g.add(bodyP);
  const headP=new THREE.Mesh(new THREE.SphereGeometry(.42*k,10,8),hitM);headP.position.y=1.55*k;g.add(headP);
  const hp=Math.round(T.hp*(chief?2.8:1));   // tough: the starter rifle can't beat them — craft a weapon or use spells
  const d={g,name:chief?T.name+" chief":T.name,hp,max:hp,down:false,parts:[bodyP,headP],mats:[],bar:null,barY:T.barY*k,rig:null,enemy:key,T,anim:T.anim,cool:rnd(1,3),punchCool:0,casting:0,wander:null,wanderT:0,strafe:1,alert:0,
    chief,home,pack,keep:chief?T.keep:2.2,speed:T.speed*(chief?1:1.15),castK:chief?1:3};pack.push(d);
  bodyP.userData={dummy:d,part:"body"};headP.userData={dummy:d,part:"head"};makeBar(d);DUMMIES.push(d);ENEMIES.push(d);
  LOOK.loadRig("/play/elementum/models/"+T.url,false,r=>{if(!r)return;d.rig=r;r.root.scale.setScalar(T.scale*k);g.add(r.root);r.base(T.anim.idle,{snap:true});d.mats=r.mats;r.mats.forEach(m=>{m.userData.base=m.color.getHex();});});
  return d;}
const PACKS=[];Object.keys(ENEMY_TYPES).forEach(key=>{const pack=[];PACKS.push(pack);spawnEnemy(key,true,0,pack);for(let i=0;i<3;i++)spawnEnemy(key,false,i,pack);});
ENEMIES.forEach((d,i)=>{d.idx=i;});
// ---- the same monsters for everyone (2026-11-21, "monsters aligned"): each pack is looked after by one player — the one with the smallest id
// among the players near the pack's home. That player's game moves the monsters, picks who they chase (whoever is nearest) and sends where
// they are 7 times a second; everyone else just shows them there. Hits from the others are sent to that player; the loot lands for everyone.
const MOB_R=110,MOBNET={t:0};
function packOwner(pack){if(!MP.ok)return MP.id;const h=pack[0].home;let best=null;const see=(id,x,z)=>{if(Math.hypot(x-h.x,z-h.z)<MOB_R&&(best===null||id<best))best=id;};
  see(MP.id,P.pos.x,P.pos.z);(MP.list||[]).forEach(q=>see(q.id,q.x,q.z));return best===null?MP.id:best;}
function mobPlayers(){const L=[{id:MP.id,pos:P.pos,down:P.down,me:true}];if(MP.ok)for(const id in MP.others){const o=MP.others[id];L.push({id,pos:o.g.position,down:o.hp<=0,me:false});}return L;}
function mobAct(d,a){d.act=a;d.actN=(d.actN||0)+1;}
function mobSend(dt){MOBNET.t-=dt;if(MOBNET.t>0||!MP.ok)return;MOBNET.t=.15;
  PACKS.forEach((pk,pi)=>{if(!pk.mine)return;const h=pk[0].home;if(!(MP.list||[]).some(q=>Math.hypot(q.x-h.x,q.z-h.z)<MOB_R))return;
    share({k:"mobs",p:pi,l:pk.map(d=>[R2(d.g.position.x),R2(d.g.position.z),Math.round(d.g.rotation.y*100)/100,Math.round(d.hp),d.baseA||"idle",d.act||"",d.actN||0,d.down?1:0,d.castId||"",d.castTo||"",d.aimAt?R2(d.aimAt.x):0,d.aimAt?R2(d.aimAt.z):0])});});}
function mobNet(d,a){if(!Array.isArray(a))return;const [x,z,ry,hp,base,act,n,down,sp,to,ax,az]=a;d.net={x:+x||0,z:+z||0,ry:+ry||0,base:String(base)};
  if(down&&!d.down){d.down=true;enemyDown(d);}
  if(!d.down&&typeof hp==="number")d.hp=Math.min(d.hp,hp);
  if(n!==d.netN){const first=d.netN===undefined;d.netN=n;if(first||d.down||!act||!d.anim[act])return;
    if(d.rig)d.rig.full(d.anim[act],{once:true,restart:true,dur:act==="cast"?.9:.6,then:()=>{if(!d.down)d.rig.clearFull();}});
    if(act==="cast"&&SPELLS[sp]){const o=MP.others[to];d.aimAt=to===MP.id?null:o?o.g.position.clone():new THREE.Vector3(+ax||0,0,+az||0);setTimeout(()=>{if(!d.down)castAs(d,sp);},450);}}}
function stepGhost(d,dt){const r=d.rig;if(r&&d.g.position.distanceTo(P.pos)<80)r.update(dt);if(d.down||!d.net)return;const g=d.g,n=d.net;
  const dx=n.x-g.position.x,dz=n.z-g.position.z;if(Math.hypot(dx,dz)>8){g.position.x=n.x;g.position.z=n.z;}else{const k=Math.min(1,dt*10);g.position.x+=dx*k;g.position.z+=dz*k;}
  let dd=n.ry-g.rotation.y;dd=Math.atan2(Math.sin(dd),Math.cos(dd));g.rotation.y+=dd*Math.min(1,dt*10);
  if(r&&!r.fullName)r.base(d.anim[n.base]||d.anim.idle);}
// tombstones around the skeletons' homes
["skwar","skmage","skrogue","skmin"].forEach(k=>{const [hx,hz]=ENEMY_TYPES[k].home;for(let i=0;i<9;i++){const a=i/9*6.28+rnd(-.2,.2),r=rnd(5,9);const t=LOOK.M(new THREE.BoxGeometry(.8,rnd(.9,1.4),.25),LOOK.toon(0x8a8a90),.015);
  t.position.set(hx+Math.cos(a)*r,.5,hz+Math.sin(a)*r);t.rotation.y=a+rnd(-.3,.3);t.rotation.z=rnd(-.15,.15);t.castShadow=true;scene.add(t);}});   // 9 packs of 4: they swarm together
function blockedAt(p){if(isWater(p.x,p.z,false)||inTown(p,1.5)||(typeof inArena==="function"&&inArena(p)))return true;   // monsters keep out of town and the arena
  for(const b of BLOCKS){if(b.h<.3||b.y>2||b.pass)continue;if(Math.abs(p.x-b.x)<b.w/2+.5&&Math.abs(p.z-b.z)<b.d/2+.5)return true;}return false;}
function enemyDown(d){const T=d.T;const at=d.g.position.clone();const loot=!d.pack||d.pack.mine!==false;
  const dropItem=(a,it)=>{if(!loot)return;const dp=DROP_ITEM(a,it);if(MP.ok)shareDrop(dp);return dp;};
  if(!d.chief){dropItem(at,{t:"coin",n:ri(2,5)});if(Math.random()<.4)dropItem(at,{t:"mat",id:T.core,n:1});if(Math.random()<.3)dropItem(at,{t:"mat",id:pick(T.drops),n:1});}
  else{dropItem(at,{t:"mat",id:T.core,n:ri(1,2)});dropItem(at,{t:"coin",n:ri(8,15)});T.drops.forEach(id=>dropItem(at,{t:"mat",id,n:ri(1,2)}));}
  if(Math.random()<(d.chief?.7:.2))dropItem(at,{t:"spell",id:pick(T.spells),uses:SPELLS[pick(T.spells)].uses});
  if(d.rig)d.rig.full(d.anim.death,{once:true,restart:true});
  setTimeout(()=>tween(.8,t=>{d.g.position.y=-t*1.5;}),2200);
  setTimeout(()=>{d.hp=d.max;d.g.position.copy(d.home);d.slowT=d.stunT=0;d.pushV=null;d.casting=0;
    if(d.rig&&d.anim.rise)d.rig.full(d.anim.rise,{once:true,restart:true,then:()=>{d.rig.clearFull();d.down=false;}});
    else{if(d.rig)d.rig.clearFull();d.g.scale.setScalar(.01);tween(.6,t=>d.g.scale.setScalar(Math.max(.01,t)),()=>{d.down=false;});}},25000);}

function stepEnemies(dt){stepNightMobs();const PL=mobPlayers();PACKS.forEach(pk=>{pk.mine=packOwner(pk)===MP.id;});mobSend(dt);
  for(const d of ENEMIES){const r=d.rig;if(!d.pack.mine){stepGhost(d,dt);continue;}
    let tg=null,td=1e9,near=1e9;for(const q of PL){const dd=Math.hypot(q.pos.x-d.g.position.x,q.pos.z-d.g.position.z);near=Math.min(near,dd);if(q.down||inTown(q.pos,.5))continue;if(dd<td){td=dd;tg=q;}}
    const far=near>80;if(r&&!far)r.update(dt);if(d.down||far)continue;const T=d.T,A=d.anim,g=d.g,TP=tg?tg.pos:P.pos;d.tg=tg;
    d.stunT=Math.max(0,(d.stunT||0)-dt);d.slowT=Math.max(0,(d.slowT||0)-dt);d.cool-=dt;d.punchCool-=dt;d.alert=Math.max(0,d.alert-dt);d.wanderT-=dt;
    if(d.pushV){const np=g.position.clone().addScaledVector(d.pushV,dt);if(!blockedAt(np))g.position.copy(np);d.pushV.multiplyScalar(Math.pow(.02,dt));if(d.pushV.length()<.2)d.pushV=null;}
    if(d.stunT>0){d.baseA="idle";if(r)r.base(A.idle);continue;}
    if(d.casting>0){d.casting-=dt;if(d.casting<=0){if(d.tg)d.aimAt=d.tg.me?null:d.tg.pos.clone();castAs(d,d.castId);}continue;}
    const to=new THREE.Vector3(TP.x-g.position.x,0,TP.z-g.position.z);const dist=to.length();to.normalize();
    const home=d.home;const fromHome=g.position.distanceTo(home);
    const hunting=!!tg&&(dist<26*(1+.6*DAY.night)||d.alert>0)&&fromHome<50+20*DAY.night;   // at night they see farther and roam wider
    if(hunting&&!d.hunting)d.pack.forEach(m=>{m.alert=Math.max(m.alert,8);});d.hunting=hunting;let dir=null,speed=0,face=null;   // one sees you, the whole pack comes
    if(hunting){face=to;
      if(dist>d.keep+2){dir=to;speed=d.speed*1.5;}else if(dist<d.keep-4&&dist>2.6){dir=to.clone().negate();speed=d.speed;}
      else{if(Math.random()<dt*.4)d.strafe=-d.strafe;dir=new THREE.Vector3(-to.z,0,to.x).multiplyScalar(d.strafe);speed=d.speed*.6;}
      if(dist<2.4&&d.punchCool<=0){d.punchCool=1.8;mobAct(d,"punch");if(r)r.full(A.punch,{once:true,restart:true,dur:.6,then:()=>{if(!d.down)r.clearFull();}});const who=tg;
        setTimeout(()=>{if(d.down)return;if(who.me){if(P.pos.distanceTo(g.position)<2.8)hurt(8);}else if(who.pos.distanceTo(g.position)<2.8)share({k:"hit",to:who.id,n:8,m:d.name});},250);}
      else if(d.cool<=0&&dist<24){const eye=g.position.clone().add(new THREE.Vector3(0,1.4,0));
        if(!wallBetween(eye,TP.clone().add(new THREE.Vector3(0,1.1,0)))){d.cool=rnd(3,4.5)*d.castK;d.castId=pick(T.spells);d.casting=.45;dir=null;d.castTo=tg.id;d.aimAt=tg.me?null:TP.clone();mobAct(d,"cast");
          if(r)r.full(A.cast,{once:true,restart:true,dur:.9,then:()=>{if(!d.down)r.clearFull();}});}else d.cool=.6;}}
    else{if(!d.wander||d.wanderT<=0||g.position.distanceTo(d.wander)<.8){const a=Math.random()*6.3,rr=rnd(2,9);d.wander=home.clone().add(new THREE.Vector3(Math.cos(a)*rr,0,Math.sin(a)*rr));d.wanderT=rnd(4,8);d.pause=rnd(.5,2.5);}
      if(d.pause>0)d.pause-=dt;else{dir=d.wander.clone().sub(g.position).setY(0).normalize();speed=d.speed*.55;}face=dir;}
    if(dir&&speed>0){speed*=d.slowT>0?.45:1;const np=g.position.clone().addScaledVector(dir,speed*dt);
      if(!blockedAt(np))g.position.copy(np);else{const nx=g.position.clone();nx.x=np.x;const nz=g.position.clone();nz.z=np.z;if(!blockedAt(nx))g.position.copy(nx);else if(!blockedAt(nz))g.position.copy(nz);else{d.wanderT=0;d.strafe=-d.strafe;}}
      g.position.x=clamp(g.position.x,-180,180);g.position.z=clamp(g.position.z,-180,180);
      d.baseA=speed>d.speed*1.2?"run":"walk";if(r&&!r.fullName)r.base(speed>d.speed*1.2?A.run:A.walk,{speed:speed>d.speed*1.2?1:Math.max(.6,speed/d.speed)});}
    else{d.baseA="idle";if(r)r.base(A.idle);}
    if(face){const want=Math.atan2(face.x,face.z);let dd=want-g.rotation.y;dd=Math.atan2(Math.sin(dd),Math.cos(dd));g.rotation.y+=dd*Math.min(1,7*dt);}}}
// ---------------- dummies have guns: they turn to you and now and then fire a slow glowing bullet you can dodge (walls stop it) ----------------
const DSHOTS=[];
function stepDummyGuns(dt){for(const d of DUMMIES){if(!d.gun||d.down)continue;const to=P.pos.clone().sub(d.g.position);to.y=0;const dist=to.length();
    if(dist>22||P.down||!inTraining(P.pos))continue;const want=Math.atan2(to.x,to.z);let dd=want-d.g.rotation.y;dd=Math.atan2(Math.sin(dd),Math.cos(dd));d.g.rotation.y+=dd*Math.min(1,2*dt);
    if((d.stunT=Math.max(0,(d.stunT||0)-dt))>0)continue;
    d.gunCool-=dt;if(d.gunCool>0||Math.abs(dd)>.3)continue;d.gunCool=rnd(5,8);
    const m=d.gun.localToWorld(d.gun.userData.muzzle.clone());const aim=P.pos.clone().add(new THREE.Vector3(0,1.1,0)).add(rnd3(.4));
    const s=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),glow(0xff8a4a,2));s.position.copy(m);scene.add(s);muzzle(m,aim.clone().sub(m).normalize(),0xff9a6a,.3);
    DSHOTS.push({s,v:aim.sub(m).normalize().multiplyScalar(7),life:5});}
  for(let i=DSHOTS.length-1;i>=0;i--){const b=DSHOTS[i];const p0=b.s.position.clone();b.s.position.addScaledVector(b.v,dt);b.life-=dt;const p=b.s.position;if(Math.random()<.5)SPARK.emit(p,rnd3(.3),C(0xff8a4a),.25);
    let done=b.life<=0||p.y<.05;const wall=!done&&blockAt(p);if(wall){wallHit(wall,p,faceNormal(wall,p),.3);done=true;}
    if(!done&&!P.down&&segDist(p0,p,P.pos.clone().add(new THREE.Vector3(0,1,0)))<.6){hurt(2);done=true;}
    if(done){sparks(p,6,0xff8a4a);scene.remove(b.s);DSHOTS.splice(i,1);}}}

function hitTargets(){const t=[...SOLIDS];for(const id in MP.others)if(MP.others[id].hb)t.push(MP.others[id].hb);PEOPLE.forEach(pp=>{if(!pp.down&&pp.o.g.visible!==false)t.push(pp.hb);});NODES.forEach(n=>{if(!n.down)t.push(n.rock);});TREES.forEach(tr=>{if(!tr.down)t.push(tr.trunk);});DUMMIES.forEach(d=>{if(!d.down)t.push(...d.parts);});return t;}
function damage(d,n,at,headshot,o){o=o||{};if(d.down)return;if(P.mightT>0)n=Math.round(n*1.5);else if(P.strongT>0)n=Math.round(n*1.25);   // Potio Fortis, grilled fish
  const el=o.el||"plain",hex=FX.HEX[el];d.hp=Math.max(0,d.hp-n);if(d.enemy){if(d.pack.mine===false&&MP.ok)share({k:"mdmg",i:d.idx,n});else if(d.hp>0)mobAct(d,"hit");}popNum(at,(headshot?"HEAD ":"")+"-"+n,headshot?"head":"");sparks(at,12,hex);
  if(!o.area){FX.impact(at,el,headshot?1.0:.7);FX.stars(at,el,headshot?3:2,.9);}
  $("#xh").classList.add("hit");setTimeout(()=>$("#xh").classList.remove("hit"),90);
  d.mats.forEach(m=>{m.emissive.setHex(hex);m.emissiveIntensity=.8;});setTimeout(()=>d.mats.forEach(m=>m.emissiveIntensity=0),120);
  if(!d.enemy&&d.hp>0&&TRAIN.dummies.includes(d))share({k:"dummy",i:TRAIN.dummies.indexOf(d),h:Math.round(d.hp)});
  const kick=o.el==="air"?.45:.18;if(d.enemy){d.alert=8;d.pack.forEach(m=>{m.alert=Math.max(m.alert,8);});}if(d.rig){if(d.hp>0&&!d.casting)d.rig.full(d.anim.hit,{once:true,restart:true,dur:.45,then:()=>{if(!d.down)d.rig.clearFull();}});}
  else{const r0=d.g.rotation.z;tween(.25,t=>{d.g.rotation.z=r0+Math.sin(t*Math.PI)*kick*(at.x<d.g.position.x?1:-1);},()=>{d.g.rotation.z=r0;});}
  if(!o.chain)status(d,el,at);
  if(d.hp<=0){d.down=true;P.downed++;questKill(d);$("#sub").textContent=`Oppidum and the wilds · knocked down: ${P.downed}`;
    if(d.enemy){enemyDown(d);return;}
    dropItem(d.g.position,{t:"mat",id:"lignum",n:2});dropItem(d.g.position,{t:"coin",n:ri(1,3)});if(Math.random()<.4){const id=pick(DROP_SPELLS);dropItem(d.g.position,{t:"spell",id,uses:SPELLS[id].uses});}
    if(TRAIN.dummies.includes(d))share({k:"dummy",i:TRAIN.dummies.indexOf(d)});dummyFall(d);}}
function dummyFall(d){tween(.45,t=>{d.g.rotation.x=-t*t*Math.PI/2;},()=>{setTimeout(()=>{d.hp=d.max;tween(.4,t=>{d.g.rotation.x=-(1-t)*Math.PI/2;},()=>{d.down=false;d.g.rotation.x=0;});},3000);});}
// what the crystal does on a hit, beyond the damage
function status(d,el,at){const hex=FX.HEX[el];
  if(el==="ice"){d.slowT=Math.max(d.slowT||0,2.5);d.mats.forEach(m=>m.color.setHex(0xbfe8ff));setTimeout(()=>d.mats.forEach(m=>m.color.setHex(m.userData.base)),1500);}
  if(el==="fire"){FX.burning(d.g,"fire",1.5,1.1);let ticks=3;const tick=()=>{if(d.down||ticks--<=0)return;d.hp=Math.max(0,d.hp-4);if(d.enemy&&d.pack.mine===false&&MP.ok)share({k:"mdmg",i:d.idx,n:4});popNum(d.g.position.clone().add(new THREE.Vector3(0,2.1,0)),"-4 burn","burn");if(d.hp<=0)damage(d,0,at,false,{chain:true,el});setTimeout(tick,450);};setTimeout(tick,450);}
  else if(el==="water"){FX.burning(d.g,"water",.9,.9);for(let i=0;i<18;i++)SPARK.emit(at.clone().add(rnd3(.3)),new THREE.Vector3(rnd(-.5,.5),rnd(-.5,1),rnd(-.5,.5)),C(0x4cc3ff),rnd(.5,.9),{grav:6});d.mats.forEach(m=>m.color.setHex(0x5a6a7e));setTimeout(()=>d.mats.forEach(m=>m.color.setHex(m.userData.base)),1800);}
  else if(el==="earth"){for(let i=0;i<4;i++){const r=new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(.06,.11)),mat(0x8a6a44));r.position.copy(at);scene.add(r);const v=rnd3(1).normalize().multiplyScalar(rnd(2,4));v.y=Math.abs(v.y)+2;tween(.7,t=>{r.position.copy(at).add(v.clone().multiplyScalar(t)).add(new THREE.Vector3(0,-6*t*t,0));r.rotation.x+=.2;},()=>scene.remove(r));}for(let i=0;i<8;i++)PUFF.emit(at,rnd3(1),C(0x8a7a60).multiplyScalar(.5),.6,{drag:2});shake(.06);}
  else if(el==="air"){for(let i=0;i<14;i++)PUFF.emit(at,rnd3(1).normalize().multiplyScalar(rnd(2,5)),C(0xdff1ff).multiplyScalar(.45),.4,{drag:3});}
  else if(el==="lightning"){let best=null,bd=7;DUMMIES.forEach(x=>{if(x===d||x.down)return;const dist=x.g.position.distanceTo(d.g.position);if(dist<bd){bd=dist;best=x;}});
    if(best){const b=best.g.position.clone().add(new THREE.Vector3(0,1.4,0));setTimeout(()=>{boltLine(at,b,hex);FX.stars(b,"lightning",2,.9);damage(best,Math.round(WEAPONS[G.id].dmg*.6),b,false,{chain:true,el});},80);}
    for(let i=0;i<10;i++)SPARK.emit(at,rnd3(1).normalize().multiplyScalar(rnd(2,5)),C(hex),.25,{drag:2});}}
function popNum(p,text,cls,pic){const v=p.clone().project(cam);if(v.z>1)return;const el=document.createElement("span");el.className=cls||"";el.textContent=text;if(pic)el.insertAdjacentHTML("afterbegin",img(pic,"in"));el.style.left=(v.x+1)/2*innerWidth+"px";el.style.top=(1-v.y)/2*innerHeight+"px";$("#nums").appendChild(el);setTimeout(()=>el.remove(),900);}
// beaten: everything you carry falls where you are (like Minecraft); coins and the house chest stay with you
function dropAll(){const at=P.pos.clone();at.y=Math.max(0,floorUnder());at.drop=true;let n=0;for(let i=0;i<INV.length;i++){const it=INV[i];if(!it)continue;if(it.t==="weapon")it.ammo=null;shareDrop(dropItem(at,it,300));INV[i]=null;n++;}
  G.item=null;select(SEL);invHud();return n;}
function hurt(n){if(P.down||n<=0)return;if(P.sleeping)endSleep(false,"something woke you up!");const at=P.pos.clone().add(new THREE.Vector3(0,2.2,0));
  if(P.invulnT>0){popNum(at,"blocked","spell");return;}
  if(P.shield>0){const a=Math.min(P.shield,n);P.shield-=a;n-=a;popNum(at,"shield -"+a,"spell");if(n<=0)return;}
  if(P.toughT>0)n=Math.max(1,Math.round(n*.75));   // cheese
  P.hp=Math.max(0,P.hp-n);P.lastHit=tAcc;$("#vig").classList.add("on");setTimeout(()=>$("#vig").classList.remove("on"),160);shake(.08);hud();   // no healing by itself: only spells and potions heal
  if(P.hp<=0&&LAW.wanted){P.hp=1;return;}
  if(P.hp<=0)fallDown();}
function fallDown(why){if(P.down)return;if(P.sleeping)endSleep(false,"");P.hp=0;hud();P.down=true;toggleBag(false);const n=dropAll();$("#downMsg").textContent=(why?why+" ":"")+(n?`Everything you carried (${n} ${n===1?"stack":"stacks"}) is lying where you fell — go back for it within 5 minutes. Your coins and your chest are safe.`:"Health is back to full when you come back.");$("#down").classList.remove("hidden");if(document.exitPointerLock)document.exitPointerLock();}
function respawn(){if(P.inCar)exitCar();P.climbing=null;P.sitting=null;P.fallTop=undefined;P.hp=P.maxHp;P.down=false;if(HOME.slept)P.pos.copy(HOME.door);else P.pos.set(0,0,0);P.vel.set(0,0,0);P.shield=P.shieldT=P.invulnT=P.buffT=P.slowT=P.regenT=P.toughT=P.strongT=P.jumpT=P.mightT=P.dizzyT=P.sickT=P.flipT=0;["food","water","sleep"].forEach(k=>NEEDS[k]=Math.max(NEEDS[k],60));$("#down").classList.add("hidden");select(SEL);if(held()&&held().t==="weapon")equip(held().id,held());hud();}
function hud(){const w=WEAPONS[G.id];const c=CRYSTALS[G.crystal];const it=held(),f=itemInfo(it);
  $("#wep").classList.toggle("noweap",!(it&&it.t==="weapon"));
  if(it&&it.t==="weapon"){$("#wname").textContent=w.name;$("#ammo").textContent=`${G.ammo} / ${w.mag}`;$("#crys").textContent=`${c.name} crystal · ${c.el}`;$("#crys").style.color="#"+FX.HEX[c.el].toString(16).padStart(6,"0");}
  else{$("#wname").innerHTML=f?`${img(f.pic,"in")} ${esc(f.name)}`:`${img("hand_fist","in")} Fists`;$("#ammo").textContent=f?(it.t==="spell"?"●".repeat(Math.min(12,f.count)):"× "+f.count):"—";
    $("#crys").textContent=f?(it.t==="spell"?`${f.what} · click to cast`:it.t==="potion"?(it.id==="fortis"?"click to drink · shared with players near you":"click to drink · +50 HP"):it.t==="food"?`click to eat · ${f.what}`:`${f.what}${f.num?` · number ${f.num}`:""} · craft with E`):"click to punch · rocks break slowly";$("#crys").style.color="";}
  $("#rlbar").style.width=G.reloading?((1-G.reloading/G.reloadT)*100)+"%":"0%";$("#wep").classList.toggle("empty",!!(it&&it.t==="weapon"&&G.ammo===0&&!G.reloading));
  $("#hpn").textContent=Math.round(P.hp)+(P.shield>0?` + 🫧${Math.round(P.shield)}`:"");$("#hpbar").style.width=(100*P.hp/P.maxHp)+"%";$("#hpbar").classList.toggle("low",P.hp<35);}

// ---------------- input ----------------
const keys={};let look={yaw:0,pitch:.22},stick={x:0,y:0},jumpQ=false,runBtn=false,paused=false,started=false,camSide=1;
addEventListener("keydown",e=>{if(e.target&&e.target.matches&&e.target.matches("input,textarea"))return;if(designOpen()){if(e.key==="Escape"){if(BUILD.ideasOpen())BUILD.closeIdeas();else if(BUILD.isOpen())BUILD.close();else DESIGN.close();}return;}keys[e.code]=true;if(e.code==="KeyM"){toggleRoom();return;}if(roomOpen&&e.key==="Escape"){toggleRoom(false);return;}if(e.code==="Space"){e.preventDefault();jumpQ=true;}if(e.code==="KeyE"||e.code==="KeyI"||e.code==="Tab"){e.preventDefault();toggleBag();return;}if(e.code==="KeyT"&&!bagOpen){useAct();return;}if(bagOpen){if(e.key==="Escape")toggleBag(false);return;}
  if(e.code==="KeyR")reload();const dg=/^Digit([1-9])$/.exec(e.code);if(dg)select(+dg[1]-1);if(e.code==="KeyQ")cycleCrystal();if(e.code==="KeyG")dropOwn(SEL);if(e.code==="KeyF"){useHeld(true);}if(e.key==="p"||e.key==="P"||(e.key==="Escape"&&!document.pointerLockElement))togglePause();});
addEventListener("wheel",e=>{if(!started||bagOpen||paused)return;select(SEL+(e.deltaY>0?1:-1));},{passive:true});
addEventListener("keyup",e=>{keys[e.code]=false;});
const touch=matchMedia("(pointer:coarse)").matches||"ontouchstart" in window;if(touch)document.body.classList.add("touch");
let dragId=null,lastX=0,lastY=0;
canvas.addEventListener("pointerdown",e=>{if(!started||paused||bagOpen||roomOpen||designOpen()||P.sleeping)return;
  if(e.pointerType==="mouse"){if(e.button===0)G.firing=true;if(!document.pointerLockElement&&canvas.requestPointerLock)canvas.requestPointerLock();return;}
  if(e.clientX<innerWidth*.45)return;dragId=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener("pointermove",e=>{look.moved=performance.now();if(document.pointerLockElement===canvas){look.yaw-=e.movementX*.0032;look.pitch=clamp(look.pitch+e.movementY*.0025,-.5,1.1);return;}if(e.pointerId!==dragId)return;look.yaw-=(e.clientX-lastX)*.006;look.pitch=clamp(look.pitch+(e.clientY-lastY)*.005,-.5,1.1);lastX=e.clientX;lastY=e.clientY;});
addEventListener("pointerup",e=>{if(e.pointerId===dragId)dragId=null;if(e.pointerType==="mouse")G.firing=false;});addEventListener("pointercancel",e=>{if(e.pointerId===dragId)dragId=null;});
const stickEl=$("#stick"),knob=stickEl.querySelector("i");let stickId=null;
function stickAt(e){const r=stickEl.getBoundingClientRect();const dx=(e.clientX-(r.left+r.width/2))/(r.width/2),dy=(e.clientY-(r.top+r.height/2))/(r.height/2);const l=Math.hypot(dx,dy)||1;const k=Math.min(1,l);stick.x=dx/l*k;stick.y=dy/l*k;knob.style.transform=`translate(${stick.x*40}px,${stick.y*40}px)`;}
stickEl.addEventListener("pointerdown",e=>{stickId=e.pointerId;stickEl.setPointerCapture(e.pointerId);stickAt(e);});
stickEl.addEventListener("pointermove",e=>{if(e.pointerId===stickId)stickAt(e);});
const stickEnd=e=>{if(e.pointerId!==stickId)return;stickId=null;stick.x=stick.y=0;knob.style.transform="";};
stickEl.addEventListener("pointerup",stickEnd);stickEl.addEventListener("pointercancel",stickEnd);
$("#jump").addEventListener("pointerdown",e=>{e.preventDefault();jumpQ=true;});
$("#run").addEventListener("pointerdown",e=>{e.preventDefault();runBtn=!runBtn;$("#run").classList.toggle("on",runBtn);});
$("#fire").addEventListener("pointerdown",e=>{e.preventDefault();G.firing=true;});["pointerup","pointercancel","pointerleave"].forEach(ev=>$("#fire").addEventListener(ev,()=>{G.firing=false;}));
$("#reloadBtn").addEventListener("pointerdown",e=>{e.preventDefault();reload();});
$("#wswitch").addEventListener("pointerdown",e=>{e.preventDefault();select(SEL+1);});
$("#cswitch").addEventListener("pointerdown",e=>{e.preventDefault();cycleCrystal();});
$("#spellBtn").addEventListener("pointerdown",e=>{e.preventDefault();toggleBag();});
$("#camBtn").onclick=()=>{camSide=-camSide;};

// ---------------- movement + collision ----------------
function moveInput(){let x=0,z=0;if(keys.KeyW||keys.ArrowUp)z-=1;if(keys.KeyS||keys.ArrowDown)z+=1;if(keys.KeyA||keys.ArrowLeft)x-=1;if(keys.KeyD||keys.ArrowRight)x+=1;
  if(stick.x||stick.y){x=stick.x;z=stick.y;}const l=Math.hypot(x,z);if(l>1){x/=l;z/=l;}return{x,z,l:Math.min(1,l)};}
function step(dt){stepSleep();let inp=P.sleeping?{x:0,z:0,l:0}:needsInput(moveInput());if(P.flipT>0)inp=Object.assign({},inp,{x:-inp.x,z:-inp.z});/* something bad you took: every key goes the other way (Barbara, 2026-11-25: "the keys backward for bad effects") */if(P.sitting){if(inp.l>.3||jumpQ){standUp();jumpQ=false;}else inp={x:0,z:0,l:0};}P.run=!!(keys.ShiftLeft||keys.ShiftRight||runBtn);
  if(P.inCar)driveCar(dt,inp);else if(P.climbing)climbStep(dt,inp);else{   // driving replaces walking
  const s=Math.sin(look.yaw),c=Math.cos(look.yaw);const wx=inp.x*c+inp.z*s,wz=-inp.x*s+inp.z*c;   // forward = away from the camera
  const target=(P.run?RUN:WALK)*inp.l*(P.down?0:1)*(P.buffT>0?1.6:1)*(P.slowT>0?.55:1)*needsSpeed()*(P.pos.y<.6&&isWater(P.pos.x,P.pos.z,false)?.45:1);/* wading through the moat or the river is slow */const ax=P.onGround?18:6;
  if(P.dash>0)P.dash-=dt;   // a wind leap carries you before your own steering takes over again
  else{P.vel.x+=(wx*target-P.vel.x)*Math.min(1,ax*dt);P.vel.z+=(wz*target-P.vel.z)*Math.min(1,ax*dt);}
  {const want=look.yaw;let d=want-P.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));P.yaw+=d*Math.min(1,14*dt);}   // holding a gun, the body faces where the camera looks
  if(jumpQ&&P.onGround&&!P.down){P.vel.y=JUMP*(P.buffT>0||P.jumpT>0?1.4:1);P.onGround=false;}jumpQ=false;
  P.vel.y-=GRAV*dt;
  const was=P.pos.clone();P.pos.x+=P.vel.x*dt;P.pos.z+=P.vel.z*dt;
  for(const b of BLOCKS){if(b.pass)continue;const ox=(b.w/2+RADIUS)-Math.abs(P.pos.x-b.x),oz=(b.d/2+RADIUS)-Math.abs(P.pos.z-b.z);if(ox<=0||oz<=0)continue;const top=b.y+b.h;if(was.y>=top-.02||P.pos.y>=top-.02)continue;if(P.pos.y+HEIGHT<=b.y)continue;
    if(P.onGround&&top-P.pos.y<=STEP)continue;   // a low block is a step: walk on, and you're lifted onto it once you're over it (below)
    if(ox<oz){P.pos.x=b.x+Math.sign(P.pos.x-b.x)*(b.w/2+RADIUS);P.vel.x=0;}else{P.pos.z=b.z+Math.sign(P.pos.z-b.z)*(b.d/2+RADIUS);P.vel.z=0;}}
  for(const d of DUMMIES){if(d.down)continue;const dx=P.pos.x-d.g.position.x,dz=P.pos.z-d.g.position.z;const l=Math.hypot(dx,dz);if(l<.75&&P.pos.y<2.2){P.pos.x=d.g.position.x+dx/l*.75;P.pos.z=d.g.position.z+dz/l*.75;}}
  P.pos.y+=P.vel.y*dt;let floor=0;
  for(const b of BLOCKS){if(b.pass)continue;if(Math.abs(P.pos.x-b.x)<b.w/2+RADIUS*.6&&Math.abs(P.pos.z-b.z)<b.d/2+RADIUS*.6){const top=b.y+b.h;if(P.pos.y<=top&&(was.y>=top-.05||(P.onGround&&top-was.y<=STEP)))floor=Math.max(floor,top);}}   // standing on it, or stepping onto it
  if(!P.onGround)P.fallTop=Math.max(P.fallTop??P.pos.y,P.pos.y);
  if(P.pos.y<=floor){const drop=(P.fallTop??floor)-floor;P.pos.y=floor;
    if(!P.onGround&&drop>4&&!P.down&&!P.inCar&&!P.softLand){const dmg=Math.round((drop-4)*8);hurt(dmg);shake(Math.min(.5,.1+drop*.02));popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),`Ouch! A ${drop.toFixed(0)} m fall`,"burn");}   // 2 floors ≈ 20, from your 5th-floor balcony ≈ 85 (very badly hurt); higher falls can knock you out
    P.fallTop=undefined;P.softLand=0;if(P.vel.y<0)P.vel.y=0;P.onGround=true;}else P.onGround=false;
  const lim=190;P.pos.x=clamp(P.pos.x,-lim,lim);P.pos.z=clamp(P.pos.z,-lim,lim);}
  P.speed=P.inCar?Math.abs(P.inCar.speed):Math.hypot(P.vel.x,P.vel.z);
  body.position.copy(P.pos);body.rotation.y=P.yaw;
  // guns
  G.cool=Math.max(0,G.cool-dt);G.recoil=Math.max(0,G.recoil-dt*7);
  if(G.reloading>0){G.reloading-=dt;if(G.reloading<=0){G.reloading=0;G.ammo=WEAPONS[G.id].mag;if(G.item)G.item.ammo=G.ammo;const m=muzzleWorld();FX.stars(m,crystalEl(),2,.5);}hud();}
  if(G.firing){useHeld(!G.firedOnce);G.firedOnce=true;}else G.firedOnce=false;
  if(G.ammo===0&&!G.reloading&&held()&&held().t==="weapon")reload();   // an empty gun reloads by itself
  stepBolts(dt);stepEnemies(dt);stepMagic(dt);stepPickups(dt);stepDummyGuns(dt);stepStall(dt);stepLife(dt);stepMP(dt);
  for(const t of TREES){if(t.down)continue;const dx=P.pos.x-t.g.position.x,dz=P.pos.z-t.g.position.z,l=Math.hypot(dx,dz);if(l<.7&&P.pos.y<2){P.pos.x=t.g.position.x+dx/l*.7;P.pos.z=t.g.position.z+dz/l*.7;}}
  for(const n of NODES){if(n.down)continue;const dx=P.pos.x-n.g.position.x,dz=P.pos.z-n.g.position.z,l=Math.hypot(dx,dz);if(l<1.3&&P.pos.y<1.2){P.pos.x=n.g.position.x+dx/l*1.3;P.pos.z=n.g.position.z+dz/l*1.3;}}
  animate(dt);}
function animate(dt){const sp=P.speed;const walkK=Math.min(1,sp/WALK);
  if(P.onGround){P.phase+=dt*(sp>.2?(6+sp*1.4):0);const a=Math.sin(P.phase)*.75*walkK,b=Math.sin(P.phase+Math.PI)*.75*walkK;
    legL.rotation.x=a;legR.rotation.x=b;legL.rotation.z=legR.rotation.z=0;
    hips.position.y=.95+Math.abs(Math.sin(P.phase))*.05*walkK;hips.rotation.x=sp>.2?-.06*walkK*(P.run?1.6:1):0;
    const br=Math.sin(performance.now()*.002)*.02;torso.scale.set(1,1+(sp<.2?br:0),1);}
  else{legL.rotation.x=-.5;legR.rotation.x=.35;hips.position.y=.95;hips.rotation.x=0;}
  // arms hold the gun: right arm forward along the aim, left hand under the barrel; recoil kicks the gun back; a reload swings the left hand to the magazine
  const pitchArm=look.pitch*.6;const rl=G.reloading?1-G.reloading/G.reloadT:0;const rlSwing=rl?Math.sin(rl*Math.PI):0;
  armR.rotation.x=1.45-pitchArm-G.recoil*.25-rlSwing*.5;armR.rotation.z=-.12;armR.rotation.y=0;
  armL.rotation.x=1.2-pitchArm-rlSwing*1.1;armL.rotation.z=.55-rlSwing*.3;armL.rotation.y=.25;
  if(G.mesh){G.mesh.rotation.z=rlSwing*.5;G.mesh.position.y=G.recoil*.06;const mg=G.mesh.userData.mag;const mid=WEAPONS[G.id].model||G.id;if(mg&&mid!=="staff")mg.position.y=(mid==="rifle"?-.22:-.5)-rlSwing*.12;}
  shadowDisc.position.y=.015-P.pos.y+Math.max(0,floorUnder());shadowDisc.material.opacity=Math.max(.05,.18-(P.pos.y-Math.max(0,floorUnder()))*.03);
  placeGun(dt);}
// the hero's animations: legs follow the movement (walk, run, backwards, strafe, jump), arms aim / reload, the chest bends to the aim
const _m4=new THREE.Matrix4(),_qa=new THREE.Quaternion(),_qb=new THREE.Quaternion();
function animRig(dt){const r=RIG;
  if(P.down)r.full("Death_A",{once:true});else if(r.fullName==="Death_A")r.clearFull();
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);const vf=P.vel.x*fx+P.vel.z*fz,vr=-P.vel.x*fz+P.vel.z*fx;
  if(P.sitting)r.base("Sit_Chair_Idle");else if(!P.onGround)r.base("Jump_Idle");
  else if(P.speed<.4)r.base("Idle");
  else if(Math.abs(vf)>=Math.abs(vr)*.8){if(vf>0)r.base(P.run?"Running_A":"Walking_A",{speed:P.run?P.speed/6:P.speed/3.4});else r.base("Walking_Backwards",{speed:P.speed/3});}
  else r.base(vr>0?"Running_Strafe_Right":"Running_Strafe_Left",{speed:Math.max(.7,P.speed/5.5)});
  if(!held()&&r.upName==="2H_Ranged_Aiming")r.up("Unarmed_Idle");else if(held()&&r.upName==="Unarmed_Idle")r.up("2H_Ranged_Aiming");
  if(G.reloading){if(r.upName!=="2H_Ranged_Reload")r.up("2H_Ranged_Reload",{once:true,dur:G.reloadT});}
  else if(r.upName==="2H_Ranged_Reload")r.up("2H_Ranged_Aiming");
  // the mixer only writes a bone when its animated value changes, so undo last frame's aim bend first or it would pile up
  ["spine","chest"].forEach(n=>{const b=r.bones[n];if(b&&b.userData.q0)b.quaternion.copy(b.userData.q0);});
  r.update(dt);
  ["spine","chest"].forEach(n=>{const b=r.bones[n];if(b)(b.userData.q0||(b.userData.q0=new THREE.Quaternion())).copy(b.quaternion);});
  if(!P.down){const right=new THREE.Vector3(-fz,0,fx);[["spine",.45],["chest",.45]].forEach(([n,k])=>{const b=r.bones[n];if(!b)return;
    b.parent.getWorldQuaternion(_qa);const ax=right.clone().applyQuaternion(_qa.invert());b.quaternion.premultiply(_qb.setFromAxisAngle(ax,-look.pitch*k));b.updateMatrixWorld(true);});}}
// the gun sits in the right hand and points where the camera aims (its barrel is local -y, the magazine side local +z = down)
function placeGun(dt){const f=new THREE.Vector3(-Math.sin(P.yaw)*Math.cos(look.pitch),-Math.sin(look.pitch),-Math.cos(P.yaw)*Math.cos(look.pitch));
  if(RIG){animRig(dt);RIG.bones.handslotr.getWorldPosition(gunMount.position);}else{hips.updateMatrixWorld(true);armR.localToWorld(gunMount.position.set(0,-.6,0));}
  const Y=f.clone().negate(),Z=new THREE.Vector3(0,-1,0).addScaledVector(f,f.y).normalize(),X=new THREE.Vector3().crossVectors(Y,Z);
  gunMount.quaternion.setFromRotationMatrix(_m4.makeBasis(X,Y,Z));
  setHeld(held());if(itemMount.visible){   // held out to the right and up a little, so the body doesn't hide it from the camera behind you
    itemMount.position.copy(gunMount.position).add(new THREE.Vector3(Math.cos(P.yaw)*.6,-.05,-Math.sin(P.yaw)*.6));itemMount.rotation.set(0,P.yaw+.25,0);}
  if(P.inCar){gunMount.visible=false;itemMount.visible=false;}}
function floorUnder(){let f=0;for(const b of BLOCKS){if(b.pass)continue;if(Math.abs(P.pos.x-b.x)<b.w/2&&Math.abs(P.pos.z-b.z)<b.d/2&&b.y+b.h<=P.pos.y+.01)f=Math.max(f,b.y+b.h);}return f;}

// ---------------- camera ----------------
const camPos=new THREE.Vector3(0,3,6),_camRay=new THREE.Raycaster();
function updateCam(dt){const d=P.inCar?8:4.2,eye=P.pos.clone().add(new THREE.Vector3(0,P.inCar?2.4:1.5,0));const side=new THREE.Vector3(Math.cos(look.yaw),0,-Math.sin(look.yaw)).multiplyScalar(.95*camSide);
  const want=new THREE.Vector3(eye.x+Math.sin(look.yaw)*Math.cos(look.pitch)*d,eye.y+Math.sin(look.pitch)*d,eye.z+Math.cos(look.yaw)*Math.cos(look.pitch)*d).add(side);
  want.y=Math.max(want.y,floorUnder()+.4);
  {const dir=want.clone().sub(eye),L=dir.length();dir.normalize();_camRay.set(eye,dir);_camRay.far=L;   // don't look through walls: come in front of whatever is behind you
    const hit=_camRay.intersectObjects(SOLIDS,false).find(h=>h.object!==ground&&h.object.material&&h.object.material.visible!==false&&!(h.object.userData.block&&h.object.userData.block.pass));if(hit)want.copy(eye).addScaledVector(dir,Math.max(.35,hit.distance-.25));}
  camPos.lerp(want,1-Math.pow(.0005,dt));cam.position.copy(camPos);if(camShake>0){cam.position.add(rnd3(camShake));camShake=Math.max(0,camShake-dt*.6);}
  const ahead=eye.clone().add(side).add(new THREE.Vector3(-Math.sin(look.yaw)*Math.cos(look.pitch),-Math.sin(look.pitch),-Math.cos(look.yaw)*Math.cos(look.pitch)).multiplyScalar(30));cam.lookAt(ahead);if(P.dizzyT>0&&!CALM)cam.rotateZ(Math.sin(tAcc*1.4)*.1*Math.min(1,P.dizzyT/2));}   // the crosshair is where bullets go
function resize(){R.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();}
addEventListener("resize",resize);resize();
// monster bars are hidden while you are in town, so they don't show through the walls
function placeBars(){DUMMIES.forEach(d=>{const p=d.g.position.clone().add(new THREE.Vector3(0,d.barY||2.45,0)).project(cam);const vis=!d.unbuilt&&!d.asleep&&p.z<1&&Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1&&d.g.position.distanceTo(P.pos)<45&&!(d.enemy&&inTown(P.pos))&&!(d.enemy&&(CAVE.in||inCave(d.g.position))&&wallBetween(cam.position,d.g.position.clone().add(new THREE.Vector3(0,1.4,0))));d.bar.style.display=vis?"":"none";   // (no bars through the cave rock either)
  if(!vis)return;
  d.bar.style.left=(p.x+1)/2*innerWidth+"px";d.bar.style.top=(1-p.y)/2*innerHeight+"px";d.barI.style.width=(100*d.hp/d.max)+"%";d.barI.classList.toggle("low",d.hp<35);d.barS.textContent=d.down?d.name+" · down":d.name;});}

// ---------------- the bag (E) and the forge: tidy the hotbar, and craft by solving the forge's math problems ----------------
// the math level adapts: a forge right on the first try moves you up a level; two wrong tries on the same problems move you down
const MATH={lv:5,wrong:0,moved:""};try{const v=+localStorage.getItem("elementum.mathLevel");if(v>=1&&v<=8)MATH.lv=v;CRAFT.style=localStorage.getItem("elementum.mathBook")||"us";}catch(e){}
// the math book: "us" (the US grades and contests) or "china" (义务教育数学课程标准, grade by grade, in English). New problems right away.
function setBook(b){CRAFT.style=b;try{localStorage.setItem("elementum.mathBook",CRAFT.style);}catch(e){}for(const k in DRAWS)delete DRAWS[k];tray={};}
function setLevel(v,why){const old=MATH.lv;MATH.lv=Math.max(1,Math.min(8,v));MATH.wrong=0;MATH.moved=MATH.lv>old?"up":MATH.lv<old?"down":"";try{localStorage.setItem("elementum.mathLevel",MATH.lv);}catch(e){}
  for(const k in DRAWS)delete DRAWS[k];tray={};if(TRAIN.plan&&!TRAIN.plan.solved)TRAIN.plan=null;return MATH.lv!==old;}
// haggling, jobs and building adapt too: right on the first try twice in a row → harder; wrong twice → easier
function mathRight(){MATH.streak=(MATH.streak||0)+1;MATH.wrong=0;if(MATH.streak>=2&&MATH.lv<8){MATH.streak=0;setLevel(MATH.lv+1);return "up";}return "";}
function mathWrong(){MATH.streak=0;MATH.wrong++;if(MATH.wrong>=2&&MATH.lv>1){setLevel(MATH.lv-1);return "down";}return "";}
const lvNote=r=>r==="up"?` ⬆ Your math level is now ${CRAFT.levelName(MATH.lv)}!`:r==="down"?` (The problems are a little easier now: ${CRAFT.levelName(MATH.lv)}.)`:"";
const designOpen=()=>(window.DESIGN&&DESIGN.isOpen())||(window.BUILD&&(BUILD.isOpen()||BUILD.ideasOpen()));
let bagOpen=false,bagTab="items",bagPick=-1,forgeId=CRAFT.RECIPES[0].id,tray={},forgeMsg="",forgeOk=false;
const DRAWS={};const recipe=id=>CRAFT.RECIPES.find(r=>r.id===id);const drawFor=id=>DRAWS[id]||(DRAWS[id]=CRAFT.draw(recipe(id),MATH.lv));
const CTX_TABS={stocks:"Stocks",biz:"Business",jobs:"Jobs",shop:"Shop",contest:"🏆 Contest",market:"🪙 Market",food:"🍞 Food",chest:"📦 Chest",build:"🔨 Build",quest:"📜 Help",work:"🔨 Job"};
function toggleBag(open,tab){if(!started||P.down)return;bagOpen=open===undefined?!bagOpen:open;if(tab&&tab!==bagTab&&tab!=="work")forgeMsg="";if(tab)bagTab=tab;else if(CTX_TABS[bagTab])bagTab="items";
  const ct=$("#ctxTab");ct.classList.toggle("hidden",!CTX_TABS[bagTab]);if(CTX_TABS[bagTab]){ct.dataset.tab=bagTab;ct.textContent=CTX_TABS[bagTab];}$("#bag").classList.toggle("hidden",!bagOpen);G.firing=false;bagPick=-1;
  if(bagOpen){if(document.exitPointerLock)document.exitPointerLock();renderBag();}}
const esc=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
function slot(i){const it=INV[i],f=itemInfo(it);return `<div class="slot${i===bagPick?" pick":""}${i===SEL?" sel":""}" data-slot="${i}">${f?`<span>${ico(f)}</span>${f.count>1||(it&&it.t==="spell")?`<b>${f.count}</b>`:""}${f.num?`<em>${f.num}</em>`:""}`:""}</div>`;}
function renderBag(){const box=$("#bagBody");document.querySelectorAll("#bag .tabs button[data-tab]").forEach(b=>b.classList.toggle("on",b.dataset.tab===bagTab));
  if(bagTab==="items"){let h=`<p class="tip">Tap an item, then tap another slot to move or swap it. The bottom row is your hotbar (keys 1–9).</p><div class="grid">`;
    for(let i=9;i<36;i++)h+=slot(i);h+=`</div><div class="grid hot">`;for(let i=0;i<9;i++)h+=slot(i);h+=`</div>`;
    const fi=bagPick>=0?bagPick:SEL,f=itemInfo(INV[fi]);h+=`<p class="info">${f?`${img(f.pic,"in")} <b>${esc(f.name)}</b> — ${esc(f.what||"")}${f.num?` · crystal number <b>${f.num}</b>`:""} <button class="drop" data-drop="${fi}">⬇️ Drop</button><br><small class="how">How to get it: ${esc(howToGet(INV[fi]))}</small>`:"&nbsp;"}</p>`;box.innerHTML=h;return;}
  if(bagTab==="quest"){const v=QV;if(!v||P.pos.distanceTo(v.pos)>4){box.innerHTML=`<p class="tip">Villagers with a ❗ over their head need help. Walk up to one and press T.</p>`;return;}
    const q=v.q;let h=`<h3>${esc(v.name)}</h3><p class="say">“${esc(q.text)}”</p><p>Reward: <b>${q.pay} 🪙</b></p>`;
    if(!q.accepted)h+=`<button class="go" id="qAccept">👍 I'll help</button>`;
    else h+=(q.k==="work"?`<p>${q.fixed?"🔨 Done!":`Not done yet — the job is at my ${q.job==="fence"?"garden":"cottage"} (look for the 🔨).`}</p>`:`<p>Progress: <b>${questProgress(q)} / ${q.n}</b></p>`)+(questDone(q)?`<button class="go" id="qHand">✅ Hand it in</button>`:`<p class="tip">Come back when it's done.</p>`);
    box.innerHTML=h+`<p class="msg ok">${esc(forgeMsg)}</p>`;return;}
  if(bagTab==="work"){const v=QW,q=v&&workQ(v);if(!q){box.innerHTML=`<p class="tip">Villagers with a ❗ sometimes need a roof fixed, a wall patched or a fence built. Say yes, then go to their cottage (look for the 🔨) and press T.</p><p class="msg ok">${esc(forgeMsg)}</p>`;return;}
    const w=q.w,m=MAT[w.m],title={roof:`🔨 Fix ${v.name}'s roof`,patch:`🔨 Patch ${v.name}'s wall`,fence:`🔨 Build ${v.name}'s garden fence`}[q.job];
    let h=`<div class="work"><h3>${esc(title)}</h3><div class="level">🧠 Math level: <b>${CRAFT.levelName(MATH.lv)}</b></div><p class="say">${esc(w.text)}</p><p class="have">Each ${w.unit} is one ${matIco(m.id)} ${m.name}. You have <b>${countMat(w.m)}</b>.</p>`;
    h+=w.solved?`<p>You worked it out: <b>${w.n} ${w.unit}s</b>.</p><button class="go" id="workGo">🔨 Use ${w.n} ${matIco(m.id)}</button>`:`<div class="answer"><input id="workIn" type="number" min="0" inputmode="numeric" placeholder="?" autocomplete="off"><button class="go" id="workGo">🔨 Use that many</button></div>`;
    box.innerHTML=h+`<p class="msg ${forgeOk?"ok":""}">${esc(forgeMsg)}</p></div>`;return;}
  if(bagTab==="shop"){shopTab(box);return;}
  if(bagTab==="orders"){ordersTab(box);return;}
  if(bagTab==="jobs"){jobsTab(box);return;}
  if(bagTab==="biz"){bizTab(box);return;}
  if(bagTab==="stocks"){stocksTab(box);return;}
  if(bagTab==="food"){const near=P.pos.distanceTo(COOK.pos)<4.5;let h=`<p class="purse">🪙 <b>${COINS}</b> denarii</p>`;
    if(!near){box.innerHTML=h+`<p class="tip">The Popina 🍞 (the cook's stall) is on the west side of town. Walk up to it to buy food.</p>`;return;}
    h+=`<p class="tip">Food heals a little, and some give you a boost for a while. Eat it from your hotbar (click / FIRE).</p><div class="list">`;
    Object.entries(FOODS).forEach(([id,f])=>{h+=`<button data-food="${id}" class="${COINS<f.price?"poor":""}">${foodIco(id)} <span>${esc(f.name)} <small>${esc(f.what)}</small></span><b>${f.price} 🪙</b></button>`;});
    box.innerHTML=h+`</div><p class="msg ${forgeOk?"ok":""}">${esc(forgeMsg)}</p>`;return;}
  if(bagTab==="chest"){if(P.pos.distanceTo(HOME.chest)>3&&!(APT.owned&&APT.chest&&P.pos.distanceTo(APT.chest)<3)&&!nearMyChest()){box.innerHTML=`<p class="tip">Your chest 📦 is in your house — the one with your name over the door, in the row along the north wall.</p>`;return;}
    let h=`<p class="tip">Tap an item to move it between your bag and your chest. The chest keeps things safe while you go out.</p><h3>📦 Chest</h3><div class="grid">`;
    CHEST.forEach((it,i)=>{const f=itemInfo(it);h+=`<div class="slot" data-fromchest="${i}">${f?`<span>${ico(f)}</span>${f.count>1?`<b>${f.count}</b>`:""}`:""}</div>`;});
    h+=`</div><h3>🎒 Your bag</h3><div class="grid">`;for(let i=9;i<36;i++){const f=itemInfo(INV[i]);h+=`<div class="slot" data-tochest="${i}">${f?`<span>${ico(f)}</span>${f.count>1?`<b>${f.count}</b>`:""}`:""}</div>`;}
    h+=`</div><div class="grid hot">`;for(let i=0;i<9;i++){const f=itemInfo(INV[i]);h+=`<div class="slot" data-tochest="${i}">${f?`<span>${ico(f)}</span>${f.count>1?`<b>${f.count}</b>`:""}`:""}</div>`;}
    box.innerHTML=h+`</div>`;return;}
  if(bagTab==="build"){if(TRAIN.built){box.innerHTML=`<p class="tip">The training center stands. The dummies inside shoot slow bullets at you — only while you are inside its walls.</p><p class="msg ok">${esc(forgeMsg)}</p>`;return;}
    const pl=trainPlan();let need="";pl.parts.forEach(pt=>{const m=MAT[pt.m];
      const q=pt.steps.length===1?`${esc(pt.steps[0])}<i>→ that many ${matIco(m.id)} ${m.name}.</i>`:`(a) ${esc(pt.steps[0])} Call the answer <b>A</b>.<br>(b) ${esc(pt.steps[1])} Call the answer <b>B</b>.<i>→ it takes <b>${pt.how}</b> ${matIco(m.id)} ${m.name}.</i>`;
      need+=`<li>${q}${pl.solved?`<b>${pl.cost[pt.m]} ${matIco(m.id)} ${m.name}</b> <small>(you have ${countMat(pt.m)})</small>`:`<div class="answer">${matIco(m.id)} ${m.name}: <input data-plan="${pt.m}" type="number" min="0" inputmode="numeric" placeholder="?" autocomplete="off"> <small>(you have ${countMat(pt.m)})</small></div>`}</li>`;});
    box.innerHTML=`<h3>🏛️ Build the Palaestra (training center)</h3><p class="tip">Low stone walls go up around the dummies, with a gate on the north side. Once it stands, the dummies inside fight back — but only while you are inside. The builder's plan is written as math: work out how much wood and iron it takes.</p>
      <div class="level">🧠 Math level: <b>${CRAFT.levelName(MATH.lv)}</b></div><ol class="plan">${need}</ol><p>🪙 ${TRAIN.coins} denarii <small>(you have ${COINS})</small></p><button class="go" id="buildGo">🔨 Build it</button><p class="msg ${forgeOk?"ok":""}">${esc(forgeMsg)}</p>`;return;}
  if(bagTab==="contest"){const q=CONTEST.q,T=CRAFT.TIERS[CONTEST.tier];if(!q){box.innerHTML=`<p class="tip">Find the 🏆 board in the town square and press T.</p>`;return;}
    let h=`<div class="work contest"><h3>🏆 Try Your Hardest Math Problem!</h3>
      <div class="rules"><b>For grades 5–8.</b> Read the problem carefully — read it twice. Solve it, type your answer, and then <b>explain your thinking in writing</b>: what you worked out first, what you did next, and why it works. Use paper and pencil; no calculator. You have 3 tries — a hint appears after the first miss, and after the third you will see the answer and how to solve it.</div>
      <div class="tiers">${Object.entries(CRAFT.TIERS).map(([k,t])=>`<button data-tier="${k}" class="${k===CONTEST.tier?"on":""}">${t.icon} ${esc(t.name)}<small>${esc(t.who)} · ${t.pay} 🪙</small></button>`).join("")}</div>
      <p class="say">${esc(q.q)}</p>`;
    if(!q.done)h+=`<div class="answer"><input id="conIn" type="number" inputmode="numeric" placeholder="?" autocomplete="off" value="${esc(CONTEST.ans)}"></div><textarea id="conWhy" rows="3" placeholder="Explain how you solved it, in sentences…">${esc(CONTEST.draft)}</textarea><button class="go" id="conGo">✍️ Hand it in</button>`;
    else h+=`<button class="go" id="conNew">➡️ Next problem</button>`;
    box.innerHTML=h+`<p class="msg ${CONTEST.ok?"ok":""}">${esc(CONTEST.msg)}</p>${CONTEST.solved?`<p class="have">Solved this visit: <b>${CONTEST.solved}</b></p>`:""}</div>`;return;}
  if(bagTab==="guide"){const row=it=>{const f=itemInfo(it);return `<li><span>${ico(f)}</span><b>${esc(f.name)}</b> — ${esc(howToGet(it))}</li>`;};
    let h=`<p class="tip">Everything in Elementum, and how to get it. Most things can also be made at the ⚒️ Forge — the forge hides the amounts in math problems.</p><div class="guide">`;
    h+=`<h4>Materials</h4><ul>${Object.keys(MAT).map(k=>row({t:"mat",id:k,n:1})).join("")}</ul>`;
    h+=`<h4>Weapons</h4><ul>${Object.keys(WEAPONS).map(k=>row({t:"weapon",id:k})).join("")}</ul>`;
    h+=`<h4>Potions</h4><ul>${row({t:"potion",id:"potion",n:1})}${row({t:"potion",id:"fortis",n:1})}</ul>`;
    h+=`<h4>Food</h4><ul>${Object.keys(FOODS).map(k=>row({t:"food",id:k,n:1})).join("")}</ul>`;
    h+=`<h4>Spells</h4><ul>${Object.keys(SPELLS).map(k=>row({t:"spell",id:k,uses:SPELLS[k].uses})).join("")}</ul>`;
    h+=`<h4>Coins</h4><ul>${row({t:"coin",n:1})}</ul></div>`;box.innerHTML=h;return;}
  if(bagTab==="market"){const near=nearMerchant();let h=`<p class="purse">🪙 <b>${COINS}</b> denarii</p>`;
    if(!near){box.innerHTML=h+`<p class="tip">The merchant's stall 🪙 is in town, on the platform north of the start. Walk up to the counter to trade.</p>`;return;}
    if(HAG)h+=`<div class="haggle"><p class="say">🪙 Mercator: “${esc(HAG.d.t)}”</p><p>${HAG.sell?"How many coins does he pay you for all of them?":"How many coins do you pay?"} <small class="tip">(Right → the deal is yours. Wrong → no deal.)</small></p><div class="answer"><input id="hagIn" type="number" min="0" inputmode="numeric" placeholder="?" autocomplete="off"><button class="go" id="hagGo">🤝 Deal</button><button id="hagNo">✖ Never mind</button></div></div>`;
    h+=`<div class="market"><div><h3>Sell to Mercator</h3><p class="tip">Tap an item to sell one. 🤝 = haggle to sell the whole stack.</p><div class="list">`;
    INV.forEach((it,i)=>{if(!it)return;const f=itemInfo(it);const hg=it.t==="mat"&&it.n>=3&&!HAGNO.has(it);h+=`<div class="deal"><button data-sell="${i}">${img(f.pic,"in")} ${esc(f.name)}${f.count>1?` ×${f.count}`:""}<b>+${sellPrice(it)} 🪙</b></button>${hg?`<button class="hag" data-hsell="${i}" title="Haggle for the whole stack">🤝</button>`:""}</div>`;});
    h+=`</div></div><div><h3>Buy</h3><p class="tip">New spells arrive every 2 minutes. 🤝 = haggle: work out Mercator's deal.</p><div class="list">`;
    OFFERS.forEach((o,k)=>{const f=itemInfo(o);if(o.t==="weapon"&&INV.some(s=>s&&s.t==="weapon"&&s.id===o.id))return;const hg=o.price>=10&&!o.noHag;h+=`<div class="deal"><button data-buy="${k}" class="${COINS<o.price?"poor":""}">${img(f.pic,"in")} ${esc(f.name)}${o.t==="spell"?` (${o.uses} uses)`:""}<b>${o.price} 🪙</b></button>${hg?`<button class="hag" data-haggle="${k}" title="Haggle">🤝</button>`:""}</div>`;});
    h+=`</div></div></div><p class="msg ${forgeOk?"ok":""}">${esc(forgeMsg)}</p>`;box.innerHTML=h;return;}
  const rec=recipe(forgeId),dr=drawFor(forgeId);
  let h=`<div class="level">🧠 Math level: <b>${CRAFT.levelName(MATH.lv)}</b> <span class="meter">${[1,2,3,4,5,6,7,8].map(l=>`<i class="${l<=MATH.lv?"on":""}"></i>`).join("")}</span>${MATH.moved==="up"?` <em class="up">⬆ level up!</em>`:MATH.moved==="down"?` <em class="down">⬇ a little easier</em>`:""}<small>Right on the first try → harder. Stuck twice → easier.</small><div class="book">📚 Math book: <button data-book="us" class="${CRAFT.style==="us"?"on":""}">🇺🇸 US</button><button data-book="china" class="${CRAFT.style==="china"?"on":""}">🇨🇳 China standard</button></div></div><div class="forge"><div class="recipes">`;
  let grp=null;CRAFT.RECIPES.forEach(r=>{const g=r.group||"gear";if(g!==grp){grp=g;h+=`<b class="grp">${{gear:"⚔️ Weapons & potions",food:"🍳 Cook food",scroll:"📜 Spell scrolls"}[g]}</b>`;}h+=`<button data-rec="${r.id}" class="${r.id===forgeId?"on":""}">${img(recPic(r),"in")} ${esc(r.name)}<small>${esc(r.what)}</small></button>`;});h+=`</div><div class="card">`;
  h+=`<h3>${img(recPic(rec),"in big")} ${esc(rec.name)}</h3><p class="tip">The forge never says what it needs. Solve each problem: the answer is how many of that material to put in, or which crystal core. Wrong mix? It only tells you how many parts are right.</p><ol>`;
  dr.parts.forEach(pt=>{const m=pt.m&&MAT[pt.m];
    if(pt.kind==="amount"){if(pt.steps.length===1)h+=`<li>${esc(pt.steps[0])}<i>→ put in that many ${matIco(m.id)} ${esc(m.name)}.</i></li>`;
      else h+=`<li>(a) ${esc(pt.steps[0])} Call the answer <b>A</b>.<br>(b) ${esc(pt.steps[1])} Call the answer <b>B</b>.<i>→ put in <b>${pt.how}</b> ${matIco(m.id)} ${esc(m.name)}.</i></li>`;}
    else h+=`<li>${esc(pt.text)}</li>`;});
  h+=`</ol><p class="key">Crystal numbers: ${CRAFT.CORES.map(c=>`${matIco(c)} ${MAT[c].name.replace(" core","")} <b>${MAT[c].num}</b>`).join(" · ")}</p>`;
  h+=`<div class="tray">`;const inTray=Object.entries(tray).filter(([k,n])=>n>0);for(let i=0;i<9;i++){const e=inTray[i];h+=e?`<div class="slot" data-tray="${e[0]}"><span>${img("mat_"+e[0])}</span><b>${e[1]}</b></div>`:`<div class="slot"></div>`;}
  h+=`</div><div class="mats">`;const owned=Object.keys(MAT).filter(k=>countMat(k)>0);
  h+=owned.length?owned.map(k=>`<button data-mat="${k}">${matIco(k)} ${esc(MAT[k].name)} <b>${countMat(k)-(tray[k]||0)}</b></button>`).join(""):`<span class="tip">No materials yet — mine rocks and crystals, knock down dummies, beat monsters.</span>`;
  h+=`</div><button class="go" id="forgeGo">⚒️ Forge</button><p class="msg ${forgeOk?"ok":""}">${esc(forgeMsg)}</p></div></div>`;box.innerHTML=h;}
function forgeNow(){const rec=recipe(forgeId),dr=drawFor(forgeId);const res=CRAFT.check(dr.need,tray);
  if(!res.ok){forgeOk=false;MATH.wrong++;MATH.moved="";
    if(MATH.wrong>=2&&MATH.lv>1){setLevel(MATH.lv-1);forgeMsg=`The forge sputters — ${res.right} of ${res.total} parts are right. New, easier problems are ready (${CRAFT.levelName(MATH.lv)}).`;}
    else forgeMsg=`The forge sputters — ${res.right} of ${res.total} parts are right. Check your math!`;renderBag();return;}
  const out=rec.out||rec.id,gv=rec.give;let it;
  if(gv&&gv.t==="food")it={t:"food",id:gv.id,n:1};
  else if(gv&&gv.t==="scroll"){const ids=Object.keys(SPELLS).filter(k=>SPELLS[k].el===gv.el);const id=pick(ids);it={t:"spell",id,uses:SPELLS[id].uses};}
  else it=out==="potion"||out==="fortis"?{t:"potion",id:out,n:rec.gives||1}:{t:"weapon",id:out};
  if(!canAdd(it)){forgeOk=false;forgeMsg="Your bag is full — make room first.";renderBag();return;}
  Object.entries(tray).forEach(([k,n])=>{if(n>0)takeMat(k,n);});addItem(it);const first=MATH.wrong===0;tray={};delete DRAWS[forgeId];forgeOk=true;
  const up=first&&MATH.lv<8&&setLevel(MATH.lv+1);if(!up){MATH.wrong=0;MATH.moved="";}
  forgeMsg=`✨ You made ${it.t==="spell"?`${SPELLS[it.id].icon} ${SPELLS[it.id].name}`:rec.name}!`+(up?` Right on the first try — the problems are now ${CRAFT.levelName(MATH.lv)}.`:" A new set of problems is ready for the next one.");
  FX.stars(P.pos.clone().add(new THREE.Vector3(0,1.4,0)),"gold",5,1.4);renderBag();}
// buying at a shop, the food stall or Mercator's stall asks first: no money is taken unless you say yes
function buyAsk(t){let name,price;
  if(t.dataset.shopitem!==undefined&&CUR_SHOP){const id=CUR_SHOP.S.items[+t.dataset.shopitem],f=FOODS[id]||EXTRA[id];if(!f)return null;name=f.name;price=f.price;}
  else if(t.dataset.food){const f=FOODS[t.dataset.food];if(!f)return null;name=f.name;price=f.price;}
  else if(t.dataset.buy!==undefined){const o=OFFERS[+t.dataset.buy];if(!o)return null;name=itemInfo(o).name;price=o.price;}
  else return null;return COINS<price?null:{name,price};}
function bagClick(e){const t=e.target.closest("[data-slot],[data-mbuy],[data-mbuy5],[data-msell],[data-msellall],[data-mpred],#mGo,[data-shopitem],[data-job],[data-jobquit],#jobGo,[data-bizstart],[data-bizbuy],[data-bizsign],[data-bizclose],#bizSetPrice,[data-rec],[data-mat],[data-tray],[data-sell],[data-buy],[data-food],[data-tochest],[data-fromchest],[data-drop],[data-book],[data-tier],#conGo,#conNew,[data-haggle],[data-hsell],#hagGo,#hagNo,#workGo,#forgeGo,#buildGo,#qAccept,#qHand");if(!t)return;
  if(!e.ok){const w=buyAsk(t);if(w){ask(`Buy ${w.name} for ${w.price} denarii?`,[[`Buy it (${w.price})`,()=>bagClick({target:t,ok:true})],["No thanks",null]]);return;}}
  if(t.dataset.slot!==undefined){const i=+t.dataset.slot;if(bagPick<0){if(INV[i])bagPick=i;}else{const a=INV[bagPick];INV[bagPick]=INV[i];INV[i]=a;bagPick=-1;select(SEL);}renderBag();return;}
  if(t.dataset.book){setBook(t.dataset.book);forgeMsg=t.dataset.book==="china"?"📚 China standard: the problems now follow what Chinese schools teach in each grade.":"📚 US math book.";forgeOk=true;renderBag();return;}
  if(t.dataset.tier){contestNew(t.dataset.tier);renderBag();return;}
  if(t.id==="conNew"){contestNew();renderBag();return;}
  if(t.id==="conGo"){const i=$("#conIn"),w=$("#conWhy");CONTEST.ans=i?i.value:"";CONTEST.draft=w?w.value:"";const r=contestAnswer(i&&i.value!==""?parseInt(i.value,10):null,CONTEST.draft);CONTEST.ok=r.ok;CONTEST.msg=r.msg;renderBag();return;}
  if(t.dataset.drop!==undefined){dropOwn(+t.dataset.drop);bagPick=-1;renderBag();return;}
  if(t.dataset.rec){forgeId=t.dataset.rec;tray={};forgeMsg="";renderBag();return;}
  if(jobClick(t)||bizClick(t)||stocksClick(t))return;
  if(t.dataset.shopitem){shopBuy(+t.dataset.shopitem);renderBag();return;}
  if(t.dataset.food){const f=FOODS[t.dataset.food];if(COINS<f.price){forgeOk=false;forgeMsg="Not enough coins yet — sell something at Mercator's stall.";}else if(addItem({t:"food",id:t.dataset.food,n:1})){COINS-=f.price;coinHud();forgeOk=true;forgeMsg=`${f.icon} ${f.name} is in your bag.`;}else{forgeOk=false;forgeMsg="Your bag is full.";}renderBag();return;}
  if(t.dataset.tochest!==undefined){const i=+t.dataset.tochest,k=CHEST.indexOf(null);if(INV[i]&&k>=0){CHEST[k]=INV[i];INV[i]=null;select(SEL);}renderBag();return;}
  if(t.dataset.fromchest!==undefined){const i=+t.dataset.fromchest;if(CHEST[i]&&addItem(CHEST[i]))CHEST[i]=null;renderBag();return;}
  if(t.id==="qAccept"&&QV){QV.q.accepted=true;forgeMsg="Thank you! Come back when it's done.";renderBag();return;}
  if(t.id==="qHand"&&QV){const pay=questTurnIn(QV);forgeMsg=pay?`+${pay} 🪙 — thank you! ${QV.name} has another job for you.`:"";renderBag();return;}
  if(t.id==="buildGo"){const pl=trainPlan();let lv="";
    if(!pl.solved){const ans={};document.querySelectorAll("#bagBody [data-plan]").forEach(i=>ans[i.dataset.plan]=parseInt(i.value,10));const right=Object.keys(pl.cost).filter(k=>ans[k]===pl.cost[k]).length;
      if(right<Object.keys(pl.cost).length){pl.tries++;lv=mathWrong();forgeOk=false;forgeMsg=(right?"One amount is right, one is wrong":"Those amounts don't match the plan")+" — check your math."+(lv==="down"?" Here's an easier plan."+lvNote(lv):"");renderBag();return;}
      pl.solved=true;if(!pl.tries)lv=mathRight();}
    const r=buildTraining();forgeOk=r==="ok";forgeMsg={ok:"🏛️ The training center stands! Step inside to train.",mats:`Your math is right! Now gather it: ${pl.cost.lignum} 🪵 Lignum and ${pl.cost.ferrum} 🔩 Ferrum.`,coins:`Your math is right! You also need ${TRAIN.coins} 🪙.`,plan:"",done:""}[r]+lvNote(lv);renderBag();return;}
  if(t.dataset.haggle!==undefined){haggleBuy(+t.dataset.haggle);forgeMsg="";renderBag();const i=$("#hagIn");if(i)i.focus();return;}
  if(t.dataset.hsell!==undefined){haggleSell(+t.dataset.hsell);forgeMsg="";renderBag();const i=$("#hagIn");if(i)i.focus();return;}
  if(t.id==="hagNo"){HAG=null;forgeMsg="";renderBag();return;}
  if(t.id==="hagGo"){const r=haggle(parseInt($("#hagIn").value,10));forgeOk=r.ok;forgeMsg=r.msg;renderBag();return;}
  if(t.id==="workGo"){const i=$("#workIn");const r=workNow(QW,i?parseInt(i.value,10):null);forgeOk=r.ok;forgeMsg=r.msg;renderBag();return;}
  if(t.dataset.sell!==undefined){const pr=sell(+t.dataset.sell);forgeOk=true;forgeMsg=pr?`Sold for ${pr} 🪙.`:"";renderBag();return;}
  if(t.dataset.buy!==undefined){const r=buy(+t.dataset.buy);forgeOk=r==="ok";forgeMsg={ok:"Bought! It is in your bag.",poor:"Not enough coins yet — sell something first.",full:"Your bag is full.",far:"Walk to the stall first."}[r];renderBag();return;}
  if(t.dataset.mat){const k=t.dataset.mat;if((tray[k]||0)<countMat(k))tray[k]=(tray[k]||0)+1;forgeMsg="";renderBag();return;}
  if(t.dataset.tray){const k=t.dataset.tray;tray[k]=Math.max(0,(tray[k]||0)-1);forgeMsg="";renderBag();return;}
  if(t.id==="forgeGo")forgeNow();}
$("#bagBody").addEventListener("click",bagClick);
$("#bagBody").addEventListener("keydown",e=>{if(e.key!=="Enter"||!e.target.matches("input"))return;e.preventDefault();if(e.target.matches("textarea"))return;const b=$("#hagGo")||$("#workGo")||$("#buildGo")||$("#conGo");if(b)b.click();});
$("#bagBody").addEventListener("input",e=>{if(e.target.id==="conWhy")CONTEST.draft=e.target.value;if(e.target.id==="conIn")CONTEST.ans=e.target.value;});
document.querySelectorAll("#bag .tabs button[data-tab]").forEach(b=>b.addEventListener("click",()=>{bagTab=b.dataset.tab;bagPick=-1;renderBag();}));
$("#bagClose").addEventListener("click",()=>toggleBag(false));
$("#online").addEventListener("click",()=>toggleRoom());$("#projBtn").addEventListener("click",()=>{if(started)toggleBag(true,"orders");});$("#wakeBtn").addEventListener("click",()=>endSleep(false));$("#roomClose").addEventListener("click",()=>toggleRoom(false));
$("#trade").addEventListener("click",()=>useAct());
$("#hotbar").addEventListener("pointerdown",e=>{const s=e.target.closest("[data-i]");if(!s)return;e.preventDefault();e.stopPropagation();select(+s.dataset.i);});

// ---------------- flow ----------------
function togglePause(){if(!started)return;paused=!paused;$("#pause").classList.toggle("hidden",!paused);if(paused&&document.exitPointerLock)document.exitPointerLock();G.firing=false;}
document.querySelectorAll("#grades button").forEach(b=>{b.classList.toggle("on",+b.dataset.lv===MATH.lv);b.onclick=()=>{setLevel(+b.dataset.lv);MATH.moved="";document.querySelectorAll("#grades button").forEach(x=>x.classList.toggle("on",x===b));};});
$("#startBtn").onclick=()=>{$("#start").classList.add("hidden");started=true;setTimeout(()=>$("#hint").classList.add("off"),5000);};
$("#pauseBtn").onclick=togglePause;$("#resumeBtn").onclick=togglePause;$("#respawnBtn").onclick=respawn;
$("#resetBtn").onclick=()=>{respawn();look.yaw=0;look.pitch=.22;paused=false;$("#pause").classList.add("hidden");};
document.addEventListener("visibilitychange",()=>{if(document.hidden&&started&&!paused)togglePause();});
if(!touch)$("#hint").textContent="WASD walk · click to use · 1–9 hotbar · E bag & forge · G drop · T trade · R reload · Q crystal";
equip("rifle",null);select(0);   // you start with nothing: fists only — chop trees, mine rocks, help the villagers, buy your first guncoinHud();
const clock=new THREE.Clock();
function frame(){requestAnimationFrame(frame);const dt=Math.min(.05,clock.getDelta());tAcc+=dt;
  {const run=tweens;tweens=[];const keep=run.filter(w=>{w.t+=dt;const t=Math.min(1,w.t/w.dur);w.fn(t);if(t>=1){w.done&&w.done();return false;}return true;});tweens=keep.concat(tweens);}   // tweens started inside a finishing tween are kept
  if(started&&!paused&&!bagOpen&&!designOpen())step(dt);else animate(dt);SPARK.step(dt);PUFF.step(dt);FX.step(dt);updateCam(dt);placeBars();
  $("#pos").textContent=`x ${P.pos.x.toFixed(1)}  y ${P.pos.y.toFixed(1)}  z ${P.pos.z.toFixed(1)}${P.run?"  run":""}`;R.render(scene,cam);}
WORLD.STATIC=BLOCKS.length;
RNG=Math.random;   // the world is built: from here on, random is random
frame();
// ---------------- the horn (2026-11-22, Barbara: "you can make a horn that makes the soldiers attack the monsters — and kill them").
// Build a horn at the workbench, hold it and click (or press FIRE) to blow it: four soldiers come running, hunt down every monster
// near you and fight until they're dead (they're hard to hurt). They stay one minute, then march home. The horn needs 90 s to call again.
// Other players in your room hear it and see the soldiers too; only your soldiers' blows count, so monsters aren't hit twice.
const HORN={cd:0,squad:[]};
function hornSound(){try{const A=hornSound.ctx||(hornSound.ctx=new (window.AudioContext||window.webkitAudioContext)());const t=A.currentTime;
  [[196,0],[247,.55],[294,1.05]].forEach(([f,at])=>{const o=A.createOscillator(),g=A.createGain(),lp=A.createBiquadFilter();o.type="sawtooth";o.frequency.setValueAtTime(f*.97,t+at);o.frequency.linearRampToValueAtTime(f,t+at+.08);
    lp.type="lowpass";lp.frequency.value=1400;g.gain.setValueAtTime(0,t+at);g.gain.linearRampToValueAtTime(.18,t+at+.06);g.gain.setValueAtTime(.18,t+at+(at<1?.42:.9));g.gain.linearRampToValueAtTime(0,t+at+(at<1?.5:1.1));
    o.connect(lp);lp.connect(g);g.connect(A.destination);o.start(t+at);o.stop(t+at+1.2);});}catch(e){}}
function callSoldiers(at,fake){for(let i=0;i<4;i++){const a=i/4*Math.PI*2+.4,x=at.x+Math.cos(a)*3,z=at.z+Math.sin(a)*3;const o=npc("guard.glb",x,z,0);
    const t=setInterval(()=>{if(!o.rig)return;clearInterval(t);o.rig.root.traverse(m=>{if(m.name==="1H_Sword"||m.name==="Round_Shield")m.visible=true;});},300);
    const lb=label("Soldier",0xffd27a);lb.scale.set(1.5,.3,1);lb.position.y=2.4;o.g.add(lb);o.g.scale.setScalar(.01);tween(.5,k=>o.g.scale.setScalar(Math.max(.01,k)));
    for(let k=0;k<10;k++)PUFF.emit(new THREE.Vector3(x,rnd(.2,1.5),z),rnd3(1.2),C(0xc8b89a).multiplyScalar(.5),.8,{drag:2});
    HORN.squad.push({o,t:60,cool:rnd(0,.6),target:null,fake:!!fake,home:at.clone()});}}
function blowHorn(){if(P.down)return;if(HORN.cd>0){popNum(P.pos.clone().add(new THREE.Vector3(0,2.3,0)),`the soldiers are still busy — ${Math.ceil(HORN.cd)} s`,"burn");return;}
  HORN.cd=90;hornSound();callSoldiers(P.pos.clone(),false);share({k:"horn",x:R2(P.pos.x),z:R2(P.pos.z)});
  const near=ENEMIES.filter(d=>!d.down&&d.g.position.distanceTo(P.pos)<45).length;
  lawSay(near?`📯 You blow the horn — four soldiers come running to fight the ${near} monster${near>1?"s":""} nearby!`:"📯 You blow the horn — the soldiers come, but there are no monsters near you.");}
function stepSoldiers(dt){HORN.cd=Math.max(0,HORN.cd-dt);
  for(let i=HORN.squad.length-1;i>=0;i--){const s=HORN.squad[i],g=s.o.g,r=s.o.rig;s.t-=dt;s.cool-=dt;
    if(s.t<=0){if(!s.gone){s.gone=true;tween(.5,k=>g.scale.setScalar(Math.max(.01,1-k)),()=>{scene.remove(g);const j=TOWNFOLK.indexOf(s.o);if(j>=0)TOWNFOLK.splice(j,1);});}if(s.t<-1)HORN.squad.splice(i,1);continue;}
    if(!s.target||s.target.down||s.target.g.position.distanceTo(g.position)>60){s.target=null;let bd=45;for(const d of ENEMIES){if(d.down)continue;const q=d.g.position.distanceTo(g.position);if(q<bd){bd=q;s.target=d;}}}
    const goal=s.target?s.target.g.position:(s.fake?s.home:P.pos);const to=new THREE.Vector3(goal.x-g.position.x,0,goal.z-g.position.z),dist=to.length();
    if(dist>(s.target?1.7:3)){to.normalize();g.position.addScaledVector(to,Math.min(dist,(s.target?5.5:4)*dt));g.rotation.y=Math.atan2(to.x,to.z);if(r&&!r.fullName)r.base("Running_A");}
    else{if(s.target){g.rotation.y=Math.atan2(to.x,to.z);if(s.cool<=0){s.cool=1.1;if(r)r.full("1H_Melee_Attack_Chop",{once:true,restart:true,dur:.7,then:()=>r.clearFull()});const d=s.target;
        setTimeout(()=>{if(d.down||s.fake)return;if(d.g.position.distanceTo(g.position)<2.6){const at=d.g.position.clone().add(new THREE.Vector3(0,1.1,0));damage(d,26,at,false,{el:"plain",area:true});sparks(at,6,0xffffff);}},300);}}
      else if(r&&!r.fullName)r.base("Idle");}}}

// ---------------- the moat and the river (2026-11-22, Barbara: "add a river for the boat that is a moat and you can sail around across the map").
// A moat runs all the way round the walls (and round the gas station), with bridges at the gates. From the north side a river flows
// north across the map to a lake. Walking through water is slow wading; cars can't go in; monsters can't cross it. A boat you build
// (for yourself) waits at the dock by the north gate — sail it anywhere on the water, even under the bridges.
const MOAT={x0:-54,x1:166,z0:-45,z1:51,w:6,river:{x0:20,x1:26,z0:45,z1:170},lake:{x:23,z:178,r:11},dock:new THREE.Vector3(9,0,48)};
function isWater(x,z,boat){const M=MOAT,ring=x>=M.x0&&x<=M.x1&&z>=M.z0&&z<=M.z1&&!(x>M.x0+M.w&&x<M.x1-M.w&&z>M.z0+M.w&&z<M.z1-M.w);
  const w=ring||(x>=M.river.x0&&x<=M.river.x1&&z>=M.river.z0&&z<=M.river.z1)||Math.hypot(x-M.lake.x,z-M.lake.z)<=M.lake.r;if(!w||boat)return w;return !onBridge(x,z);}
function onBridge(x,z){const M=MOAT;return (Math.abs(x)<=3.6&&(z>=M.z1-M.w-1&&z<=M.z1+1||z>=M.z0-1&&z<=M.z0+M.w+1))||(z>=-8.6&&z<=-1.4&&(x>=M.x0-1&&x<=M.x0+M.w+1||x>=M.x1-M.w-1&&x<=M.x1+1));}
{const M=MOAT,wm=new THREE.MeshLambertMaterial({color:0x3a8fd0,transparent:true,opacity:.86}),bank=new THREE.MeshLambertMaterial({color:0x8a7a5a});
  const sheet=(x0,x1,z0,z1)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,z1-z0),wm);m.rotation.x=-Math.PI/2;m.position.set((x0+x1)/2,.05,(z0+z1)/2);scene.add(m);
    const b=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0+1,z1-z0+1),bank);b.rotation.x=-Math.PI/2;b.position.set((x0+x1)/2,.03,(z0+z1)/2);scene.add(b);};
  sheet(M.x0,M.x1,M.z0,M.z0+M.w);sheet(M.x0,M.x1,M.z1-M.w,M.z1);sheet(M.x0,M.x0+M.w,M.z0+M.w,M.z1-M.w);sheet(M.x1-M.w,M.x1,M.z0+M.w,M.z1-M.w);
  sheet(M.river.x0,M.river.x1,M.z1,M.river.z1+2);
  {const l=new THREE.Mesh(new THREE.CircleGeometry(M.lake.r,40),wm);l.rotation.x=-Math.PI/2;l.position.set(M.lake.x,.05,M.lake.z);scene.add(l);}
  // bridges: a plank deck with rails at each gate (and on the road out east)
  const wood=LOOK.toon(0x8a5a2e),dark=LOOK.toon(0x6b4423);
  const bridge=(x,z,len,along)=>{const g=new THREE.Group();g.position.set(x,0,z);if(along==="x")g.rotation.y=Math.PI/2;scene.add(g);
    const deck=LOOK.M(new THREE.BoxGeometry(7.2,.16,len),wood,.012);deck.position.y=.12;g.add(deck);
    [-1,1].forEach(k=>{const r=LOOK.M(new THREE.BoxGeometry(.12,.1,len),dark,.01);r.position.set(k*3.5,1,0);g.add(r);for(let i=0;i<=4;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(.12,1,.12),dark);p.position.set(k*3.5,.55,-len/2+i*len/4);g.add(p);}});};
  bridge(0,M.z1-M.w/2,M.w+2.4,"z");bridge(0,M.z0+M.w/2,M.w+2.4,"z");bridge(M.x0+M.w/2,-5,M.w+2.4,"x");bridge(M.x1-M.w/2,-5,M.w+2.4,"x");
  // the dock by the north gate, where your boat waits
  const dk=LOOK.M(new THREE.BoxGeometry(3,.2,4),wood,.012);dk.position.set(M.dock.x,.15,M.z1-M.w-1);scene.add(dk);
  const sg=label("⛵ Boat dock",0x9fd3ff);sg.scale.set(2.6,.5,1);sg.position.set(M.dock.x,2.4,M.z1-M.w-2.6);scene.add(sg);
  // nothing grows or stands in the water: trees and rocks that would be in it move to the bank
  TREES.forEach(t=>{const p=t.g.position;for(let k=0;k<6&&isWater(p.x,p.z,true);k++)p.z+=4;});
  NODES.forEach(nd=>{const g=nd.g||(nd.rock&&nd.rock.parent);if(!g)return;const p=g.position;for(let k=0;k<6&&isWater(p.x,p.z,true);k++)p.z+=4;});}
// your boat: built at the workbench; it looks like your design and sails only on water
// putting a saved thing back when the game opens: if one is broken, say so in the console and carry on (the save itself is left alone)
function restore(what,f){try{f();}catch(e){console.error("could not put back your saved "+what,e);}}
const MYBOAT={boat:null};
function makeBoat(parts){if(MYBOAT.boat){if(P.inCar===MYBOAT.boat)exitCar();scene.remove(MYBOAT.boat.g);CARS.splice(CARS.indexOf(MYBOAT.boat),1);}
  const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);const box=new THREE.Box3();parts.forEach(p=>{const m=BUILD.meshOf(p);inner.add(m);box.union(new THREE.Box3().setFromObject(m));});
  const c0=box.getCenter(new THREE.Vector3());inner.position.set(-c0.x,-box.min.y,-c0.z);g.scale.setScalar(.01);g.position.set(MOAT.dock.x+4,.12,MOAT.z1-MOAT.w/2);g.rotation.y=Math.PI/2;scene.add(g);
  const len=(box.max.z-box.min.z)/100,wid=(box.max.x-box.min.x)/100;
  const c={g,wheels:[],speed:0,yaw:Math.PI/2,fuel:Infinity,max:Infinity,spin:0,hitCool:new Map(),color:0x8a5a32,boat:true,own:true,len,wid,parts};CARS.push(c);MYBOAT.boat=c;MYBOAT.room=null;
  try{localStorage.setItem("elementum.myboat",JSON.stringify(parts));}catch(e){}return c;}
{let v=null;try{v=JSON.parse(localStorage.getItem("elementum.myboat")||"null");}catch(e){}if(Array.isArray(v)&&v.length)restore("boat",()=>makeBoat(v));}
const REMOTE_BOATS={};
function boatShare(d){const c=MYBOAT.boat;if(!c||!MP.ok)return;const p=compactParts(c.parts);setKey("boat:"+MYCAR.id,{x:+c.g.position.x.toFixed(2),z:+c.g.position.z.toFixed(2),yaw:+c.yaw.toFixed(3),d:d||null,p:JSON.stringify(p).length<15000?p:0});}
function boatKeyApply(id,val){if(id===MYCAR.id)return;const b=REMOTE_BOATS[id];if(!val){if(b){scene.remove(b.g);delete REMOTE_BOATS[id];}return;}
  const k=JSON.stringify(val.p||0);let n=b;if(!b||b.k!==k){if(b)scene.remove(b.g);const parts=Array.isArray(val.p)&&val.p.length?val.p:null;n=REMOTE_BOATS[id]={k,parts,g:parts?furnitureMesh(parts):placedMesh({id:"boat"})};scene.add(n.g);}
  n.d=val.d||null;n.g.position.set(+val.x||0,.12,+val.z||0);n.g.rotation.y=+val.yaw||0;}
function stepBoats(){if(MP.ok&&MYBOAT.boat&&MYBOAT.room!==MP.room){MYBOAT.room=MP.room;boatShare(P.inCar===MYBOAT.boat?MP.id:null);}
  for(const id in REMOTE_BOATS){const b=REMOTE_BOATS[id];b.g.visible=!(b.d&&MP.others[b.d]&&MP.others[b.d].bo);}}
// getting out of a boat: step onto the nearest dry land
function landNear(p){for(let r=1.5;r<12;r+=.75)for(let a=0;a<6.28;a+=.35){const x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(!isWater(x,z,false)&&!carBlocked(new THREE.Vector3(x,0,z)))return new THREE.Vector3(x,0,z);}return p.clone();}

// ---------------- the growing town (2026-11-22, Barbara: "the villagers should start on day 1 when the room is created and they should build
// a whole house each day per 10 people — also shops and gas stations"). Each room has a birthday (the server keeps it). On day 1 there is only
// the wall, the market stalls and the library with its workbench; the villagers build everything else one lot at a time, in the same order
// for everyone in the room, so everyone sees the same town. Cars come once the gas station is built. Your own house you build yourself.
const ROOMLIFE={born:1795372800};   // the public world's birthday, 2026-11-22 18:40 UTC (each private room gets its own from the server)
const townAgeDays=()=>Math.max(0,(Date.now()/1000-ROOMLIFE.born)/CLOCK.len);
const townDay=()=>Math.max(1,(DAY.day||1)-Math.floor((ROOMLIFE.born*1000-CLOCK.epoch)/1000/CLOCK.len));   // counted with the sky's days, so "Day 2" starts at dawn
const LOTS=[];
const lotHas=(L,x,z)=>L.rects.some(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1);
const lotAt=(x,z)=>LOTS.find(L=>lotHas(L,x,z));
function rectOf(x,z,w,d,face,front){const r={x0:x-w/2-.4,x1:x+w/2+.4,z0:z-d/2-.4,z1:z+d/2+.4};if(face>0)r.z1+=front;else if(face<0)r.z0-=front;return r;}
{const bySpecial=n=>BUILDINGS.find(b=>b.name&&b.name.startsWith(n));
  const first=[...VILLAGERS.map(v=>({cot:v})),{bd:bySpecial("Macellum")},{bd:bySpecial("Benzina"),gas:true},{bd:bySpecial("Pistrinum")},{bd:SCHOOL},{bd:bySpecial("Taberna Tua")},
    {bd:bySpecial("Hospitium")},{bd:bySpecial("Thermopolium")},{bd:bySpecial("Tonsor")},{bd:bySpecial("Taberna —")},{bd:bySpecial("Sutor")},{bd:bySpecial("Insula")}].filter(o=>o.cot||o.bd);
  const rest=BUILDINGS.filter(b=>b!==LIBRARY&&!first.some(o=>o.bd===b));let s=7;const rnd7=()=>(s=(s*16807)%2147483647)/2147483647;
  rest.map(b=>[rnd7(),b]).sort((a,b)=>a[0]-b[0]).forEach(([,b])=>first.push({bd:b}));
  first.forEach(o=>{let L;
    if(o.cot){const c=o.cot.home;L={name:`${o.cot.name}'s cottage`,rects:[rectOf(c.x,c.z,CW+.8,CD+.8,1,1.2)],x:c.x,z:c.z,w:CW,d:CD,h:CH+CR,cot:c};c.lot=L;}
    else{const b=o.bd;L={name:b.name?b.name.split(" — ")[0]:`${b.owner}'s house`,rects:[rectOf(b.x,b.z,b.w,b.d,b.face,b.enter?3.4:2.2)],x:b.x,z:b.z,w:b.w,d:b.d,h:b.h,bd:b};b.lot=L;
      if(o.gas)L.rects.push({x0:138,x1:156,z0:-22,z1:-10});L.gas=!!o.gas;}
    L.objs=[];L.blks=[];L.people=[];L.rooms=[];L.built=true;LOTS.push(L);});
  // what stands on each lot: meshes, solid blocks, the people who work there, the rooms inside
  const keep=new Set([...LAMPS.map(l=>l.parent),...TOWNFOLK.map(o=>o.g),...CARS.map(c=>c.g),...TREES.map(t=>t.g),body]);
  for(const o of scene.children){if(keep.has(o)||o.isLight||o===STORM)continue;const g=o.geometry&&o.geometry.parameters;if(o.isMesh&&g&&g.width&&g.height&&g.width*g.height>500)continue;
    const L=lotAt(o.position.x,o.position.z);if(L)L.objs.push({o,v:o.visible});}
  BLOCKS.forEach(b=>{const L=lotAt(b.x,b.z);if(L)L.blks.push({b,pass:!!b.pass});});
  PEOPLE.forEach(pp=>{if(CITIZENS.some(c=>c.pp===pp)||pp.guard)return;const p=pp.o.g.position,L=lotAt(p.x,p.z);if(L)L.people.push(pp);});
  INTERIORS.forEach(r=>{const L=lotAt((r.x0+r.x1)/2,(r.z0+r.z1)/2);if(L){L.rooms.push(r);r.lot=L;}});
  ACTS.forEach(a=>{let p;try{p=a.pos;}catch(e){return;}if(!p)return;const L=lotAt(p.x,p.z);if(!L)return;const h=a.hidden;a.hidden=()=>!L.built||(h?h():false);});
  SPOTS.eat.forEach(s=>{const L=lotAt(s.pos.x,s.pos.z);if(L)s.lot=L;});SPOTS.shop.forEach(s=>{const L=lotAt(s.pos.x,s.pos.z);if(L)s.lot=L;});}
function setLot(L,on){if(L.built===on)return;L.built=on;L.objs.forEach(({o,v})=>{o.visible=on?v:false;});
  L.blks.forEach(({b,pass})=>{b.pass=on?(L.bd&&L.bd.down&&L.bd.blks.includes(b)?true:pass):true;});
  L.people.forEach(pp=>{pp.o.g.visible=on;});if(L.gas)CARS.forEach(c=>{if(!c.own)c.g.visible=on&&!c.taken;c.hidden=!on;});}
// the building site: a timber frame that rises as the villagers work, scaffold poles and four builders with hammers
const SITE={g:new THREE.Group(),frame:null,lot:null,workers:[],k:0};SITE.g.visible=false;scene.add(SITE.g);
{const wood=LOOK.toon(0xb08a55);SITE.frameMat=new THREE.MeshLambertMaterial({color:0xd8b07a,transparent:true,opacity:.55});
  SITE.slab=new THREE.Mesh(new THREE.BoxGeometry(1,.25,1),LOOK.toon(0xb8b0a0));SITE.slab.position.y=.12;SITE.g.add(SITE.slab);
  SITE.frame=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),SITE.frameMat);SITE.g.add(SITE.frame);
  SITE.poles=[];for(let i=0;i<8;i++){const p=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,1,6),wood);SITE.g.add(p);SITE.poles.push(p);}
  SITE.sign=label("Building site",0xffe08a);SITE.sign.scale.set(3.4,.6,1);SITE.g.add(SITE.sign);
  ["Tiro","Brocchus","Vibia","Sextus"].forEach((nm,i)=>{const o=npc(["villager.glb","merchant.glb","cook.glb","villager.glb"][i],0,0,0);const lb=label(`${nm} the builder`,0xffffff);lb.scale.set(2.2,.34,1);lb.position.y=2.35;o.g.add(lb);o.g.visible=false;SITE.workers.push({o,name:nm,t:Math.random()*2});});}
function placeSite(L){SITE.lot=L;SITE.g.visible=!!L;if(!L)return;const w=Math.max(2,L.w-.4),d=Math.max(2,L.d-.4);SITE.slab.scale.set(w,1,d);SITE.slab.position.set(L.x,.12,L.z);
  SITE.poles.forEach((p,i)=>{const a=i%4,sx=a<2?-1:1,sz=a%2?-1:1,out=i<4?.4:1.1;p.position.set(L.x+sx*(w/2+out),0,L.z+sz*(d/2+out));});
  SITE.sign.position.set(L.x,0,L.z);
  const spots=[[-w/2-.9,0],[w/2+.9,0],[0,-d/2-.9],[0,d/2+.9]];SITE.workers.forEach((W,i)=>{const [dx,dz]=spots[i];W.o.g.position.set(L.x+dx,0,L.z+dz);W.o.g.lookAt(L.x,0,L.z);W.o.g.visible=true;});}
function siteProgress(k){const L=SITE.lot;if(!L)return;const hh=Math.max(.3,L.h*k);SITE.frame.scale.set(Math.max(2,L.w-.6),hh,Math.max(2,L.d-.6));SITE.frame.position.set(L.x,.25+hh/2,L.z);
  SITE.poles.forEach(p=>{p.scale.y=hh+1.2;p.position.y=(hh+1.2)/2;});SITE.sign.position.y=hh+1.6;}
const TOWN_RATE=()=>Math.max(1,Math.floor(PEOPLE.filter(pp=>!pp.guard).length/10));   // whole buildings per day: one for every 10 villagers
let townDone=-1;
function stepTown(dt){const age=townAgeDays(),done=Math.min(LOTS.length,Math.floor(age*TOWN_RATE())),k=age*TOWN_RATE()-Math.floor(age*TOWN_RATE());
  if(done!==townDone){const first=townDone<0;LOTS.forEach((L,i)=>setLot(L,i<done));
    if(!first&&done>townDone&&LOTS[done-1]){const L=LOTS[done-1];lawSay(`The villagers finished building ${L.name}!`);if(Math.hypot(P.pos.x-L.x,P.pos.z-L.z)<60)for(let i=0;i<30;i++)PUFF.emit(new THREE.Vector3(L.x+rnd(-L.w/2,L.w/2),rnd(0,3),L.z+rnd(-L.d/2,L.d/2)),rnd3(1.5),C(0xc8b89a).multiplyScalar(.5),1.2,{drag:2});}
    townDone=done;placeSite(LOTS[done]||null);}
  if(SITE.lot){siteProgress(k);SITE.workers.forEach(W=>{const r=W.o.rig;W.t-=dt;if(r&&W.t<=0){W.t=rnd(1.2,2.4);r.full("1H_Melee_Attack_Chop",{once:true,restart:true,dur:.8,then:()=>r.clearFull()});
      if(W.o.g.position.distanceTo(P.pos)<40)setTimeout(()=>{const at=W.o.g.position.clone().add(new THREE.Vector3(0,1.2,0)).lerp(new THREE.Vector3(SITE.lot.x,1.2,SITE.lot.z),.25);sparks(at,4,0xffd27a);},420);}});}
  else SITE.workers.forEach(W=>{W.o.g.visible=false;});}
// the town square noticeboard tells you how far along the town is
function townNote(){const done=Math.max(0,townDone),N=LOTS.length,L=LOTS[done];return done>=N?`Day ${townDay()} — the town is finished!`:`Day ${townDay()} — ${done} of ${N} buildings done. Building now: ${L.name}. The ${PEOPLE.filter(pp=>!pp.guard).length} villagers finish ${TOWN_RATE()} building${TOWN_RATE()>1?"s":""} a day.`;}
// ---------------- people's orders (2026-11-22, Barbara: "their complaints will now be like engineering — I need a cup — something you need
// to build"). Each town day some villagers need something: easy (cup, bowl…), medium (chair, bed…), hard (house, car…). Talk to them to take
// the order, build it at the workbench in the library, test it, make it and bring it back. Things break, too ("My chair broke!").
const ORD_GIVERS=()=>[...VILLAGERS.map(v=>v.name),...CITIZEN_NAMES];
function ordersFor(day){let s=(Math.floor(ROOMLIFE.born)%100000)*31+day*7919;const r=()=>(s=(s*48271)%2147483647)/2147483647;const G=ORD_GIVERS().slice(),out=[];
  const pool={easy:BUILD.ORDER.filter(k=>BUILD.ITEMS[k].level==="easy"),medium:BUILD.ORDER.filter(k=>BUILD.ITEMS[k].level==="medium"),hard:BUILD.ORDER.filter(k=>BUILD.ITEMS[k].level==="hard")};
  for(let i=0;i<7&&G.length;i++){const who=G.splice(Math.floor(r()*G.length),1)[0],q=r(),lv=q<.45?"easy":q<.85?"medium":"hard",list=pool[lv],item=list[Math.floor(r()*list.length)],I=BUILD.ITEMS[item];
    const broke=r()<.35&&!["house","car","boat","doghouse"].includes(item);
    out.push({key:`${Math.floor(ROOMLIFE.born)}:${day}:${who}`,who,item,day,pay:BUILD.LV[lv].pay+Math.floor(r()*6),text:broke?`My ${I.name} broke! I need a new one.`:I.ask});}
  return out;}
let ORDST;try{ORDST=JSON.parse(localStorage.getItem("elementum.orders")||"{}");}catch(e){ORDST={};}
const ordSave=()=>{try{localStorage.setItem("elementum.orders",JSON.stringify(ORDST));}catch(e){}};
function openOrders(){const d=townDay();const all=[...ordersFor(d),...ordersFor(d-1),...ordersFor(d-2)];return all.filter((o,i)=>all.findIndex(x=>x.who===o.who)===i||ORDST[o.key]);}   // today's, and older ones you took
const myOrders=()=>openOrders().filter(o=>ORDST[o.key]&&ORDST[o.key].acc&&!ORDST[o.key].done);
const hasBuilt=(id,tested)=>INV.findIndex(s=>s&&s.t==="build"&&s.id===id&&!(tested&&s.exp));   // tested: an order needs one that passed the test, not an experiment that only looks like one
const ORD={pos:new THREE.Vector3(),o:null,p:null},OMARK={};
ACTS.push({pos:ORD.pos,r:2.6,hidden:()=>!ORD.o,label:()=>{const o=ORD.o;if(!o)return "";const st=ORDST[o.key]||{};const I=BUILD.ITEMS[o.item];
    return st.acc?(hasBuilt(o.item,true)>=0?`Give ${o.who} your ${I.name}`:`${o.who} is waiting for a ${I.name}`):`Talk to ${o.who}`;},
  run:()=>{const o=ORD.o;if(!o)return;const st=ORDST[o.key]||{},I=BUILD.ITEMS[o.item],L=BUILD.LV[I.level];
    if(!st.acc){ask(`${o.who}: “${o.text}” — ${I.icon} ${I.name} · ${L.name} · pays ${o.pay} denarii`,[["I'll build it",()=>{ORDST[o.key]={acc:1};ordSave();lawSay(`Order taken: a ${I.name} for ${o.who}. Build it at the workbench in the library (P shows your orders).`);}],["Not now",null]]);return;}
    const i=hasBuilt(o.item,true);if(i<0){lawSay(`${o.who}: “Have you built my ${I.name} yet? The workbench is in the library.”`);return;}
    INV[i]=null;select(SEL);invHud();ORDST[o.key]={acc:1,done:1};ordSave();COINS+=o.pay;coinHud();const p=ORD.p;if(p&&p.o&&p.o.rig)p.o.rig.full("Cheer",{once:true,restart:true,dur:1.4,then:()=>p.o.rig.clearFull()});
    lawSay(`${o.who}: “My own ${I.name}! Thank you!” — +${o.pay} denarii`);FX.stars(P.pos.clone().add(new THREE.Vector3(0,2,0)),"gold",6,1.4);}});
function stepOrders(dt){let best=null,bd=2.6;const list=openOrders();const seen=new Set();
  for(const o of list){const st=ORDST[o.key]||{};if(st.done)continue;const p=personNamed(o.who);if(!p||!p.o||!p.o.g)continue;seen.add(o.who);const wp=p.o.g.getWorldPosition(_wp);
    // above their head: "?" and how hard the job is (Barbara, 2026-11-22: "say the level it is above"); ✅ once you have their thing
    const ready=st.acc&&hasBuilt(o.item,true)>=0,lv=BUILD.ITEMS[o.item].level,txt=ready?"✅ Ready":`? ${BUILD.LV[lv].name}`;let q=OMARK[o.who];
    if(!q||q.userData.t!==txt){if(q&&q.parent)q.parent.remove(q);q=OMARK[o.who]=label(txt,ready?0x9dffb0:{easy:0x7de08a,medium:0xffc24a,hard:0xff7a6a}[lv]);q.scale.set(3.4,.85,1);q.position.y=3.6;q.userData.t=txt;p.o.g.add(q);}
    q.visible=p.o.g.visible!==false&&(!st.acc||ready)&&!(p.pp&&p.pp.down);
    const d=Math.hypot(wp.x-P.pos.x,wp.z-P.pos.z);if(d<bd&&!(p.pp&&p.pp.down)&&p.o.g.visible!==false){bd=d;best={o,p,x:wp.x,z:wp.z};}
    if(p.fixed&&p.bub){p.bubT-=dt;if(p.bubT<=0)say(p,null);}
    if(d<16&&!st.acc&&!p.bub&&Math.random()<dt*.1)say(p,o.text,3.6);}
  for(const n in OMARK)if(!seen.has(n))OMARK[n].visible=false;
  ORD.o=best&&best.o;ORD.p=best&&best.p;if(best){ORD.pos.set(best.x,0,best.z);const t=P.pos.clone().sub(ORD.pos);t.y=0;if(t.length()>.01)ORD.pos.addScaledVector(t.normalize(),.25);}}
function ordersTab(box){const mine=myOrders();let h=`<p class="purse">🪙 <b>${COINS}</b> denarii</p><p class="tip">${esc(townNote())}</p><h3>Your orders</h3>`;
  if(!mine.length)h+=`<p class="tip">No orders yet. People with a <b>?</b> over their head need something built — walk up and talk to them.</p>`;
  else h+=`<div class="list">${mine.map(o=>{const I=BUILD.ITEMS[o.item],L=BUILD.LV[I.level];return `<div class="deal"><span>${I.icon} <b>${esc(I.name)}</b> for ${esc(o.who)} · ${L.name} · ${o.pay} 🪙<br><small>“${esc(o.text)}” ${hasBuilt(o.item,true)>=0?"— ✅ built! Take it to "+esc(o.who)+".":"— build it at the workbench in the library."}</small></span></div>`;}).join("")}</div>`;
  box.innerHTML=h;}
// the workbench: in the library (Barbara's rule) — orders first, or build anything for yourself
function readBook(){if(!started||P.down)return;G.firing=false;if(document.exitPointerLock)document.exitPointerLock();BUILD.openIdeas({recipe:true,onClose:()=>hud()});}
function openIdeas(){if(!started||P.down)return;G.firing=false;if(document.exitPointerLock)document.exitPointerLock();BUILD.openIdeas({onClose:()=>hud()});}
function openBench(){if(!started||P.down)return;G.firing=false;if(document.exitPointerLock)document.exitPointerLock();
  BUILD.open({orders:myOrders().map(o=>Object.assign({},o)),onClose:()=>hud(),owns:k=>k==="car"?!!MYCAR.car:k==="boat"?!!MYBOAT.boat:false,made:res=>{const I=BUILD.ITEMS[res.item];
    if(res.item==="boat"&&!res.order){const had=!!MYBOAT.boat;makeBoat(res.parts);lawSay(had?"Your new boat replaced your old one — it's at the boat dock by the north gate.":"Your boat is waiting at the boat dock by the north gate. Walk up to it and press T to sail!");return true;}
    if(res.item==="car"&&!res.order){const had=!!MYCAR.car;makeOwnCar(carColor(res.parts),null,res.parts);myCarShare();lawSay(had?"Your new car replaced your old one — it's parked outside the library, locked.":"Your car is parked outside the library, locked — only you can get in. Walk up to it and press T.");return true;}
    const it={t:"build",id:res.item,n:1,thumb:res.thumb};it.parts=res.parts;if(res.fn)it.fn=res.fn;if(res.nm)it.nm=res.nm;if(res.ef)it.ef=res.ef;if(res.exp)it.exp=1;if(res.item==="house"){const c=houseColors(res.parts);it.wall=c.wall;it.roof=c.roof;}
    if(!addItem(it)){lawSay("Your bag is full — make some room first.");return false;}return true;}});}
function hexOf(p){return p.color?parseInt(p.color.slice(1),16):({wood:0xa8743f,clay:0xe9dcc8,metal:0x9aa3ad,plastic:0x4f8fd8,glass:0xbfe6ff,fabric:0xd85a6a,stone:0x9a958c,rubber:0x2a2a2e,door:0x7a4a28,window:0xa9d8ff}[p.mat]||0xa8743f);}
function carColor(parts){const body=parts.filter(p=>p.shape==="box"||p.shape==="shell").sort((a,b)=>(b.w*b.h*b.d)-(a.w*a.h*a.d))[0];return (body?hexOf(body):0xc8432f)||1;}
function houseColors(parts){const big=parts.filter(p=>p.mat!=="door"&&p.mat!=="window").map(p=>({p,v:BUILD.meshOf(p)})).map(o=>({p:o.p,b:new THREE.Box3().setFromObject(o.v)}));
  const top=big.sort((a,b)=>b.b.max.y-a.b.max.y)[0],wall=big.filter(o=>o!==top).sort((a,b)=>(b.b.max.y-b.b.min.y)-(a.b.max.y-a.b.min.y))[0];return {wall:wall?hexOf(wall.p):0xd9c7a6,roof:top?hexOf(top.p):0xb5482f};}
// your own car (made at the workbench): parked outside the library, yours alone (not one of the town's shared cars)
// (Barbara, 2026-11-22: "when I make a car it should be only one car that can be locked so no one can get inside other than me")
// One car each: making another replaces the old one. It is locked unless you unlock it. Everyone in the room sees it parked
// (key "mycar:<your car id>"); a locked car only lets its owner in; an unlocked one anyone can drive, and it stays where they park it.
const MYCAR={id:(()=>{let v="";try{v=localStorage.getItem("elementum.carid")||"";}catch(e){}if(!/^[a-z0-9]{8,20}$/.test(v)){v="c"+Math.random().toString(36).slice(2,11).replace(/[^a-z0-9]/g,"");try{localStorage.setItem("elementum.carid",v);}catch(e){}}return v;})(),car:null,room:null};
const carPos=c=>Object.assign({x:+c.g.position.x.toFixed(2),z:+c.g.position.z.toFixed(2),yaw:+c.yaw.toFixed(3)},c.fuel<Infinity?{f:Math.round(c.fuel)}:{});
function myCarSave(){const c=MYCAR.car;if(!c)return null;const v=Object.assign({col:c.color,lock:c.locked?1:0},carPos(c));try{localStorage.setItem("elementum.mycar2",JSON.stringify(Object.assign({parts:c.parts},v)));}catch(e){}const p=compactParts(c.parts);if(p.length&&JSON.stringify(p).length<15000)v.p=p;return v;}
function myCarShare(d){const v=myCarSave();if(!v||!MP.ok)return;setKey("mycar:"+MYCAR.id,Object.assign(v,{n:(MP.you||"Someone").slice(0,16),d:d||null}));}
function makeOwnCar(col,at,parts){if(MYCAR.car){if(P.inCar===MYCAR.car)exitCar();scene.remove(MYCAR.car.g);CARS.splice(CARS.indexOf(MYCAR.car),1);}
  const s=at||{x:LIBRARY.x+9,z:LIBRARY.z-LIBRARY.d/2-5,yaw:0,lock:1};const c=parts&&parts.length?makeCarOf(parts,+s.x||0,+s.z||0,+s.yaw||0,col):makeCar(+s.x||0,+s.z||0,+s.yaw||0,col);if(s.f!==undefined)c.fuel=+s.f;c.own=true;c.locked=s.lock!==0;c.hidden=false;c.g.visible=true;MYCAR.car=c;MYCAR.room=null;myCarSave();return c;}
{let v=null;try{v=JSON.parse(localStorage.getItem("elementum.mycar2")||"null");}catch(e){}if(v&&v.col!==undefined)restore("car",()=>makeOwnCar(v.col,v,v.parts));
  else{let col=null;try{col=localStorage.getItem("elementum.mycar");}catch(e){}if(col)restore("car",()=>makeOwnCar(+col));}}
const REMOTE_CARS={};
function carKeyApply(id,val){
  if(id===MYCAR.id){const c=MYCAR.car;if(!c||!val||P.inCar===c)return;c.taken=val.d&&val.d!==MP.id?val.d:null;c.g.visible=!c.taken;if(!val.d){c.g.position.set(+val.x||0,0,+val.z||0);c.yaw=+val.yaw||0;c.g.rotation.y=c.yaw;myCarSave();}return;}
  let c=REMOTE_CARS[id];
  if(!val){if(c&&P.inCar!==c){scene.remove(c.g);CARS.splice(CARS.indexOf(c),1);delete REMOTE_CARS[id];}return;}
  const look=(val.col|0)+JSON.stringify(val.p||0);if(!c||c.look!==look){if(c){if(P.inCar===c)return;scene.remove(c.g);CARS.splice(CARS.indexOf(c),1);}c=REMOTE_CARS[id]=Array.isArray(val.p)&&val.p.length?makeCarOf(val.p,+val.x||0,+val.z||0,+val.yaw||0,val.col|0):makeCar(+val.x||0,+val.z||0,+val.yaw||0,val.col|0);c.look=look;c.ownerId=id;}if(val.f!==undefined&&P.inCar!==c)c.fuel=+val.f||0;
  c.ownerName=String(val.n||"Someone").slice(0,16);c.locked=!!val.lock;if(P.inCar===c)return;c.taken=val.d&&val.d!==MP.id?val.d:null;c.g.visible=!c.taken;
  if(!val.d){c.g.position.set(+val.x||0,0,+val.z||0);c.yaw=+val.yaw||0;c.g.rotation.y=c.yaw;}}
// tell the room where a car is and who is driving it
function carShareState(c,driving){if(c.boat){boatShare(driving?MP.id:null);return;}const d=driving?MP.id:null;if(c.own){myCarShare(d);return;}
  if(c.ownerId){setKey("mycar:"+c.ownerId,Object.assign({col:c.color,lock:c.locked?1:0,n:c.ownerName,d},carPos(c),c.parts?{p:compactParts(c.parts)}:{}));return;}
  setKey(carKey(c),driving?{d}:carPos(c));}
function carUse(c){if(!c)return;if(c.boat){enterCar(c);return;}
  if(c.own){ask(`Your car — ${c.locked?"🔒 locked: only you can get in":"🔓 unlocked: anyone can drive it"}.`,[["🚗 Drive",()=>enterCar(c)],[c.locked?"🔓 Unlock it":"🔒 Lock it",()=>{c.locked=!c.locked;myCarShare();lawSay(c.locked?"Your car is locked — only you can get in.":"Your car is unlocked — anyone can drive it.");}],["Cancel",null]]);return;}
  if(c.ownerId&&c.locked){lawSay(`🔒 ${c.ownerName}'s car is locked.`);return;}enterCar(c);}
// your own house (Barbara: "you also build your own house"): the plot is empty until you bring house plans made at the workbench.
// Everyone in your room sees it once it's built.
HOUSES.forEach(h=>{const r={x0:h.x-HW/2-.6,x1:h.x+HW/2+.6,z0:h.z-HD/2-1.6,z1:h.z+HD/2+.6};h.lotObjs=[];h.lotBlks=[];
  for(const o of scene.children){if(o===body||o.isLight)continue;const g=o.geometry&&o.geometry.parameters;if(o.isMesh&&g&&g.width&&g.height&&g.width*g.height>500)continue;if(TOWNFOLK.some(t=>t.g===o))continue;
    if(o.position.x>=r.x0&&o.position.x<=r.x1&&o.position.z>=r.z0&&o.position.z<=r.z1&&o!==h.sign)h.lotObjs.push({o,v:o.visible});}
  BLOCKS.forEach(b=>{if(b.x>=r.x0&&b.x<=r.x1&&b.z>=r.z0&&b.z<=r.z1)h.lotBlks.push({b,pass:!!b.pass});});h.built=true;});
let MYHOUSE=null;try{MYHOUSE=JSON.parse(localStorage.getItem("elementum.myhouse")||"null");}catch(e){}
// a house comes empty (Barbara: "there shouldn't be beds in the house and chests — add that in the workbench"): you build a bed and a chest
// at the workbench and put them in. Your own house shows the bed and chest you designed; other players' houses show theirs as simple ones.
function plotHouse(h,parts){if(h.des){unsolidify(h.des);scene.remove(h.des.g);h.des=null;}if(!h.door0)h.door0={x:h.door.x,y:h.door.y,z:h.door.z,w:h.door.w,h:h.door.h,d:h.door.d,bed:h.bed.clone(),chest:h.chest.clone()};
  if(!parts||!parts.length){Object.assign(h.door,{x:h.door0.x,y:h.door0.y,z:h.door0.z,w:h.door0.w,h:h.door0.h,d:h.door0.d});h.bed.copy(h.door0.bed);h.chest.copy(h.door0.chest);return;}
  const g=furnitureMesh(parts);g.position.set(h.x,0,h.z);scene.add(g);h.des={g,item:{id:"house"}};solidify(h.des);const bb=new THREE.Box3().setFromObject(g),wall=bb.clone();let dr=null;
  g.traverse(m=>{const p=m.userData&&m.userData.part;if(!m.isMesh||!p)return;const b=new THREE.Box3().setFromObject(m);if(p.mat==="door"&&(!dr||b.max.y-b.min.y>dr.max.y-dr.min.y))dr=b;});
  const main=parts.filter(p=>p.shape==="shell"||p.shape==="tube").map(p=>new THREE.Box3().setFromObject(BUILD.meshOf(p))).sort((a,b)=>(b.max.x-b.min.x)*(b.max.z-b.min.z)-(a.max.x-a.min.x)*(a.max.z-a.min.z))[0];const W=main?(main.max.x-main.min.x)/100:(bb.max.x-bb.min.x),D=main?(main.max.z-main.min.z)/100:(bb.max.z-bb.min.z);
  if(dr)Object.assign(h.door,{x:(dr.min.x+dr.max.x)/2,y:Math.max(0,dr.min.y),z:(dr.min.z+dr.max.z)/2,w:dr.max.x-dr.min.x,h:dr.max.y-dr.min.y,d:Math.max(.3,dr.max.z-dr.min.z)});
  const k=tubeIn(parts)?.7:1;h.bed.set(h.x-Math.max(0,Math.min(2.2,W/2-.95))*k,0,h.z+Math.max(0,Math.min(1.3,D/2-1.4))*k);h.chest.set(h.x-Math.max(0,Math.min(2.5,W/2-.9))*k,0,h.z-Math.max(0,Math.min(1.2,D/2-1.2))*k);}
const tubeIn=parts=>!parts.some(p=>p.shape==="shell")&&parts.some(p=>p.shape==="tube");
function setHouseBuilt(h,on,col){if(h.door&&!on)h.door.pass=true;const pp=on?(h.mine?MYHOUSE&&MYHOUSE.parts:(WORLD_KEYS["hbp:"+h.slot+"house"]||{}).p):null;const ck=on?JSON.stringify(col||{}).length+":"+JSON.stringify(pp||0).length+["bed","chest"].map(k=>h.mine?"":JSON.stringify(WORLD_KEYS["hbp:"+h.slot+k]||0).length):"";if(h.built===on&&h.ck===ck)return;h.built=on;h.ck=ck;
  if(!h.bedG){h.bedG=(h.lotObjs.find(({o})=>o.position.distanceTo(h.bed)<.05)||{}).o;h.chestG=(h.lotObjs.find(({o})=>o.position.distanceTo(h.chest)<.05)||{}).o;}
  const std=on&&!pp;if(h.hasDes!==!!pp||pp!==h.desP){h.hasDes=!!pp;h.desP=pp;plotHouse(h,pp);}if(h.bedG)h.bedG.position.copy(h.bed);if(h.chestG)h.chestG.position.copy(h.chest);
  h.lotObjs.forEach(({o,v})=>{o.visible=std?v:false;});h.lotBlks.forEach(({b,pass})=>{if(b===h.door)return;b.pass=std?pass:true;});
  if(on&&col&&col.roof!==undefined)h.lotObjs.forEach(({o})=>{if(o.geometry&&o.geometry.type==="ConeGeometry"&&o.material&&o.material.color){if(!o.userData.own){o.material=o.material.clone();o.userData.own=1;}o.material.color.setHex(col.roof);}});
  const look=k=>h.mine?MYHOUSE&&MYHOUSE[k+"Parts"]:col&&col[k]?(WORLD_KEYS["hbp:"+h.slot+k]||{}).p:null;["bed","chest"].forEach(k=>{const G=k==="bed"?h.bedG:h.chestG;const custom=h["my_"+k];if(custom){scene.remove(custom);h["my_"+k]=null;}
    const has=on&&col&&col[k];h["has_"+k]=!!has;const pts=has?look(k):null;if(G)G.visible=!!has&&!pts;
    if(pts){const g=furnitureMesh(pts);g.position.copy(k==="bed"?h.bed:h.chest);scene.add(g);h["my_"+k]=g;}});}
function furnitureMesh(parts){const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);const box=new THREE.Box3();
  parts.forEach(p=>{const m=BUILD.meshOf(p);inner.add(m);box.union(new THREE.Box3().setFromObject(m));});const c=box.getCenter(new THREE.Vector3());inner.position.set(-c.x,-box.min.y,-c.z);g.scale.setScalar(.01);return g;}
const houseParts=h=>["bed","chest","house"].forEach(k=>{const p=compactParts(k==="house"?MYHOUSE.parts:MYHOUSE[k+"Parts"]);setKey("hbp:"+h.slot+k,p.length?{p}:null);});
function putFurniture(k){const h=HOME.h,I=BUILD.ITEMS[k];if(!h.built||!MYHOUSE)return;const i=hasBuilt(k);if(i<0){lawSay(`Your ${I.name} goes here. Build one at the workbench in the library (Build for yourself → ${I.name[0].toUpperCase()+I.name.slice(1)}).`);return;}
  const it=INV[i];INV[i]=null;select(SEL);invHud();MYHOUSE[k]=1;if(it.parts)MYHOUSE[k+"Parts"]=it.parts;try{localStorage.setItem("elementum.myhouse",JSON.stringify(MYHOUSE));}catch(e){}
  if(MP.ok&&h.name)setKey("hb:"+h.slot,{n:h.name,roof:MYHOUSE.roof,wall:MYHOUSE.wall,bed:MYHOUSE.bed||0,chest:MYHOUSE.chest||0});houseParts(h);h.ck="";
  lawSay(k==="bed"?"Your bed is in! Now you can sleep at home.":"Your chest is in! Keep your things in it.");FX.stars((k==="bed"?h.bed:h.chest).clone().add(new THREE.Vector3(0,1,0)),"gold",6,1.2);}
HOUSES.forEach(h=>ACTS.push({pos:h.bed,r:2,hidden:()=>h.mine||!h.built||!h.has_bed,label:()=>`🛏️ Sleep in ${h.name||"this"}${h.name?"'s":""} bed`,run:()=>startSleep(houseSpot(h))}));   // any bed you can see (Barbara: "you can sleep in any bed")
ACTS.push({get pos(){return HOME.bed;},r:2.2,hidden:()=>!HOME.h.built||!MYHOUSE||!!MYHOUSE.bed,label:()=>hasBuilt("bed")>=0?"🛏️ Put your bed here":"🛏️ Your bed goes here — build one at the workbench",run:()=>putFurniture("bed")});
ACTS.push({get pos(){return HOME.chest;},r:2,hidden:()=>!HOME.h.built||!MYHOUSE||!!MYHOUSE.chest,label:()=>hasBuilt("chest")>=0?"🧰 Put your chest here":"🧰 Your chest goes here — build one at the workbench",run:()=>putFurniture("chest")});
function stepHomes(){if(MP.ok&&MYCAR.car&&MYCAR.room!==MP.room&&P.inCar!==MYCAR.car){MYCAR.room=MP.room;myCarShare();}
  HOUSES.forEach(h=>{const key=WORLD_KEYS["hb:"+h.slot];const on=h.mine?!!MYHOUSE:!!(h.name&&key&&key.n===h.name);setHouseBuilt(h,on,on?(h.mine?MYHOUSE:key):null);
    if(h.mine&&MYHOUSE&&MP.ok&&h.name&&(!key||key.n!==h.name)&&!h.claimT){h.claimT=1;setKey("hb:"+h.slot,{n:h.name,roof:MYHOUSE.roof,wall:MYHOUSE.wall,bed:MYHOUSE.bed||0,chest:MYHOUSE.chest||0});houseParts(h);setTimeout(()=>{h.claimT=0;},5000);}});}
const WORLD_KEYS={};
ACTS.push({get pos(){return HOME.h.doorP;},r:2.4,hidden:()=>!!MYHOUSE,label:()=>hasBuilt("house")>=0?"🏠 Build your house here (you have the plans)":"🏠 Your empty plot — make house plans at the library's workbench",
  run:()=>{const i=hasBuilt("house");if(i<0){lawSay("Design a house at the workbench in the library. When it passes the test, make it — you'll get the plans. Bring them here.");return;}
    if(INV[i].parts&&INV[i].parts.length){const s=new THREE.Box3().setFromObject(furnitureMesh(INV[i].parts)).getSize(new THREE.Vector3());if(s.x>9.6||s.z>8.5){lawSay(`Your house is ${s.x.toFixed(1)} × ${s.z.toFixed(1)} m — the plot is 9.6 × 8.5 m. Hold the plans and click to build it anywhere else.`);return;}}
    const it=INV[i];INV[i]=null;select(SEL);invHud();MYHOUSE={roof:it.roof!==undefined?it.roof:0xb5482f,wall:it.wall,parts:it.parts&&it.parts.length?it.parts:undefined};try{localStorage.setItem("elementum.myhouse",JSON.stringify(MYHOUSE));}catch(e){}
    const h=HOME.h;setHouseBuilt(h,true,MYHOUSE);for(let k=0;k<30;k++)PUFF.emit(new THREE.Vector3(h.x+rnd(-3,3),rnd(0,3),h.z+rnd(-2,2)),rnd3(1.5),C(0xc8b89a).multiplyScalar(.5),1.2,{drag:2});
    if(MP.ok&&h.name){setKey("hb:"+h.slot,{n:h.name,roof:MYHOUSE.roof,wall:MYHOUSE.wall});houseParts(h);}lawSay("Your house is built! It's empty — build a bed and a chest at the workbench and put them in.");}});
// ---------------- placing things you built (2026-11-22, Barbara: "shouldn't I be able to place anything like a chair and stuff").
// Hold something you built and click (or F): it's set down on the ground in front of you, looking just like your design. Everyone in
// your room sees it (they see it as the library's version of that thing). Walk up to your own and press T to pick it up again.
const PLACED={mine:[],remote:{},room:null,max:40};
function placedMesh(it){const parts=it.parts&&it.parts.length?it.parts:((BUILD.DESIGNS[it.id]||[])[0]||{parts:()=>[]}).parts();
  if(parts.length)return furnitureMesh(parts);const s=iconSprite((BUILD.ITEMS[it.id]||{icon:"🛠️"}).icon);s.scale.setScalar(.8);s.position.y=.5;const g=new THREE.Group();g.add(s);return g;}
function placedSave(){try{localStorage.setItem("elementum.placed",JSON.stringify(PLACED.mine.map(q=>({pid:q.pid,item:q.item,x:q.x,y:q.y||0,z:q.z,r:q.r,open:!!q.open,fl:!!q.flowers}))));}catch(e){}}
// (a "function", not a "const": a saved car is put back while this file is still loading, before this line — 2026-11-25 everyone with a car got a frozen game)
function compactParts(parts){return (Array.isArray(parts)?parts:[]).slice(0,120).map(p=>{const o={};for(const k in p){if(k==="id"||k==="name")continue;const v=p[k];o[k]=typeof v==="number"?Math.round(v*10)/10:v;}return o;});}
function placedVal(q){const v={i:q.item.id,u:MP.id,x:R2(q.x),y:R2(q.y||0),z:R2(q.z),r:+q.r.toFixed(2),o:q.open?1:0,f:q.flowers?1:0,e:q.useT||0,w:MYCAR.id};["fn","nm","ef","sp","gas","water"].forEach(k=>{if(q.item[k])v[k]=q.item[k];});const p=compactParts(q.item.parts);if(p.length&&JSON.stringify(p).length<15000)v.p=p;return v;}
const placedGone=()=>{try{return JSON.parse(localStorage.getItem("elementum.placedGone")||"[]");}catch(e){return [];}};
function placedShare(q,gone,force){if(gone){try{localStorage.setItem("elementum.placedGone",JSON.stringify(placedGone().concat(q.pid).slice(-200)));}catch(e){}}if(!MP.ok&&!force)return;setKey("pl:"+q.pid,gone?null:placedVal(q));}
// walls and roofs of what you set down are solid (Barbara: "make the walls solid and roof"): each big part becomes a box you bump into and
// can stand on (a doghouse's walls, a table top, a roof); thin bits (legs, rails, handles) and doors stay walk-through
const NOGHOST={material:{visible:false}};
function solidify(q){unsolidify(q);q.blks=[];if(q.item.id==="ladder"||fnOf(q.item)==="pet")return;q.g.updateMatrixWorld(true);const recs=[],doors=[];
  q.g.traverse(m=>{if(m.isMesh&&m.userData.part&&m.userData.part.mat==="door")doors.push(new THREE.Box3().setFromObject(m).expandByScalar(.05));});
  q.g.traverse(m=>{const pt=m.userData&&m.userData.part;if(!m.isMesh||!pt||pt.shape!=="tube"||(pt.r||0)<40)return;m.userData.ring=true;const c=m.getWorldPosition(new THREE.Vector3()),R=pt.r/100,t=Math.max(.15,(pt.wall||10)/100),H=(pt.h||200)/100,N=16;
    for(let i=0;i<N;i++){const a=(i+.5)/N*Math.PI*2,x=c.x+Math.cos(a)*(R-t/2),z=c.z+Math.sin(a)*(R-t/2),L=2*Math.PI*R/N;const box=new THREE.Box3(new THREE.Vector3(x-L/2,c.y-H/2,z-L/2),new THREE.Vector3(x+L/2,c.y+H/2,z+L/2));if(doors.some(D=>D.containsPoint(new THREE.Vector3(x,c.y,z))||D.intersectsBox(box)))continue;
      recs.push({x,y:Math.max(0,c.y-H/2),z,w:L*.9,h:H,d:L*.9});}});   // a ladder is climbed with T, never walked up like stairs (Barbara: "you climb it very fast then fall down")
  q.g.traverse(m=>{if(!m.isMesh||!m.userData.part||m.userData.part.mat==="door")return;const b=new THREE.Box3().setFromObject(m),w=b.max.x-b.min.x,d=b.max.z-b.min.z,h=b.max.y-b.min.y;
    if(m.userData.ring||Math.max(w,d)<.3||h<.03||(h<.1&&Math.min(w,d)<.25))return;let pieces=[b];
    doors.forEach(D=>{pieces=pieces.flatMap(B=>{if(!B.intersectsBox(D))return [B];const out=[],alongX=(B.max.x-B.min.x)>=(B.max.z-B.min.z);   // cut the doorway out: left, right and above
      if(alongX){if(D.min.x>B.min.x)out.push(new THREE.Box3(B.min.clone(),new THREE.Vector3(D.min.x,B.max.y,B.max.z)));if(D.max.x<B.max.x)out.push(new THREE.Box3(new THREE.Vector3(D.max.x,B.min.y,B.min.z),B.max.clone()));}
      else{if(D.min.z>B.min.z)out.push(new THREE.Box3(B.min.clone(),new THREE.Vector3(B.max.x,B.max.y,D.min.z)));if(D.max.z<B.max.z)out.push(new THREE.Box3(new THREE.Vector3(B.min.x,B.min.y,D.max.z),B.max.clone()));}
      if(D.max.y<B.max.y)out.push(new THREE.Box3(new THREE.Vector3(alongX?D.min.x:B.min.x,D.max.y,alongX?B.min.z:D.min.z),new THREE.Vector3(alongX?D.max.x:B.max.x,B.max.y,alongX?B.max.z:D.max.z)));return out;});});
    pieces.forEach(B=>{const w2=B.max.x-B.min.x,d2=B.max.z-B.min.z;if(w2<.02||d2<.02)return;recs.push({x:(B.min.x+B.max.x)/2,y:Math.max(0,B.min.y),z:(B.min.z+B.max.z)/2,w:w2,h:B.max.y-Math.max(0,B.min.y),d:d2});});});
  recs.forEach(r=>{const rec=Object.assign(r,{mesh:NOGHOST,marks:[],placed:true});BLOCKS.push(rec);q.blks.push(rec);});}
function unsolidify(q){(q.blks||[]).forEach(b=>{const i=BLOCKS.indexOf(b);if(i>=0)BLOCKS.splice(i,1);});q.blks=[];}
function addPlaced(q){const fl=q.fl;q.g=placedMesh(q.item);q.g.position.set(q.x,q.y||0,q.z);q.g.rotation.y=q.r+(q.open?Math.PI/2:0);scene.add(q.g);PLACED.mine.push(q);solidify(q);if(fl){q.flowers=null;addFlowers(q);}return q;}
function addFlowers(q){if(q.flowers)return;q.flowers=new THREE.Group();[0xff6a8a,0xffd84a,0xb07aff,0xff9a3a,0xffffff].forEach((c,i)=>{const st=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.35,4),LOOK.toon(0x3f8a3a));const a=i/5*6.28;st.position.set(Math.cos(a)*.03,.2,Math.sin(a)*.03);st.rotation.set(Math.sin(a)*.25,0,Math.cos(a)*.25);q.flowers.add(st);
    const b=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),LOOK.toon(c));b.position.set(Math.cos(a)*.07,.37,Math.sin(a)*.07);q.flowers.add(b);});const top=new THREE.Box3().setFromObject(q.g).max.y;q.flowers.position.set(q.x,top-.15,q.z);scene.add(q.flowers);}
function placeThing(i){const it=INV[i];if(!it||it.t!=="build")return;
  if(P.inCar){lawSay("Get out first to set it down.");return;}if(PLACED.mine.length>=PLACED.max){lawSay(`You've set down ${PLACED.max} things already — pick some up first.`);return;}
  const big=it.id==="house"?Math.max(3,new THREE.Box3().setFromObject(placedMesh(it)).getSize(new THREE.Vector3()).z/2+1.5):2;const at=P.pos.clone().add(new THREE.Vector3(-Math.sin(P.yaw)*big,0,-Math.cos(P.yaw)*big));at.y=P.onGround?P.pos.y:0;if(isWater(at.x,at.z,false)){lawSay("That's water — it would float away! Set it down on dry ground.");return;}
  // does it fit? (Barbara: "you can't put a ladder in a space if it is too high") — nothing solid may be where it would stand, up to its full height
  {const g=placedMesh(it);g.position.set(at.x,at.y,at.z);g.rotation.y=P.yaw+Math.PI;g.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(g),H=bb.max.y-at.y;
    const hit=BLOCKS.find(b=>!b.pass&&Math.abs(b.x-(bb.min.x+bb.max.x)/2)<b.w/2+(bb.max.x-bb.min.x)/2-.02&&Math.abs(b.z-(bb.min.z+bb.max.z)/2)<b.d/2+(bb.max.z-bb.min.z)/2-.02&&b.y<bb.max.y-.02&&b.y+b.h>at.y+.05);
    if(hit){const n=(BUILD.ITEMS[it.id]||{name:"thing"}).name;lawSay(hit.y>at.y+.3?`The ${n} is ${H.toFixed(1)} m tall — it doesn't fit under the ceiling here (only ${(hit.y-at.y).toFixed(1)} m). Find a higher space.`:`Something is in the way — there's no room for the ${n} there.`);return;}}
  INV[i]=null;select(SEL);invHud();const q=addPlaced({pid:"p"+Math.random().toString(36).slice(2,11),item:it,x:at.x,y:at.y,z:at.z,r:P.yaw+Math.PI});placedSave();placedShare(q);
  FX.stars(at.clone().add(new THREE.Vector3(0,.8,0)),"gold",4,1);popNum(at.clone().add(new THREE.Vector3(0,1.6,0)),`set down your ${it.nm||(BUILD.ITEMS[it.id]||{name:"thing"}).name}`,"spell");}
{let v=[];try{v=JSON.parse(localStorage.getItem("elementum.placed")||"[]");}catch(e){}(Array.isArray(v)?v:[]).forEach(q=>{if(q&&q.item&&q.pid)restore("placed thing",()=>addPlaced(q));});}
function placedKeyApply(pid,val){const mine=PLACED.mine.find(q=>q.pid===pid);if(mine){if(val){const ns=val.sp||null;if(JSON.stringify(ns)!==JSON.stringify(mine.item.sp||null)){mine.item.sp=ns||undefined;placedSave();}}if(val&&val.e)mine.useT=+val.e||0;if(val&&(!!val.o!==!!mine.open||!!val.f!==!!mine.flowers)){mine.open=!!val.o;mine.g.rotation.y=mine.r+(mine.open?Math.PI/2:0);if(val.f)addFlowers(mine);placedSave();}return;}
  const old=PLACED.remote[pid];const wasQ=old&&old.userData.q;if(old){if(wasQ)unsolidify(wasQ);scene.remove(old);if(wasQ&&wasQ.flowers)scene.remove(wasQ.flowers);delete PLACED.remote[pid];}
  if(!val||!BUILD.ITEMS[val.i]){if(wasQ&&P.sitting&&P.sitting.q===wasQ)standUp();if(wasQ&&P.climbing&&P.climbing.q===wasQ)P.climbing=null;return;}
  const item={id:val.i,t:"build",fn:BUILD.FNS[val.fn]?val.fn:undefined,ef:BUILD.cleanEf(val.ef)||undefined,nm:typeof val.nm==="string"?val.nm.slice(0,28):undefined,sp:val.sp||undefined,gas:+val.gas||undefined,water:Math.max(0,Math.min(9,val.water|0))||undefined,parts:Array.isArray(val.p)?val.p.filter(p=>p&&typeof p==="object"):null};const g=placedMesh(item);g.position.set(+val.x||0,+val.y||0,+val.z||0);g.rotation.y=(+val.r||0)+(val.o?Math.PI/2:0);scene.add(g);PLACED.remote[pid]=g;
  const q={pid,item,x:+val.x||0,y:+val.y||0,z:+val.z||0,r:+val.r||0,g,remote:true,val,open:!!val.o,useT:+val.e||0};g.userData.q=q;solidify(q);if(val.f)addFlowers(q);
  if(wasQ&&P.sitting&&P.sitting.q===wasQ)P.sitting.q=q;if(wasQ&&P.climbing&&P.climbing.q===wasQ)P.climbing.q=q;}
const PLACE_ACT={pos:new THREE.Vector3(),q:null};
ACTS.push({pos:PLACE_ACT.pos,r:1.6,hidden:()=>!PLACE_ACT.q||P.inCar||!!P.sitting||!!P.climbing,label:()=>`Pick up your ${PLACE_ACT.q.item.nm||(BUILD.ITEMS[PLACE_ACT.q.item.id]||{name:"thing"}).name}`,
  run:()=>{const q=PLACE_ACT.q;if(!q)return;if(!canAdd(q.item)){lawSay("Your bag is full.");return;}if(P.climbing&&P.climbing.q===q)P.climbing=null;unsolidify(q);scene.remove(q.g);if(q.flowers)scene.remove(q.flowers);PLACED.mine.splice(PLACED.mine.indexOf(q),1);placedSave();placedShare(q,true);addItem(q.item);PLACE_ACT.q=null;}});
// using what's set down (Barbara: "I should be able to sit and interact when I put things down"): sit on a chair, stool or bench; sleep in a
// bed; open a chest (your chests all hold the same things); drink from a cup, bucket or bowl; read at a bookshelf; open and close a door;
// put flowers in a vase. It works on other players' things too (except picking them up and their chests).
const USE_ACT={pos:new THREE.Vector3(),q:null},SITS=["chair","stool","bench"];
const TFN=["take","bomb","pet","music","firework","guard","maker","water","computer","storage"];
function useKind(q){const k=q.item.id,f=fnOf(q.item);if(f)return TFN.includes(f)&&!(f==="storage"&&q.remote)?"fn":null;return k==="book"?"book":SITS.includes(k)?"sit":k==="bed"?"bed":k==="chest"&&!q.remote?"chest":k==="cup"||k==="bucket"?"drink":k==="bowl"||k==="plate"?"eat":k==="shelf"?"read":k==="door"?"door":k==="vase"?"vase":k==="ladder"?"climb":null;}
function useLabel(q){const k=useKind(q),n=q.item.nm||(BUILD.ITEMS[q.item.id]||{name:"thing"}).name,ff=fnOf(q.item);return {book:"📕 Read the book",fn:ff?`${BUILD.FNS[ff].icon} ${{take:"Take some",bomb:"Set off",pet:"Stroke",music:"Play",firework:"Launch",guard:"Call soldiers with",maker:(q.useT||0)>Date.now()?"(still working)":"Take what it made —",water:"Drink from",computer:"Use",storage:"Open"}[ff]||"Use"} ${n}`:"",sit:`🪑 Sit on the ${n}`,bed:isNight()?"🛏️ Sleep until morning":"🛏️ Lie down for a nap",chest:"🧰 Open the chest",drink:`🥤 Have a drink from the ${n}`,eat:`🍲 Eat from the ${n}`,read:"📚 Read a book",door:q.open?"🚪 Close the door":"🚪 Open the door",vase:q.flowers?"🌸 Smell the flowers":"🌸 Put flowers in the vase",climb:"🪜 Climb the ladder"}[k]||"";}
function seatOf(q){const parts=q.item.parts&&q.item.parts.length?q.item.parts:((BUILD.DESIGNS[q.item.id]||[])[0]||{parts:()=>[]}).parts();let top=.45;try{const t=BUILD.test(q.item.id,parts);if(t.A.surf)top=t.A.surf.top/100;}catch(e){}return top;}
function sitOn(q){if(P.inCar||P.down)return;{const t=takenSpot({x:q.x,y:q.y||0,z:q.z});if(t){lawSay(`${t.name||"Someone"} is sitting here.`);return;}}P.sitting={q,pos:new THREE.Vector3(q.x,q.y||0,q.z),yaw:q.r+Math.PI,top:seatOf(q)};P.vel.set(0,0,0);P.pos.copy(P.sitting.pos);P.yaw=P.sitting.yaw;look.yaw=P.yaw;G.firing=false;
  popNum(P.pos.clone().add(new THREE.Vector3(0,2,0)),"move or press T to stand up","spell");}
// climbing a ladder you set down (Barbara: "ladder can climb"): forward climbs, back goes down, Space lets go; at the top, keep going
// forward to step off onto whatever is behind it (a roof, a wall, a balcony) — or drop down if there's nothing there
function climbStep(dt,inp){const z=P.climbing,q=z.q,up=-inp.z;
  if(jumpQ){jumpQ=false;P.climbing=null;P.vel.set(Math.sin(q.r)*2.5,3,Math.cos(q.r)*2.5);P.onGround=false;return;}
  if(up<0&&z.y<=z.base){P.climbing=null;P.pos.set(z.x,z.base,z.z);return;}
  if(up>0&&z.y>=z.top){P.climbing=null;P.pos.set(q.x-Math.sin(q.r)*.8,z.top+.15,q.z-Math.cos(q.r)*.8);P.vel.set(0,0,0);P.onGround=false;P.fallTop=undefined;return;}
  z.y=clamp(z.y+up*2*dt,z.base,z.top);P.pos.set(z.x,z.y,z.z);P.vel.set(0,0,0);P.onGround=true;P.fallTop=undefined;P.yaw=q.r;body.rotation.x=0;}
function standUp(){const z=P.sitting;if(!z)return;P.sitting=null;P.pos.set(z.q.x+Math.sin(z.q.r)*1.1,z.q.y||0,z.q.z+Math.cos(z.q.r)*1.1);}
function useThing(q){const k=useKind(q);if(!k)return;const at=new THREE.Vector3(q.x,1.2,q.z);
  if(k==="book")return readBook();if(k==="fn")return fnUse(q);
  if(k==="sit")return sitOn(q);
  if(k==="climb"){const top=Math.max(1,new THREE.Box3().setFromObject(q.g).max.y-.2);P.climbing={q,top,y:q.y||0,base:q.y||0,x:q.x+Math.sin(q.r)*.35,z:q.z+Math.cos(q.r)*.35};G.firing=false;
    popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"W / forward to climb up, S to go down, Space to let go","spell");return;}if(k==="bed"){const pts=q.item.parts&&q.item.parts.length?q.item.parts:BUILD.DESIGNS.bed[0].parts();let hi=null;const bb=new THREE.Box3();pts.forEach(p=>{const b=new THREE.Box3().setFromObject(BUILD.meshOf(p));bb.union(b);if(!hi||b.max.y>hi.max.y+1)hi=b;});
    const sz=bb.getSize(new THREE.Vector3()),c=bb.getCenter(new THREE.Vector3()),hc=hi.getCenter(new THREE.Vector3()),alongX=sz.x>sz.z;const head=alongX?(hc.x<c.x?-Math.PI/2:Math.PI/2):(hc.z<c.z-1?Math.PI:0);   // the head goes where the tall end of the bed is
    return startSleep(bedSpot(q.x,q.y||0,q.z,q.r+head,pts));}if(k==="chest"){toggleBag(true,"chest");return;}if(k==="read"){uiOpen(o=>DESIGN.openLibrary(o));return;}
  const tell=()=>{if(q.remote){if(MP.ok)setKey("pl:"+q.pid,Object.assign({},q.val,{o:q.open?1:0,f:q.flowers?1:0,e:q.useT||0}));}else{placedShare(q);placedSave();}};
  if(k==="drink"||k==="eat"){if((q.useT||0)>Date.now()){popNum(at,"empty — it fills up again soon","burn");return;}if(q.item.water>0){q.item.water--;if(!q.item.water)q.item.water=undefined;if(q.val)q.val=Object.assign({},q.val,{water:q.item.water});}q.useT=Date.now()+20000;const sp=q.item.sp;if(sp){q.item.sp=undefined;if(q.val)q.val=Object.assign({},q.val,{sp:undefined});spikedEat({sp});}needUp(k==="drink"?"water":"food",k==="drink"?30:25);tell();P.hp=Math.min(P.maxHp,P.hp+10);hud();popNum(at,k==="drink"?"+10 HP — fresh water!":"+10 HP — yum!","spell");return;}
  if(k==="door"){q.open=!q.open;const r0=q.r;tween(.4,t=>{q.g.rotation.y=r0+(q.open?t:1-t)*Math.PI/2;});tell();return;}
  if(k==="vase"){if(!q.flowers){addFlowers(q);tell();}
    else popNum(at,"mmm — they smell lovely","spell");}}
ACTS.push({pos:USE_ACT.pos,r:1.5,hidden:()=>!USE_ACT.q||P.inCar||!!P.sitting||!!P.climbing,label:()=>USE_ACT.q?useLabel(USE_ACT.q):"",run:()=>{if(USE_ACT.q)useThing(USE_ACT.q);}});
ACTS.push({get pos(){return P.pos;},r:5,hidden:()=>!P.sitting,label:"Stand up",run:standUp});
const nearMyChest=()=>PLACED.mine.some(q=>(q.item.id==="chest"||fnOf(q.item)==="storage")&&Math.hypot(q.x-P.pos.x,q.z-P.pos.z)<3);
function stepPlaced(){let best=null,bd=1.6;const fr=q=>({x:q.x-Math.sin(q.r)*.9,z:q.z-Math.cos(q.r)*.9}),fu=q=>({x:q.x+Math.sin(q.r)*.9,z:q.z+Math.cos(q.r)*.9});
  for(const q of PLACED.mine){const b=fr(q),d=Math.hypot(b.x-P.pos.x,b.z-P.pos.z);if(d<bd){bd=d;best=q;}}PLACE_ACT.q=best;if(best){const b=fr(best);PLACE_ACT.pos.set(b.x,0,b.z);}
  let ub=null,ud=1.5;for(const q of [...PLACED.mine,...Object.values(PLACED.remote).map(g=>g.userData.q)]){if(!q||!useKind(q))continue;const f=fu(q),d=Math.hypot(f.x-P.pos.x,f.z-P.pos.z);if(d<ud){ud=d;ub=q;}}
  USE_ACT.q=ub;if(ub){const f=fu(ub);USE_ACT.pos.set(f.x,0,f.z);}
  if(P.sleeping&&P.sleeping.spot)P.pos.set(P.sleeping.spot.x,P.sleeping.spot.y,P.sleeping.spot.z);
  if(P.sitting){P.pos.copy(P.sitting.pos);P.vel.set(0,0,0);P.yaw=P.sitting.yaw;}
  if(MP.ok&&PLACED.room!==MP.room){PLACED.room=MP.room;PLACED.mine.forEach(q=>placedShare(q));}}
// the castle's soldiers guard the moat (Barbara: "the river close to the castle is safe — if monsters attack, let soldiers kill them"):
// out by the moat (between the walls and the far bank), a monster coming near you brings the soldiers out by themselves.
const inMoatZone=p=>p.x>=MOAT.x0-2&&p.x<=MOAT.x1+2&&p.z>=MOAT.z0-2&&p.z<=MOAT.z1+2&&!inTown(p);
HORN.auto=0;
function stepCastleGuard(dt){HORN.auto=Math.max(0,HORN.auto-dt);if(HORN.auto>0||P.down||!started||!inMoatZone(P.pos))return;
  const m=ENEMIES.find(d=>!d.down&&d.g.position.distanceTo(P.pos)<24);if(!m)return;HORN.auto=35;hornSound();callSoldiers(P.pos.clone(),false);share({k:"horn",x:R2(P.pos.x),z:R2(P.pos.z)});
  lawSay(`🛡️ ${m.name}s near the castle! The soldiers come out to protect you.`);}

// ---------------- magical things and inventions (2026-11-24, Barbara: "magical things like auto collect and computers… you make anything you want
// and the game turns it into something that does a thing"). What a thing does is in BUILD.FNS; it works for everyone in the room: each player's
// own game applies what's near them (healing, speed, bouncing, portals, light); the owner's game does the lightning and the collecting.
const INVCD={};let INV_LIGHTS=[0,1].map(()=>{const l=new THREE.PointLight(0xffd890,0,16,1.4);scene.add(l);return l;});
const carryMagnet=()=>INV.some(it=>it&&fnOf(it)==="magnet");
const placedAll=()=>[...PLACED.mine,...Object.values(PLACED.remote).map(g=>g.userData.q)];
function qBox(q){if(!q.bb||q.bbG!==q.g){q.bbG=q.g;q.bb=new THREE.Box3().setFromObject(q.g);q.half=Math.min(q.bb.max.x-q.bb.min.x,q.bb.max.z-q.bb.min.z)/2;}return q.bb;}
const cool=(k,s)=>{if((INVCD[k]||0)>Date.now()){popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),`ready in ${Math.ceil((INVCD[k]-Date.now())/1000)} s`,"burn");return false;}INVCD[k]=Date.now()+s*1000;return true;};
const strHash=s=>{let h=7;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h;};
function tune(seed){try{const A=hornSound.ctx||(hornSound.ctx=new (window.AudioContext||window.webkitAudioContext)()),R0=seedRnd(seed),S=[262,294,330,392,440,523,587,659];let t=A.currentTime+.05,i=3;for(let k=0;k<14;k++){i=Math.max(0,Math.min(7,i+Math.floor(R0()*5)-2));const len=R0()<.3?.4:.2,o=A.createOscillator(),g=A.createGain();o.type="triangle";o.frequency.value=S[i];g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.14,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(g);g.connect(A.destination);o.start(t);o.stop(t+len+.02);t+=len;}}catch(e){}}
// what everyone sees and hears
function invFx(ev,mine){const a=V3(ev.a||[0,0,0]);if(a.distanceTo(P.pos)>80)return;
  if(ev.f==="music"){tune(ev.s|0);for(let k=0;k<7;k++)setTimeout(()=>{const s=iconSprite(k%2?"🎵":"🎶");s.scale.setScalar(.4);s.position.copy(a).add(new THREE.Vector3(rnd(-.6,.6),1.2,rnd(-.6,.6)));scene.add(s);tween(1.4,t=>{s.position.y+=.012;s.material.opacity=1-t;},()=>scene.remove(s));},k*450);}
  else if(ev.f==="firework"){for(let k=0;k<5;k++)setTimeout(()=>{const top=a.clone().add(new THREE.Vector3(rnd(-5,5),rnd(11,17),rnd(-5,5))),col=[0xff5a7a,0xffd84a,0x5ad8ff,0x9aff6a,0xc07aff][(k+(ev.s|0))%5],m=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:col}));m.position.copy(a);scene.add(m);
      tween(.8,t=>{m.position.lerpVectors(a,top,t);SPARK.emit(m.position,rnd3(.4),C(col),.4);},()=>{scene.remove(m);flash(top,col,10,.4);for(let i=0;i<60;i++)SPARK.emit(top,rnd3(1).normalize().multiplyScalar(rnd(3,7)),C(i%3?col:0xffffff),rnd(.7,1.3),{grav:3,drag:1});});},k*420);}
  else if(ev.f==="zap"){const b=V3(ev.b);boltLine(a,b,FX.HEX.lightning);FX.stars(b,"lightning",2,.9);}
  else if(ev.f==="yum"){for(let i=0;i<14;i++)SPARK.emit(a.clone().add(new THREE.Vector3(rnd(-.4,.4),rnd(.8,1.6),rnd(-.4,.4))),new THREE.Vector3(0,rnd(.8,2),0),C(0xffd27a),.6,{grav:-1});}
  else if(ev.f==="love"){for(let k=0;k<4;k++)setTimeout(()=>{const s=iconSprite("💗");s.scale.setScalar(.32);s.position.copy(a).add(new THREE.Vector3(rnd(-.4,.4),.6,rnd(-.4,.4)));scene.add(s);tween(1.1,t=>{s.position.y+=.014;s.material.opacity=1-t;},()=>scene.remove(s));},k*180);}
  else if(ev.f==="dig")holeAt(a,!!ev.big);
  else if(ev.f==="splash"){for(let i=0;i<40;i++)SPARK.emit(a.clone().add(new THREE.Vector3(rnd(-.3,.3),1.2,rnd(-.3,.3))),new THREE.Vector3(rnd(-2,2),rnd(1,3),rnd(-2,2)),C(i%2?0x6ab8ff:0xdff1ff),.7,{grav:9});
    if(ev.u!==MP.id&&a.distanceTo(P.pos)<2.2)lawSay("💦 Splash! Someone poured water on you.");}
  else if(ev.f==="feel"){for(let k=0,n=Math.max(1,Math.min(20,ev.n|0));k<n;k++)setTimeout(()=>{const o=ev.u===MP.id?P:MP.others[ev.u]&&MP.others[ev.u].g.position?{pos:MP.others[ev.u].g.position}:null;if(!o||(k&&P.down&&ev.u===MP.id))return;const s=iconSprite(ev.b?(k%2?"💫":"🤢"):"✨");s.scale.setScalar(.34);s.position.copy(o.pos).add(new THREE.Vector3(rnd(-.35,.35),2.1,rnd(-.35,.35)));scene.add(s);tween(1.1,t=>{s.position.y+=.01;s.material.opacity=1-t;},()=>scene.remove(s));},k*1000);}
  else if(ev.f==="boom")bombFly(ev,a,mine);
  else if(ev.f==="port"){shadowPuff(a);if(ev.b)shadowPuff(V3(ev.b));}}
const invShow=ev=>{invFx(ev,true);share(Object.assign({k:"inv"},ev));};
// something you named (drugs, medicine, coffee, shoes…): taking some does what that thing does; bad things make you sick and dizzy.
// Everyone near sees it. Feeling sick never knocks you out by itself (1 HP is left). Sleeping a whole night cures it.
const CALM=!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
function feel(item,q){const e=BUILD.cleanEf(item.ef)||{hp:5},bad=BUILD.badEf(e),n=item.nm||"it",up=(k,s)=>{if(s)P[k]=Math.max(P[k]||0,s);},at=P.pos.clone().add(new THREE.Vector3(0,2.2,0));
  up("buffT",e.speed);up("slowT",e.slow);up("jumpT",e.jump);up("toughT",e.tough);up("dizzyT",e.dizzy);if(bad)up("flipT",Math.max(10,e.dizzy||0,e.slow||0));
  if(e.hp>0){P.hp=Math.min(P.maxHp,P.hp+e.hp);popNum(at,`+${e.hp} HP`,"spell");}if(e.hp<0){P.sickT=10;P.sickN=-e.hp/10;P.sickNm=n;popNum(at,"you feel sick…","burn");}
  if(/coffee|tea|soda|cola|coke|juice|milk|lemonade|smoothie|milkshake|water|drink/i.test(n))needUp("water",25);if(/coffee|tea|energy/i.test(n))needUp("sleep",15);if(/cake|pizza|apple|banana|bread|burger|cookie|candy|sandwich|fruit|soup|food|snack/i.test(n))needUp("food",25);
  hud();lawSay((e.say||(bad?`The ${n} makes you feel sick.`:`The ${n} makes you feel good.`))+(bad?" Everything feels backward!":""));invShow({f:"feel",a:V3r(P.pos),u:MP.id,b:bad?1:0,n:bad?Math.max(10,e.dizzy||0,e.slow||0):4});}
const takeSome=item=>{if(cool("take:"+(item.nm||""),15))feel(item);};
function stepFeel(dt){P.dizzyT=Math.max(0,(P.dizzyT||0)-dt);P.sickT=Math.max(0,(P.sickT||0)-dt);
  P.flipT=Math.max(0,(P.flipT||0)-dt);if(P.down)P.dizzyT=P.sickT=P.flipT=0;
  if(P.sickT>0&&!P.down&&!P.sleeping&&!(LAW.jailT>0)){P.hp=Math.max(0,P.hp-P.sickN*dt);   // it doesn't stop at 1: bad things can knock you down (Barbara, 2026-11-25)
    if(P.hp<.5){fallDown(`The ${P.sickNm||"bad thing"} made you too sick.`);return;}P.sickV=(P.sickV||0)+dt;if(P.sickV>=1){P.sickV=0;popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),`-${Math.round(P.sickN)||1}`,"burn");hud();}}
  if(P.dizzyT>0){const k=Math.min(1,P.dizzyT/2);if(!P.sitting&&!P.sleeping&&!CALM)look.yaw+=Math.sin(tAcc*1.9)*.55*k*dt;canvas.style.filter=`blur(${(1.6*k).toFixed(2)}px) saturate(.6)${CALM?"":` hue-rotate(${Math.round(Math.sin(tAcc*1.1)*45*k)}deg)`}`;P.dizzyOn=true;}
  else if(P.dizzyOn){P.dizzyOn=false;canvas.style.filter="";}}
// a bomb: thrown where you aim (or set off where it stands, after two seconds); everyone sees it fly and blow up, only the one who set it off does the harm
function throwBomb(it){const r=aimRay(0),h=firstHit(r),to=h&&h.distance<16?h.point.clone():r.ray.at(13,new THREE.Vector3());to.y=Math.max(.3,h&&h.distance<16?to.y:P.pos.y+.3);const p=compactParts(it.parts),ev={f:"boom",a:[R2(P.pos.x),R2(P.pos.y+1.4),R2(P.pos.z)],b:V3r(to)};if(p.length&&JSON.stringify(p).length<6000)ev.p=p;invShow(ev);}
function bombFly(ev,a,mine){const to=V3(ev.b||ev.a),flies=a.distanceTo(to)>.5;let g=null;
  if(flies){const parts=Array.isArray(ev.p)?ev.p.filter(p=>p&&typeof p==="object").slice(0,120):null;try{g=placedMesh({id:"invention",fn:"bomb",parts});}catch(e){g=iconSprite("💣");}const bb=new THREE.Box3().setFromObject(g),L=Math.max(...bb.getSize(new THREE.Vector3()).toArray())||1;g.scale.multiplyScalar(Math.min(1,.7/L));scene.add(g);}
  const blow=()=>{if(g)scene.remove(g);explode(to,"fire",{r:4.5,dmg:70,c:mine?PLAYER_C():{ghost:true}});if(mine&&!P.down&&P.pos.distanceTo(to)<3.5)hurt(20);};
  tween(flies?1:2,t=>{if(g){g.position.lerpVectors(a,to,t);g.position.y+=Math.sin(t*Math.PI)*2;g.rotation.x+=.15;}if(Math.random()<.5)SPARK.emit(g?g.position.clone():to,rnd3(1),C(0xffb04a),.4);},blow);}
// putting something into food (Barbara, 2026-11-25: "you can put poison and drugs into someone's food and then if they eat it they get the same effects").
// Hold a thing you take (drugs, poison, medicine…) and choose a food in your bag, or a cup, bowl, plate, fountain set down near you (yours or
// someone else's): whoever eats or drinks it next feels what that thing does. It looks the same from the outside. Shared with the room.
const GASCAN=40;
function spikeOf(x){const s=x&&x.sp;if(!s||typeof s!=="object")return null;const ef=BUILD.cleanEf(s.ef);return ef?{ef,nm:String(s.nm||"something").slice(0,28)}:null;}
function spikedEat(x){const s=spikeOf(x);if(!s)return;setTimeout(()=>{if(P.down)return;feel({nm:s.nm,ef:Object.assign({},s.ef,{say:`Someone put ${s.nm} in it! `+(s.ef.say||"")})});},700);}
function spikeChoices(it){const sp={ef:BUILD.cleanEf(it.ef)||{hp:5},nm:it.nm||"something"},o=[],nm=x=>(itemInfo(x)||{name:"food"}).name;
  INV.forEach(x=>{if(o.length<3&&x&&x!==it&&(x.t==="food"||fnOf(x)==="food")&&!x.sp)o.push([`🍽️ Put some in your ${nm(x)}`,()=>{x.sp=sp;invHud();lawSay(`You put ${sp.nm} in the ${nm(x)}. Whoever eats it will feel it.`);}]);});
  let best=null,bd=3.5;for(const q of placedAll()){if(!q)continue;const k=useKind(q),f=fnOf(q.item);if(!(k==="eat"||k==="drink"||f==="water"))continue;const d=Math.hypot(q.x-P.pos.x,q.z-P.pos.z);if(d<bd){bd=d;best=q;}}
  if(best){const q=best,n=(BUILD.ITEMS[q.item.id]||{name:"cup"}).name;o.push([`🍽️ Put some in the ${q.item.nm||n} here`,()=>{q.item.sp=sp;if(q.remote){q.val=Object.assign({},q.val,{sp});if(MP.ok)setKey("pl:"+q.pid,q.val);}else{placedShare(q);placedSave();}lawSay(`You put ${sp.nm} in the ${q.item.nm||n}. Whoever eats or drinks from it next will feel it.`);}]);}
  return o;}
// ---------------- daily needs (2026-11-26, Barbara: "add daily needs of water and a hunger bar, and if they don't get satisfied you start getting bad effects,
// and they last until you put it back up to satisfaction; if you don't sleep you get too tired, and then your character gets slower and the keyboard
// responds slower, and there is also a bar"). Three bars under the health bar: 🍗 food, 💧 water, 😴 sleep. They go down by themselves (water empties
// in about 10 minutes, food in 15, sleep in 20 awake — faster when you run). Below 20 the bad effects start, and they stay until that bar is back
// above 60: hungry = slower and losing health; thirsty = slower and losing health faster; tired = much slower and every key answers late (0.35 s).
// Fill them: eat (food, bowls, plates, snacks), drink (cups, buckets, fountains, the river — press T by the water, or a bucket you carry), sleep in a bed.
// Others in the room see 🍗 / 💧 / 💤 above you while it lasts. Kept on this device.
var NEEDS={food:100,water:100,sleep:100,bad:{food:false,water:false,sleep:false},hurtT:0,saveT:0,lag:[],jumpAt:0};
try{const v=JSON.parse(localStorage.getItem("elementum.needs")||"null");if(v)["food","water","sleep"].forEach(k=>{if(typeof v[k]==="number")NEEDS[k]=Math.max(0,Math.min(100,v[k]));});}catch(e){}
const NEED_MIN={food:15,water:10,sleep:20},NEED_TXT={food:["🍗 You're starving! Eat something — you'll feel weak until you've eaten enough.","🍗 That's better — you're full."],
  water:["💧 You're very thirsty! Drink something — find a cup, a fountain or the river.","💧 Ahh, that's better — no longer thirsty."],sleep:["😴 You're too tired! Everything feels slow. Go to bed and sleep.","😴 You feel rested again."]};
function needUp(k,n){NEEDS[k]=Math.min(100,NEEDS[k]+n);needsCheck();needsHud();}
function needsCheck(){for(const k of ["food","water","sleep"]){const v=NEEDS[k],b=NEEDS.bad[k];if(!b&&v<20){NEEDS.bad[k]=true;lawSay(NEED_TXT[k][0]);}else if(b&&v>=60){NEEDS.bad[k]=false;lawSay(NEED_TXT[k][1]);}}}
function needsHud(){[["food","#ndFood"],["water","#ndWater"],["sleep","#ndSleep"]].forEach(([k,id])=>{const el=$(id);if(!el)return;el.querySelector("b").style.width=Math.round(NEEDS[k])+"%";el.classList.toggle("bad",NEEDS.bad[k]);el.title=`${{food:"Food",water:"Water",sleep:"Sleep"}[k]} ${Math.round(NEEDS[k])}%`;});}
function stepNeeds(dt){if(!NEEDS||!started||P.down)return;const run=P.run&&!P.inCar?1.5:1,slp=P.sleeping?.5:1;
  NEEDS.water=Math.max(0,NEEDS.water-100/NEED_MIN.water/60*dt*run*slp);NEEDS.food=Math.max(0,NEEDS.food-100/NEED_MIN.food/60*dt*run*slp);if(!P.sleeping)NEEDS.sleep=Math.max(0,NEEDS.sleep-100/NEED_MIN.sleep/60*dt*run);
  needsCheck();NEEDS.hurtT-=dt;if(NEEDS.hurtT<=0){NEEDS.hurtT=1;if(!P.sleeping&&!(LAW.jailT>0)){const n=(NEEDS.bad.food?.4:0)+(NEEDS.bad.water?.6:0);if(n>0){P.hp=Math.max(0,P.hp-n);hud();if(P.hp<.5)fallDown(NEEDS.bad.water?"You were too thirsty.":"You were too hungry.");}}needsHud();}
  NEEDS.saveT-=dt;if(NEEDS.saveT<=0){NEEDS.saveT=5;try{localStorage.setItem("elementum.needs",JSON.stringify({food:+NEEDS.food.toFixed(1),water:+NEEDS.water.toFixed(1),sleep:+NEEDS.sleep.toFixed(1)}));}catch(e){}}
  if(NEEDS.bad.sleep&&Math.random()<dt*.08)popNum(P.pos.clone().add(new THREE.Vector3(0,2.3,0)),"*yawn*","burn");}
function needsSpeed(){if(!NEEDS)return 1;return (NEEDS.bad.sleep?.6:1)*(NEEDS.bad.food?.85:1)*(NEEDS.bad.water?.85:1);}   // NEEDS is a var: the game starts running before this part of the file has loaded
// tired: the keys answer late — what you pressed 0.35 s ago is what happens now (jumping too)
function needsInput(inp){if(!NEEDS||!NEEDS.bad.sleep){if(NEEDS)NEEDS.lag.length=0;return inp;}const now=performance.now();NEEDS.lag.push([now,inp]);
  if(jumpQ){NEEDS.jumpAt=now+350;jumpQ=false;}if(NEEDS.jumpAt&&now>=NEEDS.jumpAt){NEEDS.jumpAt=0;jumpQ=true;}
  const L=NEEDS.lag;while(L.length>1&&L[1][0]<=now-350)L.shift();return L[0][0]<=now-350?L[0][1]:{x:0,z:0,l:0};}
function floatIcon(pos,em){const s=iconSprite(em);s.scale.setScalar(.45);s.position.copy(pos).add(new THREE.Vector3(rnd(-.3,.3),2.3,rnd(-.3,.3)));s.material.transparent=true;scene.add(s);tween(1.4,t=>{s.position.y+=.01;s.material.opacity=1-t;},()=>scene.remove(s));}
// drink straight from the river, the lake or the moat (T by the water)
const RIVER_ACT={pos:new THREE.Vector3(),on:false};
ACTS.push({pos:RIVER_ACT.pos,r:1.5,hidden:()=>!RIVER_ACT.on||P.inCar||P.down,label:"💧 Drink from the water",run:()=>{needUp("water",40);P.hp=Math.min(P.maxHp,P.hp+5);hud();popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"gulp gulp — fresh water!","spell");
  for(let i=0;i<10;i++)SPARK.emit(P.pos.clone().add(new THREE.Vector3(rnd(-.4,.4),.4,rnd(-.4,.4))),new THREE.Vector3(0,rnd(.5,1.5),0),C(0x6ab8ff),.6,{grav:3});}});
needsHud();
setInterval(()=>{if(!started)return;RIVER_ACT.on=!P.inCar&&P.pos.y<1.5&&nearWater();RIVER_ACT.pos.copy(P.pos);},300);
// ---------------- the shovel, water and monsters at night (2026-11-26, Barbara: "you can use a shovel to make a hole and escape from prison, and also
// you can carry water from the river, and monsters only come out at night").
// Shovel (Mercator sells one, or make one at the workbench and name it): click to dig a hole. In the Carcer you dig a tunnel (8 s) and come up
// outside the wall — but the guards find the hole 15 s later and come after you. Everyone in the room sees the holes.
const HOLES=[];
function holeAt(p,big){const m=new THREE.Mesh(new THREE.CircleGeometry(big?.75:.5,18),new THREE.MeshBasicMaterial({color:0x2a1c10}));m.rotation.x=-Math.PI/2;m.position.set(p.x,(p.y||0)+.035,p.z);scene.add(m);
  const rim=new THREE.Mesh(new THREE.RingGeometry(big?.75:.5,big?1:.7,18),LOOK.toon(0x6b4a2a));rim.rotation.x=-Math.PI/2;rim.position.set(p.x,(p.y||0)+.03,p.z);scene.add(rim);
  for(let i=0;i<12;i++)PUFF.emit(new THREE.Vector3(p.x+rnd(-.4,.4),(p.y||0)+.3,p.z+rnd(-.4,.4)),new THREE.Vector3(rnd(-1,1),rnd(1,2.5),rnd(-1,1)),C(0x8a6a44),.8,{grav:4});
  HOLES.push([m,rim]);setTimeout(()=>{scene.remove(m);scene.remove(rim);},120000);}
const JAIL_HOLE=()=>new THREE.Vector3(JAIL.x+JAIL.w/2+2.2,0,JAIL.z);
function dig(){if(DIG.on||P.down||P.inCar)return;const at=P.pos.clone().add(new THREE.Vector3(-Math.sin(P.yaw)*.8,0,-Math.cos(P.yaw)*.8));at.y=P.pos.y;
  if(isWater(at.x,at.z,false)){lawSay("You can't dig in water.");return;}
  if(LAW.jailT>0){DIG.on=true;lawSay("🪏 You start digging a tunnel under the wall…");let n=0;const t=setInterval(()=>{if(!started||P.down||LAW.jailT<=0){clearInterval(t);DIG.on=false;return;}n++;
      for(let i=0;i<6;i++)PUFF.emit(P.pos.clone().add(new THREE.Vector3(rnd(-.5,.5),.3,rnd(-.5,.5))),new THREE.Vector3(rnd(-1,1),rnd(1,2),rnd(-1,1)),C(0x8a6a44),.7,{grav:4});
      if(n<8){lawSay(`🪏 Digging… ${8-n} s`);return;}clearInterval(t);DIG.on=false;
      const a=P.pos.clone(),b=JAIL_HOLE();invShow({f:"dig",a:V3r(a),big:1});invShow({f:"dig",a:V3r(b),big:1});LAW.jailT=0;P.pos.copy(b).add(new THREE.Vector3(1.2,0,0));P.vel.set(0,0,0);hud();
      lawSay("🕳️ You dug your way out of the Carcer! Run — the guards will find the hole soon.");
      setTimeout(()=>{if(!LAW.wanted&&LAW.jailT<=0)crime("You escaped from the Carcer!");},15000);},1000);return;}
  if(!cool("dig",3))return;invShow({f:"dig",a:V3r(at)});
  const r=Math.random();if(r<.15){const n=ri(1,3);addItem({t:"coin",n});lawSay(`🪏 You dig a hole… and find ${n} ${n>1?"denarii":"denarius"}!`);}else if(r<.3){addItem({t:"mat",id:"lignum",n:1})?lawSay("🪏 You dig up an old root (wood)."):0;}else lawSay("🪏 You dig a hole. Nothing but dirt.");}
const DIG={on:false};
// water: hold a bucket, cup, bowl or vase and click by the river, the lake or the moat to fill it; drink from it anywhere, pour it out, or set it down full
const HOLDW={bucket:5,cup:1,bowl:2,vase:2};
const nearWater=()=>{for(let r=0;r<=3;r+=1)for(let a=0;a<6.3;a+=.8){const x=P.pos.x+Math.cos(a)*r,z=P.pos.z+Math.sin(a)*r;if(isWater(x,z,false))return true;}return false;};
function waterUse(it){const cap=HOLDW[it.id],w=it.water|0,o=[],nm=itemInfo(it).name.split(" — ")[0],at=P.pos.clone().add(new THREE.Vector3(0,2.2,0));
  if(nearWater()&&w<cap)o.push([`💧 Fill it with water`,()=>{it.water=cap;invHud();hud();popNum(at,"full of water","spell");for(let i=0;i<10;i++)SPARK.emit(P.pos.clone().add(new THREE.Vector3(rnd(-.4,.4),.6,rnd(-.4,.4))),new THREE.Vector3(0,rnd(.5,1.5),0),C(0x6ab8ff),.6,{grav:3});}]);
  if(w>0){o.push(["🥤 Drink some (+15 HP)",()=>{if(P.hp>=P.maxHp&&NEEDS.water>=95){lawSay("You're not thirsty right now.");return;}it.water--;if(!it.water)it.water=undefined;needUp("water",30);P.hp=Math.min(P.maxHp,P.hp+15);hud();invHud();popNum(at,"+15 HP — fresh water!","spell");}]);
    o.push(["💦 Pour it out",()=>{const p=P.pos.clone().add(new THREE.Vector3(-Math.sin(P.yaw)*1.2,0,-Math.cos(P.yaw)*1.2));it.water=undefined;invHud();hud();invShow({f:"splash",a:V3r(p),u:MP.id});}]);}
  ask(`${nm}: ${w?`💧 ${w} of ${cap} full`:"empty"}${o.length?"":" — take it to the river, the lake or the moat to fill it with water"}`,[...o,["Set it down",()=>placeThing(SEL)],["Cancel",null]]);}
// monsters sleep in their dens by day and come out when night falls (7 pm – 7 am game time); the clock is the same for everyone, so every player
// sees the same thing. A sleeping monster is out of the world (hidden, can't fight or be hit); at nightfall it rises where it lives, at full health.
const MOBNIGHT={was:null};
function stepNightMobs(){const night=isNight();if(MOBNIGHT.was!==null&&MOBNIGHT.was!==night&&started&&!inTown(P.pos))lawSay(night?"🌙 Night falls — the monsters are coming out!":"☀️ Morning — the monsters go back to their dens.");MOBNIGHT.was=night;
  for(const d of ENEMIES){if(!night){if(!d.asleep&&!d.down){d.asleep=true;d.down=true;d.hunting=false;const p=d.g.position.clone();for(let i=0;i<8;i++)PUFF.emit(p.clone().add(new THREE.Vector3(rnd(-.5,.5),rnd(.2,1.4),rnd(-.5,.5))),rnd3(.8),C(0x55504a).multiplyScalar(.5),.8,{drag:2});d.g.visible=false;}}
    else if(d.asleep){d.asleep=false;d.down=false;d.hp=d.max;d.g.position.copy(d.home);d.g.visible=true;d.g.scale.setScalar(.01);tween(.8,t=>d.g.scale.setScalar(Math.max(.01,t)));}}}
// used from the hand
function inventUse(it){const f=fnOf(it),at=P.pos.clone().add(new THREE.Vector3(0,1,0));if(P.inCar&&f!=="wand")return;
  if(f==="wand"){if(!cool("wand",2.5))return;const ids=Object.keys(SPELLS).filter(k=>SPELLS[k].kind==="bolt"),id=ids[strHash(it.nm||"")%ids.length];G.spellCool=0;castSpell(id);return;}
  if(f==="sword"){punch(5);return;}
  if(f==="take"||f==="bomb"){ask(itemInfo(it).name,[f==="take"?[`${BUILD.badEf(it.ef)?"🤢":"✨"} Take some`,()=>takeSome(it)]:["💣 Throw it",()=>{if(cool("bomb",10))throwBomb(it);}],...(f==="take"?spikeChoices(it):[]),["Set it down",()=>placeThing(SEL)],["Cancel",null]]);return;}
  if(f==="shovel"){dig();return;}
  if(f==="fuel"){const g=Math.round(it.gas||0),pump=GAS.pumps.some(v=>Math.hypot(v.x-P.pos.x,v.z-P.pos.z)<5),c=CARS.find(c=>!c.boat&&c.max<Infinity&&!(c.taken&&c.taken!==MP.id)&&c.g.position.distanceTo(P.pos)<4.5),cost=Math.ceil((GASCAN-g)/GAS.price),o=[];
    if(pump&&g<GASCAN)o.push([`⛽ Fill it up (${cost} denarii)`,()=>{if(COINS<cost)return lawSay(`Filling it costs ${cost} — you have ${COINS}.`);COINS-=cost;coinHud();it.gas=GASCAN;invHud();lawSay("⛽ Your gas can is full.");}]);
    if(c&&g>0)o.push(["🚗 Pour it into the car",()=>{const n=Math.min(g,c.max-c.fuel);if(n<=0)return lawSay("That car's tank is already full.");c.fuel+=n;it.gas=g-n;c.outT=0;invHud();carShareState(c,false);lawSay(`⛽ You poured ${Math.round(n)} into the tank. ${it.gas>0?`${Math.round(it.gas)} left in the can.`:"The can is empty."}`);}]);
    ask(`${itemInfo(it).name}: ${g?`${g} of ${GASCAN} full`:"empty"}${o.length?"":pump?"":" — fill it at the gas station outside the east gate, then stand next to a car"}`,[...o,["Set it down",()=>placeThing(SEL)],["Cancel",null]]);return;}
  if(f==="food"){ask(itemInfo(it).name,[["😋 Eat it",()=>{const i=INV.indexOf(it);if(i<0)return;if(P.hp>=P.maxHp&&NEEDS.food>=95){lawSay("You're full — save it for later.");return;}P.hp=Math.min(P.maxHp,P.hp+30);hud();INV[i]=null;select(SEL);invHud();spikedEat(it);needUp("food",40);popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"+30 HP — yum!","spell");invShow({f:"yum",a:V3r(P.pos)});}],["Set it down",()=>placeThing(SEL)],["Cancel",null]]);return;}
  if(f==="fly"){if(!cool("fly",14))return;P.flyT=6;P.softLand=1;P.vel.y=7;P.onGround=false;FX.stars(at,"air",4,1.4);return;}
  const go={music:()=>invShow({f:"music",a:V3r(P.pos),s:strHash(it.nm||it.id)%9999}),firework:()=>invShow({f:"firework",a:V3r(P.pos),s:ri(0,99)}),guard:()=>blowHorn()}[f];if(!go)return;
  ask(itemInfo(it).name,[[`${BUILD.FNS[f].icon} Use it`,()=>{if(f==="guard"||cool(f,8))go();}],["Set it down",()=>placeThing(SEL)],["Cancel",null]]);}
// used where it stands (T)
function fnUse(q){const f=fnOf(q.item),p=[R2(q.x),R2((q.y||0)+.6),R2(q.z)];const tell=()=>{if(q.remote){if(MP.ok)setKey("pl:"+q.pid,Object.assign({},q.val,{e:q.useT||0}));}else{placedShare(q);placedSave();}};
  if(f==="take")return takeSome(q.item);
  if(f==="bomb"){if(cool("bomb",10))invShow({f:"boom",a:p,b:p});return;}
  if(f==="pet"){if(cool("pet",1.5))invShow({f:"love",a:p});return;}
  if(f==="music"){if(cool("music",8))invShow({f:"music",a:p,s:strHash(q.item.nm||q.pid)%9999});return;}if(f==="firework"){if(cool("firework",8))invShow({f:"firework",a:p,s:ri(0,99)});return;}if(f==="guard")return blowHorn();
  if(f==="computer")return uiOpen(o=>DESIGN.openLibrary(Object.assign(o,{computer:true})));if(f==="storage"){toggleBag(true,"chest");return;}
  if((q.useT||0)>Date.now()){popNum(V3(p),`ready in ${Math.ceil((q.useT-Date.now())/1000)} s`,"burn");return;}
  if(f==="water"){q.useT=Date.now()+15000;const sp=q.item.sp;if(sp){q.item.sp=undefined;if(q.val)q.val=Object.assign({},q.val,{sp:undefined});spikedEat({sp});}tell();needUp("water",35);P.hp=Math.min(P.maxHp,P.hp+15);hud();popNum(V3(p),"+15 HP","spell");return;}
  if(f==="maker"){const ids=Object.keys(MAT).filter(k=>MAT[k].sell!==0),it={t:"mat",id:pick(["lignum","lignum","ferrum","ferrum",...ids]),n:1};if(!canAdd(it)){lawSay("Your bag is full.");return;}q.useT=Date.now()+60000;tell();addItem(it);const fi=itemInfo(it);popNum(V3(p).add(new THREE.Vector3(0,1,0)),`+1 ${fi.name}`,"spell",fi.pic);return;}}
// a pet trots after whoever made it and hops as it goes; far behind (or after a portal) it catches up at once; its owner gone, it waits where it is
function stepPet(q,dt){const o=q.remote?MP.others[q.val&&q.val.u]:null,to=q.remote?o&&o.g.position:P.pos;q.hop=(q.hop||0);let moving=false;
  if(to&&!(q.remote?o.po==="sleep":P.sleeping)){const dx=to.x-q.x,dz=to.z-q.z,d=Math.hypot(dx,dz),size=Math.min(2,qBox(q)?q.half:.4),near=1.5+size;
    if(d>30){q.x=to.x+1.5;q.z=to.z+1.5;q.y=to.y;}
    else if(d>near+(q.go?0:1)){q.go=true;moving=true;const sp=Math.min(d>8?11:5.2,(d-near)*3+.6)*dt;q.x+=dx/d*Math.min(sp,d);q.z+=dz/d*Math.min(sp,d);let a=Math.atan2(dx,dz)+Math.PI-q.r;a=Math.atan2(Math.sin(a),Math.cos(a));q.r+=a*Math.min(1,dt*8);}
    else q.go=false;q.y=(q.y||0)+((to.y>.3&&d<8?to.y:0)-(q.y||0))*Math.min(1,dt*6);}
  q.hop=moving?q.hop+dt*11:0;q.g.position.set(q.x,(q.y||0)+Math.abs(Math.sin(q.hop))*.22,q.z);q.g.rotation.y=q.r;q.g.rotation.z=moving?Math.sin(q.hop)*.08:0;
  if(!q.remote){q.sv=(q.sv||0)+(moving?dt:0);if(q.sv>6){q.sv=0;placedSave();placedShare(q);}}}
// what's set down works by itself
function stepInvent(dt){stepFeel(dt);stepNeeds(dt);P.portT=Math.max(0,(P.portT||0)-dt);
  if(P.flyT>0){P.flyT-=dt;P.softLand=1;P.vel.y+=GRAV*dt+((P.flyT>2.5?2.6:-.6)-P.vel.y)*Math.min(1,dt*5);if(Math.random()<dt*20)PUFF.emit(P.pos.clone(),rnd3(1),C(0xdff1ff).multiplyScalar(.4),.5,{drag:2});if(P.down||P.inCar||P.climbing)P.flyT=0;}
  const lit=[];let all=null;
  for(const q of placedAll()){if(!q)continue;const f=fnOf(q.item);if(!f)continue;const dx=q.x-P.pos.x,dz=q.z-P.pos.z,d=Math.hypot(dx,dz);if(d>45&&f!=="zap"&&f!=="magnet"&&f!=="pet")continue;const bb=qBox(q),top=bb.max.y,mid=new THREE.Vector3(q.x,(bb.min.y+top)/2,q.z),dy=P.pos.y-(q.y||0);
    if(f==="pet"){stepPet(q,dt);continue;}
    if(f==="light"){lit.push([d,q,top]);continue;}
    if(f==="aura"){const e=BUILD.cleanEf(q.item.ef)||{hp:5},bad=BUILD.badEf(e),fire=/fire|flame|stove|oven|torch/i.test(q.item.nm||"");if(fire)lit.push([d,q,top]);
      if(Math.random()<dt*9)fire?SPARK.emit(new THREE.Vector3(q.x+rnd(-.2,.2),top,q.z+rnd(-.2,.2)),new THREE.Vector3(rnd(-.2,.2),rnd(.8,1.8),rnd(-.2,.2)),C(Math.random()<.5?0xff8a2a:0xffd24a),.6,{grav:-1}):PUFF.emit(mid.clone().add(rnd3(.5)),new THREE.Vector3(rnd(-.5,.5),rnd(.3,.9),rnd(-.5,.5)),C(bad?0x7aa83a:0xffe9a8).multiplyScalar(.45),1.2,{drag:1});
      if(d<5&&Math.abs(dy)<4&&!P.down&&!P.sleeping){if(e.hp>0&&P.hp<P.maxHp)P.hp=Math.min(P.maxHp,P.hp+Math.min(4,e.hp/5)*dt);if(e.hp<0&&!(LAW.jailT>0)){P.hp=Math.max(0,P.hp+Math.max(-4,e.hp/5)*dt);if(P.hp<.5){fallDown(`You stayed too close to the ${q.item.nm||"bad thing"}.`);continue;}}[["speed","buffT"],["slow","slowT"],["jump","jumpT"],["tough","toughT"]].forEach(([k,t])=>{if(e[k])P[t]=Math.max(P[t]||0,.4);});if(e.dizzy)P.dizzyT=Math.max(P.dizzyT||0,1.5);if(bad)P.flipT=Math.max(P.flipT||0,1);
        q.hudT=(q.hudT||0)-dt;if(q.hudT<=0){q.hudT=.4;hud();}if(e.say&&!(q.saidT>tAcc)){lawSay(e.say);}q.saidT=tAcc+20;}
      if(bad&&!q.remote&&e.hp<0){q.zT=(q.zT||0)-dt;if(q.zT<=0){q.zT=1;ENEMIES.forEach(m=>{if(!m.down&&Math.hypot(m.g.position.x-q.x,m.g.position.z-q.z)<5)damage(m,6,m.g.position.clone().add(new THREE.Vector3(0,1.2,0)),false,{el:"plain",area:true});});}}
      continue;}
    if(f==="heal"){if(Math.random()<dt*6)SPARK.emit(mid.clone().add(rnd3(.4)),new THREE.Vector3(0,rnd(.5,1.2),0),C(0x7dff9a),.8,{grav:-1});if(d<5&&Math.abs(dy)<4&&!P.down&&P.hp<P.maxHp){P.hp=Math.min(P.maxHp,P.hp+4*dt);q.hudT=(q.hudT||0)-dt;if(q.hudT<=0){q.hudT=.4;hud();}}}
    else if(f==="speed"){if(d<6&&Math.abs(dy)<4)P.buffT=Math.max(P.buffT,.4);if(Math.random()<dt*5)PUFF.emit(mid.clone(),rnd3(1.5),C(0xdff1ff).multiplyScalar(.4),.5,{drag:2});}
    else if(f==="bubbles"){if(Math.random()<dt*7){const s=new THREE.Mesh(new THREE.SphereGeometry(rnd(.06,.16),10,8),new THREE.MeshBasicMaterial({color:0xbfe6ff,transparent:true,opacity:.4,depthWrite:false}));s.position.set(q.x+rnd(-.2,.2),top,q.z+rnd(-.2,.2));const vx=rnd(-.5,.5),vz=rnd(-.5,.5);scene.add(s);tween(rnd(2,4),t=>{s.position.x+=vx*.016;s.position.z+=vz*.016;s.position.y+=.012;s.material.opacity=.4*(1-t);},()=>{scene.remove(s);s.geometry.dispose();s.material.dispose();});}}
    else if(f==="bounce"){if(!P.down&&!P.inCar&&P.onGround&&!P.climbing&&!P.sitting&&d<Math.max(.7,q.half+.5)&&P.pos.y>=bb.min.y-.3&&P.pos.y<=top+.3){P.vel.y=17;P.onGround=false;P.softLand=1;FX.stars(P.pos.clone(),"air",3,1);}}
    else if(f==="portal"){if(Math.random()<dt*14){const a=Math.random()*6.3;SPARK.emit(new THREE.Vector3(q.x+Math.cos(a)*.5,(q.y||0)+1.2+Math.sin(a)*.8,q.z),new THREE.Vector3(-Math.sin(a),Math.cos(a),0),C(0x9a6aff),.7);}
      if(!P.portT&&!P.down&&!P.inCar&&!P.sleeping&&!P.sitting&&d<Math.max(.75,Math.min(1.4,q.half+.5))&&Math.abs(dy)<2){const own=q.remote?q.val&&q.val.w:MYCAR.id;all=all||placedAll();const mates=all.filter(o=>o&&fnOf(o.item)==="portal"&&(o.remote?o.val&&o.val.w:MYCAR.id)===own).sort((a,b)=>a.pid<b.pid?-1:1);
        if(mates.length<2){P.portT=3;lawSay("🌀 A portal needs a partner: set down a second one to step through.");}
        else{const o=mates[(mates.findIndex(m=>m.pid===q.pid)+1)%mates.length],from=P.pos.clone(),ob=qBox(o),out=Math.max(.9,(ob.max.z-ob.min.z)/2,o.half)+.7;P.portT=2.5;P.pos.set(o.x-Math.sin(o.r)*out,o.y||0,o.z-Math.cos(o.r)*out);P.vel.set(0,0,0);P.fallTop=undefined;P.onGround=false;invShow({f:"port",a:V3r(from),b:V3r(P.pos)});}}}
    else if(f==="freeze"){if(Math.random()<dt*8)SPARK.emit(mid.clone().add(rnd3(.6)),new THREE.Vector3(0,-.4,0),C(0xa9f1ff),.8);ENEMIES.forEach(e=>{if(!e.down&&Math.hypot(e.g.position.x-q.x,e.g.position.z-q.z)<10)e.slowT=Math.max(e.slowT||0,.5);});}
    else if(f==="zap"&&!q.remote){q.zT=(q.zT||0)-dt;if(q.zT<=0){q.zT=.4;let best=null,bd=14;ENEMIES.forEach(e=>{if(e.down)return;const r=Math.hypot(e.g.position.x-q.x,e.g.position.z-q.z);if(r<bd){bd=r;best=e;}});if(best){q.zT=1.6;const to=best.g.position.clone().add(new THREE.Vector3(0,1.2,0));invShow({f:"zap",a:[R2(q.x),R2(top),R2(q.z)],b:V3r(to)});damage(best,30,to,false,{el:"lightning",chain:true});}}}
    else if(f==="magnet"&&!q.remote){for(let i=PICKUPS.length-1;i>=0;i--){const dp=PICKUPS[i];if(dp.hold||dp.magT)continue;const m=dp.g.position,r=Math.hypot(m.x-q.x,m.z-q.z);if(r>12||!(dp.it.t==="coin"||canAdd(dp.it)))continue;
        if(r>.8){m.x+=(q.x-m.x)/r*dt*7;m.z+=(q.z-m.z)/r*dt*7;continue;}
        if(dp.sid&&MP.ok){TAKING[dp.sid]=dp.it;share({k:"take",id:dp.sid});scene.remove(dp.g);PICKUPS.splice(i,1);}else if(addItem(dp.it)){const fi=itemInfo(dp.it);popNum(P.pos.clone().add(new THREE.Vector3(0,2.3,0)),`your magnet collected ${fi.name}`,"spell",fi.pic);scene.remove(dp.g);PICKUPS.splice(i,1);}}}}
  lit.sort((a,b)=>a[0]-b[0]);INV_LIGHTS.forEach((l,i)=>{const q=lit[i];if(q){l.position.set(q[1].x,q[2]+.2,q[1].z);l.intensity=isNight()?2.2:.5;}else l.intensity=0;});}

window.__world={P,ENEMIES,inArena,isNight,inTown,BLOCKS};   // what the music (music.js) listens to
window.__el={NEEDS,needUp,needsHud,stepNeeds,RIVER_ACT,HOLES,CLOCK,isNight,jail,dig,waterUse,nearWater,HOLDW,DIG,JAIL,LAW,stepNightMobs,offersNow:()=>OFFERS,feel,spikeChoices,spikedEat,GAS,stepInvent,inventUse,fnUse,fnOf,makeOwnCar,setHouseBuilt,placedAll,REMOTE_BOATS,WORLD,npcLead,climbStep,useThing,sitOn,standUp,USE_ACT,PLACE_ACT,PLACED,placeThing,inMoatZone,HORN,blowHorn,openIdeas,MOAT,isWater,onBridge,MYBOAT,makeBoat,landNear,MYCAR,REMOTE_CARS,carUse,carKeyApply,LOTS,ROOMLIFE,townAgeDays,townDay,stepTown,ordersFor,openOrders,ORDST,openBench,HOUSES,get MYHOUSE(){return MYHOUSE},bizClick,PACKS,packOwner,damage,startSleep,endSleep,ACTS,ask,get CUR_SHOP(){return CUR_SHOP},set CUR_SHOP(v){CUR_SHOP=v},CLOCK,ARENA,stormAt,inArena,CARS,enterCar,exitCar,driveCar,GAS,MKT,STOCKS,marketDay,mktQuestion,CAVE,FOREST,inCave,DAY,stepDay,BIZ,BIZ_AT,bizTry,stepBiz,JOB,jobStart,jobPay,ENEMIES,APT,ride,INTERIORS,LIBRARIAN,TEACHER,ASK,personNamed,problemSolved,CITY,CITIZENS,BUILDINGS,SPOTS,collapse,rebuild,buildingHurt,MERCHANT,COOK,dropOwn,WORLD,share,applyEv,applyKey,hitPlayer,LAW,PEOPLE,JAIL,MARKS,hurtPerson,jail,scorch,CONTEST,contestNew,contestAnswer,setBook,howToGet,canAdd,workNow,haggle,haggleBuy,haggleSell,get HAG(){return HAG},trainPlan,buildTraining,cottageState,newQuest,set QW(v){QW=v},HOUSES,TREES,VILLAGERS,QUESTS,toggleLock,setHouses,chopHit,questTurnIn,setRoom,toggleRoom,newRoom,joinRoom,drinkFortis,useAct,FOODS,CHEST,HOME,TRAIN,MP,inTraining,SPELLS,INV,addItem,select,useHeld,get SEL(){return SEL},castSpell,castAs,dropItem,PICKUPS,NODES,ENEMIES,mineHit,toggleBag,CRAFT,DRAWS,drawFor,get tray(){return tray},set tray(v){tray=v},forgeNow,get forgeMsg(){return forgeMsg},set forgeId(v){forgeId=v},get bagOpen(){return bagOpen},get RIG(){return RIG},get COINS(){return COINS},set COINS(v){COINS=v;coinHud();},sell,buy,get OFFERS(){return OFFERS},MATH,inTown,DSHOTS,P,G,look,keys,WEAPONS,DUMMIES,CRYSTALS,cycleCrystal,get started(){return started},start(){$("#startBtn").click();},jump(){jumpQ=true;},setStick(x,y){stick.x=x;stick.y=y;},fire,reload,equip,hurt,blocks:BLOCKS,scene,cam};
})();
