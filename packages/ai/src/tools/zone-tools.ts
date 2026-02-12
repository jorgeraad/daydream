import type { Tool, ToolUseBlock } from "../types.ts";

export const createZoneTool: Tool = {
  name: "create_zone",
  description: "Generate the layout and contents of a new zone",
  input_schema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description:
          'A short, evocative name for the zone (e.g., "The Market Square", "Dark Forest Path")',
      },
      description: {
        type: "string",
        description:
          "A paragraph describing the zone's appearance, atmosphere, and significance",
      },
      terrain: {
        type: "object",
        description: "Terrain layout description",
        properties: {
          primary_ground: {
            type: "string",
            description:
              'The main ground type (e.g., "grass", "stone", "sand", "dirt")',
          },
          features: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  description:
                    'Feature type (e.g., "path", "water", "clearing", "rocky_area")',
                },
                description: {
                  type: "string",
                  description: "Where and how this feature appears in the zone",
                },
              },
              required: ["type", "description"],
            },
            description: "Terrain features within the zone",
          },
        },
        required: ["primary_ground", "features"],
      },
      buildings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Building name" },
            type: {
              type: "string",
              description:
                'Building type (e.g., "house", "shop", "tavern", "shrine")',
            },
            width: {
              type: "number",
              description: "Width in cells (3-8)",
            },
            height: {
              type: "number",
              description: "Height in cells (2-5)",
            },
            position: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
              },
              required: ["x", "y"],
              description: "Top-left position in the zone",
            },
            features: {
              type: "array",
              items: { type: "string" },
              description:
                'Notable features (e.g., "door facing south", "window on east wall")',
            },
          },
          required: ["name", "type", "width", "height", "position"],
        },
        description: "Buildings in this zone (0-4)",
      },
      objects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description:
                'Object type (e.g., "tree", "rock", "sign", "well", "crate")',
            },
            position: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
              },
              required: ["x", "y"],
            },
            description: {
              type: "string",
              description: "Brief description if notable",
            },
          },
          required: ["type", "position"],
        },
        description: "Objects placed in the zone",
      },
      characters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: {
              type: "string",
              description:
                'Character role (e.g., "guard", "merchant", "villager", "elder")',
            },
            personality: {
              type: "array",
              items: { type: "string" },
              description: "3-5 personality traits",
            },
            backstory: {
              type: "string",
              description: "Brief backstory (1-2 sentences)",
            },
            speech_pattern: {
              type: "string",
              description:
                'How they speak (e.g., "formal and measured", "gruff and terse")',
            },
            visual: {
              type: "object",
              properties: {
                char: {
                  type: "string",
                  description: "Single Unicode character to display",
                },
                fg: {
                  type: "string",
                  description: "Foreground color as hex (e.g., #deb887)",
                },
                bold: { type: "boolean" },
              },
              required: ["char", "fg"],
            },
            position: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
              },
              required: ["x", "y"],
            },
            secrets: {
              type: "array",
              items: { type: "string" },
              description: "Things this character knows but won't easily share",
            },
          },
          required: [
            "name",
            "role",
            "personality",
            "backstory",
            "speech_pattern",
            "visual",
            "position",
          ],
        },
        description: "Characters in this zone (0-3)",
      },
      narrative_hooks: {
        type: "array",
        items: { type: "string" },
        description:
          "Story hooks, mysteries, or interesting details in this zone",
      },
      exits: {
        type: "object",
        properties: {
          north: { type: "string", description: "What lies to the north" },
          south: { type: "string", description: "What lies to the south" },
          east: { type: "string", description: "What lies to the east" },
          west: { type: "string", description: "What lies to the west" },
        },
        description:
          "Brief hints about what's in each direction (for adjacent zone generation)",
      },
    },
    required: [
      "name",
      "description",
      "terrain",
      "buildings",
      "objects",
      "characters",
      "narrative_hooks",
    ],
  },
};

export interface ZoneSpec {
  name: string;
  description: string;
  terrain: {
    primary_ground: string;
    features: Array<{ type: string; description: string }>;
  };
  buildings: Array<{
    name: string;
    type: string;
    width: number;
    height: number;
    position: { x: number; y: number };
    features?: string[];
  }>;
  objects: Array<{
    type: string;
    position: { x: number; y: number };
    description?: string;
  }>;
  characters: Array<{
    name: string;
    role: string;
    personality: string[];
    backstory: string;
    speech_pattern: string;
    visual: { char: string; fg: string; bold?: boolean };
    position: { x: number; y: number };
    secrets?: string[];
  }>;
  narrative_hooks: string[];
  exits?: {
    north?: string;
    south?: string;
    east?: string;
    west?: string;
  };
}

export function parseZoneResponse(toolUse: ToolUseBlock): ZoneSpec {
  if (toolUse.name !== "create_zone") {
    throw new Error(`Expected create_zone tool, got ${toolUse.name}`);
  }
  return toolUse.input as ZoneSpec;
}
