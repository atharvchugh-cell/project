import { describe, expect, it } from 'vitest';
import { nav, netAssets } from '@/lib/fund/accounting';
import { newCareer, founderCash, type Career } from './career';
import { closeQuarter, resolveDecision } from './close';
import { investorDemand } from './demand';
import { relationsAtClose } from './relations';
import { roomFor, termsOf } from './clients';
import { fileIpo, startRoadshow, priceIpo, ipoRange, founderPct } from './exit';

function fixture() {
  let c = newCareer({ firmName: 'Demand Test', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified', scenario: 'institutional', years: 10, seed: 3 });
  for (let i = 0; i < 8; i++) c = closeQuarter(c, { orders: [], acceptOfferIds: [] });
  c.fund.history = c.fund.history.map(h => ({ ...h, ret: 0.06, bench: 0.01, latePayment: false }));
  c.decisions = [];
  for (const i of c.fund.investors) c.satisfaction[i.id] = 85;
  return c;
}

describe('sustained investor demand', () => {
  it('requires two complete years each beating the benchmark by at least ten points', () => {
    const c = fixture();
    expect(investorDemand(c).qualified).toBe(true);
    c.fund.history = c.fund.history.slice(1);
    expect(investorDemand(c).qualified).toBe(false);
  });
  it('does not let one exceptional year mask a weak year', () => {
    const c = fixture();
    c.fund.history = c.fund.history.map((h, i) => ({ ...h, ret: i < 4 ? 0.01 : 0.5 }));
    expect(investorDemand(c).qualified).toBe(false);
  });
  it('uses compounding, rejects invalid history and closes demand when ended', () => {
    const c = fixture();
    expect(investorDemand(c).recent).toBeCloseTo(1.06 ** 4 - 1.01 ** 4, 12);
    c.fund.history[0].ret = NaN;
    expect(investorDemand(c).qualified).toBe(false);
    expect(investorDemand({ ...fixture(), status: 'ended' }).qualified).toBe(false);
  });
  it('creates eager offers despite a losing random draw, capped at saved capacity, without changing NAV', () => {
    const c = fixture(); const before = nav(c.fund.ledger);
    relationsAtClose(c, () => 0.99);
    const d = c.decisions.find(d => d.kind === 'new_client');
    expect(d).toBeDefined();
    if (!d) throw new Error('Expected allocation offer');
    const key = String(d.payload?.profile); const terms = termsOf(d);
    expect(terms.wireNow + terms.commitLater).toBeCloseTo(d.amount, 2);
    const capacity = roomFor({ ...c, decisions: [] }, key);
    expect(d.amount).toBeLessThanOrEqual(capacity);
    expect(nav(c.fund.ledger)).toBe(before);
    const after = resolveDecision(c, d.id, 'accept');
    expect(netAssets(after.fund.ledger) - netAssets(c.fund.ledger)).toBeCloseTo(terms.wireNow, 1);
    expect(nav(after.fund.ledger)).toBeCloseTo(before, 8);
  });
  it('never duplicates same-quarter offers when refreshed or reloaded', () => {
    const c = fixture(); relationsAtClose(c, () => 0.99);
    const count = c.decisions.length;
    const reload: Career = JSON.parse(JSON.stringify(c)); relationsAtClose(reload, () => 0.99);
    expect(reload.decisions.length).toBe(count);
  });
});

describe('IPO selectable public float', () => {
  it('settles a thirty-five percent listing to founder cash with six percent fees and preserves fund assets', () => {
    let c = fileIpo(fixture()).c;
    c = closeQuarter(c, { orders: [], acceptOfferIds: [] });
    c = startRoadshow(c).c;
    c = closeQuarter(c, { orders: [], acceptOfferIds: [] });
    const before = founderCash(c); const aum = netAssets(c.fund.ledger); const price = ipoRange(c).mid;
    const r = priceIpo(c, 0.35);
    expect(r.ok).toBe(true);
    const gross = Math.round(price * 0.35 * 100) / 100;
    const cost = Math.round(price * 0.35 * 0.06 * 100) / 100;
    expect(founderCash(r.c) - before).toBeCloseTo(gross - cost, 2);
    expect(founderPct(r.c)).toBeCloseTo(0.65, 10);
    expect(netAssets(r.c.fund.ledger)).toBe(aum);
    expect(r.c.ownership?.ipo?.lockupUntilQ).toBe(c.fund.q + 4);
    expect(priceIpo(r.c, 0.35).ok).toBe(false);
  });
});