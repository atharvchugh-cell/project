// Public-company events (earnings, mergers, management changes, analyst calls, index moves).
// Deterministic per fund seed + quarter on their own stream, so they never change other draws.
// They act only through coverage sentiment, which already feeds the valuation multiple and
// reputation; they never move cash, fund NAV or historical ticker prices.
import type { Career } from './career';

export type PublicEventKind = 'earnings' | 'merger' | 'management' | 'analyst' | 'index';
export interface PublicEvent { q: number; kind: PublicEventKind; headline: string; body: string; sentiment: number }

const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

const PARTNERS = ['Northgate Advisors', 'Meridian Wealth', 'Calloway Capital', 'Silverline Partners', 'Ashford Asset Management', 'Brightwater Group'];
const EXECS = ['Dana Whitfield', 'Marcus Oyelaran', 'Priya Raman', 'Tomas Lindqvist', 'Elena Vasquez', 'Graham Choi'];

/** Events for the quarter just closed. `edge` = fund return minus S&P 500; `epsGrowth` vs prior quarter. */
export function publicEventsFor(c: Career, q: number, edge: number, epsGrowth: number): PublicEvent[] {
  const r = rng(c.fund.seed * 7919 + q * 104729 + 17);
  const firm = c.firmName; const out: PublicEvent[] = [];
  // Earnings every quarter: beat or miss depends on real earnings growth and fund results.
  const surprise = epsGrowth * 0.6 + edge * 2 + (r() - 0.5) * 0.04;
  out.push(surprise >= 0
    ? { q, kind: 'earnings', headline: `${firm} beat earnings estimates`, body: `Earnings per share changed ${pct(epsGrowth)} on the quarter, ahead of what analysts expected.`, sentiment: surprise > 0.05 ? 2 : 1 }
    : { q, kind: 'earnings', headline: `${firm} missed earnings estimates`, body: `Earnings per share changed ${pct(epsGrowth)} on the quarter, below what analysts expected.`, sentiment: surprise < -0.05 ? -2 : -1 });
  const roll = r();
  if (roll < 0.12) {
    const partner = pick(r, PARTNERS); const good = r() < 0.5 + edge * 3;
    out.push(good
      ? { q, kind: 'merger', headline: `${firm} agreed to merge with ${partner}`, body: `Investors cheered the deal, expecting more clients and lower costs per dollar managed.`, sentiment: 3 }
      : { q, kind: 'merger', headline: `${firm} merger talks with ${partner} collapsed`, body: 'Shareholders were disappointed after months of speculation.', sentiment: -2 });
  } else if (roll < 0.22) {
    const exec = pick(r, EXECS); const good = r() < 0.55;
    out.push(good
      ? { q, kind: 'management', headline: `${firm} hired ${exec} as chief operating officer`, body: 'The market welcomed a seasoned operator joining the leadership team.', sentiment: 2 }
      : { q, kind: 'management', headline: `${firm}'s finance chief ${exec} resigned`, body: 'The sudden departure raised questions about internal controls.', sentiment: -3 });
  } else if (roll < 0.34) {
    const up = edge >= 0;
    out.push({ q, kind: 'analyst', headline: up ? `Analysts upgraded ${firm} to buy` : `Analysts downgraded ${firm} to sell`, body: up ? 'They pointed to fund results ahead of the market.' : 'They pointed to fund results trailing the market.', sentiment: up ? 2 : -2 });
  } else if (roll < 0.38 && edge > 0) {
    out.push({ q, kind: 'index', headline: `${firm} joined a major stock index`, body: 'Index funds had to buy the shares, widening the investor base.', sentiment: 3 });
  }
  return out;
}

export const eventsSentiment = (events: PublicEvent[]) => events.reduce((a, e) => a + e.sentiment, 0);
