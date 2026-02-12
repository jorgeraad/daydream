import type { ObjectGlyph } from "../types.ts";

export const objectGlyphs: Record<string, ObjectGlyph> = {
  // Trees
  tree_pine: { char: "▲", fg: "#1a6b1a", bold: true, collision: true },
  tree_oak: { char: "♣", fg: "#228b22", bold: true, collision: true },
  tree_dead: { char: "†", fg: "#7a6840", collision: true },
  tree_trunk: { char: "│", fg: "#5c3a1e", collision: true },

  // Rocks
  rock_large: { char: "●", fg: "#6a6a6a", bold: true, collision: true },
  rock_small: { char: "○", fg: "#8a8a8a", collision: false },
  boulder: { char: "◆", fg: "#5a5a5a", bold: true, collision: true },

  // Furniture
  chair: { char: "╥", fg: "#8b6914", collision: true },
  table: { char: "╦", fg: "#7a5a14", collision: true },
  bed: { char: "▬", fg: "#b8a070", collision: true },

  // Signs & markers
  sign: { char: "┬", fg: "#8b7355", collision: false },
  post: { char: "│", fg: "#8b7355", collision: true },

  // Items
  chest: { char: "■", fg: "#c9a959", bold: true, collision: true },
  pot: { char: "◗", fg: "#8b4513", collision: true },
  barrel: { char: "◎", fg: "#6a4a20", collision: true },
};
