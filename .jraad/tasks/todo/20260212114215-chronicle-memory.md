# 20260212114215 - Chronicle & Memory

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 11:42:20 EST |
| **Last Modified**  | 2026-02-12 11:42:20 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212114208, 20260212114209 |
| **Touches**        | packages/engine/src/chronicle/Chronicle.ts, packages/engine/src/chronicle/NarrativeThread.ts, packages/engine/src/character/CharacterMemory.ts, packages/ai/src/context.ts, packages/ai/src/prompts/compression.ts |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Implement the chronicle system (persistent world memory) and character memory. The chronicle logs conversations, events, player actions, and world changes with narrative thread tracking. Character memory stores per-character conversation history and player impressions. Chronicle compression summarizes old entries via AI to keep context windows manageable. Wire chronicle context into AI calls.

## Acceptance Criteria

- [ ] Chronicle store with append-only entry logging
- [ ] Chronicle entry types: conversation, event, player_action, world_change, narration
- [ ] Narrative thread tracking (create, update, resolve, tension levels)
- [ ] Chronicle.getContextWindow() returns formatted context within a token budget
- [ ] CharacterMemory stores conversation summaries and player impressions
- [ ] CharacterMemory.getRelevantMemories() retrieves context for dialogue
- [ ] ContextManager assembles chronicle + character memory into AI prompt context
- [ ] Chronicle compression: raw → recent summary → historical summary via AI
- [ ] Compression runs on a timer (every 30 minutes of game time)
- [ ] Unit tests for Chronicle (append, query, context window assembly)
- [ ] Unit tests for NarrativeThread lifecycle (create, tension changes, resolve)
- [ ] Unit tests for CharacterMemory (add memory, retrieve relevant, emotional weight)
- [ ] Unit tests for ContextManager budget enforcement
- [ ] Integration test for chronicle compression with mocked AI

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 11:42:20 EST
Initial creation. Extracted from design doc Sections 9 (Chronicle & Memory) and 4.4 (Context Budget Management). Can run in parallel with AI Dialogue (20260212114213) and AI World Gen (20260212114214).
