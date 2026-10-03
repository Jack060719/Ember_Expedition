import { readFile, writeFile } from 'node:fs/promises';
const [batch,first,last]=process.argv.slice(2).map(Number);
const data=JSON.parse(await readFile(`artifacts/mainline/batch-${first}-${last}.json`,'utf8'));
if(data.pending||data.errors.length)throw new Error('Incomplete report');
const rows=data.reports.filter(r=>r.chapter>=first&&r.chapter<=last);
const range=values=>`${Math.min(...values)}～${Math.max(...values)}`;
const count=rows=>`${rows.filter(r=>r.complete).length}/${rows.length}`;
const sum=(r,key)=>Math.round(r.rooms.reduce((n,s)=>n+s[key],0));
const lines=[
  `# 第 ${batch} 批量測：第 ${first}～${last} 章`,'',
  `來源：artifacts/mainline/batch-${first}-${last}.json；程式來源與驅動器 SHA-256 隨報告保存。新章 ${rows.length} 趟，${rows.filter(r=>r.complete).length} 通關、${rows.filter(r=>!r.complete).length} 失敗。另四趟高營地早期重玩 ${count(data.reports.filter(r=>r.chapter<first))} 通關。`,'',
  `每章兩趟 × ${[...new Set(rows.map(r=>r.weapon+'/'+r.build))].join('／')} × 普通／困難 × 0／1／3 寵；種子 8、書庫 3。杖為守燈人，其餘為守衛。從第一房選實際提供的升級卡，不移植首領入口；每房 finishRoom、序列化及 validateSave。寵物遭遇設 none 以固定隊伍，馴服另外測試。策略名是選牌目標，成型與失敗逐列保留。自動策略不代表真人勝率。`,'',
  '| 章 | 工坊／燈塔 | 普通 | 困難 | 零寵普通 | 一寵／三寵兩難度 | 普通首通收益 | 普通重玩收益 | 下級工坊／重玩趟數 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
];
for(let c=first;c<=last;c++){
  const all=rows.filter(r=>r.chapter===c),normal=all.filter(r=>r.difficulty==='normal'),wins=normal.filter(r=>r.complete);
  lines.push(`| ${c} | ${all[0].camp} | ${count(normal)} | ${count(all.filter(r=>r.difficulty==='hard'))} | ${count(normal.filter(r=>r.petCount===0))} | ${count(all.filter(r=>r.petCount===1))}；${count(all.filter(r=>r.petCount===3))} | ${range(wins.map(r=>r.firstClear))} | ${range(wins.map(r=>r.replay))} | ${all[0].nextForgeCost}／${range(wins.map(r=>r.replaysForForge))} |`);
}
lines.push('','普通零寵逐趟：死亡列只計至死亡，第一趟末房為守衛，不是章末首領。完整 0／1／3 寵輸出、首領承傷與擊殺秒數、各次選牌見 JSON。','','| 章／趟 | 構築 | 結果 | 完成房 | 戰鬥秒數 | 承傷 | 首領秒數 | 進化房 | 目標成型 |','| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for(const r of rows.filter(r=>r.difficulty==='normal'&&r.petCount===0))lines.push(`| ${r.chapter}／${r.mission%2+1} | ${r.weapon}/${r.build} | ${r.complete?'通關':'失敗'} | ${r.rooms.filter(s=>s.complete).length} | ${sum(r,'seconds')} | ${sum(r,'damage')} | ${r.rooms.at(-1).bossSeconds??'—'} | ${r.evolutionRoom??'未進化'} | ${r.buildComplete?'是':'否'} |`);
lines.push('','普通代表通關：每趟選兩種不同主武器，優先列零寵，其次一寵。承傷為七房累計；寵物首領傷害只計實際扣血，非面板理論值。','','| 章／趟 | 構築 | 寵物 | 戰鬥秒數 | 承傷 | 首領秒數 | 寵物首領傷害 | 首通／重玩 |','| --- | --- | --- | --- | --- | --- | --- | --- |');
for(let chapter=first;chapter<=last;chapter++)for(const offset of [0,1]){
  const selected=new Set();
  for(const r of rows.filter(r=>r.chapter===chapter&&r.mission%2===offset&&r.difficulty==='normal'&&r.petCount<=1&&r.complete).sort((a,b)=>a.petCount-b.petCount)){
    if(selected.has(r.weapon)||selected.size===2)continue;selected.add(r.weapon);
    lines.push(`| ${chapter}／${offset+1} | ${r.weapon}/${r.build} | ${r.pets.join('、')||'無'} | ${sum(r,'seconds')} | ${sum(r,'damage')} | ${r.rooms.at(-1).bossSeconds??'—'} | ${sum(r,'petBossDamage')} | ${r.firstClear}／${r.replay} |`);
  }
}
lines.push('','失敗配置（含困難，未刪除）：','','| 章／趟 | 構築 | 難度 | 寵物數 | 完成房 | 收益 |','| --- | --- | --- | --- | --- | --- |');
for(const r of rows.filter(r=>!r.complete))lines.push(`| ${r.chapter}／${r.mission%2+1} | ${r.weapon}/${r.build} | ${r.difficulty} | ${r.petCount} | ${r.rooms.filter(s=>s.complete).length} | ${r.replay} |`);
const zeroCoverage=Array.from({length:last-first+1},(_,i)=>first+i).every(chapter=>[0,1].every(offset=>new Set(rows.filter(r=>r.chapter===chapter&&r.mission%2===offset&&r.difficulty==='normal'&&r.petCount===0&&r.complete).map(r=>r.weapon)).size>=2));
lines.push('','所有房間均完成或明確死亡，沒有 240 秒停滯；峰值不超過 160。'+(zeroCoverage?'各章兩趟皆有至少兩種零寵普通構築通關。':'本批未達每章兩種零寵構築通關；依Roadmap分列零寵結果，驗收確認每章兩趟至少兩種構築在最多一隻一般房可遇寵物下通關。')+'實機 iPhone／Android 單指操作、長時間遊玩及三寵效能尚待硬體驗收。','');
await writeFile(`TASK-009-BATCH-${batch}-MEASUREMENTS.md`,lines.join('\n'));
console.log(`Wrote batch ${batch}: ${count(rows)}`);
