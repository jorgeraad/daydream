import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
} from "@opentui/core";
import { GameInput } from "@daydream/renderer";
import { SaveManager, type WorldSummary } from "./SaveManager.ts";
import { formatPlayTime, truncatePrompt } from "./WorldBrowser.ts";

const TITLE_ART = `
     ╔═══════════════════════════════╗
     ║         D A Y D R E A M       ║
     ╚═══════════════════════════════╝
`;

const SUBTITLE = "AI-generated worlds from your imagination";
const PROMPT_LABEL = "Where would you like to go?";
const HINT = "Type your world prompt and press Enter\n[Esc] Settings";

// ── Tokyo Night palette ────────────────────────────────────
const FG_PRIMARY = "#c0caf5";
const FG_DIMMED = "#565f89";
const FG_ACCENT = "#7aa2f7";
const FG_HINT = "#414868";

// ── Menu items ─────────────────────────────────────────────

type MenuItemId = "continue" | "new-world" | "browse" | "settings";

interface MenuItem {
  id: MenuItemId;
  label: string;
  detail?: string;
  shortcut: string;
}

// ── Result type ────────────────────────────────────────────

export type TitleScreenResult =
  | { type: "prompt"; value: string }
  | { type: "settings" }
  | { type: "continue"; worldId: string }
  | { type: "load"; worldId: string }
  | { type: "browse" };

export class TitleScreen {
  private container: BoxRenderable;
  private input: GameInput;
  private resolve: ((value: TitleScreenResult) => void) | null = null;

  // Menu mode state
  private menuItems: MenuItem[] = [];
  private menuTexts: TextRenderable[] = [];
  private menuHint: TextRenderable | null = null;
  private selectedIndex = 0;
  private worlds: WorldSummary[] = [];
  private inMenuMode = false;

  // Prompt mode elements (always created, visibility toggled)
  private promptLabel: TextRenderable;
  private promptHint: TextRenderable;

  constructor(private renderer: CliRenderer) {
    // Main container — fills the screen, centered content
    this.container = new BoxRenderable(renderer, {
      id: "title-screen",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0a0a1a",
    });

    // Title art
    const titleText = new TextRenderable(renderer, {
      id: "title-art",
      content: TITLE_ART,
      fg: FG_ACCENT,
    });
    this.container.add(titleText);

    // Subtitle
    const subtitle = new TextRenderable(renderer, {
      id: "subtitle",
      content: `\n${SUBTITLE}\n\n`,
      fg: FG_DIMMED,
    });
    this.container.add(subtitle);

    // Prompt label (hidden in menu mode)
    this.promptLabel = new TextRenderable(renderer, {
      id: "prompt-label",
      content: PROMPT_LABEL,
      fg: FG_PRIMARY,
    });
    this.container.add(this.promptLabel);

    // Input — replaces manual inputBox + inputText + buffer
    this.input = new GameInput(renderer, {
      id: "title-input",
      width: 60,
      placeholder: "Describe your world...",
      onSubmit: (value) => {
        if (value.trim().length > 0) {
          this.resolve?.({ type: "prompt", value: value.trim() });
          this.resolve = null;
        }
      },
      onCancel: () => {
        if (this.inMenuMode) {
          // In menu mode, Escape from input returns to menu
          this.switchToMenu();
        } else {
          this.resolve?.({ type: "settings" });
          this.resolve = null;
        }
      },
    });
    this.container.add(this.input.container);

    // Hint (hidden in menu mode)
    this.promptHint = new TextRenderable(renderer, {
      id: "hint",
      content: `\n${HINT}`,
      fg: FG_HINT,
    });
    this.container.add(this.promptHint);
  }

  /** Show the title screen and wait for the user to enter a prompt or make a menu selection. */
  async show(): Promise<TitleScreenResult> {
    this.input.value = "";
    this.renderer.root.add(this.container);

    // Check for saved worlds
    this.worlds = SaveManager.listWorlds();

    if (this.worlds.length > 0) {
      // Menu mode: show menu with Continue / New World / Browse Worlds / Settings
      this.buildMenu();
      this.switchToMenu();
    } else {
      // Prompt mode: show the classic prompt-only UI
      this.switchToPrompt();
    }

    this.renderer.requestRender();

    return new Promise<TitleScreenResult>((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Remove the title screen from the renderer. */
  destroy(): void {
    this.input.destroy();
    this.clearMenuElements();
    this.renderer.root.remove("title-screen");
  }

  // ── Menu mode ─────────────────────────────────────────────

  private buildMenu(): void {
    const mostRecent = this.worlds[0]!;
    const promptSnippet = truncatePrompt(mostRecent.seedPrompt || "No prompt", 30);
    const playTime = formatPlayTime(mostRecent.playTimeSeconds);

    this.menuItems = [
      {
        id: "continue",
        label: "Continue",
        detail: `"${promptSnippet}"  (${playTime})`,
        shortcut: "C",
      },
      {
        id: "new-world",
        label: "New World",
        shortcut: "N",
      },
      {
        id: "browse",
        label: `Browse Worlds (${this.worlds.length} saved)`,
        shortcut: "B",
      },
      {
        id: "settings",
        label: "Settings",
        shortcut: "S",
      },
    ];
  }

  private switchToMenu(): void {
    this.inMenuMode = true;
    this.selectedIndex = 0;

    // Hide prompt-mode elements
    this.promptLabel.content = "";
    this.input.container.height = 0;
    this.input.container.border = false;
    this.input.blur();
    this.promptHint.content = "";

    // Build menu text renderables
    this.clearMenuElements();
    this.renderMenuItems();

    // Add menu hint
    this.menuHint = new TextRenderable(this.renderer, {
      id: "menu-hint",
      content: "\n  [Up/Down] Navigate  [Enter] Select  [C/N/B/S] Shortcut",
      fg: FG_HINT,
    });
    this.container.add(this.menuHint);

    // Set up key handling on the container
    this.container.focusable = true;
    this.container.focus();
    this.container.onKeyDown = (key) => this.handleMenuKey(key);

    this.renderer.requestRender();
  }

  private switchToPrompt(): void {
    this.inMenuMode = false;

    // Remove menu elements
    this.clearMenuElements();

    // Restore prompt-mode elements
    this.promptLabel.content = PROMPT_LABEL;
    this.input.container.height = 3;
    this.input.container.border = true;
    this.promptHint.content = `\n${HINT}`;

    // Restore container key handling
    this.container.onKeyDown = undefined;
    this.container.focusable = false;

    this.input.focus();
    this.renderer.requestRender();
  }

  private clearMenuElements(): void {
    for (const text of this.menuTexts) {
      this.container.remove(text.id);
    }
    this.menuTexts = [];
    if (this.menuHint) {
      this.container.remove("menu-hint");
      this.menuHint = null;
    }
  }

  private renderMenuItems(): void {
    // Remove old menu items first
    for (const text of this.menuTexts) {
      this.container.remove(text.id);
    }
    this.menuTexts = [];

    for (let i = 0; i < this.menuItems.length; i++) {
      const item = this.menuItems[i]!;
      const isSelected = i === this.selectedIndex;
      const cursor = isSelected ? ">" : " ";
      const fg = isSelected ? FG_ACCENT : FG_PRIMARY;

      let content = `  ${cursor} ${item.label}`;
      if (item.detail) {
        content += `    ${item.detail}`;
      }

      const text = new TextRenderable(this.renderer, {
        id: `menu-item-${i}`,
        content: i === 0 ? `\n${content}` : content,
        fg,
      });

      // Insert before the menu hint (or at end)
      this.container.add(text);
      this.menuTexts.push(text);
    }
  }

  private updateMenuDisplay(): void {
    for (let i = 0; i < this.menuItems.length; i++) {
      const item = this.menuItems[i]!;
      const isSelected = i === this.selectedIndex;
      const cursor = isSelected ? ">" : " ";
      const fg = isSelected ? FG_ACCENT : FG_PRIMARY;

      let content = `  ${cursor} ${item.label}`;
      if (item.detail) {
        content += `    ${item.detail}`;
      }

      const text = this.menuTexts[i];
      if (text) {
        text.content = i === 0 ? `\n${content}` : content;
        text.fg = fg;
      }
    }
    this.renderer.requestRender();
  }

  private handleMenuKey(key: { name: string; raw?: string }): void {
    // Arrow navigation
    if (key.name === "up") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateMenuDisplay();
      return;
    }
    if (key.name === "down") {
      this.selectedIndex = Math.min(this.menuItems.length - 1, this.selectedIndex + 1);
      this.updateMenuDisplay();
      return;
    }

    // Enter to select
    if (key.name === "return") {
      this.selectMenuItem(this.menuItems[this.selectedIndex]!.id);
      return;
    }

    // Keyboard shortcuts (case-insensitive)
    const rawLower = (key.raw ?? "").toLowerCase();
    if (rawLower === "c") {
      this.selectMenuItem("continue");
      return;
    }
    if (rawLower === "n") {
      this.selectMenuItem("new-world");
      return;
    }
    if (rawLower === "b") {
      this.selectMenuItem("browse");
      return;
    }
    if (rawLower === "s") {
      this.selectMenuItem("settings");
      return;
    }
  }

  private selectMenuItem(id: MenuItemId): void {
    switch (id) {
      case "continue": {
        const mostRecent = this.worlds[0];
        if (mostRecent) {
          this.resolve?.({ type: "continue", worldId: mostRecent.id });
          this.resolve = null;
        }
        break;
      }
      case "new-world":
        this.switchToPrompt();
        break;
      case "browse":
        this.resolve?.({ type: "browse" });
        this.resolve = null;
        break;
      case "settings":
        this.resolve?.({ type: "settings" });
        this.resolve = null;
        break;
    }
  }
}
