import {
  ScrollBoxRenderable,
  TextRenderable,
  type CliRenderer,
} from "@opentui/core";

export class NarrativeBar {
  readonly container: ScrollBoxRenderable;
  private textContent: TextRenderable;
  private lines: string[] = [];

  constructor(renderer: CliRenderer) {
    this.container = new ScrollBoxRenderable(renderer, {
      id: "narrative-bar",
      height: 8,
      border: true,
      borderStyle: "single",
      borderColor: "#555555",
      title: " Chronicle ",
      stickyScroll: true,
      stickyStart: "bottom",
      contentOptions: {
        paddingX: 1,
      },
    });

    this.textContent = new TextRenderable(renderer, {
      id: "narrative-text",
      content: "",
    });

    this.container.add(this.textContent);
  }

  addLine(text: string): void {
    this.lines.push(text);
    this.textContent.content = this.lines.join("\n");
  }

  clear(): void {
    this.lines = [];
    this.textContent.content = "";
  }
}
