# 20260212145602 - TileRenderer Animation Integration & Game Wiring

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:56:02 EST |
| **Last Modified**  | 2026-02-13 17:45:15 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | mild-maple |
| **Blocked-By**     | 20260212145509, 20260212145529, 20260212145546 |
| **Feature**        | animation-atmosphere |
| **Touches**        | packages/renderer/src/TileRenderer.ts, apps/game/src/GameShell.ts, packages/renderer/test/ |
| **References**     | [Animation DD](../../docs/design-docs/20260212133443-animation-atmosphere.md) (Sections 6, 7, 8) |

## Description

Integrate the animation system into the render pipeline and game loop. Modify TileRenderer.renderZone to accept an optional AnimationState, apply per-cell overrides from the override map, and apply time-of-day color transforms as a post-processing step. Wire AnimationManager into GameShell's render loop (update each frame, pass state to renderer). Add zone lifecycle hooks so animations are cleared and re-registered on zone:entered. Write integration tests.

## Acceptance Criteria

- [x] TileRenderer.renderZone accepts optional `AnimationState` parameter
- [x] Per-cell override lookup in render loop (check AnimationOverrides map for each visible cell)
- [x] Time-of-day ColorTransform applied to fg/bg of every rendered cell
- [x] Afternoon optimization: skip color transform when transform is identity
- [x] GameShell calls `animationManager.update(deltaTime)` each frame
- [x] GameShell passes AnimationState to TileRenderer.renderZone
- [x] `zone:entered` EventBus handler: clearAll + registerZoneAnimations
- [ ] `time:changed` EventBus handler (or poll WorldClock): updates TimeOfDayOverlay — descoped: WorldClock not yet implemented; AnimationManager.setTimeOfDay() is ready to be called when WorldClock/EventBus integration lands
- [x] Music ducking during dialogue does not affect animation system (independent) — animation system has no audio coupling
- [x] Integration test: mock zone with animated water tiles, verify overrides change over N frames
- [x] Integration test: verify color transform application produces expected RGB values
- [x] Performance: animation overhead < 5ms per frame with 200 animated tiles

## Implementation Steps

- [x] Modify TileRenderer.renderZone to accept optional AnimationState parameter
- [x] Implement per-cell override lookup in renderGroundPixels and renderCharLayers
- [x] Implement time-of-day ColorTransform applied to PixelBuffer pixels before encoding
- [x] Add identity transform optimization (skip when transform is identity)
- [x] Wire AnimationManager into GameShell constructor
- [x] Add frame loop update (animationManager.update + pass state to renderZone)
- [x] Add zone:entered handler via GameShell.onZoneEntered() method
- [x] Write integration test: animated water tiles with override changes over frames
- [x] Write integration test: color transform produces expected RGB values
- [x] Write performance test: 200 animated tiles < 5ms per frame
- [x] Run typecheck and all tests

## Progress Log

### 2026-02-12 14:56:02 EST
Initial creation. Extracted from Animation & Atmosphere DD (20260212133443), covering DD tasks #7, #8, #9, #10. Blocked by all three predecessor tasks. Note: Touches `apps/game/src/GameShell.ts` which overlaps with AI Dialogue (20260212114213) — coordinate on GameShell changes.

### 2026-02-12 21:36:38 EST
Starting work on branch `main`. Agent: mild-maple. No Touches overlap with in-progress tasks. Plan: (1) Modify TileRenderer to accept AnimationState — apply per-cell overrides during ground/char layer rendering, apply color transform to PixelBuffer before encoding. (2) Wire AnimationManager into GameShell with frame loop and zone lifecycle hooks. (3) Write integration tests for overrides, color transforms, and performance.

### 2026-02-12 22:24:13 EST
Completed. All acceptance criteria met (11 of 12 — `time:changed` EventBus handler descoped because WorldClock is not yet implemented; the `AnimationManager.setTimeOfDay()` API is ready for wiring when it lands).

**Changes made:**
- `packages/renderer/src/TileRenderer.ts` — Added optional `AnimationState` param to `renderZone()`. Per-cell override lookup in `renderGroundPixels()` and `renderCharLayers()`. New `applyColorTransformToPixels()` method applies `applyColorTransform()` from `TimeOfDayOverlay.ts` to every non-null pixel in the PixelBuffer. Identity transform check skips processing entirely (afternoon optimization). Legacy `colorTransform` callback preserved but marked deprecated.
- `packages/renderer/src/sprites/PixelBuffer.ts` — Added `setPixelForce()` method for post-processing transforms that need to overwrite existing pixel values (unlike `setPixel()` which skips null).
- `apps/game/src/GameShell.ts` — Created `AnimationManager` instance in constructor. Registered frame callback via `renderer.setFrameCallback()` for continuous animation updates. Added `renderFrame()` helper, `getAnimationState()`, and `onZoneEntered()` for zone lifecycle. All rendering paths now use `renderFrame()` which passes animation state. Cleanup in `destroy()`.
- `packages/renderer/src/__tests__/animation-integration.test.ts` — 14 integration tests covering: AnimationState parameter acceptance, identity transform equivalence, per-cell override application (ground and object layers), animated water tile override cycling across frames, zone transition (clearAll + re-register), night/dawn color transforms with exact RGB verification, afternoon identity optimization, combined overrides + color transform ordering, and performance benchmarks (200 animated tiles at < 5ms/frame for update, < 10ms/frame for full render).

**Test results:** 402 renderer tests pass (0 fail), 79 game tests pass (0 fail). Typecheck clean on all modified files (pre-existing errors in unrelated test files only).
