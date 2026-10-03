export interface EnemyDefinition {
  id:string; name:string; boss:boolean; behavior:string;
  hp:number; speed:number; size:number; radius:number; experience:number;
  texture:string; frame:number;
}
// The original 0–8 IDs stay stable for existing combat checks and checkpoints.
export const ENEMIES:readonly EnemyDefinition[] = [
  {id:'moss-slime',name:'苔泥怪',boss:false,behavior:'chase',hp:14,speed:34,size:43,radius:12,experience:1,texture:'enemies',frame:0},
  {id:'violet-moth',name:'微光飛蛾',boss:false,behavior:'hover',hp:10,speed:47,size:43,radius:12,experience:1,texture:'enemies',frame:1},
  {id:'red-beetle',name:'赤甲蟲',boss:false,behavior:'beetle',hp:28,speed:37,size:43,radius:12,experience:1,texture:'enemies',frame:2},
  {id:'stone-thrower',name:'投石像',boss:false,behavior:'stone',hp:35,speed:22,size:43,radius:12,experience:1,texture:'enemies',frame:3},
  {id:'purple-wraith',name:'幽影',boss:false,behavior:'spell',hp:22,speed:32,size:43,radius:12,experience:1,texture:'enemies',frame:4},
  {id:'armored-guard',name:'持盾守衛',boss:false,behavior:'guard',hp:65,speed:26,size:57,radius:17,experience:4,texture:'enemies',frame:5},
  {id:'moss-stag',name:'苔角守望者',boss:true,behavior:'stag',hp:4500,speed:34,size:142,radius:38,experience:30,texture:'enemies',frame:6},
  {id:'stone-priest',name:'沉默祭司',boss:true,behavior:'priest',hp:6500,speed:24,size:142,radius:38,experience:30,texture:'enemies',frame:7},
  {id:'starfire-dragon',name:'星火幽龍',boss:true,behavior:'dragon',hp:7000,speed:36,size:142,radius:38,experience:30,texture:'enemies',frame:8},
  {id:'sand-scorpion',name:'沙伏蠍',boss:false,behavior:'thrust',hp:28,speed:34,size:53,radius:14,experience:1,texture:'enemies-mainline-1',frame:0},
  {id:'spore-fiend',name:'孢囊妖',boss:false,behavior:'poison',hp:30,speed:25,size:53,radius:14,experience:1,texture:'enemies-mainline-1',frame:1},
  {id:'ember-sentinel',name:'炎核礦衛',boss:false,behavior:'falling-fire',hp:40,speed:25,size:57,radius:17,experience:1,texture:'enemies-mainline-1',frame:2},
  {id:'frost-hunter',name:'冰矛獵手',boss:false,behavior:'javelin',hp:30,speed:30,size:53,radius:14,experience:1,texture:'enemies-mainline-1',frame:3},
  {id:'sand-worm',name:'裂砂蟲王',boss:true,behavior:'burrow',hp:8000,speed:30,size:142,radius:38,experience:30,texture:'enemies-mainline-1',frame:4},
  {id:'thorn-hive',name:'荊棘母巢',boss:true,behavior:'spores',hp:8600,speed:20,size:142,radius:38,experience:30,texture:'enemies-mainline-1',frame:5},
  {id:'furnace-colossus',name:'熔爐巨像',boss:true,behavior:'hammer-fan',hp:9300,speed:24,size:142,radius:38,experience:30,texture:'enemies-mainline-1',frame:6},
  {id:'frost-wolf',name:'霜牙狼王',boss:true,behavior:'wolf-dash',hp:10000,speed:37,size:142,radius:38,experience:30,texture:'enemies-mainline-1',frame:7},
  {id:'wind-demon',name:'追風翼魔',boss:false,behavior:'wind-fan',hp:28,speed:35,size:53,radius:14,experience:1,texture:'enemies-mainline-2',frame:0},
  {id:'crystal-guard',name:'晶盾衛',boss:false,behavior:'shield',hp:44,speed:24,size:57,radius:17,experience:1,texture:'enemies-mainline-2',frame:1},
  {id:'moon-assassin',name:'月影刺客',boss:false,behavior:'leap',hp:28,speed:32,size:53,radius:14,experience:1,texture:'enemies-mainline-2',frame:2},
  {id:'parasite-healer',name:'寄生巫醫',boss:false,behavior:'heal',hp:32,speed:21,size:53,radius:14,experience:1,texture:'enemies-mainline-2',frame:3},
  {id:'thunder-eagle',name:'雷翼鷹王',boss:true,behavior:'wing-lightning',hp:12000,speed:33,size:142,radius:38,experience:30,texture:'enemies-mainline-2',frame:4},
  {id:'mirror-guardian',name:'鏡甲巨衛',boss:true,behavior:'mirror-shield',hp:13000,speed:23,size:142,radius:38,experience:30,texture:'enemies-mainline-2',frame:5},
  {id:'eclipse-queen',name:'月蝕女王',boss:true,behavior:'moon-dance',hp:14000,speed:30,size:142,radius:38,experience:30,texture:'enemies-mainline-2',frame:6},
  {id:'hollow-tree',name:'枯心樹王',boss:true,behavior:'root-seed',hp:15000,speed:20,size:142,radius:38,experience:30,texture:'enemies-mainline-2',frame:7},
  {id:'lightning-puppet',name:'引雷傀儡',boss:false,behavior:'lightning-mark',hp:34,speed:25,size:53,radius:14,experience:1,texture:'enemies-mainline-3',frame:0},
  {id:'sand-cultist',name:'喚砂祭徒',boss:false,behavior:'summon',hp:32,speed:22,size:53,radius:14,experience:1,texture:'enemies-mainline-3',frame:1},
  {id:'tide-singer',name:'潮汐歌者',boss:false,behavior:'water-ring',hp:30,speed:26,size:53,radius:14,experience:1,texture:'enemies-mainline-3',frame:2},
  {id:'rift-walker',name:'虛隙行者',boss:false,behavior:'rift-slash',hp:32,speed:30,size:53,radius:14,experience:1,texture:'enemies-mainline-3',frame:3},
  {id:'thunder-commander',name:'雷霆督軍',boss:true,behavior:'lightning-bands',hp:16000,speed:25,size:142,radius:38,experience:30,texture:'enemies-mainline-3',frame:4},
  {id:'sand-pharaoh',name:'沙冕法老',boss:true,behavior:'pharaoh',hp:17500,speed:23,size:142,radius:38,experience:30,texture:'enemies-mainline-3',frame:5},
  {id:'abyss-emperor',name:'深淵海皇',boss:true,behavior:'tide-wave',hp:19000,speed:25,size:142,radius:38,experience:30,texture:'enemies-mainline-3',frame:6},
  {id:'rift-watcher',name:'裂界監視者',boss:true,behavior:'rift-pair',hp:20500,speed:26,size:142,radius:38,experience:30,texture:'enemies-mainline-3',frame:7},
  {id:'bone-drake',name:'骨翼龍裔',boss:false,behavior:'bone-breath',hp:36,speed:27,size:57,radius:16,experience:1,texture:'enemies-mainline-4',frame:0},
  {id:'black-flame-knight',name:'黑焰鎧騎',boss:false,behavior:'ember-dash',hp:42,speed:30,size:57,radius:17,experience:1,texture:'enemies-mainline-4',frame:1},
  {id:'light-lancer',name:'光槍裁決者',boss:false,behavior:'delayed-beam',hp:32,speed:25,size:53,radius:14,experience:1,texture:'enemies-mainline-4',frame:2},
  {id:'night-banner',name:'夜幕旗衛',boss:false,behavior:'rally',hp:38,speed:24,size:57,radius:17,experience:1,texture:'enemies-mainline-4',frame:3},
  {id:'light-devourer',name:'湮光執燈者',boss:false,behavior:'devour',hp:38,speed:26,size:53,radius:14,experience:1,texture:'enemies-mainline-4',frame:4},
  {id:'bone-dragon',name:'骸焰古龍',boss:true,behavior:'bone-rain',hp:23000,speed:25,size:142,radius:38,experience:30,texture:'enemies-mainline-4',frame:5},
  {id:'black-sun-king',name:'黑日君主',boss:true,behavior:'black-sun',hp:25500,speed:27,size:142,radius:38,experience:30,texture:'enemies-mainline-4',frame:6},
  {id:'fallen-angel',name:'失序天使',boss:true,behavior:'angel',hp:28000,speed:28,size:142,radius:38,experience:30,texture:'enemies-mainline-4',frame:7},
  {id:'night-regent',name:'永夜攝政',boss:true,behavior:'combined',hp:31500,speed:27,size:142,radius:38,experience:30,texture:'enemies-mainline-4',frame:8},
  {id:'lightless-king',name:'噬光之王',boss:true,behavior:'final-king',hp:35000,speed:28,size:142,radius:38,experience:30,texture:'enemies-mainline-4',frame:9},
];
export function isBossEnemy(type:number):boolean{return ENEMIES[type].boss;}
export function enemyType(id:string):number{return ENEMIES.findIndex(e=>e.id===id);}
export function enemyHealth(type:number,chapter:number,room:number,hard:boolean):number{
  const e=ENEMIES[type];
  const hp=e.boss?e.hp:e.hp*1.2*(1+Math.min(chapter,2)*.28+room*.08)*1.12**Math.max(0,chapter-2);
  return hp*(hard?1.35:1);
}
export function enemyDamage(amount:number,chapter:number):number{return amount*1.1**Math.max(0,chapter-2);}
