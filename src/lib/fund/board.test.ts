import { describe, it, expect } from 'vitest';
import { boardReview, fundChartData } from './board';
import { newFund, nav, playQuarter, fundResult, SPX } from './engine';
import { subscribe } from './accounting';

describe('institutional fund mandates', () => {
  it('opens Normal at $50M and NAV 100, with proportional investor ownership', () => {
    const s = newFund('normal', 1, 10, false, true);
    expect(s.ledger.cash).toBe(5_000_000_000);
    expect(nav(s.ledger)).toBe(100);
    expect(s.investors.reduce((a, i) => a + i.units, 0)).toBe(s.ledger.units);
  });
  it('opens Hard at $40M with 70% inherited stock and NAV 40', () => {
    const s = newFund('hard', 16, 10, false, true);
    expect(s.ledger.cash).toBe(400_000_000);
    expect(Object.values(s.ledger.positions)[0]).toBe(2_800_000_000);
    expect(s.ledger.locked).toBe(800_000_000);
    expect(nav(s.ledger)).toBe(40);
  });
  it('requires 8% in four quarters, then resets against the previous year-end NAV', () => {
    const s = newFund('normal', 1, 10, false, true);
    expect(boardReview(s).deadlineQ).toBe(4);
    expect(boardReview(s).targetNav).toBeCloseTo(108);
    s.q = 4;
    s.history.push({ q: 4, nav: 110, aum: 55e6, benchIndex: 108, ret: .1, bench: .08, drawdown: 0, coverage: [2, 2, 2], confidence: 65, latePayment: false });
    expect(boardReview(s).deadlineQ).toBe(8);
    expect(boardReview(s).targetNav).toBeCloseTo(118.8);
    expect(boardReview(s, true).targetNav).toBeCloseTo(108);
  });
  it('Hard expects 12% net annually with two-year diversification grace', () => {
    const r = boardReview(newFund('hard', 16, 10, false, true));
    expect(r.targetNav).toBeCloseTo(44.8);
    expect(r.graceQ).toBe(8);
    expect(r.diversificationDue).toBe(false);
  });
  it('an early closure reports the current annual mandate rather than a shifted four-quarter window', () => {
    const s = newFund('normal', 1, 10, false, true);
    s.q = 5;
    s.history.push({ q: 4, nav: 110, aum: 55e6, benchIndex: 108, ret: .1, bench: .08, drawdown: 0, coverage: [2, 2, 2], confidence: 65, latePayment: false });
    expect(boardReview(s, true).startQ).toBe(4);
    expect(boardReview(s, true).deadlineQ).toBe(8);
    expect(boardReview(s, true).targetNav).toBeCloseTo(118.8);
  });
  it('counts only companies at 5% or more, excludes the index, enforces 40% concentration', () => {
    const s = newFund('normal', 1, 10, false, true);
    s.ledger.cash = 20e6; s.ledger.positions = { AAPL: 10e6, MSFT: 10e6, AMZN: 10e6 };
    expect(boardReview(s).diversified).toBe(true);
    s.ledger.positions = { AAPL: 10e6, MSFT: 10e6, [SPX]: 10e6 };
    expect(boardReview(s).companies).toBe(2);
    s.ledger.positions = { AAPL: 25e6, MSFT: 2.5e6, AMZN: 2.5e6 };
    expect(boardReview(s).diversified).toBe(false);
  });
  it('investor subscriptions never help meet a return mandate', () => {
    const s = newFund('normal', 1, 10, false, true);
    subscribe(s.ledger, 50e6);
    expect(boardReview(s).netReturn).toBe(0);
    expect(boardReview(s).returnMet).toBe(false);
    expect(fundChartData(s)[0].return).toBe(0);
  });
  it('reviews only at year end, persists annual review, and leaves legacy saves unchanged', () => {
    let s = newFund('normal', 1, 10, false, true);
    for (let q = 0; q < 3; q++) s = playQuarter(s, { orders: [], acceptOfferIds: [] });
    expect(s.boardReviews).toHaveLength(0);
    s = playQuarter(s, { orders: [], acceptOfferIds: [] });
    expect(s.boardReviews).toHaveLength(1);
    expect(s.boardReviews?.[0].q).toBe(4);
    expect(s.inbox.at(-1)?.from === 'Investment committee' || s.inbox.some(i => i.subject.startsWith('Annual board review'))).toBe(true);
    const old = newFund('normal', 1);
    expect(old.ledger.cash).toBe(500_000);
    expect(old.boardReviews).toBeUndefined();
  });
  it('final achievement depends only on money made, not diversification', () => {
    const s = newFund('normal', 1, 10, false, true);
    s.q = s.quarters; s.ledger.positions = { AAPL: 1e12 };
    expect(fundResult(s).outcome).toBe('achieved');
  });
  it('never penalizes holding one stock', () => {
    const s = newFund('normal', 1, 10, false, true);
    const next = playQuarter(s, { orders: [{ ticker: 'AAPL', amount: s.ledger.cash * 0.9 }], acceptOfferIds: [] });
    expect(next.inbox.some(m => /limit|concentrat|diversif/i.test(m.body))).toBe(false);
  });
});
