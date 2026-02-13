# Advanced Sprite System — Design Document

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 19:57:44 EST |
| **Last Modified**  | 2026-02-12 20:05:46 EST |
| **Status**         | approved |
| **Author**         | fresh-gecko |
| **References**     | [Design Doc](../design.md), [PRD](../prd.md), [Animation DD](20260212133443-animation-atmosphere.md) |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Half-Block Pixel Rendering](#3-half-block-pixel-rendering)
4. [Sprite Template System](#4-sprite-template-system)
5. [Ground Rendering](#5-ground-rendering)
6. [Built-In Sprite Library](#6-built-in-sprite-library)
7. [Asset Caching](#7-asset-caching)
8. [ZoneBuilder Integration](#8-zonebuilder-integration)
9. [TileRenderer Rewrite](#9-tilerenderer-rewrite)
10. [Configuration](#10-configuration)
11. [Performance Budget](#11-performance-budget)
12. [Implementation Plan](#12-implementation-plan)
13. [Appendices](#13-appendices)

---

## 1. Overview

### Problem

The current rendering system draws each game tile as a single Unicode character with a foreground/background color. Trees are `♣`, NPCs are `☺`, buildings are box-drawing rectangles. The result looks like a traditional ASCII roguelike — functional but visually flat. Ground tiles are randomly selected punctuation characters (`·`, `.`, `,`), creating visual noise rather than readable terrain.

The user wants visuals inspired by Pokemon GBA games: recognizable multi-cell sprites with color detail, readable terrain, and visual depth.

### Solution

A **half-block pixel rendering** system that transforms the game viewport into a pixel-art canvas. Each terminal cell encodes two vertical pixels using Unicode half-block characters (`▀`, `▄`, `█`), effectively doubling vertical resolution. Objects, buildings, and NPCs become multi-cell **sprite templates** — small pixel-art images rendered over pixel-textured ground.

A **sprite registry** with **disk caching** stores reusable sprite templates so they can be loaded once and rendered efficiently across sessions.

### Scope

**In scope:**
- Half-block pixel rendering engine (PixelBuffer → FrameBuffer encoding)
- Sprite template format and registry
- Built-in sprite library (~20-30 templates covering trees, buildings, NPCs, objects)
- Pixel-based ground textures per biome
- Y-sorted depth rendering (objects lower on screen overlap those above)
- Disk-based sprite cache (`~/.daydream/sprite-cache/`)
- ZoneBuilder updates to place multi-cell sprites
- TileRenderer rewrite to use pixel rendering pipeline

**Out of scope (future work):**
- AI-generated custom pixel sprites — future DD
- Sprite animations — covered by Animation & Atmosphere DD
- Half-block mode for UI elements (menus, dialogue) — UI stays character-based
- Custom player sprite editor
- Sprite sheets / sprite atlases

---

## 2. Architecture

### 2.1 System Overview

```
@daydream/renderer
  ├── sprites/
  │   ├── types.ts           — SpriteTemplate, SpriteCell, SpriteInstance
  │   ├── SpriteRegistry.ts  — In-memory registry + disk cache
  │   ├── PixelBuffer.ts     — 2D pixel grid (width × height*2)
  │   └── library/           — Built-in sprite template definitions
  │       ├── trees.ts
  │       ├── buildings.ts
  │       ├── npcs.ts
  │       └── objects.ts
  ├── palettes/
  │   └── ground-textures.ts — Pixel-level ground patterns per biome
  ├── TileRenderer.ts        — Rewritten: pixel pipeline + half-block encoding
  └── types.ts               — Updated with sprite-aware zone data

@daydream/engine
  └── types.ts               — SpriteInstance schema added to Zone/ZoneData
  └── world/ZoneBuilder.ts   — Updated to place sprites + collision masks
```

### 2.2 Rendering Pipeline

```
Zone Data (ground tiles + sprite instances)
  │
  ├─ 1. Create PixelBuffer (viewWidth × viewHeight*2 pixels)
  │
  ├─ 2. Render ground pixels
  │     For each visible cell, get ground tile → resolve to 2 pixel colors
  │     using biome ground texture patterns
  │
  ├─ 3. Collect visible sprite instances
  │     Filter to viewport, sort by y-position (ascending = back to front)
  │
  ├─ 4. Render sprites into PixelBuffer
  │     For each sprite: look up template, blit non-transparent pixels
  │
  ├─ 5. Render player sprite
  │
  ├─ 6. Encode PixelBuffer → half-block characters
  │     For each cell (col, row):
  │       topPixel = pixelBuffer[col][row*2]
  │       botPixel = pixelBuffer[col][row*2 + 1]
  │       → setCell(col, row, encodedChar, fgColor, bgColor)
  │
  └─ 7. Apply animation overrides + time-of-day transform (existing system)
```

### 2.3 Key Design Decisions

1. **Full half-block viewport** — the entire game viewport uses pixel rendering, not just sprites. This avoids the visual mismatch of mixing character tiles and pixel sprites. (See Appendix A.)

2. **Sprites reference templates** — zone data stores sprite instances (template ID + position), not pixel data. Templates live in the registry. This keeps zone data small and enables caching.

3. **Ground tiles stay as TileCell** — the ground layer keeps the existing `TileCell[]` format (char, fg, bg). The pixel renderer converts each ground tile to 2 pixel colors using biome texture patterns. This is backward-compatible.

4. **Object layer becomes sprite instances** — objects are no longer single-cell `TileCell` entries. They're `SpriteInstance[]` referencing templates. Buildings and NPCs also use sprites.

---

## 3. Half-Block Pixel Rendering

### 3.1 The Half-Block Technique

Unicode half-block characters divide a terminal cell into two vertical pixels:

```
┌─────────┐
│ ▀ upper │  ← fg color
│   lower │  ← bg color
└─────────┘
```

- `▀` (U+2580): Upper half filled with fg color, lower half with bg color
- `▄` (U+2584): Lower half filled with fg color, upper half with bg color
- `█` (U+2588): Full cell filled with fg color
- ` ` (space): Full cell filled with bg color

This doubles the vertical resolution. A viewport of 60 cells × 30 cells becomes 60 × 60 pixels.

### 3.2 PixelBuffer

An intermediate buffer at pixel resolution. The renderer composites everything into this buffer, then encodes it to half-block characters.

```typescript
// packages/renderer/src/sprites/PixelBuffer.ts

/** RGBA pixel color (null = transparent) */
type Pixel = string | null;  // hex color string or null

class PixelBuffer {
  /** Width in pixels (= viewport width in cells) */
  readonly width: number;
  /** Height in pixels (= viewport height in cells × 2) */
  readonly height: number;
  private data: Pixel[];

  constructor(cellWidth: number, cellHeight: number) {
    this.width = cellWidth;
    this.height = cellHeight * 2;
    this.data = new Array(this.width * this.height).fill(null);
  }

  getPixel(x: number, y: number): Pixel {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.data[y * this.width + x];
  }

  setPixel(x: number, y: number, color: Pixel): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    if (color !== null) {
      this.data[y * this.width + x] = color;
    }
  }

  /** Fill entire buffer with a color */
  clear(color: Pixel = null): void {
    this.data.fill(color);
  }

  /** Blit a sprite into the buffer at pixel coordinates */
  blitSprite(
    sprite: SpriteTemplate,
    pixelX: number,
    pixelY: number,
  ): void {
    for (let sy = 0; sy < sprite.pixelHeight; sy++) {
      for (let sx = 0; sx < sprite.pixelWidth; sx++) {
        const pixel = sprite.pixels[sy * sprite.pixelWidth + sx];
        if (pixel !== null) {
          this.setPixel(pixelX + sx, pixelY + sy, pixel);
        }
      }
    }
  }
}
```

### 3.3 Half-Block Encoding

Converting a PixelBuffer to terminal cells:

```typescript
function encodeHalfBlocks(
  pixelBuffer: PixelBuffer,
  frameBuffer: OptimizedBuffer,
  defaultBg: string = "#000000",
): void {
  const cellHeight = pixelBuffer.height / 2;

  for (let row = 0; row < cellHeight; row++) {
    for (let col = 0; col < pixelBuffer.width; col++) {
      const topPixel = pixelBuffer.getPixel(col, row * 2) ?? defaultBg;
      const botPixel = pixelBuffer.getPixel(col, row * 2 + 1) ?? defaultBg;

      let char: string;
      let fg: string;
      let bg: string;

      if (topPixel === botPixel) {
        // Both same: full block
        char = "█";
        fg = topPixel;
        bg = topPixel;
      } else {
        // Different: upper half block
        char = "▀";
        fg = topPixel;
        bg = botPixel;
      }

      frameBuffer.setCell(
        col, row, char,
        RGBA.fromHex(fg),
        RGBA.fromHex(bg),
        TextAttributes.NONE,
      );
    }
  }
}
```

---

## 4. Sprite Template System

### 4.1 SpriteTemplate Format

A sprite template is a rectangular pixel grid with optional transparency. Templates are stateless — they describe what a sprite looks like, not where it is.

```typescript
// packages/renderer/src/sprites/types.ts

interface SpriteTemplate {
  /** Unique identifier (e.g., "tree_oak", "building_house", "npc_villager") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Category for organization */
  category: "tree" | "rock" | "building" | "npc" | "object" | "decoration" | "player";

  /** Width in pixels (= cells) */
  pixelWidth: number;

  /** Height in pixels (= cells × 2) */
  pixelHeight: number;

  /** Flat pixel array (row-major, pixelHeight × pixelWidth). null = transparent. */
  pixels: (string | null)[];

  /**
   * Anchor point — the "foot" position used for placement and depth sorting.
   * In pixel coordinates relative to the sprite's top-left.
   * Convention: bottom-center of the sprite's footprint.
   */
  anchor: { x: number; y: number };

  /**
   * Collision footprint — which ground tiles this sprite blocks.
   * In tile coordinates relative to the anchor's tile.
   * E.g., a 3-cell-wide tree with anchor at (1, 5) blocks tiles at
   * offsets [(-1, 0), (0, 0), (1, 0)] from its placed tile position.
   */
  collisionTiles: { dx: number; dy: number }[];

  /** Tags for search/filtering (e.g., ["forest", "large", "deciduous"]) */
  tags: string[];
}
```

### 4.2 Coordinate Mapping

Sprites exist in two coordinate systems:

1. **World tile coordinates** — where the sprite is placed on the tile grid (e.g., tile 15, 20). This is the anchor position.
2. **Pixel coordinates** — the actual pixel positions the sprite occupies in the PixelBuffer.

Conversion from tile to pixel:
```typescript
// Each tile = 1 pixel wide × 2 pixels tall
function tileToPx(tileX: number, tileY: number): { px: number; py: number } {
  return { px: tileX, py: tileY * 2 };
}

// A sprite placed at tile (15, 20) with anchor at pixel (1, 9):
// pixelX = 15 - 1 = 14 (sprite left edge)
// pixelY = 20*2 - 9 = 31 (sprite top edge)
```

### 4.3 SpriteInstance

A placed sprite in the world. Stored per-zone.

```typescript
interface SpriteInstance {
  /** Reference to a SpriteTemplate.id */
  templateId: string;

  /** Position in world tile coordinates (where the anchor lands) */
  position: { x: number; y: number };

  /** Optional color tint override (for variant coloring without new templates) */
  tint?: string;
}
```

### 4.4 SpriteRegistry

Central registry for all sprite templates. Handles in-memory storage and disk caching.

```typescript
// packages/renderer/src/sprites/SpriteRegistry.ts

class SpriteRegistry {
  private templates: Map<string, SpriteTemplate> = new Map();
  private cachePath: string;

  constructor(cachePath: string = "~/.daydream/sprite-cache") {
    this.cachePath = cachePath;
  }

  /** Get a template by ID */
  get(id: string): SpriteTemplate | undefined {
    return this.templates.get(id);
  }

  /** Register a template */
  register(template: SpriteTemplate): void {
    this.templates.set(template.id, template);
  }

  /** Register all built-in templates */
  registerBuiltins(): void {
    for (const template of [...TREE_SPRITES, ...BUILDING_SPRITES, ...NPC_SPRITES, ...OBJECT_SPRITES]) {
      this.register(template);
    }
  }

  /** Find templates by category and/or tags */
  find(opts: { category?: string; tags?: string[] }): SpriteTemplate[] {
    return [...this.templates.values()].filter(t => {
      if (opts.category && t.category !== opts.category) return false;
      if (opts.tags && !opts.tags.every(tag => t.tags.includes(tag))) return false;
      return true;
    });
  }

  /** Persist all templates to disk cache */
  async saveCache(): Promise<void> {
    const data = Object.fromEntries(this.templates);
    await Bun.write(
      `${this.cachePath}/templates.json`,
      JSON.stringify(data),
    );
  }

  /** Load templates from disk cache */
  async loadCache(): Promise<number> {
    const file = Bun.file(`${this.cachePath}/templates.json`);
    if (!await file.exists()) return 0;
    const data = await file.json();
    let count = 0;
    for (const [id, template] of Object.entries(data)) {
      this.templates.set(id, template as SpriteTemplate);
      count++;
    }
    return count;
  }

  get size(): number {
    return this.templates.size;
  }
}
```

---

## 5. Ground Rendering

### 5.1 From Tiles to Pixels

Each ground tile maps to a 1-wide × 2-tall pixel area (1 cell). The pixel renderer converts tiles to pixel colors using **biome ground textures** — deterministic pixel patterns that create visual variety.

```typescript
interface GroundTexture {
  /** Primary colors (most frequent) */
  primary: string[];
  /** Secondary colors (accent/variation) */
  secondary: string[];
  /** Pattern function: given tile position, returns [topPixel, bottomPixel] colors */
  pattern: (tileX: number, tileY: number) => [string, string];
}
```

### 5.2 Ground Texture Patterns

Each biome defines a ground texture that produces 2 pixel colors per tile:

```typescript
// packages/renderer/src/palettes/ground-textures.ts

const forestGround: GroundTexture = {
  primary: ["#2d5a27", "#3a7a33", "#1e4a1e"],
  secondary: ["#4a8a44", "#1a3318"],
  pattern(tileX, tileY) {
    // Deterministic hash for consistent rendering
    const hash = (tileX * 7 + tileY * 13) % 17;
    const colors = this.primary;

    // Subtle two-tone grass pattern
    const top = colors[hash % colors.length];
    const bot = colors[(hash + 3) % colors.length];

    // Occasional darker accent
    if (hash === 0 || hash === 7) {
      return [this.secondary[0], bot];
    }
    return [top, bot];
  },
};

const desertGround: GroundTexture = {
  primary: ["#c2a645", "#b89b3a", "#d4b84f"],
  secondary: ["#a68c30", "#8b7332"],
  pattern(tileX, tileY) {
    const hash = (tileX * 11 + tileY * 3) % 13;
    const colors = this.primary;

    // Sandy dune-like variation
    const top = colors[hash % colors.length];
    const bot = colors[(hash + 1) % colors.length];

    // Occasional shadow
    if (hash === 5) {
      return [top, this.secondary[1]];
    }
    return [top, bot];
  },
};

const townGround: GroundTexture = {
  primary: ["#6a6a5e", "#5a5a4e", "#7a7a6e"],
  secondary: ["#4a4a3e", "#8a8a7a"],
  pattern(tileX, tileY) {
    // Cobblestone-like checkerboard
    const checker = (tileX + tileY) % 2;
    if (checker === 0) {
      return [this.primary[0], this.primary[1]];
    }
    return [this.primary[2], this.primary[0]];
  },
};
```

### 5.3 Special Terrain Pixels

Water, paths, and other terrain features also map to pixel patterns:

```typescript
const waterTexture: GroundTexture = {
  primary: ["#2a5a8a", "#3a6a9a", "#1a4a7a"],
  secondary: ["#4a8ac7", "#1a3a5a"],
  pattern(tileX, tileY) {
    const wave = (tileX + tileY * 2) % 5;
    if (wave === 0) return [this.secondary[0], this.primary[1]]; // Wave crest highlight
    return [this.primary[wave % 3], this.primary[(wave + 1) % 3]];
  },
};

const pathTexture: GroundTexture = {
  primary: ["#8b7355", "#7a6345", "#9a8365"],
  secondary: ["#5a4a35", "#6a5a45"],
  pattern(tileX, tileY) {
    const hash = (tileX * 5 + tileY * 9) % 7;
    return [this.primary[hash % 3], this.primary[(hash + 2) % 3]];
  },
};
```

### 5.4 Resolving Ground Tile to Texture

The renderer needs to determine which texture to use for each ground tile. This is inferred from the existing `TileCell` data:

```typescript
function resolveGroundTexture(tile: TileCell, biomeType: string): GroundTexture {
  const char = tile.char;

  // Water tiles (from existing palette data)
  if (char === "~" || char === "≈" || char === "∼") return waterTexture;

  // Path tiles
  if (char === "░" || char === "▓" || char === "▒") return pathTexture;

  // Default: biome ground
  return biomeGroundTextures[biomeType] ?? forestGround;
}
```

This is backward-compatible — existing zones with `TileCell[]` ground data render correctly through the pixel pipeline without any zone data migration.

---

## 6. Built-In Sprite Library

### 6.1 Design Constraints

Sprites are pixel art at a specific resolution:
- 1 pixel = 1 cell wide × 0.5 cells tall (half-block)
- Sprite dimensions are in pixels
- Typical sizes: 3-6 wide × 4-10 tall (= 3-6 cells × 2-5 cells)
- Keep sprites compact — the viewport is ~60×60 pixels

### 6.2 Tree Sprites

```typescript
// packages/renderer/src/sprites/library/trees.ts

// Pine tree: 3px wide × 8px tall (3 cells × 4 cells)
const TREE_PINE: SpriteTemplate = {
  id: "tree_pine",
  name: "Pine Tree",
  category: "tree",
  pixelWidth: 3,
  pixelHeight: 8,
  pixels: [
    null,     "#1a6b1a", null,       // row 0:    peak
    "#1a6b1a","#228b22", "#1a6b1a",  // row 1:   canopy
    "#1a6b1a","#228b22", "#1a6b1a",  // row 2:   canopy
    "#2d8b2d","#3a9a3a", "#2d8b2d",  // row 3:  canopy
    "#2d8b2d","#3a9a3a", "#2d8b2d",  // row 4:  canopy
    "#228b22","#2d8b2d", "#228b22",  // row 5:  canopy base
    null,     "#5c3a1e", null,       // row 6:    trunk
    null,     "#4a2a0e", null,       // row 7:    trunk base
  ],
  anchor: { x: 1, y: 7 },           // bottom-center
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["forest", "evergreen"],
};

// Oak tree: 5px wide × 8px tall (5 cells × 4 cells)
const TREE_OAK: SpriteTemplate = {
  id: "tree_oak",
  name: "Oak Tree",
  category: "tree",
  pixelWidth: 5,
  pixelHeight: 8,
  pixels: [
    null,     "#1e6b1e","#228b22","#1e6b1e", null,       // row 0
    "#1e6b1e","#228b22","#3a9a3a","#228b22", "#1e6b1e",  // row 1
    "#228b22","#3a9a3a","#4aaa4a","#3a9a3a", "#228b22",  // row 2
    "#228b22","#3a9a3a","#4aaa4a","#3a9a3a", "#228b22",  // row 3
    "#1e6b1e","#228b22","#3a9a3a","#228b22", "#1e6b1e",  // row 4
    null,     "#1e6b1e","#228b22","#1e6b1e", null,       // row 5
    null,     null,     "#5c3a1e",null,      null,       // row 6
    null,     null,     "#4a2a0e",null,      null,       // row 7
  ],
  anchor: { x: 2, y: 7 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["forest", "deciduous", "large"],
};

// Small bush: 3px wide × 3px tall
const BUSH: SpriteTemplate = {
  id: "bush",
  name: "Bush",
  category: "tree",
  pixelWidth: 3,
  pixelHeight: 3,
  pixels: [
    null,     "#2d6b2d", null,
    "#2d6b2d","#3a8a3a", "#2d6b2d",
    "#1e5a1e","#2d6b2d", "#1e5a1e",
  ],
  anchor: { x: 1, y: 2 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["forest", "small"],
};
```

### 6.3 Building Sprites

```typescript
// packages/renderer/src/sprites/library/buildings.ts

// Small house: 7px wide × 8px tall (7 cells × 4 cells)
const BUILDING_HOUSE: SpriteTemplate = {
  id: "building_house",
  name: "House",
  category: "building",
  pixelWidth: 7,
  pixelHeight: 8,
  pixels: [
    null,     null,     "#7a4a2a","#8a5a3a","#7a4a2a", null,     null,     // row 0: roof peak
    null,     "#7a4a2a","#8a5a3a","#9a6a4a","#8a5a3a", "#7a4a2a",null,     // row 1: roof
    "#7a4a2a","#8a5a3a","#9a6a4a","#aa7a5a","#9a6a4a", "#8a5a3a","#7a4a2a",// row 2: roof base
    "#b8a070","#b8a070","#b8a070","#b8a070","#b8a070", "#b8a070","#b8a070",// row 3: wall top
    "#b8a070","#6a8ab0","#b8a070","#b8a070","#b8a070", "#6a8ab0","#b8a070",// row 4: wall + windows
    "#b8a070","#6a8ab0","#b8a070","#b8a070","#b8a070", "#6a8ab0","#b8a070",// row 5: wall + windows
    "#b8a070","#b8a070","#b8a070","#3d2b1f","#b8a070", "#b8a070","#b8a070",// row 6: wall + door
    "#8a7a5a","#8a7a5a","#8a7a5a","#3d2b1f","#8a7a5a", "#8a7a5a","#8a7a5a",// row 7: foundation + door
  ],
  anchor: { x: 3, y: 7 },
  collisionTiles: [
    // Block the full footprint except the door tile
    { dx: -3, dy: 0 }, { dx: -2, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 3, dy: 0 },
    { dx: -3, dy: -1 }, { dx: -2, dy: -1 }, { dx: -1, dy: -1 },
    { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 2, dy: -1 }, { dx: 3, dy: -1 },
  ],
  tags: ["town", "residential"],
};

// Shop: 8px wide × 8px tall
const BUILDING_SHOP: SpriteTemplate = {
  id: "building_shop",
  name: "Shop",
  category: "building",
  pixelWidth: 8,
  pixelHeight: 8,
  pixels: [
    // ... similar structure with awning detail and sign
    // Roof: darker brown
    // Walls: lighter tan
    // Awning: colorful stripe (red/white)
    // Windows: blue
    // Door: dark wood
    null,     null,     "#6a3a1a","#7a4a2a","#7a4a2a","#6a3a1a", null,     null,
    null,     "#6a3a1a","#7a4a2a","#8a5a3a","#8a5a3a","#7a4a2a", "#6a3a1a",null,
    "#6a3a1a","#7a4a2a","#8a5a3a","#9a6a4a","#9a6a4a","#8a5a3a", "#7a4a2a","#6a3a1a",
    "#c04040","#e0e0d0","#c04040","#e0e0d0","#c04040","#e0e0d0", "#c04040","#e0e0d0",
    "#c0a878","#5878a8","#c0a878","#c0a878","#c0a878","#c0a878", "#5878a8","#c0a878",
    "#c0a878","#5878a8","#c0a878","#c0a878","#c0a878","#c0a878", "#5878a8","#c0a878",
    "#c0a878","#c0a878","#c0a878","#4a3020","#4a3020","#c0a878", "#c0a878","#c0a878",
    "#8a7a5a","#8a7a5a","#8a7a5a","#4a3020","#4a3020","#8a7a5a", "#8a7a5a","#8a7a5a",
  ],
  anchor: { x: 3, y: 7 },
  collisionTiles: [
    { dx: -3, dy: 0 }, { dx: -2, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 3, dy: 0 }, { dx: 4, dy: 0 },
    { dx: -3, dy: -1 }, { dx: -2, dy: -1 }, { dx: -1, dy: -1 },
    { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 2, dy: -1 },
    { dx: 3, dy: -1 }, { dx: 4, dy: -1 },
  ],
  tags: ["town", "commercial"],
};
```

### 6.4 NPC Sprites

```typescript
// packages/renderer/src/sprites/library/npcs.ts

// Villager: 3px wide × 5px tall (3 cells × 2.5 cells)
const NPC_VILLAGER: SpriteTemplate = {
  id: "npc_villager",
  name: "Villager",
  category: "npc",
  pixelWidth: 3,
  pixelHeight: 5,
  pixels: [
    null,     "#deb887", null,       // row 0: head top
    "#deb887","#c9a878", "#deb887",  // row 1: head/face
    "#4a7aaa","#4a7aaa", "#4a7aaa",  // row 2: torso
    "#4a7aaa","#deb887", "#4a7aaa",  // row 3: torso/hands
    "#5a3a1a","null",    "#5a3a1a",  // row 4: legs
  ],
  anchor: { x: 1, y: 4 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["town", "civilian"],
};

// Guard: 3px wide × 6px tall (armor detail)
const NPC_GUARD: SpriteTemplate = {
  id: "npc_guard",
  name: "Guard",
  category: "npc",
  pixelWidth: 3,
  pixelHeight: 6,
  pixels: [
    null,     "#808080", null,       // row 0: helmet top
    "#808080","#c0c0c0", "#808080",  // row 1: helmet
    "#a0a0a0","#c0c0c0", "#a0a0a0",  // row 2: shoulder armor
    "#808080","#a0a0a0", "#808080",  // row 3: chestplate
    "#808080","#a0a0a0", "#808080",  // row 4: lower armor
    "#5a4a3a",null,      "#5a4a3a",  // row 5: boots
  ],
  anchor: { x: 1, y: 5 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["town", "military"],
};
```

### 6.5 Player Sprite

```typescript
// Player: 3px wide × 5px tall
const PLAYER_SPRITE: SpriteTemplate = {
  id: "player_default",
  name: "Player",
  category: "player",
  pixelWidth: 3,
  pixelHeight: 5,
  pixels: [
    null,     "#f0e0c0", null,       // row 0: head top
    "#f0e0c0","#e0d0b0", "#f0e0c0",  // row 1: head/face
    "#2060c0","#2060c0", "#2060c0",  // row 2: torso (blue tunic)
    "#2060c0","#f0e0c0", "#2060c0",  // row 3: torso/hands
    "#4a3020",null,      "#4a3020",  // row 4: boots
  ],
  anchor: { x: 1, y: 4 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["player"],
};
```

### 6.6 Object Sprites

```typescript
// packages/renderer/src/sprites/library/objects.ts

// Rock: 2px wide × 2px tall
const ROCK_LARGE: SpriteTemplate = {
  id: "rock_large",
  name: "Large Rock",
  category: "rock",
  pixelWidth: 2,
  pixelHeight: 2,
  pixels: [
    "#7a7a7a", "#8a8a8a",
    "#5a5a5a", "#6a6a6a",
  ],
  anchor: { x: 0, y: 1 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["natural"],
};

// Chest: 2px wide × 2px tall
const CHEST: SpriteTemplate = {
  id: "chest",
  name: "Treasure Chest",
  category: "object",
  pixelWidth: 2,
  pixelHeight: 2,
  pixels: [
    "#c9a959", "#dab969",
    "#8a6930", "#9a7940",
  ],
  anchor: { x: 0, y: 1 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["interactive", "container"],
};

// Sign post: 1px wide × 4px tall
const SIGN: SpriteTemplate = {
  id: "sign",
  name: "Sign Post",
  category: "object",
  pixelWidth: 3,
  pixelHeight: 4,
  pixels: [
    "#8b7355", "#a08565", "#8b7355",
    "#8b7355", "#c0b090", "#8b7355",
    null,      "#5c3a1e", null,
    null,      "#4a2a0e", null,
  ],
  anchor: { x: 1, y: 3 },
  collisionTiles: [{ dx: 0, dy: 0 }],
  tags: ["interactive"],
};

// Flower cluster: 2px wide × 2px tall
const FLOWERS: SpriteTemplate = {
  id: "flowers",
  name: "Flowers",
  category: "decoration",
  pixelWidth: 2,
  pixelHeight: 2,
  pixels: [
    "#ff69b4", "#ff9944",
    "#228b22", "#228b22",
  ],
  anchor: { x: 0, y: 1 },
  collisionTiles: [],  // walkable
  tags: ["forest", "decoration"],
};
```

### 6.7 Template ID Mapping

AI-generated zones reference objects by type string (e.g., `"tree"`, `"house"`). A mapping table resolves these to sprite template IDs:

```typescript
const OBJECT_TYPE_TO_SPRITE: Record<string, string> = {
  // Trees
  tree: "tree_oak",
  tree_pine: "tree_pine",
  tree_oak: "tree_oak",
  pine: "tree_pine",
  oak: "tree_oak",
  tree_dead: "tree_dead",
  bush: "bush",
  shrub: "bush",
  hedge: "bush",

  // Buildings
  house: "building_house",
  shop: "building_shop",
  tavern: "building_tavern",
  inn: "building_tavern",

  // Rocks
  rock: "rock_large",
  rock_large: "rock_large",
  boulder: "rock_large",
  rock_small: "rock_small",

  // Objects
  chest: "chest",
  sign: "sign",
  signpost: "sign",
  barrel: "barrel",
  crate: "barrel",
  flowers: "flowers",
  flower: "flowers",
};

// NPC types map to sprite categories
const NPC_ROLE_TO_SPRITE: Record<string, string> = {
  villager: "npc_villager",
  guard: "npc_guard",
  merchant: "npc_merchant",
  child: "npc_child",
  elder: "npc_elder",
};
```

---

## 7. Asset Caching

### 7.1 Cache Directory

```
~/.daydream/sprite-cache/
  templates.json    — Serialized SpriteTemplate map
  custom/           — Future: AI-generated custom sprites
```

### 7.2 Cache Lifecycle

```
Game Start
  ├── SpriteRegistry.registerBuiltins()     — Load hardcoded templates
  ├── SpriteRegistry.loadCache()            — Load any cached custom templates
  └── Ready

Zone Generation
  ├── ZoneBuilder resolves objects to sprite template IDs
  ├── Templates already in registry — no generation needed
  └── Store SpriteInstance[] in zone data

Future: Custom Sprite Generation
  ├── AI describes a unique object not in library
  ├── Generate pixel art (via AI or procedural)
  ├── SpriteRegistry.register(newTemplate)
  ├── SpriteRegistry.saveCache()
  └── Available for all future zones
```

### 7.3 Cache Invalidation

Built-in sprites are versioned. When the game updates built-in sprites (improved art), the updated versions overwrite cache entries with the same ID. Custom sprites (future) are immutable once generated.

```typescript
// Each built-in sprite has an implicit version from the source code.
// registerBuiltins() always overwrites cached versions of built-in IDs.
```

---

## 8. ZoneBuilder Integration

### 8.1 Updated ZoneBuildResult

The ZoneBuilder output adds a sprite instances list:

```typescript
interface ZoneBuildResult {
  id: string;
  width: number;
  height: number;
  layers: TileLayer[];           // ground + collision (objects layer removed)
  sprites: SpriteInstance[];     // NEW: placed sprite instances
  spawnPoint: { x: number; y: number };
}
```

### 8.2 Object Placement with Sprites

When ZoneBuilder places an object, it now:
1. Resolves the object type to a sprite template ID
2. Looks up the template to get collision footprint
3. Checks that all collision tiles are available (not already blocked)
4. Places a `SpriteInstance` in the sprites list
5. Marks collision tiles in the collision layer

```typescript
// Updated placeObject in ZoneBuilder
private placeObject(
  obj: ZoneBuildSpec["objects"][0],
  sprites: SpriteInstance[],
  collision: TileCell[],
  width: number,
  height: number,
  registry: SpriteRegistry,
): void {
  const { x, y } = obj.position;
  if (x < 0 || x >= width || y < 0 || y >= height) return;

  // Resolve to sprite template
  const templateId = OBJECT_TYPE_TO_SPRITE[obj.type.toLowerCase()];
  if (!templateId) return;

  const template = registry.get(templateId);
  if (!template) return;

  // Check collision footprint
  for (const { dx, dy } of template.collisionTiles) {
    const cx = x + dx;
    const cy = y + dy;
    if (cx < 0 || cx >= width || cy < 0 || cy >= height) return;
    if (collision[cy * width + cx]?.char === "1") return; // Already blocked
  }

  // Place sprite instance
  sprites.push({ templateId, position: { x, y } });

  // Mark collision
  for (const { dx, dy } of template.collisionTiles) {
    const cx = x + dx;
    const cy = y + dy;
    collision[cy * width + cx] = BLOCKED;
  }
}
```

### 8.3 Building Placement with Sprites

Buildings transition from box-drawing characters to sprite templates. The ZoneBuilder resolves building type to a building sprite template and places it the same way as objects, but with a larger collision footprint.

### 8.4 NPC Placement

NPCs reference sprite templates by role. The NPC's visual data still stores its sprite template ID for the CharacterRenderer to use.

### 8.5 Backward Compatibility

The ground layer (`TileCell[]`) is unchanged. Existing save data with object-layer tiles still works — the renderer falls back to rendering them as single-pixel colored dots if no sprite instance is found. New zones use sprite instances.

---

## 9. TileRenderer Rewrite

### 9.1 New Rendering API

```typescript
class TileRenderer {
  private buffer: OptimizedBuffer;
  private pixelBuffer: PixelBuffer;
  private registry: SpriteRegistry;

  constructor(
    buffer: OptimizedBuffer,
    registry: SpriteRegistry,
  ) {
    this.buffer = buffer;
    this.registry = registry;
    this.pixelBuffer = new PixelBuffer(buffer.width, buffer.height);
  }

  renderZone(
    zone: ZoneData,
    viewport: ViewportManager,
    playerX: number,
    playerY: number,
  ): void {
    const { cameraX, cameraY, viewWidth, viewHeight } = viewport;
    this.pixelBuffer.clear("#000000");

    // 1. Render ground pixels
    this.renderGround(zone, cameraX, cameraY, viewWidth, viewHeight);

    // 2. Collect and sort visible sprites
    const visibleSprites = this.collectVisibleSprites(
      zone, cameraX, cameraY, viewWidth, viewHeight,
    );

    // 3. Y-sort sprites (ascending y = back to front)
    visibleSprites.sort((a, b) => a.sortY - b.sortY);

    // 4. Render sprites into pixel buffer
    for (const { instance, template, screenPx, screenPy } of visibleSprites) {
      this.pixelBuffer.blitSprite(template, screenPx, screenPy);
    }

    // 5. Render player sprite
    this.renderPlayer(playerX, playerY, viewport);

    // 6. Encode pixel buffer to half-block characters
    encodeHalfBlocks(this.pixelBuffer, this.buffer);
  }

  private renderGround(
    zone: ZoneData,
    cameraX: number,
    cameraY: number,
    viewWidth: number,
    viewHeight: number,
  ): void {
    const groundLayer = zone.layers.find(l => l.name === "ground");
    if (!groundLayer) return;

    const biomeType = zone.biomeType ?? "forest";

    for (let sy = 0; sy < viewHeight; sy++) {
      for (let sx = 0; sx < viewWidth; sx++) {
        const wx = sx + cameraX;
        const wy = sy + cameraY;

        if (wx < 0 || wx >= groundLayer.width || wy < 0 || wy >= groundLayer.height) continue;

        const tile = groundLayer.data[wy * groundLayer.width + wx];
        if (!tile) continue;

        // Resolve ground tile to pixel colors
        const texture = resolveGroundTexture(tile, biomeType);
        const [topColor, botColor] = texture.pattern(wx, wy);

        this.pixelBuffer.setPixel(sx, sy * 2, topColor);
        this.pixelBuffer.setPixel(sx, sy * 2 + 1, botColor);
      }
    }
  }

  private collectVisibleSprites(
    zone: ZoneData,
    cameraX: number,
    cameraY: number,
    viewWidth: number,
    viewHeight: number,
  ): VisibleSprite[] {
    const result: VisibleSprite[] = [];

    for (const instance of zone.sprites ?? []) {
      const template = this.registry.get(instance.templateId);
      if (!template) continue;

      // Convert anchor tile position to pixel position
      const anchorPx = instance.position.x;
      const anchorPy = instance.position.y * 2;

      // Sprite top-left in world pixel coords
      const worldPx = anchorPx - template.anchor.x;
      const worldPy = anchorPy - template.anchor.y;

      // Screen pixel coords
      const screenPx = worldPx - cameraX;
      const screenPy = worldPy - cameraY * 2;

      // Visibility check (any overlap with viewport)
      if (screenPx + template.pixelWidth <= 0 || screenPx >= viewWidth) continue;
      if (screenPy + template.pixelHeight <= 0 || screenPy >= viewHeight * 2) continue;

      result.push({
        instance,
        template,
        screenPx,
        screenPy,
        sortY: instance.position.y, // Sort by anchor tile Y
      });
    }

    return result;
  }

  private renderPlayer(
    playerX: number,
    playerY: number,
    viewport: ViewportManager,
  ): void {
    const pos = viewport.worldToScreen(playerX, playerY);
    if (!pos) return;

    const playerTemplate = this.registry.get("player_default");
    if (playerTemplate) {
      const px = pos.x - playerTemplate.anchor.x;
      const py = pos.y * 2 - playerTemplate.anchor.y;
      this.pixelBuffer.blitSprite(playerTemplate, px, py);
    }
  }
}
```

### 9.2 ZoneData Extension

```typescript
// Updated ZoneData in renderer types
interface ZoneData {
  id: string;
  width: number;
  height: number;
  layers: TileLayer[];
  sprites?: SpriteInstance[];    // NEW
  biomeType?: string;            // NEW: for ground texture resolution
}
```

### 9.3 Integration with Animation System

The Animation & Atmosphere DD defines `AnimationOverrides` as a `Map<"x,y", CellOverride>` that modifies tile cells. With the pixel renderer, animation overrides apply differently:

- **Tile-level overrides** (water shimmer, torch flicker) modify ground pixel colors instead of characters
- **Time-of-day color transform** applies to the final pixel colors before half-block encoding
- The `AnimationState` interface stays the same; the TileRenderer applies it at a different stage

```typescript
// After pixel buffer is filled but before encoding:
if (animState?.colorTransform) {
  applyColorTransformToPixelBuffer(this.pixelBuffer, animState.colorTransform);
}
```

---

## 10. Configuration

```typescript
// packages/renderer/src/sprites/sprite-config.ts

interface SpriteConfig {
  /** Path to sprite cache directory. Default: "~/.daydream/sprite-cache" */
  cachePath: string;
  /** Whether to use half-block rendering. Default: true */
  halfBlockMode: boolean;
  /** Default background color for empty pixels. Default: "#000000" */
  defaultBg: string;
}

const DEFAULT_SPRITE_CONFIG: SpriteConfig = {
  cachePath: "~/.daydream/sprite-cache",
  halfBlockMode: true,
  defaultBg: "#000000",
};
```

---

## 11. Performance Budget

### 11.1 Memory

| Component | Size | Notes |
|-----------|------|-------|
| PixelBuffer (60×60 pixels) | ~29 KB | 3600 pixels × 8 bytes (string ref) |
| Built-in sprite templates (~30) | ~15 KB | Small pixel arrays |
| SpriteRegistry (in-memory) | ~20 KB | Map overhead + templates |
| Sprite cache (disk) | ~50 KB | JSON serialized |
| **Total** | **~64 KB** | Negligible vs. zone data (~330 KB) |

### 11.2 Per-Frame Rendering Cost

| Operation | Time | Notes |
|-----------|------|-------|
| Clear PixelBuffer | < 0.5ms | Fill 3600 entries |
| Render ground pixels | ~2ms | 1800 tiles × 2 pixels each |
| Collect + sort sprites | < 0.5ms | ~20-50 sprites per zone |
| Blit sprites | ~1ms | ~20 visible sprites × ~30 pixels each |
| Half-block encoding | ~2ms | 1800 cells, 3 string operations each |
| **Total** | **~6ms** | Within 15fps budget (67ms) |

Current TileRenderer takes ~5-10ms. The pixel renderer adds ~1-2ms for the encoding step but simplifies character selection (no Unicode lookup).

### 11.3 Startup Cost

| Operation | Time | Notes |
|-----------|------|-------|
| Register built-in templates | < 1ms | ~30 templates, in-memory |
| Load sprite cache | < 5ms | Single JSON file read |
| **Total** | **< 6ms** | Negligible |

---

## 12. Implementation Plan

### Task Breakdown

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 1 | Sprite types & PixelBuffer | `packages/renderer/src/sprites/types.ts`, `packages/renderer/src/sprites/PixelBuffer.ts` | — |
| 2 | SpriteRegistry | `packages/renderer/src/sprites/SpriteRegistry.ts` | #1 |
| 3 | Half-block encoder | `packages/renderer/src/sprites/encode.ts` | #1 |
| 4 | Built-in sprite library | `packages/renderer/src/sprites/library/*.ts` | #1 |
| 5 | Ground textures | `packages/renderer/src/palettes/ground-textures.ts` | — |
| 6 | Engine types (SpriteInstance) | `packages/engine/src/types.ts` | — |
| 7 | ZoneBuilder sprite placement | `packages/engine/src/world/ZoneBuilder.ts` | #1, #6 |
| 8 | TileRenderer rewrite | `packages/renderer/src/TileRenderer.ts` | #1, #2, #3, #4, #5 |
| 9 | GameShell integration | `apps/game/src/GameShell.ts`, `apps/game/src/WorldGenerator.ts` | #7, #8 |
| 10 | Tests | `packages/renderer/src/sprites/__tests__/` | #1-#8 |

### Parallelization

```
#1 (types + PixelBuffer) ──┬── #2 (registry) ──────────┐
                            ├── #3 (encoder) ────────────┤
                            ├── #4 (sprite library) ─────┼── #8 (TileRenderer) ── #9 (GameShell)
#5 (ground textures) ──────┘                             │
#6 (engine types) ──── #7 (ZoneBuilder) ─────────────────┘
                                                         #10 (tests, alongside)
```

**Wave 1 (parallel):** Tasks 1, 5, 6
**Wave 2 (parallel, after Wave 1):** Tasks 2, 3, 4, 7
**Wave 3 (after Wave 2):** Task 8
**Wave 4 (after Wave 3):** Tasks 9, 10

### Test Plan

- **PixelBuffer unit tests**: set/get pixels, bounds checking, clear, blit
- **Half-block encoder tests**: same colors → `█`, different → `▀`, transparency
- **SpriteRegistry tests**: register, get, find by tags, save/load cache
- **Ground texture tests**: deterministic output for same coordinates, all biomes produce valid colors
- **ZoneBuilder tests**: sprites placed within bounds, collision mask applied, overlap prevention
- **TileRenderer integration**: render a zone with sprites, verify pixel buffer contents and half-block output
- **Visual verification**: manual — run the game and compare visual quality

---

## 13. Appendices

### Appendix A: Full Half-Block Viewport vs. Sprite-Only Half-Blocks

**Decision:** The entire game viewport uses half-block pixel rendering.

**Options considered:**

1. **Full half-block viewport (chosen):** All rendering — ground, objects, characters — goes through the pixel pipeline and half-block encoding.
   - Pro: Consistent visual style. No jarring mix of pixel art and ASCII characters.
   - Pro: Ground textures gain visual depth from 2-color-per-cell patterns.
   - Pro: Single rendering pipeline — simpler to maintain.
   - Con: Loses the ability to display text characters (like `@`) in the viewport. All visuals must be pixel art.

2. **Sprite-only half-blocks:** Ground stays as ASCII characters, only objects/NPCs use half-block sprites overlaid on top.
   - Pro: Ground retains character-based texture variety.
   - Pro: Less change to existing code — ground rendering stays as-is.
   - Con: Visual mismatch between ASCII ground and pixel sprites looks jarring.
   - Con: Mixing rendering modes in the same viewport is complex (handling the pixel/character boundary).

3. **No half-blocks — multi-cell ASCII sprites:** Objects span multiple cells using Unicode characters, but no half-block trick.
   - Pro: Simplest — extends the current approach.
   - Con: Still looks like ASCII art, just bigger. Doesn't approach the GBA pixel-art aesthetic the user wants.

**Rationale:** The visual consistency of option 1 is worth the trade-off. The user explicitly referenced GBA games, which are fully pixel-art. Going halfway (option 2) creates a visual discord. Option 3 doesn't meet the stated goal. The full pixel pipeline is also architecturally cleaner — one rendering path, one coordinate system.

### Appendix B: Sprite Coordinate System — Pixel vs. Tile

**Decision:** Sprites are positioned in tile coordinates (matching the existing world grid). Pixel rendering converts internally.

**Options considered:**

1. **Tile coordinates (chosen):** Sprites are placed at tile (x, y). The renderer converts to pixels: `pixelX = tileX`, `pixelY = tileY * 2`. Sprites can only be anchored on tile boundaries.
   - Pro: Compatible with existing collision system (tile-based).
   - Pro: ZoneBuilder and AI work in tiles — no coordinate system change.
   - Pro: Simple mental model for placement.
   - Con: Sprites can't be positioned between tiles (sub-tile precision).

2. **Pixel coordinates:** Sprites placed at exact pixel positions, allowing sub-tile alignment.
   - Pro: More precise placement, smoother-looking layouts.
   - Con: Collision system would need pixel-to-tile conversion. ZoneBuilder/AI would need to work in pixels. More complex.

**Rationale:** Tile-based positioning maintains full compatibility with the existing world model (collision, pathfinding, zone data). The slight loss of sub-tile precision is not noticeable given the small pixel sizes (1px = 1 cell wide). Future work could add sub-tile rendering for animation smoothness without changing the placement system.

### Appendix C: Sprite Template Storage — Code vs. Data Files

**Decision:** Built-in sprites are defined in TypeScript source files. Custom/AI-generated sprites (future) are cached as JSON on disk.

**Options considered:**

1. **All in code (chosen for built-ins):** Sprite pixel data defined as TypeScript constants in `library/*.ts`.
   - Pro: Type-checked, easy to review and modify, versioned with the codebase.
   - Pro: No file I/O at startup for built-in sprites.
   - Con: Verbose — pixel arrays in code are hard to visually parse.

2. **All in data files:** Sprites as JSON or PNG files loaded at runtime.
   - Pro: Easier to edit (could use a pixel art editor that exports JSON).
   - Pro: Custom and built-in sprites stored the same way.
   - Con: Requires file I/O at startup. Not type-checked. Needs a loading pipeline.

3. **Hybrid (chosen):** Built-ins in code, custom in JSON cache.
   - Pro: Built-ins are fast and type-safe. Custom sprites are cacheable.
   - Con: Two storage mechanisms.

**Rationale:** Built-in sprites are part of the game's identity — they should be versioned and type-checked. Custom sprites (future) are user/AI-generated content that belongs in a data cache. The hybrid approach gives each category the right trade-offs.

### Appendix D: Ground Texture Approach — Deterministic Patterns vs. Stored Pixel Data

**Decision:** Ground tiles use deterministic texture functions (position → colors) rather than storing pixel data per tile.

**Options considered:**

1. **Deterministic functions (chosen):** Each biome has a `pattern(x, y) → [topColor, bottomColor]` function that maps tile coordinates to pixel colors.
   - Pro: Zero additional storage — ground tiles keep their existing `TileCell` format.
   - Pro: Consistent rendering — same coordinates always produce same colors.
   - Pro: Backward-compatible with existing save data.
   - Con: Patterns are mathematical, not hand-crafted pixel art.

2. **Stored pixel data:** Each ground tile stores its 2 pixel colors explicitly.
   - Pro: Full control over every pixel.
   - Con: Doubles ground layer storage (from 1 color set to 2 per tile). Breaks existing save format.
   - Con: ZoneBuilder needs to generate pixel-level ground data.

**Rationale:** Deterministic functions keep the data model unchanged while producing visually rich ground. The patterns use the existing tile's character type to infer terrain (water, path, etc.) and apply appropriate biome colors. This is a rendering-only change — no zone data migration needed.
