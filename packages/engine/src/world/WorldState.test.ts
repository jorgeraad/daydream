import { describe, expect, test } from "bun:test";
import { WorldState } from "./WorldState.ts";
import type {
  BiomeConfig,
  Character,
  CharacterDef,
  Effect,
  PlayerState,
  WorldSeed,
  Zone,
} from "../types.ts";

function createTestWorldSeed(): WorldSeed {
  return {
    originalPrompt: "A forest village",
    setting: { name: "Test World", type: "fantasy", era: "medieval", tone: "warm", description: "A test world" },
    biomeMap: {
      center: createTestBiome(),
      distribution: { type: "simple", seed: 42, biomes: { forest: 1 } },
    },
    initialNarrative: { hooks: [], mainTension: "none", atmosphere: "peaceful" },
    worldRules: { hasMagic: false, techLevel: "medieval", economy: "barter", dangers: [], customs: [] },
  };
}

function createTestBiome(): BiomeConfig {
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

function createTestPlayer(): PlayerState {
  return {
    position: { zone: "zone_0_0", x: 5, y: 5 },
    facing: "down",
    inventory: [],
    journal: { entries: [], knownCharacters: [], discoveredZones: [], activeQuests: [] },
    stats: { totalPlayTime: 0, conversationsHad: 0, zonesExplored: 0, daysSurvived: 0 },
  };
}

function createTestZone(id: string, coords = { x: 0, y: 0 }): Zone {
  return {
    id,
    coords,
    biome: createTestBiome(),
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

function createTestCharacter(id: string, zoneId: string): Character {
  return {
    id,
    worldId: "test-world",
    identity: {
      name: "Test NPC",
      age: "30",
      role: "villager",
      personality: ["friendly"],
      backstory: "A test character",
      speechPattern: "casual",
      secrets: [],
    },
    visual: {
      display: { char: "V", fg: "#deb887" },
      nameplate: "Test NPC",
    },
    state: {
      currentZone: zoneId,
      position: { x: 3, y: 3 },
      facing: "down",
      mood: "neutral",
      currentActivity: "idle",
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

function createWorldState(): WorldState {
  return new WorldState({
    worldId: "test-world",
    worldSeed: createTestWorldSeed(),
    createdAt: Date.now(),
    player: createTestPlayer(),
    activeZoneId: "zone_0_0",
  });
}

describe("WorldState", () => {
  test("constructor initializes with correct values", () => {
    const ws = createWorldState();
    expect(ws.worldId).toBe("test-world");
    expect(ws.zones.size).toBe(0);
    expect(ws.characters.size).toBe(0);
    expect(ws.activeZoneId).toBe("zone_0_0");
    expect(ws.activeConversation).toBeNull();
    expect(ws.eventQueue).toEqual([]);
    expect(ws.playTime).toBe(0);
  });

  test("activeZone returns the active zone", () => {
    const ws = createWorldState();
    expect(ws.activeZone).toBeUndefined();

    const zone = createTestZone("zone_0_0");
    ws.zones.set("zone_0_0", zone);
    expect(ws.activeZone).toBe(zone);
  });

  test("nearbyCharacters returns characters in active zone", () => {
    const ws = createWorldState();
    const zone = createTestZone("zone_0_0");
    ws.zones.set("zone_0_0", zone);

    const char = createTestCharacter("npc1", "zone_0_0");
    ws.characters.set("npc1", char);
    zone.characters.push("npc1");

    expect(ws.nearbyCharacters).toHaveLength(1);
    expect(ws.nearbyCharacters[0]!.id).toBe("npc1");
  });

  describe("dirty tracking", () => {
    test("starts with no dirty zones or characters", () => {
      const ws = createWorldState();
      expect(ws.dirtyZones()).toHaveLength(0);
      expect(ws.dirtyCharacters()).toHaveLength(0);
    });

    test("markZoneDirty adds to dirty set", () => {
      const ws = createWorldState();
      const zone = createTestZone("zone_0_0");
      ws.zones.set("zone_0_0", zone);

      ws.markZoneDirty("zone_0_0");
      expect(ws.dirtyZones()).toHaveLength(1);
      expect(ws.dirtyZones()[0]!.id).toBe("zone_0_0");
    });

    test("markCharacterDirty adds to dirty set", () => {
      const ws = createWorldState();
      const char = createTestCharacter("npc1", "zone_0_0");
      ws.characters.set("npc1", char);

      ws.markCharacterDirty("npc1");
      expect(ws.dirtyCharacters()).toHaveLength(1);
      expect(ws.dirtyCharacters()[0]!.id).toBe("npc1");
    });

    test("clearDirty resets dirty tracking", () => {
      const ws = createWorldState();
      const zone = createTestZone("zone_0_0");
      ws.zones.set("zone_0_0", zone);
      ws.markZoneDirty("zone_0_0");
      ws.markCharacterDirty("npc1");

      ws.clearDirty();
      expect(ws.dirtyZones()).toHaveLength(0);
      expect(ws.dirtyCharacters()).toHaveLength(0);
    });
  });

  describe("applyEffect", () => {
    test("character_move moves character between zones", () => {
      const ws = createWorldState();
      const zone1 = createTestZone("zone_0_0");
      const zone2 = createTestZone("zone_1_0", { x: 1, y: 0 });
      ws.zones.set("zone_0_0", zone1);
      ws.zones.set("zone_1_0", zone2);

      const char = createTestCharacter("npc1", "zone_0_0");
      ws.characters.set("npc1", char);
      zone1.characters.push("npc1");

      const effect: Effect = {
        type: "character_move",
        characterId: "npc1",
        targetZone: "zone_1_0",
        targetPos: { x: 10, y: 10 },
      };
      ws.applyEffect(effect);

      expect(zone1.characters).not.toContain("npc1");
      expect(zone2.characters).toContain("npc1");
      expect(char.state.currentZone).toBe("zone_1_0");
      expect(char.state.position).toEqual({ x: 10, y: 10 });
      expect(ws.dirtyZones()).toHaveLength(2);
      expect(ws.dirtyCharacters()).toHaveLength(1);
    });

    test("character_spawn creates new character in zone", () => {
      const ws = createWorldState();
      const zone = createTestZone("zone_0_0");
      ws.zones.set("zone_0_0", zone);

      const def: CharacterDef = {
        identity: {
          name: "New NPC",
          age: "25",
          role: "merchant",
          personality: ["greedy"],
          backstory: "A traveling merchant",
          speechPattern: "formal",
          secrets: [],
        },
        visual: {
          display: { char: "$", fg: "#c9a959", bold: true },
          nameplate: "New NPC",
        },
        state: {
          position: { x: 5, y: 5 },
          facing: "down",
          mood: "neutral",
          currentActivity: "selling",
          health: "healthy",
          goals: ["sell wares"],
        },
        behavior: { type: "stationary", params: {} },
      };

      const effect: Effect = { type: "character_spawn", zone: "zone_0_0", characterDef: def };
      ws.applyEffect(effect);

      expect(ws.characters.size).toBe(1);
      expect(zone.characters).toHaveLength(1);

      const spawned = [...ws.characters.values()][0]!;
      expect(spawned.identity.name).toBe("New NPC");
      expect(spawned.state.currentZone).toBe("zone_0_0");
    });

    test("character_remove removes character from world", () => {
      const ws = createWorldState();
      const zone = createTestZone("zone_0_0");
      ws.zones.set("zone_0_0", zone);

      const char = createTestCharacter("npc1", "zone_0_0");
      ws.characters.set("npc1", char);
      zone.characters.push("npc1");

      const effect: Effect = { type: "character_remove", characterId: "npc1", reason: "left" };
      ws.applyEffect(effect);

      expect(ws.characters.size).toBe(0);
      expect(zone.characters).not.toContain("npc1");
    });

    test("character_state updates character state fields", () => {
      const ws = createWorldState();
      const char = createTestCharacter("npc1", "zone_0_0");
      ws.characters.set("npc1", char);

      const effect: Effect = {
        type: "character_state",
        characterId: "npc1",
        changes: { mood: "happy", currentActivity: "dancing" },
      };
      ws.applyEffect(effect);

      expect(char.state.mood).toBe("happy");
      expect(char.state.currentActivity).toBe("dancing");
      expect(ws.dirtyCharacters()).toHaveLength(1);
    });

    test("weather_change updates weather state", () => {
      const ws = createWorldState();
      const effect: Effect = { type: "weather_change", weather: "rain", duration: 60000 };
      ws.applyEffect(effect);

      expect(ws.weather.current).toBe("rain");
      expect(ws.weather.duration).toBe(60000);
      expect(ws.weather.intensity).toBe(1);
    });

    test("object_spawn adds object to zone", () => {
      const ws = createWorldState();
      const zone = createTestZone("zone_0_0");
      ws.zones.set("zone_0_0", zone);

      const effect: Effect = {
        type: "object_spawn",
        zone: "zone_0_0",
        objectDef: {
          id: "obj1",
          type: "chest",
          position: { x: 7, y: 7 },
          char: "C",
          fg: "#c9a959",
          interactable: true,
        },
      };
      ws.applyEffect(effect);

      expect(zone.objects).toHaveLength(1);
      expect(zone.objects[0]!.id).toBe("obj1");
      expect(ws.dirtyZones()).toHaveLength(1);
    });

    test("object_remove removes object from zone", () => {
      const ws = createWorldState();
      const zone = createTestZone("zone_0_0");
      zone.objects.push({
        id: "obj1",
        type: "chest",
        position: { x: 7, y: 7 },
        char: "C",
        fg: "#c9a959",
      });
      ws.zones.set("zone_0_0", zone);

      const effect: Effect = { type: "object_remove", zone: "zone_0_0", objectId: "obj1" };
      ws.applyEffect(effect);

      expect(zone.objects).toHaveLength(0);
    });

    test("zone_modify updates zone metadata and contents", () => {
      const ws = createWorldState();
      const zone = createTestZone("zone_0_0");
      zone.objects.push({
        id: "obj1",
        type: "rock",
        position: { x: 1, y: 1 },
        char: "o",
        fg: "#888888",
      });
      ws.zones.set("zone_0_0", zone);

      const effect: Effect = {
        type: "zone_modify",
        zone: "zone_0_0",
        changes: {
          metadata: { name: "Updated Zone" },
          removeObjectIds: ["obj1"],
          addCharacters: ["npc1"],
        },
      };
      ws.applyEffect(effect);

      expect(zone.metadata.name).toBe("Updated Zone");
      expect(zone.objects).toHaveLength(0);
      expect(zone.characters).toContain("npc1");
    });

    test("narration effect does not modify state", () => {
      const ws = createWorldState();
      const effect: Effect = { type: "narration", text: "The wind howls..." };
      ws.applyEffect(effect);

      // No state changes expected
      expect(ws.dirtyZones()).toHaveLength(0);
      expect(ws.dirtyCharacters()).toHaveLength(0);
    });
  });
});
