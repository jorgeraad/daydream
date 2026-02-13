// TimeOfDayOverlay — manages smooth color transform transitions between
// time-of-day periods and provides helpers for applying transforms to colors.

import type { TimeOfDay } from "@daydream/engine";
import type { ColorTransform } from "../animation/types.ts";
import {
  IDENTITY_TRANSFORM,
  TIME_TRANSFORMS,
  lerpTransform,
} from "../animation/types.ts";

// ── Configuration ──────────────────────────────────────────

/** Default transition duration: 30 seconds real time. */
export const DEFAULT_TRANSITION_DURATION = 30_000;

export interface TimeOfDayOverlayConfig {
  /** Duration of time-of-day transitions in ms. Default: 30000. */
  transitionDuration?: number;
}

// ── Easing ─────────────────────────────────────────────────

/**
 * Ease-in-out quadratic easing function.
 * Produces a smooth acceleration then deceleration curve.
 * Input and output are both in [0, 1].
 */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

// ── Color Helpers ──────────────────────────────────────────

/**
 * Parse a hex color string (#RRGGBB or #RGB) into [r, g, b] components (0-255).
 * Returns [0, 0, 0] for invalid input.
 */
export function parseHex(hex: string): [number, number, number] {
  if (!hex || hex[0] !== "#") return [0, 0, 0];

  let r: number, g: number, b: number;

  if (hex.length === 7) {
    // #RRGGBB
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else if (hex.length === 4) {
    // #RGB → expand to #RRGGBB
    r = parseInt(hex[1]! + hex[1]!, 16);
    g = parseInt(hex[2]! + hex[2]!, 16);
    b = parseInt(hex[3]! + hex[3]!, 16);
  } else {
    return [0, 0, 0];
  }

  // Guard against NaN from invalid hex digits
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return [0, 0, 0];
  return [r, g, b];
}

/** Clamp a number to [0, 255] and round to an integer. */
function clamp255(n: number): number {
  if (n <= 0) return 0;
  if (n >= 255) return 255;
  return Math.round(n);
}

/** Convert [r, g, b] components (0-255) to a #RRGGBB hex string. */
function toHex(r: number, g: number, b: number): string {
  const rs = clamp255(r).toString(16).padStart(2, "0");
  const gs = clamp255(g).toString(16).padStart(2, "0");
  const bs = clamp255(b).toString(16).padStart(2, "0");
  return `#${rs}${gs}${bs}`;
}

/**
 * Apply a ColorTransform to a hex color string.
 *
 * The transform model:
 *   output_channel = clamp(0, 255, (input_channel * channelMul + channelAdd) * brightness)
 *
 * This is the function that TileRenderer (or any consumer) calls per-cell
 * to tint colors according to the current time-of-day.
 *
 * @param hex       Input color as #RRGGBB or #RGB
 * @param transform The color transform to apply
 * @returns         Transformed color as #RRGGBB
 */
export function applyColorTransform(hex: string, transform: ColorTransform): string {
  // Fast path: identity transform does nothing
  if (isIdentityTransform(transform)) return hex.length === 4 ? expandShortHex(hex) : hex;

  const [r, g, b] = parseHex(hex);

  const outR = (r * transform.rMul + transform.rAdd) * transform.brightness;
  const outG = (g * transform.gMul + transform.gAdd) * transform.brightness;
  const outB = (b * transform.bMul + transform.bAdd) * transform.brightness;

  return toHex(outR, outG, outB);
}

/**
 * Check whether a transform is the identity transform (no visual change).
 * This enables an optimization: when the current transform is identity,
 * callers can skip the per-cell transform entirely.
 *
 * Uses exact equality since the afternoon preset is defined as exactly
 * the identity values.
 */
export function isIdentityTransform(transform: ColorTransform): boolean {
  return (
    transform.rMul === 1.0 &&
    transform.gMul === 1.0 &&
    transform.bMul === 1.0 &&
    transform.rAdd === 0 &&
    transform.gAdd === 0 &&
    transform.bAdd === 0 &&
    transform.brightness === 1.0
  );
}

/** Expand #RGB to #RRGGBB. */
function expandShortHex(hex: string): string {
  if (hex.length !== 4) return hex;
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

// ── TimeOfDayOverlay ───────────────────────────────────────

/**
 * Manages smooth color transform transitions between time-of-day periods.
 * Interpolates from the current transform to the target over a configurable
 * duration using ease-in-out easing.
 *
 * Usage:
 *   const overlay = new TimeOfDayOverlay();
 *   overlay.setTarget("night", 0);      // Begin transition to night
 *   overlay.update(16);                  // Advance by 16ms each frame
 *   const transform = overlay.getTransform(); // Get current interpolated transform
 *   const tinted = applyColorTransform("#ff8800", transform); // Apply to a color
 */
export class TimeOfDayOverlay {
  private current: ColorTransform = { ...IDENTITY_TRANSFORM };
  private target: ColorTransform = { ...IDENTITY_TRANSFORM };
  private transitionTimer = 0;
  private transitionDuration: number;

  constructor(config: TimeOfDayOverlayConfig = {}) {
    this.transitionDuration = config.transitionDuration ?? DEFAULT_TRANSITION_DURATION;
  }

  /**
   * Set a new target time-of-day.
   * When transitionProgress is 0, starts a new transition from the current
   * interpolated state toward the target period's transform.
   */
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
    const ease = easeInOut(t);
    return lerpTransform(this.current, this.target, ease);
  }

  /** Check if the current transform is identity (optimization hint). */
  isIdentity(): boolean {
    return isIdentityTransform(this.getTransform());
  }

  /** Get the transition duration in ms. */
  get duration(): number {
    return this.transitionDuration;
  }

  /**
   * Get the raw linear progress of the current transition (0 to 1).
   * Useful for diagnostics and testing.
   */
  get progress(): number {
    if (this.transitionDuration === 0) return 1;
    return this.transitionTimer / this.transitionDuration;
  }
}
