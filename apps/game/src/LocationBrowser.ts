import type { CliRenderer } from "@opentui/core";
import { LocationList } from "@daydream/renderer";
import type { LocationEntry } from "@daydream/renderer";
import type { WorldState, Zone, ZoneId } from "@daydream/engine";
import type { ZoneManager } from "@daydream/engine";
import { parseZoneCoords } from "@daydream/engine";

interface KeyEvent {
  name: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * Game-layer overlay for browsing discovered locations and triggering fast-travel.
 *
 * Shows a scrollable list of all zones in PlayerState.journal.discoveredZones.
 * Zones are sorted by lastVisited (most recent first). The current zone is
 * tagged distinctly. Selecting a zone returns its ID for fast-travel.
 */
export class LocationBrowser {
  private renderer: CliRenderer;
  private worldState: WorldState;
  private zoneManager: ZoneManager | null;
  private locationList: LocationList;
  private visible = false;

  /** Resolved when the player selects a zone or closes the browser. */
  private resolveSelection: ((zoneId: string | null) => void) | null = null;

  constructor(
    renderer: CliRenderer,
    worldState: WorldState,
    zoneManager: ZoneManager | null,
  ) {
    this.renderer = renderer;
    this.worldState = worldState;
    this.zoneManager = zoneManager;
    this.locationList = new LocationList(renderer);
  }

  /**
   * Open the location browser overlay.
   * Returns the selected zone ID, or null if the user pressed Escape.
   */
  show(): Promise<string | null> {
    if (this.visible) return Promise.resolve(null);
    this.visible = true;

    // Build entries from discovered zones
    const entries = this.buildEntries();
    this.locationList.setLocations(entries);

    // Add overlay to renderer
    this.renderer.root.add(this.locationList.getComponent());
    this.renderer.requestRender();

    return new Promise((resolve) => {
      this.resolveSelection = resolve;
    });
  }

  /**
   * Close the location browser overlay.
   */
  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.renderer.root.remove("location-list");
    this.renderer.requestRender();
  }

  /**
   * Handle keyboard input while the browser is open.
   */
  handleKey(key: KeyEvent): void {
    if (!this.visible) return;

    switch (key.name) {
      case "up":
      case "k":
        this.locationList.moveUp();
        break;

      case "down":
      case "j":
        this.locationList.moveDown();
        break;

      case "return": {
        const entry = this.locationList.getSelectedEntry();
        if (entry) {
          this.hide();
          this.resolveSelection?.(entry.zoneId);
          this.resolveSelection = null;
        }
        break;
      }

      case "escape":
        this.hide();
        this.resolveSelection?.(null);
        this.resolveSelection = null;
        break;
    }
  }

  /**
   * Whether the browser is currently visible.
   */
  get isVisible(): boolean {
    return this.visible;
  }

  // ── Private ────────────────────────────────────────────────

  private buildEntries(): LocationEntry[] {
    const discoveredIds = this.worldState.player.journal.discoveredZones;
    const currentZoneId = this.worldState.activeZoneId;

    const entries: LocationEntry[] = [];

    for (const id of discoveredIds) {
      const zone = this.worldState.zones.get(id as ZoneId);
      const coords = parseZoneCoords(id as ZoneId);

      entries.push({
        zoneId: id,
        name: zone?.metadata?.name ?? id,
        biome: zone?.biome?.type ?? "unknown",
        coords: coords ?? { x: 0, y: 0 },
        lastVisited: zone?.lastVisited ?? 0,
        isCurrent: id === currentZoneId,
      });
    }

    // Sort by lastVisited descending (most recent first)
    entries.sort((a, b) => b.lastVisited - a.lastVisited);

    return entries;
  }
}
