# 20260212114212 - Character Rendering & Interaction

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 11:42:20 EST |
| **Last Modified**  | 2026-02-12 11:42:20 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212114208, 20260212114210 |
| **Touches**        | packages/renderer/src/CharacterRenderer.ts, packages/renderer/src/palettes/characters.ts, apps/game/src/InputRouter.ts |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Add characters to the world with visual rendering from a preset library (glyphs, colors, facing direction). Place hardcoded test characters in the test zone. Implement proximity detection (nameplate display) and the interaction trigger: walk adjacent to a character and press `e`/Enter to enter dialogue mode. Build the InputRouter for mode switching.

## Acceptance Criteria

- [ ] Character preset library with ~10 presets (villager, guard, merchant, child, elder, animal, etc.)
- [ ] CharacterRenderer renders characters in the viewport with correct glyph, color, and facing
- [ ] Hardcoded test characters placed in the test zone (3-5 characters)
- [ ] Characters have collision (player can't walk through them)
- [ ] Proximity detection shows character nameplate in context panel or above character
- [ ] Pressing `e`/Enter when adjacent to a character fires interaction event
- [ ] InputRouter manages game modes (exploration, dialogue, menu) with mode switching
- [ ] Exploration mode handles movement + interaction keys
- [ ] Unit tests for CharacterRenderer (glyph selection, facing)
- [ ] Unit tests for proximity detection
- [ ] Unit tests for InputRouter mode switching
- [ ] Visual smoke test: characters visible in world, interaction trigger works

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 11:42:20 EST
Initial creation. Extracted from design doc Sections 5.5 (Palette Library), 6.2 (Input Routing), 13.2 (Character model), and Section 16 Step 4. Can run in parallel with TUI Layout (20260212114211).
