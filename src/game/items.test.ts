import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ITEM_INTERACT_RANGE,
  ITEM_LABEL,
  TORCH_DEMON_DAMAGE_MUL,
  applyTorchDemonBonus,
  defaultWorldPickups,
  emptyInventory,
  findNearestPickup,
  hasItem,
  inInteractRange,
  ownedLabels,
  resetItems,
  tryCollectNearest,
} from "./items.ts";

describe("defaultWorldPickups", () => {
  it("places ash-token, flask-shard, and torch as active stubs", () => {
    const list = defaultWorldPickups();
    assert.equal(list.length, 3);
    assert.equal(list[0]!.id, "ash-token");
    assert.equal(list[1]!.id, "flask-shard");
    assert.equal(list[2]!.id, "torch");
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

  it("resetItems restores markers and clears flags including torch", () => {
    const pickups = defaultWorldPickups();
    const inv = emptyInventory();
    tryCollectNearest(pickups[0]!.x, pickups[0]!.z, pickups, inv);
    tryCollectNearest(pickups[1]!.x, pickups[1]!.z, pickups, inv);
    tryCollectNearest(pickups[2]!.x, pickups[2]!.z, pickups, inv);
    assert.deepEqual(ownedLabels(inv).sort(), ["灰徽", "瓶碎片", "火炬"].sort());
    resetItems(pickups, inv);
    assert.ok(pickups.every((p) => p.active));
    assert.equal(hasItem(inv, "ash-token"), false);
    assert.equal(hasItem(inv, "flask-shard"), false);
    assert.equal(hasItem(inv, "torch"), false);
  });
});

describe("ITEM_LABEL", () => {
  it("names stub items including torch", () => {
    assert.equal(ITEM_LABEL["ash-token"], "灰徽");
    assert.equal(ITEM_LABEL["flask-shard"], "瓶碎片");
    assert.equal(ITEM_LABEL.torch, "火炬");
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
