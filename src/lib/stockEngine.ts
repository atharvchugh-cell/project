import { getMaxBuyUnits } from './tradeInput';
import { initializeGame, gameRandom, type GameAssetConfig, getCDRates } from '@/data/historicalData';
import type { ComplexCompany } from '@/data/complexReturns';
/** Price updates every 6 game seconds. */
export const PRICE_TICK_SECONDS = 6;
/** Number of price ticks per simulated year (60s wall-clock per year ÷ 6s tick). */
export const PRICE_TICKS_PER_YEAR = 10;

export interface ActiveCD {
  id: string;
  type: '1y' | '2y' | '5y';
  principal: number;
  rate: number;
  purchaseSecond: number;
  maturitySecond: number;
  matured: boolean;
}

export interface LifeEvent {
  second: number;
  cost: number;
  message: string;
  triggered: boolean;
}

const LIFE_EVENT_SCENARIOS = [
  "Your car broke down — major engine repair needed!",
  "Surprise medical bill — emergency room visit!",
  "Your roof started leaking — emergency repairs!",
  "IRS audit — you owe back taxes and penalties!",
  "Your laptop died — need a new one for work!",
  "Basement flooded — water damage restoration!",
  "Wedding in the family — you're covering costs!",
  "Pet emergency surgery — vet bills piling up!",
  "Home appliance meltdown — fridge and AC broke!",
  "Identity theft — legal fees to sort it out!",
  "Tree fell on your fence — contractor needed!",
  "Speeding ticket plus insurance hike!",
];

export function generateLifeEvents(): LifeEvent[] {
  const count = gameRandom() < 0.5 ? 1 : 2;
  const usedSeconds = new Set<number>();
  const usedMessages = new Set<number>();
  const events: LifeEvent[] = [];
  for (let i = 0; i < count; i++) {
    let sec: number;
    do { sec = 120 + Math.floor(gameRandom() * 960); } while (usedSeconds.has(sec));
    usedSeconds.add(sec);
    let msgIdx: number;
    do { msgIdx = Math.floor(gameRandom() * LIFE_EVENT_SCENARIOS.length); } while (usedMessages.has(msgIdx));
    usedMessages.add(msgIdx);
    events.push({
      second: sec,
      cost: 2000 + Math.floor(gameRandom() * 7001),
      message: LIFE_EVENT_SCENARIOS[msgIdx],
      triggered: false,
    });
  }
  return events;
}

export interface PendingUnlock {
  /** Primary asset (kept for backwards-compatibility with existing UI). */
  asset: GameAssetConfig;
  /** Every asset unlocking in this same game year, including `asset`. */
  assets: GameAssetConfig[];
  gameYear: number;
}

export interface GameState {
  phase: 'playing' | 'ended';
  startYear: number;
  endYear: number;
  gameDuration: number;
  totalGameSeconds: number;
  totalSeconds: number;
  cash: number;
  holdings: Record<string, number>;
  /** Total cost (cash spent) per asset id, for gain/loss display. */
  costBasis: Record<string, number>;
  /** Lifetime cash spent buying each asset (never reduced by sales). */
  totalBought?: Record<string, number>;
  /** Locked-in profit/loss from sales of each asset (proceeds minus basis sold). */
  realizedPnl?: Record<string, number>;
  totalContributions: number;
  /** Time-weighted growth index: chained investment growth between deposits/withdrawals. */
  twrIndex?: number;
  /** Portfolio value right after the last deposit/withdrawal (TWR base). */
  twrBase?: number;
  portfolioHistory: number[];
  assetConfigs: GameAssetConfig[];
  activeCDs: ActiveCD[];
  nextCDId: number;
  lifeEvents: LifeEvent[];
  unlockedAssetIds: Set<string>;
  pendingUnlock: PendingUnlock | null;
  paused: boolean;
  gameMode: 'normal' | 'complex' | 'hard';
  /** Complex-mode runtime-registered assets keyed by ticker; tracks IPO availability. */
  complexFirstYears: Record<string, number>;
  /** Hard-mode: per-game seed for alias map. Stable for the entire run. */
  hardSeed?: string;
  /** Hard-mode: chronological trade log for decision-quality grading. */
  tradeLog?: import('@/lib/decisionQuality').TradeEvent[];
  /** Advanced mode: asset that each $5,000 deposit is automatically invested in. */
  autoInvestAssetId?: string | null;
  /** Assets each $5,000 deposit is split across, equally (Basic + Advanced). */
  autoInvestAssetIds?: string[];
  /** Solo only: stop the clock at the start of every new year. */
  pauseEachYear?: boolean;
  /** Multiplayer: the host has paused the whole room. */
  roomPaused?: boolean;
}

export type Action =
  | { type: 'TICK' }
  | { type: 'BUY'; assetId: string; shares: number }
  | { type: 'SELL'; assetId: string; shares: number }
  | { type: 'BUY_CD'; cdType: '1y' | '2y' | '5y'; amount: number; rate: number }
  | { type: 'WITHDRAW_CD'; cdId: string; early: boolean }
  | { type: 'ACKNOWLEDGE_UNLOCK' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'SET_AUTO_INVEST'; assetIds: string[] }
  | { type: 'SET_PAUSE_EACH_YEAR'; on: boolean }
  | { type: 'ROOM_CLOCK'; paused: boolean }
  | { type: 'REGISTER_COMPLEX_ASSET'; asset: GameAssetConfig; firstAvailableYear: number }
  | { type: 'RESTORE_SERVER_STATE'; snapshot: ServerRestoreSnapshot };

/**
 * Authoritative slice of a multiplayer player's state, as held by the server.
 * Used when a player reconnects to a room already in progress.
 */
export interface ServerRestoreSnapshot {
  /** Seconds elapsed in the shared room clock. */
  totalSeconds: number;
  /** Null when the server holds no synced balance yet (seat never played). */
  cash: number | null;
  holdings: Record<string, number>;
  costBasis?: Record<string, number>;
  totalContributions: number | null;
  portfolioHistory: number[];
}

function getTick(totalSeconds: number) {
  return Math.floor(totalSeconds / PRICE_TICK_SECONDS);
}

export function sampleAssetPriceAtIndex(asset: GameAssetConfig, rawIndex: number): number {
  const index = Math.max(0, Math.min(rawIndex, asset.prices.length - 1));
  const price = asset.prices[index];
  if (price === 0 && index + 1 < asset.prices.length && asset.prices[index + 1] > 0) {
    return asset.prices[index + 1];
  }
  return price;
}

/** Auto-invest targets, reading older saves that stored a single asset. */
export function getAutoInvestIds(state: Pick<GameState, 'autoInvestAssetIds' | 'autoInvestAssetId'>): string[] {
  if (state.autoInvestAssetIds) return state.autoInvestAssetIds;
  return state.autoInvestAssetId ? [state.autoInvestAssetId] : [];
}

export function getAssetPrice(asset: GameAssetConfig, totalSeconds: number): number {
  // Price arrays are pre-built with 24 points per simulated year (engine-agnostic).
  // We quantize totalSeconds to the 6s price-tick cadence so displayed prices only
  // change once every 6 seconds, while annual year-end prices stay exact
  // (60s/year is divisible by 6s, so each year boundary lands on point 24*year).
  const pointsPerYear = 24;
  const quantized = Math.floor(totalSeconds / PRICE_TICK_SECONDS) * PRICE_TICK_SECONDS;
  const priceIndex = Math.floor((quantized * pointsPerYear) / 60);
  return sampleAssetPriceAtIndex(asset, priceIndex);
}

const CD_TERM_SECONDS: Record<string, number> = { '1y': 60, '2y': 120, '5y': 300 };

export function calcCDValue(cd: ActiveCD, totalSeconds: number): number {
  if (cd.matured || totalSeconds >= cd.maturitySecond) {
    return cd.principal * (1 + cd.rate * (CD_TERM_SECONDS[cd.type] / 60));
  }
  const elapsed = totalSeconds - cd.purchaseSecond;
  const termYears = CD_TERM_SECONDS[cd.type] / 60;
  const fractionComplete = elapsed / CD_TERM_SECONDS[cd.type];
  return cd.principal * (1 + cd.rate * termYears * fractionComplete);
}

export function calcPortfolioValue(state: GameState): number {
  let value = state.cash;
  for (const asset of state.assetConfigs) {
    const shares = state.holdings[asset.id] || 0;
    if (shares > 0) {
      value += shares * getAssetPrice(asset, state.totalSeconds);
    }
  }
  for (const cd of state.activeCDs) {
    if (!cd.matured) {
      value += calcCDValue(cd, state.totalSeconds);
    }
  }
  return value;
}

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'RESTORE_SERVER_STATE': {
      const s = action.snapshot;
      const clamped = Math.max(0, Math.min(Math.floor(s.totalSeconds), state.totalGameSeconds));
      // Unlocks are a pure function of the simulated year, so recompute them
      // for the caught-up clock instead of replaying every skipped tick.
      const year = Math.min(Math.floor(clamped / 60) + 1, state.gameDuration);
      const unlocked = new Set(state.unlockedAssetIds);
      for (const a of state.assetConfigs) {
        if ((a.type === 'stock' || a.type === 'crypto') && a.unlockYear !== undefined && a.unlockYear <= year) {
          unlocked.add(a.id);
        }
      }
      // Life events already resolved on the server side of the ledger (cash is
      // authoritative), so mark anything in the past as spent to avoid a
      // double deduction after the catch-up.
      const lifeEvents = state.lifeEvents.map(e => (e.second <= clamped ? { ...e, triggered: true } : e));
      // Seats with no synced balance keep their local starting money, plus the
      // scheduled contributions that landed while the clock was catching up —
      // counted once each, never doubled.
      const missedContributions =
        (Math.floor(clamped / 15) - Math.floor(state.totalSeconds / 15)) * 5000;
      return {
        ...state,
        totalSeconds: clamped,
        cash: s.cash ?? state.cash + missedContributions,
        holdings: { ...s.holdings },
        costBasis: { ...(s.costBasis ?? {}) },
        totalContributions: s.totalContributions ?? state.totalContributions + missedContributions,
        portfolioHistory: s.portfolioHistory.length > 0 ? [...s.portfolioHistory] : state.portfolioHistory,
        unlockedAssetIds: unlocked,
        pendingUnlock: null,
        lifeEvents,
        twrIndex: undefined,
        twrBase: undefined,
        phase: clamped >= state.totalGameSeconds ? 'ended' : state.phase,
      };
    }
    case 'TICK': {
      if (state.phase !== 'playing' || state.paused || state.roomPaused) return state;
      const next = state.totalSeconds + 1;

      if (next >= state.totalGameSeconds) {
        let finalCash = state.cash;
        const finalCDs = state.activeCDs.map(cd => {
          if (!cd.matured) {
            finalCash += calcCDValue(cd, state.totalGameSeconds);
            return { ...cd, matured: true };
          }
          return cd;
        });
        const finalState = { ...state, totalSeconds: state.totalGameSeconds, phase: 'ended' as const, cash: finalCash, activeCDs: finalCDs };
        return {
          ...finalState,
          portfolioHistory: [...state.portfolioHistory, calcPortfolioValue(finalState)],
        };
      }

      let newCash = state.cash;
      let newContributions = state.totalContributions;
      let newCDs = state.activeCDs;
      const willDeposit = next % 15 === 0;
      const willLifeEvent = state.lifeEvents.some(e => !e.triggered && next >= e.second);
      const hasFlow = willDeposit || willLifeEvent;
      // Chain investment growth up to (not including) this cash flow so
      // deposits and life-event costs never count as gains or losses.
      let twrIndex = state.twrIndex;
      if (hasFlow && twrIndex !== undefined && state.twrBase && state.twrBase > 0) {
        const preFlow = calcPortfolioValue({ ...state, totalSeconds: next });
        twrIndex = twrIndex * (preFlow / state.twrBase);
      }

      if (next % 15 === 0) {
        newCash += 5000;
        newContributions += 5000;
      }

      let newLifeEvents = state.lifeEvents;
      const triggeredEvent = newLifeEvents.find(e => !e.triggered && next >= e.second);
      if (triggeredEvent) {
        const deduction = Math.min(triggeredEvent.cost, newCash);
        newCash -= deduction;
        // Expenses are withdrawals, not investment losses: lower the capital base too.
        newContributions = Math.max(0, newContributions - deduction);
        newLifeEvents = newLifeEvents.map(e =>
          e === triggeredEvent ? { ...e, triggered: true } : e
        );
      }

      let autoHoldings = state.holdings;
      let autoCostBasis = state.costBasis;
      let autoBought = state.totalBought ?? {};
      const autoIds = getAutoInvestIds(state);
      if (willDeposit && state.gameMode !== 'hard' && autoIds.length > 0) {
        // Only assets that can be bought right now (unlocked, priced, not crypto).
        const targets = autoIds
          .map(id => state.assetConfigs.find(a => a.id === id))
          .filter((a): a is GameAssetConfig => !!a && a.type !== 'crypto'
            && ((a.type !== 'stock') || state.unlockedAssetIds.has(a.id))
            && getAssetPrice(a, next) > 0);
        const slice = targets.length > 0 ? Math.min(5000, newCash) / targets.length : 0;
        for (const target of targets) {
          const price = getAssetPrice(target, next);
          const shares = Math.floor((slice / price) * 10000) / 10000;
          if (shares <= 0) continue;
          const cost = shares * price;
          newCash -= cost;
          autoHoldings = { ...autoHoldings, [target.id]: (autoHoldings[target.id] || 0) + shares };
          autoCostBasis = { ...autoCostBasis, [target.id]: (autoCostBasis[target.id] || 0) + cost };
          autoBought = { ...autoBought, [target.id]: (autoBought[target.id] || 0) + cost };
        }
      }

      const maturedNow = newCDs.filter(cd => !cd.matured && next >= cd.maturitySecond);
      if (maturedNow.length > 0) {
        newCDs = newCDs.map(cd => {
          if (!cd.matured && next >= cd.maturitySecond) {
            newCash += calcCDValue(cd, cd.maturitySecond);
            return { ...cd, matured: true };
          }
          return cd;
        });
      }

      const newState: GameState = {
        ...state,
        totalSeconds: next,
        cash: newCash,
        holdings: autoHoldings,
        costBasis: autoCostBasis,
        totalBought: autoBought,
        totalContributions: newContributions,
        activeCDs: newCDs,
        lifeEvents: newLifeEvents,
        twrIndex,
      };
      if (hasFlow && twrIndex !== undefined) newState.twrBase = calcPortfolioValue(newState);

      const currentTick = getTick(next);
      const prevTick = getTick(state.totalSeconds);

      if (currentTick !== prevTick) {
        newState.portfolioHistory = [...state.portfolioHistory, calcPortfolioValue(newState)];
      }

      // Check for stock unlocks at year boundaries
      const newYear = Math.min(Math.floor(next / 60) + 1, state.gameDuration);
      const assetsToUnlock = state.assetConfigs.filter(
        a => (a.type === 'stock' || a.type === 'crypto') && a.unlockYear !== undefined && a.unlockYear <= newYear && !state.unlockedAssetIds.has(a.id)
      );
      if (assetsToUnlock.length > 0) {
        const newUnlocked = new Set(state.unlockedAssetIds);
        for (const a of assetsToUnlock) newUnlocked.add(a.id);
        newState.unlockedAssetIds = newUnlocked;
        newState.pendingUnlock = {
          asset: assetsToUnlock[0],
          assets: assetsToUnlock,
          gameYear: newYear,
        };
        // Unlocks are announced in the activity strip; they no longer stop the clock.
      }

      // Optional yearly pacing (solo only): stop at each new year so the
      // player can review before continuing.
      if (state.pauseEachYear && next % 60 === 0 && next < state.totalGameSeconds) {
        newState.paused = true;
      }

      return newState;
    }

    case 'BUY': {
      if (state.roomPaused) return state;
      const asset = state.assetConfigs.find(a => a.id === action.assetId);
      if (!asset) return state;
      const price = getAssetPrice(asset, state.totalSeconds);
      let shares = action.shares;

      // Bitcoin cap: one shared limit. Never silently fill fewer units than
      // the player confirmed — an over-limit order is rejected instead.
      if (asset.type === 'crypto') {
        const currentCryptoVal = state.assetConfigs
          .filter(a => a.type === 'crypto')
          .reduce((sum, a) => sum + (state.holdings[a.id] || 0) * getAssetPrice(a, state.totalSeconds), 0);
        const { max } = getMaxBuyUnits({ cash: state.cash, price, isCrypto: true, portfolioValue: calcPortfolioValue(state), currentCryptoValue: currentCryptoVal });
        if (shares > max) return state;
      }

      const cost = price * shares;
      if (cost > state.cash || shares <= 0) return state;
      const portfolioBefore = calcPortfolioValue(state);
      const next: GameState = {
        ...state,
        cash: state.cash - cost,
        holdings: {
          ...state.holdings,
          [action.assetId]: (state.holdings[action.assetId] || 0) + shares,
        },
        costBasis: {
          ...state.costBasis,
          [action.assetId]: (state.costBasis[action.assetId] || 0) + cost,
        },
        totalBought: {
          ...(state.totalBought ?? {}),
          [action.assetId]: (state.totalBought?.[action.assetId] || 0) + cost,
        },
      };
      if (state.gameMode === 'hard') {
        const positionValueAfter = ((state.holdings[action.assetId] || 0) + shares) * price;
        const portfolioAfter = calcPortfolioValue(next);
        const year = state.startYear + Math.floor(state.totalSeconds / 60);
        const event = {
          year,
          second: state.totalSeconds,
          action: 'buy' as const,
          assetId: action.assetId,
          displayLabel: asset.ticker,
          shares,
          price,
          notional: cost,
          portfolioBefore,
          pctOfPortfolio: portfolioBefore > 0 ? (cost / portfolioBefore) * 100 : 0,
          positionPctAfter: portfolioAfter > 0 ? (positionValueAfter / portfolioAfter) * 100 : 0,
        };
        next.tradeLog = [...(state.tradeLog || []), event];
      }
      return next;
    }

    case 'SELL': {
      if (state.roomPaused) return state;
      const asset = state.assetConfigs.find(a => a.id === action.assetId);
      if (!asset) return state;
      const held = state.holdings[action.assetId] || 0;
      const shares = Math.min(action.shares, held);
      if (shares <= 0) return state;
      const price = getAssetPrice(asset, state.totalSeconds);
      // Reduce cost basis proportionally to shares sold.
      const prevBasis = state.costBasis[action.assetId] || 0;
      // Snap floating-point dust to zero so "sell all" never leaves a sliver.
      const rawRemaining = held - shares;
      const remaining = rawRemaining < 1e-6 ? 0 : rawRemaining;
      const newBasis = held > 0 && remaining > 0 ? prevBasis * (remaining / held) : 0;
      const portfolioBefore = calcPortfolioValue(state);
      const notional = price * shares;
      const next: GameState = {
        ...state,
        cash: state.cash + notional,
        holdings: {
          ...state.holdings,
          [action.assetId]: remaining,
        },
        costBasis: {
          ...state.costBasis,
          [action.assetId]: newBasis,
        },
        realizedPnl: {
          ...(state.realizedPnl ?? {}),
          [action.assetId]: (state.realizedPnl?.[action.assetId] || 0) + (notional - (prevBasis - newBasis)),
        },
      };
      if (state.gameMode === 'hard') {
        const year = state.startYear + Math.floor(state.totalSeconds / 60);
        const event = {
          year,
          second: state.totalSeconds,
          action: 'sell' as const,
          assetId: action.assetId,
          displayLabel: asset.ticker,
          shares,
          price,
          notional,
          portfolioBefore,
          pctOfPortfolio: portfolioBefore > 0 ? (notional / portfolioBefore) * 100 : 0,
          positionPctAfter: portfolioBefore > 0 ? ((remaining * price) / portfolioBefore) * 100 : 0,
        };
        next.tradeLog = [...(state.tradeLog || []), event];
      }
      return next;
    }


    case 'BUY_CD': {
      if (state.roomPaused) return state;
      if (action.amount <= 0 || action.amount > state.cash) return state;
      const termSeconds = CD_TERM_SECONDS[action.cdType];
      const newCD: ActiveCD = {
        id: `cd-${state.nextCDId}`,
        type: action.cdType,
        principal: action.amount,
        rate: action.rate,
        purchaseSecond: state.totalSeconds,
        maturitySecond: state.totalSeconds + termSeconds,
        matured: false,
      };
      return {
        ...state,
        cash: state.cash - action.amount,
        activeCDs: [...state.activeCDs, newCD],
        nextCDId: state.nextCDId + 1,
      };
    }

    case 'WITHDRAW_CD': {
      const cd = state.activeCDs.find(c => c.id === action.cdId && !c.matured);
      if (!cd) return state;
      let payout: number;
      if (action.early) {
        payout = cd.principal * 0.8;
      } else {
        payout = calcCDValue(cd, cd.maturitySecond);
      }
      return {
        ...state,
        cash: state.cash + payout,
        activeCDs: state.activeCDs.map(c =>
          c.id === action.cdId ? { ...c, matured: true } : c
        ),
      };
    }

    case 'ACKNOWLEDGE_UNLOCK': {
      return {
        ...state,
        // Acknowledging only dismisses the note; it never changes the clock.
        pendingUnlock: null,
      };
    }

    case 'SET_AUTO_INVEST': {
      return { ...state, autoInvestAssetId: null, autoInvestAssetIds: action.assetIds.slice(0, 5) };
    }

    case 'SET_PAUSE_EACH_YEAR':
      return { ...state, pauseEachYear: action.on };

    case 'ROOM_CLOCK':
      return state.roomPaused === action.paused ? state : { ...state, roomPaused: action.paused };

    case 'TOGGLE_PAUSE': {
      if (state.phase !== 'playing' || state.roomPaused) return state;
      return { ...state, paused: !state.paused };
    }

    case 'REGISTER_COMPLEX_ASSET': {
      if (state.assetConfigs.find(a => a.id === action.asset.id)) return state;
      const unlocked = new Set(state.unlockedAssetIds);
      unlocked.add(action.asset.id);
      return {
        ...state,
        assetConfigs: [...state.assetConfigs, action.asset],
        unlockedAssetIds: unlocked,
        complexFirstYears: {
          ...state.complexFirstYears,
          [action.asset.id]: action.firstAvailableYear,
        },
      };
    }

    default:
      return state;
  }
}

/**
 * Build a GameAssetConfig from a ComplexCompany's annual returns.
 * Generates 24 price points per simulated year (matches existing engine cadence),
 * with each calendar year interpolating from that year's opening price to that
 * year's closing price.
 *
 * Important for first-available years:
 * - We keep the historical anchor that the FIRST AVAILABLE YEAR closes at $100.
 * - The opening price for that year is back-solved from the doc's annual return.
 *
 * This prevents the old false 0 → 100 ramp that made newly-available stocks
 * look like they gained ~100% immediately before their actual yearly return.
 */
export function buildComplexAssetConfig(
  company: ComplexCompany,
  startYear: number,
  durationYears: number,
): GameAssetConfig {
  const pointsPerYear = 24;
  const totalPoints = durationYears * pointsPerYear + 1;
  const yearEndPrices: number[] = [];
  let rollingPrice = 100;
  for (let y = company.firstAvailableYear + 1; y <= startYear - 1; y++) {
    const r = company.returns[y];
    if (r !== undefined) rollingPrice *= 1 + r / 100;
  }

  const isAvailableAtStart = startYear - 1 >= company.firstAvailableYear;
  let priceAtYearStart = isAvailableAtStart ? rollingPrice : 0;

  for (let gameYear = 0; gameYear <= durationYears; gameYear++) {
    if (gameYear === 0) {
      yearEndPrices.push(priceAtYearStart);
      continue;
    }

    const yearBeingClosed = startYear + gameYear - 1;
    if (yearBeingClosed < company.firstAvailableYear) {
      yearEndPrices.push(0);
      continue;
    }

    if (yearBeingClosed === company.firstAvailableYear && !isAvailableAtStart) {
      const anchorReturn = company.returns[yearBeingClosed];
      const ratio = anchorReturn !== undefined ? 1 + anchorReturn / 100 : 1;
      priceAtYearStart = ratio > 0 ? 100 / ratio : 100;
      yearEndPrices.push(100);
      priceAtYearStart = 100;
      continue;
    }

    const r = company.returns[yearBeingClosed];
    const newPrice = r !== undefined ? priceAtYearStart * (1 + r / 100) : priceAtYearStart;
    yearEndPrices.push(newPrice);
    priceAtYearStart = newPrice;
  }

  // Deterministic per-(ticker,year) noise so replays are stable.
  const rand = (a: number, b: number) => {
    let h = 2166136261;
    const s = `${company.ticker}|${a}|${b}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    // Map to [0,1)
    return ((h >>> 0) % 100000) / 100000;
  };

  const prices: number[] = new Array(totalPoints).fill(0);
  prices[0] = yearEndPrices[0] ?? 0;
  for (let gameYear = 1; gameYear <= durationYears; gameYear++) {
    const yearBeingClosed = startYear + gameYear - 1;
    const startIndex = (gameYear - 1) * pointsPerYear;
    const p0 = yearEndPrices[gameYear - 1] ?? 0;
    const p1 = yearEndPrices[gameYear] ?? p0;

    if (yearBeingClosed === company.firstAvailableYear && p0 === 0 && p1 > 0) {
      const anchorReturn = company.returns[yearBeingClosed];
      const ratio = anchorReturn !== undefined ? 1 + anchorReturn / 100 : 1;
      const openingPrice = ratio > 0 ? p1 / ratio : p1;
      prices[startIndex] = p0;
      for (let step = 1; step <= pointsPerYear; step++) {
        prices[startIndex + step] = openingPrice + ((p1 - openingPrice) * step) / pointsPerYear;
      }
      continue;
    }

    const annualR = company.returns[yearBeingClosed];
    const moveMag = annualR !== undefined ? Math.min(0.6, Math.abs(annualR) / 100) : 0;
    const vol = 0.11 + moveMag * 0.28; // 11%–28% intra-year volatility
    const phase = rand(yearBeingClosed, 0) * Math.PI * 2;
    const phase2 = rand(yearBeingClosed, 77) * Math.PI * 2;

    for (let step = 1; step <= pointsPerYear; step++) {
      const interp = p0 + ((p1 - p0) * step) / pointsPerYear;
      if (step === pointsPerYear) {
        prices[startIndex + step] = p1; // exact year-end anchor
        continue;
      }
      const r = rand(yearBeingClosed, step) - 0.5;
      // Two overlapping waves produce real-looking rallies and drawdowns
      // inside the year while the year-end anchor stays exact.
      const swing =
        Math.sin((step / pointsPerYear) * Math.PI * 2 + phase) * 0.075 +
        Math.sin((step / pointsPerYear) * Math.PI * 4.7 + phase2) * 0.035;
      // Taper the distortion near the year boundary so the close isn't a jump.
      const taper = Math.sin((step / pointsPerYear) * Math.PI) ** 0.6;
      const noisy = interp * (1 + (r * vol + swing) * taper);
      prices[startIndex + step] = Math.max(0.01, noisy);
    }

  }

  return {
    id: `cmplx-${company.ticker}`,
    name: company.name,
    ticker: company.ticker,
    type: 'stock',
    prices,
    unlockYear: undefined,
  };
}

