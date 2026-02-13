import { describe, expect, test } from "bun:test";
import {
  biomeToColor,
  brightenColor,
  worldToMap,
  playerDotOffset,
} from "./MiniMap.ts";

// ── biomeToColor ──────────────────────────────────────────────

describe("biomeToColor", () => {
  test("returns forest palette ground.bg for 'forest'", () => {
    // forestPalette.ground.bg is "#1a3318"
    expect(biomeToColor("forest")).toBe("#1a3318");
  });

  test("returns desert palette ground.bg for 'desert'", () => {
    // desertPalette.ground.bg is "#8b7332"
    expect(biomeToColor("desert")).toBe("#8b7332");
  });

  test("returns town palette ground.bg for 'town'", () => {
    // townPalette.ground.bg is "#4a4a3e"
    expect(biomeToColor("town")).toBe("#4a4a3e");
  });

  test("returns fallback color for unknown biome", () => {
    expect(biomeToColor("volcanic")).toBe("#3a3a5e");
  });

  test("returns fallback color for empty string biome", () => {
    expect(biomeToColor("")).toBe("#3a3a5e");
  });
});

// ── brightenColor ─────────────────────────────────────────────

describe("brightenColor", () => {
  test("factor 1.0 returns same color", () => {
    expect(brightenColor("#804020", 1.0)).toBe("#804020");
  });

  test("factor 2.0 doubles channel values", () => {
    // #1a3318 → r=26 g=51 b=24 → *2 → 52,102,48 → #346630
    expect(brightenColor("#1a3318", 2.0)).toBe("#346630");
  });

  test("clamps at 255", () => {
    // #ff8080 → r=255 g=128 b=128 → *2 → 255,256→255,256→255
    expect(brightenColor("#ff8080", 2.0)).toBe("#ffffff");
  });

  test("factor 0 returns black", () => {
    expect(brightenColor("#1a3318", 0)).toBe("#000000");
  });
});

// ── worldToMap ────────────────────────────────────────────────

describe("worldToMap", () => {
  // With a 16x8 buffer and ZONE_CELL_SIZE=3:
  // cellsX = floor(16/3) = 5, cellsY = floor(8/3) = 2
  // gridPixelWidth = 15, gridPixelHeight = 6
  // offsetX = floor((16-15)/2) = 0, offsetY = floor((8-6)/2) = 1
  // Center cell = (floor(5/2), floor(2/2)) = (2, 1)

  const bufW = 16;
  const bufH = 8;

  test("current zone maps to center of buffer", () => {
    const result = worldToMap({ x: 0, y: 0 }, { x: 0, y: 0 }, bufW, bufH);
    expect(result).not.toBeNull();
    // cellX=2, cellY=1 → pixel (0+2*3, 1+1*3) = (6, 4)
    expect(result!.x).toBe(6);
    expect(result!.y).toBe(4);
  });

  test("zone to the right of center", () => {
    const result = worldToMap({ x: 1, y: 0 }, { x: 0, y: 0 }, bufW, bufH);
    expect(result).not.toBeNull();
    // cellX=3, cellY=1 → pixel (0+3*3, 1+1*3) = (9, 4)
    expect(result!.x).toBe(9);
    expect(result!.y).toBe(4);
  });

  test("zone to the left of center", () => {
    const result = worldToMap({ x: -1, y: 0 }, { x: 0, y: 0 }, bufW, bufH);
    expect(result).not.toBeNull();
    // cellX=1, cellY=1 → pixel (0+1*3, 1+1*3) = (3, 4)
    expect(result!.x).toBe(3);
    expect(result!.y).toBe(4);
  });

  test("zone above center", () => {
    const result = worldToMap({ x: 0, y: -1 }, { x: 0, y: 0 }, bufW, bufH);
    expect(result).not.toBeNull();
    // cellX=2, cellY=0 → pixel (0+2*3, 1+0*3) = (6, 1)
    expect(result!.x).toBe(6);
    expect(result!.y).toBe(1);
  });

  test("zone below center", () => {
    const result = worldToMap({ x: 0, y: 1 }, { x: 0, y: 0 }, bufW, bufH);
    // cellY=2, cellsY=2 → out of range
    expect(result).toBeNull();
  });

  test("returns null for zone far outside visible area", () => {
    const result = worldToMap({ x: 10, y: 10 }, { x: 0, y: 0 }, bufW, bufH);
    expect(result).toBeNull();
  });

  test("camera center offsets all zones", () => {
    // Camera at (5,5), zone at (6,5) → relX=1, relY=0
    const result = worldToMap({ x: 6, y: 5 }, { x: 5, y: 5 }, bufW, bufH);
    expect(result).not.toBeNull();
    // Same as "zone to the right of center"
    expect(result!.x).toBe(9);
    expect(result!.y).toBe(4);
  });

  test("negative world coords work correctly", () => {
    // Camera at (-3,-2), zone at (-3,-2) → relX=0, relY=0 → center
    const result = worldToMap({ x: -3, y: -2 }, { x: -3, y: -2 }, bufW, bufH);
    expect(result).not.toBeNull();
    expect(result!.x).toBe(6);
    expect(result!.y).toBe(4);
  });

  test("larger buffer shows more zones", () => {
    // 30x24 buffer:
    // cellsX = floor(30/3)=10, cellsY = floor(24/3)=8
    // offsetX = 0, offsetY = 0
    // center = (5, 4)
    const result = worldToMap({ x: 4, y: 3 }, { x: 0, y: 0 }, 30, 24);
    expect(result).not.toBeNull();
    // cellX = 5+4 = 9, cellY = 4+3 = 7 → pixel (27, 21)
    expect(result!.x).toBe(27);
    expect(result!.y).toBe(21);
  });

  test("symmetry: opposite directions from center", () => {
    const left = worldToMap({ x: -1, y: 0 }, { x: 0, y: 0 }, bufW, bufH);
    const right = worldToMap({ x: 1, y: 0 }, { x: 0, y: 0 }, bufW, bufH);
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    // They should be equidistant from center (6) in x
    expect(right!.x - 6).toBe(6 - left!.x);
  });
});

// ── playerDotOffset ──────────────────────────────────────────

describe("playerDotOffset", () => {
  test("player at origin maps to top-left inner pixel", () => {
    // With ZONE_CELL_SIZE=3, inner area is 1x1 starting at (1,1)
    const result = playerDotOffset({ x: 0, y: 0 }, 40, 30);
    expect(result.dx).toBe(1);
    expect(result.dy).toBe(1);
  });

  test("player at zone center maps to center inner pixel", () => {
    // With innerSize=1, any position maps to the single inner pixel (1,1)
    const result = playerDotOffset({ x: 20, y: 15 }, 40, 30);
    expect(result.dx).toBe(1);
    expect(result.dy).toBe(1);
  });

  test("player near end of zone still maps within cell", () => {
    const result = playerDotOffset({ x: 39, y: 29 }, 40, 30);
    // With innerSize=1: dx=1, dy=1 (clamped)
    expect(result.dx).toBe(1);
    expect(result.dy).toBe(1);
  });

  test("handles zero zone dimensions gracefully", () => {
    // Should not crash; zoneWidth/zoneHeight of 0 uses max(1, ...) guard
    const result = playerDotOffset({ x: 0, y: 0 }, 0, 0);
    expect(result.dx).toBe(1);
    expect(result.dy).toBe(1);
  });

  test("handles negative player position", () => {
    // Negative positions clamp to 0
    const result = playerDotOffset({ x: -5, y: -10 }, 40, 30);
    expect(result.dx).toBe(1);
    expect(result.dy).toBe(1);
  });

  test("player position beyond zone dimensions clamps", () => {
    // Position beyond zone width/height clamps to max inner pixel
    const result = playerDotOffset({ x: 100, y: 100 }, 40, 30);
    expect(result.dx).toBe(1);
    expect(result.dy).toBe(1);
  });
});
