<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { Mesh, Program, Renderer, Triangle, Vec2 } from "ogl";

const canvas = ref(null);
let renderer, observer, frame = 0, startedAt = 0, active = false, currentTheme = "";
const programs = {};
const meshes = {};
let reducedMotion = false;
const pointer = { x: .72, y: .34, tx: .72, ty: .34 };

const vertex = `
attribute vec2 position;
varying vec2 vUv;
void main(){vUv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;

const tigaFragment = `
precision highp float;
uniform float uTime; uniform vec2 uResolution; uniform vec2 uPointer;
varying vec2 vUv;
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.;v+=noise(p)*.5;p=p*2.03+9.1;v+=noise(p)*.25;p=p*2.01+7.7;v+=noise(p)*.125;return v;}
void main(){
 vec2 uv=vUv,aspect=vec2(uResolution.x/uResolution.y,1.);vec2 p=(uv-.5)*aspect;
 p+=(uPointer-.5)*vec2(.025,-.018);
 vec3 col=vec3(.008,.011,.026);float mist=fbm(p*2.2+vec2(uTime*.025,-uTime*.018));col+=vec3(.035,.025,.07)*mist*.22;
 float a=p.y+.10+sin(p.x*3.1+uTime*.23)*.095+(fbm(p*2.8+uTime*.035)-.5)*.17;
 float b=p.y-.16+sin(p.x*2.45-uTime*.19+1.7)*.12+(fbm(p*3.2-uTime*.028)-.5)*.15;
 float red=exp(-abs(a)*25.),violet=exp(-abs(b)*22.);col+=vec3(.58,.025,.11)*red*.09+vec3(.23,.055,.48)*violet*.12+vec3(.18,.48,.72)*pow(red*violet,.9)*.08;
 vec2 starUv=uv*vec2(150.,90.);vec2 grid=floor(starUv);float seed=hash21(grid);float dotShape=smoothstep(.16,.015,length(fract(starUv)-.5));float star=step(.986,seed)*dotShape*(.6+.4*sin(uTime*(1.+seed*2.)+seed*30.));col+=star*mix(vec3(.35,.48,.75),vec3(.7,.93,1.),seed)*.52;
 float vig=smoothstep(.95,.26,length((uv-.5)*vec2(.86,1.)));col*=.56+.44*vig;gl_FragColor=vec4(pow(col,vec3(.92)),1.);
}`;

const zeldaFragment = `
precision highp float;
uniform float uTime; uniform vec2 uResolution; uniform vec2 uPointer;
varying vec2 vUv;
float hash21(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+34.5);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.;v+=noise(p)*.5;p=p*2.02+8.3;v+=noise(p)*.25;p=p*2.01+4.8;v+=noise(p)*.125;return v;}
void main(){
 vec2 uv=vUv,aspect=vec2(uResolution.x/uResolution.y,1.);vec2 p=(uv-.5)*aspect;
 p+=(uPointer-.5)*vec2(.018,-.012);
 vec3 col=vec3(.018,.045,.031);
 float terrain=fbm(p*1.85+vec2(uTime*.012,-uTime*.008));
 float contour=1.-smoothstep(.018,.052,abs(fract(terrain*7.)-.5));
 col+=vec3(.12,.14,.075)*contour*.055;
 float fog=fbm(p*2.35+vec2(-uTime*.018,uTime*.009));
 float veil=smoothstep(.43,.78,fog)*smoothstep(.08,.7,uv.y);
 col+=vec3(.07,.115,.075)*veil*.18;
 float ridgeA=.19+noise(vec2(uv.x*3.4+uTime*.003,4.))* .105;
 float ridgeB=.11+noise(vec2(uv.x*5.1-uTime*.002,9.))* .065;
 col=mix(col,vec3(.008,.025,.018),1.-smoothstep(ridgeA-.012,ridgeA+.012,uv.y));
 col=mix(col,vec3(.012,.035,.024),.72*(1.-smoothstep(ridgeB-.009,ridgeB+.009,uv.y)));
 for(int i=0;i<18;i++){
   float fi=float(i),seed=hash21(vec2(fi,fi+7.));
   vec2 fp=vec2(hash21(vec2(fi,2.1)),hash21(vec2(fi,8.7)));
   fp.x+=sin(uTime*(.12+seed*.14)+fi)*.025;
   fp.y=fract(fp.y+uTime*(.004+seed*.006));
   float d=length((uv-fp)*aspect);
   float glow=.000045/(d*d+.00018);
   glow*=.5+.5*sin(uTime*(.7+seed)+fi*2.4);
   vec3 mote=mix(vec3(.88,.69,.26),vec3(.22,.72,.76),step(.76,seed));
   col+=mote*glow*.34;
 }
 float canopy=smoothstep(.85,.18,length((uv-.5)*vec2(.78,1.12)));
 col*=.64+.36*canopy;
 gl_FragColor=vec4(pow(col,vec3(.94)),1.);
}`;

function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight);Object.values(programs).forEach(program=>program.uniforms.uResolution.value.set(renderer.gl.canvas.width,renderer.gl.canvas.height));}
function render(now){if(!active||document.hidden){frame=0;return;}const program=programs[currentTheme];pointer.x+=(pointer.tx-pointer.x)*.035;pointer.y+=(pointer.ty-pointer.y)*.035;program.uniforms.uPointer.value.set(pointer.x,pointer.y);program.uniforms.uTime.value=reducedMotion?2.5:(now-startedAt)/1000;renderer.render({scene:meshes[currentTheme]});frame=requestAnimationFrame(render);}
function syncTheme(){const requested=document.documentElement.dataset.blogTheme;currentTheme=requested==="tiga"||requested==="zelda"?requested:"";active=Boolean(currentTheme);canvas.value?.classList.toggle("is-active",active);canvas.value?.classList.toggle("is-zelda",currentTheme==="zelda");canvas.value?.classList.toggle("is-tiga",currentTheme==="tiga");if(active&&!frame){startedAt=performance.now();frame=requestAnimationFrame(render);}}
function move(e){pointer.tx=e.clientX/innerWidth;pointer.ty=1-e.clientY/innerHeight;}

onMounted(()=>{reducedMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;renderer=new Renderer({canvas:canvas.value,dpr:Math.min(devicePixelRatio,1.5),powerPreference:"low-power"});const gl=renderer.gl,geometry=new Triangle(gl);for(const [name,fragment] of Object.entries({tiga:tigaFragment,zelda:zeldaFragment})){programs[name]=new Program(gl,{vertex,fragment,uniforms:{uTime:{value:0},uResolution:{value:new Vec2(1,1)},uPointer:{value:new Vec2(.72,.34)}}});meshes[name]=new Mesh(gl,{geometry,program:programs[name]});}resize();observer=new MutationObserver(syncTheme);observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-blog-theme"]});addEventListener("resize",resize,{passive:true});addEventListener("pointermove",move,{passive:true});document.addEventListener("visibilitychange",syncTheme);syncTheme();});
onUnmounted(()=>{cancelAnimationFrame(frame);observer?.disconnect();removeEventListener("resize",resize);removeEventListener("pointermove",move);document.removeEventListener("visibilitychange",syncTheme);renderer?.gl.getExtension("WEBGL_lose_context")?.loseContext();});
</script>

<template><canvas ref="canvas" class="tiga-canvas" aria-hidden="true"></canvas></template>
