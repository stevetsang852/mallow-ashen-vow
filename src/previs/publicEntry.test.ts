import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("public entry", () => {
  it("does not import gameplay from the default route", () => {
    const index = source("src/routes/index.tsx");
    assert.doesNotMatch(index, /createGame2D/);
    assert.doesNotMatch(index, /from ["']@\/game\//);
    assert.doesNotMatch(index, /import\(["']@\/_hidden/);
    assert.doesNotMatch(index, /from ["']@\/_hidden/);
    assert.match(index, /PrevisStage/);
    assert.match(index, /\?game=1|search\.game/);
  });

  it("loads the hidden shell only from the gated route", () => {
    const play = source("src/routes/play.tsx");
    assert.match(play, /import\("@\/_hidden\/gameHome"\)/);
    assert.doesNotMatch(play, /from "@\/_hidden\/gameHome"/);
    assert.equal(play.includes("createGame2D"), false);
    const hidden = source("src/_hidden/gameHome.tsx");
    assert.match(hidden, /export function GameHome/);
    assert.match(hidden, /createGame2D/);
    assert.doesNotMatch(hidden, /createFileRoute/);
  });
});
