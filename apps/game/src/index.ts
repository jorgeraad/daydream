import {
  createCliRenderer,
  FrameBufferRenderable,
} from "@opentui/core";
import {
  TileRenderer,
  CharacterRenderer,
  ViewportManager,
  isCollision,
  isCharacterAt,
  LoadingScreen,
  TransitionManager,
  LoadingGate,
  NarrativeBar,
  DialoguePanel,
  forestPalette,
  buildingTemplates,
  objectGlyphs,
  characterPresets,
  biomePalettes,
} from "@daydream/renderer";
import {
  EventBus,
  WorldState,
  ZoneManager,
  adjacentZoneIds,
  parseZoneCoords,
} from "@daydream/engine";
import type {
  Character,
  Direction,
  Zone,
  ZoneId,
  WorldSeed,
  Point,
} from "@daydream/engine";
import type { ZoneStore, ZoneGeneratorFn } from "@daydream/engine";
import type { ZoneData, TileCell, TileLayer } from "@daydream/renderer";
import type { BuildingVisual, ObjectVisual, ZoneBuildResult } from "@daydream/engine";
import { AIClient, ContextManager } from "@daydream/ai";
import { InputRouter } from "./InputRouter.ts";
import { LocationBrowser } from "./LocationBrowser.ts";
import { DialogueManager } from "./DialogueManager.ts";
import { TitleScreen } from "./TitleScreen.ts";
import type { TitleScreenResult } from "./TitleScreen.ts";
import { WorldGenerator, type ZoneCharacter } from "./WorldGenerator.ts";
import { SaveManager } from "./SaveManager.ts";
import { SettingsManager } from "./settings/SettingsManager.ts";
import { SettingsScreen } from "./settings/SettingsScreen.ts";
import { OnboardingScreen } from "./OnboardingScreen.ts";
import { configureLogging } from "./logging/index.ts";
import { getLogger } from "@logtape/logtape";
import type { LogLevel } from "@logtape/logtape";

// ── Polyfills ────────────────────────────────────────────────

// Bun.stripANSI was added after 1.2.x; OpenTUI's KeyHandler.processPaste()
// calls it and silently swallows paste events when it's missing.
if (typeof (Bun as any).stripANSI !== "function") {
  const ansiRe = /[\x1B\x9B][\[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><~]/g;
  (Bun as any).stripANSI = (str: string) => str.replace(ansiRe, "");
}

// ── Helpers ──────────────────────────────────────────────────

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ── Convert renderer templates to engine BuildingVisual / ObjectVisual ──

function toBuildingVisuals(): Record<string, BuildingVisual> {
  const result: Record<string, BuildingVisual> = {};
  for (const [key, tpl] of Object.entries(buildingTemplates)) {
    result[key] = {
      border: tpl.border,
      door: tpl.door,
      fill: tpl.fill,
      defaultFg: tpl.defaultFg,
      doorFg: tpl.doorFg,
    };
  }
  return result;
}

function toObjectVisuals(): Record<string, ObjectVisual> {
  const result: Record<string, ObjectVisual> = {};
  for (const [key, glyph] of Object.entries(objectGlyphs)) {
    result[key] = {
      char: glyph.char,
      fg: glyph.fg,
      bold: glyph.bold,
      collision: glyph.collision,
    };
  }
  return result;
}

// ── Convert AI-generated characters to engine Character objects ──

function toCharacter(c: ZoneCharacter, zoneId: string, worldId: string): Character {
  return {
    id: `npc_${c.name.toLowerCase().replace(/\s+/g, "_")}`,
    worldId,
    identity: {
      name: c.name,
      age: "adult",
      role: c.role,
      personality: c.personality,
      backstory: c.backstory,
      speechPattern: c.speechPattern,
      secrets: c.secrets,
    },
    visual: {
      display: {
        char: c.visual.char,
        fg: c.visual.fg,
        bold: c.visual.bold,
      },
      nameplate: c.name,
    },
    state: {
      currentZone: zoneId,
      position: c.position,
      facing: "down",
      mood: "content",
      currentActivity: "standing",
      health: "healthy",
      goals: [],
    },
    behavior: {
      type: "stationary",
      params: {},
    },
    memory: {
      personalExperiences: [],
      heardRumors: [],
      playerRelationship: {
        trust: 0,
        familiarity: 0,
        impressions: [],
      },
    },
    relationships: new Map(),
  };
}

// ── Zone-to-ZoneData bridge ─────────────────────────────────

/** Convert an engine Zone to a renderer ZoneData for tile rendering. */
function zoneToZoneData(zone: Zone): ZoneData {
  return {
    id: zone.id,
    width: zone.tiles[0]?.width ?? 80,
    height: zone.tiles[0]?.height ?? 40,
    layers: zone.tiles as TileLayer[],
  };
}

// ── ZoneStore factory (wraps SaveManager) ───────────────────

function createZoneStore(saveManager: SaveManager, worldState: WorldState): ZoneStore {
  return {
    async load(id: ZoneId): Promise<Zone | null> {
      // Check if zone is already in WorldState (covers initial zone + previously loaded)
      const existing = worldState.zones.get(id);
      if (existing) return existing;
      // In a full implementation, this would query SaveManager's zones table.
      // For now, zones are managed in memory via WorldState.
      return null;
    },
    async save(zone: Zone): Promise<void> {
      worldState.zones.set(zone.id as ZoneId, zone);
      worldState.markZoneDirty(zone.id as ZoneId);
    },
    async saveIfDirty(zone: Zone): Promise<void> {
      // Mark for next auto-save cycle
      worldState.markZoneDirty(zone.id as ZoneId);
    },
  };
}

// ── ZoneGeneratorFn factory (wraps WorldGenerator) ──────────

function createZoneGeneratorFn(generator: WorldGenerator): ZoneGeneratorFn {
  return async (id, coords, context) => {
    return generator.generateZoneAt(id, coords, context);
  };
}

// ── Fallback: test zone builder ──────────────────────────────

function buildTestZone(): ZoneData {
  const W = 80;
  const H = 40;
  const palette = forestPalette;

  const ground: TileCell[] = new Array(W * H);
  const objects: TileCell[] = new Array(W * H);
  const collision: TileCell[] = new Array(W * H);
  const empty: TileCell = { char: "", fg: "#000000" };
  const passable: TileCell = { char: "0", fg: "#000000" };
  const blocked: TileCell = { char: "1", fg: "#000000" };

  for (let i = 0; i < W * H; i++) {
    ground[i] = {
      char: randomPick(palette.ground.chars),
      fg: randomPick(palette.ground.fg),
      bg: palette.ground.bg,
    };
    objects[i] = empty;
    collision[i] = passable;
  }

  // Water pond
  for (let y = 15; y < 22; y++) {
    for (let x = 8; x < 20; x++) {
      const cx = 14, cy = 18.5;
      const dx = (x - cx) / 6, dy = (y - cy) / 3.5;
      if (dx * dx + dy * dy < 1) {
        ground[y * W + x] = {
          char: randomPick(palette.water!.chars),
          fg: randomPick(palette.water!.fg),
          bg: palette.water!.bg,
        };
        collision[y * W + x] = blocked;
      }
    }
  }

  // Winding path
  let pathY = 10;
  for (let x = 0; x < W; x++) {
    if (x % 7 === 0) pathY += Math.random() > 0.5 ? 1 : -1;
    pathY = Math.max(2, Math.min(H - 3, pathY));
    for (let dy = 0; dy < 2; dy++) {
      const y = pathY + dy;
      if (y >= 0 && y < H) {
        ground[y * W + x] = {
          char: randomPick(palette.path!.chars),
          fg: palette.path!.fg,
          bg: palette.path!.bg,
        };
      }
    }
  }

  // Trees
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(Math.random() * W);
    const y = Math.floor(Math.random() * H);
    const idx = y * W + x;
    if (collision[idx]!.char === "1") continue;
    if (ground[idx]!.bg === palette.path!.bg) continue;
    const veg = Math.random() > 0.3 ? palette.vegetation["tree_canopy"] : palette.vegetation["bush"];
    if (!veg) continue;
    const char = veg.variants ? randomPick([veg.char, ...veg.variants]) : veg.char;
    objects[idx] = { char, fg: veg.fg, bold: true };
    collision[idx] = blocked;
  }

  // Flowers
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(Math.random() * W);
    const y = Math.floor(Math.random() * H);
    const idx = y * W + x;
    if (collision[idx]!.char === "1") continue;
    if (ground[idx]!.bg === palette.path!.bg) continue;
    const flower = palette.vegetation.flower;
    if (!flower) continue;
    const char = flower.variants ? randomPick([flower.char, ...flower.variants]) : flower.char;
    objects[idx] = { char, fg: flower.fg };
  }

  // Building
  const bx = 35, by = 20, bw = 8, bh = 5;
  for (let y = by; y < by + bh; y++) {
    for (let x = bx; x < bx + bw; x++) {
      const idx = y * W + x;
      if (y === by || y === by + bh - 1) {
        if (x === bx) objects[idx] = { char: "╔", fg: "#c4a882" };
        else if (x === bx + bw - 1) objects[idx] = { char: y === by ? "╗" : "╝", fg: "#c4a882" };
        else if (y === by) objects[idx] = { char: "═", fg: "#c4a882" };
        else objects[idx] = { char: "═", fg: "#c4a882" };
        if (y === by && x === bx) objects[idx] = { char: "╔", fg: "#c4a882" };
        if (y === by + bh - 1 && x === bx) objects[idx] = { char: "╚", fg: "#c4a882" };
        if (y === by + bh - 1 && x === bx + bw - 1) objects[idx] = { char: "╝", fg: "#c4a882" };
      } else {
        if (x === bx || x === bx + bw - 1) {
          objects[idx] = { char: "║", fg: "#c4a882" };
        } else {
          ground[idx] = { char: " ", fg: "#4a3a28", bg: "#3a2a18" };
        }
      }
      collision[idx] = blocked;
    }
  }
  const doorX = bx + Math.floor(bw / 2);
  const doorIdx = (by + bh - 1) * W + doorX;
  objects[doorIdx] = { char: "╤", fg: "#3d2b1f" };
  collision[doorIdx] = passable;

  // Rocks
  for (let i = 0; i < 15; i++) {
    const x = 55 + Math.floor(Math.random() * 20);
    const y = Math.floor(Math.random() * H);
    const idx = y * W + x;
    if (collision[idx]!.char === "1") continue;
    objects[idx] = { char: randomPick(["●", "○", "◆"]), fg: "#6a6a6a", bold: true };
    collision[idx] = blocked;
  }

  // Clear spawn
  const startIdx = 10 * W + 5;
  objects[startIdx] = empty;
  collision[startIdx] = passable;

  const layers: TileLayer[] = [
    { name: "ground", data: ground, width: W, height: H },
    { name: "objects", data: objects, width: W, height: H },
    { name: "collision", data: collision, width: W, height: H },
  ];

  return { id: "test_zone", width: W, height: H, layers };
}

function createTestCharacter(
  id: string,
  presetKey: string,
  name: string,
  x: number,
  y: number,
): Character {
  const preset = characterPresets[presetKey]!;
  return {
    id,
    worldId: "test_world",
    identity: {
      name,
      age: "adult",
      role: preset.nameplate,
      personality: ["friendly"],
      backstory: `A ${preset.nameplate.toLowerCase()} living in the forest.`,
      speechPattern: "casual",
      secrets: [],
    },
    visual: { ...preset, nameplate: name },
    state: {
      currentZone: "test_zone",
      position: { x, y },
      facing: "down",
      mood: "content",
      currentActivity: "standing",
      health: "healthy",
      goals: [],
    },
    behavior: { type: "stationary", params: {} },
    memory: {
      personalExperiences: [],
      heardRumors: [],
      playerRelationship: { trust: 0, familiarity: 0, impressions: [] },
    },
    relationships: new Map(),
  };
}

function buildTestCharacters(zone: ZoneData): Character[] {
  const chars: Character[] = [
    createTestCharacter("npc_guard", "guard", "Aldric", 10, 8),
    createTestCharacter("npc_merchant", "merchant", "Mira", 30, 12),
    createTestCharacter("npc_elder", "elder", "Theron", 38, 26),
    createTestCharacter("npc_child", "child", "Pip", 25, 15),
    createTestCharacter("npc_dog", "animal_dog", "Biscuit", 12, 9),
  ];

  const collisionLayer = zone.layers.find((l) => l.name === "collision");
  const objectsLayer = zone.layers.find((l) => l.name === "objects");
  if (collisionLayer && objectsLayer) {
    for (const c of chars) {
      const idx = c.state.position.y * zone.width + c.state.position.x;
      collisionLayer.data[idx] = { char: "0", fg: "#000000" };
      objectsLayer.data[idx] = { char: "", fg: "#000000" };
    }
  }

  return chars;
}

// ── Gameplay ─────────────────────────────────────────────────

const BOTTOM_BAR_HEIGHT = 10;

interface GameplayOptions {
  renderer: Awaited<ReturnType<typeof createCliRenderer>>;
  zone: ZoneData;
  characters: Character[];
  playerX: number;
  playerY: number;
  aiClient?: AIClient;
  zoneManager?: ZoneManager;
  worldState?: WorldState;
}

function startGameplay(opts: GameplayOptions): void {
  const {
    renderer,
    characters,
    aiClient,
    zoneManager,
  } = opts;
  let { zone } = opts;

  const gameLogger = getLogger(["daydream", "game", "gameplay"]);
  const eventBus = new EventBus();
  const inputRouter = new InputRouter(eventBus);

  // Layout: viewport takes everything except bottom bar
  const viewW = renderer.terminalWidth;
  const viewH = renderer.terminalHeight - BOTTOM_BAR_HEIGHT;

  const viewport = new ViewportManager(viewW, viewH);

  let px = opts.playerX;
  let py = opts.playerY;
  let transitioning = false;

  const fb = new FrameBufferRenderable(renderer, {
    id: "viewport",
    width: viewW,
    height: viewH,
    onKeyDown(key) {
      // Block input during zone transitions
      if (transitioning) return;
      inputRouter.handleKey(key);
    },
  });

  fb.focusable = true;
  fb.focus();

  const tileRenderer = new TileRenderer(fb.frameBuffer);
  const charRenderer = new CharacterRenderer(fb.frameBuffer);

  // Transition systems (only active when zoneManager is available)
  const transitionManager = zoneManager ? new TransitionManager(renderer) : null;
  const loadingGate = zoneManager ? new LoadingGate() : null;

  // Bottom bar: narrative during exploration, dialogue panel during conversation
  const narrativeBar = new NarrativeBar(renderer);
  const dialoguePanel = new DialoguePanel(renderer);

  // Use provided WorldState or bootstrap a minimal one
  const worldState = opts.worldState ?? new WorldState({
    worldId: "world_" + Date.now(),
    worldSeed: {
      originalPrompt: "",
      setting: { name: "Unknown", type: "wilderness", era: "medieval", tone: "mysterious", description: "" },
      biomeMap: {
        center: {
          type: "forest",
          terrain: { primary: "grass", secondary: "dirt", features: [] },
          palette: {
            ground: { chars: ["."], fg: ["#4a7a4a"], bg: "#1a2a1a" },
            vegetation: {},
          },
          density: { vegetation: 0.5, structures: 0.1, characters: 0.05 },
          ambient: { lighting: "natural" },
        },
        distribution: { type: "single", seed: 0, biomes: { forest: 1 } },
      },
      initialNarrative: { hooks: [], mainTension: "", atmosphere: "" },
      worldRules: { hasMagic: false, techLevel: "medieval", economy: "barter", dangers: [], customs: [] },
    },
    createdAt: Date.now(),
    player: {
      position: { zone: zone.id, x: px, y: py },
      facing: "down",
      inventory: [],
      journal: { entries: [], knownCharacters: [], discoveredZones: [zone.id], activeQuests: [] },
      stats: { totalPlayTime: 0, conversationsHad: 0, zonesExplored: 1, daysSurvived: 0 },
    },
    activeZoneId: zone.id,
  });

  // Register characters in WorldState
  for (const char of characters) {
    worldState.characters.set(char.id, char);
  }

  // Wire up DialogueManager if AI client is available
  let dialogueManager: DialogueManager | null = null;
  if (aiClient) {
    const contextManager = new ContextManager();
    dialogueManager = new DialogueManager({
      aiClient,
      contextManager,
      worldState,
      eventBus,
      panel: dialoguePanel,
      inputRouter,
    });
  }

  // Character interaction → start dialogue
  eventBus.on("character:interact", ({ characterId }) => {
    if (dialogueManager) {
      dialogueManager.startConversation(characterId);
    }
  });

  // Location browser overlay
  const locationBrowser = new LocationBrowser(renderer, worldState, zoneManager ?? null);

  // Wire map mode handler
  inputRouter.setMapHandler((key) => {
    locationBrowser.handleKey(key);
  });

  // Mode changes → swap bottom bar components and show/hide overlays
  eventBus.on("mode:changed", ({ from, to }) => {
    if (to === "dialogue") {
      renderer.root.remove("narrative-bar");
      renderer.root.add(dialoguePanel.container);
    } else if (from === "dialogue") {
      renderer.root.remove("dialogue-panel");
      renderer.root.add(narrativeBar.container);
    }

    // Opening map → show location browser, start async selection
    if (to === "map") {
      locationBrowser.show().then((selectedZoneId) => {
        if (selectedZoneId && selectedZoneId !== worldState.activeZoneId) {
          // Trigger fast-travel to selected zone
          handleFastTravel(selectedZoneId as ZoneId);
        }
        // Return to exploration mode (browser already hidden itself)
        inputRouter.setMode("exploration");
      });
    }

    // Closing map from another trigger (safety net)
    if (from === "map" && locationBrowser.isVisible) {
      locationBrowser.hide();
    }

    renderer.requestRender();
  });

  // ── Zone edge detection ─────────────────────────────────────

  /**
   * Detect which direction the player would cross a zone boundary.
   * Returns the direction if the next position is outside the current zone,
   * or null if the movement stays within the zone.
   */
  function detectZoneEdgeCrossing(nx: number, ny: number): Direction | null {
    if (nx < 0) return "left";
    if (nx >= zone.width) return "right";
    if (ny < 0) return "up";
    if (ny >= zone.height) return "down";
    return null;
  }

  /**
   * Calculate the player's position on the opposite edge after crossing.
   * E.g., walking off the right edge places you at x=0 on the new zone.
   */
  function oppositeEdgePosition(direction: Direction, currentX: number, currentY: number): { x: number; y: number } {
    switch (direction) {
      case "left":
        return { x: zone.width - 1, y: currentY };
      case "right":
        return { x: 0, y: currentY };
      case "up":
        return { x: currentX, y: zone.height - 1 };
      case "down":
        return { x: currentX, y: 0 };
    }
  }

  // ── Zone transition handling ────────────────────────────────

  async function handleZoneTransition(direction: Direction): Promise<void> {
    if (!zoneManager || !transitionManager || transitioning) return;

    transitioning = true;
    gameLogger.info("Zone transition started: direction={dir}", { dir: direction });

    // Determine the target zone
    const currentZoneCoords = parseZoneCoords(zone.id);
    if (!currentZoneCoords) {
      gameLogger.error("Cannot parse current zone coords: {id}", { id: zone.id });
      transitioning = false;
      return;
    }

    const adjacent = adjacentZoneIds(currentZoneCoords);
    const targetZoneId = adjacent[direction] as ZoneId;

    // Check if the target zone is ready
    if (!zoneManager.isReady(targetZoneId)) {
      // Show loading gate while we wait for the zone
      if (loadingGate) {
        loadingGate.show(direction, zone);
        renderFrame();
      }

      gameLogger.info("Waiting for zone {id} to be ready", { id: targetZoneId });
      await zoneManager.ensureZone(targetZoneId);

      // Hide loading gate
      if (loadingGate) {
        loadingGate.hide();
      }
    }

    // Calculate where player appears in the new zone
    const newPos = oppositeEdgePosition(direction, px, py);

    // Perform the fade transition
    const zoneConfig = zoneManager.getConfig();
    await transitionManager.fadeTransition(
      () => {
        // This runs at the midpoint when screen is black

        // Activate the new zone (triggers preloadAdjacent + unloadDistant internally)
        // Note: activateZone is async but we fire-and-forget from the sync callback.
        // The zone is already ensured above, so this primarily updates internal state.
        zoneManager.activateZone(targetZoneId, direction).catch((err) => {
          gameLogger.error("Zone activation failed: {err}", {
            err: err instanceof Error ? err.message : String(err),
          });
        });

        // Get the new zone data for rendering
        const newZone = zoneManager.getZone(targetZoneId);
        if (newZone) {
          zone = zoneToZoneData(newZone);
          worldState.activeZoneId = targetZoneId;
        }

        // Reposition player at opposite edge
        px = newPos.x;
        py = newPos.y;

        // Update WorldState player position
        worldState.player.position.zone = targetZoneId;
        worldState.player.position.x = px;
        worldState.player.position.y = py;

        // Update discovered zones and stats
        if (!worldState.player.journal.discoveredZones.includes(targetZoneId)) {
          worldState.player.journal.discoveredZones.push(targetZoneId);
          worldState.player.stats.zonesExplored = worldState.player.journal.discoveredZones.length;
          gameLogger.info("Discovered new zone: {id}", { id: targetZoneId });
        }

        // Update camera and re-render
        viewport.updateCamera(px, py, zone.width, zone.height);
        tileRenderer.renderZone(zone, viewport, px, py);
        charRenderer.renderCharacters(characters, viewport);
        charRenderer.renderNameplates(characters, { x: px, y: py }, viewport);
      },
      {
        fadeOutMs: zoneConfig.transitionFadeOutMs,
        fadeInMs: zoneConfig.transitionFadeInMs,
      },
    );

    transitioning = false;
    updateMovementContext();
    renderFrame();

    gameLogger.info("Zone transition complete: now in {id} at ({x}, {y})", {
      id: zone.id,
      x: px,
      y: py,
    });
  }

  // ── Fast-travel handling ───────────────────────────────────

  async function handleFastTravel(targetZoneId: ZoneId): Promise<void> {
    if (!zoneManager || !transitionManager || transitioning) return;

    transitioning = true;
    gameLogger.info("Fast-travel started: target={id}", { id: targetZoneId });

    // Ensure the target zone is loaded (may need generation)
    if (!zoneManager.isReady(targetZoneId)) {
      gameLogger.info("Loading zone {id} for fast-travel", { id: targetZoneId });
      await zoneManager.ensureZone(targetZoneId);
    }

    // Determine spawn position (center of target zone)
    const targetZone = zoneManager.getZone(targetZoneId);
    if (!targetZone) {
      gameLogger.error("Fast-travel target zone {id} not found after loading", { id: targetZoneId });
      transitioning = false;
      return;
    }

    const targetZoneData = zoneToZoneData(targetZone);
    const spawnX = Math.floor(targetZoneData.width / 2);
    const spawnY = Math.floor(targetZoneData.height / 2);

    // Perform fade transition
    const zoneConfig = zoneManager.getConfig();
    await transitionManager.fadeTransition(
      () => {
        // Midpoint: swap zone data
        zoneManager.activateZone(targetZoneId).catch((err) => {
          gameLogger.error("Zone activation during fast-travel failed: {err}", {
            err: err instanceof Error ? err.message : String(err),
          });
        });

        zone = targetZoneData;
        worldState.activeZoneId = targetZoneId;

        px = spawnX;
        py = spawnY;

        worldState.player.position.zone = targetZoneId;
        worldState.player.position.x = px;
        worldState.player.position.y = py;

        // Update camera and re-render
        viewport.updateCamera(px, py, zone.width, zone.height);
        tileRenderer.renderZone(zone, viewport, px, py);
        charRenderer.renderCharacters(characters, viewport);
        charRenderer.renderNameplates(characters, { x: px, y: py }, viewport);
      },
      {
        fadeOutMs: zoneConfig.transitionFadeOutMs,
        fadeInMs: zoneConfig.transitionFadeInMs,
      },
    );

    transitioning = false;
    updateMovementContext();
    renderFrame();

    gameLogger.info("Fast-travel complete: now in {id} at ({x}, {y})", {
      id: zone.id,
      x: px,
      y: py,
    });
  }

  // ── Movement + rendering ────────────────────────────────────

  function updateMovementContext() {
    inputRouter.setMovementContext({
      playerX: px,
      playerY: py,
      characters,
      tryMove(dx: number, dy: number) {
        if (transitioning) return;

        const nx = px + dx;
        const ny = py + dy;

        // Check for zone edge crossing when ZoneManager is available
        if (zoneManager) {
          const edgeDirection = detectZoneEdgeCrossing(nx, ny);
          if (edgeDirection !== null) {
            // Trigger async zone transition — don't block the input handler
            handleZoneTransition(edgeDirection);
            return;
          }
        }

        // Normal within-zone movement
        if (!isCollision(zone, nx, ny) && !isCharacterAt(characters, nx, ny)) {
          px = nx;
          py = ny;
          // Keep WorldState player position in sync
          worldState.player.position.x = px;
          worldState.player.position.y = py;
          updateMovementContext();
          renderFrame();
        }
      },
    });
  }

  function renderFrame() {
    viewport.updateCamera(px, py, zone.width, zone.height);
    tileRenderer.renderZone(zone, viewport, px, py);
    charRenderer.renderCharacters(characters, viewport);
    charRenderer.renderNameplates(characters, { x: px, y: py }, viewport);

    // Render loading gate overlay if active
    if (loadingGate?.active) {
      loadingGate.render(
        fb.frameBuffer,
        viewport.cameraX,
        viewport.cameraY,
        viewport.viewWidth,
        viewport.viewHeight,
      );
    }

    renderer.requestRender();
  }

  renderer.root.add(fb);
  renderer.root.add(narrativeBar.container);
  updateMovementContext();
  renderFrame();
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  // Load settings and configure logging before anything else
  const settingsManager = new SettingsManager();
  settingsManager.load();

  await configureLogging({
    level: (settingsManager.get<string>("logging.level") as LogLevel) ?? "info",
    format: (settingsManager.get<string>("logging.format") as "text" | "json") ?? "text",
  });

  const logger = getLogger(["daydream", "game"]);
  logger.info("Daydream starting");

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useAlternateScreen: true,
    useMouse: false,
    targetFps: 15,
    maxFps: 30,
  });
  renderer.start();

  // Onboarding gate — ensure API key is configured before proceeding
  if (!settingsManager.hasApiKey("anthropic")) {
    const onboarding = new OnboardingScreen(renderer, settingsManager);
    await onboarding.show();
    onboarding.destroy();
  }

  // Title screen loop — returns to title after settings
  const titleScreen = new TitleScreen(renderer);
  let playerPrompt: string;
  while (true) {
    const result: TitleScreenResult = await titleScreen.show();
    if (result.type === "settings") {
      titleScreen.destroy();
      const settingsScreen = new SettingsScreen(renderer, settingsManager);
      settingsScreen.setOnLoggingChange(() => {
        configureLogging({
          level: (settingsManager.get<string>("logging.level") as LogLevel) ?? "info",
          format: (settingsManager.get<string>("logging.format") as "text" | "json") ?? "text",
        });
      });
      await settingsScreen.show();
      settingsScreen.destroy();
      // If user deleted their key in settings, re-run onboarding
      if (!settingsManager.hasApiKey("anthropic")) {
        const onboarding = new OnboardingScreen(renderer, settingsManager);
        await onboarding.show();
        onboarding.destroy();
      }
      continue;
    }
    playerPrompt = result.value;
    break;
  }
  titleScreen.destroy();

  // Generate world — API key is guaranteed at this point
  logger.info("Generating world from prompt: {prompt}", { prompt: playerPrompt });
  const loadingScreen = new LoadingScreen(renderer);
  loadingScreen.show();

  let zone: ZoneData;
  let characters: Character[];
  let spawnX: number;
  let spawnY: number;
  let aiClient: AIClient | undefined;
  let worldSeed: WorldSeed | undefined;
  let generator: WorldGenerator | undefined;

  try {
    aiClient = new AIClient({ apiKey: settingsManager.getApiKey("anthropic") });
    generator = new WorldGenerator(
      aiClient,
      toBuildingVisuals(),
      toObjectVisuals(),
    );

    const world = await generator.generate(playerPrompt, (status) => {
      loadingScreen.setStatus(status);
    });

    zone = world.zone;
    worldSeed = world.seed;
    spawnX = world.zone.spawnPoint.x;
    spawnY = world.zone.spawnPoint.y;

    // Convert AI characters to engine characters
    characters = world.characters.map((c) => toCharacter(c, world.zone.id, "gen_world"));

    // Clear collision at character positions
    const collisionLayer = zone.layers.find((l) => l.name === "collision");
    const objectsLayer = zone.layers.find((l) => l.name === "objects");
    if (collisionLayer && objectsLayer) {
      for (const c of characters) {
        const idx = c.state.position.y * zone.width + c.state.position.x;
        collisionLayer.data[idx] = { char: "0", fg: "#000000" };
        objectsLayer.data[idx] = { char: "", fg: "#000000" };
      }
    }

    loadingScreen.destroy();
  } catch (err) {
    logger.error("World generation failed, falling back to test zone", {
      prompt: playerPrompt,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    loadingScreen.setStatus("Generation failed — loading demo world...");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    loadingScreen.destroy();

    zone = buildTestZone();
    characters = buildTestCharacters(zone);
    spawnX = 5;
    spawnY = 10;
  }

  logger.info("Gameplay started in zone {zoneId} at ({x}, {y})", {
    zoneId: zone.id,
    x: spawnX,
    y: spawnY,
    characterCount: characters.length,
  });

  // Build WorldState with real world seed if available
  const worldId = "world_" + Date.now();
  const worldState = new WorldState({
    worldId,
    worldSeed: worldSeed ?? {
      originalPrompt: playerPrompt,
      setting: { name: "Unknown", type: "wilderness", era: "medieval", tone: "mysterious", description: "" },
      biomeMap: {
        center: {
          type: "forest",
          terrain: { primary: "grass", secondary: "dirt", features: [] },
          palette: {
            ground: { chars: ["."], fg: ["#4a7a4a"], bg: "#1a2a1a" },
            vegetation: {},
          },
          density: { vegetation: 0.5, structures: 0.1, characters: 0.05 },
          ambient: { lighting: "natural" },
        },
        distribution: { type: "single", seed: 0, biomes: { forest: 1 } },
      },
      initialNarrative: { hooks: [], mainTension: "", atmosphere: "" },
      worldRules: { hasMagic: false, techLevel: "medieval", economy: "barter", dangers: [], customs: [] },
    },
    createdAt: Date.now(),
    player: {
      position: { zone: zone.id, x: spawnX, y: spawnY },
      facing: "down",
      inventory: [],
      journal: { entries: [], knownCharacters: [], discoveredZones: [zone.id], activeQuests: [] },
      stats: { totalPlayTime: 0, conversationsHad: 0, zonesExplored: 1, daysSurvived: 0 },
    },
    activeZoneId: zone.id,
  });

  // Wire up ZoneManager when we have a generator and world seed
  let zoneManager: ZoneManager | undefined;
  if (worldSeed && generator) {
    const saveManager = new SaveManager(worldId);
    const zoneStore = createZoneStore(saveManager, worldState);
    const zoneGeneratorFn = createZoneGeneratorFn(generator);

    zoneManager = new ZoneManager({
      worldSeed,
      zoneGenerator: zoneGeneratorFn,
      zoneStore,
    });

    // Register the initial zone with ZoneManager by converting ZoneData to Zone
    // and storing it so ZoneManager knows about it
    const initialZone: Zone = {
      id: zone.id as ZoneId,
      coords: parseZoneCoords(zone.id as ZoneId) ?? { x: 0, y: 0 },
      biome: worldSeed.biomeMap.center,
      tiles: zone.layers as any,
      characters: characters.map((c) => c.id),
      buildings: [],
      objects: [],
      exits: [],
      generated: true,
      generationSeed: worldSeed.originalPrompt,
      lastVisited: Date.now(),
      metadata: {
        name: worldSeed.setting.name,
        description: worldSeed.setting.description,
      },
    };

    // Store in WorldState so the zone store can find it
    worldState.zones.set(initialZone.id as ZoneId, initialZone);

    // Activate the initial zone (sets it as active, triggers preloading of neighbors)
    await zoneManager.activateZone(initialZone.id as ZoneId);
    logger.info("ZoneManager initialized, initial zone activated with preloading");
  }

  startGameplay({
    renderer,
    zone,
    characters,
    playerX: spawnX,
    playerY: spawnY,
    aiClient,
    zoneManager,
    worldState,
  });
}

main().catch(console.error);
