import { describe, test, expect } from "bun:test";
import { isCollision } from "../TileRenderer.ts";
import type { ZoneData, TileCell, TileLayer } from "../types.ts";

function makeZone(width: number, height: number, collisionMap: number[]): ZoneData {
  const ground: TileCell[] = Array.from({ length: width * height }, () => ({
    char: ".",
    fg: "#ffffff",
  }));

  const collision: TileCell[] = collisionMap.map((v) => ({
    char: v === 1 ? "1" : "0",
    fg: "#000000",
  }));

  return {
    id: "test",
    width,
    height,
    layers: [
      { name: "ground", data: ground, width, height },
      { name: "collision", data: collision, width, height },
    ],
  };
}

describe("isCollision", () => {
  test("returns false for passable tiles", () => {
    const zone = makeZone(5, 5, Array(25).fill(0));
    expect(isCollision(zone, 2, 2)).toBe(false);
    expect(isCollision(zone, 0, 0)).toBe(false);
    expect(isCollision(zone, 4, 4)).toBe(false);
  });

  test("returns true for blocked tiles", () => {
    const map = Array(25).fill(0);
    map[2 * 5 + 3] = 1; // (3, 2) is blocked
    const zone = makeZone(5, 5, map);

    expect(isCollision(zone, 3, 2)).toBe(true);
    expect(isCollision(zone, 2, 2)).toBe(false);
  });

  test("returns true for out of bounds coordinates", () => {
    const zone = makeZone(5, 5, Array(25).fill(0));

    expect(isCollision(zone, -1, 0)).toBe(true);
    expect(isCollision(zone, 0, -1)).toBe(true);
    expect(isCollision(zone, 5, 0)).toBe(true);
    expect(isCollision(zone, 0, 5)).toBe(true);
  });

  test("returns false when no collision layer exists", () => {
    const zone: ZoneData = {
      id: "test",
      width: 5,
      height: 5,
      layers: [
        {
          name: "ground",
          data: Array.from({ length: 25 }, () => ({ char: ".", fg: "#fff" })),
          width: 5,
          height: 5,
        },
      ],
    };

    expect(isCollision(zone, 2, 2)).toBe(false);
  });

  test("handles wall borders correctly", () => {
    // 3x3 zone with walls on all edges
    const map = [
      1, 1, 1,
      1, 0, 1,
      1, 1, 1,
    ];
    const zone = makeZone(3, 3, map);

    // Center is passable
    expect(isCollision(zone, 1, 1)).toBe(false);
    // All edges are blocked
    expect(isCollision(zone, 0, 0)).toBe(true);
    expect(isCollision(zone, 1, 0)).toBe(true);
    expect(isCollision(zone, 2, 0)).toBe(true);
    expect(isCollision(zone, 0, 1)).toBe(true);
    expect(isCollision(zone, 2, 1)).toBe(true);
    expect(isCollision(zone, 0, 2)).toBe(true);
    expect(isCollision(zone, 1, 2)).toBe(true);
    expect(isCollision(zone, 2, 2)).toBe(true);
  });
});
