// @daydream/renderer — Terminal rendering via OpenTUI
// Tile rendering, UI components, palettes, animations

export type {
  TileCell,
  TileLayer,
  ZoneData,
  BiomePalette,
  BuildingTemplate,
  ObjectGlyph,
} from "./types.ts";

export { TileRenderer, isCollision } from "./TileRenderer.ts";
export { CharacterRenderer, findNearbyCharacters, findAdjacentCharacters, isCharacterAt } from "./CharacterRenderer.ts";
export { ViewportManager } from "./ViewportManager.ts";

export { forestPalette, desertPalette, townPalette, biomePalettes } from "./palettes/biomes.ts";
export { houseTpl, shopTpl, tavernTpl, wellTpl, wallTpl, buildingTemplates } from "./palettes/buildings.ts";
export { objectGlyphs } from "./palettes/objects.ts";
export { characterPresets } from "./palettes/characters.ts";

export { LoadingScreen } from "./ui/LoadingScreen.ts";
export { ContextPanel } from "./ui/ContextPanel.ts";
export type { ContextPanelData } from "./ui/ContextPanel.ts";
export { MiniMap } from "./ui/MiniMap.ts";
export { NarrativeBar } from "./ui/NarrativeBar.ts";
