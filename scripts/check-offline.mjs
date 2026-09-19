import { chromium, webkit, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve('dist'), origin='http://127.0.0.1:4180';
const useWebKit=process.argv.includes('--webkit');
let blocked=false, signIn=false, redirectIndex=false, nextVersion=false, unreachable=false, forestRequests=0;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  if(unreachable){req.socket.destroy();return;}
  const url=new URL(req.url,origin), name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(url.pathname==='/index.html'&&redirectIndex){res.writeHead(301,{Location:'/'}).end();return;}
  if(url.pathname==='/assets/forest.jpg'){
    forestRequests++;
    if(blocked){res.writeHead(signIn?200:503,{'Content-Type':'text/html'}).end('<html>Sign in to continue</html>');return;}
  }
  try{
    let body=await readFile(path.join(root,name));
    if(name==='sw.js'&&nextVersion)body=Buffer.from(body.toString().replace("const CACHE='ember-","const CACHE='ember-update-").replace("version:'","version:'update-"));
    res.writeHead(200,{'Content-Type':types[path.extname(name)]??'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  }
  catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(4180,'127.0.0.1',resolve));
const browser=await (useWebKit?webkit:chromium).launch({headless:true});
// Windows WebKit fails even a minimal cached page with setOffline; drop server connections instead.
async function disconnect(context){if(useWebKit)unreachable=true;else await context.setOffline(true);}
try{
  const context=await browser.newContext(), page=await context.newPage();
  await page.goto(origin);
  await expect(page.locator('#offline')).toContainText('已可離線遊玩',{timeout:20000});
  await page.locator('#journey').click();await page.locator('#begin').click();await page.locator('#back-camp').click();
  blocked=true;
  await page.evaluate(async()=>{for(const name of await caches.keys())if(name.startsWith('ember-'))await (await caches.open(name)).delete('/assets/forest.jpg');});
  await page.reload();await page.locator('#offline').click();
  await expect(page.locator('#retry-offline')).toBeEnabled({timeout:25000});
  const before=forestRequests;blocked=false;
  await page.locator('#retry-offline').click();
  await expect(page.locator('#offline')).toContainText('已可離線遊玩',{timeout:10000});
  await expect(page.locator('.offline-state')).toContainText('已可離線遊玩');
  assert.ok(forestRequests>before,'Retry must actually fetch the missing asset');
  await page.locator('#close').click();await expect(page.locator('#resume')).toBeVisible();
  await disconnect(context);await page.close();const offlinePage=await context.newPage();await offlinePage.goto(origin);
  await expect(offlinePage.locator('#offline')).toContainText('已可離線遊玩');await expect(offlinePage.locator('#resume')).toBeVisible();
  await context.close();unreachable=false;console.log('PASS missing cache repairs on retry; open dialog updates; save survives offline cold launch');

  blocked=true;signIn=true;
  const denied=await browser.newContext(), deniedPage=await denied.newPage();await deniedPage.goto(origin);await deniedPage.locator('#offline').click();
  await expect(deniedPage.locator('#retry-offline')).toBeEnabled({timeout:25000});
  await expect(deniedPage.locator('#offline')).not.toContainText('已可離線遊玩');
  await expect(deniedPage.locator('#offline-panel')).toContainText('登入');
  blocked=false;await deniedPage.locator('#retry-offline').click();
  try{await expect(deniedPage.locator('.offline-state')).toContainText('已可離線遊玩',{timeout:20000});}
  catch(error){
    console.log('Cache diagnostics',await deniedPage.evaluate(async()=>{
      const result={};for(const name of await caches.keys())result[name]=(await (await caches.open(name)).keys()).map(r=>r.url);
      const reg=await navigator.serviceWorker.getRegistration();return {caches:result,active:reg?.active?.state,installing:reg?.installing?.state,waiting:reg?.waiting?.state};
    }));throw error;
  }
  await denied.close();console.log('PASS sign-in HTML cannot count as downloaded artwork; failed first install can retry');

  redirectIndex=true;
  const normalized=await browser.newContext(), normalizedPage=await normalized.newPage();await normalizedPage.goto(origin);
  await expect(normalizedPage.locator('#offline')).toContainText('已可離線遊玩',{timeout:20000});
  await disconnect(normalized);await normalizedPage.reload();await expect(normalizedPage.locator('#journey')).toBeVisible();
  await normalized.close();unreachable=false;console.log('PASS canonical home route installs and reopens offline');

  const updating=await browser.newContext(), updatePage=await updating.newPage();await updatePage.goto(origin);
  await expect(updatePage.locator('#offline')).toContainText('已可離線遊玩',{timeout:20000});
  await updatePage.locator('#offline').click();
  await expect(updatePage.locator('#offline-version')).toContainText(/目前離線版本：[0-9a-f]{12}/);
  await updatePage.locator('#check-update').click();await expect(updatePage.locator('.offline-state')).toContainText('已是最新版本');
  nextVersion=true;await updatePage.locator('#check-update').click();
  await expect(updatePage.locator('#update')).toBeEnabled({timeout:20000});
  const reloaded=updatePage.waitForEvent('domcontentloaded');await updatePage.locator('#update').click();await reloaded;
  await expect(updatePage.locator('#journey')).toBeVisible();
  await expect(updatePage.locator('#offline')).toContainText('已可離線遊玩');
  await updatePage.locator('#offline').click();await expect(updatePage.locator('#offline-version')).toContainText('update-');
  assert.ok((await updatePage.evaluate(()=>caches.keys())).every(name=>name.startsWith('ember-update-')));
  await disconnect(updating);await updatePage.reload();await expect(updatePage.locator('#journey')).toBeVisible();
  await updating.close();console.log('PASS manual update check, installed version display, activation and offline play');

  nextVersion=false;
  const resuming=await browser.newContext(), resumePage=await resuming.newPage();await resumePage.goto(origin);
  await expect(resumePage.locator('#offline')).toContainText('已可離線遊玩',{timeout:20000});
  await resumePage.locator('#journey').click();await resumePage.locator('#begin').click();await resumePage.locator('#back-camp').click();
  nextVersion=true;
  await resumePage.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await expect(resumePage.locator('#offline')).toContainText('有新版本',{timeout:20000});
  await resumePage.locator('#offline').click();await expect(resumePage.locator('#update')).toBeDisabled();
  await resumePage.locator('#close').click();await expect(resumePage.locator('#resume')).toBeVisible();
  await resuming.close();console.log('PASS returning to the app detects an update without activating during an expedition');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
