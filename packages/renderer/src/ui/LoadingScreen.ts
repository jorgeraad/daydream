import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
} from "@opentui/core";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class LoadingScreen {
  private container: BoxRenderable;
  private statusText: TextRenderable;
  private spinnerText: TextRenderable;
  private spinnerFrame = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private renderer: CliRenderer) {
    this.container = new BoxRenderable(renderer, {
      id: "loading-screen",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0a0a1a",
    });

    this.spinnerText = new TextRenderable(renderer, {
      id: "loading-spinner",
      content: SPINNER_FRAMES[0]!,
      fg: "#7aa2f7",
    });
    this.container.add(this.spinnerText);

    this.statusText = new TextRenderable(renderer, {
      id: "loading-status",
      content: "\nGenerating world...",
      fg: "#c0caf5",
    });
    this.container.add(this.statusText);
  }

  show(): void {
    this.renderer.root.add(this.container);
    this.startSpinner();
    this.renderer.requestRender();
  }

  setStatus(status: string): void {
    this.statusText.content = `\n${status}`;
    this.renderer.requestRender();
  }

  destroy(): void {
    this.stopSpinner();
    this.renderer.root.remove("loading-screen");
  }

  private startSpinner(): void {
    this.interval = setInterval(() => {
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER_FRAMES.length;
      this.spinnerText.content = SPINNER_FRAMES[this.spinnerFrame]!;
      this.renderer.requestRender();
    }, 80);
  }

  private stopSpinner(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
