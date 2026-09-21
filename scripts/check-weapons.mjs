import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const hash=value=>createHash('sha256').update(value).digest('hex');
const files=(await readdir('src',{recursive:true})).filter(file=>file.endsWith('.ts')).map(file=>'src/'+file.replaceAll('\\','/')).sort();
const sources=Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await readFile(file))])));
const withUpgrades=process.argv.includes('--upgrades');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:430,height:840},isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto('http://localhost:5173/');
  const served=await page.evaluate(async paths=>Promise.all(paths.map(async file=>[file,await fetch('/'+file+'?raw').then(r=>r.text()).then(text=>text.startsWith('export default ')?JSON.parse(text.split('\n')[0].slice(15).replace(/;$/, '')):text)])),files);
  for(const [file,source] of served)assert.equal(hash(source),sources[file],file+' comes from this worktree');
  const results=await page.evaluate(async withUpgrades=>{
    const {mountArena}=await import('/src/arena.ts');
    const {initialSave,createRun,WEAPONS,EVOLUTIONS}=await import('/src/core.ts');
    document.querySelector('#app').remove();
    const results=[],closeEnough=(a,b)=>Math.abs(a-b)<1e-6;
    const check=(test,ok,details)=>results.push({test,ok,...details});
    async function mount(weapon,upgrades={}){
      const profile=initialSave().profile;profile.facilities.forge=WEAPONS[weapon].requiredForge;
      const run=createRun(profile,0,weapon,'normal',8);run.upgrades=upgrades;
      const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
      let loaded;const ready=new Promise(resolve=>loaded=resolve);
      const events={complete:0,defeat:0};
      const arena=mountArena(host,run,{hud(){loaded();},upgrade(){throw Error('Unexpected upgrade in isolated weapon check');},paused(){},complete(){events.complete++;},defeat(){events.defeat++;}});
      await ready;arena.game.loop.stop();
      const s=arena.scene;s.spawnTimer=10000;s.attackTimer=10000;s.random=()=>.99;s.hero.setPosition(195,330);
      const enemy=(x=265,y=330)=>{s.spawnEnemy(0,x,y);const e=s.enemies.at(-1);e.hp=e.max=10000;e.speed=0;e.attack=10000;return e;};
      const step=(seconds,fps=60)=>{for(let frame=0;frame<Math.round(seconds*fps);frame++)s.update(frame*1000/fps,1000/fps);};
      return {s,enemy,step,events,close(){arena.game.runDestroy();host.remove();}};
    }
    for(const fps of [30,60])for(const evolved of [false,true]){
      const t=await mount('boomerang',evolved?EVOLUTIONS.boomerang.requires:{}),{s}=t,e=t.enemy();
      s.autoAttack();t.step(3.2,fps);
      const expected=18*1.24*(evolved?2.6*3:2);
      check(`boomerang ${fps} FPS ${evolved?'evolved':'base'} hits once on each leg and returns`,closeEnough(10000-e.hp,expected)&&s.shots.length===0,{damage:10000-e.hp,expected});t.close();
    }
    {
      const t=await mount('boomerang',{split:3}),{s}=t;t.enemy();s.autoAttack();
      check('split emits four independent boomerangs',s.shots.length===4&&new Set(s.shots.map(shot=>Math.atan2(shot.dy,shot.dx).toFixed(4))).size===4);t.close();
    }
    for(const pierce of [0,2]){
      const t=await mount('boomerang',{pierce}),{s}=t;
      s.hero.setPosition(40,330);const targets=Array.from({length:9},(_,i)=>t.enemy(80+i*18,330));
      s.autoAttack();t.step(3.2);
      const damage=targets.reduce((sum,e)=>sum+10000-e.hp,0),expected=18*1.24*2*(3+pierce);
      check(`boomerang pierce ${pierce} caps each leg without raising damage`,closeEnough(damage,expected),{damage,expected});t.close();
    }
    {
      const t=await mount('boomerang'),{s}=t;t.enemy();s.autoAttack();
      for(let frame=0;frame<180&&s.shots.length;frame++){if(frame===20)s.hero.setPosition(80,450);s.projectileStep(1/60);}
      check('returning boomerang follows a moving hero and expires',s.shots.length===0);t.close();
    }
    {
      const t=await mount('boomerang',{reach:3}),{s}=t;t.enemy();s.autoAttack();
      const shot=s.shots[0],start={x:shot.x,y:shot.y};
      while(shot.flight.remaining>0)s.projectileStep(1/60);
      check('reach extends the outgoing path beyond screen edges before returning',closeEnough(Math.hypot(shot.x-start.x,shot.y-start.y),220*1.54)&&shot.sprite.active);
      t.step(3);check('offscreen boomerangs return without leaving projectiles behind',s.shots.length===0);t.close();
    }
    {
      const t=await mount('hammer'),{s}=t,moving=t.enemy();s.autoAttack();moving.sprite.setPosition(340,120);
      const atImpact=t.enemy();s.run.upgrades.power=5;t.step(.2);
      const warned=atImpact.hp===10000;t.step(.05);
      check('hammer locks position, waits 0.24s and snapshots cast damage',warned&&moving.hp===10000&&closeEnough(10000-atImpact.hp,48*1.32));t.close();
    }
    {
      const t=await mount('hammer',{...EVOLUTIONS.hammer.requires,focus:3,ember:1,frost:1,...(withUpgrades?{cull:3}:{})}),{s}=t,e=t.enemy();
      e.hp=1000;s.random=()=>0;s.autoAttack();t.step(.25);
      const main=1000-e.hp,expected=48*1.32*1.6;
      check(`hammer main hit applies ${withUpgrades?'cull, ':''}crit and direct statuses`,closeEnough(main,expected*(withUpgrades?1.45:1)*2)&&e.burn>0&&e.slow>0);
      e.burn=e.slow=0;const before=e.hp;t.step(.2);
      check('hammer echo is half uncritical cast damage without cull or statuses',closeEnough(before-e.hp,expected*.5)&&e.burn===0&&e.slow<=0);t.close();
    }
    for(const fps of [30,60])for(const evolved of [false,true]){
      const upgrades={reach:2,split:3,...(evolved?{power:3}:{})};
      const t=await mount('hammer',upgrades),{s}=t;s.hero.setPosition(40,330);
      const target=t.enemy(140,330),radius=58*1.36*1.36*(evolved?1.2:1);
      const inside=t.enemy(140+radius-1,330),outside=t.enemy(140+radius+1,330);
      s.autoAttack();t.step(.7,fps);
      const expected=48*1.32*(evolved?1.6*1.5:1);
      check(`hammer ${fps} FPS ${evolved?'evolved':'base'} applies reach and split to the actual hit radius`,closeEnough(10000-target.hp,expected)&&closeEnough(10000-inside.hp,expected)&&outside.hp===10000&&s.pendingHammer===null);t.close();
    }
    for(const weapon of ['boomerang','hammer']){
      const t=await mount(weapon),{s}=t;s.hero.setPosition(40,330);t.enemy(370,330);s.autoAttack();
      check(`${weapon} does not cast outside its targeting range`,s.shots.length===0&&s.pendingHammer===null);t.close();
    }
    for(const weapon of ['boomerang','hammer']){
      const t=await mount(weapon),{s}=t,e=t.enemy();s.autoAttack();
      const clock=s.clock,shot=s.shots[0],x=shot?.x,remaining=s.pendingHammer?.remaining;
      s.pause();s.game.loop.start(s.game.step.bind(s.game));await new Promise(resolve=>setTimeout(resolve,300));s.game.loop.stop();
      check(`${weapon} pause freezes outstanding attacks and damage`,s.clock===clock&&shot?.x===x&&s.pendingHammer?.remaining===remaining&&e.hp===10000);
      s.resume();t.step(.5);check(`${weapon} resumes its pending attack`,e.hp<10000);t.close();
    }
    for(const weapon of ['staff','blade','halo','boomerang','hammer']){
      const t=await mount(weapon,{power:2,pierce:3,storm:1}),{s}=t,e=t.enemy(350,330);s.stormTimer=0;s.skills(0);
      const base=weapon==='blade'?30:18,pierceBonus=['blade','halo'].includes(weapon)?.45:0;
      const expected=base*(1+WEAPONS[weapon].requiredForge*.08)*(1.4+pierceBonus)*1.6;
      check(`${weapon} retains the agreed automatic-skill damage base`,closeEnough(10000-e.hp,expected),{damage:10000-e.hp,expected});t.close();
    }
    for(const weapon of ['staff','boomerang','hammer']){
      const t=await mount(weapon,{...EVOLUTIONS[weapon].requires}),{s}=t,primary=t.enemy(250,330),nearby=t.enemy(285,330);
      s.shoot(250,318,0,0,10,false,'fire');s.projectileStep(0);
      check(`${weapon} fire artwork only triggers staff-owned evolution splash`,primary.hp===9990&&closeEnough(10000-nearby.hp,weapon==='staff'?4.5:0));t.close();
    }
    for(const weapon of ['boomerang','hammer'])for(const end of ['loot','defeat']){
      const t=await mount(weapon),{s}=t,e=t.enemy();s.autoAttack();
      if(end==='loot')s.changePhase('loot');else{s.run.hp=1;s.hurt(10000);}
      const hp=e.hp;t.step(3.2);
      check(`${weapon} clears outstanding damage on ${end}`,e.hp===hp&&s.shots.every(shot=>!shot.sprite.active)&&t.events.defeat===(end==='defeat'?1:0));t.close();
    }
    return results;
  },withUpgrades);
  for(const file of files)assert.equal(hash(await readFile(file)),sources[file],file+' remains fixed during checks');
  await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/weapons-report.json',JSON.stringify({sources,results},null,2));
  for(const result of results)assert.ok(result.ok,result.test+' '+JSON.stringify(result));
  assert.deepEqual(errors,[]);
  console.log(`PASS ${results.length} weapon scene checks`);
}finally{await browser.close();}
