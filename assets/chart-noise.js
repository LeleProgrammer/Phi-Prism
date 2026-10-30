/* Noise area geometry: official blockAreaList. Shader appearance is approximated.
 * Field/easing semantics cross-checked against TeamFlos/phira PR #901. */
(function(root){'use strict';
const clamp=x=>Math.max(0,Math.min(1,x));
function curve(k,p){if(k===13)return 0;if(k===14)return 1;if(k<1||k>12)return p;const power=2+Math.floor((k-1)/3),mode=(k-1)%3;return mode===0?p**power:mode===1?1-(1-p)**power:p<.5?(2*p)**power/2:1-(2-2*p)**power/2;}
function ease(k,p){p=clamp(p)*100;const n=Math.floor(p);return curve(k,n/100)+(curve(k,Math.min(100,n+1)/100)-curve(k,n/100))*(p-n);}
const lerp=(a,b,k,p)=>a+(b-a)*(p>=1?1:ease(k,p));
function segments(events,t,fn){for(let i=0;i<events.length-1;i++){const e=events[i],next=events[i+1],p=clamp((t-e.time)/Math.max(1e-9,next.time-e.time));fn(e,next,p);if(t<next.time)break;}}
function pose(a,t,w,h){const lo=a.bottomLeftPercentage,hi=a.topRightPercentage;if(!lo||!hi)return null;const base={x:(lo.x+hi.x)*w/2,y:(lo.y+hi.y)*h/2};let x=base.x,y=base.y,sx=1,sy=1,angle=0;const scales=a.scaleEvents||[],rotations=a.rotateEvents||[],moves=a.moveEvents||[];
if(scales.length){sx=scales[0].scale.x;sy=scales[0].scale.y;segments(scales,t,(e,n,p)=>{const nx=lerp(e.scale.x,n.scale.x,e.easeTypeX,p),ny=lerp(e.scale.y,n.scale.y,e.easeTypeY,p),ax=e.anchor.x*w,ay=e.anchor.y*h;x=ax+(x-ax)*(Math.abs(e.scale.x)<1e-12?1:nx/e.scale.x);y=ay+(y-ay)*(Math.abs(e.scale.y)<1e-12?1:ny/e.scale.y);sx=nx;sy=ny;});}
if(rotations.length){angle=rotations[0].rotation;segments(rotations,t,(e,n,p)=>{const v=lerp(e.rotation,n.rotation,e.easeType,p),r=(v-e.rotation)*Math.PI/180,dx=x-e.anchor.x*w,dy=y-e.anchor.y*h;x=e.anchor.x*w+dx*Math.cos(r)-dy*Math.sin(r);y=e.anchor.y*h+dx*Math.sin(r)+dy*Math.cos(r);angle=v;});}
if(moves.length){let mx=moves[0].endPosition.x,my=moves[0].endPosition.y;segments(moves,t,(e,n,p)=>{mx=lerp(e.endPosition.x,n.endPosition.x,e.easeTypeX,p);my=lerp(e.endPosition.y,n.endPosition.y,e.easeTypeY,p);});x+=mx*w-base.x;y+=my*h-base.y;}
return {x,y:h-y,width:Math.abs((hi.x-lo.x)*w*sx),height:Math.abs((hi.y-lo.y)*h*sy),angle:-angle*Math.PI/180};}
let mask,texture;
function render(c,areas,t){if(typeof document==='undefined'||!areas.length)return;const visible=areas.filter(a=>t>=a.appearTime&&t<a.disappearTime);if(!visible.length)return;
if(!mask){mask=document.createElement('canvas');texture=document.createElement('canvas');mask.width=texture.width=320;mask.height=texture.height=180;}
const m=mask.getContext('2d'),n=texture.getContext('2d');m.clearRect(0,0,320,180);const w=c.canvas.width,h=c.canvas.height;
// Union normal regions first, then XOR subtract regions; times are seconds.
for(const a of [...visible.filter(a=>!a.isSubtract),...visible.filter(a=>a.isSubtract)]){const p=pose(a,t,w,h);if(!p||!Object.values(p).every(Number.isFinite))continue;m.save();m.scale(320/w,180/h);m.translate(p.x,p.y);m.rotate(p.angle);m.globalCompositeOperation=a.isSubtract?'xor':'source-over';m.fillStyle='white';m.fillRect(-p.width/2,-p.height/2,p.width,p.height);m.restore();}
const image=n.createImageData(320,180);let seed=(Math.floor(t*24)+1)*2654435761;const active=visible.some(a=>t>=a.enableTime&&t<a.disableTime);for(let i=0;i<image.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed>>>24;image.data[i]=120+v/2;image.data[i+1]=v/9;image.data[i+2]=v/7;image.data[i+3]=active?70+v/3:35;}
n.globalCompositeOperation='source-over';n.putImageData(image,0,0);n.globalCompositeOperation='destination-in';n.drawImage(mask,0,0);n.globalCompositeOperation='source-over';c.save();c.drawImage(texture,0,0,w,h);c.restore();}
root.PhiNoise={pose,ease,render};})(typeof window==='undefined'?globalThis:window);
