import type { CharacterVisual } from "@daydream/engine";

/**
 * Pre-seeded character visual presets.
 * Each preset defines display glyph, colors, facing variants, idle animation, and nameplate.
 * AI-generated characters can reference these by key or define custom visuals.
 */
export const characterPresets: Record<string, CharacterVisual> = {
  villager: {
    display: { char: "☺", fg: "#deb887" },
    facing: { up: "△", down: "▽", left: "◁", right: "▷" },
    idleAnimation: ["☺", "☻"],
    nameplate: "Villager",
  },
  guard: {
    display: { char: "♜", fg: "#c0c0c0", bold: true },
    facing: { up: "♜", down: "♜", left: "♞", right: "♞" },
    nameplate: "Guard",
  },
  merchant: {
    display: { char: "$", fg: "#c9a959", bold: true },
    idleAnimation: ["$", "¤"],
    nameplate: "Merchant",
  },
  child: {
    display: { char: "○", fg: "#ffb6c1" },
    facing: { up: "△", down: "▽", left: "◁", right: "▷" },
    idleAnimation: ["○", "◦"],
    nameplate: "Child",
  },
  elder: {
    display: { char: "Ω", fg: "#d4d4d4" },
    nameplate: "Elder",
  },
  innkeeper: {
    display: { char: "☺", fg: "#cd853f", bold: true },
    idleAnimation: ["☺", "☻"],
    nameplate: "Innkeeper",
  },
  blacksmith: {
    display: { char: "♦", fg: "#b87333", bold: true },
    idleAnimation: ["♦", "◆"],
    nameplate: "Blacksmith",
  },
  animal_dog: {
    display: { char: "d", fg: "#8b4513" },
    facing: { up: "d", down: "d", left: "d", right: "d" },
    idleAnimation: ["d", "ɗ"],
    nameplate: "Dog",
  },
  animal_cat: {
    display: { char: "c", fg: "#daa520" },
    idleAnimation: ["c", "ɔ"],
    nameplate: "Cat",
  },
  monster: {
    display: { char: "M", fg: "#ff0000", bold: true },
    nameplate: "???",
  },
};
