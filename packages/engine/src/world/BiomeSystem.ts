import type { BiomeConfig, BiomePalette } from "../types.ts";

export function createBiomeConfig(
  type: string,
  palette: BiomePalette,
  overrides?: Partial<BiomeConfig>,
): BiomeConfig {
  return {
    type,
    terrain: {
      primary: "grass",
      secondary: "dirt",
      features: [],
    },
    palette,
    density: {
      vegetation: 0.5,
      structures: 0.2,
      characters: 0.1,
    },
    ambient: {
      lighting: "natural",
    },
    ...overrides,
  };
}

export function blendPalettes(
  a: BiomePalette,
  b: BiomePalette,
  t: number,
): BiomePalette {
  // Simple blend: pick from A or B based on threshold
  // Full color interpolation would happen at render time
  return t < 0.5 ? a : b;
}
