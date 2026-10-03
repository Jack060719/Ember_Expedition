import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const hash=value=>createHash('sha256').update(value).digest('hex');
const files=(await readdir('src',{recursive:true})).filter(file=>file.endsWith('.ts')).map(file=>'src/'+file.replaceAll('\\','/')).sort();
const sources=Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await readFile(file))])));

const reports=[];
const expanded=process.argv.includes('--weapons');
const matrix=process.argv.includes('--matrix');
const baseline=process.argv.includes('--baseline');
const driverHash=hash((await readFile('scripts/check-balance.mjs','utf8')).replaceAll('\r\n','\n'));
const reportPath=matrix?`artifacts/task-005/full-${baseline?'before':'after'}.json`:expanded?'artifacts/weapons-balance-report.json':'artifacts/balance-report.json';
const before=matrix&&!baseline?JSON.parse(await readFile('artifacts/task-005/full-before.json','utf8')):null;
if(before){assert.ok(!before.pending,'The baseline measurement must finish first');assert.equal(driverHash,before.driverHash,'Use the frozen baseline driver for the comparison');}
const cases=[];
if(matrix){
  const weapons=['staff','blade','halo','boomerang','hammer'],characters=['keeper','scout','warden'];
  for(const [ci,character] of characters.entries())for(const [wi,weapon] of weapons.entries()){
    for(let chapter=0;chapter<3;chapter++)for(const difficulty of ['normal','hard']){
      for(const build of ['focus',['froststorm','wildfire','meteor'][(ci+wi+chapter)%3]])cases.push({weapon,character,archive:3,seed:8,build,mission:chapter*2+1,difficulty,camp:'low'});
    }
    for(const difficulty of ['normal','hard'])cases.push({weapon,character,archive:3,seed:12,build:'survival',mission:((ci+wi)%3)*2+1,difficulty,camp:'low'});
    cases.push({weapon,character,archive:0,seed:42,build:'focus',mission:0,difficulty:'normal',camp:'low'});
  }
  for(const camp of [10,20])for(const weapon of weapons)for(let chapter=0;chapter<3;chapter++)for(const difficulty of ['normal','hard'])cases.push({weapon,character:'keeper',archive:camp,forge:camp,beacon:camp,seed:8,build:'focus',mission:chapter*2+1,difficulty,camp:`all-${camp}`});
}else{
  for(const weapon of expanded?['boomerang','hammer']:['staff','blade','halo'])for(const archive of [0,3])for(const seed of [1,8,12,42])cases.push({weapon,archive,seed,build:'focus'});
  if(expanded)for(const weapon of ['boomerang','hammer'])for(const build of process.argv.includes('--upgrades')?['froststorm','wildfire','meteor']:['froststorm','wildfire'])for(const seed of [1,8,12,42])cases.push({weapon,archive:3,seed,build});
}
if(before)assert.deepEqual(cases,before.cases,'Before and after use identical cases');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:430,height:840},isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const metadata={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktree:process.cwd(),node:process.version,browser:browser.version(),
  branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),status:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim(),
  createdAt:new Date().toISOString(),sources,driverHash,driverHashMode:'LF-normalized',cases,scope:'Full expeditions, naturally offered upgrades; no entry transfer or upgrade redistribution.'};
try{
  if(matrix){await mkdir('artifacts/task-005',{recursive:true});if(baseline)await writeFile(reportPath,JSON.stringify({...metadata,pending:true}),{flag:'wx'});}
  await page.goto('http://localhost:5173/');
  metadata.saveVersion=await page.evaluate(async()=>(await import('/src/core.ts')).initialSave().version);
  const served=await page.evaluate(async paths=>Promise.all(paths.map(async file=>[file,await fetch('/'+file+'?raw').then(r=>r.text()).then(text=>text.startsWith('export default ')?JSON.parse(text.split('\n')[0].slice(15).replace(/;$/, '')):text)])),files);
  for(const [file,source] of served)assert.equal(hash(source),sources[file],file+' comes from this worktree');
  await page.evaluate(()=>document.querySelector('#app').remove());
  for(const input of cases){
    const report=await page.evaluate(async({input,matrix})=>{
      const {weapon,archive,seed,build,character='keeper',mission=0,difficulty='normal',forge,beacon=0}=input;
      const {mountArena}=await import('/src/arena.ts');
      const {initialSave,createRun,finishRoom,upgradeChoices,isEvolved,validateSave,WEAPONS,EVOLUTIONS,SYNERGIES,hasSynergy}=await import('/src/core.ts');
      const save=initialSave();save.profile.cleared=matrix?6:0;save.profile.facilities={forge:forge??WEAPONS[weapon].requiredForge,beacon,archive};
      const required=build==='froststorm'?{storm:2,frost:2}:build==='wildfire'?{ember:2,nova:2}:build==='meteor'?{meteor:3}:build==='survival'?{ward:2,resolve:2,cull:2}:{};
      const picks=[];
      let run=createRun(save.profile,mission,weapon,difficulty,seed,character),evolutionRoom=null,bossEntry=null,finalRun=run,buildRoom=null;
      const synergyRooms={},starting=structuredClone(run);
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
            picks.push({room:room+1,level:r.level,offered:choices.map(u=>u.id),chosen:choice.id});choose(choice.id);
          },
          complete(){complete=true;},defeat(){defeat=true;},
        });
        await loaded;arena.game.loop.stop();
        const s=arena.scene;
        let peak=0,emptyFrames=0,combatFrames=0,damage=0,hits=0,healing=0,bossSeconds=null;
        const hurt=s.hurt.bind(s);
        s.hurt=amount=>{
          const hp=s.run.hp,revived=s.run.secondWindUsed;
          hurt(amount);
          if(!revived&&s.run.secondWindUsed){damage+=hp;healing+=s.run.hp;hits++;}
          else if(s.run.hp<hp){damage+=hp-s.run.hp;hits++;}
        };
        for(let frame=0;frame<30*180&&!complete&&!defeat;frame++){
          // Choose a safe direction from visible enemies/projectiles, using only normal movement.
          const enemies=s.enemies.filter(e=>e.hp>0),near=(a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y);
          const goal=enemies.filter(e=>e.type===3||e.type===4).map(e=>e.sprite).sort(near)[0]??s.drops.map(d=>d.sprite).sort(near)[0]??enemies.map(e=>e.sprite).sort(near)[0]??{x:195,y:330};
          let best=Infinity,direction={x:0,y:0};
          for(let i=-1;i<12;i++){
            const dx=i<0?0:Math.cos(i*Math.PI/6),dy=i<0?0:Math.sin(i*Math.PI/6);
            let score=i<0?0:.1;
            for(const time of [.15,.4]){
              const speed=128*(matrix?1+(s.run.upgrades.stride??0)*.12:1),x=s.hero.x+dx*speed*time,y=s.hero.y+dy*speed*time;
              score+=Math.hypot(x-goal.x,y-goal.y)*.005;
              score+=Math.max(0,45-x,x-345,90-y,y-575)*5;
              for(const q of [{x:69,y:265},{x:319,y:345}])score+=Math.max(0,35-Math.hypot(x-q.x,y-q.y))**2;
              for(const e of enemies){
                const length=Math.hypot(s.hero.x-e.sprite.x,s.hero.y-e.sprite.y)||1;
                const charging=e.charge>0||((e.type===2||e.type===6)&&e.windup>0);
                const ex=e.sprite.x+(charging?e.dx*235:(s.hero.x-e.sprite.x)/length*e.speed)*time;
                const ey=e.sprite.y+(charging?e.dy*235:(s.hero.y-e.sprite.y)/length*e.speed)*time;
                score+=Math.max(0,e.radius+28-Math.hypot(x-ex,y-ey))**2/10;
                if(matrix&&e.type===7&&e.windup>0&&e.boss.action==='eruption')score+=Math.max(0,65-Math.hypot(x-e.dx,y-e.dy))**2/5;
              }
              for(const shot of s.shots)if(shot.hostile)score+=Math.max(0,30-Math.hypot(x-shot.x-shot.dx*time,y-13-shot.y-shot.dy*time))**2/5;
            }
            if(score<best){best=score;direction={x:dx,y:dy};}
          }
          s.pointer={x:195,y:330,input:{x:195+direction.x*42,y:330+direction.y*42,isDown:true}};
          const hp=s.run.hp,damageBefore=damage,healingBefore=healing,boss=enemies.find(e=>e.type>=6);
          s.update(frame*1000/30,1000/30);
          healing=healingBefore+Math.max(0,s.run.hp-hp+damage-damageBefore);
          if(boss?.hp<=0&&bossSeconds===null)bossSeconds=s.clock;
          const count=s.enemies.filter(e=>e.hp>0).length;peak=Math.max(peak,count);
          if(s.phase==='fighting'||s.phase==='finalWave'){combatFrames++;if(!count)emptyFrames++;}
          if(!evolutionRoom&&isEvolved(s.run))evolutionRoom=room+1;
          for(const synergy of SYNERGIES)if(!synergyRooms[synergy.id]&&hasSynergy(s.run,synergy.id))synergyRooms[synergy.id]=room+1;
          if(!buildRoom&&Object.keys(required).length&&Object.entries(required).every(([id,n])=>(s.run.upgrades[id]??0)>=n))buildRoom=room+1;
        }
        const finished=s.getRun();finalRun=finished;
        const round=n=>n===null?null:Math.round(n*100)/100;
        rooms.push({room:room+1,complete,defeat,upgrades,level:finished.level,kills:finished.kills-run.kills,hp:Math.round(finished.hp),seconds:Math.round(s.clock*10)/10,peak,emptyRatio:combatFrames?emptyFrames/combatFrames:0,
          damage:round(damage),healing:round(healing),hits,bossSeconds:round(bossSeconds),entryHp:run.hp,exitUpgrades:finished.upgrades});
        arena.game.runDestroy();host.remove();
        if(!complete)break;
        save.run=finishRoom(finished);run=validateSave(JSON.parse(JSON.stringify(save))).run;
      }
      return {...input,character,mission,chapter:Math.floor(mission/2)+1,difficulty,facilities:save.profile.facilities,starting,evolutionRoom,synergyRooms,buildRoom,rooms,picks,bossEntry,upgrades:finalRun.upgrades,buildComplete:Object.entries(required).every(([id,n])=>(finalRun.upgrades[id]??0)>=n)};
    },{input,matrix});
    reports.push(report);
    console.log(`${reports.length}/${cases.length} ${report.character} ${input.weapon} chapter=${report.chapter} ${report.difficulty} archive=${input.archive} seed=${input.seed} ${input.build}: ${report.rooms.filter(r=>r.complete).length}/7 rooms, evolution=${report.evolutionRoom}, build=${report.buildComplete}`);
  }
  await mkdir('artifacts',{recursive:true});
  for(const file of files)assert.equal(hash(await readFile(file)),sources[file],file+' remains fixed during measurement');
  await writeFile(expanded?'artifacts/weapons-balance-sources.json':'artifacts/balance-sources.json',JSON.stringify(sources,null,2));
  assert.equal(hash((await readFile('scripts/check-balance.mjs','utf8')).replaceAll('\r\n','\n')),driverHash,'Driver stays fixed during measurement');
  await writeFile(reportPath,JSON.stringify(matrix?{...metadata,errors,reports}:reports,null,2));
  assert.deepEqual(errors,[],'No browser errors');
  for(const r of reports){
    const label=`${r.weapon} archive=${r.archive} seed=${r.seed} ${r.build}`;
    if(expanded||matrix){
      assert.ok(r.rooms.every(room=>room.complete||room.defeat),label+' ends each room without a stall');
      assert.ok(r.rooms.every(room=>room.peak<=160),label+' respects enemy cap');
      if(r.evolutionRoom&&r.build==='focus'&&(!matrix||r.camp==='low'&&r.chapter===1&&r.difficulty==='normal'))assert.ok(r.evolutionRoom>=4&&r.evolutionRoom<=5,label+' evolves in room four or five');
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
  if(matrix){
    for(const chapter of [1,2,3])for(const difficulty of ['normal','hard']){
      const group=reports.filter(r=>r.chapter===chapter&&r.difficulty===difficulty);
      console.log(JSON.stringify({chapter,difficulty,cases:group.length,clears:group.filter(r=>r.rooms.filter(room=>room.complete).length===7).length,earnedSynergies:group.filter(r=>Object.keys(r.synergyRooms).length).length}));
    }
    console.log('PASS measurement integrity, no-stall and enemy-cap checks; defeats and incomplete builds remain in the report');
  }else if(expanded){
    for(const weapon of ['boomerang','hammer'])for(const archive of [0,3])assert.ok(reports.some(r=>r.weapon===weapon&&r.archive===archive&&r.build==='focus'&&r.rooms.length===7&&r.rooms.every(room=>room.complete)),`${weapon} archive=${archive} has a full low-camp clear`);
    console.log(JSON.stringify({cases:reports.length,clears:reports.filter(r=>r.rooms.length===7&&r.rooms.every(room=>room.complete)).length,defeats:reports.filter(r=>r.rooms.some(room=>room.defeat)).length,earnedBuilds:reports.filter(r=>r.build!=='focus'&&r.buildComplete).length}));
    console.log('PASS no-stall, enemy-cap and representative-clear checks; see the report for defeats and incomplete builds');
  }else console.log('PASS full seven-room balance across three weapons, two camp profiles and four seeds');
}finally{await browser.close();}
