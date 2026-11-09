import { describe, expect, it } from 'vitest';
import { nav, netAssets } from '@/lib/fund/accounting';
import { type Career, firmCash, newCareer, parseCareer } from './career';
import { closeQuarter, resolveDecision } from './close';
import { applyPhase5, phase5AtClose } from './phase5';
import { standings, yourRank } from './relations';

const opts = { firmName: 'Harbor Hill', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed: 3 };
const none = { orders: [], acceptOfferIds: [] };
const closeN = (c: Career, k: number) => { for (let i = 0; i < k; i++) c = closeQuarter(c, none); return c; };
const always = () => 0;

/** A career six quarters in whose fund lagged every rival over the trailing year. */
function lagging(): Career {
  const c = structuredClone(closeN(newCareer(opts), 6));
  c.fund.history = c.fund.history.map(h => ({ ...h, ret: -0.06, bench: 0.02 }));
  c.decisions = c.decisions.map(d => ({ ...d, resolved: d.resolved ?? 'test' }));
  // Replay the hook with deliberately replaced completed history, not an already published edition.
  c.press = c.press.filter(e => e.q !== c.fund.q);
  return c;
}

describe('newspaper', () => {
  it('prints one edition per close whose return and rank match the fund history and rival table', () => {
    const c = closeN(newCareer(opts), 5);
    expect(c.press.map(e => e.q)).toEqual([1, 2, 3, 4, 5]);
    const ed = c.press.at(-1)!; const h = c.fund.history.at(-1)!;
    expect(ed.ret).toBe(h.ret);
    expect(ed.bench).toBe(h.bench);
    expect(ed.rank).toBe(yourRank(c));
    expect(ed.leader).toBe(standings(c).find(s => !s.bench)!.name);
  });
  it('does not change fund NAV or assets', () => {
    const c = lagging(); const before = [nav(c.fund.ledger), netAssets(c.fund.ledger)];
    phase5AtClose(c, () => 0.99);
    expect([nav(c.fund.ledger), netAssets(c.fund.ledger)]).toEqual(before);
  });
});

describe('activists', () => {
  it('a fund ranked near last after four quarters gets an activist campaign from its largest outside investor', () => {
    const c = lagging(); phase5AtClose(c, always);
    const d = c.decisions.find(x => x.kind === 'activist' && !x.resolved)!;
    const largest = c.fund.investors.filter(i => i.id !== 'you').sort((a, b) => b.units - a.units)[0];
    expect(d.payload?.investorId).toBe(largest.id);
    expect(c.activistQ).toBe(c.fund.q);
  });
  it('no second campaign inside the six-quarter cooldown', () => {
    const c = lagging(); phase5AtClose(c, always);
    c.decisions = c.decisions.map(d => ({ ...d, resolved: 'test' }));
    phase5AtClose(c, always);
    expect(c.decisions.filter(d => d.kind === 'activist').length).toBe(1);
  });
  it('returning 25% redeems exactly a quarter of their units at NAV, payable next quarter', () => {
    const c = lagging(); phase5AtClose(c, always);
    const d = c.decisions.find(x => x.kind === 'activist' && !x.resolved)!;
    const inv = c.fund.investors.find(i => i.id === d.payload!.investorId)!; const units = inv.units; const p = nav(c.fund.ledger);
    const n = resolveDecision(c, d.id, 'return');
    expect(n.fund.investors.find(i => i.id === inv.id)!.units).toBeCloseTo(units * 0.75, 6);
    const liab = n.fund.ledger.liabilities.find(l => l.kind === 'redemption' && l.investorId === inv.id && !l.paid)!;
    expect(liab.amount).toBeCloseTo(units * 0.25 * p, 2);
    expect(liab.dueQ).toBe(c.fund.q + 1);
    expect(nav(n.fund.ledger)).toBeCloseTo(p, 8);
  });
  it('cost cuts lower office 10% and founder salary 25% without touching the fund', () => {
    const c = lagging(); phase5AtClose(c, always);
    const d = c.decisions.find(x => x.kind === 'activist' && !x.resolved)!;
    const n = resolveDecision(c, d.id, 'cuts');
    expect(n.officeQ).toBe(Math.round(c.officeQ * 0.9));
    expect(n.founderSalaryQ).toBe(Math.round(c.founderSalaryQ * 0.75 / 1000) * 1000);
    expect(netAssets(n.fund.ledger)).toBe(netAssets(c.fund.ledger));
  });
  it('losing a fight costs legal fees and redeems 40%', () => {
    const c = lagging(); phase5AtClose(c, always);
    const d = c.decisions.find(x => x.kind === 'activist' && !x.resolved)!; d.payload!.win = 0;
    const inv = c.fund.investors.find(i => i.id === d.payload!.investorId)!; const units = inv.units; const cash = firmCash(c);
    const n = resolveDecision(c, d.id, 'fight');
    expect(n.fund.investors.find(i => i.id === inv.id)!.units).toBeCloseTo(units * 0.6, 6);
    expect(cash - firmCash(n) + n.arrears - c.arrears).toBeCloseTo(Number(d.payload!.legal), 2);
  });
});

describe('crises', () => {
  it('a real S&P 500 quarter at -8% or worse opens a market crisis; staying quiet cuts satisfaction by 8', () => {
    const c = lagging(); c.fund.history.at(-1)!.bench = -0.12;
    phase5AtClose(c, () => 0.99);
    const d = c.decisions.find(x => x.kind === 'crisis' && !x.resolved)!;
    expect(d.payload?.key).toBe('market');
    const id = Object.keys(c.satisfaction)[0]; const s = c.satisfaction[id];
    const n = resolveDecision(c, d.id, 'quiet');
    expect(n.satisfaction[id]).toBe(Math.max(0, s - 8));
  });
  it('ended careers get no new crises or activists', () => {
    const c = lagging(); c.status = 'ended'; c.fund.history.at(-1)!.bench = -0.2;
    phase5AtClose(c, always);
    expect(c.decisions.some(d => !d.resolved && (d.kind === 'crisis' || d.kind === 'activist'))).toBe(false);
  });
  it('applyPhase5 ignores other decision kinds', () => {
    const c = lagging();
    expect(applyPhase5(c, { id: 'x', q: 1, kind: 'event', amount: 0, text: '' }, 'x')).toBe(false);
  });
});

describe('older saves', () => {
  it('a save without Phase 5 fields loads with an empty newspaper and closes normally', () => {
    const c = closeN(newCareer(opts), 2) as Partial<Career>;
    delete c.press; delete c.activistQ;
    const loaded = parseCareer(JSON.stringify(c))!;
    expect(loaded.press).toEqual([]);
    expect(closeQuarter(loaded, none).press.length).toBe(1);
  });
});

describe('quarter close with no staff', () => {
  it('closes quarters after every employee has left', () => {
    let c = closeN(newCareer(opts), 2); c = { ...c, roster: [] };
    const n = closeN(c, 6);
    expect(n.fund.q).toBe(8);
  });
});

describe('quarter close never silently does nothing', () => {
  it('a save with the next close id marked but the quarter not played still closes', () => {
    const c = closeN(newCareer(opts), 2);
    c.journal.closed.push(`${c.id}:Q3`);
    expect(closeQuarter(c, none).fund.q).toBe(3);
  });
  it('a fund that already ended moves the career to ended', () => {
    const c = closeN(newCareer(opts), 2); c.fund.status = 'ended';
    expect(closeQuarter(c, none).status).toBe('ended');
  });
});
