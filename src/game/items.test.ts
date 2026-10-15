import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXPLOSIVE_AOE_RADIUS,
  EXPLOSIVE_DAMAGE,
  ITEM_INTERACT_RANGE,
  ITEM_LABEL,
  TORCH_DEMON_DAMAGE_MUL,
  applyExplosiveAoe,
  applyTorchDemonBonus,
  defaultWorldPickups,
  emptyInventory,
  findNearestPickup,
  hasItem,
  inInteractRange,
  ownedLabels,
  resetItems,
  tryCollectNearest,
  tryConsumeExplosive,
} from "./items.ts";

describe("defaultWorldPickups", () => {
  it("places ash-token, flask-shard, torch, and explosive as active stubs", () => {
    const list = defaultWorldPickups();
    assert.equal(list.length, 4);
    assert.equal(list[0]!.id, "ash-token");
    assert.equal(list[1]!.id, "flask-shard");
    assert.equal(list[2]!.id, "torch");
    assert.equal(list[3]!.id, "explosive");
    assert.ok(list.every((p) => p.active));
    assert.ok(list.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)));
  });
});

describe("inInteractRange / findNearestPickup", () => {
  it("accepts only active pickups inside ITEM_INTERACT_RANGE", () => {
    const p = { id: "ash-token" as const, x: 0, z: 0, active: true };
    assert.equal(inInteractRange(0, 0, p), true);
    assert.equal(inInteractRange(ITEM_INTERACT_RANGE, 0, p), true);
    assert.equal(inInteractRange(ITEM_INTERACT_RANGE + 0.01, 0, p), false);
    p.active = false;
    assert.equal(inInteractRange(0, 0, p), false);
  });

  it("picks the nearer of two in-range markers", () => {
    const pickups = [
      { id: "ash-token" as const, x: 0, z: 0, active: true },
      { id: "flask-shard" as const, x: 1, z: 0, active: true },
    ];
    const near = findNearestPickup(0.9, 0, pickups);
    assert.equal(near?.id, "flask-shard");
    assert.equal(findNearestPickup(10, 10, pickups), null);
  });
});

describe("tryCollectNearest / inventory flags", () => {
  it("collects, sets flag, and deactivates the world marker", () => {
    const pickups = defaultWorldPickups();
    const inv = emptyInventory();
    const target = pickups[0]!;
    const got = tryCollectNearest(target.x, target.z, pickups, inv);
    assert.equal(got, "ash-token");
    assert.equal(hasItem(inv, "ash-token"), true);
    assert.equal(hasItem(inv, "flask-shard"), false);
    assert.equal(hasItem(inv, "torch"), false);
    assert.equal(hasItem(inv, "explosive"), false);
    assert.equal(target.active, false);
    assert.equal(tryCollectNearest(target.x, target.z, pickups, inv), null);
  });

  it("collects torch into inventory", () => {
    const pickups = defaultWorldPickups();
    const inv = emptyInventory();
    const torch = pickups.find((p) => p.id === "torch")!;
    const got = tryCollectNearest(torch.x, torch.z, pickups, inv);
    assert.equal(got, "torch");
    assert.equal(hasItem(inv, "torch"), true);
    assert.equal(torch.active, false);
    assert.ok(ownedLabels(inv).includes("火炬"));
  });

  it("collects explosive into inventory", () => {
    const pickups = defaultWorldPickups();
    const inv = emptyInventory();
    const bomb = pickups.find((p) => p.id === "explosive")!;
    const got = tryCollectNearest(bomb.x, bomb.z, pickups, inv);
    assert.equal(got, "explosive");
    assert.equal(hasItem(inv, "explosive"), true);
    assert.equal(bomb.active, false);
    assert.ok(ownedLabels(inv).includes("炸藥"));
  });

  it("resetItems restores markers and clears flags including torch and explosive", () => {
    const pickups = defaultWorldPickups();
    const inv = emptyInventory();
    for (const p of pickups) {
      tryCollectNearest(p.x, p.z, pickups, inv);
    }
    assert.deepEqual(
      ownedLabels(inv).sort(),
      ["灰徽", "瓶碎片", "火炬", "炸藥"].sort(),
    );
    resetItems(pickups, inv);
    assert.ok(pickups.every((p) => p.active));
    assert.equal(hasItem(inv, "ash-token"), false);
    assert.equal(hasItem(inv, "flask-shard"), false);
    assert.equal(hasItem(inv, "torch"), false);
    assert.equal(hasItem(inv, "explosive"), false);
  });
});

describe("ITEM_LABEL", () => {
  it("names stub items including torch and explosive", () => {
    assert.equal(ITEM_LABEL["ash-token"], "灰徽");
    assert.equal(ITEM_LABEL["flask-shard"], "瓶碎片");
    assert.equal(ITEM_LABEL.torch, "火炬");
    assert.equal(ITEM_LABEL.explosive, "炸藥");
  });
});

describe("applyTorchDemonBonus", () => {
  it("multiplies damage vs demon only when torch is held", () => {
    assert.equal(applyTorchDemonBonus(20, false, "demon"), 20);
    assert.equal(applyTorchDemonBonus(20, true, "hollow"), 20);
    assert.equal(applyTorchDemonBonus(20, true, "duke"), 20);
    assert.equal(applyTorchDemonBonus(20, true, "demon"), Math.round(20 * TORCH_DEMON_DAMAGE_MUL));
    assert.equal(applyTorchDemonBonus(35, true, "demon"), Math.round(35 * TORCH_DEMON_DAMAGE_MUL));
  });

  it("uses TORCH_DEMON_DAMAGE_MUL of 1.35", () => {
    assert.equal(TORCH_DEMON_DAMAGE_MUL, 1.35);
  });
});

describe("tryConsumeExplosive / applyExplosiveAoe", () => {
  it("consumes the inventory flag once", () => {
    const inv = emptyInventory();
    assert.equal(tryConsumeExplosive(inv), false);
    inv.explosive = true;
    assert.equal(tryConsumeExplosive(inv), true);
    assert.equal(inv.explosive, false);
    assert.equal(tryConsumeExplosive(inv), false);
  });

  it("damages living foes inside EXPLOSIVE_AOE_RADIUS and skips misses / dead", () => {
    assert.equal(EXPLOSIVE_AOE_RADIUS, 3.0);
    assert.equal(EXPLOSIVE_DAMAGE, 50);
    const foes = [
      { x: 0, z: 0, hp: 100, state: "idle" },
      { x: 2.5, z: 0, hp: 80, state: "chase" },
      { x: 4, z: 0, hp: 80, state: "idle" },
      { x: 0.5, z: 0.5, hp: 0, state: "dead" },
    ];
    const hit = applyExplosiveAoe(0, 0, foes);
    assert.equal(hit.length, 2);
    assert.equal(foes[0]!.hp, 50);
    assert.equal(foes[1]!.hp, 30);
    assert.equal(foes[2]!.hp, 80);
    assert.equal(foes[3]!.hp, 0);
  });

  it("clamps hp at zero and returns empty when nothing in range", () => {
    const foes = [{ x: 0.2, z: 0, hp: 20, state: "hurt" }];
    const hit = applyExplosiveAoe(0, 0, foes);
    assert.equal(hit.length, 1);
    assert.equal(foes[0]!.hp, 0);
    assert.deepEqual(applyExplosiveAoe(10, 10, foes), []);
  });
});
