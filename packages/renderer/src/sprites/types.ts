// Sprite system core types
// Foundation for the half-block pixel rendering pipeline

/**
 * A single pixel in a sprite: hex color string (e.g., "#228b22") or null for transparent.
 */
export type SpriteCell = string | null;

/**
 * Sprite category for organization and filtering.
 */
export type SpriteCategory =
  | "tree"
  | "rock"
  | "building"
  | "npc"
  | "object"
  | "decoration"
  | "player";

/**
 * A sprite template — a rectangular pixel grid that defines what a sprite looks like.
 * Templates are stateless: they describe appearance, not placement.
 * Pixel data uses a flat row-major array indexed as `y * pixelWidth + x`.
 */
export interface SpriteTemplate {
  /** Unique identifier (e.g., "tree_oak", "building_house", "npc_villager") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Category for organization and filtering */
  category: SpriteCategory;

  /** Width in pixels (= viewport cells wide) */
  pixelWidth: number;

  /** Height in pixels (= viewport cells tall * 2, since each cell holds 2 vertical pixels) */
  pixelHeight: number;

  /**
   * Flat pixel array in row-major order (pixelHeight * pixelWidth entries).
   * null entries are transparent — they don't overwrite whatever is underneath.
   */
  pixels: SpriteCell[];

  /**
   * Anchor point — the "foot" position used for placement and depth sorting.
   * In pixel coordinates relative to the sprite's top-left corner.
   * Convention: bottom-center of the sprite's footprint.
   */
  anchor: { x: number; y: number };

  /**
   * Collision footprint — which ground tiles this sprite blocks.
   * Offsets are in tile coordinates relative to the anchor's tile position.
   * E.g., a 3-cell-wide tree with anchor at center blocks tiles at
   * offsets [{ dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 1, dy: 0 }].
   * Empty array means the sprite is walkable (no collision).
   */
  collisionTiles: { dx: number; dy: number }[];

  /** Tags for search/filtering (e.g., ["forest", "large", "deciduous"]) */
  tags: string[];
}

/**
 * A placed sprite in the world. Stored per-zone.
 * References a SpriteTemplate by ID rather than embedding pixel data.
 */
export interface SpriteInstance {
  /** Reference to a SpriteTemplate.id in the registry */
  templateId: string;

  /** Position in world tile coordinates (where the anchor lands) */
  position: { x: number; y: number };

  /** Optional hex color tint override (for variant coloring without new templates) */
  tint?: string;
}

/**
 * Configuration for the sprite rendering system.
 */
export interface SpriteConfig {
  /** Path to sprite cache directory */
  cachePath: string;

  /** Whether to use half-block rendering (doubles vertical resolution) */
  halfBlockMode: boolean;

  /** Default background color for empty/transparent pixels */
  defaultBg: string;
}

/** Sensible defaults for SpriteConfig */
export const DEFAULT_SPRITE_CONFIG: SpriteConfig = {
  cachePath: "~/.daydream/sprite-cache",
  halfBlockMode: true,
  defaultBg: "#000000",
};
