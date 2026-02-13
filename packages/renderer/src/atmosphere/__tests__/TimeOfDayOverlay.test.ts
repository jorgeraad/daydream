import { describe, test, expect } from "bun:test";
import {
  TimeOfDayOverlay,
  applyColorTransform,
  isIdentityTransform,
  parseHex,
  easeInOut,
  DEFAULT_TRANSITION_DURATION,
} from "../TimeOfDayOverlay.ts";
import {
  IDENTITY_TRANSFORM,
  TIME_TRANSFORMS,
  lerpTransform,
} from "../../animation/types.ts";
import type { ColorTransform } from "../../animation/types.ts";

// ── applyColorTransform ────────────────────────────────────

describe("applyColorTransform", () => {
  test("identity transform returns the same color", () => {
    expect(applyColorTransform("#ff8800", IDENTITY_TRANSFORM)).toBe("#ff8800");
  });

  test("identity transform expands short hex (#RGB → #RRGGBB)", () => {
    expect(applyColorTransform("#f80", IDENTITY_TRANSFORM)).toBe("#ff8800");
  });

  test("pure black stays black regardless of multiplicative transform", () => {
    const transform: ColorTransform = {
      rMul: 2.0, gMul: 2.0, bMul: 2.0,
      rAdd: 0, gAdd: 0, bAdd: 0,
      brightness: 1.0,
    };
    expect(applyColorTransform("#000000", transform)).toBe("#000000");
  });

  test("pure white with half brightness gives #808080", () => {
    const transform: ColorTransform = {
      rMul: 1.0, gMul: 1.0, bMul: 1.0,
      rAdd: 0, gAdd: 0, bAdd: 0,
      brightness: 0.5,
    };
    const result = applyColorTransform("#ffffff", transform);
    // 255 * 1.0 * 0.5 = 127.5, rounds to 128 = 0x80
    expect(result).toBe("#808080");
  });

  test("additive offset shifts channels", () => {
    const transform: ColorTransform = {
      rMul: 1.0, gMul: 1.0, bMul: 1.0,
      rAdd: 50, gAdd: -50, bAdd: 0,
      brightness: 1.0,
    };
    const result = applyColorTransform("#646464", transform);
    // R: (100 * 1.0 + 50) * 1.0 = 150 = 0x96
    // G: (100 * 1.0 - 50) * 1.0 = 50 = 0x32
    // B: (100 * 1.0 + 0) * 1.0 = 100 = 0x64
    expect(result).toBe("#963264");
  });

  test("multiplicative scaling works", () => {
    const transform: ColorTransform = {
      rMul: 0.5, gMul: 2.0, bMul: 1.0,
      rAdd: 0, gAdd: 0, bAdd: 0,
      brightness: 1.0,
    };
    const result = applyColorTransform("#c86432", transform);
    // R: 200 * 0.5 = 100 = 0x64
    // G: 100 * 2.0 = 200 = 0xc8
    // B: 50 * 1.0 = 50 = 0x32
    expect(result).toBe("#64c832");
  });

  test("clamps to 0 on underflow", () => {
    const transform: ColorTransform = {
      rMul: 1.0, gMul: 1.0, bMul: 1.0,
      rAdd: -300, gAdd: -300, bAdd: -300,
      brightness: 1.0,
    };
    expect(applyColorTransform("#646464", transform)).toBe("#000000");
  });

  test("clamps to 255 on overflow", () => {
    const transform: ColorTransform = {
      rMul: 1.0, gMul: 1.0, bMul: 1.0,
      rAdd: 300, gAdd: 300, bAdd: 300,
      brightness: 1.0,
    };
    expect(applyColorTransform("#646464", transform)).toBe("#ffffff");
  });

  test("combined multiply + add + brightness", () => {
    const transform: ColorTransform = {
      rMul: 1.1, gMul: 0.9, bMul: 0.85,
      rAdd: 15, gAdd: 5, bAdd: -10,
      brightness: 0.75,
    };
    const result = applyColorTransform("#808080", transform);
    // R: (128 * 1.1 + 15) * 0.75 = (140.8 + 15) * 0.75 = 155.8 * 0.75 = 116.85 → 117 = 0x75
    // G: (128 * 0.9 + 5) * 0.75 = (115.2 + 5) * 0.75 = 120.2 * 0.75 = 90.15 → 90 = 0x5a
    // B: (128 * 0.85 - 10) * 0.75 = (108.8 - 10) * 0.75 = 98.8 * 0.75 = 74.1 → 74 = 0x4a
    expect(result).toBe("#755a4a");
  });

  test("all six TIME_TRANSFORMS presets produce valid hex output", () => {
    const periods = ["dawn", "morning", "afternoon", "dusk", "evening", "night"] as const;
    for (const period of periods) {
      const result = applyColorTransform("#808080", TIME_TRANSFORMS[period]);
      expect(result).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test("afternoon transform produces same color as input", () => {
    const input = "#abcdef";
    const result = applyColorTransform(input, TIME_TRANSFORMS.afternoon);
    expect(result).toBe(input);
  });

  test("night transform darkens colors", () => {
    const input = "#808080";
    const result = applyColorTransform(input, TIME_TRANSFORMS.night);
    const [r, g, b] = parseHex(result);
    const [ir, ig, ib] = parseHex(input);
    // Night brightness is 0.35 — output should be substantially darker
    expect(r).toBeLessThan(ir);
    expect(g).toBeLessThan(ig);
    expect(b).toBeLessThan(ib);
  });

  test("handles invalid hex gracefully", () => {
    const result = applyColorTransform("not-a-hex", TIME_TRANSFORMS.dawn);
    // Should not throw; parses as [0,0,0] and applies transform
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  test("handles empty string", () => {
    const result = applyColorTransform("", TIME_TRANSFORMS.dawn);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

// ── parseHex ───────────────────────────────────────────────

describe("parseHex", () => {
  test("parses #RRGGBB format", () => {
    expect(parseHex("#ff0000")).toEqual([255, 0, 0]);
    expect(parseHex("#00ff00")).toEqual([0, 255, 0]);
    expect(parseHex("#0000ff")).toEqual([0, 0, 255]);
  });

  test("parses #RGB shorthand", () => {
    expect(parseHex("#f00")).toEqual([255, 0, 0]);
    expect(parseHex("#0f0")).toEqual([0, 255, 0]);
    expect(parseHex("#00f")).toEqual([0, 0, 255]);
  });

  test("parses mixed values", () => {
    expect(parseHex("#abcdef")).toEqual([0xab, 0xcd, 0xef]);
    expect(parseHex("#123456")).toEqual([0x12, 0x34, 0x56]);
  });

  test("parses black and white", () => {
    expect(parseHex("#000000")).toEqual([0, 0, 0]);
    expect(parseHex("#ffffff")).toEqual([255, 255, 255]);
    expect(parseHex("#000")).toEqual([0, 0, 0]);
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
  });

  test("returns [0,0,0] for invalid input", () => {
    expect(parseHex("")).toEqual([0, 0, 0]);
    expect(parseHex("ff0000")).toEqual([0, 0, 0]); // missing #
    expect(parseHex("#xyz")).toEqual([0, 0, 0]); // invalid hex digits
    expect(parseHex("#12")).toEqual([0, 0, 0]); // too short
    expect(parseHex("#1234567890")).toEqual([0, 0, 0]); // too long
  });
});

// ── isIdentityTransform ────────────────────────────────────

describe("isIdentityTransform", () => {
  test("returns true for IDENTITY_TRANSFORM", () => {
    expect(isIdentityTransform(IDENTITY_TRANSFORM)).toBe(true);
  });

  test("returns true for afternoon preset (which is identity)", () => {
    expect(isIdentityTransform(TIME_TRANSFORMS.afternoon)).toBe(true);
  });

  test("returns false for night transform", () => {
    expect(isIdentityTransform(TIME_TRANSFORMS.night)).toBe(false);
  });

  test("returns false for dawn transform", () => {
    expect(isIdentityTransform(TIME_TRANSFORMS.dawn)).toBe(false);
  });

  test("returns false when any single field differs", () => {
    // Each field different from identity
    expect(isIdentityTransform({ ...IDENTITY_TRANSFORM, rMul: 0.9 })).toBe(false);
    expect(isIdentityTransform({ ...IDENTITY_TRANSFORM, gMul: 0.9 })).toBe(false);
    expect(isIdentityTransform({ ...IDENTITY_TRANSFORM, bMul: 0.9 })).toBe(false);
    expect(isIdentityTransform({ ...IDENTITY_TRANSFORM, rAdd: 1 })).toBe(false);
    expect(isIdentityTransform({ ...IDENTITY_TRANSFORM, gAdd: 1 })).toBe(false);
    expect(isIdentityTransform({ ...IDENTITY_TRANSFORM, bAdd: 1 })).toBe(false);
    expect(isIdentityTransform({ ...IDENTITY_TRANSFORM, brightness: 0.9 })).toBe(false);
  });

  test("returns true for a manually constructed identity", () => {
    const manual: ColorTransform = {
      rMul: 1.0, gMul: 1.0, bMul: 1.0,
      rAdd: 0, gAdd: 0, bAdd: 0,
      brightness: 1.0,
    };
    expect(isIdentityTransform(manual)).toBe(true);
  });
});

// ── easeInOut ──────────────────────────────────────────────

describe("easeInOut", () => {
  test("returns 0 at t=0", () => {
    expect(easeInOut(0)).toBe(0);
  });

  test("returns 1 at t=1", () => {
    expect(easeInOut(1)).toBe(1);
  });

  test("returns 0.5 at t=0.5", () => {
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
  });

  test("is symmetric around the midpoint", () => {
    // For ease-in-out: easeInOut(0.25) + easeInOut(0.75) should equal 1
    const q1 = easeInOut(0.25);
    const q3 = easeInOut(0.75);
    expect(q1 + q3).toBeCloseTo(1.0, 10);
  });

  test("first half is less than linear (ease-in)", () => {
    // At t=0.25, easeInOut should be below 0.25 (slower start)
    expect(easeInOut(0.25)).toBeLessThan(0.25);
  });

  test("second half is greater than linear (ease-out)", () => {
    // At t=0.75, easeInOut should be above 0.75 (slower end)
    expect(easeInOut(0.75)).toBeGreaterThan(0.75);
  });

  test("is monotonically increasing", () => {
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const t = i / 100;
      const v = easeInOut(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  test("specific known values", () => {
    // At t=0.25: 2 * 0.25^2 = 0.125
    expect(easeInOut(0.25)).toBeCloseTo(0.125, 10);
    // At t=0.75: 1 - (-2*0.75 + 2)^2 / 2 = 1 - 0.5^2 / 2 = 1 - 0.125 = 0.875
    expect(easeInOut(0.75)).toBeCloseTo(0.875, 10);
  });
});

// ── TimeOfDayOverlay class ─────────────────────────────────

describe("TimeOfDayOverlay", () => {
  describe("construction", () => {
    test("defaults to 30-second transition duration", () => {
      const overlay = new TimeOfDayOverlay();
      expect(overlay.duration).toBe(DEFAULT_TRANSITION_DURATION);
      expect(overlay.duration).toBe(30_000);
    });

    test("accepts custom transition duration", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 5000 });
      expect(overlay.duration).toBe(5000);
    });

    test("starts with identity transform", () => {
      const overlay = new TimeOfDayOverlay();
      const transform = overlay.getTransform();
      expect(isIdentityTransform(transform)).toBe(true);
    });

    test("starts at progress 0", () => {
      const overlay = new TimeOfDayOverlay();
      expect(overlay.progress).toBe(0);
    });

    test("starts as identity", () => {
      const overlay = new TimeOfDayOverlay();
      expect(overlay.isIdentity()).toBe(true);
    });
  });

  describe("setTarget", () => {
    test("setting target to afternoon keeps identity", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
      overlay.setTarget("afternoon", 0);
      // Immediately after setting, we're at t=0 so transform is still the from-state (identity)
      expect(isIdentityTransform(overlay.getTransform())).toBe(true);

      // After full transition, target is afternoon which is identity
      for (let i = 0; i < 10; i++) overlay.update(20);
      expect(isIdentityTransform(overlay.getTransform())).toBe(true);
    });

    test("setting target to night starts transition", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
      overlay.setTarget("night", 0);
      expect(overlay.progress).toBe(0);

      // Still identity at t=0
      const initial = overlay.getTransform();
      expect(initial.brightness).toBeCloseTo(1.0);
    });

    test("non-zero transitionProgress does not start a new transition", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
      overlay.setTarget("night", 0);
      overlay.update(50); // half way

      const midProgress = overlay.progress;

      // Calling setTarget with non-zero progress should be a no-op
      overlay.setTarget("dawn", 0.5);
      expect(overlay.progress).toBe(midProgress);
    });
  });

  describe("transition lifecycle", () => {
    test("progress advances with update calls", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
      overlay.setTarget("night", 0);

      overlay.update(25);
      expect(overlay.progress).toBeCloseTo(0.25);

      overlay.update(25);
      expect(overlay.progress).toBeCloseTo(0.50);

      overlay.update(25);
      expect(overlay.progress).toBeCloseTo(0.75);

      overlay.update(25);
      expect(overlay.progress).toBeCloseTo(1.0);
    });

    test("progress clamps at 1.0", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
      overlay.setTarget("night", 0);

      overlay.update(200); // overshoots
      expect(overlay.progress).toBe(1.0);
    });

    test("completed transition reaches exact target values", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
      overlay.setTarget("night", 0);

      // Run past the duration
      for (let i = 0; i < 20; i++) overlay.update(10);

      const transform = overlay.getTransform();
      expect(transform.brightness).toBeCloseTo(TIME_TRANSFORMS.night.brightness, 5);
      expect(transform.rMul).toBeCloseTo(TIME_TRANSFORMS.night.rMul, 5);
      expect(transform.gMul).toBeCloseTo(TIME_TRANSFORMS.night.gMul, 5);
      expect(transform.bMul).toBeCloseTo(TIME_TRANSFORMS.night.bMul, 5);
      expect(transform.rAdd).toBeCloseTo(TIME_TRANSFORMS.night.rAdd, 5);
      expect(transform.gAdd).toBeCloseTo(TIME_TRANSFORMS.night.gAdd, 5);
      expect(transform.bAdd).toBeCloseTo(TIME_TRANSFORMS.night.bAdd, 5);
    });

    test("midpoint transform is between start and target", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
      overlay.setTarget("night", 0);
      overlay.update(50); // t=0.5, easeInOut(0.5) = 0.5

      const mid = overlay.getTransform();
      // Brightness should be between identity (1.0) and night (0.35)
      expect(mid.brightness).toBeGreaterThan(TIME_TRANSFORMS.night.brightness);
      expect(mid.brightness).toBeLessThan(IDENTITY_TRANSFORM.brightness);
    });

    test("ease-in-out makes early progress slower than linear", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
      overlay.setTarget("night", 0);

      // At t=0.25, easeInOut = 0.125, so brightness change is only 12.5% of the way
      overlay.update(25);
      const quarter = overlay.getTransform();

      // Linear interpolation at 25% would give: 1.0 + (0.35 - 1.0) * 0.25 = 0.8375
      // Eased interpolation at 25% (ease=0.125): 1.0 + (0.35 - 1.0) * 0.125 = 0.91875
      expect(quarter.brightness).toBeGreaterThan(0.85); // more than linear would give
    });

    test("update after transition completes is a no-op", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
      overlay.setTarget("night", 0);

      // Complete the transition
      overlay.update(200);
      const completed = overlay.getTransform();

      // Extra updates should not change anything
      overlay.update(1000);
      overlay.update(5000);
      const after = overlay.getTransform();

      expect(after.brightness).toBeCloseTo(completed.brightness);
      expect(after.rMul).toBeCloseTo(completed.rMul);
    });
  });

  describe("chained transitions", () => {
    test("can chain from one period to another", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });

      // First transition: identity → night
      overlay.setTarget("night", 0);
      for (let i = 0; i < 20; i++) overlay.update(10);
      const afterNight = overlay.getTransform();
      expect(afterNight.brightness).toBeCloseTo(TIME_TRANSFORMS.night.brightness, 3);

      // Second transition: night → dawn
      overlay.setTarget("dawn", 0);
      expect(overlay.progress).toBe(0); // reset to 0

      for (let i = 0; i < 20; i++) overlay.update(10);
      const afterDawn = overlay.getTransform();
      expect(afterDawn.brightness).toBeCloseTo(TIME_TRANSFORMS.dawn.brightness, 3);
    });

    test("interrupting a transition mid-way starts from current interpolated state", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });

      // Start transitioning to night
      overlay.setTarget("night", 0);
      overlay.update(50); // halfway through
      const midNight = overlay.getTransform();

      // Interrupt: switch to dawn
      overlay.setTarget("dawn", 0);

      // The "from" state should be the midpoint we just captured
      const interruptStart = overlay.getTransform();
      expect(interruptStart.brightness).toBeCloseTo(midNight.brightness, 5);

      // Complete the dawn transition
      for (let i = 0; i < 20; i++) overlay.update(10);
      const afterDawn = overlay.getTransform();
      expect(afterDawn.brightness).toBeCloseTo(TIME_TRANSFORMS.dawn.brightness, 3);
    });
  });

  describe("zero duration", () => {
    test("zero duration snaps immediately to target", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 0 });
      overlay.setTarget("night", 0);

      // Should be at target immediately
      const transform = overlay.getTransform();
      expect(transform.brightness).toBeCloseTo(TIME_TRANSFORMS.night.brightness, 5);
      expect(transform.rMul).toBeCloseTo(TIME_TRANSFORMS.night.rMul, 5);
    });
  });

  describe("isIdentity", () => {
    test("returns true when at identity", () => {
      const overlay = new TimeOfDayOverlay();
      expect(overlay.isIdentity()).toBe(true);
    });

    test("returns false during transition to non-identity", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
      overlay.setTarget("night", 0);
      overlay.update(50);
      expect(overlay.isIdentity()).toBe(false);
    });

    test("returns true after completing transition to afternoon", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
      overlay.setTarget("afternoon", 0);
      for (let i = 0; i < 20; i++) overlay.update(10);
      expect(overlay.isIdentity()).toBe(true);
    });

    test("returns false after completing transition to night", () => {
      const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
      overlay.setTarget("night", 0);
      for (let i = 0; i < 20; i++) overlay.update(10);
      expect(overlay.isIdentity()).toBe(false);
    });
  });
});

// ── Integration: applyColorTransform + TimeOfDayOverlay ────

describe("integration: overlay + applyColorTransform", () => {
  test("applying a transitioning overlay produces valid colors", () => {
    const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
    overlay.setTarget("dusk", 0);

    // Sample at several points during the transition
    for (let step = 0; step < 10; step++) {
      overlay.update(10);
      const transform = overlay.getTransform();
      const result = applyColorTransform("#88aa66", transform);
      expect(result).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test("afternoon overlay leaves all colors unchanged", () => {
    const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
    overlay.setTarget("afternoon", 0);
    for (let i = 0; i < 20; i++) overlay.update(10);

    const transform = overlay.getTransform();
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#808080", "#ffffff", "#000000"];
    for (const color of colors) {
      expect(applyColorTransform(color, transform)).toBe(color);
    }
  });

  test("night overlay darkens all non-black colors", () => {
    const overlay = new TimeOfDayOverlay({ transitionDuration: 100 });
    overlay.setTarget("night", 0);
    for (let i = 0; i < 20; i++) overlay.update(10);

    const transform = overlay.getTransform();
    const testColors = ["#ff0000", "#00ff00", "#808080", "#ffffff"];
    for (const color of testColors) {
      const result = applyColorTransform(color, transform);
      const [r, g, b] = parseHex(result);
      const [ir, ig, ib] = parseHex(color);
      // At least one channel should be less (night is darker overall)
      expect(r + g + b).toBeLessThan(ir + ig + ib);
    }
  });
});
