import { chromium, expect } from '@playwright/test';
import { createServer, preview } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { initialSave, createRun, preparePetEncounter, validateSave } from '../src/core.ts';
import { PET_IDS, PETS } from '../src/pets.ts';

// Coordinate 5173 or 4180 before running; both servers own their lifecycle.
const port=Number(process.argv.find(arg=>arg.startsWith('--port='))?.split('=')[1]??4180);
assert.ok([5173,4180].includes(port));
const origin=`http://127.0.0.1:${port}`,passed=[],errors=[];
await mkdir('artifacts/pets',{recursive:true});
const browser=await chromium.launch({headless:true});
async function readSave(page){return page.evaluate(()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('ember-expedition',1);request.onsuccess=()=>{const db=request.result,r=db.transaction('save','readonly').objectStore('save').get('current');r.onsuccess=()=>{resolve(r.result);db.close();};r.onerror=()=>reject(r.error);};request.onerror=()=>reject(request.error);
}));}
async function importSave(page,save){
  await page.locator('#settings').click();await page.locator('#import-file').setInputFiles({name:'pets.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});
  await page.locator('#confirm-import').click();await expect(page.locator('#confirm-import')).toHaveCount(0);
}
async function breakStorage(page){await page.evaluate(()=>{
  const original=IDBDatabase.prototype.transaction;window.restorePetStorage=()=>IDBDatabase.prototype.transaction=original;
  IDBDatabase.prototype.transaction=function(...args){const tx=original.apply(this,args);if(args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;};
});}
async function captureArena(page,path){
  await page.evaluate(()=>{const s=window.petScene;s.pause();s.game.loop.start(s.game.step.bind(s.game));});
  await page.screenshot({path});
  await page.evaluate(()=>{const s=window.petScene;s.game.loop.stop();s.resume();});
}
async function enter(page){
  await page.evaluate(async()=>{if(window.capturePetArena)return;window.capturePetArena=true;const {Arena}=await import('/src/arena.ts'),original=Arena.prototype.create;Arena.prototype.create=function(){original.call(this);window.petScene=this;};});
  await page.locator('#resume').click();await page.locator('#enter-room').click();await expect(page.locator('#timer')).not.toHaveText('—');
  await page.evaluate(()=>window.petScene.game.loop.stop());
}
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}});await server.listen();
try{
  const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await expect(page.locator('#pet-guide')).toBeVisible();
  const camp=initialSave();camp.profile.embers=1200;camp.profile.cleared=6;camp.profile.ownedPets=PET_IDS;
  await importSave(page,camp);await page.locator('#pet-guide').click();await expect(page.locator('.pet-card')).toHaveCount(PET_IDS.length);
  await expect(page.locator('#buy-pet-slot')).toHaveCount(0);
  await breakStorage(page);await page.locator('[data-pet=mossRabbit]').click();await expect(page.locator('.toast')).toContainText('存檔');assert.deepEqual((await readSave(page)).profile.equippedPets,[]);
  await page.evaluate(()=>window.restorePetStorage());await page.locator('[data-pet=mossRabbit]').click();await expect.poll(async()=>(await readSave(page)).profile.equippedPets).toEqual(['mossRabbit']);
  await page.locator('[data-pet="emberFox"]').click();await expect.poll(async()=>(await readSave(page)).profile.equippedPets).toEqual(['emberFox']);
  await expect(page.locator('[data-pet="starDrake"]')).toBeEnabled();assert.equal((await readSave(page)).profile.embers,1200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'artifacts/pets/collection-320.png'});await page.locator('#close-pets').click();await page.reload();await expect(page.locator('.pet-team')).toContainText('1/1');
  passed.push('320px collection persists one selected pet; selecting another replaces it, purchases are absent and failed saves preserve the previous team.');
  const fixture=initialSave();fixture.profile.cleared=6;fixture.run=createRun(fixture.profile,2,'staff','normal',42);fixture.run.room=4;fixture.run.hp=43;fixture.run.xp=17;fixture.run.petEncounter={room:4,pet:'mossRabbit',state:'available'};
  await importSave(page,fixture);await page.locator('#pet-guide').click();await expect(page.locator('#buy-pet-slot')).toHaveCount(0);await expect(page.locator('[data-pet=mossRabbit]')).toBeDisabled();await page.locator('#close-pets').click();
  await enter(page);await page.evaluate(()=>{const s=window.petScene;s.hero.setPosition(195,330);s.tameStep(1);});
  for(const mode of ['pause','upgrade','background']){
    if(mode==='pause')await page.locator('#pause').click();
    else if(mode==='upgrade')await page.evaluate(async()=>{const {experienceForLevel}=await import('/src/core.ts');const s=window.petScene;s.run.xp=experienceForLevel(s.run.level);s.update(0,50);});
    else await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await expect(page.locator('.modal-backdrop')).toBeVisible();
    assert.equal(await page.evaluate(()=>{const s=window.petScene,before=s.tameSeconds;for(let i=0;i<40;i++)s.update(i*50,50);return s.tameSeconds===before;}),true,mode+' freezes taming');
    if(mode==='upgrade')await page.locator('[data-upgrade]').first().click();else await page.locator('#continue').click();
    if(mode==='background')await page.evaluate(()=>{delete document.hidden;});
  }
  await page.locator('#pause').click();await page.locator('#checkpoint').click();assert.deepEqual(await readSave(page),fixture);
  passed.push('Pause button, upgrade modal and hidden-document event freeze taming without saving partial progress.');
  await enter(page);await breakStorage(page);
  await page.evaluate(()=>{const s=window.petScene;s.run.hp=17;s.run.kills+=5;s.run.xp=80;s.run.upgrades.power=1;s.hero.setPosition(195,330);s.tameStep(8);});
  await expect(page.locator('#retry-save')).toBeVisible();await expect(page.locator('body')).not.toContainText('永久收藏：');assert.deepEqual(await readSave(page),fixture);
  assert.equal(await page.evaluate(()=>window.petScene.run.pets.length),0);
  await page.locator('#retry-save').click();await expect(page.locator('#retry-save')).toBeVisible();assert.deepEqual(await readSave(page),fixture);
  await page.evaluate(()=>window.restorePetStorage());await page.locator('#retry-save').dblclick();await expect(page.locator('.toast')).toContainText('永久收藏：苔光兔');
  const saved=await readSave(page);assert.deepEqual(saved.profile.ownedPets,['mossRabbit']);assert.deepEqual(saved.run,{...fixture.run,pets:['mossRabbit'],petEncounter:{room:4,pet:'mossRabbit',state:'tamed'}});
  assert.deepEqual(await page.evaluate(()=>({hp:window.petScene.run.hp,kills:window.petScene.run.kills,xp:window.petScene.run.xp,power:window.petScene.run.upgrades.power,pets:window.petScene.run.pets})),{hp:17,kills:5,xp:80,power:1,pets:['mossRabbit']});
  await page.reload();assert.deepEqual(await readSave(page),saved);await enter(page);assert.equal(await page.evaluate(()=>!!window.petScene.wildPet),false);
  await page.locator('#pause').click();await page.locator('#pause-retreat').click();await page.locator('#confirm-retreat').click();await expect(page.locator('#home')).toBeVisible();assert.deepEqual((await readSave(page)).profile.ownedPets,['mossRabbit']);await page.locator('#home').click();
  passed.push('Taming aborts twice without success or collection; successful retry atomically saves pet fields, preserves entrance HP/XP/abilities, joins live party and survives reload/retreat.');
  await importSave(page,saved);await enter(page);await page.evaluate(()=>{const s=window.petScene;s.hitTimer=0;s.run.hp=1;s.hurt(1000);});await expect(page.locator('#home')).toBeVisible();assert.deepEqual((await readSave(page)).profile.ownedPets,['mossRabbit']);await page.locator('#home').click();
  passed.push('Death settlement retains the persisted collection.');
  const empty=structuredClone(fixture);empty.run.petEncounter=null;await importSave(page,empty);await page.locator('#resume').click();await breakStorage(page);await page.locator('#enter-room').click();await expect(page.locator('#retry-save')).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);assert.deepEqual(await readSave(page),empty);
  await page.evaluate(()=>window.restorePetStorage());await page.locator('#retry-save').click();await expect(page.locator('#timer')).not.toHaveText('—');const drawn=await readSave(page);assert.deepEqual(drawn,preparePetEncounter(empty));
  await page.reload();await enter(page);assert.deepEqual(await readSave(page),drawn);await page.locator('#pause').click();await page.locator('#checkpoint').click();
  passed.push('Room entry waits for encounter persistence; retry/reload uses exactly the saved encounter.');
  for(const leave of [true,false]){
    await importSave(page,fixture);await enter(page);
    await page.evaluate(()=>{const s=window.petScene;s.changePhase('loot');s.update(0,50);});await expect(page.locator('#leave-pet')).toBeVisible();await expect(page.locator('#game-phase')).toContainText('可繼續馴服');
    await expect(page.locator('.toast')).toHaveCount(0,{timeout:6000});await expect(page.locator('#pet-status')).toContainText('苔光兔');await captureArena(page,`artifacts/pets/taming-${leave}-320.png`);
    if(leave)await page.locator('#leave-pet').dblclick();else{await page.evaluate(()=>{const s=window.petScene;s.hero.setPosition(195,330);s.tameStep(8);});await expect(page.locator('.toast')).toContainText('永久收藏：');}
    await page.evaluate(()=>{const s=window.petScene;for(let i=0;i<60;i++)s.update(i*50,50);});await expect(page.locator('#next-room')).toBeVisible();const completed=await readSave(page);assert.equal(completed.run.room,5);assert.equal(completed.run.embers,32);assert.equal(completed.profile.ownedPets.length,leave?0:1);
    await page.locator('#room-camp').click();
  }
  passed.push('Clear-room UI allows either movement-based taming or leaving, then grants room rewards exactly once.');
  const three=structuredClone(saved);three.profile.ownedPets=PET_IDS;three.profile.petSlots=3;three.profile.equippedPets=PET_IDS.slice(0,3);three.run.pets=PET_IDS.slice(0,3);
  await importSave(page,three);assert.deepEqual(await readSave(page),validateSave(three));await enter(page);assert.equal(await page.evaluate(()=>window.petScene.petParty.companions.length),1);await expect(page.locator('.toast')).toHaveCount(0,{timeout:6000});await captureArena(page,'artifacts/pets/single-battle-320.png');await page.locator('#pause').click();await page.locator('#checkpoint').click();
  await page.locator('#settings').click();const dl=page.waitForEvent('download');await page.locator('#export').click();const stream=await (await dl).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()),validateSave(three));await page.locator('#close').click();
  passed.push('Legacy three-pet import and backup export retain the first companion, the collection and a one-time slot refund.');
  await context.close();
}finally{await server.close();}
const production=await preview({preview:{host:'127.0.0.1',port,strictPort:true}});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await expect(page.locator('#offline')).toContainText('已可離線遊玩',{timeout:45000});
  const s=initialSave();s.profile.cleared=6;s.profile.ownedPets=PET_IDS;s.profile.petSlots=1;s.profile.equippedPets=PET_IDS.slice(0,1);s.run=createRun(s.profile,2,'staff','normal',42);s.run.petEncounter={room:0,pet:null,state:'none'};await importSave(page,s);
  await context.setOffline(true);await page.close();page=await context.newPage();await page.goto(origin);await expect(page.locator('#offline')).toContainText('已可離線遊玩');assert.deepEqual(await readSave(page),s);
  for(const id of PET_IDS)assert.deepEqual(await page.evaluate(async path=>{const im=new Image();im.src=path;await im.decode();return [im.naturalWidth,im.naturalHeight];},PETS[id].spritePath),[128,128]);
  await page.locator('#resume').click();await page.locator('#enter-room').click();await expect(page.locator('#timer')).not.toHaveText('—');await page.screenshot({path:'artifacts/pets/offline-single-390.png'});
  passed.push(`Production cold offline page retains the collection/team and decodes all ${PET_IDS.length} local sprites before single-pet combat.`);await context.close();
}finally{await browser.close();await new Promise(resolve=>production.httpServer.close(resolve));}
await writeFile('artifacts/pets/browser-report.json',JSON.stringify({passed,errors,limitations:['Chromium phone emulation, not iPhone or Android hardware.']},null,2));assert.deepEqual(errors,[]);console.log(passed.join('\n'));
