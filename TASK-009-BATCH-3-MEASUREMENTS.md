# 第 3 批量測：第 12～15 章

來源：artifacts/mainline/batch-12-15.json；程式來源與驅動器 SHA-256 隨報告保存。新章 192 趟，156 通關、36 失敗。另四趟高營地早期重玩 4/4 通關。

每章兩趟 × staff/focus／halo/froststorm／hammer/meteor／blade/wildfire × 普通／困難 × 0／1／3 寵；種子 8、書庫 3。杖為守燈人，其餘為守衛。從第一房選實際提供的升級卡，不移植首領入口；每房 finishRoom、序列化及 validateSave。寵物遭遇設 none 以固定隊伍，馴服另外測試。策略名是選牌目標，成型與失敗逐列保留。自動策略不代表真人勝率。

| 章 | 工坊／燈塔 | 普通 | 困難 | 零寵普通 | 一寵／三寵兩難度 | 普通首通收益 | 普通重玩收益 | 下級工坊／重玩趟數 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 12 | 30 | 22/24 | 20/24 | 6/8 | 16/16；16/16 | 9248～9370 | 3383～3505 | 4400／2～2 |
| 13 | 32 | 20/24 | 18/24 | 4/8 | 14/16；16/16 | 10433～10610 | 3803～3980 | 4700／2～2 |
| 14 | 34 | 20/24 | 20/24 | 4/8 | 16/16；16/16 | 11600～11722 | 4205～4327 | 5000／2～2 |
| 15 | 35 | 20/24 | 16/24 | 4/8 | 16/16；16/16 | 12777～12897 | 4617～4737 | 5150／2～2 |

普通零寵逐趟：死亡列只計至死亡，第一趟末房為守衛，不是章末首領。完整 0／1／3 寵輸出、首領承傷與擊殺秒數、各次選牌見 JSON。

| 章／趟 | 構築 | 結果 | 完成房 | 戰鬥秒數 | 承傷 | 首領秒數 | 進化房 | 目標成型 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 12／1 | staff/focus | 通關 | 7 | 520 | 508 | — | 5 | 是 |
| 12／1 | halo/froststorm | 通關 | 7 | 513 | 222 | — | 4 | 否 |
| 12／1 | hammer/meteor | 失敗 | 5 | 390 | 861 | — | 未進化 | 是 |
| 12／1 | blade/wildfire | 通關 | 7 | 499 | 197 | — | 7 | 是 |
| 12／2 | staff/focus | 通關 | 7 | 461 | 508 | 31.1 | 5 | 是 |
| 12／2 | halo/froststorm | 通關 | 7 | 496 | 125 | 77 | 4 | 否 |
| 12／2 | hammer/meteor | 失敗 | 5 | 390 | 861 | — | 未進化 | 是 |
| 12／2 | blade/wildfire | 通關 | 7 | 484 | 197 | 75.23 | 未進化 | 否 |
| 13／1 | staff/focus | 失敗 | 1 | 108 | 520 | — | 未進化 | 是 |
| 13／1 | halo/froststorm | 通關 | 7 | 512 | 406 | — | 4 | 否 |
| 13／1 | hammer/meteor | 失敗 | 2 | 186 | 593 | — | 未進化 | 是 |
| 13／1 | blade/wildfire | 通關 | 7 | 506 | 128 | — | 6 | 是 |
| 13／2 | staff/focus | 失敗 | 1 | 108 | 520 | — | 未進化 | 是 |
| 13／2 | halo/froststorm | 通關 | 7 | 482 | 335 | 60.63 | 4 | 否 |
| 13／2 | hammer/meteor | 失敗 | 2 | 186 | 593 | — | 未進化 | 是 |
| 13／2 | blade/wildfire | 通關 | 7 | 450 | 170 | 31.8 | 6 | 否 |
| 14／1 | staff/focus | 失敗 | 2 | 186 | 624 | — | 未進化 | 是 |
| 14／1 | halo/froststorm | 通關 | 7 | 504 | 258 | — | 4 | 否 |
| 14／1 | hammer/meteor | 失敗 | 2 | 183 | 620 | — | 未進化 | 是 |
| 14／1 | blade/wildfire | 通關 | 7 | 504 | 221 | — | 7 | 是 |
| 14／2 | staff/focus | 失敗 | 2 | 186 | 624 | — | 未進化 | 是 |
| 14／2 | halo/froststorm | 通關 | 7 | 477 | 258 | 63.13 | 4 | 否 |
| 14／2 | hammer/meteor | 失敗 | 2 | 183 | 620 | — | 未進化 | 是 |
| 14／2 | blade/wildfire | 通關 | 7 | 480 | 206 | 64.57 | 未進化 | 否 |
| 15／1 | staff/focus | 失敗 | 1 | 131 | 590 | — | 未進化 | 是 |
| 15／1 | halo/froststorm | 通關 | 7 | 506 | 482 | — | 4 | 否 |
| 15／1 | hammer/meteor | 失敗 | 2 | 172 | 634 | — | 未進化 | 否 |
| 15／1 | blade/wildfire | 通關 | 7 | 503 | 224 | — | 7 | 是 |
| 15／2 | staff/focus | 失敗 | 1 | 131 | 590 | — | 未進化 | 是 |
| 15／2 | halo/froststorm | 通關 | 7 | 502 | 224 | 86.17 | 4 | 否 |
| 15／2 | hammer/meteor | 失敗 | 2 | 172 | 634 | — | 未進化 | 否 |
| 15／2 | blade/wildfire | 通關 | 7 | 477 | 208 | 70.57 | 未進化 | 否 |

普通代表通關：每趟選兩種不同主武器，優先列零寵，其次一寵。承傷為七房累計；寵物首領傷害只計實際扣血，非面板理論值。

| 章／趟 | 構築 | 寵物 | 戰鬥秒數 | 承傷 | 首領秒數 | 寵物首領傷害 | 首通／重玩 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 12／1 | staff/focus | 無 | 520 | 508 | — | 0 | 9370／3505 |
| 12／1 | halo/froststorm | 無 | 513 | 222 | — | 0 | 9370／3505 |
| 12／2 | staff/focus | 無 | 461 | 508 | 31.1 | 0 | 9251／3386 |
| 12／2 | halo/froststorm | 無 | 496 | 125 | 77 | 0 | 9269／3404 |
| 13／1 | halo/froststorm | 無 | 512 | 406 | — | 0 | 10610／3980 |
| 13／1 | blade/wildfire | 無 | 506 | 128 | — | 0 | 10587／3957 |
| 13／2 | halo/froststorm | 無 | 482 | 335 | 60.63 | 0 | 10489／3859 |
| 13／2 | blade/wildfire | 無 | 450 | 170 | 31.8 | 0 | 10459／3829 |
| 14／1 | halo/froststorm | 無 | 504 | 258 | — | 0 | 11722／4327 |
| 14／1 | blade/wildfire | 無 | 504 | 221 | — | 0 | 11722／4327 |
| 14／2 | halo/froststorm | 無 | 477 | 258 | 63.13 | 0 | 11616／4221 |
| 14／2 | blade/wildfire | 無 | 480 | 206 | 64.57 | 0 | 11616／4221 |
| 15／1 | halo/froststorm | 無 | 506 | 482 | — | 0 | 12897／4737 |
| 15／1 | blade/wildfire | 無 | 503 | 224 | — | 0 | 12897／4737 |
| 15／2 | halo/froststorm | 無 | 502 | 224 | 86.17 | 0 | 12800／4640 |
| 15／2 | blade/wildfire | 無 | 477 | 208 | 70.57 | 0 | 12793／4633 |

失敗配置（含困難，未刪除）：

| 章／趟 | 構築 | 難度 | 寵物數 | 完成房 | 收益 |
| --- | --- | --- | --- | --- | --- |
| 12／1 | staff/focus | hard | 0 | 0 | 4 |
| 12／1 | hammer/meteor | normal | 0 | 5 | 968 |
| 12／1 | hammer/meteor | hard | 0 | 2 | 355 |
| 12／2 | staff/focus | hard | 0 | 0 | 4 |
| 12／2 | hammer/meteor | normal | 0 | 5 | 968 |
| 12／2 | hammer/meteor | hard | 0 | 2 | 355 |
| 13／1 | staff/focus | normal | 0 | 1 | 185 |
| 13／1 | staff/focus | hard | 0 | 0 | 3 |
| 13／1 | hammer/meteor | normal | 0 | 2 | 391 |
| 13／1 | hammer/meteor | hard | 0 | 0 | 9 |
| 13／1 | hammer/meteor | hard | 1 | 4 | 853 |
| 13／2 | staff/focus | normal | 0 | 1 | 185 |
| 13／2 | staff/focus | hard | 0 | 0 | 3 |
| 13／2 | hammer/meteor | normal | 0 | 2 | 391 |
| 13／2 | hammer/meteor | hard | 0 | 0 | 9 |
| 13／2 | hammer/meteor | hard | 1 | 4 | 853 |
| 14／1 | staff/focus | normal | 0 | 2 | 424 |
| 14／1 | staff/focus | hard | 0 | 0 | 4 |
| 14／1 | hammer/meteor | normal | 0 | 2 | 425 |
| 14／1 | hammer/meteor | hard | 0 | 1 | 209 |
| 14／2 | staff/focus | normal | 0 | 2 | 424 |
| 14／2 | staff/focus | hard | 0 | 0 | 4 |
| 14／2 | hammer/meteor | normal | 0 | 2 | 425 |
| 14／2 | hammer/meteor | hard | 0 | 1 | 209 |
| 15／1 | staff/focus | normal | 0 | 1 | 227 |
| 15／1 | staff/focus | hard | 0 | 0 | 3 |
| 15／1 | halo/froststorm | hard | 0 | 4 | 1027 |
| 15／1 | hammer/meteor | normal | 0 | 2 | 465 |
| 15／1 | hammer/meteor | hard | 0 | 1 | 226 |
| 15／1 | blade/wildfire | hard | 0 | 4 | 1022 |
| 15／2 | staff/focus | normal | 0 | 1 | 227 |
| 15／2 | staff/focus | hard | 0 | 0 | 3 |
| 15／2 | halo/froststorm | hard | 0 | 4 | 1027 |
| 15／2 | hammer/meteor | normal | 0 | 2 | 465 |
| 15／2 | hammer/meteor | hard | 0 | 1 | 226 |
| 15／2 | blade/wildfire | hard | 0 | 4 | 1022 |

所有房間均完成或明確死亡，沒有 240 秒停滯；峰值不超過 160。各章兩趟皆有至少兩種零寵普通構築通關。實機 iPhone／Android 單指操作、長時間遊玩及三寵效能尚待硬體驗收。
