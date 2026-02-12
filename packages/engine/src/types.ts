// Core types and interfaces for the Daydream game engine.
// These are the shared contracts that all packages build against.
// Zod schemas are the single source of truth — TypeScript types are inferred via z.infer<>.

import { z } from "zod";

// ── Primitives ──────────────────────────────────────────────

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Point = z.infer<typeof PointSchema>;

export const DirectionSchema = z.enum(["up", "down", "left", "right"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const CharacterIdSchema = z.string();
export type CharacterId = z.infer<typeof CharacterIdSchema>;

export const ZoneIdSchema = z.string();
export type ZoneId = z.infer<typeof ZoneIdSchema>;

// ── Tile System ─────────────────────────────────────────────

export const TileLayerNameSchema = z.enum([
  "ground",
  "objects",
  "overlay",
  "collision",
]);
export type TileLayerName = z.infer<typeof TileLayerNameSchema>;

export const TileCellSchema = z.object({
  char: z.string(),
  fg: z.string(),
  bg: z.string().optional(),
  bold: z.boolean().optional(),
  dim: z.boolean().optional(),
  animated: z.boolean().optional(),
  animFrames: z.array(z.string()).optional(),
});
export type TileCell = z.infer<typeof TileCellSchema>;

export const TileLayerSchema = z.object({
  name: TileLayerNameSchema,
  data: z.array(TileCellSchema),
  width: z.number(),
  height: z.number(),
});
export type TileLayer = z.infer<typeof TileLayerSchema>;

// ── Zone ────────────────────────────────────────────────────

export const ZoneExitSchema = z.object({
  direction: DirectionSchema,
  targetZone: ZoneIdSchema,
  targetPosition: PointSchema,
});
export type ZoneExit = z.infer<typeof ZoneExitSchema>;

export const BuildingSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: PointSchema,
  width: z.number(),
  height: z.number(),
  style: z.string(),
  door: PointSchema.optional(),
  features: z.array(z.string()).optional(),
});
export type Building = z.infer<typeof BuildingSchema>;

export const WorldObjectSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: PointSchema,
  char: z.string(),
  fg: z.string(),
  bg: z.string().optional(),
  collision: z.boolean().optional(),
  interactable: z.boolean().optional(),
  description: z.string().optional(),
});
export type WorldObject = z.infer<typeof WorldObjectSchema>;

export const ZoneMetadataSchema = z.object({
  name: z.string().optional(),
  description: z.string(),
  narrativeRole: z.string().optional(),
});
export type ZoneMetadata = z.infer<typeof ZoneMetadataSchema>;

// ── Biome System ────────────────────────────────────────────

export const BiomePaletteGroundSchema = z.object({
  chars: z.array(z.string()),
  fg: z.array(z.string()),
  bg: z.string(),
});
export type BiomePaletteGround = z.infer<typeof BiomePaletteGroundSchema>;

export const BiomePaletteVegetationSchema = z.object({
  char: z.string(),
  fg: z.string(),
  variants: z.array(z.string()).optional(),
});
export type BiomePaletteVegetation = z.infer<
  typeof BiomePaletteVegetationSchema
>;

export const BiomePaletteWaterSchema = z.object({
  chars: z.array(z.string()),
  fg: z.array(z.string()),
  bg: z.string(),
  animated: z.boolean(),
});
export type BiomePaletteWater = z.infer<typeof BiomePaletteWaterSchema>;

export const BiomePalettePathSchema = z.object({
  chars: z.array(z.string()),
  fg: z.string(),
  bg: z.string(),
});
export type BiomePalettePath = z.infer<typeof BiomePalettePathSchema>;

export const BiomePaletteSchema = z.object({
  ground: BiomePaletteGroundSchema,
  vegetation: z.record(z.string(), BiomePaletteVegetationSchema),
  water: BiomePaletteWaterSchema.optional(),
  path: BiomePalettePathSchema.optional(),
});
export type BiomePalette = z.infer<typeof BiomePaletteSchema>;

export const BiomeDensitySchema = z.object({
  vegetation: z.number(),
  structures: z.number(),
  characters: z.number(),
});
export type BiomeDensity = z.infer<typeof BiomeDensitySchema>;

export const BiomeAmbientSchema = z.object({
  lighting: z.string(),
  particles: z.string().optional(),
  weather: z.string().optional(),
});
export type BiomeAmbient = z.infer<typeof BiomeAmbientSchema>;

export const BiomeConfigSchema = z.object({
  type: z.string(),
  terrain: z.object({
    primary: z.string(),
    secondary: z.string(),
    features: z.array(z.string()),
  }),
  palette: BiomePaletteSchema,
  density: BiomeDensitySchema,
  ambient: BiomeAmbientSchema,
});
export type BiomeConfig = z.infer<typeof BiomeConfigSchema>;

export const BiomeDistributionSchema = z.object({
  type: z.string(),
  seed: z.number(),
  biomes: z.record(z.string(), z.number()),
});
export type BiomeDistribution = z.infer<typeof BiomeDistributionSchema>;

// Forward-declare ZoneSchema (needs BiomeConfig)
export const ZoneSchema = z.object({
  id: ZoneIdSchema,
  coords: PointSchema,
  biome: BiomeConfigSchema,
  tiles: z.array(TileLayerSchema),
  characters: z.array(CharacterIdSchema),
  buildings: z.array(BuildingSchema),
  objects: z.array(WorldObjectSchema),
  exits: z.array(ZoneExitSchema),
  generated: z.boolean(),
  generationSeed: z.string(),
  lastVisited: z.number(),
  metadata: ZoneMetadataSchema,
});
export type Zone = z.infer<typeof ZoneSchema>;

// ── World Seed ──────────────────────────────────────────────

export const WorldSeedSchema = z.object({
  originalPrompt: z.string(),
  setting: z.object({
    name: z.string(),
    type: z.string(),
    era: z.string(),
    tone: z.string(),
    description: z.string(),
  }),
  biomeMap: z.object({
    center: BiomeConfigSchema,
    distribution: BiomeDistributionSchema,
  }),
  initialNarrative: z.object({
    hooks: z.array(z.string()),
    mainTension: z.string(),
    atmosphere: z.string(),
  }),
  worldRules: z.object({
    hasMagic: z.boolean(),
    techLevel: z.string(),
    economy: z.string(),
    dangers: z.array(z.string()),
    customs: z.array(z.string()),
  }),
});
export type WorldSeed = z.infer<typeof WorldSeedSchema>;

// ── Character ───────────────────────────────────────────────

export const CharacterIdentitySchema = z.object({
  name: z.string(),
  age: z.string(),
  role: z.string(),
  personality: z.array(z.string()),
  backstory: z.string(),
  speechPattern: z.string(),
  secrets: z.array(z.string()),
});
export type CharacterIdentity = z.infer<typeof CharacterIdentitySchema>;

export const CharacterDisplaySchema = z.object({
  char: z.string(),
  fg: z.string(),
  bg: z.string().optional(),
  bold: z.boolean().optional(),
});
export type CharacterDisplay = z.infer<typeof CharacterDisplaySchema>;

export const CharacterVisualSchema = z.object({
  display: CharacterDisplaySchema,
  facing: z.record(DirectionSchema, z.string()).optional(),
  idleAnimation: z.array(z.string()).optional(),
  nameplate: z.string(),
});
export type CharacterVisual = z.infer<typeof CharacterVisualSchema>;

export const CharacterStateSchema = z.object({
  currentZone: ZoneIdSchema,
  position: PointSchema,
  facing: DirectionSchema,
  mood: z.string(),
  currentActivity: z.string(),
  health: z.string(),
  goals: z.array(z.string()),
});
export type CharacterState = z.infer<typeof CharacterStateSchema>;

// CharacterBehavior is recursive (schedule contains CharacterBehavior),
// so we use z.lazy() for the schedule field.
export const CharacterBehaviorSchema: z.ZodType<CharacterBehavior> = z.object({
  type: z.enum([
    "stationary",
    "patrol",
    "wander",
    "follow_path",
    "idle_actions",
  ]),
  params: z.object({
    patrolPoints: z.array(PointSchema).optional(),
    wanderRadius: z.number().optional(),
    path: z.array(PointSchema).optional(),
    idleActions: z.array(z.string()).optional(),
  }),
  schedule: z
    .object({
      morning: z.lazy(() => CharacterBehaviorSchema),
      afternoon: z.lazy(() => CharacterBehaviorSchema),
      evening: z.lazy(() => CharacterBehaviorSchema),
      night: z.lazy(() => CharacterBehaviorSchema),
    })
    .optional(),
});
export type CharacterBehavior = {
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
};

export const MemoryEntrySchema = z.object({
  type: z.string(),
  summary: z.string(),
  timestamp: z.number(),
  emotionalWeight: z.number(),
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

export const CharacterRelationshipSchema = z.object({
  type: z.string(),
  trust: z.number(),
  familiarity: z.number(),
  history: z.string(),
});
export type CharacterRelationship = z.infer<typeof CharacterRelationshipSchema>;

export const CharacterMemoryDataSchema = z.object({
  personalExperiences: z.array(MemoryEntrySchema),
  heardRumors: z.array(MemoryEntrySchema),
  playerRelationship: z.object({
    trust: z.number(),
    familiarity: z.number(),
    lastInteraction: z.string().optional(),
    impressions: z.array(z.string()),
  }),
});
export type CharacterMemoryData = z.infer<typeof CharacterMemoryDataSchema>;

export const CharacterSchema = z.object({
  id: CharacterIdSchema,
  worldId: z.string(),
  identity: CharacterIdentitySchema,
  visual: CharacterVisualSchema,
  state: CharacterStateSchema,
  behavior: CharacterBehaviorSchema,
  memory: CharacterMemoryDataSchema,
  relationships: z.map(z.string(), CharacterRelationshipSchema),
});
export type Character = z.infer<typeof CharacterSchema>;

export const CharacterDefSchema = z.object({
  identity: CharacterIdentitySchema,
  visual: CharacterVisualSchema,
  state: CharacterStateSchema.omit({ currentZone: true }),
  behavior: CharacterBehaviorSchema,
});
export type CharacterDef = z.infer<typeof CharacterDefSchema>;

// ── Player ──────────────────────────────────────────────────

export const InventoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.string(),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

export const JournalEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  gameTime: z.number(),
  text: z.string(),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const PlayerJournalSchema = z.object({
  entries: z.array(JournalEntrySchema),
  knownCharacters: z.array(z.string()),
  discoveredZones: z.array(z.string()),
  activeQuests: z.array(z.string()),
});
export type PlayerJournal = z.infer<typeof PlayerJournalSchema>;

export const PlayerStatsSchema = z.object({
  totalPlayTime: z.number(),
  conversationsHad: z.number(),
  zonesExplored: z.number(),
  daysSurvived: z.number(),
});
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;

export const PlayerStateSchema = z.object({
  position: z.object({
    zone: ZoneIdSchema,
    x: z.number(),
    y: z.number(),
  }),
  facing: DirectionSchema,
  inventory: z.array(InventoryItemSchema),
  journal: PlayerJournalSchema,
  stats: PlayerStatsSchema,
});
export type PlayerState = z.infer<typeof PlayerStateSchema>;

// ── Chronicle ───────────────────────────────────────────────

export const ChronicleEntryTypeSchema = z.enum([
  "conversation",
  "event",
  "player_action",
  "world_change",
  "narration",
]);
export type ChronicleEntryType = z.infer<typeof ChronicleEntryTypeSchema>;

export const ChronicleEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  gameTime: z.number(),
  type: ChronicleEntryTypeSchema,
  zone: ZoneIdSchema,
  summary: z.string(),
  details: z.string().optional(),
  characters: z.array(CharacterIdSchema).optional(),
  narrativeThreads: z.array(z.string()).optional(),
});
export type ChronicleEntry = z.infer<typeof ChronicleEntrySchema>;

export const NarrativeThreadSchema = z.object({
  id: z.string(),
  summary: z.string(),
  active: z.boolean(),
  entries: z.array(z.string()),
  tension: z.number(),
});
export type NarrativeThread = z.infer<typeof NarrativeThreadSchema>;

// ── Events & Effects ────────────────────────────────────────

export const GameEventTypeSchema = z.enum([
  "ambient",
  "minor",
  "moderate",
  "major",
  "dramatic",
]);
export type GameEventType = z.infer<typeof GameEventTypeSchema>;

export const ZoneChangesSchema = z.object({
  metadata: ZoneMetadataSchema.partial().optional(),
  addObjects: z.array(WorldObjectSchema).optional(),
  removeObjectIds: z.array(z.string()).optional(),
  addCharacters: z.array(CharacterIdSchema).optional(),
  removeCharacters: z.array(CharacterIdSchema).optional(),
});
export type ZoneChanges = z.infer<typeof ZoneChangesSchema>;

export const EffectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("character_move"),
    characterId: CharacterIdSchema,
    targetZone: ZoneIdSchema,
    targetPos: PointSchema,
  }),
  z.object({
    type: z.literal("character_spawn"),
    zone: ZoneIdSchema,
    characterDef: CharacterDefSchema,
  }),
  z.object({
    type: z.literal("character_remove"),
    characterId: CharacterIdSchema,
    reason: z.string(),
  }),
  z.object({
    type: z.literal("character_state"),
    characterId: CharacterIdSchema,
    changes: CharacterStateSchema.partial(),
  }),
  z.object({
    type: z.literal("weather_change"),
    weather: z.string(),
    duration: z.number(),
  }),
  z.object({
    type: z.literal("lighting_change"),
    lighting: z.string(),
    transition: z.number(),
  }),
  z.object({
    type: z.literal("object_spawn"),
    zone: ZoneIdSchema,
    objectDef: WorldObjectSchema,
  }),
  z.object({
    type: z.literal("object_remove"),
    zone: ZoneIdSchema,
    objectId: z.string(),
  }),
  z.object({
    type: z.literal("narration"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("zone_modify"),
    zone: ZoneIdSchema,
    changes: ZoneChangesSchema,
  }),
]);
export type Effect = z.infer<typeof EffectSchema>;

export const GameEventSchema = z.object({
  id: z.string(),
  type: GameEventTypeSchema,
  description: z.string(),
  effects: z.array(EffectSchema),
  chronicleEntry: z.string(),
});
export type GameEvent = z.infer<typeof GameEventSchema>;

// ── Conversation ────────────────────────────────────────────

export const ConversationTurnSchema = z.object({
  speaker: z.enum(["player", "character"]),
  text: z.string(),
  type: z.enum(["dialogue", "action", "narration"]),
  timestamp: z.number(),
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

export const ConversationStateSchema = z.object({
  characterId: CharacterIdSchema,
  turns: z.array(ConversationTurnSchema),
  startedAt: z.number(),
  mood: z.string(),
  topicsDiscussed: z.array(z.string()),
  isActive: z.boolean(),
});
export type ConversationState = z.infer<typeof ConversationStateSchema>;

// ── Weather ─────────────────────────────────────────────────

export const WeatherStateSchema = z.object({
  current: z.string(),
  intensity: z.number(),
  duration: z.number(),
  startedAt: z.number(),
});
export type WeatherState = z.infer<typeof WeatherStateSchema>;

// ── Game Mode ───────────────────────────────────────────────

export const GameModeSchema = z.enum([
  "exploration",
  "dialogue",
  "journal",
  "inventory",
  "map",
  "menu",
]);
export type GameMode = z.infer<typeof GameModeSchema>;

// ── Time of Day ─────────────────────────────────────────────

export const TimeOfDaySchema = z.enum([
  "dawn",
  "morning",
  "afternoon",
  "dusk",
  "evening",
  "night",
]);
export type TimeOfDay = z.infer<typeof TimeOfDaySchema>;
