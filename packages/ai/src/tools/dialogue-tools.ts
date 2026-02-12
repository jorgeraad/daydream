import type { Tool, ToolUseBlock } from "../types.ts";

export const dialogueResponseTool: Tool = {
  name: "dialogue_response",
  description:
    "Generate a character's response to the player and provide response options",
  input_schema: {
    type: "object" as const,
    properties: {
      character_speech: {
        type: "string",
        description:
          "What the character says or does in response to the player",
      },
      character_emotion: {
        type: "string",
        description:
          'The character\'s current emotional state (e.g., "amused", "suspicious", "warm")',
      },
      narration: {
        type: "string",
        description:
          'Optional scene description or action narration (e.g., "She leans in conspiratorially")',
      },
      options: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "The text of the option",
            },
            type: {
              type: "string",
              enum: ["dialogue", "action"],
              description: "Whether this is something the player says or does",
            },
            tone: {
              type: "string",
              description:
                'The tone of this option (e.g., "friendly", "aggressive", "curious")',
            },
            preview: {
              type: "string",
              description:
                "Short hint about what this might lead to (optional)",
            },
          },
          required: ["text", "type", "tone"],
        },
        description:
          "3-4 response options for the player, with different approaches",
      },
      conversation_ended: {
        type: "boolean",
        description:
          "Whether the character ends the conversation (walks away, etc.)",
      },
    },
    required: ["character_speech", "character_emotion", "options"],
  },
};

export interface DialogueResponse {
  characterSpeech: string;
  characterEmotion: string;
  narration?: string;
  options: Array<{
    text: string;
    type: "dialogue" | "action";
    tone: string;
    preview?: string;
  }>;
  conversationEnded: boolean;
}

export function parseDialogueResponse(
  toolUse: ToolUseBlock,
): DialogueResponse {
  if (toolUse.name !== "dialogue_response") {
    throw new Error(`Expected dialogue_response tool, got ${toolUse.name}`);
  }
  const input = toolUse.input as Record<string, unknown>;
  return {
    characterSpeech: input.character_speech as string,
    characterEmotion: input.character_emotion as string,
    narration: input.narration as string | undefined,
    options: input.options as DialogueResponse["options"],
    conversationEnded: (input.conversation_ended as boolean) ?? false,
  };
}

export const evaluateConsequencesTool: Tool = {
  name: "evaluate_consequences",
  description:
    "Analyze a completed conversation and determine its effects on the world",
  input_schema: {
    type: "object" as const,
    properties: {
      character_state_changes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            character_id: { type: "string" },
            mood_change: { type: "string" },
            relationship_delta: {
              type: "number",
              description: "Change in trust/familiarity (-10 to +10)",
            },
            new_goal: { type: "string" },
            memory_added: {
              type: "string",
              description:
                "What the character remembers from this conversation",
            },
          },
          required: ["character_id", "memory_added"],
        },
      },
      deferred_events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            trigger_condition: {
              type: "string",
              description:
                "When should this event fire? (e.g., 'next time player enters the tavern')",
            },
            effects: {
              type: "array",
              items: { type: "string" },
              description: "What happens when this event triggers",
            },
          },
          required: ["description", "trigger_condition", "effects"],
        },
        description: "Events that should happen later as a result of this conversation",
      },
      chronicle_entry: {
        type: "string",
        description:
          "A brief narrative summary of this conversation for the chronicle",
      },
      narrative_threads: {
        type: "array",
        items: { type: "string" },
        description:
          "Narrative threads advanced or created by this conversation",
      },
    },
    required: [
      "character_state_changes",
      "chronicle_entry",
      "narrative_threads",
    ],
  },
};

export interface ConversationConsequences {
  characterStateChanges: Array<{
    characterId: string;
    moodChange?: string;
    relationshipDelta?: number;
    newGoal?: string;
    memoryAdded: string;
  }>;
  deferredEvents: Array<{
    description: string;
    triggerCondition: string;
    effects: string[];
  }>;
  chronicleEntry: string;
  narrativeThreads: string[];
}

export function parseConsequencesResponse(
  toolUse: ToolUseBlock,
): ConversationConsequences {
  if (toolUse.name !== "evaluate_consequences") {
    throw new Error(
      `Expected evaluate_consequences tool, got ${toolUse.name}`,
    );
  }
  const input = toolUse.input as Record<string, unknown>;
  const changes = input.character_state_changes as Array<Record<string, unknown>>;
  const deferred = (input.deferred_events ?? []) as Array<Record<string, unknown>>;

  return {
    characterStateChanges: changes.map((c) => ({
      characterId: c.character_id as string,
      moodChange: c.mood_change as string | undefined,
      relationshipDelta: c.relationship_delta as number | undefined,
      newGoal: c.new_goal as string | undefined,
      memoryAdded: c.memory_added as string,
    })),
    deferredEvents: deferred.map((d) => ({
      description: d.description as string,
      triggerCondition: d.trigger_condition as string,
      effects: d.effects as string[],
    })),
    chronicleEntry: input.chronicle_entry as string,
    narrativeThreads: input.narrative_threads as string[],
  };
}
