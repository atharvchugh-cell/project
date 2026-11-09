import { describe, expect, it } from 'vitest';
import { ventureOps } from './ventureOps';
import { newCareer } from './career';
import type { Venture } from './ventures';

const career = newCareer({ firmName: 'Test', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified', scenario: 'institutional', years: 10, seed: 5 });
const venture = (level: number): Venture => ({ id: 'x', typeId: 'v-carwash', name: 'Wash', industry: 'services', boughtQ: 0, invested: 0, level, revenueQ: 420e3, costQ: 294e3, reinvestPct: 0, history: [] });

describe('venture operating dashboard', () => {
  it('adds locations and product lines as the business expands', () => {
    const small = ventureOps(career, venture(1)); const big = ventureOps(career, venture(3));
    expect(small.locations).toBe(4); expect(big.locations).toBe(8);
    expect(small.products.filter(p => p.active)).toHaveLength(1);
    expect(big.products.filter(p => p.active)).toHaveLength(3);
  });
  it('product revenue shares add up to 100%', () => {
    const sum = ventureOps(career, venture(4)).products.reduce((a, p) => a + p.share, 0);
    expect(sum).toBeCloseTo(1, 9);
  });
  it('market share is revenue over market size', () => {
    const o = ventureOps(career, venture(1));
    expect(o.marketShare).toBeGreaterThan(0); expect(o.marketShare).toBeLessThan(1);
  });
});
