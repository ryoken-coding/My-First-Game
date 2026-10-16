// Full-screen flows: title, character creation (affinity roll), pause, settings, how-to and credits.
import { AFFS, AFF_COLOR } from '../data/affinities';
import { L, setLang, LANGUAGES, type LangCode } from '../i18n';
import { el } from '../core/util';
import { rollAffinities, normalizeTo100 } from '../core/rng';
import { readSave, TEXT_SCALES, eraseSave } from '../core/settings';
import { openPanel, closePanel, btn, bar, p } from './common';
import * as HUD from './hud';
import type { Game } from '../game/game';
import type { SaveData } from '../game/types';

let G: Game;
let screen: 'title' | 'create' | 'pause' | 'settings' | 'howto' | 'credits' | 'none' = 'none';

export function bindScreens(g: Game): void {
  G = g;
}

/** Applies display settings (text size, contrast, motion) to the document. */
export function applyDisplay(): void {
  const s = G.settings;
  const root = document.documentElement;
  root.style.setProperty('--ui-scale', String(TEXT_SCALES[s.textScale] ?? 1));
  root.classList.toggle('high-contrast', s.highContrast);
  root.classList.toggle('reduced-motion', s.reducedMotion);
  root.lang = s.lang === 'zh' ? 'zh-Hans' : s.lang;
  document.title = L().meta.title;
}

export function hideAll(): void {
  screen = 'none';
  closePanel();
}

function show(title: string, body: HTMLElement, id: string, onClose?: () => void, wide = false): void {
  openPanel({ title, body, id, wide, onClose });
}

function rebuild(): void {
  // Re-render the current full-screen flow after a language change.
  if (screen === 'title') showTitle();
  else if (screen === 'pause') openPause();
  else if (screen === 'settings') showSettings();
  else if (screen === 'howto') showHowTo();
  else if (screen === 'credits') showCredits();
}

// ---------- title ----------
export function showTitle(): void {
  screen = 'title';
  G.mode = 'title';
  HUD.show(false);
  const save = readSave<SaveData>();
  const hasSave = !!save && save.v === 2;
  const body = el('div', { class: 'title' });
  body.append(
    el('div', { class: 'logo', 'aria-hidden': 'true' }, el('span', { text: L().meta.title }), el('small', { text: L().meta.tagline })),
    el('p', { class: 'muted', text: hasSave ? L().title.saveFound : L().title.noSave }),
    el('div', { class: 'menu-col' },
      btn(L().title.newGame, () => showCreate(), 'primary big'),
      hasSave ? btn(L().title.continue, () => { if (!G.continueSaved()) G.toast(L().errors.generic, 'fail'); }, 'big') : null,
      btn(L().title.howTo, () => showHowTo(), ''),
      btn(L().title.settings, () => showSettings(), ''),
      btn(L().credits.title, () => showCredits(), ''),
      hasSave ? btn(L().title.erase, () => { if (window.confirm(L().title.eraseConfirm)) { eraseSave(); showTitle(); } }, 'danger') : null,
    ),
    el('p', { class: 'disclaimer', text: L().title.disclaimer }),
    el('p', { class: 'muted small-text', text: L().title.version }),
  );
  show(L().meta.title, body, 'title', () => showTitle(), true);
}

// ---------- character creation ----------
interface CreateState { name: string; pcts: number[]; manual: boolean; roll: number }
let cs: CreateState | null = null;

export function showCreate(): void {
  screen = 'create';
  if (!cs) cs = { name: '', pcts: rollAffinities(), manual: false, roll: 1 };
  renderCreate();
}

function renderCreate(): void {
  if (!cs) return;
  const C = L().create;
  const body = el('div', { class: 'create' });
  const nameInput = el('input', { type: 'text', class: 'text-input', placeholder: C.namePlaceholder, value: cs.name, maxlength: 24, 'aria-label': C.name, id: 'name-input' }) as HTMLInputElement;
  nameInput.addEventListener('input', () => { cs!.name = nameInput.value; });
  body.append(el('label', { class: 'field' }, el('span', { text: C.name }), nameInput));

  body.append(el('h3', { text: C.rollTitle }), p(C.rollExplain, 'muted'));
  const grid = el('div', { class: 'aff-grid' });
  if (!cs.manual) {
    AFFS.forEach((a, i) => {
      grid.append(el('div', { class: 'aff-card' },
        el('div', { class: 'aff-head' }, el('strong', { text: L().aff[a].name }), el('span', { text: `${cs!.pcts[i]}%` })),
        bar(cs!.pcts[i], AFF_COLOR[a], L().aff[a].name),
        el('p', { class: 'muted small-text', text: L().aff[a].desc }),
      ));
    });
    body.append(grid);
    body.append(el('div', { class: 'row' }, btn(C.reroll, () => { cs!.pcts = rollAffinities(); cs!.roll += 1; renderCreate(); }, '')));
  } else {
    body.append(el('h4', { text: C.manualTitle }));
    const vals = [...cs.pcts];
    const total = el('p', { role: 'status' });
    const update = () => {
      const sum = vals.reduce((x, y) => x + y, 0);
      total.textContent = `${C.total}: ${sum}% — ${sum === 100 ? C.sumOk : C.sumBad}`;
      cs!.pcts = [...vals];
      const beginBtn = document.getElementById('begin-btn') as HTMLButtonElement | null;
      if (beginBtn) beginBtn.disabled = sum !== 100 || !cs!.name.trim();
    };
    AFFS.forEach((a, i) => {
      const input = el('input', { type: 'range', min: 0, max: 100, step: 1, value: vals[i], 'aria-label': L().aff[a].name }) as HTMLInputElement;
      const out = el('output', { text: String(vals[i]) });
      input.addEventListener('input', () => { vals[i] = Number(input.value); out.textContent = input.value; update(); });
      grid.append(el('label', { class: 'range-row' }, el('span', { text: L().aff[a].name }), input, out));
    });
    body.append(grid, total);
    body.append(el('div', { class: 'row' }, btn(C.random, () => { cs!.pcts = rollAffinities(); cs!.manual = false; renderCreate(); }, '')));
    queueMicrotask(update);
  }

  const lockedAtelier = !(G.settings.atelierMock);
  const gate = el('div', { class: 'gate' });
  gate.append(el('h4', { text: L().ui.gamepassTitle }), p(L().ui.gamepassNote, 'muted small-text'));
  if (cs.manual) {
    gate.append(p(C.manual, 'muted'));
  } else if (lockedAtelier) {
    gate.append(p(C.manualLocked, 'muted small-text'));
    gate.append(btn(C.mockUnlock, () => {
      G.setSettings({ atelierMock: true });
      G.toast(L().ui.mockPurchase, 'info', 3600);
      renderCreate();
    }, 'small'));
  } else {
    gate.append(btn(C.manual, () => { cs!.manual = true; renderCreate(); }, 'small'));
  }
  gate.append(p(C.mockNote, 'muted small-text'));
  body.append(gate);

  body.append(el('div', { class: 'build-preview' },
    el('h4', { text: C.buildTitle }),
    p(C.buildPhysical, 'small-text'),
    p(C.buildMagic, 'small-text'),
  ));

  const nameOk = cs.name.trim().length > 0;
  const sumOk = cs.pcts.reduce((x, y) => x + y, 0) === 100;
  const begin = btn(C.begin, () => {
    if (!cs) return;
    const pcts = normalizeTo100(cs.pcts);
    G.startNew(cs.name.trim(), pcts, cs.manual);
    cs = null;
  }, 'primary big');
  begin.id = 'begin-btn';
  begin.disabled = !(nameOk && sumOk);
  body.append(el('div', { class: 'row end' }, btn(L().common.back, () => { cs = null; showTitle(); }, ''), begin));
  if (!nameOk) body.append(p(C.namePlaceholder, 'muted small-text'));
  show(C.title, body, 'create', () => { cs = null; showTitle(); }, true);
  // Enable the begin button as the name changes without rebuilding the form.
  nameInput.addEventListener('input', () => {
    if (begin) begin.disabled = !(nameInput.value.trim().length > 0 && cs!.pcts.reduce((x, y) => x + y, 0) === 100);
  });
  queueMicrotask(() => nameInput.focus());
}

// ---------- pause ----------
export function openPause(): void {
  screen = 'pause';
  G.mode = 'pause';
  const body = el('div', { class: 'pause' });
  const resume = () => { closePanel(); resumePlay(); };
  body.append(
    el('div', { class: 'menu-col' },
      btn(L().ui.resume, resume, 'primary big'),
      btn(L().ui.charSheet, () => { closePanel(); G.openMenuTab('character'); }, ''),
      btn(L().ui.journal, () => { closePanel(); G.openMenuTab('journal'); }, ''),
      btn(L().ui.quests, () => { closePanel(); G.openMenuTab('quests'); }, ''),
      btn(L().ui.settings, () => showSettings(), ''),
      btn(L().ui.controlsTitle, () => showHowTo(), ''),
      btn(L().screen.quit, () => {
        G.persist();
        G.toast(L().ui.saved, 'ok');
        showTitle();
      }, ''),
    ),
  );
  show(L().ui.pauseMenu, body, 'pause', () => resumePlay());
}

// ---------- settings ----------
export function showSettings(): void {
  const from = returnTarget();
  screen = 'settings';
  const s = G.settings;
  const body = el('div', { class: 'settings' });
  const row = (label: string, control: HTMLElement) => el('div', { class: 'setting-row' }, el('span', { text: label }), control);

  const lang = el('select', { 'aria-label': L().settings.language }) as HTMLSelectElement;
  for (const l of LANGUAGES) lang.append(el('option', { value: l.code, text: l.name }));
  lang.value = s.lang;
  lang.addEventListener('change', () => {
    const code = lang.value as LangCode;
    setLang(code);
    G.setSettings({ lang: code });
    applyDisplay();
    G.toast(L().ui.languageChanged, 'ok');
    rebuild();
  });
  body.append(row(L().settings.language, lang));

  const scale = el('select', { 'aria-label': L().settings.textSize }) as HTMLSelectElement;
  L().settings.textSizes.forEach((name, i) => scale.append(el('option', { value: String(i), text: name })));
  scale.value = String(s.textScale);
  scale.addEventListener('change', () => { G.setSettings({ textScale: Number(scale.value) }); applyDisplay(); });
  body.append(row(L().settings.textSize, scale));

  const toggle = (label: string, value: boolean, onchange: (v: boolean) => void, hint?: string) => {
    const input = el('input', { type: 'checkbox', 'aria-label': label }) as HTMLInputElement;
    input.checked = value;
    input.addEventListener('change', () => { onchange(input.checked); applyDisplay(); });
    return el('label', { class: 'switch' }, input, el('span', { text: value ? L().common.on : L().common.off }), hint ? el('small', { class: 'muted', text: hint }) : null);
  };
  body.append(row(L().settings.reducedMotion, toggle(L().settings.reducedMotion, s.reducedMotion, (v) => G.setSettings({ reducedMotion: v }), L().settings.reducedMotionHint)));
  body.append(row(L().settings.mute, toggle(L().settings.mute, s.muted, (v) => { G.setSettings({ muted: v }); G.toast(v ? L().ui.muted : L().ui.unmuted, 'info', 1200); })));

  const vol = el('input', { type: 'range', min: 0, max: 100, step: 5, value: s.volume, 'aria-label': L().settings.volume }) as HTMLInputElement;
  vol.addEventListener('change', () => { G.setSettings({ volume: Number(vol.value) }); G.audio.play('ui'); });
  body.append(row(L().settings.volume, vol));

  const zoom = el('select', { 'aria-label': L().settings.mapZoom }) as HTMLSelectElement;
  ([2, 3] as const).forEach((v, i) => zoom.append(el('option', { value: String(v), text: L().settings.zoomNames[i] })));
  zoom.value = String(s.zoom);
  zoom.addEventListener('change', () => G.setSettings({ zoom: Number(zoom.value) }));
  body.append(row(L().settings.mapZoom, zoom));

  body.append(row(L().settings.showHints, toggle(L().settings.showHints, s.showHints, (v) => G.setSettings({ showHints: v }))));
  body.append(row(L().settings.highContrast, toggle(L().settings.highContrast, s.highContrast, (v) => G.setSettings({ highContrast: v }))));

  body.append(el('div', { class: 'row end' },
    btn(L().settings.resetAll, () => {
      G.setSettings({ textScale: 1, reducedMotion: false, muted: false, volume: 60, zoom: 2, showHints: true, highContrast: false });
      applyDisplay();
      showSettings();
    }, 'small'),
    btn(L().common.back, () => goBack(from), 'primary'),
  ));
  show(L().settings.title, body, 'settings', () => goBack(from));
}

// ---------- how to / controls ----------
export function showHowTo(): void {
  screen = 'howto';
  const from = returnTarget();
  const K = L().keys;
  const rows: [string, string][] = [
    [K.move, 'W A S D / ← ↑ → ↓'],
    [K.interact, 'E / Enter'],
    [K.attack, 'J / Z'],
    [K.dodge, 'Space / X'],
    [K.abilities, '1 2 3 4'],
    [K.menu, 'Tab / N (journal) · C · K · I · Q'],
    [K.pause, 'Esc'],
    [K.navigate, '↑ ↓ / Tab'],
    [K.select, 'Enter / Space'],
    [K.numbers, '1 – 9'],
    [K.hintKey, 'Hint button'],
    [K.back, 'Esc'],
  ];
  const body = el('div', { class: 'howto' });
  body.append(p(L().howto.p1), p(L().howto.p2), p(L().howto.p3), p(L().howto.p4));
  body.append(el('h3', { text: L().ui.controlsTitle }));
  body.append(el('dl', { class: 'keys' }, ...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])));
  body.append(el('div', { class: 'row end' }, btn(L().common.back, () => goBack(from), 'primary')));
  show(L().howto.title, body, 'howto', () => goBack(from), true);
}

export function showCredits(): void {
  screen = 'credits';
  const body = el('div', { class: 'credits' });
  body.append(p(L().credits.body));
  body.append(el('div', { class: 'row end' }, btn(L().common.back, () => showTitle(), 'primary')));
  show(L().credits.title, body, 'credits', () => showTitle(), false);
}

function resumePlay(): void {
  screen = 'none';
  G.mode = 'play';
  G.persist();
}

/** Where Back/Esc from a sub-screen should go: the pause menu when opened from it, otherwise the title. */
function returnTarget(): 'pause' | 'title' {
  return G.mode === 'pause' ? 'pause' : 'title';
}

function goBack(to: 'pause' | 'title'): void {
  if (to === 'pause') openPause();
  else showTitle();
}
