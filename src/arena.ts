import Phaser from 'phaser';
import { CHAPTERS, DURATIONS, MISSIONS, applyUpgrade, encounter, puzzleHint, rng, toggleTile, upgradeChoices, type Run, type UpgradeId } from './core.ts';

export interface ArenaHooks {
  hud: (run:Run, remaining:number, bossHp:number|null) => void;
  upgrade: (run:Run, choose:(id:UpgradeId)=>void) => void;
  complete: (run:Run) => void;
  defeat: (run:Run) => void;
  puzzle: (mask:number,moves:number) => void;
  paused: () => void;
}
interface Enemy { id:number; sprite:Phaser.GameObjects.Sprite; shadow:Phaser.GameObjects.Ellipse; hp:number; max:number; type:number; radius:number; speed:number; attack:number; windup:number; charge:number; dx:number; dy:number; burn:number; slow:number; flash:number; }
interface Shot { sprite:Phaser.GameObjects.Image; x:number;y:number;dx:number;dy:number;damage:number;life:number;hostile:boolean;pierce:number;hit:Set<number>; }
interface Drop { sprite:Phaser.GameObjects.Image; value:number; }
export const MAP = {
  width:390, height:660, walkBounds:{left:23,right:367,top:64,bottom:602},
  spawn:{x:195,y:490}, exit:{x:195,y:68},
  blockers:[{x:69,y:265,r:15},{x:319,y:345,r:15}],
  props:[{frame:2,x:69,y:265,w:50,h:50,sortY:265},{frame:2,x:319,y:345,w:50,h:50,sortY:345}],
};
export class Arena extends Phaser.Scene {
  run:Run; hooks:ArenaHooks; puzzleMode:boolean;
  private hero!:Phaser.GameObjects.Sprite;
  private shadow!:Phaser.GameObjects.Ellipse;
  private effects!:Phaser.GameObjects.Graphics;
  private joystick!:Phaser.GameObjects.Graphics;
  private tiles:Phaser.GameObjects.Image[]=[];
  private enemies:Enemy[]=[]; private shots:Shot[]=[]; private drops:Drop[]=[];
  private random:()=>number; private clock=0; private spawnTimer=0; private attackTimer=0; private stormTimer=4; private novaTimer=5; private mendTimer=8; private hitTimer=0; private hudTimer=0; private elapsedStart=0;
  private pointer:{x:number;y:number}|null=null;
  private direction=0; private moving=false; private finished=false; private nextId=0; private lastTile=-1; private tileLock=0;
  private keys?:Record<string,Phaser.Input.Keyboard.Key>;
  private orbiters:Phaser.GameObjects.Image[]=[];
  private puzzleMarks:Phaser.GameObjects.Text[]=[];
  constructor(run:Run,hooks:ArenaHooks,puzzleMode=false){
    super('arena'); this.run=structuredClone(run);this.hooks=hooks;this.puzzleMode=puzzleMode;
    this.random=rng(run.seed+run.room*1259);this.elapsedStart=run.elapsed;
  }
  preload(){
    const chapter=CHAPTERS[MISSIONS[this.run.mission].chapter];
    this.load.image('ground',`/assets/${chapter.asset}.jpg`);
    this.load.spritesheet('hero','/assets/hero.png',{frameWidth:128,frameHeight:128});
    this.load.spritesheet('enemies','/assets/enemies.png',{frameWidth:128,frameHeight:128});
    this.load.spritesheet('props','/assets/props.png',{frameWidth:128,frameHeight:128});
  }
  create(){
    this.add.image(195,330,'ground').setDisplaySize(440,700).setAlpha(.88);
    this.add.rectangle(195,330,390,660,0x081923,.14);
    this.effects=this.add.graphics().setDepth(800);
    this.shadow=this.add.ellipse(MAP.spawn.x,MAP.spawn.y+8,28,12,0x06151a,.4);
    this.hero=this.add.sprite(MAP.spawn.x,MAP.spawn.y,'hero',0).setDisplaySize(67,67).setOrigin(.5,.82);
    this.joystick=this.add.graphics().setDepth(1000);
    for(let d=0;d<4;d++) if(!this.anims.exists(`walk${d}`)) this.anims.create({key:`walk${d}`,frames:this.anims.generateFrameNumbers('hero',{start:d*4,end:d*4+3}),frameRate:8,repeat:-1});
    if(this.puzzleMode) {
      for(let i=0;i<9;i++){
        const x=101+(i%3)*94,y=210+Math.floor(i/3)*94;
        this.tiles.push(this.add.image(x,y,'props',3).setDisplaySize(70,70).setDepth(1));
        this.puzzleMarks.push(this.add.text(x,y,String(i+1),{fontFamily:'Georgia',fontSize:'21px',color:'#ecdfa3'}).setOrigin(.5).setDepth(2));
      }
      this.paintPuzzle();
      if(this.run.puzzle!.mask===511)this.time.delayedCall(30,()=>{this.finished=true;this.pause();this.hooks.complete(this.getRun());});
      this.add.image(195,92,'props',0).setDisplaySize(64,64);
      this.add.text(195,137,'點亮所有符文，打開寶庫',{fontFamily:'sans-serif',fontSize:'14px',color:'#e9d9a4'}).setOrigin(.5);
    } else {
      for(const p of MAP.props)this.add.image(p.x,p.y,'props',p.frame).setOrigin(.5,.85).setDisplaySize(p.w,p.h).setDepth(p.sortY);
      if(this.isBoss())this.spawnEnemy(6+this.chapter(),195,130);
    }
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{this.pointer={x:p.x,y:p.y};});
    this.input.on('pointerup',()=>{this.pointer=null;});
    this.input.on('pointerupoutside',()=>{this.pointer=null;});
    this.keys=this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    this.game.canvas.addEventListener('contextmenu',e=>e.preventDefault());
    this.hooks.hud(this.run,this.duration(),this.isBoss()?1:null);
  }
  private chapter(){return MISSIONS[this.run.mission].chapter;}
  private isBoss(){return this.run.room===7&&this.run.mission%2===1;}
  private duration(){return DURATIONS[this.run.room]*(this.run.route==='risk'?1:.87);}
  private level(id:UpgradeId){return this.run.upgrades[id]??0;}
  pause(){this.pointer=null;this.joystick?.clear();if(this.scene.isActive())this.scene.pause();}
  resume(){if(!this.finished){this.pointer=null;this.scene.resume();}}
  getRun(){return structuredClone(this.run);}
  private damage(){return (this.run.weapon==='blade'?22:12)*(1+this.level('power')*.2+this.level('pierce')*(this.run.weapon==='staff'?0:.15));}
  private range(){return (this.run.weapon==='staff'?290:this.run.weapon==='blade'?95:82)*(1+this.level('reach')*.18);}
  private spawnEnemy(type:number,x?:number,y?:number){
    if(this.enemies.length>=38)return;
    if(x===undefined){const side=Math.floor(this.random()*4);x=side===0?24:side===1?366:30+this.random()*330;y=side===2?70:side===3?590:85+this.random()*480;}
    y??=90;
    const boss=type>=6, stage=this.chapter(), hard=this.run.difficulty==='hard';
    const hp=boss?(2300+stage*1300):[21,17,32,38,24,64][type]*(1+stage*.35+this.run.room*.08);
    const sprite=this.add.sprite(x,y,'enemies',type).setDisplaySize(boss?142:58,boss?142:58).setOrigin(.5,.78).setDepth(y);
    const shadow=this.add.ellipse(x,y+3,boss?67:23,boss?25:10,0x041419,.45).setDepth(y-1);
    this.enemies.push({id:this.nextId++,sprite,shadow,hp:hp*(hard?1.4:1),max:hp*(hard?1.4:1),type,radius:boss?38:15,speed:boss?(type===7?8:21):[28,44,37,13,36,19][type]*(hard?1.1:1),attack:1.3+this.random()*2,windup:0,charge:0,dx:0,dy:0,burn:0,slow:0,flash:0});
  }
  private hit(enemy:Enemy,damage:number){
    if(enemy.hp<=0)return;
    if(this.random()<this.level('focus')*.12)damage*=2;
    enemy.hp-=damage;enemy.flash=.1;enemy.sprite.setTintFill(0xffe7ad);
    if(this.level('ember'))enemy.burn=2;
    if(this.level('frost'))enemy.slow=1.5;
    if(enemy.hp<=0){
      const {x,y}=enemy.sprite;
      enemy.sprite.destroy();enemy.shadow.destroy();this.run.kills++;
      const drop=this.add.image(x,y,'props',8).setDisplaySize(17,17).setDepth(3);
      this.drops.push({sprite:drop,value:enemy.type>=6?30:enemy.type>=5?5:3});
      if(this.random()<.035)this.run.hp=Math.min(this.run.maxHp,this.run.hp+5);
    }
  }
  private hurt(amount:number){
    if(this.hitTimer>0||this.finished)return;
    this.hitTimer=.8;this.run.hp=Math.max(0,this.run.hp-amount*(1-this.level('ward')*.12));
    this.hero.setTint(0xff8b83);
    if(this.run.hp<=0){
      if(this.level('secondwind')&&!this.run.secondWindUsed){this.run.secondWindUsed=true;this.run.hp=this.run.maxHp*.4;this.hitTimer=2.5;}
      else {this.finished=true;this.pause();this.hooks.defeat(this.getRun());}
    }
  }
  private shoot(x:number,y:number,dx:number,dy:number,damage:number,hostile=false){
    const sprite=this.add.image(x,y,'props',hostile?6:4).setDisplaySize(hostile?23:27,hostile?23:27).setDepth(750).setRotation(Math.atan2(dy,dx));
    if(hostile)sprite.setTint(0xff999d);
    this.shots.push({sprite,x,y,dx,dy,damage,life:hostile?5:1.5,hostile,pierce:this.level('pierce'),hit:new Set()});
  }
  private autoAttack(){
    const enemies=this.enemies.filter(e=>e.hp>0).sort((a,b)=>Phaser.Math.Distance.Between(this.hero.x,this.hero.y,a.sprite.x,a.sprite.y)-Phaser.Math.Distance.Between(this.hero.x,this.hero.y,b.sprite.x,b.sprite.y));
    if(!enemies.length)return;
    const target=enemies[0], angle=Math.atan2(target.sprite.y-this.hero.y,target.sprite.x-this.hero.x),range=this.range();
    if(Phaser.Math.Distance.Between(this.hero.x,this.hero.y,target.sprite.x,target.sprite.y)>range)return;
    if(this.run.weapon==='staff'){
      const count=1+this.level('split');
      for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.15;this.shoot(this.hero.x,this.hero.y-18,Math.cos(a)*290,Math.sin(a)*290,this.damage());}
    }else if(this.run.weapon==='blade'){
      this.effects.lineStyle(5,0xf3d999,.7);this.effects.beginPath();this.effects.arc(this.hero.x,this.hero.y,range,angle-1,angle+1);this.effects.strokePath();
      for(const e of enemies){const a=Math.atan2(e.sprite.y-this.hero.y,e.sprite.x-this.hero.x);if(Phaser.Math.Distance.Between(this.hero.x,this.hero.y,e.sprite.x,e.sprite.y)<=range&&Math.abs(Phaser.Math.Angle.Wrap(a-angle))<1+this.level('split')*.3)this.hit(e,this.damage());}
    }else{
      for(const e of enemies)if(Phaser.Math.Distance.Between(this.hero.x,this.hero.y,e.sprite.x,e.sprite.y)<range)this.hit(e,this.damage()*.75*(1+this.level('split')*.25));
    }
  }
  private move(dt:number){
    let dx=0,dy=0;
    const p=this.input.activePointer;
    this.joystick.clear();
    if(this.pointer&&p.isDown){
      dx=p.x-this.pointer.x;dy=p.y-this.pointer.y;
      const len=Math.hypot(dx,dy),reach=Math.min(34,len);
      this.joystick.lineStyle(1,0xffffff,.25);this.joystick.strokeCircle(this.pointer.x,this.pointer.y,35);
      this.joystick.fillStyle(0xffffff,.28);this.joystick.fillCircle(this.pointer.x+(len?dx/len*reach:0),this.pointer.y+(len?dy/len*reach:0),12);
      if(len<5){dx=0;dy=0;}
    }
    if(this.keys){dx+=(this.keys.D.isDown||this.keys.RIGHT.isDown?1:0)-(this.keys.A.isDown||this.keys.LEFT.isDown?1:0);dy+=(this.keys.S.isDown||this.keys.DOWN.isDown?1:0)-(this.keys.W.isDown||this.keys.UP.isDown?1:0);}
    const len=Math.hypot(dx,dy);this.moving=len>0;
    if(len){
      const speed=128*(1+this.level('stride')*.12);let x=this.hero.x+dx/len*speed*dt,y=this.hero.y+dy/len*speed*dt;
      const b=MAP.walkBounds;x=Phaser.Math.Clamp(x,b.left,b.right);y=Phaser.Math.Clamp(y,b.top,b.bottom);
      if(!this.puzzleMode)for(const q of MAP.blockers){const dist=Math.hypot(x-q.x,y-q.y),radius=q.r+10;if(dist<radius){x=q.x+(x-q.x)/(dist||1)*radius;y=q.y+(y-q.y)/(dist||1)*radius;}}
      this.hero.setPosition(x,y);this.direction=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);
      this.hero.play(`walk${this.direction}`,true);
    }else{this.hero.stop();this.hero.setFrame(this.direction*4);}
    this.hero.setDepth(this.hero.y);this.shadow.setPosition(this.hero.x,this.hero.y+3).setDepth(this.hero.y-1);
  }
  private enemyStep(dt:number){
    const hard=this.run.difficulty==='hard';
    for(const e of this.enemies){
      if(e.hp<=0)continue;
      let dx=this.hero.x-e.sprite.x,dy=this.hero.y-e.sprite.y,dist=Math.hypot(dx,dy)||1;
      e.flash-=dt;if(e.flash<=0)e.sprite.clearTint();
      if(e.burn>0){e.burn-=dt;e.hp-=this.level('ember')*4*dt;if(e.hp<=0){e.hp=.01;this.hit(e,1);continue;}}
      e.slow-=dt;e.attack-=dt;
      const slow=e.slow>0?Math.max(.3,1-this.level('frost')*.18):1;
      let vx=dx/dist*e.speed*slow,vy=dy/dist*e.speed*slow;
      if(e.type===1){vx+=(Math.sin(this.clock*2+e.id)*18);vy+=Math.cos(this.clock*2+e.id)*18;}
      if((e.type===3||e.type===4)&&dist<175){vx=-vx*.3;vy=-vy*.3;}
      const charger=e.type===2||e.type===6;
      if(charger){
        if(e.windup>0){
          e.windup-=dt;vx=vy=0;
          this.effects.lineStyle(e.type===6?62:24,0xef9b75,.25);this.effects.lineBetween(e.sprite.x,e.sprite.y,e.sprite.x+e.dx*180,e.sprite.y+e.dy*180);
          if(e.windup<=0)e.charge=.65;
        }else if(e.charge>0){e.charge-=dt;vx=e.dx*235;vy=e.dy*235;if(e.charge<=0)e.attack=e.type===6?2.4:2.7;}
        else if(e.attack<=0){e.windup=.7;e.dx=dx/dist;e.dy=dy/dist;vx=vy=0;}
      }
      if(e.attack<=0&&e.type>=3&&!charger){
        if(e.windup===0){e.dx=this.hero.x;e.dy=this.hero.y;}
        e.windup+=dt;vx=vy=0;
        this.effects.lineStyle(2,0xf29485,.65);this.effects.strokeCircle(e.sprite.x,e.sprite.y,e.radius+12+e.windup*12);
        if(e.type===7){this.effects.fillStyle(0xe6a86f,.2);this.effects.fillCircle(e.dx,e.dy,48);this.effects.lineStyle(2,0xffc685,.8);this.effects.strokeCircle(e.dx,e.dy,48);}
        if(e.windup>.7){
          e.windup=0;e.attack=e.type>=6?2.4:2.9;
          if(e.type===7&&Math.hypot(this.hero.x-e.dx,this.hero.y-e.dy)<48)this.hurt(23);
          const amount=e.type===8?(e.hp<e.max*.5?14:10):e.type===7?8:e.type===4?3:1;
          for(let k=0;k<amount;k++){
            const angle=amount>3?k/amount*Math.PI*2+this.clock*.23:Math.atan2(dy,dx)+(k-(amount-1)/2)*.3;
            this.shoot(e.sprite.x,e.sprite.y-13,Math.cos(angle)*(hard?127:105),Math.sin(angle)*(hard?127:105),e.type>=6?16:9,true);
          }
        }
      }
      e.sprite.x=Phaser.Math.Clamp(e.sprite.x+vx*dt,20,370);e.sprite.y=Phaser.Math.Clamp(e.sprite.y+vy*dt,60,605);
      e.sprite.setDepth(e.sprite.y);e.shadow.setPosition(e.sprite.x,e.sprite.y+3).setDepth(e.sprite.y-1);
      if(e.type<6&&vx)e.sprite.setFlipX(vx<0);
      if(dist<e.radius+12)this.hurt((e.type>=6?20:9+this.chapter()*2)*(hard?1.2:1));
    }
    this.enemies=this.enemies.filter(e=>e.hp>0);
  }
  private projectileStep(dt:number){
    for(const s of this.shots){
      s.life-=dt;s.x+=s.dx*dt;s.y+=s.dy*dt;s.sprite.setPosition(s.x,s.y);
      if(s.hostile){if(Math.hypot(s.x-this.hero.x,s.y-this.hero.y+13)<17){this.hurt(s.damage);s.life=0;}}
      else for(const e of this.enemies){if(e.hp>0&&!s.hit.has(e.id)&&Math.hypot(s.x-e.sprite.x,s.y-e.sprite.y+12)<e.radius+9){this.hit(e,s.damage);s.hit.add(e.id);if(s.hit.size>s.pierce){s.life=0;break;}}}
      if(s.life<=0||s.x<0||s.x>390||s.y<30||s.y>660)s.sprite.destroy();
    }
    this.shots=this.shots.filter(s=>s.sprite.active);
  }
  private skills(dt:number){
    this.stormTimer-=dt;this.novaTimer-=dt;this.mendTimer-=dt;
    if(this.level('storm')&&this.stormTimer<=0){
      this.stormTimer=5*(1-this.level('haste')*.12);let x=this.hero.x,y=this.hero.y;
      for(const e of this.enemies.filter(e=>e.hp>0).slice(0,2+this.level('storm')*2)){
        this.effects.lineStyle(3,0xacdfef,.9);this.effects.lineBetween(x,y,e.sprite.x,e.sprite.y);x=e.sprite.x;y=e.sprite.y;
        this.hit(e,this.damage()*1.8);
      }
    }
    if(this.level('nova')&&this.novaTimer<=0){this.novaTimer=7*(1-this.level('haste')*.12);this.effects.lineStyle(8,0xf9cfa0,.65);this.effects.strokeCircle(this.hero.x,this.hero.y,145);for(const e of this.enemies)if(Math.hypot(e.sprite.x-this.hero.x,e.sprite.y-this.hero.y)<145)this.hit(e,this.damage()*(1+this.level('nova')));}
    if(this.level('mend')&&this.mendTimer<=0){this.mendTimer=8*(1-this.level('haste')*.12);this.run.hp=Math.min(this.run.maxHp,this.run.hp+2*this.level('mend'));}
    const count=this.level('orbit')+(this.run.weapon==='halo'?2+this.level('split'):0);
    while(this.orbiters.length<count)this.orbiters.push(this.add.image(0,0,'props',5).setDisplaySize(34,34).setDepth(745));
    this.orbiters.forEach((s,i)=>{const a=this.clock*2.8+i/count*Math.PI*2;s.setPosition(this.hero.x+Math.cos(a)*this.range()*.7,this.hero.y+Math.sin(a)*this.range()*.7-12).setRotation(a);});
    if(this.level('orbit'))for(const e of this.enemies)for(const s of this.orbiters)if(e.hp>0&&Math.hypot(e.sprite.x-s.x,e.sprite.y-s.y)<e.radius+16)this.hit(e,this.damage()*.75*dt);
  }
  private collect(dt:number){
    for(const d of this.drops){
      const dx=this.hero.x-d.sprite.x,dy=this.hero.y-d.sprite.y,dist=Math.hypot(dx,dy);
      if(dist<75*(1+this.level('magnet')*.55)){d.sprite.x+=dx/(dist||1)*240*dt;d.sprite.y+=dy/(dist||1)*240*dt;}
      if(dist<20){this.run.xp+=d.value;d.sprite.destroy();}
    }
    this.drops=this.drops.filter(d=>d.sprite.active);
    const required=18+this.run.level*8;
    if(this.run.xp>=required){
      this.run.xp-=required;this.run.level++;
      if(!upgradeChoices(this.run).length)return false;
      this.pause();
      this.hooks.upgrade(this.getRun(),id=>{applyUpgrade(this.run,id);this.resume();});
      return true;
    }
    return false;
  }
  private paintPuzzle(){
    const mask=this.run.puzzle!.mask;
    this.tiles.forEach((t,i)=>{t.setTint(mask&(1<<i)?0xffda85:0x486770);this.puzzleMarks[i].setColor(mask&(1<<i)?'#fff2c6':'#789a9b');});
  }
  resetPuzzle(mask:number){this.run.puzzle={mask,moves:0};this.lastTile=-1;this.hero.setPosition(195,500);this.paintPuzzle();this.hooks.puzzle(mask,0);}
  showHint(){const tile=puzzleHint(this.run.puzzle!.mask);if(tile>=0){this.tiles[tile].setTintFill(0xf8d991);this.time.delayedCall(950,()=>this.paintPuzzle());}}
  private puzzleStep(dt:number){
    this.tileLock=Math.max(0,this.tileLock-dt);let tile=-1;
    this.tiles.forEach((t,i)=>{if(Math.abs(t.x-this.hero.x)<30&&Math.abs(t.y-this.hero.y)<30)tile=i;});
    if(tile>=0&&tile!==this.lastTile&&this.tileLock===0){
      const p=this.run.puzzle!;p.mask=toggleTile(p.mask,tile);p.moves++;this.paintPuzzle();this.hooks.puzzle(p.mask,p.moves);this.tileLock=.22;
      if(p.mask===511){this.finished=true;this.pause();this.hooks.complete(this.getRun());}
    }
    if(tile<0||this.tileLock===.22)this.lastTile=tile;
  }
  update(_time:number,delta:number){
    if(this.finished)return;
    const dt=Math.min(delta,50)/1000;this.clock+=dt;this.run.elapsed=this.elapsedStart+this.clock;
    this.effects.clear();this.move(dt);
    if(this.puzzleMode){this.puzzleStep(dt);return;}
    this.hitTimer-=dt;if(this.hitTimer<=0)this.hero.clearTint();
    this.spawnTimer-=dt;this.attackTimer-=dt;
    if(this.spawnTimer<=0){
      this.spawnTimer=this.isBoss()?8:Math.max(.55,1.9-this.run.room*.1-this.clock*.003)*(this.run.route==='risk'?.8:1)*encounter(this.run).pace;
      const types=encounter(this.run).types;
      const amount=this.isBoss()?2:1+(this.run.route==='risk'?1:0)+(this.run.difficulty==='hard'?1:0);
      for(let k=0;k<amount;k++)this.spawnEnemy(types[Math.floor(this.random()*types.length)]);
      if(this.run.room===7&&!this.isBoss()&&this.clock<3)this.spawnEnemy(5,195,100);
    }
    if(this.attackTimer<=0){this.attackTimer=(this.run.weapon==='halo'?.5:.7)*(1-this.level('haste')*.12);this.autoAttack();}
    this.enemyStep(dt);if(this.finished)return;this.projectileStep(dt);if(this.finished)return;this.skills(dt);if(this.collect(dt))return;
    const boss=this.enemies.find(e=>e.type>=6&&e.hp>0);
    if((this.isBoss()&&!boss)||(!this.isBoss()&&this.clock>=this.duration())){this.finished=true;this.pause();this.hooks.complete(this.getRun());return;}
    this.hudTimer-=dt;
    if(this.hudTimer<=0){this.hudTimer=.15;this.hooks.hud(this.getRun(),Math.max(0,this.duration()-this.clock),boss?boss.hp/boss.max:null);}
  }
}
export function mountArena(parent:HTMLElement,run:Run,hooks:ArenaHooks,puzzleMode=false){
  const scene=new Arena(run,hooks,puzzleMode);
  const game=new Phaser.Game({type:Phaser.AUTO,parent,width:390,height:660,backgroundColor:'#112726',pixelArt:true,antialias:false,scene:[scene],fps:{target:30,forceSetTimeOut:false},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},audio:{noAudio:true},input:{activePointers:1}});
  return {scene,game};
}
