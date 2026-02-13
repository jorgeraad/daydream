// ZoneManager — central orchestrator for multi-zone lifecycle.
// Manages zone loading, generation, activation, preloading, and memory.
// Generation and persistence are injected via callbacks so the engine
// package stays free of AI and I/O dependencies.

import type {
  BiomeConfig,
  Direction,
  Point,
  WorldSeed,
  Zone,
  ZoneId,
  ZoneMetadata,
} from "../types.ts";
import { adjacentZoneIds, parseZoneCoords } from "./Zone.ts";
import { DEFAULT_ZONE_CONFIG, type ZoneConfig } from "./zone-config.ts";

// ── Callback Interfaces ───────────────────────────────────────

/** Persistence layer for zone data. Injected by the game package. */
export interface ZoneStore {
  load(id: ZoneId): Promise<Zone | null>;
  save(zone: Zone): Promise<void>;
  saveIfDirty(zone: Zone): Promise<void>;
}

/** Generates a new zone given its ID, coordinates, and context. */
export type ZoneGeneratorFn = (
  id: ZoneId,
  coords: Point,
  context: ZoneGenerationContext,
) => Promise<Zone>;

// ── Edge Coherence Types ──────────────────────────────────────

/** A single tile along a zone boundary edge. */
export interface EdgeTile {
  position: number;
  terrain: "ground" | "water" | "path" | "wall" | "building";
  char: string;
  fg: string;
  bg?: string;
}

/** Compact representation of tile data at a zone boundary. */
export interface EdgeSignature {
  direction: Direction;
  tiles: EdgeTile[];
}

// ── Generation Context ────────────────────────────────────────

/** Narrative hint about an adjacent zone, used in generation prompts. */
export interface AdjacentZoneHint {
  name: string;
  description: string;
  biome: string;
  edgeFeatures: string[];
}

/** Context provided to the ZoneGeneratorFn when creating a new zone. */
export interface ZoneGenerationContext {
  worldSeed: WorldSeed;
  biome: BiomeConfig;
  adjacentHints: Map<Direction, AdjacentZoneHint>;
  edgeSignatures: Map<Direction, EdgeSignature>;
  chronicle: { recentSummary: string; activeThreads: string[] };
}

// ── ZoneManager Options ───────────────────────────────────────

export interface ZoneManagerOptions {
  worldSeed: WorldSeed;
  zoneGenerator: ZoneGeneratorFn;
  zoneStore: ZoneStore;
  config?: Partial<ZoneConfig>;
}

// ── Preload Ordering ──────────────────────────────────────────

/**
 * Returns directions in priority order for preloading based on movement.
 * Forward direction first (most likely next zone), sides, then behind.
 */
export function preloadOrder(direction: Direction): Direction[] {
  switch (direction) {
    case "up":
      return ["up", "left", "right", "down"];
    case "down":
      return ["down", "left", "right", "up"];
    case "left":
      return ["left", "up", "down", "right"];
    case "right":
      return ["right", "up", "down", "left"];
  }
}

// ── ZoneManager Class ─────────────────────────────────────────

export class ZoneManager {
  private zones: Map<ZoneId, Zone> = new Map();
  private inflight: Map<ZoneId, Promise<Zone>> = new Map();
  private activeZoneId: ZoneId | null = null;
  private edgeSignatures: Map<string, EdgeSignature> = new Map();

  private readonly config: ZoneConfig;
  private readonly worldSeed: WorldSeed;
  private readonly zoneGenerator: ZoneGeneratorFn;
  private readonly zoneStore: ZoneStore;

  constructor(options: ZoneManagerOptions) {
    this.worldSeed = options.worldSeed;
    this.zoneGenerator = options.zoneGenerator;
    this.zoneStore = options.zoneStore;
    this.config = { ...DEFAULT_ZONE_CONFIG, ...options.config };
  }

  /** Get a zone from the in-memory cache (does not load from storage). */
  getZone(id: ZoneId): Zone | undefined {
    return this.zones.get(id);
  }

  /** Get the currently active zone. Throws if no zone is active. */
  getActiveZone(): Zone {
    if (this.activeZoneId === null) {
      throw new Error("No active zone set");
    }
    const zone = this.zones.get(this.activeZoneId);
    if (!zone) {
      throw new Error(`Active zone ${this.activeZoneId} not found in memory`);
    }
    return zone;
  }

  /** Check if a zone is loaded in memory and ready. */
  isReady(id: ZoneId): boolean {
    return this.zones.has(id);
  }

  /** Check if a zone is currently being loaded or generated. */
  isGenerating(id: ZoneId): boolean {
    return this.inflight.has(id);
  }

  /**
   * Set the active zone. The zone must be loaded (call ensureZone first).
   * Triggers preloading of adjacent zones and unloading of distant zones.
   */
  async activateZone(id: ZoneId, movementDirection?: Direction): Promise<void> {
    const zone = await this.ensureZone(id);
    this.activeZoneId = id;
    zone.lastVisited = Date.now();

    // Preload adjacent zones in the background
    this.preloadAdjacent(id, movementDirection);

    // Unload zones that are too far away
    const coords = parseZoneCoords(id);
    if (coords) {
      this.unloadDistant(coords, this.config.keepRadius);
    }
  }

  /**
   * Ensure a zone is loaded, using the deduplication pipeline:
   * 1. In-memory cache
   * 2. In-flight Promise (store load or generation in progress)
   * 3. Persistent storage (ZoneStore) -> generate via ZoneGeneratorFn
   *
   * The entire load-or-generate pipeline is wrapped in a single Promise
   * stored in the inflight map. This ensures that concurrent calls for the
   * same zone ID always receive the same Promise — no double loads or
   * double generations.
   */
  async ensureZone(id: ZoneId): Promise<Zone> {
    // 1. Already loaded in memory
    const existing = this.zones.get(id);
    if (existing) return existing;

    // 2. Already in-flight (loading from store or generating)
    const pending = this.inflight.get(id);
    if (pending) return pending;

    // 3. Start the load-or-generate pipeline
    const promise = this.loadOrGenerate(id);
    this.inflight.set(id, promise);
    promise
      .then((zone) => {
        this.zones.set(id, zone);
        this.inflight.delete(id);
      })
      .catch(() => {
        this.inflight.delete(id);
      });
    return promise;
  }

  /**
   * Preload adjacent zones in priority order based on movement direction.
   * If no direction is given, all 4 cardinal neighbors are preloaded equally.
   * Calls ensureZone() for each — deduplication prevents double-generation.
   */
  preloadAdjacent(center: ZoneId, movementDirection?: Direction): void {
    const coords = parseZoneCoords(center);
    if (!coords) return;

    const adjacent = adjacentZoneIds(coords);
    const directions: Direction[] = movementDirection
      ? preloadOrder(movementDirection)
      : ["up", "down", "left", "right"];

    for (const dir of directions) {
      const neighborId = adjacent[dir];
      if (neighborId) {
        // Fire-and-forget — ensureZone handles deduplication
        this.ensureZone(neighborId).catch(() => {
          // Generation errors are handled by the generator; swallow here
          // to avoid unhandled rejection from background preloading.
        });
      }
    }
  }

  /**
   * Unload zones beyond keepRadius (Manhattan distance) from the active zone.
   * Calls saveIfDirty on each zone before removal.
   * Returns the IDs of unloaded zones.
   */
  unloadDistant(
    activeCoords: Point,
    keepRadius: number = this.config.keepRadius,
  ): ZoneId[] {
    const unloaded: ZoneId[] = [];
    for (const [id, zone] of this.zones) {
      const distance =
        Math.abs(zone.coords.x - activeCoords.x) +
        Math.abs(zone.coords.y - activeCoords.y);
      if (distance > keepRadius) {
        this.zoneStore.saveIfDirty(zone);
        this.zones.delete(id);
        unloaded.push(id);
      }
    }
    return unloaded;
  }

  /**
   * Get the edge signature for a zone's edge.
   * Returns undefined if the zone is not loaded or no signature is cached.
   */
  getEdgeSignature(id: ZoneId, edge: Direction): EdgeSignature | undefined {
    return this.edgeSignatures.get(`${id}:${edge}`);
  }

  /**
   * Store an edge signature for a zone's edge.
   * Called externally (e.g., by EdgeCoherence) after zone generation.
   */
  setEdgeSignature(id: ZoneId, edge: Direction, signature: EdgeSignature): void {
    this.edgeSignatures.set(`${id}:${edge}`, signature);
  }

  /** The resolved zone configuration (defaults merged with overrides). */
  getConfig(): Readonly<ZoneConfig> {
    return this.config;
  }

  // ── Private ────────────────────────────────────────────────

  /** Try store first, then generate. This is the full pipeline for a single zone. */
  private async loadOrGenerate(id: ZoneId): Promise<Zone> {
    // Try loading from persistent storage
    const stored = await this.zoneStore.load(id);
    if (stored) return stored;

    // Not in storage — generate a new zone
    return this.generateZone(id);
  }

  private async generateZone(id: ZoneId): Promise<Zone> {
    const coords = parseZoneCoords(id);
    if (!coords) {
      throw new Error(`Invalid zone ID format: ${id}`);
    }

    const context = this.buildGenerationContext(id, coords);
    const zone = await this.zoneGenerator(id, coords, context);
    return zone;
  }

  private buildGenerationContext(
    _id: ZoneId,
    coords: Point,
  ): ZoneGenerationContext {
    const adjacent = adjacentZoneIds(coords);
    const adjacentHints = new Map<Direction, AdjacentZoneHint>();
    const edgeSigs = new Map<Direction, EdgeSignature>();

    const directions: Direction[] = ["up", "down", "left", "right"];
    for (const dir of directions) {
      const neighborId = adjacent[dir];
      if (!neighborId) continue;

      const neighbor = this.zones.get(neighborId);
      if (neighbor) {
        adjacentHints.set(dir, {
          name: neighbor.metadata.name ?? neighborId,
          description: neighbor.metadata.description,
          biome: neighbor.biome.type,
          edgeFeatures: this.extractEdgeFeatures(neighbor, dir),
        });

        // Get the opposite direction's edge signature from the neighbor
        const oppositeDir = this.oppositeDirection(dir);
        const sig = this.edgeSignatures.get(`${neighborId}:${oppositeDir}`);
        if (sig) {
          edgeSigs.set(dir, sig);
        }
      }
    }

    return {
      worldSeed: this.worldSeed,
      biome: this.worldSeed.biomeMap.center, // Default biome; real biome selection is done by the generator
      adjacentHints,
      edgeSignatures: edgeSigs,
      chronicle: { recentSummary: "", activeThreads: [] },
    };
  }

  private extractEdgeFeatures(zone: Zone, _fromDirection: Direction): string[] {
    // Extract basic features from the zone metadata for narrative hints.
    // Full edge feature extraction is handled by the EdgeCoherence module.
    const features: string[] = [];
    if (zone.metadata.name) {
      features.push(zone.metadata.name);
    }
    return features;
  }

  private oppositeDirection(dir: Direction): Direction {
    switch (dir) {
      case "up":
        return "down";
      case "down":
        return "up";
      case "left":
        return "right";
      case "right":
        return "left";
    }
  }
}
