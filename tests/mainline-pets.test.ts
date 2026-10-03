import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSave, createRun, preparePetEncounter, validateSave, settle } from '../src/core.ts';
import { PETS, eligiblePets, rollPetEncounter, claimPet } from '../src/pets.ts';

test('new pets occupy only their two chapters, general rooms five and six, and actual boss rooms',()=>{
  for(const id of ['sandLizard','magmaTurtle','windFalcon','moonCat','thunderDeer','tideWhale','crimsonDragon','dawnGriffin','dawnStarDragon'] as const){
    const pet=PETS[id];
    for(let chapter=0;chapter<20;chapter++)for(let room=0;room<7;room++)for(const boss of [false,true]){
      const context={chapter,room,boss},eligible=chapter>=pet.firstChapter&&chapter<=pet.lastChapter&&(boss||room===4||room===5);
      assert.equal(eligiblePets(context,[]).includes(id),eligible);
      assert.ok(!eligiblePets(context,[id]).includes(id));
      if(eligible){
        assert.equal(rollPetEncounter(context,[],()=>boss?.5:.15).pet,null);
        assert.equal(rollPetEncounter(context,[],()=>0).pet,id);
      }
    }
  }
  for(let chapter=3;chapter<20;chapter++)assert.ok(eligiblePets({chapter,room:6,boss:true},[]).every(id=>PETS[id].firstChapter>=3));
});
test('new pet claims use the shared entrance checkpoint and remain permanent after defeat, retreat and reload',()=>{
  for(const id of ['sandLizard','magmaTurtle','windFalcon','moonCat','thunderDeer','tideWhale','crimsonDragon','dawnGriffin','dawnStarDragon'] as const){
    const s=initialSave();s.profile.cleared=PETS[id].firstChapter*2;s.run=createRun(s.profile,s.profile.cleared,'staff','normal',42);s.run.room=4;s.run.hp=53;
    s.run.petEncounter={room:4,pet:id,state:'available'};
    const next=claimPet(s,s.run.id,4,id),restored=validateSave(JSON.parse(JSON.stringify(next)));
    assert.equal(restored.run!.hp,53);assert.deepEqual(restored.run!.growth,s.run.growth);
    assert.deepEqual(preparePetEncounter(restored),restored);assert.deepEqual(claimPet(restored,s.run.id,4,id),restored);
    for(const outcome of ['defeat','retreat'] as const)assert.deepEqual(settle(restored,outcome).save.profile.ownedPets,[id]);
  }
});
