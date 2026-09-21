import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../src/core.ts';

const fixture=(version:number)=>JSON.parse(readFileSync(new URL(`./fixtures/save-v${version}.json`,import.meta.url),'utf8'));

test('v3 defaults and new keeper runs include the starting vitality once',()=>{
  const save=core.initialSave();
  assert.equal(save.version,3);assert.equal(save.settings.preferredCharacter,'keeper');
  save.run=core.createRun(save.profile,0,'staff','normal',8);
  assert.equal(save.run.character,'keeper');assert.equal(save.run.upgrades.vitality,1);
  assert.equal(save.run.hp,120);assert.equal(save.run.maxHp,120);
  assert.deepEqual(core.validateSave(JSON.parse(JSON.stringify(save))),save);
  const next=core.finishRoom(save.run);
  assert.equal(next.upgrades.vitality,1);assert.equal(next.maxHp,120);
});

test('starting loadout is a pure preview shared by new runs, including locked previews',()=>{
  const profile=core.initialSave().profile,before=structuredClone(profile);
  const preview=core.startingLoadout(profile,'warden');
  assert.deepEqual(core.startingLoadout(profile,'warden'),preview);
  assert.deepEqual(profile,before);assert.equal('id' in preview,false);
  assert.equal(preview.upgrades.ward,1);
  assert.throws(()=>core.createRun(profile,0,'staff','normal',8,'warden'));
  profile.cleared=2;profile.facilities={forge:2,beacon:3,archive:20};
  assert.deepEqual(core.availableCharacters(profile),['keeper','scout','warden']);
  for(const character of core.availableCharacters(profile))for(const weapon of core.availableWeapons(profile)){
    const planned=core.startingLoadout(profile,character),run=core.createRun(profile,0,weapon,'normal',8,character);
    assert.deepEqual({hp:run.hp,maxHp:run.maxHp,upgrades:run.upgrades,growth:run.growth},planned);
    for(const [id,n] of Object.entries(run.upgrades))assert.ok(n!<=core.UPGRADES.find(u=>u.id===id)!.max);
  }
  const warden=core.startingLoadout(profile,'warden');
  assert.equal(warden.upgrades.ward,2);assert.equal(warden.upgrades.magnet,1);assert.equal(warden.upgrades.mend,1);
  assert.equal(core.startingLoadout(profile,'scout').upgrades.stride,1);
  assert.equal(core.startingLoadout(profile,'keeper').maxHp,150);
});

test('character unlocks follow cleared progress and reject locked new runs',()=>{
  const profile=core.initialSave().profile;
  assert.deepEqual(core.availableCharacters(profile),['keeper']);
  assert.throws(()=>core.createRun(profile,0,'staff','normal',8,'scout'));
  profile.cleared=1;
  assert.deepEqual(core.availableCharacters(profile),['keeper','scout']);
  assert.throws(()=>core.createRun(profile,0,'staff','normal',8,'warden'));
  profile.cleared=2;
  assert.deepEqual(core.availableCharacters(profile),['keeper','scout','warden']);
});

test('v1 and v2 migrations preserve checkpoint values without granting keeper vitality',()=>{
  for(const version of [1,2])for(const room of version===1?[0,3,4,8]:[0,1,3,7]){
    const old=fixture(version);old.run.room=room;
    if(version===1)old.run.puzzle=room===3?{mask:79,moves:8}:null;
    const before=structuredClone(old),migrated=core.validateSave(old);
    assert.equal(migrated.version,3);assert.equal(migrated.settings.preferredCharacter,'keeper');
    assert.equal(migrated.run!.character,'keeper');
    const expected=structuredClone(old.run);
    expected.character='keeper';
    if(version===1){expected.room=room>3?room-1:room;expected.growth=core.permanentGrowth(old.profile);delete expected.route;delete expected.puzzle;}
    assert.deepEqual(migrated.run,expected);assert.deepEqual(migrated.profile,old.profile);
    assert.equal(migrated.settings.sound,old.settings.sound);
    assert.deepEqual(core.validateSave(migrated),migrated);assert.deepEqual(old,before);
  }
});

test('legacy camp saves get a preference without starting a run',()=>{
  for(const version of [1,2]){
    const old=fixture(version);old.run=null;
    const migrated=core.validateSave(old);
    assert.equal(migrated.version,3);assert.equal(migrated.run,null);
    assert.equal(migrated.settings.preferredCharacter,'keeper');assert.deepEqual(migrated.profile,old.profile);
  }
});

test('v3 preserves distinct camp preference and active character across save and settlement',()=>{
  const save=core.initialSave();save.profile.cleared=2;save.settings.preferredCharacter='scout';
  save.run=core.createRun(save.profile,0,'staff','normal',8,'warden');
  save.run.hp=43;save.run.secondWindUsed=true;
  const restored=core.validateSave(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(restored,save);
  const settled=core.settle(restored,'retreat').save;
  assert.equal(settled.settings.preferredCharacter,'scout');assert.equal(settled.run,null);
  assert.deepEqual(core.validateSave(settled),settled);
});

test('v3 rejects missing, unknown and locked character fields without changing the input',()=>{
  const valid=core.initialSave();valid.run=core.createRun(valid.profile,0,'staff','normal',8);
  for(const mutate of [
    s=>delete s.settings.preferredCharacter,s=>s.settings.preferredCharacter='unknown',s=>s.settings.preferredCharacter='scout',
    s=>delete s.run.character,s=>s.run.character='unknown',s=>s.run.character='warden',s=>s.version=4,
    s=>s.run.upgrades.unknown=1,s=>s.run.upgrades.ward=4,
  ]){
    const invalid=JSON.parse(JSON.stringify(valid));mutate(invalid);const before=structuredClone(invalid);
    assert.throws(()=>core.validateSave(invalid));assert.deepEqual(invalid,before);
  }
});

test('auto upgrades come from the registry and retain the existing skill order',()=>{
  assert.deepEqual(core.AUTO_UPGRADES.map(u=>u.id),['storm','orbit','nova']);
  assert.deepEqual(core.AUTO_UPGRADES,core.UPGRADES.filter(u=>u.category==='auto'));
});
