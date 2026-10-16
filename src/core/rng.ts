// Random helpers. The affinity roll uses the Web Crypto API when available.
import type { AffId } from '../data/affinities';

/** Uniform float in [0,1). Uses crypto when present for better-quality rolls. */
export function randUnit(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

export const randInt = (lo: number, hi: number): number => lo + Math.floor(randUnit() * (hi - lo + 1));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(randUnit() * arr.length)];

/**
 * Rolls six affinity percentages that always total exactly 100 (integers).
 * Method: exponential weights (a Dirichlet(1) sample) → scaled to 100 → largest-remainder rounding.
 */
export function rollAffinities(): number[] {
  const weights = Array.from({ length: 6 }, () => 0.35 + -Math.log(1 - randUnit() * 0.999999));
  return normalizeTo100(weights);
}

/** Converts arbitrary positive weights into integer percentages totalling 100. */
export function normalizeTo100(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / total) * 100);
  const floors = raw.map((v) => Math.floor(v));
  const remaining = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remaining; k++) floors[order[k % order.length].i] += 1;
  return floors;
}

export function affinitySum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export type AffinityRecord = Record<AffId, number>;
