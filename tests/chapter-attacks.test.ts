import test from 'node:test';
import assert from 'node:assert/strict';
import { finalBossPhase, planChapterAttack, dangerPhase, containsDanger } from '../src/chapter-attacks.ts';

test('the last boss changes phases at thirds and every phase locks a fresh warned pattern',()=>{
  assert.deepEqual([1,2/3+.001,2/3,1/3+.001,1/3,.01].map(finalBossPhase),[1,1,2,2,3,3]);
  const phases=[1,2,3].map(phase=>Array.from({length:4},(_,turn)=>planChapterAttack('final-king',turn,{x:195,y:130},{x:195,y:450},phase>1,phase)));
  assert.notDeepEqual(phases[0],phases[1]);assert.notDeepEqual(phases[1],phases[2]);
  for(const phase of phases)for(const attack of phase)assert.ok(attack.areas.every(a=>a.delay>=1.1));
});

test('black knight embers occupy only the announced dash lane after the dash ends',()=>{
  const attack=planChapterAttack('ember-dash',0,{x:195,y:130},{x:195,y:450},false),dash=attack.dash!,embers=attack.areas[1];
  assert.equal(embers.delay,dash.start+dash.duration);assert.deepEqual(embers.shape,attack.areas[0].shape);
  assert.equal(dangerPhase(embers,embers.delay-.001),'warning');
  assert.equal(containsDanger(embers.shape,{x:195,y:200}),true);
  assert.equal(containsDanger(embers.shape,{x:230,y:200}),false);
  assert.equal(dangerPhase(embers,attack.duration),'expired');
});

test('water rings leave their marked gap and an inner safe area, while rifts warn before moving and striking',()=>{
  const ring=planChapterAttack('water-ring',0,{x:195,y:250},{x:195,y:380},false).areas[0].shape;
  assert.equal(containsDanger(ring,{x:195,y:380}),true);
  assert.equal(containsDanger(ring,{x:65,y:250}),false);
  assert.equal(containsDanger(ring,{x:195,y:250}),false);
  assert.equal(containsDanger(ring,{x:195,y:400}),false);
  const slash=planChapterAttack('rift-slash',0,{x:195,y:130},{x:195,y:450},false);
  assert.ok(slash.jump!.start<slash.areas[0].delay);
  const pair=planChapterAttack('rift-pair',0,{x:195,y:130},{x:195,y:450},true);
  assert.equal(pair.areas.length,2);assert.ok(pair.areas[0].delay<pair.areas[1].delay);
});

test('summons have finite lifetime budgets and pharaoh alternates with warned directional projectiles',()=>{
  assert.equal(planChapterAttack('summon',0,{x:195,y:130},{x:195,y:450},false).summon!.limit,6);
  assert.equal(planChapterAttack('pharaoh',0,{x:195,y:130},{x:195,y:450},false).summon!.limit,12);
  const volley=planChapterAttack('pharaoh',1,{x:195,y:130},{x:195,y:450},false);
  assert.equal(volley.projectiles!.angles.length,10);
  assert.ok(volley.areas.every(a=>a.delay===volley.projectiles!.start&&a.damage===0));
  const healing=planChapterAttack('heal',0,{x:20,y:62},{x:195,y:450},false);
  assert.deepEqual(healing.areas[0].shape,{kind:'circle',x:20,y:62,radius:110});
});

test('new threats give at least 950 ms warning and finite safe gaps before damage',()=>{
  for(const behavior of ['thrust','poison','falling-fire','javelin','burrow','spores','hammer-fan','wolf-dash','wind-fan','shield','leap','heal','wing-lightning','mirror-shield','moon-dance','root-seed','lightning-mark','lightning-bands','summon','pharaoh','water-ring','tide-wave','rift-slash','rift-pair','bone-breath','bone-rain','ember-dash','black-sun','delayed-beam','angel','rally','devour','combined','final-king'])for(const enraged of [false,true])for(const turn of [0,1,2]){
    const attack=planChapterAttack(behavior,turn,{x:195,y:130},{x:195,y:450},enraged);
    assert.ok(Number.isFinite(attack.duration)&&attack.duration>0&&attack.cooldown>=.55);
    for(const area of attack.areas){
      assert.ok(area.delay>=.95);
      assert.equal(dangerPhase(area,area.delay-.001),'warning');
      assert.equal(dangerPhase(area,area.delay),'active');
      assert.equal(dangerPhase(area,area.delay+area.active),'expired');
      assert.ok(area.active<=1.6);
    }
    const safe=[{x:25,y:65},{x:365,y:65},{x:25,y:600},{x:365,y:600}];
    assert.ok(safe.some(p=>attack.areas.every(a=>!containsDanger(a.shape,p))));
  }
});

test('moon jumps announce a bounded landing and alternate with a separately warned fan',()=>{
  const jump=planChapterAttack('moon-dance',0,{x:195,y:130},{x:-80,y:900},true);
  assert.deepEqual(jump.jump,{to:{x:35,y:590},start:1.15});
  assert.equal(jump.areas[0].delay,jump.jump!.start);
  assert.equal(planChapterAttack('moon-dance',1,{x:195,y:130},{x:195,y:450},true).areas[0].shape.kind,'fan');
  const healing=planChapterAttack('heal',0,{x:195,y:130},{x:195,y:450},false);
  assert.ok(healing.areas.every(a=>a.damage===0));
});

test('narrow spear, poison circle and furnace fan hit exactly their marked geometry',()=>{
  const spear=planChapterAttack('javelin',0,{x:195,y:100},{x:195,y:400},false).areas[0].shape;
  assert.equal(containsDanger(spear,{x:195,y:250}),true);
  assert.equal(containsDanger(spear,{x:210,y:250}),false);
  const poison=planChapterAttack('poison',0,{x:100,y:100},{x:195,y:400},false).areas[0].shape;
  assert.equal(containsDanger(poison,{x:231,y:400}),true);
  assert.equal(containsDanger(poison,{x:232,y:400}),false);
  const fan=planChapterAttack('hammer-fan',1,{x:195,y:100},{x:195,y:400},false).areas[0].shape;
  assert.equal(containsDanger(fan,{x:195,y:300}),true);
  assert.equal(containsDanger(fan,{x:195,y:340}),false);
  assert.equal(containsDanger(fan,{x:195,y:80}),false);
});

test('burrowing and wolf dashes stop inside the arena and each repeated dash gets a fresh warning',()=>{
  for(const behavior of ['burrow','wolf-dash','thrust'])for(const target of [{x:500,y:1000},{x:-500,y:-300},{x:195,y:130}]){
    const attack=planChapterAttack(behavior,0,{x:195,y:130},target,true);
    const dash=attack.dash!;
    assert.ok(dash.to.x>=23&&dash.to.x<=367&&dash.to.y>=64&&dash.to.y<=602);
    assert.equal(dash.start,1);
    assert.ok(dash.duration>=0);
  }
  const first=planChapterAttack('wolf-dash',0,{x:195,y:100},{x:300,y:400},true);
  const follow=planChapterAttack('wolf-dash',1,first.dash!.to,{x:60,y:500},true);
  assert.equal(first.cooldown,.55);
  assert.equal(follow.dash!.start,1);
  assert.notDeepEqual(follow.dash!.to,first.dash!.to);
});

test('spore bursts alternate axes and never detonate all three areas simultaneously',()=>{
  const a=planChapterAttack('spores',0,{x:195,y:100},{x:195,y:400},false);
  const b=planChapterAttack('spores',1,{x:195,y:100},{x:195,y:400},false);
  assert.deepEqual(a.areas.map(z=>z.shape.y),[400,400,400]);
  assert.deepEqual(b.areas.map(z=>z.shape.x),[195,195,195]);
  for(let t=0;t<=a.duration;t+=.05)assert.ok(a.areas.filter(z=>dangerPhase(z,t)==='active').length<3);
});
