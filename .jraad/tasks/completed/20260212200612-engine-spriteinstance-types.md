# 20260212200612 - Engine SpriteInstance Types

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 20:06:12 EST |
| **Last Modified**  | 2026-02-12 20:12:57 EST |
| **Status**         | completed |
| **Branch**         | main |
| **Agent**          | bright-cobra |
| **Blocked-By**     | none |
| **Feature**        | advanced-sprites |
| **Touches**        | packages/engine/src/types.ts, packages/engine/src/world/ZoneBuilder.ts, packages/engine/src/index.ts |
| **References**     | [Advanced Sprite System DD](../../docs/design-docs/20260212195744-advanced-sprite-system.md) |

## Description

Add Zod schemas for SpriteInstance to the engine types and update ZoneData-related schemas to include a sprites array. This enables zones to store placed sprite instances alongside existing tile layers.

## Acceptance Criteria

- [x] `SpriteInstanceSchema` Zod schema: templateId (string), position (Point), optional tint (string)
- [x] `SpriteInstance` type derived via `z.infer<>`
- [x] `ZoneSchema` updated with optional `sprites: z.array(SpriteInstanceSchema)` field
- [x] `ZoneBuildResult` in ZoneBuilder types updated to include optional `sprites: SpriteInstance[]`
- [x] Existing zone serialization/deserialization is backward-compatible (sprites field is optional)
- [x] TypeScript compiles cleanly (`bun run typecheck`)
- [x] Existing tests still pass (`bun run test`)

## Implementation Steps

- [x] Add `SpriteInstanceSchema` Zod schema to `packages/engine/src/types.ts` (near Zone section)
- [x] Add `SpriteInstance` type derived via `z.infer<>`
- [x] Add optional `sprites` field to `ZoneSchema`
- [x] Add optional `sprites` field to `ZoneBuildResult` in `packages/engine/src/world/ZoneBuilder.ts`
- [x] Export `SpriteInstance` type and `SpriteInstanceSchema` from `packages/engine/src/index.ts`
- [x] Run `bun run typecheck` to verify compilation
- [x] Run `bun run test` to verify no regressions

## Progress Log

### 2026-02-12 20:06:12 EST
Initial creation. Extracted from Advanced Sprite System design doc (Section 8.1). No dependencies — can run in parallel with other Wave 1 tasks.

### 2026-02-12 20:11:26 EST
Starting work on branch `main`. No in-progress tasks touch `packages/engine/src/types.ts` or `packages/engine/src/world/ZoneBuilder.ts`. Plan: add SpriteInstanceSchema near the Zone section in types.ts, add optional sprites field to ZoneSchema, then update ZoneBuildResult interface in ZoneBuilder.ts.

### 2026-02-12 20:12:57 EST
Completed. All changes implemented:
- Added `SpriteInstanceSchema` Zod schema and `SpriteInstance` type to `types.ts` (placed just before `ZoneSchema` in the Zone section)
- Added optional `sprites: z.array(SpriteInstanceSchema)` field to `ZoneSchema`
- Added optional `sprites?: SpriteInstance[]` field to `ZoneBuildResult` interface in `ZoneBuilder.ts` (with import of `SpriteInstance`)
- Exported both `SpriteInstance` type and `SpriteInstanceSchema` from `index.ts`
- TypeScript compiles cleanly (no new errors in modified files; pre-existing errors in unrelated test files)
- All 198 engine tests pass, 0 failures
- Backward-compatible: sprites field is optional in both ZoneSchema and ZoneBuildResult
