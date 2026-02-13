import {
  ScrollBoxRenderable,
  TextRenderable,
  type CliRenderer,
} from "@opentui/core";

/**
 * A single entry in the location list.
 */
export interface LocationEntry {
  zoneId: string;
  name: string;
  biome: string;
  coords: { x: number; y: number };
  lastVisited: number;
  isCurrent: boolean;
}

/**
 * Scrollable list of discovered locations rendered as a bordered panel.
 *
 * Highlights the current zone and shows a selection cursor.
 * Controlled externally via moveUp/moveDown/getSelectedIndex.
 */
export class LocationList {
  readonly container: ScrollBoxRenderable;
  private textContent: TextRenderable;
  private renderer: CliRenderer;
  private entries: LocationEntry[] = [];
  private selectedIndex = 0;

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;

    this.container = new ScrollBoxRenderable(renderer, {
      id: "location-list",
      border: true,
      borderStyle: "single",
      borderColor: "#7aa2f7",
      title: " Locations ",
      stickyScroll: false,
      contentOptions: {
        paddingX: 1,
      },
    });

    this.textContent = new TextRenderable(renderer, {
      id: "location-list-text",
      content: "",
    });

    this.container.add(this.textContent);
  }

  /**
   * Replace the current list entries and re-render.
   * Resets selection to index 0.
   */
  setLocations(entries: LocationEntry[]): void {
    this.entries = entries;
    this.selectedIndex = 0;
    this.render();
  }

  moveUp(): void {
    if (this.entries.length === 0) return;
    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    this.render();
  }

  moveDown(): void {
    if (this.entries.length === 0) return;
    this.selectedIndex = Math.min(this.entries.length - 1, this.selectedIndex + 1);
    this.render();
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  getSelectedEntry(): LocationEntry | undefined {
    return this.entries[this.selectedIndex];
  }

  getComponent(): ScrollBoxRenderable {
    return this.container;
  }

  // ── Private ────────────────────────────────────────────────

  private render(): void {
    if (this.entries.length === 0) {
      this.textContent.content = "\n  No locations discovered yet.\n\n  Explore the world to discover new zones!";
      this.renderer.requestRender();
      return;
    }

    const lines: string[] = [];
    lines.push("");

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i]!;
      const cursor = this.selectedIndex === i ? ">" : " ";
      const currentTag = entry.isCurrent ? " [HERE]" : "";
      const timeAgo = this.formatTimeAgo(entry.lastVisited);

      lines.push(`  ${cursor} ${entry.name}${currentTag}`);
      lines.push(`    ${entry.biome} | (${entry.coords.x}, ${entry.coords.y}) | ${timeAgo}`);
      lines.push("");
    }

    lines.push("  [Up/Down] Navigate  [Enter] Fast Travel  [Esc] Close");

    this.textContent.content = lines.join("\n");
    this.renderer.requestRender();
  }

  private formatTimeAgo(timestamp: number): string {
    if (timestamp === 0) return "Unknown";

    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${Math.floor(diffHour / 24)}d ago`;
  }
}
