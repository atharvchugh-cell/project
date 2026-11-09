import { describe, expect, it } from 'vitest';
import { newCareer, type Career } from './career';
import { closeQuarter, resolveDecision } from './close';
import { fameEffects, performanceProfile } from './immersion';
import { ensureProfiles, quote, termsOf, roomFor } from './clients';
import { relationsAtClose } from './relations';
import { managerTargets, makeOffer, runDiligence, dealsOf, closeDeal } from './deals';
import { post } from './journal';
import { payroll } from './roster';
import { rivalCoverageDelta } from './coverage';
import { nav, netAssets } from '@/lib/fund/accounting';

function fixture() {
  let c = newCareer({ firmName: 'Fame Test', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified', scenario: 'institutional', years: 10, seed: 3 });
  for (let i = 0; i < 4; i++) c = closeQuarter(c, { orders: [], acceptOfferIds: [] });
  c.fund.history = c.fund.history.map(h => ({ ...h, ret: 0.06, bench: 0.01, latePayment: false }));
  c.decisions = []; ensureProfiles(c);
  for (const i of c.fund.investors) c.satisfaction[i.id] = 85;
  return c;
}

describe('performance-backed fame', () => {
  it('increases real capacity-limited quotes by fame points, not cash deposits', () => {
    const c = fixture(); const p = Object.values(c.clients ?? {})[0];
    if (!p) throw new Error('Missing client');
    const enhanced = quote(c, p, 60); const legacy = quote({ ...c, immersion: false }, p, 60);
    expect(enhanced.amount).toBeGreaterThan(legacy.amount);
    expect(enhanced.share - legacy.share).toBeCloseTo(performanceProfile(c).fame / 1000, 12);
    expect(enhanced.amount).toBeLessThanOrEqual(enhanced.room);
    const effects = fameEffects(c); c.fund.ledger.cash += 1e12;
    expect(fameEffects(c)).toEqual(effects);
  });
  it('creates unsolicited offers and accepting saved terms increases assets without changing NAV', () => {
    const c = fixture(); const legacy = structuredClone(c); legacy.immersion = false;
    const draw = performanceProfile(c).demand - 0.01;
    relationsAtClose(legacy, () => draw);
    expect(legacy.decisions.some(x => x.kind === 'new_client')).toBe(false);
    relationsAtClose(c, () => draw);
    const d = c.decisions.find(x => x.kind === 'new_client');
    if (!d) throw new Error('Missing fame-driven offer');
    const before = nav(c.fund.ledger); const terms = termsOf(d);
    expect(d.amount).toBeLessThanOrEqual(roomFor({ ...c, decisions: [] }, String(d.payload?.profile)));
    const accepted = resolveDecision(c, d.id, 'accept');
    expect(netAssets(accepted.fund.ledger) - netAssets(c.fund.ledger)).toBeCloseTo(terms.wireNow, 1);
    expect(nav(accepted.fund.ledger)).toBeCloseTo(before, 8);
    const reload: Career = JSON.parse(JSON.stringify(c)); relationsAtClose(reload, () => draw);
    expect(reload.decisions.length).toBe(c.decisions.length);
  });
  it('applies bounded coverage pressure only to trailing rivals', () => {
    const c = fixture(); const pressure = fameEffects(c).coveragePressure;
    expect(pressure).toBeGreaterThan(0);
    expect(rivalCoverageDelta(c, 0.01, true)).toBe(4 - pressure);
    expect(rivalCoverageDelta(c, 0.9, true)).toBe(4);
    expect(rivalCoverageDelta(c, 0.01, false)).toBeGreaterThanOrEqual(-10);
    expect(rivalCoverageDelta({ ...c, immersion: false }, 0.01, true)).toBe(4);
  });
  it('raises quoted acquisition staff pay with a bounded retention premium, never the company price', () => {
    const c = fixture(); const a = managerTargets(c)[0]; const b = managerTargets({ ...c, immersion: false })[0];
    expect(a.salaryMultiplier).toBe(1 + performanceProfile(c).fame / 400);
    expect(a.salaryMultiplier).toBeLessThanOrEqual(1.25);
    expect(a.staffCostQ).toBeGreaterThan(b.staffCostQ);
    expect(a.price).toBe(b.price);
    expect(managerTargets(JSON.parse(JSON.stringify(c)))[0]).toEqual(a);
  });
  it('turns off fame benefits for incomplete, losing, invalid, overdue and ended histories', () => {
    const c = fixture();
    for (const bad of [
      { ...c, fund: { ...c.fund, history: c.fund.history.slice(1) } },
      { ...c, fund: { ...c.fund, history: c.fund.history.map(h => ({ ...h, ret: 0 })) } },
      { ...c, fund: { ...c.fund, history: c.fund.history.map(h => ({ ...h, ret: NaN })) } },
      { ...c, fund: { ...c.fund, history: c.fund.history.map(h => ({ ...h, latePayment: true })) } },
      { ...c, status: 'ended' as const },
    ]) expect(fameEffects(bad)).toMatchObject({ active: false, offerPoints: 0, salaryMultiplier: 1, coveragePressure: 0 });
  });
  it('saves the retention premium as actual incoming salaries and settles payroll from firm money', () => {
    const c = fixture(); post(c.journal, { q: c.fund.q, date: 'Test', payer: 'external', recipient: 'firm', category: 'opening', amount: 2e9, source: 'test-fame', memo: 'Disposable acquisition funding' });
    const mt = managerTargets(c)[0];
    let n = makeOffer(c, mt.id, mt.price).c; const d = dealsOf(n)[0];
    n = runDiligence(n, d.id).c;
    const result = closeDeal(n, d.id, 0); expect(result.ok).toBe(true);
    const pm = result.c.roster.find(e => e.id === `e-${mt.rivalId}-pm`);
    const ir = result.c.roster.find(e => e.id === `e-${mt.rivalId}-ir`);
    if (!ir) throw new Error('Expected acquired client manager');
    expect(ir.salaryQ).toBe(Math.round(mt.staffCostQ / 2 * 0.8 / 1000) * 1000);
    if (pm) expect(pm.salaryQ).toBe(Math.round(mt.staffCostQ / 2 * 1.2 / 1000) * 1000);
    const reload: Career = JSON.parse(JSON.stringify(result.c));
    const next = closeQuarter(reload, { orders: [], acceptOfferIds: [] });
    const paid = next.journal.txns.filter(t => t.q === next.fund.q && t.category === 'payroll');
    expect(paid.reduce((sum, t) => sum + t.amount, 0)).toBe(payroll(next.roster));
    expect(paid.every(t => t.payer === 'firm')).toBe(true);
  });
});