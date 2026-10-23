# sprites/

Placeholder 2.5D sprite sheets for the 1.0.x / 1.1.x era (README Art Direction).

| path | purpose |
| --- | --- |
| `mallow-placeholder-4dir.png` | 32x32 stub sheet — 4 horizontal bands (S/W/N/E placeholders: bow / steel / ember / soot). Graphics **1.0.3** replaced dir frames under `mallow/`. |
| `mallow/{s,e,n,w}.png` | Sir Mallow 4-dir billboard frames (Graphics 1.0.3). |
| `hollow/hollow-placeholder-4dir.png` | 32x32 灰殼 stub sheet — ash/soot bands (S/W/N/E). Fullstack **1.1.5**. |
| `hollow/{s,e,n,w}.png` | 灰殼 4-dir placeholder frames (Graphics may replace; no paid Aether in this wave). |

Loader: `src/game/spriteSheet.ts` — sheet keys `mallow` \| `hollow` \| `灰殼`. Do not commit multi-MB sheets here.
