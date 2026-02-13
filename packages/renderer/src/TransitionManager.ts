import { BrightnessEffect, type CliRenderer, type OptimizedBuffer } from "@opentui/core";

/**
 * Per-transition overrides for fade durations.
 */
export interface TransitionOverrides {
  fadeOutMs?: number;
  fadeInMs?: number;
}

/** Default fade-out duration in milliseconds. */
const DEFAULT_FADE_OUT_MS = 300;
/** Default fade-in duration in milliseconds. */
const DEFAULT_FADE_IN_MS = 200;

/**
 * Manages zone transition animations using brightness dimming.
 *
 * During a transition:
 * 1. Fade out — brightness interpolates from 1.0 to 0.0 over fadeOutMs
 * 2. Swap — onSwap callback runs (screen is black)
 * 3. Fade in — brightness interpolates from 0.0 to 1.0 over fadeInMs
 *
 * Uses OpenTUI's BrightnessEffect as a post-process filter and
 * requestLive()/dropLive() for continuous animation rendering.
 */
export class TransitionManager {
  private renderer: CliRenderer;
  private transitioning = false;
  private brightnessEffect: BrightnessEffect;

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;
    this.brightnessEffect = new BrightnessEffect(1.0);
  }

  /**
   * Whether a transition is currently in progress.
   * Callers should use this to block player input during transitions.
   */
  get isTransitioning(): boolean {
    return this.transitioning;
  }

  /**
   * Perform a fade-out/swap/fade-in transition.
   *
   * @param onSwap - Called at the midpoint (screen is black) to swap zone data.
   * @param overrides - Optional per-transition duration overrides.
   * @returns Promise that resolves when the full transition is complete.
   */
  async fadeTransition(
    onSwap: () => void,
    overrides?: TransitionOverrides,
  ): Promise<void> {
    if (this.transitioning) return;

    const fadeOutMs = overrides?.fadeOutMs ?? DEFAULT_FADE_OUT_MS;
    const fadeInMs = overrides?.fadeInMs ?? DEFAULT_FADE_IN_MS;

    this.transitioning = true;

    // Register the brightness post-process filter
    const postProcess = (buffer: OptimizedBuffer, _deltaTime: number) => {
      this.brightnessEffect.apply(buffer);
    };
    this.renderer.addPostProcessFn(postProcess);
    this.renderer.requestLive();

    try {
      // Phase 1: Fade out (dim toward black)
      await this.animateBrightness(1.0, 0.0, fadeOutMs);

      // Phase 2: Swap zone data (instant, screen is black)
      onSwap();

      // Phase 3: Fade in (brighten from black)
      await this.animateBrightness(0.0, 1.0, fadeInMs);
    } finally {
      // Clean up: remove post-process filter and drop live rendering
      this.brightnessEffect.brightness = 1.0;
      this.renderer.removePostProcessFn(postProcess);
      this.renderer.dropLive();
      this.transitioning = false;
    }
  }

  /**
   * Animate brightness from `from` to `to` over `durationMs`.
   * Uses requestAnimationFrame-style timing via setTimeout for
   * smooth interpolation.
   */
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

        // Linear interpolation
        this.brightnessEffect.brightness = from + (to - from) * progress;

        if (progress >= 1.0) {
          this.brightnessEffect.brightness = to;
          resolve();
        } else {
          // ~60fps tick rate
          setTimeout(tick, 16);
        }
      };

      tick();
    });
  }
}
