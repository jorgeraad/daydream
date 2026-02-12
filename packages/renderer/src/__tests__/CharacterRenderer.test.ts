import { describe, test, expect } from "bun:test";
import type { Character } from "@daydream/engine";
import {
  findNearbyCharacters,
  findAdjacentCharacters,
  isCharacterAt,
} from "../CharacterRenderer.ts";

function makeCharacter(
  id: string,
  x: number,
  y: number,
  overrides?: Partial<Character["visual"]>,
): Character {
  return {
    id,
    worldId: "test_world",
    identity: {
      name: id,
      age: "adult",
      role: "villager",
      personality: ["friendly"],
      backstory: "test",
      speechPattern: "casual",
      secrets: [],
    },
    visual: {
      display: { char: "☺", fg: "#deb887" },
      nameplate: id,
      ...overrides,
    },
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

describe("findNearbyCharacters", () => {
  test("finds characters within radius", () => {
    const chars = [
      makeCharacter("close", 5, 5),
      makeCharacter("far", 20, 20),
    ];

    const nearby = findNearbyCharacters(chars, { x: 5, y: 6 }, 3);
    expect(nearby).toHaveLength(1);
    expect(nearby[0]!.id).toBe("close");
  });

  test("uses Manhattan distance", () => {
    const chars = [
      makeCharacter("a", 3, 3), // Manhattan dist from (5,5) = 4
      makeCharacter("b", 4, 5), // Manhattan dist from (5,5) = 1
      makeCharacter("c", 5, 5), // Manhattan dist from (5,5) = 0
    ];

    // Radius 2: only b and c
    const nearby = findNearbyCharacters(chars, { x: 5, y: 5 }, 2);
    expect(nearby).toHaveLength(2);
    expect(nearby.map((c) => c.id).sort()).toEqual(["b", "c"]);
  });

  test("returns empty array when no characters nearby", () => {
    const chars = [makeCharacter("far", 50, 50)];
    const nearby = findNearbyCharacters(chars, { x: 0, y: 0 }, 5);
    expect(nearby).toHaveLength(0);
  });

  test("includes characters exactly at radius boundary", () => {
    const chars = [makeCharacter("edge", 3, 0)];
    const nearby = findNearbyCharacters(chars, { x: 0, y: 0 }, 3);
    expect(nearby).toHaveLength(1);
  });
});

describe("findAdjacentCharacters", () => {
  test("finds characters at distance 1 (4-directional)", () => {
    const chars = [
      makeCharacter("up", 5, 4),
      makeCharacter("down", 5, 6),
      makeCharacter("left", 4, 5),
      makeCharacter("right", 6, 5),
      makeCharacter("diagonal", 6, 6),
    ];

    const adjacent = findAdjacentCharacters(chars, { x: 5, y: 5 });
    expect(adjacent).toHaveLength(4);
    expect(adjacent.map((c) => c.id).sort()).toEqual([
      "down",
      "left",
      "right",
      "up",
    ]);
  });

  test("excludes characters at same position", () => {
    const chars = [makeCharacter("same", 5, 5)];
    const adjacent = findAdjacentCharacters(chars, { x: 5, y: 5 });
    expect(adjacent).toHaveLength(0);
  });

  test("returns empty when no adjacent characters", () => {
    const chars = [makeCharacter("far", 10, 10)];
    const adjacent = findAdjacentCharacters(chars, { x: 5, y: 5 });
    expect(adjacent).toHaveLength(0);
  });
});

describe("isCharacterAt", () => {
  test("returns true when character occupies position", () => {
    const chars = [makeCharacter("npc", 5, 5)];
    expect(isCharacterAt(chars, 5, 5)).toBe(true);
  });

  test("returns false when no character at position", () => {
    const chars = [makeCharacter("npc", 5, 5)];
    expect(isCharacterAt(chars, 6, 5)).toBe(false);
  });

  test("returns false for empty character list", () => {
    expect(isCharacterAt([], 5, 5)).toBe(false);
  });

  test("works with multiple characters", () => {
    const chars = [
      makeCharacter("a", 1, 1),
      makeCharacter("b", 3, 3),
      makeCharacter("c", 5, 5),
    ];
    expect(isCharacterAt(chars, 3, 3)).toBe(true);
    expect(isCharacterAt(chars, 2, 2)).toBe(false);
  });
});
