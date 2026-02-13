// Sequencer -- steps through channel note patterns at specified BPM
// Renders multi-channel audio into a single Float32Array output buffer

import type { Channel, Note } from "../types.ts";
import {
  SAMPLE_RATE,
  midiToFreq,
  dutyToFraction,
} from "../types.ts";
import {
  square,
  triangle,
  sawtooth,
  noise,
  createLFSRState,
  type LFSRState,
} from "./oscillators.ts";

/**
 * Sequencer configuration.
 */
export interface SequencerConfig {
  /** Audio sample rate in Hz. Defaults to 44100. */
  sampleRate?: number;
}

/**
 * Sequencer renders Channel patterns into PCM audio samples.
 *
 * Timing: 1 step = 1 sixteenth note.
 * samplesPerStep = sampleRate * 60 / (bpm * 4)
 *
 * Each channel's pattern is walked note-by-note, wrapping when it
 * reaches the end. All channels are summed into a single output buffer.
 * Normalization divides by channel count to prevent clipping.
 */
export class Sequencer {
  private readonly sampleRate: number;
  private readonly samplesPerStep: number;

  constructor(bpm: number, config?: SequencerConfig) {
    this.sampleRate = config?.sampleRate ?? SAMPLE_RATE;
    // 1 step = 1 sixteenth note
    // samplesPerStep = sampleRate * 60 / (bpm * 4)
    this.samplesPerStep = Math.round(this.sampleRate * 60 / (bpm * 4));
  }

  /** Number of PCM samples per sixteenth-note step. */
  getSamplesPerStep(): number {
    return this.samplesPerStep;
  }

  /**
   * Render the full loop as a Float32Array of PCM samples.
   *
   * @param channels - Array of channels to render
   * @param loopMeasures - Number of measures in the loop
   * @param timeSignature - Beats per measure (3 or 4)
   * @returns Float32Array of summed, normalized PCM samples
   */
  render(
    channels: Channel[],
    loopMeasures: number,
    timeSignature: number,
  ): Float32Array {
    // Total sixteenth-note steps in the loop
    const totalSteps = loopMeasures * timeSignature * 4;
    const totalSamples = totalSteps * this.samplesPerStep;
    const output = new Float32Array(totalSamples);

    for (const channel of channels) {
      this.renderChannel(channel, output, totalSteps);
    }

    // Normalize to prevent clipping from summing channels
    this.normalize(output, channels.length);

    return output;
  }

  /**
   * Render a single channel, adding its samples into the output buffer.
   */
  private renderChannel(
    channel: Channel,
    output: Float32Array,
    totalSteps: number,
  ): void {
    const pattern = channel.pattern;
    if (pattern.length === 0) return;

    const duty = dutyToFraction(channel.duty);
    const channelVolume = channel.volume / 15; // normalize 0-15 to 0-1
    const lfsrState: LFSRState = createLFSRState();

    // Walk through each step position, mapping to notes via pattern wrapping
    let stepPos = 0;
    let sampleIndex = 0;

    while (stepPos < totalSteps) {
      // Find the current note by walking the pattern with wrapping
      const { note, noteIndex: _ } = this.getNoteAtStep(pattern, stepPos);

      // Number of samples for this note's duration
      const noteDurationSteps = Math.min(note.duration, totalSteps - stepPos);
      const noteSamples = noteDurationSteps * this.samplesPerStep;

      // Render this note
      if (note.pitch === 0) {
        // Rest -- silence, advance samples
        sampleIndex += noteSamples;
      } else {
        const freq = midiToFreq(note.pitch);
        const noteVolume = (note.velocity / 15) * channelVolume;

        this.renderNote(
          channel.waveform,
          freq,
          duty,
          noteVolume,
          output,
          sampleIndex,
          noteSamples,
          lfsrState,
        );
        sampleIndex += noteSamples;
      }

      stepPos += noteDurationSteps;
    }
  }

  /**
   * Get the note playing at a given step position, with pattern wrapping.
   *
   * Walks the pattern, accumulating note durations until we reach the
   * target step. Wraps around if the pattern is shorter than the loop.
   */
  private getNoteAtStep(
    pattern: Note[],
    targetStep: number,
  ): { note: Note; noteIndex: number } {
    // Calculate total pattern length in steps
    let patternLength = 0;
    for (const note of pattern) {
      patternLength += note.duration;
    }

    if (patternLength === 0) {
      return { note: pattern[0]!, noteIndex: 0 };
    }

    // Wrap the target step to pattern length
    const wrappedStep = targetStep % patternLength;

    // Find which note covers this step
    let accumulated = 0;
    for (let i = 0; i < pattern.length; i++) {
      accumulated += pattern[i]!.duration;
      if (accumulated > wrappedStep) {
        return { note: pattern[i]!, noteIndex: i };
      }
    }

    // Should not reach here, but safety fallback
    return { note: pattern[pattern.length - 1]!, noteIndex: pattern.length - 1 };
  }

  /**
   * Render samples for a single note using the appropriate oscillator.
   */
  private renderNote(
    waveform: string,
    freq: number,
    duty: number,
    volume: number,
    output: Float32Array,
    startSample: number,
    numSamples: number,
    lfsrState: LFSRState,
  ): void {
    const phaseIncrement = freq / this.sampleRate;

    for (let i = 0; i < numSamples; i++) {
      const sampleIdx = startSample + i;
      if (sampleIdx >= output.length) break;

      // Calculate phase for tonal oscillators
      const phase = ((sampleIdx * phaseIncrement) % 1 + 1) % 1;

      let sample: number;
      switch (waveform) {
        case "square":
          sample = square(phase, duty);
          break;
        case "triangle":
          sample = triangle(phase);
          break;
        case "sawtooth":
          sample = sawtooth(phase);
          break;
        case "noise":
          sample = noise(lfsrState);
          break;
        default:
          sample = 0;
      }

      output[sampleIdx]! += sample * volume;
    }
  }

  /**
   * Normalize the output buffer to prevent clipping.
   * Divides all samples by the channel count.
   */
  private normalize(output: Float32Array, channelCount: number): void {
    if (channelCount <= 1) return;
    const scale = 1 / channelCount;
    for (let i = 0; i < output.length; i++) {
      output[i]! *= scale;
    }
  }
}
