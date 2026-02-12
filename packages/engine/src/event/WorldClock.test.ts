import { describe, expect, test } from "bun:test";
import { WorldClock } from "./WorldClock.ts";

describe("WorldClock", () => {
  // ── Construction ──────────────────────────────────────────

  test("defaults to 8:00 AM start time", () => {
    const clock = new WorldClock();
    expect(clock.getHour()).toBe(8);
    expect(clock.getMinute()).toBe(0);
    expect(clock.getGameTime()).toBe(480);
  });

  test("accepts custom start time", () => {
    const clock = new WorldClock({ startTime: 720 }); // noon
    expect(clock.getHour()).toBe(12);
    expect(clock.getMinute()).toBe(0);
  });

  test("accepts custom game speed", () => {
    const clock = new WorldClock({ gameMinutesPerRealSecond: 4 });
    clock.advance(1000); // 1 real second
    // 4 game-minutes per real second = 4 minutes advanced
    expect(clock.getGameTime()).toBe(480 + 4);
  });

  // ── Time Advancement ─────────────────────────────────────

  test("advance converts real time to game time", () => {
    const clock = new WorldClock({ startTime: 0 });
    // Default: 2 game-minutes per real second
    clock.advance(1000); // 1 real second → 2 game minutes
    expect(clock.getGameTime()).toBe(2);
  });

  test("advance handles fractional seconds", () => {
    const clock = new WorldClock({ startTime: 0 });
    clock.advance(500); // 0.5 real seconds → 1 game minute
    expect(clock.getGameTime()).toBe(1);
  });

  test("advance accumulates over multiple calls", () => {
    const clock = new WorldClock({ startTime: 0 });
    clock.advance(1000);
    clock.advance(1000);
    clock.advance(1000);
    expect(clock.getGameTime()).toBe(6);
  });

  // ── Time of Day ───────────────────────────────────────────

  test("getTimeOfDay returns night for 0:00-4:59", () => {
    const clock = new WorldClock({ startTime: 0 }); // midnight
    expect(clock.getTimeOfDay()).toBe("night");

    clock.setGameTime(4 * 60 + 59); // 4:59 AM
    expect(clock.getTimeOfDay()).toBe("night");
  });

  test("getTimeOfDay returns dawn for 5:00-6:59", () => {
    const clock = new WorldClock({ startTime: 5 * 60 }); // 5:00 AM
    expect(clock.getTimeOfDay()).toBe("dawn");

    clock.setGameTime(6 * 60 + 59); // 6:59 AM
    expect(clock.getTimeOfDay()).toBe("dawn");
  });

  test("getTimeOfDay returns morning for 7:00-11:59", () => {
    const clock = new WorldClock({ startTime: 7 * 60 }); // 7:00 AM
    expect(clock.getTimeOfDay()).toBe("morning");

    clock.setGameTime(11 * 60 + 59); // 11:59 AM
    expect(clock.getTimeOfDay()).toBe("morning");
  });

  test("getTimeOfDay returns afternoon for 12:00-16:59", () => {
    const clock = new WorldClock({ startTime: 12 * 60 }); // noon
    expect(clock.getTimeOfDay()).toBe("afternoon");

    clock.setGameTime(16 * 60 + 59); // 4:59 PM
    expect(clock.getTimeOfDay()).toBe("afternoon");
  });

  test("getTimeOfDay returns dusk for 17:00-18:59", () => {
    const clock = new WorldClock({ startTime: 17 * 60 }); // 5:00 PM
    expect(clock.getTimeOfDay()).toBe("dusk");

    clock.setGameTime(18 * 60 + 59); // 6:59 PM
    expect(clock.getTimeOfDay()).toBe("dusk");
  });

  test("getTimeOfDay returns evening for 19:00-21:59", () => {
    const clock = new WorldClock({ startTime: 19 * 60 }); // 7:00 PM
    expect(clock.getTimeOfDay()).toBe("evening");

    clock.setGameTime(21 * 60 + 59); // 9:59 PM
    expect(clock.getTimeOfDay()).toBe("evening");
  });

  test("getTimeOfDay returns night for 22:00-23:59", () => {
    const clock = new WorldClock({ startTime: 22 * 60 }); // 10:00 PM
    expect(clock.getTimeOfDay()).toBe("night");

    clock.setGameTime(23 * 60 + 59); // 11:59 PM
    expect(clock.getTimeOfDay()).toBe("night");
  });

  // ── Day Number ────────────────────────────────────────────

  test("getDayNumber starts at 1", () => {
    const clock = new WorldClock({ startTime: 0 });
    expect(clock.getDayNumber()).toBe(1);
  });

  test("getDayNumber increments after 1440 minutes", () => {
    const clock = new WorldClock({ startTime: 1440 }); // exactly day 2
    expect(clock.getDayNumber()).toBe(2);
  });

  test("getDayNumber tracks across advances", () => {
    const clock = new WorldClock({ startTime: 1439 }); // last minute of day 1
    expect(clock.getDayNumber()).toBe(1);

    clock.advance(500); // +1 game minute → 1440 = day 2
    expect(clock.getDayNumber()).toBe(2);
  });

  // ── Hour and Minute ───────────────────────────────────────

  test("getHour wraps at 24", () => {
    const clock = new WorldClock({ startTime: 1440 + 180 }); // day 2, 3:00 AM
    expect(clock.getHour()).toBe(3);
  });

  test("getMinute returns minutes within the hour", () => {
    const clock = new WorldClock({ startTime: 8 * 60 + 30 }); // 8:30 AM
    expect(clock.getHour()).toBe(8);
    expect(clock.getMinute()).toBe(30);
  });

  // ── setGameTime ───────────────────────────────────────────

  test("setGameTime overrides current time", () => {
    const clock = new WorldClock();
    clock.setGameTime(720);
    expect(clock.getGameTime()).toBe(720);
    expect(clock.getHour()).toBe(12);
  });
});
