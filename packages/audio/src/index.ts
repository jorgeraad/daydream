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
