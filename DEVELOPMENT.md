# Development Plan - Mallow: Ashen Vow

## 現況（2.0.5 · 2026-10-26）

公開首頁是 Three.js 灰盒預演（`src/previs/`，路由 `src/routes/index.tsx`）。`GAME_VERSION` 是 **2.0.5**。玩法收在 `src/_hidden/gameHome.tsx`，只有 `/play` 會載入；`/?game=1` 或 `VITE_MALLOW_GAME=1` 會從 `/` 轉過去。正式環境不要設那個變數。

這一刀是 YIN／直屬秘書長的推一令例外。不要合併 HOLD 中的 PR #62（2.0.4 鏡頭／戰鬥留在那裡）。不要把 Seedance、`@theatre/studio` 或 CozyClay 加進倉庫。

調預演只改 `src/previs/shot.ts`（`CAMERA_KEYS`、`POSE_KEYS`），不必重寫路由。灰盒是結構；外觀概念以後再上。

下面 0.5.x／0.6 計畫是舊稿，不是這一刀的範圍。

**Based on README.md Planning**  
**Updated: 2026-10-14**

## Current Status

**Branch:** `feature/model-improvements-0.6`  
**Version:** `0.5.4` → Will bump to `0.6.0` after completing this phase

---

## Completed Changes (0.5.4)

### ✅ Phase 1: Knight Model Improvements
| Item | File | Status | Notes |
|------|------|--------|-------|
| Head-body ratio | `knightMesh.ts` | ✅ Done | `1.08,0.92,0.84` → `1.15,0.88,0.82` |
| Sword length | `knightMesh.ts` | ✅ Done | `1.48` → `1.58` (blade), `1.12` → `1.22` (fuller), `0.2` → `0.22` (tip) |

---

## Next Plan (Phase 2: 0.6.0)

Following README.md Planning order, the remaining tasks are:

### 🎯 Priority 1: Hand & Armor
1. **Hand redesign** (`knightMesh.ts`) - No two spheres, change to simple gauntlet + thumb
2. **Armor refinements** - Shoulder pads adjustment

### 🎯 Priority 2: Duke Model
3. **Duke height** (`enemyMesh.ts`) - Add 0.5 units height
4. **Shoulder pads** - Increase by 20%
5. **Phase 2 glow** - Eyes and chest emit light

### 🎯 Priority 3: Hollow Enemies
6. **Road hollow** (`enemyMesh.ts`) - Thinner body, shorter weapon
7. **Flank hollow** - Wider body, add shield

### 🎯 Priority 4: Demon
8. **Red Contract** (`enemyMesh.ts`) - Keep thin & red, sharper cape and horns

### 🎯 Priority 5: Scene
9. **Bonfire** (`createGame.ts`) - Stone circle, charcoal, fire cluster
10. **Gate** - Keep cloth, add cracks to pillars, cloth falls when opens
11. **Ground** - Add footprints from bonfire to gate

---

## Git Workflow

```bash
# Current: feature/model-improvements-0.6
# After completing all tasks:
1. Update version.ts to 0.6.0
2. Merge to main via PR
```

## Commands

```bash
# Local dev
npm install && npm run dev

# Docker
docker compose up -d

# QA test (in-game)
vowdebug
```

---

## Rule Reminder (from README)

> Do not add new maps, new protagonists, or weapon trees.  
> Do not merge GPL Saga source into this repo.  
> Do not add Hero Forge or unverified Unity Asset Store models.