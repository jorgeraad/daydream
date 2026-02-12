# 20260212125926 - Design Doc: Animation & Atmosphere System

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 12:59:26 EST |
| **Last Modified**  | 2026-02-12 12:59:26 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | none |
| **Touches**        | .jraad/docs/animation-atmosphere-design.md |
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

- [ ] Design document written and approved via `/design-doc` process
- [ ] Covers AnimationManager API (add, remove, update lifecycle)
- [ ] Covers water shimmer and torch flicker animation implementations
- [ ] Covers time-of-day palette shift math and color interpolation
- [ ] Covers interaction between WorldClock and palette system
- [ ] Covers performance budget and frame rate considerations
- [ ] Identifies integration points with TileRenderer and FrameBuffer
- [ ] Includes concrete animation timing parameters

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 12:59:26 EST
Initial creation. Broken out from Polish task (20260212114218). Covers design.md Sections 5.4 (Animation System) and 5.5 (Atmosphere & Effects).
