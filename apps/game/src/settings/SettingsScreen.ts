import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
} from "@opentui/core";
import { SettingsManager, type ProviderInfo } from "./SettingsManager.ts";
import type { LogLevel } from "@logtape/logtape";
import { join } from "node:path";
import { homedir } from "node:os";

const LOG_LEVELS: LogLevel[] = ["trace", "debug", "info", "warning", "error", "fatal"];
const LOG_FORMATS = ["text", "json"] as const;

/** Callback fired when a logging setting changes so the caller can reconfigure. */
export type OnLoggingChange = (key: "level" | "format", value: string) => void;

export class SettingsScreen {
  private container: BoxRenderable;
  private providerTexts: TextRenderable[] = [];
  private loggingHeaderText!: TextRenderable;
  private logLevelText!: TextRenderable;
  private logFormatText!: TextRenderable;
  private logPathText!: TextRenderable;
  private instructionText: TextRenderable;
  private providers: ProviderInfo[] = [];
  private selectedIndex = 0;
  private editing = false;
  private editBuffer = "";
  private resolve: (() => void) | null = null;
  private onLoggingChange: OnLoggingChange | null = null;

  /** Total selectable items: providers + 2 logging options (level, format). */
  private get totalItems(): number {
    return this.providers.length + 2;
  }

  /** Whether the current selection is in the logging section. */
  private get isLoggingItem(): boolean {
    return this.selectedIndex >= this.providers.length;
  }

  /** Index within the logging section (0 = level, 1 = format). */
  private get loggingItemIndex(): number {
    return this.selectedIndex - this.providers.length;
  }

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

    this.instructionText = new TextRenderable(renderer, {
      id: "settings-instructions",
      content: "",
      fg: "#414868",
    });
  }

  /** Set a callback for when logging settings change. */
  setOnLoggingChange(cb: OnLoggingChange): void {
    this.onLoggingChange = cb;
  }

  /** Show the settings screen and wait for the user to press Escape. */
  async show(): Promise<void> {
    this.providers = this.settingsManager.getProviders();
    this.selectedIndex = 0;
    this.editing = false;

    // API Keys section header
    const apiHeader = new TextRenderable(this.renderer, {
      id: "settings-api-header",
      content: "  API Keys",
      fg: "#7aa2f7",
    });
    this.container.add(apiHeader);

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

    // Logging section
    this.loggingHeaderText = new TextRenderable(this.renderer, {
      id: "settings-logging-header",
      content: "\n  Logging",
      fg: "#7aa2f7",
    });
    this.container.add(this.loggingHeaderText);

    this.logLevelText = new TextRenderable(this.renderer, {
      id: "settings-log-level",
      content: "",
      fg: "#c0caf5",
    });
    this.container.add(this.logLevelText);

    this.logFormatText = new TextRenderable(this.renderer, {
      id: "settings-log-format",
      content: "",
      fg: "#c0caf5",
    });
    this.container.add(this.logFormatText);

    this.logPathText = new TextRenderable(this.renderer, {
      id: "settings-log-path",
      content: `\n  Log files: ${join(homedir(), ".daydream", "logs")}`,
      fg: "#414868",
    });
    this.container.add(this.logPathText);

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
    // API key rows
    for (let i = 0; i < this.providers.length; i++) {
      const p = this.providers[i]!;
      const selected = i === this.selectedIndex;
      const prefix = selected ? "  ▸ " : "    ";

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

    // Logging rows
    const currentLevel = this.settingsManager.get<string>("logging.level") ?? "info";
    const currentFormat = this.settingsManager.get<string>("logging.format") ?? "text";

    const levelSelected = this.loggingItemIndex === 0;
    const formatSelected = this.loggingItemIndex === 1;

    const levelPrefix = levelSelected ? "  ▸ " : "    ";
    const formatPrefix = formatSelected ? "  ▸ " : "    ";

    this.logLevelText.content = `${levelPrefix}Level: ${currentLevel}`;
    this.logLevelText.fg = levelSelected ? "#c0caf5" : "#565f89";

    this.logFormatText.content = `${formatPrefix}Format: ${currentFormat}`;
    this.logFormatText.fg = formatSelected ? "#c0caf5" : "#565f89";

    // Instructions
    if (this.editing) {
      this.instructionText.content = "\n\n  [Enter] Save  [Esc] Cancel";
    } else if (this.isLoggingItem) {
      this.instructionText.content = "\n\n  [Enter/→] Next option  [←] Prev option  [Esc] Back";
    } else {
      this.instructionText.content = "\n\n  [Enter] Edit key  [d] Delete key  [Esc] Back";
    }

    this.renderer.requestRender();
  }

  private handleKey(key: { name: string; raw?: string; shift?: boolean }): void {
    if (this.editing) {
      this.handleEditKey(key);
    } else {
      this.handleNavigationKey(key);
    }
  }

  private handleNavigationKey(key: { name: string; raw?: string }): void {
    if (key.name === "escape") {
      this.resolve?.();
      this.resolve = null;
      return;
    }

    if (key.name === "up") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateDisplay();
      return;
    }

    if (key.name === "down") {
      this.selectedIndex = Math.min(this.totalItems - 1, this.selectedIndex + 1);
      this.updateDisplay();
      return;
    }

    // Logging items: cycle with Enter, left, right
    if (this.isLoggingItem) {
      if (key.name === "return" || key.name === "right") {
        this.cycleLoggingOption(1);
        return;
      }
      if (key.name === "left") {
        this.cycleLoggingOption(-1);
        return;
      }
      return;
    }

    // Provider items: Enter to edit, d to delete
    if (key.name === "return") {
      this.editing = true;
      this.editBuffer = "";
      this.updateDisplay();
      return;
    }

    if (key.name === "d" || key.name === "D") {
      const provider = this.providers[this.selectedIndex];
      if (provider) {
        this.settingsManager.removeApiKey(provider.name);
        this.providers = this.settingsManager.getProviders();
        this.updateDisplay();
      }
    }
  }

  private cycleLoggingOption(direction: number): void {
    if (this.loggingItemIndex === 0) {
      // Cycle log level
      const current = this.settingsManager.get<string>("logging.level") ?? "info";
      const idx = LOG_LEVELS.indexOf(current as LogLevel);
      const next = LOG_LEVELS[(idx + direction + LOG_LEVELS.length) % LOG_LEVELS.length]!;
      this.settingsManager.set("logging.level", next);
      this.onLoggingChange?.("level", next);
    } else {
      // Cycle log format
      const current = this.settingsManager.get<string>("logging.format") ?? "text";
      const idx = LOG_FORMATS.indexOf(current as typeof LOG_FORMATS[number]);
      const next = LOG_FORMATS[(idx + direction + LOG_FORMATS.length) % LOG_FORMATS.length]!;
      this.settingsManager.set("logging.format", next);
      this.onLoggingChange?.("format", next);
    }
    this.updateDisplay();
  }

  private handleEditKey(key: { name: string; raw?: string }): void {
    if (key.name === "escape") {
      this.editing = false;
      this.editBuffer = "";
      this.updateDisplay();
      return;
    }

    if (key.name === "return") {
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

    if (key.name === "backspace" || key.name === "delete") {
      this.editBuffer = this.editBuffer.slice(0, -1);
      this.updateDisplay();
      return;
    }

    if (key.raw && key.raw.length === 1) {
      this.editBuffer += key.raw;
      this.updateDisplay();
    }
  }
}
