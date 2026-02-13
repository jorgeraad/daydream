import { describe, test, expect } from "bun:test";
import {
  forestGround,
  desertGround,
  townGround,
  waterTexture,
  pathTexture,
  biomeGroundTextures,
  resolveGroundTexture,
  type GroundTexture,
} from "../../palettes/ground-textures.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate that a string is a valid hex color (#rrggbb or #rgb format) */
function isValidHexColor(s: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(s);
}

/** Sample a texture at many coordinates and return [topColor, bottomColor] pairs */
function sampleTexture(texture: GroundTexture, count: number = 50): [string, string][] {
  const results: [string, string][] = [];
  for (let i = 0; i < count; i++) {
    const x = (i * 7 + 3) % 100; // spread across coordinates
    const y = (i * 13 + 11) % 100;
    results.push(texture.pattern(x, y));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Determinism tests — same input always gives same output
// ---------------------------------------------------------------------------

describe("ground textures — determinism", () => {
  const textures: [string, GroundTexture][] = [
    ["forest", forestGround],
    ["desert", desertGround],
    ["town", townGround],
    ["water", waterTexture],
    ["path", pathTexture],
  ];

  for (const [name, texture] of textures) {
    test(`${name} texture is deterministic`, () => {
      // Call the same coordinates twice — must produce identical output
      for (let x = 0; x < 20; x++) {
        for (let y = 0; y < 20; y++) {
          const [top1, bot1] = texture.pattern(x, y);
          const [top2, bot2] = texture.pattern(x, y);
          expect(top1).toBe(top2);
          expect(bot1).toBe(bot2);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Valid hex color output tests
// ---------------------------------------------------------------------------

describe("ground textures — valid hex colors", () => {
  const textures: [string, GroundTexture][] = [
    ["forest", forestGround],
    ["desert", desertGround],
    ["town", townGround],
    ["water", waterTexture],
    ["path", pathTexture],
  ];

  for (const [name, texture] of textures) {
    test(`${name} texture produces valid hex colors`, () => {
      const samples = sampleTexture(texture, 100);
      for (const [top, bot] of samples) {
        expect(isValidHexColor(top)).toBe(true);
        expect(isValidHexColor(bot)).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Individual texture behavior tests
// ---------------------------------------------------------------------------

describe("forestGround", () => {
  test("primary and secondary color pools are non-empty", () => {
    expect(forestGround.primary.length).toBeGreaterThan(0);
    expect(forestGround.secondary.length).toBeGreaterThan(0);
  });

  test("produces colors from its color pools", () => {
    const allColors = new Set([...forestGround.primary, ...forestGround.secondary, "#0f260e"]);
    const samples = sampleTexture(forestGround, 200);
    for (const [top, bot] of samples) {
      expect(allColors.has(top)).toBe(true);
      expect(allColors.has(bot)).toBe(true);
    }
  });
});

describe("desertGround", () => {
  test("produces colors from its color pools", () => {
    const allColors = new Set([...desertGround.primary, ...desertGround.secondary, "#7a6428"]);
    const samples = sampleTexture(desertGround, 200);
    for (const [top, bot] of samples) {
      expect(allColors.has(top)).toBe(true);
      expect(allColors.has(bot)).toBe(true);
    }
  });
});

describe("townGround", () => {
  test("produces colors from its color pools", () => {
    const allColors = new Set([...townGround.primary, ...townGround.secondary, "#3a3a30"]);
    const samples = sampleTexture(townGround, 200);
    for (const [top, bot] of samples) {
      expect(allColors.has(top)).toBe(true);
      expect(allColors.has(bot)).toBe(true);
    }
  });
});

describe("waterTexture", () => {
  test("produces colors from its color pools", () => {
    const allColors = new Set([...waterTexture.primary, ...waterTexture.secondary, "#7ab8e8"]);
    const samples = sampleTexture(waterTexture, 200);
    for (const [top, bot] of samples) {
      expect(allColors.has(top)).toBe(true);
      expect(allColors.has(bot)).toBe(true);
    }
  });
});

describe("pathTexture", () => {
  test("produces colors from its color pools", () => {
    const allColors = new Set([...pathTexture.primary, ...pathTexture.secondary]);
    const samples = sampleTexture(pathTexture, 200);
    for (const [top, bot] of samples) {
      expect(allColors.has(top)).toBe(true);
      expect(allColors.has(bot)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// biomeGroundTextures mapping tests
// ---------------------------------------------------------------------------

describe("biomeGroundTextures", () => {
  test("maps forest to forestGround", () => {
    expect(biomeGroundTextures["forest"]).toBe(forestGround);
  });

  test("maps desert to desertGround", () => {
    expect(biomeGroundTextures["desert"]).toBe(desertGround);
  });

  test("maps town to townGround", () => {
    expect(biomeGroundTextures["town"]).toBe(townGround);
  });
});

// ---------------------------------------------------------------------------
// resolveGroundTexture tests
// ---------------------------------------------------------------------------

describe("resolveGroundTexture", () => {
  test("returns waterTexture for water characters", () => {
    expect(resolveGroundTexture({ char: "~", fg: "#fff" }, "forest")).toBe(waterTexture);
    expect(resolveGroundTexture({ char: "\u2248", fg: "#fff" }, "forest")).toBe(waterTexture); // ≈
    expect(resolveGroundTexture({ char: "\u223C", fg: "#fff" }, "forest")).toBe(waterTexture); // ∼
  });

  test("returns pathTexture for path characters", () => {
    expect(resolveGroundTexture({ char: "\u2591", fg: "#fff" }, "forest")).toBe(pathTexture); // ░
    expect(resolveGroundTexture({ char: "\u2593", fg: "#fff" }, "forest")).toBe(pathTexture); // ▓
    expect(resolveGroundTexture({ char: "\u2592", fg: "#fff" }, "forest")).toBe(pathTexture); // ▒
  });

  test("returns biome texture for normal ground characters", () => {
    expect(resolveGroundTexture({ char: ".", fg: "#fff" }, "forest")).toBe(forestGround);
    expect(resolveGroundTexture({ char: ".", fg: "#fff" }, "desert")).toBe(desertGround);
    expect(resolveGroundTexture({ char: ",", fg: "#fff" }, "town")).toBe(townGround);
  });

  test("falls back to forestGround for unknown biome", () => {
    expect(resolveGroundTexture({ char: ".", fg: "#fff" }, "volcano")).toBe(forestGround);
    expect(resolveGroundTexture({ char: ".", fg: "#fff" }, "")).toBe(forestGround);
    expect(resolveGroundTexture({ char: ".", fg: "#fff" }, "unknown")).toBe(forestGround);
  });

  test("water chars take priority over biome", () => {
    // Even in "desert" biome, water char still returns waterTexture
    expect(resolveGroundTexture({ char: "~", fg: "#fff" }, "desert")).toBe(waterTexture);
  });

  test("path chars take priority over biome", () => {
    // Even in "forest" biome, path char still returns pathTexture
    expect(resolveGroundTexture({ char: "\u2591", fg: "#fff" }, "forest")).toBe(pathTexture);
  });
});
