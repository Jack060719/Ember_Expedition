import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Use --port=4180 after coordinating when TASK-003 owns 5173.
const port=Number(process.argv.find(arg=>arg.startsWith('--port='))?.split('=')[1]??5173);
assert.ok([5173,4180].includes(port),'Reserve either 5173 or 4180 before running this check.');
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}});
try{
await server.listen();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
try{
  await page.goto(`http://127.0.0.1:${port}/`);
  const result=await page.evaluate(async()=>{
    const {mountArena,MAP}=await import('/src/arena.ts');
    const {CHARACTERS,createRun,initialSave}=await import('/src/core.ts');
    document.querySelector('#app').remove();
    const results=[],profile=initialSave().profile;profile.cleared=2;profile.facilities.archive=3;
    for(const character of Object.keys(CHARACTERS)){
      const run=createRun(profile,0,'staff','normal',42,character);run.hp=43;
      const original=structuredClone(run),host=document.createElement('div');host.style.cssText='width:390px;height:660px';document.body.append(host);
      let loaded;const ready=new Promise(resolve=>loaded=resolve);
      const arena=mountArena(host,run,{hud(){loaded();},upgrade(){},complete(){},defeat(){},paused(){}});
      await ready;arena.game.loop.stop();const s=arena.scene;
      results.push({test:character+' loads its own sprite without gifts or healing',ok:s.hero.texture.key===CHARACTERS[character].textureKey&&s.run.character===character&&s.run.hp===original.hp&&s.run.maxHp===original.maxHp&&JSON.stringify(s.run.upgrades)===JSON.stringify(original.upgrades)});
      results.push({test:character+' retains the established sprite dimensions and origin',ok:s.hero.displayWidth===67&&s.hero.displayHeight===67&&s.hero.originX===.5&&s.hero.originY===.82});
      for(const [direction,dx,dy] of [[0,0,42],[1,-42,0],[2,42,0],[3,0,-42]]){
        s.hero.setPosition(195,400);s.pointer={input:{isDown:true,x:195+dx,y:400+dy},x:195,y:400};s.move(.1);
        const speed=128*(1+(run.upgrades.stride??0)*.12);
        results.push({test:character+' direction '+direction+' uses its animation and correct stride speed',ok:s.hero.anims.currentAnim.key===CHARACTERS[character].animationPrefix+direction&&Math.abs(Math.hypot(s.hero.x-195,s.hero.y-400)-speed*.1)<.001});
        s.pointer=null;s.move(0);
        results.push({test:character+' direction '+direction+' rests on its neutral frame',ok:s.hero.frame.name===direction*4&&!s.hero.anims.isPlaying});
      }
      const obstacle=MAP.blockers[0];s.hero.setPosition(obstacle.x+30,obstacle.y);s.pointer={input:{isDown:true,x:100,y:100},x:142,y:100};s.move(.1);s.pointer=null;
      results.push({test:character+' uses the same obstacle collision radius',ok:Math.abs(Math.hypot(s.hero.x-obstacle.x,s.hero.y-obstacle.y)-(obstacle.r+10))<.001});
      const before=s.run.hp;s.hitTimer=0;s.hurt(10);
      results.push({test:character+' applies ward through the saved ability level exactly once',ok:Math.abs(before-s.run.hp-10*(1-(run.upgrades.ward??0)*.12))<.001});
      arena.game.runDestroy();host.remove();
    }
    return results;
  });
  await mkdir('artifacts/characters',{recursive:true});
  await writeFile('artifacts/characters/arena-report.json',JSON.stringify(result,null,2));
  assert.deepEqual(result.filter(check=>!check.ok),[]);
  console.log(`Passed ${result.length} character scene checks.`);
}finally{await browser.close();}
}finally{await server.close();}
