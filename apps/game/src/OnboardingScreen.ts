import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
} from "@opentui/core";
import { MaskedInput } from "@daydream/renderer";
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
  private inputPlaceholder: BoxRenderable;
  private savedKeyText: TextRenderable;
  private hintText: TextRenderable;
  private errorText: TextRenderable;
  private phase: Phase = "intro";
  private maskedInput: MaskedInput | null = null;
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

    // Placeholder box for intro/saved phases (shows dimmed border in intro, saved key in saved)
    this.inputPlaceholder = new BoxRenderable(renderer, {
      id: "onboarding-input-box",
      width: 60,
      height: 3,
      border: true,
      borderStyle: "rounded",
      borderColor: "#565f89",
      paddingX: 1,
      justifyContent: "center",
    });

    this.savedKeyText = new TextRenderable(renderer, {
      id: "onboarding-saved-key",
      content: "",
      fg: "#c0caf5",
    });
    this.inputPlaceholder.add(this.savedKeyText);
    this.container.add(this.inputPlaceholder);

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
    if (this.maskedInput) {
      this.maskedInput.destroy();
      this.maskedInput = null;
    }
    this.renderer.root.remove("onboarding-screen");
  }

  private updateDisplay(): void {
    switch (this.phase) {
      case "intro":
        this.inputPlaceholder.visible = true;
        this.savedKeyText.content = "";
        this.inputPlaceholder.borderColor = "#565f89";
        this.errorText.content = "";
        this.hintText.content = "\n  Press Enter to set up your API key";
        break;

      case "input":
        // Hide the placeholder box — MaskedInput provides its own container
        this.inputPlaceholder.visible = false;
        this.errorText.content = "";
        this.hintText.content = "\n  Paste your API key and press Enter";
        break;

      case "saved":
        // Show the placeholder box again with the saved key
        this.inputPlaceholder.visible = true;
        this.savedKeyText.content = SettingsManager.maskApiKey(
          this.settingsManager.getApiKey("anthropic")!,
        );
        this.inputPlaceholder.borderColor = "#9ece6a";
        this.errorText.content = "";
        this.hintText.content = "\n  Key saved! Press Enter to start dreaming...";
        break;
    }

    this.renderer.requestRender();
  }

  private handleKey(key: { name: string; raw?: string; shift?: boolean }): void {
    switch (this.phase) {
      case "intro":
        if (key.name === "return") {
          this.transitionToInput();
        }
        break;

      case "input":
        // MaskedInput handles all input in this phase — container should not interfere
        break;

      case "saved":
        if (key.name === "return") {
          this.resolve?.();
          this.resolve = null;
        }
        break;
    }
  }

  private transitionToInput(): void {
    this.phase = "input";
    this.updateDisplay();

    // Create the MaskedInput and insert it where the placeholder was
    this.maskedInput = new MaskedInput(this.renderer, {
      id: "onboarding-masked-input",
      width: 60,
      placeholder: "sk-ant-...",
      onSubmit: (value) => {
        const trimmed = value.trim();
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
        // Save the key and transition to saved phase
        this.settingsManager.setApiKey("anthropic", trimmed);
        this.transitionToSaved();
      },
      onChange: () => {
        // Clear error on any edit
        this.errorText.content = "";
        this.renderer.requestRender();
      },
    });

    // Insert the MaskedInput container before the error text
    // (it replaces the hidden inputPlaceholder visually)
    this.container.insertBefore(this.maskedInput.container, this.errorText);
    this.maskedInput.focus();
    this.renderer.requestRender();
  }

  private transitionToSaved(): void {
    // Remove and destroy the MaskedInput
    if (this.maskedInput) {
      this.container.remove("onboarding-masked-input");
      this.maskedInput.destroy();
      this.maskedInput = null;
    }

    this.phase = "saved";
    this.updateDisplay();

    // Re-focus the container for Enter to continue
    this.container.focus();
  }
}
