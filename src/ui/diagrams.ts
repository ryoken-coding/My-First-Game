// Clean, pixel-friendly diagrams drawn on small canvases. Each returns a canvas element.
import { evalBridge, evalFarm, evalTraining } from '../data/challenges';
import { t, tList } from '../i18n';
import { el } from '../core/util';

const W = 360;
const H = 180;

export function diagramCanvas(): HTMLCanvasElement {
  const c = el('canvas', { class: 'diagram', width: W * 2, height: H * 2, role: 'img' }) as HTMLCanvasElement;
  c.style.width = `${W}px`;
  c.style.height = `${H}px`;
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.fillStyle = '#211a2e';
  ctx.fillRect(0, 0, W, H);
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  return ctx;
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color = '#f4ecd8', align: CanvasTextAlign = 'center'): void {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/** Pump schematic. Highlighted parts are the evidence the player inspected (index order matches evidence). */
export function drawPump(c: HTMLCanvasElement, inspected: boolean[]): void {
  const ctx = ctx2d(c);
  const hl = (i: number, x: number, y: number, w: number, h: number) => {
    if (!inspected[i]) return;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
  };
  // reservoir
  ctx.fillStyle = '#2f6f9a';
  ctx.fillRect(20, 60, 70, 90);
  ctx.fillStyle = '#59a7d6';
  ctx.fillRect(20, 60, 70, 20);
  hl(2, 20, 60, 70, 90);
  label(ctx, 55, 160, t('diag.reservoir'), '#cfe9ff');
  // intake pipe + strainer
  ctx.fillStyle = '#7c8794';
  ctx.fillRect(90, 100, 40, 8);
  ctx.fillStyle = '#9aa5b3';
  ctx.fillRect(84, 94, 8, 20);
  hl(4, 82, 92, 12, 24);
  // pump body
  ctx.fillStyle = '#4f7fa8';
  ctx.beginPath(); ctx.arc(170, 104, 26, 0, Math.PI * 2); ctx.fill();
  hl(1, 144, 78, 52, 52);
  label(ctx, 170, 104, 'M', '#fff');
  // check valve on the discharge side
  ctx.fillStyle = '#b5bfca';
  ctx.fillRect(200, 98, 30, 12);
  ctx.fillStyle = '#e05a5a';
  ctx.fillRect(214, 90, 6, 14);
  hl(3, 196, 86, 40, 26);
  // outlet pipe and gauge
  ctx.fillStyle = '#7c8794';
  ctx.fillRect(230, 100, 80, 8);
  ctx.fillStyle = '#e8f0f7';
  ctx.beginPath(); ctx.arc(270, 70, 16, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(270, 70); ctx.lineTo(282, 62); ctx.stroke();
  hl(0, 254, 54, 32, 32);
  label(ctx, 270, 94, t('diag.gauge'), '#cfe9ff');
  // flow arrow
  ctx.strokeStyle = '#7ef0ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(250, 140); ctx.lineTo(300, 140); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(300, 140); ctx.lineTo(292, 134); ctx.moveTo(300, 140); ctx.lineTo(292, 146); ctx.stroke();
  label(ctx, 275, 156, t('diag.flow'), '#7ef0ff');
}

/** Bridge: deck, piers and a bending gauge. */
export function drawBridge(c: HTMLCanvasElement, v: Record<string, number>): void {
  const ctx = ctx2d(c);
  const r = evalBridge(v);
  const x0 = 30;
  const x1 = 330;
  const deckY = 100;
  // water and cliffs
  ctx.fillStyle = '#1f4f7a';
  ctx.fillRect(0, 140, W, 40);
  ctx.fillStyle = '#5a4a3c';
  ctx.fillRect(0, 60, 22, 80);
  ctx.fillRect(W - 22, 60, 22, 80);
  // piers
  for (let i = 1; i <= v.piers; i++) {
    const px = x0 + ((x1 - x0) * i) / (v.piers + 1);
    ctx.fillStyle = '#8c939c';
    ctx.fillRect(px - 5, deckY, 10, 40);
  }
  // deck (depth shown as thickness)
  const th = 4 + v.depth * 0.9;
  ctx.fillStyle = r.pass ? '#7bcf5b' : v.material === 1 ? '#aab3bd' : '#a7743f';
  ctx.fillRect(x0, deckY - th, x1 - x0, th);
  if (v.truss) {
    ctx.strokeStyle = '#f0d060'; ctx.lineWidth = 1;
    for (let x = x0; x < x1; x += 14) {
      ctx.beginPath(); ctx.moveTo(x, deckY - th); ctx.lineTo(x + 7, deckY - th - 10); ctx.lineTo(x + 14, deckY - th); ctx.stroke();
    }
  }
  // load cart
  ctx.fillStyle = '#e0883a';
  ctx.fillRect(170, deckY - th - 10, 26, 10);
  // safety factor gauge
  const sf = Math.min(3, r.sf);
  ctx.fillStyle = '#2b2440';
  ctx.fillRect(40, 16, 280, 12);
  ctx.fillStyle = r.sf >= 1.5 ? '#68d391' : '#ff6b6b';
  ctx.fillRect(40, 16, (280 * sf) / 3, 12);
  ctx.fillStyle = '#f4ecd8';
  ctx.fillRect(40 + (280 * 1.5) / 3 - 1, 12, 2, 20);
  label(ctx, 180, 40, `${tList('ch.bridge.s0.metrics')[3]}: ${r.sf.toFixed(2)}`, '#f4ecd8');
}

/** Farm: soil-moisture band vs. actual moisture. */
export function drawFarm(c: HTMLCanvasElement, v: Record<string, number>): void {
  const ctx = ctx2d(c);
  const r = evalFarm(v);
  const x = 40;
  const w = 280;
  ctx.fillStyle = '#2b2440';
  ctx.fillRect(x, 60, w, 20);
  ctx.fillStyle = 'rgba(104,211,145,0.55)';
  ctx.fillRect(x + (w * r.band[0]) / 100, 60, (w * (r.band[1] - r.band[0])) / 100, 20);
  ctx.fillStyle = '#4fb3e8';
  ctx.fillRect(x, 96, (w * r.moisture) / 100, 14);
  ctx.fillStyle = '#f4ecd8';
  ctx.fillRect(x + (w * r.moisture) / 100 - 2, 56, 4, 28);
  label(ctx, x, 42, tList('ch.farm.s0.metrics')[0], '#f4ecd8', 'left');
  label(ctx, x, 128, `${Math.round(r.moisture)}%  ·  ${tList('ch.farm.s0.metrics')[1]}: ${Math.round(r.health)}%`, '#cfe9ff', 'left');
  // roots drawing: healthy roots are plump, stressed ones thin
  ctx.strokeStyle = r.health >= 80 ? '#a7e08a' : '#c99a6a';
  ctx.lineWidth = r.health >= 80 ? 3 : 1.2;
  for (let i = 0; i < 7; i++) {
    const rx = 60 + i * 40;
    ctx.beginPath(); ctx.moveTo(rx, 160); ctx.quadraticCurveTo(rx + 6, 170, rx - 4, 178); ctx.stroke();
  }
}

/** Training: weekly load bars over four weeks, against the recovery capacity line. */
export function drawTraining(c: HTMLCanvasElement, v: Record<string, number>): void {
  const ctx = ctx2d(c);
  const r = evalTraining(v);
  const max = Math.max(40, ...r.loads);
  for (let i = 0; i < 4; i++) {
    const h = (r.loads[i] / max) * 120;
    const x = 60 + i * 70;
    ctx.fillStyle = r.loads[i] > 40 ? '#ff6b6b' : '#7bcf5b';
    ctx.fillRect(x, 150 - h, 40, h);
    label(ctx, x + 20, 162, `${t('diag.week')} ${i + 1}`, '#f4ecd8');
  }
  const capY = 150 - (40 / max) * 120;
  ctx.strokeStyle = '#ffd166';
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(40, capY); ctx.lineTo(330, capY); ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, 300, capY - 8, t('diag.capacity'), '#ffd166');
  ctx.fillStyle = '#2b2440';
  ctx.fillRect(40, 14, 280, 10);
  ctx.fillStyle = r.gain >= 60 ? '#68d391' : '#e0a24a';
  ctx.fillRect(40, 14, 280 * Math.min(1, r.gain / 100), 10);
  ctx.fillStyle = '#2b2440';
  ctx.fillRect(40, 30, 280, 10);
  ctx.fillStyle = r.risk <= 30 ? '#68d391' : '#ff6b6b';
  ctx.fillRect(40, 30, 280 * Math.min(1, r.risk / 100), 10);
}

/** Chip layers and the broken track used in the fault-diagnosis stage. */
export function drawChip(c: HTMLCanvasElement, broken: boolean): void {
  const ctx = ctx2d(c);
  ctx.fillStyle = '#4a6b8a';
  ctx.fillRect(60, 110, 240, 40);
  ctx.fillStyle = '#7f8a8f';
  ctx.fillRect(60, 100, 240, 10);
  // in / out pads
  ctx.fillStyle = '#e0883a';
  ctx.fillRect(40, 118, 24, 24);
  ctx.fillRect(296, 118, 24, 24);
  // track
  ctx.fillStyle = '#d88a4a';
  ctx.fillRect(64, 124, 110, 6);
  if (broken) {
    ctx.fillStyle = '#211a2e';
    ctx.fillRect(170, 122, 14, 10);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(176, 128, 2, 2);
  } else ctx.fillRect(170, 124, 110, 6);
  label(ctx, 52, 150, t('diag.in'), '#f4ecd8');
  label(ctx, 308, 150, t('diag.out'), '#f4ecd8');
  label(ctx, 180, 40, t('diag.chipLayers'), '#cfe9ff');
}

/** Lantern state machine: three lamps, the active state glows. */
export function drawLantern(c: HTMLCanvasElement, state: number, stuck: boolean): void {
  const ctx = ctx2d(c);
  const cols = ['#ff6b6b', '#68d391', '#ffd166'];
  cols.forEach((col, i) => {
    ctx.globalAlpha = i === state ? 1 : 0.2;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(90 + i * 90, 90, 26, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });
  label(ctx, 180, 150, stuck ? t('diag.lanternStuck') : t('diag.lanternCycle'), stuck ? '#ff9ad5' : '#cfe9ff');
}

export const DIAGRAM_SIZE = { W, H };
