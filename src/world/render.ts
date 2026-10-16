// Isometric world renderer: tiles and entities are interleaved by diagonal depth.
import { MAP_H, MAP_W, TT } from './map';
import { iso } from './level';
import { tileCanvas } from '../art/tiles';
import * as S from '../art/sprites';
import { AFF_COLOR } from '../data/affinities';
import { t } from '../i18n';
import type { Game } from '../game/game';
import { hash2 } from '../art/painter';
import { OBJECTS } from '../data/content';

interface Draw { img: HTMLCanvasElement; x: number; y: number; alpha?: number; flip?: boolean }

// Last camera transform in CSS pixels, used to place screen-space labels.
const cam = { ox: 0, oy: 0, z: 2, dpr: 1 };

/** Screen transform: art pixels → CSS pixels at zoom `z`, centred on the camera. */
function setCamera(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number, dpr: number): number {
  const z = g.settings.zoom;
  const camX = Math.round(g.camX * z) / z;
  const camY = Math.round(g.camY * z) / z;
  const tx = Math.round(dpr * (w / 2 - camX * z));
  const ty = Math.round(dpr * (h / 2 - camY * z));
  ctx.setTransform(dpr * z, 0, 0, dpr * z, tx, ty);
  Object.assign(cam, { ox: tx / dpr, oy: ty / dpr, z, dpr });
  return z;
}

/** Runs a draw callback in CSS-pixel screen space at the world point (x, y). */
function screenSpace(ctx: CanvasRenderingContext2D, x: number, y: number, fn: (sx: number, sy: number) => void): void {
  ctx.save();
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  fn(cam.ox + x * cam.z, cam.oy + y * cam.z);
  ctx.restore();
}

function drawImg(ctx: CanvasRenderingContext2D, d: Draw): void {
  ctx.save();
  if (d.alpha !== undefined) ctx.globalAlpha = d.alpha;
  if (d.flip) {
    ctx.translate(d.x + d.img.width, d.y);
    ctx.scale(-1, 1);
    ctx.drawImage(d.img, 0, 0);
  } else {
    ctx.drawImage(d.img, Math.round(d.x), Math.round(d.y));
  }
  ctx.restore();
}

function objectImage(g: Game, kind: string, id: string): { img: HTMLCanvasElement; alpha?: number } {
  const opened = g.save.chests.includes(id);
  switch (kind) {
    case 'pump': return { img: S.pumpSprite(g.done('pump')) };
    case 'lantern': return { img: S.lanternPostSprite() };
    case 'stove': return { img: S.stoveSprite() };
    case 'chipBench': return { img: S.benchSprite('#5c6b7a', '#7ef0ff') };
    case 'bridge': return { img: S.crateSprite() };
    case 'valve': return { img: S.valveSprite() };
    case 'board': return { img: S.signSprite() };
    case 'medic': return { img: S.benchSprite('#e8eef2', '#e05a5a') };
    case 'lab': return { img: S.flaskSprite() };
    case 'tower': return { img: S.archSprite() };
    case 'chest': return { img: S.chestSprite(), alpha: opened ? 0.55 : 1 };
    case 'crate': return { img: S.crateSprite(), alpha: opened ? 0.55 : 1 };
    case 'sign': return { img: S.signSprite() };
    case 'barrel': return { img: S.barrelSprite() };
    case 'dummy': return { img: S.dummySprite() };
    default: return { img: S.signSprite() };
  }
}

function enemyImage(e: { type: string; bob: number }): HTMLCanvasElement {
  const f = Math.floor(e.bob) % 2;
  switch (e.type) {
    case 'slime': return S.slimeSprite(f);
    case 'boar': return S.boarSprite(f);
    case 'sentry': return S.sentrySprite(f);
    case 'wisp': return S.wispSprite(f);
    case 'crawler': return S.crawlerSprite(f);
    default: return S.guardianSprite();
  }
}

export function render(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number): void {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#17131f';
  ctx.fillRect(0, 0, w * dpr, h * dpr);
  const z = setCamera(ctx, g, w, h, dpr);
  ctx.imageSmoothingEnabled = false;

  const frame = Math.floor(g.time * 2) % 2;
  const viewHalfW = w / 2 / z + 80;
  const viewHalfH = h / 2 / z + 80;
  const inView = (x: number, y: number): boolean => Math.abs(x - g.camX) < viewHalfW && Math.abs(y - g.camY) < viewHalfH;

  // ---- entities list with depth (x + y) ----
  type Ent = { depth: number; draw: () => void };
  const ents: Ent[] = [];
  const p = g.player;
  const feet = (x: number, y: number): [number, number] => iso(x, y);

  for (const npc of g.npcs) {
    ents.push({ depth: npc.x + npc.y, draw: () => {
      const [fx, fy] = feet(npc.x + 0.5, npc.y + 0.5);
      if (!inView(fx, fy)) return;
      ctx.fillStyle = 'rgba(10,8,16,0.28)';
      ctx.beginPath(); ctx.ellipse(fx, fy, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
      drawImg(ctx, { img: S.humanSprite(npc.look, 0), x: fx - 8, y: fy - 22 });
      const near = Math.hypot(npc.x - p.x, npc.y - p.y) < 3.5;
      if (near) nameplate(ctx, fx, fy - 26, t(`npc.${npc.name}`));
    } });
  }
  for (const o of OBJECTS) {
    ents.push({ depth: o.x + o.y + 0.5, draw: () => {
      const [fx, fy] = feet(o.x + 0.5, o.y + 0.5);
      if (!inView(fx, fy)) return;
      const im = objectImage(g, o.kind, o.id);
      const lit = o.kind === 'lantern';
      drawImg(ctx, { img: im.img, x: fx - im.img.width / 2, y: fy - im.img.height + 3, alpha: im.alpha });
      if (lit) {
        const col = g.done('lantern') ? '#68d391' : ['#ff6b6b', '#68d391', '#ffd166'][Math.floor(g.time * 1.5) % 3];
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 24, 4, 3);
        ctx.globalAlpha = 1;
      }
    } });
  }
  for (const e of g.enemies) {
    if (e.dead) continue;
    ents.push({ depth: e.x + e.y, draw: () => {
      const [fx, fy] = feet(e.x, e.y);
      if (!inView(fx, fy)) return;
      ctx.fillStyle = 'rgba(10,8,16,0.3)';
      ctx.beginPath(); ctx.ellipse(fx, fy, e.boss ? 14 : 6, e.boss ? 5 : 2.6, 0, 0, Math.PI * 2); ctx.fill();
      const img = enemyImage(e);
      const bob = e.type === 'wisp' ? Math.sin(g.time * 3 + e.bob) * 2 : 0;
      const alpha = e.flash > 0 ? 0.55 : 1;
      if (e.type === 'boar' && e.windup > 0) {
        ctx.fillStyle = 'rgba(255,90,90,0.35)';
        ctx.beginPath(); ctx.ellipse(fx, fy, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      }
      const flip = e.type === 'boar' ? e.cdx < 0 || (e.charge <= 0 && p.x < e.x) : p.x < e.x;
      drawImg(ctx, { img, x: fx - img.width / 2, y: fy - img.height + 2 + bob, alpha, flip });
      if (e.shield > 0) {
        ctx.strokeStyle = e.type === 'guardian' ? 'rgba(255,209,102,0.7)' : 'rgba(201,184,255,0.7)';
        ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.ellipse(fx, fy - (e.boss ? 20 : 8), e.boss ? 22 : 9, e.boss ? 10 : 6, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (e.revealed && e.type === 'wisp') {
        ctx.fillStyle = 'rgba(255,154,213,0.9)';
        ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 18, 2, 2);
      }
      // health bar
      if (e.hp < e.maxHp && !e.boss) {
        ctx.fillStyle = '#1d1426';
        ctx.fillRect(Math.round(fx) - 8, Math.round(fy) - 20, 16, 2);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(Math.round(fx) - 8, Math.round(fy) - 20, 16 * Math.max(0, e.hp / e.maxHp), 2);
      }
      if (e.boss) {
        ctx.fillStyle = '#1d1426';
        ctx.fillRect(Math.round(fx) - 24, Math.round(fy) - 52, 48, 3);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(Math.round(fx) - 24, Math.round(fy) - 52, 48 * Math.max(0, e.hp / 240), 3);
      }
      // telegraph for guardian slam
      if (e.type === 'guardian' && e.windup > 0) {
        ctx.strokeStyle = 'rgba(255,107,107,0.8)';
        ctx.beginPath(); ctx.ellipse(fx, fy, 40, 18, 0, 0, Math.PI * 2); ctx.stroke();
      }
    } });
  }
  // player
  ents.push({ depth: p.x + p.y, draw: () => {
    const [fx, fy] = feet(p.x, p.y);
    ctx.fillStyle = 'rgba(10,8,16,0.32)';
    ctx.beginPath(); ctx.ellipse(fx, fy, 6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    const topAff = g.save.pcts.indexOf(Math.max(...g.save.pcts));
    const aff = ['anti', 'enh', 'emi', 'tra', 'man', 'con'][topAff] as keyof typeof AFF_COLOR;
    const pf = p.moving ? (p.walkT < 1 ? 1 : 2) : 0;
    const img = S.playerSprite(aff, g.save.pcts, pf);
    const bob = p.dodgeT > 0 ? -3 : 0;
    const alpha = p.invuln > 0 && Math.floor(g.time * 20) % 2 === 0 ? 0.45 : 1;
    if (p.ironT > 0) {
      ctx.fillStyle = 'rgba(224,136,58,0.22)';
      ctx.beginPath(); ctx.ellipse(fx, fy - 10, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (p.ward && p.ward.amt > 0) {
      ctx.strokeStyle = 'rgba(255,154,213,0.8)';
      ctx.beginPath(); ctx.ellipse(fx, fy - 10, 11, 9, 0, 0, Math.PI * 2); ctx.stroke();
    }
    drawImg(ctx, { img, x: fx - 8, y: fy - 22 + bob, alpha, flip: p.facing < 0 });
    if (p.attackT > 0) {
      ctx.strokeStyle = 'rgba(255,245,200,0.8)';
      ctx.lineWidth = 1.2;
      const a0 = Math.atan2(p.dirY, p.dirX);
      ctx.beginPath();
      ctx.arc(fx, fy - 6, 14, a0 - 1, a0 + 1);
      ctx.stroke();
    }
  } });

  for (const f of g.familiars) {
    ents.push({ depth: f.x + f.y, draw: () => {
      const [fx, fy] = feet(f.x, f.y);
      const bob = Math.sin(g.time * 6) * 2;
      drawImg(ctx, { img: S.wispSprite(Math.floor(g.time * 4) % 2), x: fx - 8, y: fy - 20 + bob, alpha: 0.9 });
    } });
  }
  for (const b of g.barriers) {
    ents.push({ depth: b.x + b.y, draw: () => {
      const [fx, fy] = feet(b.x, b.y);
      ctx.fillStyle = `rgba(123,215,255,${0.25 + 0.1 * Math.sin(g.time * 4)})`;
      ctx.strokeStyle = 'rgba(180,235,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(fx, fy - 26); ctx.lineTo(fx + 14, fy - 18); ctx.lineTo(fx, fy - 10); ctx.lineTo(fx - 14, fy - 18); ctx.closePath();
      ctx.fill(); ctx.stroke();
    } });
  }
  ents.sort((a, b) => a.depth - b.depth);

  // ---- tiles interleaved with entities by diagonal ----
  let ei = 0;
  for (let s = 0; s <= MAP_W + MAP_H - 2; s++) {
    for (let tx = Math.max(0, s - (MAP_H - 1)); tx <= Math.min(MAP_W - 1, s); tx++) {
      const ty = s - tx;
      const cx = (tx + 0.5) - (ty + 0.5);
      const cy = (tx + 0.5) + (ty + 0.5);
      const [sx, sy] = [cx * 16, cy * 8 + 8];
      if (!inView(sx, sy)) continue;
      const t0 = g.map.type[ty * MAP_W + tx] as TT;
      const variant = g.map.variant[ty * MAP_W + tx];
      const seed = Math.floor(hash2(tx, ty, 11) * 4);
      const c = tileCanvas(t0, variant, seed, t0 === TT.Water ? frame : 0);
      const extra = c.height - 16;
      drawImg(ctx, { img: c, x: sx - 16, y: sy - 8 - extra });
    }
    while (ei < ents.length && ents[ei].depth < s + 1) {
      ents[ei].draw();
      ei++;
    }
  }
  while (ei < ents.length) ents[ei++].draw();

  // ---- world-space effects ----
  for (const e of g.effects) {
    const t01 = e.t / e.life;
    const [fx, fy] = feet(e.x, e.y);
    ctx.globalAlpha = 1 - t01;
    if (e.kind === 'ring') {
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1;
      const r = (e.size ?? 1.2) * 16 * (0.4 + t01);
      ctx.beginPath(); ctx.ellipse(fx, fy, r, r / 2, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (e.kind === 'burst') {
      ctx.fillStyle = e.color;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.fillRect(Math.round(fx + Math.cos(a) * 12 * t01), Math.round(fy - 6 + Math.sin(a) * 6 * t01), 2, 2);
      }
    } else if (e.kind === 'line' && e.x2 !== undefined && e.y2 !== undefined) {
      const [gx, gy] = feet(e.x2, e.y2);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(fx, fy - 8); ctx.lineTo(gx, gy - 8); ctx.stroke();
    } else if (e.kind === 'text' && e.text) {
      ctx.globalAlpha = Math.max(0, 1 - t01);
      floatingText(ctx, fx, fy - 26 - t01 * 10, e.text, e.color);
    }
    ctx.globalAlpha = 1;
  }

  // projectiles (drawn on top)
  for (const pr of g.projectiles) {
    const [fx, fy] = feet(pr.x, pr.y);
    const col = pr.team === 'player' ? (pr.kind === 'shot' ? '#ffb36b' : pr.kind === 'gale' ? '#e8f4ff' : '#7ad7ff') : pr.kind === 'thorn' ? '#b5e07a' : pr.kind === 'spark' ? '#ffd166' : '#c9a7ff';
    ctx.fillStyle = col;
    const r = pr.kind === 'shot' ? 3 : 2;
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.ellipse(fx, fy - 8, r * 2, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(fx, fy - 8, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  }
  // gravity wells
  for (const wl of g.wells) {
    const [fx, fy] = feet(wl.x, wl.y);
    ctx.strokeStyle = `rgba(167,125,224,${0.4 + 0.3 * Math.sin(g.time * 6)})`;
    ctx.beginPath(); ctx.ellipse(fx, fy, 3.5 * 16 * 0.5, 3.5 * 8 * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // vignette-free darkness at night: none. Reset transform for screen-space overlays
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function nameplate(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  screenSpace(ctx, x, y, (sx, sy) => {
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    const wpx = ctx.measureText(text).width + 12;
    ctx.fillStyle = 'rgba(20,14,30,0.82)';
    roundRect(ctx, sx - wpx / 2, sy - 10, wpx, 18, 5);
    ctx.fill();
    ctx.fillStyle = '#fbf6e9';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, sx, sy - 1);
  });
}

function floatingText(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string): void {
  screenSpace(ctx, x, y, (sx, sy) => {
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(16,10,22,0.85)';
    ctx.strokeText(text, sx, sy);
    ctx.fillStyle = color;
    ctx.fillText(text, sx, sy);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
