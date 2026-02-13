import {
  BoxRenderable,
  FrameBufferRenderable,
  OptimizedBuffer,
  RGBA,
  type CliRenderer,
} from "@opentui/core";
import { biomePalettes } from "../palettes/biomes.ts";

// ── Configuration ─────────────────────────────────────────────

/** How many FrameBuffer cells each zone occupies on the mini-map. */
const ZONE_CELL_SIZE = 3;

/** Default dark background for unexplored / empty areas. */
const BG_COLOR = "#1a1a2e";

/** Highlight color for the current zone border. */
const CURRENT_ZONE_BORDER_COLOR = "#ffdd57";

/** Player indicator color (bright white). */
const PLAYER_COLOR = "#ffffff";

/** Fallback zone color when biome is unknown. */
const UNKNOWN_BIOME_COLOR = "#3a3a5e";

// ── Types ─────────────────────────────────────────────────────

/** Information about a single explored zone shown on the mini-map. */
export interface MiniMapZone {
  /** Zone ID in "zone_X_Y" format. */
  id: string;
  /** Zone grid coordinates (parsed from zone ID). */
  coords: { x: number; y: number };
  /** Biome type string (e.g., "forest", "desert", "town"). */
  biome: string;
}

/** Complete state needed to render the mini-map. */
export interface MiniMapState {
  /** All explored zones. */
  zones: MiniMapZone[];
  /** ID of the current zone (highlighted). */
  currentZoneId: string;
  /** Player position within the current zone (tile coordinates). */
  playerPosition: { x: number; y: number };
  /** Current zone dimensions (for computing player dot position within zone cell). */
  zoneSize: { width: number; height: number };
}

// ── Pure helper functions (exported for testing) ──────────────

/**
 * Map a biome type string to a hex color for mini-map display.
 * Uses the biome palette's ground.bg as the base, which represents
 * the dominant terrain color for that biome.
 */
export function biomeToColor(biome: string): string {
  const palette = biomePalettes[biome];
  if (palette) {
    return palette.ground.bg;
  }
  return UNKNOWN_BIOME_COLOR;
}

/**
 * Brighten a hex color by the given factor (1.0 = no change, 2.0 = double brightness).
 * Used to make the current zone stand out.
 */
export function brightenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, Math.round(r * factor));
  const ng = Math.min(255, Math.round(g * factor));
  const nb = Math.min(255, Math.round(b * factor));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

/**
 * Compute the FrameBuffer pixel coordinates for a zone, given:
 * - The zone's world grid coordinates
 * - The camera center (typically the current zone's coords)
 * - The FrameBuffer dimensions
 *
 * Returns the top-left corner of the zone cell in FrameBuffer space,
 * or null if the zone falls outside the visible area.
 */
export function worldToMap(
  zoneCoords: { x: number; y: number },
  cameraCenter: { x: number; y: number },
  bufferWidth: number,
  bufferHeight: number,
): { x: number; y: number } | null {
  // How many zone cells fit in each dimension
  const cellsX = Math.floor(bufferWidth / ZONE_CELL_SIZE);
  const cellsY = Math.floor(bufferHeight / ZONE_CELL_SIZE);

  // Pixel offset to center the grid in the buffer
  const gridPixelWidth = cellsX * ZONE_CELL_SIZE;
  const gridPixelHeight = cellsY * ZONE_CELL_SIZE;
  const offsetX = Math.floor((bufferWidth - gridPixelWidth) / 2);
  const offsetY = Math.floor((bufferHeight - gridPixelHeight) / 2);

  // Zone position relative to camera center
  const relX = zoneCoords.x - cameraCenter.x;
  const relY = zoneCoords.y - cameraCenter.y;

  // Cell index in the visible grid (center cell = floor(cells/2))
  const cellX = Math.floor(cellsX / 2) + relX;
  const cellY = Math.floor(cellsY / 2) + relY;

  // Out of visible range?
  if (cellX < 0 || cellX >= cellsX || cellY < 0 || cellY >= cellsY) {
    return null;
  }

  return {
    x: offsetX + cellX * ZONE_CELL_SIZE,
    y: offsetY + cellY * ZONE_CELL_SIZE,
  };
}

/**
 * Compute the pixel position of the player dot within a zone cell.
 * Maps the player's tile position to a sub-cell offset within the
 * ZONE_CELL_SIZE x ZONE_CELL_SIZE block.
 *
 * Returns {dx, dy} offset from the zone cell's top-left corner.
 */
export function playerDotOffset(
  playerPos: { x: number; y: number },
  zoneWidth: number,
  zoneHeight: number,
): { dx: number; dy: number } {
  // Map player tile coords to the inner area of the cell (1 pixel border for highlight)
  // Inner area is (ZONE_CELL_SIZE - 2) x (ZONE_CELL_SIZE - 2), starting at offset (1,1)
  const innerSize = ZONE_CELL_SIZE - 2;
  if (innerSize <= 0) {
    // Cell too small for inner positioning; place at center
    return {
      dx: Math.floor(ZONE_CELL_SIZE / 2),
      dy: Math.floor(ZONE_CELL_SIZE / 2),
    };
  }

  const dx =
    1 +
    Math.min(
      innerSize - 1,
      Math.max(0, Math.floor((playerPos.x / Math.max(1, zoneWidth)) * innerSize)),
    );
  const dy =
    1 +
    Math.min(
      innerSize - 1,
      Math.max(0, Math.floor((playerPos.y / Math.max(1, zoneHeight)) * innerSize)),
    );
  return { dx, dy };
}

// ── MiniMap Component ────────────────────────────────────────

export class MiniMap {
  readonly container: BoxRenderable;
  readonly buffer: FrameBufferRenderable;
  private state: MiniMapState | null = null;

  constructor(renderer: CliRenderer) {
    this.container = new BoxRenderable(renderer, {
      id: "minimap-container",
      height: 10,
      border: true,
      borderStyle: "single",
      borderColor: "#555555",
      title: " Map ",
    });

    this.buffer = new FrameBufferRenderable(renderer, {
      id: "minimap-fb",
      width: 16,
      height: 8,
    });

    this.buffer.frameBuffer.clear(RGBA.fromHex(BG_COLOR));

    this.container.add(this.buffer);
  }

  /**
   * Update the mini-map with new state and re-render.
   * Call this whenever the player moves to a new zone, a new zone is explored,
   * or the player moves within the current zone.
   */
  update(state: MiniMapState): void {
    this.state = state;
    this.render();
  }

  // ── Private rendering ───────────────────────────────────────

  private render(): void {
    const fb = this.buffer.frameBuffer;
    const bgRGBA = RGBA.fromHex(BG_COLOR);

    // Clear the entire buffer to the dark background (unexplored = blank/dark)
    fb.clear(bgRGBA);

    if (!this.state || this.state.zones.length === 0) {
      return;
    }

    const { zones, currentZoneId, playerPosition, zoneSize } = this.state;

    // Find the current zone's coords for camera centering
    const currentZone = zones.find((z) => z.id === currentZoneId);
    if (!currentZone) return;

    const cameraCenter = currentZone.coords;
    const bufW = fb.width;
    const bufH = fb.height;

    // Render each explored zone as a colored cell
    for (const zone of zones) {
      const pos = worldToMap(zone.coords, cameraCenter, bufW, bufH);
      if (!pos) continue; // off-screen

      const isCurrent = zone.id === currentZoneId;
      const baseColor = biomeToColor(zone.biome);

      if (isCurrent) {
        // Draw bright border around current zone
        this.drawCurrentZoneCell(fb, pos.x, pos.y, baseColor);
      } else {
        // Draw a simple filled cell for explored zones
        this.drawZoneCell(fb, pos.x, pos.y, baseColor);
      }
    }

    // Draw player indicator on top of the current zone cell
    if (currentZone) {
      const cellPos = worldToMap(
        currentZone.coords,
        cameraCenter,
        bufW,
        bufH,
      );
      if (cellPos) {
        const { dx, dy } = playerDotOffset(
          playerPosition,
          zoneSize.width,
          zoneSize.height,
        );
        const px = cellPos.x + dx;
        const py = cellPos.y + dy;
        if (px >= 0 && px < bufW && py >= 0 && py < bufH) {
          fb.setCell(
            px,
            py,
            "@",
            RGBA.fromHex(PLAYER_COLOR),
            RGBA.fromHex(brightenColor(biomeToColor(currentZone.biome), 1.6)),
          );
        }
      }
    }
  }

  /** Draw a zone cell as a filled rectangle with the biome color. */
  private drawZoneCell(
    fb: OptimizedBuffer,
    x: number,
    y: number,
    color: string,
  ): void {
    const rgba = RGBA.fromHex(color);
    const fillChar = " ";
    for (let dy = 0; dy < ZONE_CELL_SIZE; dy++) {
      for (let dx = 0; dx < ZONE_CELL_SIZE; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < fb.width && py >= 0 && py < fb.height) {
          fb.setCell(px, py, fillChar, rgba, rgba);
        }
      }
    }
  }

  /** Draw the current zone cell with a highlighted border. */
  private drawCurrentZoneCell(
    fb: OptimizedBuffer,
    x: number,
    y: number,
    baseColor: string,
  ): void {
    const borderRGBA = RGBA.fromHex(CURRENT_ZONE_BORDER_COLOR);
    const fillRGBA = RGBA.fromHex(brightenColor(baseColor, 1.6));
    const fillChar = " ";

    for (let dy = 0; dy < ZONE_CELL_SIZE; dy++) {
      for (let dx = 0; dx < ZONE_CELL_SIZE; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || px >= fb.width || py < 0 || py >= fb.height) continue;

        const isBorder =
          dx === 0 ||
          dx === ZONE_CELL_SIZE - 1 ||
          dy === 0 ||
          dy === ZONE_CELL_SIZE - 1;

        if (isBorder) {
          fb.setCell(px, py, fillChar, borderRGBA, borderRGBA);
        } else {
          fb.setCell(px, py, fillChar, fillRGBA, fillRGBA);
        }
      }
    }
  }
}
