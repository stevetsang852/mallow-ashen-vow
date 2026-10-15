import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAudio } from "./audio.ts";

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
      setValueAtTime: (v: number, t: number) => record("gain.set", v, t),
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
    connect(next: unknown) {
      record("buf.connect");
      return next as { connect: (d: unknown) => unknown };
    }
    start(t: number) {
      record("buf.start", t);
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
    assert.equal(a.isMuted(), false);
  });
});
