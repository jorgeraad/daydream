import { describe, expect, it, beforeEach } from "bun:test";
import { EventBus } from "@daydream/engine";
import { AudioManager } from "../AudioManager.ts";
import type { IAudioPlayer, PlayOptions } from "../player/AudioPlayer.ts";
import type { MusicSpec } from "../types.ts";

// ── Helpers ──────────────────────────────────────────────────

/** Create a mock AudioPlayer that tracks calls and state. */
function createMockPlayer() {
  const calls: { method: string; args: unknown[] }[] = [];
  let playing = false;
  let currentFile: string | null = null;
  let volume = 1.0;

  const player: IAudioPlayer = {
    play(filePath: string, options?: PlayOptions) {
      calls.push({ method: "play", args: [filePath, options] });
      playing = true;
      currentFile = filePath;
    },
    stop() {
      calls.push({ method: "stop", args: [] });
      playing = false;
      currentFile = null;
    },
    isPlaying() {
      return playing;
    },
    getCurrentFile() {
      return currentFile;
    },
    setVolume(v: number) {
      calls.push({ method: "setVolume", args: [v] });
      volume = v;
    },
    getVolume() {
      return volume;
    },
  };

  return { player, calls, getVolume: () => volume, isPlaying: () => playing };
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

/** A minimal valid MusicSpec for testing. */
function createTestMusicSpec(): MusicSpec {
  return {
    bpm: 120,
    key: "C",
    timeSignature: 4,
    loopMeasures: 2,
    mood: "peaceful",
    channels: [
      {
        waveform: "square",
        duty: "50",
        volume: 12,
        pattern: [
          { pitch: 60, duration: 4, velocity: 12 },
          { pitch: 64, duration: 4, velocity: 12 },
        ],
      },
      {
        waveform: "triangle",
        duty: "50",
        volume: 10,
        pattern: [
          { pitch: 48, duration: 8, velocity: 10 },
        ],
      },
    ],
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("AudioManager", () => {
  let eventBus: EventBus;
  let musicPlayer: ReturnType<typeof createMockPlayer>;
  let sfxPlayer: ReturnType<typeof createMockPlayer>;
  let mockWrite: ReturnType<typeof createMockWriteFn>;
  let musicLookup: Map<string, MusicSpec>;
  let manager: AudioManager;

  beforeEach(() => {
    eventBus = new EventBus();
    musicPlayer = createMockPlayer();
    sfxPlayer = createMockPlayer();
    mockWrite = createMockWriteFn();
    musicLookup = new Map();

    manager = new AudioManager({
      eventBus,
      musicPlayer: musicPlayer.player,
      sfxPlayer: sfxPlayer.player,
      zoneMusicLookup: (zoneId: string) => musicLookup.get(zoneId) ?? null,
      config: {
        tempDir: "/tmp/test-audio",
        writeFn: mockWrite.writeFn,
        musicVolume: 0.6,
        sfxVolume: 0.8,
        duckingLevel: 0.3,
      },
    });
  });

  // ── EventBus → audio trigger mapping ───────────────────────

  describe("EventBus trigger mapping", () => {
    it("zone:entered triggers music synthesis and playback", async () => {
      const spec = createTestMusicSpec();
      musicLookup.set("zone_0_0", spec);

      eventBus.emit("zone:entered", { zoneId: "zone_0_0" });

      // Give the async onZoneEntered time to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should have written a temp WAV file
      expect(mockWrite.written.length).toBe(1);
      expect(mockWrite.written[0]!.path).toBe("/tmp/test-audio/daydream-music-zone_0_0.wav");
      expect(mockWrite.written[0]!.size).toBeGreaterThan(44); // WAV header + data

      // Should have played the file with loop
      const playCalls = musicPlayer.calls.filter((c) => c.method === "play");
      expect(playCalls.length).toBe(1);
      const [filePath, options] = playCalls[0]!.args as [string, PlayOptions];
      expect(filePath).toBe("/tmp/test-audio/daydream-music-zone_0_0.wav");
      expect(options?.loop).toBe(true);
    });

    it("zone:entered skips if same zone (deduplication)", async () => {
      const spec = createTestMusicSpec();
      musicLookup.set("zone_0_0", spec);

      eventBus.emit("zone:entered", { zoneId: "zone_0_0" });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Emit again for same zone
      eventBus.emit("zone:entered", { zoneId: "zone_0_0" });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Music should have been written only once
      expect(mockWrite.written.length).toBe(1);
    });

    it("zone:entered handles zone without musicSpec gracefully", async () => {
      // No musicSpec registered for this zone
      eventBus.emit("zone:entered", { zoneId: "zone_1_0" });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // No WAV written, no play call
      expect(mockWrite.written.length).toBe(0);
      const playCalls = musicPlayer.calls.filter((c) => c.method === "play");
      expect(playCalls.length).toBe(0);
    });

    it("player:moved triggers footstep SFX", async () => {
      eventBus.emit("player:moved", { position: { x: 5, y: 10 }, zone: "zone_0_0" });

      // SFXManager.play is async (writes temp file before calling player.play)
      await new Promise((resolve) => setTimeout(resolve, 50));

      // SFX player should have received a play call for footstep
      const playCalls = sfxPlayer.calls.filter((c) => c.method === "play");
      expect(playCalls.length).toBe(1);
      const [filePath] = playCalls[0]!.args as [string];
      expect(filePath).toContain("daydream-sfx-footstep.wav");
    });

    it("dialogue:started triggers dialogue-open SFX", async () => {
      eventBus.emit("dialogue:started", { characterId: "npc_guard" });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const playCalls = sfxPlayer.calls.filter((c) => c.method === "play");
      expect(playCalls.length).toBe(1);
      const [filePath] = playCalls[0]!.args as [string];
      expect(filePath).toContain("daydream-sfx-dialogue-open.wav");
    });

    it("dialogue:ended triggers dialogue-close SFX", async () => {
      eventBus.emit("dialogue:ended", {
        characterId: "npc_guard",
        conversation: {
          characterId: "npc_guard",
          turns: [],
          startedAt: Date.now(),
          mood: "neutral",
          topicsDiscussed: [],
          isActive: false,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const playCalls = sfxPlayer.calls.filter((c) => c.method === "play");
      expect(playCalls.length).toBe(1);
      const [filePath] = playCalls[0]!.args as [string];
      expect(filePath).toContain("daydream-sfx-dialogue-close.wav");
    });

    it("save:completed triggers save SFX", async () => {
      eventBus.emit("save:completed", {});

      await new Promise((resolve) => setTimeout(resolve, 50));

      const playCalls = sfxPlayer.calls.filter((c) => c.method === "play");
      expect(playCalls.length).toBe(1);
      const [filePath] = playCalls[0]!.args as [string];
      expect(filePath).toContain("daydream-sfx-save.wav");
    });
  });

  // ── Audio GameEvents emission ──────────────────────────────

  describe("audio GameEvents emission", () => {
    it("emits audio:music-started on zone:entered with music", async () => {
      const spec = createTestMusicSpec();
      musicLookup.set("zone_0_0", spec);

      const events: { zoneId: string; mood?: string }[] = [];
      eventBus.on("audio:music-started", (data) => events.push(data));

      eventBus.emit("zone:entered", { zoneId: "zone_0_0" });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(events.length).toBe(1);
      expect(events[0]!.zoneId).toBe("zone_0_0");
      expect(events[0]!.mood).toBe("peaceful");
    });

    it("emits audio:music-stopped when changing zones", async () => {
      const spec1 = createTestMusicSpec();
      const spec2 = { ...createTestMusicSpec(), mood: "tense" };
      musicLookup.set("zone_0_0", spec1);
      musicLookup.set("zone_1_0", spec2);

      // Enter first zone (starts music, so isPlaying becomes true)
      eventBus.emit("zone:entered", { zoneId: "zone_0_0" });
      await new Promise((resolve) => setTimeout(resolve, 200));

      const stoppedEvents: Record<string, never>[] = [];
      eventBus.on("audio:music-stopped", (data) => stoppedEvents.push(data));

      // Enter second zone (stops old music first)
      eventBus.emit("zone:entered", { zoneId: "zone_1_0" });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(stoppedEvents.length).toBe(1);
    });

    it("emits audio:sfx-played for each SFX trigger", () => {
      const sfxEvents: { name: string }[] = [];
      eventBus.on("audio:sfx-played", (data) => sfxEvents.push(data));

      eventBus.emit("player:moved", { position: { x: 1, y: 1 }, zone: "z" });
      eventBus.emit("save:completed", {});

      expect(sfxEvents.length).toBe(2);
      expect(sfxEvents[0]!.name).toBe("footstep");
      expect(sfxEvents[1]!.name).toBe("save");
    });
  });

  // ── Music ducking / restore ────────────────────────────────

  describe("music ducking and restore", () => {
    it("dialogue:started ducks music volume", () => {
      eventBus.emit("dialogue:started", { characterId: "npc_guard" });

      expect(manager.isMusicDucked()).toBe(true);

      // Music player should have had setVolume called with ducked level
      const setVolumeCalls = musicPlayer.calls.filter((c) => c.method === "setVolume");
      expect(setVolumeCalls.length).toBe(1);
      // 0.6 (musicVolume) * 0.3 (duckingLevel) = 0.18
      const [duckedVolume] = setVolumeCalls[0]!.args as [number];
      expect(duckedVolume).toBeCloseTo(0.18, 2);
    });

    it("dialogue:ended restores music volume", () => {
      // Duck first
      eventBus.emit("dialogue:started", { characterId: "npc_guard" });
      expect(manager.isMusicDucked()).toBe(true);

      // Then restore
      eventBus.emit("dialogue:ended", {
        characterId: "npc_guard",
        conversation: {
          characterId: "npc_guard",
          turns: [],
          startedAt: Date.now(),
          mood: "neutral",
          topicsDiscussed: [],
          isActive: false,
        },
      });

      expect(manager.isMusicDucked()).toBe(false);

      // Music player should have volume restored to musicVolume
      const setVolumeCalls = musicPlayer.calls.filter((c) => c.method === "setVolume");
      // Two calls: duck (0.18), restore (0.6)
      expect(setVolumeCalls.length).toBe(2);
      const [restoredVolume] = setVolumeCalls[1]!.args as [number];
      expect(restoredVolume).toBeCloseTo(0.6, 2);
    });

    it("ducking is idempotent — multiple ducks don't compound", () => {
      eventBus.emit("dialogue:started", { characterId: "npc_a" });
      eventBus.emit("dialogue:started", { characterId: "npc_b" });

      // Only one setVolume call (second duck is skipped because already ducked)
      const setVolumeCalls = musicPlayer.calls.filter((c) => c.method === "setVolume");
      expect(setVolumeCalls.length).toBe(1);
    });

    it("restore is idempotent — restore without duck is no-op", () => {
      expect(manager.isMusicDucked()).toBe(false);

      eventBus.emit("dialogue:ended", {
        characterId: "npc_guard",
        conversation: {
          characterId: "npc_guard",
          turns: [],
          startedAt: Date.now(),
          mood: "neutral",
          topicsDiscussed: [],
          isActive: false,
        },
      });

      // No setVolume call because it wasn't ducked
      const setVolumeCalls = musicPlayer.calls.filter((c) => c.method === "setVolume");
      expect(setVolumeCalls.length).toBe(0);
    });

    it("zone:entered uses ducked volume when already in dialogue", async () => {
      const spec = createTestMusicSpec();
      musicLookup.set("zone_0_0", spec);

      // Start dialogue first (ducks music)
      eventBus.emit("dialogue:started", { characterId: "npc_guard" });

      // Then enter a zone (should play at ducked volume)
      eventBus.emit("zone:entered", { zoneId: "zone_0_0" });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // The play call should have ducked volume
      const playCalls = musicPlayer.calls.filter((c) => c.method === "play");
      expect(playCalls.length).toBe(1);
      const [, options] = playCalls[0]!.args as [string, PlayOptions];
      // ducked volume = 0.6 * 0.3 = 0.18
      expect(options?.volume).toBeCloseTo(0.18, 2);
    });
  });

  // ── Enable / disable controls ──────────────────────────────

  describe("enable/disable controls", () => {
    it("disabling audio prevents SFX playback", () => {
      manager.setEnabled(false);

      eventBus.emit("player:moved", { position: { x: 1, y: 1 }, zone: "z" });

      const playCalls = sfxPlayer.calls.filter((c) => c.method === "play");
      expect(playCalls.length).toBe(0);
    });

    it("disabling SFX prevents SFX but not music", async () => {
      const spec = createTestMusicSpec();
      musicLookup.set("zone_0_0", spec);

      manager.setSFXEnabled(false);

      eventBus.emit("player:moved", { position: { x: 1, y: 1 }, zone: "z" });

      const sfxPlayCalls = sfxPlayer.calls.filter((c) => c.method === "play");
      expect(sfxPlayCalls.length).toBe(0);

      eventBus.emit("zone:entered", { zoneId: "zone_0_0" });
      await new Promise((resolve) => setTimeout(resolve, 200));

      const musicPlayCalls = musicPlayer.calls.filter((c) => c.method === "play");
      expect(musicPlayCalls.length).toBe(1);
    });

    it("disabling music prevents music playback", async () => {
      const spec = createTestMusicSpec();
      musicLookup.set("zone_0_0", spec);

      manager.setMusicEnabled(false);

      eventBus.emit("zone:entered", { zoneId: "zone_0_0" });
      await new Promise((resolve) => setTimeout(resolve, 200));

      const musicPlayCalls = musicPlayer.calls.filter((c) => c.method === "play");
      expect(musicPlayCalls.length).toBe(0);
    });

    it("disabling music stops current playback", async () => {
      const spec = createTestMusicSpec();
      musicLookup.set("zone_0_0", spec);

      eventBus.emit("zone:entered", { zoneId: "zone_0_0" });
      await new Promise((resolve) => setTimeout(resolve, 200));

      manager.setMusicEnabled(false);

      const stopCalls = musicPlayer.calls.filter((c) => c.method === "stop");
      expect(stopCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Volume controls ────────────────────────────────────────

  describe("volume controls", () => {
    it("setMusicVolume updates player volume when not ducked", () => {
      manager.setMusicVolume(0.8);

      const setVolumeCalls = musicPlayer.calls.filter((c) => c.method === "setVolume");
      expect(setVolumeCalls.length).toBe(1);
      expect(setVolumeCalls[0]!.args[0]).toBeCloseTo(0.8, 2);
    });

    it("setMusicVolume updates ducked volume when ducked", () => {
      // Duck first
      eventBus.emit("dialogue:started", { characterId: "npc_guard" });

      musicPlayer.calls.length = 0; // clear previous calls

      // Change volume while ducked
      manager.setMusicVolume(1.0);

      const setVolumeCalls = musicPlayer.calls.filter((c) => c.method === "setVolume");
      expect(setVolumeCalls.length).toBe(1);
      // 1.0 * 0.3 = 0.3
      expect(setVolumeCalls[0]!.args[0]).toBeCloseTo(0.3, 2);
    });

    it("setMusicVolume clamps to 0-1 range", () => {
      manager.setMusicVolume(2.0);
      const calls1 = musicPlayer.calls.filter((c) => c.method === "setVolume");
      expect(calls1[calls1.length - 1]!.args[0]).toBeCloseTo(1.0, 2);

      manager.setMusicVolume(-0.5);
      const calls2 = musicPlayer.calls.filter((c) => c.method === "setVolume");
      expect(calls2[calls2.length - 1]!.args[0]).toBeCloseTo(0.0, 2);
    });
  });

  // ── Destroy and cleanup ────────────────────────────────────

  describe("destroy", () => {
    it("stops music player on destroy", async () => {
      await manager.destroy();

      const stopCalls = musicPlayer.calls.filter((c) => c.method === "stop");
      expect(stopCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("unsubscribes from EventBus on destroy", async () => {
      await manager.destroy();

      // Clear call logs
      sfxPlayer.calls.length = 0;
      musicPlayer.calls.length = 0;

      // These events should no longer trigger audio
      eventBus.emit("player:moved", { position: { x: 1, y: 1 }, zone: "z" });
      eventBus.emit("dialogue:started", { characterId: "npc_guard" });
      eventBus.emit("save:completed", {});

      expect(sfxPlayer.calls.filter((c) => c.method === "play").length).toBe(0);
      expect(musicPlayer.calls.filter((c) => c.method === "setVolume").length).toBe(0);
    });

    it("cleans up temp music files on destroy", async () => {
      const spec = createTestMusicSpec();
      musicLookup.set("zone_0_0", spec);

      eventBus.emit("zone:entered", { zoneId: "zone_0_0" });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Temp file was written
      expect(mockWrite.written.length).toBe(1);

      // Destroy should attempt cleanup (unlink will fail on non-existent files but that's OK)
      await manager.destroy();

      // Verify manager state is cleaned up
      expect(manager.getCurrentZoneId()).toBeNull();
      expect(manager.isMusicDucked()).toBe(false);
    });

    it("resets state on destroy", async () => {
      const spec = createTestMusicSpec();
      musicLookup.set("zone_0_0", spec);

      eventBus.emit("zone:entered", { zoneId: "zone_0_0" });
      await new Promise((resolve) => setTimeout(resolve, 200));
      eventBus.emit("dialogue:started", { characterId: "npc_guard" });

      expect(manager.getCurrentZoneId()).toBe("zone_0_0");
      expect(manager.isMusicDucked()).toBe(true);

      await manager.destroy();

      expect(manager.getCurrentZoneId()).toBeNull();
      expect(manager.isMusicDucked()).toBe(false);
    });
  });

  // ── State accessors ────────────────────────────────────────

  describe("state accessors", () => {
    it("tracks current zone ID", async () => {
      expect(manager.getCurrentZoneId()).toBeNull();

      const spec = createTestMusicSpec();
      musicLookup.set("zone_0_0", spec);

      eventBus.emit("zone:entered", { zoneId: "zone_0_0" });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(manager.getCurrentZoneId()).toBe("zone_0_0");
    });

    it("reports enabled state correctly", () => {
      expect(manager.isEnabled()).toBe(true);
      expect(manager.isMusicEnabled()).toBe(true);
      expect(manager.isSFXEnabled()).toBe(true);

      manager.setEnabled(false);
      expect(manager.isEnabled()).toBe(false);

      manager.setMusicEnabled(false);
      expect(manager.isMusicEnabled()).toBe(false);

      manager.setSFXEnabled(false);
      expect(manager.isSFXEnabled()).toBe(false);
    });
  });
});
