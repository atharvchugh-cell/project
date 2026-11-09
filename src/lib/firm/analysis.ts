// Staff research process. Past-only: it reads completed quarters through companyTrackRecord (never the
// current or future quarters) and never changes prices. Skill and sector experience change four bounded,
// measurable things: how many companies are screened, how large the analytical error is, how the
// evidence is weighed against uncertainty (conviction), and portfolio discipline (crowding penalty and size).
// Nothing here guarantees a profit: the "past score" is a shrunk trailing excess return, a weak signal.
import { companyTrackRecord } from '@/lib/fund/exploration';
import { SPX, currentYear } from '@/lib/fund/engine';
import { listedCompanies } from '@/lib/fund/market';
import { netAssets } from '@/lib/fund/accounting';
import type { Career } from './career';
import type { Employee } from './roster';

export interface Analysis {
  considered: number; universe: number; evidenceQ: number; pastScore: number; estimate: number;
  errorSd: number; uncertainty: number; certainty: number; heldWeight: number; crowdPenalty: number;
  suggestedSize: number; skill: number; experience: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Effective skill: 70% ability, 30% tenure (up to 3 years). Bounded 0-1. */
export function skillOf(c: Career, e: Employee) {
  const ability = clamp01((Number.isFinite(e.ability) ? e.ability : 0) / 100);
  const experience = clamp01((c.fund.q - (e.joinedQ ?? c.fund.q)) / 12);
  return { skill: clamp01(0.7 * ability + 0.3 * experience), ability, experience };
}
export const errorSdFor = (skill: number) => 0.04 * (1 - 0.8 * clamp01(skill));
export const screenSizeFor = (skill: number) => 2 + Math.round(clamp01(skill) * 6);

/** Shrunk mean quarterly excess return over the last eight completed quarters, and its standard error. */
export function pastEvidence(c: Career, ticker: string) {
  const rec = companyTrackRecord(c.fund, ticker).slice(-8);
  const spx = new Map(companyTrackRecord(c.fund, SPX).map(r => [r.q, r.return / 100]));
  const ex = rec.map(r => r.return / 100 - (spx.get(r.q) ?? 0));
  const n = ex.length;
  if (!n) return { n, score: 0, se: 0.08 };
  const mean = ex.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(ex.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0.1;
  return { n, score: mean * (n / (n + 4)), se: sd / Math.sqrt(n) + 0.06 / Math.sqrt(n + 1) };
}

function gauss(rand: () => number) { const u = Math.max(1e-9, rand()); const v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/**
 * Screen the analyst's sector and pick one company. Random draws are a fixed count per sector list, so two
 * analysts with the same seed see identical luck and differ only by skill.
 */
export function analyze(c: Career, e: Employee, rand: () => number, sector = e.assignment): { ticker: string; name: string; sector: string; analysis: Analysis } | null {
  const list = listedCompanies(currentYear(c.fund)).filter(x => x.sector === sector);
  if (!list.length) return null;
  const { skill, experience } = skillOf(c, e);
  const order = list.map(x => ({ x, k: rand() }));
  const noise = list.map(() => gauss(rand));
  order.sort((a, b) => a.k - b.k);
  const k = Math.min(list.length, screenSizeFor(skill)); const errorSd = errorSdFor(skill);
  const na = Math.max(1, netAssets(c.fund.ledger));
  let best: { ticker: string; name: string; sector: string; analysis: Analysis } | null = null;
  for (let j = 0; j < k; j++) {
    const co = order[j].x; const ev = pastEvidence(c, co.ticker);
    const heldWeight = (c.fund.ledger.positions[co.ticker] ?? 0) / na;
    const crowdPenalty = heldWeight * 0.2 * skill;
    const estimate = ev.score + noise[list.indexOf(co)] * errorSd - crowdPenalty;
    const uncertainty = Math.sqrt(ev.se ** 2 + errorSd ** 2);
    const certainty = clamp01(0.5 + estimate / uncertainty / 4) * (ev.n / (ev.n + 2));
    const suggestedSize = Math.min(0.03, (0.005 + 0.025 * certainty * (0.5 + 0.5 * skill)) * (heldWeight > 0.05 ? 0.5 : 1));
    if (!best || estimate > best.analysis.estimate) best = { ticker: co.ticker, name: co.name, sector: co.sector, analysis: { considered: k, universe: list.length, evidenceQ: ev.n, pastScore: ev.score, estimate, errorSd, uncertainty, certainty, heldWeight, crowdPenalty, suggestedSize, skill, experience } };
  }
  return best;
}

export const convictionOf = (a: Analysis) => Math.max(1, Math.min(5, Math.round(1 + 4 * a.certainty)));

export function analysisFactors(a: Analysis): { label: string; value: string }[] {
  const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
  return [
    { label: 'Companies screened', value: `${a.considered} of ${a.universe}` },
    { label: 'Completed quarters of evidence', value: String(a.evidenceQ) },
    { label: 'Past excess return a quarter (shrunk)', value: pct(a.pastScore, 2) },
    { label: "Analyst's estimate", value: pct(a.estimate, 2) },
    { label: 'Analytical error (lower with skill)', value: `±${pct(a.errorSd, 2)}` },
    { label: 'Total uncertainty', value: `±${pct(a.uncertainty, 2)}` },
    { label: 'Certainty', value: `${Math.round(a.certainty * 100)}/100` },
    { label: 'Crowding penalty (already held)', value: pct(a.crowdPenalty, 2) },
    { label: 'Suggested size', value: pct(a.suggestedSize) },
  ];
}
