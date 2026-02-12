import { Database } from "bun:sqlite";
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SAVE_DIR, AUTO_SAVE_INTERVAL_MS } from "./config.ts";
import {
  WorldState,
  Chronicle,
  type Zone,
  type Character,
  type ChronicleEntry,
  type PlayerState,
  type WorldSeed,
  type NarrativeThread,
  type ZoneId,
  type CharacterId,
} from "@daydream/engine";

export interface WorldSummary {
  id: string;
  name: string;
  seedPrompt: string;
  createdAt: number;
  updatedAt: number;
  playTimeSeconds: number;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  seed_prompt TEXT NOT NULL,
  world_config TEXT NOT NULL,
  chronicle_summary TEXT NOT NULL DEFAULT '{}',
  narrative_threads TEXT NOT NULL DEFAULT '[]',
  weather TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  play_time_seconds INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS zones (
  id TEXT NOT NULL,
  world_id TEXT NOT NULL REFERENCES worlds(id),
  coords_x INTEGER NOT NULL,
  coords_y INTEGER NOT NULL,
  tile_data TEXT NOT NULL,
  metadata TEXT NOT NULL,
  PRIMARY KEY (world_id, id)
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id),
  name TEXT NOT NULL,
  identity TEXT NOT NULL,
  visual TEXT NOT NULL,
  state TEXT NOT NULL,
  behavior TEXT NOT NULL,
  memory TEXT NOT NULL,
  relationships TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS chronicle_entries (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id),
  entry TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_state (
  world_id TEXT PRIMARY KEY REFERENCES worlds(id),
  position TEXT NOT NULL,
  inventory TEXT NOT NULL DEFAULT '[]',
  journal TEXT NOT NULL DEFAULT '{}',
  stats TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS ai_cache (
  key TEXT PRIMARY KEY,
  response TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_zones_world ON zones(world_id);
CREATE INDEX IF NOT EXISTS idx_characters_world ON characters(world_id);
CREATE INDEX IF NOT EXISTS idx_chronicle_world ON chronicle_entries(world_id, created_at);
`;

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function initDatabase(dbPath: string): Database {
  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(SCHEMA_SQL);
  return db;
}

// ── Serialization helpers ────────────────────────────────────

function serializeZone(zone: Zone, worldId: string) {
  const { tiles, id, coords, ...rest } = zone;
  return {
    id,
    world_id: worldId,
    coords_x: coords.x,
    coords_y: coords.y,
    tile_data: JSON.stringify(tiles),
    metadata: JSON.stringify(rest),
  };
}

function deserializeZone(row: {
  id: string;
  coords_x: number;
  coords_y: number;
  tile_data: string;
  metadata: string;
}): Zone {
  const tiles = JSON.parse(row.tile_data);
  const rest = JSON.parse(row.metadata);
  return {
    id: row.id,
    coords: { x: row.coords_x, y: row.coords_y },
    tiles,
    ...rest,
  };
}

function serializeCharacter(char: Character, worldId: string) {
  return {
    id: char.id,
    world_id: worldId,
    name: char.identity.name,
    identity: JSON.stringify(char.identity),
    visual: JSON.stringify(char.visual),
    state: JSON.stringify(char.state),
    behavior: JSON.stringify(char.behavior),
    memory: JSON.stringify(char.memory),
    relationships: JSON.stringify(Object.fromEntries(char.relationships)),
  };
}

function deserializeCharacter(row: {
  id: string;
  world_id: string;
  identity: string;
  visual: string;
  state: string;
  behavior: string;
  memory: string;
  relationships: string;
}): Character {
  return {
    id: row.id,
    worldId: row.world_id,
    identity: JSON.parse(row.identity),
    visual: JSON.parse(row.visual),
    state: JSON.parse(row.state),
    behavior: JSON.parse(row.behavior),
    memory: JSON.parse(row.memory),
    relationships: new Map(Object.entries(JSON.parse(row.relationships))),
  };
}

// ── SaveManager ──────────────────────────────────────────────

export class SaveManager {
  private db: Database;
  private worldId: string;
  private autoSaveTimer: Timer | null = null;
  private initialized = false;

  constructor(worldId: string, options?: { dbPath?: string }) {
    this.worldId = worldId;
    if (options?.dbPath) {
      this.db = initDatabase(options.dbPath);
    } else {
      ensureDir(SAVE_DIR);
      this.db = initDatabase(join(SAVE_DIR, `${worldId}.db`));
    }
  }

  saveWorld(worldState: WorldState): void {
    const now = Date.now();
    const isFirstSave = !this.initialized;

    const tx = this.db.transaction(() => {
      // Upsert world row
      this.db.run(
        `INSERT INTO worlds (id, name, seed_prompt, world_config, chronicle_summary, narrative_threads, weather, created_at, updated_at, play_time_seconds)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET
           world_config = ?4,
           chronicle_summary = ?5,
           narrative_threads = ?6,
           weather = ?7,
           updated_at = ?9,
           play_time_seconds = ?10`,
        [
          worldState.worldId,
          worldState.worldSeed.setting.name,
          worldState.worldSeed.originalPrompt,
          JSON.stringify(worldState.worldSeed),
          JSON.stringify(worldState.chronicle.getSummaries()),
          JSON.stringify(worldState.chronicle.narrativeThreads),
          JSON.stringify(worldState.weather),
          worldState.createdAt,
          now,
          Math.floor(worldState.playTime / 1000),
        ],
      );

      // Save zones — all on first save, only dirty after
      const zonesToSave = isFirstSave
        ? [...worldState.zones.values()]
        : worldState.dirtyZones();

      if (zonesToSave.length > 0) {
        const zoneStmt = this.db.prepare(
          `INSERT INTO zones (id, world_id, coords_x, coords_y, tile_data, metadata)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)
           ON CONFLICT(world_id, id) DO UPDATE SET
             tile_data = ?5,
             metadata = ?6`,
        );
        for (const zone of zonesToSave) {
          const row = serializeZone(zone, worldState.worldId);
          zoneStmt.run(row.id, row.world_id, row.coords_x, row.coords_y, row.tile_data, row.metadata);
        }
      }

      // Save characters — all on first save, only dirty after
      const charsToSave = isFirstSave
        ? [...worldState.characters.values()]
        : worldState.dirtyCharacters();

      if (charsToSave.length > 0) {
        const charStmt = this.db.prepare(
          `INSERT INTO characters (id, world_id, name, identity, visual, state, behavior, memory, relationships)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
           ON CONFLICT(id) DO UPDATE SET
             name = ?3,
             identity = ?4,
             visual = ?5,
             state = ?6,
             behavior = ?7,
             memory = ?8,
             relationships = ?9`,
        );
        for (const char of charsToSave) {
          const row = serializeCharacter(char, worldState.worldId);
          charStmt.run(
            row.id, row.world_id, row.name, row.identity, row.visual,
            row.state, row.behavior, row.memory, row.relationships,
          );
        }
      }

      // Insert unsaved chronicle entries (incremental)
      const unsaved = worldState.chronicle.getUnsavedEntries();
      if (unsaved.length > 0) {
        const chronicleStmt = this.db.prepare(
          `INSERT OR IGNORE INTO chronicle_entries (id, world_id, entry, created_at)
           VALUES (?1, ?2, ?3, ?4)`,
        );
        for (const entry of unsaved) {
          chronicleStmt.run(entry.id, worldState.worldId, JSON.stringify(entry), entry.timestamp);
        }
      }

      // Upsert player state
      this.db.run(
        `INSERT INTO player_state (world_id, position, inventory, journal, stats)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(world_id) DO UPDATE SET
           position = ?2,
           inventory = ?3,
           journal = ?4,
           stats = ?5`,
        [
          worldState.worldId,
          JSON.stringify({ ...worldState.player.position, facing: worldState.player.facing }),
          JSON.stringify(worldState.player.inventory),
          JSON.stringify(worldState.player.journal),
          JSON.stringify(worldState.player.stats),
        ],
      );
    });

    tx();
    worldState.clearDirty();
    this.initialized = true;
  }

  loadWorld(): WorldState {
    const worldRow = this.db.query("SELECT * FROM worlds WHERE id = ?").get(this.worldId) as {
      id: string;
      name: string;
      seed_prompt: string;
      world_config: string;
      chronicle_summary: string;
      narrative_threads: string;
      weather: string;
      created_at: number;
      updated_at: number;
      play_time_seconds: number;
    } | null;
    if (!worldRow) throw new Error(`World "${this.worldId}" not found`);

    const worldSeed: WorldSeed = JSON.parse(worldRow.world_config);

    // Read player state
    const playerRow = this.db.query("SELECT * FROM player_state WHERE world_id = ?").get(this.worldId) as {
      position: string;
      inventory: string;
      journal: string;
      stats: string;
    } | null;
    if (!playerRow) throw new Error(`Player state for world "${this.worldId}" not found`);

    const posData = JSON.parse(playerRow.position);
    const player: PlayerState = {
      position: { zone: posData.zone, x: posData.x, y: posData.y },
      facing: posData.facing ?? "down",
      inventory: JSON.parse(playerRow.inventory),
      journal: JSON.parse(playerRow.journal),
      stats: JSON.parse(playerRow.stats),
    };

    const worldState = new WorldState({
      worldId: this.worldId,
      worldSeed,
      createdAt: worldRow.created_at,
      player,
      activeZoneId: player.position.zone,
    });

    worldState.playTime = worldRow.play_time_seconds * 1000;
    worldState.weather = JSON.parse(worldRow.weather);

    // Load zones
    const zoneRows = this.db.query("SELECT * FROM zones WHERE world_id = ?").all(this.worldId) as Array<{
      id: string;
      coords_x: number;
      coords_y: number;
      tile_data: string;
      metadata: string;
    }>;
    for (const row of zoneRows) {
      const zone = deserializeZone(row);
      worldState.zones.set(zone.id as ZoneId, zone);
    }

    // Load characters
    const charRows = this.db.query("SELECT * FROM characters WHERE world_id = ?").all(this.worldId) as Array<{
      id: string;
      world_id: string;
      identity: string;
      visual: string;
      state: string;
      behavior: string;
      memory: string;
      relationships: string;
    }>;
    for (const row of charRows) {
      const char = deserializeCharacter(row);
      worldState.characters.set(char.id as CharacterId, char);
    }

    // Load chronicle entries
    const chronicleRows = this.db.query(
      "SELECT entry FROM chronicle_entries WHERE world_id = ? ORDER BY created_at ASC",
    ).all(this.worldId) as Array<{ entry: string }>;

    for (const row of chronicleRows) {
      const entry: ChronicleEntry = JSON.parse(row.entry);
      worldState.chronicle.append(entry);
    }
    // Clear unsaved buffer — these entries are already persisted
    worldState.chronicle.getUnsavedEntries();

    // Restore chronicle summaries and narrative threads
    const summaries = JSON.parse(worldRow.chronicle_summary);
    worldState.chronicle.recentSummary = summaries.recent ?? "";
    worldState.chronicle.historicalSummary = summaries.historical ?? "";
    worldState.chronicle.narrativeThreads = JSON.parse(worldRow.narrative_threads) as NarrativeThread[];

    this.initialized = true;
    return worldState;
  }

  startAutoSave(worldState: WorldState, intervalMs: number = AUTO_SAVE_INTERVAL_MS): void {
    this.stopAutoSave();
    this.autoSaveTimer = setInterval(() => {
      const hasDirty =
        worldState.dirtyZones().length > 0 ||
        worldState.dirtyCharacters().length > 0;
      if (hasDirty) {
        this.saveWorld(worldState);
      }
    }, intervalMs);
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  close(): void {
    this.stopAutoSave();
    this.db.close();
  }

  static listWorlds(saveDir: string = SAVE_DIR): WorldSummary[] {
    ensureDir(saveDir);
    const files = readdirSync(saveDir).filter((f) => f.endsWith(".db"));
    const summaries: WorldSummary[] = [];

    for (const file of files) {
      const dbPath = join(saveDir, file);
      try {
        const db = new Database(dbPath, { readonly: true });
        const row = db.query("SELECT * FROM worlds LIMIT 1").get() as {
          id: string;
          name: string;
          seed_prompt: string;
          created_at: number;
          updated_at: number;
          play_time_seconds: number;
        } | null;
        db.close();
        if (row) {
          summaries.push({
            id: row.id,
            name: row.name,
            seedPrompt: row.seed_prompt,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            playTimeSeconds: row.play_time_seconds ?? 0,
          });
        }
      } catch {
        // Skip corrupt or incompatible DB files
      }
    }

    return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
