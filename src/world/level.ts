// Level helpers: tile lookups and collision for the player and enemies.
import { MAP_H, MAP_W, SOLID, idx, type MapData, TT } from './map';

export function tileAt(map: MapData, tx: number, ty: number): TT {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return TT.Tree;
  return map.type[idx(tx, ty)] as TT;
}

/** True when the point (in tile units) lies in a solid tile. */
export function solidAt(map: MapData, x: number, y: number): boolean {
  return SOLID.has(tileAt(map, Math.floor(x), Math.floor(y)));
}

/** Collision for a circle of radius r at (x,y): samples its bounding square corners. */
export function blocked(map: MapData, x: number, y: number, r: number): boolean {
  return (
    solidAt(map, x - r, y - r) ||
    solidAt(map, x + r, y - r) ||
    solidAt(map, x - r, y + r) ||
    solidAt(map, x + r, y + r)
  );
}

/** Iso projection: tile coordinates → screen-space (art pixel) coordinates. */
export function iso(x: number, y: number): [number, number] {
  return [(x - y) * 16, (x + y) * 8 + 8];
}
