# TASK-002 角色分支交接

更新：2026-09-21。負責者：Codex；工作樹 `C:/Users/User/orca/workspaces/nowifi/task-002-characters`，分支 `Jack060719/task-002-characters`，基準 `aa4196079664bdcc715395b3b21e9b1063f9b176`。

狀態：本分支已完成角色功能，並接入 TASK-003 的完整武器／場景與 TASK-004 的能力模組及效果，待 main 整合與 TASK-005 平衡試玩。`STATUS.md` 與產品文件由 main 整合者統一更新，本檔不代表 main 或正式站已取得這些功能。

角色提交 `418c610` 已整筆快轉接入 TASK-004 `30f8bc9` 及其紀錄提交 `a66eea8`，保留全部依賴、素材與測試。其後完整套用 TASK-003 `c9797549125d7600990ab4acbc644c8bb20f25bf` 交付的 `task003-on-task002.patch`，包含二進位素材；更新本交接文件前，暫存 Git tree 為 `6c7b1a165f4ebb79e86fde9344e59236baa544e2`，與交付提交完全一致。角色 UI／樣式／資料沒有另行改動，保留 TASK-003 完整 `arena.ts`。

## 完整整合的本工作樹驗證

- `npm.cmd test`：52 項通過。
- `npm.cmd run build`：通過，19 個離線資源，版本 `d148fed5288b`。
- `node scripts/check-weapons.mjs --upgrades`、`node scripts/check-upgrades.mjs`：35 項武器與 30 項技能場景通過；腳本核對伺服器來源與本工作樹一致。
- `node scripts/check-character-arena.mjs --port=4180`：36 項角色場景通過。
- `node scripts/check-characters.mjs --port=4180`：六組角色 UI／存檔／離線與當級說明流程通過。
- `node scripts/check-weapons-browser.mjs`：五把武器在 320px 的解鎖／選用、新武器搭配新角色的離線存檔往返與五張新增素材解碼通過；已檢視五武器營地及長升級說明截圖。
- `test:android` 所列三支腳本依序以 `--android` 執行：`check-game.mjs`、`check-arena.mjs`、`check-offline.mjs` 全通過，涵蓋完整瀏覽器流程、49 項戰鬥／觸控、manifest、離線補檔、登入失效恢復、更新與存檔保留。這次於完整場景接入後重跑，不沿用角色提交時的結果。

測試皆使用本工作樹；5173 的兩支效果檢查由臨時 Vite runner 啟動並於 `finally` 關閉，其餘腳本在 4180 自建及關閉伺服器。結束後以 `Get-NetTCPConnection` 確認 5173／4180 Listener 合計為 0，已通知 TASK-003／004 正式釋放。4173 PID 2676 的思維導圖伺服器保持原狀。報告及截圖保留於忽略的 `artifacts/`。

本次沒有重跑七房與首領矩陣；TASK-003 的量測及限制見 [TASK-003-HANDOFF.md](TASK-003-HANDOFF.md)。其中新武器七房 40 組為 36 通關、4 死亡，不能稱為全部平衡驗收通過；三組專注進化與一組星墜策略死亡仍交 TASK-005 檢視。成型後 36 組獨立首領通關，也不代表後兩章／困難完整遠征或自然取得協同已驗收。

## 角色提交 `418c610` 的修改

- `src/characters.ts`：保留既有三名角色、解鎖與起手，補上說明、素材路徑、貼圖與動畫名稱。
- `src/main.ts`、`src/style.css`：營地可預覽全部角色、選擇已解鎖角色；保存成功才變更偏好。預覽與營地生命使用 `startingLoadout`，新局傳入偏好角色。續玩、地圖、暫停與構築視窗顯示當局角色，已有遠征時不提供換角。
- 說明從 `upgrades.ts` 的 `upgradeDescription` 取得：選項傳下一級，角色起手與已取得能力傳目前級。兩處自動技能列改用 `AUTO_UPGRADES`，包含星墜；構築格內提供當級說明，320px 長內容可捲動。
- `src/arena.ts`：只套用 TASK-003 明確交付的 `task002-character-arena.patch`，由其作者完成並授權本分支接入；改為依當局角色載入貼圖與動畫，保持既有戰鬥規則。最終整合時保留 TASK-003 完整場景，此片段應等價合併，不以本樹 arena 覆蓋新武器／技能版本。
- `public/assets/characters/`、`assets-source/characters/`：斥候／守衛本地透明圖集與原始圖、提示、分幀、QC；沿用已保存素材，沒有重新生成。詳見[素材契約](assets-source/characters/README.md)。
- `tests/characters.test.ts` 與三支 `scripts/check-character*`：角色規則、選角保存、離線、場景與素材檢查。場景檢查必須在 TASK-003 接入後通過，不以介面檢查代替。

## 場景介面（由 TASK-003 負責）

以 `CHARACTERS[run.character]` 的 `spritePath` 載入 `textureKey`，建立四組 `${animationPrefix}${direction}` 動畫。所有角色都使用 `character-ID` 與 `character-ID-walk-`；keeper 素材仍為 `/assets/hero.png`。保留每格 128、每方向四幀、8 FPS、67×67 顯示、origin `(0.5,0.82)` 與既有碰撞規則。場景不重算角色起手，不回血。

本機專屬場景檢查先於共同基線得到 21／36 通過，15 項貼圖／動畫檢查失敗。套用 TASK-003 交付的角色 patch 後，本工作樹 36／36 通過；已檢視斥候與守衛實際戰鬥截圖，離線冷開也使用正確素材。

## 角色提交 `418c610` 的驗證紀錄

- `npm.cmd test`：47 項通過，含五項角色專屬檢查及 TASK-004 測試。
- `npm.cmd run build`：通過，17 個離線資源，版本 `6ec778aa8444`；僅既有 bundle 大小提示。
- `python scripts/check-character-assets.py`：兩張圖集均通過透明度、16 幀、比例、對齊與處理紀錄檢查。
- `node scripts/check-characters.mjs --port=4180`：最終六組流程通過；包含 320px 鎖定預覽、保存失敗重試、書庫疊加、偏好與當局角色分離、受傷檢查點重開、匯出／匯入、無效匯入與三張圖集離線解碼。新增星墜／護燈者／守燈決意下一級說明、星墜選取後當級說明與四項自動技能列檢查。已檢視手機、桌面、角色實戰與長說明畫面。報告／截圖位於忽略的 `artifacts/characters/`。
- `node scripts/check-character-arena.mjs --port=4180`：最終 36 項全通過，含三角色貼圖／動畫、原點與尺寸、速度、碰撞、減傷與不重算起手。
- `npm.cmd run test:android`：角色介面完成、接入升級模組與場景 patch 前通過完整瀏覽器、49 項既有機制、安裝／離線／更新回歸。最後角色 patch 後另跑上述六組介面／離線檢查與 `node scripts/check-arena.mjs --android`，49 項全通過。
- `node --check` 兩支角色瀏覽器腳本、`git diff --check` 通過。未在角色分支重跑七房平衡；本次場景 patch 只有外觀接線，TASK-004 自有七房結果另見其交接，不當成本分支實測。

兩支角色瀏覽器腳本均自行啟動並關閉本工作樹伺服器，使用明確 `127.0.0.1` 與 `strictPort`：介面預設 4173、場景預設 5173，也支援 `--port=4180`。執行前依 AGENTS 協調埠，不另開同埠伺服器。角色提交驗證時 5173 由 TASK-003 使用，因此使用已協調的 4180，完成後確認無 Listener 並釋放給 TASK-003。本機 4173 屬另一個思維導圖專案，未停止或使用它。Windows 沙箱可能阻擋 esbuild 存取上層目錄或隱藏 Python 路徑；建置與瀏覽器測試於沙箱外完成。

存檔／離線／部署：維持共用 Save v3 與 IndexedDB 身分，不改 v1／v2 遷移；角色、武器與星墜素材均已納入離線建置。武器飛行與待落擊不新增存檔欄位。未部署、未變更網站權限。iPhone／Android 真機、跨功能平衡及正式站更新仍待整合者驗收。

下一步：main 接入整合版本，由整合者統一更新 STATUS／ROADMAP，並由 TASK-005 檢視已列出的死亡、協同取得與成型時機。若 main 仍為共同基線，可整合 TASK-003 正式分支；若已含角色提交 `418c610`，可接入本分支的後續整合提交，不需重複 cherry-pick TASK-002／003／004 的等價內容。
