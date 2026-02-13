import { describe, expect, it } from "bun:test";
import {
  MUSIC_GENERATION_SYSTEM_PROMPT,
  buildMusicGenerationPrompt,
  type MusicGenerationContext,
} from "../prompts/music-generation.ts";

describe("MUSIC_GENERATION_SYSTEM_PROMPT", () => {
  it("includes key instructions", () => {
    expect(MUSIC_GENERATION_SYSTEM_PROMPT).toContain("chiptune");
    expect(MUSIC_GENERATION_SYSTEM_PROMPT).toContain("2-4 channels");
    expect(MUSIC_GENERATION_SYSTEM_PROMPT).toContain("generate_music");
  });

  it("mentions all waveform types", () => {
    expect(MUSIC_GENERATION_SYSTEM_PROMPT).toContain("Square wave");
    expect(MUSIC_GENERATION_SYSTEM_PROMPT).toContain("Triangle wave");
    expect(MUSIC_GENERATION_SYSTEM_PROMPT).toContain("Sawtooth");
    expect(MUSIC_GENERATION_SYSTEM_PROMPT).toContain("Noise");
  });

  it("includes guidance on mood matching", () => {
    expect(MUSIC_GENERATION_SYSTEM_PROMPT).toContain("minor keys");
    expect(MUSIC_GENERATION_SYSTEM_PROMPT).toContain("major");
    expect(MUSIC_GENERATION_SYSTEM_PROMPT).toContain("tempo");
  });
});

describe("buildMusicGenerationPrompt", () => {
  it("includes all required context fields", () => {
    const context: MusicGenerationContext = {
      zoneName: "The Dark Forest",
      biomeType: "forest",
      mood: "mysterious and foreboding",
    };

    const prompt = buildMusicGenerationPrompt(context);
    expect(prompt).toContain("The Dark Forest");
    expect(prompt).toContain("forest");
    expect(prompt).toContain("mysterious and foreboding");
    expect(prompt).toContain("Compose background music");
  });

  it("includes optional timeOfDay when provided", () => {
    const context: MusicGenerationContext = {
      zoneName: "Market Square",
      biomeType: "town",
      mood: "lively",
      timeOfDay: "afternoon",
    };

    const prompt = buildMusicGenerationPrompt(context);
    expect(prompt).toContain("Time of Day: afternoon");
  });

  it("includes optional weather when provided", () => {
    const context: MusicGenerationContext = {
      zoneName: "Storm Coast",
      biomeType: "coastal",
      mood: "turbulent",
      weather: "heavy rain",
    };

    const prompt = buildMusicGenerationPrompt(context);
    expect(prompt).toContain("Weather: heavy rain");
  });

  it("omits timeOfDay when not provided", () => {
    const context: MusicGenerationContext = {
      zoneName: "Test Zone",
      biomeType: "plains",
      mood: "calm",
    };

    const prompt = buildMusicGenerationPrompt(context);
    expect(prompt).not.toContain("Time of Day");
  });

  it("omits weather when not provided", () => {
    const context: MusicGenerationContext = {
      zoneName: "Test Zone",
      biomeType: "plains",
      mood: "calm",
    };

    const prompt = buildMusicGenerationPrompt(context);
    expect(prompt).not.toContain("Weather");
  });

  it("includes all context when all fields are provided", () => {
    const context: MusicGenerationContext = {
      zoneName: "Ancient Ruins",
      biomeType: "desert",
      mood: "ominous",
      timeOfDay: "dusk",
      weather: "sandstorm",
    };

    const prompt = buildMusicGenerationPrompt(context);
    expect(prompt).toContain("Ancient Ruins");
    expect(prompt).toContain("desert");
    expect(prompt).toContain("ominous");
    expect(prompt).toContain("dusk");
    expect(prompt).toContain("sandstorm");
    expect(prompt).toContain("looping chiptune");
  });

  it("includes zone label and biome label", () => {
    const prompt = buildMusicGenerationPrompt({
      zoneName: "X",
      biomeType: "Y",
      mood: "Z",
    });
    expect(prompt).toContain("Zone: X");
    expect(prompt).toContain("Biome: Y");
    expect(prompt).toContain("Mood: Z");
  });
});
