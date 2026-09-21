import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, DEFAULT_CHARACTER, availableCharacters, initialSave, startingLoadout, createRun, applyUpgrade, finishRoom, validateSave, WEAPONS, UPGRADES, type CharacterId, type Weapon } from '../src/core.ts';

test('characters unlock from completed missions and gate new expeditions independently of weapons',()=>{
  const profile=initialSave().profile;
  assert.equal(DEFAULT_CHARACTER,'keeper');
  assert.deepEqual(availableCharacters(profile),['keeper']);
  assert.throws(()=>createRun(profile,0,'staff','normal',1,'scout'));
  assert.throws(()=>createRun(profile,0,'staff','normal',1,'warden'));
  profile.cleared=1;
  assert.deepEqual(availableCharacters(profile),['keeper','scout']);
  assert.equal(createRun(profile,0,'staff','normal',1,'scout').character,'scout');
  assert.throws(()=>createRun(profile,0,'blade','normal',1,'scout'));
  profile.cleared=2;
  assert.deepEqual(availableCharacters(profile),['keeper','scout','warden']);
});

test('previews are pure and match new expedition stats including archive overlap',()=>{
  for(const archive of [0,1,2,3,20])for(const beacon of [0,20]){
    const profile=initialSave().profile;profile.cleared=2;profile.facilities={forge:2,beacon,archive};
    const original=structuredClone(profile);
    for(const character of Object.keys(CHARACTERS) as CharacterId[]){
      const preview=startingLoadout(profile,character),run=createRun(profile,0,'staff','normal',3,character);
      assert.deepEqual(preview,{hp:run.hp,maxHp:run.maxHp,upgrades:run.upgrades,growth:run.growth});
      assert.equal(run.hp,100+beacon*10+(character==='keeper'?20:0));
      assert.equal(run.upgrades.vitality??0,character==='keeper'?1:0);
      assert.equal(run.upgrades.stride??0,character==='scout'?1:0);
      assert.equal(run.upgrades.ward??0,(archive>=3?1:0)+(character==='warden'?1:0));
      assert.equal(run.upgrades.magnet??0,archive>=1?1:0);
      assert.equal(run.upgrades.mend??0,archive>=2?1:0);
      assert.equal(run.level,1);assert.equal(run.xp,0);
      assert.deepEqual(profile,original);
    }
  }
  const locked=initialSave().profile;
  assert.equal(startingLoadout(locked,'warden').upgrades.ward,1);
  assert.deepEqual(locked,initialSave().profile);
});

test('every character can use every unlocked weapon and acquire every upgrade to its normal cap',()=>{
  const profile=initialSave().profile;profile.cleared=6;profile.facilities={forge:20,beacon:20,archive:20};
  for(const character of Object.keys(CHARACTERS) as CharacterId[])for(const weapon of Object.keys(WEAPONS) as Weapon[]){
    const run=createRun(profile,0,weapon,'normal',42,character);
    for(const upgrade of UPGRADES){
      while((run.upgrades[upgrade.id]??0)<upgrade.max)applyUpgrade(run,upgrade.id);
      assert.equal(run.upgrades[upgrade.id],upgrade.max);
      assert.throws(()=>applyUpgrade(run,upgrade.id));
    }
    assert.equal(run.character,character);assert.equal(run.weapon,weapon);
  }
});

test('restore and room transitions preserve character and never repeat starting gifts or recovery',()=>{
  for(const character of Object.keys(CHARACTERS) as CharacterId[]){
    const save=initialSave();save.profile.cleared=2;save.profile.facilities.archive=3;
    save.settings.preferredCharacter=character==='keeper'?'scout':'keeper';
    save.run=createRun(save.profile,0,'staff','normal',42,character);
    save.run.hp=37;save.run.secondWindUsed=true;save.run.upgrades.secondwind=1;
    const original=structuredClone(save);
    for(let i=0;i<3;i++)assert.deepEqual(validateSave(JSON.parse(JSON.stringify(save))),original);
    const next=finishRoom(save.run);
    assert.equal(next.character,character);assert.deepEqual(next.upgrades,save.run.upgrades);
    assert.equal(next.hp,37+Math.ceil(save.run.maxHp*.08));
    save.run=next;
    assert.deepEqual(validateSave(JSON.parse(JSON.stringify(save))),save);
    assert.equal(save.run.secondWindUsed,true);
    assert.notEqual(save.settings.preferredCharacter,save.run.character);
  }
});

test('v2 character migration preserves injured legacy runs without granting the new keeper bonus',()=>{
  const save=initialSave();save.run=createRun(save.profile,0,'staff','normal',7);
  const legacy=JSON.parse(JSON.stringify(save));legacy.version=2;
  delete legacy.run.character;delete legacy.settings.preferredCharacter;
  legacy.run.upgrades={power:1};legacy.run.hp=43;legacy.run.maxHp=100;
  const migrated=validateSave(legacy);
  assert.equal(migrated.run!.character,'keeper');assert.equal(migrated.settings.preferredCharacter,'keeper');
  assert.equal(migrated.run!.hp,43);assert.equal(migrated.run!.maxHp,100);
  assert.deepEqual(migrated.run!.upgrades,{power:1});assert.deepEqual(validateSave(migrated),migrated);
  assert.equal(legacy.run.character,undefined);
});
