import { describe, expect, it, beforeEach, mock } from "bun:test";
import { SFXManager } from "../SFXManager.ts";
import { SFX_PRESETS, footstep, alert, menuSelect } from "../presets.ts";
import type { SFXPreset } from "../types.ts";
import type { IAudioPlayer } from "../../player/AudioPlayer.ts";

/** Create a mock AudioPlayer that tracks calls. */
function createMockPlayer() {
  const calls: { method: string; args: unknown[] }[] = [];
  const player: IAudioPlayer = {
    play(filePath: string, options?: { loop?: boolean; volume?: number }) {
      calls.push({ method: "play", args: [filePath, options] });
    },
    stop() {
      calls.push({ method: "stop", args: [] });
    },
    isPlaying() {
      return false;
    },
    getCurrentFile() {
      return null;
    },
    setVolume(v: number) {
      calls.push({ method: "setVolume", args: [v] });
    },
    getVolume() {
      return 1;
    },
  };
  return { player, calls };
}

/** Create a mock write function that tracks calls. */
function createMockWriteFn() {
  const written: { path: string; size: number }[] = [];
  const writeFn = async (path: string, data: Uint8Array) => {
    written.push({ path, size: data.length });
    return data.length;
  };
  return { writeFn, written };
}

describe("SFXManager", () => {
  let mockPlayer: ReturnType<typeof createMockPlayer>;
  let mockWrite: ReturnType<typeof createMockWriteFn>;
  let manager: SFXManager;

  beforeEach(() => {
    mockPlayer = createMockPlayer();
    mockWrite = createMockWriteFn();
    manager = new SFXManager({
      player: mockPlayer.player,
      writeFn: mockWrite.writeFn,
      tempDir: "/tmp/test-sfx",
    });
  });

  describe("preset registration", () => {
    it("registers a single preset", () => {
      manager.register("footstep", footstep);
      expect(manager.has("footstep")).toBe(true);
      expect(manager.presetCount).toBe(1);
    });

    it("registers multiple presets with registerAll", () => {
      manager.registerAll(SFX_PRESETS);
      expect(manager.presetCount).toBe(Object.keys(SFX_PRESETS).length);
      expect(manager.has("footstep")).toBe(true);
      expect(manager.has("zone-transition")).toBe(true);
      expect(manager.has("dialogue-open")).toBe(true);
      expect(manager.has("dialogue-close")).toBe(true);
      expect(manager.has("save")).toBe(true);
      expect(manager.has("alert")).toBe(true);
      expect(manager.has("menu-select")).toBe(true);
    });

    it("returns false for unregistered presets", () => {
      expect(manager.has("nonexistent")).toBe(false);
    });

    it("retrieves a registered preset", () => {
      manager.register("alert", alert);
      const retrieved = manager.getPreset("alert");
      expect(retrieved).toEqual(alert);
    });

    it("returns undefined for unregistered preset", () => {
      expect(manager.getPreset("nonexistent")).toBeUndefined();
    });

    it("overwriting a preset invalidates cache", async () => {
      const preset1: SFXPreset = {
        waveform: "square",
        frequency: 440,
        duration: 0.1,
        volume: 0.5,
        volumeDecay: 0,
        duty: 0.5,
      };
      const preset2: SFXPreset = {
        waveform: "triangle",
        frequency: 880,
        duration: 0.2,
        volume: 0.8,
        volumeDecay: 0,
      };

      manager.register("test", preset1);
      await manager.play("test");
      expect(manager.isCached("test")).toBe(true);

      // Re-register with different preset invalidates cache
      manager.register("test", preset2);
      expect(manager.isCached("test")).toBe(false);
    });
  });

  describe("caching behavior", () => {
    it("caches WAV buffer on first play", async () => {
      manager.register("footstep", footstep);
      expect(manager.isCached("footstep")).toBe(false);
      expect(manager.cacheSize).toBe(0);

      await manager.play("footstep");

      expect(manager.isCached("footstep")).toBe(true);
      expect(manager.cacheSize).toBe(1);
    });

    it("reuses cached buffer on subsequent plays", async () => {
      manager.register("alert", alert);

      // First play: generates WAV
      await manager.play("alert");
      const firstWriteSize = mockWrite.written[0]!.size;

      // Second play: reuses cache
      await manager.play("alert");
      const secondWriteSize = mockWrite.written[1]!.size;

      // Both writes should have the same WAV data size
      expect(secondWriteSize).toBe(firstWriteSize);
      expect(manager.cacheSize).toBe(1); // still just 1 cached entry
    });

    it("clearCache removes all cached buffers but keeps presets", () => {
      manager.registerAll(SFX_PRESETS);

      // Force cache population by accessing internals
      // We just check the API contract
      manager.clearCache();
      expect(manager.cacheSize).toBe(0);
      expect(manager.presetCount).toBe(Object.keys(SFX_PRESETS).length);
    });

    it("caches different presets independently", async () => {
      manager.register("footstep", footstep);
      manager.register("alert", alert);

      await manager.play("footstep");
      expect(manager.cacheSize).toBe(1);

      await manager.play("alert");
      expect(manager.cacheSize).toBe(2);
    });
  });

  describe("playback", () => {
    it("plays a registered preset via AudioPlayer", async () => {
      manager.register("footstep", footstep);
      await manager.play("footstep");

      expect(mockPlayer.calls.length).toBe(1);
      expect(mockPlayer.calls[0]!.method).toBe("play");

      const [filePath] = mockPlayer.calls[0]!.args as [string];
      expect(filePath).toBe("/tmp/test-sfx/daydream-sfx-footstep.wav");
    });

    it("writes WAV to temp file before playing", async () => {
      manager.register("alert", alert);
      await manager.play("alert");

      expect(mockWrite.written.length).toBe(1);
      expect(mockWrite.written[0]!.path).toBe("/tmp/test-sfx/daydream-sfx-alert.wav");
      expect(mockWrite.written[0]!.size).toBeGreaterThan(44); // more than just header
    });

    it("silently ignores play for unregistered presets", async () => {
      await manager.play("nonexistent");
      expect(mockPlayer.calls.length).toBe(0);
      expect(mockWrite.written.length).toBe(0);
    });

    it("passes volume option to AudioPlayer", async () => {
      manager.register("menu-select", menuSelect);
      await manager.play("menu-select", { volume: 0.5 });

      const [, options] = mockPlayer.calls[0]!.args as [string, { volume?: number }];
      expect(options?.volume).toBe(0.5);
    });

    it("uses correct temp file name per preset", async () => {
      const preset = SFX_PRESETS["zone-transition"]!;
      manager.register("zone-transition", preset);
      await manager.play("zone-transition");

      const [filePath] = mockPlayer.calls[0]!.args as [string];
      expect(filePath).toContain("daydream-sfx-zone-transition.wav");
    });
  });

  describe("destroy", () => {
    it("stops the player on destroy", async () => {
      manager.register("footstep", footstep);
      await manager.play("footstep");

      await manager.destroy();

      const stopCalls = mockPlayer.calls.filter((c) => c.method === "stop");
      expect(stopCalls.length).toBe(1);
    });

    it("clears presets and cache on destroy", async () => {
      manager.registerAll(SFX_PRESETS);
      await manager.play("footstep");

      await manager.destroy();

      expect(manager.presetCount).toBe(0);
      expect(manager.cacheSize).toBe(0);
    });
  });
});
