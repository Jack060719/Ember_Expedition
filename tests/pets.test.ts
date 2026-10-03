import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialSave, createRun, finishRoom, preparePetEncounter, validateSave, settle, rng } from '../src/core.ts';
import { PETS, PET_IDS, eligiblePets, rollPetEncounter, tameProgress, equipPets, claimPet } from '../src/pets.ts';

const encounterSave=()=>{
  const s=initialSave();s.profile.cleared=6;s.run=createRun(s.profile,5,'staff','normal',42);s.run.room=6;
  s.run.hp=43;s.run.xp=19;s.run.petEncounter={room:6,pet:'mossRabbit',state:'available'};return s;
};
test('pet areas, owned exclusions, equal candidate draws and probability boundaries are explicit',()=>{
  for(let chapter=0;chapter<3;chapter++)for(let room=0;room<7;room++){
    const pool=eligiblePets({chapter,room,boss:false},[]);
    assert.equal(pool.length>0,chapter>=1&&chapter<=2&&room>=4);
    assert.ok(!pool.includes('starDrake'));
  }
  assert.deepEqual(eligiblePets({chapter:0,room:6,boss:true},[]),['mossRabbit','emberFox']);
  assert.deepEqual(eligiblePets({chapter:1,room:6,boss:true},[]),PET_IDS.slice(0,3));
  assert.deepEqual(eligiblePets({chapter:2,room:6,boss:true},[]),PET_IDS.slice(0,5));
  assert.deepEqual(eligiblePets({chapter:2,room:6,boss:true},PET_IDS),[]);
  for(const boss of [false,true]){
    const room={chapter:2,room:6,boss},chance=boss?.5:.15,pool=eligiblePets(room,[]);
    assert.equal(rollPetEncounter(room,[],()=>chance).state,'none');
    pool.forEach((id,i)=>{const draws=[chance-.0001,(i+.5)/pool.length];assert.equal(rollPetEncounter(room,[],()=>draws.shift()!).pet,id);});
    const random=rng(1234);let count=0;for(let i=0;i<10000;i++)if(rollPetEncounter(room,[],random).pet)count++;
    assert.ok(Math.abs(count/10000-chance)<.02);
  }
});
test('taming takes each specified duration and reverses at half speed with a zero floor',()=>{
  assert.deepEqual(PET_IDS.slice(0,5).map(id=>PETS[id].tameSeconds),[8,12,18,24,30]);
  for(const id of PET_IDS){const limit=PETS[id].tameSeconds;assert.equal(tameProgress(0,true,limit,limit),limit);assert.equal(tameProgress(limit,false,2,limit),limit-1);assert.equal(tameProgress(1,false,8,limit),0);assert.equal(tameProgress(3,true,0,limit),3);}
});
test('encounters survive reload without reroll and next rooms get one independent draw',()=>{
  const s=encounterSave();s.run!.petEncounter=null;
  const first=preparePetEncounter(s);assert.deepEqual(preparePetEncounter(validateSave(first)),first);
  first.profile.ownedPets=[...PET_IDS];assert.deepEqual(preparePetEncounter(first).run!.petEncounter,first.run!.petEncounter);
  const next=finishRoom(s.run!);assert.equal(next.petEncounter,null);
  assert.equal(s.run!.petEncounter,null);
});
test('claim changes only pet fields of the room entrance and is idempotent after save',()=>{
  const s=encounterSave(),before=structuredClone(s),claimed=claimPet(s,s.run!.id,6,'mossRabbit');
  assert.deepEqual(s,before);assert.deepEqual(claimed.profile.ownedPets,['mossRabbit']);assert.deepEqual(claimed.run!.pets,['mossRabbit']);
  assert.deepEqual(claimed.run,{...s.run,pets:['mossRabbit'],petEncounter:{room:6,pet:'mossRabbit',state:'tamed'}});
  assert.deepEqual(claimPet(claimed,s.run!.id,6,'mossRabbit'),claimed);
  for(const outcome of ['defeat','retreat'] as const)assert.deepEqual(settle(validateSave(claimed),outcome).save.profile.ownedPets,['mossRabbit']);
  assert.throws(()=>claimPet(s,'another-run',6,'mossRabbit'));assert.throws(()=>claimPet(s,s.run!.id,5,'mossRabbit'));
  s.profile.ownedPets=['emberFox'];s.profile.equippedPets=['emberFox'];s.run!.pets=['emberFox'];
  s.profile.petSlots=3;
  const full=claimPet(s,s.run!.id,6,'mossRabbit');assert.deepEqual(full.run!.pets,['emberFox']);assert.deepEqual(full.profile.ownedPets,['emberFox','mossRabbit']);
  s.profile.equippedPets=[];
  assert.deepEqual(claimPet(s,s.run!.id,6,'mossRabbit').profile.equippedPets,[],'A full active team only collects, even when the next expedition preference differs');
});
test('only one owned pet can be equipped, selecting another replaces it and swaps lock during runs',()=>{
  let s=initialSave();s.profile.embers=1200;s.profile.ownedPets=[...PET_IDS];
  s=equipPets(s,['mossRabbit']);s=equipPets(s,['emberFox']);assert.deepEqual(s.profile.equippedPets,['emberFox']);
  assert.equal(s.profile.embers,1200);assert.equal(s.profile.petSlots,1);
  assert.throws(()=>equipPets(s,['mossRabbit','emberFox']));assert.throws(()=>equipPets(s,['mossRabbit','mossRabbit']));
  assert.throws(()=>equipPets(initialSave(),['mossRabbit']));
  assert.deepEqual(equipPets(s,[]).profile.equippedPets,[]);
  s.profile.petSlots=3;assert.throws(()=>equipPets(s,['mossRabbit','emberFox']));
  s.profile.equippedPets=PET_IDS.slice(0,3);s.run=createRun(s.profile,0,'staff','normal',1);assert.deepEqual(s.run.pets,['mossRabbit']);
  assert.throws(()=>equipPets(s,[]));
});
test('v1 v2 v3 migrate without healing, granting abilities, recalculating v2/v3 growth or drawing the current room',()=>{
  for(const version of [1,2,3]){
    const old=JSON.parse(readFileSync(new URL(`./fixtures/save-v${version}.json`,import.meta.url),'utf8')),before=structuredClone(old);
    const s=validateSave(old),r=s.run!;
    assert.equal(s.version,5);assert.deepEqual(s.profile,{...old.profile,ownedPets:[],petSlots:1,equippedPets:[]});
    for(const key of ['hp','maxHp','upgrades','xp','kills','embers','level','elapsed','secondWindUsed'])assert.deepEqual(r[key],old.run[key]);
    if(version>=2)assert.deepEqual(r.growth,old.run.growth);
    if(version===3){assert.equal(r.character,'warden');assert.equal(s.settings.preferredCharacter,'scout');}
    assert.deepEqual(preparePetEncounter(s),s);assert.deepEqual(validateSave(s),s);assert.deepEqual(old,before);
  }
});
test('v4 rejects missing, unknown, duplicate, over-capacity and inconsistent pet data without mutation',()=>{
  const s=encounterSave(),valid=claimPet(s,s.run!.id,6,'mossRabbit');
  for(const mutate of [s=>delete s.profile.ownedPets,s=>s.profile.ownedPets=['unknown'],s=>s.profile.petSlots=4,s=>s.profile.petSlots=1.5,s=>s.profile.equippedPets=['emberFox'],s=>s.run.pets=['mossRabbit','mossRabbit'],s=>delete s.run.petEncounter,s=>s.run.petEncounter.room=5,s=>s.run.petEncounter.state='available',s=>s.run.petEncounter.pet='unknown',s=>s.run.petEncounter={room:6,pet:'mossRabbit',state:'none'}]){
    const bad=structuredClone(valid);mutate(bad);const before=structuredClone(bad);assert.throws(()=>validateSave(bad));assert.deepEqual(bad,before);
  }
});


test('v4 and v5 multi-pet saves retain each first pet, collection and combat progress and refund slots once',()=>{
  for(const version of [4,5])for(const slots of [1,2,3])for(const active of [false,true]){
    const old=encounterSave();old.version=version as 5;old.profile.embers=75;old.profile.petSlots=slots;
    old.profile.ownedPets=[...PET_IDS];old.profile.equippedPets=['emberFox','frostOwl','thunderLeopard'].slice(0,slots) as typeof old.profile.equippedPets;
    old.run!.pets=['starDrake','mossRabbit','emberFox'].slice(0,slots) as typeof old.profile.equippedPets;
    old.run!.petEncounter={room:6,pet:null,state:'none'};if(!active)old.run=null;
    const before=structuredClone(old),expected=structuredClone(old);expected.version=5;
    expected.profile.embers+=slots===3?1200:slots===2?300:0;expected.profile.petSlots=1;expected.profile.equippedPets=['emberFox'];if(expected.run)expected.run.pets=['starDrake'];
    const migrated=validateSave(old);assert.deepEqual(migrated,expected);assert.deepEqual(old,before);
    assert.deepEqual(validateSave(JSON.parse(JSON.stringify(migrated))),migrated);
  }
});
test('empty legacy teams remain empty and slot refunds respect the save currency ceiling',()=>{
  const old=initialSave();old.profile.petSlots=3;old.profile.embers=1e9-100;
  const migrated=validateSave(old);assert.equal(migrated.profile.embers,1e9);assert.deepEqual(migrated.profile.equippedPets,[]);
  assert.deepEqual(validateSave(migrated),migrated);
});
test('invalid pets beyond the retained first entry still reject rather than being silently discarded',()=>{
  const old=initialSave();old.profile.petSlots=3;old.profile.ownedPets=[...PET_IDS];
  for(const team of [['mossRabbit','mossRabbit'],['mossRabbit','unknown']]){
    old.profile.equippedPets=team as typeof old.profile.equippedPets;const before=structuredClone(old);
    assert.throws(()=>validateSave(old));assert.deepEqual(old,before);
  }
});
