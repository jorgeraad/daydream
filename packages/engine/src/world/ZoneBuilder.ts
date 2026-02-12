import type { BiomePalette, TileCell, TileLayer } from "../types.ts";

// ── Input types (matches AI ZoneSpec shape without importing from @daydream/ai) ──

export interface ZoneBuildSpec {
  terrain: {
    primaryGround: string;
    features: Array<{ type: string; description: string }>;
  };
  buildings: Array<{
    name: string;
    type: string;
    width: number;
    height: number;
    position: { x: number; y: number };
  }>;
  objects: Array<{
    type: string;
    position: { x: number; y: number };
  }>;
}

export interface BuildingVisual {
  border: { tl: string; tr: string; bl: string; br: string; h: string; v: string };
  door: string;
  fill: string;
  defaultFg: string;
  doorFg: string;
}

export interface ObjectVisual {
  char: string;
  fg: string;
  bold?: boolean;
  collision: boolean;
}

export interface ZoneBuildResult {
  id: string;
  width: number;
  height: number;
  layers: TileLayer[];
  spawnPoint: { x: number; y: number };
}

// ── Constants ────────────────────────────────────────────────

const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 40;

const EMPTY: TileCell = { char: "", fg: "#000000" };
const PASSABLE: TileCell = { char: "0", fg: "#000000" };
const BLOCKED: TileCell = { char: "1", fg: "#000000" };

// ── ZoneBuilder ──────────────────────────────────────────────

export class ZoneBuilder {
  constructor(
    private buildingVisuals: Record<string, BuildingVisual>,
    private objectVisuals: Record<string, ObjectVisual>,
  ) {}

  build(
    spec: ZoneBuildSpec,
    zoneId: string,
    palette: BiomePalette,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
  ): ZoneBuildResult {
    const ground: TileCell[] = new Array(width * height);
    const objects: TileCell[] = new Array(width * height);
    const collision: TileCell[] = new Array(width * height);

    // 1. Fill ground
    for (let i = 0; i < width * height; i++) {
      ground[i] = this.randomGroundTile(palette);
      objects[i] = EMPTY;
      collision[i] = PASSABLE;
    }

    // 2. Terrain features (paths, water, clearings)
    for (const feature of spec.terrain.features) {
      this.placeFeature(feature, ground, collision, width, height, palette);
    }

    // 3. Buildings
    for (const building of spec.buildings) {
      this.placeBuilding(building, objects, collision, ground, width, height);
    }

    // 4. Objects (trees, rocks, signs, etc.)
    for (const obj of spec.objects) {
      this.placeObject(obj, objects, collision, width, height, palette);
    }

    // 5. Find a clear spawn point near center
    const spawnPoint = this.findSpawnPoint(collision, width, height);
    // Ensure spawn is passable
    const spawnIdx = spawnPoint.y * width + spawnPoint.x;
    objects[spawnIdx] = EMPTY;
    collision[spawnIdx] = PASSABLE;

    const layers: TileLayer[] = [
      { name: "ground", data: ground, width, height },
      { name: "objects", data: objects, width, height },
      { name: "collision", data: collision, width, height },
    ];

    return { id: zoneId, width, height, layers, spawnPoint };
  }

  // ── Ground ──────────────────────────────────────────────

  private randomGroundTile(palette: BiomePalette): TileCell {
    return {
      char: pick(palette.ground.chars),
      fg: pick(palette.ground.fg),
      bg: palette.ground.bg,
    };
  }

  // ── Terrain Features ────────────────────────────────────

  private placeFeature(
    feature: { type: string; description: string },
    ground: TileCell[],
    collision: TileCell[],
    w: number,
    h: number,
    palette: BiomePalette,
  ): void {
    const type = feature.type.toLowerCase();

    if ((type.includes("path") || type.includes("road") || type.includes("trail")) && palette.path) {
      this.placePath(ground, w, h, palette);
    } else if (type.includes("water") || type.includes("pond") || type.includes("lake")) {
      if (palette.water) this.placePond(ground, collision, w, h, palette);
    } else if (type.includes("river") || type.includes("stream")) {
      if (palette.water) this.placeRiver(ground, collision, w, h, palette);
    } else if (type.includes("clearing") || type.includes("open")) {
      // Clearings are implicit — the ground is already clear
    } else if (type.includes("rock") || type.includes("stone")) {
      this.placeRockyArea(ground, collision, w, h);
    }
  }

  private placePath(ground: TileCell[], w: number, h: number, palette: BiomePalette): void {
    if (!palette.path) return;
    // Winding east-west path
    let y = Math.floor(h * 0.3) + Math.floor(Math.random() * Math.floor(h * 0.4));
    for (let x = 0; x < w; x++) {
      if (x % 7 === 0) y += Math.random() > 0.5 ? 1 : -1;
      y = Math.max(2, Math.min(h - 3, y));
      for (let dy = 0; dy < 2; dy++) {
        const py = y + dy;
        if (py >= 0 && py < h) {
          ground[py * w + x] = {
            char: pick(palette.path.chars),
            fg: palette.path.fg,
            bg: palette.path.bg,
          };
        }
      }
    }
  }

  private placePond(
    ground: TileCell[],
    collision: TileCell[],
    w: number,
    h: number,
    palette: BiomePalette,
  ): void {
    if (!palette.water) return;
    const cx = Math.floor(w * 0.2) + Math.floor(Math.random() * Math.floor(w * 0.6));
    const cy = Math.floor(h * 0.3) + Math.floor(Math.random() * Math.floor(h * 0.4));
    const rx = 3 + Math.floor(Math.random() * 5);
    const ry = 2 + Math.floor(Math.random() * 3);

    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy < 1) {
          const idx = y * w + x;
          ground[idx] = {
            char: pick(palette.water.chars),
            fg: pick(palette.water.fg),
            bg: palette.water.bg,
          };
          collision[idx] = BLOCKED;
        }
      }
    }
  }

  private placeRiver(
    ground: TileCell[],
    collision: TileCell[],
    w: number,
    h: number,
    palette: BiomePalette,
  ): void {
    if (!palette.water) return;
    // North-south meandering river
    let x = Math.floor(w * 0.3) + Math.floor(Math.random() * Math.floor(w * 0.4));
    for (let y = 0; y < h; y++) {
      if (y % 5 === 0) x += Math.random() > 0.5 ? 1 : -1;
      x = Math.max(1, Math.min(w - 3, x));
      for (let dx = 0; dx < 2; dx++) {
        const px = x + dx;
        if (px >= 0 && px < w) {
          const idx = y * w + px;
          ground[idx] = {
            char: pick(palette.water.chars),
            fg: pick(palette.water.fg),
            bg: palette.water.bg,
          };
          collision[idx] = BLOCKED;
        }
      }
    }
  }

  private placeRockyArea(
    ground: TileCell[],
    collision: TileCell[],
    w: number,
    h: number,
  ): void {
    const cx = Math.floor(w * 0.6) + Math.floor(Math.random() * Math.floor(w * 0.3));
    const cy = Math.floor(h * 0.2) + Math.floor(Math.random() * Math.floor(h * 0.6));
    const radius = 5 + Math.floor(Math.random() * 5);

    for (let i = 0; i < 12; i++) {
      const x = cx + Math.floor((Math.random() - 0.5) * radius * 2);
      const y = cy + Math.floor((Math.random() - 0.5) * radius);
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const idx = y * w + x;
      ground[idx] = { char: pick(["·", ":", "∙"]), fg: "#7a7a7a", bg: "#3a3a3a" };
      collision[idx] = BLOCKED;
    }
  }

  // ── Buildings ───────────────────────────────────────────

  private placeBuilding(
    building: ZoneBuildSpec["buildings"][0],
    objects: TileCell[],
    collision: TileCell[],
    ground: TileCell[],
    w: number,
    h: number,
  ): void {
    const tpl = this.buildingVisuals[building.type] ?? this.buildingVisuals["house"];
    if (!tpl) return;

    const bx = Math.max(0, Math.min(building.position.x, w - building.width));
    const by = Math.max(0, Math.min(building.position.y, h - building.height));
    const bw = Math.min(building.width, 8);
    const bh = Math.min(building.height, 5);

    for (let y = by; y < by + bh && y < h; y++) {
      for (let x = bx; x < bx + bw && x < w; x++) {
        const idx = y * w + x;
        const isTop = y === by;
        const isBottom = y === by + bh - 1;
        const isLeft = x === bx;
        const isRight = x === bx + bw - 1;

        if (isTop && isLeft) {
          objects[idx] = { char: tpl.border.tl, fg: tpl.defaultFg };
        } else if (isTop && isRight) {
          objects[idx] = { char: tpl.border.tr, fg: tpl.defaultFg };
        } else if (isBottom && isLeft) {
          objects[idx] = { char: tpl.border.bl, fg: tpl.defaultFg };
        } else if (isBottom && isRight) {
          objects[idx] = { char: tpl.border.br, fg: tpl.defaultFg };
        } else if (isTop || isBottom) {
          objects[idx] = { char: tpl.border.h, fg: tpl.defaultFg };
        } else if (isLeft || isRight) {
          objects[idx] = { char: tpl.border.v, fg: tpl.defaultFg };
        } else {
          // Interior
          ground[idx] = { char: tpl.fill, fg: "#4a3a28", bg: "#3a2a18" };
        }
        collision[idx] = BLOCKED;
      }
    }

    // Door at bottom center
    const doorX = bx + Math.floor(bw / 2);
    if (doorX < w && by + bh - 1 < h) {
      const doorIdx = (by + bh - 1) * w + doorX;
      objects[doorIdx] = { char: tpl.door, fg: tpl.doorFg };
      collision[doorIdx] = PASSABLE;
    }
  }

  // ── Objects ─────────────────────────────────────────────

  private placeObject(
    obj: ZoneBuildSpec["objects"][0],
    objects: TileCell[],
    collision: TileCell[],
    w: number,
    h: number,
    palette: BiomePalette,
  ): void {
    const { x, y } = obj.position;
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    if (collision[y * w + x]!.char === "1") return; // Already blocked

    const idx = y * w + x;
    const type = obj.type.toLowerCase();

    // Try exact match in object visuals
    const visual = this.objectVisuals[type]
      ?? this.objectVisuals[normalizeObjectType(type)];

    if (visual) {
      objects[idx] = { char: visual.char, fg: visual.fg, bold: visual.bold };
      if (visual.collision) collision[idx] = BLOCKED;
      return;
    }

    // Try matching to vegetation from the palette
    const vegKey = findVegetationMatch(type, palette);
    if (vegKey) {
      const veg = palette.vegetation[vegKey]!;
      const char = veg.variants ? pick([veg.char, ...veg.variants]) : veg.char;
      objects[idx] = { char, fg: veg.fg, bold: true };
      collision[idx] = BLOCKED;
      return;
    }

    // Fallback: generic object marker
    objects[idx] = { char: "◦", fg: "#888888" };
  }

  // ── Spawn Point ─────────────────────────────────────────

  private findSpawnPoint(
    collision: TileCell[],
    w: number,
    h: number,
  ): { x: number; y: number } {
    // Start from center, spiral outward to find passable cell
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);

    for (let radius = 0; radius < Math.max(w, h); radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x < 1 || x >= w - 1 || y < 1 || y >= h - 1) continue;
          if (collision[y * w + x]!.char !== "1") {
            return { x, y };
          }
        }
      }
    }

    return { x: cx, y: cy };
  }
}

// ── Helpers ──────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Map common AI object type strings to objectGlyphs keys */
function normalizeObjectType(type: string): string {
  const map: Record<string, string> = {
    tree: "tree_oak",
    pine: "tree_pine",
    oak: "tree_oak",
    "dead tree": "tree_dead",
    rock: "rock_large",
    boulder: "boulder",
    stone: "rock_small",
    sign: "sign",
    signpost: "sign",
    chest: "chest",
    barrel: "barrel",
    crate: "barrel",
    pot: "pot",
    table: "table",
    chair: "chair",
    bed: "bed",
    well: "rock_large",
    post: "post",
    fence: "post",
  };
  return map[type] ?? type;
}

/** Find the closest matching vegetation key in the palette */
function findVegetationMatch(type: string, palette: BiomePalette): string | undefined {
  const keys = Object.keys(palette.vegetation);

  // Exact key match
  if (keys.includes(type)) return type;

  // Substring match
  for (const key of keys) {
    if (type.includes(key) || key.includes(type)) return key;
  }

  // Common synonyms
  if (type.includes("tree")) return keys.find((k) => k.includes("tree") || k.includes("canopy"));
  if (type.includes("bush") || type.includes("shrub")) return keys.find((k) => k.includes("bush") || k.includes("hedge") || k.includes("scrub"));
  if (type.includes("flower")) return keys.find((k) => k.includes("flower"));

  return undefined;
}
