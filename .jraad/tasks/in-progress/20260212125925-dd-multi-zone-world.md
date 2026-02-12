# 20260212125925 - Design Doc: Multi-Zone World & Zone Transitions

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 12:59:25 EST |
| **Last Modified**  | 2026-02-12 14:37:40 EST |
| **Status**         | in-progress |
| **Branch**         | main |
| **Agent**          | swift-kestrel |
| **Blocked-By**     | none |
| **Feature**        | world-generation |
| **Touches**        | .jraad/docs/design-docs/20260212143327-multi-zone-world.md |
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

- [x] Read existing design.md Sections 3.3 and 6.4 for context
- [x] Read existing codebase (Zone, WorldState, ZoneBuilder, SaveManager) to understand current architecture
- [x] Run `/design-doc` to drive the iterative design process
- [ ] Get design doc approved

## Progress Log

### 2026-02-12 12:59:25 EST
Initial creation. Broken out from Polish task (20260212114218). Covers design.md Sections 3.3 (Zone Generation Pipeline) and 6.4 (Zone Transition).

### 2026-02-12 13:30:47 EST
Starting implementation on branch `main`. No blocked-by dependencies. No Touches overlap with in-progress tasks (Settings task touches `apps/game/src/`). Will use `/design-doc` to drive the iterative design process. Key existing code to review: Zone.ts, WorldState, ZoneBuilder, SaveManager, AIClient.

### 2026-02-12 14:37:40 EST
First draft complete at `.jraad/docs/design-docs/20260212143327-multi-zone-world.md`. Covers all acceptance criteria: lazy generation pipeline, preloading (4 concurrent, prioritized by direction), memory management (Manhattan distance ≤ 2, ~13 zones), discrete zone transitions (fade animation), edge coherence (layered: AI hints + ZoneBuilder blending), zone graph model, ZoneManager interface, package responsibilities, performance budget, and 5-task implementation plan. Added centralized `ZoneConfig` for tunable parameters (zone dimensions, blend depth, transition timing, etc.). User feedback incorporated: discrete transitions for now with seamless scrolling migration path documented, configurable defaults throughout. Awaiting user review for approval.
