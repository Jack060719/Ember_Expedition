import { CHARACTERS, DEFAULT_CHARACTER, availableCharacters, type CharacterId } from './characters.ts';
import { UPGRADES, type Upgrade, type UpgradeId } from './upgrades.ts';
import { EVOLUTIONS, availableWeapons, type Weapon } from './weapons.ts';
import { NEW_CHAPTERS, chapterEmberMultiplier, mainlineFacilityLimit, mainlineFacilityCost, firstClearBonus } from './mainline.ts';
import { enemyType } from './enemies.ts';
import { PET_LIMIT, rollPetEncounter, validPetState, type PetId, type PetEncounter } from './pets.ts';
export { CHARACTERS, DEFAULT_CHARACTER, availableCharacters, type CharacterId } from './characters.ts';
export { UPGRADES, AUTO_UPGRADES, type Upgrade, type UpgradeId, type UpgradeCategory } from './upgrades.ts';
export { WEAPONS, EVOLUTIONS, availableWeapons, type Weapon } from './weapons.ts';

export type Difficulty = 'normal' | 'hard';
export type Facility = 'forge' | 'beacon' | 'archive';
export interface Profile { embers: number; cleared: number; facilities: Record<Facility, number>; totalKills: number; expeditions: number; bestHard: number; ownedPets:PetId[]; petSlots:number; equippedPets:PetId[]; }
export interface Run {
  id: string; seed: number; mission: number; difficulty: Difficulty; weapon: Weapon; character: CharacterId;
  room: number; hp: number; maxHp: number; embers: number; kills: number; elapsed: number;
  upgrades: Partial<Record<UpgradeId, number>>; level: number; xp: number;
  growth: { damage: number; experience: number; embers: number }; secondWindUsed: boolean;
  pets:PetId[]; petEncounter:PetEncounter|null;
}
export interface Save { version: 5; profile: Profile; run: Run | null; settings: { sound: boolean; preferredCharacter: CharacterId }; }
export const CHAPTERS = [
  { name: '迷霧林地', sub: '那些未熄滅的微光', color: '#8bc6a1', asset: 'forest', boss: '苔角守望者', intro: '北方的燈塔熄滅後，森林開始忘記回家的路。沿著舊石道前進，找回守望者保存的第一枚火種。', ending: '巨鹿低下頭，角間的微光落入燈籠。第一座燈塔重新亮起；霧中浮現一條通往神殿的路。' },
  { name: '沉沒神殿', sub: '水面之下的回聲', color: '#71c5d1', asset: 'temple', boss: '沉默祭司', intro: '神殿的鐘聲仍在水下回響。古老祭司把第二枚火種封進石心，唯有穿過甬道，才能喚醒它。', ending: '石心裂開，第二枚火種升上水面。祭司留下最後一句話：「高塔裡的光，正在等待一位守燈人。」' },
  { name: '星火高塔', sub: '在長夜結束以前', color: '#c2a7ea', asset: 'tower', boss: '星火幽龍', intro: '高塔記錄著世界最後一個黎明。你帶著兩枚火種登上星盤，迎向盤旋於夜空的幽龍。', ending: '三枚火種聚成新的晨光。迷霧散去，營地的每一盞燈都亮了起來。遠征仍會繼續，而你總有地方可以回去。' },
  ...NEW_CHAPTERS,
];
export const MISSIONS = [
  { name: '重拾林間小徑', subtitle: '穿過林地，尋找守望者的足跡', chapter: 0 },
  { name: '喚醒第一盞燈', subtitle: '抵達鹿角祭壇，取回森林火種', chapter: 0 },
  { name: '潮汐留下的門', subtitle: '踏入神殿，辨認沉沒的符文', chapter: 1 },
  { name: '石心仍在跳動', subtitle: '喚醒祭司，重燃神殿燈火', chapter: 1 },
  { name: '穿越星屑長廊', subtitle: '沿著星圖，登上最後一座高塔', chapter: 2 },
  { name: '長夜的最後一頁', subtitle: '迎向幽龍，將晨光帶回營地', chapter: 2 },
  ...NEW_CHAPTERS.flatMap((c,i)=>c.missions.map((name,part)=>({name,subtitle:part?`挑戰${c.boss}，重燃區域燈火`:`穿越${c.name}，留意${c.enemyName}`,chapter:i+3}))),
];
export const FACILITIES: Record<Facility, { name: string; icon: string; description: string; max: number }> = {
  forge: { name: '守燈工坊', icon: '⚒', description: '每級永久傷害 +8%；前兩級解鎖短劍、光環。', max: 60 },
  beacon: { name: '營地燈塔', icon: '♧', description: '每級永久生命 +10，提高下一次遠征的起始生命與上限。', max: 60 },
  archive: { name: '旅人書庫', icon: '▤', description: '每級經驗與火種收益 +3%；前三級依序帶入引光、回春、護燈者。', max: 20 },
};
export const ROOMS = ['林間遭遇', '守住火種', '迷霧湧動', '古道伏擊', '回聲深處', '最後防線', '燈塔守衛'];
export const DURATIONS = [50, 55, 60, 60, 65, 70, 90];
export const SYNERGIES = [
  {id:'froststorm',name:'霜雷共鳴',description:'雷電對減速目標增傷，並凍緩整條連鎖',requires:{storm:2,frost:2}},
  {id:'wildfire',name:'餘燼連爆',description:'燃燒中的敵人被擊倒時爆炸，引燃附近怪群',requires:{ember:2,nova:2}},
] as const;
export function meetsRequirements(run:Run,requires:Partial<Record<UpgradeId,number>>){return Object.entries(requires).every(([id,n])=>(run.upgrades[id as UpgradeId]??0)>=n!);}
export function isEvolved(run:Run){return meetsRequirements(run,EVOLUTIONS[run.weapon].requires);}
export function hasSynergy(run:Run,id:typeof SYNERGIES[number]['id']){return meetsRequirements(run,SYNERGIES.find(s=>s.id===id)!.requires);}
export function experienceForLevel(level:number){return (12+level*6)*11;}
export function permanentGrowth(profile:Profile){return {damage:profile.facilities.forge*.08,experience:profile.facilities.archive*.03,embers:profile.facilities.archive*.03};}
const ENCOUNTERS = [
  {name:'林間遭遇',types:[0,1,2],pace:1},
  {name:'飛蛾微光',types:[1,1,0],pace:.9},
  {name:'衝撞之徑',types:[2,0,2],pace:1.15},
  {name:'石像甬道',types:[0,0,1,3,0,5],pace:1.05},
  {name:'幽影回聲',types:[1,0,1,0,4],pace:.95},
  {name:'守衛防線',types:[0,1,0,2,0,5],pace:1},
];
export function encounter(run:Run){
  const random=rng(run.seed+7919),order=[1,2,3,4,5].map(id=>({id,key:random()})).sort((a,b)=>a.key-b.key).map(x=>x.id);
  const id=run.room===0?0:run.room===6?5:order[run.room-1]??0;
  const base=ENCOUNTERS[id],chapter=MISSIONS[run.mission].chapter;
  if(chapter<3)return base;
  const added=NEW_CHAPTERS[chapter-3],type=enemyType(added.enemy);
  return {name:`${added.name} · ${run.room<3?'前哨遭遇':'混合怪潮'}`,types:run.room<3?[0,1,2,type]:[...base.types,type,type],pace:base.pace};
}
export function bossType(chapter:number):number{return chapter<3?6+chapter:enemyType(NEW_CHAPTERS[chapter-3].bossId);}
export function facilityLimit(id:Facility,profile:Profile):number{return mainlineFacilityLimit(id,Math.min(profile.cleared,MISSIONS.length-1));}
export function rng(seed: number): () => number {
  let n=seed>>>0;
  return ()=>{ n+=0x6D2B79F5; let t=n; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}
export function initialSave(): Save {
  return { version: 5, profile: { embers: 0, cleared: 0, facilities: { forge: 0, beacon: 0, archive: 0 }, totalKills: 0, expeditions: 0, bestHard: 0, ownedPets:[], petSlots:1, equippedPets:[] }, run: null, settings: { sound: true, preferredCharacter: DEFAULT_CHARACTER } };
}
export function facilityCost(id: Facility, level: number): number { return mainlineFacilityCost(id,level); }
export function startingLoadout(profile: Profile, character: CharacterId = DEFAULT_CHARACTER): Pick<Run,'hp'|'maxHp'|'upgrades'|'growth'> {
  const upgrades: Run['upgrades']={};
  if(profile.facilities.archive>=1) upgrades.magnet=1;
  if(profile.facilities.archive>=2) upgrades.mend=1;
  if(profile.facilities.archive>=3) upgrades.ward=1;
  for(const [id,level] of Object.entries(CHARACTERS[character].startingUpgrades)){
    const upgrade=UPGRADES.find(u=>u.id===id)!;
    upgrades[upgrade.id]=Math.min(upgrade.max,(upgrades[upgrade.id]??0)+level);
  }
  const hp=100+profile.facilities.beacon*10+(upgrades.vitality??0)*20;
  return { hp, maxHp: hp, upgrades, growth: permanentGrowth(profile) };
}
export function createRun(profile: Profile, mission: number, weapon: Weapon, difficulty: Difficulty, seed: number, character: CharacterId = DEFAULT_CHARACTER): Run {
  if(!Number.isInteger(mission) || mission<0 || mission>=MISSIONS.length || mission>profile.cleared) throw new Error('先完成前一段主線。');
  if(!availableWeapons(profile).includes(weapon)) throw new Error('尚未解鎖這把武器。');
  if(!availableCharacters(profile).includes(character)) throw new Error('尚未解鎖這位角色。');
  if(difficulty==='hard' && mission>=profile.cleared) throw new Error('通關後才會開啟困難遠征。');
  return { id: `${Date.now()}-${seed}`, seed, mission, difficulty, weapon, character, room: 0, ...startingLoadout(profile,character), embers: 0, kills: 0, elapsed: 0, level: 1, xp: 0, secondWindUsed: false, pets:profile.equippedPets.slice(0,PET_LIMIT), petEncounter:null };
}
export function preparePetEncounter(save:Save):Save{
  const next=structuredClone(save),r=next.run;
  if(r&&r.room<ROOMS.length&&r.petEncounter===null)r.petEncounter=rollPetEncounter({chapter:MISSIONS[r.mission].chapter,room:r.room,boss:r.room===ROOMS.length-1&&r.mission%2===1},next.profile.ownedPets,rng(r.seed^Math.imul(r.room+1,104729)^0x504554));
  return next;
}
export function upgradeChoices(run: Run): Upgrade[] {
  const random=rng(run.seed+run.level*719+run.room*131);
  const pool:Upgrade[]=UPGRADES.filter(u=>(run.upgrades[u.id]??0)<u.max).map(u=>({u,sort:random()})).sort((a,b)=>a.sort-b.sort).map(x=>x.u);
  const needed=Object.entries(EVOLUTIONS[run.weapon].requires).filter(([id,n])=>(run.upgrades[id as UpgradeId]??0)<n!);
  const focused=pool.find(u=>needed.some(([id])=>id===u.id));
  const skill=pool.find(u=>u.category==='auto'&&!(run.upgrades[u.id]??0));
  const selected=[focused,skill].filter((u):u is Upgrade=>!!u);
  const choices=[...new Set([...selected,...pool])].slice(0,3);
  const continuing=pool.find(u=>!choices.slice(0,2).includes(u)&&(
    u.category==='auto'&&(run.upgrades[u.id]??0)>0||SYNERGIES.some(s=>
      Object.entries(s.requires).some(([id,n])=>id===u.id&&(run.upgrades[u.id]??0)<n)&&
      Object.keys(s.requires).some(id=>(run.upgrades[id as UpgradeId]??0)>0))));
  if(choices.length===3&&continuing&&random()<.5)choices[2]=continuing;
  return choices;
}
export function applyUpgrade(run: Run, id: UpgradeId): void {
  const u=UPGRADES.find(u=>u.id===id);
  if(!u || (run.upgrades[id]??0)>=u.max) throw new Error('這項能力已達上限。');
  run.upgrades[id]=(run.upgrades[id]??0)+1;
  if(id==='vitality') {run.maxHp+=20; run.hp=Math.min(run.maxHp,run.hp+20);}
}
export function finishRoom(run: Run): Run {
  if(run.room>=ROOMS.length) return structuredClone(run);
  const next=structuredClone(run);
  const reward=Math.round((24+run.room*2)*chapterEmberMultiplier(MISSIONS[run.mission].chapter)*(1+(run.upgrades.fortune??0)*.2+run.growth.embers));
  next.embers+=reward; next.room++; next.hp=Math.min(next.maxHp,next.hp+Math.ceil(next.maxHp*.08));
  next.petEncounter=null;
  return next;
}
export function settle(save: Save, outcome: 'victory' | 'defeat' | 'retreat'): {save: Save; earned: number} {
  if(!save.run) return {save,earned:0};
  const next=structuredClone(save), run=next.run!;
  const chapter=MISSIONS[run.mission].chapter;
  const earned=outcome==='defeat'?Math.floor(run.embers/2):run.embers+(outcome==='victory'?Math.round(45*chapterEmberMultiplier(chapter))+firstClearBonus(chapter,run.mission,next.profile.cleared):0);
  next.profile.embers+=earned; next.profile.totalKills+=run.kills; next.profile.expeditions++;
  if(outcome==='victory') { next.profile.cleared=Math.max(next.profile.cleared,run.mission+1); if(run.difficulty==='hard') next.profile.bestHard++; }
  next.run=null;
  return {save:next,earned};
}
export function buyFacility(save: Save, id: Facility): Save {
  if(save.run) throw new Error('返回營地後才能升級。');
  const facility=FACILITIES[id], level=save.profile.facilities[id];
  if(!facility || level>=facilityLimit(id,save.profile)) throw new Error('已達目前章節的最高等級。');
  const cost=facilityCost(id,level);
  if(save.profile.embers<cost) throw new Error('火種不足，再完成一趟遠征吧。');
  const next=structuredClone(save); next.profile.embers-=cost; next.profile.facilities[id]++;
  return next;
}
export function validateSave(value: unknown): Save {
  const fail=()=>{throw new Error('存檔格式或版本不符，原有進度尚未變更。');};
  if(!value || typeof value!=='object') return fail();
  const version=(value as {version?:number}).version,legacy=version===1;
  const s=structuredClone(value) as Save;
  const integer=(v:unknown,max=1e9)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
  const finite=(v:unknown,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
  if((version!==1&&version!==2&&version!==3&&version!==4&&version!==5) || !s.profile || !s.settings || typeof s.settings.sound!=='boolean') return fail();
  const p=s.profile;
  if(!integer(p.embers)||!integer(p.cleared,version===5?MISSIONS.length:6)||!integer(p.totalKills)||!integer(p.expeditions)||!integer(p.bestHard)||!p.facilities) return fail();
  for(const id of Object.keys(FACILITIES) as Facility[]) if(!integer(p.facilities[id],legacy?(id==='beacon'?5:3):version===5?facilityLimit(id,p):20)) return fail();
  const characters=availableCharacters(p);
  if(version===1||version===2)s.settings.preferredCharacter=DEFAULT_CHARACTER;
  if(!characters.includes(s.settings.preferredCharacter))return fail();
  if(s.run!==null) {
    const r=s.run;
    if(!r || typeof r.id!=='string'||r.id.length>100||!integer(r.seed,4294967295)||!integer(r.mission,version===5?MISSIONS.length-1:5)||r.mission>p.cleared||!integer(r.room,legacy?8:ROOMS.length)||!availableWeapons(p).includes(r.weapon)||!['normal','hard'].includes(r.difficulty)) return fail();
    if(version===1||version===2)r.character=DEFAULT_CHARACTER;
    if(!characters.includes(r.character))return fail();
    if(r.difficulty==='hard'&&r.mission>=p.cleared) return fail();
    if(!finite(r.hp,10000)||!finite(r.maxHp,10000)||r.maxHp<1||r.hp>r.maxHp||!integer(r.embers)||!integer(r.kills)||!finite(r.elapsed)||!integer(r.level,1000)||r.level<1||!finite(r.xp)||typeof r.secondWindUsed!=='boolean'||!r.upgrades||typeof r.upgrades!=='object') return fail();
    for(const [id,n] of Object.entries(r.upgrades)) {const u=UPGRADES.find(u=>u.id===id); if(!u||!integer(n,u.max)) return fail();}
    if(legacy){
      const old=r as Run&{route?:string;puzzle?:{mask:number;moves:number}|null};
      if(!['safe','risk'].includes(old.route??'')||(old.puzzle!==null&&(!old.puzzle||!integer(old.puzzle.mask,511)||!integer(old.puzzle.moves,100000)))) return fail();
      r.room=r.room>3?r.room-1:r.room; r.growth=permanentGrowth(p);
      delete old.route; delete old.puzzle;
    }else if(!r.growth||!finite(r.growth.damage,version===5?FACILITIES.forge.max*.08:2)||!finite(r.growth.experience,1)||!finite(r.growth.embers,1)) return fail();
  }
  if(version!==4&&version!==5){
    p.ownedPets=[];p.petSlots=1;p.equippedPets=[];
    if(s.run){s.run.pets=[];s.run.petEncounter={room:s.run.room,pet:null,state:'none'};}
  }
  if(!validPetState(p,s.run))return fail();
  if(p.petSlots>1)p.embers=Math.min(1e9,p.embers+(p.petSlots===2?300:1200));
  p.petSlots=PET_LIMIT;p.equippedPets=p.equippedPets.slice(0,PET_LIMIT);
  if(s.run)s.run.pets=s.run.pets.slice(0,PET_LIMIT);
  s.version=5;
  return s;
}
