import {
  createCliRenderer,
  FrameBufferRenderable,
  RGBA,
} from "@opentui/core";
import {
  TileRenderer,
  ViewportManager,
  isCollision,
  forestPalette,
} from "@daydream/renderer";
import type { ZoneData, TileCell, TileLayer } from "@daydream/renderer";

// --- Test zone builder ---

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function buildTestZone(): ZoneData {
  const W = 80;
  const H = 40;
  const palette = forestPalette;

  // Initialize layers
  const ground: TileCell[] = new Array(W * H);
  const objects: TileCell[] = new Array(W * H);
  const collision: TileCell[] = new Array(W * H);
  const empty: TileCell = { char: "", fg: "#000000" };
  const passable: TileCell = { char: "0", fg: "#000000" };
  const blocked: TileCell = { char: "1", fg: "#000000" };

  for (let i = 0; i < W * H; i++) {
    // Ground: random ground tile
    ground[i] = {
      char: randomPick(palette.ground.chars),
      fg: randomPick(palette.ground.fg),
      bg: palette.ground.bg,
    };
    objects[i] = empty;
    collision[i] = passable;
  }

  // --- Water: a pond in the center-left area ---
  for (let y = 15; y < 22; y++) {
    for (let x = 8; x < 20; x++) {
      // Oval-ish shape
      const cx = 14, cy = 18.5;
      const dx = (x - cx) / 6, dy = (y - cy) / 3.5;
      if (dx * dx + dy * dy < 1) {
        ground[y * W + x] = {
          char: randomPick(palette.water!.chars),
          fg: randomPick(palette.water!.fg),
          bg: palette.water!.bg,
        };
        collision[y * W + x] = blocked;
      }
    }
  }

  // --- Path: winding east-west through the zone ---
  let pathY = 10;
  for (let x = 0; x < W; x++) {
    // Gentle winding
    if (x % 7 === 0) pathY += Math.random() > 0.5 ? 1 : -1;
    pathY = Math.max(2, Math.min(H - 3, pathY));
    for (let dy = 0; dy < 2; dy++) {
      const y = pathY + dy;
      if (y >= 0 && y < H) {
        ground[y * W + x] = {
          char: randomPick(palette.path!.chars),
          fg: palette.path!.fg,
          bg: palette.path!.bg,
        };
      }
    }
  }

  // --- Trees: scattered throughout ---
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(Math.random() * W);
    const y = Math.floor(Math.random() * H);
    const idx = y * W + x;
    // Don't place on water or paths
    if (collision[idx]!.char === "1") continue;
    if (ground[idx]!.bg === palette.path!.bg) continue;

    const veg = Math.random() > 0.3 ? palette.vegetation["tree_canopy"] : palette.vegetation["bush"];
    if (!veg) continue;
    const char = veg.variants ? randomPick([veg.char, ...veg.variants]) : veg.char;

    objects[idx] = { char, fg: veg.fg, bold: true };
    collision[idx] = blocked;
  }

  // --- Flowers: decorative, non-blocking ---
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(Math.random() * W);
    const y = Math.floor(Math.random() * H);
    const idx = y * W + x;
    if (collision[idx]!.char === "1") continue;
    if (ground[idx]!.bg === palette.path!.bg) continue;

    const flower = palette.vegetation.flower;
    if (!flower) continue;
    const char = flower.variants ? randomPick([flower.char, ...flower.variants]) : flower.char;
    objects[idx] = { char, fg: flower.fg };
    // Flowers don't block
  }

  // --- Simple building (house) near center ---
  const bx = 35, by = 20, bw = 8, bh = 5;
  for (let y = by; y < by + bh; y++) {
    for (let x = bx; x < bx + bw; x++) {
      const idx = y * W + x;
      if (y === by || y === by + bh - 1) {
        // Top/bottom walls
        if (x === bx) objects[idx] = { char: "╔", fg: "#c4a882" };
        else if (x === bx + bw - 1) objects[idx] = { char: y === by ? "╗" : "╝", fg: "#c4a882" };
        else if (y === by) objects[idx] = { char: "═", fg: "#c4a882" };
        else objects[idx] = { char: "═", fg: "#c4a882" };
        if (y === by && x === bx) objects[idx] = { char: "╔", fg: "#c4a882" };
        if (y === by + bh - 1 && x === bx) objects[idx] = { char: "╚", fg: "#c4a882" };
        if (y === by + bh - 1 && x === bx + bw - 1) objects[idx] = { char: "╝", fg: "#c4a882" };
      } else {
        // Side walls or interior
        if (x === bx || x === bx + bw - 1) {
          objects[idx] = { char: "║", fg: "#c4a882" };
        } else {
          // Interior - clear
          ground[idx] = { char: " ", fg: "#4a3a28", bg: "#3a2a18" };
        }
      }
      collision[idx] = blocked;
    }
  }
  // Door at bottom center
  const doorX = bx + Math.floor(bw / 2);
  const doorIdx = (by + bh - 1) * W + doorX;
  objects[doorIdx] = { char: "╤", fg: "#3d2b1f" };
  collision[doorIdx] = passable; // door is passable

  // --- Rocks scattered on east side ---
  for (let i = 0; i < 15; i++) {
    const x = 55 + Math.floor(Math.random() * 20);
    const y = Math.floor(Math.random() * H);
    const idx = y * W + x;
    if (collision[idx]!.char === "1") continue;
    objects[idx] = { char: randomPick(["●", "○", "◆"]), fg: "#6a6a6a", bold: true };
    collision[idx] = blocked;
  }

  // Ensure player start position (5, 10) is clear
  const startIdx = 10 * W + 5;
  objects[startIdx] = empty;
  collision[startIdx] = passable;

  const layers: TileLayer[] = [
    { name: "ground", data: ground, width: W, height: H },
    { name: "objects", data: objects, width: W, height: H },
    { name: "collision", data: collision, width: W, height: H },
  ];

  return { id: "test_zone", width: W, height: H, layers };
}

// --- Main ---

async function main() {
  const zone = buildTestZone();

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useAlternateScreen: true,
    targetFps: 15,
    maxFps: 30,
  });

  // Use terminal size for viewport
  const viewW = renderer.terminalWidth;
  const viewH = renderer.terminalHeight;

  const viewport = new ViewportManager(viewW, viewH);

  let playerX = 5;
  let playerY = 10;

  const fb = new FrameBufferRenderable(renderer, {
    id: "viewport",
    width: viewW,
    height: viewH,
    onKeyDown(key) {
      let dx = 0, dy = 0;

      switch (key.name) {
        // Arrow keys
        case "ArrowUp": dy = -1; break;
        case "ArrowDown": dy = 1; break;
        case "ArrowLeft": dx = -1; break;
        case "ArrowRight": dx = 1; break;
        // WASD
        case "w": dy = -1; break;
        case "s": dy = 1; break;
        case "a": dx = -1; break;
        case "d": dx = 1; break;
        // vim: hjkl
        case "h": dx = -1; break;
        case "j": dy = 1; break;
        case "k": dy = -1; break;
        case "l": dx = 1; break;
        // Quit
        case "q": renderer.destroy(); process.exit(0);
      }

      if (dx === 0 && dy === 0) return;

      const nx = playerX + dx;
      const ny = playerY + dy;

      if (!isCollision(zone, nx, ny)) {
        playerX = nx;
        playerY = ny;
        viewport.updateCamera(playerX, playerY, zone.width, zone.height);
        tileRenderer.renderZone(zone, viewport, playerX, playerY);
        renderer.requestRender();
      }
    },
  });

  fb.focusable = true;
  fb.focus();

  const tileRenderer = new TileRenderer(fb.frameBuffer);

  renderer.root.add(fb);

  // Initial render
  viewport.updateCamera(playerX, playerY, zone.width, zone.height);
  tileRenderer.renderZone(zone, viewport, playerX, playerY);

  renderer.auto();
}

main().catch(console.error);
