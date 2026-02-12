# 20260212122011 - Add Zod Validation to AI Response Parsing

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 12:20:11 EST |
| **Last Modified**  | 2026-02-12 12:45:04 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | neat-lynx |
| **Blocked-By**     | 20260212122007, 20260212114209 |
| **Touches**        | packages/ai/src/tools/, packages/ai/src/__tests__/, packages/ai/package.json, packages/ai/src/index.ts |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Replace all unsafe `as` type casts in AI response parsers with Zod `.parse()` validation, and derive JSON Schema tool definitions from Zod schemas (eliminating hand-maintained duplicates). Currently, 5 parse functions accept raw AI output and cast it without validation — a malformed AI response silently passes through and causes runtime errors deep in application logic. This task makes the AI boundary safe.

## Acceptance Criteria

- [x] Zod schemas created for all 5 AI response types: `ZoneSpec`, `DialogueResponse`, `ConversationConsequences`, `WorldTickResult`, `WorldSeedSpec`
- [x] All 5 parse functions (`parseZoneResponse`, `parseDialogueResponse`, `parseConsequencesResponse`, `parseWorldTickResponse`, `parseWorldSeedResponse`) use Zod `.parse()` or `.safeParse()` instead of `as` casts
- [x] JSON Schema tool definitions for Claude API derived from Zod schemas (via `zod-to-json-schema` or equivalent), replacing hand-written JSON schemas
- [x] Validation errors produce clear, actionable error messages (not generic Zod dumps)
- [x] All existing AI tests pass (updated as needed for new validation behavior)
- [x] New tests cover: valid AI response accepted, malformed response rejected with clear error, missing required fields rejected, extra fields handled gracefully
- [x] `bun run typecheck` passes clean across the entire monorepo

## Implementation Steps

- [x] Add `zod` and `zod-to-json-schema` to `@daydream/ai` dependencies
- [x] Create shared `createToolDef()` utility that generates Anthropic Tool format from Zod schemas
- [x] Rewrite `zone-tools.ts`: define `ZoneSpecSchema`, derive `createZoneTool` from schema, validate in `parseZoneResponse`
- [x] Rewrite `dialogue-tools.ts`: define input schemas + `.transform()` for snake→camel, derive tool defs, validate in parsers
- [x] Rewrite `event-tools.ts`: define input schemas + `.transform()` for snake→camel, derive tool defs, validate in parsers
- [x] Update `index.ts` to export new Zod schemas
- [x] Update existing parsing tests for new validation behavior
- [x] Add new tests: malformed response rejection, missing required fields, extra fields
- [x] Run `bun run typecheck` across monorepo

## Progress Log

### 2026-02-12 12:20:11 EST
Initial creation. All 5 AI response parsers currently do unsafe `as` type casts with no runtime validation. This is the highest-risk area in the codebase — AI responses are unpredictable and must be validated at the boundary. Depends on engine Zod schemas (20260212122007) since AI response types reference engine types.

### 2026-02-12 12:34:36 EST
Starting implementation on branch `main`. Dependency context: Zod schemas task (20260212122007) merged — all engine types now have Zod schemas exported. AI client task (20260212114209) merged — 5 parse functions in zone-tools.ts, dialogue-tools.ts, event-tools.ts use unsafe `as` casts. Plan: define Zod input schemas with `.describe()` annotations, derive JSON Schema tool defs via `zod-to-json-schema`, use `.transform()` for snake→camel conversion, validate with `.safeParse()` and format errors clearly.

### 2026-02-12 12:41:27 EST
Implementation complete. Created shared `schema-utils.ts` with `createToolDef()` (derives Anthropic Tool from Zod via `zod-to-json-schema`) and `validateToolResponse()` (validates + formats errors). Rewrote all 3 tool files: zone-tools.ts (ZoneSpecSchema, no transform), dialogue-tools.ts (DialogueResponseSchema + ConversationConsequencesSchema with snake→camel `.transform()`), event-tools.ts (WorldTickResultSchema + WorldSeedSpecSchema with snake→camel `.transform()`). All Zod schemas include `.describe()` annotations that carry into generated JSON Schema. Added `zod` and `zod-to-json-schema` to workspace catalog and @daydream/ai. Updated index.ts to export all schemas + utilities. 39 AI tests pass (27 existing + 12 new validation tests). 95 total tests pass across both packages. Typecheck clean.

### 2026-02-12 12:45:04 EST
Branch merged to the main branch.
