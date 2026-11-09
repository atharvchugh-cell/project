import { describe, expect, it } from 'vitest';
import { nav, netAssets } from '@/lib/fund/accounting';
import { type Career, firmCash, newCareer, normalizeCareer } from './career';
import { closeQuarter, resolveDecision } from './close';
import { cashForecast } from './forecast';
import { phase2AtClose, approveIdea, assign, candidates, fire, giveRaise, hire, meetClient, promote, rejectIdea, sectorsNow } from './phase2';
import { totalOf } from './journal';
import { payroll } from './roster';

const opts = { firmName: 'Harbor Hill', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed: 777 };
const none = { orders: [], acceptOfferIds: [] };
const run = (c: Career, n: number) => { for (let i = 0; i < n; i++) c = closeQuarter(c, none); return c; };

describe('cash runway forecast', () => {
  it('matches the next real close when nothing else changes', () => {
    const c = newCareer(opts);
    const row = cashForecast(c).rows[0];
    expect(row.core).toBe(payroll(c.roster) + c.officeQ);
    expect(row.cash).toBeGreaterThan(0);
  });
  it('flags the first quarter firm cash cannot cover payroll and office', () => {
    const c = newCareer(opts);
    c.roster = c.roster.map(e => ({ ...e, salaryQ: e.salaryQ * 4 }));
    const f = cashForecast(c);
    expect(f.firstShort).not.toBeNull();
    const before = f.rows.slice(0, f.rows.indexOf(f.firstShort!));
    expect(before.every(r => !r.short)).toBe(true);
  });
  it('a falling fund brings the shortfall earlier or keeps it', () => {
    const c = newCareer({ ...opts, scenario: 'boutique' });
    const flat = cashForecast(c, 0, 20).firstShort?.q ?? 99;
    const down = cashForecast(c, -0.1, 20).firstShort?.q ?? 99;
    expect(down).toBeLessThanOrEqual(flat);
  });
});

describe('people', () => {
  it('hiring adds the candidate to payroll and can only happen once', () => {
    const c = newCareer(opts); const cand = candidates(c)[0];
    const h = hire(c, cand.id);
    expect(payroll(h.roster)).toBe(payroll(c.roster) + cand.salaryQ);
    expect(hire(h, cand.id)).toBe(h);
  });
  it('firing pays one quarter of severance from the firm', () => {
    const c = newCareer(opts); const e = c.roster[5];
    const f = fire(c, e.id);
    expect(f.roster).toHaveLength(5);
    expect(totalOf(f.journal, 'severance')).toBe(e.salaryQ);
    expect(firmCash(f)).toBe(firmCash(c) - e.salaryQ);
  });
  it('raises and promotions raise pay and morale', () => {
    const c = newCareer(opts); const e = c.roster[3];
    const r = giveRaise(c, e.id).roster[3]; expect(r.salaryQ).toBeGreaterThan(e.salaryQ); expect(r.morale).toBeGreaterThan(e.morale);
    const p = promote(c, e.id).roster[3]; expect(p.level).toBe(e.level + 1);
  });
  it('an assigned analyst pitches an idea from the chosen sector', () => {
    let c = newCareer(opts); const sector = sectorsNow(c)[0];
    c = assign(c, c.roster[3].id, sector);
    c = run(c, 4);
    expect(c.ideas.length).toBeGreaterThan(0);
    expect(c.ideas[0].sector).toBe(sector);
  });
});

describe('ideas and clients', () => {
  it('an approved idea is bought at the next close and reviewed a year later', () => {
    let c = newCareer(opts); c = assign(c, c.roster[1].id, sectorsNow(c)[0]); c = run(c, 4);
    const idea = c.ideas.find(i => i.status === 'pending')!;
    expect(idea).toBeTruthy();
    c = approveIdea(c, idea.id, 0.05);
    expect(c.pendingOrders).toHaveLength(1);
    c = closeQuarter(c, none);
    expect(c.fund.ledger.positions[idea.ticker]).toBeGreaterThan(0);
    expect(c.pendingOrders).toHaveLength(0);
    c = run(c, 4);
    const done = c.ideas.find(i => i.id === idea.id)!;
    expect(done.reviewedQ).toBeDefined();
    expect(typeof done.result).toBe('number');
  });
  it('rejecting an idea lowers the analyst morale', () => {
    let c = newCareer(opts); const a = c.roster[1]; c = assign(c, a.id, sectorsNow(c)[0]); c = run(c, 4);
    const idea = c.ideas.find(i => i.status === 'pending')!;
    const before = c.roster.find(e => e.id === idea.analystId)!.morale;
    c = rejectIdea(c, idea.id);
    expect(c.roster.find(e => e.id === idea.analystId)!.morale).toBe(before - 3);
  });
  it('a late payment is a broken promise that lowers satisfaction by 10 more', () => {
    const base = closeQuarter(newCareer(opts), none);
    const id = base.fund.investors[1].id;
    const onTime = structuredClone(base); const late = structuredClone(base);
    late.fund.history[late.fund.history.length - 1].latePayment = true;
    onTime.fund.history[onTime.fund.history.length - 1].latePayment = false;
    phase2AtClose(onTime, () => 0.99, false); phase2AtClose(late, () => 0.99, false);
    expect(onTime.satisfaction[id] - late.satisfaction[id]).toBe(10);
  });
  it('meeting a client raises satisfaction once a year', () => {
    const c = newCareer(opts); const id = c.fund.investors[1].id;
    const m1 = meetClient(c, id);
    expect(m1.satisfaction[id]).toBeGreaterThan(c.satisfaction[id]);
    expect(meetClient(m1, id)).toBe(m1);
  });
  it('an unhappy client redeems 30% if no one calls, without changing NAV', () => {
    let c = newCareer(opts); const inv = c.fund.investors[1];
    c.satisfaction[inv.id] = 5; c.fund.investors[1].lockupUntilQ = 0;
    c = closeQuarter(c, none);
    const d = c.decisions.find(x => x.kind === 'allocation_review' && x.payload?.investorId === inv.id && !x.resolved)!;
    expect(d).toBeTruthy();
    const units = c.fund.investors.find(i => i.id === inv.id)!.units;
    const n0 = nav(c.fund.ledger);
    const after = resolveDecision(c, d.id, 'accept');
    expect(after.fund.investors.find(i => i.id === inv.id)!.units).toBeCloseTo(units * 0.7, 3);
    expect(nav(after.fund.ledger)).toBeCloseTo(n0, 6);
  });
  it('a client top-up grows AUM at the current NAV', () => {
    const c = newCareer(opts); const inv = c.fund.investors[1];
    c.decisions.push({ id: 't', q: 0, kind: 'top_up', amount: 1e8, text: '', options: [{ id: 'accept', label: '', hint: '' }], payload: { key: inv.id, investorId: inv.id } });
    const n0 = nav(c.fund.ledger); const a0 = netAssets(c.fund.ledger);
    const r = resolveDecision(c, 't', 'accept');
    expect(nav(r.fund.ledger)).toBeCloseTo(n0, 6);
    expect(netAssets(r.fund.ledger)).toBeCloseTo(a0 + 1e8, 0);
  });
  it('open decisions take their default when the next quarter closes', () => {
    let c = run(newCareer(opts), 4);
    const board = c.decisions.find(d => d.kind === 'board_motion')!;
    expect(board.resolved).toBeUndefined();
    c = closeQuarter(c, none);
    expect(c.decisions.find(d => d.id === board.id)!.resolved).toBe('none');
  });
  it('an annual board motion records three votes', () => {
    let c = run(newCareer(opts), 4);
    const board = c.decisions.find(d => d.kind === 'board_motion')!;
    c = resolveDecision(c, board.id, 'salary');
    expect(c.board.at(-1)!.votes).toHaveLength(3);
  });
  it('older career saves gain the new fields without balance changes', () => {
    const c = newCareer(opts) as Partial<Career> & Career;
    const cash = firmCash(c);
    delete (c as Partial<Career>).ideas; delete (c as Partial<Career>).pendingOrders;
    const n = normalizeCareer(c);
    expect(n.ideas).toEqual([]); expect(firmCash(n)).toBe(cash);
  });
});
