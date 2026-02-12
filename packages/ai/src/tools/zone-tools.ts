import { z } from "zod";
import type { ToolUseBlock } from "../types.ts";
import { createToolDef, validateToolResponse } from "./schema-utils.ts";

// ── Zod Schema ──────────────────────────────────────────────

export const ZoneSpecSchema = z.object({
  name: z
    .string()
    .describe(
      'A short, evocative name for the zone (e.g., "The Market Square", "Dark Forest Path")',
    ),
  description: z
    .string()
    .describe(
      "A paragraph describing the zone's appearance, atmosphere, and significance",
    ),
  terrain: z
    .object({
      primary_ground: z
        .string()
        .describe('The main ground type (e.g., "grass", "stone", "sand", "dirt")'),
      features: z
        .array(
          z.object({
            type: z
              .string()
              .describe('Feature type (e.g., "path", "water", "clearing", "rocky_area")'),
            description: z
              .string()
              .describe("Where and how this feature appears in the zone"),
          }),
        )
        .describe("Terrain features within the zone"),
    })
    .describe("Terrain layout description"),
  buildings: z
    .array(
      z.object({
        name: z.string().describe("Building name"),
        type: z
          .string()
          .describe('Building type (e.g., "house", "shop", "tavern", "shrine")'),
        width: z.number().describe("Width in cells (3-8)"),
        height: z.number().describe("Height in cells (2-5)"),
        position: z
          .object({ x: z.number(), y: z.number() })
          .describe("Top-left position in the zone"),
        features: z
          .array(z.string())
          .describe('Notable features (e.g., "door facing south", "window on east wall")')
          .optional(),
      }),
    )
    .describe("Buildings in this zone (0-4)"),
  objects: z
    .array(
      z.object({
        type: z
          .string()
          .describe('Object type (e.g., "tree", "rock", "sign", "well", "crate")'),
        position: z.object({ x: z.number(), y: z.number() }),
        description: z.string().describe("Brief description if notable").optional(),
      }),
    )
    .describe("Objects placed in the zone"),
  characters: z
    .array(
      z.object({
        name: z.string(),
        role: z
          .string()
          .describe('Character role (e.g., "guard", "merchant", "villager", "elder")'),
        personality: z.array(z.string()).describe("3-5 personality traits"),
        backstory: z.string().describe("Brief backstory (1-2 sentences)"),
        speech_pattern: z
          .string()
          .describe('How they speak (e.g., "formal and measured", "gruff and terse")'),
        visual: z.object({
          char: z.string().describe("Single Unicode character to display"),
          fg: z.string().describe("Foreground color as hex (e.g., #deb887)"),
          bold: z.boolean().optional(),
        }),
        position: z.object({ x: z.number(), y: z.number() }),
        secrets: z
          .array(z.string())
          .describe("Things this character knows but won't easily share")
          .optional(),
      }),
    )
    .describe("Characters in this zone (0-3)"),
  narrative_hooks: z
    .array(z.string())
    .describe("Story hooks, mysteries, or interesting details in this zone"),
  exits: z
    .object({
      north: z.string().describe("What lies to the north").optional(),
      south: z.string().describe("What lies to the south").optional(),
      east: z.string().describe("What lies to the east").optional(),
      west: z.string().describe("What lies to the west").optional(),
    })
    .describe("Brief hints about what's in each direction (for adjacent zone generation)")
    .optional(),
});

export type ZoneSpec = z.infer<typeof ZoneSpecSchema>;

// ── Tool Definition ─────────────────────────────────────────

export const createZoneTool = createToolDef(
  "create_zone",
  "Generate the layout and contents of a new zone",
  ZoneSpecSchema,
);

// ── Parser ──────────────────────────────────────────────────

export function parseZoneResponse(toolUse: ToolUseBlock): ZoneSpec {
  return validateToolResponse(toolUse, "create_zone", ZoneSpecSchema);
}
