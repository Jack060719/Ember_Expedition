export interface Point {x:number;y:number;}
export type DangerShape = {kind:'circle';x:number;y:number;radius:number}|{kind:'line';x:number;y:number;endX:number;endY:number;radius:number}|{kind:'fan';x:number;y:number;angle:number;half:number;radius:number}|{kind:'ring';x:number;y:number;angle:number;half:number;radius:number;width:number};
export interface DangerArea {shape:DangerShape;delay:number;active:number;damage:number;color:number;}
export interface ChapterAttack {areas:DangerArea[];duration:number;cooldown:number;dash?:{from:Point;to:Point;start:number;duration:number};jump?:{to:Point;start:number};summon?:{points:Point[];start:number;limit:number};projectiles?:{origin:Point;angles:number[];start:number;speed:number;damage:number};}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export function containsDanger(shape:DangerShape,point:Point):boolean{
  const dx=point.x-shape.x,dy=point.y-shape.y;
  if(shape.kind==='circle')return Math.hypot(dx,dy)<=shape.radius;
  if(shape.kind==='fan')return Math.hypot(dx,dy)<=shape.radius&&Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-shape.angle),Math.cos(Math.atan2(dy,dx)-shape.angle)))<=shape.half;
  if(shape.kind==='ring')return Math.abs(Math.hypot(dx,dy)-shape.radius)<=shape.width&&Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-shape.angle),Math.cos(Math.atan2(dy,dx)-shape.angle)))>=shape.half;
  const vx=shape.endX-shape.x,vy=shape.endY-shape.y,t=clamp((dx*vx+dy*vy)/(vx*vx+vy*vy||1),0,1);
  return Math.hypot(dx-vx*t,dy-vy*t)<=shape.radius;
}
export function dangerPhase(area:DangerArea,elapsed:number):'warning'|'active'|'expired'{
  return elapsed<area.delay?'warning':elapsed<area.delay+area.active?'active':'expired';
}
export function finalBossPhase(healthRatio:number):1|2|3{return healthRatio>2/3?1:healthRatio>1/3?2:3;}
export function planChapterAttack(behavior:string,turn:number,origin:Point,target:Point,enraged:boolean,phase=1):ChapterAttack{
  const dx=target.x-origin.x,dy=target.y-origin.y,length=Math.hypot(dx,dy)||1,angle=Math.atan2(dy,dx);
  const circle=(x:number,y:number,radius:number,delay:number,active:number,damage:number,color:number):DangerArea=>({shape:{kind:'circle',x:clamp(x,35,355),y:clamp(y,75,590),radius},delay,active,damage,color});
  const fan=(radius:number,half:number,damage:number,color:number):DangerArea=>({shape:{kind:'fan',...origin,angle,half,radius},delay:1.1,active:.25,damage,color});
  const line=(x:number,y:number,endX:number,endY:number,radius:number,delay:number,damage:number,color:number):DangerArea=>({shape:{kind:'line',x,y,endX,endY,radius},delay,active:.25,damage,color});
  if(behavior==='final-king'){
    const patterns=phase===1?['devour','delayed-beam']:phase===2?['bone-rain','black-sun']:['combined','rift-pair'];
    const plan=planChapterAttack(patterns[turn%2],Math.floor(turn/2),origin,target,enraged);
    return {...plan,cooldown:phase===1?2:phase===2?1.6:1.2};
  }
  if(behavior==='combined'){
    const a=planChapterAttack('lightning-bands',turn,origin,target,true),b=planChapterAttack('rift-pair',turn,origin,target,true);
    return {areas:[...a.areas,...b.areas.map(z=>({...z,delay:z.delay+1}))],duration:Math.max(a.duration,b.duration+1),cooldown:enraged?1.4:2};
  }
  if(behavior==='bone-breath'||behavior==='bone-rain'&&turn%2===0)return {areas:[fan(behavior==='bone-breath'?190:290,.6,behavior==='bone-breath'?16:27,0xf1ba85)],duration:1.35,cooldown:behavior==='bone-breath'?3.8:enraged?1.5:2.1};
  if(behavior==='bone-rain')return {areas:[-70,0,70].map((offset,i)=>circle(target.x+offset,target.y,40,1.1+i*.35,.25,27,0xf1ba85)),duration:2.05,cooldown:enraged?1.5:2.1};
  if(behavior==='ember-dash'){
    const plan=planChapterAttack('thrust',turn,origin,target,enraged),dash=plan.dash!,end=dash.start+dash.duration;
    plan.areas.push({...plan.areas[0],delay:end,active:1.3,damage:16,color:0xff8579});
    return {...plan,duration:end+1.3,cooldown:3.6};
  }
  if(behavior==='black-sun')return turn%2===0?{areas:[-65,65].map((offset,i)=>line(clamp(target.x+offset,45,345),64,clamp(target.x+offset,45,345),602,25,1.2+i*.5,27,0xff8579)),duration:1.95,cooldown:enraged?1.3:2}:{areas:[circle(target.x,target.y,60,1.3,.3,29,0xffbd83)],duration:1.6,cooldown:enraged?1.3:2};
  if(behavior==='delayed-beam'||behavior==='angel'&&turn%2===0){
    const end={x:origin.x+Math.cos(angle)*650,y:origin.y+Math.sin(angle)*650};
    return {areas:[line(origin.x,origin.y,end.x,end.y,behavior==='angel'?24:14,1.3,behavior==='angel'?28:17,0xa884ec)],duration:1.55,cooldown:behavior==='angel'?enraged?1.5:2.2:3.8};
  }
  if(behavior==='angel')return {areas:[{shape:{kind:'ring',...origin,radius:150,width:20,angle:angle+Math.PI/2,half:.55},delay:1.25,active:.4,damage:28,color:0xa884ec}],duration:1.65,cooldown:enraged?1.5:2.2};
  if(behavior==='rally')return {areas:[{shape:{kind:'circle',...origin,radius:120},delay:1.2,active:.2,damage:0,color:0xb79ee6}],duration:1.4,cooldown:4.2};
  if(behavior==='devour')return turn%2===0?{areas:[fan(155,.9,18,0xc6a2ed)],duration:1.35,cooldown:3}:{areas:[circle(target.x,target.y,42,1.25,.25,18,0xedd08a)],duration:1.5,cooldown:3};
  if(behavior==='lightning-mark')return {areas:[circle(target.x,target.y,38,1.2,.25,15,0xf5df79)],duration:1.45,cooldown:3.8};
  if(behavior==='lightning-bands')return {areas:[-60,60,0].map((offset,i)=>turn%2===0?line(clamp(target.x+offset,40,350),64,clamp(target.x+offset,40,350),602,18,1.1+i*.4,25,0xf5df79):line(23,clamp(target.y+offset,85,580),367,clamp(target.y+offset,85,580),18,1.1+i*.4,25,0xf5df79)),duration:2.15,cooldown:enraged?1.3:2};
  if(behavior==='summon'||behavior==='pharaoh'&&turn%2===0){
    const points=[-45,45].map(offset=>({x:clamp(origin.x+offset,35,355),y:clamp(origin.y+55,75,590)}));
    return {areas:points.map(p=>circle(p.x,p.y,24,1.2,.2,0,0xe4be7a)),summon:{points,start:1.2,limit:behavior==='summon'?6:12},duration:1.4,cooldown:4};
  }
  if(behavior==='pharaoh'){
    const angles=Array.from({length:10},(_,i)=>angle+i*Math.PI/5);
    return {areas:angles.map(a=>line(origin.x,origin.y,origin.x+Math.cos(a)*600,origin.y+Math.sin(a)*600,17,1.2,0,0xe4be7a)),projectiles:{origin,angles,start:1.2,speed:100,damage:21},duration:1.45,cooldown:enraged?1.5:2.2};
  }
  if(behavior==='water-ring'||behavior==='tide-wave'&&turn%2===0)return {areas:[{shape:{kind:'ring',...origin,radius:130,width:16,angle:angle+Math.PI/2,half:.5},delay:1.2,active:.4,damage:behavior==='water-ring'?15:25,color:0x85dfe5}],duration:1.6,cooldown:behavior==='water-ring'?3.8:enraged?1.4:2};
  if(behavior==='tide-wave')return {areas:[line(23,clamp(target.y,90,570),367,clamp(target.y,90,570),24,1.4,26,0x85dfe5)],duration:1.65,cooldown:enraged?1.4:2};
  if(behavior==='rift-slash'){
    const to={x:clamp(target.x,35,355),y:clamp(target.y,75,590)};
    return {areas:[circle(to.x,to.y,42,1.4,.25,16,0xc298f3)],jump:{to,start:1.1},duration:1.65,cooldown:3.8};
  }
  if(behavior==='rift-pair')return {areas:[-45,45].map((offset,i)=>circle(target.x+offset,target.y,58,1.1+i*.55,.3,26,0xc298f3)),duration:1.95,cooldown:enraged?1.2:1.9};
  if(behavior==='wind-fan')return {areas:[fan(200,.45,13,0xb6ddec)],duration:1.35,cooldown:3.5};
  if(behavior==='shield'||behavior==='mirror-shield')return {areas:[fan(behavior==='shield'?90:175,.8,behavior==='shield'?14:24,0x89dfdf)],duration:1.35,cooldown:behavior==='shield'?2.8:enraged?1.8:2.5};
  if(behavior==='leap'||behavior==='moon-dance'&&turn%2===0){
    const to={x:clamp(target.x,35,355),y:clamp(target.y,75,590)};
    return {areas:[circle(to.x,to.y,behavior==='leap'?38:65,1.15,.25,behavior==='leap'?14:25,0xd3a0eb)],jump:{to,start:1.15},duration:1.4,cooldown:behavior==='leap'?3.8:enraged?1.4:2};
  }
  if(behavior==='moon-dance')return {areas:[fan(260,.9,24,0xd3a0eb)],duration:1.35,cooldown:enraged?1.4:2};
  if(behavior==='heal')return {areas:[{shape:{kind:'circle',...origin,radius:110},delay:1.1,active:.2,damage:0,color:0xa8df94}],duration:1.3,cooldown:4};
  if(behavior==='wing-lightning')return turn%2===0?{areas:[fan(280,.65,24,0x9edff2)],duration:1.35,cooldown:enraged?1.3:2}:{areas:[-75,0,75].map((offset,i)=>circle(target.x+offset,target.y,36,1.1+i*.35,.22,24,0xf5da83)),duration:2.02,cooldown:enraged?1.3:2};
  if(behavior==='root-seed')return turn%2===0?{areas:[-70,0,70].map((offset,i)=>circle(target.x,target.y+offset,35,1+i*.35,.25,23,0xb3d78d)),duration:1.95,cooldown:enraged?1.2:1.9}:{areas:[circle(target.x,target.y,70,1.3,.3,26,0xe6c97e)],duration:1.6,cooldown:enraged?1.2:1.9};
  if(behavior==='poison')return {areas:[circle(target.x,target.y,36,.95,1.6,10,0xb5d86f)],duration:2.55,cooldown:3.8};
  if(behavior==='falling-fire')return {areas:[circle(target.x,target.y,40,1.1,.22,15,0xffb572)],duration:1.32,cooldown:3.2};
  if(behavior==='spores'){
    const horizontal=turn%2===0;
    const areas=[-65,65,0].map((offset,i)=>circle(target.x+(horizontal?offset:0),target.y+(horizontal?0:offset),enraged?42:38,i<2?1:1.8,.3,22,0xd5a4e0));
    return {areas,duration:2.1,cooldown:enraged?1.3:1.9};
  }
  if(behavior==='hammer-fan'){
    const areas:DangerArea[]=turn%2===0?[circle(target.x,target.y,62,1.1,.25,25,0xffb572)]:[{shape:{kind:'fan',...origin,angle,half:Math.PI/4,radius:230},delay:1.1,active:.25,damage:23,color:0xffb572}];
    return {areas,duration:1.35,cooldown:enraged?1.2:1.9};
  }
  const javelin=behavior==='javelin',boss=behavior==='burrow'||behavior==='wolf-dash';
  const distance=Math.min(javelin?440:boss?300:150,length+(javelin?220:30));
  const to={x:clamp(origin.x+dx/length*distance,23,367),y:clamp(origin.y+dy/length*distance,64,602)};
  const delay=1,duration=javelin?.18:Math.hypot(to.x-origin.x,to.y-origin.y)/235;
  const area:DangerArea={shape:{kind:'line',...origin,endX:to.x,endY:to.y,radius:javelin?12:boss?44:24},delay,active:duration,damage:boss?23:12,color:javelin||behavior==='wolf-dash'?0xa9e0ff:0xffbf85};
  return {areas:[area],duration:delay+duration,cooldown:behavior==='wolf-dash'&&turn%(enraged?3:2)!==(enraged?2:1)?.55:boss?2:3,dash:javelin?undefined:{from:{...origin},to,start:delay,duration}};
}
