import type { WorldSeed, BiomePalette, Point, Direction, Zone, ZoneId } from "@daydream/engine";
import { ZoneBuilder, type ZoneBuildResult, type BuildingVisual, type ObjectVisual } from "@daydream/engine";
import type { SpriteLookup, SpriteLookupResult } from "@daydream/engine";
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
import {
  biomePalettes,
  SpriteRegistry,
  OBJECT_TYPE_TO_SPRITE,
  NPC_ROLE_TO_SPRITE,
} from "@daydream/renderer";
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

// ── SpriteLookup adapter ─────────────────────────────────────

/**
 * Create a SpriteLookup implementation that bridges the SpriteRegistry
 * and built-in mapping tables to the SpriteLookup interface expected by
 * ZoneBuilder. This allows ZoneBuilder to resolve AI-generated type
 * strings to sprite template IDs and collision footprints.
 */
function createSpriteLookup(registry: SpriteRegistry): SpriteLookup {
  function resolveFromTable(
    type: string,
    table: Readonly<Record<string, string>>,
  ): SpriteLookupResult | undefined {
    const key = type.toLowerCase().replace(/\s+/g, "_");
    const templateId = table[key];
    if (!templateId) return undefined;

    const template = registry.get(templateId);
    if (!template) return undefined;

    return {
      templateId: template.id,
      collisionTiles: template.collisionTiles,
    };
  }

  return {
    resolve(objectType: string): SpriteLookupResult | undefined {
      return resolveFromTable(objectType, OBJECT_TYPE_TO_SPRITE);
    },
    resolveBuilding(buildingType: string): SpriteLookupResult | undefined {
      return resolveFromTable(buildingType, OBJECT_TYPE_TO_SPRITE);
    },
    resolveNpc(role: string): SpriteLookupResult | undefined {
      return resolveFromTable(role, NPC_ROLE_TO_SPRITE);
    },
  };
}

// ── WorldGenerator ───────────────────────────────────────────

export class WorldGenerator {
  private aiClient: AIClient;
  private zoneBuilder: ZoneBuilder;
  private spriteRegistry: SpriteRegistry;
  private spriteLookup: SpriteLookup;

  constructor(
    aiClient: AIClient,
    buildingVisuals: Record<string, BuildingVisual>,
    objectVisuals: Record<string, ObjectVisual>,
    spriteRegistry?: SpriteRegistry,
  ) {
    this.aiClient = aiClient;
    this.zoneBuilder = new ZoneBuilder(buildingVisuals, objectVisuals);
    this.spriteRegistry = spriteRegistry ?? new SpriteRegistry();
    this.spriteLookup = createSpriteLookup(this.spriteRegistry);
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

    // Step 4: Build tile data from zone spec (with sprite placement)
    onProgress?.("Rendering terrain...");
    const zone = this.zoneBuilder.build(
      {
        terrain: {
          primaryGround: zoneSpec.terrain.primary_ground,
          features: zoneSpec.terrain.features,
        },
        buildings: zoneSpec.buildings,
        objects: zoneSpec.objects,
        npcs: zoneSpec.characters.map((c) => ({
          role: c.role,
          position: c.position,
        })),
      },
      "zone_0_0",
      palette,
      undefined, // width — use default
      undefined, // height — use default
      this.spriteLookup,
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

    // Build tile data (with sprite placement)
    const buildResult = this.zoneBuilder.build(
      {
        terrain: {
          primaryGround: zoneSpec.terrain.primary_ground,
          features: zoneSpec.terrain.features,
        },
        buildings: zoneSpec.buildings,
        objects: zoneSpec.objects,
        npcs: zoneSpec.characters.map((c) => ({
          role: c.role,
          position: c.position,
        })),
      },
      id,
      palette,
      undefined, // width
      undefined, // height
      this.spriteLookup,
      context.edgeSignatures,
    );

    // Save sprite cache after generation (new sprites may have been created)
    this.spriteRegistry.saveCache().catch((err) => {
      logger.warn("Failed to save sprite cache: {err}", {
        err: err instanceof Error ? err.message : String(err),
      });
    });

    const duration = Math.round(performance.now() - start);
    logger.info("Zone {id} generated in {duration}ms ({spriteCount} sprites)", {
      id,
      duration,
      spriteCount: buildResult.sprites?.length ?? 0,
    });

    // Convert ZoneBuildResult to a full engine Zone
    return {
      id,
      coords,
      biome: context.biome,
      tiles: buildResult.layers,
      sprites: buildResult.sprites,
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

  /**
   * Generate a zone via portal — uses the player's description as the zone's
   * local narrative flavor while inheriting the world setting/rules from the seed.
   * The portal description is injected into the generation prompt so the AI
   * creates a zone matching the player's vision.
   */
  async generatePortalZone(
    id: ZoneId,
    coords: Point,
    context: ZoneGenerationContext,
    portalDescription: string,
    onProgress?: ProgressCallback,
  ): Promise<Zone> {
    const start = performance.now();
    logger.info("Portal zone generation for {id} at ({x}, {y}): {desc}", {
      id,
      x: coords.x,
      y: coords.y,
      desc: portalDescription,
    });

    onProgress?.("Opening portal...");

    // Build adjacent zone description from hints
    const adjacentDesc = this.buildAdjacentDescription(context.adjacentHints);

    // Call AI with portal-enhanced prompt
    onProgress?.("Shaping your destination...");
    const zoneSpec = await this.generatePortalZoneSpec(
      context.worldSeed,
      coords,
      adjacentDesc,
      portalDescription,
    );

    // Select palette based on biome
    onProgress?.("Rendering terrain...");
    const palette = this.selectPalette(context.biome.type);

    // Build tile data (with sprite placement)
    const buildResult = this.zoneBuilder.build(
      {
        terrain: {
          primaryGround: zoneSpec.terrain.primary_ground,
          features: zoneSpec.terrain.features,
        },
        buildings: zoneSpec.buildings,
        objects: zoneSpec.objects,
        npcs: zoneSpec.characters.map((c) => ({
          role: c.role,
          position: c.position,
        })),
      },
      id,
      palette,
      undefined, // width
      undefined, // height
      this.spriteLookup,
    );

    // Save sprite cache after generation
    this.spriteRegistry.saveCache().catch((err) => {
      logger.warn("Failed to save sprite cache: {err}", {
        err: err instanceof Error ? err.message : String(err),
      });
    });

    const duration = Math.round(performance.now() - start);
    logger.info("Portal zone {id} generated in {duration}ms ({spriteCount} sprites)", {
      id,
      duration,
      spriteCount: buildResult.sprites?.length ?? 0,
    });

    onProgress?.("Portal ready!");

    return {
      id,
      coords,
      biome: context.biome,
      tiles: buildResult.layers,
      sprites: buildResult.sprites,
      characters: [],
      buildings: [],
      objects: [],
      exits: [],
      generated: true,
      generationSeed: `portal_${portalDescription}_${coords.x}_${coords.y}`,
      lastVisited: Date.now(),
      metadata: {
        name: zoneSpec.name ?? portalDescription.slice(0, 40),
        description: zoneSpec.description ?? portalDescription,
      },
    };
  }

  /**
   * Generate a zone spec enhanced with the player's portal description.
   * The prompt includes the portal description as the primary creative direction.
   */
  private async generatePortalZoneSpec(
    seed: WorldSeed,
    coords: Point,
    adjacentZones: string,
    portalDescription: string,
  ): Promise<ZoneSpec> {
    const portalPrompt = `Generate a new zone at coordinates (${coords.x}, ${coords.y}).

World: ${seed.setting.name} — ${seed.setting.description}
Biome at this location: ${seed.biomeMap.center.type} (${seed.biomeMap.center.terrain.primary})

THE PLAYER HAS OPENED A PORTAL TO THIS SPECIFIC LOCATION:
"${portalDescription}"

This is the player's vision for this place. Use it as the primary creative direction for the zone's name, description, terrain, buildings, characters, and atmosphere. The zone should feel like a natural part of this world (same era, tone, and rules) while realizing the player's description.

World rules:
- Era: ${seed.setting.era}
- Tone: ${seed.setting.tone}
- Magic: ${seed.worldRules.hasMagic ? "exists" : "none"}
- Tech level: ${seed.worldRules.techLevel}

Adjacent zones:
${adjacentZones}

Generate the zone layout including:
1. A name and brief description (inspired by the portal description)
2. Terrain layout (ground types and placement)
3. Buildings (if appropriate) — described as footprint, style, and features
4. Nature objects (trees, rocks, water features) — described by type and placement
5. Characters present (0-3, appropriate to the location described)
6. Narrative hooks connecting this place to the wider world
7. Exits — brief hints about what lies in each cardinal direction

The zone will be rendered in a terminal using Unicode characters and colors. Keep building footprints reasonable (3-8 cells wide, 2-5 cells tall).`;

    const response = await this.aiClient.generate({
      system: ZONE_GENERATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: portalPrompt }],
      tools: [createZoneTool],
      model: "sonnet",
      maxTokens: 4096,
      temperature: 0.7,
      taskType: "zone-gen",
    });

    const toolUse = response.toolUse[0];
    if (!toolUse) {
      throw new Error("AI did not return a zone spec tool response for portal");
    }

    return parseZoneResponse(toolUse);
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
