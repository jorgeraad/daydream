/**
 * Procedural SFX Renderer — generates WAV audio buffers from SFXPreset parameters.
 *
 * Uses parameter-based synthesis (sfxr-style) to produce short sound effects.
 * Pure computation: no I/O, deterministic output for a given preset.
 */

import type { SFXPreset } from "./types.ts";

/** Sample rate for all generated SFX (CD quality, universally supported). */
const SAMPLE_RATE = 44100;

/**
 * Render an SFXPreset into a WAV audio buffer (Uint8Array).
 *
 * The renderer:
 * 1. Generates PCM samples by running the oscillator with frequency slide and volume decay
 * 2. Encodes the samples as 16-bit mono PCM in a WAV container
 */
export function renderSFX(preset: SFXPreset): Uint8Array {
  const samples = synthesize(preset);
  return encodeWav(samples, SAMPLE_RATE);
}

/**
 * Synthesize PCM audio samples from an SFXPreset.
 * Returns a Float32Array of samples in the range [-1, 1].
 */
function synthesize(preset: SFXPreset): Float32Array {
  // Apply defaults for optional fields
  const volume = preset.volume ?? 0.8;
  const volumeDecay = preset.volumeDecay ?? 0;
  const frequencySlide = preset.frequencySlide ?? 0;

  const totalSamples = Math.round(preset.duration * SAMPLE_RATE);
  const output = new Float32Array(totalSamples);

  let phase = 0;
  let frequency = preset.frequency;
  const frequencySlidePerSample = frequencySlide / SAMPLE_RATE;
  const duty = preset.duty ?? 0.5;

  // LFSR state for noise waveform (15-bit, NES-style)
  let lfsr = 0x7FFF;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;

    // Volume envelope: exponential decay from peak volume
    const envelope =
      volumeDecay > 0
        ? volume * Math.exp(-volumeDecay * t)
        : volume;

    // Generate waveform sample
    let sample: number;
    switch (preset.waveform) {
      case "square":
        sample = phase < duty ? 1 : -1;
        break;
      case "triangle":
        sample = phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
        break;
      case "sawtooth":
        sample = 2 * phase - 1;
        break;
      case "noise": {
        const bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
        lfsr = (lfsr >> 1) | (bit << 14);
        sample = (lfsr & 1) ? 1 : -1;
        break;
      }
    }

    output[i] = sample * envelope;

    // Advance phase using current frequency
    phase += frequency / SAMPLE_RATE;
    phase -= Math.floor(phase); // wrap to [0, 1)

    // Apply frequency slide
    frequency += frequencySlidePerSample;
    if (frequency < 0) frequency = 0;
  }

  return output;
}

/**
 * Encode PCM samples as a WAV file (mono, 16-bit, given sample rate).
 */
function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const buffer = new Uint8Array(headerSize + dataSize);
  const view = new DataView(buffer.buffer);

  // RIFF header
  writeString(buffer, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(buffer, 8, "WAVE");

  // fmt chunk
  writeString(buffer, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(buffer, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write samples as 16-bit signed integers
  for (let i = 0; i < samples.length; i++) {
    const raw = samples[i] ?? 0;
    const clamped = Math.max(-1, Math.min(1, raw));
    view.setInt16(headerSize + i * 2, Math.round(clamped * 32767), true);
  }

  return buffer;
}

/** Write an ASCII string into a Uint8Array at the given offset. */
function writeString(buffer: Uint8Array, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    buffer[offset + i] = str.charCodeAt(i);
  }
}
