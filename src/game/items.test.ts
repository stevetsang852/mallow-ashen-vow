import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXPLOSIVE_AOE_RADIUS,
  EXPLOSIVE_DAMAGE,
  HEAL_HERB_AMOUNT,
  HOTBAR_SLOT_COUNT,
  HOTBAR_SLOTS,
  ITEM_INTERACT_RANGE,
  ITEM_LABEL,
  ITEMS_ENABLED,
  TORCH_DEMON_DAMAGE_MUL,
  applyExplosiveAoe,
  applyHealHerb,
  applyTorchDemonBonus,
  clampHotbarSelected,
  defaultWorldPickups,
  emptyInventory,
  findNearestPickup,
  hasItem,
  hotbarFilledFlags,
  hotbarItemAt,
  hotbarUseKind,
  inInteractRange,
  isHotbarSlotFilled,
  ownedLabels,
  resetItems,
  tryCollectNearest,
  tryConsumeExplosive,
  tryConsumeHealHerb,
} from "./items.ts";

/**
 * 0.8.18 disabled items (ITEMS_ENABLED = false).
 * Tests assert the disabled contract AND keep the enabled-path assertions
 * gated behind `ITEMS_ENABLED` so they automatically re-engage when items turn back on.
 */
describe("defaultWorldPickups", () => {
  it("places ash-token, flask-shard, torch, explosive, and healHerb as active stubs", () => {
    const list = defaultWorldPickups();
    if (!ITEMS_ENABLED) {
      // disabled: no world markers
      assert.deepEqual(list, []);
      return;
    }
    assert.equal(list.length, 5);
    assert.equal(list[0]!.id, "ash-token");
    assert.equal(list[1]!.id, "flask-shard");
    assert.equal(list[2]!.id, "torch");
    assert.equal(list[3]!.id, "explosive");
    assert.equal(list[4]!.id, "healHerb");
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
    if (!ITEMS_ENABLED) {
      // disabled: collect is gated, returns null, inventory untouched
      assert.equal(tryCollectNearest(0, 0, pickups, inv), null);
      assert.deepEqual(inv, emptyInventory());
      return;
    }
    const target = pickups[0]!;
    const got = tryCollectNearest(target.x, target.z, pickups, inv);
    assert.equal(got, "ash-token");
    assert.equal(hasItem(inv, "ash-token"), true);
    assert.equal(hasItem(inv, "flask-shard"), false);
    assert.equal(hasItem(inv, "torch"), false);
    assert.equal(hasItem(inv, "explosive"), false);
    assert.equal(hasItem(inv, "healHerb"), false);
    assert.equal(target.active, false);
    assert.equal(tryCollectNearest(target.x, target.z, pickups, inv), null);
  });

  it("collects torch into inventory", () => {
    if (!ITEMS_ENABLED) {
      const inv = emptyInventory();
      assert.equal(tryCollectNearest(-3.1, 0.2, defaultWorldPickups(), inv), null);
      assert.equal(hasItem(inv, "torch"), false);
      return;
    }
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
    if (!ITEMS_ENABLED) {
      const inv = emptyInventory();
      assert.equal(tryCollectNearest(0.35, 3.55, defaultWorldPickups(), inv), null);
      assert.equal(hasItem(inv, "explosive"), false);
      return;
    }
    const pickups = defaultWorldPickups();
    const inv = emptyInventory();
    const bomb = pickups.find((p) => p.id === "explosive")!;
    const got = tryCollectNearest(bomb.x, bomb.z, pickups, inv);
    assert.equal(got, "explosive");
    assert.equal(hasItem(inv, "explosive"), true);
    assert.equal(bomb.active, false);
    assert.ok(ownedLabels(inv).includes("炸藥"));
  });

  it("collects healHerb into inventory", () => {
    if (!ITEMS_ENABLED) {
      const inv = emptyInventory();
      assert.equal(tryCollectNearest(0.35, 3.55, defaultWorldPickups(), inv), null);
      assert.equal(hasItem(inv, "healHerb"), false);
      return;
    }
    const pickups = defaultWorldPickups();
    const inv = emptyInventory();
    const herb = pickups.find((p) => p.id === "healHerb")!;
    const got = tryCollectNearest(herb.x, herb.z, pickups, inv);
    assert.equal(got, "healHerb");
    assert.equal(hasItem(inv, "healHerb"), true);
    assert.equal(herb.active, false);
    assert.ok(ownedLabels(inv).includes("恢復藥草"));
  });

  it("resetItems restores markers and clears flags including torch, explosive, and healHerb", () => {
    const pickups = defaultWorldPickups();
    const inv = emptyInventory();
    if (!ITEMS_ENABLED) {
      // disabled: reset still clears inventory flags; marker list stays empty
      inv["ash-token"] = true;
      inv["flask-shard"] = true;
      inv.torch = true;
      inv.explosive = true;
      inv.healHerb = true;
      resetItems(pickups, inv);
      assert.ok(pickups.length === 0);
      assert.equal(hasItem(inv, "ash-token"), false);
      assert.equal(hasItem(inv, "flask-shard"), false);
      assert.equal(hasItem(inv, "torch"), false);
      assert.equal(hasItem(inv, "explosive"), false);
      assert.equal(hasItem(inv, "healHerb"), false);
      return;
    }
    for (const p of pickups) {
      tryCollectNearest(p.x, p.z, pickups, inv);
    }
    assert.deepEqual(
      ownedLabels(inv).sort(),
      ["灰徽", "瓶碎片", "火炬", "炸藥", "恢復藥草"].sort(),
    );
    resetItems(pickups, inv);
    assert.ok(pickups.every((p) => p.active));
    assert.equal(hasItem(inv, "ash-token"), false);
    assert.equal(hasItem(inv, "flask-shard"), false);
    assert.equal(hasItem(inv, "torch"), false);
    assert.equal(hasItem(inv, "explosive"), false);
    assert.equal(hasItem(inv, "healHerb"), false);
  });
});

describe("ITEM_LABEL", () => {
  it("names stub items including torch, explosive, and healHerb", () => {
    assert.equal(ITEM_LABEL["ash-token"], "灰徽");
    assert.equal(ITEM_LABEL["flask-shard"], "瓶碎片");
    assert.equal(ITEM_LABEL.torch, "火炬");
    assert.equal(ITEM_LABEL.explosive, "炸藥");
    assert.equal(ITEM_LABEL.healHerb, "恢復藥草");
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
    if (!ITEMS_ENABLED) {
      // disabled: consume is gated, flag stays set but cannot be consumed
      assert.equal(tryConsumeExplosive(inv), false);
      assert.equal(inv.explosive, true);
      return;
    }
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

describe("tryConsumeHealHerb / applyHealHerb", () => {
  it("consumes the inventory flag once", () => {
    const inv = emptyInventory();
    assert.equal(tryConsumeHealHerb(inv), false);
    inv.healHerb = true;
    if (!ITEMS_ENABLED) {
      // disabled: consume is gated, flag stays set but cannot be consumed
      assert.equal(tryConsumeHealHerb(inv), false);
      assert.equal(inv.healHerb, true);
      return;
    }
    assert.equal(tryConsumeHealHerb(inv), true);
    assert.equal(inv.healHerb, false);
    assert.equal(tryConsumeHealHerb(inv), false);
  });

  it("restores HEAL_HERB_AMOUNT and clamps to hpMax", () => {
    assert.equal(HEAL_HERB_AMOUNT, 40);
    assert.equal(applyHealHerb(50, 100), 90);
    assert.equal(applyHealHerb(80, 100), 100);
    assert.equal(applyHealHerb(100, 100), 100);
    assert.equal(applyHealHerb(10, 100, 25), 35);
  });
});

describe("hotbar 0.8.15", () => {
  it("maps slots 1–4 to torch / explosive / healHerb / flask-shard", () => {
    assert.equal(HOTBAR_SLOT_COUNT, 4);
    assert.deepEqual([...HOTBAR_SLOTS], ["torch", "explosive", "healHerb", "flask-shard"]);
    assert.equal(hotbarItemAt(0), "torch");
    assert.equal(hotbarItemAt(1), "explosive");
    assert.equal(hotbarItemAt(2), "healHerb");
    assert.equal(hotbarItemAt(3), "flask-shard");
    assert.equal(hotbarItemAt(-1), null);
    assert.equal(hotbarItemAt(4), null);
  });

  it("clamps selection and reports filled / use kinds from inventory", () => {
    assert.equal(clampHotbarSelected(-2), 0);
    assert.equal(clampHotbarSelected(1.9), 1);
    assert.equal(clampHotbarSelected(99), 3);
    const inv = emptyInventory();
    assert.deepEqual(hotbarFilledFlags(inv), [false, false, false, false]);
    // hotbarUseKind returns null when ITEMS_ENABLED=false (0.8.18) — re-enable items to unlock these assertions
    if (ITEMS_ENABLED) {
      assert.equal(hotbarUseKind(inv, 0), null);
      inv.torch = true;
      inv.explosive = true;
      inv.healHerb = true;
      inv["flask-shard"] = true;
      assert.equal(isHotbarSlotFilled(inv, 0), true);
      assert.equal(isHotbarSlotFilled(inv, 3), true);
      assert.deepEqual(hotbarFilledFlags(inv), [true, true, true, true]);
      assert.equal(hotbarUseKind(inv, 0), "torch");
      assert.equal(hotbarUseKind(inv, 1), "explosive");
      assert.equal(hotbarUseKind(inv, 2), "healHerb");
      assert.equal(hotbarUseKind(inv, 3), null); // reserved stub — select only
    } else {
      // items disabled — use-kind gated, all slots report null
      inv.torch = true;
      inv.explosive = true;
      inv.healHerb = true;
      inv["flask-shard"] = true;
      assert.equal(hotbarUseKind(inv, 0), null);
      assert.equal(hotbarUseKind(inv, 1), null);
      assert.equal(hotbarUseKind(inv, 2), null);
      assert.equal(hotbarUseKind(inv, 3), null);
      // filled flags still reflect inventory state (independent of ITEMS_ENABLED)
      assert.equal(isHotbarSlotFilled(inv, 0), true);
      assert.equal(isHotbarSlotFilled(inv, 3), true);
      assert.deepEqual(hotbarFilledFlags(inv), [true, true, true, true]);
    }
  });
});
