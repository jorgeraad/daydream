# 20260212114210 - Tile Renderer & Palettes

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 11:42:20 EST |
| **Last Modified**  | 2026-02-12 11:42:20 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212114207 |
| **Touches**        | packages/renderer/src/TileRenderer.ts, packages/renderer/src/ViewportManager.ts, packages/renderer/src/palettes/biomes.ts, packages/renderer/src/palettes/buildings.ts, packages/renderer/src/palettes/objects.ts, packages/renderer/src/types.ts, packages/renderer/src/index.ts, apps/game/src/index.ts |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Build the tile rendering system using OpenTUI's FrameBufferRenderable. Render a hardcoded zone cell-by-cell with a forest biome palette. Add player character (`@`) with WASD/hjkl/arrow movement, collision detection, and viewport camera following. Define biome palettes, building templates, and object glyphs as the pre-seeded tile library.

## Acceptance Criteria

- [ ] TileRenderer renders zone tile data into a FrameBuffer cell-by-cell
- [ ] Ground, object, and overlay layers rendered in correct order
- [ ] Forest biome palette implemented (ground, trees, water, paths, flowers)
- [ ] Desert biome palette implemented
- [ ] Town/village biome palette implemented
- [ ] Building template library (~5 templates: house, shop, tavern, well, wall)
- [ ] Object glyph library (~15 glyphs: trees, rocks, furniture, signs, items)
- [ ] Hardcoded test zone with terrain variety loads and renders
- [ ] Player character (`@`) renders with color and bold
- [ ] WASD, hjkl, and arrow key movement works
- [ ] Collision layer prevents walking through walls/objects/water
- [ ] ViewportManager follows player, keeping them centered
- [ ] Viewport clamps to zone boundaries
- [ ] Unit tests for ViewportManager (camera centering, boundary clamping)
- [ ] Unit tests for collision detection
- [ ] Visual smoke test: `bun run start` shows walkable tile map

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 11:42:20 EST
Initial creation. Extracted from design doc Sections 3.2 (Tile System), 5 (Terminal Rendering System), 5.5 (Palette Library), and Section 16 Step 2.
