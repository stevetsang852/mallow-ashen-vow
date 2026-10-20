# ART.md — Low-poly pixel 3D inventory & budgets

Living art note for **Mallow: Ashen Vow**. Style mandate: **low-poly pixel 3D** (PS1／PSX-lite + chunky modern low-poly). See README § **Art Direction: Low-poly pixel 3D**.

Last updated: **2026-10-20** · version target **0.8.33**（docs／inventory only；mesh rewrite deferred）.

## Visual goals (ember soulslike)

- Readable silhouettes at courtyard distance (bow ears, hood, horn helm, wings).
- Faceted / blocky armor; flat shading; limited soot–bone–ember palette.
- Cute player identity (pink bow, oversized sword) vs dark ash foes.
- No cinematic high-poly PBR; no paid asset packs.

## Technical budgets (WebGL / Three.js)

| Budget | Target | Notes |
| --- | --- | --- |
| Tris / hero | ~1 000–5 000 | Props: a few hundred |
| Scene visible tris | keep modest (&lt; ~500k soft) | Mobile sets the ceiling |
| Texture | Shared 512–1024 atlas; hero ≤2048 | Flat colors; `NearestFilter` if textured |
| Material | `flatShading: true`; high roughness | Avoid multi-ORM PBR kits |
| Format | **GLB / glTF** | Prefer Draco／Meshopt + KTX2 later |
| Draw calls | Prefer merged static + instancing | Measure with `renderer.info` |

Research anchors (actionable, not dogma): web low-poly GLB often lands **1k–10k tris**／model; ship compressed GLB; atlas flat colors; LOD for crowds; antialias off + controlled pixel ratio if pursuing stronger PS1 pixelation later.

## Pipeline

```
Blender (low-poly, flat faces)
  → export GLB (Y-up, consistent scale)
  → public/models/<name>.glb
  → GLTFLoader (enemyRig / mallowRig)
  → on failure: procedural makeHollow / makeDuke / makeDemon / makeKnight
```

Procedural path remains the **source of truth** for silhouette experiments until GLBs match budgets.

## Asset inventory

### Procedural (code)

| Factory | File | Role | Geometry notes (current) |
| --- | --- | --- | --- |
| `makeKnight` | `src/game/knightMesh.ts` | Player／foe base rig | Mix of Capsule／Sphere／Box；**`std()` 尚未強制 flatShading**（債務） |
| `makeHollow` | `src/game/enemyMesh.ts` | 灰殼 road／side | Weathered box plates／helm；部分 Sphere 仍偏高段 |
| `makeDuke` | `src/game/enemyMesh.ts` | 煤灰公爵 | Layered spheres＋box shoulders＋horns |
| `makeDemon` | `src/game/enemyMesh.ts` | 紅契 | Slim body＋cones／wings／red blade accents |
| Helpers | `enemyMesh.ts` | Armor／spikes／bones／claws | `std()` **已** `flatShading: true`；ember cracks |

Shared runtime type: `KnightRig`（root／bob／head／weapon／cape／legs／tail／mats）.

Pose／anim: `poseKnight` in `knightMesh.ts`；enemies via `loadEnemyRig` then pose.

### External GLB (`public/models/`)

| File | Approx size | Loader | Fallback |
| --- | --- | --- | --- |
| `hollow.glb` | ~3.5 MB | `enemyRig.ts` → `/models/hollow.glb` | `makeHollow` |
| `duke.glb` | ~3.5 MB | `enemyRig.ts` | `makeDuke` |
| `demon.glb` | ~3.5 MB | `enemyRig.ts` | `makeDemon` |
| `mallow-knight-cat.glb` | **~19 MB** | `mallowRig.ts` | `makeKnight`（load reject path） |

**Debt:** all four GLBs exceed the “low hundreds KB after compression” web ideal. Player GLB is especially heavy. Prefer replace／re-export low-poly + Draco／Meshopt in a later Graphics PR — **not** this docs pass.

### Concepts (2D reference)

| File | Subject |
| --- | --- |
| `public/concepts/hollow-ash-shell.jpg` | 灰殼 |
| `public/concepts/coal-ash-duke.jpg` | 煤灰公爵 |
| `public/concepts/red-contract-demon.jpg` | 紅契 |

### Scene / VFX (not character meshes)

Courtyard props、火芯、拱門、particles（`particles.ts`）、UI／title CSS — follow ember palette；character art direction above does not rewrite FX feel numbers.

## Naming

- Runtime URLs: `/models/<kind>.glb` with `kind` ∈ `hollow`｜`duke`｜`demon`｜`mallow-knight-cat`.
- Prefer lowercase kebab filenames; keep loader maps in sync when renaming.

## Deferred work (later PR — do not sneak into docs-only)

1. Re-author／compress GLBs to budget；optional Draco + KTX2 loader wiring.
2. Force `flatShading` on `knightMesh.std()` and reduce high-segment spheres.
3. Replace remaining high-segment enemy spheres with boxes／low cones where silhouette allows.
4. Optional PS1-lite post (low res + nearest upscale／ordered dither) — feature-flag；respect `prefers-reduced-motion`.
5. Shared flat-color atlas for procedural parts.

## License

CC0／CC BY／original procedural only. No unverified Asset Store／Hero Forge／paid packs in-repo.
