import type { GameMode, Character, Point, Direction } from "@daydream/engine";
import { EventBus } from "@daydream/engine";
import { findAdjacentCharacters } from "@daydream/renderer";

export interface KeyEvent {
  name: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface MovementContext {
  playerX: number;
  playerY: number;
  characters: Character[];
  tryMove: (dx: number, dy: number) => void;
}

/** Callback fired when an audio toggle key is pressed during exploration. */
export type AudioToggleHandler = (toggle: "music" | "sfx") => void;

/**
 * Routes keyboard input to appropriate handlers based on the current game mode.
 * Emits events via EventBus for cross-system communication.
 */
export class InputRouter {
  private _mode: GameMode = "exploration";
  private eventBus: EventBus;
  private movementCtx: MovementContext | null = null;
  private dialogueHandler: ((key: KeyEvent) => void) | null = null;
  private mapHandler: ((key: KeyEvent) => void) | null = null;
  private portalHandler: ((key: KeyEvent) => void) | null = null;
  private audioToggleHandler: AudioToggleHandler | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  get mode(): GameMode {
    return this._mode;
  }

  setMode(mode: GameMode): void {
    const from = this._mode;
    if (from === mode) return;
    this._mode = mode;
    this.eventBus.emit("mode:changed", { from, to: mode });
  }

  setMovementContext(ctx: MovementContext): void {
    this.movementCtx = ctx;
  }

  setDialogueHandler(handler: ((key: KeyEvent) => void) | null): void {
    this.dialogueHandler = handler;
  }

  setMapHandler(handler: ((key: KeyEvent) => void) | null): void {
    this.mapHandler = handler;
  }

  setPortalHandler(handler: ((key: KeyEvent) => void) | null): void {
    this.portalHandler = handler;
  }

  setAudioToggleHandler(handler: AudioToggleHandler | null): void {
    this.audioToggleHandler = handler;
  }

  handleKey(key: KeyEvent): void {
    switch (this._mode) {
      case "exploration":
        this.handleExploration(key);
        break;
      case "dialogue":
        this.handleDialogue(key);
        break;
      case "map":
        this.handleMap(key);
        break;
      case "menu":
        this.handleMenu(key);
        break;
      case "portal":
        this.handlePortal(key);
        break;
    }
  }

  private handleExploration(key: KeyEvent): void {
    // Movement
    let dx = 0;
    let dy = 0;
    let facing: Direction | null = null;

    switch (key.name) {
      case "up": case "w": case "k":
        dy = -1; facing = "up"; break;
      case "down": case "s": case "j":
        dy = 1; facing = "down"; break;
      case "left": case "a": case "h":
        dx = -1; facing = "left"; break;
      case "right": case "d": case "l":
        dx = 1; facing = "right"; break;

      // Interaction
      case "e": case "return":
        this.interactWithNearby();
        return;

      // Audio toggles
      case "m":
        this.audioToggleHandler?.("music");
        return;
      case "n":
        this.audioToggleHandler?.("sfx");
        return;

      // Overlays
      case "M":
        this.setMode("map");
        return;
      case "p":
        this.setMode("portal");
        return;
      case "escape":
        this.setMode("menu");
        return;
    }

    if ((dx !== 0 || dy !== 0) && this.movementCtx) {
      this.movementCtx.tryMove(dx, dy);
    }
  }

  private handleDialogue(key: KeyEvent): void {
    // Delegate to the registered dialogue handler (DialoguePanel manages Escape logic)
    this.dialogueHandler?.(key);
  }

  private handleMap(key: KeyEvent): void {
    // Delegate to the registered map handler (LocationBrowser manages navigation)
    this.mapHandler?.(key);
  }

  private handlePortal(key: KeyEvent): void {
    // Delegate to the registered portal handler (PortalPrompt manages input + Escape)
    this.portalHandler?.(key);
  }

  private handleMenu(key: KeyEvent): void {
    // Menu mode is stubbed — will be fleshed out in TUI Layout / Polish tasks.
    if (key.name === "escape") {
      this.setMode("exploration");
    }
  }

  private interactWithNearby(): void {
    if (!this.movementCtx) return;
    const { playerX, playerY, characters } = this.movementCtx;
    const adjacent = findAdjacentCharacters(characters, { x: playerX, y: playerY });
    if (adjacent.length > 0) {
      // Interact with the first adjacent character
      const target = adjacent[0]!;
      this.eventBus.emit("character:interact", { characterId: target.id });
    }
  }
}
