# 20260212125926 - Design Doc: Animation & Atmosphere System

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 12:59:26 EST |
| **Last Modified**  | 2026-02-12 14:34:27 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | fast-bobcat |
| **Blocked-By**     | none |
| **Touches**        | .jraad/docs/design-docs/20260212133443-animation-atmosphere.md |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Write a design document covering the animation and atmosphere system. This system makes the world feel alive through ambient animations and time-based visual shifts. Use `/design-doc` to drive the iterative design process.

Key areas to design:
- **AnimationManager**: Lifecycle API using OpenTUI's `requestLive()`/`dropLive()`, animation registration/removal, update loop (design.md Section 5.4)
- **Ambient animations**: Water shimmer (alternating tile characters on timer), torch/light flicker effect
- **Time-of-day palette shifts**: Color palette transformations based on WorldClock — warm dawn/dusk, cool night, bright noon (design.md Section 5.5)
- **Performance budget**: Animation frame rates, number of concurrent animations, CPU impact on tile rendering

After this DD is approved, it will be broken down into implementation tasks.

## Acceptance Criteria

- [x] Design document written and approved via `/design-doc` process
- [x] Covers AnimationManager API (add, remove, update lifecycle)
- [x] Covers water shimmer and torch flicker animation implementations
- [x] Covers time-of-day palette shift math and color interpolation
- [x] Covers interaction between WorldClock and palette system
- [x] Covers performance budget and frame rate considerations
- [x] Identifies integration points with TileRenderer and FrameBuffer
- [x] Includes concrete animation timing parameters

## Implementation Steps

- [x] Research existing codebase: TileRenderer, FrameBuffer, WorldClock, OpenTUI live rendering APIs
- [x] Run `/design-doc` to drive the iterative design process
- [x] Ensure design covers all acceptance criteria topics

## Progress Log

### 2026-02-12 12:59:26 EST
Initial creation. Broken out from Polish task (20260212114218). Covers design.md Sections 5.4 (Animation System) and 5.5 (Atmosphere & Effects).

### 2026-02-12 13:31:02 EST
Starting implementation on branch `main`. No blockers. No Touches overlap with in-progress tasks (Settings task touches `apps/game/src/` only). This is a design doc task — will research existing TileRenderer, FrameBuffer, and OpenTUI APIs, then use `/design-doc` to produce the design.

### 2026-02-12 13:43:07 EST
Design doc completed and approved. Created `.jraad/docs/design-docs/20260212133443-animation-atmosphere.md` with full coverage: AnimationManager API (render-time override pattern, not tile mutation), WaterShimmer (600ms frames, position-based phase offset), TorchFlicker (200ms frames, dim jitter), IdleAnimation (1500ms character frame cycling), TimeOfDayOverlay (RGB multiply+add color transform with 30s ease-in-out transitions), TileRenderer integration via AnimationState struct, performance budget (200 concurrent tile animations, <5ms/frame overhead), and 10-task implementation plan with parallelization graph. Three appendices document key decisions: overrides vs mutation, custom manager vs OpenTUI Timeline, RGB transform vs HSL.

### 2026-02-12 14:34:27 EST
Branch merged to the main branch.
