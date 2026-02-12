import type {
  Character,
  CharacterMemoryData,
  CharacterRelationship,
  MemoryEntry,
} from "../types.ts";

export function createDefaultMemory(): CharacterMemoryData {
  return {
    personalExperiences: [],
    heardRumors: [],
    playerRelationship: {
      trust: 0,
      familiarity: 0,
      impressions: [],
    },
  };
}

export function getRelevantMemories(
  memory: CharacterMemoryData,
  budget: number = 500,
): string {
  const parts: string[] = [];
  let length = 0;

  // Prioritize: recent interactions > strong emotions > old memories
  const sorted = [...memory.personalExperiences].sort(
    (a, b) => b.emotionalWeight * 0.3 + b.timestamp * 0.7 - (a.emotionalWeight * 0.3 + a.timestamp * 0.7),
  );

  for (const entry of sorted) {
    const text = `[${entry.type}] ${entry.summary}`;
    if (length + text.length > budget) break;
    parts.push(text);
    length += text.length;
  }

  if (memory.playerRelationship.lastInteraction) {
    parts.push(`Last interaction: ${memory.playerRelationship.lastInteraction}`);
  }

  return parts.join("\n");
}

export function addConversationMemory(
  memory: CharacterMemoryData,
  summary: string,
  playerImpression: string,
  emotionalWeight: number = 0.5,
): void {
  const entry: MemoryEntry = {
    type: "conversation",
    summary,
    timestamp: Date.now(),
    emotionalWeight,
  };
  memory.personalExperiences.push(entry);
  memory.playerRelationship.impressions.push(playerImpression);
  memory.playerRelationship.lastInteraction = summary;
}

export function getRelationship(
  character: Character,
  targetId: string,
): CharacterRelationship | undefined {
  return character.relationships.get(targetId);
}

export function setRelationship(
  character: Character,
  targetId: string,
  relationship: CharacterRelationship,
): void {
  character.relationships.set(targetId, relationship);
}
