import { describe, expect, it } from 'vitest';
import { newFund, applyOrders } from './engine';
import { allocationOrders, stressPortfolio } from './strategy';

describe('interactive allocation and hypothetical shocks', () => {
  it('allocates a custom 20/30/30 company mix while keeping the remaining cash and paying trade costs', () => {
    const s = newFund('normal', 1, 10, false, true);
    s.startYear = 2005;
    applyOrders(s, allocationOrders(s, { AAPL: 20, MSFT: 30, AMZN: 30 }));
    const budget = 5e9 / 1.002;
    expect(s.ledger.positions.AAPL).toBeCloseTo(budget * .2);
    expect(s.ledger.positions.MSFT).toBeCloseTo(budget * .3);
    expect(s.ledger.positions.AMZN).toBeCloseTo(budget * .3);
    expect(s.ledger.cash).toBeCloseTo(5e9 - budget * .8 * 1.001);
  });
  it('normalizes oversized allocations and does not buy unlisted companies', () => {
    const s = newFund('normal', 1);
    s.startYear = 1990;
    const orders = allocationOrders(s, { AAPL: 100, MSFT: 100, META: 20 });
    applyOrders(s, orders);
    expect(s.ledger.positions.META).toBeUndefined();
    expect(s.ledger.positions.AAPL).toBeCloseTo(s.ledger.positions.MSFT);
    expect(s.ledger.cash).toBeGreaterThanOrEqual(0);
  });
  it('a minus 20% shock on a 60% invested fund loses 12% and leaves cash, units and real history untouched', () => {
    const s = newFund('normal', 1, 10, false, true);
    s.ledger.cash = 2e9; s.ledger.positions = { AAPL: 3e9 };
    const original = structuredClone(s);
    const result = stressPortfolio(s, [], -20);
    expect(result.change).toBe(-6e8);
    expect(result.return).toBeCloseTo(-.12);
    expect(result.nav).toBe(88);
    expect(s).toEqual(original);
  });
  it('stress tests include pending trade fees and do not change locked legacy assets', () => {
    const s = newFund('hard', 16, 10, false, true);
    const result = stressPortfolio(s, [{ ticker: 'SPX', amount: 1e6 }], -100);
    expect(result.before).toBeCloseTo(4e9 - 1000);
    expect(result.after).toBeCloseTo(s.ledger.cash - 1_001_000 + s.ledger.locked);
  });
});