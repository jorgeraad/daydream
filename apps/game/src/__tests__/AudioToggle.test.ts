import { describe, test, expect } from "bun:test";
import { EventBus } from "@daydream/engine";
import { InputRouter } from "../InputRouter.ts";

describe("InputRouter audio toggles", () => {
  test("m key triggers music audio toggle in exploration mode", () => {
    const eventBus = new EventBus();
    const router = new InputRouter(eventBus);

    const toggles: string[] = [];
    router.setAudioToggleHandler((toggle) => toggles.push(toggle));

    router.handleKey({ name: "m" });
    expect(toggles).toEqual(["music"]);
  });

  test("n key triggers sfx audio toggle in exploration mode", () => {
    const eventBus = new EventBus();
    const router = new InputRouter(eventBus);

    const toggles: string[] = [];
    router.setAudioToggleHandler((toggle) => toggles.push(toggle));

    router.handleKey({ name: "n" });
    expect(toggles).toEqual(["sfx"]);
  });

  test("m key does not trigger audio toggle in dialogue mode", () => {
    const eventBus = new EventBus();
    const router = new InputRouter(eventBus);

    const toggles: string[] = [];
    router.setAudioToggleHandler((toggle) => toggles.push(toggle));

    // Register a dialogue handler to receive keys
    const dialogueKeys: string[] = [];
    router.setDialogueHandler((key) => dialogueKeys.push(key.name));

    router.setMode("dialogue");
    router.handleKey({ name: "m" });

    expect(toggles).toEqual([]);
    expect(dialogueKeys).toEqual(["m"]);
  });

  test("n key does not trigger audio toggle in menu mode", () => {
    const eventBus = new EventBus();
    const router = new InputRouter(eventBus);

    const toggles: string[] = [];
    router.setAudioToggleHandler((toggle) => toggles.push(toggle));

    router.setMode("menu");
    router.handleKey({ name: "n" });

    expect(toggles).toEqual([]);
  });

  test("audio toggle handler can be cleared with null", () => {
    const eventBus = new EventBus();
    const router = new InputRouter(eventBus);

    const toggles: string[] = [];
    router.setAudioToggleHandler((toggle) => toggles.push(toggle));
    router.setAudioToggleHandler(null);

    router.handleKey({ name: "m" });
    router.handleKey({ name: "n" });

    expect(toggles).toEqual([]);
  });

  test("M (shift) key switches to map mode", () => {
    const eventBus = new EventBus();
    const router = new InputRouter(eventBus);

    router.handleKey({ name: "M" });
    expect(router.mode).toBe("map");
  });

  test("m key does NOT switch to map mode (reserved for music toggle)", () => {
    const eventBus = new EventBus();
    const router = new InputRouter(eventBus);

    router.handleKey({ name: "m" });
    expect(router.mode).toBe("exploration"); // stays in exploration
  });
});
