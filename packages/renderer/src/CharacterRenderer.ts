import { RGBA, TextAttributes } from "@opentui/core";
import type { Character, Point } from "@daydream/engine";
import type { ViewportManager } from "./ViewportManager.ts";

/**
 * Renders characters on the FrameBuffer and provides proximity queries.
 *
 * Characters are drawn after tile layers but before the player,
 * using their CharacterVisual.display for glyph/color and optional
 * facing direction overrides.
 */
export class CharacterRenderer {
  private buffer: import("@opentui/core").OptimizedBuffer;

  constructor(buffer: import("@opentui/core").OptimizedBuffer) {
    this.buffer = buffer;
  }

  /**
   * Render all characters in the current zone onto the framebuffer.
   * Characters outside the viewport are skipped.
   */
  renderCharacters(
    characters: Character[],
    viewport: ViewportManager,
  ): void {
    for (const char of characters) {
      this.renderCharacter(char, viewport);
    }
  }

  private renderCharacter(character: Character, viewport: ViewportManager): void {
    const { position, facing } = character.state;
    const screenPos = viewport.worldToScreen(position.x, position.y);
    if (!screenPos) return;

    const visual = character.visual;
    // Use facing-specific char if available, otherwise default display char
    let glyph = visual.display.char;
    if (visual.facing && visual.facing[facing]) {
      glyph = visual.facing[facing]!;
    }

    const fg = RGBA.fromHex(visual.display.fg);
    const bg = visual.display.bg
      ? RGBA.fromHex(visual.display.bg)
      : RGBA.fromHex("#000000");
    let attrs = TextAttributes.NONE;
    if (visual.display.bold) attrs |= TextAttributes.BOLD;

    this.buffer.setCell(screenPos.x, screenPos.y, glyph, fg, bg, attrs);
  }

  /**
   * Render nameplates above characters that are near the player.
   * Nameplate appears one row above the character's screen position.
   */
  renderNameplates(
    characters: Character[],
    playerPos: Point,
    viewport: ViewportManager,
    proximityRadius: number = 3,
  ): void {
    const nearby = findNearbyCharacters(characters, playerPos, proximityRadius);
    for (const char of nearby) {
      this.renderNameplate(char, viewport);
    }
  }

  private renderNameplate(character: Character, viewport: ViewportManager): void {
    const { position } = character.state;
    const screenPos = viewport.worldToScreen(position.x, position.y);
    if (!screenPos) return;

    // Place nameplate one row above the character
    const nameY = screenPos.y - 1;
    if (nameY < 0) return;

    const name = character.visual.nameplate;
    const startX = screenPos.x - Math.floor(name.length / 2);
    const fg = RGBA.fromHex("#ffffff");
    const bg = RGBA.fromHex("#000000");

    for (let i = 0; i < name.length; i++) {
      const x = startX + i;
      if (x >= 0 && x < viewport.viewWidth) {
        this.buffer.setCell(x, nameY, name[i]!, fg, bg, TextAttributes.DIM);
      }
    }
  }
}

/**
 * Find characters within a given radius of a position (Manhattan distance).
 */
export function findNearbyCharacters(
  characters: Character[],
  position: Point,
  radius: number,
): Character[] {
  return characters.filter((char) => {
    const dx = Math.abs(char.state.position.x - position.x);
    const dy = Math.abs(char.state.position.y - position.y);
    return dx + dy <= radius;
  });
}

/**
 * Find characters adjacent to a position (4-directional, distance = 1).
 */
export function findAdjacentCharacters(
  characters: Character[],
  position: Point,
): Character[] {
  return findNearbyCharacters(characters, position, 1).filter((char) => {
    // Exclude characters at the exact same position (distance 0)
    return !(
      char.state.position.x === position.x &&
      char.state.position.y === position.y
    );
  });
}

/**
 * Check if a character occupies a given position.
 */
export function isCharacterAt(
  characters: Character[],
  x: number,
  y: number,
): boolean {
  return characters.some(
    (char) => char.state.position.x === x && char.state.position.y === y,
  );
}
