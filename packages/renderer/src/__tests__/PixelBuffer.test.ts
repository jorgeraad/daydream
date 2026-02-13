import { describe, test, expect } from "bun:test";
import { PixelBuffer } from "../sprites/PixelBuffer.ts";
import type { SpriteTemplate } from "../sprites/types.ts";

describe("PixelBuffer", () => {
  test("constructor creates buffer with correct dimensions", () => {
    const buf = new PixelBuffer(10, 5);
    // 10 cells wide = 10 pixels wide
    expect(buf.width).toBe(10);
    // 5 cells tall * 2 = 10 pixels tall (half-block doubles vertical resolution)
    expect(buf.height).toBe(10);
  });

  test("new buffer is filled with null (transparent)", () => {
    const buf = new PixelBuffer(3, 2);
    for (let y = 0; y < buf.height; y++) {
      for (let x = 0; x < buf.width; x++) {
        expect(buf.getPixel(x, y)).toBeNull();
      }
    }
  });

  test("setPixel and getPixel round-trip", () => {
    const buf = new PixelBuffer(5, 5);
    buf.setPixel(2, 3, "#ff0000");
    expect(buf.getPixel(2, 3)).toBe("#ff0000");
  });

  test("setPixel with null does not overwrite existing pixel", () => {
    const buf = new PixelBuffer(5, 5);
    buf.setPixel(1, 1, "#00ff00");
    buf.setPixel(1, 1, null);
    // null is a no-op — the green pixel should still be there
    expect(buf.getPixel(1, 1)).toBe("#00ff00");
  });

  test("getPixel returns null for out-of-bounds coordinates", () => {
    const buf = new PixelBuffer(4, 3);
    expect(buf.getPixel(-1, 0)).toBeNull();
    expect(buf.getPixel(0, -1)).toBeNull();
    expect(buf.getPixel(4, 0)).toBeNull(); // width=4, max x=3
    expect(buf.getPixel(0, 6)).toBeNull(); // height=6, max y=5
    expect(buf.getPixel(100, 100)).toBeNull();
  });

  test("setPixel silently ignores out-of-bounds writes", () => {
    const buf = new PixelBuffer(3, 3);
    // These should not throw
    buf.setPixel(-1, 0, "#ff0000");
    buf.setPixel(0, -1, "#ff0000");
    buf.setPixel(3, 0, "#ff0000");
    buf.setPixel(0, 6, "#ff0000");
    buf.setPixel(999, 999, "#ff0000");

    // Buffer should remain all null (no writes landed)
    for (let y = 0; y < buf.height; y++) {
      for (let x = 0; x < buf.width; x++) {
        expect(buf.getPixel(x, y)).toBeNull();
      }
    }
  });

  test("clear fills buffer with specified color", () => {
    const buf = new PixelBuffer(3, 2);
    buf.clear("#000000");
    for (let y = 0; y < buf.height; y++) {
      for (let x = 0; x < buf.width; x++) {
        expect(buf.getPixel(x, y)).toBe("#000000");
      }
    }
  });

  test("clear with no argument fills buffer with null", () => {
    const buf = new PixelBuffer(3, 2);
    buf.setPixel(0, 0, "#ff0000");
    buf.setPixel(1, 1, "#00ff00");
    buf.clear();
    for (let y = 0; y < buf.height; y++) {
      for (let x = 0; x < buf.width; x++) {
        expect(buf.getPixel(x, y)).toBeNull();
      }
    }
  });

  test("clear overwrites existing pixels", () => {
    const buf = new PixelBuffer(3, 2);
    buf.setPixel(1, 1, "#ff0000");
    buf.clear("#0000ff");
    expect(buf.getPixel(1, 1)).toBe("#0000ff");
  });

  describe("blitSprite", () => {
    const tinySprite: SpriteTemplate = {
      id: "test_tiny",
      name: "Tiny Test",
      category: "object",
      pixelWidth: 2,
      pixelHeight: 2,
      pixels: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
      anchor: { x: 0, y: 1 },
      collisionTiles: [],
      tags: ["test"],
    };

    test("blits sprite pixels at specified position", () => {
      const buf = new PixelBuffer(5, 5);
      buf.blitSprite(tinySprite, 1, 2);

      // Row 0 of sprite (y=2): #ff0000, #00ff00
      expect(buf.getPixel(1, 2)).toBe("#ff0000");
      expect(buf.getPixel(2, 2)).toBe("#00ff00");
      // Row 1 of sprite (y=3): #0000ff, #ffff00
      expect(buf.getPixel(1, 3)).toBe("#0000ff");
      expect(buf.getPixel(2, 3)).toBe("#ffff00");
    });

    test("skips transparent (null) pixels during blit", () => {
      const spriteWithTransparency: SpriteTemplate = {
        id: "test_transparent",
        name: "Transparent Test",
        category: "object",
        pixelWidth: 3,
        pixelHeight: 2,
        pixels: [null, "#ff0000", null, "#00ff00", null, "#0000ff"],
        anchor: { x: 1, y: 1 },
        collisionTiles: [],
        tags: ["test"],
      };

      const buf = new PixelBuffer(5, 5);
      buf.clear("#888888");
      buf.blitSprite(spriteWithTransparency, 0, 0);

      // null pixels should preserve the background
      expect(buf.getPixel(0, 0)).toBe("#888888"); // null, kept background
      expect(buf.getPixel(1, 0)).toBe("#ff0000"); // overwritten
      expect(buf.getPixel(2, 0)).toBe("#888888"); // null, kept background
      expect(buf.getPixel(0, 1)).toBe("#00ff00"); // overwritten
      expect(buf.getPixel(1, 1)).toBe("#888888"); // null, kept background
      expect(buf.getPixel(2, 1)).toBe("#0000ff"); // overwritten
    });

    test("clips sprite that extends beyond right/bottom edge", () => {
      const buf = new PixelBuffer(3, 2); // 3 wide x 4 tall pixels
      buf.blitSprite(tinySprite, 2, 3);

      // Only top-left pixel of sprite should land (at 2,3)
      expect(buf.getPixel(2, 3)).toBe("#ff0000");
      // Rest is out of bounds — buffer should be null elsewhere
      expect(buf.getPixel(0, 0)).toBeNull();
    });

    test("clips sprite that extends beyond left/top edge", () => {
      const buf = new PixelBuffer(5, 5);
      buf.blitSprite(tinySprite, -1, -1);

      // Sprite at (-1, -1): only bottom-right pixel (1,1) lands at buffer (0,0)
      expect(buf.getPixel(0, 0)).toBe("#ffff00");
      // Other pixels were out of bounds
      expect(buf.getPixel(1, 0)).toBeNull();
      expect(buf.getPixel(0, 1)).toBeNull();
    });

    test("handles fully out-of-bounds sprite gracefully", () => {
      const buf = new PixelBuffer(5, 5);
      buf.blitSprite(tinySprite, -10, -10);
      // Nothing should have been written
      for (let y = 0; y < buf.height; y++) {
        for (let x = 0; x < buf.width; x++) {
          expect(buf.getPixel(x, y)).toBeNull();
        }
      }
    });

    test("multiple sprites composite correctly (last wins)", () => {
      const redSprite: SpriteTemplate = {
        id: "red",
        name: "Red",
        category: "object",
        pixelWidth: 2,
        pixelHeight: 2,
        pixels: ["#ff0000", "#ff0000", "#ff0000", "#ff0000"],
        anchor: { x: 0, y: 0 },
        collisionTiles: [],
        tags: [],
      };

      const blueSprite: SpriteTemplate = {
        id: "blue",
        name: "Blue",
        category: "object",
        pixelWidth: 2,
        pixelHeight: 2,
        pixels: ["#0000ff", "#0000ff", "#0000ff", "#0000ff"],
        anchor: { x: 0, y: 0 },
        collisionTiles: [],
        tags: [],
      };

      const buf = new PixelBuffer(5, 5);
      buf.blitSprite(redSprite, 0, 0);
      buf.blitSprite(blueSprite, 0, 0);

      // Blue overwrites red (last write wins)
      expect(buf.getPixel(0, 0)).toBe("#0000ff");
      expect(buf.getPixel(1, 1)).toBe("#0000ff");
    });
  });

  test("pixel buffer uses row-major flat array (y * width + x)", () => {
    const buf = new PixelBuffer(4, 2); // 4 wide x 4 tall
    buf.setPixel(0, 0, "#a");
    buf.setPixel(3, 0, "#b");
    buf.setPixel(0, 3, "#c");
    buf.setPixel(3, 3, "#d");

    // Verify correct locations
    expect(buf.getPixel(0, 0)).toBe("#a");
    expect(buf.getPixel(3, 0)).toBe("#b");
    expect(buf.getPixel(0, 3)).toBe("#c");
    expect(buf.getPixel(3, 3)).toBe("#d");

    // Other corners should be null
    expect(buf.getPixel(1, 0)).toBeNull();
    expect(buf.getPixel(0, 1)).toBeNull();
  });
});
