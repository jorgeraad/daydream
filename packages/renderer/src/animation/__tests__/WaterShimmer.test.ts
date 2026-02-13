import { describe, test, expect } from "bun:test";
import { WaterShimmer } from "../WaterShimmer.ts";
import type { AnimationOverrides } from "../types.ts";

describe("WaterShimmer", () => {
  describe("construction", () => {
    test("uses provided frames", () => {
      const anim = new WaterShimmer(0, 0, ["a", "b", "c"]);
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("a");
    });

    test("uses default water frames when none provided", () => {
      const anim = new WaterShimmer(0, 0);
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      const char = overrides.get("0,0")?.char ?? "";
      expect(["~", "\u2248", "\u223C"]).toContain(char);
    });

    test("uses default water frames when empty array provided", () => {
      const anim = new WaterShimmer(0, 0, []);
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      const char = overrides.get("0,0")?.char ?? "";
      expect(["~", "\u2248", "\u223C"]).toContain(char);
    });

    test("is never finished (cyclic animation)", () => {
      const anim = new WaterShimmer(0, 0, ["~", "\u2248"]);
      expect(anim.finished).toBe(false);
      anim.update(10000);
      expect(anim.finished).toBe(false);
    });
  });

  describe("frame cycling", () => {
    test("cycles through frames at the specified interval", () => {
      const frames = ["a", "b", "c"];
      // Use position (0,0) which has phase offset 0
      const anim = new WaterShimmer(0, 0, frames, 600);

      const overrides: AnimationOverrides = new Map();

      // Initial frame (after clearing phase offset timer)
      // At (0,0): phase offset = ((0*7 + 0*13) % 5) * (600/5) = 0
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("a");

      // Advance past one interval
      anim.update(600);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("b");

      // Advance past another interval
      anim.update(600);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("c");

      // Wraps back to first frame
      anim.update(600);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("a");
    });

    test("does not advance frame before interval elapses", () => {
      const frames = ["a", "b"];
      const anim = new WaterShimmer(0, 0, frames, 600);

      // Advance less than one interval
      anim.update(300);
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("a");
    });

    test("accumulates partial time across multiple updates", () => {
      const frames = ["a", "b"];
      const anim = new WaterShimmer(0, 0, frames, 600);

      // Three partial updates totaling 600ms
      anim.update(200);
      anim.update(200);
      anim.update(200);

      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("b");
    });
  });

  describe("phase offset", () => {
    test("different positions get different phase offsets", () => {
      const frames = ["a", "b", "c"];
      const anim1 = new WaterShimmer(0, 0, frames, 600);
      const anim2 = new WaterShimmer(1, 0, frames, 600);

      // (0,0): offset = ((0*7 + 0*13) % 5) * (600/5) = 0
      // (1,0): offset = ((1*7 + 0*13) % 5) * (600/5) = (7%5) * 120 = 2 * 120 = 240
      expect(anim1.currentTimer).toBe(0);
      expect(anim2.currentTimer).toBe(240);
    });

    test("phase offset is deterministic for the same position", () => {
      const frames = ["a", "b"];
      const anim1 = new WaterShimmer(5, 3, frames, 600);
      const anim2 = new WaterShimmer(5, 3, frames, 600);

      expect(anim1.currentTimer).toBe(anim2.currentTimer);
    });

    test("phase offset causes different tiles to show different frames", () => {
      const frames = ["a", "b", "c"];
      // Create two animations with different phase offsets
      const anim1 = new WaterShimmer(0, 0, frames, 600); // offset 0
      const anim2 = new WaterShimmer(1, 0, frames, 600); // offset 240

      // After some time, they should be at different timer positions
      anim1.update(300);
      anim2.update(300);

      // anim1 timer: 0 + 300 = 300 (still frame 0)
      // anim2 timer: 240 + 300 = 540 (still frame 0, but close to advancing)
      const o1: AnimationOverrides = new Map();
      const o2: AnimationOverrides = new Map();
      anim1.applyOverrides(o1);
      anim2.applyOverrides(o2);

      // After a bit more, anim2 should advance first
      anim1.update(100);
      anim2.update(100);
      // anim1 timer: 400, anim2 timer: 640 → advanced to frame 1 (timer = 40)

      o1.clear();
      o2.clear();
      anim1.applyOverrides(o1);
      anim2.applyOverrides(o2);

      expect(o1.get("0,0")?.char).toBe("a");
      expect(o2.get("1,0")?.char).toBe("b");
    });

    test("phase offset wraps within 5 buckets", () => {
      const frames = ["a", "b"];
      // All offsets should be in [0, interval)
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
          const anim = new WaterShimmer(x, y, frames, 600);
          expect(anim.currentTimer).toBeGreaterThanOrEqual(0);
          expect(anim.currentTimer).toBeLessThan(600);
        }
      }
    });
  });

  describe("applyOverrides", () => {
    test("writes to correct coordinate key", () => {
      const anim = new WaterShimmer(7, 12, ["x"]);
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      expect(overrides.has("7,12")).toBe(true);
      expect(overrides.size).toBe(1);
    });

    test("only overrides char, not fg/bg/bold/dim", () => {
      const anim = new WaterShimmer(0, 0, ["~"]);
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      const cell = overrides.get("0,0")!;
      expect(cell.char).toBe("~");
      expect(cell.fg).toBeUndefined();
      expect(cell.bg).toBeUndefined();
      expect(cell.bold).toBeUndefined();
      expect(cell.dim).toBeUndefined();
    });
  });
});
