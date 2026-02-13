// WaterShimmer — cycles through animFrame characters with position-based
// phase offsets for a rippling, light-catching surface effect.

import type { Animation, AnimationOverrides } from "./types.ts";

/** Default interval for water shimmer frame cycling (ms). */
const DEFAULT_SHIMMER_INTERVAL = 600;

/** Default water animation frames when tile has none. */
const DEFAULT_WATER_FRAMES = ["~", "\u2248", "\u223C"]; // ~, ≈, ∼

/**
 * Water shimmer animation for water tiles.
 * Cycles through animFrame characters at a configurable interval.
 * Each tile gets a deterministic phase offset from its (x, y) position,
 * preventing the synchronized grid effect where all tiles change at once.
 */
export class WaterShimmer implements Animation {
  finished = false;
  private timer: number;
  private frameIndex = 0;
  private frames: string[];
  private x: number;
  private y: number;
  private interval: number;

  constructor(
    x: number,
    y: number,
    frames?: string[],
    interval: number = DEFAULT_SHIMMER_INTERVAL,
  ) {
    this.x = x;
    this.y = y;
    this.frames = frames?.length ? frames : DEFAULT_WATER_FRAMES;
    this.interval = interval;
    // Deterministic phase offset from position — prevents synchronized grid.
    // Uses prime multipliers to spread phases across different positions.
    this.timer = ((x * 7 + y * 13) % 5) * (interval / 5);
  }

  update(deltaTime: number): void {
    this.timer += deltaTime;
    if (this.timer >= this.interval) {
      this.timer -= this.interval;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }
  }

  applyOverrides(overrides: AnimationOverrides): void {
    const key = `${this.x},${this.y}`;
    overrides.set(key, {
      char: this.frames[this.frameIndex],
    });
  }

  /** Get the current frame index (useful for testing). */
  get currentFrame(): number {
    return this.frameIndex;
  }

  /** Get the current timer value (useful for testing). */
  get currentTimer(): number {
    return this.timer;
  }
}
