import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { initialSave, createRun, EVOLUTIONS } from '../src/core.ts';

const server=await preview({preview:{host:'127.0.0.1',port:4180,strictPort:true}});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:320,height:700},isMobile:true,hasTouch:true});
const page=await context.newPage(),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
const origin='http://127.0.0.1:4180';
try{
  await page.goto(origin);await expect(page.locator('#offline')).toContainText('已可離線遊玩',{timeout:45000});
  async function importSave(save){
    await page.locator('#settings').click();
    await page.locator('#import-file').setInputFiles({name:'weapon-check.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});
    await page.locator('#confirm-import').click();await expect(page.locator('#confirm-import')).toHaveCount(0);
  }
  const camp=initialSave();camp.profile.cleared=2;camp.profile.facilities.forge=2;
  await importSave(camp);
  await expect(page.locator('[data-weapon="boomerang"]')).toBeDisabled();await expect(page.locator('[data-weapon="hammer"]')).toBeDisabled();
  camp.profile.facilities.forge=3;await importSave(camp);
  await expect(page.locator('[data-weapon="boomerang"]')).toBeEnabled();await expect(page.locator('[data-weapon="hammer"]')).toBeDisabled();
  camp.profile.facilities.forge=4;await importSave(camp);
  await expect(page.locator('[data-weapon]')).toHaveCount(5);await expect(page.locator('[data-weapon="hammer"]')).toBeEnabled();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'artifacts/weapons-camp-320.png',fullPage:true});
  results.push('Five weapons render at 320px; forge three unlocks boomerang and four unlocks hammer.');
  await page.locator('[data-weapon="hammer"]').click();await expect(page.locator('.weapon-note')).toContainText('延遲落錘');
  await page.locator('#journey').click();await page.locator('#begin').click();await expect(page.locator('.travel-health')).toContainText('震地戰錘');
  await page.locator('#back-camp').click();
  await context.setOffline(true);
  for(const [weapon,character] of [['boomerang','scout'],['hammer','warden']]){
    const save=structuredClone(camp);save.run=createRun(save.profile,0,weapon,'normal',8,character);save.run.hp=43;Object.assign(save.run.upgrades,EVOLUTIONS[weapon].requires,{meteor:1,cull:2,resolve:2});
    await importSave(save);await page.reload();await expect(page.locator('#resume')).toBeVisible();
    await page.locator('#settings').click();const download=page.waitForEvent('download');await page.locator('#export').click();
    const path=`artifacts/${weapon}-save-export.json`;await (await download).saveAs(path);
    assert.deepEqual(JSON.parse(await readFile(path,'utf8')),save);await page.locator('#close').click();
    await page.locator('#resume').click();await expect(page.locator('.travel-health')).toContainText(EVOLUTIONS[weapon].name);
    await page.locator('#enter-room').click();await expect(page.locator('canvas')).toBeVisible();await expect(page.locator('#timer')).not.toHaveText('—');
    await page.locator('#pause').click();await page.locator('#checkpoint').click();
    results.push(`${weapon} and ${character} preserve evolved upgrades and HP through offline import, reload, export and checkpoint combat.`);
  }
  const decoded=await page.evaluate(async()=>Promise.all(['/assets/weapons/boomerang.png','/assets/weapons/hammer.png','/assets/upgrades/meteor.png','/assets/characters/scout.png','/assets/characters/warden.png'].map(async src=>{const image=new Image();image.src=src;await image.decode();return [src,image.naturalWidth,image.naturalHeight];})));
  assert.deepEqual(decoded.map(([,w,h])=>[w,h]),[[256,128],[384,128],[128,128],[512,512],[512,512]]);
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/weapons-browser-report.json',JSON.stringify({results,decoded,errors},null,2));
  console.log('PASS weapon selection, offline checkpoint/save round trips and all five new runtime images');
}finally{await browser.close();await server.httpServer.close();}
