import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { CHAPTERS, MISSIONS, initialSave, createRun, validateSave, settle } from '../src/core.ts';
import { PET_IDS, PETS } from '../src/pets.ts';

const port=Number(process.argv.find(a=>a.startsWith('--port='))?.split('=')[1]??4180);
assert.ok([5173,4180].includes(port));
const server=await preview({preview:{host:'127.0.0.1',port,strictPort:true}}),origin=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
let page=await context.newPage();const errors=[],passed=[];page.on('pageerror',e=>errors.push(e.message));
const readSave=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('ember-expedition',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('save','readonly').objectStore('save').get('current');q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};}));
async function importSave(save){await page.locator('#settings').click();await page.locator('#import-file').setInputFiles({name:'mainline.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await expect(page.locator('.story-copy')).toContainText(`${save.profile.cleared}/${MISSIONS.length}`);await page.locator('#confirm-import').click();await expect(page.locator('#confirm-import')).toHaveCount(0);}
try{
  await page.goto(origin);await expect(page.locator('#offline')).toContainText('已可離線遊玩',{timeout:45000});
  const legacy=JSON.parse(await readFile('tests/fixtures/save-v4.json','utf8'));await importSave(legacy);
  assert.deepEqual(await readSave(),validateSave(legacy));
  await page.locator('#settings').click();const downloading=page.waitForEvent('download');await page.locator('#export').click();
  const stream=await (await downloading).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()),validateSave(legacy));await page.locator('#close').click();
  passed.push('Actual v4 checkpoint import/export preserves all combat, growth and pet fields through v5.');
  for(const mission of [6,MISSIONS.length-1]){
  const ended=initialSave();ended.profile.cleared=mission;ended.run=createRun(ended.profile,mission,'staff','normal',42);ended.run.room=7;ended.run.embers=100;
  await importSave(ended);await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;window.restoreMainlineStorage=()=>IDBDatabase.prototype.transaction=original;IDBDatabase.prototype.transaction=function(...args){const tx=original.apply(this,args);if(args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;};});
  await page.locator('#resume').click();await expect(page.locator('#retry-save')).toBeVisible();assert.deepEqual(await readSave(),ended);
  await page.evaluate(()=>window.restoreMainlineStorage());await page.locator('#retry-save').click();await expect(page.locator('#home')).toBeVisible();
  assert.deepEqual(await readSave(),settle(ended,'victory').save);await page.locator('#home').click();await page.reload();assert.deepEqual(await readSave(),settle(ended,'victory').save);
  passed.push(`Mission ${mission+1} first-clear survives real IndexedDB abort/retry and reload without duplication.`);
  }
  const camp=initialSave();camp.profile.cleared=MISSIONS.length;const cap=CHAPTERS.length<=7?30:CHAPTERS.length<=11?40:CHAPTERS.length<=15?50:60;camp.profile.facilities={forge:cap,beacon:cap,archive:20};camp.profile.petSlots=1;camp.profile.ownedPets=PET_IDS;camp.profile.equippedPets=PET_IDS.slice(-1);
  await importSave(camp);await expect(page.locator('.mission-card')).toContainText(CHAPTERS.at(-1).name);
  await page.reload();await expect(page.locator('.mission-card')).toContainText(CHAPTERS.at(-1).name);
  await page.locator('#chapters').click();assert.equal(await page.locator('.chapter-group').count(),CHAPTERS.length);
  if(await page.locator('.chapter-group').last().getAttribute('open')===null)await page.locator('.chapter-group').last().locator('summary').click();
  await expect(page.locator(`[data-mission="${MISSIONS.length-1}"]`)).toBeEnabled();
  await page.locator(`[data-mission="${MISSIONS.length-1}"]`).click();await expect(page.locator('.mission-card')).toContainText(CHAPTERS.at(-1).name);
  assert.equal(await page.locator(`[data-mission="${MISSIONS.length}"]`).count(),0);
  for(const width of [320,390]){await page.setViewportSize({width,height:844});await page.locator('#chapters').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#close').click();}
  passed.push('Unlocked last mission and narrow chapter list remain usable without creating a nonexistent next mission.');
  await context.setOffline(true);
  for(let chapter=3;chapter<CHAPTERS.length;chapter++){
    const s=structuredClone(camp);s.run=createRun(s.profile,chapter*2+1,'staff','normal',42);s.run.room=6;s.run.petEncounter={room:6,pet:null,state:'none'};
    await importSave(s);await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.locator('#resume').click();await page.locator('#enter-room').click();
    await expect(page.locator('#boss-track')).toBeVisible();await expect(page.locator('canvas')).toBeVisible();await page.locator('#pause').click();
    await mkdir('artifacts/mainline',{recursive:true});
    await page.locator('.modal-backdrop').evaluate(e=>e.style.visibility='hidden');
    await page.screenshot({path:`artifacts/mainline/offline-chapter-${chapter+1}.png`});
    await page.locator('.modal-backdrop').evaluate(e=>e.style.visibility='');
    const assets=[`/assets/${CHAPTERS[chapter].asset}.jpg`,`/assets/enemies-mainline-${Math.min(4,1+Math.floor((chapter-3)/4))}.png`,...s.run.pets.map(id=>PETS[id].spritePath)];
    assert.ok(await page.evaluate(async assets=>(await Promise.all(assets.map(async url=>{const r=await fetch(url);const b=await createImageBitmap(await r.blob());return r.ok&&b.width>0;}))).every(Boolean),assets));
    await page.locator('#checkpoint').click();assert.deepEqual(await readSave(),s);
  }
  passed.push('Every new chapter boss, ground, enemy atlas and latest single-pet party cold-start offline with the saved entrance unchanged.');
  assert.deepEqual(errors,[]);await writeFile('artifacts/mainline/browser.json',JSON.stringify({passed,errors,limitations:['Chromium phone emulation; real iPhone/Android input and thermal testing remain separate.']},null,2));console.log(passed.join('\n'));
}finally{await context.close();await browser.close();await new Promise(r=>server.httpServer.close(r));}
