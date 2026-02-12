# Daydream - Technical Design Document

> This document details the technical architecture and implementation design for Daydream.
> For product requirements and feature descriptions, see [prd.md](./prd.md).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [World Model](#3-world-model)
4. [AI Engine](#4-ai-engine)
5. [Terminal Rendering System](#5-terminal-rendering-system)
6. [TUI Shell & Game Engine](#6-tui-shell--game-engine)
7. [Dialogue System](#7-dialogue-system)
8. [Event System](#8-event-system)
9. [Chronicle & Memory](#9-chronicle--memory)
10. [Persistence Layer](#10-persistence-layer)
11. [State Management](#11-state-management)
12. [API & Networking](#12-api--networking)
13. [Data Models](#13-data-models)
14. [Generation Prompts](#14-generation-prompts)
15. [Performance Budget](#15-performance-budget)
16. [MVP Implementation Order](#16-mvp-implementation-order)

---

## 1. Architecture Overview

### 1.1 System Layers

```
┌──────────────────────────────────────────────────────────────┐
│                      TUI Presentation Layer                    │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │ Game Viewport   │  │ UI Panels      │  │ Overlay Panels │  │
│  │ (FrameBuffer    │  │ (OpenTUI       │  │ (Journal, Map, │  │
│  │  Renderable)    │  │  Box/Text/     │  │  Inventory,    │  │
│  │                 │  │  ScrollBox)    │  │  Save/Load)    │  │
│  └───────┬─────────┘  └──────┬─────────┘  └──────┬─────────┘  │
├──────────┴───────────────────┴──────────────────┴─────────────┤
│                      Game Logic Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ Zone Manager  │  │ Input Router │  │ Viewport Manager  │    │
│  │ Zone Loader   │  │ Key Bindings │  │ Tile Renderer     │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────────┘    │
├─────────┴──────────────────┴────────────────┴─────────────────┤
│                      Intelligence Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ World Gen    │  │ Dialogue Gen │  │ Event Gen         │    │
│  │ Zone Builder │  │ Character AI │  │ World Ticker      │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────────┘    │
│         │                 │                  │                  │
│  ┌──────┴─────────────────┴──────────────────┴──────────────┐  │
│  │                   AI Client (Claude)                       │  │
│  │  - Prompt Construction  - Response Parsing                 │  │
│  │  - Context Management   - Streaming                        │  │
│  └──────────────────────────┬────────────────────────────────┘  │
├──────────────────────────────┴─────────────────────────────────┤
│                      Data Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ World State  │  │ Chronicle    │  │ Tile Palette      │    │
│  │ Store        │  │ Store        │  │ Cache             │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────────┘    │
│         │                 │                  │                  │
│  ┌──────┴─────────────────┴──────────────────┴──────────────┐  │
│  │               Persistence (SQLite via bun:sqlite)          │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Key Design Decisions

**Why OpenTUI over Ink/Blessed:**
- Native Zig rendering engine (better performance for game-loop rendering)
- Built-in `FrameBufferRenderable` for direct cell manipulation (critical for game viewport)
- Flexbox layout via Yoga (easy panel management)
- Built-in `ScrollBoxRenderable` for dialogue/journal scrolling
- Animation timeline API for ambient effects
- Mouse support for future point-and-click interactions
- Supports imperative API, React, and SolidJS - start imperative, scale to reactive

**Why Bun over Node.js:**
- Native TypeScript execution (no build step for development)
- Built-in SQLite (`bun:sqlite`) - eliminates external DB dependency
- FFI support for OpenTUI's Zig native binaries
- Fast package management with workspace support
- Single-file executable compilation for distribution
- Superior performance for the game loop

**Why SQLite over IndexedDB/filesystem:**
- Bun has built-in SQLite support (`bun:sqlite`) - zero dependencies
- ACID transactions for reliable saves
- Structured queries for efficient data access (e.g., "all characters in zone X")
- Single file per world save - easy to backup, copy, share
- Much more storage capacity and query flexibility than JSON files

**Why a monorepo:**
- Clean separation between game logic, AI, and rendering
- `@daydream/engine` can be tested without any TUI dependencies
- `@daydream/ai` can be mocked/tested independently
- Future: renderer could be swapped for a web/graphical version without touching engine/AI
- Bun workspaces make this low-overhead

---

## 2. Monorepo Structure

### 2.1 Workspace Layout

```
daydream/
├── package.json                    # Root: workspaces + dependency catalogs
├── bun.lock                        # Single lockfile for all packages
├── bunfig.toml                     # Bun config (isolated linker)
├── tsconfig.base.json              # Shared TypeScript config
├── docs/
│   ├── prd.md
│   └── design.md
│
├── packages/
│   ├── engine/                     # @daydream/engine
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # Public API exports
│   │       ├── world/
│   │       │   ├── WorldState.ts       # Central state store
│   │       │   ├── Zone.ts             # Zone data model
│   │       │   ├── BiomeSystem.ts      # Biome generation + config
│   │       │   └── ZoneBuilder.ts      # Convert AI spec → zone data
│   │       ├── character/
│   │       │   ├── Character.ts        # Character data model
│   │       │   ├── CharacterMemory.ts  # Per-character memory
│   │       │   └── Behavior.ts         # Autonomous behavior state machines
│   │       ├── chronicle/
│   │       │   ├── Chronicle.ts        # Chronicle store + queries
│   │       │   └── NarrativeThread.ts  # Thread tracking
│   │       ├── event/
│   │       │   ├── EventSystem.ts      # Event queue + processing
│   │       │   ├── WorldTicker.ts      # Periodic world updates
│   │       │   └── WorldClock.ts       # In-game time
│   │       └── types.ts                # Shared type definitions
│   │
│   ├── ai/                         # @daydream/ai
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # Public API exports
│   │       ├── client.ts               # Claude API client
│   │       ├── context.ts              # Context manager (budget, assembly)
│   │       ├── prompts/
│   │       │   ├── world-creation.ts   # World generation prompts
│   │       │   ├── zone-generation.ts  # Zone generation prompts
│   │       │   ├── dialogue.ts         # Dialogue system prompts
│   │       │   ├── events.ts           # Event generation prompts
│   │       │   └── compression.ts      # Chronicle compression prompts
│   │       └── tools/                  # Tool definitions for structured output
│   │           ├── zone-tools.ts
│   │           ├── dialogue-tools.ts
│   │           └── event-tools.ts
│   │
│   └── renderer/                   # @daydream/renderer
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts            # Public API exports
│           ├── TileRenderer.ts         # FrameBuffer-based tile map rendering
│           ├── ViewportManager.ts      # Camera/viewport logic
│           ├── CharacterRenderer.ts    # Character display on viewport
│           ├── EffectsRenderer.ts      # Weather, lighting, particles
│           ├── ui/
│           │   ├── DialoguePanel.ts    # Dialogue box UI
│           │   ├── ContextPanel.ts     # Side panel (location, NPCs, time)
│           │   ├── MiniMap.ts          # Mini-map renderable
│           │   ├── JournalOverlay.ts   # Journal overlay
│           │   ├── InventoryOverlay.ts # Inventory overlay
│           │   └── LoadingScreen.ts    # World generation loading
│           ├── palettes/
│           │   ├── biomes.ts           # Biome tile palettes
│           │   ├── buildings.ts        # Building templates
│           │   ├── characters.ts       # Character display presets
│           │   └── objects.ts          # Object glyphs
│           └── types.ts                # Renderer-specific types
│
└── apps/
    └── game/                       # @daydream/game
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts            # Entry point: creates renderer, wires systems
            ├── GameShell.ts            # Top-level TUI layout + OpenTUI setup
            ├── InputRouter.ts          # Keyboard/mouse → game actions
            ├── SaveManager.ts          # Save/load orchestration
            └── config.ts               # Game configuration constants
```

### 2.2 Root Configuration

**`package.json`:**
```json
{
  "name": "daydream",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "catalog": {
    "typescript": "^5.7.0",
    "@anthropic-ai/sdk": "^0.39.0"
  },
  "scripts": {
    "dev": "bun run --filter '@daydream/game' dev",
    "build": "bun run --workspaces --if-present build",
    "typecheck": "tsc --build",
    "test": "bun run --workspaces --if-present test",
    "start": "bun run apps/game/src/index.ts"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "catalog:"
  }
}
```

**`bunfig.toml`:**
```toml
[install]
linker = "isolated"
```

**`tsconfig.base.json`:**
```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "allowJs": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

### 2.3 Package Dependencies

```
@daydream/game
├── @daydream/engine    (workspace:*)
├── @daydream/ai        (workspace:*)
└── @daydream/renderer  (workspace:*)

@daydream/renderer
├── @daydream/engine    (workspace:*)
└── @opentui/core

@daydream/ai
└── @anthropic-ai/sdk

@daydream/engine
└── (no internal dependencies - pure game logic)
```

Each package exposes TypeScript source directly via the `"bun"` export condition — no intermediate build step needed during development:

```json
{
  "name": "@daydream/engine",
  "exports": {
    ".": {
      "bun": "./src/index.ts",
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

---

## 3. World Model

### 3.1 Zone Structure

The world is a grid of zones. Each zone is a tile map rendered in the terminal viewport.

```
Zone coordinate system:

         (0,-1)
           |
 (-1,0) - (0,0) - (1,0)
           |
         (0,1)

The player starts at zone (0,0). Zones extend infinitely in all directions.
```

Each zone contains:

```typescript
interface Zone {
  id: string;                    // "zone_0_0", "zone_1_-2", etc.
  coords: { x: number; y: number };
  biome: BiomeConfig;
  tiles: TileLayer[];            // Ground, objects, overlay
  characters: CharacterId[];     // References to character registry
  buildings: Building[];
  objects: WorldObject[];
  exits: ZoneExit[];             // Connections to adjacent zones
  generated: boolean;            // Has this zone been fully generated?
  generationSeed: string;        // For reproducibility
  lastVisited: number;           // Timestamp
  metadata: {
    name?: string;               // "The Market Square", "Dark Forest Path"
    description: string;         // AI-generated description for context
    narrativeRole?: string;      // What role this zone plays in the story
  };
}
```

### 3.2 Tile System

Each tile occupies one terminal cell (or uses half-block rendering for 2x vertical resolution). A zone is 40x20 tiles at standard viewport size, scaling with terminal dimensions.

```typescript
interface TileLayer {
  name: "ground" | "objects" | "overlay" | "collision";
  data: TileCell[];  // Flat array, row-major
  width: number;     // 40 (default)
  height: number;    // 20 (default)
}

interface TileCell {
  char: string;      // Unicode character to display
  fg: string;        // Foreground color (hex)
  bg?: string;       // Background color (hex, optional)
  bold?: boolean;    // Text attribute
  dim?: boolean;     // Text attribute
  animated?: boolean;  // Should this tile animate?
  animFrames?: string[]; // Animation frame characters
}
```

The collision layer is binary (0 = passable, 1 = blocked). The AI doesn't need to think about individual tile cells — it describes the zone at a higher level, and the zone builder translates that into tile data using biome palettes.

### 3.3 Zone Generation Pipeline

```
Player approaches zone boundary
         |
         v
Check: Is the adjacent zone already generated?
  |                    |
  Yes                  No
  |                    |
  Load from SQLite     |
  |                    v
  |             Build generation context:
  |             - World seed
  |             - Biome at these coordinates
  |             - Adjacent zone descriptions
  |             - Recent chronicle summary
  |             - Active narrative threads
  |                    |
  |                    v
  |             AI generates zone spec (JSON)
  |                    |
  |                    v
  |             Zone Builder converts spec → tile data
  |             (using biome palettes + building templates)
  |                    |
  |                    v
  |             Generate/assign characters for zone
  |                    |
  |                    v
  |             Store zone in SQLite + world state
  |                    |
  v                    v
  Activate zone in viewport
```

**Preloading**: When the player enters a zone, begin generating all 4 adjacent zones (if not already generated) in the background. This way, movement is never blocked by generation.

### 3.4 Biome System

The world seed generates a biome map that determines what kind of terrain exists at each zone coordinate.

```typescript
interface BiomeConfig {
  type: string;           // "enchanted_forest", "desert_town", "coastal_village"
  terrain: {
    primary: string;      // Main ground type
    secondary: string;    // Variation ground type
    features: string[];   // What kinds of objects/nature to place
  };
  palette: BiomePalette;  // Unicode chars + colors for this biome
  density: {
    vegetation: number;   // 0-1
    structures: number;   // 0-1
    characters: number;   // 0-1
  };
  ambient: {
    lighting: string;     // Affects color temperature
    particles?: string;   // Floating ambient characters
    weather?: string;     // Rain, snow, fog effects
  };
}

interface BiomePalette {
  ground: {
    chars: string[];      // ["·", ".", ","]
    fg: string[];         // Foreground colors
    bg: string;           // Background color
  };
  vegetation: Record<string, {
    char: string;
    fg: string;
    variants?: string[];
  }>;
  water?: {
    chars: string[];
    fg: string[];
    bg: string;
    animated: boolean;
  };
  path?: {
    chars: string[];
    fg: string;
    bg: string;
  };
}
```

Biome assignment uses a simple noise function seeded from the world seed. The AI sets up the biome types and their distribution during world creation; the noise function handles spatial placement.

---

## 4. AI Engine

### 4.1 AI Client

A single client manages all LLM interactions. Lives in the `@daydream/ai` package.

```typescript
class AIClient {
  private client: Anthropic;       // @anthropic-ai/sdk
  private model: string;           // "claude-sonnet-4-5-20250929" for most calls
  private opusModel: string;       // "claude-opus-4-6" for complex generation

  // Core method - all other methods build on this
  async generate(params: {
    system: string;
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
    tools?: Tool[];               // For structured output
    model?: string;               // Override default model
  }): Promise<AIResponse>;

  // Streaming variant for dialogue
  async *stream(params: GenerateParams): AsyncGenerator<string>;
}
```

### 4.2 Model Selection Strategy

Not every AI call needs the most powerful model. Use model tiers:

| Task | Model | Rationale |
|------|-------|-----------|
| World creation | Opus | Complex creative generation, sets the tone for everything |
| Zone generation | Sonnet | Structured output, follows established patterns |
| Dialogue | Sonnet | Fast, good enough for character voices |
| Response options | Haiku | Simple generation, needs to be fast |
| Event evaluation | Sonnet | Needs narrative understanding |
| World tick | Sonnet | Needs to balance subtlety and drama |
| Chronicle compression | Haiku | Summarization is a simpler task |
| Tile palette generation | Haiku | Structured output from templates |

### 4.3 Prompt Architecture

Every AI call uses a layered prompt:

```
[System prompt: Role + World rules + Output format]
[World context: Seed + Biome + Current state summary]
[Chronicle context: Relevant history (compressed)]
[Specific context: Character info, zone details, etc.]
[User/task: What to generate]
```

The system prompt is cached (most of it is static per world). The world and chronicle context are the main variables.

### 4.4 Context Budget Management

Claude's context window is large but not infinite. We need to manage what goes in:

```typescript
interface ContextBudget {
  systemPrompt: number;      // ~2000 tokens (fixed)
  worldContext: number;       // ~1000 tokens (world seed + config)
  chronicleSummary: number;  // ~2000 tokens (compressed history)
  recentEvents: number;      // ~1000 tokens (last few minutes)
  specificContext: number;    // ~2000 tokens (character info, zone data, etc.)
  responseBudget: number;    // ~2000 tokens (for the AI's response)
  // Total: ~10,000 tokens per call (well within limits)
}
```

The **Context Manager** maintains pre-computed context blocks that are updated when state changes:

```typescript
class ContextManager {
  private worldContext: string;       // Updated on world creation
  private chronicleSummary: string;   // Updated every compression cycle
  private recentEvents: string;       // Updated on every chronicle entry

  getContextFor(task: "dialogue" | "zone_gen" | "event" | "world_tick"): ContextBlock;
}
```

### 4.5 Structured Output

All AI responses use tool-use / structured output to ensure parseable results. No free-form JSON parsing.

```typescript
// Example: Zone generation uses a tool definition
const zoneGenerationTool = {
  name: "create_zone",
  description: "Generate the layout and contents of a new zone",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      terrain_layout: { /* ... */ },
      buildings: { /* ... */ },
      characters: { /* ... */ },
      objects: { /* ... */ },
      narrative_hooks: { /* ... */ }
    }
  }
};
```

---

## 5. Terminal Rendering System

### 5.1 OpenTUI Integration

The renderer package (`@daydream/renderer`) wraps OpenTUI to provide game-specific rendering.

```typescript
import { createCliRenderer, FrameBufferRenderable, BoxRenderable, TextRenderable, ScrollBoxRenderable } from "@opentui/core";

class GameRenderer {
  private renderer: CliRenderer;
  private viewport: FrameBufferRenderable;    // Game world
  private contextPanel: BoxRenderable;         // Side panel
  private miniMap: FrameBufferRenderable;      // Mini-map
  private narrativeBar: ScrollBoxRenderable;   // Dialogue/narration

  async init(): Promise<void> {
    this.renderer = await createCliRenderer({
      exitOnCtrlC: false,        // Game handles Ctrl+C (save first)
      targetFps: 15,             // Lower FPS sufficient for tile game
      maxFps: 30,
      useMouse: true,
      autoFocus: true,
      useAlternateScreen: true,
    });

    this.setupLayout();
  }

  private setupLayout(): void {
    // Root: flex column
    // ┌─────────────────┬──────────┐
    // │                 │ mini-map  │
    // │  viewport       ├──────────┤
    // │                 │ context   │
    // ├─────────────────┴──────────┤
    // │  narrative bar              │
    // └────────────────────────────┘

    const topRow = new BoxRenderable(this.renderer, {
      id: "top-row",
      flexDirection: "row",
      flexGrow: 1,
    });

    this.viewport = new FrameBufferRenderable(this.renderer, {
      id: "viewport",
      flexGrow: 1,
    });

    const sidePanel = new BoxRenderable(this.renderer, {
      id: "side-panel",
      width: 20,
      flexDirection: "column",
    });

    this.miniMap = new FrameBufferRenderable(this.renderer, {
      id: "mini-map",
      height: 8,
      borderStyle: "single",
    });

    const contextBox = new BoxRenderable(this.renderer, {
      id: "context",
      flexGrow: 1,
      borderStyle: "single",
    });

    this.narrativeBar = new ScrollBoxRenderable(this.renderer, {
      id: "narrative",
      height: 8,
      borderStyle: "single",
    });

    sidePanel.add(this.miniMap);
    sidePanel.add(contextBox);
    topRow.add(this.viewport);
    topRow.add(sidePanel);
    this.renderer.root.add(topRow);
    this.renderer.root.add(this.narrativeBar);
  }
}
```

### 5.2 Tile Rendering

The `TileRenderer` draws the game world into the `FrameBufferRenderable` cell by cell.

```typescript
class TileRenderer {
  private buffer: FrameBuffer;

  renderZone(zone: Zone, cameraX: number, cameraY: number, viewWidth: number, viewHeight: number): void {
    // Clear the buffer
    this.buffer.clear();

    // Render ground layer
    for (let y = 0; y < viewHeight; y++) {
      for (let x = 0; x < viewWidth; x++) {
        const worldX = x + cameraX;
        const worldY = y + cameraY;
        const tile = this.getTile(zone, worldX, worldY, "ground");
        if (tile) {
          this.buffer.setCell(x, y, {
            char: tile.char,
            fg: RGBA.fromHex(tile.fg),
            bg: tile.bg ? RGBA.fromHex(tile.bg) : undefined,
            bold: tile.bold,
          });
        }
      }
    }

    // Render object layer (on top of ground)
    this.renderLayer(zone, "objects", cameraX, cameraY, viewWidth, viewHeight);

    // Render characters
    this.renderCharacters(zone, cameraX, cameraY, viewWidth, viewHeight);

    // Render overlay (weather, particles, lighting)
    this.renderEffects(zone, cameraX, cameraY, viewWidth, viewHeight);
  }

  private renderCharacters(zone: Zone, cx: number, cy: number, w: number, h: number): void {
    for (const charId of zone.characters) {
      const character = this.characterRegistry.get(charId);
      if (!character) continue;

      const sx = character.state.position.x - cx;
      const sy = character.state.position.y - cy;

      if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
        const visual = character.visual;
        const displayChar = visual.facing?.[character.state.facing] ?? visual.display.char;
        this.buffer.setCell(sx, sy, {
          char: displayChar,
          fg: RGBA.fromHex(visual.display.fg),
          bold: visual.display.bold,
        });
      }
    }
  }
}
```

### 5.3 Half-Block Rendering Mode

For higher visual fidelity, an optional half-block rendering mode uses `▀` (upper half block) where the foreground color represents the top "pixel" and the background color represents the bottom "pixel", effectively doubling vertical resolution:

```typescript
class HalfBlockRenderer {
  // Each terminal cell represents 2 vertical pixels
  // Foreground color = top pixel, Background color = bottom pixel
  renderHighRes(
    pixelGrid: { color: string }[][],  // 2x height resolution
    buffer: FrameBuffer,
    startX: number, startY: number,
    width: number, height: number
  ): void {
    for (let cellY = 0; cellY < height; cellY++) {
      for (let cellX = 0; cellX < width; cellX++) {
        const topPixel = pixelGrid[cellY * 2]?.[cellX];
        const bottomPixel = pixelGrid[cellY * 2 + 1]?.[cellX];

        buffer.setCell(startX + cellX, startY + cellY, {
          char: "▀",
          fg: topPixel ? RGBA.fromHex(topPixel.color) : RGBA.fromValues(0, 0, 0, 0),
          bg: bottomPixel ? RGBA.fromHex(bottomPixel.color) : RGBA.fromValues(0, 0, 0, 0),
        });
      }
    }
  }
}
```

This can be used for splash screens, special visual moments, or detailed entity portraits during dialogue.

### 5.4 Animation System

Terminal animations use OpenTUI's `requestLive()` for continuous rendering when needed:

```typescript
class AnimationManager {
  private renderer: CliRenderer;
  private activeAnimations: Map<string, Animation> = new Map();
  private liveRequested: boolean = false;

  addAnimation(id: string, animation: Animation): void {
    this.activeAnimations.set(id, animation);
    if (!this.liveRequested) {
      this.renderer.requestLive();
      this.liveRequested = true;
    }
  }

  removeAnimation(id: string): void {
    this.activeAnimations.delete(id);
    if (this.activeAnimations.size === 0 && this.liveRequested) {
      this.renderer.dropLive();
      this.liveRequested = false;
    }
  }

  update(deltaTime: number): void {
    for (const [id, anim] of this.activeAnimations) {
      anim.update(deltaTime);
      if (anim.finished) {
        this.removeAnimation(id);
      }
    }
  }
}

interface Animation {
  update(deltaTime: number): void;
  finished: boolean;
}

// Example: Water shimmer animation
class WaterShimmerAnimation implements Animation {
  private timer: number = 0;
  private frameIndex: number = 0;
  finished = false;

  constructor(
    private tiles: { x: number; y: number; frames: string[] }[],
    private tileRenderer: TileRenderer,
  ) {}

  update(deltaTime: number): void {
    this.timer += deltaTime;
    if (this.timer > 500) { // 500ms per frame
      this.timer = 0;
      this.frameIndex = (this.frameIndex + 1) % this.tiles[0].frames.length;
      for (const tile of this.tiles) {
        this.tileRenderer.updateTileChar(tile.x, tile.y, tile.frames[this.frameIndex]);
      }
    }
  }
}
```

### 5.5 Pre-seeded Palette Library

Ships with the game as TypeScript modules in `@daydream/renderer/palettes/`:

```typescript
// palettes/biomes.ts
export const forestPalette: BiomePalette = {
  ground: {
    chars: ["·", ".", ",", "'", "`"],
    fg: ["#2d5a27", "#3a7a33", "#1e4a1e", "#4a8a44"],
    bg: "#1a3318",
  },
  vegetation: {
    tree_trunk: { char: "│", fg: "#5c3a1e" },
    tree_canopy: { char: "♣", fg: "#228b22", variants: ["♠", "⌂"] },
    bush: { char: "※", fg: "#3a7a33" },
    flower: { char: "✿", fg: "#ff69b4", variants: ["❀", "✾"] },
    mushroom: { char: "♦", fg: "#ff4500" },
  },
  water: {
    chars: ["~", "≈", "∼"],
    fg: ["#4a8bc7", "#5a9bd7"],
    bg: "#1a3a5a",
    animated: true,
  },
  path: {
    chars: ["░", "·"],
    fg: "#8b7355",
    bg: "#5a4a35",
  },
};

// palettes/buildings.ts
export const medievalBuilding: BuildingTemplate = {
  border: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
  door: "╤",
  window: "▪",
  roof: "▲",
  fill: " ",
  defaultFg: "#c4a882",
  doorFg: "#3d2b1f",
  roofFg: "#7a6840",
};

// palettes/characters.ts
export const characterPresets: Record<string, CharacterVisual> = {
  villager: { char: "☺", fg: "#deb887", facing: { up: "△", down: "▽", left: "◁", right: "▷" } },
  guard: { char: "♜", fg: "#c0c0c0", bold: true },
  merchant: { char: "$", fg: "#c9a959", bold: true },
  child: { char: "○", fg: "#ffb6c1" },
  animal_dog: { char: "d", fg: "#8b4513" },
  animal_cat: { char: "c", fg: "#daa520" },
  monster: { char: "M", fg: "#ff0000", bold: true },
  elder: { char: "Ω", fg: "#d4d4d4" },
};
```

---

## 6. TUI Shell & Game Engine

### 6.1 Game Shell

The `GameShell` class in `@daydream/game` is the top-level orchestrator that wires all systems together.

```typescript
class GameShell {
  private renderer: GameRenderer;         // @daydream/renderer
  private worldState: WorldState;         // @daydream/engine
  private aiClient: AIClient;             // @daydream/ai
  private dialogueManager: DialogueManager;
  private eventSystem: EventSystem;
  private saveManager: SaveManager;
  private inputRouter: InputRouter;

  async start(): Promise<void> {
    // Initialize OpenTUI renderer
    await this.renderer.init();

    // Show title screen
    const worldPrompt = await this.showTitleScreen();

    // Generate world (or load save)
    if (worldPrompt) {
      await this.generateNewWorld(worldPrompt);
    } else {
      await this.loadSavedWorld();
    }

    // Start game loop
    this.startGameLoop();
  }

  private startGameLoop(): void {
    // Register keyboard handler
    this.renderer.onKeyPress((key) => this.inputRouter.handleKey(key));

    // Start world ticker
    this.eventSystem.startTicker();

    // Start auto-save timer
    this.saveManager.startAutoSave(60_000);

    // Start renderer (enters continuous mode for animations)
    this.renderer.start();
  }
}
```

### 6.2 Input Routing

The `InputRouter` maps keyboard input to game actions based on the current game mode:

```typescript
type GameMode = "exploration" | "dialogue" | "journal" | "inventory" | "map" | "menu";

class InputRouter {
  private currentMode: GameMode = "exploration";
  private handlers: Map<GameMode, InputHandler> = new Map();

  handleKey(key: KeyEvent): void {
    const handler = this.handlers.get(this.currentMode);
    if (handler) {
      handler.handleKey(key);
    }
  }
}

// Exploration mode key bindings
class ExplorationHandler implements InputHandler {
  handleKey(key: KeyEvent): void {
    switch (key.name) {
      // Movement
      case "up": case "w": case "k":
        this.movePlayer(0, -1); break;
      case "down": case "s": case "j":
        this.movePlayer(0, 1); break;
      case "left": case "a": case "h":
        this.movePlayer(-1, 0); break;
      case "right": case "d": case "l":
        this.movePlayer(1, 0); break;

      // Interaction
      case "e": case "return":
        this.interactWithNearby(); break;

      // Overlays
      case "j":
        if (!key.shift) break;
        this.openJournal(); break;
      case "m":
        this.openMap(); break;
      case "i":
        this.openInventory(); break;

      // System
      case "escape":
        this.openMenu(); break;
    }

    // Ctrl+S = save
    if (key.ctrl && key.name === "s") {
      this.triggerSave();
    }
  }
}
```

### 6.3 Viewport Management

The viewport tracks the camera position and manages what's visible:

```typescript
class ViewportManager {
  private cameraX: number = 0;
  private cameraY: number = 0;
  private viewWidth: number;   // Set from terminal dimensions
  private viewHeight: number;

  // Follow the player, keeping them centered
  updateCamera(playerX: number, playerY: number, zoneWidth: number, zoneHeight: number): void {
    this.cameraX = Math.max(0, Math.min(
      playerX - Math.floor(this.viewWidth / 2),
      zoneWidth - this.viewWidth
    ));
    this.cameraY = Math.max(0, Math.min(
      playerY - Math.floor(this.viewHeight / 2),
      zoneHeight - this.viewHeight
    ));
  }

  // Handle terminal resize
  onResize(termWidth: number, termHeight: number): void {
    // Viewport takes most of the terminal, minus side panel and narrative bar
    this.viewWidth = termWidth - 22;  // Side panel width + borders
    this.viewHeight = termHeight - 10; // Narrative bar height + borders
  }
}
```

### 6.4 Zone Transition

When the player reaches the edge of the current zone:

1. **Check if adjacent zone is ready** (it should be, thanks to preloading)
2. **Transition animation**: Brief fade/slide effect via color dimming
3. **Update active zone**: Load new zone tiles into viewport, update characters
4. **Trigger preloading**: Start generating zones adjacent to the new active zone
5. **Unload distant zones**: Zones more than 2 away from the player are dropped from memory (but remain in SQLite)

### 6.5 Character Behavior

Characters have simple autonomous behaviors when the player isn't interacting with them:

```typescript
interface CharacterBehavior {
  type: "stationary" | "patrol" | "wander" | "follow_path" | "idle_actions";
  params: {
    patrolPoints?: Point[];
    wanderRadius?: number;
    path?: Point[];
    idleActions?: string[];     // "sit", "look_around", "sweep"
  };
  schedule?: {
    morning: CharacterBehavior;
    afternoon: CharacterBehavior;
    evening: CharacterBehavior;
    night: CharacterBehavior;
  };
}
```

These behaviors are simple state machines handled on a timer (every ~2 seconds). They don't require LLM calls — the LLM sets them up during character generation, and the engine executes them deterministically.

---

## 7. Dialogue System

### 7.1 Architecture

The dialogue system bridges the game engine, AI, and renderer.

```
InputRouter (game) → dialogue mode
    |
    v
DialogueManager
    ├── ConversationState    (tracks current conversation)
    ├── CharacterContext      (builds character-specific context)
    ├── OptionGenerator       (generates player choices)
    └── ConsequenceEvaluator  (post-conversation analysis)
         |
         v
    AIClient (LLM calls)
         |
         v
    DialoguePanel (renderer) → narrative bar
```

### 7.2 Conversation State

```typescript
interface ConversationState {
  characterId: string;
  turns: ConversationTurn[];
  startedAt: number;
  mood: string;                // Current mood of the conversation
  topicsDiscussed: string[];   // For avoiding repetition
  isActive: boolean;
}

interface ConversationTurn {
  speaker: "player" | "character";
  text: string;
  type: "dialogue" | "action" | "narration";
  timestamp: number;
}
```

### 7.3 Dialogue Generation Flow

```typescript
class DialogueManager {
  async generateResponse(
    conversation: ConversationState,
    playerInput: { text: string; type: "dialogue" | "action" | "freeform" }
  ): Promise<DialogueResponse> {

    // Build context
    const character = this.characterRegistry.get(conversation.characterId);
    const context = this.contextManager.getContextFor("dialogue");

    // Add character-specific context
    const characterContext = {
      identity: character.identity,
      personality: character.personality,
      memory: character.getRelevantMemories(conversation),
      currentGoals: character.goals,
      relationships: character.relationships,
      currentMood: character.mood,
    };

    // Generate response + options (streamed)
    const response = await this.aiClient.generate({
      system: DIALOGUE_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: this.buildDialoguePrompt(context, characterContext, conversation, playerInput) }
      ],
      tools: [dialogueResponseTool],
      temperature: 0.8,
    });

    return parseDialogueResponse(response);
  }
}

interface DialogueResponse {
  characterSpeech: string;
  characterEmotion: string;       // For display character/color change
  options: DialogueOption[];
  narration?: string;             // Optional scene description
  conversationEnded?: boolean;    // Character walks away, etc.
  immediateEffects?: Effect[];    // Things that happen right now
}

interface DialogueOption {
  text: string;
  type: "dialogue" | "action";
  tone: string;
  preview?: string;   // Short hint about what this might lead to
}
```

### 7.4 Dialogue UI Rendering

The dialogue interface renders in the narrative bar using OpenTUI components:

```typescript
class DialoguePanel {
  private scrollBox: ScrollBoxRenderable;
  private optionsList: BoxRenderable;
  private inputField: InputRenderable;

  showCharacterSpeech(speech: string, emotion: string): void {
    // Stream text into the scroll box with typewriter effect
    // Character name in bold + color, then speech text
  }

  showOptions(options: DialogueOption[]): void {
    // Render numbered options as selectable text
    // [1] "What incident? Tell me more."
    // [2] "I'm just passing through."
    // [3] [Place a gold coin on the counter]
    // [>] Type your own...
  }

  showFreeformInput(): void {
    // Switch to InputRenderable for freeform typing
    this.inputField.focus();
  }
}
```

### 7.5 Post-Conversation Evaluation

After a conversation ends:

```typescript
class ConsequenceEvaluator {
  async evaluate(conversation: ConversationState): Promise<ConversationConsequences> {
    const context = this.contextManager.getContextFor("event");

    const result = await this.aiClient.generate({
      system: CONSEQUENCE_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: this.buildConsequencePrompt(context, conversation) }
      ],
      tools: [consequenceTool],
      temperature: 0.6,
    });

    return parseConsequences(result);
  }
}

interface ConversationConsequences {
  characterStateChanges: {
    characterId: string;
    moodChange?: string;
    relationshipChange?: { target: string; delta: number };
    newGoal?: string;
    memoryAdded: string;
  }[];
  deferredEvents: {
    description: string;
    triggerCondition: string;
    effects: Effect[];
  }[];
  immediateEvents: Effect[];
  chronicleEntry: string;
  narrativeThreads: string[];
}
```

---

## 8. Event System

### 8.1 Event Queue

```typescript
class EventSystem {
  private immediateQueue: GameEvent[];    // Process this tick
  private deferredQueue: DeferredEvent[]; // Process when conditions met
  private tickTimer: number;              // World tick countdown
  private tickInterval: number = 300_000; // 5 minutes in ms

  update(delta: number): void {
    // Process immediate events
    while (this.immediateQueue.length > 0) {
      this.processEvent(this.immediateQueue.shift()!);
    }

    // Check deferred events
    for (const event of [...this.deferredQueue]) {
      if (this.checkCondition(event.triggerCondition)) {
        this.processEvent(event);
        this.deferredQueue.splice(this.deferredQueue.indexOf(event), 1);
      }
    }

    // World tick
    this.tickTimer -= delta;
    if (this.tickTimer <= 0) {
      this.triggerWorldTick();
      this.tickTimer = this.tickInterval;
    }
  }
}
```

### 8.2 Event Types & Effects

```typescript
interface GameEvent {
  id: string;
  type: "ambient" | "minor" | "moderate" | "major" | "dramatic";
  description: string;
  effects: Effect[];
  chronicleEntry: string;
}

type Effect =
  | { type: "character_move"; characterId: string; targetZone: string; targetPos: Point }
  | { type: "character_spawn"; zone: string; characterDef: CharacterDef }
  | { type: "character_remove"; characterId: string; reason: string }
  | { type: "character_state"; characterId: string; changes: Partial<CharacterState> }
  | { type: "weather_change"; weather: string; duration: number }
  | { type: "lighting_change"; lighting: string; transition: number }
  | { type: "object_spawn"; zone: string; objectDef: WorldObjectDef }
  | { type: "object_remove"; zone: string; objectId: string }
  | { type: "narration"; text: string }
  | { type: "zone_modify"; zone: string; changes: ZoneChanges };
```

### 8.3 World Ticker

The world ticker is the heartbeat of the living world.

```typescript
class WorldTicker {
  async tick(): Promise<GameEvent[]> {
    const context = this.contextManager.getContextFor("world_tick");

    const worldState = {
      currentZone: this.zoneManager.activeZone,
      nearbyCharacters: this.characterRegistry.getInRange(this.player.position, 2),
      timeOfDay: this.worldClock.getTimeOfDay(),
      weather: this.weatherSystem.current,
      recentPlayerActions: this.chronicle.getRecentPlayerActions(10),
      activeNarrativeThreads: this.chronicle.getActiveThreads(),
    };

    const result = await this.aiClient.generate({
      system: WORLD_TICK_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: this.buildTickPrompt(context, worldState) }
      ],
      tools: [worldTickTool],
      temperature: 0.7,
    });

    return parseWorldTickEvents(result);
  }
}
```

### 8.4 World Clock

```typescript
class WorldClock {
  private gameMinutesPerRealSecond: number = 2; // 1 real minute = 2 game hours
  private currentTime: number = 0; // Minutes since world creation

  getTimeOfDay(): "dawn" | "morning" | "afternoon" | "dusk" | "evening" | "night" {
    const hour = Math.floor((this.currentTime % 1440) / 60);
    if (hour >= 5 && hour < 7) return "dawn";
    if (hour >= 7 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 19) return "dusk";
    if (hour >= 19 && hour < 22) return "evening";
    return "night";
  }

  getDayNumber(): number {
    return Math.floor(this.currentTime / 1440) + 1;
  }
}
```

This affects the color palette of the viewport (warm at dawn/dusk, cool at night), character schedules, and the types of events the AI generates.

---

## 9. Chronicle & Memory

### 9.1 Chronicle Store

```typescript
class Chronicle {
  private entries: ChronicleEntry[] = [];
  private recentSummary: string = "";
  private historicalSummary: string = "";
  private narrativeThreads: NarrativeThread[] = [];

  append(entry: ChronicleEntry): void {
    this.entries.push(entry);
    this.updateNarrativeThreads(entry);
  }

  getContextWindow(budget: number): string {
    let context = "";
    context += `## World History\n${this.historicalSummary}\n\n`;
    context += `## Recent Events\n${this.recentSummary}\n\n`;

    const recentEntries = this.entries.slice(-50);
    for (const entry of recentEntries.reverse()) {
      const entryText = this.formatEntry(entry);
      if (context.length + entryText.length > budget) break;
      context = `${entryText}\n${context}`;
    }

    context += `## Active Threads\n`;
    for (const thread of this.narrativeThreads.filter(t => t.active)) {
      context += `- ${thread.summary}\n`;
    }

    return context;
  }

  async compress(aiClient: AIClient): Promise<void> {
    const oldEntries = this.entries.filter(e =>
      Date.now() - e.timestamp > 30 * 60 * 1000
    );

    if (oldEntries.length === 0) return;

    const summary = await aiClient.generate({
      system: COMPRESSION_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Summarize these events into the ongoing world narrative:\n\n${
          oldEntries.map(e => this.formatEntry(e)).join('\n')
        }\n\nExisting recent summary:\n${this.recentSummary}`
      }],
      maxTokens: 1000,
    });

    this.recentSummary = summary.text;
    this.entries = this.entries.filter(e =>
      Date.now() - e.timestamp <= 30 * 60 * 1000
    );
  }
}

interface ChronicleEntry {
  id: string;
  timestamp: number;
  gameTime: number;
  type: "conversation" | "event" | "player_action" | "world_change" | "narration";
  zone: string;
  summary: string;
  details?: string;
  characters?: string[];
  narrativeThreads?: string[];
}

interface NarrativeThread {
  id: string;
  summary: string;
  active: boolean;
  entries: string[];
  tension: number;       // 0-10
}
```

### 9.2 Character Memory

```typescript
class CharacterMemory {
  private characterId: string;
  private personalExperiences: MemoryEntry[] = [];
  private heardRumors: MemoryEntry[] = [];
  private playerRelationship: {
    trust: number;
    familiarity: number;
    lastInteraction?: string;
    impressions: string[];
  };

  getRelevantMemories(topic?: string): string {
    // Return formatted memories within a token budget
    // Prioritize: recent interactions > strong emotions > old memories
  }

  addConversationMemory(summary: string, playerImpression: string): void {
    this.personalExperiences.push({
      type: "conversation",
      summary,
      timestamp: Date.now(),
      emotional_weight: this.calculateEmotionalWeight(summary),
    });
    this.playerRelationship.impressions.push(playerImpression);
    this.playerRelationship.lastInteraction = summary;
  }
}
```

---

## 10. Persistence Layer

### 10.1 SQLite Schema (via bun:sqlite)

```typescript
import { Database } from "bun:sqlite";

function initDatabase(path: string): Database {
  const db = new Database(path);

  // Enable WAL mode for better concurrent read/write performance
  db.run("PRAGMA journal_mode = WAL");

  db.run(`
    CREATE TABLE IF NOT EXISTS worlds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      seed_prompt TEXT NOT NULL,
      world_config TEXT NOT NULL,        -- JSON: biome map, world rules, etc.
      chronicle_summary TEXT NOT NULL,   -- JSON: compressed chronicle
      created_at INTEGER NOT NULL,       -- Unix timestamp
      updated_at INTEGER NOT NULL,
      play_time_seconds INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS zones (
      id TEXT NOT NULL,                  -- "zone_0_0"
      world_id TEXT NOT NULL REFERENCES worlds(id),
      coords_x INTEGER NOT NULL,
      coords_y INTEGER NOT NULL,
      tile_data TEXT NOT NULL,           -- JSON: compressed tile arrays
      metadata TEXT NOT NULL,            -- JSON: name, description, narrative role
      PRIMARY KEY (world_id, id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id),
      name TEXT NOT NULL,
      identity TEXT NOT NULL,            -- JSON: personality, backstory, visual
      state TEXT NOT NULL,               -- JSON: position, mood, goals
      memory TEXT NOT NULL,              -- JSON: conversation history, impressions
      visual TEXT NOT NULL               -- JSON: display char, colors, facing
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chronicle_entries (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id),
      game_time INTEGER NOT NULL,
      type TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT,                      -- JSON
      characters TEXT,                   -- JSON array of character IDs
      created_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS player_state (
      world_id TEXT PRIMARY KEY REFERENCES worlds(id),
      position TEXT NOT NULL,            -- JSON: zone + coordinates
      inventory TEXT DEFAULT '[]',       -- JSON array
      relationships TEXT DEFAULT '{}',   -- JSON object
      journal TEXT DEFAULT '{}'          -- JSON object
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_cache (
      key TEXT PRIMARY KEY,              -- Hash of prompt + params
      response TEXT NOT NULL,            -- JSON: cached AI response
      created_at INTEGER NOT NULL,
      expires_at INTEGER                 -- Optional TTL
    )
  `);

  // Indexes for common queries
  db.run("CREATE INDEX IF NOT EXISTS idx_zones_world ON zones(world_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_characters_world ON characters(world_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_characters_zone ON characters(world_id, json_extract(state, '$.currentZone'))");
  db.run("CREATE INDEX IF NOT EXISTS idx_chronicle_world ON chronicle_entries(world_id, created_at)");

  return db;
}
```

### 10.2 Save/Load Operations

```typescript
class SaveManager {
  private db: Database;
  private savePath: string;            // ~/.daydream/worlds/<world-id>.db
  private autoSaveTimer?: Timer;
  private dirty: boolean = false;

  constructor(worldId: string) {
    const dir = `${Bun.env.HOME}/.daydream/worlds`;
    // Ensure directory exists
    this.savePath = `${dir}/${worldId}.db`;
    this.db = initDatabase(this.savePath);
  }

  saveWorld(worldState: WorldState): void {
    const tx = this.db.transaction(() => {
      // Upsert world
      this.db.run(
        `INSERT OR REPLACE INTO worlds (id, name, seed_prompt, world_config, chronicle_summary, created_at, updated_at, play_time_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [worldState.worldId, worldState.worldSeed.setting.name, worldState.worldSeed.originalPrompt,
         JSON.stringify(worldState.worldSeed), JSON.stringify(worldState.chronicle.getSummaries()),
         worldState.createdAt, Date.now(), worldState.playTime]
      );

      // Upsert zones
      const zoneStmt = this.db.prepare(
        `INSERT OR REPLACE INTO zones (id, world_id, coords_x, coords_y, tile_data, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const zone of worldState.dirtyZones()) {
        zoneStmt.run(zone.id, worldState.worldId, zone.coords.x, zone.coords.y,
          JSON.stringify(zone.tiles), JSON.stringify(zone.metadata));
      }

      // Upsert characters
      const charStmt = this.db.prepare(
        `INSERT OR REPLACE INTO characters (id, world_id, name, identity, state, memory, visual)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const char of worldState.dirtyCharacters()) {
        charStmt.run(char.id, worldState.worldId, char.identity.name,
          JSON.stringify(char.identity), JSON.stringify(char.state),
          JSON.stringify(char.memory), JSON.stringify(char.visual));
      }

      // Append new chronicle entries
      const entryStmt = this.db.prepare(
        `INSERT OR IGNORE INTO chronicle_entries (id, world_id, game_time, type, summary, details, characters, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const entry of worldState.chronicle.getUnsavedEntries()) {
        entryStmt.run(entry.id, worldState.worldId, entry.gameTime, entry.type,
          entry.summary, entry.details ? JSON.stringify(entry.details) : null,
          entry.characters ? JSON.stringify(entry.characters) : null, entry.timestamp);
      }

      // Upsert player state
      this.db.run(
        `INSERT OR REPLACE INTO player_state (world_id, position, inventory, relationships, journal)
         VALUES (?, ?, ?, ?, ?)`,
        [worldState.worldId, JSON.stringify(worldState.player.position),
         JSON.stringify(worldState.player.inventory), JSON.stringify(worldState.player.relationships),
         JSON.stringify(worldState.player.journal)]
      );
    });

    tx();
    this.dirty = false;
  }

  loadWorld(worldId: string): WorldState {
    const world = this.db.query("SELECT * FROM worlds WHERE id = ?").get(worldId);
    const zones = this.db.query("SELECT * FROM zones WHERE world_id = ?").all(worldId);
    const characters = this.db.query("SELECT * FROM characters WHERE world_id = ?").all(worldId);
    const chronicle = this.db.query("SELECT * FROM chronicle_entries WHERE world_id = ? ORDER BY created_at").all(worldId);
    const playerState = this.db.query("SELECT * FROM player_state WHERE world_id = ?").get(worldId);

    return WorldState.fromSaveData(world, zones, characters, chronicle, playerState);
  }

  startAutoSave(intervalMs: number): void {
    this.autoSaveTimer = setInterval(() => {
      if (this.dirty) {
        this.saveWorld(this.worldState);
      }
    }, intervalMs);
  }

  listWorlds(): WorldSummary[] {
    // Scan ~/.daydream/worlds/ for .db files
    // Open each briefly to read the worlds table
    // Return summaries for the world list screen
  }
}
```

### 10.3 Supabase Schema (Cloud Persistence - Phase 2)

```sql
-- Users and auth handled by Supabase Auth

create table worlds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  name text not null,
  seed_prompt text not null,
  world_config jsonb not null,
  chronicle_summary jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  play_time_seconds integer default 0,
  is_shared boolean default false
);

create table zones (
  id text not null,
  world_id uuid references worlds(id) not null,
  coords point not null,
  tile_data jsonb not null,
  metadata jsonb not null,
  primary key (world_id, id)
);

create table characters (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) not null,
  name text not null,
  identity jsonb not null,
  state jsonb not null,
  memory jsonb not null,
  visual jsonb not null
);

create table chronicle_entries (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references worlds(id) not null,
  game_time integer not null,
  type text not null,
  summary text not null,
  details jsonb,
  characters text[],
  created_at timestamptz default now()
);

create table player_state (
  world_id uuid primary key references worlds(id),
  position jsonb not null,
  inventory jsonb default '[]',
  relationships jsonb default '{}',
  journal jsonb default '{}'
);

-- RLS policies
alter table worlds enable row level security;
create policy "Users can CRUD their own worlds" on worlds
  for all using (auth.uid() = user_id);
-- Similar RLS for other tables, scoped through world ownership
```

---

## 11. State Management

### 11.1 World State Store

Central state that all systems read from and write to.

```typescript
class WorldState {
  readonly worldId: string;
  readonly worldSeed: WorldSeed;
  readonly createdAt: number;

  // Mutable state
  zones: Map<string, Zone>;
  characters: Map<string, Character>;
  player: PlayerState;
  chronicle: Chronicle;
  worldClock: WorldClock;
  weather: WeatherState;

  // Active state
  activeZoneId: string;
  activeConversation: ConversationState | null;
  eventQueue: GameEvent[];
  playTime: number;

  // Dirty tracking for efficient saves
  private dirtyZoneIds: Set<string> = new Set();
  private dirtyCharacterIds: Set<string> = new Set();

  // Derived state
  get activeZone(): Zone { return this.zones.get(this.activeZoneId)!; }
  get nearbyCharacters(): Character[] { /* ... */ }

  // State mutations
  applyEffect(effect: Effect): void {
    switch (effect.type) {
      case "character_move":
        this.moveCharacter(effect.characterId, effect.targetZone, effect.targetPos);
        break;
      case "character_spawn":
        this.spawnCharacter(effect.zone, effect.characterDef);
        break;
      // ... etc
    }
    this.markDirty();
  }

  dirtyZones(): Zone[] {
    return [...this.dirtyZoneIds].map(id => this.zones.get(id)!).filter(Boolean);
  }

  dirtyCharacters(): Character[] {
    return [...this.dirtyCharacterIds].map(id => this.characters.get(id)!).filter(Boolean);
  }
}
```

### 11.2 Event Bus

Cross-system communication via a typed event bus.

```typescript
class EventBus {
  private listeners: Map<string, Set<Function>> = new Map();

  on<T extends keyof GameEvents>(event: T, handler: (data: GameEvents[T]) => void): void;
  off<T extends keyof GameEvents>(event: T, handler: Function): void;
  emit<T extends keyof GameEvents>(event: T, data: GameEvents[T]): void;
}

interface GameEvents {
  "zone:entered": { zoneId: string };
  "zone:generated": { zone: Zone };
  "character:interact": { characterId: string };
  "dialogue:started": { characterId: string };
  "dialogue:ended": { characterId: string; conversation: ConversationState };
  "event:triggered": { event: GameEvent };
  "chronicle:entry": { entry: ChronicleEntry };
  "world:tick": { events: GameEvent[] };
  "save:started": {};
  "save:completed": {};
  "player:moved": { position: Point; zone: string };
  "mode:changed": { from: GameMode; to: GameMode };
}
```

---

## 12. API & Networking

### 12.1 Claude API Integration

```typescript
import Anthropic from "@anthropic-ai/sdk";

class ClaudeClient implements AIClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(params: GenerateParams): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: params.model || "claude-sonnet-4-5-20250929",
      max_tokens: params.maxTokens || 2048,
      temperature: params.temperature || 0.7,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
    });

    return this.parseResponse(response);
  }

  async *stream(params: GenerateParams): AsyncGenerator<string> {
    const stream = this.client.messages.stream({
      model: params.model || "claude-sonnet-4-5-20250929",
      max_tokens: params.maxTokens || 2048,
      temperature: params.temperature || 0.7,
      system: params.system,
      messages: params.messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }
}
```

### 12.2 API Key Strategy

**MVP**: User provides their own Claude API key. Read from environment variable (`ANTHROPIC_API_KEY`) or a config file (`~/.daydream/config.json`). On first launch, prompt the user for their key.

**Production**: A thin backend proxy that:
- Holds the API key
- Authenticates users via Supabase Auth
- Rate-limits per user
- Handles caching of common prompts

---

## 13. Data Models

### 13.1 World Seed

```typescript
interface WorldSeed {
  originalPrompt: string;

  setting: {
    name: string;
    type: string;
    era: string;
    tone: string;
    description: string;
  };

  biomeMap: {
    center: BiomeConfig;
    distribution: BiomeDistribution;
  };

  initialNarrative: {
    hooks: string[];
    mainTension: string;
    atmosphere: string;
  };

  worldRules: {
    hasMagic: boolean;
    techLevel: string;
    economy: string;
    dangers: string[];
    customs: string[];
  };
}
```

### 13.2 Character

```typescript
interface Character {
  id: string;
  worldId: string;

  identity: {
    name: string;
    age: string;
    role: string;
    personality: string[];
    backstory: string;
    speechPattern: string;
    secrets: string[];
  };

  visual: CharacterVisual;

  state: {
    currentZone: string;
    position: Point;
    facing: "up" | "down" | "left" | "right";
    mood: string;
    currentActivity: string;
    health: string;
    goals: string[];
  };

  behavior: CharacterBehavior;
  memory: CharacterMemory;

  relationships: Map<string, {
    type: string;
    trust: number;
    familiarity: number;
    history: string;
  }>;
}

interface CharacterVisual {
  display: {
    char: string;
    fg: string;
    bg?: string;
    bold?: boolean;
  };
  facing?: Record<string, string>;  // Direction → display character
  idleAnimation?: string[];          // Alternating chars for idle
  nameplate: string;
}
```

### 13.3 Player State

```typescript
interface PlayerState {
  position: { zone: string; x: number; y: number };
  facing: "up" | "down" | "left" | "right";
  inventory: InventoryItem[];
  journal: {
    entries: JournalEntry[];
    knownCharacters: string[];
    discoveredZones: string[];
    activeQuests: string[];
  };
  stats: {
    totalPlayTime: number;
    conversationsHad: number;
    zonesExplored: number;
    daysSurvived: number;
  };
}
```

---

## 14. Generation Prompts

### 14.1 World Creation System Prompt

```
You are the world engine for a living terminal game. The player has described
where they want to go, and you must create a coherent, interesting world from
their description.

You will generate a complete world seed that establishes the setting, tone,
biomes, narrative hooks, and world rules. This seed will be used to generate
every zone, character, and event in the world, so it must be rich enough to
sustain hours of exploration and narrative.

Guidelines:
- The world should feel lived-in and have history
- Include 3-5 narrative hooks (mysteries, conflicts, opportunities) that can
  develop over time
- Define a main tension that gives the world a sense of urgency or purpose
- World rules should be internally consistent
- The tone should match the player's prompt (dark prompt = dark world, etc.)
- Include specific cultural details that make the world unique
```

### 14.2 Zone Generation Prompt Template

```
Generate a new zone for the world. This zone is at coordinates ({x}, {y}).

World: {world_seed.setting.description}
Biome at this location: {biome_config}
Adjacent zones: {adjacent_zone_descriptions}
Active narrative threads: {narrative_threads}
Recent events: {recent_chronicle}

Generate the zone layout including:
1. A name and brief description
2. Terrain layout (ground types and placement)
3. Buildings (if appropriate for the biome density) - described as footprint,
   style, and features
4. Nature objects (trees, rocks, water features) - described by type and
   placement
5. Characters present (0-3, with full identity and visual definitions)
6. Any narrative hooks or interesting details
7. How this zone connects to the narrative

The zone should feel natural and consistent with adjacent zones. If a character
in a nearby zone mentioned a location, it might be here. If a narrative thread
is building, this zone might advance it.

The zone will be rendered in a terminal using Unicode characters and colors.
Keep building footprints reasonable (3-8 cells wide, 2-5 cells tall).
Characters are single cells with a display character and color.
```

### 14.3 Dialogue System Prompt

```
You are voicing a character in a living world. Stay in character at all times.

Character: {character.identity}
Current mood: {character.state.mood}
Relationship with player: {character.relationships.player}
Recent memories: {character.memory.getRelevantMemories()}

World context: {chronicle_context}

Respond as this character would, given their personality, mood, and what they
know. Generate 3-4 response options for the player that:
- Offer different approaches (friendly, confrontational, curious, etc.)
- Include at least one action option (not just dialogue)
- Feel natural and contextually appropriate
- Sometimes include surprising or creative options

If the player says something unexpected or tries to do something unusual,
roll with it. The world is flexible. Characters can be surprised, confused,
amused, or alarmed by unexpected player behavior.
```

---

## 15. Performance Budget

| Metric | Target | Strategy |
|--------|--------|----------|
| **Initial world load** | < 10s | Show loading animation while generating |
| **Zone transition** | < 500ms | Preload adjacent zones; cache in SQLite |
| **Dialogue response** | < 2s first token | Stream responses; show typing indicator |
| **Response options** | < 1s | Use Haiku; cache common patterns |
| **World tick** | Non-blocking | Run in background; apply events smoothly |
| **Tile rendering** | < 16ms per frame | Direct FrameBuffer writes; only update changed cells |
| **Auto-save** | < 50ms perceived | SQLite WAL mode; incremental saves; transaction batching |
| **Memory (Bun heap)** | < 100MB | Unload distant zones; keep only active zone + neighbors in memory |
| **Save file size** | < 50MB per world | JSON compression in SQLite; only persist explored zones |

### Perceived Latency Tricks

- **Dialogue**: Show `...` typing indicator while waiting. Stream text character-by-character (typewriter effect) which is expected in terminal games.
- **Zone generation**: Fog of war / dim cells at unexplored edges. Generate during walk animation.
- **World tick**: Apply changes gradually (character walks to new position over several frames, weather shifts smoothly via color interpolation).
- **Loading**: ASCII art loading animations with progress messages.

---

## 16. MVP Implementation Order

The build order is designed so each step produces something runnable/testable.

### Step 1: Project Scaffolding
- Bun workspace monorepo setup (root package.json, bunfig.toml, tsconfig.base.json)
- Package scaffolding for engine, ai, renderer, game
- OpenTUI hello-world in apps/game
- **Milestone**: `bun run start` shows a styled terminal with "Daydream" title

### Step 2: Static World Renderer
- Tile renderer using FrameBufferRenderable
- Load a hardcoded zone (tile data defined in code) and render it
- Biome palette system with one forest palette
- Player character (`@`) with WASD/hjkl/arrow movement + collision
- Viewport following player
- **Milestone**: Walk around a static Unicode art map in the terminal

### Step 3: TUI Layout
- Multi-panel layout (viewport + side panel + narrative bar)
- Responsive resize handling
- Context panel showing location name, time, nearby NPCs
- Narrative bar with scrollable text
- **Milestone**: Full game chrome with panels, player walking in viewport

### Step 4: Character Rendering & Interaction
- Character display (glyphs + colors) from preset library
- Place characters in zones with facing direction
- Interaction trigger (walk adjacent + press `e`)
- Character nameplate on hover/proximity
- **Milestone**: See characters in the world, interaction trigger works

### Step 5: AI Dialogue
- Claude API integration (@daydream/ai package)
- Dialogue panel UI in narrative bar
- Basic dialogue flow (character speaks → options → response)
- Streamed text display (typewriter effect)
- Freeform text input option
- **Milestone**: Have a real conversation with a character

### Step 6: AI World Generation
- World creation from prompt (generate world seed)
- Zone generation from seed (AI generates zone specs)
- Zone builder (convert AI spec → tile data using palettes)
- Character generation (AI creates character identities + visuals)
- Title screen with prompt input
- **Milestone**: Type a prompt, get a generated world, walk around it

### Step 7: Chronicle & Memory
- Chronicle store with logging
- Character memory (remembers conversations)
- Context manager (build AI context from chronicle)
- Chronicle compression
- **Milestone**: Characters remember what you said. World has history.

### Step 8: Event System
- Event queue and processing
- Post-conversation evaluation
- World ticker (5-minute cycle)
- Visual event rendering (characters move, weather/lighting changes)
- **Milestone**: The world changes around you. Conversations have consequences.

### Step 9: Persistence
- SQLite save/load (bun:sqlite)
- Auto-save every 60 seconds
- Save/load screen (list worlds, create new, continue)
- Save directory management (~/.daydream/worlds/)
- **Milestone**: Exit and come back. Everything is preserved.

### Step 10: Polish
- Multi-zone world with lazy generation + preloading
- Zone transitions
- Mini-map
- Ambient animations (water shimmer, torch flicker)
- Time-of-day color palette shifts
- Loading animations
- **Milestone**: Feature-complete MVP

---

## Appendix A: Token Usage Estimates

Rough estimates per hour of gameplay:

| Call Type | Frequency | Tokens per Call (in/out) | Hourly Total |
|-----------|-----------|--------------------------|-------------|
| Zone generation | ~10 zones/hr | 3000 / 2000 | 50,000 |
| Dialogue (character) | ~30 turns/hr | 2000 / 500 | 75,000 |
| Response options | ~15 sets/hr | 1000 / 300 | 19,500 |
| Post-conversation | ~8/hr | 2000 / 500 | 20,000 |
| World tick | ~12/hr | 2000 / 800 | 33,600 |
| Chronicle compression | ~2/hr | 3000 / 1000 | 8,000 |
| **Total** | | | **~206,000** |

At Sonnet pricing (~$3/M input, $15/M output), that's roughly **$0.60-1.20/hour** of gameplay. Opus calls (world creation) would be more but are one-time. Haiku calls (response options, compression) would be cheaper.

Cost optimizations:
- Cache zone generation results aggressively (SQLite ai_cache table)
- Use Haiku for simple tasks (response options, compression)
- Batch small requests where possible
- Pre-compute zones the player is likely to visit

## Appendix B: Terminal Compatibility

### Supported Terminals

OpenTUI's Zig rendering engine targets modern terminals with 24-bit color and Unicode support:

| Terminal | Platform | Status |
|----------|----------|--------|
| **iTerm2** | macOS | Full support |
| **Kitty** | macOS/Linux | Full support |
| **WezTerm** | Cross-platform | Full support |
| **Ghostty** | macOS/Linux | Full support |
| **Windows Terminal** | Windows | Full support |
| **Alacritty** | Cross-platform | Full support (no ligatures) |
| **Terminal.app** | macOS | Limited (256 colors, partial Unicode) |
| **GNOME Terminal** | Linux | Full support |

### Minimum Requirements

- 24-bit (truecolor) support for full visual experience
- Unicode support for box-drawing characters and tile glyphs
- Minimum 80x24 terminal size (recommended: 120x40+)
- Mouse support (optional but enhances UX)

### Graceful Degradation

- On 256-color terminals: map 24-bit colors to nearest 256-color equivalents
- On limited Unicode terminals: fall back to ASCII-only tile set (`.`, `#`, `@`, `*`)
- On small terminals: hide side panel, reduce viewport, collapse narrative bar
