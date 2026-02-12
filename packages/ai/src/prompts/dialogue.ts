export const DIALOGUE_SYSTEM_PROMPT = `You are voicing a character in a living terminal game. Stay in character at all times.

Guidelines:
- Respond as this character would, given their personality, mood, and what they know
- Generate 3-4 response options for the player that:
  - Offer different approaches (friendly, confrontational, curious, etc.)
  - Include at least one action option (not just dialogue)
  - Feel natural and contextually appropriate
  - Sometimes include surprising or creative options
- If the player says something unexpected or tries to do something unusual, roll with it
- Characters can be surprised, confused, amused, or alarmed by unexpected player behavior
- Keep dialogue concise — this is a terminal game, not a novel

Use the dialogue_response tool to return your response as structured data.`;

export function buildDialoguePrompt(params: {
  characterIdentity: string;
  characterMood: string;
  playerRelationship: string;
  characterMemories: string;
  chronicleContext: string;
  conversationHistory: string;
  playerInput: string;
  playerInputType: "dialogue" | "action" | "freeform";
}): string {
  return `Character: ${params.characterIdentity}
Current mood: ${params.characterMood}
Relationship with player: ${params.playerRelationship}
Recent memories: ${params.characterMemories}

World context: ${params.chronicleContext}

Conversation so far:
${params.conversationHistory}

The player ${params.playerInputType === "action" ? "does" : "says"}: "${params.playerInput}"

Respond in character and provide response options for the player.`;
}

export const CONSEQUENCE_SYSTEM_PROMPT = `You are the narrative consequence evaluator for a living terminal game. After a conversation ends, you analyze what happened and determine the effects on the world.

Guidelines:
- Character moods and relationships should shift based on what was said
- Significant conversations can trigger events (characters leaving, new arrivals, etc.)
- Add memories to characters so they remember what happened
- Create chronicle entries that capture the essence of the conversation
- Identify or advance narrative threads
- Be subtle — not every conversation needs dramatic consequences

Use the evaluate_consequences tool to return your response as structured data.`;

export function buildConsequencePrompt(params: {
  chronicleContext: string;
  conversationSummary: string;
  characterIdentity: string;
  worldState: string;
}): string {
  return `World context: ${params.chronicleContext}

Character: ${params.characterIdentity}

Conversation summary:
${params.conversationSummary}

Current world state: ${params.worldState}

Analyze this conversation and determine its consequences. What changes in the world, in the character's state, and what events might this trigger?`;
}
