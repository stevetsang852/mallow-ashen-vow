import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chooseDemonIntent,
  chooseDukeMove,
  chooseHollowIntent,
  dukeRecoverSpan,
  dukeSwingSpan,
  shouldDukeCommit,
} from "./ai.ts";

function seq(values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
}

describe("chooseDukeMove", () => {
  it("prefers rush at long range when RNG low", () => {
    const { move } = chooseDukeMove(5.0, false, seq([0.1]));
    assert.equal(move, "rush");
  });

  it("can pick overhead at long range when RNG high", () => {
    const { move } = chooseDukeMove(5.0, false, seq([0.9]));
    assert.equal(move, "overhead");
  });

  it("phase-2 close range can shock", () => {
    const { move } = chooseDukeMove(1.5, true, seq([0.1]));
    assert.equal(move, "shock");
  });

  it("cleave can chain in phase 2", () => {
    // mid range skips shock branch (dist>=2.2); first RNG -> overhead/cleave, second -> chain
    const picked = chooseDukeMove(3.0, true, seq([0.5, 0.5]));
    assert.equal(picked.move, "cleave");
    assert.equal(picked.chain, 1);
  });
});

describe("duke spans", () => {
  it("swing/recover spans stay readable (non-zero)", () => {
    for (const move of ["cleave", "overhead", "shock", "rush"] as const) {
      assert.ok(dukeSwingSpan(move) > 0.1);
      assert.ok(dukeRecoverSpan(move, false, 0) >= 0.2);
    }
    assert.equal(dukeRecoverSpan("cleave", true, 1), 0.2);
  });
});

describe("shouldDukeCommit", () => {
  it("commits when close or far and off cooldown", () => {
    assert.equal(shouldDukeCommit(2.0, 0), true);
    assert.equal(shouldDukeCommit(5.0, 0), true);
    assert.equal(shouldDukeCommit(3.5, 0), false);
    assert.equal(shouldDukeCommit(2.0, 0.5), false);
  });
});

describe("chooseHollowIntent", () => {
  it("telegraphs in range off cooldown", () => {
    assert.equal(chooseHollowIntent(1.4, 1.55, 0), "telegraph");
  });
  it("chases outside soft range", () => {
    assert.equal(chooseHollowIntent(2.0, 1.55, 0), "chase");
  });
  it("holds in soft band on cooldown", () => {
    assert.equal(chooseHollowIntent(1.2, 1.55, 0.5), "hold");
  });
});

describe("chooseDemonIntent", () => {
  const base = {
    dist: 2.5,
    cd: 0,
    hp: 100,
    hpMax: 150,
    chain: 1,
    threatened: false,
    t: 0,
  };

  it("dodges when threatened", () => {
    const intent = chooseDemonIntent({ ...base, threatened: true, dist: 2.0 });
    assert.equal(intent.type, "dodge");
  });

  it("drinks when low hp with chain charge", () => {
    const intent = chooseDemonIntent({ ...base, hp: 40, dist: 2.5 });
    assert.equal(intent.type, "drink");
  });

  it("cleaves in melee", () => {
    const intent = chooseDemonIntent({ ...base, chain: 0, dist: 1.8 });
    assert.deepEqual(intent, { type: "telegraph", move: "cleave", span: 0.38 });
  });

  it("rushes at mid-far range", () => {
    const intent = chooseDemonIntent({ ...base, chain: 0, dist: 4.0 });
    assert.deepEqual(intent, { type: "telegraph", move: "rush", span: 0.42 });
  });

  it("chases otherwise", () => {
    const intent = chooseDemonIntent({ ...base, chain: 0, dist: 2.5, cd: 0.5 });
    assert.equal(intent.type, "chase");
  });
});
