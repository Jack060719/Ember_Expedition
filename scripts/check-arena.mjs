import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:430,height:840},isMobile:true,hasTouch:true});
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
    {
      const t=await mount(createRun(profile,0,'staff','normal',4)),s=t.arena.scene;
      const finger={x:180,y:450,isDown:true},other={x:220,y:460,isDown:true};
      const start=()=>{s.pointer=null;s.hero.setPosition(195,490);finger.x=180;finger.y=450;s.input.emit('pointerdown',finger);};
      start();finger.x+=3;s.move(.1);results.push({test:'tiny touch drift stays still',ok:s.hero.x===195});
      start();finger.x+=24;s.move(.1);const slow=s.hero.x-195;
      start();finger.x+=42;s.move(.1);const fast=s.hero.x-195;
      results.push({test:'short drags allow precise analog movement',ok:slow>0&&slow<fast*.7&&Math.abs(fast-12.8)<.01});
      start();finger.x+=100;finger.y+=100;s.move(.1);
      results.push({test:'diagonal movement has the same maximum speed',ok:Math.abs(Math.hypot(s.hero.x-195,s.hero.y-490)-fast)<.01});
      start();finger.x=370;s.move(.1);const before=s.hero.x;finger.x=280;s.move(.1);
      results.push({test:'long drag reverses before crossing original touch',ok:s.hero.x<before&&finger.x>180});
      start();finger.x+=42;s.input.emit('pointerdown',other);s.input.emit('pointerup',other);s.move(.1);
      results.push({test:'another finger cannot steal or end movement',ok:s.pointer?.input===finger&&s.hero.x>195});
      s.input.emit('gameout');const outside=s.hero.x;s.move(.1);
      results.push({test:'leaving the canvas stops stale movement',ok:s.hero.x===outside&&s.pointer===null});
      start();finger.x+=42;s.pause();s.resume();s.move(.1);
      results.push({test:'pause resume requires a fresh gesture',ok:s.hero.x===195&&s.pointer===null});
      start();finger.x+=42;finger.isDown=false;s.move(.1);
      results.push({test:'cancelled or released touch stops immediately',ok:s.hero.x===195&&s.pointer===null});t.close();
    }
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
  await page.evaluate(async()=>{
    const {mountArena}=await import('/src/arena.ts'),{initialSave,createRun}=await import('/src/core.ts');
    const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
    await new Promise(resolve=>{
      window.touchArena=mountArena(host,createRun(initialSave().profile,0,'staff','normal',1),{hud(){resolve();},upgrade(){},complete(){},defeat(){},puzzle(){},paused(){}});
    });
    window.touchArena.game.loop.stop();
  });
  const box=await page.locator('canvas').boundingBox(),cdp=await page.context().newCDPSession(page);
  const point=(id,x,y)=>({id,x:box.x+x*box.width/390,y:box.y+y*box.height/660});
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const step=()=>page.evaluate(()=>{const s=window.touchArena.scene;s.move(.1);return {x:s.hero.x,owned:!!s.pointer};});
  await touch('touchStart',[point(1,180,450)]);await touch('touchMove',[point(1,240,450)]);
  const moving=await step();assert.ok(moving.x>195&&moving.owned);
  await touch('touchStart',[point(1,240,450),point(2,90,450)]);
  await touch('touchEnd',[point(2,90,450)]);
  const continuing=await step();assert.ok(continuing.x>moving.x&&continuing.owned);
  await touch('touchCancel',[]);const cancelled=await step();assert.equal(cancelled.x,continuing.x);assert.equal(cancelled.owned,false);
  await touch('touchStart',[point(1,180,450)]);await touch('touchMove',[point(1,240,450)]);const beforeExit=await step();
  await touch('touchMove',[point(1,240,710)]);const afterExit=await step();assert.equal(afterExit.x,beforeExit.x);assert.equal(afterExit.owned,false);
  await touch('touchEnd',[]);await page.evaluate(()=>window.touchArena.game.runDestroy());
  result.push({test:'native touch movement, second-finger release, cancellation and canvas exit',ok:true});
  await writeFile('artifacts/arena-report.json',JSON.stringify(result,null,2));
  for(const r of result)assert.equal(r.ok,true,r.test+': '+JSON.stringify(r));
  console.log(result.map(r=>'PASS '+r.test).join('\n'));
}finally{await browser.close();}
