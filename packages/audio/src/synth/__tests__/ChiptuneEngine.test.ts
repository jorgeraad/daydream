import { describe, test, expect } from "bun:test";
import { ChiptuneEngine } from "../ChiptuneEngine.ts";
import { parseWavHeader } from "../wav-encoder.ts";
import { MusicSpecSchema } from "../../types.ts";
import type { MusicSpec } from "../../types.ts";

/** A minimal valid MusicSpec for testing. */
function minimalSpec(overrides?: Partial<MusicSpec>): MusicSpec {
  return MusicSpecSchema.parse({
    bpm: 120,
    key: "C",
    timeSignature: 4,
    channels: [
      {
        waveform: "square",
        duty: "50",
        volume: 12,
        pattern: [
          { pitch: 60, duration: 4, velocity: 12 },
          { pitch: 64, duration: 4, velocity: 12 },
        ],
      },
      {
        waveform: "triangle",
        duty: "50",
        volume: 10,
        pattern: [
          { pitch: 48, duration: 8, velocity: 12 },
        ],
      },
    ],
    loopMeasures: 2,
    ...overrides,
  });
}

describe("ChiptuneEngine", () => {
  describe("render()", () => {
    test("produces a valid WAV file", () => {
      const engine = new ChiptuneEngine();
      const spec = minimalSpec();
      const wav = engine.render(spec);

      expect(wav).toBeInstanceOf(Uint8Array);
      expect(wav.length).toBeGreaterThan(44); // at least a header + some data

      const header = parseWavHeader(wav);
      expect(header.riffTag).toBe("RIFF");
      expect(header.waveTag).toBe("WAVE");
      expect(header.audioFormat).toBe(1); // PCM
      expect(header.numChannels).toBe(1); // mono
      expect(header.sampleRate).toBe(44100);
      expect(header.bitsPerSample).toBe(16);
    });

    test("WAV data size matches expected sample count", () => {
      const engine = new ChiptuneEngine();
      const spec = minimalSpec({ bpm: 120, loopMeasures: 2, timeSignature: 4 });
      const wav = engine.render(spec);
      const header = parseWavHeader(wav);

      // Expected total steps: 2 measures * 4 beats * 4 sixteenths = 32 steps
      // samplesPerStep at 120 BPM = round(44100 * 60 / (120 * 4)) = 5513
      const samplesPerStep = Math.round(44100 * 60 / (120 * 4));
      const totalSteps = 2 * 4 * 4;
      const expectedSamples = totalSteps * samplesPerStep;

      expect(header.dataSize).toBe(expectedSamples * 2); // 16-bit = 2 bytes/sample
    });

    test("produces non-silent output with tonal content", () => {
      const engine = new ChiptuneEngine();
      const spec = minimalSpec();
      const wav = engine.render(spec);

      // Check that the audio data is not all zeros
      const view = new DataView(wav.buffer);
      let hasNonZero = false;
      for (let i = 44; i < wav.length; i += 2) {
        if (view.getInt16(i, true) !== 0) {
          hasNonZero = true;
          break;
        }
      }
      expect(hasNonZero).toBe(true);
    });

    test("output stays within valid int16 range", () => {
      const engine = new ChiptuneEngine();
      const spec = minimalSpec();
      const wav = engine.render(spec);

      const view = new DataView(wav.buffer);
      for (let i = 44; i < wav.length; i += 2) {
        const sample = view.getInt16(i, true);
        expect(sample).toBeGreaterThanOrEqual(-32768);
        expect(sample).toBeLessThanOrEqual(32767);
      }
    });
  });

  describe("renderPcm()", () => {
    test("returns Float32Array of expected length", () => {
      const engine = new ChiptuneEngine();
      const spec = minimalSpec({ loopMeasures: 2, timeSignature: 4 });
      const pcm = engine.renderPcm(spec);

      expect(pcm).toBeInstanceOf(Float32Array);

      const samplesPerStep = Math.round(44100 * 60 / (120 * 4));
      const totalSteps = 2 * 4 * 4;
      expect(pcm.length).toBe(totalSteps * samplesPerStep);
    });

    test("PCM values are in [-1, 1] range", () => {
      const engine = new ChiptuneEngine();
      const spec = minimalSpec();
      const pcm = engine.renderPcm(spec);

      for (let i = 0; i < pcm.length; i++) {
        expect(pcm[i]).toBeGreaterThanOrEqual(-1);
        expect(pcm[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("custom sample rate", () => {
    test("uses configured sample rate in WAV header", () => {
      const engine = new ChiptuneEngine({ sampleRate: 22050 });
      const spec = minimalSpec();
      const wav = engine.render(spec);

      const header = parseWavHeader(wav);
      expect(header.sampleRate).toBe(22050);
    });

    test("lower sample rate produces smaller output", () => {
      const spec = minimalSpec();

      const engine44 = new ChiptuneEngine({ sampleRate: 44100 });
      const engine22 = new ChiptuneEngine({ sampleRate: 22050 });

      const wav44 = engine44.render(spec);
      const wav22 = engine22.render(spec);

      expect(wav22.length).toBeLessThan(wav44.length);
    });
  });

  describe("MusicSpec variations", () => {
    test("3/4 time signature produces shorter output than 4/4", () => {
      const engine = new ChiptuneEngine();
      const spec34 = minimalSpec({ timeSignature: 3 });
      const spec44 = minimalSpec({ timeSignature: 4 });

      const wav34 = engine.render(spec34);
      const wav44 = engine.render(spec44);

      expect(wav34.length).toBeLessThan(wav44.length);
    });

    test("higher BPM produces shorter output for same loop length", () => {
      const engine = new ChiptuneEngine();
      const specFast = minimalSpec({ bpm: 200 });
      const specSlow = minimalSpec({ bpm: 60 });

      const wavFast = engine.render(specFast);
      const wavSlow = engine.render(specSlow);

      expect(wavFast.length).toBeLessThan(wavSlow.length);
    });

    test("more loop measures produces longer output", () => {
      const engine = new ChiptuneEngine();
      const specShort = minimalSpec({ loopMeasures: 2 });
      const specLong = minimalSpec({ loopMeasures: 8 });

      const wavShort = engine.render(specShort);
      const wavLong = engine.render(specLong);

      expect(wavLong.length).toBeGreaterThan(wavShort.length);
    });

    test("renders with all four waveform types", () => {
      const engine = new ChiptuneEngine();
      const spec = MusicSpecSchema.parse({
        bpm: 120,
        key: "Am",
        timeSignature: 4,
        channels: [
          {
            waveform: "square",
            duty: "25",
            volume: 10,
            pattern: [{ pitch: 69, duration: 4, velocity: 12 }],
          },
          {
            waveform: "triangle",
            volume: 12,
            pattern: [{ pitch: 48, duration: 8, velocity: 10 }],
          },
          {
            waveform: "sawtooth",
            volume: 8,
            pattern: [{ pitch: 72, duration: 2, velocity: 11 }],
          },
          {
            waveform: "noise",
            volume: 6,
            pattern: [
              { pitch: 60, duration: 1, velocity: 8 },
              { pitch: 0, duration: 1, velocity: 0 },
            ],
          },
        ],
        loopMeasures: 4,
      });

      const wav = engine.render(spec);
      expect(wav.length).toBeGreaterThan(44);

      const header = parseWavHeader(wav);
      expect(header.audioFormat).toBe(1);
      expect(header.sampleRate).toBe(44100);
    });

    test("renders with mood metadata (ignored in synthesis)", () => {
      const engine = new ChiptuneEngine();
      const spec = minimalSpec({ mood: "mysterious" });
      const wavWithMood = engine.render(spec);

      const specNoMood = minimalSpec();
      const wavNoMood = engine.render(specNoMood);

      // Mood is metadata only, should not affect output
      expect(wavWithMood.length).toBe(wavNoMood.length);
    });
  });

  describe("Zod schema validation", () => {
    test("MusicSpecSchema validates correct input", () => {
      const result = MusicSpecSchema.safeParse({
        bpm: 120,
        key: "C",
        timeSignature: 4,
        channels: [
          {
            waveform: "square",
            pattern: [{ pitch: 60, duration: 4 }],
          },
          {
            waveform: "triangle",
            pattern: [{ pitch: 48, duration: 8 }],
          },
        ],
        loopMeasures: 4,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Defaults should be applied
        expect(result.data.channels[0]!.duty).toBe("50");
        expect(result.data.channels[0]!.volume).toBe(12);
        expect(result.data.channels[0]!.pattern[0]!.velocity).toBe(12);
      }
    });

    test("MusicSpecSchema rejects BPM out of range", () => {
      const result = MusicSpecSchema.safeParse({
        bpm: 300,
        key: "C",
        channels: [
          { waveform: "square", pattern: [{ pitch: 60, duration: 1 }] },
          { waveform: "triangle", pattern: [{ pitch: 48, duration: 1 }] },
        ],
      });
      expect(result.success).toBe(false);
    });

    test("MusicSpecSchema rejects too few channels", () => {
      const result = MusicSpecSchema.safeParse({
        bpm: 120,
        key: "C",
        channels: [
          { waveform: "square", pattern: [{ pitch: 60, duration: 1 }] },
        ],
      });
      expect(result.success).toBe(false);
    });

    test("MusicSpecSchema rejects too many channels", () => {
      const channels = Array(5).fill({
        waveform: "square",
        pattern: [{ pitch: 60, duration: 1 }],
      });
      const result = MusicSpecSchema.safeParse({
        bpm: 120,
        key: "C",
        channels,
      });
      expect(result.success).toBe(false);
    });

    test("NoteSchema rejects invalid MIDI pitch", () => {
      const result = MusicSpecSchema.safeParse({
        bpm: 120,
        key: "C",
        channels: [
          { waveform: "square", pattern: [{ pitch: 200, duration: 1 }] },
          { waveform: "triangle", pattern: [{ pitch: 48, duration: 1 }] },
        ],
      });
      expect(result.success).toBe(false);
    });

    test("ChannelSchema rejects invalid waveform", () => {
      const result = MusicSpecSchema.safeParse({
        bpm: 120,
        key: "C",
        channels: [
          { waveform: "sine", pattern: [{ pitch: 60, duration: 1 }] },
          { waveform: "triangle", pattern: [{ pitch: 48, duration: 1 }] },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("full pipeline", () => {
    test("MusicSpec -> parse -> render -> valid WAV", () => {
      // Simulate the AI generating raw JSON, parsing with Zod, then rendering
      const rawInput = {
        bpm: 140,
        key: "Am",
        timeSignature: 4,
        channels: [
          {
            waveform: "square",
            duty: "25",
            volume: 10,
            pattern: [
              { pitch: 69, duration: 2, velocity: 12 },
              { pitch: 72, duration: 2, velocity: 10 },
              { pitch: 76, duration: 4, velocity: 14 },
            ],
          },
          {
            waveform: "triangle",
            volume: 12,
            pattern: [
              { pitch: 45, duration: 4, velocity: 12 },
              { pitch: 48, duration: 4, velocity: 12 },
            ],
          },
          {
            waveform: "noise",
            volume: 6,
            pattern: [
              { pitch: 60, duration: 1, velocity: 8 },
              { pitch: 0, duration: 1, velocity: 0 },
              { pitch: 60, duration: 1, velocity: 6 },
              { pitch: 0, duration: 1, velocity: 0 },
            ],
          },
        ],
        loopMeasures: 4,
        mood: "dark and tense",
      };

      // Step 1: Validate with Zod
      const parseResult = MusicSpecSchema.safeParse(rawInput);
      expect(parseResult.success).toBe(true);
      if (!parseResult.success) return;

      const musicSpec = parseResult.data;

      // Step 2: Render to WAV
      const engine = new ChiptuneEngine();
      const wav = engine.render(musicSpec);

      // Step 3: Validate the WAV output
      expect(wav).toBeInstanceOf(Uint8Array);
      expect(wav.length).toBeGreaterThan(44);

      const header = parseWavHeader(wav);
      expect(header.riffTag).toBe("RIFF");
      expect(header.waveTag).toBe("WAVE");
      expect(header.audioFormat).toBe(1);
      expect(header.numChannels).toBe(1);
      expect(header.sampleRate).toBe(44100);
      expect(header.bitsPerSample).toBe(16);

      // Data should be non-trivial
      expect(header.dataSize).toBeGreaterThan(0);
      expect(header.fileSize).toBe(36 + header.dataSize);

      // All sample values should be within int16 range
      const view = new DataView(wav.buffer);
      for (let i = 44; i < wav.length; i += 2) {
        const sample = view.getInt16(i, true);
        expect(sample).toBeGreaterThanOrEqual(-32768);
        expect(sample).toBeLessThanOrEqual(32767);
      }
    });
  });
});
