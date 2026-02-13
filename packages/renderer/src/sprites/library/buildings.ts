// Built-in building sprite templates
// Pixel art uses half-block rendering: 1px wide = 1 cell, 2px tall = 1 cell
// Anchor convention: bottom-center pixel of the structure base

import type { SpriteTemplate } from "../types.ts";

// Colors
const ROOF_BROWN = "#7a4a2a";
const ROOF_DARK = "#5a3518";
const WALL_TAN = "#b8a070";
const WALL_LIGHT = "#d0c090";
const WINDOW_BLUE = "#6a8ab0";
const WINDOW_DARK = "#4a6a90";
const DOOR_DARK = "#3d2b1f";
const DOOR_BROWN = "#5a3a20";
const STONE_GRAY = "#7a7a7a";
const STONE_DARK = "#5a5a5a";
const STONE_LIGHT = "#9a9a9a";
const WOOD_BROWN = "#6a4a2a";
const WOOD_DARK = "#4a3018";
const WATER_BLUE = "#4a7aaa";
const WATER_DARK = "#3a5a80";
const SIGN_TAN = "#c0a060";
const _ = null; // transparent

/**
 * House — small dwelling, 5px wide x 6px tall
 * Peaked roof, one window, one door
 */
export const BUILDING_HOUSE: SpriteTemplate = {
  id: "building_house",
  name: "House",
  category: "building",
  pixelWidth: 5,
  pixelHeight: 6,
  pixels: [
    // Row 0: roof peak
    _, _, ROOF_DARK, _, _,
    // Row 1: roof upper
    _, ROOF_BROWN, ROOF_DARK, ROOF_BROWN, _,
    // Row 2: roof base
    ROOF_BROWN, ROOF_DARK, ROOF_BROWN, ROOF_DARK, ROOF_BROWN,
    // Row 3: wall top with window
    WALL_TAN, WINDOW_BLUE, WALL_LIGHT, WINDOW_BLUE, WALL_TAN,
    // Row 4: wall mid
    WALL_LIGHT, WINDOW_DARK, WALL_TAN, WINDOW_DARK, WALL_LIGHT,
    // Row 5: wall base with door
    WALL_TAN, WALL_LIGHT, DOOR_DARK, WALL_LIGHT, WALL_TAN,
  ],
  anchor: { x: 2, y: 5 },
  collisionTiles: [
    { dx: -1, dy: 0 },
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
  ],
  tags: ["dwelling", "village", "residential"],
};

/**
 * Shop — merchant building, 5px wide x 6px tall
 * Flat-ish roof with awning, wide entrance
 */
export const BUILDING_SHOP: SpriteTemplate = {
  id: "building_shop",
  name: "Shop",
  category: "building",
  pixelWidth: 5,
  pixelHeight: 6,
  pixels: [
    // Row 0: roof line
    ROOF_DARK, ROOF_BROWN, ROOF_DARK, ROOF_BROWN, ROOF_DARK,
    // Row 1: roof
    ROOF_BROWN, ROOF_DARK, ROOF_BROWN, ROOF_DARK, ROOF_BROWN,
    // Row 2: awning / sign area
    SIGN_TAN, SIGN_TAN, SIGN_TAN, SIGN_TAN, SIGN_TAN,
    // Row 3: wall with windows
    WALL_TAN, WINDOW_BLUE, WALL_LIGHT, WINDOW_BLUE, WALL_TAN,
    // Row 4: wall
    WALL_LIGHT, WINDOW_DARK, WALL_TAN, WINDOW_DARK, WALL_LIGHT,
    // Row 5: wide entrance
    WALL_TAN, DOOR_BROWN, DOOR_DARK, DOOR_BROWN, WALL_TAN,
  ],
  anchor: { x: 2, y: 5 },
  collisionTiles: [
    { dx: -1, dy: 0 },
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
  ],
  tags: ["commerce", "village", "shop"],
};

/**
 * Tavern — drinking establishment, 7px wide x 7px tall
 * Wider than house, peaked roof, multiple windows, large door
 */
export const BUILDING_TAVERN: SpriteTemplate = {
  id: "building_tavern",
  name: "Tavern",
  category: "building",
  pixelWidth: 7,
  pixelHeight: 7,
  pixels: [
    // Row 0: roof peak
    _, _, _, ROOF_DARK, _, _, _,
    // Row 1: roof upper
    _, _, ROOF_BROWN, ROOF_DARK, ROOF_BROWN, _, _,
    // Row 2: roof
    _, ROOF_DARK, ROOF_BROWN, ROOF_DARK, ROOF_BROWN, ROOF_DARK, _,
    // Row 3: roof base / eaves
    ROOF_BROWN, ROOF_DARK, ROOF_BROWN, ROOF_DARK, ROOF_BROWN, ROOF_DARK, ROOF_BROWN,
    // Row 4: wall with windows
    WALL_TAN, WINDOW_BLUE, WALL_LIGHT, WALL_TAN, WALL_LIGHT, WINDOW_BLUE, WALL_TAN,
    // Row 5: wall lower
    WALL_LIGHT, WINDOW_DARK, WALL_TAN, WALL_LIGHT, WALL_TAN, WINDOW_DARK, WALL_LIGHT,
    // Row 6: base with large door
    WALL_TAN, WALL_LIGHT, DOOR_BROWN, DOOR_DARK, DOOR_BROWN, WALL_LIGHT, WALL_TAN,
  ],
  anchor: { x: 3, y: 6 },
  collisionTiles: [
    { dx: -1, dy: 0 },
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
  ],
  tags: ["social", "village", "tavern", "large"],
};

/**
 * Well — stone well, 3px wide x 4px tall
 * Round stone rim with dark opening, wooden support above
 */
export const BUILDING_WELL: SpriteTemplate = {
  id: "building_well",
  name: "Well",
  category: "building",
  pixelWidth: 3,
  pixelHeight: 4,
  pixels: [
    // Row 0: roof support
    WOOD_DARK, WOOD_BROWN, WOOD_DARK,
    // Row 1: crossbar
    _, WOOD_BROWN, _,
    // Row 2: stone rim
    STONE_GRAY, STONE_DARK, STONE_GRAY,
    // Row 3: base
    STONE_DARK, WATER_DARK, STONE_DARK,
  ],
  anchor: { x: 1, y: 3 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["water", "village", "utility"],
};

/**
 * Wall segment — stone wall, 3px wide x 4px tall
 * Repeatable wall section, used for boundaries
 */
export const BUILDING_WALL: SpriteTemplate = {
  id: "building_wall",
  name: "Wall",
  category: "building",
  pixelWidth: 3,
  pixelHeight: 4,
  pixels: [
    // Row 0: top
    STONE_DARK, STONE_GRAY, STONE_DARK,
    // Row 1: upper
    STONE_GRAY, STONE_LIGHT, STONE_GRAY,
    // Row 2: lower
    STONE_DARK, STONE_GRAY, STONE_DARK,
    // Row 3: base
    STONE_GRAY, STONE_DARK, STONE_GRAY,
  ],
  anchor: { x: 1, y: 3 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["barrier", "stone", "structure"],
};

/** All building templates */
export const BUILDING_SPRITES: SpriteTemplate[] = [
  BUILDING_HOUSE,
  BUILDING_SHOP,
  BUILDING_TAVERN,
  BUILDING_WELL,
  BUILDING_WALL,
];
