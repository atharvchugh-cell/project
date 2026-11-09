import type { Career } from './career';

/** Two non-overlapping completed years, net of fund fees; deposits never enter returns. */
export function investorDemand(c: Career) {
  const h = c.fund.history.slice(-8);
  const edge = (from: number) => {
    const year = h.slice(from, from + 4);
    const compound = (key: 'ret' | 'bench') => year.reduce((v, x) => v * (1 + x[key]), 1) - 1;
    return compound('ret') - compound('bench');
  };
  const previous = h.length === 8 ? edge(0) : 0;
  const recent = h.length === 8 ? edge(4) : 0;
  return { previous, recent, qualified: c.status === 'running' && c.fund.status !== 'ended' && h.length === 8 && h.every(x => Number.isFinite(x.ret) && Number.isFinite(x.bench) && !x.latePayment) && previous >= 0.1 && recent >= 0.1 };
}