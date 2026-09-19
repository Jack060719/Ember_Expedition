# Repository Guidelines

## 所有 Agent 的閱讀入口

開始工作前依序閱讀：

1. [PROJECT.md](PROJECT.md)：遊戲目的、已確認的設計決策與體驗目標。
2. [STATUS.md](STATUS.md)：目前實作、驗證結果、未提交工作與搬移注意事項。
3. [ROADMAP.md](ROADMAP.md)：下一版已確認的方向與仍待設計的內容。
4. [README.md](README.md)：執行指令、現行數值、安裝與素材說明。

文件隨專案搬移，不要求讀取原先的聊天紀錄、個人技能目錄或 `artifacts/`。`artifacts/` 裡的舊討論、報告與備份只作補充，不能用其中的過期提案推翻目前決策。使用者最新指示優先；若文件與程式不一致，先核對並指出差異，勿默默改變產品方向。

## 工作原則

- 先探索再修改：說明重要假設與取捨；無法從專案確認、且會改變需求的疑問要先釐清。
- 簡單優先：只做當次要求，不加入推測功能、一次性抽象或未要求的可設定性。
- 精準修改：遵循現有風格，保留既有工作，不順手重構或清理無關程式。
- 定義可驗證的完成條件；機制修正要有對應回歸檢查，文件修改則檢查連結、事實與一致性。

## 多 Agent 協作與交接

- 開工先檢查 `git status --short`、目前分支及基準提交；[STATUS.md](STATUS.md) 是有日期的快照，不能取代即時檢查。
- 分工時交代目標、驗收方式、負責檔案及共用介面。獨立任務可用各自的分支／工作樹；共用目錄時，同一檔案由一位負責者修改，其他 agent 先做閱讀、建議或檢查。
- `src/core.ts`、`src/arena.ts`、`src/main.ts` 是常見交集。跨任務的型別、升級 ID、存檔欄位及場景 hooks 先協調，再由指定負責者整合；不要同時覆寫同一段程式。
- 保留使用者及其他 agent 的未提交修改，不以 reset、clean、checkout 覆蓋不屬於自己的工作。不要把工作樹外的改動或未整合分支宣稱為已完成。
- 測試目前固定使用 5173、4173、4180 埠。同機多工作樹要協調、依序使用，確認伺服器來自待測工作樹；不要誤測另一分支或任意終止他人的伺服器。
- 各 agent 回報實際修改、測試結果、存檔影響與剩餘事項；整合負責者在整合後執行受影響檢查，並統一更新 `STATUS.md`，避免多人爭改狀態。產品決策更新 `PROJECT.md`，待辦狀態更新 `ROADMAP.md`。
- 搬到 Orca 或其他協作環境時沿用以上文件；由該環境管理工作樹與訊息，不假設舊終端、伺服器、聊天上下文或暫存檔仍存在。

交接至少包含以下資訊，可填入 `STATUS.md` 的進行中任務與最近交接區，或提供給整合負責者：

```text
任務／負責者／分支或工作樹／基準提交：
狀態（進行中、待整合、待驗證、完成）：
修改檔案與結果：
驗證指令、結果與未驗證範圍：
存檔／離線／部署影響：
未決事項與下一步：
```

## Project Structure & Module Organization

- `src/core.ts`: game rules, upgrades, progression, and save validation/migration.
- `src/arena.ts`: Phaser combat, animations, collisions, and touch controls.
- `src/main.ts` and `src/style.css`: screens, menus, and presentation.
- `src/storage.ts` and `src/offline.ts`: IndexedDB persistence and offline updates.
- `tests/`: rule and offline unit tests. `scripts/`: browser checks and cache generation.
- `public/assets/`: runtime artwork; `assets-source/`: originals, prompts, and quality records.
- `dist/` contains generated builds; `artifacts/` contains ignored reports, screenshots, and backups.

## Build, Test, and Development Commands

Use Node.js 22.18 or newer.

- `npm ci`: install locked dependencies.
- `npm run dev -- --port 5173 --strictPort`: start development.
- `npm test`: run Node's test runner against `tests/*.test.ts`.
- `npm run build`: type-check, build with Vite, and generate the versioned offline cache.
- `npm run preview -- --port 4173 --strictPort`: serve the production build.
- `npx playwright install chromium`: install the browser used by integration checks.
- `npm run test:arena`: verify combat, touch mechanics, and 24 full seven-room balance runs; requires development on port 5173.
- `npm run test:browser`: verify screens, saves, and offline play; requires preview on port 4173.
- `npm run test:offline`: verify cache recovery and updates; serves `dist/` on port 4180.

In Windows PowerShell, use `npm.cmd` and `npx.cmd` if execution policy blocks their scripts.

## Coding Style & Naming Conventions

Use strict TypeScript and ES modules with explicit `.ts` imports. Match nearby two-space indentation, single-quoted strings, semicolons, and compact formatting. Use camelCase for functions/variables, PascalCase for types/classes, and uppercase names for exported data tables. Keep player-facing text in Traditional Chinese. No formatter or lint command is configured; avoid unrelated reformatting.

## Testing Guidelines

Unit tests use `node:test` and `node:assert/strict`; browser checks use Playwright. Name unit files `*.test.ts` and describe observable behavior in test titles. Add focused regression coverage for changed mechanics, save migrations, and reward ordering. Run `npm test`, the build, and affected integration checks. No numerical coverage threshold is configured. Chromium emulation does not establish iPhone hardware compatibility.

## Commit & Pull Request Guidelines

History uses short imperative subjects, such as “Fix offline recovery and responsive touch movement.” Keep commits focused. PRs should explain the problem, resulting behavior, validation commands/results, and save compatibility implications. Link relevant issues and include screenshots for visible changes.

## Offline & Change Safety

Keep gameplay assets local; preserve offline operation and existing saves. Never publish `assets-source/`, test saves, or credentials. Keep changes narrowly scoped, state material assumptions, and preserve `.openai/hosting.json` project identity.
