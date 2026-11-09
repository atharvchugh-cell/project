/**
 * Decision Quality scoring for Hard Mode.
 *
 * Grades the PROCESS, not the outcome. Five sub-scores each on 0-100:
 *   1. Concentration  — max single-position % of portfolio
 *   2. Buying High    — buys after a recent run-up
 *   3. Panic Selling  — sells during steep drawdowns
 *   4. Overtrading    — trade frequency relative to game length
 *   5. Holding Discipline — staying invested through volatility
 *
 * All scores derived from the trade log + portfolio history + asset price
 * arrays. Each sub-score includes a one-line citation tied to a specific
 * year/trade so feedback feels concrete.
 */

export type TradeAction = 'buy' | 'sell';

export interface TradeEvent {
  /** Wall-clock game year (e.g. 1997). */
  year: number;
  /** In-game second when the trade happened. */
  second: number;
  action: TradeAction;
  assetId: string;
  /** Display label that was visible at trade time (could be a codename in Hard). */
  displayLabel: string;
  shares: number;
  price: number;
  /** Trade dollar size. */
  notional: number;
  /** Portfolio value just before the trade. */
  portfolioBefore: number;
  /** % of portfolio the trade represented. */
  pctOfPortfolio: number;
  /** Resulting position size as % of portfolio after the trade. */
  positionPctAfter?: number;
}

export interface SubScore {
  category: string;
  score: number;
  note: string;
}

export interface DecisionQualityResult {
  /** 0-100 weighted average. */
  score: number;
  /** Letter grade derived from score. */
  letter: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: SubScore[];
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function letterFor(score: number): DecisionQualityResult['letter'] {
  if (score >= 88) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

export function computeDecisionQuality(
  trades: TradeEvent[],
  portfolioHistory: number[],
  durationYears: number,
  startYear: number,
): DecisionQualityResult {
  const subs: SubScore[] = [];

  // 1. Concentration — peak single-position %
  let maxPos = 0;
  let maxPosTrade: TradeEvent | null = null;
  for (const t of trades) {
    if ((t.positionPctAfter ?? 0) > maxPos) {
      maxPos = t.positionPctAfter ?? 0;
      maxPosTrade = t;
    }
  }
  {
    // 40% peak is fine, 80%+ is reckless
    const penalty = clamp((maxPos - 40) * 1.7, 0, 100);
    const score = clamp(100 - penalty, 0, 100);
    subs.push({
      category: 'Concentration',
      score,
      note: maxPosTrade
        ? `Year ${maxPosTrade.year}: ${maxPosTrade.displayLabel} grew to ${maxPos.toFixed(0)}% of your portfolio.`
        : 'No single position dominated your portfolio.',
    });
  }

  // 2. Buying High — buys within a recent run-up (proxy: trade just before a
  // local drop within next ~3 ticks would suggest chasing). Without intraday
  // price arrays per trade, approximate: if the trade was a BUY and within
  // 5 game seconds prior the portfolio jumped >8%, count as chasing.
  let chasingTrades = 0;
  let totalBuys = 0;
  let worstChase: { trade: TradeEvent; runUp: number } | null = null;
  const TICKS_PER_YEAR = 6;
  for (const t of trades) {
    if (t.action !== 'buy') continue;
    totalBuys++;
    const tick = Math.floor(t.second / 10);
    const prev = Math.max(0, tick - 1);
    const v0 = portfolioHistory[prev] ?? portfolioHistory[0];
    const v1 = portfolioHistory[Math.min(tick, portfolioHistory.length - 1)] ?? v0;
    const runUp = v0 > 0 ? ((v1 - v0) / v0) * 100 : 0;
    if (runUp > 8 && t.pctOfPortfolio > 10) {
      chasingTrades++;
      if (!worstChase || runUp > worstChase.runUp) worstChase = { trade: t, runUp };
    }
  }
  {
    const ratio = totalBuys > 0 ? chasingTrades / totalBuys : 0;
    const score = clamp(100 - ratio * 100, 0, 100);
    subs.push({
      category: 'Buying High',
      score,
      note: worstChase
        ? `Year ${worstChase.trade.year}: bought ${worstChase.trade.displayLabel} right after a +${worstChase.runUp.toFixed(0)}% spike.`
        : 'You avoided chasing big run-ups before buying.',
    });
  }

  // 3. Panic Selling — sells when portfolio is >15% off its peak
  let panicSells = 0;
  let totalSells = 0;
  let worstPanic: { trade: TradeEvent; dd: number } | null = null;
  {
    let peak = portfolioHistory[0] ?? 0;
    let peakAtTick: number[] = [];
    for (const v of portfolioHistory) {
      if (v > peak) peak = v;
      peakAtTick.push(peak);
    }
    for (const t of trades) {
      if (t.action !== 'sell') continue;
      totalSells++;
      const tick = Math.min(Math.floor(t.second / 10), peakAtTick.length - 1);
      const p = peakAtTick[tick] ?? portfolioHistory[0];
      const v = portfolioHistory[tick] ?? p;
      const dd = p > 0 ? ((p - v) / p) * 100 : 0;
      if (dd > 15 && t.pctOfPortfolio > 20) {
        panicSells++;
        if (!worstPanic || dd > worstPanic.dd) worstPanic = { trade: t, dd };
      }
    }
  }
  {
    const ratio = totalSells > 0 ? panicSells / totalSells : 0;
    const score = clamp(100 - ratio * 130, 0, 100);
    subs.push({
      category: 'Panic Selling',
      score,
      note: worstPanic
        ? `Year ${worstPanic.trade.year}: sold ${worstPanic.trade.pctOfPortfolio.toFixed(0)}% of portfolio during a ${worstPanic.dd.toFixed(0)}% drawdown — textbook panic selling.`
        : 'You held your nerve during drawdowns.',
    });
  }

  // 4. Overtrading — trades per game year
  const tradesPerYear = durationYears > 0 ? trades.length / durationYears : trades.length;
  {
    // 0-3 trades/year ideal; >12 punishing
    const penalty = clamp((tradesPerYear - 3) * 8, 0, 100);
    const score = clamp(100 - penalty, 0, 100);
    subs.push({
      category: 'Overtrading',
      score,
      note: `You averaged ${tradesPerYear.toFixed(1)} trades per simulated year (${trades.length} total).`,
    });
  }

  // 5. Holding Discipline — reward NOT selling during the worst drawdown periods
  let drawdownSells = 0;
  let drawdownTicks = 0;
  {
    let peak = portfolioHistory[0] ?? 0;
    for (let i = 0; i < portfolioHistory.length; i++) {
      const v = portfolioHistory[i];
      if (v > peak) peak = v;
      if (peak > 0 && (peak - v) / peak > 0.15) {
        drawdownTicks++;
        // Did the player sell within +/- 1 tick of this drawdown tick?
        const secStart = i * 10 - 5;
        const secEnd = i * 10 + 15;
        for (const t of trades) {
          if (t.action === 'sell' && t.second >= secStart && t.second <= secEnd && t.pctOfPortfolio > 10) {
            drawdownSells++;
            break;
          }
        }
      }
    }
  }
  {
    const ratio = drawdownTicks > 0 ? drawdownSells / drawdownTicks : 0;
    const score = clamp(100 - ratio * 110, drawdownTicks === 0 ? 90 : 0, 100);
    subs.push({
      category: 'Holding Discipline',
      score,
      note: drawdownTicks === 0
        ? 'No major drawdowns occurred — discipline untested.'
        : drawdownSells === 0
        ? 'You stayed invested through every drawdown — strong discipline.'
        : `You sold sizeable positions during ${drawdownSells} drawdown moments — eroded compounding.`,
    });
  }

  // Weighted average. Equal weight keeps it intuitive.
  const score = subs.reduce((s, x) => s + x.score, 0) / subs.length;
  return {
    score: Math.round(score),
    letter: letterFor(score),
    breakdown: subs,
  };
}
