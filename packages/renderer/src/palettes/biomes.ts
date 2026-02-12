import type { BiomePalette } from "../types.ts";

export const forestPalette: BiomePalette = {
  ground: {
    chars: ["·", ".", ",", "'", "`"],
    fg: ["#2d5a27", "#3a7a33", "#1e4a1e", "#4a8a44"],
    bg: "#1a3318",
  },
  vegetation: {
    tree_trunk: { char: "│", fg: "#5c3a1e" },
    tree_canopy: { char: "♣", fg: "#228b22", variants: ["♠", "⌂"] },
    bush: { char: "※", fg: "#3a7a33" },
    flower: { char: "✿", fg: "#ff69b4", variants: ["❀", "✾"] },
    mushroom: { char: "♦", fg: "#ff4500" },
  },
  water: {
    chars: ["~", "≈", "∼"],
    fg: ["#4a8bc7", "#5a9bd7"],
    bg: "#1a3a5a",
    animated: true,
  },
  path: {
    chars: ["░", "·"],
    fg: "#8b7355",
    bg: "#5a4a35",
  },
};

export const desertPalette: BiomePalette = {
  ground: {
    chars: [".", "·", ":", "∙", " "],
    fg: ["#c2a645", "#b89b3a", "#d4b84f", "#a68c30"],
    bg: "#8b7332",
  },
  vegetation: {
    cactus: { char: "¥", fg: "#2d8b2d" },
    dead_tree: { char: "†", fg: "#7a6840" },
    tumbleweed: { char: "◎", fg: "#a68c30" },
    scrub: { char: "¤", fg: "#6b8a3a" },
  },
  path: {
    chars: ["·", "."],
    fg: "#bfa955",
    bg: "#9a833a",
  },
};

export const townPalette: BiomePalette = {
  ground: {
    chars: ["·", ".", " "],
    fg: ["#8b8b7a", "#7a7a6b", "#9a9a8a"],
    bg: "#4a4a3e",
  },
  vegetation: {
    tree_canopy: { char: "♣", fg: "#228b22" },
    hedge: { char: "▓", fg: "#2d6b2d" },
    flower_bed: { char: "✿", fg: "#ff69b4", variants: ["❀"] },
    grass_patch: { char: "░", fg: "#3a7a33" },
  },
  path: {
    chars: ["▓", "▒"],
    fg: "#9a8a6a",
    bg: "#6a5a3e",
  },
};

export const biomePalettes: Record<string, BiomePalette> = {
  forest: forestPalette,
  desert: desertPalette,
  town: townPalette,
};
