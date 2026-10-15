import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AMBIENT_FIRE_GAIN,
  AMBIENT_WIND_GAIN,
  createAudio,
  FOOTSTEP_MOVE_THRESHOLD,
  FOOTSTEP_WALK_INTERVAL,
} from "./audio.ts";

type Call = { name: string; args: unknown[] };

/** Minimal AudioContext stand-in that records graph ops for unit tests. */
function mockContext() {
  const calls: Call[] = [];
  const record = (name: string, ...args: unknown[]) => {
    calls.push({ name, args });
  };

  class MockOsc {
    type = "sine";
    frequency = {
      setValueAtTime: (v: number, t: number) => record("freq.set", v, t),
      exponentialRampToValueAtTime: (v: number, t: number) => record("freq.ramp", v, t),
    };
    connect(next: unknown) {
      record("osc.connect");
      return next as { connect: (d: unknown) => unknown };
    }
    start(t: number) {
      record("osc.start", t);
    }
    stop(t: number) {
      record("osc.stop", t);
    }
  }

  class MockGain {
    gain = {
      value: 0,
      setValueAtTime: (v: number, t: number) => {
        this.gain.value = v;
        record("gain.set", v, t);
      },
      exponentialRampToValueAtTime: (v: number, t: number) => record("gain.ramp", v, t),
    };
    connect(next: unknown) {
      record("gain.connect");
      return next;
    }
  }

  class MockFilter {
    type = "lowpass";
    frequency = { value: 0 };
    connect(next: unknown) {
      record("filter.connect");
      return next as { connect: (d: unknown) => unknown };
    }
  }

  class MockBufSrc {
    buffer: AudioBuffer | null = null;
    loop = false;
    connect(next: unknown) {
      record("buf.connect");
      return next as { connect: (d: unknown) => unknown };
    }
    start(t: number) {
      record("buf.start", t);
    }
    stop(t?: number) {
      record("buf.stop", t ?? 0);
    }
  }

  const ctx = {
    currentTime: 1.5,
    sampleRate: 48000,
    destination: {},
    resume: async () => {
      record("resume");
    },
    createOscillator: () => {
      record("createOscillator");
      return new MockOsc() as unknown as OscillatorNode;
    },
    createGain: () => {
      record("createGain");
      return new MockGain() as unknown as GainNode;
    },
    createBiquadFilter: () => {
      record("createBiquadFilter");
      return new MockFilter() as unknown as BiquadFilterNode;
    },
    createBuffer: (ch: number, len: number, rate: number) => {
      record("createBuffer", ch, len, rate);
      const data = new Float32Array(len);
      return {
        getChannelData: () => data,
      } as unknown as AudioBuffer;
    },
    createBufferSource: () => {
      record("createBufferSource");
      return new MockBufSrc() as unknown as AudioBufferSourceNode;
    },
  } as unknown as AudioContext;

  return { ctx, calls };
}

describe("createAudio", () => {
  it("starts muted by default and skips playback", () => {
    const { ctx, calls } = mockContext();
    const a = createAudio({ context: ctx });
    assert.equal(a.isMuted(), true);
    a.tone(220, 0.1, "sine", 0.04);
    a.noise(0.05, 0.1);
    a.clang(false);
    assert.equal(calls.length, 0);
  });

  it("plays tone when unmuted with a context", () => {
    const { ctx, calls } = mockContext();
    const a = createAudio({ context: ctx, muted: false });
    a.tone(246, 0.08, "square", 0.05);
    assert.ok(calls.some((c) => c.name === "createOscillator"));
    assert.ok(calls.some((c) => c.name === "osc.start"));
  });

  it("clang stacks noise + two tones", () => {
    const { ctx, calls } = mockContext();
    const a = createAudio({ context: ctx, muted: false });
    a.clang(true);
    assert.ok(calls.some((c) => c.name === "createBufferSource"));
    const oscStarts = calls.filter((c) => c.name === "osc.start");
    assert.equal(oscStarts.length, 2);
  });

  it("setMuted alone does not unlock (matches createGame first-steel)", () => {
    let created = 0;
    const a = createAudio({
      muted: true,
      createContext: () => {
        created += 1;
        return mockContext().ctx;
      },
    });
    a.setMuted(false);
    assert.equal(a.isMuted(), false);
    assert.equal(created, 0);
    a.clang(false); // no ctx yet → silent
    assert.equal(created, 0);
  });

  it("toggleMute unlocks and beeps when turning sound on", () => {
    const { ctx, calls } = mockContext();
    let created = 0;
    const a = createAudio({
      muted: true,
      createContext: () => {
        created += 1;
        return ctx;
      },
    });
    const next = a.toggleMute();
    assert.equal(next, false);
    assert.equal(a.isMuted(), false);
    assert.equal(created, 1);
    assert.ok(calls.some((c) => c.name === "resume"));
    assert.ok(calls.some((c) => c.name === "createOscillator"));
  });

  it("null context stays silent even when unmuted", () => {
    const a = createAudio({ context: null, muted: false });
    a.tone(100, 0.1, "sine", 0.05);
    a.unlock();
    a.clang(true);
    a.startAmbient();
    a.footstep(1, 1);
    assert.equal(a.isMuted(), false);
    assert.equal(a.isAmbientOn(), true);
  });

  it("startAmbient loops wind+fire beds and mute ducks them", () => {
    const { ctx, calls } = mockContext();
    const a = createAudio({ context: ctx, muted: false });
    a.startAmbient();
    assert.equal(a.isAmbientOn(), true);
    const bufStarts = calls.filter((c) => c.name === "buf.start");
    assert.ok(bufStarts.length >= 2, "wind + fire loop starts");
    // Unmuted beds should request wind/fire levels at some point
    const levels = calls
      .filter((c) => c.name === "gain.set")
      .map((c) => c.args[0] as number);
    assert.ok(levels.some((v) => Math.abs(v - AMBIENT_WIND_GAIN) < 1e-9));
    assert.ok(levels.some((v) => Math.abs(v - AMBIENT_FIRE_GAIN) < 1e-9));

    const beforeMute = calls.length;
    a.setMuted(true);
    const afterMute = calls.slice(beforeMute).filter((c) => c.name === "gain.set");
    assert.ok(afterMute.some((c) => (c.args[0] as number) <= 0.001));
    // Combat stays silent while muted
    const n = calls.length;
    a.clang(false);
    assert.equal(calls.length, n);
  });

  it("footstep fires after cadence when moving; skips when still or muted", () => {
    const { ctx, calls } = mockContext();
    const a = createAudio({ context: ctx, muted: false });
    a.footstep(0, FOOTSTEP_WALK_INTERVAL);
    assert.equal(calls.filter((c) => c.name === "createBufferSource").length, 0);

    a.footstep(0.5, FOOTSTEP_WALK_INTERVAL);
    assert.ok(calls.some((c) => c.name === "createBufferSource"));
    assert.ok(calls.some((c) => c.name === "createOscillator"));

    const n = calls.length;
    a.setMuted(true);
    a.footstep(1, FOOTSTEP_WALK_INTERVAL);
    assert.equal(calls.length, n);
    assert.ok(FOOTSTEP_MOVE_THRESHOLD > 0);
  });

  it("stopAmbient clears wanted flag and stops beds", () => {
    const { ctx, calls } = mockContext();
    const a = createAudio({ context: ctx, muted: false });
    a.startAmbient();
    a.stopAmbient();
    assert.equal(a.isAmbientOn(), false);
    assert.ok(calls.some((c) => c.name === "buf.stop"));
  });
});
