import { describe, test, expect, beforeEach, mock } from "bun:test";
import { AnimationManager } from "../AnimationManager.ts";
import type {
  Animation,
  AnimationOverrides,
  CellOverride,
  ColorTransform,
  LiveRenderer,
} from "../types.ts";
import { IDENTITY_TRANSFORM, TIME_TRANSFORMS, lerpTransform } from "../types.ts";
import type { ZoneData, TileLayer, TileCell } from "../../types.ts";

// ── Test Helpers ────────────────────────────────────────────

/** Create a mock LiveRenderer that tracks requestLive/dropLive calls. */
function createMockRenderer() {
  const calls: string[] = [];
  const renderer: LiveRenderer = {
    requestLive: () => calls.push("requestLive"),
    dropLive: () => calls.push("dropLive"),
  };
  return { renderer, calls };
}

/** Create a simple animation that tracks update calls and writes a fixed override. */
function createTestAnimation(
  x: number,
  y: number,
  char: string,
  opts: { finished?: boolean } = {},
): Animation & { updateCalls: number[] } {
  const anim = {
    finished: opts.finished ?? false,
    updateCalls: [] as number[],
    update(deltaTime: number) {
      anim.updateCalls.push(deltaTime);
    },
    applyOverrides(overrides: AnimationOverrides) {
      overrides.set(`${x},${y}`, { char });
    },
  };
  return anim;
}

/** Create a one-shot animation that finishes after N update calls. */
function createOneShotAnimation(
  x: number,
  y: number,
  finishAfter: number,
): Animation & { updateCount: number } {
  let count = 0;
  const anim: Animation & { updateCount: number } = {
    finished: false,
    updateCount: 0,
    update(_deltaTime: number) {
      count++;
      anim.updateCount = count;
      if (count >= finishAfter) {
        anim.finished = true;
      }
    },
    applyOverrides(overrides: AnimationOverrides) {
      overrides.set(`${x},${y}`, { char: "!" });
    },
  };
  return anim;
}

/** Create a minimal ZoneData with animated tiles. */
function createZoneWithAnimatedTiles(
  width: number,
  height: number,
  animatedPositions: Array<{ x: number; y: number; frames: string[] }>,
): ZoneData {
  const data: TileCell[] = new Array(width * height).fill(null).map(() => ({
    char: ".",
    fg: "#888888",
  }));

  for (const pos of animatedPositions) {
    const idx = pos.y * width + pos.x;
    data[idx] = {
      char: pos.frames[0]!,
      fg: "#0088ff",
      animated: true,
      animFrames: pos.frames,
    };
  }

  const layer: TileLayer = {
    name: "ground",
    data,
    width,
    height,
  };

  return {
    id: "test_zone",
    width,
    height,
    layers: [layer],
  };
}

// ── Tests ───────────────────────────────────────────────────

describe("AnimationManager", () => {
  let mockRenderer: ReturnType<typeof createMockRenderer>;
  let manager: AnimationManager;

  beforeEach(() => {
    mockRenderer = createMockRenderer();
    manager = new AnimationManager(mockRenderer.renderer);
  });

  describe("add/remove lifecycle", () => {
    test("starts with no animations and not live", () => {
      expect(manager.animationCount).toBe(0);
      expect(manager.isLive).toBe(false);
      expect(mockRenderer.calls).toEqual([]);
    });

    test("requestLive is called when first animation is added", () => {
      const anim = createTestAnimation(0, 0, "~");
      manager.add("water1", anim);

      expect(manager.animationCount).toBe(1);
      expect(manager.isLive).toBe(true);
      expect(mockRenderer.calls).toEqual(["requestLive"]);
    });

    test("requestLive is called only once for multiple adds", () => {
      manager.add("a1", createTestAnimation(0, 0, "~"));
      manager.add("a2", createTestAnimation(1, 0, "~"));
      manager.add("a3", createTestAnimation(2, 0, "~"));

      expect(manager.animationCount).toBe(3);
      expect(mockRenderer.calls).toEqual(["requestLive"]);
    });

    test("dropLive is called when last animation is removed", () => {
      manager.add("a1", createTestAnimation(0, 0, "~"));
      manager.add("a2", createTestAnimation(1, 0, "~"));

      manager.remove("a1");
      expect(manager.animationCount).toBe(1);
      expect(manager.isLive).toBe(true);
      expect(mockRenderer.calls).toEqual(["requestLive"]);

      manager.remove("a2");
      expect(manager.animationCount).toBe(0);
      expect(manager.isLive).toBe(false);
      expect(mockRenderer.calls).toEqual(["requestLive", "dropLive"]);
    });

    test("removing non-existent ID is a no-op", () => {
      manager.add("a1", createTestAnimation(0, 0, "~"));
      manager.remove("nonexistent");
      expect(manager.animationCount).toBe(1);
      expect(manager.isLive).toBe(true);
    });

    test("re-adding after all removed re-requests live", () => {
      manager.add("a1", createTestAnimation(0, 0, "~"));
      manager.remove("a1");
      expect(mockRenderer.calls).toEqual(["requestLive", "dropLive"]);

      manager.add("a2", createTestAnimation(1, 0, "~"));
      expect(manager.isLive).toBe(true);
      expect(mockRenderer.calls).toEqual(["requestLive", "dropLive", "requestLive"]);
    });
  });

  describe("update", () => {
    test("calls update on all active animations", () => {
      const anim1 = createTestAnimation(0, 0, "~");
      const anim2 = createTestAnimation(1, 0, "~");
      manager.add("a1", anim1);
      manager.add("a2", anim2);

      manager.update(16);

      expect(anim1.updateCalls).toEqual([16]);
      expect(anim2.updateCalls).toEqual([16]);
    });

    test("builds override map from all animations", () => {
      manager.add("a1", createTestAnimation(0, 0, "~"));
      manager.add("a2", createTestAnimation(5, 3, "#"));

      manager.update(16);

      const overrides = manager.getOverrides();
      expect(overrides.size).toBe(2);
      expect(overrides.get("0,0")).toEqual({ char: "~" });
      expect(overrides.get("5,3")).toEqual({ char: "#" });
    });

    test("clears overrides between frames", () => {
      manager.add("a1", createTestAnimation(0, 0, "~"));
      manager.update(16);
      expect(manager.getOverrides().size).toBe(1);

      manager.remove("a1");
      // After remove, the last animation is gone; but we haven't called update yet
      // The overrides from the previous frame should still be there
      // until the next update clears them
      expect(manager.getOverrides().size).toBe(1);

      // After a new animation and update, old overrides are cleared
      manager.add("a2", createTestAnimation(9, 9, "X"));
      manager.update(16);
      expect(manager.getOverrides().size).toBe(1);
      expect(manager.getOverrides().has("0,0")).toBe(false);
      expect(manager.getOverrides().get("9,9")).toEqual({ char: "X" });
    });

    test("removes finished animations after update", () => {
      const oneShot = createOneShotAnimation(0, 0, 2);
      manager.add("oneshot", oneShot);
      expect(manager.animationCount).toBe(1);

      manager.update(16); // update 1 — not finished yet
      expect(manager.animationCount).toBe(1);
      expect(oneShot.finished).toBe(false);

      manager.update(16); // update 2 — finishes
      expect(oneShot.finished).toBe(true);
      expect(manager.animationCount).toBe(0);
      expect(manager.isLive).toBe(false);
    });

    test("finished animations still produce overrides on their final frame", () => {
      const oneShot = createOneShotAnimation(3, 4, 1);
      manager.add("oneshot", oneShot);

      manager.update(16); // finishes on this update
      // Override should be present for the frame it finishes
      expect(manager.getOverrides().get("3,4")).toEqual({ char: "!" });
      // But animation is removed
      expect(manager.animationCount).toBe(0);
    });
  });

  describe("clearAll", () => {
    test("removes all animations and drops live", () => {
      manager.add("a1", createTestAnimation(0, 0, "~"));
      manager.add("a2", createTestAnimation(1, 0, "#"));
      manager.add("a3", createTestAnimation(2, 0, "*"));

      // Put some overrides into the map
      manager.update(16);
      expect(manager.getOverrides().size).toBe(3);

      manager.clearAll();

      expect(manager.animationCount).toBe(0);
      expect(manager.isLive).toBe(false);
      expect(manager.getOverrides().size).toBe(0);
      expect(mockRenderer.calls).toEqual(["requestLive", "dropLive"]);
    });

    test("clearAll is safe to call when empty", () => {
      manager.clearAll();
      expect(manager.animationCount).toBe(0);
      expect(manager.isLive).toBe(false);
      expect(mockRenderer.calls).toEqual([]);
    });

    test("clearAll followed by add works correctly", () => {
      manager.add("a1", createTestAnimation(0, 0, "~"));
      manager.clearAll();

      manager.add("a2", createTestAnimation(1, 1, "#"));
      expect(manager.animationCount).toBe(1);
      expect(manager.isLive).toBe(true);
      expect(mockRenderer.calls).toEqual(["requestLive", "dropLive", "requestLive"]);
    });
  });

  describe("registerZoneAnimations", () => {
    test("registers animations for all animated tiles", () => {
      const zone = createZoneWithAnimatedTiles(10, 10, [
        { x: 2, y: 3, frames: ["~", "\u2248", "\u223C"] },
        { x: 5, y: 7, frames: ["\u2020", "\u2021", "\u2726"] },
      ]);

      manager.registerZoneAnimations(zone);

      expect(manager.animationCount).toBe(2);
      expect(manager.isLive).toBe(true);
    });

    test("skips non-animated tiles", () => {
      const zone = createZoneWithAnimatedTiles(10, 10, []);

      manager.registerZoneAnimations(zone);

      expect(manager.animationCount).toBe(0);
      expect(manager.isLive).toBe(false);
    });

    test("registered tile animations produce overrides after update", () => {
      const zone = createZoneWithAnimatedTiles(10, 10, [
        { x: 2, y: 3, frames: ["~", "\u2248"] },
      ]);

      manager.registerZoneAnimations(zone);
      manager.update(16);

      const overrides = manager.getOverrides();
      expect(overrides.size).toBe(1);
      expect(overrides.has("2,3")).toBe(true);
      const cell = overrides.get("2,3")!;
      expect(cell.char).toBeDefined();
      // The char should be one of the frames
      expect(["~", "\u2248"].includes(cell.char!)).toBe(true);
    });

    test("handles multiple layers", () => {
      const zone: ZoneData = {
        id: "test_zone",
        width: 5,
        height: 5,
        layers: [
          {
            name: "ground",
            data: Array.from<unknown, TileCell>({ length: 25 }, (_, i) =>
              i === 7
                ? { char: "~", fg: "#00f", animated: true, animFrames: ["~", "\u2248"] }
                : { char: ".", fg: "#888" },
            ),
            width: 5,
            height: 5,
          },
          {
            name: "objects",
            data: Array.from<unknown, TileCell>({ length: 25 }, (_, i) =>
              i === 12
                ? { char: "\u2020", fg: "#f80", animated: true, animFrames: ["\u2020", "\u2021"] }
                : { char: " ", fg: "#000" },
            ),
            width: 5,
            height: 5,
          },
        ],
      };

      manager.registerZoneAnimations(zone);
      expect(manager.animationCount).toBe(2);
    });
  });

  describe("getColorTransform", () => {
    test("returns identity transform by default", () => {
      const transform = manager.getColorTransform();
      expect(transform.rMul).toBeCloseTo(1.0);
      expect(transform.gMul).toBeCloseTo(1.0);
      expect(transform.bMul).toBeCloseTo(1.0);
      expect(transform.rAdd).toBeCloseTo(0);
      expect(transform.gAdd).toBeCloseTo(0);
      expect(transform.bAdd).toBeCloseTo(0);
      expect(transform.brightness).toBeCloseTo(1.0);
    });

    test("setTimeOfDay begins a transition toward the target transform", () => {
      manager.setTimeOfDay("night", 0);

      // At t=0 the transition just started — should still be near identity
      const transform = manager.getColorTransform();
      expect(transform.brightness).toBeCloseTo(1.0);

      // After running for the full transition duration, should be near night values
      // Use a shorter transition for testing
    });

    test("full transition reaches target values", () => {
      // Use a very short transition for testing
      const shortManager = new AnimationManager(mockRenderer.renderer, {
        transitionDuration: 100,
      });

      shortManager.setTimeOfDay("night", 0);

      // Simulate enough time to complete transition
      // Need an animation active so update runs the overlay
      shortManager.add("dummy", createTestAnimation(0, 0, "."));
      for (let i = 0; i < 10; i++) {
        shortManager.update(20);
      }

      const transform = shortManager.getColorTransform();
      expect(transform.brightness).toBeCloseTo(TIME_TRANSFORMS.night.brightness, 1);
      expect(transform.rMul).toBeCloseTo(TIME_TRANSFORMS.night.rMul, 1);
      expect(transform.bMul).toBeCloseTo(TIME_TRANSFORMS.night.bMul, 1);
    });

    test("transition interpolates smoothly", () => {
      const shortManager = new AnimationManager(mockRenderer.renderer, {
        transitionDuration: 100,
      });

      shortManager.setTimeOfDay("night", 0);
      shortManager.add("dummy", createTestAnimation(0, 0, "."));

      // At halfway point, brightness should be between identity (1.0) and night (0.35)
      shortManager.update(50);
      const mid = shortManager.getColorTransform();
      expect(mid.brightness).toBeGreaterThan(TIME_TRANSFORMS.night.brightness);
      expect(mid.brightness).toBeLessThan(IDENTITY_TRANSFORM.brightness);
    });
  });

  describe("replaceAll with add (same ID)", () => {
    test("adding with same ID replaces the animation", () => {
      manager.add("a1", createTestAnimation(0, 0, "~"));
      manager.add("a1", createTestAnimation(5, 5, "#"));

      expect(manager.animationCount).toBe(1);

      manager.update(16);
      const overrides = manager.getOverrides();
      expect(overrides.size).toBe(1);
      expect(overrides.has("5,5")).toBe(true);
      expect(overrides.has("0,0")).toBe(false);
    });
  });
});

describe("types", () => {
  describe("IDENTITY_TRANSFORM", () => {
    test("has neutral values", () => {
      expect(IDENTITY_TRANSFORM.rMul).toBe(1.0);
      expect(IDENTITY_TRANSFORM.gMul).toBe(1.0);
      expect(IDENTITY_TRANSFORM.bMul).toBe(1.0);
      expect(IDENTITY_TRANSFORM.rAdd).toBe(0);
      expect(IDENTITY_TRANSFORM.gAdd).toBe(0);
      expect(IDENTITY_TRANSFORM.bAdd).toBe(0);
      expect(IDENTITY_TRANSFORM.brightness).toBe(1.0);
    });

    test("matches afternoon preset", () => {
      const afternoon = TIME_TRANSFORMS.afternoon;
      expect(afternoon.rMul).toBe(IDENTITY_TRANSFORM.rMul);
      expect(afternoon.gMul).toBe(IDENTITY_TRANSFORM.gMul);
      expect(afternoon.bMul).toBe(IDENTITY_TRANSFORM.bMul);
      expect(afternoon.brightness).toBe(IDENTITY_TRANSFORM.brightness);
    });
  });

  describe("TIME_TRANSFORMS", () => {
    test("has all six time periods", () => {
      expect(TIME_TRANSFORMS.dawn).toBeDefined();
      expect(TIME_TRANSFORMS.morning).toBeDefined();
      expect(TIME_TRANSFORMS.afternoon).toBeDefined();
      expect(TIME_TRANSFORMS.dusk).toBeDefined();
      expect(TIME_TRANSFORMS.evening).toBeDefined();
      expect(TIME_TRANSFORMS.night).toBeDefined();
    });

    test("night is darkest", () => {
      const brightnesses = Object.values(TIME_TRANSFORMS).map(t => t.brightness);
      const minBrightness = Math.min(...brightnesses);
      expect(TIME_TRANSFORMS.night.brightness).toBe(minBrightness);
    });

    test("afternoon is brightest", () => {
      const brightnesses = Object.values(TIME_TRANSFORMS).map(t => t.brightness);
      const maxBrightness = Math.max(...brightnesses);
      expect(TIME_TRANSFORMS.afternoon.brightness).toBe(maxBrightness);
    });
  });

  describe("lerpTransform", () => {
    test("t=0 returns first transform", () => {
      const a = IDENTITY_TRANSFORM;
      const b = TIME_TRANSFORMS.night;
      const result = lerpTransform(a, b, 0);
      expect(result.rMul).toBeCloseTo(a.rMul);
      expect(result.brightness).toBeCloseTo(a.brightness);
    });

    test("t=1 returns second transform", () => {
      const a = IDENTITY_TRANSFORM;
      const b = TIME_TRANSFORMS.night;
      const result = lerpTransform(a, b, 1);
      expect(result.rMul).toBeCloseTo(b.rMul);
      expect(result.brightness).toBeCloseTo(b.brightness);
    });

    test("t=0.5 returns midpoint", () => {
      const a = IDENTITY_TRANSFORM;
      const b = TIME_TRANSFORMS.night;
      const result = lerpTransform(a, b, 0.5);
      const expectedBrightness = (a.brightness + b.brightness) / 2;
      expect(result.brightness).toBeCloseTo(expectedBrightness);
    });
  });
});
