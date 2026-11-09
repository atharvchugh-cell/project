// Client Contracts calendar market (new saves). One fixed quarterly path for everyone, built only
// from the project's existing annual data:
// - The S&P 500's within-year shape follows its historical quarterly pattern (approximate price-return
//   shape below), then is rescaled in log space so the four quarters compound to exactly the annual
//   return in SP500_ANNUAL_RETURNS. Big moves land in the quarter they happened (Q4 2008, Q1 2020).
// - Each stock follows the index's within-year shape scaled by a fixed sensitivity, plus a fixed
//   company-specific wobble, rescaled so its four quarters compound to exactly its annual return.
// No seed is involved, so quarterly percentages are the same in every Client Contracts game.
import { COMPLEX_UNIVERSE } from '@/data/complexReturns';
import { HYSA_RATES, SP500_ANNUAL_RETURNS } from '@/data/historicalData';
import { type FundQuarter, SPX, annualReturn, mulberry32 } from './market';
import { newsImpact } from './news';

/** Historical S&P 500 quarterly price-return shape, percent. Used only for timing; levels come from the annual data. */
export const SPX_QUARTER_SHAPE: Record<number, [number, number, number, number]> = {
  1990: [-3.0, 5.3, -14.5, 7.9], 1991: [13.6, -1.1, 4.5, 7.5], 1992: [-3.2, 1.0, 2.6, 4.6], 1993: [3.7, -0.3, 2.0, 1.6],
  1994: [-4.4, -0.3, 4.4, -0.7], 1995: [9.0, 8.8, 7.3, 5.4], 1996: [4.8, 3.9, 2.5, 7.8], 1997: [2.2, 16.9, 7.0, 2.4],
  1998: [13.5, 2.9, -10.3, 20.9], 1999: [4.6, 6.7, -6.6, 14.5], 2000: [2.0, -2.9, -1.2, -8.1], 2001: [-12.1, 5.5, -15.0, 10.3],
  2002: [-0.1, -13.7, -17.6, 7.9], 2003: [-3.6, 14.9, 2.2, 11.6], 2004: [1.3, 1.3, -2.3, 8.7], 2005: [-2.6, 0.9, 3.1, 1.6],
  2006: [3.7, -1.9, 5.2, 6.2], 2007: [0.2, 5.8, 1.6, -3.8], 2008: [-9.9, -3.2, -9.0, -22.6], 2009: [-11.7, 15.2, 15.0, 5.5],
  2010: [4.9, -11.9, 10.7, 10.2], 2011: [5.4, -0.4, -14.3, 11.2], 2012: [12.0, -3.3, 5.8, -1.0], 2013: [10.0, 2.4, 4.7, 9.9],
  2014: [1.3, 4.7, 0.6, 4.4], 2015: [0.4, -0.2, -6.9, 6.5], 2016: [0.8, 1.9, 3.3, 3.3], 2017: [5.5, 2.6, 4.0, 6.1],
  2018: [-1.2, 2.9, 7.2, -14.0], 2019: [13.1, 3.8, 1.2, 8.5], 2020: [-20.0, 20.0, 8.5, 11.7], 2021: [5.8, 8.2, 0.2, 10.6],
  2022: [-4.9, -16.4, -5.3, 7.1], 2023: [7.0, 8.3, -3.6, 11.2], 2024: [10.2, 3.9, 5.5, 2.1], 2025: [-4.6, 10.6, 7.8, 2.3],
};

/** Market headlines, posted only after the quarter closes (past tense, never ahead of time). */
export const MARKET_EVENTS: Record<string, string> = {
  '1990-3': 'Iraq invaded Kuwait. Oil spiked and stocks fell sharply.',
  '1997-4': 'The Asian financial crisis spread through currency markets.',
  '1998-3': 'Russia defaulted and the hedge fund LTCM collapsed. Stocks slid before rebounding.',
  '2000-2': 'Technology stocks fell hard as the dot-com bubble began to deflate.',
  '2001-3': 'Markets closed for days after the September 11 attacks, then reopened sharply lower.',
  '2002-3': 'Accounting scandals and a long bear market pushed stocks to multi-year lows.',
  '2008-3': 'Lehman Brothers failed and credit markets froze.',
  '2008-4': 'The financial crisis deepened. Stocks had one of their worst quarters on record.',
  '2009-2': 'Stocks rallied hard off their March lows.',
  '2010-2': 'The Flash Crash and Europe’s debt worries hit stocks.',
  '2011-3': 'The United States lost its AAA credit rating and stocks dropped.',
  '2015-3': 'Worries about China’s economy triggered a sharp August sell-off.',
  '2018-4': 'Rate fears and trade tensions drove a steep December decline.',
  '2020-1': 'The COVID-19 pandemic triggered the fastest crash in market history.',
  '2020-2': 'Emergency stimulus fuelled a record rebound.',
  '2022-2': 'Inflation and rapid rate hikes pushed stocks into a bear market.',
  '2023-1': 'Several regional banks failed, including Silicon Valley Bank.',
};
export const eventFor = (year: number, qInYear: number) => MARKET_EVENTS[`${year}-${qInYear}`];

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/** Four quarterly log moves rescaled so they sum to log(1 + annual). */
function rescale(logs: number[], annual: number): number[] {
  const target = Math.log(1 + annual); const sum = logs.reduce((a, b) => a + b, 0);
  return logs.map(x => x + (target - sum) / 4);
}

export function indexQuarters(year: number): number[] {
  const shape = SPX_QUARTER_SHAPE[year] ?? [0, 0, 0, 0];
  return rescale(shape.map(p => Math.log(1 + p / 100)), SP500_ANNUAL_RETURNS[year] ?? 0).map(x => Math.exp(x) - 1);
}

/** Fixed per-company sensitivity to the index's within-year moves (0.7 to 1.4). */
export const sensitivity = (ticker: string) => 0.7 + (hash(ticker) % 1000) / 1000 * 0.7;

export function stockQuarters(ticker: string, year: number, news = false): number[] | undefined {
  const r = annualReturn(ticker, year); if (r === undefined) return undefined;
  const idx = indexQuarters(year).map(x => Math.log(1 + x));
  const mean = idx.reduce((a, b) => a + b, 0) / 4;
  const rand = mulberry32(hash(`${ticker}:${year}`));
  const wobble = [0, 1, 2, 3].map(() => (rand() - 0.5) * 0.12);
  const wm = wobble.reduce((a, b) => a + b, 0) / 4;
  const beta = sensitivity(ticker);
  const base = rescale(idx.map((x, k) => beta * (x - mean) + wobble[k] - wm), r);
  return base.map((x, k) => Math.exp(x + (news ? newsImpact(ticker, year, k + 1) : 0)) - 1);
}

const cache = new Map<string, FundQuarter[]>();
export function buildCalendarMarket(startYear: number, years: number, newsFromYear?: number): FundQuarter[] {
  const key = `${startYear}:${years}:${newsFromYear ?? 'legacy'}`; const hit = cache.get(key); if (hit) return hit;
  const out: FundQuarter[] = [];
  for (let y = 0; y < years; y++) {
    const year = startYear + y;
    const per: Record<string, number[]> = { [SPX]: indexQuarters(year) };
    for (const c of COMPLEX_UNIVERSE) { const qs = stockQuarters(c.ticker, year, newsFromYear !== undefined && year >= newsFromYear); if (qs) per[c.ticker] = qs; }
    const cashQ = Math.pow(1 + (HYSA_RATES[year] ?? 0.02), 0.25) - 1;
    for (let k = 0; k < 4; k++) out.push({ q: y * 4 + k + 1, year, qInYear: k + 1, returns: Object.fromEntries(Object.entries(per).map(([t, a]) => [t, a[k]])), cash: cashQ });
  }
  if (cache.size > 20) cache.clear();
  cache.set(key, out);
  return out;
}
