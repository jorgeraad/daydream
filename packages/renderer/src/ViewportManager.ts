export class ViewportManager {
  cameraX = 0;
  cameraY = 0;

  constructor(
    public viewWidth: number,
    public viewHeight: number,
  ) {}

  updateCamera(
    playerX: number,
    playerY: number,
    zoneWidth: number,
    zoneHeight: number,
  ): void {
    // Center camera on player
    let cx = playerX - Math.floor(this.viewWidth / 2);
    let cy = playerY - Math.floor(this.viewHeight / 2);

    // Clamp to zone boundaries
    cx = Math.max(0, Math.min(cx, zoneWidth - this.viewWidth));
    cy = Math.max(0, Math.min(cy, zoneHeight - this.viewHeight));

    this.cameraX = cx;
    this.cameraY = cy;
  }

  resize(viewWidth: number, viewHeight: number): void {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } | null {
    const sx = worldX - this.cameraX;
    const sy = worldY - this.cameraY;
    if (sx < 0 || sx >= this.viewWidth || sy < 0 || sy >= this.viewHeight) {
      return null;
    }
    return { x: sx, y: sy };
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX + this.cameraX,
      y: screenY + this.cameraY,
    };
  }
}
