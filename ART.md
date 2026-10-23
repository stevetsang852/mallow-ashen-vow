# ART.md — 2.5D Dark Souls-like inventory & pipeline

Living art note for **Mallow: Ashen Vow**. Style mandate: **2.5D Dark Souls-like**（Sprite／HD-2D／isometric）. See README § **Art Direction** + **Next Steps**（敵人 Sprite 起手＋朝向）.

Last updated: **2026-10-23** · Research knife **1.1.7**（敵人 Sprite 管線 brief only；唔做 sheet／Meshopt／付費 Aether）.

Stack: Three.js **^0.186.1**（網頁）.

## Mandate（必須）

- **Primary:** Sprite／HD-2D／isometric；固定或有限鏡頭.
- **Characters／enemies:** 4–8 向 Sprite Sheet（站／走／攻擊／受擊／死亡最少可分）.
- **Runtime:** Three.js `Sprite` 或固定朝向 billboard；舊 procedural／GLB＝**過渡 fallback**.
- **Combat readability:** 前搖／收刀／翻滾／格擋 rings＋lock diamond 對比不可削.
- **Identity:** 粉結 `#e8a0b8`、過大劍、ember `#E85D04`、灰燼 soot／bone.
- **No** cinematic PBR；**no** Meshopt／low-poly-as-primary 新方向；**no** paid packs without YIN.

## 敵人 Sprite 管線（1.1.x — 本刀焦點）

對齊 README Next Steps #1「敵人 Sprite：優先灰殼」.

```
優先序: 灰殼 Hollow → 煤灰公爵 Duke → 紅契 Demon
  1) Placeholder（CC0／original／灰塊 stub）→ public/sprites/hollow/
  2) Fullstack loader／harness 認 sheet key（hollow）
  3) Graphics billboard 落地（可先 idle；walk／attack／hurt／death 後補）
  4) 正式 sheet 替換同 path／同 key（唔改 moves／AI／Save）
  on miss: 過渡 enemyMesh／*.glb fallback
```

| 閘 | 規則 |
| --- | --- |
| **灰殼優先** | 先做 `hollow` 4-dir；Duke／Demon 等灰殼可讀後再排 |
| **placeholder → 替換** | stub 可合；正式 art **同 path 覆蓋**；layout 改必同步本檔＋loader |
| **付費閘** | Paid AetherAI／訂閱／Store packs：**要 YIN**；未批＝只用 original／CC0 placeholder（禁付費 Aether） |

Sheet 建議: 單檔 2×2（N E／S W）或橫列 N→E→S→W；或 `public/sprites/hollow/{n,e,s,w}.png`（跟 mallow 合流）. Frame size 由 Graphics／loader 定.

## Pipeline（AetherAI → ship）

```
AetherAI（或 equiv；付費要 YIN）4–8 dir sheets
  → public/sprites/<kind>/… 或 <kind>-4dir.png
  → Fullstack Sprite sheet loader＋harness smoke
  → Graphics billboard（Sir Mallow → enemies）
  → on miss: procedural／GLB fallback
```

## Sprite inventory（2.5D）

| Asset | Path（約定） | Dirs | Status |
| --- | --- | --- | --- |
| Sir Mallow | `public/sprites/mallow/` | 4–8 | 進行中 — Graphics／朝向平滑（1.1.x） |
| **灰殼 Hollow** | `public/sprites/hollow/` 或 `hollow-4dir.png` | **4** | **P0** — placeholder OK → 替換；本波起手 |
| 煤灰公爵 Duke | `public/sprites/duke/` | 4–8 | 等灰殼可讀後 |
| 紅契 Demon | `public/sprites/demon/` | 4–8 | 等灰殼可讀後 |
| Skill／FX | `public/sprites/fx/` | — | 實驗；唔取代近戰提示 |

## Transitional debt（舊 3D／GLB — 非主力）

| Item | Note |
| --- | --- |
| `mallow-knight-cat.glb`／`hollow`／`duke`／`demon`.glb | 過渡 fallback only；唔追 Meshopt 主線 |
| `makeKnight`／`makeHollow`／… | Sprites 到位後降級 |
| Concepts JPG | `public/concepts/*.jpg` — 餵 placeholder／手繪參考 |

## Naming

- Sprites: `/sprites/<kind>/…`；`kind` ∈ `mallow`｜`hollow`｜`duke`｜`demon`｜`fx`.
- Legacy GLB: `/models/<kind>.glb` fallback；唔新增大 GLB.

## Deferred（唔屬本刀）

1. 產出／提交 hollow／duke／demon 像素檔（Graphics／FS）.
2. Paid Aether sheets（**要 YIN**）.
3. 刪舊 GLB、戰鬥環改 Sprite、敵人 AI 窗口微調（另刀）.

## Historical note

≤0.8.x low-poly／Meshopt 已封存；**1.0.4** 定 2.5D／AetherAI 總管線；**1.1.7** 專寫敵人 Sprite 起手（灰殼優先＋付費閘）.

## License

CC0／CC BY／original placeholders only. No Hero Forge／unverified Store／**paid Aether without YIN**.
