import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { AIResponse, ToolUseBlock } from "@daydream/ai";
import { ContextManager } from "@daydream/ai";
import { EventBus, WorldState } from "@daydream/engine";
import type { Character, ConversationState } from "@daydream/engine";
import { DialogueManager } from "../DialogueManager.ts";
import type { InputRouter, KeyEvent } from "../InputRouter.ts";
import type {
  DialoguePanel,
  DialogueOption,
  DialogueSelection,
} from "@daydream/renderer";

// ── Helpers ─────────────────────────────────────────────────

function makeCharacter(id: string, x: number, y: number): Character {
  return {
    id,
    worldId: "test_world",
    identity: {
      name: "Aldric",
      age: "adult",
      role: "guard",
      personality: ["suspicious", "loyal"],
      backstory: "A veteran guard of the forest outpost.",
      speechPattern: "gruff, direct",
      secrets: [],
    },
    visual: {
      display: { char: "☺", fg: "#deb887" },
      nameplate: "Aldric",
    },
    state: {
      currentZone: "test_zone",
      position: { x, y },
      facing: "down",
      mood: "content",
      currentActivity: "standing",
      health: "healthy",
      goals: [],
    },
    behavior: { type: "stationary", params: {} },
    memory: {
      personalExperiences: [],
      heardRumors: [],
      playerRelationship: { trust: 0, familiarity: 0, impressions: [] },
    },
    relationships: new Map(),
  };
}

function makeWorldState(characters: Character[]): WorldState {
  const ws = new WorldState({
    worldId: "test_world",
    worldSeed: {
      originalPrompt: "test",
      setting: { name: "Test", type: "forest", era: "medieval", tone: "dark", description: "test" },
      biomeMap: {
        center: {
          type: "forest",
          terrain: { primary: "grass", secondary: "dirt", features: [] },
          palette: { ground: { chars: ["."], fg: ["#4a7a4a"], bg: "#1a2a1a" }, vegetation: {} },
          density: { vegetation: 0.5, structures: 0.1, characters: 0.05 },
          ambient: { lighting: "natural" },
        },
        distribution: { type: "single", seed: 0, biomes: { forest: 1 } },
      },
      initialNarrative: { hooks: [], mainTension: "", atmosphere: "" },
      worldRules: { hasMagic: false, techLevel: "medieval", economy: "barter", dangers: [], customs: [] },
    },
    createdAt: Date.now(),
    player: {
      position: { zone: "test_zone", x: 5, y: 5 },
      facing: "down",
      inventory: [],
      journal: { entries: [], knownCharacters: [], discoveredZones: ["test_zone"], activeQuests: [] },
      stats: { totalPlayTime: 0, conversationsHad: 0, zonesExplored: 1, daysSurvived: 0 },
    },
    activeZoneId: "test_zone",
  });
  for (const c of characters) {
    ws.characters.set(c.id, c);
  }
  return ws;
}

function makeDialogueToolResponse(
  speech: string,
  emotion: string,
  options: Array<{ text: string; type: string; tone: string }>,
  conversationEnded = false,
  narration?: string,
): AIResponse {
  return {
    text: "",
    toolUse: [{
      type: "tool_use" as const,
      id: "tool_1",
      name: "dialogue_response",
      input: {
        character_speech: speech,
        character_emotion: emotion,
        narration,
        options,
        conversation_ended: conversationEnded,
      },
    }],
    stopReason: "tool_use",
    usage: { inputTokens: 100, outputTokens: 50 },
  };
}

function makeConsequenceToolResponse(
  chronicleEntry: string,
  memoryAdded: string,
): AIResponse {
  return {
    text: "",
    toolUse: [{
      type: "tool_use" as const,
      id: "tool_2",
      name: "evaluate_consequences",
      input: {
        character_state_changes: [{
          character_id: "guard_1",
          mood_change: "wary",
          relationship_delta: 2,
          memory_added: memoryAdded,
        }],
        deferred_events: [],
        chronicle_entry: chronicleEntry,
        narrative_threads: [],
      },
    }],
    stopReason: "tool_use",
    usage: { inputTokens: 100, outputTokens: 50 },
  };
}

// ── Mock factories ──────────────────────────────────────────

function makeMockAIClient(responses: AIResponse[]) {
  let callIndex = 0;
  return {
    generate: mock(async () => {
      const resp = responses[callIndex] ?? responses[responses.length - 1]!;
      callIndex++;
      return resp;
    }),
    stream: mock(async function* () { yield ""; }),
    getModelForTask: mock(() => "test-model"),
  };
}

/**
 * Mock panel that auto-resolves promises.
 * On showOptions, selects the first option by default (or escape on call N).
 */
function makeMockPanel(optionSelections: DialogueSelection[] = []) {
  let optionCallIndex = 0;
  const defaultSelection: DialogueSelection = { type: "option", index: 0 };

  return {
    showSpeech: mock(async (_name: string, _text: string, _emotion: string) => {}),
    showOptions: mock(async (_options: DialogueOption[]) => {
      const sel = optionSelections[optionCallIndex] ?? defaultSelection;
      optionCallIndex++;
      return sel;
    }),
    showThinking: mock(() => {}),
    showNarration: mock((_text: string) => {}),
    handleKey: mock((_key: KeyEvent) => {}),
    clear: mock(() => {}),
    destroy: mock(() => {}),
    container: {} as unknown,
  };
}

function makeMockInputRouter() {
  return {
    setMode: mock((_mode: string) => {}),
    setDialogueHandler: mock((_handler: ((key: KeyEvent) => void) | null) => {}),
    setMovementContext: mock(() => {}),
    handleKey: mock(() => {}),
    get mode() { return "exploration" as const; },
  };
}

// ── Tests ───────────────────────────────────────────────────

describe("DialogueManager", () => {
  let character: Character;
  let worldState: WorldState;
  let eventBus: EventBus;

  beforeEach(() => {
    character = makeCharacter("guard_1", 6, 5);
    worldState = makeWorldState([character]);
    eventBus = new EventBus();
  });

  test("startConversation initializes ConversationState", async () => {
    const aiResponse = makeDialogueToolResponse(
      "Halt! Who goes there?",
      "suspicious",
      [{ text: "Just passing through.", type: "dialogue", tone: "friendly" }],
      true, // end immediately
    );
    const aiClient = makeMockAIClient([aiResponse]);
    const panel = makeMockPanel();
    const router = makeMockInputRouter();

    const manager = new DialogueManager({
      aiClient: aiClient as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    await manager.startConversation("guard_1");

    // Panel should have been shown speech
    expect(panel.showSpeech).toHaveBeenCalled();
    expect(panel.showSpeech.mock.calls[0]![0]).toBe("Aldric");
    expect(panel.showSpeech.mock.calls[0]![1]).toBe("Halt! Who goes there?");
  });

  test("conversation turns are recorded", async () => {
    // First: initial greeting. Second: response to player input. Ends conversation.
    const aiResponses = [
      makeDialogueToolResponse(
        "Hello there.",
        "neutral",
        [{ text: "Hi!", type: "dialogue", tone: "friendly" }],
        false,
      ),
      makeDialogueToolResponse(
        "Good day.",
        "pleasant",
        [],
        true, // end conversation
      ),
    ];
    const aiClient = makeMockAIClient(aiResponses);
    const panel = makeMockPanel([{ type: "option", index: 0 }]);
    const router = makeMockInputRouter();

    const manager = new DialogueManager({
      aiClient: aiClient as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    // Capture conversation state before it's cleared
    let capturedConversation: ConversationState | null = null;
    eventBus.on("dialogue:ended", ({ conversation }) => {
      capturedConversation = conversation;
    });

    await manager.startConversation("guard_1");

    // Should have character + player + character turns
    expect(capturedConversation).not.toBeNull();
    expect(capturedConversation!.turns.length).toBe(3);
    expect(capturedConversation!.turns[0]!.speaker).toBe("character");
    expect(capturedConversation!.turns[1]!.speaker).toBe("player");
    expect(capturedConversation!.turns[2]!.speaker).toBe("character");
  });

  test("mood updates from character emotion", async () => {
    const aiResponse = makeDialogueToolResponse(
      "Be gone!",
      "angry",
      [],
      true,
    );
    const aiClient = makeMockAIClient([aiResponse]);
    const panel = makeMockPanel();
    const router = makeMockInputRouter();

    let capturedConversation: ConversationState | null = null;
    eventBus.on("dialogue:ended", ({ conversation }) => {
      capturedConversation = conversation;
    });

    const manager = new DialogueManager({
      aiClient: aiClient as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    await manager.startConversation("guard_1");

    expect(capturedConversation!.mood).toBe("angry");
  });

  test("endConversation marks conversation inactive", async () => {
    const aiResponse = makeDialogueToolResponse(
      "...",
      "neutral",
      [],
      true,
    );
    const aiClient = makeMockAIClient([aiResponse]);
    const panel = makeMockPanel();
    const router = makeMockInputRouter();

    let capturedConversation: ConversationState | null = null;
    eventBus.on("dialogue:ended", ({ conversation }) => {
      capturedConversation = conversation;
    });

    const manager = new DialogueManager({
      aiClient: aiClient as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    await manager.startConversation("guard_1");

    expect(capturedConversation!.isActive).toBe(false);
    expect(worldState.activeConversation).toBeNull();
  });

  test("AI error produces fallback response", async () => {
    const aiClient = {
      generate: mock(async () => { throw new Error("API error"); }),
      stream: mock(async function* () { yield ""; }),
      getModelForTask: mock(() => "test-model"),
    };
    // Player escapes after seeing the fallback response
    const panel = makeMockPanel([{ type: "escape" }]);
    const router = makeMockInputRouter();

    const manager = new DialogueManager({
      aiClient: aiClient as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    await manager.startConversation("guard_1");

    // Fallback speech should contain "lost in thought"
    expect(panel.showSpeech).toHaveBeenCalled();
    expect(panel.showSpeech.mock.calls[0]![1]).toContain("lost in thought");
  });

  test("isProcessing guard prevents concurrent conversations", async () => {
    // Use a gate to control when the first conversation proceeds
    let resolveGate: (() => void) | null = null;
    const gate = new Promise<void>((r) => { resolveGate = r; });

    const greetingResponse = makeDialogueToolResponse(
      "Hello.",
      "neutral",
      [{ text: "Hi", type: "dialogue", tone: "friendly" }],
      false,
    );
    const endResponse = makeDialogueToolResponse("Bye.", "neutral", [], true);

    let generateCallCount = 0;
    const aiClient = {
      generate: mock(async () => {
        generateCallCount++;
        if (generateCallCount === 1) return greetingResponse;
        return endResponse;
      }),
      stream: mock(async function* () { yield ""; }),
      getModelForTask: mock(() => "test-model"),
    };

    // Panel blocks on showOptions until the gate opens
    const panel = {
      showSpeech: mock(async () => {}),
      showOptions: mock(async () => {
        await gate;
        return { type: "escape" as const };
      }),
      showThinking: mock(() => {}),
      showNarration: mock(() => {}),
      handleKey: mock(() => {}),
      clear: mock(() => {}),
      destroy: mock(() => {}),
      container: {} as unknown,
    };
    const router = makeMockInputRouter();

    const manager = new DialogueManager({
      aiClient: aiClient as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    // Start first conversation (blocks at showOptions)
    const firstPromise = manager.startConversation("guard_1");

    // Wait a tick for the first call to reach showOptions
    await new Promise((r) => setTimeout(r, 10));

    // Attempt second conversation — should be silently rejected (isProcessing = true)
    await manager.startConversation("guard_1");

    // Only 1 generate call should have been made
    expect(generateCallCount).toBe(1);

    // Unblock the first conversation so it can finish
    resolveGate!();
    await firstPromise;
  });

  test("emits dialogue:started and dialogue:ended events", async () => {
    const aiResponse = makeDialogueToolResponse(
      "Greetings.",
      "neutral",
      [],
      true,
    );
    const aiClient = makeMockAIClient([aiResponse]);
    const panel = makeMockPanel();
    const router = makeMockInputRouter();

    const events: string[] = [];
    eventBus.on("dialogue:started", () => events.push("started"));
    eventBus.on("dialogue:ended", () => events.push("ended"));

    const manager = new DialogueManager({
      aiClient: aiClient as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    await manager.startConversation("guard_1");

    expect(events).toEqual(["started", "ended"]);
  });

  test("escape selection ends conversation", async () => {
    const aiResponse = makeDialogueToolResponse(
      "Hello.",
      "neutral",
      [{ text: "Hi", type: "dialogue", tone: "friendly" }],
      false,
    );
    const aiClient = makeMockAIClient([aiResponse]);
    const panel = makeMockPanel([{ type: "escape" }]);
    const router = makeMockInputRouter();

    const manager = new DialogueManager({
      aiClient: aiClient as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    await manager.startConversation("guard_1");

    // Should restore exploration mode
    expect(router.setMode).toHaveBeenLastCalledWith("exploration");
    expect(panel.clear).toHaveBeenCalled();
  });

  test("narration is shown when present in response", async () => {
    const aiResponse = makeDialogueToolResponse(
      "I know things.",
      "mysterious",
      [],
      true,
      "She leans in conspiratorially.",
    );
    const aiClient = makeMockAIClient([aiResponse]);
    const panel = makeMockPanel();
    const router = makeMockInputRouter();

    const manager = new DialogueManager({
      aiClient: aiClient as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    await manager.startConversation("guard_1");

    expect(panel.showNarration).toHaveBeenCalledWith("She leans in conspiratorially.");
  });

  test("consequence processing updates character memory", async () => {
    const dialogueResponse = makeDialogueToolResponse(
      "Fine, I'll trust you.",
      "resigned",
      [],
      true,
    );
    const consequenceResponse = makeConsequenceToolResponse(
      "The guard reluctantly agreed to trust the stranger.",
      "Stranger approached peacefully",
    );
    const aiClient = makeMockAIClient([dialogueResponse, consequenceResponse]);
    const panel = makeMockPanel();
    const router = makeMockInputRouter();

    const manager = new DialogueManager({
      aiClient: aiClient as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    await manager.startConversation("guard_1");

    // Wait for async consequence evaluation
    await new Promise((r) => setTimeout(r, 100));

    // Character memory should have been updated
    const updated = worldState.characters.get("guard_1")!;
    expect(updated.memory.personalExperiences.length).toBeGreaterThan(0);
    expect(updated.memory.playerRelationship.trust).toBe(2);
  });

  test("chronicle entry created after conversation", async () => {
    const dialogueResponse = makeDialogueToolResponse(
      "Interesting...",
      "intrigued",
      [],
      true,
    );
    const consequenceResponse = makeConsequenceToolResponse(
      "A brief exchange with the guard.",
      "Met the stranger",
    );
    const aiClient = makeMockAIClient([dialogueResponse, consequenceResponse]);
    const panel = makeMockPanel();
    const router = makeMockInputRouter();

    const manager = new DialogueManager({
      aiClient: aiClient as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    await manager.startConversation("guard_1");

    // Wait for async consequence evaluation
    await new Promise((r) => setTimeout(r, 100));

    const entries = worldState.chronicle.getEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]!.type).toBe("conversation");
    expect(entries[0]!.summary).toBe("A brief exchange with the guard.");
  });
});
