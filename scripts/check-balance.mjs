import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const hash=value=>createHash('sha256').update(value).digest('hex');
const files=(await readdir('src',{recursive:true})).filter(file=>file.endsWith('.ts')).map(file=>'src/'+file.replaceAll('\\','/')).sort();
const sources=Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await readFile(file))])));

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:430,height:840},isMobile:true,hasTouch:true});
const reports=[];
const expanded=process.argv.includes('--weapons');
const cases=[];
for(const weapon of expanded?['boomerang','hammer']:['staff','blade','halo'])for(const archive of [0,3])for(const seed of [1,8,12,42])cases.push({weapon,archive,seed,build:'focus'});
if(expanded)for(const weapon of ['boomerang','hammer'])for(const build of process.argv.includes('--upgrades')?['froststorm','wildfire','meteor']:['froststorm','wildfire'])for(const seed of [1,8,12,42])cases.push({weapon,archive:3,seed,build});
try{
  await page.goto('http://localhost:5173/');
  const served=await page.evaluate(async paths=>Promise.all(paths.map(async file=>[file,await fetch('/'+file+'?raw').then(r=>r.text()).then(text=>text.startsWith('export default ')?JSON.parse(text.split('\n')[0].slice(15).replace(/;$/, '')):text)])),files);
  for(const [file,source] of served)assert.equal(hash(source),sources[file],file+' comes from this worktree');
  await page.evaluate(()=>document.querySelector('#app').remove());
  for(const input of cases){
    const report=await page.evaluate(async({weapon,archive,seed,build})=>{
      const {mountArena}=await import('/src/arena.ts');
      const {initialSave,createRun,finishRoom,upgradeChoices,isEvolved,validateSave,WEAPONS,EVOLUTIONS}=await import('/src/core.ts');
      const save=initialSave();save.profile.facilities={forge:WEAPONS[weapon].requiredForge,beacon:0,archive};
      const required=build==='froststorm'?{storm:2,frost:2}:build==='wildfire'?{ember:2,nova:2}:build==='meteor'?{meteor:3}:{};
      const picks=[];
      let run=createRun(save.profile,0,weapon,'normal',seed),evolutionRoom=null,bossEntry=null;
      const rooms=[];
      for(let room=0;room<7;room++){
        if(room===6)bossEntry=structuredClone(run);
        const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
        let ready,complete=false,defeat=false,upgrades=0;
        const loaded=new Promise(resolve=>ready=resolve);
        const arena=mountArena(host,run,{
          hud(){ready();},paused(){},
          upgrade(r,choose){
            upgrades++;const choices=upgradeChoices(r);
            const needed=Object.entries({...EVOLUTIONS[weapon].requires,...required}).filter(([id,n])=>(r.upgrades[id]??0)<n).map(([id])=>id);
            const desired=[...Object.keys(required),...needed].find(id=>needed.includes(id)&&choices.some(u=>u.id===id));
            const choice=build==='focus'?choices[0]:choices.find(u=>u.id===desired)??choices[0];
            picks.push({room:room+1,offered:choices.map(u=>u.id),chosen:choice.id});choose(choice.id);
          },
          complete(){complete=true;},defeat(){defeat=true;},
        });
        await loaded;arena.game.loop.stop();
        const s=arena.scene;
        let peak=0,emptyFrames=0,combatFrames=0;
        for(let frame=0;frame<30*180&&!complete&&!defeat;frame++){
          // Choose a safe direction from visible enemies/projectiles, using only normal movement.
          const enemies=s.enemies.filter(e=>e.hp>0),near=(a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y);
          const goal=enemies.filter(e=>e.type===3||e.type===4).map(e=>e.sprite).sort(near)[0]??s.drops.map(d=>d.sprite).sort(near)[0]??enemies.map(e=>e.sprite).sort(near)[0]??{x:195,y:330};
          let best=Infinity,direction={x:0,y:0};
          for(let i=-1;i<12;i++){
            const dx=i<0?0:Math.cos(i*Math.PI/6),dy=i<0?0:Math.sin(i*Math.PI/6);
            let score=i<0?0:.1;
            for(const time of [.15,.4]){
              const x=s.hero.x+dx*128*time,y=s.hero.y+dy*128*time;
              score+=Math.hypot(x-goal.x,y-goal.y)*.005;
              score+=Math.max(0,45-x,x-345,90-y,y-575)*5;
              for(const q of [{x:69,y:265},{x:319,y:345}])score+=Math.max(0,35-Math.hypot(x-q.x,y-q.y))**2;
              for(const e of enemies){
                const length=Math.hypot(s.hero.x-e.sprite.x,s.hero.y-e.sprite.y)||1;
                const charging=e.charge>0||((e.type===2||e.type===6)&&e.windup>0);
                const ex=e.sprite.x+(charging?e.dx*235:(s.hero.x-e.sprite.x)/length*e.speed)*time;
                const ey=e.sprite.y+(charging?e.dy*235:(s.hero.y-e.sprite.y)/length*e.speed)*time;
                score+=Math.max(0,e.radius+28-Math.hypot(x-ex,y-ey))**2/10;
              }
              for(const shot of s.shots)if(shot.hostile)score+=Math.max(0,30-Math.hypot(x-shot.x-shot.dx*time,y-13-shot.y-shot.dy*time))**2/5;
            }
            if(score<best){best=score;direction={x:dx,y:dy};}
          }
          s.pointer={x:195,y:330,input:{x:195+direction.x*42,y:330+direction.y*42,isDown:true}};
          s.update(frame*1000/30,1000/30);
          const count=s.enemies.filter(e=>e.hp>0).length;peak=Math.max(peak,count);
          if(s.phase==='fighting'||s.phase==='finalWave'){combatFrames++;if(!count)emptyFrames++;}
          if(!evolutionRoom&&isEvolved(s.run))evolutionRoom=room+1;
        }
        const finished=s.getRun();
        rooms.push({room:room+1,complete,defeat,upgrades,level:finished.level,kills:finished.kills-run.kills,hp:Math.round(finished.hp),seconds:Math.round(s.clock*10)/10,peak,emptyRatio:combatFrames?emptyFrames/combatFrames:0});
        arena.game.runDestroy();host.remove();
        if(!complete)break;
        save.run=finishRoom(finished);run=validateSave(JSON.parse(JSON.stringify(save))).run;
      }
      return {weapon,archive,seed,build,evolutionRoom,rooms,picks,bossEntry,upgrades:run.upgrades,buildComplete:Object.entries(required).every(([id,n])=>(run.upgrades[id]??0)>=n)};
    },input);
    reports.push(report);
    console.log(`${input.weapon} archive=${input.archive} seed=${input.seed} ${input.build}: ${report.rooms.filter(r=>r.complete).length}/7 rooms, evolution=${report.evolutionRoom}, build=${report.buildComplete}`);
  }
  await mkdir('artifacts',{recursive:true});
  for(const file of files)assert.equal(hash(await readFile(file)),sources[file],file+' remains fixed during measurement');
  await writeFile(expanded?'artifacts/weapons-balance-sources.json':'artifacts/balance-sources.json',JSON.stringify(sources,null,2));
  await writeFile(expanded?'artifacts/weapons-balance-report.json':'artifacts/balance-report.json',JSON.stringify(reports,null,2));
  for(const r of reports){
    const label=`${r.weapon} archive=${r.archive} seed=${r.seed} ${r.build}`;
    if(expanded){
      assert.ok(r.rooms.every(room=>room.complete||room.defeat),label+' ends each room without a stall');
      assert.ok(r.rooms.every(room=>room.peak<=160),label+' respects enemy cap');
      if(r.evolutionRoom&&r.build==='focus')assert.ok(r.evolutionRoom>=4&&r.evolutionRoom<=5,label+' evolves in room four or five');
      continue;
    }
    assert.equal(r.rooms.length,7,label+' reaches room seven');
    assert.ok(r.rooms.every(room=>room.complete&&!room.defeat),label+' clears all rooms with normal movement and damage');
    if(r.build==='focus')assert.ok(r.evolutionRoom>=4&&r.evolutionRoom<=5,label+' evolves in room four or five');
    else assert.ok(r.evolutionRoom!==null&&r.buildComplete,label+' earns the evolved representative build from offered upgrades');
    assert.ok(r.rooms[0].upgrades<=1,label+' first room cannot rush evolution');
    assert.ok(r.rooms.every(room=>room.peak<=160),label+' respects enemy cap');
    assert.ok(r.rooms[5].kills>r.rooms[2].kills&&r.rooms[6].kills>r.rooms[5].kills,label+' late rooms supply more kills');
    assert.ok(r.rooms.slice(5).every(room=>room.emptyRatio<.1),label+' late rooms keep targets available');
    assert.ok(r.rooms.every(room=>room.seconds<180),label+' does not stall in cleanup');
  }
  if(expanded){
    for(const weapon of ['boomerang','hammer'])for(const archive of [0,3])assert.ok(reports.some(r=>r.weapon===weapon&&r.archive===archive&&r.build==='focus'&&r.rooms.length===7&&r.rooms.every(room=>room.complete)),`${weapon} archive=${archive} has a full low-camp clear`);
    console.log(JSON.stringify({cases:reports.length,clears:reports.filter(r=>r.rooms.length===7&&r.rooms.every(room=>room.complete)).length,defeats:reports.filter(r=>r.rooms.some(room=>room.defeat)).length,earnedBuilds:reports.filter(r=>r.build!=='focus'&&r.buildComplete).length}));
    console.log('PASS no-stall, enemy-cap and representative-clear checks; see the report for defeats and incomplete builds');
  }else console.log('PASS full seven-room balance across three weapons, two camp profiles and four seeds');
}finally{await browser.close();}
