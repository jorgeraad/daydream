// Core types and interfaces for the Daydream game engine.
// These are the shared contracts that all packages build against.

// ── Primitives ──────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export type Direction = "up" | "down" | "left" | "right";

export type CharacterId = string;
export type ZoneId = string;

// ── Tile System ─────────────────────────────────────────────

export type TileLayerName = "ground" | "objects" | "overlay" | "collision";

export interface TileCell {
  char: string;
  fg: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  animated?: boolean;
  animFrames?: string[];
}

export interface TileLayer {
  name: TileLayerName;
  data: TileCell[];
  width: number;
  height: number;
}

// ── Zone ────────────────────────────────────────────────────

export interface ZoneExit {
  direction: Direction;
  targetZone: ZoneId;
  targetPosition: Point;
}

export interface Building {
  id: string;
  name: string;
  position: Point;
  width: number;
  height: number;
  style: string;
  door?: Point;
  features?: string[];
}

export interface WorldObject {
  id: string;
  type: string;
  position: Point;
  char: string;
  fg: string;
  bg?: string;
  collision?: boolean;
  interactable?: boolean;
  description?: string;
}

export interface ZoneMetadata {
  name?: string;
  description: string;
  narrativeRole?: string;
}

export interface Zone {
  id: ZoneId;
  coords: Point;
  biome: BiomeConfig;
  tiles: TileLayer[];
  characters: CharacterId[];
  buildings: Building[];
  objects: WorldObject[];
  exits: ZoneExit[];
  generated: boolean;
  generationSeed: string;
  lastVisited: number;
  metadata: ZoneMetadata;
}

// ── Biome System ────────────────────────────────────────────

export interface BiomePaletteGround {
  chars: string[];
  fg: string[];
  bg: string;
}

export interface BiomePaletteVegetation {
  char: string;
  fg: string;
  variants?: string[];
}

export interface BiomePaletteWater {
  chars: string[];
  fg: string[];
  bg: string;
  animated: boolean;
}

export interface BiomePalettePath {
  chars: string[];
  fg: string;
  bg: string;
}

export interface BiomePalette {
  ground: BiomePaletteGround;
  vegetation: Record<string, BiomePaletteVegetation>;
  water?: BiomePaletteWater;
  path?: BiomePalettePath;
}

export interface BiomeDensity {
  vegetation: number;
  structures: number;
  characters: number;
}

export interface BiomeAmbient {
  lighting: string;
  particles?: string;
  weather?: string;
}

export interface BiomeConfig {
  type: string;
  terrain: {
    primary: string;
    secondary: string;
    features: string[];
  };
  palette: BiomePalette;
  density: BiomeDensity;
  ambient: BiomeAmbient;
}

export interface BiomeDistribution {
  type: string;
  seed: number;
  biomes: Record<string, number>;
}

// ── World Seed ──────────────────────────────────────────────

export interface WorldSeed {
  originalPrompt: string;
  setting: {
    name: string;
    type: string;
    era: string;
    tone: string;
    description: string;
  };
  biomeMap: {
    center: BiomeConfig;
    distribution: BiomeDistribution;
  };
  initialNarrative: {
    hooks: string[];
    mainTension: string;
    atmosphere: string;
  };
  worldRules: {
    hasMagic: boolean;
    techLevel: string;
    economy: string;
    dangers: string[];
    customs: string[];
  };
}

// ── Character ───────────────────────────────────────────────

export interface CharacterIdentity {
  name: string;
  age: string;
  role: string;
  personality: string[];
  backstory: string;
  speechPattern: string;
  secrets: string[];
}

export interface CharacterDisplay {
  char: string;
  fg: string;
  bg?: string;
  bold?: boolean;
}

export interface CharacterVisual {
  display: CharacterDisplay;
  facing?: Record<Direction, string>;
  idleAnimation?: string[];
  nameplate: string;
}

export interface CharacterState {
  currentZone: ZoneId;
  position: Point;
  facing: Direction;
  mood: string;
  currentActivity: string;
  health: string;
  goals: string[];
}

export interface CharacterBehavior {
  type: "stationary" | "patrol" | "wander" | "follow_path" | "idle_actions";
  params: {
    patrolPoints?: Point[];
    wanderRadius?: number;
    path?: Point[];
    idleActions?: string[];
  };
  schedule?: {
    morning: CharacterBehavior;
    afternoon: CharacterBehavior;
    evening: CharacterBehavior;
    night: CharacterBehavior;
  };
}

export interface MemoryEntry {
  type: string;
  summary: string;
  timestamp: number;
  emotionalWeight: number;
}

export interface CharacterRelationship {
  type: string;
  trust: number;
  familiarity: number;
  history: string;
}

export interface CharacterMemoryData {
  personalExperiences: MemoryEntry[];
  heardRumors: MemoryEntry[];
  playerRelationship: {
    trust: number;
    familiarity: number;
    lastInteraction?: string;
    impressions: string[];
  };
}

export interface Character {
  id: CharacterId;
  worldId: string;
  identity: CharacterIdentity;
  visual: CharacterVisual;
  state: CharacterState;
  behavior: CharacterBehavior;
  memory: CharacterMemoryData;
  relationships: Map<string, CharacterRelationship>;
}

export interface CharacterDef {
  identity: CharacterIdentity;
  visual: CharacterVisual;
  state: Omit<CharacterState, "currentZone">;
  behavior: CharacterBehavior;
}

// ── Player ──────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  type: string;
}

export interface JournalEntry {
  id: string;
  timestamp: number;
  gameTime: number;
  text: string;
}

export interface PlayerJournal {
  entries: JournalEntry[];
  knownCharacters: string[];
  discoveredZones: string[];
  activeQuests: string[];
}

export interface PlayerStats {
  totalPlayTime: number;
  conversationsHad: number;
  zonesExplored: number;
  daysSurvived: number;
}

export interface PlayerState {
  position: { zone: ZoneId; x: number; y: number };
  facing: Direction;
  inventory: InventoryItem[];
  journal: PlayerJournal;
  stats: PlayerStats;
}

// ── Chronicle ───────────────────────────────────────────────

export type ChronicleEntryType =
  | "conversation"
  | "event"
  | "player_action"
  | "world_change"
  | "narration";

export interface ChronicleEntry {
  id: string;
  timestamp: number;
  gameTime: number;
  type: ChronicleEntryType;
  zone: ZoneId;
  summary: string;
  details?: string;
  characters?: CharacterId[];
  narrativeThreads?: string[];
}

export interface NarrativeThread {
  id: string;
  summary: string;
  active: boolean;
  entries: string[];
  tension: number;
}

// ── Events & Effects ────────────────────────────────────────

export type GameEventType =
  | "ambient"
  | "minor"
  | "moderate"
  | "major"
  | "dramatic";

export interface GameEvent {
  id: string;
  type: GameEventType;
  description: string;
  effects: Effect[];
  chronicleEntry: string;
}

export type Effect =
  | { type: "character_move"; characterId: CharacterId; targetZone: ZoneId; targetPos: Point }
  | { type: "character_spawn"; zone: ZoneId; characterDef: CharacterDef }
  | { type: "character_remove"; characterId: CharacterId; reason: string }
  | { type: "character_state"; characterId: CharacterId; changes: Partial<CharacterState> }
  | { type: "weather_change"; weather: string; duration: number }
  | { type: "lighting_change"; lighting: string; transition: number }
  | { type: "object_spawn"; zone: ZoneId; objectDef: WorldObject }
  | { type: "object_remove"; zone: ZoneId; objectId: string }
  | { type: "narration"; text: string }
  | { type: "zone_modify"; zone: ZoneId; changes: ZoneChanges };

export interface ZoneChanges {
  metadata?: Partial<ZoneMetadata>;
  addObjects?: WorldObject[];
  removeObjectIds?: string[];
  addCharacters?: CharacterId[];
  removeCharacters?: CharacterId[];
}

// ── Conversation ────────────────────────────────────────────

export interface ConversationTurn {
  speaker: "player" | "character";
  text: string;
  type: "dialogue" | "action" | "narration";
  timestamp: number;
}

export interface ConversationState {
  characterId: CharacterId;
  turns: ConversationTurn[];
  startedAt: number;
  mood: string;
  topicsDiscussed: string[];
  isActive: boolean;
}

// ── Weather ─────────────────────────────────────────────────

export interface WeatherState {
  current: string;
  intensity: number;
  duration: number;
  startedAt: number;
}

// ── Game Mode ───────────────────────────────────────────────

export type GameMode =
  | "exploration"
  | "dialogue"
  | "journal"
  | "inventory"
  | "map"
  | "menu";

// ── Time of Day ─────────────────────────────────────────────

export type TimeOfDay =
  | "dawn"
  | "morning"
  | "afternoon"
  | "dusk"
  | "evening"
  | "night";
