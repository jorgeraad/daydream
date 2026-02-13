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
import { TileCycleAnimation } from "./TileCycleAnimation.ts";
import { WaterShimmer } from "./WaterShimmer.ts";
import { TorchFlicker } from "./TorchFlicker.ts";
import { TimeOfDayOverlay } from "../atmosphere/TimeOfDayOverlay.ts";

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
    this.timeOfDayOverlay = new TimeOfDayOverlay({
      transitionDuration: config.transitionDuration,
    });
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

  /** Characters that indicate a water tile for animation type selection. */
  private static readonly WATER_CHARS = new Set(["~", "\u2248", "\u223C"]); // ~, ≈, ∼

  /** Characters that indicate a torch/fire tile for animation type selection. */
  private static readonly TORCH_CHARS = new Set(["\u2020", "\u2606", "\u2726"]); // †, ☆, ✦

  /**
   * Scan a zone's tile layers and register animations for tiles with
   * `animated: true` and non-empty `animFrames`.
   *
   * Selects the concrete animation type based on the tile's character:
   * - Water characters (~, ≈, ∼) → WaterShimmer
   * - Torch/fire characters (†, ☆, ✦) → TorchFlicker
   * - All others → TileCycleAnimation (generic fallback)
   */
  registerZoneAnimations(zone: ZoneData): void {
    for (const layer of zone.layers) {
      for (let i = 0; i < layer.data.length; i++) {
        const tile = layer.data[i];
        if (!tile?.animated || !tile.animFrames?.length) continue;

        const x = i % layer.width;
        const y = Math.floor(i / layer.width);
        const id = `tile_${layer.name}_${x}_${y}`;

        // Select animation type based on tile character
        if (AnimationManager.WATER_CHARS.has(tile.char)) {
          this.add(id, new WaterShimmer(x, y, tile.animFrames));
        } else if (AnimationManager.TORCH_CHARS.has(tile.char)) {
          this.add(id, new TorchFlicker(x, y, tile.animFrames));
        } else {
          this.add(id, new TileCycleAnimation(x, y, tile.animFrames));
        }
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

