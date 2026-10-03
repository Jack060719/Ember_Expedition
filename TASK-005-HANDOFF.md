# TASK-005 自由搭配與多構築驗證交接

日期：2026-09-22。負責者：Codex。狀態：分支實作與驗證完成，待 TASK-008／009 接入及整合者更新全域文件；未合併 main、未發布。

- 工作樹：`C:/Users/User/orca/workspaces/nowifi/task-005-freebuilding`
- 分支：`Jack060719/task-005-freebuilding`
- 開工確認：工作樹乾淨、HEAD `c052edd30b6ab82cf3aaf961b1a5457735e2430a`，依指派快轉至共同基準 `c6e22871478cb928916dd866fef94ecdc97df8d8`。未使用 reset／clean。
- **可接入功能提交：`b53c76b27d8c89ece46867653d11560376809484`**。本文件為其後的交接提交；功能提交已包含全部程式與測試差異。
- 指派依據：`TASK-005-008-009-ASSIGNMENTS.md`、本樹 AGENTS／PROJECT／STATUS／ROADMAP／README 及 [TASK-003-HANDOFF.md](TASK-003-HANDOFF.md)。005 保持 Save v3。

## 結論與修改

量測確認原選項機制保留進化材料及未學自動技，已學自動技續級／協同缺項則主要依賴剩餘隨機槽。TASK-003 的 24 組混合策略只有 1 組完成額外能力目標、沒有自然協同。這是改善續建機會的證據；四組策略死亡本身不足以證明武器傷害有錯。

`src/core.ts` 的 `upgradeChoices` 現在保留原前兩張牌，第三張有 50% 機會提供池中尚未滿級的已學自動技，或已開始協同的缺少材料。若沒有候選則沿用原選項。候選沿用既有種子與洗牌，不替玩家選擇、不直接給能力。全部 21 種能力仍可出現。

這次選擇改善自然投資的延續性，接受不同選擇改變生存與進化時機。40 組舊案例的混合目標由 1／24 增為 18／24；285 組擴充案例的通關由 195 降為 194，不能稱為全面增強。165 組專注案例逐房戰鬥數據完全相同，270 組隔離首領的能力選擇與戰鬥數據也相同，因此沒有進一步調高傷害或降低敵人強度。

| 修改檔案 | 結果 |
| --- | --- |
| `src/core.ts` | 僅上述第三張升級牌規則。進化配方、經驗曲線、永久成長、數值表、一般房節奏及存檔格式維持原樣。 |
| `tests/freebuilding.test.ts` | 兩個真實未續建狀態的回歸；三角色 × 五武器 × 256 種子的可達性、唯一性、上限、進化材料／未學技能保留檢查。 |
| `scripts/check-balance.mjs` | 保留舊 24／40 組模式；新增 285 組矩陣、逐房承傷／治療／擊殺與成型紀錄、來源核對、同 driver 比較及禁止覆寫基準。 |
| `scripts/check-weapon-boss.mjs` | 保留原 36 組模式；新增三角色五武器的 270 組隔離矩陣，固定基準入口、同預算變體及缺入口／預算的明確跳過理由。實際本輪沒有跳過。 |

沒有修改 `arena.ts`、武器／能力效果表、寵物欄位、章節、營地經濟、素材或 UI。沒有共用型別、ID、hook 或公開函式簽名變更。

## 調整前證據與量測方法

先在未改玩法的 c6e2287 保存全部 `src`、原 driver 及來源雜湊，再以原 TASK-003 driver 重跑 40 組與 36 組新武器首領。接著只加量測資訊，以新 driver 重跑相同 40 組：全部原有逐房數據與選牌一致（`instrumentation-check.json`）。死亡結尾能力改記實際場景狀態，修正舊報告停在房間入口的記錄問題；沒有改變遊戲行為。

之後完成 `full-before.json` 及 `boss-before.json`，才修改 core。兩個新增機制回歸在舊 core 確實失敗（`choices-before.log`），修改後通過。前後唯一不同的遊戲來源檔是 `src/core.ts`。所有本輪基準都是在此工作樹重新量測，沒有沿用來源不明的其他工作樹報告。

量測使用 Node v24.20.0、Playwright Chromium、30 FPS 模擬與正常傷害／移動；瀏覽器版本、UTC 時間、HEAD、branch、git status、Save 版本、全部來源雜湊及 cases 都在報告。量測當時 HEAD 仍是 c6e2287，修改狀態及 sources 用來區分 before／after；提交前另核對目前檔案與 after 的來源及 driver 雜湊一致。

- 每房從實際能力、HP 與經驗繼續，經 `finishRoom` 及存檔序列化／驗證後進下一房。沒有補經驗、補能力、補傷害或用另一局替換死局。
- `focus` 選第一張；混合策略只在實際選項出現時優先選指定缺項，否則回到進化材料。`froststorm` 目標為 storm 2＋frost 2，`wildfire` 為 ember 2＋nova 2，`meteor` 為 meteor 3；`survival` 為 ward 2＋resolve 2＋cull 2。
- `buildComplete` 只表示額外目標，**不包含主武器進化**；focus 的空目標會使欄位為 true，應改看 `evolutionRoom`。實際協同看 `synergyRooms`，不能把策略名稱當成已成型。
- 記錄每次 offered／chosen／level／room、每房進出能力、進化／協同／額外目標首次房號、擊殺、承傷、有效受擊、治療、HP、耗時、首領死亡時間、怪量峰值、空場比例及首領入口。
- 承傷為實際 HP 扣除（含致死前剩餘 HP），治療以每幀 HP 收支計算，包含房內升級／回血／復活；房間結束自動回血不算房內治療，下一房 `entryHp` 會反映它。未通關者耗時與承傷截至死亡，不宜直接與整趟通關總量比較。
- 新矩陣的移動預測考慮 stride 及祭司地面警示；舊 40 組維持原移動策略。只比較各模式內相同 driver 的前後結果。

## TASK-003 四組死亡與較晚進化重現

此 40 組為 keeper、最低武器工坊、燈塔 0、書庫 0／3、種子 1／8／12／42，mission 0 普通七房，**第七房是守衛清場，並非章節首領**。

| 武器／書庫／種子／策略 | 調整前 | 調整後 |
| --- | --- | --- |
| 飛環／0／42／focus | 第 2 房死亡 | 同房死亡，戰鬥數據不變 |
| 戰錘／0／12／focus | 第 4 房死亡 | 同房死亡，戰鬥數據不變 |
| 戰錘／0／42／focus | 第 4 房死亡 | 同房死亡，戰鬥數據不變 |
| 戰錘／3／12／meteor | 第 4 房死亡 | 七房通關、meteor 3，第 7 房進化 |
| 飛環／3／42／froststorm | 七房通關、第 6 房進化、未成協同 | 新增第 7 房死亡；第 7 房取得協同，主武器未進化 |

| 40 組中的策略 | 組數 | 通關：前 → 後 | 額外目標成型：前 → 後 |
| --- | ---: | ---: | ---: |
| focus | 16 | 13 → 13 | 不適用；通關者皆第 5 房進化 |
| froststorm | 8 | 8 → 7 | 0 → 4 |
| wildfire | 8 | 8 → 8 | 0 → 6 |
| meteor | 8 | 7 → 8 | 1 → 8 |
| 合計 | 40 | 36 → 36 | 混合策略 1／24 → 18／24 |

原資料中冰雷／餘燼無自然協同、星墜只有飛環 seed 12 達到 3 級，已完整重現。原分散投資常第 6 房進化；調整後星墜八組皆第 7 房進化，其他混合策略可能第 5～7 房或未進化。新增自然協同共 10 組，其中 9 組七房通關。這些結果不能代替實際首領遠征。

## 285 組完整遠征矩陣

角色為 keeper／scout／warden，武器為 staff／blade／halo／boomerang／hammer，均保留自己的起手能力。`cleared=6` 僅供解鎖；低營地為最低武器工坊、燈塔 0。

| 群組 | 組成 |
| --- | --- |
| 低營地 focus 90 組 | 三角色 × 五武器 × 三章 × 普通／困難；書庫 3、seed 8。 |
| 低營地混合 90 組 | 相同維度；依角色索引＋武器索引＋章索引輪替 froststorm／wildfire／meteor。各策略 30 組，並非每個角色武器都遍歷每種策略。 |
| 低營地生存 30 組 | 三角色 × 五武器 × 兩難度，依角色＋武器索引輪替章節；書庫 3、seed 12。 |
| 低書庫補測 15 組 | 三角色 × 五武器，書庫 0、seed 42、focus、mission 0 普通守衛遠征。 |
| 中／高營地 60 組 | keeper × 五武器 × 三章 × 兩難度 × 工坊／燈塔／書庫全 10 或全 20；seed 8、focus。 |

合計 285 組中，270 組真正從第一房打到當章首領或死亡（mission 1／3／5），另 15 組守衛遠征單列。沒有把首領入口移植計入本節。

下表耗時為**通關者整趟秒數中位數**；承傷為該列**全部案例含死局**的總承傷中位數。不同存活長度會影響解讀。

| 營地／章／難度 | 組數 | 通關 前 → 後 | 耗時 前 → 後 | 承傷 前 → 後 |
| --- | ---: | ---: | ---: | ---: |
| 低／1／普通 | 35 | 35 → 33 | 459.6 → 465.6 | 87.12 → 94.64 |
| 低／1／困難 | 35 | 20 → 20 | 469.9 → 473.55 | 132.23 → 132.23 |
| 低／2／普通 | 35 | 31 → 30 | 472.7 → 475.7 | 152.76 → 166.32 |
| 低／2／困難 | 35 | 19 → 20 | 483.9 → 491.85 | 138 → 128 |
| 低／3／普通 | 35 | 15 → 15 | 490.5 → 502.4 | 147.44 → 151.68 |
| 低／3／困難 | 35 | 7 → 8 | 474.6 → 489.7 | 138 → 138 |
| 全 10／1／普通、困難 | 各 5 | 各 5 → 5 | 逐案不變 | 逐案不變 |
| 全 10／2／普通、困難 | 各 5 | 各 5 → 5 | 逐案不變 | 逐案不變 |
| 全 10／3／普通 | 5 | 5 → 5 | 逐案不變 | 逐案不變 |
| 全 10／3／困難 | 5 | 4 → 4 | 逐案不變 | 逐案不變 |
| 全 20／1、2、3／普通、困難 | 各 5，共 30 | 30 → 30 | 逐案不變 | 逐案不變 |
| 書庫 0／mission 0 守衛／普通 | 15 | 9 → 9 | 504.8 → 504.8 | 99 → 99 |
| 全部 | 285 | 195 → 194 | 466.1 → 468.2 | 123 → 124 |

全 10／20 的六個章節難度分組數值各自記在 `comparison.json` 的 `cohorts`。165 組 focus 包含低、中、高與書庫 0：126 通關／39 死亡，進出能力、擊殺、HP、承傷、治療、耗時、峰值、空場率與進化房號逐案不變。既有 24 組一般房回歸維持光環第 4 房、法杖／短刃第 5 房進化；高營地較早進化保留原永久成長效果。

| 額外目標 | 組數 | 目標成型 前 → 後 | 通關 前 → 後 |
| --- | ---: | ---: | ---: |
| froststorm | 30 | 0 → 0 | 20 → 18 |
| wildfire | 30 | 0 → 4 | 19 → 18 |
| meteor 3 | 30 | 0 → 21 | 15 → 16 |
| ward 2＋resolve 2＋cull 2 | 30 | 0 → 0 | 15 → 16 |

四組自然餘燼協同都在第 7 房成型並通關，**主武器皆未進化**；都為普通、書庫 3、seed 8。它們是自然能力組合的實際首領遠征證據。

| 角色／武器／章 | 整趟秒數 | 總擊殺 | 總承傷 | 最後 HP | 首領死亡秒數 |
| --- | ---: | ---: | ---: | ---: | ---: |
| keeper／staff／2 | 521.4 | 3159 | 226.16 | 120 | 98.8 |
| scout／staff／1 | 509.9 | 3159 | 25.52 | 100 | 98.8 |
| warden／blade／2 | 485.2 | 3063 | 62.32 | 100 | 78.63 |
| warden／hammer／2 | 523.5 | 3195 | 207.48 | 50 | 106.87 |

285 組中有 66 組的摘要結果改變，全部是非 focus。四組由通關變死亡：keeper／staff／第 1 章普通／froststorm（房 6）、scout／hammer／第 3 章普通／wildfire（房 7）、warden／staff／第 1 章普通／meteor（房 6，已取得 meteor 3）、warden／staff／第 2 章普通／froststorm（房 6）；均 seed 8、未進化。三組由死亡變通關：keeper／halo／第 3 章困難／seed 12／survival、keeper／hammer／第 2 章困難／seed 8／meteor、scout／halo／第 3 章普通／seed 8／meteor。各自完整前後能力與數據在 `comparison.json` 的 `changed`，不是額外隱藏失敗。

## 270 組隔離首領

使用 `full-before.json` 中三角色五武器第一章普通、seed 8、書庫 3、focus 的真實第七房入口；前後均讀同一份 bytes，再移至三章普通／困難首領。natural 保留能力；froststorm／wildfire 重新分配相同已取得能力總級數，組成進化配方＋指定協同後才填剩餘預算。沿用原 growth 與入口 HP（上限變更時截斷），不補至滿血。

這是**入口移植與同預算重分配**，並非玩家自然取得這些協同、後章／困難完整遠征或同樣生存投資的比較。profile 的解鎖值不會重算入口 growth。

| 章／難度 | 組數 | 通關 前 → 後 | 死亡 前 → 後 | 通關首領死亡秒數中位數（前後相同） |
| --- | ---: | ---: | ---: | ---: |
| 1／普通 | 45 | 45 → 45 | 0 → 0 | 43.93 |
| 1／困難 | 45 | 45 → 45 | 0 → 0 | 62.5 |
| 2／普通 | 45 | 45 → 45 | 0 → 0 | 52.93 |
| 2／困難 | 45 | 45 → 45 | 0 → 0 | 75.17 |
| 3／普通 | 45 | 45 → 45 | 0 → 0 | 61.7 |
| 3／困難 | 45 | 40 → 40 | 5 → 5 | 82.17 |
| 合計 | 270 | 265 → 265 | 5 → 5 | — |

五組死亡皆為第三章困難光環：keeper natural／froststorm、scout froststorm、warden natural／froststorm。沒有卡死或超過 160 怪，沒有跳過案例；全部入口、原前兩張選項、實際選牌、終局能力與戰鬥數據前後一致，第三張候選可不同。另原 TASK-003 的 36 組新武器隔離首領已在調整前重現 36 通關，首領約 34.83～116.3 秒；未把它算成新增自然遠征。

## 驗證指令與結果

| 指令／檢查 | 結果 |
| --- | --- |
| `npm.cmd test` | 基準 52 項通過；最終 55 項通過。新增的兩個續建回歸在修改前失敗、修改後通過。 |
| `npm.cmd run build` | 前後通過。最終原生命令 exit 0、離線 19 資源、版本 `d5da1e1c6c42`；只有既有 bundle 大小提示。PowerShell 重導向會把此 stderr 提示記成 NativeCommandError，已確認原生退出碼成功。 |
| `node scripts/check-weapons.mjs --upgrades` | 前後各 35 項通過。 |
| `node scripts/check-upgrades.mjs` | 前後各 30 項通過。 |
| `npm.cmd run test:arena` | 修改後 49 項場景／觸控及 24 組完整七房（168 房）通過。 |
| `node scripts/check-character-arena.mjs --port=4180` | 修改後 36 項通過。 |
| `node scripts/check-characters.mjs --port=4180` | 修改後六組角色 UI、320px、存檔／匯入失敗保護、能力說明與離線檢查通過。 |
| `node scripts/check-weapons-browser.mjs` | 修改後武器 UI、離線檢查點及存檔往返、五張新增武器圖片通過。 |
| `npm.cmd run test:android` | 修改後完整瀏覽器 11 項、arena／觸控 49 項及八組安裝／更新／登入恢復／離線流程通過，exit 0。 |
| `node scripts/check-balance.mjs --weapons --upgrades` | 同 driver 的前後 40 組完成；36 通關／4 死亡，無卡死或怪量超限。 |
| `node scripts/check-balance.mjs --matrix --baseline`、`node scripts/check-balance.mjs --matrix` | 各 285 組完成；結果如上。來源／driver／case 一致性、無卡死與怪量上限檢查通過，並非所有組合都通關。 |
| `node scripts/check-weapon-boss.mjs --matrix --baseline`、`node scripts/check-weapon-boss.mjs --matrix` | 各 270 組完成；前後 265 通關／5 死亡。 |
| `node artifacts/task-005/analyze.mjs` | 前後逐案比較、165 focus 逐房相等、270 隔離首領能力與戰鬥相等、同 driver／case／入口檢查通過。 |
| 基準防覆寫／提交前來源檢查／`git diff --check` | 兩支 `--baseline` 再次執行皆 EEXIST 且基準雜湊不變；目前來源與 after 報告一致；無空白錯誤。 |

沒有另外聲稱執行 `test:browser`（固定 4173）或獨立 `test:offline`；對應完整 browser／offline 流程由 `test:android` 在 4180 執行。未重跑舊 `test:boss` 的 216 組模式；本輪以明確入口的擴充 270 組做前後比較。

## 證據位置與重現

原始證據在本樹忽略的 [artifacts/task-005/](artifacts/task-005/)，另封存 [artifacts/task-005-evidence.zip](artifacts/task-005-evidence.zip)。移動／刪除工作樹前須另外攜帶壓縮檔；它不在 git，也不發布到網站。`evidence-sha256.json` 列出封存檔案的 SHA-256（不自我雜湊）。

| 檔案 | 用途 |
| --- | --- |
| `baseline-source/`、`baseline-source.json` | 調整前遊戲來源、原 driver、package-lock 與來源狀態。 |
| `legacy-before.json`、`legacy-before-sources.json`、`legacy-boss-before.json` | 原 TASK-003 driver 在共同基準重現的 40／36 組。 |
| `observed-before.json`、`observed-after.json`、各自 `-sources.json` | 加量測資訊後的同 driver 40 組比較。 |
| `full-before.json`、`full-after.json` | 285 組完整遠征，含選項、入口及逐房量測。 |
| `boss-before.json`、`boss-after.json` | 固定同一份 full-before 入口的 270 組隔離首領。 |
| `check-balance.mjs`、`check-weapon-boss.mjs` | 本輪凍結 driver 副本。 |
| `comparison.json`、`analyze.mjs` | 可重算摘要、所有變動案例、自然協同通關及前後相等斷言。 |
| `instrumentation-check.json`、`before-sha256.json`、`baseline-guard-check.json` | 原 driver 相等核對、修改前雜湊及防覆寫證據。 |
| `choice-audit.json` | 以舊實際狀態做選項反事實探索，僅供診斷，不是最終機制的戰鬥驗收。 |
| `*-after.log`、`regression/` | 單元／建置／場景／UI／離線執行輸出與報告、截圖。 |

主要 SHA-256：

```text
full-before.json  341192e2e0f78d9580510b52f64ca8f395a26956cd745e557ce8eeb97cbf9bf1
boss-before.json  5c01d3b3009cac07af0607b4fdfe499824de2b1273dc1c310ff23eb1a106b2ae
check-balance.mjs (LF-normalized)      0e38acc1f6324a228c960fc5972b27425a6b8e002290abccf5bddefc9470145f
check-weapon-boss.mjs (LF-normalized)  bce528aaf19581ca632bab53fa5579d99a9b5641bf8b5d99b6219f88f14a6330
```

full-before 的量測起始為 `2026-09-22T14:43:14.738Z`，full-after 為 `2026-09-22T14:55:41.098Z`。driver 雜湊正規化 CRLF 為 LF，來源及證據檔案雜湊則為實際 bytes；換工作樹時須區分換行差異與程式變更。

重現時先取得測試埠安排、核對來源工作樹。以乾淨 c6e2287 加上本提交的兩支量測 driver，在空的證據目錄依序執行兩個 `--matrix --baseline`；保存證據後才接入玩法修改，執行兩個 `--matrix`。若已有本輪封存，可直接帶入凍結基準、用相同 driver 量測 after。不得在已修改的 core 上重建 before，也不要移除防覆寫檢查。不要用現在的 40 組報告覆蓋舊首領入口冒充同入口比較。

## 接入、存檔與未驗證範圍

008／009 可接入 b53c76b；本樹沒有取入 008 的 v4 或 009 的 v5。只需整合 `upgradeChoices` 的對應區段及測試／driver，避免以整檔覆蓋它們的新欄位。這批 v3 入口證據若要用於新版本場景，應經實際 v3 → v4 → v5 驗證／遷移，再依已實作的寵物 hook 調整整合測試；不能只把存檔版本數字改掉，也不能宣稱本輪已驗證新場景。

既有存檔的血量、能力、經驗、growth、偏好角色及房間入口不改。升級牌由 run 狀態重新產生，所以更新／匯入後的第三張候選可能不同，已選能力不被重分配。離線資源仍本地，IndexedDB、部署身分 `.openai/hosting.json` 未改；未發布素材來源、測試存檔或網站。

測試埠已交接：005 自有 5173 Vite（確認來源為本樹）已關閉，5173 交 008；4180 全部檢查完成後已確認釋放並交 009。4173 為其他專案，未使用或終止。協調使用 Orca 訊息，未替其他工作樹停止服務。

仍需真人試玩及後續整合檢查：

- 原三組低書庫 focus 死亡、舊 40 組新增飛環冰雷死亡，以及本輪四組由通關轉死亡的實際首領遠征；先檢查玩家走位、選牌與生存投資，不直接當成傷害 bug。
- 285 組中自然冰雷與完整三項生存目標仍未形成；自然餘燼只在四組普通場景取得，不能外推困難或所有角色武器。星墜成型也不等於主武器進化或保證通關。
- 三章困難低營地、光環的五個隔離首領死局、較多種子與不同選牌方式。中／高營地只測 keeper focus，沒有完整遍歷全部角色 × 武器 × 策略 × 種子。
- 此為固定策略與模擬時鐘的代表測量，不是玩家勝率；整趟時間不含真人選牌／營地閱讀。未驗證真實 iPhone／Android、長時間耗電發熱、兩小時效能或七日留存。
- 008 的 0／1／3 寵整合與 009 新章節／v5 由各任務在接入後驗證；本輪不涵蓋它們。未新增最佳配裝推薦。

整合者接手後依序完成 005 → 008 → 009 受影響回歸，再統一更新 STATUS／ROADMAP；如需將選項規則寫入產品決策，再由整合者更新 PROJECT。本次未修改這些全域文件。
