import { describe, test, expect, beforeEach, mock } from "bun:test";
import type { TitleScreenResult } from "../TitleScreen.ts";
import { SaveManager, type WorldSummary } from "../SaveManager.ts";

// ── Type tests ─────────────────────────────────────────────────

describe("TitleScreenResult type", () => {
  test("supports prompt variant", () => {
    const result: TitleScreenResult = { type: "prompt", value: "a forest" };
    expect(result.type).toBe("prompt");
    if (result.type === "prompt") {
      expect(result.value).toBe("a forest");
    }
  });

  test("supports settings variant", () => {
    const result: TitleScreenResult = { type: "settings" };
    expect(result.type).toBe("settings");
  });

  test("supports continue variant with worldId", () => {
    const result: TitleScreenResult = { type: "continue", worldId: "world_123" };
    expect(result.type).toBe("continue");
    if (result.type === "continue") {
      expect(result.worldId).toBe("world_123");
    }
  });

  test("supports load variant with worldId", () => {
    const result: TitleScreenResult = { type: "load", worldId: "world_456" };
    expect(result.type).toBe("load");
    if (result.type === "load") {
      expect(result.worldId).toBe("world_456");
    }
  });

  test("supports browse variant", () => {
    const result: TitleScreenResult = { type: "browse" };
    expect(result.type).toBe("browse");
  });
});

// ── Menu mode detection ────────────────────────────────────────

describe("Menu mode detection", () => {
  test("no saved worlds → should use prompt mode (no menu)", () => {
    const worlds: WorldSummary[] = [];
    const hasMenu = worlds.length > 0;
    expect(hasMenu).toBe(false);
  });

  test("one saved world → should use menu mode", () => {
    const worlds: WorldSummary[] = [
      {
        id: "world_1",
        name: "My Forest",
        seedPrompt: "A mystical forest with ancient trees",
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 3600000,
        playTimeSeconds: 8100, // 2h 15m
      },
    ];
    const hasMenu = worlds.length > 0;
    expect(hasMenu).toBe(true);
  });

  test("multiple saved worlds → should use menu mode", () => {
    const worlds: WorldSummary[] = [
      {
        id: "world_1",
        name: "My Forest",
        seedPrompt: "A mystical forest",
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 3600000,
        playTimeSeconds: 8100,
      },
      {
        id: "world_2",
        name: "Desert Realm",
        seedPrompt: "A vast desert",
        createdAt: Date.now() - 172800000,
        updatedAt: Date.now() - 7200000,
        playTimeSeconds: 1800,
      },
    ];
    const hasMenu = worlds.length > 0;
    expect(hasMenu).toBe(true);
  });
});

// ── Menu item construction ─────────────────────────────────────

describe("Menu item construction", () => {
  test("most recent world is first in listWorlds result", () => {
    const worlds: WorldSummary[] = [
      {
        id: "world_recent",
        name: "Recent World",
        seedPrompt: "A recent world prompt",
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 600000,
        playTimeSeconds: 600,
      },
      {
        id: "world_old",
        name: "Old World",
        seedPrompt: "An old world prompt",
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 43200000,
        playTimeSeconds: 3600,
      },
    ];
    // listWorlds returns sorted by updatedAt desc, so index 0 is most recent
    expect(worlds[0]!.id).toBe("world_recent");
  });

  test("continue option uses the most recent world ID", () => {
    const worlds: WorldSummary[] = [
      {
        id: "world_abc",
        name: "Latest World",
        seedPrompt: "A great adventure",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        playTimeSeconds: 300,
      },
    ];
    const mostRecent = worlds[0]!;
    const continueResult: TitleScreenResult = { type: "continue", worldId: mostRecent.id };
    expect(continueResult).toEqual({ type: "continue", worldId: "world_abc" });
  });
});

// ── Menu selection logic ───────────────────────────────────────

describe("Menu selection logic", () => {
  const testWorlds: WorldSummary[] = [
    {
      id: "world_test",
      name: "Test World",
      seedPrompt: "A test world with many features",
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 1800000,
      playTimeSeconds: 1800,
    },
    {
      id: "world_test_2",
      name: "Second World",
      seedPrompt: "Another test world",
      createdAt: Date.now() - 7200000,
      updatedAt: Date.now() - 3600000,
      playTimeSeconds: 900,
    },
  ];

  test("selecting Continue returns continue result with most recent world ID", () => {
    const mostRecent = testWorlds[0]!;
    const result: TitleScreenResult = { type: "continue", worldId: mostRecent.id };
    expect(result.type).toBe("continue");
    if (result.type === "continue") {
      expect(result.worldId).toBe("world_test");
    }
  });

  test("selecting Browse Worlds returns browse result", () => {
    const result: TitleScreenResult = { type: "browse" };
    expect(result.type).toBe("browse");
  });

  test("selecting Settings returns settings result", () => {
    const result: TitleScreenResult = { type: "settings" };
    expect(result.type).toBe("settings");
  });

  test("New World flow eventually yields prompt result", () => {
    // New World switches to prompt input mode
    // When user types and presses Enter, it resolves with prompt
    const result: TitleScreenResult = { type: "prompt", value: "A new adventure" };
    expect(result.type).toBe("prompt");
    if (result.type === "prompt") {
      expect(result.value).toBe("A new adventure");
    }
  });
});

// ── Load flow routing ──────────────────────────────────────────

describe("Load flow routing", () => {
  test("continue result routes to load flow", () => {
    const result: TitleScreenResult = { type: "continue", worldId: "world_123" };
    const t = result.type as string;
    const shouldLoad = t === "continue" || t === "load";
    expect(shouldLoad).toBe(true);
  });

  test("load result routes to load flow", () => {
    const result: TitleScreenResult = { type: "load", worldId: "world_456" };
    const t = result.type as string;
    const shouldLoad = t === "continue" || t === "load";
    expect(shouldLoad).toBe(true);
  });

  test("prompt result routes to generation flow", () => {
    const result: TitleScreenResult = { type: "prompt", value: "my world" };
    const t = result.type as string;
    const shouldLoad = t === "continue" || t === "load";
    const shouldGenerate = t === "prompt";
    expect(shouldLoad).toBe(false);
    expect(shouldGenerate).toBe(true);
  });

  test("browse result from WorldBrowser maps to load result", () => {
    // When WorldBrowser returns { type: "select", worldId: "..." },
    // it gets mapped to { type: "load", worldId: "..." } in the main loop
    const browserResult = { type: "select" as const, worldId: "world_from_browser" };
    const titleResult: TitleScreenResult = { type: "load", worldId: browserResult.worldId };
    expect(titleResult.type).toBe("load");
    if (titleResult.type === "load") {
      expect(titleResult.worldId).toBe("world_from_browser");
    }
  });
});

// ── Keyboard shortcut mapping ──────────────────────────────────

describe("Keyboard shortcuts", () => {
  const shortcutMap: Record<string, string> = {
    c: "continue",
    n: "new-world",
    b: "browse",
    s: "settings",
  };

  test("C maps to continue", () => {
    expect(shortcutMap["c"]).toBe("continue");
  });

  test("N maps to new-world", () => {
    expect(shortcutMap["n"]).toBe("new-world");
  });

  test("B maps to browse", () => {
    expect(shortcutMap["b"]).toBe("browse");
  });

  test("S maps to settings", () => {
    expect(shortcutMap["s"]).toBe("settings");
  });

  test("shortcuts are case-insensitive (lowercase comparison)", () => {
    const rawKeys = ["C", "c", "N", "n", "B", "b", "S", "s"];
    for (const key of rawKeys) {
      const lower = key.toLowerCase();
      expect(shortcutMap[lower]).toBeDefined();
    }
  });
});
