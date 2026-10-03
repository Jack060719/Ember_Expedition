import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const arg=(key,fallback)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.split('=')[1]??fallback;
const port=Number(arg('port',4180)),first=Number(arg('first',4)),last=Number(arg('last',7)),pilot=process.argv.includes('--pilot');
const replaysOnly=process.argv.includes('--replays-only');
const priorPets=process.argv.includes('--prior-pets');
const weapons=arg('weapons','staff,halo,hammer').split(',');
assert.ok([5173,4180].includes(port));
const hash=s=>createHash('sha256').update(s).digest('hex');
const files=(await readdir('src')).filter(f=>f.endsWith('.ts')).map(f=>'src/'+f).sort();
const sources=Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f))])));
const driverHash=hash(await readFile('scripts/check-mainline-balance.mjs'));
const reportPath=`artifacts/mainline/batch-${first}-${last}${priorPets?'-prior-pets':replaysOnly?'-replays':pilot?'-pilot':''}.json`;
const cases=[];
for(let chapter=first;chapter<=last;chapter++)for(const offset of [0,1])for(const weapon of weapons)for(const difficulty of pilot||priorPets?['normal']:['normal','hard'])for(const petCount of priorPets?[1]:pilot?[0]:[0,1]){
  const camp=chapter<=7?[10,12,14,15][chapter-4]:chapter<=11?[20,22,24,25][chapter-8]:chapter<=15?[30,32,34,35][chapter-12]:[45,46,48,49,50][chapter-16];
  cases.push({chapter,mission:(chapter-1)*2+offset,weapon,character:weapon==='staff'?'keeper':'warden',build:weapon==='staff'?'focus':weapon==='halo'?'froststorm':weapon==='blade'?'wildfire':'meteor',difficulty,petCount,camp,archive:3,seed:8,...priorPets?{priorPets:true}:{}});
}
if(!pilot&&!priorPets)for(const mission of [0,1,3,5])cases.push({chapter:Math.floor(mission/2)+1,mission,weapon:'hammer',character:'warden',build:'meteor',difficulty:'normal',petCount:1,camp:last<=7?30:last<=11?40:last<=15?50:60,archive:20,seed:8,replay:true});
if(replaysOnly)cases.splice(0,cases.length,...cases.filter(c=>c.replay));
const metadata={root:process.cwd(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),created:new Date().toISOString(),sources,driverHash,cases,scope:'Complete seven-room expeditions; normal movement, offered upgrades, actual room reward/save round trips; encounters disabled to hold the chosen pet party constant. Normal/hard results remain separate.'};
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}});
let browser;const reports=[],errors=[];
let repeated;
if(process.argv.includes('--resume')){
  const raw=await readFile(reportPath),prior=JSON.parse(raw);
  assert.equal(prior.pending,true);assert.deepEqual(prior.sources,sources);assert.deepEqual(prior.cases,cases);assert.deepEqual(prior.errors,[]);
  repeated=prior.reports.at(-1);reports.push(...prior.reports.slice(0,-1));
  metadata.resume={reportHash:hash(raw),driverHash:prior.driverHash,reusedReports:reports.length,repeatedCase:reports.length+1};
}
await mkdir('artifacts/mainline',{recursive:true});
try{
  await server.listen();browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${port}/`);
  const served=await page.evaluate(async files=>Promise.all(files.map(async f=>{const raw=await fetch('/'+f+'?raw').then(r=>r.text());return [f,raw.startsWith('export default ')?JSON.parse(raw.split('\n')[0].slice(15).replace(/;$/,'')):raw];})),files);
  for(const [f,s] of served)assert.equal(hash(s),sources[f],f+' served from this worktree');
  await page.evaluate(()=>document.querySelector('#app').remove());
  for(const input of cases.slice(reports.length)){
    const report=await page.evaluate(async input=>{
      const core=await import('/src/core.ts'),{mountArena}=await import('/src/arena.ts'),{PETS,PET_IDS}=await import('/src/pets.ts');
      const {isBossEnemy}=await import('/src/enemies.ts'),{containsDanger,finalBossPhase}=await import('/src/chapter-attacks.ts');
      const {weapon,character,mission,difficulty,camp,archive,seed,build,petCount}=input;
      const save=core.initialSave();save.profile.cleared=core.MISSIONS.length;save.profile.facilities={forge:camp,beacon:camp,archive};
      const available=PET_IDS.filter(id=>!PETS[id].bossOnly&&(input.replay||PETS[id].firstChapter<=input.chapter-(input.priorPets?2:1)));
      const pets=petCount?available.slice(-petCount):[];
      save.profile.ownedPets=[...available];save.profile.petSlots=1;save.profile.equippedPets=pets;
      let run=core.createRun(save.profile,mission,weapon,difficulty,seed,character),evolutionRoom=null;
      const starting=structuredClone(run),rooms=[],picks=[],required=build==='meteor'?{meteor:3}:build==='froststorm'?{storm:2,frost:2}:build==='wildfire'?{nova:2,ember:2}:{};
      for(let room=0;room<7;room++){
        run.petEncounter={room,pet:null,state:'none'};
        const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
        let ready,complete=false,defeat=false;const loaded=new Promise(r=>ready=r);
        const arena=mountArena(host,run,{hud(){ready();},paused(){},complete(){complete=true;},defeat(){defeat=true;},upgrade(r,choose){
          const choices=core.upgradeChoices(r),needed=Object.entries({...core.EVOLUTIONS[weapon].requires,...required}).filter(([id,n])=>(r.upgrades[id]??0)<n).map(([id])=>id);
          const desired=[...Object.keys(required),...needed].find(id=>needed.includes(id)&&choices.some(u=>u.id===id));
          const choice=build==='focus'?choices[0]:choices.find(u=>u.id===desired)??choices[0];
          picks.push({room:room+1,level:r.level,offered:choices.map(u=>u.id),chosen:choice.id});choose(choice.id);
        }});
        await loaded;arena.game.loop.stop();const s=arena.scene;
        const characterDefinition=(await import('/src/characters.ts')).CHARACTERS[character];
        for(let direction=0;direction<4;direction++)if(s.anims.get(characterDefinition.animationPrefix+direction)?.frames.length!==4)throw new Error(`Missing character frames: mission ${mission}, room ${room+1}, direction ${direction}`);
        let damage=0,hits=0,petDamage=0,petBossDamage=0,bossSeconds=null,peak=0;const bossPhases=new Set();
        const hurt=s.hurt.bind(s);s.hurt=amount=>{const hp=s.run.hp,revived=s.run.secondWindUsed;hurt(amount);if(!revived&&s.run.secondWindUsed){damage+=hp;hits++;}else if(s.run.hp<hp){damage+=hp-s.run.hp;hits++;}};
        const hitPet=s.hitPet.bind(s);s.hitPet=(e,n)=>{const dealt=Math.min(Math.max(0,e.hp),n);petDamage+=dealt;if(isBossEnemy(e.type))petBossDamage+=dealt;hitPet(e,n);};
        for(let frame=0;frame<30*240&&!complete&&!defeat;frame++){
          const enemies=s.enemies.filter(e=>e.hp>0),boss=enemies.find(e=>isBossEnemy(e.type)),near=(a,b)=>Math.hypot(a.x-s.hero.x,a.y-s.hero.y)-Math.hypot(b.x-s.hero.x,b.y-s.hero.y);
          const goal=enemies.filter(e=>e.type===3||e.type===4).map(e=>e.sprite).sort(near)[0]??s.drops.map(d=>d.sprite).sort(near)[0]??enemies.map(e=>e.sprite).sort(near)[0]??{x:195,y:330};
          let best=Infinity,direction={x:0,y:0};
          for(let i=-1;i<12;i++){
            const dx=i<0?0:Math.cos(i*Math.PI/6),dy=i<0?0:Math.sin(i*Math.PI/6);let score=i<0?0:.1;
            for(const time of [.15,.4]){
              const speed=128*(1+(s.run.upgrades.stride??0)*.12),x=s.hero.x+dx*speed*time,y=s.hero.y+dy*speed*time;
              score+=Math.hypot(x-goal.x,y-goal.y)*.005+Math.max(0,45-x,x-345,90-y,y-575)*5;
              for(const q of [{x:69,y:265},{x:319,y:345}])score+=Math.max(0,35-Math.hypot(x-q.x,y-q.y))**2;
              for(const e of enemies){
                const length=Math.hypot(s.hero.x-e.sprite.x,s.hero.y-e.sprite.y)||1,charging=e.charge>0||((e.type===2||e.type===6)&&e.windup>0);
                const ex=e.sprite.x+(charging?e.dx*235:(s.hero.x-e.sprite.x)/length*e.speed)*time,ey=e.sprite.y+(charging?e.dy*235:(s.hero.y-e.sprite.y)/length*e.speed)*time;
                score+=Math.max(0,e.radius+28-Math.hypot(x-ex,y-ey))**2/10;
                if(e.type===7&&e.windup>0&&e.boss.action==='eruption')score+=Math.max(0,65-Math.hypot(x-e.dx,y-e.dy))**2/5;
                if(e.threat)for(const area of e.threat.plan.areas)if(e.threat.elapsed<area.delay+area.active&&containsDanger(area.shape,{x,y}))score+=180;
              }
              for(const shot of s.shots)if(shot.hostile)score+=Math.max(0,30-Math.hypot(x-shot.x-shot.dx*time,y-13-shot.y-shot.dy*time))**2/5;
            }
            if(score<best){best=score;direction={x:dx,y:dy};}
          }
          s.pointer={x:195,y:330,input:{x:195+direction.x*42,y:330+direction.y*42,isDown:true}};
          s.update(frame*1000/30,1000/30);
          if(input.chapter===20&&boss)bossPhases.add(finalBossPhase(Math.max(0,boss.hp)/boss.max));
          if(boss?.hp<=0&&bossSeconds===null)bossSeconds=s.clock;
          peak=Math.max(peak,s.enemies.filter(e=>e.hp>0).length);
          if(!evolutionRoom&&core.isEvolved(s.run))evolutionRoom=room+1;
        }
        const finished=s.getRun(),round=n=>n===null?null:Math.round(n*100)/100;
        rooms.push({room:room+1,complete,defeat,hp:round(finished.hp),seconds:round(s.clock),bossSeconds:round(bossSeconds),bossPhases:[...bossPhases],damage:round(damage),hits,kills:finished.kills-run.kills,petDamage:round(petDamage),petBossDamage:round(petBossDamage),peak,level:finished.level,upgrades:finished.upgrades});
        arena.game.destroy(true);arena.game.runDestroy();host.remove();save.run=complete?core.finishRoom(finished):finished;
        run=core.validateSave(JSON.parse(JSON.stringify(save))).run;
        if(!complete)break;
      }
      const complete=rooms.length===7&&rooms.every(r=>r.complete),outcome=complete?'victory':rooms.some(r=>r.defeat)?'defeat':'retreat';
      const replay=core.settle(save,outcome).earned;
      if(complete)save.profile.cleared=mission;
      const firstClear=core.settle(save,outcome).earned,cost=core.facilityCost('forge',camp);
      return {...input,pets,starting,evolutionRoom,rooms,picks,complete,firstClear,replay,nextForgeCost:cost,replaysForForge:Math.ceil(cost/Math.max(1,replay)),buildComplete:Object.entries(required).every(([id,n])=>(run.upgrades[id]??0)>=n)};
    },input);
    if(repeated){
      const comparable=r=>{const copy=structuredClone(r);delete copy.starting.id;return copy;};
      assert.deepEqual(comparable(report),comparable(repeated),'Repeated checkpoint expedition has identical combat results');repeated=null;
    }
    reports.push(report);await writeFile(reportPath,JSON.stringify({...metadata,pending:true,errors,reports},null,2));
    console.log(`${reports.length}/${cases.length} ch${input.chapter} mission${input.mission} ${input.weapon}/${input.build} ${input.difficulty} pets=${input.petCount}: ${report.rooms.filter(r=>r.complete).length}/7, earned=${report.firstClear}, replay=${report.replay}`);
  }
  for(const f of files)assert.equal(hash(await readFile(f)),sources[f],f+' remains fixed');
  assert.equal(hash(await readFile('scripts/check-mainline-balance.mjs')),driverHash);assert.deepEqual(errors,[]);
  assert.ok(reports.every(r=>r.rooms.every(room=>room.complete||room.defeat)),'No room stalls at 240 seconds');
  assert.ok(reports.every(r=>r.rooms.every(room=>room.peak<=160)),'Enemy cap');
  if(!replaysOnly&&weapons.length>=2)for(let chapter=first;chapter<=last;chapter++)for(const offset of [0,1])assert.ok(new Set(reports.filter(r=>r.chapter===chapter&&r.mission%2===offset&&r.difficulty==='normal'&&r.petCount<=(pilot?0:1)&&r.complete).map(r=>r.weapon)).size>=2,`Chapter ${chapter} mission ${offset+1} has two complete builds with at most one ordinary pet; zero-pet results remain separate`);
  if(last===20&&!replaysOnly)for(const r of reports.filter(r=>r.mission===39&&r.complete))assert.deepEqual(r.rooms.at(-1).bossPhases,[1,2,3],'Final boss completed all three phases');
  await writeFile(reportPath,JSON.stringify({...metadata,pending:false,errors,reports},null,2));
  console.log(`PASS ${reports.length} full expedition measurements; inspect separate hard failures and rewards in ${reportPath}`);
}finally{await browser?.close();await server.close();}
