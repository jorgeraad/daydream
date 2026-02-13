import { RGBA, TextAttributes, type OptimizedBuffer } from "@opentui/core";
import type { Direction } from "@daydream/engine";

// ── Spinner frames ─────────────────────────────────────────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// ── State machine ──────────────────────────────────────────

/**
 * Zone loading indicator states:
 * - `hidden`   — not visible
 * - `loading`  — spinner + message shown at a viewport edge
 * - `done`     — loading complete, indicator hidden
 */
export type ZoneLoadingState = "hidden" | "loading" | "done";

// ── Config ─────────────────────────────────────────────────

export interface ZoneLoadingConfig {
  /** Spinner rotation interval in ms (default: 80). */
  spinnerIntervalMs?: number;
  /** Foreground color for the indicator (default: dim white). */
  fg?: string;
  /** Background color for the indicator (default: dark). */
  bg?: string;
}

const DEFAULT_CONFIG: Required<ZoneLoadingConfig> = {
  spinnerIntervalMs: 80,
  fg: "#9aa5ce",
  bg: "#1a1b26",
};

// ── ZoneLoadingIndicator ───────────────────────────────────

/**
 * A brief, inline loading indicator rendered at a viewport edge
 * while a neighboring zone is being generated. Unlike the full-screen
 * LoadingScreen, this is lightweight and overlays the existing view.
 *
 * Usage:
 *   indicator.show("right", "Generating zone...");
 *   // In game loop: indicator.update(deltaMs);
 *   // In render loop: indicator.render(buffer, viewWidth, viewHeight);
 *   indicator.hide();
 */
export class ZoneLoadingIndicator {
  private _state: ZoneLoadingState = "hidden";
  private _edge: Direction = "right";
  private _message = "Loading...";
  private spinnerFrame = 0;
  private spinnerTimer = 0;
  private config: Required<ZoneLoadingConfig>;

  constructor(config?: ZoneLoadingConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Current state of the indicator. */
  get state(): ZoneLoadingState {
    return this._state;
  }

  /** Current edge where the indicator is shown. */
  get edge(): Direction {
    return this._edge;
  }

  /** Current spinner frame index (for testing). */
  get currentSpinnerFrame(): number {
    return this.spinnerFrame;
  }

  /**
   * Show the loading indicator at the specified viewport edge.
   * Transitions: hidden -> loading.
   */
  show(edge: Direction, message?: string): void {
    this._state = "loading";
    this._edge = edge;
    this._message = message ?? "Loading...";
    this.spinnerFrame = 0;
    this.spinnerTimer = 0;
  }

  /**
   * Hide the indicator.
   * Transitions: loading -> done.
   */
  hide(): void {
    if (this._state === "hidden") return;
    this._state = "done";
  }

  /**
   * Reset the indicator back to hidden for reuse.
   * Transitions: done -> hidden.
   */
  reset(): void {
    this._state = "hidden";
    this.spinnerFrame = 0;
    this.spinnerTimer = 0;
  }

  /**
   * Advance the spinner animation.
   * Call this each frame with the elapsed delta time.
   */
  update(deltaMs: number): void {
    if (this._state !== "loading") return;

    this.spinnerTimer += deltaMs;
    if (this.spinnerTimer >= this.config.spinnerIntervalMs) {
      this.spinnerTimer -= this.config.spinnerIntervalMs;
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER_FRAMES.length;
    }
  }

  /**
   * Render the indicator onto the given buffer.
   * Draws a small spinner + message near the relevant viewport edge.
   *
   * @param buffer - The OptimizedBuffer to draw into.
   * @param viewWidth - Viewport width in cells.
   * @param viewHeight - Viewport height in cells.
   */
  render(
    buffer: OptimizedBuffer,
    viewWidth: number,
    viewHeight: number,
  ): void {
    if (this._state !== "loading") return;

    const spinner = SPINNER_FRAMES[this.spinnerFrame] ?? SPINNER_FRAMES[0]!;
    const text = `${spinner} ${this._message}`;
    const fg = RGBA.fromHex(this.config.fg);
    const bg = RGBA.fromHex(this.config.bg);

    // Determine position based on edge
    const { x, y } = this.getPosition(text.length, viewWidth, viewHeight);

    // Write each character of the indicator text
    for (let i = 0; i < text.length; i++) {
      const cx = x + i;
      if (cx >= 0 && cx < viewWidth && y >= 0 && y < viewHeight) {
        buffer.setCell(cx, y, text[i]!, fg, bg, TextAttributes.NONE);
      }
    }
  }

  /**
   * Compute the x,y position for the indicator text based on the edge.
   * Centers the text along the relevant edge.
   */
  private getPosition(
    textLen: number,
    viewWidth: number,
    viewHeight: number,
  ): { x: number; y: number } {
    switch (this._edge) {
      case "up":
        return {
          x: Math.max(0, Math.floor((viewWidth - textLen) / 2)),
          y: 1,
        };
      case "down":
        return {
          x: Math.max(0, Math.floor((viewWidth - textLen) / 2)),
          y: viewHeight - 2,
        };
      case "left":
        return {
          x: 1,
          y: Math.floor(viewHeight / 2),
        };
      case "right":
        return {
          x: Math.max(0, viewWidth - textLen - 1),
          y: Math.floor(viewHeight / 2),
        };
    }
  }
}
