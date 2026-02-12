import type { CharacterMemoryData, MemoryEntry } from "../types.ts";

export class CharacterMemory {
  readonly characterId: string;
  private data: CharacterMemoryData;

  constructor(characterId: string, data?: CharacterMemoryData) {
    this.characterId = characterId;
    this.data = data ?? {
      personalExperiences: [],
      heardRumors: [],
      playerRelationship: {
        trust: 0,
        familiarity: 0,
        impressions: [],
      },
    };
  }

  getData(): CharacterMemoryData {
    return this.data;
  }

  addExperience(
    type: string,
    summary: string,
    emotionalWeight: number = 0.5,
  ): void {
    this.data.personalExperiences.push({
      type,
      summary,
      timestamp: Date.now(),
      emotionalWeight: Math.max(0, Math.min(1, emotionalWeight)),
    });
  }

  addRumor(
    type: string,
    summary: string,
    emotionalWeight: number = 0.3,
  ): void {
    this.data.heardRumors.push({
      type,
      summary,
      timestamp: Date.now(),
      emotionalWeight: Math.max(0, Math.min(1, emotionalWeight)),
    });
  }

  addConversationMemory(
    summary: string,
    playerImpression: string,
    emotionalWeight: number = 0.5,
  ): void {
    this.addExperience("conversation", summary, emotionalWeight);
    this.data.playerRelationship.impressions.push(playerImpression);
    this.data.playerRelationship.lastInteraction = summary;
  }

  getRelevantMemories(budget: number = 500): string {
    const parts: string[] = [];
    let length = 0;

    // Prioritize: recent interactions > strong emotions > old memories
    const sorted = [...this.data.personalExperiences].sort((a, b) => {
      const scoreA = a.emotionalWeight * 0.3 + a.timestamp * 0.7;
      const scoreB = b.emotionalWeight * 0.3 + b.timestamp * 0.7;
      return scoreB - scoreA;
    });

    for (const entry of sorted) {
      const text = `[${entry.type}] ${entry.summary}`;
      if (length + text.length > budget) break;
      parts.push(text);
      length += text.length;
    }

    // Include rumors if budget allows
    for (const rumor of this.data.heardRumors.slice(-5)) {
      const text = `[rumor] ${rumor.summary}`;
      if (length + text.length > budget) break;
      parts.push(text);
      length += text.length;
    }

    if (this.data.playerRelationship.lastInteraction) {
      const text = `Last interaction: ${this.data.playerRelationship.lastInteraction}`;
      if (length + text.length <= budget) {
        parts.push(text);
      }
    }

    return parts.join("\n");
  }

  getRelationshipSummary(): string {
    const rel = this.data.playerRelationship;
    const trustLabel =
      rel.trust > 5 ? "trusting" :
      rel.trust > 0 ? "cautiously positive" :
      rel.trust < -5 ? "distrustful" :
      rel.trust < 0 ? "wary" :
      "neutral";
    const famLabel =
      rel.familiarity > 5 ? "well-known" :
      rel.familiarity > 2 ? "acquainted" :
      "stranger";
    const impressions = rel.impressions.slice(-3).join("; ");
    return `Trust: ${trustLabel} (${rel.trust}), Familiarity: ${famLabel} (${rel.familiarity})${impressions ? `. Impressions: ${impressions}` : ""}`;
  }

  updateTrust(delta: number): void {
    this.data.playerRelationship.trust += delta;
  }

  updateFamiliarity(delta: number): void {
    this.data.playerRelationship.familiarity += delta;
  }

  getExperienceCount(): number {
    return this.data.personalExperiences.length;
  }

  getRumorCount(): number {
    return this.data.heardRumors.length;
  }

  getStrongestMemory(): MemoryEntry | undefined {
    if (this.data.personalExperiences.length === 0) return undefined;
    return this.data.personalExperiences.reduce((strongest, entry) =>
      entry.emotionalWeight > strongest.emotionalWeight ? entry : strongest,
    );
  }
}
