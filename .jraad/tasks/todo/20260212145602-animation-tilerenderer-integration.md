# 20260212145602 - TileRenderer Animation Integration & Game Wiring

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:56:02 EST |
| **Last Modified**  | 2026-02-12 14:56:02 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212145509, 20260212145529, 20260212145546 |
| **Feature**        | animation-atmosphere |
| **Touches**        | packages/renderer/src/TileRenderer.ts, apps/game/src/GameShell.ts, packages/renderer/test/ |
| **References**     | [Animation DD](../../docs/design-docs/20260212133443-animation-atmosphere.md) (Sections 6, 7, 8) |

## Description

Integrate the animation system into the render pipeline and game loop. Modify TileRenderer.renderZone to accept an optional AnimationState, apply per-cell overrides from the override map, and apply time-of-day color transforms as a post-processing step. Wire AnimationManager into GameShell's render loop (update each frame, pass state to renderer). Add zone lifecycle hooks so animations are cleared and re-registered on zone:entered. Write integration tests.

## Acceptance Criteria

- [ ] TileRenderer.renderZone accepts optional `AnimationState` parameter
- [ ] Per-cell override lookup in render loop (check AnimationOverrides map for each visible cell)
- [ ] Time-of-day ColorTransform applied to fg/bg of every rendered cell
- [ ] Afternoon optimization: skip color transform when transform is identity
- [ ] GameShell calls `animationManager.update(deltaTime)` each frame
- [ ] GameShell passes AnimationState to TileRenderer.renderZone
- [ ] `zone:entered` EventBus handler: clearAll + registerZoneAnimations
- [ ] `time:changed` EventBus handler (or poll WorldClock): updates TimeOfDayOverlay
- [ ] Music ducking during dialogue does not affect animation system (independent)
- [ ] Integration test: mock zone with animated water tiles, verify overrides change over N frames
- [ ] Integration test: verify color transform application produces expected RGB values
- [ ] Performance: animation overhead < 5ms per frame with 200 animated tiles

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 14:56:02 EST
Initial creation. Extracted from Animation & Atmosphere DD (20260212133443), covering DD tasks #7, #8, #9, #10. Blocked by all three predecessor tasks. Note: Touches `apps/game/src/GameShell.ts` which overlaps with AI Dialogue (20260212114213) — coordinate on GameShell changes.
