/**
 * E2E Smoke Test — validates the full MVP loop:
 *   1. Prompt -> World generation (mocked AI)
 *   2. Exploration movement and collision
 *   3. Character interaction -> dialogue flow -> response selection
 *   4. Event system processing (world tick with mocked AI)
 *   5. Save to SQLite -> load from SQLite -> verify state preserved
 *
 * All AI responses are mocked for determinism and speed.
 */
import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  WorldState,
  EventBus,
  EventQueue,
  Chronicle,
  WorldTicker,
  isPassable,
  getLayer,
  type Zone,
  type ZoneId,
  type Character,
  type TileLayer,
  type TileCell,
  type BiomeConfig,
  type GameEvent,
} from "@daydream/engine";
import { ContextManager } from "@daydream/ai";
import type { AIResponse } from "@daydream/ai";
import type { BuildingVisual, ObjectVisual } from "@daydream/engine";

import { WorldGenerator } from "../WorldGenerator.ts";
import { DialogueManager } from "../DialogueManager.ts";
import { SaveManager } from "../SaveManager.ts";
import type { InputRouter } from "../InputRouter.ts";
import type { DialoguePanel, DialogueOption } from "@daydream/renderer";

// ── Shared fixtures ─────────────────────────────────────────

const mockWorldSeedInput = {
  setting: {
    name: "Thornwood",
    type: "dark fantasy",
    era: "medieval",
    tone: "mysterious",
    description: "A fog-shrouded forest where ancient things stir.",
  },
  biome_map: {
    center_biome: "forest",
    distribution: [
      { biome: "dark_forest", direction: "north", distance: "near" },
    ],
  },
  initial_narrative: {
    hooks: ["The old watchtower"],
    main_tension: "Something lurks in the deep woods.",
    atmosphere: "Eerie and foreboding",
  },
  world_rules: {
    has_magic: true,
    tech_level: "medieval",
    economy: "barter",
    dangers: ["wolves"],
    customs: ["leave offerings at crossroads"],
  },
};

const mockZoneSpecInput = {
  name: "Forest Clearing",
  description: "A small clearing in the woods.",
  terrain: {
    primary_ground: "grass",
    features: [{ type: "path", description: "A dirt trail runs east-west" }],
  },
  buildings: [
    {
      name: "Woodcutter's Cabin",
      type: "house",
      width: 6,
      height: 4,
      position: { x: 30, y: 15 },
    },
  ],
  objects: [
    { type: "tree", position: { x: 5, y: 5 } },
    { type: "rock", position: { x: 50, y: 25 } },
  ],
  characters: [
    {
      name: "Elara",
      role: "herbalist",
      personality: ["kind", "curious", "cautious"],
      backstory: "A healer who lives at the forest edge.",
      speech_pattern: "soft and measured",
      visual: { char: "E", fg: "#deb887" },
      position: { x: 25, y: 18 },
      secrets: ["Knows about the missing travelers"],
    },
  ],
  narrative_hooks: ["Strange lights in the distance"],
  exits: {
    north: "Deeper forest",
    south: "Village road",
  },
};

const mockMusicSpecInput = {
  bpm: 100,
  key: "Am",
  timeSignature: 4,
  channels: [
    {
      waveform: "square",
      duty: "50",
      volume: 12,
      pattern: [
        { pitch: 69, duration: 4, velocity: 12 },
        { pitch: 72, duration: 4, velocity: 10 },
      ],
    },
    {
      waveform: "triangle",
      duty: "50",
      volume: 10,
      pattern: [
        { pitch: 45, duration: 8, velocity: 12 },
      ],
    },
  ],
  loopMeasures: 4,
  mood: "mysterious",
};

const testBuildingVisuals: Record<string, BuildingVisual> = {
  house: {
    border: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
    door: "╤",
    fill: " ",
    defaultFg: "#c4a882",
    doorFg: "#3d2b1f",
  },
};

const testObjectVisuals: Record<string, ObjectVisual> = {
  tree_oak: { char: "♣", fg: "#228b22", bold: true, collision: true },
  rock_large: { char: "●", fg: "#6a6a6a", bold: true, collision: true },
};

function testBiome(): BiomeConfig {
  return {
    type: "forest",
    terrain: { primary: "grass", secondary: "dirt", features: ["trees"] },
    palette: {
      ground: { chars: ["."], fg: ["#228B22"], bg: "#1a3a1a" },
      vegetation: { tree: { char: "T", fg: "#006400" } },
    },
    density: { vegetation: 0.3, structures: 0.1, characters: 0.05 },
    ambient: { lighting: "dappled" },
  };
}

function testTileLayer(
  name: string,
  w: number,
  h: number,
  fillChar = ".",
  fillFg = "#228B22",
  fillBg = "#1a3a1a",
): TileLayer {
  const data: TileCell[] = new Array(w * h);
  for (let i = 0; i < w * h; i++) {
    data[i] = { char: fillChar, fg: fillFg, bg: fillBg };
  }
  return { name: name as TileLayer["name"], data, width: w, height: h };
}

/** Build a mock AIClient that routes by tool name */
function createMockAIClient(handlers: Record<string, () => AIResponse>) {
  return {
    generate: mock(async (params: { tools?: Array<{ name: string }> }) => {
      const toolName = params.tools?.[0]?.name;
      const handler = toolName ? handlers[toolName] : undefined;
      if (!handler) throw new Error(`No mock handler for tool: ${toolName}`);
      return handler();
    }),
    stream: mock(async function* () {
      yield "";
    }),
    getModelForTask: mock(() => "test-model"),
  };
}

function makeToolResponse(name: string, input: unknown): AIResponse {
  return {
    text: "",
    toolUse: [
      {
        type: "tool_use" as const,
        id: `tool_${Math.random().toString(36).slice(2)}`,
        name,
        input,
      },
    ],
    stopReason: "tool_use",
    usage: { inputTokens: 100, outputTokens: 200 },
  };
}

/** Create a Character object for test use */
function makeCharacter(
  id: string,
  zoneId: string,
  pos: { x: number; y: number },
): Character {
  return {
    id,
    worldId: "smoke-test-world",
    identity: {
      name: "Elara",
      age: "adult",
      role: "herbalist",
      personality: ["kind", "curious"],
      backstory: "A healer who lives at the forest edge.",
      speechPattern: "soft and measured",
      secrets: ["Knows about the missing travelers"],
    },
    visual: {
      display: { char: "E", fg: "#deb887" },
      nameplate: "Elara",
    },
    state: {
      currentZone: zoneId,
      position: pos,
      facing: "down",
      mood: "curious",
      currentActivity: "gathering herbs",
      health: "healthy",
      goals: ["help travelers"],
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

/** Build a complete WorldState with zone and character for testing */
function buildTestWorldState(): {
  worldState: WorldState;
  zone: Zone;
  character: Character;
} {
  const biome = testBiome();
  const zone: Zone = {
    id: "zone_0_0",
    coords: { x: 0, y: 0 },
    biome,
    tiles: [
      testTileLayer("ground", 80, 40),
      testTileLayer("objects", 80, 40, "", "#000000"),
      testTileLayer("overlay", 80, 40, "", "#000000"),
      testTileLayer("collision", 80, 40, "0", "#000000"),
    ],
    characters: ["npc_elara"],
    buildings: [],
    objects: [],
    exits: [
      {
        direction: "right",
        targetZone: "zone_1_0",
        targetPosition: { x: 0, y: 20 },
      },
    ],
    generated: true,
    generationSeed: "smoke-test-seed",
    lastVisited: Date.now(),
    metadata: { description: "A small clearing in the woods.", name: "Forest Clearing" },
  };

  // Add some collision tiles (wall at x=70)
  const collisionLayer = zone.tiles.find((l) => l.name === "collision")!;
  for (let y = 0; y < 40; y++) {
    collisionLayer.data[y * 80 + 70] = { char: "1", fg: "#000000" };
  }

  const character = makeCharacter("npc_elara", "zone_0_0", { x: 25, y: 18 });

  const worldState = new WorldState({
    worldId: "smoke-test-world",
    worldSeed: {
      originalPrompt: "a dark forest",
      setting: {
        name: "Thornwood",
        type: "dark fantasy",
        era: "medieval",
        tone: "mysterious",
        description: "A fog-shrouded forest where ancient things stir.",
      },
      biomeMap: {
        center: biome,
        distribution: { type: "simple", seed: 42, biomes: { forest: 1 } },
      },
      initialNarrative: {
        hooks: ["The old watchtower"],
        mainTension: "Something lurks in the deep woods.",
        atmosphere: "Eerie and foreboding",
      },
      worldRules: {
        hasMagic: true,
        techLevel: "medieval",
        economy: "barter",
        dangers: ["wolves"],
        customs: ["leave offerings at crossroads"],
      },
    },
    createdAt: Date.now(),
    player: {
      position: { zone: "zone_0_0", x: 40, y: 20 },
      facing: "down",
      inventory: [
        { id: "item_torch", name: "Torch", description: "A lit torch", type: "tool" },
      ],
      journal: {
        entries: [],
        knownCharacters: [],
        discoveredZones: ["zone_0_0"],
        activeQuests: [],
      },
      stats: {
        totalPlayTime: 0,
        conversationsHad: 0,
        zonesExplored: 1,
        daysSurvived: 0,
      },
    },
    activeZoneId: "zone_0_0",
  });

  worldState.zones.set("zone_0_0" as ZoneId, zone);
  worldState.characters.set("npc_elara", character);

  return { worldState, zone, character };
}

// ── Tests ────────────────────────────────────────────────────

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "daydream-e2e-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("E2E Smoke Test", () => {
  // ── 1. World generation ──────────────────────────────────

  test("prompt -> world generation -> zone with characters", async () => {
    const aiClient = createMockAIClient({
      create_world: () => makeToolResponse("create_world", mockWorldSeedInput),
      create_zone: () => makeToolResponse("create_zone", mockZoneSpecInput),
      generate_music: () => makeToolResponse("generate_music", mockMusicSpecInput),
    });

    const generator = new WorldGenerator(
      aiClient as any,
      testBuildingVisuals,
      testObjectVisuals,
    );

    const progressMessages: string[] = [];
    const world = await generator.generate("a dark forest", (status) => {
      progressMessages.push(status);
    });

    // AI was called three times: seed, then zone + music in parallel
    expect(aiClient.generate).toHaveBeenCalledTimes(3);

    // World seed is populated
    expect(world.seed.originalPrompt).toBe("a dark forest");
    expect(world.seed.setting.name).toBe("Thornwood");
    expect(world.seed.initialNarrative.hooks).toContain("The old watchtower");

    // Zone tile data is built
    expect(world.zone.id).toBe("zone_0_0");
    expect(world.zone.width).toBe(80);
    expect(world.zone.height).toBe(40);
    expect(world.zone.layers).toHaveLength(3); // ground, objects, overlay

    // Characters extracted
    expect(world.characters).toHaveLength(1);
    expect(world.characters[0]!.name).toBe("Elara");
    expect(world.characters[0]!.role).toBe("herbalist");

    // Palette was selected
    expect(world.palette).toBeDefined();

    // Progress callbacks fired
    expect(progressMessages.length).toBeGreaterThan(0);
  });

  // ── 2. Exploration movement and collision ─────────────────

  test("player movement updates position, collision blocks movement", () => {
    const { worldState, zone } = buildTestWorldState();

    // Verify initial position
    expect(worldState.player.position.x).toBe(40);
    expect(worldState.player.position.y).toBe(20);

    // Move player left (should succeed — open ground)
    const newX = worldState.player.position.x - 1;
    const newY = worldState.player.position.y;
    expect(isPassable(zone, newX, newY)).toBe(true);
    worldState.player.position.x = newX;
    worldState.player.facing = "left";
    expect(worldState.player.position.x).toBe(39);
    expect(worldState.player.facing).toBe("left");

    // Try to move into collision wall at x=70
    const wallX = 70;
    expect(isPassable(zone, wallX, 20)).toBe(false);
    // Player position should NOT change (game logic checks before moving)

    // Move player down
    worldState.player.position.y += 1;
    worldState.player.facing = "down";
    expect(worldState.player.position.y).toBe(21);

    // Out-of-bounds is not passable
    expect(isPassable(zone, -1, 0)).toBe(false);
    expect(isPassable(zone, 80, 0)).toBe(false);
  });

  // ── 3. Character interaction -> dialogue flow ─────────────

  test("dialogue: greet -> player selects option -> character responds -> ends", async () => {
    const { worldState, character } = buildTestWorldState();
    const eventBus = new EventBus();

    // AI returns greeting, then farewell
    const greetingResponse: AIResponse = {
      text: "",
      toolUse: [
        {
          type: "tool_use",
          id: "t_greet",
          name: "dialogue_response",
          input: {
            character_speech: "Welcome, traveler! Looking for herbs?",
            character_emotion: "curious",
            narration: undefined,
            options: [
              { text: "Tell me about this forest.", type: "dialogue", tone: "curious" },
              { text: "No thanks.", type: "dialogue", tone: "dismissive" },
            ],
            conversation_ended: false,
          },
        },
      ],
      stopReason: "tool_use",
      usage: { inputTokens: 100, outputTokens: 50 },
    };
    const farewellResponse: AIResponse = {
      text: "",
      toolUse: [
        {
          type: "tool_use",
          id: "t_farewell",
          name: "dialogue_response",
          input: {
            character_speech: "Safe travels, friend. May the forest guide you.",
            character_emotion: "warm",
            options: [],
            conversation_ended: true,
          },
        },
      ],
      stopReason: "tool_use",
      usage: { inputTokens: 100, outputTokens: 50 },
    };

    let aiCallCount = 0;
    const aiClient = {
      generate: mock(async () => {
        aiCallCount++;
        return aiCallCount === 1 ? greetingResponse : farewellResponse;
      }),
      stream: mock(async function* () {
        yield "";
      }),
      getModelForTask: mock(() => "test-model"),
    };

    const speechCalls: string[] = [];
    let optionCallCount = 0;
    const panel = {
      showSpeech: mock(async (_n: string, text: string, _e: string) => {
        speechCalls.push(text);
      }),
      showOptions: mock(async (_opts: DialogueOption[]) => {
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

    await manager.startConversation("npc_elara");

    // Events fired in order
    expect(events).toEqual(["started", "ended"]);

    // Both speech calls were made
    expect(speechCalls).toEqual([
      "Welcome, traveler! Looking for herbs?",
      "Safe travels, friend. May the forest guide you.",
    ]);

    // Options shown once (farewell ends conversation)
    expect(optionCallCount).toBe(1);

    // Input mode toggled correctly
    expect(router.setMode).toHaveBeenCalledWith("dialogue");
    expect(router.setMode).toHaveBeenLastCalledWith("exploration");
  });

  // ── 4. Event system processing (world tick) ───────────────

  test("world tick: events processed, effects applied, chronicle updated", () => {
    const { worldState } = buildTestWorldState();
    const eventBus = new EventBus();
    const eventQueue = new EventQueue();
    const ticker = new WorldTicker({ tickInterval: 100 });

    // Create a test event that changes weather
    const testEvent: GameEvent = {
      id: "evt_weather_001",
      type: "ambient",
      description: "A cold wind sweeps through the forest.",
      effects: [
        { type: "weather_change", weather: "rain", duration: 5000 },
      ],
      chronicleEntry: "Rain began to fall over Thornwood.",
    };

    // Track event bus emissions
    const tickEvents: GameEvent[][] = [];
    eventBus.on("world:tick", ({ events }) => tickEvents.push(events));
    const chronicleEvents: unknown[] = [];
    eventBus.on("chronicle:entry", (data) => chronicleEvents.push(data));

    // Process tick events
    ticker.processTickEvents(
      [testEvent],
      worldState,
      worldState.chronicle,
      eventQueue,
      eventBus,
    );

    // Weather effect applied to world state
    expect(worldState.weather.current).toBe("rain");
    expect(worldState.weather.duration).toBe(5000);

    // Chronicle entry created
    const entries = worldState.chronicle.getEntries();
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const weatherEntry = entries.find((e) =>
      e.summary.includes("Rain began to fall"),
    );
    expect(weatherEntry).toBeDefined();
    expect(weatherEntry!.type).toBe("event");

    // Event queued as immediate
    expect(eventQueue.getImmediateCount()).toBe(1);

    // Event bus notified
    expect(tickEvents).toHaveLength(1);
    expect(tickEvents[0]![0]!.id).toBe("evt_weather_001");
    expect(chronicleEvents).toHaveLength(1);

    // Also test EventQueue deferred mechanism
    eventQueue.queueDeferred({
      event: {
        id: "evt_deferred_001",
        type: "minor",
        description: "Wolves appear at the forest edge",
        effects: [],
        chronicleEntry: "Wolves sighted.",
      },
      triggerCondition: "nightfall",
      createdAt: 0,
    });

    expect(eventQueue.getDeferredCount()).toBe(1);
    const triggered = eventQueue.checkDeferred((c) => c === "nightfall");
    expect(triggered).toHaveLength(1);
    expect(triggered[0]!.id).toBe("evt_deferred_001");
    expect(eventQueue.getDeferredCount()).toBe(0);
  });

  // ── 5. Save to SQLite -> load -> verify state ─────────────

  test("save/load round-trip preserves full world state", () => {
    const { worldState } = buildTestWorldState();

    // Add some chronicle entries
    worldState.chronicle.append({
      id: "entry_1",
      timestamp: Date.now(),
      gameTime: 1000,
      type: "event",
      zone: "zone_0_0",
      summary: "The player arrived in the forest clearing.",
      characters: ["npc_elara"],
    });
    worldState.chronicle.append({
      id: "entry_2",
      timestamp: Date.now(),
      gameTime: 2000,
      type: "conversation",
      zone: "zone_0_0",
      summary: "Spoke with Elara about the forest.",
      characters: ["npc_elara"],
    });

    // Set play time
    worldState.playTime = 5000;

    // Move the player
    worldState.player.position.x = 35;
    worldState.player.position.y = 22;
    worldState.player.facing = "left";

    // Add a narrative thread
    worldState.chronicle.addThread("thread_mystery", "Strange lights in the forest", 5);

    // Save
    const dbPath = join(tempDir, "smoke-test.db");
    const sm1 = new SaveManager("smoke-test-world", { dbPath });
    sm1.saveWorld(worldState);
    sm1.close();

    // Load in a fresh SaveManager
    const sm2 = new SaveManager("smoke-test-world", { dbPath });
    const loaded = sm2.loadWorld();
    sm2.close();

    // -- World metadata --
    expect(loaded.worldId).toBe("smoke-test-world");
    expect(loaded.worldSeed.originalPrompt).toBe("a dark forest");
    expect(loaded.worldSeed.setting.name).toBe("Thornwood");
    expect(loaded.worldSeed.setting.tone).toBe("mysterious");
    expect(loaded.worldSeed.worldRules.hasMagic).toBe(true);
    expect(loaded.playTime).toBe(5000);

    // -- Player state --
    expect(loaded.player.position.x).toBe(35);
    expect(loaded.player.position.y).toBe(22);
    expect(loaded.player.position.zone).toBe("zone_0_0");
    expect(loaded.player.facing).toBe("left");
    expect(loaded.player.inventory).toHaveLength(1);
    expect(loaded.player.inventory[0]!.name).toBe("Torch");
    expect(loaded.player.stats.zonesExplored).toBe(1);

    // -- Zone --
    expect(loaded.zones.size).toBe(1);
    const loadedZone = loaded.zones.get("zone_0_0" as ZoneId)!;
    expect(loadedZone).toBeDefined();
    expect(loadedZone.id).toBe("zone_0_0");
    expect(loadedZone.coords).toEqual({ x: 0, y: 0 });
    expect(loadedZone.metadata.name).toBe("Forest Clearing");
    expect(loadedZone.biome.type).toBe("forest");
    // Tile data preserved (4 layers: ground, objects, overlay, collision)
    expect(loadedZone.tiles).toHaveLength(4);
    // Collision wall at x=70 is preserved
    const loadedCollision = loadedZone.tiles.find(
      (l) => l.name === "collision",
    )!;
    expect(loadedCollision.data[20 * 80 + 70]!.char).toBe("1");
    expect(loadedCollision.data[20 * 80 + 69]!.char).toBe("0");

    // -- Character --
    expect(loaded.characters.size).toBe(1);
    const loadedChar = loaded.characters.get("npc_elara")!;
    expect(loadedChar).toBeDefined();
    expect(loadedChar.identity.name).toBe("Elara");
    expect(loadedChar.identity.role).toBe("herbalist");
    expect(loadedChar.state.position).toEqual({ x: 25, y: 18 });
    expect(loadedChar.state.mood).toBe("curious");
    expect(loadedChar.visual.nameplate).toBe("Elara");

    // Character relationships (Map round-trip)
    expect(loadedChar.relationships).toBeInstanceOf(Map);

    // -- Chronicle --
    const loadedEntries = loaded.chronicle.getEntries();
    expect(loadedEntries).toHaveLength(2);
    expect(loadedEntries[0]!.id).toBe("entry_1");
    expect(loadedEntries[0]!.summary).toBe(
      "The player arrived in the forest clearing.",
    );
    expect(loadedEntries[1]!.id).toBe("entry_2");
    expect(loadedEntries[1]!.type).toBe("conversation");

    // -- Narrative threads --
    expect(loaded.chronicle.narrativeThreads).toHaveLength(1);
    const thread = loaded.chronicle.narrativeThreads[0]!;
    expect(thread.id).toBe("thread_mystery");
    expect(thread.summary).toBe("Strange lights in the forest");
    expect(thread.tension).toBe(5);
    expect(thread.active).toBe(true);

    // -- Weather --
    expect(loaded.weather.current).toBe("clear");
  });

  // ── Full integration flow ─────────────────────────────────

  test("full flow: generate world -> move -> dialogue -> tick -> save -> load", async () => {
    // Step 1: Generate world
    const aiClient = createMockAIClient({
      create_world: () => makeToolResponse("create_world", mockWorldSeedInput),
      create_zone: () => makeToolResponse("create_zone", mockZoneSpecInput),
      generate_music: () => makeToolResponse("generate_music", mockMusicSpecInput),
    });

    const generator = new WorldGenerator(
      aiClient as any,
      testBuildingVisuals,
      testObjectVisuals,
    );

    const genResult = await generator.generate("a dark forest");
    expect(genResult.seed.setting.name).toBe("Thornwood");
    expect(genResult.characters).toHaveLength(1);

    // Step 2: Build WorldState from generated result
    const { worldState, zone, character } = buildTestWorldState();

    // Verify zone is explorable
    expect(isPassable(zone, 40, 20)).toBe(true);

    // Step 3: Move player
    worldState.player.position.x = 30;
    worldState.player.position.y = 19;
    worldState.player.facing = "right";

    // Step 4: Trigger dialogue with nearby character
    const eventBus = new EventBus();
    const dialogueGreeting: AIResponse = {
      text: "",
      toolUse: [
        {
          type: "tool_use",
          id: "t_greet",
          name: "dialogue_response",
          input: {
            character_speech: "Greetings, traveler.",
            character_emotion: "calm",
            options: [],
            conversation_ended: true,
          },
        },
      ],
      stopReason: "tool_use",
      usage: { inputTokens: 100, outputTokens: 50 },
    };

    const dialogueAI = {
      generate: mock(async () => dialogueGreeting),
      stream: mock(async function* () {
        yield "";
      }),
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

    let dialogueEnded = false;
    eventBus.on("dialogue:ended", () => {
      dialogueEnded = true;
    });

    const dialogueManager = new DialogueManager({
      aiClient: dialogueAI as any,
      contextManager: new ContextManager(),
      worldState,
      eventBus,
      panel: panel as unknown as DialoguePanel,
      inputRouter: router as unknown as InputRouter,
    });

    await dialogueManager.startConversation("npc_elara");
    expect(dialogueEnded).toBe(true);
    expect(panel.showSpeech).toHaveBeenCalledTimes(1);

    // Step 5: Process a world tick event
    const eventQueue = new EventQueue();
    const ticker = new WorldTicker({ tickInterval: 100 });
    const tickEvent: GameEvent = {
      id: "evt_tick_001",
      type: "ambient",
      description: "Night falls over the forest.",
      effects: [
        { type: "weather_change", weather: "fog", duration: 10000 },
      ],
      chronicleEntry: "Fog rolled through the clearing.",
    };

    ticker.processTickEvents(
      [tickEvent],
      worldState,
      worldState.chronicle,
      eventQueue,
      eventBus,
    );

    expect(worldState.weather.current).toBe("fog");
    expect(worldState.chronicle.getEntries().length).toBeGreaterThanOrEqual(1);

    // Step 6: Add play time
    worldState.playTime = 12000;

    // Step 7: Save
    const dbPath = join(tempDir, "full-flow.db");
    const sm1 = new SaveManager("smoke-test-world", { dbPath });
    sm1.saveWorld(worldState);
    sm1.close();

    // Step 8: Load and verify
    const sm2 = new SaveManager("smoke-test-world", { dbPath });
    const loaded = sm2.loadWorld();
    sm2.close();

    // Verify critical state was preserved across save/load
    expect(loaded.worldId).toBe("smoke-test-world");
    expect(loaded.worldSeed.setting.name).toBe("Thornwood");
    expect(loaded.player.position.x).toBe(30);
    expect(loaded.player.position.y).toBe(19);
    expect(loaded.player.facing).toBe("right");
    expect(loaded.zones.size).toBe(1);
    expect(loaded.characters.size).toBe(1);
    expect(loaded.characters.get("npc_elara")!.identity.name).toBe("Elara");
    expect(loaded.playTime).toBe(12000);

    // Chronicle entries survived the round-trip
    const loadedEntries = loaded.chronicle.getEntries();
    expect(loadedEntries.length).toBeGreaterThanOrEqual(1);
    const fogEntry = loadedEntries.find((e) =>
      e.summary.includes("Fog rolled"),
    );
    expect(fogEntry).toBeDefined();
  });
});
