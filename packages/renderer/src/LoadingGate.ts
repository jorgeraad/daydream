import { RGBA, TextAttributes, type OptimizedBuffer } from "@opentui/core";
import type { Direction } from "@daydream/engine";
import type { ZoneData, TileCell } from "./types.ts";

/** Gate pulse characters: alternates between light and medium shade. */
const GATE_CHARS = ["░", "▒"] as const;

/** Default pulse interval in milliseconds (toggles between ░ and ▒). */
const DEFAULT_PULSE_INTERVAL_MS = 500;

/** Color for the loading gate indicator. */
const GATE_FG = "#888888";
const GATE_BG = "#111111";

/**
 * Visual indicator shown at a zone boundary edge when the adjacent zone
 * is not yet ready. Renders a pulsing ░/▒ pattern along the edge to
 * signal that the player cannot yet cross.
 */
export class LoadingGate {
  private _active = false;
  private edge: Direction = "up";
  private zone: ZoneData | null = null;
  private pulseTimer = 0;
  private pulseIndex = 0;
  private pulseIntervalMs: number;

  /** Saved original tiles along the edge, for restoration on hide(). */
  private savedTiles: Array<{ x: number; y: number; cell: TileCell | null }> = [];

  constructor(pulseIntervalMs: number = DEFAULT_PULSE_INTERVAL_MS) {
    this.pulseIntervalMs = pulseIntervalMs;
  }

  /** Whether the loading gate is currently displayed. */
  get active(): boolean {
    return this._active;
  }

  /** Current pulse character index (0 or 1). Useful for testing. */
  get currentPulseIndex(): number {
    return this.pulseIndex;
  }

  /**
   * Show the loading gate along the specified zone edge.
   *
   * @param edge - Which edge of the zone to show the gate on.
   * @param zone - The zone data (used to determine dimensions).
   */
  show(edge: Direction, zone: ZoneData): void {
    this._active = true;
    this.edge = edge;
    this.zone = zone;
    this.pulseTimer = 0;
    this.pulseIndex = 0;

    // Compute which cells form the edge
    this.savedTiles = this.getEdgeCells(edge, zone);
  }

  /**
   * Hide the loading gate and clear state.
   */
  hide(): void {
    this._active = false;
    this.savedTiles = [];
    this.zone = null;
    this.pulseTimer = 0;
    this.pulseIndex = 0;
  }

  /**
   * Advance the pulse timer. Call this each frame with the elapsed
   * delta time to animate the pulsing effect.
   *
   * @param deltaMs - Milliseconds since the last update.
   */
  update(deltaMs: number): void {
    if (!this._active) return;

    this.pulseTimer += deltaMs;
    if (this.pulseTimer >= this.pulseIntervalMs) {
      this.pulseTimer -= this.pulseIntervalMs;
      this.pulseIndex = (this.pulseIndex + 1) % GATE_CHARS.length;
    }
  }

  /**
   * Render the gate effect onto the given buffer. This draws the
   * pulsing gate characters at the edge cells.
   *
   * @param buffer - The OptimizedBuffer to draw into.
   * @param cameraX - Camera X offset (from ViewportManager).
   * @param cameraY - Camera Y offset (from ViewportManager).
   * @param viewWidth - Viewport width in cells.
   * @param viewHeight - Viewport height in cells.
   */
  render(
    buffer: OptimizedBuffer,
    cameraX: number,
    cameraY: number,
    viewWidth: number,
    viewHeight: number,
  ): void {
    if (!this._active) return;

    const char = GATE_CHARS[this.pulseIndex] ?? GATE_CHARS[0];
    const fg = RGBA.fromHex(GATE_FG);
    const bg = RGBA.fromHex(GATE_BG);

    for (const { x, y } of this.savedTiles) {
      const sx = x - cameraX;
      const sy = y - cameraY;

      // Only render if within viewport
      if (sx >= 0 && sx < viewWidth && sy >= 0 && sy < viewHeight) {
        buffer.setCell(sx, sy, char, fg, bg, TextAttributes.DIM);
      }
    }
  }

  /**
   * Get the list of world-coordinate cells along a zone edge.
   */
  private getEdgeCells(
    edge: Direction,
    zone: ZoneData,
  ): Array<{ x: number; y: number; cell: TileCell | null }> {
    const cells: Array<{ x: number; y: number; cell: TileCell | null }> = [];
    const groundLayer = zone.layers.find((l) => l.name === "ground");

    switch (edge) {
      case "up":
        for (let x = 0; x < zone.width; x++) {
          const cell = groundLayer
            ? groundLayer.data[0 * groundLayer.width + x] ?? null
            : null;
          cells.push({ x, y: 0, cell });
        }
        break;
      case "down":
        for (let x = 0; x < zone.width; x++) {
          const y = zone.height - 1;
          const cell = groundLayer
            ? groundLayer.data[y * groundLayer.width + x] ?? null
            : null;
          cells.push({ x, y, cell });
        }
        break;
      case "left":
        for (let y = 0; y < zone.height; y++) {
          const cell = groundLayer
            ? groundLayer.data[y * groundLayer.width + 0] ?? null
            : null;
          cells.push({ x: 0, y, cell });
        }
        break;
      case "right":
        for (let y = 0; y < zone.height; y++) {
          const x = zone.width - 1;
          const cell = groundLayer
            ? groundLayer.data[y * groundLayer.width + x] ?? null
            : null;
          cells.push({ x, y, cell });
        }
        break;
    }

    return cells;
  }
}
