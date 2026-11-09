// Portfolio composition and per-investment results. Pure helpers shared by
// the in-game allocation pie and the end-of-game breakdown.

export interface BreakdownAsset {
  id: string;
  ticker: string;
  name: string;
  type: string;
  currentPrice: number;
}

export interface Slice { key: string; label: string; value: number; pct: number }

/** Each held asset as a share of total portfolio (holdings + CDs + cash). */
export function portfolioSlices(
  assets: BreakdownAsset[],
  holdings: Record<string, number>,
  cash: number,
  cdValue = 0,
  maxSlices = 7,
): Slice[] {
  const items: { key: string; label: string; value: number }[] = [];
  let cashLike = Math.max(0, cash);
  for (const a of assets) {
    const v = (holdings[a.id] || 0) * a.currentPrice;
    if (!(v > 0)) continue;
    if (a.type === 'hysa') cashLike += v;
    else items.push({ key: a.id, label: a.ticker || a.name, value: v });
  }
  if (cdValue > 0) items.push({ key: 'cds', label: 'CDs', value: cdValue });
  items.sort((x, y) => y.value - x.value);
  let shown = items;
  if (items.length > maxSlices) {
    const rest = items.slice(maxSlices - 1).reduce((s, i) => s + i.value, 0);
    shown = [...items.slice(0, maxSlices - 1), { key: 'other', label: 'Other', value: rest }];
  }
  if (cashLike > 0) shown.push({ key: 'cash', label: 'Cash/Savings', value: cashLike });
  const total = shown.reduce((s, i) => s + i.value, 0);
  return shown.map(i => ({ ...i, pct: total > 0 ? (i.value / total) * 100 : 0 }));
}

export interface AssetResult {
  id: string;
  label: string;
  name: string;
  invested: number;
  profit: number;
  returnPct: number;
}

/**
 * Profit per asset = current value - open cost basis + locked-in gains from
 * sales. Return % = profit / everything ever spent buying it. Saves from
 * before lifetime totals were tracked fall back to the open cost basis.
 */
export function assetResults(
  assets: (BreakdownAsset & { realTicker?: string; realName?: string })[],
  holdings: Record<string, number>,
  costBasis: Record<string, number>,
  totalBought: Record<string, number> | undefined,
  realizedPnl: Record<string, number> | undefined,
  reveal = false,
): AssetResult[] {
  const out: AssetResult[] = [];
  for (const a of assets) {
    const basis = costBasis[a.id] || 0;
    const invested = Math.max(totalBought?.[a.id] || 0, basis);
    if (!(invested > 0)) continue;
    const value = (holdings[a.id] || 0) * a.currentPrice;
    const profit = value - basis + (realizedPnl?.[a.id] || 0);
    out.push({
      id: a.id,
      label: (reveal ? a.realTicker : undefined) ?? a.ticker ?? a.name,
      name: (reveal ? a.realName : undefined) ?? a.name,
      invested,
      profit,
      returnPct: (profit / invested) * 100,
    });
  }
  return out;
}

export function standouts(results: AssetResult[]) {
  if (results.length === 0) return null;
  const mostMoney = [...results].sort((a, b) => b.profit - a.profit)[0];
  const bestPct = [...results].sort((a, b) => b.returnPct - a.returnPct)[0];
  const totalGains = results.reduce((s, r) => s + Math.max(0, r.profit), 0);
  const carriedShare = mostMoney.profit > 0 && totalGains > 0 ? (mostMoney.profit / totalGains) * 100 : null;
  return { mostMoney, bestPct, carriedShare };
}
