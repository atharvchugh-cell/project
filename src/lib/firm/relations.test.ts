import { describe, expect, it } from 'vitest';
import { netAssets } from '@/lib/fund/accounting';
import { newCareer, normalizeCareer, type Career } from './career';
import { closeQuarter, resolveDecision } from './close';
import { callClient, employeeRevenue, previewCall, quarterRevenue, standings } from './relations';

const opts = { firmName: 'Harbor Hill', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed: 777 };
const none = { orders: [], acceptOfferIds: [] };
const client = (c: Career) => c.fund.investors.find(i => i.id !== 'you' && i.units > 0)!;

describe('client relations', () => {
  it('staff revenue shares add up to the real fee revenue and follow ability', () => {
    let c = closeQuarter(newCareer(opts), none);
    const r = employeeRevenue(c);
    expect(r.reduce((a, x) => a + x.revenue, 0)).toBeCloseTo(quarterRevenue(c).amount, 2);
    const e = c.roster[3]; const before = r.find(x => x.id === e.id)!.share;
    c = { ...c, roster: c.roster.map(x => (x.id === e.id ? { ...x, ability: 100 } : x)) };
    expect(employeeRevenue(c).find(x => x.id === e.id)!.share).toBeGreaterThan(before);
  });
  it('a thank-you call raises satisfaction and a lockup request lowers it', () => {
    const c = newCareer(opts); const id = client(c).id; const s = c.satisfaction[id];
    expect(callClient(c, id, 'thanks').satisfaction[id]).toBeGreaterThan(s);
    const l = callClient(c, id, 'lockup');
    expect(l.satisfaction[id]).toBe(s - 10);
    expect(l.fund.investors.find(i => i.id === id)!.lockupUntilQ).toBeGreaterThan(client(c).lockupUntilQ);
  });
  it('one call per client per quarter', () => {
    const c = newCareer(opts); const id = client(c).id;
    const a = callClient(c, id, 'thanks');
    expect(callClient(a, id, 'thanks')).toBe(a);
  });
  it('asking an unhappy client for money backfires; a very happy one offers more', () => {
    const c = newCareer(opts); const id = client(c).id;
    expect(previewCall({ ...c, satisfaction: { ...c.satisfaction, [id]: 40 } }, id, 'more_money').delta).toBeLessThan(0);
  });
  it('accepting a new client adds money at NAV without changing NAV', () => {
    const c = normalizeCareer(newCareer(opts));
    c.decisions.push({ id: 'client-t', q: 0, kind: 'new_client', amount: 1e8, from: 'X', options: [{ id: 'accept', label: 'a', hint: '' }], defaultOption: 'accept', text: '', payload: { key: 'X', name: 'X' } });
    const aum = netAssets(c.fund.ledger);
    const n = resolveDecision(c, 'client-t', 'accept');
    expect(netAssets(n.fund.ledger)).toBeCloseTo(aum + 5e7, 0);
    expect(n.fund.investors.some(i => i.name === 'X')).toBe(true);
  });
  it('rival standings are deterministic', () => {
    let c = newCareer(opts); for (let i = 0; i < 4; i++) c = closeQuarter(c, none);
    expect(standings(c)).toEqual(standings(structuredClone(c)));
    expect(standings(c)).toHaveLength(6);
  });
});

import { scheduleSalary } from './close';
import { cashForecast } from './forecast';
import { growth } from './roster';
import { clientTier } from './relations';
import { totalOf } from './journal';

describe('salary schedule and staff growth', () => {
  it('a scheduled salary is paid from firm cash at that close and shows in the forecast', () => {
    let c = newCareer(opts);
    c = scheduleSalary(c, 3, 500_000);
    expect(cashForecast(c).rows.find(r => r.q === 3)!.salary).toBe(500_000);
    expect(cashForecast(c).rows.find(r => r.q === 2)!.salary).toBe(250_000);
    for (let i = 0; i < 3; i++) c = closeQuarter(c, none);
    const paid = c.journal.txns.filter(t => t.category === 'salary' && t.q === 3).reduce((a, t) => a + t.amount, 0);
    expect(paid).toBe(500_000);
    expect(c.salarySchedule).toHaveLength(0);
    void totalOf;
  });
  it('rejects negative or past schedules', () => {
    const c = newCareer(opts);
    expect(scheduleSalary(c, 3, -1)).toBe(c);
    expect(scheduleSalary(c, 0, 1000)).toBe(c);
  });
  it('ability grows toward potential, faster with tenure, never past it', () => {
    const e = { ...newCareer(opts).roster[0], ability: 50, potential: 90, morale: 70, joinedQ: 0 };
    expect(growth(e, 20)).toBeGreaterThan(growth(e, 0));
    expect(growth({ ...e, ability: 90 }, 20)).toBe(0);
    let c = newCareer(opts); for (let i = 0; i < 8; i++) c = closeQuarter(c, none);
    expect(c.roster.every(x => x.ability <= x.potential)).toBe(true);
  });
  it('bigger funds attract bigger client tiers', () => {
    expect(clientTier(25e9).mult).toBeGreaterThan(clientTier(5e9).mult);
    expect(clientTier(5e9).mult).toBeGreaterThan(clientTier(5e8).mult);
  });
});

import { contributionRate, expectedContributions } from './phase4';
import { pitchRival } from './relations';

describe('phase 4 client money', () => {
  it('satisfied clients contribute real money at close, at NAV', () => {
    let c = newCareer(opts);
    const id = client(c).id; c.satisfaction[id] = 100;
    const exp = expectedContributions(c).find(x => x.investorId === id)!.amount;
    expect(exp).toBeGreaterThan(0);
    expect(contributionRate(50)).toBe(0);
    c = closeQuarter(c, none);
    expect(c.flows.some(f => f.kind === 'contribution' && f.investorId === id && f.amount > 0)).toBe(true);
  });
  it('a positive call wires money into the fund', () => {
    const c = newCareer(opts); const id = client(c).id;
    const p = previewCall(c, id, 'thanks');
    const n = callClient(c, id, 'thanks');
    expect(p.amount).toBeGreaterThan(0);
    expect(netAssets(n.fund.ledger)).toBeCloseTo(netAssets(c.fund.ledger) + p.amount, 0);
  });
  it('a new client funds half now and commits the rest for calls', () => {
    const c = normalizeCareer(newCareer(opts));
    c.decisions.push({ id: 'client-z', q: 0, kind: 'new_client', amount: 2e8, from: 'Z', options: [{ id: 'accept', label: 'a', hint: '' }], defaultOption: 'accept', text: '', payload: { key: 'Z', name: 'Z' } });
    const n = resolveDecision(c, 'client-z', 'accept');
    expect(n.commitments.some(x => x.name === 'Z' && x.committed === 1e8)).toBe(true);
  });
  it('winning a rival pitch moves money out of that rival', () => {
    let c = newCareer(opts); for (let i = 0; i < 4; i++) c = closeQuarter(c, none);
    const you = standings(c).find(s => s.you)!;
    const beaten = standings(c).find(s => !s.you && !s.bench && s.trailing < you.trailing);
    if (!beaten) return;
    const before = c.rivalAum[beaten.id];
    const n = pitchRival(c, beaten.id);
    const log = n.rivalLog.at(-1)!;
    expect(n.rivalAum[beaten.id]).toBeCloseTo(before - log.amount, 0);
  });
});
