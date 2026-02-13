import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
} from "@opentui/core";
import { GameInput } from "@daydream/renderer";

const COLORS = {
  overlayBg: "#0a0a1a",
  title: "#bb9af7",
  label: "#c0caf5",
  hint: "#414868",
  loadingText: "#7aa2f7",
};

export type PortalPromptResult =
  | { type: "submit"; description: string }
  | { type: "cancel" };

/**
 * PortalPrompt — full-screen overlay for describing a new location to portal to.
 *
 * Shows a centered input box with a title and instructions. The player types
 * a description of the new location and presses Enter to generate it, or
 * Escape to cancel. During generation, the input is replaced with a loading
 * indicator that shows progress status updates.
 */
export class PortalPrompt {
  private renderer: CliRenderer;
  private container: BoxRenderable;
  private input: GameInput;
  private loadingText: TextRenderable;
  private visible = false;
  private generating = false;
  private resolve: ((result: PortalPromptResult) => void) | null = null;

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;

    // Main container — fills the screen, centered content
    this.container = new BoxRenderable(renderer, {
      id: "portal-prompt",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.overlayBg,
    });

    // Title
    const title = new TextRenderable(renderer, {
      id: "portal-title",
      content: "\n  ~ Open a Portal ~\n",
      fg: COLORS.title,
    });
    this.container.add(title);

    // Label
    const label = new TextRenderable(renderer, {
      id: "portal-label",
      content: "Describe the place you want to travel to:\n",
      fg: COLORS.label,
    });
    this.container.add(label);

    // Input
    this.input = new GameInput(renderer, {
      id: "portal-input",
      width: 60,
      placeholder: "A moonlit harbor with ancient stone docks...",
      onSubmit: (value) => {
        if (value.trim().length > 0 && !this.generating) {
          this.resolve?.({ type: "submit", description: value.trim() });
          this.resolve = null;
        }
      },
      onCancel: () => {
        if (!this.generating) {
          this.resolve?.({ type: "cancel" });
          this.resolve = null;
        }
      },
    });
    this.container.add(this.input.container);

    // Hint
    const hint = new TextRenderable(renderer, {
      id: "portal-hint",
      content: "\n[Enter] Generate  [Esc] Cancel",
      fg: COLORS.hint,
    });
    this.container.add(hint);

    // Loading text (hidden initially, shown during generation)
    this.loadingText = new TextRenderable(renderer, {
      id: "portal-loading",
      content: "",
      fg: COLORS.loadingText,
    });
  }

  /**
   * Show the portal prompt overlay and wait for user input.
   * Returns the description entered or null if cancelled.
   */
  show(): Promise<PortalPromptResult> {
    if (this.visible) return Promise.resolve({ type: "cancel" });
    this.visible = true;
    this.generating = false;
    this.input.value = "";

    this.renderer.root.add(this.container);
    this.input.focus();
    this.renderer.requestRender();

    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  /**
   * Switch to loading state — hides input, shows generation progress.
   */
  showLoading(status: string): void {
    this.generating = true;
    this.loadingText.content = `\n${status}`;

    // Remove input, add loading text
    this.container.remove("portal-input");
    this.container.remove("portal-hint");
    this.container.add(this.loadingText);
    this.renderer.requestRender();
  }

  /**
   * Update the loading status text.
   */
  setStatus(status: string): void {
    this.loadingText.content = `\n${status}`;
    this.renderer.requestRender();
  }

  /**
   * Hide the portal prompt overlay.
   */
  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.generating = false;
    this.input.destroy();
    this.renderer.root.remove("portal-prompt");
    this.renderer.requestRender();
  }

  /**
   * Whether the overlay is currently visible.
   */
  get isVisible(): boolean {
    return this.visible;
  }

  /**
   * Whether generation is in progress.
   */
  get isGenerating(): boolean {
    return this.generating;
  }
}
