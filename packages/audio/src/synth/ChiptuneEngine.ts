// ChiptuneEngine -- top-level orchestrator that renders MusicSpec into WAV audio
// Pure computation: no I/O, no async, fully testable

import type { MusicSpec } from "../types.ts";
import { SAMPLE_RATE } from "../types.ts";
import { Sequencer } from "./Sequencer.ts";
import { encodeWav } from "./wav-encoder.ts";

/**
 * ChiptuneEngine configuration.
 */
export interface ChiptuneEngineConfig {
  /** Audio sample rate in Hz. Defaults to 44100. */
  sampleRate?: number;
}

/**
 * ChiptuneEngine takes a MusicSpec and produces a complete WAV file buffer.
 *
 * Pipeline:
 * 1. Parse/validate MusicSpec via Zod
 * 2. Create Sequencer at the specified BPM
 * 3. Render all channels into a Float32Array (with normalization)
 * 4. Encode as 16-bit mono PCM WAV
 *
 * This is pure computation -- no I/O, no async. Safe to call from any context.
 */
export class ChiptuneEngine {
  private readonly sampleRate: number;

  constructor(config?: ChiptuneEngineConfig) {
    this.sampleRate = config?.sampleRate ?? SAMPLE_RATE;
  }

  /**
   * Render a MusicSpec into a complete WAV file buffer.
   *
   * @param musicSpec - Validated MusicSpec describing the music to render
   * @returns Uint8Array containing a valid WAV file
   */
  render(musicSpec: MusicSpec): Uint8Array {
    const sequencer = new Sequencer(musicSpec.bpm, {
      sampleRate: this.sampleRate,
    });

    // Render all channels into a summed, normalized Float32Array
    const pcmSamples = sequencer.render(
      musicSpec.channels,
      musicSpec.loopMeasures,
      musicSpec.timeSignature,
    );

    // Encode as WAV
    return encodeWav(pcmSamples, this.sampleRate);
  }

  /**
   * Render a MusicSpec and return the raw PCM float samples
   * (useful for testing or further processing).
   *
   * @param musicSpec - Validated MusicSpec describing the music to render
   * @returns Float32Array of normalized PCM samples
   */
  renderPcm(musicSpec: MusicSpec): Float32Array {
    const sequencer = new Sequencer(musicSpec.bpm, {
      sampleRate: this.sampleRate,
    });

    return sequencer.render(
      musicSpec.channels,
      musicSpec.loopMeasures,
      musicSpec.timeSignature,
    );
  }
}
