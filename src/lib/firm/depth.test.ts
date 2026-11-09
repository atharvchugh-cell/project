// Client capacity and meetings, negotiated deals with debt and operations, rival manager acquisition,
// constitution and partner politics, invalid inputs, old saves and practice isolation.
import { describe, expect, it } from 'vitest';
import { nav, netAssets } from '@/lib/fund/accounting';
import { SPX } from '@/lib/fund/engine';
import { listedCompanies } from '@/lib/fund/market';
import { currentYear } from '@/lib/fund/engine';
import { type Career, firmCash, founderCash, forkCareer, newCareer, parseCareer, reserveTarget } from './career';
import { closeQuarter, distribute, maxDistribution, resolveDecision } from './close';
import { post } from './journal';
import { addMoney, acceptsMoney } from './phase4';
import { callClient, pitchBlock, standings } from './relations';
import { allocatedOf, capacityOf, clientsAtClose, ensureProfiles, holdMeeting, meetingBlock, profileOf, quote, roomFor, termsOf } from './clients';
import { answerCounter, closeDeal, dealsOf, makeOffer, managerTargets, maxDebt, runDiligence } from './deals';
import { businessQuarter, closeBusiness, companyCash, prehistory, saleWaterfall, sellBusiness, setLever } from './business';
import { DEFAULT_CONSTITUTION, buyoutPartner, firmBuyback, governanceOf, proposeAmendment, tally } from './governance';
import { planDecision } from './plan';
import { acceptPartner, founderPct, partnerOffer, sellStake, valuation } from './exit';
import { LIFE_TEMPLATES, lifeOf, personalCash, resolveLifeEvent } from './life';
import { bridges } from './plan';

const opts = { firmName: 'Harbor Hill', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed: 3 };
const none = { orders: [], acceptOfferIds: [] };
const closeN = (c: Career, k: number) => { for (let i = 0; i < k; i++) c = closeQuarter(c, none); return c; };
const cash = (c: Career, amt: number, who: 'firm' | 'founder' = 'firm') => post(c.journal, { q: c.fund.q, date: 't', payer: 'external', recipient: who, category: 'capital_injection', amount: amt, source: `test:${c.journal.seq}`, memo: 'test' });
const outside = (c: Career) => c.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01).sort((a, b) => b.units - a.units)[0];
const record = (c: Career, ret: number, bench: number) => { c.fund.history = c.fund.history.map(h => ({ ...h, ret, bench })); return c; };

describe('client capacity', () => {
  it('existing investors get a profile that already covers what they hold (old saves never cut)', () => {
    const c = newCareer(opts); ensureProfiles(c);
    for (const i of c.fund.investors.filter(x => x.id !== 'you')) expect(capacityOf(c.clients![i.id])).toBeGreaterThanOrEqual(allocatedOf(c, i.id) - 1);
  });
  it('contributions and call bonuses are capped at the remaining room', () => {
    const c = newCareer(opts); ensureProfiles(c); const inv = outside(c); const p = c.clients![inv.id];
    p.wealth = (allocatedOf(c, inv.id) + 1e6) / p.maxShare;
    expect(roomFor(c, inv.id)).toBeCloseTo(1e6, -2);
    const added = addMoney(c, inv.id, 50e6, 'contribution');
    expect(added).toBeCloseTo(1e6, -2);
    expect(addMoney(c, inv.id, 5e6, 'call_bonus')).toBe(0);
  });
  it('an open top-up offer counts against room, so the same allocation cannot be offered or funded twice', () => {
    let c = closeN(newCareer(opts), 2); record(c, 0.05, 0);
    const inv = outside(c); c.satisfaction[inv.id] = 90;
    c = callClient(c, inv.id, 'more_money');
    const d = c.decisions.find(x => x.kind === 'top_up' && !x.resolved)!; expect(d).toBeDefined();
    expect(d.amount).toBeLessThanOrEqual(roomFor(c, inv.id, d.id) + 1);
    const roomWhileOpen = roomFor(c, inv.id);
    expect(roomWhileOpen).toBeCloseTo(roomFor(c, inv.id, d.id) - d.amount, -2);
    const before = netAssets(c.fund.ledger);
    const t = termsOf(d); expect(t.wireNow + t.commitLater).toBeCloseTo(d.amount, -2);
    c = resolveDecision(c, d.id, 'accept');
    expect(netAssets(c.fund.ledger) - before).toBeCloseTo(t.wireNow, -2);
    expect(c.commitments.find(x => x.id === `cm-${d.id}`)?.committed ?? 0).toBeCloseTo(t.commitLater, -2);
    expect(resolveDecision(c, d.id, 'accept')).toBe(c);
  });
  it('new client and rival offers never exceed the prospect capacity, and transfers balance', () => {
    let c = newCareer(opts); c = record(closeN(c, 6), 0.06, 0);
    for (let k = 0; k < 6; k++) c = closeQuarter(record(c, 0.06, 0), none);
    for (const d of c.decisions.filter(x => x.kind === 'new_client')) {
      const key = String(d.payload?.profile ?? ''); if (!key || !c.clients?.[key]) continue;
      expect(d.amount).toBeLessThanOrEqual(capacityOf(c.clients[key]) + 1);
    }
    for (const t of c.transfers.filter(x => x.direction === 'from_rival' && x.status !== 'pending')) expect((t.wired ?? 0) + (t.committed ?? 0) + (t.returned ?? 0)).toBeCloseTo(t.amount, 0);
  });
  it('strong net performance quotes far larger tickets than weak performance, and room shrinks after funding', () => {
    const c = closeN(newCareer(opts), 8); ensureProfiles(c); const inv = outside(c); const p = c.clients![inv.id];
    const strong = quote(record(structuredClone(c), 0.06, 0.0), p, 75).amount;
    const weak = quote(record(structuredClone(c), -0.03, 0.02), p, 75).amount;
    expect(strong).toBeGreaterThan(weak * 2);
    const n = record(structuredClone(c), 0.06, 0); const first = quote(n, p, 75);
    addMoney(n, inv.id, first.amount, 'top_up');
    expect(quote(n, n.clients![inv.id], 75).amount).toBeLessThan(first.amount);
  });
});

describe('meetings and reviews', () => {
  it('meetings use founder time and cooldowns, and cost firm cash', () => {
    let c = closeN(newCareer(opts), 1); const [a, b, d] = c.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01);
    const cash0 = firmCash(c);
    const r = holdMeeting(c, a.id, 'review'); expect(r.ok).toBe(true); c = r.c;
    expect(firmCash(c)).toBeLessThan(cash0);
    expect(meetingBlock(c, a.id, 'review')).toMatch(/Again in|Already met/);
    c = holdMeeting(c, b.id, 'review').c;
    if (d) expect(meetingBlock(c, d.id, 'review')).toBe('No time left this quarter');
    c = closeQuarter(c, none);
    expect(meetingBlock(c, a.id, 'review')).toMatch(/Again in/);
    expect(holdMeeting(c, a.id, 'nonsense' as never).ok).toBe(false);
  });
  it('a mandate review past patience redeems 25% through the fund liability after lockup, or gives notice while locked', () => {
    let c = closeN(newCareer(opts), 2); ensureProfiles(c);
    const inv = outside(c); const p = c.clients![inv.id]; p.patience = -1;
    inv.lockupUntilQ = 0; const units = inv.units; const liab = c.fund.ledger.liabilities.length;
    const n = structuredClone(c); clientsAtClose(n);
    expect(n.fund.investors.find(i => i.id === inv.id)!.units).toBeCloseTo(units * 0.75, 6);
    expect(n.fund.ledger.liabilities.length).toBe(liab + 1);
    const locked = structuredClone(c); locked.fund.investors.find(i => i.id === inv.id)!.lockupUntilQ = c.fund.q + 3; clientsAtClose(locked);
    expect(locked.fund.investors.find(i => i.id === inv.id)!.units).toBe(units);
    expect(locked.clients![inv.id].redeemAtQ).toBe(c.fund.q + 3);
  });
  it('an allocation meeting with a strong record creates a capped top-up offer that funds once at NAV', () => {
    let c = record(closeN(newCareer(opts), 4), 0.06, 0); const inv = outside(c); c.satisfaction[inv.id] = 80;
    const r = holdMeeting(c, inv.id, 'allocation'); expect(r.outcome).toBe('accepted'); c = r.c;
    const d = c.decisions.find(x => x.kind === 'top_up' && !x.resolved)!;
    expect(d.amount).toBeLessThanOrEqual(roomFor(c, inv.id, d.id) + 1);
    const t = termsOf(d); const before = netAssets(c.fund.ledger); c = resolveDecision(c, d.id, 'accept');
    expect(netAssets(c.fund.ledger) - before).toBeCloseTo(t.wireNow, -2);
    expect(c.flows.filter(f => f.kind === 'top_up').length).toBe(1);
    expect(holdMeeting(c, inv.id, 'allocation').ok).toBe(false);
  });
  it('a promise is checked a year later', () => {
    let c = closeN(newCareer(opts), 1); const inv = outside(c);
    c = holdMeeting(c, inv.id, 'promise').c; expect(profileOf(c, inv.id).promise).toBeDefined();
    c = closeN(c, 4); expect(profileOf(c, inv.id).promise).toBeUndefined();
    expect(profileOf(c, inv.id).history.some(h => /Promise (kept|broken)/.test(h.text))).toBe(true);
  });
});

const withTarget = (seed = 3) => { const c = closeN(newCareer({ ...opts, seed }), 4); cash(c, 500e6); return c; };

describe('negotiated business deals', () => {
  it('rejects bad input, rejects lowballs, and closes once only after diligence', () => {
    const c = withTarget(); const t = c.targets[0]; expect(t).toBeDefined();
    for (const bad of [NaN, -1, 0, Infinity]) expect(makeOffer(c, t.id, bad).ok).toBe(false);
    const low = makeOffer(c, t.id, t.price * 0.4); expect(['rejected', 'lost']).toContain(dealsOf(low.c)[0].stage);
    const r = makeOffer(c, t.id, t.price); const d = dealsOf(r.c)[0]; expect(d.stage).toBe('agreed');
    expect(makeOffer(r.c, t.id, t.price).ok).toBe(false);
    expect(closeDeal(r.c, d.id, 0).ok).toBe(false);
    const cash0 = firmCash(r.c);
    const dd = runDiligence(r.c, d.id); expect(dd.ok).toBe(true);
    expect(cash0 - firmCash(dd.c)).toBeCloseTo(dealsOf(dd.c)[0].diligenceCost!, 0);
    expect(runDiligence(dd.c, d.id).ok).toBe(false);
    for (const bad of [NaN, -5, maxDebt(dd.c, d) + 1e6]) expect(closeDeal(dd.c, d.id, bad).ok).toBe(false);
    const done = closeDeal(dd.c, d.id, 0); expect(done.ok).toBe(true);
    expect(closeDeal(done.c, d.id, 0).ok).toBe(false);
    expect(done.c.journal.txns.filter(x => x.category === 'acquisition').length).toBe(1);
    expect(done.c.subsidiaries.length).toBe(1);
  });
  it('a counter can be accepted; an unanswered agreement expires without any payment', () => {
    const c = withTarget(); const t = c.targets[0];
    const r = makeOffer(c, t.id, t.price * 0.8); const d = dealsOf(r.c)[0];
    if (d.stage === 'countered') { const a = answerCounter(r.c, d.id, 'accept'); expect(dealsOf(a.c)[0].stage).toBe('agreed'); }
    const ag = makeOffer(c, t.id, t.price).c; const later = closeN(ag, 3);
    expect(dealsOf(later)[0].stage).toBe('expired');
    expect(later.journal.txns.some(x => x.category === 'acquisition')).toBe(false);
  });
  const owned = (debt = true) => { const c = withTarget(); const t = c.targets[0]; let n = makeOffer(c, t.id, t.price).c; const d = dealsOf(n)[0]; n = runDiligence(n, d.id).c; const loan = debt ? maxDebt(n, dealsOf(n)[0]) : 0; return { c: closeDeal(n, d.id, loan).c, loan }; };
  it('a loan funds part of the price, then interest and amortization are paid from the ledger', () => {
    const { c, loan } = owned(); expect(loan).toBeGreaterThan(0);
    expect(c.journal.txns.find(x => x.category === 'loan_draw')!.amount).toBeCloseTo(loan, 0);
    const s = c.subsidiaries[0]; const exp = businessQuarter(s, c.fund.q + 1);
    const n = closeQuarter(c, none); const s2 = n.subsidiaries[0];
    const interest = n.journal.txns.filter(x => x.category === 'debt_interest' && x.closeId?.endsWith(`Q${n.fund.q}`)).reduce((a, x) => a + x.amount, 0) + n.payables.filter(p => p.category === 'debt_interest').reduce((a, p) => a + p.amount, 0);
    expect(interest).toBeCloseTo(exp.interest, 0);
    expect(s2.loan!.balance).toBeCloseTo(loan - exp.principal, 0);
    expect(bridges(n, 'firm').every(b => b.reconciles)).toBe(true);
  });
  it('covenant breaches add default interest, then the lender forecloses with no proceeds', () => {
    let { c } = owned(); c.subsidiaries[0].costQ = c.subsidiaries[0].revenueQ * 1.2;
    c = closeN(c, 2); if (c.subsidiaries[0]) expect(c.subsidiaries[0].loan!.penalty).toBeGreaterThan(0);
    c = closeN(c, 3);
    expect(c.subsidiaries.length).toBe(0);
    expect(c.formerBusinesses![0].how).toBe('foreclosed'); expect(c.formerBusinesses![0].proceeds).toBe(0);
  });
  it('sale waterfall: price + company cash − loan − costs reaches the firm, and a sold business cannot be sold again', () => {
    let { c } = owned(); c = closeN(c, 3); const s = c.subsidiaries[0]; if (!s) return;
    const w = saleWaterfall(c, s); const before = firmCash(c);
    const r = sellBusiness(c, s.id); expect(r.ok).toBe(true);
    expect(firmCash(r.c) - before).toBeCloseTo(Math.min(w.equity, w.equity), -1);
    expect(sellBusiness(r.c, s.id).ok).toBe(false);
    expect(r.c.formerBusinesses!.at(-1)!.history.length).toBeGreaterThanOrEqual(8);
  });
  it('closing a business with a loan pays the debt: negative equity is never free', () => {
    let { c } = owned(); c = closeN(c, 1); const s = c.subsidiaries[0];
    const before = firmCash(c) - c.arrears; const r = closeBusiness(c, s.id);
    expect(firmCash(r.c) - r.c.arrears).toBeLessThan(before);
  });
  it('retained cash stays in the business: operating profit is not all distributable, and statements match the ledger', () => {
    let { c } = owned(false); c = closeN(c, 3);
    const s = c.subsidiaries[0]; c = setLever(c, s.id, 'retain', 0.5).c;
    expect(setLever(c, s.id, 'retain', 0.33).ok).toBe(false);
    c = closeQuarter(c, none); const st = c.subsidiaries[0].history!.at(-1)!;
    expect(st.simulated).toBe(false); expect(st.retained).toBeGreaterThan(0);
    expect(st.toFirm).toBeLessThan(st.ebitda);
    expect(companyCash(c, s.id)).toBeGreaterThan(0);
    const rev = c.journal.txns.filter(x => x.category === 'subsidiary_revenue' && x.closeId?.endsWith(`Q${c.fund.q}`)).reduce((a, x) => a + x.amount, 0);
    expect(st.revenue).toBeCloseTo(rev, 0);
  });
  it('pre-acquisition history is deterministic, eight simulated quarters', () => {
    const a = prehistory('x1', 'admin', 2e6, 1.4e6, 8); const b = prehistory('x1', 'admin', 2e6, 1.4e6, 8);
    expect(a).toEqual(b); expect(a.length).toBe(8); expect(a.every(x => x.simulated)).toBe(true);
  });
  it('a pricing change is delayed and the same projection drives the close', () => {
    let { c } = owned(false); c = closeN(c, 3); const s = c.subsidiaries[0];
    c = setLever(c, s.id, 'price', 1).c; expect(setLever(c, s.id, 'price', 0).ok).toBe(false);
    const before = businessQuarter(s, c.fund.q + 1).revenue; const after = businessQuarter(c.subsidiaries[0], c.fund.q + 1).revenue;
    expect(after).toBeGreaterThan(before);
  });
});

describe('rival manager acquisition', () => {
  it('moves only consenting client money into the fund at NAV, pays the firm-cash price, and removes the rival', () => {
    const c = closeN(newCareer(opts), 4); cash(c, 2e9);
    const mt = managerTargets(c)[0]; const aum = c.rivalAum[mt.rivalId];
    let n = makeOffer(c, mt.id, mt.price).c; const d = dealsOf(n)[0]; expect(d.stage).toBe('agreed');
    n = runDiligence(n, d.id).c; const consent = dealsOf(n)[0].findings!.find(f => f.consent !== undefined)!.consent!;
    expect(maxDebt(n, dealsOf(n)[0])).toBeGreaterThan(0);
    const me = founderCash(n); const na = netAssets(n.fund.ledger); const firm = firmCash(n); const p = nav(n.fund.ledger);
    const r = closeDeal(n, d.id, 0); expect(r.ok).toBe(true);
    expect(founderCash(r.c)).toBe(me);
    expect(netAssets(r.c.fund.ledger) - na).toBeCloseTo(Math.round(aum * consent / 1e4) * 1e4, -3);
    expect(nav(r.c.fund.ledger)).toBeCloseTo(p, 9);
    expect(firm - firmCash(r.c)).toBeGreaterThanOrEqual(mt.price - 1);
    expect(r.c.rivalAum[mt.rivalId]).toBe(0);
    expect(standings(r.c).some(s => s.id === mt.rivalId)).toBe(false);
    expect(pitchBlock(r.c, mt.rivalId)).toBe('Now part of your firm');
    expect(managerTargets(r.c).some(x => x.rivalId === mt.rivalId)).toBe(false);
    const later = closeQuarter(r.c, none); expect(later.rivalAum[mt.rivalId]).toBe(0);
  });
});

describe('constitution and partners', () => {
  it('a passed position limit trims buy orders, never forces sells', () => {
    let c = newCareer(opts); const p = proposeAmendment(c, 'maxPosition', 0.2); expect(p.ok).toBe(true);
    expect(proposeAmendment(p.c, 'reserveQuarters', 4).ok).toBe(false);
    expect(proposeAmendment(c, 'maxPosition', 0.33).ok).toBe(false);
    c = closeQuarter(p.c, none); expect(governanceOf(c).constitution.maxPosition).toBe(0.2);
    const t = listedCompanies(currentYear(c.fund)).find(x => x.ticker !== SPX)!.ticker;
    c.plan.orders = [{ ticker: t, amount: netAssets(c.fund.ledger) * 0.5 }];
    const o = planDecision(c).orders.find(x => x.ticker === t)!;
    expect((c.fund.ledger.positions[t] ?? 0) + o.amount).toBeLessThanOrEqual(netAssets(c.fund.ledger) * 0.2 + 1);
  });
  it('reserve and payout rules change what can be distributed', () => {
    const c = closeN(newCareer(opts), 2); const base = maxDistribution(c);
    const r6 = structuredClone(c); r6.governance = { ...governanceOf(c), constitution: { ...DEFAULT_CONSTITUTION, reserveQuarters: 6 } };
    expect(reserveTarget(r6)).toBeCloseTo(reserveTarget(c) * 2, 0); expect(maxDistribution(r6)).toBeLessThan(base);
    const half = structuredClone(c); half.governance = { ...governanceOf(c), constitution: { ...DEFAULT_CONSTITUTION, payoutShare: 0.5 } };
    expect(maxDistribution(half)).toBeCloseTo(base * 0.5, 0);
  });
  const partnered = () => { let c = closeN(newCareer(opts), 5); cash(c, 50e6); if (!partnerOffer(c)) c = closeN(c, 4); const r = acceptPartner(c); expect(r.ok).toBe(true); return r.c; };
  it('a buy-in dilutes every holder, the cap table sums to 100%, and distributions split pro rata', () => {
    const c = partnered(); const h = c.ownership!.holders;
    expect(h.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(1, 9);
    const you = founderPct(c); const me = founderCash(c); const amt = maxDistribution(c) / 2;
    const d = distribute(c, amt);
    expect(founderCash(d) - me).toBeCloseTo(amt * you, 0);
    expect(d.journal.txns.filter(x => x.category === 'partner_distribution').reduce((a, x) => a + x.amount, 0)).toBeCloseTo(amt * (1 - you), 0);
  });
  it('votes are weighted by ownership; a hostile partner can block a supermajority rule', () => {
    const c = partnered(); const pid = c.ownership!.holders.find(x => x.id.startsWith('partner-'))!.id;
    c.governance = { ...governanceOf(c), constitution: { ...DEFAULT_CONSTITUTION, majority: 0.99 }, partners: { [pid]: { morale: 20, loyalty: 10, lastMetQ: -9 } } };
    const v = tally(c, { kind: 'amend', rule: 'payoutShare', to: 0.5 });
    expect(v.votes.reduce((a, x) => a + x.weight, 0)).toBeCloseTo(1, 9);
    expect(v.yes).toBeCloseTo(founderPct(c), 9); expect(v.passed).toBe(false);
    expect(sellStake(c, 1).ok).toBe(false);
  });
  it('a personal buyout pays the partner from your cash and moves equity; a firm buyback pays from firm cash and cancels shares', () => {
    const c = partnered(); const pid = c.ownership!.holders.find(x => x.id.startsWith('partner-'))!.id; const v = valuation(c).total;
    cash(c, 500e6, 'founder');
    const firm = firmCash(c); const b = buyoutPartner(c, pid, v); expect(b.ok).toBe(true);
    expect(firmCash(b.c)).toBe(firm); expect(founderPct(b.c)).toBeCloseTo(1, 9);
    expect(personalCash(c) - personalCash(b.c)).toBeGreaterThan(0);
    cash(c, 500e6);
    const fb = firmBuyback(c, pid, v, maxDistribution(c)); expect(fb.ok).toBe(true);
    expect(fb.c.ownership!.holders.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(1, 9);
    expect(firmCash(c) - firmCash(fb.c)).toBeGreaterThan(0);
    expect(buyoutPartner(b.c, pid, v).ok).toBe(false);
  });
});

describe('life events, saves and branches', () => {
  it('a life event resolves once with its real consequence', () => {
    const c = closeN(newCareer(opts), 1); const L = lifeOf(c); c.life = L;
    const tpl = LIFE_TEMPLATES.find(t => t.id === 'parent_health')!;
    L.events.push({ id: 'ev-test', q: c.fund.q, template: tpl.id, ...tpl.make(c, () => 0.5) });
    const me = personalCash(c); const n = resolveLifeEvent(c, 'ev-test', 'help');
    expect(me - personalCash(n)).toBeCloseTo(60e3, 0);
    expect(resolveLifeEvent(n, 'ev-test', 'help')).toBe(n);
  });
  it('an older save without the new fields loads, keeps balances and units, and closes', () => {
    const c = closeN(newCareer(opts), 3);
    const raw = JSON.parse(JSON.stringify(c)); delete raw.clients; delete raw.deals; delete raw.governance; delete raw.formerBusinesses; delete raw.acquiredRivals;
    const back = parseCareer(JSON.stringify(raw))!;
    expect(firmCash(back)).toBeCloseTo(firmCash(c), 6); expect(netAssets(back.fund.ledger)).toBeCloseTo(netAssets(c.fund.ledger), 6);
    expect(governanceOf(back).constitution).toEqual(DEFAULT_CONSTITUTION);
    const next = closeQuarter(back, none); expect(next.fund.q).toBe(4); expect(acceptsMoney(next)).toBe(true);
  });
  it('practice deals and meetings never touch the live career', () => {
    const c = withTarget(); const t = c.targets[0]; const fork = forkCareer(c);
    makeOffer(fork, t.id, t.price); holdMeeting(fork, outside(fork).id, 'review');
    expect(dealsOf(c).length).toBe(0); expect(profileOf(c, outside(c).id).history.length).toBe(0);
  });
});
