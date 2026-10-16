// World content: NPCs & dialogue scripts, objects, enemy spawns, loot and quests.
import type { AffId } from './affinities';

export type EnemyType = 'slime' | 'boar' | 'sentry' | 'wisp' | 'crawler' | 'guardian';

export interface DialogueScript {
  /** Lines key in dlg (e.g. "maren1") */
  lines: string;
  /** All of these must be true: flag name, or "done:<challenge>" */
  cond?: string[];
  /** None of these may be true */
  not?: string[];
  /** Flags set after the dialogue finishes */
  set?: string[];
}

export interface NpcDef {
  id: string;
  name: string; // i18n key npc.<id>
  x: number;
  y: number;
  look: { skin: string; hair: string; top: string; bottom: string; accent?: string; hat?: 'none' | 'hood' | 'cap' | 'wide' | 'bun' | 'band'; beard?: boolean; apron?: boolean; tall?: boolean };
  scripts: DialogueScript[];
}

export const NPCS: NpcDef[] = [
  {
    id: 'maren', name: 'maren', x: 24, y: 21,
    look: { skin: '#e7b88e', hair: '#e8e0c8', top: '#7a4f9a', bottom: '#3d2d52', accent: '#f0d060', hat: 'hood' },
    scripts: [
      { lines: 'maren1', not: ['talked_maren'], set: ['talked_maren'] },
      { lines: 'maren2', cond: ['talked_maren'], not: ['done:pump'] },
      { lines: 'maren3', cond: ['done:pump'], not: ['maren_thanked'], set: ['maren_thanked'] },
      { lines: 'maren4', cond: ['maren_thanked'] },
    ],
  },
  {
    id: 'oskar', name: 'oskar', x: 31, y: 9,
    look: { skin: '#d9a77c', hair: '#6a4a2e', top: '#3e7f9f', bottom: '#2c3b4a', apron: true, hat: 'cap' },
    scripts: [
      { lines: 'oskar1', not: ['talked_oskar'], set: ['talked_oskar'] },
      { lines: 'oskar2', cond: ['talked_oskar'], not: ['done:pump'] },
      { lines: 'oskar3', cond: ['done:pump'], not: ['oskar_praised'], set: ['oskar_praised'] },
      { lines: 'oskar4', cond: ['oskar_praised'], not: ['chip_req'], set: ['chip_req'] },
      { lines: 'oskar5', cond: ['chip_req'], not: ['done:chip'] },
      { lines: 'oskar6', cond: ['done:chip'] },
    ],
  },
  {
    id: 'pim', name: 'pim', x: 31, y: 21,
    look: { skin: '#f0c8a8', hair: '#3a2a4a', top: '#4fb3e8', bottom: '#2a3a52', hat: 'bun' },
    scripts: [
      { lines: 'pim1', not: ['talked_pim'], set: ['talked_pim'] },
      { lines: 'pim2', cond: ['done:lantern'], not: ['pim_thanked'], set: ['pim_thanked'] },
      { lines: 'pim3', cond: ['pim_thanked'] },
    ],
  },
  {
    id: 'lio', name: 'lio', x: 25, y: 27,
    look: { skin: '#b97a50', hair: '#1e1a22', top: '#e0883a', bottom: '#6a4a2a', apron: true, hat: 'band' },
    scripts: [
      { lines: 'lio1', not: ['talked_lio'], set: ['talked_lio'] },
      { lines: 'lio2', cond: ['done:meal'] },
    ],
  },
  {
    id: 'brin', name: 'brin', x: 16, y: 17,
    look: { skin: '#e0b088', hair: '#c9a24a', top: '#7bcf5b', bottom: '#5b4a3a', hat: 'wide' },
    scripts: [
      { lines: 'brin1', not: ['talked_brin'], set: ['talked_brin'] },
      { lines: 'brin2', cond: ['done:farm'] },
    ],
  },
  {
    id: 'ysolde', name: 'ysolde', x: 32, y: 16,
    look: { skin: '#f0c8a8', hair: '#8a3a2a', top: '#b5523b', bottom: '#3a2f2a', hat: 'cap' },
    scripts: [
      { lines: 'ysolde1', not: ['talked_ysolde'], set: ['talked_ysolde'] },
      { lines: 'ysolde2', cond: ['done:bridge'] },
    ],
  },
  {
    id: 'dace', name: 'dace', x: 45, y: 23,
    look: { skin: '#8a5a3b', hair: '#1e1a22', top: '#c9a24a', bottom: '#4a3a2a', tall: true, hat: 'band' },
    scripts: [
      { lines: 'dace1', not: ['talked_dace'], set: ['talked_dace'] },
      { lines: 'dace2', cond: ['talked_dace'], not: ['quest:yard'] },
      { lines: 'dace3', cond: ['done:training'] },
    ],
  },
  {
    id: 'sanne', name: 'sanne', x: 31, y: 27,
    look: { skin: '#f2cfb0', hair: '#c05a3a', top: '#f0f0f0', bottom: '#4a6fa5', hat: 'none' },
    scripts: [
      { lines: 'sanne1', not: ['talked_sanne'], set: ['talked_sanne'] },
      { lines: 'sanne2', cond: ['done:triage'] },
    ],
  },
  {
    id: 'hal', name: 'hal', x: 33, y: 14,
    look: { skin: '#d0a07a', hair: '#9aa0a8', top: '#68d391', bottom: '#2d4a3a', beard: true, hat: 'none' },
    scripts: [
      { lines: 'hal1', not: ['talked_hal'], set: ['talked_hal'] },
      { lines: 'hal2', cond: ['done:lab'] },
    ],
  },
];

export type ObjKind = 'pump' | 'lantern' | 'stove' | 'chipBench' | 'bridge' | 'valve' | 'board' | 'medic' | 'lab' | 'tower' | 'chest' | 'sign' | 'barrel' | 'dummy' | 'crate' | 'pumpHouse';

export interface ObjDef {
  id: string;
  kind: ObjKind;
  x: number;
  y: number;
  /** Loot for chests/crates (once) */
  loot?: Record<string, number>;
  /** Localised dialogue key for flavour objects */
  text?: string;
}

export const OBJECTS: ObjDef[] = [
  { id: 'pump', kind: 'pump', x: 25, y: 18 },
  { id: 'sign', kind: 'sign', x: 25, y: 20, text: 'sign' },
  { id: 'barrel', kind: 'barrel', x: 22, y: 16, text: 'barrel' },
  { id: 'lantern', kind: 'lantern', x: 29, y: 17 },
  { id: 'stove', kind: 'stove', x: 27, y: 26 },
  { id: 'chipBench', kind: 'chipBench', x: 30, y: 7 },
  { id: 'bridgeSite', kind: 'bridge', x: 33, y: 18 },
  { id: 'crate', kind: 'crate', x: 32, y: 21, loot: { timber: 4, iron_nails: 6 } },
  { id: 'valve', kind: 'valve', x: 18, y: 6 },
  { id: 'board', kind: 'board', x: 46, y: 28 },
  { id: 'dummy', kind: 'dummy', x: 45, y: 25 },
  { id: 'medic', kind: 'medic', x: 30, y: 26 },
  { id: 'lab', kind: 'lab', x: 32, y: 15 },
  { id: 'tower', kind: 'tower', x: 45, y: 11 },
  { id: 'chestWorks', kind: 'chest', x: 27, y: 4, loot: { valve_gasket: 1, iron_nails: 2 } },
  { id: 'chestFarm', kind: 'chest', x: 4, y: 14, loot: { carrot: 2, beans: 1, grain: 1 } },
  { id: 'chestWilds', kind: 'chest', x: 7, y: 21, loot: { copper_wire: 2, herbs: 2 } },
  { id: 'chestSouth', kind: 'chest', x: 3, y: 30, loot: { clear_resin: 1, ley_shard: 1, bread: 1 } },
  { id: 'chestRuins', kind: 'chest', x: 45, y: 2, loot: { silicate_wafer: 1, lantern_glass: 1 } },
  { id: 'pantry', kind: 'chest', x: 22, y: 26, loot: { salt_pork: 1, bread: 1 } },
];

export interface SpawnDef {
  type: EnemyType;
  x: number;
  y: number;
  /** Boss / one-time spawns don't respawn */
  boss?: boolean;
  /** Spawns only when the flag is true */
  flag?: string;
}

export const SPAWNS: SpawnDef[] = [
  { type: 'slime', x: 9, y: 23 }, { type: 'slime', x: 14, y: 27 }, { type: 'slime', x: 3, y: 25 }, { type: 'slime', x: 12, y: 18 },
  { type: 'boar', x: 6, y: 30 }, { type: 'boar', x: 15, y: 22 },
  { type: 'crawler', x: 4, y: 1 }, { type: 'crawler', x: 13, y: 1 },
  { type: 'sentry', x: 45, y: 4 }, { type: 'sentry', x: 47, y: 13 }, { type: 'sentry', x: 44, y: 9 },
  { type: 'wisp', x: 46, y: 7 }, { type: 'wisp', x: 43, y: 14 },
  { type: 'guardian', x: 45, y: 5, boss: true, flag: 'bridge_fixed' },
];

export const ZONE_LABEL_ORDER = ['village', 'works', 'farm', 'wilds', 'gorge', 'ruins', 'yard'] as const;

export interface QuestDef {
  id: string;
  /** Flags required to start (all). Empty = active from the beginning. */
  start: string[];
  objectives: { id: string; done: string[] }[];
  xp: number;
  items?: Record<string, number>;
  /** Flag / done conditions use the same syntax as dialogue scripts */
}

export const QUESTS: QuestDef[] = [
  { id: 'dry_well', start: [], xp: 120, objectives: [
    { id: 'talkMaren', done: ['talked_maren'] },
    { id: 'talkOskar', done: ['talked_oskar'] },
    { id: 'gasket', done: ['done:pump', 'has:valve_gasket:1'] },
    { id: 'pumpDone', done: ['done:pump'] },
    { id: 'backMaren', done: ['maren_thanked'] },
  ] },
  { id: 'yard', start: ['talked_maren'], xp: 100, objectives: [
    { id: 'talkDace', done: ['talked_dace'] },
    { id: 'dummyAll', done: ['aff4'] },
    { id: 'kills5', done: ['kills5'] },
  ] },
  { id: 'lantern', start: ['talked_maren'], xp: 90, items: { atelier_token: 1 }, objectives: [
    { id: 'talkPim', done: ['talked_pim'] },
    { id: 'lanternDone', done: ['done:lantern'] },
  ] },
  { id: 'chip', start: ['chip_req'], xp: 160, objectives: [
    { id: 'talkOskar2', done: ['chip_req'] },
    { id: 'gatherChip', done: ['done:chip', 'has:copper_wire:2', 'has:clear_resin:1', 'has:silicate_wafer:1', 'has:ley_shard:1'] },
    { id: 'chipDone', done: ['done:chip'] },
  ] },
  { id: 'meal', start: ['talked_maren'], xp: 90, objectives: [
    { id: 'talkLio', done: ['talked_lio'] },
    { id: 'mealDone', done: ['done:meal'] },
  ] },
  { id: 'gorge', start: ['talked_maren'], xp: 130, objectives: [
    { id: 'talkYsolde', done: ['talked_ysolde'] },
    { id: 'gatherTimber', done: ['done:bridge', 'has:timber:4', 'has:iron_nails:6'] },
    { id: 'bridgeDone', done: ['done:bridge'] },
    { id: 'crossGorge', done: ['east_side'] },
  ] },
  { id: 'fields', start: ['talked_maren'], xp: 90, objectives: [
    { id: 'talkBrin', done: ['talked_brin'] },
    { id: 'fieldsDone', done: ['done:farm'] },
  ] },
  { id: 'steady', start: ['quest:yard'], xp: 90, objectives: [
    { id: 'trainDone', done: ['done:training'] },
  ] },
  { id: 'medic', start: ['talked_maren'], xp: 90, objectives: [
    { id: 'talkSanne', done: ['talked_sanne'] },
    { id: 'medicDone', done: ['done:triage'] },
  ] },
  { id: 'lab', start: ['talked_hal'], xp: 70, objectives: [
    { id: 'labDone', done: ['done:lab'] },
  ] },
  { id: 'tower', start: ['bridge_fixed'], xp: 300, objectives: [
    { id: 'crossGorge', done: ['east_side'] },
    { id: 'towerDone', done: ['guardian_dead'] },
  ] },
];

/** Affinity keys for the "use all four affinity types" objective */
export const AFF_KEYS: AffId[] = ['anti', 'enh', 'emi', 'tra', 'man', 'con'];
