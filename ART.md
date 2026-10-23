# ART.md — Pure 2D Dark Souls-like inventory & pipeline

Living art note for **Mallow: Ashen Vow**. Style mandate: **純 2D Dark Souls-like**（Canvas 2D sprite sheets；**唔再以 2.5D／Three.js billboard 做主線**）. Runtime: `createGame2D`（2.0.0+）. See README 近況＋Next Steps.

Last updated: **2026-10-23** · GD **2.0.4** 純 2D 畫面跟隨（玩家置中、指數平滑）＋平面戰鬥可讀（前搖橙條／命中白弧／收刀粉環／受擊紅閃／低體力金邊）. 命中窗仍係平面既有 `0.1–0.28`，收招結束仍係 `actionEnd`. **2.0.3** 灰殼 dirs `drawImage` 仍有效. **2.0.2** 改格 brief 仍有效.

Stack: **Canvas 2D**（網頁）；舊 Three.js／GLB／billboard＝過渡／封存參考.

## Mandate（必須）

- **Primary:** 純 2D top-down／plane — `canvas` `drawImage`／vector fallback；固定畫面平面.
- **Characters／enemies:** 多向 Sprite Sheet（站／走／攻擊／受擊／死亡最少可分）；優先 `public/sprites/<kind>/`.
- **Runtime:** `createGame2D`；**唔**新開 Three.js scene／billboard 主線.
- **Combat readability:** 前搖／收刀／翻滾／格擋提示＋鎖定標在 2D 平面對比不可削.
- **Identity:** 粉結 `#e8a0b8`／`#e7a0b0`、過大劍、ember `#E85D04`／`#e85d04`、灰燼 soot／bone；cute × dark.
- **No** cinematic PBR；**no** Meshopt／low-poly-3D-as-primary；**no** 2.5D billboard-as-primary；**no** paid packs without YIN.

## 改格 brief（2.0.2 — 本刀）

**Hypothesis／target vibe:** 全面改格對齊 **2.0.x 純 2D**（灰燼 gradient＋ember vignette；玩家 Sprite／粉結 fallback；敵人暗 silhouette＋ember cracks）. 美術格＋UI 皮層一次寫死；鏡頭／戰鬥格 **延後波**，本檔只對照交棒. 禁空洞口號；禁 dump `public/sprites`；禁付費 Aether（要 YIN）.

### 美術格（Sprite sheet／silhouette／palette — Canvas 2D）

| 規則 | 內容 |
| --- | --- |
| **Silhouette first** | 遠距可辨：粉結＋過大劍、灰殼兜帽、公爵角盔、紅契翅；平面上唔糊成一團 |
| **Palette** | soot／bone／灰銀底＋ember `#E85D04`；粉結只給玩家；敵人唔搶粉結色；背景深灰燼＋ember vignette（對齊 2.0.1） |
| **Sprite 可讀** | `drawImage` sheet／單向 PNG；idle 可先；攻擊／受擊 frame 要跟得住前搖／命中窗 |
| **placeholder → 替換** | stub／灰塊／canvas arc fallback OK → 正式 sheet **同 path／同 key 覆蓋**；layout 改必同步本檔＋loader |
| **灰殼優先** | Hollow → Duke → Demon；灰殼可讀前唔開下一敵 |
| **付費閘** | Paid Aether／Store：**要 YIN**；未批＝original／CC0／程式 fallback only |

### UI 皮層（HUD／標題／選單 — CSS／skin 指引 only）

- **對齊 vibe:** Title／Menu／HUD 跟遊戲內灰燼＋ember；暗底、高對比字／框；粉結色只作玩家／CTA 點綴.
- **Hierarchy:** 血／架勢／戰鬥提示 > 次要數值 > 裝飾；HUD 唔遮攻擊提示／鎖定標.
- **Contrast:** 標題／選項低亮度仍可讀；focus／hover 用 ember 邊.
- **本刀唔寫 CSS／canvas HUD 實作** — 交後續 UI 皮層刀.

### 鏡頭／戰鬥（對照 only — 唔實作）

| 格 | Research 建議 | Owner（後續推一令） |
| --- | --- | --- |
| **鏡頭／畫面** | 純 2D 平面；可輕跟隨／打擊微震；**唔**回 3D／自由軌道 cam | GD |
| **戰鬥可讀** | 前搖橙／收刀粉／翻滾淡白／格擋＋鎖定標對比不可削；可用 canvas ring／sprite overlay | GD／Graphics |
| **朝向** | 依移動／攻擊 yaw 切 sheet dir 或 flip；世界相對 WASD 維持 | GD |

### Handoff（達標即停）

1. **2.0.2** Research：ART.md 改格 brief（純 2D）＋`GAME_VERSION` → **2.0.2**（已合）.
2. **2.0.3** Graphics：**達標** — 灰殼 `public/sprites/hollow/{n,e,s,w}.png` 依 yaw `drawImage`；未載入 silhouette＋ember crack. 玩家 facing 切 mallow dirs. 唔改 moves／AI.
3. **2.0.4** GD：**達標** — `screenFollow.ts` 純 2D 跟隨（唔用 iso cam）；`createGame2D` 前搖／命中／收刀／受擊／低體力提示. 唔改 moves／AI.
4. **再後** UI 皮層（Graphics／Research CSS）.
5. Fullstack 待命；付費仍要 YIN.

## 敵人 Sprite 管線（2.0.x — 延續灰殼優先）

```
優先序: 灰殼 Hollow → 煤灰公爵 Duke → 紅契 Demon
  1) Placeholder（CC0／original／灰塊 stub）→ public/sprites/hollow/
  2) Fullstack／createGame2D 認 path／key（hollow）
  3) Graphics drawImage 落地（2.0.3 灰殼 idle/dirs 達標；walk／attack／hurt／death 後補）
  4) 正式 sheet 同 path／同 key 覆蓋（唔改 moves／AI／Save）
  on miss: canvas silhouette／arc fallback（2.0.1 現況）
```

Sheet 建議: `public/sprites/<kind>/{n,e,s,w}.png` 或單檔橫列／2×2. Frame size 由 Graphics／loader 定.

## Pipeline（AetherAI → ship）

```
AetherAI（或 equiv；付費要 YIN）多向 sheets
  → public/sprites/<kind>/…
  → Fullstack path／key＋smoke
  → Graphics createGame2D drawImage（2.0.3：Mallow dirs ＋ 灰殼；duke／demon 仍 fallback）
  → on miss: canvas vector／silhouette fallback
```

## Sprite inventory（純 2D）

| Asset | Path（約定） | Dirs | Status |
| --- | --- | --- | --- |
| Sir Mallow | `public/sprites/mallow/` | 4 | 2.0.3 依 canvas yaw 切 `{n,e,s,w}.png`；未載入粉結 arc fallback |
| **灰殼 Hollow** | `public/sprites/hollow/` | **4** | **2.0.3 達標** — idle/dirs `drawImage`（yaw→n/e/s/w，nearest）；未載入 silhouette＋ember crack |
| 煤灰公爵 Duke | `public/sprites/duke/` | 4–8 | 下一波；本刀仍 canvas arc |
| 紅契 Demon | `public/sprites/demon/` | 4–8 | 等公爵（本刀未開） |
| Skill／FX | `public/sprites/fx/` | — | 實驗；唔取代近戰提示 |

## Transitional debt（舊 3D／2.5D — 非主力）

| Item | Note |
| --- | --- |
| Three.js scene／`Sprite` billboard／iso cam | **2.0.0 起非主線**；封存參考 |
| `*.glb`／`makeKnight`／`makeHollow`／… | 過渡／唔追 Meshopt |
| Concepts JPG | `public/concepts/*.jpg` — 餵 placeholder／手繪參考 |

## Naming

- Sprites: `/sprites/<kind>/…`；`kind` ∈ `mallow`｜`hollow`｜`duke`｜`demon`｜`fx`.
- Legacy GLB: `/models/<kind>.glb` — 唔新增大 GLB 主線.

## Deferred（唔屬本刀）

1. 正式替換灰殼 sheet，以及 duke／demon 像素檔（Graphics）.
2. Paid Aether sheets（**要 YIN**）.
3. UI CSS 實作、刪舊 3D 入口（另推一令）. 鏡頭／平面戰鬥提示已在 **2.0.4**.

## Historical note

≤0.8.x low-poly／Meshopt 封存；**1.0.4–1.1.7** 曾以 2.5D／billboard 為主；**2.0.0** 純 2D 重啓（`createGame2D`）；**2.0.1** visual overhaul；**2.0.2** 改格 brief（美術＋UI 皮層對齊純 2D；鏡頭／戰鬥對照交棒）；**2.0.3** 灰殼 dirs `drawImage` 落地；**2.0.4** 純 2D 畫面跟隨＋戰鬥可讀.

## License

CC0／CC BY／original placeholders only. No Hero Forge／unverified Store／**paid Aether without YIN**.
