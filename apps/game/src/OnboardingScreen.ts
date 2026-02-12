import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
} from "@opentui/core";
import { SettingsManager } from "./settings/SettingsManager.ts";

const WELCOME_ART = `
     ╔═══════════════════════════════╗
     ║         D A Y D R E A M       ║
     ╚═══════════════════════════════╝
`;

const WELCOME_TEXT = `Welcome to Daydream — an AI-generated world awaits you.

To create worlds from your imagination, Daydream needs
an Anthropic API key. You only need to do this once.`;

const KEY_URL = "Get your key at: console.anthropic.com/settings/keys";

type Phase = "intro" | "input" | "saved";

export class OnboardingScreen {
  private container: BoxRenderable;
  private bodyText: TextRenderable;
  private inputBox: BoxRenderable;
  private inputText: TextRenderable;
  private hintText: TextRenderable;
  private errorText: TextRenderable;
  private phase: Phase = "intro";
  private buffer = "";
  private resolve: (() => void) | null = null;

  constructor(
    private renderer: CliRenderer,
    private settingsManager: SettingsManager,
  ) {
    this.container = new BoxRenderable(renderer, {
      id: "onboarding-screen",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0a0a1a",
    });

    // Title art
    const titleText = new TextRenderable(renderer, {
      id: "onboarding-title",
      content: WELCOME_ART,
      fg: "#7aa2f7",
    });
    this.container.add(titleText);

    // Welcome body
    this.bodyText = new TextRenderable(renderer, {
      id: "onboarding-body",
      content: `\n${WELCOME_TEXT}\n`,
      fg: "#c0caf5",
    });
    this.container.add(this.bodyText);

    // URL hint
    const urlText = new TextRenderable(renderer, {
      id: "onboarding-url",
      content: `${KEY_URL}\n\n`,
      fg: "#7aa2f7",
    });
    this.container.add(urlText);

    // Input box (hidden during intro phase via empty content)
    this.inputBox = new BoxRenderable(renderer, {
      id: "onboarding-input-box",
      width: 60,
      height: 3,
      border: true,
      borderStyle: "rounded",
      borderColor: "#7aa2f7",
      paddingX: 1,
      justifyContent: "center",
    });

    this.inputText = new TextRenderable(renderer, {
      id: "onboarding-input-text",
      content: "",
      fg: "#c0caf5",
    });
    this.inputBox.add(this.inputText);
    this.container.add(this.inputBox);

    // Error text (shown on validation failure)
    this.errorText = new TextRenderable(renderer, {
      id: "onboarding-error",
      content: "",
      fg: "#f7768e",
    });
    this.container.add(this.errorText);

    // Hint text
    this.hintText = new TextRenderable(renderer, {
      id: "onboarding-hint",
      content: "",
      fg: "#414868",
    });
    this.container.add(this.hintText);
  }

  /** Show the onboarding flow. Resolves when the user has saved an API key. */
  async show(): Promise<void> {
    this.phase = "intro";
    this.buffer = "";
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

  destroy(): void {
    this.renderer.root.remove("onboarding-screen");
  }

  private updateDisplay(): void {
    switch (this.phase) {
      case "intro":
        this.inputText.content = "";
        this.inputBox.borderColor = "#565f89";
        this.errorText.content = "";
        this.hintText.content = "\n  Press Enter to set up your API key";
        break;

      case "input":
        this.inputText.content = this.buffer.length > 0
          ? "*".repeat(this.buffer.length) + "█"
          : "█";
        this.inputBox.borderColor = "#7aa2f7";
        this.hintText.content = "\n  Paste your API key and press Enter";
        break;

      case "saved":
        this.inputText.content = SettingsManager.maskApiKey(
          this.settingsManager.getApiKey("anthropic")!,
        );
        this.inputBox.borderColor = "#9ece6a";
        this.errorText.content = "";
        this.hintText.content = "\n  Key saved! Press Enter to start dreaming...";
        break;
    }

    this.renderer.requestRender();
  }

  private handleKey(key: { name: string; char?: string; shift?: boolean }): void {
    switch (this.phase) {
      case "intro":
        if (key.name === "Return" || key.name === "Enter") {
          this.phase = "input";
          this.updateDisplay();
        }
        break;

      case "input":
        this.handleInputKey(key);
        break;

      case "saved":
        if (key.name === "Return" || key.name === "Enter") {
          this.resolve?.();
          this.resolve = null;
        }
        break;
    }
  }

  private handleInputKey(key: { name: string; char?: string }): void {
    if (key.name === "Return" || key.name === "Enter") {
      const trimmed = this.buffer.trim();
      if (trimmed.length === 0) {
        this.errorText.content = "\n  Please enter an API key";
        this.renderer.requestRender();
        return;
      }
      if (!trimmed.startsWith("sk-")) {
        this.errorText.content = "\n  That doesn't look like an Anthropic API key (should start with sk-)";
        this.renderer.requestRender();
        return;
      }
      // Save the key
      this.settingsManager.setApiKey("anthropic", trimmed);
      this.phase = "saved";
      this.updateDisplay();
      return;
    }

    if (key.name === "Backspace" || key.name === "Delete") {
      this.buffer = this.buffer.slice(0, -1);
    } else if (key.char && key.char.length === 1 && key.name !== "Escape") {
      this.buffer += key.char;
    }

    this.errorText.content = "";
    this.updateDisplay();
  }
}
