# Sir Mallow sprites (Graphics 1.1.6)

- **idle-v3-key.png** — local Aether idle-v3 key (sword on right shoulder, no clipping). Transparent PNG, 512². Source: `/workspace/aether-mallow/v1-anims/idle-v3-key.png` (gray BG keyed offline; **no paid Aether** this wave).
- **s / n / w.png** — reuse key (interim 4-dir until walk/attack sheets).
- **e.png** — horizontal flip of key (interim).
- **walk / attack / hurt / death** — blocked pending YIN Aether credits.

Billboard consumer: `src/game/mallowSprite.ts` (still `{s,e,n,w}.png` + `setFacingYaw`).
