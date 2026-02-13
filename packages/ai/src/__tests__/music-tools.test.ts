import { describe, expect, it } from "bun:test";
import type { ToolUseBlock } from "../types.ts";
import { parseMusicResponse, generateMusicTool } from "../tools/music-tools.ts";
import { MusicSpecSchema } from "@daydream/audio";

function makeToolUse(name: string, input: unknown): ToolUseBlock {
  return {
    type: "tool_use",
    id: "test_id",
    name,
    input,
  } as ToolUseBlock;
}

// ── Valid fixture ───────────────────────────────────────────

const validMusicSpec = {
  bpm: 120,
  key: "Am",
  timeSignature: 4,
  channels: [
    {
      waveform: "square",
      duty: "50",
      volume: 12,
      pattern: [
        { pitch: 69, duration: 4, velocity: 12 },
        { pitch: 72, duration: 4, velocity: 10 },
        { pitch: 76, duration: 4, velocity: 12 },
        { pitch: 72, duration: 4, velocity: 10 },
      ],
    },
    {
      waveform: "triangle",
      duty: "50",
      volume: 10,
      pattern: [
        { pitch: 45, duration: 8, velocity: 12 },
        { pitch: 48, duration: 8, velocity: 12 },
      ],
    },
  ],
  loopMeasures: 4,
  mood: "mysterious",
};

// ── Tool definition tests ──────────────────────────────────

describe("generateMusicTool", () => {
  it("has the correct tool name", () => {
    expect(generateMusicTool.name).toBe("generate_music");
  });

  it("has a description", () => {
    expect(generateMusicTool.description).toBeTruthy();
    expect(generateMusicTool.description).toContain("chiptune");
  });

  it("has an input_schema with required properties", () => {
    const schema = generateMusicTool.input_schema as Record<string, unknown>;
    expect(schema.type).toBe("object");
    const properties = schema.properties as Record<string, unknown>;
    expect(properties).toHaveProperty("bpm");
    expect(properties).toHaveProperty("key");
    expect(properties).toHaveProperty("channels");
    expect(properties).toHaveProperty("loopMeasures");
  });
});

// ── parseMusicResponse tests ───────────────────────────────

describe("parseMusicResponse", () => {
  it("parses a valid music spec", () => {
    const result = parseMusicResponse(makeToolUse("generate_music", validMusicSpec));
    expect(result.bpm).toBe(120);
    expect(result.key).toBe("Am");
    expect(result.timeSignature).toBe(4);
    expect(result.channels).toHaveLength(2);
    expect(result.channels[0]!.waveform).toBe("square");
    expect(result.channels[1]!.waveform).toBe("triangle");
    expect(result.loopMeasures).toBe(4);
    expect(result.mood).toBe("mysterious");
  });

  it("applies defaults for optional fields", () => {
    const minSpec = {
      bpm: 100,
      key: "C",
      channels: [
        {
          waveform: "square",
          pattern: [{ pitch: 60, duration: 4 }],
        },
        {
          waveform: "triangle",
          pattern: [{ pitch: 48, duration: 8 }],
        },
      ],
    };
    const result = parseMusicResponse(makeToolUse("generate_music", minSpec));
    expect(result.timeSignature).toBe(4); // default
    expect(result.loopMeasures).toBe(4); // default
    expect(result.channels[0]!.duty).toBe("50"); // default
    expect(result.channels[0]!.volume).toBe(12); // default
    expect(result.channels[0]!.pattern[0]!.velocity).toBe(12); // default
    expect(result.mood).toBeUndefined(); // optional
  });

  it("throws on wrong tool name", () => {
    expect(() =>
      parseMusicResponse(makeToolUse("wrong_tool", validMusicSpec)),
    ).toThrow("Expected generate_music tool");
  });

  it("rejects missing required fields", () => {
    expect(() =>
      parseMusicResponse(makeToolUse("generate_music", { bpm: 120 })),
    ).toThrow("Invalid generate_music response");
  });

  it("rejects bpm out of range (too low)", () => {
    const spec = { ...validMusicSpec, bpm: 30 };
    expect(() =>
      parseMusicResponse(makeToolUse("generate_music", spec)),
    ).toThrow("Invalid generate_music response");
  });

  it("rejects bpm out of range (too high)", () => {
    const spec = { ...validMusicSpec, bpm: 300 };
    expect(() =>
      parseMusicResponse(makeToolUse("generate_music", spec)),
    ).toThrow("Invalid generate_music response");
  });

  it("rejects invalid waveform type", () => {
    const spec = {
      ...validMusicSpec,
      channels: [
        {
          waveform: "sine",
          pattern: [{ pitch: 60, duration: 4 }],
        },
        {
          waveform: "triangle",
          pattern: [{ pitch: 48, duration: 8 }],
        },
      ],
    };
    expect(() =>
      parseMusicResponse(makeToolUse("generate_music", spec)),
    ).toThrow("Invalid generate_music response");
  });

  it("rejects too few channels (less than 2)", () => {
    const spec = {
      ...validMusicSpec,
      channels: [
        {
          waveform: "square",
          pattern: [{ pitch: 60, duration: 4 }],
        },
      ],
    };
    expect(() =>
      parseMusicResponse(makeToolUse("generate_music", spec)),
    ).toThrow("Invalid generate_music response");
  });

  it("rejects too many channels (more than 4)", () => {
    const makeChannel = (waveform: string) => ({
      waveform,
      pattern: [{ pitch: 60, duration: 4 }],
    });
    const spec = {
      ...validMusicSpec,
      channels: [
        makeChannel("square"),
        makeChannel("triangle"),
        makeChannel("sawtooth"),
        makeChannel("noise"),
        makeChannel("square"),
      ],
    };
    expect(() =>
      parseMusicResponse(makeToolUse("generate_music", spec)),
    ).toThrow("Invalid generate_music response");
  });

  it("rejects note pitch out of range", () => {
    const spec = {
      ...validMusicSpec,
      channels: [
        {
          waveform: "square",
          pattern: [{ pitch: 200, duration: 4 }],
        },
        {
          waveform: "triangle",
          pattern: [{ pitch: 48, duration: 8 }],
        },
      ],
    };
    expect(() =>
      parseMusicResponse(makeToolUse("generate_music", spec)),
    ).toThrow("Invalid generate_music response");
  });

  it("rejects invalid duty cycle", () => {
    const spec = {
      ...validMusicSpec,
      channels: [
        {
          waveform: "square",
          duty: "33",
          pattern: [{ pitch: 60, duration: 4 }],
        },
        {
          waveform: "triangle",
          pattern: [{ pitch: 48, duration: 8 }],
        },
      ],
    };
    expect(() =>
      parseMusicResponse(makeToolUse("generate_music", spec)),
    ).toThrow("Invalid generate_music response");
  });

  it("handles extra fields gracefully", () => {
    const spec = {
      ...validMusicSpec,
      extra_field: "should be ignored",
    };
    const result = parseMusicResponse(makeToolUse("generate_music", spec));
    expect(result.bpm).toBe(120);
    expect((result as Record<string, unknown>).extra_field).toBeUndefined();
  });
});

// ── MusicSpecSchema safeParse tests ────────────────────────

describe("MusicSpecSchema.safeParse", () => {
  it("validates a valid music spec", () => {
    const result = MusicSpecSchema.safeParse(validMusicSpec);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.bpm).toBe(120);
    expect(result.data.key).toBe("Am");
  });

  it("rejects invalid input", () => {
    const result = MusicSpecSchema.safeParse({ bpm: "not a number" });
    expect(result.success).toBe(false);
  });

  it("returns detailed error messages", () => {
    const result = MusicSpecSchema.safeParse({
      bpm: 120,
      key: "Am",
      channels: [], // too few channels
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const channelError = result.error.issues.find(
      (i) => i.path.includes("channels"),
    );
    expect(channelError).toBeDefined();
  });
});
