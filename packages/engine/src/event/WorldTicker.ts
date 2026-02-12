import type {
  Character,
  ChronicleEntry,
  GameEvent,
  NarrativeThread,
  TimeOfDay,
  WeatherState,
  Zone,
} from "../types.ts";
import type { Chronicle } from "../chronicle/Chronicle.ts";
import type { WorldState } from "../world/WorldState.ts";
import type { WorldClock } from "./WorldClock.ts";
import { EventBus, EventQueue } from "./EventSystem.ts";

export interface TickContext {
  currentZone: Zone;
  nearbyCharacters: Character[];
  timeOfDay: TimeOfDay;
  weather: WeatherState;
  recentPlayerActions: ChronicleEntry[];
  activeNarrativeThreads: NarrativeThread[];
}

export interface TickEventProvider {
  generateTickEvents(context: TickContext): Promise<GameEvent[]>;
}

export class WorldTicker {
  private tickTimer: number;
  private readonly tickInterval: number;
  private provider: TickEventProvider | null = null;
  private ticking: boolean = false;

  static readonly DEFAULT_INTERVAL = 300_000; // 5 minutes in ms

  constructor(options?: { tickInterval?: number }) {
    this.tickInterval = options?.tickInterval ?? WorldTicker.DEFAULT_INTERVAL;
    this.tickTimer = this.tickInterval;
  }

  setProvider(provider: TickEventProvider): void {
    this.provider = provider;
  }

  async update(
    realDeltaMs: number,
    buildContext: () => TickContext,
  ): Promise<GameEvent[]> {
    if (this.ticking) return [];

    this.tickTimer -= realDeltaMs;

    if (this.tickTimer <= 0) {
      this.tickTimer = this.tickInterval;

      if (!this.provider) return [];

      this.ticking = true;
      try {
        const context = buildContext();
        return await this.provider.generateTickEvents(context);
      } finally {
        this.ticking = false;
      }
    }

    return [];
  }

  /**
   * Process generated tick events: apply effects, record in chronicle, emit bus events.
   */
  processTickEvents(
    events: GameEvent[],
    worldState: WorldState,
    chronicle: Chronicle,
    eventQueue: EventQueue,
    eventBus: EventBus,
  ): void {
    for (const event of events) {
      // Apply all effects to world state
      for (const effect of event.effects) {
        worldState.applyEffect(effect);
      }

      // Record in chronicle
      const entryId = `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const entry: ChronicleEntry = {
        id: entryId,
        timestamp: Date.now(),
        gameTime: worldState.playTime,
        type: "event",
        zone: worldState.activeZoneId,
        summary: event.chronicleEntry || event.description,
      };
      chronicle.append(entry);
      eventBus.emit("chronicle:entry", { entry });

      // Queue as immediate for further processing
      eventQueue.queueImmediate(event);

      // Notify listeners
      eventBus.emit("event:triggered", { event });
    }

    // Emit world:tick with all events
    if (events.length > 0) {
      eventBus.emit("world:tick", { events });
    }
  }

  reset(): void {
    this.tickTimer = this.tickInterval;
    this.ticking = false;
  }

  getTimeUntilNextTick(): number {
    return Math.max(0, this.tickTimer);
  }

  isTicking(): boolean {
    return this.ticking;
  }
}
