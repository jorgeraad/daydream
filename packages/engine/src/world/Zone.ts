import type { Point, TileCell, TileLayer, Zone, ZoneId } from "../types.ts";

export function zoneId(x: number, y: number): ZoneId {
  return `zone_${x}_${y}`;
}

export function parseZoneCoords(id: ZoneId): Point | null {
  const match = id.match(/^zone_(-?\d+)_(-?\d+)$/);
  if (!match) return null;
  return { x: parseInt(match[1]!, 10), y: parseInt(match[2]!, 10) };
}

export function getTileAt(
  layer: TileLayer,
  x: number,
  y: number,
): TileCell | undefined {
  if (x < 0 || x >= layer.width || y < 0 || y >= layer.height) return undefined;
  return layer.data[y * layer.width + x];
}

export function getLayer(
  zone: Zone,
  name: string,
): TileLayer | undefined {
  return zone.tiles.find((l) => l.name === name);
}

export function isPassable(zone: Zone, x: number, y: number): boolean {
  const collision = getLayer(zone, "collision");
  if (!collision) return true;
  const cell = getTileAt(collision, x, y);
  if (!cell) return false;
  return cell.char === "0" || cell.char === "";
}

export function adjacentZoneIds(coords: Point): Record<string, ZoneId> {
  return {
    up: zoneId(coords.x, coords.y - 1),
    down: zoneId(coords.x, coords.y + 1),
    left: zoneId(coords.x - 1, coords.y),
    right: zoneId(coords.x + 1, coords.y),
  };
}
