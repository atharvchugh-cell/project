import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { COMPLEX_TICKER_INDEX } from './complexReturns';
import { STOCK_POOL, SP500_ANNUAL_RETURNS } from './historicalData';


describe('corrected historical data (v2)', () => {
  it('Intel 2024 is -60.10% in the advanced data', () => {
    expect(COMPLEX_TICKER_INDEX['INTC'].returns[2024]).toBe(-60.10);
  });
  it('Intel 2024 is -0.6010 in the stock pool', () => {
    const intc = STOCK_POOL.find(s => s.ticker === 'INTC')!;
    expect(intc.annualReturns[2024]).toBe(-0.6010);
  });
  it('the source text cannot restore +65.24%', () => {
    const src = readFileSync('src/data/stock-universe-source.txt', 'utf8');
    expect(src).not.toContain('2024:65.24');
    expect(src).toContain('2024:-60.10');
  });
  it('S&P 500 2008 is -37%', () => {
    expect(SP500_ANNUAL_RETURNS[2008]).toBe(-0.37);
  });
});
