import { z } from "zod";
import type { ToolUseBlock } from "../types.ts";
import { createToolDef, validateToolResponse } from "./schema-utils.ts";

// ── World Tick ──────────────────────────────────────────────

const WorldTickInputSchema = z.object({
  events: z
    .array(
      z.object({
        type: z
          .enum(["ambient", "minor", "moderate", "major", "dramatic"])
          .describe("The significance level of this event"),
        description: z.string().describe("What happens"),
        effects: z
          .array(
            z.object({
              type: z
                .enum([
                  "character_move",
                  "character_state",
                  "weather_change",
                  "lighting_change",
                  "narration",
                  "object_spawn",
                  "object_remove",
                ])
                .describe("Effect type"),
              target: z
                .string()
                .describe("The target of the effect (character ID, zone ID, etc.)")
                .optional(),
              details: z
                .string()
                .describe(
                  'Specifics of the effect (e.g., "moves to the tavern", "mood becomes melancholy")',
                ),
            }),
          )
          .describe("Concrete effects this event has on the world"),
        chronicle_entry: z
          .string()
          .describe("Brief narrative entry for the chronicle"),
      }),
    )
    .describe(
      "Events occurring this tick. Usually 0-2 events. Most ticks are quiet.",
    ),
  narration: z
    .string()
    .describe(
      "Optional ambient narration shown to the player (e.g., 'The wind picks up, carrying the scent of rain.')",
    )
    .optional(),
});

export const WorldTickResultSchema = WorldTickInputSchema.transform(
  (input) => ({
    events: input.events.map((e) => ({
      type: e.type,
      description: e.description,
      effects: e.effects,
      chronicleEntry: e.chronicle_entry,
    })),
    narration: input.narration,
  }),
);

export type WorldTickEvent = {
  type: "ambient" | "minor" | "moderate" | "major" | "dramatic";
  description: string;
  effects: Array<{
    type: string;
    target?: string;
    details: string;
  }>;
  chronicleEntry: string;
};

export type WorldTickResult = z.output<typeof WorldTickResultSchema>;

export const worldTickTool = createToolDef(
  "world_tick",
  "Generate events that occur during a world tick (periodic world update)",
  WorldTickInputSchema,
);

export function parseWorldTickResponse(
  toolUse: ToolUseBlock,
): WorldTickResult {
  return validateToolResponse(toolUse, "world_tick", WorldTickResultSchema);
}

// ── World Seed ──────────────────────────────────────────────

const WorldSeedInputSchema = z.object({
  setting: z.object({
    name: z.string().describe("World name"),
    type: z
      .string()
      .describe(
        'Setting type (e.g., "medieval fantasy", "cyberpunk", "post-apocalyptic")',
      ),
    era: z.string().describe("Time period or era"),
    tone: z
      .string()
      .describe('Overall tone (e.g., "whimsical", "dark", "mysterious")'),
    description: z
      .string()
      .describe("Rich description of the world (2-3 paragraphs)"),
  }),
  biome_map: z.object({
    center_biome: z
      .string()
      .describe(
        "The biome at the starting zone (e.g., 'village', 'forest_clearing')",
      ),
    distribution: z
      .array(
        z.object({
          biome: z.string(),
          direction: z
            .string()
            .describe(
              "General direction from center (e.g., 'north', 'southeast')",
            ),
          distance: z.enum(["near", "medium", "far"]),
        }),
      )
      .describe("How biomes are distributed around the center"),
  }),
  initial_narrative: z.object({
    hooks: z
      .array(z.string())
      .describe("3-5 narrative hooks to develop over time"),
    main_tension: z
      .string()
      .describe("The central tension or conflict of the world"),
    atmosphere: z.string().describe("The overall atmosphere and mood"),
  }),
  world_rules: z.object({
    has_magic: z.boolean(),
    tech_level: z.string(),
    economy: z.string().describe("How the economy works"),
    dangers: z
      .array(z.string())
      .describe("Types of dangers in this world"),
    customs: z
      .array(z.string())
      .describe("Cultural customs and norms"),
  }),
});

export const WorldSeedSpecSchema = WorldSeedInputSchema.transform(
  (input) => ({
    setting: input.setting,
    biomeMap: {
      centerBiome: input.biome_map.center_biome,
      distribution: input.biome_map.distribution,
    },
    initialNarrative: {
      hooks: input.initial_narrative.hooks,
      mainTension: input.initial_narrative.main_tension,
      atmosphere: input.initial_narrative.atmosphere,
    },
    worldRules: {
      hasMagic: input.world_rules.has_magic,
      techLevel: input.world_rules.tech_level,
      economy: input.world_rules.economy,
      dangers: input.world_rules.dangers,
      customs: input.world_rules.customs,
    },
  }),
);

export type WorldSeedSpec = z.output<typeof WorldSeedSpecSchema>;

export const createWorldTool = createToolDef(
  "create_world",
  "Generate a complete world seed from a player's prompt",
  WorldSeedInputSchema,
);

export function parseWorldSeedResponse(
  toolUse: ToolUseBlock,
): WorldSeedSpec {
  return validateToolResponse(toolUse, "create_world", WorldSeedSpecSchema);
}
