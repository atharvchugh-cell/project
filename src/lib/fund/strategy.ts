import { applyOrders, isTradable, liquidValue, TRADE_COST, type FundState, type Order } from './engine';
import { grossAssets, nav, netAssets } from './accounting';

/** Allocation targets use liquid assets only; the unassigned weight remains cash. */
export function allocationOrders(s: FundState, weights: Record<string, number>): Order[] {
  const entries = Object.entries(weights).filter(([t, w]) => isTradable(s, t) && Number.isFinite(w) && w > 0);
  const sum = entries.reduce((a, [, w]) => a + w, 0);
  const scale = sum > 100 ? 100 / sum : 1;
  const budget = liquidValue(s.ledger) / (1 + TRADE_COST * 2);
  const targets = Object.fromEntries(entries.map(([t, w]) => [t, budget * w * scale / 100]));
  return [...Object.keys(s.ledger.positions).filter(t => !(t in targets)).map(t => ({ ticker: t, amount: 0, sellAll: true })),
    ...Object.entries(targets).map(([ticker, value]) => ({ ticker, amount: value - (s.ledger.positions[ticker] ?? 0) })).filter(o => Math.abs(o.amount) > 1)];
}

export function draftFund(s: FundState, orders: Order[]) {
  const copy = structuredClone(s);
  applyOrders(copy, orders);
  return copy;
}

/** A user-chosen hypothetical shock, never historical data or a forecast. */
export function stressPortfolio(s: FundState, orders: Order[], shockPercent: number) {
  const draft = draftFund(s, orders);
  const before = netAssets(draft.ledger);
  const shock = Math.max(-100, Math.min(100, Number.isFinite(shockPercent) ? shockPercent : 0)) / 100;
  for (const ticker of Object.keys(draft.ledger.positions)) draft.ledger.positions[ticker] *= 1 + shock;
  const after = netAssets(draft.ledger);
  return { before, after, change: after - before, return: before > 0 ? after / before - 1 : 0, nav: nav(draft.ledger), cashWeight: draft.ledger.cash / Math.max(1, grossAssets(draft.ledger)) };
}