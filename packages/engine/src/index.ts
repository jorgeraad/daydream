// @daydream/engine — Core game logic
// World model, character system, event system, chronicle
// No rendering or I/O dependencies — pure game logic, testable in isolation

// Core types
export type {
  BiomeAmbient,
  BiomeConfig,
  BiomeDensity,
  BiomeDistribution,
  BiomePalette,
  BiomePaletteGround,
  BiomePalettePath,
  BiomePaletteVegetation,
  BiomePaletteWater,
  Building,
  Character,
  CharacterBehavior,
  CharacterDef,
  CharacterDisplay,
  CharacterId,
  CharacterIdentity,
  CharacterMemoryData,
  CharacterRelationship,
  CharacterState,
  CharacterVisual,
  ChronicleEntry,
  ChronicleEntryType,
  ConversationState,
  ConversationTurn,
  DeferredEvent,
  Direction,
  Effect,
  GameEvent,
  GameEventType,
  GameMode,
  InventoryItem,
  JournalEntry,
  MemoryEntry,
  NarrativeThread,
  PlayerJournal,
  PlayerState,
  PlayerStats,
  Point,
  TileCell,
  TileLayer,
  TileLayerName,
  TimeOfDay,
  WeatherState,
  WorldObject,
  WorldSeed,
  Zone,
  ZoneChanges,
  ZoneExit,
  ZoneId,
  ZoneMetadata,
} from "./types.ts";

// Zod schemas
export {
  BiomeAmbientSchema,
  BiomeConfigSchema,
  BiomeDensitySchema,
  BiomeDistributionSchema,
  BiomePaletteGroundSchema,
  BiomePalettePathSchema,
  BiomePaletteSchema,
  BiomePaletteVegetationSchema,
  BiomePaletteWaterSchema,
  BuildingSchema,
  CharacterBehaviorSchema,
  CharacterDefSchema,
  CharacterDisplaySchema,
  CharacterIdSchema,
  CharacterIdentitySchema,
  CharacterMemoryDataSchema,
  CharacterRelationshipSchema,
  CharacterSchema,
  CharacterStateSchema,
  CharacterVisualSchema,
  ChronicleEntrySchema,
  ChronicleEntryTypeSchema,
  ConversationStateSchema,
  ConversationTurnSchema,
  DeferredEventSchema,
  DirectionSchema,
  EffectSchema,
  GameEventSchema,
  GameEventTypeSchema,
  GameModeSchema,
  InventoryItemSchema,
  JournalEntrySchema,
  MemoryEntrySchema,
  NarrativeThreadSchema,
  PlayerJournalSchema,
  PlayerStateSchema,
  PlayerStatsSchema,
  PointSchema,
  TileCellSchema,
  TileLayerNameSchema,
  TileLayerSchema,
  TimeOfDaySchema,
  WeatherStateSchema,
  WorldObjectSchema,
  WorldSeedSchema,
  ZoneChangesSchema,
  ZoneExitSchema,
  ZoneIdSchema,
  ZoneMetadataSchema,
  ZoneSchema,
} from "./types.ts";

// World
export { WorldState } from "./world/WorldState.ts";
export { zoneId, parseZoneCoords, getTileAt, getLayer, isPassable, adjacentZoneIds } from "./world/Zone.ts";
export { createBiomeConfig, blendPalettes } from "./world/BiomeSystem.ts";
export { ZoneBuilder } from "./world/ZoneBuilder.ts";
export type { ZoneBuildSpec, ZoneBuildResult, BuildingVisual, ObjectVisual } from "./world/ZoneBuilder.ts";

// Character
export { createDefaultMemory, getRelevantMemories, addConversationMemory, getRelationship, setRelationship } from "./character/Character.ts";
export { CharacterMemory } from "./character/CharacterMemory.ts";

// Chronicle
export { Chronicle } from "./chronicle/Chronicle.ts";
export type { CompressionProvider } from "./chronicle/Chronicle.ts";
export { createNarrativeThread, clampTension } from "./chronicle/NarrativeThread.ts";

// Events
export { EventBus, EventQueue, ConsequenceEvaluator } from "./event/EventSystem.ts";
export type {
  GameEvents,
  ConditionChecker,
  ConsequenceResult,
  ConsequenceProvider,
} from "./event/EventSystem.ts";
export { WorldClock } from "./event/WorldClock.ts";
export { WorldTicker } from "./event/WorldTicker.ts";
export type { TickContext, TickEventProvider } from "./event/WorldTicker.ts";

// Testing
export { createTestLogSink } from "./testing/log-helpers.ts";
export type { CapturedLog } from "./testing/log-helpers.ts";
