import {
  ScrollBoxRenderable,
  TextRenderable,
  InputRenderable,
  type CliRenderer,
} from "@opentui/core";

export interface DialogueOption {
  text: string;
  type: "dialogue" | "action";
  tone: string;
  preview?: string;
}

export type DialogueSelection =
  | { type: "option"; index: number }
  | { type: "freeform"; text: string }
  | { type: "escape" };

type PanelState = "idle" | "speaking" | "options" | "freeform";

interface KeyEvent {
  name: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * Dialogue UI panel rendered as a bottom bar.
 * State machine: idle -> speaking -> options -> freeform.
 *
 * Typewriter effect reveals text character by character.
 * In options mode, player picks 1-4 or navigates with arrows.
 * Tab switches to freeform text input.
 */
export class DialoguePanel {
  readonly container: ScrollBoxRenderable;
  private textContent: TextRenderable;
  private renderer: CliRenderer;

  private state: PanelState = "idle";

  // Speaking state
  private fullSpeech = "";
  private revealedChars = 0;
  private speakerName = "";
  private emotion = "";
  private typewriterInterval: ReturnType<typeof setInterval> | null = null;
  private speakResolve: (() => void) | null = null;

  // Options state
  private currentOptions: DialogueOption[] = [];
  private selectedIndex = 0;
  private optionResolve: ((sel: DialogueSelection) => void) | null = null;

  // Freeform state
  private freeformInput: InputRenderable | null = null;
  private freeformHintText: TextRenderable | null = null;

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;

    this.container = new ScrollBoxRenderable(renderer, {
      id: "dialogue-panel",
      height: 10,
      border: true,
      borderStyle: "single",
      borderColor: "#7aa2f7",
      title: " Dialogue ",
      stickyScroll: true,
      stickyStart: "bottom",
      contentOptions: {
        paddingX: 1,
      },
    });

    this.textContent = new TextRenderable(renderer, {
      id: "dialogue-text",
      content: "",
    });

    this.container.add(this.textContent);
  }

  // ── Public API ───────────────────────────────────────────

  showSpeech(name: string, text: string, emotion: string): Promise<void> {
    this.state = "speaking";
    this.speakerName = name;
    this.emotion = emotion;
    this.fullSpeech = text;
    this.revealedChars = 0;

    this.updateTitle();
    this.renderSpeaking();
    this.startTypewriter();

    return new Promise((resolve) => {
      this.speakResolve = resolve;
    });
  }

  showOptions(options: DialogueOption[]): Promise<DialogueSelection> {
    this.state = "options";
    this.currentOptions = options;
    this.selectedIndex = 0;
    this.renderOptions();

    return new Promise((resolve) => {
      this.optionResolve = resolve;
    });
  }

  showThinking(): void {
    this.state = "idle";
    this.textContent.content = "\n  ···";
    this.renderer.requestRender();
  }

  showNarration(text: string): void {
    // Italicized narration line (terminal italic via dim)
    this.textContent.content = `  ${text}`;
    this.renderer.requestRender();
  }

  handleKey(key: KeyEvent): void {
    switch (this.state) {
      case "speaking":
        this.handleSpeakingKey();
        break;
      case "options":
        this.handleOptionsKey(key);
        break;
      case "freeform":
        // InputRenderable handles all input in freeform mode
        break;
    }
  }

  clear(): void {
    this.stopTypewriter();
    this.cleanupFreeformInput();
    this.state = "idle";
    this.textContent.content = "";
    this.fullSpeech = "";
    this.revealedChars = 0;
    this.currentOptions = [];
    this.speakResolve = null;
    this.optionResolve = null;
    this.container.title = " Dialogue ";
    this.renderer.requestRender();
  }

  destroy(): void {
    this.clear();
    this.renderer.root.remove("dialogue-panel");
  }

  // ── Speaking State ───────────────────────────────────────

  private startTypewriter(): void {
    this.stopTypewriter();
    this.typewriterInterval = setInterval(() => {
      if (this.revealedChars >= this.fullSpeech.length) {
        this.finishSpeaking();
        return;
      }
      this.revealedChars++;
      this.renderSpeaking();
    }, 30);
  }

  private stopTypewriter(): void {
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
      this.typewriterInterval = null;
    }
  }

  private finishSpeaking(): void {
    this.stopTypewriter();
    this.revealedChars = this.fullSpeech.length;
    this.renderSpeaking();
    const resolve = this.speakResolve;
    this.speakResolve = null;
    resolve?.();
  }

  private handleSpeakingKey(): void {
    // Any key skips to full text
    this.finishSpeaking();
  }

  private renderSpeaking(): void {
    const revealed = this.fullSpeech.slice(0, this.revealedChars);
    this.textContent.content = `  "${revealed}"`;
    this.renderer.requestRender();
  }

  // ── Options State ────────────────────────────────────────

  private handleOptionsKey(key: KeyEvent): void {
    switch (key.name) {
      case "up": case "k":
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.renderOptions();
        break;

      case "down": case "j":
        // +1 for the freeform slot
        this.selectedIndex = Math.min(this.currentOptions.length, this.selectedIndex + 1);
        this.renderOptions();
        break;

      case "1": case "2": case "3": case "4": {
        const idx = parseInt(key.name) - 1;
        if (idx >= 0 && idx < this.currentOptions.length) {
          this.resolveOption({ type: "option", index: idx });
        }
        break;
      }

      case "return":
        if (this.selectedIndex < this.currentOptions.length) {
          this.resolveOption({ type: "option", index: this.selectedIndex });
        } else {
          // Freeform slot selected
          this.enterFreeform();
        }
        break;

      case "tab":
        this.enterFreeform();
        break;

      case "escape":
        this.resolveOption({ type: "escape" });
        break;
    }
  }

  private renderOptions(): void {
    const lines: string[] = [];
    lines.push(`  "${this.fullSpeech}"`);
    lines.push("");

    for (let i = 0; i < this.currentOptions.length; i++) {
      const opt = this.currentOptions[i]!;
      const marker = this.selectedIndex === i ? "▸" : " ";
      const prefix = opt.type === "action" ? "*" : "";
      const suffix = opt.type === "action" ? "*" : "";
      const toneHint = ` (${opt.tone})`;
      lines.push(`  ${marker} [${i + 1}] ${prefix}${opt.text}${suffix}${toneHint}`);
    }

    // Freeform slot
    const freeMarker = this.selectedIndex === this.currentOptions.length ? "▸" : " ";
    lines.push(`  ${freeMarker} [>] Type your own response...`);

    this.textContent.content = lines.join("\n");
    this.renderer.requestRender();
  }

  private resolveOption(selection: DialogueSelection): void {
    const resolve = this.optionResolve;
    this.optionResolve = null;
    this.state = "idle";
    resolve?.(selection);
  }

  // ── Freeform State ───────────────────────────────────────

  private enterFreeform(): void {
    this.state = "freeform";

    // Show the speech text above the input
    this.textContent.content = `  "${this.fullSpeech}"\n`;

    // Create InputRenderable for freeform text entry
    this.freeformInput = new InputRenderable(this.renderer, {
      placeholder: "Type your response...",
      textColor: "#c0caf5",
      backgroundColor: "#0a0a1a",
      focusedTextColor: "#c0caf5",
      focusedBackgroundColor: "#0a0a1a",
      placeholderColor: "#414868",
    });

    // Wire enter to submit
    this.freeformInput.on("enter", () => {
      const text = this.freeformInput?.value.trim() ?? "";
      if (text.length > 0) {
        this.cleanupFreeformInput();
        this.resolveOption({ type: "freeform", text });
      }
    });

    // Wire escape to go back to options
    this.freeformInput.onKeyDown = (key) => {
      if (key.name === "escape") {
        this.cleanupFreeformInput();
        this.state = "options";
        this.renderOptions();
      }
    };

    // Create hint text
    this.freeformHintText = new TextRenderable(this.renderer, {
      id: "dialogue-freeform-hint",
      content: "\n  [Enter] Send  [Escape] Back to options",
      fg: "#414868",
    });

    // Add input and hint to the container
    this.container.add(this.freeformInput);
    this.container.add(this.freeformHintText);
    this.freeformInput.focus();
    this.renderer.requestRender();
  }

  private cleanupFreeformInput(): void {
    if (this.freeformInput) {
      this.freeformInput.blur();
      this.container.remove(this.freeformInput.id);
      this.freeformInput = null;
    }
    if (this.freeformHintText) {
      this.container.remove("dialogue-freeform-hint");
      this.freeformHintText = null;
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  private updateTitle(): void {
    const emotionTag = this.emotion ? ` (${this.emotion})` : "";
    this.container.title = ` ${this.speakerName}${emotionTag} `;
    this.renderer.requestRender();
  }
}
