// A tiny pixel painter: shapes are rasterised into an RGBA buffer at art resolution, then
// outlined with a dark rim. Output is a canvas that is drawn scaled-up with no smoothing.
export type RGB = [number, number, number];

export function rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function shade(c: RGB, f: number): RGB {
  return [
    Math.max(0, Math.min(255, Math.round(c[0] * f))),
    Math.max(0, Math.min(255, Math.round(c[1] * f))),
    Math.max(0, Math.min(255, Math.round(c[2] * f))),
  ];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map((v) => Math.round(v)) as RGB;
}

export class Painter {
  readonly w: number;
  readonly h: number;
  readonly buf: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8ClampedArray(w * h * 4);
  }

  /** Writes one pixel (opaque unless alpha given). */
  px(x: number, y: number, c: RGB | string, a = 255): this {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const col = typeof c === 'string' ? rgb(c) : c;
    const i = (y * this.w + x) * 4;
    if (a < 255) {
      const k = a / 255;
      const inv = 1 - k;
      this.buf[i] = this.buf[i] * inv + col[0] * k;
      this.buf[i + 1] = this.buf[i + 1] * inv + col[1] * k;
      this.buf[i + 2] = this.buf[i + 2] * inv + col[2] * k;
      this.buf[i + 3] = Math.min(255, this.buf[i + 3] + a);
    } else {
      this.buf[i] = col[0];
      this.buf[i + 1] = col[1];
      this.buf[i + 2] = col[2];
      this.buf[i + 3] = 255;
    }
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: RGB | string): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
    return this;
  }

  /** Filled ellipse centred on (cx, cy). */
  ell(cx: number, cy: number, rx: number, ry: number, c: RGB | string): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, c);
      }
    return this;
  }

  /** Fills a diamond (iso tile) with corners at the given half sizes. */
  diamond(cx: number, cy: number, hw: number, hh: number, c: RGB | string): this {
    for (let y = Math.floor(cy - hh); y < Math.ceil(cy + hh); y++)
      for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
        const dx = Math.abs(x + 0.5 - cx) / hw;
        const dy = Math.abs(y + 0.5 - cy) / hh;
        if (dx + dy <= 1) this.px(x, y, c);
      }
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB | string): this {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (let guard = 0; guard < 4000; guard++) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return this;
  }

  /** Marks opaque pixels; used by outline() to find the silhouette. */
  private mask(): Uint8Array {
    const m = new Uint8Array(this.w * this.h);
    for (let i = 0; i < m.length; i++) m[i] = this.buf[i * 4 + 3] > 0 ? 1 : 0;
    return m;
  }

  /** Draws a dark 1px outline around every opaque area (only into empty pixels). */
  outline(c: RGB | string = '#1d1426'): this {
    const m = this.mask();
    const col = typeof c === 'string' ? rgb(c) : c;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (m[i]) continue;
        const near =
          (x > 0 && m[i - 1]) || (x < this.w - 1 && m[i + 1]) || (y > 0 && m[i - this.w]) || (y < this.h - 1 && m[i + this.w]);
        if (near) this.px(x, y, col);
      }
    return this;
  }

  /** Rim-lights the top-left edges of the silhouette for a little volume. */
  rim(c: RGB | string, alpha = 255): this {
    const m = this.mask();
    const col = typeof c === 'string' ? rgb(c) : c;
    for (let y = 1; y < this.h; y++)
      for (let x = 1; x < this.w; x++) {
        const i = y * this.w + x;
        if (m[i] && (!m[i - 1] || !m[i - this.w])) this.px(x, y, col, alpha);
      }
    return this;
  }

  toCanvas(): HTMLCanvasElement {
    const cnv = document.createElement('canvas');
    cnv.width = this.w;
    cnv.height = this.h;
    const ctx = cnv.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.buf);
    ctx.putImageData(img, 0, 0);
    return cnv;
  }
}

/** Deterministic hash → [0,1) for procedural variation. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 10000) / 10000;
}
