# 20260212145529 - Tile & Character Animations

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:29 EST |
| **Last Modified**  | 2026-02-12 22:00:00 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | brave-lynx |
| **Blocked-By**     | 20260212145509 |
| **Feature**        | animation-atmosphere |
| **Touches**        | packages/renderer/src/animation/WaterShimmer.ts, packages/renderer/src/animation/TorchFlicker.ts, packages/renderer/src/animation/IdleAnimation.ts, packages/renderer/src/animation/TileCycleAnimation.ts, packages/renderer/src/animation/AnimationManager.ts, packages/renderer/src/animation/__tests__/, packages/renderer/src/index.ts |
| **References**     | [Animation DD](../../docs/design-docs/20260212133443-animation-atmosphere.md) (Section 4) |

## Description

Implement the three concrete animation types that bring the world to life. WaterShimmer cycles through animFrame characters with position-based phase offsets for a rippling effect. TorchFlicker rapidly jitters characters and dims frames for erratic fire. IdleAnimation cycles character display frames at a slow pace. All implement the Animation interface from the types/manager task.

## Acceptance Criteria

- [x] `WaterShimmer` class — cycles animFrames at 600ms interval, deterministic phase offset from (x,y)
- [x] `TorchFlicker` class — cycles at 200ms, 1-in-4 frames dimmed, uses animFrames or defaults
- [x] `IdleAnimation` class — cycles character frames at 1500ms, position via callback (characters can move)
- [x] `TileCycleAnimation` class — generic fallback for any animated tile not matching water/torch patterns
- [x] Unit tests for each: verify frame cycling, phase offset behavior, timer accumulation
- [x] Unit tests for IdleAnimation position callback updates

## Implementation Steps

- [x] Create `WaterShimmer.ts` — cycles animFrames with position-based phase offset
- [x] Create `TorchFlicker.ts` — rapid flicker with dim frames, default characters
- [x] Create `IdleAnimation.ts` — slow character cycling with position callback
- [x] Extract `TileCycleAnimation` from AnimationManager into its own exported file
- [x] Write unit tests for WaterShimmer (frame cycling, phase offset, timer)
- [x] Write unit tests for TorchFlicker (frame cycling, dim behavior)
- [x] Write unit tests for IdleAnimation (frame cycling, position callback)
- [x] Write unit tests for TileCycleAnimation
- [x] Update AnimationManager.registerZoneAnimations to use new concrete types
- [x] Add exports to renderer index.ts
- [x] Run tests and typecheck

## Progress Log

### 2026-02-12 14:55:29 EST
Initial creation. Extracted from Animation & Atmosphere DD (20260212133443), covering DD tasks #3, #4, #5. Blocked by animation types/manager task (20260212145509).

### 2026-02-12 21:25:38 EST
Starting work on branch `main`. Agent: brave-lynx. Blocker 20260212145509 (Animation Types & Manager) is in `merged/` — resolved. No Touches overlap with other in-progress tasks (they touch packages/audio). Will implement WaterShimmer, TorchFlicker, IdleAnimation, extract TileCycleAnimation, update AnimationManager.registerZoneAnimations to use concrete types, and write tests.

### 2026-02-12 21:29:15 EST
Implementation complete. Created 4 animation classes and 4 test files (50 new tests, 81 total animation tests passing). All 331 renderer tests pass. No new typecheck errors.

**Files created:**
- `packages/renderer/src/animation/WaterShimmer.ts` — Water shimmer with 600ms interval, position-based phase offset, default frames `["~", "≈", "∼"]`
- `packages/renderer/src/animation/TorchFlicker.ts` — Torch flicker with 200ms interval, 1-in-4 dim frames, default frames `["†", "‡", "✦"]`
- `packages/renderer/src/animation/IdleAnimation.ts` — Character idle with 1500ms interval, position callback for moving entities
- `packages/renderer/src/animation/TileCycleAnimation.ts` — Extracted generic fallback from AnimationManager, position-based phase offset
- `packages/renderer/src/animation/__tests__/WaterShimmer.test.ts` — 13 tests (construction, frame cycling, phase offset, overrides)
- `packages/renderer/src/animation/__tests__/TorchFlicker.test.ts` — 12 tests (construction, frame cycling, dim behavior, overrides)
- `packages/renderer/src/animation/__tests__/IdleAnimation.test.ts` — 13 tests (construction, frame cycling, position callback, overrides)
- `packages/renderer/src/animation/__tests__/TileCycleAnimation.test.ts` — 12 tests (construction, frame cycling, phase offset, overrides)

**Files modified:**
- `packages/renderer/src/animation/AnimationManager.ts` — Removed internal TileCycleAnimation class, imported concrete types, updated `registerZoneAnimations` to select WaterShimmer/TorchFlicker/TileCycleAnimation based on tile character
- `packages/renderer/src/index.ts` — Added exports for WaterShimmer, TorchFlicker, IdleAnimation, TileCycleAnimation

### 2026-02-12 22:00:00 EST
Branch merged to main.
