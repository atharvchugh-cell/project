// Regression tests for the Phase 2-4 review corrections: atomic rival transfers, the closing
// observation after every flow, late-interest returns, the business integration projection,
// itemized unpaid obligations and the potential cap. Every test asserts; none returns early.
import { describe, expect, it } from 'vitest';
import { nav, netAssets } from '@/lib/fund/accounting';
import { type Career, firmCash, forkCareer, newCareer, parseCareer } from './career';
import { closeQuarter, resolveDecision } from './close';
import { post } from './journal';
import { fire } from './phase2';
import { acquire, issueCall } from './phase3';
import { addMoney } from './phase4';
import { cashForecast } from './forecast';
import { bridges, periodOf, quarterEstimate } from './plan';
import { RIVAL_FIRMS, callClient, canPitch, clientTier, pitchBlock, pitchRival, relationsAtClose, rivalReturn } from './relations';
import { withAbility } from './roster';

const opts = { firmName: 'Harbor Hill', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed: 1 };
const none = { orders: [], acceptOfferIds: [] };
const closeN = (c: Career, k: number) => { for (let i = 0; i < k; i++) c = closeQuarter(c, none); return c; };
const setFirmCash = (c: Career, target: number) => { const diff = firmCash(c) - target; if (diff > 0) post(c.journal, { q: c.fund.q, date: 'test', payer: 'firm', recipient: 'founder', category: 'distribution', amount: diff, source: 'test:drain', memo: 'test' }); else if (diff < 0) post(c.journal, { q: c.fund.q, date: 'test', payer: 'external', recipient: 'firm', category: 'opening', amount: -diff, source: 'test:fill', memo: 'test' }); };
/** A career four quarters in where the fund clearly beat every rival over the trailing year. */
function strong(seed = 1): Career {
  const c = structuredClone(closeN(newCareer({ ...opts, seed }), 4));
  c.fund.history = c.fund.history.map(h => ({ ...h, ret: 0.12, bench: 0.0 }));
  return c;
}
const total = (c: Career, cat: string) => c.journal.txns.filter(t => t.category === cat).reduce((a, t) => a + t.amount, 0);

describe('rival pitches are atomic', () => {
  it('with every tier name already pending, Northgate cannot be pitched and no money moves', () => {
    const c = strong(1);
    for (const name of clientTier(netAssets(c.fund.ledger)).names) c.decisions.push({ id: `dup-${name}`, q: c.fund.q, kind: 'new_client', amount: 1e8, from: name, text: '', options: [{ id: 'accept', label: 'a', hint: '' }], defaultOption: 'accept', payload: { key: name, name } });
    const before = c.rivalAum.northgate; const decisions = c.decisions.length;
    expect(canPitch(c, 'northgate')).toBe(false);
    expect(pitchBlock(c, 'northgate')).toBe('Answer open client offers first');
    const n = pitchRival(c, 'northgate');
    expect(n).toBe(c);
    expect(n.rivalAum.northgate).toBe(before);
    expect(n.decisions.length).toBe(decisions);
  });

  // Same career, different pitch seeds: find a deterministic win and a deterministic loss.
  const base = strong(1);
  const tries = Array.from({ length: 40 }, (_, i) => { const c = structuredClone(base); c.fund.seed = 1000 + i; return { c, n: pitchRival(c, 'northgate') }; });
  const win = tries.find(t => t.n.rivalLog.at(-1)?.won)!;
  const loss = tries.find(t => t.n.rivalLog.at(-1) && !t.n.rivalLog.at(-1)!.won)!;

  it('a winning pitch reserves the exact amount behind one new offer; a loss moves nothing', () => {
    expect(win).toBeDefined(); expect(loss).toBeDefined();
    const amt = win.n.rivalLog.at(-1)!.amount;
    expect(amt).toBeGreaterThan(0);
    expect(win.n.rivalAum.northgate).toBeCloseTo(win.c.rivalAum.northgate - amt, 2);
    expect(win.n.decisions.length).toBe(win.c.decisions.length + 1);
    const tr = win.n.transfers.at(-1)!;
    expect(tr).toMatchObject({ direction: 'from_rival', status: 'pending', amount: amt, rival: 'northgate' });
    expect(loss.n.rivalAum.northgate).toBe(loss.c.rivalAum.northgate);
    expect(loss.n.transfers.length).toBe(loss.c.transfers.length);
  });

  it('accepting wires half, commits half and conserves every dollar', () => {
    const d = win.n.decisions.at(-1)!; const aum = netAssets(win.n.fund.ledger); const r0 = win.c.rivalAum.northgate;
    const a = resolveDecision(win.n, d.id, 'accept');
    const tr = a.transfers.find(t => t.decisionId === d.id)!;
    expect(tr.status).toBe('settled');
    expect(tr.wired! + tr.committed!).toBeCloseTo(d.amount, 2);
    expect(netAssets(a.fund.ledger)).toBeCloseTo(aum + tr.wired!, 0);
    expect(a.commitments.find(x => x.name === d.payload!.name)!.committed).toBeCloseTo(tr.committed!, 2);
    expect(a.rivalAum.northgate + tr.wired! + tr.committed!).toBeCloseTo(r0, 2);
  });

  it('declining returns the reserved money to the rival', () => {
    const d = win.n.decisions.at(-1)!;
    const x = resolveDecision(win.n, d.id, 'decline');
    expect(x.rivalAum.northgate).toBeCloseTo(win.c.rivalAum.northgate, 2);
    expect(x.transfers.find(t => t.decisionId === d.id)!.status).toBe('returned');
  });

  it('a defaulted decline resolves before the quarter trades, so the rival holds the money for that quarter', () => {
    const n = structuredClone(win.n); const d = n.decisions.at(-1)!; d.defaultOption = 'decline';
    const amt = d.amount; const held = n.rivalAum.northgate;
    const after = closeQuarter(n, none);
    const rr = rivalReturn(after, 0, after.fund.history.length - 1);
    expect(after.rivalAum.northgate).toBeCloseTo((held + amt) * (1 + rr), 0);
    expect(after.transfers.find(t => t.decisionId === d.id)!.status).toBe('returned');
  });

  it('the default (accept) at close settles the transfer through a real subscription', () => {
    const d = win.n.decisions.at(-1)!;
    const after = closeQuarter(win.n, none);
    const tr = after.transfers.find(t => t.decisionId === d.id)!;
    expect(tr.status).toBe('settled');
    expect(after.fund.investors.some(i => i.name === d.payload!.name && i.units > 0)).toBe(true);
    expect(after.flows.some(f => f.kind === 'won_from_rival' && f.amount === tr.wired)).toBe(true);
  });

  it('a rival wins one of our clients: money reaches the rival only when the fund pays, after that quarter\'s return', () => {
    const c = structuredClone(closeN(newCareer({ ...opts, seed: 3 }), 4));
    c.fund.history = c.fund.history.map(h => ({ ...h, ret: -0.05, bench: 0.05 }));
    const victim = c.fund.investors.filter(i => i.id !== 'you' && i.units > 0).sort((a, b) => b.units - a.units)[0];
    for (const i of c.fund.investors) c.satisfaction[i.id] = i.id === victim.id ? 10 : 60;
    victim.lockupUntilQ = 0;
    const r0 = structuredClone(c.rivalAum); const units = victim.units;
    relationsAtClose(c, () => 0.01);
    const tr = c.transfers.find(t => t.direction === 'to_rival')!;
    expect(tr.status).toBe('pending');
    expect(victim.units).toBe(0);
    expect(tr.amount).toBeCloseTo(units * nav(c.fund.ledger), 0);
    expect(c.rivalAum).toEqual(r0);
    const idx = RIVAL_FIRMS.findIndex(r => r.id === tr.rival);
    const before = c.rivalAum[tr.rival];
    const after = closeQuarter(c, none);
    const t2 = after.transfers.find(t => t.id === tr.id)!;
    expect(t2.status).toBe('settled');
    expect(after.rivalAum[tr.rival]).toBeCloseTo(before * (1 + rivalReturn(after, idx, after.fund.history.length - 1)) + tr.amount, 0);
  });
});

describe('closing observation and returns', () => {
  it('seed 777 first close: history, snapshot and live fund agree on closing AUM', () => {
    const c = closeQuarter(newCareer({ ...opts, seed: 777 }), none);
    const h = c.fund.history.at(-1)!;
    expect(h.aum).toBeCloseTo(netAssets(c.fund.ledger), 2);
    expect(c.snapshots.at(-1)!.aum).toBeCloseTo(h.aum, 2);
    expect(h.tradedAum! + h.closingFlows!).toBeCloseTo(h.aum, 2);
    const contributed = c.flows.filter(f => f.q === 1 && f.kind === 'contribution').reduce((a, f) => a + f.amount, 0);
    expect(contributed).toBeGreaterThan(0);
    expect(h.closingFlows!).toBeCloseTo(contributed, 0);
  });

  it('late capital-call interest counts in that quarter\'s return; NAV and compounded returns agree', () => {
    const start = newCareer({ ...opts, seed: 4242 }); const nav0 = nav(start.fund.ledger);
    let c = closeQuarter(issueCall(start, 100e6, 'regular'), none);
    c = structuredClone(c);
    c.calls[0].dueQ = 1; for (const l of c.calls[0].lines) l.status = 'late';
    for (const x of c.commitments) x.reliability = 1;
    const navStart = nav(c.fund.ledger);
    c = closeQuarter(c, none);
    expect(c.calls[0].lines.every(l => l.status === 'paid')).toBe(true);
    expect(total(c, 'call_penalty')).toBeCloseTo(2e6, 0);
    const h = c.fund.history.at(-1)!;
    expect(h.ret).toBeCloseTo(nav(c.fund.ledger) / navStart - 1, 12);
    expect(c.fund.history.reduce((a, x) => a * (1 + x.ret), nav0)).toBeCloseTo(nav(c.fund.ledger), 8);
    // Calls settled during close belong to that close's period.
    for (const t of c.journal.txns.filter(t => t.category === 'capital_call' || t.category === 'call_penalty')) expect(periodOf(t)).toBe(2);
  });

  it('a closed fund takes no new money at its final close or afterwards', () => {
    let c = newCareer({ ...opts, years: 2, seed: 9 });
    while (c.status === 'running') { for (const i of c.fund.investors) c.satisfaction[i.id] = 100; c = closeQuarter(c, none); }
    expect(c.fund.status).toBe('ended');
    const last = c.fund.q;
    expect(c.flows.filter(f => f.q === last && f.kind === 'contribution')).toEqual([]);
    const id = c.fund.investors.find(i => i.id !== 'you')!.id;
    const n = structuredClone(c);
    expect(addMoney(n, id, 1e6, 'contribution')).toBe(0);
    expect(callClient(c, id, 'thanks')).toBe(c);
  });
});

describe('business integration schedule', () => {
  const setup = () => {
    const c = structuredClone(newCareer({ ...opts, seed: 55 }));
    c.targets = [{ id: 'tgt-x', q: 0, kind: 'research', name: 'Quarry Street Analytics', price: 10e6, revenueQ: 4e6, costQ: 3e6, multiple: 8, blurb: '' }];
    const r = c.roster.findIndex(e => /analyst/i.test(e.role));
    c.roster[r] = { ...c.roster[r], ability: 72, potential: 72 };
    return { c, r };
  };
  it('forecast, estimate and actual settlement use the same half-revenue first quarters', () => {
    const { c } = setup();
    const b = acquire(c, 'tgt-x');
    expect(b.subsidiaries.length).toBe(1);
    const f = cashForecast(b, 0);
    expect(f.rows.slice(0, 3).map(x => Math.round(x.business))).toEqual([-1e6, -1e6, 1e6]);
    expect(f.rows[0].integrating).toBe(true);
    const e = quarterEstimate(b);
    expect(e.firmIn.find(x => /Quarry/.test(x.label))!.amount).toBe(2e6);
    expect(e.firmOut.find(x => /Quarry/.test(x.label))!.amount).toBe(3e6);
    const a = closeQuarter(b, none);
    const tx = a.journal.txns.filter(t => t.closeId?.endsWith(':Q1'));
    const net = tx.filter(t => t.category === 'subsidiary_revenue').reduce((s, t) => s + t.amount, 0) - tx.filter(t => t.category === 'subsidiary_cost').reduce((s, t) => s + t.amount, 0);
    expect(net).toBeCloseTo(f.rows[0].business, 2);
  });
  it('the research-shop boost stops at each person\'s potential', () => {
    const { c, r } = setup();
    const b = acquire(c, 'tgt-x');
    expect(b.roster[r].ability).toBe(72);
    const grow = { ...c.roster[r], ability: 60, potential: 80 };
    expect(withAbility(grow, 64)).toBe(64);
    expect(withAbility({ ...grow, ability: 79 }, 82)).toBe(80);
    expect(withAbility({ ...grow, ability: 90 }, 93)).toBe(90);
  });
  it('acquisitions keep a reserve for the new business\'s own bills', () => {
    const { c } = setup();
    const reserveNow = c.roster.reduce((a, e) => a + e.salaryQ, 0) + c.officeQ + c.founderSalaryQ;
    setFirmCash(c, reserveNow * 3 + 10e6 + 1e6); // enough for the price and parent reserve, not the business's 3 quarters of costs
    expect(acquire(c, 'tgt-x')).toBe(c);
  });
});

describe('unpaid obligations stay owed', () => {
  it('severance beyond firm cash is recorded, partly paid and settled once later', () => {
    const c = structuredClone(newCareer({ ...opts, seed: 21 }));
    const e = c.roster[3]; c.roster[3] = { ...e, salaryQ: 2_268_000 };
    setFirmCash(c, 10_000);
    const n = fire(c, e.id);
    expect(total(n, 'severance')).toBeCloseTo(10_000, 2);
    expect(n.payables).toEqual([expect.objectContaining({ kind: 'severance', amount: 2_258_000 })]);
    expect(n.arrears).toBeCloseTo(2_258_000, 2);
    expect(n.notices.at(-1)!.body).toMatch(/still owed/);
    expect(n.notices.at(-1)!.body).not.toMatch(/was paid\./);
    setFirmCash(n, 50e6);
    const a = closeQuarter(n, none);
    expect(total(a, 'severance')).toBeCloseTo(2_268_000, 2);
    expect(a.payables.some(p => p.kind === 'severance')).toBe(false);
    for (const b of bridges(a)) expect(b.reconciles).toBe(true);
  });

  it('business bills that cannot be paid remain owed and are paid exactly once later', () => {
    const c = structuredClone(newCareer({ ...opts, seed: 55 }));
    c.targets = [{ id: 'tgt-x', q: 0, kind: 'admin', name: 'Keystone Fund Services', price: 10e6, revenueQ: 4e6, costQ: 3e6, multiple: 8, blurb: '' }];
    let b = acquire(c, 'tgt-x');
    b = structuredClone(b);
    b.roster = b.roster.map(e => ({ ...e, salaryQ: e.salaryQ * 20 }));
    setFirmCash(b, 0);
    const a = closeQuarter(b, none);
    const owed = a.payables.find(p => p.kind === 'subsidiary')!;
    expect(owed.amount).toBeCloseTo(3e6, 2);
    expect(a.arrears).toBeCloseTo(a.payables.reduce((s, p) => s + p.amount, 0), 2);
    expect(cashForecast(a).rows[0].core).toBeGreaterThanOrEqual(a.arrears);
    const fixed = structuredClone(a); fixed.roster = c.roster; setFirmCash(fixed, 500e6);
    const z = closeQuarter(fixed, none);
    expect(total(z, 'subsidiary_cost')).toBeCloseTo(6e6, 2);
    expect(z.arrears).toBe(0);
    for (const br of bridges(z)) expect(br.reconciles).toBe(true);
  });
});

describe('whole career', () => {
  it('runs twelve quarters with calls, client calls and pitches; NAV, ledger and transfers stay consistent', () => {
    const start = newCareer({ ...opts, seed: 31 }); const nav0 = nav(start.fund.ledger);
    let c = issueCall(start, 300e6, 'deal', 'SPX');
    for (let k = 0; k < 12 && c.status === 'running'; k++) {
      const inv = c.fund.investors.find(i => i.id !== 'you' && i.units > 0)!;
      c = callClient(c, inv.id, 'thanks');
      for (const r of RIVAL_FIRMS) c = pitchRival(c, r.id);
      if (k === 5) c = issueCall(c, 100e6, 'regular');
      c = closeQuarter(c, none);
      expect(c.fund.history.reduce((a, x) => a * (1 + x.ret), nav0)).toBeCloseTo(nav(c.fund.ledger), 6);
      expect(c.fund.history.at(-1)!.aum).toBeCloseTo(c.snapshots.at(-1)!.aum, 2);
      expect(c.arrears).toBeCloseTo(c.payables.reduce((s, p) => s + p.amount, 0), 2);
      expect(Object.values(c.rivalAum).every(v => v >= 0)).toBe(true);
    }
    for (const b of bridges(c)) expect(b.reconciles).toBe(true);
    for (const t of c.transfers.filter(t => t.status !== 'pending' && t.direction === 'from_rival')) expect((t.wired ?? 0) + (t.committed ?? 0) + (t.returned ?? 0)).toBeCloseTo(t.amount, 2);
    // Save/resume keeps every new field; a practice copy never touches the live career.
    const back = parseCareer(JSON.stringify(c))!;
    expect(back.payables).toEqual(c.payables); expect(back.transfers).toEqual(c.transfers);
    const live = JSON.stringify(c); const p = forkCareer(c);
    closeQuarter(fire(p, p.roster[1].id), none);
    expect(JSON.stringify(c)).toBe(live);
  });

  it('older saves with a single arrears number load as an itemized wage payable', () => {
    const raw = JSON.parse(JSON.stringify(newCareer(opts))); delete raw.payables; delete raw.transfers; raw.arrears = 5e6;
    const back = parseCareer(JSON.stringify(raw))!;
    expect(back.transfers).toEqual([]);
    expect(back.payables).toEqual([expect.objectContaining({ kind: 'payroll', amount: 5e6 })]);
  });
});
