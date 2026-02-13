/**
 * SFX Preset Catalog — predefined sound effects for game events.
 *
 * Each preset is an SFXPreset parameter set that the renderer synthesizes
 * into a WAV buffer. Presets are tuned for the terminal game aesthetic:
 * short, punchy, and retro.
 */

import type { SFXPreset } from "./types.ts";

/** Soft footstep tick — short noise burst with fast decay. */
export const footstep: SFXPreset = {
  waveform: "noise",
  frequency: 400,
  frequencySlide: -200,
  duration: 0.06,
  volume: 0.3,
  volumeDecay: 20,
};

/** Rising arpeggio for zone transitions — ascending square wave sweep. */
export const zoneTransition: SFXPreset = {
  waveform: "square",
  frequency: 300,
  frequencySlide: 1200,
  duration: 0.3,
  volume: 0.5,
  volumeDecay: 3,
  duty: 0.25,
};

/** Text blip for dialogue open — short square wave chirp. */
export const dialogueOpen: SFXPreset = {
  waveform: "square",
  frequency: 800,
  frequencySlide: 200,
  duration: 0.08,
  volume: 0.4,
  volumeDecay: 10,
  duty: 0.5,
};

/** Confirmation chime for dialogue close — two-note triangle descent. */
export const dialogueClose: SFXPreset = {
  waveform: "triangle",
  frequency: 600,
  frequencySlide: -150,
  duration: 0.15,
  volume: 0.5,
  volumeDecay: 5,
};

/** Save jingle — short ascending sawtooth chord. */
export const save: SFXPreset = {
  waveform: "sawtooth",
  frequency: 440,
  frequencySlide: 600,
  duration: 0.25,
  volume: 0.45,
  volumeDecay: 3,
};

/** Alert ping — triangle wave with moderate decay. */
export const alert: SFXPreset = {
  waveform: "triangle",
  frequency: 880,
  frequencySlide: -100,
  duration: 0.2,
  volume: 0.5,
  volumeDecay: 4,
};

/** Menu select click — very short square blip. */
export const menuSelect: SFXPreset = {
  waveform: "square",
  frequency: 1000,
  frequencySlide: 0,
  duration: 0.04,
  volume: 0.35,
  volumeDecay: 15,
  duty: 0.5,
};

/**
 * All built-in SFX presets, keyed by their event name.
 * Used by SFXManager for bulk registration.
 */
export const SFX_PRESETS: Record<string, SFXPreset> = {
  footstep,
  "zone-transition": zoneTransition,
  "dialogue-open": dialogueOpen,
  "dialogue-close": dialogueClose,
  save,
  alert,
  "menu-select": menuSelect,
};
