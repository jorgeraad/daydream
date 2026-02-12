# 20260212125925 - Design Doc: Multi-Zone World & Zone Transitions

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 12:59:25 EST |
| **Last Modified**  | 2026-02-12 12:59:25 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | none |
| **Touches**        | .jraad/docs/multi-zone-design.md |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Write a design document covering the multi-zone world system. This is the biggest architectural piece of MVP polish — multiple systems (engine, AI, renderer, game) need to coordinate. The document should cover lazy zone generation, preloading strategy, memory management, and zone transition effects. Use `/design-doc` to drive the iterative design process.

Key areas to design:
- **Lazy generation pipeline**: How zones are generated as the player approaches edges (design.md Section 3.3)
- **Preloading strategy**: Generating 1-2 zones ahead of player movement direction
- **Memory management**: Unloading distant zones from memory while keeping them in SQLite
- **Zone transitions**: Visual effects when moving between zones (fade/slide via color dimming) (design.md Section 6.4)
- **Zone graph management**: How the engine tracks zone connectivity and state

After this DD is approved, it will be broken down into implementation tasks.

## Acceptance Criteria

- [ ] Design document written and approved via `/design-doc` process
- [ ] Covers lazy zone generation pipeline with sequence diagrams
- [ ] Covers preloading strategy (which zones to preload, cancellation on direction change)
- [ ] Covers memory management (load/unload lifecycle, SQLite caching)
- [ ] Covers zone transition UX and animation approach
- [ ] Covers zone graph data structures and engine API
- [ ] Identifies all affected packages and their responsibilities
- [ ] Includes performance budget considerations

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 12:59:25 EST
Initial creation. Broken out from Polish task (20260212114218). Covers design.md Sections 3.3 (Zone Generation Pipeline) and 6.4 (Zone Transition).
