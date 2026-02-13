// @daydream/audio — Audio playback and synthesis for the game
// Platform-aware CLI player detection and audio playback

// Player detection
export {
  detectPlayer,
  isBinaryAvailable,
  PLAYER_PRIORITY,
} from "./player/PlayerDetector.ts";
export type { PlayerInfo } from "./player/PlayerDetector.ts";

// Audio playback
export {
  AudioPlayer,
  NullAudioPlayer,
  createAudioPlayer,
} from "./player/AudioPlayer.ts";
export type {
  PlayOptions,
  AudioPlayerConfig,
  SpawnOptions,
  SpawnResult,
  IAudioPlayer,
} from "./player/AudioPlayer.ts";

// Music types (Zod schemas + derived types)
export {
  NoteSchema,
  WaveformSchema,
  DutyCycleSchema,
  ChannelSchema,
  MusicSpecSchema,
  SAMPLE_RATE,
  midiToFreq,
  dutyToFraction,
} from "./types.ts";
export type {
  Note,
  Waveform,
  DutyCycle,
  Channel,
  MusicSpec,
} from "./types.ts";

// Chiptune synthesis
export {
  square,
  triangle,
  sawtooth,
  noise,
  createLFSRState,
  encodeWav,
  parseWavHeader,
  Sequencer,
  ChiptuneEngine,
} from "./synth/index.ts";
export type {
  LFSRState,
  WavHeader,
  SequencerConfig,
  ChiptuneEngineConfig,
} from "./synth/index.ts";

// Sound effects
export {
  SFXPresetSchema,
  renderSFX,
  SFXManager,
  SFX_PRESETS,
  footstep,
  zoneTransition,
  dialogueOpen,
  dialogueClose,
  save,
  alert,
  menuSelect,
} from "./sfx/index.ts";
export type {
  SFXPreset,
  SFXManagerConfig,
} from "./sfx/index.ts";

// AudioManager — top-level orchestrator
export { AudioManager } from "./AudioManager.ts";
export type { AudioManagerConfig, ZoneMusicLookup } from "./AudioManager.ts";
