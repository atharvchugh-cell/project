// Quarter plan, estimates, review and reporting for a firm career. Pure functions:
// the same plan feeds the order preview, the review and closeQuarter, so what the
// player approves is exactly what settles.
import { type DueLine, type FundState, type Order, type QuarterDecision, assetName, dueBreakdown, isTradable, quarterLabel } from '@/lib/fund/engine';
import { grossAssets, nav, netAssets, openLiabilities } from '@/lib/fund/accounting';
import { type Career, type QuarterPlan, emptyPlan, firmCash, founderCash } from './career';
import { type Txn, type TxnCategory } from './journal';
import { payroll } from './roster';
import { businessQuarter, callsDueAt } from './phase3';
import { owedBy } from './payables';
import { constitutionOrders, rules, serviceCostQ } from './governance';
import { companyCash } from './business';
import { managerDebtService } from './managerLoans';
import { expectedContributions } from './phase4';
import { managementFee } from '@/lib/fund/clientFees';
import { staffServiceQuote } from './immersion';
import { publicDebtService } from './publicBook';

export type PlannedOrder = Order & { source: 'desk' | 'idea'; ideaId?: string; label: string };

/** Drop anything the fund can no longer execute; never invents orders. */
export function validatePlan(f: FundState, p: QuarterPlan): { plan: QuarterPlan; issues: string[] } {
  const issues: string[] = [];
  const orders: Order[] = [];
  for (const o of p.orders) {
    if (!o || typeof o.ticker !== 'string' || !Number.isFinite(o.amount)) { issues.push('Removed an unreadable order.'); continue; }
    if (o.amount > 0 && !isTradable(f, o.ticker)) { issues.push(`${assetName(o.ticker)} is not trading this quarter.`); continue; }
    if ((o.sellAll || o.amount < 0) && !((f.ledger.positions[o.ticker] ?? 0) > 0)) { issues.push(`The fund no longer holds ${assetName(o.ticker)}.`); continue; }
    if (!o.sellAll && Math.abs(o.amount) < 0.5) continue;
    orders.push(o);
  }
  const acceptOfferIds = p.acceptOfferIds.filter(id => f.offers.some(o => o.id === id));
  const sellLocked = Math.max(0, Math.min(f.ledger.locked, Number.isFinite(p.sellLocked) ? p.sellLocked : 0));
  return { plan: { q: f.q, orders, acceptOfferIds, sellLocked, journal: (p.journal ?? '').slice(0, 280) }, issues };
}

/** Desk orders plus orders approved through the idea pipeline. Both run; the engine sells first, then buys. */
export function plannedOrders(c: Career, p: QuarterPlan = c.plan): PlannedOrder[] {
  const desk = validatePlan(c.fund, p).plan.orders.map(o => ({ ...o, ref: 'desk', source: 'desk' as const, label: `${o.sellAll ? 'Sell all' : o.amount > 0 ? 'Buy' : 'Sell'} ${assetName(o.ticker)}${o.timing === 'mid' ? ' (mid-quarter)' : ''}` }));
  return [...desk, ...ideaOrders(c, desk)];
}

/**
 * Approved ideas move each stock to its approved share of the fund (for example 2%), whatever it holds now.
 * When fund cash after desk trades and next quarter's payments cannot pay for them, other holdings are sold
 * evenly to fund the buys, so the approved weight is actually reached.
 */
export function ideaOrders(c: Career, desk: Order[]): PlannedOrder[] {
  const f = c.fund; const l = f.ledger; const aum = netAssets(l);
  const buys: PlannedOrder[] = c.pendingOrders.map(o => {
    const idea = o.ideaId ? c.ideas.find(i => i.id === o.ideaId) : undefined;
    const target = idea?.size !== undefined && idea.size > 0 ? Math.max(0, idea.size * aum - (l.positions[o.ticker] ?? 0)) : o.amount;
    return { ticker: o.ticker, amount: target, ref: o.ideaId ?? 'desk', source: 'idea' as const, ideaId: o.ideaId, label: `Buy ${assetName(o.ticker)} (approved idea${idea?.size ? `, to ${+(idea.size * 100).toFixed(2)}% of the fund` : ''})` };
  }).filter(o => o.amount > 0.5);
  if (!buys.length) return buys;
  const sold = new Set(desk.filter(o => o.sellAll).map(o => o.ticker));
  const deskNet = desk.reduce((a, o) => a + (o.sellAll ? -(l.positions[o.ticker] ?? 0) : o.amount), 0);
  const due = dueBreakdown(f, 1).reduce((a, x) => a + x.amount, 0);
  const need = buys.reduce((a, o) => a + o.amount, 0) - Math.max(0, l.cash - deskNet - due);
  if (need <= 0.5) return buys;
  const skip = new Set([...buys.map(o => o.ticker), ...sold]);
  const pool = Object.entries(l.positions).filter(([t, v]) => v > 0 && !skip.has(t) && isTradable(f, t));
  const total = pool.reduce((a, [, v]) => a + v, 0); if (total <= 0) return buys;
  const share = Math.min(1, (need * 1.01) / total);
  const sells: PlannedOrder[] = pool.map(([t, v]) => ({ ticker: t, amount: -v * share, ref: 'desk', source: 'idea' as const, label: `Sell some ${assetName(t)} to pay for approved ideas` }));
  return [...sells, ...buys];
}

/** Strip planner-only fields; keep who placed each order so receipts can attribute fills. */
const execOrder = ({ ticker, amount, sellAll, timing, ref }: PlannedOrder | Order): Order => ({ ticker, amount, ...(sellAll ? { sellAll } : {}), ...(timing ? { timing } : {}), ...(ref ? { ref } : {}) });
/** Position limit to enforce at execution, or undefined when the constitution sets none. */
export const executionCap = (c: Career) => { const v = rules(c).maxPosition; return Number.isFinite(v) && v > 0 && v < 1 ? v : undefined; };

/** The exact decision closeQuarter will execute (deal-call buys are added at the close and checked by the same cap). */
export function planDecision(c: Career, p: QuarterPlan = c.plan): QuarterDecision {
  const v = validatePlan(c.fund, p).plan;
  const cap = executionCap(c);
  return { orders: constitutionOrders(c, plannedOrders(c, v).map(execOrder)).orders, acceptOfferIds: v.acceptOfferIds, sellLocked: v.sellLocked, journal: v.journal, ...(cap !== undefined ? { maxPosition: cap } : {}) };
}
/** Deal capital-call buys expected at the next close (if every due line pays). */
export function expectedCallOrders(c: Career): Order[] {
  const q = c.fund.q + 1; const by: Record<string, number> = {};
  for (const { call, line } of callsDueAt(c, q)) if (call.purpose === 'deal' && call.ticker) by[call.ticker] = (by[call.ticker] ?? 0) + line.amount;
  return Object.entries(by).map(([ticker, amount]) => ({ ticker, amount, ref: 'call' }));
}
/** Orders the constitution will trim, across the combined stream: desk, approved ideas, delegated and deal-call buys. */
export function constitutionIssues(c: Career): string[] {
  const v = validatePlan(c.fund, c.plan).plan;
  return constitutionOrders(c, [...plannedOrders(c, v).map(execOrder), ...expectedCallOrders(c)]).issues;
}
/** Receipts from the last close that were trimmed, partially filled or skipped. */
export function executionNotes(c: Career, q = c.fund.q) {
  return (c.fills ?? []).filter(r => r.q === q && r.side === 'buy' && r.note).map(r => ({ ticker: r.ticker, ref: r.ref, requested: r.requested, filled: r.amount, note: r.note! }));
}

export const isPlanEmpty = (p: QuarterPlan) => !p.orders.length && !p.acceptOfferIds.length && !p.sellLocked && !p.journal.trim();
export const resetPlan = (c: Career): Career => ({ ...c, plan: emptyPlan(c.fund.q) });

export interface FirmLine { label: string; amount: number; basis: 'known' | 'estimate'; note?: string }
export interface QuarterEstimate {
  fund: DueLine[]; fundTotal: number; fundKnown: number; fundIn: FirmLine[];
  firmIn: FirmLine[]; firmOut: FirmLine[]; firmOutTotal: number; firmInTotal: number;
  firmCashNow: number; firmCashAfter: number; founderCashNow: number;
}

/**
 * One estimate for the next n quarters used by every career screen. Fund obligations come from dueBreakdown
 * (known liabilities and schedules, fee and cost accruals at today's mark). Firm lines are the known payroll,
 * office, back pay and founder salary, with fee cash in estimated at today's mark.
 */
export function quarterEstimate(c: Career, n = 1): QuarterEstimate {
  const f = c.fund;
  const fund = dueBreakdown(f, n);
  const fundTotal = fund.reduce((a, b) => a + b.amount, 0);
  const fundKnown = fund.filter(x => x.basis === 'known').reduce((a, b) => a + b.amount, 0);
  const deferredFees = f.ledger.liabilities.filter(x => !x.paid && x.feeRecipient !== 'lender' && (x.kind === 'mgmt_fee' || x.kind === 'perf_fee') && x.dueQ <= f.q + n).reduce((a, b) => a + b.amount, 0);
  const lenderFees = Array.from({ length: n }, (_, k) => managementFee(f.ledger, f.investors, f.clientFees, f.q + k + 1) - managementFee(f.ledger, f.investors, f.clientFees, f.q + k + 1, netAssets(f.ledger), true)).reduce((a, x) => a + x, 0);
  const newFees = fund.filter(x => x.basis === 'estimate' && /fee/i.test(x.label)).reduce((a, b) => a + b.amount, 0) - lenderFees;
  const firmIn: FirmLine[] = [{ label: 'Fee cash from the fund', amount: newFees + deferredFees, basis: 'estimate', note: 'paid only after fund costs and investor payouts' },
    ...staffServiceQuote(c).map(x => ({ label: `${x.name} outside service revenue`, amount: Array.from({ length: n }, (_, k) => staffServiceQuote(c, f.q + k + 1).find(y => y.id === x.id)?.amount ?? 0).reduce((a, b) => a + b, 0), basis: 'estimate' as const })),
    ...c.subsidiaries.map(s => { const qs = Array.from({ length: n }, (_, k) => businessQuarter(s, f.q + 1 + k)); return { label: `${s.name} revenue`, amount: qs.reduce((a, b) => a + b.revenue, 0), basis: 'estimate' as const, note: qs.some(b => b.integrating) ? 'half revenue while integrating' : 'last run rate' }; })];
  const fundIn: FirmLine[] = callsDueAt(c, f.q + 1).map(({ call, line }) => ({ label: `Capital call · ${c.commitments.find(x => x.id === line.commitmentId)?.name ?? 'investor'}${line.status === 'late' ? ' (late, with interest)' : ''}`, amount: line.amount, basis: 'estimate' as const, note: call.purpose === 'deal' && call.ticker ? `buys ${assetName(call.ticker)} on arrival` : 'arrives if the investor pays on time' }));
  fundIn.push(...expectedContributions(c).map(x => ({ label: `${x.name} conditional contribution`, amount: x.amount, basis: 'estimate' as const, note: 'closing NAV; mood/capacity dependent, increases next quarter fee base, never return' })));
  const firmOut: FirmLine[] = [
    ...owedBy(c).map(x => ({ label: x.label, amount: x.amount, basis: 'known' as const, note: 'owed from earlier, paid first' })),
    { label: `Payroll · ${c.roster.length} staff`, amount: payroll(c.roster) * n, basis: 'known' },
    { label: `${c.hq} office`, amount: c.officeQ * n, basis: 'known' },
    { label: 'Your salary', amount: c.founderSalaryQ * n, basis: 'known', note: 'paid last, only if cash remains' },
    ...c.subsidiaries.map(s => ({ label: `${s.name} costs`, amount: Array.from({ length: n }, (_, k) => businessQuarter(s, f.q + 1 + k).cost).reduce((a, b) => a + b, 0), basis: 'known' as const })),
    ...c.subsidiaries.filter(s => s.loan).map(s => ({ label: `${s.name} loan interest and repayment`, amount: Array.from({ length: n }, (_, k) => { const b = businessQuarter(s, f.q + 1 + k, 0, k === 0 ? companyCash(c, s.id) : 0); return b.debtService - b.fromCompany; }).reduce((a, b) => a + b, 0), basis: 'known' as const, note: 'company cash pays first' })),
    ...c.subsidiaries.filter(s => (s.levers?.retainPct ?? 0) > 0).map(s => ({ label: `${s.name} cash kept in the business`, amount: Array.from({ length: n }, (_, k) => businessQuarter(s, f.q + 1 + k).retained).reduce((a, b) => a + b, 0), basis: 'estimate' as const })),
    ...(serviceCostQ(c) > 0 ? [{ label: 'Premium client service', amount: serviceCostQ(c) * n, basis: 'known' as const }] : []),
    ...(managerDebtService(c, f.q + 1) > 0 ? [{ label: 'Manager acquisition interest and principal', amount: Array.from({ length: n }, (_, k) => managerDebtService(c, f.q + k + 1)).reduce((a, x) => a + x, 0), basis: 'known' as const }] : []),
    ...(publicDebtService(c, f.q + 1) > 0 ? [{ label: 'Public corporate interest and principal', amount: Array.from({ length: n }, (_, k) => publicDebtService(c, f.q + k + 1)).reduce((a, x) => a + x, 0), basis: 'known' as const }] : []),
  ];
  const firmOutTotal = firmOut.reduce((a, b) => a + b.amount, 0);
  const firmInTotal = firmIn.reduce((a, b) => a + b.amount, 0);
  const now = firmCash(c);
  return { fund, fundTotal, fundKnown, fundIn, firmIn, firmOut, firmOutTotal, firmInTotal, firmCashNow: now, firmCashAfter: now + firmInTotal - firmOutTotal, founderCashNow: founderCash(c) };
}

// ---------- Firm cash bridge ----------

export const INFLOW: TxnCategory[] = ['opening', 'carryover', 'fee_receipt', 'staff_revenue', 'capital_injection', 'subsidiary_revenue', 'divestiture', 'loan_draw', 'business_distribution'];
export const OPERATING: TxnCategory[] = ['payroll', 'payroll_arrears', 'office', 'bonus', 'event_cost', 'severance', 'salary', 'subsidiary_cost', 'training', 'office_upgrade', 'diligence', 'debt_interest', 'meeting_cost', 'client_service', 'rebrand'];
export const INVESTING: TxnCategory[] = ['acquisition', 'divestiture', 'business_retained', 'business_distribution'];
export const CATEGORY_LABEL: Record<TxnCategory, string> = {
  opening: 'Opening capital', carryover: 'Prior manager earnings carried over', fee_receipt: 'Fees received from the fund',
  staff_revenue: 'Staff outside-client revenue',
  rebrand: 'Company rebranding campaign', expansion: 'Business expansion',
  capital_injection: 'Your capital injections (financing)', payroll: 'Payroll', payroll_arrears: 'Back pay (earlier unpaid wages)', office: 'Office',
  bonus: 'Staff bonuses', event_cost: 'Event costs', severance: 'Severance', salary: 'Founder salary', distribution: 'Distributions to you (owner financing)',
  acquisition: 'Business purchases (investing)', divestiture: 'Business sales (investing)', subsidiary_revenue: 'Subsidiary revenue', subsidiary_cost: 'Subsidiary costs',
  capital_call: 'Capital call funded', call_penalty: 'Late capital call interest',
  purchase: 'Personal purchases', asset_sale: 'Personal asset sales', upkeep: 'Upkeep of possessions', life_cost: 'Life and lifestyle costs',
  training: 'Staff training', office_upgrade: 'Office fit-out', equity_sale: 'Partner equity buy-ins (financing)', partner_distribution: 'Distributions to partners (owner financing)',
  firm_sale: 'Sale of firm equity', transaction_cost: 'Transaction costs',
  diligence: 'Due diligence', loan_draw: 'Acquisition loan drawn (financing)', debt_interest: 'Loan interest', debt_repayment: 'Loan repayments (financing)',
  business_retained: 'Cash kept inside owned businesses', business_distribution: 'Cash paid up from owned businesses', meeting_cost: 'Client meetings and travel',
  client_service: 'Premium client service', equity_secondary: 'Equity bought from partners', equity_buyback: 'Firm buyback of partner equity (financing)',
};

/**
 * Reporting period of a transaction. A period q holds the decisions made while planning quarter q and the close of q.
 * Between-quarter actions are posted with the last closed quarter, so they belong to the next period.
 */
export function periodOf(t: Txn): number {
  const m = t.closeId?.match(/:Q(\d+)$/);
  if (m) return Number(m[1]);
  if ((t.category === 'opening' || t.category === 'carryover') && /^(open|convert):/.test(t.source)) return t.q;
  return t.q + 1;
}

export interface Bridge {
  q: number; label: string; opening: number; inflows: { category: TxnCategory; amount: number }[]; outflows: { category: TxnCategory; amount: number }[];
  operating: number; financingIn: number; financingOut: number; investingNet: number; fees: number; closing: number; unpaid: number; closed: boolean; reconciles: boolean;
}

export function cashBridge(c: Career, entity: 'firm' | 'founder', q: number): Bridge {
  const before = c.journal.txns.filter(t => periodOf(t) < q);
  const inPeriod = c.journal.txns.filter(t => periodOf(t) === q);
  const signed = (t: Txn) => (t.recipient === entity ? t.amount : 0) - (t.payer === entity ? t.amount : 0);
  const opening = before.reduce((a, t) => a + signed(t), 0);
  const sum = (dir: 'in' | 'out') => {
    const m = new Map<TxnCategory, number>();
    for (const t of inPeriod) { const ok = dir === 'in' ? t.recipient === entity : t.payer === entity; if (ok) m.set(t.category, (m.get(t.category) ?? 0) + t.amount); }
    return [...m].map(([category, amount]) => ({ category, amount }));
  };
  const inflows = sum('in'); const outflows = sum('out');
  const tot = (xs: { category: TxnCategory; amount: number }[], cats: TxnCategory[]) => xs.filter(x => cats.includes(x.category)).reduce((a, b) => a + b.amount, 0);
  const closing = opening + inflows.reduce((a, b) => a + b.amount, 0) - outflows.reduce((a, b) => a + b.amount, 0);
  const actual = c.journal.txns.filter(t => periodOf(t) <= q).reduce((a, t) => a + signed(t), 0);
  const snap = c.snapshots.find(s => s.q === q);
  return {
    q, label: q === 0 ? 'Opening' : q > c.fund.q ? `${quarterLabel(c.fund, q)} (in progress)` : quarterLabel(c.fund, q), opening, inflows, outflows,
    operating: tot(outflows, OPERATING), financingIn: tot(inflows, ['capital_injection', 'opening', 'carryover', 'equity_sale', 'loan_draw']), financingOut: tot(outflows, ['distribution', 'partner_distribution', 'debt_repayment', 'equity_buyback']),
    investingNet: tot(inflows, ['divestiture', 'business_distribution']) - tot(outflows, ['acquisition', 'business_retained']),
    fees: tot(inflows, ['fee_receipt']), closing, unpaid: snap?.unpaid ?? 0, closed: q <= c.fund.q, reconciles: Math.abs(closing - actual) < 0.01,
  };
}

/** Bridges for every period from the opening to the quarter in progress. */
export function bridges(c: Career, entity: 'firm' | 'founder' = 'firm'): Bridge[] {
  const first = Math.min(...c.journal.txns.map(periodOf), c.fund.q);
  const out: Bridge[] = [];
  for (let q = first; q <= c.fund.q + 1; q++) {
    const b = cashBridge(c, entity, q);
    if (b.inflows.length || b.outflows.length || q === c.fund.q + 1) out.push(b);
  }
  return out;
}

// ---------- Post-close recap ----------

export interface Recap {
  q: number; label: string; fundReturn: number; benchReturn: number; nav: number; aum: number; fundCash: number;
  feeCash: number; firmOut: { category: TxnCategory; amount: number }[]; firmOutTotal: number; firmEndCash: number;
  founderIn: { category: TxnCategory; amount: number }[]; founderEndCash: number; unpaid: number; salaryChange?: { fromQ: number; toQ: number };
}

export function recapFor(c: Career, q: number): Recap | null {
  const h = c.fund.history.find(x => x.q === q); if (!h) return null;
  const firm = cashBridge(c, 'firm', q); const me = cashBridge(c, 'founder', q);
  const sc = c.salaryHistory.filter(x => x.effectiveQ === q).at(-1);
  // Closing balances at the close: later between-quarter actions belong to the next period.
  return {
    q, label: quarterLabel(c.fund, q), fundReturn: h.ret, benchReturn: h.bench, nav: h.nav, aum: h.aum, fundCash: c.fund.ledger.cash,
    feeCash: firm.fees, firmOut: firm.outflows, firmOutTotal: firm.outflows.reduce((a, b) => a + b.amount, 0), firmEndCash: firm.closing,
    founderIn: me.inflows, founderEndCash: me.closing, unpaid: firm.unpaid, salaryChange: sc ? { fromQ: sc.fromQ, toQ: sc.toQ } : undefined,
  };
}

// ---------- Salary ----------

export const MAX_SALARY_Q = 50e6;
/** Validate a typed quarterly salary. Changes take effect at the next quarter close. */
export function parseSalary(input: string): { ok: true; value: number } | { ok: false; error: string } {
  const clean = input.replace(/[$,\s]/g, '');
  if (!clean) return { ok: false, error: 'Enter an amount.' };
  if (!/^\d+(\.\d+)?$/.test(clean)) return { ok: false, error: 'Use digits only, for example 250000.' };
  const v = Number(clean);
  if (!Number.isFinite(v) || v < 0) return { ok: false, error: 'Salary must be zero or more.' };
  if (v > MAX_SALARY_Q) return { ok: false, error: 'That is above the $50M a quarter limit.' };
  return { ok: true, value: Math.round(v / 1000) * 1000 };
}

// ---------- Fund calculations for "How was this calculated?" ----------

export interface CalcLine { label: string; amount: string; note?: string; total?: boolean }
export function fundCalc(f: FundState, kind: 'aum' | 'nav' | 'return'): CalcLine[] {
  const l = f.ledger; const m = (v: number) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(3)}B` : `$${(v / 1e6).toFixed(2)}M`);
  const positions = Object.entries(l.positions).sort((a, b) => b[1] - a[1]);
  const base: CalcLine[] = [
    { label: 'Cash', amount: m(l.cash) },
    ...positions.map(([t, v]) => ({ label: assetName(t), amount: m(v) })),
    ...(l.locked > 0 ? [{ label: 'Locked legacy holding', amount: m(l.locked) }] : []),
    { label: 'Gross assets', amount: m(grossAssets(l)), total: true },
    { label: 'Less unpaid liabilities (fees, payouts, costs)', amount: `−${m(openLiabilities(l))}` },
    { label: 'Net assets (AUM)', amount: m(netAssets(l)), total: true },
  ];
  if (kind === 'aum') return base;
  const navLines: CalcLine[] = [...base, { label: 'Units outstanding', amount: Math.round(l.units).toLocaleString('en-US') }, { label: 'NAV per unit = net assets ÷ units', amount: nav(l).toFixed(4), total: true }];
  if (kind === 'nav') return navLines;
  return [...navLines, { label: 'Starting NAV per unit', amount: f.startNav.toFixed(4) }, { label: 'Net investor return = NAV ÷ start − 1', amount: `${((nav(l) / f.startNav - 1) * 100).toFixed(2)}%`, total: true, note: 'Deposits and withdrawals change units, not NAV, so they are not profit.' }];
}
