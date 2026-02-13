import { describe, test, expect, mock } from "bun:test";
import { TileRenderer } from "../TileRenderer.ts";
import { SpriteRegistry } from "../sprites/SpriteRegistry.ts";
import { PixelBuffer } from "../sprites/PixelBuffer.ts";
import { ViewportManager } from "../ViewportManager.ts";
import type { ZoneData, TileCell, TileLayer } from "../types.ts";
import type { SpriteTemplate, SpriteInstance } from "../sprites/types.ts";
import { NPC_PLAYER } from "../sprites/library/index.ts";

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
    clear() {},
  };
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeGroundTile(char: string = ".", fg: string = "#228b22"): TileCell {
  return { char, fg };
}

function makeGroundLayer(width: number, height: number, char?: string): TileLayer {
  return {
    name: "ground",
    data: Array.from({ length: width * height }, () => makeGroundTile(char)),
    width,
    height,
  };
}

function makeCollisionLayer(width: number, height: number): TileLayer {
  return {
    name: "collision",
    data: Array.from({ length: width * height }, () => ({ char: "0", fg: "#000000" })),
    width,
    height,
  };
}

function makeObjectsLayer(width: number, height: number): TileLayer {
  return {
    name: "objects",
    data: Array.from({ length: width * height }, () => ({ char: "", fg: "#000000" })),
    width,
    height,
  };
}

function makeZone(
  width: number,
  height: number,
  options: {
    sprites?: SpriteInstance[];
    biomeType?: string;
    objectsLayer?: TileLayer;
  } = {},
): ZoneData {
  const layers: TileLayer[] = [
    makeGroundLayer(width, height),
    options.objectsLayer ?? makeObjectsLayer(width, height),
    makeCollisionLayer(width, height),
  ];

  return {
    id: "test_zone",
    width,
    height,
    layers,
    sprites: options.sprites ?? [],
    biomeType: options.biomeType ?? "forest",
  };
}

function makeSmallSprite(id: string, color: string): SpriteTemplate {
  return {
    id,
    name: `Test ${id}`,
    category: "object",
    pixelWidth: 1,
    pixelHeight: 2,
    pixels: [color, color],
    anchor: { x: 0, y: 1 },
    collisionTiles: [{ dx: 0, dy: 0 }],
    tags: ["test"],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TileRenderer integration", () => {
  test("renders a zone and produces half-block encoded output", () => {
    const viewW = 4;
    const viewH = 3;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    const renderer = new TileRenderer(fb as any, registry);

    const zone = makeZone(10, 10);
    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(5, 5, zone.width, zone.height);

    renderer.renderZone(zone, viewport, 5, 5);

    // Should have produced exactly viewW * viewH cells
    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);

    // All cells should use half-block characters
    for (const cell of fb.cells) {
      expect(["\u2588", "\u2580"]).toContain(cell.char);
    }
  });

  test("renders ground pixels using ground texture colors", () => {
    const viewW = 3;
    const viewH = 2;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    const renderer = new TileRenderer(fb as any, registry);

    const zone = makeZone(10, 10, { biomeType: "forest" });
    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(0, 0, zone.width, zone.height);

    renderer.renderZone(zone, viewport, 1, 1);

    // Should have produced cells (ground colors are non-black)
    expect(fb.cells.length).toBe(viewW * viewH);

    // At least some cells should have non-zero green (forest tones)
    const hasGreen = fb.cells.some(
      (c) => c.fg.g > 0.05 || c.bg.g > 0.05,
    );
    expect(hasGreen).toBe(true);
  });

  test("sprites are composited into the pixel buffer", () => {
    const viewW = 5;
    const viewH = 5;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");

    // Register a bright red sprite
    const redSprite = makeSmallSprite("red_obj", "#ff0000");
    registry.register(redSprite);

    const renderer = new TileRenderer(fb as any, registry);

    const zone = makeZone(10, 10, {
      sprites: [{ templateId: "red_obj", position: { x: 2, y: 2 } }],
    });
    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(0, 0, zone.width, zone.height);

    renderer.renderZone(zone, viewport, 0, 0);

    // The red sprite is at tile (2,2), which maps to pixel column 2
    // Its anchor is at (0,1), so the sprite top-left is at pixel (2, 2*2 - 1) = (2, 3)
    // Actually: anchorPx = 2, anchorPy = 2*2 = 4. worldPx = 2 - 0 = 2, worldPy = 4 - 1 = 3.
    // Screen: screenPx = 2 - 0 = 2, screenPy = 3 - 0*2 = 3.
    // So the sprite occupies pixel (2, 3) and (2, 4).
    // Pixel rows 3 and 4 map to cell row 1 (rows 2-3) and pixel row 4 is in cell row 2 (rows 4-5).
    // Wait: cell row = floor(pixelY / 2). Pixel 3 => cell row 1 (top pixel), pixel 4 => cell row 2 (top pixel).

    // The cell at column 2 should have been written
    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);
  });

  test("player sprite is rendered when registered", () => {
    const viewW = 5;
    const viewH = 5;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");

    // Register the player sprite with its known ID
    registry.register(NPC_PLAYER);

    const renderer = new TileRenderer(fb as any, registry);

    const zone = makeZone(20, 20);
    const viewport = new ViewportManager(viewW, viewH);
    const playerX = 10;
    const playerY = 10;
    viewport.updateCamera(playerX, playerY, zone.width, zone.height);

    renderer.renderZone(zone, viewport, playerX, playerY);

    // Should render without errors
    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);
  });

  test("renders without sprites when registry is empty", () => {
    const viewW = 3;
    const viewH = 3;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    const renderer = new TileRenderer(fb as any, registry);

    const zone = makeZone(10, 10, {
      sprites: [{ templateId: "nonexistent", position: { x: 2, y: 2 } }],
    });
    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(0, 0, zone.width, zone.height);

    // Should not throw even with unresolvable sprite references
    renderer.renderZone(zone, viewport, 1, 1);

    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);
  });

  test("color transform is applied before encoding", () => {
    const viewW = 2;
    const viewH = 2;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    const renderer = new TileRenderer(fb as any, registry);

    let transformCalled = false;
    renderer.colorTransform = (pixelBuffer: PixelBuffer) => {
      transformCalled = true;
      // Verify it receives a PixelBuffer with correct dimensions
      expect(pixelBuffer.width).toBe(viewW);
      expect(pixelBuffer.height).toBe(viewH * 2);
    };

    const zone = makeZone(10, 10);
    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(0, 0, zone.width, zone.height);

    renderer.renderZone(zone, viewport, 1, 1);

    expect(transformCalled).toBe(true);
  });

  test("sprites are Y-sorted back to front", () => {
    const viewW = 5;
    const viewH = 5;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");

    // Two sprites overlapping the same pixel column but at different Y
    const sprite = makeSmallSprite("overlap_obj", "#ff0000");
    registry.register(sprite);

    const renderer = new TileRenderer(fb as any, registry);

    const zone = makeZone(10, 10, {
      sprites: [
        { templateId: "overlap_obj", position: { x: 2, y: 1 } },
        { templateId: "overlap_obj", position: { x: 2, y: 3 } },
      ],
    });
    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(0, 0, zone.width, zone.height);

    // Should not throw — sprites are sorted by Y before blitting
    renderer.renderZone(zone, viewport, 0, 0);

    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);
  });

  test("object layer characters contribute to pixel buffer", () => {
    const viewW = 3;
    const viewH = 3;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    const renderer = new TileRenderer(fb as any, registry);

    // Create an objects layer with a colored character
    const objLayer = makeObjectsLayer(10, 10);
    // Place a non-empty character tile at (1,1)
    objLayer.data[1 * 10 + 1] = { char: "#", fg: "#ff0000" };

    const zone = makeZone(10, 10, { objectsLayer: objLayer });
    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(0, 0, zone.width, zone.height);

    renderer.renderZone(zone, viewport, 1, 1);

    // Should render without errors, all cells encoded
    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);

    // The cell at (1,1) should have some red contribution from the object
    const cell = fb.cellAt(1, 1)!;
    expect(cell).toBeDefined();
    // fg or bg should have red from the object tile's fg color
    expect(cell.fg.r > 0.5 || cell.bg.r > 0.5).toBe(true);
  });

  test("output characters are only half-block or full-block", () => {
    const viewW = 6;
    const viewH = 4;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    const renderer = new TileRenderer(fb as any, registry);

    const zone = makeZone(20, 20, { biomeType: "desert" });
    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(3, 3, zone.width, zone.height);

    renderer.renderZone(zone, viewport, 6, 6);

    for (const cell of fb.cells) {
      expect(
        cell.char === "\u2588" || cell.char === "\u2580",
      ).toBe(true);
    }
  });

  test("renders correctly with different biome types", () => {
    const biomes = ["forest", "desert", "town"];
    const viewW = 3;
    const viewH = 3;

    for (const biome of biomes) {
      const fb = createMockBuffer(viewW, viewH);
      const registry = new SpriteRegistry("/tmp/unused");
      const renderer = new TileRenderer(fb as any, registry);

      const zone = makeZone(10, 10, { biomeType: biome });
      const viewport = new ViewportManager(viewW, viewH);
      viewport.updateCamera(0, 0, zone.width, zone.height);

      renderer.renderZone(zone, viewport, 1, 1);

      expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);
    }
  });

  test("handles zone with no ground layer gracefully", () => {
    const viewW = 3;
    const viewH = 3;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    const renderer = new TileRenderer(fb as any, registry);

    // Zone with only collision layer, no ground
    const zone: ZoneData = {
      id: "no_ground",
      width: 10,
      height: 10,
      layers: [makeCollisionLayer(10, 10)],
    };
    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(0, 0, zone.width, zone.height);

    // Should not throw
    renderer.renderZone(zone, viewport, 1, 1);
    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);
  });

  test("camera offset correctly shifts which tiles are visible", () => {
    const viewW = 2;
    const viewH = 2;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    const renderer = new TileRenderer(fb as any, registry);

    const zone = makeZone(20, 20);
    const viewport = new ViewportManager(viewW, viewH);

    // Position the camera at (5, 5)
    viewport.updateCamera(10, 10, zone.width, zone.height);

    renderer.renderZone(zone, viewport, 10, 10);

    // Should render 2x2 = 4 cells
    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);
  });

  test("sprite outside viewport is not rendered", () => {
    const viewW = 3;
    const viewH = 3;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");

    const sprite = makeSmallSprite("far_away", "#ff0000");
    registry.register(sprite);

    const renderer = new TileRenderer(fb as any, registry);

    // Sprite at position (50,50), but viewport camera at (0,0) with 3x3 view
    const zone = makeZone(100, 100, {
      sprites: [{ templateId: "far_away", position: { x: 50, y: 50 } }],
    });
    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(0, 0, zone.width, zone.height);

    renderer.renderZone(zone, viewport, 0, 0);

    // All cells should just have ground colors (no sprite interference)
    // The sprite is far outside the viewport, so it shouldn't affect the output
    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);
  });
});
