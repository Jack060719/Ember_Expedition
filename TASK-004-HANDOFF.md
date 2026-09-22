# TASK-004 升級模組交接

2026-09-22 整合註記：使用者已核准合併 main，能力效果與角色介面接線均已完成。以下「尚待接入」是分支交付時的歷史狀態；最新驗證與發布狀態以 [STATUS.md](STATUS.md) 為準。

更新日期：2026-09-21。正式規格以 [PROJECT.md](PROJECT.md) 為準；本檔記錄升級分支的實際交付，供整合者更新 STATUS／ROADMAP。

任務／負責者／分支／基準提交：TASK-004／Codex／`Jack060719/task-004-upgrades`／`aa4196079664bdcc715395b3b21e9b1063f9b176`。

狀態：升級登記表、純效果函式、說明及素材已備妥；尚未接入 TASK-003 的戰鬥場景與 TASK-002 的當級說明介面，不能視為完整功能驗收或發布版本。本次接手時上述模組、素材與獨立測試已有未提交工作，已保留並接續修正。

程式與素材交付提交：`30f8bc94a6a9ff94847f712b530b86de474a278a`，可整筆合併，或在共同 aa41960 基線上 cherry-pick；不可只取 upgrades.ts 而漏掉 ability-effects.ts。TASK-002 已回覆收到此提交，將由角色分支接入當級說明。

## 修改與相容性

- `src/upgrades.ts` 保留原 18 項順序與上限，追加 `meteor`／`cull`／`resolve`，各上限 3 級。沿用既有選項池，沒有武器、角色或生命條件限制取得；生命門檻只限制效果觸發。`AUTO_UPGRADES` 由同一登記表推導，順序為 storm／orbit／nova／meteor。
- `src/ability-effects.ts` 提供 `meteorStats(upgrades)`、`cullMultiplier(upgrades,hp,maxHp,secondary=false)`、`resolveMultiplier(upgrades,hp,maxHp)`。只以 type-only import 引用 Run；不持有場景狀態、不變更輸入。
- `upgradeDescription(id,level)` 回傳當級累計效果，0 級為「尚未取得」。星墜說明直接使用 `meteorStats` 的數值，乘隙與守燈決意共用門檻／每級百分比常數。35% 門檻包含等於；霜息各級為 18／36／54% 減速，時間固定 1.5 秒，未改動既有戰鬥數值。
- `tests/upgrades.test.ts` 覆蓋三角色 × 三把既有武器的取得、封頂、選項序列化、進化材料保留、公式、35% 邊界、說明與存檔往返。`tests/save-v3.test.ts` 僅將自動技能預期清單補上 meteor；其餘既有 fixture／core 測試未改。
- 星墜執行素材為 `public/assets/upgrades/meteor.png`，原圖、生成提示、處理紀錄及圖集契約在 [assets-source/upgrades/meteor/contract.json](assets-source/upgrades/meteor/contract.json)。單張 128×128 透明圖，向下落擊；傷害依圓形半徑計算，不使用圖像邊界判定碰撞。乘隙與守燈決意沿用文字圖示，不需新貼圖。

Save 維持 v3，不新增 Run 欄位或永久成長欄位。既有通用驗證已接受登記表內的新 ID 並拒絕超級、負數、非整數與非有限值；舊 v1／v2 檔不補三項新能力、不回血。經驗曲線、進化配方、兩個協同 ID、IndexedDB 與部署身分不變；未發布。

## TASK-003：場景接入

從 `./ability-effects.ts` 匯入函式，載入 `/assets/upgrades/meteor.png`。本分支不修改 `src/arena.ts`；此處的待辦尚未實作或通過場景驗證。

1. 星墜只由場景保存計時器與一個待落擊；每房首次 1 秒，未取得時不提前消耗首次延遲。冷卻就緒但 300 內沒有活敵人時等待，不排隊多次施放。
2. 就緒時鎖定最近敵人的當前座標，保存當次 `D × damageMultiplier` 與 radius，0.4 秒後在該座標落擊。後續能力變動不重算已排定的傷害／半徑；命中時才判定乘隙、暴擊及異常狀態。舊三把武器保留原 D；新武器 D 依 PROJECT，不另吃近戰穿透加成。
3. 直接命中前，用敵人尚未扣血的 hp/max 取得 `cullMultiplier`，再套用既有暴擊／狀態。secondary 不吃乘隙、暴擊或普通命中狀態；燃燒敵人被 secondary 擊殺仍可按原規則觸發餘燼連爆。
4. 承傷時，以扣血前的玩家 hp/maxHp 計算 `resolveMultiplier`，與原護燈者倍率相乘，再處理不熄之火。跨過 35% 的當次傷害不追溯減免。
5. 暫停、切背景與升級選單停止計時；恢復時不補算背景時間。清場吸收階段、死亡及場景銷毀取消待落擊並銷毀圖片；房間重開不恢復舊落擊。完成所有掉落與升級後只結算一次。

`scripts/check-upgrades.mjs` 是待接入後執行的場景回歸腳本。它先比對本工作樹與 5173 伺服器的六份原始碼，再檢查落點快照、命中順序、連爆、伴星共用命中冷卻、減傷／復活、暫停、清場及場景銷毀。腳本目前探查 `meteorTimer`、`pendingMeteor` 與其 `x/y/damage/radius/remaining/sprite`；若場景採不同私有名稱，由場景負責者對齊測試，保留行為檢查。現階段只通過語法檢查，不能宣稱新效果在實戰中已通過。

## TASK-002：說明接入

- 從 `./upgrades.ts` 匯入 `upgradeDescription`，升級選單傳入 `(run.upgrades[id] ?? 0) + 1`，已取得能力／構築說明傳入目前等級。
- 自動技能列使用 `AUTO_UPGRADES`；目前 `main.ts` 的三項固定清單還沒有星墜。
- 星墜說明較長，接入後檢查 320／390 px 手機畫面的換行、捲動及按鈕可達性。

## 驗證

| 指令／檢查 | 本分支結果 |
| --- | --- |
| `npm.cmd test` | 42 項通過；新增說明測試曾在原文字失敗，修正後通過。 |
| `npm.cmd run build` | 通過；離線版本 `22cae8b6edbc`，15 個快取資源。保留既有 bundle 大小提示。 |
| `node --check scripts/check-upgrades.mjs`、`git diff --check` | 通過。 |
| 星墜素材檢查 | 已視覺檢查完整星核與上方火尾；透明外框、alpha 0–255、範圍 `[41,13,87,115]` 與契約雜湊相符。dist 圖檔相同，sw.js 包含此資源。 |
| `npm.cmd run test:android` | 通過；完整瀏覽器流程、49 項既有戰鬥／觸控、manifest、離線補檔、登入失效恢復、更新與存檔保留回歸。使用獨立 Chromium，4180 伺服器已自行關閉。 |
| 七房矩陣 | 24 組、168 房全部通過；法杖／短劍第 5 房、光環第 4 房進化。使用 `scripts/check-balance.mjs` 的本機副本，只將入口由 localhost:5173 改成 127.0.0.1:4180，模擬與斷言不變；先比對六份來源檔案。5173 屬於其他版本；4180 經 TASK-002 明確釋放後使用，結束已自行關閉。這是加入登記表後的既有戰鬥回歸，新效果尚未接入。 |

本機證據輸出於忽略的 `artifacts/`，不提交或部署；素材檢查為 `task004-asset-qc.json`，逐房結果為 `balance-report.json`，來源與原始／執行 driver 雜湊為 `task004-balance-source.json`。esbuild 在受限環境讀取上層目錄遭拒後，建置以受審核執行通過。受限環境原無法辨識 Orca，改由受審核執行成功讀取同版本 CLI 指南；已依 TASK-002 明確要求重新查詢其唯一終端並回覆介面／測試埠交接。

下一步：整合者接入本分支交付，TASK-002／003 完成上述接線；依序使用已確認來源的測試埠，執行新升級場景檢查與受影響回歸，再統一更新 STATUS／ROADMAP。仍待新效果接入後的新舊內容混搭、完整遠征及 iPhone／Android 實機驗收。
