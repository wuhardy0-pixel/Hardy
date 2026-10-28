// Elementum — effects library. GLSL ports of Binbun3D's CC0 Godot VFX packs (Flame FX, Elemental Magic FX,
// Stylized Hit FX, Beam VFX — bun3d.com) for Three.js, first made for Elemental Latin and shared here.
// Use: FX.init(scene, camera); FX.step(dt) every frame; then FX.flame / comet / impact / stars / beam / flare / burning.
window.FX=(function(){
let scene=null,cam=null,tAcc=0,tweens=[];const SHADERS=new Set();
const RAMP={fire:[[1,.85,.3],[1,.4,.1],[.6,.1,.05]],water:[[.85,.97,1],[.3,.75,1],[.05,.2,.6]],ice:[[.95,1,1],[.65,.9,1],[.2,.4,.75]],air:[[1,1,1],[.8,.9,1],[.4,.5,.75]],
  shadow:[[.85,.65,1],[.5,.2,.8],[.15,.02,.3]],light:[[1,1,.92],[1,.9,.5],[.6,.4,.1]],earth:[[.95,.85,.6],[.7,.5,.3],[.3,.2,.1]],lightning:[[1,1,.85],[1,.9,.3],[.6,.4,.05]],
  gold:[[1,.95,.7],[1,.83,.4],[.6,.4,.1]],heal:[[.85,1,.9],[.5,1,.6],[.1,.5,.2]],red:[[1,.8,.8],[1,.3,.3],[.5,.05,.05]],plain:[[1,.95,.8],[1,.75,.4],[.5,.3,.1]]};
const HEX={fire:0xff7b3a,water:0x4cc3ff,ice:0xa9f1ff,air:0xdff1ff,shadow:0xa98ae0,light:0xfff4c2,earth:0xc69a5a,lightning:0xffe26a,gold:0xffd36a,heal:0x7dff9a,red:0xff5050,plain:0xffd27a};
const rnd=(a,b)=>a+Math.random()*(b-a);const rnd3=k=>new THREE.Vector3(rnd(-k,k),rnd(-k,k),rnd(-k,k));
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function tween(dur,fn,done){tweens.push({t:0,dur,fn,done});}
const v3=a=>({value:new THREE.Vector3(a[0],a[1],a[2])});
// tileable value noise — the "noise_texture" the packs expect
function noiseTex(){const N=256;const c=document.createElement("canvas");c.width=c.height=N;const x=c.getContext("2d");const img=x.createImageData(N,N);
  const oct=[[8,1],[16,.5],[32,.25],[64,.125]];const grids=oct.map(([g])=>{const a=new Float32Array(g*g);for(let i=0;i<a.length;i++)a[i]=Math.random();return a;});const sm=t=>t*t*(3-2*t);
  for(let y=0;y<N;y++)for(let xx=0;xx<N;xx++){let v=0,tot=0;oct.forEach(([g,w],k)=>{const a=grids[k];const fx=xx/N*g,fy=y/N*g;const x0=Math.floor(fx),y0=Math.floor(fy);const tx=sm(fx-x0),ty=sm(fy-y0);const at=(i,j)=>a[((j%g)+g)%g*g+((i%g)+g)%g];
      v+=(at(x0,y0)*(1-tx)*(1-ty)+at(x0+1,y0)*tx*(1-ty)+at(x0,y0+1)*(1-tx)*ty+at(x0+1,y0+1)*tx*ty)*w;tot+=w;});
    const b=Math.round(v/tot*255);const i=(y*N+xx)*4;img.data[i]=img.data[i+1]=img.data[i+2]=b;img.data[i+3]=255;}
  x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
let NOISE=null;
function shader(vs,fs,uni,o){const m=new THREE.ShaderMaterial(Object.assign({vertexShader:vs,fragmentShader:fs,uniforms:Object.assign({uTime:{value:tAcc},uNoise:{value:NOISE}},uni),transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending},o||{}));SHADERS.add(m);return m;}
const BILL_VS=`uniform float uSize;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);mv.xy+=position.xy*uSize;gl_Position=projectionMatrix*mv;}`;
const STD_VS=`varying vec2 vUv;varying vec3 vN;varying vec3 vP;void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vP=mv.xyz;gl_Position=projectionMatrix*mv;}`;
// flame (fire_core): a billboard whose shape is a radial mask eaten by scrolling noise
const FLAME_FS=`uniform float uTime,uSpeed,uAmount;uniform vec2 uScale;uniform vec3 c1,c2;uniform sampler2D uNoise;varying vec2 vUv;
void main(){float mask=max(1.-length(vUv*2.-1.),0.);float n=texture2D(uNoise,vUv*uScale+vec2(0.,-uTime*uSpeed)).r;float v=(mask*4.-(1.-n))/4.;v-=(1.-uAmount);v=clamp(v,0.,1.);v=smoothstep(.2,.29,v);
  float core=smoothstep(.45,.9,v*(1.-vUv.y*.5)+n*.2);vec3 col=mix(c2,c1,core)*2.2;gl_FragColor=vec4(col,v);}`;
function flame(el,size,o){o=o||{};const r=RAMP[el]||RAMP.fire;const m=shader(BILL_VS,FLAME_FS,{uSize:{value:size},uSpeed:{value:o.speed||1.2},uAmount:{value:1},uScale:{value:new THREE.Vector2(1,1.4)},c1:v3(r[0]),c2:v3(r[1])},{blending:THREE.NormalBlending});
  const q=new THREE.Mesh(new THREE.PlaneGeometry(1,1.6),m);q.renderOrder=5;q.userData.mat=m;return q;}
// comet (projectile_core): a cone whose UV.y runs tail→head, waves along its normals, three-colour fade
const WAVE=`float wave(vec2 uv,float off){float xw=sin(uv.x*6.2831*3.+uv.y*6.2831*2.)*.2;float ty=fract((uv.y*2.-uTime*1.)*2.+off*.6+xw);return min(ty/.6,(1.-ty)/.4);}`;
const PROJ_VS=`uniform float uTime;uniform sampler2D uNoise;varying vec2 vUv;`+WAVE+`void main(){vUv=uv;float n=texture2D(uNoise,uv*1.+uTime*vec2(.1,.5)).r;float w=wave(uv,n);vec3 p=position+normal*pow(w,.4)*.1*uv.y;float sp=sin(uv.y*20.+uv.x*6.2831*3.-uTime*20.)*smoothstep(.2,.4,uv.y);p+=normal*sp*.03;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const PROJ_FS=`uniform float uTime,uGrow;uniform vec3 c1,c2,c3;uniform sampler2D uNoise;varying vec2 vUv;`+WAVE+`void main(){float n=1.-texture2D(uNoise,vUv+vec2(uTime*.5,0.)).r;float w=wave(vUv,n);float ft=max(((1.-vUv.y)+w*.1)-.4,0.);ft=smoothstep((1.-uGrow),.5+(1.-uGrow)*.5,ft);vec3 tail=mix(c3,c2,w);vec3 col=mix(tail,c1,pow(ft,4.));gl_FragColor=vec4(col*2.,smoothstep(0.,1.01,ft));}`;
function comet(el,len){const r=RAMP[el]||RAMP.fire;const m=shader(PROJ_VS,PROJ_FS,{uGrow:{value:1},c1:v3(r[0]),c2:v3(r[1]),c3:v3(r[2])});
  const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(.03,.2,1,16,6,true),m);body.scale.y=len||1.3;body.position.y=(len||1.3)/2;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.14,12,10),new THREE.MeshBasicMaterial({color:new THREE.Color(r[0][0],r[0][1],r[0][2]),transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));g.add(head);
  const l=new THREE.PointLight(HEX[el]||0xffffff,1.6,4);g.add(l);g.userData.mat=m;g.userData.aim=d=>g.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),d.clone().normalize());g.userData.dispose=()=>{scene.remove(g);SHADERS.delete(m);};return g;}
// impact sphere (impact_sphere): a noisy shell that opens up as uF goes 1→0
const IMP_N=`float sn(vec2 uv){float pm=max(uv.y,1.-uv.y)*2.-1.;pm=1.-pow(pm,8.);return min(texture2D(uNoise,uv+.2*uTime).r,1.)*pm;}`;
const IMP_VS=`uniform float uTime,uF;uniform sampler2D uNoise;varying vec2 vUv;`+IMP_N+`void main(){vUv=uv;vec3 p=position+normal*sn(uv)*.25*uF+normal*.15*uF;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const IMP_FS=`uniform float uTime,uF;uniform vec3 c1,c2;uniform sampler2D uNoise;varying vec2 vUv;`+IMP_N+`void main(){float n=sn(vUv)+(1.-uF)*2.-1.;float v=clamp(n,0.,1.);v=smoothstep(.25,.75,v);gl_FragColor=vec4(mix(c2,c1,v*v)*1.1,v*.32);}`;
function impact(p,el,size){const r=RAMP[el]||RAMP.light;const m=shader(IMP_VS,IMP_FS,{uF:{value:1},c1:v3(r[0]),c2:v3(r[1])},{side:THREE.FrontSide});const s=new THREE.Mesh(new THREE.IcosahedronGeometry(1,3),m);s.position.copy(p);s.scale.setScalar(.15);scene.add(s);
  tween(.38,t=>{s.scale.setScalar(.15+ease(t)*(size||1));m.uniforms.uF.value=1-t;},()=>{scene.remove(s);SHADERS.delete(m);});}
// four-point star (four_point_star): a billboard star whose arms thin out as it decays
const STAR_FS=`uniform float uDecay;uniform vec3 c1,c2;varying vec2 vUv;void main(){vec2 uv=abs(vUv*2.-1.);float v=clamp(pow(uv.x,2.*uDecay)+pow(uv.y,2.*uDecay),0.,2.);v=smoothstep(.95,.8,v);gl_FragColor=vec4(mix(c2,c1,v)*2.,v);}`;
function stars(p,el,n,size){const r=RAMP[el]||RAMP.light;for(let i=0;i<(n||2);i++){const m=shader(BILL_VS,STAR_FS,{uSize:{value:.1},uDecay:{value:1},c1:v3(r[0]),c2:v3(r[1])});const q=new THREE.Mesh(new THREE.PlaneGeometry(1,1),m);q.position.copy(p).add(rnd3(.15));scene.add(q);const sz=(size||1)*rnd(.5,1),d=i*.05;
  tween(.35+d,t=>{const u=Math.max(0,(t*(.35+d)-d)/.35);m.uniforms.uSize.value=.1+u*sz;m.uniforms.uDecay.value=1-u*.75;},()=>{scene.remove(q);SHADERS.delete(m);});}}
// beam (beam_core): a pulsing tube with a bright fresnel core
const BEAM_VS=`uniform float uTime;varying vec2 vUv;varying vec3 vN;varying vec3 vP;void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec3 p=position+normal*sin(uv.y*30.-uTime*30.)*.03;vec4 mv=modelViewMatrix*vec4(p,1.);vP=mv.xyz;gl_Position=projectionMatrix*mv;}`;
const BEAM_FS=`uniform float uOpen,uK;uniform vec3 c1;varying vec2 vUv;varying vec3 vN;varying vec3 vP;void main(){float fr=clamp(dot(normalize(-vP),normalize(vN)),0.,1.);vec3 col=mix(c1,c1*3.,fr)*uK;float om=clamp(1.-smoothstep(uOpen-.1,uOpen+.1,vUv.y),0.,1.);gl_FragColor=vec4(col,om*.9);}`;
function beam(a,b,el,radius,dur){const r=RAMP[el]||RAMP.light;const d=b.clone().sub(a);const len=d.length();const m=shader(BEAM_VS,BEAM_FS,{uOpen:{value:0},uK:{value:1},c1:v3(r[0])});const t=new THREE.Mesh(new THREE.CylinderGeometry(radius||.06,radius||.06,len,10,10,true),m);
  t.position.copy(a).add(d.clone().multiplyScalar(.5));t.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());scene.add(t);
  tween(dur||.35,u=>{m.uniforms.uOpen.value=u<.3?u/.3:1;m.uniforms.uK.value=u>.6?1-(u-.6)/.4:1;t.scale.set(1+u*1.5,1,1+u*1.5);},()=>{scene.remove(t);SHADERS.delete(m);});}
// cast flare (cast_flare): an open cone of streaks at the muzzle / hand
const FLARE_FS=`uniform float uTime,uGrow;uniform vec3 c1,c2;uniform sampler2D uNoise;varying vec2 vUv;
void main(){float n=texture2D(uNoise,vUv+uTime*vec2(.1,.3)).r;float fg=max(vUv.y*4.-3.,0.);float w=sin((fg+(uGrow-.5)*2.)*3.14159);w=max(w*fg,0.);float v=n*w;v=smoothstep(.2,.8,v);float mask=cos(vUv.x*6.2831*4.)*.5+.5;v*=mask;float glow=pow(max((vUv.y-.8)/.2,0.),2.);glow*=max(sin(uGrow*3.14159*1.5),0.);vec3 col=mix(c2,c1,v)+c1*min(glow*20.,1.);gl_FragColor=vec4(col*2.,min(v+glow,1.));}`;
function flare(p,dir,el,size,dur){const r=RAMP[el]||RAMP.light;const m=shader(STD_VS,FLARE_FS,{uGrow:{value:0},c1:v3(r[0]),c2:v3(r[1])});const c=new THREE.Mesh(new THREE.ConeGeometry(.32*(size||1),.7*(size||1),24,8,true),m);c.position.copy(p);c.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),dir.clone().normalize());scene.add(c);
  tween(dur||.25,t=>{m.uniforms.uGrow.value=t;},()=>{scene.remove(c);SHADERS.delete(m);});}
// a flame that follows an object for a while (burning / frosting / soaking status)
function burning(obj,el,dur,size,offset){const f=flame(el,size||1,{speed:1.5});const off=offset||new THREE.Vector3(0,1.3,0);f.position.copy(obj.position).add(off);scene.add(f);const m=f.userData.mat;
  tween(dur||1.2,t=>{m.uniforms.uAmount.value=t<.15?t/.15:1-Math.max(0,(t-.6)/.4);f.position.copy(obj.position).add(off);},()=>{scene.remove(f);SHADERS.delete(m);});return f;}
function step(dt){tAcc+=dt;tweens=tweens.filter(w=>{w.t+=dt;const t=Math.min(1,w.t/w.dur);w.fn(t);if(t>=1){w.done&&w.done();return false;}return true;});SHADERS.forEach(m=>{m.uniforms.uTime.value=tAcc;});}
function init(s,c){scene=s;cam=c;NOISE=noiseTex();}
return{init,step,flame,comet,impact,stars,beam,flare,burning,tween,RAMP,HEX,get live(){return SHADERS.size;}};
})();
