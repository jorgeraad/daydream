import type {
  Character,
  CharacterDef,
  CharacterId,
  CharacterState,
  ConversationState,
  Effect,
  GameEvent,
  PlayerState,
  WeatherState,
  WorldObject,
  WorldSeed,
  Zone,
  ZoneId,
} from "../types.ts";
import { Chronicle } from "../chronicle/Chronicle.ts";

export class WorldState {
  readonly worldId: string;
  readonly worldSeed: WorldSeed;
  readonly createdAt: number;

  zones: Map<ZoneId, Zone>;
  characters: Map<CharacterId, Character>;
  player: PlayerState;
  chronicle: Chronicle;
  weather: WeatherState;

  activeZoneId: ZoneId;
  activeConversation: ConversationState | null;
  eventQueue: GameEvent[];
  playTime: number;

  private dirtyZoneIds: Set<ZoneId> = new Set();
  private dirtyCharacterIds: Set<CharacterId> = new Set();

  constructor(params: {
    worldId: string;
    worldSeed: WorldSeed;
    createdAt: number;
    player: PlayerState;
    activeZoneId: ZoneId;
  }) {
    this.worldId = params.worldId;
    this.worldSeed = params.worldSeed;
    this.createdAt = params.createdAt;
    this.player = params.player;
    this.activeZoneId = params.activeZoneId;

    this.zones = new Map();
    this.characters = new Map();
    this.chronicle = new Chronicle();
    this.weather = { current: "clear", intensity: 0, duration: 0, startedAt: 0 };
    this.activeConversation = null;
    this.eventQueue = [];
    this.playTime = 0;
  }

  // ── Derived state ───────────────────────────────────────

  get activeZone(): Zone | undefined {
    return this.zones.get(this.activeZoneId);
  }

  get nearbyCharacters(): Character[] {
    const zone = this.activeZone;
    if (!zone) return [];
    return zone.characters
      .map((id) => this.characters.get(id))
      .filter((c): c is Character => c !== undefined);
  }

  // ── Mutations via Effects ───────────────────────────────

  applyEffect(effect: Effect): void {
    switch (effect.type) {
      case "character_move":
        this.moveCharacter(effect.characterId, effect.targetZone, effect.targetPos);
        break;
      case "character_spawn":
        this.spawnCharacter(effect.zone, effect.characterDef);
        break;
      case "character_remove":
        this.removeCharacter(effect.characterId);
        break;
      case "character_state":
        this.updateCharacterState(effect.characterId, effect.changes);
        break;
      case "weather_change":
        this.weather = {
          current: effect.weather,
          intensity: 1,
          duration: effect.duration,
          startedAt: Date.now(),
        };
        break;
      case "lighting_change":
        // Lighting is handled by the renderer; mark zone dirty
        this.markZoneDirty(this.activeZoneId);
        break;
      case "object_spawn":
        this.spawnObject(effect.zone, effect.objectDef);
        break;
      case "object_remove":
        this.removeObject(effect.zone, effect.objectId);
        break;
      case "narration":
        // Narration is rendered by the UI; no state change needed
        break;
      case "zone_modify":
        this.modifyZone(effect.zone, effect.changes);
        break;
    }
  }

  // ── Dirty tracking ─────────────────────────────────────

  dirtyZones(): Zone[] {
    return [...this.dirtyZoneIds]
      .map((id) => this.zones.get(id))
      .filter((z): z is Zone => z !== undefined);
  }

  dirtyCharacters(): Character[] {
    return [...this.dirtyCharacterIds]
      .map((id) => this.characters.get(id))
      .filter((c): c is Character => c !== undefined);
  }

  clearDirty(): void {
    this.dirtyZoneIds.clear();
    this.dirtyCharacterIds.clear();
  }

  markZoneDirty(zoneId: ZoneId): void {
    this.dirtyZoneIds.add(zoneId);
  }

  markCharacterDirty(characterId: CharacterId): void {
    this.dirtyCharacterIds.add(characterId);
  }

  // ── Internal mutation helpers ───────────────────────────

  private moveCharacter(
    characterId: CharacterId,
    targetZone: ZoneId,
    targetPos: { x: number; y: number },
  ): void {
    const character = this.characters.get(characterId);
    if (!character) return;

    // Remove from old zone
    const oldZone = this.zones.get(character.state.currentZone);
    if (oldZone) {
      oldZone.characters = oldZone.characters.filter((id) => id !== characterId);
      this.markZoneDirty(oldZone.id);
    }

    // Add to new zone
    const newZone = this.zones.get(targetZone);
    if (newZone && !newZone.characters.includes(characterId)) {
      newZone.characters.push(characterId);
      this.markZoneDirty(newZone.id);
    }

    // Update character state
    character.state.currentZone = targetZone;
    character.state.position = targetPos;
    this.markCharacterDirty(characterId);
  }

  private spawnCharacter(zoneId: ZoneId, def: CharacterDef): void {
    const id = `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const character: Character = {
      id,
      worldId: this.worldId,
      identity: def.identity,
      visual: def.visual,
      state: { ...def.state, currentZone: zoneId },
      behavior: def.behavior,
      memory: {
        personalExperiences: [],
        heardRumors: [],
        playerRelationship: { trust: 0, familiarity: 0, impressions: [] },
      },
      relationships: new Map(),
    };

    this.characters.set(id, character);
    this.markCharacterDirty(id);

    const zone = this.zones.get(zoneId);
    if (zone) {
      zone.characters.push(id);
      this.markZoneDirty(zoneId);
    }
  }

  private removeCharacter(characterId: CharacterId): void {
    const character = this.characters.get(characterId);
    if (!character) return;

    const zone = this.zones.get(character.state.currentZone);
    if (zone) {
      zone.characters = zone.characters.filter((id) => id !== characterId);
      this.markZoneDirty(zone.id);
    }

    this.characters.delete(characterId);
    this.dirtyCharacterIds.delete(characterId);
  }

  private updateCharacterState(
    characterId: CharacterId,
    changes: Partial<CharacterState>,
  ): void {
    const character = this.characters.get(characterId);
    if (!character) return;

    Object.assign(character.state, changes);
    this.markCharacterDirty(characterId);
  }

  private spawnObject(zoneId: ZoneId, objectDef: WorldObject): void {
    const zone = this.zones.get(zoneId);
    if (!zone) return;

    zone.objects.push(objectDef);
    this.markZoneDirty(zoneId);
  }

  private removeObject(zoneId: ZoneId, objectId: string): void {
    const zone = this.zones.get(zoneId);
    if (!zone) return;

    zone.objects = zone.objects.filter((o) => o.id !== objectId);
    this.markZoneDirty(zoneId);
  }

  private modifyZone(
    zoneId: ZoneId,
    changes: {
      metadata?: Partial<{ name?: string; description: string; narrativeRole?: string }>;
      addObjects?: WorldObject[];
      removeObjectIds?: string[];
      addCharacters?: CharacterId[];
      removeCharacters?: CharacterId[];
    },
  ): void {
    const zone = this.zones.get(zoneId);
    if (!zone) return;

    if (changes.metadata) {
      Object.assign(zone.metadata, changes.metadata);
    }
    if (changes.addObjects) {
      zone.objects.push(...changes.addObjects);
    }
    if (changes.removeObjectIds) {
      zone.objects = zone.objects.filter(
        (o) => !changes.removeObjectIds!.includes(o.id),
      );
    }
    if (changes.addCharacters) {
      for (const id of changes.addCharacters) {
        if (!zone.characters.includes(id)) {
          zone.characters.push(id);
        }
      }
    }
    if (changes.removeCharacters) {
      zone.characters = zone.characters.filter(
        (id) => !changes.removeCharacters!.includes(id),
      );
    }

    this.markZoneDirty(zoneId);
  }
}
