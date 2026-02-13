# 20260212195917 - New Location Prompt (Portal)

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 19:59:17 EST |
| **Last Modified**  | 2026-02-12 21:18:24 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | clear-eagle |
| **Blocked-By**     | 20260212195913 |
| **Feature**        | multi-zone-world |
| **Touches**        | apps/game/src/PortalPrompt.ts, apps/game/src/InputRouter.ts, apps/game/src/index.ts, apps/game/src/WorldGenerator.ts, packages/engine/src/types.ts, apps/game/src/__tests__/InputRouter.test.ts |
| **References**     | [Multi-Zone Design Doc](../../docs/design-docs/20260212143327-multi-zone-world.md) |

## Description

Add the ability to bring up the world generation prompt from within gameplay to describe and travel to a brand new location. Pressing P (portal) in exploration mode opens a text input overlay. The player describes the new location, and the system generates a new zone at an unoccupied coordinate using WorldGenerator with the portal prompt combined with the existing WorldSeed for consistency. The new zone inherits the world's setting/rules but uses the player's description as its local flavor. Current game state is auto-saved before generation begins.

## Acceptance Criteria

- [x] P key in exploration mode opens portal prompt overlay
- [x] Text input for describing the new location (reuses GameInput component)
- [x] Generation uses existing WorldSeed for world consistency (same setting, rules, tone)
- [x] Player's description becomes the zone's local narrative/description
- [x] New zone placed at next available coordinate (not overlapping existing zones)
- [x] Fade transition to new zone after generation completes
- [x] Loading indicator shown during generation
- [x] Current game state auto-saved before portal generation begins
- [x] Esc cancels the prompt without generating
- [x] New zone appears in location history (discoveredZones) after visiting

## Implementation Steps

- [x] Add "portal" to GameMode Zod enum in engine types
- [x] Create PortalPrompt component (apps/game/src/PortalPrompt.ts) with GameInput overlay
- [x] Add P key binding in InputRouter exploration handler
- [x] Add portalHandler to InputRouter (like dialogueHandler/mapHandler)
- [x] Wire PortalPrompt into startGameplay in index.ts
- [x] Add portal mode handling to eventBus mode:changed listener
- [x] Implement portal generation: find unoccupied coordinates, generate zone via WorldGenerator.generatePortalZone
- [x] Add fade transition to new zone after generation
- [x] Auto-save WorldState before generation begins
- [x] Add new zone to discoveredZones after visiting
- [x] Write unit tests for InputRouter P key binding (4 tests)
- [x] Run typecheck and tests — all pass (79 game, 242 engine, 185 renderer, 44 AI)

## Progress Log

### 2026-02-12 19:59:17 EST
Initial creation. User-requested feature for re-invoking the world prompt to travel to new locations. Blocked by location history (20260212195913) due to Touches overlap on GameShell.ts. Sequenced last in the multi-zone feature.

### 2026-02-12 21:12:47 EST
Starting work on branch `main`. Agent: clear-eagle. Read all dependency context (GameShell, InputRouter, WorldGenerator, LocationBrowser, ZoneManager, TransitionManager, GameInput, index.ts). Plan: add "portal" to GameMode enum, create PortalPrompt overlay component, wire P key in InputRouter, integrate portal flow in index.ts startGameplay.

### 2026-02-12 21:18:24 EST
Implementation complete. Created PortalPrompt overlay component with GameInput, title, and loading state. Added "portal" to GameMode enum. Wired P key in InputRouter with portalHandler pattern. Added generatePortalZone method to WorldGenerator that injects the player's description into the AI prompt while preserving world setting/rules. Integrated full portal flow in index.ts: auto-save, coordinate selection (spiral search), AI generation with progress updates, fade transition, discovered zone tracking. All tests pass (550+ across 4 packages). No pre-existing typecheck errors affected.

### 2026-02-12 21:30:00 EST
Branch merged to main.
