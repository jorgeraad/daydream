import { describe, expect, test } from "bun:test";
import {
  WorldSeedSchema,
  ZoneSchema,
  CharacterSchema,
  EffectSchema,
  CharacterBehaviorSchema,
  CharacterDefSchema,
  BiomeConfigSchema,
  PlayerStateSchema,
} from "./types.ts";

// ── Helpers ─────────────────────────────────────────────────

function validBiomeConfig() {
  return {
    type: "forest",
    terrain: { primary: "grass", secondary: "dirt", features: ["trees"] },
    palette: {
      ground: { chars: ["."], fg: ["#228b22"], bg: "#1a3318" },
      vegetation: { tree: { char: "T", fg: "#228b22" } },
    },
    density: { vegetation: 0.5, structures: 0.1, characters: 0.1 },
    ambient: { lighting: "natural" },
  };
}

function validWorldSeed() {
  return {
    originalPrompt: "A forest village",
    setting: {
      name: "Test World",
      type: "fantasy",
      era: "medieval",
      tone: "warm",
      description: "A test world",
    },
    biomeMap: {
      center: validBiomeConfig(),
      distribution: { type: "simple", seed: 42, biomes: { forest: 1 } },
    },
    initialNarrative: {
      hooks: ["Something stirs in the forest"],
      mainTension: "darkness approaching",
      atmosphere: "peaceful",
    },
    worldRules: {
      hasMagic: false,
      techLevel: "medieval",
      economy: "barter",
      dangers: [],
      customs: [],
    },
  };
}

function validZone() {
  return {
    id: "zone_0_0",
    coords: { x: 0, y: 0 },
    biome: validBiomeConfig(),
    tiles: [],
    characters: [],
    buildings: [],
    objects: [],
    exits: [],
    generated: true,
    generationSeed: "test-seed",
    lastVisited: Date.now(),
    metadata: { description: "A test zone" },
  };
}

function validCharacter() {
  return {
    id: "npc_1",
    worldId: "world_1",
    identity: {
      name: "Elder Willow",
      age: "elderly",
      role: "village elder",
      personality: ["wise", "kind"],
      backstory: "Has lived in the village for decades",
      speechPattern: "formal, measured",
      secrets: ["knows about the hidden cave"],
    },
    visual: {
      display: { char: "E", fg: "#deb887" },
      nameplate: "Elder Willow",
    },
    state: {
      currentZone: "zone_0_0",
      position: { x: 5, y: 5 },
      facing: "down" as const,
      mood: "contemplative",
      currentActivity: "meditating",
      health: "frail",
      goals: ["protect the village"],
    },
    behavior: { type: "stationary" as const, params: {} },
    memory: {
      personalExperiences: [],
      heardRumors: [],
      playerRelationship: { trust: 0, familiarity: 0, impressions: [] },
    },
    relationships: new Map(),
  };
}

// ── WorldSeed ───────────────────────────────────────────────

describe("WorldSeedSchema", () => {
  test("accepts valid WorldSeed", () => {
    const result = WorldSeedSchema.safeParse(validWorldSeed());
    expect(result.success).toBe(true);
  });

  test("rejects missing originalPrompt", () => {
    const { originalPrompt: _, ...seed } = validWorldSeed();
    const result = WorldSeedSchema.safeParse(seed);
    expect(result.success).toBe(false);
  });

  test("rejects invalid setting shape", () => {
    const seed = validWorldSeed();
    (seed as any).setting = { name: "only name" };
    const result = WorldSeedSchema.safeParse(seed);
    expect(result.success).toBe(false);
  });

  test("rejects wrong type for hasMagic", () => {
    const seed = validWorldSeed();
    (seed as any).worldRules.hasMagic = "yes";
    const result = WorldSeedSchema.safeParse(seed);
    expect(result.success).toBe(false);
  });
});

// ── Zone ────────────────────────────────────────────────────

describe("ZoneSchema", () => {
  test("accepts valid Zone", () => {
    const result = ZoneSchema.safeParse(validZone());
    expect(result.success).toBe(true);
  });

  test("rejects missing id", () => {
    const { id: _, ...zone } = validZone();
    const result = ZoneSchema.safeParse(zone);
    expect(result.success).toBe(false);
  });

  test("rejects invalid coords", () => {
    const zone = validZone();
    (zone as any).coords = { x: "not a number", y: 0 };
    const result = ZoneSchema.safeParse(zone);
    expect(result.success).toBe(false);
  });

  test("accepts zone with full tile layers", () => {
    const zone = {
      ...validZone(),
      tiles: [
        {
          name: "ground",
          data: [{ char: ".", fg: "#228b22", bg: "#1a3318" }],
          width: 1,
          height: 1,
        },
      ],
    };
    const result = ZoneSchema.safeParse(zone);
    expect(result.success).toBe(true);
  });

  test("rejects invalid tile layer name", () => {
    const zone = {
      ...validZone(),
      tiles: [
        {
          name: "invalid_layer",
          data: [],
          width: 0,
          height: 0,
        },
      ],
    };
    const result = ZoneSchema.safeParse(zone);
    expect(result.success).toBe(false);
  });
});

// ── Character ───────────────────────────────────────────────

describe("CharacterSchema", () => {
  test("accepts valid Character", () => {
    const result = CharacterSchema.safeParse(validCharacter());
    expect(result.success).toBe(true);
  });

  test("rejects invalid facing direction", () => {
    const char = validCharacter();
    (char.state as any).facing = "northwest";
    const result = CharacterSchema.safeParse(char);
    expect(result.success).toBe(false);
  });

  test("rejects missing identity fields", () => {
    const char = validCharacter();
    (char as any).identity = { name: "Only Name" };
    const result = CharacterSchema.safeParse(char);
    expect(result.success).toBe(false);
  });

  test("accepts character with empty Map relationships", () => {
    const char = validCharacter();
    char.relationships = new Map();
    const result = CharacterSchema.safeParse(char);
    expect(result.success).toBe(true);
  });

  test("accepts character with populated relationships", () => {
    const char = validCharacter();
    char.relationships = new Map([
      [
        "npc_2",
        { type: "friend", trust: 0.8, familiarity: 0.9, history: "childhood friends" },
      ],
    ]);
    const result = CharacterSchema.safeParse(char);
    expect(result.success).toBe(true);
  });
});

// ── CharacterBehavior (recursive) ───────────────────────────

describe("CharacterBehaviorSchema", () => {
  test("accepts simple stationary behavior", () => {
    const result = CharacterBehaviorSchema.safeParse({
      type: "stationary",
      params: {},
    });
    expect(result.success).toBe(true);
  });

  test("accepts patrol with points", () => {
    const result = CharacterBehaviorSchema.safeParse({
      type: "patrol",
      params: {
        patrolPoints: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  test("accepts recursive schedule", () => {
    const result = CharacterBehaviorSchema.safeParse({
      type: "wander",
      params: { wanderRadius: 5 },
      schedule: {
        morning: { type: "patrol", params: { patrolPoints: [{ x: 0, y: 0 }] } },
        afternoon: { type: "stationary", params: {} },
        evening: { type: "wander", params: { wanderRadius: 3 } },
        night: { type: "stationary", params: {} },
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid behavior type", () => {
    const result = CharacterBehaviorSchema.safeParse({
      type: "flying",
      params: {},
    });
    expect(result.success).toBe(false);
  });
});

// ── Effect (discriminated union) ────────────────────────────

describe("EffectSchema", () => {
  test("accepts character_move effect", () => {
    const result = EffectSchema.safeParse({
      type: "character_move",
      characterId: "npc_1",
      targetZone: "zone_1_0",
      targetPos: { x: 10, y: 10 },
    });
    expect(result.success).toBe(true);
  });

  test("accepts character_spawn effect", () => {
    const result = EffectSchema.safeParse({
      type: "character_spawn",
      zone: "zone_0_0",
      characterDef: {
        identity: {
          name: "Guard",
          age: "30",
          role: "guard",
          personality: ["stern"],
          backstory: "A loyal guard",
          speechPattern: "clipped",
          secrets: [],
        },
        visual: {
          display: { char: "G", fg: "#c0c0c0" },
          nameplate: "Guard",
        },
        state: {
          position: { x: 3, y: 3 },
          facing: "down",
          mood: "alert",
          currentActivity: "patrolling",
          health: "healthy",
          goals: ["guard the gate"],
        },
        behavior: { type: "patrol", params: { patrolPoints: [{ x: 3, y: 3 }, { x: 7, y: 3 }] } },
      },
    });
    expect(result.success).toBe(true);
  });

  test("accepts narration effect", () => {
    const result = EffectSchema.safeParse({
      type: "narration",
      text: "The wind howls through the village...",
    });
    expect(result.success).toBe(true);
  });

  test("accepts weather_change effect", () => {
    const result = EffectSchema.safeParse({
      type: "weather_change",
      weather: "rain",
      duration: 60000,
    });
    expect(result.success).toBe(true);
  });

  test("accepts zone_modify effect", () => {
    const result = EffectSchema.safeParse({
      type: "zone_modify",
      zone: "zone_0_0",
      changes: {
        metadata: { name: "Haunted Forest" },
        removeObjectIds: ["obj_1"],
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects unknown effect type", () => {
    const result = EffectSchema.safeParse({
      type: "teleport",
      target: "zone_9_9",
    });
    expect(result.success).toBe(false);
  });

  test("rejects character_move missing targetPos", () => {
    const result = EffectSchema.safeParse({
      type: "character_move",
      characterId: "npc_1",
      targetZone: "zone_1_0",
    });
    expect(result.success).toBe(false);
  });

  test("accepts character_state with partial changes", () => {
    const result = EffectSchema.safeParse({
      type: "character_state",
      characterId: "npc_1",
      changes: { mood: "happy" },
    });
    expect(result.success).toBe(true);
  });
});

// ── BiomeConfig ─────────────────────────────────────────────

describe("BiomeConfigSchema", () => {
  test("accepts valid BiomeConfig", () => {
    const result = BiomeConfigSchema.safeParse(validBiomeConfig());
    expect(result.success).toBe(true);
  });

  test("rejects missing terrain", () => {
    const { terrain: _, ...biome } = validBiomeConfig();
    const result = BiomeConfigSchema.safeParse(biome);
    expect(result.success).toBe(false);
  });
});

// ── PlayerState ─────────────────────────────────────────────

describe("PlayerStateSchema", () => {
  test("accepts valid PlayerState", () => {
    const result = PlayerStateSchema.safeParse({
      position: { zone: "zone_0_0", x: 5, y: 5 },
      facing: "down",
      inventory: [],
      journal: {
        entries: [],
        knownCharacters: [],
        discoveredZones: [],
        activeQuests: [],
      },
      stats: {
        totalPlayTime: 0,
        conversationsHad: 0,
        zonesExplored: 0,
        daysSurvived: 0,
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid facing direction", () => {
    const result = PlayerStateSchema.safeParse({
      position: { zone: "zone_0_0", x: 5, y: 5 },
      facing: "north",
      inventory: [],
      journal: {
        entries: [],
        knownCharacters: [],
        discoveredZones: [],
        activeQuests: [],
      },
      stats: {
        totalPlayTime: 0,
        conversationsHad: 0,
        zonesExplored: 0,
        daysSurvived: 0,
      },
    });
    expect(result.success).toBe(false);
  });
});
