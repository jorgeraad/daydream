/**
 * SFXManager — manages sound effect preset registration, WAV caching, and playback.
 *
 * Uses a dedicated AudioPlayer instance so SFX playback does not interrupt
 * background music. WAV buffers are generated lazily on first play and cached
 * for subsequent plays.
 */

import * as os from "node:os";
import * as path from "node:path";
import type { IAudioPlayer } from "../player/AudioPlayer.ts";
import type { SFXPreset } from "./types.ts";
import { renderSFX } from "./renderer.ts";

/** Configuration for SFXManager. */
export interface SFXManagerConfig {
  /** The AudioPlayer instance to use for SFX playback. */
  player: IAudioPlayer;
  /**
   * Override for writing temp files (for testing).
   * Default: Bun.write
   */
  writeFn?: (path: string, data: Uint8Array) => Promise<number>;
  /** Override the temp directory (for testing). */
  tempDir?: string;
}

/**
 * SFXManager handles preset registration, WAV caching, and non-blocking playback.
 *
 * Usage:
 * ```ts
 * const sfx = new SFXManager({ player: sfxPlayer });
 * sfx.register("footstep", footstepPreset);
 * sfx.play("footstep");
 * ```
 */
export class SFXManager {
  private presets = new Map<string, SFXPreset>();
  private cache = new Map<string, Uint8Array>();
  private tempFiles = new Set<string>();
  private player: IAudioPlayer;
  private writeFn: (path: string, data: Uint8Array) => Promise<number>;
  private tempDir: string;

  constructor(config: SFXManagerConfig) {
    this.player = config.player;
    this.writeFn = config.writeFn ?? ((p, data) => Bun.write(p, data));
    this.tempDir = config.tempDir ?? os.tmpdir();
  }

  /** Register a named sound effect preset. */
  register(name: string, preset: SFXPreset): void {
    this.presets.set(name, preset);
    // Invalidate cache if preset changes
    this.cache.delete(name);
  }

  /** Register multiple presets from a record. */
  registerAll(presets: Record<string, SFXPreset>): void {
    for (const [name, preset] of Object.entries(presets)) {
      this.register(name, preset);
    }
  }

  /** Check if a preset is registered. */
  has(name: string): boolean {
    return this.presets.has(name);
  }

  /** Get a registered preset by name. */
  getPreset(name: string): SFXPreset | undefined {
    return this.presets.get(name);
  }

  /** Check if a WAV buffer is cached for the given preset name. */
  isCached(name: string): boolean {
    return this.cache.has(name);
  }

  /**
   * Play a registered sound effect by name. Non-blocking.
   *
   * On first play, the WAV buffer is generated from the preset parameters
   * and cached. Subsequent plays reuse the cached buffer.
   *
   * If the preset is not registered, this is a silent no-op.
   */
  async play(name: string, options?: { volume?: number }): Promise<void> {
    const preset = this.presets.get(name);
    if (!preset) return;

    // Get or generate WAV buffer
    let wav = this.cache.get(name);
    if (!wav) {
      wav = renderSFX(preset);
      this.cache.set(name, wav);
    }

    // Write to temp file and play
    const tempPath = path.join(this.tempDir, `daydream-sfx-${name}.wav`);
    await this.writeFn(tempPath, wav);
    this.tempFiles.add(tempPath);
    this.player.play(tempPath, { volume: options?.volume });
  }

  /** Clear all cached WAV buffers. Presets remain registered. */
  clearCache(): void {
    this.cache.clear();
  }

  /** Get the number of registered presets. */
  get presetCount(): number {
    return this.presets.size;
  }

  /** Get the number of cached WAV buffers. */
  get cacheSize(): number {
    return this.cache.size;
  }

  /** Clean up temp files and stop playback. */
  async destroy(): Promise<void> {
    this.player.stop();
    // Attempt to remove temp files (best effort)
    for (const filePath of this.tempFiles) {
      try {
        const { unlink } = await import("node:fs/promises");
        await unlink(filePath);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.tempFiles.clear();
    this.cache.clear();
    this.presets.clear();
  }
}
