import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
} from "@opentui/core";

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useAlternateScreen: true,
  });

  // Outer container — centers content
  const container = new BoxRenderable(renderer, {
    id: "container",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 1,
  });

  // Title box
  const titleBox = new BoxRenderable(renderer, {
    id: "title-box",
    border: true,
    borderStyle: "double",
    borderColor: "#c9a959",
    paddingX: 4,
    paddingY: 1,
  });

  const title = new TextRenderable(renderer, {
    id: "title",
    content: "✦  D A Y D R E A M  ✦",
  });

  const subtitle = new TextRenderable(renderer, {
    id: "subtitle",
    content: "every world begins with a prompt",
  });

  titleBox.add(title);
  container.add(titleBox);
  container.add(subtitle);
  renderer.root.add(container);

  renderer.auto();
}

main().catch(console.error);
