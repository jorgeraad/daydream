import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { SpriteRegistry } from "../SpriteRegistry.ts";
import type { SpriteTemplate } from "../types.ts";
import { ALL_SPRITES } from "../library/index.ts";
import { join } from "node:path";
import { rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeTemplate(overrides: Partial<SpriteTemplate> = {}): SpriteTemplate {
  return {
    id: "test_sprite",
    name: "Test Sprite",
    category: "object",
    pixelWidth: 2,
    pixelHeight: 2,
    pixels: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
    anchor: { x: 0, y: 1 },
    collisionTiles: [{ dx: 0, dy: 0 }],
    tags: ["test"],
    ...overrides,
  };
}

const spriteA = makeTemplate({ id: "sprite_a", name: "Sprite A", category: "tree", tags: ["forest", "tall"] });
const spriteB = makeTemplate({ id: "sprite_b", name: "Sprite B", category: "tree", tags: ["forest", "small"] });
const spriteC = makeTemplate({ id: "sprite_c", name: "Sprite C", category: "rock", tags: ["mountain", "tall"] });
const spriteD = makeTemplate({ id: "sprite_d", name: "Sprite D", category: "npc", tags: ["town", "friendly"] });

// ---------------------------------------------------------------------------
// Tests — in-memory operations
// ---------------------------------------------------------------------------

describe("SpriteRegistry", () => {
  describe("register and get", () => {
    test("registers a template and retrieves it by ID", () => {
      const registry = new SpriteRegistry("/tmp/unused");
      const template = makeTemplate();
      registry.register(template);

      expect(registry.get("test_sprite")).toBe(template);
    });

    test("returns undefined for unknown ID", () => {
      const registry = new SpriteRegistry("/tmp/unused");
      expect(registry.get("nonexistent")).toBeUndefined();
    });

    test("overwrites existing template with same ID", () => {
      const registry = new SpriteRegistry("/tmp/unused");
      const v1 = makeTemplate({ name: "Version 1" });
      const v2 = makeTemplate({ name: "Version 2" });

      registry.register(v1);
      registry.register(v2);

      expect(registry.get("test_sprite")!.name).toBe("Version 2");
      expect(registry.size).toBe(1);
    });

    test("tracks size correctly", () => {
      const registry = new SpriteRegistry("/tmp/unused");
      expect(registry.size).toBe(0);

      registry.register(spriteA);
      expect(registry.size).toBe(1);

      registry.register(spriteB);
      expect(registry.size).toBe(2);

      // Overwrite A should not increase size
      registry.register(makeTemplate({ id: "sprite_a", name: "Updated A" }));
      expect(registry.size).toBe(2);
    });
  });

  describe("find", () => {
    let registry: SpriteRegistry;

    beforeEach(() => {
      registry = new SpriteRegistry("/tmp/unused");
      registry.register(spriteA);
      registry.register(spriteB);
      registry.register(spriteC);
      registry.register(spriteD);
    });

    test("finds templates by category", () => {
      const trees = registry.find({ category: "tree" });
      expect(trees).toHaveLength(2);
      expect(trees.map((t) => t.id).sort()).toEqual(["sprite_a", "sprite_b"]);
    });

    test("returns empty array when no templates match category", () => {
      const buildings = registry.find({ category: "building" });
      expect(buildings).toHaveLength(0);
    });

    test("finds templates by tags (AND logic)", () => {
      // Both spriteA and spriteC have "tall"
      const tall = registry.find({ tags: ["tall"] });
      expect(tall).toHaveLength(2);
      expect(tall.map((t) => t.id).sort()).toEqual(["sprite_a", "sprite_c"]);

      // Only spriteA has both "forest" and "tall"
      const forestTall = registry.find({ tags: ["forest", "tall"] });
      expect(forestTall).toHaveLength(1);
      expect(forestTall[0]!.id).toBe("sprite_a");
    });

    test("finds templates by category AND tags", () => {
      // tree + forest => spriteA and spriteB
      const forestTrees = registry.find({ category: "tree", tags: ["forest"] });
      expect(forestTrees).toHaveLength(2);

      // tree + tall => only spriteA
      const tallTrees = registry.find({ category: "tree", tags: ["tall"] });
      expect(tallTrees).toHaveLength(1);
      expect(tallTrees[0]!.id).toBe("sprite_a");
    });

    test("empty options returns all templates", () => {
      const all = registry.find({});
      expect(all).toHaveLength(4);
    });

    test("empty tags array returns all (tags not filtered)", () => {
      const all = registry.find({ tags: [] });
      expect(all).toHaveLength(4);
    });

    test("no templates match non-existent tag", () => {
      const result = registry.find({ tags: ["underwater"] });
      expect(result).toHaveLength(0);
    });
  });

  describe("registerBuiltins", () => {
    test("registers all built-in templates", () => {
      const registry = new SpriteRegistry("/tmp/unused");
      registry.registerBuiltins(ALL_SPRITES);

      expect(registry.size).toBe(ALL_SPRITES.length);
    });

    test("built-in templates are retrievable by ID", () => {
      const registry = new SpriteRegistry("/tmp/unused");
      registry.registerBuiltins(ALL_SPRITES);

      for (const sprite of ALL_SPRITES) {
        const found = registry.get(sprite.id);
        expect(found).toBeDefined();
        expect(found!.id).toBe(sprite.id);
      }
    });

    test("built-in library contains expected categories", () => {
      const registry = new SpriteRegistry("/tmp/unused");
      registry.registerBuiltins(ALL_SPRITES);

      const trees = registry.find({ category: "tree" });
      const buildings = registry.find({ category: "building" });
      const npcs = registry.find({ category: "npc" });
      const objects = registry.find({ category: "object" });
      const decorations = registry.find({ category: "decoration" });

      expect(trees.length).toBeGreaterThan(0);
      expect(buildings.length).toBeGreaterThan(0);
      expect(npcs.length).toBeGreaterThan(0);
      expect(objects.length).toBeGreaterThan(0);
      expect(decorations.length).toBeGreaterThan(0);
    });

    test("ALL_SPRITES contains expected count (29 total per library comment)", () => {
      expect(ALL_SPRITES.length).toBe(29);
    });
  });

  describe("cache round-trip", () => {
    let tmpDir: string;
    let registry: SpriteRegistry;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), "sprite-test-"));
      registry = new SpriteRegistry(tmpDir);
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    test("saveCache and loadCache round-trip preserves templates", async () => {
      registry.register(spriteA);
      registry.register(spriteB);

      await registry.saveCache();

      // Create a new registry pointing to the same path and load
      const registry2 = new SpriteRegistry(tmpDir);
      const loaded = await registry2.loadCache();

      expect(loaded).toBe(2);
      expect(registry2.size).toBe(2);
      expect(registry2.get("sprite_a")!.name).toBe("Sprite A");
      expect(registry2.get("sprite_b")!.name).toBe("Sprite B");
    });

    test("loadCache returns 0 when no cache file exists", async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), "sprite-empty-"));
      const emptyRegistry = new SpriteRegistry(emptyDir);

      const loaded = await emptyRegistry.loadCache();
      expect(loaded).toBe(0);
      expect(emptyRegistry.size).toBe(0);

      await rm(emptyDir, { recursive: true, force: true });
    });

    test("loadCache does not overwrite built-in templates", async () => {
      // Save a template as cached
      registry.register(makeTemplate({ id: "builtin_sprite", name: "Cached Version" }));
      await registry.saveCache();

      // Create a new registry, register a built-in with the same ID
      const registry2 = new SpriteRegistry(tmpDir);
      registry2.registerBuiltins([
        makeTemplate({ id: "builtin_sprite", name: "Built-in Version" }),
      ]);

      // Load cache — should NOT overwrite the built-in
      const loaded = await registry2.loadCache();
      expect(loaded).toBe(0); // cached template was skipped
      expect(registry2.get("builtin_sprite")!.name).toBe("Built-in Version");
    });

    test("saveCache creates directory if it does not exist", async () => {
      const nestedDir = join(tmpDir, "nested", "deep", "path");
      const nestedRegistry = new SpriteRegistry(nestedDir);
      nestedRegistry.register(spriteA);

      // Should not throw
      await nestedRegistry.saveCache();

      // Verify it can be loaded back
      const loader = new SpriteRegistry(nestedDir);
      const loaded = await loader.loadCache();
      expect(loaded).toBe(1);
    });

    test("round-trip preserves all template fields", async () => {
      const detailed = makeTemplate({
        id: "detailed_sprite",
        name: "Detailed Sprite",
        category: "building",
        pixelWidth: 4,
        pixelHeight: 6,
        pixels: ["#111", "#222", "#333", null, "#444", "#555", "#666", "#777",
                 null, null, "#aaa", "#bbb", "#ccc", "#ddd", "#eee", "#fff",
                 "#123", "#456", "#789", "#abc", "#def", "#012", "#345", "#678"],
        anchor: { x: 2, y: 5 },
        collisionTiles: [{ dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 1, dy: 0 }],
        tags: ["large", "stone", "medieval"],
      });

      registry.register(detailed);
      await registry.saveCache();

      const loader = new SpriteRegistry(tmpDir);
      await loader.loadCache();

      const loaded = loader.get("detailed_sprite")!;
      expect(loaded.name).toBe("Detailed Sprite");
      expect(loaded.category).toBe("building");
      expect(loaded.pixelWidth).toBe(4);
      expect(loaded.pixelHeight).toBe(6);
      expect(loaded.pixels).toHaveLength(24);
      expect(loaded.pixels[3]).toBeNull();
      expect(loaded.anchor).toEqual({ x: 2, y: 5 });
      expect(loaded.collisionTiles).toEqual([
        { dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 1, dy: 0 },
      ]);
      expect(loaded.tags).toEqual(["large", "stone", "medieval"]);
    });
  });
});
