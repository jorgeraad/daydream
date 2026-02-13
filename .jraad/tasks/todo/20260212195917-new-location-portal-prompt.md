# 20260212195917 - New Location Prompt (Portal)

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 19:59:17 EST |
| **Last Modified**  | 2026-02-12 19:59:17 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212195913 |
| **Feature**        | multi-zone-world |
| **Touches**        | apps/game/src/PortalPrompt.ts, apps/game/src/GameShell.ts, apps/game/src/WorldGenerator.ts |
| **References**     | [Multi-Zone Design Doc](../../docs/design-docs/20260212143327-multi-zone-world.md) |

## Description

Add the ability to bring up the world generation prompt from within gameplay to describe and travel to a brand new location. Pressing P (portal) in exploration mode opens a text input overlay. The player describes the new location, and the system generates a new zone at an unoccupied coordinate using WorldGenerator with the portal prompt combined with the existing WorldSeed for consistency. The new zone inherits the world's setting/rules but uses the player's description as its local flavor. Current game state is auto-saved before generation begins.

## Acceptance Criteria

- [ ] P key in exploration mode opens portal prompt overlay
- [ ] Text input for describing the new location (reuses GameInput component)
- [ ] Generation uses existing WorldSeed for world consistency (same setting, rules, tone)
- [ ] Player's description becomes the zone's local narrative/description
- [ ] New zone placed at next available coordinate (not overlapping existing zones)
- [ ] Fade transition to new zone after generation completes
- [ ] Loading indicator shown during generation
- [ ] Current game state auto-saved before portal generation begins
- [ ] Esc cancels the prompt without generating
- [ ] New zone appears in location history (discoveredZones) after visiting

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 19:59:17 EST
Initial creation. User-requested feature for re-invoking the world prompt to travel to new locations. Blocked by location history (20260212195913) due to Touches overlap on GameShell.ts. Sequenced last in the multi-zone feature.
