import { describe, expect, mock, test } from "bun:test";
import type { GameEvent } from "../types.ts";
import { EventBus, EventQueue } from "./EventSystem.ts";
import { WorldClock } from "./WorldClock.ts";
import { WorldTicker, type TickContext, type TickEventProvider } from "./WorldTicker.ts";
import { Chronicle } from "../chronicle/Chronicle.ts";
import { WorldState } from "../world/WorldState.ts";

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

function makeTickContext(): TickContext {
  return {
    currentZone: {
      id: "zone_0_0",
      coords: { x: 0, y: 0 },
      biome: {
        type: "forest",
        terrain: { primary: "grass", secondary: "dirt", features: [] },
        palette: {
          ground: { chars: ["."], fg: ["green"], bg: "black" },
          vegetation: {},
        },
        density: { vegetation: 0.5, structures: 0.1, characters: 0.1 },
        ambient: { lighting: "natural" },
      },
      tiles: [],
      characters: [],
      buildings: [],
      objects: [],
      exits: [],
      generated: true,
      generationSeed: "test",
      lastVisited: Date.now(),
      metadata: { description: "A test zone" },
    },
    nearbyCharacters: [],
    timeOfDay: "morning",
    weather: { current: "clear", intensity: 0, duration: 0, startedAt: 0 },
    recentPlayerActions: [],
    activeNarrativeThreads: [],
  };
}

function makeTestEvent(overrides?: Partial<GameEvent>): GameEvent {
  return {
    id: `evt_test_${Math.random().toString(36).slice(2, 8)}`,
    type: "ambient",
    description: "A breeze rustles the leaves.",
    effects: [],
    chronicleEntry: "The wind stirred gently.",
    ...overrides,
  };
}

describe("WorldTicker", () => {
  // ── Timer Behavior ────────────────────────────────────────

  test("does not tick before interval elapses", async () => {
    const provider = { generateTickEvents: mock(() => Promise.resolve([])) };
    const ticker = new WorldTicker({ tickInterval: 10_000 });
    ticker.setProvider(provider);

    const events = await ticker.update(5000, makeTickContext);
    expect(events).toHaveLength(0);
    expect(provider.generateTickEvents).not.toHaveBeenCalled();
  });

  test("ticks when interval elapses", async () => {
    const testEvents = [makeTestEvent()];
    const provider = { generateTickEvents: mock(() => Promise.resolve(testEvents)) };
    const ticker = new WorldTicker({ tickInterval: 10_000 });
    ticker.setProvider(provider);

    const events = await ticker.update(10_000, makeTickContext);
    expect(events).toHaveLength(1);
    expect(events[0].description).toBe("A breeze rustles the leaves.");
    expect(provider.generateTickEvents).toHaveBeenCalledTimes(1);
  });

  test("timer resets after tick", async () => {
    const provider = { generateTickEvents: mock(() => Promise.resolve([])) };
    const ticker = new WorldTicker({ tickInterval: 10_000 });
    ticker.setProvider(provider);

    await ticker.update(10_000, makeTickContext); // triggers tick
    await ticker.update(5_000, makeTickContext); // should not tick

    expect(provider.generateTickEvents).toHaveBeenCalledTimes(1);
  });

  test("accumulates delta across updates", async () => {
    const provider = { generateTickEvents: mock(() => Promise.resolve([])) };
    const ticker = new WorldTicker({ tickInterval: 10_000 });
    ticker.setProvider(provider);

    await ticker.update(3000, makeTickContext);
    await ticker.update(3000, makeTickContext);
    await ticker.update(3000, makeTickContext);
    expect(provider.generateTickEvents).not.toHaveBeenCalled();

    await ticker.update(1000, makeTickContext); // total = 10000
    expect(provider.generateTickEvents).toHaveBeenCalledTimes(1);
  });

  // ── Provider ──────────────────────────────────────────────

  test("returns empty when no provider set", async () => {
    const ticker = new WorldTicker({ tickInterval: 100 });
    const events = await ticker.update(100, makeTickContext);
    expect(events).toHaveLength(0);
  });

  test("passes context to provider", async () => {
    const provider = { generateTickEvents: mock(() => Promise.resolve([])) };
    const ticker = new WorldTicker({ tickInterval: 100 });
    ticker.setProvider(provider);

    await ticker.update(100, makeTickContext);

    expect(provider.generateTickEvents).toHaveBeenCalledTimes(1);
    const ctx = provider.generateTickEvents.mock.calls[0][0] as TickContext;
    expect(ctx.timeOfDay).toBe("morning");
    expect(ctx.currentZone.id).toBe("zone_0_0");
  });

  // ── Prevent Concurrent Ticks ──────────────────────────────

  test("does not tick while already ticking", async () => {
    let resolveFirst: () => void;
    const firstTickPromise = new Promise<void>((r) => { resolveFirst = r; });

    const provider = {
      generateTickEvents: mock(async () => {
        await firstTickPromise;
        return [makeTestEvent()];
      }),
    };

    const ticker = new WorldTicker({ tickInterval: 100 });
    ticker.setProvider(provider);

    // Start first tick
    const firstResult = ticker.update(100, makeTickContext);
    expect(ticker.isTicking()).toBe(true);

    // Attempt second tick while first is in progress
    const secondResult = await ticker.update(100, makeTickContext);
    expect(secondResult).toHaveLength(0);

    // Resolve first tick
    resolveFirst!();
    const events = await firstResult;
    expect(events).toHaveLength(1);
  });

  // ── processTickEvents ─────────────────────────────────────

  test("processTickEvents applies effects and records chronicle entries", () => {
    const ticker = new WorldTicker();
    const worldState = createTestWorldState();
    const chronicle = new Chronicle();
    const eventQueue = new EventQueue();
    const eventBus = new EventBus();

    const triggeredHandler = mock(() => {});
    const tickHandler = mock(() => {});
    eventBus.on("event:triggered", triggeredHandler);
    eventBus.on("world:tick", tickHandler);

    const events = [
      makeTestEvent({
        effects: [{ type: "weather_change", weather: "rain", duration: 60000 }],
      }),
    ];

    ticker.processTickEvents(events, worldState, chronicle, eventQueue, eventBus);

    // Effect applied
    expect(worldState.weather.current).toBe("rain");

    // Chronicle entry created
    expect(chronicle.getEntries()).toHaveLength(1);
    expect(chronicle.getEntries()[0].type).toBe("event");

    // Events queued for further processing
    expect(eventQueue.getImmediateCount()).toBe(1);

    // Bus events emitted
    expect(triggeredHandler).toHaveBeenCalledTimes(1);
    expect(tickHandler).toHaveBeenCalledTimes(1);
  });

  test("processTickEvents does not emit world:tick for empty events", () => {
    const ticker = new WorldTicker();
    const worldState = createTestWorldState();
    const chronicle = new Chronicle();
    const eventQueue = new EventQueue();
    const eventBus = new EventBus();

    const tickHandler = mock(() => {});
    eventBus.on("world:tick", tickHandler);

    ticker.processTickEvents([], worldState, chronicle, eventQueue, eventBus);

    expect(tickHandler).not.toHaveBeenCalled();
  });

  // ── Utility Methods ───────────────────────────────────────

  test("getTimeUntilNextTick returns remaining time", async () => {
    const ticker = new WorldTicker({ tickInterval: 10_000 });
    expect(ticker.getTimeUntilNextTick()).toBe(10_000);

    await ticker.update(3000, makeTickContext);
    expect(ticker.getTimeUntilNextTick()).toBe(7000);
  });

  test("reset restores timer to full interval", async () => {
    const ticker = new WorldTicker({ tickInterval: 10_000 });
    await ticker.update(5000, makeTickContext);
    expect(ticker.getTimeUntilNextTick()).toBe(5000);

    ticker.reset();
    expect(ticker.getTimeUntilNextTick()).toBe(10_000);
  });

  test("uses default 5-minute interval", () => {
    const ticker = new WorldTicker();
    expect(ticker.getTimeUntilNextTick()).toBe(300_000);
  });
});
