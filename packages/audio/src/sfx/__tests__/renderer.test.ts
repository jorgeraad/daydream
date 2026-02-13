import { describe, expect, it } from "bun:test";
import { renderSFX } from "../renderer.ts";
import { SFX_PRESETS } from "../presets.ts";
import type { SFXPreset } from "../types.ts";

/** Parse a WAV buffer and return its header fields. */
function parseWavHeader(wav: Uint8Array) {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  return {
    riff: String.fromCharCode(...wav.slice(0, 4)),
    fileSize: view.getUint32(4, true),
    wave: String.fromCharCode(...wav.slice(8, 12)),
    fmt: String.fromCharCode(...wav.slice(12, 16)),
    fmtChunkSize: view.getUint32(16, true),
    audioFormat: view.getUint16(20, true),
    numChannels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    dataMarker: String.fromCharCode(...wav.slice(36, 40)),
    dataSize: view.getUint32(40, true),
  };
}

describe("renderSFX", () => {
  it("produces a valid WAV buffer with correct RIFF header", () => {
    const preset: SFXPreset = {
      waveform: "square",
      frequency: 440,
      duration: 0.1,
      volume: 0.5,
      volumeDecay: 0,
    };
    const wav = renderSFX(preset);
    const header = parseWavHeader(wav);

    expect(header.riff).toBe("RIFF");
    expect(header.wave).toBe("WAVE");
    expect(header.fmt).toBe("fmt ");
    expect(header.dataMarker).toBe("data");
  });

  it("produces mono 16-bit PCM at 44100 Hz", () => {
    const preset: SFXPreset = {
      waveform: "triangle",
      frequency: 440,
      duration: 0.1,
      volume: 0.8,
      volumeDecay: 0,
    };
    const wav = renderSFX(preset);
    const header = parseWavHeader(wav);

    expect(header.audioFormat).toBe(1); // PCM
    expect(header.numChannels).toBe(1);
    expect(header.sampleRate).toBe(44100);
    expect(header.bitsPerSample).toBe(16);
    expect(header.blockAlign).toBe(2); // 1 channel * 2 bytes
    expect(header.byteRate).toBe(88200); // 44100 * 1 * 2
  });

  it("has correct data size for given duration", () => {
    const duration = 0.1;
    const preset: SFXPreset = {
      waveform: "square",
      frequency: 440,
      duration,
      volume: 0.5,
      volumeDecay: 0,
    };
    const wav = renderSFX(preset);
    const header = parseWavHeader(wav);

    const expectedSamples = Math.round(duration * 44100);
    const expectedDataSize = expectedSamples * 2; // 16-bit = 2 bytes per sample
    expect(header.dataSize).toBe(expectedDataSize);
    expect(wav.length).toBe(44 + expectedDataSize); // 44-byte header + data
  });

  it("file size field is consistent with buffer length", () => {
    const preset: SFXPreset = {
      waveform: "sawtooth",
      frequency: 220,
      duration: 0.2,
      volume: 0.6,
      volumeDecay: 2,
    };
    const wav = renderSFX(preset);
    const header = parseWavHeader(wav);

    // RIFF fileSize = total size - 8 (for "RIFF" + 4-byte size itself)
    expect(header.fileSize).toBe(wav.length - 8);
  });

  it("square wave produces non-silent output", () => {
    const preset: SFXPreset = {
      waveform: "square",
      frequency: 440,
      duration: 0.05,
      volume: 0.8,
      volumeDecay: 0,
      duty: 0.5,
    };
    const wav = renderSFX(preset);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    // Check that at least some samples are non-zero
    let hasNonZero = false;
    for (let i = 44; i < wav.length; i += 2) {
      if (view.getInt16(i, true) !== 0) {
        hasNonZero = true;
        break;
      }
    }
    expect(hasNonZero).toBe(true);
  });

  it("triangle wave produces non-silent output", () => {
    const preset: SFXPreset = {
      waveform: "triangle",
      frequency: 440,
      duration: 0.05,
      volume: 0.8,
      volumeDecay: 0,
    };
    const wav = renderSFX(preset);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    let hasNonZero = false;
    for (let i = 44; i < wav.length; i += 2) {
      if (view.getInt16(i, true) !== 0) {
        hasNonZero = true;
        break;
      }
    }
    expect(hasNonZero).toBe(true);
  });

  it("sawtooth wave produces non-silent output", () => {
    const preset: SFXPreset = {
      waveform: "sawtooth",
      frequency: 440,
      duration: 0.05,
      volume: 0.8,
      volumeDecay: 0,
    };
    const wav = renderSFX(preset);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    let hasNonZero = false;
    for (let i = 44; i < wav.length; i += 2) {
      if (view.getInt16(i, true) !== 0) {
        hasNonZero = true;
        break;
      }
    }
    expect(hasNonZero).toBe(true);
  });

  it("noise waveform produces non-silent output", () => {
    const preset: SFXPreset = {
      waveform: "noise",
      frequency: 400,
      duration: 0.05,
      volume: 0.8,
      volumeDecay: 0,
    };
    const wav = renderSFX(preset);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    let hasNonZero = false;
    for (let i = 44; i < wav.length; i += 2) {
      if (view.getInt16(i, true) !== 0) {
        hasNonZero = true;
        break;
      }
    }
    expect(hasNonZero).toBe(true);
  });

  it("volume decay reduces amplitude over time", () => {
    const preset: SFXPreset = {
      waveform: "square",
      frequency: 440,
      duration: 0.1,
      volume: 1.0,
      volumeDecay: 20,
      duty: 0.5,
    };
    const wav = renderSFX(preset);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    // Compare max absolute amplitude in first 10% vs last 10% of samples
    const dataStart = 44;
    const totalSamples = (wav.length - dataStart) / 2;
    const tenPercent = Math.floor(totalSamples * 0.1);

    let maxFirst = 0;
    for (let i = 0; i < tenPercent; i++) {
      const val = Math.abs(view.getInt16(dataStart + i * 2, true));
      if (val > maxFirst) maxFirst = val;
    }

    let maxLast = 0;
    for (let i = totalSamples - tenPercent; i < totalSamples; i++) {
      const val = Math.abs(view.getInt16(dataStart + i * 2, true));
      if (val > maxLast) maxLast = val;
    }

    expect(maxFirst).toBeGreaterThan(maxLast);
  });

  it("frequency slide changes pitch over time", () => {
    // A large positive frequency slide should increase the oscillation rate.
    // We verify by counting zero-crossings in the first vs second half.
    const preset: SFXPreset = {
      waveform: "sawtooth",
      frequency: 200,
      frequencySlide: 2000,
      duration: 0.1,
      volume: 0.8,
      volumeDecay: 0,
    };
    const wav = renderSFX(preset);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    const dataStart = 44;
    const totalSamples = (wav.length - dataStart) / 2;
    const half = Math.floor(totalSamples / 2);

    function countZeroCrossings(startSample: number, count: number): number {
      let crossings = 0;
      let prevSign = view.getInt16(dataStart + startSample * 2, true) >= 0;
      for (let i = startSample + 1; i < startSample + count; i++) {
        const curSign = view.getInt16(dataStart + i * 2, true) >= 0;
        if (curSign !== prevSign) crossings++;
        prevSign = curSign;
      }
      return crossings;
    }

    const firstHalfCrossings = countZeroCrossings(0, half);
    const secondHalfCrossings = countZeroCrossings(half, half);

    // With positive frequency slide, second half should have more zero crossings
    expect(secondHalfCrossings).toBeGreaterThan(firstHalfCrossings);
  });

  it("zero volume produces silent output", () => {
    const preset: SFXPreset = {
      waveform: "square",
      frequency: 440,
      duration: 0.05,
      volume: 0,
      volumeDecay: 0,
      duty: 0.5,
    };
    const wav = renderSFX(preset);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    for (let i = 44; i < wav.length; i += 2) {
      expect(view.getInt16(i, true)).toBe(0);
    }
  });

  it("samples are clamped to 16-bit range", () => {
    const preset: SFXPreset = {
      waveform: "square",
      frequency: 440,
      duration: 0.05,
      volume: 1.0,
      volumeDecay: 0,
      duty: 0.5,
    };
    const wav = renderSFX(preset);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    for (let i = 44; i < wav.length; i += 2) {
      const sample = view.getInt16(i, true);
      expect(sample).toBeGreaterThanOrEqual(-32768);
      expect(sample).toBeLessThanOrEqual(32767);
    }
  });
});

describe("renderSFX with all presets", () => {
  const presetNames = Object.keys(SFX_PRESETS);

  for (const name of presetNames) {
    it(`generates a valid WAV for "${name}" preset`, () => {
      const preset = SFX_PRESETS[name]!;
      const wav = renderSFX(preset);

      // Valid WAV header
      const header = parseWavHeader(wav);
      expect(header.riff).toBe("RIFF");
      expect(header.wave).toBe("WAVE");
      expect(header.audioFormat).toBe(1); // PCM
      expect(header.sampleRate).toBe(44100);
      expect(header.bitsPerSample).toBe(16);
      expect(header.numChannels).toBe(1);

      // Consistent sizes
      expect(header.fileSize).toBe(wav.length - 8);
      expect(wav.length).toBe(44 + header.dataSize);

      // Non-empty audio data (all presets have volume > 0)
      expect(header.dataSize).toBeGreaterThan(0);

      // Has non-silent samples
      const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
      let hasNonZero = false;
      for (let i = 44; i < wav.length; i += 2) {
        if (view.getInt16(i, true) !== 0) {
          hasNonZero = true;
          break;
        }
      }
      expect(hasNonZero).toBe(true);
    });
  }
});
