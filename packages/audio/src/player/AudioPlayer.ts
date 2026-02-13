/**
 * AudioPlayer — plays audio files via system CLI players.
 *
 * Wraps Bun.spawn() to play WAV files using whichever CLI audio player
 * was detected by PlayerDetector. Supports play, stop, loop (native flag
 * or re-spawn), and volume control.
 *
 * When no player is available, all operations are silently no-ops,
 * allowing the game to run without sound.
 */

import type { Subprocess } from "bun";
import type { PlayerInfo } from "./PlayerDetector.ts";

/** Options for AudioPlayer.play(). */
export interface PlayOptions {
  /** Whether to loop the audio until stop() is called. Default: false. */
  loop?: boolean;
  /** Volume level from 0.0 (silent) to 1.0 (full). Default: 1.0. */
  volume?: number;
}

/** Configuration for the AudioPlayer. */
export interface AudioPlayerConfig {
  /** The detected CLI audio player info. */
  player: PlayerInfo;
  /**
   * Override the spawn function for testing.
   * Must return an object compatible with Subprocess (kill, exitCode, exited).
   */
  spawnFn?: (args: string[], options: SpawnOptions) => SpawnResult;
}

/** Subset of Bun.spawn options used by AudioPlayer. */
export interface SpawnOptions {
  stdout: "ignore";
  stderr: "ignore";
  onExit?: () => void;
}

/** Subset of Subprocess returned by spawn. */
export interface SpawnResult {
  kill: () => void;
  readonly exitCode: number | null;
  readonly exited: Promise<number>;
}

/**
 * AudioPlayer plays audio files using a detected CLI audio player.
 *
 * If no player is available, create a NullAudioPlayer instead (see below).
 */
export class AudioPlayer {
  private process: SpawnResult | null = null;
  private player: PlayerInfo;
  private looping = false;
  private currentFile: string | null = null;
  private volume = 1.0;
  private spawnFn: (args: string[], options: SpawnOptions) => SpawnResult;

  constructor(config: AudioPlayerConfig) {
    this.player = config.player;
    this.spawnFn = config.spawnFn ?? ((args, options) => {
      const proc = Bun.spawn(args, {
        stdout: options.stdout,
        stderr: options.stderr,
        onExit: options.onExit ? () => options.onExit!() : undefined,
      });
      return proc as unknown as SpawnResult;
    });
  }

  /** Play an audio file. Stops any currently playing audio first. */
  play(filePath: string, options?: PlayOptions): void {
    this.stop();

    const volume = options?.volume ?? this.volume;
    const loop = options?.loop ?? false;

    const args = this.buildArgs(filePath, volume, loop);

    this.currentFile = filePath;
    this.looping = loop;

    if (this.looping && !this.player.loopFlag) {
      this.startReSpawnLoop(args);
    } else {
      this.process = this.spawnFn(args, {
        stdout: "ignore",
        stderr: "ignore",
      });
    }
  }

  /** Stop current playback. */
  stop(): void {
    this.looping = false;
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.currentFile = null;
  }

  /** Check if audio is currently playing. */
  isPlaying(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  /** Get the path of the currently playing file, or null. */
  getCurrentFile(): string | null {
    return this.currentFile;
  }

  /** Set the default volume for future play() calls without explicit volume. */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /** Get the current default volume. */
  getVolume(): number {
    return this.volume;
  }

  /** Build the command-line arguments for the audio player. */
  private buildArgs(filePath: string, volume: number, loop: boolean): string[] {
    const args = [this.player.binary];

    if (volume !== undefined) {
      args.push(...this.player.volumeFlag(volume));
    }

    if (loop && this.player.loopFlag) {
      args.push(...this.player.loopFlag);
    }

    args.push(filePath);

    return args;
  }

  /**
   * For players without native loop support (afplay, aplay):
   * re-spawn the process each time it exits until stop() is called.
   */
  private startReSpawnLoop(args: string[]): void {
    const spawn = () => {
      this.process = this.spawnFn(args, {
        stdout: "ignore",
        stderr: "ignore",
        onExit: () => {
          if (this.looping) {
            spawn();
          }
        },
      });
    };
    spawn();
  }
}

/**
 * NullAudioPlayer — a no-op player used when no CLI audio player is available.
 * All methods silently do nothing, allowing the game to run without sound.
 */
export class NullAudioPlayer {
  play(_filePath: string, _options?: PlayOptions): void {
    // No-op: no audio player available
  }

  stop(): void {
    // No-op
  }

  isPlaying(): boolean {
    return false;
  }

  getCurrentFile(): string | null {
    return null;
  }

  setVolume(_volume: number): void {
    // No-op
  }

  getVolume(): number {
    return 0;
  }
}

/** Union type for use in the game — either a real player or a null one. */
export type IAudioPlayer = AudioPlayer | NullAudioPlayer;

/**
 * Create an audio player from a detected PlayerInfo.
 * Returns a NullAudioPlayer if playerInfo is null (no player found).
 */
export function createAudioPlayer(
  playerInfo: PlayerInfo | null,
): IAudioPlayer {
  if (playerInfo === null) {
    return new NullAudioPlayer();
  }
  return new AudioPlayer({ player: playerInfo });
}
