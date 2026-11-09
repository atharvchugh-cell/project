// Itemized firm obligations. Paying less than a bill never makes it disappear:
// the affordable part is posted to the journal and the rest stays here, owed,
// until a later close (or a founder injection) pays it. `Career.arrears` is
// always the total of these items.
//
// Settlement order (documented, used everywhere): staff wages, severance, office,
// business (subsidiary) bills, then event and bonus costs; oldest first within a kind.
import { quarterLabel } from '@/lib/fund/engine';
import type { Career } from './career';
import { balance, post, type TxnCategory } from './journal';

export type PayableKind = 'payroll' | 'severance' | 'office' | 'subsidiary' | 'event';
export interface Payable { id: string; q: number; kind: PayableKind; category: TxnCategory; label: string; amount: number }

export const PAYABLE_ORDER: PayableKind[] = ['payroll', 'severance', 'office', 'subsidiary', 'event'];
export const PAYABLE_LABEL: Record<PayableKind, string> = {
  payroll: 'Unpaid staff wages', severance: 'Unpaid severance', office: 'Unpaid office bills', subsidiary: 'Unpaid business bills', event: 'Unpaid event and bonus costs',
};

const label = (c: Career, q: number) => (q > 0 ? quarterLabel(c.fund, q) : 'Opening');
const cash = (c: Career) => Math.max(0, balance(c.journal, 'firm'));

export const owedTotal = (c: Pick<Career, 'payables'>) => (c.payables ?? []).reduce((a, p) => a + p.amount, 0);
export const owedBy = (c: Pick<Career, 'payables'>) => PAYABLE_ORDER.map(kind => ({ kind, label: PAYABLE_LABEL[kind], amount: (c.payables ?? []).filter(p => p.kind === kind).reduce((a, p) => a + p.amount, 0) })).filter(x => x.amount > 0.5);
const sync = (c: Career) => { c.payables = c.payables.filter(p => p.amount > 0.5); c.arrears = Math.round(owedTotal(c) * 100) / 100; };

export interface PayResult { paid: number; owed: number }

/** Pay a bill in full if firm cash allows; otherwise pay what is available and keep the remainder as an itemized payable. */
export function payOrOwe(c: Career, o: { q: number; kind: PayableKind; category: TxnCategory; amount: number; memo: string; source: string; closeId?: string }): PayResult {
  if (!(o.amount > 0) || !Number.isFinite(o.amount)) return { paid: 0, owed: 0 };
  const paid = Math.min(cash(c), o.amount);
  if (paid > 0.005) post(c.journal, { q: o.q, date: label(c, o.q), payer: 'firm', recipient: 'external', category: o.category, amount: paid, source: o.source, memo: o.memo, closeId: o.closeId });
  const owed = o.amount - paid;
  if (owed > 0.5) c.payables.push({ id: `owe-${o.source}-${o.kind}-${c.journal.seq}-${c.payables.length}`, q: o.q, kind: o.kind, category: o.category, label: o.memo, amount: owed });
  sync(c);
  return { paid, owed: owed > 0.5 ? owed : 0 };
}

/** Pay earlier obligations in PAYABLE_ORDER, up to `limit` and available firm cash. Returns the amount paid. */
export function settlePayables(c: Career, q: number, source: string, closeId?: string, limit = Infinity): number {
  let left = limit; let total = 0;
  for (const kind of PAYABLE_ORDER) {
    for (const p of c.payables.filter(x => x.kind === kind).sort((a, b) => a.q - b.q)) {
      const pay = Math.min(p.amount, cash(c), left);
      if (pay <= 0.005) continue;
      post(c.journal, { q, date: label(c, q), payer: 'firm', recipient: 'external', category: p.category, amount: pay, source, memo: `${p.label} (owed since ${label(c, p.q)})`, closeId });
      p.amount -= pay; left -= pay; total += pay;
    }
  }
  sync(c);
  return total;
}

/** Older saves kept only a single arrears number, all of it unpaid payroll and office. */
export function legacyPayables(c: Pick<Career, 'arrears' | 'fund'>): Payable[] {
  return c.arrears > 0.5 ? [{ id: 'owe-legacy', q: c.fund.q, kind: 'payroll', category: 'payroll_arrears', label: 'Back pay owed to staff', amount: c.arrears }] : [];
}
