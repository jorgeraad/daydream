// AudioSettings — Zod schema for audio configuration.
// Single source of truth: TypeScript types derived via z.infer<>.

import { z } from "zod";

/**
 * Audio settings schema with sensible defaults.
 * Stored in the `audio` section of `~/.daydream/settings.json`.
 */
export const AudioSettingsSchema = z.object({
  /** Master audio enabled/disabled. */
  enabled: z.boolean().default(true),
  /** Background music enabled. */
  musicEnabled: z.boolean().default(true),
  /** Sound effects enabled. */
  sfxEnabled: z.boolean().default(true),
  /** Master volume (0.0 - 1.0). */
  masterVolume: z.number().min(0).max(1).default(0.7),
  /** Music volume relative to master (0.0 - 1.0). */
  musicVolume: z.number().min(0).max(1).default(0.6),
  /** SFX volume relative to master (0.0 - 1.0). */
  sfxVolume: z.number().min(0).max(1).default(0.8),
});

export type AudioSettings = z.infer<typeof AudioSettingsSchema>;

/** Default audio settings (all fields filled with defaults). */
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = AudioSettingsSchema.parse({});
