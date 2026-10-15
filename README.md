# Mallow: Ashen Vow 粉誓

試玩：[https://mallow-ashen-vow.grok.me/](https://mallow-ashen-vow.grok.me/)

![粉誓封面](public/og.jpg)

橫幅圖是 `public/x-banner.jpg`。概念圖：

| 灰殼 | 煤灰公爵 | 紅契 |
| --- | --- | --- |
| ![灰殼](public/concepts/hollow-ash-shell.jpg) | ![煤灰公爵](public/concepts/coal-ash-duke.jpg) | ![紅契](public/concepts/red-contract-demon.jpg) |

## 現在給同事（2026-10-15）

目前進度在 `main`。版本 **0.8.7**，標題畫面也會顯示。公開試玩網址是 [mallow-ashen-vow.grok.me](https://mallow-ashen-vow.grok.me/)。

**重要**：任何合併到 `main` 的 PR 都必須先更新 `src/game/version.ts` 的版本號（見下方「版本規則」）。新功能仍建議開分支再開 PR。

- 戰鬥數字：`src/game/moves.ts`
- 鏡頭：`src/game/camera.ts`
- 敵人 AI 決策（灰殼／公爵／紅契）：`src/game/ai.ts`（`foes.ts` 僅 re-export）
- 玩家動作、無敵、收刀：`src/game/player.ts`
- 敵人外形：`src/game/enemyMesh.ts`
- 模擬：`src/game/createGame.ts`
- CombatFeel／harness／learner：`combatFeel.ts`、`autoHarness.ts`、`playerLearner.ts`
- 畫面：`src/routes/index.tsx`

電腦按 E 食水回血，R 已取消。出刀前搖有橘色環，重擊環較大。翻滾無敵有淡白環，收刀期間有粉紅環。普通玩家介面不顯示血量數字、撿灰 +數字、倒下次數和本局時間。撿灰有餘燼、擴環和短音。看不懂公爵哪招，只改 `MOVE.duke`。

瀏覽器類魂垂直切片。玩家是 Sir Mallow，一隻戴粉紅蝴蝶結、穿銀甲、劍有點太大的騎士貓。

這是 **Three.js** 網頁遊戲，不是 Unity 專案。值得測的是戰鬥：鎖定、翻滾無敵、體力、格擋、架勢、暖瓶、火芯。

## 現在進度（2026-10-10，下午）

可玩的一場庭院已經在 `main`。

- 路中灰殼瘦、劍短、有兜帽，沒有盾。側翼灰殼寬、有盾。公爵更高，有角和面罩。紅契有角和翅。外形在 `src/game/enemyMesh.ts`。敵人不再用騎士貓的耳、鼻和尾巴，底模改在 `src/game/knightMesh.ts`。
- 三隻灰殼倒下後拱門打開，煤灰公爵醒來。
- 公爵四招：橫斬、舉劍重擊、震地、低頭衝鋒。半血進入第二階段。衝鋒收招在二階段較長，留給懲罰。
- 重擊和成功格擋會累敵人架勢。架勢崩了會硬直約 1 秒，並多吃一段傷害。
- 翻滾跟輸入方向；沒有輸入才朝角色背後滾。
- 架勢條、收招「可打」和骨白圈、格擋白弧、鏡頭拆到 `camera.ts` 已在 `main`。公爵衝鋒和橫斬前搖已再拉長。
- 被打時鏡頭會被撞開、視野一瞬變寬，並往攻擊來的方向傾。格擋成功只會輕撞一下。
- 鏡頭跟手有一點延遲。揮刀會推近，打中會再縮一下視野並輕微晃動，鎖定時人和目標會同時留在畫面裡。
- 鎖定目標頭上有粉紅菱形，切換時會滑過去。收招或硬直時鎖定名會顯示「可打」，地面圈會隨收招縮小。
- 路中灰殼倒下、且離開火芯一段距離之後，線上惡魔紅契才可能侵入。公爵已醒來時不侵入。
- 第一下打中會打開刀聲。
- 角色和場景仍是程序化建模。騎士貓有腿甲、臂甲、護手和拇指、兩片斗篷、較長的劍。敵人現在有專屬程序化模型（`src/game/enemyMesh.ts`）：灰殼有裂痕甲和短劍、公爵有角盔與發光裂縫、紅契有小翼與紅刃。概念圖放在 `public/concepts/`。火芯是石圈、炭和火簇。拱門有裂縫，打開時布會落下。地面有從火芯到拱門的踏痕。沒有用 Hero Forge 或其他人的模型檔。
- 場景氛圍參考雲海和光塵：庭院有暖霧、緩慢漂浮的光點，以及兩道很淡的光柱。不是複製別人的 shader。
- 粒子用 `THREE.Points`：鋼色是打中，粉色是重擊和架勢崩壞，灰塵是翻滾和震地，灰焰是死亡與撿灰，紅焰是紅契侵入。震地另有一圈向外擴的塵環。
PayMe 贊助文案在標題、Esc 選單和通關畫面。
- 打中有刀光、火花、短暫停頓和金屬加噪聲。格擋和架勢崩解也有獨立音效。
- 死亡掉灰，走回去撿。火芯回血、回瓶。200 灰可鍛誓 +12 生命，上限 180。

## 操作

- **WASD** 相機相對移動。右鍵拖曳轉鏡頭。
- **Shift** 跑步，吃體力。
- **左鍵** 或 **J**：輕擊。**右鍵** 或 **K**：重擊。前搖有橘色環，收刀有粉紅環。這一刀要完全結束，才能再出下一刀。中鍵或觸控拖曳轉鏡頭。
- **按住 C** 格擋。腳下會出現朝前的白弧，體力低時弧會變淡。體力空了會破防。敵擊命中前 **0.2s 內舉起** 可 **招架／Deflect**（抵銷傷害、彈開敵人）。
- **Space** 翻滾。有方向就朝方向滾，約 0.04–0.34 秒無敵，腳下會有一圈淡白環。出刀後的收刀期間有粉紅環，這時不能再出下一刀。
- **Q** 鎖定，再按切下一個近處目標。
- **E** 靠近世界道具時拾取；否則食水回血。**G** 在火芯歇息。**F** 在火芯花 200 灰鍛誓。
- **Esc** 選單。手機用左搖桿和右側按鈕。

## 版本規則（必須遵守）

任何 PR 或直接合併到 `main` 時，**必須更新版本號**。

版本規則參考 [Software versioning](https://en.wikipedia.org/wiki/Software_versioning)（Semantic Versioning 精神）：

- 版本定義在 `src/game/version.ts`：
  ```ts
  export const GAME_VERSION = "0.8.7";
  ```
- 標題畫面會顯示這個版本。
- 規則（MAJOR.MINOR.PATCH）：
  - **PATCH**（`x.y.Z`）：向後相容的修正、小調整、文件／模型替換等
  - **MINOR**（`x.Y.0`）：向後相容的新功能、明顯外觀或戰鬥改動
  - **MAJOR**（`X.0.0`）：不相容的大改動
- PR 描述或 commit message 請註明版本變更。
- CI 會檢查版本檔案存在，但不會自動遞增——請手動更新。

## 分支

不要直接推 `main`。新功能開分支，開 PR，確認後再合併。合併前必須更新 `src/game/version.ts`。

## 同事接手

戰鬥模擬還在 `src/game/createGame.ts`。招式數字在 `src/game/moves.ts`。鏡頭在 `src/game/camera.ts`。公爵選招和收招長度在 `src/game/foes.ts`。玩家動作結束和翻滾無敵在 `src/game/player.ts`。HUD 型別在 `src/game/hud.ts`。畫面和 PayMe 在 `src/routes/index.tsx`。角色網格在 `src/game/knightMesh.ts`、`src/game/mallowRig.ts` 和敵人專屬 `src/game/enemyMesh.ts`。

先不要加地圖或第二個主角。粉紅蝴蝶結和太大的劍就是識別。

下一刀照下面的 **Planning** 做。先做介面手感，再雕模型和場景。不要加地圖或第二主角。

1. 自己連續打公爵五次。若有一次不知道死在哪招，就把那招的前搖再拉長，不要加新敵人。
2. 招式數字已抽到 `src/game/moves.ts`。模擬仍在 `createGame.ts`。再拆時才分玩家、敵人、鏡頭。
3. 音效在 `src/game/audio.ts`（WebAudio 合成）。第一刀會自動開聲，標題的靜音按鈕仍可用。環境風／火床＋腳步已接（無 BGM）。


## 隱藏測試通道

平常玩家看不到。電腦在遊戲頁面鍵盤輸入 `vowdebug`（不用按 Enter），再打一次就關閉。手機在戰鬥中按鎖定 6 下、翻滾 1 下、再按鎖定 3 下，會開關自動測試。左下角會出現「QA · 騎士貓自動」。

- **自動**：騎士貓自己鎖定、走近、前搖翻滾、收招出刀、血少喝瓶。死了會從火芯再起，通關會再走一次。
- **循環**：開 AI 對 AI harness，並用**學習玩家政策**（tabular ε-greedy）代替靜態 autoThink。每場勝／敗會記下來，用 CombatFeel（hit／heavy／stance-break／stamina／hurt／block）同終局結果更新 Q 表。狀態寫在 `sessionStorage` 的 `mallow-qa-harness`；政策寫在 `mallow-qa-learner`。
- **再起**：手動從火芯或標題開始。
- **關**：關掉面板。同一分頁重新整理還在，按關才清掉。

瀏覽器 console 也可控：

```js
window.__controlsTest.setAuto(true)
window.__controlsTest.setHarness(true)
window.__controlsTest.harness()      // { wins, losses, winRate, recentWinRate (24), avgMs, feelTotals, recentRuns, ... }
window.__controlsTest.learner()      // { wins, losses, epsilon, qStates, topPrefs, ... }
window.__controlsTest.resetLearner() // 清 Q 表／勝敗（會重新種 dodge／punish prior）
window.__controlsTest.feelCounts()   // 本局 feel 計數
window.__controlsTest.feelRecent()   // 最近 feel 事件
```

CombatFeel 只係適配層：喺現有 FX 呼叫旁 emit，**唔改** `moves.ts`／Graphics 手感數值。模組喺 `src/game/combatFeel.ts`，自動決策喺 `src/game/autoHarness.ts`，學習政策喺 `src/game/playerLearner.ts`。`stance-break.amount` = 觸發崩架嘅 poise 傷害（統一語意）。

這只用於除錯，不要放到標題畫面。

## 本地跑

```bash
npm install
npm run dev
```

打開終端印出的本地位址。需要 WebGL。

## Planning

更新日期：2026-10-15。同事照這個順序做。先不要加新地圖、新主角、武器樹。

### 當前版本

- **版本**：0.8.7（Fullstack：Harness polish — 固定種子回歸＋公爵／紅契細 bucket＋近 24 場 winRate）
- **主分支**：`main`
- **Demo**：https://mallow-ashen-vow.grok.me/

### 已完成 (0.5.x - 0.8.7)

#### 0.5.x - 基礎建設
- [x] 傷害數字（已對普通玩家隱藏）
- [x] 氣力條（閃爍 + 低體力變灰）
- [x] 前搖提示（頭上顏色條 + 地面圈）
- [x] 受擊介面（紅邊/白邊）
- [x] 鎖定系統（粉紅菱形 + 平滑切換）
- [x] 暖瓶系統（空了變暗）
- [x] 撿灰效果（餘燼 + 擴環 + 短音）
- [x] 公爵第二階段血條（變紅 + 橫幅）
- [x] 手機操作優化（斬/重分開、滾/鎖加大）
- [x] 倒下黑屏 + 通關結算延遲

#### 0.5.x Fullstack — CombatFeel + AI harness（已合 main）
- [x] CombatFeel 適配層（`combatFeel.ts`；唔改 `moves.ts`／Graphics 手感數）
- [x] AI-vs-AI harness（`autoHarness.ts`；vowdebug「循環」；勝／敗／feel 記錄）
- [x] Tabular ε-greedy 玩家學習政策（`playerLearner.ts`；toy 測試可測進步）
- [x] Harness 觀測：`winRate`／`recentWinRate`（近 **24** 場，0.8.7；原 8 場自 0.7.3）／`avgMs`

#### 0.7.3 - 敵人 AI 抽出
- [x] 敵人決策純函式 → `src/game/ai.ts`（hollow／duke／demon；createGame 薄接線）
- [x] `foes.ts` 改為 re-export（相容舊 import）
- [x] 單元測試：`ai.test.ts`、`autoHarness.test.ts`

#### 0.6.0 - 模型優化
- [x] 騎士貓頭身比例（1.08,0.92,0.84 → 1.15,0.88,0.82）
- [x] 劍長度（blade 1.48→1.58, fuller 1.12→1.22, tip 0.2→0.22）
- [x] 手部 redesign（簡單護手 + 拇指）
- [x] 公爵模型（加高 + 肩甲加大 20%）
- [x] 灰殼區分（路中瘦/側翼寬 + 盾）
- [x] 紅契模型（瘦紅配色 + 尖角披風）

#### 0.7.0 - 動畫與場景優化
- [x] 火焰動畫（粒子+55%/+33%, DoubleSide, AdditiveBlending）
- [x] 拱門動畫（物理模擬, 裂縫擴散, Smoothstep）
- [x] 公爵發光（眼睛強度 1.2, 胸口指示器, 脈動效果）
- [x] 灰殼盾牌（更大尺寸, 損壞劃痕, 金屬材質）
- [x] 紅契披風（翼膜細節, 骨骼結構, 高 emissive）
- [x] 燈光效果（環境光, 動態色溫, 強脈動）

#### 0.7.1 - UI／VFX polish
- [x] 標題粉結錨點（雙線底＋蝴蝶結 silhouette、Start hover 粉邊、og 暗角 ≤0.25）
- [x] `hud-plate` 統一血／體／瓶／公爵／惡魔／鎖定浮卡邊框
- [x] 擊中 VFX 層級：輕 1×／重 1.6×／崩架 2.2×（count／size／life；AdditiveBlending）
- [x] 色板補 `--color-bow`／`--bow-pink`（`#e8a0b8`）

#### 0.7.2 - SaveManager
- [x] 持久化抽成 `src/game/saveManager.ts`（deaths／hpMax／bestMs／clears）
- [x] 相容舊 `mallow-ashen-vow-v1` 無 `v` 存檔
- [x] 單元測試 `saveManager.test.ts`
- [x] `createGame.ts` 改走 SaveManager；唔改 moves／音效／Graphics

#### 0.7.4 - 死亡／通關卡片電影感（Research P1-E）
- [x] 黑屏後 end-card：上緣 ember 細線 sweep（0.4s）
- [x] 死亡深灰字調；通關 `--sta` 微金
- [x] 通關卡顯示 clears／best；普通標題／開場不露 QA 數字
- [x] 唔動 moves／Save／音效／AI

#### 0.7.5 - Audio extract
- [x] 戰鬥 WebAudio 合成音抽成 `src/game/audio.ts`（tone／noise／clang／mute unlock）
- [x] 環境音／腳步 stub／TODO（未實作 beds）
- [x] 單元測試 `audio.test.ts`
- [x] `createGame.ts` 薄接線；唔改 moves feel／Graphics／SaveManager／AI

#### 0.7.6 - Boss 橫幅／二階段 pulldown（Research P1-F）
- [x] Boss banner：字距＋opacity 0→1（200ms CSS）
- [x] 二階段血條底極淡紅脈動（CSS）；**唔**加全屏閃白
- [x] 唔動 moves feel／SaveManager／audio API／AI／particles spark 倍數

#### 0.7.7 - 輕擊連擊（P0）
- [x] 輕擊 3 段傷害 20 → 25 → 35（`moves.ts` 純函式＋createGame 薄接線）
- [x] 連擊窗口 0.8s；超時或打完第 3 段 → short recovery（0.22s）
- [x] 單元測試 `moves.combo.test.ts`（chain／window／damage／recover）
- [x] 唔改 Graphics／audio API／SaveManager／AI／粒子

#### 0.7.8 - Particles extract
- [x] 戰鬥 spark Points 池抽成 `src/game/particles.ts`（burst／ringDust／update）
- [x] `HIT_SPARK_MUL`／base size／count 原數鎖定（唔改 spark 倍數／moves feel）
- [x] 單元測試 `particles.test.ts`
- [x] `createGame.ts` 薄接線；環境 ember／mote 仍在 createGame；唔動 Graphics／Save／audio／AI

#### 0.7.9 - 鎖定菱形＋「可打」優雅化（Research P1-G）
- [x] 鎖定菱形：細線邊＋中心粉點（唔擋判定；raycast 關閉）
- [x] punish／收招窗：外圈 1.0→1.08 ping-pong；平時外圈隱藏
- [x] HUD「可打」粉結色＋輕脈動（CSS）；唔動 moves／Save／audio／AI／particles
- [x] 建基於 main 0.7.8（連擊＋particles 已合入）

#### 0.8.0 - 招架／Deflect（P0）
- [x] 精準格擋窗：舉起格擋後 **0.2s** 內敵擊命中 → Deflect（`DEFLECT.window`）
- [x] 成功：抵銷本次傷害、彈開敵人、短暫硬直、`combatFeel` `deflect`＋clang
- [x] 失敗（逾窗仍格擋）：沿用普通格擋（18% chip＋架勢）
- [x] 純函式：`player.ts`（`resolveGuardHit`）／`foes.ts`（`applyDeflectBounce`／`timeUntilFoeHit`）；`createGame` 只接線
- [x] 單元測試：`player.deflect.test.ts`

#### 0.8.1 - Ambient particles extract
- [x] 環境 ember／mote Points 抽入 `src/game/particles.ts`（`embers`／`motes`／`updateAmbient`）
- [x] 視覺常數鎖定：EMBER 28／update 18、MOTES 96、色／size／opacity 原數
- [x] 戰鬥 spark `HIT_SPARK_MUL` 不變；`createGame` 薄接線
- [x] 單元測試擴充 ambient lock；唔動 moves／Graphics／Save／audio／AI／deflect

#### 0.8.2 - `--color-bow` 統一＋title／ember「呼吸」（Research P1-H）
- [x] CSS `--color-bow`（`#e8a0b8`）統一 title 粉結＋HUD 鎖定名／「可打」；唔取代 ember 主色
- [x] 世界鎖定菱形／收招粉環改走 `COLOR_BOW`（同 token）
- [x] title／選單開時 ember「呼吸」經 `updateAmbient(time, breathAmp)`（約 +12% size）；庭院繼續動；唔閃
- [x] 唔動 moves／Deflect／Save／audio／AI／spark API／HIT_SPARK_MUL

#### 0.8.3 - 道具 stub（P1）
- [x] `src/game/items.ts`：`ash-token`／`flask-shard` 世界標記＋interact range＋in-memory inventory flags
- [x] `createGame`：庭院兩顆 stub mesh；**E** 靠近優先拾取（否則仍食水）；`GameApi.interact`
- [x] HUD：徽／片 flag＋靠近提示；**暫無 shop UI**；唔擴 SaveManager schema
- [x] 單元測試 `items.test.ts`（collect／flag／range／reset）

#### 0.8.4 - Ambient／footstep beds（P3）
- [x] `audio.ts`：wind＋fire **loop stubs**（`startAmbient`／`stopAmbient`；mute 會 duck）
- [x] 移動腳步（material-agnostic cadence；`footstep(moving01, dt)`）
- [x] `createGame` 薄接線：進 play 開 ambient；draw 打 footstep
- [x] 單元測試擴充；**無 BGM**；唔動 moves／deflect／particles／Save／Graphics／items

#### 0.8.5 - 右側 touch skin（Research P2-I）
- [x] 右側觸控鍵改半透明圓＋ember 邊（`.touch-btn`）；hit target 維持 80／64px
- [x] 按下 `scale(0.96)`（`:active`）；左搖桿唔改
- [x] 唔動 moves／Deflect／Save／audio／AI／particles／createGame

#### 0.8.6 - 火炬 item（P1）
- [x] `items.ts`：`torch`／火炬世界標記＋inventory flag；`applyTorchDemonBonus`（×1.35 vs demon only）
- [x] `createGame`：庭院 stub mesh；**E** 拾取；held `PointLight` 跟玩家（`TORCH_LIGHT_DISTANCE`）
- [x] 戰鬥命中路徑：torch held 時只對 demon 加傷；唔改 MOVE damage tables
- [x] HUD：炬 flag；`begin`／`again` reset；`rise` 保留（同 ash-token／flask-shard）
- [x] 單元測試 `items.test.ts`（torch collect／reset／demon bonus）；**暫無 shop UI**

#### 0.8.7 - Harness polish
- [x] `recentWinRate` 窗口 **8 → 24**（`HARNESS_RECENT_WINDOW`）
- [x] 公爵／紅契更細 state bucket（tell／swing／roar／…＋melee／near／mid／far＋p1／p2）；hollow 粗分不變
- [x] 固定種子回歸：`runFixedSeedRegression`／`mulberry32`＋`scripts/harness-regression.mjs`
- [x] 單元測試更新；**唔改** moves 傷害／deflect／Graphics／Save／items／audio

### 下一步開發（按優先順序）

#### P0 - 戰鬥深度
1. ~~**連擊系統** (`moves.ts`)~~ **已完成（0.7.7）**
   - ~~添加輕擊連擊（3段）~~
   - ~~每段傷害遞增（20 → 25 → 35）~~
   - ~~連擊窗口時間 0.8s~~
   - ~~連擊結束後有 short recovery~~

2. ~~**招架/Deflect** (`player.ts`, `foes.ts`)~~ **已完成（0.8.0）**
   - ~~精準格擋時機（敵人攻擊前 0.2s）~~
   - ~~成功 deflect 彈開敵人 + 短暫硬直~~
   - ~~失敗仍正常格擋~~

#### P1 - 遊戲深度
3. **道具系統** (`items.ts`／`createGame.ts`)
   - ~~灰徽／瓶碎片 stub（世界拾取＋inventory flag）~~ **已完成（0.8.3）**
   - ~~火炬（照明範圍 + 對特定敵人傷害）~~ **已完成（0.8.6）**
   - 炸藥（範圍傷害）
   - 恢復藥草（即時回血）
   - 快捷欄 1-4 鍵切換／shop UI

4. **環境敘事** (`createGame.ts`)
   - 可拾取物品（灰燼袋、遺物）
   - 閱讀文本（背景故事、提示）
   - 環境細節（遺體、符號、標記）

#### P2 - 技術優化
5. **代碼重構** (`createGame.ts`)
   - 拆分大檔案（持續）
   - 玩家邏輯 → `player.ts`（部分已有）
   - ~~敵人 AI → `ai.ts`~~ **已完成（0.7.3）**；模擬／命中仍在 createGame
   - ~~粒子系統 → `particles.ts`~~（0.7.8 spark；**0.8.1** 環境 ember／mote 已抽取）
   - ~~音效系統 → `audio.ts`~~（0.7.5 戰鬥合成；**0.8.4** ambient／腳步 beds）

#### Fullstack 後續（AI／自動遊玩）
- ~~更長局數觀測／公爵／紅契細 bucket／固定種子回歸~~ **已完成（0.8.7）**；唔改招式傷害。
- SaveManager 屬 Game developer，Fullstack 唔動。

6. **性能優化**
   - 減少 Draw Calls
   - 合併靜態幾何體
   - 使用 InstancedMesh
   - LOD 系統

#### P3 - 體驗提升
7. **音效優化** (`audio.ts`；戰鬥合成 0.7.5；**ambient／腳步 0.8.4**)
   - ~~環境音（風聲、火焰聲）~~ **已完成（0.8.4 loop stubs）**
   - ~~腳步聲~~ **已完成（0.8.4；material-agnostic；材質分化仍可後續）**
   - 武器揮舞聲（可擴充現有 tone／noise）
   - 動態戰鬥 BGM — 尚未做

8. **UI/UX** (`hud.ts`)
   - 連擊數顯示
   - 道具快捷欄 UI
   - 任務提示
   - 統計數據（殺敵數、拾取數）

### 不做

- 開放世界、武器樹、第二主角。
- 線上惡魔保持稀有，不要在開場就出現。
- 不把 Hero Forge、未確認授權的 Unity Asset Store 模型放進 repo。
- 不添加新地圖（目前只專注庭院場景）。

### 開發規範

1. **版本控制**
   - 新功能開分支，開 PR
   - 合併前必須更新 `src/game/version.ts`
   - 遵循 Semantic Versioning

2. **測試**
   - 保持現有測試通過
   - 新增功能添加單元測試
   - QA 通道：遊戲內輸入 `vowdebug`

3. **程式風格**
   - 招式數字統一在 `moves.ts`
   - 鏡頭邏輯在 `camera.ts`
   - 玩家動作在 `player.ts`
   - 敵人決策在 `ai.ts`（`foes.ts` re-export）；外形在 `enemyMesh.ts`
   - 持久化在 `saveManager.ts`
   - 戰鬥音效在 `audio.ts`

### 分支策略

```
main → 生產環境 (demo)
feature/* → 新功能開發
```

合併前請確保：
- [ ] 所有測試通過
- [ ] 版本號已更新
- [ ] README 已更新
- [ ] 無 TODO/FIXME 遺漏

### 版本歷史

| 版本 | 日期 | 變更 |
|------|------|------|
| 0.5.4 | 2026-10-14 | Loading bar, routeTree gen |
| 0.6.0 | 2026-10-14 | 模型優化（頭身比例、劍長度）|
| 0.7.0 | 2026-10-15 | 火焰/拱門/公爵/盾牌/披風/燈光優化 |
| 0.7.1 | 2026-10-15 | UI/VFX：標題粉結、hud-plate、擊中 spark 層級 |
| 0.7.2 | 2026-10-15 | SaveManager 抽取（localStorage 持久化） |
| 0.7.3 | 2026-10-15 | Fullstack：敵人 AI → `ai.ts`；harness winRate 觀測；README 進度 |
| 0.7.4 | 2026-10-15 | Graphics P1-E：死亡／通關卡片電影感（ember sweep、深灰／微金、clears／best） |
| 0.7.5 | 2026-10-15 | Audio 抽取（WebAudio 戰鬥合成音 → audio.ts） |
| 0.7.6 | 2026-10-15 | Graphics P1-F：Boss 橫幅／二階段 pulldown（字距＋opacity、條底紅脈動） |
| 0.7.7 | 2026-10-15 | P0 輕擊三連（20→25→35、窗口 0.8s、short recovery） |
| 0.7.8 | 2026-10-15 | Fullstack：戰鬥 spark 池 → particles.ts（唔改倍數） |
| 0.7.9 | 2026-10-15 | Graphics P1-G：鎖定菱形細線＋中心粉點＋punish 外圈 cue |
| 0.8.0 | 2026-10-15 | P0 招架／Deflect（0.2s 精確格擋窗、彈開＋硬直） |
| 0.8.1 | 2026-10-15 | Fullstack：環境 ember／mote → particles.ts（spark 倍數不變） |
| 0.8.2 | 2026-10-15 | Graphics P1-H：`--color-bow` 統一 title＋HUD；title／ember「呼吸」pulse |
| 0.8.3 | 2026-10-15 | P1 道具 stub：ash-token／flask-shard 世界拾取＋inventory flag（無 shop） |
| 0.8.4 | 2026-10-15 | Fullstack P3：ambient wind／fire beds＋腳步（mute 有效；無 BGM） |
| 0.8.5 | 2026-10-15 | Graphics P2-I：右側 touch 半透圓＋ember 邊；press scale 0.96 |
| 0.8.6 | 2026-10-15 | P1 火炬：世界拾取＋held light＋vs demon ×1.35（無 shop） |
| 0.8.7 | 2026-10-15 | Fullstack：Harness polish（固定種子回歸、duke／demon 細 bucket、recentWindow 24） |
