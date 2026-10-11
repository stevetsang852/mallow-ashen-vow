import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createPlayerLearner,
  evalToyPolicy,
  featureState,
  runToyLearning,
  toyFeatureCtx,
} from "./playerLearner.ts";

function rng(seed = 0xc0ffee) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe("featureState", () => {
  it("buckets danger near foe", () => {
    const { key, foe, dist } = featureState(
      toyFeatureCtx({ foeState: "telegraph", dist: 1.8, playerHp: 80, playerAct: "free" }),
    );
    assert.ok(foe);
    assert.ok(dist < 2);
    assert.match(key, /hollow\|danger\|near\|ok\|cleave\|f1/);
  });

  it("buckets punish recover", () => {
    const { key } = featureState(
      toyFeatureCtx({ foeState: "recover", dist: 1.5, playerHp: 40, playerAct: "free" }),
    );
    assert.match(key, /hollow\|punish\|near\|low\|-\|f1/);
  });
});

describe("playerLearner update", () => {
  it("raises Q for rewarded action", () => {
    const learner = createPlayerLearner({ persist: false, seedPriors: false, epsilon: 0 });
    const before = learner.getQ("hollow|danger|near|ok|cleave|f1", "dodge_r");
    learner.forceUpdate("hollow|danger|near|ok|cleave|f1", "dodge_r", 1.0, null, true);
    const after = learner.getQ("hollow|danger|near|ok|cleave|f1", "dodge_r");
    assert.ok(after > before);
  });

  it("decide dodges or retreats during telegraph when prior/Q prefers it", () => {
    const learner = createPlayerLearner({ persist: false, seedPriors: true, epsilon: 0 });
    const action = learner.decide(
      toyFeatureCtx({ foeState: "telegraph", dist: 2.2, playerHp: 80, playerAct: "free" }),
      0.016,
    );
    assert.ok(action.type === "dodge" || action.type === "move", action.type);
  });

  it("endEpisode tracks wins and decays epsilon", () => {
    const learner = createPlayerLearner({
      persist: false,
      seedPriors: false,
      epsilon: 0.5,
      epsilonDecay: 0.9,
      epsilonMin: 0.05,
    });
    learner.decide(
      toyFeatureCtx({ foeState: "recover", dist: 1.5, playerHp: 80, playerAct: "free" }),
      0.016,
    );
    learner.noteFeel({ kind: "hit", t: 1, amount: 18 });
    learner.endEpisode("win");
    const s = learner.summary();
    assert.equal(s.wins, 1);
    assert.equal(s.episodes, 1);
    assert.ok(s.epsilon < 0.5);
  });

  it("reset clears policy stats", () => {
    const learner = createPlayerLearner({ persist: false, seedPriors: false });
    learner.endEpisode("loss");
    learner.reset();
    const s = learner.summary();
    assert.equal(s.episodes, 0);
    assert.equal(s.wins, 0);
    assert.equal(s.losses, 0);
  });
});

describe("runToyLearning", () => {
  it("improves second-half wins and beats random greedy eval", () => {
    const random = rng(0xbad5eed);
    const result = runToyLearning(120, { random, persist: false, seedPriors: false });
    assert.ok(
      result.secondHalfWins >= result.firstHalfWins,
      `expected secondHalfWins (${result.secondHalfWins}) >= firstHalfWins (${result.firstHalfWins}); total ${result.totalWins}W/${result.totalLosses}L`,
    );
    assert.ok(result.totalWins >= 5, `expected some wins, got ${result.totalWins}`);

    // Trained greedy should beat a fresh pure-random policy on the same toy.
    const greedyWins = evalToyPolicy(result.learner, 40, 0);
    const randomLearner = createPlayerLearner({
      persist: false,
      seedPriors: false,
      epsilon: 1,
      random: rng(0x1234567),
    });
    const randomWins = evalToyPolicy(randomLearner, 40, 1);
    assert.ok(
      greedyWins > randomWins,
      `trained greedy (${greedyWins}/40) should beat random (${randomWins}/40)`,
    );

    const dodgeL = result.learner.getQ("hollow|danger|mid|ok|cleave|f1", "dodge_l");
    const dodgeR = result.learner.getQ("hollow|danger|mid|ok|cleave|f1", "dodge_r");
    const attackL = result.learner.getQ("hollow|danger|mid|ok|cleave|f1", "attack_l");
    assert.ok(
      Math.max(dodgeL, dodgeR, result.learner.getQ("hollow|danger|mid|ok|cleave|f1", "retreat")) >
        attackL - 0.01,
      `defense Q should dominate attack_l (${attackL}); dodge ${dodgeL}/${dodgeR}`,
    );
  });
});
