// Built-in NPC and player sprite templates
// Pixel art uses half-block rendering: 1px wide = 1 cell, 2px tall = 1 cell
// Anchor convention: bottom-center pixel (feet) of the character

import type { SpriteTemplate } from "../types.ts";

// Skin tones
const SKIN = "#deb887";
const SKIN_LIGHT = "#f0e0c0";

// Hair
const HAIR_BROWN = "#5a3a1e";
const HAIR_DARK = "#2a1a0e";
const HAIR_GRAY = "#8a8a8a";
const HAIR_WHITE = "#c0c0c0";

// Clothing
const BLUE_TUNIC = "#2060c0";
const BLUE_DARK = "#1a4090";
const RED_TUNIC = "#b03030";
const RED_DARK = "#802020";
const GREEN_TUNIC = "#2a7a2a";
const GREEN_DARK = "#1a5a1a";
const YELLOW_VEST = "#c0a030";
const YELLOW_DARK = "#907020";
const PURPLE_ROBE = "#6a2aa0";
const PURPLE_DARK = "#4a1a70";
const WHITE_APRON = "#e0e0e0";
const WHITE_SHIRT = "#d0d0d0";
const BROWN_VEST = "#6a4a2a";
const BROWN_DARK = "#4a3018";

// Armor / metal
const STEEL_GRAY = "#8a8a9a";
const STEEL_DARK = "#5a5a6a";
const STEEL_LIGHT = "#a0a0b0";

// Boots / accessories
const BOOT_DARK = "#4a3020";
const BOOT_BROWN = "#5a4030";
const BELT_BROWN = "#6a4020";

const _ = null; // transparent

/**
 * Player — the protagonist, 3px wide x 6px tall
 * Blue tunic, distinct silhouette, visible against all biomes
 */
export const NPC_PLAYER: SpriteTemplate = {
  id: "player_default",
  name: "Player",
  category: "player",
  pixelWidth: 3,
  pixelHeight: 6,
  pixels: [
    // Row 0: hair
    _, HAIR_BROWN, _,
    // Row 1: head
    _, SKIN_LIGHT, _,
    // Row 2: shoulders
    BLUE_TUNIC, BLUE_DARK, BLUE_TUNIC,
    // Row 3: torso
    BLUE_DARK, BELT_BROWN, BLUE_DARK,
    // Row 4: legs
    BLUE_TUNIC, BLUE_DARK, BLUE_TUNIC,
    // Row 5: boots
    BOOT_DARK, _, BOOT_DARK,
  ],
  anchor: { x: 1, y: 5 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["player", "protagonist"],
};

/**
 * Villager — common NPC, 3px wide x 6px tall
 * Plain brown clothing, neutral appearance
 */
export const NPC_VILLAGER: SpriteTemplate = {
  id: "npc_villager",
  name: "Villager",
  category: "npc",
  pixelWidth: 3,
  pixelHeight: 6,
  pixels: [
    // Row 0: hair
    _, HAIR_BROWN, _,
    // Row 1: head
    _, SKIN, _,
    // Row 2: shoulders
    BROWN_VEST, WHITE_SHIRT, BROWN_VEST,
    // Row 3: torso
    BROWN_DARK, BROWN_VEST, BROWN_DARK,
    // Row 4: legs
    BROWN_VEST, BROWN_DARK, BROWN_VEST,
    // Row 5: boots
    BOOT_BROWN, _, BOOT_BROWN,
  ],
  anchor: { x: 1, y: 5 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["villager", "common", "civilian"],
};

/**
 * Guard — armored protector, 3px wide x 6px tall
 * Steel armor, recognizable helmet shape
 */
export const NPC_GUARD: SpriteTemplate = {
  id: "npc_guard",
  name: "Guard",
  category: "npc",
  pixelWidth: 3,
  pixelHeight: 6,
  pixels: [
    // Row 0: helmet
    _, STEEL_DARK, _,
    // Row 1: face
    STEEL_GRAY, SKIN, STEEL_GRAY,
    // Row 2: shoulders (armor)
    STEEL_LIGHT, STEEL_DARK, STEEL_LIGHT,
    // Row 3: torso (armor)
    STEEL_GRAY, RED_DARK, STEEL_GRAY,
    // Row 4: legs
    STEEL_DARK, STEEL_GRAY, STEEL_DARK,
    // Row 5: boots
    BOOT_DARK, _, BOOT_DARK,
  ],
  anchor: { x: 1, y: 5 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["guard", "armored", "military"],
};

/**
 * Merchant — trader NPC, 3px wide x 6px tall
 * Yellow/gold vest, prosperous appearance
 */
export const NPC_MERCHANT: SpriteTemplate = {
  id: "npc_merchant",
  name: "Merchant",
  category: "npc",
  pixelWidth: 3,
  pixelHeight: 6,
  pixels: [
    // Row 0: hair
    _, HAIR_DARK, _,
    // Row 1: head
    _, SKIN, _,
    // Row 2: shoulders
    YELLOW_VEST, WHITE_SHIRT, YELLOW_VEST,
    // Row 3: torso
    YELLOW_DARK, BELT_BROWN, YELLOW_DARK,
    // Row 4: legs
    BROWN_VEST, BROWN_DARK, BROWN_VEST,
    // Row 5: boots
    BOOT_BROWN, _, BOOT_BROWN,
  ],
  anchor: { x: 1, y: 5 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["merchant", "trader", "commerce"],
};

/**
 * Child — small NPC, 3px wide x 4px tall
 * Shorter stature, bright clothing
 */
export const NPC_CHILD: SpriteTemplate = {
  id: "npc_child",
  name: "Child",
  category: "npc",
  pixelWidth: 3,
  pixelHeight: 4,
  pixels: [
    // Row 0: hair
    _, HAIR_BROWN, _,
    // Row 1: head
    _, SKIN_LIGHT, _,
    // Row 2: torso
    GREEN_TUNIC, GREEN_DARK, GREEN_TUNIC,
    // Row 3: legs/boots
    BOOT_BROWN, GREEN_TUNIC, BOOT_BROWN,
  ],
  anchor: { x: 1, y: 3 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["child", "young", "civilian"],
};

/**
 * Elder — wise old NPC, 3px wide x 6px tall
 * Purple robe, white hair, staff-like appearance
 */
export const NPC_ELDER: SpriteTemplate = {
  id: "npc_elder",
  name: "Elder",
  category: "npc",
  pixelWidth: 3,
  pixelHeight: 6,
  pixels: [
    // Row 0: white hair
    _, HAIR_WHITE, _,
    // Row 1: head
    _, SKIN, _,
    // Row 2: shoulders (robe)
    PURPLE_ROBE, PURPLE_DARK, PURPLE_ROBE,
    // Row 3: torso (robe)
    PURPLE_DARK, PURPLE_ROBE, PURPLE_DARK,
    // Row 4: robe lower
    PURPLE_ROBE, PURPLE_DARK, PURPLE_ROBE,
    // Row 5: feet (robe reaches down)
    _, PURPLE_DARK, _,
  ],
  anchor: { x: 1, y: 5 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["elder", "wise", "authority"],
};

/**
 * Innkeeper — tavern keeper NPC, 3px wide x 6px tall
 * White apron over red tunic, hospitable appearance
 */
export const NPC_INNKEEPER: SpriteTemplate = {
  id: "npc_innkeeper",
  name: "Innkeeper",
  category: "npc",
  pixelWidth: 3,
  pixelHeight: 6,
  pixels: [
    // Row 0: hair
    _, HAIR_DARK, _,
    // Row 1: head
    _, SKIN, _,
    // Row 2: shoulders
    RED_TUNIC, WHITE_APRON, RED_TUNIC,
    // Row 3: torso (apron)
    RED_DARK, WHITE_APRON, RED_DARK,
    // Row 4: legs
    RED_TUNIC, WHITE_SHIRT, RED_TUNIC,
    // Row 5: boots
    BOOT_DARK, _, BOOT_DARK,
  ],
  anchor: { x: 1, y: 5 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["innkeeper", "hospitality", "tavern"],
};

/** All NPC templates (excluding player) */
export const NPC_SPRITES: SpriteTemplate[] = [
  NPC_VILLAGER,
  NPC_GUARD,
  NPC_MERCHANT,
  NPC_CHILD,
  NPC_ELDER,
  NPC_INNKEEPER,
];
