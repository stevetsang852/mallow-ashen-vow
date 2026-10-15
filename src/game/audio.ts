/** WebAudio combat SFX for Mallow. Ambient / footsteps deferred — do not invent beds here. */

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
  // TODO(ambient): wind / fire bed — not in 0.7.5
  // TODO(footsteps): surface-aware steps — not in 0.7.5
};

export type GameAudioOptions = {
  /** Inject context for tests; `null` forces silent (no browser ctx). Omit for browser. */
  context?: AudioContext | null;
  /** Start muted (default true — first steel or title toggle opens sound). */
  muted?: boolean;
  /** Factory used when unlock needs a fresh context (browser). */
  createContext?: () => AudioContext;
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

export function createAudio(opts: GameAudioOptions = {}): GameAudio {
  let muted = opts.muted ?? true;
  let ctx: AudioContext | null =
    opts.context === undefined ? null : opts.context;
  const factory = opts.createContext ?? browserContextFactory();

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

  function setMuted(next: boolean): void {
    muted = next;
  }

  function toggleMute(): boolean {
    muted = !muted;
    if (!muted) {
      unlock();
      tone(220, 0.12, "sine", 0.04);
    }
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
  };
}
