// Oscillator waveform generators for chiptune synthesis
// All oscillators output values in the range [-1, 1]
// Phase is expected in the range [0, 1)

/**
 * Square wave with variable duty cycle.
 * Models NES 2A03 pulse channels.
 *
 * @param phase - Current phase position [0, 1)
 * @param duty - Duty cycle fraction (0.125, 0.25, 0.5, 0.75)
 * @returns Sample value in [-1, 1]
 */
export function square(phase: number, duty: number): number {
  return phase < duty ? 1 : -1;
}

/**
 * Triangle wave oscillator.
 * Models NES 2A03 triangle channel -- softer bass/melody tone.
 *
 * @param phase - Current phase position [0, 1)
 * @returns Sample value in [-1, 1]
 */
export function triangle(phase: number): number {
  return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
}

/**
 * Sawtooth wave oscillator.
 * Not on NES but common in chiptune (Game Boy, C64).
 *
 * @param phase - Current phase position [0, 1)
 * @returns Sample value in [-1, 1]
 */
export function sawtooth(phase: number): number {
  return 2 * phase - 1;
}

/**
 * LFSR state for noise oscillator.
 * Must be initialized with a non-zero value before first use.
 */
export interface LFSRState {
  lfsr: number;
}

/** Default initial LFSR state (NES starts at 1). */
export function createLFSRState(): LFSRState {
  return { lfsr: 1 };
}

/**
 * White noise via 15-bit Linear Feedback Shift Register.
 * Models NES 2A03 noise channel -- percussion, hi-hats.
 *
 * The LFSR is advanced once per call, producing pseudo-random
 * output. State is mutated in-place for continuity across samples.
 *
 * @param state - Mutable LFSR state (mutated in-place)
 * @returns Sample value: either -1 or 1
 */
export function noise(state: LFSRState): number {
  // 15-bit LFSR with taps at bits 0 and 1 (NES-style)
  const bit = ((state.lfsr >> 0) ^ (state.lfsr >> 1)) & 1;
  state.lfsr = (state.lfsr >> 1) | (bit << 14);
  return (state.lfsr & 1) ? 1 : -1;
}
