// The tabbed menu: character, skills, inventory, quests and journal. Every tab is keyboard-operable.
import { AFFS, AFF_COLOR, ABILITIES, ABILITY_IDS, COMBO_THRESHOLD, masteryLevel, potency, type AbilityId } from '../data/affinities';
import { CHALLENGES, SKILLS, type SkillId } from '../data/challenges';
import { QUESTS } from '../data/content';
import { L, t } from '../i18n';
import { el } from '../core/util';
import { effStrength } from '../game/combat';
import { openPanel, closePanel, refreshPanelBody, btn, bar, p } from './common';
import type { Game } from '../game/game';
import { normalizeTo100 } from '../core/rng';

let G: Game;
export function bindMenu(g: Game): void {
  G = g;
}

export const TABS = ['character', 'skills', 'inventory', 'quests', 'journal'] as const;
export type Tab = (typeof TABS)[number];
const HOTKEYS: Record<string, Tab> = { c: 'character', k: 'skills', i: 'inventory', q: 'quests', n: 'journal' };
const HEAL_ITEMS = ['bread', 'herbs', 'salt_pork'];

let current: Tab = 'character';

export function open(tab: string): void {
  current = (TABS as readonly string[]).includes(tab) ? (tab as Tab) : 'character';
  const header = el('nav', { class: 'tabs', role: 'tablist', 'aria-label': t('ui.menuTab') });
  for (const id of TABS) {
    const b = el('button', {
      type: 'button', role: 'tab', class: `tab${id === current ? ' on' : ''}`,
      'aria-selected': id === current ? 'true' : 'false',
      onclick: () => open(id),
    }, tabLabel(id)) as HTMLButtonElement;
    header.append(b);
  }
  openPanel({
    title: tabLabel(current),
    body: el('div', { class: 'menu-body' }),
    wide: true,
    id: `menu-${current}`,
    header,
    onClose: () => G.closeMenu(),
    onKey: (e) => {
      if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (e.target instanceof HTMLInputElement && e.target.type === 'range') return false;
        e.preventDefault();
        const i = TABS.indexOf(current);
        const dir = e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1;
        open(TABS[(i + dir + TABS.length) % TABS.length]);
        return true;
      }
      const tab = HOTKEYS[e.key.toLowerCase()];
      if (tab && !(e.target instanceof HTMLInputElement && e.target.type === 'text')) {
        e.preventDefault();
        open(tab);
        return true;
      }
      return false;
    },
  });
  render();
}

export function close(): void {
  closePanel();
}

function tabLabel(id: Tab): string {
  return ({ character: t('ui.charSheet'), skills: t('ui.skills'), inventory: t('ui.inventory'), quests: t('ui.quests'), journal: t('ui.journal') } as Record<Tab, string>)[id];
}

function render(): void {
  const body = el('div', { class: 'menu-body' });
  switch (current) {
    case 'character': body.append(characterTab()); break;
    case 'skills': body.append(skillsTab()); break;
    case 'inventory': body.append(inventoryTab()); break;
    case 'quests': body.append(questsTab()); break;
    case 'journal': body.append(journalTab()); break;
  }
  refreshPanelBody(body);
}

// ---------- character ----------
function characterTab(): HTMLElement {
  const s = G.save;
  const left = el('section', { class: 'col' });
  const xpNeed = 40 * s.level;
  left.append(
    el('h3', { text: `${s.name} · ${t('common.level')} ${s.level}` }),
    el('p', { class: 'muted', text: `${t('stat.xp')}: ${s.xp}/${xpNeed}` }),
    bar((s.xp / xpNeed) * 100, '#f0b957', t('stat.xp')),
    el('p', { text: `${t('stat.points')}: ${s.points}` }),
  );
  const statsList = el('div', { class: 'stats' });
  const statRows: ['str' | 'vit' | 'agi' | 'mind', string][] = [['str', 'stat.strDesc'], ['vit', 'stat.vitDesc'], ['agi', 'stat.agiDesc'], ['mind', 'stat.mindDesc']];
  for (const [k, desc] of statRows) {
    statsList.append(el('div', { class: 'stat-row' },
      el('span', { class: 'stat-name', text: `${t(`stat.${k}`)} ${s.stats[k]}` }),
      el('span', { class: 'muted', text: t(desc) }),
      btn(t('stat.spend'), () => { G.spendPoint(k); render(); }, 'small'),
    ));
  }
  left.append(statsList);
  left.append(el('ul', { class: 'derived' },
    el('li', { text: `${t('stat.hp')}: ${Math.round(G.player.hp)}/${G.maxHp()}` }),
    el('li', { text: `${t('stat.mana')}: ${Math.round(G.player.mana)}/${Math.round(G.maxMana())}` }),
    el('li', { text: `${t('stat.strEff')}: ${effStrength(G).toFixed(0)} · ${t('stat.strCap')}` }),
  ));
  if (G.player.ironT > 0) left.append(p(t('stat.enhBonus'), 'ok-text'));

  const right = el('section', { class: 'col' });
  right.append(el('h3', { text: t('create.rollTitle') }));
  const masteries = AFFS.map((_, i) => masteryLevel(s.affXp[i]));
  AFFS.forEach((a, i) => {
    right.append(el('div', { class: 'aff-row' },
      el('div', { class: 'aff-head' },
        el('strong', { text: t(`aff.${a}.name`) }),
        el('span', { text: `${s.pcts[i]}%` }),
        el('span', { class: 'muted', text: `${t('aff.mastery')} ${masteries[i]} · ${t('aff.potency')} ${potency(s.pcts[i], masteries[i]).toFixed(2)}` }),
      ),
      bar(s.pcts[i], AFF_COLOR[a], t(`aff.${a}.name`)),
      el('p', { class: 'muted small-text', text: t(`aff.${a}.desc`) }),
    ));
  });
  right.append(p(`${t('aff.meaning')}: 100%`, 'muted'));
  if (s.atelier || s.manual) right.append(attuneBlock());

  const abil = el('section', { class: 'col wide-col' });
  abil.append(el('h3', { text: t('ui.charSheet') + ' · ' + t('ability.slot') }));
  const slotRow = el('div', { class: 'slots' });
  s.slots.forEach((id, i) => {
    const sel = el('select', { 'aria-label': `${t('ability.slot')} ${i + 1}` }) as HTMLSelectElement;
    sel.append(el('option', { value: '', text: t('ability.empty') }));
    for (const a of ABILITY_IDS) {
      if (!G.abilityUnlocked(a)) continue;
      const o = el('option', { value: a, text: t(`ability.${a}.name`) }) as HTMLOptionElement;
      if (a === id) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener('change', () => {
      s.slots[i] = (sel.value || null) as AbilityId | null;
      G.audio.play('ui');
      render();
    });
    slotRow.append(el('label', { class: 'slot' }, el('span', { text: `${i + 1}` }), sel));
  });
  abil.append(slotRow);
  const list = el('ul', { class: 'ability-list' });
  for (const a of ABILITY_IDS) {
    const def = ABILITIES[a];
    const unlocked = G.abilityUnlocked(a);
    const combo = Array.isArray(def.aff);
    let note = '';
    if (!unlocked) {
      note = combo ? t('ability.comboHidden') : t('ability.locked', { level: def.mastery });
    }
    list.append(el('li', { class: unlocked ? 'ab on' : 'ab off' },
      el('strong', { text: `${def.glyph} · ${t(`ability.${a}.name`)}` }),
      el('span', { class: 'muted', text: ` ${combo ? t('ability.advanced') : t('ability.basic')} · ${def.cost} ${t('stat.mana')} · ${def.cooldown}s` }),
      el('p', { text: unlocked ? t(`ability.${a}.desc`) : note }),
    ));
  }
  abil.append(list, p(`${t('ability.comboHidden')} (${COMBO_THRESHOLD}%)`, 'muted small-text'));
  return el('div', { class: 'grid-3' }, left, right, abil);
}

function attuneBlock(): HTMLElement {
  const s = G.save;
  const box = el('div', { class: 'attune' });
  box.append(el('h4', { text: t('screen.attuneTitle') }), p(t('screen.attuneNote'), 'muted small-text'));
  const vals = [...s.pcts];
  const sum = el('p', { class: 'muted', role: 'status' });
  const apply = el('button', { type: 'button', class: 'btn primary small' }, t('common.save')) as HTMLButtonElement;
  const refresh = () => {
    const total = vals.reduce((a, b) => a + b, 0);
    sum.textContent = `${t('create.total')}: ${total}% — ${total === 100 ? t('create.sumOk') : t('create.sumBad')}`;
    apply.disabled = total !== 100;
  };
  AFFS.forEach((a, i) => {
    const input = el('input', { type: 'range', min: 0, max: 100, step: 1, value: vals[i], 'aria-label': t(`aff.${a}.name`) }) as HTMLInputElement;
    const out = el('output', { text: String(vals[i]) });
    input.addEventListener('input', () => {
      vals[i] = Number(input.value);
      out.textContent = input.value;
      refresh();
    });
    box.append(el('label', { class: 'range-row' }, el('span', { text: t(`aff.${a}.name`) }), input, out));
  });
  apply.addEventListener('click', () => {
    s.pcts = normalizeTo100(vals);
    G.toast(t('ui.saved'), 'ok');
    render();
  });
  refresh();
  box.append(sum, apply);
  return box;
}

// ---------- skills ----------
function skillsTab(): HTMLElement {
  const list = el('ul', { class: 'skill-list' });
  for (const sk of SKILLS as SkillId[]) {
    const lvl = G.skillLevel(sk);
    const xp = G.save.skillXp[sk] ?? 0;
    list.append(el('li', { class: 'skill' },
      el('div', { class: 'skill-head' }, el('strong', { text: t(`skill.${sk}`) }), el('span', { text: `${t('skill.level')} ${lvl}` })),
      bar(lvl >= 10 ? 100 : ((xp % 40) / 40) * 100, '#7bcf5b', t(`skill.${sk}`)),
      el('p', { class: 'muted small-text', text: `${t('skill.xp')}: ${xp}` }),
    ));
  }
  return el('div', {}, list);
}

// ---------- inventory ----------
function inventoryTab(): HTMLElement {
  const entries = Object.entries(G.save.inv).filter(([, n]) => n > 0);
  if (!entries.length) return p(t('ui.noItems'), 'muted');
  const list = el('ul', { class: 'inv-list' });
  for (const [item, n] of entries) {
    const row = el('li', { class: 'inv-row' },
      el('div', { class: 'inv-info' },
        el('strong', { text: `${t(`item.${item}.name`)} ×${n}` }),
        el('p', { class: 'muted small-text', text: t(`item.${item}.desc`) })),
    );
    if (HEAL_ITEMS.includes(item)) {
      row.append(btn(t('ui.useItem'), () => { G.useItem(item); render(); }, 'small'));
    }
    list.append(row);
  }
  return list;
}

// ---------- quests ----------
function questsTab(): HTMLElement {
  const wrap = el('div', { class: 'quest-list' });
  for (const q of QUESTS) {
    const done = G.save.questsDone.includes(q.id);
    const started = q.start.every((c) => G.check(c));
    const status = done ? t('ui.completed') : started ? t('ui.active') : t('ui.locked');
    if (!started && !done) continue;
    const items = q.objectives.map((o) => {
      const ok = o.done.every((c) => G.check(c));
      return el('li', { class: ok ? 'ok-text' : '' }, `${ok ? '✓ ' : '• '}${t(`qobj.${o.id}`)}`);
    });
    wrap.append(el('article', { class: `quest ${done ? 'done' : 'active'}` },
      el('header', {}, el('strong', { text: t(`quest.${q.id}.name`) }), el('span', { class: 'tag', text: status })),
      el('p', { text: t(`quest.${q.id}.desc`) }),
      el('h4', { text: t('ui.objectives') }),
      el('ul', {}, ...items),
    ));
  }
  if (!wrap.children.length) wrap.append(p(t('ui.emptyList'), 'muted'));
  return wrap;
}

// ---------- journal ----------
let journalFilter = 'all';

function journalTab(): HTMLElement {
  const wrap = el('div', { class: 'journal' });
  const filters = el('div', { class: 'filters', role: 'group', 'aria-label': t('ui.filterAll') });
  const tags: [string, string][] = [['all', t('ui.filterAll')], ['real', t('ui.tagReal')], ['simplified', t('ui.tagSimple')], ['fiction', t('ui.tagFiction')], ['design', t('ui.tagDesign')]];
  for (const [id, label] of tags) {
    filters.append(el('button', {
      type: 'button', class: `chip${journalFilter === id ? ' on' : ''}`, 'aria-pressed': journalFilter === id ? 'true' : 'false',
      onclick: () => { journalFilter = id; render(); },
    }, label));
  }
  wrap.append(filters);

  const concepts = el('section', {});
  concepts.append(el('h3', { text: t('ui.conceptsTitle') }));
  const dict = L().concept as Record<string, { t: string; b: string; tag: string; field: string }>;
  const known = G.save.concepts.filter((c) => dict[c]);
  if (!known.length) concepts.append(p(t('ui.noConcepts'), 'muted'));
  for (const c of known) {
    const d = dict[c];
    if (journalFilter !== 'all' && d.tag !== journalFilter) continue;
    concepts.append(el('article', { class: `concept tag-${d.tag}` },
      el('header', {}, el('strong', { text: d.t }), el('span', { class: 'tag', text: tagName(d.tag) }), el('span', { class: 'muted', text: t(`skill.${d.field}`) })),
      el('p', { text: d.b }),
    ));
  }
  wrap.append(concepts);

  // Hints and procedures from challenges the player has opened or solved.
  const hintsSec = el('section', {});
  hintsSec.append(el('h3', { text: t('ui.hintsTitle') }));
  const procSec = el('section', {});
  procSec.append(el('h3', { text: t('ui.procedureTitle') }));
  let anyHint = false;
  let anyProc = false;
  for (const id of Object.keys(CHALLENGES)) {
    const prog = G.save.challenges[id];
    if (!prog) continue;
    const C = (L().ch as Record<string, Record<string, unknown>>)[id];
    const title = String(C.title);
    const shown = Math.min(2, prog.hintsUsed);
    for (let i = 1; i <= shown; i++) {
      anyHint = true;
      hintsSec.append(el('p', { class: 'hint-item' }, el('strong', { text: `${title} · ${t('ui.hintText', { n: i })}: ` }), String(C[`hint${i}`])));
    }
    if (prog.done) {
      for (const key of Object.keys(C).filter((k) => /^s\d$/.test(k))) {
        const stage = C[key] as { steps?: { label: string }[] };
        if (!stage.steps) continue;
        anyProc = true;
        procSec.append(el('details', {}, el('summary', { text: title }),
          el('ol', {}, ...stage.steps.map((s) => el('li', { text: s.label })))));
      }
    }
  }
  if (!anyHint) hintsSec.append(p(t('ui.emptyList'), 'muted'));
  if (!anyProc) procSec.append(p(t('ui.emptyList'), 'muted'));
  wrap.append(hintsSec, procSec);

  const tut = el('section', {});
  tut.append(el('h3', { text: t('ui.tutorialTitle') }));
  for (const k of ['tutorialMove', 'tutorialTalk', 'tutorialFight', 'tutorialAbility', 'tutorialJournal', 'tutorialPanel']) {
    tut.append(p(t(`ui.${k}`), 'muted'));
  }
  wrap.append(tut);
  return wrap;
}

function tagName(tag: string): string {
  return ({ real: t('ui.tagReal'), simplified: t('ui.tagSimple'), fiction: t('ui.tagFiction'), design: t('ui.tagDesign') } as Record<string, string>)[tag] ?? tag;
}
