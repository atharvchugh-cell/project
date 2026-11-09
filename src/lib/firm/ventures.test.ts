import { describe, expect, it } from 'vitest';
import { netAssets } from '@/lib/fund/accounting';
import { firmCash, newCareer } from './career';
import { closeQuarter } from './close';
import { post } from './journal';
import { personalCash } from './life';
import { buyVenture, expandVenture, ownedVentures, sellVenture, setVentureReinvest, venturesLifetime, venturesOf, ventureValue } from './ventures';
import { expandBusiness } from './business';

const opts = { firmName: 'Test', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed: 5 };
const none = { orders: [], acceptOfferIds: [] };
const rich = () => { const c = newCareer(opts); post(c.journal, { q: 0, date: 't', payer: 'external', recipient: 'founder', category: 'opening', amount: 50e6, source: 't', memo: 't' }); return c; };

describe('personal ventures', () => {
  it('are bought with personal cash only', () => {
    const c = rich(); const firm = firmCash(c); const aum = netAssets(c.fund.ledger); const cash = personalCash(c);
    const r = buyVenture(c, 'v-gym'); expect(r.ok).toBe(true);
    expect(personalCash(r.c)).toBeCloseTo(cash - 6e6, 0); expect(firmCash(r.c)).toBe(firm); expect(netAssets(r.c.fund.ledger)).toBe(aum);
  });
  it('cannot be bought without enough personal cash', () => {
    expect(buyVenture(newCareer(opts), 'v-bank').ok).toBe(false);
  });
  it('pays its quarterly profit to personal cash at the close', () => {
    const c = buyVenture(rich(), 'v-carwash').c; const before = personalCash(c) - c.founderSalaryQ;
    const n = closeQuarter(c, none); const h = ownedVentures(n)[0].history.at(-1)!;
    expect(h.paidOut).toBeGreaterThan(0); expect(n.journal.txns.some(t => t.memo === 'Express car wash chain profit' && t.amount === Math.round(h.paidOut * 100) / 100)).toBe(true);
    expect(personalCash(n)).toBeGreaterThan(before);
  });
  it('expansion raises revenue and costs by 30% and costs half the price per level', () => {
    const c = buyVenture(rich(), 'v-carwash').c; const v = ownedVentures(c)[0]; const cash = personalCash(c);
    const e = expandVenture(c, v.id); const w = ownedVentures(e.c)[0];
    expect(w.level).toBe(2); expect(w.revenueQ).toBeCloseTo(v.revenueQ * 1.3); expect(personalCash(e.c)).toBeCloseTo(cash - 1.25e6, 0);
    expect(expandVenture(e.c, v.id).ok).toBe(false);
  });
  it('reinvesting keeps profit inside and grows revenue faster', () => {
    const base = buyVenture(rich(), 'v-carwash').c; const id = ownedVentures(base)[0].id;
    const re = setVentureReinvest(base, id, 1).c;
    const a = closeQuarter(base, none); const b = closeQuarter(re, none);
    expect(ownedVentures(b)[0].history.at(-1)!.paidOut).toBe(0);
    expect(ownedVentures(b)[0].revenueQ).toBeGreaterThan(ownedVentures(a)[0].revenueQ);
  });
  it('sells for 95% of value into personal cash, not in the purchase quarter', () => {
    const c = buyVenture(rich(), 'v-carwash').c; const id = ownedVentures(c)[0].id;
    expect(sellVenture(c, id).ok).toBe(false);
    const n = closeQuarter(c, none); const val = ventureValue(n, ownedVentures(n)[0]); const cash = personalCash(n);
    const s = sellVenture(n, id); expect(personalCash(s.c)).toBeCloseTo(cash + val * 0.95, 0); expect(ownedVentures(s.c)).toHaveLength(0);
  });
  it('totals every quarter of profit, payouts and reinvestment across kept and sold businesses', () => {
    let c = buyVenture(rich(), 'v-carwash').c; const id = ownedVentures(c)[0].id;
    c = setVentureReinvest(c, id, 0.25).c;
    c = closeQuarter(c, none); const s = sellVenture(c, id); c = closeQuarter(s.c, none);
    c = buyVenture(c, 'v-gym').c; c = closeQuarter(c, none);
    const life = venturesLifetime(c);
    const expectProfit = venturesOf(c).reduce((a, v) => a + v.history.reduce((x, h) => x + h.profit, 0), 0);
    expect(life.profit).toBeCloseTo(expectProfit, 4);
    expect(life.profit).toBeGreaterThan(0);
    expect(life.paid + life.reinvested).toBeCloseTo(life.profit, 4);
    expect(life.paid).toBeGreaterThan(0); expect(life.reinvested).toBeGreaterThan(0);
  });
});


describe('firm business expansion', () => {
  it('rejects unknown businesses', () => { expect(expandBusiness(newCareer(opts), 'nope').ok).toBe(false); });
});
