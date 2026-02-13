# 20260212200618 - GameShell & WorldGenerator Sprite Integration

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 20:06:18 EST |
| **Last Modified**  | 2026-02-12 20:06:18 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212200616, 20260212200617 |
| **Feature**        | advanced-sprites |
| **Touches**        | apps/game/src/GameShell.ts, apps/game/src/WorldGenerator.ts, apps/game/src/index.ts |
| **References**     | [Advanced Sprite System DD](../../docs/design-docs/20260212195744-advanced-sprite-system.md) |

## Description

Wire the sprite system into the game layer. GameShell creates a SpriteRegistry, passes it to TileRenderer. WorldGenerator initializes the registry with built-ins and loads the disk cache. ZoneBuilder receives the registry for sprite placement during zone generation.

## Acceptance Criteria

- [ ] SpriteRegistry created at game startup (in index.ts or GameShell)
- [ ] `registerBuiltins()` called, then `loadCache()` called
- [ ] SpriteRegistry passed to TileRenderer constructor
- [ ] SpriteRegistry passed to ZoneBuilder (or WorldGenerator passes it through)
- [ ] WorldGenerator pipeline: AI → ZoneSpec → ZoneBuilder (with registry) → ZoneBuildResult (with sprites)
- [ ] Generated zone data includes SpriteInstance[] in ZoneData passed to TileRenderer
- [ ] biomeType set on ZoneData for ground texture resolution
- [ ] Game renders with pixel sprites instead of single-character tiles
- [ ] Player movement and collision still work correctly
- [ ] Viewport resize handling works with new TileRenderer
- [ ] TypeScript compiles cleanly
- [ ] Game starts and renders correctly (`bun run dev`)

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 20:06:18 EST
Initial creation. Extracted from Advanced Sprite System design doc. Final integration task — wires everything together in the game layer.
