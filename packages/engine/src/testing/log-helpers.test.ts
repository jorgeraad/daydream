import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { createTestLogSink } from "./log-helpers.ts";
import { EventBus } from "../event/EventSystem.ts";

describe("createTestLogSink", () => {
  const { install, teardown, getLogs, clearLogs } = createTestLogSink();

  beforeAll(install);
  afterAll(teardown);
  beforeEach(clearLogs);

  test("captures EventBus trace logs on emit", () => {
    const bus = new EventBus();
    const handler = () => {};
    bus.on("zone:entered", handler);

    bus.emit("zone:entered", { zoneId: "zone_0_0" });

    const logs = getLogs();
    const traceLog = logs.find(
      (l) => l.level === "trace" && l.category.includes("event"),
    );
    expect(traceLog).toBeDefined();
    expect(traceLog!.properties.event).toBe("zone:entered");
    expect(traceLog!.properties.listenerCount).toBe(1);
  });

  test("clearLogs resets captured entries", () => {
    const bus = new EventBus();
    bus.emit("save:started", {});
    expect(getLogs().length).toBeGreaterThan(0);

    clearLogs();
    expect(getLogs().length).toBe(0);
  });
});
