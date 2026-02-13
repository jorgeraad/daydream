import { describe, test, expect } from "bun:test";
import { IdleAnimation } from "../IdleAnimation.ts";
import type { AnimationOverrides } from "../types.ts";

describe("IdleAnimation", () => {
  describe("construction", () => {
    test("stores character ID", () => {
      const anim = new IdleAnimation("npc_1", ["a", "b"], () => ({ x: 0, y: 0 }));
      expect(anim.id).toBe("npc_1");
    });

    test("starts at frame 0", () => {
      const anim = new IdleAnimation("npc_1", ["a", "b"], () => ({ x: 0, y: 0 }));
      expect(anim.currentFrame).toBe(0);
    });

    test("is never finished (cyclic animation)", () => {
      const anim = new IdleAnimation("npc_1", ["a", "b"], () => ({ x: 0, y: 0 }));
      expect(anim.finished).toBe(false);
      anim.update(50000);
      expect(anim.finished).toBe(false);
    });
  });

  describe("frame cycling", () => {
    test("cycles through frames at 1500ms interval by default", () => {
      const frames = ["\u263A", "\u263B"]; // ☺, ☻
      const anim = new IdleAnimation("npc_1", frames, () => ({ x: 5, y: 5 }));
      const overrides: AnimationOverrides = new Map();

      // Initial frame
      anim.applyOverrides(overrides);
      expect(overrides.get("5,5")?.char).toBe("\u263A");

      // After one interval
      anim.update(1500);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("5,5")?.char).toBe("\u263B");

      // Wraps back
      anim.update(1500);
      overrides.clear();
      anim.applyOverrides(overrides);
      expect(overrides.get("5,5")?.char).toBe("\u263A");
    });

    test("does not advance before interval elapses", () => {
      const anim = new IdleAnimation("npc_1", ["a", "b"], () => ({ x: 0, y: 0 }), 1500);
      anim.update(1000);
      expect(anim.currentFrame).toBe(0);
    });

    test("accumulates time across updates", () => {
      const anim = new IdleAnimation("npc_1", ["a", "b"], () => ({ x: 0, y: 0 }), 1500);
      anim.update(500);
      anim.update(500);
      anim.update(500);
      expect(anim.currentFrame).toBe(1);
    });

    test("cycles through multiple frames correctly", () => {
      const frames = ["a", "b", "c", "d"];
      const anim = new IdleAnimation("npc_1", frames, () => ({ x: 0, y: 0 }), 1500);

      anim.update(1500);
      expect(anim.currentFrame).toBe(1);

      anim.update(1500);
      expect(anim.currentFrame).toBe(2);

      anim.update(1500);
      expect(anim.currentFrame).toBe(3);

      anim.update(1500);
      expect(anim.currentFrame).toBe(0); // wrap
    });

    test("respects custom interval", () => {
      const anim = new IdleAnimation("npc_1", ["a", "b"], () => ({ x: 0, y: 0 }), 500);

      anim.update(500);
      expect(anim.currentFrame).toBe(1);

      // Would not have advanced at default 1500ms
      anim.update(500);
      expect(anim.currentFrame).toBe(0);
    });
  });

  describe("position callback", () => {
    test("uses position callback to determine override key", () => {
      let pos = { x: 3, y: 7 };
      const anim = new IdleAnimation("npc_1", ["a"], () => pos);

      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      expect(overrides.has("3,7")).toBe(true);
    });

    test("tracks position changes when character moves", () => {
      let pos = { x: 3, y: 7 };
      const anim = new IdleAnimation("npc_1", ["a"], () => pos);

      const o1: AnimationOverrides = new Map();
      anim.applyOverrides(o1);
      expect(o1.has("3,7")).toBe(true);

      // Character moves
      pos = { x: 4, y: 7 };

      const o2: AnimationOverrides = new Map();
      anim.applyOverrides(o2);
      expect(o2.has("4,7")).toBe(true);
      expect(o2.has("3,7")).toBe(false);
    });

    test("position callback is called each time applyOverrides is called", () => {
      let callCount = 0;
      const getPos = () => {
        callCount++;
        return { x: 0, y: 0 };
      };
      const anim = new IdleAnimation("npc_1", ["a"], getPos);

      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      expect(callCount).toBe(1);

      anim.applyOverrides(overrides);
      expect(callCount).toBe(2);

      anim.applyOverrides(overrides);
      expect(callCount).toBe(3);
    });

    test("override follows character through multiple moves", () => {
      const positions = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 3 },
      ];
      let posIndex = 0;
      const anim = new IdleAnimation("npc_1", ["a"], () => positions[posIndex]!);

      for (const expectedPos of positions) {
        const overrides: AnimationOverrides = new Map();
        anim.applyOverrides(overrides);
        expect(overrides.has(`${expectedPos.x},${expectedPos.y}`)).toBe(true);
        expect(overrides.size).toBe(1);
        posIndex++;
      }
    });
  });

  describe("applyOverrides", () => {
    test("only overrides char, not fg/bg/bold/dim", () => {
      const anim = new IdleAnimation("npc_1", ["\u263A"], () => ({ x: 0, y: 0 }));
      const overrides: AnimationOverrides = new Map();
      anim.applyOverrides(overrides);
      const cell = overrides.get("0,0")!;
      expect(cell.char).toBe("\u263A");
      expect(cell.fg).toBeUndefined();
      expect(cell.bg).toBeUndefined();
      expect(cell.bold).toBeUndefined();
      expect(cell.dim).toBeUndefined();
    });
  });
});
