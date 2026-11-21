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
scene.add(new THREE.HemisphereLight(0xcfe8ff,0x6a8a4a,1.0));
const sun=new THREE.DirectionalLight(0xfff0d8,1.6);sun.position.set(18,30,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:120});scene.add(sun);
const mat=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.85,metalness:.02},o||{}));
const glow=(c,i)=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:i||1,roughness:.3});
const rnd=(a,b)=>a+Math.random()*(b-a);const rnd3=k=>new THREE.Vector3(rnd(-k,k),rnd(-k,k),rnd(-k,k));
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
const inTown=(p,m)=>{m=m||0;return p.x>TOWN.x0-m&&p.x<TOWN.x1+m&&p.z>TOWN.z0-m&&p.z<TOWN.z1+m;};
{const H=6,T=1.6,TW=3,TH=8,gz=-5;const tone=0x9e968a;
  // north and south walls, with a gate at x = 0
  [TOWN.z0,TOWN.z1].forEach(z=>{const a=TOWN.gate+TW,len=TOWN.x1-a;block(a+len/2,z,len,H,T,tone);block(-(a+len/2),z,len,H,T,tone);
    block(TOWN.gate+TW/2,z,TW,TH,TW,0x8f877c);block(-(TOWN.gate+TW/2),z,TW,TH,TW,0x8f877c);});
  // east and west walls, with a gate at z = -5
  [TOWN.x0,TOWN.x1].forEach(x=>{const a=gz-TOWN.gate-TW,b=gz+TOWN.gate+TW;block(x,(TOWN.z0+a)/2,T,H,a-TOWN.z0,tone);block(x,(b+TOWN.z1)/2,T,H,TOWN.z1-b,tone);
    block(x,gz-TOWN.gate-TW/2,TW,TH,TW,0x8f877c);block(x,gz+TOWN.gate+TW/2,TW,TH,TW,0x8f877c);});
  // an arch over each gate (looks only — you walk under it) and a sign on both sides
  const GATES=[[0,TOWN.z1,0],[0,TOWN.z0,0],[TOWN.x1,gz,1],[TOWN.x0,gz,1]];
  GATES.forEach(([x,z,side])=>{const w=TOWN.gate*2+TW*2;const arch=LOOK.blockMesh(side?TW:w,1.2,side?w:TW,0x8f877c);arch.position.set(x,TH-.6,z);arch.castShadow=true;scene.add(arch);
    const out=side?new THREE.Vector3(Math.sign(x),0,0):new THREE.Vector3(0,0,Math.sign(z));
    [[1,"⚔️ The wilds — monsters ahead",0xffb08a],[-1,"🏰 Oppidum — safe inside these walls",0x9dffb0]].forEach(([k,t,hex])=>{const s=label(t,hex);s.scale.set(5.2,.95,1);s.position.set(x,TH+.9,z).addScaledVector(out,k*1.8);scene.add(s);});});
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
LOOK.loadRig("/play/elementum/models/hero.glb",true,r=>{if(!r)return;RIG=r;LOOK.heroHair(r);r.root.scale.setScalar(1.05);r.root.rotation.y=Math.PI;body.add(r.root);hips.visible=false;
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
  if(w.projectile){const r=aimRay(0);const hit=firstHit(r);const to=hit?hit.point:r.ray.at(w.range,new THREE.Vector3());bolt(m,to.clone().sub(m).normalize(),el,{size:w.boltSize,speed:w.boltSpeed,r:w.r,dmg:w.dmg,power:w.power});hud();return;}
  const n=w.pellets||1;for(let i=0;i<n;i++){const r=aimRay(w.spread);const hit=firstHit(r);const to=hit?hit.point:r.ray.at(w.range,new THREE.Vector3());tracer(m,to,hex);
    if(hit){const dm=hit.object.userData.dummy,nd=hit.object.userData.node,tr=hit.object.userData.tree,pp=hit.object.userData.person;const wn=()=>hit.face?hit.face.normal.clone().transformDirection(hit.object.matrixWorld):null;
      if(pp){dent(hit.point,to.clone().sub(m).normalize().negate(),pp.o.g);hurtPerson(pp,Math.round(w.dmg*.6),hit.point);continue;}
      if(hit.object.userData.player){hitPlayer(hit.object.userData.player,Math.round(w.dmg*.5*(w.pellets?1:1)),hit.point);continue;}
      if(nd){dent(hit.point,wn(),nd.g);mineHit(nd,w.dmg,hit.point);continue;}if(tr){dent(hit.point,wn(),tr.g);chopHit(tr,w.dmg,hit.point);continue;}if(dm){const headshot=hit.object.userData.part==="head";if(w.weak&&dm.enemy){damage(dm,1,hit.point,false,{el});if(tAcc-(G.weakTip||-9)>4){G.weakTip=tAcc;popNum(hit.point.clone().add(new THREE.Vector3(0,.8,0)),"too tough for the Magna Rifle — craft a weapon or cast spells","burn");}}
      else damage(dm,Math.round(w.dmg*(headshot?w.head:1)),hit.point,headshot,{el});}
      else{const nn=hit.face?hit.face.normal.clone().transformDirection(hit.object.matrixWorld):null;if(nn&&hit.object.userData.block){if(hit.object.material.visible)wallHit(hit.object.userData.block,hit.point,nn,w.pellets?.4:1);else dent(hit.point,nn);}
        if(hit.object===ground)mark(hit.point,new THREE.Vector3(0,1,0),rnd(.12,.2),el==="ice"?0xd8f2ff:0x15110c,.7);
        sparks(hit.point,8,hex,nn);FX.impact(hit.point,el,.45);if(i===0)FX.stars(hit.point,el,1,.5);}}}
  hud();}
// the staff fires a slow glowing bolt that explodes where it lands
const BOLTS=[];
function bolt(from,dir,el,o){o=o||{};const g=FX.comet(el||"lightning",o.size||1.5);g.position.copy(from);g.userData.aim(dir);scene.add(g);
  BOLTS.push({g,v:dir.clone().multiplyScalar(o.speed||26),life:o.life||3,el:el||"lightning",r:o.r,dmg:o.dmg,power:o.power,c:o.c||null,grav:o.grav||0,slow:o.slow,orb:o.orb||null,zap:0});}
function explode(p,el,o){o=o||{};const R=o.r||3.2,DM=o.dmg||WEAPONS.staff.dmg;const hex=FX.HEX[el];ring(p,hex,6*R/3.2);FX.impact(p,el,R);FX.stars(p,el,4,2.2);flash(p,hex,8,.35);shake(.12);
  for(let i=0;i<60;i++)SPARK.emit(p,rnd3(1).normalize().multiplyScalar(rnd(3,9)),Math.random()<.5?C(hex):C(0xffffff),rnd(.3,.7),{grav:6,drag:1.2});for(let i=0;i<10;i++)PUFF.emit(p,rnd3(1.5),C(hex).multiplyScalar(.5),.5,{drag:2});
  scorch(p,R*.7,el);hitArea(o.c||PLAYER_C(),p,R,DM,el,{falloff:true,slow:o.slow});}
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
    if(!hit&&!b.orb){if(enemy){if(!P.down&&!inTown(P.pos)&&near(P.pos.clone().add(new THREE.Vector3(0,1,0)))<.9)hit=true;}
      else for(const d of DUMMIES){if(!d.down&&near(d.g.position.clone().add(new THREE.Vector3(0,1.3,0)))<.8){hit=true;break;}}}
    if(!hit){const n=Math.max(1,Math.ceil(p0.distanceTo(p)/.25));for(let k=1;k<=n;k++){const q=p0.clone().lerp(p,k/n);const bl=blockAt(q);if(bl){p.copy(q);hit=true;wallHit(bl,q,faceNormal(bl,q),b.power||3);break;}}}   // walk the stretch so a fast bolt can't skip through a thin wall
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
function wallHit(b,p0,n0,power){if(!b||!b.mesh.material.visible)return;{const bi=BLOCKS.indexOf(b);if(bi>=0&&bi<WORLD.STATIC)share({k:"wall",b:bi,p:[R2(p0.x),R2(p0.y),R2(p0.z)],n:[R2(n0.x),R2(n0.y),R2(n0.z)],pw:power});}const n=axisN(n0);const keep=o=>{(b.fx||(b.fx=[])).push(o);return o;};
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
function label(text,hex){const c=document.createElement("canvas");c.width=512;c.height=96;const x=c.getContext("2d");x.font="700 44px system-ui,sans-serif";x.textAlign="center";x.textBaseline="middle";
  x.lineWidth=8;x.strokeStyle="rgba(0,0,0,.6)";x.strokeText(text,256,48);x.fillStyle="#"+new THREE.Color(hex).lerp(new THREE.Color(0xffffff),.45).getHexString();x.fillText(text,256,48);
  const t=new THREE.CanvasTexture(c);if("colorSpace" in t)t.colorSpace=THREE.SRGBColorSpace;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false,transparent:true}));sp.scale.set(2.4,.45,1);return sp;}
const fwdFlat=()=>new THREE.Vector3(-Math.sin(P.yaw),0,-Math.cos(P.yaw));
function aimPoint(far){const r=aimRay(0);r.far=far;const h=firstHit(r);if(h)return {p:h.point.clone(),hit:h};const p=r.ray.at(far,new THREE.Vector3());
  if(r.ray.direction.y<-.01){const t=-r.ray.origin.y/r.ray.direction.y;if(t>0&&t<far)p.copy(r.ray.at(t,new THREE.Vector3()));}return {p,hit:null};}
// who casts: the player (aims with the crosshair) or an enemy (aims at the player)
function casterOf(d){if(!d){const a=aimPoint(80);return {enemy:null,pos:P.pos.clone(),from:muzzleWorld(),aim:a.p,hit:a.hit,fwd:fwdFlat()};}
  const from=d.g.position.clone().add(new THREE.Vector3(0,1.3,0)),aim=P.pos.clone().add(new THREE.Vector3(0,1,0));const f=aim.clone().sub(from);f.y=0;f.normalize();
  return {enemy:d,pos:d.g.position.clone(),from,aim,hit:null,fwd:f};}
const PLAYER_C=()=>({enemy:null,pos:P.pos.clone(),fwd:fwdFlat()});
// everything a spell hits: an enemy's spell hits only you; yours hit dummies and monsters
function hitArea(c,p,r,dmg,el,o){o=o||{};const hits=[];
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
    const bl=blockAt(p.clone().add(new THREE.Vector3(0,-.05,0)));if(bl)wallHit(bl,p,faceNormal(bl,p),3);
    hitArea(c,p.clone().add(new THREE.Vector3(0,.3,0)),s.r,s.dmg,s.el,{falloff:s.style!=="bolt"});});}
function spike(p,hex,i){const m=LOOK.M(new THREE.ConeGeometry(.35,1.6,6),LOOK.toon(0xb59a72),.02);m.position.set(p.x,-.8,p.z);m.rotation.z=rnd(-.2,.2);scene.add(m);
  tween(.15+i*.03,t=>{m.position.y=-.8+1.4*Math.min(1,t*1.2);},()=>{setTimeout(()=>tween(.4,t=>{m.position.y=.6-1.4*t;},()=>scene.remove(m)),700);});
  for(let k=0;k<4;k++)PUFF.emit(p.clone().add(new THREE.Vector3(0,.2,0)),new THREE.Vector3(rnd(-1,1),rnd(1,2.5),rnd(-1,1)),C(0xb8a07a).multiplyScalar(.5),.6,{drag:2});}
function zapNear(c,p,r,dmg){const hex=FX.HEX.lightning;
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
  strike(c,s){const n=s.count||1;const base=c.enemy?P.pos.clone():c.aim.clone();if(!c.hit)base.y=Math.max(0,base.y);
    for(let i=0;i<n;i++){const p=base.clone();if(s.spread){const a=Math.random()*6.3,r=Math.sqrt(Math.random())*s.spread;p.x+=Math.cos(a)*r;p.z+=Math.sin(a)*r;p.y=0;}setTimeout(()=>strikeAt(c,p,s,(c.enemy?.35:0)+s.delay),i*130);}},
  nova(c,s){const p=c.pos.clone().add(new THREE.Vector3(0,.2,0));const hex=FX.HEX[s.el];groundRing(p,s.r,hex,.55);groundRing(p,s.r*.7,0xffffff,.45,.6);flash(p.clone().add(new THREE.Vector3(0,1,0)),hex,8,.35);shake(s.stun?.25:.1);
    for(let i=0;i<48;i++){const a=i/48*6.3;SPARK.emit(p,new THREE.Vector3(Math.cos(a)*rnd(6,10),rnd(.5,2),Math.sin(a)*rnd(6,10)),C(i%2?hex:0xffffff),rnd(.4,.7),{drag:2});}
    if(s.stun)for(let i=0;i<14;i++)PUFF.emit(p,new THREE.Vector3(rnd(-6,6),rnd(.5,2),rnd(-6,6)),C(0xb8a07a).multiplyScalar(.5),.8,{drag:2.5});
    hitArea(c,p.clone().add(new THREE.Vector3(0,.8,0)),s.r,s.dmg,s.el,{stun:s.stun});},
  cone(c,s){let tick=0;lasting(s.life,(dt,e)=>{const me=c.enemy&&c.enemy.g;if(c.enemy&&(c.enemy.down))return;const f=me?P.pos.clone().sub(me.position).setY(0).normalize():fwdFlat(),from=me?me.position.clone().add(new THREE.Vector3(0,1.2,0)).addScaledVector(f,.6):muzzleWorld();
      for(let k=0;k<5;k++){const v=f.clone().multiplyScalar(rnd(7,11)).add(rnd3(1.6));v.y=Math.abs(v.y)*.4;SPARK.emit(from,v,C(Math.random()<.6?0xff7b3a:0xffd27a),rnd(.4,.7),{drag:1});}
      if(Math.random()<.5)PUFF.emit(from,f.clone().multiplyScalar(rnd(4,7)),C(0xff7b3a).multiplyScalar(.4),.6,{drag:1.5});
      tick-=dt;if(tick>0)return;tick=.2;
      if(me){const v=P.pos.clone().sub(me.position);v.y=0;if(!inTown(P.pos)&&v.length()<s.range&&v.normalize().dot(f)>.78)hurt(Math.max(1,Math.round(s.dmg*EK*2)));return;}
      DUMMIES.forEach(d=>{if(d.down)return;const v=d.g.position.clone().sub(P.pos);v.y=0;const dist=v.length();if(dist<s.range&&v.normalize().dot(f)>.78)damage(d,s.dmg,d.g.position.clone().add(new THREE.Vector3(0,1.3,0)),false,{el:"fire",area:true});});});},
  zone(c,s){const p=c.enemy?P.pos.clone():c.aim.clone();p.y=Math.max(0,c.enemy?0:p.y);const hex=FX.HEX[s.el];const g=disc(p,s.r,hex,.25);let tick=0;
    lasting(s.life,(dt,e)=>{fade(g,Math.min(1,e.life-e.t));for(let k=0;k<2;k++)if(Math.random()<dt*20){const a=Math.random()*6.3,r=Math.sqrt(Math.random())*s.r;SPARK.emit(p.clone().add(new THREE.Vector3(Math.cos(a)*r,.1,Math.sin(a)*r)),new THREE.Vector3(0,rnd(.5,1.5),0),C(0xdff6ff),.7,{grav:-.5});}
      tick-=dt;if(tick<=0){tick=1;hitArea(c,p.clone().add(new THREE.Vector3(0,.6,0)),s.r,s.dmg,s.el,{slow:s.slow});}},()=>scene.remove(g));},
  aura(c,s){const hex=FX.HEX[s.el];const g=disc(P.pos,s.r,hex,.18);let tick=0;
    lasting(s.life,(dt,e)=>{g.position.set(P.pos.x,P.pos.y+.04,P.pos.z);fade(g,Math.min(1,e.life-e.t));for(let k=0;k<4;k++){const a=Math.random()*6.3,r=rnd(1,s.r);SPARK.emit(P.pos.clone().add(new THREE.Vector3(Math.cos(a)*r,rnd(.3,2.5),Math.sin(a)*r)),new THREE.Vector3(-Math.sin(a)*4,rnd(-1,.3),Math.cos(a)*4),C(0xffffff),.6,{drag:.5});}
      tick-=dt;if(tick<=0){tick=.8;hitArea(PLAYER_C(),P.pos.clone().add(new THREE.Vector3(0,.8,0)),s.r,s.dmg,s.el,{slow:s.slow});}},()=>scene.remove(g));},
  spring(c,s){const p=P.pos.clone();p.y=Math.max(0,floorUnder());const g=disc(p,s.r,FX.HEX.water,.28);let tick=0;FX.stars(p.clone().add(new THREE.Vector3(0,1,0)),"water",4,1.5);
    lasting(s.life,(dt,e)=>{fade(g,Math.min(1,e.life-e.t));for(let k=0;k<3;k++)if(Math.random()<dt*20){const a=Math.random()*6.3,r=Math.sqrt(Math.random())*s.r;SPARK.emit(p.clone().add(new THREE.Vector3(Math.cos(a)*r,.05,Math.sin(a)*r)),new THREE.Vector3(0,rnd(1.5,3),0),C(Math.random()<.5?0x4cc3ff:0xbfeaff),.7,{grav:2});}
      if(!P.down&&Math.hypot(P.pos.x-p.x,P.pos.z-p.z)<s.r&&P.hp<P.maxHp){P.hp=Math.min(P.maxHp,P.hp+s.heal*dt);hud();}
      tick-=dt;if(tick<=0){tick=1;hitArea(PLAYER_C(),p.clone().add(new THREE.Vector3(0,.8,0)),s.r,6,"water");}},()=>scene.remove(g));},
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
    if(c.enemy){if(!P.down&&!inTown(P.pos)&&segDist(c.from,end,P.pos.clone().add(new THREE.Vector3(0,1,0)))<1)hurt(Math.max(2,Math.round(s.dmg*EK)));return;}
    DUMMIES.forEach(d=>{if(d.down)return;const q=d.g.position.clone().add(new THREE.Vector3(0,1.2,0));if(segDist(c.from,end,q)<1.1)damage(d,s.dmg,q,false,{el:"light"});});},
  orb(c,s){const d=c.aim.clone().sub(c.from).normalize();bolt(c.from,d,"lightning",{speed:s.speed,size:2,r:2,dmg:s.dmg*2,power:2,c,life:s.life,orb:{r:s.zap,dmg:s.dmg}});},
  blink(c,s){if(c.enemy){const d=c.enemy;shadowPuff(d.g.position);const a=Math.random()*6.3;const to=P.pos.clone().add(new THREE.Vector3(Math.cos(a)*4,0,Math.sin(a)*4));to.y=0;
      if(!blockAt(to.clone().add(new THREE.Vector3(0,1,0)))){d.g.position.copy(to);shadowPuff(to);}return;}
    const from=P.pos.clone();const to=safeBlink(from,fwdFlat(),s.dist);if(to.distanceTo(from)<1)return false;shadowPuff(from);P.pos.copy(to);P.vel.set(0,0,0);shadowPuff(to);},
  invuln(c,s){P.invulnT=s.life;FX.stars(P.pos.clone().add(new THREE.Vector3(0,1.2,0)),"light",5,1.5);flash(P.pos.clone().add(new THREE.Vector3(0,1,0)),FX.HEX.light,6,.4);},
  // Murus Terrae: a stone wall rises 3 m ahead (side-on to where you face, snapped to the world grid); it takes dents and holes, and crumbles after 15 s
  wall(c,s){const f=fwdFlat();const sideX=Math.abs(f.x)>Math.abs(f.z);const ctr=P.pos.clone().addScaledVector(f,3);
    const w=sideX?.7:4.2,d=sideX?4.2:.7,h=2.4;if(Math.abs(ctr.x-P.pos.x)<w/2+RADIUS&&Math.abs(ctr.z-P.pos.z)<d/2+RADIUS)return false;
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
  if(KINDS[s.kind](casterOf(null),s)===false){popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"no room","burn");return false;}
  G.spellCool=.6;mpFx(id);if(RIG&&s.kind!=="leap")RIG.up(SPELL_ANIM[s.kind]||"Spellcast_Shoot",{once:true,dur:.6,restart:true,then:()=>RIG.up("2H_Ranged_Aiming")});
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
const PIC=k=>"/play/elementum/items/"+k+".webp";
const picKey=it=>it.t==="coin"?"coin":it.t==="weapon"?"weapon_"+it.id:it.t==="spell"?"scroll_"+SPELLS[it.id].el:it.t+"_"+it.id;
const img=(k,cls)=>`<img class="${cls||"ii"}" src="${PIC(k)}" alt="" draggable="false">`;
const ico=f=>f.pic?img(f.pic):f.icon,matIco=id=>img("mat_"+id,"in"),foodIco=id=>img("food_"+id,"in");
const recPic=r=>r.give?(r.give.t==="food"?"food_"+r.give.id:r.id):r.id==="potion"?"potion_sanans":r.id==="fortis"?"potion_fortis":"weapon_"+r.id;
function itemInfo(it){const f=itemInfo0(it);if(f)f.pic=picKey(it);return f;}
function itemInfo0(it){if(!it)return null;if(it.t==="coin")return {icon:"🪙",name:"Denarii",what:"coins",count:it.n};if(it.t==="weapon")return {icon:WICON[it.id]||"🔫",name:WEAPONS[it.id].name,what:WEAPONS[it.id].what||""};
  if(it.t==="spell"){const s=SPELLS[it.id];return {icon:s.icon,name:s.name,what:s.what,count:it.uses,el:s.el};}
  if(it.t==="potion")return it.id==="fortis"?{icon:"⚗️",name:"Potio Fortis",what:"you + players near you: +50% damage and fast feet, 40 s",count:it.n}:{icon:"🧪",name:"Potio Sanans",what:"drink: +50 HP",count:it.n};
  if(it.t==="food"){const f=FOODS[it.id];return {icon:f.icon,name:f.name,what:f.what,count:it.n};}
  const m=MAT[it.id];return {icon:m.icon,name:m.name,what:m.what,count:it.n,num:m.num};}
const held=()=>INV[SEL];
function addItem(it){it=Object.assign({},it);if(it.t==="coin"){COINS+=it.n;coinHud();return true;}
  if(it.t==="mat"||it.t==="potion"||it.t==="food"){for(const s of INV)if(s&&s.t===it.t&&s.id===it.id&&s.n<64){const k=Math.min(64-s.n,it.n);s.n+=k;it.n-=k;if(!it.n)break;}if(!it.n){invHud();return true;}}
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
function useHeld(first){const it=held();if(!it){if(first)punch();return;}
  if(it.t==="weapon"){if(WEAPONS[G.id].auto||first)fire();return;}
  if(!first)return;
  if(it.t==="spell"){if(castSpell(it.id)){it.uses--;if(it.uses<=0)INV[SEL]=null;invHud();hud();}return;}
  if(it.t==="food"){if(eat(it)){it.n--;if(!it.n)INV[SEL]=null;invHud();hud();}return;}
  if(it.t==="potion"&&it.id==="fortis"){drinkFortis();mpFx("fortis");it.n--;if(!it.n)INV[SEL]=null;invHud();hud();return;}
  if(it.t==="potion"){if(P.hp>=P.maxHp){popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"already full","burn");return;}KINDS.heal(null,{amount:50});it.n--;if(!it.n)INV[SEL]=null;invHud();hud();return;}
  popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"craft with it: E","spell");}
let punchN=0;
function punch(){if(P.down||!started||paused||bagOpen||G.cool>0)return;G.cool=.45;punchN++;
  if(RIG)RIG.up(punchN%2?"Unarmed_Melee_Attack_Punch_A":"Unarmed_Melee_Attack_Punch_B",{once:true,dur:.4,restart:true,then:()=>RIG.up("2H_Ranged_Aiming")});mpFx("punch");
  setTimeout(()=>{const f=fwdFlat(),at=P.pos.clone().add(new THREE.Vector3(0,1.1,0)).addScaledVector(f,.9);let hit=false;
    DUMMIES.forEach(d=>{if(d.down||hit)return;const v=d.g.position.clone().sub(P.pos);v.y=0;const dist=v.length();if(dist<2.1&&v.normalize().dot(f)>.45){hit=true;damage(d,d.enemy?4:9,d.g.position.clone().add(new THREE.Vector3(0,1.2,0)),false,{el:"plain"});}});
    if(!hit)for(const id in MP.others){const o=MP.others[id];const v=o.g.position.clone().sub(P.pos);v.y=0;if(!hit&&v.length()<1.8&&v.normalize().dot(f)>.45){hit=true;hitPlayer(o,8,o.g.position.clone().add(new THREE.Vector3(0,1.3,0)));}}
    if(!hit)PEOPLE.forEach(pp=>{if(pp.down||hit)return;const v=pp.o.g.position.clone().sub(P.pos);v.y=0;if(v.length()<1.8&&v.normalize().dot(f)>.45){hit=true;hurtPerson(pp,6,pp.o.g.position.clone().add(new THREE.Vector3(0,1.3,0)));}});
    if(!hit)TREES.forEach(tr=>{if(tr.down||hit)return;const v=tr.g.position.clone().sub(P.pos);v.y=0;if(v.length()<2&&v.normalize().dot(f)>.4){hit=true;chopHit(tr,7,tr.g.position.clone().add(new THREE.Vector3(0,1.1,0)));}});
    if(!hit)NODES.forEach(n=>{if(n.down||hit)return;const v=n.g.position.clone().sub(P.pos);v.y=0;if(v.length()<2.3&&v.normalize().dot(f)>.4){hit=true;mineHit(n,7,n.g.position.clone().add(new THREE.Vector3(0,.8,0)));}});
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
function dropItem(at,it,life,sid){const f=itemInfo(it);const hex=it.t==="spell"?FX.HEX[SPELLS[it.id].el]:it.t==="weapon"?0xffd27a:0xffffff;
  const g=new THREE.Group();g.position.set(at.x+rnd(-.8,.8),0,at.z+rnd(-.8,.8));let bob;
  if(it.t==="spell"){bob=picSprite(f.pic);bob.scale.setScalar(.8);const lb=label(f.name,hex);lb.position.y=1.65;g.add(lb);}
  else{bob=picSprite(f.pic);bob.scale.setScalar(.75);if((it.n||0)>1){const lb=label("×"+it.n,0xffffff);lb.scale.set(1.2,.22,1);lb.position.y=1.5;g.add(lb);}}
  bob.position.y=.9;g.add(bob);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.32,.44,30),new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;g.add(ring);
  scene.add(g);PICKUPS.push({g,it,bob,ring,t:Math.random()*5,life:life||60,sid:sid||null});return PICKUPS[PICKUPS.length-1];}
function shareDrop(d){if(!MP.ok||!d)return;d.sid=MP.id.slice(0,6)+Math.random().toString(36).slice(2,8);setKey("drop:"+d.sid,{it:d.it,x:R2(d.g.position.x),z:R2(d.g.position.z)});}
// dropping your own things (G, or Drop in the bag): they land in front of you, stay 5 minutes, and only pull back to you once you have walked away
function dropOwn(i){const it=INV[i];if(!it||P.down)return false;const at=P.pos.clone().add(new THREE.Vector3(-Math.sin(P.yaw)*1.8,0,-Math.cos(P.yaw)*1.8));at.y=0;
  if(it.t==="weapon")it.ammo=null;const dp=dropItem(at,it,300);dp.hold=true;shareDrop(dp);INV[i]=null;if(i===SEL)select(SEL);invHud();hud();
  const f=itemInfo(it);popNum(P.pos.clone().add(new THREE.Vector3(0,2.3,0)),`dropped ${f.name}`,"spell",f.pic);return true;}
function stepPickups(dt){for(let i=PICKUPS.length-1;i>=0;i--){const d=PICKUPS[i];d.t+=dt;d.life-=dt;d.bob.position.y=.9+Math.sin(d.t*3)*.12;if(d.bob.isMesh)d.bob.rotation.y+=dt*2.2;d.ring.scale.setScalar(1+Math.sin(d.t*4)*.08);
    if(d.life<6)d.g.visible=Math.sin(d.t*16)>-.2;
    const dx=P.pos.x-d.g.position.x,dz=P.pos.z-d.g.position.z,dist=Math.hypot(dx,dz);
    if(d.hold&&dist>3.5)d.hold=false;
    if(!d.hold&&!P.down&&dist<3&&P.pos.y<2){if(dist<1&&d.sid&&MP.ok){share({k:"take",id:d.sid});scene.remove(d.g);PICKUPS.splice(i,1);continue;}if(dist<1){if(addItem(d.it)){const f=itemInfo(d.it);popNum(P.pos.clone().add(new THREE.Vector3(0,2.3,0)),`+${d.it.n||d.it.uses||1} ${f.name}`,"spell",f.pic);scene.remove(d.g);PICKUPS.splice(i,1);continue;}}
      else{d.g.position.x+=dx/dist*dt*6;d.g.position.z+=dz/dist*dt*6;}}
    if(d.life<=0){if(d.sid)setKey("drop:"+d.sid,null);scene.remove(d.g);PICKUPS.splice(i,1);}}}
// ---------------- mining: crystal veins and iron rocks; shoot them to break them, they grow back ----------------
const NODES=[];
const NODE_SPOTS=[["ferrum",14,9],["ferrum",-16,-3],["ferrum",22,-15],["ferrum",-14,44],["ferrum",8,48],["ferrum",-44,-46],
  ["carbo",50,28],["carbo",64,42],["nimbus",-50,6],["nimbus",-66,24],["silex",-28,56],["silex",-44,70],["aether",48,-48],["aether",64,-64],["electrum",6,58],["electrum",24,72]];
function makeNode(kind,x,z){for(let k=0;k<8&&BLOCKS.some(b=>Math.abs(x-b.x)<b.w/2+1.4&&Math.abs(z-b.z)<b.d/2+1.4);k++){x*=1.08;z*=1.08;}
  const g=new THREE.Group();g.position.set(x,0,z);const ore=kind==="ferrum";
  const rock=LOOK.M(new THREE.DodecahedronGeometry(.8),LOOK.toon(ore?0x7d7873:0x8f8a84),.02);rock.scale.set(1.25,.75,1.05);rock.position.y=.45;rock.rotation.y=Math.random()*6;g.add(rock);
  const shards=[];
  if(ore){for(let i=0;i<9;i++){const f=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.18),new THREE.MeshStandardMaterial({color:0xc9ced6,metalness:.8,roughness:.3}));const a=Math.random()*6.3,u=Math.random()*1.2;f.position.set(Math.cos(a)*.75*Math.cos(u),.45+Math.sin(u)*.55,Math.sin(a)*.65*Math.cos(u));f.rotation.set(rnd(0,3),rnd(0,3),0);g.add(f);shards.push(f);}}
  else{const hex=FX.HEX[MAT[kind].el];for(let i=0;i<6;i++){const s=new THREE.Mesh(new THREE.OctahedronGeometry(.22),glow(hex,1.3));const a=i/6*6.3+rnd(-.3,.3),r=i?.45:0;s.position.set(Math.cos(a)*r,.95+(i?0:.25),Math.sin(a)*r);s.scale.set(.8,2.4+rnd(-.4,.6),.8);s.rotation.set(i?Math.sin(a)*.5:0,0,i?-Math.cos(a)*.5:0);g.add(s);shards.push(s);}}
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(g);const n={g,rock,kind,hp:ore?60:90,max:ore?60:90,down:false,shards};rock.userData.node=n;NODES.push(n);}
NODE_SPOTS.forEach(([k,x,z])=>makeNode(k,x,z));
function mineHit(n,dmg,at){if(n.down)return;n.hp-=dmg;const hex=n.kind==="ferrum"?0xd8dde4:FX.HEX[MAT[n.kind].el];sparks(at,10,hex);for(let i=0;i<3;i++)PUFF.emit(at,rnd3(1.5),C(0x9a948c).multiplyScalar(.5),.5,{drag:2});
  popNum(at,`${Math.max(0,Math.ceil(n.hp))}`,"burn");n.shards.forEach(s=>s.position.x+=rnd(-.02,.02));
  if(n.hp>0)return;nodeBreak(n,true);}
function nodeBreak(n,mine){const hex=n.kind==="ferrum"?0xd8dde4:FX.HEX[MAT[n.kind].el];n.down=true;const at2=n.g.position.clone();if(mine){shake(.06);share({k:"node",i:NODES.indexOf(n)});}for(let i=0;i<22;i++)SPARK.emit(at2.clone().add(new THREE.Vector3(0,.8,0)),rnd3(1).normalize().multiplyScalar(rnd(2,6)),C(hex),rnd(.4,.8),{grav:8});
  tween(.3,t=>n.g.scale.setScalar(Math.max(.01,1-t)),()=>{n.g.visible=false;});
  if(mine){if(n.kind==="ferrum")dropItem(at2,{t:"mat",id:"ferrum",n:ri(2,3)});else dropItem(at2,{t:"mat",id:n.kind,n:Math.random()<.35?2:1});}
  setTimeout(()=>{n.hp=n.max;n.down=false;n.g.visible=true;tween(.5,t=>n.g.scale.setScalar(Math.max(.01,t)));},45000);}
const ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
// a ray from a to b: does a wall stand in between? (holes let it through)
function wallBetween(a,b){const d=b.clone().sub(a);const len=d.length();const r=new THREE.Raycaster(a,d.normalize(),0,len);for(const h of r.intersectObjects(SOLIDS,false)){const bl=h.object.userData.block;if(bl&&(bl.pass||holeAt(bl,h.point)))continue;if(!bl)continue;return h;}return null;}

// ---------------- coins and the market: the merchant's stall in town buys what you find and sells what you need ----------------
let COINS=0;
const WPRICE={rifle:8,shotgun:25,staff:30,repeater:45,cannon:50,arcus:45};
function sellPrice(it){if(!it)return 0;if(it.t==="food")return Math.max(1,Math.floor(FOODS[it.id].price/2));if(it.t==="mat")return MAT[it.id].sell||1;if(it.t==="potion")return it.id==="fortis"?12:8;if(it.t==="spell")return 3*Math.max(1,it.uses);if(it.t==="weapon")return WPRICE[it.id]||10;return 0;}
let OFFERS=[];let offersT=0;let HAG=null;const HAGNO=new Set();   // HAG: the deal Mercator is offering right now; HAGNO: stacks he won't haggle over again
function refreshOffers(){HAGNO.clear();HAG=null;const sp=[...DROP_SPELLS].sort(()=>Math.random()-.5).slice(0,3);
  OFFERS=[{t:"weapon",id:"rifle",price:30},{t:"potion",id:"potion",n:1,price:20},{t:"potion",id:"fortis",n:1,price:30},{t:"mat",id:"ferrum",n:1,price:MAT.ferrum.buy},{t:"mat",id:"lignum",n:1,price:MAT.lignum.buy},
    ...CRAFT.CORES.map(c=>({t:"mat",id:c,n:1,price:MAT[c].buy})),...sp.map(id=>({t:"spell",id,uses:SPELLS[id].uses,price:6*SPELLS[id].uses+8}))];}
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
  LOOK.loadRig("/play/elementum/models/merchant.glb",false,r=>{if(!r)return;MERCHANT.rig=r;r.root.position.set(0,0,1.2);r.root.rotation.y=Math.PI;g.add(r.root);r.root.traverse(o=>{if(o.name==="Mug")o.visible=true;});r.base("Idle",{snap:true});});
  {const m=block(2,12,3.6,1.4,1,0x8a5a32);m.material.visible=false;m.castShadow=false;}}   // the counter: you bump into it, shots stop at it
const nearMerchant=()=>P.pos.distanceTo(MERCHANT.pos)<4.2;
function sell(i){const it=INV[i];if(!it||!nearMerchant())return;const pr=sellPrice(it);COINS+=pr;
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
function stepTown(dt){if(MERCHANT.rig)MERCHANT.rig.update(dt);offersT+=dt;if(offersT>120){offersT=0;refreshOffers();}
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
function eat(it){const f=FOODS[it.id];if(!f)return false;if(P.hp>=P.maxHp&&!f.buff){popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"already full","burn");return false;}
  P.hp=Math.min(P.maxHp,P.hp+f.heal);if(f.buff)P[f.buff]=Math.max(P[f.buff]||0,f.secs);hud();
  popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),f.heal?"+"+f.heal+" HP":f.name,"spell","food_"+it.id);for(let i=0;i<14;i++)SPARK.emit(P.pos.clone().add(new THREE.Vector3(rnd(-.4,.4),rnd(.8,1.6),rnd(-.4,.4))),new THREE.Vector3(0,rnd(.8,2),0),C(0xffd27a),.6,{grav:-1});return true;}
// things you can walk up to and use with T (or the button that appears)
const ACTS=[];let ACT=null;
function stepActs(){let best=null,bd=1e9;for(const a of ACTS){if(a.hidden&&a.hidden())continue;const d=Math.hypot(P.pos.x-a.pos.x,P.pos.z-a.pos.z);if(d<a.r&&d<bd){bd=d;best=a;}}
  ACT=best;const b=$("#trade");b.classList.toggle("hidden",!best||bagOpen||P.down);if(best)b.textContent=`${typeof best.label==="function"?best.label():best.label}${touch?"":" (T)"}`;}
function useAct(){if(ACT&&!P.down)ACT.run();}
function npc(url,x,z,face,idle){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=face;scene.add(g);const o={g,rig:null};
  LOOK.loadRig("/play/elementum/models/"+url,false,r=>{if(!r)return;o.rig=r;g.add(r.root);r.base(idle||"Idle",{snap:true});});TOWNFOLK.push(o);return o;}
const TOWNFOLK=[];
// the merchant from before becomes one of the "acts"
ACTS.push({pos:MERCHANT.pos,r:4.2,label:"🪙 Trade with Mercator",run:()=>toggleBag(true,"market")});
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
ACTS.push({pos:COOK.pos,r:4.2,label:"🍞 Buy food",run:()=>toggleBag(true,"food")});
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
function sleep(){if(HOME.restT>0){popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),`you can rest again in ${Math.ceil(HOME.restT)} s`,"burn");return;}
  HOME.restT=60;HOME.slept=true;const v=$("#sleep");v.classList.add("on");setTimeout(()=>{P.hp=P.maxHp;P.slowT=0;hud();popNum(P.pos.clone().add(new THREE.Vector3(0,2.2,0)),"rested — full health","spell");v.classList.remove("on");},900);}
ACTS.push({get pos(){return HOME.bed;},r:2.2,label:()=>HOME.restT>0?`🛏️ Bed (rest again in ${Math.ceil(HOME.restT)} s)`:"🛏️ Sleep — full health",run:sleep});
ACTS.push({get pos(){return HOME.chest;},r:2,label:"📦 Open your chest",run:()=>toggleBag(true,"chest")});
ACTS.push({get pos(){return HOME.door;},r:2,label:()=>HOME.h.locked?"🔓 Unlock your door":"🔒 Lock your door",run:toggleLock});
HOUSES.forEach(h=>ACTS.push({pos:h.doorP,r:1.8,hidden:()=>h.mine||!h.locked,label:()=>`🔒 ${h.name}'s house is locked`,run:()=>{}}));
// --- trees you can chop (punch or shoot them): wood for everything; they grow back
const TREES=[];
function makeTree(x,z){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);const s=rnd(.85,1.2);
  const trunk=LOOK.M(new THREE.CylinderGeometry(.22*s,.32*s,2.2*s,8),LOOK.toon(0x7a4a28),.015);trunk.position.y=1.1*s;g.add(trunk);
  [[0,2.6,0,1.1],[.5,2.2,.2,.8],[-.45,2.3,-.25,.85],[0,3.3,0,.75]].forEach(([a,b,c,r])=>{const l=LOOK.M(new THREE.IcosahedronGeometry(r*s,1),LOOK.toon(Math.random()<.5?0x3f8f3a:0x4fa346),.02);l.position.set(a*s,b*s,c*s);g.add(l);});
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});const t={g,trunk,hp:35,max:35,down:false,s};trunk.userData.tree=t;TREES.push(t);return t;}
function chopHit(t,dmg,at){if(t.down)return;t.hp-=dmg;for(let i=0;i<6;i++)SPARK.emit(at,rnd3(1.5),C(0xb98a55),.5,{grav:6});for(let i=0;i<3;i++)PUFF.emit(t.g.position.clone().add(new THREE.Vector3(rnd(-1,1),rnd(2,3.4)*t.s,rnd(-1,1))),new THREE.Vector3(0,-1,0),C(0x4fa346).multiplyScalar(.5),.6,{drag:2});
  popNum(at,`${Math.max(0,Math.ceil(t.hp))}`,"burn");t.g.rotation.z=rnd(-.03,.03);
  if(t.hp>0)return;treeFall(t,true);}
// a tree falls (loot only for whoever felled it; the others just see it fall), and grows back after 45 s
function treeFall(t,mine){t.down=true;const side=Math.random()<.5?1:-1;tween(.9,k=>{t.g.rotation.z=side*k*k*1.45;},()=>{tween(.5,k=>t.g.scale.setScalar(Math.max(.01,1-k)),()=>{t.g.visible=false;});});
  if(mine){dropItem(t.g.position.clone(),{t:"mat",id:"lignum",n:ri(2,4)});shake(.05);share({k:"tree",i:TREES.indexOf(t)});}
  setTimeout(()=>{t.hp=t.max;t.down=false;t.g.rotation.z=0;t.g.visible=true;tween(.8,k=>t.g.scale.setScalar(Math.max(.01,k)));},45000);}
// a grove inside the walls on each side, and woods out in the wilds
for(let i=0;i<9;i++)makeTree(31+(i%3)*5+rnd(-1,1),-30+Math.floor(i/3)*7+rnd(-1,1));
for(let i=0;i<9;i++)makeTree(-41+(i%3)*5+rnd(-1,1),6+Math.floor(i/3)*6+rnd(-1,1));
[[60,10],[64,16],[58,18],[-52,-18],[-57,-24],[-50,-28],[-20,52],[-14,56],[-26,48],[30,52],[36,56],[28,-52],[34,-58],[-34,-56]].forEach(([x,z])=>makeTree(x,z));
// --- villagers: walk up to one with ❗ — they ask for help and pay in coins
const QUESTS={kills:{},dummies:0};
const VILLAGERS=[["Livia",-26,-15,1.2],["Marcus",27,8,-1.6],["Felix",-24,26,2.4],["Octavia",6,24,3.14]].map(([name,x,z,face])=>{
  const o=npc("villager.glb",x,z,face);const v={name,pos:new THREE.Vector3(x,0,z),o,q:null,mark:null,markKey:""};
  const lb=label(name,0xffffff);lb.scale.set(1.6,.3,1);lb.position.set(x,2.35,z);scene.add(lb);return v;});
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
  if(r<.42){const job=pick(["roof","patch","fence"]),w=Object.assign(CRAFT.job(job,MATH.lv),{tries:0});
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
  v.mark=iconSprite(key);v.mark.scale.setScalar(.7);v.mark.position.set(v.pos.x,2.95,v.pos.z);scene.add(v.mark);});
  if(VILLAGERS[0].mark)VILLAGERS.forEach(v=>{if(v.mark)v.mark.position.y=2.95+Math.sin(tAcc*3)*.08;});
  const act=VILLAGERS.filter(v=>v.q.accepted);$("#quests").innerHTML=act.map(v=>`<div>${questDone(v.q)?"✅":"📜"} ${v.name}: ${esc(qShort(v.q))}</div>`).join("");
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
VILLAGERS.forEach(v=>personize(v.o,v.name));TOWNFOLK.filter(o=>!PEOPLE.some(pp=>pp.o===o)).forEach(o=>personize(o,"the cook"));
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
function jail(){setKey("law:"+MP.id,null);LAW.times++;LAW.wanted=false;LAW.warned=0;LAW.jailT=30+15*Math.min(4,LAW.times-1);P.pos.copy(JAIL.cell);P.vel.set(0,0,0);P.hp=Math.max(P.hp,30);hud();toggleBag(false);
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
function stepLife(dt){stepVillagers();stepLaw(dt);stepMarks(dt);stepHouses(dt);TOWNFOLK.forEach(o=>{if(o.rig&&o.g.position.distanceTo(P.pos)<70)o.rig.update(dt);});HOME.restT=Math.max(0,HOME.restT-dt);
  if(TOWN.fountain&&Math.random()<dt*30)SPARK.emit(TOWN.fountain,new THREE.Vector3(rnd(-1.2,1.2),rnd(2,3),rnd(-1.2,1.2)),C(Math.random()<.5?0x9fdcff:0xffffff),.9,{grav:6});
  if(P.regenT>0&&!P.down&&P.hp<P.maxHp){P.hp=Math.min(P.maxHp,P.hp+3*dt);hud();}stepActs();
  const bf=[["mightT","⚗️"],["regenT","🥣"],["toughT","🧀"],["strongT","🐟"],["jumpT","🍇"],["buffT","💨"],["shieldT","🫧"],["invulnT","🌟"],["slowT","❄️"]].filter(([k])=>P[k]>0).map(([k,i])=>`<span>${i} ${Math.ceil(P[k])}</span>`).join("");
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
function setRoom(code,name){const was=MP.room;MP.room=cleanRoom(code);if(name!==undefined||MP.room!==was)MP.roomName=MP.room==="PUBLIC"?"":(name||"");WORLD.seq=0;WORLD.wanted.clear();
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
    o.to.set(p.x,p.y,p.z);o.yaw=p.yaw;o.sp=p.sp;o.air=p.air;o.might=p.bf==="S";
    if(o.name!==p.name||o.hp!==p.hp){o.name=p.name;o.hp=p.hp;if(o.tag){o.g.remove(o.tag);o.tag.material.map.dispose();}o.tag=nameTag(`${p.name}  ❤ ${p.hp}`);o.tag.position.y=2.55;o.g.add(o.tag);}
    if(p.fx&&p.fx!==o.lastFx){o.lastFx=p.fx;const [k,id]=p.fx.split(":");const at=o.g.position.clone().add(new THREE.Vector3(0,1.3,0));
      if(k==="fortis"){FX.stars(at,"gold",5,1.6);if(!P.down&&o.g.position.distanceTo(P.pos)<12)drinkFortis(o.name);}
      else if(k==="shot"){muzzle(at.clone().add(new THREE.Vector3(-Math.sin(o.yaw)*.6,0,-Math.cos(o.yaw)*.6)),new THREE.Vector3(-Math.sin(o.yaw),0,-Math.cos(o.yaw)),0xffd27a,.4);}
      else if(SPELLS[k]){const el=SPELLS[k].el;FX.stars(at,el,3,1.2);flash(at,FX.HEX[el],4,.25);popNum(at.clone().add(new THREE.Vector3(0,1.2,0)),SPELLS[k].name,"spell","scroll_"+SPELLS[k].el);}}}
  for(const id in MP.others)if(!seen.has(id)){scene.remove(MP.others[id].g);delete MP.others[id];}
  const n=Object.keys(MP.others).length;$("#online").textContent=`👥 ${MP.room==="PUBLIC"?"Public":"Room "+(MP.roomName||MP.room)} · ${MP.ok?n+1:"…"}`;}
// ---------------- the shared world: what you do, the others in your room see — and the other way round ----------------
// Each update sends what changed (events) and gets back what the others did. Things that last (the training center, cottages, items on the ground)
// are "keys", so someone who joins later sees them too. Monsters and the training dummies' health stay each player's own.
const WORLD={out:[],seq:0,remote:false,wanted:new Set(),STATIC:0};
function share(ev){if(WORLD.remote)return;WORLD.out.push(ev);if(WORLD.out.length>120)WORLD.out.splice(0,WORLD.out.length-120);}
const setKey=(key,val)=>share({k:"key",key,val});
const V3=a=>new THREE.Vector3(a[0],a[1],a[2]),R2=v=>Math.round(v*100)/100;
function worldApply(fn){WORLD.remote=true;try{fn();}catch(e){console.warn("world",e);}finally{WORLD.remote=false;}}
function applyKey(key,val){
  if(key==="train"){if(val&&!TRAIN.built)buildTraining(true);return;}
  if(key.startsWith("cot:")){const [,name,kind]=key.split(":");const v=VILLAGERS.find(x=>x.name===name);if(!v||!val)return;const q=workQ(v);if(q&&q.job===kind)return;cottageState(v.home,kind,val);return;}
  if(key.startsWith("drop:")){const id=key.slice(5);const i=PICKUPS.findIndex(d=>d.sid===id);
    if(val===null){if(i>=0){scene.remove(PICKUPS[i].g);PICKUPS.splice(i,1);}return;}
    if(i<0&&val&&val.it){dropItem(new THREE.Vector3(val.x,0,val.z),val.it,300,id);}return;}
  if(key.startsWith("law:")){const id=key.slice(4);if(val)WORLD.wanted.add(id);else WORLD.wanted.delete(id);}}
function applyEv(ev){
  if(ev.k==="key")return applyKey(ev.key,ev.val);
  if(ev.k==="hit"){if(ev.to!==MP.id||P.down||LAW.jailT>0)return;hurt(Math.max(1,Math.min(200,ev.n|0)));popNum(P.pos.clone().add(new THREE.Vector3(0,2.5,0)),`${ev.by||"a player"} -${ev.n|0}`,"burn");return;}
  if(ev.k==="tree"){const t=TREES[ev.i];if(t&&!t.down){t.hp=0;treeFall(t,false);}return;}
  if(ev.k==="node"){const n=NODES[ev.i];if(n&&!n.down){n.hp=0;nodeBreak(n,false);}return;}
  if(ev.k==="wall"){const b=BLOCKS[ev.b];if(b&&ev.b<WORLD.STATIC)wallHit(b,V3(ev.p),V3(ev.n),ev.pw||1);return;}
  if(ev.k==="scorch")return scorch(new THREE.Vector3(ev.x,0,ev.z),ev.r,ev.el);
  if(ev.k==="ko"){const pp=PEOPLE.find(x=>x.name===ev.name&&!x.guard);if(pp&&!pp.down)knockOut(pp);return;}
  if(ev.k==="dummy"){const d=TRAIN.dummies[ev.i];if(d&&!d.down&&!d.unbuilt){d.down=true;dummyFall(d);}return;}}
// hitting another player: they lose that much health in their own game
function hitPlayer(o,n,at){if(!o||!o.id||n<=0)return;share({k:"hit",to:o.id,n:Math.round(n)});popNum(at||o.g.position.clone().add(new THREE.Vector3(0,2.2,0)),`-${Math.round(n)}`,"burn");
  if(at)dent(at,P.pos.clone().sub(at).setY(0).normalize(),o.g);}
function stepMP(dt){for(const id in MP.others){const o=MP.others[id];o.g.position.lerp(o.to,Math.min(1,dt*10));let d=o.yaw-o.g.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));o.g.rotation.y+=d*Math.min(1,dt*10);
    if(!o.glow){o.glow=new THREE.Mesh(new THREE.TorusGeometry(.7,.05,8,32),new THREE.MeshBasicMaterial({color:0xffd36a,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));o.glow.rotation.x=Math.PI/2;o.glow.position.y=.15;o.g.add(o.glow);}
    o.glow.visible=!!o.might;if(o.might){o.glow.rotation.z+=dt*2;if(Math.random()<dt*10)SPARK.emit(o.g.position.clone().add(new THREE.Vector3(rnd(-.5,.5),rnd(.2,1.8),rnd(-.5,.5))),new THREE.Vector3(0,1.2,0),C(0xffd36a),.6,{grav:-.5});}
    if(o.rig){o.rig.base(o.air?"Jump_Idle":o.sp>5?"Running_A":o.sp>.4?"Walking_A":"Idle");o.rig.update(dt);}}
  MP.t-=dt;if(MP.t>0||MP.busy||!started)return;MP.t=.15;MP.busy=true;
  const sent=WORLD.out.splice(0,40);const it=held(),body={ev:sent,since:WORLD.seq,lock:MP.lockReq,room:MP.room,id:MP.id,x:P.pos.x,y:P.pos.y,z:P.pos.z,yaw:P.yaw,sp:P.speed,air:!P.onGround,hp:Math.round(P.hp),bf:P.mightT>0?"S":"",held:itemInfo(it)?itemInfo(it).icon:"",fx:MP.fx};
  fetch("/api/elementum/state",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify(body)})
    .then(r=>r.ok?r.json():null).then(j=>{MP.busy=false;if(!j||!j.players){MP.ok=false;WORLD.out.unshift(...sent);return;}MP.ok=true;
      worldApply(()=>{if(j.keys){for(const k in j.keys)applyKey(k,j.keys[k]);PICKUPS.filter(d=>d.sid&&!(("drop:"+d.sid) in j.keys)).forEach(d=>{scene.remove(d.g);PICKUPS.splice(PICKUPS.indexOf(d),1);});}(j.events||[]).forEach(applyEv);});
      if(typeof j.seq==="number")WORLD.seq=j.seq;(j.won||[]).forEach(v=>{if(v&&v.it&&!addItem(v.it))dropItem(P.pos.clone(),v.it,300);else if(v&&v.it){const f=itemInfo(v.it);popNum(P.pos.clone().add(new THREE.Vector3(0,2.3,0)),`+${v.it.n||v.it.uses||1} ${f.name}`,"spell",f.pic);}});MP.you=j.you||"";if(j.room===MP.room&&j.roomName&&j.roomName!==MP.roomName){MP.roomName=j.roomName;try{localStorage.setItem("elementum.roomName",MP.roomName);}catch(e){}}MP.list=j.players;if(body.lock!==undefined&&MP.lockReq===body.lock)delete MP.lockReq;setHouses(j.houses);mpApply(j.players);if(roomOpen)renderRoom();}).catch(()=>{MP.busy=false;MP.ok=false;WORLD.out.unshift(...sent);});}

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
// ---------------- monsters: each has a home, wanders, hunts you when you come near and casts its own spells ----------------
// Quaternius "Ultimate Monsters" (CC0, models/monsters/*.glb). They live outside the town walls and never come in. Walls stop their spells; they come back 25 s after you beat them.
const QA={idle:"Idle",walk:"Walk",run:"Run",cast:"Weapon",hit:"HitReact",death:"Death",punch:"Punch"};
const ENEMY_TYPES={
  demon:{name:"Demon",url:"monsters/demon.glb",scale:.64,hp:180,spells:["ignis","imber"],drops:["cornu"],core:"carbo",home:[55,32],speed:2.4,keep:9,barY:2.3,anim:QA},
  yeti:{name:"Yeti",url:"monsters/yeti.glb",scale:.7,hp:200,spells:["hasta","campus"],drops:["villus"],core:"nimbus",home:[-58,15],speed:2.2,keep:9,barY:2.3,anim:QA},
  king:{name:"Mushroom King",url:"monsters/mushroom_king.glb",scale:.6,hp:220,spells:["spinae","saxum"],drops:["sporae"],core:"silex",home:[-36,62],speed:1.8,keep:8,barY:2.4,anim:QA},
  ninja:{name:"Ninja",url:"monsters/ninja.glb",scale:.63,hp:160,spells:["sagittae","umbra"],drops:["pannus"],core:"aether",home:[56,-56],speed:3.2,keep:8,barY:2.3,anim:QA},
  frog:{name:"Frog",url:"monsters/frog.glb",scale:.72,hp:170,spells:["globus","fulmen"],drops:["gemma"],core:"electrum",home:[15,64],speed:2.6,keep:10,barY:2.3,anim:QA},
  orc:{name:"Orc",url:"monsters/orc.glb",scale:.62,hp:240,spells:["motus","saxum"],drops:["dens"],core:"silex",home:[-62,-42],speed:2.3,keep:6,barY:2.4,anim:QA},
  dino:{name:"Dino",url:"monsters/dino.glb",scale:.62,hp:210,spells:["draco","anulus"],drops:["squama"],core:"carbo",home:[72,-6],speed:2.8,keep:5,barY:2.4,anim:QA},
  monkroose:{name:"Monkroose",url:"monsters/monkroose.glb",scale:.7,hp:170,spells:["turbo","sagittae"],drops:["pluma"],core:"aether",home:[-8,-74],speed:3,keep:9,barY:2.3,anim:QA},
  shade:{name:"Blue Demon",url:"monsters/blue_demon.glb",scale:.7,hp:200,spells:["nox","tenebrae","radius"],drops:["cinis"],core:"electrum",home:[46,76],speed:2.5,keep:10,barY:2.3,anim:QA},
};
const ENEMIES=[];
function spawnEnemy(key,chief,i,pack){const T=ENEMY_TYPES[key];const k=chief?1.2:.82;const a=i*2.1,home=new THREE.Vector3(T.home[0]+(chief?0:Math.cos(a)*4),0,T.home[1]+(chief?0:Math.sin(a)*4));
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
Object.keys(ENEMY_TYPES).forEach(key=>{const pack=[];spawnEnemy(key,true,0,pack);for(let i=0;i<3;i++)spawnEnemy(key,false,i,pack);});   // 9 packs of 4: they swarm together
function blockedAt(p){if(inTown(p,1.5))return true;for(const b of BLOCKS){if(b.h<.3)continue;if(Math.abs(p.x-b.x)<b.w/2+.5&&Math.abs(p.z-b.z)<b.d/2+.5)return true;}return false;}
function enemyDown(d){const T=d.T;const at=d.g.position.clone();
  if(!d.chief){dropItem(at,{t:"coin",n:ri(2,5)});if(Math.random()<.4)dropItem(at,{t:"mat",id:T.core,n:1});if(Math.random()<.3)dropItem(at,{t:"mat",id:pick(T.drops),n:1});}
  else{dropItem(at,{t:"mat",id:T.core,n:ri(1,2)});dropItem(at,{t:"coin",n:ri(8,15)});T.drops.forEach(id=>dropItem(at,{t:"mat",id,n:ri(1,2)}));}
  if(Math.random()<(d.chief?.7:.2))dropItem(at,{t:"spell",id:pick(T.spells),uses:SPELLS[pick(T.spells)].uses});
  if(d.rig)d.rig.full(d.anim.death,{once:true,restart:true});
  setTimeout(()=>tween(.8,t=>{d.g.position.y=-t*1.5;}),2200);
  setTimeout(()=>{d.hp=d.max;d.g.position.copy(d.home);d.slowT=d.stunT=0;d.pushV=null;d.casting=0;
    if(d.rig&&d.anim.rise)d.rig.full(d.anim.rise,{once:true,restart:true,then:()=>{d.rig.clearFull();d.down=false;}});
    else{if(d.rig)d.rig.clearFull();d.g.scale.setScalar(.01);tween(.6,t=>d.g.scale.setScalar(Math.max(.01,t)),()=>{d.down=false;});}},25000);}
const pick=a=>a[Math.floor(Math.random()*a.length)];
function stepEnemies(dt){for(const d of ENEMIES){const r=d.rig;const far=d.g.position.distanceTo(P.pos)>80;if(r&&!far)r.update(dt);if(d.down||far)continue;const T=d.T,A=d.anim,g=d.g;
    d.stunT=Math.max(0,(d.stunT||0)-dt);d.slowT=Math.max(0,(d.slowT||0)-dt);d.cool-=dt;d.punchCool-=dt;d.alert=Math.max(0,d.alert-dt);d.wanderT-=dt;
    if(d.pushV){const np=g.position.clone().addScaledVector(d.pushV,dt);if(!blockedAt(np))g.position.copy(np);d.pushV.multiplyScalar(Math.pow(.02,dt));if(d.pushV.length()<.2)d.pushV=null;}
    if(d.stunT>0){if(r)r.base(A.idle);continue;}
    if(d.casting>0){d.casting-=dt;if(d.casting<=0)castAs(d,d.castId);continue;}
    const to=new THREE.Vector3(P.pos.x-g.position.x,0,P.pos.z-g.position.z);const dist=to.length();to.normalize();
    const home=d.home;const fromHome=g.position.distanceTo(home);
    const hunting=!P.down&&!inTown(P.pos,.5)&&(dist<26||d.alert>0)&&fromHome<50;
    if(hunting&&!d.hunting)d.pack.forEach(m=>{m.alert=Math.max(m.alert,8);});d.hunting=hunting;let dir=null,speed=0,face=null;   // one sees you, the whole pack comes
    if(hunting){face=to;
      if(dist>d.keep+2){dir=to;speed=d.speed*1.5;}else if(dist<d.keep-4&&dist>2.6){dir=to.clone().negate();speed=d.speed;}
      else{if(Math.random()<dt*.4)d.strafe=-d.strafe;dir=new THREE.Vector3(-to.z,0,to.x).multiplyScalar(d.strafe);speed=d.speed*.6;}
      if(dist<2.4&&d.punchCool<=0){d.punchCool=1.8;if(r)r.full(A.punch,{once:true,restart:true,dur:.6,then:()=>{if(!d.down)r.clearFull();}});setTimeout(()=>{if(!d.down&&P.pos.distanceTo(g.position)<2.8)hurt(8);},250);}
      else if(d.cool<=0&&dist<24){const eye=g.position.clone().add(new THREE.Vector3(0,1.4,0));
        if(!wallBetween(eye,P.pos.clone().add(new THREE.Vector3(0,1.1,0)))){d.cool=rnd(3,4.5)*d.castK;d.castId=pick(T.spells);d.casting=.45;dir=null;
          if(r)r.full(A.cast,{once:true,restart:true,dur:.9,then:()=>{if(!d.down)r.clearFull();}});}else d.cool=.6;}}
    else{if(!d.wander||d.wanderT<=0||g.position.distanceTo(d.wander)<.8){const a=Math.random()*6.3,rr=rnd(2,9);d.wander=home.clone().add(new THREE.Vector3(Math.cos(a)*rr,0,Math.sin(a)*rr));d.wanderT=rnd(4,8);d.pause=rnd(.5,2.5);}
      if(d.pause>0)d.pause-=dt;else{dir=d.wander.clone().sub(g.position).setY(0).normalize();speed=d.speed*.55;}face=dir;}
    if(dir&&speed>0){speed*=d.slowT>0?.45:1;const np=g.position.clone().addScaledVector(dir,speed*dt);
      if(!blockedAt(np))g.position.copy(np);else{const nx=g.position.clone();nx.x=np.x;const nz=g.position.clone();nz.z=np.z;if(!blockedAt(nx))g.position.copy(nx);else if(!blockedAt(nz))g.position.copy(nz);else{d.wanderT=0;d.strafe=-d.strafe;}}
      g.position.x=clamp(g.position.x,-180,180);g.position.z=clamp(g.position.z,-180,180);
      if(r&&!r.fullName)r.base(speed>d.speed*1.2?A.run:A.walk,{speed:speed>d.speed*1.2?1:Math.max(.6,speed/d.speed)});}
    else if(r)r.base(A.idle);
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

function hitTargets(){const t=[...SOLIDS];for(const id in MP.others)if(MP.others[id].hb)t.push(MP.others[id].hb);PEOPLE.forEach(pp=>{if(!pp.down)t.push(pp.hb);});NODES.forEach(n=>{if(!n.down)t.push(n.rock);});TREES.forEach(tr=>{if(!tr.down)t.push(tr.trunk);});DUMMIES.forEach(d=>{if(!d.down)t.push(...d.parts);});return t;}
function damage(d,n,at,headshot,o){o=o||{};if(d.down)return;if(P.mightT>0)n=Math.round(n*1.5);else if(P.strongT>0)n=Math.round(n*1.25);   // Potio Fortis, grilled fish
  const el=o.el||"plain",hex=FX.HEX[el];d.hp=Math.max(0,d.hp-n);popNum(at,(headshot?"HEAD ":"")+"-"+n,headshot?"head":"");sparks(at,12,hex);
  if(!o.area){FX.impact(at,el,headshot?1.0:.7);FX.stars(at,el,headshot?3:2,.9);}
  $("#xh").classList.add("hit");setTimeout(()=>$("#xh").classList.remove("hit"),90);
  d.mats.forEach(m=>{m.emissive.setHex(hex);m.emissiveIntensity=.8;});setTimeout(()=>d.mats.forEach(m=>m.emissiveIntensity=0),120);
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
  if(el==="fire"){FX.burning(d.g,"fire",1.5,1.1);let ticks=3;const tick=()=>{if(d.down||ticks--<=0)return;d.hp=Math.max(0,d.hp-4);popNum(d.g.position.clone().add(new THREE.Vector3(0,2.1,0)),"-4 burn","burn");if(d.hp<=0)damage(d,0,at,false,{chain:true,el});setTimeout(tick,450);};setTimeout(tick,450);}
  else if(el==="water"){FX.burning(d.g,"water",.9,.9);for(let i=0;i<18;i++)SPARK.emit(at.clone().add(rnd3(.3)),new THREE.Vector3(rnd(-.5,.5),rnd(-.5,1),rnd(-.5,.5)),C(0x4cc3ff),rnd(.5,.9),{grav:6});d.mats.forEach(m=>m.color.setHex(0x5a6a7e));setTimeout(()=>d.mats.forEach(m=>m.color.setHex(m.userData.base)),1800);}
  else if(el==="earth"){for(let i=0;i<4;i++){const r=new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(.06,.11)),mat(0x8a6a44));r.position.copy(at);scene.add(r);const v=rnd3(1).normalize().multiplyScalar(rnd(2,4));v.y=Math.abs(v.y)+2;tween(.7,t=>{r.position.copy(at).add(v.clone().multiplyScalar(t)).add(new THREE.Vector3(0,-6*t*t,0));r.rotation.x+=.2;},()=>scene.remove(r));}for(let i=0;i<8;i++)PUFF.emit(at,rnd3(1),C(0x8a7a60).multiplyScalar(.5),.6,{drag:2});shake(.06);}
  else if(el==="air"){for(let i=0;i<14;i++)PUFF.emit(at,rnd3(1).normalize().multiplyScalar(rnd(2,5)),C(0xdff1ff).multiplyScalar(.45),.4,{drag:3});}
  else if(el==="lightning"){let best=null,bd=7;DUMMIES.forEach(x=>{if(x===d||x.down)return;const dist=x.g.position.distanceTo(d.g.position);if(dist<bd){bd=dist;best=x;}});
    if(best){const b=best.g.position.clone().add(new THREE.Vector3(0,1.4,0));setTimeout(()=>{boltLine(at,b,hex);FX.stars(b,"lightning",2,.9);damage(best,Math.round(WEAPONS[G.id].dmg*.6),b,false,{chain:true,el});},80);}
    for(let i=0;i<10;i++)SPARK.emit(at,rnd3(1).normalize().multiplyScalar(rnd(2,5)),C(hex),.25,{drag:2});}}
function popNum(p,text,cls,pic){const v=p.clone().project(cam);if(v.z>1)return;const el=document.createElement("span");el.className=cls||"";el.textContent=text;if(pic)el.insertAdjacentHTML("afterbegin",img(pic,"in"));el.style.left=(v.x+1)/2*innerWidth+"px";el.style.top=(1-v.y)/2*innerHeight+"px";$("#nums").appendChild(el);setTimeout(()=>el.remove(),900);}
// beaten: everything you carry falls where you are (like Minecraft); coins and the house chest stay with you
function dropAll(){const at=P.pos.clone();at.y=0;let n=0;for(let i=0;i<INV.length;i++){const it=INV[i];if(!it)continue;if(it.t==="weapon")it.ammo=null;shareDrop(dropItem(at,it,300));INV[i]=null;n++;}
  G.item=null;select(SEL);invHud();return n;}
function hurt(n){if(P.down||n<=0)return;const at=P.pos.clone().add(new THREE.Vector3(0,2.2,0));
  if(P.invulnT>0){popNum(at,"blocked","spell");return;}
  if(P.shield>0){const a=Math.min(P.shield,n);P.shield-=a;n-=a;popNum(at,"shield -"+a,"spell");if(n<=0)return;}
  if(P.toughT>0)n=Math.max(1,Math.round(n*.75));   // cheese
  P.hp=Math.max(0,P.hp-n);P.lastHit=tAcc;$("#vig").classList.add("on");setTimeout(()=>$("#vig").classList.remove("on"),160);shake(.08);hud();   // no healing by itself: only spells and potions heal
  if(P.hp<=0&&LAW.wanted){P.hp=1;return;}
  if(P.hp<=0){P.down=true;toggleBag(false);const n=dropAll();$("#downMsg").textContent=n?`Everything you carried (${n} ${n===1?"stack":"stacks"}) is lying where you fell — go back for it within 5 minutes. Your coins and your chest are safe.`:"Health is back to full when you come back.";$("#down").classList.remove("hidden");if(document.exitPointerLock)document.exitPointerLock();}}
function respawn(){P.hp=P.maxHp;P.down=false;if(HOME.slept)P.pos.copy(HOME.door);else P.pos.set(0,0,0);P.vel.set(0,0,0);P.shield=P.shieldT=P.invulnT=P.buffT=P.slowT=P.regenT=P.toughT=P.strongT=P.jumpT=P.mightT=0;$("#down").classList.add("hidden");select(SEL);if(held()&&held().t==="weapon")equip(held().id,held());hud();}
function hud(){const w=WEAPONS[G.id];const c=CRYSTALS[G.crystal];const it=held(),f=itemInfo(it);
  $("#wep").classList.toggle("noweap",!(it&&it.t==="weapon"));
  if(it&&it.t==="weapon"){$("#wname").textContent=w.name;$("#ammo").textContent=`${G.ammo} / ${w.mag}`;$("#crys").textContent=`${c.name} crystal · ${c.el}`;$("#crys").style.color="#"+FX.HEX[c.el].toString(16).padStart(6,"0");}
  else{$("#wname").innerHTML=f?`${img(f.pic,"in")} ${esc(f.name)}`:"👊 Fists";$("#ammo").textContent=f?(it.t==="spell"?"●".repeat(Math.min(12,f.count)):"× "+f.count):"—";
    $("#crys").textContent=f?(it.t==="spell"?`${f.what} · click to cast`:it.t==="potion"?(it.id==="fortis"?"click to drink · shared with players near you":"click to drink · +50 HP"):it.t==="food"?`click to eat · ${f.what}`:`${f.what}${f.num?` · number ${f.num}`:""} · craft with E`):"click to punch · rocks break slowly";$("#crys").style.color="";}
  $("#rlbar").style.width=G.reloading?((1-G.reloading/G.reloadT)*100)+"%":"0%";$("#wep").classList.toggle("empty",!!(it&&it.t==="weapon"&&G.ammo===0&&!G.reloading));
  $("#hpn").textContent=Math.round(P.hp)+(P.shield>0?` + 🫧${Math.round(P.shield)}`:"");$("#hpbar").style.width=(100*P.hp/P.maxHp)+"%";$("#hpbar").classList.toggle("low",P.hp<35);}

// ---------------- input ----------------
const keys={};let look={yaw:0,pitch:.22},stick={x:0,y:0},jumpQ=false,runBtn=false,paused=false,started=false,camSide=1;
addEventListener("keydown",e=>{if(e.target&&e.target.matches&&e.target.matches("input,textarea"))return;keys[e.code]=true;if(e.code==="KeyM"){toggleRoom();return;}if(roomOpen&&e.key==="Escape"){toggleRoom(false);return;}if(e.code==="Space"){e.preventDefault();jumpQ=true;}if(e.code==="KeyE"||e.code==="KeyI"||e.code==="Tab"){e.preventDefault();toggleBag();return;}if(e.code==="KeyT"&&!bagOpen){useAct();return;}if(bagOpen){if(e.key==="Escape")toggleBag(false);return;}
  if(e.code==="KeyR")reload();const dg=/^Digit([1-9])$/.exec(e.code);if(dg)select(+dg[1]-1);if(e.code==="KeyQ")cycleCrystal();if(e.code==="KeyG")dropOwn(SEL);if(e.code==="KeyF"){useHeld(true);}if(e.key==="p"||e.key==="P"||(e.key==="Escape"&&!document.pointerLockElement))togglePause();});
addEventListener("wheel",e=>{if(!started||bagOpen||paused)return;select(SEL+(e.deltaY>0?1:-1));},{passive:true});
addEventListener("keyup",e=>{keys[e.code]=false;});
const touch=matchMedia("(pointer:coarse)").matches||"ontouchstart" in window;if(touch)document.body.classList.add("touch");
let dragId=null,lastX=0,lastY=0;
canvas.addEventListener("pointerdown",e=>{if(!started||paused||bagOpen||roomOpen)return;
  if(e.pointerType==="mouse"){if(e.button===0)G.firing=true;if(!document.pointerLockElement&&canvas.requestPointerLock)canvas.requestPointerLock();return;}
  if(e.clientX<innerWidth*.45)return;dragId=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener("pointermove",e=>{if(document.pointerLockElement===canvas){look.yaw-=e.movementX*.0032;look.pitch=clamp(look.pitch+e.movementY*.0025,-.5,1.1);return;}if(e.pointerId!==dragId)return;look.yaw-=(e.clientX-lastX)*.006;look.pitch=clamp(look.pitch+(e.clientY-lastY)*.005,-.5,1.1);lastX=e.clientX;lastY=e.clientY;});
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
function step(dt){const inp=moveInput();P.run=!!(keys.ShiftLeft||keys.ShiftRight||runBtn);
  const s=Math.sin(look.yaw),c=Math.cos(look.yaw);const wx=inp.x*c+inp.z*s,wz=-inp.x*s+inp.z*c;   // forward = away from the camera
  const target=(P.run?RUN:WALK)*inp.l*(P.down?0:1)*(P.buffT>0?1.6:1)*(P.slowT>0?.55:1);const ax=P.onGround?18:6;
  if(P.dash>0)P.dash-=dt;   // a wind leap carries you before your own steering takes over again
  else{P.vel.x+=(wx*target-P.vel.x)*Math.min(1,ax*dt);P.vel.z+=(wz*target-P.vel.z)*Math.min(1,ax*dt);}
  {const want=look.yaw;let d=want-P.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));P.yaw+=d*Math.min(1,14*dt);}   // holding a gun, the body faces where the camera looks
  if(jumpQ&&P.onGround&&!P.down){P.vel.y=JUMP*(P.buffT>0||P.jumpT>0?1.4:1);P.onGround=false;}jumpQ=false;
  P.vel.y-=GRAV*dt;
  const was=P.pos.clone();P.pos.x+=P.vel.x*dt;P.pos.z+=P.vel.z*dt;
  for(const b of BLOCKS){if(b.pass)continue;const ox=(b.w/2+RADIUS)-Math.abs(P.pos.x-b.x),oz=(b.d/2+RADIUS)-Math.abs(P.pos.z-b.z);if(ox<=0||oz<=0)continue;const top=b.y+b.h;if(was.y>=top-.02||P.pos.y>=top-.02)continue;if(P.pos.y+HEIGHT<=b.y)continue;
    if(P.onGround&&top-P.pos.y<=STEP){P.pos.y=top;P.vel.y=0;continue;}   // a low block is a step: walk up onto it
    if(ox<oz){P.pos.x=b.x+Math.sign(P.pos.x-b.x)*(b.w/2+RADIUS);P.vel.x=0;}else{P.pos.z=b.z+Math.sign(P.pos.z-b.z)*(b.d/2+RADIUS);P.vel.z=0;}}
  for(const d of DUMMIES){if(d.down)continue;const dx=P.pos.x-d.g.position.x,dz=P.pos.z-d.g.position.z;const l=Math.hypot(dx,dz);if(l<.75&&P.pos.y<2.2){P.pos.x=d.g.position.x+dx/l*.75;P.pos.z=d.g.position.z+dz/l*.75;}}
  P.pos.y+=P.vel.y*dt;let floor=0;
  for(const b of BLOCKS){if(b.pass)continue;if(Math.abs(P.pos.x-b.x)<b.w/2+RADIUS*.6&&Math.abs(P.pos.z-b.z)<b.d/2+RADIUS*.6){const top=b.y+b.h;if(P.pos.y<=top&&(was.y>=top-.05||(P.onGround&&top-was.y<=STEP)))floor=Math.max(floor,top);}}   // standing on it, or stepping onto it
  if(P.pos.y<=floor){P.pos.y=floor;if(P.vel.y<0)P.vel.y=0;P.onGround=true;}else P.onGround=false;
  const lim=190;P.pos.x=clamp(P.pos.x,-lim,lim);P.pos.z=clamp(P.pos.z,-lim,lim);
  P.speed=Math.hypot(P.vel.x,P.vel.z);
  body.position.copy(P.pos);body.rotation.y=P.yaw;
  // guns
  G.cool=Math.max(0,G.cool-dt);G.recoil=Math.max(0,G.recoil-dt*7);
  if(G.reloading>0){G.reloading-=dt;if(G.reloading<=0){G.reloading=0;G.ammo=WEAPONS[G.id].mag;if(G.item)G.item.ammo=G.ammo;const m=muzzleWorld();FX.stars(m,crystalEl(),2,.5);}hud();}
  if(G.firing){useHeld(!G.firedOnce);G.firedOnce=true;}else G.firedOnce=false;
  if(G.ammo===0&&!G.reloading&&held()&&held().t==="weapon")reload();   // an empty gun reloads by itself
  stepBolts(dt);stepEnemies(dt);stepMagic(dt);stepPickups(dt);stepDummyGuns(dt);stepTown(dt);stepLife(dt);stepMP(dt);
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
  if(!P.onGround)r.base("Jump_Idle");
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
    itemMount.position.copy(gunMount.position).add(new THREE.Vector3(Math.cos(P.yaw)*.6,-.05,-Math.sin(P.yaw)*.6));itemMount.rotation.set(0,P.yaw+.25,0);}}
function floorUnder(){let f=0;for(const b of BLOCKS){if(b.pass)continue;if(Math.abs(P.pos.x-b.x)<b.w/2&&Math.abs(P.pos.z-b.z)<b.d/2&&b.y+b.h<=P.pos.y+.01)f=Math.max(f,b.y+b.h);}return f;}

// ---------------- camera ----------------
const camPos=new THREE.Vector3(0,3,6);
function updateCam(dt){const d=4.2,eye=P.pos.clone().add(new THREE.Vector3(0,1.5,0));const side=new THREE.Vector3(Math.cos(look.yaw),0,-Math.sin(look.yaw)).multiplyScalar(.95*camSide);
  const want=new THREE.Vector3(eye.x+Math.sin(look.yaw)*Math.cos(look.pitch)*d,eye.y+Math.sin(look.pitch)*d,eye.z+Math.cos(look.yaw)*Math.cos(look.pitch)*d).add(side);
  want.y=Math.max(want.y,floorUnder()+.4);
  camPos.lerp(want,1-Math.pow(.0005,dt));cam.position.copy(camPos);if(camShake>0){cam.position.add(rnd3(camShake));camShake=Math.max(0,camShake-dt*.6);}
  const ahead=eye.clone().add(side).add(new THREE.Vector3(-Math.sin(look.yaw)*Math.cos(look.pitch),-Math.sin(look.pitch),-Math.cos(look.yaw)*Math.cos(look.pitch)).multiplyScalar(30));cam.lookAt(ahead);}   // the crosshair is where bullets go
function resize(){R.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();}
addEventListener("resize",resize);resize();
// monster bars are hidden while you are in town, so they don't show through the walls
function placeBars(){DUMMIES.forEach(d=>{const p=d.g.position.clone().add(new THREE.Vector3(0,d.barY||2.45,0)).project(cam);const vis=!d.unbuilt&&p.z<1&&Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1&&d.g.position.distanceTo(P.pos)<45&&!(d.enemy&&inTown(P.pos));d.bar.style.display=vis?"":"none";if(!vis)return;
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
let bagOpen=false,bagTab="items",bagPick=-1,forgeId=CRAFT.RECIPES[0].id,tray={},forgeMsg="",forgeOk=false;
const DRAWS={};const recipe=id=>CRAFT.RECIPES.find(r=>r.id===id);const drawFor=id=>DRAWS[id]||(DRAWS[id]=CRAFT.draw(recipe(id),MATH.lv));
const CTX_TABS={contest:"🏆 Contest",market:"🪙 Market",food:"🍞 Food",chest:"📦 Chest",build:"🔨 Build",quest:"📜 Help",work:"🔨 Job"};
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
  if(bagTab==="food"){const near=P.pos.distanceTo(COOK.pos)<4.5;let h=`<p class="purse">🪙 <b>${COINS}</b> denarii</p>`;
    if(!near){box.innerHTML=h+`<p class="tip">The Popina 🍞 (the cook's stall) is on the west side of town. Walk up to it to buy food.</p>`;return;}
    h+=`<p class="tip">Food heals a little, and some give you a boost for a while. Eat it from your hotbar (click / FIRE).</p><div class="list">`;
    Object.entries(FOODS).forEach(([id,f])=>{h+=`<button data-food="${id}" class="${COINS<f.price?"poor":""}">${foodIco(id)} <span>${esc(f.name)} <small>${esc(f.what)}</small></span><b>${f.price} 🪙</b></button>`;});
    box.innerHTML=h+`</div><p class="msg ${forgeOk?"ok":""}">${esc(forgeMsg)}</p>`;return;}
  if(bagTab==="chest"){if(P.pos.distanceTo(HOME.chest)>3){box.innerHTML=`<p class="tip">Your chest 📦 is in your house — the one with your name over the door, in the row along the north wall.</p>`;return;}
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
$("#bagBody").addEventListener("click",e=>{const t=e.target.closest("[data-slot],[data-rec],[data-mat],[data-tray],[data-sell],[data-buy],[data-food],[data-tochest],[data-fromchest],[data-drop],[data-book],[data-tier],#conGo,#conNew,[data-haggle],[data-hsell],#hagGo,#hagNo,#workGo,#forgeGo,#buildGo,#qAccept,#qHand");if(!t)return;
  if(t.dataset.slot!==undefined){const i=+t.dataset.slot;if(bagPick<0){if(INV[i])bagPick=i;}else{const a=INV[bagPick];INV[bagPick]=INV[i];INV[i]=a;bagPick=-1;select(SEL);}renderBag();return;}
  if(t.dataset.book){setBook(t.dataset.book);forgeMsg=t.dataset.book==="china"?"📚 China standard: the problems now follow what Chinese schools teach in each grade.":"📚 US math book.";forgeOk=true;renderBag();return;}
  if(t.dataset.tier){contestNew(t.dataset.tier);renderBag();return;}
  if(t.id==="conNew"){contestNew();renderBag();return;}
  if(t.id==="conGo"){const i=$("#conIn"),w=$("#conWhy");CONTEST.ans=i?i.value:"";CONTEST.draft=w?w.value:"";const r=contestAnswer(i&&i.value!==""?parseInt(i.value,10):null,CONTEST.draft);CONTEST.ok=r.ok;CONTEST.msg=r.msg;renderBag();return;}
  if(t.dataset.drop!==undefined){dropOwn(+t.dataset.drop);bagPick=-1;renderBag();return;}
  if(t.dataset.rec){forgeId=t.dataset.rec;tray={};forgeMsg="";renderBag();return;}
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
  if(t.id==="forgeGo")forgeNow();});
$("#bagBody").addEventListener("keydown",e=>{if(e.key!=="Enter"||!e.target.matches("input"))return;e.preventDefault();if(e.target.matches("textarea"))return;const b=$("#hagGo")||$("#workGo")||$("#buildGo")||$("#conGo");if(b)b.click();});
$("#bagBody").addEventListener("input",e=>{if(e.target.id==="conWhy")CONTEST.draft=e.target.value;if(e.target.id==="conIn")CONTEST.ans=e.target.value;});
document.querySelectorAll("#bag .tabs button[data-tab]").forEach(b=>b.addEventListener("click",()=>{bagTab=b.dataset.tab;bagPick=-1;renderBag();}));
$("#bagClose").addEventListener("click",()=>toggleBag(false));
$("#online").addEventListener("click",()=>toggleRoom());$("#roomClose").addEventListener("click",()=>toggleRoom(false));
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
  if(started&&!paused&&!bagOpen)step(dt);else animate(dt);SPARK.step(dt);PUFF.step(dt);FX.step(dt);updateCam(dt);placeBars();
  $("#pos").textContent=`x ${P.pos.x.toFixed(1)}  y ${P.pos.y.toFixed(1)}  z ${P.pos.z.toFixed(1)}${P.run?"  run":""}`;R.render(scene,cam);}
WORLD.STATIC=BLOCKS.length;
frame();
window.__el={dropOwn,WORLD,share,applyEv,applyKey,hitPlayer,LAW,PEOPLE,JAIL,MARKS,hurtPerson,jail,scorch,CONTEST,contestNew,contestAnswer,setBook,howToGet,canAdd,workNow,haggle,haggleBuy,haggleSell,get HAG(){return HAG},trainPlan,buildTraining,cottageState,newQuest,set QW(v){QW=v},HOUSES,TREES,VILLAGERS,QUESTS,toggleLock,setHouses,chopHit,questTurnIn,setRoom,toggleRoom,newRoom,joinRoom,drinkFortis,useAct,FOODS,CHEST,HOME,TRAIN,MP,inTraining,SPELLS,INV,addItem,select,useHeld,get SEL(){return SEL},castSpell,castAs,dropItem,PICKUPS,NODES,ENEMIES,mineHit,toggleBag,CRAFT,DRAWS,drawFor,get tray(){return tray},set tray(v){tray=v},forgeNow,get forgeMsg(){return forgeMsg},set forgeId(v){forgeId=v},get bagOpen(){return bagOpen},get RIG(){return RIG},get COINS(){return COINS},set COINS(v){COINS=v;coinHud();},sell,buy,get OFFERS(){return OFFERS},MATH,inTown,DSHOTS,P,G,look,keys,WEAPONS,DUMMIES,CRYSTALS,cycleCrystal,get started(){return started},start(){$("#startBtn").click();},jump(){jumpQ=true;},setStick(x,y){stick.x=x;stick.y=y;},fire,reload,equip,hurt,blocks:BLOCKS,scene,cam};
})();
