// HUD: stat bars, current goal, ability slots, nearby prompt and control hints.
import { ABILITIES, AFF_COLOR, type AbilityId } from '../data/affinities';
import { t } from '../i18n';
import { el } from '../core/util';
import { toast as commonToast } from './common';
import type { Game } from '../game/game';

let hud!: HTMLElement;
let hintsEl!: HTMLElement;
let prompt!: HTMLElement;
let built = false;
let lastGoal = '';
let lastLang = '';
let slotEls: HTMLElement[] = [];
let barEls: Record<'hp' | 'mana' | 'stamina', { fill: HTMLElement; text: HTMLElement }> | null = null;
let goalEl!: HTMLElement;
let zoneEl!: HTMLElement;
let nameEl!: HTMLElement;
let levelEl!: HTMLElement;

export function initHud(): void {
  hud = document.getElementById('hud') as HTMLElement;
  hintsEl = document.getElementById('hints') as HTMLElement;
  prompt = document.getElementById('prompt') as HTMLElement;
}

export function toast(msg: string, kind: 'info' | 'ok' | 'fail' | 'discover', ms: number): void {
  commonToast(msg, kind, ms);
}

export function show(on: boolean): void {
  hud.classList.toggle('hidden', !on);
  hintsEl.classList.toggle('hidden', !on);
  built = false;
}

function build(g: Game): void {
  const mk = (label: string, cls: string) => {
    const fill = el('div', { class: `bar-fill ${cls}` });
    const text = el('span', { class: 'bar-text' });
    return { fill, text, node: el('div', { class: 'bar-row' }, el('span', { class: 'bar-label', text: label }), el('div', { class: 'bar' }, fill, text)) };
  };
  const hp = mk(t('ui.health'), 'hp');
  const mana = mk(t('ui.mana'), 'mana');
  const st = mk(t('ui.stamina'), 'stamina');
  barEls = { hp: { fill: hp.fill, text: hp.text }, mana: { fill: mana.fill, text: mana.text }, stamina: { fill: st.fill, text: st.text } };
  nameEl = el('strong', { class: 'hud-name' });
  levelEl = el('span', { class: 'hud-level' });
  const left = el('section', { class: 'hud-card hud-stats', 'aria-label': t('ui.health') },
    el('div', { class: 'hud-head' }, nameEl, levelEl), hp.node, mana.node, st.node);
  zoneEl = el('span', { class: 'hud-zone' });
  goalEl = el('span', { class: 'hud-goal' });
  const right = el('section', { class: 'hud-card hud-goal-card', 'aria-label': t('ui.quest') },
    el('div', { class: 'hud-zone-row' }, zoneEl),
    el('div', { class: 'hud-goal-label', text: t('ui.quest') }), goalEl);
  slotEls = [];
  const slots = el('section', { class: 'hud-slots', 'aria-label': t('ui.abilities') });
  for (let i = 0; i < 4; i++) {
    const s = el('div', { class: 'slot', 'data-slot': String(i + 1) }, el('kbd', { text: String(i + 1) }), el('span', { class: 'slot-glyph' }), el('span', { class: 'slot-cd' }));
    slotEls.push(s);
    slots.append(s);
  }
  hud.replaceChildren(left, right, slots);
  built = true;
}

export function update(g: Game): void {
  if (!built || lastLang !== document.documentElement.lang) {
    lastLang = document.documentElement.lang;
    build(g);
    lastGoal = '';
    renderHints(g);
  }
  if (!barEls) return;
  const p = g.player;
  const mhp = g.maxHp();
  const mm = g.maxMana();
  const set = (k: 'hp' | 'mana' | 'stamina', v: number, max: number) => {
    const b = barEls![k];
    b.fill.style.width = `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
    b.text.textContent = `${Math.ceil(Math.max(0, v))}/${Math.round(max)}`;
  };
  set('hp', p.hp, mhp);
  set('mana', p.mana, mm);
  set('stamina', p.stamina, 100);
  nameEl.textContent = g.save.name;
  levelEl.textContent = `${t('ui.level')} ${g.save.level}`;
  zoneEl.textContent = t(`zone.${g.currentZone()}`);
  const goal = g.currentGoal();
  const goalText = goal ? `${goal.quest}: ${goal.objective}` : t('ui.noQuest');
  if (goalText !== lastGoal) {
    lastGoal = goalText;
    goalEl.textContent = goalText;
  }
  for (let i = 0; i < 4; i++) {
    const id = g.save.slots[i] as AbilityId | null;
    const s = slotEls[i];
    const glyph = s.querySelector<HTMLElement>('.slot-glyph');
    const cd = s.querySelector<HTMLElement>('.slot-cd');
    if (!id) {
      if (glyph) glyph.textContent = '—';
      if (cd) cd.textContent = '';
      s.title = t('ui.abilities');
      continue;
    }
    const def = ABILITIES[id];
    const aff = Array.isArray(def.aff) ? def.aff[0] : def.aff;
    s.style.setProperty('--aff', AFF_COLOR[aff]);
    if (glyph) glyph.textContent = def.glyph;
    const left = p.cool[id] ?? 0;
    if (cd) cd.textContent = left > 0.05 ? left.toFixed(1) : '';
    s.classList.toggle('cooling', left > 0.05);
    s.classList.toggle('lacking', p.mana < def.cost);
    s.title = `${t(`ability.${id}.name`)} · ${def.cost} Mana`;
  }
  prompt.textContent = g.nearby && g.mode === 'play' ? `${g.nearby} — E` : '';
  prompt.classList.toggle('hidden', !(g.nearby && g.mode === 'play'));
  hintsEl.classList.toggle('hidden', !g.settings.showHints || g.mode !== 'play');
}

function renderHints(g: Game): void {
  const keys: [string, string][] = [
    ['WASD / ←↑↓→', t('keys.move')],
    ['E', t('keys.interact')],
    ['J / Z', t('keys.attack')],
    ['Space / X', t('keys.dodge')],
    ['1–4', t('keys.abilities')],
    ['Tab', t('keys.menu')],
    ['Esc', t('keys.pause')],
  ];
  hintsEl.replaceChildren(
    el('div', { class: 'hint-title', text: t('ui.controlsTitle') }),
    ...keys.map(([k, v]) => el('div', { class: 'hint-row' }, el('kbd', { text: k }), el('span', { text: v }))),
  );
}
