# 20260212114212 - Character Rendering & Interaction

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 11:42:20 EST |
| **Last Modified**  | 2026-02-12 13:00:31 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | calm-falcon |
| **Blocked-By**     | 20260212114208, 20260212114210 |
| **Touches**        | packages/renderer/src/CharacterRenderer.ts, packages/renderer/src/palettes/characters.ts, apps/game/src/InputRouter.ts |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Add characters to the world with visual rendering from a preset library (glyphs, colors, facing direction). Place hardcoded test characters in the test zone. Implement proximity detection (nameplate display) and the interaction trigger: walk adjacent to a character and press `e`/Enter to enter dialogue mode. Build the InputRouter for mode switching.

## Acceptance Criteria

- [x] Character preset library with ~10 presets (villager, guard, merchant, child, elder, animal, etc.)
- [x] CharacterRenderer renders characters in the viewport with correct glyph, color, and facing
- [x] Hardcoded test characters placed in the test zone (3-5 characters)
- [x] Characters have collision (player can't walk through them)
- [x] Proximity detection shows character nameplate in context panel or above character
- [x] Pressing `e`/Enter when adjacent to a character fires interaction event
- [x] InputRouter manages game modes (exploration, dialogue, menu) with mode switching
- [x] Exploration mode handles movement + interaction keys
- [x] Unit tests for CharacterRenderer (glyph selection, facing)
- [x] Unit tests for proximity detection
- [x] Unit tests for InputRouter mode switching
- [x] Visual smoke test: characters visible in world, interaction trigger works

## Implementation Steps

- [x] Create character presets palette (`packages/renderer/src/palettes/characters.ts`) with ~10 presets
- [x] Build CharacterRenderer class (`packages/renderer/src/CharacterRenderer.ts`) with glyph rendering, facing, nameplates
- [x] Add proximity detection helper (find characters adjacent to player)
- [x] Build InputRouter (`apps/game/src/InputRouter.ts`) with mode-based input handling
- [x] Update game entry point — add test characters, wire CharacterRenderer + InputRouter, character collision
- [x] Export new modules from package indexes
- [x] Write unit tests for CharacterRenderer, proximity detection, InputRouter
- [x] Visual smoke test

## Progress Log

### 2026-02-12 11:42:20 EST
Initial creation. Extracted from design doc Sections 5.5 (Palette Library), 6.2 (Input Routing), 13.2 (Character model), and Section 16 Step 4. Can run in parallel with TUI Layout (20260212114211).

### 2026-02-12 12:47:33 EST
Starting implementation on branch `main`. Ancestors: engine core types (20260212114208) defined Character/CharacterVisual/CharacterDisplay Zod schemas; tile renderer (20260212114210) built TileRenderer with layer-based rendering into FrameBuffer, ViewportManager with worldToScreen coords, isCollision() on collision layer. No Touches overlap with in-progress tasks. Approach: character presets → CharacterRenderer → proximity detection → InputRouter → wire into game.

### 2026-02-12 12:52:59 EST
Task completed. All 12 acceptance criteria met. Created 4 new files: `packages/renderer/src/palettes/characters.ts` (10 character presets), `packages/renderer/src/CharacterRenderer.ts` (CharacterRenderer class + proximity helpers), `apps/game/src/InputRouter.ts` (mode-based input routing with EventBus integration), test files for both. Updated `packages/renderer/src/index.ts` (exports) and `apps/game/src/index.ts` (5 test characters, character collision, InputRouter wiring). All 75 tests pass (21 new). Typecheck clean.

### 2026-02-12 13:00:31 EST
Branch merged to the main branch.
