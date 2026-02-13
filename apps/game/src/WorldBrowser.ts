import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
  ScrollBoxRenderable,
} from "@opentui/core";
import { SaveManager, type WorldSummary } from "./SaveManager.ts";

// ── Tokyo Night palette ────────────────────────────────────
const BG = "#0a0a1a";
const FG_PRIMARY = "#c0caf5";
const FG_DIMMED = "#565f89";
const FG_ACCENT = "#7aa2f7";
const FG_HINT = "#414868";

// ── Result type ────────────────────────────────────────────

export type WorldBrowserResult =
  | { type: "select"; worldId: string }
  | { type: "back" };

// ── Formatting helpers (exported for testing) ──────────────

/**
 * Format a duration in seconds as "Xh Ym".
 * Shows "< 1m" for zero, omits hours when zero.
 */
export function formatPlayTime(seconds: number): string {
  if (seconds <= 0) return "< 1m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h 0m`;
  if (minutes > 0) return `${minutes}m`;
  return "< 1m";
}

/**
 * Format a timestamp (ms since epoch) as a relative or absolute date string.
 * Returns relative for recent times ("just now", "5 minutes ago", "2 hours ago", "3 days ago"),
 * falls back to absolute date for older entries.
 */
export function formatLastPlayed(timestamp: number, now?: number): string {
  const currentTime = now ?? Date.now();
  if (timestamp <= 0) return "Never";

  const diffMs = currentTime - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin === 1) return "1 minute ago";
  if (diffMin < 60) return `${diffMin} minutes ago`;
  if (diffHour === 1) return "1 hour ago";
  if (diffHour < 24) return `${diffHour} hours ago`;
  if (diffDay === 1) return "1 day ago";
  if (diffDay < 30) return `${diffDay} days ago`;

  // Fall back to absolute date
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Truncate a string to maxLen characters, appending "..." if truncated.
 */
export function truncatePrompt(prompt: string, maxLen: number = 50): string {
  if (prompt.length <= maxLen) return prompt;
  return prompt.slice(0, maxLen - 3) + "...";
}

// ── WorldBrowser component ─────────────────────────────────

export class WorldBrowser {
  private container: BoxRenderable;
  private scrollBox: ScrollBoxRenderable;
  private listText: TextRenderable;
  private resolve: ((result: WorldBrowserResult) => void) | null = null;
  private worlds: WorldSummary[] = [];
  private selectedIndex = 0;

  constructor(private renderer: CliRenderer) {
    // Main container — fills screen
    this.container = new BoxRenderable(renderer, {
      id: "world-browser",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: BG,
    });

    // Header
    const header = new TextRenderable(renderer, {
      id: "wb-header",
      content: "\n     ── Your Worlds ──\n",
      fg: FG_ACCENT,
    });
    this.container.add(header);

    // Scrollable list area
    this.scrollBox = new ScrollBoxRenderable(renderer, {
      id: "wb-scroll",
      border: true,
      borderStyle: "single",
      borderColor: FG_HINT,
      stickyScroll: false,
      contentOptions: {
        paddingX: 1,
      },
    });

    this.listText = new TextRenderable(renderer, {
      id: "wb-list-text",
      content: "",
      fg: FG_PRIMARY,
    });
    this.scrollBox.add(this.listText);
    this.container.add(this.scrollBox);

    // Footer
    const footer = new TextRenderable(renderer, {
      id: "wb-footer",
      content: "\n  [Up/Down] Navigate  [Enter] Load  [Esc] Back\n",
      fg: FG_HINT,
    });
    this.container.add(footer);
  }

  /**
   * Show the world browser and wait for the user to select a world or go back.
   * @param saveDir Optional save directory (for testing).
   */
  async show(saveDir?: string): Promise<WorldBrowserResult> {
    this.worlds = SaveManager.listWorlds(saveDir);
    this.selectedIndex = 0;
    this.updateDisplay();

    this.renderer.root.add(this.container);
    this.container.focusable = true;
    this.container.focus();
    this.container.onKeyDown = (key) => this.handleKey(key);
    this.renderer.requestRender();

    return new Promise<WorldBrowserResult>((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Remove the world browser from the renderer. */
  destroy(): void {
    this.renderer.root.remove("world-browser");
  }

  // ── Private ────────────────────────────────────────────────

  private handleKey(key: { name: string; raw?: string }): void {
    if (key.name === "escape") {
      this.resolve?.({ type: "back" });
      this.resolve = null;
      return;
    }

    if (this.worlds.length === 0) return;

    if (key.name === "up") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateDisplay();
      return;
    }

    if (key.name === "down") {
      this.selectedIndex = Math.min(this.worlds.length - 1, this.selectedIndex + 1);
      this.updateDisplay();
      return;
    }

    if (key.name === "return") {
      const world = this.worlds[this.selectedIndex];
      if (world) {
        this.resolve?.({ type: "select", worldId: world.id });
        this.resolve = null;
      }
      return;
    }
  }

  private updateDisplay(): void {
    if (this.worlds.length === 0) {
      this.listText.content = "\n  No saved worlds yet.\n\n  Start a new game from the title screen to create your first world!\n";
      this.renderer.requestRender();
      return;
    }

    const lines: string[] = [""];

    for (let i = 0; i < this.worlds.length; i++) {
      const world = this.worlds[i]!;
      const isSelected = i === this.selectedIndex;
      const cursor = isSelected ? ">" : " ";
      const nameColor = isSelected ? FG_ACCENT : FG_PRIMARY;

      // Line 1: cursor + world name
      const name = world.name || "Unnamed World";
      lines.push(`  ${cursor} ${name}`);

      // Line 2: prompt snippet + playtime + last played
      const prompt = truncatePrompt(world.seedPrompt || "No prompt");
      const playTime = formatPlayTime(world.playTimeSeconds);
      const lastPlayed = formatLastPlayed(world.updatedAt);
      lines.push(`      "${prompt}"`);
      lines.push(`      ${playTime} played  |  ${lastPlayed}`);
      lines.push("");
    }

    this.listText.content = lines.join("\n");
    this.listText.fg = FG_PRIMARY;
    this.renderer.requestRender();
  }
}
