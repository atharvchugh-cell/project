// Recurring fundraising: tiers repeat on cooldowns, higher tiers unlock after
// rounds below them, and every offer needs a fresh sustained window of results.

export interface QuarterRecord {
  q: number;
  /** Net unit-NAV return for the quarter (fraction). */
  ret: number;
  bench: number;
  /** Drawdown from running NAV peak at quarter end (fraction, positive). */
  drawdown: number;
  /** coverage[n-1] = liquid cash ÷ payments due over the next n quarters (Infinity if none). */
  coverage: number[];
  latePayment: boolean;
  confidence: number;
  /** Signed confidence change this quarter and the reasons behind it (newer saves only). */
  confidenceDelta?: number;
  confidenceNotes?: { text: string; points: number }[];
  /** Holdings sold automatically to meet payments this quarter. */
  forcedSale?: number;
}

export interface Tier {
  id: number; name: string; window: number; cooldown: number;
  commitment: [number, number]; beat: number; minReturn: number; maxDrawdown: number;
  coverQuarters: number; minConfidence: number;
  unlock: { prevTierRounds: number; trackRecord: number };
  terms: { lockupQ: number; noticeQ: number; maxSingleAsset: number; expectedAnnual: number; triggerLagQ: number };
}

export const TIERS: Tier[] = [
  { id: 1, name: 'Referrals', window: 2, cooldown: 1, commitment: [0.03, 0.06], beat: 2, minReturn: 0.04, maxDrawdown: 0.12, coverQuarters: 1, minConfidence: 55, unlock: { prevTierRounds: 0, trackRecord: 0 }, terms: { lockupQ: 2, noticeQ: 1, maxSingleAsset: 0.6, expectedAnnual: 0.08, triggerLagQ: 3 } },
  { id: 2, name: 'Local professionals', window: 3, cooldown: 2, commitment: [0.06, 0.10], beat: 2, minReturn: 0.07, maxDrawdown: 0.12, coverQuarters: 2, minConfidence: 60, unlock: { prevTierRounds: 2, trackRecord: 0 }, terms: { lockupQ: 4, noticeQ: 1, maxSingleAsset: 0.5, expectedAnnual: 0.10, triggerLagQ: 3 } },
  { id: 3, name: 'Wealthy families', window: 4, cooldown: 2, commitment: [0.10, 0.15], beat: 3, minReturn: 0.10, maxDrawdown: 0.10, coverQuarters: 2, minConfidence: 70, unlock: { prevTierRounds: 2, trackRecord: 0 }, terms: { lockupQ: 4, noticeQ: 2, maxSingleAsset: 0.45, expectedAnnual: 0.12, triggerLagQ: 2 } },
  { id: 4, name: 'Family office', window: 4, cooldown: 3, commitment: [0.15, 0.20], beat: 3, minReturn: 0.12, maxDrawdown: 0.09, coverQuarters: 3, minConfidence: 75, unlock: { prevTierRounds: 1, trackRecord: 8 }, terms: { lockupQ: 6, noticeQ: 2, maxSingleAsset: 0.4, expectedAnnual: 0.13, triggerLagQ: 2 } },
  { id: 5, name: 'Institutional allocator', window: 6, cooldown: 4, commitment: [0.20, 0.25], beat: 5, minReturn: 0.18, maxDrawdown: 0.08, coverQuarters: 3, minConfidence: 80, unlock: { prevTierRounds: 1, trackRecord: 12 }, terms: { lockupQ: 8, noticeQ: 2, maxSingleAsset: 0.35, expectedAnnual: 0.14, triggerLagQ: 2 } },
];

export interface FundraisingState { unlocked: number; rounds: Record<number, number>; lastOfferQ: Record<number, number>; paused: boolean; pausedReason: string | null }
export const initialFundraising = (): FundraisingState => ({ unlocked: 1, rounds: {}, lastOfferQ: {}, paused: false, pausedReason: null });

export interface GateCheck { label: string; ok: boolean; detail: string }
export interface TierStatus { tier: Tier; unlocked: boolean; cooling: boolean; checks: GateCheck[]; eligible: boolean }

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function checkTier(tier: Tier, history: QuarterRecord[], fr: FundraisingState): TierStatus {
  const unlocked = tier.id <= fr.unlocked;
  const last = fr.lastOfferQ[tier.id];
  const nowQ = history.length ? history[history.length - 1].q : 0;
  const cooling = last !== undefined && nowQ - last <= tier.cooldown;
  const win = history.slice(-tier.window);
  const full = win.length === tier.window;
  const beats = win.filter(h => h.ret > h.bench).length;
  const total = win.reduce((a, h) => a * (1 + h.ret), 1) - 1;
  const maxDd = win.reduce((a, h) => Math.max(a, h.drawdown), 0);
  const cur = history[history.length - 1];
  const cov = cur ? (cur.coverage[tier.coverQuarters - 1] ?? 0) : 0;
  const checks: GateCheck[] = [
    { label: 'Track record', ok: full, detail: `${win.length}/${tier.window} quarters` },
    { label: 'Beat benchmark', ok: full && beats >= tier.beat, detail: `${beats} of ${tier.window} quarters (need ${tier.beat})` },
    { label: 'Net return', ok: full && total >= tier.minReturn, detail: `${pct(total)} over window (need ${pct(tier.minReturn)})` },
    { label: 'Drawdown', ok: full && maxDd <= tier.maxDrawdown, detail: `max ${pct(maxDd)} (limit ${pct(tier.maxDrawdown)})` },
    { label: 'Reserves', ok: cov >= 1, detail: `cover ${tier.coverQuarters}q of payments: ${cov === Infinity ? 'nothing due' : `${cov.toFixed(2)}×`}` },
    { label: 'Payments on time', ok: full && win.every(h => !h.latePayment), detail: win.some(h => h.latePayment) ? 'late payment in window' : 'all on time' },
    { label: 'Confidence', ok: !!cur && cur.confidence >= tier.minConfidence, detail: `${Math.round(cur?.confidence ?? 0)} (need ${tier.minConfidence})` },
  ];
  return { tier, unlocked, cooling, checks, eligible: unlocked && !cooling && checks.every(c => c.ok) };
}

export interface Offer { id: string; tierId: number; investor: string; amount: number; q: number; reason: string; terms: Tier['terms']; expiresQ: number }

const NAMES: Record<number, string[]> = {
  1: ['A friend of the Patels', 'Your old roommate', 'Maria’s cousin', 'A neighbour of the Okafors'],
  2: ['Dr. Lena Brandt', 'Hollis & Reyes Dental', 'A local architect', 'Two tax attorneys'],
  3: ['The Whitcombe family', 'The Arora family trust', 'The Delacroix siblings'],
  4: ['Northgate Family Office', 'Calder Point Partners'],
  5: ['Meridian Endowment', 'Atlas Pension Allocators'],
};

/**
 * Called after each quarter is recorded. Applies tier drops, pauses, unlocks and
 * returns any new offers (one per eligible tier). Deterministic given `rand`.
 */
export function evaluateFundraising(history: QuarterRecord[], fr: FundraisingState, aum: number, rand: () => number): { offers: Offer[]; notes: string[] } {
  const cur = history[history.length - 1];
  const notes: string[] = [];
  if (!cur) return { offers: [], notes };
  if (cur.drawdown > 0.15 || cur.latePayment) {
    if (fr.unlocked > 1) { fr.unlocked -= 1; notes.push(`Investors stepped back a tier after ${cur.latePayment ? 'a late payment' : `a ${pct(cur.drawdown)} drawdown`}.`); }
  }
  // Unlock progression (track record in quarters = history length).
  for (const t of TIERS) {
    if (t.id === fr.unlocked + 1) {
      const prev = fr.rounds[t.id - 1] ?? 0;
      if (prev >= t.unlock.prevTierRounds && history.length >= t.unlock.trackRecord) { fr.unlocked = t.id; notes.push(`${t.name} now take your calls.`); }
    }
  }
  const statuses = TIERS.map(t => checkTier(t, history, fr));
  const base = statuses.find(s => s.tier.id === 1)!;
  const failing = base.checks.filter(c => !c.ok && c.label !== 'Track record');
  fr.paused = history.length >= 2 && failing.length > 0;
  fr.pausedReason = fr.paused ? failing.map(c => `${c.label}: ${c.detail}`).join('; ') : null;
  const offers: Offer[] = [];
  for (const s of statuses) {
    if (!s.eligible) continue;
    const [lo, hi] = s.tier.commitment;
    const share = lo + (hi - lo) * rand();
    const names = NAMES[s.tier.id];
    const reason = s.checks.filter(c => c.label !== 'Track record').map(c => `${c.label}: ${c.detail}`).join(' · ');
    offers.push({ id: `offer-${cur.q}-${s.tier.id}`, tierId: s.tier.id, investor: names[Math.floor(rand() * names.length)], amount: Math.round((aum * share) / 1000) * 1000, q: cur.q, reason, terms: s.tier.terms, expiresQ: cur.q + 1 });
    fr.lastOfferQ[s.tier.id] = cur.q;
    fr.rounds[s.tier.id] = (fr.rounds[s.tier.id] ?? 0) + 1;
  }
  return { offers, notes };
}
