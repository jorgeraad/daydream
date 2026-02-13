# 20260212145509 - AI Music Generation

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:09 EST |
| **Last Modified**  | 2026-02-13 17:45:15 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | fast-otter |
| **Blocked-By**     | 20260212145507 |
| **Feature**        | audio |
| **Touches**        | packages/ai/src/tools/, packages/ai/src/types.ts, packages/engine/src/types.ts, apps/game/src/WorldGenerator.ts |
| **References**     | [Music & Sound Effects DD](../../docs/design-docs/20260212143111-music-sound-effects.md) |

## Description

Integrate AI music generation into the existing AI pipeline. Add a `music-generation` task type using haiku for fast/cheap structured output. Create the `generate_music` tool schema (Zod-derived via `createToolDef`), write the music generation prompt template that takes zone context (biome, mood, time of day), add an optional `musicSpec` field to the `Zone` schema in engine types, wire the parallel AI call into `WorldGenerator` during zone generation, and update persistence to save/load MusicSpec with zones.

## Acceptance Criteria

- [x] `music-generation` task type added to AI types
- [x] `generate_music` tool schema created via `createToolDef` using `MusicSpecSchema`
- [x] Music generation prompt template includes zone context (name, biome, mood, time, weather)
- [x] Optional `musicSpec` field added to `Zone` schema in engine types
- [x] `WorldGenerator` calls music generation in parallel with zone generation
- [x] MusicSpec validated with `.safeParse()` (no unsafe `as` casts)
- [x] Persistence saves/loads MusicSpec with zone data
- [x] Unit tests for tool schema validation
- [x] Unit tests for prompt template generation

## Implementation Steps

- [x] Add `@daydream/audio` dependency to `packages/ai/package.json`
- [x] Add `music-generation` task type and model mapping to `packages/ai/src/types.ts`
- [x] Create `packages/ai/src/tools/music-tools.ts` with `generate_music` tool schema
- [x] Create `packages/ai/src/prompts/music-generation.ts` with prompt template
- [x] Add optional `musicSpec` field to `ZoneSchema` in `packages/engine/src/types.ts`
- [x] Export new music tools and prompts from `packages/ai/src/index.ts`
- [x] Wire music generation into `WorldGenerator.ts` (parallel call)
- [x] Add unit tests for music tool schema validation
- [x] Add unit tests for prompt template generation
- [x] Run typecheck and tests

## Progress Log

### 2026-02-12 14:55:09 EST
Initial creation. Phase 4 of the Music & Sound Effects design doc. Depends on Chiptune Synthesis (20260212145507) for MusicSpec schema.

### 2026-02-12 21:36:25 EST
Starting work on branch `main`. Blocker 20260212145507 (chiptune synthesis) is in `merged/`. Read all relevant source: AI types, tools, prompts, WorldGenerator, MusicSpecSchema from `@daydream/audio`. No file overlaps with in-progress tasks.

### 2026-02-12 22:24:32 EST
Implementation complete. All acceptance criteria met.

Summary of changes:
- `packages/ai/src/types.ts`: Added `music-generation` to `TaskType` union and mapped it to `haiku` model in `TASK_MODEL_MAP`.
- `packages/ai/src/tools/music-tools.ts`: Created `generateMusicTool` via `createToolDef` using `MusicSpecSchema` from `@daydream/audio`. Added `parseMusicResponse` for safe validation.
- `packages/ai/src/prompts/music-generation.ts`: System prompt with detailed chiptune composition guidance. `buildMusicGenerationPrompt` takes zone context (name, biome, mood, optional timeOfDay, optional weather).
- `packages/engine/src/types.ts`: Added optional `musicSpec: z.unknown().optional()` to `ZoneSchema`. Used `z.unknown()` to keep engine decoupled from audio package.
- `apps/game/src/WorldGenerator.ts`: Wired `generateMusicSpec()` to run in parallel with zone generation via `Promise.all()` in `generate()`, `generateZoneAt()`, and `generatePortalZone()`. Uses `MusicSpecSchema.safeParse()` for validation. Failures are non-blocking (returns undefined, logs warning).
- `packages/ai/package.json`: Added `@daydream/audio` workspace dependency.
- `apps/game/package.json`: Added `@daydream/audio` workspace dependency.
- Persistence: `musicSpec` is automatically saved/loaded via the existing `serializeZone` / `deserializeZone` functions (JSON.stringify spread includes it).
- Updated existing tests in `WorldGenerator.test.ts` and `e2e-smoke.test.ts` to handle the new 3rd AI call (music generation).
- New test files: `music-tools.test.ts` (18 tests) and `music-generation-prompt.test.ts` (10 tests).

All tests pass: 72/72 AI, 79/79 game, 242/242 engine. No type errors in modified files (pre-existing errors in unrelated test files remain).
