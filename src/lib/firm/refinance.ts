import { firmCash, reserveTarget, reserveQuartersOf, type Career } from './career';
import { COVENANT_DSCR, enterpriseValue, loanSchedule, businessQuarter, MAX_LTV, type Loan } from './business';
import { post } from './journal';
import { quarterLabel } from '@/lib/fund/engine';

export interface RefinanceOffer { id: string; label: string; rateQ: number; termQ: number; feeRate: number }
/** Fixed lender offers, not arbitrary rates supplied by the player. */
export const REFINANCE_OFFERS: RefinanceOffer[] = [
  { id: 'relationship', label: 'Relationship bank', rateQ: 0.0175, termQ: 12, feeRate: 0.01 },
  { id: 'extended', label: 'Longer-term bank', rateQ: 0.0225, termQ: 20, feeRate: 0.015 },
  { id: 'short', label: 'Short-term lender', rateQ: 0.015, termQ: 8, feeRate: 0.01 },
];
export function refinanceCheck(c: Career, id: string, offerId: string) {
  const s = c.subsidiaries.find(x => x.id === id); const l = s?.loan; const offer = REFINANCE_OFFERS.find(x => x.id === offerId);
  const reasons: string[] = [];
  if (c.status !== 'running' || c.fund.status === 'ended') reasons.push('This career has ended.');
  if (!s || !l || l.balance <= 0) reasons.push('No outstanding owned-business facility.');
  if (!offer) reasons.push('Choose an available lender offer.');
  if (l && (l.breaches > 0 || l.penalty > 0)) reasons.push('Cure existing covenant breaches before refinancing.');
  if (c.arrears > 0) reasons.push('Pay existing bills first; refinancing cannot erase arrears.');
  if (s?.refinances?.some(x => x.q === c.fund.q)) reasons.push('Already refinanced this business this quarter.');
  const payoff = l?.balance ?? 0; const fee = payoff * (offer?.feeRate ?? 0);
  const limit = s ? Math.min(enterpriseValue(s) * MAX_LTV, Math.max(0, (s.revenueQ - s.costQ) * 4) * 3) : 0;
  if (payoff > limit + 0.5) reasons.push('Outstanding principal exceeds the current lender limit.');
  const replacement: Loan = { principal: payoff, balance: payoff, rateQ: offer?.rateQ ?? 0, amortQ: payoff / (offer?.termQ ?? 12), maturityQ: c.fund.q + (offer?.termQ ?? 12), drawnQ: c.fund.q, lastQ: c.fund.q, breaches: 0, penalty: 0 };
  const service = loanSchedule(replacement, c.fund.q + 1).debtService;
  const oldService = l ? loanSchedule(l, c.fund.q + 1).debtService : 0;
  const reserve = reserveTarget(c) + (service - oldService) * reserveQuartersOf(c);
  const cashNow = firmCash(c); const cashAfter = cashNow + payoff - payoff - fee;
  const dscr = service > 0 && s ? businessQuarter(s, c.fund.q + 1).ebitda / service : 0;
  if (dscr < COVENANT_DSCR) reasons.push(`Next-quarter operating profit must cover service at least ${COVENANT_DSCR}x.`);
  if (cashAfter + 0.5 < reserve + c.arrears) reasons.push('The transaction fee would leave the firm below its reserve and obligations.');
  return { ok: reasons.length === 0, reasons, payoff, draw: payoff, fee, cashNow, cashAfter, reserve, limit, dscr, service, replacement };
}
export function refinanceBusiness(c: Career, id: string, offerId: string) {
  const check = refinanceCheck(c, id, offerId);
  if (!check.ok) return { c, ok: false, message: check.reasons[0] ?? 'Refinancing unavailable.' };
  const n = structuredClone(c); const s = n.subsidiaries.find(x => x.id === id);
  if (!s?.loan) return { c, ok: false, message: 'Facility no longer available.' };
  const q = n.fund.q; const source = `refinance:${id}:${q}`; const date = q ? quarterLabel(n.fund, q) : 'Opening';
  const old = structuredClone(s.loan);
  for (const [category, amount, payer, recipient] of [
    ['loan_draw', check.draw, 'external', 'firm'], ['debt_repayment', check.payoff, 'firm', 'external'], ['transaction_cost', check.fee, 'firm', 'external'],
  ] as const) post(n.journal, { q, date, category, amount, payer, recipient, source: `${source}:${category}`, memo: `${s.name} refinancing ${category.replace(/_/g, ' ')}` });
  s.loan = check.replacement; (s.refinances ??= []).push({ id: source, q, old, replacement: structuredClone(check.replacement), payoff: check.payoff, fee: check.fee });
  return { c: n, ok: true, message: `${s.name} refinanced. Old principal paid in full; new rate ${(check.replacement.rateQ * 400).toFixed(1)}% annually.` };
}