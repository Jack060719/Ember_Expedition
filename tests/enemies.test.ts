import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES, isBossEnemy, enemyType, enemyHealth, enemyDamage } from '../src/enemies.ts';
import { NEW_CHAPTERS } from '../src/mainline.ts';

test('new ordinary enemy IDs above eight never become bosses or receive boss experience',()=>{
  assert.deepEqual(ENEMIES.map((_,i)=>i).filter(isBossEnemy),[6,7,8,13,14,15,16,21,22,23,24,29,30,31,32,38,39,40,41,42]);
  for(const chapter of NEW_CHAPTERS){
    const mob=enemyType(chapter.enemy),boss=enemyType(chapter.bossId);
    assert.ok(mob>8);
    assert.equal(isBossEnemy(mob),false);
    assert.equal(ENEMIES[mob].experience,1);
    assert.equal(isBossEnemy(boss),true);
    assert.equal(ENEMIES[boss].name,chapter.boss);
  }
});

test('original three chapters retain exact normal enemy health and boss health',()=>{
  const hp=[14,10,28,35,22,65];
  for(let chapter=0;chapter<3;chapter++)for(let room=0;room<7;room++)for(const hard of [false,true]){
    hp.forEach((n,type)=>assert.equal(enemyHealth(type,chapter,room,hard),n*1.2*(1+chapter*.28+room*.08)*(hard?1.35:1)));
    assert.equal(enemyHealth(6+chapter,chapter,room,hard),[4500,6500,7000][chapter]*(hard?1.35:1));
  }
  assert.deepEqual(ENEMIES.slice(0,9).map(e=>e.speed),[34,47,37,22,32,26,34,24,36]);
});

test('later normal enemies scale from chapter three without increasing experience',()=>{
  for(let chapter=3;chapter<20;chapter++){
    assert.ok(Math.abs(enemyHealth(0,chapter,0,false)/enemyHealth(0,chapter-1,0,false)-1.12)<1e-10);
    assert.ok(Math.abs(enemyDamage(11,chapter)/enemyDamage(11,chapter-1)-1.1)<1e-10);
  }
});
