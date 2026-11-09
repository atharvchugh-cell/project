// Targeted review corrections: consolidated valuation neutral to internal cash moves, sale-time realized
// staff P&L, cash-free/debt-free acquisition closing bridge, and the research-shop benefit on negotiated closes.
import { describe, expect, it } from 'vitest';
import type { Receipt } from '@/lib/fund/engine';
import { type Career, type Idea, firmCash, newCareer } from './career';
import { closeQuarter } from './close';
import { post } from './journal';
import { applyReceipt, ideaPnl } from './attribution';
import { companyCash, distributeCompanyCash } from './business';
import { valuation } from './exit';
import { closeDeal, dealsOf, makeOffer, runDiligence } from './deals';
import { isResearcher } from './roster';
import type { Subsidiary } from './phase3';

const opts = (seed = 777) => ({ firmName: 'Test', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed });
const none = { orders: [], acceptOfferIds: [] };
const closeN = (c: Career, k: number) => { for (let i = 0; i < k; i++) c = closeQuarter(c, none); return c; };
const inject = (c: Career, amt: number) => post(c.journal, { q: c.fund.q, date: 't', payer: 'external', recipient: 'firm', category: 'capital_injection', amount: amt, source: `test:${c.journal.seq}`, memo: 'fixture' });

function withSub(): Career {
  const c = newCareer(opts()); inject(c, 60e6);
  const s: Subsidiary = { id: 'sub-x', kind: 'research', name: 'Fixture Research', price: 0, revenueQ: 1e6, costQ: 0.8e6, multiple: 5, acquiredQ: c.fund.q, ownerId: 'firm' };
  c.subsidiaries.push(s); c.entities.push({ id: s.id, name: s.name, kind: 'company', ownerId: 'firm' });
  return c;
}

describe('consolidated valuation is neutral to internal cash moves', () => {
  it('retaining $10M in a 100%-owned company and sweeping it back leaves value unchanged', () => {
    const c = withSub(); const v0 = valuation(c).total;
    post(c.journal, { q: c.fund.q, date: 't', payer: 'firm', recipient: 'sub-x', category: 'business_retained', amount: 10e6, source: 'keep', memo: 'x' });
    expect(companyCash(c, 'sub-x')).toBe(10e6);
    const v1 = valuation(c).total; expect(v1).toBeCloseTo(v0, 0);
    const r = distributeCompanyCash(c, 'sub-x'); expect(r.ok).toBe(true);
    expect(companyCash(r.c, 'sub-x')).toBeCloseTo(0.8e6, 0);
    expect(firmCash(r.c) + companyCash(r.c, 'sub-x')).toBeCloseTo(firmCash(c) + companyCash(c, 'sub-x'), 0);
    expect(valuation(r.c).total).toBeCloseTo(v0, 0);
  });
  it('a loan draw and a principal repayment do not create or destroy value', () => {
    const c = withSub(); const v0 = valuation(c).total; const s = c.subsidiaries[0];
    post(c.journal, { q: c.fund.q, date: 't', payer: 'external', recipient: 'firm', category: 'loan_draw', amount: 5e6, source: 'draw', memo: 'x' });
    s.loan = { principal: 5e6, balance: 5e6, rateQ: 0.02, amortQ: 0.25e6, maturityQ: 20, drawnQ: c.fund.q, lastQ: c.fund.q, breaches: 0, penalty: 0 };
    expect(valuation(c).total).toBeCloseTo(v0, 0);
    post(c.journal, { q: c.fund.q, date: 't', payer: 'firm', recipient: 'external', category: 'debt_repayment', amount: 2e6, source: 'repay', memo: 'x' });
    s.loan.balance = 3e6;
    expect(valuation(c).total).toBeCloseTo(v0, 0);
  });
  it('labels the earnings basis and lists company cash separately', () => {
    const v = valuation(withSub());
    expect(v.lines.some(l => /Earnings basis/.test(l.label))).toBe(true);
    expect(v.lines.some(l => /inside owned companies/.test(l.label))).toBe(true);
  });
});

describe('staff realized P&L is fixed at sale time', () => {
  const rc = (side: 'buy' | 'sell', amount: number, before: number, ref?: string): Receipt => ({ q: 1, ref, ticker: 'IBM', side, requested: amount, amount, cost: 0, before, timing: 'mid', bidx: 100 });
  const setup = () => {
    const c = newCareer(opts()); const e = c.roster[0];
    const i: Idea = { id: 'i1', q: 0, analystId: e.id, analyst: e.name, ticker: 'IBM', sector: 'x', thesis: 't', conviction: 5, status: 'approved' };
    c.ideas.push(i); c.fund.ledger.positions = { ...c.fund.ledger.positions, IBM: 0 };
    return c;
  };
  const pos = (c: Career, v: number) => { c.fund.ledger.positions.IBM = v; };
  it('buy $100, rises to $120, sell half for $60, rest falls to $20: realized $10, unrealized -$30', () => {
    const c = setup(); applyReceipt(c, rc('buy', 100, 0, 'i1')); pos(c, 100);
    pos(c, 120); applyReceipt(c, rc('sell', 60, 120)); pos(c, 60);
    const at60 = ideaPnl(c, c.ideas.find(i => i.id === 'i1')!); expect(at60.realized).toBeCloseTo(10, 6); expect(at60.unrealized).toBeCloseTo(10, 6);
    pos(c, 20);
    const p = ideaPnl(c, c.ideas.find(i => i.id === 'i1')!);
    expect(p.realized).toBeCloseTo(10, 6); expect(p.unrealized).toBeCloseTo(-30, 6); expect(p.pnl).toBeCloseTo(-20, 6);
  });
  it('multiple buys and sales, then a zero position: realized never moves with later prices', () => {
    const c = setup(); const get = () => ideaPnl(c, c.ideas.find(i => i.id === 'i1')!);
    applyReceipt(c, rc('buy', 100, 0, 'i1')); pos(c, 150); // basis 100
    applyReceipt(c, rc('buy', 50, 150, 'i1')); pos(c, 200); // basis 150, holds all
    applyReceipt(c, rc('sell', 50, 200)); pos(c, 150); // released 37.5 -> realized 12.5
    expect(get().realized).toBeCloseTo(12.5, 6);
    pos(c, 30); expect(get().realized).toBeCloseTo(12.5, 6); expect(get().unrealized).toBeCloseTo(30 - 112.5, 6);
    applyReceipt(c, rc('sell', 30, 30)); pos(c, 0);
    const p = get(); expect(p.realized).toBeCloseTo(12.5 + 30 - 112.5, 6); expect(p.unrealized).toBe(0); expect(p.open).toBe(false);
    expect(p.pnl).toBeCloseTo(50 + 30 - 150, 6);
  });
  it('another holder buying in later does not change our realized profit', () => {
    const c = setup(); applyReceipt(c, rc('buy', 100, 0, 'i1')); pos(c, 120);
    applyReceipt(c, rc('sell', 60, 120)); pos(c, 60);
    applyReceipt(c, rc('buy', 60, 60)); pos(c, 120); // manual buy dilutes our fraction to 50%
    const p = ideaPnl(c, c.ideas.find(i => i.id === 'i1')!); expect(p.realized).toBeCloseTo(10, 6); expect(p.value).toBeCloseTo(60, 6);
  });
});

describe('negotiated acquisition closing', () => {
  const buy = (seed = 3) => {
    let c = closeN(newCareer(opts(seed)), 4); inject(c, 500e6); const t = c.targets[0]; t.kind = 'research';
    c = makeOffer(c, t.id, t.price).c; const d = dealsOf(c)[0]; c = runDiligence(c, d.id).c;
    return { pre: c, r: closeDeal(c, d.id, 0), id: d.id };
  };
  it('saves a cash-free, debt-free bridge: seller keeps pre-closing cash, the first owned quarter starts at $0', () => {
    const { r } = buy(); expect(r.ok).toBe(true); const s = r.c.subsidiaries[0];
    const lastPre = [...(s.history ?? [])].reverse().find(h => h.simulated)!;
    expect(s.closing!.structure).toBe('cash_free_debt_free');
    expect(s.closing!.sellerCash).toBeCloseTo(lastPre.cash, 6); expect(s.closing!.purchasedCash).toBe(0);
    expect(companyCash(r.c, s.id)).toBe(0);
    expect(s.closing!.equity + s.closing!.loan).toBeCloseTo(s.closing!.price, 6);
  });
  it('every researcher gains up to 4 ability once, capped at potential, and it does not reapply', () => {
    const { pre, r, id } = buy(); const s = r.c.subsidiaries[0];
    for (const e of pre.roster.filter(isResearcher)) {
      const after = r.c.roster.find(x => x.id === e.id)!;
      expect(after.ability).toBeGreaterThanOrEqual(e.ability); expect(after.ability - e.ability).toBeLessThanOrEqual(4 + 1e-9);
      expect(after.ability).toBeLessThanOrEqual(Math.max(e.ability, e.potential ?? 100) + 1e-9);
    }
    for (const e of pre.roster.filter(x => !isResearcher(x))) expect(r.c.roster.find(x => x.id === e.id)!.ability).toBe(e.ability);
    expect(s.benefit).toBeDefined();
    const reloaded: Career = JSON.parse(JSON.stringify(r.c));
    expect(closeDeal(reloaded, id, 0).ok).toBe(false);
    expect(reloaded.roster.map(e => e.ability)).toEqual(r.c.roster.map(e => e.ability));
  });
});
