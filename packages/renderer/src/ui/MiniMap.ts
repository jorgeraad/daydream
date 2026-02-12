import {
  BoxRenderable,
  FrameBufferRenderable,
  RGBA,
  type CliRenderer,
} from "@opentui/core";

export class MiniMap {
  readonly container: BoxRenderable;
  readonly buffer: FrameBufferRenderable;

  constructor(renderer: CliRenderer) {
    this.container = new BoxRenderable(renderer, {
      id: "minimap-container",
      height: 10,
      border: true,
      borderStyle: "single",
      borderColor: "#555555",
      title: " Map ",
    });

    this.buffer = new FrameBufferRenderable(renderer, {
      id: "minimap-fb",
      width: 16,
      height: 8,
    });

    this.buffer.frameBuffer.clear(RGBA.fromHex("#1a1a2e"));

    this.container.add(this.buffer);
  }
}
