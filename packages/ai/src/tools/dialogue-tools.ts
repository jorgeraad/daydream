import { z } from "zod";
import type { ToolUseBlock } from "../types.ts";
import { createToolDef, validateToolResponse } from "./schema-utils.ts";

// ── Dialogue Response ───────────────────────────────────────

const DialogueResponseInputSchema = z.object({
  character_speech: z
    .string()
    .describe("What the character says or does in response to the player"),
  character_emotion: z
    .string()
    .describe(
      'The character\'s current emotional state (e.g., "amused", "suspicious", "warm")',
    ),
  narration: z
    .string()
    .describe(
      'Optional scene description or action narration (e.g., "She leans in conspiratorially")',
    )
    .optional(),
  options: z
    .array(
      z.object({
        text: z.string().describe("The text of the option"),
        type: z
          .enum(["dialogue", "action"])
          .describe("Whether this is something the player says or does"),
        tone: z
          .string()
          .describe('The tone of this option (e.g., "friendly", "aggressive", "curious")'),
        preview: z
          .string()
          .describe("Short hint about what this might lead to")
          .optional(),
      }),
    )
    .describe("3-4 response options for the player, with different approaches"),
  conversation_ended: z
    .boolean()
    .describe("Whether the character ends the conversation (walks away, etc.)")
    .optional()
    .default(false),
});

export const DialogueResponseSchema = DialogueResponseInputSchema.transform(
  (input) => ({
    characterSpeech: input.character_speech,
    characterEmotion: input.character_emotion,
    narration: input.narration,
    options: input.options,
    conversationEnded: input.conversation_ended,
  }),
);

export type DialogueResponse = z.output<typeof DialogueResponseSchema>;

export const dialogueResponseTool = createToolDef(
  "dialogue_response",
  "Generate a character's response to the player and provide response options",
  DialogueResponseInputSchema,
);

export function parseDialogueResponse(
  toolUse: ToolUseBlock,
): DialogueResponse {
  return validateToolResponse(toolUse, "dialogue_response", DialogueResponseSchema);
}

// ── Conversation Consequences ───────────────────────────────

const ConsequencesInputSchema = z.object({
  character_state_changes: z.array(
    z.object({
      character_id: z.string(),
      mood_change: z.string().optional(),
      relationship_delta: z
        .number()
        .describe("Change in trust/familiarity (-10 to +10)")
        .optional(),
      new_goal: z.string().optional(),
      memory_added: z
        .string()
        .describe("What the character remembers from this conversation"),
    }),
  ),
  deferred_events: z
    .array(
      z.object({
        description: z.string(),
        trigger_condition: z
          .string()
          .describe(
            "When should this event fire? (e.g., 'next time player enters the tavern')",
          ),
        effects: z
          .array(z.string())
          .describe("What happens when this event triggers"),
      }),
    )
    .describe("Events that should happen later as a result of this conversation")
    .optional()
    .default([]),
  chronicle_entry: z
    .string()
    .describe("A brief narrative summary of this conversation for the chronicle"),
  narrative_threads: z
    .array(z.string())
    .describe("Narrative threads advanced or created by this conversation"),
});

export const ConversationConsequencesSchema = ConsequencesInputSchema.transform(
  (input) => ({
    characterStateChanges: input.character_state_changes.map((c) => ({
      characterId: c.character_id,
      moodChange: c.mood_change,
      relationshipDelta: c.relationship_delta,
      newGoal: c.new_goal,
      memoryAdded: c.memory_added,
    })),
    deferredEvents: input.deferred_events.map((d) => ({
      description: d.description,
      triggerCondition: d.trigger_condition,
      effects: d.effects,
    })),
    chronicleEntry: input.chronicle_entry,
    narrativeThreads: input.narrative_threads,
  }),
);

export type ConversationConsequences = z.output<
  typeof ConversationConsequencesSchema
>;

export const evaluateConsequencesTool = createToolDef(
  "evaluate_consequences",
  "Analyze a completed conversation and determine its effects on the world",
  ConsequencesInputSchema,
);

export function parseConsequencesResponse(
  toolUse: ToolUseBlock,
): ConversationConsequences {
  return validateToolResponse(
    toolUse,
    "evaluate_consequences",
    ConversationConsequencesSchema,
  );
}
