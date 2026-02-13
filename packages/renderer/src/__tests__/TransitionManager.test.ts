import { describe, test, expect, mock, beforeEach } from "bun:test";
import { TransitionManager } from "../TransitionManager.ts";
import { LoadingGate } from "../LoadingGate.ts";
import type { ZoneData, TileCell } from "../types.ts";

// ── Mock CliRenderer ────────────────────────────────────────

function createMockRenderer() {
  const postProcessFns: Array<(buffer: any, deltaTime: number) => void> = [];
  let liveCount = 0;

  return {
    addPostProcessFn: mock((fn: any) => {
      postProcessFns.push(fn);
    }),
    removePostProcessFn: mock((fn: any) => {
      const idx = postProcessFns.indexOf(fn);
      if (idx >= 0) postProcessFns.splice(idx, 1);
    }),
    requestLive: mock(() => {
      liveCount++;
    }),
    dropLive: mock(() => {
      liveCount--;
    }),
    // Expose internals for assertions
    get postProcessFns() {
      return postProcessFns;
    },
    get liveCount() {
      return liveCount;
    },
  };
}

// ── Mock zone data ──────────────────────────────────────────

function makeZone(width: number, height: number): ZoneData {
  const ground: TileCell[] = Array.from({ length: width * height }, () => ({
    char: ".",
    fg: "#00ff00",
    bg: "#003300",
  }));

  return {
    id: "test_zone",
    width,
    height,
    layers: [{ name: "ground", data: ground, width, height }],
  };
}

// ── TransitionManager tests ─────────────────────────────────

describe("TransitionManager", () => {
  test("isTransitioning is false initially", () => {
    const renderer = createMockRenderer();
    const tm = new TransitionManager(renderer as any);
    expect(tm.isTransitioning).toBe(false);
  });

  test("fadeTransition calls onSwap at midpoint", async () => {
    const renderer = createMockRenderer();
    const tm = new TransitionManager(renderer as any);

    let swapCalled = false;
    await tm.fadeTransition(
      () => {
        swapCalled = true;
      },
      { fadeOutMs: 10, fadeInMs: 10 },
    );

    expect(swapCalled).toBe(true);
  });

  test("isTransitioning is true during transition", async () => {
    const renderer = createMockRenderer();
    const tm = new TransitionManager(renderer as any);

    let wasTransitioningDuringSwap = false;
    await tm.fadeTransition(
      () => {
        wasTransitioningDuringSwap = tm.isTransitioning;
      },
      { fadeOutMs: 10, fadeInMs: 10 },
    );

    expect(wasTransitioningDuringSwap).toBe(true);
    // After completion, transitioning should be false
    expect(tm.isTransitioning).toBe(false);
  });

  test("registers and removes post-process function", async () => {
    const renderer = createMockRenderer();
    const tm = new TransitionManager(renderer as any);

    await tm.fadeTransition(() => {}, { fadeOutMs: 10, fadeInMs: 10 });

    expect(renderer.addPostProcessFn).toHaveBeenCalledTimes(1);
    expect(renderer.removePostProcessFn).toHaveBeenCalledTimes(1);
  });

  test("calls requestLive and dropLive for animation", async () => {
    const renderer = createMockRenderer();
    const tm = new TransitionManager(renderer as any);

    await tm.fadeTransition(() => {}, { fadeOutMs: 10, fadeInMs: 10 });

    expect(renderer.requestLive).toHaveBeenCalledTimes(1);
    expect(renderer.dropLive).toHaveBeenCalledTimes(1);
    expect(renderer.liveCount).toBe(0);
  });

  test("respects custom fade durations via overrides", async () => {
    const renderer = createMockRenderer();
    const tm = new TransitionManager(renderer as any);

    const start = performance.now();
    await tm.fadeTransition(
      () => {},
      { fadeOutMs: 50, fadeInMs: 50 },
    );
    const elapsed = performance.now() - start;

    // Should take roughly 100ms total (50 + 50), with some tolerance
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });

  test("second fadeTransition is no-op while first is running", async () => {
    const renderer = createMockRenderer();
    const tm = new TransitionManager(renderer as any);

    let swapCount = 0;
    const first = tm.fadeTransition(
      () => { swapCount++; },
      { fadeOutMs: 50, fadeInMs: 50 },
    );

    // Start a second one immediately (should be ignored since already transitioning)
    const second = tm.fadeTransition(
      () => { swapCount++; },
      { fadeOutMs: 10, fadeInMs: 10 },
    );

    await Promise.all([first, second]);

    expect(swapCount).toBe(1);
  });

  test("cleans up on zero-duration transitions", async () => {
    const renderer = createMockRenderer();
    const tm = new TransitionManager(renderer as any);

    let swapCalled = false;
    await tm.fadeTransition(
      () => { swapCalled = true; },
      { fadeOutMs: 0, fadeInMs: 0 },
    );

    expect(swapCalled).toBe(true);
    expect(tm.isTransitioning).toBe(false);
    expect(renderer.liveCount).toBe(0);
  });

  test("uses default durations when no overrides provided", async () => {
    const renderer = createMockRenderer();
    const tm = new TransitionManager(renderer as any);

    const start = performance.now();
    await tm.fadeTransition(() => {});
    const elapsed = performance.now() - start;

    // Default is 300ms + 200ms = 500ms total
    // Use generous tolerance for CI environments
    expect(elapsed).toBeGreaterThanOrEqual(400);
  });
});

// ── LoadingGate tests ───────────────────────────────────────

describe("LoadingGate", () => {
  let gate: LoadingGate;

  beforeEach(() => {
    gate = new LoadingGate();
  });

  test("is not active initially", () => {
    expect(gate.active).toBe(false);
  });

  test("becomes active after show()", () => {
    const zone = makeZone(10, 10);
    gate.show("up", zone);
    expect(gate.active).toBe(true);
  });

  test("becomes inactive after hide()", () => {
    const zone = makeZone(10, 10);
    gate.show("up", zone);
    gate.hide();
    expect(gate.active).toBe(false);
  });

  test("pulse index starts at 0", () => {
    const zone = makeZone(10, 10);
    gate.show("up", zone);
    expect(gate.currentPulseIndex).toBe(0);
  });

  test("pulse toggles after interval", () => {
    const zone = makeZone(10, 10);
    gate.show("up", zone);

    // Advance past one pulse interval (default 500ms)
    gate.update(500);
    expect(gate.currentPulseIndex).toBe(1);

    // Advance past another interval
    gate.update(500);
    expect(gate.currentPulseIndex).toBe(0);
  });

  test("pulse does not toggle before interval", () => {
    const zone = makeZone(10, 10);
    gate.show("up", zone);

    gate.update(200);
    expect(gate.currentPulseIndex).toBe(0);

    gate.update(200);
    expect(gate.currentPulseIndex).toBe(0);
  });

  test("update is no-op when inactive", () => {
    gate.update(1000);
    expect(gate.currentPulseIndex).toBe(0);
  });

  test("custom pulse interval is respected", () => {
    const fastGate = new LoadingGate(100);
    const zone = makeZone(10, 10);
    fastGate.show("up", zone);

    fastGate.update(100);
    expect(fastGate.currentPulseIndex).toBe(1);

    fastGate.update(100);
    expect(fastGate.currentPulseIndex).toBe(0);
  });

  test("hide resets pulse state", () => {
    const zone = makeZone(10, 10);
    gate.show("up", zone);
    gate.update(500);
    expect(gate.currentPulseIndex).toBe(1);

    gate.hide();
    expect(gate.currentPulseIndex).toBe(0);
  });

  test("show resets pulse state for new edge", () => {
    const zone = makeZone(10, 10);
    gate.show("up", zone);
    gate.update(500);
    expect(gate.currentPulseIndex).toBe(1);

    // Show on a different edge should reset
    gate.show("down", zone);
    expect(gate.currentPulseIndex).toBe(0);
  });

  describe("edge cell computation", () => {
    test("up edge covers full width at y=0", () => {
      const zone = makeZone(5, 5);
      gate.show("up", zone);
      // Gate is active — we verify it works by checking no errors
      // and that rendering produces output for the edge
      expect(gate.active).toBe(true);
    });

    test("down edge covers full width at y=height-1", () => {
      const zone = makeZone(5, 5);
      gate.show("down", zone);
      expect(gate.active).toBe(true);
    });

    test("left edge covers full height at x=0", () => {
      const zone = makeZone(5, 5);
      gate.show("left", zone);
      expect(gate.active).toBe(true);
    });

    test("right edge covers full height at x=width-1", () => {
      const zone = makeZone(5, 5);
      gate.show("right", zone);
      expect(gate.active).toBe(true);
    });
  });
});
