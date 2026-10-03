import Phaser from 'phaser';
import { attackEffect, drawAttackEffect, drawAttackProjectile, type AttackEffect } from './attack-effects.ts';
import { PET_WINDUP, ATTACK_RELEASE, advancePetAttack, petMoveSpeed } from './creature-motion.ts';
import { PETS, type PetId, type PetDefinition } from './pets.ts';

export const FLYING_PETS:readonly PetId[]=['frostOwl','windFalcon','tideWhale','crimsonDragon','dawnGriffin','dawnStarDragon'];

export interface PetTarget {id:number;hp:number;radius:number;sprite:{x:number;y:number};}
interface Companion {id:PetId;sprite:Phaser.GameObjects.Sprite;cooldown:number;target:number|null;returning:boolean;motion:number;attack?:{target:number;elapsed:number;angle:number};dash?:{x:number;y:number;hit:Set<number>};}
interface PetShot {id:PetId;sprite:Phaser.GameObjects.Arc;dx:number;dy:number;life:number;hit:Set<number>;returning?:boolean;origin?:{x:number;y:number};}

export class PetParty<T extends PetTarget> {
  private companions:Companion[]=[];
  private shots:PetShot[]=[];
  private effects:AttackEffect[]=[];
  private graphics:Phaser.GameObjects.Graphics;
  constructor(private scene:Phaser.Scene,private hero:{x:number;y:number},private hit:(enemy:T,damage:number)=>void,private moveSpeed:()=>number=()=>petMoveSpeed(0)){
    this.graphics=scene.add.graphics().setDepth(790);
  }
  sync(pets:readonly PetId[]){
    for(const id of pets)if(!this.companions.some(p=>p.id===id)){
      const i=this.companions.length;
      this.companions.push({id,sprite:this.scene.add.sprite(Math.max(23,Math.min(367,this.hero.x+[-40,40,0][i])),Math.min(602,this.hero.y+[24,24,48][i]),`pet-${id}`,0).setDisplaySize(44,44).setOrigin(.5,.82),cooldown:0,target:null,returning:false,motion:i*.17});
    }
  }
  clearAttacks(){for(const p of this.companions){p.dash=undefined;p.attack=undefined;}for(const shot of this.shots)shot.sprite.destroy();this.shots=[];this.effects=[];this.graphics.clear();}
  destroy(){this.clearAttacks();for(const p of this.companions)p.sprite.destroy();this.companions=[];this.graphics.destroy();}
  private effect(x:number,y:number,p:PetDefinition,angle=0,half=Math.PI){this.effects.push(attackEffect(p.attack==='claw'?'slash':p.attack==='breath'||p.attack==='starlight'?'breath':'wave',x,y,p.radius||18,p.color,angle,half));}
  step(dt:number,enemies:T[],attack=true){
    if(dt<=0)return;
    this.graphics.clear();
    for(const [i,p] of this.companions.entries()){
      const def:PetDefinition=PETS[p.id];p.cooldown-=dt;p.motion+=dt;
      const heroDistance=Math.hypot(p.sprite.x-this.hero.x,p.sprite.y-this.hero.y);
      if(heroDistance>460)p.returning=true;
      if(heroDistance<70)p.returning=false;
      // Keep the current enemy until it dies or leaves the leash; acquire from the pet's position.
      let target=attack&&!p.returning?enemies.find(e=>e.id===p.target&&e.hp>0&&Math.hypot(e.sprite.x-this.hero.x,e.sprite.y-this.hero.y)<=460):undefined;
      if(attack&&!p.returning&&!target){
        let nearest=Infinity;
        for(const e of enemies)if(e.hp>0&&Math.hypot(e.sprite.x-this.hero.x,e.sprite.y-this.hero.y)<=420){
          const distance=Math.hypot(e.sprite.x-p.sprite.x,e.sprite.y-p.sprite.y);
          if(distance<nearest){nearest=distance;target=e;}
        }
      }
      if(p.attack){
        target=enemies.find(e=>e.id===p.attack!.target&&e.hp>0);
        if(!attack||p.returning||(!target&&p.attack.elapsed<PET_WINDUP)){p.attack=undefined;p.cooldown=0;}
      }
      if(!attack||p.returning){target=undefined;p.attack=undefined;p.dash=undefined;}
      p.target=target?.id??null;
      if(p.dash){
        const x=p.sprite.x,y=p.sprite.y,dx=p.dash.x-x,dy=p.dash.y-y,d=Math.hypot(dx,dy),step=Math.min(d,this.moveSpeed()*dt);
        p.sprite.setPosition(x+dx/(d||1)*step,y+dy/(d||1)*step).setDepth(p.sprite.y).setFrame(6);
        const vx=p.sprite.x-x,vy=p.sprite.y-y,length=vx*vx+vy*vy;
        drawAttackProjectile(this.graphics,'dash',p.sprite.x,p.sprite.y,vx/dt,vy/dt,def.color,p.motion);
        for(const e of enemies){const t=length?Math.max(0,Math.min(1,((e.sprite.x-x)*vx+(e.sprite.y-y)*vy)/length)):0;if(e.hp>0&&!p.dash.hit.has(e.id)&&Math.hypot(e.sprite.x-x-vx*t,e.sprite.y-y-vy*t)<=def.radius+e.radius){p.dash.hit.add(e.id);this.hit(e,def.damage);}}
        if(step===d){p.dash=undefined;if(p.attack)p.attack.elapsed=PET_WINDUP+ATTACK_RELEASE;}
        continue;
      }
      const reach=['claw','pulse','breath','starlight'].includes(def.attack)?def.radius:def.range;
      const standOff=def.attack==='claw'?24:Math.min(150,reach*.7);
      const x=target?target.sprite.x:Math.max(23,Math.min(367,this.hero.x+[-40,40,0][i])),y=target?target.sprite.y:Math.max(64,Math.min(602,this.hero.y+[24,24,48][i]));
      const dx=x-p.sprite.x,dy=y-p.sprite.y,d=Math.hypot(dx,dy),step=p.attack?0:Math.min(Math.max(0,d-(target?standOff:3)),this.moveSpeed()*dt);
      p.sprite.x+=dx/(d||1)*step;p.sprite.y+=dy/(d||1)*step;p.sprite.setDepth(p.sprite.y);
      if(!p.attack&&Math.abs(dx)>3)p.sprite.setFlipX(dx<0);
      const inRange=target&&Math.hypot(target.sprite.x-p.sprite.x,target.sprite.y-p.sprite.y)<=reach;
      if(!p.attack){
        p.sprite.setFrame(step>.1||FLYING_PETS.includes(p.id)?Math.floor(p.motion*(FLYING_PETS.includes(p.id)?9:7.2))%4:0);
        if(!inRange||!target||p.cooldown>0)continue;
        p.attack={target:target.id,elapsed:0,angle:Math.atan2(target.sprite.y-p.sprite.y,target.sprite.x-p.sprite.x)};
        p.cooldown=def.interval;p.sprite.setFrame(4);
        if(Math.abs(Math.cos(p.attack.angle))>.05)p.sprite.setFlipX(Math.cos(p.attack.angle)<0);
        continue;
      }
      if(p.attack.elapsed<PET_WINDUP&&target){
        p.attack.angle=Math.atan2(target.sprite.y-p.sprite.y,target.sprite.x-p.sprite.x);
        if(Math.abs(Math.cos(p.attack.angle))>.05)p.sprite.setFlipX(Math.cos(p.attack.angle)<0);
      }
      const playback=advancePetAttack(p.attack.elapsed,dt);p.attack.elapsed=playback.elapsed;p.sprite.setFrame(playback.frame);
      if(playback.done){p.attack=undefined;continue;}
      if(!playback.release||!inRange||!target)continue;
      const a=p.attack.angle;
      if(def.attack==='chain'){
        const hit=new Set<number>();let next:T|undefined=target,from={x:p.sprite.x,y:p.sprite.y};
        while(next&&hit.size<def.targets){
          const end={x:next.sprite.x,y:next.sprite.y};hit.add(next.id);this.hit(next,def.damage);
          this.effects.push(attackEffect('bolt',from.x,from.y,2,def.color,0,Math.PI,end));from=end;
          next=enemies.filter(e=>e.hp>0&&!hit.has(e.id)&&Math.hypot(e.sprite.x-from.x,e.sprite.y-from.y)<=def.radius).sort((a,b)=>Math.hypot(a.sprite.x-from.x,a.sprite.y-from.y)-Math.hypot(b.sprite.x-from.x,b.sprite.y-from.y))[0];
        }
      }else if(def.attack==='wave'){
        for(const e of enemies)if(e.hp>0&&Math.hypot(e.sprite.x-target.sprite.x,e.sprite.y-target.sprite.y)<=def.radius)this.hit(e,def.damage);
        this.effect(target.sprite.x,target.sprite.y,def);
      }else if(def.attack==='beam'){
        const x=p.sprite.x,y=p.sprite.y,dx=Math.cos(a)*def.range,dy=Math.sin(a)*def.range,end={x:x+dx,y:y+dy};
        for(const e of enemies){const t=Math.max(0,Math.min(1,((e.sprite.x-x)*dx+(e.sprite.y-y)*dy)/(dx*dx+dy*dy)));if(e.hp>0&&Math.hypot(e.sprite.x-x-dx*t,e.sprite.y-y-dy*t)<=def.radius)this.hit(e,def.damage);}
        this.effects.push(attackEffect('beam',x,y,def.radius,def.color,a,Math.PI,end));
      }else if(def.attack==='dash'){
        const end={x:Math.max(23,Math.min(367,target.sprite.x+Math.cos(a)*45)),y:Math.max(64,Math.min(602,target.sprite.y+Math.sin(a)*45))};
        p.dash={...end,hit:new Set()};
      }else if(def.attack==='claw'){
        if(Math.hypot(target.sprite.x-p.sprite.x,target.sprite.y-p.sprite.y)>def.radius)continue;
        this.hit(target,def.damage);this.effect(p.sprite.x,p.sprite.y,def,a,.55);
      }else if(def.attack==='pulse'){
        if(Math.hypot(target.sprite.x-p.sprite.x,target.sprite.y-p.sprite.y)>def.radius)continue;
        for(const e of enemies)if(e.hp>0&&Math.hypot(e.sprite.x-p.sprite.x,e.sprite.y-p.sprite.y)<=def.radius)this.hit(e,def.damage);
        this.effect(p.sprite.x,p.sprite.y,def);
      }else if(def.attack==='breath'||def.attack==='starlight'){
        const half=def.angle*Math.PI/360;
        for(const e of enemies)if(e.hp>0&&Math.hypot(e.sprite.x-p.sprite.x,e.sprite.y-p.sprite.y)<=def.radius&&Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.sprite.y-p.sprite.y,e.sprite.x-p.sprite.x)-a))<=half)this.hit(e,def.damage);
        this.effect(p.sprite.x,p.sprite.y,def,a,half);
        if(def.attack==='starlight'){
          const x=target.sprite.x,y=target.sprite.y;
          for(const e of enemies)if(e.hp>0&&Math.hypot(e.sprite.x-x,e.sprite.y-y)<=60)this.hit(e,130);
          this.effects.push(attackEffect('wave',x,y,60,def.color));
        }
      }else if(def.attack==='fan'&&this.shots.length<=21){
        const hit=new Set<number>();
        for(const offset of [-1,0,1]){
          const direction=a+offset*def.angle*Math.PI/360;
          this.shots.push({id:p.id,sprite:this.scene.add.circle(p.sprite.x,p.sprite.y,4,def.color).setDepth(795),dx:Math.cos(direction)*300,dy:Math.sin(direction)*300,life:1.2,hit});
        }
      }else if(def.attack==='return'&&this.shots.length<=22){
        const hit=new Set<number>(),origin={x:p.sprite.x,y:p.sprite.y};
        for(const offset of [-1,1]){
          const direction=a+offset*def.angle*Math.PI/360;
          this.shots.push({id:p.id,sprite:this.scene.add.circle(origin.x,origin.y,5,def.color).setDepth(795),dx:Math.cos(direction)*300,dy:Math.sin(direction)*300,life:1.4,hit,origin,returning:false});
        }
      }else if(def.attack!=='fan'&&def.attack!=='return'&&this.shots.length<24){
        this.shots.push({id:p.id,sprite:this.scene.add.circle(p.sprite.x,p.sprite.y,def.attack==='pierce'?5:4,def.color).setDepth(795),dx:Math.cos(a)*300,dy:Math.sin(a)*300,life:1.2,hit:new Set()});
      }
    }
    for(const shot of this.shots){
      const def:PetDefinition=PETS[shot.id],x=shot.sprite.x,y=shot.sprite.y;
      if(shot.origin&&shot.life<=.7){
        if(!shot.returning){shot.returning=true;shot.hit=new Set();}
        const dx=shot.origin.x-x,dy=shot.origin.y-y,d=Math.hypot(dx,dy);
        if(d<10)shot.life=0;else{shot.dx=dx/d*300;shot.dy=dy/d*300;}
      }
      shot.life-=dt;shot.sprite.x+=shot.dx*dt;shot.sprite.y+=shot.dy*dt;
      const dx=shot.sprite.x-x,dy=shot.sprite.y-y,length=dx*dx+dy*dy;
      const candidates=enemies.filter(e=>e.hp>0&&!shot.hit.has(e.id)).map(e=>({e,t:length?Math.max(0,Math.min(1,((e.sprite.x-x)*dx+(e.sprite.y-y)*dy)/length)):0})).filter(({e,t})=>Math.hypot(e.sprite.x-x-dx*t,e.sprite.y-y-dy*t)<=e.radius+5).sort((a,b)=>a.t-b.t);
      for(const {e} of candidates){
        if(shot.life<=0)break;
        shot.hit.add(e.id);
        if(def.attack==='blast'){
          const cx=e.sprite.x,cy=e.sprite.y;
          for(const other of enemies)if(other.hp>0&&(other===e||Math.hypot(other.sprite.x-cx,other.sprite.y-cy)<=def.radius))this.hit(other,def.damage);
          this.effect(cx,cy,def);
        }else{this.hit(e,def.damage);this.effects.push(attackEffect('burst',e.sprite.x,e.sprite.y,16,def.color));}
        if(def.attack==='fan'||shot.hit.size>=def.targets)shot.life=0;
      }
      if(shot.life<=0)shot.sprite.destroy();
      else{shot.sprite.setAlpha(0);drawAttackProjectile(this.graphics,def.attack,shot.sprite.x,shot.sprite.y,shot.dx,shot.dy,def.color,shot.life);}
    }
    this.shots=this.shots.filter(s=>s.life>0);
    for(const e of this.effects){e.life-=dt;drawAttackEffect(this.graphics,e);}
    this.effects=this.effects.filter(e=>e.life>0);
  }
}
