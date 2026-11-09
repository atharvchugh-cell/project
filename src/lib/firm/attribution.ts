// Staff investment attribution from actual execution receipts.
// Each approved idea (manual or delegated) that actually bought shares owns a fraction of that ticker's
// position. Any later buy in the ticker dilutes every holder's fraction; any sale (desk, liquidity, forced)
// is pro rata, so fractions stay and each holder receives its share of the real proceeds. A position sold to
// zero ends every lot. Value now = fraction × the fund's real position, so the sum over ideas never exceeds
// the fund's holding and P&L follows the real holding/cash history including partial fills, timing and costs.
// The benchmark is the same dollars in the S&P 500 at the same execution moments, sold in the same proportions.
import { type Receipt, TRADE_COST } from '@/lib/fund/engine';
import type { Career, Idea } from './career';

export interface Lot {
  ticker: string; frac: number; invested: number; buyCost: number; proceeds: number; sellCost: number;
  benchUnits: number; benchProceeds: number; firstQ: number; lastQ: number;
  /** Actual cost (incl. buy costs) of the still-held part; released pro rata on each real sale. */ basisLeft?: number;
  /** Profit locked in at each sale: share of net proceeds - released basis. */ realized?: number;
  /** Earlier sales lack basis receipts; their split stays estimated even after migration. */ estimatedSplit?: boolean;
}

const KEEP = 400;

/** Apply new receipts to idea lots, keep a bounded receipt log on the career and clear the fund's queue. */
export function consumeReceipts(n: Career) {
  const rs = n.fund.receipts ?? [];
  if (!Array.isArray(n.fund.receipts)) n.fund.receipts = [];
  for (const r of rs) applyReceipt(n, r);
  n.fills = [...(n.fills ?? []), ...rs].slice(-KEEP);
  n.fund.receipts = [];
}

function lotsOn(n: Career, ticker: string) { return n.ideas.filter(i => i.lot && i.lot.ticker === ticker && i.lot.frac > 0); }

function legacySplit(L: Lot, value: number) {
  const basis = L.invested + L.buyCost;
  const soldShare = L.invested > 0 ? Math.min(1, 1 - (L.frac > 0 ? value / Math.max(1e-9, value + L.proceeds) : 0)) : 0;
  const basisLeft = L.frac > 0 ? basis * (1 - soldShare) : 0;
  return { basisLeft, realized: L.proceeds - basis + basisLeft };
}

/** Freeze the old split using the pre-execution lot value, never the diluted/post-sale holding. */
function migrateLot(L: Lot, before: number) {
  if (L.basisLeft !== undefined && L.realized !== undefined) return;
  const split = legacySplit(L, before * L.frac);
  L.basisLeft = split.basisLeft; L.realized = split.realized; L.estimatedSplit = true;
}

export function applyReceipt(n: Career, r: Receipt) {
  if (!(r.amount > 0)) return;
  if (r.side === 'buy') {
    const after = r.before + r.amount; if (!(after > 0)) return;
    for (const i of lotsOn(n, r.ticker)) {
      const lot = i.lot; if (!lot) continue;
      migrateLot(lot, r.before); lot.frac *= r.before / after;
    }
    const idea = r.ref ? n.ideas.find(i => i.id === r.ref && i.status === 'approved') : undefined;
    if (!idea) return;
    const L: Lot = idea.lot && idea.lot.ticker === r.ticker ? idea.lot : { ticker: r.ticker, frac: 0, invested: 0, buyCost: 0, proceeds: 0, sellCost: 0, benchUnits: 0, benchProceeds: 0, firstQ: r.q, lastQ: r.q, basisLeft: 0, realized: 0 };
    migrateLot(L, r.before);
    L.frac += r.amount / after; L.invested += r.amount; L.basisLeft = (L.basisLeft ?? 0) + r.amount + r.cost; L.buyCost += r.cost; L.benchUnits += r.amount / Math.max(1e-9, r.bidx); L.lastQ = r.q;
    idea.lot = L; idea.filled = (idea.filled ?? 0) + r.amount;
  } else {
    if (!(r.before > 0)) return;
    const x = Math.min(1, r.amount / r.before);
    for (const i of lotsOn(n, r.ticker)) {
      const L = i.lot; if (!L) continue;
      migrateLot(L, r.before);
      const remainingBasis = L.basisLeft ?? 0;
      const net = L.frac * (r.amount - r.cost); const released = (x >= 0.9999 ? 1 : x) * remainingBasis;
      L.realized = (L.realized ?? 0) + net - released; L.basisLeft = remainingBasis - released;
      L.proceeds += L.frac * (r.amount - r.cost); L.sellCost += L.frac * r.cost;
      L.benchProceeds += L.benchUnits * x * r.bidx * (1 - TRADE_COST); L.benchUnits *= 1 - x; L.lastQ = r.q;
      if (x >= 0.9999) { L.frac = 0; L.benchUnits = 0; L.basisLeft = 0; }
    }
  }
}

/** Live value of an idea's lot (its fraction of the fund's real position). */
export const lotValue = (c: Career, i: Idea) => (i.lot && i.lot.frac > 0 ? i.lot.frac * (c.fund.ledger.positions[i.lot.ticker] ?? 0) : 0);

export interface IdeaPnl { invested: number; costs: number; realized: number; unrealized: number; value: number; pnl: number; benchPnl: number; vsBench: number; open: boolean; estimatedSplit: boolean }
/** Actual attributable P&L. realized + unrealized = pnl; costs are included (buy and sell). */
export function ideaPnl(c: Career, i: Idea): IdeaPnl {
  const L = i.lot; if (!L) return { invested: 0, costs: 0, realized: 0, unrealized: 0, value: 0, pnl: 0, benchPnl: 0, vsBench: 0, open: false, estimatedSplit: false };
  const value = lotValue(c, i);
  const basis = L.invested + L.buyCost;
  let realized: number, unrealized: number;
  if (L.basisLeft !== undefined && L.realized !== undefined) { realized = L.realized; unrealized = L.frac > 0 ? value - L.basisLeft : 0; }
  else { // Legacy lot saved before per-sale basis tracking: best estimate from proceeds vs current value.
    const split = legacySplit(L, value);
    realized = split.realized; unrealized = value - split.basisLeft;
  }
  const pnl = realized + unrealized;
  const benchPnl = L.benchProceeds + L.benchUnits * c.fund.benchIndex - basis;
  return { invested: L.invested, costs: L.buyCost + L.sellCost, realized, unrealized, value, pnl, benchPnl, vsBench: pnl - benchPnl, open: L.frac > 0 && value > 0.5, estimatedSplit: L.estimatedSplit === true || L.basisLeft === undefined || L.realized === undefined };
}

/** Sum of every idea's attributed value per ticker. Never exceeds the fund's position. */
export function attributedByTicker(c: Career): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of c.ideas) { const v = lotValue(c, i); if (v > 0) out[i.lot!.ticker] = (out[i.lot!.ticker] ?? 0) + v; }
  return out;
}
