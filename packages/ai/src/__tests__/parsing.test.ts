import { describe, expect, it } from "bun:test";
import type { ToolUseBlock } from "../types.ts";
import { parseZoneResponse, type ZoneSpec } from "../tools/zone-tools.ts";
import {
  parseDialogueResponse,
  parseConsequencesResponse,
} from "../tools/dialogue-tools.ts";
import {
  parseWorldTickResponse,
  parseWorldSeedResponse,
} from "../tools/event-tools.ts";

function makeToolUse(name: string, input: unknown): ToolUseBlock {
  return {
    type: "tool_use",
    id: "test_id",
    name,
    input,
  } as ToolUseBlock;
}

describe("parseZoneResponse", () => {
  it("parses valid zone spec", () => {
    const input: ZoneSpec = {
      name: "The Market Square",
      description: "A bustling market square",
      terrain: {
        primary_ground: "cobblestone",
        features: [{ type: "path", description: "A wide central path" }],
      },
      buildings: [
        {
          name: "General Store",
          type: "shop",
          width: 5,
          height: 3,
          position: { x: 10, y: 5 },
          features: ["door facing south"],
        },
      ],
      objects: [
        { type: "well", position: { x: 20, y: 10 }, description: "An old stone well" },
      ],
      characters: [
        {
          name: "Martha",
          role: "merchant",
          personality: ["friendly", "shrewd", "talkative"],
          backstory: "Has run the general store for 30 years.",
          speech_pattern: "warm but businesslike",
          visual: { char: "$", fg: "#c9a959", bold: true },
          position: { x: 11, y: 6 },
          secrets: ["Knows about the hidden tunnel"],
        },
      ],
      narrative_hooks: ["Strange noises from the well at night"],
    };

    const result = parseZoneResponse(makeToolUse("create_zone", input));
    expect(result.name).toBe("The Market Square");
    expect(result.buildings).toHaveLength(1);
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0]!.name).toBe("Martha");
  });

  it("throws on wrong tool name", () => {
    expect(() =>
      parseZoneResponse(makeToolUse("wrong_tool", {})),
    ).toThrow("Expected create_zone tool");
  });
});

describe("parseDialogueResponse", () => {
  it("parses valid dialogue response", () => {
    const input = {
      character_speech: "Well, well... a traveler. Don't see many of those these days.",
      character_emotion: "curious",
      narration: "The old man peers at you over his spectacles.",
      options: [
        {
          text: "I'm looking for the old ruins. Can you point me in the right direction?",
          type: "dialogue",
          tone: "friendly",
          preview: "He might know the way",
        },
        {
          text: "I don't have time for small talk.",
          type: "dialogue",
          tone: "curt",
        },
        {
          text: "Place a gold coin on the counter",
          type: "action",
          tone: "bribery",
        },
      ],
      conversation_ended: false,
    };

    const result = parseDialogueResponse(makeToolUse("dialogue_response", input));
    expect(result.characterSpeech).toContain("traveler");
    expect(result.characterEmotion).toBe("curious");
    expect(result.narration).toContain("spectacles");
    expect(result.options).toHaveLength(3);
    expect(result.options[2]!.type).toBe("action");
    expect(result.conversationEnded).toBe(false);
  });

  it("defaults conversationEnded to false", () => {
    const input = {
      character_speech: "Hello.",
      character_emotion: "neutral",
      options: [{ text: "Hi", type: "dialogue", tone: "friendly" }],
    };

    const result = parseDialogueResponse(makeToolUse("dialogue_response", input));
    expect(result.conversationEnded).toBe(false);
  });

  it("throws on wrong tool name", () => {
    expect(() =>
      parseDialogueResponse(makeToolUse("wrong_tool", {})),
    ).toThrow("Expected dialogue_response tool");
  });
});

describe("parseConsequencesResponse", () => {
  it("parses valid consequences", () => {
    const input = {
      character_state_changes: [
        {
          character_id: "martha_001",
          mood_change: "suspicious",
          relationship_delta: -2,
          memory_added: "The traveler asked about the ruins — seems like trouble.",
        },
      ],
      deferred_events: [
        {
          description: "Martha warns the guard about the stranger",
          trigger_condition: "next world tick",
          effects: ["Guard patrols increase near the ruins"],
        },
      ],
      chronicle_entry: "A stranger arrived asking about the old ruins, putting the merchant on edge.",
      narrative_threads: ["mystery_of_the_ruins"],
    };

    const result = parseConsequencesResponse(makeToolUse("evaluate_consequences", input));
    expect(result.characterStateChanges).toHaveLength(1);
    expect(result.characterStateChanges[0]!.characterId).toBe("martha_001");
    expect(result.characterStateChanges[0]!.relationshipDelta).toBe(-2);
    expect(result.deferredEvents).toHaveLength(1);
    expect(result.chronicleEntry).toContain("stranger");
    expect(result.narrativeThreads).toContain("mystery_of_the_ruins");
  });

  it("handles missing deferred events", () => {
    const input = {
      character_state_changes: [
        { character_id: "test", memory_added: "test" },
      ],
      chronicle_entry: "Nothing happened.",
      narrative_threads: [],
    };

    const result = parseConsequencesResponse(makeToolUse("evaluate_consequences", input));
    expect(result.deferredEvents).toHaveLength(0);
  });
});

describe("parseWorldTickResponse", () => {
  it("parses valid world tick", () => {
    const input = {
      events: [
        {
          type: "ambient",
          description: "The wind shifts direction",
          effects: [
            { type: "weather_change", details: "Wind picks up from the north" },
          ],
          chronicle_entry: "The wind changed direction as evening approached.",
        },
      ],
      narration: "A cool breeze sweeps through the square.",
    };

    const result = parseWorldTickResponse(makeToolUse("world_tick", input));
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.type).toBe("ambient");
    expect(result.narration).toContain("breeze");
  });

  it("handles empty events", () => {
    const input = { events: [] };
    const result = parseWorldTickResponse(makeToolUse("world_tick", input));
    expect(result.events).toHaveLength(0);
    expect(result.narration).toBeUndefined();
  });
});

describe("parseWorldSeedResponse", () => {
  it("parses valid world seed", () => {
    const input = {
      setting: {
        name: "Thornvale",
        type: "dark fantasy",
        era: "Late medieval",
        tone: "mysterious and foreboding",
        description: "A kingdom shrouded in perpetual twilight...",
      },
      biome_map: {
        center_biome: "village",
        distribution: [
          { biome: "dark_forest", direction: "north", distance: "near" },
          { biome: "swamp", direction: "east", distance: "medium" },
        ],
      },
      initial_narrative: {
        hooks: ["The missing children", "The sealed tower"],
        main_tension: "Darkness is spreading from the north",
        atmosphere: "Oppressive dread mixed with stubborn hope",
      },
      world_rules: {
        has_magic: true,
        tech_level: "medieval",
        economy: "barter with some coinage",
        dangers: ["dark creatures", "corrupted wildlife"],
        customs: ["evening curfew", "salt circles for protection"],
      },
    };

    const result = parseWorldSeedResponse(makeToolUse("create_world", input));
    expect(result.setting.name).toBe("Thornvale");
    expect(result.biomeMap.centerBiome).toBe("village");
    expect(result.biomeMap.distribution).toHaveLength(2);
    expect(result.initialNarrative.hooks).toHaveLength(2);
    expect(result.worldRules.hasMagic).toBe(true);
    expect(result.worldRules.dangers).toContain("dark creatures");
  });

  it("throws on wrong tool name", () => {
    expect(() =>
      parseWorldSeedResponse(makeToolUse("wrong_tool", {})),
    ).toThrow("Expected create_world tool");
  });
});
