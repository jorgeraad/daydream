# 20260212122007 - Convert Engine Core Types to Zod Schemas

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 12:20:07 EST |
| **Last Modified**  | 2026-02-12 12:29:15 EST |
| **Status**         | completed |
| **Branch**         | main |
| **Agent**          | neat-heron |
| **Blocked-By**     | 20260212114208 |
| **Touches**        | packages/engine/src/types.ts, packages/engine/src/schemas.test.ts, packages/engine/src/index.ts, package.json, packages/engine/package.json |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Convert all hand-written TypeScript interfaces in `packages/engine/src/types.ts` to Zod schemas, making schemas the single source of truth for both runtime validation and TypeScript types (via `z.infer<>`). This establishes the foundation for runtime validation across the entire codebase — especially critical for AI response parsing and future persistence (save/load). Install `zod` in the workspace catalog so all packages can use it.

## Acceptance Criteria

- [x] `zod` added to the Bun workspace catalog and available to all packages
- [x] All types in `packages/engine/src/types.ts` converted to Zod schemas with TypeScript types inferred via `z.infer<>`
- [x] Exported type names remain identical (no breaking changes to consumers)
- [x] Zod schemas are exported alongside types (e.g., `export const ZoneSchema = z.object({...})` and `export type Zone = z.infer<typeof ZoneSchema>`)
- [x] All existing engine tests pass without modification (or with minimal import updates)
- [x] `bun run typecheck` passes clean across the entire monorepo
- [x] New tests validate that schemas correctly accept valid data and reject invalid data for key types (WorldSeed, Zone, Character, Effect)

## Implementation Steps

- [x] Add `zod` to workspace catalog in root `package.json` and `bun install`
- [x] Convert primitive types (Point, Direction, CharacterId, ZoneId) to Zod schemas
- [x] Convert tile system types (TileCell, TileLayer, TileLayerName) to Zod schemas
- [x] Convert zone system types (ZoneExit, Building, WorldObject, ZoneMetadata, Zone) to Zod schemas
- [x] Convert biome system types (BiomePalette*, BiomeConfig, BiomeDistribution) to Zod schemas
- [x] Convert WorldSeed to Zod schema
- [x] Convert character system types (CharacterIdentity, CharacterVisual, CharacterState, CharacterBehavior, Character, etc.) to Zod schemas
- [x] Convert player system types (InventoryItem, JournalEntry, PlayerState) to Zod schemas
- [x] Convert chronicle system types (ChronicleEntry, NarrativeThread) to Zod schemas
- [x] Convert event/effect system types (GameEvent, Effect discriminated union) to Zod schemas
- [x] Convert conversation and environmental types to Zod schemas
- [x] Update index.ts exports to include schemas
- [x] Verify all existing tests pass
- [x] Write new validation tests for key schemas (WorldSeed, Zone, Character, Effect)
- [x] Run `bun run typecheck` across monorepo

## Progress Log

### 2026-02-12 12:20:07 EST
Initial creation. User identified that the codebase has 67+ hand-written TypeScript interfaces with zero runtime validation. Zod schemas will become the single source of truth for types, enabling runtime validation especially for AI responses and future persistence.

### 2026-02-12 12:25:02 EST
Starting implementation on branch `main`. Dependency context: Engine Core Types (20260212114208) merged — 50+ types in `packages/engine/src/types.ts` covering Zone, TileLayer, Character, WorldSeed, Effect (10-variant discriminated union), etc. Key challenges: Effect discriminated union needs `z.discriminatedUnion()`, Character.relationships uses `Map<string, CharacterRelationship>`. Sibling tasks (Character Rendering, AI World Gen, Chronicle, Persistence) will consume these schemas. Downstream task 20260212122011 will use schemas for AI response validation.

### 2026-02-12 12:29:15 EST
Implementation complete. All 50+ types converted to Zod schemas. Key patterns used: `z.discriminatedUnion()` for 10-variant Effect type, `z.lazy()` for recursive CharacterBehavior.schedule, `z.map()` for Character.relationships, `.omit()` for CharacterDef.state, `.partial()` for ZoneChanges.metadata and character_state changes. Added zod to workspace catalog and @daydream/engine deps. Updated index.ts to export all schemas. All 26 existing tests pass unchanged. 30 new validation tests pass covering WorldSeed, Zone, Character, CharacterBehavior (recursive), Effect (all discriminated variants), BiomeConfig, and PlayerState. Typecheck clean.
