import { describe, expect, it } from 'vitest';
import { SPX, marketFor, newFund, playQuarter } from '@/lib/fund/engine';
import { buildCalendarMarket, indexQuarters, stockQuarters } from '@/lib/fund/calendar';
import { COMPLEX_UNIVERSE } from '@/data/complexReturns';
import { SP500_ANNUAL_RETURNS } from '@/data/historicalData';
import { annualReturn, FIRST_YEAR, LAST_YEAR } from '@/lib/fund/market';
import { nav } from '@/lib/fund/accounting';
import { type Career, RESERVE_QUARTERS, firmCash, newCareer, parseCareer, quarterlyExpenses } from './career';
import { closeQuarter, distribute } from './close';
import { acquire, callable, divest, issueCall, saleValue, settleCalls, totalUncalled } from './phase3';
import { bridges } from './plan';
import { cashForecast } from './forecast';

const opts = { firmName: 'Harbor Hill', fundName: 'Harbor Hill Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed: 4242 };
const prod = (xs: number[]) => xs.reduce((a, x) => a * (1 + x), 1);

describe('calendar quarters', () => {
  it('every index and stock year compounds to exactly the shared annual data', () => {
    for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
      expect(prod(indexQuarters(y))).toBeCloseTo(1 + SP500_ANNUAL_RETURNS[y], 10);
      for (const c of COMPLEX_UNIVERSE) { const qs = stockQuarters(c.ticker, y); const r = annualReturn(c.ticker, y); if (qs && r !== undefined) expect(prod(qs)).toBeCloseTo(1 + r, 10); }
    }
  });
  it('is the same in every game and puts real crashes in the right quarter', () => {
    const a = newFund('normal', 1, 10, false, true); const b = newFund('normal', 999, 10, false, true);
    expect(a.marketRule).toBe('calendar');
    expect(buildCalendarMarket(2005, 10)[15].returns[SPX]).toBe(buildCalendarMarket(2005, 10)[15].returns[SPX]);
    expect(marketFor({ ...a, startYear: 2008 })[0].returns[SPX]).toBe(marketFor({ ...b, startYear: 2008 })[0].returns[SPX]);
    const q08 = indexQuarters(2008); expect(Math.min(...q08)).toBe(q08[3]);
    const q20 = indexQuarters(2020); expect(Math.min(...q20)).toBe(q20[0]);
  });
  it('older saves without the calendar rule keep their seeded quarters', () => {
    const f = newFund('normal', 7, 10, false, true); delete f.marketRule;
    const g = { ...f, seed: 8 };
    expect(marketFor(f)[0].returns[SPX]).not.toBe(marketFor(g)[0].returns[SPX]);
  });
});

describe('mid-quarter trading', () => {
  it('a mid-quarter buy earns only the second half of the quarter move', () => {
    const f = newFund('normal', 3, 10, false, true);
    const r = marketFor(f)[0].returns[SPX];
    const start = playQuarter(f, { orders: [{ ticker: SPX, amount: 1e9 }], acceptOfferIds: [] });
    const mid = playQuarter(f, { orders: [{ ticker: SPX, amount: 1e9, timing: 'mid' }], acceptOfferIds: [] });
    expect(start.pnl[SPX]).toBeCloseTo(1e9 * r, -2);
    expect(mid.pnl[SPX]).toBeCloseTo(1e9 * (Math.sqrt(1 + r) - 1), -2);
  });
});

describe('capital calls', () => {
  it('a new career has undrawn commitments and a call funds new units at NAV without changing NAV', () => {
    let c = newCareer(opts);
    expect(totalUncalled(c)).toBeCloseTo(5e9 * 0.25, -4);
    c = issueCall(c, 200e6, 'regular');
    expect(c.calls[0].dueQ).toBe(2);
    expect(callable(c)).toBeCloseTo(totalUncalled(c) - 200e6, -2);
    c = closeQuarter(c);
    const before = nav(c.fund.ledger); const units = c.fund.ledger.units;
    const n: Career = structuredClone(c);
    settleCalls(n, 2, () => 0);
    expect(nav(n.fund.ledger)).toBeCloseTo(before, 8);
    expect(n.fund.ledger.units).toBeGreaterThan(units);
    expect(n.commitments.reduce((a, x) => a + x.called, 0)).toBeCloseTo(200e6, -2);
  });
  it('late payers pay interest the next quarter, or default and lose the rest of their commitment', () => {
    let c = issueCall(newCareer(opts), 100e6, 'regular');
    c = closeQuarter(c);
    const n: Career = structuredClone(c);
    settleCalls(n, 2, () => 0.999);
    expect(n.calls[0].lines.every(l => l.status === 'late')).toBe(true);
    const paid: Career = structuredClone(n);
    const navBefore = nav(paid.fund.ledger);
    const res = settleCalls(paid, 3, () => 0);
    expect(paid.calls[0].settled).toBe(true);
    // Interest is returned as fund income for the quarter; principal arrives at NAV without changing it.
    expect(res.income).toBeCloseTo(100e6 * 0.02, 0);
    expect(nav(paid.fund.ledger)).toBeCloseTo(navBefore, 8);
    const bad: Career = structuredClone(n);
    settleCalls(bad, 3, () => 0.9999);
    expect(bad.commitments.every(x => x.defaulted)).toBe(true);
    expect(totalUncalled(bad)).toBe(0);
  });
  it('a deal call buys the named stock with the money that arrives', () => {
    let c = issueCall(newCareer(opts), 100e6, 'deal', SPX);
    c = closeQuarter(c);
    const n: Career = structuredClone(c);
    const { orders } = settleCalls(n, 2, () => 0);
    expect(orders).toEqual([{ ticker: SPX, amount: expect.closeTo(100e6, -2), ref: expect.stringMatching(/^call:/) }]);
  });
  it('old career saves load with no commitments', () => {
    const raw = JSON.parse(JSON.stringify(newCareer(opts))); delete raw.commitments; delete raw.calls; delete raw.subsidiaries; delete raw.targets;
    const back = parseCareer(JSON.stringify(raw))!;
    expect(back.commitments).toEqual([]); expect(closeQuarter(back).fund.q).toBe(1);
  });
});

describe('acquisitions', () => {
  it('buying and selling a business moves only firm cash and reconciles', () => {
    let c = newCareer(opts);
    c.immersion = false;
    for (let i = 0; i < 4; i++) c = closeQuarter(c);
    expect(c.targets.length).toBeGreaterThan(0);
    const t = c.targets[0]; const cash = firmCash(c);
    const bought = acquire(c, t.id);
    if (bought === c) { expect(cash - t.price).toBeLessThan(quarterlyExpenses(c) * RESERVE_QUARTERS); return; }
    expect(firmCash(bought)).toBeCloseTo(cash - t.price, 2);
    expect(nav(bought.fund.ledger)).toBe(nav(c.fund.ledger));
    let n = closeQuarter(closeQuarter(closeQuarter(bought)));
    expect(n.journal.txns.some(x => x.category === 'subsidiary_revenue')).toBe(true);
    const s = n.subsidiaries[0]; const pre = firmCash(n);
    n = divest(n, s.id);
    expect(firmCash(n)).toBeCloseTo(pre + saleValue(s), 2);
    for (const b of bridges(n)) expect(b.reconciles).toBe(true);
  });
});

describe('reserve', () => {
  it('distributions keep three quarters of bills, and the forecast flags a dip below it', () => {
    let c = distribute(newCareer(opts), 1e12);
    expect(firmCash(c)).toBeCloseTo(quarterlyExpenses(c) * 3, 1);
    c = { ...c, roster: c.roster.map(e => ({ ...e, salaryQ: e.salaryQ * 3 })) };
    const f = cashForecast(c, -0.05);
    expect(f.reserveQuarters).toBe(3);
    expect(f.firstBelowReserve).not.toBeNull();
  });
});
