import { describe, test, expect } from "bun:test";
import type { Direction, TileCell, TileLayer, Zone } from "../types.ts";
import type { EdgeSignature } from "./ZoneManager.ts";
import {
  classifyTerrain,
  extractEdgeSignature,
  extractEdgeSignatureFromBuildResult,
  blendEdge,
  applyEdgeCoherence,
  lerpColor,
  oppositeDirection,
  type TerrainType,
} from "./EdgeCoherence.ts";
import type { ZoneBuildResult } from "./ZoneBuilder.ts";

// ── Helpers ─────────────────────────────────────────────────────

function makeGroundLayer(
  width: number,
  height: number,
  fill?: Partial<TileCell>,
): TileLayer {
  const base: TileCell = { char: ",", fg: "#228b22", bg: "#1a3a1a", ...fill };
  const data: TileCell[] = new Array(width * height);
  for (let i = 0; i < data.length; i++) {
    data[i] = { ...base };
  }
  return { name: "ground", data, width, height };
}

function makeCollisionLayer(width: number, height: number): TileLayer {
  const passable: TileCell = { char: "0", fg: "#000000" };
  const data: TileCell[] = new Array(width * height);
  for (let i = 0; i < data.length; i++) {
    data[i] = { ...passable };
  }
  return { name: "collision", data, width, height };
}

function makeZone(
  width: number,
  height: number,
  groundFill?: Partial<TileCell>,
): Zone {
  return {
    id: "zone_0_0",
    coords: { x: 0, y: 0 },
    biome: {
      type: "forest",
      terrain: { primary: "grass", secondary: "dirt", features: [] },
      palette: {
        ground: { chars: [","], fg: ["#228b22"], bg: "#1a3a1a" },
        vegetation: {},
      },
      density: { vegetation: 0.5, structures: 0.2, characters: 0.1 },
      ambient: { lighting: "natural" },
    },
    tiles: [
      makeGroundLayer(width, height, groundFill),
      { name: "objects", data: new Array(width * height).fill({ char: "", fg: "#000000" }), width, height },
      makeCollisionLayer(width, height),
    ],
    characters: [],
    buildings: [],
    objects: [],
    exits: [],
    generated: true,
    generationSeed: "test",
    lastVisited: Date.now(),
    metadata: { description: "Test zone" },
  };
}

function setTileAt(layer: TileLayer, x: number, y: number, tile: TileCell): void {
  layer.data[y * layer.width + x] = tile;
}

function getTileAtLayer(layer: TileLayer, x: number, y: number): TileCell {
  return layer.data[y * layer.width + x]!;
}

// ── Tests ───────────────────────────────────────────────────────

describe("classifyTerrain", () => {
  test("classifies water characters", () => {
    expect(classifyTerrain({ char: "~", fg: "#0000ff" })).toBe("water");
    expect(classifyTerrain({ char: "\u2248", fg: "#0000ff" })).toBe("water"); // ≈
  });

  test("classifies path characters", () => {
    expect(classifyTerrain({ char: ".", fg: "#888888" })).toBe("path");
    expect(classifyTerrain({ char: "\u00B7", fg: "#888888" })).toBe("path"); // ·
    expect(classifyTerrain({ char: ":", fg: "#888888" })).toBe("path");
  });

  test("classifies wall characters", () => {
    expect(classifyTerrain({ char: "#", fg: "#808080" })).toBe("wall");
    expect(classifyTerrain({ char: "\u2588", fg: "#808080" })).toBe("wall"); // █
  });

  test("classifies building characters", () => {
    expect(classifyTerrain({ char: "+", fg: "#8b4513" })).toBe("building");
    expect(classifyTerrain({ char: "|", fg: "#8b4513" })).toBe("building");
    expect(classifyTerrain({ char: "-", fg: "#8b4513" })).toBe("building");
  });

  test("classifies ground characters (default)", () => {
    expect(classifyTerrain({ char: ",", fg: "#228b22" })).toBe("ground");
    expect(classifyTerrain({ char: "'", fg: "#228b22" })).toBe("ground");
    expect(classifyTerrain({ char: " ", fg: "#228b22" })).toBe("ground");
  });
});

describe("oppositeDirection", () => {
  test("returns opposite for each direction", () => {
    expect(oppositeDirection("up")).toBe("down");
    expect(oppositeDirection("down")).toBe("up");
    expect(oppositeDirection("left")).toBe("right");
    expect(oppositeDirection("right")).toBe("left");
  });
});

describe("lerpColor", () => {
  test("t=0 returns first color", () => {
    expect(lerpColor("#ff0000", "#0000ff", 0)).toBe("#ff0000");
  });

  test("t=1 returns second color", () => {
    expect(lerpColor("#ff0000", "#0000ff", 1)).toBe("#0000ff");
  });

  test("t=0.5 returns midpoint", () => {
    const mid = lerpColor("#ff0000", "#0000ff", 0.5);
    // Red = 128 (0x80), Green = 0, Blue = 128 (0x80)
    expect(mid).toBe("#800080");
  });

  test("handles short hex format", () => {
    // #f00 = #ff0000, #00f = #0000ff
    expect(lerpColor("#f00", "#00f", 0)).toBe("#ff0000");
    expect(lerpColor("#f00", "#00f", 1)).toBe("#0000ff");
  });
});

describe("extractEdgeSignature", () => {
  test("extracts north edge (row 0)", () => {
    const zone = makeZone(5, 3);
    const ground = zone.tiles[0]!;
    // Set specific tiles in row 0
    setTileAt(ground, 0, 0, { char: "~", fg: "#0000ff", bg: "#000044" });
    setTileAt(ground, 2, 0, { char: ".", fg: "#888888", bg: "#444444" });

    const sig = extractEdgeSignature(zone, "up");
    expect(sig.direction).toBe("up");
    expect(sig.tiles).toHaveLength(5);
    expect(sig.tiles[0]!.terrain).toBe("water");
    expect(sig.tiles[0]!.char).toBe("~");
    expect(sig.tiles[0]!.fg).toBe("#0000ff");
    expect(sig.tiles[2]!.terrain).toBe("path");
    expect(sig.tiles[1]!.terrain).toBe("ground");
  });

  test("extracts south edge (last row)", () => {
    const zone = makeZone(5, 3);
    const ground = zone.tiles[0]!;
    // Set specific tiles in last row (row 2)
    setTileAt(ground, 1, 2, { char: "~", fg: "#0000ff" });

    const sig = extractEdgeSignature(zone, "down");
    expect(sig.direction).toBe("down");
    expect(sig.tiles).toHaveLength(5);
    expect(sig.tiles[1]!.terrain).toBe("water");
    expect(sig.tiles[0]!.terrain).toBe("ground");
  });

  test("extracts west edge (column 0)", () => {
    const zone = makeZone(5, 3);
    const ground = zone.tiles[0]!;
    setTileAt(ground, 0, 1, { char: ".", fg: "#888888" });

    const sig = extractEdgeSignature(zone, "left");
    expect(sig.direction).toBe("left");
    expect(sig.tiles).toHaveLength(3); // height = 3
    expect(sig.tiles[1]!.terrain).toBe("path");
    expect(sig.tiles[0]!.terrain).toBe("ground");
  });

  test("extracts east edge (last column)", () => {
    const zone = makeZone(5, 3);
    const ground = zone.tiles[0]!;
    setTileAt(ground, 4, 0, { char: "#", fg: "#808080" });

    const sig = extractEdgeSignature(zone, "right");
    expect(sig.direction).toBe("right");
    expect(sig.tiles).toHaveLength(3);
    expect(sig.tiles[0]!.terrain).toBe("wall");
    expect(sig.tiles[1]!.terrain).toBe("ground");
  });

  test("returns empty tiles for zone without ground layer", () => {
    const zone = makeZone(5, 3);
    zone.tiles = []; // Remove all layers
    const sig = extractEdgeSignature(zone, "up");
    expect(sig.tiles).toHaveLength(0);
  });
});

describe("extractEdgeSignatureFromBuildResult", () => {
  test("works with ZoneBuildResult structure", () => {
    const ground = makeGroundLayer(5, 3);
    setTileAt(ground, 0, 0, { char: "~", fg: "#0000ff" });

    const result: ZoneBuildResult = {
      id: "zone_0_0",
      width: 5,
      height: 3,
      layers: [ground, makeCollisionLayer(5, 3)],
      spawnPoint: { x: 2, y: 1 },
    };

    const sig = extractEdgeSignatureFromBuildResult(result, "up");
    expect(sig.tiles).toHaveLength(5);
    expect(sig.tiles[0]!.terrain).toBe("water");
  });
});

describe("blendEdge", () => {
  test("extends water tiles into new zone", () => {
    const ground = makeGroundLayer(5, 3);
    const collision = makeCollisionLayer(5, 3);
    const layers: TileLayer[] = [ground, collision];

    // Neighbor's south edge (facing our north edge) has water at positions 1 and 2
    const neighborEdge: EdgeSignature = {
      direction: "down",
      tiles: [
        { position: 0, terrain: "ground", char: ",", fg: "#228b22" },
        { position: 1, terrain: "water", char: "~", fg: "#0000ff", bg: "#000044" },
        { position: 2, terrain: "water", char: "~", fg: "#0000ff", bg: "#000044" },
        { position: 3, terrain: "ground", char: ",", fg: "#228b22" },
        { position: 4, terrain: "ground", char: ",", fg: "#228b22" },
      ],
    };

    // Blend direction "up" means neighbor is above, blend top rows
    blendEdge(layers, neighborEdge, "up", 3);

    // Water should extend into top rows
    for (let d = 0; d < 3; d++) {
      const tile1 = getTileAtLayer(ground, 1, d);
      expect(tile1.char).toBe("~");
      expect(tile1.fg).toBe("#0000ff");
      const tile2 = getTileAtLayer(ground, 2, d);
      expect(tile2.char).toBe("~");

      // Collision should be blocked for water
      const coll1 = getTileAtLayer(collision, 1, d);
      expect(coll1.char).toBe("1");
    }
  });

  test("extends path tiles into new zone", () => {
    const ground = makeGroundLayer(5, 3);
    const collision = makeCollisionLayer(5, 3);
    const layers: TileLayer[] = [ground, collision];

    const neighborEdge: EdgeSignature = {
      direction: "down",
      tiles: [
        { position: 0, terrain: "ground", char: ",", fg: "#228b22" },
        { position: 2, terrain: "path", char: ".", fg: "#888888", bg: "#444444" },
        { position: 4, terrain: "ground", char: ",", fg: "#228b22" },
      ],
    };

    blendEdge(layers, neighborEdge, "up", 2);

    // Path should extend into top 2 rows at position 2
    for (let d = 0; d < 2; d++) {
      const tile = getTileAtLayer(ground, 2, d);
      expect(tile.char).toBe(".");
      expect(tile.fg).toBe("#888888");

      // Paths should be passable (collision not blocked)
      const coll = getTileAtLayer(collision, 2, d);
      expect(coll.char).toBe("0");
    }
  });

  test("blends ground colors gradually", () => {
    const ground = makeGroundLayer(5, 3, { fg: "#00ff00", bg: "#001100" });
    const layers: TileLayer[] = [ground];

    const neighborEdge: EdgeSignature = {
      direction: "down",
      tiles: [
        { position: 2, terrain: "ground", char: ",", fg: "#ff0000", bg: "#110000" },
      ],
    };

    blendEdge(layers, neighborEdge, "up", 3);

    // At d=0 (row 0, closest to neighbor), t=0 -> mostly neighbor color
    const edge = getTileAtLayer(ground, 2, 0);
    expect(edge.fg).toBe("#ff0000"); // t=0, full neighbor color

    // At d=1 (row 1), t=0.333 -> blend
    const mid = getTileAtLayer(ground, 2, 1);
    // Should be somewhere between #ff0000 and #00ff00
    expect(mid.fg).not.toBe("#ff0000");
    expect(mid.fg).not.toBe("#00ff00");

    // At d=2 (row 2), t=0.667 -> more toward original
    const far = getTileAtLayer(ground, 2, 2);
    expect(far.fg).not.toBe("#ff0000");
    expect(far.fg).not.toBe("#00ff00");
  });

  test("does not blend wall or building tiles", () => {
    const ground = makeGroundLayer(5, 3);
    const originalTile = { ...getTileAtLayer(ground, 2, 0) };
    const layers: TileLayer[] = [ground];

    const neighborEdge: EdgeSignature = {
      direction: "down",
      tiles: [
        { position: 2, terrain: "wall", char: "#", fg: "#808080" },
        { position: 3, terrain: "building", char: "+", fg: "#8b4513" },
      ],
    };

    blendEdge(layers, neighborEdge, "up", 3);

    // Wall and building tiles should not affect the new zone
    const tile = getTileAtLayer(ground, 2, 0);
    expect(tile.char).toBe(originalTile.char);
    expect(tile.fg).toBe(originalTile.fg);
  });

  test("blends from the south (down) direction", () => {
    const ground = makeGroundLayer(5, 4);
    const collision = makeCollisionLayer(5, 4);
    const layers: TileLayer[] = [ground, collision];

    const neighborEdge: EdgeSignature = {
      direction: "up",
      tiles: [
        { position: 2, terrain: "water", char: "~", fg: "#0000ff" },
      ],
    };

    // Neighbor is below, blend bottom rows
    blendEdge(layers, neighborEdge, "down", 2);

    // Water at x=2 in bottom 2 rows (y=3 and y=2)
    expect(getTileAtLayer(ground, 2, 3).char).toBe("~"); // d=0 -> y = height-1-0 = 3
    expect(getTileAtLayer(ground, 2, 2).char).toBe("~"); // d=1 -> y = height-1-1 = 2
    // Row 1 should be unaffected
    expect(getTileAtLayer(ground, 2, 1).char).toBe(",");
  });

  test("blends from the left direction", () => {
    const ground = makeGroundLayer(5, 3);
    const collision = makeCollisionLayer(5, 3);
    const layers: TileLayer[] = [ground, collision];

    const neighborEdge: EdgeSignature = {
      direction: "right",
      tiles: [
        { position: 1, terrain: "path", char: ".", fg: "#888888" },
      ],
    };

    // Neighbor is to the left, blend leftmost columns
    blendEdge(layers, neighborEdge, "left", 2);

    // Path at y=1 in leftmost 2 columns (x=0, x=1)
    expect(getTileAtLayer(ground, 0, 1).char).toBe("."); // d=0 -> x=0
    expect(getTileAtLayer(ground, 1, 1).char).toBe("."); // d=1 -> x=1
    // Column 2 unaffected
    expect(getTileAtLayer(ground, 2, 1).char).toBe(",");
  });

  test("blends from the right direction", () => {
    const ground = makeGroundLayer(5, 3);
    const collision = makeCollisionLayer(5, 3);
    const layers: TileLayer[] = [ground, collision];

    const neighborEdge: EdgeSignature = {
      direction: "left",
      tiles: [
        { position: 0, terrain: "water", char: "~", fg: "#0000ff" },
      ],
    };

    // Neighbor is to the right, blend rightmost columns
    blendEdge(layers, neighborEdge, "right", 2);

    // Water at y=0 in rightmost 2 columns (x=4, x=3)
    expect(getTileAtLayer(ground, 4, 0).char).toBe("~"); // d=0 -> x = width-1-0 = 4
    expect(getTileAtLayer(ground, 3, 0).char).toBe("~"); // d=1 -> x = width-1-1 = 3
  });
});

describe("applyEdgeCoherence", () => {
  test("applies blending from multiple neighbor edges", () => {
    const ground = makeGroundLayer(5, 4);
    const collision = makeCollisionLayer(5, 4);
    const result: ZoneBuildResult = {
      id: "zone_1_1",
      width: 5,
      height: 4,
      layers: [ground, collision],
      spawnPoint: { x: 2, y: 2 },
    };

    const neighborEdges = new Map<Direction, EdgeSignature>();

    // Neighbor above has water at position 2
    neighborEdges.set("up", {
      direction: "down",
      tiles: [
        { position: 2, terrain: "water", char: "~", fg: "#0000ff" },
      ],
    });

    // Neighbor to the left has path at position 1
    neighborEdges.set("left", {
      direction: "right",
      tiles: [
        { position: 1, terrain: "path", char: ".", fg: "#888888" },
      ],
    });

    applyEdgeCoherence(result, neighborEdges, 2);

    // Top rows at x=2 should have water
    expect(getTileAtLayer(ground, 2, 0).char).toBe("~");
    expect(getTileAtLayer(ground, 2, 1).char).toBe("~");

    // Left columns at y=1 should have path
    expect(getTileAtLayer(ground, 0, 1).char).toBe(".");
    expect(getTileAtLayer(ground, 1, 1).char).toBe(".");
  });

  test("uses default depth when not specified", () => {
    const ground = makeGroundLayer(10, 10);
    const collision = makeCollisionLayer(10, 10);
    const result: ZoneBuildResult = {
      id: "zone_0_0",
      width: 10,
      height: 10,
      layers: [ground, collision],
      spawnPoint: { x: 5, y: 5 },
    };

    const neighborEdges = new Map<Direction, EdgeSignature>();
    neighborEdges.set("up", {
      direction: "down",
      tiles: [
        { position: 5, terrain: "water", char: "~", fg: "#0000ff" },
      ],
    });

    // Default depth is 3 (from DEFAULT_ZONE_CONFIG.edgeBlendDepth)
    applyEdgeCoherence(result, neighborEdges);

    // Should blend 3 rows deep
    expect(getTileAtLayer(ground, 5, 0).char).toBe("~");
    expect(getTileAtLayer(ground, 5, 1).char).toBe("~");
    expect(getTileAtLayer(ground, 5, 2).char).toBe("~");
    // Row 3 should be unaffected
    expect(getTileAtLayer(ground, 5, 3).char).toBe(",");
  });
});
