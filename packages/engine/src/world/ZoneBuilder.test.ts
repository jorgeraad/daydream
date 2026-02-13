import { describe, test, expect } from "bun:test";
import { ZoneBuilder, type ZoneBuildSpec, type BuildingVisual, type ObjectVisual, type SpriteLookup } from "./ZoneBuilder.ts";
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

  test("always includes sprites array in result", () => {
    const result = builder.build(makeSpec(), "zone_0_0", testPalette);
    expect(result.sprites).toBeInstanceOf(Array);
    expect(result.sprites).toHaveLength(0);
  });
});

// ── Sprite placement tests ──────────────────────────────────

describe("ZoneBuilder with SpriteLookup", () => {
  const builder = new ZoneBuilder(testBuildingVisuals, testObjectVisuals);

  const testLookup: SpriteLookup = {
    resolve(objectType: string) {
      if (objectType === "tree_oak") {
        return {
          templateId: "sprite_tree_oak",
          collisionTiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }],
        };
      }
      if (objectType === "rock_large") {
        return {
          templateId: "sprite_rock",
          collisionTiles: [{ dx: 0, dy: 0 }],
        };
      }
      return undefined;
    },
    resolveBuilding(buildingType: string) {
      if (buildingType === "house") {
        return {
          templateId: "sprite_house",
          collisionTiles: [
            { dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 },
            { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 },
          ],
        };
      }
      return undefined;
    },
    resolveNpc(role: string) {
      if (role === "guard") {
        return {
          templateId: "sprite_guard",
          collisionTiles: [{ dx: 0, dy: 0 }],
        };
      }
      return undefined;
    },
  };

  test("places object as sprite when lookup resolves", () => {
    const spec = makeSpec({
      objects: [{ type: "tree_oak", position: { x: 10, y: 10 } }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    // Should have a sprite instance instead of a tile
    expect(result.sprites).toHaveLength(1);
    expect(result.sprites![0]!.templateId).toBe("sprite_tree_oak");
    expect(result.sprites![0]!.position).toEqual({ x: 10, y: 10 });

    // Object layer should NOT have the single-cell tile
    const objects = result.layers[1]!;
    expect(objects.data[10 * 80 + 10]!.char).toBe("");
  });

  test("marks sprite collision tiles as blocked", () => {
    const spec = makeSpec({
      objects: [{ type: "tree_oak", position: { x: 10, y: 10 } }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);
    const collision = result.layers[2]!;

    // tree_oak sprite blocks (10,10) and (11,10)
    expect(collision.data[10 * 80 + 10]!.char).toBe("1");
    expect(collision.data[10 * 80 + 11]!.char).toBe("1");
  });

  test("falls back to single-cell when sprite lookup returns undefined", () => {
    const spec = makeSpec({
      objects: [{ type: "sign", position: { x: 20, y: 20 } }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    // "sign" not in lookup, so should fall back to single-cell
    expect(result.sprites).toHaveLength(0);
    const objects = result.layers[1]!;
    expect(objects.data[20 * 80 + 20]!.char).toBe("┬");
  });

  test("falls back to single-cell when sprite collision tiles overlap", () => {
    const spec = makeSpec({
      objects: [
        { type: "tree_oak", position: { x: 10, y: 10 } },
        // Second tree at x=12 — its anchor at (12,10) is clear, but collision dx:1 → (13,10) is also clear
        // so it will succeed. Use x=11 instead, whose own position is blocked by first tree's dx:1.
        { type: "tree_oak", position: { x: 11, y: 10 } },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    // First tree placed as sprite
    expect(result.sprites).toHaveLength(1);
    expect(result.sprites![0]!.templateId).toBe("sprite_tree_oak");
    expect(result.sprites![0]!.position).toEqual({ x: 10, y: 10 });

    // Second tree at (11,10): anchor cell is already blocked by first tree's collision footprint.
    // placeObject early-returns because collision[y*w+x] is "1".
    // Objects layer should still be empty at that position.
    const objects = result.layers[1]!;
    expect(objects.data[10 * 80 + 11]!.char).toBe("");
  });

  test("second sprite fails collision check and uses single-cell fallback", () => {
    // Use rock_large which has only a single collision tile at (0,0)
    // Place a tree_oak at (10,10) — blocks (10,10) and (11,10)
    // Then place rock_large at (11,10) — anchor blocked, so it early-returns
    // Then place rock_large at (12,10) — anchor clear, sprite resolves, placed as sprite
    const spec = makeSpec({
      objects: [
        { type: "tree_oak", position: { x: 10, y: 10 } },
        { type: "rock_large", position: { x: 12, y: 10 } },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    expect(result.sprites).toHaveLength(2);
    expect(result.sprites![0]!.templateId).toBe("sprite_tree_oak");
    expect(result.sprites![1]!.templateId).toBe("sprite_rock");
  });

  test("places building as sprite when lookup resolves", () => {
    const spec = makeSpec({
      buildings: [
        { name: "Sprite House", type: "house", width: 6, height: 4, position: { x: 5, y: 5 } },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    expect(result.sprites).toHaveLength(1);
    expect(result.sprites![0]!.templateId).toBe("sprite_house");
    expect(result.sprites![0]!.position).toEqual({ x: 5, y: 5 });

    // Object layer should NOT have box-drawing characters
    const objects = result.layers[1]!;
    expect(objects.data[5 * 80 + 5]!.char).toBe("");
  });

  test("building sprite collision tiles are blocked", () => {
    const spec = makeSpec({
      buildings: [
        { name: "Sprite House", type: "house", width: 6, height: 4, position: { x: 5, y: 5 } },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);
    const collision = result.layers[2]!;

    // house sprite blocks a 3x2 area at (5,5)
    expect(collision.data[5 * 80 + 5]!.char).toBe("1");
    expect(collision.data[5 * 80 + 6]!.char).toBe("1");
    expect(collision.data[5 * 80 + 7]!.char).toBe("1");
    expect(collision.data[6 * 80 + 5]!.char).toBe("1");
    expect(collision.data[6 * 80 + 6]!.char).toBe("1");
    expect(collision.data[6 * 80 + 7]!.char).toBe("1");
  });

  test("building falls back to box-drawing when lookup returns undefined", () => {
    const lookupNoBuildings: SpriteLookup = {
      resolve: () => undefined,
      resolveBuilding: () => undefined,
      resolveNpc: () => undefined,
    };
    const spec = makeSpec({
      buildings: [
        { name: "Fallback House", type: "house", width: 6, height: 4, position: { x: 10, y: 10 } },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, lookupNoBuildings);

    // No sprites, box-drawing should be present
    expect(result.sprites).toHaveLength(0);
    const objects = result.layers[1]!;
    expect(objects.data[10 * 80 + 10]!.char).toBe("╔");
  });

  test("places NPC as sprite when lookup resolves", () => {
    const spec = makeSpec({
      npcs: [{ role: "guard", position: { x: 15, y: 15 } }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    expect(result.sprites).toHaveLength(1);
    expect(result.sprites![0]!.templateId).toBe("sprite_guard");
    expect(result.sprites![0]!.position).toEqual({ x: 15, y: 15 });
  });

  test("NPC sprite collision tiles are blocked", () => {
    const spec = makeSpec({
      npcs: [{ role: "guard", position: { x: 15, y: 15 } }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);
    const collision = result.layers[2]!;

    expect(collision.data[15 * 80 + 15]!.char).toBe("1");
  });

  test("NPC tint is passed through to sprite instance", () => {
    const spec = makeSpec({
      npcs: [{ role: "guard", position: { x: 15, y: 15 }, tint: "#ff0000" }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    expect(result.sprites).toHaveLength(1);
    expect(result.sprites![0]!.tint).toBe("#ff0000");
  });

  test("NPC without tint does not include tint field", () => {
    const spec = makeSpec({
      npcs: [{ role: "guard", position: { x: 15, y: 15 } }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    expect(result.sprites).toHaveLength(1);
    expect(result.sprites![0]!.tint).toBeUndefined();
  });

  test("NPC is skipped when lookup returns undefined", () => {
    const spec = makeSpec({
      npcs: [{ role: "merchant", position: { x: 15, y: 15 } }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    // "merchant" not in lookup, NPC is silently skipped
    expect(result.sprites).toHaveLength(0);
  });

  test("NPC is skipped when out of bounds", () => {
    const spec = makeSpec({
      npcs: [{ role: "guard", position: { x: -1, y: 50 } }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    expect(result.sprites).toHaveLength(0);
  });

  test("sprite placement rejected when collision tile is out of bounds", () => {
    const spec = makeSpec({
      objects: [{ type: "tree_oak", position: { x: 79, y: 10 } }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    // tree_oak has collision at dx:1 — position x=79 + dx=1 = 80 is out of bounds
    // Should fall back to single-cell
    expect(result.sprites).toHaveLength(0);
    const objects = result.layers[1]!;
    expect(objects.data[10 * 80 + 79]!.char).toBe("♣");
  });

  test("uses normalized object type for sprite lookup", () => {
    const spec = makeSpec({
      objects: [{ type: "tree", position: { x: 10, y: 10 } }],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    // "tree" normalizes to "tree_oak", which the lookup knows
    expect(result.sprites).toHaveLength(1);
    expect(result.sprites![0]!.templateId).toBe("sprite_tree_oak");
  });

  test("mixes sprites and single-cell objects in same build", () => {
    const spec = makeSpec({
      objects: [
        { type: "tree_oak", position: { x: 10, y: 10 } },
        { type: "sign", position: { x: 20, y: 20 } },
        { type: "rock_large", position: { x: 30, y: 30 } },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, testLookup);

    // tree_oak and rock_large as sprites, sign as single-cell
    expect(result.sprites).toHaveLength(2);
    expect(result.sprites!.map((s) => s.templateId).sort()).toEqual(["sprite_rock", "sprite_tree_oak"]);

    const objects = result.layers[1]!;
    expect(objects.data[20 * 80 + 20]!.char).toBe("┬");
  });

  test("without spriteLookup, build still works (backward compat)", () => {
    const spec = makeSpec({
      objects: [{ type: "tree_oak", position: { x: 10, y: 10 } }],
      buildings: [
        { name: "House", type: "house", width: 6, height: 4, position: { x: 20, y: 20 } },
      ],
    });
    // No spriteLookup argument
    const result = builder.build(spec, "zone_0_0", testPalette);

    // Should use single-cell placement
    expect(result.sprites).toHaveLength(0);
    const objects = result.layers[1]!;
    expect(objects.data[10 * 80 + 10]!.char).toBe("♣");
    expect(objects.data[20 * 80 + 20]!.char).toBe("╔");
  });
});
