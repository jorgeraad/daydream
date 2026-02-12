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
  forestPalette,
  buildingTemplates,
  objectGlyphs,
  characterPresets,
  biomePalettes,
} from "@daydream/renderer";
import { EventBus } from "@daydream/engine";
import type { Character } from "@daydream/engine";
import type { ZoneData, TileCell, TileLayer } from "@daydream/renderer";
import type { BuildingVisual, ObjectVisual, ZoneBuildResult } from "@daydream/engine";
import { AIClient } from "@daydream/ai";
import { InputRouter } from "./InputRouter.ts";
import { TitleScreen } from "./TitleScreen.ts";
import type { TitleScreenResult } from "./TitleScreen.ts";
import { WorldGenerator, type ZoneCharacter } from "./WorldGenerator.ts";
import { SettingsManager } from "./settings/SettingsManager.ts";
import { SettingsScreen } from "./settings/SettingsScreen.ts";
import { OnboardingScreen } from "./OnboardingScreen.ts";

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

function startGameplay(
  renderer: Awaited<ReturnType<typeof createCliRenderer>>,
  zone: ZoneData,
  characters: Character[],
  playerX: number,
  playerY: number,
): void {
  const eventBus = new EventBus();
  const inputRouter = new InputRouter(eventBus);

  eventBus.on("character:interact", ({ characterId }) => {
    const char = characters.find((c) => c.id === characterId);
    if (char) {
      // eslint-disable-next-line no-console
      console.log(`\x1b[33m[Interact] ${char.identity.name}: "Hello, traveler!"\x1b[0m`);
    }
  });

  const viewW = renderer.terminalWidth;
  const viewH = renderer.terminalHeight;
  const viewport = new ViewportManager(viewW, viewH);

  let px = playerX;
  let py = playerY;

  const fb = new FrameBufferRenderable(renderer, {
    id: "viewport",
    width: viewW,
    height: viewH,
    onKeyDown(key) {
      inputRouter.handleKey(key);
    },
  });

  fb.focusable = true;
  fb.focus();

  const tileRenderer = new TileRenderer(fb.frameBuffer);
  const charRenderer = new CharacterRenderer(fb.frameBuffer);

  function updateMovementContext() {
    inputRouter.setMovementContext({
      playerX: px,
      playerY: py,
      characters,
      tryMove(dx: number, dy: number) {
        const nx = px + dx;
        const ny = py + dy;
        if (!isCollision(zone, nx, ny) && !isCharacterAt(characters, nx, ny)) {
          px = nx;
          py = ny;
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
    renderer.requestRender();
  }

  renderer.root.add(fb);
  updateMovementContext();
  renderFrame();
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useAlternateScreen: true,
    targetFps: 15,
    maxFps: 30,
  });
  renderer.auto();

  // Load settings
  const settingsManager = new SettingsManager();
  settingsManager.load();

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
  const loadingScreen = new LoadingScreen(renderer);
  loadingScreen.show();

  let zone: ZoneData;
  let characters: Character[];
  let spawnX: number;
  let spawnY: number;

  try {
    const aiClient = new AIClient({ apiKey: settingsManager.getApiKey("anthropic") });
    const generator = new WorldGenerator(
      aiClient,
      toBuildingVisuals(),
      toObjectVisuals(),
    );

    const world = await generator.generate(playerPrompt, (status) => {
      loadingScreen.setStatus(status);
    });

    zone = world.zone;
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
    loadingScreen.destroy();
    // Fall back to test zone on generation failure
    zone = buildTestZone();
    characters = buildTestCharacters(zone);
    spawnX = 5;
    spawnY = 10;
  }

  startGameplay(renderer, zone, characters, spawnX, spawnY);
}

main().catch(console.error);
