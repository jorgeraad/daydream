// EdgeCoherence — post-processing pass that blends zone edges so terrain
// connects naturally between adjacent zones. Water continues, paths connect,
// ground palettes blend gradually across biome boundaries.
//
// Integrated into ZoneBuilder pipeline: called after spec-to-tile conversion.
// Edge signatures are stored by ZoneManager for quick retrieval during
// neighbor zone generation.

import type { Direction, TileCell, TileLayer, Zone } from "../types.ts";
import type { EdgeSignature, EdgeTile } from "./ZoneManager.ts";
import { getLayer, getTileAt } from "./Zone.ts";
import { DEFAULT_ZONE_CONFIG } from "./zone-config.ts";
import type { ZoneBuildResult } from "./ZoneBuilder.ts";

// ── Terrain Classification ──────────────────────────────────────

export type TerrainType = "ground" | "water" | "path" | "wall" | "building";

const WATER_CHARS = new Set(["~", "\u2248"]); // ~ ≈
const PATH_CHARS = new Set([".", "\u00B7", ":"]); // . · :
const WALL_CHARS = new Set(["#", "\u2588"]); // # █
const BUILDING_CHARS = new Set(["+", "|", "-"]);

/**
 * Classify a tile cell into a terrain category based on its character.
 * Uses the char-based heuristic from the design doc.
 */
export function classifyTerrain(tile: TileCell): TerrainType {
  const ch = tile.char;
  if (WATER_CHARS.has(ch)) return "water";
  if (PATH_CHARS.has(ch)) return "path";
  if (WALL_CHARS.has(ch)) return "wall";
  if (BUILDING_CHARS.has(ch)) return "building";
  return "ground";
}

// ── Edge Extraction ─────────────────────────────────────────────

/**
 * Opposite direction lookup — used to determine which edge of a neighbor
 * faces the current zone.
 */
export function oppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case "up": return "down";
    case "down": return "up";
    case "left": return "right";
    case "right": return "left";
  }
}

/**
 * Extract the boundary tile data from a zone for a given edge.
 * - up: row 0
 * - down: last row
 * - left: column 0
 * - right: last column
 *
 * Reads from the ground layer. Returns an EdgeSignature with classified
 * terrain types and visual data for each tile along the edge.
 */
export function extractEdgeSignature(
  zone: Zone,
  edge: Direction,
): EdgeSignature {
  const groundLayer = getLayer(zone, "ground");
  if (!groundLayer) {
    return { direction: edge, tiles: [] };
  }

  const { width, height } = groundLayer;
  const tiles: EdgeTile[] = [];

  if (edge === "up" || edge === "down") {
    const row = edge === "up" ? 0 : height - 1;
    for (let x = 0; x < width; x++) {
      const cell = getTileAt(groundLayer, x, row);
      if (cell) {
        tiles.push({
          position: x,
          terrain: classifyTerrain(cell),
          char: cell.char,
          fg: cell.fg,
          bg: cell.bg,
        });
      }
    }
  } else {
    // left or right
    const col = edge === "left" ? 0 : width - 1;
    for (let y = 0; y < height; y++) {
      const cell = getTileAt(groundLayer, col, y);
      if (cell) {
        tiles.push({
          position: y,
          terrain: classifyTerrain(cell),
          char: cell.char,
          fg: cell.fg,
          bg: cell.bg,
        });
      }
    }
  }

  return { direction: edge, tiles };
}

/**
 * Extract edge signature from a ZoneBuildResult (used during build pipeline
 * before a full Zone object exists).
 */
export function extractEdgeSignatureFromBuildResult(
  result: ZoneBuildResult,
  edge: Direction,
): EdgeSignature {
  const groundLayer = result.layers.find((l) => l.name === "ground");
  if (!groundLayer) {
    return { direction: edge, tiles: [] };
  }

  const { width, height } = groundLayer;
  const tiles: EdgeTile[] = [];

  if (edge === "up" || edge === "down") {
    const row = edge === "up" ? 0 : height - 1;
    for (let x = 0; x < width; x++) {
      const cell = getTileAt(groundLayer, x, row);
      if (cell) {
        tiles.push({
          position: x,
          terrain: classifyTerrain(cell),
          char: cell.char,
          fg: cell.fg,
          bg: cell.bg,
        });
      }
    }
  } else {
    const col = edge === "left" ? 0 : width - 1;
    for (let y = 0; y < height; y++) {
      const cell = getTileAt(groundLayer, col, y);
      if (cell) {
        tiles.push({
          position: y,
          terrain: classifyTerrain(cell),
          char: cell.char,
          fg: cell.fg,
          bg: cell.bg,
        });
      }
    }
  }

  return { direction: edge, tiles };
}

// ── Color Interpolation ─────────────────────────────────────────

/**
 * Parse a hex color string (#RRGGBB or #RGB) into [r, g, b] components.
 */
function parseHex(hex: string): [number, number, number] {
  let h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * Convert [r, g, b] back to a hex color string.
 */
function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
  );
}

/**
 * Linearly interpolate between two hex colors.
 * t=0 returns colorA, t=1 returns colorB.
 */
export function lerpColor(colorA: string, colorB: string, t: number): string {
  const [r1, g1, b1] = parseHex(colorA);
  const [r2, g2, b2] = parseHex(colorB);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return toHex(
    clamp(r1 + (r2 - r1) * t),
    clamp(g1 + (g2 - g1) * t),
    clamp(b1 + (b2 - b1) * t),
  );
}

// ── Edge Blending ───────────────────────────────────────────────

/**
 * Blend the tiles along one edge of a zone to match a neighbor's edge.
 *
 * direction = the direction toward the neighbor (e.g., "up" means the
 * neighbor is above, so we blend the top rows of the current zone).
 *
 * depth = number of rows/columns to blend (default: ZoneConfig.edgeBlendDepth).
 *
 * Blending rules:
 * - Water: hard — neighbor water tiles are extended into the new zone
 * - Path:  hard — neighbor path tiles are extended into the new zone
 * - Ground: soft — colors are interpolated gradually over the blend depth
 * - Wall/Building: no blending (structural elements left intact)
 */
export function blendEdge(
  layers: TileLayer[],
  neighborEdge: EdgeSignature,
  direction: Direction,
  depth: number = DEFAULT_ZONE_CONFIG.edgeBlendDepth,
): void {
  const groundLayer = layers.find((l) => l.name === "ground");
  const collisionLayer = layers.find((l) => l.name === "collision");
  if (!groundLayer) return;

  const { width, height } = groundLayer;
  const BLOCKED: TileCell = { char: "1", fg: "#000000" };

  for (const edgeTile of neighborEdge.tiles) {
    for (let d = 0; d < depth; d++) {
      // t: 0 at the edge (closest to neighbor), 1 at the far end of blend
      const t = d / depth;
      const pos = edgeTile.position;

      let x: number;
      let y: number;

      switch (direction) {
        case "up":
          x = pos;
          y = d;
          break;
        case "down":
          x = pos;
          y = height - 1 - d;
          break;
        case "left":
          x = d;
          y = pos;
          break;
        case "right":
          x = width - 1 - d;
          y = pos;
          break;
      }

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const idx = y * width + x;

      const currentTile = groundLayer.data[idx];
      if (!currentTile) continue;

      switch (edgeTile.terrain) {
        case "water": {
          // Hard: extend water into the new zone for the full blend depth
          groundLayer.data[idx] = {
            char: edgeTile.char,
            fg: edgeTile.fg,
            bg: edgeTile.bg,
          };
          if (collisionLayer) {
            collisionLayer.data[idx] = BLOCKED;
          }
          break;
        }

        case "path": {
          // Hard: extend path into the new zone
          groundLayer.data[idx] = {
            char: edgeTile.char,
            fg: edgeTile.fg,
            bg: edgeTile.bg,
          };
          // Paths are passable — don't set collision
          break;
        }

        case "ground": {
          // Soft: interpolate colors gradually. At d=0 (edge), use mostly
          // the neighbor's color. At d=depth-1, use mostly the current tile's color.
          const blendedFg = lerpColor(edgeTile.fg, currentTile.fg, t);
          const neighborBg = edgeTile.bg ?? currentTile.bg;
          const blendedBg =
            neighborBg && currentTile.bg
              ? lerpColor(neighborBg, currentTile.bg, t)
              : currentTile.bg;

          groundLayer.data[idx] = {
            char: currentTile.char,
            fg: blendedFg,
            bg: blendedBg,
          };
          break;
        }

        case "wall":
        case "building":
          // No blending for structural elements
          break;
      }
    }
  }
}

// ── ZoneBuilder Integration ─────────────────────────────────────

/**
 * Apply edge coherence to a freshly built zone. This is the integration
 * point called from ZoneBuilder after the spec-to-tile conversion.
 *
 * neighborEdges: map of direction -> neighbor's edge signature facing this zone.
 * For example, if a neighbor is to the "up", its edge signature should be
 * for its "down" edge (the edge facing us). The direction key indicates
 * which direction the neighbor is relative to us.
 *
 * depth: blend depth (number of rows/columns). Defaults to ZoneConfig.edgeBlendDepth.
 */
export function applyEdgeCoherence(
  result: ZoneBuildResult,
  neighborEdges: Map<Direction, EdgeSignature>,
  depth: number = DEFAULT_ZONE_CONFIG.edgeBlendDepth,
): void {
  for (const [direction, neighborEdge] of neighborEdges) {
    blendEdge(result.layers, neighborEdge, direction, depth);
  }
}
