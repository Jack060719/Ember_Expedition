import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Run after TASK-003 integrates the effects, using this worktree's port 5173 server.
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
try{
  await page.goto('http://localhost:5173/');
  const sources={};
  for(const file of ['core.ts','characters.ts','weapons.ts','upgrades.ts','ability-effects.ts','arena.ts']){
    const expected=await readFile(new URL('../src/'+file,import.meta.url),'utf8');
    const served=await page.evaluate(async file=>(await import('/src/'+file+'?raw')).default,file);
    assert.equal(served,expected,`${file}: server must serve the code from the tested worktree`);
    sources[file]=createHash('sha256').update(expected).digest('hex');
  }
  const results=await page.evaluate(async()=>{
    const {mountArena}=await import('/src/arena.ts');
    const {initialSave,createRun,upgradeChoices}=await import('/src/core.ts');
    document.querySelector('#app').remove();
    const results=[];
    const check=(name,condition)=>{if(!condition)throw new Error(name);results.push(name);};
    const near=(a,b)=>Math.abs(a-b)<1e-7;
    async function mount(upgrades,autoChoose=true,weapon='staff'){
      const run=createRun(initialSave().profile,0,'staff','normal',42);
      // Isolate the named mechanics from character grants and camp growth.
      run.weapon=weapon;run.upgrades={...upgrades};run.hp=run.maxHp=100;run.growth={damage:0,experience:0,embers:0};
      const host=document.createElement('div');document.body.append(host);
      let ready;const loaded=new Promise(resolve=>ready=resolve);
      const events={complete:0,defeat:0,upgrades:0,choices:[]};
      const arena=mountArena(host,run,{
        hud(){ready();},paused(){},complete(){events.complete++;},defeat(){events.defeat++;},
        upgrade(r,choose){events.upgrades++;const apply=()=>choose(upgradeChoices(r)[0].id);if(autoChoose)apply();else events.choices.push(apply);},
      });
      await loaded;arena.game.loop.stop();
      const s=arena.scene;s.spawnTimer=1e6;s.attackTimer=1e6;
      return {s,arena,events,close(){arena.game.runDestroy();host.remove();}};
    }
    function advance(t,seconds){for(let frame=0;frame<Math.round(seconds*100);frame++)t.s.update(0,10);}
    function enemy(t,dx,hp=10000){
      const s=t.s;s.spawnEnemy(0,s.hero.x+dx,s.hero.y);
      const e=s.enemies.at(-1);e.hp=e.max=hp;e.speed=0;e.attack=1e6;return e;
    }
    {
      const t=await mount({meteor:1});
      try{
        const target=enemy(t,60),inside=enemy(t,100,100),outside=enemy(t,130);
        advance(t,.9);check('meteor waits one second before its first cast',t.s.pendingMeteor===null&&inside.hp===100);
        advance(t,.2);const impact=t.s.pendingMeteor;
        check('meteor locks the nearest position with a delayed damage and radius snapshot',impact&&near(impact.x,target.sprite.x)&&near(impact.damage,32.4)&&impact.radius===60&&impact.remaining>0);
        target.sprite.y-=100;inside.hp=35;
        t.s.run.upgrades={meteor:3,reach:3,cull:3,focus:3,ember:2,frost:2};t.s.random=()=>0;
        advance(t,.35);
        check('impact keeps its cast snapshot and applies cull, critical and status at hit time',near(inside.hp,35-32.4*1.45*2)&&inside.burn>0&&inside.slow>0&&t.s.run.kills===1);
        check('moving out dodges the impact and a later reach upgrade does not expand it',target.hp===10000&&outside.hp===10000&&t.s.pendingMeteor===null);
      }finally{t.close();}
    }
    {
      const t=await mount({meteor:1});
      try{
        advance(t,2);check('a ready meteor waits without a target or queued casts',t.s.pendingMeteor===null&&t.s.meteorTimer<=0);
        const first=enemy(t,60),second=enemy(t,-60);
        advance(t,.01);
        check('equal-distance targets use stable enemy IDs',first.id<second.id&&t.s.pendingMeteor.x===first.sprite.x);
        const pending=t.s.pendingMeteor;advance(t,.1);
        check('only one meteor can be pending',t.s.pendingMeteor===pending);
      }finally{t.close();}
    }
    {
      const t=await mount({});
      try{
        const foe=enemy(t,60);advance(t,3);
        check('an unlearned meteor keeps its initial timer',t.s.meteorTimer===1&&t.s.pendingMeteor===null);
        t.s.run.upgrades.meteor=1;advance(t,.9);
        check('learning meteor mid-room still waits one second',t.s.pendingMeteor===null&&foe.hp===10000);
        advance(t,.2);check('the first learned meteor casts after that delay',!!t.s.pendingMeteor);
      }finally{t.close();}
    }
    {
      const t=await mount({cull:3,focus:3,ember:2,frost:2,nova:2});
      try{
        const direct=enemy(t,60,100),secondary=enemy(t,100,100);direct.hp=secondary.hp=35;t.s.random=()=>0;
        t.s.hit(direct,10);t.s.hit(secondary,10,true);
        check('direct hits receive cull, critical, burn and slow exactly once',near(direct.hp,6)&&direct.burn===2&&direct.slow===1.5);
        check('secondary hits suppress cull, critical and ordinary hit status',secondary.hp===25&&secondary.burn===0&&secondary.slow===0);
        t.s.hit(direct,100,true);
        check('a secondary kill of a burning enemy still queues wildfire',t.s.run.kills===1&&t.s.explosions.length===1);
      }finally{t.close();}
    }
    {
      const t=await mount({orbit:2,haste:2,split:1,cull:3},true,'halo');
      try{
        t.s.skills(0);
        check('halo evolution and orbit contribute to the same blade set',t.s.orbiters.length===8);
        const blade=t.s.orbiters[0],foe=enemy(t,60,100);foe.hp=35;foe.sprite.setPosition(blade.x,blade.y+12);
        t.s.skills(0);t.s.skills(0);
        check('shared blades apply cull once and keep the per-enemy hit cooldown',near(foe.hp,35-18*.35*1.45)&&foe.orbitHit===.2);
      }finally{t.close();}
    }
    {
      const t=await mount({ember:2,nova:2,cull:3});
      try{
        for(let i=0;i<160;i++){t.s.spawnEnemy(0,70,100);const e=t.s.enemies.at(-1);e.hp=e.max=10;e.burn=2;}
        t.s.hit(t.s.enemies[0],100);
        for(let i=0;i<10;i++)t.s.skills(.01);
        check('wildfire legally chains through 160 enemies then terminates with one drop per kill',t.s.run.kills===160&&t.s.drops.length===160&&t.s.explosions.length===0);
      }finally{t.close();}
    }
    {
      const t=await mount({ward:3,resolve:3,secondwind:1,meteor:1});
      try{
        t.s.run.hp=40;t.s.hurt(10);check('resolve does not retroactively protect a crossing hit',near(t.s.run.hp,33.6));
        t.s.hitTimer=0;t.s.hurt(10);check('resolve multiplies ward below the threshold',near(t.s.run.hp,29.12));
        enemy(t,60);advance(t,1.1);check('a meteor is pending before lethal damage',!!t.s.pendingMeteor);
        t.s.run.hp=1;t.s.hitTimer=0;t.s.hurt(10000);
        check('second wind restores forty percent once after damage reduction',t.s.run.hp===40&&t.s.run.secondWindUsed&&t.events.defeat===0);
        const sprite=t.s.pendingMeteor.sprite;t.s.hitTimer=0;t.s.hurt(10000);
        check('defeat cancels the pending meteor and settles once',t.s.pendingMeteor===null&&!sprite.active&&t.events.defeat===1);
        advance(t,1);check('defeat cannot settle again',t.events.defeat===1);
      }finally{t.close();}
    }
    {
      const t=await mount({meteor:1});
      try{
        const foe=enemy(t,60);advance(t,1.1);
        const clock=t.s.clock,remaining=t.s.pendingMeteor.remaining,hp=foe.hp;
        t.s.pause();t.arena.game.loop.start();await new Promise(resolve=>setTimeout(resolve,350));t.arena.game.loop.stop();
        check('actual Phaser pause freezes the meteor and room clock',t.s.clock===clock&&t.s.pendingMeteor.remaining===remaining&&foe.hp===hp);
        t.s.resume();advance(t,.4);check('resume completes the held meteor without background catch-up',near(foe.hp,hp-32.4));
      }finally{t.close();}
    }
    {
      const t=await mount({meteor:1},false);
      try{
        const foe=enemy(t,60);advance(t,1.1);const sprite=t.s.pendingMeteor.sprite;
        t.s.hit(foe,100000);t.s.changePhase('loot');t.s.run.xp=1000;
        check('loot cancels pending offensive effects immediately',t.s.pendingMeteor===null&&!sprite.active);
        const heldClock=t.s.clock,heldXp=t.s.run.xp,heldDrop=t.s.drops[0].sprite.x;
        t.s.pause();t.arena.game.loop.start();await new Promise(resolve=>setTimeout(resolve,350));t.arena.game.loop.stop();
        check('manual pause during loot freezes absorption, upgrades and settlement',t.s.clock===heldClock&&t.s.run.xp===heldXp&&t.s.drops[0].sprite.x===heldDrop&&t.events.upgrades===0&&t.events.complete===0);
        t.s.resume();
        advance(t,.01);const clock=t.s.clock;
        advance(t,.5);check('an unresolved loot upgrade freezes the scene and prevents settlement',t.events.upgrades===1&&t.events.complete===0&&t.s.clock===clock);
        for(let frame=0;frame<400;frame++){t.events.choices.shift()?.();t.s.update(0,10);}
        check('all loot upgrades finish before one victory and no meteor restarts',t.events.upgrades>1&&t.events.complete===1&&t.s.pendingMeteor===null&&t.s.drops.length===0);
      }finally{t.close();}
    }
    {
      const t=await mount({meteor:1});enemy(t,60);advance(t,1.1);const sprite=t.s.pendingMeteor.sprite;t.close();
      check('destroying the room removes its pending meteor sprite',!sprite.active);
      const next=await mount({meteor:1});
      try{check('the next room starts with a fresh timer and no pending meteor',next.s.pendingMeteor===null&&next.s.meteorTimer===1);}finally{next.close();}
    }
    return results;
  });
  await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/upgrades-report.json',JSON.stringify({sources,passed:results,limitations:['Chromium mobile emulation does not verify iPhone hardware.']},null,2));
  console.log(`PASS ${results.length} upgrade scene checks`);
}finally{await browser.close();}
