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
  demonShown: boolean;
  demonName: string;
  demonHp: number | null;
  demonMax: number;
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
  demonShown: false,
  demonName: "紅契",
  demonHp: null,
  demonMax: 150,
};
