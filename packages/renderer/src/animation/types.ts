// Animation type system — foundation for tile animations, idle animations,
// and time-of-day atmosphere transforms.

import type { TimeOfDay } from "@daydream/engine";
import type { ZoneData } from "../types.ts";

// ── Core Interfaces ─────────────────────────────────────────

/** Per-cell visual override produced by animations each frame. */
export interface CellOverride {
  /** Replace the tile's character. */
  char?: string;
  /** Replace foreground color (hex). */
  fg?: string;
  /** Replace background color (hex). */
  bg?: string;
  /** Override bold attribute. */
  bold?: boolean;
  /** Override dim attribute. */
  dim?: boolean;
}

/** Map from "x,y" string key to per-cell override. */
export type AnimationOverrides = Map<string, CellOverride>;

/**
 * Interface all animations must implement.
 * Animations are world-coordinate based — TileRenderer handles viewport clipping.
 */
export interface Animation {
  /** Advance the animation by deltaTime milliseconds. */
  update(deltaTime: number): void;

  /** Write this animation's current visual state into the overrides map. */
  applyOverrides(overrides: AnimationOverrides): void;

  /** True when the animation should be removed (one-shot animations). Cyclic animations stay false. */
  finished: boolean;
}

// ── Color Transform ─────────────────────────────────────────

/** RGB multiply + additive color transform applied per-cell for time-of-day atmosphere. */
export interface ColorTransform {
  /** Red channel multiplier (1.0 = no change). */
  rMul: number;
  /** Green channel multiplier (1.0 = no change). */
  gMul: number;
  /** Blue channel multiplier (1.0 = no change). */
  bMul: number;
  /** Red channel additive offset (0 = no change). */
  rAdd: number;
  /** Green channel additive offset (0 = no change). */
  gAdd: number;
  /** Blue channel additive offset (0 = no change). */
  bAdd: number;
  /** Overall brightness multiplier (1.0 = no change). */
  brightness: number;
}

/** Identity color transform — no visual change. Used as default / afternoon preset. */
export const IDENTITY_TRANSFORM: Readonly<ColorTransform> = {
  rMul: 1.0,
  gMul: 1.0,
  bMul: 1.0,
  rAdd: 0,
  gAdd: 0,
  bAdd: 0,
  brightness: 1.0,
};

// ── Time-of-Day Presets ─────────────────────────────────────

/** Color transform presets per time-of-day period. */
export const TIME_TRANSFORMS: Readonly<Record<TimeOfDay, ColorTransform>> = {
  dawn: {
    rMul: 1.1, gMul: 0.9, bMul: 0.85,
    rAdd: 15,  gAdd: 5,   bAdd: -10,
    brightness: 0.75,
  },
  morning: {
    rMul: 1.0, gMul: 1.0, bMul: 0.95,
    rAdd: 5,   gAdd: 5,   bAdd: 0,
    brightness: 0.95,
  },
  afternoon: {
    rMul: 1.0, gMul: 1.0, bMul: 1.0,
    rAdd: 0,   gAdd: 0,   bAdd: 0,
    brightness: 1.0,
  },
  dusk: {
    rMul: 1.15, gMul: 0.85, bMul: 0.75,
    rAdd: 20,   gAdd: -5,   bAdd: -15,
    brightness: 0.7,
  },
  evening: {
    rMul: 0.85, gMul: 0.85, bMul: 1.0,
    rAdd: -10,  gAdd: -10,  bAdd: 5,
    brightness: 0.5,
  },
  night: {
    rMul: 0.6, gMul: 0.65, bMul: 0.9,
    rAdd: -20, gAdd: -15,  bAdd: 10,
    brightness: 0.35,
  },
};

// ── Animation State ─────────────────────────────────────────

/** Combined animation state passed from AnimationManager to TileRenderer each frame. */
export interface AnimationState {
  /** Per-cell overrides for the current frame. */
  overrides: AnimationOverrides;
  /** Current time-of-day color transform. */
  colorTransform: ColorTransform;
}

// ── Renderer Interface ──────────────────────────────────────

/**
 * Minimal interface for the OpenTUI renderer, used by AnimationManager.
 * Decoupled from the concrete CliRenderer for testability.
 */
export interface LiveRenderer {
  /** Request continuous rendering (~30fps). */
  requestLive(): void;
  /** Stop continuous rendering. */
  dropLive(): void;
}

// ── Helper ──────────────────────────────────────────────────

/** Linearly interpolate between two color transforms. */
export function lerpTransform(a: ColorTransform, b: ColorTransform, t: number): ColorTransform {
  return {
    rMul: a.rMul + (b.rMul - a.rMul) * t,
    gMul: a.gMul + (b.gMul - a.gMul) * t,
    bMul: a.bMul + (b.bMul - a.bMul) * t,
    rAdd: a.rAdd + (b.rAdd - a.rAdd) * t,
    gAdd: a.gAdd + (b.gAdd - a.gAdd) * t,
    bAdd: a.bAdd + (b.bAdd - a.bAdd) * t,
    brightness: a.brightness + (b.brightness - a.brightness) * t,
  };
}
