import type { Tool, ToolUseBlock } from "../types.ts";

export const worldTickTool: Tool = {
  name: "world_tick",
  description:
    "Generate events that occur during a world tick (periodic world update)",
  input_schema: {
    type: "object" as const,
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["ambient", "minor", "moderate", "major", "dramatic"],
              description: "The significance level of this event",
            },
            description: {
              type: "string",
              description: "What happens",
            },
            effects: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "character_move",
                      "character_state",
                      "weather_change",
                      "lighting_change",
                      "narration",
                      "object_spawn",
                      "object_remove",
                    ],
                  },
                  target: {
                    type: "string",
                    description:
                      "The target of the effect (character ID, zone ID, etc.)",
                  },
                  details: {
                    type: "string",
                    description:
                      'Specifics of the effect (e.g., "moves to the tavern", "mood becomes melancholy")',
                  },
                },
                required: ["type", "details"],
              },
              description: "Concrete effects this event has on the world",
            },
            chronicle_entry: {
              type: "string",
              description: "Brief narrative entry for the chronicle",
            },
          },
          required: ["type", "description", "effects", "chronicle_entry"],
        },
        description:
          "Events occurring this tick. Usually 0-2 events. Most ticks are quiet.",
      },
      narration: {
        type: "string",
        description:
          "Optional ambient narration shown to the player (e.g., 'The wind picks up, carrying the scent of rain.')",
      },
    },
    required: ["events"],
  },
};

export interface WorldTickEvent {
  type: "ambient" | "minor" | "moderate" | "major" | "dramatic";
  description: string;
  effects: Array<{
    type: string;
    target?: string;
    details: string;
  }>;
  chronicleEntry: string;
}

export interface WorldTickResult {
  events: WorldTickEvent[];
  narration?: string;
}

export function parseWorldTickResponse(
  toolUse: ToolUseBlock,
): WorldTickResult {
  if (toolUse.name !== "world_tick") {
    throw new Error(`Expected world_tick tool, got ${toolUse.name}`);
  }
  const input = toolUse.input as Record<string, unknown>;
  const events = input.events as Array<Record<string, unknown>>;

  return {
    events: events.map((e) => ({
      type: e.type as WorldTickEvent["type"],
      description: e.description as string,
      effects: (e.effects as Array<Record<string, unknown>>).map((eff) => ({
        type: eff.type as string,
        target: eff.target as string | undefined,
        details: eff.details as string,
      })),
      chronicleEntry: e.chronicle_entry as string,
    })),
    narration: input.narration as string | undefined,
  };
}

export const createWorldTool: Tool = {
  name: "create_world",
  description: "Generate a complete world seed from a player's prompt",
  input_schema: {
    type: "object" as const,
    properties: {
      setting: {
        type: "object",
        properties: {
          name: { type: "string", description: "World name" },
          type: {
            type: "string",
            description:
              'Setting type (e.g., "medieval fantasy", "cyberpunk", "post-apocalyptic")',
          },
          era: { type: "string", description: "Time period or era" },
          tone: {
            type: "string",
            description:
              'Overall tone (e.g., "whimsical", "dark", "mysterious")',
          },
          description: {
            type: "string",
            description: "Rich description of the world (2-3 paragraphs)",
          },
        },
        required: ["name", "type", "era", "tone", "description"],
      },
      biome_map: {
        type: "object",
        properties: {
          center_biome: {
            type: "string",
            description:
              "The biome at the starting zone (e.g., 'village', 'forest_clearing')",
          },
          distribution: {
            type: "array",
            items: {
              type: "object",
              properties: {
                biome: { type: "string" },
                direction: {
                  type: "string",
                  description:
                    "General direction from center (e.g., 'north', 'southeast')",
                },
                distance: {
                  type: "string",
                  enum: ["near", "medium", "far"],
                },
              },
              required: ["biome", "direction", "distance"],
            },
            description: "How biomes are distributed around the center",
          },
        },
        required: ["center_biome", "distribution"],
      },
      initial_narrative: {
        type: "object",
        properties: {
          hooks: {
            type: "array",
            items: { type: "string" },
            description: "3-5 narrative hooks to develop over time",
          },
          main_tension: {
            type: "string",
            description: "The central tension or conflict of the world",
          },
          atmosphere: {
            type: "string",
            description: "The overall atmosphere and mood",
          },
        },
        required: ["hooks", "main_tension", "atmosphere"],
      },
      world_rules: {
        type: "object",
        properties: {
          has_magic: { type: "boolean" },
          tech_level: { type: "string" },
          economy: {
            type: "string",
            description: "How the economy works",
          },
          dangers: {
            type: "array",
            items: { type: "string" },
            description: "Types of dangers in this world",
          },
          customs: {
            type: "array",
            items: { type: "string" },
            description: "Cultural customs and norms",
          },
        },
        required: [
          "has_magic",
          "tech_level",
          "economy",
          "dangers",
          "customs",
        ],
      },
    },
    required: [
      "setting",
      "biome_map",
      "initial_narrative",
      "world_rules",
    ],
  },
};

export interface WorldSeedSpec {
  setting: {
    name: string;
    type: string;
    era: string;
    tone: string;
    description: string;
  };
  biomeMap: {
    centerBiome: string;
    distribution: Array<{
      biome: string;
      direction: string;
      distance: "near" | "medium" | "far";
    }>;
  };
  initialNarrative: {
    hooks: string[];
    mainTension: string;
    atmosphere: string;
  };
  worldRules: {
    hasMagic: boolean;
    techLevel: string;
    economy: string;
    dangers: string[];
    customs: string[];
  };
}

export function parseWorldSeedResponse(
  toolUse: ToolUseBlock,
): WorldSeedSpec {
  if (toolUse.name !== "create_world") {
    throw new Error(`Expected create_world tool, got ${toolUse.name}`);
  }
  const input = toolUse.input as Record<string, unknown>;
  const setting = input.setting as Record<string, unknown>;
  const biomeMap = input.biome_map as Record<string, unknown>;
  const narrative = input.initial_narrative as Record<string, unknown>;
  const rules = input.world_rules as Record<string, unknown>;

  return {
    setting: {
      name: setting.name as string,
      type: setting.type as string,
      era: setting.era as string,
      tone: setting.tone as string,
      description: setting.description as string,
    },
    biomeMap: {
      centerBiome: biomeMap.center_biome as string,
      distribution: biomeMap.distribution as WorldSeedSpec["biomeMap"]["distribution"],
    },
    initialNarrative: {
      hooks: narrative.hooks as string[],
      mainTension: narrative.main_tension as string,
      atmosphere: narrative.atmosphere as string,
    },
    worldRules: {
      hasMagic: rules.has_magic as boolean,
      techLevel: rules.tech_level as string,
      economy: rules.economy as string,
      dangers: rules.dangers as string[],
      customs: rules.customs as string[],
    },
  };
}
