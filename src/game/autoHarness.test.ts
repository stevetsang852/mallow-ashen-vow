import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createHarnessSession,
  HARNESS_RECENT_WINDOW,
  HARNESS_REGRESSION_SEED,
  mulberry32,
  runFixedSeedRegression,
} from "./autoHarness.ts";

describe("createHarnessSession summary", () => {
  it("tracks winRate and longer recentWinRate window", () => {
    const h = createHarnessSession();
    h.setEnabled(true);
    // 10 early losses, then 20 wins → overall 20/30; recent 24 = 4L + 20W = 20/24
    for (let i = 0; i < 10; i++) h.endRun("loss", 1000 + i * 100);
    for (let i = 0; i < 20; i++) h.endRun("win", 3000 + i * 100);
    const s = h.summary();
    assert.equal(s.runs, 30);
    assert.equal(s.wins, 20);
    assert.equal(s.losses, 10);
    assert.equal(s.winRate, Math.round((20 / 30) * 1000) / 1000);
    assert.equal(s.recentWindow, HARNESS_RECENT_WINDOW);
    assert.equal(HARNESS_RECENT_WINDOW, 24);
    assert.equal(s.recentWinRate, Math.round((20 / 24) * 1000) / 1000);
    assert.ok(s.avgMs != null && s.avgMs > 0);
  });

  it("winRate null when no finished runs", () => {
    const h = createHarnessSession();
    const s = h.summary();
    assert.equal(s.winRate, null);
    assert.equal(s.recentWinRate, null);
  });
});

describe("fixed-seed harness regression", () => {
  it("mulberry32 is deterministic", () => {
    const a = mulberry32(0x1234);
    const b = mulberry32(0x1234);
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  });

  it("runFixedSeedRegression is stable for default seed", () => {
    const r1 = runFixedSeedRegression(HARNESS_REGRESSION_SEED, 48);
    const r2 = runFixedSeedRegression(HARNESS_REGRESSION_SEED, 48);
    assert.equal(r1.seed, HARNESS_REGRESSION_SEED);
    assert.equal(r1.runs, 48);
    assert.equal(r1.recentWindow, 24);
    assert.equal(r1.winRate, r2.winRate);
    assert.equal(r1.recentWinRate, r2.recentWinRate);
    assert.equal(r1.decideFingerprint, r2.decideFingerprint);
    assert.ok(r1.decideFingerprint.includes("dodge"));
    assert.ok(r1.wins + r1.losses === 48);
  });
});
