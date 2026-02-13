import { describe, test, expect } from "bun:test";
import { encodeWav, parseWavHeader } from "../wav-encoder.ts";

describe("WAV encoder", () => {
  test("produces a buffer with correct header for empty samples", () => {
    const samples = new Float32Array(0);
    const wav = encodeWav(samples, 44100);

    expect(wav.length).toBe(44); // header only, no data

    const header = parseWavHeader(wav);
    expect(header.riffTag).toBe("RIFF");
    expect(header.waveTag).toBe("WAVE");
    expect(header.fmtTag).toBe("fmt ");
    expect(header.dataTag).toBe("data");
    expect(header.audioFormat).toBe(1); // PCM
    expect(header.numChannels).toBe(1); // mono
    expect(header.sampleRate).toBe(44100);
    expect(header.bitsPerSample).toBe(16);
    expect(header.dataSize).toBe(0);
  });

  test("produces correct file size field", () => {
    const samples = new Float32Array(100);
    const wav = encodeWav(samples, 44100);

    const header = parseWavHeader(wav);
    // fileSize = 36 + dataSize
    expect(header.fileSize).toBe(36 + 100 * 2);
  });

  test("produces correct data size for given sample count", () => {
    const sampleCount = 44100; // 1 second
    const samples = new Float32Array(sampleCount);
    const wav = encodeWav(samples, 44100);

    const header = parseWavHeader(wav);
    expect(header.dataSize).toBe(sampleCount * 2); // 16-bit = 2 bytes per sample
    expect(wav.length).toBe(44 + sampleCount * 2);
  });

  test("encodes correct byte rate", () => {
    const samples = new Float32Array(100);
    const wav = encodeWav(samples, 44100);

    const header = parseWavHeader(wav);
    // byte rate = sampleRate * numChannels * bytesPerSample
    expect(header.byteRate).toBe(44100 * 1 * 2);
  });

  test("encodes correct block align", () => {
    const samples = new Float32Array(100);
    const wav = encodeWav(samples, 44100);

    const header = parseWavHeader(wav);
    // block align = numChannels * bytesPerSample
    expect(header.blockAlign).toBe(1 * 2);
  });

  test("encodes positive samples correctly", () => {
    // A single sample at max positive value
    const samples = new Float32Array([1.0]);
    const wav = encodeWav(samples, 44100);

    const view = new DataView(wav.buffer);
    const sampleValue = view.getInt16(44, true);
    expect(sampleValue).toBe(32767);
  });

  test("encodes negative samples correctly", () => {
    const samples = new Float32Array([-1.0]);
    const wav = encodeWav(samples, 44100);

    const view = new DataView(wav.buffer);
    const sampleValue = view.getInt16(44, true);
    expect(sampleValue).toBe(-32767);
  });

  test("encodes silence (zero) correctly", () => {
    const samples = new Float32Array([0.0]);
    const wav = encodeWav(samples, 44100);

    const view = new DataView(wav.buffer);
    const sampleValue = view.getInt16(44, true);
    expect(sampleValue).toBe(0);
  });

  test("clamps values above 1.0", () => {
    const samples = new Float32Array([2.0]);
    const wav = encodeWav(samples, 44100);

    const view = new DataView(wav.buffer);
    const sampleValue = view.getInt16(44, true);
    expect(sampleValue).toBe(32767); // clamped to max
  });

  test("clamps values below -1.0", () => {
    const samples = new Float32Array([-2.0]);
    const wav = encodeWav(samples, 44100);

    const view = new DataView(wav.buffer);
    const sampleValue = view.getInt16(44, true);
    expect(sampleValue).toBe(-32767); // clamped to min
  });

  test("supports different sample rates", () => {
    const samples = new Float32Array(100);
    const wav = encodeWav(samples, 22050);

    const header = parseWavHeader(wav);
    expect(header.sampleRate).toBe(22050);
    expect(header.byteRate).toBe(22050 * 2);
  });

  test("encodes multiple samples in order", () => {
    const samples = new Float32Array([0.5, -0.5, 0.25, -0.25]);
    const wav = encodeWav(samples, 44100);

    const view = new DataView(wav.buffer);
    expect(view.getInt16(44, true)).toBe(Math.round(0.5 * 32767));
    expect(view.getInt16(46, true)).toBe(Math.round(-0.5 * 32767));
    expect(view.getInt16(48, true)).toBe(Math.round(0.25 * 32767));
    expect(view.getInt16(50, true)).toBe(Math.round(-0.25 * 32767));
  });

  test("parseWavHeader roundtrips with encodeWav", () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
    }
    const wav = encodeWav(samples, 44100);
    const header = parseWavHeader(wav);

    expect(header.riffTag).toBe("RIFF");
    expect(header.waveTag).toBe("WAVE");
    expect(header.fmtTag).toBe("fmt ");
    expect(header.dataTag).toBe("data");
    expect(header.audioFormat).toBe(1);
    expect(header.numChannels).toBe(1);
    expect(header.sampleRate).toBe(44100);
    expect(header.bitsPerSample).toBe(16);
    expect(header.dataSize).toBe(1000 * 2);
    expect(header.fileSize).toBe(36 + 1000 * 2);
  });
});
