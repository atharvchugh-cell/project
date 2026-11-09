import { describe, it, expect } from 'vitest';
import { newFund, payInvestorsNow, raiseCashNow, playQuarter, confidenceReasons, annualReviewPoints, SPX } from './engine';
import { addLiability } from './accounting';

const total = (r: { points: number }[]) => r.reduce((a, b) => a + b.points, 0);

describe('pay investors now', () => {
  it('starts institutional Normal funds at $5 billion', () => {
    expect(newFund('normal', 3, 10, false, true).ledger.cash).toBe(5_000_000_000);
  });
  it('pays owed money, selling holdings when cash is short, without touching the original', () => {
    const s = newFund('normal', 3, 10, false, true);
    s.ledger.cash = 1e6; s.ledger.positions = { AAPL: 3e9 };
    addLiability(s.ledger, 'redemption', 50e6, 0, 'test');
    s.overdueQuarters = 1;
    const after = payInvestorsNow(s);
    expect(after.ledger.liabilities.every(x => x.paid)).toBe(true);
    expect(after.ledger.positions.AAPL).toBeLessThan(3e9);
    expect(after.overdueQuarters).toBe(0);
    expect(s.ledger.liabilities.some(x => !x.paid)).toBe(true);
  });
  it('raises a small chosen amount of cash by trimming holdings', () => {
    const s = newFund('normal', 3, 10, false, true);
    s.ledger.cash = 0; s.ledger.positions = { AAPL: 2e9, [SPX]: 2e9 };
    const after = raiseCashNow(s, 40e6);
    expect(after.ledger.cash).toBeGreaterThanOrEqual(40e6);
    expect(after.ledger.cash).toBeLessThan(40.1e6);
  });
});

describe('investor confidence follows money', () => {
  it('a profitable quarter raises confidence even when the S&P 500 did better', () => {
    expect(total(confidenceReasons({ ret: 0.02, bench: 0.09, late: false, paidOnTime: 0 }))).toBeGreaterThan(0);
  });
  it('a losing quarter lowers confidence', () => {
    expect(total(confidenceReasons({ ret: -0.05, bench: 0.01, late: false, paidOnTime: 0 }))).toBeLessThan(0);
  });
  it('a profitable year below the board target still adds a point; a losing year costs 5', () => {
    expect(annualReviewPoints(0.04, 0.08)).toBe(1);
    expect(annualReviewPoints(-0.02, 0.08)).toBe(-5);
    expect(annualReviewPoints(0.1, 0.08)).toBe(3);
  });
});

describe('a fully invested fund is not closed for payments it can afford', () => {
  it('sells holdings to pay a due redemption instead of going overdue', () => {
    let s = newFund('normal', 3, 10, false, true);
    s = playQuarter(s, { orders: [{ ticker: SPX, amount: s.ledger.cash }], acceptOfferIds: [] });
    for (let i = 0; i < 3; i++) {
      addLiability(s.ledger, 'redemption', 100e6, s.q + 1, 'Investor — payout');
      s = playQuarter(s, { orders: [{ ticker: SPX, amount: s.ledger.cash }], acceptOfferIds: [] });
      expect(s.overdueQuarters).toBe(0);
    }
    expect(s.status).toBe('running');
  });
});
