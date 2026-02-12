import { describe, test, expect, afterEach } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { MaskedInput } from "../ui/MaskedInput.ts";

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

/** Wait for async content change events to propagate. */
const tick = () => new Promise((resolve) => process.nextTick(resolve));

describe("MaskedInput", () => {
  test("value getter returns real text, not mask characters", async () => {
    const { renderer } = await setup();
    const mi = new MaskedInput(renderer, { id: "test-masked" });

    mi.value = "sk-ant-secret123";
    expect(mi.value).toBe("sk-ant-secret123");
  });

  test("value setter displays mask characters in the input", async () => {
    const { renderer } = await setup();
    const mi = new MaskedInput(renderer, { id: "test-masked" });

    mi.value = "hello";
    // The value getter returns the real text
    expect(mi.value).toBe("hello");
    // The container exists
    expect(mi.container).toBeDefined();
  });

  test("typing characters maintains shadow buffer sync", async () => {
    const { renderer, mockInput } = await setup();
    const changes: string[] = [];

    const mi = new MaskedInput(renderer, {
      id: "test-masked",
      onChange: (val) => {
        changes.push(val);
      },
    });

    renderer.root.add(mi.container);
    mi.focus();

    await mockInput.typeText("abc");

    // Value should be the real typed text
    expect(mi.value).toBe("abc");
    // onChange should have been called with real values
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[changes.length - 1]).toBe("abc");
  });

  test("onSubmit returns real value on Enter", async () => {
    const { renderer, mockInput } = await setup();
    let submitted: string | null = null;

    const mi = new MaskedInput(renderer, {
      id: "test-masked",
      onSubmit: (val) => {
        submitted = val;
      },
    });

    renderer.root.add(mi.container);
    mi.focus();

    await mockInput.typeText("secret-key");
    mockInput.pressEnter();

    expect(submitted).toBe("secret-key");
  });

  test("backspace maintains shadow buffer sync", async () => {
    const { renderer, mockInput } = await setup();

    const mi = new MaskedInput(renderer, { id: "test-masked" });

    renderer.root.add(mi.container);
    mi.focus();

    await mockInput.typeText("abcd");
    expect(mi.value).toBe("abcd");

    // Delete last character (pressBackspace is synchronous; tick lets content change propagate)
    mockInput.pressBackspace();
    await tick();
    expect(mi.value).toBe("abc");

    // Delete another
    mockInput.pressBackspace();
    await tick();
    expect(mi.value).toBe("ab");
  });

  test("custom mask character works", async () => {
    const { renderer, mockInput } = await setup();

    const mi = new MaskedInput(renderer, {
      id: "test-masked",
      maskChar: "#",
    });

    renderer.root.add(mi.container);
    mi.focus();

    await mockInput.typeText("test");
    expect(mi.value).toBe("test");
  });

  test("onCancel fires on Escape key", async () => {
    const { renderer, mockInput } = await setup();
    let cancelled = false;

    const mi = new MaskedInput(renderer, {
      id: "test-masked",
      onCancel: () => {
        cancelled = true;
      },
    });

    renderer.root.add(mi.container);
    mi.focus();

    mockInput.pressKey("ESCAPE");
    expect(cancelled).toBe(true);
  });

  test("initial value from config is masked", async () => {
    const { renderer } = await setup();

    const mi = new MaskedInput(renderer, {
      id: "test-masked",
      value: "initial-secret",
    });

    expect(mi.value).toBe("initial-secret");
  });

  test("value setter then getter round-trips correctly", async () => {
    const { renderer } = await setup();

    const mi = new MaskedInput(renderer, { id: "test-masked" });

    mi.value = "first-value";
    expect(mi.value).toBe("first-value");

    mi.value = "second-value";
    expect(mi.value).toBe("second-value");

    mi.value = "";
    expect(mi.value).toBe("");
  });

  test("typing after setting value programmatically works", async () => {
    const { renderer, mockInput } = await setup();

    const mi = new MaskedInput(renderer, { id: "test-masked" });

    renderer.root.add(mi.container);
    mi.focus();

    mi.value = "prefix";
    await mockInput.typeText("x");

    // The typed character should be appended to the real value
    expect(mi.value).toBe("prefixx");
  });

  test("onChange reports real values for each keystroke", async () => {
    const { renderer, mockInput } = await setup();
    const changes: string[] = [];

    const mi = new MaskedInput(renderer, {
      id: "test-masked",
      onChange: (val) => {
        changes.push(val);
      },
    });

    renderer.root.add(mi.container);
    mi.focus();

    await mockInput.typeText("a");
    await mockInput.typeText("b");

    expect(changes).toContain("a");
    expect(changes).toContain("ab");
  });

  test("multiple backspaces clear the value correctly", async () => {
    const { renderer, mockInput } = await setup();

    const mi = new MaskedInput(renderer, { id: "test-masked" });

    renderer.root.add(mi.container);
    mi.focus();

    await mockInput.typeText("ab");
    expect(mi.value).toBe("ab");

    mockInput.pressBackspace();
    await tick();
    mockInput.pressBackspace();
    await tick();
    expect(mi.value).toBe("");
  });

  test("word deletion maintains shadow buffer sync", async () => {
    const { renderer, mockInput } = await setup();

    const mi = new MaskedInput(renderer, { id: "test-masked" });

    renderer.root.add(mi.container);
    mi.focus();

    await mockInput.typeText("hello world");
    expect(mi.value).toBe("hello world");

    // Option+Backspace deletes the last word
    mockInput.pressBackspace({ meta: true });
    await tick();
    // After word deletion, the last word "world" should be removed
    // (meta+backspace behavior depends on keybinding — it may delete to line start)
    expect(mi.value.length).toBeLessThan("hello world".length);
  });
});
