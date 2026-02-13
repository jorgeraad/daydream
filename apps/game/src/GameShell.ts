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
  SpriteRegistry,
  ALL_SPRITES,
  AnimationManager,
} from "@daydream/renderer";
import type { ZoneData, AnimationState } from "@daydream/renderer";

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
  private spriteRegistry: SpriteRegistry;
  private animationManager: AnimationManager;

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
    this.spriteRegistry = new SpriteRegistry();
    this.spriteRegistry.registerBuiltins(ALL_SPRITES);
    this.tileRenderer = new TileRenderer(this.viewportFB.frameBuffer, this.spriteRegistry);
    this.animationManager = new AnimationManager(renderer);

    // Register frame callback for continuous animation updates
    this.frameCallback = this.frameCallback.bind(this);
    renderer.setFrameCallback(this.frameCallback);

    // Register initial zone animations
    this.animationManager.registerZoneAnimations(zone);

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

  /**
   * Frame callback called by OpenTUI on each render frame.
   * Updates animations and re-renders the zone with current animation state.
   */
  private async frameCallback(deltaTime: number): Promise<void> {
    this.animationManager.update(deltaTime);
    this.renderFrame();
  }

  /**
   * Get the current animation state for rendering.
   */
  private getAnimationState(): AnimationState {
    return {
      overrides: this.animationManager.getOverrides(),
      colorTransform: this.animationManager.getColorTransform(),
    };
  }

  /**
   * Render a single frame of the game world with current animation state.
   */
  private renderFrame(): void {
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
      this.getAnimationState(),
    );
  }

  /**
   * Handle zone change: clear old animations and register new ones.
   * Call this when the player enters a new zone.
   */
  onZoneEntered(zone: ZoneData): void {
    this.zone = zone;
    this.animationManager.clearAll();
    this.animationManager.registerZoneAnimations(zone);
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
    this.renderFrame();
    this.renderer.auto();
  }

  destroy(): void {
    this.renderer.removeFrameCallback(this.frameCallback);
    this.animationManager.clearAll();
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
      case "up":
        dy = -1;
        break;
      case "down":
        dy = 1;
        break;
      case "left":
        dx = -1;
        break;
      case "right":
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
      this.renderFrame();
      this.renderer.requestRender();
    }
  }

  private handleViewportResize(): void {
    const newWidth = this.viewportFB.width;
    const newHeight = this.viewportFB.height;

    this.viewportManager.resize(newWidth, newHeight);
    this.tileRenderer = new TileRenderer(this.viewportFB.frameBuffer, this.spriteRegistry);

    this.renderFrame();
    this.renderer.requestRender();
  }
}
