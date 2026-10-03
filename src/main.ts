import './style.css';
import { assetPath } from './asset-path.ts';
import { CHAPTERS, MISSIONS, WEAPONS, FACILITIES, ROOMS, UPGRADES, encounter, availableWeapons, createRun, finishRoom, settle, buyFacility, facilityCost, facilityLimit, EVOLUTIONS, SYNERGIES, isEvolved, meetsRequirements, experienceForLevel, permanentGrowth, upgradeChoices, validateSave, type Save, type Run, type Weapon, type Difficulty, type Facility } from './core.ts';
import { loadSave, writeSave } from './storage.ts';
import { watchOffline, prepareOffline, checkForUpdates, applyUpdate, type OfflineState } from './offline.ts';
import { mountArena, type Arena } from './arena.ts';
import { CHARACTERS, availableCharacters, type CharacterId } from './characters.ts';
import { startingLoadout, preparePetEncounter } from './core.ts';
import { AUTO_UPGRADES, upgradeDescription } from './upgrades.ts';
import { PETS, PET_IDS, PET_LIMIT, claimPet, equipPets, type PetId } from './pets.ts';
import { finalBossPhase } from './chapter-attacks.ts';

const app=document.querySelector<HTMLDivElement>('#app')!;
let save:Save, selectedMission=0, selectedWeapon:Weapon='staff', difficulty:Difficulty='normal';
let tab:'expedition'|'camp'|'journal'='expedition';
let arena:{scene:Arena;game:Phaser.Game}|null=null;
let screen='camp', busy=false, saveError=false;
let offline:OfflineState={ready:false,working:false,update:false,message:'準備離線內容'};
let audio:AudioContext|undefined;
const $=(selector:string)=>document.querySelector<HTMLElement>(selector);
const esc=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const time=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const chapterNo=CHAPTERS.map((_,i)=>`第${['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'][i]}章`);
function toast(message:string){$('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),4300);}
function chime(notes=[440,660]){
  if(!save.settings.sound)return;
  try{audio??=new AudioContext();void audio.resume();notes.forEach((note,i)=>{const o=audio!.createOscillator(),g=audio!.createGain(),t=audio!.currentTime+i*.08;o.type='sine';o.frequency.value=note;g.gain.setValueAtTime(.025,t);g.gain.exponentialRampToValueAtTime(.0001,t+.3);o.connect(g);g.connect(audio!.destination);o.start(t);o.stop(t+.31);});}catch{/* Sound is optional. */}
}
async function persist(next:Save):Promise<boolean>{
  try{await writeSave(next);save=next;saveError=false;return true;}catch(e){saveError=true;toast((e as Error).message);return false;}
}
function click(selector:string,fn:()=>void){$(selector)?.addEventListener('click',fn);}
function closeModal(){document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove());}
function modal(html:string,close?:()=>void){
  closeModal();const el=document.createElement('div');el.className='modal-backdrop';el.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-label="遊戲選單">${html}</section>`;document.body.append(el);
  if(close)el.addEventListener('click',e=>{if(e.target===el){closeModal();close();}});
  el.querySelector<HTMLButtonElement>('button')?.focus();
}
function destroyArena(){if(arena){arena.game.destroy(true);arena=null;}}
function header(){return `<header class="topline"><button class="status-pill ${offline.ready?'ready':''}" id="offline">${offline.ready?'◇':'◷'} ${esc(offline.message)}</button><span class="currency">✦ ${save.profile.embers}<small>火種</small></span><button class="icon-button" id="settings" aria-label="設定與存檔">⚙</button></header>`;}
function characterLoadout(){
  const unlocked=availableCharacters(save.profile);
  return `<div class="loadout"><span class="micro-label">出戰角色 · 點選查看起手能力</span><div class="characters">${(Object.keys(CHARACTERS) as CharacterId[]).map(id=>{const c=CHARACTERS[id],selected=save.settings.preferredCharacter===id,locked=!unlocked.includes(id);return `<button data-character="${id}" class="character ${selected?'selected':''} ${locked?'locked':''}" aria-pressed="${selected}" aria-label="${c.name}，${locked?'尚未解鎖，可預覽':selected?'已選擇':'查看角色'}"><span class="character-portrait" style="background-image:url('${c.spritePath}')" aria-hidden="true"></span><strong>${c.name}</strong><small>${locked?'主線完成 '+c.requiredCleared+' 段解鎖':selected?'✓ 已選擇':'查看起手'}</small></button>`;}).join('')}</div><p class="weapon-note">${CHARACTERS[save.settings.preferredCharacter].description}可自由搭配已解鎖武器。</p></div>`;
}
function petTeam(pets:PetId[]){return `<div class="pet-team"><span>出戰寵物 · ${pets.length}/${PET_LIMIT}</span>${pets.length?pets.map(id=>`<span><img src="${PETS[id].spritePath}" alt="">${PETS[id].name}</span>`).join(''):'<small>尚未攜帶寵物</small>'}</div>`;}
function showPets(){
  const p=save.profile,locked=!!save.run;
  const attacks={shot:'單發光彈',blast:'半徑 45 爆破',pierce:'穿透最多 3 個敵人',claw:'近身單體爪擊',breath:'定向扇形吐息',fan:'三向晶刺，同輪對每個敵人命中一次',pulse:'追近敵人，半徑 100 震波',dash:'沿窄線穿梭突擊',return:'雙刃去程命中一次，回程各可再命中一次',chain:'雷電跳躍最多四敵，相鄰距離110',wave:'目標周圍半徑90水波',beam:'300距離、寬28的貫穿光束',starlight:'220距離90度吐息，另有目標周圍60光爆130傷害'};
  modal(`<span class="eyebrow">同行的微光</span><h2>寵物圖鑑與配隊</h2><p class="modal-sub">收藏 ${p.ownedPets.length}/${PET_IDS.length} · 每次最多攜帶一隻<br>傷害固定，不受營地與本局能力加成。${locked?'<br>遠征中僅可查看，結束後才能更換出戰寵物。':''}</p>${petTeam(save.run?.pets??p.equippedPets)}<div class="pet-list">${PET_IDS.map(id=>{const pet=PETS[id],owned=p.ownedPets.includes(id),equipped=p.equippedPets.includes(id);return `<article class="pet-card ${owned?'owned':''}"><img src="${pet.spritePath}" alt="${pet.name}"><div><h3>${pet.name}</h3><p>${pet.attack==='breath'?`半徑 ${pet.radius}、${pet.angle} 度吐息`:attacks[pet.attack]} · ${pet.damage} 傷害／${pet.interval} 秒<br>馴服 ${pet.tameSeconds} 秒 · ${pet.bossOnly?'第三章首領房':`第 ${pet.firstChapter+1}～${pet.lastChapter+1} 章`}</p><button class="small-button" data-pet="${id}" aria-pressed="${equipped}" ${locked||!owned?'disabled':''}>${!owned?'尚未收藏':equipped?'取消出戰':'選擇出戰'}</button></div></article>`;}).join('')}</div><p class="modal-sub">首領房 50% 可遇；一般房 15%。<br>第2～3章限第5～7房，第4章起限第5～6房。<br>走進光圈累積馴服，離圈每秒倒退 0.5 秒。<br>收藏保存後永久保留；本局已有寵物時，新馴服的只加入收藏。</p><button id="close-pets" class="primary">返回營地</button>`);
  const change=async(next:()=>Save)=>{if(busy)return;busy=true;try{if(await persist(next())){$('.toast')?.remove();showPets();}}catch(e){toast((e as Error).message);}busy=false;};
  document.querySelectorAll<HTMLButtonElement>('[data-pet]').forEach(b=>b.addEventListener('click',()=>void change(()=>{const id=b.dataset.pet as PetId,current=save.profile.equippedPets;return equipPets(save,current.includes(id)?[]:[id]);})));
  click('#close-pets',()=>{if(!busy)renderCamp();});
}
function showCharacter(id:CharacterId){
  if(busy||save.run)return;
  const c=CHARACTERS[id],unlocked=availableCharacters(save.profile).includes(id),starting=startingLoadout(save.profile,id);
  modal(`<span class="eyebrow">出戰角色</span><div class="character-preview"><span class="character-portrait" style="background-image:url('${c.spritePath}')" aria-hidden="true"></span><h2>${c.name}</h2></div><p class="modal-sub">${c.description}</p><div id="character-starting" class="character-starting"><strong>起始生命 ${starting.hp} / ${starting.maxHp}</strong>${Object.entries(starting.upgrades).map(([id,n])=>{const u=UPGRADES.find(u=>u.id===id)!;return `<p>${u.icon} ${u.name} Lv. ${n}<small>${upgradeDescription(u.id,n!)}</small></p>`;}).join('')}</div><p class="modal-sub">已包含目前營地加成與書庫贈送能力。<br>起手只在新遠征套用，可搭配任意已解鎖武器。</p>${unlocked?'':`<p class="character-unlock">完成主線「${MISSIONS[c.requiredCleared-1].name}」後解鎖（${save.profile.cleared}/${c.requiredCleared}）。</p>`}<button class="primary" id="select-character" ${unlocked?'':'disabled'}>${unlocked?'選擇這位角色':'尚未解鎖'}</button><button class="secondary full" id="close-character">返回營地</button>`);
  const title=$('.character-preview h2')!;title.tabIndex=-1;title.focus({preventScroll:true});$('.modal')!.scrollTop=0;
  click('#close-character',closeModal);
  click('#select-character',async()=>{
    if(busy||save.run||!unlocked)return;busy=true;
    const button=$('#select-character') as HTMLButtonElement;button.disabled=true;
    const next=structuredClone(save);next.settings.preferredCharacter=id;
    if(await persist(next))renderCamp();
    else button.disabled=false;
    busy=false;
  });
}
function renderCamp(){
  destroyArena();closeModal();screen='camp';busy=false;
  selectedMission=Math.min(selectedMission,save.profile.cleared,MISSIONS.length-1);
  if(!availableWeapons(save.profile).includes(selectedWeapon))selectedWeapon='staff';
  if(selectedMission>=save.profile.cleared)difficulty='normal';
  const m=MISSIONS[selectedMission],chapter=CHAPTERS[m.chapter];
  app.innerHTML=`<main class="camp-shell"><section class="camp-art"><div class="brand"><span class="eyebrow">EMBER EXPEDITION</span><h1>餘燼遠征<span>帶一盞燈，走進未知。</span></h1></div><div class="camp-caption"><span class="kicker">THE LAST LIGHT</span><h2>長夜之中，<br>總有地方可以回去。</h2><p>你的營地 · 已點亮 ${Math.floor(save.profile.cleared/2)} 座燈塔</p></div><div class="art-credit">✦ 守燈人的旅程</div></section><section class="camp-panel">${header()}<nav class="tabs" aria-label="營地選單"><button data-tab="expedition" class="${tab==='expedition'?'active':''}">遠征</button><button data-tab="camp" class="${tab==='camp'?'active':''}">營地</button><button data-tab="journal" class="${tab==='journal'?'active':''}">旅人手記</button></nav><div id="camp-content"></div><footer class="camp-footer"><span>✧ ${saveError?'存檔待重試':'進度保存在這部裝置'}</span><span>單指 · 離線 · 隨時暫停</span></footer></section></main>`;
  const content=$('#camp-content')!;
  if(tab==='expedition'){
    const cleared=selectedMission<save.profile.cleared;
    content.innerHTML=`<div class="section-heading"><span class="eyebrow">${save.run?'YOUR JOURNEY CONTINUES':'YOUR NEXT CHAPTER'}</span><h2>${save.run?'火光還在等你':'下一段旅程'}</h2><p>${save.run?'接續上次的遠征，從最近的房間繼續。':'迷霧散去之前，讓燈火繼續亮著。'}</p></div>${save.run?resumeCard():`<article class="mission-card" style="--chapter-color:${chapter.color}"><div class="chapter-number">${String(m.chapter+1).padStart(2,'0')} <span>/ ${CHAPTERS.length}</span></div><span class="kicker">${chapterNo[m.chapter]} · ${selectedMission%2+1}/2</span><h3>${chapter.name}</h3><p>${m.name}</p><div class="mission-meta"><span>◷ 約 8–12 分鐘</span><span>${cleared?'✓ 已探索':'待探索'} · ${difficulty==='hard'?'困難':'普通'}</span></div><button class="primary" id="journey">${cleared?'再次遠征':'啟程探索'} <span>↗</span></button></article>${characterLoadout()}<div class="loadout"><span class="micro-label">攜帶武器</span><div class="weapons">${(Object.keys(WEAPONS) as Weapon[]).map(w=>`<button data-weapon="${w}" class="weapon ${w===selectedWeapon?'selected':''}" ${availableWeapons(save.profile).includes(w)?'':'disabled'} aria-label="${WEAPONS[w].name}${availableWeapons(save.profile).includes(w)?'':'，需升級守燈工坊'}"><span>${WEAPONS[w].mark}</span>${WEAPONS[w].name.replace('星火','').replace('逐風','').replace('守燈','')}${availableWeapons(save.profile).includes(w)?'':' <small>鎖定</small>'}</button>`).join('')}</div><p class="weapon-note">${WEAPONS[selectedWeapon].detail}</p></div><div class="mission-controls"><button class="text-button" id="chapters">章節地圖 <span>→</span></button>${cleared?`<button class="text-button" id="difficulty">${difficulty==='hard'?'◆ 困難':'◇ 普通'} ⇄</button>`:''}</div>`}<div class="small-note">拖曳移動，攻擊與技能自動施放。<br>一把主武器，搭配雷電、伴星與震波。</div>`;
    click('#journey',startJourney);click('#resume',showMap);click('#chapters',showChapters);click('#difficulty',()=>{difficulty=difficulty==='normal'?'hard':'normal';renderCamp();});
    document.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(b=>b.addEventListener('click',()=>{selectedWeapon=b.dataset.weapon as Weapon;renderCamp();}));
    document.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(b=>b.addEventListener('click',()=>showCharacter(b.dataset.character as CharacterId)));
  }else if(tab==='camp'){
    content.innerHTML=`<div class="section-heading"><span class="eyebrow">A PLACE TO RETURN TO</span><h2>把微光留在這裡</h2><p>永久強化起始能力，下一趟遠征清得更快。</p></div><div class="growth-summary"><span>永久傷害 <b>+${Math.round(permanentGrowth(save.profile).damage*100)}%</b></span><span>下趟起始生命 <b>${startingLoadout(save.profile,save.settings.preferredCharacter).maxHp}</b></span><span>經驗／火種 <b>+${Math.round(permanentGrowth(save.profile).experience*100)}%</b></span></div><div class="facilities">${(Object.keys(FACILITIES) as Facility[]).map(id=>{const f=FACILITIES[id],level=save.profile.facilities[id],limit=facilityLimit(id,save.profile),max=level>=limit;return `<article class="facility"><div class="facility-icon">${f.icon}</div><div><h3>${f.name}<small>Lv. ${level}/${limit}</small></h3><p>${f.description}</p><button data-facility="${id}" class="small-button" ${max||!!save.run||save.profile.embers<facilityCost(id,level)?'disabled':''}>${max?'已完成升級':`升級 · ✦ ${facilityCost(id,level)}`}</button></div></article>`;}).join('')}</div>${save.run?'<p class="small-note">完成遠征或撤退後，即可建設營地。</p>':''}`;
    document.querySelectorAll<HTMLButtonElement>('[data-facility]').forEach(b=>b.addEventListener('click',async()=>{if(busy)return;busy=true;try{if(await persist(buyFacility(save,b.dataset.facility as Facility))){chime([392,523,784]);renderCamp();}}catch(e){toast((e as Error).message);}busy=false;}));
  }else{
    content.innerHTML=`<div class="section-heading"><span class="eyebrow">THE WAYFARER'S NOTES</span><h2>旅人手記</h2><p>走過的路，都會留下微光。</p></div><div class="stats"><div><strong>${save.profile.expeditions}</strong><span>完成遠征</span></div><div><strong>${save.profile.totalKills}</strong><span>擊退敵人</span></div><div><strong>${save.profile.bestHard}</strong><span>困難通關</span></div></div><div class="journal">${CHAPTERS.map((c,i)=>`<article class="journal-entry ${save.profile.cleared<i*2?'locked':''}"><span class="kicker">${chapterNo[i]} · ${save.profile.cleared>i*2+1?'燈塔已點亮':'尚在迷霧中'}</span><h3>${c.name}</h3><p>${save.profile.cleared>i*2+1?c.ending:save.profile.cleared>=i*2?c.intro:'循著前方的燈火，才能讀到下一頁。'}</p></article>`).join('')}</div>`;
  }
  content.insertAdjacentHTML('beforeend',`${petTeam(save.run?.pets??save.profile.equippedPets)}<button class="secondary full" id="pet-guide">寵物圖鑑與配隊 →</button>`);click('#pet-guide',showPets);
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab as typeof tab;renderCamp();}));
  click('#settings',settings);click('#offline',installation);
}
function resumeCard(){const r=save.run!,m=MISSIONS[r.mission];return `<article class="mission-card"><span class="kicker">${chapterNo[m.chapter]} · ${r.difficulty==='hard'?'困難':'普通'}</span><h3>${m.name}</h3><p>${r.room>=ROOMS.length?'遠征完成，領取收穫':`第 ${r.room+1} / ${ROOMS.length} 個房間`} · ${CHARACTERS[r.character].name} · ${WEAPONS[r.weapon].name}</p><div class="mission-meta"><span>♡ ${Math.ceil(r.hp)}/${r.maxHp}</span><span>✦ ${r.embers} 待帶回</span></div><button class="primary" id="resume">繼續遠征 <span>↗</span></button></article>`;}
function showChapters(){
  modal(`<span class="eyebrow">CHOOSE YOUR PATH</span><h2>章節地圖</h2><p class="modal-sub">主線已完成 ${save.profile.cleared} / ${MISSIONS.length} 趟</p><div class="chapter-list">${CHAPTERS.map((c,chapter)=>{
    const missions=MISSIONS.map((m,i)=>({...m,index:i})).filter(m=>m.chapter===chapter),cleared=missions.filter(m=>m.index<save.profile.cleared).length,locked=missions[0].index>save.profile.cleared;
    const pets=PET_IDS.filter(id=>chapter>=PETS[id].firstChapter&&chapter<=PETS[id].lastChapter).map(id=>PETS[id].name);
    return `<details class="chapter-group ${locked?'locked':''}" ${missions.some(m=>m.index===selectedMission)?'open':''}><summary><span><small>${chapterNo[chapter]} · ${locked?'尚未解鎖':cleared===2?'燈塔已點亮':`進度 ${cleared}/2`}</small><strong>${c.name}</strong></span><span>${locked?'鎖':cleared===2?'✓':'＋'}</span></summary><p class="chapter-pets">區域寵物：${pets.join('、')||'尚無紀錄'}</p>${missions.map(m=>`<button data-mission="${m.index}" class="chapter-row ${m.index===selectedMission?'selected':''}" ${m.index>save.profile.cleared?'disabled':''}><span class="chapter-index">${String(m.index+1).padStart(2,'0')}</span><span><small>${m.index%2===0?'前哨與守衛戰':c.boss}</small><strong>${m.name}</strong></span><span>${m.index<save.profile.cleared?'✓':m.index===save.profile.cleared?'→':'鎖'}</span></button>`).join('')}</details>`;
  }).join('')}</div><button class="secondary full" id="close">返回營地</button>`);
  click('#close',closeModal);document.querySelectorAll<HTMLButtonElement>('[data-mission]').forEach(b=>b.addEventListener('click',()=>{selectedMission=Number(b.dataset.mission);renderCamp();}));
}
async function startJourney(){
  if(busy||save.run)return;busy=true;chime();
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];
  const next=structuredClone(save);next.run=createRun(next.profile,selectedMission,selectedWeapon,difficulty,seed,next.settings.preferredCharacter);
  if(await persist(next)){
    const c=CHAPTERS[MISSIONS[selectedMission].chapter];
    modal(`<span class="eyebrow">${chapterNo[MISSIONS[selectedMission].chapter]} · ${c.sub}</span><h2>${MISSIONS[selectedMission].name}</h2><p class="story-copy">${c.intro}</p><p class="modal-sub">${CHARACTERS[next.run!.character].name} · ${WEAPONS[next.run!.weapon].name}</p><div class="instruction"><span>☝</span><p>按住畫面並拖曳來移動。<br>攻擊和技能會自動施放。</p></div><button class="primary" id="begin">跟著火光出發 →</button>`);
    click('#begin',showMap);
  }
  busy=false;
}
function evolutionProgress(r:Run){
  const evo=EVOLUTIONS[r.weapon];
  return Object.entries(evo.requires).map(([id,n])=>{const u=UPGRADES.find(u=>u.id===id)!;return `${u.name} ${Math.min(r.upgrades[u.id]??0,n!)}/${n}`;}).join(' ＋ ');
}
function buildDetails(r:Run){
  const evo=EVOLUTIONS[r.weapon],evolved=isEvolved(r);
  return `<div class="evolution-card ${evolved?'unlocked':''}"><span class="kicker">主武器 · ${evolved?'已進化':'進化目標'}</span><h3>${evolved?evo.name:WEAPONS[r.weapon].name+' → '+evo.name}</h3><p>${evo.description}</p><strong>${evolved?'✦ 進化已啟動':evolutionProgress(r)}</strong></div><div class="skill-slots">${AUTO_UPGRADES.map(u=>{const n=r.upgrades[u.id]??0;return `<span class="${n?'learned':''}">${u.icon} ${u.name}<b>${n?'Lv. '+n:'未取得'}</b>${n?`<small>${upgradeDescription(u.id,n)}</small>`:''}</span>`;}).join('')}</div><div class="synergy-list">${SYNERGIES.map(s=>`<div class="${meetsRequirements(r,s.requires)?'unlocked':''}"><strong>${meetsRequirements(r,s.requires)?'✦ ':'◇ '}${s.name}</strong><p>${s.description}</p><small>${Object.entries(s.requires).map(([id,n])=>{const u=UPGRADES.find(u=>u.id===id)!;return `${u.name} ${Math.min(r.upgrades[u.id]??0,n)}/${n}`;}).join(' ＋ ')}</small></div>`).join('')}</div>`;
}
function showMap(){
  destroyArena();closeModal();screen='map';busy=false;
  const r=save.run;if(!r){renderCamp();return;}
  if(r.room>=ROOMS.length){void endExpedition('victory',r);return;}
  const chapter=CHAPTERS[MISSIONS[r.mission].chapter],last=r.room===ROOMS.length-1;
  app.innerHTML=`<main class="travel-shell"><header class="travel-header"><button class="icon-button" id="back-camp" aria-label="返回營地畫面">←</button><div><span class="eyebrow">${chapterNo[MISSIONS[r.mission].chapter]}</span><h2>${MISSIONS[r.mission].name}</h2></div><span class="currency">✦ ${r.embers}</span></header><section class="route-art" style="background-image:linear-gradient(0deg,#102623ed,#10262315),url('${assetPath("/assets/"+chapter.asset+".jpg")}')"><span class="kicker">${chapter.sub}</span><h1>${chapter.name}</h1><div class="route-nodes" aria-label="遠征進度">${ROOMS.map((_,i)=>`<span class="route-node ${i<r.room?'done':i===r.room?'current':''}">${i<r.room?'✓':i===ROOMS.length-1?'♜':i+1}</span>`).join('')}</div><div class="travel-health"><span>♡ ${Math.ceil(r.hp)} / ${r.maxHp}</span><span>Lv. ${r.level} · ${isEvolved(r)?EVOLUTIONS[r.weapon].name:WEAPONS[r.weapon].name}</span></div></section><section class="route-content"><p class="run-character">${CHARACTERS[r.character].name} · 本局角色</p><span class="eyebrow">ROOM ${String(r.room+1).padStart(2,'0')} / 07</span><h2>${last?(r.mission%2?chapter.boss:'燈塔守衛'):encounter(r).name}</h2><p>${last&&r.mission%2?'擊敗首領，清除殘兵，把火種帶回營地。':'擊退怪潮，收集經驗。最後一波結束後，清掉剩餘敵人即可過關。'}</p><div class="route-options"><button class="primary" id="enter-room">${last&&r.mission%2?'挑戰首領':'迎擊怪潮'} →</button><small>清場後自動收集掉落，並恢復 8% 生命</small></div>${petTeam(r.pets)}${buildDetails(r)}<div class="run-build">${Object.entries(r.upgrades).filter(([,n])=>n).map(([id,n])=>{const u=UPGRADES.find(x=>x.id===id)!;return `<span title="${esc(upgradeDescription(u.id,n!))}">${u.icon} ${u.name} ${n}</span>`;}).join('')}</div><footer class="route-footer"><span>✓ 已保存至此房間</span><button class="text-button" id="retreat">帶著火種撤退</button></footer></section></main>`;
  click('#back-camp',renderCamp);click('#retreat',confirmRetreat);click('#enter-room',()=>void enterRoom());
}
async function enterRoom(){
  if(busy||!save.run)return;busy=true;
  if(save.run.petEncounter===null&&!(await persist(preparePetEncounter(save)))){busy=false;saveRetry(()=>void enterRoom());return;}
  showArena(save.run);busy=false;
}
async function saveTamedPet(pet:PetId,accept:(pets:PetId[])=>void){
  if(busy||!save.run)return;busy=true;
  modal(`<h2>正在保存 ${PETS[pet].name}</h2><p class="modal-sub">保存成功後才會永久收藏，請稍候。</p>`);
  const next=claimPet(save,save.run.id,save.run.room,pet);
  if(!(await persist(next))){busy=false;saveRetry(()=>void saveTamedPet(pet,accept));return;}
  closeModal();busy=false;accept(next.run!.pets);chime([523,659,784]);toast(`永久收藏：${PETS[pet].name}${next.run!.pets.includes(pet)?' · 已加入助戰':' · 下趟可選擇出戰'}`);
}
function showArena(checkpoint:Run){
  closeModal();destroyArena();screen='arena';
  const c=CHAPTERS[MISSIONS[checkpoint.mission].chapter];
  app.innerHTML=`<main class="game-shell"><header class="game-header"><button class="icon-button" id="pause" aria-label="暫停遊戲">Ⅱ</button><div><span class="eyebrow">${c.name} · ${checkpoint.room+1}/${ROOMS.length}</span><h2>${checkpoint.room===ROOMS.length-1?checkpoint.mission%2?c.boss:'燈塔守衛':encounter(checkpoint).name}</h2></div><span class="game-time" id="timer">—</span></header><div class="game-hud"><div class="health-track"><div id="health-fill"></div><span id="health-label">♡ ${Math.ceil(checkpoint.hp)} / ${checkpoint.maxHp}</span></div><span id="run-level">Lv. ${checkpoint.level}</span><span id="run-embers">✦ ${checkpoint.embers}</span></div><div class="xp-track"><div id="xp-fill"></div></div><div class="game-phase" id="game-phase" role="status">迎擊怪潮</div><div class="pet-status" id="pet-status" role="status" hidden></div><div class="boss-track" id="boss-track" hidden><div id="boss-fill"></div></div><button class="combat-build" id="build-info" aria-label="查看武器進化與技能構築"></button><div class="game-viewport" id="game"><div class="phase-banner" id="phase-banner" aria-hidden="true"></div></div><footer class="game-footer"><span>拖曳移動 · 自動攻擊</span><span id="kills">擊退 0</span></footer></main>`;
  let lastPhase='',evolved=isEvolved(checkpoint);
  arena=mountArena($('#game')!,structuredClone(checkpoint),{
    hud:(r,remaining,boss,phase,enemies)=>{
      const hp=$('#health-fill');if(!hp)return;hp.style.width=`${r.hp/r.maxHp*100}%`;
      $('#health-label')!.textContent=`♡ ${Math.ceil(r.hp)} / ${r.maxHp}`;
      $('#run-level')!.textContent=`Lv. ${r.level}`;$('#run-embers')!.textContent=`✦ ${r.embers}`;
      $('#xp-fill')!.style.width=`${Math.min(100,r.xp/experienceForLevel(r.level)*100)}%`;
      $('#timer')!.textContent=phase==='taming'?'馴服':phase==='clearing'?'清場':phase==='loot'||phase==='victory'?'✓':boss!==null?'首領':time(remaining);
      const bar=$('#boss-track')!;bar.hidden=boss===null;if(boss!==null)$('#boss-fill')!.style.width=`${Math.max(0,boss*100)}%`;
      $('#kills')!.textContent=`擊退 ${r.kills-checkpoint.kills}`;
      $('#game-phase')!.textContent=phase==='finalWave'?'最後一波 · 即將停止增援':phase==='clearing'?`增援已停止 · 清除剩餘 ${enemies} 隻`:phase==='loot'?'區域肅清 · 正在收集掉落':phase==='victory'?'清場完成 · 火種已收集':boss!==null?c.asset==='final-lighthouse'?`噬光之王 · 第 ${finalBossPhase(boss)} 階段`:'擊敗首領與守衛':'擊退怪潮，收集經驗';
      $('#game-phase')!.dataset.phase=phase;
      if(phase==='taming')$('#game-phase')!.textContent='清場完成 · 可繼續馴服或離開房間';
      const leave=$('#leave-pet');if(leave)leave.hidden=phase!=='taming';
      $('#build-info')!.innerHTML=`<span>${WEAPONS[r.weapon].mark} ${isEvolved(r)?EVOLUTIONS[r.weapon].name:WEAPONS[r.weapon].name}${isEvolved(r)?' ✦':''}</span><span>${AUTO_UPGRADES.map(u=>`${u.icon}${r.upgrades[u.id]??0}`).join(' ')} <small>構築 ›</small></span>`;
      if(phase!==lastPhase){const banner=$('#phase-banner')!;banner.textContent=phase==='finalWave'?'最後一波':phase==='loot'?'區域肅清':phase==='victory'?'清場完成':'';banner.classList.toggle('visible',!!banner.textContent);lastPhase=phase;}
      if(!evolved&&isEvolved(r)){evolved=true;chime([523,659,784,1046]);toast(`主武器進化：${EVOLUTIONS[r.weapon].name}`);}
    },
    upgrade:(r,choose)=>{
      chime([523,659,784]);const choices=upgradeChoices(r);
      modal(`<span class="eyebrow">LEVEL ${r.level}</span><h2>選擇本局強化</h2><p class="evolution-hint">${isEvolved(r)?`✦ ${EVOLUTIONS[r.weapon].name}已進化`:`${EVOLUTIONS[r.weapon].name}：${evolutionProgress(r)}`}</p><div class="upgrade-list">${choices.map(u=>`<button class="upgrade ${u.color}" data-upgrade="${u.id}"><span class="upgrade-icon">${u.icon}</span><span><strong>${u.name}<small>Lv. ${(r.upgrades[u.id]??0)+1}</small></strong><p>${upgradeDescription(u.id,(r.upgrades[u.id]??0)+1)}</p>${!isEvolved(r)&&u.id in EVOLUTIONS[r.weapon].requires?'<small class="upgrade-tag">主武器進化所需</small>':''}</span><b>＋</b></button>`).join('')}</div><p class="modal-sub upgrade-footnote">時間已暫停 · 本局能力在遠征結束後重置</p>`);
      document.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(b=>b.addEventListener('click',()=>{closeModal();choose(b.dataset.upgrade as Parameters<typeof choose>[0]);}));
    },
    complete:r=>void completeRoom(r), defeat:r=>void endExpedition('defeat',r),paused:pause,tame:(pet,accept)=>void saveTamedPet(pet,accept),
    taming:(pet,seconds,inside)=>{
      const status=$('#pet-status');if(!status)return;status.hidden=pet===null;
      if(pet)status.textContent=`${PETS[pet].name} · ${seconds.toFixed(1)} / ${PETS[pet].tameSeconds} 秒 · ${inside?'圈內馴服':'進圈馴服，離圈倒退'}`;
    },
  });
  $('.game-footer')!.insertAdjacentHTML('beforeend','<button id="leave-pet" class="small-button" hidden>離開房間 →</button>');click('#leave-pet',()=>arena?.scene.leavePet());
  click('#pause',pause);click('#build-info',()=>{
    if(!arena||$('.modal-backdrop'))return;arena.scene.pause();
    modal(`<span class="eyebrow">本局構築</span><h2>武器與技能</h2><p class="run-character">${CHARACTERS[arena.scene.getRun().character].name} · 本局角色</p>${buildDetails(arena.scene.getRun())}<button id="close-build" class="primary">繼續戰鬥</button>`);
    click('#close-build',()=>{closeModal();arena?.scene.resume();});
  });
}
async function completeRoom(run:Run){
  if(busy||!save.run||save.run.id!==run.id||save.run.room!==run.room)return;busy=true;
  const kills=run.kills-save.run.kills,next=structuredClone(save);next.run=finishRoom(run);
  const reward=next.run.embers-run.embers,healed=Math.ceil(next.run.hp-run.hp);
  if(!(await persist(next))){busy=false;saveRetry(()=>void completeRoom(run));return;}
  destroyArena();closeModal();chime([392,523,659]);busy=false;
  if(next.run!.room>=ROOMS.length){await endExpedition('victory',next.run!);return;}
  showMap();
  modal(`<span class="eyebrow">第 ${run.room+1} / ${ROOMS.length} 房 · 已保存</span><h2>區域肅清</h2><div class="room-rewards"><span><b>${kills}</b>擊退敵人</span><span><b>+${reward}</b>清場火種</span><span><b>+${healed}</b>恢復生命</span></div><p class="modal-sub">掉落已全部收集。帶著這次成長，迎向下一波怪潮。</p><button id="next-room" class="primary">進入下一房 →</button><button id="room-camp" class="secondary full">回營地休息，保留進度</button>`);
  click('#next-room',()=>void enterRoom());click('#room-camp',renderCamp);
}
function saveRetry(retry:()=>void){modal('<span class="eyebrow">進度尚未寫入</span><h2>先留住這段旅程</h2><p class="story-copy">遊戲已暫停。請檢查裝置空間後重試，或匯出目前進度。</p><button id="retry-save" class="primary">重新儲存</button><button id="backup-retry" class="secondary full">匯出備份</button>');click('#retry-save',retry);click('#backup-retry',()=>void exportSave());}
async function endExpedition(outcome:'victory'|'defeat'|'retreat',run:Run){
  if(busy||!save.run||save.run.id!==run.id)return;busy=true;
  const working=structuredClone(save);working.run=run;
  const result=settle(working,outcome);
  if(!(await persist(result.save))){busy=false;saveRetry(()=>void endExpedition(outcome,run));return;}
  destroyArena();closeModal();screen='result';busy=false;selectedMission=Math.min(save.profile.cleared,MISSIONS.length-1);
  const c=CHAPTERS[MISSIONS[run.mission].chapter],victory=outcome==='victory';
  app.innerHTML=`<main class="result-shell"><span class="result-symbol">${victory?'✦':outcome==='defeat'?'◌':'⌂'}</span><span class="eyebrow">${victory?'THE LIGHT RETURNS':outcome==='defeat'?'EVERY JOURNEY LEAVES A SPARK':'BACK TO THE CAMP'}</span><h1>${victory?'你把火光帶回來了':outcome==='defeat'?'火光，仍然沒有熄滅':'平安歸來'}</h1><p>${victory?(run.mission%2?c.ending:'通往燈塔的道路已經打開。回到營地整備，再向守衛發起挑戰。'):outcome==='defeat'?'這趟旅程暫時結束。你保住了一半火種，已解鎖的成長也都還在。':'帶著收穫回到營地，為下一次出發做好準備。'}</p><div class="result-reward">✦ ${result.earned}<span>帶回火種${outcome==='defeat'?' · 已保留 50%':''}</span></div><div class="stats"><div><strong>${time(run.elapsed)}</strong><span>冒險時間</span></div><div><strong>${run.kills}</strong><span>擊退敵人</span></div><div><strong>${run.level}</strong><span>本局等級</span></div></div><button class="primary" id="home">回到營地 →</button><p class="saved-caption">✓ 成長與獎勵已保存</p></main>`;
  click('#home',renderCamp);chime(victory?[392,523,659,784]:[392,330]);
}
function pause(){
  if(!arena||screen!=='arena'||$('.modal-backdrop'))return;
  arena.scene.pause();
  modal(`<span class="eyebrow">TAKE A BREATH</span><h2>燈火會等你</h2><p class="run-character">${CHARACTERS[arena.scene.getRun().character].name} · 本局角色</p><p class="story-copy">旅程已暫停。切換 App 不會繼續戰鬥；若關閉遊戲，會從本房間入口重新開始。</p><button class="primary" id="continue">繼續冒險</button><button class="secondary full" id="checkpoint">返回營地畫面（保留房間檢查點）</button><button class="text-button full" id="pause-retreat">結束遠征，帶回火種</button>`);
  click('#continue',()=>{closeModal();arena?.scene.resume();});click('#checkpoint',renderCamp);click('#pause-retreat',confirmRetreat);
}
function confirmRetreat(){
  const run=arena?.scene.getRun()??save.run;if(!run)return;
  arena?.scene.pause();
  modal(`<span class="eyebrow">RETURN SAFELY</span><h2>帶著火種回家？</h2><p class="story-copy">保留已收集的 ${run.embers} 枚火種。本局能力與未完成的遠征會結束，主線解鎖保留。</p><button id="confirm-retreat" class="primary">確認撤退</button><button id="cancel-retreat" class="secondary full">留下來繼續</button>`);
  click('#confirm-retreat',()=>void endExpedition('retreat',run));click('#cancel-retreat',()=>{closeModal();if(arena)arena.scene.resume();});
}
function installation(){
  const standalone=matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone;
  const android=/Android/i.test(navigator.userAgent), ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const openStep=android?'在 Android 的 Chrome 開啟遊戲網址。':ios?'在 iPhone／iPad 的 Safari 開啟遊戲網址。':'Android 請用 Chrome，iPhone／iPad 請用 Safari 開啟遊戲網址。';
  const installStep=android?'點右上角「⋮」→「加入主畫面」或「安裝應用程式」。':ios?'點「分享」→「加入主畫面」。':'Android：點「⋮」→「加入主畫面」或「安裝應用程式」。iPhone／iPad：點「分享」→「加入主畫面」。';
  const storageNote=standalone?'你正在主畫面 App 中。':android?'請固定使用同一個 Chrome 瀏覽環境與遊戲網址；換瀏覽器不會自動帶入存檔。':'Safari 與主畫面 App 的存檔可能分開，建議在主畫面版本開始正式旅程。';
  modal(`<span class="eyebrow">YOUR POCKET ADVENTURE</span><h2>把冒險帶在身上</h2><ol class="install-steps"><li>${openStep}</li><li>${installStep}</li><li><strong>從主畫面圖示開啟</strong>，保持連網直到顯示「已可離線遊玩」。</li><li>開啟飛航模式，關閉 Wi-Fi，再重新開啟遊戲確認。</li><li>日後連網回到這裡點「檢查更新」，新版下載完成後，<strong>結束遠征再套用更新</strong>。</li></ol><div id="offline-panel" aria-live="polite"></div><p class="modal-sub">${storageNote}<br>請勿清除網站資料；重要進度可在設定中匯出備份。</p><button class="secondary full" id="close">知道了</button>`);
  renderOfflinePanel();click('#close',closeModal);
}
function renderOfflinePanel(){
  const panel=$('#offline-panel');if(!panel)return;
  panel.innerHTML=`<div class="offline-state ${offline.ready?'complete':''}">${offline.ready?'✓':'◷'} ${esc(offline.message)}</div>${offline.version?`<p class="modal-sub" id="offline-version">目前離線版本：${esc(offline.version)}</p>`:''}${offline.detail?`<p class="modal-sub offline-detail">${esc(offline.detail)}</p>`:''}${offline.update?`<button class="primary full" id="update" ${save.run?'disabled':''}>${save.run?'遠征結束後可更新':'更新至已下載的新版本'}</button>`:!offline.ready?`<button class="primary full" id="retry-offline" ${offline.working?'disabled':''}>${offline.working?'正在準備…':'重新下載缺少的內容'}</button>`:`<button class="primary full" id="check-update" ${offline.working?'disabled':''}>${offline.working?'正在檢查更新…':'檢查更新'}</button>`}`;
  if(offline.authRequired)panel.insertAdjacentHTML('beforeend','<button class="primary full" id="sign-in">重新登入以更新</button><p class="modal-sub">會先保存進度，再前往登入。回來後從營地繼續，遠征結束後才能套用新版。</p>');
  click('#retry-offline',()=>void prepareOffline());click('#check-update',()=>void checkForUpdates());click('#update',()=>{if(!save.run)applyUpdate();});
  click('#sign-in',async()=>{
    if(busy)return;busy=true;
    if(await persist(save))location.assign('/signin-with-chatgpt?return_to=%2F');
    busy=false;
  });
}
function settings(){
  modal(`<span class="eyebrow">SETTLE IN</span><h2>設定與存檔</h2><div class="settings-row"><div><strong>輕量音效</strong><p>啟程、升級與返回時的提示音</p></div><button id="sound" class="small-button">${save.settings.sound?'開啟':'關閉'}</button></div><div class="settings-row"><div><strong>你的旅程，存在這裡</strong><p>本機存檔 · ${save.profile.cleared}/${MISSIONS.length} 主線完成</p></div><span>◇</span></div><div class="backup-actions"><button class="secondary" id="export">匯出備份</button><button class="secondary" id="import">匯入存檔</button></div><input type="file" accept="application/json,.json" id="import-file" hidden><p class="modal-sub">清除網站資料或移除 App 可能使進度消失。備份檔可以在同一網址的其他裝置匯入。</p><button class="text-button full" id="install-help">安裝、離線與更新說明 →</button><button class="primary" id="close">返回營地</button>`);
  click('#close',closeModal);click('#install-help',installation);click('#sound',async()=>{const next=structuredClone(save);next.settings.sound=!next.settings.sound;if(await persist(next))settings();});click('#export',()=>void exportSave());click('#import',()=>$('#import-file')?.click());
  $('#import-file')?.addEventListener('change',async event=>{
    const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;
    try{
      if(file.size>1024*1024)throw new Error('備份檔過大，請選擇本遊戲匯出的 JSON 檔。');
      const imported=validateSave(JSON.parse(await file.text()));
      modal(`<span class="eyebrow">RESTORE YOUR JOURNEY</span><h2>還原這份旅程？</h2><p class="story-copy">備份有 ${imported.profile.embers} 枚火種，已完成 ${imported.profile.cleared}/${MISSIONS.length} 主線。匯入會取代這部裝置目前的遊戲進度。</p><button id="confirm-import" class="primary">確認還原</button><button id="cancel-import" class="secondary full">取消</button>`);
      click('#confirm-import',async()=>{if(busy)return;busy=true;if(await persist(imported)){selectedMission=Math.min(save.profile.cleared,MISSIONS.length-1);renderCamp();toast('存檔已還原。');}busy=false;});click('#cancel-import',settings);
    }catch(e){toast(e instanceof SyntaxError?'這不是有效的遊戲備份檔。':(e as Error).message);}
  });
}
async function exportSave(){
  const file=new File([JSON.stringify(save,null,2)],`餘燼遠征-${new Date().toISOString().slice(0,10)}.json`,{type:'application/json'});
  try{
    if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'餘燼遠征存檔'});}
    else{const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  }catch(e){if((e as Error).name!=='AbortError')toast('備份分享失敗，請再試一次。');}
}
watchOffline(s=>{offline=s;const el=$('#offline');if(el){el.textContent=`${s.ready?'◇':'◷'} ${s.message}`;el.classList.toggle('ready',s.ready);}renderOfflinePanel();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();void audio?.suspend();}else void checkForUpdates();});
window.addEventListener('pagehide',()=>arena?.scene.pause());
function registerTools(){
  type Tool={name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown};
  const context=(document as Document&{modelContext?:{registerTool:(tool:Tool,options?:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  const empty=(value:unknown)=>{if(value&&typeof value==='object'&&!Array.isArray(value)&&!Object.keys(value).length)return;throw new Error('Expected an empty object.');};
  const tools:Tool[]=[
    {name:'get_game_status',title:'查看冒險狀態',description:'讀取目前畫面、主線進度與離線狀態。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){empty(input);return {screen,cleared:save.profile.cleared,embers:save.profile.embers,room:save.run?.room??null,offlineReady:offline.ready};}},
    {name:'pause_game',title:'暫停冒險',description:'將進行中的戰鬥暫停，顯示遊戲暫停選單。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){empty(input);if(!arena)throw new Error('No active room.');pause();return {paused:true,screen};}},
  ];
  for(const tool of tools)try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser capability. */}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
void loadSave().then(s=>{save=s;selectedMission=Math.min(save.profile.cleared,MISSIONS.length-1);selectedWeapon=save.run?.weapon??'staff';renderCamp();registerTools();void prepareOffline();}).catch(e=>{app.innerHTML='<main class="error-screen"><h1>暫時無法讀取存檔</h1><p></p><button id="reload">重新開啟</button></main>';app.querySelector('p')!.textContent=e.message;click('#reload',()=>location.reload());});
