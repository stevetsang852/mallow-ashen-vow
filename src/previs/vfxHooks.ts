/**
 * VFX hooks for Game Graphics.
 * The greybox previs does not spawn particles. Later skin/VFX work can
 * replace `markVfxHook` with steel Points, pink bursts, dust, ash, and
 * red intrusion flame. Do not add that polish here.
 */
export const PREVIS_VFX_HOOKS = [
  "steel_points_on_hit",
  "pink_burst_on_heavy",
  "dust_on_roll",
  "ash_on_death",
  "red_flame_on_intrude",
] as const;

export type PrevisVfxHook = (typeof PREVIS_VFX_HOOKS)[number];

/** Stub. Graphics owns the particle pass. */
export function markVfxHook(_hook: PrevisVfxHook): void {
  void _hook;
}
