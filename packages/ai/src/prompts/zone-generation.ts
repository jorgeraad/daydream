import type { Direction } from "@daydream/engine";

// ── Adjacent Zone Hint (prompt-level) ────────────────────────

/** Hint about an adjacent zone, used to build coherent generation prompts. */
export interface AdjacentZonePromptHint {
  name: string;
  description: string;
  biome: string;
  edgeFeatures: string[];
}

// ── Direction display helpers ────────────────────────────────

const DIRECTION_LABELS: Record<Direction, string> = {
  up: "NORTH",
  down: "SOUTH",
  left: "WEST",
  right: "EAST",
};

/** Opposite-edge label: if a zone is NORTH, its shared boundary is its southern edge. */
const SHARED_EDGE_LABELS: Record<Direction, string> = {
  up: "southern",
  down: "northern",
  left: "eastern",
  right: "western",
};

// ── System Prompt ────────────────────────────────────────────

export const ZONE_GENERATION_SYSTEM_PROMPT = `You are the zone generator for a living terminal game. You generate individual zones (tile maps) that fit into a larger world. Each zone is rendered as Unicode characters in a terminal.

Guidelines:
- Zones should feel natural and consistent with adjacent zones
- If a character in a nearby zone mentioned a location, it might appear here
- If a narrative thread is building, this zone might advance it
- Keep building footprints reasonable (3-8 cells wide, 2-5 cells tall)
- Characters are single cells with a display character and color
- Place 0-3 characters per zone, appropriate to the biome and setting
- Include narrative hooks or interesting details that connect to the wider world
- Terrain should vary — avoid making every zone look the same

Terrain continuity at zone edges:
- When adjacent zone descriptions are provided, pay close attention to the features at shared boundaries
- If a road, river, path, or other linear feature reaches the edge of an adjacent zone, continue it naturally into this zone at the corresponding edge
- Match the biome transition at shared boundaries — avoid jarring changes (e.g., dense forest should not abruptly become open desert at an edge)
- Water features (rivers, streams) that flow across zone boundaries must connect at the same positions along the shared edge
- Paths and roads that lead toward this zone should have a matching entry point on this zone's edge

Use the create_zone tool to return your response as structured data. When filling in the exits field, describe what a traveler would find or expect in each direction — this helps generate coherent adjacent zones later.`;

export function buildZoneGenerationPrompt(params: {
  coords: { x: number; y: number };
  worldSetting: string;
  biomeConfig: string;
  adjacentZones: string;
  adjacentZoneHints?: Map<Direction, AdjacentZonePromptHint>;
  narrativeThreads: string;
  recentChronicle: string;
}): string {
  // Build adjacent zone description: prefer structured hints if provided,
  // fall back to the raw adjacentZones string for backward compatibility.
  const adjacentSection = params.adjacentZoneHints && params.adjacentZoneHints.size > 0
    ? formatAdjacentHints(params.adjacentZoneHints)
    : params.adjacentZones;

  return `Generate a new zone at coordinates (${params.coords.x}, ${params.coords.y}).

World: ${params.worldSetting}
Biome at this location: ${params.biomeConfig}

Adjacent zones:
${adjacentSection}

Active narrative threads: ${params.narrativeThreads}
Recent events: ${params.recentChronicle}

Generate the zone layout including:
1. A name and brief description
2. Terrain layout (ground types and placement)
3. Buildings (if appropriate for the biome density) — described as footprint, style, and features
4. Nature objects (trees, rocks, water features) — described by type and placement
5. Characters present (0-3, with full identity and visual definitions)
6. Any narrative hooks or interesting details
7. How this zone connects to the narrative
8. Exits — brief hints about what lies in each cardinal direction, to guide future zone generation

Ensure terrain at shared boundaries is continuous with adjacent zones. If an adjacent zone has a road or river reaching its edge toward this zone, continue that feature into this zone. Match biome transitions naturally at borders.

The zone will be rendered in a terminal using Unicode characters and colors. Keep building footprints reasonable (3-8 cells wide, 2-5 cells tall). Characters are single cells with a display character and color.`;
}

/**
 * Format structured adjacent zone hints into the prompt text.
 * Matches design doc §10.1 format:
 *   - NORTH: "The Market Square" (village biome) — southern edge has ...
 *   - EAST: (unexplored)
 */
export function formatAdjacentHints(
  hints: Map<Direction, AdjacentZonePromptHint>,
): string {
  const allDirections: Direction[] = ["up", "down", "left", "right"];
  const lines: string[] = [];

  for (const dir of allDirections) {
    const label = DIRECTION_LABELS[dir];
    const hint = hints.get(dir);

    if (hint) {
      const edgeLabel = SHARED_EDGE_LABELS[dir];
      const edgeDesc =
        hint.edgeFeatures.length > 0
          ? `${edgeLabel} edge has ${hint.edgeFeatures.join(" and ")}`
          : `${edgeLabel} edge details unknown`;
      lines.push(`- ${label}: "${hint.name}" (${hint.biome} biome) — ${edgeDesc}.`);
    } else {
      lines.push(`- ${label}: (unexplored)`);
    }
  }

  return lines.join("\n");
}
