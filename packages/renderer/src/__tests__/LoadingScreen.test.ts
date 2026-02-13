import { describe, test, expect, mock, afterEach } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { LoadingScreen } from "../ui/LoadingScreen.ts";
import { ZoneLoadingIndicator } from "../ui/ZoneLoadingIndicator.ts";

// ── Test renderer setup ─────────────────────────────────────

let cleanup: (() => void) | null = null;

async function setup() {
  const result = await createTestRenderer({
    width: 80,
    height: 24,
    kittyKeyboard: true,
  });
  cleanup = () => result.renderer.destroy();
  return result;
}

afterEach(() => {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
});

// ── Mock OptimizedBuffer ───────────────────────────────────

function createMockBuffer(width: number, height: number) {
  const cells: Array<{ char: string; x: number; y: number }> = [];
  return {
    width,
    height,
    setCell: mock(
      (
        x: number,
        y: number,
        char: string,
        _fg: any,
        _bg: any,
        _attrs: any,
      ) => {
        cells.push({ char, x, y });
      },
    ),
    get cells() {
      return cells;
    },
  };
}

// ── LoadingScreen tests ─────────────────────────────────────

describe("LoadingScreen", () => {
  describe("state machine", () => {
    test("starts in idle state", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer);
      expect(ls.state).toBe("idle");
    });

    test("transitions to active on show()", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer);
      ls.show();
      expect(ls.state).toBe("active");
      ls.destroy();
    });

    test("show() is no-op if not idle", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer);
      ls.show();
      ls.show(); // should not throw or change state
      expect(ls.state).toBe("active");
      ls.destroy();
    });

    test("transitions to done on destroy()", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer);
      ls.show();
      ls.destroy();
      expect(ls.state).toBe("done");
    });

    test("destroy() works from idle state", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer);
      ls.destroy();
      expect(ls.state).toBe("done");
    });

    test("destroy() is no-op when already done", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer);
      ls.destroy();
      ls.destroy(); // should not throw
      expect(ls.state).toBe("done");
    });

    test("transitions active -> fading -> done on fadeOut()", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer, { fadeOutMs: 10 });
      ls.show();
      expect(ls.state).toBe("active");

      await ls.fadeOut();
      expect(ls.state).toBe("done");
    });

    test("fadeOut() is no-op when not active", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer, { fadeOutMs: 10 });
      // Not shown yet (idle)
      await ls.fadeOut();
      expect(ls.state).toBe("idle");
    });
  });

  describe("spinner animation", () => {
    test("spinner starts at frame 0", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer);
      expect(ls.currentSpinnerFrame).toBe(0);
    });

    test("spinner advances frames while active", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer, {
        spinnerIntervalMs: 10,
      });
      ls.show();

      // Wait for a few spinner ticks
      await new Promise((r) => setTimeout(r, 50));

      expect(ls.currentSpinnerFrame).toBeGreaterThan(0);
      ls.destroy();
    });

    test("spinner stops after destroy()", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer, {
        spinnerIntervalMs: 10,
      });
      ls.show();
      await new Promise((r) => setTimeout(r, 30));
      ls.destroy();

      const frameAfterDestroy = ls.currentSpinnerFrame;
      await new Promise((r) => setTimeout(r, 30));
      // Frame should not have advanced after destroy
      expect(ls.currentSpinnerFrame).toBe(frameAfterDestroy);
    });
  });

  describe("status messages", () => {
    test("setStatus does not throw while active", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer);
      ls.show();
      // Should not throw
      ls.setStatus("Shaping the terrain...");
      ls.setStatus("Populating the first zone...");
      ls.destroy();
    });

    test("setStatus is no-op when not active", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer);
      // Not shown yet — should not throw
      ls.setStatus("should not work");
      expect(ls.state).toBe("idle");
    });
  });

  describe("flavor text cycling", () => {
    test("flavor text starts at index 0", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer);
      expect(ls.currentFlavorIndex).toBe(0);
    });

    test("flavor text cycles while active", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer, {
        flavorIntervalMs: 20,
        flavorTexts: ["one", "two", "three"],
      });
      ls.show();

      // Wait for cycling to happen
      await new Promise((r) => setTimeout(r, 60));

      expect(ls.currentFlavorIndex).toBeGreaterThan(0);
      ls.destroy();
    });

    test("flavor cycling does not start with single flavor text", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer, {
        flavorIntervalMs: 10,
        flavorTexts: ["only one"],
      });
      ls.show();

      await new Promise((r) => setTimeout(r, 30));

      // Should stay at 0 since there's only one flavor text
      expect(ls.currentFlavorIndex).toBe(0);
      ls.destroy();
    });

    test("flavor cycling stops on destroy", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer, {
        flavorIntervalMs: 10,
        flavorTexts: ["a", "b", "c"],
      });
      ls.show();
      await new Promise((r) => setTimeout(r, 30));
      ls.destroy();

      const indexAfterDestroy = ls.currentFlavorIndex;
      await new Promise((r) => setTimeout(r, 30));
      expect(ls.currentFlavorIndex).toBe(indexAfterDestroy);
    });
  });

  describe("fade-out transition", () => {
    test("state transitions through fading to done", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer, { fadeOutMs: 30 });
      ls.show();

      const fadePromise = ls.fadeOut();
      // Should be fading now
      expect(ls.state).toBe("fading");

      await fadePromise;
      expect(ls.state).toBe("done");
    });

    test("zero-duration fade works correctly", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer, { fadeOutMs: 0 });
      ls.show();

      await ls.fadeOut();

      expect(ls.state).toBe("done");
    });

    test("fade duration is configurable", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer, { fadeOutMs: 50 });
      ls.show();

      const start = performance.now();
      await ls.fadeOut();
      const elapsed = performance.now() - start;

      // Should take roughly 50ms with some tolerance
      expect(elapsed).toBeGreaterThanOrEqual(30);
    });
  });

  describe("configuration", () => {
    test("uses default config when none provided", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer);
      // Should construct without error
      expect(ls.state).toBe("idle");
    });

    test("accepts custom config", async () => {
      const { renderer } = await setup();
      const ls = new LoadingScreen(renderer, {
        spinnerIntervalMs: 100,
        flavorIntervalMs: 5000,
        fadeOutMs: 200,
        flavorTexts: ["Custom text 1", "Custom text 2"],
      });
      expect(ls.state).toBe("idle");
    });
  });
});

// ── ZoneLoadingIndicator tests ──────────────────────────────

describe("ZoneLoadingIndicator", () => {
  describe("state machine", () => {
    test("starts in hidden state", () => {
      const indicator = new ZoneLoadingIndicator();
      expect(indicator.state).toBe("hidden");
    });

    test("transitions to loading on show()", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.show("right");
      expect(indicator.state).toBe("loading");
    });

    test("transitions to done on hide()", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.show("right");
      indicator.hide();
      expect(indicator.state).toBe("done");
    });

    test("hide() from hidden is no-op", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.hide();
      expect(indicator.state).toBe("hidden");
    });

    test("reset() transitions done -> hidden", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.show("up");
      indicator.hide();
      expect(indicator.state).toBe("done");

      indicator.reset();
      expect(indicator.state).toBe("hidden");
    });

    test("tracks edge direction", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.show("left");
      expect(indicator.edge).toBe("left");

      indicator.hide();
      indicator.reset();
      indicator.show("down");
      expect(indicator.edge).toBe("down");
    });
  });

  describe("spinner animation", () => {
    test("spinner starts at frame 0", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.show("right");
      expect(indicator.currentSpinnerFrame).toBe(0);
    });

    test("spinner advances after interval", () => {
      const indicator = new ZoneLoadingIndicator({ spinnerIntervalMs: 50 });
      indicator.show("right");

      indicator.update(50);
      expect(indicator.currentSpinnerFrame).toBe(1);

      indicator.update(50);
      expect(indicator.currentSpinnerFrame).toBe(2);
    });

    test("spinner does not advance before interval", () => {
      const indicator = new ZoneLoadingIndicator({ spinnerIntervalMs: 100 });
      indicator.show("right");

      indicator.update(30);
      expect(indicator.currentSpinnerFrame).toBe(0);

      indicator.update(30);
      expect(indicator.currentSpinnerFrame).toBe(0);
    });

    test("spinner wraps around", () => {
      const indicator = new ZoneLoadingIndicator({ spinnerIntervalMs: 10 });
      indicator.show("right");

      // Advance through all 10 frames
      for (let i = 0; i < 10; i++) {
        indicator.update(10);
      }
      // Should wrap back to 0
      expect(indicator.currentSpinnerFrame).toBe(0);
    });

    test("update is no-op when not loading", () => {
      const indicator = new ZoneLoadingIndicator({ spinnerIntervalMs: 10 });
      indicator.update(100);
      expect(indicator.currentSpinnerFrame).toBe(0);
    });

    test("show() resets spinner state", () => {
      const indicator = new ZoneLoadingIndicator({ spinnerIntervalMs: 10 });
      indicator.show("right");
      indicator.update(30);
      expect(indicator.currentSpinnerFrame).toBeGreaterThan(0);

      indicator.hide();
      indicator.reset();
      indicator.show("left");
      expect(indicator.currentSpinnerFrame).toBe(0);
    });
  });

  describe("rendering", () => {
    test("renders nothing when hidden", () => {
      const indicator = new ZoneLoadingIndicator();
      const buffer = createMockBuffer(80, 24);

      indicator.render(buffer as any, 80, 24);
      expect(buffer.setCell).not.toHaveBeenCalled();
    });

    test("renders nothing when done", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.show("right");
      indicator.hide();
      const buffer = createMockBuffer(80, 24);

      indicator.render(buffer as any, 80, 24);
      expect(buffer.setCell).not.toHaveBeenCalled();
    });

    test("renders indicator when loading", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.show("right", "Loading...");
      const buffer = createMockBuffer(80, 24);

      indicator.render(buffer as any, 80, 24);
      expect(buffer.setCell).toHaveBeenCalled();
      expect(buffer.cells.length).toBeGreaterThan(0);
    });

    test("renders at top for 'up' edge", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.show("up", "Loading...");
      const buffer = createMockBuffer(80, 24);

      indicator.render(buffer as any, 80, 24);
      // All cells should be at y=1 (top area)
      for (const cell of buffer.cells) {
        expect(cell.y).toBe(1);
      }
    });

    test("renders at bottom for 'down' edge", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.show("down", "Loading...");
      const buffer = createMockBuffer(80, 24);

      indicator.render(buffer as any, 80, 24);
      // All cells should be at y=22 (viewHeight - 2)
      for (const cell of buffer.cells) {
        expect(cell.y).toBe(22);
      }
    });

    test("renders at left side for 'left' edge", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.show("left", "L");
      const buffer = createMockBuffer(80, 24);

      indicator.render(buffer as any, 80, 24);
      // First cell should start at x=1
      expect(buffer.cells[0]!.x).toBe(1);
      // y should be at middle
      expect(buffer.cells[0]!.y).toBe(12);
    });

    test("renders at right side for 'right' edge", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.show("right", "Loading...");
      const buffer = createMockBuffer(80, 24);

      indicator.render(buffer as any, 80, 24);
      // All cells should be at y=12 (middle)
      for (const cell of buffer.cells) {
        expect(cell.y).toBe(12);
      }
      // Last cell should be near the right edge
      const lastCell = buffer.cells[buffer.cells.length - 1]!;
      expect(lastCell.x).toBeLessThan(80);
    });

    test("clips text that exceeds viewport bounds", () => {
      const indicator = new ZoneLoadingIndicator();
      indicator.show("up", "This is a very long loading message");
      // Very narrow viewport
      const buffer = createMockBuffer(5, 5);

      indicator.render(buffer as any, 5, 5);
      // All rendered cells should be within bounds
      for (const cell of buffer.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.x).toBeLessThan(5);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeLessThan(5);
      }
    });
  });
});
