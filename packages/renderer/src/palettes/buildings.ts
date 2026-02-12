import type { BuildingTemplate } from "../types.ts";

export const houseTpl: BuildingTemplate = {
  border: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
  door: "╤",
  window: "▪",
  roof: "▲",
  fill: " ",
  defaultFg: "#c4a882",
  doorFg: "#3d2b1f",
  roofFg: "#7a6840",
};

export const shopTpl: BuildingTemplate = {
  border: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
  door: "╤",
  window: "□",
  roof: "▲",
  fill: " ",
  defaultFg: "#b8a070",
  doorFg: "#5a4020",
  roofFg: "#6a5830",
};

export const tavernTpl: BuildingTemplate = {
  border: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
  door: "╤",
  window: "▪",
  roof: "▲",
  fill: " ",
  defaultFg: "#8b6914",
  doorFg: "#4a3010",
  roofFg: "#5a4820",
};

export const wellTpl: BuildingTemplate = {
  border: { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" },
  door: "○",
  window: "~",
  roof: "┬",
  fill: "≈",
  defaultFg: "#6a6a6a",
  doorFg: "#4a8bc7",
  roofFg: "#5a5a5a",
};

export const wallTpl: BuildingTemplate = {
  border: { tl: "█", tr: "█", bl: "█", br: "█", h: "█", v: "█" },
  door: "▒",
  window: "▒",
  roof: "█",
  fill: "█",
  defaultFg: "#7a7a7a",
  doorFg: "#5a5a5a",
  roofFg: "#8a8a8a",
};

export const buildingTemplates: Record<string, BuildingTemplate> = {
  house: houseTpl,
  shop: shopTpl,
  tavern: tavernTpl,
  well: wellTpl,
  wall: wallTpl,
};
