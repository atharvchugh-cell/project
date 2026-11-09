// Public management-company equity is never held by its own client fund.
// Secondary purchases use founder cash; primary issuance funds only the firm.
import { quarterLabel } from '@/lib/fund/engine';
import { type Career, firmCash, founderCash, reserveTarget } from './career';
import { annualProfit, founderPct, ownershipOf, postDistribution, valuation } from './exit';
import { INITIAL_PUBLIC_SHARES, publicDebt, publicRestricted, type PublicBook } from './publicBook';
import { COVENANT_DSCR, loanSchedule } from './business';
import { post } from './journal';
import { payoutCap } from './governance';
import { payOrOwe } from './payables';
import { reputation } from './life';

export const PRIMARY_FEE = 0.06;
export const CORPORATE_RATE_Q = 0.02;
export const CORPORATE_TERM_Q = 12;
type Result = { c: Career; ok: boolean; message: string };
const fail = (c: Career, message: string): Result => ({ c, ok: false, message });
const active = (c: Career) => c.status === 'running' && !c.ending && ownershipOf(c).ipo?.stage === 'listed' && !!c.publicFirm;
const label = (c: Career) => quarterLabel(c.fund, c.fund.q);
const amountOk = (v: number) => Number.isFinite(v) && v > 0.005;

export function newPublicBook(c: Career, listingValue: number): PublicBook {
  return { version: 1, shares: INITIAL_PUBLIC_SHARES, listingPrice: listingValue / INITIAL_PUBLIC_SHARES, primaryRaised: 0, listingFees: 0, sentiment: 0, coverageQ: -1, coverageHeadline: '', loans: [], history: [], personal: { shares: 0, basis: 0, realized: 0, dividends: 0 }, dividendsPerShare: 0 };
}
/** Explicit upgrade of a legacy listing: share denomination only; no cash or equity changes. */
export function enablePublicFirm(c: Career): Result {
  if (c.status !== 'running' || c.ending || ownershipOf(c).ipo?.stage !== 'listed') return fail(c, 'List the management company first.');
  if (c.publicFirm) return fail(c, 'Public management is already enabled.');
  const n = structuredClone(c);
  n.publicFirm = newPublicBook(n, ownershipOf(n).ipo?.price ?? valuation(n).total);
  return { c: n, ok: true, message: 'Public share accounting enabled. All existing cash and ownership are unchanged.' };
}
export function publicQuote(c: Career) {
  const v = valuation(c); const b = c.publicFirm;
  const shares = b?.shares ?? INITIAL_PUBLIC_SHARES;
  return { value: v.total, price: shares > 0 ? v.total / shares : 0, shares, eps: annualProfit(c) / shares, debt: publicDebt(c), founderShares: founderPct(c) * shares };
}
export const publicSpendable = (c: Career) => publicRestricted(c) ? 0 : payoutCap(c, Math.max(0, firmCash(c) - reserveTarget(c) - c.arrears));
export function shareProfit(c: Career) {
  const p = c.publicFirm?.personal ?? { shares: 0, basis: 0, realized: 0, dividends: 0 };
  const price = publicQuote(c).price; const value = p.shares * price;
  return { ...p, price, value, averageCost: p.shares > 0 ? p.basis / p.shares : 0, unrealized: value - p.basis, total: p.realized + p.dividends + value - p.basis };
}
/** Market buys are secondary trades against the existing public float, not invented new equity. */
export function tradePublicShares(c: Career, side: 'buy' | 'sell', shares: number): Result {
  if (!active(c)) return fail(c, 'Enable public share management on a running listed firm.');
  if (!Number.isInteger(shares) || shares <= 0) return fail(c, 'Enter a positive whole number of shares.');
  if (side !== 'buy' && side !== 'sell') return fail(c, 'Choose buy or sell.');
  const b = c.publicFirm; const o = ownershipOf(c); const quote = publicQuote(c);
  const pub = o.holders.find(h => h.id === 'public'); const founder = o.holders.find(h => h.id === 'founder');
  if (!b || !pub || !founder || !amountOk(quote.price)) return fail(c, 'No quoted public float is available.');
  const cost = Math.round(shares * quote.price * 100) / 100;
  if (side === 'buy' && (shares > Math.floor(pub.pct * b.shares + 1e-6) || cost > founderCash(c))) return fail(c, 'Not enough public shares or personal cash.');
  if (side === 'sell' && c.fund.q < (o.ipo?.lockupUntilQ ?? 0)) return fail(c, 'Your founder lockup is still active.');
  if (side === 'sell' && shares > Math.floor(founder.pct * b.shares + 1e-6)) return fail(c, `You own ${Math.floor(founder.pct * b.shares).toLocaleString('en-US')} shares.`);
  const n = structuredClone(c); const nb = n.publicFirm; const no = n.ownership;
  const nf = no?.holders.find(h => h.id === 'founder'); const np = no?.holders.find(h => h.id === 'public');
  if (!nb || !nf || !np) return fail(c, 'Share register unavailable.');
  const fraction = shares / nb.shares;
  if (side === 'buy') { nf.pct += fraction; np.pct -= fraction; nb.personal.shares += shares; nb.personal.basis += cost; }
  else {
    // Bought shares are sold first (their cost basis is released); founder shares have no purchase cost.
    const bought = Math.min(shares, nb.personal.shares); const released = bought > 0 ? nb.personal.basis * bought / nb.personal.shares : 0;
    nf.pct -= fraction; np.pct += fraction; nb.personal.shares -= bought; nb.personal.basis -= released; nb.personal.realized += bought * quote.price - released;
  }
  post(n.journal, { q: n.fund.q, date: label(n), payer: side === 'buy' ? 'founder' : 'external', recipient: side === 'buy' ? 'external' : 'founder', category: 'equity_secondary', amount: cost, source: `public:trade:${n.journal.seq + 1}`, memo: `${side === 'buy' ? 'Bought' : 'Sold'} ${shares.toLocaleString('en-US')} public firm shares at ${quote.price.toFixed(4)}` });
  return { c: n, ok: true, message: `${side === 'buy' ? 'Bought' : 'Sold'} ${shares.toLocaleString('en-US')} shares ${side === 'buy' ? 'with' : 'into'} your personal cash.` };
}
export function publicDividend(c: Career, amount: number): Result {
  if (!active(c)) return fail(c, 'A running public firm is required.');
  if (!amountOk(amount) || amount > publicSpendable(c)) return fail(c, 'Dividend exceeds cash available after reserves, bills and debt restrictions.');
  const n = structuredClone(c); const b = n.publicFirm; if (!b) return fail(c, 'Share register unavailable.');
  const paid = Math.round(amount * 100) / 100;
  postDistribution(n, paid, `public:dividend:${n.journal.seq + 1}`);
  const dps = paid / b.shares; b.dividendsPerShare += dps; b.personal.dividends += dps * b.personal.shares;
  return { c: n, ok: true, message: `Dividend paid to every shareholder. ${dps.toFixed(4)} per share; company cash and ex-dividend value fell by the payout.` };
}
export function publicBuyback(c: Career, shares: number): Result {
  if (!active(c)) return fail(c, 'A running public firm is required.');
  const b = c.publicFirm; const pub = ownershipOf(c).holders.find(h => h.id === 'public');
  const cost = Math.round(shares * publicQuote(c).price * 100) / 100;
  if (!b || !pub || !Number.isInteger(shares) || shares <= 0 || shares > Math.floor(pub.pct * b.shares + 1e-6) || shares >= b.shares || !amountOk(cost) || cost > publicSpendable(c)) return fail(c, 'Choose whole public-float shares affordable above reserves and debt restrictions.');
  const n = structuredClone(c); const nb = n.publicFirm; const no = n.ownership; if (!nb || !no) return fail(c, 'Share register unavailable.');
  const old = nb.shares; const remaining = old - shares;
  for (const h of no.holders) h.pct = Math.max(0, h.pct * old - (h.id === 'public' ? shares : 0)) / remaining;
  nb.shares = remaining;
  post(n.journal, { q: n.fund.q, date: label(n), payer: 'firm', recipient: 'external', category: 'equity_buyback', amount: cost, source: `public:buyback:${n.journal.seq + 1}`, memo: `Repurchased and cancelled ${shares.toLocaleString('en-US')} public shares` });
  return { c: n, ok: true, message: 'Shares cancelled. Outstanding shares and company cash both decreased; remaining ownership percentages increased.' };
}
/** Primary issue: existing owners dilute, gross cash goes to firm, underwriting cost goes out once. */
export function publicIssue(c: Career, amount: number): Result {
  if (!active(c)) return fail(c, 'A running public firm is required.');
  if (c.publicFirm?.loans.some(x => x.restricted)) return fail(c, 'Four debt covenant breaches restrict new financing until the facility is repaid.');
  const price = publicQuote(c).price; const b = c.publicFirm;
  if (!b || !amountOk(amount) || !amountOk(price) || amount > publicQuote(c).value * 0.5) return fail(c, 'Raise a positive amount up to 50% of the current company value.');
  const shares = Math.floor(amount / price); if (shares <= 0) return fail(c, 'Raise enough to issue at least one share.');
  const n = structuredClone(c); const nb = n.publicFirm; const no = n.ownership; const pub = no?.holders.find(h => h.id === 'public'); if (!nb || !no || !pub) return fail(c, 'Share register unavailable.');
  const total = nb.shares + shares; for (const h of no.holders) h.pct *= nb.shares / total; pub.pct += shares / total;
  const gross = Math.round(shares * price * 100) / 100; const fee = Math.round(gross * PRIMARY_FEE * 100) / 100;
  nb.shares = total; nb.primaryRaised += gross; nb.listingFees += fee;
  post(n.journal, { q: n.fund.q, date: label(n), payer: 'external', recipient: 'firm', category: 'equity_sale', amount: gross, source: `public:issue:${n.journal.seq + 1}`, memo: `Issued ${shares.toLocaleString('en-US')} new public shares` });
  post(n.journal, { q: n.fund.q, date: label(n), payer: 'firm', recipient: 'external', category: 'transaction_cost', amount: fee, source: `public:issue-fee:${n.journal.seq + 1}`, memo: 'Primary share underwriting (6%)' });
  return { c: n, ok: true, message: 'New equity funded the firm, less 6% underwriting. All existing owners were diluted.' };
}
export function borrowPublic(c: Career, amount: number): Result {
  if (!active(c)) return fail(c, 'A running public firm is required.');
  const profit = Math.max(0, annualProfit(c)); const service = amount * (CORPORATE_RATE_Q + 1 / CORPORATE_TERM_Q);
  if (!amountOk(amount) || publicRestricted(c) || c.arrears > 0 || amount > profit * 2 || profit / 4 / service < COVENANT_DSCR) return fail(c, 'Lender requires no existing corporate facility or arrears, borrowing below 2x annual profit, and 1.2x quarterly debt coverage.');
  const n = structuredClone(c); const b = n.publicFirm; if (!b) return fail(c, 'Public debt register unavailable.');
  const id = `corporate-${n.journal.seq + 1}`;
  b.loans.push({ id, restricted: false, loan: { principal: amount, balance: amount, rateQ: CORPORATE_RATE_Q, amortQ: amount / CORPORATE_TERM_Q, maturityQ: n.fund.q + CORPORATE_TERM_Q, drawnQ: n.fund.q, lastQ: n.fund.q, breaches: 0, penalty: 0 }, history: [] });
  post(n.journal, { q: n.fund.q, date: label(n), payer: 'external', recipient: 'firm', category: 'loan_draw', amount, source: `public:${id}`, memo: 'Corporate loan: 2% quarterly interest, 12-quarter amortization; owner payouts blocked until repaid' });
  return { c: n, ok: true, message: 'Corporate loan funded. Cash and debt rose equally; dividends and buybacks remain blocked until repaid.' };
}
export function repayPublic(c: Career, amount: number): Result {
  if (!active(c)) return fail(c, 'A running public firm is required.');
  const available = Math.max(0, firmCash(c) - reserveTarget(c) - c.arrears);
  if (!amountOk(amount) || amount > publicDebt(c) + 0.005 || amount > available) return fail(c, 'Repay no more than outstanding principal and cash above bills and reserves.');
  const n = structuredClone(c); let left = Math.round(amount * 100) / 100;
  for (const x of n.publicFirm?.loans ?? []) { const pay = Math.min(left, x.loan.balance); x.loan.balance -= pay; left -= pay; if (x.loan.balance <= 0.005) { x.loan.balance = 0; x.restricted = false; } }
  post(n.journal, { q: n.fund.q, date: label(n), payer: 'firm', recipient: 'external', category: 'debt_repayment', amount, source: `public:repay:${n.journal.seq + 1}`, memo: 'Corporate principal repayment; not an operating expense' });
  return { c: n, ok: true, message: 'Principal repaid. Company cash and debt fell equally.' };
}
export function settlePublicDebt(n: Career, q: number, closeId: string) {
  let owed = 0;
  for (const x of n.publicFirm?.loans ?? []) {
    if (x.loan.balance <= 0.005 || x.loan.drawnQ >= q || x.history.some(h => h.q === q)) continue;
    const s = loanSchedule(x.loan, q);
    const interestOwed = payOrOwe(n, { q, kind: 'subsidiary', category: 'debt_interest', amount: s.interest, memo: 'Public firm corporate interest', source: `${x.id}:${q}:interest`, closeId }).owed;
    const principalOwed = payOrOwe(n, { q, kind: 'subsidiary', category: 'debt_repayment', amount: s.principal, memo: 'Public firm corporate principal', source: `${x.id}:${q}:principal`, closeId }).owed;
    owed += interestOwed + principalOwed;
    // Scheduled principal becomes a payable if unpaid: never both outstanding loan and the same bill.
    x.loan.balance = Math.max(0, s.balance - s.principal); x.loan.lastQ = q;
    const period = n.journal.txns.filter(t => t.closeId === closeId);
    const income = period.filter(t => t.recipient === 'firm' && ['fee_receipt', 'staff_revenue', 'subsidiary_revenue'].includes(t.category)).reduce((a, t) => a + t.amount, 0);
    const operating = period.filter(t => t.payer === 'firm' && ['payroll', 'office', 'subsidiary_cost', 'salary', 'client_service'].includes(t.category)).reduce((a, t) => a + t.amount, 0);
    const dscr = Math.max(0, income - operating - n.founderSalaryQ) / s.debtService;
    x.loan.breaches = dscr < COVENANT_DSCR || interestOwed + principalOwed > 0.005 ? x.loan.breaches + 1 : 0;
    x.loan.penalty = x.loan.breaches >= 2 ? 0.005 : 0; x.restricted = x.loan.breaches >= 4;
    x.history.push({ q, interest: s.interest, principal: s.principal, owed: interestOwed + principalOwed, dscr });
    if (x.loan.breaches === 2 || x.loan.breaches === 4) n.notices.push({ q, from: 'Corporate lender', subject: 'Public firm debt covenant breached', body: `${dscr.toFixed(2)}x coverage versus 1.2x. Default interest is +0.5% quarterly after two breaches; four breaches restrict new financing. Client assets cannot be seized. All unpaid amounts stay owed.`, tone: 'bad' });
  }
  return owed;
}
/** Called after final closing flows; one saved quote per close, never future prices. */
export function markPublicClose(n: Career) {
  const b = n.publicFirm; if (!b || b.history.some(h => h.q === n.fund.q)) return;
  const quote = publicQuote(n);
  b.history.push({ q: n.fund.q, shares: quote.shares, price: quote.price, value: quote.value, eps: quote.eps, sentiment: b.sentiment, reputation: reputation(n).score, dividendPerShare: b.dividendsPerShare });
  const edition = n.press.find(e => e.q === n.fund.q);
  if (edition) edition.stories.push({ kind: 'public', headline: `${n.firmName} closed at $${quote.price.toFixed(4)} per share`, body: `${b.coverageHeadline} Sentiment ${b.sentiment >= 0 ? '+' : ''}${b.sentiment}/10; reputation ${reputation(n).score}/100. Equity value $${(quote.value / 1e6).toFixed(2)}M, ${quote.shares.toLocaleString('en-US')} shares and trailing earnings $${quote.eps.toFixed(4)} per share. Client fund returns and historical ticker prices are separate.`, tone: b.sentiment > 0 ? 'good' : b.sentiment < 0 ? 'bad' : 'neutral' });
}
export const SPLIT_RATIOS = [2, 3, 5, 10] as const;
/** Stock split: every holder gets more shares at a proportionally lower price; value and cash are unchanged. */
export function splitPublicShares(c: Career, ratio: number): Result {
  if (!active(c)) return fail(c, 'A running public firm is required.');
  if (!(SPLIT_RATIOS as readonly number[]).includes(ratio)) return fail(c, 'Choose a 2, 3, 5 or 10 for 1 split.');
  const last = c.publicFirm?.splits?.at(-1);
  if (last && c.fund.q - last.q < 4) return fail(c, 'Shareholders allow one split a year.');
  const n = structuredClone(c); const b = n.publicFirm!;
  b.shares *= ratio; b.personal.shares *= ratio; b.listingPrice /= ratio; b.dividendsPerShare /= ratio;
  for (const h of b.history) { h.shares *= ratio; h.price /= ratio; h.eps /= ratio; h.dividendPerShare /= ratio; }
  // A cheaper share widens the buyer base: a small, one-off lift in coverage.
  b.sentiment = Math.min(10, b.sentiment + 1);
  (b.splits ??= []).push({ q: n.fund.q, ratio });
  return { c: n, ok: true, message: `${ratio}-for-1 split done. ${b.shares.toLocaleString('en-US')} shares now trade at about $${publicQuote(n).price.toFixed(2)}.` };
}
