// Procedural isometric tile textures. Each tile is a 32x16 diamond, plus `extra` pixels of height
// for tall things (blocks, trees, fences). The ground diamond always sits at y ∈ [extra, extra+16).
import { Painter, hash2 } from './painter';
import { TT } from '../world/map';
import { blockSprite, treeSprite, rockSprite } from './sprites';

export const TILE_W = 32;
export const TILE_H = 16;

const WALL_COLORS: [string, string, string][] = [
  ['#4a6fa5', '#eadcb8', '#c9b48a'], // blue roof, plaster
  ['#b5523b', '#a8733f', '#7c5230'], // red roof, timber
  ['#5a6170', '#d8d0c4', '#aaa196'], // slate roof, stone
  ['#4f8a58', '#e9d9b6', '#c9b48a'], // green roof, plaster
];

export function tileExtra(t: TT, variant: number): number {
  switch (t) {
    case TT.Wall: return 12;
    case TT.Tree: return 20;
    case TT.Rock: return 6;
    case TT.Fence: return 8;
    default: void variant;
      return 0;
  }
}

function diamondMask(x: number, y: number, extra: number): number {
  // returns edge distance in [0,1]; <=1 means inside. Measured on the ground diamond.
  const cy = extra + 8;
  return Math.abs(x + 0.5 - 16) / 16 + Math.abs(y + 0.5 - cy) / 8;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Returns a tile canvas for a tile type; `frame` animates water. */
export function tileCanvas(t: TT, variant: number, seed: number, frame = 0): HTMLCanvasElement {
  const extra = tileExtra(t, variant);
  const key = `${t}:${variant}:${seed % 4}:${frame % 2}:${t === TT.Tree ? variant % 3 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = new Painter(TILE_W, TILE_H + extra);
  const ground = (base: string, noise: (x: number, y: number, h: number) => string | null, edge?: string): void => {
    for (let y = 0; y < TILE_H + extra; y++)
      for (let x = 0; x < TILE_W; x++) {
        const d = diamondMask(x, y, extra);
        if (d > 1) continue;
        const h = hash2(x + seed * 7, y, seed + 3);
        let c: string = base;
        const n = noise(x, y, h);
        if (n) c = n;
        if (edge && d > 0.9) c = edge;
        p.px(x, y, c);
      }
  };

  // base colours and micro-texture per type
  switch (t) {
    case TT.Grass:
      ground('#4f9d4a', (x, y, h) => (h > 0.86 ? '#62b355' : h < 0.1 ? '#3f8a3c' : (x + y) % 9 === 0 ? '#5aaa50' : null), '#468f42');
      break;
    case TT.Flower: {
      ground('#4f9d4a', (x, y, h) => (h > 0.86 ? '#62b355' : null));
      const cols = ['#f2e86d', '#ff8fb1', '#c7a8ff'];
      const cx = 6 + Math.floor(hash2(seed, 1, 5) * 18);
      const cy = 5 + Math.floor(hash2(seed, 2, 5) * 6);
      p.px(cx, cy, cols[variant % 3]).px(cx + 4, cy + 2, cols[(variant + 1) % 3]).px(cx - 3, cy + 1, '#ffffff');
      break;
    }
    case TT.TallGrass:
      ground('#4a9446', (x, y, h) => ((x + Math.floor(h * 4)) % 5 === 0 && y % 3 === 0 ? '#2f7035' : h > 0.9 ? '#5fae52' : null));
      break;
    case TT.Path:
      ground('#c9a66b', (x, y, h) => (h < 0.12 ? '#b08a52' : h > 0.9 ? '#dcc08a' : null), '#a98650');
      break;
    case TT.Floor:
      ground('#8e8a86', (x, y, h) => ((x + y) % 6 === 0 ? '#6f6b68' : (x - y + 64) % 8 === 0 ? '#9f9b96' : h > 0.9 ? '#a39f9a' : null), '#67635f');
      break;
    case TT.Sand:
      ground('#e0c48a', (x, y, h) => (h < 0.12 ? '#cdb078' : h > 0.9 ? '#eed6a0' : null));
      break;
    case TT.Water: {
      const hi = '#7cc4ef';
      ground('#2f7fb8', (x, y) => ((x * 3 + y * 5 + frame * 2) % 11 === 0 ? hi : (x + frame) % 7 === 0 ? '#3a8fc6' : null));
      break;
    }
    case TT.Field: {
      const crop = variant % 2 === 0 ? '#5fa04e' : '#c9b24a';
      ground('#7a5333', (x, y, h) => {
        if ((x + y * 2) % 4 === 0 && y % 3 !== 0) return crop;
        if ((x + y * 2) % 4 === 1 && y % 3 !== 0) return '#4d8a3e';
        return h < 0.15 ? '#664329' : null;
      });
      break;
    }
    case TT.Chasm:
      ground('#15101f', (x, y, h) => (h > 0.92 ? '#2b2140' : h < 0.05 ? '#0c0814' : null));
      break;
    case TT.Bridge:
      ground('#a7743f', (x, y) => ((x + y) % 4 === 0 ? '#7a4f2a' : (y % 4 === 0 ? '#8c5f33' : null)), '#5e3a1c');
      break;
    case TT.Ruin:
      ground('#7f8a8f', (x, y, h) => (h > 0.9 ? '#9aa4a8' : (x * 5 + y * 3) % 17 === 0 ? '#5d6670' : h < 0.06 ? '#5d8a4b' : null), '#5d666d');
      break;
    case TT.Yard:
      ground('#b38a5e', (x, y, h) => (h < 0.1 ? '#9c7650' : h > 0.92 ? '#c7a074' : null));
      break;
    case TT.Wall: {
      const [roof, l, r] = WALL_COLORS[variant % WALL_COLORS.length];
      const c = blockSprite(roof, l, r, hash2(seed, variant, 9) > 0.5, seed);
      cache.set(key, c);
      return c;
    }
    case TT.Tree: {
      ground('#4f9d4a', (x, y, h) => (h > 0.86 ? '#62b355' : null));
      const tree = treeSprite(variant);
      // composite tree sprite onto the painter (tree base sits on the ground centre)
      const tctx = tree.getContext('2d');
      if (tctx) {
        const td = tctx.getImageData(0, 0, tree.width, tree.height).data;
        for (let y = 0; y < tree.height; y++)
          for (let x = 0; x < tree.width; x++) {
            const i = (y * tree.width + x) * 4;
            if (td[i + 3] === 0) continue;
            const dx = 5 + x;
            const dy = extra + 8 + 4 - tree.height + y;
            p.px(dx, dy, [td[i], td[i + 1], td[i + 2]]);
          }
      }
      break;
    }
    case TT.Rock: {
      ground('#4f9d4a', (x, y, h) => (h > 0.86 ? '#62b355' : null));
      const rock = rockSprite();
      const rctx = rock.getContext('2d');
      if (rctx) {
        const rd = rctx.getImageData(0, 0, rock.width, rock.height).data;
        for (let y = 0; y < rock.height; y++)
          for (let x = 0; x < rock.width; x++) {
            const i = (y * rock.width + x) * 4;
            if (rd[i + 3] === 0) continue;
            p.px(9 + x - 7, extra + 8 + 3 - rock.height + y, [rd[i], rd[i + 1], rd[i + 2]]);
          }
      }
      break;
    }
    case TT.Fence: {
      ground('#4f9d4a', (x, y, h) => (h > 0.86 ? '#62b355' : null));
      for (let i = 0; i < 3; i++) {
        const px = 6 + i * 9;
        p.rect(px, 4 + 6 + (extra - 8), 2, 9, '#8b6139');
        p.px(px, 5 + 6 + (extra - 8), '#c18f57');
      }
      p.rect(4, 8 + 6 + (extra - 8), 24, 1, '#a57444').rect(4, 11 + 6 + (extra - 8), 24, 1, '#a57444');
      break;
    }
    default:
      ground('#4f9d4a', () => null);
  }
  cache.set(key, p.toCanvas());
  return cache.get(key) as HTMLCanvasElement;
}

export function clearTileCache(): void {
  cache.clear();
}
