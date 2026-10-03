import type Phaser from 'phaser';
import type { DangerArea } from './chapter-attacks.ts';

export interface AttackEffect {
  kind:'slash'|'breath'|'beam'|'bolt'|'wave'|'burst'|'ring';
  x:number;y:number;radius:number;color:number;angle:number;half:number;life:number;duration:number;end?:{x:number;y:number};
}
export function attackEffect(kind:AttackEffect['kind'],x:number,y:number,radius:number,color:number,angle=0,half=Math.PI,end?:{x:number;y:number}):AttackEffect{
  const duration=kind==='breath'?.7:kind==='wave'||kind==='ring'?.6:.5;
  return {kind,x,y,radius,color,angle,half,end,life:duration,duration};
}
export function dangerEffect(area:DangerArea,breath=false):AttackEffect{
  const s=area.shape;
  if(s.kind==='line')return attackEffect('beam',s.x,s.y,s.radius,area.color,0,Math.PI,{x:s.endX,y:s.endY});
  if(s.kind==='fan')return attackEffect(breath?'breath':'slash',s.x,s.y,s.radius,area.color,s.angle,s.half);
  if(s.kind==='ring')return attackEffect('ring',s.x,s.y,s.radius,area.color,s.angle,s.half);
  return attackEffect('wave',s.x,s.y,s.radius,area.color);
}
export function drawAttackEffect(g:Phaser.GameObjects.Graphics,e:AttackEffect){
  if(e.life<=0)return;
  const t=Math.max(0,Math.min(1,1-e.life/e.duration)),alpha=1-t*t,r=e.radius,x=e.x,y=e.y;
  if(e.kind==='beam'&&e.end){
    const width=r*2*(.65+.35*Math.sin(t*Math.PI));
    g.lineStyle(width,e.color,alpha*.28);g.lineBetween(x,y,e.end.x,e.end.y);
    g.lineStyle(Math.max(2,width*.38),e.color,alpha*.8);g.lineBetween(x,y,e.end.x,e.end.y);
    g.lineStyle(Math.max(1,width*.12),0xfff4d6,alpha);g.lineBetween(x,y,e.end.x,e.end.y);
  }else if(e.kind==='bolt'&&e.end){
    const dx=e.end.x-x,dy=e.end.y-y,d=Math.hypot(dx,dy)||1,points=[{x,y}];
    for(let i=1;i<6;i++){const offset=(i%2?1:-1)*(5+Math.sin(t*12+i)*3);points.push({x:x+dx*i/6-dy/d*offset,y:y+dy*i/6+dx/d*offset});}
    points.push(e.end);
    g.lineStyle(9,e.color,alpha*.22);g.strokePoints(points,false);
    g.lineStyle(3,e.color,alpha);g.strokePoints(points,false);
    g.lineStyle(1,0xfff6d7,alpha);g.strokePoints(points,false);
  }else if(e.kind==='slash'){
    const sweep=Math.min(1,.35+t*1.5),end=e.angle-e.half+e.half*2*sweep;
    for(let i=0;i<3;i++){
      const radius=r*(.65+i*.16),start=Math.max(e.angle-e.half,end-e.half*1.25);
      g.lineStyle(6-i,e.color,alpha*.65);g.beginPath();g.arc(x,y,radius,start,end);g.strokePath();
      g.lineStyle(1.5,0xfff4d6,alpha);g.beginPath();g.arc(x,y,radius,start,end);g.strokePath();
    }
  }else if(e.kind==='breath'){
    // The full cone is visible on release; flowing embers show its direction without changing its reach.
    g.fillStyle(e.color,alpha*.12);g.beginPath();g.slice(x,y,r,e.angle-e.half,e.angle+e.half,false);g.fillPath();
    for(let i=0;i<9;i++){
      const a=e.angle+(i%3-1)*e.half*.65,travel=(i/9+t*1.15)%1,d=r*(.15+travel*.78),size=(3+travel*10)*alpha;
      const px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;
      g.lineStyle(size*1.6,e.color,alpha*(1-travel)*.7);g.lineBetween(px-Math.cos(a)*r*.16,py-Math.sin(a)*r*.16,px,py);
      g.fillStyle(0xfff1bd,alpha*(1-travel)*.8);g.fillCircle(px,py,size*.35);
    }
  }else if(e.kind==='ring'){
    // Keep the safe gap open throughout the afterglow.
    g.lineStyle(12,e.color,alpha*.2);g.beginPath();g.arc(x,y,r,e.angle+e.half,e.angle+Math.PI*2-e.half);g.strokePath();
    g.lineStyle(3,0xffeed0,alpha*.8);g.beginPath();g.arc(x,y,r,e.angle+e.half,e.angle+Math.PI*2-e.half);g.strokePath();
  }else if(e.kind==='wave'){
    for(let i=0;i<2;i++){
      const radius=r*Math.min(1,.3+t*.7+i*.18);
      g.lineStyle(8,e.color,alpha*.2);g.strokeCircle(x,y,radius);
      g.lineStyle(2,e.color,alpha*(i?.45:1));g.strokeCircle(x,y,radius);
    }
    for(let i=0;i<8;i++){const a=i*Math.PI/4,d=r*(.3+t*.65);g.fillStyle(e.color,alpha*.7);g.fillCircle(x+Math.cos(a)*d,y+Math.sin(a)*d,2.5*alpha);}
  }else{
    g.fillStyle(0xfff4d6,alpha*.8);g.fillCircle(x,y,Math.max(0,4*(1-t)));
    g.lineStyle(2,e.color,alpha);
    for(let i=0;i<6;i++){const a=i*Math.PI/3,d=r*(.25+t*.75);g.lineBetween(x+Math.cos(a)*d*.5,y+Math.sin(a)*d*.5,x+Math.cos(a)*d,y+Math.sin(a)*d);}
  }
}
export function drawAttackProjectile(g:Phaser.GameObjects.Graphics,kind:string,x:number,y:number,dx:number,dy:number,color:number,time:number){
  const speed=Math.hypot(dx,dy)||1,ux=dx/speed,uy=dy/speed,length=Math.min(32,speed*.1),angle=Math.atan2(dy,dx);
  g.lineStyle(kind==='dash'?10:7,color,.18);g.lineBetween(x-ux*length,y-uy*length,x,y);
  g.lineStyle(2,color,.8);g.lineBetween(x-ux*length,y-uy*length,x,y);
  if(kind==='dash'){
    for(const side of [-1,1]){g.lineStyle(1,color,.4);g.lineBetween(x-ux*length-uy*side*9,y-uy*length+ux*side*9,x-uy*side*9,y+ux*side*9);}
  }else if(kind==='return'){
    const a=angle+time*7;
    g.lineStyle(4,color,.9);g.beginPath();g.arc(x,y,9,a,a+Math.PI*1.35);g.strokePath();
    g.lineStyle(1,0xfff4d6,1);g.beginPath();g.arc(x,y,7,a,a+Math.PI*1.35);g.strokePath();
  }else if(kind==='pierce'||kind==='fan'){
    g.fillStyle(color,.9);g.fillTriangle(x+ux*10,y+uy*10,x-ux*7-uy*4,y-uy*7+ux*4,x-ux*7+uy*4,y-uy*7-ux*4);
    g.lineStyle(1,0xf0fcff,1);g.lineBetween(x-ux*5,y-uy*5,x+ux*8,y+uy*8);
  }else {g.fillStyle(color,.18);g.fillCircle(x,y,9);g.fillStyle(0xfff4d6,.9);g.fillCircle(x,y,2.5);}
}
