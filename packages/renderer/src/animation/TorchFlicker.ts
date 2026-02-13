// TorchFlicker — rapid character jitter with intermittent dimming
// for fire/torch tiles. Faster and more erratic than water shimmer.

import type { Animation, AnimationOverrides } from "./types.ts";

/** Default interval for torch flicker cycling (ms). */
const DEFAULT_FLICKER_INTERVAL = 200;

/** Default torch animation frames when tile has none. */
const DEFAULT_TORCH_FRAMES = ["\u2020", "\u2021", "\u2726"]; // †, ‡, ✦

/**
 * Torch/fire flicker animation.
 * Cycles through characters rapidly and dims 1-in-4 frames for an erratic
 * flickering effect. Uses animFrames from the tile or falls back to defaults.
 */
export class TorchFlicker implements Animation {
  finished = false;
  private timer = 0;
  private flickerState = 0;
  private frames: string[];
  private x: number;
  private y: number;
  private interval: number;

  constructor(
    x: number,
    y: number,
    frames?: string[],
    interval: number = DEFAULT_FLICKER_INTERVAL,
  ) {
    this.x = x;
    this.y = y;
    this.frames = frames?.length ? frames : DEFAULT_TORCH_FRAMES;
    this.interval = interval;
  }

  update(deltaTime: number): void {
    this.timer += deltaTime;
    if (this.timer >= this.interval) {
      this.timer -= this.interval;
      this.flickerState = (this.flickerState + 1) % 4;
    }
  }

  applyOverrides(overrides: AnimationOverrides): void {
    const key = `${this.x},${this.y}`;

    // Brightness modulation: dim on every 4th frame (flickerState === 3)
    const dimFrame = this.flickerState === 3;

    overrides.set(key, {
      char: this.frames[this.flickerState % this.frames.length],
      dim: dimFrame,
    });
  }

  /** Get the current flicker state (useful for testing). */
  get currentFlickerState(): number {
    return this.flickerState;
  }

  /** Get the current timer value (useful for testing). */
  get currentTimer(): number {
    return this.timer;
  }
}
