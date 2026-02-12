import { describe, test, expect } from "bun:test";
import { ViewportManager } from "../ViewportManager.ts";

describe("ViewportManager", () => {
  test("centers camera on player", () => {
    const vm = new ViewportManager(20, 10);
    vm.updateCamera(30, 15, 80, 40);

    // Player at (30,15), viewport 20x10 → camera at (20, 10)
    expect(vm.cameraX).toBe(20);
    expect(vm.cameraY).toBe(10);
  });

  test("clamps camera to top-left boundary", () => {
    const vm = new ViewportManager(20, 10);
    vm.updateCamera(2, 1, 80, 40);

    // Player near origin → camera clamps to (0, 0)
    expect(vm.cameraX).toBe(0);
    expect(vm.cameraY).toBe(0);
  });

  test("clamps camera to bottom-right boundary", () => {
    const vm = new ViewportManager(20, 10);
    vm.updateCamera(78, 38, 80, 40);

    // Player near bottom-right → camera clamps to (60, 30)
    expect(vm.cameraX).toBe(60);
    expect(vm.cameraY).toBe(30);
  });

  test("handles zone smaller than viewport", () => {
    const vm = new ViewportManager(20, 10);
    vm.updateCamera(5, 3, 10, 5);

    // Zone is smaller than viewport → camera at (0, 0)
    expect(vm.cameraX).toBe(0);
    expect(vm.cameraY).toBe(0);
  });

  test("worldToScreen converts coordinates within viewport", () => {
    const vm = new ViewportManager(20, 10);
    vm.updateCamera(30, 15, 80, 40);
    // camera at (20, 10), so (35, 19) → screen (15, 9)
    const pos = vm.worldToScreen(35, 19);
    expect(pos).toEqual({ x: 15, y: 9 });
  });

  test("worldToScreen returns null for off-screen coordinates", () => {
    const vm = new ViewportManager(20, 10);
    vm.updateCamera(30, 15, 80, 40);

    expect(vm.worldToScreen(10, 10)).toBeNull();
    expect(vm.worldToScreen(55, 30)).toBeNull();
  });

  test("screenToWorld converts back to world coordinates", () => {
    const vm = new ViewportManager(20, 10);
    vm.updateCamera(30, 15, 80, 40);
    // camera at (20, 10), so screen (5, 3) → world (25, 13)
    const pos = vm.screenToWorld(5, 3);
    expect(pos).toEqual({ x: 25, y: 13 });
  });

  test("resize updates viewport dimensions", () => {
    const vm = new ViewportManager(20, 10);
    vm.resize(40, 20);

    expect(vm.viewWidth).toBe(40);
    expect(vm.viewHeight).toBe(20);

    // Re-center after resize
    vm.updateCamera(30, 15, 80, 40);
    expect(vm.cameraX).toBe(10);
    expect(vm.cameraY).toBe(5);
  });

  test("camera stays centered when viewport equals zone size", () => {
    const vm = new ViewportManager(80, 40);
    vm.updateCamera(40, 20, 80, 40);

    expect(vm.cameraX).toBe(0);
    expect(vm.cameraY).toBe(0);
  });

  test("worldToScreen for player position matches centering", () => {
    const vm = new ViewportManager(20, 10);
    vm.updateCamera(30, 15, 80, 40);

    // Player should be at screen center
    const pos = vm.worldToScreen(30, 15);
    expect(pos).toEqual({ x: 10, y: 5 });
  });
});
