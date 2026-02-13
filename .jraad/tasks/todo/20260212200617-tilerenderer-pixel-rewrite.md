# 20260212200617 - TileRenderer Pixel Rewrite

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 20:06:17 EST |
| **Last Modified**  | 2026-02-12 20:06:17 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212200613, 20260212200614, 20260212200615, 20260212200611 |
| **Feature**        | advanced-sprites |
| **Touches**        | packages/renderer/src/TileRenderer.ts, packages/renderer/src/types.ts |
| **References**     | [Advanced Sprite System DD](../../docs/design-docs/20260212195744-advanced-sprite-system.md) |

## Description

Rewrite TileRenderer to use the full pixel rendering pipeline: render ground as pixel colors into PixelBuffer, composite sprites sorted by Y-depth, render player sprite, then encode the PixelBuffer to half-block characters via the encoder. Update ZoneData type to include sprites and biomeType.

## Acceptance Criteria

- [ ] TileRenderer constructor takes `OptimizedBuffer` + `SpriteRegistry`
- [ ] Creates internal `PixelBuffer` sized to viewport dimensions
- [ ] `renderZone()` pipeline: clear → ground pixels → collect sprites → Y-sort → blit sprites → player → encode
- [ ] Ground rendering uses `resolveGroundTexture()` to convert TileCell to 2 pixel colors per tile
- [ ] Sprite collection: filter to viewport-visible sprites, compute screen pixel coordinates
- [ ] Y-sort: sprites sorted by anchor tile Y ascending (back-to-front depth)
- [ ] Player rendered as sprite template `player_default` at player position
- [ ] Half-block encoding writes to OptimizedBuffer via `encodeHalfBlocks()`
- [ ] `ZoneData` type updated with optional `sprites?: SpriteInstance[]` and `biomeType?: string`
- [ ] Backward-compatible: zones without sprites render ground-only (pixel-textured)
- [ ] Animation system integration point: color transform can apply to PixelBuffer before encoding
- [ ] `isCollision()` function still works (collision layer unchanged)
- [ ] TypeScript compiles cleanly

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 20:06:17 EST
Initial creation. Extracted from Advanced Sprite System design doc (Section 9). Core integration task — depends on registry, encoder, sprite library, and ground textures.
