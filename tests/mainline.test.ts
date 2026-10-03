import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHAPTERS, MISSIONS, ROOMS, facilityCost, facilityLimit, initialSave, createRun, finishRoom, settle, validateSave, buyFacility } from '../src/core.ts';
import { NEW_CHAPTERS, MAINLINE_BATCHES, chapterEmberMultiplier, mainlineFacilityLimit, mainlineFacilityCost, firstClearBonus } from '../src/mainline.ts';

test('the expansion plans exactly seventeen distinct themes after the unchanged original six missions',()=>{
  assert.equal(CHAPTERS.length,20);
  assert.equal(MISSIONS.length,40);assert.equal(ROOMS.length,7);
  assert.deepEqual(MISSIONS.slice(0,6).map(m=>m.chapter),[0,0,1,1,2,2]);
  assert.equal(NEW_CHAPTERS.length,17);
  for(const key of ['name','asset','enemy','bossId'] as const)assert.equal(new Set(NEW_CHAPTERS.map(c=>c[key])).size,17);
  assert.equal(new Set(NEW_CHAPTERS.map(c=>c.petName)).size,9);
  assert.equal(6+NEW_CHAPTERS.flatMap(c=>c.missions).length,40);
  assert.deepEqual(MAINLINE_BATCHES.map(b=>[b.first+1,b.last+1]),[[4,7],[8,11],[12,15],[16,20]]);
});

test('the fortieth victory saves the ending once without unlocking a nonexistent mission',()=>{
  const s=initialSave();s.profile.cleared=39;s.run=createRun(s.profile,39,'staff','normal',8);s.run.room=7;s.run.embers=100;
  const result=settle(s,'victory');
  assert.equal(result.save.profile.cleared,40);assert.equal(result.earned,100+45*24+12240);
  const restored=validateSave(JSON.parse(JSON.stringify(result.save)));
  assert.equal(settle(restored,'victory').earned,0);
  assert.throws(()=>createRun(restored.profile,40,'staff','normal',8));
  assert.equal(createRun(restored.profile,39,'staff','hard',8).mission,39);
});

test('facility caps open on entering a segment while the archive always stays at twenty',()=>{
  for(const [cleared,cap] of [[0,20],[5,20],[6,30],[13,30],[14,40],[21,40],[22,50],[29,50],[30,60],[40,60]]){
    assert.equal(mainlineFacilityLimit('forge',cleared),cap);
    assert.equal(mainlineFacilityLimit('beacon',cleared),cap);
    assert.equal(mainlineFacilityLimit('archive',cleared),20);
  }
});

test('purchases one through twenty retain the original price and later levels add 150 each',()=>{
  for(const id of ['forge','beacon','archive'] as const){
    for(let level=0;level<20;level++)assert.equal(mainlineFacilityCost(id,level),(id==='forge'?70:id==='archive'?65:50)+level*65+Math.max(0,level-2)**2*5);
    assert.equal(mainlineFacilityCost(id,20),facilityCost(id,19)+150);
    assert.equal(mainlineFacilityCost(id,21),facilityCost(id,19)+300);
    assert.equal(mainlineFacilityCost(id,59),facilityCost(id,19)+6000);
  }
});

test('v4 pet checkpoints migrate to v5 intact and completed original saves can enter chapter four',()=>{
  const old=JSON.parse(readFileSync(new URL('./fixtures/save-v4.json',import.meta.url),'utf8'));
  const saved=structuredClone(old),next=validateSave(old);
  assert.deepEqual(next,{...old,version:5});
  assert.deepEqual(old,saved);
  assert.deepEqual(validateSave(next),next);
  assert.equal(next.run!.hp,63);
  assert.equal(next.run!.growth.damage,1.6);
  next.run=null;
  assert.equal(createRun(next.profile,6,'staff','normal',42).mission,6);
  assert.throws(()=>createRun(next.profile,6,'staff','hard',42));
});

test('every available new mission unlocks in order and the final available mission has no next run',()=>{
  let save=initialSave();save.profile.cleared=6;
  for(let mission=6;mission<MISSIONS.length;mission++){
    save.run=createRun(save.profile,mission,'staff','normal',mission);
    for(let room=0;room<ROOMS.length;room++)save.run=finishRoom(save.run);
    save=validateSave(settle(save,'victory').save);
    assert.equal(save.profile.cleared,mission+1);
  }
  assert.throws(()=>createRun(save.profile,MISSIONS.length,'staff','normal',1));
  for(const mission of [NaN,1.5,Infinity,-1])assert.throws(()=>createRun(save.profile,mission,'staff','normal',1));
  assert.equal(createRun(save.profile,MISSIONS.length-1,'staff','hard',1).difficulty,'hard');
});

test('room and victory rewards scale once, first-clear rewards ignore fortune and archive',()=>{
  const save=initialSave();save.profile.cleared=6;save.profile.facilities.archive=20;
  save.run=createRun(save.profile,6,'staff','normal',9);save.run.upgrades.fortune=3;
  for(let room=0;room<7;room++)save.run=finishRoom(save.run);
  const base=Array.from({length:7},(_,room)=>Math.round((24+room*2)*2*2.2)).reduce((a,b)=>a+b,0);
  assert.equal(save.run.embers,base);
  const result=settle(save,'victory');
  assert.equal(result.earned,base+90+1020);
  assert.deepEqual(settle(save,'victory'),result,'retry from the same saved entrance produces one replacement, not an accumulation');
  assert.equal(settle(validateSave(result.save),'victory').earned,0);
  const replay=structuredClone(save);replay.profile.cleared=7;
  assert.equal(settle(replay,'victory').earned,base+90);
  assert.equal(settle(save,'retreat').earned,base);
  assert.equal(settle(save,'defeat').earned,Math.floor(base/2));
});

test('new caps govern purchases and save validation while high growth snapshots survive reload',()=>{
  let save=initialSave();save.profile.cleared=6;save.profile.embers=100000;save.profile.facilities.forge=20;
  for(let level=20;level<30;level++){
    const before=save.profile.embers;
    save=buyFacility(save,'forge');
    assert.equal(save.profile.embers,before-facilityCost('forge',level));
  }
  assert.equal(facilityLimit('forge',save.profile),30);
  assert.throws(()=>buyFacility(save,'forge'));
  save.run=createRun(save.profile,6,'staff','normal',2);save.run.hp=37;
  assert.equal(save.run.growth.damage,2.4);
  assert.deepEqual(validateSave(save),save);
  save.run.growth.damage=4.81;assert.throws(()=>validateSave(save));
  save.run=null;save.profile.facilities.archive=21;assert.throws(()=>validateSave(save));
  save.profile.facilities.archive=20;save.profile.facilities.forge=31;assert.throws(()=>validateSave(save));
});

test('chapter ember multipliers interpolate inside each segment without raising early rewards',()=>{
  const expected=[1,1,1,2,3,4,5,6,22/3,26/3,10,11.5,13,14.5,16,17.6,19.2,20.8,22.4,24];
  expected.forEach((n,chapter)=>assert.ok(Math.abs(chapterEmberMultiplier(chapter)-n)<1e-10));
});

test('each available segment accepts its higher camp and growth snapshot without changing an injured run',()=>{
  for(const batch of MAINLINE_BATCHES.filter(b=>b.first<CHAPTERS.length)){
    const s=initialSave();s.profile.cleared=batch.first*2;s.profile.facilities={forge:batch.facilityCap,beacon:batch.facilityCap,archive:20};
    s.run=createRun(s.profile,batch.first*2,'staff','normal',42);s.run.hp=31;
    assert.equal(s.run.growth.damage,batch.facilityCap*.08);assert.deepEqual(validateSave(JSON.parse(JSON.stringify(s))),s);
    s.profile.facilities.forge++;assert.throws(()=>validateSave(s));
  }
});

test('new first-clear bonuses are unboosted, never retroactive and never repeat on replays',()=>{
  for(let mission=0;mission<40;mission++){
    const chapter=Math.floor(mission/2);
    assert.equal(firstClearBonus(chapter,mission,mission),chapter<3?0:Math.round(510*chapterEmberMultiplier(chapter)));
    assert.equal(firstClearBonus(chapter,mission,mission+1),0);
    assert.equal(firstClearBonus(chapter,mission,40),0);
  }
  assert.equal(firstClearBonus(3,6,6),1020);
  assert.equal(firstClearBonus(19,39,39),12240);
});
