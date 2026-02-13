# 20260212200616 - ZoneBuilder Sprite Placement

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 20:06:16 EST |
| **Last Modified**  | 2026-02-12 20:20:33 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | pure-maple |
| **Blocked-By**     | 20260212200610, 20260212200612 |
| **Feature**        | advanced-sprites |
| **Touches**        | packages/engine/src/world/ZoneBuilder.ts, packages/engine/src/world/ZoneBuilder.test.ts, packages/engine/src/index.ts |
| **References**     | [Advanced Sprite System DD](../../docs/design-docs/20260212195744-advanced-sprite-system.md) |

## Description

Update ZoneBuilder to place multi-cell sprites instead of single-cell object tiles. Objects, buildings, and NPCs now resolve to sprite template IDs and are placed as SpriteInstance entries with proper multi-cell collision footprints.

## Acceptance Criteria

- [x] `ZoneBuildResult` includes `sprites: SpriteInstance[]` field
- [x] `placeObject()` resolves object types to sprite template IDs via mapping table
- [x] Sprite collision footprints are checked before placement (all collision tiles must be available)
- [x] Sprite collision tiles are marked as blocked in the collision layer
- [x] `placeBuilding()` uses building sprite templates instead of box-drawing characters
- [x] NPC positions generate SpriteInstance entries for the NPC sprites
- [x] Backward compatibility: if no sprite template found for an object, fall back to single-cell placement
- [x] SpriteRegistry is injected into ZoneBuilder (constructor parameter or build method parameter)
- [x] TypeScript compiles cleanly
- [x] Existing ZoneBuilder tests updated and passing

## Implementation Steps

- [x] Define `SpriteLookup` interface in ZoneBuilder.ts
- [x] Add optional `spriteLookup` parameter to `build()` method
- [x] Add `sprites: SpriteInstance[]` accumulator to `build()`
- [x] Update `placeObject()` to try sprite resolution first, fall back to single-cell
- [x] Update `placeBuilding()` to try sprite resolution first, fall back to box-drawing
- [x] Add NPC sprite placement (create SpriteInstance entries for NPCs)
- [x] Add NPC support to `ZoneBuildSpec` interface
- [x] Include collected sprites in `ZoneBuildResult`
- [x] Export `SpriteLookup` from engine index.ts
- [x] Update existing tests to pass with new signatures
- [x] Add new tests for sprite placement paths
- [x] Run typecheck and tests

## Progress Log

### 2026-02-12 20:06:16 EST
Initial creation. Extracted from Advanced Sprite System design doc (Section 8). Depends on sprite types (20260212200610) and engine types (20260212200612).

### 2026-02-12 20:17:22 EST
Starting work on branch `main`. Agent: pure-maple. Both dependencies completed (sprite types in renderer, SpriteInstance in engine types). No in-progress task overlaps on Touches. Plan: define SpriteLookup interface, add optional spriteLookup to build(), update placeObject/placeBuilding, add NPC sprite placement, update tests.

### 2026-02-12 20:20:33 EST
Task complete. All acceptance criteria met. Changes:
- Added `SpriteLookup` and `SpriteLookupResult` interfaces in ZoneBuilder.ts (engine-side, no renderer dependency)
- Added optional `npcs` field to `ZoneBuildSpec` for NPC role/position/tint
- Updated `build()` to accept optional `spriteLookup` parameter and collect `SpriteInstance[]`
- Updated `placeObject()`: tries sprite resolution first (with normalized type fallback), falls back to single-cell
- Updated `placeBuilding()`: tries sprite resolution first, falls back to box-drawing characters
- Added `placeNpc()`: creates SpriteInstance with optional tint when lookup resolves
- Added `canPlaceSprite()` / `markSpriteCollision()` helpers for collision footprint validation
- `sprites` array always included in result (empty when no lookup provided)
- Exported `SpriteLookup` and `SpriteLookupResult` from engine index.ts
- TypeScript compiles cleanly (no new errors; pre-existing test file errors only)
- All 217 engine tests pass (14 original ZoneBuilder + 19 new sprite tests = 33 total ZoneBuilder tests)

### 2026-02-12 21:04:28 EST
Branch merged to main.
