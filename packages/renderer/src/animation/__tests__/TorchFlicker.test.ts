import { describe, test, expect } from "bun:test";
import { TorchFlicker } from "../TorchFlicker.ts";
import type { AnimationOverrides } from "../types.ts";

describe("TorchFlicker", () => {
  describe("construction", () => {
    test("uses provided frames", () => {
      const anim = new TorchFlicker(0, 0, ["a", "b", "c"]);
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("a");
    });

    test("uses default torch frames when none provided", () => {
      const anim = new TorchFlicker(0, 0);
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      const char = overrides.get("0,0")?.char ?? "";
      expect(["\u2020", "\u2021", "\u2726"]).toContain(char); // †, ‡, ✦
    });

    test("uses default torch frames when empty array provided", () => {
      const anim = new TorchFlicker(0, 0, []);
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      const char = overrides.get("0,0")?.char ?? "";
      expect(["\u2020", "\u2021", "\u2726"]).toContain(char);
    });

    test("is never finished (cyclic animation)", () => {
      const anim = new TorchFlicker(0, 0, ["\u2020", "\u2021"]);
      expect(anim.finished).toBe(false);
      anim.update(10000);
      expect(anim.finished).toBe(false);
    });
  });

  describe("frame cycling", () => {
    test("cycles through flicker states at 200ms interval by default", () => {
      const frames = ["a", "b", "c", "d"];
      const anim = new TorchFlicker(0, 0, frames, 200);

      expect(anim.currentFlickerState).toBe(0);

      anim.update(200);
      expect(anim.currentFlickerState).toBe(1);

      anim.update(200);
      expect(anim.currentFlickerState).toBe(2);

      anim.update(200);
      expect(anim.currentFlickerState).toBe(3);

      // Wraps back to 0
      anim.update(200);
      expect(anim.currentFlickerState).toBe(0);
    });

    test("does not advance before interval elapses", () => {
      const anim = new TorchFlicker(0, 0, ["a", "b"], 200);
      anim.update(100);
      expect(anim.currentFlickerState).toBe(0);
    });

    test("accumulates partial time across updates", () => {
      const anim = new TorchFlicker(0, 0, ["a", "b"], 200);
      anim.update(80);
      anim.update(80);
      anim.update(80);
      // 240ms total, should have advanced once (at 200ms), timer = 40
      expect(anim.currentFlickerState).toBe(1);
    });

    test("selects frame character using modulo of flicker state", () => {
      const frames = ["a", "b"]; // 2 frames, 4 flicker states
      const anim = new TorchFlicker(0, 0, frames, 200);
      const overrides: AnimationOverrides = new Map();

      // State 0 → frames[0 % 2] = "a"
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("a");

      // State 1 → frames[1 % 2] = "b"
      anim.update(200);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("b");

      // State 2 → frames[2 % 2] = "a"
      anim.update(200);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("a");

      // State 3 → frames[3 % 2] = "b" (and dimmed)
      anim.update(200);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.char).toBe("b");
    });
  });

  describe("dim behavior", () => {
    test("dims on every 4th frame (flicker state 3)", () => {
      const anim = new TorchFlicker(0, 0, ["a", "b", "c", "d"], 200);
      const overrides: AnimationOverrides = new Map();

      // State 0 — not dimmed
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.dim).toBeFalsy();

      // State 1 — not dimmed
      anim.update(200);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.dim).toBeFalsy();

      // State 2 — not dimmed
      anim.update(200);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.dim).toBeFalsy();

      // State 3 — dimmed!
      anim.update(200);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.dim).toBe(true);

      // State 0 again — not dimmed
      anim.update(200);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("0,0")?.dim).toBeFalsy();
    });

    test("1-in-4 dim ratio across a full cycle", () => {
      const anim = new TorchFlicker(0, 0, ["a"], 200);
      let dimCount = 0;

      for (let i = 0; i < 4; i++) {
        const overrides: AnimationOverrides = new Map();
        anim.applyOverrides(overrides);
        if (overrides.get("0,0")?.dim) dimCount++;
        anim.update(200);
      }

      expect(dimCount).toBe(1); // Exactly 1 out of 4
    });
  });

  describe("applyOverrides", () => {
    test("writes to correct coordinate key", () => {
      const anim = new TorchFlicker(3, 8, ["x"]);
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      expect(overrides.has("3,8")).toBe(true);
      expect(overrides.size).toBe(1);
    });

    test("overrides char and dim, not fg/bg/bold", () => {
      const anim = new TorchFlicker(0, 0, ["\u2020"]);
      // Advance to dim state
      anim.update(200);
      anim.update(200);
      anim.update(200);

      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      const cell = overrides.get("0,0")!;
      expect(cell.char).toBeDefined();
      expect(cell.dim).toBe(true);
      expect(cell.fg).toBeUndefined();
      expect(cell.bg).toBeUndefined();
      expect(cell.bold).toBeUndefined();
    });
  });
});
