import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
} from "@opentui/core";
import { MaskedInput } from "@daydream/renderer";
import { SettingsManager, type ProviderInfo } from "./SettingsManager.ts";
import type { AudioSettings } from "./AudioSettings.ts";
import type { LogLevel } from "@logtape/logtape";
import { join } from "node:path";
import { homedir } from "node:os";

const LOG_LEVELS: LogLevel[] = ["trace", "debug", "info", "warning", "error", "fatal"];
const LOG_FORMATS = ["text", "json"] as const;

/** Volume steps for cycling with left/right arrows. */
const VOLUME_STEP = 0.1;

/** Callback fired when a logging setting changes so the caller can reconfigure. */
export type OnLoggingChange = (key: "level" | "format", value: string) => void;

/** Callback fired when an audio setting changes so the caller can propagate to AudioManager. */
export type OnAudioChange = (settings: AudioSettings) => void;

export class SettingsScreen {
  private container: BoxRenderable;
  private providerTexts: TextRenderable[] = [];
  private loggingHeaderText!: TextRenderable;
  private logLevelText!: TextRenderable;
  private logFormatText!: TextRenderable;
  private logPathText!: TextRenderable;
  private audioHeaderText!: TextRenderable;
  private audioMusicText!: TextRenderable;
  private audioSFXText!: TextRenderable;
  private audioMasterVolText!: TextRenderable;
  private audioMusicVolText!: TextRenderable;
  private audioSFXVolText!: TextRenderable;
  private instructionText: TextRenderable;
  private providers: ProviderInfo[] = [];
  private selectedIndex = 0;
  private editing = false;
  private maskedInput: MaskedInput | null = null;
  private resolve: (() => void) | null = null;
  private onLoggingChange: OnLoggingChange | null = null;
  private onAudioChange: OnAudioChange | null = null;

  // Section boundaries computed at show() time
  private loggingStart = 0;  // index of first logging item
  private audioStart = 0;    // index of first audio item

  /**
   * Total selectable items:
   *   providers + 2 logging (level, format) + 5 audio (music toggle, SFX toggle, master vol, music vol, SFX vol)
   */
  private get totalItems(): number {
    return this.providers.length + 2 + 5;
  }

  /** Whether the current selection is in the logging section. */
  private get isLoggingItem(): boolean {
    return this.selectedIndex >= this.loggingStart && this.selectedIndex < this.audioStart;
  }

  /** Index within the logging section (0 = level, 1 = format). */
  private get loggingItemIndex(): number {
    return this.selectedIndex - this.loggingStart;
  }

  /** Whether the current selection is in the audio section. */
  private get isAudioItem(): boolean {
    return this.selectedIndex >= this.audioStart;
  }

  /** Index within the audio section (0=music, 1=sfx, 2=master vol, 3=music vol, 4=sfx vol). */
  private get audioItemIndex(): number {
    return this.selectedIndex - this.audioStart;
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
      content: "\n  -- Settings --\n\n",
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

  /** Set a callback for when audio settings change. */
  setOnAudioChange(cb: OnAudioChange): void {
    this.onAudioChange = cb;
  }

  /** Show the settings screen and wait for the user to press Escape. */
  async show(): Promise<void> {
    this.providers = this.settingsManager.getProviders();
    this.selectedIndex = 0;
    this.editing = false;

    // Compute section boundaries
    this.loggingStart = this.providers.length;
    this.audioStart = this.loggingStart + 2;

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

    // Audio section
    this.audioHeaderText = new TextRenderable(this.renderer, {
      id: "settings-audio-header",
      content: "\n  Audio",
      fg: "#7aa2f7",
    });
    this.container.add(this.audioHeaderText);

    this.audioMusicText = new TextRenderable(this.renderer, {
      id: "settings-audio-music",
      content: "",
      fg: "#c0caf5",
    });
    this.container.add(this.audioMusicText);

    this.audioSFXText = new TextRenderable(this.renderer, {
      id: "settings-audio-sfx",
      content: "",
      fg: "#c0caf5",
    });
    this.container.add(this.audioSFXText);

    this.audioMasterVolText = new TextRenderable(this.renderer, {
      id: "settings-audio-master-vol",
      content: "",
      fg: "#c0caf5",
    });
    this.container.add(this.audioMasterVolText);

    this.audioMusicVolText = new TextRenderable(this.renderer, {
      id: "settings-audio-music-vol",
      content: "",
      fg: "#c0caf5",
    });
    this.container.add(this.audioMusicVolText);

    this.audioSFXVolText = new TextRenderable(this.renderer, {
      id: "settings-audio-sfx-vol",
      content: "",
      fg: "#c0caf5",
    });
    this.container.add(this.audioSFXVolText);

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
    if (this.maskedInput) {
      this.maskedInput.destroy();
      this.maskedInput = null;
    }
    this.renderer.root.remove("settings-screen");
  }

  private updateDisplay(): void {
    // API key rows
    for (let i = 0; i < this.providers.length; i++) {
      const p = this.providers[i]!;
      const selected = i === this.selectedIndex;
      const prefix = selected ? "  > " : "    ";

      if (this.editing && selected) {
        // When editing, hide the provider text -- MaskedInput overlay is visible instead
        this.providerTexts[i]!.content = "";
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

    const levelSelected = this.isLoggingItem && this.loggingItemIndex === 0;
    const formatSelected = this.isLoggingItem && this.loggingItemIndex === 1;

    const levelPrefix = levelSelected ? "  > " : "    ";
    const formatPrefix = formatSelected ? "  > " : "    ";

    this.logLevelText.content = `${levelPrefix}Level: ${currentLevel}`;
    this.logLevelText.fg = levelSelected ? "#c0caf5" : "#565f89";

    this.logFormatText.content = `${formatPrefix}Format: ${currentFormat}`;
    this.logFormatText.fg = formatSelected ? "#c0caf5" : "#565f89";

    // Audio rows
    const audio = this.settingsManager.getAudioSettings();

    const musicSelected = this.isAudioItem && this.audioItemIndex === 0;
    const sfxSelected = this.isAudioItem && this.audioItemIndex === 1;
    const masterVolSelected = this.isAudioItem && this.audioItemIndex === 2;
    const musicVolSelected = this.isAudioItem && this.audioItemIndex === 3;
    const sfxVolSelected = this.isAudioItem && this.audioItemIndex === 4;

    this.audioMusicText.content = `${musicSelected ? "  > " : "    "}Music: ${audio.musicEnabled ? "ON" : "OFF"}`;
    this.audioMusicText.fg = musicSelected ? "#c0caf5" : "#565f89";

    this.audioSFXText.content = `${sfxSelected ? "  > " : "    "}SFX:   ${audio.sfxEnabled ? "ON" : "OFF"}`;
    this.audioSFXText.fg = sfxSelected ? "#c0caf5" : "#565f89";

    this.audioMasterVolText.content = `${masterVolSelected ? "  > " : "    "}Master: ${this.renderVolumeBar(audio.masterVolume)}`;
    this.audioMasterVolText.fg = masterVolSelected ? "#c0caf5" : "#565f89";

    this.audioMusicVolText.content = `${musicVolSelected ? "  > " : "    "}Music:  ${this.renderVolumeBar(audio.musicVolume)}`;
    this.audioMusicVolText.fg = musicVolSelected ? "#c0caf5" : "#565f89";

    this.audioSFXVolText.content = `${sfxVolSelected ? "  > " : "    "}SFX:    ${this.renderVolumeBar(audio.sfxVolume)}`;
    this.audioSFXVolText.fg = sfxVolSelected ? "#c0caf5" : "#565f89";

    // Instructions
    if (this.editing) {
      this.instructionText.content = "\n\n  [Enter] Save  [Esc] Cancel";
    } else if (this.isAudioItem) {
      const idx = this.audioItemIndex;
      if (idx <= 1) {
        // Toggle items
        this.instructionText.content = "\n\n  [Enter] Toggle  [Esc] Back";
      } else {
        // Volume items
        this.instructionText.content = "\n\n  [</>] Adjust volume  [Esc] Back";
      }
    } else if (this.isLoggingItem) {
      this.instructionText.content = "\n\n  [Enter/>] Next option  [<] Prev option  [Esc] Back";
    } else {
      this.instructionText.content = "\n\n  [Enter] Edit key  [d] Delete key  [Esc] Back";
    }

    this.renderer.requestRender();
  }

  /** Render a visual volume bar: [========--] 80% */
  private renderVolumeBar(value: number): string {
    const barWidth = 10;
    const filled = Math.round(value * barWidth);
    const empty = barWidth - filled;
    const bar = "=".repeat(filled) + "-".repeat(empty);
    const pct = Math.round(value * 100);
    return `[${bar}] ${pct}%`;
  }

  private handleKey(key: { name: string; raw?: string; shift?: boolean }): void {
    if (this.editing) {
      // MaskedInput handles all input in edit mode -- container should not interfere
      return;
    }
    this.handleNavigationKey(key);
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

    // Audio items
    if (this.isAudioItem) {
      this.handleAudioKey(key);
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
      this.startEditing();
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

  private handleAudioKey(key: { name: string; raw?: string }): void {
    const idx = this.audioItemIndex;
    const audio = this.settingsManager.getAudioSettings();

    if (idx === 0) {
      // Music toggle
      if (key.name === "return" || key.name === "right" || key.name === "left") {
        this.settingsManager.setAudioSettings({ musicEnabled: !audio.musicEnabled });
        this.notifyAudioChange();
        this.updateDisplay();
      }
    } else if (idx === 1) {
      // SFX toggle
      if (key.name === "return" || key.name === "right" || key.name === "left") {
        this.settingsManager.setAudioSettings({ sfxEnabled: !audio.sfxEnabled });
        this.notifyAudioChange();
        this.updateDisplay();
      }
    } else if (idx === 2) {
      // Master volume
      if (key.name === "right") {
        this.adjustVolume("masterVolume", audio.masterVolume, VOLUME_STEP);
      } else if (key.name === "left") {
        this.adjustVolume("masterVolume", audio.masterVolume, -VOLUME_STEP);
      }
    } else if (idx === 3) {
      // Music volume
      if (key.name === "right") {
        this.adjustVolume("musicVolume", audio.musicVolume, VOLUME_STEP);
      } else if (key.name === "left") {
        this.adjustVolume("musicVolume", audio.musicVolume, -VOLUME_STEP);
      }
    } else if (idx === 4) {
      // SFX volume
      if (key.name === "right") {
        this.adjustVolume("sfxVolume", audio.sfxVolume, VOLUME_STEP);
      } else if (key.name === "left") {
        this.adjustVolume("sfxVolume", audio.sfxVolume, -VOLUME_STEP);
      }
    }
  }

  private adjustVolume(key: keyof Pick<AudioSettings, "masterVolume" | "musicVolume" | "sfxVolume">, current: number, delta: number): void {
    const newValue = Math.max(0, Math.min(1, Math.round((current + delta) * 10) / 10));
    this.settingsManager.setAudioSettings({ [key]: newValue });
    this.notifyAudioChange();
    this.updateDisplay();
  }

  private notifyAudioChange(): void {
    if (this.onAudioChange) {
      this.onAudioChange(this.settingsManager.getAudioSettings());
    }
  }

  private startEditing(): void {
    this.editing = true;
    this.updateDisplay();

    const provider = this.providers[this.selectedIndex];
    if (!provider) return;

    // Create MaskedInput overlay for the selected provider
    this.maskedInput = new MaskedInput(this.renderer, {
      id: "settings-edit-input",
      width: 50,
      placeholder: `Paste ${provider.label} key...`,
      onSubmit: (value) => {
        if (value.trim().length > 0) {
          this.settingsManager.setApiKey(provider.name, value.trim());
          this.providers = this.settingsManager.getProviders();
        }
        this.stopEditing();
      },
      onCancel: () => {
        this.stopEditing();
      },
    });

    // Insert the MaskedInput container after the selected provider's TextRenderable
    const providerText = this.providerTexts[this.selectedIndex]!;
    // insertBefore the next sibling -- insert after the logging header if it's the last provider
    const nextSibling = this.selectedIndex < this.providers.length - 1
      ? this.providerTexts[this.selectedIndex + 1]!
      : this.loggingHeaderText;
    this.container.insertBefore(this.maskedInput.container, nextSibling);
    this.maskedInput.focus();
    this.renderer.requestRender();
  }

  private stopEditing(): void {
    if (this.maskedInput) {
      this.container.remove("settings-edit-input");
      this.maskedInput.destroy();
      this.maskedInput = null;
    }

    this.editing = false;
    this.updateDisplay();

    // Re-focus the container for navigation
    this.container.focus();
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
}
