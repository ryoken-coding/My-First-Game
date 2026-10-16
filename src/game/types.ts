// Shared types for the savegame and runtime entities.
import type { AbilityId, AffId } from '../data/affinities';
import type { EnemyType } from '../data/content';

export interface ChallengeProgress {
  done: boolean;
  stage: number;
  hintsUsed: number;
  attempts: number;
}

export interface SaveData {
  v: 2;
  name: string;
  /** Affinity percentages, always total 100, index aligned with AFFS */
  pcts: number[];
  /** Raw affinity experience (mastery is derived) */
  affXp: number[];
  level: number;
  xp: number;
  points: number;
  stats: { str: number; vit: number; agi: number; mind: number };
  skillXp: Record<string, number>;
  concepts: string[];
  inv: Record<string, number>;
  slots: (AbilityId | null)[];
  flags: Record<string, boolean>;
  kills: Record<string, number>;
  questsDone: string[];
  challenges: Record<string, ChallengeProgress>;
  chests: string[];
  affUsed: AffId[];
  combos: AbilityId[];
  pos: { x: number; y: number };
  tutorial: string[];
  atelier: boolean;
  manual: boolean;
  journalNotes: string[];
}

// ---------- runtime ----------
export interface Enemy {
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number; // > 0 means shielded (wisp/guardian)
  stun: number;
  cd: number;
  windup: number; // telegraph timer (boar charge, guardian)
  charge: number; // remaining charge time
  cdx: number;
  cdy: number;
  flash: number;
  home: { x: number; y: number };
  spawnIndex: number;
  dead: boolean;
  respawn: number;
  boss: boolean;
  meleeHits: number;
  phase: number;
  bob: number;
  revealed: boolean;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  team: 'player' | 'enemy';
  life: number;
  magic: boolean;
  kind: 'bolt' | 'shot' | 'spark' | 'thorn' | 'gale' | 'wisp' | 'lance';
  knock: number;
  stun: number;
}

export interface Pickup {
  x: number;
  y: number;
  item: string;
  n: number;
}

export interface Effect {
  kind: 'text' | 'ring' | 'burst' | 'line';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  t: number;
  life: number;
  text?: string;
  color: string;
  size?: number;
}

export interface Barrier { x: number; y: number; hp: number; t: number; }
export interface Familiar { x: number; y: number; t: number; cd: number; }
export interface Well { x: number; y: number; t: number; }

export type Mode = 'title' | 'create' | 'play' | 'dialogue' | 'menu' | 'challenge' | 'pause' | 'dead';
