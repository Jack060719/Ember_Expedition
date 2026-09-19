import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { initialSave, createRun, UPGRADES, ROOMS, experienceForLevel } from '../src/core.ts';

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
  await expect(page.locator('[data-route],#enter-puzzle')).toHaveCount(0);
  await page.locator('#enter-room').click();
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
  await page.locator('#resume').click();await page.locator('#enter-room').click();
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
  const learning=initialSave();learning.run=createRun(learning.profile,0,'staff','normal',4);learning.run.xp=experienceForLevel(1);
  await importSave(learning);await page.locator('#resume').click();await page.locator('#enter-room').click();
  await expect(page.locator('[data-upgrade]')).toHaveCount(3);
  await expect(page.locator('.evolution-hint')).toContainText('星隕法杖');
  await page.screenshot({path:'artifacts/upgrade-mobile.png'});
  const chosen=await page.locator('[data-upgrade]').first().getAttribute('data-upgrade');
  await page.locator('[data-upgrade]').first().click();await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  await page.locator('#build-info').click();await expect(page.locator('.evolution-card')).toContainText(chosen==='power'?'鍛火 1/3':'穿透 1/2');
  await page.setViewportSize({width:320,height:568});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#close-build').click();await page.setViewportSize({width:390,height:844});
  await page.locator('#pause').click();await page.locator('#checkpoint').click();
  report.push('Upgrade choices apply and update evolution progress; build panel remains usable at 320px width.');

  const fixture=initialSave();fixture.profile.cleared=5;fixture.profile.facilities.forge=2;fixture.profile.embers=250;
  fixture.run=createRun(fixture.profile,4,'halo','normal',42);fixture.run.room=3;
  for(const u of UPGRADES)fixture.run.upgrades[u.id]=u.max;
  const legacy=structuredClone(fixture);legacy.version=1;legacy.run.route='risk';legacy.run.puzzle={mask:79,moves:8};delete legacy.run.growth;
  await importSave(legacy);await page.locator('#resume').click();
  await expect(page.locator('.route-content')).toContainText('ROOM 04 / 07');
  await expect(page.locator('[data-route],#enter-puzzle,#puzzle-hint')).toHaveCount(0);
  await page.locator('#enter-room').click();await page.locator('#build-info').click();
  await expect(page.locator('.modal')).toContainText('雙曜光環');await expect(page.locator('.modal')).toContainText('霜雷共鳴');
  await page.screenshot({path:'artifacts/build-mobile.png'});
  await page.locator('#close-build').click();
  await expect(page.locator('#game-phase')).toHaveAttribute('data-phase','finalWave',{timeout:70000});
  await page.screenshot({path:'artifacts/final-wave-mobile.png'});
  await expect(page.locator('#next-room')).toBeVisible({timeout:30000});
  await expect(page.locator('.room-rewards')).toBeVisible();
  await page.screenshot({path:'artifacts/room-clear-mobile.png'});
  await page.locator('#next-room').click();await expect(page.locator('.game-header')).toContainText('5/7');
  await page.locator('#pause').click();await page.locator('#checkpoint').click();await page.reload();
  await expect(page.locator('#resume')).toBeVisible();
  report.push('Legacy puzzle save becomes combat room 4/7 offline; build details, final wave, clear rewards and next-room checkpoint work.');

  fixture.run=createRun(fixture.profile,5,'blade','normal',55);fixture.run.room=ROOMS.length;fixture.run.embers=90;
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

  const bossSave=initialSave();bossSave.profile.cleared=5;bossSave.profile.facilities={forge:10,beacon:10,archive:3};
  bossSave.run=createRun(bossSave.profile,5,'staff','normal',55);bossSave.run.room=6;
  for(const u of UPGRADES)bossSave.run.upgrades[u.id]=u.max;
  await page.locator('[data-tab="expedition"]').click();
  await importSave(bossSave);await page.locator('#resume').click();await page.locator('#enter-room').click();
  await expect(page.locator('#boss-track')).toBeVisible();await page.locator('#pause').click();
  const bossHealth=await page.locator('#boss-fill').getAttribute('style'),heroHealth=await page.locator('#health-label').textContent();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('#boss-fill').getAttribute('style'),bossHealth);assert.equal(await page.locator('#health-label').textContent(),heroHealth);
  await page.locator('#checkpoint').click();await page.reload();await page.locator('#resume').click();await page.locator('#enter-room').click();
  await expect(page.locator('#boss-track')).toBeVisible();await expect(page.locator('#health-label')).toContainText('200 / 200');
  await page.screenshot({path:'artifacts/boss-resume-mobile.png'});
  await expect(page.locator('.result-shell')).toContainText('你把火光帶回來了',{timeout:90000});
  await page.locator('#home').click();const bossReward=await page.locator('.currency').textContent();
  await page.reload();assert.equal(await page.locator('.currency').textContent(),bossReward);await expect(page.locator('#resume')).toHaveCount(0);
  report.push('Offline boss checkpoint restores entry health; pause freezes both health bars; actual boss victory settles once after reload.');

  const desktop=await browser.newContext({viewport:{width:1440,height:1000}});
  const desktopPage=await desktop.newPage();watch(desktopPage);await desktopPage.goto('http://localhost:4173/');await expect(desktopPage.locator('#journey')).toBeVisible();
  await desktopPage.screenshot({path:'artifacts/camp-desktop.png',fullPage:true});await desktop.close();
  assert.deepEqual(errors,[],'Unexpected browser errors');
  await writeFile('artifacts/browser-report.json',JSON.stringify({passed:report,errors,limitations:['Chromium mobile emulation is not iPhone Safari hardware.','Native WebMCP context unavailable.','Two-hour battery/thermal and seven-day retention require device testing.']},null,2));
  console.log(report.join('\n'));console.log('Browser checks passed.');
} finally {await browser.close();}
