import { describe, expect, it } from "bun:test";
import { clampTension, createNarrativeThread } from "./NarrativeThread.ts";

describe("NarrativeThread helpers", () => {
  describe("createNarrativeThread", () => {
    it("creates a thread with defaults", () => {
      const thread = createNarrativeThread("quest_1", "Find the lost sword");

      expect(thread.id).toBe("quest_1");
      expect(thread.summary).toBe("Find the lost sword");
      expect(thread.active).toBe(true);
      expect(thread.entries).toEqual([]);
      expect(thread.tension).toBe(3);
    });

    it("accepts custom initial tension", () => {
      const thread = createNarrativeThread("crisis", "The dam is breaking!", 9);
      expect(thread.tension).toBe(9);
    });

    it("clamps initial tension to 0-10", () => {
      const low = createNarrativeThread("low", "Low tension", -5);
      expect(low.tension).toBe(0);

      const high = createNarrativeThread("high", "High tension", 15);
      expect(high.tension).toBe(10);
    });
  });

  describe("clampTension", () => {
    it("returns value within range unchanged", () => {
      expect(clampTension(5)).toBe(5);
      expect(clampTension(0)).toBe(0);
      expect(clampTension(10)).toBe(10);
    });

    it("clamps values below 0 to 0", () => {
      expect(clampTension(-1)).toBe(0);
      expect(clampTension(-100)).toBe(0);
    });

    it("clamps values above 10 to 10", () => {
      expect(clampTension(11)).toBe(10);
      expect(clampTension(100)).toBe(10);
    });
  });
});
