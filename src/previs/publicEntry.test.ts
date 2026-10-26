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

  it("keeps combat modules out of the previs player", () => {
    const previs = ["src/previs/createPrevis.ts", "src/previs/shot.ts", "src/previs/clips.ts"]
      .map((path) => source(path))
      .join("\n");
    const imports = previs
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line))
      .join("\n");
    assert.doesNotMatch(imports, /combatFeel|createGame2D|createGame\b|\/ai["']|\/moves["']/);
    assert.doesNotMatch(imports, /theatre|seedance|cozyclay/i);
    assert.match(previs, /mallow_atk_light/);
    assert.match(previs, /orange-telegraph/);
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
