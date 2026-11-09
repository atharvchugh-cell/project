// Negotiated acquisitions. Sequence: offer -> (counter | reject | lost to a rival bid) -> agreed -> paid diligence
// with material findings -> optional renegotiation -> explicit close with a funding choice (firm cash, plus an
// optional acquisition loan). Nothing is paid for the business before closing; each deal closes at most once and
// expires if left open. Buyer is always the management company (firm cash), never the fund.
// Rival managers: you buy the management company (its fee business) from its owners. Client money is the clients':
// only consenting mandates move, by subscribing into your fund at NAV. The rival then stops existing as a competitor.
import { netAssets, subscribe } from '@/lib/fund/accounting';
import { quarterLabel } from '@/lib/fund/engine';
import { mulberry32 } from '@/lib/fund/market';
import { type Career, RESERVE_QUARTERS, firmCash, reserveQuartersOf, reserveTarget, scaleOf } from './career';
import { post } from './journal';
import { payOrOwe } from './payables';
import { type AcqTarget, type Subsidiary } from './phase3';
import { LOAN_RATE_Q, LOAN_TERM_Q, MAX_LTV, enterpriseValue, prehistory } from './business';
import { RIVAL_FIRMS, standings } from './relations';
import { reputation } from './life';
import { recordFlow } from './phase4';
import { makeProfile } from './clients';
import { approval } from './governance';
import { type Employee, isResearcher, withAbility } from './roster';
import { fameEffects } from './immersion';

export type DealStage = 'countered' | 'agreed' | 'diligence_done' | 'closed' | 'rejected' | 'withdrawn' | 'lost' | 'expired';
export interface Finding { id: string; label: string; detail: string; priceCut: number; revenueHit: number; liability: number; consent?: number }
export interface Deal {
  id: string; kind: 'business' | 'manager'; name: string; openedQ: number; expiresQ: number; stage: DealStage;
  listPrice: number; /** Seller's private walk-away price; never shown. */ floor: number;
  bid: number; ask?: number; rounds: number; agreedPrice?: number; target?: AcqTarget; rivalId?: string;
  diligenceCost?: number; findings?: Finding[]; renegotiated?: boolean; closedQ?: number; debt?: number; equityPaid?: number;
  log: { q: number; text: string }[];
}

const m = (v: number) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`);
const lbl = (c: Career, q: number) => (q > 0 ? quarterLabel(c.fund, q) : 'Opening');
const hash = (s: string) => { let h = 11; for (const ch of s) h = (h * 33 + ch.charCodeAt(0)) >>> 0; return h; };
const round = (v: number) => Math.round(v / 1e4) * 1e4;
type R = { c: Career; ok: boolean; message: string };
const fail = (c: Career, message: string): R => ({ c, ok: false, message });
const ACTIVE: DealStage[] = ['countered', 'agreed', 'diligence_done'];
export const isActive = (d: Deal) => ACTIVE.includes(d.stage);
export const dealsOf = (c: Career) => c.deals ?? [];
export const DEAL_LIFE = 2;

// ---------- Rival managers as targets ----------

export const MGR_FEE = 0.01; export const MGR_MARGIN = 0.35; export const MGR_MULTIPLE = 8;
/** A rival management company: price = its yearly fee revenue (1% of client assets) x 35% margin x 8. AUM is the clients', not part of the price. */
export function managerTargets(c: Career) {
  if (c.fund.q < 4 || c.status !== 'running') return [];
  return RIVAL_FIRMS.filter(r => !c.acquiredRivals?.includes(r.id) && (c.rivalAum[r.id] ?? 0) > 1e6).map(r => {
    const aum = c.rivalAum[r.id]; const fees = aum * MGR_FEE; const price = round(fees * MGR_MARGIN * MGR_MULTIPLE);
    const salaryMultiplier = fameEffects(c).salaryMultiplier;
    return { id: `mgr-${r.id}`, rivalId: r.id, name: r.name, aum, feesYear: fees, price, salaryMultiplier, staffCostQ: round(fees * (1 - MGR_MARGIN) / 4 * 0.3 * salaryMultiplier) };
  });
}

// ---------- Offers ----------

function sellerFloor(c: Career, id: string, list: number) { return round(list * (0.9 + mulberry32(c.fund.seed * 7 + hash(id))() * 0.1)); }

/** Make an offer. Valid amounts only. Seller accepts at or above its floor, counters within 25% of the asking price, otherwise rejects; a lowball can lose the deal to a rival bidder. */
export function makeOffer(c: Career, targetId: string, bid: number): R {
  if (c.status !== 'running' || c.fund.status === 'ended') return fail(c, 'This career has ended.');
  if (typeof bid !== 'number' || !Number.isFinite(bid) || bid <= 0) return fail(c, 'Enter a positive offer.');
  if (dealsOf(c).some(d => isActive(d) && (d.target?.id === targetId || `mgr-${d.rivalId}` === targetId))) return fail(c, 'You already have an open deal for this company.');
  if (dealsOf(c).some(d => d.stage === 'rejected' && (d.target?.id === targetId || `mgr-${d.rivalId}` === targetId) && c.fund.q - d.openedQ < 2)) return fail(c, 'The seller will not hear another offer for two quarters.');
  const t = c.targets.find(x => x.id === targetId); const mgr = managerTargets(c).find(x => x.id === targetId);
  if (!t && !mgr) return fail(c, 'That company is not for sale now.');
  const list = t ? t.price : mgr!.price; const name = t ? t.name : mgr!.name;
  const n: Career = structuredClone(c); n.deals ??= [];
  const id = `deal-${n.fund.q}-${n.deals.length + 1}`; const floor = sellerFloor(n, targetId, list);
  const d: Deal = { id, kind: t ? 'business' : 'manager', name, openedQ: n.fund.q, expiresQ: n.fund.q + DEAL_LIFE, stage: 'rejected', listPrice: list, floor, bid: round(bid), rounds: 1, target: t ? structuredClone(t) : undefined, rivalId: mgr?.rivalId, log: [] };
  respond(n, d, d.bid);
  n.deals.push(d);
  return { c: n, ok: true, message: d.log.at(-1)!.text };
}

function respond(n: Career, d: Deal, bid: number) {
  const r = mulberry32(n.fund.seed * 97 + hash(d.id) + d.rounds * 13);
  const q = n.fund.q; d.bid = bid;
  if (bid >= d.floor) { d.stage = 'agreed'; d.agreedPrice = bid; d.ask = undefined; d.expiresQ = q + DEAL_LIFE; d.log.push({ q, text: `${d.name}'s owners accepted ${m(bid)}. Diligence next; nothing is paid until closing.` }); return; }
  if (bid < d.listPrice * 0.85 && r() < 0.3) { d.stage = 'lost'; d.log.push({ q, text: `A rival bidder offered more. ${d.name} signed with them.` }); n.targets = n.targets.filter(x => x.id !== d.target?.id); return; }
  if (bid >= d.listPrice * 0.75 && d.rounds < 3) { d.stage = 'countered'; d.ask = round(Math.max(d.floor, (bid + d.listPrice) / 2)); d.log.push({ q, text: `${d.name}'s owners countered at ${m(d.ask)}.` }); return; }
  d.stage = 'rejected'; d.log.push({ q, text: `${d.name}'s owners rejected ${m(bid)}. They will not talk again for two quarters.` });
}

export function answerCounter(c: Career, dealId: string, action: 'accept' | 'improve' | 'withdraw', newBid?: number): R {
  const d0 = dealsOf(c).find(x => x.id === dealId); if (!d0 || d0.stage !== 'countered') return fail(c, 'There is no open counter-offer.');
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  const n: Career = structuredClone(c); const d = n.deals!.find(x => x.id === dealId)!; const q = n.fund.q;
  if (action === 'withdraw') { d.stage = 'withdrawn'; d.log.push({ q, text: 'You walked away.' }); return { c: n, ok: true, message: 'Withdrawn.' }; }
  if (action === 'accept') { d.stage = 'agreed'; d.agreedPrice = d.ask; d.expiresQ = q + DEAL_LIFE; d.log.push({ q, text: `You accepted ${m(d.ask!)}. Diligence next.` }); return { c: n, ok: true, message: `Agreed at ${m(d.ask!)}.` }; }
  if (typeof newBid !== 'number' || !Number.isFinite(newBid) || newBid <= d.bid) return fail(c, 'An improved offer must be higher than your last one.');
  if (newBid >= (d.ask ?? Infinity)) return answerCounter(c, dealId, 'accept');
  d.rounds += 1; respond(n, d, round(newBid));
  return { c: n, ok: true, message: d.log.at(-1)!.text };
}

export const diligenceCost = (d: Deal, c: Career) => round(Math.max(40e3 * scaleOf(c), (d.agreedPrice ?? d.listPrice) * 0.01));

/** Pay for diligence (firm cash, cannot be owed). Findings are deterministic per deal and become known only now. */
export function runDiligence(c: Career, dealId: string): R {
  const d0 = dealsOf(c).find(x => x.id === dealId); if (!d0 || d0.stage !== 'agreed') return fail(c, 'Agree a price first.');
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  const cost = diligenceCost(d0, c);
  if (firmCash(c) - c.arrears < cost) return fail(c, `Diligence costs ${m(cost)} of firm cash.`);
  const n: Career = structuredClone(c); const d = n.deals!.find(x => x.id === dealId)!; const q = n.fund.q;
  post(n.journal, { q, date: lbl(n, q), payer: 'firm', recipient: 'external', category: 'diligence', amount: cost, source: `diligence:${d.id}`, memo: `Due diligence on ${d.name}` });
  d.diligenceCost = cost; d.findings = findingsFor(n, d); d.stage = 'diligence_done'; d.expiresQ = q + DEAL_LIFE;
  d.log.push({ q, text: `Diligence (${m(cost)}): ${d.findings.map(f => f.label).join('; ')}.` });
  return { c: n, ok: true, message: `Diligence complete: ${d.findings.length} finding(s).` };
}

function findingsFor(c: Career, d: Deal): Finding[] {
  const r = mulberry32(c.fund.seed * 151 + hash(d.id)); const price = d.agreedPrice ?? d.listPrice; const out: Finding[] = [];
  if (d.kind === 'manager') {
    const consent = Math.round((0.45 + r() * 0.4) * 100) / 100;
    out.push({ id: 'consent', label: `About ${(consent * 100).toFixed(0)}% of client mandates would consent to move`, detail: 'Clients must agree individually. Non-consenting clients leave with their own money.', priceCut: 0, revenueHit: 0, liability: 0, consent });
    if (r() < 0.5) out.push({ id: 'keyperson', label: 'Key-person risk: the star manager may leave', detail: 'Two senior staff join you; integration costs two quarters of their pay.', priceCut: 0.05, revenueHit: 0, liability: 0 });
    return out;
  }
  const t = d.target!;
  if ((t.customerTop ?? 0) > 0.25 || r() < 0.3) out.push({ id: 'concentration', label: `The largest customer (${((t.customerTop ?? 0.3) * 100).toFixed(0)}% of revenue) is reviewing its contract`, detail: 'Expect revenue about 10% lower after the renewal.', priceCut: 0.08, revenueHit: 0.1, liability: 0 });
  if (r() < 0.45) { const liab = round(price * (0.03 + r() * 0.05)); out.push({ id: 'liability', label: `Unrecorded liability of ${m(liab)} (a tax and lease dispute)`, detail: 'If you close, the firm owes it as a business bill.', priceCut: liab / price, revenueHit: 0, liability: liab }); }
  if (!out.length) out.push({ id: 'clean', label: 'The accounts check out', detail: 'No material issues found.', priceCut: 0, revenueHit: 0, liability: 0 });
  return out;
}

/** After material findings, ask for a lower price once. Sellers accept a cut that matches the findings 70% of the time. */
export function renegotiate(c: Career, dealId: string): R {
  const d0 = dealsOf(c).find(x => x.id === dealId); if (!d0 || d0.stage !== 'diligence_done') return fail(c, 'Finish diligence first.');
  if (d0.renegotiated) return fail(c, 'You already renegotiated this deal.');
  const cut = (d0.findings ?? []).reduce((a, f) => a + f.priceCut, 0); if (cut <= 0) return fail(c, 'Diligence found nothing that justifies a lower price.');
  const n: Career = structuredClone(c); const d = n.deals!.find(x => x.id === dealId)!; d.renegotiated = true; const q = n.fund.q;
  const yes = mulberry32(n.fund.seed * 3 + hash(d.id) + 5)() < 0.7;
  if (yes) { d.agreedPrice = round(d.agreedPrice! * (1 - cut)); d.log.push({ q, text: `Seller accepted a lower price of ${m(d.agreedPrice)} after the findings.` }); }
  else d.log.push({ q, text: 'Seller held its price. You can still close or walk away.' });
  return { c: n, ok: true, message: d.log.at(-1)!.text };
}

export function walkAway(c: Career, dealId: string): R {
  const d0 = dealsOf(c).find(x => x.id === dealId); if (!d0 || !isActive(d0)) return fail(c, 'This deal is not open.');
  const n: Career = structuredClone(c); const d = n.deals!.find(x => x.id === dealId)!;
  d.stage = 'withdrawn'; d.log.push({ q: n.fund.q, text: `You walked away${d.diligenceCost ? ` (diligence cost ${m(d.diligenceCost)} is spent)` : ''}.` });
  return { c: n, ok: true, message: 'Walked away.' };
}

// ---------- Funding and closing ----------

/** Largest loan the lender offers: 60% of price and no more than 3x yearly operating profit (fee profit for a manager). */
export function maxDebt(c: Career, d: Deal): number {
  const price = d.agreedPrice ?? d.listPrice;
  const ebitdaYear = d.kind === 'business' ? Math.max(0, (d.target!.revenueQ - d.target!.costQ) * 4) : (managerTargets(c).find(x => x.rivalId === d.rivalId)?.feesYear ?? 0) * MGR_MARGIN;
  const consent = d.kind === 'manager' ? d.findings?.find(f => f.consent !== undefined)?.consent ?? 0.6 : 1;
  return round(Math.min(price * MAX_LTV, ebitdaYear * consent * 3));
}
export const loanRate = (c: Career) => LOAN_RATE_Q + (reputation(c).score < 40 ? 0.0025 : 0);

export interface CloseCheck {
  ok: boolean; price: number; debt: number; equity: number; liability: number; reserveAfter: number; cashAfter: number; reasons: string[]; debtServiceQ: number;
  /** Funds-and-obligations bridge: firm cash now + loan − price − upfront integration = cash after; must cover reserve + every owed bill (old arrears + liabilities found in diligence). */
  cashNow: number; integration: number; owedAfter: number; required: number; shortfall: number;
  /** Smallest loan within the lender's limit that would fund the close, if one exists and differs from the request. */
  fundedDebt?: number;
}
function closeMath(c: Career, d: Deal | undefined, debt: number) {
  const price = d?.agreedPrice ?? 0; const liability = (d?.findings ?? []).reduce((a, f) => a + f.liability, 0);
  const dv = Number.isFinite(debt) && debt > 0 ? debt : 0;
  const equity = price - dv;
  const rate = loanRate(c); const debtServiceQ = dv > 0 ? dv * rate + dv / LOAN_TERM_Q : 0;
  const newCost = d?.kind === 'business' ? d.target!.costQ : managerTargets(c).find(x => x.rivalId === d?.rivalId)?.staffCostQ ?? 0;
  const integration = d?.kind === 'manager' ? newCost * 2 : 0;
  const reserveAfter = reserveTarget(c) + (newCost + debtServiceQ) * reserveQuartersOf(c);
  const cashNow = firmCash(c); const cashAfter = cashNow - equity - integration;
  const owedAfter = c.arrears + liability; const required = reserveAfter + owedAfter;
  return { price, liability, equity, debtServiceQ, reserveAfter, cashNow, cashAfter, integration, owedAfter, required, shortfall: Math.max(0, required - cashAfter) };
}
export function closeCheck(c: Career, dealId: string, debt: number): CloseCheck {
  const d = dealsOf(c).find(x => x.id === dealId); const reasons: string[] = [];
  if (!d || d.stage !== 'diligence_done') reasons.push('Finish diligence first.');
  if (d && c.fund.q > d.expiresQ) reasons.push('The agreement expired.');
  const bad = typeof debt !== 'number' || !Number.isFinite(debt) || debt < 0;
  if (bad) reasons.push('Loan amount must be zero or a positive number.');
  const max = d ? maxDebt(c, d) : 0; if (!bad && debt > max + 1) reasons.push(`The lender offers at most ${m(max)}.`);
  const x = closeMath(c, d, bad ? 0 : debt);
  if (x.shortfall > 0.5) reasons.push(`After paying ${m(x.equity + x.integration)} the firm would hold ${m(x.cashAfter)}, short of the ${m(x.required)} needed for its reserve and every owed bill, including ${m(x.liability)} found in diligence.`);
  let fundedDebt: number | undefined;
  if (x.shortfall > 0.5 && d && !bad && max > 0) {
    let lo = Math.max(0, debt), hi = max;
    if (closeMath(c, d, hi).shortfall <= 0.5) { for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (closeMath(c, d, mid).shortfall <= 0.5) hi = mid; else lo = mid; } fundedDebt = Math.ceil(hi / 1000) * 1000; if (fundedDebt > max) fundedDebt = max; if (closeMath(c, d, fundedDebt).shortfall > 0.5) fundedDebt = undefined; }
    if (fundedDebt !== undefined) reasons.push(`A loan of ${m(fundedDebt)} (within the lender's ${m(max)}) would fund it.`);
  }
  if (d?.kind === 'manager') {
    const mt = managerTargets(c).find(t => t.rivalId === d.rivalId);
    const consent = d.findings?.find(f => f.consent !== undefined)?.consent ?? 0.6;
    const earningsQ = (mt?.feesYear ?? 0) * consent * MGR_MARGIN / 4;
    if (x.debtServiceQ > 0 && earningsQ / x.debtServiceQ < 1.2) reasons.push('Consenting fee-business earnings must cover loan service at least 1.2x.');
    if (c.transfers.some(t => t.status === 'pending' && t.rival === d.rivalId)) reasons.push('Finish pending client transfers with this rival first.');
    const v = approval(c, 'acquisition'); if (!v.passed) reasons.push(`Partners voted ${(v.yes * 100).toFixed(0)}% yes; your constitution needs ${(v.needed * 100).toFixed(0)}%.`);
  }
  return { ok: reasons.length === 0, debt: bad ? 0 : debt, reasons, fundedDebt, ...x };
}
void RESERVE_QUARTERS;

export function closeDeal(c: Career, dealId: string, debt = 0): R {
  if (c.status !== 'running' || c.fund.status === 'ended') return fail(c, 'This career has ended.');
  const chk = closeCheck(c, dealId, debt); if (!chk.ok) return fail(c, chk.reasons[0]);
  const n: Career = structuredClone(c); const d = n.deals!.find(x => x.id === dealId)!; const q = n.fund.q;
  if (debt > 0.5) post(n.journal, { q, date: lbl(n, q), payer: 'external', recipient: 'firm', category: 'loan_draw', amount: debt, source: `loan:${d.id}`, memo: `Acquisition loan for ${d.name}` });
  post(n.journal, { q, date: lbl(n, q), payer: 'firm', recipient: 'external', category: 'acquisition', amount: chk.price, source: `close-deal:${d.id}`, memo: `Bought ${d.name}` });
  d.stage = 'closed'; d.closedQ = q; d.debt = debt; d.equityPaid = chk.equity;
  if (d.kind === 'business') closeBusinessDeal(n, d, debt); else closeManagerDeal(n, d);
  d.log.push({ q, text: `Closed: paid ${m(chk.price)} (${m(chk.equity)} firm cash${debt > 0 ? `, ${m(debt)} loan` : ''}).` });
  return { c: n, ok: true, message: `${d.name} is now yours.` };
}

function closeBusinessDeal(n: Career, d: Deal, debt: number) {
  const t = d.target!; const q = n.fund.q;
  const hit = (d.findings ?? []).reduce((a, f) => a + f.revenueHit, 0);
  const s: Subsidiary = {
    id: `sub-${t.id}`, kind: t.kind, name: t.name, price: d.agreedPrice!, revenueQ: t.revenueQ, costQ: t.costQ, multiple: t.multiple, acquiredQ: q,
    history: t.history ?? prehistory(t.id, t.kind, t.revenueQ, t.costQ, t.multiple), risks: t.risks, dealId: d.id, ownerId: 'firm',
    effects: hit > 0 ? [{ q: Math.max(q + 1, t.renewalQ ?? q + 2), revenue: -hit, cost: 0, note: 'Largest customer renegotiated' }] : [],
    loan: debt > 0.5 ? { principal: debt, balance: debt, rateQ: loanRate(n), amortQ: debt / LOAN_TERM_Q, maturityQ: q + LOAN_TERM_Q, drawnQ: q, lastQ: q, breaches: 0, penalty: 0 } : undefined,
  };
  const liabilities = (d.findings ?? []).reduce((a, f) => a + Math.max(0, f.liability), 0);
  const sellerCash = [...(s.history ?? [])].reverse().find(h => h.simulated)?.cash ?? 0;
  s.closing = { q, structure: 'cash_free_debt_free', sellerCash, purchasedCash: 0, price: d.agreedPrice!, equity: d.agreedPrice! - debt, loan: debt, liabilities };
  if (t.kind === 'research' && !s.benefit) {
    const staff: { id: string; name: string; from: number; to: number }[] = [];
    n.roster = n.roster.map(e => { if (!isResearcher(e)) return e; const to = withAbility(e, e.ability + 4); if (to > e.ability) staff.push({ id: e.id, name: e.name, from: e.ability, to }); return { ...e, ability: to }; });
    s.benefit = { q, staff };
  }
  n.subsidiaries.push(s); n.targets = n.targets.filter(x => x.id !== t.id);
  if (!n.entities.some(e => e.id === s.id)) n.entities.push({ id: s.id, name: s.name, kind: 'company', ownerId: 'firm' });
  for (const f of d.findings ?? []) if (f.liability > 0) n.payables.push({ id: `owe-${d.id}-${f.id}`, q, kind: 'subsidiary', category: 'subsidiary_cost', label: `${t.name}: ${f.label}`, amount: f.liability });
  n.arrears = n.payables.reduce((a, p) => a + p.amount, 0);
  n.notices.push({ q, from: 'Chief operating officer', subject: `${t.name} is ours`, body: `Closed at ${m(d.agreedPrice!)}. It joins next quarter at half revenue for two quarters while we integrate it. Cash-free, debt-free: the seller kept its ${m(sellerCash)} of pre-closing cash.${s.benefit ? ` Research team gains: ${s.benefit.staff.length ? s.benefit.staff.map(x => `${x.name} ${x.from.toFixed(0)}→${x.to.toFixed(0)}`).join(', ') : 'none (everyone is at potential)'}.` : ''}${debt > 0 ? ` Loan ${m(debt)} at ${(loanRate(n) * 400).toFixed(1)}% a year over ${LOAN_TERM_Q} quarters.` : ''}`, tone: 'good' });
}

/** Rival manager: you own its fee business; consenting client mandates subscribe into your fund at NAV; the rest leave with their money. */
function closeManagerDeal(n: Career, d: Deal) {
  const q = n.fund.q; const rid = d.rivalId!; const rival = RIVAL_FIRMS.find(r => r.id === rid)!;
  const consent = d.findings?.find(f => f.consent !== undefined)?.consent ?? 0.6;
  const aum = n.rivalAum[rid] ?? 0; const moving = round(aum * consent); const leaving = aum - moving;
  const staffCostQ = managerTargets(n).find(x => x.rivalId === rid)?.staffCostQ ?? 0;
  n.acquiredRivals = [...(n.acquiredRivals ?? []), rid]; n.rivalAum[rid] = 0;
  const id = `mandates-${rid}`;
  if ((d.debt ?? 0) > 0) (n.managerFacilities ??= []).push({ id: d.id, name: rival.name, investorId: id, acquiredQ: q, margin: MGR_MARGIN, loan: { principal: d.debt ?? 0, balance: d.debt ?? 0, rateQ: loanRate(n), amortQ: (d.debt ?? 0) / LOAN_TERM_Q, maturityQ: q + LOAN_TERM_Q, drawnQ: q, lastQ: q, breaches: 0, penalty: 0 }, history: [] });
  if (moving > 0.5 && n.fund.status !== 'ended') {
    const units = subscribe(n.fund.ledger, moving);
    n.fund.investors.push({ id, name: `${rival.name} client mandates`, relation: 'Transferred mandates', units, joinedQ: q, lockupUntilQ: q + 4, note: `Clients of ${rival.name} who consented to move after you bought the manager. ${m(moving)} subscribed at today's fund price; it is their money, not purchase proceeds.` });
    n.satisfaction[id] = 62; n.clients ??= {};
    const p = makeProfile(n, id, `${rival.name} client mandates`, scaleOf(n)); p.kind = 'pension'; p.wealth = moving / 0.6; p.maxShare = 1;
    p.history = [{ q, kind: 'offer', text: `Moved ${m(moving)} after ${rival.name} was acquired`, amount: moving }]; n.clients[id] = p;
    recordFlow(n, { investorId: id, name: `${rival.name} client mandates`, amount: moving, kind: 'manager_acquisition', rival: rid });
  }
  const pay = (r: number) => Math.round(staffCostQ / 2 * r / 1000) * 1000;
  const rr = mulberry32(n.fund.seed * 5 + hash(rid)); const pick = (xs: string[]) => xs[Math.floor(rr() * xs.length)];
  const nm = () => `${pick(['Helena', 'Rafael', 'Ingrid', 'Desmond', 'Amelie', 'Kofi', 'Sana', 'Lucas'])} ${pick(['Marsh', 'Okonkwo', 'Lindgren', 'Duarte', 'Feld', 'Takahashi', 'Byrne', 'Novak'])}`;
  const joiners: Employee[] = [
    { id: `e-${rid}-pm`, seed: hash(rid) % 100000, name: nm(), role: 'Portfolio manager', skill: 'Ran the acquired firm\'s main fund', bio: `Joined when you bought ${rival.name}.`, salaryQ: pay(1.2), morale: 55, ability: 70, potential: 78, level: 3, joinedQ: q, assignment: null, progress: 0 },
    { id: `e-${rid}-ir`, seed: (hash(rid) + 17) % 100000, name: nm(), role: 'Head of investor relations', skill: 'Knows the transferred clients', bio: `Joined when you bought ${rival.name}.`, salaryQ: pay(0.8), morale: 60, ability: 64, potential: 72, level: 2, joinedQ: q, assignment: null, progress: 0 },
  ];
  if (!(d.findings ?? []).some(f => f.id === 'keyperson')) n.roster.push(...joiners); else n.roster.push(joiners[1]);
  n.capacity = Math.max(n.capacity, n.roster.length);
  payOrOwe(n, { q, kind: 'event', category: 'event_cost', amount: staffCostQ * 2, memo: `${rival.name} integration (systems, legal, retention)`, source: `integrate:${d.id}` });
  n.notices.push({ q, from: 'General counsel', subject: `${rival.name} acquired`, body: `You own its management company. ${m(moving)} of client mandates (${(consent * 100).toFixed(0)}%) consented and joined your fund at NAV; ${m(leaving)} left with their own money. ${rival.name} no longer competes; its fees now arrive only as your fund's fees.`, tone: 'good' });
}

/** At close: expire stale offers; a rival bidder may take a business you left on a counter-offer. */
export function dealsAtClose(n: Career, q: number) {
  for (const d of dealsOf(n).filter(isActive)) {
    if (q > d.expiresQ) { d.stage = 'expired'; d.log.push({ q, text: 'The agreement expired without closing. Nothing was paid for the company.' }); continue; }
    if (d.stage === 'countered' && mulberry32(n.fund.seed * 41 + hash(d.id) + q)() < 0.25) { d.stage = 'lost'; d.log.push({ q, text: `While you considered the counter, a rival bid for ${d.name} and won.` }); n.targets = n.targets.filter(x => x.id !== d.target?.id); }
  }
}

/** Value of owned businesses (enterprise value) net of their loans, for valuation and the museum. */
export const businessesEquity = (c: Career) => c.subsidiaries.reduce((a, s) => a + enterpriseValue(s) - (s.loan?.balance ?? 0), 0);
export const rivalRank = (c: Career, rid: string) => standings(c).findIndex(s => s.id === rid) + 1;
void netAssets;

/** One-click purchase at the asking price: no negotiation or diligence; the lender's loan is used only if firm cash alone falls short. */
export function buyNow(c: Career, targetId: string): R {
  if (c.status !== 'running' || c.fund.status === 'ended') return fail(c, 'This career has ended.');
  if (dealsOf(c).some(d => isActive(d) && (d.target?.id === targetId || `mgr-${d.rivalId}` === targetId))) return fail(c, 'You already have an open deal for this company.');
  const t = c.targets.find(x => x.id === targetId); const mgr = managerTargets(c).find(x => x.id === targetId);
  if (!t && !mgr) return fail(c, 'That company is not for sale now.');
  const list = t ? t.price : mgr!.price; const q = c.fund.q;
  const n: Career = structuredClone(c); n.deals ??= [];
  const id = `deal-${q}-${n.deals.length + 1}`;
  n.deals.push({ id, kind: t ? 'business' : 'manager', name: t ? t.name : mgr!.name, openedQ: q, expiresQ: q + DEAL_LIFE, stage: 'diligence_done', listPrice: list, floor: list, bid: list, agreedPrice: list, rounds: 1, target: t ? structuredClone(t) : undefined, rivalId: mgr?.rivalId, findings: [], log: [{ q, text: `Bought at the asking price of ${m(list)}.` }] });
  let chk = closeCheck(n, id, 0); let debt = 0;
  if (!chk.ok && chk.fundedDebt !== undefined) { debt = chk.fundedDebt; chk = closeCheck(n, id, debt); }
  if (!chk.ok) return fail(c, chk.reasons.find(r => !r.startsWith('A loan of')) ?? chk.reasons[0]);
  return closeDeal(n, id, debt);
}

/** Close an agreed deal straight away at the agreed price, skipping optional diligence. */
export function closeAgreedNow(c: Career, dealId: string): R {
  const d0 = dealsOf(c).find(x => x.id === dealId); if (!d0 || d0.stage !== 'agreed') return fail(c, 'Agree a price first.');
  const n: Career = structuredClone(c); const d = n.deals!.find(x => x.id === dealId)!;
  d.stage = 'diligence_done'; d.findings = [];
  let chk = closeCheck(n, dealId, 0); let debt = 0;
  if (!chk.ok && chk.fundedDebt !== undefined) { debt = chk.fundedDebt; chk = closeCheck(n, dealId, debt); }
  if (!chk.ok) return fail(c, chk.reasons.find(r => !r.startsWith('A loan of')) ?? chk.reasons[0]);
  return closeDeal(n, dealId, debt);
}
