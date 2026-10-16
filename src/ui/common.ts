// Shared DOM helpers: the modal panel with keyboard navigation, and the toast stack.
import { el } from '../core/util';

export interface PanelOpts {
  title: string;
  body: HTMLElement;
  wide?: boolean;
  /** Called when the player closes the panel (Esc or close button). */
  onClose?: () => void;
  /** Panel-specific keys (left/right/numbers). Return true when handled. */
  onKey?: (e: KeyboardEvent) => boolean;
  /** Optional element shown in the header actions (e.g. tabs) */
  header?: HTMLElement;
  /** Panel id for tests and styling */
  id?: string;
}

let panel!: HTMLElement;
let card!: HTMLElement;
let current: PanelOpts | null = null;
let toastRoot!: HTMLElement;

export function initCommon(): void {
  panel = document.getElementById('panel') as HTMLElement;
  card = document.getElementById('card') as HTMLElement;
  toastRoot = document.getElementById('toasts') as HTMLElement;
}

export function isPanelOpen(): boolean {
  return current !== null;
}

export function openPanel(opts: PanelOpts): void {
  current = opts;
  card.className = `card${opts.wide ? ' wide' : ''}`;
  card.dataset.panel = opts.id ?? '';
  const close = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => closePanelByUser() }, '✕');
  const head = el('header', { class: 'card-head' },
    el('h2', { text: opts.title }),
    opts.header ?? null,
    close,
  );
  card.replaceChildren(head, el('div', { class: 'card-body' }, opts.body));
  panel.classList.remove('hidden');
  const first = card.querySelector<HTMLElement>('button:not([disabled]), input, select, textarea');
  window.setTimeout(() => (first ?? card).focus(), 0);
}

export function refreshPanelBody(body: HTMLElement): void {
  const slot = card.querySelector('.card-body');
  if (slot) slot.replaceChildren(body);
}

export function closePanelByUser(): void {
  const opts = current;
  closePanel();
  opts?.onClose?.();
}

export function closePanel(): void {
  current = null;
  panel.classList.add('hidden');
  card.replaceChildren();
}

/** Handles keys while a panel is open. Returns true when the key was consumed. */
export function handlePanelKey(e: KeyboardEvent): boolean {
  if (!current) return false;
  if (current.onKey?.(e)) return true;
  if (e.key === 'Escape') {
    e.preventDefault();
    closePanelByUser();
    return true;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = Array.from(card.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])'))
      .filter((n) => n.offsetParent !== null);
    if (!items.length) return true;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
    items[next].focus();
    return true;
  }
  return false;
}

export function toast(msg: string, kind: 'info' | 'ok' | 'fail' | 'discover' = 'info', ms = 2600): void {
  const node = el('div', { class: `toast ${kind}`, role: 'status' }, msg);
  toastRoot.append(node);
  while (toastRoot.children.length > 4) toastRoot.firstElementChild?.remove();
  window.setTimeout(() => node.remove(), ms);
}

export function btn(label: string, onclick: () => void, cls = ''): HTMLButtonElement {
  return el('button', { type: 'button', class: `btn ${cls}`.trim(), onclick }, label) as HTMLButtonElement;
}

export function bar(pct: number, color: string, label?: string): HTMLElement {
  const fill = el('div', { class: 'bar-fill' });
  fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  fill.style.background = color;
  return el('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': label ?? '' }, fill);
}

export function p(text: string, cls = ''): HTMLParagraphElement {
  return el('p', { class: cls, text });
}
