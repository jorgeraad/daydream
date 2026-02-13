# 20260212200615 - Built-In Sprite Library

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 20:06:15 EST |
| **Last Modified**  | 2026-02-12 20:20:04 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | mild-lynx |
| **Blocked-By**     | 20260212200610 |
| **Feature**        | advanced-sprites |
| **Touches**        | packages/renderer/src/sprites/library/trees.ts, packages/renderer/src/sprites/library/buildings.ts, packages/renderer/src/sprites/library/npcs.ts, packages/renderer/src/sprites/library/objects.ts, packages/renderer/src/sprites/library/index.ts |
| **References**     | [Advanced Sprite System DD](../../docs/design-docs/20260212195744-advanced-sprite-system.md) |

## Description

Create ~30 pixel-art sprite templates for the built-in library covering trees, buildings, NPCs, objects, and decorations. Each template is a SpriteTemplate with pixel data, anchor point, collision footprint, and tags. Also define the mapping tables from AI object/NPC type strings to template IDs.

## Acceptance Criteria

- [x] **Trees** (~5): pine, oak, dead tree, bush, large bush — varying sizes, biome-appropriate colors
- [x] **Buildings** (~5): house, shop, tavern, well, wall — with roof, window, and door detail
- [x] **NPCs** (~6): villager, guard, merchant, child, elder, innkeeper — recognizable silhouettes with color personality
- [x] **Objects** (~8): rock_large, rock_small, chest, sign, barrel, flowers, torch, fence
- [x] **Decorations** (~4): grass_tuft, mushroom, puddle, fallen_log
- [x] **Player** (1): player_default — distinct blue tunic, visible against all biomes
- [x] `OBJECT_TYPE_TO_SPRITE` mapping table covering all common AI object type strings
- [x] `NPC_ROLE_TO_SPRITE` mapping table for character roles
- [x] All templates have correct anchor points (bottom-center convention for most)
- [x] All templates have appropriate collision footprints
- [x] All templates exported from `library/index.ts` barrel
- [x] TypeScript compiles cleanly

## Implementation Steps

- [x] Create `packages/renderer/src/sprites/library/` directory
- [x] Create `trees.ts` with 5 tree/bush sprites
- [x] Create `buildings.ts` with 5 building sprites
- [x] Create `npcs.ts` with 6 NPC sprites + player_default
- [x] Create `objects.ts` with 8 object sprites + 4 decorations
- [x] Create `library/index.ts` with barrel exports, ALL_SPRITES, and mapping tables
- [x] Update `packages/renderer/src/sprites/index.ts` to re-export library
- [x] Run `bun run typecheck` — verify clean compilation

## Progress Log

### 2026-02-12 20:06:15 EST
Initial creation. Extracted from Advanced Sprite System design doc (Section 6). This is the most content-heavy task — ~30 pixel art templates. Depends on sprite types (20260212200610).

### 2026-02-12 20:16:34 EST
Starting work on branch `main`. Agent: mild-lynx. No overlapping in-progress tasks on Touches paths. Dependency 20260212200610 defines SpriteTemplate type at packages/renderer/src/sprites/types.ts — reviewed and ready to use.

### 2026-02-12 20:20:04 EST
Completed. Created 29 sprite templates across 4 files:
- **trees.ts**: 5 sprites (pine, oak, dead_tree, bush, large_bush)
- **buildings.ts**: 5 sprites (house, shop, tavern, well, wall)
- **npcs.ts**: 7 sprites (player_default + villager, guard, merchant, child, elder, innkeeper)
- **objects.ts**: 12 sprites (8 objects: rock_large, rock_small, chest, sign, barrel, flowers, torch, fence + 4 decorations: grass_tuft, mushroom, puddle, fallen_log)
- **library/index.ts**: barrel exports, ALL_SPRITES (29 entries), SPRITE_BY_ID map, OBJECT_TYPE_TO_SPRITE (79 entries), NPC_ROLE_TO_SPRITE (42 entries)
- Updated `sprites/index.ts` to re-export all library contents
All pixel arrays validated (correct dimensions), all anchors within bounds, all mapping table values resolve to valid sprite IDs. TypeScript compiles cleanly (no new errors).

### 2026-02-12 21:04:28 EST
Branch merged to main.
