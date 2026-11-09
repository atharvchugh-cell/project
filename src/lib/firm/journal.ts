// Firm career journal: one transaction list shared by every entity book.
// Firm and founder cash balances are derived only from these entries, and a
// quarter close is recorded by closeId so it can never be posted twice.

export type EntityKind = 'fund' | 'firm' | 'person' | 'investor' | 'external' | 'company';
export interface Entity { id: string; name: string; kind: EntityKind; /** Owning entity, for subsidiaries added later. */ ownerId?: string }

export type TxnCategory =
  | 'opening' | 'carryover' | 'fee_receipt' | 'staff_revenue' | 'payroll' | 'payroll_arrears' | 'office'
  | 'salary' | 'distribution' | 'capital_injection' | 'severance' | 'bonus' | 'event_cost'
  | 'acquisition' | 'divestiture' | 'subsidiary_revenue' | 'subsidiary_cost' | 'capital_call' | 'call_penalty'
  // Wealth phase: personal purchases and upkeep, life costs, training, office upgrades, equity and exits.
  | 'purchase' | 'asset_sale' | 'upkeep' | 'life_cost' | 'training' | 'office_upgrade' | 'equity_sale' | 'partner_distribution' | 'firm_sale' | 'transaction_cost'
  // Deals, debt, business operations, clients and governance.
  | 'diligence' | 'loan_draw' | 'debt_interest' | 'debt_repayment' | 'business_retained' | 'business_distribution' | 'meeting_cost' | 'client_service' | 'equity_secondary' | 'equity_buyback' | 'rebrand' | 'expansion';

export interface Txn {
  id: string; q: number; date: string; payer: string; recipient: string;
  category: TxnCategory; amount: number; source: string; memo: string; closeId?: string;
}

export interface Journal { seq: number; txns: Txn[]; closed: string[] }

export const emptyJournal = (): Journal => ({ seq: 0, txns: [], closed: [] });

/** Append a transaction. Rejects non-positive or non-finite amounts and entries for an already closed quarter. */
export function post(j: Journal, t: Omit<Txn, 'id'>): Txn | null {
  if (!Number.isFinite(t.amount) || t.amount <= 0.005) return null;
  if (t.closeId && j.closed.includes(t.closeId)) return null;
  const txn: Txn = { ...t, amount: Math.round(t.amount * 100) / 100, id: `tx-${++j.seq}` };
  j.txns.push(txn);
  return txn;
}

export const balance = (j: Journal, entity: string) =>
  j.txns.reduce((a, t) => a + (t.recipient === entity ? t.amount : 0) - (t.payer === entity ? t.amount : 0), 0);

export const entriesFor = (j: Journal, entity: string) => j.txns.filter(t => t.payer === entity || t.recipient === entity);

export const isClosed = (j: Journal, closeId: string) => j.closed.includes(closeId);

/** Sum of a category, optionally limited to a quarter. */
export const totalOf = (j: Journal, category: TxnCategory, q?: number) =>
  j.txns.filter(t => t.category === category && (q === undefined || t.q === q)).reduce((a, t) => a + t.amount, 0);
