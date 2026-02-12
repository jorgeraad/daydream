// Renderer-specific types for tile rendering, palettes, and viewport

export interface TileCell {
  char: string;
  fg: string; // hex color
  bg?: string; // hex color
  bold?: boolean;
  dim?: boolean;
  animated?: boolean;
  animFrames?: string[];
}

export interface TileLayer {
  name: "ground" | "objects" | "overlay" | "collision";
  data: TileCell[];
  width: number;
  height: number;
}

export interface ZoneData {
  id: string;
  width: number;
  height: number;
  layers: TileLayer[];
}

export interface BiomePalette {
  ground: {
    chars: string[];
    fg: string[];
    bg: string;
  };
  vegetation: Record<
    string,
    {
      char: string;
      fg: string;
      variants?: string[];
    }
  >;
  water?: {
    chars: string[];
    fg: string[];
    bg: string;
    animated: boolean;
  };
  path?: {
    chars: string[];
    fg: string;
    bg: string;
  };
}

export interface BuildingTemplate {
  border: { tl: string; tr: string; bl: string; br: string; h: string; v: string };
  door: string;
  window: string;
  roof: string;
  fill: string;
  defaultFg: string;
  doorFg: string;
  roofFg: string;
}

export interface ObjectGlyph {
  char: string;
  fg: string;
  bg?: string;
  bold?: boolean;
  collision: boolean;
}
