// Entry point: boots the locale, settings, UI and the canvas game loop.
import { setLang } from './i18n';
import { Game } from './game/game';
import { initCommon, handlePanelKey, isPanelOpen } from './ui/common';
import { initHud } from './ui/hud';
import { initDialogue } from './ui/dialogue';
import { bindChallenges } from './ui/challenge';
import { bindMenu } from './ui/menu';
import { bindScreens, applyDisplay, showTitle } from './ui/screens';

initCommon();
initHud();
initDialogue();

const game = new Game();
setLang(game.settings.lang);
bindMenu(game);
bindChallenges(game);
bindScreens(game);
applyDisplay();

const canvas = document.getElementById('world') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
let cssW = 1;
let cssH = 1;

function resize(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cssW = window.innerWidth;
  cssH = window.innerHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === 'text' || target instanceof HTMLTextAreaElement;
}

window.addEventListener('keydown', (e) => {
  if (isPanelOpen()) {
    if (isTyping(e.target) && e.key !== 'Escape') return;
    if (handlePanelKey(e)) return;
    if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
    return;
  }
  game.onKeyDown(e);
});
window.addEventListener('keyup', (e) => game.onKeyUp(e));
window.addEventListener('blur', () => game.keys.clear());

// Show the title screen over a live backdrop of the village.
game.previewWorld();
showTitle();
// Exposed for debugging from the browser console.
(window as unknown as { ley: Game }).ley = game;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1b1530';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(Math.min(2, window.devicePixelRatio || 1), 0, 0, Math.min(2, window.devicePixelRatio || 1), 0, 0);
  game.draw(ctx, cssW, cssH);
  window.requestAnimationFrame(frame);
}
window.requestAnimationFrame(frame);
