import type { ChronicleEntry, NarrativeThread } from "../types.ts";

export class Chronicle {
  private entries: ChronicleEntry[] = [];
  private unsavedEntries: ChronicleEntry[] = [];
  recentSummary: string = "";
  historicalSummary: string = "";
  narrativeThreads: NarrativeThread[] = [];

  append(entry: ChronicleEntry): void {
    this.entries.push(entry);
    this.unsavedEntries.push(entry);
    this.updateNarrativeThreads(entry);
  }

  getEntries(): readonly ChronicleEntry[] {
    return this.entries;
  }

  getUnsavedEntries(): ChronicleEntry[] {
    const unsaved = [...this.unsavedEntries];
    this.unsavedEntries = [];
    return unsaved;
  }

  getRecentEntries(count: number): ChronicleEntry[] {
    return this.entries.slice(-count);
  }

  getActiveThreads(): NarrativeThread[] {
    return this.narrativeThreads.filter((t) => t.active);
  }

  getSummaries(): { recent: string; historical: string } {
    return {
      recent: this.recentSummary,
      historical: this.historicalSummary,
    };
  }

  getContextWindow(budget: number): string {
    let context = "";
    context += `## World History\n${this.historicalSummary}\n\n`;
    context += `## Recent Events\n${this.recentSummary}\n\n`;

    const recentEntries = this.entries.slice(-50);
    for (const entry of recentEntries.reverse()) {
      const entryText = this.formatEntry(entry);
      if (context.length + entryText.length > budget) break;
      context = `${entryText}\n${context}`;
    }

    context += `## Active Threads\n`;
    for (const thread of this.narrativeThreads.filter((t) => t.active)) {
      context += `- ${thread.summary}\n`;
    }

    return context;
  }

  getRecentPlayerActions(count: number): ChronicleEntry[] {
    return this.entries
      .filter((e) => e.type === "player_action")
      .slice(-count);
  }

  private updateNarrativeThreads(entry: ChronicleEntry): void {
    if (!entry.narrativeThreads) return;
    for (const threadId of entry.narrativeThreads) {
      const existing = this.narrativeThreads.find((t) => t.id === threadId);
      if (existing) {
        existing.entries.push(entry.id);
      }
    }
  }

  private formatEntry(entry: ChronicleEntry): string {
    const chars = entry.characters?.join(", ") ?? "";
    const charNote = chars ? ` [${chars}]` : "";
    return `[${entry.type}] ${entry.summary}${charNote}`;
  }
}
