export type Weapon = 'staff' | 'blade' | 'halo';
export type Difficulty = 'normal' | 'hard';
export type UpgradeId = 'power' | 'haste' | 'stride' | 'vitality' | 'reach' | 'split' | 'pierce' | 'ember' | 'frost' | 'storm' | 'ward' | 'mend' | 'orbit' | 'nova' | 'magnet' | 'fortune' | 'focus' | 'secondwind';
export type Facility = 'forge' | 'beacon' | 'archive';
export interface Profile { embers: number; cleared: number; facilities: Record<Facility, number>; totalKills: number; expeditions: number; bestHard: number; }
export interface PuzzleState { mask: number; moves: number; }
export interface Run {
  id: string; seed: number; mission: number; difficulty: Difficulty; weapon: Weapon;
  room: number; hp: number; maxHp: number; embers: number; kills: number; elapsed: number;
  upgrades: Partial<Record<UpgradeId, number>>; level: number; xp: number;
  puzzle: PuzzleState | null; route: 'safe' | 'risk'; secondWindUsed: boolean;
}
export interface Save { version: 1; profile: Profile; run: Run | null; settings: { sound: boolean }; }
export interface Upgrade { id: UpgradeId; name: string; description: string; icon: string; max: number; color: string; }
export const WEAPONS: Record<Weapon, { name: string; mark: string; detail: string }> = {
  staff: { name: '星火法杖', mark: '✦', detail: '自動追擊最近敵人，保持距離作戰。' },
  blade: { name: '逐風短劍', mark: '⟐', detail: '近身扇形斬擊，穿過敵群的空隙。' },
  halo: { name: '守燈光環', mark: '◎', detail: '環繞光刃持續攻擊，掌握貼身距離。' },
};
export const CHAPTERS = [
  { name: '迷霧林地', sub: '那些未熄滅的微光', color: '#8bc6a1', asset: 'forest', boss: '苔角守望者', intro: '北方的燈塔熄滅後，森林開始忘記回家的路。沿著舊石道前進，找回守望者保存的第一枚火種。', ending: '巨鹿低下頭，角間的微光落入燈籠。第一座燈塔重新亮起；霧中浮現一條通往神殿的路。' },
  { name: '沉沒神殿', sub: '水面之下的回聲', color: '#71c5d1', asset: 'temple', boss: '沉默祭司', intro: '神殿的鐘聲仍在水下回響。古老祭司把第二枚火種封進石心，唯有穿過甬道，才能喚醒它。', ending: '石心裂開，第二枚火種升上水面。祭司留下最後一句話：「高塔裡的光，正在等待一位守燈人。」' },
  { name: '星火高塔', sub: '在長夜結束以前', color: '#c2a7ea', asset: 'tower', boss: '星火幽龍', intro: '高塔記錄著世界最後一個黎明。你帶著兩枚火種登上星盤，迎向盤旋於夜空的幽龍。', ending: '三枚火種聚成新的晨光。迷霧散去，營地的每一盞燈都亮了起來。遠征仍會繼續，而你總有地方可以回去。' },
];
export const MISSIONS = [
  { name: '重拾林間小徑', subtitle: '穿過林地，尋找守望者的足跡', chapter: 0 },
  { name: '喚醒第一盞燈', subtitle: '抵達鹿角祭壇，取回森林火種', chapter: 0 },
  { name: '潮汐留下的門', subtitle: '踏入神殿，辨認沉沒的符文', chapter: 1 },
  { name: '石心仍在跳動', subtitle: '喚醒祭司，重燃神殿燈火', chapter: 1 },
  { name: '穿越星屑長廊', subtitle: '沿著星圖，登上最後一座高塔', chapter: 2 },
  { name: '長夜的最後一頁', subtitle: '迎向幽龍，將晨光帶回營地', chapter: 2 },
];
export const UPGRADES: Upgrade[] = [
  { id: 'power', name: '鍛火', description: '所有攻擊傷害 +20%', icon: '✧', max: 5, color: 'gold' },
  { id: 'haste', name: '疾光', description: '普攻與自動技能冷卻縮短 12%', icon: '»', max: 4, color: 'blue' },
  { id: 'stride', name: '輕靈步伐', description: '移動速度 +12%', icon: '⌁', max: 3, color: 'green' },
  { id: 'vitality', name: '餘燼之心', description: '生命上限 +20，立刻恢復 20 生命', icon: '♡', max: 4, color: 'rose' },
  { id: 'reach', name: '長明', description: '攻擊範圍 +18%', icon: '◌', max: 3, color: 'blue' },
  { id: 'split', name: '分光', description: '法杖增加投射物；短劍擴大扇角；光環增加光刃', icon: '⋔', max: 3, color: 'gold' },
  { id: 'pierce', name: '穿透', description: '投射物可多穿透一名敵人；近戰傷害 +15%', icon: '↗', max: 3, color: 'blue' },
  { id: 'ember', name: '灼痕', description: '擊中使敵人燃燒，每秒受到額外傷害', icon: '♨', max: 3, color: 'rose' },
  { id: 'frost', name: '霜息', description: '攻擊使敵人減速，持續 1.5 秒', icon: '❄', max: 3, color: 'blue' },
  { id: 'storm', name: '連鎖閃電', description: '每 5 秒自動落雷，連鎖攻擊附近敵人', icon: 'ϟ', max: 3, color: 'gold' },
  { id: 'ward', name: '護燈者', description: '受到的傷害減少 12%', icon: '◇', max: 3, color: 'green' },
  { id: 'mend', name: '回春', description: '每 8 秒自動恢復 2 生命', icon: '+', max: 3, color: 'green' },
  { id: 'orbit', name: '伴星', description: '召喚繞行光刃，自動傷害碰觸的敵人', icon: '☄', max: 3, color: 'gold' },
  { id: 'nova', name: '星爆', description: '每 7 秒向四周釋放一道震波', icon: '✺', max: 3, color: 'rose' },
  { id: 'magnet', name: '引光', description: '經驗吸取範圍 +55%', icon: '⊹', max: 2, color: 'blue' },
  { id: 'fortune', name: '拾荒者', description: '房間火種收益 +20%', icon: '◈', max: 3, color: 'gold' },
  { id: 'focus', name: '洞察', description: '暴擊機率 +12%，暴擊造成雙倍傷害', icon: '⊙', max: 3, color: 'rose' },
  { id: 'secondwind', name: '不熄之火', description: '本次遠征可抵擋一次致命傷，恢復 40% 生命', icon: '♧', max: 1, color: 'green' },
];
export const FACILITIES: Record<Facility, { name: string; icon: string; description: string; max: number }> = {
  forge: { name: '守燈工坊', icon: '⚒', description: '依序解鎖短劍、光環，第三級強化起始攻擊。', max: 3 },
  beacon: { name: '營地燈塔', icon: '♧', description: '每級使遠征起始生命 +10。', max: 5 },
  archive: { name: '旅人書庫', icon: '▤', description: '依序增加起始引光、回春、護盾能力。', max: 3 },
};
export const ROOMS = ['林間遭遇', '守住火種', '迷霧岔路', '符文寶庫', '古道伏擊', '回聲深處', '最後防線', '燈塔守衛'];
export const DURATIONS = [95, 105, 120, 0, 115, 100, 125, 150];
const ENCOUNTERS = [
  {name:'林間遭遇',types:[0,1,2],pace:1},
  {name:'飛蛾微光',types:[1,1,0],pace:.9},
  {name:'衝撞之徑',types:[2,0,2],pace:1.15},
  {name:'石像甬道',types:[3,0,5],pace:1.2},
  {name:'幽影回聲',types:[4,1,4],pace:1.05},
  {name:'守衛防線',types:[5,2,0],pace:1.25},
];
export function encounter(run:Run){
  const random=rng(run.seed+7919),order=[1,2,3,4,5].map(id=>({id,key:random()})).sort((a,b)=>a.key-b.key).map(x=>x.id);
  const id=run.room===0?0:run.room===7?5:order[[1,2,4,5,6].indexOf(run.room)]??0;
  return ENCOUNTERS[id];
}
export const PUZZLE_SOLUTIONS = [[0,4,8], [1,3,7], [0,2,6,8], [2,4,5], [0,1,7,8], [3,4,5], [1,2,4,6], [0,3,5,8], [0,2,4,6,8]];
export function toggleTile(mask: number, tile: number): number {
  const x = tile % 3, y = Math.floor(tile / 3);
  for (const [dx,dy] of [[0,0], [1,0], [-1,0], [0,1], [0,-1]]) {
    const nx=x+dx, ny=y+dy;
    if(nx>=0 && nx<3 && ny>=0 && ny<3) mask ^= 1 << (ny*3+nx);
  }
  return mask;
}
export function puzzleInitial(index: number): number { return PUZZLE_SOLUTIONS[index%9].reduce(toggleTile, 511); }
export function puzzleHint(mask: number): number {
  for(let choice=1; choice<512; choice++) {
    let state=mask;
    for(let n=0;n<9;n++) if(choice & (1<<n)) state=toggleTile(state,n);
    if(state===511) return Array.from({length:9},(_,i)=>i).find(i=>choice&(1<<i))!;
  }
  return -1;
}
export function rng(seed: number): () => number {
  let n=seed>>>0;
  return ()=>{ n+=0x6D2B79F5; let t=n; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}
export function initialSave(): Save {
  return { version: 1, profile: { embers: 0, cleared: 0, facilities: { forge: 0, beacon: 0, archive: 0 }, totalKills: 0, expeditions: 0, bestHard: 0 }, run: null, settings: { sound: true } };
}
export function availableWeapons(profile: Profile): Weapon[] { return (['staff','blade','halo'] as Weapon[]).slice(0,Math.min(3,profile.facilities.forge+1)); }
export function facilityCost(id: Facility, level: number): number { return (id==='forge'?70:id==='archive'?65:50) + level*65; }
export function createRun(profile: Profile, mission: number, weapon: Weapon, difficulty: Difficulty, seed: number): Run {
  if(mission<0 || mission>5 || mission>profile.cleared) throw new Error('先完成前一段主線。');
  if(!availableWeapons(profile).includes(weapon)) throw new Error('尚未解鎖這把武器。');
  if(difficulty==='hard' && mission>=profile.cleared) throw new Error('通關後才會開啟困難遠征。');
  const hp=100+profile.facilities.beacon*10;
  const upgrades: Run['upgrades']={};
  if(profile.facilities.forge>=3) upgrades.power=1;
  if(profile.facilities.archive>=1) upgrades.magnet=1;
  if(profile.facilities.archive>=2) upgrades.mend=1;
  if(profile.facilities.archive>=3) upgrades.ward=1;
  return { id: `${Date.now()}-${seed}`, seed, mission, difficulty, weapon, room: 0, hp, maxHp: hp, embers: 0, kills: 0, elapsed: 0, upgrades, level: 1, xp: 0, puzzle: null, route: 'safe', secondWindUsed: false };
}
export function upgradeChoices(run: Run): Upgrade[] {
  const random=rng(run.seed+run.level*719+run.room*131);
  return UPGRADES.filter(u=>(run.upgrades[u.id]??0)<u.max).map(u=>({u,sort:random()})).sort((a,b)=>a.sort-b.sort).slice(0,3).map(x=>x.u);
}
export function applyUpgrade(run: Run, id: UpgradeId): void {
  const u=UPGRADES.find(u=>u.id===id);
  if(!u || (run.upgrades[id]??0)>=u.max) throw new Error('這項能力已達上限。');
  run.upgrades[id]=(run.upgrades[id]??0)+1;
  if(id==='vitality') {run.maxHp+=20; run.hp=Math.min(run.maxHp,run.hp+20);}
}
export function finishRoom(run: Run, skippedPuzzle=false): Run {
  const next=structuredClone(run);
  const reward=run.room===3?(skippedPuzzle?0:22):Math.round((run.route==='risk'?20:14)*(1+(run.upgrades.fortune??0)*.2));
  next.embers+=reward; next.room++; next.puzzle=null;
  return next;
}
export function settle(save: Save, outcome: 'victory' | 'defeat' | 'retreat'): {save: Save; earned: number} {
  if(!save.run) return {save,earned:0};
  const next=structuredClone(save), run=next.run!;
  const earned=outcome==='defeat'?Math.floor(run.embers/2):run.embers+(outcome==='victory'?45:0);
  next.profile.embers+=earned; next.profile.totalKills+=run.kills; next.profile.expeditions++;
  if(outcome==='victory') { next.profile.cleared=Math.max(next.profile.cleared,run.mission+1); if(run.difficulty==='hard') next.profile.bestHard++; }
  next.run=null;
  return {save:next,earned};
}
export function buyFacility(save: Save, id: Facility): Save {
  if(save.run) throw new Error('返回營地後才能升級。');
  const facility=FACILITIES[id], level=save.profile.facilities[id];
  if(!facility || level>=facility.max) throw new Error('已達最高等級。');
  const cost=facilityCost(id,level);
  if(save.profile.embers<cost) throw new Error('火種不足，再完成一趟遠征吧。');
  const next=structuredClone(save); next.profile.embers-=cost; next.profile.facilities[id]++;
  return next;
}
export function validateSave(value: unknown): Save {
  const fail=()=>{throw new Error('存檔格式或版本不符，原有進度尚未變更。');};
  if(!value || typeof value!=='object') return fail();
  const s=value as Save;
  const integer=(v:unknown,max=1e9)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
  const finite=(v:unknown,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
  if(s.version!==1 || !s.profile || !s.settings || typeof s.settings.sound!=='boolean') return fail();
  const p=s.profile;
  if(!integer(p.embers)||!integer(p.cleared,6)||!integer(p.totalKills)||!integer(p.expeditions)||!integer(p.bestHard)||!p.facilities) return fail();
  for(const id of Object.keys(FACILITIES) as Facility[]) if(!integer(p.facilities[id],FACILITIES[id].max)) return fail();
  if(s.run!==null) {
    const r=s.run;
    if(!r || typeof r.id!=='string'||r.id.length>100||!integer(r.seed,4294967295)||!integer(r.mission,5)||r.mission>p.cleared||!integer(r.room,8)||!availableWeapons(p).includes(r.weapon)||!['normal','hard'].includes(r.difficulty)||!['safe','risk'].includes(r.route)) return fail();
    if(r.difficulty==='hard'&&r.mission>=p.cleared) return fail();
    if(!finite(r.hp,10000)||!finite(r.maxHp,10000)||r.maxHp<1||r.hp>r.maxHp||!integer(r.embers)||!integer(r.kills)||!finite(r.elapsed)||!integer(r.level,1000)||r.level<1||!finite(r.xp)||typeof r.secondWindUsed!=='boolean'||!r.upgrades||typeof r.upgrades!=='object') return fail();
    for(const [id,n] of Object.entries(r.upgrades)) {const u=UPGRADES.find(u=>u.id===id); if(!u||!integer(n,u.max)) return fail();}
    if(r.puzzle!==null&&(!r.puzzle||!integer(r.puzzle.mask,511)||!integer(r.puzzle.moves,100000))) return fail();
  }
  return structuredClone(s);
}
