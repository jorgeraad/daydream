import type {
  Zone,
  ChronicleEntry,
  ConversationState,
  DeferredEvent,
  Effect,
  GameEvent,
  GameMode,
  Point,
} from "../types.ts";
import type { WorldState } from "../world/WorldState.ts";
import type { Chronicle } from "../chronicle/Chronicle.ts";

// ── Typed Event Map ─────────────────────────────────────────

export interface GameEvents {
  "zone:entered": { zoneId: string };
  "zone:generated": { zone: Zone };
  "character:interact": { characterId: string };
  "dialogue:started": { characterId: string };
  "dialogue:ended": { characterId: string; conversation: ConversationState };
  "event:triggered": { event: GameEvent };
  "chronicle:entry": { entry: ChronicleEntry };
  "world:tick": { events: GameEvent[] };
  "save:started": Record<string, never>;
  "save:completed": Record<string, never>;
  "player:moved": { position: Point; zone: string };
  "mode:changed": { from: GameMode; to: GameMode };
}

type EventHandler<T> = (data: T) => void;

// ── EventBus ────────────────────────────────────────────────

export class EventBus {
  private listeners = new Map<string, Set<EventHandler<unknown>>>();

  on<T extends keyof GameEvents>(
    event: T,
    handler: EventHandler<GameEvents[T]>,
  ): void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler as EventHandler<unknown>);
  }

  off<T extends keyof GameEvents>(
    event: T,
    handler: EventHandler<GameEvents[T]>,
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler<unknown>);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<T extends keyof GameEvents>(event: T, data: GameEvents[T]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  removeAllListeners(event?: keyof GameEvents): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: keyof GameEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// ── EventQueue ──────────────────────────────────────────────

export type ConditionChecker = (condition: string) => boolean;

export class EventQueue {
  private immediateQueue: GameEvent[] = [];
  private deferredQueue: DeferredEvent[] = [];

  queueImmediate(event: GameEvent): void {
    this.immediateQueue.push(event);
  }

  queueDeferred(event: DeferredEvent): void {
    this.deferredQueue.push(event);
  }

  drainImmediate(): GameEvent[] {
    const events = [...this.immediateQueue];
    this.immediateQueue = [];
    return events;
  }

  checkDeferred(checker: ConditionChecker): GameEvent[] {
    const triggered: GameEvent[] = [];
    this.deferredQueue = this.deferredQueue.filter((deferred) => {
      if (checker(deferred.triggerCondition)) {
        triggered.push(deferred.event);
        return false;
      }
      return true;
    });
    return triggered;
  }

  getImmediateCount(): number {
    return this.immediateQueue.length;
  }

  getDeferredCount(): number {
    return this.deferredQueue.length;
  }

  getDeferredEvents(): readonly DeferredEvent[] {
    return this.deferredQueue;
  }

  clear(): void {
    this.immediateQueue = [];
    this.deferredQueue = [];
  }
}

// ── ConsequenceEvaluator ────────────────────────────────────

export interface ConsequenceResult {
  characterStateChanges: Array<{
    characterId: string;
    moodChange?: string;
    relationshipDelta?: number;
    newGoal?: string;
    memoryAdded: string;
  }>;
  deferredEvents: Array<{
    description: string;
    triggerCondition: string;
    effects: string[];
  }>;
  chronicleEntry: string;
  narrativeThreads: string[];
}

export interface ConsequenceProvider {
  evaluate(
    conversation: ConversationState,
    worldContext: string,
  ): Promise<ConsequenceResult>;
}

export class ConsequenceEvaluator {
  private provider: ConsequenceProvider | null = null;

  setProvider(provider: ConsequenceProvider): void {
    this.provider = provider;
  }

  async evaluate(
    conversation: ConversationState,
    worldState: WorldState,
    chronicle: Chronicle,
    eventQueue: EventQueue,
    eventBus: EventBus,
  ): Promise<ConsequenceResult | null> {
    if (!this.provider) return null;

    const worldContext = chronicle.getContextWindow(2000);
    const result = await this.provider.evaluate(conversation, worldContext);

    // Apply character state changes
    for (const change of result.characterStateChanges) {
      const character = worldState.characters.get(change.characterId);
      if (!character) continue;

      const effects: Effect[] = [];

      if (change.moodChange) {
        effects.push({
          type: "character_state",
          characterId: change.characterId,
          changes: { mood: change.moodChange },
        });
      }

      if (change.newGoal) {
        const current = character.state.goals;
        effects.push({
          type: "character_state",
          characterId: change.characterId,
          changes: { goals: [...current, change.newGoal] },
        });
      }

      for (const effect of effects) {
        worldState.applyEffect(effect);
      }
    }

    // Create chronicle entry
    const entryId = `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const chronicleEntry: ChronicleEntry = {
      id: entryId,
      timestamp: Date.now(),
      gameTime: worldState.playTime,
      type: "conversation",
      zone: worldState.activeZoneId,
      summary: result.chronicleEntry,
      characters: [conversation.characterId],
      narrativeThreads:
        result.narrativeThreads.length > 0
          ? result.narrativeThreads
          : undefined,
    };
    chronicle.append(chronicleEntry);
    eventBus.emit("chronicle:entry", { entry: chronicleEntry });

    // Update narrative threads
    for (const threadId of result.narrativeThreads) {
      const existing = chronicle.getThread(threadId);
      if (!existing) {
        chronicle.addThread(threadId, threadId);
      }
    }

    // Queue deferred events from consequences
    for (const deferred of result.deferredEvents) {
      const deferredGameEvent: GameEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: "minor",
        description: deferred.description,
        effects: [],
        chronicleEntry: "",
      };
      eventQueue.queueDeferred({
        event: deferredGameEvent,
        triggerCondition: deferred.triggerCondition,
        createdAt: worldState.playTime,
      });
    }

    return result;
  }
}
