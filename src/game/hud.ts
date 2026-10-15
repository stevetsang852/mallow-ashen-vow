export type Phase = "title" | "play" | "dead" | "win";

export type HudSnap = {
  phase: Phase;
  webgl: boolean;
  hp: number;
  hpMax: number;
  sta: number;
  staMax: number;
  flasks: number;
  flaskMax: number;
  ash: number;
  deaths: number;
  bestMs: number | null;
  clears: number;
  runMs: number;
  bossHp: number | null;
  bossMax: number;
  bossShown: boolean;
  bossPhase: number;
  lockName: string | null;
  poise: number | null;
  poiseMax: number;
  punish: boolean;
  banner: string;
  nearFire: boolean;
  canTemper: boolean;
  toast: string;
  hurt: number;
  guard: number;
  staFlash: number;
  muted: boolean;
  gateOpen: boolean;
  menuOpen: boolean;
  ready: boolean;
  loadPct: number;
  demonShown: boolean;
  demonName: string;
  demonHp: number | null;
  demonMax: number;
  /** P1 items stub (0.8.3) — in-memory inventory flags. */
  hasAshToken: boolean;
  hasFlaskShard: boolean;
  /** P1 torch (0.8.6) — held inventory flag. */
  hasTorch: boolean;
  /** P1 explosive (0.8.9) — inventory flag; KeyE detonates when no pickup nearby. */
  hasExplosive: boolean;
  /** P1 heal herb (0.8.12) — inventory flag; KeyE uses when no pickup nearby. */
  hasHealHerb: boolean;
  /** Nearest in-range world pickup label, or "". */
  nearItem: string;
  /** Light-combo display count 1..3; 0 = hide plate (normal UI). */
  lightCombo: number;
  /** P1 0.8.15/0.8.17 hotbar — selected slot index 0..3 (Key1–4). */
  hotbarSelected: number;
  /** P1 0.8.15/0.8.17 — filled flags for slots 0–3 (torch/explosive/healHerb/flask-shard). */
  hotbarFilled: [boolean, boolean, boolean, boolean];
};

export type GameApi = {
  begin: () => void;
  rise: () => void;
  again: () => void;
  rest: () => void;
  temper: () => void;
  attack: () => void;
  heavy: () => void;
  dodge: () => void;
  lock: () => void;
  flask: () => void;
  /** Collect nearest world pickup when in range (KeyE priority). */
  interact: () => void;
  /** P1 0.8.15 — select hotbar slot 0..3 and attempt use if held. */
  hotbar: (slot: number) => void;
  toggleMute: () => void;
  closeMenu: () => void;
  setStick: (x: number, y: number) => void;
  dispose: () => void;
};

export const INITIAL_HUD: HudSnap = {
  phase: "title",
  webgl: true,
  hp: 100,
  hpMax: 100,
  sta: 100,
  staMax: 100,
  flasks: 4,
  flaskMax: 4,
  ash: 0,
  deaths: 0,
  bestMs: null,
  clears: 0,
  runMs: 0,
  bossHp: null,
  bossMax: 280,
  bossShown: false,
  bossPhase: 1,
  lockName: null,
  poise: null,
  poiseMax: 1,
  punish: false,
  banner: "",
  nearFire: false,
  canTemper: false,
  toast: "",
  hurt: 0,
  guard: 0,
  staFlash: 0,
  muted: true,
  gateOpen: false,
  menuOpen: false,
  ready: false,
  loadPct: 0,
  demonShown: false,
  demonName: "紅契",
  demonHp: null,
  demonMax: 150,
  hasAshToken: false,
  hasFlaskShard: false,
  hasTorch: false,
  hasExplosive: false,
  hasHealHerb: false,
  nearItem: "",
  lightCombo: 0,
  hotbarSelected: 0,
  hotbarFilled: [false, false, false, false],
};
