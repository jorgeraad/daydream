# 20260212114208 - Engine Core Types & Data Models

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 11:42:20 EST |
| **Last Modified**  | 2026-02-12 11:42:20 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212114207 |
| **Touches**        | packages/engine/src/types.ts, packages/engine/src/world/Zone.ts, packages/engine/src/world/WorldState.ts, packages/engine/src/world/BiomeSystem.ts, packages/engine/src/character/Character.ts, packages/engine/src/chronicle/Chronicle.ts, packages/engine/src/event/EventSystem.ts, packages/engine/src/index.ts |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Define all core TypeScript types, interfaces, and data models for the game engine. This is pure type-level work with minimal logic — Zone, TileLayer, TileCell, Character, CharacterVisual, WorldSeed, BiomeConfig, Chronicle entries, Event types, PlayerState, etc. These types are the shared contract that all other packages build against.

## Acceptance Criteria

- [ ] Zone interface (id, coords, biome, tiles, characters, buildings, objects, exits, metadata)
- [ ] TileLayer and TileCell interfaces (char, fg, bg, bold, animated, collision)
- [ ] WorldSeed interface (originalPrompt, setting, biomeMap, initialNarrative, worldRules)
- [ ] BiomeConfig and BiomePalette interfaces
- [ ] Character interface (identity, visual, state, behavior, memory, relationships)
- [ ] CharacterVisual interface (display, facing, idle animation, nameplate)
- [ ] PlayerState interface (position, facing, inventory, journal, stats)
- [ ] ChronicleEntry and NarrativeThread interfaces
- [ ] GameEvent and Effect union types
- [ ] WorldState class with zone/character maps, dirty tracking, and applyEffect()
- [ ] EventBus with typed game events
- [ ] All types exported from @daydream/engine index
- [ ] Unit tests for WorldState mutations (applyEffect, dirty tracking)
- [ ] Unit tests for EventBus (subscribe, emit, unsubscribe)
- [ ] `bun run typecheck` passes

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 11:42:20 EST
Initial creation. Extracted from design doc Sections 3 (World Model), 8.2 (Event Types), 11 (State Management), and 13 (Data Models). Split out from renderer task to enable parallel work.
