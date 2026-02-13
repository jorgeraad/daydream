// Built-in object and decoration sprite templates
// Pixel art uses half-block rendering: 1px wide = 1 cell, 2px tall = 1 cell
// Anchor convention: bottom-center pixel of the object base

import type { SpriteTemplate } from "../types.ts";

// Stone / rock colors
const GRAY_DARK = "#4a4a4a";
const GRAY_MID = "#6a6a6a";
const GRAY_LIGHT = "#8a8a8a";
const GRAY_PALE = "#a0a0a0";

// Wood
const WOOD_BROWN = "#6a4a2a";
const WOOD_DARK = "#4a3018";
const WOOD_LIGHT = "#8a6a3a";

// Metal
const METAL_DARK = "#5a5a5a";
const METAL_GRAY = "#7a7a7a";
const METAL_GOLD = "#c0a030";
const METAL_GOLD_DARK = "#907020";

// Natural
const GREEN_MID = "#2d8b2d";
const GREEN_LIGHT = "#4aaa4a";
const GREEN_DARK = "#1a6b1a";
const BROWN_DARK = "#4a2a0e";
const BROWN_MID = "#5c3a1e";

// Flowers
const FLOWER_RED = "#cc3030";
const FLOWER_YELLOW = "#ddcc30";
const FLOWER_PINK = "#dd70aa";
const FLOWER_STEM = "#2a7a2a";

// Water
const WATER_BLUE = "#4a7aaa";
const WATER_DARK = "#3a5a80";
const WATER_LIGHT = "#6a9acc";

// Fire / light
const FIRE_ORANGE = "#dd7a20";
const FIRE_YELLOW = "#eebb30";
const FIRE_RED = "#cc4420";

// Mushroom
const MUSH_RED = "#bb3030";
const MUSH_WHITE = "#e0d8c8";
const MUSH_STEM = "#d0c8b0";

const _ = null; // transparent

// ---------------------------------------------------------------------------
// OBJECTS
// ---------------------------------------------------------------------------

/**
 * Large rock — 3px wide x 3px tall
 * Irregular boulder shape
 */
export const OBJ_ROCK_LARGE: SpriteTemplate = {
  id: "obj_rock_large",
  name: "Large Rock",
  category: "object",
  pixelWidth: 3,
  pixelHeight: 3,
  pixels: [
    // Row 0: top
    _, GRAY_MID, _,
    // Row 1: body
    GRAY_DARK, GRAY_LIGHT, GRAY_MID,
    // Row 2: base
    GRAY_MID, GRAY_DARK, GRAY_MID,
  ],
  anchor: { x: 1, y: 2 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["rock", "natural", "obstacle"],
};

/**
 * Small rock — 2px wide x 2px tall
 * Pebble-sized, walkable (no collision)
 */
export const OBJ_ROCK_SMALL: SpriteTemplate = {
  id: "obj_rock_small",
  name: "Small Rock",
  category: "object",
  pixelWidth: 2,
  pixelHeight: 2,
  pixels: [
    // Row 0: top
    GRAY_MID, GRAY_LIGHT,
    // Row 1: base
    GRAY_DARK, GRAY_MID,
  ],
  anchor: { x: 1, y: 1 },
  collisionTiles: [],
  tags: ["rock", "natural", "small", "walkable"],
};

/**
 * Chest — treasure container, 3px wide x 3px tall
 * Wooden chest with gold trim, blocks movement
 */
export const OBJ_CHEST: SpriteTemplate = {
  id: "obj_chest",
  name: "Chest",
  category: "object",
  pixelWidth: 3,
  pixelHeight: 3,
  pixels: [
    // Row 0: lid
    WOOD_DARK, METAL_GOLD, WOOD_DARK,
    // Row 1: body upper
    WOOD_BROWN, METAL_GOLD_DARK, WOOD_BROWN,
    // Row 2: body base
    WOOD_DARK, WOOD_BROWN, WOOD_DARK,
  ],
  anchor: { x: 1, y: 2 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["container", "treasure", "interactable"],
};

/**
 * Sign — wooden signpost, 3px wide x 4px tall
 * Post with sign board on top
 */
export const OBJ_SIGN: SpriteTemplate = {
  id: "obj_sign",
  name: "Sign",
  category: "object",
  pixelWidth: 3,
  pixelHeight: 4,
  pixels: [
    // Row 0: sign top
    WOOD_BROWN, WOOD_LIGHT, WOOD_BROWN,
    // Row 1: sign bottom
    WOOD_DARK, WOOD_BROWN, WOOD_DARK,
    // Row 2: post
    _, WOOD_DARK, _,
    // Row 3: post base
    _, BROWN_DARK, _,
  ],
  anchor: { x: 1, y: 3 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["sign", "information", "interactable"],
};

/**
 * Barrel — storage barrel, 3px wide x 3px tall
 * Round wooden barrel with metal bands
 */
export const OBJ_BARREL: SpriteTemplate = {
  id: "obj_barrel",
  name: "Barrel",
  category: "object",
  pixelWidth: 3,
  pixelHeight: 3,
  pixels: [
    // Row 0: top
    WOOD_DARK, METAL_GRAY, WOOD_DARK,
    // Row 1: body
    METAL_DARK, WOOD_BROWN, METAL_DARK,
    // Row 2: base
    WOOD_DARK, METAL_GRAY, WOOD_DARK,
  ],
  anchor: { x: 1, y: 2 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["container", "storage", "village"],
};

/**
 * Flowers — decorative flower patch, 3px wide x 2px tall
 * Colorful flowers, walkable
 */
export const OBJ_FLOWERS: SpriteTemplate = {
  id: "obj_flowers",
  name: "Flowers",
  category: "object",
  pixelWidth: 3,
  pixelHeight: 2,
  pixels: [
    // Row 0: blooms
    FLOWER_RED, FLOWER_YELLOW, FLOWER_PINK,
    // Row 1: stems
    FLOWER_STEM, GREEN_MID, FLOWER_STEM,
  ],
  anchor: { x: 1, y: 1 },
  collisionTiles: [],
  tags: ["plant", "decorative", "walkable", "colorful"],
};

/**
 * Torch — wall/ground torch, 1px wide x 4px tall
 * Flame on top of a post
 */
export const OBJ_TORCH: SpriteTemplate = {
  id: "obj_torch",
  name: "Torch",
  category: "object",
  pixelWidth: 1,
  pixelHeight: 4,
  pixels: [
    // Row 0: flame tip
    FIRE_YELLOW,
    // Row 1: flame body
    FIRE_ORANGE,
    // Row 2: handle
    WOOD_DARK,
    // Row 3: base
    BROWN_DARK,
  ],
  anchor: { x: 0, y: 3 },
  collisionTiles: [],
  tags: ["light", "fire", "utility", "walkable"],
};

/**
 * Fence — wooden fence section, 3px wide x 3px tall
 * Repeatable fence posts with rails
 */
export const OBJ_FENCE: SpriteTemplate = {
  id: "obj_fence",
  name: "Fence",
  category: "object",
  pixelWidth: 3,
  pixelHeight: 3,
  pixels: [
    // Row 0: post tops
    WOOD_DARK, _, WOOD_DARK,
    // Row 1: rail
    WOOD_BROWN, WOOD_LIGHT, WOOD_BROWN,
    // Row 2: lower rail / posts
    WOOD_DARK, WOOD_BROWN, WOOD_DARK,
  ],
  anchor: { x: 1, y: 2 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["barrier", "boundary", "wooden"],
};

// ---------------------------------------------------------------------------
// DECORATIONS
// ---------------------------------------------------------------------------

/**
 * Grass tuft — small ground detail, 3px wide x 2px tall
 * Walkable ground cover
 */
export const DECO_GRASS_TUFT: SpriteTemplate = {
  id: "deco_grass_tuft",
  name: "Grass Tuft",
  category: "decoration",
  pixelWidth: 3,
  pixelHeight: 2,
  pixels: [
    // Row 0: grass tips
    _, GREEN_LIGHT, _,
    // Row 1: grass base
    GREEN_MID, GREEN_DARK, GREEN_MID,
  ],
  anchor: { x: 1, y: 1 },
  collisionTiles: [],
  tags: ["grass", "ground", "walkable", "natural"],
};

/**
 * Mushroom — small toadstool, 3px wide x 3px tall
 * Red cap with white spots, walkable
 */
export const DECO_MUSHROOM: SpriteTemplate = {
  id: "deco_mushroom",
  name: "Mushroom",
  category: "decoration",
  pixelWidth: 3,
  pixelHeight: 3,
  pixels: [
    // Row 0: cap top
    _, MUSH_RED, _,
    // Row 1: cap with spots
    MUSH_RED, MUSH_WHITE, MUSH_RED,
    // Row 2: stem
    _, MUSH_STEM, _,
  ],
  anchor: { x: 1, y: 2 },
  collisionTiles: [],
  tags: ["fungus", "forest", "walkable", "small"],
};

/**
 * Puddle — small water puddle, 3px wide x 2px tall
 * Flat water surface, walkable (slows movement potentially)
 */
export const DECO_PUDDLE: SpriteTemplate = {
  id: "deco_puddle",
  name: "Puddle",
  category: "decoration",
  pixelWidth: 3,
  pixelHeight: 2,
  pixels: [
    // Row 0: water surface
    _, WATER_LIGHT, _,
    // Row 1: water body
    WATER_BLUE, WATER_DARK, WATER_BLUE,
  ],
  anchor: { x: 1, y: 1 },
  collisionTiles: [],
  tags: ["water", "ground", "walkable", "weather"],
};

/**
 * Fallen log — horizontal dead tree, 5px wide x 2px tall
 * Blocking obstacle, brown wood tones
 */
export const DECO_FALLEN_LOG: SpriteTemplate = {
  id: "deco_fallen_log",
  name: "Fallen Log",
  category: "decoration",
  pixelWidth: 5,
  pixelHeight: 2,
  pixels: [
    // Row 0: log top
    BROWN_DARK, WOOD_BROWN, WOOD_LIGHT, WOOD_BROWN, BROWN_DARK,
    // Row 1: log base
    WOOD_DARK, BROWN_MID, WOOD_BROWN, BROWN_MID, WOOD_DARK,
  ],
  anchor: { x: 2, y: 1 },
  collisionTiles: [
    { dx: -1, dy: 0 },
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
  ],
  tags: ["dead", "natural", "obstacle", "forest"],
};

/** All object templates */
export const OBJECT_SPRITES: SpriteTemplate[] = [
  OBJ_ROCK_LARGE,
  OBJ_ROCK_SMALL,
  OBJ_CHEST,
  OBJ_SIGN,
  OBJ_BARREL,
  OBJ_FLOWERS,
  OBJ_TORCH,
  OBJ_FENCE,
];

/** All decoration templates */
export const DECORATION_SPRITES: SpriteTemplate[] = [
  DECO_GRASS_TUFT,
  DECO_MUSHROOM,
  DECO_PUDDLE,
  DECO_FALLEN_LOG,
];
