// Personal ventures: businesses the founder buys with personal cash. They are separate from the firm's
// subsidiaries: purchase, expansion, quarterly profit and sale post only between the founder and outside
// parties in the journal, so firm cash and fund NAV never move. Deterministic: no randomness.
import { quarterLabel } from '@/lib/fund/engine';
import { netAssets } from '@/lib/fund/accounting';
import type { Career } from './career';
import { post } from './journal';
import { lifeOf, personalCash } from './life';

export interface VentureType {
  id: string; name: string; industry: string; blurb: string;
  price: number; revenueQ: number; costQ: number;
  /** Organic quarterly growth. */ growthQ: number;
  /** Sale value = yearly profit x multiple. */ multiple: number;
  /** 0..1: how much revenue rises as your firm manages more money (referrals, prestige, clients). */ firmLinked: number;
}
export interface VentureRecord { q: number; revenue: number; cost: number; profit: number; reinvested: number; paidOut: number }
export interface Venture {
  id: string; typeId: string; name: string; industry: string; boughtQ: number;
  /** Purchase price plus every expansion paid. */ invested: number;
  level: number; revenueQ: number; costQ: number; reinvestPct: number;
  lastExpandQ?: number; history: VentureRecord[]; soldQ?: number; salePrice?: number;
}

const V = (id: string, name: string, industry: string, price: number, revenueQ: number, margin: number, growthQ: number, multiple: number, firmLinked: number, blurb: string): VentureType =>
  ({ id, name, industry, price, revenueQ, costQ: revenueQ * (1 - margin), growthQ, multiple, firmLinked, blurb });

/** Fictional businesses. Figures are game assumptions, not real listings. */
export const VENTURES: VentureType[] = [
  V('v-coffee', 'Corner coffee roaster', 'hospitality', 400e3, 90e3, 0.18, 0.01, 4, 0.1, 'Two cafes and a roastery. Small, steady and local.'),
  V('v-carwash', 'Express car wash chain', 'services', 2.5e6, 420e3, 0.3, 0.008, 5, 0, 'Four sites with subscription members. Very little drama.'),
  V('v-gym', 'Boutique fitness studios', 'hospitality', 6e6, 900e3, 0.22, 0.015, 5, 0.15, 'Premium classes. Your clients like to be seen there.'),
  V('v-newsletter', 'Markets newsletter', 'fintech', 12e6, 1.4e6, 0.45, 0.012, 7, 0.6, 'Subscribers grow as your fund gets famous.'),
  V('v-vineyard', 'Hillside vineyard', 'hospitality', 35e6, 2.6e6, 0.25, 0.01, 8, 0.2, 'Wine, tastings and a waiting list for the reserve label.'),
  V('v-software', 'Trading software studio', 'fintech', 80e6, 7e6, 0.35, 0.02, 9, 0.5, 'Tools other funds license. Bigger firm, bigger customers.'),
  V('v-hotels', 'Boutique hotel group', 'hospitality', 260e6, 24e6, 0.24, 0.012, 8, 0.25, 'Six city hotels. Your investor dinners fill the rooms.'),
  V('v-team', 'Pro sports franchise', 'sports', 1.2e9, 70e6, 0.18, 0.015, 12, 0.3, 'A city team with a loyal crowd and rising media rights.'),
  V('v-bank', 'Private bank', 'fintech', 4e9, 260e6, 0.32, 0.012, 10, 0.7, 'Wealthy families bank here. Your fund\'s fame sends them in.'),
];
export const ventureType = (id: string) => VENTURES.find(v => v.id === id);

export const MAX_LEVEL = 5;
export const REINVEST_OPTIONS = [0, 0.25, 0.5, 1] as const;
export const EXPAND_REVENUE = 0.3; export const EXPAND_COST = 0.3;
export const SALE_FEE = 0.05;

type R = { c: Career; ok: boolean; message: string };
const fail = (c: Career, message: string): R => ({ c, ok: false, message });
const fmt = (v: number) => { const a = Math.abs(v); return `${v < 0 ? '-' : ''}${a >= 1e9 ? `$${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : `$${Math.round(a / 1e3)}K`}`; };
const lbl = (c: Career) => (c.fund.q > 0 ? quarterLabel(c.fund, c.fund.q) : 'Opening');

export const venturesOf = (c: Career): Venture[] => lifeOf(c).ventures ?? [];
export const ownedVentures = (c: Career) => venturesOf(c).filter(v => v.soldQ === undefined);

/** Revenue boost from the size of the firm: +15% per 10x of money managed above $1B, capped at +60%, scaled by the venture's link. */
export function firmLift(c: Career, v: Pick<Venture, 'typeId'>): number {
  const linked = ventureType(v.typeId)?.firmLinked ?? 0;
  const aum = Math.max(1, netAssets(c.fund.ledger));
  return 1 + linked * Math.min(0.6, Math.max(0, Math.log10(aum / 1e9)) * 0.15);
}
/** The next quarter of a venture, the single projection used by the screen and the close. */
export function ventureQuarter(c: Career, v: Venture) {
  const revenue = v.revenueQ * firmLift(c, v); const cost = v.costQ; const profit = revenue - cost;
  const reinvested = Math.max(0, profit) * v.reinvestPct;
  return { revenue, cost, profit, reinvested, paidOut: profit - reinvested };
}
export const ventureValue = (c: Career, v: Venture) => Math.max(0, ventureQuarter(c, v).profit * 4 * (ventureType(v.typeId)?.multiple ?? 5));
export const venturesValue = (c: Career) => ownedVentures(c).reduce((a, v) => a + ventureValue(c, v), 0);
/** All-time totals across every business ever owned, kept or sold, from the saved quarterly records. */
export function venturesLifetime(c: Career) {
  let profit = 0; let paid = 0; let reinvested = 0;
  for (const v of venturesOf(c)) for (const h of v.history) { profit += h.profit; paid += h.paidOut; reinvested += h.reinvested; }
  return { profit, paid, reinvested };
}
export const expansionCost = (v: Venture) => (ventureType(v.typeId)?.price ?? v.invested) * 0.5 * v.level;

function clone(c: Career): Career { const n: Career = structuredClone(c); n.life = lifeOf(n); n.life.ventures ??= []; return n; }

export function buyVenture(c: Career, typeId: string): R {
  const t = ventureType(typeId); if (!t) return fail(c, 'That business is not for sale.');
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  if (ownedVentures(c).some(v => v.typeId === typeId)) return fail(c, `You already own ${t.name}.`);
  if (personalCash(c) < t.price) return fail(c, `You need ${fmt(t.price)} of personal cash; you have ${fmt(personalCash(c))}.`);
  const n = clone(c); const id = `venture-${typeId}-${n.fund.q}`;
  post(n.journal, { q: n.fund.q, date: lbl(n), payer: 'founder', recipient: 'external', category: 'purchase', amount: t.price, source: `venture:buy:${id}`, memo: `Bought ${t.name}` });
  n.life!.ventures!.push({ id, typeId, name: t.name, industry: t.industry, boughtQ: n.fund.q, invested: t.price, level: 1, revenueQ: t.revenueQ, costQ: t.costQ, reinvestPct: 0, history: [] });
  return { c: n, ok: true, message: `You bought ${t.name} for ${fmt(t.price)}. Its profit reaches your personal cash at each close.` };
}

export function expandVenture(c: Career, id: string): R {
  const v0 = ownedVentures(c).find(v => v.id === id); if (!v0) return fail(c, 'You do not own that business.');
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  if (v0.level >= MAX_LEVEL) return fail(c, `${v0.name} is already at full size.`);
  if (v0.lastExpandQ === c.fund.q) return fail(c, 'One expansion per quarter.');
  const cost = expansionCost(v0);
  if (personalCash(c) < cost) return fail(c, `Expanding costs ${fmt(cost)} of personal cash; you have ${fmt(personalCash(c))}.`);
  const n = clone(c); const v = n.life!.ventures!.find(x => x.id === id)!;
  post(n.journal, { q: n.fund.q, date: lbl(n), payer: 'founder', recipient: 'external', category: 'purchase', amount: cost, source: `venture:expand:${id}:${v.level}`, memo: `Expanded ${v.name} to level ${v.level + 1}` });
  v.level += 1; v.invested += cost; v.lastExpandQ = n.fund.q;
  v.revenueQ *= 1 + EXPAND_REVENUE; v.costQ *= 1 + EXPAND_COST;
  return { c: n, ok: true, message: `${v.name} expanded to level ${v.level}: revenue and costs up 30% from the next close.` };
}

export function setVentureReinvest(c: Career, id: string, pct: number): R {
  if (!(REINVEST_OPTIONS as readonly number[]).includes(pct)) return fail(c, 'Choose 0%, 25%, 50% or 100%.');
  if (!ownedVentures(c).some(v => v.id === id)) return fail(c, 'You do not own that business.');
  const n = clone(c); n.life!.ventures!.find(x => x.id === id)!.reinvestPct = pct;
  return { c: n, ok: true, message: pct ? `Reinvesting ${pct * 100}% of profit into growth.` : 'All profit goes to your personal cash.' };
}

export function sellVenture(c: Career, id: string): R {
  const v0 = ownedVentures(c).find(v => v.id === id); if (!v0) return fail(c, 'You do not own that business.');
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  if (v0.boughtQ === c.fund.q) return fail(c, 'You can sell from next quarter.');
  const price = ventureValue(c, v0) * (1 - SALE_FEE);
  const n = clone(c); const v = n.life!.ventures!.find(x => x.id === id)!;
  post(n.journal, { q: n.fund.q, date: lbl(n), payer: 'external', recipient: 'founder', category: 'asset_sale', amount: price, source: `venture:sell:${id}`, memo: `Sold ${v.name}` });
  v.soldQ = n.fund.q; v.salePrice = price;
  return { c: n, ok: true, message: `Sold ${v.name} for ${fmt(price)} after a 5% broker fee.` };
}

/** Called once inside closeQuarter (journal closeId guard). Pays profit to the founder and grows the business. */
export function venturesAtClose(n: Career, closeId: string) {
  const L = n.life; if (!L?.ventures?.length) return;
  const q = n.fund.q;
  for (const v of L.ventures) {
    if (v.soldQ !== undefined || v.history.some(h => h.q === q)) continue;
    const r = ventureQuarter(n, v);
    if (r.paidOut > 0) post(n.journal, { q, date: lbl(n), payer: 'external', recipient: 'founder', category: 'business_distribution', amount: r.paidOut, source: `venture:profit:${v.id}:${q}`, memo: `${v.name} profit`, closeId });
    else if (r.paidOut < 0) {
      const loss = -r.paidOut; const pay = Math.min(loss, Math.max(0, personalCash(n)));
      post(n.journal, { q, date: lbl(n), payer: 'founder', recipient: 'external', category: 'life_cost', amount: pay, source: `venture:loss:${v.id}:${q}`, memo: `${v.name} loss`, closeId });
      if (loss - pay > 0.5) L.owed.push({ id: `venture-loss-${v.id}-${q}`, q, label: `${v.name} loss`, amount: loss - pay });
    }
    const t = ventureType(v.typeId); const g = t?.growthQ ?? 0;
    v.revenueQ *= 1 + g + v.reinvestPct * 0.04; v.costQ *= 1 + g * 0.8 + v.reinvestPct * 0.03;
    v.history.push({ q, ...r }); if (v.history.length > 80) v.history.shift();
  }
}
