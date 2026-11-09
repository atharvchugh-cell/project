import type { Career } from './career';
import { applyOrders, type Order } from '@/lib/fund/engine';
import { applyFundAction } from './close';
import { executionCap } from './plan';

/** Immediate desk executions at the current mark, with constitution limits and real receipts. */
export function tradeCareerNow(c: Career, order: Order): Career {
  if (c.status !== 'running' || c.fund.status === 'ended' || !Number.isFinite(order.amount)) return c;
  const f = structuredClone(c.fund); f.receipts = [];
  applyOrders(f, [{ ...order, timing: undefined, ref: 'desk' }], { q: f.q, timing: 'between', bidx: f.benchIndex, maxPosition: executionCap(c) });
  const n = applyFundAction(c, f, 'desk-now');
  n.plan.orders = n.plan.orders.filter(o => o.ticker !== order.ticker);
  return n;
}