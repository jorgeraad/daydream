import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AudioSettingsSchema, DEFAULT_AUDIO_SETTINGS } from "../settings/AudioSettings.ts";
import { SettingsManager } from "../settings/SettingsManager.ts";

function makeTempDir(): string {
  const dir = join(tmpdir(), `daydream-audio-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("AudioSettingsSchema", () => {
  it("provides sensible defaults when parsed from empty object", () => {
    const result = AudioSettingsSchema.parse({});
    expect(result.enabled).toBe(true);
    expect(result.musicEnabled).toBe(true);
    expect(result.sfxEnabled).toBe(true);
    expect(result.masterVolume).toBe(0.7);
    expect(result.musicVolume).toBe(0.6);
    expect(result.sfxVolume).toBe(0.8);
  });

  it("DEFAULT_AUDIO_SETTINGS matches schema defaults", () => {
    expect(DEFAULT_AUDIO_SETTINGS).toEqual({
      enabled: true,
      musicEnabled: true,
      sfxEnabled: true,
      masterVolume: 0.7,
      musicVolume: 0.6,
      sfxVolume: 0.8,
    });
  });

  it("accepts valid settings", () => {
    const settings = {
      enabled: false,
      musicEnabled: false,
      sfxEnabled: true,
      masterVolume: 0.5,
      musicVolume: 0.3,
      sfxVolume: 1.0,
    };
    const result = AudioSettingsSchema.parse(settings);
    expect(result).toEqual(settings);
  });

  it("rejects volume below 0", () => {
    expect(() =>
      AudioSettingsSchema.parse({ masterVolume: -0.1 })
    ).toThrow();
  });

  it("rejects volume above 1", () => {
    expect(() =>
      AudioSettingsSchema.parse({ masterVolume: 1.5 })
    ).toThrow();
  });

  it("accepts boundary values 0 and 1", () => {
    const result = AudioSettingsSchema.parse({
      masterVolume: 0,
      musicVolume: 1,
      sfxVolume: 0,
    });
    expect(result.masterVolume).toBe(0);
    expect(result.musicVolume).toBe(1);
    expect(result.sfxVolume).toBe(0);
  });

  it("rejects non-boolean for enabled fields", () => {
    expect(() =>
      AudioSettingsSchema.parse({ enabled: "yes" })
    ).toThrow();
  });

  it("rejects non-number for volume fields", () => {
    expect(() =>
      AudioSettingsSchema.parse({ masterVolume: "loud" })
    ).toThrow();
  });

  it("allows partial overrides with defaults for the rest", () => {
    const result = AudioSettingsSchema.parse({ musicEnabled: false });
    expect(result.musicEnabled).toBe(false);
    // Rest should use defaults
    expect(result.enabled).toBe(true);
    expect(result.sfxEnabled).toBe(true);
    expect(result.masterVolume).toBe(0.7);
    expect(result.musicVolume).toBe(0.6);
    expect(result.sfxVolume).toBe(0.8);
  });
});

describe("SettingsManager audio persistence", () => {
  let tempDir: string;
  let manager: SettingsManager;

  beforeEach(() => {
    tempDir = makeTempDir();
    manager = new SettingsManager({ basePath: tempDir });
    manager.load();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns default audio settings when none are saved", () => {
    const audio = manager.getAudioSettings();
    expect(audio).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("saves and loads audio settings", () => {
    manager.setAudioSettings({ musicEnabled: false, masterVolume: 0.5 });
    const audio = manager.getAudioSettings();
    expect(audio.musicEnabled).toBe(false);
    expect(audio.masterVolume).toBe(0.5);
    // Other fields retain defaults
    expect(audio.sfxEnabled).toBe(true);
    expect(audio.sfxVolume).toBe(0.8);
  });

  it("persists audio settings across instances (round-trip)", () => {
    manager.setAudioSettings({
      enabled: false,
      musicEnabled: false,
      sfxEnabled: false,
      masterVolume: 0.3,
      musicVolume: 0.2,
      sfxVolume: 0.1,
    });

    // Create a new manager from the same basePath
    const manager2 = new SettingsManager({ basePath: tempDir });
    manager2.load();
    const audio = manager2.getAudioSettings();

    expect(audio.enabled).toBe(false);
    expect(audio.musicEnabled).toBe(false);
    expect(audio.sfxEnabled).toBe(false);
    expect(audio.masterVolume).toBe(0.3);
    expect(audio.musicVolume).toBe(0.2);
    expect(audio.sfxVolume).toBe(0.1);
  });

  it("audio settings are stored under 'audio' key in settings.json", () => {
    manager.setAudioSettings({ musicEnabled: false });
    const settingsPath = join(tempDir, "settings.json");
    const raw = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(raw.audio).toBeDefined();
    expect(raw.audio.musicEnabled).toBe(false);
  });

  it("handles corrupt audio section gracefully", () => {
    // Write a corrupt audio section
    manager.set("audio", "not an object");
    const audio = manager.getAudioSettings();
    // Should fall back to defaults
    expect(audio).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("preserves other settings when saving audio", () => {
    manager.set("logging.level", "debug");
    manager.setAudioSettings({ musicEnabled: false });

    const logLevel = manager.get<string>("logging.level");
    expect(logLevel).toBe("debug");

    const audio = manager.getAudioSettings();
    expect(audio.musicEnabled).toBe(false);
  });

  it("setAudioSettings merges partial updates correctly", () => {
    manager.setAudioSettings({ masterVolume: 0.9, musicVolume: 0.4 });
    manager.setAudioSettings({ sfxVolume: 0.3 });

    const audio = manager.getAudioSettings();
    expect(audio.masterVolume).toBe(0.9);
    expect(audio.musicVolume).toBe(0.4);
    expect(audio.sfxVolume).toBe(0.3);
  });
});
