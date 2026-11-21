// Elementum — how things look. The hero, the training dummies and the world are modelled from Gemini concept art
// (concept/char_turn.webp, concept/dummy_concept.webp); the ground, stone, burlap and horizon pictures in art/ were
// painted by Gemini too. Cartoon shading (MeshToonMaterial) with ink outlines, so the shapes read like the drawings.
// Every builder keeps the old pivots and sizes, so game.js animation, collision and hit tests are unchanged.
const LOOK=(function(){
const T=THREE;const BASE="/play/elementum/art/";
const loader=new T.TextureLoader();
function tex(name,rx,ry){const t=loader.load(BASE+name);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx||1,ry||1);if("colorSpace" in t)t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}
// three tones: shadow, mid, light — the cartoon look
const RAMP=(()=>{const d=new Uint8Array([90,170,255]);const t=new T.DataTexture(d,3,1,T.RedFormat);t.minFilter=t.magFilter=T.NearestFilter;t.needsUpdate=true;return t;})();
const toon=(c,o)=>new T.MeshToonMaterial(Object.assign({color:c,gradientMap:RAMP},o||{}));
const INK=new T.MeshBasicMaterial({color:0x2a1a14,side:T.BackSide});
const inkCache={};
function inkMat(th){if(inkCache[th])return inkCache[th];const m=INK.clone();m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace("#include <begin_vertex>","vec3 transformed = position + normal * "+th.toFixed(4)+";");};m.customProgramCacheKey=()=>"ink"+th;return inkCache[th]=m;}
// a mesh with a dark outline (the back faces pushed out along the normals)
function M(geo,mat,th){const m=new T.Mesh(geo,mat);m.castShadow=true;if(th!==0){const o=new T.Mesh(geo,inkMat(th||.012));o.raycast=()=>{};m.add(o);}return m;}
function at(o,x,y,z,rx,ry,rz){o.position.set(x,y,z);if(rx||ry||rz)o.rotation.set(rx||0,ry||0,rz||0);return o;}

// ---------------- the hero (concept/char_turn.webp) ----------------
// faces -z. hips pivot at y .95; arms pivot at the shoulders (±.33,.72) hanging 0.62 to the hand; legs at (±.13,0) 0.9 to the sole.
function hero(){
  const C={skin:0xf1c09a,hair:0x3b2419,teal:0x1f7375,tealD:0x175a5c,gold:0xd8ac4a,cream:0xf1e6c8,leather:0x6e4327,leatherD:0x4f2f1c,bronze:0xc0834c,pants:0x1f2c2d,eye:0x2a1a12};
  const m={};for(const k in C)m[k]=toon(C[k]);
  m.crystal=new T.MeshToonMaterial({color:0xff9a2e,emissive:0xff7a10,emissiveIntensity:1.4,gradientMap:RAMP});
  m.white=toon(0xffffff);m.bronze=new T.MeshToonMaterial({color:C.bronze,gradientMap:RAMP,emissive:0x3a1e08,emissiveIntensity:.3});
  const hips=new T.Group();hips.position.y=.95;
  // tunic: a lathe from the hem up to the neck
  const prof=[[.0,-.2],[.27,-.2],[.28,-.08],[.24,.08],[.235,.3],[.255,.52],[.25,.68],[.17,.8],[.09,.85],[0,.86]].map(([r,y])=>new T.Vector2(r,y));
  const torso=M(new T.LatheGeometry(prof,20),m.cream);torso.scale.z=.82;hips.add(torso);
  // belt, buckle, pouch
  hips.add(at(M(new T.CylinderGeometry(.245,.25,.08,20),m.leather,.008),0,.06,0));hips.children.at(-1).scale.z=.85;
  hips.add(at(M(new T.BoxGeometry(.09,.07,.03),m.bronze,.006),0,.06,-.215));
  hips.add(at(M(new T.BoxGeometry(.11,.12,.08),m.leather,.008),.2,-.02,-.12,0,-.5,0));
  // chest strap from the right shoulder to the left hip, with the glowing crystal
  const strap=at(M(new T.BoxGeometry(.06,.78,.035),m.leatherD,.006),0,.42,-.218,0,0,.62);hips.add(strap);
  const crystal=at(new T.Mesh(new T.OctahedronGeometry(.055),m.crystal),-.02,.56,-.24);crystal.scale.set(.9,1.5,.55);hips.add(crystal);
    // capelet over the shoulders + the back cape, teal with gold trim
  const cap=at(M(new T.CylinderGeometry(.17,.38,.32,22,1,true),m.teal,.01),0,.66,0);cap.material=m.teal.clone();cap.material.side=T.DoubleSide;cap.scale.z=.85;hips.add(cap);
  hips.add(at(new T.Mesh(new T.CylinderGeometry(.385,.39,.04,22,1,true),Object.assign(m.gold.clone(),{side:T.DoubleSide})),0,.5,0));hips.children.at(-1).scale.z=.85;
  const capeM=m.teal.clone();capeM.side=T.DoubleSide;
  const cape=M(new T.CylinderGeometry(.3,.4,.78,16,1,true,-Math.PI*.38,Math.PI*.76),capeM,.01);at(cape,0,.2,.02);cape.scale.z=.75;hips.add(cape);
  const trim=new T.Mesh(new T.CylinderGeometry(.402,.404,.045,16,1,true,-Math.PI*.38,Math.PI*.76),Object.assign(m.gold.clone(),{side:T.DoubleSide}));at(trim,0,-.17,.02);trim.scale.z=.75;hips.add(trim);
  // hood bunched at the neck
  const hood=at(M(new T.TorusGeometry(.13,.06,8,18),m.tealD,.008),0,.83,.02,Math.PI/2,0,0);hips.add(hood);
  // neck + head
  hips.add(at(M(new T.CylinderGeometry(.07,.08,.12,10),m.skin,0),0,.88,0));
  const head=new T.Group();head.position.y=1.1;hips.add(head);
  const face=M(new T.SphereGeometry(.23,24,18),m.skin,.012);face.scale.set(1,1.06,.98);head.add(face);
  [-1,1].forEach(s=>{head.add(at(M(new T.SphereGeometry(.05,10,8),m.skin,.006),s*.225,-.01,0));});
  // big friendly eyes: white, dark iris, a sparkle; brows; nose; smile
  [-1,1].forEach(s=>{const e=at(new T.Group(),s*.085,.0,-.2);
    const w=new T.Mesh(new T.SphereGeometry(.052,14,10),m.white);w.scale.set(.85,1.15,.45);e.add(w);
    const iris=at(new T.Mesh(new T.SphereGeometry(.036,12,10),m.eye),0,-.004,-.017);iris.scale.set(.85,1.15,.45);e.add(iris);
    e.add(at(new T.Mesh(new T.SphereGeometry(.011,6,6),new T.MeshBasicMaterial({color:0xffffff})),s*-.01,.018,-.034));
    head.add(e);
    head.add(at(new T.Mesh(new T.BoxGeometry(.085,.017,.02),m.hair),s*.088,.085,-.212,0,0,s*-.18));});
  head.add(at(new T.Mesh(new T.SphereGeometry(.022,8,6),toon(0xe3a882)),0,-.05,-.228));
  const smile=at(new T.Mesh(new T.TorusGeometry(.055,.01,6,14,Math.PI*.8),toon(0x7a3b2a)),0,-.085,-.205,0,0,Math.PI*1.1);head.add(smile);
  // messy hair: a cap over the top and back, spiky tufts around it and a fringe
  const hairCap=M(new T.SphereGeometry(.245,22,14,0,Math.PI*2,0,Math.PI*.42),m.hair,.012);at(hairCap,0,.03,.0);head.add(hairCap);
  const hairBack=M(new T.SphereGeometry(.243,18,14,Math.PI*.15,Math.PI*.7,0,Math.PI*.68),m.hair,.012);at(hairBack,0,.02,.005);head.add(hairBack);
  const tufts=[[0,.25,.0,-.2,0,0],[.12,.22,-.06,-.5,0,-.5],[-.12,.22,-.06,-.5,0,.5],[.19,.15,.06,.2,0,-1.0],[-.19,.15,.06,.2,0,1.0],[0,.2,.14,.9,0,0],[.11,.18,.15,.9,0,-.5],[-.11,.18,.15,.9,0,.5],[.06,.24,.08,.4,0,-.3],[-.07,.25,.06,.3,0,.4],[0,.12,.22,1.5,0,0],[.15,.08,.17,1.3,0,-.6],[-.15,.08,.17,1.3,0,.6]];
  tufts.forEach(([x,y,z,rx,ry,rz])=>{const c=M(new T.ConeGeometry(.07,.17,6),m.hair,.008);at(c,x,y,z,rx,ry,rz);head.add(c);});
  // fringe: short tufts sweeping over the forehead
  [[-.11,.16,-.17,-1.2,0,.5],[-.03,.17,-.19,-1.3,0,.1],[.06,.17,-.185,-1.25,0,-.3],[.14,.14,-.15,-1.1,0,-.7]].forEach(([x,y,z,rx,ry,rz])=>{const c=M(new T.ConeGeometry(.055,.14,5),m.hair,.008);at(c,x,y,z,rx,ry,rz);head.add(c);});
  // arms: short cream sleeve, skin forearm, fingerless leather glove, hand
  function arm(side){const g=new T.Group();
    g.add(at(M(new T.SphereGeometry(.085,12,10),m.cream,.008),0,-.02,0));
    g.add(at(M(new T.CapsuleGeometry(.078,.12,4,10),m.cream,.008),0,-.12,0));
    g.add(at(M(new T.CapsuleGeometry(.062,.26,4,10),m.skin,.008),0,-.32,0));
    g.add(at(M(new T.CylinderGeometry(.075,.068,.13,10),m.leatherD,.008),0,-.47,0));
    g.add(at(M(new T.CylinderGeometry(.08,.08,.03,10),m.leather,.006),0,-.42,0));
    const hand=M(new T.SphereGeometry(.065,10,8),m.leatherD,.008);hand.scale.set(.9,1.1,.75);at(hand,0,-.57,0);g.add(hand);
    const fingers=M(new T.CapsuleGeometry(.035,.04,3,8),m.skin,.006);at(fingers,0,-.63,0);fingers.scale.set(1.5,1,1);g.add(fingers);
    if(side<0){const pad=M(new T.SphereGeometry(.13,14,10,0,Math.PI*2,0,Math.PI*.55),m.bronze,.01);at(pad,0,.02,0,0,0,.25);pad.scale.set(1.05,.8,1.1);g.add(pad);
      const pad2=M(new T.SphereGeometry(.11,12,8,0,Math.PI*2,0,Math.PI*.5),m.bronze,.008);at(pad2,.02,-.06,0,0,0,.3);pad2.scale.set(1.05,.7,1.05);g.add(pad2);}
    return g;}
  const armL=arm(-1),armR=arm(1);armL.position.set(-.33,.72,0);armR.position.set(.33,.72,0);hips.add(armL,armR);
  // legs: dark trousers, tall brown boots with a cuff and bronze toe caps
  function leg(){const g=new T.Group();
    g.add(at(M(new T.CapsuleGeometry(.105,.38,4,10),m.pants,.009),0,-.26,0));
    g.add(at(M(new T.CylinderGeometry(.11,.1,.3,12),m.leather,.009),0,-.66,0));
    g.add(at(M(new T.CylinderGeometry(.13,.125,.09,12),m.leather,.009),0,-.5,0));
    const foot=M(new T.CapsuleGeometry(.085,.14,4,10),m.leather,.009);at(foot,0,-.83,-.06,Math.PI/2,0,0);foot.scale.set(1.15,1,.75);g.add(foot);
    const toe=M(new T.SphereGeometry(.088,10,8,0,Math.PI*2,0,Math.PI*.5),m.bronze,.006);at(toe,0,-.86,-.15,-Math.PI/2+.2,0,0);toe.scale.set(1.15,1,.8);g.add(toe);
    g.add(at(new T.Mesh(new T.BoxGeometry(.2,.03,.3),m.leatherD),0,-.885,-.06));
    return g;}
  const legL=leg(),legR=leg();legL.position.set(-.13,0,0);legR.position.set(.13,0,0);hips.add(legL,legR);
  hips.traverse(o=>{if(o.isMesh&&o.material!==INK&&!o.material.isMeshBasicMaterial)o.castShadow=true;});
  return {hips,torso,head,armL,armR,legL,legR,crystal};}

// ---------------- the training dummy (concept/dummy_concept.webp) ----------------
// faces +z (toward the player's start). Body centre 1.35, head 2.0 as before.
const BURLAP=tex("burlap.webp",2,2),STONE=tex("stone.webp",1,1);
function targetTex(){const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");
  [["#d8392b",62],["#fbf4e6",46],["#d8392b",31],["#fbf4e6",17],["#d8392b",8]].forEach(([col,r])=>{x.fillStyle=col;x.beginPath();x.arc(64,64,r,0,7);x.fill();});
  const t=new T.CanvasTexture(c);if("colorSpace" in t)t.colorSpace=T.SRGBColorSpace;return t;}
const TARGET=targetTex();
function dummy(){
  const g=new T.Group();
  const sack=()=>new T.MeshToonMaterial({color:0xffffff,map:BURLAP,gradientMap:RAMP,emissive:0x000000});
  const wood=toon(0x7a4a28),woodD=toon(0x5c3519),rope=toon(0xcfa766),straw=toon(0xe9c25a),stone=new T.MeshToonMaterial({color:0xb9b2a8,map:STONE,gradientMap:RAMP}),button=toon(0x3a2a1e),thread=toon(0x3a2416);
  const rune=new T.MeshBasicMaterial({color:0x5fd0ff});
  // stone base with a glowing rune ring
  const base=M(new T.CylinderGeometry(.48,.55,.24,10),stone,.012);base.position.y=.12;g.add(base);
  const ring=new T.Mesh(new T.TorusGeometry(.33,.025,6,32),rune);at(ring,0,.245,0,Math.PI/2,0,0);g.add(ring);
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2+.3;const r=new T.Mesh(new T.BoxGeometry(.05,.1,.01),rune);at(r,Math.sin(a)*.53,.12,Math.cos(a)*.53,0,a,0);g.add(r);}
  // the post
  g.add(at(M(new T.CylinderGeometry(.075,.09,1.0,8),wood,.01),0,.72,0));
  // the sack body: a pear shape, tied at the waist and the neck
  const prof=[[0,.72],[.2,.74],[.3,.86],[.33,1.1],[.31,1.38],[.27,1.6],[.17,1.74],[.1,1.78],[0,1.79]].map(([r,y])=>new T.Vector2(r,y));
  const bm=sack();const bodyM=M(new T.LatheGeometry(prof,18),bm,.014);bodyM.scale.z=.85;g.add(bodyM);
  g.add(at(M(new T.TorusGeometry(.3,.035,6,20),rope,.006),0,.98,0,Math.PI/2,0,0));g.children.at(-1).scale.y=.85;
  g.add(at(M(new T.TorusGeometry(.13,.04,6,16),rope,.006),0,1.74,0,Math.PI/2,0,0));
  // crossbar arms with straw sticking out of the ends
  const bar=M(new T.CylinderGeometry(.055,.055,1.25,8),woodD,.01);at(bar,0,1.5,0,0,0,Math.PI/2);g.add(bar);
  [-1,1].forEach(s=>{g.add(at(M(new T.TorusGeometry(.065,.025,5,12),rope,.005),s*.5,1.5,0,0,Math.PI/2,0));
    for(let i=0;i<7;i++){const c=M(new T.ConeGeometry(.025,.24,4),straw,.005);const a=i/7*Math.PI*2;at(c,s*(.7+Math.random()*.04),1.5+Math.sin(a)*.06,Math.cos(a)*.06,Math.cos(a)*.9,0,s*(-Math.PI/2)+Math.sin(a)*.9);g.add(c);}});
  // straw poking out under the waist rope and at the neck
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;const c=M(new T.ConeGeometry(.02,.16,4),straw,.004);at(c,Math.sin(a)*.31,.95,Math.cos(a)*.27,Math.cos(a)*.9,0,-Math.sin(a)*.9);g.add(c);}
  // the head: a round sack with button eyes and a stitched smile
  const hm=sack();const headM=M(new T.SphereGeometry(.24,18,14),hm,.012);headM.position.y=2.0;g.add(headM);
  [-1,1].forEach(s=>{const b=at(M(new T.CylinderGeometry(.05,.05,.025,14),button,.004),s*.085,2.04,.215,Math.PI/2,0,0);g.add(b);
    [[-1,-1],[1,1],[-1,1],[1,-1]].forEach(([u,v])=>{if(u===v)g.add(at(new T.Mesh(new T.BoxGeometry(.09,.012,.01),rope),s*.085,2.04,.23,0,0,u*.785));});});
  g.add(at(new T.Mesh(new T.TorusGeometry(.09,.008,5,16,Math.PI*.9),thread),0,1.97,.22,0,0,Math.PI*1.05));
  for(let i=0;i<5;i++){const a=Math.PI*1.1+i/4*Math.PI*.8;g.add(at(new T.Mesh(new T.BoxGeometry(.008,.04,.01),thread),Math.cos(a)*.09,1.97+Math.sin(a)*.09,.225,0,0,a));}
  // a patch with stitches on the head
  g.add(at(new T.Mesh(new T.BoxGeometry(.08,.07,.01),toon(0xb08454)),.12,2.13,.17,-.5,.5,.2));
  // painted target on the chest
  const tgt=new T.Mesh(new T.CircleGeometry(.15,28),new T.MeshBasicMaterial({map:TARGET}));at(tgt,0,1.33,.315);g.add(tgt);
  const tgt2=new T.Mesh(new T.CircleGeometry(.05,12),new T.MeshBasicMaterial({visible:false}));at(tgt2,0,1.33,.316);g.add(tgt2);
  bm.userData.base=0xffffff;hm.userData.base=0xffffff;
  return {g,bodyM,headM,tgt,tgt2,bar,mats:[bm,hm]};}

// ---------------- the world ----------------
// sky gradient + Gemini's painted horizon (hills, cypresses, Roman ruins) on a far ring; grass ground; stone blocks
function world(scene){
  const HORIZON=0xd8e9e0,TOP=0x98cfe8,ZEN=0x5aa8dc;
  scene.background=new T.Color(HORIZON);scene.fog=new T.Fog(0x9fc08a,70,230);
  const sky=new T.Mesh(new T.SphereGeometry(280,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,
    uniforms:{a:{value:new T.Color(HORIZON)},b:{value:new T.Color(TOP)},c:{value:new T.Color(ZEN)}},
    vertexShader:"varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:"uniform vec3 a,b,c;varying vec3 p;void main(){float h=p.y;vec3 col=h<.25?mix(a,b,smoothstep(.0,.25,h)):mix(b,c,smoothstep(.42,.95,h));gl_FragColor=vec4(col,1.);\n#include <colorspace_fragment>\n}"}));
  sky.renderOrder=-2;scene.add(sky);
  const hz=tex("horizon.webp",3,1);hz.wrapT=T.ClampToEdgeWrapping;
  // the 3072x857 picture (itself + its mirror, so the ends meet) goes three times round a 240 m ring -> 140 m tall;
  // its horizon line is ~62% down the picture, so the ring spans y -45..95 and the far hills sit at eye level
  const band=new T.Mesh(new T.CylinderGeometry(240,240,140,64,1,true),new T.MeshBasicMaterial({map:hz,side:T.BackSide,fog:false,depthWrite:false}));
  band.position.y=25;band.renderOrder=-1;scene.add(band);
  // ground: Gemini grass, a sandy path across the range and round the start
  const ground=new T.Mesh(new T.PlaneGeometry(480,480),new T.MeshLambertMaterial({map:tex("grass.webp",60,60)}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const pathM=new T.MeshLambertMaterial({map:tex("path.webp",4,3),transparent:true,depthWrite:false});
  const yard=new T.Mesh(new T.PlaneGeometry(28,22),pathM);yard.rotation.x=-Math.PI/2;yard.position.set(0,.012,-16);yard.receiveShadow=true;scene.add(yard);
  const pad=new T.Mesh(new T.CircleGeometry(4,40),new T.MeshLambertMaterial({map:tex("path.webp",1.5,1.5)}));pad.rotation.x=-Math.PI/2;pad.position.y=.014;pad.receiveShadow=true;scene.add(pad);
  const lane=new T.Mesh(new T.PlaneGeometry(3,5),new T.MeshLambertMaterial({map:tex("path.webp",.6,1)}));lane.rotation.x=-Math.PI/2;lane.position.set(0,.013,-5);lane.receiveShadow=true;scene.add(lane);
  // cypress trees and round bushes scattered far from the play area (looks only, nothing to bump into)
  const cyp=toon(0x2f6b34),cypD=toon(0x245a2b),bush=toon(0x4f8f3a),trunk=toon(0x6b4a2c);
  const rng=(()=>{let s=7;return()=>(s=(s*16807)%2147483647)/2147483647;})();
  for(let i=0;i<70;i++){const a=rng()*Math.PI*2,r=48+rng()*120;const x=Math.cos(a)*r,z=Math.sin(a)*r;const h=5+rng()*6;
    const t=new T.Group();t.position.set(x,0,z);
    t.add(at(M(new T.CylinderGeometry(.18,.25,1.2,6),trunk,0),0,.6,0));
    const top=M(new T.SphereGeometry(1,10,10),i%2?cyp:cypD,0);top.scale.set(h*.17,h*.5,h*.17);top.position.y=1+h*.45;t.add(top);
    t.traverse(o=>{if(o.isMesh)o.castShadow=r<90;});scene.add(t);}
  for(let i=0;i<60;i++){const a=rng()*Math.PI*2,r=40+rng()*110;const b=M(new T.SphereGeometry(1,10,8),bush,0);const s=.7+rng()*1.3;b.scale.set(s*1.3,s*.8,s);b.position.set(Math.cos(a)*r,s*.35,Math.sin(a)*r);scene.add(b);}
  // little flowers near the start
  const fl=[0xffffff,0xffd34d,0xff8fb1,0x9bd3ff].map(c=>new T.MeshBasicMaterial({color:c}));
  for(let i=0;i<160;i++){const a=rng()*Math.PI*2,r=6+rng()*30;const x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x)<15&&z<-4&&z>-28)continue;const f=new T.Mesh(new T.CircleGeometry(.07,5),fl[i%4]);f.rotation.x=-Math.PI/2;f.position.set(x,.02,z);scene.add(f);}
}
// stone blocks: Gemini's travertine texture, UVs scaled so the bricks keep their size on every face
function blockMesh(w,h,d,shade){const geo=new T.BoxGeometry(w,h,d);const uv=geo.attributes.uv;const S=1.6;
  const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let f=0;f<6;f++)for(let k=0;k<4;k++){const i=f*4+k;uv.setXY(i,uv.getX(i)*dims[f][0]/S,uv.getY(i)*dims[f][1]/S);}
  const k=.82+((shade>>16&255)-150)/255*.6;
  const mesh=new T.Mesh(geo,new T.MeshLambertMaterial({map:STONE_B,color:new T.Color(k,k*.98,k*.95)}));return mesh;}
const STONE_B=tex("stone.webp",1,1);
// a Roman column drawn over a tall thin block (the block stays the collider)
function column(h){const g=new T.Group();const st=toon(0xeee2c8),stD=toon(0xd8c8a8);
  g.add(at(M(new T.BoxGeometry(1.2,.3,1.2),stD,.02),0,.15,0));g.add(at(M(new T.CylinderGeometry(.5,.55,.25,16),st,.015),0,.42,0));
  const shaft=M(new T.CylinderGeometry(.42,.48,h-1.1,16),st,.015);shaft.position.y=.55+(h-1.1)/2;g.add(shaft);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;g.add(at(new T.Mesh(new T.BoxGeometry(.04,h-1.2,.04),stD),Math.cos(a)*.455,.55+(h-1.1)/2,Math.sin(a)*.455));}
  g.add(at(M(new T.CylinderGeometry(.6,.45,.25,16),st,.015),0,h-.42,0));g.add(at(M(new T.BoxGeometry(1.3,.3,1.3),stD,.02),0,h-.15,0));
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return g;}
// ---------------- animated characters (KayKit packs by Kay Lousberg, CC0: models/hero.glb, models/skeleton_mage.glb) ----------------
// A rig plays the pack's animations in two layers: "base" (legs and hips: idle, walk, run, strafe, jump) and "up" (chest, arms,
// head: aim, shoot, reload), so the hero can walk one way and aim another; "full" (whole body: hit, death, spells) overrides both.
const UPPER=new Set(["chest","upperarml","lowerarml","wristl","handl","handslotl","upperarmr","lowerarmr","wristr","handr","handslotr","head"]);
function rig(gltf,split){const root=gltf.scene;const bones={};const mats=new Set();
  root.traverse(o=>{if(o.isBone)bones[o.name]=o;if(o.isMesh){o.castShadow=true;o.frustumCulled=false;const m=o.material;m.metalness=0;m.roughness=1;mats.add(m);}});
  ["handslotl","handslotr"].forEach(n=>{const b=bones[n];if(b)b.children.forEach(c=>{if(!c.isBone)c.visible=false;});});   // the pack's own weapons
  const mixer=new T.AnimationMixer(root);const clips={};gltf.animations.forEach(c=>clips[c.name.split("|").pop()]=c);   // Quaternius names clips "CharacterArmature|Walk"
  const L={base:{cur:null,acts:{}},up:{cur:null,acts:{}},full:{cur:null,acts:{}}};
  function act(layer,name){const Y=L[layer];if(Y.acts[name])return Y.acts[name];const c0=clips[name];if(!c0)return null;let c=c0;
    if(split&&layer!=="full"){c=c0.clone();c.tracks=c.tracks.filter(t=>UPPER.has(t.name.split(".")[0])===(layer==="up"));}
    const a=mixer.clipAction(c);a.setEffectiveWeight(0);a.play();return Y.acts[name]={a,w:0,then:null};}
  function set(layer,name,o){o=o||{};const Y=L[layer];const e=act(layer,name);if(!e)return;
    if(Y.cur===name&&!o.restart){if(o.speed)e.a.timeScale=o.speed;return;}Y.cur=name;
    if(o.once){e.a.reset();e.a.setLoop(T.LoopOnce,1);e.a.clampWhenFinished=true;e.a.timeScale=o.dur?c0dur(e)/o.dur:1;e.then=o.then||null;}
    else{e.a.setLoop(T.LoopRepeat,Infinity);e.a.timeScale=o.speed||1;e.then=null;}
    if(o.snap)for(const k in Y.acts)Y.acts[k].w=k===name?1:0;}
  const c0dur=e=>e.a.getClip().duration;
  function update(dt){const fullOn=L.full.cur!==null;
    for(const ln in L){const Y=L[ln];for(const k in Y.acts){const e=Y.acts[k];const on=k===Y.cur&&(ln==="full"||!fullOn);
      e.w+=((on?1:0)-e.w)*Math.min(1,dt*(ln==="full"?14:10));e.a.setEffectiveWeight(e.w);
      if(e.then&&k===Y.cur&&e.a.time>=c0dur(e)-.001){const t=e.then;e.then=null;t();}}}
    mixer.update(dt);}
  return {root,bones,mats:[...mats],clips,update,
    base:(n,o)=>set("base",n,o),up:(n,o)=>set("up",n,o),full:(n,o)=>set("full",n,o),
    clearFull(){L.full.cur=null;},debug(){const o={};for(const ln in L)for(const k in L[ln].acts){const e=L[ln].acts[k];if(e.w>.01)o[ln+':'+k]=+e.w.toFixed(2)+'@'+e.a.time.toFixed(2)+'x'+e.a.timeScale.toFixed(2);}return o;},get fullName(){return L.full.cur;},get upName(){return L.up.cur;}};}
// the hero's dark-brown fringe under the hood, as on the game cover (2026-11-18): a band plus spiky locks on the head bone
function heroHair(r){const head=r&&r.bones.head;if(!head)return;const mat=new T.MeshStandardMaterial({color:0x3a2418,roughness:1,flatShading:true});const g=new T.Group();
  const band=new T.Mesh(new T.CylinderGeometry(.5,.5,.12,14,1,false,-.75,1.5),mat);band.position.y=.55;band.scale.x=.82;g.add(band);
  [[-.26,-.02,-.5,.19],[-.15,-.04,-.2,.24],[-.02,-.03,.05,.22],[.11,-.04,.25,.24],[.24,-.03,.45,.19]].forEach(([x,y,rz,h])=>{
    const m=new T.Mesh(new T.ConeGeometry(.09,h,5),mat);m.scale.z=.45;m.rotation.set(Math.PI-.3,0,rz);m.position.set(x,.52+y,.47);g.add(m);});
  g.name="heroHair";g.traverse(o=>{if(o.isMesh)o.castShadow=true;});head.add(g);}
function loadRig(url,split,cb){if(!T.GLTFLoader){cb(null);return;}new T.GLTFLoader().load(url,g=>cb(rig(g,split)),undefined,e=>{console.warn("model",url,e);cb(null);});}
return {hero,dummy,world,blockMesh,column,toon,M,loadRig,heroHair};
})();
