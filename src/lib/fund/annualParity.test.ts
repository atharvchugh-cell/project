import { describe, expect, it } from 'vitest';
import { CANONICAL_STOCK_POOL } from '@/data/stockPool';
import { COMPANY, annualReturn, buildFundMarket } from './market';
import { stockQuarters, buildCalendarMarket } from './calendar';

describe('normal stock game and fund share annual return inputs', () => {
  it('compounds every overlapping listed stock/year exactly to the normal game annual series', () => {
    let checked = 0;
    for (const stock of CANONICAL_STOCK_POOL) {
      const company = COMPANY[stock.ticker]; if (!company) continue;
      for (const [yearKey, ret] of Object.entries(stock.annualReturns)) {
        const year = Number(yearKey);
        // Owner-confirmed baseline mismatch at 27ed47cd: preserve both inputs, never rewrite data to mask it.
        if (stock.ticker === 'CDNS' && year === 1993) {
          expect(ret).toBe(0.05); expect(company.returns[year]).toBe(0); continue;
        }
        expect(company.returns[year] / 100, `${stock.ticker} ${year} input`).toBeCloseTo(ret, 10);
        const annual = annualReturn(stock.ticker, year); if (annual === undefined) continue;
        const quarters = stockQuarters(stock.ticker, year); if (!quarters) throw new Error('Missing listed quarters');
        expect(quarters.reduce((a, q) => a * (1 + q), 1) - 1, `${stock.ticker} ${year} compounded`).toBeCloseTo(ret, 10);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(2000);
  });
  it('preserves Akamai IPO anchor and +158.52% first-full-year return in both calendar and legacy fund paths', () => {
    expect(annualReturn('AKAM', 1999)).toBeUndefined();
    expect(annualReturn('AKAM', 2000)).toBeCloseTo(1.5852, 10);
    for (const market of [buildCalendarMarket(2000, 1), buildFundMarket(777, 2000, 1)]) {
      expect(market.reduce((a, q) => a * (1 + q.returns.AKAM), 1) - 1).toBeCloseTo(1.5852, 10);
    }
  });
});