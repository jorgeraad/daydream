import { describe, test, expect, mock } from "bun:test";
import { PixelBuffer } from "../PixelBuffer.ts";
import { encodeHalfBlocks } from "../encode.ts";

// ---------------------------------------------------------------------------
// Mock OptimizedBuffer — captures setCell calls for verification
// ---------------------------------------------------------------------------

interface MockCell {
  x: number;
  y: number;
  char: string;
  fg: { r: number; g: number; b: number };
  bg: { r: number; g: number; b: number };
}

function createMockBuffer(width: number, height: number) {
  const cells: MockCell[] = [];
  return {
    width,
    height,
    setCell: mock(
      (x: number, y: number, char: string, fg: any, bg: any, _attrs: any) => {
        cells.push({
          x,
          y,
          char,
          fg: { r: fg.r, g: fg.g, b: fg.b },
          bg: { r: bg.r, g: bg.g, b: bg.b },
        });
      },
    ),
    get cells() {
      return cells;
    },
    cellAt(x: number, y: number): MockCell | undefined {
      // Return the last cell written at this position (latest write wins)
      for (let i = cells.length - 1; i >= 0; i--) {
        if (cells[i]!.x === x && cells[i]!.y === y) return cells[i]!;
      }
      return undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("encodeHalfBlocks", () => {
  test("same top and bottom pixels produce full block", () => {
    // 1 cell wide, 1 cell tall => 1x2 pixels
    const pb = new PixelBuffer(1, 1);
    pb.setPixel(0, 0, "#ff0000");
    pb.setPixel(0, 1, "#ff0000");

    const fb = createMockBuffer(1, 1);
    encodeHalfBlocks(pb, fb as any);

    expect(fb.setCell).toHaveBeenCalledTimes(1);
    const cell = fb.cellAt(0, 0)!;
    expect(cell.char).toBe("\u2588"); // full block
    // fg and bg should be the same color
    expect(cell.fg.r).toBeCloseTo(cell.bg.r, 1);
    expect(cell.fg.g).toBeCloseTo(cell.bg.g, 1);
    expect(cell.fg.b).toBeCloseTo(cell.bg.b, 1);
  });

  test("different top and bottom pixels produce upper half block", () => {
    const pb = new PixelBuffer(1, 1);
    pb.setPixel(0, 0, "#ff0000"); // red top
    pb.setPixel(0, 1, "#0000ff"); // blue bottom

    const fb = createMockBuffer(1, 1);
    encodeHalfBlocks(pb, fb as any);

    expect(fb.setCell).toHaveBeenCalledTimes(1);
    const cell = fb.cellAt(0, 0)!;
    expect(cell.char).toBe("\u2580"); // upper half block
    // fg should be red (top), bg should be blue (bottom)
    // RGBA stores floats 0-1 for hex #ff0000: r~1.0, g~0, b~0
    expect(cell.fg.r).toBeGreaterThan(0.9);
    expect(cell.fg.g).toBeLessThan(0.1);
    expect(cell.bg.b).toBeGreaterThan(0.9);
    expect(cell.bg.r).toBeLessThan(0.1);
  });

  test("null pixels fall back to default background", () => {
    const pb = new PixelBuffer(1, 1);
    // Both pixels null (transparent)

    const fb = createMockBuffer(1, 1);
    encodeHalfBlocks(pb, fb as any, "#000000");

    expect(fb.setCell).toHaveBeenCalledTimes(1);
    const cell = fb.cellAt(0, 0)!;
    // Both pixels resolve to #000000, so same color => full block
    expect(cell.char).toBe("\u2588");
    // Both fg and bg should be black (0,0,0)
    expect(cell.fg.r).toBeCloseTo(0, 1);
    expect(cell.fg.g).toBeCloseTo(0, 1);
    expect(cell.fg.b).toBeCloseTo(0, 1);
  });

  test("one null pixel and one colored pixel produce upper half block", () => {
    const pb = new PixelBuffer(1, 1);
    pb.setPixel(0, 0, "#00ff00"); // green top
    // bottom pixel is null => falls back to defaultBg

    const fb = createMockBuffer(1, 1);
    encodeHalfBlocks(pb, fb as any, "#000000");

    expect(fb.setCell).toHaveBeenCalledTimes(1);
    const cell = fb.cellAt(0, 0)!;
    // Top is green, bottom is black => different => upper half block
    expect(cell.char).toBe("\u2580");
    // fg (top) should be green
    expect(cell.fg.g).toBeGreaterThan(0.9);
    // bg (bottom) should be black
    expect(cell.bg.r).toBeCloseTo(0, 1);
    expect(cell.bg.g).toBeCloseTo(0, 1);
    expect(cell.bg.b).toBeCloseTo(0, 1);
  });

  test("custom default background is used for null pixels", () => {
    const pb = new PixelBuffer(1, 1);
    // Both null — should use custom default bg
    const customBg = "#ffffff";

    const fb = createMockBuffer(1, 1);
    encodeHalfBlocks(pb, fb as any, customBg);

    const cell = fb.cellAt(0, 0)!;
    // Both fall back to white => same => full block
    expect(cell.char).toBe("\u2588");
    // Should be white
    expect(cell.fg.r).toBeGreaterThan(0.9);
    expect(cell.fg.g).toBeGreaterThan(0.9);
    expect(cell.fg.b).toBeGreaterThan(0.9);
  });

  test("multi-cell buffer encodes all cells", () => {
    // 3 cells wide, 2 cells tall => 3x4 pixel buffer
    const pb = new PixelBuffer(3, 2);
    // Fill all pixels with red
    for (let y = 0; y < pb.height; y++) {
      for (let x = 0; x < pb.width; x++) {
        pb.setPixel(x, y, "#ff0000");
      }
    }

    const fb = createMockBuffer(3, 2);
    encodeHalfBlocks(pb, fb as any);

    // Should have 3*2 = 6 setCell calls (one per terminal cell)
    expect(fb.setCell).toHaveBeenCalledTimes(6);
    // All should be full blocks since top and bottom are the same
    for (const cell of fb.cells) {
      expect(cell.char).toBe("\u2588");
    }
  });

  test("encodes correct cell positions in the frame buffer", () => {
    const pb = new PixelBuffer(2, 2);
    // Set different colors per cell for identification
    pb.setPixel(0, 0, "#ff0000"); // top-left cell, top pixel
    pb.setPixel(0, 1, "#ff0000"); // top-left cell, bottom pixel
    pb.setPixel(1, 0, "#00ff00"); // top-right cell, top pixel
    pb.setPixel(1, 1, "#00ff00"); // top-right cell, bottom pixel
    pb.setPixel(0, 2, "#0000ff"); // bottom-left cell, top pixel
    pb.setPixel(0, 3, "#0000ff"); // bottom-left cell, bottom pixel
    pb.setPixel(1, 2, "#ffff00"); // bottom-right cell, top pixel
    pb.setPixel(1, 3, "#ffff00"); // bottom-right cell, bottom pixel

    const fb = createMockBuffer(2, 2);
    encodeHalfBlocks(pb, fb as any);

    expect(fb.setCell).toHaveBeenCalledTimes(4);

    // All cells have same top/bottom, so full blocks
    const topLeft = fb.cellAt(0, 0)!;
    expect(topLeft.char).toBe("\u2588");
    expect(topLeft.fg.r).toBeGreaterThan(0.9); // red

    const topRight = fb.cellAt(1, 0)!;
    expect(topRight.char).toBe("\u2588");
    expect(topRight.fg.g).toBeGreaterThan(0.9); // green

    const botLeft = fb.cellAt(0, 1)!;
    expect(botLeft.char).toBe("\u2588");
    expect(botLeft.fg.b).toBeGreaterThan(0.9); // blue

    const botRight = fb.cellAt(1, 1)!;
    expect(botRight.char).toBe("\u2588");
    expect(botRight.fg.r).toBeGreaterThan(0.9); // yellow (r+g)
    expect(botRight.fg.g).toBeGreaterThan(0.9);
  });

  test("handles odd-height pixel buffer gracefully", () => {
    // 1 cell wide, pixel height will be 2 (cellHeight=1 => height=2)
    // But we can test the edge case by using a buffer with 1 cell tall
    // and only setting the top pixel. The bottom pixel is null => defaultBg
    const pb = new PixelBuffer(1, 1);
    pb.setPixel(0, 0, "#ff0000"); // only top pixel

    const fb = createMockBuffer(1, 1);
    encodeHalfBlocks(pb, fb as any, "#000000");

    const cell = fb.cellAt(0, 0)!;
    // top=red, bottom=null->black => different => upper half block
    expect(cell.char).toBe("\u2580");
  });

  test("RGBA conversion produces correct values for common hex colors", () => {
    const pb = new PixelBuffer(1, 1);
    pb.setPixel(0, 0, "#ffffff"); // white
    pb.setPixel(0, 1, "#000000"); // black

    const fb = createMockBuffer(1, 1);
    encodeHalfBlocks(pb, fb as any);

    const cell = fb.cellAt(0, 0)!;
    // fg (white): all channels near 1.0
    expect(cell.fg.r).toBeGreaterThan(0.9);
    expect(cell.fg.g).toBeGreaterThan(0.9);
    expect(cell.fg.b).toBeGreaterThan(0.9);
    // bg (black): all channels near 0.0
    expect(cell.bg.r).toBeLessThan(0.1);
    expect(cell.bg.g).toBeLessThan(0.1);
    expect(cell.bg.b).toBeLessThan(0.1);
  });

  test("caches RGBA objects for repeated hex colors", () => {
    // This is a behavioral test: encoding a large buffer with repeated colors
    // should not throw and should produce correct output.
    const pb = new PixelBuffer(10, 5);
    for (let y = 0; y < pb.height; y++) {
      for (let x = 0; x < pb.width; x++) {
        pb.setPixel(x, y, x % 2 === 0 ? "#aabbcc" : "#112233");
      }
    }

    const fb = createMockBuffer(10, 5);
    encodeHalfBlocks(pb, fb as any);

    // 10 * 5 = 50 cells
    expect(fb.setCell).toHaveBeenCalledTimes(50);

    // All cells should have valid characters
    for (const cell of fb.cells) {
      expect(["\u2588", "\u2580"]).toContain(cell.char);
    }
  });

  test("mixed transparent and opaque pixels produce correct encoding", () => {
    const pb = new PixelBuffer(2, 1);
    // Cell (0,0): top=#ff0000, bottom=null
    pb.setPixel(0, 0, "#ff0000");
    // Cell (1,0): top=null, bottom=#00ff00
    pb.setPixel(1, 1, "#00ff00");

    const fb = createMockBuffer(2, 1);
    encodeHalfBlocks(pb, fb as any, "#000000");

    // Cell (0,0): red top, black bottom => different => upper half
    const cell0 = fb.cellAt(0, 0)!;
    expect(cell0.char).toBe("\u2580");

    // Cell (1,0): black top (null->default), green bottom => different => upper half
    const cell1 = fb.cellAt(1, 0)!;
    expect(cell1.char).toBe("\u2580");
  });
});
