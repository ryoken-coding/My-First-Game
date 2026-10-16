// Six magical affinities, their abilities and the combination rules.
// FICTION RULE: Ley is the valley's ambient magical current; abilities are game-world magic.
export type AffId = 'anti' | 'enh' | 'emi' | 'tra' | 'man' | 'con';
export const AFFS: AffId[] = ['anti', 'enh', 'emi', 'tra', 'man', 'con'];

export const AFF_COLOR: Record<AffId, string> = {
  anti: '#c1487a', // rose-magenta
  enh: '#e0883a', // amber
  emi: '#4fb3e8', // sky
  tra: '#7bcf5b', // green
  man: '#a77de0', // violet
  con: '#e8d24e', // gold
};

export type AbilityId =
  | 'ward' | 'unravel' | 'iron' | 'surge' | 'bolt' | 'pulse' | 'shot' | 'pull' | 'push' | 'shield' | 'familiar'
  | 'lance' | 'gravity' | 'null' | 'gale';

export interface AbilityDef {
  id: AbilityId;
  /** Primary affinity; for combinations, the two required affinities. */
  aff: AffId | [AffId, AffId];
  /** Mastery needed (0 = basic). */
  mastery: number;
  cost: number;
  cooldown: number;
  /** Short key for the on-screen icon */
  glyph: string;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  ward: { id: 'ward', aff: 'anti', mastery: 0, cost: 14, cooldown: 6, glyph: 'W' },
  unravel: { id: 'unravel', aff: 'anti', mastery: 2, cost: 18, cooldown: 8, glyph: 'U' },
  iron: { id: 'iron', aff: 'enh', mastery: 0, cost: 6, cooldown: 12, glyph: 'I' },
  surge: { id: 'surge', aff: 'enh', mastery: 2, cost: 12, cooldown: 5, glyph: 'S' },
  bolt: { id: 'bolt', aff: 'emi', mastery: 0, cost: 10, cooldown: 1.2, glyph: 'B' },
  pulse: { id: 'pulse', aff: 'emi', mastery: 2, cost: 20, cooldown: 6, glyph: 'P' },
  shot: { id: 'shot', aff: 'tra', mastery: 0, cost: 16, cooldown: 4, glyph: 'L' },
  pull: { id: 'pull', aff: 'man', mastery: 0, cost: 10, cooldown: 4, glyph: 'G' },
  push: { id: 'push', aff: 'man', mastery: 2, cost: 8, cooldown: 3, glyph: 'H' },
  shield: { id: 'shield', aff: 'con', mastery: 0, cost: 16, cooldown: 8, glyph: 'C' },
  familiar: { id: 'familiar', aff: 'con', mastery: 2, cost: 25, cooldown: 14, glyph: 'F' },
  lance: { id: 'lance', aff: ['emi', 'tra'], mastery: 0, cost: 30, cooldown: 8, glyph: 'X' },
  gravity: { id: 'gravity', aff: ['man', 'con'], mastery: 0, cost: 24, cooldown: 10, glyph: 'Y' },
  null: { id: 'null', aff: ['anti', 'enh'], mastery: 0, cost: 20, cooldown: 8, glyph: 'N' },
  gale: { id: 'gale', aff: ['emi', 'man'], mastery: 0, cost: 16, cooldown: 5, glyph: 'A' },
};

export const ABILITY_IDS = Object.keys(ABILITIES) as AbilityId[];
export const SINGLE_ABILITIES = ABILITY_IDS.filter((id) => typeof ABILITIES[id].aff === 'string');
export const COMBO_ABILITIES = ABILITY_IDS.filter((id) => Array.isArray(ABILITIES[id].aff));

/** Potency multiplier: strong affinity percentages and mastery make abilities stronger. */
export function potency(affPct: number, masteryLevel: number): number {
  return 0.5 + (affPct / 100) * 1.5 + masteryLevel * 0.04;
}

/** Mastery grows with use: level = floor(sqrt(xp/4)), capped at 10. */
export function masteryLevel(xp: number): number {
  return Math.min(10, Math.floor(Math.sqrt(xp / 4)));
}

export const COMBO_THRESHOLD = 25;
export const COMBO_MASTERY = 0;

export function comboUnlocked(aff: number[], combo: AbilityDef): boolean {
  if (!Array.isArray(combo.aff)) return false;
  const [a, b] = combo.aff.map((x) => AFFS.indexOf(x));
  return aff[a] >= COMBO_THRESHOLD && aff[b] >= COMBO_THRESHOLD;
}

/** Ability availability for a character: matching affinity mastery requirement. */
export function abilityAvailable(id: AbilityId, pcts: number[], mastery: number[]): boolean {
  const def = ABILITIES[id];
  if (Array.isArray(def.aff)) return comboUnlocked(pcts, def);
  const i = AFFS.indexOf(def.aff);
  return mastery[i] >= def.mastery;
}
