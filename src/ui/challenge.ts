// Practical challenge engine: stage-by-stage problem solving with hints and explanations.
import { CHALLENGES, evalBridge, evalFarm, evalTraining, type StageDef, type TuneParam } from '../data/challenges';
import { L, t } from '../i18n';
import { el } from '../core/util';
import { openPanel, refreshPanelBody, closePanel, btn, p } from './common';
import { diagramCanvas, drawPump, drawBridge, drawFarm, drawTraining, drawChip, drawLantern } from './diagrams';
import type { Game } from '../game/game';

let G: Game;
export function bindChallenges(g: Game): void {
  G = g;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loc = Record<string, any>;

interface Session {
  id: string;
  stage: number;
  mistakes: number;
  hints: number;
  // per-stage working state
  inspected: boolean[];
  picked: number | null;
  order: number[];
  placed: number[];
  qi: number;
  feedback: { ok: boolean; text: string } | null;
  values: Record<string, number>;
  tuneResult: 'none' | 'pass' | 'fail';
  debugDone: boolean;
  optionBtns: HTMLButtonElement[];
  finished: boolean;
}

let s: Session | null = null;

function loc(id: string): Loc {
  return (L().ch as Loc)[id];
}

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // never start already in order
  if (n > 1 && a.every((v, i) => v === i)) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

function initStage(): void {
  if (!s) return;
  const def = CHALLENGES[s.id];
  const st = def.stages[s.stage];
  s.picked = null;
  s.feedback = null;
  s.placed = [];
  s.qi = 0;
  s.tuneResult = 'none';
  s.debugDone = false;
  s.optionBtns = [];
  if (st.type === 'diagnose') s.inspected = (loc(s.id)[`s${s.stage}`].ev as unknown[]).map(() => false);
  if (st.type === 'sequence') s.order = shuffled((loc(s.id)[`s${s.stage}`].steps as unknown[]).length);
  if (st.type === 'tune') {
    s.values = {};
    for (const par of st.params) s.values[par.key] = par.value;
  }
}

export function open(id: string): void {
  const saved = G.save.challenges[id];
  s = {
    id, stage: Math.min(saved?.stage ?? 0, CHALLENGES[id].stages.length - 1), mistakes: 0,
    hints: 0, inspected: [], picked: null, order: [], placed: [], qi: 0, feedback: null,
    values: {}, tuneResult: 'none', debugDone: false, optionBtns: [], finished: false,
  };
  initStage();
  G.audio.play('ui');
  openPanel({ title: loc(id).title, body: el('div'), wide: true, id: `challenge-${id}`, onClose: () => closeChallenge(), onKey: keyHandler });
  render();
}

function closeChallenge(): void {
  if (s && !s.finished) {
    G.save.challenges[s.id] = { ...(G.save.challenges[s.id] ?? { done: false, attempts: 0 }), stage: s.stage, hintsUsed: s.hints, attempts: (G.save.challenges[s.id]?.attempts ?? 0) + s.mistakes };
  }
  s = null;
  closePanel();
  G.closeChallenge();
}

function keyHandler(e: KeyboardEvent): boolean {
  if (!s) return false;
  if (/^[1-9]$/.test(e.key)) {
    const b = s.optionBtns[Number(e.key) - 1];
    if (b && !b.disabled) { e.preventDefault(); b.click(); return true; }
  }
  return false;
}

function saveProgress(): void {
  if (!s) return;
  const prev = G.save.challenges[s.id];
  G.save.challenges[s.id] = { done: prev?.done ?? false, stage: s.stage, hintsUsed: s.hints, attempts: (prev?.attempts ?? 0) + 0 };
}

function fail(text: string): void {
  if (!s) return;
  s.mistakes += 1;
  s.feedback = { ok: false, text };
  G.audio.play('fail');
}

function ok(text: string): void {
  if (!s) return;
  s.feedback = { ok: true, text };
  G.audio.play('ok');
}

function nextStage(): void {
  if (!s) return;
  const def = CHALLENGES[s.id];
  if (s.stage + 1 < def.stages.length) {
    s.stage += 1;
    initStage();
    saveProgress();
    render();
  } else {
    s.finished = true;
    G.completeChallenge(s.id, s.hints, s.mistakes);
    renderDone();
  }
}

function render(): void {
  if (!s) return;
  const def = CHALLENGES[s.id];
  const C = loc(s.id);
  const st: StageDef = def.stages[s.stage];
  s.optionBtns = [];
  const body = el('div', { class: 'challenge' });

  body.append(
    el('p', { class: 'intro', text: C.intro }),
    el('div', { class: 'stage-head' },
      el('span', { class: 'stage-count', text: t('ui.stage', { n: s.stage + 1, total: def.stages.length }) }),
      el('span', { class: 'skill-tag', text: `${t(`skill.${def.skill}`)}` }),
      progressDots(def.stages.length, s.stage)),
    el('h3', { text: C[`s${s.stage}`].title }),
    el('p', { class: 'prompt', text: C[`s${s.stage}`].prompt ?? '' }),
  );

  switch (st.type) {
    case 'diagnose': renderDiagnose(body, C, st); break;
    case 'sequence': renderSequence(body, C); break;
    case 'quiz': renderQuiz(body, C, st.answers); break;
    case 'choose': renderChoose(body, C, st.correct); break;
    case 'debug': renderDebug(body, C, st.bugLine); break;
    case 'tune': renderTune(body, C, st.params); break;
  }

  if (s.feedback) {
    body.append(el('div', { class: `feedback ${s.feedback.ok ? 'ok' : 'bad'}`, role: 'status' }, s.feedback.text));
  }

  const hintBox = el('div', { class: 'hint-box' });
  const shownHints: string[] = [];
  for (let i = 1; i <= Math.min(2, s.hints); i++) shownHints.push(C[`hint${i}`]);
  for (const h of shownHints) hintBox.append(el('p', { class: 'hint-text', text: h }));

  const footer = el('footer', { class: 'challenge-foot' },
    btn(t('common.hint'), () => {
      if (!s) return;
      if (s.hints >= 2) { G.toast(t('ui.noHints'), 'info'); return; }
      s.hints += 1;
      saveProgress();
      render();
    }, 'ghost'),
    el('span', { class: 'meta', text: `${t('ui.hintsUsed', { n: s!.hints })} · ${t('ui.attempts', { n: s!.mistakes })}` }),
    btn(t('common.close'), () => closeChallenge(), 'ghost'),
  );
  body.append(hintBox, el('div', { class: 'note' }, el('strong', { text: t('ui.simplifiedNote') + ': ' }), C.note ?? ''), footer);
  refreshPanelBody(body);
  const first = body.querySelector<HTMLElement>('button:not([disabled])');
  first?.focus({ preventScroll: true });
}

function progressDots(n: number, current: number): HTMLElement {
  const wrap = el('span', { class: 'dots', 'aria-hidden': 'true' });
  for (let i = 0; i < n; i++) wrap.append(el('span', { class: `dot${i < current ? ' done' : i === current ? ' now' : ''}` }));
  return wrap;
}

// ---------- stage renderers ----------
function renderDiagnose(body: HTMLElement, C: Loc, st: Extract<StageDef, { type: 'diagnose' }>): void {
  if (!s) return;
  const sc = C[`s${s.stage}`];
  const canvas = diagramCanvas();
  if (s.id === 'pump') drawPump(canvas, s.inspected);
  else drawChip(canvas, true);
  const evList = el('div', { class: 'evidence' });
  (sc.ev as [string, string][]).forEach(([label, detail], i) => {
    const b = btn(`${s!.inspected[i] ? '✓ ' : ''}${label}`, () => {
      if (!s) return;
      s.inspected[i] = true;
      G.audio.play('ui');
      if (s.id === 'pump') drawPump(canvas, s.inspected);
      render();
    }, s!.inspected[i] ? 'ev done' : 'ev');
    s!.optionBtns.push(b);
    evList.append(el('div', { class: 'ev-row' }, b, s!.inspected[i] ? el('p', { class: 'ev-detail', text: detail }) : null));
  });
  const allInspected = s!.inspected.every(Boolean);
  body.append(el('div', { class: 'two-col' }, canvas, el('div', { class: 'col' }, el('h4', { text: t('diagnoseLabels.evidence') }), evList)));
  if (!allInspected) {
    body.append(p(t('diagnoseLabels.inspectAll'), 'muted'));
    return;
  }
  body.append(el('h4', { text: t('diagnoseLabels.chooseCause') }));
  const faults = el('div', { class: 'options' });
  (sc.faults as string[]).forEach((f, i) => {
    const b = btn(f, () => {
      if (!s) return;
      if (i === st.correct) {
        s.picked = i;
        ok(sc.why[i]);
        render();
      } else {
        fail(sc.why[i]);
        render();
      }
    }, 'opt');
    s!.optionBtns.push(b);
    faults.append(b);
  });
  body.append(faults);
  if (s.picked === st.correct) body.append(btn(t('common.next'), () => nextStage(), 'primary'));
}

function renderSequence(body: HTMLElement, C: Loc): void {
  if (!s) return;
  const sc = C[`s${s.stage}`];
  const steps = sc.steps as { label: string; why: string }[];
  const placedRow = el('ol', { class: 'placed' });
  s.placed.forEach((idx) => placedRow.append(el('li', { text: steps[idx].label })));
  body.append(el('div', { class: 'placed-wrap' }, el('h4', { text: t('ui.procedureTitle') }), placedRow));
  const pool = el('div', { class: 'options' });
  s.order.forEach((idx) => {
    if (s!.placed.includes(idx)) return;
    const b = btn(steps[idx].label, () => {
      if (!s) return;
      const expected = s.placed.length;
      if (idx === expected) {
        s.placed.push(idx);
        s.feedback = { ok: true, text: `${t('ui.seqRight')} ${steps[idx].why}` };
        G.audio.play('ui');
        if (s.placed.length === steps.length) {
          saveProgress();
        }
        render();
      } else {
        fail(`${t('ui.seqWrong')} ${steps[idx].why}`);
        render();
      }
    }, 'opt');
    s!.optionBtns.push(b);
    pool.append(b);
  });
  body.append(pool);
  if (s.placed.length === steps.length) body.append(btn(t('common.next'), () => nextStage(), 'primary'));
}

function renderQuiz(body: HTMLElement, C: Loc, answers: number[]): void {
  if (!s) return;
  const qs = C[`s${s.stage}`].questions as { q: string; o: string[]; why: string }[];
  const q = qs[Math.min(s.qi, qs.length - 1)];
  const opts = el('div', { class: 'options' });
  if (s.qi < qs.length) body.append(el('p', { class: 'question', text: `${s.qi + 1}. ${q.q}` }));
  if (s.qi < qs.length) q.o.forEach((o, i) => {
    const b = btn(`${i + 1}. ${o}`, () => {
      if (!s) return;
      if (i === answers[s.qi]) {
        s.qi += 1;
        s.feedback = { ok: true, text: `${t('ui.correct')} ${q.why}` };
        G.audio.play('ok');
        if (s.qi >= qs.length) {
          saveProgress();
        }
        render();
      } else {
        fail(`${t('ui.tryAgain')} ${t('ui.wrong')}`);
        render();
      }
    }, 'opt');
    s!.optionBtns.push(b);
    opts.append(b);
  });
  body.append(opts);
  if (s.qi >= qs.length) body.append(btn(t('common.next'), () => nextStage(), 'primary'));
}

function renderChoose(body: HTMLElement, C: Loc, correct: number): void {
  if (!s) return;
  const sc = C[`s${s.stage}`];
  body.append(el('p', { class: 'muted', text: sc.explain }));
  const opts = el('div', { class: 'options' });
  (sc.fixes as string[]).forEach((f, i) => {
    const b = btn(`${i + 1}. ${f}`, () => {
      if (!s) return;
      if (i === correct) {
        s.picked = i;
        ok(sc.explain);
        render();
      } else {
        fail(`${t('ui.tryAgain')} ${t('ui.wrong')}`);
        render();
      }
    }, 'opt');
    s!.optionBtns.push(b);
    opts.append(b);
  });
  body.append(opts);
  if (s.picked === correct) body.append(btn(t('common.next'), () => nextStage(), 'primary'));
}

function renderDebug(body: HTMLElement, C: Loc, bugLine: number): void {
  if (!s) return;
  const sc = C[`s${s.stage}`];
  const canvas = diagramCanvas();
  drawLantern(canvas, 1, true);
  const codeBox = el('pre', { class: 'code', 'aria-label': 'code' });
  (sc.code as string[]).forEach((line, i) => {
    const b = el('button', { type: 'button', class: 'code-line', onclick: () => {
      if (!s) return;
      if (i === bugLine) {
        s.debugDone = true;
        s.picked = i;
        ok(sc.why[1]);
        render();
      } else {
        fail(sc.why[0]);
        render();
      }
    } }, `${String(i + 1).padStart(2, ' ')}  ${line}`);
    codeBox.append(b, '\n');
    s!.optionBtns.push(b as HTMLButtonElement);
  });
  body.append(el('div', { class: 'two-col' }, el('div', { class: 'col' }, codeBox), el('div', { class: 'col' }, canvas,
    el('pre', { class: 'trace' }, (sc.trace as string[]).join('\n')))));
  if (s.debugDone) body.append(btn(t('common.next'), () => nextStage(), 'primary'));
}

function renderTune(body: HTMLElement, C: Loc, params: TuneParam[]): void {
  if (!s) return;
  const sc = C[`s${s.stage}`];
  const canvas = diagramCanvas();
  const drawNow = () => {
    if (!s) return;
    if (s.id === 'bridge') drawBridge(canvas, s.values);
    if (s.id === 'farm') drawFarm(canvas, s.values);
    if (s.id === 'training') drawTraining(canvas, s.values);
  };
  const controls = el('div', { class: 'tune-controls' });
  params.forEach((par, i) => {
    const row = el('div', { class: 'tune-row' });
    const val = s!.values[par.key];
    row.append(el('label', { text: sc.labels[i] }));
    if (par.opt !== undefined && sc.opts?.[par.opt]) {
      const opts = sc.opts[par.opt] as string[];
      const group = el('div', { class: 'seg', role: 'group', 'aria-label': sc.labels[i] });
      opts.forEach((o, k) => {
        const b = btn(o, () => {
          if (!s) return;
          s.values[par.key] = par.min + k;
          s.tuneResult = 'none';
          drawNow();
          render();
        }, val === par.min + k ? 'seg-on' : 'seg-btn');
        s!.optionBtns.push(b);
        group.append(b);
      });
      row.append(group);
    } else {
      const input = el('input', { type: 'range', min: par.min, max: par.max, step: par.step, value: val, 'aria-label': sc.labels[i] }) as HTMLInputElement;
      const out = el('output', { text: displayValue(s!.id, par.key, val) });
      input.addEventListener('input', () => {
        if (!s) return;
        s.values[par.key] = Number(input.value);
        out.textContent = displayValue(s.id, par.key, Number(input.value));
        s.tuneResult = 'none';
        drawNow();
      });
      input.addEventListener('change', () => render());
      row.append(input, out);
    }
    controls.append(row);
  });
  body.append(el('div', { class: 'two-col' }, el('div', { class: 'col' }, controls), el('div', { class: 'col' }, canvas, el('div', { class: 'metrics' }, ...metricRows(s.id, s.values, C)))));
  drawNow();
  body.append(btn(t('ui.testRun'), () => {
    if (!s) return;
    const pass = runTest(s.id, s.values);
    s.tuneResult = pass ? 'pass' : 'fail';
    if (pass) {
      ok(sc.success);
      s.feedback = { ok: true, text: sc.success };
    } else {
      const tips = testTips(s.id, s.values);
      const tipText = tips.map((i) => `• ${sc.tips[i]}`).join('\n');
      s.feedback = { ok: false, text: `${sc.fail}\n${tipText}` };
      s.mistakes += 1;
      G.audio.play('fail');
    }
    render();
  }, 'primary'));
  if (s.tuneResult === 'pass') body.append(btn(t('common.next'), () => nextStage(), 'primary'));
}

function displayValue(id: string, key: string, v: number): string {
  if (id === 'bridge' && key === 'depth') return `${v}`;
  if (id === 'farm' && key === 'water') return `${v} mm`;
  if (id === 'training' && key === 'ramp') return `${v}%`;
  if (id === 'training' && key === 'intensity') return `${v}/10`;
  return String(v);
}

function runTest(id: string, v: Record<string, number>): boolean {
  if (id === 'bridge') return evalBridge(v).pass;
  if (id === 'farm') return evalFarm(v).pass;
  if (id === 'training') return evalTraining(v).pass;
  return false;
}

function testTips(id: string, v: Record<string, number>): number[] {
  if (id === 'bridge') return evalBridge(v).tips;
  if (id === 'farm') return evalFarm(v).tips;
  if (id === 'training') return evalTraining(v).tips;
  return [];
}

function metricRows(id: string, v: Record<string, number>, C: Loc): HTMLElement[] {
  const names: string[] = C[`s${s?.stage ?? 0}`].metrics;
  const rows: string[] = [];
  if (id === 'bridge') {
    const r = evalBridge(v);
    rows.push(`${r.seg.toFixed(0)} m`, r.demand.toFixed(1), r.cap.toFixed(1), r.sf.toFixed(2), `${r.cost.toFixed(1)} / 18`);
  } else if (id === 'farm') {
    const r = evalFarm(v);
    rows.push(`${Math.round(r.moisture)}%`, `${Math.round(r.health)}%`, `${r.used.toFixed(0)} L/m²`, r.runoff.toFixed(1));
  } else if (id === 'training') {
    const r = evalTraining(v);
    rows.push(`${Math.round(r.gain)} / 100`, `${Math.round(r.risk)} %`, r.last.toFixed(0));
  }
  return names.map((n, i) => el('div', { class: 'metric' }, el('span', { text: n }), el('strong', { text: rows[i] ?? '' })));
}

function renderDone(): void {
  if (!s) return;
  const def = CHALLENGES[s.id];
  const body = el('div', { class: 'challenge done' },
    el('h3', { text: t('ui.challengeDone') }),
    el('p', { text: loc(s.id).intro }),
    el('ul', { class: 'learned' }, ...def.concepts.map((c) => el('li', { text: (L().concept as Record<string, { t: string }>)[c]?.t ?? c }))),
    el('p', { class: 'muted', text: `${t('ui.hintsUsed', { n: s.hints })} · ${t('ui.attempts', { n: s.mistakes })}` }),
    btn(t('common.done'), () => { s = null; closePanel(); G.closeChallenge(); }, 'primary'),
  );
  refreshPanelBody(body);
}
