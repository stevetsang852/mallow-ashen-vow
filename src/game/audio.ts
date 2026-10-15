/** WebAudio SFX for Mallow: combat one-shots + ambient wind/fire beds + footsteps. No BGM. */

export type ToneType = OscillatorType;

export type GameAudio = {
  isMuted: () => boolean;
  setMuted: (next: boolean) => void;
  /** Flip mute; when unmuting, unlock context and play a short confirm beep. */
  toggleMute: () => boolean;
  /** Ensure AudioContext exists and is resumed (user-gesture unlock). */
  unlock: () => void;
  tone: (freq: number, dur: number, type: ToneType, gain: number) => void;
  noise: (dur: number, gain: number) => void;
  clang: (heavy: boolean) => void;
  /**
   * Start looping wind + fire beds (idempotent). Stays silent while muted;
   * resumes when unmuted. No BGM.
   */
  startAmbient: () => void;
  /** Stop ambient beds and clear the wanted flag. */
  stopAmbient: () => void;
  /** Whether ambient beds are wanted (may be ducked by mute). */
  isAmbientOn: () => boolean;
  /**
   * Movement footstep tick. `moving01` 0..1 from locomotion; material-agnostic.
   * Call once per frame with dt seconds.
   */
  footstep: (moving01: number, dt: number) => void;
};

export type GameAudioOptions = {
  /** Inject context for tests; `null` forces silent (no browser ctx). Omit for browser. */
  context?: AudioContext | null;
  /** Start muted (default true — first steel or title toggle opens sound). */
  muted?: boolean;
  /** Factory used when unlock needs a fresh context (browser). */
  createContext?: () => AudioContext;
};

/** Soft bed levels — keep below combat one-shots. */
export const AMBIENT_WIND_GAIN = 0.018;
export const AMBIENT_FIRE_GAIN = 0.022;
/** Footstep cadence (seconds) at walk / full-run `moving01`. */
export const FOOTSTEP_WALK_INTERVAL = 0.42;
export const FOOTSTEP_RUN_INTERVAL = 0.28;
export const FOOTSTEP_MOVE_THRESHOLD = 0.08;

type Bed = {
  src: AudioBufferSourceNode;
  gain: GainNode;
};

function browserContextFactory(): (() => AudioContext) | null {
  try {
    if (typeof window === "undefined") return null;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    return () => new AC();
  } catch {
    return null;
  }
}

function makeLoopNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function createAudio(opts: GameAudioOptions = {}): GameAudio {
  let muted = opts.muted ?? true;
  let ctx: AudioContext | null =
    opts.context === undefined ? null : opts.context;
  const factory = opts.createContext ?? browserContextFactory();

  let ambientWanted = false;
  let wind: Bed | null = null;
  let fire: Bed | null = null;
  let stepAcc = 0;

  function unlock(): void {
    if (ctx) {
      void ctx.resume();
      return;
    }
    if (opts.context === null) return;
    if (!factory) return;
    try {
      ctx = factory();
      void ctx.resume();
    } catch {
      ctx = null;
    }
  }

  function tone(freq: number, dur: number, type: ToneType, gain: number): void {
    if (muted || !ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.45), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(dur: number, gain: number): void {
    if (muted || !ctx) return;
    const t0 = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t0);
  }

  function clang(heavy: boolean): void {
    noise(heavy ? 0.09 : 0.05, heavy ? 0.2 : 0.12);
    tone(heavy ? 168 : 246, heavy ? 0.14 : 0.08, "square", heavy ? 0.07 : 0.05);
    tone(heavy ? 92 : 140, 0.16, "triangle", 0.05);
  }

  function setBedGain(bed: Bed | null, level: number): void {
    if (!bed || !ctx) return;
    const t0 = ctx.currentTime;
    const target = muted || !ambientWanted ? 0.0001 : level;
    bed.gain.gain.setValueAtTime(target, t0);
  }

  function syncAmbientGains(): void {
    setBedGain(wind, AMBIENT_WIND_GAIN);
    setBedGain(fire, AMBIENT_FIRE_GAIN);
  }

  function ensureBeds(): void {
    if (!ctx || wind || fire) {
      if (wind || fire) syncAmbientGains();
      return;
    }
    try {
      const t0 = ctx.currentTime;

      const windBuf = makeLoopNoise(ctx, 2);
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = windBuf;
      windSrc.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.value = 420;
      const windGain = ctx.createGain();
      windGain.gain.setValueAtTime(0.0001, t0);
      windSrc.connect(windFilter).connect(windGain).connect(ctx.destination);
      windSrc.start(t0);
      wind = { src: windSrc, gain: windGain };

      const fireBuf = makeLoopNoise(ctx, 1.5);
      const fireSrc = ctx.createBufferSource();
      fireSrc.buffer = fireBuf;
      fireSrc.loop = true;
      const fireFilter = ctx.createBiquadFilter();
      fireFilter.type = "lowpass";
      fireFilter.frequency.value = 380;
      const fireGain = ctx.createGain();
      fireGain.gain.setValueAtTime(0.0001, t0);
      fireSrc.connect(fireFilter).connect(fireGain).connect(ctx.destination);
      fireSrc.start(t0);
      fire = { src: fireSrc, gain: fireGain };

      syncAmbientGains();
    } catch {
      wind = null;
      fire = null;
    }
  }

  function startAmbient(): void {
    ambientWanted = true;
    unlock();
    if (!ctx) return;
    ensureBeds();
    syncAmbientGains();
  }

  function stopAmbient(): void {
    ambientWanted = false;
    if (ctx) {
      const t0 = ctx.currentTime;
      if (wind) wind.gain.gain.setValueAtTime(0.0001, t0);
      if (fire) fire.gain.gain.setValueAtTime(0.0001, t0);
    }
    try {
      wind?.src.stop();
    } catch {
      /* already stopped */
    }
    try {
      fire?.src.stop();
    } catch {
      /* already stopped */
    }
    wind = null;
    fire = null;
  }

  function footstep(moving01: number, dt: number): void {
    if (muted || !ctx || moving01 < FOOTSTEP_MOVE_THRESHOLD || dt <= 0) {
      if (moving01 < FOOTSTEP_MOVE_THRESHOLD) stepAcc = 0;
      return;
    }
    const m = Math.max(0, Math.min(1, moving01));
    const interval =
      FOOTSTEP_WALK_INTERVAL + (FOOTSTEP_RUN_INTERVAL - FOOTSTEP_WALK_INTERVAL) * m;
    stepAcc += dt;
    if (stepAcc < interval) return;
    stepAcc = 0;
    // Material-agnostic soft thump — surface variants deferred.
    noise(0.035, 0.02 + 0.02 * m);
    tone(85 + m * 35, 0.045, "sine", 0.018 + 0.01 * m);
  }

  function setMuted(next: boolean): void {
    muted = next;
    syncAmbientGains();
  }

  function toggleMute(): boolean {
    muted = !muted;
    if (!muted) {
      unlock();
      tone(220, 0.12, "sine", 0.04);
      if (ambientWanted) ensureBeds();
    }
    syncAmbientGains();
    return muted;
  }

  return {
    isMuted: () => muted,
    setMuted,
    toggleMute,
    unlock,
    tone,
    noise,
    clang,
    startAmbient,
    stopAmbient,
    isAmbientOn: () => ambientWanted,
    footstep,
  };
}
