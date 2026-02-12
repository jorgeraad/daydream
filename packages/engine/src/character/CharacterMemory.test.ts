import { describe, expect, it } from "bun:test";
import { CharacterMemory } from "./CharacterMemory.ts";

describe("CharacterMemory", () => {
  describe("initialization", () => {
    it("creates with empty defaults", () => {
      const mem = new CharacterMemory("npc_guard");
      expect(mem.characterId).toBe("npc_guard");
      expect(mem.getExperienceCount()).toBe(0);
      expect(mem.getRumorCount()).toBe(0);
    });

    it("creates from existing data", () => {
      const mem = new CharacterMemory("npc_merchant", {
        personalExperiences: [
          { type: "conversation", summary: "Met the hero", timestamp: 1000, emotionalWeight: 0.5 },
        ],
        heardRumors: [],
        playerRelationship: {
          trust: 3,
          familiarity: 2,
          impressions: ["Seemed friendly"],
        },
      });

      expect(mem.getExperienceCount()).toBe(1);
      expect(mem.getData().playerRelationship.trust).toBe(3);
    });
  });

  describe("adding memories", () => {
    it("adds an experience", () => {
      const mem = new CharacterMemory("npc_1");
      mem.addExperience("observation", "Saw a fire in the distance", 0.7);

      expect(mem.getExperienceCount()).toBe(1);
      const data = mem.getData();
      expect(data.personalExperiences[0]!.type).toBe("observation");
      expect(data.personalExperiences[0]!.summary).toBe("Saw a fire in the distance");
      expect(data.personalExperiences[0]!.emotionalWeight).toBe(0.7);
    });

    it("clamps emotional weight to 0-1", () => {
      const mem = new CharacterMemory("npc_1");
      mem.addExperience("test", "High weight", 5.0);
      mem.addExperience("test", "Low weight", -1.0);

      const data = mem.getData();
      expect(data.personalExperiences[0]!.emotionalWeight).toBe(1);
      expect(data.personalExperiences[1]!.emotionalWeight).toBe(0);
    });

    it("adds a rumor", () => {
      const mem = new CharacterMemory("npc_1");
      mem.addRumor("gossip", "The king is ill");

      expect(mem.getRumorCount()).toBe(1);
      const data = mem.getData();
      expect(data.heardRumors[0]!.summary).toBe("The king is ill");
    });

    it("adds conversation memory with impression", () => {
      const mem = new CharacterMemory("npc_1");
      mem.addConversationMemory("Discussed the weather", "Player seems curious", 0.4);

      expect(mem.getExperienceCount()).toBe(1);
      const data = mem.getData();
      expect(data.personalExperiences[0]!.type).toBe("conversation");
      expect(data.playerRelationship.impressions).toContain("Player seems curious");
      expect(data.playerRelationship.lastInteraction).toBe("Discussed the weather");
    });
  });

  describe("getRelevantMemories", () => {
    it("returns formatted memories within budget", () => {
      const mem = new CharacterMemory("npc_1");
      mem.addExperience("conversation", "Talked about the forest");
      mem.addExperience("observation", "Saw the player fight a wolf", 0.9);

      const result = mem.getRelevantMemories(500);
      expect(result).toContain("[conversation] Talked about the forest");
      expect(result).toContain("[observation] Saw the player fight a wolf");
    });

    it("respects budget by limiting output", () => {
      const mem = new CharacterMemory("npc_1");
      for (let i = 0; i < 50; i++) {
        mem.addExperience("event", `Event number ${i} with a detailed description of what happened`);
      }

      const small = mem.getRelevantMemories(100);
      const large = mem.getRelevantMemories(5000);
      expect(small.length).toBeLessThan(large.length);
    });

    it("includes rumors in output", () => {
      const mem = new CharacterMemory("npc_1");
      mem.addRumor("gossip", "The baker is secretly a wizard");

      const result = mem.getRelevantMemories(500);
      expect(result).toContain("[rumor] The baker is secretly a wizard");
    });

    it("includes last interaction", () => {
      const mem = new CharacterMemory("npc_1");
      mem.addConversationMemory("Asked about the map", "Inquisitive");

      const result = mem.getRelevantMemories(500);
      expect(result).toContain("Last interaction: Asked about the map");
    });

    it("returns empty string when no memories", () => {
      const mem = new CharacterMemory("npc_1");
      expect(mem.getRelevantMemories()).toBe("");
    });
  });

  describe("relationship", () => {
    it("updates trust", () => {
      const mem = new CharacterMemory("npc_1");
      mem.updateTrust(3);
      expect(mem.getData().playerRelationship.trust).toBe(3);

      mem.updateTrust(-1);
      expect(mem.getData().playerRelationship.trust).toBe(2);
    });

    it("updates familiarity", () => {
      const mem = new CharacterMemory("npc_1");
      mem.updateFamiliarity(5);
      expect(mem.getData().playerRelationship.familiarity).toBe(5);
    });

    it("returns relationship summary", () => {
      const mem = new CharacterMemory("npc_1");
      mem.updateTrust(6);
      mem.updateFamiliarity(3);
      mem.addConversationMemory("Trade deal", "Good trader");

      const summary = mem.getRelationshipSummary();
      expect(summary).toContain("trusting");
      expect(summary).toContain("acquainted");
      expect(summary).toContain("Good trader");
    });

    it("shows neutral trust for zero", () => {
      const mem = new CharacterMemory("npc_1");
      const summary = mem.getRelationshipSummary();
      expect(summary).toContain("neutral");
      expect(summary).toContain("stranger");
    });

    it("shows negative trust labels", () => {
      const mem = new CharacterMemory("npc_1");
      mem.updateTrust(-6);
      const summary = mem.getRelationshipSummary();
      expect(summary).toContain("distrustful");
    });
  });

  describe("getStrongestMemory", () => {
    it("returns the memory with highest emotional weight", () => {
      const mem = new CharacterMemory("npc_1");
      mem.addExperience("event", "Minor event", 0.2);
      mem.addExperience("trauma", "Witnessed a battle", 0.95);
      mem.addExperience("event", "Another event", 0.5);

      const strongest = mem.getStrongestMemory();
      expect(strongest).toBeDefined();
      expect(strongest!.summary).toBe("Witnessed a battle");
    });

    it("returns undefined when no experiences", () => {
      const mem = new CharacterMemory("npc_1");
      expect(mem.getStrongestMemory()).toBeUndefined();
    });
  });
});
