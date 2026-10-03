import test from 'node:test';
import assert from 'node:assert/strict';
import { attackEffect, dangerEffect, drawAttackEffect, drawAttackProjectile } from '../src/attack-effects.ts';
import { planChapterAttack } from '../src/chapter-attacks.ts';

function recorder(){
  const calls:{method:string;args:unknown[]}[]=[];
  const g=Object.fromEntries(['lineStyle','lineBetween','strokePoints','beginPath','arc','strokePath','fillStyle','slice','fillPath','fillCircle','strokeCircle','fillTriangle'].map(method=>[method,(...args:unknown[])=>{calls.push({method,args});return g;}]));
  return {g:g as never,calls};
}
test('attack effects remain visible after 220 ms, animate, fade and stop drawing on expiry',()=>{
  for(const kind of ['slash','breath','beam','bolt','wave','burst','ring'] as const){
    const e=attackEffect(kind,100,100,35,0xff9900,.3,.6,{x:250,y:180}),first=recorder(),later=recorder();
    assert.ok(e.duration>=.5&&e.duration<=.7);
    drawAttackEffect(first.g,e);e.life-=.25;drawAttackEffect(later.g,e);
    assert.ok(later.calls.length>0,kind);assert.notDeepEqual(first.calls,later.calls,kind);
    const opacity=later.calls.filter(c=>c.method==='lineStyle'||c.method==='fillStyle').map(c=>c.args.at(-1) as number);
    assert.ok(opacity.every(a=>a>=0&&a<=1),kind);
    for(const call of later.calls)for(const value of call.args)if(typeof value==='number')assert.ok(Number.isFinite(value),kind);
    e.life=0;const expired=recorder();drawAttackEffect(expired.g,e);assert.equal(expired.calls.length,0);
  }
});
test('enemy effects preserve the warned endpoints, cone and ring safe gap without changing damage plans',()=>{
  for(const behavior of ['delayed-beam','bone-breath','water-ring','poison']){
    const plan=planChapterAttack(behavior,0,{x:100,y:150},{x:200,y:300},false),before=JSON.stringify(plan),area=plan.areas[0],effect=dangerEffect(area,behavior==='bone-breath'),s=area.shape;
    effect.life-=.2;const {g,calls}=recorder();drawAttackEffect(g,effect);
    assert.equal(JSON.stringify(plan),before);
    if(s.kind==='line')assert.ok(calls.filter(c=>c.method==='lineBetween').every(c=>JSON.stringify(c.args)===JSON.stringify([s.x,s.y,s.endX,s.endY])));
    if(s.kind==='fan')assert.deepEqual(calls.find(c=>c.method==='slice')?.args,[s.x,s.y,s.radius,s.angle-s.half,s.angle+s.half,false]);
    if(s.kind==='ring')assert.ok(calls.filter(c=>c.method==='arc').every(c=>JSON.stringify(c.args)===JSON.stringify([s.x,s.y,s.radius,s.angle+s.half,s.angle+Math.PI*2-s.half])));
  }
});
test('projectile tails follow actual travel direction while blades spin and crystals retain their own silhouette',()=>{
  for(const kind of ['shot','blast','pierce','fan','return','dash','stone','spell']){
    const {g,calls}=recorder();drawAttackProjectile(g,kind,100,200,0,-300,0xaaffff,.3);
    assert.deepEqual(calls.find(c=>c.method==='lineBetween')?.args,[100,230,100,200]);
    if(kind==='pierce'||kind==='fan')assert.ok(calls.some(c=>c.method==='fillTriangle'));
    if(kind==='return')assert.equal(calls.filter(c=>c.method==='arc').length,2);
    if(kind==='dash')assert.ok(!calls.some(c=>c.method==='fillCircle'));
  }
});
