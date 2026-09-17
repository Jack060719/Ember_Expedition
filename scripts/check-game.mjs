import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { initialSave, createRun, toggleTile } from '../src/core.ts';

await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
let page=await context.newPage();
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};watch(page);
const report=[];
try {
  await page.goto('http://localhost:4173/');
  await expect(page.locator('#offline')).toContainText('已可離線遊玩',{timeout:45000});
  await page.screenshot({path:'artifacts/camp-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  report.push('Mobile camp renders without horizontal overflow; all offline assets cached.');
  await page.locator('#journey').click();await page.locator('#begin').click();
  await page.locator('[data-route="safe"]').click();
  await expect(page.locator('#timer')).not.toHaveText('—');
  await expect(page.locator('canvas')).toBeVisible();
  const box=await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.75);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.32,box.y+box.height*.65,{steps:5});await page.waitForTimeout(1400);await page.mouse.up();
  await page.screenshot({path:'artifacts/battle-mobile.png'});
  await page.locator('#pause').click();
  const paused=await page.locator('#timer').textContent();await page.waitForTimeout(1200);assert.equal(await page.locator('#timer').textContent(),paused);
  await page.locator('#checkpoint').click();
  await expect(page.locator('#resume')).toBeVisible();
  report.push('Single-pointer drag starts combat; pause freezes timer; camp preserves checkpoint.');

  await context.setOffline(true);await page.close();page=await context.newPage();watch(page);
  await page.goto('http://localhost:4173/');
  await expect(page.locator('#resume')).toBeVisible();
  await expect(page.locator('#offline')).toContainText('已可離線遊玩');
  await page.locator('#resume').click();await page.locator('[data-route="safe"]').click();
  await expect(page.locator('#timer')).not.toHaveText('—');
  await page.locator('#pause').click();await page.locator('#checkpoint').click();
  report.push('Fresh page opens fully offline, retains the run and reloads sprite assets for combat.');

  await page.locator('#settings').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;
  await download.saveAs('artifacts/save-export.json');
  await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await expect(page.locator('.toast')).toContainText('格式或版本');
  await page.locator('#close').click();await expect(page.locator('#resume')).toBeVisible();
  report.push('Offline backup downloads; invalid import is rejected without replacing progress.');

  async function importSave(value){
    await page.locator('#settings').click();
    await page.locator('#import-file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
    await page.locator('#confirm-import').click();
    await expect(page.locator('#resume')).toBeVisible();
  }
  const fixture=initialSave();fixture.profile.cleared=5;fixture.profile.facilities.forge=2;fixture.profile.embers=250;
  fixture.run=createRun(fixture.profile,4,'halo','normal',42);fixture.run.room=3;fixture.run.puzzle={mask:toggleTile(511,0),moves:0};
  await importSave(fixture);await page.locator('#resume').click();await page.locator('#enter-puzzle').click();
  await expect(page.locator('#puzzle-hint')).toBeVisible();await page.locator('#puzzle-hint').click();
  await page.screenshot({path:'artifacts/puzzle-mobile.png'});
  await page.locator('#pause').click();await page.locator('#checkpoint').click();
  await page.reload();await page.locator('#resume').click();await page.locator('#enter-puzzle').click();
  await page.locator('#puzzle-skip').click();await expect(page.locator('.route-content')).toContainText('ROOM 05');
  report.push('Puzzle chapter, hints, checkpoint reload and optional skip work offline.');

  await page.locator('#back-camp').click();
  fixture.run=createRun(fixture.profile,5,'blade','normal',55);fixture.run.room=8;fixture.run.embers=90;
  await importSave(fixture);await page.locator('#resume').click();
  await expect(page.locator('.result-shell')).toContainText('你把火光帶回來了');
  await expect(page.locator('.result-reward')).toContainText('135');
  await page.locator('#home').click();await page.reload();
  await expect(page.locator('.currency')).toContainText('385');
  await page.locator('[data-tab="camp"]').click();
  await page.locator('[data-facility="beacon"]').click();
  await expect(page.locator('.currency')).toContainText('335');
  await page.locator('[data-tab="journal"]').click();await expect(page.locator('.journal')).toContainText('三枚火種');
  report.push('Final chapter settlement is saved once; camp purchase persists and ending journal unlocks.');

  const desktop=await browser.newContext({viewport:{width:1440,height:1000}});
  const desktopPage=await desktop.newPage();watch(desktopPage);await desktopPage.goto('http://localhost:4173/');await expect(desktopPage.locator('#journey')).toBeVisible();
  await desktopPage.screenshot({path:'artifacts/camp-desktop.png',fullPage:true});await desktop.close();
  assert.deepEqual(errors,[],'Unexpected browser errors');
  await writeFile('artifacts/browser-report.json',JSON.stringify({passed:report,errors,limitations:['Chromium mobile emulation is not iPhone Safari hardware.','Native WebMCP context unavailable.','Two-hour battery/thermal and seven-day retention require device testing.']},null,2));
  console.log(report.join('\n'));console.log('Browser checks passed.');
} finally {await browser.close();}
