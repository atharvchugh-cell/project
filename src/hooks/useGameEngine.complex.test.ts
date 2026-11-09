import { describe, it, expect } from 'vitest';
import { buildComplexAssetConfig } from './useGameEngine';
import { COMPLEX_TICKER_INDEX, validateComplexReturns } from '@/data/complexReturns';

/**
 * yearEndPrices[g] for g >= 1 = price at end of calendar year (startYear + g - 1).
 * In the engine, prices are sampled at index 24*g, so prices[24*g] should equal
 * yearEndPrices[g] (built via linear interpolation between yearly anchors).
 */
function yearEndPriceAt(prices: number[], gameYear: number): number {
  return prices[24 * gameYear];
}

describe('buildComplexAssetConfig — year-end price ↔ documented returns', () => {
  it('AIG 2008 collapses by ~97.31% (the documented return for 2008)', () => {
    const aig = COMPLEX_TICKER_INDEX['AIG'];
    expect(aig).toBeDefined();
    const startYear = 2000;
    const duration = 20;
    const cfg = buildComplexAssetConfig(aig, startYear, duration);

    // Game year 9 closes calendar year 2008 (startYear + 9 - 1 = 2008).
    const end2007 = yearEndPriceAt(cfg.prices, 8);
    const end2008 = yearEndPriceAt(cfg.prices, 9);
    const expectedRatio = 1 + aig.returns[2008] / 100; // ~0.0269

    expect(end2007).toBeGreaterThan(0);
    expect(end2008 / end2007).toBeCloseTo(expectedRatio, 4);
  });

  it('every consecutive year-end ratio matches that year’s documented return', () => {
    const tickers = ['AAPL', 'AMZN', 'AIG', 'ADBE', 'AMD', 'GOOGL'];
    const startYear = 2000;
    const duration = 25;

    for (const ticker of tickers) {
      const company = COMPLEX_TICKER_INDEX[ticker];
      if (!company) continue;
      const cfg = buildComplexAssetConfig(company, startYear, duration);

      for (let g = 1; g <= duration; g++) {
        const yearBeingClosed = startYear + g - 1;
        if (yearBeingClosed <= company.firstAvailableYear) continue; // anchor / pre-IPO
        const r = company.returns[yearBeingClosed];
        if (r === undefined) continue;

        const prev = yearEndPriceAt(cfg.prices, g - 1);
        const curr = yearEndPriceAt(cfg.prices, g);
        if (prev === 0) continue; // not yet listed

        const expected = 1 + r / 100;
        const actual = curr / prev;
        expect(actual, `${ticker} return for ${yearBeingClosed} (game year ${g})`).toBeCloseTo(expected, 4);
      }
    }
  });

  it('post-IPO companies anchor at $100 in their firstAvailableYear', () => {
    const abbv = COMPLEX_TICKER_INDEX['ABBV']; // firstAvailableYear: 2013
    expect(abbv).toBeDefined();
    const startYear = 2010;
    const duration = 10;
    const cfg = buildComplexAssetConfig(abbv, startYear, duration);

    // Game years 1..3 close 2010..2012 → company didn't exist → 0
    expect(yearEndPriceAt(cfg.prices, 1)).toBe(0);
    expect(yearEndPriceAt(cfg.prices, 3)).toBe(0);
    // Game year 4 closes 2013 (firstAvailableYear) → anchor at $100
    expect(yearEndPriceAt(cfg.prices, 4)).toBeCloseTo(100, 4);
    // Game year 5 closes 2014 → 100 * (1 + 23.92/100)
    expect(yearEndPriceAt(cfg.prices, 5)).toBeCloseTo(100 * (1 + abbv.returns[2014] / 100), 3);
  });

  it('pre-roll correctly compounds prior years before startYear', () => {
    // AAPL anchors at end-1990 = $100. Verify start-of-game price (gameYear 0)
    // for startYear=2000 equals 100 * Π_{y=1991..1999}(1+r/100).
    const aapl = COMPLEX_TICKER_INDEX['AAPL'];
    let expected = 100;
    for (let y = 1991; y <= 1999; y++) expected *= 1 + aapl.returns[y] / 100;
    const cfg = buildComplexAssetConfig(aapl, 2000, 10);
    expect(yearEndPriceAt(cfg.prices, 0)).toBeCloseTo(expected, 3);
  });
});

describe('validateComplexReturns — data integrity', () => {
  it('reports no issues for the shipped dataset', () => {
    const issues = validateComplexReturns();
    if (issues.length > 0) console.error('Complex-returns integrity issues:', issues);
    expect(issues).toEqual([]);
  });
});
