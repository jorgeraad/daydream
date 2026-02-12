import { BoxRenderable, TextRenderable, type CliRenderer } from "@opentui/core";

export interface ContextPanelData {
  location: string;
  timeOfDay: string;
  nearbyNPCs: string[];
}

export class ContextPanel {
  readonly container: BoxRenderable;
  private locationText: TextRenderable;
  private timeText: TextRenderable;
  private npcsText: TextRenderable;

  constructor(renderer: CliRenderer) {
    this.container = new BoxRenderable(renderer, {
      id: "context-panel",
      flexGrow: 1,
      flexDirection: "column",
      border: true,
      borderStyle: "single",
      borderColor: "#555555",
      title: " Context ",
      paddingX: 1,
    });

    this.locationText = new TextRenderable(renderer, {
      id: "ctx-location",
      content: "Unknown",
    });

    this.timeText = new TextRenderable(renderer, {
      id: "ctx-time",
      content: "",
    });

    this.npcsText = new TextRenderable(renderer, {
      id: "ctx-npcs",
      content: "No one nearby",
    });

    this.container.add(this.locationText);
    this.container.add(this.timeText);
    this.container.add(this.npcsText);
  }

  update(data: Partial<ContextPanelData>): void {
    if (data.location !== undefined) {
      this.locationText.content = data.location;
    }
    if (data.timeOfDay !== undefined) {
      this.timeText.content = data.timeOfDay;
    }
    if (data.nearbyNPCs !== undefined) {
      this.npcsText.content =
        data.nearbyNPCs.length > 0
          ? "Nearby:\n" + data.nearbyNPCs.map((n) => `  ${n}`).join("\n")
          : "No one nearby";
    }
  }
}
