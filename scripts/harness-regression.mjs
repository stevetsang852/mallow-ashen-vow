#!/usr/bin/env node
/**
 * Fixed-seed harness regression (0.8.7).
 * Usage: node --import tsx scripts/harness-regression.mjs
 * Does not touch moves damage tables.
 */
import {
  HARNESS_REGRESSION_SEED,
  runFixedSeedRegression,
} from "../src/game/autoHarness.ts";

const report = runFixedSeedRegression(HARNESS_REGRESSION_SEED, 48);
console.log(JSON.stringify(report, null, 2));
if (!report.decideFingerprint.includes("dodge")) {
  console.error("regression fingerprint missing dodge cue");
  process.exit(1);
}
console.log("ok");
