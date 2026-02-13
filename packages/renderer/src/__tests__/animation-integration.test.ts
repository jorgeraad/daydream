import { describe, test, expect, mock } from "bun:test";
import { TileRenderer } from "../TileRenderer.ts";
import { AnimationManager } from "../animation/AnimationManager.ts";
import {
  IDENTITY_TRANSFORM,
  TIME_TRANSFORMS,
} from "../animation/types.ts";
import type {
  AnimationState,
  AnimationOverrides,
  CellOverride,
  ColorTransform,
  LiveRenderer,
} from "../animation/types.ts";
import { SpriteRegistry } from "../sprites/SpriteRegistry.ts";
import { PixelBuffer } from "../sprites/PixelBuffer.ts";
import { ViewportManager } from "../ViewportManager.ts";
import type { ZoneData, TileCell, TileLayer } from "../types.ts";
import { applyColorTransform, isIdentityTransform, parseHex } from "../atmosphere/TimeOfDayOverlay.ts";
import { RGBA } from "@opentui/core";

// ---------------------------------------------------------------------------
// Mock OptimizedBuffer — captures setCell calls for verification
// ---------------------------------------------------------------------------

interface MockCell {
  x: number;
  y: number;
  char: string;
  fg: { r: number; g: number; b: number };
  bg: { r: number; g: number; b: number };
}

function createMockBuffer(width: number, height: number) {
  const cells: MockCell[] = [];
  return {
    width,
    height,
    setCell: mock(
      (x: number, y: number, char: string, fg: any, bg: any, _attrs: any) => {
        cells.push({
          x,
          y,
          char,
          fg: { r: fg.r, g: fg.g, b: fg.b },
          bg: { r: bg.r, g: bg.g, b: bg.b },
        });
      },
    ),
    get cells() {
      return cells;
    },
    cellAt(x: number, y: number): MockCell | undefined {
      for (let i = cells.length - 1; i >= 0; i--) {
        if (cells[i]!.x === x && cells[i]!.y === y) return cells[i]!;
      }
      return undefined;
    },
    clear() {
      cells.length = 0;
    },
  };
}

function createMockRenderer(): { renderer: LiveRenderer; calls: string[] } {
  const calls: string[] = [];
  return {
    renderer: {
      requestLive: () => calls.push("requestLive"),
      dropLive: () => calls.push("dropLive"),
    },
    calls,
  };
}

// ---------------------------------------------------------------------------
// Test zone helpers
// ---------------------------------------------------------------------------

function makeGroundLayer(
  width: number,
  height: number,
  tileOverrides?: Map<string, TileCell>,
): TileLayer {
  const data: TileCell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const override = tileOverrides?.get(`${x},${y}`);
      data.push(override ?? { char: ".", fg: "#228b22" });
    }
  }
  return { name: "ground", data, width, height };
}

function makeObjectsLayer(
  width: number,
  height: number,
  tileOverrides?: Map<string, TileCell>,
): TileLayer {
  const data: TileCell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const override = tileOverrides?.get(`${x},${y}`);
      data.push(override ?? { char: "", fg: "#000000" });
    }
  }
  return { name: "objects", data, width, height };
}

function makeCollisionLayer(width: number, height: number): TileLayer {
  return {
    name: "collision",
    data: Array.from({ length: width * height }, () => ({
      char: "0",
      fg: "#000000",
    })),
    width,
    height,
  };
}

function makeZoneWithAnimatedTiles(
  width: number,
  height: number,
  animatedPositions: Array<{
    x: number;
    y: number;
    char: string;
    fg: string;
    frames: string[];
  }>,
): ZoneData {
  const tileOverrides = new Map<string, TileCell>();
  for (const pos of animatedPositions) {
    tileOverrides.set(`${pos.x},${pos.y}`, {
      char: pos.char,
      fg: pos.fg,
      animated: true,
      animFrames: pos.frames,
    });
  }

  return {
    id: "test_zone",
    width,
    height,
    layers: [
      makeGroundLayer(width, height, tileOverrides),
      makeObjectsLayer(width, height),
      makeCollisionLayer(width, height),
    ],
    biomeType: "forest",
  };
}

function makeSimpleZone(width: number, height: number): ZoneData {
  return {
    id: "test_zone",
    width,
    height,
    layers: [
      makeGroundLayer(width, height),
      makeObjectsLayer(width, height),
      makeCollisionLayer(width, height),
    ],
    biomeType: "forest",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TileRenderer animation integration", () => {
  describe("AnimationState parameter", () => {
    test("renderZone accepts optional AnimationState", () => {
      const viewW = 3;
      const viewH = 3;
      const fb = createMockBuffer(viewW, viewH);
      const registry = new SpriteRegistry("/tmp/unused");
      const renderer = new TileRenderer(fb as any, registry);

      const zone = makeSimpleZone(10, 10);
      const viewport = new ViewportManager(viewW, viewH);
      viewport.updateCamera(0, 0, zone.width, zone.height);

      // Without animation state
      renderer.renderZone(zone, viewport, 1, 1);
      expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);

      fb.clear();
      (fb.setCell as any).mockClear();

      // With animation state
      const animState: AnimationState = {
        overrides: new Map(),
        colorTransform: IDENTITY_TRANSFORM,
      };
      renderer.renderZone(zone, viewport, 1, 1, animState);
      expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);
    });

    test("renders identically with identity transform vs no state", () => {
      const viewW = 4;
      const viewH = 3;
      const registry = new SpriteRegistry("/tmp/unused");
      const zone = makeSimpleZone(10, 10);
      const viewport = new ViewportManager(viewW, viewH);
      viewport.updateCamera(0, 0, zone.width, zone.height);

      // Render without animation state
      const fb1 = createMockBuffer(viewW, viewH);
      const r1 = new TileRenderer(fb1 as any, registry);
      r1.renderZone(zone, viewport, 1, 1);

      // Render with identity animation state
      const fb2 = createMockBuffer(viewW, viewH);
      const r2 = new TileRenderer(fb2 as any, registry);
      const animState: AnimationState = {
        overrides: new Map(),
        colorTransform: IDENTITY_TRANSFORM,
      };
      r2.renderZone(zone, viewport, 1, 1, animState);

      // Both should produce the same output
      expect(fb1.cells.length).toBe(fb2.cells.length);
      for (let i = 0; i < fb1.cells.length; i++) {
        expect(fb1.cells[i]!.char).toBe(fb2.cells[i]!.char);
        expect(fb1.cells[i]!.fg.r).toBeCloseTo(fb2.cells[i]!.fg.r, 4);
        expect(fb1.cells[i]!.fg.g).toBeCloseTo(fb2.cells[i]!.fg.g, 4);
        expect(fb1.cells[i]!.fg.b).toBeCloseTo(fb2.cells[i]!.fg.b, 4);
      }
    });
  });

  describe("per-cell animation overrides", () => {
    test("overrides change pixel colors for ground tiles", () => {
      const viewW = 3;
      const viewH = 3;
      const registry = new SpriteRegistry("/tmp/unused");
      const zone = makeSimpleZone(10, 10);
      const viewport = new ViewportManager(viewW, viewH);
      viewport.updateCamera(0, 0, zone.width, zone.height);

      // Render without overrides
      const fb1 = createMockBuffer(viewW, viewH);
      const r1 = new TileRenderer(fb1 as any, registry);
      r1.renderZone(zone, viewport, 1, 1);

      // Render with an override that changes color at (1,1)
      const fb2 = createMockBuffer(viewW, viewH);
      const r2 = new TileRenderer(fb2 as any, registry);
      const overrides: AnimationOverrides = new Map();
      overrides.set("1,1", { fg: "#ff0000", bg: "#0000ff" });
      const animState: AnimationState = {
        overrides,
        colorTransform: IDENTITY_TRANSFORM,
      };
      r2.renderZone(zone, viewport, 1, 1, animState);

      // The cell at screen position (1,1) should have red fg
      // (tile at world 1,1 maps to screen 1,1 when camera is at 0,0)
      const cell = fb2.cellAt(1, 1)!;
      expect(cell).toBeDefined();
      // The pixel at (1, 2) and (1, 3) should be red/blue from the override
      // After half-block encoding, cell (1,1) gets pixels from row 2 and 3
      // fg comes from top pixel, bg from bottom pixel
      // Upper half block: fg = top pixel (#ff0000), bg = bottom pixel (#0000ff)
      expect(cell.fg.r).toBeGreaterThan(0.9); // near 1.0 for #ff0000
      expect(cell.bg.b).toBeGreaterThan(0.9); // near 1.0 for #0000ff
    });

    test("overrides on object layer tiles change pixel colors", () => {
      const viewW = 3;
      const viewH = 3;
      const registry = new SpriteRegistry("/tmp/unused");

      // Zone with an object tile at (1,1)
      const objOverrides = new Map<string, TileCell>();
      objOverrides.set("1,1", { char: "#", fg: "#00ff00" });
      const zone: ZoneData = {
        id: "test_zone",
        width: 10,
        height: 10,
        layers: [
          makeGroundLayer(10, 10),
          makeObjectsLayer(10, 10, objOverrides),
          makeCollisionLayer(10, 10),
        ],
        biomeType: "forest",
      };
      const viewport = new ViewportManager(viewW, viewH);
      viewport.updateCamera(0, 0, zone.width, zone.height);

      // With animation override changing the object's color
      const fb = createMockBuffer(viewW, viewH);
      const renderer = new TileRenderer(fb as any, registry);
      const overrides: AnimationOverrides = new Map();
      overrides.set("1,1", { fg: "#ff0000" });
      const animState: AnimationState = {
        overrides,
        colorTransform: IDENTITY_TRANSFORM,
      };
      renderer.renderZone(zone, viewport, 1, 1, animState);

      // The cell at screen (1,1) should reflect the red override
      const cell = fb.cellAt(1, 1)!;
      expect(cell).toBeDefined();
      expect(cell.fg.r).toBeGreaterThan(0.5);
    });
  });

  describe("animated water tiles with AnimationManager", () => {
    test("overrides change across frames as water shimmers", () => {
      const { renderer: mockLiveRenderer } = createMockRenderer();
      const manager = new AnimationManager(mockLiveRenderer);

      const zone = makeZoneWithAnimatedTiles(10, 10, [
        { x: 2, y: 3, char: "~", fg: "#0088ff", frames: ["~", "\u2248", "\u223C"] },
        { x: 3, y: 3, char: "~", fg: "#0088ff", frames: ["~", "\u2248", "\u223C"] },
      ]);

      manager.registerZoneAnimations(zone);
      expect(manager.animationCount).toBe(2);

      // Collect overrides across multiple frames
      const frameOverrides: Map<string, CellOverride>[] = [];
      for (let i = 0; i < 20; i++) {
        manager.update(100); // 100ms per frame
        frameOverrides.push(new Map(manager.getOverrides()));
      }

      // Both tiles should have overrides in every frame
      for (const overrides of frameOverrides) {
        expect(overrides.has("2,3")).toBe(true);
        expect(overrides.has("3,3")).toBe(true);
      }

      // Over enough frames, the char should change (water shimmer cycles)
      const chars2_3 = frameOverrides.map((o) => o.get("2,3")!.char);
      const uniqueChars = new Set(chars2_3);
      expect(uniqueChars.size).toBeGreaterThanOrEqual(2);
    });

    test("clearAll + registerZoneAnimations works for zone transitions", () => {
      const { renderer: mockLiveRenderer } = createMockRenderer();
      const manager = new AnimationManager(mockLiveRenderer);

      // First zone
      const zone1 = makeZoneWithAnimatedTiles(10, 10, [
        { x: 1, y: 1, char: "~", fg: "#0088ff", frames: ["~", "\u2248"] },
      ]);
      manager.registerZoneAnimations(zone1);
      manager.update(16);
      expect(manager.getOverrides().has("1,1")).toBe(true);

      // Transition to second zone
      manager.clearAll();
      expect(manager.animationCount).toBe(0);
      expect(manager.getOverrides().size).toBe(0);

      const zone2 = makeZoneWithAnimatedTiles(10, 10, [
        { x: 5, y: 5, char: "~", fg: "#0088ff", frames: ["~", "\u2248"] },
      ]);
      manager.registerZoneAnimations(zone2);
      manager.update(16);

      expect(manager.getOverrides().has("1,1")).toBe(false);
      expect(manager.getOverrides().has("5,5")).toBe(true);
    });
  });

  describe("color transform application", () => {
    test("night transform darkens pixel colors", () => {
      const viewW = 3;
      const viewH = 3;
      const registry = new SpriteRegistry("/tmp/unused");
      const zone = makeSimpleZone(10, 10);
      const viewport = new ViewportManager(viewW, viewH);
      viewport.updateCamera(0, 0, zone.width, zone.height);

      // Render without transform
      const fbNormal = createMockBuffer(viewW, viewH);
      const rNormal = new TileRenderer(fbNormal as any, registry);
      rNormal.renderZone(zone, viewport, 1, 1);

      // Render with night transform
      const fbNight = createMockBuffer(viewW, viewH);
      const rNight = new TileRenderer(fbNight as any, registry);
      const animState: AnimationState = {
        overrides: new Map(),
        colorTransform: TIME_TRANSFORMS.night,
      };
      rNight.renderZone(zone, viewport, 1, 1, animState);

      // Night cells should be darker overall
      const normalBrightness = fbNormal.cells.reduce(
        (sum, c) => sum + c.fg.r + c.fg.g + c.fg.b,
        0,
      );
      const nightBrightness = fbNight.cells.reduce(
        (sum, c) => sum + c.fg.r + c.fg.g + c.fg.b,
        0,
      );

      // Night should be significantly darker (brightness 0.35)
      expect(nightBrightness).toBeLessThan(normalBrightness * 0.7);
    });

    test("applyColorTransform produces correct RGB values", () => {
      // Test specific color transform math
      const nightTransform = TIME_TRANSFORMS.night;
      // night: rMul=0.6, gMul=0.65, bMul=0.9, rAdd=-20, gAdd=-15, bAdd=10, brightness=0.35

      // White (#ffffff) through night transform:
      // r = (255 * 0.6 + (-20)) * 0.35 = (153 - 20) * 0.35 = 133 * 0.35 = 46.55
      // g = (255 * 0.65 + (-15)) * 0.35 = (165.75 - 15) * 0.35 = 150.75 * 0.35 = 52.76
      // b = (255 * 0.9 + 10) * 0.35 = (229.5 + 10) * 0.35 = 239.5 * 0.35 = 83.82
      const result = applyColorTransform("#ffffff", nightTransform);
      const [r, g, b] = parseHex(result);

      expect(r).toBeCloseTo(47, 0);
      expect(g).toBeCloseTo(53, 0);
      expect(b).toBeCloseTo(84, 0);
    });

    test("dawn transform adds warm tint", () => {
      const dawnTransform = TIME_TRANSFORMS.dawn;
      // dawn: rMul=1.1, gMul=0.9, bMul=0.85, rAdd=15, gAdd=5, bAdd=-10, brightness=0.75

      // A green color (#00ff00) through dawn:
      // r = (0 * 1.1 + 15) * 0.75 = 15 * 0.75 = 11.25
      // g = (255 * 0.9 + 5) * 0.75 = (229.5 + 5) * 0.75 = 234.5 * 0.75 = 175.875
      // b = (0 * 0.85 + (-10)) * 0.75 = -10 * 0.75 = -7.5 → clamped to 0
      const result = applyColorTransform("#00ff00", dawnTransform);
      const [r, g, b] = parseHex(result);

      expect(r).toBeCloseTo(11, 0);
      expect(g).toBeCloseTo(176, 0);
      expect(b).toBe(0); // clamped to 0
    });

    test("identity transform does not change colors", () => {
      expect(isIdentityTransform(IDENTITY_TRANSFORM)).toBe(true);
      expect(isIdentityTransform(TIME_TRANSFORMS.afternoon)).toBe(true);
      expect(isIdentityTransform(TIME_TRANSFORMS.night)).toBe(false);

      const result = applyColorTransform("#ff8844", IDENTITY_TRANSFORM);
      expect(result).toBe("#ff8844");
    });

    test("afternoon optimization: identity transform skips pixel processing", () => {
      const viewW = 3;
      const viewH = 3;
      const registry = new SpriteRegistry("/tmp/unused");
      const zone = makeSimpleZone(10, 10);
      const viewport = new ViewportManager(viewW, viewH);
      viewport.updateCamera(0, 0, zone.width, zone.height);

      // Render with afternoon (identity) transform
      const fb1 = createMockBuffer(viewW, viewH);
      const r1 = new TileRenderer(fb1 as any, registry);
      r1.renderZone(zone, viewport, 1, 1, {
        overrides: new Map(),
        colorTransform: TIME_TRANSFORMS.afternoon, // identity
      });

      // Render without animation state
      const fb2 = createMockBuffer(viewW, viewH);
      const r2 = new TileRenderer(fb2 as any, registry);
      r2.renderZone(zone, viewport, 1, 1);

      // Results should be identical (afternoon = identity = no transform)
      expect(fb1.cells.length).toBe(fb2.cells.length);
      for (let i = 0; i < fb1.cells.length; i++) {
        expect(fb1.cells[i]!.fg.r).toBeCloseTo(fb2.cells[i]!.fg.r, 4);
        expect(fb1.cells[i]!.fg.g).toBeCloseTo(fb2.cells[i]!.fg.g, 4);
        expect(fb1.cells[i]!.fg.b).toBeCloseTo(fb2.cells[i]!.fg.b, 4);
      }
    });
  });

  describe("combined overrides + color transform", () => {
    test("overrides are applied before color transform", () => {
      const viewW = 3;
      const viewH = 3;
      const registry = new SpriteRegistry("/tmp/unused");
      const zone = makeSimpleZone(10, 10);
      const viewport = new ViewportManager(viewW, viewH);
      viewport.updateCamera(0, 0, zone.width, zone.height);

      // Set a bright red override at (1,1) with night transform
      const overrides: AnimationOverrides = new Map();
      overrides.set("1,1", { fg: "#ff0000", bg: "#ff0000" });

      const fb = createMockBuffer(viewW, viewH);
      const renderer = new TileRenderer(fb as any, registry);
      renderer.renderZone(zone, viewport, 1, 1, {
        overrides,
        colorTransform: TIME_TRANSFORMS.night,
      });

      // Cell at (1,1) should have the red override darkened by night transform
      const cell = fb.cellAt(1, 1)!;
      expect(cell).toBeDefined();
      // The red should be reduced: (255 * 0.6 + (-20)) * 0.35 ≈ 46
      // So fg.r should be around 46/255 ≈ 0.18
      expect(cell.fg.r).toBeGreaterThan(0.1);
      expect(cell.fg.r).toBeLessThan(0.3);
      // Green and blue should be near zero (red input only)
      expect(cell.fg.g).toBeLessThan(0.05);
    });
  });

  describe("performance", () => {
    test("animation overhead < 5ms per frame with 200 animated tiles", () => {
      const { renderer: mockLiveRenderer } = createMockRenderer();
      const manager = new AnimationManager(mockLiveRenderer);

      // Create a zone with 200 animated water tiles
      const animatedTiles: Array<{
        x: number;
        y: number;
        char: string;
        fg: string;
        frames: string[];
      }> = [];
      for (let i = 0; i < 200; i++) {
        animatedTiles.push({
          x: i % 20,
          y: Math.floor(i / 20),
          char: "~",
          fg: "#0088ff",
          frames: ["~", "\u2248", "\u223C"],
        });
      }
      const zone = makeZoneWithAnimatedTiles(20, 20, animatedTiles);

      manager.registerZoneAnimations(zone);
      expect(manager.animationCount).toBe(200);

      // Warm up
      for (let i = 0; i < 10; i++) {
        manager.update(16);
      }

      // Benchmark: measure time for 100 frames
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        manager.update(16);
      }
      const elapsed = performance.now() - start;
      const perFrame = elapsed / 100;

      // Animation update overhead should be < 5ms per frame
      expect(perFrame).toBeLessThan(5);
    });

    test("full render with 200 animated tiles < 10ms per frame", () => {
      const viewW = 20;
      const viewH = 10;
      const { renderer: mockLiveRenderer } = createMockRenderer();
      const manager = new AnimationManager(mockLiveRenderer);

      // Create animated tiles
      const animatedTiles: Array<{
        x: number;
        y: number;
        char: string;
        fg: string;
        frames: string[];
      }> = [];
      for (let i = 0; i < 200; i++) {
        animatedTiles.push({
          x: i % 20,
          y: Math.floor(i / 20),
          char: "~",
          fg: "#0088ff",
          frames: ["~", "\u2248", "\u223C"],
        });
      }
      const zone = makeZoneWithAnimatedTiles(20, 20, animatedTiles);
      manager.registerZoneAnimations(zone);

      const fb = createMockBuffer(viewW, viewH);
      const registry = new SpriteRegistry("/tmp/unused");
      const renderer = new TileRenderer(fb as any, registry);
      const viewport = new ViewportManager(viewW, viewH);
      viewport.updateCamera(0, 0, zone.width, zone.height);

      // Warm up
      for (let i = 0; i < 5; i++) {
        manager.update(16);
        renderer.renderZone(zone, viewport, 10, 5, {
          overrides: manager.getOverrides(),
          colorTransform: manager.getColorTransform(),
        });
        (fb.setCell as any).mockClear();
        fb.clear();
      }

      // Benchmark
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        manager.update(16);
        renderer.renderZone(zone, viewport, 10, 5, {
          overrides: manager.getOverrides(),
          colorTransform: manager.getColorTransform(),
        });
        (fb.setCell as any).mockClear();
        fb.clear();
      }
      const elapsed = performance.now() - start;
      const perFrame = elapsed / 50;

      // Full render + animation should be < 10ms per frame
      expect(perFrame).toBeLessThan(10);
    });
  });
});
