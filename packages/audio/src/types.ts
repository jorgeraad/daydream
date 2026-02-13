// @daydream/audio — Zod schemas for music synthesis data
// Single source of truth: TypeScript types derived via z.infer<>

import { z } from "zod";

// --- Note ---

export const NoteSchema = z.object({
  /** MIDI note number (0-127). 0 = rest. */
  pitch: z.number().int().min(0).max(127),
  /** Duration in steps (1 = sixteenth note at base resolution). */
  duration: z.number().int().min(1).max(16),
  /** Velocity/volume (0-15, matching 4-bit NES range). */
  velocity: z.number().int().min(0).max(15).default(12),
});
export type Note = z.infer<typeof NoteSchema>;

// --- Channel ---

export const WaveformSchema = z.enum([
  "square",
  "triangle",
  "sawtooth",
  "noise",
]);
export type Waveform = z.infer<typeof WaveformSchema>;

export const DutyCycleSchema = z.enum(["12.5", "25", "50", "75"]);
export type DutyCycle = z.infer<typeof DutyCycleSchema>;

export const ChannelSchema = z.object({
  /** Waveform type -- matches classic NES/GB channels. */
  waveform: WaveformSchema,
  /** Duty cycle for square wave (12.5%, 25%, 50%, 75%). Ignored for other waveforms. */
  duty: DutyCycleSchema.default("50"),
  /** Volume (0-15). */
  volume: z.number().int().min(0).max(15).default(12),
  /** Note pattern. Loops when the longest channel finishes. */
  pattern: z.array(NoteSchema),
});
export type Channel = z.infer<typeof ChannelSchema>;

// --- MusicSpec ---

export const MusicSpecSchema = z.object({
  /** Tempo in BPM (60-200). */
  bpm: z.number().int().min(60).max(200),
  /** Musical key (e.g., "C", "Am", "F#m"). */
  key: z.string(),
  /** Time signature numerator (3 or 4 for MVP). */
  timeSignature: z.number().int().min(3).max(4).default(4),
  /** Channels (2-4, matching NES hardware). */
  channels: z.array(ChannelSchema).min(2).max(4),
  /** Loop length in measures. All channels loop at this boundary. */
  loopMeasures: z.number().int().min(2).max(16).default(4),
  /** Mood tag for reference (not used in synthesis, just metadata). */
  mood: z.string().optional(),
});
export type MusicSpec = z.infer<typeof MusicSpecSchema>;

// --- Synthesis constants ---

/** Standard audio sample rate (CD quality). */
export const SAMPLE_RATE = 44100;

/** Convert a MIDI note number to frequency in Hz. */
export function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Duty cycle string to numeric fraction. */
export function dutyToFraction(duty: DutyCycle): number {
  switch (duty) {
    case "12.5":
      return 0.125;
    case "25":
      return 0.25;
    case "50":
      return 0.5;
    case "75":
      return 0.75;
  }
}
