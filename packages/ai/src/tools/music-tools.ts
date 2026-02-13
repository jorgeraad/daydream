import { MusicSpecSchema, type MusicSpec } from "@daydream/audio";
import type { ToolUseBlock } from "../types.ts";
import { createToolDef, validateToolResponse } from "./schema-utils.ts";

// ── Tool Definition ─────────────────────────────────────────

export const generateMusicTool = createToolDef(
  "generate_music",
  `Generate an 8-bit chiptune music specification for a game zone.
Output a loopable pattern using 2-4 channels (square, triangle, sawtooth, noise).
Keep patterns short (2-8 measures) for tight loops.
Match the mood to the zone's biome and atmosphere.`,
  MusicSpecSchema,
);

// ── Parser ──────────────────────────────────────────────────

export function parseMusicResponse(toolUse: ToolUseBlock): MusicSpec {
  return validateToolResponse(toolUse, "generate_music", MusicSpecSchema);
}
