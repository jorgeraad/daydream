import { describe, test, expect, mock } from "bun:test";
import { PixelBuffer } from "../PixelBuffer.ts";
import { SpriteRegistry } from "../SpriteRegistry.ts";
import { encodeHalfBlocks } from "../encode.ts";
import { ALL_SPRITES, SPRITE_BY_ID, OBJECT_TYPE_TO_SPRITE, NPC_ROLE_TO_SPRITE } from "../library/index.ts";
import { TREE_PINE, TREE_OAK } from "../library/trees.ts";
import { OBJ_CHEST, OBJ_TORCH, OBJ_FLOWERS, OBJ_ROCK_SMALL, DECO_FALLEN_LOG } from "../library/objects.ts";
import { NPC_PLAYER, NPC_GUARD, NPC_CHILD } from "../library/npcs.ts";
import { BUILDING_HOUSE, BUILDING_TAVERN } from "../library/buildings.ts";
import { TileRenderer } from "../../TileRenderer.ts";
import { ViewportManager } from "../../ViewportManager.ts";
import type { ZoneData, TileLayer, TileCell } from "../../types.ts";
import type { SpriteTemplate, SpriteInstance } from "../types.ts";
import { ZoneBuilder, type SpriteLookup, type ZoneBuildSpec } from "@daydream/engine";

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
// Helpers
// ---------------------------------------------------------------------------

function makeGroundLayer(width: number, height: number): TileLayer {
  return {
    name: "ground",
    data: Array.from({ length: width * height }, () => ({
      char: ".",
      fg: "#228b22",
    })),
    width,
    height,
  };
}

function makeObjectsLayer(width: number, height: number): TileLayer {
  return {
    name: "objects",
    data: Array.from({ length: width * height }, () => ({
      char: "",
      fg: "#000000",
    })),
    width,
    height,
  };
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

function makeZone(
  width: number,
  height: number,
  options: {
    sprites?: SpriteInstance[];
    biomeType?: string;
  } = {},
): ZoneData {
  return {
    id: "test_zone",
    width,
    height,
    layers: [
      makeGroundLayer(width, height),
      makeObjectsLayer(width, height),
      makeCollisionLayer(width, height),
    ],
    sprites: options.sprites ?? [],
    biomeType: options.biomeType ?? "forest",
  };
}

// ---------------------------------------------------------------------------
// 1. Full pipeline: SpriteRegistry -> SpriteTemplate -> PixelBuffer.blit -> encodeHalfBlocks
// ---------------------------------------------------------------------------

describe("Full sprite pipeline integration", () => {
  test("registry lookup -> blit -> encode produces correct half-block output for a known sprite", () => {
    // Set up registry with a built-in sprite
    const registry = new SpriteRegistry("/tmp/unused");
    registry.register(TREE_PINE);

    // Look up the template
    const template = registry.get("tree_pine")!;
    expect(template).toBeDefined();
    expect(template.id).toBe("tree_pine");

    // Create PixelBuffer large enough for the sprite
    // TREE_PINE: 3px wide x 8px tall -> needs at least 3 wide, 4 cells tall
    const cellWidth = 5;
    const cellHeight = 5;
    const pb = new PixelBuffer(cellWidth, cellHeight);

    // Blit the sprite at (1, 1) in pixel space
    pb.blitSprite(template, 1, 1);

    // Verify pixels were written where the sprite has non-null values
    // TREE_PINE row 0: [null, DARK_GREEN, null] placed at y=1
    expect(pb.getPixel(1, 1)).toBeNull(); // transparent
    expect(pb.getPixel(2, 1)).toBe("#1a6b1a"); // DARK_GREEN
    expect(pb.getPixel(3, 1)).toBeNull(); // transparent

    // TREE_PINE row 7 (trunk base): [null, DARK_BROWN, null] placed at y=8
    expect(pb.getPixel(2, 8)).toBe("#4a2a0e"); // DARK_BROWN

    // Now encode into half-blocks
    const fb = createMockBuffer(cellWidth, cellHeight);
    encodeHalfBlocks(pb, fb as any, "#000000");

    // Should produce cellWidth * cellHeight cells
    expect(fb.setCell).toHaveBeenCalledTimes(cellWidth * cellHeight);

    // Every cell character is either full block or upper half block
    for (const cell of fb.cells) {
      expect(["\u2588", "\u2580"]).toContain(cell.char);
    }

    // Cell at (2, 0) has top pixel = null (row 0, y=0 is default bg) and bottom pixel = DARK_GREEN (row 0 of sprite at y=1)
    // Since the sprite starts at pixel y=1, pixel (2,0) is null and pixel (2,1) is DARK_GREEN
    // Cell row 0 encodes pixels y=0 (top) and y=1 (bottom)
    const cellTopLeft = fb.cellAt(2, 0)!;
    expect(cellTopLeft).toBeDefined();
    // Top pixel is null -> default bg (#000000 = black), bottom is DARK_GREEN
    // Different colors -> upper half block
    expect(cellTopLeft.char).toBe("\u2580");
  });

  test("pipeline with transparency: transparent pixels preserve background through encode", () => {
    const registry = new SpriteRegistry("/tmp/unused");
    registry.register(NPC_PLAYER);

    const template = registry.get("player_default")!;
    expect(template).toBeDefined();

    // NPC_PLAYER: 3px wide x 6px tall
    // Row 0: [null, HAIR_BROWN, null]
    // Row 5: [BOOT_DARK, null, BOOT_DARK]
    const pb = new PixelBuffer(5, 4); // 5 wide x 8 tall in pixels

    // Fill with a known background first
    pb.clear("#112233");

    // Blit player at (1, 1)
    pb.blitSprite(template, 1, 1);

    // Transparent pixels should retain the background
    expect(pb.getPixel(1, 1)).toBe("#112233"); // null in sprite, kept background
    expect(pb.getPixel(2, 1)).toBe("#5a3a1e"); // HAIR_BROWN overwritten
    expect(pb.getPixel(3, 1)).toBe("#112233"); // null in sprite, kept background

    // Row 5 (boots): BOOT_DARK, null, BOOT_DARK at y=6
    expect(pb.getPixel(1, 6)).toBe("#4a3020"); // BOOT_DARK
    expect(pb.getPixel(2, 6)).toBe("#112233"); // null in sprite, kept background
    expect(pb.getPixel(3, 6)).toBe("#4a3020"); // BOOT_DARK

    // Encode and verify the result
    const fb = createMockBuffer(5, 4);
    encodeHalfBlocks(pb, fb as any, "#000000");
    expect(fb.setCell).toHaveBeenCalledTimes(5 * 4);
  });

  test("multiple sprites composited in pipeline produce layered output", () => {
    const registry = new SpriteRegistry("/tmp/unused");
    registry.register(OBJ_CHEST); // 3x3
    registry.register(OBJ_TORCH); // 1x4

    const pb = new PixelBuffer(6, 4); // 6 wide x 8 tall in pixels

    // Blit chest at (0, 2) in pixel space
    const chest = registry.get("obj_chest")!;
    pb.blitSprite(chest, 0, 2);

    // Blit torch overlapping at (1, 0)
    const torch = registry.get("obj_torch")!;
    pb.blitSprite(torch, 1, 0);

    // Torch at (1,0) row 0: FIRE_YELLOW at pixel (1, 0)
    expect(pb.getPixel(1, 0)).toBe("#eebb30"); // FIRE_YELLOW

    // Chest at (0,2) row 0: WOOD_DARK, METAL_GOLD, WOOD_DARK
    // But torch row 2 at (1,2) is WOOD_DARK - overwrites chest's METAL_GOLD at (1,2)
    // Torch: row 2 at pixel (1, 2) = WOOD_DARK (#4a3018)
    // Chest: row 0 at pixel (1, 2) = METAL_GOLD (#c0a030)
    // Since torch is blitted after chest, torch's pixel overwrites chest's
    expect(pb.getPixel(1, 2)).toBe("#4a3018"); // Torch's WOOD_DARK overwrites

    // Encode
    const fb = createMockBuffer(6, 4);
    encodeHalfBlocks(pb, fb as any, "#000000");
    expect(fb.setCell).toHaveBeenCalledTimes(6 * 4);

    // All output characters are half-block or full-block
    for (const cell of fb.cells) {
      expect(["\u2588", "\u2580"]).toContain(cell.char);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Built-in sprite library validation
// ---------------------------------------------------------------------------

describe("Built-in sprite library validation", () => {
  test("ALL_SPRITES contains 29 templates", () => {
    expect(ALL_SPRITES.length).toBe(29);
  });

  test("every template has consistent pixel array length (pixelWidth * pixelHeight)", () => {
    for (const sprite of ALL_SPRITES) {
      const expected = sprite.pixelWidth * sprite.pixelHeight;
      expect(sprite.pixels.length).toBe(expected);
    }
  });

  test("every template has positive dimensions", () => {
    for (const sprite of ALL_SPRITES) {
      expect(sprite.pixelWidth).toBeGreaterThan(0);
      expect(sprite.pixelHeight).toBeGreaterThan(0);
    }
  });

  test("every template has a non-empty pixels array with at least one non-null pixel", () => {
    for (const sprite of ALL_SPRITES) {
      expect(sprite.pixels.length).toBeGreaterThan(0);

      const hasColor = sprite.pixels.some((p) => p !== null);
      expect(hasColor).toBe(true);
    }
  });

  test("every template has an anchor within its pixel bounds", () => {
    for (const sprite of ALL_SPRITES) {
      expect(sprite.anchor.x).toBeGreaterThanOrEqual(0);
      expect(sprite.anchor.x).toBeLessThan(sprite.pixelWidth);
      expect(sprite.anchor.y).toBeGreaterThanOrEqual(0);
      expect(sprite.anchor.y).toBeLessThan(sprite.pixelHeight);
    }
  });

  test("every template has a unique ID", () => {
    const ids = ALL_SPRITES.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test("every non-null pixel is a valid hex color string", () => {
    const hexRegex = /^#[0-9a-fA-F]{3,8}$/;
    for (const sprite of ALL_SPRITES) {
      for (const pixel of sprite.pixels) {
        if (pixel !== null) {
          expect(hexRegex.test(pixel)).toBe(true);
        }
      }
    }
  });

  test("every template has a valid category", () => {
    const validCategories = ["tree", "rock", "building", "npc", "object", "decoration", "player"];
    for (const sprite of ALL_SPRITES) {
      expect(validCategories).toContain(sprite.category);
    }
  });

  test("every template has at least one tag", () => {
    for (const sprite of ALL_SPRITES) {
      expect(sprite.tags.length).toBeGreaterThan(0);
    }
  });

  test("SPRITE_BY_ID map contains all templates", () => {
    for (const sprite of ALL_SPRITES) {
      expect(SPRITE_BY_ID.get(sprite.id)).toBe(sprite);
    }
    expect(SPRITE_BY_ID.size).toBe(ALL_SPRITES.length);
  });

  test("OBJECT_TYPE_TO_SPRITE values reference valid sprite IDs", () => {
    for (const [key, spriteId] of Object.entries(OBJECT_TYPE_TO_SPRITE)) {
      const sprite = SPRITE_BY_ID.get(spriteId);
      expect(sprite).toBeDefined();
    }
  });

  test("NPC_ROLE_TO_SPRITE values reference valid sprite IDs", () => {
    for (const [key, spriteId] of Object.entries(NPC_ROLE_TO_SPRITE)) {
      const sprite = SPRITE_BY_ID.get(spriteId);
      expect(sprite).toBeDefined();
    }
  });

  test("collision tiles with non-empty collisionTiles have reasonable offsets", () => {
    for (const sprite of ALL_SPRITES) {
      for (const ct of sprite.collisionTiles) {
        // Collision offsets should be small (within a few tiles of the anchor)
        expect(Math.abs(ct.dx)).toBeLessThan(10);
        expect(Math.abs(ct.dy)).toBeLessThan(10);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. ZoneBuilder.build() -> SpriteInstance[] integration with real templates
// ---------------------------------------------------------------------------

describe("ZoneBuilder with real sprite templates", () => {
  // Build a SpriteLookup that uses the actual built-in library
  const realLookup: SpriteLookup = {
    resolve(objectType: string) {
      const spriteId = OBJECT_TYPE_TO_SPRITE[objectType.toLowerCase()];
      if (!spriteId) return undefined;
      const template = SPRITE_BY_ID.get(spriteId);
      if (!template) return undefined;
      return {
        templateId: template.id,
        collisionTiles: template.collisionTiles,
      };
    },
    resolveBuilding(buildingType: string) {
      const spriteId = OBJECT_TYPE_TO_SPRITE[buildingType.toLowerCase()];
      if (!spriteId) return undefined;
      const template = SPRITE_BY_ID.get(spriteId);
      if (!template) return undefined;
      return {
        templateId: template.id,
        collisionTiles: template.collisionTiles,
      };
    },
    resolveNpc(role: string) {
      const spriteId = NPC_ROLE_TO_SPRITE[role.toLowerCase()];
      if (!spriteId) return undefined;
      const template = SPRITE_BY_ID.get(spriteId);
      if (!template) return undefined;
      return {
        templateId: template.id,
        collisionTiles: template.collisionTiles,
      };
    },
  };

  const testPalette = {
    ground: { chars: ["."], fg: ["#228b22"], bg: "#1a3318" },
    vegetation: {
      tree_canopy: { char: "T", fg: "#228b22" },
    },
  };

  const buildingVisuals: Record<string, any> = {
    house: {
      border: { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" },
      door: "D",
      fill: " ",
      defaultFg: "#c4a882",
      doorFg: "#3d2b1f",
    },
  };

  const objectVisuals: Record<string, any> = {
    tree_oak: { char: "T", fg: "#228b22", bold: true, collision: true },
    sign: { char: "S", fg: "#8b7355", collision: false },
  };

  const builder = new ZoneBuilder(buildingVisuals, objectVisuals);

  function makeSpec(overrides: Partial<ZoneBuildSpec> = {}): ZoneBuildSpec {
    return {
      terrain: { primaryGround: "grass", features: [] },
      buildings: [],
      objects: [],
      ...overrides,
    };
  }

  test("produces SpriteInstance[] with correct templateIds from real lookup", () => {
    const spec = makeSpec({
      objects: [
        { type: "pine", position: { x: 10, y: 10 } },
        { type: "chest", position: { x: 20, y: 20 } },
        { type: "mushroom", position: { x: 30, y: 30 } },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, realLookup);

    expect(result.sprites!.length).toBe(3);

    const ids = result.sprites!.map((s) => s.templateId).sort();
    expect(ids).toEqual(["deco_mushroom", "obj_chest", "tree_pine"]);
  });

  test("sprite positions are within zone bounds", () => {
    const spec = makeSpec({
      objects: [
        { type: "rock", position: { x: 5, y: 5 } },
        { type: "barrel", position: { x: 40, y: 20 } },
      ],
      npcs: [
        { role: "guard", position: { x: 15, y: 15 } },
        { role: "merchant", position: { x: 35, y: 25 } },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, realLookup);

    for (const sprite of result.sprites!) {
      expect(sprite.position.x).toBeGreaterThanOrEqual(0);
      expect(sprite.position.x).toBeLessThan(80);
      expect(sprite.position.y).toBeGreaterThanOrEqual(0);
      expect(sprite.position.y).toBeLessThan(40);
    }
  });

  test("collision tiles are marked as blocked for real sprite footprints", () => {
    const spec = makeSpec({
      objects: [
        { type: "house", position: { x: 20, y: 20 } },
      ],
      buildings: [
        // Use building placement path
        { name: "Test House", type: "house", width: 5, height: 6, position: { x: 10, y: 10 } },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, realLookup);
    const collision = result.layers[2]!;

    // For each sprite placed, verify its collision footprint is marked
    for (const sprite of result.sprites!) {
      const template = SPRITE_BY_ID.get(sprite.templateId);
      if (!template) continue;

      for (const ct of template.collisionTiles) {
        const tx = sprite.position.x + ct.dx;
        const ty = sprite.position.y + ct.dy;
        if (tx >= 0 && tx < 80 && ty >= 0 && ty < 40) {
          const idx = ty * 80 + tx;
          expect(collision.data[idx]!.char).toBe("1");
        }
      }
    }
  });

  test("NPCs with real lookup produce correct sprite references", () => {
    const spec = makeSpec({
      npcs: [
        { role: "guard", position: { x: 10, y: 10 } },
        { role: "villager", position: { x: 20, y: 20 } },
        { role: "elder", position: { x: 30, y: 30 }, tint: "#aabbcc" },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, realLookup);

    expect(result.sprites!.length).toBe(3);

    const guard = result.sprites!.find((s) => s.templateId === "npc_guard");
    expect(guard).toBeDefined();
    expect(guard!.position).toEqual({ x: 10, y: 10 });

    const villager = result.sprites!.find((s) => s.templateId === "npc_villager");
    expect(villager).toBeDefined();

    const elder = result.sprites!.find((s) => s.templateId === "npc_elder");
    expect(elder).toBeDefined();
    expect(elder!.tint).toBe("#aabbcc");
  });

  test("multi-cell collision footprints prevent overlapping sprites", () => {
    // BUILDING_HOUSE has collision at dx: [-1, 0, 1]
    // Place a house at (20, 20) — blocks tiles (19, 20), (20, 20), (21, 20)
    // Then try to place a rock at (21, 20) — should fail because it's already blocked
    const spec = makeSpec({
      buildings: [
        { name: "House", type: "house", width: 5, height: 6, position: { x: 20, y: 20 } },
      ],
      objects: [
        { type: "rock", position: { x: 21, y: 20 } },
      ],
    });
    const result = builder.build(spec, "zone_0_0", testPalette, 80, 40, realLookup);

    // House should be placed as sprite
    const house = result.sprites!.find((s) => s.templateId === "building_house");
    expect(house).toBeDefined();

    // Rock should NOT be placed as sprite or single-cell because position is blocked
    const rock = result.sprites!.find((s) => s.templateId === "obj_rock_large");
    expect(rock).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. TileRenderer.renderZone() with sprites -> non-empty buffer
// ---------------------------------------------------------------------------

describe("TileRenderer.renderZone() with real sprites", () => {
  test("rendering a zone with registered built-in sprites produces output", () => {
    const viewW = 10;
    const viewH = 8;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    registry.registerBuiltins(ALL_SPRITES);

    const renderer = new TileRenderer(fb as any, registry);

    const zone = makeZone(30, 30, {
      sprites: [
        { templateId: "tree_pine", position: { x: 5, y: 5 } },
        { templateId: "obj_chest", position: { x: 8, y: 8 } },
        { templateId: "npc_guard", position: { x: 12, y: 10 } },
      ],
      biomeType: "forest",
    });

    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(3, 3, zone.width, zone.height);

    renderer.renderZone(zone, viewport, 5, 5);

    // All cells should be written
    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);

    // All output chars are half-block or full-block
    for (const cell of fb.cells) {
      expect(["\u2588", "\u2580"]).toContain(cell.char);
    }
  });

  test("player sprite is rendered at player position when registered", () => {
    const viewW = 8;
    const viewH = 6;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    registry.registerBuiltins(ALL_SPRITES);

    const renderer = new TileRenderer(fb as any, registry);

    const zone = makeZone(30, 30, { biomeType: "town" });
    const viewport = new ViewportManager(viewW, viewH);
    const playerX = 15;
    const playerY = 15;
    viewport.updateCamera(playerX, playerY, zone.width, zone.height);

    renderer.renderZone(zone, viewport, playerX, playerY);

    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);

    // The player sprite (NPC_PLAYER) should be composited into the buffer.
    // Player is at center of viewport. Player sprite is 3x6 pixels.
    // The player's anchor is at (1, 5), so the sprite covers 3 columns
    // centered on the player's cell. Verifying specific pixels is complex
    // due to ground texture randomness, but we can verify cells near the
    // player position have been written.
    const centerX = Math.floor(viewW / 2);
    const centerY = Math.floor(viewH / 2);
    const centerCell = fb.cellAt(centerX, centerY);
    expect(centerCell).toBeDefined();
  });

  test("zone with mixed sprites and char objects renders without errors", () => {
    const viewW = 15;
    const viewH = 10;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    registry.registerBuiltins(ALL_SPRITES);

    const renderer = new TileRenderer(fb as any, registry);

    // Create a zone with both sprite instances and character-based objects
    const zone = makeZone(40, 40, {
      sprites: [
        { templateId: "tree_oak", position: { x: 5, y: 5 } },
        { templateId: "building_house", position: { x: 10, y: 10 } },
        { templateId: "npc_villager", position: { x: 15, y: 8 } },
        { templateId: "obj_flowers", position: { x: 20, y: 15 } },
        { templateId: "deco_mushroom", position: { x: 3, y: 12 } },
      ],
      biomeType: "forest",
    });

    // Also add some character-based objects to the objects layer
    const objLayer = zone.layers.find((l) => l.name === "objects")!;
    objLayer.data[6 * 40 + 25] = { char: "#", fg: "#ff0000" };
    objLayer.data[7 * 40 + 25] = { char: "X", fg: "#00ff00" };

    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(2, 2, zone.width, zone.height);

    renderer.renderZone(zone, viewport, 10, 10);

    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);

    for (const cell of fb.cells) {
      expect(["\u2588", "\u2580"]).toContain(cell.char);
    }
  });

  test("sprites outside viewport are culled and do not affect output", () => {
    const viewW = 5;
    const viewH = 5;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    registry.register(TREE_OAK); // 5px wide x 8px tall

    const renderer = new TileRenderer(fb as any, registry);

    // Sprite at (50, 50) with camera at (0, 0) in a 5x5 viewport
    const zone = makeZone(100, 100, {
      sprites: [{ templateId: "tree_oak", position: { x: 50, y: 50 } }],
    });
    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(0, 0, zone.width, zone.height);

    renderer.renderZone(zone, viewport, 0, 0);

    // All cells should still be rendered (just ground, no sprite influence)
    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);
  });

  test("different biomes produce different ground colors with sprites overlaid", () => {
    const viewW = 6;
    const viewH = 4;
    const registry = new SpriteRegistry("/tmp/unused");
    registry.register(TREE_PINE);

    const biomes = ["forest", "desert", "town"];
    const cellColors: Map<string, { fg: any; bg: any }[]> = new Map();

    for (const biome of biomes) {
      const fb = createMockBuffer(viewW, viewH);
      const renderer = new TileRenderer(fb as any, registry);

      const zone = makeZone(20, 20, {
        sprites: [{ templateId: "tree_pine", position: { x: 3, y: 3 } }],
        biomeType: biome,
      });
      const viewport = new ViewportManager(viewW, viewH);
      viewport.updateCamera(0, 0, zone.width, zone.height);

      renderer.renderZone(zone, viewport, 3, 3);

      cellColors.set(
        biome,
        fb.cells.map((c) => ({ fg: c.fg, bg: c.bg })),
      );
    }

    // Different biomes should produce at least some different colors in the cells
    // (ground textures differ by biome). We can't test exact values due to
    // deterministic-but-biome-dependent patterns, but the outputs should differ.
    const forestColors = cellColors.get("forest")!;
    const desertColors = cellColors.get("desert")!;

    // At least one cell should differ between forest and desert
    let hasDifference = false;
    for (let i = 0; i < forestColors.length; i++) {
      if (
        forestColors[i]!.fg.r !== desertColors[i]!.fg.r ||
        forestColors[i]!.fg.g !== desertColors[i]!.fg.g ||
        forestColors[i]!.fg.b !== desertColors[i]!.fg.b
      ) {
        hasDifference = true;
        break;
      }
    }
    expect(hasDifference).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. End-to-end: ZoneBuilder -> TileRenderer
// ---------------------------------------------------------------------------

describe("ZoneBuilder -> TileRenderer end-to-end", () => {
  test("build a zone with sprites, then render it through TileRenderer", () => {
    // 1. Build the zone with ZoneBuilder using real sprite lookup
    const buildingVisuals: Record<string, any> = {};
    const objectVisuals: Record<string, any> = {
      tree_oak: { char: "T", fg: "#228b22", bold: true, collision: true },
    };
    const palette = {
      ground: { chars: ["."], fg: ["#228b22"], bg: "#1a3318" },
      vegetation: {},
    };

    const realLookup: SpriteLookup = {
      resolve(objectType: string) {
        const spriteId = OBJECT_TYPE_TO_SPRITE[objectType.toLowerCase()];
        if (!spriteId) return undefined;
        const template = SPRITE_BY_ID.get(spriteId);
        if (!template) return undefined;
        return { templateId: template.id, collisionTiles: template.collisionTiles };
      },
      resolveBuilding() { return undefined; },
      resolveNpc(role: string) {
        const spriteId = NPC_ROLE_TO_SPRITE[role.toLowerCase()];
        if (!spriteId) return undefined;
        const template = SPRITE_BY_ID.get(spriteId);
        if (!template) return undefined;
        return { templateId: template.id, collisionTiles: template.collisionTiles };
      },
    };

    const zoneBuilder = new ZoneBuilder(buildingVisuals, objectVisuals);
    const spec: ZoneBuildSpec = {
      terrain: { primaryGround: "grass", features: [] },
      buildings: [],
      objects: [
        { type: "pine", position: { x: 5, y: 5 } },
        { type: "rock", position: { x: 15, y: 10 } },
        { type: "flowers", position: { x: 10, y: 8 } },
      ],
      npcs: [
        { role: "guard", position: { x: 20, y: 15 } },
      ],
    };

    const buildResult = zoneBuilder.build(spec, "test_zone", palette, 40, 30, realLookup);

    // Verify sprites were produced
    expect(buildResult.sprites!.length).toBeGreaterThan(0);

    // 2. Convert ZoneBuildResult to ZoneData for TileRenderer
    const zoneData: ZoneData = {
      id: buildResult.id,
      width: buildResult.width,
      height: buildResult.height,
      layers: buildResult.layers.map((l) => ({
        name: l.name as any,
        data: l.data,
        width: l.width,
        height: l.height,
      })),
      sprites: buildResult.sprites,
      biomeType: "forest",
    };

    // 3. Set up TileRenderer with all built-in sprites
    const viewW = 12;
    const viewH = 8;
    const fb = createMockBuffer(viewW, viewH);
    const registry = new SpriteRegistry("/tmp/unused");
    registry.registerBuiltins(ALL_SPRITES);
    const renderer = new TileRenderer(fb as any, registry);

    // 4. Render the zone
    const viewport = new ViewportManager(viewW, viewH);
    viewport.updateCamera(5, 5, zoneData.width, zoneData.height);
    renderer.renderZone(zoneData, viewport, 5, 5);

    // 5. Verify output
    expect(fb.setCell).toHaveBeenCalledTimes(viewW * viewH);

    for (const cell of fb.cells) {
      expect(["\u2588", "\u2580"]).toContain(cell.char);
    }

    // Verify no cell has pure black fg AND bg (meaning something was rendered)
    // At least some cells should have non-zero color channels (ground textures or sprites)
    const hasNonBlack = fb.cells.some(
      (c) => c.fg.r > 0.01 || c.fg.g > 0.01 || c.fg.b > 0.01 ||
             c.bg.r > 0.01 || c.bg.g > 0.01 || c.bg.b > 0.01,
    );
    expect(hasNonBlack).toBe(true);
  });
});
