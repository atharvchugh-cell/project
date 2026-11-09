// Client Contracts fund accounting. Units are issued and retired at NAV, so
// new money never counts as investment profit. Liabilities (fees, redemptions,
// costs) reduce NAV once, when they are recorded; paying them moves cash and
// clears the liability in the same step, so nothing is deducted twice.

export type LiabilityKind = 'mgmt_fee' | 'perf_fee' | 'redemption' | 'cost';
export interface Liability { id: string; kind: LiabilityKind; label: string; amount: number; dueQ: number; paid: boolean; investorId?: string; feeRecipient?: 'lender' }

export interface Ledger {
  cash: number;
  /** Market value of liquid positions, by asset id. */
  positions: Record<string, number>;
  /** Locked legacy holding value (Hard Mode). */
  locked: number;
  units: number;
  founderUnits: number;
  /** Fee high-water mark per unit; only rises when a performance fee is charged. */
  feeHwm: number;
  /** Fee cash actually paid to the manager. */
  managerCash: number;
  liabilities: Liability[];
  seq: number;
}

export const MGMT_FEE_QUARTER = 0.0025; // 1% a year
export const PERF_FEE_RATE = 0.10;

export const grossAssets = (l: Ledger) => l.cash + l.locked + Object.values(l.positions).reduce((a, b) => a + b, 0);
export const openLiabilities = (l: Ledger) => l.liabilities.filter(x => !x.paid).reduce((a, b) => a + b.amount, 0);
export const netAssets = (l: Ledger) => grossAssets(l) - openLiabilities(l);
export const nav = (l: Ledger) => (l.units > 0 ? netAssets(l) / l.units : 0);
export const managerWealth = (l: Ledger) => l.founderUnits * nav(l) + l.managerCash;

const nextId = (l: Ledger, p: string) => `${p}-${++l.seq}`;

/** New investor money: units at current NAV. NAV per unit is unchanged. */
export function subscribe(l: Ledger, amount: number, founder = false): number {
  const price = nav(l);
  if (amount <= 0 || price <= 0) return 0;
  const u = amount / price;
  l.cash += amount;
  l.units += u;
  if (founder) l.founderUnits += u;
  return u;
}

/** Retire units at today's NAV; the payout becomes a liability due at dueQ. */
export function redeemUnits(l: Ledger, units: number, dueQ: number, label: string, investorId?: string): Liability {
  const price = nav(l);
  const u = Math.min(units, l.units);
  const amount = u * price;
  l.units -= u;
  const liab: Liability = { id: nextId(l, 'red'), kind: 'redemption', label, amount, dueQ, paid: false, investorId };
  l.liabilities.push(liab);
  return liab;
}

export function addLiability(l: Ledger, kind: LiabilityKind, amount: number, dueQ: number, label: string): Liability {
  const liab: Liability = { id: nextId(l, kind), kind, label, amount, dueQ, paid: false };
  l.liabilities.push(liab);
  return liab;
}

/** Quarterly management fee on net assets before the fee. */
export function accrueManagementFee(l: Ledger, q: number): Liability {
  return addLiability(l, 'mgmt_fee', netAssets(l) * MGMT_FEE_QUARTER, q, 'Management fee (0.25% this quarter)');
}

/** Preview of the annual performance fee (after management fees already accrued). */
export function previewPerformanceFee(l: Ledger): number {
  const n = nav(l);
  return n > l.feeHwm ? PERF_FEE_RATE * (n - l.feeHwm) * l.units : 0;
}

/** Year-end crystallisation. HWM rises only to the post-fee NAV when a fee is charged. */
export function crystallizePerformanceFee(l: Ledger, q: number): Liability | null {
  const fee = previewPerformanceFee(l);
  if (fee <= 0) return null;
  const liab = addLiability(l, 'perf_fee', fee, q, 'Performance fee (10% above high-water mark)');
  l.feeHwm = nav(l);
  return liab;
}

/** Pay a liability from cash if possible. Fees are deferred while a redemption due now is unpaid. */
export function payLiability(l: Ledger, liab: Liability): boolean {
  if (liab.paid || l.cash + 1e-9 < liab.amount) return false;
  l.cash -= liab.amount;
  liab.paid = true;
  if ((liab.kind === 'mgmt_fee' || liab.kind === 'perf_fee') && liab.feeRecipient !== 'lender') l.managerCash += liab.amount;
  return true;
}

/** Pay everything due by quarter q: costs and redemptions first, fees last (fees defer). */
export function settleDue(l: Ledger, q: number): { paid: Liability[]; overdue: Liability[] } {
  const order: Record<LiabilityKind, number> = { cost: 0, redemption: 1, mgmt_fee: 2, perf_fee: 3 };
  const due = l.liabilities.filter(x => !x.paid && x.dueQ <= q).sort((a, b) => order[a.kind] - order[b.kind] || a.dueQ - b.dueQ);
  const paid: Liability[] = [];
  for (const d of due) if (payLiability(l, d)) paid.push(d);
  const overdue = l.liabilities.filter(x => !x.paid && x.dueQ <= q && (x.kind === 'redemption' || x.kind === 'cost'));
  return { paid, overdue };
}
