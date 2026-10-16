// The game controller: state, saving, progression, quests, interactions and the main update loop.
import { AFFS, abilityAvailable, masteryLevel, type AbilityId, type AffId } from '../data/affinities';
import { CHALLENGES, type SkillId } from '../data/challenges';
import { NPCS, OBJECTS, QUESTS, SPAWNS, type ObjDef, type NpcDef } from '../data/content';
import { L, t } from '../i18n';
import { Audio2 } from '../core/audio';
import { randUnit } from '../core/rng';
import { type Settings, loadSettings, saveSettings, readSave, writeSave, eraseSave } from '../core/settings';
import { buildMap, zoneAt, type MapData, TT } from '../world/map';
import { blocked, iso } from '../world/level';
import { makeEnemy, cast, strike, updateEnemies, updateProjectiles, updateSkills } from './combat';
import { type SaveData, type Enemy, type Projectile, type Effect, type Barrier, type Familiar, type Well, type Mode, type Pickup } from './types';
import { dist, clamp } from '../core/util';
import * as HUD from '../ui/hud';
import * as Dialogue from '../ui/dialogue';
import * as Challenge from '../ui/challenge';
import * as Menu from '../ui/menu';
import * as Screens from '../ui/screens';
import { render } from '../world/render';

export interface PlayerState {
  x: number; y: number; dirX: number; dirY: number; facing: 1 | -1;
  hp: number; mana: number; stamina: number;
  atkCd: number; attackT: number; dashT: number; dashVx: number; dashVy: number;
  ironT: number; guardT: number; ward: { amt: number; t: number } | null;
  invuln: number; dodgeT: number; dodgeVx: number; dodgeVy: number;
  cool: Partial<Record<AbilityId, number>>; dead: number; walkT: number; moving: boolean;
}

const DEFAULT_SLOTS: (AbilityId | null)[] = ['bolt', 'ward', 'iron', 'pull'];
export const START = { x: 25.5, y: 22.5 };

export function freshSave(name: string, pcts: number[], manual: boolean): SaveData {
  return {
    v: 2, name, pcts, affXp: [0, 0, 0, 0, 0, 0], level: 1, xp: 0, points: 0,
    stats: { str: 20, vit: 10, agi: 10, mind: 10 },
    skillXp: {}, concepts: [], inv: { herbs: 2, bread: 1 },
    slots: [...DEFAULT_SLOTS], flags: {}, kills: {}, questsDone: [], challenges: {}, chests: [],
    affUsed: [], combos: [], pos: START, tutorial: [], atelier: false, manual, journalNotes: [],
  };
}

export class Game {
  settings: Settings;
  audio = new Audio2();
  save!: SaveData;
  map: MapData = buildMap();
  mode: Mode = 'title';
  player!: PlayerState;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  effects: Effect[] = [];
  barriers: Barrier[] = [];
  familiars: Familiar[] = [];
  wells: Well[] = [];
  pickups: Pickup[] = [];
  spawnsRef = SPAWNS;
  npcs: NpcDef[] = NPCS;
  objects: ObjDef[] = OBJECTS;
  keys = new Set<string>();
  time = 0;
  camX = 0;
  camY = 0;
  private autosaveT = 0;
  private questT = 0;
  activeChallenge: string | null = null;
  lastZone = '';
  /** Quest/dialogue prompt for the nearby interactable */
  nearby: string | null = null;

  constructor() {
    this.settings = loadSettings();
    this.audio.muted = this.settings.muted;
    this.audio.volume = this.settings.volume / 100;
    this.newRuntime();
  }

  // ---------- lifecycle ----------
  newRuntime(): void {
    this.player = {
      x: START.x, y: START.y, dirX: 0, dirY: 1, facing: 1,
      hp: 100, mana: 50, stamina: 100, atkCd: 0, attackT: 0, dashT: 0, dashVx: 0, dashVy: 0,
      ironT: 0, guardT: 0, ward: null, invuln: 0, dodgeT: 0, dodgeVx: 0, dodgeVy: 0,
      cool: {}, dead: 0, walkT: 0, moving: false,
    };
  }

  startNew(name: string, pcts: number[], manual: boolean): void {
    this.save = freshSave(name, pcts, manual);
    this.afterLoad();
    this.toastSequence();
    this.mode = 'play';
    this.persist();
    Screens.hideAll();
    HUD.show(true);
    this.refreshQuests();
  }

  /** Loads a demonstration world behind the title screen. */
  previewWorld(): void {
    this.save = freshSave('', [17, 17, 17, 17, 16, 16], false);
    this.afterLoad();
    this.mode = 'title';
  }

  continueSaved(): boolean {
    const s = readSave<SaveData>();
    if (!s || s.v !== 2) return false;
    this.save = { ...freshSave(s.name, s.pcts, s.manual), ...s };
    this.afterLoad();
    this.mode = 'play';
    Screens.hideAll();
    HUD.show(true);
    this.toast(t('ui.loaded'), 'ok');
    this.refreshQuests();
    return true;
  }

  private afterLoad(): void {
    this.newRuntime();
    this.player.x = this.save.pos.x;
    this.player.y = this.save.pos.y;
    this.player.hp = this.maxHp();
    this.player.mana = this.maxMana();
    this.player.stamina = 100;
    this.applyBridgeState();
    this.spawnEnemies();
    this.camX = iso(this.player.x, this.player.y)[0];
    this.camY = iso(this.player.x, this.player.y)[1];
  }

  private toastSequence(): void {
    const msgs = [t('ui.tutorialMove'), t('ui.tutorialTalk'), t('ui.tutorialFight'), t('ui.tutorialAbility'), t('ui.tutorialJournal')];
    msgs.forEach((m, i) => window.setTimeout(() => this.mode !== 'title' && this.toast(m, 'info', 7000), 600 + i * 7500));
  }

  persist(): void {
    this.save.pos = { x: this.player.x, y: this.player.y };
    writeSave(this.save);
  }

  eraseEverything(): void {
    eraseSave();
  }

  // ---------- stats ----------
  stat(name: 'str' | 'vit' | 'agi' | 'mind'): number {
    return this.save.stats[name];
  }
  maxHp(): number { return 70 + this.stat('vit') * 4; }
  maxMana(): number { return 30 + this.stat('mind') * 2.5; }
  moveSpeed(): number { return 3.0 + this.stat('agi') * 0.02; }
  masteryOf(aff: AffId): number { return masteryLevel(this.save.affXp[AFFS.indexOf(aff)]); }
  pctOf(aff: AffId): number { return this.save.pcts[AFFS.indexOf(aff)]; }

  abilityUnlocked(id: AbilityId): boolean {
    const masteries = AFFS.map((_, i) => masteryLevel(this.save.affXp[i]));
    return abilityAvailable(id, this.save.pcts, masteries);
  }

  addAffXp(aff: AffId, n: number): void {
    const i = AFFS.indexOf(aff);
    const before = masteryLevel(this.save.affXp[i]);
    this.save.affXp[i] += n;
    const after = masteryLevel(this.save.affXp[i]);
    if (after > before) this.toast(`${t(`aff.${aff}.name`)} · ${t('aff.mastery')} ${after}`, 'ok', 3000);
  }

  markAffUse(aff: AffId | [AffId, AffId]): void {
    const list = Array.isArray(aff) ? aff : [aff];
    for (const a of list) if (!this.save.affUsed.includes(a)) this.save.affUsed.push(a);
    if (list.includes('anti')) this.discoverConcept('anti_reveal');
  }

  afterCastSave(): void {
    this.discoverConcept('ley_energy');
    this.discoverConcept('magic_not_skill');
    this.autosaveT = 0;
  }

  gainXp(n: number): void {
    this.save.xp += n;
    let need = this.xpNeed();
    while (this.save.xp >= need && this.save.level < 20) {
      this.save.xp -= need;
      this.save.level += 1;
      this.save.points += 2;
      this.audio.play('levelup');
      this.toast(t('ui.levelUp', { n: this.save.level }), 'ok', 3500);
      need = this.xpNeed();
    }
  }
  xpNeed(): number { return 40 * this.save.level; }

  spendPoint(stat: 'str' | 'vit' | 'agi' | 'mind'): boolean {
    if (this.save.points <= 0) { this.toast(t('stat.noPoints'), 'fail'); return false; }
    const gain = stat === 'str' ? 2 : 1;
    if (stat === 'str' && this.save.stats.str >= 100) { this.toast(t('ui.notAvailable'), 'fail'); return false; }
    this.save.stats.str = stat === 'str' ? Math.min(100, this.save.stats.str + gain) : this.save.stats.str;
    if (stat !== 'str') this.save.stats[stat] += gain;
    this.save.points -= 1;
    if (stat === 'vit') this.player.hp = Math.min(this.maxHp(), this.player.hp + 4);
    if (stat === 'mind') this.player.mana = Math.min(this.maxMana(), this.player.mana + 4);
    this.audio.play('ui');
    return true;
  }

  // ---------- skills, items ----------
  skillLevel(s: SkillId): number {
    return Math.min(10, 1 + Math.floor((this.save.skillXp[s] ?? 0) / 40));
  }
  addSkillXp(s: SkillId, n: number): void {
    this.save.skillXp[s] = (this.save.skillXp[s] ?? 0) + n;
  }

  hasItem(item: string, n = 1): boolean {
    return (this.save.inv[item] ?? 0) >= n;
  }
  addItem(item: string, n: number): boolean {
    if (Object.values(this.save.inv).reduce((a, b) => a + b, 0) > 80) {
      this.toast(t('ui.lootFull'), 'fail');
      return false;
    }
    this.save.inv[item] = (this.save.inv[item] ?? 0) + n;
    if (this.save.inv[item] <= 0) delete this.save.inv[item];
    this.toast(t('ui.lootGot', { item: t(`item.${item}.name`), n }), 'ok', 2000);
    this.audio.play('pickup');
    if (item === 'valve_gasket') this.save.flags.got_gasket = true;
    return true;
  }
  removeItem(item: string, n: number): void {
    this.save.inv[item] = Math.max(0, (this.save.inv[item] ?? 0) - n);
    if (this.save.inv[item] === 0) delete this.save.inv[item];
  }
  useItem(item: string): void {
    if (!this.hasItem(item)) return;
    const heal: Record<string, number> = { bread: 30, herbs: 12, salt_pork: 10 };
    if (!(item in heal)) { this.toast(t('ui.notAvailable'), 'info'); return; }
    this.removeItem(item, 1);
    this.player.hp = Math.min(this.maxHp(), this.player.hp + heal[item] * (1 + this.skillLevel('cooking') * 0.05));
    this.toast(`+${heal[item]} ${t('stat.hp')}`, 'ok');
    this.audio.play('pickup');
  }

  // ---------- flags, conditions and quests ----------
  flag(name: string): boolean {
    return !!this.save.flags[name];
  }
  /** Conditions: flag, done:<challenge>, quest:<quest>, has:<item>:<n>, aff4, kills5 */
  check(c: string): boolean {
    if (c.startsWith('done:')) return !!this.save.challenges[c.slice(5)]?.done;
    if (c.startsWith('quest:')) return this.save.questsDone.includes(c.slice(6));
    if (c.startsWith('has:')) {
      const [, item, n] = c.split(':');
      return this.hasItem(item, Number(n));
    }
    if (c === 'aff4') return this.save.affUsed.length >= 4;
    if (c === 'kills5') return Object.values(this.save.kills).reduce((a, b) => a + b, 0) >= 5;
    return this.flag(c);
  }

  discoverConcept(id: string): void {
    if (this.save.concepts.includes(id)) return;
    this.save.concepts.push(id);
    const c = (L().concept as Record<string, { t: string }>)[id];
    const title = c?.t ?? id;
    this.toast(t('ui.journalEntry', { concept: title }), 'discover', 3500);
    this.audio.play('discover');
  }

  refreshQuests(): void {
    for (const q of QUESTS) {
      if (this.save.questsDone.includes(q.id)) continue;
      const started = q.start.every((c) => this.check(c));
      if (!started) continue;
      const allDone = q.objectives.every((o) => o.done.every((c) => this.check(c)));
      if (allDone) {
        this.save.questsDone.push(q.id);
        this.gainXp(q.xp);
        for (const [item, n] of Object.entries(q.items ?? {})) {
          this.save.inv[item] = (this.save.inv[item] ?? 0) + n;
        }
        if (q.id === 'lantern') this.save.atelier = true;
        this.toast(t('ui.questDone', { quest: t(`quest.${q.id}.name`) }), 'ok', 4500);
        this.audio.play('levelup');
        this.persist();
      }
    }
  }

  /** Active quest objectives shown in the HUD: first incomplete started quest. */
  currentGoal(): { quest: string; objective: string } | null {
    for (const q of QUESTS) {
      if (this.save.questsDone.includes(q.id)) continue;
      if (!q.start.every((c) => this.check(c))) continue;
      const o = q.objectives.find((x) => !x.done.every((c) => this.check(c)));
      if (o) return { quest: t(`quest.${q.id}.name`), objective: t(`qobj.${o.id}`) };
    }
    return null;
  }

  bossDefeated(): void {
    this.save.flags.guardian_dead = true;
    this.toast(t('ui.questDone', { quest: t('quest.tower.name') }), 'ok', 6000);
    this.showDialogue(L().dlg.tower2, t('zone.ruins'));
    this.gainXp(150);
    this.refreshQuests();
    this.persist();
  }

  applyBridgeState(): void {
    const fixed = this.flag('bridge_fixed');
    for (const [x, y] of this.bridgeTiles()) {
      this.map.type[y * 48 + x] = fixed ? TT.Bridge : TT.Chasm;
    }
  }
  private bridgeTiles(): [number, number][] {
    const out: [number, number][] = [];
    for (let y = 18; y <= 19; y++) for (let x = 34; x <= 41; x++) out.push([x, y]);
    return out;
  }

  spawnEnemies(): void {
    this.enemies = [];
    SPAWNS.forEach((s, i) => {
      if (s.flag && !this.flag(s.flag)) return;
      if (s.boss && this.flag('guardian_dead')) return;
      this.enemies.push(makeEnemy(s.type, s.x, s.y, i, !!s.boss));
    });
  }

  // ---------- effects & feedback ----------
  toast(msg: string, kind: 'info' | 'ok' | 'fail' | 'discover' = 'info', ms = 2600): void {
    HUD.toast(msg, kind, ms);
    if (kind === 'fail') this.audio.play('fail');
  }
  floatText(x: number, y: number, text: string, color: string): void {
    this.effect({ kind: 'text', x, y, t: 0, life: 0.9, text, color });
  }
  effect(e: Omit<Effect, 'x' | 'y'> & { x: number; y: number }): void {
    if (this.settings.reducedMotion && e.kind !== 'text') return;
    this.effects.push(e as Effect);
    if (this.effects.length > 160) this.effects.splice(0, this.effects.length - 160);
  }
  rand(): number { return randUnit(); }

  damagePlayer(n: number): void {
    const p = this.player;
    p.hp -= n;
    p.invuln = 0.35;
    this.audio.play('hurt');
    this.effect({ kind: 'text', x: p.x, y: p.y - 0.4, t: 0, life: 0.8, text: `-${n}`, color: '#ff8f8f' });
    if (p.hp <= 0) this.defeated();
  }

  private defeated(): void {
    this.mode = 'dead';
    this.player.hp = 0;
    this.toast(t('ui.defeated'), 'fail', 5000);
    window.setTimeout(() => {
      this.player.x = START.x;
      this.player.y = START.y;
      this.player.hp = Math.round(this.maxHp() * 0.5);
      this.player.mana = this.maxMana();
      this.enemies.forEach((e) => { if (!e.boss) { e.hp = e.maxHp; } });
      this.mode = 'play';
    }, 2600);
  }

  // ---------- dialogue, challenges, menus ----------
  showDialogue(lines: string[], speaker: string, onEnd?: () => void): void {
    this.mode = 'dialogue';
    Dialogue.open(lines, speaker, () => {
      this.mode = 'play';
      onEnd?.();
      this.refreshQuests();
      this.persist();
    });
  }

  openChallenge(id: string): void {
    const def = CHALLENGES[id];
    if (!def) return;
    if (def.flag && !this.check(def.flag)) {
      this.toast(t('ui.notAvailable'), 'fail');
      return;
    }
    for (const [item, n] of Object.entries(def.items ?? {})) {
      if (!this.hasItem(item, n)) {
        this.toast(t('ui.missing', { item: `${n}× ${t(`item.${item}.name`)}` }), 'fail', 3800);
        return;
      }
    }
    this.mode = 'challenge';
    this.activeChallenge = id;
    Challenge.open(id);
  }

  closeChallenge(): void {
    this.activeChallenge = null;
    this.mode = 'play';
    this.persist();
  }

  /** Called by the challenge UI when all stages are done. */
  completeChallenge(id: string, hintsUsed: number, mistakes: number): void {
    const def = CHALLENGES[id];
    const prog = this.save.challenges[id] ?? { done: false, stage: 0, hintsUsed: 0, attempts: 0 };
    const replay = prog.done;
    prog.done = true;
    prog.hintsUsed = hintsUsed;
    this.save.challenges[id] = prog;
    if (!replay) {
      const bonus = hintsUsed === 0 && mistakes === 0 ? 1.1 : hintsUsed === 0 ? 1 : 0.7;
      const xp = Math.round(def.xp * bonus);
      this.gainXp(xp);
      this.addSkillXp(def.skill, Math.round(def.xp / 2));
      this.toast(t('ui.rewardText', { xp, skill: Math.round(def.xp / 2), skill_name: t(`skill.${def.skill}`) }), 'ok', 4200);
      for (const c of def.concepts) this.discoverConcept(c);
      for (const [item, n] of Object.entries(def.consume ?? {})) this.removeItem(item, n);
      if (def.setFlag) this.save.flags[def.setFlag] = true;
      if (def.id === 'bridge') this.applyBridgeState();
    }
    this.audio.play('ok');
    this.refreshQuests();
    this.persist();
  }

  openMenuTab(tab: string): void {
    this.mode = 'menu';
    Menu.open(tab);
  }

  closeMenu(): void {
    this.mode = 'play';
    Menu.close();
    this.persist();
  }

  // ---------- interactions ----------
  nearestTarget(): { kind: 'npc'; npc: NpcDef } | { kind: 'obj'; obj: ObjDef } | null {
    let best: { kind: 'npc'; npc: NpcDef } | { kind: 'obj'; obj: ObjDef } | null = null;
    let bd = 1.6;
    for (const npc of this.npcs) {
      const d = dist(npc.x, npc.y, this.player.x, this.player.y);
      if (d < bd) { bd = d; best = { kind: 'npc', npc }; }
    }
    for (const obj of this.objects) {
      const d = dist(obj.x, obj.y, this.player.x, this.player.y);
      if (d < bd) { bd = d; best = { kind: 'obj', obj }; }
    }
    return best;
  }

  interact(): void {
    const target = this.nearestTarget();
    if (!target) return;
    if (target.kind === 'npc') {
      const script = target.npc.scripts.find((s) => (s.cond ?? []).every((c) => this.check(c)) && !(s.not ?? []).some((c) => this.check(c)));
      const lines = script ? (L().dlg as Record<string, string[]>)[script.lines] : L().dlg.idle;
      const set = script?.set ?? [];
      this.showDialogue(lines, t(`npc.${target.npc.name}`), () => {
        for (const f of set) this.save.flags[f] = true;
        this.refreshQuests();
      });
      return;
    }
    this.interactObject(target.obj);
  }

  private interactObject(o: ObjDef): void {
    const dl = L().dlg;
    switch (o.kind) {
      case 'pump':
        if (this.done('pump')) return this.showDialogue(dl.pumpBusy, t('ui.objectLabel'));
        if (!this.flag('talked_oskar')) return this.showDialogue(dl.pumpIdle, t('ui.objectLabel'));
        return this.openChallenge('pump');
      case 'lantern':
        if (this.done('lantern')) return this.showDialogue(dl.pumpBusy, t('ui.objectLabel'));
        if (!this.flag('talked_pim')) return this.showDialogue(dl.lanternBroken, t('ui.objectLabel'));
        return this.openChallenge('lantern');
      case 'stove':
        if (!this.flag('talked_lio')) return this.showDialogue(dl.stoveLio, t('npc.lio'));
        return this.openChallenge('meal');
      case 'chipBench':
        if (!this.flag('chip_req')) return this.showDialogue(dl.sign, t('ui.objectLabel'));
        return this.openChallenge('chip');
      case 'bridge':
        if (this.flag('bridge_fixed')) return this.showDialogue(dl.bridgeFixed, t('npc.ysolde'));
        if (!this.flag('talked_ysolde')) return this.showDialogue(dl.bridgeBroken, t('zone.gorge'));
        return this.openChallenge('bridge');
      case 'valve': return this.openChallenge('farm');
      case 'board': return this.openChallenge('training');
      case 'medic': return this.openChallenge('triage');
      case 'lab': return this.openChallenge('lab');
      case 'dummy': return this.toast(t('qobj.dummyAll'), 'info', 3800);
      case 'tower':
        if (!this.flag('bridge_fixed')) return this.showDialogue(dl.gateBridge, t('zone.gorge'));
        if (this.flag('guardian_dead')) return this.showDialogue(dl.tower2, t('zone.ruins'));
        return this.showDialogue(dl.towerDoor.concat(dl.tower1), t('zone.ruins'));
      case 'sign': return this.showDialogue(dl.sign, t('zone.village'));
      case 'barrel': return this.showDialogue(dl.barrel, t('zone.village'));
      case 'chest':
      case 'crate': {
        const id = o.id;
        if (this.save.chests.includes(id)) return this.showDialogue(dl.chestEmpty, t('ui.objectLabel'));
        this.save.chests.push(id);
        for (const [item, n] of Object.entries(o.loot ?? {})) this.addItem(item, n);
        if (o.id === 'crate') this.toast(t('dlg.crateTimber'), 'info', 2500);
        this.persist();
        return undefined;
      }
    }
    return undefined;
  }

  done(id: string): boolean { return !!this.save.challenges[id]?.done; }

  // ---------- input ----------
  onKeyDown(e: KeyboardEvent): void {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (this.mode === 'play') {
      this.keys.add(k);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (e.repeat) return;
      switch (k) {
        case 'e': case 'Enter': this.interact(); break;
        case 'j': case 'z': strike(this); break;
        case ' ': case 'x': this.dodge(); break;
        case '1': case '2': case '3': case '4': this.castSlot(Number(k) - 1); break;
        case 'Tab': e.preventDefault(); this.openMenuTab('character'); break;
        case 'Escape': this.openPause(); break;
        case 'h': this.toast(t('hint.combat'), 'info', 5000); break;
        case 'i': this.openMenuTab('inventory'); break;
        case 'q': this.openMenuTab('quests'); break;
        case 'n': this.openMenuTab('journal'); break;
        case 'k': this.openMenuTab('skills'); break;
        default: break;
      }
      return;
    }
    if (this.mode === 'dialogue') {
      if (['e', 'Enter', ' '].includes(k)) { e.preventDefault(); Dialogue.advance(); }
      else if (k === 'Escape') Dialogue.advance(true);
    }
  }

  onKeyUp(e: KeyboardEvent): void {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    this.keys.delete(k);
  }

  castSlot(i: number): void {
    const id = this.save.slots[i];
    if (!id) { this.toast(t('ui.notAvailable'), 'info', 1200); return; }
    cast(this, id);
  }

  dodge(): void {
    const p = this.player;
    if (p.stamina < 20 || p.dodgeT > 0 || this.mode !== 'play') return;
    p.stamina -= 20;
    p.dodgeT = 0.32;
    p.invuln = 0.32;
    p.dodgeVx = p.dirX * 7;
    p.dodgeVy = p.dirY * 7;
    this.audio.play('dodge');
  }

  openPause(): void {
    this.mode = 'pause';
    Screens.openPause();
  }

  // ---------- update ----------
  update(dt: number): void {
    this.time += dt;
    if (this.mode !== 'play' && this.mode !== 'dead') return;
    const p = this.player;
    // movement
    let mx = 0;
    let my = 0;
    if (this.mode === 'play') {
      if (this.keys.has('ArrowLeft') || this.keys.has('a')) mx -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('d')) mx += 1;
      if (this.keys.has('ArrowUp') || this.keys.has('w')) my -= 1;
      if (this.keys.has('ArrowDown') || this.keys.has('s')) my += 1;
    }
    // iso: screen-up/down keys map to diagonal tile directions
    let tx = mx + my;
    let ty = my - mx;
    const len = Math.hypot(tx, ty);
    if (len > 0) { tx /= len; ty /= len; }
    let speed = this.moveSpeed();
    if (p.dodgeT > 0) {
      p.dodgeT -= dt;
      tx = p.dodgeVx;
      ty = p.dodgeVy;
      speed = 7;
    }
    if (p.dashT > 0) {
      p.dashT -= dt;
      tx = p.dashVx;
      ty = p.dashVy;
      speed = 9;
    }
    if (p.ironT > 0) p.ironT -= dt;
    if (p.guardT > 0) p.guardT -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.atkCd > 0) p.atkCd -= dt;
    if (p.attackT > 0) p.attackT -= dt;
    for (const k of Object.keys(p.cool) as AbilityId[]) p.cool[k] = Math.max(0, (p.cool[k] ?? 0) - dt);
    if (p.ward) { p.ward.t -= dt; if (p.ward.t <= 0 || p.ward.amt <= 0) p.ward = null; }
    p.moving = len > 0 && p.dodgeT <= 0;
    const driving = (this.mode === 'play' && Math.abs(tx) + Math.abs(ty) > 0.01) || p.dodgeT > 0 || p.dashT > 0;
    if (driving) {
      const nx = p.x + tx * speed * dt;
      const ny = p.y + ty * speed * dt;
      if (!blocked(this.map, nx, p.y, 0.3)) p.x = nx;
      if (!blocked(this.map, p.x, ny, 0.3)) p.y = ny;
      if (p.moving) {
        p.walkT += dt * 8;
        if (p.walkT > 2) p.walkT = 0;
      }
      if (Math.abs(tx) > 0.1) p.facing = tx > 0 ? 1 : -1;
      if (len > 0) { p.dirX = tx; p.dirY = ty; }
    }
    if (p.dirX === 0 && p.dirY === 0) p.dirY = 1;
    // regen
    p.stamina = Math.min(100, p.stamina + 22 * dt);
    p.mana = Math.min(this.maxMana(), p.mana + (2 + this.stat('mind') * 0.05) * dt);
    if (this.mode === 'play' && p.hp < this.maxHp() && p.hp > 0) p.hp = Math.min(this.maxHp(), p.hp + 0.4 * dt);
    if (p.x >= 42 && !this.flag('east_side')) {
      this.save.flags.east_side = true;
      this.toast(t('ui.questStarted', { quest: t('quest.tower.name') }), 'info', 4000);
    }
    // a short hint when standing in a new zone
    const zone = this.currentZone();
    if (zone !== this.lastZone) {
      this.lastZone = zone;
      this.toast(t(`zone.${zone}`), 'info', 1800);
    }
    if (this.mode === 'play') {
      updateEnemies(this, dt);
      updateProjectiles(this, dt);
      updateSkills(this, dt);
    }
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.life);
    // quests re-evaluated a few times per second
    this.questT -= dt;
    if (this.questT <= 0) { this.questT = 0.5; this.refreshQuests(); HUD.update(this); }
    // autosave
    this.autosaveT += dt;
    if (this.autosaveT > 20) { this.autosaveT = 0; this.persist(); }
    // nearby prompt
    const target = this.nearestTarget();
    this.nearby = target ? (target.kind === 'npc' ? t(`npc.${target.npc.name}`) : t(`ui.object.${target.obj.kind}`)) : null;
    this.camUpdate(dt);
    if (this.player.hp <= 0 && this.mode !== 'dead') this.defeated();
  }

  private camUpdate(dt: number): void {
    const [tx, ty] = iso(this.player.x, this.player.y);
    const k = this.settings.reducedMotion ? 1 : clamp(dt * 8, 0, 1);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
  }

  currentZone(): string {
    return zoneAt(this.player.x, this.player.y);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    render(ctx, this, w, h);
  }

  setSettings(s: Partial<Settings>): void {
    this.settings = { ...this.settings, ...s };
    this.audio.muted = this.settings.muted;
    this.audio.volume = this.settings.volume / 100;
    saveSettings(this.settings);
  }

  /** For debugging and tests. */
  debugState(): string {
    return JSON.stringify({ mode: this.mode, pos: [this.player.x, this.player.y], zone: this.currentZone() });
  }
}

