// PixelBuffer — intermediate pixel grid for half-block rendering
// All rendering composites into this buffer before half-block encoding.

import type { SpriteCell, SpriteTemplate } from "./types.ts";

/**
 * A 2D pixel buffer at the resolution used by half-block rendering.
 *
 * Each terminal cell encodes two vertical pixels using Unicode half-block
 * characters. A viewport of W cells x H cells becomes W x (H*2) pixels.
 *
 * The buffer uses a flat array indexed as `y * width + x` (row-major).
 * null pixels are transparent.
 */
export class PixelBuffer {
  /** Width in pixels (= viewport width in cells) */
  readonly width: number;

  /** Height in pixels (= viewport height in cells * 2) */
  readonly height: number;

  private data: SpriteCell[];

  /**
   * Create a new PixelBuffer.
   * @param cellWidth  Viewport width in terminal cells (= pixel width)
   * @param cellHeight Viewport height in terminal cells (pixel height = cellHeight * 2)
   */
  constructor(cellWidth: number, cellHeight: number) {
    this.width = cellWidth;
    this.height = cellHeight * 2;
    this.data = new Array<SpriteCell>(this.width * this.height).fill(null);
  }

  /**
   * Get the color of a pixel at (x, y).
   * Returns null for transparent pixels or out-of-bounds coordinates.
   */
  getPixel(x: number, y: number): SpriteCell {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.data[y * this.width + x] ?? null;
  }

  /**
   * Set the color of a pixel at (x, y).
   * Out-of-bounds writes are silently ignored.
   * null values are treated as transparent (no-op — does not overwrite existing pixel).
   */
  setPixel(x: number, y: number, color: SpriteCell): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    if (color !== null) {
      this.data[y * this.width + x] = color;
    }
  }

  /**
   * Set the color of a pixel at (x, y), including null values.
   * Unlike setPixel, this overwrites even with null (useful for
   * post-processing transforms that modify existing pixel values).
   * Out-of-bounds writes are silently ignored.
   */
  setPixelForce(x: number, y: number, color: SpriteCell): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.data[y * this.width + x] = color;
  }

  /**
   * Fill the entire buffer with a single color.
   * Pass null to clear to transparent.
   */
  clear(color: SpriteCell = null): void {
    this.data.fill(color);
  }

  /**
   * Blit (copy) a sprite template's pixels into the buffer at the given
   * pixel coordinates. Transparent pixels (null) in the sprite are skipped,
   * preserving whatever is already in the buffer underneath.
   *
   * @param template The sprite template to render
   * @param px       X pixel coordinate of the sprite's top-left corner in the buffer
   * @param py       Y pixel coordinate of the sprite's top-left corner in the buffer
   */
  blitSprite(template: SpriteTemplate, px: number, py: number): void {
    for (let sy = 0; sy < template.pixelHeight; sy++) {
      for (let sx = 0; sx < template.pixelWidth; sx++) {
        const pixel = template.pixels[sy * template.pixelWidth + sx] ?? null;
        if (pixel !== null) {
          this.setPixel(px + sx, py + sy, pixel);
        }
      }
    }
  }
}
