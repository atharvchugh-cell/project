import type { Career } from './career';
import { fameEffects } from './immersion';
export interface Coverage { q: number; expiresQ: number; target: string; delta: number; headline: string }
export const coverageMood = (c: Career, target: string, q = c.fund.q) => Math.max(-12, Math.min(12, (c.coverage ?? []).filter(x => x.target === target && x.q <= q && q <= x.expiresQ).reduce((a, x) => a + x.delta, 0)));
export const clientMood = (c: Career, id: string) => Math.max(0, Math.min(100, (c.satisfaction[id] ?? 60) + coverageMood(c, 'you')));
export const coverageEdge = (c: Career, rival: string) => (coverageMood(c, 'you') - coverageMood(c, rival)) / 200;

/** Outperforming rivals retain favourable coverage; fame pressures only rivals trailing us. */
export function rivalCoverageDelta(c: Career, rivalReturn: number, favourable: boolean) {
  const h = c.fund.history.slice(-4);
  const ours = h.reduce((v, x) => v * (1 + x.ret), 1) - 1;
  const pressure = ours > rivalReturn ? fameEffects(c).coveragePressure : 0;
  return Math.max(-10, (favourable ? 4 : -4) - pressure);
}