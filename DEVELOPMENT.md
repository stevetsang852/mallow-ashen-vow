# Development Plan - Mallow: Ashen Vow

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