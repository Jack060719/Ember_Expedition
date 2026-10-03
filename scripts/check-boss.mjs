import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const current=process.argv.includes('--current');
const baseline=current||process.argv.includes('--baseline');
await mkdir('artifacts',{recursive:true});
const before=baseline?null:JSON.parse(await readFile('artifacts/boss-baseline.json','utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourceFiles=(await readdir('src',{recursive:true})).filter(file=>file.endsWith('.ts')).map(file=>'src/'+file.replaceAll('\\','/')).sort();
const sources=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,hash(await readFile(file))])));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:430,height:840},isMobile:true,hasTouch:true});
const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,browser:browser.version(),
  branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),worktree:process.cwd(),
  status:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim(),sources,sourceHash:hash(JSON.stringify(sources)),arenaHash:sources['src/arena.ts'],
  driverHash:hash(await readFile('scripts/check-boss.mjs')),saveVersion:null,checkpoints:[],preparation:[],results:[]};
try{
  await page.goto('http://localhost:5173/');
  const served=await page.evaluate(async files=>Promise.all(files.map(async file=>[file,await fetch('/'+file+'?raw').then(r=>r.text()).then(text=>text.startsWith('export default ')?JSON.parse(text.split('\n')[0].slice(15).replace(/;$/, '')):text)])),sourceFiles);
  for(const [file,source] of served)assert.equal(hash(source),sources[file],file+' is served from the measured worktree');
  report.saveVersion=await page.evaluate(async()=>{
    const {mountArena}=await import('/src/arena.ts');
    const {initialSave,createRun,finishRoom,upgradeChoices,isEvolved,validateSave}=await import('/src/core.ts');
    document.querySelector('#app').remove();
    window.bossCheck=async(input,prepare=false)=>{
      const save=initialSave();save.profile.cleared=6;
      if(prepare)save.profile.facilities=input.facilities;
      if(!prepare)save.profile.facilities={forge:20,beacon:20,archive:20};
      let run=prepare?createRun(save.profile,input.chapter*2+1,input.weapon,'normal',input.seed):validateSave({...save,version:input.saveVersion,run:input.run}).run;
      const rooms=[];let evolutionRoom=null;
      for(let room=run.room;room<(prepare?6:7);room++){
        const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
        let ready,complete=false,defeat=false;
        const loaded=new Promise(resolve=>ready=resolve);
        const arena=mountArena(host,run,{hud(){ready();},paused(){},upgrade(r,choose){choose(upgradeChoices(r)[0].id);},complete(){complete=true;},defeat(){defeat=true;}});
        await loaded;arena.game.loop.stop();
        const s=arena.scene;
        let damage=0,hits=0,minHp=run.hp,peak=0,projectiles=0,windups=0,halfAt=null,bossKilledAt=null,hostilePeak=0;
        const hurt=s.hurt.bind(s);
        s.hurt=amount=>{
          if(s.hitTimer<=0&&!s.finished&&s.phase!=='loot'&&s.phase!=='victory'){
            const resolve=s.run.hp<=s.run.maxHp*.35?1-(s.run.upgrades.resolve??0)*.1:1;
            damage+=Math.min(s.run.hp,amount*(1-(s.run.upgrades.ward??0)*.12)*resolve);hits++;
          }
          hurt(amount);minHp=Math.min(minHp,s.run.hp);
        };
        const shoot=s.shoot.bind(s);
        s.shoot=(x,y,dx,dy,amount,hostile,...rest)=>{
          const boss=s.enemies.find(e=>e.type>=6&&e.hp>0);
          if(hostile&&boss&&Math.abs(boss.sprite.x-x)<.01&&Math.abs(boss.sprite.y-13-y)<.01)projectiles++;
          shoot(x,y,dx,dy,amount,hostile,...rest);
        };
        for(let frame=0;frame<30*180&&!complete&&!defeat;frame++){
          const enemies=s.enemies.filter(e=>e.hp>0),near=(a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y);
          const boss=enemies.find(e=>e.type>=6);
          const goal=enemies.filter(e=>e.type===3||e.type===4).map(e=>e.sprite).sort(near)[0]??s.drops.map(d=>d.sprite).sort(near)[0]??enemies.map(e=>e.sprite).sort(near)[0]??{x:195,y:330};
          let best=Infinity,direction={x:0,y:0};
          for(let i=-1;i<12;i++){
            const dx=i<0?0:Math.cos(i*Math.PI/6),dy=i<0?0:Math.sin(i*Math.PI/6);
            let score=i<0?0:.1;
            for(const time of [.15,.4]){
              const speed=128*(1+(s.run.upgrades.stride??0)*.12),x=s.hero.x+dx*speed*time,y=s.hero.y+dy*speed*time;
              score+=Math.hypot(x-goal.x,y-goal.y)*.005;
              score+=Math.max(0,45-x,x-345,90-y,y-575)*5;
              for(const q of [{x:69,y:265},{x:319,y:345}])score+=Math.max(0,35-Math.hypot(x-q.x,y-q.y))**2;
              for(const e of enemies){
                const length=Math.hypot(s.hero.x-e.sprite.x,s.hero.y-e.sprite.y)||1;
                const charging=e.charge>0||((e.type===2||e.type===6)&&e.windup>0);
                const ex=e.sprite.x+(charging?e.dx*235:(s.hero.x-e.sprite.x)/length*e.speed)*time;
                const ey=e.sprite.y+(charging?e.dy*235:(s.hero.y-e.sprite.y)/length*e.speed)*time;
                score+=Math.max(0,e.radius+28-Math.hypot(x-ex,y-ey))**2/10;
                // React to the visible locked ground warning in both versions.
                if(e.type===7&&e.windup>0&&(!e.boss||e.boss.action==='eruption'))score+=Math.max(0,65-Math.hypot(x-e.dx,y-e.dy))**2/5;
              }
              for(const shot of s.shots)if(shot.hostile)score+=Math.max(0,30-Math.hypot(x-shot.x-shot.dx*time,y-13-shot.y-shot.dy*time))**2/5;
            }
            if(score<best){best=score;direction={x:dx,y:dy};}
          }
          s.pointer={x:195,y:330,input:{x:195+direction.x*42,y:330+direction.y*42,isDown:true}};
          const winding=boss?.windup>0;
          s.update(frame*1000/30,1000/30);
          if(boss?.windup>0&&!winding)windups++;
          if(boss&&boss.hp<=boss.max*.5&&halfAt===null)halfAt=s.clock;
          if(boss&&boss.hp<=0&&bossKilledAt===null)bossKilledAt=s.clock;
          peak=Math.max(peak,s.enemies.filter(e=>e.hp>0).length);hostilePeak=Math.max(hostilePeak,s.shots.filter(q=>q.hostile).length);
          minHp=Math.min(minHp,s.run.hp);
          if(!evolutionRoom&&isEvolved(s.run))evolutionRoom=room+1;
        }
        const finished=s.getRun(),round=n=>n===null?null:Math.round(n*100)/100;
        rooms.push({room:room+1,complete,defeat,hp:round(finished.hp),minHp:round(minHp),damage:round(damage),healing:round(finished.hp-run.hp+damage),hits,
          secondWind:!run.secondWindUsed&&finished.secondWindUsed,kills:finished.kills-run.kills,level:finished.level,seconds:round(s.clock),bossSeconds:round(bossKilledAt),
          cleanupSeconds:bossKilledAt===null?null:round(s.clock-bossKilledAt),halfSeconds:bossKilledAt===null||halfAt===null?null:round(bossKilledAt-halfAt),windups,projectiles,peak,hostilePeak});
        arena.game.runDestroy();host.remove();
        if(!complete)break;
        save.run=finishRoom(finished);
        // Keep the checkpoint's permanent growth; the profile is only needed for validation.
        if(!prepare)save.profile.facilities={forge:20,beacon:20,archive:20};
        run=validateSave(JSON.parse(JSON.stringify(save))).run;
      }
      return {run,rooms,evolutionRoom};
    };
    return initialSave().version;
  });
  if(baseline){
    for(let chapter=0;chapter<3;chapter++)for(const weapon of ['staff','blade','halo'])for(const camp of [0,3,10,20])for(const seed of camp<10?[1,8,12,42]:[8]){
      const facilities=camp<10?{forge:weapon==='staff'?0:weapon==='blade'?1:2,beacon:0,archive:camp}:{forge:camp,beacon:camp,archive:camp};
      const input={chapter,weapon,camp,seed,facilities},prepared=await page.evaluate(input=>window.bossCheck(input,true),input);
      report.preparation.push({...input,rooms:prepared.rooms,evolutionRoom:prepared.evolutionRoom});
      console.log(`prepare chapter=${chapter+1} ${weapon} camp=${camp} seed=${seed}: ${prepared.rooms.filter(r=>r.complete).length}/6`);
      const transferred=prepared.run.room!==6;
      const source=transferred?report.checkpoints.find(c=>c.chapter===0&&c.weapon===weapon&&c.camp===camp&&c.seed===seed&&c.build==='natural'&&c.run.difficulty==='normal')?.run:prepared.run;
      assert.ok(source,'A completed first-chapter checkpoint supplies the isolated boss comparison');
      for(const difficulty of ['normal','hard']){
        const run={...structuredClone(source),mission:chapter*2+1,difficulty};
        const entrySource=transferred?'chapter-one-transfer':'same-chapter';
        report.checkpoints.push({chapter,weapon,camp,seed,entrySource,build:'natural',run});
        if(camp===3&&seed===8)for(const build of ['froststorm','wildfire']){
          // Redistribute the same number of earned upgrades, retaining the weapon evolution.
          const variant=structuredClone(run),required=weapon==='staff'?{power:3,pierce:2}:weapon==='blade'?{power:3,reach:2}:{orbit:2,haste:2};
          const synergy=build==='froststorm'?{storm:2,frost:2}:{ember:2,nova:2};
          const budget=Object.values(run.upgrades).reduce((sum,n)=>sum+n,0);
          variant.upgrades={...required,...synergy};
          let used=Object.values(variant.upgrades).reduce((sum,n)=>sum+n,0);
          if(used>budget)continue;
          for(const [id,max] of [['power',5],['haste',4],['ward',3],['mend',3]])while(used<budget&&(variant.upgrades[id]??0)<max){variant.upgrades[id]=(variant.upgrades[id]??0)+1;used++;}
          assert.equal(used,budget);
          variant.maxHp=100+facilities.beacon*10;variant.hp=Math.min(variant.hp,variant.maxHp);
          report.checkpoints.push({chapter,weapon,camp,seed,entrySource,build,run:variant});
        }
      }
    }
  }else{
    assert.equal(report.driverHash,before.driverHash,'Use the same measurement driver for both versions');
    report.checkpoints=before.checkpoints;report.preparation=before.preparation;
  }
  for(const checkpoint of report.checkpoints){
    const measured=await page.evaluate(input=>window.bossCheck(input),{...checkpoint,saveVersion:before?.saveVersion??report.saveVersion}),result=measured.rooms[0];
    const {run,...label}=checkpoint;
    report.results.push({...label,difficulty:run.difficulty,...result});
    console.log(`boss ${label.chapter+1} ${label.weapon} camp=${label.camp} ${label.build} ${run.difficulty} seed=${label.seed}: ${result.complete?'clear':result.defeat?'defeat':'timeout'} ${result.bossSeconds}s damage=${result.damage}`);
  }
  const output=`artifacts/boss-${current?'current':baseline?'baseline':'after'}.json`;
  for(const file of sourceFiles)assert.equal(hash(await readFile(file)),sources[file],file+' stays unchanged during measurement');
  await writeFile(output,JSON.stringify(report,null,2));
  assert.ok(report.checkpoints.length>0,'Prepared boss checkpoints');
  assert.ok(report.results.every(r=>r.complete||r.defeat),'No encounter stalls past 180 seconds');
  assert.ok(report.results.every(r=>r.peak<=160),'Enemy cap is preserved');
  const summary=report.results.reduce((rows,r)=>{const key=`${r.chapter+1}/${r.weapon}/${r.difficulty}`;const row=rows[key]??={clear:0,total:0,seconds:[],damage:[]};row.total++;if(r.complete)row.clear++;if(r.bossSeconds!==null)row.seconds.push(r.bossSeconds);row.damage.push(r.damage);return rows;},{});
  console.log(JSON.stringify({output,cases:report.results.length,preparationFailures:report.preparation.filter(p=>p.rooms.some(r=>!r.complete)).length,summary},null,2));
}finally{await browser.close();}
