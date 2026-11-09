// Quarter close for a firm career. Order:
// 1 guard (career running, closeId not yet posted); open decisions take their defaults
// 2 capital calls due fund at NAV (late interest becomes this quarter's fund income)
// 3 existing fund engine quarter (offers, redemptions, trades, market, fund costs, fee accrual, settlement)
// 4 rivals earn the completed quarter; paid redemptions reach rivals
// 5 fee receipt fund -> firm, business revenue
// 6 firm bills in payables.ts order: earlier unpaid items, payroll, office, business costs (unpaid stays owed)
// 7 founder salary firm -> founder, paid last
// 8 Phase 2-5 hooks (people, clients, rivals, contributions, activists, crises, newspaper); new decisions only while the fund runs
// 9 the closing observation (history aum/nav) and snapshot are recorded after every flow; closeId marked closed
import { type FundState, type QuarterDecision, playQuarter, quarterLabel } from '@/lib/fund/engine';
import { nav, netAssets } from '@/lib/fund/accounting';
import { type Career, emptyPlan, firmCash, founderCash, reserveTarget } from './career';
import { executionCap, planDecision , ideaOrders } from './plan';
import { consumeReceipts } from './attribution';
import { enforceDelegationCap } from './staff';
import { generateTargets, scheduleRegularCall, settleCalls, subsidiaryCostsAtClose, subsidiaryRevenueAtClose } from './phase3';
import { payOrOwe, settlePayables } from './payables';
import { isClosed, post } from './journal';
import { payroll } from './roster';
import { mulberry32 } from '@/lib/fund/market';
import { applyDecision, phase2AtClose } from './phase2';
import { celebrityAtClose, relationsAtClose } from './relations';
import { phase4AtClose, rivalsAtClose, settleTransfers } from './phase4';
import { phase5AtClose } from './phase5';
import { lifeAtClose } from './life';
import { founderAtClose } from './founder';
import { venturesAtClose } from './ventures';
import { finalNetWorth, postDistribution } from './exit';
import { clientsAtClose } from './clients';
import { dealsAtClose } from './deals';
import { governanceAtClose, payoutCap } from './governance';
import { settleManagerLoans } from './managerLoans';
import { staffServiceAtClose, staffServiceQuote } from './immersion';
import { markPublicClose, settlePublicDebt } from './publicFirm';
import { publicRestricted } from './publicBook';

const label = (c: Career, q: number) => (q > 0 ? quarterLabel(c.fund, q) : 'Opening');

/** Post the fund's newly paid fee cash to the firm. Called after every fund mutation. */
function recordFees(c: Career, q: number, source: string, closeId?: string) {
  const paid = c.fund.ledger.managerCash - c.feeCounter;
  if (paid > 0.005) post(c.journal, { q, date: label(c, q), payer: 'fund', recipient: 'firm', category: 'fee_receipt', amount: paid, source, memo: 'Management and performance fees paid by the fund', closeId });
  c.feeCounter = c.fund.ledger.managerCash;
}

/** Replace the fund after a between-quarter action (pay investors, raise cash) and record any fees it paid. */
export function applyFundAction(c: Career, fund: FundState, source: string): Career {
  const n: Career = structuredClone(c);
  n.fund = structuredClone(fund);
  consumeReceipts(n);
  recordFees(n, n.fund.q, source);
  return n;
}

export const closeIdFor = (c: Career, q: number) => `${c.id}:Q${q}`;

/**
 * Settle the next quarter exactly once. Without an explicit decision the saved plan runs (desk orders + approved ideas,
 * validated the same way as the preview). An explicit decision still gets approved idea orders added, never overridden.
 */
export function closeQuarter(c: Career, d?: QuarterDecision): Career {
  if (c.status === 'ended' || c.ending) return c;
  // A fund that already closed ends the career, so the results screen shows instead of a dead close button.
  if (c.fund.status === 'ended' || c.fund.q >= c.fund.quarters) return { ...c, status: 'ended' };
  const q = c.fund.q + 1; const closeId = closeIdFor(c, q);
  // A close id marked with nothing posted under it and the quarter not played (interrupted close) is stale; anything posted means a real duplicate.
  if (isClosed(c.journal, closeId)) {
    if (c.fund.history.some(h => h.q === q) || c.journal.txns.some(t => t.closeId === closeId)) return c;
    c = { ...c, journal: { ...c.journal, closed: c.journal.closed.filter(x => x !== closeId) } };
  }
  let n: Career = structuredClone(c);
  if (!Array.isArray(n.fund.receipts)) n.fund.receipts = [];
  // Every transaction posted from here until the close finishes belongs to this close's period (defaults included).
  const txStart = n.journal.txns.length;
  const staffQuote = staffServiceQuote(n, q);
  // Decisions left open from last quarter take their default option before the quarter runs.
  for (const dec of n.decisions.filter(x => !x.resolved && x.q < q && x.kind !== 'payroll_shortfall')) n = resolveDecision(n, dec.id, dec.defaultOption ?? 'none');
  // Orders approved through the idea pipeline join this quarter's trades, each tagged with its idea for receipts.
  const decision: QuarterDecision = d ? { ...d, orders: [...d.orders, ...ideaOrders(n, d.orders).map(({ ticker, amount, ref }) => ({ ticker, amount, ref }))] } : planDecision(n);
  n.pendingOrders = [];
  // Capital calls due this close fund first (units at NAV); deal calls add their buy orders; late interest is fund income.
  const calls = settleCalls(n, q, mulberry32(n.fund.seed * 613 + q * 29), closeId);
  decision.orders = [...decision.orders, ...calls.orders];
  if (calls.income > 0) decision.income = (decision.income ?? 0) + calls.income;
  // The constitution's position limit applies to the combined stream at the real execution boundary (engine).
  const cap = executionCap(n); if (cap !== undefined) decision.maxPosition = cap; else delete decision.maxPosition;
  n.fund = playQuarter(n.fund, decision);
  const fills = n.fund.receipts ?? [];
  consumeReceipts(n);
  const trimmed = fills.filter(r => r.side === 'buy' && r.note && r.note.startsWith('trimmed'));
  if (trimmed.length) n.notices.push({ q, from: 'Trading desk', subject: 'Buys trimmed by your constitution', body: trimmed.map(r => `${r.ticker}: ${Math.round(r.amount).toLocaleString('en-US')} of ${Math.round(r.requested).toLocaleString('en-US')} dollars bought (${r.note}).`).join(' '), tone: 'neutral' });
  // A fund that closed this quarter takes no new money from here on.
  if (n.fund.status === 'ended') n.status = 'ended';
  n.plan = emptyPlan(n.fund.q);
  rivalsAtClose(n);
  settleTransfers(n);
  recordFees(n, q, `close:Q${q}`, closeId);
  staffServiceAtClose(n, q, closeId, staffQuote);
  subsidiaryRevenueAtClose(n, q, closeId);
  // Earlier unpaid bills come first, then this quarter's bills; anything unaffordable stays itemized and owed.
  settlePayables(n, q, `close:Q${q}`, closeId);
  const src = `close:Q${q}`;
  let short = payOrOwe(n, { q, kind: 'payroll', category: 'payroll', amount: payroll(n.roster), memo: `Payroll for ${n.roster.length} staff`, source: src, closeId }).owed;
  short += payOrOwe(n, { q, kind: 'office', category: 'office', amount: n.officeQ, memo: `${n.hq} office lease and services`, source: src, closeId }).owed;
  short += subsidiaryCostsAtClose(n, q, closeId);
  short += settleManagerLoans(n, q, closeId);
  short += settlePublicDebt(n, q, closeId);
  if (short > 0.5) {
    n.decisions.push({ id: `payroll-${q}`, q, kind: 'payroll_shortfall', amount: n.arrears, text: `The firm could not cover ${Math.round(short).toLocaleString('en-US')} dollars of this quarter's bills. Every unpaid amount stays owed and is paid first at the next close.` });
    n.notices.push({ q, from: 'Chief operating officer', subject: 'Firm cash ran short', body: 'We could not pay every bill this quarter. The unpaid amounts are still owed. Decide whether to put in personal money or defer, which will hurt morale.', tone: 'bad' });
  }
  if (n.founderSalaryQ > 0) {
    if (firmCash(n) >= n.founderSalaryQ) post(n.journal, { q, date: label(n, q), payer: 'firm', recipient: 'founder', category: 'salary', amount: n.founderSalaryQ, source: `close:Q${q}`, memo: 'Founder salary', closeId });
    else n.notices.push({ q, from: 'Chief operating officer', subject: 'Your salary was skipped', body: 'The firm did not have enough cash to pay you this quarter.', tone: 'bad' });
  }
  phase2AtClose(n, mulberry32(n.fund.seed * 977 + q * 131), short > 0.5);
  relationsAtClose(n, mulberry32(n.fund.seed * 389 + q * 577));
  if (n.immersion) celebrityAtClose(n, mulberry32(n.fund.seed * 1291 + q * 37));
  clientsAtClose(n);
  phase4AtClose(n);
  phase5AtClose(n, mulberry32(n.fund.seed * 733 + q * 419));
  venturesAtClose(n, closeId);
  lifeAtClose(n, mulberry32(n.fund.seed * 271 + q * 863), closeId);
  founderAtClose(n, closeId);
  governanceAtClose(n, q, closeId);
  dealsAtClose(n, q);
  if (n.status === 'running') { scheduleRegularCall(n, q); generateTargets(n, q); }
  enforceDelegationCap(n);
  if (n.autoAcceptMoney) n = acceptAllMoney(n);
  finalizeObservation(n, q);
  for (const t of n.journal.txns.slice(txStart)) if (!t.closeId) t.closeId = closeId;
  markPublicClose(n);
  n.journal.closed.push(closeId);
  const closeTx = n.journal.txns.filter(t => t.closeId === closeId);
  const expenses = closeTx.filter(t => t.payer === 'firm' && t.category !== 'distribution').reduce((a, t) => a + t.amount, 0);
  const fees = closeTx.filter(t => t.category === 'fee_receipt').reduce((a, t) => a + t.amount, 0);
  n.snapshots.push({ q, nav: nav(n.fund.ledger), aum: netAssets(n.fund.ledger), firmCash: firmCash(n), founderCash: founderCash(n), fees, expenses, unpaid: n.arrears, netWorth: finalNetWorth(n) });
  applySalarySchedule(n);
  return n;
}

/**
 * The authoritative closing record for quarter q, written after every closing subscription, redemption and flow.
 * NAV is unchanged by flows at NAV, so the quarter's return stays as computed; AUM becomes the real closing size.
 * Between-quarter wires later change the live fund, never this record.
 */
function finalizeObservation(n: Career, q: number) {
  const h = n.fund.history.at(-1);
  if (!h || h.q !== q) return;
  const aum = netAssets(n.fund.ledger);
  h.tradedAum ??= h.aum;
  h.closingFlows = aum - h.tradedAum;
  h.aum = aum; h.nav = nav(n.fund.ledger);
}

/** Resolve a pending payroll shortfall. */
export function resolveDecision(c: Career, id: string, choice: string): Career {
  const n: Career = structuredClone(c);
  const dec = n.decisions.find(x => x.id === id && !x.resolved); if (!dec) return c;
  const q = n.fund.q;
  if (dec.kind !== 'payroll_shortfall') {
    if (dec.options && !dec.options.some(o => o.id === choice)) return c;
    const noticesBefore = n.notices.length;
    applyDecision(n, dec, choice);
    const after = n.decisions.find(x => x.id === id);
    if (after) {
      after.resolved = choice;
      after.outcome = n.notices.slice(noticesBefore).map(x => x.body).join(' ') || `Selected: ${dec.options?.find(o => o.id === choice)?.label ?? choice}.`;
    }
    return n;
  }
  if (choice === 'inject') {
    const amt = Math.min(Math.max(0, founderCash(n)), n.arrears);
    if (amt <= 0) return c;
    post(n.journal, { q, date: label(n, q), payer: 'founder', recipient: 'firm', category: 'capital_injection', amount: amt, source: `decision:${id}`, memo: 'Personal capital put into the firm' });
    settlePayables(n, q, `decision:${id}`, undefined, amt);
  } else {
    n.roster = n.roster.map(e => ({ ...e, morale: Math.max(0, e.morale - 15) }));
  }
  dec.resolved = choice;
  dec.outcome = choice === 'inject' ? 'Personal capital was transferred to the firm and used to settle owed bills.' : 'Pay was deferred. Bills remain owed and staff morale fell.';
  return n;
}

export { RESERVE_QUARTERS, reserveTarget } from './career';
/** Most the founder can take out while keeping RESERVE_QUARTERS of firm bills (business costs included) in reserve and every unpaid bill covered. */
export const maxDistribution = (c: Career) => publicRestricted(c) ? 0 : payoutCap(c, Math.max(0, firmCash(c) - reserveTarget(c) - c.arrears));

export function distribute(c: Career, amount: number): Career {
  if (!Number.isFinite(amount) || amount <= 0 || c.status !== 'running' || c.ending) return c;
  const amt = Math.min(amount, maxDistribution(c));
  if (!(amt > 0)) return c;
  const n: Career = structuredClone(c);
  postDistribution(n, amt, `distribution:${n.journal.seq + 1}`);
  if (n.publicFirm) { const dps = amt / n.publicFirm.shares; n.publicFirm.dividendsPerShare += dps; n.publicFirm.personal.dividends += dps * n.publicFirm.personal.shares; }
  return n;
}

/** Change the founder salary. Rejects non-finite or negative values; takes effect at the next quarter close. */
export function setFounderSalary(c: Career, salaryQ: number): Career {
  if (!Number.isFinite(salaryQ) || salaryQ < 0) return c;
  const toQ = Math.round(salaryQ / 1000) * 1000;
  if (toQ === c.founderSalaryQ) return c;
  const effectiveQ = c.fund.q + 1;
  const history = [...(c.salaryHistory ?? []).filter(x => x.effectiveQ !== effectiveQ), { atQ: c.fund.q, effectiveQ, fromQ: (c.salaryHistory ?? []).find(x => x.effectiveQ === effectiveQ)?.fromQ ?? c.founderSalaryQ, toQ }];
  return { ...c, founderSalaryQ: toQ, salaryHistory: history };
}

/** Schedule a founder salary from the close of quarter fromQ. The next close applies immediately through setFounderSalary. */
export function scheduleSalary(c: Career, fromQ: number, salaryQ: number): Career {
  if (!Number.isFinite(salaryQ) || salaryQ < 0 || !Number.isInteger(fromQ) || fromQ <= c.fund.q || fromQ > c.fund.quarters) return c;
  const amt = Math.round(salaryQ / 1000) * 1000;
  if (fromQ === c.fund.q + 1) return setFounderSalary(c, amt);
  return { ...c, salarySchedule: [...c.salarySchedule.filter(x => x.fromQ !== fromQ), { fromQ, salaryQ: amt }].sort((a, b) => a.fromQ - b.fromQ) };
}
export const unscheduleSalary = (c: Career, fromQ: number): Career => ({ ...c, salarySchedule: c.salarySchedule.filter(x => x.fromQ !== fromQ) });

/** After a close: a step due at the next close becomes the live salary, so the review and estimates already show it. */
function applySalarySchedule(n: Career) {
  const next = n.fund.q + 1;
  const due = n.salarySchedule.filter(x => x.fromQ <= next);
  if (!due.length) return;
  n.salarySchedule = n.salarySchedule.filter(x => x.fromQ > next);
  Object.assign(n, setFounderSalary(n, due[due.length - 1].salaryQ));
}

export const openDecisions = (c: Career) => c.decisions.filter(d => !d.resolved);

/** Open client money offers (new clients, top-ups) that can be accepted. */
export const moneyOffers = (c: Career) => c.decisions.filter(d => !d.resolved && (d.kind === 'new_client' || d.kind === 'top_up') && d.options?.some(o => o.id === 'accept'));
/** Accept every open money offer at its saved terms, plus this quarter's fund investor offers. */
export function acceptAllMoney(c: Career): Career {
  let n = c;
  for (const d of moneyOffers(c)) n = resolveDecision(n, d.id, 'accept');
  if (n.fund.offers.length) n = { ...n, plan: { ...n.plan, acceptOfferIds: [...new Set([...n.plan.acceptOfferIds, ...n.fund.offers.map(o => o.id)])] } };
  return n;
}
export const setAutoAccept = (c: Career, on: boolean): Career => (on ? acceptAllMoney({ ...c, autoAcceptMoney: true }) : { ...c, autoAcceptMoney: false });
