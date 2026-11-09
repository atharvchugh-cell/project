import { calculateInvestmentReturn } from '@/lib/investmentReturn';
import { PRICE_TICK_SECONDS } from '@/hooks/useGameEngine';

/** Every player really starts with $5,000; the database seat row holds a $10,000 placeholder until the first sync. */
export const MULTIPLAYER_START_VALUE = 5000;

interface PlayerLike {
  portfolio_value: number | string | null;
  total_contributions: number | string | null;
  portfolio_history?: unknown;
  holdings?: unknown;
}

export interface PlayerStats {
  value: number;
  contributions: number;
  history: number[];
  returnPct: number;
  synced: boolean;
}

/** Normalises a player's seat so placeholder balances are never shown as real money. */
export function getPlayerStats(p: PlayerLike): PlayerStats {
  const rawHist = Array.isArray(p.portfolio_history) ? p.portfolio_history : [];
  const history = rawHist.map(Number).filter((n) => Number.isFinite(n));
  const holdingsCount = p.holdings && typeof p.holdings === 'object' ? Object.keys(p.holdings as object).length : 0;
  const synced = history.length > 1 || holdingsCount > 0;
  if (!synced) {
    return { value: MULTIPLAYER_START_VALUE, contributions: MULTIPLAYER_START_VALUE, history: [MULTIPLAYER_START_VALUE], returnPct: 0, synced };
  }
  const value = Number(p.portfolio_value) || 0;
  const contributions = Number(p.total_contributions) || MULTIPLAYER_START_VALUE;
  return { value, contributions, history, returnPct: calculateInvestmentReturn(value, contributions), synced };
}

/** Simulated year for history index i (one point per price tick, 60s per year). */
export function yearForHistoryIndex(startYear: number, i: number): number {
  return startYear + Math.floor((i * PRICE_TICK_SECONDS) / 60);
}
