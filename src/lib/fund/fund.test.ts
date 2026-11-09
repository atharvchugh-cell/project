import { describe, it, expect } from 'vitest';
import {
  type Ledger, accrueManagementFee, crystallizePerformanceFee, nav, payLiability, redeemUnits, settleDue, subscribe, openLiabilities, grossAssets,
} from './accounting';
import { type QuarterRecord, evaluateFundraising, initialFundraising } from './fundraising';
import { newFund, playQuarter, fundResult, marketFor, compareResults, startYears, rebalanceOrders, normalTargetMultiple, quarterLabel, LENGTHS, SPX, type FundState, type Order } from './engine';
import { annualReturn, buildFundMarket, splitYear, mulberry32 } from './market';
import { COMPLEX_UNIVERSE } from '@/data/complexReturns';
import { SP500_ANNUAL_RETURNS } from '@/data/historicalData';

const ledger = (cash: number, units: number, hwm = 100): Ledger => ({ cash, positions: {}, locked: 0, units, founderUnits: 0, feeHwm: hwm, managerCash: 0, liabilities: [], seq: 0 });

describe('units at NAV', () => {
  it('new money issues units at current NAV and leaves NAV unchanged', () => {
    const l = ledger(600_000, 5000); // NAV 120
    subscribe(l, 60_000);
    expect(l.units).toBeCloseTo(5500, 6);
    expect(nav(l)).toBeCloseTo(120, 6);
  });
  it('redemption retires units at NAV and the payout is counted once', () => {
    const l = ledger(500_000, 5000);
    redeemUnits(l, 100, 1, 'test');
    expect(nav(l)).toBeCloseTo(100, 6); // liability already reduces assets
    settleDue(l, 1);
    expect(l.cash).toBeCloseTo(490_000, 6);
    expect(nav(l)).toBeCloseTo(100, 6); // paying does not deduct again
  });
  it('unpaid redemptions stay owed', () => {
    const l = ledger(5_000, 1000);
    l.positions.broad = 95_000;
    redeemUnits(l, 200, 1, 'big');
    const { overdue } = settleDue(l, 1);
    expect(overdue).toHaveLength(1);
    expect(openLiabilities(l)).toBeCloseTo(20_000, 6);
  });
});

describe('fees', () => {
  it('deferred management fee lowers NAV once when accrued, not again when paid', () => {
    const l = ledger(100_000, 1000);
    const f = accrueManagementFee(l, 1);
    expect(f.amount).toBeCloseTo(250, 6);
    expect(nav(l)).toBeCloseTo(99.75, 6);
    payLiability(l, f);
    expect(nav(l)).toBeCloseTo(99.75, 6);
    expect(l.managerCash).toBeCloseTo(250, 6);
  });
  it('performance fee is 10% above the HWM, after management fees, and HWM resets to post-fee NAV', () => {
    const l = ledger(130_000, 1000); // NAV 130
    accrueManagementFee(l, 4); // 325 → NAV 129.675
    const pf = crystallizePerformanceFee(l, 4)!;
    expect(pf.amount).toBeCloseTo(0.1 * (129.675 - 100) * 1000, 4);
    expect(l.feeHwm).toBeCloseTo(nav(l), 6);
  });
  it('Hard Mode: no performance fee for recovering old losses below the inherited mark of 100', () => {
    const l = ledger(950_000, 10_000, 100); // NAV 95
    expect(crystallizePerformanceFee(l, 4)).toBeNull();
    expect(l.feeHwm).toBe(100);
  });
  it('fees are deferred behind redemptions when cash is short', () => {
    const l = ledger(10_000, 1000); l.positions.broad = 90_000;
    accrueManagementFee(l, 1);
    redeemUnits(l, 100, 1, 'r');
    settleDue(l, 1);
    const red = l.liabilities.find(x => x.kind === 'redemption')!;
    const fee = l.liabilities.find(x => x.kind === 'mgmt_fee')!;
    expect(red.paid).toBe(true); // redemption paid first
    expect(fee.paid).toBe(false); // fee deferred, still owed
    expect(grossAssets(l)).toBeGreaterThan(0);
  });
});

const rec = (q: number, ret: number, bench: number, extra: Partial<QuarterRecord> = {}): QuarterRecord => ({ q, ret, bench, drawdown: 0, coverage: [5, 5, 5], latePayment: false, confidence: 90, ...extra });

function runHistory(rets: [number, number][], dd: number[] = []) {
  const fr = initialFundraising(); const hist: QuarterRecord[] = []; let count = 0; const rand = () => 0.5;
  rets.forEach(([r, b], i) => { hist.push(rec(i + 1, r, b, { drawdown: dd[i] ?? 0 })); count += evaluateFundraising(hist, fr, 1e6, rand).offers.length; });
  return { count, fr };
}

describe('recurring fundraising', () => {
  it('an exceptional 5-year run earns at least 12 offers across tiers', () => {
    const { count, fr } = runHistory(Array.from({ length: 20 }, () => [0.06, 0.02] as [number, number]));
    expect(count).toBeGreaterThanOrEqual(12);
    expect(fr.unlocked).toBe(5);
  });
  it('one strong quarter unlocks nothing', () => {
    expect(runHistory([[0.3, 0.02]]).count).toBe(0);
  });
  it('an average run matching the index gets no offers', () => {
    expect(runHistory(Array.from({ length: 20 }, () => [0.02, 0.02] as [number, number])).count).toBeLessThanOrEqual(3);
  });
  it('a drawdown blocks offers and recovery reopens them', () => {
    const rets: [number, number][] = [[0.06, 0.02], [0.06, 0.02], [-0.2, 0.02], [0.06, 0.02], [0.06, 0.02], [0.06, 0.02]];
    const fr = initialFundraising(); const hist: QuarterRecord[] = []; const got: number[] = [];
    rets.forEach(([r, b], i) => { hist.push(rec(i + 1, r, b, { drawdown: i === 2 ? 0.2 : i === 3 ? 0.14 : 0 })); got.push(evaluateFundraising(hist, fr, 1e6, () => 0.5).offers.length); });
    expect(got[2]).toBe(0);
    expect(got[3]).toBe(0);
    expect(got.slice(4).some(n => n > 0)).toBe(true);
  });
});


function play(s: FundState, pol: (s: FundState) => Order[], accept = true) {
  while (s.status === 'running') s = playQuarter(s, { orders: pol(s), acceptOfferIds: accept ? s.offers.map(o => o.id) : [] });
  return s;
}
const indexPol = (s: FundState) => rebalanceOrders(s, 'index', 5);

describe('real-data quarterly market', () => {
  it('four quarters always compound to the exact yearly return', () => {
    const r = mulberry32(1);
    for (const a of [-0.6, -0.37, 0, 0.12, 2.5]) expect(splitYear(a, 0.09, r).reduce((p, x) => p * (1 + x), 1)).toBeCloseTo(1 + a, 10);
  });
  it('every stock and the S&P 500 match their real yearly returns in a built market', () => {
    const m = buildFundMarket(9, 1995, 20);
    for (let y = 0; y < 20; y++) {
      const year = 1995 + y; const qs = m.slice(y * 4, y * 4 + 4);
      expect(qs.reduce((p, q) => p * (1 + q.returns[SPX]), 1)).toBeCloseTo(1 + SP500_ANNUAL_RETURNS[year], 9);
      for (const c of COMPLEX_UNIVERSE) {
        const r = annualReturn(c.ticker, year); if (r === undefined) { expect(qs[0].returns[c.ticker]).toBeUndefined(); continue; }
        expect(qs.reduce((p, q) => p * (1 + q.returns[c.ticker]), 1)).toBeCloseTo(1 + r, 9);
      }
    }
  });
  it('uses the corrected 2008 S&P 500 return', () => expect(annualReturn(SPX, 2008)).toBe(-0.37));
  it('a game lasts years × 4 quarters', () => { for (const y of LENGTHS) expect(newFund('normal', 3, y).quarters).toBe(y * 4); });
});

describe('scenarios', () => {
  it('Hard Mode starts at NAV 40 with 10,000 units, HWM 100 and a real fallen stock', () => {
    for (const y of LENGTHS) {
      const s = newFund('hard', 16, y);
      expect(nav(s.ledger)).toBeCloseTo(40, 6);
      expect(s.ledger.units).toBe(10_000);
      expect(s.ledger.feeHwm).toBe(100);
      expect(COMPLEX_UNIVERSE.find(c => c.ticker === s.distressed)!.returns[s.startYear - 1]).toBeLessThan(-40);
    }
  });
  it('every length has start years in both modes', () => { for (const y of LENGTHS) { expect(startYears(y, 'normal').length).toBeGreaterThan(0); expect(startYears(y, 'hard').length).toBeGreaterThan(0); } });
  it('Normal target is 1.5x the S&P 500 growth, at least doubling', () => {
    expect(normalTargetMultiple(2000, 10)).toBe(2);
    expect(normalTargetMultiple(1990, 10)).toBeGreaterThan(3);
  });
  it('Hard Mode quarter labels show the real calendar year', () => {
    const s = newFund('hard', 5, 10);
    expect(quarterLabel(s, 1)).toBe(`Q1 ${s.startYear}`);
    expect(quarterLabel(s, 6)).toBe(`Q2 ${s.startYear + 1}`);
  });
  it('same seed + same actions replay identically', () => {
    const a = play(newFund('normal', 27, 10), indexPol); const b = play(newFund('normal', 27, 10), indexPol);
    expect(a.history.map(h => h.nav)).toEqual(b.history.map(h => h.nav));
  });
  it('accepting new money grows AUM but does not change investor return', () => {
    const withMoney = play(newFund('normal', 4, 15), indexPol, true);
    const without = play(newFund('normal', 4, 15), indexPol, false);
    expect(fundResult(withMoney).aum).toBeGreaterThanOrEqual(fundResult(without).aum);
    expect(Math.abs(fundResult(withMoney).netReturn - fundResult(without).netReturn)).toBeLessThan(0.05);
  });
  it('an index strategy with a cash reserve survives every length in both modes', () => {
    for (const d of ['normal', 'hard'] as const) for (const y of LENGTHS) for (const seed of [1, 2, 3]) {
      const r = fundResult(play(newFund(d, seed, y), indexPol));
      expect(r.outcome, `${d} ${y} ${seed}`).not.toBe('failed');
    }
  });
  it('Hard Mode is winnable by cutting the inherited stock and owning the index', () => {
    let wins = 0;
    for (const y of LENGTHS) for (let seed = 1; seed <= 6; seed++) if (fundResult(play(newFund('hard', seed, y), indexPol)).outcome === 'achieved') wins++;
    expect(wins).toBeGreaterThan(0);
  });
  it('buying a stock before it trades is rejected', () => {
    const s = newFund('normal', 1, 10);
    const late = COMPLEX_UNIVERSE.find(c => c.firstAvailableYear > s.startYear + 1)!;
    const n = playQuarter(s, { orders: [{ ticker: late.ticker, amount: 10_000 }], acceptOfferIds: [] });
    expect(n.ledger.positions[late.ticker]).toBeUndefined();
  });
  it('early locked sales take a 30% discount', () => {
    const s = playQuarter(newFund('hard', 16, 10), { orders: [], acceptOfferIds: [], sellLocked: 10_000 });
    expect(s.inbox.some(m => m.body.includes('$7,000'))).toBe(true);
  });
  it('ranking: a surviving run beats a failed one regardless of AUM', () => {
    const ok = fundResult(play(newFund('normal', 4, 10), indexPol));
    const bad = { ...ok, outcome: 'failed' as const, rankKey: [0, 9, 0] as [number, number, number], aum: 1e12 };
    expect([bad, ok].sort(compareResults)[0]).toBe(ok);
  });
});
