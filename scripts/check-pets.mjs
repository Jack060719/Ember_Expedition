import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Coordinate 5173 or 4180 before running; this server owns its lifecycle.
const port=Number(process.argv.find(arg=>arg.startsWith('--port='))?.split('=')[1]??4180);
assert.ok([5173,4180].includes(port));
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}});
await server.listen();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(`http://127.0.0.1:${port}`);
  const result=await page.evaluate(async()=>{
    const {mountArena}=await import('/src/arena.ts');
    const {initialSave,createRun,upgradeChoices,UPGRADES}=await import('/src/core.ts');
    const {PETS,PET_IDS}=await import('/src/pets.ts');
    document.querySelector('#app').remove();const checks=[];
    const check=(test,ok,details)=>checks.push({test,ok,details});
    const profile=initialSave().profile;profile.cleared=6;profile.petSlots=1;profile.ownedPets=PET_IDS;
    async function mount(pets=[],pet=null){
      const run=createRun(profile,0,'staff','normal',42);run.pets=pets;run.petEncounter=pet?{room:0,pet,state:'available'}:{room:0,pet:null,state:'none'};
      const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
      let loaded;const ready=new Promise(resolve=>loaded=resolve),events={complete:0,defeat:0,tame:0,accept:null,upgrade:0,phases:[]};
      const arena=mountArena(host,run,{hud(_r,_t,_b,p){loaded();events.phases.push(p);},upgrade(r,choose){events.upgrade++;choose(upgradeChoices(r)[0].id);},complete(){events.complete++;},defeat(){events.defeat++;},paused(){},tame(id,accept){events.tame++;events.accept=accept;}});
      await ready;arena.game.loop.stop();const s=arena.scene;s.spawnTimer=1e6;
      return {s,events,arena,close(){arena.game.runDestroy();host.remove();}};
    }
    const enemy=(s,x,y,hp=1000)=>{s.spawnEnemy(0,x,y);const e=s.enemies.at(-1);e.hp=hp;e.max=1000;e.speed=0;return e;};
    for(const id of PET_IDS.slice(0,5)){
      const t=await mount([id]),s=t.s;s.hero.setPosition(195,400);s.petParty.companions[0].sprite.setPosition(195,400);
      s.run.growth.damage=1.6;for(const u of UPGRADES)s.run.upgrades[u.id]=u.max;
      const positions=id==='starDrake'?[[240,400],[270,410],[130,400]]:id==='emberFox'?[[235,400],[260,400],[340,400]]:[[235,400],[270,400],[305,400],[340,400]];
      const targets=positions.map(([x,y])=>enemy(s,x,y,300));
      for(let frame=0;frame<30;frame++)s.petParty.step(.03,s.enemies);
      const hits=targets.map(e=>300-e.hp),expected=id==='starDrake'?[60,60,0]:id==='emberFox'?[18,18,0]:id==='frostOwl'?[30,30,30,0]:id==='thunderLeopard'?[42,0,0,0]:[10,0,0,0];
      check(id+' attack has exact fixed damage and target count despite all player bonuses',JSON.stringify(hits)===JSON.stringify(expected),hits);
      check(id+' does not inflict player statuses',targets.every(e=>e.burn===0&&e.slow===0));
      const p=s.petParty.companions[0];check(id+' is a local sprite without health or collision target',p.sprite.texture.key==='pet-'+id&&!('hp' in p)&&s.enemies.length===positions.length);
      t.close();
    }
    for(const id of ['sandLizard','magmaTurtle']){
      const t=await mount([id]),s=t.s;s.hero.setPosition(195,400);s.petParty.companions[0].sprite.setPosition(155,424);
      s.run.growth.damage=2.4;for(const u of UPGRADES)s.run.upgrades[u.id]=u.max;
      const positions=id==='sandLizard'?[[285,424],[317,371],[317,477],[80,200]]:[[200,424],[220,440],[340,400]];
      const targets=positions.map(([x,y])=>enemy(s,x,y,1000));
      for(let frame=0;frame<30;frame++)s.petParty.step(.03,s.enemies);
      const hits=targets.map(e=>1000-e.hp),expected=id==='sandLizard'?[80,80,80,0]:[95,95,0];
      check(id+' shape uses fixed damage once per target despite all bonuses',JSON.stringify(hits)===JSON.stringify(expected),hits);
      check(id+' never inherits burn, frost or secondary explosions',targets.every(e=>e.burn===0&&e.slow===0)&&s.explosions.length===0);
      s.changePhase('loot');check(id+' clears all attacks before loot',s.petParty.shots.length===0&&s.petParty.effects.length===0);t.close();
    }
    for(const id of ['windFalcon','moonCat']){
      const t=await mount([id]),s=t.s;s.hero.setPosition(195,400);const p=s.petParty.companions[0];p.sprite.setPosition(155,424);
      s.run.growth.damage=3.2;for(const u of UPGRADES)s.run.upgrades[u.id]=u.max;
      const positions=id==='windFalcon'?[[240,424],[265,424],[80,200]]:[[240,424],[270,480],[80,200]],targets=positions.map(([x,y])=>enemy(s,x,y,1000));
      s.petParty.step(.03,s.enemies);p.cooldown=99;
      for(let frame=0;frame<65;frame++)s.petParty.step(.03,s.enemies);
      const hits=targets.map(e=>1000-e.hp),expected=id==='windFalcon'?[125,125,0]:[225,0,0];
      check(id+' dash or return blades hit only their shape with fixed damage',JSON.stringify(hits)===JSON.stringify(expected),hits);
      check(id+' attack objects expire and never inherit player statuses',s.petParty.shots.length===0&&targets.every(e=>e.burn===0&&e.slow===0));t.close();
    }
    {
      for(const id of ['thunderDeer','tideWhale']){
        const t=await mount([id]),s=t.s;s.hero.setPosition(195,400);s.petParty.companions[0].sprite.setPosition(155,424);
        s.run.growth.damage=4;for(const u of UPGRADES)s.run.upgrades[u.id]=u.max;
        const positions=id==='thunderDeer'?[[235,424],[275,424],[315,424],[355,424],[355,480]]:[[235,424],[275,424],[355,424]];
        const targets=positions.map(([x,y])=>enemy(s,x,y,1000));for(let frame=0;frame<12;frame++)s.petParty.step(.03,s.enemies);
        const hits=targets.map(e=>1000-e.hp),expected=id==='thunderDeer'?[210,210,210,210,0]:[245,245,0];
        check(id+' fixed chain or target-centered wave matches its marked reach and target limit',JSON.stringify(hits)===JSON.stringify(expected),hits);
        check(id+' never inherits burn, slow or explosions',targets.every(e=>e.burn===0&&e.slow===0)&&s.explosions.length===0);t.close();
      }
    }
    {
      for(const id of ['crimsonDragon','dawnGriffin','dawnStarDragon']){
        const t=await mount([id]),s=t.s;s.hero.setPosition(195,400);s.petParty.companions[0].sprite.setPosition(155,424);
        s.run.growth.damage=4.8;for(const u of UPGRADES)s.run.upgrades[u.id]=u.max;
        // Keep the rear target farther from the autonomous pet than the intended forward target.
        const positions=id==='dawnGriffin'?[[235,424],[300,424],[280,460],[40,424]]:[[235,424],[270,430],[40,424]];
        const targets=positions.map(([x,y])=>enemy(s,x,y,2000));for(let frame=0;frame<12;frame++)s.petParty.step(.03,s.enemies);
        const hits=targets.map(e=>2000-e.hp),expected=id==='crimsonDragon'?[300,300,0]:id==='dawnGriffin'?[330,330,0,0]:[480,480,0];
        check(id+' uses its fixed cone, piercing beam or breath plus burst independently of all bonuses',JSON.stringify(hits)===JSON.stringify(expected),hits);
        check(id+' never transfers player statuses',targets.every(e=>e.burn===0&&e.slow===0));
        s.changePhase('loot');check(id+' clears its visible attacks at loot',s.petParty.effects.length===0&&s.petParty.shots.length===0);t.close();
      }
    }
    {
      const t=await mount(['mossRabbit']),s=t.s,e=enemy(s,210,400,1);s.run.upgrades={ember:3,nova:3,focus:3,cull:3};e.burn=2;
      s.hitPet(e,10);check('pet kill grants normal kills and experience drops without wildfire',s.run.kills===1&&s.drops.length===1&&s.explosions.length===0);
      s.hitPet(e,10);check('dead enemies never duplicate drops or kills',s.run.kills===1&&s.drops.length===1);
      t.close();
    }
    {
      const t=await mount([],'mossRabbit'),s=t.s;s.hero.setPosition(195,330);
      s.tameStep(3);check('circle accumulates seconds',s.tameSeconds===3);s.hero.setPosition(300,500);s.tameStep(2);check('outside reverses at half speed',s.tameSeconds===2);
      s.hitTimer=0;s.hurt(1);check('damage does not remove progress',s.tameSeconds===2);
      s.hero.setPosition(195,330);s.pause();const before=s.tameSeconds;s.update(0,50);check('pause stops progress even if update is called',s.tameSeconds===before);s.resume();
      s.tameStep(6);check('completion pauses and awaits persistence without adding pets',t.events.tame===1&&s.run.pets.length===0&&s.run.petEncounter.state==='available'&&s.savingPet);
      for(let i=0;i<30;i++)s.update(0,50);s.resume();check('failed save stays frozen and does not redispatch',t.events.tame===1&&s.savingPet&&s.paused);
      t.events.accept(['mossRabbit']);check('acknowledged save adds companion and consumes encounter',s.run.pets[0]==='mossRabbit'&&s.run.petEncounter.state==='tamed'&&!s.savingPet);
      t.events.accept(['mossRabbit']);check('duplicate acknowledgement does not add a second pet',s.petParty.companions.length===1);t.close();
      const restarted=await mount([],'mossRabbit');check('unfinished progress restarts at zero with the same encounter',restarted.s.tameSeconds===0&&restarted.s.run.petEncounter.pet==='mossRabbit');restarted.close();
    }
    {
      const t=await mount([],'mossRabbit'),s=t.s;s.hero.setPosition(195,330);s.tameSeconds=7.99;s.clock=200;
      s.hitPet(enemy(s,70,100,1),10);s.update(0,50);
      check('last kill drains remaining loot before completing taming',s.phase==='loot'&&s.drops.length>0&&t.events.tame===0);
      t.close();
    }
    for(const leave of [false,true]){
      const t=await mount([],'emberFox'),s=t.s;s.clock=200;s.run.xp=1000;
      for(let i=0;i<120;i++)s.update(i*50,50);
      check('loot and all upgrades precede taming wait '+leave,s.phase==='taming'&&t.events.upgrade>1&&t.events.complete===0&&s.drops.length===0);
      if(leave){s.leavePet();s.leavePet();}else{s.hero.setPosition(195,330);s.tameStep(12);t.events.accept(['emberFox']);}
      for(let i=0;i<60;i++)s.update(i*50,50);
      check('wait ends with exactly one completion '+leave,t.events.complete===1&&s.phase==='victory');t.close();
    }
    {
      const t=await mount(PET_IDS.slice(0,1),'starDrake'),s=t.s;s.hero.setPosition(195,330);s.tameStep(30);t.events.accept(PET_IDS.slice(0,1));
      check('full party consumes saved encounter without a second companion',s.run.petEncounter.state==='tamed'&&s.petParty.companions.length===1);
      s.petParty.step(.05,[enemy(s,240,330)]);s.changePhase('loot');check('loot clears all pet projectiles and effects',s.petParty.shots.length===0&&s.petParty.effects.length===0);t.close();
    }
    const pressure=[];
    for(const count of [0,1]){
      const t=await mount(['emberFox','frostOwl','starDrake'].slice(0,count)),s=t.s;
      for(let i=0;i<160;i++)enemy(s,25+i%16*22,70+Math.floor(i/16)*50,1e8);
      const durations=[];let peak=0;
      s.hurt=()=>{};s.clock=0;
      for(let i=0;i<300;i++){const start=performance.now();s.update(i*1000/30,1000/30);durations.push(performance.now()-start);peak=Math.max(peak,s.petParty.shots.length);}
      pressure.push({pets:count,enemies:s.enemies.length,updateMsP95:durations.sort((a,b)=>a-b)[Math.floor(durations.length*.95)],peakPetProjectiles:peak});
      check(count+' pets preserve the 160 enemy cap and bounded projectiles',s.enemies.length===160&&peak<=24);t.close();
    }
    return {checks,pressure};
  });
  const rendering=await page.evaluate(async()=>{
    const {mountArena}=await import('/src/arena.ts'),{initialSave,createRun,UPGRADES}=await import('/src/core.ts');
    const reports=[];
    for(const count of [0,1]){
      const save=initialSave(),run=createRun(save.profile,0,'staff','normal',42);run.pets=['emberFox','frostOwl','starDrake'].slice(0,count);
      for(const u of UPGRADES)run.upgrades[u.id]=u.max;
      const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
      let ready;const loaded=new Promise(resolve=>ready=resolve);
      const arena=mountArena(host,run,{hud(){ready();},upgrade(){},complete(){},defeat(){},paused(){}});await loaded;
      const s=arena.scene;s.spawnTimer=1e6;s.hurt=()=>{};
      for(let i=0;i<160;i++){s.spawnEnemy(0,25+i%16*22,70+Math.floor(i/16)*50);const e=s.enemies.at(-1);e.hp=e.max=1e8;e.speed=0;}
      const intervals=[];let last=0,frames=0;
      await new Promise(resolve=>{const frame=now=>{if(last&&frames>60)intervals.push(now-last);last=now;frames++;if(frames<301)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
      intervals.sort((a,b)=>a-b);reports.push({pets:count,enemies:160,renderer:arena.game.renderer.type,samples:intervals.length,frameIntervalP50:intervals[Math.floor(intervals.length*.5)],frameIntervalP95:intervals[Math.floor(intervals.length*.95)],petProjectiles:s.petParty.shots.length});
      arena.game.destroy(true);host.remove();
    }
    return reports;
  });
  await mkdir('artifacts/pets',{recursive:true});
  const sources=Object.fromEntries(await Promise.all(['src/arena.ts','src/core.ts','src/pets.ts','src/pet-arena.ts'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
  await writeFile('artifacts/pets/arena-report.json',JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources,...result,rendering,errors,limitations:['CPU update timing and requestAnimationFrame intervals in desktop Chromium; not GPU timing, battery/thermal or phone hardware. Rendering stress uses stationary high-health enemies and disabled player damage.']},null,2));
  assert.deepEqual(result.checks.filter(c=>!c.ok),[]);assert.deepEqual(errors,[]);console.log(`Passed ${result.checks.length} pet scene checks.`,result.pressure);
}finally{await browser.close();await server.close();}
