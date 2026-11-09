import { CANONICAL_STOCK_POOL, type CanonicalStockProfile } from './stockPool';

// Real approximate S&P 500 annual returns (1990-2025)
export const SP500_ANNUAL_RETURNS: Record<number, number> = {
  1990: -0.03, 1991: 0.30, 1992: 0.08, 1993: 0.10, 1994: 0.01,
  1995: 0.38, 1996: 0.23, 1997: 0.33, 1998: 0.29, 1999: 0.21,
  2000: -0.09, 2001: -0.13, 2002: -0.26, 2003: 0.29, 2004: 0.11,
  2005: 0.05, 2006: 0.16, 2007: 0.05, 2008: -0.37, 2009: 0.26,
  2010: 0.15, 2011: 0.02, 2012: 0.16, 2013: 0.32, 2014: 0.14,
  2015: -0.05, 2016: 0.12, 2017: 0.22, 2018: -0.08, 2019: 0.31,
  2020: 0.18, 2021: 0.29, 2022: -0.18, 2023: 0.26, 2024: 0.25, 2025: 0.05,
};

export const GOLD_ANNUAL_RETURNS: Record<number, number> = {
  1990: -0.02, 1991: -0.10, 1992: -0.06, 1993: 0.17, 1994: -0.02,
  1995: 0.01, 1996: -0.05, 1997: -0.21, 1998: -0.01, 1999: 0.01,
  2000: -0.06, 2001: 0.02, 2002: 0.25, 2003: 0.20, 2004: 0.05,
  2005: 0.18, 2006: 0.23, 2007: 0.31, 2008: 0.06, 2009: 0.24,
  2010: 0.30, 2011: 0.10, 2012: 0.07, 2013: -0.28, 2014: -0.01,
  2015: -0.11, 2016: 0.09, 2017: 0.13, 2018: -0.02, 2019: 0.18,
  2020: 0.25, 2021: -0.04, 2022: -0.01, 2023: 0.13, 2024: 0.27, 2025: 0.10,
};

export const OIL_ANNUAL_RETURNS: Record<number, number> = {
  1990: 0.28, 1991: -0.33, 1992: -0.01, 1993: -0.13, 1994: 0.02,
  1995: 0.10, 1996: 0.32, 1997: -0.32, 1998: -0.35, 1999: 1.12,
  2000: 0.05, 2001: -0.26, 2002: 0.57, 2003: 0.04, 2004: 0.34,
  2005: 0.40, 2006: 0.00, 2007: 0.57, 2008: -0.54, 2009: 0.78,
  2010: 0.15, 2011: 0.08, 2012: -0.07, 2013: 0.07, 2014: -0.46,
  2015: -0.30, 2016: 0.45, 2017: 0.12, 2018: -0.25, 2019: 0.34,
  2020: -0.21, 2021: 0.55, 2022: 0.07, 2023: -0.11, 2024: -0.03, 2025: -0.05,
};

export const HYSA_RATES: Record<number, number> = {
  1990: 0.055, 1991: 0.050, 1992: 0.042, 1993: 0.035, 1994: 0.040,
  1995: 0.050, 1996: 0.048, 1997: 0.050, 1998: 0.048, 1999: 0.045,
  2000: 0.050, 2001: 0.035, 2002: 0.025, 2003: 0.020, 2004: 0.025,
  2005: 0.035, 2006: 0.045, 2007: 0.048, 2008: 0.030, 2009: 0.015,
  2010: 0.012, 2011: 0.010, 2012: 0.008, 2013: 0.007, 2014: 0.008,
  2015: 0.010, 2016: 0.012, 2017: 0.015, 2018: 0.022, 2019: 0.025,
  2020: 0.008, 2021: 0.005, 2022: 0.030, 2023: 0.045, 2024: 0.050, 2025: 0.042,
};

// Bitcoin annual returns — accurate data, introduced 2010, start price $0.90
export const BTC_ANNUAL_RETURNS: Record<number, number> = {
  2010: 4.8544,     // +485.44%
  2011: 24.3742,    // +2,437.42%
  2012: 1.9333,     // +193.33%
  2013: 64.6301,    // +6,463.01%
  2014: -0.5759,    // -57.59%
  2015: 0.5437,     // +54.37%
  2016: 1.8375,     // +183.75%
  2017: 19.6903,    // +1,969.03%
  2018: -0.7348,    // -73.48%
  2019: 1.0200,     // +102.00%
  2020: 4.0309,     // +403.09%
  2021: 0.7571,     // +75.71%
  2022: -0.6427,    // -64.27%
  2023: 1.9541,     // +195.41%
  2024: 1.9098,     // +190.98%
  2025: 0.0633,     // +6.33%
};

export type StockProfile = CanonicalStockProfile;

export const STOCK_POOL: StockProfile[] = CANONICAL_STOCK_POOL;

/**
 * Normal Mode is intentionally limited to a small, recognizable set of
 * blue-chip stocks. Some IPO mid-window (NVDA 1999, BRK.B 1996) and will
 * unlock when their real IPO year arrives. Complex Mode has no such limit.
 */
export const NORMAL_MODE_TICKERS: ReadonlySet<string> = new Set([
  'AAPL', 'MSFT', 'NVDA', 'INTC', 'CSCO',
  'XOM', 'JPM', 'BRK.B', 'ABT', 'AMGN',
  'KO', 'JNJ',
]);

export const CD_RATES_1Y: Record<number, number> = {
  1990: 0.082, 1991: 0.060, 1992: 0.040, 1993: 0.035, 1994: 0.050,
  1995: 0.058, 1996: 0.055, 1997: 0.056, 1998: 0.055, 1999: 0.053,
  2000: 0.063, 2001: 0.038, 2002: 0.020, 2003: 0.015, 2004: 0.022,
  2005: 0.040, 2006: 0.052, 2007: 0.050, 2008: 0.035, 2009: 0.015,
  2010: 0.012, 2011: 0.010, 2012: 0.008, 2013: 0.006, 2014: 0.006,
  2015: 0.008, 2016: 0.010, 2017: 0.015, 2018: 0.025, 2019: 0.022,
  2020: 0.007, 2021: 0.005, 2022: 0.020, 2023: 0.050, 2024: 0.048, 2025: 0.042,
};

export function getCDRates(year: number): { '1y': number; '2y': number; '5y': number } {
  const base = CD_RATES_1Y[year] ?? 0.03;
  return {
    '1y': base,
    '2y': Math.round((base + 0.005) * 1000) / 1000,
    '5y': Math.round((base + 0.015) * 1000) / 1000,
  };
}

export const HISTORICAL_EVENTS: Record<number, string[]> = {
  1990: ["Economy slowed into recession", "Oil prices spiked from Gulf tensions"],
  1991: ["Gulf War ended, markets rallied", "Tech sector started gaining momentum"],
  1992: ["Economy grew steadily", "Markets posted modest gains"],
  1993: ["Internet went mainstream", "Bond yields stayed low"],
  1994: ["Bond market sold off sharply", "Fed raised rates aggressively"],
  1995: ["Tech stocks surged", "Internet boom picked up steam"],
  1996: ["Greenspan warned of 'irrational exuberance'", "Markets kept climbing anyway"],
  1997: ["Asian financial crisis hit", "US markets weathered the storm"],
  1998: ["Russia defaulted, LTCM collapsed", "Markets crashed then recovered sharply"],
  1999: ["Dot-com mania reached fever pitch", "Y2K fears spread"],
  2000: ["Dot-com bubble burst", "Tech stocks collapsed"],
  2001: ["9/11 attacks devastated markets", "Recession deepened"],
  2002: ["Bear market ground lower", "Enron & WorldCom scandals shook confidence"],
  2003: ["Markets finally rebounded", "Iraq War began"],
  2004: ["Steady gains continued", "Housing market heated up"],
  2005: ["Housing boom accelerated", "Hurricane Katrina hit"],
  2006: ["Markets climbed steadily", "Housing showed cracks"],
  2007: ["Subprime crisis emerged", "Housing market started collapsing"],
  2008: ["Financial crisis devastated markets", "Lehman Brothers collapsed", "Banks were bailed out"],
  2009: ["Markets staged historic rebound", "Massive stimulus was deployed"],
  2010: ["Flash Crash rattled investors", "Recovery continued slowly"],
  2011: ["US credit was downgraded", "European debt crisis escalated"],
  2012: ["Markets posted steady gains", "Central banks eased globally"],
  2013: ["Bull market strengthened", "'Taper tantrum' hit bonds"],
  2014: ["Markets ground higher", "Oil prices crashed 46%"],
  2015: ["China fears rattled markets", "Fed raised rates for first time since 2006"],
  2016: ["Brexit shocked markets", "Trump election sparked rally"],
  2017: ["Markets rose with low volatility", "Tax reform passed"],
  2018: ["Trade war fears grew", "Q4 sell-off wiped out gains"],
  2019: ["Fed cut rates three times", "Trade deal optimism lifted stocks"],
  2020: ["COVID-19 crashed markets 34%", "Historic rebound followed", "Stimulus checks deployed"],
  2021: ["Meme stock mania erupted", "Inflation surged", "Crypto boomed"],
  2022: ["Bear market returned", "Fed hiked rates aggressively", "Crypto collapsed"],
  2023: ["AI boom drove markets higher", "Magnificent Seven dominated gains"],
  2024: ["AI rally continued", "Fed began cutting rates", "Election year volatility"],
  2025: ["Tariff fears weighed on markets", "AI spending came under scrutiny"],
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * Deterministic RNG bridge. When `setGameSeed(n)` is called, every subsequent
 * `gameRandom()` call inside engine init paths returns a reproducible sequence,
 * making whole-game replays bit-identical for debugging. `clearGameSeed()`
 * restores `Math.random()` behavior.
 */
let _seedCounter: number | null = null;
let _seedBase = 0;
export function setGameSeed(seed: number) {
  _seedBase = seed >>> 0;
  _seedCounter = 0;
}
export function clearGameSeed() {
  _seedCounter = null;
  _seedBase = 0;
}
export function isGameSeeded(): boolean {
  return _seedCounter !== null;
}
export function gameRandom(): number {
  if (_seedCounter === null) return Math.random();
  _seedCounter += 1;
  return seededRandom(_seedBase + _seedCounter * 17);
}

function generateTickPrices(startPrice: number, annualReturns: number[], seed: number): number[] {
  const prices = [startPrice];
  let price = startPrice;
  const ticksPerYear = 6; // Must stay 6 to match game engine (60s/year, 10s/tick)
  const subTicks = 3;     // 3 sub-points between each tick → 24 points per year

  for (let y = 0; y < annualReturns.length; y++) {
    const annualReturn = annualReturns[y];
    const targetPrice = price * (1 + annualReturn);

    for (let t = 1; t <= ticksPerYear; t++) {
      // Final tick of the year MUST hit the exact documented year-end price.
      // Intermediate ticks track the linear path with mild, accuracy-preserving
      // noise so a +38% year never visually "crashes" mid-year and a flat year
      // never invents a fake panic. No more ±16% noise / ±7% spike combo.
      let tickTarget: number;
      if (t === ticksPerYear) {
        tickTarget = targetPrice;
      } else {
        const progress = t / ticksPerYear;
        const base = price + (targetPrice - price) * progress;
        const r1 = seededRandom(seed + y * 200 + t);
        const r2 = seededRandom(seed + y * 200 + t + 11);
        const r4 = seededRandom(seed + y * 200 + t + 57);
        // Much higher intra-year volatility. Year-end prices are untouched, so
        // the exact documented annual return is still preserved.
        const moveMag = Math.min(0.6, Math.abs(annualReturn));
        const baseVol = 0.18 + moveMag * 0.45;
        const noise = base * (r1 - 0.5) * baseVol;
        // Two overlapping low-frequency waves so flat years still rally and dip.
        const swing =
          base * Math.sin((t / ticksPerYear) * Math.PI * 2 + r2 * Math.PI * 2) * 0.11 +
          base * Math.sin((t / ticksPerYear) * Math.PI * 4.7 + r4 * Math.PI * 2) * 0.05;
        // Taper toward the year boundary so the exact close isn't a hard jump.
        const taper = Math.sin(progress * Math.PI) ** 0.6;
        tickTarget = Math.max(0.01, base + (noise + swing) * taper);
      }

      const prevPrice = prices[prices.length - 1];
      for (let s = 1; s <= subTicks; s++) {
        const frac = s / (subTicks + 1);
        const interp = prevPrice + (tickTarget - prevPrice) * frac;
        const r3 = seededRandom(seed + y * 800 + t * 20 + s);
        const microNoise = interp * (r3 - 0.5) * 0.09; // ~9% sub-tick wiggle
        prices.push(Math.max(0.01, interp + microNoise));
      }

      prices.push(Math.max(0.01, tickTarget));
    }

    price = Math.max(0.01, targetPrice);
  }

  return prices;
}

export interface GameAssetConfig {
  id: string;
  name: string;
  ticker: string;
  type: 'fund' | 'gold' | 'stock' | 'oil' | 'hysa' | 'crypto';
  prices: number[];
  unlockYear?: number;
}

export function initializeGame(
  forcedStartYear?: number,
  duration: number = 20,
  selectedStockIds?: string[],
  gameMode: 'normal' | 'complex' | 'hard' = 'normal',
): { startYear: number; endYear: number; duration: number; assets: GameAssetConfig[] } {
  const maxStart = 2025 - duration;
  const startYear = forcedStartYear ?? (1990 + Math.floor(gameRandom() * (maxStart - 1990 + 1)));
  const endYear = Math.min(startYear + duration, 2025);
  const actualDuration = endYear - startYear;
  const years = Array.from({ length: actualDuration }, (_, i) => startYear + i);

  // Mutual Fund (S&P 500)
  const sp500Returns = years.map(y => SP500_ANNUAL_RETURNS[y] ?? 0);
  const mutualFund: GameAssetConfig = {
    id: 'sp500', name: 'S&P 500 Index Fund', ticker: 'SPFUND', type: 'fund',
    prices: generateTickPrices(200, sp500Returns, 42),
  };

  // Gold
  const goldReturns = years.map(y => GOLD_ANNUAL_RETURNS[y] ?? 0);
  const gold: GameAssetConfig = {
    id: 'gold', name: 'Gold', ticker: 'GOLD', type: 'gold',
    prices: generateTickPrices(150, goldReturns, 137),
  };

  // Oil
  const oilReturns = years.map(y => OIL_ANNUAL_RETURNS[y] ?? 0);
  const oil: GameAssetConfig = {
    id: 'oil', name: 'Crude Oil', ticker: 'OIL', type: 'oil',
    prices: generateTickPrices(25, oilReturns, 271),
  };

  // High-Yield Savings Account
  const hysaPrices: number[] = [];
  let hysaPrice = 100;
  hysaPrices.push(hysaPrice);
  for (let y = 0; y < years.length; y++) {
    const rate = HYSA_RATES[years[y]] ?? 0.02;
    const targetPrice = hysaPrice * (1 + rate);
    // 6 ticks per year, 3 sub-ticks between each = 24 points per year
    for (let t = 1; t <= 6; t++) {
      const tickTarget = hysaPrice + (targetPrice - hysaPrice) * (t / 6);
      const prevP = hysaPrices[hysaPrices.length - 1];
      for (let s = 1; s <= 3; s++) {
        hysaPrices.push(prevP + (tickTarget - prevP) * (s / 4));
      }
      hysaPrices.push(Math.max(0.01, tickTarget));
    }
    hysaPrice = targetPrice;
  }
  const hysa: GameAssetConfig = {
    id: 'hysa', name: 'High-Yield Savings', ticker: 'HYSA', type: 'hysa',
    prices: hysaPrices,
  };

  const baseAssets: GameAssetConfig[] = [mutualFund, gold, oil, hysa];

  // Bitcoin — Complex mode only, available from 2010, start price $0.90
  if (gameMode === 'complex' && endYear > 2010) {
    const btcStartYear = Math.max(startYear, 2010);
    const btcYears = years.filter(y => y >= 2010);
    const btcReturns = btcYears.map(y => BTC_ANNUAL_RETURNS[y] ?? 0);
    const btcUnlockGameYear = btcStartYear > startYear ? btcStartYear - startYear + 1 : 1;
    // Pre-pad with zeros for years before BTC existed
    const prePadYears = btcStartYear - startYear;
    const prePadReturns = Array(prePadYears).fill(0);
    const allBtcReturns = [...prePadReturns, ...btcReturns];

    const btc: GameAssetConfig = {
      id: 'btc', name: 'Bitcoin', ticker: 'BTC', type: 'crypto',
      prices: generateTickPrices(0.90, allBtcReturns, 999),
      unlockYear: btcUnlockGameYear,
    };
    baseAssets.push(btc);
  }

  // Build stock pool.
  //
  // Eligibility rules (fixes the BlackBerry-in-1990 bug):
  // - Stocks that IPO'd after the game ends are always excluded.
  // - In Hard Mode, the hidden pool MUST only contain companies that were
  //   tradable at the simulation start year — otherwise the player can be
  //   handed a "secret" stock that didn't exist yet.
  // - Normal Mode follows the same rule for the initial draw; the legacy
  //   "unlock during a future IPO year" path is preserved for variety only
  //   if we ever opt back into it (currently the eligible set is the start
  //   set, so future-IPO companies simply don't appear).
  const eligible = STOCK_POOL.filter(s => {
    const ipo = s.ipoYear;
    if (ipo && ipo >= endYear) {
      if (typeof console !== 'undefined') {
        console.warn(`[stock-pool] excluded ${s.ticker} (${s.name}): IPO ${ipo} >= endYear ${endYear}`);
      }
      return false;
    }
    if (gameMode === 'normal') {
      // Normal Mode: locked allowlist of ~12 blue-chip tickers. IPOs after
      // startYear are allowed — they simply unlock later in the run.
      if (!NORMAL_MODE_TICKERS.has(s.ticker)) return false;
      return true;
    }
    if (gameMode === 'hard' && ipo && ipo > startYear) {
      if (typeof console !== 'undefined') {
        console.warn(`[stock-pool] excluded ${s.ticker} (${s.name}) from hard initial pool: IPO ${ipo} > startYear ${startYear}`);
      }
      return false;
    }
    return true;
  });

  let numStocks: number;
  if (gameMode === 'complex') {
    // Complex mode draws every stock from the COMPLEX_UNIVERSE table (via the
    // in-game search + watchlist). The legacy STOCK_POOL set is intentionally
    // skipped here to avoid duplicate listings (e.g. two Apples, two Microsofts).
    numStocks = 0;
  } else if (gameMode === 'normal') {
    // Normal mode: include the entire allowlist so all ~12 blue chips
    // eventually appear (some start unlocked, others unlock at IPO).
    numStocks = eligible.length;
  } else {
    // Hard mode: start with 4, unlock to 8 by year 8 (all eligible at startYear).
    numStocks = Math.min(8, eligible.length);
  }

  let selected: StockProfile[];

  if (selectedStockIds && selectedStockIds.length > 0) {
    const chosen = selectedStockIds
      .map(id => eligible.find(s => s.id === id))
      .filter((s): s is StockProfile => !!s);
    const remaining = eligible.filter(s => !selectedStockIds.includes(s.id));
    const shuffledRemaining = [...remaining].sort(() => gameRandom() - 0.5);
    selected = [...chosen, ...shuffledRemaining.slice(0, Math.max(0, numStocks - chosen.length))];
  } else {
    const shuffled = [...eligible].sort(() => gameRandom() - 0.5);
    selected = shuffled.slice(0, numStocks);
  }

  // Build unlock schedule
  const stocks: GameAssetConfig[] = selected.map((stock, idx) => {
    const returns = years.map(y => {
      if (y < stock.ipoYear) return 0;
      return stock.annualReturns[y] ?? 0;
    });

    let unlockYear: number;
    if (gameMode === 'complex') {
      // In complex mode, unlock based on actual availability
      if (stock.ipoYear > startYear) {
        unlockYear = stock.ipoYear - startYear + 1;
      } else {
        unlockYear = 1;
      }
    } else {
      // Normal mode: 4 start immediately, rest unlock gradually up to year 8
      // User-selected stocks always start at year 1
      if (selectedStockIds?.includes(stock.id)) {
        unlockYear = 1;
      } else if (stock.ipoYear > startYear) {
        // Respect IPO dates
        unlockYear = stock.ipoYear - startYear + 1;
      } else if (idx < 4) {
        // First 4 stocks available immediately
        unlockYear = 1;
      } else {
        // Remaining stocks unlock gradually across the early years.
        const unlockSchedule = [3, 4, 5, 6, 7, 8, 9, 10];
        unlockYear = unlockSchedule[idx - 4] ?? 10;
      }
    }

    return {
      id: stock.id,
      name: stock.name,
      ticker: stock.ticker,
      type: 'stock' as const,
      prices: generateTickPrices(stock.startPrice, returns, idx * 100 + startYear),
      unlockYear,
    };
  });

  return { startYear, endYear, duration: actualDuration, assets: [...baseAssets, ...stocks] };
}

// Compute benchmark: what if all contributions went into one asset
export function computeBenchmark(assetPrices: number[], totalGameSeconds: number = 1200): number {
  let shares = 0;
  shares += 5000 / assetPrices[0];
  for (let s = 15; s < totalGameSeconds; s += 15) {
    const tick = Math.min(Math.floor(s / 10), Math.floor((assetPrices.length - 1) / 4));
    const priceIndex = Math.min(tick * 4, assetPrices.length - 1);
    const price = assetPrices[priceIndex];
    if (price > 0) shares += 5000 / price;
  }
  const finalPrice = assetPrices[assetPrices.length - 1];
  return shares * finalPrice;
}
