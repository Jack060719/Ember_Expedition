# TASK-002 角色素材

2026-09-21：內建 ImageGen 以既有 `public/assets/hero.png` 作風格參考，分別生成逐風斥候與苔紋守衛。原始輸出保存在各角色的 `raw.png`；實際原圖為 1254×1254 RGBA，提示要求的尺寸為 1024×1024。原圖已帶透明背景，處理流程保留 alpha；未以程式繪製或以換色代替新角色。

執行時僅使用 `public/assets/characters/scout.png` 和 `warden.png`；本目錄原圖、提示、分幀及 QC 不發布。守燈旅人沿用 `public/assets/hero.png`。

契約：512×512 RGBA、4×4 格、每格 128×128；下／左／右／上，每方向四幀，8 FPS。素材對齊點 `(64,116)`，場景沿用整格顯示 67×67、origin `(0.5,0.82)` 與原碰撞規則；兩種原點不能直接互換。Texture 為 `character-ID`；animation 為 `character-ID-walk-0` 至 `-3`。

使用 generate2dsprite 技能的 `scripts/generate2dsprite.py process` 處理：

```text
--input assets-source/characters/ID/raw.png --target player --mode player_sheet
--output-dir assets-source/characters/ID --cell-size 128 --fit-scale 0.8
--align feet --scale-strategy preserve --component-mode largest --strict-qc
--max-body-scale-cv 0.08 --max-anchor-y-std 0.05 --duration 125
--prompt-file assets-source/characters/ID/prompt-used.txt
```

`pipeline-meta.json` 保存逐幀處理與 QC 結果。兩角色均為 16 個有效幀、零空幀／碰邊／paste clamping；body-scale CV 分別約 0.0148、0.0138，anchor-Y std 約 0.0224、0.0282。已視覺檢查透明圖集、角色輪廓、四方向順序及 67px 顯示尺寸，對照圖位於忽略的 `artifacts/characters/asset-scale-review.png`；場景中的動畫與碰撞仍須角色整合檢查。

可從工作樹執行 `python scripts/check-character-assets.py`（需要 Pillow），驗證執行時圖集、透明背景、尺寸、角色比例、分幀、方向條、GIF 可解碼與處理紀錄。測試不需要伺服器。
