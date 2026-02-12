# Design Doc: Animation & Atmosphere System

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 13:34:43 EST |
| **Last Modified**  | 2026-02-12 13:42:50 EST |
| **Status**         | approved |
| **Author**         | fast-bobcat |
| **Task**           | 20260212125926 |
| **References**     | [Design Doc](../design.md) (Sections 5.4, 5.5, 8.4), [PRD](../prd.md) |

---

## 1. Overview

### Problem

The Daydream world currently renders as a static tile map. Water doesn't move, torches don't flicker, and the world looks the same at midnight as it does at noon. This makes AI-generated worlds feel lifeless despite having rich narrative content.

### Solution

An animation and atmosphere system that makes the world feel alive through three layers:

1. **Tile animations** — Cyclic character/color changes on marked tiles (water shimmer, torch flicker)
2. **Entity animations** — Idle animations for characters using their `idleAnimation` arrays
3. **Time-of-day atmosphere** — Palette-wide color shifts driven by WorldClock, transforming the mood as in-game hours pass

### Scope

**In scope:**
- AnimationManager: lifecycle, registration, update loop
- Water shimmer animation (cycling chars + color pulse)
- Torch/fire flicker animation (char + color jitter)
- Character idle animations (cycling `idleAnimation` frames)
- Time-of-day palette overlay (dawn warm → noon bright → dusk amber → night cool)
- Integration with TileRenderer render loop
- Performance budget and frame rate management

**Out of scope (future work):**
- Weather particle effects (rain, snow, fog) — separate DD
- Zone transition animations — covered by Multi-Zone DD
- Screen-shake or camera effects
- Sound/music synchronization
- Half-block rendering mode animations

---

## 2. Architecture

### 2.1 System Placement

```
@daydream/renderer (AnimationManager, animation types, palette transforms)
    │
    ├── AnimationManager      — orchestrates all active animations
    ├── animations/           — concrete animation implementations
    │   ├── WaterShimmer.ts
    │   ├── TorchFlicker.ts
    │   └── IdleAnimation.ts
    ├── atmosphere/
    │   └── TimeOfDayOverlay.ts  — palette color transforms per time period
    └── TileRenderer.ts       — applies animation state during render

@daydream/engine (TimeOfDay type, WorldClock interface)
    └── Already has TimeOfDaySchema: "dawn" | "morning" | "afternoon" | "dusk" | "evening" | "night"
```

AnimationManager lives in `@daydream/renderer` because it directly controls visual output — it modifies what TileRenderer draws. It does **not** live in `@daydream/game` because it has no game logic; it's purely a rendering concern.

### 2.2 Data Flow

```
Game Loop (each frame)
  │
  ├─ WorldClock.update(deltaTime)          [engine]
  │   └─ emits "time:changed" if period shifted
  │
  ├─ AnimationManager.update(deltaTime)    [renderer]
  │   ├─ Updates each active Animation
  │   ├─ Builds AnimationOverrides map: (x,y) → { char?, fg?, bg?, attrs? }
  │   └─ Updates TimeOfDayOverlay color transform
  │
  └─ TileRenderer.renderZone(zone, viewport, player, animationState)  [renderer]
      ├─ Render ground layer
      ├─ Render objects layer
      ├─ For each cell: check AnimationOverrides, apply if present
      ├─ Render characters (with idle animation frame from AnimationManager)
      └─ Apply TimeOfDayOverlay color transform to all cells
```

### 2.3 Key Design Decision: Render-Time Overrides (Not Tile Mutation)

Animations do **not** mutate `TileCell` data in the zone's tile arrays. Instead, the AnimationManager produces a transient `AnimationOverrides` map each frame that the TileRenderer consults during rendering.

**Why not mutate tiles:**
- Zone tile data is the source of truth for persistence (SaveManager). Mutating it would dirty-track animation frames as "changes."
- Multiple animations could conflict on the same tile. An override map naturally handles layering priority.
- Simpler to reason about: zone data is stable, animation state is ephemeral.

```typescript
/** Per-cell override produced by animations each frame */
interface CellOverride {
  char?: string;       // Replace the tile's character
  fg?: string;         // Replace foreground color
  bg?: string;         // Replace background color
  bold?: boolean;      // Override bold attribute
  dim?: boolean;       // Override dim attribute
}

/** Map from "x,y" string key to override */
type AnimationOverrides = Map<string, CellOverride>;
```

---

## 3. AnimationManager API

```typescript
class AnimationManager {
  private renderer: CliRenderer;
  private activeAnimations: Map<string, Animation> = new Map();
  private overrides: AnimationOverrides = new Map();
  private timeOfDayOverlay: TimeOfDayOverlay;
  private liveRequested = false;

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;
    this.timeOfDayOverlay = new TimeOfDayOverlay();
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

  /** Called each frame. Updates all animations and rebuilds the override map. */
  update(deltaTime: number): void {
    this.overrides.clear();

    for (const [id, anim] of this.activeAnimations) {
      anim.update(deltaTime);
      anim.applyOverrides(this.overrides);
      if (anim.finished) {
        this.remove(id);
      }
    }
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

  /** Scan a zone's tile data and register appropriate animations. */
  registerZoneAnimations(zone: ZoneData): void {
    // Find all tiles with animated: true and register animations
    for (const layer of zone.layers) {
      for (let i = 0; i < layer.data.length; i++) {
        const tile = layer.data[i];
        if (!tile?.animated || !tile.animFrames?.length) continue;

        const x = i % layer.width;
        const y = Math.floor(i / layer.width);
        const id = `tile_${layer.name}_${x}_${y}`;

        // Determine animation type from context
        if (tile.char === "~" || tile.char === "≈" || tile.char === "∼") {
          this.add(id, new WaterShimmer(x, y, tile));
        } else if (tile.char === "†" || tile.char === "☀") {
          this.add(id, new TorchFlicker(x, y, tile));
        } else {
          // Generic frame cycling for any animated tile
          this.add(id, new TileCycleAnimation(x, y, tile));
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
}
```

### 3.1 Animation Interface

```typescript
interface Animation {
  /** Advance the animation by deltaTime milliseconds. */
  update(deltaTime: number): void;

  /** Write this animation's current visual state into the overrides map. */
  applyOverrides(overrides: AnimationOverrides): void;

  /** True when the animation should be removed (one-shot animations). */
  finished: boolean;
}
```

All animations are **world-coordinate based**. The TileRenderer is responsible for checking whether a world-coordinate override falls within the current viewport before applying it. This means animations run regardless of camera position — a water tile animates even if the player scrolls away and back.

---

## 4. Concrete Animations

### 4.1 Water Shimmer

Water tiles cycle through their `animFrames` characters and pulse between their `fg` color variants. The effect creates a rippling, light-catching surface.

```typescript
class WaterShimmer implements Animation {
  finished = false;
  private timer = 0;
  private frameIndex = 0;
  private colorIndex = 0;

  // Stagger: each tile gets a random phase offset so they don't all sync
  private phaseOffset: number;

  constructor(
    private x: number,
    private y: number,
    private tile: TileCell,
    private interval: number = 600,  // ms between frame changes
  ) {
    // Deterministic phase from position (no Math.random for reproducibility)
    this.phaseOffset = ((x * 7 + y * 13) % 5) * (interval / 5);
    this.timer = this.phaseOffset;
  }

  update(deltaTime: number): void {
    this.timer += deltaTime;
    if (this.timer >= this.interval) {
      this.timer -= this.interval;
      const frames = this.tile.animFrames!;
      this.frameIndex = (this.frameIndex + 1) % frames.length;
    }
  }

  applyOverrides(overrides: AnimationOverrides): void {
    const frames = this.tile.animFrames!;
    const key = `${this.x},${this.y}`;
    overrides.set(key, {
      char: frames[this.frameIndex],
    });
  }
}
```

**Parameters:**
- Frame interval: 600ms (just under 2 fps — slow, gentle ripple)
- Characters cycle through `animFrames`: `["~", "≈", "∼"]`
- Phase offset from position: prevents synchronized grid

### 4.2 Torch Flicker

Fire/torch tiles rapidly jitter between characters and modulate their foreground color brightness. The effect is faster and more erratic than water.

```typescript
class TorchFlicker implements Animation {
  finished = false;
  private timer = 0;
  private flickerState = 0;

  constructor(
    private x: number,
    private y: number,
    private tile: TileCell,
    private interval: number = 200,  // ms — fast flicker
  ) {}

  update(deltaTime: number): void {
    this.timer += deltaTime;
    if (this.timer >= this.interval) {
      this.timer -= this.interval;
      // Pseudo-random flicker using position and accumulated time
      this.flickerState = (this.flickerState + 1) % 4;
    }
  }

  applyOverrides(overrides: AnimationOverrides): void {
    const frames = this.tile.animFrames ?? ["†", "‡", "✦"];
    const key = `${this.x},${this.y}`;

    // Brightness modulation: dim on some frames
    const dimFrame = this.flickerState === 3;

    overrides.set(key, {
      char: frames[this.flickerState % frames.length],
      dim: dimFrame,
    });
  }
}
```

**Parameters:**
- Frame interval: 200ms (~5 fps — rapid, erratic)
- Characters: `["†", "‡", "✦"]` or from `animFrames`
- 1 in 4 frames is dimmed for flicker effect

### 4.3 Character Idle Animation

Characters with `idleAnimation` arrays cycle through their frames at a slow pace. This is entity-level, not tile-level — the AnimationManager tracks character positions.

```typescript
class IdleAnimation implements Animation {
  finished = false;
  private timer = 0;
  private frameIndex = 0;

  constructor(
    private characterId: string,
    private frames: string[],
    private getPosition: () => { x: number; y: number },
    private interval: number = 1500,  // ms — slow, subtle
  ) {}

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
}
```

**Parameters:**
- Frame interval: 1500ms (~0.67 fps — subtle, almost idle)
- Characters: from `CharacterVisual.idleAnimation` (e.g., `["☺", "☻"]`)
- Position is dynamic (callback) since characters can move

---

## 5. Time-of-Day Atmosphere

### 5.1 Color Transform Model

Rather than storing multiple palettes per biome, the atmosphere system applies a **color transform** to all rendered colors based on the current time of day. This is a post-processing step applied in TileRenderer after all tiles and overrides are resolved.

```typescript
interface ColorTransform {
  /** Multiplier for RGB channels (1.0 = no change) */
  rMul: number;
  gMul: number;
  bMul: number;

  /** Additive offset for RGB channels (0 = no change) */
  rAdd: number;
  gAdd: number;
  bAdd: number;

  /** Overall brightness multiplier (1.0 = no change) */
  brightness: number;
}
```

### 5.2 Time-of-Day Presets

Each time period has a target color transform:

```typescript
const TIME_TRANSFORMS: Record<TimeOfDay, ColorTransform> = {
  dawn: {
    rMul: 1.1, gMul: 0.9, bMul: 0.85,  // Warm pink-orange
    rAdd: 15,  gAdd: 5,   bAdd: -10,
    brightness: 0.75,
  },
  morning: {
    rMul: 1.0, gMul: 1.0, bMul: 0.95,   // Neutral, slightly warm
    rAdd: 5,   gAdd: 5,   bAdd: 0,
    brightness: 0.95,
  },
  afternoon: {
    rMul: 1.0, gMul: 1.0, bMul: 1.0,    // Full brightness, neutral
    rAdd: 0,   gAdd: 0,   bAdd: 0,
    brightness: 1.0,
  },
  dusk: {
    rMul: 1.15, gMul: 0.85, bMul: 0.75,  // Deep amber-orange
    rAdd: 20,   gAdd: -5,   bAdd: -15,
    brightness: 0.7,
  },
  evening: {
    rMul: 0.85, gMul: 0.85, bMul: 1.0,   // Cool blue tint
    rAdd: -10,  gAdd: -10,  bAdd: 5,
    brightness: 0.5,
  },
  night: {
    rMul: 0.6, gMul: 0.65, bMul: 0.9,    // Deep blue, dark
    rAdd: -20, gAdd: -15,  bAdd: 10,
    brightness: 0.35,
  },
};
```

### 5.3 Smooth Transitions

When the time period changes (e.g., morning → afternoon), the overlay **interpolates** between the old and new transforms over a transition duration. This prevents jarring color snaps.

```typescript
class TimeOfDayOverlay {
  private current: ColorTransform;
  private target: ColorTransform;
  private transitionTimer = 0;
  private transitionDuration = 30_000; // 30 seconds real time

  setTarget(timeOfDay: TimeOfDay, transitionProgress: number): void {
    if (transitionProgress === 0) {
      // New transition starting
      this.current = { ...this.getTransform() }; // Snapshot current interpolated state
      this.target = TIME_TRANSFORMS[timeOfDay];
      this.transitionTimer = 0;
    }
  }

  update(deltaTime: number): void {
    if (this.transitionTimer < this.transitionDuration) {
      this.transitionTimer = Math.min(
        this.transitionTimer + deltaTime,
        this.transitionDuration
      );
    }
  }

  getTransform(): ColorTransform {
    const t = this.transitionTimer / this.transitionDuration;
    // Ease-in-out for smooth visual transition
    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    return lerpTransform(this.current, this.target, ease);
  }
}

function lerpTransform(a: ColorTransform, b: ColorTransform, t: number): ColorTransform {
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
```

### 5.4 Applying the Transform in TileRenderer

The color transform is applied to every cell's fg and bg colors as the final step before `setCell()`:

```typescript
// In TileRenderer.renderZone(), after resolving tile + override:
function applyColorTransform(hex: string, transform: ColorTransform): RGBA {
  const rgba = RGBA.fromHex(hex);
  const r = Math.max(0, Math.min(255, Math.round(rgba.r * transform.rMul * transform.brightness + transform.rAdd)));
  const g = Math.max(0, Math.min(255, Math.round(rgba.g * transform.gMul * transform.brightness + transform.gAdd)));
  const b = Math.max(0, Math.min(255, Math.round(rgba.b * transform.bMul * transform.brightness + transform.bAdd)));
  return RGBA.fromValues(r, g, b, rgba.a);
}
```

This approach is simple and fast — it's just arithmetic per cell, no palette lookups or texture maps.

---

## 6. Integration Points

### 6.1 TileRenderer Changes

The TileRenderer needs a small modification to its render loop to consult animation state:

```typescript
// Current: renders tile directly
// New: checks for override, applies time-of-day transform

renderZone(zone: ZoneData, viewport: ViewportManager, playerX: number, playerY: number, animState?: AnimationState): void {
  const overrides = animState?.overrides ?? new Map();
  const colorTransform = animState?.colorTransform ?? IDENTITY_TRANSFORM;

  // ... existing layer rendering loop ...
  // For each visible cell at world (wx, wy) → screen (sx, sy):

  const overrideKey = `${wx},${wy}`;
  const override = overrides.get(overrideKey);

  const displayChar = override?.char ?? tile.char;
  const displayFg = override?.fg ?? tile.fg;
  const displayBg = override?.bg ?? tile.bg;
  const displayBold = override?.bold ?? tile.bold;
  const displayDim = override?.dim ?? tile.dim;

  // Apply time-of-day color transform
  const fg = applyColorTransform(displayFg, colorTransform);
  const bg = displayBg ? applyColorTransform(displayBg, colorTransform) : RGBA.fromHex("#000000");

  let attrs = TextAttributes.NONE;
  if (displayBold) attrs |= TextAttributes.BOLD;
  if (displayDim) attrs |= TextAttributes.DIM;

  this.buffer.setCell(sx, sy, displayChar, fg, bg, attrs);
}
```

### 6.2 AnimationState Interface

A simple struct passed from AnimationManager to TileRenderer each frame:

```typescript
interface AnimationState {
  overrides: AnimationOverrides;
  colorTransform: ColorTransform;
}
```

### 6.3 GameShell Wiring

In the game's main loop (GameShell), the animation system is updated and its state passed to the renderer:

```typescript
// In GameShell or wherever the render loop lives:
this.animationManager.update(deltaTime);

const animState: AnimationState = {
  overrides: this.animationManager.getOverrides(),
  colorTransform: this.animationManager.getColorTransform(),
};

this.tileRenderer.renderZone(zone, viewport, playerX, playerY, animState);
```

### 6.4 Zone Change Lifecycle

When the player enters a new zone:

```typescript
eventBus.on("zone:entered", ({ zoneId }) => {
  const zone = worldState.zones.get(zoneId);
  animationManager.clearAll();
  animationManager.registerZoneAnimations(zone);
  // Character idle animations registered separately when characters are loaded
});
```

### 6.5 WorldClock Integration

The Event System task (20260212114216) will implement WorldClock. This DD assumes the following minimal interface:

```typescript
interface WorldClockLike {
  getTimeOfDay(): TimeOfDay;
  /** Progress through current time period (0.0 = just started, 1.0 = about to change) */
  getTimeProgress(): number;
}
```

The animation system listens for time changes via EventBus:

```typescript
eventBus.on("time:changed", ({ timeOfDay }) => {
  animationManager.setTimeOfDay(timeOfDay, 0);
});
```

If WorldClock doesn't emit this event yet, the GameShell can poll `worldClock.getTimeOfDay()` each frame and detect changes.

---

## 7. Performance Budget

### 7.1 Constraints

- Game runs at **15 fps target** (67ms per frame), **30 fps max** (33ms per frame)
- TileRenderer currently takes ~5-10ms to render a full viewport (~40x20 = 800 cells)
- Animation update + override application should add **< 5ms per frame**
- Color transform is simple arithmetic: ~0.01ms per cell, negligible

### 7.2 Animation Limits

| Metric | Budget |
|--------|--------|
| Max concurrent tile animations | 200 (covers a zone with ~25% water) |
| Max concurrent character animations | 10 |
| Override map lookups per frame | ~800 (one per visible cell) |
| Color transform operations per frame | ~1600 (fg + bg per visible cell) |
| Memory per animation | ~64 bytes |
| Total animation memory | ~16 KB for 200 animations |

### 7.3 Optimization Strategies

1. **Only animate visible tiles.** The `applyOverrides` method writes all animated tile positions, but TileRenderer only looks up positions within the viewport. Off-screen animations update their timers (cheap) but don't produce visual overhead.

2. **Batch water shimmer.** Instead of 200 individual WaterShimmer instances, group water tiles by phase bucket (5 buckets based on position hash). Each bucket shares a timer, reducing update calls from 200 to 5.

3. **Skip color transform when afternoon.** The afternoon transform is identity — no math needed. Check once per frame and skip the `applyColorTransform` calls entirely during the brightest period.

4. **requestLive / dropLive lifecycle.** When the player is in a zone with no animated tiles and it's a stable time period (no transition in progress), drop live rendering entirely. The terminal only redraws on input events. Re-request live when entering a zone with animations or when a time transition begins.

---

## 8. Implementation Plan

### Task Breakdown

| # | Task | Files | Depends On | Estimate |
|---|------|-------|------------|----------|
| 1 | Animation types & interfaces | `packages/renderer/src/animation/types.ts` | — | Small |
| 2 | AnimationManager core | `packages/renderer/src/animation/AnimationManager.ts` | #1 | Medium |
| 3 | WaterShimmer animation | `packages/renderer/src/animation/WaterShimmer.ts` | #1 | Small |
| 4 | TorchFlicker animation | `packages/renderer/src/animation/TorchFlicker.ts` | #1 | Small |
| 5 | IdleAnimation (characters) | `packages/renderer/src/animation/IdleAnimation.ts` | #1 | Small |
| 6 | TimeOfDayOverlay | `packages/renderer/src/atmosphere/TimeOfDayOverlay.ts` | #1 | Medium |
| 7 | TileRenderer integration | `packages/renderer/src/TileRenderer.ts` | #1, #2, #6 | Medium |
| 8 | GameShell wiring | `apps/game/src/GameShell.ts` | #2, #7 | Small |
| 9 | Zone lifecycle hooks | `apps/game/src/GameShell.ts` | #2, #8 | Small |
| 10 | Tests | `packages/renderer/src/animation/__tests__/` | #2-#6 | Medium |

### Parallelization

```
#1 (types) ─┬─ #3 (water)  ──┐
             ├─ #4 (torch)  ──┤
             ├─ #5 (idle)   ──┼─ #7 (TileRenderer) ─── #8 (GameShell) ─── #9 (zone hooks)
             ├─ #6 (overlay) ─┘
             └─ #2 (manager) ─┘                         #10 (tests, alongside)
```

Tasks 3, 4, 5, 6 can all run in parallel after #1. Task 7 integrates everything. Tasks 8-9 wire it into the game.

### Test Plan

- **Unit tests for each animation type:** Verify frame cycling, phase offset, timer behavior
- **Unit test for TimeOfDayOverlay:** Verify color transforms per time period, interpolation math
- **Unit test for AnimationManager:** Verify add/remove lifecycle, override map construction, requestLive/dropLive calls
- **Integration test:** Create a mock zone with animated water tiles, run AnimationManager for N frames, verify overrides change over time
- **Visual verification:** Manual — run the game and observe water shimmer, torch flicker, time-of-day color shifts

---

## Appendix A: Why Render-Time Overrides Instead of Tile Mutation

**Decision:** Animations produce ephemeral overrides per frame rather than mutating zone tile data.

**Options considered:**

1. **Mutate TileCell in-place.** Each animation directly sets `tile.char` in the zone's layer data.
   - Pro: Simple — TileRenderer doesn't need to know about animations.
   - Con: Dirties zone data for SaveManager. Conflicting animations on same tile are messy. Harder to "turn off" animations cleanly.

2. **Render-time override map (chosen).** AnimationManager produces a `Map<string, CellOverride>` each frame. TileRenderer checks the map for each visible cell.
   - Pro: Zone data stays clean. Animation state is ephemeral. Easy to clear on zone change. No persistence contamination.
   - Con: Map lookup per cell (~800 lookups/frame). Slightly more complex TileRenderer.

**Rationale:** The map lookup cost is trivial (< 0.5ms for 800 lookups in a JS Map). The benefits of keeping zone data immutable for save/load correctness outweigh the minor overhead.

## Appendix B: OpenTUI Timeline API vs. Custom AnimationManager

**Decision:** Use a custom AnimationManager rather than OpenTUI's built-in Timeline API.

**Options considered:**

1. **OpenTUI Timeline.** Use `Timeline.add()` with `onUpdate` callbacks to drive animations.
   - Pro: Built-in easing functions. Battle-tested animation scheduling.
   - Con: Timeline is designed for property interpolation on renderable objects (position, size, opacity). Our animations operate on tile data, not OpenTUI renderable properties. Using Timeline would require awkward adapters. No natural fit for per-tile overrides.

2. **Custom AnimationManager (chosen).** Purpose-built for tile-based animations with an override map pattern.
   - Pro: Exactly fits our domain — tile character cycling, color modulation, per-cell overrides. Simple interface. Easy to test.
   - Con: No built-in easing (but we only need linear and ease-in-out, both trivial).

**Rationale:** OpenTUI Timeline solves a different problem (animating renderable widget properties). Our animations are fundamentally about changing what characters and colors appear in specific tile positions — a domain-specific concern that warrants a domain-specific solution. We can still use Timeline for non-tile UI animations (e.g., panel transitions) if needed later.

## Appendix C: Color Transform Approach

**Decision:** Multiplicative + additive RGB transform applied per-cell, not HSL.

**Options considered:**

1. **HSL interpolation.** Convert all colors to HSL, shift hue/saturation/lightness per time period, convert back.
   - Pro: More "correct" perceptual color shifts. Easy to express "warmer" as hue rotation.
   - Con: RGB↔HSL conversion is expensive per cell (~50 operations vs. ~6 for our approach). At 1600 color operations per frame, this matters.

2. **RGB multiply + add (chosen).** Simple `r = clamp(r * rMul * brightness + rAdd, 0, 255)` per channel.
   - Pro: Fast (6 operations per color). Good enough for the visual effect we need. Easy to tune.
   - Con: Not perceptually linear. Edge cases with very bright or very dark source colors.

3. **Pre-computed palette variants.** Store 6 copies of each biome palette (one per time period).
   - Pro: Zero per-frame math. Fast.
   - Con: 6x palette memory. Can't smoothly transition between periods. New biomes need 6 palette variants.

**Rationale:** RGB multiply+add is the best tradeoff. The visual effect is indistinguishable from "correct" HSL transforms in a terminal context (limited color precision, small cells). The performance is excellent. Pre-computed palettes can't transition smoothly.
