# 第 4 批量測：第 16～20 章

來源：artifacts/mainline/batch-16-20.json；程式來源與驅動器 SHA-256 隨報告保存。新章 240 趟，165 通關、75 失敗。另四趟高營地早期重玩 4/4 通關。

每章兩趟 × staff/focus／halo/froststorm／hammer/meteor／blade/wildfire × 普通／困難 × 0／1／3 寵；種子 8、書庫 3。杖為守燈人，其餘為守衛。從第一房選實際提供的升級卡，不移植首領入口；每房 finishRoom、序列化及 validateSave。寵物遭遇設 none 以固定隊伍，馴服另外測試。策略名是選牌目標，成型與失敗逐列保留。自動策略不代表真人勝率。

| 章 | 工坊／燈塔 | 普通 | 困難 | 零寵普通 | 一寵／三寵兩難度 | 普通首通收益 | 普通重玩收益 | 下級工坊／重玩趟數 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 16 | 45 | 17/24 | 16/24 | 2/8 | 15/16；16/16 | 14029～14152 | 5053～5176 | 6650／2～2 |
| 17 | 46 | 20/24 | 20/24 | 4/8 | 16/16；16/16 | 15285～15406 | 5493～5614 | 6800／2～2 |
| 18 | 48 | 18/24 | 14/24 | 4/8 | 10/16；16/16 | 16539～16660 | 5931～6052 | 7100／2～2 |
| 19 | 49 | 19/24 | 10/24 | 4/8 | 9/16；16/16 | 17796～17914 | 6372～6490 | 7250／2～2 |
| 20 | 50 | 17/24 | 14/24 | 1/8 | 14/16；16/16 | 19048～19168 | 6808～6928 | 7400／2～2 |

普通零寵逐趟：死亡列只計至死亡，第一趟末房為守衛，不是章末首領。完整 0／1／3 寵輸出、首領承傷與擊殺秒數、各次選牌見 JSON。

| 章／趟 | 構築 | 結果 | 完成房 | 戰鬥秒數 | 承傷 | 首領秒數 | 進化房 | 目標成型 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 16／1 | staff/focus | 失敗 | 2 | 185 | 731 | — | 未進化 | 是 |
| 16／1 | halo/froststorm | 失敗 | 4 | 271 | 894 | — | 4 | 否 |
| 16／1 | hammer/meteor | 失敗 | 1 | 126 | 656 | — | 未進化 | 否 |
| 16／1 | blade/wildfire | 通關 | 7 | 511 | 483 | — | 7 | 是 |
| 16／2 | staff/focus | 失敗 | 2 | 185 | 731 | — | 未進化 | 是 |
| 16／2 | halo/froststorm | 失敗 | 4 | 271 | 894 | — | 4 | 否 |
| 16／2 | hammer/meteor | 失敗 | 1 | 126 | 656 | — | 未進化 | 否 |
| 16／2 | blade/wildfire | 通關 | 7 | 479 | 640 | 64.03 | 未進化 | 否 |
| 17／1 | staff/focus | 失敗 | 0 | 45 | 604 | — | 未進化 | 是 |
| 17／1 | halo/froststorm | 通關 | 7 | 506 | 470 | — | 4 | 否 |
| 17／1 | hammer/meteor | 失敗 | 2 | 162 | 756 | — | 未進化 | 否 |
| 17／1 | blade/wildfire | 通關 | 7 | 492 | 231 | — | 7 | 是 |
| 17／2 | staff/focus | 失敗 | 0 | 45 | 604 | — | 未進化 | 是 |
| 17／2 | halo/froststorm | 通關 | 7 | 493 | 450 | 78.9 | 4 | 否 |
| 17／2 | hammer/meteor | 失敗 | 2 | 162 | 756 | — | 未進化 | 否 |
| 17／2 | blade/wildfire | 通關 | 7 | 482 | 199 | 76.83 | 7 | 否 |
| 18／1 | staff/focus | 失敗 | 0 | 56 | 614 | — | 未進化 | 是 |
| 18／1 | halo/froststorm | 通關 | 7 | 517 | 1162 | — | 4 | 否 |
| 18／1 | hammer/meteor | 失敗 | 0 | 59 | 608 | — | 未進化 | 否 |
| 18／1 | blade/wildfire | 通關 | 7 | 504 | 254 | — | 7 | 是 |
| 18／2 | staff/focus | 失敗 | 0 | 56 | 614 | — | 未進化 | 是 |
| 18／2 | halo/froststorm | 通關 | 7 | 496 | 470 | 75 | 4 | 否 |
| 18／2 | hammer/meteor | 失敗 | 0 | 59 | 608 | — | 未進化 | 否 |
| 18／2 | blade/wildfire | 通關 | 7 | 497 | 381 | 84.3 | 7 | 否 |
| 19／1 | staff/focus | 失敗 | 0 | 44 | 624 | — | 未進化 | 是 |
| 19／1 | halo/froststorm | 通關 | 7 | 533 | 842 | — | 4 | 否 |
| 19／1 | hammer/meteor | 失敗 | 2 | 157 | 782 | — | 未進化 | 否 |
| 19／1 | blade/wildfire | 通關 | 7 | 508 | 471 | — | 7 | 是 |
| 19／2 | staff/focus | 失敗 | 0 | 44 | 624 | — | 未進化 | 是 |
| 19／2 | halo/froststorm | 通關 | 7 | 540 | 992 | 100.13 | 4 | 否 |
| 19／2 | hammer/meteor | 失敗 | 2 | 157 | 782 | — | 未進化 | 否 |
| 19／2 | blade/wildfire | 通關 | 7 | 509 | 779 | 86.97 | 7 | 否 |
| 20／1 | staff/focus | 失敗 | 0 | 38 | 628 | — | 未進化 | 是 |
| 20／1 | halo/froststorm | 失敗 | 2 | 184 | 816 | — | 未進化 | 否 |
| 20／1 | hammer/meteor | 失敗 | 1 | 97 | 690 | — | 未進化 | 否 |
| 20／1 | blade/wildfire | 通關 | 7 | 519 | 1298 | — | 7 | 是 |
| 20／2 | staff/focus | 失敗 | 0 | 38 | 628 | — | 未進化 | 是 |
| 20／2 | halo/froststorm | 失敗 | 2 | 184 | 816 | — | 未進化 | 否 |
| 20／2 | hammer/meteor | 失敗 | 1 | 97 | 690 | — | 未進化 | 否 |
| 20／2 | blade/wildfire | 失敗 | 6 | 472 | 1280 | — | 未進化 | 否 |

普通代表通關：每趟選兩種不同主武器，優先列零寵，其次一寵。承傷為七房累計；寵物首領傷害只計實際扣血，非面板理論值。

| 章／趟 | 構築 | 寵物 | 戰鬥秒數 | 承傷 | 首領秒數 | 寵物首領傷害 | 首通／重玩 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 16／1 | blade/wildfire | 無 | 511 | 483 | — | 0 | 14152／5176 |
| 16／1 | staff/focus | crimsonDragon | 494 | 146 | — | 0 | 14152／5176 |
| 16／2 | blade/wildfire | 無 | 479 | 640 | 64.03 | 0 | 14046／5070 |
| 16／2 | staff/focus | crimsonDragon | 437 | 97 | 35.47 | 3600 | 14034／5058 |
| 17／1 | halo/froststorm | 無 | 506 | 470 | — | 0 | 15406／5614 |
| 17／1 | blade/wildfire | 無 | 492 | 231 | — | 0 | 15406／5614 |
| 17／2 | halo/froststorm | 無 | 493 | 450 | 78.9 | 0 | 15306／5514 |
| 17／2 | blade/wildfire | 無 | 482 | 199 | 76.83 | 0 | 15305／5513 |
| 18／1 | halo/froststorm | 無 | 517 | 1162 | — | 0 | 16660／6052 |
| 18／1 | blade/wildfire | 無 | 504 | 254 | — | 0 | 16660／6052 |
| 18／2 | halo/froststorm | 無 | 496 | 470 | 75 | 0 | 16558／5950 |
| 18／2 | blade/wildfire | 無 | 497 | 381 | 84.3 | 0 | 16562／5954 |
| 19／1 | halo/froststorm | 無 | 533 | 842 | — | 0 | 17914／6490 |
| 19／1 | blade/wildfire | 無 | 508 | 471 | — | 0 | 17914／6490 |
| 19／2 | halo/froststorm | 無 | 540 | 992 | 100.13 | 0 | 17822／6398 |
| 19／2 | blade/wildfire | 無 | 509 | 779 | 86.97 | 0 | 17817／6393 |
| 20／1 | blade/wildfire | 無 | 519 | 1298 | — | 0 | 19168／6928 |
| 20／1 | staff/focus | dawnStarDragon | 492 | 0 | — | 0 | 19168／6928 |
| 20／2 | staff/focus | dawnStarDragon | 443 | 0 | 42.63 | 8420 | 19053／6813 |
| 20／2 | halo/froststorm | dawnStarDragon | 463 | 407 | 56.37 | 15580 | 19059／6819 |

失敗配置（含困難，未刪除）：

| 章／趟 | 構築 | 難度 | 寵物數 | 完成房 | 收益 |
| --- | --- | --- | --- | --- | --- |
| 16／1 | staff/focus | normal | 0 | 2 | 509 |
| 16／1 | staff/focus | hard | 0 | 0 | 4 |
| 16／1 | halo/froststorm | normal | 0 | 4 | 1089 |
| 16／1 | halo/froststorm | hard | 0 | 2 | 506 |
| 16／1 | hammer/meteor | normal | 0 | 1 | 248 |
| 16／1 | hammer/meteor | hard | 0 | 0 | 7 |
| 16／1 | blade/wildfire | hard | 0 | 4 | 1113 |
| 16／2 | staff/focus | normal | 0 | 2 | 509 |
| 16／2 | staff/focus | hard | 0 | 0 | 4 |
| 16／2 | halo/froststorm | normal | 0 | 4 | 1089 |
| 16／2 | halo/froststorm | hard | 0 | 2 | 506 |
| 16／2 | hammer/meteor | normal | 0 | 1 | 248 |
| 16／2 | hammer/meteor | normal | 1 | 6 | 1794 |
| 16／2 | hammer/meteor | hard | 0 | 0 | 7 |
| 16／2 | blade/wildfire | hard | 0 | 4 | 1113 |
| 17／1 | staff/focus | normal | 0 | 0 | 5 |
| 17／1 | staff/focus | hard | 0 | 0 | 3 |
| 17／1 | hammer/meteor | normal | 0 | 2 | 548 |
| 17／1 | hammer/meteor | hard | 0 | 1 | 269 |
| 17／2 | staff/focus | normal | 0 | 0 | 5 |
| 17／2 | staff/focus | hard | 0 | 0 | 3 |
| 17／2 | hammer/meteor | normal | 0 | 2 | 548 |
| 17／2 | hammer/meteor | hard | 0 | 1 | 269 |
| 18／1 | staff/focus | normal | 0 | 0 | 6 |
| 18／1 | staff/focus | hard | 0 | 0 | 3 |
| 18／1 | staff/focus | hard | 1 | 2 | 600 |
| 18／1 | halo/froststorm | hard | 0 | 1 | 291 |
| 18／1 | hammer/meteor | normal | 0 | 0 | 8 |
| 18／1 | hammer/meteor | normal | 1 | 5 | 1688 |
| 18／1 | hammer/meteor | hard | 0 | 0 | 7 |
| 18／1 | hammer/meteor | hard | 1 | 3 | 938 |
| 18／2 | staff/focus | normal | 0 | 0 | 6 |
| 18／2 | staff/focus | hard | 0 | 0 | 3 |
| 18／2 | staff/focus | hard | 1 | 2 | 600 |
| 18／2 | halo/froststorm | hard | 0 | 1 | 291 |
| 18／2 | hammer/meteor | normal | 0 | 0 | 8 |
| 18／2 | hammer/meteor | normal | 1 | 5 | 1688 |
| 18／2 | hammer/meteor | hard | 0 | 0 | 7 |
| 18／2 | hammer/meteor | hard | 1 | 3 | 938 |
| 19／1 | staff/focus | normal | 0 | 0 | 4 |
| 19／1 | staff/focus | hard | 0 | 0 | 3 |
| 19／1 | staff/focus | hard | 1 | 0 | 7 |
| 19／1 | halo/froststorm | hard | 0 | 1 | 308 |
| 19／1 | halo/froststorm | hard | 1 | 6 | 2289 |
| 19／1 | hammer/meteor | normal | 0 | 2 | 633 |
| 19／1 | hammer/meteor | hard | 0 | 1 | 307 |
| 19／1 | hammer/meteor | hard | 1 | 2 | 649 |
| 19／1 | blade/wildfire | hard | 0 | 2 | 651 |
| 19／2 | staff/focus | normal | 0 | 0 | 4 |
| 19／2 | staff/focus | hard | 0 | 0 | 3 |
| 19／2 | staff/focus | hard | 1 | 0 | 7 |
| 19／2 | halo/froststorm | hard | 0 | 1 | 308 |
| 19／2 | halo/froststorm | hard | 1 | 6 | 2256 |
| 19／2 | hammer/meteor | normal | 0 | 2 | 633 |
| 19／2 | hammer/meteor | normal | 1 | 6 | 2243 |
| 19／2 | hammer/meteor | hard | 0 | 1 | 307 |
| 19／2 | hammer/meteor | hard | 1 | 2 | 649 |
| 19／2 | blade/wildfire | hard | 0 | 2 | 651 |
| 20／1 | staff/focus | normal | 0 | 0 | 4 |
| 20／1 | staff/focus | hard | 0 | 0 | 1 |
| 20／1 | halo/froststorm | normal | 0 | 2 | 684 |
| 20／1 | halo/froststorm | hard | 0 | 0 | 9 |
| 20／1 | hammer/meteor | normal | 0 | 1 | 327 |
| 20／1 | hammer/meteor | hard | 0 | 0 | 4 |
| 20／1 | hammer/meteor | hard | 1 | 6 | 2425 |
| 20／1 | blade/wildfire | hard | 0 | 0 | 8 |
| 20／2 | staff/focus | normal | 0 | 0 | 4 |
| 20／2 | staff/focus | hard | 0 | 0 | 1 |
| 20／2 | halo/froststorm | normal | 0 | 2 | 684 |
| 20／2 | halo/froststorm | hard | 0 | 0 | 9 |
| 20／2 | hammer/meteor | normal | 0 | 1 | 327 |
| 20／2 | hammer/meteor | hard | 0 | 0 | 4 |
| 20／2 | hammer/meteor | hard | 1 | 6 | 2416 |
| 20／2 | blade/wildfire | normal | 0 | 6 | 2394 |
| 20／2 | blade/wildfire | hard | 0 | 0 | 8 |

所有房間均完成或明確死亡，沒有 240 秒停滯；峰值不超過 160。本批未達每章兩種零寵構築通關；依Roadmap分列零寵結果，驗收確認每章兩趟至少兩種構築在最多一隻一般房可遇寵物下通關。實機 iPhone／Android 單指操作、長時間遊玩及三寵效能尚待硬體驗收。
