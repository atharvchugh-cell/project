import type { Career } from './career';
import { post } from './journal';
import { quarterLabel } from '@/lib/fund/engine';
import { mulberry32 } from '@/lib/fund/market';
import { reputation } from './life';
import { scaleOf } from './career';

export interface Level { level: number; name: string; from: number; to: number; of: number }
export const FAME_LEVELS: [number, string][] = [[0, 'Unknown'], [6, 'Local name'], [12, 'Rising name'], [20, 'Talked about'], [30, 'Industry name'], [40, 'Industry star'], [52, 'Wall Street star'], [64, 'Household name'], [78, 'Market icon'], [90, 'Legend']];
export const PRESTIGE_LEVELS: [number, string][] = [[0, 'Newcomer'], [15, 'Respected'], [28, 'Established'], [40, 'Distinguished'], [52, 'Elite'], [64, 'Renowned'], [78, 'Titan'], [90, 'Legendary']];
export function levelOf(levels: [number, string][], v: number): Level {
  let i = 0; while (i + 1 < levels.length && v >= levels[i + 1][0]) i++;
  return { level: i + 1, name: levels[i][1], from: levels[i][0], to: levels[i + 1]?.[0] ?? 100, of: levels.length };
}
export function performanceProfile(c: Career) {
  const h = c.fund.history.filter(x => Number.isFinite(x.ret) && Number.isFinite(x.bench));
  const last = h.slice(-4);
  const compound = (xs: typeof h, key: 'ret' | 'bench') => xs.reduce((v, x) => v * (1 + x[key]), 1) - 1;
  const edge = last.length ? compound(last, 'ret') - compound(last, 'bench') : 0;
  const annualEdge = h.length ? (compound(h, 'ret') - compound(h, 'bench')) / Math.max(1, h.length / 4) : 0;
  const streak = [...h].reverse().findIndex(x => x.ret <= x.bench);
  const winningQuarters = streak < 0 ? h.length : streak;
  // Slow-building standing: years of real S&P-relative results, not one good quarter.
  const prestige = Math.max(0, Math.min(100, Math.round(10 + annualEdge * 110 + Math.min(12, winningQuarters) + Math.min(10, h.length * 0.25) - h.filter(x => x.latePayment).length * 5)));
  const fame = Math.max(0, Math.min(100, Math.round(Math.max(0, annualEdge) * 100 + Math.min(10, h.length * 0.3) + Math.min(12, winningQuarters) + c.press.filter(x => x.q <= c.fund.q).length * 0.2)));
  const demand = last.length >= 4 && edge > 0 && !last.some(x => x.latePayment) ? Math.min(1, 0.25 + edge * 3 + Math.min(0.25, winningQuarters * 0.025) + (c.immersion ? fame / 500 : 0)) : 0;
  const fl = levelOf(FAME_LEVELS, fame); const pl = levelOf(PRESTIGE_LEVELS, prestige);
  return { edge, annualEdge, prestige, fame, winningQuarters, demand, title: fl.name, fameLevel: fl, prestigeLevel: pl };
}

/** Fame helps only with a complete, valid, positive trailing benchmark edge. */
export function fameEffects(c: Career) {
  const p = performanceProfile(c); const h = c.fund.history.slice(-4);
  const active = !!c.immersion && c.status === 'running' && c.fund.status !== 'ended' && h.length === 4 && h.every(x => Number.isFinite(x.ret) && Number.isFinite(x.bench) && !x.latePayment) && p.edge > 0;
  const strength = active ? p.fame / 100 : 0;
  return { fame: p.fame, active, offerPoints: strength * 0.1, salaryMultiplier: 1 + strength * 0.25, coveragePressure: Math.round(strength * 6) };
}

/** Outside advisory/research/service retainers, never a second posting of fund fees. */
export function staffServiceQuote(c: Career, q = c.fund.q + 1) {
  if (!c.immersion || c.status !== 'running') return [];
  const rep = reputation(c).score;
  return c.roster.map(e => {
    const rand = mulberry32(c.fund.seed * 811 + q * 307 + e.seed);
    const effort = 0.6 + e.morale / 250;
    const multiple = (0.25 + e.ability / 80) * effort * (0.75 + rep / 200) * (0.8 + rand() * 0.4);
    return { id: e.id, name: e.name, amount: Math.round(350000 * scaleOf(c) * multiple * 100) / 100 };
  });
}
export function staffServiceAtClose(c: Career, q: number, closeId: string, quote = staffServiceQuote(c, q)) {
  for (const x of quote) post(c.journal, { q, date: quarterLabel(c.fund, q), payer: 'external', recipient: 'firm', category: 'staff_revenue', amount: x.amount, source: `staff:${q}:${x.id}`, memo: `${x.name}: outside client service retainer`, closeId });
}
export const enableImmersion = (c: Career): Career => c.status === 'running' ? { ...c, immersion: true } : c;

