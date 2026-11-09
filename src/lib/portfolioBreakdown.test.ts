import { describe, it, expect } from 'vitest';
import { portfolioSlices, assetResults, standouts } from './portfolioBreakdown';

const A = (id: string, price: number, type = 'stock') => ({ id, ticker: id.toUpperCase(), name: id, type, currentPrice: price });

describe('portfolio breakdown', () => {
  it('slices sum to 100% and include cash', () => {
    const s = portfolioSlices([A('aapl', 10), A('gold', 5, 'gold')], { aapl: 30, gold: 20 }, 100);
    expect(s.map(x => x.pct)).toEqual([60, 20, 20]);
    expect(s[2].label).toBe('Cash/Savings');
  });

  it('profit counts locked-in gains from sales, never deposits', () => {
    // Bought $1,000, sold half for $1,500 (realized +1,000), rest now worth $500.
    const r = assetResults([A('msft', 5)], { msft: 100 }, { msft: 500 }, { msft: 1000 }, { msft: 1000 });
    expect(r[0].profit).toBe(1000);
    expect(r[0].returnPct).toBe(100);
  });

  it('a fully sold winner still counts', () => {
    const r = assetResults([A('nvda', 50)], { nvda: 0 }, { nvda: 0 }, { nvda: 2000 }, { nvda: 6000 });
    expect(r[0].profit).toBe(6000);
    expect(r[0].returnPct).toBe(300);
  });

  it('picks most money and best % separately', () => {
    const r = assetResults([A('big', 1), A('fast', 1)], { big: 30000, fast: 400 }, { big: 10000, fast: 100 }, undefined, undefined);
    const s = standouts(r)!;
    expect(s.mostMoney.id).toBe('big'); // +$20,000 (200%)
    expect(s.bestPct.id).toBe('fast'); // +$300 (300%)
    expect(s.carriedShare).toBeCloseTo((20000 / 20300) * 100);
  });
});
