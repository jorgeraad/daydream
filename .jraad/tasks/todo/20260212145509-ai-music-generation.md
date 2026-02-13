# 20260212145509 - AI Music Generation

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:09 EST |
| **Last Modified**  | 2026-02-12 14:55:09 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212145507 |
| **Feature**        | audio |
| **Touches**        | packages/ai/src/tools/, packages/ai/src/types.ts, packages/engine/src/types.ts, apps/game/src/WorldGenerator.ts |
| **References**     | [Music & Sound Effects DD](../../docs/design-docs/20260212143111-music-sound-effects.md) |

## Description

Integrate AI music generation into the existing AI pipeline. Add a `music-generation` task type using haiku for fast/cheap structured output. Create the `generate_music` tool schema (Zod-derived via `createToolDef`), write the music generation prompt template that takes zone context (biome, mood, time of day), add an optional `musicSpec` field to the `Zone` schema in engine types, wire the parallel AI call into `WorldGenerator` during zone generation, and update persistence to save/load MusicSpec with zones.

## Acceptance Criteria

- [ ] `music-generation` task type added to AI types
- [ ] `generate_music` tool schema created via `createToolDef` using `MusicSpecSchema`
- [ ] Music generation prompt template includes zone context (name, biome, mood, time, weather)
- [ ] Optional `musicSpec` field added to `Zone` schema in engine types
- [ ] `WorldGenerator` calls music generation in parallel with zone generation
- [ ] MusicSpec validated with `.safeParse()` (no unsafe `as` casts)
- [ ] Persistence saves/loads MusicSpec with zone data
- [ ] Unit tests for tool schema validation
- [ ] Unit tests for prompt template generation

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 14:55:09 EST
Initial creation. Phase 4 of the Music & Sound Effects design doc. Depends on Chiptune Synthesis (20260212145507) for MusicSpec schema.
