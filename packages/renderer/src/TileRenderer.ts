import { RGBA, TextAttributes } from "@opentui/core";
import type { ZoneData, TileCell, TileLayer } from "./types.ts";
import type { ViewportManager } from "./ViewportManager.ts";

export class TileRenderer {
  private buffer: import("@opentui/core").OptimizedBuffer;

  constructor(buffer: import("@opentui/core").OptimizedBuffer) {
    this.buffer = buffer;
  }

  renderZone(
    zone: ZoneData,
    viewport: ViewportManager,
    playerX: number,
    playerY: number,
  ): void {
    const { cameraX, cameraY, viewWidth, viewHeight } = viewport;
    const bg = RGBA.fromHex("#000000");

    this.buffer.clear(bg);

    // Render layers in order: ground, objects, overlay
    const layerOrder: TileLayer["name"][] = ["ground", "objects", "overlay"];
    for (const layerName of layerOrder) {
      const layer = zone.layers.find((l) => l.name === layerName);
      if (layer) {
        this.renderLayer(layer, cameraX, cameraY, viewWidth, viewHeight);
      }
    }

    // Render player
    this.renderPlayer(playerX, playerY, viewport);
  }

  private renderLayer(
    layer: TileLayer,
    cameraX: number,
    cameraY: number,
    viewWidth: number,
    viewHeight: number,
  ): void {
    for (let sy = 0; sy < viewHeight; sy++) {
      for (let sx = 0; sx < viewWidth; sx++) {
        const wx = sx + cameraX;
        const wy = sy + cameraY;

        if (wx < 0 || wx >= layer.width || wy < 0 || wy >= layer.height) {
          continue;
        }

        const tile = layer.data[wy * layer.width + wx];
        if (!tile || !tile.char || tile.char === " ") continue;

        const fg = RGBA.fromHex(tile.fg);
        const bg = tile.bg ? RGBA.fromHex(tile.bg) : RGBA.fromHex("#000000");
        let attrs = TextAttributes.NONE;
        if (tile.bold) attrs |= TextAttributes.BOLD;
        if (tile.dim) attrs |= TextAttributes.DIM;

        this.buffer.setCell(sx, sy, tile.char, fg, bg, attrs);
      }
    }
  }

  private renderPlayer(
    playerX: number,
    playerY: number,
    viewport: ViewportManager,
  ): void {
    const pos = viewport.worldToScreen(playerX, playerY);
    if (!pos) return;

    const fg = RGBA.fromHex("#ffffff");
    const bg = RGBA.fromHex("#000000");
    this.buffer.setCell(pos.x, pos.y, "@", fg, bg, TextAttributes.BOLD);
  }
}

export function isCollision(zone: ZoneData, x: number, y: number): boolean {
  if (x < 0 || x >= zone.width || y < 0 || y >= zone.height) {
    return true;
  }

  const collisionLayer = zone.layers.find((l) => l.name === "collision");
  if (!collisionLayer) return false;

  const cell = collisionLayer.data[y * collisionLayer.width + x];
  return cell?.char === "1";
}
