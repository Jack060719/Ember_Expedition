import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSave, createRun, upgradeChoices, applyUpgrade, validateSave, EVOLUTIONS, isEvolved, type Run, type UpgradeId } from '../src/core.ts';
import { UPGRADES, AUTO_UPGRADES, upgradeDescription } from '../src/upgrades.ts';
import { meteorStats, cullMultiplier, resolveMultiplier } from '../src/ability-effects.ts';

// Keep the pre-expansion build explicit; future entries must not change this fixture.
const legacyUpgrades = {
  power: 5, haste: 4, stride: 3, vitality: 4, reach: 3, split: 3,
  pierce: 3, ember: 3, frost: 3, storm: 3, ward: 3, mend: 3,
  orbit: 3, nova: 3, magnet: 2, fortune: 3, focus: 3, secondwind: 1,
};
const near = (actual:number,expected:number) => assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
function freshRun(seed=8):Run {
  const profile=initialSave().profile;profile.facilities.forge=2;
  return createRun(profile,0,'staff','normal',seed);
}

test('the catalog preserves the original IDs and limits and shares its automatic skill entries',()=>{
  assert.equal(new Set(UPGRADES.map(u=>u.id)).size,UPGRADES.length);
  assert.deepEqual(UPGRADES.slice(0,18).map(u=>[u.id,u.max]),Object.entries(legacyUpgrades));
  assert.deepEqual(UPGRADES.slice(18).map(u=>[u.id,u.max,u.category]),[
    ['meteor',3,'auto'],['cull',3,'offense'],['resolve',3,'survival'],
  ]);
  assert.deepEqual(AUTO_UPGRADES.map(u=>u.id),['storm','orbit','nova','meteor']);
  for(const skill of AUTO_UPGRADES)assert.equal(skill,UPGRADES.find(u=>u.id===skill.id));
});

test('choices survive serialization without mutation and offer unfinished materials and unlearned automatic skills',()=>{
  for(const weapon of ['staff','blade','halo'] as const)for(const seed of [1,8,12,42]){
    const run=freshRun(seed);run.weapon=weapon;
    for(let level=2;level<=8;level++){
      run.level=level;run.room=Math.min(6,Math.floor(level/2));
      const before=structuredClone(run),choices=upgradeChoices(run);
      assert.deepEqual(choices,upgradeChoices(JSON.parse(JSON.stringify(run))));
      assert.deepEqual(run,before);
      assert.equal(new Set(choices.map(u=>u.id)).size,choices.length);
      assert.equal(choices.length,3);
      assert.ok(choices.some(u=>u.category==='auto'&&!(run.upgrades[u.id]??0)));
      if(!isEvolved(run)){
        const required=EVOLUTIONS[weapon].requires;
        const material=choices.find(u=>(required[u.id]??0)>(run.upgrades[u.id]??0));
        assert.ok(material,`${weapon}, seed ${seed}, level ${level}`);
        applyUpgrade(run,material.id);
      }
    }
    assert.ok(isEvolved(run));
  }
});

test('new upgrades remain obtainable on every original weapon without health or character gates',()=>{
  const profile=initialSave().profile;profile.cleared=2;profile.facilities.forge=2;
  for(const character of ['keeper','scout','warden'] as const)for(const weapon of ['staff','blade','halo'] as const)for(const hp of [1,100]){
    const run=createRun(profile,0,weapon,'normal',8,character);run.hp=hp;run.upgrades={...legacyUpgrades};
    assert.deepEqual(new Set(upgradeChoices(run).map(u=>u.id)),new Set(['meteor','cull','resolve']));
    for(const id of ['meteor','cull','resolve'] as const){
      for(let level=1;level<=3;level++){applyUpgrade(run,id);assert.equal(run.upgrades[id],level);}
      assert.ok(upgradeChoices(run).every(u=>u.id!==id));
      const before=structuredClone(run);assert.throws(()=>applyUpgrade(run,id));assert.deepEqual(run,before);
    }
    assert.deepEqual(upgradeChoices(run),[]);
  }
});

test('a skill that is also an evolution material occupies one choice and fewer candidates never duplicate',()=>{
  const run=freshRun();run.weapon='halo';run.upgrades={...legacyUpgrades,orbit:0,haste:0,meteor:3,cull:3,resolve:3};
  const choices=upgradeChoices(run);
  assert.equal(choices.length,2);assert.deepEqual(new Set(choices.map(u=>u.id)),new Set(['orbit','haste']));
  run.upgrades.haste=4;assert.deepEqual(upgradeChoices(run).map(u=>u.id),['orbit']);
  run.upgrades.orbit=3;assert.deepEqual(upgradeChoices(run),[]);
});

test('meteor levels define one delayed impact and only haste and reach modify its timing and radius',()=>{
  assert.equal(meteorStats({}),null);assert.equal(meteorStats({meteor:0}),null);
  for(const [index,multiplier] of [1.8,2.4,3].entries()){
    const level=index+1,stats=meteorStats({meteor:level})!;
    assert.deepEqual(stats,{damageMultiplier:multiplier,radius:60+index*10,cooldown:5,targetRange:300,delay:.4,initialDelay:1});
    const boosted=meteorStats({meteor:level,haste:4,reach:3})!;
    near(boosted.radius,stats.radius*1.54);near(boosted.cooldown,2.6);
    assert.equal(boosted.damageMultiplier,stats.damageMultiplier);
    assert.equal(boosted.targetRange,300);assert.equal(boosted.delay,.4);assert.equal(boosted.initialDelay,1);
    assert.deepEqual(meteorStats({...legacyUpgrades,haste:0,reach:0,meteor:level,cull:3,resolve:3}),stats);
  }
});

test('cull uses the target health before a direct hit and never amplifies secondary damage',()=>{
  assert.equal(cullMultiplier({},1,100),1);
  for(const level of [1,2,3]){
    near(cullMultiplier({cull:level},35,100),1+level*.15);
    near(cullMultiplier({cull:level},349,1000),1+level*.15);
    assert.equal(cullMultiplier({cull:level},35.001,100),1);
    assert.equal(cullMultiplier({cull:level},1,100,true),1);
  }
  const damage=20;
  const before=cullMultiplier({cull:3},40,100);
  assert.equal(before,1);assert.equal(40-damage*before,20);
  near(cullMultiplier({cull:3},20,100),1.45);
});

test('resolve multiplies existing ward reduction and does not retroactively protect a threshold-crossing hit',()=>{
  assert.equal(resolveMultiplier({},1,100),1);
  for(const level of [1,2,3]){
    near(resolveMultiplier({resolve:level},35,100),1-level*.1);
    assert.equal(resolveMultiplier({resolve:level},35.001,100),1);
  }
  const upgrades={ward:3,resolve:3};
  near(100*(1-upgrades.ward*.12)*resolveMultiplier(upgrades,35,100),44.8);
  assert.equal(resolveMultiplier(upgrades,40,100),1);
  assert.equal(resolveMultiplier(upgrades,40,100),resolveMultiplier(upgrades,80,200));
  near(resolveMultiplier(upgrades,40,120),.7);
});

test('effect queries and level descriptions are pure and communicate totals for each level',()=>{
  const upgrades={meteor:2,cull:2,resolve:2,haste:2,reach:2};
  const before=structuredClone(upgrades);
  meteorStats(upgrades);cullMultiplier(upgrades,30,100);resolveMultiplier(upgrades,30,100);
  assert.deepEqual(upgrades,before);
  for(const upgrade of UPGRADES){
    assert.equal(upgradeDescription(upgrade.id,0),'尚未取得');
    for(let level=1;level<=upgrade.max;level++){
      const text=upgradeDescription(upgrade.id,level);
      assert.ok(text.length>0);assert.doesNotMatch(text,/undefined|NaN/);
    }
  }
  assert.match(upgradeDescription('meteor',3),/3 倍/);
  assert.match(upgradeDescription('meteor',3),/80/);
  assert.match(upgradeDescription('cull',3),/45%/);
  assert.match(upgradeDescription('resolve',3),/30%/);
  assert.match(upgradeDescription('vitality',2),/40/);
  assert.match(upgradeDescription('vitality',2),/20/);
});

test('descriptions include threshold equality and describe the actual frost and meteor timing',()=>{
  for(const level of [1,2,3]){
    assert.match(upgradeDescription('cull',level),/35%.*以下/);
    assert.match(upgradeDescription('resolve',level),/35%.*以下/);
    assert.match(upgradeDescription('frost',level),new RegExp(`${level*18}%`));
    assert.match(upgradeDescription('frost',level),/1\.5 秒/);
    const meteor=upgradeDescription('meteor',level);
    assert.match(meteor,/每 5 秒/);assert.match(meteor,/首次 1 秒/);
    assert.match(meteor,/300/);assert.match(meteor,/0\.4 秒/);
    assert.match(meteor,/長明/);assert.match(meteor,/疾光/);
  }
  assert.match(UPGRADES.find(u=>u.id==='cull')!.description,/35%.*以下/);
  assert.match(UPGRADES.find(u=>u.id==='resolve')!.description,/35%.*以下/);
  assert.match(upgradeDescription('cull',3),/燃燒.*連爆/);
  assert.match(upgradeDescription('resolve',3),/另/);
});

test('save round trips preserve the new abilities without repeating vitality, healing or starting grants',()=>{
  const save=initialSave();save.run=createRun(save.profile,0,'staff','normal',42);
  for(const id of ['meteor','cull','resolve'] as const)for(let i=0;i<3;i++)applyUpgrade(save.run,id);
  applyUpgrade(save.run,'vitality');save.run.hp=37;save.run.secondWindUsed=true;
  const before=structuredClone(save);
  for(let i=0;i<3;i++)assert.deepEqual(validateSave(JSON.parse(JSON.stringify(before))),before);
  for(const id of ['meteor','cull','resolve'] as const)for(const value of [-1,.5,4,NaN,Infinity]){
    const invalid=structuredClone(before);invalid.run!.upgrades[id]=value;
    assert.throws(()=>validateSave(invalid));
  }
  const unknown=structuredClone(before);unknown.run!.upgrades['unknown' as UpgradeId]=1;
  assert.throws(()=>validateSave(unknown));assert.deepEqual(save,before);
});

test('an explicit legacy v2 build preserves its abilities and health without gaining any new upgrade',()=>{
  const legacy={version:2,profile:{embers:70,cleared:0,facilities:{forge:2,beacon:0,archive:3},totalKills:45,expeditions:2,bestHard:0},settings:{sound:true},run:{
    id:'task004-legacy',seed:42,mission:0,difficulty:'normal',weapon:'halo',room:3,hp:63,maxHp:180,
    embers:90,kills:160,elapsed:240,upgrades:{...legacyUpgrades},level:12,xp:17,
    growth:{damage:.16,experience:.09,embers:.09},secondWindUsed:true,
  }};
  const restored=validateSave(legacy);
  assert.deepEqual(restored.profile,legacy.profile);
  assert.deepEqual(restored.run!.upgrades,legacy.run.upgrades);
  assert.equal(restored.run!.hp,63);assert.equal(restored.run!.maxHp,180);
  assert.equal(restored.run!.secondWindUsed,true);
  for(const id of ['meteor','cull','resolve'] as const)assert.equal(restored.run!.upgrades[id],undefined);
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(restored))),restored);
});
