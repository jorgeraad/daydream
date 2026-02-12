import {
  type CliRenderer,
  BoxRenderable,
  InputRenderable,
} from "@opentui/core";

const COLORS = {
  border: "#7aa2f7",
  borderFocused: "#7aa2f7",
  borderBlurred: "#565f89",
  inputBg: "#0a0a1a",
  text: "#c0caf5",
  placeholder: "#414868",
};

export interface GameInputConfig {
  /** Unique element ID */
  id: string;
  /** Width of the input box (including border). Default: 60 */
  width?: number;
  /** Placeholder text shown when empty */
  placeholder?: string;
  /** Maximum character length. Default: unlimited */
  maxLength?: number;
  /** Initial value */
  value?: string;
  /** Called when user presses Enter */
  onSubmit?: (value: string) => void;
  /** Called on every edit */
  onChange?: (value: string) => void;
  /** Called when user presses Escape */
  onCancel?: () => void;
}

export class GameInput {
  /** The outer BoxRenderable (border + padding). Add this to your layout. */
  readonly container: BoxRenderable;
  protected readonly input: InputRenderable;
  private renderer: CliRenderer;

  constructor(renderer: CliRenderer, config: GameInputConfig) {
    this.renderer = renderer;

    this.container = new BoxRenderable(renderer, {
      id: config.id,
      width: config.width ?? 60,
      height: 3,
      border: true,
      borderStyle: "rounded",
      borderColor: COLORS.borderBlurred,
      paddingX: 1,
      justifyContent: "center",
    });

    this.input = new InputRenderable(renderer, {
      value: config.value ?? "",
      placeholder: config.placeholder,
      maxLength: config.maxLength,
      backgroundColor: COLORS.inputBg,
      textColor: COLORS.text,
      focusedBackgroundColor: COLORS.inputBg,
      focusedTextColor: COLORS.text,
      placeholderColor: COLORS.placeholder,
    });

    this.container.add(this.input);

    // Wire onSubmit via "enter" event (InputRenderable.submit() emits "enter",
    // does not call super.submit() where onSubmit lives)
    if (config.onSubmit) {
      this.input.on("enter", () => config.onSubmit!(this.value));
    }

    // Wire onChange via onContentChange
    if (config.onChange) {
      this.input.onContentChange = () => config.onChange!(this.value);
    }

    // Wire Escape key via onKeyDown
    if (config.onCancel) {
      this.input.onKeyDown = (key) => {
        if (key.name === "escape") {
          config.onCancel!();
        }
      };
    }
  }

  /** Get the current text value */
  get value(): string {
    return this.input.value;
  }

  /** Set the text value programmatically */
  set value(text: string) {
    this.input.value = text;
  }

  /** Focus the input (activates cursor and key handling) */
  focus(): void {
    this.container.borderColor = COLORS.borderFocused;
    this.input.focus();
    this.renderer.requestRender();
  }

  /** Blur the input */
  blur(): void {
    this.container.borderColor = COLORS.borderBlurred;
    this.input.blur();
    this.renderer.requestRender();
  }

  /** Whether the input is currently focused */
  get focused(): boolean {
    return this.input.focused;
  }

  /** Clean up resources */
  destroy(): void {
    this.input.blur();
  }
}
