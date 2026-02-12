import { describe, test, expect, mock } from "bun:test";
import { WorldGenerator, type ZoneCharacter } from "../WorldGenerator.ts";
import type { BuildingVisual, ObjectVisual } from "@daydream/engine";
import { WorldSeedSpecSchema } from "@daydream/ai";
import { ZoneSpecSchema } from "@daydream/ai";

// ── Fixtures ─────────────────────────────────────────────────

const mockWorldSeedInput = {
  setting: {
    name: "Thornwood",
    type: "dark fantasy",
    era: "medieval",
    tone: "mysterious",
    description: "A fog-shrouded forest where ancient things stir.",
  },
  biome_map: {
    center_biome: "forest",
    distribution: [
      { biome: "dark_forest", direction: "north", distance: "near" },
      { biome: "swamp", direction: "east", distance: "medium" },
    ],
  },
  initial_narrative: {
    hooks: ["The old watchtower", "Missing travelers"],
    main_tension: "Something lurks in the deep woods.",
    atmosphere: "Eerie and foreboding",
  },
  world_rules: {
    has_magic: true,
    tech_level: "medieval",
    economy: "barter",
    dangers: ["wolves", "bandits"],
    customs: ["leave offerings at crossroads"],
  },
};

const mockZoneSpecInput = {
  name: "Forest Clearing",
  description: "A small clearing in the woods.",
  terrain: {
    primary_ground: "grass",
    features: [
      { type: "path", description: "A dirt trail runs east-west" },
    ],
  },
  buildings: [
    { name: "Woodcutter's Cabin", type: "house", width: 6, height: 4, position: { x: 30, y: 15 } },
  ],
  objects: [
    { type: "tree", position: { x: 5, y: 5 } },
    { type: "rock", position: { x: 50, y: 25 } },
  ],
  characters: [
    {
      name: "Elara",
      role: "herbalist",
      personality: ["kind", "curious", "cautious"],
      backstory: "A healer who lives at the forest edge.",
      speech_pattern: "soft and measured",
      visual: { char: "E", fg: "#deb887" },
      position: { x: 25, y: 18 },
      secrets: ["Knows about the missing travelers"],
    },
  ],
  narrative_hooks: ["Strange lights in the distance"],
  exits: {
    north: "Deeper forest",
    south: "Village road",
  },
};

const testBuildingVisuals: Record<string, BuildingVisual> = {
  house: {
    border: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
    door: "╤",
    fill: " ",
    defaultFg: "#c4a882",
    doorFg: "#3d2b1f",
  },
};

const testObjectVisuals: Record<string, ObjectVisual> = {
  tree_oak: { char: "♣", fg: "#228b22", bold: true, collision: true },
  rock_large: { char: "●", fg: "#6a6a6a", bold: true, collision: true },
};

// ── Tests ────────────────────────────────────────────────────

describe("WorldSeedSpec parsing", () => {
  test("validates and transforms a valid world seed input", () => {
    const result = WorldSeedSpecSchema.safeParse(mockWorldSeedInput);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Verify snake_case → camelCase transform
    expect(result.data.biomeMap.centerBiome).toBe("forest");
    expect(result.data.initialNarrative.mainTension).toBe("Something lurks in the deep woods.");
    expect(result.data.worldRules.hasMagic).toBe(true);
    expect(result.data.worldRules.techLevel).toBe("medieval");
  });

  test("rejects invalid world seed input", () => {
    const result = WorldSeedSpecSchema.safeParse({ setting: {} });
    expect(result.success).toBe(false);
  });
});

describe("ZoneSpec parsing", () => {
  test("validates a valid zone spec input", () => {
    const result = ZoneSpecSchema.safeParse(mockZoneSpecInput);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.name).toBe("Forest Clearing");
    expect(result.data.terrain.primary_ground).toBe("grass");
    expect(result.data.buildings).toHaveLength(1);
    expect(result.data.characters).toHaveLength(1);
    expect(result.data.characters[0]!.name).toBe("Elara");
  });

  test("rejects zone spec with missing required fields", () => {
    const result = ZoneSpecSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(false);
  });
});

describe("WorldGenerator integration", () => {
  test("generates a world from mocked AI responses", async () => {
    // Create a mock AIClient that returns our fixtures
    const mockAIClient = {
      generate: mock(async (params: any) => {
        // Detect which tool was requested
        const toolName = params.tools?.[0]?.name;

        if (toolName === "create_world") {
          return {
            text: "",
            toolUse: [
              { type: "tool_use", id: "t1", name: "create_world", input: mockWorldSeedInput },
            ],
            stopReason: "tool_use",
            usage: { inputTokens: 100, outputTokens: 200 },
          };
        }

        if (toolName === "create_zone") {
          return {
            text: "",
            toolUse: [
              { type: "tool_use", id: "t2", name: "create_zone", input: mockZoneSpecInput },
            ],
            stopReason: "tool_use",
            usage: { inputTokens: 100, outputTokens: 200 },
          };
        }

        throw new Error(`Unexpected tool: ${toolName}`);
      }),
    };

    const generator = new WorldGenerator(
      mockAIClient as any,
      testBuildingVisuals,
      testObjectVisuals,
    );

    const progressMessages: string[] = [];
    const world = await generator.generate("a dark forest", (status) => {
      progressMessages.push(status);
    });

    // Verify AI was called twice (seed + zone)
    expect(mockAIClient.generate).toHaveBeenCalledTimes(2);

    // Verify world seed
    expect(world.seed.originalPrompt).toBe("a dark forest");
    expect(world.seed.setting.name).toBe("Thornwood");
    expect(world.seed.initialNarrative.hooks).toHaveLength(2);

    // Verify zone
    expect(world.zone.id).toBe("zone_0_0");
    expect(world.zone.width).toBe(80);
    expect(world.zone.height).toBe(40);
    expect(world.zone.layers).toHaveLength(3);

    // Verify characters
    expect(world.characters).toHaveLength(1);
    expect(world.characters[0]!.name).toBe("Elara");
    expect(world.characters[0]!.role).toBe("herbalist");
    expect(world.characters[0]!.speechPattern).toBe("soft and measured");

    // Verify palette was selected (forest keyword → forest palette)
    expect(world.palette).toBeDefined();

    // Verify progress callbacks fired
    expect(progressMessages.length).toBeGreaterThan(0);
    expect(progressMessages[0]).toContain("Dreaming");
  });

  test("throws when AI returns no tool use for world seed", async () => {
    const mockAIClient = {
      generate: mock(async () => ({
        text: "No tool use",
        toolUse: [],
        stopReason: "end_turn",
        usage: { inputTokens: 10, outputTokens: 10 },
      })),
    };

    const generator = new WorldGenerator(
      mockAIClient as any,
      testBuildingVisuals,
      testObjectVisuals,
    );

    await expect(generator.generate("test")).rejects.toThrow(
      "AI did not return a world seed tool response",
    );
  });
});
