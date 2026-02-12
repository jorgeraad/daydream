import { describe, expect, mock, test } from "bun:test";
import { EventBus } from "./EventSystem.ts";

describe("EventBus", () => {
  test("on + emit calls handler with data", () => {
    const bus = new EventBus();
    const handler = mock(() => {});

    bus.on("zone:entered", handler);
    bus.emit("zone:entered", { zoneId: "zone_0_0" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ zoneId: "zone_0_0" });
  });

  test("multiple handlers are called", () => {
    const bus = new EventBus();
    const handler1 = mock(() => {});
    const handler2 = mock(() => {});

    bus.on("player:moved", handler1);
    bus.on("player:moved", handler2);
    bus.emit("player:moved", { position: { x: 5, y: 5 }, zone: "zone_0_0" });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  test("off removes handler", () => {
    const bus = new EventBus();
    const handler = mock(() => {});

    bus.on("zone:entered", handler);
    bus.off("zone:entered", handler);
    bus.emit("zone:entered", { zoneId: "zone_0_0" });

    expect(handler).not.toHaveBeenCalled();
  });

  test("off only removes the specified handler", () => {
    const bus = new EventBus();
    const handler1 = mock(() => {});
    const handler2 = mock(() => {});

    bus.on("zone:entered", handler1);
    bus.on("zone:entered", handler2);
    bus.off("zone:entered", handler1);
    bus.emit("zone:entered", { zoneId: "zone_0_0" });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  test("emit with no listeners does nothing", () => {
    const bus = new EventBus();
    // Should not throw
    bus.emit("zone:entered", { zoneId: "zone_0_0" });
  });

  test("different events are independent", () => {
    const bus = new EventBus();
    const zoneHandler = mock(() => {});
    const moveHandler = mock(() => {});

    bus.on("zone:entered", zoneHandler);
    bus.on("player:moved", moveHandler);

    bus.emit("zone:entered", { zoneId: "zone_0_0" });

    expect(zoneHandler).toHaveBeenCalledTimes(1);
    expect(moveHandler).not.toHaveBeenCalled();
  });

  test("listenerCount returns correct count", () => {
    const bus = new EventBus();
    expect(bus.listenerCount("zone:entered")).toBe(0);

    const handler = () => {};
    bus.on("zone:entered", handler);
    expect(bus.listenerCount("zone:entered")).toBe(1);

    bus.on("zone:entered", () => {});
    expect(bus.listenerCount("zone:entered")).toBe(2);

    bus.off("zone:entered", handler);
    expect(bus.listenerCount("zone:entered")).toBe(1);
  });

  test("removeAllListeners for specific event", () => {
    const bus = new EventBus();
    const handler1 = mock(() => {});
    const handler2 = mock(() => {});
    const otherHandler = mock(() => {});

    bus.on("zone:entered", handler1);
    bus.on("zone:entered", handler2);
    bus.on("player:moved", otherHandler);

    bus.removeAllListeners("zone:entered");
    bus.emit("zone:entered", { zoneId: "zone_0_0" });
    bus.emit("player:moved", { position: { x: 0, y: 0 }, zone: "zone_0_0" });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
    expect(otherHandler).toHaveBeenCalledTimes(1);
  });

  test("removeAllListeners with no argument clears everything", () => {
    const bus = new EventBus();
    const handler1 = mock(() => {});
    const handler2 = mock(() => {});

    bus.on("zone:entered", handler1);
    bus.on("player:moved", handler2);

    bus.removeAllListeners();
    bus.emit("zone:entered", { zoneId: "zone_0_0" });
    bus.emit("player:moved", { position: { x: 0, y: 0 }, zone: "zone_0_0" });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  test("handler receives correct data shape", () => {
    const bus = new EventBus();
    const results: Array<{ from: string; to: string }> = [];

    bus.on("mode:changed", (data) => {
      results.push(data);
    });

    bus.emit("mode:changed", { from: "exploration", to: "dialogue" });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ from: "exploration", to: "dialogue" });
  });
});
