# 20260212195909 - AI Multi-Zone Generation Prompts

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 19:59:09 EST |
| **Last Modified**  | 2026-02-12 20:29:53 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | bright-gecko |
| **Blocked-By**     | 20260212195902 |
| **Feature**        | multi-zone-world |
| **Touches**        | packages/ai/src/prompts/zone-generation.ts, packages/ai/src/tools/zone-tools.ts |
| **References**     | [Multi-Zone Design Doc](../../docs/design-docs/20260212143327-multi-zone-world.md) |

## Description

Update zone generation prompts to include adjacent zone context for coherent world building. Add adjacent zone hints (name, description, biome, edge features) to the generation prompt. Update the system prompt to instruct AI about terrain continuity at edges. Add exits field guidance to the zone tool schema. See design doc §10.1.

## Acceptance Criteria

- [x] buildZoneGenerationPrompt() accepts and includes adjacent zone hints
- [x] Adjacent zone description format matches design doc §10.1 (direction, name, biome, edge features)
- [x] Zone generation system prompt instructs AI about terrain continuity at shared boundaries
- [x] Zone tool schema updated with exits field guidance (hint what's in each direction)
- [x] Works with existing ZoneSpec output format (backward compatible)

## Implementation Steps

- [x] Add `AdjacentZonePromptHint` type and direction label mappings to zone-generation.ts
- [x] Add terrain continuity instructions to `ZONE_GENERATION_SYSTEM_PROMPT`
- [x] Add `adjacentZoneHints` optional parameter to `buildZoneGenerationPrompt()`
- [x] Implement `formatAdjacentHints()` matching design doc §10.1 format
- [x] Update exits field descriptions in zone tool schema with richer guidance
- [x] Export new types/functions from package index
- [x] Run typecheck and tests

## Progress Log

### 2026-02-12 19:59:09 EST
Initial creation. Extracted from multi-zone design doc implementation plan (Task 5). Blocked by GameShell integration (20260212195902) — needs multi-zone context types. Can run in parallel with edge coherence (20260212195906) and location history (20260212195913).

### 2026-02-12 20:29:30 EST
Starting work on branch `main`. No file overlaps with other in-progress tasks. Reviewed dependency context: 20260212195902 (GameShell integration) is completed, ZoneManager and AdjacentZoneHint types are available from engine. WorldGenerator.ts in apps/game already uses `buildAdjacentDescription()` to format hints as strings — our new `formatAdjacentHints()` provides a structured alternative that matches §10.1 exactly. The existing `adjacentZones: string` param is preserved for backward compat.

### 2026-02-12 20:29:53 EST
Task completed. All acceptance criteria met. Summary of changes:

1. **zone-generation.ts**: Added `AdjacentZonePromptHint` type, direction label mappings (`up`->`NORTH`, etc.), `formatAdjacentHints()` function matching design doc §10.1 format. Added optional `adjacentZoneHints` param to `buildZoneGenerationPrompt()` — falls back to raw `adjacentZones` string when not provided (backward compat). System prompt now includes terrain continuity instructions covering roads, rivers, biome transitions, and matching edge features. User prompt now includes item 8 asking for exits.

2. **zone-tools.ts**: Updated `exits` field descriptions with richer guidance — each direction's `.describe()` now includes examples of what to describe (terrain, features, roads, rivers). The top-level `.describe()` explains that exits are used for coherent adjacent zone generation and should include boundary-reaching features.

3. **index.ts**: Exported `formatAdjacentHints` function and `AdjacentZonePromptHint` type.

All 44 existing tests pass. No new typecheck errors introduced (pre-existing errors in unrelated test files only). ZoneSpec output format unchanged — fully backward compatible.

### 2026-02-12 21:04:28 EST
Branch merged to main.
