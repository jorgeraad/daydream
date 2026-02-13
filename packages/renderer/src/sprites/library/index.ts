// Sprite library barrel export
// All built-in sprite templates, lookup tables, and mapping tables

import type { SpriteTemplate } from "../types.ts";

// Tree sprites
export {
  TREE_PINE,
  TREE_OAK,
  TREE_DEAD,
  TREE_BUSH,
  TREE_LARGE_BUSH,
  TREE_SPRITES,
} from "./trees.ts";

// Building sprites
export {
  BUILDING_HOUSE,
  BUILDING_SHOP,
  BUILDING_TAVERN,
  BUILDING_WELL,
  BUILDING_WALL,
  BUILDING_SPRITES,
} from "./buildings.ts";

// NPC sprites (including player)
export {
  NPC_PLAYER,
  NPC_VILLAGER,
  NPC_GUARD,
  NPC_MERCHANT,
  NPC_CHILD,
  NPC_ELDER,
  NPC_INNKEEPER,
  NPC_SPRITES,
} from "./npcs.ts";

// Object and decoration sprites
export {
  OBJ_ROCK_LARGE,
  OBJ_ROCK_SMALL,
  OBJ_CHEST,
  OBJ_SIGN,
  OBJ_BARREL,
  OBJ_FLOWERS,
  OBJ_TORCH,
  OBJ_FENCE,
  OBJECT_SPRITES,
  DECO_GRASS_TUFT,
  DECO_MUSHROOM,
  DECO_PUDDLE,
  DECO_FALLEN_LOG,
  DECORATION_SPRITES,
} from "./objects.ts";

import { TREE_SPRITES } from "./trees.ts";
import { BUILDING_SPRITES } from "./buildings.ts";
import { NPC_PLAYER, NPC_SPRITES } from "./npcs.ts";
import { OBJECT_SPRITES, DECORATION_SPRITES } from "./objects.ts";

// ---------------------------------------------------------------------------
// ALL_SPRITES — every built-in template in one flat array
// ---------------------------------------------------------------------------

/** Complete collection of all built-in sprite templates (29 total). */
export const ALL_SPRITES: SpriteTemplate[] = [
  NPC_PLAYER,
  ...TREE_SPRITES,
  ...BUILDING_SPRITES,
  ...NPC_SPRITES,
  ...OBJECT_SPRITES,
  ...DECORATION_SPRITES,
];

// ---------------------------------------------------------------------------
// Lookup by ID
// ---------------------------------------------------------------------------

/** Map from sprite template ID to SpriteTemplate for O(1) lookups. */
export const SPRITE_BY_ID: ReadonlyMap<string, SpriteTemplate> = new Map(
  ALL_SPRITES.map((s) => [s.id, s]),
);

// ---------------------------------------------------------------------------
// AI object type string -> sprite template ID
// ---------------------------------------------------------------------------

/**
 * Maps AI-generated object type strings to sprite template IDs.
 * The AI produces object types like "tree", "rock", "chest" in zone specs;
 * this table resolves them to the appropriate built-in sprite.
 *
 * Multiple AI strings can map to the same template (e.g., "boulder" -> "obj_rock_large").
 * Keys are lowercase for case-insensitive matching.
 */
export const OBJECT_TYPE_TO_SPRITE: Readonly<Record<string, string>> = {
  // Trees
  pine: "tree_pine",
  pine_tree: "tree_pine",
  conifer: "tree_pine",
  evergreen: "tree_pine",
  oak: "tree_oak",
  oak_tree: "tree_oak",
  tree: "tree_oak",
  large_tree: "tree_oak",
  dead_tree: "tree_dead",
  dead_wood: "tree_dead",
  bare_tree: "tree_dead",
  withered_tree: "tree_dead",
  bush: "tree_bush",
  shrub: "tree_bush",
  small_bush: "tree_bush",
  large_bush: "tree_large_bush",
  hedge: "tree_large_bush",
  thicket: "tree_large_bush",

  // Buildings
  house: "building_house",
  cottage: "building_house",
  cabin: "building_house",
  hut: "building_house",
  dwelling: "building_house",
  shop: "building_shop",
  store: "building_shop",
  market_stall: "building_shop",
  tavern: "building_tavern",
  inn: "building_tavern",
  pub: "building_tavern",
  bar: "building_tavern",
  well: "building_well",
  fountain: "building_well",
  water_well: "building_well",
  wall: "building_wall",
  stone_wall: "building_wall",
  wall_segment: "building_wall",
  rampart: "building_wall",

  // Objects
  rock: "obj_rock_large",
  boulder: "obj_rock_large",
  large_rock: "obj_rock_large",
  stone: "obj_rock_large",
  pebble: "obj_rock_small",
  small_rock: "obj_rock_small",
  rock_small: "obj_rock_small",
  chest: "obj_chest",
  treasure_chest: "obj_chest",
  crate: "obj_chest",
  sign: "obj_sign",
  signpost: "obj_sign",
  post: "obj_sign",
  barrel: "obj_barrel",
  keg: "obj_barrel",
  flowers: "obj_flowers",
  flower: "obj_flowers",
  flower_patch: "obj_flowers",
  garden: "obj_flowers",
  torch: "obj_torch",
  lantern: "obj_torch",
  lamp: "obj_torch",
  light: "obj_torch",
  campfire: "obj_torch",
  fence: "obj_fence",
  fence_post: "obj_fence",
  railing: "obj_fence",
  picket_fence: "obj_fence",

  // Decorations
  grass: "deco_grass_tuft",
  grass_tuft: "deco_grass_tuft",
  tall_grass: "deco_grass_tuft",
  weeds: "deco_grass_tuft",
  mushroom: "deco_mushroom",
  toadstool: "deco_mushroom",
  fungus: "deco_mushroom",
  puddle: "deco_puddle",
  water_puddle: "deco_puddle",
  pond: "deco_puddle",
  fallen_log: "deco_fallen_log",
  log: "deco_fallen_log",
  dead_log: "deco_fallen_log",
  fallen_tree: "deco_fallen_log",
};

// ---------------------------------------------------------------------------
// AI NPC role string -> sprite template ID
// ---------------------------------------------------------------------------

/**
 * Maps AI-generated NPC role strings to sprite template IDs.
 * The AI produces role strings like "villager", "guard", "merchant" in NPC specs;
 * this table resolves them to the appropriate built-in sprite.
 *
 * Keys are lowercase for case-insensitive matching.
 */
export const NPC_ROLE_TO_SPRITE: Readonly<Record<string, string>> = {
  // Villager variants
  villager: "npc_villager",
  peasant: "npc_villager",
  farmer: "npc_villager",
  townsfolk: "npc_villager",
  citizen: "npc_villager",
  commoner: "npc_villager",
  resident: "npc_villager",

  // Guard variants
  guard: "npc_guard",
  soldier: "npc_guard",
  knight: "npc_guard",
  warrior: "npc_guard",
  sentry: "npc_guard",
  watchman: "npc_guard",
  patrol: "npc_guard",

  // Merchant variants
  merchant: "npc_merchant",
  trader: "npc_merchant",
  shopkeeper: "npc_merchant",
  vendor: "npc_merchant",
  peddler: "npc_merchant",
  salesman: "npc_merchant",

  // Child variants
  child: "npc_child",
  kid: "npc_child",
  boy: "npc_child",
  girl: "npc_child",
  youth: "npc_child",
  orphan: "npc_child",

  // Elder variants
  elder: "npc_elder",
  sage: "npc_elder",
  wizard: "npc_elder",
  mage: "npc_elder",
  priest: "npc_elder",
  chief: "npc_elder",
  mayor: "npc_elder",
  leader: "npc_elder",
  hermit: "npc_elder",

  // Innkeeper variants
  innkeeper: "npc_innkeeper",
  bartender: "npc_innkeeper",
  barkeep: "npc_innkeeper",
  tavernkeeper: "npc_innkeeper",
  barmaid: "npc_innkeeper",
  cook: "npc_innkeeper",
  chef: "npc_innkeeper",
};
