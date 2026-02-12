# 20260212125927 - Mini-Map Rendering

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 12:59:27 EST |
| **Last Modified**  | 2026-02-12 12:59:27 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212125925 |
| **Feature**        | world-generation |
| **Touches**        | packages/renderer/src/ui/MiniMap.ts |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Render explored zones as a mini-map in the side panel FrameBuffer. The mini-map shows the zone graph with the player's current position, zone boundaries, and basic terrain colors. Each explored zone is represented as a small colored cell, and unexplored zones are blank. This gives the player spatial awareness of the world they've discovered.

Note: Blocked by the multi-zone DD task. Once that DD is broken into implementation tasks, update this task's Blocked-By to point to the relevant implementation task (zone graph management).

## Acceptance Criteria

- [ ] MiniMap component renders into the side panel FrameBuffer
- [ ] Each explored zone shown as a colored cell (biome-based color)
- [ ] Current zone highlighted distinctly (e.g., blinking or bright border)
- [ ] Player position indicated within the current zone
- [ ] Unexplored zones are blank/dark
- [ ] Map auto-centers on current zone
- [ ] Unit tests for mini-map coordinate calculations
- [ ] Unit tests for zone-to-color mapping

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 12:59:27 EST
Initial creation. Broken out from Polish task (20260212114218). Blocked by multi-zone DD (20260212125925) — needs zone graph concepts to be designed and implemented.
