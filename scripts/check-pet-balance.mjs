import { createServer } from 'vite';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Coordinate 5173 or 4180 before invocation; the server owns its lifecycle.
const port=Number(process.argv.find(arg=>arg.startsWith('--port='))?.split('=')[1]??4180);
assert.ok([5173,4180].includes(port));
const origin=`http://127.0.0.1:${port}/`;
await mkdir('artifacts/pets',{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}});await server.listen();
try{
  // Run the repository's unmodified seven-room driver; only redirect its URL to our reserved port.
  const driver=await readFile('scripts/check-balance.mjs','utf8');
  const adapted=driver.replaceAll('http://localhost:5173/',origin);
  await writeFile('artifacts/pets/zero-balance-driver.mjs',adapted);
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['artifacts/pets/zero-balance-driver.mjs'],{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Seven-room driver exited '+code)));});
const hash=value=>createHash('sha256').update(value).digest('hex');
const files=(await readdir('src')).filter(file=>file.endsWith('.ts')).map(file=>'src/'+file).sort();
const sources=Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await readFile(file))])));
const runs=JSON.parse(await readFile('artifacts/balance-report.json','utf8'));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:430,height:840}});
const results=[];
try{
  await page.goto(origin);
  const served=await page.evaluate(async files=>Promise.all(files.map(async file=>[file,await fetch('/'+file+'?raw').then(r=>r.text()).then(text=>text.startsWith('export default ')?JSON.parse(text.split('\n')[0].slice(15).replace(/;$/, '')):text)])),files);
  for(const [file,source] of served)assert.equal(hash(source),sources[file],file+' comes from this worktree');
  await page.evaluate(()=>document.querySelector('#app').remove());
  for(const weapon of ['staff','halo'])for(let chapter=0;chapter<3;chapter++)for(const difficulty of ['normal','hard'])for(const count of [0,1]){
    const entry=runs.find(r=>r.weapon===weapon&&r.archive===3&&r.seed===8&&r.build==='focus').bossEntry;
    assert.ok(entry,'A real seven-room run supplies the entry and earned upgrade budget');
    const result=await page.evaluate(async({entry,chapter,difficulty,count})=>{
      const {initialSave,validateSave,upgradeChoices}=await import('/src/core.ts');
      const {mountArena}=await import('/src/arena.ts');
      const {PET_IDS}=await import('/src/pets.ts');
      const save=initialSave();save.profile.cleared=6;save.profile.facilities={forge:20,beacon:20,archive:20};save.profile.ownedPets=PET_IDS;save.profile.petSlots=1;
      const run=structuredClone(entry);run.mission=chapter*2+1;run.difficulty=difficulty;run.pets=count===0?[]:['mossRabbit'];run.petEncounter={room:run.room,pet:null,state:'none'};
      const budget=Object.values(run.upgrades).reduce((n,level)=>n+level,0);
      save.run=run;validateSave(save);
      const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
      let ready,complete=false,defeat=false;const loaded=new Promise(resolve=>ready=resolve);
      const arena=mountArena(host,run,{hud(){ready();},paused(){},upgrade(r,choose){choose(upgradeChoices(r)[0].id);},complete(){complete=true;},defeat(){defeat=true;}});
      await loaded;arena.game.loop.stop();const s=arena.scene;
      let peak=0,bossSeconds=null,damage=0,petDamage=0,petBossDamage=0;
      const hitPet=s.hitPet.bind(s);s.hitPet=(e,amount)=>{const dealt=Math.min(Math.max(0,e.hp),amount);petDamage+=dealt;if(e.type>=6)petBossDamage+=dealt;hitPet(e,amount);};
      const hurt=s.hurt.bind(s);s.hurt=amount=>{const before=s.run.hp;hurt(amount);damage+=Math.max(0,before-s.run.hp);};
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
        s.update(frame*1000/30,1000/30);
        if(boss?.hp<=0&&bossSeconds===null)bossSeconds=s.clock;
        peak=Math.max(peak,s.enemies.filter(e=>e.hp>0).length);
      }
      const round=n=>n===null?null:Math.round(n*100)/100;
      const result={weapon:run.weapon,chapter:chapter+1,difficulty,pets:count,petDamage:round(petDamage),petBossDamage:round(petBossDamage),entrySource:'chapter-one-transfer',budget,entry:run,complete,defeat,bossSeconds:round(bossSeconds),seconds:round(s.clock),damage:round(damage),hp:round(s.run.hp),peak};
      arena.game.runDestroy();host.remove();return result;
    },{entry,chapter,difficulty,count});
    results.push(result);console.log(`${weapon} chapter=${chapter+1} ${difficulty} pets=${count}: ${result.complete?'clear':result.defeat?'defeat':'timeout'} ${result.bossSeconds}s`);
  }
  for(const file of files)assert.equal(hash(await readFile(file)),sources[file],file+' stays fixed during measurement');
  await writeFile('artifacts/pets/balance-report.json',JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources,driverHash:hash(await readFile('scripts/check-pet-balance.mjs')),limitations:'Isolated bosses: same real first-chapter seven-room entries per weapon, seed 8, archive 3; 0 pets / 1 mossRabbit / 3 emberFox+frostOwl+starDrake. Normal/hard are separate. Not full later-chapter or hard runs, not all pet combinations.',results},null,2));
  assert.ok(results.every(r=>r.complete||r.defeat),'No encounter stalls past 180 seconds');
  assert.ok(results.every(r=>r.peak<=160),'Enemy cap is preserved');
  console.log(JSON.stringify({cases:results.length,clears:results.filter(r=>r.complete).length,defeats:results.filter(r=>r.defeat).length}));
}finally{await browser.close();}

}finally{await server.close();}
