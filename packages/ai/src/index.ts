// @daydream/ai — Claude API client, prompts, context management

// Client
export { AIClient } from "./client.ts";

// Context
export { ContextManager } from "./context.ts";

// Types
export type {
  AIResponse,
  ContextBlock,
  ContextBudget,
  ContentBlock,
  GenerateParams,
  Message,
  ModelTier,
  TaskType,
  TextBlock,
  Tool,
  ToolUseBlock,
} from "./types.ts";
export { DEFAULT_CONTEXT_BUDGET, MODEL_IDS, TASK_MODEL_MAP } from "./types.ts";

// Prompts
export {
  WORLD_CREATION_SYSTEM_PROMPT,
  buildWorldCreationPrompt,
} from "./prompts/world-creation.ts";
export {
  ZONE_GENERATION_SYSTEM_PROMPT,
  buildZoneGenerationPrompt,
} from "./prompts/zone-generation.ts";
export {
  DIALOGUE_SYSTEM_PROMPT,
  CONSEQUENCE_SYSTEM_PROMPT,
  buildDialoguePrompt,
  buildConsequencePrompt,
} from "./prompts/dialogue.ts";
export {
  WORLD_TICK_SYSTEM_PROMPT,
  EVENT_EVALUATION_SYSTEM_PROMPT,
  buildWorldTickPrompt,
} from "./prompts/events.ts";
export {
  COMPRESSION_SYSTEM_PROMPT,
  buildCompressionPrompt,
} from "./prompts/compression.ts";

// Tool schemas
export { createZoneTool, parseZoneResponse } from "./tools/zone-tools.ts";
export type { ZoneSpec } from "./tools/zone-tools.ts";

export {
  dialogueResponseTool,
  parseDialogueResponse,
  evaluateConsequencesTool,
  parseConsequencesResponse,
} from "./tools/dialogue-tools.ts";
export type {
  DialogueResponse,
  ConversationConsequences,
} from "./tools/dialogue-tools.ts";

export {
  worldTickTool,
  parseWorldTickResponse,
  createWorldTool,
  parseWorldSeedResponse,
} from "./tools/event-tools.ts";
export type {
  WorldTickEvent,
  WorldTickResult,
  WorldSeedSpec,
} from "./tools/event-tools.ts";
