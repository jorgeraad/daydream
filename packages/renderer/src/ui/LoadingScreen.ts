import {
  BrightnessEffect,
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
  type OptimizedBuffer,
} from "@opentui/core";

// ── Spinner frames ─────────────────────────────────────────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// ── State machine ──────────────────────────────────────────

/**
 * Loading screen states:
 * - `idle`      — constructed but not yet shown
 * - `active`    — visible, spinner animating, messages cycling
 * - `fading`    — brightness fading from 1.0 to 0.0 before removal
 * - `done`      — fully hidden and cleaned up
 */
export type LoadingState = "idle" | "active" | "fading" | "done";

// ── Flavor text ────────────────────────────────────────────

/** Atmospheric flavor text that rotates beneath the main status message. */
const DEFAULT_FLAVOR_TEXTS = [
  "The mist parts slowly...",
  "Ancient runes shimmer into view...",
  "Whispers echo in the distance...",
  "A path reveals itself...",
  "The land takes shape around you...",
  "Stars align overhead...",
  "Crystalline formations emerge...",
  "The air hums with energy...",
];

// ── Config ─────────────────────────────────────────────────

export interface LoadingScreenConfig {
  /** Spinner rotation interval in ms (default: 80). */
  spinnerIntervalMs?: number;
  /** How often flavor text changes in ms (default: 3000). */
  flavorIntervalMs?: number;
  /** Fade-out duration in ms (default: 400). */
  fadeOutMs?: number;
  /** Custom flavor texts (default: built-in atmospheric texts). */
  flavorTexts?: string[];
}

const DEFAULT_CONFIG: Required<LoadingScreenConfig> = {
  spinnerIntervalMs: 80,
  flavorIntervalMs: 3000,
  fadeOutMs: 400,
  flavorTexts: DEFAULT_FLAVOR_TEXTS,
};

// ── Colors ─────────────────────────────────────────────────

const COLOR_BG = "#0a0a1a";
const COLOR_SPINNER = "#7aa2f7";
const COLOR_STATUS = "#c0caf5";
const COLOR_FLAVOR = "#565f89";

// ── LoadingScreen ──────────────────────────────────────────

export class LoadingScreen {
  private container: BoxRenderable;
  private spinnerText: TextRenderable;
  private statusText: TextRenderable;
  private flavorText: TextRenderable;

  private _state: LoadingState = "idle";
  private spinnerFrame = 0;
  private flavorIndex = 0;
  private spinnerTimer: ReturnType<typeof setInterval> | null = null;
  private flavorTimer: ReturnType<typeof setInterval> | null = null;

  private config: Required<LoadingScreenConfig>;
  private renderer: CliRenderer;
  private brightnessEffect: BrightnessEffect;

  constructor(renderer: CliRenderer, config?: LoadingScreenConfig) {
    this.renderer = renderer;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.brightnessEffect = new BrightnessEffect(1.0);

    // ── Build UI tree ──────────────────────────────────
    this.container = new BoxRenderable(renderer, {
      id: "loading-screen",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLOR_BG,
    });

    this.spinnerText = new TextRenderable(renderer, {
      id: "loading-spinner",
      content: SPINNER_FRAMES[0]!,
      fg: COLOR_SPINNER,
    });
    this.container.add(this.spinnerText);

    this.statusText = new TextRenderable(renderer, {
      id: "loading-status",
      content: "\nGenerating world...",
      fg: COLOR_STATUS,
    });
    this.container.add(this.statusText);

    this.flavorText = new TextRenderable(renderer, {
      id: "loading-flavor",
      content: `\n${this.config.flavorTexts[0] ?? ""}`,
      fg: COLOR_FLAVOR,
    });
    this.container.add(this.flavorText);
  }

  // ── Public API ───────────────────────────────────────────

  /** Current state of the loading screen state machine. */
  get state(): LoadingState {
    return this._state;
  }

  /** Current spinner frame index (for testing). */
  get currentSpinnerFrame(): number {
    return this.spinnerFrame;
  }

  /** Current flavor text index (for testing). */
  get currentFlavorIndex(): number {
    return this.flavorIndex;
  }

  /**
   * Show the loading screen and start animations.
   * Transitions: idle -> active.
   */
  show(): void {
    if (this._state !== "idle") return;
    this._state = "active";

    this.renderer.root.add(this.container);
    this.startSpinner();
    this.startFlavorCycling();
    this.renderer.requestRender();
  }

  /**
   * Update the primary status message.
   * Only works while active.
   */
  setStatus(status: string): void {
    if (this._state !== "active") return;
    this.statusText.content = `\n${status}`;
    this.renderer.requestRender();
  }

  /**
   * Fade out the loading screen and remove it.
   * Transitions: active -> fading -> done.
   * Returns a promise that resolves when the fade is complete.
   */
  async fadeOut(): Promise<void> {
    if (this._state !== "active") return;
    this._state = "fading";

    // Stop message cycling (spinner stays alive during fade for visual continuity)
    this.stopFlavorCycling();

    const fadeOutMs = this.config.fadeOutMs;

    // Register brightness post-process filter
    const postProcess = (buffer: OptimizedBuffer, _deltaTime: number) => {
      this.brightnessEffect.apply(buffer);
    };
    this.renderer.addPostProcessFn(postProcess);
    this.renderer.requestLive();

    try {
      await this.animateBrightness(1.0, 0.0, fadeOutMs);
    } finally {
      // Clean up everything
      this.stopSpinner();
      this.brightnessEffect.brightness = 1.0;
      this.renderer.removePostProcessFn(postProcess);
      this.renderer.dropLive();
      this.renderer.root.remove("loading-screen");
      this._state = "done";
    }
  }

  /**
   * Immediately remove the loading screen without a fade.
   * Works from any state except `done`.
   */
  destroy(): void {
    if (this._state === "done") return;
    this.stopSpinner();
    this.stopFlavorCycling();
    this.renderer.root.remove("loading-screen");
    this._state = "done";
  }

  // ── Spinner ──────────────────────────────────────────────

  private startSpinner(): void {
    this.spinnerTimer = setInterval(() => {
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER_FRAMES.length;
      this.spinnerText.content = SPINNER_FRAMES[this.spinnerFrame]!;
      this.renderer.requestRender();
    }, this.config.spinnerIntervalMs);
  }

  private stopSpinner(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }
  }

  // ── Flavor text cycling ──────────────────────────────────

  private startFlavorCycling(): void {
    if (this.config.flavorTexts.length <= 1) return;

    this.flavorTimer = setInterval(() => {
      this.flavorIndex =
        (this.flavorIndex + 1) % this.config.flavorTexts.length;
      this.flavorText.content = `\n${this.config.flavorTexts[this.flavorIndex]}`;
      this.renderer.requestRender();
    }, this.config.flavorIntervalMs);
  }

  private stopFlavorCycling(): void {
    if (this.flavorTimer) {
      clearInterval(this.flavorTimer);
      this.flavorTimer = null;
    }
  }

  // ── Brightness animation ─────────────────────────────────

  private animateBrightness(
    from: number,
    to: number,
    durationMs: number,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      if (durationMs <= 0) {
        this.brightnessEffect.brightness = to;
        resolve();
        return;
      }

      const startTime = performance.now();

      const tick = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1.0);

        // Ease-out cubic for a smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        this.brightnessEffect.brightness = from + (to - from) * eased;

        if (progress >= 1.0) {
          this.brightnessEffect.brightness = to;
          resolve();
        } else {
          setTimeout(tick, 16); // ~60fps
        }
      };

      tick();
    });
  }
}
