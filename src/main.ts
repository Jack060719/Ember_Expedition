import './style.css';
import { CHAPTERS, MISSIONS, WEAPONS, FACILITIES, ROOMS, UPGRADES, encounter, availableWeapons, createRun, finishRoom, settle, buyFacility, facilityCost, puzzleInitial, upgradeChoices, validateSave, type Save, type Run, type Weapon, type Difficulty, type Facility } from './core.ts';
import { loadSave, writeSave } from './storage.ts';
import { watchOffline, prepareOffline, applyUpdate, type OfflineState } from './offline.ts';
import { mountArena, type Arena } from './arena.ts';

const app=document.querySelector<HTMLDivElement>('#app')!;
let save:Save, selectedMission=0, selectedWeapon:Weapon='staff', difficulty:Difficulty='normal';
let tab:'expedition'|'camp'|'journal'='expedition';
let arena:{scene:Arena;game:Phaser.Game}|null=null;
let screen='camp', busy=false, saveError=false, writeQueue=Promise.resolve();
let offline:OfflineState={ready:false,working:false,update:false,message:'準備離線內容'};
let audio:AudioContext|undefined;
const $=(selector:string)=>document.querySelector<HTMLElement>(selector);
const esc=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const time=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const chapterNo=['第一章','第二章','第三章'];
function toast(message:string){$('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),4300);}
function chime(notes=[440,660]){
  if(!save.settings.sound)return;
  try{audio??=new AudioContext();void audio.resume();notes.forEach((note,i)=>{const o=audio!.createOscillator(),g=audio!.createGain(),t=audio!.currentTime+i*.08;o.type='sine';o.frequency.value=note;g.gain.setValueAtTime(.025,t);g.gain.exponentialRampToValueAtTime(.0001,t+.3);o.connect(g);g.connect(audio!.destination);o.start(t);o.stop(t+.31);});}catch{/* Sound is optional. */}
}
async function persist(next:Save):Promise<boolean>{
  try{await writeQueue;await writeSave(next);save=next;saveError=false;return true;}catch(e){saveError=true;toast((e as Error).message);return false;}
}
function queuePuzzle(run:Run){
  if(!save.run||save.run.id!==run.id)return;
  save.run.puzzle=structuredClone(run.puzzle);
  const snapshot=structuredClone(save);
  writeQueue=writeQueue.then(()=>writeSave(snapshot)).catch(e=>{saveError=true;toast(e.message);pause();});
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
function renderCamp(){
  destroyArena();closeModal();screen='camp';busy=false;
  selectedMission=Math.min(selectedMission,save.profile.cleared,5);
  if(!availableWeapons(save.profile).includes(selectedWeapon))selectedWeapon='staff';
  if(selectedMission>=save.profile.cleared)difficulty='normal';
  const m=MISSIONS[selectedMission],chapter=CHAPTERS[m.chapter];
  app.innerHTML=`<main class="camp-shell"><section class="camp-art"><div class="brand"><span class="eyebrow">EMBER EXPEDITION</span><h1>餘燼遠征<span>帶一盞燈，走進未知。</span></h1></div><div class="camp-caption"><span class="kicker">THE LAST LIGHT</span><h2>長夜之中，<br>總有地方可以回去。</h2><p>你的營地 · 已點亮 ${Math.floor(save.profile.cleared/2)} 座燈塔</p></div><div class="art-credit">✦ 守燈人的旅程</div></section><section class="camp-panel">${header()}<nav class="tabs" aria-label="營地選單"><button data-tab="expedition" class="${tab==='expedition'?'active':''}">遠征</button><button data-tab="camp" class="${tab==='camp'?'active':''}">營地</button><button data-tab="journal" class="${tab==='journal'?'active':''}">旅人手記</button></nav><div id="camp-content"></div><footer class="camp-footer"><span>✧ ${saveError?'存檔待重試':'進度保存在這部裝置'}</span><span>單指 · 離線 · 隨時暫停</span></footer></section></main>`;
  const content=$('#camp-content')!;
  if(tab==='expedition'){
    const cleared=selectedMission<save.profile.cleared;
    content.innerHTML=`<div class="section-heading"><span class="eyebrow">${save.run?'YOUR JOURNEY CONTINUES':'YOUR NEXT CHAPTER'}</span><h2>${save.run?'火光還在等你':'下一段旅程'}</h2><p>${save.run?'接續上次的遠征，從最近的房間繼續。':'迷霧散去之前，讓燈火繼續亮著。'}</p></div>${save.run?resumeCard():`<article class="mission-card" style="--chapter-color:${chapter.color}"><div class="chapter-number">0${m.chapter+1} <span>/ 03</span></div><span class="kicker">${chapterNo[m.chapter]} · ${selectedMission%2+1}/2</span><h3>${chapter.name}</h3><p>${m.name}</p><div class="mission-meta"><span>◷ 15–20 分鐘</span><span>${cleared?'✓ 已探索':'待探索'} · ${difficulty==='hard'?'困難':'普通'}</span></div><button class="primary" id="journey">${cleared?'再次遠征':'啟程探索'} <span>↗</span></button></article><div class="loadout"><span class="micro-label">攜帶武器</span><div class="weapons">${(Object.keys(WEAPONS) as Weapon[]).map(w=>`<button data-weapon="${w}" class="weapon ${w===selectedWeapon?'selected':''}" ${availableWeapons(save.profile).includes(w)?'':'disabled'} aria-label="${WEAPONS[w].name}${availableWeapons(save.profile).includes(w)?'':'，需升級守燈工坊'}"><span>${WEAPONS[w].mark}</span>${WEAPONS[w].name.replace('星火','').replace('逐風','').replace('守燈','')}${availableWeapons(save.profile).includes(w)?'':' <small>鎖定</small>'}</button>`).join('')}</div><p class="weapon-note">${WEAPONS[selectedWeapon].detail}</p></div><div class="mission-controls"><button class="text-button" id="chapters">章節地圖 <span>→</span></button>${cleared?`<button class="text-button" id="difficulty">${difficulty==='hard'?'◆ 困難':'◇ 普通'} ⇄</button>`:''}</div>`}<div class="small-note">拖曳移動，攻擊與技能自動施放。<br>升級時停下來，選擇你的下一道光。</div>`;
    click('#journey',startJourney);click('#resume',showMap);click('#chapters',showChapters);click('#difficulty',()=>{difficulty=difficulty==='normal'?'hard':'normal';renderCamp();});
    document.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(b=>b.addEventListener('click',()=>{selectedWeapon=b.dataset.weapon as Weapon;renderCamp();}));
  }else if(tab==='camp'){
    content.innerHTML=`<div class="section-heading"><span class="eyebrow">A PLACE TO RETURN TO</span><h2>把微光留在這裡</h2><p>帶回的火種，會成為下一次出發的力量。</p></div><div class="facilities">${(Object.keys(FACILITIES) as Facility[]).map(id=>{const f=FACILITIES[id],level=save.profile.facilities[id],max=level===f.max;return `<article class="facility"><div class="facility-icon">${f.icon}</div><div><h3>${f.name}<small>Lv. ${level}/${f.max}</small></h3><p>${f.description}</p><button data-facility="${id}" class="small-button" ${max||!!save.run||save.profile.embers<facilityCost(id,level)?'disabled':''}>${max?'已完成升級':`升級 · ✦ ${facilityCost(id,level)}`}</button></div></article>`;}).join('')}</div>${save.run?'<p class="small-note">完成遠征或撤退後，即可建設營地。</p>':''}`;
    document.querySelectorAll<HTMLButtonElement>('[data-facility]').forEach(b=>b.addEventListener('click',async()=>{if(busy)return;busy=true;try{if(await persist(buyFacility(save,b.dataset.facility as Facility))){chime([392,523,784]);renderCamp();}}catch(e){toast((e as Error).message);}busy=false;}));
  }else{
    content.innerHTML=`<div class="section-heading"><span class="eyebrow">THE WAYFARER'S NOTES</span><h2>旅人手記</h2><p>走過的路，都會留下微光。</p></div><div class="stats"><div><strong>${save.profile.expeditions}</strong><span>完成遠征</span></div><div><strong>${save.profile.totalKills}</strong><span>擊退敵人</span></div><div><strong>${save.profile.bestHard}</strong><span>困難通關</span></div></div><div class="journal">${CHAPTERS.map((c,i)=>`<article class="journal-entry ${save.profile.cleared<i*2?'locked':''}"><span class="kicker">${chapterNo[i]} · ${save.profile.cleared>i*2+1?'燈塔已點亮':'尚在迷霧中'}</span><h3>${c.name}</h3><p>${save.profile.cleared>i*2+1?c.ending:save.profile.cleared>=i*2?c.intro:'循著前方的燈火，才能讀到下一頁。'}</p></article>`).join('')}</div>`;
  }
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab as typeof tab;renderCamp();}));
  click('#settings',settings);click('#offline',installation);
}
function resumeCard(){const r=save.run!,m=MISSIONS[r.mission];return `<article class="mission-card"><span class="kicker">${chapterNo[m.chapter]} · ${r.difficulty==='hard'?'困難':'普通'}</span><h3>${m.name}</h3><p>第 ${Math.min(8,r.room+1)} 個房間 · ${WEAPONS[r.weapon].name}</p><div class="mission-meta"><span>♡ ${Math.ceil(r.hp)}/${r.maxHp}</span><span>✦ ${r.embers} 待帶回</span></div><button class="primary" id="resume">繼續遠征 <span>↗</span></button></article>`;}
function showChapters(){
  modal(`<span class="eyebrow">CHOOSE YOUR PATH</span><h2>章節地圖</h2><div class="chapter-list">${MISSIONS.map((m,i)=>`<button data-mission="${i}" class="chapter-row ${i===selectedMission?'selected':''}" ${i>save.profile.cleared?'disabled':''}><span class="chapter-index">${String(i+1).padStart(2,'0')}</span><span><small>${chapterNo[m.chapter]}</small><strong>${m.name}</strong></span><span>${i<save.profile.cleared?'✓':i===save.profile.cleared?'→':'鎖'}</span></button>`).join('')}</div><button class="secondary full" id="close">返回營地</button>`);
  click('#close',closeModal);document.querySelectorAll<HTMLButtonElement>('[data-mission]').forEach(b=>b.addEventListener('click',()=>{selectedMission=Number(b.dataset.mission);renderCamp();}));
}
async function startJourney(){
  if(busy||save.run)return;busy=true;chime();
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];
  const next=structuredClone(save);next.run=createRun(next.profile,selectedMission,selectedWeapon,difficulty,seed);
  if(await persist(next)){
    const c=CHAPTERS[MISSIONS[selectedMission].chapter];
    modal(`<span class="eyebrow">${chapterNo[MISSIONS[selectedMission].chapter]} · ${c.sub}</span><h2>${MISSIONS[selectedMission].name}</h2><p class="story-copy">${c.intro}</p><div class="instruction"><span>☝</span><p>按住畫面並拖曳來移動。<br>攻擊和技能會自動施放。</p></div><button class="primary" id="begin">跟著火光出發 →</button>`);
    click('#begin',showMap);
  }
  busy=false;
}
function showMap(){
  destroyArena();closeModal();screen='map';busy=false;
  const r=save.run;if(!r){renderCamp();return;}
  if(r.room>=8){void endExpedition('victory',r);return;}
  const chapter=CHAPTERS[MISSIONS[r.mission].chapter];
  app.innerHTML=`<main class="travel-shell"><header class="travel-header"><button class="icon-button" id="back-camp" aria-label="返回營地畫面">←</button><div><span class="eyebrow">${chapterNo[MISSIONS[r.mission].chapter]}</span><h2>${MISSIONS[r.mission].name}</h2></div><span class="currency">✦ ${r.embers}</span></header><section class="route-art ${chapter.asset}"><span class="kicker">${chapter.sub}</span><h1>${chapter.name}</h1><div class="route-nodes" aria-label="遠征進度">${ROOMS.map((_,i)=>`<span class="route-node ${i<r.room?'done':i===r.room?'current':''}">${i<r.room?'✓':i===3?'◇':i===7?'♜':i+1}</span>`).join('')}</div><div class="travel-health"><span>♡ ${Math.ceil(r.hp)} / ${r.maxHp}</span><span>Lv. ${r.level} · ${WEAPONS[r.weapon].name}</span></div></section><section class="route-content"><span class="eyebrow">ROOM ${String(r.room+1).padStart(2,'0')} / 08</span><h2>${r.room===3?'一道封存微光的機關':r.room===7?(r.mission%2?chapter.boss:'遺跡前的最後守衛'):encounter(r).name}</h2><p>${r.room===3?'踩上踏板會切換自己與相鄰的符文，全部點亮即可開啟寶箱。':r.room===7?'燈塔近在眼前。整理呼吸，迎向守衛。':'沿著燈火穩步前進，或深入暗處尋找更多火種。'}</p><div class="route-options">${r.room===3?`<button class="route-option" id="enter-puzzle"><span class="route-icon">◇</span><span><strong>符文寶庫</strong><small>無倒數 · 可重置與提示 · 額外火種</small></span><b>→</b></button><button class="text-button" id="skip-puzzle">繞過寶庫，繼續前進 →</button>`:r.room===7?`<button class="primary" data-route="safe">${r.mission%2?'挑戰首領':'突破最後防線'} →</button>`:`<button class="route-option" data-route="safe"><span class="route-icon green">⌁</span><span><strong>循光小徑</strong><small>敵群較少 · 進場恢復 8% 生命</small></span><b>→</b></button><button class="route-option" data-route="risk"><span class="route-icon gold">⚔</span><span><strong>深入迷霧</strong><small>敵群較密 · 更多經驗與火種</small></span><b>→</b></button>`}</div><div class="run-build">${Object.entries(r.upgrades).map(([id,n])=>{const u=UPGRADES.find(x=>x.id===id)!;return `<span title="${u.description}">${u.icon} ${u.name} ${n}</span>`;}).join('')||'<span>下一場戰鬥，會帶來新的力量。</span>'}</div><footer class="route-footer"><span>✓ 已保存至此房間</span><button class="text-button" id="retreat">帶著火種撤退</button></footer></section></main>`;
  click('#back-camp',renderCamp);click('#retreat',confirmRetreat);
  document.querySelectorAll<HTMLButtonElement>('[data-route]').forEach(b=>b.addEventListener('click',()=>void enterRoom(b.dataset.route as Run['route'])));
  click('#enter-puzzle',()=>void enterRoom('safe'));click('#skip-puzzle',()=>void completeRoom(r,true));
}
async function enterRoom(route:Run['route']){
  if(busy||!save.run)return;busy=true;
  const next=structuredClone(save),r=next.run!;r.route=route;
  if(r.room===3&&!r.puzzle)r.puzzle={mask:puzzleInitial((r.seed+r.mission)%9),moves:0};
  if(!(await persist(next))){busy=false;return;}
  showArena(r);busy=false;
}
function showArena(checkpoint:Run){
  closeModal();destroyArena();screen='arena';
  const puzzle=checkpoint.room===3,c=CHAPTERS[MISSIONS[checkpoint.mission].chapter];
  app.innerHTML=`<main class="game-shell"><header class="game-header"><button class="icon-button" id="pause" aria-label="暫停遊戲">Ⅱ</button><div><span class="eyebrow">${c.name} · ${checkpoint.room+1}/8</span><h2>${puzzle?'符文寶庫':checkpoint.room===7?checkpoint.mission%2?c.boss:'燈塔守衛':encounter(checkpoint).name}</h2></div><span class="game-time" id="timer">${puzzle?'◇':'—'}</span></header><div class="game-hud"><div class="health-track"><div id="health-fill"></div><span id="health-label">♡ ${Math.ceil(checkpoint.hp)} / ${checkpoint.maxHp}</span></div><span id="run-level">Lv. ${checkpoint.level}</span><span id="run-embers">✦ ${checkpoint.embers}</span></div><div class="xp-track"><div id="xp-fill"></div></div><div class="boss-track" id="boss-track" hidden><div id="boss-fill"></div></div><div class="game-viewport" id="game"></div><footer class="game-footer">${puzzle?'<button id="puzzle-hint" class="small-button">提示</button><span id="puzzle-count">走到踏板上</span><button id="puzzle-reset" class="small-button">重置</button>':'<span>☝ 拖曳移動 · 自動攻擊</span><span id="kills">擊退 0</span>'}</footer>${puzzle?'<button class="puzzle-skip text-button" id="puzzle-skip">離開寶庫，繼續前進 →</button>':''}</main>`;
  const runtime=structuredClone(checkpoint);
  if(!puzzle&&runtime.route==='safe'&&runtime.room!==7)runtime.hp=Math.min(runtime.maxHp,runtime.hp+runtime.maxHp*.08);
  arena=mountArena($('#game')!,runtime,{
    hud:(r,remaining,boss)=>{
      const hp=$('#health-fill');if(!hp)return;hp.style.width=`${r.hp/r.maxHp*100}%`;
      $('#health-label')!.textContent=`♡ ${Math.ceil(r.hp)} / ${r.maxHp}`;
      $('#run-level')!.textContent=`Lv. ${r.level}`;$('#run-embers')!.textContent=`✦ ${r.embers}`;
      $('#xp-fill')!.style.width=`${Math.min(100,r.xp/(18+r.level*8)*100)}%`;
      if(!puzzle)$('#timer')!.textContent=boss!==null?'首領':time(remaining);
      const bar=$('#boss-track')!;bar.hidden=boss===null;if(boss!==null)$('#boss-fill')!.style.width=`${Math.max(0,boss*100)}%`;
      if($('#kills'))$('#kills')!.textContent=`擊退 ${r.kills}`;
    },
    upgrade:(r,choose)=>{
      chime([523,659,784]);const choices=upgradeChoices(r);
      if(!choices.length){arena?.scene.resume();return;}
      modal(`<span class="eyebrow">LEVEL ${r.level} · A LITTLE STRONGER</span><h2>讓微光更亮一些</h2><p class="modal-sub">時間已暫停，選擇一項本局能力。</p><div class="upgrade-list">${choices.map(u=>`<button class="upgrade ${u.color}" data-upgrade="${u.id}"><span class="upgrade-icon">${u.icon}</span><span><strong>${u.name}<small>Lv. ${(r.upgrades[u.id]??0)+1}</small></strong><p>${u.description}</p></span><b>＋</b></button>`).join('')}</div>`);
      document.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(b=>b.addEventListener('click',()=>{choose(b.dataset.upgrade as Parameters<typeof choose>[0]);closeModal();}));
    },
    complete:r=>void completeRoom(r), defeat:r=>void endExpedition('defeat',r),
    puzzle:(mask,moves)=>{const r=arena?.scene.getRun();if(r)queuePuzzle(r);if($('#puzzle-count'))$('#puzzle-count')!.textContent=`${mask.toString(2).replaceAll('0','').length}/9 點亮 · ${moves} 步`;},
    paused:pause,
  },puzzle);
  click('#pause',pause);click('#puzzle-hint',()=>arena?.scene.showHint());click('#puzzle-reset',()=>arena?.scene.resetPuzzle(puzzleInitial((checkpoint.seed+checkpoint.mission)%9)));click('#puzzle-skip',()=>{arena?.scene.pause();void completeRoom(arena?.scene.getRun()??checkpoint,true);});
}
async function completeRoom(run:Run,skip=false){
  if(busy||!save.run||save.run.id!==run.id||save.run.room!==run.room)return;busy=true;
  const next=structuredClone(save);next.run=finishRoom(run,skip);
  if(!(await persist(next))){busy=false;saveRetry(()=>void completeRoom(run,skip));return;}
  destroyArena();closeModal();chime([392,523,659]);busy=false;
  if(next.run!.room>=8){await endExpedition('victory',next.run!);return;}
  showMap();if(run.room===3&&!skip)toast('寶庫開啟，獲得 22 枚火種。');
}
function saveRetry(retry:()=>void){modal('<span class="eyebrow">進度尚未寫入</span><h2>先留住這段旅程</h2><p class="story-copy">遊戲已暫停。請檢查裝置空間後重試，或匯出目前進度。</p><button id="retry-save" class="primary">重新儲存</button><button id="backup-retry" class="secondary full">匯出備份</button>');click('#retry-save',retry);click('#backup-retry',()=>void exportSave());}
async function endExpedition(outcome:'victory'|'defeat'|'retreat',run:Run){
  if(busy||!save.run||save.run.id!==run.id)return;busy=true;
  const working=structuredClone(save);working.run=run;
  const result=settle(working,outcome);
  if(!(await persist(result.save))){busy=false;saveRetry(()=>void endExpedition(outcome,run));return;}
  destroyArena();closeModal();screen='result';busy=false;selectedMission=Math.min(save.profile.cleared,5);
  const c=CHAPTERS[MISSIONS[run.mission].chapter],victory=outcome==='victory';
  app.innerHTML=`<main class="result-shell"><span class="result-symbol">${victory?'✦':outcome==='defeat'?'◌':'⌂'}</span><span class="eyebrow">${victory?'THE LIGHT RETURNS':outcome==='defeat'?'EVERY JOURNEY LEAVES A SPARK':'BACK TO THE CAMP'}</span><h1>${victory?'你把火光帶回來了':outcome==='defeat'?'火光，仍然沒有熄滅':'平安歸來'}</h1><p>${victory?(run.mission%2?c.ending:'通往燈塔的道路已經打開。回到營地整備，再向守衛發起挑戰。'):outcome==='defeat'?'這趟旅程暫時結束。你保住了一半火種，已解鎖的成長也都還在。':'帶著收穫回到營地，為下一次出發做好準備。'}</p><div class="result-reward">✦ ${result.earned}<span>帶回火種${outcome==='defeat'?' · 已保留 50%':''}</span></div><div class="stats"><div><strong>${time(run.elapsed)}</strong><span>冒險時間</span></div><div><strong>${run.kills}</strong><span>擊退敵人</span></div><div><strong>${run.level}</strong><span>本局等級</span></div></div><button class="primary" id="home">回到營地 →</button><p class="saved-caption">✓ 成長與獎勵已保存</p></main>`;
  click('#home',renderCamp);chime(victory?[392,523,659,784]:[392,330]);
}
function pause(){
  if(!arena||screen!=='arena'||$('.modal-backdrop'))return;
  arena.scene.pause();
  modal(`<span class="eyebrow">TAKE A BREATH</span><h2>燈火會等你</h2><p class="story-copy">旅程已暫停。切換 App 不會繼續戰鬥；若關閉遊戲，會從本房間入口重新開始。</p><button class="primary" id="continue">繼續冒險</button><button class="secondary full" id="checkpoint">返回營地畫面（保留房間檢查點）</button><button class="text-button full" id="pause-retreat">結束遠征，帶回火種</button>`);
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
  modal(`<span class="eyebrow">YOUR POCKET ADVENTURE</span><h2>把冒險帶在身上</h2><ol class="install-steps"><li>在 iPhone 的 Safari 開啟遊戲網址。</li><li>點「分享」→「加入主畫面」。</li><li><strong>從主畫面圖示開啟</strong>，保持連網直到顯示「已可離線遊玩」。</li><li>開啟飛航模式，重新開啟遊戲確認即可。</li></ol><div class="offline-state ${offline.ready?'complete':''}">${offline.ready?'✓':'◷'} ${esc(offline.message)}</div><p class="modal-sub">${standalone?'你正在主畫面 App 中。':'Safari 與主畫面 App 的存檔分開，建議在主畫面版本開始正式旅程。'}<br>請勿清除網站資料；重要進度可在設定中匯出備份。</p>${offline.update?`<button class="primary" id="update" ${save.run?'disabled':''}>${save.run?'遠征結束後可更新':'更新至已下載的新版本'}</button>`:!offline.ready?'<button class="primary" id="retry-offline">重新準備離線內容</button>':''}<button class="secondary full" id="close">知道了</button>`);
  click('#close',closeModal);click('#retry-offline',()=>{void prepareOffline();closeModal();});click('#update',()=>{if(!save.run)applyUpdate();});
}
function settings(){
  modal(`<span class="eyebrow">SETTLE IN</span><h2>設定與存檔</h2><div class="settings-row"><div><strong>輕量音效</strong><p>啟程、升級與返回時的提示音</p></div><button id="sound" class="small-button">${save.settings.sound?'開啟':'關閉'}</button></div><div class="settings-row"><div><strong>你的旅程，存在這裡</strong><p>本機存檔 · ${save.profile.cleared}/6 主線完成</p></div><span>◇</span></div><div class="backup-actions"><button class="secondary" id="export">匯出備份</button><button class="secondary" id="import">匯入存檔</button></div><input type="file" accept="application/json,.json" id="import-file" hidden><p class="modal-sub">清除網站資料或移除 App 可能使進度消失。備份檔可以在同一網址的其他裝置匯入。</p><button class="text-button full" id="install-help">iPhone 安裝與離線說明 →</button><button class="primary" id="close">返回營地</button>`);
  click('#close',closeModal);click('#install-help',installation);click('#sound',async()=>{const next=structuredClone(save);next.settings.sound=!next.settings.sound;if(await persist(next))settings();});click('#export',()=>void exportSave());click('#import',()=>$('#import-file')?.click());
  $('#import-file')?.addEventListener('change',async event=>{
    const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;
    try{
      if(file.size>1024*1024)throw new Error('備份檔過大，請選擇本遊戲匯出的 JSON 檔。');
      const imported=validateSave(JSON.parse(await file.text()));
      modal(`<span class="eyebrow">RESTORE YOUR JOURNEY</span><h2>還原這份旅程？</h2><p class="story-copy">備份有 ${imported.profile.embers} 枚火種，已完成 ${imported.profile.cleared}/6 主線。匯入會取代這部裝置目前的遊戲進度。</p><button id="confirm-import" class="primary">確認還原</button><button id="cancel-import" class="secondary full">取消</button>`);
      click('#confirm-import',async()=>{if(busy)return;busy=true;if(await persist(imported)){selectedMission=Math.min(save.profile.cleared,5);renderCamp();toast('存檔已還原。');}busy=false;});click('#cancel-import',settings);
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
watchOffline(s=>{offline=s;const el=$('#offline');if(el){el.textContent=`${s.ready?'◇':'◷'} ${s.message}`;el.classList.toggle('ready',s.ready);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();void audio?.suspend();}});
window.addEventListener('pagehide',()=>arena?.scene.pause());
function registerTools(){
  type Tool={name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown};
  const context=(document as Document&{modelContext?:{registerTool:(tool:Tool,options?:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  const empty=(value:unknown)=>{if(value&&typeof value==='object'&&!Array.isArray(value)&&!Object.keys(value).length)return;throw new Error('Expected an empty object.');};
  const tools:Tool[]=[
    {name:'get_game_status',title:'查看冒險狀態',description:'讀取目前畫面、主線進度與離線狀態。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){empty(input);return {screen,cleared:save.profile.cleared,embers:save.profile.embers,room:save.run?.room??null,offlineReady:offline.ready};}},
    {name:'pause_game',title:'暫停冒險',description:'將進行中的戰鬥或解謎暫停，顯示遊戲暫停選單。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){empty(input);if(!arena)throw new Error('No active room.');pause();return {paused:true,screen};}},
  ];
  for(const tool of tools)try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser capability. */}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
void loadSave().then(s=>{save=s;selectedMission=Math.min(save.profile.cleared,5);selectedWeapon=save.run?.weapon??'staff';renderCamp();registerTools();void prepareOffline();}).catch(e=>{app.innerHTML='<main class="error-screen"><h1>暫時無法讀取存檔</h1><p></p><button id="reload">重新開啟</button></main>';app.querySelector('p')!.textContent=e.message;click('#reload',()=>location.reload());});
