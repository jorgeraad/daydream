import { describe, test, expect } from "bun:test";
import { ZoneBuilder, type ZoneBuildSpec, type BuildingVisual, type ObjectVisual } from "./ZoneBuilder.ts";
import type { BiomePalette } from "../types.ts";

// ── Test fixtures ────────────────────────────────────────────

const testPalette: BiomePalette = {
  ground: {
    chars: [".", ","],
    fg: ["#2d5a27", "#3a7a33"],
    bg: "#1a3318",
  },
  vegetation: {
    tree_canopy: { char: "♣", fg: "#228b22", variants: ["♠"] },
    bush: { char: "※", fg: "#3a7a33" },
    flower: { char: "✿", fg: "#ff69b4" },
  },
  water: {
    chars: ["~", "≈"],
    fg: ["#4a8bc7"],
    bg: "#1a3a5a",
    animated: true,
  },
  path: {
    chars: ["░"],
    fg: "#8b7355",
    bg: "#5a4a35",
  },
};

const testBuildingVisuals: Record<string, BuildingVisual> = {
  house: {
    border: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
    door: "╤",
    fill: " ",
    defaultFg: "#c4a882",
    doorFg: "#3d2b1f",
  },
};

const testObjectVisuals: Record<string, ObjectVisual> = {
  tree_oak: { char: "♣", fg: "#228b22", bold: true, collision: true },
  rock_large: { char: "●", fg: "#6a6a6a", bold: true, collision: true },
  sign: { char: "┬", fg: "#8b7355", collision: false },
};

function makeSpec(overrides: Partial<ZoneBuildSpec> = {}): ZoneBuildSpec {
  return {
    terrain: {
      primaryGround: "grass",
      features: [],
    },
    buildings: [],
    objects: [],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("ZoneBuilder", () => {
  const builder = new ZoneBuilder(testBuildingVisuals, testObjectVisuals);

  test("builds a zone with correct dimensions", () => {
    const result = builder.build(makeSpec(), "zone_0_0", testPalette);
    expect(result.id).toBe("zone_0_0");
    expect(result.width).toBe(80);
    expect(result.height).toBe(40);
  });

  test("creates three layers: ground, objects, collision", () => {
    const result = builder.build(makeSpec(), "zone_0_0", testPalette);
    expect(result.layers).toHaveLength(3);
    expect(result.layers.map((l) => l.name)).toEqual(["ground", "objects", "collision"]);
  });

  test("fills ground layer with palette tiles", () => {
    const result = builder.build(makeSpec(), "zone_0_0", testPalette);
    const ground = result.layers[0]!;

    // Every ground cell should have a char from the palette
    for (let i = 0; i < ground.data.length; i++) {
      const cell = ground.data[i]!;
      expect(testPalette.ground.chars).toContain(cell.char);
      expect(testPalette.ground.fg).toContain(cell.fg);
      expect(cell.bg).toBe(testPalette.ground.bg);
    }
  });

  test("ground layer has correct size", () => {
    const result = builder.build(makeSpec(), "zone_0_0", testPalette);
    const ground = result.layers[0]!;
    expect(ground.data.length).toBe(80 * 40);
    expect(ground.width).toBe(80);
    expect(ground.height).toBe(40);
  });

  test("returns a passable spawn point", () => {
    const result = builder.build(makeSpec(), "zone_0_0", testPalette);
    const collision = result.layers[2]!;
    const idx = result.spawnPoint.y * result.width + result.spawnPoint.x;
    expect(collision.data[idx]!.char).not.toBe("1");
  });

  test("places a building with correct borders", () => {
    const spec = makeSpec({
      buildings: [
        { name: "Test House", type: "house", width: 6, height: 4, position: { x: 10, y: 10 } },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette);
    const objects = result.layers[1]!;
    const collision = result.layers[2]!;

    // Top-left corner
    expect(objects.data[10 * 80 + 10]!.char).toBe("╔");
    // Top-right corner
    expect(objects.data[10 * 80 + 15]!.char).toBe("╗");
    // Bottom-left corner
    expect(objects.data[13 * 80 + 10]!.char).toBe("╚");
    // Bottom-right corner
    expect(objects.data[13 * 80 + 15]!.char).toBe("╝");

    // Building cells are blocked
    expect(collision.data[10 * 80 + 10]!.char).toBe("1");

    // Door at bottom center is passable
    const doorX = 10 + Math.floor(6 / 2);
    const doorIdx = 13 * 80 + doorX;
    expect(objects.data[doorIdx]!.char).toBe("╤");
    expect(collision.data[doorIdx]!.char).not.toBe("1");
  });

  test("places objects with collision from visual definitions", () => {
    const spec = makeSpec({
      objects: [
        { type: "tree_oak", position: { x: 5, y: 5 } },
        { type: "sign", position: { x: 20, y: 20 } },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette);
    const objects = result.layers[1]!;
    const collision = result.layers[2]!;

    // Tree should be placed and block collision
    expect(objects.data[5 * 80 + 5]!.char).toBe("♣");
    expect(collision.data[5 * 80 + 5]!.char).toBe("1");

    // Sign should be placed but not block
    expect(objects.data[20 * 80 + 20]!.char).toBe("┬");
    expect(collision.data[20 * 80 + 20]!.char).not.toBe("1");
  });

  test("normalizes object types (tree → tree_oak)", () => {
    const spec = makeSpec({
      objects: [{ type: "tree", position: { x: 15, y: 15 } }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette);
    const objects = result.layers[1]!;

    // "tree" normalizes to "tree_oak"
    expect(objects.data[15 * 80 + 15]!.char).toBe("♣");
  });

  test("places path terrain features", () => {
    const spec = makeSpec({
      terrain: {
        primaryGround: "grass",
        features: [{ type: "path", description: "A winding path through the zone" }],
      },
    });
    const result = builder.build(spec, "zone_0_0", testPalette);
    const ground = result.layers[0]!;

    // At least some cells should have path palette values
    const pathCells = ground.data.filter(
      (cell) => cell.bg === testPalette.path!.bg,
    );
    expect(pathCells.length).toBeGreaterThan(0);
  });

  test("places water terrain features", () => {
    const spec = makeSpec({
      terrain: {
        primaryGround: "grass",
        features: [{ type: "pond", description: "A small pond" }],
      },
    });
    const result = builder.build(spec, "zone_0_0", testPalette);
    const ground = result.layers[0]!;
    const collision = result.layers[2]!;

    // At least some cells should have water palette values
    const waterCells = ground.data.filter(
      (cell) => cell.bg === testPalette.water!.bg,
    );
    expect(waterCells.length).toBeGreaterThan(0);

    // Water cells should be blocked
    const blockedWater = ground.data.filter(
      (cell, i) => cell.bg === testPalette.water!.bg && collision.data[i]!.char === "1",
    );
    expect(blockedWater.length).toBe(waterCells.length);
  });

  test("supports custom zone dimensions", () => {
    const result = builder.build(makeSpec(), "zone_0_0", testPalette, 40, 20);
    expect(result.width).toBe(40);
    expect(result.height).toBe(20);
    expect(result.layers[0]!.data.length).toBe(40 * 20);
  });

  test("clamps building positions to zone bounds", () => {
    const spec = makeSpec({
      buildings: [
        { name: "Edge House", type: "house", width: 6, height: 4, position: { x: 78, y: 38 } },
      ],
    });
    // Should not throw — building gets clamped
    const result = builder.build(spec, "zone_0_0", testPalette);
    expect(result.layers).toHaveLength(3);
  });

  test("skips objects at out-of-bounds positions", () => {
    const spec = makeSpec({
      objects: [{ type: "rock_large", position: { x: -5, y: 100 } }],
    });
    // Should not throw
    const result = builder.build(spec, "zone_0_0", testPalette);
    expect(result.layers).toHaveLength(3);
  });

  test("falls back to vegetation match for unknown object types", () => {
    const spec = makeSpec({
      objects: [{ type: "bush", position: { x: 10, y: 10 } }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette);
    const objects = result.layers[1]!;

    // "bush" matches the palette vegetation key
    expect(objects.data[10 * 80 + 10]!.char).toBe("※");
  });
});
