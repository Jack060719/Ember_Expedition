import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const hash=value=>createHash('sha256').update(value).digest('hex');
const files=(await readdir('src')).filter(file=>file.endsWith('.ts')).map(file=>'src/'+file).sort();
const sources=Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await readFile(file))])));
const matrix=process.argv.includes('--matrix'),baseline=process.argv.includes('--baseline');
const entryPath=matrix?'artifacts/task-005/full-before.json':'artifacts/weapons-balance-report.json';
const entryBytes=await readFile(entryPath),entryReport=JSON.parse(entryBytes);
if(matrix)assert.ok(!entryReport.pending,'The full-expedition baseline must finish first');
const runs=matrix?entryReport.reports:entryReport;
const driverHash=hash((await readFile('scripts/check-weapon-boss.mjs','utf8')).replaceAll('\r\n','\n'));
const reportPath=matrix?`artifacts/task-005/boss-${baseline?'before':'after'}.json`:'artifacts/weapon-boss-report.json';
const before=matrix&&!baseline?JSON.parse(await readFile('artifacts/task-005/boss-before.json','utf8')):null;
if(before){assert.ok(!before.pending,'The boss baseline must finish first');assert.equal(driverHash,before.driverHash,'Use the frozen boss driver');assert.equal(hash(entryBytes),before.entryHash,'Reuse the same measured baseline entries');}
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:430,height:840}});
const results=[],skipped=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
const metadata={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktree:process.cwd(),node:process.version,browser:browser.version(),createdAt:new Date().toISOString(),sources,driverHash,driverHashMode:'LF-normalized',entryPath,entryHash:hash(entryBytes),
  branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),status:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim(),
  limitations:'Isolated bosses: fixed first-chapter entries; synergy variants redistribute the same earned budget. Not full later-chapter or hard runs.'};
try{
  if(matrix){await mkdir('artifacts/task-005',{recursive:true});if(baseline)await writeFile(reportPath,JSON.stringify({...metadata,pending:true}),{flag:'wx'});}
  await page.goto('http://localhost:5173/');
  const served=await page.evaluate(async files=>Promise.all(files.map(async file=>[file,await fetch('/'+file+'?raw').then(r=>r.text()).then(text=>text.startsWith('export default ')?JSON.parse(text.split('\n')[0].slice(15).replace(/;$/, '')):text)])),files);
  for(const [file,source] of served)assert.equal(hash(source),sources[file],file+' comes from this worktree');
  await page.evaluate(()=>document.querySelector('#app').remove());
  for(const character of matrix?['keeper','scout','warden']:['keeper'])for(const weapon of matrix?['staff','blade','halo','boomerang','hammer']:['boomerang','hammer'])for(let chapter=0;chapter<3;chapter++)for(const difficulty of ['normal','hard'])for(const build of ['natural','froststorm','wildfire']){
    const source=runs.find(r=>r.weapon===weapon&&r.archive===3&&r.seed===8&&r.build==='focus'&&(!matrix||r.character===character&&r.mission===1&&r.difficulty==='normal'));
    const entry=source?.bossEntry;
    if(!entry){skipped.push({character,weapon,chapter:chapter+1,difficulty,build,reason:'The natural first-chapter run did not reach the boss; no replacement entry.'});continue;}
    const result=await page.evaluate(async({entry,chapter,difficulty,build})=>{
      const {initialSave,validateSave,EVOLUTIONS,UPGRADES,upgradeChoices}=await import('/src/core.ts');
      const {mountArena}=await import('/src/arena.ts');
      const save=initialSave();save.profile.cleared=6;save.profile.facilities={forge:20,beacon:20,archive:20};
      const run=structuredClone(entry);run.mission=chapter*2+1;run.difficulty=difficulty;
      const budget=Object.values(run.upgrades).reduce((n,level)=>n+level,0);
      if(build!=='natural'){
        run.upgrades={...EVOLUTIONS[run.weapon].requires,...(build==='froststorm'?{storm:2,frost:2}:{ember:2,nova:2})};
        let used=Object.values(run.upgrades).reduce((n,level)=>n+level,0);
        for(const id of ['vitality','ward','mend','power','haste'])while(used<budget&&(run.upgrades[id]??0)<UPGRADES.find(u=>u.id===id).max){run.upgrades[id]=(run.upgrades[id]??0)+1;used++;}
        if(used!==budget)return {skipped:true,character:run.character,weapon:run.weapon,chapter:chapter+1,difficulty,build,budget,requiredBudget:used,reason:'The evolved synergy exceeds the naturally earned budget.'};
        run.maxHp=100+(run.upgrades.vitality??0)*20;run.hp=Math.min(run.hp,run.maxHp);
      }
      save.run=run;validateSave(save);
      const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
      let ready,complete=false,defeat=false;const loaded=new Promise(resolve=>ready=resolve),picks=[];
      const arena=mountArena(host,run,{hud(){ready();},paused(){},upgrade(r,choose){const choices=upgradeChoices(r);picks.push({level:r.level,offered:choices.map(u=>u.id),chosen:choices[0].id});choose(choices[0].id);},complete(){complete=true;},defeat(){defeat=true;}});
      await loaded;arena.game.loop.stop();const s=arena.scene;
      let peak=0,bossSeconds=null,damage=0,hits=0,healing=0;
      const hurt=s.hurt.bind(s);s.hurt=amount=>{const hp=s.run.hp,revived=s.run.secondWindUsed;hurt(amount);if(!revived&&s.run.secondWindUsed){damage+=hp;hits++;}else if(s.run.hp<hp){damage+=hp-s.run.hp;hits++;}};
      for(let frame=0;frame<30*180&&!complete&&!defeat;frame++){
        const enemies=s.enemies.filter(e=>e.hp>0),boss=enemies.find(e=>e.type>=6);
        const near=(a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y);
        const goal=enemies.filter(e=>e.type===3||e.type===4).map(e=>e.sprite).sort(near)[0]??s.drops.map(d=>d.sprite).sort(near)[0]??enemies.map(e=>e.sprite).sort(near)[0]??{x:195,y:330};
        let best=Infinity,direction={x:0,y:0};
        for(let i=-1;i<12;i++){
          const dx=i<0?0:Math.cos(i*Math.PI/6),dy=i<0?0:Math.sin(i*Math.PI/6);let score=i<0?0:.1;
          for(const time of [.15,.4]){
            const speed=128*(1+(s.run.upgrades.stride??0)*.12),x=s.hero.x+dx*speed*time,y=s.hero.y+dy*speed*time;
            score+=Math.hypot(x-goal.x,y-goal.y)*.005;
            score+=Math.max(0,45-x,x-345,90-y,y-575)*5;
            for(const q of [{x:69,y:265},{x:319,y:345}])score+=Math.max(0,35-Math.hypot(x-q.x,y-q.y))**2;
            for(const e of enemies){
              const length=Math.hypot(s.hero.x-e.sprite.x,s.hero.y-e.sprite.y)||1,charging=e.charge>0||((e.type===2||e.type===6)&&e.windup>0);
              const ex=e.sprite.x+(charging?e.dx*235:(s.hero.x-e.sprite.x)/length*e.speed)*time,ey=e.sprite.y+(charging?e.dy*235:(s.hero.y-e.sprite.y)/length*e.speed)*time;
              score+=Math.max(0,e.radius+28-Math.hypot(x-ex,y-ey))**2/10;
              if(e.type===7&&e.windup>0&&e.boss.action==='eruption')score+=Math.max(0,65-Math.hypot(x-e.dx,y-e.dy))**2/5;
            }
            for(const shot of s.shots)if(shot.hostile)score+=Math.max(0,30-Math.hypot(x-shot.x-shot.dx*time,y-13-shot.y-shot.dy*time))**2/5;
          }
          if(score<best){best=score;direction={x:dx,y:dy};}
        }
        s.pointer={x:195,y:330,input:{x:195+direction.x*42,y:330+direction.y*42,isDown:true}};
        const hp=s.run.hp,damageBefore=damage;s.update(frame*1000/30,1000/30);
        healing+=Math.max(0,s.run.hp-hp+damage-damageBefore);
        if(boss?.hp<=0&&bossSeconds===null)bossSeconds=s.clock;
        peak=Math.max(peak,s.enemies.filter(e=>e.hp>0).length);
      }
      const round=n=>n===null?null:Math.round(n*100)/100;
      const result={character:run.character,weapon:run.weapon,chapter:chapter+1,difficulty,build,entrySource:'chapter-one-transfer',abilitySource:build==='natural'?'natural-entry':'same-budget-redistribution',budget,entry:run,picks,finalRun:s.getRun(),complete,defeat,bossSeconds:round(bossSeconds),seconds:round(s.clock),damage:round(damage),healing:round(healing),hits,kills:s.run.kills-run.kills,hp:round(s.run.hp),peak};
      arena.game.runDestroy();host.remove();return result;
    },{entry,chapter,difficulty,build});
    if(result.skipped){skipped.push(result);continue;}
    results.push(result);console.log(`${character} ${weapon} chapter=${chapter+1} ${difficulty} ${build}: ${result.complete?'clear':result.defeat?'defeat':'timeout'} ${result.bossSeconds}s`);
  }
  for(const file of files)assert.equal(hash(await readFile(file)),sources[file],file+' stays fixed during measurement');
  assert.equal(hash((await readFile('scripts/check-weapon-boss.mjs','utf8')).replaceAll('\r\n','\n')),driverHash,'Driver stays fixed during measurement');
  assert.equal(hash(await readFile(entryPath)),hash(entryBytes),'Entry report stays fixed during measurement');
  await writeFile(reportPath,JSON.stringify({...metadata,results,skipped,errors},null,2));
  assert.deepEqual(errors,[],'No browser errors');
  assert.ok(results.length,'At least one measured entry is available');
  assert.ok(results.every(r=>r.complete||r.defeat),'No encounter stalls past 180 seconds');
  assert.ok(results.every(r=>r.peak<=160),'Enemy cap is preserved');
  console.log(JSON.stringify({cases:results.length,clears:results.filter(r=>r.complete).length,defeats:results.filter(r=>r.defeat).length}));
}finally{await browser.close();}
