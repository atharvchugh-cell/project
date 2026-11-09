import { describe, expect, it } from 'vitest';
import { newFund, playQuarter, nav, rebalanceOrders, applyOrders, SPX } from './engine';
import { companyTrackRecord, forkFund } from './exploration';

describe('fund exploration safeguards', () => {
  it('research reveals no data before the first quarter finishes', () => {
    expect(companyTrackRecord(newFund('normal', 1), 'AAPL')).toEqual([]);
  });
  it('research stops at completed quarter 2 and compounds those quarters only', () => {
    let s = newFund('normal', 1);
    s = playQuarter(s, { orders: [], acceptOfferIds: [] });
    s = playQuarter(s, { orders: [], acceptOfferIds: [] });
    const rows = companyTrackRecord(s, SPX);
    expect(rows.map(r => r.q)).toEqual([1, 2]);
    expect(rows[1].growth).toBeCloseTo(s.benchIndex - 100);
    expect(rows[1]).not.toHaveProperty('year');
  });
  it('Hard research exposes no calendar years or uncompleted quarters', () => {
    const s = playQuarter(newFund('hard', 16), { orders: [], acceptOfferIds: [] });
    expect(companyTrackRecord(s, SPX).map(r => Object.keys(r))).toEqual([['q', 'return', 'growth']]);
    expect(companyTrackRecord(s, 'NOT_A_TICKER')).toEqual([]);
  });
  it('a branch advances independently and remains unsaved practice with unchanged live units and obligations', () => {
    const live = newFund('normal', 1, 10, false, true);
    const original = structuredClone(live);
    let branch = forkFund(live);
    branch = playQuarter(branch, { orders: rebalanceOrders(branch, 'index', 3), acceptOfferIds: [] });
    expect(branch.practice).toBe(true);
    expect(branch.q).toBe(1);
    expect(branch.seed).toBe(live.seed);
    expect(nav(branch.ledger)).not.toBe(nav(live.ledger));
    expect(live).toEqual(original);
    branch.investors[0].note = 'branch only';
    expect(live.investors[0].note).not.toBe('branch only');
  });
  it('an eight-quarter reserve stages less index exposure than a one-quarter reserve without changing the original', () => {
    const live = newFund('normal', 1, 10, false, true);
    const short = forkFund(live), long = forkFund(live);
    applyOrders(short, rebalanceOrders(short, 'index', 1));
    applyOrders(long, rebalanceOrders(long, 'index', 8));
    expect(long.ledger.cash).toBeGreaterThan(short.ledger.cash);
    expect(long.ledger.positions[SPX]).toBeLessThan(short.ledger.positions[SPX]);
    expect(live.ledger.cash).toBe(5e9);
    expect(live.ledger.positions).toEqual({});
  });
});