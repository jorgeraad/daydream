// Half-block encoder — converts a PixelBuffer into terminal characters
// Each terminal cell encodes two vertical pixels using Unicode half-block
// characters, doubling the viewport's vertical resolution.

import { RGBA, TextAttributes, type OptimizedBuffer } from "@opentui/core";

import type { PixelBuffer } from "./PixelBuffer.ts";

/** Unicode block characters used for half-block encoding */
const FULL_BLOCK = "\u2588"; // █ — both pixels same color
const UPPER_HALF = "\u2580"; // ▀ — top=fg, bottom=bg

/**
 * Encode a PixelBuffer into half-block characters written to an OptimizedBuffer.
 *
 * Each terminal cell represents two vertically stacked pixels. For each cell:
 * - If both pixels are the same color: full block `█` with that color as fg
 * - If they differ: upper half block `▀` with fg = top pixel, bg = bottom pixel
 * - Transparent (null) pixels fall back to `defaultBg`
 *
 * Handles odd-height pixel buffers gracefully: the unpaired bottom row of pixels
 * is treated as if the missing bottom pixel is transparent (falls back to defaultBg).
 *
 * @param pixelBuffer The pixel buffer to encode (width = cell columns, height = cell rows * 2)
 * @param frameBuffer The OptimizedBuffer to write encoded cells into
 * @param defaultBg   Hex color string for transparent pixels (default: "#000000")
 */
export function encodeHalfBlocks(
  pixelBuffer: PixelBuffer,
  frameBuffer: OptimizedBuffer,
  defaultBg: string = "#000000",
): void {
  // Cell height: integer division, rounding up so odd pixel heights
  // get an extra cell row (with the bottom pixel treated as defaultBg).
  const cellHeight = Math.ceil(pixelBuffer.height / 2);
  const cellWidth = pixelBuffer.width;

  // Pre-compute the default background RGBA to avoid repeated parsing
  const defaultBgRgba = RGBA.fromHex(defaultBg);

  // RGBA cache: avoids creating duplicate RGBA objects for repeated hex colors.
  // Terminal viewports are typically modest (e.g. 60x60 pixels) with many
  // repeated colors, so caching is worthwhile.
  const rgbaCache = new Map<string, RGBA>();
  rgbaCache.set(defaultBg, defaultBgRgba);

  function resolveColor(hex: string): RGBA {
    let rgba = rgbaCache.get(hex);
    if (rgba === undefined) {
      rgba = RGBA.fromHex(hex);
      rgbaCache.set(hex, rgba);
    }
    return rgba;
  }

  for (let row = 0; row < cellHeight; row++) {
    const topY = row * 2;
    const botY = topY + 1;

    for (let col = 0; col < cellWidth; col++) {
      // Resolve pixel colors, falling back to defaultBg for transparent (null)
      const topHex = pixelBuffer.getPixel(col, topY) ?? defaultBg;
      // For odd-height buffers, botY may be out of bounds — getPixel returns null
      const botHex = pixelBuffer.getPixel(col, botY) ?? defaultBg;

      let char: string;
      let fg: RGBA;
      let bg: RGBA;

      if (topHex === botHex) {
        // Both pixels identical: full block with that color
        char = FULL_BLOCK;
        fg = resolveColor(topHex);
        bg = fg;
      } else {
        // Different pixels: upper half block, fg = top, bg = bottom
        char = UPPER_HALF;
        fg = resolveColor(topHex);
        bg = resolveColor(botHex);
      }

      frameBuffer.setCell(col, row, char, fg, bg, TextAttributes.NONE);
    }
  }
}
