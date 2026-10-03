import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {writeFile,readFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const sources=Object.fromEntries(await Promise.all((await readdir('src')).filter(f=>f.endsWith('.ts')).map(async f=>[f,createHash('sha256').update(await readFile('src/'+f)).digest('hex')])));
const port=Number(process.argv.find(a=>a.startsWith('--port='))?.split('=')[1]??5173);assert.ok([5173,4180].includes(port));
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}});let browser;
const errors=[],warnings=[],failedRequests=[];const started=Date.now();
await mkdir('artifacts/mainline',{recursive:true});
try{
 await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type())){warnings.push(m.text());if(warnings.length>50)warnings.shift();}});
 page.on('requestfailed',r=>failedRequests.push({url:r.url(),failure:r.failure()}));await page.exposeFunction('progress',n=>console.log('mount '+n));await page.goto(`http://127.0.0.1:${port}/`);
 const result=await page.evaluate(async()=>{
  document.querySelector('#app').remove();const {mountArena}=await import('/src/arena.ts'),core=await import('/src/core.ts'),{CHARACTERS}=await import('/src/characters.ts');
  const profile=core.initialSave().profile;profile.cleared=40;profile.facilities={forge:50,beacon:50,archive:3};
  const run=core.createRun(profile,39,'halo','hard',8,'warden');run.pets=['crimsonDragon','dawnGriffin','dawnStarDragon'];run.petEncounter={room:0,pet:null,state:'none'};
  const samples=[];
  for(let i=0;i<1600;i++){
   const host=document.createElement('div');document.body.append(host);let ready;const loaded=new Promise(r=>ready=r);
   const arena=mountArena(host,run,{hud(){ready();},complete(){},defeat(){},upgrade(){},paused(){}});
   await loaded;arena.game.loop.stop();const s=arena.scene;
   for(const key of ['ground','character-warden','enemies-mainline-4','pet-dawnStarDragon'])if(!s.textures.exists(key))throw Error('Missing texture '+key+' at '+i);for(let d=0;d<4;d++){const key=CHARACTERS.warden.animationPrefix+d;if(s.anims.get(key)?.frames.length!==4)throw Error('Missing animation '+i+'/'+d);s.hero.play(key);}
   if(i%200===0)await window.progress(i);if(i%200===0)samples.push({mount:i,renderer:arena.game.renderer.type,canvases:document.querySelectorAll('canvas').length});
   arena.game.destroy(true);arena.game.runDestroy();host.remove();
  }
  return {mounts:1600,samples,remainingCanvases:document.querySelectorAll('canvas').length};
 });
 assert.equal(result.remainingCanvases,0);assert.deepEqual(errors,[]);assert.ok(!warnings.some(w=>w.includes('Failed to process file')||w.includes('not found')));
 await writeFile('artifacts/mainline/lifecycle.json',JSON.stringify({sources,result,errors,warnings,seconds:(Date.now()-started)/1000,scope:'1600 sequential final-chapter arena mounts in one page; validates all four hero animations and production destroy(true) cleanup. Regression for repeated XHR/blob image processing failures; direct image URLs preserve all animation frames.'},null,2));
 console.log(JSON.stringify(result));
}catch(e){await writeFile('artifacts/mainline/lifecycle-regression-failure.json',JSON.stringify({sources,error:e.message,errors,warnings,failedRequests,seconds:(Date.now()-started)/1000},null,2));throw e;}finally{await browser?.close();await server.close();}
