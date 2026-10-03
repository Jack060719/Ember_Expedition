import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSave, createRun, upgradeChoices, UPGRADES, WEAPONS, EVOLUTIONS, type CharacterId, type Weapon, type UpgradeId } from '../src/core.ts';

function freshRun(weapon:Weapon='boomerang',character:CharacterId='keeper',seed=8) {
  const profile=initialSave().profile;
  profile.cleared=6;profile.facilities={forge:WEAPONS[weapon].requiredForge,beacon:0,archive:3};
  return createRun(profile,0,weapon,'normal',seed,character);
}

test('an observed lightning investment can offer its missing frost component while retaining evolution and new skills',()=>{
  // TASK-003 seed 8, room 6, level 7: lightning was owned but frost never appeared in this expedition.
  const run=freshRun();run.room=5;run.level=7;
  Object.assign(run.upgrades,{split:2,haste:2,storm:1});
  const before=structuredClone(run),choices=upgradeChoices(run);
  assert.equal(choices[0].id,'haste');
  assert.ok(choices.some(u=>u.category==='auto'&&!run.upgrades[u.id]));
  assert.ok(choices.some(u=>u.id==='frost'));
  assert.deepEqual(choices,upgradeChoices(JSON.parse(JSON.stringify(run))));
  assert.deepEqual(run,before);
});

test('the observed one-level meteor build can continue without first learning every other automatic skill',()=>{
  // TASK-003 seed 1, room 4, level 5: only haste, orbit and power were offered.
  const run=freshRun('boomerang','keeper',1);run.room=3;run.level=5;
  Object.assign(run.upgrades,{haste:1,meteor:1,split:1});
  const choices=upgradeChoices(run);
  assert.equal(choices[0].id,'haste');
  assert.ok(choices.some(u=>u.id==='meteor'));
  assert.ok(choices.some(u=>u.category==='auto'&&!run.upgrades[u.id]));
});

test('developing a skill leaves every uncapped ability reachable for all character and weapon pairs',()=>{
  for(const character of ['keeper','scout','warden'] as const)for(const weapon of Object.keys(WEAPONS) as Weapon[]){
    const offered=new Set<UpgradeId>();
    for(let seed=1;seed<=256;seed++){
      const run=freshRun(weapon,character,seed);run.room=3;run.level=5;run.upgrades.storm=1;
      const choices=upgradeChoices(run);
      assert.equal(choices.length,3);
      assert.equal(new Set(choices.map(u=>u.id)).size,3);
      assert.ok(choices.every(u=>(run.upgrades[u.id]??0)<u.max));
      assert.ok((EVOLUTIONS[weapon].requires[choices[0].id]??0)>(run.upgrades[choices[0].id]??0));
      assert.ok(choices.some(u=>u.category==='auto'&&!run.upgrades[u.id]));
      choices.forEach(u=>offered.add(u.id));
    }
    assert.deepEqual(offered,new Set(UPGRADES.map(u=>u.id)),`${character}/${weapon} still permits all abilities`);
  }
});
