// Staff depth: research for every role, training, delegated sleeves and track records.
// Delegated sleeves never hold separate money: a staff member's ideas become ordinary
// pending orders for the next close, inside a dollar budget and per-position limit,
// executed by the same fund engine and competing for the same fund cash.
import { netAssets } from '@/lib/fund/accounting';
import { quarterLabel } from '@/lib/fund/engine';
import type { Career, Idea } from './career';
import { payOrOwe } from './payables';
import { type Employee, isResearcher, withAbility } from './roster';
import { researchBonus } from './life';
import { ideaPnl, lotValue } from './attribution';

export interface Mandate { budget: number; maxPosition: number; minConviction: number; setQ: number }

/** Research speed per quarter (1 = a pitch). Specialists research at half speed because their main role still takes their time. */
export function researchRate(c: Career, e: Employee) {
  const role = isResearcher(e) ? 1 : 0.5;
  const tired = e.morale < 35 ? 0.8 : 1;
  return (0.3 + e.ability / 250) * role * tired * (1 + researchBonus(c));
}
export const researchNote = (e: Employee) => (isResearcher(e) ? 'Full-time research' : 'Half speed: their main role still comes first');

/** Training: a quarter of courses. Costs 15% of salary (firm pays, or owes), ability +3 toward potential, morale +3. Once a year. */
export const TRAIN_COOLDOWN = 4;
export function trainCooldown(c: Career, e: Employee) { return e.trainedQ === undefined ? 0 : Math.max(0, e.trainedQ + TRAIN_COOLDOWN - c.fund.q); }
export function train(c: Career, id: string): { c: Career; message: string; ok: boolean } {
  const e = c.roster.find(x => x.id === id);
  if (!e || c.status !== 'running') return { c, ok: false, message: 'Not available.' };
  if (trainCooldown(c, e) > 0) return { c, ok: false, message: `${e.name} can train again in ${trainCooldown(c, e)} quarter(s).` };
  const n: Career = structuredClone(c);
  const cost = Math.round(e.salaryQ * 0.15);
  payOrOwe(n, { q: n.fund.q, kind: 'event', category: 'training', amount: cost, memo: `Training for ${e.name}`, source: `train:${id}:${n.fund.q}` });
  const x = n.roster.find(y => y.id === id)!; const before = x.ability;
  x.ability = withAbility(x, x.ability + 3); x.morale = Math.min(100, x.morale + 3); x.trainedQ = n.fund.q;
  return { c: n, ok: true, message: x.ability > before ? `${x.name}: ability ${before.toFixed(0)} → ${x.ability.toFixed(0)}.` : `${x.name} is at their potential; training only lifted morale.` };
}

/**
 * Delegated sleeves. Rule: a delegate's sleeve is the live market value of the stock its approved ideas still own
 * (from execution receipts) plus its not-yet-executed orders. Reviewing an idea frees nothing; capital is freed
 * only when the fund actually sells that stock (any sale is pro rata across holders). When a delegate leaves,
 * their remaining lots become ordinary house positions and stop counting. All mandates together, and all sleeves
 * together, stay within 15% of fund net assets at every entry point and are re-checked at each close.
 */
export const MAX_DELEGATED = 0.15;
const finite = (...v: unknown[]) => v.every(x => typeof x === 'number' && Number.isFinite(x));
export function setMandate(c: Career, id: string, m: Omit<Mandate, 'setQ'> | null): Career {
  if (c.status !== 'running') return c;
  if (m && (!finite(m.budget, m.maxPosition, m.minConviction) || m.budget < 0 || m.maxPosition <= 0)) return c;
  if (!c.roster.some(e => e.id === id)) return c;
  const aum = netAssets(c.fund.ledger);
  const others = c.roster.filter(e => e.id !== id && e.mandate).reduce((a, e) => a + e.mandate!.budget, 0);
  return { ...c, roster: c.roster.map(e => {
    if (e.id !== id) return e;
    if (!m) { const { mandate: _drop, ...rest } = e; return rest as Employee; }
    const budget = Math.max(0, Math.min(m.budget, aum * MAX_DELEGATED - others));
    return { ...e, mandate: { budget, maxPosition: Math.max(0.01, Math.min(0.05, m.maxPosition)), minConviction: Math.max(1, Math.min(5, Math.round(m.minConviction))), setQ: c.fund.q } };
  }) };
}

const pendingFor = (c: Career, ideaIds: Set<string>) => c.pendingOrders.filter(o => o.ideaId && ideaIds.has(o.ideaId)).reduce((a, o) => a + Math.max(0, o.amount), 0);
/** Capital a delegate is using now: live value of its delegated lots plus its unexecuted orders. */
export function sleeveUsed(c: Career, id: string) {
  const mine = c.ideas.filter(i => i.delegated && i.analystId === id);
  return mine.reduce((a, i) => a + lotValue(c, i), 0) + pendingFor(c, new Set(mine.map(i => i.id)));
}
/** All current delegates together. */
export const delegatedUsed = (c: Career) => c.roster.filter(e => e.mandate).reduce((a, e) => a + sleeveUsed(c, e.id), 0);

/** At each close: shrink mandate budgets pro rata if together they exceed 15% of current net assets. */
export function enforceDelegationCap(n: Career) {
  const cap = netAssets(n.fund.ledger) * MAX_DELEGATED; const total = n.roster.reduce((a, e) => a + (e.mandate?.budget ?? 0), 0);
  if (!(total > cap) || total <= 0) return;
  const k = Math.max(0, cap) / total;
  n.roster = n.roster.map(e => (e.mandate ? { ...e, mandate: { ...e.mandate, budget: e.mandate.budget * k } } : e));
}

/**
 * Called by phase2 when a delegate pitches: within mandate and conviction threshold, the idea is approved and sized
 * by the analyst's suggested size, the mandate, the delegate's remaining sleeve and the firm-wide 15% cap.
 */
export function delegateIdea(n: Career, e: Employee, idea: Idea): number {
  const m = e.mandate; if (!m) return 0;
  if (idea.conviction < m.minConviction) { idea.thesis += ` (Below ${e.name}'s conviction bar of ${m.minConviction}; left for you.)`; return 0; }
  const aum = netAssets(n.fund.ledger); if (!(aum > 0)) return 0;
  const size = idea.analysis ? idea.analysis.suggestedSize : m.maxPosition;
  const amt = Math.min(m.budget - sleeveUsed(n, e.id), aum * Math.min(m.maxPosition, size), aum * MAX_DELEGATED - delegatedUsed(n));
  if (!(amt >= aum * 0.001)) { idea.thesis += ' (Sleeve or firm-wide 15% delegation limit used up; left for you.)'; return 0; }
  idea.status = 'approved'; idea.size = amt / aum; idea.decidedQ = n.fund.q; idea.delegated = true; idea.proposed = amt;
  n.pendingOrders.push({ ticker: idea.ticker, amount: amt, ideaId: idea.id });
  return amt;
}

/**
 * Actual record from execution receipts: realized + unrealized P&L after trading costs and the same-dollars
 * S&P 500 comparison. The one-year "idea review" (result/bench) is a separate hypothetical buy-and-hold check.
 */
export function trackRecord(c: Career, id: string) {
  const mine = c.ideas.filter(i => i.analystId === id);
  const reviewed = mine.filter(i => i.reviewedQ !== undefined && i.result !== undefined);
  const funded = mine.filter(i => i.status === 'approved' && i.lot && i.lot.invested > 0);
  const p = funded.map(i => ideaPnl(c, i));
  const sum = (k: keyof ReturnType<typeof ideaPnl>) => p.reduce((a, x) => a + (x[k] as number), 0);
  const hits = reviewed.filter(i => (i.result ?? 0) > (i.bench ?? 0)).length;
  return {
    pitched: mine.length, reviewed: reviewed.length, hitRate: reviewed.length ? hits / reviewed.length : null,
    proposed: mine.filter(i => i.delegated).reduce((a, i) => a + (i.proposed ?? 0), 0),
    filled: funded.reduce((a, i) => a + (i.lot?.invested ?? 0), 0), open: sleeveUsed(c, id), value: sum('value'),
    realized: sum('realized'), unrealized: sum('unrealized'), costs: sum('costs'), pnl: sum('pnl'), benchPnl: sum('benchPnl'), vsBench: sum('vsBench'), funded: funded.length,
    estimatedSplit: p.some(x => x.estimatedSplit),
    period: funded.length ? `${quarterLabel(c.fund, Math.min(...funded.map(i => i.lot!.firstQ)))} to ${quarterLabel(c.fund, c.fund.q)}` : null,
  };
}
