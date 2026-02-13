import { describe, test, expect } from "bun:test";
import { TileCycleAnimation } from "../TileCycleAnimation.ts";
import type { AnimationOverrides } from "../types.ts";

describe("TileCycleAnimation", () => {
  describe("construction", () => {
    test("starts at frame 0", () => {
      // (0,0) has phase offset 0
      const anim = new TileCycleAnimation(0, 0, ["a", "b"]);
      expect(anim.currentFrame).toBe(0);
    });

    test("is never finished (cyclic animation)", () => {
      const anim = new TileCycleAnimation(0, 0, ["a", "b"]);
      expect(anim.finished).toBe(false);
      anim.update(10000);
      expect(anim.finished).toBe(false);
    });
  });

  describe("frame cycling", () => {
    test("cycles through frames at default 600ms interval", () => {
      const frames = ["a", "b", "c"];
      const anim = new TileCycleAnimation(0, 0, frames);
      const overrides: AnimationOverrides = new Map();

      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("a");

      anim.update(600);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("b");

      anim.update(600);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("c");

      anim.update(600);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("a");
    });

    test("respects custom interval", () => {
      const anim = new TileCycleAnimation(0, 0, ["a", "b"], 300);

      anim.update(300);
      expect(anim.currentFrame).toBe(1);

      anim.update(300);
      expect(anim.currentFrame).toBe(0);
    });

    test("does not advance before interval elapses", () => {
      const anim = new TileCycleAnimation(0, 0, ["a", "b"], 600);
      anim.update(400);
      expect(anim.currentFrame).toBe(0);
    });

    test("accumulates partial time across updates", () => {
      const anim = new TileCycleAnimation(0, 0, ["a", "b"], 600);
      anim.update(200);
      anim.update(200);
      anim.update(200);
      expect(anim.currentFrame).toBe(1);
    });
  });

  describe("phase offset", () => {
    test("position (0,0) has zero phase offset", () => {
      const anim = new TileCycleAnimation(0, 0, ["a", "b"]);
      expect(anim.currentTimer).toBe(0);
    });

    test("different positions get different phase offsets", () => {
      const anim1 = new TileCycleAnimation(0, 0, ["a", "b"], 600);
      const anim2 = new TileCycleAnimation(2, 3, ["a", "b"], 600);

      // (2,3): offset = ((2*7 + 3*13) % 5) * (600/5) = ((14+39) % 5) * 120 = (53%5)*120 = 3*120 = 360
      expect(anim1.currentTimer).toBe(0);
      expect(anim2.currentTimer).toBe(360);
    });

    test("same position produces same phase offset", () => {
      const anim1 = new TileCycleAnimation(4, 7, ["a"], 600);
      const anim2 = new TileCycleAnimation(4, 7, ["a"], 600);
      expect(anim1.currentTimer).toBe(anim2.currentTimer);
    });

    test("all phase offsets are within [0, interval)", () => {
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
          const anim = new TileCycleAnimation(x, y, ["a"], 600);
          expect(anim.currentTimer).toBeGreaterThanOrEqual(0);
          expect(anim.currentTimer).toBeLessThan(600);
        }
      }
    });
  });

  describe("applyOverrides", () => {
    test("writes to correct coordinate key", () => {
      const anim = new TileCycleAnimation(5, 9, ["x"]);
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      expect(overrides.has("5,9")).toBe(true);
      expect(overrides.size).toBe(1);
    });

    test("only overrides char", () => {
      const anim = new TileCycleAnimation(0, 0, ["z"]);
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      const cell = overrides.get("0,0")!;
      expect(cell.char).toBe("z");
      expect(cell.fg).toBeUndefined();
      expect(cell.bg).toBeUndefined();
      expect(cell.bold).toBeUndefined();
      expect(cell.dim).toBeUndefined();
    });
  });
});
