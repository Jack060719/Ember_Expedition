import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSave, createRun, validateSave, applyUpgrade, isEvolved, type CharacterId } from '../src/core.ts';
import { availableWeapons, EVOLUTIONS, weaponDamage, skillDamage, weaponRange, weaponCooldown, type Weapon } from '../src/weapons.ts';

function runFor(weapon:Weapon,character:CharacterId='keeper'){
  const save=initialSave();save.profile.cleared=2;save.profile.facilities.forge=4;
  save.run=createRun(save.profile,0,weapon,'normal',42,character);
  return save;
}

test('new weapons unlock at forge three and four after the original ordered weapons',()=>{
  const {profile}=initialSave();
  const ids=['staff','blade','halo','boomerang','hammer'];
  for(let forge=0;forge<=5;forge++){
    profile.facilities.forge=forge;
    assert.deepEqual(availableWeapons(profile),ids.slice(0,Math.min(forge+1,5)));
  }
  profile.facilities.forge=2;
  assert.throws(()=>createRun(profile,0,'boomerang','normal',1));
  profile.facilities.forge=3;
  assert.throws(()=>createRun(profile,0,'hammer','normal',1));
});

test('all three characters can save and restore either new weapon with only their own starting grant',()=>{
  for(const character of ['keeper','scout','warden'] as const)for(const weapon of ['boomerang','hammer'] as const){
    const save=runFor(weapon,character),restored=validateSave(JSON.parse(JSON.stringify(save)));
    assert.deepEqual(restored,save);
    assert.equal(restored.run!.weapon,weapon);assert.equal(restored.run!.character,character);
    assert.deepEqual(restored.run!.upgrades,character==='keeper'?{vitality:1}:character==='scout'?{stride:1}:{ward:1});
  }
});

test('old evolution recipes remain exact and each new recipe needs all five earned levels',()=>{
  assert.deepEqual(EVOLUTIONS.staff.requires,{power:3,pierce:2});
  assert.deepEqual(EVOLUTIONS.blade.requires,{power:3,reach:2});
  assert.deepEqual(EVOLUTIONS.halo.requires,{orbit:2,haste:2});
  for(const [weapon,picks] of [
    ['boomerang',['split','split','haste','haste','haste']],
    ['hammer',['power','power','power','reach','reach']],
  ] as const){
    const run=runFor(weapon).run!;
    for(const id of picks){assert.equal(isEvolved(run),false);applyUpgrade(run,id);}
    assert.equal(isEvolved(run),true);
    const save=runFor(weapon);save.run=run;
    assert.equal(isEvolved(validateSave(JSON.parse(JSON.stringify(save))).run!),true);
  }
});

test('hammer pierce affects primary damage but neither new weapon changes automatic-skill damage',()=>{
  for(const weapon of ['boomerang','hammer'] as const){
    const run=runFor(weapon).run!;run.upgrades={power:2,pierce:3};
    assert.equal(skillDamage(run),18*1.32*1.4);
    assert.equal(weaponDamage(run),(weapon==='hammer'?48:18)*1.32*(1.4+(weapon==='hammer'?.45:0)));
  }
  for(const weapon of ['staff','blade','halo'] as const){
    const run=runFor(weapon).run!;run.upgrades={power:2,pierce:3};
    const expected=(weapon==='blade'?30:18)*1.32*(1.4+(weapon==='staff'?0:.45));
    assert.equal(weaponDamage(run),expected);assert.equal(skillDamage(run),expected);
  }
});

test('reach and haste scale new weapon targeting and cadence without changing legacy timing',()=>{
  for(const [weapon,range,cooldown] of [
    ['staff',330,.5],['blade',110,.5],['halo',95,.55],['boomerang',220,.8],['hammer',180,.9],
  ] as const){
    const run=runFor(weapon).run!;run.upgrades={reach:3,haste:4};
    assert.equal(weaponRange(run,false),range*1.54);
    assert.equal(weaponRange(run,true),range*1.54*(weapon==='halo'?1.3:1));
    assert.equal(weaponCooldown(run),cooldown*.52);
  }
});
