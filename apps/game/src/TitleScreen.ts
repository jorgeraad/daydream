import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
} from "@opentui/core";
import { GameInput } from "@daydream/renderer";

const TITLE_ART = `
     ╔═══════════════════════════════╗
     ║         D A Y D R E A M       ║
     ╚═══════════════════════════════╝
`;

const SUBTITLE = "AI-generated worlds from your imagination";
const PROMPT_LABEL = "Where would you like to go?";
const HINT = "Type your world prompt and press Enter\n[Esc] Settings";

export type TitleScreenResult =
  | { type: "prompt"; value: string }
  | { type: "settings" };

export class TitleScreen {
  private container: BoxRenderable;
  private input: GameInput;
  private resolve: ((value: TitleScreenResult) => void) | null = null;

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
        this.resolve?.({ type: "settings" });
        this.resolve = null;
      },
    });
    this.container.add(this.input.container);

    // Hint
    const hint = new TextRenderable(renderer, {
      id: "hint",
      content: `\n${HINT}`,
      fg: "#414868",
    });
    this.container.add(hint);
  }

  /** Show the title screen and wait for the user to enter a prompt or open settings. */
  async show(): Promise<TitleScreenResult> {
    this.input.value = "";
    this.renderer.root.add(this.container);

    this.input.focus();
    this.renderer.requestRender();

    return new Promise<TitleScreenResult>((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Remove the title screen from the renderer. */
  destroy(): void {
    this.input.destroy();
    this.renderer.root.remove("title-screen");
  }
}
