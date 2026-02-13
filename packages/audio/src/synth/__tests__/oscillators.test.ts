import { describe, test, expect } from "bun:test";
import {
  square,
  triangle,
  sawtooth,
  noise,
  createLFSRState,
} from "../oscillators.ts";

describe("oscillators", () => {
  describe("square wave", () => {
    test("returns 1 when phase is below duty cycle", () => {
      expect(square(0.0, 0.5)).toBe(1);
      expect(square(0.25, 0.5)).toBe(1);
      expect(square(0.49, 0.5)).toBe(1);
    });

    test("returns -1 when phase is at or above duty cycle", () => {
      expect(square(0.5, 0.5)).toBe(-1);
      expect(square(0.75, 0.5)).toBe(-1);
      expect(square(0.99, 0.5)).toBe(-1);
    });

    test("respects 12.5% duty cycle", () => {
      expect(square(0.0, 0.125)).toBe(1);
      expect(square(0.1, 0.125)).toBe(1);
      expect(square(0.125, 0.125)).toBe(-1);
      expect(square(0.5, 0.125)).toBe(-1);
    });

    test("respects 25% duty cycle", () => {
      expect(square(0.0, 0.25)).toBe(1);
      expect(square(0.2, 0.25)).toBe(1);
      expect(square(0.25, 0.25)).toBe(-1);
      expect(square(0.75, 0.25)).toBe(-1);
    });

    test("respects 75% duty cycle", () => {
      expect(square(0.0, 0.75)).toBe(1);
      expect(square(0.5, 0.75)).toBe(1);
      expect(square(0.74, 0.75)).toBe(1);
      expect(square(0.75, 0.75)).toBe(-1);
      expect(square(0.99, 0.75)).toBe(-1);
    });

    test("output is always -1 or 1", () => {
      for (let phase = 0; phase < 1; phase += 0.01) {
        const val = square(phase, 0.5);
        expect(val === 1 || val === -1).toBe(true);
      }
    });
  });

  describe("triangle wave", () => {
    test("starts at -1 when phase is 0", () => {
      expect(triangle(0)).toBe(-1);
    });

    test("reaches 1 at phase 0.5", () => {
      expect(triangle(0.5)).toBeCloseTo(1, 10);
    });

    test("returns to near -1 at phase approaching 1", () => {
      expect(triangle(0.999)).toBeCloseTo(-1, 1);
    });

    test("is 0 at phase 0.25 (quarter cycle)", () => {
      expect(triangle(0.25)).toBeCloseTo(0, 10);
    });

    test("is 0 at phase 0.75 (three-quarter cycle)", () => {
      expect(triangle(0.75)).toBeCloseTo(0, 10);
    });

    test("output is always in [-1, 1]", () => {
      for (let phase = 0; phase < 1; phase += 0.001) {
        const val = triangle(phase);
        expect(val).toBeGreaterThanOrEqual(-1);
        expect(val).toBeLessThanOrEqual(1);
      }
    });

    test("rises linearly in first half", () => {
      const v1 = triangle(0.1);
      const v2 = triangle(0.2);
      const v3 = triangle(0.3);
      // Linear rise: equal spacing => equal value increments
      expect(v2 - v1).toBeCloseTo(v3 - v2, 10);
    });

    test("falls linearly in second half", () => {
      const v1 = triangle(0.6);
      const v2 = triangle(0.7);
      const v3 = triangle(0.8);
      // Linear fall: equal spacing => equal value decrements
      expect(v2 - v1).toBeCloseTo(v3 - v2, 10);
    });
  });

  describe("sawtooth wave", () => {
    test("starts at -1 when phase is 0", () => {
      expect(sawtooth(0)).toBe(-1);
    });

    test("is 0 at phase 0.5", () => {
      expect(sawtooth(0.5)).toBeCloseTo(0, 10);
    });

    test("approaches 1 at phase near 1", () => {
      expect(sawtooth(0.999)).toBeCloseTo(1, 1);
    });

    test("output is always in [-1, 1]", () => {
      for (let phase = 0; phase < 1; phase += 0.001) {
        const val = sawtooth(phase);
        expect(val).toBeGreaterThanOrEqual(-1);
        expect(val).toBeLessThanOrEqual(1);
      }
    });

    test("rises linearly across the cycle", () => {
      const v1 = sawtooth(0.2);
      const v2 = sawtooth(0.4);
      const v3 = sawtooth(0.6);
      expect(v2 - v1).toBeCloseTo(v3 - v2, 10);
    });
  });

  describe("noise (LFSR)", () => {
    test("output is always -1 or 1", () => {
      const state = createLFSRState();
      for (let i = 0; i < 1000; i++) {
        const val = noise(state);
        expect(val === 1 || val === -1).toBe(true);
      }
    });

    test("produces different values (not stuck)", () => {
      const state = createLFSRState();
      const values = new Set<number>();
      for (let i = 0; i < 100; i++) {
        values.add(noise(state));
      }
      // Should produce both -1 and 1
      expect(values.size).toBe(2);
    });

    test("is deterministic from same initial state", () => {
      const state1 = createLFSRState();
      const state2 = createLFSRState();
      const samples1: number[] = [];
      const samples2: number[] = [];
      for (let i = 0; i < 100; i++) {
        samples1.push(noise(state1));
        samples2.push(noise(state2));
      }
      expect(samples1).toEqual(samples2);
    });

    test("LFSR state is mutated (advances the register)", () => {
      const state = createLFSRState();
      const initialLfsr = state.lfsr;
      noise(state);
      expect(state.lfsr).not.toBe(initialLfsr);
    });

    test("produces pseudo-random distribution", () => {
      const state = createLFSRState();
      let ones = 0;
      let negOnes = 0;
      const total = 10000;
      for (let i = 0; i < total; i++) {
        const val = noise(state);
        if (val === 1) ones++;
        else negOnes++;
      }
      // Should be roughly balanced (within 10% of 50/50)
      const ratio = ones / total;
      expect(ratio).toBeGreaterThan(0.4);
      expect(ratio).toBeLessThan(0.6);
    });
  });
});
