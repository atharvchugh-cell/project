import { type Career } from './career';
import { feeRate, managementFee } from '@/lib/fund/clientFees';
import { netAssets } from '@/lib/fund/accounting';
export const clientFeeEstimate = (c: Career, q = c.fund.q + 1, mark = netAssets(c.fund.ledger)) => managementFee(c.fund.ledger, c.fund.investors, c.fund.clientFees, q, mark, true);
export const annualClientRate = (c: Career, id: string) => feeRate(c.fund.clientFees, id, c.fund.q + 1) * 4;
export function enableClientFees(c: Career): Career {
  if (c.status !== 'running' || c.fund.clientFees) return c;
  const n = structuredClone(c); n.fund.clientFees = { contracts: {}, charges: [] }; return n;
}
/** Fictional clients accept discounts, or a modest premium after four strong quarters and a close relationship. */
export function negotiateFee(c: Career, id: string, annualRate: number) {
  const inv = c.fund.investors.find(i => i.id === id && i.id !== 'you' && i.units > 0);
  if (!inv || c.status !== 'running' || !c.fund.clientFees || !Number.isFinite(annualRate) || annualRate < 0.005 || annualRate > 0.02) return { c, ok: false, message: 'Choose a client fee between 0.5% and 2% a year after enabling client contracts.' };
  const old = annualClientRate(c, id);
  if (c.fund.clientFees.contracts[id]?.recipient === 'lender') return { c, ok: false, message: 'This fee entitlement belongs to the lender and cannot be renegotiated by the firm.' };
  const history = c.fund.history.slice(-4); const strong = history.length === 4 && history.reduce((a, h) => a * (1 + h.ret), 1) > 1.08;
  if (annualRate > old && (!(strong && (c.satisfaction[id] ?? 60) >= 80) || annualRate > old + 0.0025 + 1e-9)) return { c, ok: false, message: 'The client declined: a premium needs a strong completed year and relationship 80+, and is limited to 0.25 percentage points.' };
  const n = structuredClone(c); if (!n.fund.clientFees) return { c, ok: false, message: 'Client contracts unavailable.' };
  n.fund.clientFees.contracts[id] = { annualRate, effectiveQ: n.fund.q + 1 };
  n.notices.push({ q: n.fund.q, from: inv.name, subject: 'Fee contract accepted', body: `${(annualRate * 100).toFixed(2)}% annually on the whole invested balance, paid quarterly from fund assets starting next quarter. Replaces our shared management fee; annual performance fees are unchanged.`, tone: 'neutral' });
  return { c: n, ok: true, message: 'Client accepted the fee contract for next quarter.' };
}