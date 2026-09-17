import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSave, createRun, settle, finishRoom, buyFacility, availableWeapons, upgradeChoices, applyUpgrade, validateSave, encounter, PUZZLE_SOLUTIONS, puzzleInitial, puzzleHint, toggleTile, UPGRADES } from '../src/core.ts';

test('nine distinct rune puzzles are solvable, including incremental hints',()=>{
  const boards=PUZZLE_SOLUTIONS.map((_,i)=>puzzleInitial(i));
  assert.equal(new Set(boards).size,9);
  boards.forEach((board,i)=>{
    assert.equal(PUZZLE_SOLUTIONS[i].reduce(toggleTile,board),511);
    let state=board;
    for(let step=0;step<10&&state!==511;step++){const hint=puzzleHint(state);assert.ok(hint>=0);state=toggleTile(state,hint);}
    assert.equal(state,511);
  });
});
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
  const s=initialSave();s.run=createRun(s.profile,0,'staff','normal',1);s.run.room=8;s.run.embers=100;
  const once=settle(s,'victory').save;
  const restored=validateSave(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(settle(restored,'victory').save,once);
  assert.equal(once.profile.embers,145);assert.equal(once.profile.cleared,1);
});
test('six victories unlock the story in order; hard replays do not skip chapters',()=>{
  let s=initialSave();
  assert.throws(()=>createRun(s.profile,1,'staff','normal',4));
  assert.throws(()=>createRun(s.profile,0,'staff','hard',4));
  for(let i=0;i<6;i++){s.run=createRun(s.profile,i,'staff','normal',i);s.run.room=8;s=settle(s,'victory').save;assert.equal(s.profile.cleared,i+1);}
  s.run=createRun(s.profile,0,'staff','hard',15);s.run.room=8;s=settle(s,'victory').save;
  assert.equal(s.profile.cleared,6);assert.equal(s.profile.bestHard,1);
});
test('camp purchases spend exactly once and weapon unlocks gate new runs',()=>{
  let s=initialSave();assert.throws(()=>buyFacility(s,'forge'));assert.throws(()=>createRun(s.profile,0,'blade','normal',1));
  s.profile.embers=300;s=buyFacility(s,'forge');assert.equal(s.profile.embers,230);assert.deepEqual(availableWeapons(s.profile),['staff','blade']);
  s=buyFacility(s,'forge');assert.equal(s.profile.embers,95);assert.deepEqual(availableWeapons(s.profile),['staff','blade','halo']);
  s.run=createRun(s.profile,0,'blade','normal',1);assert.throws(()=>buyFacility(s,'beacon'));
});
test('room completion preserves the checkpoint input, puzzle skip gives no reward',()=>{
  const r=createRun(initialSave().profile,0,'staff','normal',18);r.room=3;
  const solved=finishRoom(r),skipped=finishRoom(r,true);
  assert.equal(solved.room,4);assert.equal(solved.embers,22);assert.equal(skipped.embers,0);assert.equal(r.room,3);assert.equal(r.embers,0);
});
test('upgrade choices are deterministic, unique and exclude maxed abilities',()=>{
  const r=createRun(initialSave().profile,0,'staff','normal',99);
  assert.deepEqual(upgradeChoices(r),upgradeChoices(r));assert.equal(new Set(upgradeChoices(r).map(u=>u.id)).size,3);
  for(const u of UPGRADES)r.upgrades[u.id]=u.max;
  assert.deepEqual(upgradeChoices(r),[]);assert.throws(()=>applyUpgrade(r,'power'));
});
test('encounter order varies by expedition while restored seeds keep the same route',()=>{
  const order=seed=>{const r=createRun(initialSave().profile,0,'staff','normal',seed);return [1,2,4,5,6].map(room=>{r.room=room;return encounter(r).name;});};
  assert.deepEqual(order(1),order(1));assert.notDeepEqual(order(1),order(8));assert.equal(new Set(order(1)).size,5);
});
test('import rejects malformed, non-finite, locked and future saves',()=>{
  const base=initialSave();assert.deepEqual(validateSave(base),base);
  for(const bad of [null,{}, {...base,version:2},{...base,profile:{...base.profile,embers:-1}},{...base,profile:{...base.profile,cleared:7}}])assert.throws(()=>validateSave(bad));
  base.run=createRun(base.profile,0,'staff','normal',123);
  const valid=JSON.parse(JSON.stringify(base));assert.deepEqual(validateSave(valid),base);
  base.run.hp=NaN;assert.throws(()=>validateSave(base));
  base.run.hp=50;base.run.weapon='halo';assert.throws(()=>validateSave(base));
  base.run.weapon='staff';base.run.puzzle={mask:512,moves:0};assert.throws(()=>validateSave(base));
});
