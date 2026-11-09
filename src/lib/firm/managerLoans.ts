import type { Career } from './career';
import { feeRate } from '@/lib/fund/clientFees';
import { COVENANT_DSCR, loanSchedule, type Loan } from './business';
import { payOrOwe } from './payables';

export interface ManagerFacility { id: string; name: string; investorId: string; acquiredQ: number; margin: number; loan: Loan; foreclosedQ?: number; history: { q: number; earnings: number; interest: number; principal: number; paid: number; owed: number; dscr: number; balance: number }[] }
export function managerEarnings(c: Career, x: ManagerFacility) {
  const inv = c.fund.investors.find(i => i.id === x.investorId);
  // The covenant sees actual paid management receipts for this mandate, never invented fee revenue.
  const charges = c.fund.clientFees?.charges.filter(f => f.investorId === x.investorId && f.q === c.fund.q) ?? [];
  if (charges.length) return charges.reduce((a, f) => a + (c.fund.ledger.liabilities.find(l => l.id === f.liabilityId)?.paid ? f.amount : 0), 0) * x.margin;
  const paid = c.fund.ledger.liabilities.filter(l => l.kind === 'mgmt_fee' && l.dueQ === c.fund.q && l.paid && l.feeRecipient !== 'lender').reduce((a, l) => a + l.amount, 0);
  return paid * (c.fund.ledger.units > 0 ? (inv?.units ?? 0) / c.fund.ledger.units : 0) * x.margin;
}
export function managerDebtService(c: Pick<Career, 'managerFacilities'>, q: number) {
  return (c.managerFacilities ?? []).filter(x => x.foreclosedQ === undefined).reduce((a, x) => a + loanSchedule(x.loan, q).debtService, 0);
}
export function settleManagerLoans(n: Career, q: number, closeId: string) {
  let owed = 0;
  for (const x of n.managerFacilities ?? []) {
    if (x.foreclosedQ !== undefined || x.acquiredQ >= q || x.history.some(h => h.q === q)) continue;
    const b = loanSchedule(x.loan, q); if (!(b.debtService > 0)) continue;
    const earnings = managerEarnings(n, x);
    const io = payOrOwe(n, { q, kind: 'subsidiary', category: 'debt_interest', amount: b.interest, memo: `${x.name} manager acquisition interest`, source: `manager:${x.id}:${q}:interest`, closeId }).owed;
    const po = payOrOwe(n, { q, kind: 'subsidiary', category: 'debt_repayment', amount: b.principal, memo: `${x.name} manager acquisition principal`, source: `manager:${x.id}:${q}:principal`, closeId }).owed;
    owed += io + po;
    const dscr = earnings / b.debtService;
    x.loan.balance = Math.max(0, b.balance - b.principal); x.loan.lastQ = q;
    if (dscr < COVENANT_DSCR) { x.loan.breaches++; if (x.loan.breaches >= 2) x.loan.penalty = 0.005; }
    else { x.loan.breaches = 0; x.loan.penalty = 0; }
    x.history.push({ q, earnings, interest: b.interest, principal: b.principal, paid: b.debtService - io - po, owed: io + po, dscr, balance: x.loan.balance });
    if (x.loan.breaches >= 4) {
      x.foreclosedQ = q;
      // Lender receives rights to this fee business in satisfaction of the facility. Client units/assets
      // remain untouched; the lost management-fee entitlement is a separate contract, not a redemption.
      n.fund.clientFees ??= { contracts: {}, charges: [] };
      n.fund.clientFees.contracts[x.investorId] = { annualRate: feeRate(n.fund.clientFees, x.investorId, q + 1) * 4, effectiveQ: q + 1, recipient: 'lender' };
      x.loan.balance = 0;
      n.notices.push({ q, from: 'Lender', subject: `${x.name} fee business foreclosed`, body: `Four consecutive quarters below ${COVENANT_DSCR}x coverage: the lender took the acquired fee entitlement in settlement of the remaining facility. Client assets and units stay in the fund; those mandates no longer pay this firm management fees. Existing unpaid bills remain owed.`, tone: 'bad' });
    } else if (x.loan.breaches === 2) n.notices.push({ q, from: 'Lender', subject: `${x.name} manager covenant breached`, body: `Coverage ${dscr.toFixed(2)}x, below ${COVENANT_DSCR}x for two quarters. Default interest +0.5% quarterly; four consecutive breaches transfer the fee entitlement, not client assets.`, tone: 'bad' });
  }
  return owed;
}

export const managerDebt = (c: Pick<Career, 'managerFacilities'>) => (c.managerFacilities ?? []).filter(x => x.foreclosedQ === undefined).reduce((a, x) => a + x.loan.balance, 0);