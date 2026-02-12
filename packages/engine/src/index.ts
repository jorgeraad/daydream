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

// World
export { WorldState } from "./world/WorldState.ts";
export { zoneId, parseZoneCoords, getTileAt, getLayer, isPassable, adjacentZoneIds } from "./world/Zone.ts";
export { createBiomeConfig, blendPalettes } from "./world/BiomeSystem.ts";

// Character
export { createDefaultMemory, getRelevantMemories, addConversationMemory, getRelationship, setRelationship } from "./character/Character.ts";

// Chronicle
export { Chronicle } from "./chronicle/Chronicle.ts";

// Events
export { EventBus } from "./event/EventSystem.ts";
export type { GameEvents } from "./event/EventSystem.ts";
