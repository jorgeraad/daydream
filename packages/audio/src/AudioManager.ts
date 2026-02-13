/**
 * AudioManager — top-level orchestrator for music and sound effects.
 *
 * Subscribes to game events via EventBus and triggers the appropriate audio
 * response: zone music synthesis + playback, footstep SFX, dialogue blips
 * with music ducking, save jingles, etc.
 *
 * Manages two separate AudioPlayer instances (one for music, one for SFX)
 * so sound effects never interrupt background music.
 */

import * as os from "node:os";
import * as path from "node:path";
import { unlink } from "node:fs/promises";
import type { EventBus } from "@daydream/engine";
import type { IAudioPlayer } from "./player/AudioPlayer.ts";
import type { MusicSpec } from "./types.ts";
import { MusicSpecSchema } from "./types.ts";
import { ChiptuneEngine } from "./synth/ChiptuneEngine.ts";
import { SFXManager } from "./sfx/SFXManager.ts";
import { SFX_PRESETS } from "./sfx/presets.ts";

/** Configuration for AudioManager. */
export interface AudioManagerConfig {
  /** Whether audio is globally enabled. Default: true. */
  enabled?: boolean;
  /** Whether background music is enabled. Default: true. */
  musicEnabled?: boolean;
  /** Whether sound effects are enabled. Default: true. */
  sfxEnabled?: boolean;
  /** Music volume (0.0-1.0). Default: 0.6. */
  musicVolume?: number;
  /** SFX volume (0.0-1.0). Default: 0.8. */
  sfxVolume?: number;
  /** Music volume multiplier during dialogue ducking (0.0-1.0). Default: 0.3. */
  duckingLevel?: number;
  /** Override temp directory for writing WAV files. */
  tempDir?: string;
  /** Override file write function (for testing). */
  writeFn?: (filePath: string, data: Uint8Array) => Promise<number>;
}

/**
 * Function to look up a zone's music spec by zone ID.
 * Returns the MusicSpec if the zone has one, or null otherwise.
 */
export type ZoneMusicLookup = (zoneId: string) => MusicSpec | null;

/**
 * AudioManager ties together music playback, SFX, and game events.
 *
 * Usage:
 * ```ts
 * const manager = new AudioManager({
 *   eventBus,
 *   musicPlayer,
 *   sfxPlayer,
 *   zoneMusicLookup: (zoneId) => world.getZone(zoneId)?.musicSpec ?? null,
 * });
 * // EventBus events automatically trigger audio responses.
 * // Call destroy() on game exit.
 * ```
 */
export class AudioManager {
  private eventBus: EventBus;
  private musicPlayer: IAudioPlayer;
  private sfxManager: SFXManager;
  private chiptuneEngine: ChiptuneEngine;
  private zoneMusicLookup: ZoneMusicLookup;

  // State
  private currentZoneId: string | null = null;
  private musicTempFiles = new Set<string>();
  private enabled: boolean;
  private musicEnabled: boolean;
  private sfxEnabled: boolean;
  private musicVolume: number;
  private sfxVolume: number;
  private duckingLevel: number;
  private isDucked = false;
  private tempDir: string;
  private writeFn: (filePath: string, data: Uint8Array) => Promise<number>;

  // Bound handlers (stored for cleanup via eventBus.off)
  private boundHandlers: {
    onZoneEntered: (data: { zoneId: string }) => void;
    onPlayerMoved: (data: { position: { x: number; y: number }; zone: string }) => void;
    onDialogueStarted: (data: { characterId: string }) => void;
    onDialogueEnded: (data: { characterId: string; conversation: unknown }) => void;
    onSaveCompleted: (data: Record<string, never>) => void;
  };

  constructor(options: {
    eventBus: EventBus;
    musicPlayer: IAudioPlayer;
    sfxPlayer: IAudioPlayer;
    zoneMusicLookup: ZoneMusicLookup;
    config?: AudioManagerConfig;
  }) {
    this.eventBus = options.eventBus;
    this.musicPlayer = options.musicPlayer;
    this.zoneMusicLookup = options.zoneMusicLookup;
    this.chiptuneEngine = new ChiptuneEngine();

    const config = options.config ?? {};
    this.enabled = config.enabled ?? true;
    this.musicEnabled = config.musicEnabled ?? true;
    this.sfxEnabled = config.sfxEnabled ?? true;
    this.musicVolume = config.musicVolume ?? 0.6;
    this.sfxVolume = config.sfxVolume ?? 0.8;
    this.duckingLevel = config.duckingLevel ?? 0.3;
    this.tempDir = config.tempDir ?? os.tmpdir();
    this.writeFn = config.writeFn ?? ((p, data) => Bun.write(p, data));

    // Set up SFX manager with its own player and register all built-in presets
    this.sfxManager = new SFXManager({
      player: options.sfxPlayer,
      writeFn: config.writeFn,
      tempDir: config.tempDir,
    });
    this.sfxManager.registerAll(SFX_PRESETS);

    // Bind event handlers
    this.boundHandlers = {
      onZoneEntered: (data) => this.onZoneEntered(data),
      onPlayerMoved: () => this.onPlayerMoved(),
      onDialogueStarted: () => this.onDialogueStarted(),
      onDialogueEnded: () => this.onDialogueEnded(),
      onSaveCompleted: () => this.onSaveCompleted(),
    };

    // Subscribe to game events
    this.eventBus.on("zone:entered", this.boundHandlers.onZoneEntered);
    this.eventBus.on("player:moved", this.boundHandlers.onPlayerMoved);
    this.eventBus.on("dialogue:started", this.boundHandlers.onDialogueStarted);
    this.eventBus.on("dialogue:ended", this.boundHandlers.onDialogueEnded as never);
    this.eventBus.on("save:completed", this.boundHandlers.onSaveCompleted);
  }

  /**
   * Handle zone:entered — synthesize and play zone music.
   * Skips if the player is already in this zone (same music continues).
   */
  private async onZoneEntered(data: { zoneId: string }): Promise<void> {
    if (!this.enabled || !this.musicEnabled) return;
    if (data.zoneId === this.currentZoneId) return;

    // Stop current music
    this.stopMusic();
    this.currentZoneId = data.zoneId;

    // Look up the zone's music spec
    const rawMusicSpec = this.zoneMusicLookup(data.zoneId);
    if (!rawMusicSpec) return;

    // Validate with Zod
    const parsed = MusicSpecSchema.safeParse(rawMusicSpec);
    if (!parsed.success) return;

    const musicSpec = parsed.data;

    // Synthesize WAV from the music spec
    const wavBuffer = this.chiptuneEngine.render(musicSpec);

    // Write to temp file
    const tempPath = path.join(this.tempDir, `daydream-music-${data.zoneId}.wav`);
    await this.writeFn(tempPath, wavBuffer);
    this.musicTempFiles.add(tempPath);

    // Play looped at configured volume (possibly ducked)
    const volume = this.isDucked
      ? this.musicVolume * this.duckingLevel
      : this.musicVolume;
    this.musicPlayer.play(tempPath, { loop: true, volume });

    // Emit audio event
    this.eventBus.emit("audio:music-started", {
      zoneId: data.zoneId,
      mood: musicSpec.mood,
    });
  }

  /** Handle player:moved — play footstep SFX. */
  private onPlayerMoved(): void {
    this.playSFX("footstep");
  }

  /** Handle dialogue:started — play blip SFX and duck music. */
  private onDialogueStarted(): void {
    this.playSFX("dialogue-open");
    this.duckMusic();
  }

  /** Handle dialogue:ended — play chime SFX and restore music. */
  private onDialogueEnded(): void {
    this.playSFX("dialogue-close");
    this.restoreMusic();
  }

  /** Handle save:completed — play save jingle SFX. */
  private onSaveCompleted(): void {
    this.playSFX("save");
  }

  /**
   * Play a named sound effect. Respects enabled/disabled state.
   * Emits audio:sfx-played event on success.
   */
  playSFX(name: string): void {
    if (!this.enabled || !this.sfxEnabled) return;
    this.sfxManager.play(name, { volume: this.sfxVolume });
    this.eventBus.emit("audio:sfx-played", { name });
  }

  /**
   * Duck music volume during dialogue.
   * Reduces music to duckingLevel * musicVolume.
   */
  duckMusic(): void {
    if (!this.musicEnabled || this.isDucked) return;
    this.isDucked = true;
    this.musicPlayer.setVolume(this.musicVolume * this.duckingLevel);
  }

  /**
   * Restore music volume after dialogue ends.
   * Returns music to the configured musicVolume.
   */
  restoreMusic(): void {
    if (!this.musicEnabled || !this.isDucked) return;
    this.isDucked = false;
    this.musicPlayer.setVolume(this.musicVolume);
  }

  /** Stop music playback and emit audio:music-stopped event. */
  stopMusic(): void {
    if (this.musicPlayer.isPlaying()) {
      this.musicPlayer.stop();
      this.eventBus.emit("audio:music-stopped", {});
    }
  }

  /** Set whether audio is globally enabled. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopMusic();
    }
  }

  /** Set whether music is enabled. */
  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    }
  }

  /** Set whether SFX are enabled. */
  setSFXEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
  }

  /** Set the music volume (0.0-1.0). */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (!this.isDucked) {
      this.musicPlayer.setVolume(this.musicVolume);
    } else {
      this.musicPlayer.setVolume(this.musicVolume * this.duckingLevel);
    }
  }

  /** Set the SFX volume (0.0-1.0). */
  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  /** Get the current zone ID that music is playing for. */
  getCurrentZoneId(): string | null {
    return this.currentZoneId;
  }

  /** Check if music is currently ducked. */
  isMusicDucked(): boolean {
    return this.isDucked;
  }

  /** Check if audio is enabled. */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Check if music is enabled. */
  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  /** Check if SFX are enabled. */
  isSFXEnabled(): boolean {
    return this.sfxEnabled;
  }

  /**
   * Clean up: stop all playback, remove event subscriptions,
   * delete temp files, and destroy the SFX manager.
   */
  async destroy(): Promise<void> {
    // Unsubscribe from events
    this.eventBus.off("zone:entered", this.boundHandlers.onZoneEntered);
    this.eventBus.off("player:moved", this.boundHandlers.onPlayerMoved);
    this.eventBus.off("dialogue:started", this.boundHandlers.onDialogueStarted);
    this.eventBus.off("dialogue:ended", this.boundHandlers.onDialogueEnded as never);
    this.eventBus.off("save:completed", this.boundHandlers.onSaveCompleted);

    // Stop music
    this.musicPlayer.stop();

    // Clean up music temp files
    for (const filePath of this.musicTempFiles) {
      try {
        await unlink(filePath);
      } catch {
        // Ignore cleanup errors (file may not exist)
      }
    }
    this.musicTempFiles.clear();

    // Destroy SFX manager (cleans up its own temp files)
    await this.sfxManager.destroy();

    this.currentZoneId = null;
    this.isDucked = false;
  }
}
