import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { initialSave, createRun, CHARACTERS, UPGRADES, experienceForLevel } from '../src/core.ts';
import { AUTO_UPGRADES, upgradeDescription } from '../src/upgrades.ts';

// Use --port=4180 after coordinating when 4173 belongs to another project.
const port=Number(process.argv.find(arg=>arg.startsWith('--port='))?.split('=')[1]??4173);
assert.ok([4173,4180].includes(port),'Reserve either 4173 or 4180 before running this check.');
const origin=`http://127.0.0.1:${port}`;
const server=await preview({preview:{host:'127.0.0.1',port,strictPort:true}});
try{
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
let page=await context.newPage();
const errors=[],passed=[];
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
watch(page);
async function readSave(){return page.evaluate(()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('ember-expedition',1);
  request.onsuccess=()=>{const db=request.result,get=db.transaction('save','readonly').objectStore('save').get('current');get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=()=>reject(get.error);};
  request.onerror=()=>reject(request.error);
}));}
async function importSave(save){
  await page.locator('#settings').click();
  await page.locator('#import-file').setInputFiles({name:'characters.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});
  await page.locator('#confirm-import').click();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
}
async function noOverflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
try{
  await mkdir('artifacts/characters',{recursive:true});
  await page.goto(origin);
  await expect(page.locator('#offline')).toContainText('已可離線遊玩',{timeout:45000});
  await expect(page.locator('[data-character]')).toHaveCount(3);
  await page.locator('[data-character="warden"]').click();
  await expect(page.locator('#select-character')).toBeDisabled();
  await expect(page.locator('.modal')).toContainText('喚醒第一盞燈');
  await noOverflow();await page.screenshot({path:'artifacts/characters/locked-320.png'});
  await page.locator('#close-character').click();
  passed.push('Locked characters can be previewed at 320px but cannot be selected.');

  const camp=initialSave();camp.profile.cleared=2;camp.profile.facilities={forge:20,beacon:2,archive:3};
  await importSave(camp);
  await page.locator('[data-character="warden"]').click();
  await expect(page.locator('#character-starting')).toContainText('護燈者 Lv. 2');
  await expect(page.locator('#character-starting')).toContainText('受到的傷害減少 24%');
  await page.evaluate(()=>{
    const transaction=IDBDatabase.prototype.transaction;
    window.restoreCharacterStorage=()=>{IDBDatabase.prototype.transaction=transaction;};
    IDBDatabase.prototype.transaction=function(...args){if(args[1]==='readwrite')throw new Error('角色偏好寫入測試失敗');return transaction.apply(this,args);};
  });
  await page.locator('#select-character').click();
  await expect(page.locator('.toast')).toContainText('角色偏好寫入測試失敗');
  assert.equal((await readSave()).settings.preferredCharacter,'keeper');
  await page.evaluate(()=>{window.restoreCharacterStorage();delete window.restoreCharacterStorage;});
  await page.locator('#select-character').click();
  await expect.poll(async()=>(await readSave()).settings.preferredCharacter).toBe('warden');
  await page.reload();await expect(page.locator('[data-character="warden"]')).toHaveClass(/selected/);
  await page.locator('[data-character="scout"]').click();await page.locator('#select-character').click();
  await page.locator('[data-weapon="blade"]').click();
  await noOverflow();await page.screenshot({path:'artifacts/characters/camp-320.png',fullPage:true});
  const size=await page.locator('[data-character="scout"]').boundingBox();assert.ok(size.height>=44);
  await page.locator('#journey').click();await page.locator('#begin').click();
  const started=await readSave();
  assert.equal(started.run.character,'scout');assert.equal(started.run.weapon,'blade');assert.equal(started.run.upgrades.stride,1);
  passed.push('Selection persists separately from the freely chosen weapon; archive overlap is visible before departure.');

  await page.locator('#back-camp').click();
  const checkpoint=structuredClone(started);checkpoint.settings.preferredCharacter='warden';checkpoint.run.hp=43;
  await importSave(checkpoint);
  await expect(page.locator('.mission-card')).toContainText('逐風斥候');
  await expect(page.locator('[data-character]')).toHaveCount(0);
  await page.locator('#resume').click();await expect(page.locator('.run-character')).toContainText('逐風斥候');
  await page.locator('#enter-room').click();await expect(page.locator('#timer')).not.toHaveText('—');
  await page.locator('#pause').click();await expect(page.locator('.modal')).toContainText('逐風斥候');
  const hp=await page.locator('#health-label').textContent();
  await page.waitForTimeout(300);assert.equal(await page.locator('#health-label').textContent(),hp);
  await page.locator('#continue').click();await page.locator('#pause').click();await page.locator('#checkpoint').click();
  await page.reload();assert.deepEqual(await readSave(),checkpoint);
  passed.push('Pause, return to camp and reload retain the actual run character and entry health without adding gifts.');

  await page.locator('#settings').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();
  const download=await downloadPromise;const stream=await download.createReadStream();const chunks=[];
  for await(const chunk of stream)chunks.push(chunk);
  assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()),checkpoint);
  await page.locator('#close').click();
  await importSave(checkpoint);assert.deepEqual(await readSave(),checkpoint);
  await page.locator('#settings').click();
  const invalid=structuredClone(checkpoint);invalid.run.character='unknown';
  await page.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
  await expect(page.locator('.toast')).toContainText('格式或版本');assert.deepEqual(await readSave(),checkpoint);
  await page.locator('#close').click();
  passed.push('Export/import preserves differing run and preferred characters; invalid import preserves the existing save.');

  await context.setOffline(true);await page.close();page=await context.newPage();watch(page);await page.goto(origin);
  await expect(page.locator('#offline')).toContainText('已可離線遊玩');
  for(const character of Object.keys(CHARACTERS)){
    assert.deepEqual(await page.evaluate(async path=>{
      const image=new Image();image.src=path;await image.decode();return [image.naturalWidth,image.naturalHeight];
    },CHARACTERS[character].spritePath),[512,512]);
    const fixture=structuredClone(camp);fixture.run=createRun(fixture.profile,0,'staff','normal',4,character);
    await importSave(fixture);
    await page.locator('#resume').click();await page.locator('#enter-room').click();
    await expect(page.locator('#timer')).not.toHaveText('—');
    await page.screenshot({path:`artifacts/characters/${character}-battle-320.png`});
    await page.locator('#pause').click();await expect(page.locator('.modal')).toContainText(CHARACTERS[character].name);
    await page.locator('#checkpoint').click();
  }
  passed.push('A cold offline page decodes every character sheet and resumes each character save; scene texture identity is checked separately.');

  const upgraded=structuredClone(camp);upgraded.run=createRun(camp.profile,0,'staff','normal',4,'warden');
  for(const u of UPGRADES)upgraded.run.upgrades[u.id]=u.max;
  Object.assign(upgraded.run.upgrades,{meteor:1,ward:1,resolve:1});
  upgraded.run.xp=experienceForLevel(upgraded.run.level);
  await importSave(upgraded);await page.locator('#resume').click();
  await expect(page.locator('.skill-slots>span')).toHaveCount(AUTO_UPGRADES.length);
  await expect(page.locator('.skill-slots')).toContainText(upgradeDescription('meteor',1));
  await page.locator('#enter-room').click();
  await expect(page.locator('[data-upgrade="meteor"] p')).toHaveText(upgradeDescription('meteor',2));
  await expect(page.locator('[data-upgrade="ward"] p')).toHaveText(upgradeDescription('ward',2));
  await expect(page.locator('[data-upgrade="resolve"] p')).toHaveText(upgradeDescription('resolve',2));
  await noOverflow();await page.screenshot({path:'artifacts/characters/upgrades-320.png'});
  await page.locator('[data-upgrade="meteor"]').click();
  await expect(page.locator('#build-info')).toContainText('☄2');
  await page.locator('#build-info').click();
  await expect(page.locator('.skill-slots')).toContainText(upgradeDescription('meteor',2));
  await noOverflow();await page.locator('#close-build').click();
  await page.locator('#pause').click();await page.locator('#checkpoint').click();
  passed.push('Auto skill lists include meteor; offers show the next level and learned skills show the current cumulative effect.');

  await importSave(camp);
  await page.locator('[data-character="keeper"]').click();
  await expect(page.locator('#character-starting')).toContainText('140');await noOverflow();
  await expect(page.locator('.character-preview h2')).toBeInViewport();
  await expect(page.locator('.toast')).toHaveCount(0,{timeout:5000});
  await page.screenshot({path:'artifacts/characters/preview-320.png'});
  await page.locator('#close-character').click();
  await page.setViewportSize({width:1440,height:1000});await noOverflow();
  await page.screenshot({path:'artifacts/characters/camp-desktop.png',fullPage:true});
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/characters/browser-report.json',JSON.stringify({passed,errors,limitations:['Scene texture and animations require check-character-arena.mjs and TASK-003 integration.','Chromium emulation does not establish iPhone or Android hardware compatibility.']},null,2));
  console.log(passed.join('\n'));
}finally{await browser.close();}
}finally{await new Promise(resolve=>server.httpServer.close(resolve));}
