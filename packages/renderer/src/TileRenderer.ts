import type { OptimizedBuffer } from "@opentui/core";
import type { ZoneData, TileCell, TileLayer } from "./types.ts";
import type { ViewportManager } from "./ViewportManager.ts";
import type { SpriteTemplate, SpriteInstance } from "./sprites/types.ts";
import { PixelBuffer } from "./sprites/PixelBuffer.ts";
import { SpriteRegistry } from "./sprites/SpriteRegistry.ts";
import { encodeHalfBlocks } from "./sprites/encode.ts";
import { resolveGroundTexture } from "./palettes/ground-textures.ts";

/** Default background color for transparent / empty pixels */
const DEFAULT_BG = "#000000";

/** Player sprite template ID in the built-in library */
const PLAYER_SPRITE_ID = "player_default";

/**
 * Optional color transform callback for animation integration.
 * Applied to the PixelBuffer after all sprite compositing but before
 * half-block encoding. Can modify pixel colors in-place for effects
 * like day/night tinting, flash effects, etc.
 */
export type ColorTransform = (pixelBuffer: PixelBuffer) => void;

export class TileRenderer {
  private buffer: OptimizedBuffer;
  private registry: SpriteRegistry;
  private pixelBuffer: PixelBuffer;

  /**
   * Optional color transform applied to the PixelBuffer before encoding.
   * Set this to integrate animation / atmosphere effects.
   */
  colorTransform: ColorTransform | null = null;

  constructor(buffer: OptimizedBuffer, registry: SpriteRegistry) {
    this.buffer = buffer;
    this.registry = registry;

    // PixelBuffer dimensions come from the buffer's cell dimensions.
    // buffer.width = cell columns, buffer.height = cell rows.
    // PixelBuffer constructor takes (cellWidth, cellHeight) and internally
    // doubles the height for pixel resolution.
    this.pixelBuffer = new PixelBuffer(buffer.width, buffer.height);
  }

  renderZone(
    zone: ZoneData,
    viewport: ViewportManager,
    playerX: number,
    playerY: number,
  ): void {
    const { cameraX, cameraY, viewWidth, viewHeight } = viewport;
    const biomeType = zone.biomeType ?? "forest";

    // 1. Clear pixel buffer
    this.pixelBuffer.clear(null);

    // 2. Render ground layer as pixel colors
    this.renderGroundPixels(zone, cameraX, cameraY, viewWidth, viewHeight, biomeType);

    // 3. Render objects/overlay layers as pixel-colored cells (backward compat)
    this.renderCharLayers(zone, cameraX, cameraY, viewWidth, viewHeight, biomeType);

    // 4. Collect visible sprites, compute screen pixel coords
    const visibleSprites = this.collectVisibleSprites(
      zone.sprites ?? [],
      cameraX,
      cameraY,
      viewWidth,
      viewHeight,
    );

    // 5. Y-sort: ascending by anchor tile Y (back-to-front depth)
    visibleSprites.sort((a, b) => a.instance.position.y - b.instance.position.y);

    // 6. Blit sprites into pixel buffer
    for (const { template, screenPx, screenPy } of visibleSprites) {
      this.pixelBuffer.blitSprite(template, screenPx, screenPy);
    }

    // 7. Render player sprite at player position
    this.renderPlayerSprite(playerX, playerY, viewport);

    // 8. Animation integration point: apply color transform if set
    if (this.colorTransform) {
      this.colorTransform(this.pixelBuffer);
    }

    // 9. Encode pixel buffer to half-block characters in OptimizedBuffer
    encodeHalfBlocks(this.pixelBuffer, this.buffer, DEFAULT_BG);
  }

  /**
   * Render the ground layer as pixel colors into the PixelBuffer.
   * Each tile produces 2 vertical pixels (top and bottom) using the
   * biome's ground texture pattern.
   */
  private renderGroundPixels(
    zone: ZoneData,
    cameraX: number,
    cameraY: number,
    viewWidth: number,
    viewHeight: number,
    biomeType: string,
  ): void {
    const groundLayer = zone.layers.find((l) => l.name === "ground");
    if (!groundLayer) return;

    for (let sy = 0; sy < viewHeight; sy++) {
      for (let sx = 0; sx < viewWidth; sx++) {
        const wx = sx + cameraX;
        const wy = sy + cameraY;

        if (wx < 0 || wx >= groundLayer.width || wy < 0 || wy >= groundLayer.height) {
          continue;
        }

        const tile = groundLayer.data[wy * groundLayer.width + wx];
        if (!tile) continue;

        const texture = resolveGroundTexture(tile, biomeType);
        const [topColor, botColor] = texture.pattern(wx, wy);

        // Each tile cell maps to 2 vertical pixels
        this.pixelBuffer.setPixel(sx, sy * 2, topColor);
        this.pixelBuffer.setPixel(sx, sy * 2 + 1, botColor);
      }
    }
  }

  /**
   * Render character-based layers (objects, overlay) into the PixelBuffer.
   * Uses tile foreground color for non-transparent character tiles.
   * This provides backward compatibility for zones that use char-based objects
   * without sprites.
   */
  private renderCharLayers(
    zone: ZoneData,
    cameraX: number,
    cameraY: number,
    viewWidth: number,
    viewHeight: number,
    _biomeType: string,
  ): void {
    const layerOrder: TileLayer["name"][] = ["objects", "overlay"];
    for (const layerName of layerOrder) {
      const layer = zone.layers.find((l) => l.name === layerName);
      if (!layer) continue;

      for (let sy = 0; sy < viewHeight; sy++) {
        for (let sx = 0; sx < viewWidth; sx++) {
          const wx = sx + cameraX;
          const wy = sy + cameraY;

          if (wx < 0 || wx >= layer.width || wy < 0 || wy >= layer.height) {
            continue;
          }

          const tile = layer.data[wy * layer.width + wx];
          if (!tile || !tile.char || tile.char === " ") continue;

          // Use the tile's foreground color for both pixels in the cell
          const color = tile.fg;
          this.pixelBuffer.setPixel(sx, sy * 2, color);
          this.pixelBuffer.setPixel(sx, sy * 2 + 1, tile.bg ?? color);
        }
      }
    }
  }

  /**
   * Collect sprites that are visible within the viewport.
   * Returns resolved templates with screen pixel coordinates for blitting.
   */
  private collectVisibleSprites(
    sprites: SpriteInstance[],
    cameraX: number,
    cameraY: number,
    viewWidth: number,
    viewHeight: number,
  ): { instance: SpriteInstance; template: SpriteTemplate; screenPx: number; screenPy: number }[] {
    const result: { instance: SpriteInstance; template: SpriteTemplate; screenPx: number; screenPy: number }[] = [];

    // Pixel-space viewport bounds
    const viewPixelHeight = viewHeight * 2;

    for (const instance of sprites) {
      const template = this.registry.get(instance.templateId);
      if (!template) continue;

      // Anchor position in world pixel coordinates
      // Tiles are 1:1 with pixel X, but 1:2 with pixel Y (each tile = 2 pixel rows)
      const anchorPx = instance.position.x;
      const anchorPy = instance.position.y * 2;

      // Sprite top-left in world pixels (offset from anchor)
      const worldPx = anchorPx - template.anchor.x;
      const worldPy = anchorPy - template.anchor.y;

      // Convert to screen pixel coordinates
      const screenPx = worldPx - cameraX;
      const screenPy = worldPy - cameraY * 2;

      // Visibility check: sprite rectangle must overlap viewport pixel area
      if (
        screenPx + template.pixelWidth <= 0 ||
        screenPx >= viewWidth ||
        screenPy + template.pixelHeight <= 0 ||
        screenPy >= viewPixelHeight
      ) {
        continue;
      }

      result.push({ instance, template, screenPx, screenPy });
    }

    return result;
  }

  /**
   * Render the player as a sprite at their world position.
   * Falls back to no rendering if the player sprite template is not found.
   */
  private renderPlayerSprite(
    playerX: number,
    playerY: number,
    viewport: ViewportManager,
  ): void {
    const playerTemplate = this.registry.get(PLAYER_SPRITE_ID);
    if (!playerTemplate) return;

    const pos = viewport.worldToScreen(playerX, playerY);
    if (!pos) return;

    // pos.x and pos.y are in screen cell coordinates
    const px = pos.x - playerTemplate.anchor.x;
    const py = pos.y * 2 - playerTemplate.anchor.y;

    this.pixelBuffer.blitSprite(playerTemplate, px, py);
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
