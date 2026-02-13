# 20260212195855 - ZoneConfig & ZoneManager Core

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 19:58:55 EST |
| **Last Modified**  | 2026-02-12 20:11:31 EST |
| **Status**         | completed |
| **Branch**         | main |
| **Agent**          | slim-jackal |
| **Blocked-By**     | none |
| **Feature**        | multi-zone-world |
| **Touches**        | packages/engine/src/world/ZoneManager.ts, packages/engine/src/world/zone-config.ts, packages/engine/src/index.ts |
| **References**     | [Multi-Zone Design Doc](../../docs/design-docs/20260212143327-multi-zone-world.md) |

## Description

Implement ZoneConfig with sensible defaults and the ZoneManager class in `@daydream/engine`. ZoneManager orchestrates zone lifecycle (load, generate, activate, unload) without depending on AI or rendering. Generation and persistence are injected via `ZoneGeneratorFn` and `ZoneStore` callbacks. See design doc §5.3, §6, §7, §8 for full specifications.

## Acceptance Criteria

- [x] ZoneConfig interface + DEFAULT_ZONE_CONFIG exported from `zone-config.ts`
- [x] ZoneManager class with getZone, getActiveZone, activateZone, ensureZone, preloadAdjacent, unloadDistant, isReady, isGenerating
- [x] ZoneStore and ZoneGeneratorFn callback interfaces exported
- [x] ZoneGenerationContext interface with worldSeed, biome, adjacentHints, edgeSignatures, chronicle
- [x] AdjacentZoneHint interface exported
- [x] ensureZone() deduplicates: in-memory cache → in-flight Promise → SQLite via ZoneStore → generate via ZoneGeneratorFn
- [x] preloadAdjacent() uses priority ordering based on movement direction (forward first, sides, then behind)
- [x] unloadDistant() removes zones beyond keepRadius using Manhattan distance, calling saveIfDirty before removal
- [x] Unit tests for lifecycle states, deduplication, unload policy, preload ordering
- [x] All types and classes exported from engine package index

## Implementation Steps

- [x] Create `packages/engine/src/world/zone-config.ts` with ZoneConfig interface and DEFAULT_ZONE_CONFIG
- [x] Create `packages/engine/src/world/ZoneManager.ts` with:
  - [x] ZoneStore interface
  - [x] ZoneGeneratorFn type
  - [x] ZoneGenerationContext interface
  - [x] AdjacentZoneHint interface
  - [x] EdgeSignature and EdgeTile interfaces (needed by ZoneGenerationContext)
  - [x] ZoneManagerOptions interface
  - [x] preloadOrder() helper function
  - [x] ZoneManager class with all methods
- [x] Export all types and classes from `packages/engine/src/index.ts`
- [x] Write unit tests in `packages/engine/src/world/ZoneManager.test.ts`
- [x] Run tests and typecheck

## Progress Log

### 2026-02-12 19:58:55 EST
Initial creation. Extracted from multi-zone design doc implementation plan (Task 1). Foundation component — no dependencies. TransitionManager (20260212195859) can be built in parallel.

### 2026-02-12 20:06:47 EST
Starting work on branch `main`. Agent: slim-jackal. Read existing types.ts, Zone.ts, index.ts, WorldState.test.ts, and multi-zone design doc. Ready to implement zone-config.ts and ZoneManager.ts. Tests will be colocated as per existing pattern (WorldState.test.ts).

### 2026-02-12 20:11:31 EST
Implementation complete. All 34 tests pass, no typecheck errors in new files. Key design decision: refactored ensureZone deduplication to wrap the entire load-or-generate pipeline (store load + generation) in a single inflight Promise, not just the generation step. This prevents concurrent ensureZone calls from both hitting the store and then both trying to generate. The inflight map tracks the full pipeline.

Files created:
- `packages/engine/src/world/zone-config.ts` — ZoneConfig interface + DEFAULT_ZONE_CONFIG
- `packages/engine/src/world/ZoneManager.ts` — ZoneManager class + all callback/context interfaces
- `packages/engine/src/world/ZoneManager.test.ts` — 34 unit tests

Files modified:
- `packages/engine/src/index.ts` — added exports for all new types and classes
