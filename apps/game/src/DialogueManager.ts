import type { AIClient, AIResponse } from "@daydream/ai";
import { ContextManager } from "@daydream/ai";
import {
  DIALOGUE_SYSTEM_PROMPT,
  CONSEQUENCE_SYSTEM_PROMPT,
  buildDialoguePrompt,
  buildConsequencePrompt,
  dialogueResponseTool,
  evaluateConsequencesTool,
  parseDialogueResponse,
  parseConsequencesResponse,
} from "@daydream/ai";
import type { DialogueResponse, ConversationConsequences } from "@daydream/ai";
import type {
  Character,
  ConversationState,
  ConversationTurn,
} from "@daydream/engine";
import {
  EventBus,
  WorldState,
  CharacterMemory,
  Chronicle,
  EventQueue,
  ConsequenceEvaluator,
} from "@daydream/engine";
import type { DialoguePanel, DialogueSelection } from "@daydream/renderer";
import type { InputRouter, KeyEvent } from "./InputRouter.ts";

/**
 * Orchestrates the full dialogue conversation lifecycle.
 * Wires AIClient, engine state, and DialoguePanel together.
 */
export class DialogueManager {
  private aiClient: AIClient;
  private contextManager: ContextManager;
  private worldState: WorldState;
  private eventBus: EventBus;
  private panel: DialoguePanel;
  private inputRouter: InputRouter;

  private isProcessing = false;

  constructor(params: {
    aiClient: AIClient;
    contextManager: ContextManager;
    worldState: WorldState;
    eventBus: EventBus;
    panel: DialoguePanel;
    inputRouter: InputRouter;
  }) {
    this.aiClient = params.aiClient;
    this.contextManager = params.contextManager;
    this.worldState = params.worldState;
    this.eventBus = params.eventBus;
    this.panel = params.panel;
    this.inputRouter = params.inputRouter;
  }

  async startConversation(characterId: string): Promise<void> {
    if (this.isProcessing) return;

    const character = this.worldState.characters.get(characterId);
    if (!character) return;

    this.isProcessing = true;

    try {
      // Initialize conversation state
      const conversation: ConversationState = {
        characterId,
        turns: [],
        startedAt: Date.now(),
        mood: character.state.mood,
        topicsDiscussed: [],
        isActive: true,
      };
      this.worldState.activeConversation = conversation;

      // Switch to dialogue mode
      this.inputRouter.setMode("dialogue");
      this.inputRouter.setDialogueHandler((key: KeyEvent) => this.panel.handleKey(key));

      this.eventBus.emit("dialogue:started", { characterId });

      // Run the conversation loop
      await this.conversationLoop(character, conversation);
    } finally {
      await this.endConversation();
    }
  }

  private async conversationLoop(
    character: Character,
    conversation: ConversationState,
  ): Promise<void> {
    // Generate initial response (player approaches)
    let response: DialogueResponse | null = await this.generateResponse(
      character,
      conversation,
      "*approaches*",
      "action",
    );
    if (!response) return;

    while (true) {
      // Record character turn
      this.addTurn(conversation, "character", response.characterSpeech, "dialogue");

      // Update mood from character emotion
      conversation.mood = response.characterEmotion;

      // Show narration if present
      if (response.narration) {
        this.panel.showNarration(response.narration);
        // Brief pause for narration visibility
        await this.delay(500);
      }

      // Typewriter speech
      await this.panel.showSpeech(
        character.identity.name,
        response.characterSpeech,
        response.characterEmotion,
      );

      // Check if character ended conversation
      if (response.conversationEnded) {
        break;
      }

      // Show options and wait for player input
      const selection = await this.panel.showOptions(response.options);

      if (selection.type === "escape") {
        break;
      }

      // Determine player input text and type
      let playerText: string;
      let inputType: "dialogue" | "action" | "freeform";
      if (selection.type === "option") {
        const opt = response.options[selection.index]!;
        playerText = opt.text;
        inputType = opt.type;
      } else {
        playerText = selection.text;
        inputType = "freeform";
      }

      // Record player turn
      const turnType = inputType === "action" ? "action" : "dialogue";
      this.addTurn(conversation, "player", playerText, turnType);

      // Show thinking indicator while AI generates
      this.panel.showThinking();

      // Generate next response
      response = await this.generateResponse(
        character,
        conversation,
        playerText,
        inputType,
      );
      if (!response) break;
    }
  }

  private async generateResponse(
    character: Character,
    conversation: ConversationState,
    playerInput: string,
    inputType: "dialogue" | "action" | "freeform",
  ): Promise<DialogueResponse | null> {
    try {
      const charMemory = new CharacterMemory(character.id, character.memory);

      const dialoguePrompt = buildDialoguePrompt({
        characterIdentity: this.formatCharacterIdentity(character),
        characterMood: conversation.mood,
        playerRelationship: charMemory.getRelationshipSummary(),
        characterMemories: charMemory.getRelevantMemories(500),
        chronicleContext: this.worldState.chronicle.getContextWindow(1000),
        conversationHistory: this.formatConversationHistory(conversation),
        playerInput,
        playerInputType: inputType,
      });

      const context = this.contextManager.getContextFor("dialogue", dialoguePrompt);
      const userMessage = this.contextManager.assembleUserMessage(context);

      const aiResponse: AIResponse = await this.aiClient.generate({
        system: DIALOGUE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        tools: [dialogueResponseTool],
        model: "sonnet",
        maxTokens: 1024,
      });

      // Find the dialogue_response tool use
      const toolUse = aiResponse.toolUse.find((t) => t.name === "dialogue_response");
      if (!toolUse) {
        return this.fallbackResponse();
      }

      return parseDialogueResponse(toolUse);
    } catch {
      return this.fallbackResponse();
    }
  }

  private async endConversation(): Promise<void> {
    const conversation = this.worldState.activeConversation;
    if (conversation) {
      conversation.isActive = false;

      // Fire-and-forget consequence evaluation
      this.evaluateConsequences(conversation).catch(() => {
        // Consequence evaluation failure is non-critical
      });

      this.eventBus.emit("dialogue:ended", {
        characterId: conversation.characterId,
        conversation,
      });
    }

    this.worldState.activeConversation = null;

    // Clean up UI and input
    this.panel.clear();
    this.inputRouter.setDialogueHandler(null);
    this.inputRouter.setMode("exploration");

    this.isProcessing = false;
  }

  private async evaluateConsequences(conversation: ConversationState): Promise<void> {
    const character = this.worldState.characters.get(conversation.characterId);
    if (!character) return;

    try {
      const consequencePrompt = buildConsequencePrompt({
        chronicleContext: this.worldState.chronicle.getContextWindow(1000),
        conversationSummary: this.formatConversationHistory(conversation),
        characterIdentity: this.formatCharacterIdentity(character),
        worldState: `Zone: ${this.worldState.activeZoneId}, Play time: ${this.worldState.playTime}`,
      });

      const context = this.contextManager.getContextFor("event-evaluation", consequencePrompt);
      const userMessage = this.contextManager.assembleUserMessage(context);

      const aiResponse = await this.aiClient.generate({
        system: CONSEQUENCE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        tools: [evaluateConsequencesTool],
        model: "haiku",
        maxTokens: 1024,
      });

      const toolUse = aiResponse.toolUse.find((t) => t.name === "evaluate_consequences");
      if (!toolUse) return;

      const consequences = parseConsequencesResponse(toolUse);
      this.applyConsequences(conversation, character, consequences);
    } catch {
      // Non-critical — consequence evaluation failure doesn't break gameplay
    }
  }

  private applyConsequences(
    conversation: ConversationState,
    character: Character,
    consequences: ConversationConsequences,
  ): void {
    // Update character memory and relationship
    for (const change of consequences.characterStateChanges) {
      if (change.characterId === character.id) {
        const charMemory = new CharacterMemory(character.id, character.memory);
        charMemory.addConversationMemory(
          change.memoryAdded,
          conversation.mood,
          0.6,
        );
        if (change.relationshipDelta) {
          charMemory.updateTrust(change.relationshipDelta);
          charMemory.updateFamiliarity(1);
        }
        if (change.moodChange) {
          this.worldState.applyEffect({
            type: "character_state",
            characterId: character.id,
            changes: { mood: change.moodChange },
          });
        }
      }
    }

    // Add chronicle entry
    if (consequences.chronicleEntry) {
      const entryId = `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.worldState.chronicle.append({
        id: entryId,
        timestamp: Date.now(),
        gameTime: this.worldState.playTime,
        type: "conversation",
        zone: this.worldState.activeZoneId,
        summary: consequences.chronicleEntry,
        characters: [conversation.characterId],
        narrativeThreads: consequences.narrativeThreads.length > 0
          ? consequences.narrativeThreads
          : undefined,
      });
    }

    // Update/create narrative threads
    for (const threadId of consequences.narrativeThreads) {
      const existing = this.worldState.chronicle.getThread(threadId);
      if (!existing) {
        this.worldState.chronicle.addThread(threadId, threadId);
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  private addTurn(
    conversation: ConversationState,
    speaker: "player" | "character",
    text: string,
    type: "dialogue" | "action" | "narration",
  ): void {
    const turn: ConversationTurn = {
      speaker,
      text,
      type,
      timestamp: Date.now(),
    };
    conversation.turns.push(turn);
  }

  private formatCharacterIdentity(character: Character): string {
    const { identity } = character;
    return [
      `Name: ${identity.name}`,
      `Role: ${identity.role}`,
      `Personality: ${identity.personality.join(", ")}`,
      `Speech pattern: ${identity.speechPattern}`,
      `Backstory: ${identity.backstory}`,
    ].join("\n");
  }

  private formatConversationHistory(conversation: ConversationState): string {
    if (conversation.turns.length === 0) return "(conversation just started)";
    return conversation.turns
      .map((t) => {
        const prefix = t.speaker === "player" ? "Player" : "Character";
        const typeTag = t.type === "action" ? " *" : " ";
        return `${prefix}:${typeTag}${t.text}${t.type === "action" ? "*" : ""}`;
      })
      .join("\n");
  }

  private fallbackResponse(): DialogueResponse {
    return {
      characterSpeech: "The character seems lost in thought...",
      characterEmotion: "distracted",
      narration: undefined,
      options: [
        { text: "Hello?", type: "dialogue", tone: "friendly" },
        { text: "*wave hand in front of their face*", type: "action", tone: "playful" },
        { text: "Nevermind.", type: "dialogue", tone: "dismissive" },
      ],
      conversationEnded: false,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
