// Practical challenges. Text lives in the locale files (ch.<id>.s<n>); this file holds structure,
// correct answers and the simplified simulations used by "tune" stages.
export type SkillId =
  | 'electronics' | 'mechanics' | 'programming' | 'chemistry' | 'cooking'
  | 'training' | 'agriculture' | 'medicine' | 'construction' | 'logistics';

export const SKILLS: SkillId[] = [
  'electronics', 'mechanics', 'programming', 'chemistry', 'cooking',
  'training', 'agriculture', 'medicine', 'construction', 'logistics',
];

export type StageDef =
  | { type: 'diagnose'; correct: number }
  | { type: 'sequence' }
  | { type: 'quiz'; answers: number[] }
  | { type: 'choose'; correct: number }
  | { type: 'debug'; bugLine: number }
  | { type: 'tune'; params: TuneParam[] };

export interface TuneParam {
  key: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Index into the locale's `opts` for discrete values (null = numeric). */
  opt?: number;
}

export interface ChallengeDef {
  id: string;
  skill: SkillId;
  stages: StageDef[];
  concepts: string[];
  xp: number;
  /** Requirements before the challenge can start */
  flag?: string;
  items?: Record<string, number>;
  /** Items consumed when the challenge is completed */
  consume?: Record<string, number>;
  /** Flag set on completion */
  setFlag?: string;
}

export const CHALLENGES: Record<string, ChallengeDef> = {
  pump: {
    id: 'pump', skill: 'mechanics', xp: 90, flag: 'talked_oskar', items: { valve_gasket: 1 }, consume: { valve_gasket: 1 },
    concepts: ['pressure', 'check_valve', 'flow_direction', 'evidence', 'magic_not_skill'],
    stages: [{ type: 'diagnose', correct: 2 }, { type: 'sequence' }],
  },
  lantern: {
    id: 'lantern', skill: 'programming', xp: 80, flag: 'talked_pim',
    concepts: ['comparison', 'state_machine', 'tracing'],
    stages: [{ type: 'debug', bugLine: 4 }, { type: 'choose', correct: 0 }],
  },
  meal: {
    id: 'meal', skill: 'cooking', xp: 80, flag: 'talked_lio', items: { carrot: 1, beans: 1, grain: 1 }, consume: { carrot: 1, beans: 1, grain: 1 },
    concepts: ['balanced_plate', 'food_cooling', 'preservation'],
    stages: [{ type: 'quiz', answers: [1, 1, 1] }, { type: 'sequence' }],
  },
  bridge: {
    id: 'bridge', skill: 'construction', xp: 120, flag: 'talked_ysolde', items: { timber: 4, iron_nails: 6 }, consume: { timber: 4, iron_nails: 6 },
    setFlag: 'bridge_fixed',
    concepts: ['beam_depth', 'span_piers', 'safety_factor', 'logistics_order'],
    stages: [
      { type: 'tune', params: [
        { key: 'depth', min: 4, max: 20, step: 1, value: 8 },
        { key: 'piers', min: 0, max: 2, step: 1, value: 0 },
        { key: 'material', min: 0, max: 1, step: 1, value: 0, opt: 2 },
        { key: 'truss', min: 0, max: 1, step: 1, value: 0, opt: 3 },
      ] },
      { type: 'quiz', answers: [1, 1] },
    ],
  },
  chip: {
    id: 'chip', skill: 'electronics', xp: 150, flag: 'chip_req',
    items: { copper_wire: 2, clear_resin: 1, silicate_wafer: 1, ley_shard: 1 },
    consume: { copper_wire: 2, clear_resin: 1, silicate_wafer: 1, ley_shard: 1 },
    concepts: ['circuit_stages', 'conductors', 'cleanliness', 'open_circuit', 'ley_energy'],
    stages: [{ type: 'quiz', answers: [1, 1, 0] }, { type: 'sequence' }, { type: 'diagnose', correct: 1 }],
  },
  farm: {
    id: 'farm', skill: 'agriculture', xp: 90, flag: 'talked_brin',
    concepts: ['water_balance', 'root_oxygen'],
    stages: [
      { type: 'tune', params: [
        { key: 'crop', min: 0, max: 2, step: 1, value: 0, opt: 0 },
        { key: 'season', min: 0, max: 2, step: 1, value: 1, opt: 1 },
        { key: 'water', min: 0, max: 8, step: 1, value: 2 },
        { key: 'mulch', min: 0, max: 1, step: 1, value: 0, opt: 3 },
      ] },
      { type: 'quiz', answers: [1, 1] },
    ],
  },
  training: {
    id: 'training', skill: 'training', xp: 90, flag: 'talked_dace',
    concepts: ['progressive_load', 'recovery'],
    stages: [
      { type: 'tune', params: [
        { key: 'sessions', min: 1, max: 6, step: 1, value: 3 },
        { key: 'intensity', min: 1, max: 10, step: 1, value: 5 },
        { key: 'ramp', min: 0, max: 30, step: 5, value: 5 },
      ] },
      { type: 'quiz', answers: [1, 1] },
    ],
  },
  triage: {
    id: 'triage', skill: 'medicine', xp: 70, flag: 'talked_sanne',
    concepts: ['bleeding'],
    stages: [{ type: 'sequence' }, { type: 'quiz', answers: [1] }],
  },
  lab: {
    id: 'lab', skill: 'chemistry', xp: 70, flag: 'talked_hal',
    concepts: ['lab_safety', 'cleanliness'],
    stages: [{ type: 'quiz', answers: [1, 1] }, { type: 'sequence' }],
  },
};

// ---------- Simplified simulations (game models, not engineering tools) ----------

export interface BridgeResult { seg: number; demand: number; cap: number; sf: number; cost: number; pass: boolean; tips: number[]; }
/**
 * Bridge model: gap 24 units. Piers split the span. Bending demand = w·s²/8, capacity = σ·d²/6,
 * where effective depth d grows with a truss. Timber budget is 18.
 */
export function evalBridge(v: Record<string, number>): BridgeResult {
  const piers = v.piers;
  const iron = v.material === 1;
  const truss = v.truss === 1;
  const depth = v.depth;
  const seg = 24 / (piers + 1);
  const w = 1.0 + 0.05 * depth + (iron ? 0.5 : 0) + (truss ? 0.3 : 0);
  const demand = (w * seg * seg) / 8;
  const sigma = iron ? 18 : 6;
  const cap = (sigma * Math.pow(depth * (truss ? 1.6 : 1), 2)) / 6;
  const sf = cap / demand;
  const cost = depth * (iron ? 2 : 1) + piers * 4 + (truss ? 3 : 0);
  const pass = sf >= 1.5 && cost <= 18;
  const tips: number[] = [];
  if (sf < 1.5) tips.push(0);
  if (cost > 18) tips.push(1);
  if (truss && !pass) tips.push(2);
  return { seg, demand, cap, sf, cost, pass, tips };
}

export interface FarmResult { moisture: number; health: number; used: number; runoff: number; pass: boolean; tips: number[]; band: [number, number]; }
const CROPS: { band: [number, number]; use: number }[] = [
  { band: [50, 70], use: 3 }, // beans
  { band: [55, 75], use: 2.5 }, // carrots
  { band: [45, 65], use: 3.5 }, // grain
];
const SEASONS: { evap: number; rain: number; sun: number }[] = [
  { evap: 2.5, rain: 2, sun: 0.9 }, // spring
  { evap: 5, rain: 0.5, sun: 1.2 }, // summer
  { evap: 3, rain: 2, sun: 0.8 }, // autumn
];
/** Soil-moisture model: supply (rain + irrigation) vs demand (evaporation + crop use). */
export function evalFarm(v: Record<string, number>): FarmResult {
  const crop = CROPS[v.crop];
  const s = SEASONS[v.season];
  const evap = s.evap * (v.mulch ? 0.6 : 1);
  const demand = evap + crop.use * s.sun;
  const supply = s.rain + v.water;
  const moisture = Math.max(0, Math.min(100, (supply / demand) * 60));
  const [lo, hi] = crop.band;
  let health = 100;
  if (moisture < lo) health = Math.max(0, 100 - (lo - moisture) * 3);
  if (moisture > hi) health = Math.max(0, 100 - (moisture - hi) * 4);
  const runoff = Math.max(0, supply - demand);
  const tips: number[] = [];
  if (moisture < lo) tips.push(0);
  if (moisture > hi) tips.push(1);
  if (runoff > 1) tips.push(2);
  return { moisture, health, used: v.water * 7, runoff, pass: health >= 80 && runoff <= 1, tips, band: crop.band };
}

export interface TrainResult { gain: number; risk: number; last: number; loads: number[]; pass: boolean; tips: number[]; }
/** Training model: weekly load ramps by `ramp`%; gains need enough load; risk rises with fast ramps and little rest. */
export function evalTraining(v: Record<string, number>): TrainResult {
  const base = v.sessions * v.intensity;
  const loads: number[] = [];
  for (let w = 0; w < 4; w++) loads.push(base * Math.pow(1 + v.ramp / 100, w));
  let gain = 0;
  let risk = 0;
  const rest = 7 - v.sessions;
  for (let w = 0; w < 4; w++) {
    gain += Math.min(1, loads[w] / 40) * 25;
    if (w > 0) {
      const ratio = loads[w] / loads[w - 1];
      if (ratio > 1.1) risk += (ratio - 1.1) * 100;
    }
    if (rest < 2) risk += 15;
    if (v.intensity > 8) risk += 10;
  }
  risk = Math.min(100, risk);
  const tips: number[] = [];
  if (gain < 60) tips.push(0);
  if (risk > 30 && v.ramp > 10) tips.push(1);
  if (rest < 2) tips.push(2);
  return { gain, risk, last: loads[3], loads, pass: gain >= 60 && risk <= 30, tips };
}
