import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { playerMoveSpeed, petMoveSpeed, advancePetAttack, PET_ATTACK_DURATION, chapterAttackFrame } from '../src/creature-motion.ts';
import { planChapterAttack } from '../src/chapter-attacks.ts';
import { PET_IDS, PETS, type PetId } from '../src/pets.ts';

// Exercise the real party simulation in Node; replace only Phaser's rendering dependency.
const hooks=registerHooks({
  resolve(specifier,context,next){
    if(specifier==='phaser')return {url:'data:text/javascript,export default {Math:{Angle:{Wrap:a=>Math.atan2(Math.sin(a),Math.cos(a))}}}',shortCircuit:true};
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.endsWith('/src/pet-arena.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'transform'}),shortCircuit:true};
    return next(url,context);
  }
});
const {PetParty}=await import('../src/pet-arena.ts');hooks.deregister();
class Sprite {
  x:number;y:number;frame=0;flipX=false;
  constructor(x:number,y:number){this.x=x;this.y=y;}
  setPosition(x:number,y:number){this.x=x;this.y=y;return this;}
  setFrame(frame:number){this.frame=frame;return this;}
  setFlipX(flip:boolean){this.flipX=flip;return this;}
  setAlpha(){return this;}setDepth(){return this;}setDisplaySize(){return this;}setOrigin(){return this;}destroy(){}
}
function setup(id:PetId='thunderLeopard',speed=()=>petMoveSpeed(0)){
  const graphics=Object.fromEntries(['setDepth','clear','lineStyle','lineBetween','beginPath','moveTo','arc','lineTo','strokePath','destroy','strokePoints','strokeCircle','fillStyle','fillCircle','fillTriangle','slice','fillPath'].map(name=>[name,function(){return graphics;}]));
  const scene={add:{graphics:()=>graphics,sprite:(x:number,y:number)=>new Sprite(x,y),circle:(x:number,y:number)=>new Sprite(x,y)}};
  const hero={x:195,y:300},hits:{id:number;frame:number;damage:number}[]=[];
  const party=new PetParty(scene as never,hero,(e,damage)=>{hits.push({id:e.id,frame:p.sprite.frame,damage});e.hp-=damage;},speed);
  party.sync([id]);const p=Reflect.get(party,'companions')[0];p.sprite.setPosition(195,300);
  const enemy=(id=1,x=220,y=300)=>({id,hp:10000,radius:12,sprite:{x,y}});
  return {party,p,hero,hits,enemy};
}

test('pet pursuit and return stay at 90 percent of the current player speed including upgrades',()=>{
  assert.equal(playerMoveSpeed(0),128);assert.equal(petMoveSpeed(0),115.2);
  let stride=0;const {party,p,hero,enemy}=setup('thunderLeopard',()=>petMoveSpeed(stride));
  p.cooldown=99;
  for(stride=0;stride<=3;stride++){
    assert.equal(petMoveSpeed(stride),playerMoveSpeed(stride)*.9);
    p.sprite.setPosition(195,300);const before=p.sprite.y;party.step(.05,[enemy(1,195,80)]);
    assert.ok(Math.abs(before-p.sprite.y-petMoveSpeed(stride)*.05)<1e-8);
    hero.y=590;p.sprite.setPosition(195,80);party.step(.05,[]);
    assert.ok(Math.abs(Math.hypot(p.sprite.x-195,p.sprite.y-80)-petMoveSpeed(stride)*.05)<1e-8);
    hero.y=300;p.returning=false;
  }
});
test('attack playback has preparation, one release and recovery at 30 and 60 fps',()=>{
  for(const fps of [30,60]){
    let elapsed=0,releases=0;const frames=new Set<number>();
    while(elapsed<PET_ATTACK_DURATION){const next=advancePetAttack(elapsed,1/fps);elapsed=next.elapsed;releases+=Number(next.release);frames.add(next.frame);}
    assert.equal(releases,1);assert.deepEqual([...frames],[4,5,6,7]);assert.equal(advancePetAttack(elapsed,1/fps).release,false);
  }
});
test('first and repeated pet strikes wait for preparation and hit only in the release pose',()=>{
  const {party,p,hits,enemy}=setup(),target=enemy(),frames=new Set<number>();
  party.step(.02,[target]);const start={x:p.sprite.x,y:p.sprite.y};
  assert.equal(p.sprite.frame,4);assert.equal(hits.length,0);
  for(let i=0;i<13;i++){party.step(.02,[target]);frames.add(p.sprite.frame);assert.equal(hits.length,0);}
  for(let i=0;i<19;i++){party.step(.02,[target]);frames.add(p.sprite.frame);assert.equal(p.sprite.x,start.x);assert.equal(p.sprite.y,start.y);}
  assert.deepEqual([...frames],[4,5,6,7]);assert.deepEqual(hits,[{id:1,frame:6,damage:42}]);
  for(let i=0;i<55;i++)party.step(.02,[target]);
  assert.equal(hits.length,2);assert.ok(hits.every(h=>h.frame===6));
});
test('all pets prepare before producing damage, shots, effects or a dash',()=>{
  for(const id of PET_IDS){
    const {party,p,hits,enemy}=setup(id),target=enemy();
    for(let i=0;i<14;i++)party.step(.02,[target]);
    assert.equal(hits.length,0,id);assert.equal(Reflect.get(party,'shots').length,0,id);assert.equal(Reflect.get(party,'effects').length,0,id);assert.equal(p.dash,undefined,id);
    assert.equal(p.sprite.frame,5,id);
    for(let i=0;i<3;i++)party.step(.02,[target]);
    assert.equal(p.sprite.frame,6,id);
    assert.ok(hits.length||Reflect.get(party,'shots').length||p.dash,id);
  }
});
test('zero time, disabled combat and loot cancellation cannot emit a prepared attack',()=>{
  const {party,p,hits,enemy}=setup(),target=enemy();
  party.step(0,[target]);assert.equal(p.attack,undefined);
  party.step(.02,[target]);party.step(.2,[target]);const elapsed=p.attack.elapsed;
  party.step(0,[target]);assert.equal(p.attack.elapsed,elapsed);
  party.clearAttacks();for(let i=0;i<30;i++)party.step(.02,[target],false);
  assert.equal(hits.length,0);assert.equal(p.attack,undefined);assert.equal(p.target,null);
});
test('a target dying during preparation cancels damage and a new target gets its own preparation',()=>{
  const {party,p,hits,enemy}=setup(),first=enemy(),second=enemy(2,225);
  party.step(.02,[first,second]);party.step(.2,[first,second]);first.hp=0;
  party.step(.02,[first,second]);assert.equal(hits.length,0);
  party.step(.02,[first,second]);assert.equal(p.attack.target,2);assert.equal(p.sprite.frame,4);
  for(let i=0;i<16;i++)party.step(.02,[first,second]);assert.deepEqual(hits.map(h=>h.id),[2]);
});
test('falcon travel is capped below player speed and each swept target is hit only once',()=>{
  const {party,p,hits,enemy}=setup('windFalcon'),targets=[enemy(1,250),enemy(2,270)];
  party.step(.02,targets);p.cooldown=99;const frames=new Set<number>();
  for(let i=0;i<110;i++){
    const x=p.sprite.x,y=p.sprite.y;party.step(.02,targets);frames.add(p.sprite.frame);
    assert.ok(Math.hypot(p.sprite.x-x,p.sprite.y-y)<=petMoveSpeed(0)*.02+1e-8);
  }
  assert.deepEqual(hits.map(h=>[h.id,h.damage]),[[1,PETS.windFalcon.damage],[2,PETS.windFalcon.damage]]);
  assert.ok(frames.has(7));assert.equal(p.dash,undefined);
});
test('persistent poison damage does not freeze the caster in its release pose',()=>{
  const plan=planChapterAttack('poison',0,{x:100,y:100},{x:200,y:300},false);
  assert.equal(chapterAttackFrame(plan,.1),4);assert.equal(chapterAttackFrame(plan,.8),5);
  assert.equal(chapterAttackFrame(plan,1),6);assert.equal(chapterAttackFrame(plan,1.15),7);
  assert.equal(chapterAttackFrame(plan,1.5),0);assert.equal(chapterAttackFrame(plan,plan.duration),0);
});
test('a multi-wave enemy recovers and prepares again before its next release',()=>{
  const plan=planChapterAttack('spores',0,{x:100,y:100},{x:200,y:300},false);
  assert.equal(chapterAttackFrame(plan,1.02),6);assert.equal(chapterAttackFrame(plan,1.2),7);
  assert.equal(chapterAttackFrame(plan,1.4),4);assert.equal(chapterAttackFrame(plan,1.7),5);
  assert.equal(chapterAttackFrame(plan,1.82),6);assert.equal(chapterAttackFrame(plan,2.02),7);
});
test('enemy dash holds its release pose during travel and recovers after landing',()=>{
  const plan=planChapterAttack('thrust',0,{x:100,y:100},{x:200,y:300},false),dash=plan.dash!,end=dash.start+dash.duration;
  assert.equal(chapterAttackFrame(plan,dash.start+.05),6);assert.equal(chapterAttackFrame(plan,end-.01),6);
  assert.equal(chapterAttackFrame(plan,end+.05),7);assert.equal(chapterAttackFrame(plan,end+.3),0);
});
