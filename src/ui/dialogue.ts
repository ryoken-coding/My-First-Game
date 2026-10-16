// Dialogue box at the bottom of the screen. E / Enter / Space advance; Esc skips the rest.
import { el } from '../core/util';
import { t } from '../i18n';

let box!: HTMLElement;
let lines: string[] = [];
let index = 0;
let speaker = '';
let onEnd: (() => void) | null = null;
let textEl!: HTMLElement;
let nameEl!: HTMLElement;
let hintEl!: HTMLElement;

export function initDialogue(): void {
  box = document.getElementById('dialogue') as HTMLElement;
}

export function open(list: string[], who: string, end: () => void): void {
  lines = list.length ? list : ['…'];
  index = 0;
  speaker = who;
  onEnd = end;
  nameEl = el('div', { class: 'dlg-name' });
  textEl = el('p', { class: 'dlg-text' });
  hintEl = el('div', { class: 'dlg-hint' });
  box.replaceChildren(
    el('div', { class: 'dlg-frame' }, nameEl, textEl, hintEl),
  );
  box.classList.remove('hidden');
  render();
}

function render(): void {
  nameEl.textContent = speaker;
  const full = lines[index];
  textEl.textContent = full;
  hintEl.textContent = index < lines.length - 1 ? `${t('common.next')} ▸` : `${t('common.continue')} ▸`;
}

/** Advances to the next line, or ends the conversation. */
export function advance(skip = false): void {
  if (!box || box.classList.contains('hidden')) return;
  if (skip || index >= lines.length - 1) {
    close();
    return;
  }
  index += 1;
  render();
}

function close(): void {
  box.classList.add('hidden');
  const cb = onEnd;
  onEnd = null;
  cb?.();
}

export function isOpen(): boolean {
  return !!box && !box.classList.contains('hidden');
}
