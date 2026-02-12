import { describe, expect, it, mock } from "bun:test";
import { Chronicle, type CompressionProvider } from "./Chronicle.ts";
import type { ChronicleEntry } from "../types.ts";

function makeEntry(overrides: Partial<ChronicleEntry> = {}): ChronicleEntry {
  return {
    id: `entry_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    gameTime: 1000,
    type: "event",
    zone: "zone_0_0",
    summary: "Something happened",
    ...overrides,
  };
}

describe("Chronicle", () => {
  describe("append and query", () => {
    it("appends entries and retrieves them", () => {
      const chronicle = new Chronicle();
      const entry = makeEntry({ summary: "The hero arrived" });
      chronicle.append(entry);

      expect(chronicle.getEntries()).toHaveLength(1);
      expect(chronicle.getEntries()[0]!.summary).toBe("The hero arrived");
    });

    it("returns recent entries in order", () => {
      const chronicle = new Chronicle();
      chronicle.append(makeEntry({ summary: "First" }));
      chronicle.append(makeEntry({ summary: "Second" }));
      chronicle.append(makeEntry({ summary: "Third" }));

      const recent = chronicle.getRecentEntries(2);
      expect(recent).toHaveLength(2);
      expect(recent[0]!.summary).toBe("Second");
      expect(recent[1]!.summary).toBe("Third");
    });

    it("tracks unsaved entries and clears them", () => {
      const chronicle = new Chronicle();
      chronicle.append(makeEntry());
      chronicle.append(makeEntry());

      const unsaved = chronicle.getUnsavedEntries();
      expect(unsaved).toHaveLength(2);

      const unsavedAgain = chronicle.getUnsavedEntries();
      expect(unsavedAgain).toHaveLength(0);

      // Original entries are still there
      expect(chronicle.getEntries()).toHaveLength(2);
    });

    it("filters entries by type", () => {
      const chronicle = new Chronicle();
      chronicle.append(makeEntry({ type: "conversation", summary: "Talked to guard" }));
      chronicle.append(makeEntry({ type: "event", summary: "Storm began" }));
      chronicle.append(makeEntry({ type: "player_action", summary: "Opened door" }));
      chronicle.append(makeEntry({ type: "conversation", summary: "Talked to merchant" }));

      const conversations = chronicle.getEntriesByType("conversation");
      expect(conversations).toHaveLength(2);
    });

    it("filters entries by zone", () => {
      const chronicle = new Chronicle();
      chronicle.append(makeEntry({ zone: "zone_0_0", summary: "In village" }));
      chronicle.append(makeEntry({ zone: "zone_1_0", summary: "In forest" }));
      chronicle.append(makeEntry({ zone: "zone_0_0", summary: "Back in village" }));

      const villageEntries = chronicle.getEntriesByZone("zone_0_0");
      expect(villageEntries).toHaveLength(2);
    });

    it("returns recent player actions", () => {
      const chronicle = new Chronicle();
      chronicle.append(makeEntry({ type: "player_action", summary: "Walked north" }));
      chronicle.append(makeEntry({ type: "event", summary: "Rain started" }));
      chronicle.append(makeEntry({ type: "player_action", summary: "Opened chest" }));
      chronicle.append(makeEntry({ type: "player_action", summary: "Talked to NPC" }));

      const actions = chronicle.getRecentPlayerActions(2);
      expect(actions).toHaveLength(2);
      expect(actions[0]!.summary).toBe("Opened chest");
      expect(actions[1]!.summary).toBe("Talked to NPC");
    });
  });

  describe("context window", () => {
    it("returns formatted context within budget", () => {
      const chronicle = new Chronicle();
      chronicle.historicalSummary = "Long ago, the kingdom fell.";
      chronicle.recentSummary = "A stranger arrived at dawn.";
      chronicle.append(makeEntry({ summary: "The tavern door creaked open" }));

      const context = chronicle.getContextWindow(2000);
      expect(context).toContain("## World History");
      expect(context).toContain("Long ago, the kingdom fell.");
      expect(context).toContain("## Recent Events");
      expect(context).toContain("A stranger arrived at dawn.");
      expect(context).toContain("The tavern door creaked open");
    });

    it("includes active threads with tension levels", () => {
      const chronicle = new Chronicle();
      chronicle.addThread("mystery", "Who stole the crown?", 7);
      chronicle.addThread("romance", "The innkeeper's daughter", 3);

      const context = chronicle.getContextWindow(2000);
      expect(context).toContain("## Active Threads");
      expect(context).toContain("Who stole the crown? (tension: 7/10)");
      expect(context).toContain("The innkeeper's daughter (tension: 3/10)");
    });

    it("respects budget by limiting entries", () => {
      const chronicle = new Chronicle();
      for (let i = 0; i < 100; i++) {
        chronicle.append(makeEntry({ summary: `Event number ${i} with a long description that takes up space` }));
      }

      const smallContext = chronicle.getContextWindow(200);
      const largeContext = chronicle.getContextWindow(5000);
      expect(smallContext.length).toBeLessThan(largeContext.length);
    });

    it("returns empty sections gracefully when no data", () => {
      const chronicle = new Chronicle();
      const context = chronicle.getContextWindow(2000);
      // Should not contain section headers for empty summaries
      expect(context).not.toContain("## World History");
      expect(context).not.toContain("## Recent Events");
    });
  });

  describe("narrative thread lifecycle", () => {
    it("creates a thread with default tension", () => {
      const chronicle = new Chronicle();
      const thread = chronicle.addThread("mystery", "Who is the masked stranger?");

      expect(thread.id).toBe("mystery");
      expect(thread.summary).toBe("Who is the masked stranger?");
      expect(thread.active).toBe(true);
      expect(thread.tension).toBe(3);
      expect(thread.entries).toEqual([]);
    });

    it("creates a thread with custom tension", () => {
      const chronicle = new Chronicle();
      const thread = chronicle.addThread("crisis", "The dam is breaking!", 9);

      expect(thread.tension).toBe(9);
    });

    it("returns existing thread on duplicate add", () => {
      const chronicle = new Chronicle();
      const first = chronicle.addThread("mystery", "Original summary");
      const second = chronicle.addThread("mystery", "Different summary");

      expect(first).toBe(second);
      expect(second.summary).toBe("Original summary");
      expect(chronicle.getActiveThreads()).toHaveLength(1);
    });

    it("updates thread tension with clamping", () => {
      const chronicle = new Chronicle();
      chronicle.addThread("tension-test", "Testing tension", 5);

      chronicle.updateThreadTension("tension-test", 3);
      expect(chronicle.getThread("tension-test")!.tension).toBe(8);

      chronicle.updateThreadTension("tension-test", 5); // Would exceed 10
      expect(chronicle.getThread("tension-test")!.tension).toBe(10);

      chronicle.updateThreadTension("tension-test", -15); // Would go below 0
      expect(chronicle.getThread("tension-test")!.tension).toBe(0);
    });

    it("does not update tension on resolved thread", () => {
      const chronicle = new Chronicle();
      chronicle.addThread("resolved", "Done", 5);
      chronicle.resolveThread("resolved");
      chronicle.updateThreadTension("resolved", 3);

      expect(chronicle.getThread("resolved")!.tension).toBe(0);
    });

    it("updates thread summary", () => {
      const chronicle = new Chronicle();
      chronicle.addThread("evolving", "Initial mystery");
      chronicle.updateThreadSummary("evolving", "The mystery deepens");

      expect(chronicle.getThread("evolving")!.summary).toBe("The mystery deepens");
    });

    it("resolves a thread", () => {
      const chronicle = new Chronicle();
      chronicle.addThread("quest", "Find the lost sword", 7);
      chronicle.resolveThread("quest");

      const thread = chronicle.getThread("quest")!;
      expect(thread.active).toBe(false);
      expect(thread.tension).toBe(0);
      expect(chronicle.getActiveThreads()).toHaveLength(0);
    });

    it("links entries to threads via narrativeThreads field", () => {
      const chronicle = new Chronicle();
      chronicle.addThread("mystery", "The missing ring");

      chronicle.append(
        makeEntry({
          id: "entry_1",
          summary: "Found a clue",
          narrativeThreads: ["mystery"],
        }),
      );

      const thread = chronicle.getThread("mystery")!;
      expect(thread.entries).toContain("entry_1");
    });

    it("ignores thread references for non-existent threads", () => {
      const chronicle = new Chronicle();
      chronicle.append(
        makeEntry({
          summary: "A random event",
          narrativeThreads: ["nonexistent"],
        }),
      );
      // Should not throw
      expect(chronicle.getEntries()).toHaveLength(1);
    });
  });

  describe("compression", () => {
    it("detects when compression is needed", () => {
      const chronicle = new Chronicle();
      // Initially, lastCompressionGameTime is 0
      expect(chronicle.needsCompression(0)).toBe(false);
      expect(chronicle.needsCompression(Chronicle.COMPRESSION_INTERVAL)).toBe(true);
      expect(chronicle.needsCompression(Chronicle.COMPRESSION_INTERVAL + 1)).toBe(true);
    });

    it("compresses old entries via provider", async () => {
      const chronicle = new Chronicle();
      const compressFn = mock(() => Promise.resolve("A hero journeyed through the village."));
      const provider: CompressionProvider = { compress: compressFn };

      // Add old entries (gameTime well before the cutoff)
      chronicle.append(makeEntry({ gameTime: 100, summary: "Arrived at village" }));
      chronicle.append(makeEntry({ gameTime: 200, summary: "Met the blacksmith" }));
      // Add recent entry (gameTime after cutoff)
      const currentGameTime = Chronicle.COMPRESSION_INTERVAL + 1000;
      chronicle.append(makeEntry({ gameTime: currentGameTime, summary: "Still exploring" }));

      await chronicle.compress(provider, currentGameTime);

      // Old entries removed, recent kept
      expect(chronicle.getEntries()).toHaveLength(1);
      expect(chronicle.getEntries()[0]!.summary).toBe("Still exploring");

      // Summary updated
      expect(chronicle.recentSummary).toBe("A hero journeyed through the village.");
      expect(compressFn).toHaveBeenCalledTimes(1);
    });

    it("rotates summaries during compression", async () => {
      const chronicle = new Chronicle();
      chronicle.recentSummary = "Previous recent summary";
      chronicle.historicalSummary = "Ancient history";

      const provider: CompressionProvider = {
        compress: () => Promise.resolve("New summary from compression"),
      };

      chronicle.append(makeEntry({ gameTime: 100, summary: "Old event" }));
      const currentGameTime = Chronicle.COMPRESSION_INTERVAL + 1000;

      await chronicle.compress(provider, currentGameTime);

      expect(chronicle.recentSummary).toBe("New summary from compression");
      expect(chronicle.historicalSummary).toContain("Ancient history");
      expect(chronicle.historicalSummary).toContain("Previous recent summary");
    });

    it("skips compression when no old entries exist", async () => {
      const chronicle = new Chronicle();
      const compressFn = mock(() => Promise.resolve("Should not be called"));
      const provider: CompressionProvider = { compress: compressFn };

      const currentGameTime = 5000;
      chronicle.append(makeEntry({ gameTime: currentGameTime, summary: "Recent" }));

      await chronicle.compress(provider, currentGameTime);
      expect(compressFn).not.toHaveBeenCalled();
    });

    it("updates lastCompressionGameTime after compression", async () => {
      const chronicle = new Chronicle();
      const provider: CompressionProvider = {
        compress: () => Promise.resolve("Compressed"),
      };

      chronicle.append(makeEntry({ gameTime: 100 }));
      const gameTime = Chronicle.COMPRESSION_INTERVAL + 500;

      expect(chronicle.needsCompression(gameTime)).toBe(true);
      await chronicle.compress(provider, gameTime);
      expect(chronicle.needsCompression(gameTime)).toBe(false);
      expect(chronicle.needsCompression(gameTime + Chronicle.COMPRESSION_INTERVAL)).toBe(true);
    });
  });
});
