// Ground pixel textures for half-block rendering
// Each terminal cell encodes 2 vertical pixels (top/bottom) using the ▀ half-block character.
// Pattern functions are deterministic: same (tileX, tileY) always produces the same colors.

import type { TileCell } from "../types.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A ground texture defines the color palette and spatial pattern for a terrain type.
 *
 * - `primary` / `secondary`: color pools used by the pattern function
 * - `pattern(tileX, tileY)`: returns [topColor, bottomColor] for the two vertical
 *   pixels encoded in a single terminal cell
 */
export interface GroundTexture {
  /** Main color pool (most frequently used) */
  primary: string[];
  /** Accent / variation color pool */
  secondary: string[];
  /** Deterministic mapping from tile position to pixel colors */
  pattern: (tileX: number, tileY: number) => [topColor: string, bottomColor: string];
}

// ---------------------------------------------------------------------------
// Hash helper — deterministic pseudo-random from coordinates
// ---------------------------------------------------------------------------

/**
 * Simple deterministic hash that maps two integers to a value in [0, 1).
 * Based on a variant of the "integer hash" technique — no floating-point
 * randomness, fully reproducible.
 */
function posHash(x: number, y: number, seed: number = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  h = (h ^ (h >> 16)) | 0;
  return (h >>> 0) / 0xffffffff;
}

/** Pick an element from an array using a deterministic hash of the position. */
function pickFromHash<T>(arr: readonly T[], x: number, y: number, seed: number = 0): T {
  const idx = Math.floor(posHash(x, y, seed) * arr.length) % arr.length;
  return arr[idx]!;
}

// ---------------------------------------------------------------------------
// Forest ground texture
// ---------------------------------------------------------------------------

const FOREST_PRIMARY = ["#1a3318", "#1e4a1e", "#224422"];
const FOREST_SECONDARY = ["#2d5a27", "#3a7a33", "#163014"];
const FOREST_ACCENT = "#0f260e";

export const forestGround: GroundTexture = {
  primary: FOREST_PRIMARY,
  secondary: FOREST_SECONDARY,
  pattern(tileX: number, tileY: number): [string, string] {
    const h = posHash(tileX, tileY, 1);

    // ~8% chance of dark accent for subtle variation (fallen leaves / shadow)
    if (h < 0.08) {
      const other = pickFromHash(FOREST_PRIMARY, tileX, tileY, 2);
      return [FOREST_ACCENT, other];
    }

    // Top pixel: mix of primary and secondary
    const topPool = h < 0.55 ? FOREST_PRIMARY : FOREST_SECONDARY;
    const topColor = pickFromHash(topPool, tileX, tileY, 3);

    // Bottom pixel: slight offset so top and bottom usually differ
    const botPool = posHash(tileX, tileY, 4) < 0.55 ? FOREST_PRIMARY : FOREST_SECONDARY;
    const botColor = pickFromHash(botPool, tileX, tileY, 5);

    return [topColor, botColor];
  },
};

// ---------------------------------------------------------------------------
// Desert ground texture
// ---------------------------------------------------------------------------

const DESERT_PRIMARY = ["#8b7332", "#9a833a", "#a68c30"];
const DESERT_SECONDARY = ["#c2a645", "#b89b3a", "#d4b84f"];
const DESERT_SHADOW = "#7a6428";

export const desertGround: GroundTexture = {
  primary: DESERT_PRIMARY,
  secondary: DESERT_SECONDARY,
  pattern(tileX: number, tileY: number): [string, string] {
    // Dune-like wave: use a sine over x offset by y to create diagonal ridges
    const wave = Math.sin((tileX * 0.8 + tileY * 0.3) * 0.9);

    if (wave > 0.6) {
      // Dune crest — lighter sand
      const top = pickFromHash(DESERT_SECONDARY, tileX, tileY, 10);
      const bot = pickFromHash(DESERT_SECONDARY, tileX, tileY, 11);
      return [top, bot];
    }

    if (wave < -0.5) {
      // Dune trough — shadow
      const other = pickFromHash(DESERT_PRIMARY, tileX, tileY, 12);
      return [DESERT_SHADOW, other];
    }

    // Mid-slope — primary tones
    const top = pickFromHash(DESERT_PRIMARY, tileX, tileY, 13);
    const bot = pickFromHash(DESERT_PRIMARY, tileX, tileY, 14);
    return [top, bot];
  },
};

// ---------------------------------------------------------------------------
// Town ground texture
// ---------------------------------------------------------------------------

const TOWN_PRIMARY = ["#4a4a3e", "#52524a", "#484840"];
const TOWN_SECONDARY = ["#5e5e52", "#6a6a5e", "#565650"];
const TOWN_GROUT = "#3a3a30";

export const townGround: GroundTexture = {
  primary: TOWN_PRIMARY,
  secondary: TOWN_SECONDARY,
  pattern(tileX: number, tileY: number): [string, string] {
    // Cobblestone checkerboard: alternate between stone and grout
    const isGap = (tileX + tileY) % 3 === 0;

    if (isGap) {
      // Grout line between cobblestones
      const stone = pickFromHash(TOWN_PRIMARY, tileX, tileY, 20);
      return [TOWN_GROUT, stone];
    }

    // Cobblestone surface — mix of primary and secondary for variation
    const h = posHash(tileX, tileY, 21);
    const topPool = h < 0.6 ? TOWN_PRIMARY : TOWN_SECONDARY;
    const botPool = h < 0.4 ? TOWN_SECONDARY : TOWN_PRIMARY;
    const top = pickFromHash(topPool, tileX, tileY, 22);
    const bot = pickFromHash(botPool, tileX, tileY, 23);
    return [top, bot];
  },
};

// ---------------------------------------------------------------------------
// Water texture
// ---------------------------------------------------------------------------

const WATER_PRIMARY = ["#1a3a5a", "#1e3e5e", "#163656"];
const WATER_SECONDARY = ["#4a8bc7", "#5a9bd7", "#3a7bb7"];
const WATER_CREST = "#7ab8e8";

export const waterTexture: GroundTexture = {
  primary: WATER_PRIMARY,
  secondary: WATER_SECONDARY,
  pattern(tileX: number, tileY: number): [string, string] {
    // Wave pattern — horizontal undulation with occasional crest highlight
    const wave = Math.sin(tileX * 1.2 + tileY * 0.4);
    const h = posHash(tileX, tileY, 30);

    if (wave > 0.7 && h < 0.35) {
      // Wave crest — bright highlight on top pixel
      const bot = pickFromHash(WATER_SECONDARY, tileX, tileY, 31);
      return [WATER_CREST, bot];
    }

    if (wave > 0.3) {
      // Lighter water surface
      const top = pickFromHash(WATER_SECONDARY, tileX, tileY, 32);
      const bot = pickFromHash(WATER_PRIMARY, tileX, tileY, 33);
      return [top, bot];
    }

    // Deep water — darker tones
    const top = pickFromHash(WATER_PRIMARY, tileX, tileY, 34);
    const bot = pickFromHash(WATER_PRIMARY, tileX, tileY, 35);
    return [top, bot];
  },
};

// ---------------------------------------------------------------------------
// Path texture
// ---------------------------------------------------------------------------

const PATH_PRIMARY = ["#5a4a35", "#60503a", "#4e4030"];
const PATH_SECONDARY = ["#8b7355", "#7a6545", "#6b5b40"];

export const pathTexture: GroundTexture = {
  primary: PATH_PRIMARY,
  secondary: PATH_SECONDARY,
  pattern(tileX: number, tileY: number): [string, string] {
    // Earthy, packed-dirt look with subtle grain variation
    const h = posHash(tileX, tileY, 40);

    // ~25% lighter patches (exposed earth / pebbles)
    if (h < 0.25) {
      const top = pickFromHash(PATH_SECONDARY, tileX, tileY, 41);
      const bot = pickFromHash(PATH_PRIMARY, tileX, tileY, 42);
      return [top, bot];
    }

    // Standard packed dirt
    const top = pickFromHash(PATH_PRIMARY, tileX, tileY, 43);
    const bot = pickFromHash(PATH_PRIMARY, tileX, tileY, 44);
    return [top, bot];
  },
};

// ---------------------------------------------------------------------------
// Biome → ground texture mapping
// ---------------------------------------------------------------------------

/** Maps biome type strings to their default ground texture. */
export const biomeGroundTextures: Record<string, GroundTexture> = {
  forest: forestGround,
  desert: desertGround,
  town: townGround,
};

// ---------------------------------------------------------------------------
// Resolver — infer texture from TileCell data
// ---------------------------------------------------------------------------

/** Characters that indicate water tiles */
const WATER_CHARS = new Set(["~", "\u2248", "\u223C"]); // ~ ≈ ∼

/** Characters that indicate path tiles */
const PATH_CHARS = new Set(["\u2591", "\u2593", "\u2592"]); // ░ ▓ ▒

/**
 * Resolve the appropriate ground texture for a tile, inferring from the
 * TileCell's char field when possible (backward-compatible with existing data).
 *
 * Priority:
 *  1. Water chars (~, ≈, ∼) → waterTexture
 *  2. Path chars (░, ▓, ▒) → pathTexture
 *  3. Biome default ground texture
 *  4. Fallback to forestGround if biome is unknown
 */
export function resolveGroundTexture(
  tile: TileCell,
  biomeType: string,
): GroundTexture {
  if (WATER_CHARS.has(tile.char)) {
    return waterTexture;
  }

  if (PATH_CHARS.has(tile.char)) {
    return pathTexture;
  }

  return biomeGroundTextures[biomeType] ?? forestGround;
}
