import { addLiability, MGMT_FEE_QUARTER, netAssets, type Ledger } from './accounting';

export interface FeeContract { annualRate: number; effectiveQ: number; recipient?: 'manager' | 'lender' }
export interface FeeInvestor { id: string; name: string; units: number }
export interface ClientFeeState { contracts: Record<string, FeeContract>; charges: { q: number; investorId: string; base: number; rate: number; amount: number; liabilityId: string }[] }
export function feeRate(state: ClientFeeState | undefined, id: string, q: number) {
  const x = state?.contracts[id];
  return x && x.effectiveQ <= q && Number.isFinite(x.annualRate) && x.annualRate >= 0 && x.annualRate <= 0.02 ? x.annualRate / 4 : MGMT_FEE_QUARTER;
}
export function managementFee(l: Ledger, investors: FeeInvestor[], state: ClientFeeState | undefined, q: number, mark = netAssets(l), managerOnly = false) {
  if (!state) return mark * MGMT_FEE_QUARTER;
  return investors.reduce((a, i) => a + (managerOnly && state.contracts[i.id]?.recipient === 'lender' && state.contracts[i.id].effectiveQ <= q ? 0 : (l.units > 0 ? mark * i.units / l.units : 0) * feeRate(state, i.id, q)), 0);
}
export function accrueClientFees(l: Ledger, investors: FeeInvestor[], state: ClientFeeState, q: number) {
  const mark = netAssets(l);
  for (const i of investors) {
    if (state.charges.some(x => x.q === q && x.investorId === i.id)) continue;
    const base = l.units > 0 ? mark * i.units / l.units : 0; const rate = feeRate(state, i.id, q); const amount = base * rate;
    if (!(amount > 0)) continue;
    const liability = addLiability(l, 'mgmt_fee', amount, q, `${i.name}: quarterly management fee`);
    liability.investorId = i.id;
    if (state.contracts[i.id]?.recipient === 'lender' && state.contracts[i.id].effectiveQ <= q) liability.feeRecipient = 'lender';
    state.charges.push({ q, investorId: i.id, base, rate, amount, liabilityId: liability.id });
  }
}