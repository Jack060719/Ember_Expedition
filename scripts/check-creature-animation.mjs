import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const port=Number(process.argv.find(a=>a.startsWith('--port='))?.split('=')[1]??5173);
assert.ok([5173,4180].includes(port));
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}});
await server.listen();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(`http://127.0.0.1:${port}`);
  const checks=await page.evaluate(async()=>{
    const {mountArena}=await import('/src/arena.ts'),{initialSave,createRun}=await import('/src/core.ts');
    const {PETS,PET_IDS}=await import('/src/pets.ts'),{PetParty,FLYING_PETS}=await import('/src/pet-arena.ts'),{ENEMIES}=await import('/src/enemies.ts');
    document.querySelector('#app').remove();
    const profile=initialSave().profile;profile.cleared=40;profile.petSlots=1;profile.ownedPets=PET_IDS;
    const run=createRun(profile,39,'staff','normal',42);run.pets=[];run.petEncounter=null;
    const host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
    let loaded;const ready=new Promise(resolve=>loaded=resolve);
    const arena=mountArena(host,run,{hud(){loaded();},upgrade(){},complete(){},defeat(){},paused(){}});
    await ready;arena.game.loop.stop();const s=arena.scene;s.spawnTimer=1e6;s.hurt=()=>{};
    const checks=[],check=(test,ok,details)=>checks.push({test,ok:!!ok,details});
    const clear=()=>{for(const e of s.enemies){e.sprite.destroy();e.shadow.destroy();}s.enemies=[];};
    const enemy=(x,y)=>{s.spawnEnemy(0,x,y);const e=s.enemies.at(-1);e.hp=e.max=1e9;e.speed=0;return e;};
    for(const id of PET_IDS){
      clear();s.hero.setPosition(195,490);
      const party=new PetParty(s,s.hero,(e,d)=>s.hitPet(e,d));party.sync([id]);const p=party.companions[0];p.sprite.setPosition(195,490);p.cooldown=99;
      const target=enemy(195,100),frames=new Set();
      for(let i=0;i<60;i++){party.step(.05,s.enemies);frames.add(p.sprite.frame.name);}
      check(id+' independently pursues an enemy beyond the old acquisition range',p.target===target.id&&p.sprite.y<280&&frames.size===4,{y:p.sprite.y,frames:[...frames]});
      const nearer=enemy(p.sprite.x+12,p.sprite.y+12);party.step(.05,s.enemies);
      check(id+' holds its live target instead of flickering between nearby enemies',p.target===target.id);
      p.cooldown=0;party.step(.05,s.enemies);p.cooldown=99;const attackFrames=new Set([p.sprite.frame.name]);
      for(let i=0;i<100&&p.attack;i++){party.step(.05,s.enemies);attackFrames.add(p.sprite.frame.name);}
      check(id+' plays preparation, release and recovery for its first attack',[4,5,6,7].every(frame=>attackFrames.has(frame)),[...attackFrames]);
      target.hp=0;party.step(.05,s.enemies);check(id+' retargets after its enemy dies',p.target===nearer.id);
      nearer.hp=0;for(let i=0;i<100;i++)party.step(.05,s.enemies);
      check(id+' returns beside the hero after clearing enemies',p.target===null&&Math.hypot(p.sprite.x-155,p.sprite.y-514)<5,{x:p.sprite.x,y:p.sprite.y});
      const restingFrames=new Set();for(let i=0;i<12;i++){party.step(.05,[],false);restingFrames.add(p.sprite.frame.name);}
      check(id+' rests or hovers without walking in place',FLYING_PETS.includes(id)?restingFrames.size===4:restingFrames.size===1&&restingFrames.has(0));
      s.hero.setPosition(367,602);p.sprite.setPosition(23,64);const before=Math.hypot(p.sprite.x-s.hero.x,p.sprite.y-s.hero.y);
      enemy(23,90);party.step(.05,s.enemies);
      check(id+' returns when the hero moves beyond its leash without teleporting',p.returning&&p.target===null&&before-Math.hypot(p.sprite.x-s.hero.x,p.sprite.y-s.hero.y)>0&&before-Math.hypot(p.sprite.x-s.hero.x,p.sprite.y-s.hero.y)<=5.761);
      party.destroy();
    }
    clear();s.hero.setPosition(195,500);
    for(let type=0;type<ENEMIES.length;type++){
      clear();s.spawnEnemy(type,195,160);const e=s.enemies[0],frames=new Set();e.hp=e.max=1e9;e.attack=99;
      for(let i=0;i<14;i++){s.clock+=.05;s.enemyStep(.05);frames.add(e.sprite.frame.name);}
      check(ENEMIES[type].id+' has four locomotion frames at a stable display size',frames.size===4&&e.sprite.displayWidth===e.size&&e.sprite.displayHeight===e.size,[...frames]);
      e.sprite.setPosition(195,440);e.attack=0;const attackFrames=new Set();
      for(let i=0;i<60;i++){s.clock+=.05;s.enemyStep(.05);attackFrames.add(Number(e.sprite.frame.name)-ENEMIES[type].frame*8);}
      if(type>=2)check(ENEMIES[type].id+' shows anticipation and release poses',attackFrames.has(4)&&attackFrames.has(6),[...attackFrames]);
    }
    // Pixel comparisons catch an atlas filled with repeated static stickers, not only frame-number changes.
    for(const [key,offset] of [...PET_IDS.map(id=>['pet-'+id,0]),...ENEMIES.map(e=>[e.texture,e.frame*8])]){
      const signatures=[];
      for(let n=0;n<8;n++){
        const f=s.textures.getFrame(key,offset+n),canvas=document.createElement('canvas');canvas.width=canvas.height=128;
        const context=canvas.getContext('2d');context.drawImage(f.source.image,f.cutX,f.cutY,128,128,0,0,128,128);
        const bytes=context.getImageData(0,0,128,128).data;let hash=2166136261,opaque=0,edge=0;
        for(let p=0;p<bytes.length;p+=4){hash=Math.imul(hash^bytes[p]^bytes[p+1]^bytes[p+2]^bytes[p+3],16777619);if(bytes[p+3]){opaque++;const pixel=p/4,x=pixel%128,y=Math.floor(pixel/128);if(x===0||x===127||y===0||y===127)edge++;}}
        check(key+' frame '+(offset+n)+' is a complete transparent sprite',opaque>100&&opaque<128*128*.9&&edge===0);
        signatures.push(hash);
      }
      check(key+' '+offset+' has distinct movement and attack artwork',new Set(signatures.slice(0,4)).size>=3&&new Set(signatures.slice(4)).size>=3);
    }
    clear();s.hero.setPosition(195,490);s.petParty.sync(['thunderLeopard']);const p=s.petParty.companions[0];enemy(195,150);
    s.pause();const before=[p.sprite.x,p.sprite.y,p.sprite.frame.name,s.clock];s.update(0,50);
    check('pause freezes autonomous movement and animation together',JSON.stringify(before)===JSON.stringify([p.sprite.x,p.sprite.y,p.sprite.frame.name,s.clock]));
    s.resume();s.changePhase('loot');for(let i=0;i<20;i++)s.update(0,50);
    check('loot clears pet dash and projectiles',s.petParty.shots.length===0&&s.petParty.companions.every(p=>!p.dash));
    arena.game.runDestroy();host.remove();return checks;
  });
  await mkdir('artifacts/creature-animation',{recursive:true});
  await writeFile('artifacts/creature-animation/browser-check.json',JSON.stringify({checks,errors},null,2));
  const failed=checks.filter(c=>!c.ok);console.log(JSON.stringify({passed:checks.length-failed.length,total:checks.length,failed,errors},null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
}finally{await browser.close();await server.close();}
