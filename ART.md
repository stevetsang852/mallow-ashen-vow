# ART.md — Low-poly pixel 3D inventory & budgets

Living art note for **Mallow: Ashen Vow**. Style mandate: **low-poly pixel 3D** (PS1／PSX-lite + chunky modern low-poly). See README § **Art Direction: Low-poly pixel 3D**.

Last updated: **2026-10-20** · version **0.8.33**（docs／inventory only；mesh rewrite deferred）.

**Research brief (must cite):** `/workspace/news-research/2026-10-20-mallow-lowpoly-pixel-3d.md`（副本 `/workspace/mallow-research/2026-10-20-mallow-lowpoly-pixel-3d.md`）. Stack: Three.js **^0.186.1**（網頁；非 Unity）.

## Visual goals (ember soulslike)

- Readable silhouettes at courtyard distance (bow ears, hood, horn helm, wings).
- Faceted / blocky armor; flat shading; limited soot–bone–ember palette.
- Cute player identity (pink bow `#e8a0b8`, oversized sword) vs dark ash foes + ember `#E85D04`.
- No cinematic high-poly PBR; no paid asset packs.
- Combat readability beats style: wind-up／recover／roll／guard rings and lock diamond contrast must not be weakened by pixel post.

## Per-asset budgets (Research-aligned)

| Asset | Tris (target) | Texture / shading | GLB size if kept |
| --- | --- | --- | --- |
| Sir Mallow | **800–2,500** | none or 256–512 atlas nearest | **≤250–400 KB** Meshopt |
| Hollow (road／side) | **400–1,200** | vertex / shared 256 atlas | **≤150–300 KB** |
| Coal-ash Duke | **1,000–2,500** | + emissive cracks | **≤150–300 KB** |
| Red-contract Demon | **800–2,000** | low-face wings; emissive blade | **≤150–300 KB** |
| Handheld prop / weapon | **50–400** | solid or 128 blocks | — |
| Scene prop | **50–300** | **vertex color default** | — |
| Arch / bonfire kit | **500–2,000** total | shared mats; merge static | — |
| Scene visible | **≲ 25k–40k tri** comfort; watch ≤100k verts | ≤8–12 material kinds | measure `renderer.info` |

**Shading default:** vertex color / per-face solids for props & most armor. Small atlas only for face／bow／weapon ID. High-res PBR **forbidden** as default.

**Optional PS1 layer = P2:** half／quarter RT, vertex snap, ordered dither, `image-rendering: pixelated` — A/B after combat-ring readability; never on HUD DOM.

## Current gaps (inventory)

| Item | Current | Gap vs direction |
| --- | --- | --- |
| `mallow-knight-cat.glb` | **~19.3 MB** | Far over ≤400 KB; not a low-poly delivery |
| `hollow`／`duke`／`demon`.glb | **~3.5–3.7 MB** each | Still heavy; re-export or drop as default |
| Loaders | `GLTFLoader` only; enemy → procedural fallback; player reject on fail | No Meshopt／Draco; no traverse flat／NearestFilter |
| `enemyMesh.std()` | `flatShading: true` | Aligned |
| `knightMesh.std()` | `flatShading: true` + `applyPixelLook` | Done (0.8.36) |
| Renderer | `antialias: false`; `pixelRatio ≤ 1.75` | Facets stay crisp (0.8.39) |

## Pipeline

```
Procedural DEFAULT (enemyMesh / knightMesh)
  ↔ optional Blender low-poly → GLB → gltf-transform (Meshopt)
  → public/models/<name>.glb
  → GLTFLoader + applyPixelLook(traverse: flat + NearestFilter)
  → on failure: makeHollow / makeDuke / makeDemon / makeKnight
```

Procedural remains source of truth until GLBs meet budgets. External GLB is **not** the default visual guarantee.

## Asset inventory

### Procedural (code)

| Factory | File | Role | Notes (current) |
| --- | --- | --- | --- |
| `makeKnight` | `src/game/knightMesh.ts` | Player／foe base | Capsule／Sphere／Box mix；**`std()` missing flatShading** |
| `makeHollow` | `src/game/enemyMesh.ts` | 灰殼 | Box plates／helm；some high-seg spheres remain |
| `makeDuke` | `src/game/enemyMesh.ts` | 公爵 | Layered spheres＋box shoulders＋horns |
| `makeDemon` | `src/game/enemyMesh.ts` | 紅契 | Slim＋cones／wings／red blade |
| Helpers | `enemyMesh.ts` | Armor／spikes／bones | `std()` **has** flatShading；ember cracks |

Shared type: `KnightRig`. Pose: `poseKnight`；enemies via `loadEnemyRig` then pose.

### External GLB (`public/models/`)

| File | Approx size | Loader | Fallback |
| --- | --- | --- | --- |
| `hollow.glb` | ~3.5 MB | `enemyRig.ts` | `makeHollow` |
| `duke.glb` | ~3.5 MB | `enemyRig.ts` | `makeDuke` |
| `demon.glb` | ~3.5 MB | `enemyRig.ts` | `makeDemon` |
| `mallow-knight-cat.glb` | **~19.3 MB** | `mallowRig.ts` | `makeKnight`（reject path） |

### Concepts (2D — low-poly pixel **target** refs, not realism nets)

| File | Subject |
| --- | --- |
| `public/concepts/hollow-ash-shell.jpg` | 灰殼 |
| `public/concepts/coal-ash-duke.jpg` | 煤灰公爵 |
| `public/concepts/red-contract-demon.jpg` | 紅契 |

### Scene / VFX

Courtyard props、火芯、拱門、particles — ember palette；do **not** rewrite FX feel numbers in art-docs PRs.

## Naming

Runtime URLs: `/models/<kind>.glb` with `kind` ∈ `hollow`｜`duke`｜`demon`｜`mallow-knight-cat`. Keep loader maps in sync.

## Deferred (later Graphics PR — not this docs pass)

1. Re-author／Meshopt GLBs to KB budgets **or** switch default visual to procedural.
2. `knightMesh.std()` → `flatShading: true`.
3. `applyPixelLook(root)` on GLB／procedural roots.
4. Reduce high-segment spheres；props → vertex-color boxes.
5. Renderer P1／P2 experiments (AA off／half RT／snap／dither) with vowdebug duke readability check.
6. `InstancedMesh` for repeated courtyard props.

## License

CC0／CC BY／original procedural only. No Hero Forge／unverified Asset Store／paid packs.
