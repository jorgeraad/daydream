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

Use the create_zone tool to return your response as structured data.`;

export function buildZoneGenerationPrompt(params: {
  coords: { x: number; y: number };
  worldSetting: string;
  biomeConfig: string;
  adjacentZones: string;
  narrativeThreads: string;
  recentChronicle: string;
}): string {
  return `Generate a new zone at coordinates (${params.coords.x}, ${params.coords.y}).

World: ${params.worldSetting}
Biome at this location: ${params.biomeConfig}
Adjacent zones: ${params.adjacentZones}
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

The zone will be rendered in a terminal using Unicode characters and colors. Keep building footprints reasonable (3-8 cells wide, 2-5 cells tall). Characters are single cells with a display character and color.`;
}
