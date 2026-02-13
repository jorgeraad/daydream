/**
 * SFXPreset — Zod schema for procedural sound effect parameters.
 *
 * Each sound effect is defined as a parameter set (sfxr-style).
 * The renderer synthesizes a WAV buffer from these parameters.
 *
 * Reuses the shared WaveformSchema from the audio package types.
 */

import { z } from "zod";
import { WaveformSchema } from "../types.ts";

/**
 * SFXPreset defines the parameters for procedural sound effect generation.
 *
 * - waveform: The oscillator waveform shape (shared with music synthesis)
 * - frequency: Starting frequency in Hz
 * - frequencySlide: Hz per second change (positive = rising pitch, negative = falling)
 * - duration: Length of the sound in seconds
 * - volume: Peak volume (0.0 to 1.0)
 * - volumeDecay: Exponential decay rate (0 = sustain, higher = faster fade)
 * - duty: Square wave duty cycle (0.0 to 1.0). Only affects square waveform.
 */
export const SFXPresetSchema = z.object({
  waveform: WaveformSchema,
  frequency: z.number().positive(),
  frequencySlide: z.number().default(0),
  duration: z.number().positive().max(5),
  volume: z.number().min(0).max(1).default(0.8),
  volumeDecay: z.number().min(0).default(0),
  duty: z.number().min(0).max(1).optional(),
});
/**
 * SFXPreset input type — fields with defaults (frequencySlide, volume,
 * volumeDecay) are optional. The renderer calls .parse() to fill defaults.
 */
export type SFXPreset = z.input<typeof SFXPresetSchema>;
