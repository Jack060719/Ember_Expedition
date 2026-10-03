import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const port=Number(process.argv.find(a=>a.startsWith('--port='))?.split('=')[1]??4180);
const root=process.cwd(),hash=s=>createHash('sha256').update(s).digest('hex');
const files=(await readdir('src')).filter(f=>f.endsWith('.ts')).map(f=>'src/'+f);
const sources=Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f,'utf8'))])));
const server=await createServer({root,server:{host:'127.0.0.1',port,strictPort:true}});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}`);
  await page.locator('#chapters').waitFor();
  const served=await page.evaluate(async files=>Object.fromEntries(await Promise.all(files.map(async f=>{
    const raw=await fetch('/'+f+'?raw').then(r=>r.text());return [f,raw.startsWith('export default ')?JSON.parse(raw.split('\n')[0].slice(15).replace(/;$/,'')):raw];
  }))),files);
  for(const f of files)assert.equal(hash(served[f]),sources[f],f+' served from this worktree');
  const results=await page.evaluate(async()=>{
    const core=await import('/src/core.ts'),{mountArena}=await import('/src/arena.ts'),{ENEMIES,isBossEnemy,enemyType}=await import('/src/enemies.ts');
    document.querySelector('#app').remove();
    const results=[];
    const profile=core.initialSave().profile;profile.cleared=core.MISSIONS.length;profile.facilities={forge:10,beacon:10,archive:3};
    async function mount(mission,room=0){
      const run=core.createRun(profile,mission,'staff','normal',42);run.room=room;
      const host=document.createElement('div');document.body.append(host);
      let loaded;const ready=new Promise(r=>loaded=r),events={complete:0,defeat:0,boss:null};
      const arena=mountArena(host,run,{hud(_r,_t,boss){events.boss=boss;loaded();},paused(){},upgrade(r,choose){choose(core.upgradeChoices(r)[0].id);},complete(){events.complete++;},defeat(){events.defeat++;}});
      await ready;arena.game.loop.stop();arena.scene.spawnTimer=10000;
      return {s:arena.scene,events,close(){arena.game.runDestroy();host.remove();}};
    }
    for(let chapter=3;chapter<core.CHAPTERS.length;chapter++){
      const t=await mount(chapter*2+1,6),s=t.s,boss=s.enemies.find(e=>isBossEnemy(e.type));
      results.push({test:`chapter ${chapter+1} loads local ground and correct boss`,ok:s.textures.get('ground').source[0].width===1024&&boss?.type===core.bossType(chapter)&&Number.isFinite(boss.hp)&&s.textures.get(ENEMIES[boss.type].texture).has(ENEMIES[boss.type].frame)});
      s.spawnEnemy(enemyType(core.CHAPTERS[chapter].enemy),195,550);
      const mob=s.enemies.find(e=>!isBossEnemy(e.type));
      results.push({test:`chapter ${chapter+1} regular monster has no boss state`,ok:!!mob&&!mob.boss&&Number.isFinite(mob.hp)});
      s.hit(boss,1e9,true);s.update(0,33.33);
      results.push({test:`chapter ${chapter+1} defeated boss waits for surviving ordinary monster`,ok:s.phase==='clearing'&&t.events.complete===0&&mob.hp>0});
      s.hit(mob,1e9,true);
      for(let i=0;i<300;i++)s.update(i*33.33,33.33);
      results.push({test:`chapter ${chapter+1} collects loot and completes exactly once`,ok:t.events.complete===1&&s.drops.length===0});t.close();
    }
    for(const type of ENEMIES.map((_,i)=>i).filter(i=>i>=9&&!['heal','summon','pharaoh','rally'].includes(ENEMIES[i].behavior))){
      const t=await mount(type>=33?30:type>=25?22:type>=17?14:6),s=t.s;s.hero.setPosition(195,ENEMIES[type].behavior==='shield'?330:380);s.spawnEnemy(type,195,250);
      const e=s.enemies[0];e.attack=0;e.speed=0;if(ENEMIES[type].behavior==='black-sun')e.attackTurn=1;
      const before=s.run.hp;
      for(let i=0;i<24;i++){s.hitTimer=0;s.enemyStep(1/30);}
      results.push({test:ENEMIES[type].name+' does not damage during warning',ok:s.run.hp===before&&!!e.threat});
      for(let i=0;i<90;i++){s.hitTimer=Math.max(0,s.hitTimer-1/30);s.enemyStep(1/30);}
      results.push({test:ENEMIES[type].name+' hits a player who stays in its warned area',ok:s.run.hp<before});
      results.push({test:ENEMIES[type].name+' remains within arena',ok:e.sprite.x>=20&&e.sprite.x<=370&&e.sprite.y>=60&&e.sprite.y<=605});t.close();
    }
    {
      const t=await mount(14),s=t.s;s.hero.setPosition(195,330);s.spawnEnemy(enemyType('crystal-guard'),195,250);
      const e=s.enemies[0];e.attack=0;e.hp=e.max=1000;s.enemyStep(.01);
      s.hit(e,100,true);const front=1000-e.hp;s.hero.setPosition(195,170);const hp=e.hp;s.hit(e,100,true);
      results.push({test:'crystal shield reduces frontal hits only during its locked attack',ok:front===45&&hp-e.hp===100});
      s.hero.setPosition(195,330);const petHp=e.hp;s.hitPet(e,100);results.push({test:'shield leaves fixed pet damage intact',ok:petHp-e.hp===100});
      e.threat=undefined;const weakHp=e.hp;s.hit(e,100,true);results.push({test:'shield recovery exposes full damage',ok:weakHp-e.hp===100});t.close();
    }
    {
      const t=await mount(20),s=t.s;s.hero.setPosition(195,450);s.spawnEnemy(enemyType('parasite-healer'),195,250);s.spawnEnemy(0,210,250);s.spawnEnemy(0,350,250);s.spawnEnemy(6,195,270);
      const [healer,near,far,boss]=s.enemies;for(const e of s.enemies){e.hp=50;e.max=100;e.speed=0;e.attack=100;}
      healer.attack=0;const before=s.run.hp;
      for(let i=0;i<40;i++)s.chapterEnemyStep(healer,.03);
      results.push({test:'healer pulse restores a nearby ordinary ally once but not itself, a boss or distant targets',ok:near.hp===62&&far.hp===50&&healer.hp===50&&boss.hp===50&&s.run.hp===before});t.close();
    }
    {
      const t=await mount(24),s=t.s;s.hero.setPosition(195,400);s.spawnEnemy(enemyType('sand-cultist'),195,200);
      const caster=s.enemies[0];caster.attack=0;
      for(let cast=0;cast<10;cast++){caster.attack=0;for(let i=0;i<50;i++)s.chapterEnemyStep(caster,.03);}
      results.push({test:'cultist lifetime summon budget stays at six even after repeated casts',ok:caster.summoned===6&&s.enemies.length===7});
      const count=s.enemies.length;s.phase='clearing';caster.attack=0;caster.summoned=0;for(let i=0;i<50;i++)s.chapterEnemyStep(caster,.03);
      results.push({test:'clearing phase prevents fresh summons',ok:s.enemies.length===count});
      s.phase='fighting';s.spawnEnemy(enemyType('sand-pharaoh'),195,130);const boss=s.enemies.at(-1);boss.attack=0;boss.attackTurn=1;s.shots=[];
      for(let i=0;i<30;i++)s.chapterEnemyStep(boss,.03);
      results.push({test:'pharaoh projectiles wait for the complete warning',ok:s.shots.length===0});
      for(let i=0;i<15;i++)s.chapterEnemyStep(boss,.03);
      results.push({test:'pharaoh fires exactly ten capped hostile projectiles',ok:s.shots.length===10&&s.shots.every(p=>p.hostile)});
      for(let i=0;i<30;i++)s.chapterEnemyStep(boss,.03);
      results.push({test:'pharaoh never refires the same volley',ok:s.shots.length===10});t.close();
    }
    {
      const t=await mount(38),s=t.s;s.hero.setPosition(195,450);s.spawnEnemy(enemyType('night-banner'),195,250);s.spawnEnemy(0,210,250);s.spawnEnemy(0,350,250);s.spawnEnemy(6,195,270);
      const [banner,near,far,boss]=s.enemies;for(const e of s.enemies){e.speed=0;e.attack=100;}banner.attack=0;
      for(let i=0;i<45;i++)s.chapterEnemyStep(banner,.03);
      results.push({test:'night banner rallies nearby ordinary allies but not itself, bosses or distant enemies',ok:near.rally===3&&far.rally===0&&boss.rally===0&&banner.rally===0});
      banner.attack=100;near.speed=34;const before={x:near.sprite.x,y:near.sprite.y};s.enemyStep(.1);
      results.push({test:'rally gives temporary 25 percent movement without rewriting base speed',ok:Math.abs(Math.hypot(near.sprite.x-before.x,near.sprite.y-before.y)-4.25)<.001&&near.speed===34});
      near.rally=.01;const end={x:near.sprite.x,y:near.sprite.y};s.enemyStep(.1);
      results.push({test:'rally expires back to normal movement',ok:near.rally===0&&Math.abs(Math.hypot(near.sprite.x-end.x,near.sprite.y-end.y)-3.4)<.001});t.close();
    }
    {
      const t=await mount(39,6),s=t.s,boss=s.enemies[0],patterns=[];
      for(const ratio of [1,.6,.3]){boss.hp=boss.max*ratio;boss.attack=0;boss.attackTurn=0;boss.threat=undefined;s.chapterEnemyStep(boss,.01);patterns.push(JSON.stringify(boss.threat.plan.areas));}
      results.push({test:'final boss selects three distinct phase patterns from remaining health',ok:new Set(patterns).size===3});
      const before=boss.threat.elapsed;s.pause();s.update(0,50);
      results.push({test:'final boss pause freezes pending phase warnings',ok:boss.threat.elapsed===before});s.resume();
      s.hit(boss,1e9,true);s.update(0,33.33);
      results.push({test:'final boss death cancels its outstanding attacks and starts clearing',ok:boss.hp<=0&&s.phase!=='fighting'});t.close();
    }
    {
      const t=await mount(6),s=t.s;
      for(let i=0;i<170;i++)s.spawnEnemy(9,40+i%10*30,100+Math.floor(i/10)*20);
      s.emitHud();results.push({test:'160 new ordinary monsters respect cap and never create a boss HUD',ok:s.enemies.length===160&&t.events.boss===null});t.close();
    }
    return results;
  });
  await page.reload();await page.locator('#chapters').waitFor();
  const old=JSON.parse(await readFile('tests/fixtures/save-v4.json','utf8'));old.run=null;
  await page.evaluate(async old=>{const c=await import('/src/core.ts'),s=await import('/src/storage.ts');await s.writeSave(c.validateSave(old));},old);
  await page.reload();await page.locator('#chapters').click();
  assert.equal(await page.locator('.chapter-group').count(),await page.evaluate(async()=>(await import('/src/core.ts')).CHAPTERS.length));
  if(await page.locator('.chapter-group').nth(3).getAttribute('open')===null)await page.locator('.chapter-group').nth(3).locator('summary').click();
  await page.locator('[data-mission="6"]').click();
  assert.match(await page.locator('.mission-card').innerText(),/赤砂峽谷/);
  assert.equal(await page.locator('#difficulty').count(),0);
  await page.locator('#chapters').click();
  await page.locator('.chapter-group').nth(6).locator('summary').click();
  assert.equal(await page.locator('[data-mission="13"]').isDisabled(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mkdir('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/mainline-chapters.png',fullPage:true});
  for(const f of files)assert.equal(hash(await readFile(f,'utf8')),sources[f],f+' unchanged during checks');
  await writeFile('artifacts/mainline-checks.json',JSON.stringify({root,port,sources,results,errors,ui:'chapter-four continuation, locked missions, grouping, narrow viewport'},null,2));
  for(const r of results)assert.ok(r.ok,r.test);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${results.length} chapter combat checks and chapter/save UI checks`);
}finally{await browser?.close();await server.close();}
