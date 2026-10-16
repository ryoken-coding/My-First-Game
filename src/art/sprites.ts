// Pixel-art characters, enemies, props and effects, drawn procedurally with the painter.
import { Painter, rgb, shade, mix, hash2, type RGB } from './painter';
import { AFF_COLOR, type AffId } from '../data/affinities';

const cache = new Map<string, HTMLCanvasElement>();

function cached(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = make();
    cache.set(key, c);
  }
  return c;
}

export interface HumanLook {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  accent?: string;
  hat?: 'none' | 'hood' | 'cap' | 'wide' | 'bun' | 'band';
  beard?: boolean;
  staff?: string; // glowing orb colour (player)
  apron?: boolean;
  tall?: boolean;
}

/**
 * Humanoid, 16x24 art pixels. frame: 0 = idle, 1 = step A, 2 = step B.
 * Facing: faces the viewer (eyes visible); flip for left/right use via canvas transform.
 */
export function humanSprite(look: HumanLook, frame = 0): HTMLCanvasElement {
  const key = `h:${JSON.stringify(look)}:${frame}`;
  return cached(key, () => {
    const p = new Painter(16, 24);
    const skin = rgb(look.skin);
    const hair = rgb(look.hair);
    const top = rgb(look.top);
    const bottom = rgb(look.bottom);
    const accent = rgb(look.accent ?? '#f0d060');
    const boot: RGB = [52, 36, 28];
    const legOff = frame === 1 ? [-1, 1] : frame === 2 ? [1, -1] : [0, 0];

    // legs
    p.rect(5 + legOff[0], 17, 3, 5, bottom).rect(9 + legOff[1], 17, 3, 5, bottom);
    p.rect(4 + legOff[0], 21, 4, 2, boot).rect(9 + legOff[1], 21, 4, 2, boot);
    // body / robe
    p.rect(4, 10, 8, 8, top);
    p.rect(4, 15, 8, 2, shade(top, 0.8));
    p.rect(4, 15, 8, 1, accent); // belt
    p.rect(6, 10, 4, 1, shade(top, 1.2));
    if (look.apron) p.rect(6, 12, 4, 5, mix(top, [240, 235, 220], 0.6));
    // arms
    p.rect(2, 10, 2, 7, look.tall ? top : shade(top, 0.9)).rect(12, 10, 2, 7, shade(top, 0.9));
    p.rect(2, 16, 2, 2, skin).rect(12, 16, 2, 2, skin);
    // head
    p.ell(8, 6.5, 4, 4.4, skin);
    p.rect(4, 8, 8, 1, shade(skin, 0.95));
    // hair / hat
    const hat = look.hat ?? 'none';
    if (hat === 'hood') {
      p.ell(8, 5, 5.2, 5.4, top);
      p.ell(8, 7, 3.5, 3.6, skin);
      p.rect(3, 6, 2, 7, top).rect(11, 6, 2, 7, top);
    } else {
      p.ell(8, 4.2, 4.4, 2.8, hair);
      p.rect(3.5, 4, 9, 2, hair);
      p.rect(3, 4, 2, 4, hair).rect(11, 4, 2, 4, hair);
    }
    if (hat === 'cap') p.rect(3, 2, 10, 2, top).rect(2, 3, 12, 1, shade(top, 0.8));
    if (hat === 'wide') p.rect(0, 3, 16, 1, shade(top, 1)).rect(1, 2, 14, 1, top).rect(4, 0, 8, 2, top);
    if (hat === 'bun') p.ell(8, 1.5, 2, 2, hair);
    if (hat === 'band') p.rect(4, 3, 8, 1, accent);
    // eyes & mouth
    p.px(6, 6, '#22192b').px(10, 6, '#22192b').px(6, 5, '#ffffff').px(10, 5, '#ffffff');
    p.px(7, 8, shade(skin, 0.7)).px(8, 8, shade(skin, 0.7));
    if (look.beard) p.rect(5, 8, 6, 2, hair).px(6, 8, shade(hair, 1.3));
    if (look.staff) {
      const orb = rgb(look.staff);
      p.line(14, 6, 14, 22, '#6b4a2c');
      p.ell(14, 5, 1.6, 1.6, orb);
      p.px(13, 4, '#ffffff');
    }
    p.outline();
    return p.toCanvas();
  });
}

export function playerSprite(topAff: AffId, pcts: number[], frame: number): HTMLCanvasElement {
  // Robe colour blends the affinity colours by strength, so the outfit shows your magic.
  const AFFS: AffId[] = ['anti', 'enh', 'emi', 'tra', 'man', 'con'];
  let r = 0, g = 0, b = 0, total = 0;
  AFFS.forEach((a, i) => {
    const c = rgb(AFF_COLOR[a]);
    const w = Math.max(1, pcts[i]);
    r += c[0] * w; g += c[1] * w; b += c[2] * w; total += w;
  });
  const blend: RGB = [r / total, g / total, b / total];
  const robe = mix(blend, [70, 62, 92], 0.55);
  const hex = (c: RGB) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  return humanSprite(
    {
      skin: '#f0c29a',
      hair: '#4b2f23',
      top: hex(robe),
      bottom: hex(shade(robe, 0.6)),
      accent: AFF_COLOR[topAff],
      hat: 'band',
      staff: AFF_COLOR[topAff],
    },
    frame,
  );
}

// -------- Enemies (art pixels) --------
export function slimeSprite(frame: number): HTMLCanvasElement {
  return cached(`slime:${frame}`, () => {
    const p = new Painter(16, 14);
    const sq = frame ? 1 : 0;
    p.ell(8, 9 + sq, 6.5, 4.5 - sq * 0.5, '#7fd6e8');
    p.ell(7, 7 + sq, 4, 2.5, '#b8f2ff');
    p.px(6, 9 + sq, '#1e3a52').px(10, 9 + sq, '#1e3a52').px(6, 8 + sq, '#fff').px(10, 8 + sq, '#fff');
    p.rect(4, 12, 8, 1, '#4fa4c4');
    p.outline('#21415c');
    return p.toCanvas();
  });
}

export function boarSprite(frame: number): HTMLCanvasElement {
  return cached(`boar:${frame}`, () => {
    const p = new Painter(22, 16);
    p.ell(10, 8, 8.5, 5.5, '#8c6242');
    p.ell(10, 5, 6, 2.5, '#4c7a3b'); // moss back
    p.ell(18, 9, 3.5, 3, '#a87a52'); // head
    p.rect(19, 9, 3, 2, '#e8d9b8');
    p.px(20, 11, '#fff').px(21, 11, '#fff'); // tusks
    p.px(18, 7, '#1e1420');
    const l = frame ? 1 : 0;
    p.rect(5, 12, 2, 4 - l, '#5d4030').rect(9, 12, 2, 4 + l, '#5d4030').rect(13, 12, 2, 4 - l, '#5d4030');
    p.outline('#2a1a14');
    return p.toCanvas();
  });
}

export function sentrySprite(frame: number): HTMLCanvasElement {
  return cached(`sentry:${frame}`, () => {
    const p = new Painter(16, 18);
    p.rect(3, 6, 10, 8, '#9aa6b2');
    p.rect(3, 6, 10, 2, '#c4ced8');
    p.rect(5, 2, 6, 5, '#7b8794');
    p.rect(6, 4, 4, 2, frame ? '#ff6b6b' : '#ff9a4a'); // eye
    p.line(8, 2, 8, 0, '#596472').px(8, 0, '#ffd166');
    p.rect(5, 14, 2, 3, '#56606b').rect(9, 14, 2, 3, '#56606b');
    p.rect(4, 9, 8, 1, '#56606b').px(7, 11, '#ffd166');
    p.outline('#2c323a');
    return p.toCanvas();
  });
}

export function crawlerSprite(frame: number): HTMLCanvasElement {
  return cached(`crawler:${frame}`, () => {
    const p = new Painter(18, 12);
    p.ell(9, 7, 7, 4, '#4d8f3e');
    for (let x = 3; x < 16; x += 3) p.px(x, 3 - (frame ? 1 : 0), '#d9d6a6').px(x + 1, 2, '#e9e5b8');
    p.px(6, 6, '#fff').px(12, 6, '#fff').px(6, 7, '#1d1426').px(12, 7, '#1d1426');
    p.rect(4, 10, 10, 1, '#2f5f2a');
    p.outline('#1f3a1b');
    return p.toCanvas();
  });
}

export function wispSprite(frame: number): HTMLCanvasElement {
  return cached(`wisp:${frame}`, () => {
    const p = new Painter(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 7 - (frame ? 0.5 : 0));
      if (d < 7) p.px(x, y, '#c9a7ff', Math.round(120 * (1 - d / 7)));
    }
    p.ell(8, 7, 3, 3, '#f1e4ff');
    p.ell(8, 7, 1.5, 1.5, '#ffffff');
    p.line(8, 10, 6, 15, '#c9a7ff');
    return p.toCanvas();
  });
}

export function guardianSprite(): HTMLCanvasElement {
  return cached('guardian', () => {
    const p = new Painter(40, 46);
    p.rect(10, 12, 20, 22, '#7c7f8c');
    p.rect(10, 12, 20, 3, '#a1a5b3');
    p.rect(6, 14, 4, 16, '#6a6e7b').rect(30, 14, 4, 16, '#6a6e7b'); // arms
    p.rect(12, 34, 6, 10, '#5d616d').rect(22, 34, 6, 10, '#5d616d'); // legs
    p.ell(20, 9, 8, 7, '#8e92a0');
    p.rect(13, 7, 14, 3, '#2a2433'); // visor
    p.ell(20, 22, 4, 4, '#ffd166'); // core
    p.ell(20, 22, 2, 2, '#fff7d6');
    for (let i = 0; i < 6; i++) p.px(12 + i * 3, 20 + (i % 2) * 2, '#5a3f6a');
    p.outline('#22202b');
    return p.toCanvas();
  });
}

// -------- Props --------
export function treeSprite(variant: number): HTMLCanvasElement {
  return cached(`tree:${variant}`, () => {
    const p = new Painter(22, 28);
    p.rect(9, 18, 4, 10, '#6e4a2e').rect(10, 18, 1, 10, '#8b6139');
    const greens = [['#3e8f3f', '#58b053', '#2a6a33'], ['#3d7d4b', '#5ea46a', '#2b5e3a'], ['#8a9f3b', '#b6c75a', '#5e7431']][variant % 3];
    p.ell(11, 12, 9, 8, greens[0]);
    p.ell(8, 9, 5, 4, greens[1]);
    p.ell(14, 15, 4, 4, greens[2]);
    p.px(6, 7, '#c9f29a').px(7, 6, '#c9f29a');
    p.outline('#17301f');
    return p.toCanvas();
  });
}

export function rockSprite(): HTMLCanvasElement {
  return cached('rock', () => {
    const p = new Painter(14, 10);
    p.ell(7, 6, 6, 4, '#8c939c');
    p.ell(5, 4, 3, 2, '#b1b8c1');
    p.rect(9, 6, 3, 2, '#6a727c');
    p.outline('#2e3238');
    return p.toCanvas();
  });
}

export function pumpSprite(active: boolean): HTMLCanvasElement {
  return cached(`pump:${active}`, () => {
    const p = new Painter(18, 24);
    p.rect(3, 16, 12, 6, '#7c8794'); // base block
    p.rect(3, 16, 12, 1, '#a7b1bd');
    p.rect(7, 6, 4, 10, '#4f7fa8'); // cylinder
    p.rect(7, 6, 1, 10, '#79a6c9');
    p.ell(9, 6, 4, 2.2, '#3e6b92');
    p.rect(12, 9, 4, 2, '#6d7682'); // outlet pipe
    p.rect(13, 9, 3, 1, '#9aa5b3');
    p.ell(8, 10, 2, 2, active ? '#7ef0ff' : '#6b6f78'); // gauge
    p.px(8, 10, '#22192b');
    p.rect(4, 22, 10, 2, '#5b6470');
    p.outline('#23262d');
    return p.toCanvas();
  });
}

export function lanternPostSprite(): HTMLCanvasElement {
  return cached('lantern', () => {
    const p = new Painter(10, 24);
    p.rect(4, 6, 2, 17, '#5a4a3c');
    p.rect(2, 22, 6, 2, '#3e342c');
    p.rect(2, 1, 6, 5, '#3b3645');
    p.rect(3, 2, 4, 3, '#c9d6e0');
    p.rect(2, 0, 6, 1, '#2a2433');
    p.outline('#1d1426');
    return p.toCanvas();
  });
}

export function stoveSprite(): HTMLCanvasElement {
  return cached('stove', () => {
    const p = new Painter(14, 12);
    p.rect(1, 4, 12, 7, '#4a4650');
    p.rect(1, 4, 12, 1, '#6c6878');
    p.rect(3, 6, 4, 2, '#ff8a3d');
    p.rect(9, 6, 2, 1, '#2a2433');
    p.rect(2, 2, 2, 3, '#8a8394').px(3, 1, '#9ca9b4');
    p.outline();
    return p.toCanvas();
  });
}

export function chestSprite(): HTMLCanvasElement {
  return cached('chest', () => {
    const p = new Painter(14, 11);
    p.rect(1, 5, 12, 5, '#9a6a3a');
    p.ell(7, 5, 6, 3, '#b7834f');
    p.rect(1, 7, 12, 1, '#6e4a2a');
    p.rect(6, 6, 2, 3, '#f0d060');
    p.outline('#2e1d12');
    return p.toCanvas();
  });
}

export function benchSprite(color: string, glow?: string): HTMLCanvasElement {
  return cached(`bench:${color}:${glow}`, () => {
    const p = new Painter(16, 12);
    p.rect(1, 6, 14, 3, color).rect(1, 9, 2, 3, shade(rgb(color), 0.7)).rect(13, 9, 2, 3, shade(rgb(color), 0.7));
    p.rect(1, 6, 14, 1, shade(rgb(color), 1.3));
    if (glow) { p.rect(5, 4, 2, 2, glow).rect(9, 3, 3, 3, glow); }
    p.outline();
    return p.toCanvas();
  });
}

export function dummySprite(): HTMLCanvasElement {
  return cached('dummy', () => {
    const p = new Painter(12, 20);
    p.rect(5, 8, 2, 11, '#6b4a2c');
    p.rect(1, 9, 10, 2, '#8b6139');
    p.ell(6, 5, 3.5, 3.5, '#d9c48f');
    p.rect(4, 4, 1, 1, '#22192b').rect(7, 4, 1, 1, '#22192b');
    p.rect(3, 12, 6, 6, '#c0854a');
    p.rect(3, 12, 6, 1, '#e9a86e');
    p.outline();
    return p.toCanvas();
  });
}

export function signSprite(): HTMLCanvasElement {
  return cached('sign', () => {
    const p = new Painter(10, 12);
    p.rect(4, 5, 2, 7, '#5a3f2a');
    p.rect(0, 1, 10, 5, '#b98a52');
    p.rect(1, 2, 8, 1, '#d7b07a');
    p.rect(2, 3, 5, 1, '#6e4a2a');
    p.outline();
    return p.toCanvas();
  });
}

export function barrelSprite(): HTMLCanvasElement {
  return cached('barrel', () => {
    const p = new Painter(10, 12);
    p.ell(5, 7, 4.5, 4.5, '#8c5c33');
    p.rect(1, 4, 8, 1, '#5c3a20').rect(1, 9, 8, 1, '#5c3a20');
    p.rect(3, 5, 4, 4, '#4d7fa8');
    p.outline('#2a1a10');
    return p.toCanvas();
  });
}

export function crateSprite(): HTMLCanvasElement {
  return cached('crate', () => {
    const p = new Painter(12, 10);
    p.rect(0, 2, 12, 8, '#b9915a');
    p.rect(0, 2, 12, 1, '#dcb47c');
    p.rect(2, 3, 8, 1, '#7c5a32').rect(2, 7, 8, 1, '#7c5a32');
    p.outline('#3a2818');
    return p.toCanvas();
  });
}

export function flaskSprite(): HTMLCanvasElement {
  return cached('flask', () => {
    const p = new Painter(10, 14);
    p.rect(4, 1, 2, 4, '#c9d6e0');
    p.rect(2, 5, 6, 2, '#c9d6e0');
    p.ell(5, 9, 4, 4, '#c9d6e0');
    p.ell(5, 9, 3, 3, '#68d391');
    p.rect(3, 8, 2, 1, '#e8fff0');
    p.outline('#2a3a33');
    return p.toCanvas();
  });
}

export function valveSprite(): HTMLCanvasElement {
  return cached('valve', () => {
    const p = new Painter(8, 10);
    p.rect(3, 4, 2, 6, '#7c8794');
    p.rect(0, 2, 8, 2, '#b5bfca');
    p.rect(1, 0, 6, 2, '#e05a5a');
    p.outline();
    return p.toCanvas();
  });
}

export function archSprite(): HTMLCanvasElement {
  return cached('arch', () => {
    const p = new Painter(18, 26);
    p.rect(1, 6, 16, 20, '#6a6e7b');
    p.ell(9, 6, 8, 6, '#6a6e7b');
    p.ell(9, 10, 4.5, 6, '#2b2436');
    p.ell(9, 10, 2.5, 4, '#7be0ff');
    p.rect(1, 6, 2, 20, '#8b8f9c');
    p.outline('#1d1b26');
    return p.toCanvas();
  });
}

export function pickupSprite(kind: 'herb' | 'ore' | 'shard' | 'bread' | 'wire'): HTMLCanvasElement {
  return cached(`pick:${kind}`, () => {
    const p = new Painter(8, 8);
    if (kind === 'herb') { p.ell(4, 4, 3, 2, '#7fd36a').px(4, 2, '#c9f29a'); }
    if (kind === 'ore') { p.ell(4, 4, 3.5, 3, '#9aa3ad').px(3, 3, '#ffffff'); }
    if (kind === 'shard') { p.ell(4, 4, 2, 3.5, '#7ef0ff').px(4, 2, '#ffffff'); }
    if (kind === 'bread') { p.ell(4, 4, 3.5, 2.5, '#d9a35a').rect(2, 3, 4, 1, '#f0d19a'); }
    if (kind === 'wire') { p.rect(1, 3, 6, 2, '#d88a4a').px(2, 3, '#ffd6a6'); }
    p.outline();
    return p.toCanvas();
  });
}

/** Iso block: a 32x16 diamond top with two side faces extending down by `H` pixels. */
export function blockSprite(top: string, left: string, right: string, windows: boolean, seed: number): HTMLCanvasElement {
  return cached(`block:${top}:${left}:${right}:${windows}:${seed}`, () => {
    const H = 12;
    const p = new Painter(32, 16 + H);
    const topC = rgb(top);
    const lC = rgb(left);
    const rC = rgb(right);
    for (let x = 0; x < 32; x++) {
      const half = x < 16 ? x + 0.5 : 31.5 - x; // distance from the nearer side
      const ye = 8 + half / 2; // lower diamond edge at this column
      for (let y = 0; y < 16 + H; y++) {
        const dTop = Math.abs(x + 0.5 - 16) / 16 + Math.abs(y + 0.5 - 8) / 8;
        if (dTop <= 1) {
          // subtle speckle on the top face keeps the surface alive
          const sp = hash2(x, y, seed);
          p.px(x, y, sp > 0.93 ? shade(topC, 1.12) : topC);
        } else if (y + 0.5 >= ye && y + 0.5 < ye + H) {
          const edgeShade = y + 0.5 > ye + H - 2 ? 0.78 : 1;
          p.px(x, y, shade(x < 16 ? lC : rC, edgeShade));
        }
      }
    }
    if (windows) {
      p.rect(5, 13, 3, 3, '#f7e7a6').rect(24, 15, 3, 3, '#f7e7a6');
      p.px(5, 13, '#fff7d6');
    }
    p.outline('#1d1426');
    return p.toCanvas();
  });
}

export function clearSpriteCache(): void {
  cache.clear();
}
