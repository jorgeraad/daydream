# 20260212114214 - AI World Generation

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 11:42:20 EST |
| **Last Modified**  | 2026-02-12 11:42:20 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212114208, 20260212114209, 20260212114210 |
| **Touches**        | packages/engine/src/world/ZoneBuilder.ts, packages/renderer/src/ui/LoadingScreen.ts, apps/game/src/ |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Implement AI-powered world generation: title screen with prompt input, Claude generates a world seed (setting, biome, narrative hooks, world rules), then generates the starting zone with characters. The ZoneBuilder converts AI zone specs into tile data using biome palettes. Replace the hardcoded test zone with a fully AI-generated world.

## Acceptance Criteria

- [ ] Title screen with "Where would you like to go?" text input
- [ ] World creation sends player prompt to Claude (Opus model) and parses WorldSeed
- [ ] Zone generation sends seed + context to Claude and parses zone spec
- [ ] ZoneBuilder converts AI zone specs → tile data using biome palettes
- [ ] Character generation creates 3-5 characters with identities, visuals, and placement
- [ ] Loading screen with animation displays during generation
- [ ] Generated world is playable (walk around, see terrain, interact with characters)
- [ ] Biome palette selection based on AI-generated biome type
- [ ] Unit tests for ZoneBuilder (zone spec → tile data conversion)
- [ ] Unit tests for WorldSeed parsing and validation
- [ ] Integration test with mocked AI responses for full world generation pipeline
- [ ] Visual smoke test: type a prompt, get a generated world

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 11:42:20 EST
Initial creation. Extracted from design doc Sections 3.3 (Zone Generation Pipeline), 3.4 (Biome System), 14 (Generation Prompts), and Section 16 Step 6. Can run in parallel with AI Dialogue (20260212114213).
