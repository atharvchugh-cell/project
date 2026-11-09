// Client relationships, rival firms and staff revenue attribution.
// Deterministic per career seed and quarter; uses only completed history;
// money moves only through fund accounting (subscribe / redeemUnits).
import { netAssets, nav, redeemUnits, subscribe } from '@/lib/fund/accounting';
import { quarterLabel } from '@/lib/fund/engine';
import { mulberry32 } from '@/lib/fund/market';
import type { Career, DecisionOption, PendingDecision } from './career';
import { type Employee, hasRole } from './roster';
import { acceptsMoney, addMoney, recordFlow } from './phase4';
import { ensureProfiles, makeProfile, profileOf, quote, roomFor, settlementOf, splitLikeQuote, termsOf, termsPayload } from './clients';
import { scaleOf } from './career';
import { coverageEdge, clientMood } from './coverage';
import { clientFeeEstimate } from './fees';
import { investorDemand } from './demand';
import { performanceProfile } from './immersion';

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const m = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`);
const opt = (id: string, label: string, hint: string): DecisionOption => ({ id, label, hint });
const note = (c: Career, from: string, subject: string, body: string, tone: 'good' | 'bad' | 'neutral' = 'neutral') => c.notices.push({ q: c.fund.q, from, subject, body, tone });

// ---------- Rivals (fictional firms) ----------

export const RIVAL_FIRMS = [
  { id: 'northgate', name: 'Northgate Partners', alpha: 0.004, spread: 0.035 },
  { id: 'silverline', name: 'Silverline Capital', alpha: 0.001, spread: 0.02 },
  { id: 'kestrel', name: 'Kestrel Asset Management', alpha: 0.007, spread: 0.05 },
  { id: 'meridian', name: 'Meridian Peak', alpha: -0.002, spread: 0.015 },
];

/** A rival's return for completed quarter j: the real S&P 500 quarter plus a fixed fictional skill and seeded luck. */
export function rivalReturn(c: Career, idx: number, j: number): number {
  const h = c.fund.history[j]; if (!h) return 0;
  const r = RIVAL_FIRMS[idx];
  return h.bench + r.alpha + (c.immersion ? 0.003 + Math.min(0.008, j * 0.0003) : 0) + (mulberry32(c.fund.seed * 31 + idx * 7 + j * 1009)() - 0.5) * r.spread;
}

const compound = (xs: number[]) => xs.reduce((a, x) => a * (1 + x), 1) - 1;

export interface Standing { id: string; name: string; trailing: number; total: number; aum?: number; you?: boolean; bench?: boolean }
/** Trailing four completed quarters and since-launch returns for you, the S&P 500 and each rival, best first. */
export function standings(c: Career): Standing[] {
  const h = c.fund.history; const from = Math.max(0, h.length - 4);
  const rows: Standing[] = [
    { id: 'you', name: c.fundName, trailing: compound(h.slice(from).map(x => x.ret)), total: compound(h.map(x => x.ret)), aum: netAssets(c.fund.ledger), you: true },
    { id: 'spx', name: 'S&P 500', trailing: compound(h.slice(from).map(x => x.bench)), total: compound(h.map(x => x.bench)), bench: true },
    ...RIVAL_FIRMS.map((r, i) => ({ r, i })).filter(({ r }) => !c.acquiredRivals?.includes(r.id)).map(({ r, i }) => ({ id: r.id, name: r.name, trailing: compound(h.slice(from).map((_, k) => rivalReturn(c, i, from + k))), total: compound(h.map((_, k) => rivalReturn(c, i, k))), aum: c.rivalAum?.[r.id] })),
  ];
  return rows.sort((a, b) => b.trailing - a.trailing);
}

/** 1 = best of the five firms over the trailing year. */
export const yourRank = (c: Career) => standings(c).filter(s => !s.bench).findIndex(s => s.you) + 1;

// ---------- Staff revenue attribution ----------

const roleFactor = (e: Employee) => (/Portfolio manager/i.test(e.role) ? 1.6 : /investor relations/i.test(e.role) ? 1.3 : /analyst/i.test(e.role) ? 1 : 0.6);
/** Contribution weight: ability matters most, morale scales effort, role sets how close the job is to revenue. */
export const contribution = (e: Employee) => Math.pow(e.ability / 100, 1.5) * (0.5 + e.morale / 200) * roleFactor(e);

/** Last close's fee cash, or an estimate at the current fund size (0.25% a quarter) before the first close. */
export function quarterRevenue(c: Career): { amount: number; estimate: boolean } {
  const s = c.snapshots.at(-1);
  return s ? { amount: s.fees, estimate: false } : { amount: clientFeeEstimate(c), estimate: true };
}

export interface EmployeeRevenue { id: string; revenue: number; share: number; multiple: number }
/** Splits the firm's real fee revenue across staff by contribution. The shares always add up to the fee revenue; no money is invented. */
export function employeeRevenue(c: Career): EmployeeRevenue[] {
  const { amount } = quarterRevenue(c);
  const w = c.roster.map(contribution); const total = w.reduce((a, x) => a + x, 0) || 1;
  return c.roster.map((e, i) => { const revenue = amount * w[i] / total; return { id: e.id, revenue, share: w[i] / total, multiple: e.salaryQ > 0 ? revenue / e.salaryQ : 0 }; });
}

// ---------- Client calls ----------

export type CallTopic = 'results' | 'thanks' | 'outlook' | 'more_money' | 'lockup';
export const CALL_TOPICS: { id: CallTopic; label: string; hint: string }[] = [
  { id: 'results', label: 'Walk through recent results', hint: 'Great when you are ahead; backfires when you are losing' },
  { id: 'thanks', label: 'Thank them for their trust', hint: 'A small, safe lift' },
  { id: 'outlook', label: 'Warn them losses may come', hint: 'Hurts now; softens the next losing quarter' },
  { id: 'more_money', label: 'Ask them to invest more', hint: 'Works only if they are very happy and you are making money' },
  { id: 'lockup', label: 'Ask them to stay locked in a year longer', hint: 'Big satisfaction hit; no withdrawals for four more quarters' },
];

export const canCall = (c: Career, invId: string) => invId !== 'you' && c.status === 'running' && c.clientCalls[invId] !== c.fund.q;

const irBoost = (c: Career) => { const ir = hasRole(c.roster, /investor relations/i); return ir ? (ir.ability / 15) * (ir.morale / 100) : 0; };
const trailing = (c: Career) => { const h = c.fund.history.slice(-4); return { ret: compound(h.map(x => x.ret)), bench: compound(h.map(x => x.bench)), n: h.length }; };

export interface CallResult { delta: number; reply: string; tone: 'good' | 'bad' | 'neutral'; amount: number }

/** Predicts the outcome shown before calling. callClient applies exactly this. */
export function previewCall(c: Career, invId: string, topic: CallTopic): CallResult {
  const r = basePreview(c, invId, topic);
  const inv = c.fund.investors.find(i => i.id === invId);
  const after = (c.satisfaction[invId] ?? 60) + r.delta;
  // A positive call with a satisfied client brings real money: 0.4% of their position per satisfaction point gained.
  const amount = inv && r.delta > 0 && after >= 60 && topic !== 'more_money' ? Math.floor(Math.min(roomFor(c, invId), inv.units * nav(c.fund.ledger) * r.delta * 0.004) / 1e4) * 1e4 : 0;
  return { ...r, amount };
}

function basePreview(c: Career, invId: string, topic: CallTopic): Omit<CallResult, 'amount'> {
  const sat = c.satisfaction[invId] ?? 60; const t = trailing(c); const boost = irBoost(c);
  switch (topic) {
    case 'results':
      if (t.n === 0) return { delta: 1, reply: 'Nothing to report yet, but thanks for checking in.', tone: 'neutral' };
      if (t.ret >= t.bench && t.ret > 0) return { delta: Math.round(7 + boost), reply: `Up ${(t.ret * 100).toFixed(1)}% and ahead of the S&P 500. Exactly what we hoped for.`, tone: 'good' };
      if (t.ret > 0) return { delta: Math.round(2 + boost / 2), reply: 'Positive, though the index did better. Keep going.', tone: 'neutral' };
      return { delta: -4, reply: `You are down ${(Math.abs(t.ret) * 100).toFixed(1)}% this year. A sales pitch is not what we needed.`, tone: 'bad' };
    case 'thanks': return { delta: Math.round(3 + boost / 2), reply: 'Kind of you to call. We appreciate it.', tone: 'good' };
    case 'outlook': return { delta: -4, reply: 'Not happy to hear it, but we respect the honesty. We will remember you warned us.', tone: 'bad' };
    case 'more_money':
      if (sat >= 80 && t.ret > 0) return { delta: 2, reply: 'We were thinking the same. Send us the paperwork.', tone: 'good' };
      if (sat >= 65) return { delta: 0, reply: 'Not yet. Show us a few more good quarters.', tone: 'neutral' };
      return { delta: -6, reply: 'You want more money when we are unhappy with what you have? No.', tone: 'bad' };
    case 'lockup': return { delta: -10, reply: 'Fine, we will stay in another year. We did not enjoy being asked.', tone: 'bad' };
  }
}

export function callClient(c: Career, invId: string, topic: CallTopic): Career {
  const inv = c.fund.investors.find(i => i.id === invId);
  if (!inv || !canCall(c, invId)) return c;
  const n: Career = structuredClone(c);
  const res = previewCall(n, invId, topic);
  n.satisfaction[invId] = clamp((n.satisfaction[invId] ?? 60) + res.delta);
  n.clientCalls[invId] = n.fund.q; n.meetings[invId] = n.fund.q;
  const x = n.fund.investors.find(i => i.id === invId)!;
  if (topic === 'outlook') n.warned[invId] = n.fund.q;
  if (topic === 'lockup') x.lockupUntilQ = Math.max(x.lockupUntilQ, n.fund.q) + 4;
  if (topic === 'more_money' && res.tone === 'good') {
    ensureProfiles(n); const qt = quote(n, n.clients![invId], n.satisfaction[invId] ?? 60); const amt = qt.amount;
    if (amt > 0) n.decisions.push({ id: `topup-call-${n.fund.q}-${invId}`, q: n.fund.q, kind: 'top_up', amount: amt, from: x.name, title: `${x.name} will add ${m(amt)}`, text: `They agreed on the call: ${m(qt.wireNow)} wired at the current fund price if you accept and ${m(qt.commitLater)} committed for later capital calls. Open until the ${quarterLabel(n.fund, n.fund.q + 1)} close.`, options: [opt('accept', `Accept: ${m(qt.wireNow)} now, ${m(qt.commitLater)} committed`, 'More fees, more responsibility'), opt('decline', 'Decline politely', 'No change')], defaultOption: 'accept', payload: { key: invId, investorId: invId, ...termsPayload(qt.wireNow, qt.commitLater, n.fund.q) } });
  }
  const added = res.amount > 0 ? addMoney(n, invId, res.amount, 'call_bonus') : 0;
  n.callLog.push({ q: n.fund.q, investorId: invId, topic, delta: res.delta, reply: res.reply, amount: added });
  note(n, x.name, `Call: ${CALL_TOPICS.find(t => t.id === topic)!.label}`, `${res.reply} Satisfaction ${res.delta >= 0 ? '+' : ''}${res.delta}.${added ? ` They wired ${m(added)} into the fund at today's price.` : ''}`, res.tone);
  return n;
}

// ---------- Winning clients ----------

/** Client tier by fund size: bigger firms attract bigger, wealthier clients who write larger checks. */
export function clientTier(aum: number) {
  if (aum >= 20e9) return { label: 'Sovereign and mega-institution', mult: 2, names: ['Gulf Horizon Sovereign Fund', 'Nordic State Pension Reserve', 'Pacific Crown Investment Authority', 'Atlas National Retirement System'] };
  if (aum >= 8e9) return { label: 'Large institution', mult: 1.5, names: ['Granite State Retirement', 'Orchard Sovereign Fund', 'Harrow Insurance Group', 'Cobalt University Endowment'] };
  if (aum >= 2e9) return { label: 'Institution and family office', mult: 1, names: ['Lakeshore Teachers Pension', 'Albright Family Office', 'Westmark Hospital Trust', 'Beacon Labor Union Plan'] };
  return { label: 'Wealthy family and foundation', mult: 0.7, names: ['Pinecrest Foundation', 'Redwood Charitable Trust', 'Vance Family Office', 'Elm Street Doctors Group'] };
}
const pendingNames = (c: Career) => new Set(c.decisions.filter(d => !d.resolved && d.kind === 'new_client').map(d => String(d.payload?.name ?? '')));
/** A client name from the current tier that is not already a pending prospect or an investor. Null when none is free. */
function freeName(c: Career, aum: number, r: () => number): string | null {
  const base = clientTier(aum).names;
  const t = c.immersion ? [...base, ...['Ashford', 'Belmont', 'Kingswell', 'Crescent', 'Stonebridge', 'Fairmont', 'Oakmere', 'Greenhaven'].map(n => `${n} ${aum >= 8e9 ? 'Institutional Trust' : 'Family Office'}`)] : base;
  const start = Math.floor(r() * t.length);
  const taken = pendingNames(c); for (const i of c.fund.investors) taken.add(i.name);
  for (let k = 0; k < t.length; k++) { const name = t[(start + k) % t.length]; if (!taken.has(name)) return name; }
  return null;
}

/** Why a pitch is not possible right now, or null when it is. Allowed once a quarter, only against a rival you beat over the trailing year. */
export function pitchBlock(c: Career, rivalId: string): string | null {
  if (c.status !== 'running' || c.fund.status === 'ended') return 'Fund closed';
  if (c.acquiredRivals?.includes(rivalId)) return 'Now part of your firm';
  if (c.pitchQ === c.fund.q) return 'Pitched this quarter';
  if (c.fund.history.length < 2) return 'Beat them first';
  const s = standings(c); const you = s.find(x => x.you)!; const r = s.find(x => x.id === rivalId);
  if (!r || !(you.trailing > r.trailing)) return 'Beat them first';
  if (!((c.rivalAum[rivalId] ?? 0) > 1e5)) return 'No clients left to win';
  const size = netAssets(c.fund.ledger);
  if (!clientTier(size).names.some(n => !pendingNames(c).has(n) && !c.fund.investors.some(i => i.name === n))) return 'Answer open client offers first';
  return null;
}
export const canPitch = (c: Career, rivalId: string) => pitchBlock(c, rivalId) === null;
export function pitchChance(c: Career, rivalId: string) {
  const s = standings(c); const you = s.find(x => x.you)!; const r = s.find(x => x.id === rivalId)!;
  const ir = hasRole(c.roster, /investor relations/i);
  return Math.max(0.1, Math.min(0.85, 0.25 + (you.trailing - r.trailing) * 3 + (ir ? ir.ability / 300 : 0) + coverageEdge(c, rivalId)));
}

/** Creates a new-client offer. Returns the offer, or null when it is invalid or duplicates a pending name or id. */
function prospect(n: Career, name: string | null, amount: number, why: string, tag: string, extra: Record<string, string> = {}, wealth?: number): PendingDecision | null {
  const id = `client-${n.fund.q}-${tag}`;
  if (!name || !acceptsMoney(n) || pendingNames(n).has(name) || n.decisions.some(d => d.id === id)) return null;
  // The prospect's profile caps the offer at its allocation capacity; the quote is shown with the offer.
  const key = `prospect:${id}`; n.clients ??= {};
  const prof = makeProfile(n, key, name, scaleOf(n)); if (wealth && wealth > 0) { prof.wealth = wealth; prof.maxShare = 0.6; } n.clients[key] = prof;
  amount = Math.floor(Math.min(amount, roomFor(n, key)) / 1e5) * 1e5;
  if (!(amount > 0)) { delete n.clients[key]; return null; }
  const split = splitLikeQuote(prof, amount);
  const d: PendingDecision = { id, q: n.fund.q, kind: 'new_client', amount, from: name, title: `${name} wants to invest ${m(amount)}`, text: `${why} Terms: ${m(split.wireNow)} wired now at today's price and ${m(split.commitLater)} committed for capital calls. Open until the ${quarterLabel(n.fund, n.fund.q + 1)} close.`, options: [opt('accept', `Welcome them: ${m(split.wireNow)} now, ${m(split.commitLater)} committed`, 'Units at today\'s price; the commitment is called later'), opt('decline', 'Decline', extra.rival ? 'The money stays with the rival' : 'No change')], defaultOption: 'accept', payload: { key: name, name, ...extra, profile: key, ...termsPayload(split.wireNow, split.commitLater, n.fund.q) } };
  n.decisions.push(d);
  return d;
}

/**
 * Pitch a rival's client. Atomic: money leaves the rival only when a distinct offer is actually created,
 * and is then held pending (earning nothing) until you accept or decline.
 */
export function pitchRival(c: Career, rivalId: string): Career {
  if (!canPitch(c, rivalId)) return c;
  const n: Career = structuredClone(c); n.pitchQ = n.fund.q;
  const idx = RIVAL_FIRMS.findIndex(r => r.id === rivalId); const rival = RIVAL_FIRMS[idx];
  const r = mulberry32(n.fund.seed * 53 + n.fund.q * 211 + idx * 17);
  const win = r() < pitchChance(n, rivalId);
  const size = netAssets(n.fund.ledger); const name = freeName(n, size, r);
  if (!name) return c;
  if (win) {
    const amt = Math.min(n.rivalAum[rivalId] ?? 0, prospectQuote(n, name, 60));
    const d = prospect(n, name, amt, `They are leaving ${rival.name} after your fund outperformed it this year.`, `pitch-${rivalId}`, { rival: rivalId });
    if (!d) return c;
    const moved = d.amount; n.rivalAum[rivalId] = (n.rivalAum[rivalId] ?? 0) - moved;
    n.transfers.push({ id: `tr-${d.id}`, q: n.fund.q, direction: 'from_rival', rival: rivalId, client: name, amount: moved, status: 'pending', decisionId: d.id });
    n.rivalLog.push({ q: n.fund.q, by: 'you', rival: rivalId, client: name, won: true, amount: moved });
    n.rivalWins[rivalId] = (n.rivalWins[rivalId] ?? 0) + 1;
    note(n, name, `Won from ${rival.name}`, `Your pitch landed. They have left ${rival.name} and want to move ${m(moved)} to you. The money is held until you accept or decline their offer.`, 'good');
  } else { n.rivalLog.push({ q: n.fund.q, by: 'you', rival: rivalId, client: name, won: false, amount: 0 }); note(n, name, `${rival.name} kept the client`, 'They liked the pitch but are staying put for now. Try again next quarter.', 'bad'); }
  return n;
}

/** New investor via fund subscription at NAV. New money grows the fund, never the return. */
export function applyNewClient(n: Career, d: PendingDecision, choice: string): boolean {
  const rival = d.payload?.rival ? String(d.payload.rival) : undefined;
  const tr = n.transfers.find(t => t.decisionId === d.id && t.status === 'pending');
  const giveBack = () => { if (rival && tr) { n.rivalAum[rival] = (n.rivalAum[rival] ?? 0) + tr.amount; tr.status = 'returned'; tr.returned = tr.amount; tr.wired = 0; tr.committed = 0; tr.settledQ = n.fund.q; } };
  const key = d.payload?.profile ? String(d.payload.profile) : undefined;
  const dropKey = () => { if (key && n.clients) delete n.clients[key]; };
  if (choice !== 'accept' || !acceptsMoney(n)) { giveBack(); dropKey(); return true; }
  // Capacity re-checked at acceptance; anything above it returns to the rival (or never arrives).
  // Settle exactly the saved terms (scaled together only if capacity shrank, and said so).
  const st = key ? settlementOf(n, d, key) : { wire: termsOf(d).wireNow, commit: termsOf(d).commitLater, scaled: false };
  const now = st.wire; const later = st.commit; const total = now + later;
  const units = subscribe(n.fund.ledger, now); if (units <= 0) { giveBack(); dropKey(); return true; }
  if (tr && total < tr.amount && rival) n.rivalAum[rival] = (n.rivalAum[rival] ?? 0) + (tr.amount - total);
  const id = `client-${d.id}`; const name = String(d.payload?.name ?? 'New client');
  n.fund.investors.push({ id, name, relation: rival ? 'Won from a rival' : d.payload?.referrer ? 'Referral' : 'New client', units, joinedQ: n.fund.q, lockupUntilQ: n.fund.q + 4, note: `Joined in ${n.fund.q ? quarterLabel(n.fund, n.fund.q) : 'the opening quarter'}: ${m(now)} wired, ${m(later)} committed for capital calls.` });
  n.satisfaction[id] = 70;
  if (later > 0) n.commitments.push({ id: `cm-${id}`, investorId: id, name, committed: later, called: 0, reliability: 0.92 });
  if (tr) { tr.status = 'settled'; tr.wired = now; tr.committed = later; tr.returned = tr.amount - now - later; tr.settledQ = n.fund.q; }
  if (key && n.clients?.[key]) { n.clients[id] = { ...n.clients[key], id, history: [...n.clients[key].history, { q: n.fund.q, kind: 'offer', text: `Joined: ${m(now)} wired, ${m(later)} committed${st.scaled ? ' (scaled to remaining capacity)' : ''}`, amount: total }] }; delete n.clients[key]; }
  const ref = d.payload?.referrer ? String(d.payload.referrer) : undefined;
  if (ref && n.satisfaction[ref] !== undefined) n.satisfaction[ref] = clamp(n.satisfaction[ref] + 3);
  recordFlow(n, { investorId: id, name, amount: now, kind: rival ? 'won_from_rival' : ref ? 'referral' : 'new_client', rival });
  note(n, name, 'Welcome aboard', `${m(now)} arrived as new units at today's fund price. Another ${m(later)} is committed and can be called through Capital & deals.`, 'good');
  return true;
}

/** Runs at close after Phase 2. Strong results attract clients; a rival may take some of an unhappy client's money. */
export function relationsAtClose(n: Career, rand: () => number) {
  const f = n.fund; const q = f.q; const t = trailing(n);
  if (t.n < 2 || !acceptsMoney(n)) return;
  const rank = yourRank(n); const size = netAssets(f.ledger);
  const beat = t.ret > t.bench;
  const demand = investorDemand(n);
  const chance = rank === 1 && beat ? 0.6 : beat ? 0.35 : 0;
  const following = performanceProfile(n);
  const draw = rand();
  if (demand.qualified || draw < (n.immersion ? following.demand : chance)) {
    const pname = freeName(n, size, rand);
    const d = prospect(n, pname, pname ? prospectQuote(n, pname, demand.qualified ? 85 : n.immersion ? Math.min(85, 55 + Math.max(0, following.edge) * 80) : 55) : 0, demand.qualified ? `Please reserve us an allocation. You beat the S&P 500 by ${(demand.previous * 100).toFixed(1)} and ${(demand.recent * 100).toFixed(1)} percentage points in two consecutive years. We want you managing our money.` : n.immersion ? `Your net return beat the S&P 500 by ${(following.edge * 100).toFixed(1)} points over the last year. We approached you for an allocation.` : rank === 1 ? 'You were the top-performing firm in your peer group this year. They want in.' : 'You beat the S&P 500 this year and they noticed.', `perf-${q}`);
    if (demand.qualified && d) note(n, d.from, 'Please take our allocation', d.text, 'good');
  }
  // Existing satisfied clients request allocations too, never exceeding their saved capacity.
  if ((demand.qualified || (n.immersion && following.demand > 0 && draw < following.demand)) && !n.decisions.some(d => d.id.startsWith(`demand-${q}-`))) {
    ensureProfiles(n);
    const inv = f.investors.find(i => i.id !== 'you' && i.units > 0.01 && (n.satisfaction[i.id] ?? 60) >= 75 && roomFor(n, i.id) > 1e5 && !n.decisions.some(d => !d.resolved && d.kind === 'top_up' && d.payload?.investorId === i.id));
    const id = inv ? `demand-${q}-${inv.id}` : '';
    const profile = inv ? n.clients?.[inv.id] : undefined;
    if (inv && profile && !n.decisions.some(d => d.id === id)) {
      const qt = quote(n, profile, Math.max(85, n.satisfaction[inv.id] ?? 60));
      if (qt.amount > 0) n.decisions.push({ id, q, kind: 'top_up', amount: qt.amount, from: inv.name, title: `${inv.name}: please take another ${m(qt.amount)}`, text: `${demand.qualified ? 'Your two-year track record convinced us.' : `Your benchmark-beating results and fame (${following.fame}/100) convinced us.`} Please accept ${m(qt.wireNow)} now and ${m(qt.commitLater)} for future capital calls.`, options: [opt('accept', `Accept ${m(qt.wireNow)} now + ${m(qt.commitLater)} committed`, 'New units at NAV, not investment profit'), opt('decline', 'Keep the allocation unchanged', 'No money moves')], defaultOption: 'decline', payload: { key: inv.id, investorId: inv.id, ...termsPayload(qt.wireNow, qt.commitLater, q) } });
    }
  }
  const fan = f.investors.find(i => i.id !== 'you' && (n.satisfaction[i.id] ?? 0) >= 85);
  if (fan && rand() < 0.2) {
    const rname = freeName(n, size, rand); prospect(n, rname, rname ? prospectQuote(n, rname, Math.min(75, n.satisfaction[fan.id] ?? 60)) : 0, `${fan.name} recommended you. Very happy clients talk.`, `ref-${q}`, { referrer: fan.id });
  }
  // Rival raids: a rival you trail can take 20% from your least happy unlocked client.
  const s = standings(n); const you = s.find(x => x.you)!;
  const ahead = s.filter(x => !x.you && !x.bench && x.trailing > you.trailing);
  const unhappy = f.investors.filter(i => i.id !== 'you' && i.units > 0.01 && q >= i.lockupUntilQ && clientMood(n, i.id) < 45).sort((a, b) => clientMood(n, a.id) - clientMood(n, b.id))[0];
  // Rival pitch: the strongest rival ahead of you pitches your least happy unlocked client.
  if (ahead.length && unhappy) {
    const rival = ahead[0]; const lead = rival.trailing - you.trailing; const sat = clientMood(n, unhappy.id);
    const chance = Math.max(0.05, Math.min(0.8, 0.1 + lead * 3 + (60 - sat) / 80 - coverageEdge(n, rival.id)));
    if (rand() < chance) {
      const all = sat < 25; const units = unhappy.units * (all ? 1 : 0.2);
      unhappy.units -= units; const liab = redeemUnits(f.ledger, units, q + 1, `${unhappy.name} moving money to ${rival.name}`, unhappy.id); const amount = liab.amount;
      n.rivalLosses[rival.id] = (n.rivalLosses[rival.id] ?? 0) + 1;
      // The rival receives the money only when the fund pays this redemption (settleTransfers).
      n.transfers.push({ id: `tr-${liab.id}`, q, direction: 'to_rival', rival: rival.id, client: unhappy.id, amount, status: 'pending', liabilityId: liab.id });
      recordFlow(n, { investorId: unhappy.id, name: unhappy.name, amount, kind: 'lost_to_rival', rival: rival.id, pending: true });
      n.rivalLog.push({ q, by: rival.id, rival: rival.id, client: unhappy.name, won: true, amount });
      note(n, unhappy.name, all ? `Leaving for ${rival.name}` : `Moving money to ${rival.name}`, `${rival.name} pitched us after beating you this year. We are moving ${all ? 'everything' : '20%'} (about ${m(amount)}) to them, paid next quarter.`, 'bad');
    } else {
      n.rivalLog.push({ q, by: rival.id, rival: rival.id, client: unhappy.name, won: false, amount: 0 });
      note(n, unhappy.name, `We turned down ${rival.name}`, `${rival.name} pitched us this quarter. We are staying, but we are watching your results.`, 'neutral');
    }
  }
  // Early warning when a rival pulls well ahead, at most once a year per rival.
  for (const r of ahead) {
    if (r.trailing - you.trailing < 0.05 || (n.rivalAlerts[r.id] !== undefined && q - n.rivalAlerts[r.id] < 4)) continue;
    n.rivalAlerts[r.id] = q;
    note(n, 'Head of investor relations', `${r.name} is pulling ahead`, `They are up ${(r.trailing * 100).toFixed(1)}% this year against your ${(you.trailing * 100).toFixed(1)}%. Their salespeople are calling our clients; unhappy ones are at risk. Calls and results are the defence.`, 'bad');
  }
}

/** Satisfaction offset for clients warned about losses in the last two quarters. */
export const warnedCushion = (c: Career, invId: string) => { const w = c.warned[invId]; return w !== undefined && c.fund.q - w <= 2 ? 2 : 0; };

/** A prospect's quoted ticket: its full capacity is room (it has nothing allocated yet). */
function prospectQuote(n: Career, name: string, relationship: number): number {
  const p = makeProfile(n, `quote:${name}`, name, scaleOf(n));
  return quote(n, p, relationship, undefined, p.wealth * p.maxShare).amount;
}
void profileOf;

/** Fictional celebrities. Richer, pickier stars only call once your fame reaches their bar. */
export const CELEBRITIES: { id: string; name: string; kind: string; wealth: number; minFame: number }[] = [
  { id: 'reyes', name: 'Nova Reyes', kind: 'pop superstar', wealth: 1.4e9, minFame: 20 },
  { id: 'holloway', name: 'Marcus Holloway', kind: 'basketball legend', wealth: 900e6, minFame: 15 },
  { id: 'vale', name: 'Sienna Vale', kind: 'film star', wealth: 600e6, minFame: 12 },
  { id: 'kairo', name: 'DJ Kairo', kind: 'festival headliner', wealth: 400e6, minFame: 10 },
  { id: 'banks', name: 'Theo Banks', kind: 'streaming star', wealth: 300e6, minFame: 8 },
  { id: 'okafor', name: 'Lena Okafor', kind: 'tennis champion', wealth: 500e6, minFame: 14 },
  { id: 'santana', name: 'Rico Santana', kind: 'football icon', wealth: 1.1e9, minFame: 25 },
  { id: 'pierce', name: 'Jaxon Pierce', kind: 'rapper and entrepreneur', wealth: 1.8e9, minFame: 30 },
  { id: 'lindqvist', name: 'Ava Lindqvist', kind: 'fashion mogul', wealth: 2.5e9, minFame: 35 },
  { id: 'cole', name: 'Imani Cole', kind: 'talk show host', wealth: 3e9, minFame: 45 },
];
export const isCelebrity = (name: string) => CELEBRITIES.some(x => x.name === name);
/** At close: a famous star may ask to invest; the size grows with your fame and your lead over the S&P 500. */
export function celebrityAtClose(n: Career, rand: () => number) {
  if (!acceptsMoney(n) || n.fund.history.length < 4) return;
  const p = performanceProfile(n); if (!(p.edge > 0)) return;
  const taken = pendingNames(n);
  const open = CELEBRITIES.filter(x => p.fame >= x.minFame && !taken.has(x.name) && !n.fund.investors.some(i => i.name === x.name));
  if (!open.length || rand() > 0.15 + p.fame / 250) return;
  const star = open[Math.floor(rand() * open.length)];
  const share = Math.min(0.6, 0.1 + p.edge * 1.5 + p.fame / 200);
  const d = prospect(n, star.name, star.wealth * share, `${star.name}, the ${star.kind}, has seen your results: ${(p.edge * 100).toFixed(1)} points ahead of the S&P 500 this year. They want in.`, `celeb-${star.id}`, { celebrity: star.id }, star.wealth);
  if (d) note(n, star.name, 'A celebrity wants to invest', d.text, 'good');
}
