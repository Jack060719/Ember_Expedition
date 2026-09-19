import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:430,height:840},isMobile:true,hasTouch:true});
try{
  await page.goto('http://localhost:5173/');
  const result=await page.evaluate(async()=>{
    const {mountArena}=await import('/src/arena.ts');
    const {initialSave,createRun,upgradeChoices,UPGRADES}=await import('/src/core.ts');
    document.querySelector('#app').remove();
    const results=[];
    async function mount(run){
      const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
      const events={complete:0,defeat:0,upgrade:0,phases:[]};
      let loaded;const ready=new Promise(resolve=>loaded=resolve);
      const hooks={hud(_r,_remaining,_boss,phase){if(events.phases.at(-1)!==phase)events.phases.push(phase);loaded();},upgrade(r,choose){events.upgrade++;const choices=upgradeChoices(r);if(choices.length)choose(choices[0].id);},complete(){events.complete++;},defeat(){events.defeat++;},paused(){}};
      const arena=mountArena(host,run,hooks);
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
      for(let i=0;i<200;i++)s.update(i*33,33);
      results.push({test:'all pending upgrades resolve before victory and completion happens once',ok:first&&t.events.upgrade>1&&t.events.complete===1&&s.phase==='victory'});t.close();
    }
    {
      const run=createRun(profile,0,'staff','normal',8);for(const u of UPGRADES)run.upgrades[u.id]=u.max;
      const t=await mount(run),s=t.arena.scene;s.run.xp=10000;s.spawnTimer=10000;s.update(0,33);
      results.push({test:'maxed upgrades never open empty choice',ok:t.events.upgrade===0});t.close();
    }
    for(let chapter=0;chapter<3;chapter++){
      const run=createRun(profile,chapter*2+1,'staff','normal',9);run.room=6;
      const t=await mount(run),s=t.arena.scene,boss=s.enemies.find(e=>e.type>=6);
      for(let i=0;i<180;i++)s.enemyStep(1/30);
      const attacked=chapter===0?boss.sprite.y!==130:chapter===1?s.run.hp<run.hp:s.shots.length>0;
      s.hit(boss,boss.hp+1);s.update(0,33);
      const notAbrupt=t.events.complete===0;
      for(let i=0;i<180;i++)s.update(i*33,33);
      results.push({test:'chapter '+(chapter+1)+' boss pattern and delayed victory',ok:attacked&&notAbrupt&&t.events.complete===1});t.close();
    }
    for(let chapter=0;chapter<3;chapter++)for(const difficulty of ['normal','hard']){
      const run=createRun(profile,chapter*2+1,'staff',difficulty,9);run.room=6;
      const t=await mount(run),s=t.arena.scene;
      for(let i=0;i<100;i++)s.update(i*1000/30,1000/30);
      results.push({test:'chapter '+(chapter+1)+' '+difficulty+' boss supplies two twelve-enemy reinforcement waves within 3.4 seconds',ok:s.nextId===25&&s.enemies.some(e=>e.type>=6&&e.hp>0)&&t.events.complete===0});t.close();
    }
    {
      const t=await mount(createRun(profile,0,'blade','normal',10)),s=t.arena.scene;
      s.spawnEnemy(0,s.hero.x+55,s.hero.y);const foe=s.enemies[0];foe.hp=9999;s.autoAttack();
      const health=foe.hp;s.drawVisuals(.04);s.drawVisuals(.04);
      const visible=s.visuals.some(v=>v.kind==='slash'&&v.sprite.active);
      s.drawVisuals(.3);
      results.push({test:'slash persists across frames, expires and deals damage only once',ok:visible&&foe.hp===health&&!s.visuals.some(v=>v.kind==='slash')});
      s.run.upgrades={storm:2,frost:2,nova:2};s.stormTimer=0;s.novaTimer=0;s.skills(.01);
      s.drawVisuals(.08);
      results.push({test:'lightning and nova have lasting effects and froststorm keeps its longer slow',ok:s.visuals.some(v=>v.kind==='bolt')&&s.visuals.some(v=>v.kind==='ring')&&foe.slow===2.5});t.close();
    }
    {
      const t=await mount(createRun(profile,0,'staff','normal',11)),s=t.arena.scene;
      s.hero.setPosition(255,300);s.spawnEnemy(5,195,300);const guard=s.enemies[0];guard.attack=0;
      const hp=s.run.hp;s.enemyStep(.2);const windup=s.run.hp===hp;s.enemyStep(.4);
      const struck=s.run.hp<hp;
      guard.attack=0;s.hitTimer=0;const after=s.run.hp;s.enemyStep(.1);s.hero.setPosition(130,300);s.enemyStep(.5);
      results.push({test:'shield sentinel telegraphs a dodgeable melee strike and never shoots',ok:windup&&struck&&s.run.hp===after&&s.shots.length===0});t.close();
    }
    {
      const t=await mount(createRun(profile,0,'staff','normal',12)),s=t.arena.scene;
      s.spawnTimer=999;s.attackTimer=999;s.spawnEnemy(0,25,80);const foe=s.enemies[0];foe.hp=10000;foe.speed=0;
      s.clock=s.duration()-8;s.update(0,33);const warned=s.phase==='finalWave';
      s.clock=s.duration();for(let i=0;i<20;i++)s.update(i*33,33);
      const waiting=s.phase==='clearing'&&t.events.complete===0&&s.enemies.length===1;
      s.hit(foe,20000);s.shoot(195,480,0,0,100,true);s.update(0,33);
      const safe=s.phase==='loot'&&s.shots.every(shot=>!shot.hostile)&&t.events.complete===0;
      for(let i=0;i<180;i++)s.update(i*33,33);
      results.push({test:'final wave stops spawning, waits for remaining enemies, vacuums loot and celebrates',ok:warned&&waiting&&safe&&s.drops.length===0&&t.events.complete===1&&t.events.defeat===0&&t.events.phases.includes('victory')});t.close();
    }
    {
      const run=createRun(profile,1,'staff','normal',13);run.room=6;
      const t=await mount(run),s=t.arena.scene;s.attackTimer=999;s.spawnEnemy(0,25,80);const add=s.enemies.at(-1);add.hp=10000;add.speed=0;
      s.hit(s.enemies[0],100000);s.update(0,33);const waiting=s.phase==='clearing'&&t.events.complete===0;
      s.hit(add,100000);for(let i=0;i<180;i++)s.update(i*33,33);
      results.push({test:'boss defeat stops reinforcements but waits for the remaining guard',ok:waiting&&t.events.complete===1});t.close();
    }
    {
      const run=createRun(profile,0,'staff','normal',14);run.upgrades={ember:2,nova:2};
      const t=await mount(run),s=t.arena.scene;s.novaTimer=999;
      for(let i=0;i<161;i++){s.spawnEnemy(0,70,100);s.enemies.at(-1).burn=2;}
      const capped=s.enemies.length===160;
      s.hit(s.enemies[0],1000);for(let i=0;i<10;i++)s.skills(.01);
      results.push({test:'wildfire chain clears 160 capped enemies without duplicate kills or unbounded recursion',ok:capped&&s.run.kills===160&&s.drops.length===160&&s.explosions.length===0});t.close();
    }
    {
      const damage=[];
      for(const fps of [30,60]){
        const run=createRun(profile,0,'staff','normal',15);run.upgrades={orbit:1};
        const t=await mount(run),s=t.arena.scene;s.spawnEnemy(0,s.hero.x+78.75,s.hero.y);const foe=s.enemies[0];foe.hp=10000;foe.speed=0;
        for(let i=0;i<fps*3;i++){s.enemyStep(1/fps);s.skills(1/fps);}
        damage.push(10000-foe.hp);t.close();
      }
      results.push({test:'orbit damage is stable at 30 and 60 fps',ok:Math.abs(damage[0]-damage[1])<.01,damage});
    }
    {
      const run=createRun(profile,1,'staff','normal',31);run.room=6;
      const t=await mount(run),s=t.arena.scene,b=s.enemies[0];
      b.sprite.setPosition(50,150);s.hero.setPosition(300,150);b.attack=0;
      s.enemyStep(.01);const locked={dx:b.dx,dy:b.dy},hp=s.run.hp;
      s.hero.setPosition(300,300);s.enemyStep(.4);
      const warned=b.windup>0&&b.sprite.x===50&&s.run.hp===hp&&b.dx===locked.dx&&b.dy===locked.dy;
      s.enemyStep(.41);const start=b.sprite.x;
      const charge=b.charge;s.enemyStep(0);
      results.push({test:'a zero-delta frame during a boss charge preserves finite position and remaining time',ok:b.sprite.x===start&&Number.isFinite(b.sprite.y)&&b.charge===charge});
      while(b.charge>0)s.enemyStep(1/60);
      results.push({test:'stag locks a readable lane, crosses ranged spacing and leaves recovery',ok:warned&&b.sprite.x-start>250&&b.boss.recovery>0&&b.sprite.x<=370});t.close();
    }
    {
      const run=createRun(profile,1,'staff','normal',32);run.room=6;
      const t=await mount(run),s=t.arena.scene,b=s.enemies[0];
      b.hp=b.max*.4;b.attack=0;s.hero.setPosition(330,450);
      let warnings=0,secondLocked=false;
      for(let frame=0;frame<300;frame++){
        const before=b.windup;s.enemyStep(1/60);
        if(b.windup>0&&before<=0){warnings++;if(warnings===2){secondLocked=b.boss.followup&&b.windup>=.7;break;}}
      }
      results.push({test:'half-health stag warns again before its second charge',ok:warnings===2&&secondLocked});t.close();
    }
    for(const dodge of [false,true]){
      const run=createRun(profile,3,'staff','normal',33);run.room=6;
      const t=await mount(run),s=t.arena.scene,b=s.enemies[0];b.attack=0;
      const hp=s.run.hp;s.enemyStep(.01);const target={x:b.dx,y:b.dy};
      s.enemyStep(.4);const warned=s.run.hp===hp&&b.windup>0;
      if(dodge)s.hero.setPosition(target.x+90,target.y);
      s.enemyStep(.41);
      results.push({test:'priest eruption '+(dodge?'can be left before detonation':'hits only after its warning'),ok:warned&&(dodge?s.run.hp===hp:s.run.hp<hp)&&s.shots.length===0});t.close();
    }
    {
      const run=createRun(profile,3,'staff','normal',34);run.room=6;
      const t=await mount(run),s=t.arena.scene,b=s.enemies[0];b.hp=b.max*.4;b.attack=0;
      s.enemyStep(.01);const first={x:b.dx,y:b.dy};s.hero.setPosition(300,430);
      for(let i=0;i<120&&!(b.boss.followup&&b.windup>0);i++)s.enemyStep(1/60);
      results.push({test:'half-health priest gives its second eruption a fresh target and full warning',ok:b.boss.followup&&b.windup>=.7&&b.dx===300&&b.dy===430&&(b.dx!==first.x||b.dy!==first.y)});t.close();
    }
    {
      const run=createRun(profile,5,'staff','normal',35);run.room=6;
      const t=await mount(run),s=t.arena.scene,b=s.enemies[0];b.hp=b.max*.4;b.attack=0;
      s.enemyStep(.01);s.enemyStep(.81);const ring=s.shots.length;
      for(let i=0;i<120&&!(b.boss.followup&&b.windup>0);i++)s.enemyStep(1/60);
      const warning=b.boss.action==='fan'&&b.windup>=.7;
      const angle=Math.atan2(b.dy-b.sprite.y,b.dx-b.sprite.x);
      s.hero.setPosition(40,590);s.enemyStep(.81);
      const fan=s.shots.slice(ring),middle=fan[Math.floor(fan.length/2)];
      results.push({test:'half-health dragon follows its ring with a separately warned, locked fan',ok:ring===14&&warning&&fan.length===7&&Math.abs(Math.atan2(middle.dy,middle.dx)-angle)<.001});t.close();
    }
    for(let chapter=0;chapter<3;chapter++){
      const run=createRun(profile,chapter*2+1,'staff','normal',36);run.room=6;
      const t=await mount(run),s=t.arena.scene,b=s.enemies[0];b.hp=b.max*.4;b.attack=0;
      s.enemyStep(.01);const warning=b.windup;s.pause();
      // The actual Phaser scene is paused; its own clock must not advance.
      const clock=s.clock;s.game.step(100,100);
      const frozen=b.windup===warning&&s.clock===clock;s.resume();
      s.hit(b,b.hp+1);s.update(0,33);
      const safe=s.phase==='loot'&&s.shots.every(q=>!q.hostile);
      for(let i=0;i<90;i++)s.update(i*33,33);
      results.push({test:'boss '+(chapter+1)+' pause freezes warnings and death cancels pending attacks',ok:frozen&&safe&&t.events.complete===1&&t.events.defeat===0});t.close();
    }
    for(const dodge of [false,true]){
      const run=createRun(profile,5,'staff','normal',38);run.room=6;
      const t=await mount(run),s=t.arena.scene,b=s.enemies[0];b.sprite.setPosition(330,250);s.hero.setPosition(330,500);b.boss.turn=1;b.attack=0;
      const hp=s.run.hp;s.enemyStep(.01);s.enemyStep(.4);const warned=s.shots.length===0&&s.run.hp===hp;
      if(dodge)s.hero.setPosition(60,500);
      s.enemyStep(.41);for(let i=0;i<240;i++)s.projectileStep(1/60);
      results.push({test:'dragon fan '+(dodge?'leaves a reachable safe side':'hits along its locked aim'),ok:warned&&(dodge?s.run.hp===hp:s.run.hp<hp)});t.close();
    }
    {
      const run=createRun(profile,1,'staff','normal',39);run.room=6;run.upgrades={frost:3,ember:2};
      const t=await mount(run),s=t.arena.scene,b=s.enemies[0];b.sprite.setPosition(330,550);s.hero.setPosition(360,590);b.attack=0;
      s.hit(b,1);const hp=b.hp;s.enemyStep(.01);
      const end={x:b.sprite.x+b.dx*b.boss.distance,y:b.sprite.y+b.dy*b.boss.distance};
      const affected=b.hp<hp&&b.slow>0&&b.burn>0;
      s.enemyStep(.81);while(b.charge>0)s.enemyStep(1/60);
      results.push({test:'stag charge stops at its warned wall endpoint and still accepts burn and slow',ok:affected&&Math.abs(b.sprite.x-end.x)<.01&&Math.abs(b.sprite.y-end.y)<.01});t.close();
    }
    for(let chapter=0;chapter<3;chapter++){
      const samples=[];
      for(const fps of [30,60]){
        const run=createRun(profile,chapter*2+1,'staff','normal',37);run.room=6;
        const t=await mount(run),s=t.arena.scene,b=s.enemies[0];b.hp=b.max*.4;b.attack=0;s.run.hp=10000;
        let warned=0,firstAttack=null;
        for(let frame=0;frame<fps*15;frame++){
          const winding=b.windup>0;s.enemyStep(1/fps);
          if(!winding&&b.windup>0)warned++;
          if(firstAttack===null&&(b.charge>0||s.shots.length||s.run.hp<10000))firstAttack=(frame+1)/fps;
        }
        samples.push({warned,shots:s.shots.length,firstAttack});t.close();
      }
      results.push({test:'boss '+(chapter+1)+' has consistent attack cadence at 30 and 60 fps',ok:samples[0].warned===samples[1].warned&&samples[0].shots===samples[1].shots&&samples.every(x=>x.firstAttack>=.7),samples});
    }
    return results;
  });
  await page.evaluate(async()=>{
    const {mountArena}=await import('/src/arena.ts'),{initialSave,createRun}=await import('/src/core.ts');
    const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
    await new Promise(resolve=>{
      window.touchArena=mountArena(host,createRun(initialSave().profile,0,'staff','normal',1),{hud(){resolve();},upgrade(){},complete(){},defeat(){},paused(){}});
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
