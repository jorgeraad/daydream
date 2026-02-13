import { describe, expect, mock, test } from "bun:test";
import type { BiomeConfig, Direction, WorldSeed, Zone, ZoneId } from "../types.ts";
import { zoneId } from "./Zone.ts";
import { DEFAULT_ZONE_CONFIG } from "./zone-config.ts";
import {
  ZoneManager,
  preloadOrder,
  type ZoneGeneratorFn,
  type ZoneStore,
} from "./ZoneManager.ts";

// ── Test Helpers ──────────────────────────────────────────────

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

function createTestWorldSeed(): WorldSeed {
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
      center: createTestBiome(),
      distribution: { type: "simple", seed: 42, biomes: { forest: 1 } },
    },
    initialNarrative: {
      hooks: [],
      mainTension: "none",
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

function createTestZone(
  id: ZoneId,
  coords = { x: 0, y: 0 },
): Zone {
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

function createMockStore(zones: Map<ZoneId, Zone> = new Map()): ZoneStore {
  return {
    load: mock(async (id: ZoneId) => zones.get(id) ?? null),
    save: mock(async (_zone: Zone) => {}),
    saveIfDirty: mock(async (_zone: Zone) => {}),
  };
}

function createMockGenerator(): ZoneGeneratorFn {
  return mock(async (id: ZoneId, coords: { x: number; y: number }) => {
    return createTestZone(id, coords);
  }) as ZoneGeneratorFn;
}

function createManager(opts?: {
  store?: ZoneStore;
  generator?: ZoneGeneratorFn;
  config?: Partial<typeof DEFAULT_ZONE_CONFIG>;
}) {
  return new ZoneManager({
    worldSeed: createTestWorldSeed(),
    zoneGenerator: opts?.generator ?? createMockGenerator(),
    zoneStore: opts?.store ?? createMockStore(),
    config: opts?.config,
  });
}

// ── Tests ─────────────────────────────────────────────────────

describe("ZoneConfig", () => {
  test("DEFAULT_ZONE_CONFIG has expected defaults", () => {
    expect(DEFAULT_ZONE_CONFIG.zoneWidth).toBe(80);
    expect(DEFAULT_ZONE_CONFIG.zoneHeight).toBe(40);
    expect(DEFAULT_ZONE_CONFIG.keepRadius).toBe(2);
    expect(DEFAULT_ZONE_CONFIG.maxConcurrentGenerations).toBe(4);
    expect(DEFAULT_ZONE_CONFIG.edgeBlendDepth).toBe(3);
    expect(DEFAULT_ZONE_CONFIG.transitionFadeOutMs).toBe(300);
    expect(DEFAULT_ZONE_CONFIG.transitionFadeInMs).toBe(200);
  });
});

describe("preloadOrder", () => {
  test("up: forward first, sides, then behind", () => {
    expect(preloadOrder("up")).toEqual(["up", "left", "right", "down"]);
  });

  test("down: forward first, sides, then behind", () => {
    expect(preloadOrder("down")).toEqual(["down", "left", "right", "up"]);
  });

  test("left: forward first, sides, then behind", () => {
    expect(preloadOrder("left")).toEqual(["left", "up", "down", "right"]);
  });

  test("right: forward first, sides, then behind", () => {
    expect(preloadOrder("right")).toEqual(["right", "up", "down", "left"]);
  });
});

describe("ZoneManager", () => {
  describe("getZone / isReady / isGenerating", () => {
    test("getZone returns undefined for unknown zone", () => {
      const manager = createManager();
      expect(manager.getZone("zone_0_0")).toBeUndefined();
    });

    test("isReady returns false for unknown zone", () => {
      const manager = createManager();
      expect(manager.isReady("zone_0_0")).toBe(false);
    });

    test("isGenerating returns false when not generating", () => {
      const manager = createManager();
      expect(manager.isGenerating("zone_0_0")).toBe(false);
    });
  });

  describe("getActiveZone", () => {
    test("throws when no active zone is set", () => {
      const manager = createManager();
      expect(() => manager.getActiveZone()).toThrow("No active zone set");
    });

    test("returns the active zone after activation", async () => {
      const manager = createManager();
      await manager.activateZone("zone_0_0");
      const active = manager.getActiveZone();
      expect(active.id).toBe("zone_0_0");
    });
  });

  describe("ensureZone — deduplication pipeline", () => {
    test("returns zone from in-memory cache on second call", async () => {
      const generator = createMockGenerator();
      const manager = createManager({ generator });

      const zone1 = await manager.ensureZone("zone_0_0");
      const zone2 = await manager.ensureZone("zone_0_0");

      expect(zone1).toBe(zone2);
      // Generator should only be called once
      expect(generator).toHaveBeenCalledTimes(1);
    });

    test("returns same Promise for concurrent calls (in-flight dedup)", async () => {
      let resolveGeneration!: (zone: Zone) => void;
      const generator: ZoneGeneratorFn = mock(
        (_id: ZoneId, _coords) =>
          new Promise<Zone>((resolve) => {
            resolveGeneration = resolve;
          }),
      ) as ZoneGeneratorFn;

      const manager = createManager({ generator });

      // Start two concurrent ensureZone calls — both should share the same inflight Promise
      const promise1 = manager.ensureZone("zone_0_0");
      const promise2 = manager.ensureZone("zone_0_0");

      // The inflight map should have an entry (store load + generation in progress)
      expect(manager.isGenerating("zone_0_0")).toBe(true);

      // Wait for the store load to complete (returns null), then generator is called
      await new Promise((r) => setTimeout(r, 0));

      // Generator should only be called once despite two ensureZone calls
      expect(generator).toHaveBeenCalledTimes(1);

      // Resolve the generation
      resolveGeneration(createTestZone("zone_0_0"));
      const [zone1, zone2] = await Promise.all([promise1, promise2]);

      expect(zone1).toBe(zone2);
      expect(manager.isGenerating("zone_0_0")).toBe(false);
      expect(manager.isReady("zone_0_0")).toBe(true);
    });

    test("loads from ZoneStore before generating", async () => {
      const storedZone = createTestZone("zone_0_0");
      const storeZones = new Map<ZoneId, Zone>([["zone_0_0", storedZone]]);
      const store = createMockStore(storeZones);
      const generator = createMockGenerator();

      const manager = createManager({ store, generator });
      const zone = await manager.ensureZone("zone_0_0");

      expect(zone).toBe(storedZone);
      expect(store.load).toHaveBeenCalledWith("zone_0_0");
      // Generator should NOT be called since store had the zone
      expect(generator).toHaveBeenCalledTimes(0);
    });

    test("generates when not in cache or store", async () => {
      const generator = createMockGenerator();
      const store = createMockStore(); // empty store

      const manager = createManager({ store, generator });
      const zone = await manager.ensureZone("zone_0_0");

      expect(store.load).toHaveBeenCalledWith("zone_0_0");
      expect(generator).toHaveBeenCalledTimes(1);
      expect(zone.id).toBe("zone_0_0");
      expect(manager.isReady("zone_0_0")).toBe(true);
    });

    test("cleans up generating map on generation failure", async () => {
      const generator: ZoneGeneratorFn = mock(async () => {
        throw new Error("AI generation failed");
      }) as ZoneGeneratorFn;

      const manager = createManager({ generator });

      await expect(manager.ensureZone("zone_0_0")).rejects.toThrow(
        "AI generation failed",
      );

      // Wait a tick for the .catch handler to clean up
      await new Promise((r) => setTimeout(r, 0));

      expect(manager.isGenerating("zone_0_0")).toBe(false);
      expect(manager.isReady("zone_0_0")).toBe(false);
    });
  });

  describe("activateZone", () => {
    test("sets the active zone", async () => {
      const manager = createManager();
      await manager.activateZone("zone_0_0");

      expect(manager.getActiveZone().id).toBe("zone_0_0");
      expect(manager.isReady("zone_0_0")).toBe(true);
    });

    test("updates lastVisited on activation", async () => {
      const before = Date.now();
      const manager = createManager();
      await manager.activateZone("zone_0_0");

      const zone = manager.getActiveZone();
      expect(zone.lastVisited).toBeGreaterThanOrEqual(before);
    });

    test("switches active zone when called again", async () => {
      const manager = createManager();
      await manager.activateZone("zone_0_0");
      expect(manager.getActiveZone().id).toBe("zone_0_0");

      await manager.activateZone("zone_1_0");
      expect(manager.getActiveZone().id).toBe("zone_1_0");
    });
  });

  describe("unloadDistant", () => {
    test("unloads zones beyond keepRadius", async () => {
      const store = createMockStore();
      const manager = createManager({ store, config: { keepRadius: 1 } });

      // Load some zones at various distances
      await manager.ensureZone("zone_0_0"); // distance 0 from (0,0)
      await manager.ensureZone("zone_1_0"); // distance 1 from (0,0)
      await manager.ensureZone("zone_0_1"); // distance 1 from (0,0)
      await manager.ensureZone("zone_2_0"); // distance 2 from (0,0)
      await manager.ensureZone("zone_0_2"); // distance 2 from (0,0)

      const unloaded = manager.unloadDistant({ x: 0, y: 0 }, 1);

      // Zones at distance 2 should be unloaded
      expect(unloaded).toContain("zone_2_0");
      expect(unloaded).toContain("zone_0_2");
      expect(unloaded).toHaveLength(2);

      // Close zones should still be loaded
      expect(manager.isReady("zone_0_0")).toBe(true);
      expect(manager.isReady("zone_1_0")).toBe(true);
      expect(manager.isReady("zone_0_1")).toBe(true);

      // Distant zones should be unloaded
      expect(manager.isReady("zone_2_0")).toBe(false);
      expect(manager.isReady("zone_0_2")).toBe(false);
    });

    test("calls saveIfDirty before unloading", async () => {
      const store = createMockStore();
      const manager = createManager({ store });

      await manager.ensureZone("zone_3_0"); // distance 3 from origin

      manager.unloadDistant({ x: 0, y: 0 }, 1);

      expect(store.saveIfDirty).toHaveBeenCalled();
    });

    test("uses config keepRadius as default", async () => {
      const manager = createManager({ config: { keepRadius: 0 } });

      await manager.ensureZone("zone_0_0");
      await manager.ensureZone("zone_1_0");

      // Use the config keepRadius (0) — only the center should survive
      const unloaded = manager.unloadDistant({ x: 0, y: 0 });

      expect(unloaded).toContain("zone_1_0");
      expect(manager.isReady("zone_0_0")).toBe(true);
      expect(manager.isReady("zone_1_0")).toBe(false);
    });

    test("returns empty array when all zones are within radius", async () => {
      const manager = createManager();

      await manager.ensureZone("zone_0_0");
      await manager.ensureZone("zone_1_0");

      const unloaded = manager.unloadDistant({ x: 0, y: 0 }, 5);

      expect(unloaded).toHaveLength(0);
    });

    test("handles negative coordinates correctly", async () => {
      const manager = createManager();

      await manager.ensureZone("zone_-1_-1"); // distance 2 from origin
      await manager.ensureZone("zone_0_0"); // distance 0

      const unloaded = manager.unloadDistant({ x: 0, y: 0 }, 1);

      expect(unloaded).toContain("zone_-1_-1");
      expect(manager.isReady("zone_0_0")).toBe(true);
    });
  });

  describe("preloadAdjacent", () => {
    test("preloads all 4 cardinal neighbors", async () => {
      const generator = createMockGenerator();
      const manager = createManager({ generator });

      // First ensure the center zone
      await manager.ensureZone("zone_0_0");
      const callsBefore = (generator as ReturnType<typeof mock>).mock.calls
        .length;

      manager.preloadAdjacent("zone_0_0");

      // Give the async preloads a moment to start
      await new Promise((r) => setTimeout(r, 10));

      // Should have generated 4 adjacent zones (the center was already loaded)
      const callsAfter = (generator as ReturnType<typeof mock>).mock.calls
        .length;
      expect(callsAfter - callsBefore).toBe(4);
    });

    test("respects movement direction priority ordering", async () => {
      const generationOrder: ZoneId[] = [];
      const generator: ZoneGeneratorFn = async (id, coords) => {
        generationOrder.push(id);
        return createTestZone(id, coords);
      };

      const manager = createManager({ generator });
      await manager.ensureZone("zone_0_0");
      generationOrder.length = 0; // Reset

      manager.preloadAdjacent("zone_0_0", "right");

      // Wait for all async preloads to complete
      await new Promise((r) => setTimeout(r, 50));

      // The order should follow preloadOrder("right"): right, up, down, left
      expect(generationOrder[0]).toBe(zoneId(1, 0)); // right
      expect(generationOrder[1]).toBe(zoneId(0, -1)); // up
      expect(generationOrder[2]).toBe(zoneId(0, 1)); // down
      expect(generationOrder[3]).toBe(zoneId(-1, 0)); // left
    });

    test("does not re-generate already loaded zones", async () => {
      const generator = createMockGenerator();
      const manager = createManager({ generator });

      // Pre-load some adjacent zones
      await manager.ensureZone("zone_0_0");
      await manager.ensureZone("zone_1_0");
      await manager.ensureZone("zone_-1_0");

      const callsBefore = (generator as ReturnType<typeof mock>).mock.calls
        .length;

      manager.preloadAdjacent("zone_0_0");

      await new Promise((r) => setTimeout(r, 10));

      const callsAfter = (generator as ReturnType<typeof mock>).mock.calls
        .length;
      // Only 2 new zones should be generated (up and down)
      expect(callsAfter - callsBefore).toBe(2);
    });

    test("handles invalid zone ID gracefully", () => {
      const manager = createManager();
      // Should not throw
      manager.preloadAdjacent("invalid-id");
    });
  });

  describe("getEdgeSignature / setEdgeSignature", () => {
    test("returns undefined for unknown edge", () => {
      const manager = createManager();
      expect(manager.getEdgeSignature("zone_0_0", "up")).toBeUndefined();
    });

    test("stores and retrieves edge signatures", () => {
      const manager = createManager();
      const sig = { direction: "up" as Direction, tiles: [] };

      manager.setEdgeSignature("zone_0_0", "up", sig);
      expect(manager.getEdgeSignature("zone_0_0", "up")).toBe(sig);
    });

    test("different edges are stored independently", () => {
      const manager = createManager();
      const sigUp = { direction: "up" as Direction, tiles: [] };
      const sigDown = { direction: "down" as Direction, tiles: [] };

      manager.setEdgeSignature("zone_0_0", "up", sigUp);
      manager.setEdgeSignature("zone_0_0", "down", sigDown);

      expect(manager.getEdgeSignature("zone_0_0", "up")).toBe(sigUp);
      expect(manager.getEdgeSignature("zone_0_0", "down")).toBe(sigDown);
    });
  });

  describe("getConfig", () => {
    test("returns default config when no overrides provided", () => {
      const manager = createManager();
      expect(manager.getConfig()).toEqual(DEFAULT_ZONE_CONFIG);
    });

    test("merges config overrides with defaults", () => {
      const manager = createManager({
        config: { keepRadius: 5, zoneWidth: 100 },
      });
      const config = manager.getConfig();

      expect(config.keepRadius).toBe(5);
      expect(config.zoneWidth).toBe(100);
      // Defaults should still be applied for unspecified fields
      expect(config.zoneHeight).toBe(40);
      expect(config.edgeBlendDepth).toBe(3);
    });
  });

  describe("zone lifecycle integration", () => {
    test("full lifecycle: generate → activate → preload → unload", async () => {
      const store = createMockStore();
      const generator = createMockGenerator();
      const manager = createManager({
        store,
        generator,
        config: { keepRadius: 1 },
      });

      // Step 1: Activate starting zone
      await manager.activateZone("zone_0_0");
      expect(manager.getActiveZone().id).toBe("zone_0_0");

      // Wait for preloading to finish
      await new Promise((r) => setTimeout(r, 50));

      // Adjacent zones should be loaded
      expect(manager.isReady("zone_1_0")).toBe(true);
      expect(manager.isReady("zone_-1_0")).toBe(true);
      expect(manager.isReady("zone_0_1")).toBe(true);
      expect(manager.isReady("zone_0_-1")).toBe(true);

      // Step 2: Move to a different zone
      await manager.activateZone("zone_2_0", "right");
      expect(manager.getActiveZone().id).toBe("zone_2_0");

      // Wait for preloading + unloading
      await new Promise((r) => setTimeout(r, 50));

      // zone_0_0 is now distance 2 from zone_2_0, within keepRadius=1 it should be unloaded
      // Actually distance=2 > 1, so it should be unloaded
      expect(manager.isReady("zone_2_0")).toBe(true); // active
      expect(manager.isReady("zone_1_0")).toBe(true); // distance 1

      // Zones at distance > 1 from (2,0) should be unloaded
      expect(manager.isReady("zone_0_0")).toBe(false); // distance 2
      expect(manager.isReady("zone_-1_0")).toBe(false); // distance 3
    });

    test("store load is preferred over generation for a stored zone", async () => {
      const storedZone = createTestZone("zone_0_0");
      storedZone.metadata = { description: "From storage" };
      const storeZones = new Map<ZoneId, Zone>([["zone_0_0", storedZone]]);

      const store = createMockStore(storeZones);
      const generator = createMockGenerator();

      const manager = createManager({ store, generator });
      // Use ensureZone directly (not activateZone) to avoid preloading side effects
      const zone = await manager.ensureZone("zone_0_0");

      expect(zone.metadata.description).toBe("From storage");
      expect(store.load).toHaveBeenCalledWith("zone_0_0");
      // Generator should NOT be called for zone_0_0 since store had it
      expect(generator).toHaveBeenCalledTimes(0);
    });
  });
});
