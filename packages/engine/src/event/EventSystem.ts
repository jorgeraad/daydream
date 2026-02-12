import type {
  Zone,
  ChronicleEntry,
  ConversationState,
  GameEvent,
  GameMode,
  Point,
} from "../types.ts";

// Typed event map for cross-system communication
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
