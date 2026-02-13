# 20260212200619 - Sprite System Tests

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 20:06:19 EST |
| **Last Modified**  | 2026-02-12 20:06:19 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212200617 |
| **Feature**        | advanced-sprites |
| **Touches**        | packages/renderer/src/sprites/__tests__/, packages/engine/src/world/__tests__/ZoneBuilder.test.ts |
| **References**     | [Advanced Sprite System DD](../../docs/design-docs/20260212195744-advanced-sprite-system.md) |

## Description

Comprehensive test suite for the sprite system covering PixelBuffer, half-block encoding, SpriteRegistry, ground textures, ZoneBuilder sprite placement, and TileRenderer pixel pipeline.

## Acceptance Criteria

- [ ] **PixelBuffer tests**: set/get pixels, bounds checking (out-of-bounds ignored), clear, blitSprite with transparency
- [ ] **Half-block encoder tests**: same colors → █, different → ▀, null pixels → default bg, correct RGBA conversion
- [ ] **SpriteRegistry tests**: register/get, find by category, find by tags, save/load cache round-trip, registerBuiltins populates expected count
- [ ] **Ground texture tests**: deterministic output (same coords → same colors), all biome types produce valid hex colors, resolveGroundTexture infers correct texture from tile chars
- [ ] **ZoneBuilder tests**: sprites placed within bounds, collision mask applied for multi-cell sprites, overlap prevention (blocked tiles reject sprite), fallback to single-cell for unknown types
- [ ] **TileRenderer integration test**: render a zone with sprites, verify PixelBuffer populated correctly, verify half-block output chars are ▀/█
- [ ] All tests pass (`bun run test`)
- [ ] No regressions in existing tests

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 20:06:19 EST
Initial creation. Extracted from Advanced Sprite System design doc (Section 12 test plan). Depends on TileRenderer rewrite completing.
