import { describe, expect, it, mock, beforeEach } from "bun:test";
import { AIClient } from "../client.ts";

// Mock the Anthropic SDK
const mockCreate = mock(() =>
  Promise.resolve({
    content: [
      { type: "text", text: "Hello from Claude" },
    ],
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 50 },
  }),
);

const mockToolCreate = mock(() =>
  Promise.resolve({
    content: [
      {
        type: "tool_use",
        id: "tool_1",
        name: "create_zone",
        input: {
          name: "Test Zone",
          description: "A test",
          terrain: { primary_ground: "grass", features: [] },
          buildings: [],
          objects: [],
          characters: [],
          narrative_hooks: [],
        },
      },
    ],
    stop_reason: "tool_use",
    usage: { input_tokens: 200, output_tokens: 300 },
  }),
);

const mockStreamEvent = (text: string) => ({
  type: "content_block_delta" as const,
  delta: { type: "text_delta" as const, text },
});

mock.module("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: mockCreate,
      stream: mock(function () {
        return (async function* () {
          yield mockStreamEvent("Hello ");
          yield mockStreamEvent("world");
        })();
      }),
    };
  },
}));

describe("AIClient", () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockToolCreate.mockClear();
  });

  it("throws when no API key is provided", () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(() => new AIClient()).toThrow("Missing API key");
    } finally {
      if (saved) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it("accepts an explicit API key", () => {
    const client = new AIClient({ apiKey: "test-key" });
    expect(client).toBeDefined();
  });

  it("generates a text response", async () => {
    const client = new AIClient({ apiKey: "test-key" });
    const response = await client.generate({
      system: "You are helpful",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(response.text).toBe("Hello from Claude");
    expect(response.toolUse).toHaveLength(0);
    expect(response.stopReason).toBe("end_turn");
    expect(response.usage.inputTokens).toBe(100);
    expect(response.usage.outputTokens).toBe(50);
  });

  it("generates a tool use response", async () => {
    mockCreate.mockImplementationOnce(
      () =>
        Promise.resolve({
          content: [
            {
              type: "text" as const,
              text: "",
            },
            {
              type: "tool_use" as const,
              id: "tool_1",
              name: "create_zone",
              input: { name: "Test Zone" },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 200, output_tokens: 300 },
        }) as never,
    );

    const client = new AIClient({ apiKey: "test-key" });
    const response = await client.generate({
      system: "Generate a zone",
      messages: [{ role: "user", content: "Create a forest zone" }],
      tools: [
        {
          name: "create_zone",
          description: "Create a zone",
          input_schema: { type: "object" as const, properties: {} },
        },
      ],
    });

    expect(response.text).toBe("");
    expect(response.toolUse).toHaveLength(1);
    expect(response.toolUse[0]!.name).toBe("create_zone");
    expect(response.stopReason).toBe("tool_use");
  });

  it("uses the correct model for tasks", () => {
    const client = new AIClient({ apiKey: "test-key" });
    expect(client.getModelForTask("world-creation")).toBe("claude-opus-4-6");
    expect(client.getModelForTask("dialogue")).toBe("claude-sonnet-4-5-20250929");
    expect(client.getModelForTask("chronicle-compression")).toBe("claude-haiku-4-5-20251001");
  });

  it("streams text responses", async () => {
    const client = new AIClient({ apiKey: "test-key" });
    const chunks: string[] = [];

    for await (const chunk of client.stream({
      system: "You are helpful",
      messages: [{ role: "user", content: "Hello" }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello ", "world"]);
  });
});
