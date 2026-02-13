// TileCycleAnimation — generic frame-cycling animation for any animated tile.
// Extracted from AnimationManager to be a standalone, exported class.

import type { Animation, AnimationOverrides } from "./types.ts";

/** Default interval for generic tile frame cycling (ms). */
const DEFAULT_CYCLE_INTERVAL = 600;

/**
 * Generic frame-cycling animation for any animated tile.
 * Cycles through a set of characters at a fixed interval.
 * Phase is staggered by position to avoid synchronized grids.
 */
export class TileCycleAnimation implements Animation {
  finished = false;
  private timer: number;
  private frameIndex = 0;
  private interval: number;
  private frames: string[];
  private x: number;
  private y: number;

  constructor(
    x: number,
    y: number,
    frames: string[],
    interval: number = DEFAULT_CYCLE_INTERVAL,
  ) {
    this.x = x;
    this.y = y;
    this.frames = frames;
    this.interval = interval;
    // Deterministic phase offset from position — prevents synchronized grid
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
