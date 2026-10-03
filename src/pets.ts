import type { Profile, Run, Save } from './core.ts';
import { assetPath } from './asset-path.ts';

export interface PetDefinition {
  name:string; attack:'shot'|'blast'|'pierce'|'claw'|'breath'|'fan'|'pulse'|'dash'|'return'|'chain'|'wave'|'beam'|'starlight'; damage:number; interval:number;
  tameSeconds:number; range:number; radius:number; targets:number; angle:number;
  firstChapter:number; lastChapter:number; bossOnly:boolean; color:number; spritePath:string;
}
export const PETS = {
  mossRabbit: {name:'苔光兔',attack:'shot',damage:10,interval:1.25,tameSeconds:8,range:280,radius:0,targets:1,angle:0,firstChapter:0,lastChapter:2,bossOnly:false,color:0xa8e8a3,spritePath:assetPath('/assets/pets/mossRabbit.png')},
  emberFox: {name:'焰尾狐',attack:'blast',damage:18,interval:1.2,tameSeconds:12,range:280,radius:45,targets:1,angle:0,firstChapter:0,lastChapter:2,bossOnly:false,color:0xffae6b,spritePath:assetPath('/assets/pets/emberFox.png')},
  frostOwl: {name:'霜羽鴞',attack:'pierce',damage:30,interval:1.2,tameSeconds:18,range:280,radius:0,targets:3,angle:0,firstChapter:1,lastChapter:2,bossOnly:false,color:0xa7e6ff,spritePath:assetPath('/assets/pets/frostOwl.png')},
  thunderLeopard: {name:'雷爪豹',attack:'claw',damage:42,interval:1.05,tameSeconds:24,range:260,radius:32,targets:1,angle:0,firstChapter:2,lastChapter:2,bossOnly:false,color:0xffdc7a,spritePath:assetPath('/assets/pets/thunderLeopard.png')},
  starDrake: {name:'星角幼龍',attack:'breath',damage:60,interval:1,tameSeconds:30,range:280,radius:180,targets:160,angle:70,firstChapter:2,lastChapter:2,bossOnly:true,color:0xcbb1ff,spritePath:assetPath('/assets/pets/starDrake.png')},
  sandLizard: {name:'沙晶蜥',attack:'fan',damage:80,interval:1.2,tameSeconds:32,range:280,radius:0,targets:1,angle:36,firstChapter:3,lastChapter:4,bossOnly:false,color:0x7de3df,spritePath:assetPath('/assets/pets/sandLizard.png')},
  magmaTurtle: {name:'熔甲龜',attack:'pulse',damage:95,interval:1.1,tameSeconds:34,range:260,radius:100,targets:160,angle:0,firstChapter:5,lastChapter:6,bossOnly:false,color:0xff8848,spritePath:assetPath('/assets/pets/magmaTurtle.png')},
  windFalcon: {name:'風翼隼',attack:'dash',damage:125,interval:1.15,tameSeconds:36,range:260,radius:22,targets:160,angle:0,firstChapter:7,lastChapter:8,bossOnly:false,color:0xb7efd8,spritePath:assetPath('/assets/pets/windFalcon.png')},
  moonCat: {name:'月影靈貓',attack:'return',damage:75,interval:1.2,tameSeconds:38,range:280,radius:0,targets:160,angle:20,firstChapter:9,lastChapter:10,bossOnly:false,color:0xc5a6ee,spritePath:assetPath('/assets/pets/moonCat.png')},
  thunderDeer: {name:'雷角戰鹿',attack:'chain',damage:210,interval:1.1,tameSeconds:40,range:280,radius:110,targets:4,angle:0,firstChapter:11,lastChapter:12,bossOnly:false,color:0xffdf75,spritePath:assetPath('/assets/pets/thunderDeer.png')},
  tideWhale: {name:'潮歌靈鯨',attack:'wave',damage:245,interval:1.1,tameSeconds:42,range:280,radius:90,targets:160,angle:0,firstChapter:13,lastChapter:14,bossOnly:false,color:0x87e4ed,spritePath:assetPath('/assets/pets/tideWhale.png')},
  crimsonDragon: {name:'赤焰飛龍',attack:'breath',damage:300,interval:1.15,tameSeconds:44,range:280,radius:210,targets:160,angle:85,firstChapter:15,lastChapter:16,bossOnly:false,color:0xff916d,spritePath:assetPath('/assets/pets/crimsonDragon.png')},
  dawnGriffin: {name:'晨曦獅鷲',attack:'beam',damage:330,interval:1.1,tameSeconds:46,range:300,radius:14,targets:160,angle:0,firstChapter:17,lastChapter:18,bossOnly:false,color:0xf3df9c,spritePath:assetPath('/assets/pets/dawnGriffin.png')},
  dawnStarDragon: {name:'曙光星龍',attack:'starlight',damage:350,interval:1.05,tameSeconds:48,range:300,radius:220,targets:160,angle:90,firstChapter:19,lastChapter:19,bossOnly:false,color:0xffe9ae,spritePath:assetPath('/assets/pets/dawnStarDragon.png')},
} as const satisfies Record<string,PetDefinition>;
export type PetId = keyof typeof PETS;
export const PET_IDS = Object.keys(PETS) as PetId[];
export const TAME_RADIUS = 56;
export const PET_LIMIT = 1;
export interface PetRoom { chapter:number; room:number; boss:boolean; }
export type PetEncounter = {room:number;pet:null;state:'none'} | {room:number;pet:PetId;state:'available'|'tamed'|'left'};

export function eligiblePets(room:PetRoom,owned:readonly PetId[]):PetId[]{
  if(!room.boss&&(room.chapter<1||room.room<4||room.room>(room.chapter>=3?5:6)))return [];
  return PET_IDS.filter(id=>{const p=PETS[id];return !owned.includes(id)&&room.chapter>=p.firstChapter&&room.chapter<=p.lastChapter&&(!p.bossOnly||room.boss);});
}
export function rollPetEncounter(room:PetRoom,owned:readonly PetId[],random:()=>number):PetEncounter{
  const pool=eligiblePets(room,owned);
  if(!pool.length||random()>=(room.boss?.5:.15))return {room:room.room,pet:null,state:'none'};
  return {room:room.room,pet:pool[Math.floor(random()*pool.length)],state:'available'};
}
export function tameProgress(progress:number,inside:boolean,dt:number,required:number):number{
  return Math.max(0,Math.min(required,progress+(inside?dt:-dt*.5)));
}
export function equipPets(save:Save,pets:PetId[]):Save{
  if(save.run)throw new Error('遠征結束後才能更換寵物。');
  if(pets.length>PET_LIMIT||new Set(pets).size!==pets.length||pets.some(id=>!save.profile.ownedPets.includes(id)))throw new Error('一次只能攜帶一隻已收藏的寵物。');
  const next=structuredClone(save);next.profile.equippedPets=[...pets];return next;
}
// Only pet fields change: combat progress remains the saved room entrance.
export function claimPet(save:Save,runId:string,room:number,pet:PetId):Save{
  const r=save.run;
  if(!r||r.id!==runId||r.room!==room||r.petEncounter?.room!==room||r.petEncounter.pet!==pet)throw new Error('寵物遭遇已變更。');
  if(r.petEncounter.state==='tamed'&&save.profile.ownedPets.includes(pet))return structuredClone(save);
  if(r.petEncounter.state!=='available'||save.profile.ownedPets.includes(pet))throw new Error('這隻寵物已經收藏。');
  const next=structuredClone(save);next.profile.ownedPets.push(pet);next.run!.petEncounter={room,pet,state:'tamed'};
  if(next.run!.pets.length<PET_LIMIT){
    next.run!.pets.push(pet);
    if(next.profile.equippedPets.length<PET_LIMIT)next.profile.equippedPets.push(pet);
  }
  return next;
}
// Accept the original 1–3 slot save shape before validateSave reduces it to one pet.
export function validPetState(profile:Profile,run:Run|null):boolean{
  const list=(value:unknown,max:number):value is PetId[]=>Array.isArray(value)&&value.length<=max&&new Set(value).size===value.length&&value.every(id=>PET_IDS.includes(id));
  if(!Number.isInteger(profile.petSlots)||profile.petSlots<1||profile.petSlots>3||!list(profile.ownedPets,PET_IDS.length)||!list(profile.equippedPets,profile.petSlots)||profile.equippedPets.some(id=>!profile.ownedPets.includes(id)))return false;
  if(!run)return true;
  if(!list(run.pets,profile.petSlots)||run.pets.some(id=>!profile.ownedPets.includes(id)))return false;
  const e=run.petEncounter;
  if(e===null)return true;
  if(!e||e.room!==run.room)return false;
  if(e.state==='none')return e.pet===null;
  if(!PET_IDS.includes(e.pet as PetId))return false;
  return e.state==='tamed'?profile.ownedPets.includes(e.pet!):(e.state==='available'||e.state==='left')&&!profile.ownedPets.includes(e.pet!);
}
