# 20260212145509 - Animation Types & Manager Core

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:09 EST |
| **Last Modified**  | 2026-02-12 14:55:09 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | none |
| **Feature**        | animation-atmosphere |
| **Touches**        | packages/renderer/src/animation/types.ts, packages/renderer/src/animation/AnimationManager.ts |
| **References**     | [Animation DD](../../docs/design-docs/20260212133443-animation-atmosphere.md) (Sections 2, 3) |

## Description

Create the animation type system and AnimationManager class. This is the foundation for all animations — tile animations, character idle animations, and time-of-day atmosphere all build on these types. The AnimationManager orchestrates active animations, produces per-frame override maps for TileRenderer, and manages OpenTUI's requestLive/dropLive lifecycle.

## Acceptance Criteria

- [ ] `Animation` interface defined (update, applyOverrides, finished)
- [ ] `CellOverride` interface defined (char?, fg?, bg?, bold?, dim?)
- [ ] `AnimationOverrides` type defined (Map<string, CellOverride>)
- [ ] `AnimationState` interface defined (overrides + colorTransform)
- [ ] `ColorTransform` interface defined (rMul, gMul, bMul, rAdd, gAdd, bAdd, brightness)
- [ ] `IDENTITY_TRANSFORM` constant exported
- [ ] `AnimationManager` class with add/remove/update/clearAll/getOverrides/getColorTransform
- [ ] requestLive called when first animation added, dropLive when last removed
- [ ] `registerZoneAnimations(zone)` scans tile layers for animated tiles
- [ ] `setTimeOfDay(timeOfDay, transitionProgress)` method
- [ ] Unit tests for AnimationManager lifecycle (add/remove/requestLive/dropLive)
- [ ] Exports added to `packages/renderer/src/index.ts`

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 14:55:09 EST
Initial creation. Extracted from Animation & Atmosphere DD (20260212133443), covering DD tasks #1 and #2.
