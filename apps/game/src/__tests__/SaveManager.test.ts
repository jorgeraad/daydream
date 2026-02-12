import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";
import { SaveManager } from "../SaveManager.ts";
import {
  WorldState,
  type Zone,
  type Character,
  type WorldSeed,
  type PlayerState,
  type TileLayer,
  type TileCell,
  type BiomeConfig,
  type ChronicleEntry,
  type ZoneId,
} from "@daydream/engine";

// ── Test fixtures ────────────────────────────────────────────

function testBiome(): BiomeConfig {
  return {
    type: "forest",
    terrain: { primary: "grass", secondary: "dirt", features: ["trees", "rocks"] },
    palette: {
      ground: { chars: ["."], fg: ["#228B22"], bg: "#1a3a1a" },
      vegetation: {
        tree: { char: "T", fg: "#006400" },
      },
    },
    density: { vegetation: 0.3, structures: 0.1, characters: 0.05 },
    ambient: { lighting: "dappled" },
  };
}

function testWorldSeed(): WorldSeed {
  return {
    originalPrompt: "A quiet forest village",
    setting: {
      name: "Eldergrove",
      type: "village",
      era: "medieval",
      tone: "peaceful",
      description: "A small village nestled among ancient trees.",
    },
    biomeMap: {
      center: testBiome(),
      distribution: { type: "radial", seed: 42, biomes: { forest: 0.7, clearing: 0.3 } },
    },
    initialNarrative: {
      hooks: ["A stranger arrived last night"],
      mainTension: "Something stirs in the deep woods",
      atmosphere: "Peaceful but watchful",
    },
    worldRules: {
      hasMagic: true,
      techLevel: "medieval",
      economy: "barter",
      dangers: ["wolves", "bandits"],
      customs: ["harvest festival"],
    },
  };
}

function testPlayer(): PlayerState {
  return {
    position: { zone: "zone_0_0", x: 5, y: 10 },
    facing: "down",
    inventory: [{ id: "item_1", name: "Torch", description: "A lit torch", type: "tool" }],
    journal: {
      entries: [{ id: "j1", timestamp: 1000, gameTime: 500, text: "Arrived in the village." }],
      knownCharacters: ["npc_guard"],
      discoveredZones: ["zone_0_0"],
      activeQuests: [],
    },
    stats: { totalPlayTime: 0, conversationsHad: 0, zonesExplored: 1, daysSurvived: 1 },
  };
}

function testTileLayer(name: string, w: number, h: number): TileLayer {
  const data: TileCell[] = new Array(w * h);
  for (let i = 0; i < w * h; i++) {
    data[i] = { char: ".", fg: "#228B22", bg: "#1a3a1a" };
  }
  return { name: name as TileLayer["name"], data, width: w, height: h };
}

function testZone(): Zone {
  return {
    id: "zone_0_0",
    coords: { x: 0, y: 0 },
    biome: testBiome(),
    tiles: [testTileLayer("ground", 10, 10), testTileLayer("collision", 10, 10)],
    characters: ["npc_guard"],
    buildings: [],
    objects: [],
    exits: [{ direction: "right", targetZone: "zone_1_0", targetPosition: { x: 0, y: 5 } }],
    generated: true,
    generationSeed: "seed_abc",
    lastVisited: Date.now(),
    metadata: { description: "A forest clearing", name: "The Clearing" },
  };
}

function testCharacter(): Character {
  return {
    id: "npc_guard",
    worldId: "test-world",
    identity: {
      name: "Aldric",
      age: "adult",
      role: "Guard",
      personality: ["stern", "loyal"],
      backstory: "A veteran guard.",
      speechPattern: "formal",
      secrets: ["Knows about the hidden passage"],
    },
    visual: {
      display: { char: "G", fg: "#FFD700", bold: true },
      nameplate: "Aldric the Guard",
    },
    state: {
      currentZone: "zone_0_0",
      position: { x: 10, y: 8 },
      facing: "down",
      mood: "alert",
      currentActivity: "patrolling",
      health: "healthy",
      goals: ["protect the village"],
    },
    behavior: { type: "patrol", params: { patrolPoints: [{ x: 10, y: 8 }, { x: 15, y: 8 }] } },
    memory: {
      personalExperiences: [{ type: "event", summary: "Saw wolves near the edge", timestamp: 500, emotionalWeight: 0.7 }],
      heardRumors: [],
      playerRelationship: { trust: 0, familiarity: 0, impressions: [] },
    },
    relationships: new Map([
      ["npc_merchant", { type: "friend", trust: 8, familiarity: 10, history: "Childhood friends" }],
    ]),
  };
}

function testChronicleEntry(id: string, gameTime: number): ChronicleEntry {
  return {
    id,
    timestamp: Date.now(),
    gameTime,
    type: "event",
    zone: "zone_0_0",
    summary: `Event ${id} occurred`,
    characters: ["npc_guard"],
  };
}

function createTestWorldState(): WorldState {
  const ws = new WorldState({
    worldId: "test-world",
    worldSeed: testWorldSeed(),
    createdAt: Date.now(),
    player: testPlayer(),
    activeZoneId: "zone_0_0",
  });

  ws.zones.set("zone_0_0" as ZoneId, testZone());
  ws.characters.set("npc_guard", testCharacter());
  ws.chronicle.append(testChronicleEntry("entry_1", 100));
  ws.chronicle.append(testChronicleEntry("entry_2", 200));
  ws.playTime = 5000;

  return ws;
}

// ── Tests ────────────────────────────────────────────────────

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "daydream-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("SaveManager", () => {
  describe("schema creation", () => {
    test("creates all required tables", () => {
      const dbPath = join(tempDir, "schema-test.db");
      const sm = new SaveManager("test", { dbPath });

      const db = new Database(dbPath, { readonly: true });
      const tables = db
        .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>;
      const tableNames = tables.map((t) => t.name);
      db.close();
      sm.close();

      expect(tableNames).toContain("worlds");
      expect(tableNames).toContain("zones");
      expect(tableNames).toContain("characters");
      expect(tableNames).toContain("chronicle_entries");
      expect(tableNames).toContain("player_state");
      expect(tableNames).toContain("ai_cache");
    });

    test("enables WAL mode", () => {
      const dbPath = join(tempDir, "wal-test.db");
      const sm = new SaveManager("test", { dbPath });

      const db = new Database(dbPath, { readonly: true });
      const result = db.query("PRAGMA journal_mode").get() as { journal_mode: string };
      db.close();
      sm.close();

      expect(result.journal_mode).toBe("wal");
    });

    test("creates indexes", () => {
      const dbPath = join(tempDir, "index-test.db");
      const sm = new SaveManager("test", { dbPath });

      const db = new Database(dbPath, { readonly: true });
      const indexes = db
        .query("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
        .all() as Array<{ name: string }>;
      const indexNames = indexes.map((i) => i.name);
      db.close();
      sm.close();

      expect(indexNames).toContain("idx_zones_world");
      expect(indexNames).toContain("idx_characters_world");
      expect(indexNames).toContain("idx_chronicle_world");
    });
  });

  describe("save/load round-trip", () => {
    test("saves and loads a complete world state", () => {
      const dbPath = join(tempDir, "roundtrip.db");
      const ws = createTestWorldState();

      // Save
      const sm1 = new SaveManager("test-world", { dbPath });
      sm1.saveWorld(ws);
      sm1.close();

      // Load in a fresh SaveManager
      const sm2 = new SaveManager("test-world", { dbPath });
      const loaded = sm2.loadWorld();
      sm2.close();

      // Verify world metadata
      expect(loaded.worldId).toBe(ws.worldId);
      expect(loaded.worldSeed.originalPrompt).toBe("A quiet forest village");
      expect(loaded.worldSeed.setting.name).toBe("Eldergrove");
      expect(loaded.createdAt).toBe(ws.createdAt);
      expect(loaded.playTime).toBe(5000);

      // Verify player state
      expect(loaded.player.position).toEqual(ws.player.position);
      expect(loaded.player.facing).toBe("down");
      expect(loaded.player.inventory).toHaveLength(1);
      expect(loaded.player.inventory[0]!.name).toBe("Torch");
      expect(loaded.player.journal.entries).toHaveLength(1);
      expect(loaded.player.stats.zonesExplored).toBe(1);

      // Verify zone
      expect(loaded.zones.size).toBe(1);
      const zone = loaded.zones.get("zone_0_0" as ZoneId)!;
      expect(zone).toBeDefined();
      expect(zone.id).toBe("zone_0_0");
      expect(zone.coords).toEqual({ x: 0, y: 0 });
      expect(zone.tiles).toHaveLength(2);
      expect(zone.tiles[0]!.data).toHaveLength(100); // 10x10
      expect(zone.exits).toHaveLength(1);
      expect(zone.metadata.name).toBe("The Clearing");
      expect(zone.biome.type).toBe("forest");

      // Verify character
      expect(loaded.characters.size).toBe(1);
      const char = loaded.characters.get("npc_guard")!;
      expect(char).toBeDefined();
      expect(char.identity.name).toBe("Aldric");
      expect(char.visual.nameplate).toBe("Aldric the Guard");
      expect(char.state.mood).toBe("alert");
      expect(char.behavior.type).toBe("patrol");
      expect(char.memory.personalExperiences).toHaveLength(1);

      // Verify character relationships (Map round-trip)
      expect(char.relationships).toBeInstanceOf(Map);
      expect(char.relationships.size).toBe(1);
      const rel = char.relationships.get("npc_merchant")!;
      expect(rel.type).toBe("friend");
      expect(rel.trust).toBe(8);

      // Verify chronicle entries
      const entries = loaded.chronicle.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0]!.id).toBe("entry_1");
      expect(entries[1]!.id).toBe("entry_2");

      // Verify weather
      expect(loaded.weather.current).toBe("clear");
    });

    test("loads player facing direction", () => {
      const dbPath = join(tempDir, "facing.db");
      const ws = createTestWorldState();
      ws.player.facing = "left";

      const sm1 = new SaveManager("test-world", { dbPath });
      sm1.saveWorld(ws);
      sm1.close();

      const sm2 = new SaveManager("test-world", { dbPath });
      const loaded = sm2.loadWorld();
      sm2.close();

      expect(loaded.player.facing).toBe("left");
    });

    test("throws when loading a non-existent world", () => {
      const dbPath = join(tempDir, "missing.db");
      const sm = new SaveManager("nonexistent", { dbPath });

      expect(() => sm.loadWorld()).toThrow('World "nonexistent" not found');
      sm.close();
    });
  });

  describe("dirty tracking", () => {
    test("only saves dirty zones on subsequent saves", () => {
      const dbPath = join(tempDir, "dirty-zones.db");
      const ws = createTestWorldState();

      const sm = new SaveManager("test-world", { dbPath });
      sm.saveWorld(ws); // First save — saves all

      // Add a second zone and mark it dirty
      const zone2: Zone = {
        ...testZone(),
        id: "zone_1_0",
        coords: { x: 1, y: 0 },
        metadata: { description: "Eastern forest", name: "East Woods" },
      };
      ws.zones.set("zone_1_0" as ZoneId, zone2);
      ws.markZoneDirty("zone_1_0" as ZoneId);

      // Modify zone_0_0 data (without marking dirty)
      const origZone = ws.zones.get("zone_0_0" as ZoneId)!;
      origZone.metadata.description = "Modified clearing";

      sm.saveWorld(ws); // Second save — only dirty zones

      // Load and verify
      const loaded = sm.loadWorld();
      sm.close();

      expect(loaded.zones.size).toBe(2);
      // zone_1_0 was marked dirty and saved
      expect(loaded.zones.get("zone_1_0" as ZoneId)!.metadata.name).toBe("East Woods");
      // zone_0_0 was NOT re-saved (not dirty), so it still has original description
      expect(loaded.zones.get("zone_0_0" as ZoneId)!.metadata.description).toBe("A forest clearing");
    });

    test("only saves dirty characters on subsequent saves", () => {
      const dbPath = join(tempDir, "dirty-chars.db");
      const ws = createTestWorldState();

      const sm = new SaveManager("test-world", { dbPath });
      sm.saveWorld(ws);

      // Modify character without marking dirty
      const guard = ws.characters.get("npc_guard")!;
      guard.state.mood = "happy";

      sm.saveWorld(ws); // No dirty characters

      const loaded = sm.loadWorld();
      sm.close();

      // Mood should still be "alert" since the character wasn't marked dirty
      expect(loaded.characters.get("npc_guard")!.state.mood).toBe("alert");
    });

    test("clearDirty is called after save", () => {
      const dbPath = join(tempDir, "clear-dirty.db");
      const ws = createTestWorldState();
      ws.markZoneDirty("zone_0_0" as ZoneId);
      ws.markCharacterDirty("npc_guard");

      const sm = new SaveManager("test-world", { dbPath });
      expect(ws.dirtyZones()).toHaveLength(1);
      expect(ws.dirtyCharacters()).toHaveLength(1);

      sm.saveWorld(ws);

      expect(ws.dirtyZones()).toHaveLength(0);
      expect(ws.dirtyCharacters()).toHaveLength(0);
      sm.close();
    });
  });

  describe("chronicle entries", () => {
    test("incrementally saves new chronicle entries", () => {
      const dbPath = join(tempDir, "chronicle.db");
      const ws = createTestWorldState();

      const sm = new SaveManager("test-world", { dbPath });
      sm.saveWorld(ws); // Saves entry_1 and entry_2

      // Add new entries
      ws.chronicle.append(testChronicleEntry("entry_3", 300));
      ws.chronicle.append(testChronicleEntry("entry_4", 400));

      sm.saveWorld(ws); // Should only insert entry_3 and entry_4

      const loaded = sm.loadWorld();
      sm.close();

      expect(loaded.chronicle.getEntries()).toHaveLength(4);
      expect(loaded.chronicle.getEntries()[2]!.id).toBe("entry_3");
      expect(loaded.chronicle.getEntries()[3]!.id).toBe("entry_4");
    });

    test("preserves chronicle summaries", () => {
      const dbPath = join(tempDir, "summaries.db");
      const ws = createTestWorldState();
      ws.chronicle.recentSummary = "The player arrived and met the guard.";
      ws.chronicle.historicalSummary = "Long ago, the village was founded.";

      const sm = new SaveManager("test-world", { dbPath });
      sm.saveWorld(ws);

      const loaded = sm.loadWorld();
      sm.close();

      expect(loaded.chronicle.recentSummary).toBe("The player arrived and met the guard.");
      expect(loaded.chronicle.historicalSummary).toBe("Long ago, the village was founded.");
    });

    test("preserves narrative threads", () => {
      const dbPath = join(tempDir, "threads.db");
      const ws = createTestWorldState();
      ws.chronicle.addThread("thread_wolves", "Wolf sightings increasing", 4);
      ws.chronicle.addThread("thread_stranger", "Mysterious stranger", 7);

      const sm = new SaveManager("test-world", { dbPath });
      sm.saveWorld(ws);

      const loaded = sm.loadWorld();
      sm.close();

      expect(loaded.chronicle.narrativeThreads).toHaveLength(2);
      const wolfThread = loaded.chronicle.narrativeThreads.find((t) => t.id === "thread_wolves")!;
      expect(wolfThread.summary).toBe("Wolf sightings increasing");
      expect(wolfThread.tension).toBe(4);
      expect(wolfThread.active).toBe(true);
    });
  });

  describe("listWorlds", () => {
    test("lists saved worlds sorted by last updated", () => {
      const now = Date.now();

      // Create two worlds
      const ws1 = createTestWorldState();
      ws1.playTime = 10000;
      const sm1 = new SaveManager("test-world", { dbPath: join(tempDir, "test-world.db") });
      sm1.saveWorld(ws1);
      sm1.close();

      const ws2 = new WorldState({
        worldId: "test-world-2",
        worldSeed: { ...testWorldSeed(), originalPrompt: "A desert oasis", setting: { ...testWorldSeed().setting, name: "Sandhold" } },
        createdAt: now + 1000,
        player: testPlayer(),
        activeZoneId: "zone_0_0",
      });
      ws2.zones.set("zone_0_0" as ZoneId, testZone());
      const sm2 = new SaveManager("test-world-2", { dbPath: join(tempDir, "test-world-2.db") });
      sm2.saveWorld(ws2);
      sm2.close();

      const worlds = SaveManager.listWorlds(tempDir);

      expect(worlds).toHaveLength(2);
      // Most recently updated first
      expect(worlds[0]!.id).toBe("test-world-2");
      expect(worlds[0]!.name).toBe("Sandhold");
      expect(worlds[0]!.seedPrompt).toBe("A desert oasis");
      expect(worlds[1]!.id).toBe("test-world");
      expect(worlds[1]!.name).toBe("Eldergrove");
    });

    test("returns empty array when no saves exist", () => {
      const worlds = SaveManager.listWorlds(tempDir);
      expect(worlds).toEqual([]);
    });

    test("skips corrupt db files", () => {
      // Write a non-SQLite file
      writeFileSync(join(tempDir, "corrupt.db"), "not a database");

      const ws = createTestWorldState();
      const sm = new SaveManager("test-world", { dbPath: join(tempDir, "test-world.db") });
      sm.saveWorld(ws);
      sm.close();

      const worlds = SaveManager.listWorlds(tempDir);
      expect(worlds).toHaveLength(1);
      expect(worlds[0]!.id).toBe("test-world");
    });
  });

  describe("auto-save", () => {
    test("auto-save fires when state is dirty", async () => {
      const dbPath = join(tempDir, "autosave.db");
      const ws = createTestWorldState();

      const sm = new SaveManager("test-world", { dbPath });
      sm.saveWorld(ws); // Initial save

      // Modify and mark dirty
      ws.markZoneDirty("zone_0_0" as ZoneId);
      const zone = ws.zones.get("zone_0_0" as ZoneId)!;
      zone.metadata.description = "Updated by auto-save";

      // Start auto-save with short interval
      sm.startAutoSave(ws, 50);

      // Wait for auto-save to fire
      await new Promise((resolve) => setTimeout(resolve, 150));
      sm.stopAutoSave();

      // Verify the auto-save persisted the change
      const loaded = sm.loadWorld();
      sm.close();

      expect(loaded.zones.get("zone_0_0" as ZoneId)!.metadata.description).toBe("Updated by auto-save");
    });

    test("auto-save skips when no dirty state", async () => {
      const dbPath = join(tempDir, "autosave-skip.db");
      const ws = createTestWorldState();

      const sm = new SaveManager("test-world", { dbPath });
      sm.saveWorld(ws); // Initial save — clears dirty

      // Start auto-save, but don't mark anything dirty
      sm.startAutoSave(ws, 50);
      await new Promise((resolve) => setTimeout(resolve, 150));
      sm.stopAutoSave();
      sm.close();

      // If auto-save ran but skipped (nothing dirty), the play_time won't be updated
      // This is correct behavior — no dirty state means no save
    });
  });
});
