import { describe, test, expect, afterEach } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { GameInput } from "../ui/GameInput.ts";

let cleanup: (() => void) | null = null;

async function setup() {
  const result = await createTestRenderer({
    width: 80,
    height: 24,
    kittyKeyboard: true,
  });
  cleanup = () => result.renderer.destroy();
  return result;
}

afterEach(() => {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
});

describe("GameInput", () => {
  test("creates container and input with default width", async () => {
    const { renderer } = await setup();
    const gi = new GameInput(renderer, { id: "test-input" });

    expect(gi.container).toBeDefined();
    expect(gi.value).toBe("");
  });

  test("value getter/setter works", async () => {
    const { renderer } = await setup();
    const gi = new GameInput(renderer, { id: "test-input" });

    gi.value = "hello world";
    expect(gi.value).toBe("hello world");

    gi.value = "";
    expect(gi.value).toBe("");
  });

  test("initial value is set from config", async () => {
    const { renderer } = await setup();
    const gi = new GameInput(renderer, {
      id: "test-input",
      value: "initial text",
    });

    expect(gi.value).toBe("initial text");
  });

  test("focus and blur work", async () => {
    const { renderer } = await setup();
    const gi = new GameInput(renderer, { id: "test-input" });

    renderer.root.add(gi.container);
    gi.focus();
    expect(gi.focused).toBe(true);

    gi.blur();
    expect(gi.focused).toBe(false);
  });

  test("destroy blurs the input", async () => {
    const { renderer } = await setup();
    const gi = new GameInput(renderer, { id: "test-input" });

    renderer.root.add(gi.container);
    gi.focus();
    expect(gi.focused).toBe(true);

    gi.destroy();
    expect(gi.focused).toBe(false);
  });

  test("onSubmit fires with current value on Enter", async () => {
    const { renderer, mockInput } = await setup();
    let submitted: string | null = null;

    const gi = new GameInput(renderer, {
      id: "test-input",
      onSubmit: (val) => { submitted = val; },
    });

    renderer.root.add(gi.container);
    gi.focus();

    await mockInput.typeText("test prompt");
    mockInput.pressEnter();

    expect(submitted).toBe("test prompt");
  });

  test("onCancel fires on Escape key", async () => {
    const { renderer, mockInput } = await setup();
    let cancelled = false;

    const gi = new GameInput(renderer, {
      id: "test-input",
      onCancel: () => { cancelled = true; },
    });

    renderer.root.add(gi.container);
    gi.focus();

    // pressEscape sends \x1b which may be ambiguous in non-kitty mode.
    // Use pressKey with explicit ESCAPE sequence instead.
    mockInput.pressKey("ESCAPE");

    expect(cancelled).toBe(true);
  });

  test("onChange fires on content change", async () => {
    const { renderer, mockInput } = await setup();
    const changes: string[] = [];

    const gi = new GameInput(renderer, {
      id: "test-input",
      onChange: (val) => { changes.push(val); },
    });

    renderer.root.add(gi.container);
    gi.focus();

    await mockInput.typeText("a");

    expect(changes.length).toBeGreaterThan(0);
    expect(changes[changes.length - 1]).toBe("a");
  });
});
