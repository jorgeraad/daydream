# 20260212145529 - Tile & Character Animations

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:29 EST |
| **Last Modified**  | 2026-02-12 14:55:29 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212145509 |
| **Feature**        | animation-atmosphere |
| **Touches**        | packages/renderer/src/animation/WaterShimmer.ts, packages/renderer/src/animation/TorchFlicker.ts, packages/renderer/src/animation/IdleAnimation.ts |
| **References**     | [Animation DD](../../docs/design-docs/20260212133443-animation-atmosphere.md) (Section 4) |

## Description

Implement the three concrete animation types that bring the world to life. WaterShimmer cycles through animFrame characters with position-based phase offsets for a rippling effect. TorchFlicker rapidly jitters characters and dims frames for erratic fire. IdleAnimation cycles character display frames at a slow pace. All implement the Animation interface from the types/manager task.

## Acceptance Criteria

- [ ] `WaterShimmer` class — cycles animFrames at 600ms interval, deterministic phase offset from (x,y)
- [ ] `TorchFlicker` class — cycles at 200ms, 1-in-4 frames dimmed, uses animFrames or defaults
- [ ] `IdleAnimation` class — cycles character frames at 1500ms, position via callback (characters can move)
- [ ] `TileCycleAnimation` class — generic fallback for any animated tile not matching water/torch patterns
- [ ] Unit tests for each: verify frame cycling, phase offset behavior, timer accumulation
- [ ] Unit tests for IdleAnimation position callback updates

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 14:55:29 EST
Initial creation. Extracted from Animation & Atmosphere DD (20260212133443), covering DD tasks #3, #4, #5. Blocked by animation types/manager task (20260212145509).
