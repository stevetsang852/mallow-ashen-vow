import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLIP_IDS, CLIP_CONTRACTS, createClipMixer, cueFromClip } from "./clips";
import { PREVIS_VFX_HOOKS } from "./vfxHooks";

describe("greybox AnimationMixer clips", () => {
  it("seeks every storyboard clip through a mixer", () => {
    const rig = createClipMixer();
    try {
      for (const id of CLIP_IDS) {
        const contract = CLIP_CONTRACTS[id];
        assert.equal(contract.id, id);
        rig.apply([{ id, time: contract.seconds * 0.5, loop: contract.loop }]);
      }
      rig.apply([{ id: "mallow_atk_light", time: 0.12, loop: false }]);
      const wind = rig.proxies.mallow.position.x;
      rig.apply([{ id: "mallow_atk_light", time: 0.27, loop: false }]);
      const hit = rig.proxies.mallow.position.x;
      assert.ok(Math.abs(hit - wind) > 0.4, `sword ${wind} -> ${hit}`);

      rig.apply([{ id: "duke_charge", time: 0.2, loop: false }]);
      const lean = rig.proxies.duke.position.z;
      rig.apply([{ id: "duke_charge", time: 1.4, loop: false }]);
      const rush = rig.proxies.duke.position.z;
      assert.ok(rush < lean - 2, `duke z ${lean} -> ${rush}`);

      assert.equal(cueFromClip("mallow_atk_heavy", 0.2)?.kind, "orange");
      assert.equal(cueFromClip("mallow_roll", 0.4)?.kind, "white");
      assert.equal(cueFromClip("red_intrude", 0)?.kind ?? "none", "none");
    } finally {
      rig.dispose();
    }
  });

  it("leaves particle hooks as names for Graphics", () => {
    assert.deepEqual(
      [...PREVIS_VFX_HOOKS],
      [
        "steel_points_on_hit",
        "pink_burst_on_heavy",
        "dust_on_roll",
        "ash_on_death",
        "red_flame_on_intrude",
      ],
    );
  });
});
