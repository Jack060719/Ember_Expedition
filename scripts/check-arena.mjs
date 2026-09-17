import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:430,height:840}});
try{
  await page.goto('http://localhost:5173/');
  const result=await page.evaluate(async()=>{
    const {mountArena}=await import('/src/arena.ts');
    const {initialSave,createRun,upgradeChoices,puzzleInitial,puzzleHint,UPGRADES}=await import('/src/core.ts');
    document.querySelector('#app').remove();
    const results=[];
    async function mount(run,puzzle=false){
      const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
      const events={complete:0,defeat:0,upgrade:0,puzzle:0};
      let loaded;const ready=new Promise(resolve=>loaded=resolve);
      const hooks={hud(){loaded();},upgrade(r,choose){events.upgrade++;const choices=upgradeChoices(r);if(choices.length)choose(choices[0].id);},complete(){events.complete++;},defeat(){events.defeat++;},puzzle(){events.puzzle++;},paused(){}};
      const arena=mountArena(host,run,hooks,puzzle);
      await ready;
      arena.game.loop.stop();
      return {arena,events,host,close(){arena.game.runDestroy();host.remove();}};
    }
    const profile=initialSave().profile;profile.cleared=6;profile.facilities={forge:3,beacon:5,archive:3};
    for(const weapon of ['staff','blade','halo']){
      const run=createRun(profile,0,weapon,'normal',729);run.upgrades={power:3,split:2,orbit:1};
      const t=await mount(run),s=t.arena.scene;s.spawnTimer=10000;
      s.spawnEnemy(0,s.hero.x+30,s.hero.y-25);
      for(let i=0;i<150;i++)s.update(i*33.33,33.33);
      results.push({test:weapon+' auto attack kills',ok:s.run.kills>0});t.close();
    }
    {
      const t=await mount(createRun(profile,0,'staff','normal',4)),s=t.arena.scene;
      s.spawnTimer=10000;s.spawnEnemy(2,70,100);const e=s.enemies[0];e.attack=0;s.hero.setPosition(310,100);
      for(let i=0;i<23;i++)s.enemyStep(1/30);
      const before=e.sprite.x;
      for(let i=0;i<15;i++)s.enemyStep(1/30);
      results.push({test:'charger telegraphs then charges for multiple frames',ok:e.sprite.x-before>90,distance:e.sprite.x-before});t.close();
    }
    {
      const run=createRun(profile,0,'staff','normal',8),t=await mount(run),s=t.arena.scene;
      s.run.hp=1;s.hurt(1000);s.update(100,33);
      results.push({test:'death fires exactly one settlement',ok:t.events.defeat===1});t.close();
    }
    {
      const run=createRun(profile,0,'staff','normal',8);run.upgrades.secondwind=1;
      const t=await mount(run),s=t.arena.scene;s.run.hp=1;s.hurt(1000);
      const revived=s.run.hp===s.run.maxHp*.4&&s.run.secondWindUsed;
      s.hitTimer=0;s.hurt(1000);
      results.push({test:'second wind revives only once',ok:revived&&t.events.defeat===1});t.close();
    }
    {
      const run=createRun(profile,0,'staff','normal',8),t=await mount(run),s=t.arena.scene;
      s.clock=200;s.run.xp=1000;s.spawnTimer=10000;s.update(0,33);
      const first=t.events.upgrade===1&&t.events.complete===0;
      s.run.xp=0;s.update(33,33);
      results.push({test:'upgrade resolves before room completion',ok:first&&t.events.complete===1});t.close();
    }
    {
      const run=createRun(profile,0,'staff','normal',8);for(const u of UPGRADES)run.upgrades[u.id]=u.max;
      const t=await mount(run),s=t.arena.scene;s.run.xp=10000;s.spawnTimer=10000;s.update(0,33);
      results.push({test:'maxed upgrades never open empty choice',ok:t.events.upgrade===0});t.close();
    }
    for(let chapter=0;chapter<3;chapter++){
      const run=createRun(profile,chapter*2+1,'staff','normal',9);run.room=7;
      const t=await mount(run),s=t.arena.scene,boss=s.enemies.find(e=>e.type>=6);
      for(let i=0;i<180;i++)s.enemyStep(1/30);
      const attacked=chapter===0?boss.sprite.y!==130:s.shots.length>0;
      s.hit(boss,boss.hp+1);s.update(0,33);
      results.push({test:'chapter '+(chapter+1)+' boss pattern and victory',ok:attacked&&t.events.complete===1});t.close();
    }
    for(let i=0;i<9;i++){
      const run=createRun(profile,0,'staff','normal',i);run.room=3;run.puzzle={mask:puzzleInitial(i),moves:0};
      const t=await mount(run,true),s=t.arena.scene;
      for(let n=0;n<10&&s.run.puzzle.mask!==511;n++){
        s.hero.setPosition(195,550);s.puzzleStep(.3);
        const tile=puzzleHint(s.run.puzzle.mask),target=s.tiles[tile];s.hero.setPosition(target.x,target.y);s.puzzleStep(.3);
      }
      results.push({test:'walk-on puzzle '+i+' solves',ok:t.events.complete===1});t.close();
    }
    return results;
  });
  await writeFile('artifacts/arena-report.json',JSON.stringify(result,null,2));
  for(const r of result)assert.equal(r.ok,true,r.test+': '+JSON.stringify(r));
  console.log(result.map(r=>'PASS '+r.test).join('\n'));
}finally{await browser.close();}
