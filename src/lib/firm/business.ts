// Owned operating businesses: one projection (businessQuarter) used by estimates, the forecast and the close,
// operating levers with delayed effects, acquisition loans, saved quarterly statements and exits.
// Firm-owned only. A business's own cash ("company cash") lives in the journal under its entity id and is
// built only from cash the firm chose to retain there; it pays that business's loan first.
import { quarterLabel } from '@/lib/fund/engine';
import { mulberry32 } from '@/lib/fund/market';
import type { Career } from './career';
import { balance, post, type TxnCategory } from './journal';
import { payOrOwe } from './payables';
import type { Subsidiary, SubsidiaryKind } from './phase3';

export interface Statement {
  q: number; label: string; revenue: number; cost: number; ebitda: number; debtService: number; retained: number; toFirm: number;
  cash: number; debt: number; value: number;
  /** Accrued loan interest, including unpaid interest; principal is never a profit expense. */ interest?: number;
  /** Actually posted at the close (real quarters only): scheduled amounts above, paid/owed here. */
  actual?: { revenue: number; costPaid: number; costOwed: number; interestPaid: number; principalPaid: number; debtOwed: number; fromCompanyCash: number; retainedPaid: number; toFirm: number };
  /** true = fictional pre-acquisition history generated for the dossier, not real company data. */ simulated: boolean;
}
export interface Loan { principal: number; balance: number; rateQ: number; amortQ: number; maturityQ: number; drawnQ: number; lastQ: number; breaches: number; penalty: number }
export interface RefinanceRecord { id: string; q: number; old: Loan; replacement: Loan; payoff: number; fee: number }
/** Shared business/manager facility schedule. Forecast assumes scheduled principal is paid. */
export function loanSchedule(l: Loan, q: number) {
  const balance = Math.max(0, l.balance - l.amortQ * Math.max(0, q - l.lastQ - 1));
  const interest = balance * (l.rateQ + l.penalty);
  const principal = q >= l.maturityQ ? balance : Math.min(balance, l.amortQ);
  return { balance, interest, principal, debtService: interest + principal };
}
export interface Levers { price: -1 | 0 | 1; capacity: number; reinvestPct: number; retainPct: number; changedQ: Record<string, number> }
export interface Effect { q: number; revenue: number; cost: number; note: string; applied?: boolean }
export interface OneOff { q: number; amount: number; note: string }
export interface FormerBusiness { id: string; name: string; kind: SubsidiaryKind; acquiredQ: number; endedQ: number; how: 'sold' | 'closed' | 'foreclosed'; price: number; proceeds: number; debtRepaid: number; history: Statement[]; lines: { label: string; value: number }[] }

export const INDUSTRY: Record<SubsidiaryKind, { label: string; price: string; capacity: string; churn: number; lift: number }> = {
  adviser: { label: 'Wealth advice', price: 'Advisory fee schedule', capacity: 'Client advisers', churn: 0.05, lift: 0.06 },
  research: { label: 'Equity research subscriptions', price: 'Subscription price', capacity: 'Analysts', churn: 0.03, lift: 0.07 },
  admin: { label: 'Fund administration', price: 'Service pricing', capacity: 'Operations staff', churn: 0.02, lift: 0.04 },
  fintech: { label: 'Financial software', price: 'Subscription pricing', capacity: 'Product developers', churn: 0.06, lift: 0.09 },
  hospitality: { label: 'Hotels and resorts', price: 'Room and event pricing', capacity: 'Hospitality teams', churn: 0.07, lift: 0.08 },
  marina: { label: 'Marinas and marine services', price: 'Berth and service pricing', capacity: 'Marine service crews', churn: 0.04, lift: 0.06 },
};

export const COVENANT_DSCR = 1.2;
export const LOAN_RATE_Q = 0.02;
export const LOAN_TERM_Q = 12;
export const MAX_LTV = 0.6;

const lbl = (c: Career, q: number) => (q > 0 ? quarterLabel(c.fund, q) : 'Opening');
const m = (v: number) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const leversOf = (s: Subsidiary): Levers => s.levers ?? { price: 0, capacity: 0, reinvestPct: 0, retainPct: 0, changedQ: {} };
/** Cash the firm kept inside the business (retained) less what the business paid or sent up. Revenue and costs settle through the firm. */
export const companyCash = (c: Career, id: string) => {
  const own = c.journal.txns.filter(t => (t.payer === id || t.recipient === id) && t.category !== 'subsidiary_revenue' && t.category !== 'subsidiary_cost');
  return Math.max(0, own.reduce((a, t) => a + (t.recipient === id ? t.amount : 0) - (t.payer === id ? t.amount : 0), 0));
};
void balance;

/** First two quarters after purchase run at half revenue while the business is integrated; then normal operation. */
export const integrationFactor = (s: Subsidiary, q: number) => (q - s.acquiredQ <= 2 ? 0.5 : 1);
export const swingOf = (s: Subsidiary, r: number) => Math.max(0.2, s.kind === 'adviser' ? 1 + r * 0.8 : s.kind === 'admin' ? 1 + r * 0.1 : 1);

/** Loan balance before the payment due at the close of quarter q (straight-line amortization, balloon at maturity). */
export function loanBalanceAt(s: Subsidiary, q: number): number {
  const l = s.loan; if (!l || l.balance <= 0.5) return 0;
  return loanSchedule(l, q).balance;
}

export interface BusinessQuarter {
  active: boolean; integrating: boolean; revenue: number; cost: number; ebitda: number;
  interest: number; principal: number; debtService: number; fromCompany: number; retained: number; net: number;
}
const ZERO: BusinessQuarter = { active: false, integrating: false, revenue: 0, cost: 0, ebitda: 0, interest: 0, principal: 0, debtService: 0, fromCompany: 0, retained: 0, net: 0 };

/**
 * One business's cash at the close of quarter q, the single projection used by quarterEstimate, cashForecast, the
 * dossier and settlement. `marketReturn` is the completed S&P quarter at settlement and 0 in projections.
 * `companyCash` (cash retained inside the business) pays its loan first. `net` is what reaches or leaves firm cash.
 */
export function businessQuarter(s: Subsidiary, q: number, marketReturn = 0, cashInside = 0, revenueOverride?: number): BusinessQuarter {
  if (s.acquiredQ >= q) return ZERO;
  const lv = leversOf(s);
  const due = (s.effects ?? []).filter(e => !e.applied && e.q <= q);
  const revMult = due.reduce((a, e) => a * (1 + e.revenue), 1); const costMult = due.reduce((a, e) => a * (1 + e.cost), 1);
  const f = integrationFactor(s, q);
  const campaign = s.brandCampaign && q >= s.brandCampaign.fromQ && q <= s.brandCampaign.untilQ ? 1 + s.brandCampaign.lift : 1;
  const revenue = revenueOverride ?? s.revenueQ * revMult * f * swingOf(s, marketReturn) * campaign;
  const oneOff = (s.oneOffs ?? []).filter(o => o.q === q).reduce((a, o) => a + o.amount, 0);
  const cost = s.costQ * costMult + revenue * lv.reinvestPct + oneOff;
  const ebitda = revenue - cost;
  const bal = loanBalanceAt(s, q); const l = s.loan;
  const interest = l && bal > 0 ? loanSchedule(l, q).interest : 0;
  const principal = l && bal > 0 ? loanSchedule(l, q).principal : 0;
  const debtService = interest + principal;
  const fromCompany = Math.min(Math.max(0, cashInside), debtService);
  const retained = Math.max(0, ebitda - debtService) * lv.retainPct;
  return { active: true, integrating: f < 1, revenue, cost, ebitda, interest, principal, debtService, fromCompany, retained, net: revenue - cost - (debtService - fromCompany) - retained };
}

/** Business valuation: run-rate operating profit x 4 x purchase multiple (never negative). */
export const enterpriseValue = (s: Subsidiary) => Math.max(0, (s.revenueQ - s.costQ) * 4 * s.multiple);

/** Fictional pre-acquisition history (8 quarters), deterministic per business id. Not real company data. */
export function prehistory(id: string, kind: SubsidiaryKind, revenueQ: number, costQ: number, multiple: number, debt = 0): Statement[] {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = mulberry32(h || 7); const g = -0.01 + r() * 0.04; const ratio = costQ / Math.max(1, revenueQ);
  let cash = revenueQ * (0.3 + r() * 0.4);
  const out: Statement[] = [];
  for (let k = 8; k >= 1; k--) {
    const revenue = revenueQ / Math.pow(1 + g, k) * (1 + (r() - 0.5) * 0.06);
    const cost = revenue * Math.min(0.97, Math.max(0.3, ratio + (r() - 0.5) * 0.04));
    const ebitda = revenue - cost; const toFirm = ebitda * 0.7; cash = Math.max(0, cash + ebitda - toFirm);
    out.push({ q: -k, label: `${k} quarter${k > 1 ? 's' : ''} before`, revenue, cost, ebitda, debtService: 0, retained: ebitda - toFirm, toFirm, cash, debt, value: Math.max(0, ebitda * 4 * multiple), simulated: true });
  }
  void kind;
  return out;
}

type R = { c: Career; ok: boolean; message: string };
const fail = (c: Career, message: string): R => ({ c, ok: false, message });

export type LeverId = 'price' | 'capacity' | 'reinvest' | 'retain';
export const LEVER_COOLDOWN = 4;
/** Change one operating lever. Effects are delayed and saved as dated effects, so projections, estimates and the close agree. */
export function setLever(c: Career, id: string, lever: LeverId, value: number): R {
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  const s0 = c.subsidiaries.find(x => x.id === id); if (!s0) return fail(c, 'You do not own that business.');
  if (!fin(value)) return fail(c, 'Choose a valid setting.');
  const lv0 = leversOf(s0); const last = lv0.changedQ[lever];
  if (lever !== 'retain' && last !== undefined && c.fund.q - last < LEVER_COOLDOWN) return fail(c, `This lever can change again in ${LEVER_COOLDOWN - (c.fund.q - last)} quarter(s).`);
  const n: Career = structuredClone(c); const s = n.subsidiaries.find(x => x.id === id)!;
  const lv = { ...leversOf(s), changedQ: { ...leversOf(s).changedQ } }; s.effects ??= []; s.oneOffs ??= [];
  const q = n.fund.q; const ind = INDUSTRY[s.kind];
  let msg = '';
  if (lever === 'price') {
    if (![-1, 0, 1].includes(value) || value === lv.price) return fail(c, 'Choose a different pricing level.');
    const step = value - lv.price;
    if (step > 0) { s.effects.push({ q: q + 1, revenue: ind.lift, cost: 0, note: 'Higher prices' }, { q: q + 3, revenue: -ind.churn - 0.01, cost: 0, note: 'Some customers leave over price' }); msg = `Prices up: revenue +${(ind.lift * 100).toFixed(0)}% from next quarter, then about ${((ind.churn + 0.01) * 100).toFixed(0)}% churn in three quarters.`; }
    else { s.effects.push({ q: q + 1, revenue: -ind.lift * 0.7, cost: 0, note: 'Lower prices' }, { q: q + 3, revenue: ind.lift * 1.2, cost: 0.02, note: 'More customers, more service work' }); msg = 'Prices down: revenue dips next quarter, then grows as volume arrives; service costs rise a little.'; }
    lv.price = value as -1 | 0 | 1;
  } else if (lever === 'capacity') {
    if (!(value === 1 || value === -1)) return fail(c, 'Hire or cut one team at a time.');
    if (value < 0 && lv.capacity <= -2) return fail(c, 'There is no more capacity to cut without closing the business.');
    if (value > 0) { s.effects.push({ q: q + 1, revenue: 0, cost: 0.1, note: `More ${ind.capacity.toLowerCase()}` }, { q: q + 3, revenue: 0.12, cost: 0, note: 'New capacity is productive' }); s.oneOffs.push({ q: q + 1, amount: s.costQ * 0.05, note: 'Recruiting fees' }); msg = 'Hiring: costs +10% and recruiting fees next quarter; revenue +12% from three quarters out.'; }
    else { s.effects.push({ q: q + 1, revenue: 0, cost: -0.1, note: 'Smaller team' }, { q: q + 2, revenue: -0.08, cost: 0, note: 'Less capacity to serve customers' }); s.oneOffs.push({ q: q + 1, amount: s.costQ * 0.1, note: 'Severance' }); msg = 'Cutting: severance next quarter, costs -10%, revenue -8% from two quarters out.'; }
    lv.capacity += value;
  } else if (lever === 'reinvest') {
    if (![0, 0.05, 0.1, 0.2].includes(value)) return fail(c, 'Choose 0%, 5%, 10% or 20% of revenue.');
    if (value > lv.reinvestPct) s.effects.push({ q: q + 3, revenue: (value - lv.reinvestPct) * 0.9, cost: 0, note: 'Reinvestment pays off' });
    lv.reinvestPct = value; msg = `Reinvesting ${(value * 100).toFixed(0)}% of revenue each quarter. Growth from it arrives three quarters later.`;
  } else {
    if (![0, 0.25, 0.5, 1].includes(value)) return fail(c, 'Choose 0%, 25%, 50% or 100% of cash after debt.');
    lv.retainPct = value; msg = value ? `The business keeps ${(value * 100).toFixed(0)}% of its cash after debt service; it pays its own loan first.` : 'All cash after debt service goes up to the firm.';
  }
  lv.changedQ[lever] = q; s.levers = lv;
  n.notices.push({ q, from: s.name, subject: 'Operating change', body: msg, tone: 'neutral' });
  return { c: n, ok: true, message: msg };
}

/** Send company cash up to the firm, keeping one quarter of its costs and debt service inside. */
export function distributeCompanyCash(c: Career, id: string): R {
  const s = c.subsidiaries.find(x => x.id === id); if (!s) return fail(c, 'You do not own that business.');
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  const keep = s.costQ + businessQuarter(s, c.fund.q + 1).debtService;
  const amt = companyCash(c, id) - keep;
  if (!(amt > 1000)) return fail(c, `The business keeps ${m(keep)} for a quarter of costs and debt; nothing above that to send.`);
  const n: Career = structuredClone(c);
  post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: id, recipient: 'firm', category: 'business_distribution', amount: amt, source: `bizdist:${id}:${n.fund.q}:${n.journal.seq}`, memo: `${s.name} paid cash up to the firm` });
  return { c: n, ok: true, message: `${m(amt)} moved to firm cash.` };
}

/** Apply effects dated for this close to the run rates (saved), so later projections start from the new base. */
export function applyDueEffects(s: Subsidiary, q: number) {
  for (const e of (s.effects ?? []).filter(x => !x.applied && x.q <= q)) { s.revenueQ *= 1 + e.revenue; s.costQ *= 1 + e.cost; e.applied = true; }
}

/** Pay a business's bills at close: costs, then debt (company cash first, then firm, unpaid stays owed), retain cash, save a statement. */
export function settleBusiness(n: Career, s: Subsidiary, q: number, marketReturn: number, closeId: string): { owed: number; foreclosed: boolean } {
  const cash0 = companyCash(n, s.id);
  // Revenue is what was actually posted at this close (run rate already updated after posting).
  const b = businessQuarter(s, q, marketReturn, cash0, s.postedRevenue?.q === q ? s.postedRevenue.amount : undefined);
  let owed = 0;
  const src = `close:Q${q}`;
  const costOwed = payOrOwe(n, { q, kind: 'subsidiary', category: 'subsidiary_cost', amount: b.cost, memo: `${s.name} staff and costs`, source: `${src}:${s.id}`, closeId }).owed;
  owed += costOwed;
  let foreclosed = false; let interestPaid = 0, principalPaid = 0, debtOwed = 0, fromCompanyCash = 0, retainedPaid = 0;
  if (s.loan && b.debtService > 0) {
    const l = s.loan;
    let fromCo = b.fromCompany; const payCo = (amount: number, category: TxnCategory, memo: string) => { const x = Math.min(fromCo, amount); if (x > 0.005) post(n.journal, { q, date: lbl(n, q), payer: s.id, recipient: 'external', category, amount: x, source: `${src}:${s.id}:co:${category}`, memo, closeId }); fromCo -= x; return x; };
    const ci = payCo(b.interest, 'debt_interest', `${s.name} loan interest (from company cash)`);
    const cp = payCo(b.principal, 'debt_repayment', `${s.name} loan repayment (from company cash)`);
    const io = payOrOwe(n, { q, kind: 'subsidiary', category: 'debt_interest', amount: b.interest - ci, memo: `${s.name} loan interest`, source: `${src}:${s.id}:int`, closeId }).owed;
    const po = payOrOwe(n, { q, kind: 'subsidiary', category: 'debt_repayment', amount: b.principal - cp, memo: `${s.name} loan repayment`, source: `${src}:${s.id}:prin`, closeId }).owed;
    owed += io + po; debtOwed = io + po; fromCompanyCash = ci + cp;
    interestPaid = b.interest - io; principalPaid = b.principal - po;
    // The scheduled principal leaves the loan; any unpaid part is still owed to the lender as an itemized payable.
    l.balance = Math.max(0, loanBalanceAt(s, q) - b.principal); l.lastQ = q;
    const dscr = b.ebitda / b.debtService;
    if (dscr < COVENANT_DSCR) {
      l.breaches += 1;
      if (l.breaches === 2) { l.penalty = 0.005; n.notices.push({ q, from: 'Lender', subject: `${s.name} breached its loan covenant`, body: `Operating profit covered debt service only ${dscr.toFixed(2)}x (covenant ${COVENANT_DSCR}x) for two quarters. Default interest of 0.5% a quarter now applies. Four quarters in a row and we take the business.`, tone: 'bad' }); }
      if (l.breaches >= 4) foreclosed = true;
    } else { l.breaches = 0; l.penalty = 0; }
    if (l.balance <= 0.5) { n.notices.push({ q, from: 'Lender', subject: `${s.name} loan repaid`, body: 'The acquisition loan is fully repaid.', tone: 'good' }); s.loan = undefined; }
  }
  if (b.retained > 0.5 && !foreclosed) {
    const amt = Math.min(b.retained, Math.max(0, balance(n.journal, 'firm')));
    if (amt > 0.5) { post(n.journal, { q, date: lbl(n, q), payer: 'firm', recipient: s.id, category: 'business_retained', amount: amt, source: `${src}:${s.id}:keep`, memo: `${s.name} keeps cash for working capital`, closeId }); retainedPaid = amt; }
  }
  const posted = s.postedRevenue?.q === q ? s.postedRevenue.amount : b.revenue;
  const firmDebtPaid = interestPaid + principalPaid - fromCompanyCash;
  const actual = { revenue: posted, costPaid: b.cost - costOwed, costOwed, interestPaid, principalPaid, debtOwed, fromCompanyCash, retainedPaid, toFirm: posted - (b.cost - costOwed) - firmDebtPaid - retainedPaid };
  (s.history ??= []).push({ q, label: lbl(n, q), revenue: b.revenue, cost: b.cost, ebitda: b.ebitda, interest: b.interest, debtService: b.debtService, retained: b.retained, toFirm: b.net, cash: companyCash(n, s.id), debt: s.loan?.balance ?? 0, value: enterpriseValue(s), simulated: false, actual });
  if (foreclosed) foreclose(n, s, q);
  return { owed, foreclosed };
}

function archive(n: Career, s: Subsidiary, how: FormerBusiness['how'], price: number, proceeds: number, debtRepaid: number, lines: FormerBusiness['lines']) {
  (n.formerBusinesses ??= []).push({ id: s.id, name: s.name, kind: s.kind, acquiredQ: s.acquiredQ, endedQ: n.fund.q, how, price, proceeds, debtRepaid, history: s.history ?? [], lines });
  n.subsidiaries = n.subsidiaries.filter(x => x.id !== s.id);
  const e = n.entities.find(x => x.id === s.id); if (e) e.ownerId = 'external';
}

/** The lender takes the business in place of the remaining loan. Company cash goes with it; bills already owed stay owed. */
function foreclose(n: Career, s: Subsidiary, q: number) {
  const bal = s.loan?.balance ?? 0; const cash = companyCash(n, s.id);
  if (cash > 0.5) post(n.journal, { q, date: lbl(n, q), payer: s.id, recipient: 'external', category: 'debt_repayment', amount: cash, source: `foreclose:${s.id}:cash`, memo: `${s.name} cash taken by the lender` });
  archive(n, s, 'foreclosed', s.price, 0, bal, [{ label: 'Loan balance taken with the business', value: bal }, { label: 'Company cash taken by the lender', value: cash }, { label: 'Proceeds to the firm', value: 0 }]);
  n.notices.push({ q, from: 'Lender', subject: `${s.name} foreclosed`, body: `After four quarters below the covenant the lender took ${s.name} for its ${m(bal)} loan. The firm receives nothing; any bills already owed remain owed.`, tone: 'bad' });
}

export const SALE_DISCOUNT = 0.9;
export const BIZ_SALE_COST = 0.02;
/** Sale waterfall: price (90% of value) + company cash − loan payoff − 2% costs. Negative equity is paid by the firm, never free. */
export function saleWaterfall(c: Career, s: Subsidiary) {
  const price = enterpriseValue(s) * SALE_DISCOUNT; const cash = companyCash(c, s.id); const debt = loanBalanceAt(s, c.fund.q + 1);
  const owedBills = c.payables.filter(p => p.label.startsWith(s.name)).reduce((a, p) => a + p.amount, 0);
  const costs = price * BIZ_SALE_COST; const equity = price + cash - debt - costs;
  return { price, cash, debt, costs, owedBills, equity, lines: [
    { label: 'Buyer pays (90% of value)', value: price }, { label: '+ Cash inside the business', value: cash },
    { label: '− Loan payoff', value: -debt }, { label: '− Bankers and lawyers (2%)', value: -costs }, { label: 'Equity to the firm', value: equity },
    ...(owedBills > 0 ? [{ label: 'Bills of this business still owed by the firm (unchanged)', value: -owedBills }] : []),
  ] };
}

export function sellBusiness(c: Career, id: string): R {
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  const s0 = c.subsidiaries.find(x => x.id === id); if (!s0) return fail(c, 'You no longer own that business.');
  if (s0.acquiredQ >= c.fund.q) return fail(c, 'You can sell after its first close.');
  const w = saleWaterfall(c, s0);
  if (w.price <= 0 && w.cash <= 0) return fail(c, 'No buyer will pay for a business with no operating profit. You can close it instead.');
  const n: Career = structuredClone(c); const s = n.subsidiaries.find(x => x.id === id)!; const q = n.fund.q; const src = `sell:${id}:${q}`;
  post(n.journal, { q, date: lbl(n, q), payer: 'external', recipient: 'firm', category: 'divestiture', amount: w.price, source: src, memo: `Sold ${s.name}` });
  if (w.cash > 0.5) post(n.journal, { q, date: lbl(n, q), payer: id, recipient: 'firm', category: 'business_distribution', amount: w.cash, source: `${src}:cash`, memo: `${s.name} cash returned at sale` });
  if (w.debt > 0.5) payOrOwe(n, { q, kind: 'subsidiary', category: 'debt_repayment', amount: w.debt, memo: `${s.name} loan payoff at sale`, source: `${src}:debt` });
  payOrOwe(n, { q, kind: 'event', category: 'transaction_cost', amount: w.costs, memo: `${s.name} sale costs`, source: `${src}:cost` });
  archive(n, s, 'sold', s.price, w.equity, w.debt, w.lines);
  n.notices.push({ q, from: 'Chief operating officer', subject: `${s.name} sold`, body: `Buyer paid ${m(w.price)}; after cash, loan payoff and costs the firm nets ${m(w.equity)}.`, tone: w.equity >= 0 ? 'neutral' : 'bad' });
  return { c: n, ok: true, message: `Sold ${s.name}. Net to the firm ${m(w.equity)}.` };
}

/** Wind down: pay severance (one quarter of costs) and the loan; company cash comes back first. */
export function closeBusiness(c: Career, id: string): R {
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  const s0 = c.subsidiaries.find(x => x.id === id); if (!s0) return fail(c, 'You no longer own that business.');
  const n: Career = structuredClone(c); const s = n.subsidiaries.find(x => x.id === id)!; const q = n.fund.q; const src = `close-biz:${id}:${q}`;
  const cash = companyCash(n, id); const debt = loanBalanceAt(s, q + 1); const sev = s.costQ;
  if (cash > 0.5) post(n.journal, { q, date: lbl(n, q), payer: id, recipient: 'firm', category: 'business_distribution', amount: cash, source: `${src}:cash`, memo: `${s.name} cash returned on closure` });
  payOrOwe(n, { q, kind: 'severance', category: 'severance', amount: sev, memo: `${s.name} severance and wind-down`, source: `${src}:sev` });
  if (debt > 0.5) payOrOwe(n, { q, kind: 'subsidiary', category: 'debt_repayment', amount: debt, memo: `${s.name} loan payoff on closure`, source: `${src}:debt` });
  archive(n, s, 'closed', s.price, cash - sev - debt, debt, [{ label: 'Cash returned', value: cash }, { label: '− Severance and wind-down', value: -sev }, { label: '− Loan payoff', value: -debt }, { label: 'Net to the firm', value: cash - sev - debt }]);
  n.notices.push({ q, from: 'Chief operating officer', subject: `${s.name} closed`, body: `Severance ${m(sev)}${debt ? ` and loan payoff ${m(debt)}` : ''}. Its history is kept in the archive.`, tone: 'neutral' });
  return { c: n, ok: true, message: `Closed ${s.name}.` };
}

export const businessDebt = (c: Pick<Career, 'subsidiaries'>) => c.subsidiaries.reduce((a, s) => a + (s.loan?.balance ?? 0), 0);

export const EXPAND_COOLDOWN = 4;
/** One-off cost of opening a new location: one quarter of current revenue. Paid from cash inside the business first, then firm cash. */
export const expansionCostOf = (s: Subsidiary) => Math.max(0, s.revenueQ);
/** Expand operations: a dated cost rise next quarter and a revenue rise two quarters out, saved as effects so forecasts and the close agree. */
export function expandBusiness(c: Career, id: string): R {
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  const s0 = c.subsidiaries.find(x => x.id === id); if (!s0) return fail(c, 'You do not own that business.');
  const last = leversOf(s0).changedQ.expand;
  if (last !== undefined && c.fund.q - last < EXPAND_COOLDOWN) return fail(c, `You can expand again in ${EXPAND_COOLDOWN - (c.fund.q - last)} quarter(s).`);
  const cost = expansionCostOf(s0); const inside = companyCash(c, id); const fromInside = Math.min(inside, cost); const fromFirm = cost - fromInside;
  if (fromFirm > balance(c.journal, 'firm')) return fail(c, `Expanding costs ${m(cost)}; the business has ${m(inside)} and firm cash is short.`);
  const n: Career = structuredClone(c); const s = n.subsidiaries.find(x => x.id === id)!; const q = n.fund.q;
  if (fromInside > 0) post(n.journal, { q, date: lbl(n, q), payer: id, recipient: 'external', category: 'expansion', amount: fromInside, source: `expand:${id}:${q}:inside`, memo: `${s.name} expansion (company cash)` });
  if (fromFirm > 0) post(n.journal, { q, date: lbl(n, q), payer: 'firm', recipient: 'external', category: 'expansion', amount: fromFirm, source: `expand:${id}:${q}:firm`, memo: `${s.name} expansion` });
  s.effects ??= []; s.effects.push({ q: q + 1, revenue: 0, cost: 0.15, note: 'New location staffing' }, { q: q + 2, revenue: 0.25, cost: 0, note: 'New location opens' });
  const lv = { ...leversOf(s), changedQ: { ...leversOf(s).changedQ, expand: q } }; s.levers = lv;
  const msg = `${s.name} is expanding for ${m(cost)}: costs +15% next quarter, revenue +25% from two quarters out.`;
  n.notices.push({ q, from: s.name, subject: 'Expansion', body: msg, tone: 'neutral' });
  return { c: n, ok: true, message: msg };
}
