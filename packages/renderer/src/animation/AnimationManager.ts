// AnimationManager — orchestrates active animations, produces per-frame
// override maps for TileRenderer, and manages OpenTUI's requestLive/dropLive lifecycle.

import type { TimeOfDay } from "@daydream/engine";
import type { ZoneData } from "../types.ts";
import type {
  Animation,
  AnimationOverrides,
  ColorTransform,
  LiveRenderer,
} from "./types.ts";
import {
  IDENTITY_TRANSFORM,
  TIME_TRANSFORMS,
  lerpTransform,
} from "./types.ts";

// ── TimeOfDayOverlay ────────────────────────────────────────

/** Default transition duration: 30 seconds real time. */
const DEFAULT_TRANSITION_DURATION = 30_000;

/**
 * Manages smooth color transform transitions between time-of-day periods.
 * Interpolates from the current transform to the target over a configurable duration.
 */
class TimeOfDayOverlay {
  private current: ColorTransform = { ...IDENTITY_TRANSFORM };
  private target: ColorTransform = { ...IDENTITY_TRANSFORM };
  private transitionTimer = 0;
  private transitionDuration: number;

  constructor(transitionDuration: number = DEFAULT_TRANSITION_DURATION) {
    this.transitionDuration = transitionDuration;
  }

  /** Set a new target time-of-day. When transitionProgress is 0, starts a new transition. */
  setTarget(timeOfDay: TimeOfDay, transitionProgress: number): void {
    if (transitionProgress === 0) {
      // Snapshot current interpolated state as the new "from"
      this.current = { ...this.getTransform() };
      this.target = TIME_TRANSFORMS[timeOfDay];
      this.transitionTimer = 0;
    }
  }

  /** Advance the transition by deltaTime milliseconds. */
  update(deltaTime: number): void {
    if (this.transitionTimer < this.transitionDuration) {
      this.transitionTimer = Math.min(
        this.transitionTimer + deltaTime,
        this.transitionDuration,
      );
    }
  }

  /** Get the current interpolated color transform. */
  getTransform(): ColorTransform {
    if (this.transitionDuration === 0) {
      return { ...this.target };
    }
    const t = this.transitionTimer / this.transitionDuration;
    // Ease-in-out for smooth visual transition
    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    return lerpTransform(this.current, this.target, ease);
  }
}

// ── AnimationManager ────────────────────────────────────────

export interface AnimationManagerConfig {
  /** Duration of time-of-day transitions in ms. Default: 30000. */
  transitionDuration?: number;
}

/**
 * Orchestrates all active animations, producing per-frame cell overrides
 * and time-of-day color transforms for TileRenderer.
 *
 * Manages OpenTUI requestLive/dropLive lifecycle: requests continuous rendering
 * when the first animation is added, drops it when the last is removed.
 */
export class AnimationManager {
  private renderer: LiveRenderer;
  private activeAnimations: Map<string, Animation> = new Map();
  private overrides: Map<string, import("./types.ts").CellOverride> = new Map();
  private timeOfDayOverlay: TimeOfDayOverlay;
  private liveRequested = false;

  constructor(renderer: LiveRenderer, config: AnimationManagerConfig = {}) {
    this.renderer = renderer;
    this.timeOfDayOverlay = new TimeOfDayOverlay(config.transitionDuration);
  }

  /** Register a new animation. Automatically requests live rendering. */
  add(id: string, animation: Animation): void {
    this.activeAnimations.set(id, animation);
    if (!this.liveRequested) {
      this.renderer.requestLive();
      this.liveRequested = true;
    }
  }

  /** Remove an animation by ID. Drops live rendering when none remain. */
  remove(id: string): void {
    this.activeAnimations.delete(id);
    if (this.activeAnimations.size === 0 && this.liveRequested) {
      this.renderer.dropLive();
      this.liveRequested = false;
    }
  }

  /**
   * Called each frame. Updates all animations, rebuilds the override map,
   * and removes finished animations.
   */
  update(deltaTime: number): void {
    this.overrides.clear();

    // Collect IDs of finished animations to remove after iteration
    const finished: string[] = [];

    for (const [id, anim] of this.activeAnimations) {
      anim.update(deltaTime);
      anim.applyOverrides(this.overrides);
      if (anim.finished) {
        finished.push(id);
      }
    }

    for (const id of finished) {
      this.remove(id);
    }

    // Update time-of-day transition
    this.timeOfDayOverlay.update(deltaTime);
  }

  /** Get the current frame's cell overrides for the TileRenderer. */
  getOverrides(): AnimationOverrides {
    return this.overrides;
  }

  /** Get the current time-of-day color transform. */
  getColorTransform(): ColorTransform {
    return this.timeOfDayOverlay.getTransform();
  }

  /** Update the time-of-day overlay when WorldClock period changes. */
  setTimeOfDay(timeOfDay: TimeOfDay, transitionProgress: number): void {
    this.timeOfDayOverlay.setTarget(timeOfDay, transitionProgress);
  }

  /**
   * Scan a zone's tile layers and register animations for tiles with
   * `animated: true` and non-empty `animFrames`.
   *
   * Creates a generic TileCycleAnimation for each animated tile.
   * Concrete animation implementations (WaterShimmer, TorchFlicker) can be
   * registered by downstream tasks that implement them.
   */
  registerZoneAnimations(zone: ZoneData): void {
    for (const layer of zone.layers) {
      for (let i = 0; i < layer.data.length; i++) {
        const tile = layer.data[i];
        if (!tile?.animated || !tile.animFrames?.length) continue;

        const x = i % layer.width;
        const y = Math.floor(i / layer.width);
        const id = `tile_${layer.name}_${x}_${y}`;

        // Register a generic frame-cycling animation
        this.add(id, new TileCycleAnimation(x, y, tile.animFrames));
      }
    }
  }

  /** Clear all animations (e.g., on zone change). */
  clearAll(): void {
    this.activeAnimations.clear();
    this.overrides.clear();
    if (this.liveRequested) {
      this.renderer.dropLive();
      this.liveRequested = false;
    }
  }

  /** Get the number of active animations. Useful for diagnostics. */
  get animationCount(): number {
    return this.activeAnimations.size;
  }

  /** Check whether live rendering is currently requested. */
  get isLive(): boolean {
    return this.liveRequested;
  }
}

// ── Built-in Generic Animation ──────────────────────────────

/** Default interval for generic tile frame cycling (ms). */
const DEFAULT_CYCLE_INTERVAL = 600;

/**
 * Generic frame-cycling animation for any animated tile.
 * Cycles through a set of characters at a fixed interval.
 * Phase is staggered by position to avoid synchronized grids.
 */
class TileCycleAnimation implements Animation {
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
}
