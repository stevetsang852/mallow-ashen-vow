# ART.md — 2.5D Dark Souls-like inventory & pipeline

Living art note for **Mallow: Ashen Vow**. Style mandate: **2.5D Dark Souls-like**（Sprite／HD-2D／isometric）. See README § **Art Direction: 2.5D Dark Souls-like**（v1.0.0+）.

Last updated: **2026-10-22** · Research knife **1.0.4**（docs／inventory only；唔做 Meshopt／唔開無關 POC）.

Stack: Three.js **^0.186.1**（網頁）.

## Mandate（必須）

- **Primary:** Sprite／HD-2D／isometric；固定或有限鏡頭（isometric／quarter／側捲優先）.
- **Characters／enemies:** 4–8 向 Sprite Sheet（站／走／攻擊／翻滾／受擊最少可分）.
- **Runtime:** Three.js `Sprite` 或固定朝向 billboard `Mesh`；舊程序化 3D／GLB＝**過渡 fallback**，唔再當主力交付.
- **Combat readability contract（不可削）:** 前搖／收刀／翻滾／格擋 rings＋lock diamond 對比必須清楚；美術後製唔可蓋過提示.
- **Identity:** 粉紅蝴蝶結 `#e8a0b8`、過大劍 silhouette、ember `#E85D04`、灰燼 soot／bone 有限色盤.
- **No** cinematic high-poly PBR；**no** paid asset packs；**no** Meshopt／low-poly-as-primary 作為新方向（見下方 Historical）.

## Pipeline（AetherAI → ship）

```
AetherAI（或 equiv）4–8 dir sheets／概念
  → public/sprites/<kind>/… 或 <kind>-4dir.png（frame 佈局寫本檔）
  → Fullstack Sprite sheet loader（public/sprites/ + harness smoke）
  → Graphics billboard Sprite（Sir Mallow stub → enemies）
  → on miss: 過渡 procedural／GLB fallback（knightMesh／enemyMesh）
```

Paid AetherAI／訂閱：**要 YIN**；未批前只用 **original／CC0 placeholder**.

## Sprite inventory（2.5D）

| Asset | Path（約定） | Dirs | Status |
| --- | --- | --- | --- |
| Sir Mallow | `public/sprites/mallow/`（或 sheet；跟 Fullstack／Graphics 合流後） | 4–8 | **TODO** — Graphics stub（粉結＋大劍） |
| 灰殼 Hollow | `public/sprites/hollow/` `n/e/s/w` 或 `hollow-4dir.png` | 4 | **TODO** — placeholder／sheet |
| 煤灰公爵 Duke | `public/sprites/duke/` | 4–8 | **TODO** |
| 紅契 Demon | `public/sprites/demon/` | 4–8 | **TODO** |
| Skill／FX sprites | `public/sprites/fx/`（如 ember skill） | — | 實驗可有；唔取代近戰可讀提示 |

Sheet layout（若單檔 4-dir）: 建議 2×2（N E／S W）或橫列 N→E→S→W；實際 frame size 由 Graphics／loader 定，改 layout 必同步 `ART.md`.

## Transitional debt（舊 3D／GLB — 非主力）

| Item | Current | Note |
| --- | --- | --- |
| `mallow-knight-cat.glb` | ~19.3 MB | 過渡；唔再追 ≤400 KB Meshopt 作主線 |
| `hollow`／`duke`／`demon`.glb | ~3.5–3.7 MB ea | 過渡 fallback only |
| `makeKnight`／`makeHollow`／… | procedural | 過渡；Sprites 到位後降級 |
| Concepts JPG | `public/concepts/*.jpg` | 2D 參考；可餵 AetherAI／手繪 sheet |

舊 tris／Meshopt 預算表＝**歷史債務**，唔再當 sprint 主目標.

## Naming

- Sprites: `/sprites/<kind>/…`；`kind` ∈ `mallow`｜`hollow`｜`duke`｜`demon`｜`fx`.
- Legacy GLB: `/models/<kind>.glb` 仍可由 loader 作 fallback；唔新增大 GLB.

## Deferred（唔屬本刀）

1. 實裝 loader／billboard／相機 lock（GD／Fullstack／Graphics）.
2. 產出正式 AetherAI sheets（付費要 YIN）.
3. 刪／壓縮舊 GLB（有 Sprite 覆蓋後再清）.
4. PS1 half-RT／dither 等後製實驗（先保戰鬥 ring 可讀）.

## Historical note

≤0.8.x **low-poly pixel 3D** brief（PS1-lite、tris／Meshopt budgets、`applyPixelLook`）已封存；自 **1.0.0** 起以本檔＋README § 2.5D 為準。舊 Research 文檔僅作考古.

## License

CC0／CC BY／original procedural／original placeholders only. No Hero Forge／unverified Store／paid packs without YIN.
