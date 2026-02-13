// IdleAnimation — slow character frame cycling for NPCs/entities.
// Position is dynamic (via callback) since characters can move.

import type { Animation, AnimationOverrides } from "./types.ts";

/** Default interval for idle animation frame cycling (ms). */
const DEFAULT_IDLE_INTERVAL = 1500;

/**
 * Character idle animation.
 * Cycles through display frames at a slow pace for a subtle breathing/fidget
 * effect. Position is retrieved via a callback each frame since characters
 * can move between animation updates.
 */
export class IdleAnimation implements Animation {
  finished = false;
  private timer = 0;
  private frameIndex = 0;
  private characterId: string;
  private frames: string[];
  private getPosition: () => { x: number; y: number };
  private interval: number;

  constructor(
    characterId: string,
    frames: string[],
    getPosition: () => { x: number; y: number },
    interval: number = DEFAULT_IDLE_INTERVAL,
  ) {
    this.characterId = characterId;
    this.frames = frames;
    this.getPosition = getPosition;
    this.interval = interval;
  }

  update(deltaTime: number): void {
    this.timer += deltaTime;
    if (this.timer >= this.interval) {
      this.timer -= this.interval;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }
  }

  applyOverrides(overrides: AnimationOverrides): void {
    const pos = this.getPosition();
    const key = `${pos.x},${pos.y}`;
    overrides.set(key, {
      char: this.frames[this.frameIndex],
    });
  }

  /** Get the character ID this animation belongs to. */
  get id(): string {
    return this.characterId;
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
