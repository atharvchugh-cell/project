// Client Contracts market: real annual returns split into quarters.
// Each year's four quarterly multipliers are drawn from a seeded RNG and then
// rescaled so their product equals exactly 1 + that year's real return. Only
// the path inside a year is synthetic; every year-end matches the data.
import { COMPLEX_UNIVERSE, type ComplexCompany } from '@/data/complexReturns';
import { SP500_ANNUAL_RETURNS, HYSA_RATES } from '@/data/historicalData';

export const SPX = 'SPX';
export const FIRST_YEAR = 1990;
export const LAST_YEAR = 2025;
export const QUARTER_VOL = { stock: 0.09, index: 0.045 };

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());

/** Real annual return (fraction) for a ticker in a year, or undefined when not tradable. */
export function annualReturn(ticker: string, year: number): number | undefined {
  if (ticker === SPX) return SP500_ANNUAL_RETURNS[year];
  const c = COMPANY[ticker];
  if (!c || !isListed(c, year)) return undefined;
  return Math.max(-0.99, c.returns[year] / 100);
}

/** A company is tradable once its first full year of data starts (the IPO year is only an anchor). */
export const isListed = (c: ComplexCompany, year: number) =>
  c.returns[year] !== undefined && (year > c.firstAvailableYear || c.firstAvailableYear === FIRST_YEAR);

export const COMPANY: Record<string, ComplexCompany> = Object.fromEntries(COMPLEX_UNIVERSE.map(c => [c.ticker, c]));
export const listedCompanies = (year: number) => COMPLEX_UNIVERSE.filter(c => isListed(c, year));
export const assetName = (t: string) => (t === SPX ? 'S&P 500 index' : COMPANY[t]?.name ?? t);

/** Four quarterly returns whose compounded product is exactly 1 + annual. */
export function splitYear(annual: number, vol: number, rand: () => number): number[] {
  const g = Math.log(1 + annual);
  const z = [gauss(rand), gauss(rand), gauss(rand), gauss(rand)];
  const mean = z.reduce((a, b) => a + b, 0) / 4;
  return z.map(x => Math.exp(g / 4 + vol * (x - mean)) - 1);
}

export interface FundQuarter { q: number; year: number; qInYear: number; returns: Record<string, number>; cash: number }

const cache = new Map<string, FundQuarter[]>();
export function buildFundMarket(seed: number, startYear: number, years: number): FundQuarter[] {
  const key = `${seed}:${startYear}:${years}`;
  const hit = cache.get(key); if (hit) return hit;
  const rand = mulberry32(seed ^ 0x5eed);
  const out: FundQuarter[] = [];
  for (let y = 0; y < years; y++) {
    const year = startYear + y;
    const per: Record<string, number[]> = {};
    const spx = SP500_ANNUAL_RETURNS[year] ?? 0;
    per[SPX] = splitYear(spx, QUARTER_VOL.index, rand);
    for (const c of COMPLEX_UNIVERSE) {
      const r = annualReturn(c.ticker, year);
      if (r === undefined) continue;
      per[c.ticker] = splitYear(r, QUARTER_VOL.stock, rand);
    }
    const cashQ = Math.pow(1 + (HYSA_RATES[year] ?? 0.02), 0.25) - 1;
    for (let k = 0; k < 4; k++) {
      const returns: Record<string, number> = {};
      for (const [t, arr] of Object.entries(per)) returns[t] = arr[k];
      out.push({ q: y * 4 + k + 1, year, qInYear: k + 1, returns, cash: cashQ });
    }
  }
  if (cache.size > 20) cache.clear();
  cache.set(key, out);
  return out;
}

/** S&P 500 growth multiple over the run (1 = flat). */
export function spxMultiple(startYear: number, years: number) {
  let m = 1; for (let y = 0; y < years; y++) m *= 1 + (SP500_ANNUAL_RETURNS[startYear + y] ?? 0); return m;
}
export const COMPLEX_UNIVERSE_TICKERS = COMPLEX_UNIVERSE.map(c => c.ticker);
