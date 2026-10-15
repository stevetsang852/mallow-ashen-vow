#!/usr/bin/env node
/**
 * Fixed-seed harness regression (0.8.7) + ε schedule / snapshot smoke (0.8.10).
 * Usage: node --import tsx scripts/harness-regression.mjs
 * Does not touch moves damage tables.
 */
import {
  HARNESS_REGRESSION_SEED,
  runFixedSeedRegression,
} from "../src/game/autoHarness.ts";
import {
  createPlayerLearner,
  epsilonAtEpisode,
  DEFAULT_EPSILON_SCHEDULE,
  parseLearnerSnapshot,
} from "../src/game/playerLearner.ts";

const report = runFixedSeedRegression(HARNESS_REGRESSION_SEED, 48);
console.log(JSON.stringify(report, null, 2));
if (!report.decideFingerprint.includes("dodge")) {
  console.error("regression fingerprint missing dodge cue");
  process.exit(1);
}

// 0.8.10: deterministic ε schedule + snapshot round-trip under fixed seed tag
const e0 = epsilonAtEpisode(0, DEFAULT_EPSILON_SCHEDULE);
const eMid = epsilonAtEpisode(40, DEFAULT_EPSILON_SCHEDULE);
const eEnd = epsilonAtEpisode(80, DEFAULT_EPSILON_SCHEDULE);
if (!(e0 > eMid && eMid > eEnd && eEnd === DEFAULT_EPSILON_SCHEDULE.floor)) {
  console.error("epsilon schedule not monotonically decaying to floor", { e0, eMid, eEnd });
  process.exit(1);
}

const learner = createPlayerLearner({
  persist: false,
  seedPriors: false,
  seed: HARNESS_REGRESSION_SEED,
  gameVersion: "0.8.10",
  random: (() => {
    let s = HARNESS_REGRESSION_SEED >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  })(),
});
learner.forceUpdate("hollow|danger|near|ok|cleave|f1", "dodge_r", 0.8, null, true);
learner.endEpisode("win");
const snap = learner.exportSnapshot({ exportedAt: 0 });
const again = createPlayerLearner({ persist: false, seedPriors: false });
again.importSnapshot(parseLearnerSnapshot(JSON.parse(JSON.stringify(snap))));
if (again.summary().episodes !== 1 || again.getQ("hollow|danger|near|ok|cleave|f1", "dodge_r") !== learner.getQ("hollow|danger|near|ok|cleave|f1", "dodge_r")) {
  console.error("learner snapshot round-trip failed");
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      epsilonSchedule: { e0, eMid, eEnd, mode: DEFAULT_EPSILON_SCHEDULE.mode },
      snapshotEpisodes: snap.episodes,
      snapshotSeed: snap.seed,
    },
    null,
    2,
  ),
);
console.log("ok");
