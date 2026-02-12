import { describe, expect, mock, test } from "bun:test";
import type { ConversationState, DeferredEvent, GameEvent } from "../types.ts";
import { EventBus, EventQueue, ConsequenceEvaluator, type ConsequenceProvider, type ConsequenceResult } from "./EventSystem.ts";
import { Chronicle } from "../chronicle/Chronicle.ts";
import { WorldState } from "../world/WorldState.ts";

describe("EventBus", () => {
  test("on + emit calls handler with data", () => {
    const bus = new EventBus();
    const handler = mock(() => {});

    bus.on("zone:entered", handler);
    bus.emit("zone:entered", { zoneId: "zone_0_0" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ zoneId: "zone_0_0" });
  });

  test("multiple handlers are called", () => {
    const bus = new EventBus();
    const handler1 = mock(() => {});
    const handler2 = mock(() => {});

    bus.on("player:moved", handler1);
    bus.on("player:moved", handler2);
    bus.emit("player:moved", { position: { x: 5, y: 5 }, zone: "zone_0_0" });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  test("off removes handler", () => {
    const bus = new EventBus();
    const handler = mock(() => {});

    bus.on("zone:entered", handler);
    bus.off("zone:entered", handler);
    bus.emit("zone:entered", { zoneId: "zone_0_0" });

    expect(handler).not.toHaveBeenCalled();
  });

  test("off only removes the specified handler", () => {
    const bus = new EventBus();
    const handler1 = mock(() => {});
    const handler2 = mock(() => {});

    bus.on("zone:entered", handler1);
    bus.on("zone:entered", handler2);
    bus.off("zone:entered", handler1);
    bus.emit("zone:entered", { zoneId: "zone_0_0" });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  test("emit with no listeners does nothing", () => {
    const bus = new EventBus();
    // Should not throw
    bus.emit("zone:entered", { zoneId: "zone_0_0" });
  });

  test("different events are independent", () => {
    const bus = new EventBus();
    const zoneHandler = mock(() => {});
    const moveHandler = mock(() => {});

    bus.on("zone:entered", zoneHandler);
    bus.on("player:moved", moveHandler);

    bus.emit("zone:entered", { zoneId: "zone_0_0" });

    expect(zoneHandler).toHaveBeenCalledTimes(1);
    expect(moveHandler).not.toHaveBeenCalled();
  });

  test("listenerCount returns correct count", () => {
    const bus = new EventBus();
    expect(bus.listenerCount("zone:entered")).toBe(0);

    const handler = () => {};
    bus.on("zone:entered", handler);
    expect(bus.listenerCount("zone:entered")).toBe(1);

    bus.on("zone:entered", () => {});
    expect(bus.listenerCount("zone:entered")).toBe(2);

    bus.off("zone:entered", handler);
    expect(bus.listenerCount("zone:entered")).toBe(1);
  });

  test("removeAllListeners for specific event", () => {
    const bus = new EventBus();
    const handler1 = mock(() => {});
    const handler2 = mock(() => {});
    const otherHandler = mock(() => {});

    bus.on("zone:entered", handler1);
    bus.on("zone:entered", handler2);
    bus.on("player:moved", otherHandler);

    bus.removeAllListeners("zone:entered");
    bus.emit("zone:entered", { zoneId: "zone_0_0" });
    bus.emit("player:moved", { position: { x: 0, y: 0 }, zone: "zone_0_0" });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
    expect(otherHandler).toHaveBeenCalledTimes(1);
  });

  test("removeAllListeners with no argument clears everything", () => {
    const bus = new EventBus();
    const handler1 = mock(() => {});
    const handler2 = mock(() => {});

    bus.on("zone:entered", handler1);
    bus.on("player:moved", handler2);

    bus.removeAllListeners();
    bus.emit("zone:entered", { zoneId: "zone_0_0" });
    bus.emit("player:moved", { position: { x: 0, y: 0 }, zone: "zone_0_0" });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  test("handler receives correct data shape", () => {
    const bus = new EventBus();
    const results: Array<{ from: string; to: string }> = [];

    bus.on("mode:changed", (data) => {
      results.push(data);
    });

    bus.emit("mode:changed", { from: "exploration", to: "dialogue" });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ from: "exploration", to: "dialogue" });
  });
});

// ── Test Helpers ────────────────────────────────────────────

function makeTestEvent(overrides?: Partial<GameEvent>): GameEvent {
  return {
    id: `evt_${Math.random().toString(36).slice(2, 8)}`,
    type: "ambient",
    description: "A breeze rustles the leaves.",
    effects: [],
    chronicleEntry: "The wind stirred gently.",
    ...overrides,
  };
}

function makeDeferred(overrides?: Partial<DeferredEvent>): DeferredEvent {
  return {
    event: makeTestEvent(),
    triggerCondition: "player enters tavern",
    createdAt: 0,
    ...overrides,
  };
}

function createTestWorldState(): WorldState {
  return new WorldState({
    worldId: "test-world",
    worldSeed: {
      originalPrompt: "test",
      setting: { name: "Test", type: "test", era: "test", tone: "test", description: "test" },
      biomeMap: {
        center: {
          type: "forest",
          terrain: { primary: "grass", secondary: "dirt", features: [] },
          palette: {
            ground: { chars: ["."], fg: ["green"], bg: "black" },
            vegetation: {},
          },
          density: { vegetation: 0.5, structures: 0.1, characters: 0.1 },
          ambient: { lighting: "natural" },
        },
        distribution: { type: "radial", seed: 42, biomes: {} },
      },
      initialNarrative: { hooks: [], mainTension: "test", atmosphere: "calm" },
      worldRules: { hasMagic: false, techLevel: "medieval", economy: "barter", dangers: [], customs: [] },
    },
    createdAt: Date.now(),
    player: {
      position: { zone: "zone_0_0", x: 5, y: 5 },
      facing: "down",
      inventory: [],
      journal: { entries: [], knownCharacters: [], discoveredZones: [], activeQuests: [] },
      stats: { totalPlayTime: 0, conversationsHad: 0, zonesExplored: 1, daysSurvived: 1 },
    },
    activeZoneId: "zone_0_0",
  });
}

// ── EventQueue Tests ────────────────────────────────────────

describe("EventQueue", () => {
  test("queueImmediate and drainImmediate", () => {
    const queue = new EventQueue();
    const event1 = makeTestEvent({ id: "e1" });
    const event2 = makeTestEvent({ id: "e2" });

    queue.queueImmediate(event1);
    queue.queueImmediate(event2);
    expect(queue.getImmediateCount()).toBe(2);

    const drained = queue.drainImmediate();
    expect(drained).toHaveLength(2);
    expect(drained[0].id).toBe("e1");
    expect(drained[1].id).toBe("e2");
    expect(queue.getImmediateCount()).toBe(0);
  });

  test("drainImmediate returns empty array when queue is empty", () => {
    const queue = new EventQueue();
    expect(queue.drainImmediate()).toHaveLength(0);
  });

  test("queueDeferred stores deferred events", () => {
    const queue = new EventQueue();
    queue.queueDeferred(makeDeferred());
    queue.queueDeferred(makeDeferred({ triggerCondition: "dawn arrives" }));

    expect(queue.getDeferredCount()).toBe(2);
    expect(queue.getDeferredEvents()).toHaveLength(2);
  });

  test("checkDeferred triggers events when condition met", () => {
    const queue = new EventQueue();
    const tavern = makeDeferred({ triggerCondition: "player enters tavern" });
    const dawn = makeDeferred({ triggerCondition: "dawn arrives" });

    queue.queueDeferred(tavern);
    queue.queueDeferred(dawn);

    const checker = (condition: string) => condition === "dawn arrives";
    const triggered = queue.checkDeferred(checker);

    expect(triggered).toHaveLength(1);
    expect(triggered[0].id).toBe(dawn.event.id);
    expect(queue.getDeferredCount()).toBe(1);
    expect(queue.getDeferredEvents()[0].triggerCondition).toBe("player enters tavern");
  });

  test("checkDeferred returns empty when no conditions met", () => {
    const queue = new EventQueue();
    queue.queueDeferred(makeDeferred());

    const triggered = queue.checkDeferred(() => false);
    expect(triggered).toHaveLength(0);
    expect(queue.getDeferredCount()).toBe(1);
  });

  test("checkDeferred triggers multiple events", () => {
    const queue = new EventQueue();
    queue.queueDeferred(makeDeferred({ triggerCondition: "dawn" }));
    queue.queueDeferred(makeDeferred({ triggerCondition: "dusk" }));
    queue.queueDeferred(makeDeferred({ triggerCondition: "dawn" }));

    const triggered = queue.checkDeferred((c) => c === "dawn");
    expect(triggered).toHaveLength(2);
    expect(queue.getDeferredCount()).toBe(1);
  });

  test("clear empties both queues", () => {
    const queue = new EventQueue();
    queue.queueImmediate(makeTestEvent());
    queue.queueDeferred(makeDeferred());

    queue.clear();
    expect(queue.getImmediateCount()).toBe(0);
    expect(queue.getDeferredCount()).toBe(0);
  });
});

// ── ConsequenceEvaluator Tests ──────────────────────────────

describe("ConsequenceEvaluator", () => {
  function makeConversation(): ConversationState {
    return {
      characterId: "char_tavern_keeper",
      turns: [
        { speaker: "character", text: "Welcome to the tavern!", type: "dialogue", timestamp: 1000 },
        { speaker: "player", text: "Tell me about the village.", type: "dialogue", timestamp: 2000 },
      ],
      startedAt: 1000,
      mood: "neutral",
      topicsDiscussed: ["village"],
      isActive: false,
    };
  }

  function makeMockProvider(result: ConsequenceResult): ConsequenceProvider {
    return {
      evaluate: mock(() => Promise.resolve(result)),
    };
  }

  test("returns null when no provider set", async () => {
    const evaluator = new ConsequenceEvaluator();
    const worldState = createTestWorldState();
    const chronicle = new Chronicle();
    const eventQueue = new EventQueue();
    const eventBus = new EventBus();

    const result = await evaluator.evaluate(
      makeConversation(), worldState, chronicle, eventQueue, eventBus,
    );
    expect(result).toBeNull();
  });

  test("creates chronicle entry from consequence result", async () => {
    const evaluator = new ConsequenceEvaluator();
    const provider = makeMockProvider({
      characterStateChanges: [],
      deferredEvents: [],
      chronicleEntry: "The player chatted with the tavern keeper about the village.",
      narrativeThreads: [],
    });
    evaluator.setProvider(provider);

    const worldState = createTestWorldState();
    const chronicle = new Chronicle();
    const eventQueue = new EventQueue();
    const eventBus = new EventBus();

    await evaluator.evaluate(
      makeConversation(), worldState, chronicle, eventQueue, eventBus,
    );

    const entries = chronicle.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("conversation");
    expect(entries[0].summary).toBe("The player chatted with the tavern keeper about the village.");
    expect(entries[0].characters).toContain("char_tavern_keeper");
  });

  test("applies character mood changes", async () => {
    const evaluator = new ConsequenceEvaluator();
    const provider = makeMockProvider({
      characterStateChanges: [{
        characterId: "char_keeper",
        moodChange: "cheerful",
        memoryAdded: "Player asked about the village.",
      }],
      deferredEvents: [],
      chronicleEntry: "A friendly conversation.",
      narrativeThreads: [],
    });
    evaluator.setProvider(provider);

    const worldState = createTestWorldState();
    // Add a character to the world state
    worldState.characters.set("char_keeper", {
      id: "char_keeper",
      worldId: "test-world",
      identity: { name: "Keeper", age: "40", role: "tavern keeper", personality: ["friendly"], backstory: "test", speechPattern: "gruff", secrets: [] },
      visual: { display: { char: "K", fg: "yellow" }, nameplate: "Keeper" },
      state: { currentZone: "zone_0_0", position: { x: 3, y: 3 }, facing: "down", mood: "neutral", currentActivity: "tending bar", health: "good", goals: [] },
      behavior: { type: "stationary", params: {} },
      memory: { personalExperiences: [], heardRumors: [], playerRelationship: { trust: 0, familiarity: 0, impressions: [] } },
      relationships: new Map(),
    });

    const chronicle = new Chronicle();
    const eventQueue = new EventQueue();
    const eventBus = new EventBus();

    await evaluator.evaluate(
      makeConversation(), worldState, chronicle, eventQueue, eventBus,
    );

    expect(worldState.characters.get("char_keeper")!.state.mood).toBe("cheerful");
  });

  test("queues deferred events from consequences", async () => {
    const evaluator = new ConsequenceEvaluator();
    const provider = makeMockProvider({
      characterStateChanges: [],
      deferredEvents: [{
        description: "The keeper sends word to the village elder.",
        triggerCondition: "player enters village square",
        effects: ["village elder approaches player"],
      }],
      chronicleEntry: "A fateful conversation.",
      narrativeThreads: [],
    });
    evaluator.setProvider(provider);

    const worldState = createTestWorldState();
    const chronicle = new Chronicle();
    const eventQueue = new EventQueue();
    const eventBus = new EventBus();

    await evaluator.evaluate(
      makeConversation(), worldState, chronicle, eventQueue, eventBus,
    );

    expect(eventQueue.getDeferredCount()).toBe(1);
    const deferred = eventQueue.getDeferredEvents()[0];
    expect(deferred.triggerCondition).toBe("player enters village square");
    expect(deferred.event.description).toBe("The keeper sends word to the village elder.");
  });

  test("creates and updates narrative threads", async () => {
    const evaluator = new ConsequenceEvaluator();
    const provider = makeMockProvider({
      characterStateChanges: [],
      deferredEvents: [],
      chronicleEntry: "A mysterious hint was dropped.",
      narrativeThreads: ["village_mystery", "keeper_trust"],
    });
    evaluator.setProvider(provider);

    const worldState = createTestWorldState();
    const chronicle = new Chronicle();
    const eventQueue = new EventQueue();
    const eventBus = new EventBus();

    await evaluator.evaluate(
      makeConversation(), worldState, chronicle, eventQueue, eventBus,
    );

    expect(chronicle.getThread("village_mystery")).toBeDefined();
    expect(chronicle.getThread("keeper_trust")).toBeDefined();
  });

  test("emits chronicle:entry on event bus", async () => {
    const evaluator = new ConsequenceEvaluator();
    const provider = makeMockProvider({
      characterStateChanges: [],
      deferredEvents: [],
      chronicleEntry: "A short chat.",
      narrativeThreads: [],
    });
    evaluator.setProvider(provider);

    const worldState = createTestWorldState();
    const chronicle = new Chronicle();
    const eventQueue = new EventQueue();
    const eventBus = new EventBus();
    const handler = mock(() => {});
    eventBus.on("chronicle:entry", handler);

    await evaluator.evaluate(
      makeConversation(), worldState, chronicle, eventQueue, eventBus,
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
