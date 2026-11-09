import { describe, expect, it } from 'vitest';
import { SPX, costPerQuarter, estimatedDue, newFund, playQuarter, previewOrders, rebalanceOrders } from '@/lib/fund/engine';
import { netAssets } from '@/lib/fund/accounting';
import { CAREER_KEY, type Career, careerFromLegacy, emptyPlan, firmCash, forkCareer, founderCash, newCareer, parseCareer, saveCareer } from './career';
import { closeIdFor, closeQuarter, distribute, setFounderSalary } from './close';
import { bridges, cashBridge, parseSalary, planDecision, plannedOrders, quarterEstimate, recapFor, validatePlan } from './plan';
import { approveIdea } from './phase2';

const opts = { firmName: 'Harbor Hill', fundName: 'Harbor Hill Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed: 4242 };
const memory = () => { const m = new Map<string, string>(); return { m, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
const withPlan = (c: Career, orders: Career['plan']['orders']): Career => ({ ...c, plan: { ...c.plan, orders } });

describe('quarter plan persistence', () => {
  it('saves the staged plan with the career and restores it on resume', () => {
    const c = withPlan(newCareer(opts), [{ ticker: SPX, amount: 4.98e9 }]);
    const store = memory();
    expect(saveCareer(c, store)).toEqual({ ok: true });
    const back = parseCareer(store.m.get(CAREER_KEY) ?? null)!;
    expect(back.plan.orders).toEqual([{ ticker: SPX, amount: 4.98e9 }]);
    expect(back.plan.q).toBe(0);
  });
  it('clears the plan only after a successful close', () => {
    const c = withPlan(newCareer(opts), [{ ticker: SPX, amount: 1e9 }]);
    const n = closeQuarter(c);
    expect(n.fund.q).toBe(1);
    expect(n.plan).toEqual(emptyPlan(1));
    expect(c.plan.orders).toHaveLength(1);
  });
  it('drops a plan saved for a different quarter instead of executing it later', () => {
    const c = withPlan(newCareer(opts), [{ ticker: SPX, amount: 1e9 }]);
    const raw = JSON.parse(JSON.stringify(c)); raw.plan.q = 5;
    expect(parseCareer(JSON.stringify(raw))!.plan.orders).toEqual([]);
  });
  it('reports storage failures instead of swallowing them', () => {
    const c = newCareer(opts);
    const r = saveCareer(c, { setItem: () => { throw new DOMException('full', 'QuotaExceededError'); }, removeItem: () => {} });
    expect(r.ok).toBe(false);
  });
  it('never saves a practice branch', () => {
    const store = memory();
    saveCareer(forkCareer(newCareer(opts)), store);
    expect(store.m.size).toBe(0);
  });
});

describe('combined plan', () => {
  it('runs desk orders and approved idea orders for the same ticker together, matching the preview', () => {
    let c = closeQuarter(newCareer(opts));
    c = { ...c, ideas: [{ id: 'i1', q: c.fund.q, analystId: c.roster[1].id, analyst: c.roster[1].name, ticker: SPX, sector: 'Index', thesis: 't', conviction: 70, status: 'pending' }] };
    c = approveIdea(c, 'i1', 0.02);
    const idea = c.pendingOrders[0];
    expect(idea).toBeDefined();
    c = withPlan(c, [{ ticker: SPX, amount: 5e8 }]);
    const d = planDecision(c);
    expect(d.orders.filter(o => o.ticker === SPX).map(o => o.amount)).toEqual([5e8, idea.amount]);
    expect(plannedOrders(c).map(o => o.source)).toEqual(['desk', 'idea']);
    const pv = previewOrders(c.fund, d.orders);
    const before = c.fund.ledger.positions[SPX] ?? 0;
    expect(pv.buys).toBeCloseTo(5e8 + idea.amount, -2);
    const closed = closeQuarter(c);
    const direct = playQuarter(c.fund, d);
    expect(closed.fund.ledger.positions[SPX]).toBeCloseTo(direct.ledger.positions[SPX], 2);
    expect(direct.ledger.positions[SPX]).toBeGreaterThan(before);
  });
  it('validation removes orders the fund cannot execute and offers that expired', () => {
    const c = newCareer(opts);
    const v = validatePlan(c.fund, { ...c.plan, orders: [{ ticker: 'AAPL', amount: -1e6 }, { ticker: SPX, amount: Number.NaN }], acceptOfferIds: ['gone'], sellLocked: -5 });
    expect(v.plan.orders).toEqual([]); expect(v.plan.acceptOfferIds).toEqual([]); expect(v.plan.sellLocked).toBe(0);
    expect(v.issues.length).toBeGreaterThan(0);
  });
});

describe('exactly-once close', () => {
  it('a quarter whose close id is already posted cannot settle again', () => {
    const c = newCareer(opts);
    const n = closeQuarter(c);
    expect(n.journal.closed).toContain(closeIdFor(c, 1));
    const replay: Career = structuredClone(n); replay.fund.q = 0;
    expect(closeQuarter(replay)).toBe(replay);
    expect(n.journal.txns.filter(t => t.closeId === closeIdFor(c, 1) && t.category === 'payroll')).toHaveLength(1);
  });
});

describe('cost and fee estimates', () => {
  it('a new $5B career owes about $13.5M next quarter: $12.5M management fee plus $1M fund administration', () => {
    const c = newCareer(opts);
    expect(netAssets(c.fund.ledger)).toBeCloseTo(5e9, -4);
    expect(estimatedDue(c.fund, 1)).toBeCloseTo(13.5e6, -4);
    const e = quarterEstimate(c, 1);
    expect(e.fund.find(x => /Management fee/.test(x.label))?.basis).toBe('estimate');
    expect(e.firmOut.reduce((a, b) => a + b.amount, 0)).toBe(e.firmOutTotal);
  });
  it('All S&P 500 with a 3-quarter reserve does not force a sale at the first close', () => {
    const c = newCareer(opts);
    const n = closeQuarter(withPlan(c, rebalanceOrders(c.fund, 'index', 3, estimatedDue)));
    expect(n.fund.history[0].forcedSale).toBeUndefined();
  });
  it('deferred fees and scheduled payouts are counted once', () => {
    const f = newFund('normal', 9, 10, false, true);
    f.ledger.liabilities.push({ id: 'x', kind: 'mgmt_fee', label: 'Deferred fee', amount: 1e6, dueQ: 0, paid: false });
    const lines = estimatedDue(f, 1) - estimatedDue({ ...f, ledger: { ...f.ledger, liabilities: [] } }, 1);
    expect(lines).toBeCloseTo(1e6 - 1e6 * 0.0025 - 1e6 * 0.0012, 0);
  });
  it('classic funds keep their operating cost rule; new careers charge only fund administration', () => {
    const classic = newFund('normal', 3, 10, false, true);
    expect(costPerQuarter(classic)).toBeCloseTo(netAssets(classic.ledger) * 0.0012, 2);
    const c = newCareer(opts);
    expect(costPerQuarter(c.fund)).toBeCloseTo(netAssets(c.fund.ledger) * 0.0002, 2);
    expect(careerFromLegacy(classic, { firmName: 'X', hq: 'Boston', philosophy: 'diversified' }).fund.costRule).toBeUndefined();
  });
});

describe('cash reconciliation', () => {
  it('opening + inflows - outflows = closing for every period, including salary, distributions and salary changes', () => {
    let c = newCareer(opts);
    c = closeQuarter(c);
    c = distribute(c, 1e6);
    c = setFounderSalary(c, 400e3);
    c = closeQuarter(c);
    c = closeQuarter(c);
    for (const b of bridges(c, 'firm')) {
      expect(b.reconciles).toBe(true);
      const snap = c.snapshots.find(s => s.q === b.q);
      if (snap) expect(b.closing).toBeCloseTo(snap.firmCash, 2);
    }
    const q1 = c.snapshots.find(s => s.q === 1)!;
    const salaryQ1 = c.journal.txns.filter(t => t.closeId === closeIdFor(c, 1) && t.category === 'salary').reduce((a, t) => a + t.amount, 0);
    expect(salaryQ1).toBe(250e3);
    expect(q1.expenses).toBeGreaterThanOrEqual(c.officeQ + salaryQ1);
    const b2 = cashBridge(c, 'firm', 2);
    expect(b2.financingOut).toBe(1e6);
    expect(b2.outflows.find(x => x.category === 'salary')?.amount).toBe(400e3);
    expect(bridges(c, 'firm').at(-1)!.closing).toBeCloseTo(firmCash(c), 2);
    expect(cashBridge(c, 'founder', c.fund.q).closing).toBeCloseTo(founderCash(c) - 0, 2);
    const r = recapFor(c, 2)!;
    expect(r.salaryChange).toEqual({ fromQ: 250e3, toQ: 400e3 });
    expect(r.feeCash).toBeGreaterThan(0);
  });
});

describe('founder salary', () => {
  it('rejects non-finite, negative and malformed input', () => {
    for (const bad of ['', 'abc', '-5', 'Infinity', '1e999', '60000001']) expect(parseSalary(bad).ok).toBe(false);
    expect(parseSalary('$250,400')).toEqual({ ok: true, value: 250e3 });
    const c = newCareer(opts);
    expect(setFounderSalary(c, Number.NaN)).toBe(c);
    expect(setFounderSalary(c, -1)).toBe(c);
  });
  it('takes effect at the next close and is recorded once per quarter', () => {
    let c = setFounderSalary(newCareer(opts), 100e3);
    c = setFounderSalary(c, 120e3);
    expect(c.salaryHistory).toEqual([{ atQ: 0, effectiveQ: 1, fromQ: 250e3, toQ: 120e3 }]);
    c = closeQuarter(c);
    expect(c.journal.txns.find(t => t.category === 'salary')?.amount).toBe(120e3);
  });
});

describe('legacy saves', () => {
  it('a v1 career save loads with an empty plan and keeps its classic fund costs', () => {
    const c = newCareer(opts);
    const v1 = JSON.parse(JSON.stringify(c)); v1.version = 1; delete v1.plan; delete v1.salaryHistory; delete v1.fund.costRule;
    const back = parseCareer(JSON.stringify(v1))!;
    expect(back.plan).toEqual(emptyPlan(0));
    expect(back.salaryHistory).toEqual([]);
    expect(back.fund.costRule).toBeUndefined();
    expect(closeQuarter(back).fund.q).toBe(1);
  });
});

describe('branch isolation', () => {
  it('a practice branch can change its plan, salary and books without touching the live career', () => {
    const live = withPlan(newCareer(opts), [{ ticker: SPX, amount: 1e9 }]);
    const snapshot = JSON.stringify(live);
    let b = forkCareer(live);
    b = withPlan(b, [{ ticker: SPX, amount: 3e9 }]);
    b = setFounderSalary(b, 0);
    b = closeQuarter(distribute(b, 1e6));
    expect(b.practice).toBe(true);
    expect(JSON.stringify(live)).toBe(snapshot);
    expect(live.plan.orders[0].amount).toBe(1e9);
  });
});
