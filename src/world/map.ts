// Deterministic map generation. Layout is authored with regions, then decorated with a seeded RNG.
export const MAP_W = 48;
export const MAP_H = 32;

export const enum TT {
  Grass = 0,
  Flower,
  TallGrass,
  Path,
  Floor, // cobbled plaza / interior floor
  Sand,
  Water,
  Field, // tilled farm rows
  Chasm,
  Bridge,
  Wall, // solid building block (variant selects colours)
  Tree,
  Rock,
  Fence,
  Ruin, // ancient stone floor
  Yard, // dirt training ground
}

/** Solid tiles block movement. */
export const SOLID = new Set<TT>([TT.Water, TT.Chasm, TT.Wall, TT.Tree, TT.Rock, TT.Fence]);

export interface Zone {
  id: 'village' | 'works' | 'farm' | 'wilds' | 'gorge' | 'ruins' | 'yard';
}

export interface MapData {
  type: Uint8Array;
  variant: Uint8Array;
  /** Tiles that become Bridge once the gorge bridge is repaired. */
  bridgeTiles: [number, number][];
}

export function idx(x: number, y: number): number {
  return y * MAP_W + x;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildMap(): MapData {
  const type = new Uint8Array(MAP_W * MAP_H);
  const variant = new Uint8Array(MAP_W * MAP_H);
  const rnd = mulberry32(20261016);
  const set = (x: number, y: number, t: TT, v = 0): void => {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
    type[idx(x, y)] = t;
    variant[idx(x, y)] = v;
  };
  const rect = (x: number, y: number, w: number, h: number, t: TT, v = 0): void => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, t, v);
  };
  const get = (x: number, y: number): TT => type[idx(x, y)] as TT;

  // 1. Base terrain
  rect(0, 0, MAP_W, MAP_H, TT.Grass);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const r = rnd();
      if (r < 0.05) set(x, y, TT.Flower, Math.floor(rnd() * 3));
      else if (r < 0.2) set(x, y, TT.TallGrass);
    }

  // 2. Forests (walkable clearings are left open)
  const forest = (x: number, y: number, w: number, h: number, p: number): void => {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) if (rnd() < p) set(xx, yy, TT.Tree, Math.floor(rnd() * 3));
  };
  forest(0, 20, 19, 12, 0.24);
  forest(0, 0, 20, 4, 0.2);
  forest(0, 17, 19, 3, 0.05);
  // Clear the south-west clearing and the road ends
  rect(6, 24, 6, 5, TT.Grass);

  // 3. River (x 20..21) with sand banks and a wooden bridge on the main road
  rect(19, 0, 1, MAP_H, TT.Sand);
  rect(20, 0, 2, MAP_H, TT.Water);
  rect(22, 0, 1, MAP_H, TT.Sand);
  rect(20, 18, 2, 2, TT.Bridge);

  // 4. Main road (east-west, y 18..19) and village road (north-south, x 27..28)
  rect(0, 18, MAP_W, 2, TT.Path);
  rect(27, 7, 2, MAP_H - 7, TT.Path);

  // 5. Village plaza
  rect(23, 14, 10, 9, TT.Floor);

  // 6. Buildings (solid blocks; their front tiles stay open)
  rect(23, 11, 4, 3, TT.Wall, 2); // Elder hall
  rect(29, 11, 4, 3, TT.Wall, 0); // Lab (Hal)
  rect(23, 23, 4, 3, TT.Wall, 1); // Kitchen (Lio)
  rect(29, 23, 4, 3, TT.Wall, 3); // Infirmary (Sanne)
  rect(24, 2, 8, 5, TT.Wall, 1); // Millrace Works
  rect(25, 7, 2, 1, TT.Path); // Works door

  // 7. Riverside fields
  rect(1, 5, 17, 1, TT.Water); // irrigation ditch
  rect(1, 7, 8, 9, TT.Field, 0);
  rect(10, 7, 8, 9, TT.Field, 1);
  rect(1, 2, 4, 3, TT.Wall, 2); // Brin's farmhouse
  rect(7, 2, 3, 2, TT.Fence); // garden fence stub
  for (let x = 1; x < 18; x++) if (x % 2 === 0) set(x, 16, TT.Fence);

  // 8. The Gorge: chasm, cliffs, and the broken bridge spanning y 18..19
  rect(33, 0, 1, MAP_H, TT.Rock, 1);
  rect(34, 0, 8, MAP_H, TT.Chasm);
  rect(42, 0, 1, MAP_H, TT.Rock, 1);
  rect(33, 18, 1, 2, TT.Path);
  rect(42, 18, 1, 2, TT.Path);
  const bridgeTiles: [number, number][] = [];
  for (let y = 18; y <= 19; y++) for (let x = 34; x <= 41; x++) bridgeTiles.push([x, y]);

  // 9. Lantern Ruins (north-east, beyond the gorge)
  rect(43, 0, 5, 17, TT.Ruin);
  rect(43, 0, 5, 1, TT.Rock, 1);
  for (let i = 0; i < 9; i++) set(43 + Math.floor(rnd() * 5), Math.floor(rnd() * 16), TT.Rock, 0);
  rect(44, 6, 1, 1, TT.Rock);
  rect(46, 6, 1, 1, TT.Rock);
  rect(45, 3, 1, 1, TT.Rock);
  rect(45, 9, 1, 1, TT.Rock);

  // 10. Training yard (south-east)
  rect(43, 20, 5, 12, TT.Yard);
  rect(43, 20, 5, 1, TT.Fence);
  rect(43, 31, 5, 1, TT.Fence);
  rect(47, 20, 1, 12, TT.Fence);
  set(43, 26, TT.Fence);
  set(43, 25, TT.Yard);
  rect(43, 17, 5, 1, TT.Ruin);
  set(43, 20, TT.Fence);

  // 11. Trees in the village outskirts (sparse)
  for (let y = 9; y < 17; y++)
    for (let x = 0; x < 19; x++) if (get(x, y) === TT.Grass && rnd() < 0.02) set(x, y, TT.Tree, 1);

  // 12. Make sure the main road endpoints are open
  rect(0, 18, 1, 2, TT.Path);
  rect(47, 18, 1, 2, TT.Path);

  // Keep the edges solid so the map is enclosed
  for (let x = 0; x < MAP_W; x++) { if (get(x, 0) === TT.Grass) set(x, 0, TT.Tree, 2); }

  return { type, variant, bridgeTiles };
}

export function zoneAt(x: number, y: number): Zone['id'] {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx >= 43) return ty <= 16 ? 'ruins' : 'yard';
  if (tx >= 33 && tx <= 42) return 'gorge';
  if (tx <= 19) return ty <= 16 ? 'farm' : 'wilds';
  if (ty <= 8) return 'works';
  return 'village';
}
