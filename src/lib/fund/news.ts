import { mulberry32, COMPANY } from './market';

export interface MarketNews { id: string; year: number; quarter: number; sector: string; headline: string; sentiment: number; logImpact: number }
const sectors = ['Technology', 'Financials', 'Healthcare', 'Consumer Discretionary', 'Consumer Staples', 'Industrials', 'Energy', 'Materials', 'Communication Services', 'Real Estate', 'Utilities', 'Broad market'];
const hash = (s: string) => { let h = 2166136261; for (const x of s) h = Math.imul(h ^ x.charCodeAt(0), 16777619); return h >>> 0; };
const cache = new Map<number, MarketNews[]>();
/** Fictional news tape. Same calendar path for everyone; annual log impacts sum to zero per sector. */
export function newsYear(year: number): MarketNews[] {
  const hit = cache.get(year); if (hit) return hit;
  const tape = sectors.flatMap(sector => {
    const rand = mulberry32(hash(`news-v1:${year}:${sector}`));
    const scores = Array.from({ length: 4 }, () => (rand() - 0.5) * 0.08);
    const mean = scores.reduce((a, x) => a + x, 0) / 4;
    return scores.map((x, k) => {
      const impact = x - mean;
      const positive = ['Demand accelerated and buyers returned', 'New contracts improved the earnings outlook', 'Lower input costs supported margins', 'A product cycle drew fresh investment'];
      const negative = ['Margin pressure prompted selling', 'Slower orders weighed on confidence', 'Supply disruptions increased costs', 'Regulatory scrutiny unsettled investors'];
      return { id: `news-${year}-${k + 1}-${sector}`, year, quarter: k + 1, sector, sentiment: Math.round(impact * 250), logImpact: impact, headline: `${sector}: ${(impact >= 0 ? positive : negative)[hash(`${year}:${sector}:${k}:headline`) % 4]}` };
    });
  });
  if (cache.size >= 40) cache.clear();
  cache.set(year, tape);
  return tape;
}
export const newsQuarter = (year: number, quarter: number) => newsYear(year).filter(x => x.quarter === quarter);
/** Use the shared classification; unclassified tickers receive broad-market exposure. */
export const newsSector = (ticker: string) => sectors.includes(COMPANY[ticker]?.sector) ? COMPANY[ticker].sector : 'Broad market';
export const newsImpact = (ticker: string, year: number, quarter: number) => newsQuarter(year, quarter).find(x => x.sector === newsSector(ticker))?.logImpact ?? 0;

export function enableNews<T extends { status: string; fund: { marketRule?: 'calendar'; newsFromYear?: number; startYear: number; q: number } }>(c: T): T {
  if (c.status !== 'running' || c.fund.marketRule !== 'calendar' || c.fund.newsFromYear !== undefined) return c;
  const n = structuredClone(c);
  n.fund.newsFromYear = n.fund.startYear + Math.ceil(n.fund.q / 4);
  return n;
}