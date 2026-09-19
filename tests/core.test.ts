import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSave, createRun, settle, finishRoom, buyFacility, availableWeapons, upgradeChoices, applyUpgrade, validateSave, encounter, UPGRADES, ROOMS, EVOLUTIONS, isEvolved, hasSynergy, permanentGrowth, FACILITIES } from '../src/core.ts';

test('defeat retains half the run currency and existing permanent growth',()=>{
  const s=initialSave();s.profile.cleared=2;s.profile.facilities.beacon=2;s.profile.embers=100;
  s.run=createRun(s.profile,2,'staff','normal',42);s.run.embers=55;s.run.kills=9;
  const result=settle(s,'defeat');
  assert.equal(result.earned,27);assert.equal(result.save.profile.embers,127);
  assert.equal(result.save.profile.cleared,2);assert.equal(result.save.profile.facilities.beacon,2);
  assert.equal(result.save.run,null);assert.equal(result.save.profile.totalKills,9);
  assert.equal(s.run.embers,55);
});
test('settlement is idempotent after a save/reload and has no double rewards',()=>{
  const s=initialSave();s.run=createRun(s.profile,0,'staff','normal',1);s.run.room=ROOMS.length;s.run.embers=100;
  const once=settle(s,'victory').save;
  const restored=validateSave(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(settle(restored,'victory').save,once);
  assert.equal(once.profile.embers,145);assert.equal(once.profile.cleared,1);
});
test('six victories unlock the story in order; hard replays do not skip chapters',()=>{
  let s=initialSave();
  assert.throws(()=>createRun(s.profile,1,'staff','normal',4));
  assert.throws(()=>createRun(s.profile,0,'staff','hard',4));
  for(let i=0;i<6;i++){s.run=createRun(s.profile,i,'staff','normal',i);s.run.room=ROOMS.length;s=settle(s,'victory').save;assert.equal(s.profile.cleared,i+1);}
  s.run=createRun(s.profile,0,'staff','hard',15);s.run.room=ROOMS.length;s=settle(s,'victory').save;
  assert.equal(s.profile.cleared,6);assert.equal(s.profile.bestHard,1);
});
test('camp purchases spend exactly once and weapon unlocks gate new runs',()=>{
  let s=initialSave();assert.throws(()=>buyFacility(s,'forge'));assert.throws(()=>createRun(s.profile,0,'blade','normal',1));
  s.profile.embers=300;s=buyFacility(s,'forge');assert.equal(s.profile.embers,230);assert.deepEqual(availableWeapons(s.profile),['staff','blade']);
  s=buyFacility(s,'forge');assert.equal(s.profile.embers,95);assert.deepEqual(availableWeapons(s.profile),['staff','blade','halo']);
  s.run=createRun(s.profile,0,'blade','normal',1);assert.throws(()=>buyFacility(s,'beacon'));
});
test('combat room completion grants rewards and recovery without changing its checkpoint',()=>{
  const r=createRun(initialSave().profile,0,'staff','normal',18);r.room=3;r.hp=70;
  const completed=finishRoom(r);
  assert.equal(completed.room,4);assert.equal(completed.embers,30);assert.equal(completed.hp,78);
  assert.equal(r.hp,70);assert.equal(r.room,3);assert.equal(r.embers,0);
  completed.room=ROOMS.length;assert.deepEqual(finishRoom(completed),completed);
});
test('upgrade choices are deterministic, unique and exclude maxed abilities',()=>{
  const r=createRun(initialSave().profile,0,'staff','normal',99);
  assert.deepEqual(upgradeChoices(r),upgradeChoices(r));assert.equal(new Set(upgradeChoices(r).map(u=>u.id)).size,3);
  for(const u of UPGRADES)r.upgrades[u.id]=u.max;
  assert.deepEqual(upgradeChoices(r),[]);assert.throws(()=>applyUpgrade(r,'power'));
});
test('encounter order varies by expedition while restored seeds keep the same route',()=>{
  const order=(seed:number)=>{const r=createRun(initialSave().profile,0,'staff','normal',seed);return [1,2,3,4,5].map(room=>{r.room=room;return encounter(r).name;});};
  assert.deepEqual(order(1),order(1));assert.notDeepEqual(order(1),order(8));assert.equal(new Set(order(1)).size,5);
});
test('import rejects malformed, non-finite, locked and future saves',()=>{
  const base=initialSave();assert.deepEqual(validateSave(base),base);
  for(const bad of [null,{}, {...base,version:3},{...base,profile:{...base.profile,embers:-1}},{...base,profile:{...base.profile,cleared:7}}])assert.throws(()=>validateSave(bad));
  base.run=createRun(base.profile,0,'staff','normal',123);
  const valid=JSON.parse(JSON.stringify(base));assert.deepEqual(validateSave(valid),base);
  base.run.hp=NaN;assert.throws(()=>validateSave(base));
  base.run.hp=50;base.run.weapon='halo';assert.throws(()=>validateSave(base));
  base.run.weapon='staff';base.run.growth.experience=Infinity;assert.throws(()=>validateSave(base));
});

function legacySave(room:number){
  const s=initialSave();s.profile.cleared=4;s.profile.facilities={forge:3,beacon:4,archive:3};s.profile.embers=275;
  s.run=createRun(s.profile,3,'blade','normal',222);s.run.room=room;s.run.hp=63;s.run.xp=17;s.run.embers=94;s.run.upgrades={power:3,reach:1,ember:2};
  const old=JSON.parse(JSON.stringify(s));old.version=1;old.run.route='risk';old.run.puzzle=room===3?{mask:79,moves:8}:null;delete old.run.growth;
  return old;
}
test('all legacy room checkpoints migrate once, preserving run and permanent progress',()=>{
  for(let room=0;room<=8;room++){
    const old=legacySave(room),before=structuredClone(old),migrated=validateSave(old);
    assert.equal(migrated.version,2);assert.equal(migrated.run!.room,room>3?room-1:room);
    assert.deepEqual(migrated.profile,old.profile);assert.deepEqual(migrated.run!.upgrades,old.run.upgrades);
    for(const key of ['hp','maxHp','xp','level','embers','kills','elapsed','seed','id','weapon','difficulty','secondWindUsed'])assert.deepEqual(migrated.run![key],old.run[key]);
    assert.equal('puzzle' in migrated.run!,false);assert.equal('route' in migrated.run!,false);
    assert.deepEqual(migrated.run!.growth,permanentGrowth(migrated.profile));
    assert.deepEqual(validateSave(migrated),migrated);assert.deepEqual(old,before);
  }
});
test('legacy camp saves migrate and invalid old puzzle/route fields are rejected',()=>{
  const old=legacySave(3);old.run=null;assert.equal(validateSave(old).run,null);
  for(const mutate of [(s)=>s.run.room=9,(s)=>s.run.route='unknown',(s)=>s.run.puzzle.mask=512,(s)=>delete s.run.puzzle]){
    const invalid=legacySave(3);mutate(invalid);assert.throws(()=>validateSave(invalid));
  }
});
test('each primary weapon evolves only when both visible requirements are met',()=>{
  const p=initialSave().profile;p.facilities.forge=2;
  for(const weapon of ['staff','blade','halo'] as const){
    const r=createRun(p,0,weapon,'normal',2);assert.equal(isEvolved(r),false);
    for(const [id,level] of Object.entries(EVOLUTIONS[weapon].requires)){
      for(let i=0;i<level!;i++){assert.equal(isEvolved(r),false);applyUpgrade(r,id as keyof typeof r.upgrades);}
    }
    assert.equal(isEvolved(r),true);assert.equal(r.weapon,weapon);
  }
});

test('balance updates preserve already evolved v2 checkpoints and unspent experience',()=>{
  const s=initialSave();s.profile.facilities={forge:2,beacon:3,archive:3};
  s.run=createRun(s.profile,0,'staff','normal',12);s.run.room=1;s.run.level=6;s.run.xp=17;
  s.run.upgrades={power:3,pierce:2};s.run.kills=165;s.run.embers=40;
  const restored=validateSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored,s);assert.ok(isEvolved(restored.run!));
  assert.equal(restored.version,2);
});
test('level choices always offer an unfinished evolution component and permit all auto skills',()=>{
  const r=createRun(initialSave().profile,0,'staff','normal',2);
  for(let level=2;!isEvolved(r)&&level<12;level++){
    r.level=level;const choices=upgradeChoices(r),component=choices.find(u=>u.id in EVOLUTIONS.staff.requires);
    assert.ok(component);applyUpgrade(r,component.id);
  }
  assert.ok(isEvolved(r));
  for(const id of ['storm','orbit','nova'] as const)applyUpgrade(r,id);
  assert.equal(r.upgrades.storm,1);assert.equal(r.upgrades.orbit,1);assert.equal(r.upgrades.nova,1);
});
test('synergies require both components, and higher permanent growth survives a fresh run',()=>{
  const s=initialSave();s.profile.facilities={forge:12,beacon:15,archive:10};
  const r=createRun(s.profile,0,'staff','normal',8);r.upgrades.storm=2;r.upgrades.frost=1;
  assert.equal(hasSynergy(r,'froststorm'),false);applyUpgrade(r,'frost');assert.equal(hasSynergy(r,'froststorm'),true);
  r.upgrades.ember=2;r.upgrades.nova=2;assert.equal(hasSynergy(r,'wildfire'),true);
  assert.equal(r.maxHp,250);assert.equal(r.growth.damage,.96);assert.equal(r.growth.experience,.3);
  s.run=r;s.run.embers=80;const after=settle(s,'retreat').save;
  const fresh=createRun(after.profile,0,'staff','normal',9);
  assert.equal(fresh.level,1);assert.equal(fresh.upgrades.storm,undefined);assert.deepEqual(fresh.growth,r.growth);
  assert.equal(after.profile.embers,80);assert.deepEqual(validateSave(after),after);
  assert.ok(FACILITIES.forge.max>3);
});
