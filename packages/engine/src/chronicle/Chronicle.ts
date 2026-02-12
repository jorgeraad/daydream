import type { ChronicleEntry, NarrativeThread } from "../types.ts";
import { clampTension, createNarrativeThread } from "./NarrativeThread.ts";

export interface CompressionProvider {
  compress(entries: string, existingSummary: string): Promise<string>;
}

export class Chronicle {
  private entries: ChronicleEntry[] = [];
  private unsavedEntries: ChronicleEntry[] = [];
  recentSummary: string = "";
  historicalSummary: string = "";
  narrativeThreads: NarrativeThread[] = [];
  private lastCompressionGameTime: number = 0;

  // Compression interval in game-time milliseconds (30 minutes)
  static readonly COMPRESSION_INTERVAL = 30 * 60 * 1000;

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

  getEntriesByType(type: ChronicleEntry["type"]): ChronicleEntry[] {
    return this.entries.filter((e) => e.type === type);
  }

  getEntriesByZone(zoneId: string): ChronicleEntry[] {
    return this.entries.filter((e) => e.zone === zoneId);
  }

  getActiveThreads(): NarrativeThread[] {
    return this.narrativeThreads.filter((t) => t.active);
  }

  getThread(threadId: string): NarrativeThread | undefined {
    return this.narrativeThreads.find((t) => t.id === threadId);
  }

  getSummaries(): { recent: string; historical: string } {
    return {
      recent: this.recentSummary,
      historical: this.historicalSummary,
    };
  }

  getContextWindow(budget: number): string {
    const parts: string[] = [];

    if (this.historicalSummary) {
      parts.push(`## World History\n${this.historicalSummary}`);
    }
    if (this.recentSummary) {
      parts.push(`## Recent Events\n${this.recentSummary}`);
    }

    // Add recent entries newest-first, within budget
    const recentEntries = this.entries.slice(-50);
    const entryLines: string[] = [];
    let entryLength = 0;
    const budgetForEntries = budget - parts.join("\n\n").length - 100; // reserve space for thread section

    for (const entry of recentEntries.reverse()) {
      const line = this.formatEntry(entry);
      if (entryLength + line.length > budgetForEntries) break;
      entryLines.unshift(line);
      entryLength += line.length;
    }

    if (entryLines.length > 0) {
      parts.push(`## Recent Chronicle\n${entryLines.join("\n")}`);
    }

    const activeThreads = this.narrativeThreads.filter((t) => t.active);
    if (activeThreads.length > 0) {
      const threadLines = activeThreads.map(
        (t) => `- ${t.summary} (tension: ${t.tension}/10)`,
      );
      parts.push(`## Active Threads\n${threadLines.join("\n")}`);
    }

    return parts.join("\n\n");
  }

  getRecentPlayerActions(count: number): ChronicleEntry[] {
    return this.entries
      .filter((e) => e.type === "player_action")
      .slice(-count);
  }

  // ── Narrative Thread Lifecycle ────────────────────────────

  addThread(id: string, summary: string, initialTension?: number): NarrativeThread {
    const existing = this.narrativeThreads.find((t) => t.id === id);
    if (existing) return existing;
    const thread = createNarrativeThread(id, summary, initialTension);
    this.narrativeThreads.push(thread);
    return thread;
  }

  updateThreadTension(threadId: string, delta: number): void {
    const thread = this.narrativeThreads.find((t) => t.id === threadId);
    if (!thread || !thread.active) return;
    thread.tension = clampTension(thread.tension + delta);
  }

  updateThreadSummary(threadId: string, summary: string): void {
    const thread = this.narrativeThreads.find((t) => t.id === threadId);
    if (!thread) return;
    thread.summary = summary;
  }

  resolveThread(threadId: string): void {
    const thread = this.narrativeThreads.find((t) => t.id === threadId);
    if (!thread) return;
    thread.active = false;
    thread.tension = 0;
  }

  // ── Compression ──────────────────────────────────────────

  needsCompression(currentGameTime: number): boolean {
    return (
      currentGameTime - this.lastCompressionGameTime >=
      Chronicle.COMPRESSION_INTERVAL
    );
  }

  async compress(provider: CompressionProvider, currentGameTime: number): Promise<void> {
    // Compress entries older than 30 game-minutes
    const cutoff = currentGameTime - Chronicle.COMPRESSION_INTERVAL;
    const oldEntries = this.entries.filter((e) => e.gameTime < cutoff);

    if (oldEntries.length === 0) return;

    const formatted = oldEntries.map((e) => this.formatEntry(e)).join("\n");
    const newSummary = await provider.compress(formatted, this.recentSummary);

    // Rotate summaries: current recent → historical, new summary → recent
    if (this.recentSummary) {
      this.historicalSummary = this.historicalSummary
        ? `${this.historicalSummary}\n\n${this.recentSummary}`
        : this.recentSummary;
    }
    this.recentSummary = newSummary;

    // Remove compressed entries
    this.entries = this.entries.filter((e) => e.gameTime >= cutoff);
    this.lastCompressionGameTime = currentGameTime;
  }

  // ── Internal ─────────────────────────────────────────────

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
