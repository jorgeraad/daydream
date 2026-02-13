// Built-in tree and bush sprite templates
// Pixel art uses half-block rendering: 1px wide = 1 cell, 2px tall = 1 cell
// Anchor convention: bottom-center pixel of the trunk base

import type { SpriteTemplate } from "../types.ts";

// Colors
const DARK_GREEN = "#1a6b1a";
const MID_GREEN = "#2d8b2d";
const LIGHT_GREEN = "#4aaa4a";
const PALE_GREEN = "#6ac06a";
const BROWN = "#5c3a1e";
const DARK_BROWN = "#4a2a0e";
const GRAY = "#6a6a6a";
const DARK_GRAY = "#4a4a4a";
const _ = null; // transparent

/**
 * Pine tree — tall conifer, 3px wide x 8px tall
 * Classic triangular silhouette tapering to a point
 *
 * Visual (approx):
 *   .#.
 *   .#.
 *   ###
 *   .#.
 *   ###
 *   ###
 *   .#.
 *   .#.
 */
export const TREE_PINE: SpriteTemplate = {
  id: "tree_pine",
  name: "Pine Tree",
  category: "tree",
  pixelWidth: 3,
  pixelHeight: 8,
  pixels: [
    // Row 0: tip
    _, DARK_GREEN, _,
    // Row 1: tip body
    _, MID_GREEN, _,
    // Row 2: upper canopy
    DARK_GREEN, MID_GREEN, DARK_GREEN,
    // Row 3: narrow
    _, LIGHT_GREEN, _,
    // Row 4: mid canopy
    DARK_GREEN, MID_GREEN, DARK_GREEN,
    // Row 5: lower canopy
    MID_GREEN, LIGHT_GREEN, MID_GREEN,
    // Row 6: trunk
    _, BROWN, _,
    // Row 7: trunk base
    _, DARK_BROWN, _,
  ],
  anchor: { x: 1, y: 7 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["forest", "conifer", "tall"],
};

/**
 * Oak tree — broad deciduous, 5px wide x 8px tall
 * Round canopy with thick trunk
 *
 * Visual (approx):
 *   .###.
 *   #####
 *   #####
 *   #####
 *   .###.
 *   ..#..
 *   ..#..
 *   ..#..
 */
export const TREE_OAK: SpriteTemplate = {
  id: "tree_oak",
  name: "Oak Tree",
  category: "tree",
  pixelWidth: 5,
  pixelHeight: 8,
  pixels: [
    // Row 0: canopy top
    _, MID_GREEN, LIGHT_GREEN, MID_GREEN, _,
    // Row 1: canopy full
    MID_GREEN, LIGHT_GREEN, PALE_GREEN, LIGHT_GREEN, MID_GREEN,
    // Row 2: canopy mid
    DARK_GREEN, MID_GREEN, LIGHT_GREEN, MID_GREEN, DARK_GREEN,
    // Row 3: canopy mid
    MID_GREEN, LIGHT_GREEN, MID_GREEN, LIGHT_GREEN, MID_GREEN,
    // Row 4: canopy bottom
    _, DARK_GREEN, MID_GREEN, DARK_GREEN, _,
    // Row 5: trunk upper
    _, _, BROWN, _, _,
    // Row 6: trunk
    _, _, BROWN, _, _,
    // Row 7: trunk base
    _, _, DARK_BROWN, _, _,
  ],
  anchor: { x: 2, y: 7 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["forest", "deciduous", "large"],
};

/**
 * Dead tree — bare branches, 3px wide x 6px tall
 * Leafless skeleton silhouette, dark browns and grays
 */
export const TREE_DEAD: SpriteTemplate = {
  id: "tree_dead",
  name: "Dead Tree",
  category: "tree",
  pixelWidth: 3,
  pixelHeight: 6,
  pixels: [
    // Row 0: branch tips
    DARK_GRAY, _, DARK_GRAY,
    // Row 1: upper branches
    GRAY, DARK_BROWN, GRAY,
    // Row 2: mid branches
    _, DARK_BROWN, _,
    // Row 3: fork
    DARK_BROWN, BROWN, DARK_BROWN,
    // Row 4: trunk
    _, BROWN, _,
    // Row 5: trunk base
    _, DARK_BROWN, _,
  ],
  anchor: { x: 1, y: 5 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["dead", "spooky", "barren"],
};

/**
 * Bush — small shrub, 3px wide x 3px tall
 * Low round shape, walkable ground cover
 */
export const TREE_BUSH: SpriteTemplate = {
  id: "tree_bush",
  name: "Bush",
  category: "tree",
  pixelWidth: 3,
  pixelHeight: 3,
  pixels: [
    // Row 0: top
    _, MID_GREEN, _,
    // Row 1: full
    MID_GREEN, LIGHT_GREEN, MID_GREEN,
    // Row 2: base
    DARK_GREEN, MID_GREEN, DARK_GREEN,
  ],
  anchor: { x: 1, y: 2 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["small", "ground", "shrub"],
};

/**
 * Large bush — wider shrub, 5px wide x 4px tall
 * Broader than bush, blocks movement
 */
export const TREE_LARGE_BUSH: SpriteTemplate = {
  id: "tree_large_bush",
  name: "Large Bush",
  category: "tree",
  pixelWidth: 5,
  pixelHeight: 4,
  pixels: [
    // Row 0: top
    _, MID_GREEN, LIGHT_GREEN, MID_GREEN, _,
    // Row 1: upper
    MID_GREEN, LIGHT_GREEN, PALE_GREEN, LIGHT_GREEN, MID_GREEN,
    // Row 2: lower
    DARK_GREEN, MID_GREEN, LIGHT_GREEN, MID_GREEN, DARK_GREEN,
    // Row 3: base
    _, DARK_GREEN, MID_GREEN, DARK_GREEN, _,
  ],
  anchor: { x: 2, y: 3 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["large", "ground", "shrub"],
};

/** All tree/bush templates */
export const TREE_SPRITES: SpriteTemplate[] = [
  TREE_PINE,
  TREE_OAK,
  TREE_DEAD,
  TREE_BUSH,
  TREE_LARGE_BUSH,
];
