# 20260212145546 - Time-of-Day Atmosphere Overlay

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:46 EST |
| **Last Modified**  | 2026-02-12 14:55:46 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212145509 |
| **Feature**        | animation-atmosphere |
| **Touches**        | packages/renderer/src/atmosphere/TimeOfDayOverlay.ts |
| **References**     | [Animation DD](../../docs/design-docs/20260212133443-animation-atmosphere.md) (Section 5) |

## Description

Implement the TimeOfDayOverlay that shifts the entire world's color palette based on the in-game time period. Uses a multiplicative+additive RGB transform model (not HSL — faster, good enough for terminal). Six time-period presets (dawn warm pink → noon neutral → night deep blue) with smooth ease-in-out interpolation over 30 seconds when transitioning between periods.

## Acceptance Criteria

- [ ] `TimeOfDayOverlay` class with setTarget, update, getTransform methods
- [ ] `TIME_TRANSFORMS` record with 6 presets (dawn, morning, afternoon, dusk, evening, night)
- [ ] `lerpTransform` function for smooth interpolation between transforms
- [ ] Ease-in-out easing during transitions (not linear snap)
- [ ] 30-second transition duration (configurable)
- [ ] `applyColorTransform(hex, transform)` helper function for per-cell color application
- [ ] Afternoon transform is identity (optimization: can skip transform entirely)
- [ ] Unit tests for color transform math (verify RGB clamping, brightness)
- [ ] Unit tests for interpolation (verify midpoint values, easing curve)
- [ ] Unit tests for transition lifecycle (start → progress → complete)

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 14:55:46 EST
Initial creation. Extracted from Animation & Atmosphere DD (20260212133443), covering DD task #6. Blocked by animation types/manager task (20260212145509) for ColorTransform type.
