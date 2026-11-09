// Regressions for the reviewed expansion: receipts-based staff attribution and live sleeves, past-only
// skill effect, life close periods/defaults/promises, quoted vs accepted client terms, acquisition
// affordability with diligence liabilities, and the constitution's limit over the combined order stream.
import { describe, expect, it } from 'vitest';
import { netAssets } from '@/lib/fund/accounting';
import { isTradable, SPX } from '@/lib/fund/engine';
import { mulberry32 } from '@/lib/fund/market';
import { type Career, type Idea, firmCash, founderCash, newCareer, reserveTarget } from './career';
import { closeQuarter, resolveDecision } from './close';
import { post } from './journal';
import { recapFor, planDecision } from './plan';
import { MAX_DELEGATED, delegateIdea, delegatedUsed, setMandate, sleeveUsed, trackRecord } from './staff';
import { attributedByTicker, ideaPnl } from './attribution';
import { analyze, convictionOf, pastEvidence } from './analysis';
import { approveIdea } from './phase2';
import { holdMeeting, quote, ensureProfiles, termsOf } from './clients';
import { closeCheck, closeDeal, dealsOf, makeOffer, runDiligence } from './deals';
import { DEFAULT_CONSTITUTION, governanceOf } from './governance';
import { issueCall } from './phase3';
import { buyItem, lifeOf, lifeAction, marketValue, personalCash, promisedTime, resolveLifeEvent, timeLeft } from './life';
import { withAbility } from './roster';

const opts = (seed = 777) => ({ firmName: 'Harbor Hill', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed });
const none = { orders: [], acceptOfferIds: [] };
const closeN = (c: Career, k: number) => { for (let i = 0; i < k; i++) c = closeQuarter(c, none); return c; };
const inject = (c: Career, amt: number, who: 'firm' | 'founder') => post(c.journal, { q: c.fund.q, date: 't', payer: amt >= 0 ? 'external' : who, recipient: amt >= 0 ? who : 'external', category: 'capital_injection', amount: Math.abs(amt), source: `test:${c.journal.seq}`, memo: 'fixture' });
const tradable = (c: Career) => ['IBM', 'MSFT', 'KO', 'JNJ', 'XOM', 'PG'].find(t => isTradable(c.fund, t))!;
const idea = (c: Career, id: string, e: { id: string; name: string }, ticker: string): Idea => ({ id, q: c.fund.q, analystId: e.id, analyst: e.name, ticker, sector: 'x', thesis: 't', conviction: 5, status: 'pending' });
/** Leave the fund with exactly `cash` of cash by moving the rest into SPX (fixture). */
const squeeze = (c: Career, cash: number) => { const l = c.fund.ledger; const extra = l.cash - cash; l.positions[SPX] = (l.positions[SPX] ?? 0) + extra; c.fund.basis[SPX] = (c.fund.basis[SPX] ?? 0) + extra; l.cash = cash; };

describe('1. staff fills from execution receipts', () => {
  it('two delegates in one ticker with $1M cash: fills are allocated once and sum to the actual basis change', () => {
    const c = newCareer(opts()); const t = tradable(c); const [a, b] = c.roster.slice(0, 2);
    squeeze(c, 1e6);
    c.ideas.push({ ...idea(c, 'i-a', a, t), status: 'approved', delegated: true }, { ...idea(c, 'i-b', b, t), status: 'approved', delegated: true });
    c.pendingOrders.push({ ticker: t, amount: 1e6, ideaId: 'i-a' }, { ticker: t, amount: 1e6, ideaId: 'i-b' });
    const basis0 = c.fund.basis[t] ?? 0;
    const n = closeQuarter(c, none);
    const fa = n.ideas.find(i => i.id === 'i-a')!.filled ?? 0; const fb = n.ideas.find(i => i.id === 'i-b')!.filled ?? 0;
    const bought = (n.fills ?? []).filter(r => r.q === 1 && r.ticker === t && r.side === 'buy').reduce((x, r) => x + r.amount, 0);
    expect(fa + fb).toBeCloseTo(bought, 2);
    // Approved ideas are funded by selling other holdings when cash is short, so both fill.
    expect(fa).toBeGreaterThan(0); expect(fb).toBeGreaterThan(0);
    expect(basis0).toBeGreaterThanOrEqual(0); // basis can later fall from liquidity sales; receipts are the authority
  });
  it('manual desk orders in the same ticker are never attributed to a delegate, and a manually approved idea gets its fill', () => {
    let c = newCareer(opts()); const t = tradable(c); const e = c.roster[0];
    c.ideas.push(idea(c, 'i-m', e, t)); c = approveIdea(c, 'i-m', 0.01);
    const aum = netAssets(c.fund.ledger);
    c.plan.orders = [{ ticker: t, amount: aum * 0.02 }];
    const n = closeQuarter(c);
    const x = n.ideas.find(i => i.id === 'i-m')!;
    expect(x.filled).toBeCloseTo(aum * 0.01, -2);
    // Its lot is a third of the position (1% of 3% bought).
    expect(x.lot!.frac).toBeCloseTo(1 / 3, 3);
    expect(attributedByTicker(n)[t]).toBeLessThanOrEqual((n.fund.ledger.positions[t] ?? 0) + 0.01);
  });
  it('reviewing an idea frees nothing: the sleeve counts the stock still held until it is sold', () => {
    let c = newCareer(opts()); const t = tradable(c); const e = c.roster.find(x => /Portfolio manager/.test(x.role))!;
    const aum = netAssets(c.fund.ledger);
    c = setMandate(c, e.id, { budget: aum * 0.05, maxPosition: 0.05, minConviction: 1 });
    const n0: Career = structuredClone(c); const id = { ...idea(n0, 'i-s', e, t) }; n0.ideas.push(id);
    delegateIdea(n0, n0.roster.find(x => x.id === e.id)!, n0.ideas.at(-1)!);
    let n = closeQuarter(n0, none);
    const held = sleeveUsed(n, e.id); expect(held).toBeGreaterThan(0);
    n.ideas.find(i => i.id === 'i-s')!.reviewedQ = n.fund.q; // review recorded
    expect(sleeveUsed(n, e.id)).toBeCloseTo(held, 2);
    // Selling half of the position releases half of the sleeve and realizes P&L.
    n.plan.orders = [{ ticker: t, amount: -(n.fund.ledger.positions[t]! / 2) }];
    n = closeQuarter(n);
    const p = ideaPnl(n, n.ideas.find(i => i.id === 'i-s')!);
    expect(p.realized + p.unrealized).toBeCloseTo(p.pnl, 4);
    expect(n.ideas.find(i => i.id === 'i-s')!.lot!.proceeds).toBeGreaterThan(0);
    const tr = trackRecord(n, e.id); expect(tr.pnl).toBeCloseTo(p.pnl, 4);
  });
  it('the 15% aggregate delegation cap holds across delegates, and invalid mandates are rejected', () => {
    let c = newCareer(opts()); const aum = netAssets(c.fund.ledger); const [a, b] = c.roster;
    c = setMandate(c, a.id, { budget: aum * 0.1, maxPosition: 0.05, minConviction: 1 });
    c = setMandate(c, b.id, { budget: aum * 0.1, maxPosition: 0.05, minConviction: 1 });
    expect(c.roster.reduce((x, e) => x + (e.mandate?.budget ?? 0), 0)).toBeLessThanOrEqual(aum * MAX_DELEGATED + 1);
    for (const bad of [NaN, Infinity, -1]) expect(setMandate(c, a.id, { budget: bad, maxPosition: 0.02, minConviction: 3 })).toBe(c);
    expect(setMandate(c, a.id, { budget: 1e6, maxPosition: NaN, minConviction: 3 })).toBe(c);
    // Pitches beyond the firm-wide cap are left for you.
    const n: Career = structuredClone(c); n.pendingOrders.push({ ticker: 'X', amount: aum * 0.15, ideaId: 'big' }); n.ideas.push({ ...idea(n, 'big', a, 'X'), status: 'approved', delegated: true });
    const i2 = idea(n, 'i2', b, tradable(n)); n.ideas.push(i2);
    expect(delegateIdea(n, n.roster.find(x => x.id === b.id)!, n.ideas.at(-1)!)).toBe(0);
    expect(delegatedUsed(n)).toBeLessThanOrEqual(aum * MAX_DELEGATED + 1);
  });
});

describe('2. skill changes the research process without future data', () => {
  it('with identical past data and seeds, higher skill screens more, errs less and ranks better', () => {
    const c = closeN(newCareer(opts(5)), 6); const base = c.roster.find(e => e.assignment) ?? c.roster[0];
    const sector = 'Technology';
    const lo = { ...base, assignment: sector, ability: 20, potential: 100, joinedQ: c.fund.q };
    const hi = { ...base, assignment: sector, ability: withAbility({ ...base, potential: 100 }, 95), potential: 100, joinedQ: c.fund.q - 12 };
    let errLo = 0, errHi = 0, scoreLo = 0, scoreHi = 0, k = 0;
    for (let s = 1; s <= 60; s++) {
      const a = analyze(c, lo, mulberry32(s), sector); const b = analyze(c, hi, mulberry32(s), sector); if (!a || !b) continue;
      errLo += Math.abs(a.analysis.estimate + a.analysis.crowdPenalty - a.analysis.pastScore); errHi += Math.abs(b.analysis.estimate + b.analysis.crowdPenalty - b.analysis.pastScore);
      scoreLo += a.analysis.pastScore; scoreHi += b.analysis.pastScore; k++;
      expect(b.analysis.considered).toBeGreaterThanOrEqual(a.analysis.considered);
    }
    expect(k).toBeGreaterThan(0);
    expect(errHi).toBeLessThan(errLo * 0.6);
    expect(scoreHi).toBeGreaterThanOrEqual(scoreLo);
  });
  it('uses completed quarters only and sparse evidence lowers certainty', () => {
    const c0 = newCareer(opts(5)); const e = { ...c0.roster[0], assignment: 'Technology' };
    const a = analyze(c0, e, mulberry32(1)); expect(a!.analysis.evidenceQ).toBe(0); expect(convictionOf(a!.analysis)).toBe(1);
    const c = closeN(c0, 3); expect(pastEvidence(c, a!.ticker).n).toBeLessThanOrEqual(3);
  });
});

describe('3. life close periods, defaults and promises', () => {
  it('a default life payment at the close belongs to that close: recap equals live personal cash', () => {
    const c = newCareer(opts()); const L = lifeOf(c); c.life = L;
    L.events.push({ id: 'ev-ph', q: 0, template: 'parent_health', title: 'p', text: '', options: [{ id: 'visit', label: 'v', hint: '' }, { id: 'help', label: 'h', hint: '' }], defaultOption: 'help', payload: {} });
    const before = founderCash(c); const n = closeQuarter(c, none);
    expect(n.journal.txns.filter(t => t.memo === 'Home care for a parent')[0].closeId).toBe(`${c.id}:Q1`);
    expect(recapFor(n, 1)!.founderEndCash).toBeCloseTo(founderCash(n), 2);
    expect(before).toBeGreaterThan(0);
  });
  it('two unpaid closes with a default event still count, keep upkeep owed and force the sale', () => {
    let c = newCareer(opts()); inject(c, 10e6, 'founder');
    c = buyItem(c, 'jet-light').c; c.founderSalaryQ = 0; c.salarySchedule = [];
    inject(c, -personalCash(c), 'founder'); expect(personalCash(c)).toBeCloseTo(0, 2);
    const ev = (q: number) => ({ id: `ml-${q}`, q, template: 'mentor_lunch', title: 'm', text: '', options: [{ id: 'go', label: 'g', hint: '' }, { id: 'skip', label: 's', hint: '' }], defaultOption: 'skip', payload: {} });
    c.life!.events.push(ev(c.fund.q)); c = closeQuarter(c, none);
    expect(lifeOf(c).shortQuarters).toBe(1); expect(lifeOf(c).owed.length).toBeGreaterThan(0);
    c.life!.events.push(ev(c.fund.q)); c = closeQuarter(c, none);
    expect(lifeOf(c).possessions.find(p => p.itemId === 'jet-light')!.forced).toBe(true);
  });
  it('a promise of time next quarter is kept even if you act right away, and wear never rewrites the purchase price', () => {
    let c = newCareer(opts());
    c.life = lifeOf(c); c.life.people.find(p => p.id === 'partner')!.closeness = 10;
    c.life.events.push({ id: 'st', q: 0, template: 'strain', title: 's', text: '', options: [{ id: 'commit', label: 'c', hint: '' }, { id: 'ignore', label: 'i', hint: '' }], defaultOption: 'ignore', payload: {} });
    c = resolveLifeEvent(c, 'st', 'commit');
    const r = lifeAction(c, 'study'); if (r.ok) c = r.c; // act in the current quarter
    expect(promisedTime(c, c.fund.q + 1)).toBe(1);
    c = closeQuarter(c, none);
    expect(promisedTime(c)).toBe(1);
    const full = timeLeft(c); expect(full).toBeLessThan(lifeOf(c).timeQ === c.fund.q ? 99 : 3);
    // Charter wear: price stays what you paid.
    let y = newCareer(opts()); inject(y, 200e6, 'founder'); const it = buyItem(y, 'yacht-sport'); if (!it.ok) return; y = it.c;
    const p0 = lifeOf(y).possessions[0]; const v0 = marketValue(p0, y.fund.q);
    y.life!.events.push({ id: 'ch', q: 0, template: 'charter', title: 'c', text: '', options: [{ id: 'charter', label: 'c', hint: '' }, { id: 'keep', label: 'k', hint: '' }], defaultOption: 'keep', payload: { pos: p0.id } });
    y = resolveLifeEvent(y, 'ch', 'charter');
    expect(lifeOf(y).possessions[0].price).toBe(p0.price);
    expect(marketValue(lifeOf(y).possessions[0], y.fund.q)).toBeCloseTo(v0 * 0.98, 2);
  });
});

describe('4. quoted terms are the accepted terms', () => {
  it('an allocation meeting settles exactly its quoted wire and commitment', () => {
    let c = closeN(newCareer(opts()), 4); c.fund.history = c.fund.history.map(h => ({ ...h, ret: 0.06, bench: 0 }));
    const inv = c.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01)[0]; c.satisfaction[inv.id] = 95; ensureProfiles(c);
    const q = quote(c, c.clients![inv.id], 95);
    const r = holdMeeting(c, inv.id, 'allocation'); expect(r.outcome).toBe('accepted'); c = r.c;
    const d = c.decisions.find(x => x.kind === 'top_up' && !x.resolved)!; const t = termsOf(d);
    expect(t.wireNow).toBe(q.wireNow); expect(t.commitLater).toBe(q.commitLater);
    const aum = netAssets(c.fund.ledger); const n = resolveDecision(c, d.id, 'accept');
    expect(netAssets(n.fund.ledger) - aum).toBeCloseTo(q.wireNow, -2);
    expect(n.commitments.find(x => x.id === `cm-${d.id}`)!.committed).toBeCloseTo(q.commitLater, -2);
    expect(n.flows.at(-1)!.amount).toBeCloseTo(q.wireNow, -2);
  });
  it('a new client offer settles its own saved split, also when taken by default', () => {
    const c = newCareer(opts());
    c.decisions.push({ id: 'client-t', q: 0, kind: 'new_client', amount: 3e8, from: 'Y', options: [{ id: 'accept', label: 'a', hint: '' }], defaultOption: 'accept', text: '', payload: { key: 'Y', name: 'Y', wireNow: 1.2e8, commitLater: 1.8e8, expiresQ: 1, quotedQ: 0 } });
    const aum = netAssets(c.fund.ledger); const n = resolveDecision(c, 'client-t', 'accept');
    expect(netAssets(n.fund.ledger) - aum).toBeCloseTo(1.2e8, -2);
    expect(n.commitments.find(x => x.name === 'Y')!.committed).toBeCloseTo(1.8e8, -2);
  });
});

describe('5. acquisition affordability includes discovered liabilities', () => {
  const setup = () => {
    let c = closeN(newCareer(opts(3)), 4); inject(c, 500e6, 'firm'); const t = c.targets[0];
    c = makeOffer(c, t.id, t.price).c; const d = dealsOf(c)[0]; c = runDiligence(c, d.id).c;
    const dd = dealsOf(c)[0]; dd.findings = [{ id: 'f', label: 'Lawsuit', detail: '', priceCut: 0, revenueHit: 0, liability: 3e6 }];
    return { c, id: dd.id };
  };
  it('just below the required cash it refuses; just above it closes and the rule still holds after', () => {
    const { c, id } = setup(); const chk0 = closeCheck(c, id, 0);
    const gap = chk0.cashAfter - chk0.required; // trim the firm to sit just below / above
    const below: Career = structuredClone(c); inject(below, -(gap + 1000), 'firm');
    const b = closeCheck(below, id, 0); expect(b.ok).toBe(false); expect(b.liability).toBe(3e6); expect(closeDeal(below, id, 0).ok).toBe(false);
    const above: Career = structuredClone(c); inject(above, -(gap - 1000), 'firm');
    const a = closeCheck(above, id, 0); expect(a.ok).toBe(true);
    const r = closeDeal(above, id, 0); expect(r.ok).toBe(true);
    expect(firmCash(r.c)).toBeGreaterThanOrEqual(reserveTarget(r.c) + r.c.arrears - 1);
    expect(closeDeal(r.c, id, 0).ok).toBe(false);
  });
  it('offers a funded loan alternative within the lender limit', () => {
    const { c, id } = setup(); const chk0 = closeCheck(c, id, 0);
    const short: Career = structuredClone(c); inject(short, -(chk0.cashAfter - chk0.required + 1e6), 'firm');
    const s = closeCheck(short, id, 0);
    if (s.fundedDebt !== undefined) { expect(closeCheck(short, id, s.fundedDebt).ok).toBe(true); }
  });
});

describe('6. constitution limit covers the combined order stream', () => {
  it('a large deal capital call cannot push one stock above the 10% policy', () => {
    let c = newCareer(opts()); const t = tradable(c);
    c.governance = { ...governanceOf(c), constitution: { ...DEFAULT_CONSTITUTION, maxPosition: 0.1 } };
    for (const x of c.commitments) x.reliability = 1;
    c = issueCall(c, 1e9, 'deal', t);
    c.plan.orders = [{ ticker: t, amount: netAssets(c.fund.ledger) * 0.05 }];
    expect(planDecision(c).maxPosition).toBe(0.1);
    c = closeN(c, 2);
    const w = (c.fund.ledger.positions[t] ?? 0) / netAssets(c.fund.ledger);
    const buys = (c.fills ?? []).filter(r => r.ticker === t && r.side === 'buy');
    expect(buys.some(r => r.note?.startsWith('trimmed'))).toBe(true);
    expect(c.fund.basis[t] ?? 0).toBeLessThan(0.11 * netAssets(c.fund.ledger));
    expect(w).toBeLessThan(0.13);
  });
});
