import Phaser from 'phaser';
import { assetPath } from './asset-path.ts';
import { CHAPTERS, DURATIONS, MISSIONS, applyUpgrade, bossType, encounter, experienceForLevel, hasSynergy, isEvolved, rng, upgradeChoices, type Run, type UpgradeId } from './core.ts';
import { WEAPONS, weaponDamage, skillDamage, weaponRange, weaponCooldown } from './weapons.ts';
import { CHARACTERS } from './characters.ts';
import { meteorStats, cullMultiplier, resolveMultiplier } from './ability-effects.ts';
import { ENEMIES, isBossEnemy, enemyHealth, enemyDamage } from './enemies.ts';
import { finalBossPhase, planChapterAttack, dangerPhase, containsDanger, type ChapterAttack, type DangerArea } from './chapter-attacks.ts';
import { PETS, PET_IDS, TAME_RADIUS, tameProgress, type PetId } from './pets.ts';
import { PetParty, FLYING_PETS } from './pet-arena.ts';
import { attackEffect, dangerEffect, drawAttackEffect, drawAttackProjectile, type AttackEffect } from './attack-effects.ts';
import { ATTACK_RELEASE, ATTACK_RECOVERY, attackFrame, chapterAttackFrame, playerMoveSpeed, petMoveSpeed } from './creature-motion.ts';

export interface ArenaHooks {
  hud: (run:Run, remaining:number, bossHp:number|null, phase:ArenaPhase, enemies:number) => void;
  upgrade: (run:Run, choose:(id:UpgradeId)=>void) => void;
  complete: (run:Run) => void;
  defeat: (run:Run) => void;
  paused: () => void;
  tame?: (pet:PetId,accept:(pets:PetId[])=>void) => void;
  taming?: (pet:PetId|null,seconds:number,inside:boolean) => void;
}
export type ArenaPhase = 'fighting'|'finalWave'|'clearing'|'loot'|'taming'|'victory';
interface BossState { action:'charge'|'eruption'|'ring'|'fan'; turn:number; followup:boolean; recovery:number; distance:number; enraged:boolean; }
interface Enemy { id:number; sprite:Phaser.GameObjects.Sprite; shadow:Phaser.GameObjects.Ellipse; hp:number; max:number; type:number; radius:number; speed:number; attack:number; windup:number; charge:number; dx:number; dy:number; burn:number; slow:number; flash:number; orbitHit:number; size:number; boss?:BossState; attackTurn:number; summoned:number; rally:number; motion:number; attackPose:number; threat?:{plan:ChapterAttack;elapsed:number}; }
interface Shot { sprite:Phaser.GameObjects.Image|Phaser.GameObjects.Arc; x:number;y:number;dx:number;dy:number;damage:number;life:number;hostile:boolean;pierce:number;hit:Set<number>; style:'fire'|'wave'|'stone'|'spell'|'boomerang'; flight?:{remaining:number;returning:boolean;evolved:boolean}; }
interface HammerStrike {x:number;y:number;damage:number;radius:number;remaining:number;evolved:boolean;secondary:boolean;sprite:Phaser.GameObjects.Image|null;}
interface MeteorStrike {x:number;y:number;damage:number;radius:number;remaining:number;sprite:Phaser.GameObjects.Image;}
interface Drop { sprite:Phaser.GameObjects.Image; value:number; }
interface Visual {kind:'slash'|'ring'|'bolt'|'burst';x:number;y:number;r:number;angle:number;half:number;color:number;life:number;duration:number;points?:{x:number;y:number}[];sprite?:Phaser.GameObjects.Image;}
export const MAP = {
  width:390, height:660, walkBounds:{left:23,right:367,top:64,bottom:602},
  spawn:{x:195,y:490}, exit:{x:195,y:68},
  blockers:[{x:69,y:265,r:15},{x:319,y:345,r:15}],
  props:[{frame:2,x:69,y:265,w:50,h:50,sortY:265},{frame:2,x:319,y:345,w:50,h:50,sortY:345}],
};
export class Arena extends Phaser.Scene {
  run:Run; hooks:ArenaHooks; phase:ArenaPhase='fighting';
  private hero!:Phaser.GameObjects.Sprite;
  private shadow!:Phaser.GameObjects.Ellipse;
  private effects!:Phaser.GameObjects.Graphics;
  private joystick!:Phaser.GameObjects.Graphics;
  private visuals:Visual[]=[];
  private enemyEffects:AttackEffect[]=[];
  private explosions:{x:number;y:number;damage:number}[]=[];
  private pendingHammer:HammerStrike|null=null;
  private pendingMeteor:MeteorStrike|null=null;
  private meteorTimer:number=meteorStats({meteor:1})!.initialDelay;
  private enemies:Enemy[]=[]; private shots:Shot[]=[]; private drops:Drop[]=[];
  private random:()=>number; private clock=0; private spawnTimer=.6; private attackTimer=0; private stormTimer=1; private novaTimer=2; private mendTimer=8; private hitTimer=0; private hudTimer=0; private elapsedStart=0; private phaseTimer=0;
  private pointer:{input:Phaser.Input.Pointer;x:number;y:number}|null=null;
  private direction=0; private moving=false; private finished=false; private choosing=false; private nextId=0;
  private keys?:Record<string,Phaser.Input.Keyboard.Key>;
  private orbiters:Phaser.GameObjects.Image[]=[];
  private petParty!:PetParty<Enemy>;
  private wildPet?:Phaser.GameObjects.Image;
  private tameRing?:Phaser.GameObjects.Graphics;
  private tameSeconds=0;private savingPet=false;private paused=false;
  constructor(run:Run,hooks:ArenaHooks){
    super('arena'); this.run=structuredClone(run);this.hooks=hooks;
    this.random=rng(run.seed+run.room*1259);this.elapsedStart=run.elapsed;
  }
  preload(){
    const chapter=CHAPTERS[MISSIONS[this.run.mission].chapter];
    this.load.image('ground',assetPath(`/assets/${chapter.asset}.jpg`));
    const character=CHARACTERS[this.run.character];
    this.load.spritesheet(character.textureKey,character.spritePath,{frameWidth:128,frameHeight:128});
    this.load.spritesheet('enemies',assetPath('/assets/animated/enemies.png'),{frameWidth:128,frameHeight:128});
    if(this.chapter()>=3)this.load.spritesheet('enemies-mainline-1',assetPath('/assets/animated/enemies-mainline-1.png'),{frameWidth:128,frameHeight:128});
    for(let batch=2;batch<=Math.min(4,1+Math.floor((this.chapter()-3)/4));batch++)this.load.spritesheet(`enemies-mainline-${batch}`,assetPath(`/assets/animated/enemies-mainline-${batch}.png`),{frameWidth:128,frameHeight:128});
    this.load.spritesheet('props',assetPath('/assets/props.png'),{frameWidth:128,frameHeight:128});
    if(this.run.weapon==='boomerang'||this.run.weapon==='hammer')this.load.spritesheet(this.run.weapon,assetPath(`/assets/weapons/${this.run.weapon}.png`),{frameWidth:128,frameHeight:128});
    this.load.image('meteor',assetPath('/assets/upgrades/meteor.png'));
    for(const id of PET_IDS)this.load.spritesheet(`pet-${id}`,assetPath(`/assets/pets/animated/${id}.png`),{frameWidth:128,frameHeight:128});
  }
  create(){
    this.add.image(195,330,'ground').setDisplaySize(440,700).setAlpha(.88);
    this.add.rectangle(195,330,390,660,0x081923,.14);
    this.effects=this.add.graphics().setDepth(800);
    this.shadow=this.add.ellipse(MAP.spawn.x,MAP.spawn.y+8,28,12,0x06151a,.4);
    const character=CHARACTERS[this.run.character];
    this.hero=this.add.sprite(MAP.spawn.x,MAP.spawn.y,character.textureKey,0).setDisplaySize(67,67).setOrigin(.5,.82);
    this.joystick=this.add.graphics().setDepth(1000);
    this.petParty=new PetParty(this,this.hero,(enemy,damage)=>this.hitPet(enemy,damage),()=>petMoveSpeed(this.level('stride')));this.petParty.sync(this.run.pets);
    if(this.run.petEncounter?.state==='available'){
      this.wildPet=this.add.image(195,330,`pet-${this.run.petEncounter.pet}`,0).setDisplaySize(54,54).setOrigin(.5,.82).setDepth(330);
      this.tameRing=this.add.graphics().setDepth(2);
      this.drawTaming();
    }
    for(let d=0;d<4;d++) if(!this.anims.exists(`${character.animationPrefix}${d}`)) this.anims.create({key:`${character.animationPrefix}${d}`,frames:this.anims.generateFrameNumbers(character.textureKey,{start:d*4,end:d*4+3}),frameRate:8,repeat:-1});
    for(const p of MAP.props)this.add.image(p.x,p.y,'props',p.frame).setOrigin(.5,.85).setDisplaySize(p.w,p.h).setDepth(p.sortY);
    if(this.isBoss())this.spawnEnemy(bossType(this.chapter()),195,130);
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{if(!this.pointer)this.pointer={input:p,x:p.x,y:p.y};});
    const release=(p:Phaser.Input.Pointer)=>{if(this.pointer?.input===p)this.pointer=null;};
    this.input.on('pointerup',release);
    this.input.on('pointerupoutside',release);
    this.input.on('gameout',()=>{this.pointer=null;this.joystick.clear();});
    this.keys=this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    this.game.canvas.addEventListener('contextmenu',e=>e.preventDefault());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.clearAttacks();this.petParty.destroy();});
    this.emitHud();
  }
  private chapter(){return MISSIONS[this.run.mission].chapter;}
  private isBoss(){return this.run.room===6&&this.run.mission%2===1;}
  private duration(){return DURATIONS[this.run.room];}
  private level(id:UpgradeId){return this.run.upgrades[id]??0;}
  pause(){this.paused=true;this.pointer=null;this.joystick?.clear();if(this.scene.isActive())this.scene.pause();}
  resume(){if(!this.finished&&!this.savingPet){this.paused=false;this.pointer=null;this.scene.resume();}}
  getRun(){return structuredClone(this.run);}
  private damage(){return weaponDamage(this.run);}
  private range(){return weaponRange(this.run,isEvolved(this.run));}
  private spawnEnemy(type:number,x?:number,y?:number){
    if(this.enemies.filter(e=>e.hp>0).length>=160)return;
    if(x===undefined){
      const side=Math.floor(this.random()*4);x=side===0?18:side===1?372:25+this.random()*340;y=side===2?62:side===3?603:65+this.random()*535;
      if(Math.hypot(x-this.hero.x,y-this.hero.y)<150){x=390-x;y=660-y;}
    }
    y??=90;
    const definition=ENEMIES[type],boss=definition.boss,hard=this.run.difficulty==='hard';
    const hp=enemyHealth(type,this.chapter(),this.run.room,hard),size=definition.size;
    const sprite=this.add.sprite(x,y,definition.texture,definition.frame*8).setDisplaySize(size,size).setOrigin(.5,.78).setDepth(y);
    const shadow=this.add.ellipse(x,y+3,boss?67:23,boss?25:10,0x041419,.45).setDepth(y-1);
    this.enemies.push({id:this.nextId++,sprite,shadow,hp,max:hp,type,radius:definition.radius,speed:definition.speed*(!boss&&hard?1.1:1),attack:1.3+this.random()*2,windup:0,charge:0,dx:0,dy:0,burn:0,slow:0,flash:0,orbitHit:0,size,attackTurn:0,summoned:0,rally:0,motion:this.nextId*.17,attackPose:0,boss:boss?{action:'charge',turn:0,followup:false,recovery:0,distance:0,enraged:false}:undefined});
  }
  private hitPet(enemy:Enemy,damage:number){this.hit(enemy,damage,false,true);}
  private hit(enemy:Enemy,damage:number,secondary=false,pet=false){
    if(enemy.hp<=0)return;
    const behavior=ENEMIES[enemy.type].behavior;
    if(!pet&&enemy.threat&&(behavior==='shield'||behavior==='mirror-shield')){
      const facing=enemy.threat.plan.areas[0].shape;
      if(facing.kind==='fan'&&Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(this.hero.y-enemy.sprite.y,this.hero.x-enemy.sprite.x)-facing.angle))<Math.PI/2)damage*=.45;
    }
    if(!pet)damage*=cullMultiplier(this.run.upgrades,enemy.hp,enemy.max,secondary);
    if(!pet&&!secondary&&this.random()<this.level('focus')*.12)damage*=2;
    enemy.hp-=damage;
    if(!secondary){
      enemy.flash=.1;enemy.sprite.setTint(0xffe7ad);
      if(!pet&&this.level('ember'))enemy.burn=2;
      if(!pet&&this.level('frost'))enemy.slow=Math.max(enemy.slow,1.5);
      this.addVisual('burst',enemy.sprite.x,enemy.sprite.y-12,12,0xffd68c);
    }
    if(enemy.hp<=0){
      const {x,y}=enemy.sprite;
      if(!pet&&enemy.burn>0&&hasSynergy(this.run,'wildfire'))this.explosions.push({x,y,damage:skillDamage(this.run)*.8});
      this.addVisual('burst',x,y-10,isBossEnemy(enemy.type)?85:25,enemy.burn>0?0xff9c50:0xadd9b3);
      enemy.sprite.destroy();enemy.shadow.destroy();this.run.kills++;
      if(this.run.kills%12===0)this.run.embers+=Math.round(1+this.run.growth.embers);
      const value=ENEMIES[enemy.type].experience*(1+this.run.growth.experience);
      if(this.drops.length>=180)this.drops[this.drops.length-1].value+=value;
      else this.drops.push({sprite:this.add.image(x,y,'props',8).setDisplaySize(isBossEnemy(enemy.type)?27:13,isBossEnemy(enemy.type)?27:13).setDepth(3),value});
      if(this.random()<.025)this.run.hp=Math.min(this.run.maxHp,this.run.hp+4);
    }
  }
  private hurt(amount:number){
    if(this.hitTimer>0||this.finished||this.phase==='loot'||this.phase==='taming'||this.phase==='victory')return;
    this.hitTimer=.8;this.run.hp=Math.max(0,this.run.hp-amount*(1-this.level('ward')*.12)*resolveMultiplier(this.run.upgrades,this.run.hp,this.run.maxHp));
    this.hero.setTint(0xff8b83);
    if(this.run.hp<=0){
      if(this.level('secondwind')&&!this.run.secondWindUsed){this.run.secondWindUsed=true;this.run.hp=this.run.maxHp*.4;this.hitTimer=2.5;}
      else {this.finished=true;this.clearAttacks();this.pause();this.hooks.defeat(this.getRun());}
    }
  }
  private shoot(x:number,y:number,dx:number,dy:number,damage:number,hostile=false,style:Shot['style']=hostile?'spell':'fire'){
    if(this.shots.length>=260)return;
    const evolved=isEvolved(this.run);
    const sprite=style==='boomerang'?this.add.image(x,y,'boomerang',evolved?1:0).setDisplaySize(evolved?48:36,evolved?48:36):style==='stone'?this.add.circle(x,y,8,0x9fada8).setStrokeStyle(2,0x394f4a):this.add.image(x,y,'props',style==='wave'?5:hostile?6:4).setDisplaySize(style==='wave'?58:hostile?23:27,style==='wave'?58:hostile?23:27);
    sprite.setDepth(750).setRotation(Math.atan2(dy,dx));
    if(hostile&&sprite instanceof Phaser.GameObjects.Image)sprite.setTint(0xffa2bf);
    this.shots.push({sprite,x,y,dx,dy,damage,life:hostile||style==='boomerang'?5:1.6,hostile,pierce:style==='boomerang'?(evolved?WEAPONS.boomerang.evolvedHitLimit:WEAPONS.boomerang.hitLimit)+this.level('pierce')-1:style==='wave'?99:1+this.level('pierce'),hit:new Set(),style,flight:style==='boomerang'?{remaining:this.range(),returning:false,evolved}:undefined});
  }
  private autoAttack(){
    const enemies=this.enemies.filter(e=>e.hp>0).sort((a,b)=>Phaser.Math.Distance.Between(this.hero.x,this.hero.y,a.sprite.x,a.sprite.y)-Phaser.Math.Distance.Between(this.hero.x,this.hero.y,b.sprite.x,b.sprite.y));
    if(!enemies.length)return;
    const target=enemies[0], angle=Math.atan2(target.sprite.y-this.hero.y,target.sprite.x-this.hero.x),range=this.range(),evolved=isEvolved(this.run);
    if(Phaser.Math.Distance.Between(this.hero.x,this.hero.y,target.sprite.x,target.sprite.y)>range)return;
    if(this.run.weapon==='staff'){
      const count=2+this.level('split')+(evolved?2:0);
      for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.15;this.shoot(this.hero.x,this.hero.y-18,Math.cos(a)*290,Math.sin(a)*290,this.damage());}
    }else if(this.run.weapon==='blade'){
      const half=1.2+this.level('split')*.25;
      this.addVisual('slash',this.hero.x,this.hero.y-10,range,evolved?0xa1f2ff:0xffdf9c,angle,half);
      for(const e of enemies){const a=Math.atan2(e.sprite.y-this.hero.y,e.sprite.x-this.hero.x);if(Phaser.Math.Distance.Between(this.hero.x,this.hero.y,e.sprite.x,e.sprite.y)<=range&&Math.abs(Phaser.Math.Angle.Wrap(a-angle))<half)this.hit(e,this.damage());}
      if(evolved)for(let i=0;i<1+Math.floor(this.level('split')/2);i++){const a=angle+(i-.5*Math.floor(this.level('split')/2))*.28;this.shoot(this.hero.x,this.hero.y-10,Math.cos(a)*340,Math.sin(a)*340,this.damage()*.8,false,'wave');}
    }else if(this.run.weapon==='boomerang'){
      const count=1+this.level('split');
      for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.15;this.shoot(this.hero.x,this.hero.y-12,Math.cos(a)*WEAPONS.boomerang.outwardSpeed,Math.sin(a)*WEAPONS.boomerang.outwardSpeed,this.damage(),false,'boomerang');}
    }else if(this.run.weapon==='hammer'){
      const x=target.sprite.x,y=target.sprite.y,radius=WEAPONS.hammer.radius*(1+this.level('reach')*.18)*(1+this.level('split')*.12)*(evolved?1.2:1);
      this.pendingHammer={x,y,radius,damage:this.damage(),remaining:WEAPONS.hammer.delay,evolved,secondary:false,sprite:this.add.image(x,y-70,'hammer',evolved?1:0).setDisplaySize(76,76).setDepth(805)};
    }else{
      this.addVisual('ring',this.hero.x,this.hero.y-10,range,0xa6efe2);
      if(evolved)this.addVisual('ring',this.hero.x,this.hero.y-10,range*.65,0xffe3a0);
      for(const e of enemies)if(Phaser.Math.Distance.Between(this.hero.x,this.hero.y,e.sprite.x,e.sprite.y)<range)this.hit(e,this.damage()*(1+this.level('split')*.25));
    }
  }
  private addVisual(kind:Visual['kind'],x:number,y:number,r:number,color:number,angle=0,half=0){
    if(this.visuals.length>=100){this.visuals.shift()?.sprite?.destroy();}
    const duration=kind==='slash'?.24:kind==='bolt'?.32:kind==='ring'?.42:.25;
    const visual:Visual={kind,x,y,r,color,angle,half,duration,life:duration};
    if(kind==='slash')visual.sprite=this.add.image(x,y,'props',5).setTint(color).setDepth(805);
    this.visuals.push(visual);return visual;
  }
  private addEnemyEffect(effect:AttackEffect){
    if(this.enemyEffects.length>=100)this.enemyEffects.shift();
    this.enemyEffects.push(effect);
  }
  private drawVisuals(dt:number){
    for(const e of this.enemyEffects){e.life-=dt;drawAttackEffect(this.effects,e);}
    this.enemyEffects=this.enemyEffects.filter(e=>e.life>0);
    for(const v of this.visuals){
      v.life-=dt;const progress=1-Math.max(0,v.life)/v.duration,alpha=1-progress;
      if(v.life<=0){v.sprite?.destroy();continue;}
      v.sprite?.setAlpha(alpha);
      if(v.kind==='slash'){
        const sweep=v.angle-v.half+2*v.half*progress;
        v.sprite?.setPosition(v.x+Math.cos(sweep)*v.r*.55,v.y+Math.sin(sweep)*v.r*.55).setRotation(sweep).setDisplaySize(v.r*1.15,v.r*1.15).setAlpha(alpha);
        this.effects.lineStyle(6,v.color,alpha*.65);this.effects.beginPath();this.effects.arc(v.x,v.y,v.r,v.angle-v.half,sweep);this.effects.strokePath();
      }else if(v.kind==='bolt'&&v.points){
        this.effects.lineStyle(7,v.color,alpha*.18);this.effects.strokePoints(v.points,false);
        this.effects.lineStyle(2,0xe5faff,alpha);this.effects.strokePoints(v.points,false);
      }else if(v.kind==='ring'){
        this.effects.lineStyle(12,v.color,alpha*.18);this.effects.strokeCircle(v.x,v.y,v.r*(.3+.7*progress));
        this.effects.lineStyle(3,v.color,alpha*.85);this.effects.strokeCircle(v.x,v.y,v.r*(.3+.7*progress));
      }else{
        this.effects.lineStyle(2,v.color,alpha);
        for(let i=0;i<6;i++){const a=i*Math.PI/3;this.effects.lineBetween(v.x+Math.cos(a)*v.r*progress*.4,v.y+Math.sin(a)*v.r*progress*.4,v.x+Math.cos(a)*v.r*progress,v.y+Math.sin(a)*v.r*progress);}
      }
    }
    this.visuals=this.visuals.filter(v=>v.life>0);
  }
  private move(dt:number){
    let dx=0,dy=0;
    this.joystick.clear();
    if(this.pointer&&!this.pointer.input.isDown)this.pointer=null;
    if(this.pointer){
      const p=this.pointer.input,radius=42,deadzone=6;
      const x=p.x-this.pointer.x,y=p.y-this.pointer.y,len=Math.hypot(x,y);
      if(len>radius){this.pointer.x=p.x-x/len*radius;this.pointer.y=p.y-y/len*radius;}
      const reach=Math.min(radius,len),strength=Math.max(0,(reach-deadzone)/(radius-deadzone));
      dx=len?x/len*strength:0;dy=len?y/len*strength:0;
      this.joystick.lineStyle(1,0xffffff,.32);this.joystick.strokeCircle(this.pointer.x,this.pointer.y,radius);
      this.joystick.fillStyle(0xffffff,.35);this.joystick.fillCircle(this.pointer.x+(len?x/len*reach:0),this.pointer.y+(len?y/len*reach:0),12);
    }
    if(this.keys){dx+=(this.keys.D.isDown||this.keys.RIGHT.isDown?1:0)-(this.keys.A.isDown||this.keys.LEFT.isDown?1:0);dy+=(this.keys.S.isDown||this.keys.DOWN.isDown?1:0)-(this.keys.W.isDown||this.keys.UP.isDown?1:0);}
    const len=Math.hypot(dx,dy);this.moving=len>0;
    if(len){
      const speed=playerMoveSpeed(this.level('stride')),scale=Math.max(1,len);let x=this.hero.x+dx/scale*speed*dt,y=this.hero.y+dy/scale*speed*dt;
      const b=MAP.walkBounds;x=Phaser.Math.Clamp(x,b.left,b.right);y=Phaser.Math.Clamp(y,b.top,b.bottom);
      for(const q of MAP.blockers){const dist=Math.hypot(x-q.x,y-q.y),radius=q.r+10;if(dist<radius){x=q.x+(x-q.x)/(dist||1)*radius;y=q.y+(y-q.y)/(dist||1)*radius;}}
      this.hero.setPosition(x,y);this.direction=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);
      this.hero.play(`${CHARACTERS[this.run.character].animationPrefix}${this.direction}`,true);
    }else{this.hero.stop();this.hero.setFrame(this.direction*4);}
    this.hero.setDepth(this.hero.y);this.shadow.setPosition(this.hero.x,this.hero.y+3).setDepth(this.hero.y-1);
  }
  private finishBossAction(e:Enemy){
    const b=e.boss!;
    if(b.enraged&&!b.followup&&(e.type===6||b.action==='eruption'||(e.type===8&&b.action==='ring'))){
      b.followup=true;b.recovery=.45;e.attack=.45;
    }else{b.followup=false;b.recovery=e.type===6?1:.8;e.attack=e.type===6?2.4:2.2;}
  }
  private bossStep(e:Enemy,dt:number):{x:number;y:number}|null{
    const b=e.boss!,still={x:0,y:0};
    if(b.recovery>0){b.recovery=Math.max(0,b.recovery-dt);return still;}
    if(e.charge>0){
      const speed=e.charge<dt?235*e.charge/dt:235;e.charge=Math.max(0,e.charge-dt);
      if(e.charge===0)this.finishBossAction(e);
      return {x:e.dx*speed,y:e.dy*speed};
    }
    if(e.windup<=0&&e.attack<=0){
      const dx=this.hero.x-e.sprite.x,dy=this.hero.y-e.sprite.y,dist=Math.hypot(dx,dy)||1;
      if(e.type===6&&dist>360)return null;
      if(!b.followup){
        b.enraged=e.hp<=e.max*.5;
        b.action=e.type===6?'charge':e.type===7?(b.turn%2?'ring':'eruption'):(b.turn%2?'fan':'ring');b.turn++;
      }else if(e.type===8)b.action='fan';
      e.windup=.8;
      e.dx=b.action==='charge'?dx/dist:this.hero.x;e.dy=b.action==='charge'?dy/dist:this.hero.y;
      b.distance=Math.min(340,dist+20);
      if(b.action==='charge')b.distance=Math.min(b.distance,e.dx?((e.dx>0?370:20)-e.sprite.x)/e.dx:Infinity,e.dy?((e.dy>0?605:60)-e.sprite.y)/e.dy:Infinity);
      return still;
    }
    if(e.windup<=0)return null;
    e.windup=Math.max(0,e.windup-dt);
    const angle=Math.atan2(e.dy-e.sprite.y,e.dx-e.sprite.x);
    this.effects.lineStyle(2,0xffbc87,.85);
    if(b.action==='charge'){
      const x=e.sprite.x+e.dx*b.distance,y=e.sprite.y+e.dy*b.distance;
      this.effects.lineStyle(100,0xef9b75,.22);this.effects.lineBetween(e.sprite.x,e.sprite.y,x,y);
      this.effects.fillStyle(0xef9b75,.22);this.effects.fillCircle(x,y,50);
    }else if(b.action==='eruption'){
      this.effects.fillStyle(0xe6a86f,.23);this.effects.fillCircle(e.dx,e.dy,56);this.effects.strokeCircle(e.dx,e.dy,56);
    }else if(b.action==='fan'){
      this.effects.fillStyle(0xef9b75,.13);this.effects.slice(e.sprite.x,e.sprite.y-13,660,angle-(b.enraged?.78:.52),angle+(b.enraged?.78:.52),false);this.effects.fillPath();this.effects.strokePath();
    }else this.effects.strokeCircle(e.sprite.x,e.sprite.y,e.radius+12+(1-e.windup/.8)*12);
    if(e.windup>0)return still;
    if(b.action==='charge')e.charge=b.distance/235;
    else{
      if(b.action==='eruption'){
        this.addEnemyEffect(attackEffect('wave',e.dx,e.dy,56,0xffbc87));
        if(Math.hypot(this.hero.x-e.dx,this.hero.y-e.dy)<56)this.hurt(23);
      }else{
        const count=b.action==='fan'?(b.enraged?7:5):e.type===7?(b.enraged?10:8):(b.enraged?14:10);
        const speed=this.run.difficulty==='hard'?127:105;
        for(let k=0;k<count;k++){
          const a=b.action==='fan'?angle+(k-(count-1)/2)*.26:k/count*Math.PI*2+b.turn*.35;
          this.shoot(e.sprite.x,e.sprite.y-13,Math.cos(a)*speed,Math.sin(a)*speed,16,true);
        }
      }
      this.finishBossAction(e);
    }
    return still;
  }
  private drawDanger(area:DangerArea,active:boolean){
    const s=area.shape,g=this.effects;
    g.fillStyle(area.color,active?.4:.18);g.lineStyle(active?4:2,area.color,.9);
    if(s.kind==='circle'){g.fillCircle(s.x,s.y,s.radius);g.strokeCircle(s.x,s.y,s.radius);}
    else if(s.kind==='fan'){g.beginPath();g.slice(s.x,s.y,s.radius,s.angle-s.half,s.angle+s.half,false);g.fillPath();g.strokePath();}
    else if(s.kind==='ring'){g.lineStyle(s.width*2,area.color,active?.5:.25);g.beginPath();g.arc(s.x,s.y,s.radius,s.angle+s.half,s.angle+Math.PI*2-s.half,false);g.strokePath();}
    else{g.lineStyle(s.radius*2,area.color,active?.5:.2);g.lineBetween(s.x,s.y,s.endX,s.endY);g.fillCircle(s.x,s.y,s.radius);g.fillCircle(s.endX,s.endY,s.radius);g.lineStyle(2,area.color,.9);g.lineBetween(s.x,s.y,s.endX,s.endY);}
  }
  private chapterEnemyStep(e:Enemy,dt:number):boolean{
    if(!e.threat){
      if(e.attack>0)return false;
      if(!isBossEnemy(e.type)&&Math.hypot(this.hero.x-e.sprite.x,this.hero.y-e.sprite.y)>290)return false;
      e.threat={plan:planChapterAttack(ENEMIES[e.type].behavior,e.attackTurn++,{x:e.sprite.x,y:e.sprite.y},{x:this.hero.x,y:this.hero.y},e.hp<=e.max*.5,finalBossPhase(e.hp/e.max)),elapsed:0};
    }
    const threat=e.threat,plan=threat.plan,previous=threat.elapsed;
    threat.elapsed+=dt;
    for(const area of plan.areas)if(previous<area.delay&&threat.elapsed>=area.delay){
      e.attackPose=Math.max(0,ATTACK_RELEASE+ATTACK_RECOVERY-(threat.elapsed-area.delay));
      if(!plan.dash||area!==plan.areas[0])this.addEnemyEffect(dangerEffect(area,ENEMIES[e.type].behavior.startsWith('bone-')));
    }
    if(plan.summon&&previous<plan.summon.start&&threat.elapsed>=plan.summon.start&&this.phase!=='clearing'){
      for(const p of plan.summon.points)if(e.summoned<plan.summon.limit&&this.enemies.filter(a=>a.hp>0).length<160){this.spawnEnemy(e.summoned%2?2:0,p.x,p.y);e.summoned++;}
    }
    if(plan.projectiles&&previous<plan.projectiles.start&&threat.elapsed>=plan.projectiles.start){
      const p=plan.projectiles;for(const a of p.angles)this.shoot(p.origin.x,p.origin.y-13,Math.cos(a)*p.speed,Math.sin(a)*p.speed,enemyDamage(p.damage,this.chapter())*(this.run.difficulty==='hard'?1.2:1),true);
    }
    if(plan.jump&&previous<plan.jump.start&&threat.elapsed>=plan.jump.start)e.sprite.setPosition(plan.jump.to.x,plan.jump.to.y);
    if(ENEMIES[e.type].behavior==='heal'&&previous<1.1&&threat.elapsed>=1.1){
      for(const ally of this.enemies.filter(a=>a!==e&&a.hp>0&&!isBossEnemy(a.type)&&Math.hypot(a.sprite.x-e.sprite.x,a.sprite.y-e.sprite.y)<=110).slice(0,10)){
        ally.hp=Math.min(ally.max,ally.hp+ally.max*.12);this.addVisual('ring',ally.sprite.x,ally.sprite.y,18,0xa8df94);
      }
    }
    if(ENEMIES[e.type].behavior==='rally'&&previous<1.2&&threat.elapsed>=1.2){
      for(const ally of this.enemies.filter(a=>a!==e&&a.hp>0&&!isBossEnemy(a.type)&&Math.hypot(a.sprite.x-e.sprite.x,a.sprite.y-e.sprite.y)<=120).slice(0,10)){
        ally.rally=3;this.addVisual('ring',ally.sprite.x,ally.sprite.y,18,0xb79ee6);
      }
    }
    for(const area of plan.areas){
      const phase=dangerPhase(area,threat.elapsed);
      if(phase!=='expired')this.drawDanger(area,phase==='active');
      if(area.damage>0&&(!plan.dash||area!==plan.areas[0])&&threat.elapsed>=area.delay&&previous<area.delay+area.active&&containsDanger(area.shape,this.hero))this.hurt(enemyDamage(area.damage,this.chapter())*(this.run.difficulty==='hard'?1.2:1));
    }
    if(plan.dash){
      const d=plan.dash;
      if(previous<d.start+d.duration&&threat.elapsed>=d.start+d.duration)e.attackPose=Math.max(e.attackPose,ATTACK_RECOVERY-(threat.elapsed-d.start-d.duration));
      if(threat.elapsed>=d.start){
        const progress=Math.min(1,(threat.elapsed-d.start)/(d.duration||1)),x=e.sprite.x,y=e.sprite.y;
        e.sprite.setPosition(d.from.x+(d.to.x-d.from.x)*progress,d.from.y+(d.to.y-d.from.y)*progress);
        if(previous<d.start+d.duration&&containsDanger({kind:'line',x,y,endX:e.sprite.x,endY:e.sprite.y,radius:plan.areas[0].shape.radius},this.hero))this.hurt(enemyDamage(plan.areas[0].damage,this.chapter())*(this.run.difficulty==='hard'?1.2:1));
      }
      if(ENEMIES[e.type].behavior==='burrow')e.sprite.setAlpha(threat.elapsed<d.start?.45:1);
    }
    if(threat.elapsed>=plan.duration){e.attack=plan.cooldown;e.threat=undefined;e.sprite.setAlpha(1);}
    return true;
  }
  private enemyStep(dt:number){
    const hard=this.run.difficulty==='hard';
    for(const e of this.enemies){
      if(e.hp<=0)continue;
      const oldX=e.sprite.x,oldY=e.sprite.y,oldWindup=e.windup,oldCharge=e.charge;
      const wasAttacking=e.windup>0||e.charge>0||!!e.threat||e.attackPose>0;
      e.motion+=dt;e.attackPose=Math.max(0,e.attackPose-dt);
      let dx=this.hero.x-e.sprite.x,dy=this.hero.y-e.sprite.y,dist=Math.hypot(dx,dy)||1;
      e.flash-=dt;if(e.flash<=0)e.sprite.clearTint();
      if(e.burn>0){this.hit(e,this.level('ember')*8*dt,true);e.burn-=dt;if(e.hp<=0)continue;}
      e.slow-=dt;e.attack-=dt;e.orbitHit-=dt;e.rally=Math.max(0,e.rally-dt);
      if(e.rally>0&&e.flash<=0)e.sprite.setTint(0xb79ee6);
      const slow=e.slow>0?Math.max(.3,1-this.level('frost')*.18):1;
      let vx=dx/dist*e.speed*slow*(e.rally>0?1.25:1),vy=dy/dist*e.speed*slow*(e.rally>0?1.25:1);
      if(e.type>=9){if(this.chapterEnemyStep(e,dt))vx=vy=0;if(this.finished)return;}
      else if(e.boss){const velocity=this.bossStep(e,dt);if(velocity){vx=velocity.x;vy=velocity.y;}if(this.finished)return;}
      if(e.type===1){vx+=(Math.sin(this.clock*2+e.id)*18);vy+=Math.cos(this.clock*2+e.id)*18;}
      if((e.type===3||e.type===4)&&dist<155&&this.phase!=='clearing'){vx=-vx*.3;vy=-vy*.3;}
      const charger=e.type===2;
      if(charger){
        if(e.windup>0){
          e.windup-=dt;vx=vy=0;
          this.effects.lineStyle(24,0xef9b75,.25);this.effects.lineBetween(e.sprite.x,e.sprite.y,e.sprite.x+e.dx*180,e.sprite.y+e.dy*180);
          if(e.windup<=0)e.charge=.65;
        }else if(e.charge>0){e.charge-=dt;vx=e.dx*235;vy=e.dy*235;if(e.charge<=0)e.attack=2.7;}
        else if(e.attack<=0){e.windup=.7;e.dx=dx/dist;e.dy=dy/dist;vx=vy=0;}
      }
      if(e.type===5){
        if(e.attack<=0&&e.windup<=0&&dist<65){e.windup=.55;e.dx=dx/dist;e.dy=dy/dist;}
        if(e.windup>0){
          e.windup-=dt;vx=vy=0;
          const angle=Math.atan2(e.dy,e.dx);
          this.effects.fillStyle(0xff9872,.15);this.effects.slice(e.sprite.x,e.sprite.y,64,angle-.9,angle+.9,false);this.effects.fillPath();
          if(e.windup<=0){
            e.attack=1.8;this.addEnemyEffect(attackEffect('slash',e.sprite.x,e.sprite.y,64,0xff9872,angle,.9));
            if(dist<64&&Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy,dx)-angle))<.9)this.hurt(enemyDamage(14+Math.min(this.chapter(),2)*2,this.chapter()));
            if(this.finished)return;
          }
        }
      }
      if((e.type===3||e.type===4)&&(e.attack<=0||e.windup>0)){
        if(e.windup===0){e.dx=this.hero.x;e.dy=this.hero.y;e.windup=.72;}
        e.windup=Math.max(0,e.windup-dt);vx=vy=0;
        this.effects.lineStyle(2,0xf29485,.65);this.effects.strokeCircle(e.sprite.x,e.sprite.y,e.radius+12+(1-e.windup/.72)*12);
        if(e.type===3){this.effects.fillStyle(0xb7c4ba,1);this.effects.fillCircle(e.sprite.x,e.sprite.y-30-(1-e.windup/.72)*7,7);}
        if(e.windup===0){
          e.attack=3.6;
          const amount=e.type===4?3:1;
          for(let k=0;k<amount;k++){
            const angle=Math.atan2(e.dy-e.sprite.y,e.dx-e.sprite.x)+(k-(amount-1)/2)*.3;
            this.shoot(e.sprite.x,e.sprite.y-13,Math.cos(angle)*(hard?127:105),Math.sin(angle)*(hard?127:105),enemyDamage(8,this.chapter()),true,e.type===3?'stone':'spell');
          }
        }
      }
      e.sprite.x=Phaser.Math.Clamp(e.sprite.x+vx*dt,20,370);e.sprite.y=Phaser.Math.Clamp(e.sprite.y+vy*dt,60,605);
      e.sprite.setDepth(e.sprite.y);e.shadow.setPosition(e.sprite.x,e.sprite.y+3).setDepth(e.sprite.y-1);
      if(e.type<2&&dist<e.radius+12&&e.attack<=0){e.attackPose=ATTACK_RELEASE+ATTACK_RECOVERY;e.attack=.7;this.addEnemyEffect(attackEffect('slash',e.sprite.x,e.sprite.y,25,0xeea59a,Math.atan2(dy,dx),.7));}
      if(oldWindup>0&&e.windup<=0){
        e.attackPose=ATTACK_RELEASE+ATTACK_RECOVERY;
        if(e.type===3||e.type===4||e.boss&&e.boss.action!=='charge')this.addEnemyEffect(attackEffect('wave',e.sprite.x,e.sprite.y-13,20,0xf1b48f));
      }
      if((e.charge>0||e.threat?.plan.dash)&&Math.hypot(e.sprite.x-oldX,e.sprite.y-oldY)>.1)drawAttackProjectile(this.effects,'dash',e.sprite.x,e.sprite.y,(e.sprite.x-oldX)/dt,(e.sprite.y-oldY)/dt,0xf1b48f,e.motion);
      if(oldCharge>0&&e.charge<=0)e.attackPose=ATTACK_RECOVERY;
      let frame=Math.hypot(e.sprite.x-oldX,e.sprite.y-oldY)>.05?Math.floor(e.motion*8)%4:0;
      if(e.windup>0){
        const duration=e.type===5?.55:e.type===2?.7:e.type===3||e.type===4?.72:.8;
        frame=attackFrame(duration-e.windup,duration);
      }else if(e.charge>0)frame=6;
      else if(e.attackPose>0)frame=attackFrame(ATTACK_RELEASE+ATTACK_RECOVERY-e.attackPose,0);
      if(e.threat)frame=chapterAttackFrame(e.threat.plan,e.threat.elapsed);
      e.sprite.setFrame(ENEMIES[e.type].frame*8+frame);
      const attacking=e.windup>0||e.charge>0||!!e.threat||e.attackPose>0;
      const facing=attacking?(wasAttacking?0:dx):e.sprite.x-oldX;
      if(Math.abs(facing)>.05)e.sprite.setFlipX(facing<0);
      if(e.type!==5&&dist<e.radius+12)this.hurt(enemyDamage(isBossEnemy(e.type)?20:7+Math.min(this.chapter(),2)*2,this.chapter())*(hard?1.2:1));
      if(this.finished)return;
    }
    this.enemies=this.enemies.filter(e=>e.hp>0);
  }
  private projectileStep(dt:number){
    for(const s of this.shots){
      s.life-=dt;
      if(s.flight){
        const f=s.flight;
        if(!f.returning&&f.remaining<=0){f.returning=true;s.hit.clear();if(f.evolved)s.damage*=WEAPONS.boomerang.evolvedReturnDamage;}
        if(f.returning){
          const dx=this.hero.x-s.x,dy=this.hero.y-12-s.y,dist=Math.hypot(dx,dy),step=WEAPONS.boomerang.returnSpeed*dt;
          if(dist<=step){s.sprite.destroy();continue;}
          s.dx=dx/(dist||1)*WEAPONS.boomerang.returnSpeed;s.dy=dy/(dist||1)*WEAPONS.boomerang.returnSpeed;
          s.x+=s.dx*dt;s.y+=s.dy*dt;
        }else{
          const step=Math.min(f.remaining,WEAPONS.boomerang.outwardSpeed*dt);
          s.x+=s.dx/WEAPONS.boomerang.outwardSpeed*step;s.y+=s.dy/WEAPONS.boomerang.outwardSpeed*step;f.remaining=Math.max(0,f.remaining-step);
        }
        s.sprite.rotation+=dt*14;
      }else{s.x+=s.dx*dt;s.y+=s.dy*dt;}
      s.sprite.setPosition(s.x,s.y);
      if(s.hostile){if(Math.hypot(s.x-this.hero.x,s.y-this.hero.y+13)<17){this.hurt(s.damage);if(this.finished)return;s.life=0;}}
      else for(const e of this.enemies){if((!s.flight||s.hit.size<=s.pierce)&&e.hp>0&&!s.hit.has(e.id)&&Math.hypot(s.x-e.sprite.x,s.y-e.sprite.y+12)<e.radius+(s.flight?.evolved?18:s.style==='wave'?22:9)){
        const x=e.sprite.x,y=e.sprite.y;this.hit(e,s.damage);s.hit.add(e.id);
        if(s.style==='fire'&&this.run.weapon==='staff'&&isEvolved(this.run)){this.addVisual('ring',x,y-10,52,0xffbd73);for(const other of this.enemies)if(other!==e&&other.hp>0&&Math.hypot(other.sprite.x-x,other.sprite.y-y)<52)this.hit(other,s.damage*.45);}
        if(s.hit.size>s.pierce){if(!s.flight)s.life=0;break;}
      }}
      if(s.hostile&&s.life>0)drawAttackProjectile(this.effects,s.style,s.x,s.y,s.dx,s.dy,s.style==='stone'?0xd2c1a8:0xff9cae,this.clock);
      if(s.life<=0||(!s.flight&&(s.x<0||s.x>390||s.y<30||s.y>660)))s.sprite.destroy();
    }
    this.shots=this.shots.filter(s=>s.sprite.active);
  }
  private hammerStep(dt:number){
    const strike=this.pendingHammer;if(!strike)return;
    strike.remaining-=dt;
    if(strike.remaining>1e-6){
      strike.sprite?.setPosition(strike.x,strike.y-12-58*strike.remaining/WEAPONS.hammer.delay).setRotation(-strike.remaining*3);
      this.effects.lineStyle(2,0xffc678,.55);this.effects.strokeCircle(strike.x,strike.y-12,strike.radius);return;
    }
    strike.sprite?.destroy();
    const visual=this.addVisual('ring',strike.x,strike.y-12,strike.radius,0xffb25c);
    visual.sprite=this.add.image(strike.x,strike.y-12,'hammer',2).setDisplaySize(strike.radius*2,strike.radius*2).setDepth(805);
    for(const e of this.enemies)if(e.hp>0&&Math.hypot(e.sprite.x-strike.x,e.sprite.y-strike.y)<=strike.radius)this.hit(e,strike.damage,strike.secondary);
    this.pendingHammer=strike.evolved&&!strike.secondary?{...strike,damage:strike.damage*WEAPONS.hammer.echoDamage,remaining:WEAPONS.hammer.echoDelay,secondary:true,sprite:null}:null;
  }
  private clearAttacks(){
    for(const shot of this.shots)shot.sprite.destroy();this.shots=[];this.explosions=[];this.enemyEffects=[];
    this.pendingHammer?.sprite?.destroy();this.pendingHammer=null;
    this.pendingMeteor?.sprite.destroy();this.pendingMeteor=null;
  }
  private meteorStep(dt:number){
    const stats=meteorStats(this.run.upgrades);if(!stats)return;
    this.meteorTimer-=dt;
    const strike=this.pendingMeteor;
    if(strike){
      strike.remaining-=dt;
      if(strike.remaining<=1e-6){
        strike.sprite.destroy();this.pendingMeteor=null;
        this.addVisual('ring',strike.x,strike.y-12,strike.radius,0xffce88);
        for(const e of this.enemies)if(e.hp>0&&Math.hypot(e.sprite.x-strike.x,e.sprite.y-strike.y)<=strike.radius)this.hit(e,strike.damage);
      }else{
        strike.sprite.setPosition(strike.x,strike.y-12-120*strike.remaining/stats.delay);
        this.effects.lineStyle(2,0xffce88,.6);this.effects.strokeCircle(strike.x,strike.y-12,strike.radius);
      }
    }
    if(this.pendingMeteor||this.meteorTimer>1e-6)return;
    const target=this.enemies.filter(e=>e.hp>0&&Math.hypot(e.sprite.x-this.hero.x,e.sprite.y-this.hero.y)<=stats.targetRange).sort((a,b)=>Math.hypot(a.sprite.x-this.hero.x,a.sprite.y-this.hero.y)-Math.hypot(b.sprite.x-this.hero.x,b.sprite.y-this.hero.y)||a.id-b.id)[0];
    if(!target)return;
    const x=target.sprite.x,y=target.sprite.y;
    this.pendingMeteor={x,y,damage:skillDamage(this.run)*stats.damageMultiplier,radius:stats.radius,remaining:stats.delay,sprite:this.add.image(x,y-132,'meteor').setDisplaySize(92,92).setDepth(805)};
    this.meteorTimer=stats.cooldown;
  }
  private skills(dt:number){
    this.meteorStep(dt);
    this.stormTimer-=dt;this.novaTimer-=dt;this.mendTimer-=dt;
    if(this.level('storm')&&this.stormTimer<=0){
      this.stormTimer=3*(1-this.level('haste')*.12);let x=this.hero.x,y=this.hero.y-12;
      const hit=new Set<number>(),points=[{x,y}],frost=hasSynergy(this.run,'froststorm');
      for(let i=0;i<2+this.level('storm')*2;i++){
        const e=this.enemies.filter(e=>e.hp>0&&!hit.has(e.id)&&Math.hypot(e.sprite.x-x,e.sprite.y-y)<260).sort((a,b)=>Math.hypot(a.sprite.x-x,a.sprite.y-y)-Math.hypot(b.sprite.x-x,b.sprite.y-y))[0];
        if(!e)break;
        const nx=e.sprite.x,ny=e.sprite.y-12;points.push({x:(x+nx)/2+8,y:(y+ny)/2-8},{x:nx,y:ny});x=nx;y=ny;hit.add(e.id);
        const damage=skillDamage(this.run)*1.6*(frost&&e.slow>0?1.75:1);if(frost)e.slow=2.5;this.hit(e,damage);
      }
      this.addVisual('bolt',this.hero.x,this.hero.y,0,frost?0x9af2ff:0xaedbff).points=points;
    }
    if(this.level('nova')&&this.novaTimer<=0){this.novaTimer=4*(1-this.level('haste')*.12);const radius=125+this.level('nova')*20;this.addVisual('ring',this.hero.x,this.hero.y-10,radius,hasSynergy(this.run,'wildfire')?0xff975c:0xf9cfa0);for(const e of this.enemies)if(e.hp>0&&Math.hypot(e.sprite.x-this.hero.x,e.sprite.y-this.hero.y)<radius)this.hit(e,skillDamage(this.run)*(1+this.level('nova')*.6));}
    if(this.level('mend')&&this.mendTimer<=0){this.mendTimer=8*(1-this.level('haste')*.12);this.run.hp=Math.min(this.run.maxHp,this.run.hp+2*this.level('mend'));}
    const count=(this.level('orbit')?1+this.level('orbit'):0)+(this.run.weapon==='halo'?2+this.level('split')+(isEvolved(this.run)?2:0):0);
    while(this.orbiters.length<count)this.orbiters.push(this.add.image(0,0,'props',5).setDisplaySize(34,34).setDepth(745));
    const radius=(this.run.weapon==='halo'?this.range():105*(1+this.level('reach')*.12))*.75;
    this.orbiters.forEach((s,i)=>{const a=this.clock*3.6+i/count*Math.PI*2;s.setPosition(this.hero.x+Math.cos(a)*radius,this.hero.y+Math.sin(a)*radius-12).setRotation(a);});
    for(const e of this.enemies)if(e.hp>0&&e.orbitHit<=1e-6&&this.orbiters.some(s=>Math.hypot(e.sprite.x-s.x,e.sprite.y-12-s.y)<e.radius+20)){e.orbitHit=.2;this.hit(e,skillDamage(this.run)*.35);}
    for(const explosion of this.explosions.splice(0,32)){
      this.addVisual('ring',explosion.x,explosion.y-10,75,0xff975c);
      for(const e of this.enemies)if(e.hp>0&&Math.hypot(e.sprite.x-explosion.x,e.sprite.y-explosion.y)<75){e.burn=2;this.hit(e,explosion.damage,true);}
    }
  }
  private collect(dt:number){
    for(const d of this.drops){
      const dx=this.hero.x-d.sprite.x,dy=this.hero.y-d.sprite.y,dist=Math.hypot(dx,dy);
      if(this.phase==='loot'||dist<85*(1+this.level('magnet')*.55)){const step=Math.min(dist,(this.phase==='loot'?720:280)*dt);d.sprite.x+=dx/(dist||1)*step;d.sprite.y+=dy/(dist||1)*step;}
      if(dist<20){this.run.xp+=d.value;d.sprite.destroy();}
    }
    this.drops=this.drops.filter(d=>d.sprite.active);
    while(this.run.xp>=experienceForLevel(this.run.level)){
      const required=experienceForLevel(this.run.level);
      this.run.xp-=required;this.run.level++;
      if(!upgradeChoices(this.run).length)continue;
      this.choosing=true;this.pause();
      this.hooks.upgrade(this.getRun(),id=>{if(!this.choosing)return;applyUpgrade(this.run,id);this.choosing=false;this.resume();this.emitHud();});
      return true;
    }
    return false;
  }
  private emitHud(){
    const boss=this.enemies.find(e=>isBossEnemy(e.type)&&e.hp>0);
    this.hooks.hud(this.run,Math.max(0,this.duration()-this.clock),boss?boss.hp/boss.max:null,this.phase,this.enemies.filter(e=>e.hp>0).length);
  }
  private changePhase(phase:ArenaPhase){
    this.phase=phase;this.phaseTimer=0;
    if(phase==='loot'){
      this.clearAttacks();
      this.petParty.clearAttacks();
      this.hero.clearTint();this.addVisual('ring',this.hero.x,this.hero.y-10,220,0xc0edb3);
    }
    this.emitHud();
  }
  private drawTaming(){
    const e=this.run.petEncounter;if(e?.state!=='available'||!this.wildPet)return;
    const {x,y}=this.wildPet,inside=Math.hypot(this.hero.x-x,this.hero.y-y)<=TAME_RADIUS;
    this.tameRing!.clear().lineStyle(2,inside?0xdbefac:0x8dbca5,.8).strokeCircle(x,y,TAME_RADIUS);
    this.tameRing!.lineStyle(4,0xdbefac,1).beginPath().arc(x,y,TAME_RADIUS,-Math.PI/2,-Math.PI/2+Math.PI*2*this.tameSeconds/PETS[e.pet].tameSeconds).strokePath();
    this.hooks.taming?.(e.pet,this.tameSeconds,inside);
  }
  private tameStep(dt:number){
    const e=this.run.petEncounter;if(e?.state!=='available'||!this.wildPet||this.savingPet)return;
    const needed=PETS[e.pet].tameSeconds;
    this.tameSeconds=tameProgress(this.tameSeconds,Math.hypot(this.hero.x-this.wildPet.x,this.hero.y-this.wildPet.y)<=TAME_RADIUS,dt,needed);this.drawTaming();
    if(this.tameSeconds<needed)return;
    this.savingPet=true;this.pause();
    this.hooks.tame?.(e.pet,pets=>{
      if(!this.savingPet)return;
      this.run.petEncounter={room:this.run.room,pet:e.pet,state:'tamed'};this.run.pets=[...pets];this.petParty.sync(pets);
      this.removeWildPet();this.savingPet=false;if(this.phase==='taming')this.changePhase('victory');this.resume();
    });
  }
  private removeWildPet(){this.wildPet?.destroy();this.wildPet=undefined;this.tameRing?.destroy();this.hooks.taming?.(null,0,false);}
  leavePet(){
    const e=this.run.petEncounter;
    if(this.phase!=='taming'||e?.state!=='available'||this.savingPet)return;
    this.run.petEncounter={room:this.run.room,pet:e.pet,state:'left'};this.removeWildPet();this.changePhase('victory');
  }
  update(_time:number,delta:number){
    if(this.finished||this.choosing||this.savingPet||this.paused)return;
    const dt=Math.min(delta,50)/1000;this.clock+=dt;this.phaseTimer+=dt;this.run.elapsed=this.elapsedStart+this.clock;
    if(this.wildPet&&this.run.petEncounter?.pet&&FLYING_PETS.includes(this.run.petEncounter.pet))this.wildPet.setFrame(Math.floor(this.clock*9)%4);
    this.effects.clear();this.move(dt);
    if(this.phase==='loot'||this.phase==='taming'||this.phase==='victory'){
      this.petParty.step(dt,[],false);
      this.drawVisuals(dt);
      if(this.collect(dt))return;
      if(this.phase==='loot'&&this.drops.length===0)this.changePhase(this.run.petEncounter?.state==='available'?'taming':'victory');
      else if(this.phase==='victory'&&this.phaseTimer>=1.2){this.finished=true;this.pause();this.hooks.complete(this.getRun());}
      if(this.phase==='taming')this.tameStep(dt);
      return;
    }
    this.hitTimer-=dt;if(this.hitTimer<=0)this.hero.clearTint();
    if(this.isBoss()){
      if(!this.enemies.some(e=>e.hp>0&&isBossEnemy(e.type))&&this.phase!=='clearing')this.changePhase('clearing');
    }else{
      if(this.clock>=this.duration()&&this.phase!=='clearing')this.changePhase('clearing');
      else if(this.clock>=this.duration()-8&&this.phase==='fighting')this.changePhase('finalWave');
    }
    this.spawnTimer-=dt;this.attackTimer-=dt;
    if(this.spawnTimer<=0&&this.phase!=='clearing'){
      this.spawnTimer=this.isBoss()?2.5:Math.max(.65,1-this.run.room*.045-this.clock*.002)*encounter(this.run).pace;
      const types=encounter(this.run).types;
      const amount=this.isBoss()?12:[4,4,5,5,7,10,12][this.run.room]+(this.phase==='finalWave'?1:0)+(this.run.difficulty==='hard'?1:0);
      for(let k=0;k<amount;k++)this.spawnEnemy(k<Math.ceil(amount*.75)?Math.floor(this.random()*2):types[Math.floor(this.random()*types.length)]);
    }
    this.enemyStep(dt);if(this.finished)return;
    this.hammerStep(dt);
    if(this.attackTimer<=0){this.attackTimer=weaponCooldown(this.run);this.autoAttack();}
    this.projectileStep(dt);if(this.finished)return;this.skills(dt);
    this.petParty.step(dt,this.enemies);
    if(this.isBoss()&&!this.enemies.some(e=>e.hp>0&&isBossEnemy(e.type))&&this.phase!=='clearing')this.changePhase('clearing');
    const looting=this.phase==='clearing'&&!this.enemies.some(e=>e.hp>0);
    if(looting)this.changePhase('loot');
    this.drawVisuals(dt);if(this.collect(dt))return;
    if(!looting)this.tameStep(dt);if(this.savingPet)return;
    this.hudTimer-=dt;
    if(this.hudTimer<=0){this.hudTimer=.15;this.emitHud();}
  }
}
export function mountArena(parent:HTMLElement,run:Run,hooks:ArenaHooks){
  const scene=new Arena(run,hooks);
  const game=new Phaser.Game({type:Phaser.AUTO,parent,width:390,height:660,backgroundColor:'#112726',pixelArt:true,antialias:false,scene:[scene],loader:{imageLoadType:'HTMLImageElement'},fps:{target:30,forceSetTimeOut:false},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},audio:{noAudio:true},input:{activePointers:2}});
  return {scene,game};
}
