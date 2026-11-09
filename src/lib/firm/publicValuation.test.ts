import { describe, expect, it } from 'vitest';
import { newCareer, parseCareer, type Career } from './career';
import { closeQuarter } from './close';
import { founderEquityValue, ownershipOf, publicValuationDrivers, valuation } from './exit';
import { post } from './journal';
import { subscribe, nav, netAssets } from '@/lib/fund/accounting';

function fixture() {
  let c = newCareer({ firmName: 'Public Test', fundName: 'Flagship', hq: 'Boston', scenario: 'institutional', philosophy: 'diversified', years: 10, seed: 3 });
  for (let i = 0; i < 8; i++) c = closeQuarter(c, { orders: [], acceptOfferIds: [] });
  c.ownership = { ...ownershipOf(c), ipo: { stage: 'listed', filedQ: 6, listedQ: 8, price: 1e8 } };
  return c;
}
function results(c: Career, ret: number, bench = 0.01) {
  c.fund.history = c.fund.history.map(x => ({ ...x, ret, bench, latePayment: false }));
  return c;
}
describe('live public firm valuation', () => {
  it('better net returns raise value and losses lower it at unchanged managed assets and profit', () => {
    const c = results(fixture(), 0.01); const flat = valuation(c);
    const good = valuation(results(structuredClone(c), 0.06));
    const bad = valuation(results(structuredClone(c), -0.06));
    expect(good.total).toBeGreaterThan(flat.total);
    expect(bad.total).toBeLessThan(flat.total);
    expect(good.profit).toBe(flat.profit); expect(good.drivers.aum).toBe(flat.drivers.aum);
  });
  it('benchmark outperformance increases the earnings multiple independently of absolute return', () => {
    const c = results(fixture(), 0.03, 0.03);
    expect(publicValuationDrivers(results(structuredClone(c), 0.03, 0)).performanceMult).toBeGreaterThan(publicValuationDrivers(c).performanceMult);
  });
  it('new subscriptions influence scale modestly but do not become owned equity or net returns', () => {
    const c = results(fixture(), 0.02); const before = valuation(c); const unitNav = nav(c.fund.ledger);
    subscribe(c.fund.ledger, 1e9);
    const after = valuation(c);
    expect(nav(c.fund.ledger)).toBeCloseTo(unitNav, 9);
    expect(after.drivers.performanceMult).toBe(before.drivers.performanceMult);
    expect(after.cash).toBe(before.cash);
    expect(after.total - before.total).toBeGreaterThan(0);
    expect(after.total - before.total).toBeLessThan(1e9);
  });
  it('public internal cash transfers and loan principal remain valuation neutral', () => {
    const c = fixture(); const before = valuation(c).total;
    post(c.journal, { q: c.fund.q, date: 'Test', payer: 'external', recipient: 'firm', category: 'loan_draw', amount: 5e6, source: 'test-draw', memo: 'Fixture' });
    c.subsidiaries.push({ id: 'test-company', name: 'Test', kind: 'research', price: 0, revenueQ: 0, costQ: 0, multiple: 5, acquiredQ: c.fund.q, ownerId: 'firm', loan: { principal: 5e6, balance: 5e6, rateQ: 0.02, amortQ: 0.25e6, maturityQ: 20, drawnQ: c.fund.q, lastQ: c.fund.q, breaches: 0, penalty: 0 } });
    post(c.journal, { q: c.fund.q, date: 'Test', payer: 'firm', recipient: 'test-company', category: 'business_retained', amount: 5e6, source: 'test-transfer', memo: 'Fixture' });
    expect(valuation(c).total).toBeCloseTo(before, 2);
  });
  it('invalid or short return histories have a neutral performance modifier and finite value', () => {
    const c = fixture(); c.fund.history[7].ret = NaN;
    expect(publicValuationDrivers(c).performanceMult).toBe(1);
    expect(Number.isFinite(valuation(c).total)).toBe(true);
    c.fund.history = c.fund.history.slice(0, 3);
    expect(publicValuationDrivers(c).performanceMult).toBe(1);
  });
  it('reputation and actual earnings affect valuation without touching fund assets', () => {
    const c = fixture(); const before = valuation(c); const aum = netAssets(c.fund.ledger);
    c.life = { ...c.life, repMod: 10 } as NonNullable<Career['life']>;
    expect(valuation(c).total).toBeGreaterThan(before.total);
    post(c.journal, { q: c.fund.q, date: 'Test', payer: 'external', recipient: 'firm', category: 'staff_revenue', amount: 1e6, source: 'test-earned', memo: 'Fixture', closeId: `test:Q${c.fund.q}` });
    expect(valuation(c).profit).toBeCloseTo(before.profit + 1e6, 2);
    expect(netAssets(c.fund.ledger)).toBe(aum);
  });
  it('reloaded listed careers retain live valuation and founder equity uses the same value', () => {
    const c = results(fixture(), 0.04); const r = parseCareer(JSON.stringify(c));
    expect(r).not.toBeNull(); if (!r) throw new Error('Expected career');
    expect(valuation(r).total).toBe(valuation(c).total);
    expect(founderEquityValue(r)).toBe(valuation(r).total);
    delete r.ownership?.ipo;
    expect(publicValuationDrivers(r).scaleMult).toBe(1);
    expect(publicValuationDrivers(r).performanceMult).toBe(1);
  });
});