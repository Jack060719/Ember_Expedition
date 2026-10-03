import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const port=Number(process.argv.find(a=>a.startsWith('--port='))?.split('=')[1]??5173);
assert.ok([5173,4180].includes(port));
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}});
let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${port}`);
  const reports=await page.evaluate(async()=>{
    const c=await import('/src/core.ts'),{mountArena}=await import('/src/arena.ts'),{ENEMIES}=await import('/src/enemies.ts'),{PET_IDS}=await import('/src/pets.ts');
    document.querySelector('#app').remove();const reports=[];
    for(const count of [0,1]){
      const save=c.initialSave();save.profile.cleared=c.MISSIONS.length;
      const run=c.createRun(save.profile,c.MISSIONS.length-2,'staff','normal',8);run.pets=count?PET_IDS.slice(-count):[];
      for(const u of c.UPGRADES)run.upgrades[u.id]=u.max;
      const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
      let ready;const loaded=new Promise(r=>ready=r),arena=mountArena(host,run,{hud(){ready();},upgrade(){},paused(){},complete(){},defeat(){}});
      await loaded;arena.game.loop.stop();const s=arena.scene;s.hurt=()=>{};s.spawnTimer=1e6;
      const types=ENEMIES.map((e,i)=>({e,i})).filter(x=>!x.e.boss&&x.i>=9).map(x=>x.i);
      for(let i=0;i<160;i++){s.spawnEnemy(types[i%types.length],25+i%16*22,75+Math.floor(i/16)*50);const e=s.enemies.at(-1);e.hp=e.max=1e8;}
      const update=[],frames=[];let peakShots=0,peakPetShots=0,peakEffects=0;
      for(let i=0;i<600;i++){const start=performance.now();s.update(i*1000/30,1000/30);update.push(performance.now()-start);peakShots=Math.max(peakShots,s.shots.length);peakPetShots=Math.max(peakPetShots,s.petParty.shots.length);peakEffects=Math.max(peakEffects,s.petParty.effects.length);}
      arena.game.loop.start(arena.game.step.bind(arena.game));let last=0,n=0;
      await new Promise(resolve=>{const next=now=>{if(last&&n>60)frames.push(now-last);last=now;if(++n<301)requestAnimationFrame(next);else resolve();};requestAnimationFrame(next);});
      const percentile=(xs,p)=>xs.sort((a,b)=>a-b)[Math.floor(xs.length*p)];
      reports.push({pets:run.pets,chapter:c.CHAPTERS.length,types,enemies:s.enemies.filter(e=>e.hp>0).length,updateMsP95:percentile(update,.95),frameIntervalP50:percentile(frames,.5),frameIntervalP95:percentile(frames,.95),peakShots,peakPetShots,peakEffects,finite:s.enemies.every(e=>Number.isFinite(e.sprite.x)&&Number.isFinite(e.sprite.y))});
      arena.game.runDestroy();host.remove();
    }
    return reports;
  });
  const sources=Object.fromEntries(await Promise.all((await readdir('src')).filter(f=>f.endsWith('.ts')).map(async f=>[f,createHash('sha256').update(await readFile('src/'+f)).digest('hex')])));
  await mkdir('artifacts/mainline',{recursive:true});await writeFile('artifacts/mainline/pressure.json',JSON.stringify({sources,reports,errors,limitations:'Desktop Chromium, high-health enemies and damage disabled for stable pressure; not phone hardware, GPU timing or thermal validation.'},null,2));
  assert.deepEqual(errors,[]);
  for(const r of reports){assert.equal(r.enemies,160);assert.ok(r.finite&&r.peakShots<=260&&r.peakPetShots<=24&&r.peakEffects<=480);}
  console.log('PASS later ordinary enemy pressure',JSON.stringify(reports));
}finally{await browser?.close();await server.close();}
