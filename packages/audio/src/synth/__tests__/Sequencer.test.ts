import { describe, test, expect } from "bun:test";
import { Sequencer } from "../Sequencer.ts";
import type { Channel, Note } from "../../types.ts";

/** Helper to create a Note with defaults. */
function note(pitch: number, duration: number, velocity = 12): Note {
  return { pitch, duration, velocity };
}

/** Helper to create a Channel with defaults. */
function channel(
  waveform: Channel["waveform"],
  pattern: Note[],
  opts?: Partial<Pick<Channel, "duty" | "volume">>,
): Channel {
  return {
    waveform,
    duty: opts?.duty ?? "50",
    volume: opts?.volume ?? 12,
    pattern,
  };
}

describe("Sequencer", () => {
  describe("timing", () => {
    test("samplesPerStep matches BPM formula", () => {
      // At 120 BPM: samplesPerStep = 44100 * 60 / (120 * 4) = 5512.5 => 5513
      const seq = new Sequencer(120);
      expect(seq.getSamplesPerStep()).toBe(Math.round(44100 * 60 / (120 * 4)));
    });

    test("samplesPerStep at 60 BPM", () => {
      const seq = new Sequencer(60);
      // 44100 * 60 / (60 * 4) = 11025
      expect(seq.getSamplesPerStep()).toBe(11025);
    });

    test("samplesPerStep at 200 BPM", () => {
      const seq = new Sequencer(200);
      // 44100 * 60 / (200 * 4) = 3307.5 => 3308
      expect(seq.getSamplesPerStep()).toBe(Math.round(44100 * 60 / (200 * 4)));
    });

    test("total output length matches expected duration", () => {
      const seq = new Sequencer(120);
      const ch = channel("square", [note(60, 1)]); // single note, 1 step
      const loopMeasures = 2;
      const timeSignature = 4;

      const output = seq.render([ch], loopMeasures, timeSignature);

      // Total steps = 2 * 4 * 4 = 32
      const totalSteps = loopMeasures * timeSignature * 4;
      const expectedSamples = totalSteps * seq.getSamplesPerStep();
      expect(output.length).toBe(expectedSamples);
    });

    test("3/4 time signature produces correct length", () => {
      const seq = new Sequencer(120);
      const ch = channel("square", [note(60, 1)]);
      const loopMeasures = 2;
      const timeSignature = 3;

      const output = seq.render([ch], loopMeasures, timeSignature);

      // Total steps = 2 * 3 * 4 = 24
      const totalSteps = loopMeasures * timeSignature * 4;
      const expectedSamples = totalSteps * seq.getSamplesPerStep();
      expect(output.length).toBe(expectedSamples);
    });

    test("custom sample rate is respected", () => {
      const seq = new Sequencer(120, { sampleRate: 22050 });
      // 22050 * 60 / (120 * 4) = 2756.25 => 2756
      expect(seq.getSamplesPerStep()).toBe(Math.round(22050 * 60 / (120 * 4)));
    });
  });

  describe("pattern wrapping", () => {
    test("short pattern wraps to fill the loop", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      // Pattern: 2 notes of 1 step each = 2 steps total
      // Loop: 2 measures * 4 beats * 4 sixteenths = 32 steps
      // Pattern wraps 16 times to fill 32 steps
      const ch = channel("square", [note(69, 1), note(60, 1)]);
      const output = seq.render([ch], 2, 4);

      // Output should have non-zero content (not all silence)
      const hasContent = output.some((s) => s !== 0);
      expect(hasContent).toBe(true);

      // Total expected samples
      const totalSteps = 2 * 4 * 4;
      const expectedSamples = totalSteps * seq.getSamplesPerStep();
      expect(output.length).toBe(expectedSamples);
    });

    test("pattern exactly matching loop length produces correct output", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      // Pattern fills entire loop: 32 steps as a single note
      const ch = channel("square", [note(69, 16), note(60, 16)]);
      const output = seq.render([ch], 2, 4);

      const totalSteps = 2 * 4 * 4; // 32
      const expectedSamples = totalSteps * seq.getSamplesPerStep();
      expect(output.length).toBe(expectedSamples);
    });

    test("pattern longer than loop truncates correctly", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      // Pattern: 64 steps, loop: 32 steps. Only first 32 steps used.
      const longPattern: Note[] = [];
      for (let i = 0; i < 64; i++) {
        longPattern.push(note(60 + (i % 12), 1));
      }
      const ch = channel("square", longPattern);
      const output = seq.render([ch], 2, 4);

      const totalSteps = 2 * 4 * 4; // 32
      const expectedSamples = totalSteps * seq.getSamplesPerStep();
      expect(output.length).toBe(expectedSamples);
    });
  });

  describe("rests", () => {
    test("rest notes (pitch=0) produce silence", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      // All rests
      const ch = channel("square", [note(0, 16)]);
      const output = seq.render([ch], 2, 4);

      // Every sample should be 0
      for (let i = 0; i < output.length; i++) {
        expect(output[i]).toBe(0);
      }
    });

    test("rest followed by a note produces expected pattern", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      // 1 step rest, then 1 step of A4
      const ch = channel("square", [note(0, 1), note(69, 1)]);
      const output = seq.render([ch], 2, 4);

      const samplesPerStep = seq.getSamplesPerStep();

      // First step should be silence
      let firstStepSilent = true;
      for (let i = 0; i < samplesPerStep; i++) {
        if (output[i] !== 0) {
          firstStepSilent = false;
          break;
        }
      }
      expect(firstStepSilent).toBe(true);

      // Second step should have content
      let secondStepHasContent = false;
      for (let i = samplesPerStep; i < 2 * samplesPerStep; i++) {
        if (output[i] !== 0) {
          secondStepHasContent = true;
          break;
        }
      }
      expect(secondStepHasContent).toBe(true);
    });
  });

  describe("normalization", () => {
    test("single channel is not normalized (scale = 1)", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      const ch = channel("square", [note(69, 16)], { volume: 15 });
      const output = seq.render([ch], 2, 4);

      // With volume 15/15 = 1.0 and velocity 12/15 = 0.8
      // Square wave outputs +/- 0.8
      const maxAbsValue = output.reduce(
        (max, v) => Math.max(max, Math.abs(v)),
        0,
      );
      expect(maxAbsValue).toBeCloseTo(0.8, 1);
    });

    test("two channels are normalized by dividing by 2", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      // Two identical channels
      const ch1 = channel("square", [note(69, 16)], { volume: 15 });
      const ch2 = channel("square", [note(69, 16)], { volume: 15 });
      const output = seq.render([ch1, ch2], 2, 4);

      // Each channel produces +/- 0.8, summed = +/- 1.6, normalized / 2 = +/- 0.8
      const maxAbsValue = output.reduce(
        (max, v) => Math.max(max, Math.abs(v)),
        0,
      );
      expect(maxAbsValue).toBeCloseTo(0.8, 1);
    });

    test("four channels are normalized by dividing by 4", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      const chs = [
        channel("square", [note(69, 16)], { volume: 15 }),
        channel("square", [note(69, 16)], { volume: 15 }),
        channel("square", [note(69, 16)], { volume: 15 }),
        channel("square", [note(69, 16)], { volume: 15 }),
      ];
      const output = seq.render(chs, 2, 4);

      // Each channel 0.8, sum 3.2, normalized / 4 = 0.8
      const maxAbsValue = output.reduce(
        (max, v) => Math.max(max, Math.abs(v)),
        0,
      );
      expect(maxAbsValue).toBeCloseTo(0.8, 1);
    });

    test("normalized output stays within [-1, 1]", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      // Max volume on all 4 channels with max velocity
      const chs = [
        channel("square", [note(69, 1, 15)], { volume: 15 }),
        channel("triangle", [note(69, 1, 15)], { volume: 15 }),
        channel("sawtooth", [note(69, 1, 15)], { volume: 15 }),
        channel("noise", [note(69, 1, 15)], { volume: 15 }),
      ];
      const output = seq.render(chs, 2, 4);

      for (let i = 0; i < output.length; i++) {
        expect(output[i]).toBeGreaterThanOrEqual(-1);
        expect(output[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("waveform rendering", () => {
    test("square wave channel produces alternating +/- values", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      const ch = channel("square", [note(69, 16)]);
      const output = seq.render([ch], 2, 4);

      // Square wave should have values at exactly two levels
      const uniqueValues = new Set(
        Array.from(output).map((v) => Math.round(v * 1000) / 1000),
      );
      // Should be just the positive and negative level
      expect(uniqueValues.size).toBe(2);
    });

    test("triangle wave channel produces smoothly varying values", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      const ch = channel("triangle", [note(69, 16)]);
      const output = seq.render([ch], 2, 4);

      // Triangle wave should have many unique values (smooth)
      const uniqueValues = new Set(
        Array.from(output).map((v) => Math.round(v * 100) / 100),
      );
      expect(uniqueValues.size).toBeGreaterThan(2);
    });

    test("noise channel produces pseudo-random output", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      const ch = channel("noise", [note(69, 16)]);
      const output = seq.render([ch], 2, 4);

      // Should have both positive and negative values
      const hasPositive = output.some((v) => v > 0);
      const hasNegative = output.some((v) => v < 0);
      expect(hasPositive).toBe(true);
      expect(hasNegative).toBe(true);
    });

    test("empty pattern produces silence", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      const ch = channel("square", []);
      const output = seq.render([ch], 2, 4);

      for (let i = 0; i < output.length; i++) {
        expect(output[i]).toBe(0);
      }
    });
  });

  describe("velocity", () => {
    test("velocity 0 produces silence even with non-rest pitch", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      const ch = channel("square", [note(69, 16, 0)]);
      const output = seq.render([ch], 2, 4);

      for (let i = 0; i < output.length; i++) {
        expect(output[i]).toBe(0);
      }
    });

    test("higher velocity produces louder output", () => {
      const seq = new Sequencer(120, { sampleRate: 4800 });
      const chLow = channel("square", [note(69, 16, 5)]);
      const chHigh = channel("square", [note(69, 16, 15)]);

      const outputLow = seq.render([chLow], 2, 4);
      const outputHigh = seq.render([chHigh], 2, 4);

      const maxLow = outputLow.reduce(
        (max, v) => Math.max(max, Math.abs(v)),
        0,
      );
      const maxHigh = outputHigh.reduce(
        (max, v) => Math.max(max, Math.abs(v)),
        0,
      );

      expect(maxHigh).toBeGreaterThan(maxLow);
    });
  });
});
