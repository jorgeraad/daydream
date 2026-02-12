import {
  createCliRenderer,
  BoxRenderable,
  FrameBufferRenderable,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core";
import {
  TileRenderer,
  ViewportManager,
  isCollision,
  ContextPanel,
  MiniMap,
  NarrativeBar,
} from "@daydream/renderer";
import type { ZoneData } from "@daydream/renderer";

export type GameMode = "exploration" | "dialogue" | "menu";

const SIDE_PANEL_WIDTH = 20;
const NARRATIVE_BAR_HEIGHT = 8;
const MIN_TERMINAL_WIDTH = 80;
const MIN_TERMINAL_HEIGHT = 24;

export class GameShell {
  readonly renderer: CliRenderer;

  // Layout
  private viewportFB: FrameBufferRenderable;
  readonly contextPanel: ContextPanel;
  readonly miniMap: MiniMap;
  readonly narrativeBar: NarrativeBar;

  // Game systems
  private tileRenderer: TileRenderer;
  private viewportManager: ViewportManager;

  // Game state
  private zone: ZoneData;
  private playerX: number;
  private playerY: number;
  private mode: GameMode = "exploration";

  constructor(
    renderer: CliRenderer,
    zone: ZoneData,
    playerX: number,
    playerY: number,
  ) {
    this.renderer = renderer;
    this.zone = zone;
    this.playerX = playerX;
    this.playerY = playerY;

    // Compute initial viewport dimensions
    const vpWidth = Math.max(10, renderer.width - SIDE_PANEL_WIDTH);
    const vpHeight = Math.max(10, renderer.height - NARRATIVE_BAR_HEIGHT);

    // --- Build layout ---
    // Root is a flex column (default), stacking topRow above narrativeBar

    // Top row: viewport + side panel
    const topRow = new BoxRenderable(renderer, {
      id: "top-row",
      flexDirection: "row",
      flexGrow: 1,
    });

    // Viewport: game world rendering
    this.viewportFB = new FrameBufferRenderable(renderer, {
      id: "viewport",
      width: vpWidth,
      height: vpHeight,
      flexGrow: 1,
      onKeyDown: (key: KeyEvent) => this.handleKey(key),
      onSizeChange: () => this.handleViewportResize(),
    });
    this.viewportFB.focusable = true;

    // Side panel: mini-map + context info
    const sidePanel = new BoxRenderable(renderer, {
      id: "side-panel",
      width: SIDE_PANEL_WIDTH,
      flexDirection: "column",
    });

    this.miniMap = new MiniMap(renderer);
    this.contextPanel = new ContextPanel(renderer);

    sidePanel.add(this.miniMap.container);
    sidePanel.add(this.contextPanel.container);

    topRow.add(this.viewportFB);
    topRow.add(sidePanel);

    // Narrative bar: scrollable text at bottom
    this.narrativeBar = new NarrativeBar(renderer);

    renderer.root.add(topRow);
    renderer.root.add(this.narrativeBar.container);

    // --- Initialize game systems ---
    this.viewportManager = new ViewportManager(vpWidth, vpHeight);
    this.tileRenderer = new TileRenderer(this.viewportFB.frameBuffer);

    // Focus viewport for keyboard input
    this.viewportFB.focus();

    // Set initial placeholder context
    this.contextPanel.update({
      location: "Forest Clearing",
      timeOfDay: "Morning",
      nearbyNPCs: [],
    });
    this.narrativeBar.addLine(
      "You find yourself in a quiet forest clearing...",
    );
  }

  static async create(
    zone: ZoneData,
    playerX: number,
    playerY: number,
  ): Promise<GameShell> {
    const renderer = await createCliRenderer({
      exitOnCtrlC: true,
      useAlternateScreen: true,
      targetFps: 15,
      maxFps: 30,
    });

    if (
      renderer.width < MIN_TERMINAL_WIDTH ||
      renderer.height < MIN_TERMINAL_HEIGHT
    ) {
      renderer.destroy();
      throw new Error(
        `Terminal too small (${renderer.width}x${renderer.height}). ` +
          `Minimum ${MIN_TERMINAL_WIDTH}x${MIN_TERMINAL_HEIGHT} required.`,
      );
    }

    return new GameShell(renderer, zone, playerX, playerY);
  }

  start(): void {
    this.viewportManager.updateCamera(
      this.playerX,
      this.playerY,
      this.zone.width,
      this.zone.height,
    );
    this.tileRenderer.renderZone(
      this.zone,
      this.viewportManager,
      this.playerX,
      this.playerY,
    );

    this.renderer.auto();
  }

  destroy(): void {
    this.renderer.destroy();
  }

  get currentMode(): GameMode {
    return this.mode;
  }

  private handleKey(key: KeyEvent): void {
    if (this.mode === "exploration") {
      this.handleExplorationKey(key);
    }
  }

  private handleExplorationKey(key: KeyEvent): void {
    let dx = 0;
    let dy = 0;

    switch (key.name) {
      // Arrow keys
      case "ArrowUp":
        dy = -1;
        break;
      case "ArrowDown":
        dy = 1;
        break;
      case "ArrowLeft":
        dx = -1;
        break;
      case "ArrowRight":
        dx = 1;
        break;
      // WASD
      case "w":
        dy = -1;
        break;
      case "s":
        dy = 1;
        break;
      case "a":
        dx = -1;
        break;
      case "d":
        dx = 1;
        break;
      // vim: hjkl
      case "h":
        dx = -1;
        break;
      case "j":
        dy = 1;
        break;
      case "k":
        dy = -1;
        break;
      case "l":
        dx = 1;
        break;
      // Quit
      case "q":
        this.destroy();
        process.exit(0);
    }

    if (dx === 0 && dy === 0) return;

    const nx = this.playerX + dx;
    const ny = this.playerY + dy;

    if (!isCollision(this.zone, nx, ny)) {
      this.playerX = nx;
      this.playerY = ny;
      this.viewportManager.updateCamera(
        this.playerX,
        this.playerY,
        this.zone.width,
        this.zone.height,
      );
      this.tileRenderer.renderZone(
        this.zone,
        this.viewportManager,
        this.playerX,
        this.playerY,
      );
      this.renderer.requestRender();
    }
  }

  private handleViewportResize(): void {
    const newWidth = this.viewportFB.width;
    const newHeight = this.viewportFB.height;

    this.viewportManager.resize(newWidth, newHeight);
    this.tileRenderer = new TileRenderer(this.viewportFB.frameBuffer);

    this.viewportManager.updateCamera(
      this.playerX,
      this.playerY,
      this.zone.width,
      this.zone.height,
    );
    this.tileRenderer.renderZone(
      this.zone,
      this.viewportManager,
      this.playerX,
      this.playerY,
    );
    this.renderer.requestRender();
  }
}
