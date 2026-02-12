import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
} from "@opentui/core";
import { SettingsManager, type ProviderInfo } from "./SettingsManager.ts";

export class SettingsScreen {
  private container: BoxRenderable;
  private providerTexts: TextRenderable[] = [];
  private instructionText: TextRenderable;
  private providers: ProviderInfo[] = [];
  private selectedIndex = 0;
  private editing = false;
  private editBuffer = "";
  private resolve: (() => void) | null = null;

  constructor(
    private renderer: CliRenderer,
    private settingsManager: SettingsManager,
  ) {
    this.container = new BoxRenderable(renderer, {
      id: "settings-screen",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0a0a1a",
    });

    // Title
    const title = new TextRenderable(renderer, {
      id: "settings-title",
      content: "\n  ── Settings ──\n\n",
      fg: "#7aa2f7",
    });
    this.container.add(title);

    // Provider rows (will be populated in show())
    this.instructionText = new TextRenderable(renderer, {
      id: "settings-instructions",
      content: "",
      fg: "#414868",
    });
  }

  /** Show the settings screen and wait for the user to press Escape. */
  async show(): Promise<void> {
    this.providers = this.settingsManager.getProviders();
    this.selectedIndex = 0;
    this.editing = false;

    // Create provider text renderables
    for (let i = 0; i < this.providers.length; i++) {
      const text = new TextRenderable(this.renderer, {
        id: `settings-provider-${i}`,
        content: "",
        fg: "#c0caf5",
      });
      this.providerTexts.push(text);
      this.container.add(text);
    }

    this.container.add(this.instructionText);
    this.updateDisplay();

    this.renderer.root.add(this.container);
    this.container.focusable = true;
    this.container.focus();
    this.container.onKeyDown = (key) => this.handleKey(key);
    this.renderer.requestRender();

    return new Promise<void>((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Remove the settings screen from the renderer. */
  destroy(): void {
    this.renderer.root.remove("settings-screen");
  }

  private updateDisplay(): void {
    for (let i = 0; i < this.providers.length; i++) {
      const p = this.providers[i]!;
      const selected = i === this.selectedIndex;
      const prefix = selected ? "▸ " : "  ";

      if (this.editing && selected) {
        const masked = this.editBuffer.length > 0
          ? "*".repeat(this.editBuffer.length) + "█"
          : "█";
        this.providerTexts[i]!.content = `${prefix}${p.label}: ${masked}`;
        this.providerTexts[i]!.fg = "#7aa2f7";
      } else {
        const apiKey = this.settingsManager.getApiKey(p.name);
        const value = apiKey
          ? SettingsManager.maskApiKey(apiKey)
          : "(not configured)";
        this.providerTexts[i]!.content = `${prefix}${p.label}: ${value}`;
        this.providerTexts[i]!.fg = selected ? "#c0caf5" : "#565f89";
      }
    }

    if (this.editing) {
      this.instructionText.content = "\n\n  [Enter] Save  [Esc] Cancel";
    } else {
      this.instructionText.content = "\n\n  [Enter] Edit key  [d] Delete key  [Esc] Back";
    }

    this.renderer.requestRender();
  }

  private handleKey(key: { name: string; char?: string; shift?: boolean }): void {
    if (this.editing) {
      this.handleEditKey(key);
    } else {
      this.handleNavigationKey(key);
    }
  }

  private handleNavigationKey(key: { name: string; char?: string }): void {
    if (key.name === "Escape") {
      this.resolve?.();
      this.resolve = null;
      return;
    }

    if (key.name === "Up" || key.name === "ArrowUp") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateDisplay();
      return;
    }

    if (key.name === "Down" || key.name === "ArrowDown") {
      this.selectedIndex = Math.min(this.providers.length - 1, this.selectedIndex + 1);
      this.updateDisplay();
      return;
    }

    if (key.name === "Return" || key.name === "Enter") {
      this.editing = true;
      this.editBuffer = "";
      this.updateDisplay();
      return;
    }

    if (key.char === "d" || key.char === "D") {
      const provider = this.providers[this.selectedIndex];
      if (provider) {
        this.settingsManager.removeApiKey(provider.name);
        this.providers = this.settingsManager.getProviders();
        this.updateDisplay();
      }
    }
  }

  private handleEditKey(key: { name: string; char?: string }): void {
    if (key.name === "Escape") {
      this.editing = false;
      this.editBuffer = "";
      this.updateDisplay();
      return;
    }

    if (key.name === "Return" || key.name === "Enter") {
      if (this.editBuffer.trim().length > 0) {
        const provider = this.providers[this.selectedIndex];
        if (provider) {
          this.settingsManager.setApiKey(provider.name, this.editBuffer.trim());
          this.providers = this.settingsManager.getProviders();
        }
      }
      this.editing = false;
      this.editBuffer = "";
      this.updateDisplay();
      return;
    }

    if (key.name === "Backspace" || key.name === "Delete") {
      this.editBuffer = this.editBuffer.slice(0, -1);
      this.updateDisplay();
      return;
    }

    if (key.char && key.char.length === 1) {
      this.editBuffer += key.char;
      this.updateDisplay();
    }
  }
}
