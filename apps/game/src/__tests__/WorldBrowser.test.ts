import { describe, test, expect } from "bun:test";
import {
  formatPlayTime,
  formatLastPlayed,
  truncatePrompt,
} from "../WorldBrowser.ts";

// ── formatPlayTime ─────────────────────────────────────────

describe("formatPlayTime", () => {
  test("returns '< 1m' for zero seconds", () => {
    expect(formatPlayTime(0)).toBe("< 1m");
  });

  test("returns '< 1m' for negative seconds", () => {
    expect(formatPlayTime(-10)).toBe("< 1m");
  });

  test("returns '< 1m' for less than 60 seconds", () => {
    expect(formatPlayTime(30)).toBe("< 1m");
    expect(formatPlayTime(59)).toBe("< 1m");
  });

  test("returns minutes only when under 1 hour", () => {
    expect(formatPlayTime(60)).toBe("1m");
    expect(formatPlayTime(120)).toBe("2m");
    expect(formatPlayTime(300)).toBe("5m");
    expect(formatPlayTime(3540)).toBe("59m");
  });

  test("returns hours and minutes for >= 1 hour", () => {
    expect(formatPlayTime(3600)).toBe("1h 0m");
    expect(formatPlayTime(3660)).toBe("1h 1m");
    expect(formatPlayTime(7200)).toBe("2h 0m");
    expect(formatPlayTime(7380)).toBe("2h 3m");
  });

  test("handles large values", () => {
    // 100 hours, 30 minutes
    expect(formatPlayTime(100 * 3600 + 30 * 60)).toBe("100h 30m");
  });
});

// ── formatLastPlayed ───────────────────────────────────────

describe("formatLastPlayed", () => {
  const NOW = 1707850000000; // Fixed "now" for deterministic tests

  test("returns 'Never' for zero or negative timestamp", () => {
    expect(formatLastPlayed(0, NOW)).toBe("Never");
    expect(formatLastPlayed(-1, NOW)).toBe("Never");
  });

  test("returns 'just now' for < 60 seconds ago", () => {
    expect(formatLastPlayed(NOW - 1000, NOW)).toBe("just now");
    expect(formatLastPlayed(NOW - 30_000, NOW)).toBe("just now");
    expect(formatLastPlayed(NOW - 59_000, NOW)).toBe("just now");
  });

  test("returns '1 minute ago' for exactly 1 minute", () => {
    expect(formatLastPlayed(NOW - 60_000, NOW)).toBe("1 minute ago");
    expect(formatLastPlayed(NOW - 90_000, NOW)).toBe("1 minute ago");
  });

  test("returns 'X minutes ago' for < 60 minutes", () => {
    expect(formatLastPlayed(NOW - 2 * 60_000, NOW)).toBe("2 minutes ago");
    expect(formatLastPlayed(NOW - 5 * 60_000, NOW)).toBe("5 minutes ago");
    expect(formatLastPlayed(NOW - 59 * 60_000, NOW)).toBe("59 minutes ago");
  });

  test("returns '1 hour ago' for exactly 1 hour", () => {
    expect(formatLastPlayed(NOW - 3600_000, NOW)).toBe("1 hour ago");
  });

  test("returns 'X hours ago' for < 24 hours", () => {
    expect(formatLastPlayed(NOW - 2 * 3600_000, NOW)).toBe("2 hours ago");
    expect(formatLastPlayed(NOW - 12 * 3600_000, NOW)).toBe("12 hours ago");
    expect(formatLastPlayed(NOW - 23 * 3600_000, NOW)).toBe("23 hours ago");
  });

  test("returns '1 day ago' for 24 hours", () => {
    expect(formatLastPlayed(NOW - 24 * 3600_000, NOW)).toBe("1 day ago");
  });

  test("returns 'X days ago' for < 30 days", () => {
    expect(formatLastPlayed(NOW - 3 * 24 * 3600_000, NOW)).toBe("3 days ago");
    expect(formatLastPlayed(NOW - 29 * 24 * 3600_000, NOW)).toBe("29 days ago");
  });

  test("returns absolute date for >= 30 days", () => {
    // 31 days before NOW
    const timestamp = NOW - 31 * 24 * 3600_000;
    const result = formatLastPlayed(timestamp, NOW);
    // Should be a YYYY-MM-DD format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── truncatePrompt ─────────────────────────────────────────

describe("truncatePrompt", () => {
  test("returns the full string when within limit", () => {
    expect(truncatePrompt("Hello")).toBe("Hello");
    expect(truncatePrompt("A".repeat(50))).toBe("A".repeat(50));
  });

  test("truncates and adds ellipsis when over limit", () => {
    const long = "A".repeat(60);
    const result = truncatePrompt(long);
    expect(result.length).toBe(50);
    expect(result.endsWith("...")).toBe(true);
    expect(result).toBe("A".repeat(47) + "...");
  });

  test("respects custom maxLen", () => {
    expect(truncatePrompt("Hello, world!", 5)).toBe("He...");
    expect(truncatePrompt("Hello, world!", 10)).toBe("Hello, ...");
  });

  test("handles empty string", () => {
    expect(truncatePrompt("")).toBe("");
  });

  test("handles string at exact limit", () => {
    expect(truncatePrompt("ABCDE", 5)).toBe("ABCDE");
  });
});
