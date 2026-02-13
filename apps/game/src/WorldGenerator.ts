import type { WorldSeed, BiomePalette, Point, Direction, Zone, ZoneId } from "@daydream/engine";
import { ZoneBuilder, type ZoneBuildResult, type BuildingVisual, type ObjectVisual } from "@daydream/engine";
import type { ZoneGenerationContext, AdjacentZoneHint } from "@daydream/engine";
import {
  AIClient,
  WORLD_CREATION_SYSTEM_PROMPT,
  buildWorldCreationPrompt,
  ZONE_GENERATION_SYSTEM_PROMPT,
  buildZoneGenerationPrompt,
  createWorldTool,
  parseWorldSeedResponse,
  createZoneTool,
  parseZoneResponse,
  type WorldSeedSpec,
  type ZoneSpec,
} from "@daydream/ai";
import { biomePalettes } from "@daydream/renderer";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["daydream", "game", "world-gen"]);

// ── Types ────────────────────────────────────────────────────

export interface GeneratedWorld {
  seed: WorldSeed;
  zone: ZoneBuildResult;
  characters: ZoneCharacter[];
  palette: BiomePalette;
}

export interface ZoneCharacter {
  name: string;
  role: string;
  personality: string[];
  backstory: string;
  speechPattern: string;
  visual: { char: string; fg: string; bold?: boolean };
  position: { x: number; y: number };
  secrets: string[];
}

type ProgressCallback = (status: string) => void;

// ── WorldGenerator ───────────────────────────────────────────

export class WorldGenerator {
  private aiClient: AIClient;
  private zoneBuilder: ZoneBuilder;

  constructor(
    aiClient: AIClient,
    buildingVisuals: Record<string, BuildingVisual>,
    objectVisuals: Record<string, ObjectVisual>,
  ) {
    this.aiClient = aiClient;
    this.zoneBuilder = new ZoneBuilder(buildingVisuals, objectVisuals);
  }

  async generate(
    playerPrompt: string,
    onProgress?: ProgressCallback,
  ): Promise<GeneratedWorld> {
    const start = performance.now();
    logger.info("World generation starting for prompt: {prompt}", { prompt: playerPrompt });

    // Step 1: Generate world seed
    onProgress?.("Dreaming up your world...");
    const seedSpec = await this.generateWorldSeed(playerPrompt);
    logger.info("World seed generated: {name} ({biome})", {
      name: seedSpec.setting.name,
      biome: seedSpec.biomeMap.centerBiome,
    });

    // Step 2: Convert seed spec to engine WorldSeed
    onProgress?.("Shaping the landscape...");
    const palette = this.selectPalette(seedSpec.biomeMap.centerBiome);
    const seed = this.buildWorldSeed(playerPrompt, seedSpec, palette);

    // Step 3: Generate starting zone
    onProgress?.("Populating the first zone...");
    const zoneSpec = await this.generateZone(seed);
    logger.info("Zone spec generated with {charCount} characters", {
      charCount: zoneSpec.characters.length,
    });

    // Step 4: Build tile data from zone spec
    onProgress?.("Rendering terrain...");
    const zone = this.zoneBuilder.build(
      {
        terrain: {
          primaryGround: zoneSpec.terrain.primary_ground,
          features: zoneSpec.terrain.features,
        },
        buildings: zoneSpec.buildings,
        objects: zoneSpec.objects,
      },
      "zone_0_0",
      palette,
    );

    // Step 5: Extract characters
    onProgress?.("Bringing characters to life...");
    const characters = this.extractCharacters(zoneSpec);

    const duration = Math.round(performance.now() - start);
    logger.info("World generation complete in {duration}ms — {charCount} characters", {
      duration,
      charCount: characters.length,
      biome: seedSpec.biomeMap.centerBiome,
    });

    return { seed, zone, characters, palette };
  }

  /**
   * Generate a zone at arbitrary coordinates with full ZoneGenerationContext.
   * Used by ZoneManager's ZoneGeneratorFn callback for on-demand zone creation.
   */
  async generateZoneAt(
    id: ZoneId,
    coords: Point,
    context: ZoneGenerationContext,
  ): Promise<Zone> {
    const start = performance.now();
    logger.info("Generating zone {id} at ({x}, {y})", {
      id,
      x: coords.x,
      y: coords.y,
    });

    // Build adjacent zone description from hints
    const adjacentDesc = this.buildAdjacentDescription(context.adjacentHints);

    // Build narrative context
    const narrativeThreads = context.chronicle.activeThreads.length > 0
      ? context.chronicle.activeThreads.join(", ")
      : "No active threads.";
    const recentChronicle = context.chronicle.recentSummary || "The player continues exploring.";

    // Call AI to generate zone spec
    const zoneSpec = await this.generateZoneSpec(
      context.worldSeed,
      coords,
      adjacentDesc,
      narrativeThreads,
      recentChronicle,
    );

    // Select palette based on biome
    const palette = this.selectPalette(context.biome.type);

    // Build tile data
    const buildResult = this.zoneBuilder.build(
      {
        terrain: {
          primaryGround: zoneSpec.terrain.primary_ground,
          features: zoneSpec.terrain.features,
        },
        buildings: zoneSpec.buildings,
        objects: zoneSpec.objects,
      },
      id,
      palette,
    );

    const duration = Math.round(performance.now() - start);
    logger.info("Zone {id} generated in {duration}ms", { id, duration });

    // Convert ZoneBuildResult to a full engine Zone
    return {
      id,
      coords,
      biome: context.biome,
      tiles: buildResult.layers,
      characters: [],
      buildings: [],
      objects: [],
      exits: [],
      generated: true,
      generationSeed: `${context.worldSeed.originalPrompt}_${coords.x}_${coords.y}`,
      lastVisited: Date.now(),
      metadata: {
        name: zoneSpec.name ?? id,
        description: zoneSpec.description ?? "",
      },
    };
  }

  private buildAdjacentDescription(hints: Map<Direction, AdjacentZoneHint>): string {
    if (hints.size === 0) return "No adjacent zones explored yet.";
    const parts: string[] = [];
    for (const [dir, hint] of hints) {
      parts.push(`${dir}: "${hint.name}" (${hint.biome}) — ${hint.description}`);
    }
    return parts.join("\n");
  }

  private async generateZoneSpec(
    seed: WorldSeed,
    coords: Point,
    adjacentZones: string,
    narrativeThreads: string,
    recentChronicle: string,
  ): Promise<ZoneSpec> {
    const response = await this.aiClient.generate({
      system: ZONE_GENERATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildZoneGenerationPrompt({
            coords,
            worldSetting: `${seed.setting.name} — ${seed.setting.description}`,
            biomeConfig: `${seed.biomeMap.center.type} (${seed.biomeMap.center.terrain.primary})`,
            adjacentZones,
            narrativeThreads,
            recentChronicle,
          }),
        },
      ],
      tools: [createZoneTool],
      model: "sonnet",
      maxTokens: 4096,
      temperature: 0.7,
      taskType: "zone-gen",
    });

    const toolUse = response.toolUse[0];
    if (!toolUse) {
      throw new Error("AI did not return a zone spec tool response");
    }

    return parseZoneResponse(toolUse);
  }

  // ── Private: AI calls ──────────────────────────────────

  private async generateWorldSeed(prompt: string): Promise<WorldSeedSpec> {
    const response = await this.aiClient.generate({
      system: WORLD_CREATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildWorldCreationPrompt(prompt) }],
      tools: [createWorldTool],
      model: "opus",
      maxTokens: 4096,
      temperature: 0.8,
      taskType: "world-seed",
    });

    const toolUse = response.toolUse[0];
    if (!toolUse) {
      throw new Error("AI did not return a world seed tool response");
    }

    return parseWorldSeedResponse(toolUse);
  }

  private async generateZone(seed: WorldSeed): Promise<ZoneSpec> {
    const response = await this.aiClient.generate({
      system: ZONE_GENERATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildZoneGenerationPrompt({
            coords: { x: 0, y: 0 },
            worldSetting: `${seed.setting.name} — ${seed.setting.description}`,
            biomeConfig: `${seed.biomeMap.center.type} (${seed.biomeMap.center.terrain.primary})`,
            adjacentZones: "This is the starting zone. No adjacent zones exist yet.",
            narrativeThreads: seed.initialNarrative.hooks.join(", "),
            recentChronicle: "The player has just arrived.",
          }),
        },
      ],
      tools: [createZoneTool],
      model: "sonnet",
      maxTokens: 4096,
      temperature: 0.7,
      taskType: "zone-gen",
    });

    const toolUse = response.toolUse[0];
    if (!toolUse) {
      throw new Error("AI did not return a zone spec tool response");
    }

    return parseZoneResponse(toolUse);
  }

  // ── Private: data conversion ───────────────────────────

  private selectPalette(centerBiome: string): BiomePalette {
    const biome = centerBiome.toLowerCase();

    // Try exact match
    if (biomePalettes[biome]) return biomePalettes[biome]!;

    // Keyword matching
    if (biome.includes("forest") || biome.includes("wood") || biome.includes("grove")) {
      return biomePalettes["forest"]!;
    }
    if (biome.includes("desert") || biome.includes("sand") || biome.includes("arid")) {
      return biomePalettes["desert"]!;
    }
    if (biome.includes("town") || biome.includes("village") || biome.includes("city") || biome.includes("market")) {
      return biomePalettes["town"]!;
    }

    // Default to forest
    return biomePalettes["forest"]!;
  }

  private buildWorldSeed(
    prompt: string,
    spec: WorldSeedSpec,
    palette: BiomePalette,
  ): WorldSeed {
    return {
      originalPrompt: prompt,
      setting: spec.setting,
      biomeMap: {
        center: {
          type: spec.biomeMap.centerBiome,
          terrain: {
            primary: spec.biomeMap.centerBiome,
            secondary: spec.biomeMap.centerBiome,
            features: [],
          },
          palette,
          density: { vegetation: 0.5, structures: 0.3, characters: 0.3 },
          ambient: { lighting: "normal" },
        },
        distribution: {
          type: "simple",
          seed: Date.now(),
          biomes: Object.fromEntries(
            spec.biomeMap.distribution.map((d) => [d.biome, 1]),
          ),
        },
      },
      initialNarrative: spec.initialNarrative,
      worldRules: spec.worldRules,
    };
  }

  private extractCharacters(spec: ZoneSpec): ZoneCharacter[] {
    return spec.characters.map((c) => ({
      name: c.name,
      role: c.role,
      personality: c.personality,
      backstory: c.backstory,
      speechPattern: c.speech_pattern,
      visual: c.visual,
      position: c.position,
      secrets: c.secrets ?? [],
    }));
  }
}
