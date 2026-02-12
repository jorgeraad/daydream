# 20260212114209 - AI Client & Prompt Framework

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 11:42:20 EST |
| **Last Modified**  | 2026-02-12 12:19:06 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | vast-otter |
| **Blocked-By**     | 20260212114207 |
| **Feature**        | ai-foundation |
| **Touches**        | packages/ai/src/client.ts, packages/ai/src/context.ts, packages/ai/src/prompts/, packages/ai/src/tools/, packages/ai/src/index.ts |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Build the AI client wrapper around the Claude SDK (@anthropic-ai/sdk). Implement the prompt architecture (layered system/world/chronicle/specific context), context budget management, structured output via tool definitions, and streaming support. Define all prompt templates and tool schemas for world creation, zone generation, dialogue, events, and compression. This is the AI foundation that dialogue, world gen, chronicle, and events all build on.

## Acceptance Criteria

- [x] AIClient class wrapping @anthropic-ai/sdk with generate() and stream() methods
- [x] Model selection support (opus, sonnet, haiku) per task type
- [x] API key read from ANTHROPIC_API_KEY env var with clear error on missing key
- [x] ContextManager with budget tracking and context assembly per task type
- [x] Prompt templates defined: world-creation, zone-generation, dialogue, events, compression
- [x] Tool schemas defined: zone-tools, dialogue-tools, event-tools
- [x] Structured output parsing for each tool schema
- [x] Streaming support for dialogue responses (AsyncGenerator<string>)
- [x] All prompts and tools exported from @daydream/ai index
- [x] Unit tests for ContextManager (budget enforcement, context assembly)
- [x] Unit tests for structured output parsing (valid + malformed responses)
- [x] Integration test with mocked Claude responses for each tool schema
- [x] `bun run typecheck` passes

## Implementation Steps

- [x] Define shared types: GenerateParams, AIResponse, ModelTier, ContextBudget, TaskType (`types.ts`)
- [x] Build AIClient class with generate() and stream() methods (`client.ts`)
- [x] Build ContextManager with budget tracking and context assembly (`context.ts`)
- [x] Create prompt templates: world-creation, zone-generation, dialogue, events, compression (`prompts/`)
- [x] Create tool schemas: zone-tools, dialogue-tools, event-tools (`tools/`)
- [x] Wire all exports from index.ts
- [x] Write unit tests for ContextManager
- [x] Write unit tests for structured output parsing
- [x] Write integration tests with mocked Claude responses
- [x] Verify `bun run typecheck` passes

## Progress Log

### 2026-02-12 11:42:20 EST
Initial creation. Extracted from design doc Sections 4 (AI Engine), 12 (API & Networking), and 14 (Generation Prompts). Split out from dialogue task to enable parallel work on AI and renderer tracks.

### 2026-02-12 12:05:18 EST
Starting implementation on branch `main`. Ancestor: scaffolding task (20260212114207) established the `@daydream/ai` package with `@anthropic-ai/sdk` dependency. Siblings (engine types, tile renderer) touch different packages — no overlap. Following design doc Sections 4.1-4.5 (AIClient, model selection, prompt architecture, context budget, structured output) and Section 12 (Claude API integration). Building types first, then client, then prompts/tools.

### 2026-02-12 12:12:13 EST
Completed. All acceptance criteria met. Created files:
- `types.ts` — GenerateParams, AIResponse, ModelTier, TaskType, ContextBudget, model ID maps, task-to-model mapping
- `client.ts` — AIClient wrapping @anthropic-ai/sdk with generate() and stream() methods, model selection per task type
- `context.ts` — ContextManager with budget tracking, task-specific overrides, truncation, context assembly
- `prompts/world-creation.ts`, `zone-generation.ts`, `dialogue.ts`, `events.ts`, `compression.ts` — System prompts and prompt builder functions
- `tools/zone-tools.ts`, `dialogue-tools.ts`, `event-tools.ts` — Tool schemas for structured output + response parsers (also includes create_world and evaluate_consequences tools)
- `index.ts` — All exports wired
- 27 tests (10 ContextManager, 11 parsing, 6 client) — all passing
- AI package typechecks clean. Note: `apps/game/src/index.ts` has pre-existing typecheck errors unrelated to this task.

### 2026-02-12 12:19:06 EST
Committed and merged to main branch. Commit: ded4cfe.
