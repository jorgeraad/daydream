import { describe, test, expect } from "bun:test";
import { EventBus } from "@daydream/engine";
import type { Character } from "@daydream/engine";
import { InputRouter } from "../InputRouter.ts";

function makeCharacter(id: string, x: number, y: number): Character {
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

describe("InputRouter", () => {
  describe("mode management", () => {
    test("starts in exploration mode", () => {
      const router = new InputRouter(new EventBus());
      expect(router.mode).toBe("exploration");
    });

    test("setMode changes the current mode", () => {
      const router = new InputRouter(new EventBus());
      router.setMode("dialogue");
      expect(router.mode).toBe("dialogue");
    });

    test("emits mode:changed event on mode switch", () => {
      const eventBus = new EventBus();
      const router = new InputRouter(eventBus);

      let emitted: { from: string; to: string } | null = null;
      eventBus.on("mode:changed", (data) => {
        emitted = data;
      });

      router.setMode("menu");
      expect(emitted).toEqual({ from: "exploration", to: "menu" });
    });

    test("does not emit event when setting same mode", () => {
      const eventBus = new EventBus();
      const router = new InputRouter(eventBus);

      let callCount = 0;
      eventBus.on("mode:changed", () => {
        callCount++;
      });

      router.setMode("exploration"); // already in exploration
      expect(callCount).toBe(0);
    });
  });

  describe("exploration mode", () => {
    test("movement keys trigger tryMove", () => {
      const eventBus = new EventBus();
      const router = new InputRouter(eventBus);

      const moves: [number, number][] = [];
      router.setMovementContext({
        playerX: 5,
        playerY: 5,
        characters: [],
        tryMove(dx, dy) {
          moves.push([dx, dy]);
        },
      });

      router.handleKey({ name: "ArrowUp" });
      router.handleKey({ name: "ArrowDown" });
      router.handleKey({ name: "ArrowLeft" });
      router.handleKey({ name: "ArrowRight" });
      router.handleKey({ name: "w" });
      router.handleKey({ name: "a" });
      router.handleKey({ name: "s" });
      router.handleKey({ name: "d" });
      router.handleKey({ name: "k" });
      router.handleKey({ name: "h" });
      router.handleKey({ name: "j" });
      router.handleKey({ name: "l" });

      expect(moves).toEqual([
        [0, -1], [0, 1], [-1, 0], [1, 0],   // arrows
        [0, -1], [-1, 0], [0, 1], [1, 0],    // wasd
        [0, -1], [-1, 0], [0, 1], [1, 0],    // hjkl
      ]);
    });

    test("escape switches to menu mode", () => {
      const router = new InputRouter(new EventBus());
      router.handleKey({ name: "escape" });
      expect(router.mode).toBe("menu");
    });

    test("e key triggers interaction with adjacent character", () => {
      const eventBus = new EventBus();
      const router = new InputRouter(eventBus);

      const adjacent = makeCharacter("guard", 6, 5);
      router.setMovementContext({
        playerX: 5,
        playerY: 5,
        characters: [adjacent],
        tryMove() {},
      });

      let interactedWith: string | null = null;
      eventBus.on("character:interact", ({ characterId }) => {
        interactedWith = characterId;
      });

      router.handleKey({ name: "e" });
      expect(interactedWith).toBe("guard");
    });

    test("e key does nothing when no adjacent character", () => {
      const eventBus = new EventBus();
      const router = new InputRouter(eventBus);

      const far = makeCharacter("far_npc", 20, 20);
      router.setMovementContext({
        playerX: 5,
        playerY: 5,
        characters: [far],
        tryMove() {},
      });

      let interacted = false;
      eventBus.on("character:interact", () => {
        interacted = true;
      });

      router.handleKey({ name: "e" });
      expect(interacted).toBe(false);
    });
  });

  describe("dialogue mode", () => {
    test("escape returns to exploration mode", () => {
      const router = new InputRouter(new EventBus());
      router.setMode("dialogue");
      router.handleKey({ name: "escape" });
      expect(router.mode).toBe("exploration");
    });
  });

  describe("menu mode", () => {
    test("escape returns to exploration mode", () => {
      const router = new InputRouter(new EventBus());
      router.setMode("menu");
      router.handleKey({ name: "escape" });
      expect(router.mode).toBe("exploration");
    });
  });
});
