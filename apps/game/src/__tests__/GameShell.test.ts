import { describe, test, expect, afterEach } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { GameShell } from "../GameShell.ts";
import type { ZoneData, TileCell, TileLayer } from "@daydream/renderer";

// Build a small zone for testing
function buildSmallZone(width = 20, height = 15): ZoneData {
  const empty: TileCell = { char: "", fg: "#000000" };
  const passable: TileCell = { char: "0", fg: "#000000" };
  const ground: TileCell[] = new Array(width * height).fill({
    char: ".",
    fg: "#228B22",
    bg: "#1a3a1a",
  });
  const objects: TileCell[] = new Array(width * height).fill(empty);
  const collision: TileCell[] = new Array(width * height).fill(passable);

  // Add a wall at (5, 5) for collision testing
  collision[5 * width + 5] = { char: "1", fg: "#000000" };

  const layers: TileLayer[] = [
    { name: "ground", data: ground, width, height },
    { name: "objects", data: objects, width, height },
    { name: "collision", data: collision, width, height },
  ];

  return { id: "test_zone", width, height, layers };
}

let cleanup: (() => void) | null = null;

afterEach(() => {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
});

describe("GameShell", () => {
  test("creates layout with viewport, side panel, and narrative bar", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    cleanup = () => renderer.destroy();

    const zone = buildSmallZone();
    const shell = new GameShell(renderer, zone, 3, 3);

    // Layout components should exist
    expect(shell.contextPanel).toBeDefined();
    expect(shell.miniMap).toBeDefined();
    expect(shell.narrativeBar).toBeDefined();

    // Renderer root should have children (topRow + narrativeBar)
    expect(renderer.root.getChildrenCount()).toBe(2);
  });

  test("starts in exploration mode", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    cleanup = () => renderer.destroy();

    const zone = buildSmallZone();
    const shell = new GameShell(renderer, zone, 3, 3);

    expect(shell.currentMode).toBe("exploration");
  });

  test("renders without errors after start()", async () => {
    const { renderer, renderOnce } = await createTestRenderer({
      width: 100,
      height: 30,
    });
    cleanup = () => renderer.destroy();

    const zone = buildSmallZone();
    const shell = new GameShell(renderer, zone, 3, 3);

    // start() should not throw
    shell.start();
    await renderOnce();
  });

  test("handles viewport keyboard input for movement", async () => {
    const { renderer, mockInput, renderOnce } = await createTestRenderer({
      width: 100,
      height: 30,
    });
    cleanup = () => renderer.destroy();

    const zone = buildSmallZone();
    const shell = new GameShell(renderer, zone, 3, 3);
    shell.start();
    await renderOnce();

    // Press arrow key to move — should not throw
    mockInput.pressArrow("right");
    await renderOnce();

    // Press WASD
    mockInput.pressKey("d");
    await renderOnce();

    // Press vim keys
    mockInput.pressKey("l");
    await renderOnce();
  });

  test("context panel can be updated", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    cleanup = () => renderer.destroy();

    const zone = buildSmallZone();
    const shell = new GameShell(renderer, zone, 3, 3);

    // Update context panel — should not throw
    shell.contextPanel.update({
      location: "Dark Cave",
      timeOfDay: "Night",
      nearbyNPCs: ["Goblin", "Bat"],
    });
  });

  test("narrative bar accepts text lines", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    cleanup = () => renderer.destroy();

    const zone = buildSmallZone();
    const shell = new GameShell(renderer, zone, 3, 3);

    // Add narrative lines — should not throw
    shell.narrativeBar.addLine("A strange wind blows...");
    shell.narrativeBar.addLine("You hear footsteps in the distance.");

    // Clear — should not throw
    shell.narrativeBar.clear();
  });

  test("handles terminal resize", async () => {
    const { renderer, renderOnce, resize } = await createTestRenderer({
      width: 100,
      height: 30,
    });
    cleanup = () => renderer.destroy();

    const zone = buildSmallZone();
    const shell = new GameShell(renderer, zone, 3, 3);
    shell.start();
    await renderOnce();

    // Resize terminal — should not throw
    resize(120, 40);
    await renderOnce();

    // Resize to minimum dimensions
    resize(80, 24);
    await renderOnce();
  });

  test("destroy cleans up renderer", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });

    const zone = buildSmallZone();
    const shell = new GameShell(renderer, zone, 3, 3);

    // destroy should not throw
    shell.destroy();
    cleanup = null; // Already destroyed
  });
});
