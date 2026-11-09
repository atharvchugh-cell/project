// Client book: persistent named profiles with an estimated wealth, a cap on how much of it they give one manager,
// a mandate (risk, largest position, excluded sectors), patience and a saved service/negotiation history.
// Every new dollar from a client passes through `roomFor`, so a client never funds more than its allocation
// capacity, and money already promised (units, uncalled commitments, open offers, pending transfers) counts against it.
// Offers come from `quote`, which uses only completed history (net returns vs the S&P 500), reputation,
// relationship and mandate fit. Fees are the fund's shared, disclosed fees; only real terms (lockup, mandate,
// promises) are negotiable. Money enters only through subscribe at NAV; reviews redeem through redeemUnits.
import { nav, netAssets, redeemUnits } from '@/lib/fund/accounting';
import { assetName, quarterLabel, SPX } from '@/lib/fund/engine';
import { listedCompanies, mulberry32 } from '@/lib/fund/market';
import { currentYear } from '@/lib/fund/engine';
import type { Career, DecisionOption, PendingDecision } from './career';
import { balance, post } from './journal';
import { lifeOf, officeTier, reputation, spendTime, timeLeft } from './life';
import { hasRole } from './roster';
import { fameEffects } from './immersion';
import { brandBoost } from './brand';

export type ClientKind = 'family' | 'foundation' | 'endowment' | 'pension' | 'insurer' | 'sovereign';
export type Risk = 'low' | 'medium' | 'high';
export interface ClientNote { q: number; kind: 'meeting' | 'review' | 'offer' | 'negotiation' | 'promise' | 'redemption' | 'violation'; text: string; amount?: number }
export interface ClientProfile {
  id: string; name: string; kind: ClientKind; /** Fictional estimate of total investable assets. */ wealth: number;
  /** Most of its wealth it will give a single manager. */ maxShare: number;
  risk: Risk; /** Largest single position (share of fund) its mandate tolerates. */ maxPosition: number; excluded: string[];
  /** Quarters of trailing the S&P 500 it tolerates before redeeming. */ patience: number; underQ: number; violations: number;
  history: ClientNote[]; lastMeetingQ: number; meetingCooldown: Record<string, number>;
  promise?: { madeQ: number; dueQ: number; kind: 'beat' | 'protect'; baseNav: number; baseBench: number };
  redeemAtQ?: number;
}

export const KIND_LABEL: Record<ClientKind, string> = { family: 'Family office', foundation: 'Foundation', endowment: 'Endowment', pension: 'Pension fund', insurer: 'Insurer', sovereign: 'Sovereign fund' };
const RISK_LOSS: Record<Risk, number> = { low: -0.06, medium: -0.1, high: -0.18 };
export const riskLabel = (r: Risk) => (r === 'low' ? 'Conservative' : r === 'medium' ? 'Balanced' : 'Aggressive');
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
const m = (v: number) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`);
const hash = (s: string) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const lbl = (c: Career, q: number) => (q > 0 ? quarterLabel(c.fund, q) : 'Opening');
const SECTORS = ['Energy', 'Materials', 'Utilities', 'Financials'];

function kindFor(name: string): ClientKind {
  if (/sovereign|authority|state pension|national/i.test(name)) return 'sovereign';
  if (/pension|retirement|plan|teachers|union/i.test(name)) return 'pension';
  if (/insurance/i.test(name)) return 'insurer';
  if (/endowment|university|hospital/i.test(name)) return 'endowment';
  if (/foundation|charitable|trust/i.test(name)) return 'foundation';
  return 'family';
}
const WEALTH: Record<ClientKind, [number, number, number, number]> = {
  // [min wealth, max wealth, min share, max share] at the $5B scale
  family: [1.5e9, 12e9, 0.06, 0.15], foundation: [1e9, 6e9, 0.04, 0.1], endowment: [4e9, 40e9, 0.03, 0.06],
  pension: [30e9, 250e9, 0.01, 0.03], insurer: [20e9, 120e9, 0.01, 0.025], sovereign: [200e9, 900e9, 0.004, 0.012],
};

/** A new prospect's profile, deterministic per career and name. Wealth scales with the firm's scenario size. */
export function makeProfile(c: Career, id: string, name: string, scale = 1): ClientProfile {
  const r = mulberry32(c.fund.seed * 13 + hash(name)); const kind = kindFor(name); const w = WEALTH[kind];
  const risk: Risk = kind === 'sovereign' || kind === 'family' ? (r() < 0.5 ? 'high' : 'medium') : r() < 0.6 ? 'low' : 'medium';
  return {
    id, name, kind, wealth: Math.round((w[0] + r() * (w[1] - w[0])) * scale / 1e6) * 1e6, maxShare: Math.round((w[2] + r() * (w[3] - w[2])) * 1000) / 1000,
    risk, maxPosition: risk === 'low' ? 0.2 : risk === 'medium' ? 0.3 : 0.45, excluded: r() < 0.5 ? [SECTORS[Math.floor(r() * SECTORS.length)]] : [],
    patience: kind === 'sovereign' || kind === 'endowment' ? 6 : kind === 'pension' ? 4 : 3, underQ: 0, violations: 0, history: [], lastMeetingQ: -99, meetingCooldown: {},
  };
}

/** Legacy default: an existing investor already uses about 60% of its capacity, so units and commitments are never cut. */
function legacyProfile(c: Career, id: string): ClientProfile {
  const inv = c.fund.investors.find(i => i.id === id);
  const p = makeProfile(c, id, inv?.name ?? id);
  const used = allocatedOf(c, id);
  if (used > 0) p.wealth = Math.max(p.wealth * 0.05, used / (p.maxShare * 0.6));
  return p;
}

export function profileOf(c: Career, id: string): ClientProfile {
  return c.clients?.[id] ?? legacyProfile(c, id);
}
/** Make sure every current investor (except you) has a saved profile. Never changes units or commitments. */
export function ensureProfiles(c: Career) {
  c.clients ??= {};
  for (const i of c.fund.investors) if (i.id !== 'you' && !c.clients[i.id]) c.clients[i.id] = legacyProfile(c, i.id);
}

export const capacityOf = (p: ClientProfile) => p.wealth * p.maxShare;

/** Money already allocated or promised by this client: fund units at NAV, uncalled commitments, open offers and pending transfers. */
export function allocatedOf(c: Career, id: string, excludeDecision?: string): number {
  const inv = c.fund.investors.find(i => i.id === id);
  const units = inv ? inv.units * nav(c.fund.ledger) : 0;
  const committed = c.commitments.filter(x => x.investorId === id && !x.defaulted).reduce((a, x) => a + Math.max(0, x.committed - x.called), 0);
  const open = c.decisions.filter(d => !d.resolved && d.id !== excludeDecision && ((d.kind === 'top_up' && d.payload?.investorId === id) || (d.kind === 'new_client' && d.payload?.profile === id))).reduce((a, d) => a + d.amount, 0);
  return units + committed + open;
}
/** How much more this client can put in. Every inflow path is limited by it. */
export const roomFor = (c: Career, id: string, excludeDecision?: string) => Math.max(0, capacityOf(profileOf(c, id)) - allocatedOf(c, id, excludeDecision));

// ---------- Mandate fit and track record ----------

export function largestPosition(c: Career): { ticker: string; weight: number } | null {
  const na = netAssets(c.fund.ledger); if (na <= 0) return null;
  const e = Object.entries(c.fund.ledger.positions).filter(([t]) => t !== SPX).sort((a, b) => b[1] - a[1])[0];
  return e ? { ticker: e[0], weight: e[1] / na } : null;
}
function heldSectors(c: Career): string[] {
  const co = listedCompanies(currentYear(c.fund));
  return [...new Set(Object.keys(c.fund.ledger.positions).filter(t => (c.fund.ledger.positions[t] ?? 0) > 1).map(t => co.find(x => x.ticker === t)?.sector).filter(Boolean) as string[])];
}
export interface Fit { score: number; issues: string[] }
export function mandateFit(c: Career, p: ClientProfile): Fit {
  const issues: string[] = []; const big = largestPosition(c);
  if (big && big.weight > p.maxPosition) issues.push(`${assetName(big.ticker)} is ${(big.weight * 100).toFixed(0)}% of the fund; their limit is ${(p.maxPosition * 100).toFixed(0)}%`);
  const banned = heldSectors(c).filter(x => p.excluded.some(e => x.toLowerCase().includes(e.toLowerCase())));
  if (banned.length) issues.push(`The fund holds ${banned.join(', ')}, which their mandate excludes`);
  const last = c.fund.history.at(-1);
  if (last && last.ret < RISK_LOSS[p.risk]) issues.push(`Last quarter's ${(last.ret * 100).toFixed(1)}% loss is beyond their ${riskLabel(p.risk).toLowerCase()} tolerance`);
  return { score: Math.max(0, 1 - issues.length * 0.4), issues };
}

const compound = (xs: number[]) => xs.reduce((a, x) => a * (1 + x), 1) - 1;
/** Net return minus S&P 500, annualized over completed quarters (at most the last eight). */
export function trackEdge(c: Career): { edge: number; quarters: number; ret: number; bench: number } {
  const h = c.fund.history.slice(-8); if (!h.length) return { edge: 0, quarters: 0, ret: 0, bench: 0 };
  const ret = compound(h.map(x => x.ret)); const bench = compound(h.map(x => x.bench)); const yrs = h.length / 4;
  return { edge: (ret - bench) / Math.max(0.5, yrs), quarters: h.length, ret, bench };
}

export interface Quote { amount: number; wireNow: number; commitLater: number; deadlineQ: number; share: number; parts: { label: string; value: number }[]; conditions: string[]; room: number; capacity: number }

/**
 * What a client (or prospect profile) would offer now. Share of its remaining room =
 * 6% base + track record (±25 pts) + reputation (±10) + relationship (±10) + mandate fit (up to 6) + service, between 0% and 60%.
 * Strong net performance with a big wealthy client yields a large ticket; room shrinks as it is used, so repeats cannot print money.
 */
export function quote(c: Career, p: ClientProfile, relationship: number, excludeDecision?: string, roomOverride?: number): Quote {
  const t = trackEdge(c); const rep = reputation(c).score; const fit = mandateFit(c, p);
  const trackPts = t.quarters < 2 ? 0 : Math.max(-0.25, Math.min(0.25, t.edge * 2.5));
  const repPts = Math.max(-0.1, Math.min(0.1, (rep - 50) / 250)); const relPts = Math.max(-0.1, Math.min(0.1, (relationship - 60) / 200));
  const fitPts = fit.score * 0.06; const servicePts = (c.governance?.constitution.service === 'premium' ? 0.02 : 0) + officeTier(c).clientSat * 0.01;
  const famePts = fameEffects(c).offerPoints;
  const brandPts = t.quarters >= 4 && t.edge > 0 ? brandBoost(c, 'firm') : 0;
  const share = Math.max(0, Math.min(0.6, 0.06 + trackPts + repPts + relPts + fitPts + servicePts + famePts + brandPts));
  const capacity = capacityOf(p); const room = roomOverride ?? roomFor(c, p.id, excludeDecision);
  const amount = Math.floor(room * share / 1e5) * 1e5;
  const big = p.kind === 'sovereign' || p.kind === 'pension' || p.kind === 'insurer';
  const wireNow = Math.round(amount * (big ? 0.4 : 0.6) / 1e5) * 1e5;
  return {
    amount, wireNow, commitLater: amount - wireNow, deadlineQ: c.fund.q + 1, share, room, capacity,
    parts: [
      { label: 'Base appetite', value: 0.06 }, { label: `Track record (${t.quarters} quarters, net vs S&P 500)`, value: trackPts },
      { label: `Reputation ${rep}`, value: repPts }, { label: `Relationship ${Math.round(relationship)}`, value: relPts },
      { label: 'Mandate fit', value: fitPts }, { label: 'Service and office', value: servicePts },
      ...(c.immersion ? [{ label: `Performance-backed fame ${fameEffects(c).fame}`, value: famePts }] : []),
      ...(brandPts > 0 ? [{ label: 'Current brand campaign', value: brandPts }] : []),
    ],
    conditions: [...fit.issues.map(x => `Mandate concern: ${x}`), `${KIND_LABEL[p.kind]} gives one manager at most ${(p.maxShare * 100).toFixed(1)}% of an estimated ${m(p.wealth)}`],
  };
}

// ---------- Meetings and negotiation ----------

export type Agenda = 'review' | 'allocation' | 'lockup' | 'mandate' | 'promise';
export const AGENDAS: { id: Agenda; label: string; time: number; cooldown: number; hint: string }[] = [
  { id: 'review', label: 'Portfolio review meeting', time: 1, cooldown: 2, hint: 'Relationship +4 to +10. Travel cost from firm cash.' },
  { id: 'allocation', label: 'Ask for a bigger allocation', time: 1, cooldown: 4, hint: 'They quote a ticket from your track record and their room. Needs relationship 60+.' },
  { id: 'lockup', label: 'Negotiate a longer lockup', time: 1, cooldown: 4, hint: 'Accept (+4 quarters), counter (+2 with a promise to beat the S&P 500) or decline.' },
  { id: 'mandate', label: 'Ask to widen the mandate', time: 1, cooldown: 6, hint: 'Raise their largest-position limit by 10 points. Needs a strong record.' },
  { id: 'promise', label: 'Promise to beat the S&P 500 this year', time: 1, cooldown: 4, hint: 'Relationship +5 now; checked in four quarters: kept +6, broken -12.' },
];

export function meetingBlock(c: Career, id: string, agenda: Agenda): string | null {
  if (c.status !== 'running' || c.fund.status === 'ended') return 'Fund closed';
  const inv = c.fund.investors.find(i => i.id === id); if (!inv || id === 'you' || inv.units <= 0.01) return 'Not a current client';
  const a = AGENDAS.find(x => x.id === agenda); if (!a) return 'Unknown agenda';
  const p = profileOf(c, id); const until = p.meetingCooldown[agenda];
  if (until !== undefined && c.fund.q < until) return `Again in ${until - c.fund.q} quarter(s)`;
  if (p.lastMeetingQ === c.fund.q) return 'Already met this quarter';
  if (timeLeft(c) < a.time) return 'No time left this quarter';
  if (agenda === 'promise' && p.promise) return 'A promise is already open';
  return null;
}

export interface MeetingResult { c: Career; ok: boolean; outcome: 'accepted' | 'countered' | 'declined' | 'done' | 'blocked'; message: string }

/** Hold a meeting. Spends founder time and a travel cost; outcome is deterministic from relationship, record and mandate. */
export function holdMeeting(c: Career, id: string, agenda: Agenda): MeetingResult {
  const block = meetingBlock(c, id, agenda); if (block) return { c, ok: false, outcome: 'blocked', message: block };
  const n: Career = structuredClone(c); ensureProfiles(n);
  const p = n.clients![id]; const inv = n.fund.investors.find(i => i.id === id)!; const a = AGENDAS.find(x => x.id === agenda)!;
  spendTime(n, a.time);
  const k = Math.max(0.05, netAssets(n.fund.ledger) / 5e9);
  const travel = Math.round(Math.min(250e3, 30e3 * Math.sqrt(k) * (lifeOf(n).possessions.some(x => x.kind === 'jet' && x.soldQ === undefined) ? 0.6 : 1)) / 1000) * 1000;
  if (balance(n.journal, 'firm') - n.arrears < travel) return { c, ok: false, outcome: 'blocked', message: `Travel and hosting cost ${m(travel)}; the firm cannot spare it.` };
  post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'firm', recipient: 'external', category: 'meeting_cost', amount: travel, source: `meet:${id}:${agenda}:${n.fund.q}`, memo: `Meeting with ${inv.name}: ${a.label.toLowerCase()}` });
  p.lastMeetingQ = n.fund.q; p.meetingCooldown[agenda] = n.fund.q + a.cooldown;
  const rel = n.satisfaction[id] ?? 60; const t = trackEdge(n); const ir = hasRole(n.roster, /investor relations/i);
  const bump = (d: number) => { n.satisfaction[id] = clamp((n.satisfaction[id] ?? 60) + d); };
  let outcome: MeetingResult['outcome'] = 'done'; let msg = '';
  switch (agenda) {
    case 'review': {
      const d = 4 + (ir ? Math.round(ir.ability / 25) : 0) + officeTier(n).clientSat + (t.edge > 0 ? 2 : 0);
      bump(d); msg = `${inv.name} appreciated the walkthrough. Relationship +${d}.`; break;
    }
    case 'allocation': {
      const qt = quote(n, p, rel);
      if (rel < 60 || qt.amount < 1e5) { bump(-3); outcome = 'declined'; msg = rel < 60 ? `${inv.name} is not happy enough to add money (relationship ${rel}). Relationship -3.` : qt.room < 1e5 ? `${inv.name} has no room left: its ${m(qt.capacity)} limit for one manager is used.` : `${inv.name} will not add money on your current record (${(t.edge * 100).toFixed(1)} pts a year vs the S&P 500). Relationship -3.`; break; }
      if (t.edge < 0 && t.quarters >= 4) {
        outcome = 'countered'; const commit = Math.floor(qt.amount * 0.5 / 1e5) * 1e5;
        if (commit > 0) n.commitments.push({ id: `cm-${id}-${n.fund.q}`, investorId: id, name: inv.name, committed: commit, called: 0, reliability: 0.93 });
        msg = `${inv.name} will not wire while you trail the S&P 500, but committed ${m(commit)} you can call later.`; break;
      }
      outcome = 'accepted';
      n.decisions.push({ id: `topup-meet-${n.fund.q}-${id}`, q: n.fund.q, kind: 'top_up', amount: qt.amount, from: inv.name, title: `${inv.name} offers ${m(qt.amount)}`, text: `Quoted from your record (${(t.edge * 100).toFixed(1)} pts a year vs the S&P 500), reputation, relationship and their ${m(qt.room)} of room. Wired at today's fund price if accepted.`,
        options: [opt('accept', `Accept: ${m(qt.wireNow)} now, ${m(qt.commitLater)} committed`, 'Wire joins at NAV; the commitment is called later. More fees, never return'), opt('decline', 'Decline politely', 'No change')], defaultOption: 'accept', payload: { key: id, investorId: id, ...termsPayload(qt.wireNow, qt.commitLater, n.fund.q) } });
      msg = `${inv.name} offered ${m(qt.amount)} (${(qt.share * 100).toFixed(0)}% of their remaining room): ${m(qt.wireNow)} wired at NAV if you accept and ${m(qt.commitLater)} committed for later capital calls. Offer open until the ${lbl(n, n.fund.q + 1)} close.`; break;
    }
    case 'lockup': {
      if (rel >= 70) { inv.lockupUntilQ = Math.max(inv.lockupUntilQ, n.fund.q) + 4; bump(-2); outcome = 'accepted'; msg = `${inv.name} agreed to stay locked four more quarters (until ${lbl(n, inv.lockupUntilQ)}).`; }
      else if (rel >= 55 && !p.promise) { inv.lockupUntilQ = Math.max(inv.lockupUntilQ, n.fund.q) + 2; p.promise = { madeQ: n.fund.q, dueQ: n.fund.q + 4, kind: 'beat', baseNav: nav(n.fund.ledger), baseBench: benchIndex(n) }; outcome = 'countered'; msg = `${inv.name} countered: two more quarters if you promise to beat the S&P 500 over the next year. Promise recorded.`; }
      else { bump(-4); outcome = 'declined'; msg = `${inv.name} declined and did not like being asked. Relationship -4.`; }
      break;
    }
    case 'mandate': {
      if (rel >= 75 && t.edge > 0 && p.maxPosition < 0.5) { p.maxPosition = Math.min(0.5, p.maxPosition + 0.1); outcome = 'accepted'; msg = `${inv.name} widened its largest-position limit to ${(p.maxPosition * 100).toFixed(0)}%.`; }
      else { bump(-2); outcome = 'declined'; msg = `${inv.name} keeps its ${(p.maxPosition * 100).toFixed(0)}% limit for now${t.edge <= 0 ? ' while you trail the index' : ''}.`; }
      break;
    }
    case 'promise': {
      p.promise = { madeQ: n.fund.q, dueQ: n.fund.q + 4, kind: 'beat', baseNav: nav(n.fund.ledger), baseBench: benchIndex(n) }; bump(5); outcome = 'accepted';
      msg = `You promised ${inv.name} you would beat the S&P 500 by ${lbl(n, p.promise.dueQ)}. Relationship +5 now.`; break;
    }
  }
  p.history.push({ q: n.fund.q, kind: agenda === 'review' ? 'meeting' : agenda === 'promise' ? 'promise' : 'negotiation', text: msg });
  n.notices.push({ q: n.fund.q, from: inv.name, subject: a.label, body: msg, tone: outcome === 'declined' ? 'bad' : outcome === 'accepted' ? 'good' : 'neutral' });
  return { c: n, ok: true, outcome, message: msg };
}
const opt = (id: string, label: string, hint: string): DecisionOption => ({ id, label, hint });

// ---------- Authoritative offer terms ----------
/**
 * One saved offer: exact wire-now and commit-later amounts plus expiry, written when the offer is made and
 * used unchanged by the preview, acceptance, subscription, new commitment and history. Capacity is reserved
 * once by the open decision (allocatedOf counts it); if capacity shrank before acceptance both parts scale
 * down together and the history says so. Offers saved before terms existed are all cash (their old behaviour).
 */
export interface OfferTerms { wireNow: number; commitLater: number; expiresQ: number; quotedQ: number; allCash: boolean }
export function termsPayload(wireNow: number, commitLater: number, q: number): Record<string, number> {
  return { wireNow: Math.max(0, Math.round(wireNow)), commitLater: Math.max(0, Math.round(commitLater)), expiresQ: q + 1, quotedQ: q };
}
export function termsOf(d: PendingDecision): OfferTerms {
  const p = d.payload ?? {}; const w = Number(p.wireNow); const l = Number(p.commitLater);
  if (Number.isFinite(w) && Number.isFinite(l) && w >= 0 && l >= 0) return { wireNow: w, commitLater: l, expiresQ: Number(p.expiresQ ?? d.q + 1), quotedQ: Number(p.quotedQ ?? d.q), allCash: l <= 0 };
  // Legacy offers keep the terms their text promised: new clients half now / half committed, top-ups all cash.
  if (d.kind === 'new_client') { const now = Math.round(d.amount / 2); return { wireNow: now, commitLater: d.amount - now, expiresQ: d.q + 1, quotedQ: d.q, allCash: false }; }
  return { wireNow: d.amount, commitLater: 0, expiresQ: d.q + 1, quotedQ: d.q, allCash: true };
}
/** The exact amounts that will settle now, given current room (excluding this offer's own reservation). */
export function settlementOf(c: Career, d: PendingDecision, profileId: string): { wire: number; commit: number; scaled: boolean } {
  const t = termsOf(d); const total = t.wireNow + t.commitLater; const room = roomFor(c, profileId, d.id);
  if (!(total > 0)) return { wire: 0, commit: 0, scaled: false };
  const k = Math.min(1, room / total); const wire = Math.floor(t.wireNow * k); const commit = Math.floor(t.commitLater * k);
  return { wire, commit, scaled: k < 0.9999 };
}
/** Split an amount like a quote for this profile would. */
export function splitLikeQuote(p: ClientProfile, amount: number) {
  const big = p.kind === 'sovereign' || p.kind === 'pension' || p.kind === 'insurer';
  const wireNow = Math.round(amount * (big ? 0.4 : 0.6) / 1e5) * 1e5; return { wireNow, commitLater: Math.max(0, amount - wireNow) };
}
const benchIndex = (c: Career) => c.fund.history.reduce((a, h) => a * (1 + h.bench), 1);

// ---------- Reviews at close ----------

export const REDEEM_SHARE = 0.25;
/** At each close: mandate checks, patience, promises, premium service. Breaches redeem through redeemUnits after lockup. */
export function clientsAtClose(n: Career) {
  ensureProfiles(n);
  const q = n.fund.q; const last = n.fund.history.at(-1); if (!last || last.q !== q) return;
  const premium = n.governance?.constitution.service === 'premium';
  for (const inv of n.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01)) {
    const p = n.clients![inv.id]; const fit = mandateFit(n, p);
    const bump = (d: number) => { n.satisfaction[inv.id] = clamp((n.satisfaction[inv.id] ?? 60) + d); };
    if (premium) bump(1);
    p.underQ = last.ret < last.bench ? p.underQ + 1 : 0;
    if (fit.issues.length) {
      p.violations += 1; bump(-3 * fit.issues.length);
      p.history.push({ q, kind: 'violation', text: fit.issues.join('; ') });
      if (p.violations === 1) n.notices.push({ q, from: inv.name, subject: 'Mandate concern', body: `${fit.issues.join('. ')}. Fix it or we will reduce our allocation.`, tone: 'bad' });
    } else if (p.violations > 0) p.violations -= 1;
    if (p.promise && q >= p.promise.dueQ) {
      const ret = nav(n.fund.ledger) / p.promise.baseNav - 1; const bench = benchIndex(n) / p.promise.baseBench - 1; const kept = ret > bench;
      bump(kept ? 6 : -12);
      p.history.push({ q, kind: 'promise', text: kept ? `Promise kept: ${(ret * 100).toFixed(1)}% vs S&P 500 ${(bench * 100).toFixed(1)}%` : `Promise broken: ${(ret * 100).toFixed(1)}% vs S&P 500 ${(bench * 100).toFixed(1)}%` });
      n.notices.push({ q, from: inv.name, subject: kept ? 'You kept your word' : 'You broke your promise', body: kept ? 'You said you would beat the index and you did.' : 'You promised to beat the index and did not. We will remember.', tone: kept ? 'good' : 'bad' });
      p.promise = undefined;
    }
    const patience = p.patience + (premium ? 1 : 0);
    const trigger = p.violations >= 3 ? 'repeated mandate breaches' : p.underQ > patience ? `${p.underQ} quarters behind the S&P 500` : null;
    if (trigger || (p.redeemAtQ !== undefined && q >= p.redeemAtQ)) {
      if (q >= inv.lockupUntilQ) {
        const units = inv.units * REDEEM_SHARE; inv.units -= units;
        const liab = redeemUnits(n.fund.ledger, units, q + 1, `${inv.name} — review redemption`, inv.id);
        p.history.push({ q, kind: 'redemption', text: `Redeemed ${(REDEEM_SHARE * 100).toFixed(0)}% after ${trigger ?? 'an earlier review'}`, amount: liab.amount });
        n.notices.push({ q, from: inv.name, subject: 'Reducing our allocation', body: `After ${trigger ?? 'our earlier review'}, we are redeeming ${(REDEEM_SHARE * 100).toFixed(0)}% (about ${m(liab.amount)}), payable next quarter.`, tone: 'bad' });
        p.violations = 0; p.underQ = 0; p.redeemAtQ = undefined; bump(-5);
      } else if (p.redeemAtQ === undefined) {
        p.redeemAtQ = inv.lockupUntilQ; p.history.push({ q, kind: 'review', text: `Will redeem when the lockup ends (${lbl(n, inv.lockupUntilQ)}) after ${trigger}` });
        n.notices.push({ q, from: inv.name, subject: 'Notice of redemption', body: `After ${trigger}, we will redeem ${(REDEEM_SHARE * 100).toFixed(0)}% when our lockup ends in ${lbl(n, inv.lockupUntilQ)} unless things change.`, tone: 'bad' });
      }
    }
    if (p.redeemAtQ !== undefined && !trigger && (n.satisfaction[inv.id] ?? 60) >= 70) { p.redeemAtQ = undefined; p.history.push({ q, kind: 'review', text: 'Withdrew its redemption notice after improvement' }); }
    if (p.history.length > 60) p.history.splice(0, p.history.length - 60);
  }
}
