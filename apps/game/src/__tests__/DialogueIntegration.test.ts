import { describe, test, expect, mock } from "bun:test";
import type { AIResponse } from "@daydream/ai";
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

// ── Test helpers ────────────────────────────────────────────

function makeCharacter(id: string): Character {
  return {
    id,
    worldId: "test_world",
    identity: {
      name: "Mira",
      age: "adult",
      role: "merchant",
      personality: ["shrewd", "friendly"],
      backstory: "A traveling merchant who knows everyone's secrets.",
      speechPattern: "warm but calculating",
      secrets: ["knows about the hidden cave"],
    },
    visual: {
      display: { char: "☺", fg: "#deb887" },
      nameplate: "Mira",
    },
    state: {
      currentZone: "test_zone",
      position: { x: 10, y: 10 },
      facing: "down",
      mood: "cheerful",
      currentActivity: "standing",
      health: "healthy",
      goals: ["sell wares"],
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
  for (const c of characters) ws.characters.set(c.id, c);
  return ws;
}

function makeResponse(
  speech: string,
  emotion: string,
  options: Array<{ text: string; type: string; tone: string }>,
  ended = false,
  narration?: string,
): AIResponse {
  return {
    text: "",
    toolUse: [{
      type: "tool_use" as const,
      id: `tool_${Math.random().toString(36).slice(2)}`,
      name: "dialogue_response",
      input: {
        character_speech: speech,
        character_emotion: emotion,
        narration,
        options,
        conversation_ended: ended,
      },
    }],
    stopReason: "tool_use",
    usage: { inputTokens: 100, outputTokens: 50 },
  };
}

// ── Integration Tests ───────────────────────────────────────

describe("Dialogue Integration", () => {
  test("full flow: greet → player picks option → character responds → ends", async () => {
    const character = makeCharacter("merchant_1");
    const worldState = makeWorldState([character]);
    const eventBus = new EventBus();

    // AI returns greeting, then a closing response
    const greeting = makeResponse(
      "Welcome, traveler! Looking to trade?",
      "cheerful",
      [
        { text: "What do you have?", type: "dialogue", tone: "curious" },
        { text: "No thanks.", type: "dialogue", tone: "dismissive" },
        { text: "*examine wares*", type: "action", tone: "careful" },
      ],
    );
    const farewell = makeResponse(
      "Safe travels, friend!",
      "warm",
      [],
      true, // ends conversation
    );

    let aiCallCount = 0;
    const aiClient = {
      generate: mock(async () => {
        aiCallCount++;
        return aiCallCount === 1 ? greeting : farewell;
      }),
      stream: mock(async function* () { yield ""; }),
      getModelForTask: mock(() => "test-model"),
    };

    // Panel auto-selects first option on the first showOptions call
    let speechCalls: string[] = [];
    let optionCallCount = 0;
    const panel = {
      showSpeech: mock(async (_n: string, text: string, _e: string) => {
        speechCalls.push(text);
      }),
      showOptions: mock(async (opts: DialogueOption[]) => {
        optionCallCount++;
        return { type: "option" as const, index: 0 }; // pick first option
      }),
      showThinking: mock(() => {}),
      showNarration: mock(() => {}),
      handleKey: mock(() => {}),
      clear: mock(() => {}),
      destroy: mock(() => {}),
      container: {} as unknown,
    };

    const router = {
      setMode: mock(() => {}),
      setDialogueHandler: mock(() => {}),
    };

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

    await manager.startConversation("merchant_1");

    // Verify flow
    expect(events).toEqual(["started", "ended"]);
    expect(speechCalls).toEqual([
      "Welcome, traveler! Looking to trade?",
      "Safe travels, friend!",
    ]);
    expect(optionCallCount).toBe(1); // only shown once (farewell ends conversation)
    expect(router.setMode).toHaveBeenCalledWith("dialogue");
    expect(router.setMode).toHaveBeenLastCalledWith("exploration");
  });

  test("freeform input flow", async () => {
    const character = makeCharacter("merchant_1");
    const worldState = makeWorldState([character]);
    const eventBus = new EventBus();

    const greeting = makeResponse(
      "What brings you here?",
      "curious",
      [{ text: "I'm looking for work.", type: "dialogue", tone: "earnest" }],
    );
    const customReply = makeResponse(
      "Ah, a treasure hunter! Interesting...",
      "intrigued",
      [],
      true,
    );

    let aiCallCount = 0;
    const aiClient = {
      generate: mock(async () => {
        aiCallCount++;
        return aiCallCount === 1 ? greeting : customReply;
      }),
      stream: mock(async function* () { yield ""; }),
      getModelForTask: mock(() => "test-model"),
    };

    const panel = {
      showSpeech: mock(async () => {}),
      showOptions: mock(async () => {
        // Simulate player typing custom response
        return { type: "freeform" as const, text: "I'm hunting for treasure in the caves." };
      }),
      showThinking: mock(() => {}),
      showNarration: mock(() => {}),
      handleKey: mock(() => {}),
      clear: mock(() => {}),
      destroy: mock(() => {}),
      container: {} as unknown,
    };

    const router = {
      setMode: mock(() => {}),
      setDialogueHandler: mock(() => {}),
    };

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

    await manager.startConversation("merchant_1");

    // Player turn should have the freeform text
    const playerTurn = capturedConversation!.turns.find((t) => t.speaker === "player");
    expect(playerTurn).toBeDefined();
    expect(playerTurn!.text).toBe("I'm hunting for treasure in the caves.");
  });

  test("character-initiated conversation end", async () => {
    const character = makeCharacter("merchant_1");
    const worldState = makeWorldState([character]);
    const eventBus = new EventBus();

    // Character ends conversation immediately
    const dismissal = makeResponse(
      "I'm too busy for this. Leave me be.",
      "irritated",
      [{ text: "But...", type: "dialogue", tone: "pleading" }],
      true, // character ends it
    );

    const aiClient = {
      generate: mock(async () => dismissal),
      stream: mock(async function* () { yield ""; }),
      getModelForTask: mock(() => "test-model"),
    };

    const panel = {
      showSpeech: mock(async () => {}),
      showOptions: mock(async () => ({ type: "option" as const, index: 0 })),
      showThinking: mock(() => {}),
      showNarration: mock(() => {}),
      handleKey: mock(() => {}),
      clear: mock(() => {}),
      destroy: mock(() => {}),
      container: {} as unknown,
    };

    const router = {
      setMode: mock(() => {}),
      setDialogueHandler: mock(() => {}),
    };

    let ended = false;
    eventBus.on("dialogue:ended", () => { ended = true; });

    const manager = new DialogueManager({
      aiClient: aiClient as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    await manager.startConversation("merchant_1");

    expect(ended).toBe(true);
    // showOptions should NOT have been called since conversation ended before options
    expect(panel.showOptions).not.toHaveBeenCalled();
  });
});
