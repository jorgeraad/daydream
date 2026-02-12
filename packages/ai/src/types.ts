import type Anthropic from "@anthropic-ai/sdk";

// Re-export SDK types we use in our public API
export type Message = Anthropic.MessageParam;
export type Tool = Anthropic.Tool;
export type ContentBlock = Anthropic.ContentBlock;
export type ToolUseBlock = Anthropic.ToolUseBlock;
export type TextBlock = Anthropic.TextBlock;

export type ModelTier = "opus" | "sonnet" | "haiku";

export const MODEL_IDS: Record<ModelTier, string> = {
  opus: "claude-opus-4-6",
  sonnet: "claude-sonnet-4-5-20250929",
  haiku: "claude-haiku-4-5-20251001",
};

export type TaskType =
  | "world-creation"
  | "zone-generation"
  | "dialogue"
  | "response-options"
  | "event-evaluation"
  | "world-tick"
  | "chronicle-compression"
  | "tile-palette";

export const TASK_MODEL_MAP: Record<TaskType, ModelTier> = {
  "world-creation": "opus",
  "zone-generation": "sonnet",
  "dialogue": "sonnet",
  "response-options": "haiku",
  "event-evaluation": "sonnet",
  "world-tick": "sonnet",
  "chronicle-compression": "haiku",
  "tile-palette": "haiku",
};

export interface GenerateParams {
  system: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  model?: ModelTier;
  /** Optional label for logging — identifies what this AI call is for. */
  taskType?: string;
}

export interface AIResponse {
  text: string;
  toolUse: ToolUseBlock[];
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ContextBudget {
  systemPrompt: number;
  worldContext: number;
  chronicleSummary: number;
  recentEvents: number;
  specificContext: number;
  responseBudget: number;
}

export const DEFAULT_CONTEXT_BUDGET: ContextBudget = {
  systemPrompt: 2000,
  worldContext: 1000,
  chronicleSummary: 2000,
  recentEvents: 1000,
  specificContext: 2000,
  responseBudget: 2000,
};

export interface ContextBlock {
  system: string;
  worldContext: string;
  chronicleSummary: string;
  recentEvents: string;
  specificContext: string;
}
