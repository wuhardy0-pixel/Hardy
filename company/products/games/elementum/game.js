// Elementum — step 1: a body that moves in a gray 3D world; step 2: guns, a shooting range, health bars.
// Three.js r158 (vendored as three.min.js). Third-person: the camera orbits behind the body, the body aims
// where the camera looks. Keyboard + mouse on a computer, joystick + drag + buttons on a phone. Test hooks: window.__el.
(function(){
const $=s=>document.querySelector(s);
const canvas=$("#gl");
const R=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
R.setPixelRatio(Math.min(2,window.devicePixelRatio||1));R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
if("outputColorSpace" in R)R.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();const GRAY=new THREE.Color(0x8e8e90);scene.background=GRAY;scene.fog=new THREE.Fog(GRAY,40,140);
const cam=new THREE.PerspectiveCamera(60,1,.1,300);
FX.init(scene,cam);   // the ported Binbun3D effects (fx.js)
scene.add(new THREE.HemisphereLight(0xdedee2,0x55555a,.9));
const sun=new THREE.DirectionalLight(0xffffff,1.4);sun.position.set(18,30,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:120});scene.add(sun);
const mat=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.85,metalness:.02},o||{}));
const glow=(c,i)=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:i||1,roughness:.3});
const rnd=(a,b)=>a+Math.random()*(b-a);const rnd3=k=>new THREE.Vector3(rnd(-k,k),rnd(-k,k),rnd(-k,k));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let tweens=[];function tween(dur,fn,done){tweens.push({t:0,dur,fn,done});}
let tAcc=0;

// ---------------- the gray world ----------------
const ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),mat(0x9a9a9c));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(400,200,0x6d6d70,0x7f7f82);grid.position.y=.01;grid.material.opacity=.35;grid.material.transparent=true;scene.add(grid);
const BLOCKS=[];const SOLIDS=[ground];// axis-aligned boxes the body can bump into and climb onto: {x,y,z,w,h,d}
function block(x,z,w,h,d,shade){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(shade||0xa6a6a9));m.position.set(x,h/2,z);m.castShadow=m.receiveShadow=true;scene.add(m);BLOCKS.push({x,y:0,z,w,h,d,mesh:m});SOLIDS.push(m);return m;}
block(6,-4,3,.5,3,0xb0b0b3);block(9,-4,3,1,3,0xa8a8ab);block(12,-4,3,1.5,3,0xa0a0a3);block(15,-4,3,2,3,0x98989b);block(19,-4,5,2.5,5,0x909093);
block(-8,6,6,2.2,1,0xa4a4a7);block(-8,10,1,2.2,8,0xa4a4a7);
block(-6,-9,2,1.1,2,0xb4b4b7);block(-10,-12,2,2.4,2,0x9c9c9f);block(2,12,8,.4,8,0xb8b8bb);
block(0,-30,1.2,6,1.2,0x8a8a8d);block(-20,0,1.2,6,1.2,0x8a8a8d);block(20,14,1.2,6,1.2,0x8a8a8d);block(-16,-22,1.2,6,1.2,0x8a8a8d);
for(let i=0;i<14;i++){const a=i/14*Math.PI*2;block(Math.cos(a)*34,Math.sin(a)*34,2,1+(i%3),2,0x9d9da0);}
// the shooting range: a low wall behind the dummies so shots have something to hit
block(0,-24,22,2.6,1,0x7e7e82);

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
function flash(p,hex,power,dur){const l=new THREE.PointLight(hex,power||3,7);l.position.copy(p);scene.add(l);tween(dur||.12,t=>{l.intensity=(power||3)*(1-t);},()=>scene.remove(l));}
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
const skin=mat(0xe9e9ec),cloth=mat(0x5a5a60),dark=mat(0x2f2f34);
const hips=new THREE.Group();hips.position.y=.95;body.add(hips);
const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.24,.5,6,14),cloth);torso.position.y=.42;torso.castShadow=true;hips.add(torso);
const head=new THREE.Mesh(new THREE.SphereGeometry(.2,18,14),skin);head.position.y=.98;head.castShadow=true;hips.add(head);
const eyeM=mat(0x202024);[-.07,.07].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.03,8,8),eyeM);e.position.set(x,1.02,-.17);hips.add(e);});
function limb(len,r,m){const g=new THREE.Group();const c=new THREE.Mesh(new THREE.CapsuleGeometry(r,len-2*r,4,10),m);c.position.y=-len/2;c.castShadow=true;g.add(c);return g;}
const armL=limb(.62,.07,skin),armR=limb(.62,.07,skin);armL.position.set(-.33,.72,0);armR.position.set(.33,.72,0);hips.add(armL,armR);
const legL=limb(.9,.09,dark),legR=limb(.9,.09,dark);legL.position.set(-.13,0,0);legR.position.set(.13,0,0);hips.add(legL,legR);
const shadowDisc=new THREE.Mesh(new THREE.CircleGeometry(.35,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.18,depthWrite:false}));shadowDisc.rotation.x=-Math.PI/2;shadowDisc.position.y=.015;body.add(shadowDisc);
const P={pos:new THREE.Vector3(0,0,0),vel:new THREE.Vector3(),yaw:0,onGround:true,run:false,phase:0,speed:0,hp:100,maxHp:100,lastHit:-99,down:false,downed:0};
const RADIUS=.35,HEIGHT=1.8,WALK=4.2,RUN=7.5,JUMP=7.2,GRAV=22,STEP=.6;

// ---------------- guns ----------------
// the three weapon types from the design document, in gray-world form
const WEAPONS={
  rifle:{name:"Magna Rifle",dmg:24,head:1.5,rate:9,mag:30,reload:1.6,spread:.012,auto:true,range:90,hex:0xffd27a,kick:.004,flash:.5},
  shotgun:{name:"Chaos Shotgun",dmg:9,pellets:10,head:1.5,rate:1.2,mag:6,reload:2.1,spread:.07,auto:false,range:18,hex:0xffb060,kick:.025,flash:.8},
  staff:{name:"Orator Staff",dmg:110,head:1,rate:.7,mag:4,reload:2.3,spread:0,auto:false,range:120,hex:0x8fd4ff,kick:.012,flash:.6,projectile:true},
};
// elemental crystals from the design document: the crystal in the gun decides the element every shot carries
const CRYSTALS={carbo:{name:"Carbo",el:"fire",status:"burn"},nimbus:{name:"Nimbus",el:"water",status:"soak"},silex:{name:"Silex",el:"earth",status:"weight"},aether:{name:"Aether",el:"air",status:"stagger"},electrum:{name:"Electrum",el:"lightning",status:"charge"}};
const G={id:"rifle",crystal:"carbo",ammo:30,reloading:0,reloadT:1,cool:0,recoil:0,firing:false,firedOnce:false,mesh:null};
const crystalEl=()=>CRYSTALS[G.crystal].el;
function cycleCrystal(){const ids=Object.keys(CRYSTALS);G.crystal=ids[(ids.indexOf(G.crystal)+1)%ids.length];tintGun();hud();if(G.mesh){const m=muzzleWorld();FX.stars(m,crystalEl(),3,.6);FX.flare(m,new THREE.Vector3(0,1,0),crystalEl(),.5,.3);}}
function tintGun(){if(!G.mesh)return;const hex=FX.HEX[crystalEl()];G.mesh.traverse(o=>{if(o.userData.crystal){o.material.color.setHex(hex);o.material.emissive.setHex(hex);}if(o.isPointLight)o.color.setHex(hex);});}
function gunModel(id){const g=new THREE.Group();const m=mat(0x3a3a40,{metalness:.35,roughness:.5}),m2=mat(0x58585e,{metalness:.3,roughness:.6});
  if(id==="rifle"){const b=new THREE.Mesh(new THREE.BoxGeometry(.07,.5,.12),m);b.position.y=-.2;g.add(b);const br=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.42,10),m2);br.position.set(0,-.62,-.02);g.add(br);const st=new THREE.Mesh(new THREE.BoxGeometry(.06,.18,.09),m2);st.position.set(0,.06,.03);g.add(st);const mag=new THREE.Mesh(new THREE.BoxGeometry(.05,.16,.06),m2);mag.position.set(0,-.22,.1);g.add(mag);g.userData.mag=mag;const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.045),glow(0xff7b3a,1.4));gem.position.set(0,-.3,-.09);gem.userData.crystal=true;g.add(gem);g.userData.muzzle=new THREE.Vector3(0,-.84,-.02);}
  else if(id==="shotgun"){const b=new THREE.Mesh(new THREE.BoxGeometry(.08,.42,.12),m);b.position.y=-.16;g.add(b);const br=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.5,10),m2);br.position.set(0,-.6,-.03);g.add(br);const br2=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.46,10),m2);br2.position.set(0,-.58,.03);g.add(br2);const pump=new THREE.Mesh(new THREE.BoxGeometry(.06,.14,.07),mat(0x6b4a2a));pump.position.set(0,-.5,0);g.add(pump);g.userData.mag=pump;const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.05),glow(0xff7b3a,1.4));gem.position.set(0,-.28,-.1);gem.userData.crystal=true;g.add(gem);g.userData.muzzle=new THREE.Vector3(0,-.86,-.03);}
  else{const rod=new THREE.Mesh(new THREE.CylinderGeometry(.02,.025,1.1,10),mat(0x6b4a2a));rod.position.y=-.35;g.add(rod);const orb=new THREE.Mesh(new THREE.SphereGeometry(.07,14,12),glow(0x8fd4ff,1.6));orb.position.y=-.95;orb.userData.crystal=true;g.add(orb);const l=new THREE.PointLight(0x8fd4ff,.6,2.5);orb.add(l);g.userData.mag=orb;g.userData.muzzle=new THREE.Vector3(0,-1.0,0);}
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
function equip(id){if(G.mesh)armR.remove(G.mesh);G.id=id;G.mesh=gunModel(id);G.mesh.position.set(0,-.6,0);armR.add(G.mesh);G.ammo=WEAPONS[id].mag;G.reloading=0;G.cool=0;$("#wname").textContent=WEAPONS[id].name;tintGun();hud();}
function muzzleWorld(){const v=G.mesh.userData.muzzle.clone();return G.mesh.localToWorld(v);}
function aimRay(spread){const r=new THREE.Raycaster();r.setFromCamera({x:0,y:0},cam);const d=r.ray.direction.clone();if(spread){d.add(rnd3(spread)).normalize();}r.ray.direction.copy(d);r.far=WEAPONS[G.id].range;
  r.ray.origin.add(d.clone().multiplyScalar(1.2));return r;}   // start a little in front of the camera so the body itself is never hit
function reload(){const w=WEAPONS[G.id];if(G.reloading||G.ammo===w.mag)return;G.reloading=w.reload;G.reloadT=w.reload;}
function fire(){const w=WEAPONS[G.id];if(G.cool>0||G.reloading||P.down||!started||paused)return;if(G.ammo<=0){reload();return;}
  const el=crystalEl(),hex=FX.HEX[el];
  G.ammo--;G.cool=1/w.rate;G.recoil=1;look.pitch=clamp(look.pitch-w.kick,-.5,1.1);shake(w.kick*2.5);
  const m=muzzleWorld();const d0=aimRay(0).ray.direction.clone();muzzle(m,d0,hex,w.flash);FX.flare(m,d0,el,w.flash*1.3,.22);FX.stars(m,el,1,w.flash*.9);
  if(w.projectile){const r=aimRay(0);const hit=r.intersectObjects(hitTargets(),false)[0];const to=hit?hit.point:r.ray.at(w.range,new THREE.Vector3());bolt(m,to.clone().sub(m).normalize(),el);hud();return;}
  const n=w.pellets||1;for(let i=0;i<n;i++){const r=aimRay(w.spread);const hit=r.intersectObjects(hitTargets(),false)[0];const to=hit?hit.point:r.ray.at(w.range,new THREE.Vector3());tracer(m,to,hex);
    if(hit){const dm=hit.object.userData.dummy;if(dm){const headshot=hit.object.userData.part==="head";damage(dm,Math.round(w.dmg*(headshot?w.head:1)),hit.point,headshot,{el});}
      else{sparks(hit.point,8,hex,hit.face?hit.face.normal.clone().transformDirection(hit.object.matrixWorld):null);FX.impact(hit.point,el,.45);if(i===0)FX.stars(hit.point,el,1,.5);}}}
  hud();}
// the staff fires a slow glowing bolt that explodes where it lands
const BOLTS=[];
function bolt(from,dir,el){const g=FX.comet(el||"lightning",1.5);g.position.copy(from);g.userData.aim(dir);scene.add(g);BOLTS.push({g,dir:dir.clone(),speed:26,life:3,el:el||"lightning"});}
function explode(p,el){const hex=FX.HEX[el];ring(p,hex,6);FX.impact(p,el,3.2);FX.stars(p,el,4,2.2);flash(p,hex,8,.35);shake(.12);
  for(let i=0;i<60;i++)SPARK.emit(p,rnd3(1).normalize().multiplyScalar(rnd(3,9)),Math.random()<.5?C(hex):C(0xffffff),rnd(.3,.7),{grav:6,drag:1.2});for(let i=0;i<10;i++)PUFF.emit(p,rnd3(1.5),C(hex).multiplyScalar(.5),.5,{drag:2});
  DUMMIES.forEach(d=>{const dist=d.g.position.distanceTo(p);if(dist<3.2&&!d.down)damage(d,Math.round(WEAPONS.staff.dmg*(1-dist/3.2)*.9+10),d.g.position.clone().add(new THREE.Vector3(0,1.4,0)),false,{el,area:true});});}
function stepBolts(dt){for(let i=BOLTS.length-1;i>=0;i--){const b=BOLTS[i];b.g.position.add(b.dir.clone().multiplyScalar(b.speed*dt));b.life-=dt;SPARK.emit(b.g.position,rnd3(.6),C(FX.HEX[b.el]),.3);
    let hit=b.g.position.y<=0.05||b.life<=0;if(!hit)for(const d of DUMMIES){if(!d.down&&d.g.position.clone().add(new THREE.Vector3(0,1.3,0)).distanceTo(b.g.position)<.75){hit=true;break;}}
    if(!hit)for(const bl of BLOCKS){if(Math.abs(b.g.position.x-bl.x)<bl.w/2&&Math.abs(b.g.position.z-bl.z)<bl.d/2&&b.g.position.y<bl.y+bl.h){hit=true;break;}}
    if(hit){explode(b.g.position.clone(),b.el);b.g.userData.dispose();BOLTS.splice(i,1);}}}
// a jagged lightning line between two points (Electrum chains)
function boltLine(a,b,hex){const lines=[];for(let k=0;k<3;k++){const pts=[];const n=9;for(let i=0;i<=n;i++){const p=a.clone().lerp(b,i/n);if(i>0&&i<n)p.add(rnd3(.2));pts.push(p);}
  const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:k===0?0xffffff:hex,transparent:true,opacity:1,blending:THREE.AdditiveBlending}));scene.add(l);lines.push(l);}
  tween(.25,t=>{lines.forEach((l,i)=>{l.visible=Math.sin(t*40+i)>-.3;l.material.opacity=1-t;});},()=>lines.forEach(l=>scene.remove(l)));flash(b,hex,4,.2);}

// ---------------- the range: dummies with health bars, and a turret that shoots back ----------------
const DUMMIES=[];
function dummy(x,z,name){const g=new THREE.Group();g.position.set(x,0,z);const post=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,.9,8),mat(0x6b6b70));post.position.y=.45;g.add(post);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.4,.45,.1,16),mat(0x7a7a7e));base.position.y=.05;g.add(base);
  const bm=mat(0x8a7a6e),hm=mat(0x9a8a7e);const bodyM=new THREE.Mesh(new THREE.CapsuleGeometry(.28,.7,6,14),bm);bodyM.position.y=1.35;g.add(bodyM);const headM=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),hm);headM.position.y=2.0;g.add(headM);
  const tgt=new THREE.Mesh(new THREE.RingGeometry(.08,.14,24),mat(0xc0392b));tgt.position.set(0,1.35,-.3);g.add(tgt);const tgt2=new THREE.Mesh(new THREE.CircleGeometry(.05,16),mat(0xc0392b));tgt2.position.set(0,1.35,-.31);g.add(tgt2);
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;}});scene.add(g);
  const d={g,name,hp:100,max:100,down:false,parts:[bodyM,headM,tgt,tgt2],mats:[bm,hm],bar:null};bodyM.userData={dummy:d,part:"body"};headM.userData={dummy:d,part:"head"};tgt.userData={dummy:d,part:"body"};tgt2.userData={dummy:d,part:"body"};
  const bar=document.createElement("div");bar.className="dbar";bar.innerHTML=`<span>${name}</span><div><i></i></div>`;$("#bars").appendChild(bar);d.bar=bar;d.barI=bar.querySelector("i");d.barS=bar.querySelector("span");
  DUMMIES.push(d);return d;}
[[-6,-14,"Dummy A"],[-3,-16,"Dummy B"],[0,-15,"Dummy C"],[3,-16,"Dummy D"],[6,-14,"Dummy E"],[0,-9,"Dummy F (close)"]].forEach(([x,z,n])=>dummy(x,z,n));
// the turret: a gray box on a post that lobs slow orbs at you when you are near, so your own health bar gets used
const turret={mesh:null,cool:2,orbs:[]};
{const g=new THREE.Group();g.position.set(10,0,-18);const post=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,1.4,10),mat(0x6b6b70));post.position.y=.7;g.add(post);const box=new THREE.Mesh(new THREE.BoxGeometry(.7,.5,.7),mat(0x55555a));box.position.y=1.65;g.add(box);const eye=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),glow(0xff4040,1.5));eye.position.set(0,1.65,-.38);g.add(eye);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(g);turret.mesh=box;turret.g=g;turret.eye=eye;}
function hitTargets(){const t=[...SOLIDS,turret.mesh];DUMMIES.forEach(d=>{if(!d.down)t.push(...d.parts);});return t;}
function damage(d,n,at,headshot,o){o=o||{};if(d.down)return;const el=o.el||"plain",hex=FX.HEX[el];d.hp=Math.max(0,d.hp-n);popNum(at,(headshot?"HEAD ":"")+"-"+n,headshot?"head":"");sparks(at,12,hex);
  if(!o.area){FX.impact(at,el,headshot?1.0:.7);FX.stars(at,el,headshot?3:2,.9);}
  $("#xh").classList.add("hit");setTimeout(()=>$("#xh").classList.remove("hit"),90);
  d.mats.forEach(m=>{m.emissive.setHex(hex);m.emissiveIntensity=.8;});setTimeout(()=>d.mats.forEach(m=>m.emissiveIntensity=0),120);
  const kick=o.el==="air"?.45:.18;const r0=d.g.rotation.z;tween(.25,t=>{d.g.rotation.z=r0+Math.sin(t*Math.PI)*kick*(at.x<d.g.position.x?1:-1);},()=>{d.g.rotation.z=r0;});
  if(!o.chain)status(d,el,at);
  if(d.hp<=0){d.down=true;P.downed++;$("#sub").textContent=`the shooting range · dummies downed: ${P.downed}`;tween(.45,t=>{d.g.rotation.x=-t*t*Math.PI/2;},()=>{setTimeout(()=>{d.hp=d.max;tween(.4,t=>{d.g.rotation.x=-(1-t)*Math.PI/2;},()=>{d.down=false;d.g.rotation.x=0;});},3000);});}}
// what the crystal does on a hit, beyond the damage
function status(d,el,at){const hex=FX.HEX[el];
  if(el==="fire"){FX.burning(d.g,"fire",1.5,1.1);let ticks=3;const tick=()=>{if(d.down||ticks--<=0)return;d.hp=Math.max(0,d.hp-4);popNum(d.g.position.clone().add(new THREE.Vector3(0,2.1,0)),"-4 burn","burn");if(d.hp<=0)damage(d,0,at,false,{chain:true,el});setTimeout(tick,450);};setTimeout(tick,450);}
  else if(el==="water"){FX.burning(d.g,"water",.9,.9);for(let i=0;i<18;i++)SPARK.emit(at.clone().add(rnd3(.3)),new THREE.Vector3(rnd(-.5,.5),rnd(-.5,1),rnd(-.5,.5)),C(0x4cc3ff),rnd(.5,.9),{grav:6});d.mats.forEach(m=>m.color.setHex(0x5a6a7e));setTimeout(()=>d.mats.forEach((m,i)=>m.color.setHex(i?0x9a8a7e:0x8a7a6e)),1800);}
  else if(el==="earth"){for(let i=0;i<4;i++){const r=new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(.06,.11)),mat(0x8a6a44));r.position.copy(at);scene.add(r);const v=rnd3(1).normalize().multiplyScalar(rnd(2,4));v.y=Math.abs(v.y)+2;tween(.7,t=>{r.position.copy(at).add(v.clone().multiplyScalar(t)).add(new THREE.Vector3(0,-6*t*t,0));r.rotation.x+=.2;},()=>scene.remove(r));}for(let i=0;i<8;i++)PUFF.emit(at,rnd3(1),C(0x8a7a60).multiplyScalar(.5),.6,{drag:2});shake(.06);}
  else if(el==="air"){for(let i=0;i<14;i++)PUFF.emit(at,rnd3(1).normalize().multiplyScalar(rnd(2,5)),C(0xdff1ff).multiplyScalar(.45),.4,{drag:3});}
  else if(el==="lightning"){let best=null,bd=7;DUMMIES.forEach(x=>{if(x===d||x.down)return;const dist=x.g.position.distanceTo(d.g.position);if(dist<bd){bd=dist;best=x;}});
    if(best){const b=best.g.position.clone().add(new THREE.Vector3(0,1.4,0));setTimeout(()=>{boltLine(at,b,hex);FX.stars(b,"lightning",2,.9);damage(best,Math.round(WEAPONS[G.id].dmg*.6),b,false,{chain:true,el});},80);}
    for(let i=0;i<10;i++)SPARK.emit(at,rnd3(1).normalize().multiplyScalar(rnd(2,5)),C(hex),.25,{drag:2});}}
function popNum(p,text,cls){const v=p.clone().project(cam);if(v.z>1)return;const el=document.createElement("span");el.className=cls||"";el.textContent=text;el.style.left=(v.x+1)/2*innerWidth+"px";el.style.top=(1-v.y)/2*innerHeight+"px";$("#nums").appendChild(el);setTimeout(()=>el.remove(),900);}
function stepTurret(dt){const me=P.pos.clone().add(new THREE.Vector3(0,1.3,0));const from=turret.g.position.clone().add(new THREE.Vector3(0,1.65,0));const dist=from.distanceTo(me);
  turret.g.rotation.y=Math.atan2(me.x-from.x,me.z-from.z)+Math.PI;
  turret.cool-=dt;if(dist<22&&turret.cool<=0&&!P.down){turret.cool=2.4;const dir=me.clone().sub(from).normalize();const s=FX.comet("red",1.0);s.position.copy(from);s.userData.aim(dir);scene.add(s);turret.orbs.push({m:s,dir,life:4});muzzle(from,dir,0xff6060,.5);FX.flare(from,dir,"red",.8,.25);}
  for(let i=turret.orbs.length-1;i>=0;i--){const o=turret.orbs[i];o.m.position.add(o.dir.clone().multiplyScalar(14*dt));o.life-=dt;SPARK.emit(o.m.position,rnd3(.3),C(0xff6060),.2);
    const hit=o.m.position.distanceTo(P.pos.clone().add(new THREE.Vector3(0,1.1,0)))<.8;if(hit||o.life<=0||o.m.position.y<0){if(hit)hurt(8);sparks(o.m.position,12,0xff6060);FX.impact(o.m.position,"red",1.0);FX.stars(o.m.position,"red",2,1);o.m.userData.dispose();turret.orbs.splice(i,1);}}}
function hurt(n){if(P.down)return;P.hp=Math.max(0,P.hp-n);P.lastHit=tAcc;$("#vig").classList.add("on");setTimeout(()=>$("#vig").classList.remove("on"),160);shake(.08);hud();
  if(P.hp<=0){P.down=true;$("#down").classList.remove("hidden");if(document.exitPointerLock)document.exitPointerLock();}}
function respawn(){P.hp=P.maxHp;P.down=false;P.pos.set(0,0,0);P.vel.set(0,0,0);$("#down").classList.add("hidden");equip(G.id);hud();}
function hud(){const w=WEAPONS[G.id];const c=CRYSTALS[G.crystal];$("#crys").textContent=`${c.name} crystal · ${c.el}`;$("#crys").style.color="#"+FX.HEX[c.el].toString(16).padStart(6,"0");$("#ammo").textContent=`${G.ammo} / ${w.mag}`;$("#rlbar").style.width=G.reloading?((1-G.reloading/G.reloadT)*100)+"%":"0%";$("#wep").classList.toggle("empty",G.ammo===0&&!G.reloading);
  $("#hpn").textContent=Math.round(P.hp);$("#hpbar").style.width=(100*P.hp/P.maxHp)+"%";$("#hpbar").classList.toggle("low",P.hp<35);}

// ---------------- input ----------------
const keys={};let look={yaw:0,pitch:.22},stick={x:0,y:0},jumpQ=false,runBtn=false,paused=false,started=false,camSide=1;
addEventListener("keydown",e=>{keys[e.code]=true;if(e.code==="Space"){e.preventDefault();jumpQ=true;}if(e.code==="KeyR")reload();if(e.code==="Digit1")equip("rifle");if(e.code==="Digit2")equip("shotgun");if(e.code==="Digit3")equip("staff");if(e.code==="KeyQ")cycleCrystal();if(e.key==="p"||e.key==="P"||(e.key==="Escape"&&!document.pointerLockElement))togglePause();});
addEventListener("keyup",e=>{keys[e.code]=false;});
const touch=matchMedia("(pointer:coarse)").matches||"ontouchstart" in window;if(touch)document.body.classList.add("touch");
let dragId=null,lastX=0,lastY=0;
canvas.addEventListener("pointerdown",e=>{if(!started||paused)return;
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
$("#wswitch").addEventListener("pointerdown",e=>{e.preventDefault();const ids=Object.keys(WEAPONS);equip(ids[(ids.indexOf(G.id)+1)%ids.length]);});
$("#cswitch").addEventListener("pointerdown",e=>{e.preventDefault();cycleCrystal();});
$("#camBtn").onclick=()=>{camSide=-camSide;};

// ---------------- movement + collision ----------------
function moveInput(){let x=0,z=0;if(keys.KeyW||keys.ArrowUp)z-=1;if(keys.KeyS||keys.ArrowDown)z+=1;if(keys.KeyA||keys.ArrowLeft)x-=1;if(keys.KeyD||keys.ArrowRight)x+=1;
  if(stick.x||stick.y){x=stick.x;z=stick.y;}const l=Math.hypot(x,z);if(l>1){x/=l;z/=l;}return{x,z,l:Math.min(1,l)};}
function step(dt){const inp=moveInput();P.run=!!(keys.ShiftLeft||keys.ShiftRight||runBtn);
  const s=Math.sin(look.yaw),c=Math.cos(look.yaw);const wx=inp.x*c+inp.z*s,wz=-inp.x*s+inp.z*c;   // forward = away from the camera
  const target=(P.run?RUN:WALK)*inp.l*(P.down?0:1);const ax=P.onGround?18:6;
  P.vel.x+=(wx*target-P.vel.x)*Math.min(1,ax*dt);P.vel.z+=(wz*target-P.vel.z)*Math.min(1,ax*dt);
  {const want=look.yaw;let d=want-P.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));P.yaw+=d*Math.min(1,14*dt);}   // holding a gun, the body faces where the camera looks
  if(jumpQ&&P.onGround&&!P.down){P.vel.y=JUMP;P.onGround=false;}jumpQ=false;
  P.vel.y-=GRAV*dt;
  const was=P.pos.clone();P.pos.x+=P.vel.x*dt;P.pos.z+=P.vel.z*dt;
  for(const b of BLOCKS){const ox=(b.w/2+RADIUS)-Math.abs(P.pos.x-b.x),oz=(b.d/2+RADIUS)-Math.abs(P.pos.z-b.z);if(ox<=0||oz<=0)continue;const top=b.y+b.h;if(was.y>=top-.02||P.pos.y>=top-.02)continue;if(P.pos.y+HEIGHT<=b.y)continue;
    if(P.onGround&&top-P.pos.y<=STEP){P.pos.y=top;P.vel.y=0;continue;}   // a low block is a step: walk up onto it
    if(ox<oz){P.pos.x=b.x+Math.sign(P.pos.x-b.x)*(b.w/2+RADIUS);P.vel.x=0;}else{P.pos.z=b.z+Math.sign(P.pos.z-b.z)*(b.d/2+RADIUS);P.vel.z=0;}}
  for(const d of DUMMIES){if(d.down)continue;const dx=P.pos.x-d.g.position.x,dz=P.pos.z-d.g.position.z;const l=Math.hypot(dx,dz);if(l<.75&&P.pos.y<2.2){P.pos.x=d.g.position.x+dx/l*.75;P.pos.z=d.g.position.z+dz/l*.75;}}
  P.pos.y+=P.vel.y*dt;let floor=0;
  for(const b of BLOCKS){if(Math.abs(P.pos.x-b.x)<b.w/2+RADIUS*.6&&Math.abs(P.pos.z-b.z)<b.d/2+RADIUS*.6){const top=b.y+b.h;if(P.pos.y<=top&&(was.y>=top-.05||(P.onGround&&top-was.y<=STEP)))floor=Math.max(floor,top);}}   // standing on it, or stepping onto it
  if(P.pos.y<=floor){P.pos.y=floor;if(P.vel.y<0)P.vel.y=0;P.onGround=true;}else P.onGround=false;
  const lim=190;P.pos.x=clamp(P.pos.x,-lim,lim);P.pos.z=clamp(P.pos.z,-lim,lim);
  P.speed=Math.hypot(P.vel.x,P.vel.z);
  body.position.copy(P.pos);body.rotation.y=P.yaw;
  // guns
  G.cool=Math.max(0,G.cool-dt);G.recoil=Math.max(0,G.recoil-dt*7);
  if(G.reloading>0){G.reloading-=dt;if(G.reloading<=0){G.reloading=0;G.ammo=WEAPONS[G.id].mag;const m=muzzleWorld();FX.stars(m,crystalEl(),2,.5);}hud();}
  if(G.firing){if(WEAPONS[G.id].auto||!G.firedOnce){fire();G.firedOnce=true;}}else G.firedOnce=false;
  if(G.ammo===0&&!G.reloading)reload();   // an empty gun reloads by itself
  stepBolts(dt);stepTurret(dt);
  if(tAcc-P.lastHit>4&&P.hp<P.maxHp&&!P.down){P.hp=Math.min(P.maxHp,P.hp+6*dt);hud();}
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
  if(G.mesh){G.mesh.rotation.z=rlSwing*.5;G.mesh.position.y=-.6+G.recoil*.06;const mg=G.mesh.userData.mag;if(mg&&G.id!=="staff")mg.position.y=(G.id==="rifle"?-.22:-.5)-rlSwing*.12;}
  shadowDisc.position.y=.015-P.pos.y+Math.max(0,floorUnder());shadowDisc.material.opacity=Math.max(.05,.18-(P.pos.y-Math.max(0,floorUnder()))*.03);}
function floorUnder(){let f=0;for(const b of BLOCKS){if(Math.abs(P.pos.x-b.x)<b.w/2&&Math.abs(P.pos.z-b.z)<b.d/2&&b.y+b.h<=P.pos.y+.01)f=Math.max(f,b.y+b.h);}return f;}

// ---------------- camera ----------------
const camPos=new THREE.Vector3(0,3,6);
function updateCam(dt){const d=4.2,eye=P.pos.clone().add(new THREE.Vector3(0,1.5,0));const side=new THREE.Vector3(Math.cos(look.yaw),0,-Math.sin(look.yaw)).multiplyScalar(.7*camSide);
  const want=new THREE.Vector3(eye.x+Math.sin(look.yaw)*Math.cos(look.pitch)*d,eye.y+Math.sin(look.pitch)*d,eye.z+Math.cos(look.yaw)*Math.cos(look.pitch)*d).add(side);
  want.y=Math.max(want.y,floorUnder()+.4);
  camPos.lerp(want,1-Math.pow(.0005,dt));cam.position.copy(camPos);if(camShake>0){cam.position.add(rnd3(camShake));camShake=Math.max(0,camShake-dt*.6);}
  const ahead=eye.clone().add(side).add(new THREE.Vector3(-Math.sin(look.yaw)*Math.cos(look.pitch),-Math.sin(look.pitch),-Math.cos(look.yaw)*Math.cos(look.pitch)).multiplyScalar(30));cam.lookAt(ahead);}   // the crosshair is where bullets go
function resize(){R.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();}
addEventListener("resize",resize);resize();
function placeBars(){DUMMIES.forEach(d=>{const p=d.g.position.clone().add(new THREE.Vector3(0,2.45,0)).project(cam);const vis=p.z<1&&Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1&&d.g.position.distanceTo(P.pos)<45;d.bar.style.display=vis?"":"none";if(!vis)return;
  d.bar.style.left=(p.x+1)/2*innerWidth+"px";d.bar.style.top=(1-p.y)/2*innerHeight+"px";d.barI.style.width=(100*d.hp/d.max)+"%";d.barI.classList.toggle("low",d.hp<35);d.barS.textContent=d.down?d.name+" · down":d.name;});}

// ---------------- flow ----------------
function togglePause(){if(!started)return;paused=!paused;$("#pause").classList.toggle("hidden",!paused);if(paused&&document.exitPointerLock)document.exitPointerLock();G.firing=false;}
$("#startBtn").onclick=()=>{$("#start").classList.add("hidden");started=true;setTimeout(()=>$("#hint").classList.add("off"),5000);};
$("#pauseBtn").onclick=togglePause;$("#resumeBtn").onclick=togglePause;$("#respawnBtn").onclick=respawn;
$("#resetBtn").onclick=()=>{respawn();look.yaw=0;look.pitch=.22;paused=false;$("#pause").classList.add("hidden");};
document.addEventListener("visibilitychange",()=>{if(document.hidden&&started&&!paused)togglePause();});
if(!touch)$("#hint").textContent="WASD walk · Space jump · click to shoot · R reload · 1 2 3 guns · Q crystal";
equip("rifle");hud();
const clock=new THREE.Clock();
function frame(){requestAnimationFrame(frame);const dt=Math.min(.05,clock.getDelta());tAcc+=dt;
  tweens=tweens.filter(w=>{w.t+=dt;const t=Math.min(1,w.t/w.dur);w.fn(t);if(t>=1){w.done&&w.done();return false;}return true;});
  if(started&&!paused)step(dt);else animate(dt);SPARK.step(dt);PUFF.step(dt);FX.step(dt);updateCam(dt);placeBars();
  $("#pos").textContent=`x ${P.pos.x.toFixed(1)}  y ${P.pos.y.toFixed(1)}  z ${P.pos.z.toFixed(1)}${P.run?"  run":""}`;R.render(scene,cam);}
frame();
window.__el={P,G,look,keys,WEAPONS,DUMMIES,CRYSTALS,cycleCrystal,get started(){return started},start(){$("#startBtn").click();},jump(){jumpQ=true;},setStick(x,y){stick.x=x;stick.y=y;},fire,reload,equip,hurt,blocks:BLOCKS,scene,cam};
})();
