import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
} from "@opentui/core";

const TITLE_ART = `
     ╔═══════════════════════════════╗
     ║         D A Y D R E A M       ║
     ╚═══════════════════════════════╝
`;

const SUBTITLE = "AI-generated worlds from your imagination";
const PROMPT_LABEL = "Where would you like to go?";
const HINT = "Type your world prompt and press Enter";

export class TitleScreen {
  private container: BoxRenderable;
  private inputText: TextRenderable;
  private buffer = "";
  private resolve: ((value: string) => void) | null = null;

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
      fg: "#7aa2f7",
    });
    this.container.add(titleText);

    // Subtitle
    const subtitle = new TextRenderable(renderer, {
      id: "subtitle",
      content: `\n${SUBTITLE}\n\n`,
      fg: "#565f89",
    });
    this.container.add(subtitle);

    // Prompt label
    const promptLabel = new TextRenderable(renderer, {
      id: "prompt-label",
      content: PROMPT_LABEL,
      fg: "#c0caf5",
    });
    this.container.add(promptLabel);

    // Input box
    const inputBox = new BoxRenderable(renderer, {
      id: "input-box",
      width: 60,
      height: 3,
      border: true,
      borderStyle: "rounded",
      borderColor: "#7aa2f7",
      paddingX: 1,
      justifyContent: "center",
    });

    this.inputText = new TextRenderable(renderer, {
      id: "input-text",
      content: "█",
      fg: "#c0caf5",
    });
    inputBox.add(this.inputText);
    this.container.add(inputBox);

    // Hint
    const hint = new TextRenderable(renderer, {
      id: "hint",
      content: `\n${HINT}`,
      fg: "#414868",
    });
    this.container.add(hint);
  }

  /** Show the title screen and wait for the user to enter a prompt. */
  async show(): Promise<string> {
    this.renderer.root.add(this.container);

    // Set up keyboard handler
    this.container.focusable = true;
    this.container.focus();
    this.container.onKeyDown = (key) => this.handleKey(key);

    this.renderer.requestRender();

    return new Promise<string>((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Remove the title screen from the renderer. */
  destroy(): void {
    this.renderer.root.remove("title-screen");
  }

  private handleKey(key: { name: string; char?: string; shift?: boolean }): void {
    if (key.name === "Return" || key.name === "Enter") {
      if (this.buffer.trim().length > 0) {
        this.resolve?.(this.buffer.trim());
        this.resolve = null;
      }
      return;
    }

    if (key.name === "Backspace" || key.name === "Delete") {
      this.buffer = this.buffer.slice(0, -1);
    } else if (key.char && key.char.length === 1 && key.name !== "Escape") {
      this.buffer += key.char;
    }

    this.inputText.content = this.buffer + "█";
    this.renderer.requestRender();
  }
}
