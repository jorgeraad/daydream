# 20260212114209 - AI Client & Prompt Framework

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 11:42:20 EST |
| **Last Modified**  | 2026-02-12 11:42:20 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212114207 |
| **Touches**        | packages/ai/src/client.ts, packages/ai/src/context.ts, packages/ai/src/prompts/, packages/ai/src/tools/, packages/ai/src/index.ts |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Build the AI client wrapper around the Claude SDK (@anthropic-ai/sdk). Implement the prompt architecture (layered system/world/chronicle/specific context), context budget management, structured output via tool definitions, and streaming support. Define all prompt templates and tool schemas for world creation, zone generation, dialogue, events, and compression. This is the AI foundation that dialogue, world gen, chronicle, and events all build on.

## Acceptance Criteria

- [ ] AIClient class wrapping @anthropic-ai/sdk with generate() and stream() methods
- [ ] Model selection support (opus, sonnet, haiku) per task type
- [ ] API key read from ANTHROPIC_API_KEY env var with clear error on missing key
- [ ] ContextManager with budget tracking and context assembly per task type
- [ ] Prompt templates defined: world-creation, zone-generation, dialogue, events, compression
- [ ] Tool schemas defined: zone-tools, dialogue-tools, event-tools
- [ ] Structured output parsing for each tool schema
- [ ] Streaming support for dialogue responses (AsyncGenerator<string>)
- [ ] All prompts and tools exported from @daydream/ai index
- [ ] Unit tests for ContextManager (budget enforcement, context assembly)
- [ ] Unit tests for structured output parsing (valid + malformed responses)
- [ ] Integration test with mocked Claude responses for each tool schema
- [ ] `bun run typecheck` passes

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 11:42:20 EST
Initial creation. Extracted from design doc Sections 4 (AI Engine), 12 (API & Networking), and 14 (Generation Prompts). Split out from dialogue task to enable parallel work on AI and renderer tracks.
