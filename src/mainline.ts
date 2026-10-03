import type { Facility } from './core.ts';

// Chapter numbers in this module are zero-based, like MISSIONS.chapter.
export const MAINLINE_BATCHES = [
  { first: 3, last: 6, facilityCap: 30, emberStart: 2, emberEnd: 5 },
  { first: 7, last: 10, facilityCap: 40, emberStart: 6, emberEnd: 10 },
  { first: 11, last: 14, facilityCap: 50, emberStart: 11.5, emberEnd: 16 },
  { first: 15, last: 19, facilityCap: 60, emberStart: 17.6, emberEnd: 24 },
] as const;

export const NEW_CHAPTERS = [
  { name:'赤砂峽谷', sub:'砂海中未冷的燈芯', color:'#d8a16a', asset:'canyon', enemy:'sand-scorpion', enemyName:'沙伏蠍', threat:'預警直線突刺', bossId:'sand-worm', boss:'裂砂蟲王', petName:'沙晶蜥', intro:'赤砂掩住通往北方的古道。循著砂面下的震動，穿過峽谷，把深埋的火種帶回地面。', ending:'蟲王的甲殼落入沙中，峽谷重新安靜。燈火照見沼澤邊緣一條仍可行走的路。', missions:['穿過赤砂古道','喚醒砂海燈火'] },
  { name:'荊棘沼澤', sub:'在孢霧退去之後', color:'#a6ba70', asset:'marsh', enemy:'spore-fiend', enemyName:'孢囊妖', threat:'短暫毒區', bossId:'thorn-hive', boss:'荊棘母巢', petName:'沙晶蜥', intro:'孢霧遮住沼澤的水面。留意即將鼓起的孢囊，沿著乾燥的苔地接近荊棘深處。', ending:'最後一枚孢囊熄滅，荊棘鬆開了舊燈座。霧散之處，礦坑的入口透出紅光。', missions:['循光穿過孢霧','剪開荊棘之心'] },
  { name:'熔火礦坑', sub:'山腹裡的餘溫', color:'#ed9a64', asset:'mine', enemy:'ember-sentinel', enemyName:'炎核礦衛', threat:'延遲落火', bossId:'furnace-colossus', boss:'熔爐巨像', petName:'熔甲龜', intro:'廢棄的礦道仍傳來錘聲。避開熾熱的落點，尋找熔爐巨像守住的火種。', ending:'巨錘落地，熔爐漸漸冷卻。礦工留下的燈火再度連起山道，通往霜封的隘口。', missions:['深入熾熱礦脈','熄下巨像之錘'] },
  { name:'霜封隘口', sub:'風雪中的足跡', color:'#a9d8ed', asset:'frost-pass', enemy:'frost-hunter', enemyName:'冰矛獵手', threat:'窄線投槍', bossId:'frost-wolf', boss:'霜牙狼王', petName:'熔甲龜', intro:'隘口的風雪掩去方向，冰矛的寒光卻暴露了獵手。讓燈火穿過狼群守住的雪線。', ending:'狼王停下追逐，雪中露出古老路標。越過隘口，雷聲從群峰間傳來。', missions:['穿越冰矛雪線','越過狼王隘口'] },
  { name:'風暴群峰', sub:'追逐雷光的山路', color:'#a3c9e8', asset:'storm-peaks', enemy:'wind-demon', enemyName:'追風翼魔', threat:'扇形風刃', bossId:'thunder-eagle', boss:'雷翼鷹王', petName:'風翼隼', intro:'狂風切開群峰間的石道。看清風刃的間隙，攜火登上雷翼盤旋的峰頂。', ending:'鷹王收攏雙翼，山間雷聲漸遠。雲下露出一座反射晨光的荒城。', missions:['沿風攀上群峰','點亮雷翼之巔'] },
  { name:'琉璃荒城', sub:'碎鏡映出的道路', color:'#8fd8cb', asset:'glass-city', enemy:'crystal-guard', enemyName:'晶盾衛', threat:'正面減傷', bossId:'mirror-guardian', boss:'鏡甲巨衛', petName:'風翼隼', intro:'荒城的晶盾仍朝向舊日敵人。繞到盾後，在鏡甲露出破綻時奪回燈火。', ending:'鏡甲碎裂，琉璃映出真正的天空。城外庭園正等待月光回來。', missions:['繞過琉璃盾牆','照見鏡甲破綻'] },
  { name:'月蝕庭園', sub:'月光落下的地方', color:'#c3a2dc', asset:'eclipse-garden', enemy:'moon-assassin', enemyName:'月影刺客', threat:'預警躍擊', bossId:'eclipse-queen', boss:'月蝕女王', petName:'月影靈貓', intro:'花影間的腳步轉瞬消失。辨認躍擊的落點，在月蝕降臨前抵達庭園中央。', ending:'女王的面紗散去，月光重新落在石階。庭園後方，腐根深林仍在低語。', missions:['踏入月影花徑','穿過女王月幕'] },
  { name:'腐根深林', sub:'被根鬚纏住的心', color:'#b0b979', asset:'root-forest', enemy:'parasite-healer', enemyName:'寄生巫醫', threat:'治療附近怪物', bossId:'hollow-tree', boss:'枯心樹王', petName:'月影靈貓', intro:'巫醫的低語讓枯木再次站起。穿過療癒怪群的根網，尋找被困在樹心的火種。', ending:'枯心裂開，根鬚不再攫住旅人的腳。林外要塞的雷光照亮下一段路。', missions:['斬斷寄生根網','重燃枯心燈火'] },
  { name:'雷鳴要塞', sub:'鐵牆之上的風雨', color:'#d9c779', asset:'thunder-fort', enemy:'lightning-puppet', enemyName:'引雷傀儡', threat:'標記落雷', bossId:'thunder-commander', boss:'雷霆督軍', petName:'雷角戰鹿', intro:'傀儡把雷雲牽向闖入者。離開閃光的標記，在交錯雷帶間走向要塞燈塔。', ending:'督軍的雷旗倒下，鐵牆恢復寂靜。沙漠深處，一座王陵的門緩緩開啟。', missions:['越過引雷城牆','擊落督軍雷旗'] },
  { name:'流沙王陵', sub:'埋藏王冠的砂', color:'#d6b679', asset:'sand-tomb', enemy:'sand-cultist', enemyName:'喚砂祭徒', threat:'限量召喚', bossId:'sand-pharaoh', boss:'沙冕法老', petName:'雷角戰鹿', intro:'祭徒喚醒王陵的砂衛。找到召喚者，循著壁畫上的燈火深入法老的寢殿。', ending:'砂冕落下，守陵者重歸沉睡。火光照亮一條通往沉星海淵的階梯。', missions:['阻斷喚砂祭儀','取回王陵火種'] },
  { name:'沉星海淵', sub:'海底仍有星光', color:'#82c8da', asset:'star-sea', enemy:'tide-singer', enemyName:'潮汐歌者', threat:'帶缺口的水環', bossId:'abyss-emperor', boss:'深淵海皇', petName:'潮歌靈鯨', intro:'潮歌把水流織成環。尋找波紋的缺口，帶著燈籠走向沉星的海底王座。', ending:'海皇收起浪潮，星光浮上海面。海床裂隙裡，一枚火種指向更深的黑暗。', missions:['穿過潮歌水環','平息海皇浪潮'] },
  { name:'虛空裂谷', sub:'兩道裂隙之間', color:'#b19adf', asset:'void-rift', enemy:'rift-walker', enemyName:'虛隙行者', threat:'預警位移後近斬', bossId:'rift-watcher', boss:'裂界監視者', petName:'潮歌靈鯨', intro:'行者從裂隙另一端拔刀。記住亮起的落點，穿過成對崩裂的虛空。', ending:'監視者閉上雙眼，裂隙逐一癒合。燈光落在遠方荒原的龍骨上。', missions:['跨越虛隙斷路','合上裂界之眼'] },
  { name:'龍骨荒原', sub:'古龍留下的餘焰', color:'#d6ad86', asset:'bone-wastes', enemy:'bone-drake', enemyName:'骨翼龍裔', threat:'定向吐息', bossId:'bone-dragon', boss:'骸焰古龍', petName:'赤焰飛龍', intro:'龍裔的吐息吹過荒原。沿著骨影間的空隙前進，面對仍守著舊火的古龍。', ending:'骨雨停歇，古龍的火焰化為一枚溫暖火種。黑日之下的熔城映入眼簾。', missions:['穿行骨翼荒原','接住古龍餘焰'] },
  { name:'黑日熔城', sub:'日光熄滅的街道', color:'#d39177', asset:'black-sun-city', enemy:'black-flame-knight', enemyName:'黑焰鎧騎', threat:'衝刺後留下殘焰', bossId:'black-sun-king', boss:'黑日君主', petName:'赤焰飛龍', intro:'鎧騎奔過街道，留下灼熱的殘焰。等待火帶散去，再走向黑日君主的高臺。', ending:'落刃止息，城中的黑焰逐漸熄滅。天隙裡透出通向聖域的光。', missions:['避開黑焰街道','熄滅黑日王火'] },
  { name:'天隙聖域', sub:'破碎天空的裁決', color:'#e1d5a2', asset:'sky-sanctum', enemy:'light-lancer', enemyName:'光槍裁決者', threat:'延遲光束', bossId:'fallen-angel', boss:'失序天使', petName:'晨曦獅鷲', intro:'裁決者舉槍，光束即將落下。辨認聖域中仍安全的道路，讓失序的羽翼安靜下來。', ending:'天使垂下光翼，天隙不再擴張。永夜王座的輪廓出現在聖域盡頭。', missions:['走過光槍聖階','平息失序羽翼'] },
  { name:'永夜王座', sub:'長夜最後的旗幟', color:'#a3a0cf', asset:'night-throne', enemy:'night-banner', enemyName:'夜幕旗衛', threat:'強化附近怪物', bossId:'night-regent', boss:'永夜攝政', petName:'晨曦獅鷲', intro:'夜幕旗幟讓守衛不肯退讓。拆開互相掩護的陣列，面對熟悉而交錯的威脅。', ending:'攝政的旗幟落地，王座後的門終於開啟。最後一座燈塔正吞沒遠方的光。', missions:['拆開夜幕旗陣','走過永夜王座'] },
  { name:'終焉燈塔', sub:'把晨光帶回世界', color:'#e8c98f', asset:'final-lighthouse', enemy:'light-devourer', enemyName:'湮光執燈者', threat:'遠近攻擊交替', bossId:'lightless-king', boss:'噬光之王', petName:'曙光星龍', intro:'執燈者守著沒有光的塔。你帶著旅途的火種登上最後石階，迎向噬光之王。', ending:'最後的黑暗退去，二十座燈塔相繼亮起。晨光越過山海，而你終於可以帶著所有故事回家。', missions:['登上終焉石階','重燃世界晨光'] },
] as const;

export function chapterEmberMultiplier(chapter:number):number {
  const batch=MAINLINE_BATCHES.find(b=>chapter>=b.first&&chapter<=b.last);
  return batch?batch.emberStart+(batch.emberEnd-batch.emberStart)*(chapter-batch.first)/(batch.last-batch.first):1;
}
export function mainlineFacilityLimit(id:Facility,cleared:number):number {
  if(id==='archive')return 20;
  let limit=20;
  for(const batch of MAINLINE_BATCHES)if(cleared>=batch.first*2)limit=batch.facilityCap;
  return limit;
}
export function mainlineFacilityCost(id:Facility,level:number):number {
  const oldLevel=Math.min(level,19);
  return (id==='forge'?70:id==='archive'?65:50)+oldLevel*65+Math.max(0,oldLevel-2)**2*5+Math.max(0,level-19)*150;
}
export function firstClearBonus(chapter:number,mission:number,cleared:number):number {
  return chapter>=3&&mission===cleared?Math.round(255*chapterEmberMultiplier(chapter)*2):0;
}
