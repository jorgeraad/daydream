// Sprite system barrel export

export type {
  SpriteCell,
  SpriteCategory,
  SpriteTemplate,
  SpriteInstance,
  SpriteConfig,
} from "./types.ts";

export { DEFAULT_SPRITE_CONFIG } from "./types.ts";

export { PixelBuffer } from "./PixelBuffer.ts";

export { SpriteRegistry } from "./SpriteRegistry.ts";
export type { SpriteFindOptions } from "./SpriteRegistry.ts";

export { encodeHalfBlocks } from "./encode.ts";

// Built-in sprite library
export {
  // Individual sprites
  TREE_PINE,
  TREE_OAK,
  TREE_DEAD,
  TREE_BUSH,
  TREE_LARGE_BUSH,
  BUILDING_HOUSE,
  BUILDING_SHOP,
  BUILDING_TAVERN,
  BUILDING_WELL,
  BUILDING_WALL,
  NPC_PLAYER,
  NPC_VILLAGER,
  NPC_GUARD,
  NPC_MERCHANT,
  NPC_CHILD,
  NPC_ELDER,
  NPC_INNKEEPER,
  OBJ_ROCK_LARGE,
  OBJ_ROCK_SMALL,
  OBJ_CHEST,
  OBJ_SIGN,
  OBJ_BARREL,
  OBJ_FLOWERS,
  OBJ_TORCH,
  OBJ_FENCE,
  DECO_GRASS_TUFT,
  DECO_MUSHROOM,
  DECO_PUDDLE,
  DECO_FALLEN_LOG,
  // Category arrays
  TREE_SPRITES,
  BUILDING_SPRITES,
  NPC_SPRITES,
  OBJECT_SPRITES,
  DECORATION_SPRITES,
  // Aggregates
  ALL_SPRITES,
  SPRITE_BY_ID,
  // Mapping tables
  OBJECT_TYPE_TO_SPRITE,
  NPC_ROLE_TO_SPRITE,
} from "./library/index.ts";
