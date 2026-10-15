import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHarnessSession } from "./autoHarness.ts";

describe("createHarnessSession summary", () => {
  it("tracks winRate and recentWinRate window", () => {
    const h = createHarnessSession();
    h.setEnabled(true);
    for (let i = 0; i < 5; i++) {
      h.endRun(i < 2 ? "win" : "loss", 1000 + i * 100);
    }
    for (let i = 0; i < 5; i++) {
      h.endRun("win", 2000 + i * 100);
    }
    const s = h.summary();
    assert.equal(s.runs, 10);
    assert.equal(s.wins, 7);
    assert.equal(s.losses, 3);
    assert.equal(s.winRate, 0.7);
    // last 8 of 10 = (L L L) + (W W W W W) = 5W/3L → 0.625
    assert.equal(s.recentWinRate, 0.625);
    assert.equal(s.recentWindow, 8);
    assert.ok(s.avgMs != null && s.avgMs > 0);
  });

  it("winRate null when no finished runs", () => {
    const h = createHarnessSession();
    const s = h.summary();
    assert.equal(s.winRate, null);
    assert.equal(s.recentWinRate, null);
  });
});
