// Client Contracts v2: a fund that trades real stocks through real market
// years, one quarter per turn. Prices come only from market.ts, so player
// decisions never change prices — the same seed + actions always replay exactly.
import {
  type Ledger, type Liability, accrueManagementFee, addLiability, crystallizePerformanceFee, grossAssets,
  managerWealth, nav, netAssets, payLiability, previewPerformanceFee, redeemUnits, settleDue, subscribe,
} from './accounting';
import { type FundraisingState, type Offer, type QuarterRecord, TIERS, evaluateFundraising, initialFundraising } from './fundraising';
import { COMPANY, COMPLEX_UNIVERSE_TICKERS, FIRST_YEAR, LAST_YEAR, SPX, annualReturn, assetName, buildFundMarket, mulberry32, spxMultiple } from './market';
import { boardReview } from './board';
import { buildCalendarMarket, eventFor } from './calendar';
import { accrueClientFees, managementFee, type ClientFeeState } from './clientFees';

export { mulberry32, SPX, assetName };
export const FUND_RULES_VERSION = 2;
export const LENGTHS = [10, 15, 20] as const;
export type Length = typeof LENGTHS[number];
export type Difficulty = 'normal' | 'hard';
export const TRADE_COST = 0.001;
export const HARD = { startNav: 40, recovery: 100, target: 120 };
export const NORMAL_MIN_MULTIPLE = 2;
export const NORMAL_SPX_FACTOR = 1.5;

export interface Investor { id: string; name: string; relation: string; units: number; joinedQ: number; lockupUntilQ: number; triggerLagQ?: number; maxSingleAsset?: number; note: string }
export interface ScheduledRedemption { id: string; investorId: string; amount: number; q: number; noticeQ: number; label: string }
export interface InboxItem { q: number; from: string; subject: string; body: string; tone: 'neutral' | 'good' | 'bad' }
export interface JournalEntry { q: number; text: string }
export interface DecisionRecord { q: number; main: string; weight: number; ret: number; bench: number; impact: number }
/** timing 'mid' executes halfway through the quarter, after the first half of its move (firm careers). */
export interface Order { ticker: string; amount: number; sellAll?: boolean; timing?: 'mid'; /** Who placed it (firm careers: idea id, 'desk', 'call:<id>'). */ ref?: string }
/** One actual execution. Recorded only for funds that opt in with `receipts: []` (firm careers); other modes are unchanged. */
export interface Receipt { q: number; ref?: string; ticker: string; side: 'buy' | 'sell'; requested: number; amount: number; cost: number; before: number; timing: 'start' | 'mid' | 'settle' | 'between'; bidx: number; note?: string }
export interface ExecCtx { q: number; timing: Receipt['timing']; bidx: number; maxPosition?: number }

export interface FundState {
  version: number; difficulty: Difficulty; seed: number; practice: boolean; fundName: string;
  years: number; startYear: number; quarters: number; q: number; ledger: Ledger; startNav: number; peakNav: number;
  /** Dollars put into each ticker minus dollars taken out (for unrealised P/L display). */
  basis: Record<string, number>; pnl: Record<string, number>;
  /** Opt-in execution receipts (firm careers). Consumed and cleared by the career layer. */ receipts?: Receipt[];
  distressed?: string; lockReleaseQs: number[];
  investors: Investor[]; schedule: ScheduledRedemption[];
  /** aum/nav: the closing observation. Firm careers rewrite them after closing client flows; tradedAum keeps the pre-flow figure. */
  history: (QuarterRecord & { nav: number; aum: number; benchIndex: number; tradedAum?: number; closingFlows?: number })[];
  benchIndex: number; confidence: number; fundraising: FundraisingState; offers: Offer[];
  inbox: InboxItem[]; journal: JournalEntry[]; decisions: DecisionRecord[];
  overdueQuarters: number; paidCount: number; status: 'running' | 'ended';
  milestones: { recovered?: number; doubled?: number }; offerSeq: number;
  /** Optional upgrade fields: absent in existing v2 saves, whose rules stay unchanged. */
  capitalScale?: number;
  /** Firm careers on v2 rules: fund pays only administration/custody/audit; the firm pays staff and rent. Absent = classic costs. */
  costRule?: 'fund_admin';
  /** 'calendar': fixed historical quarterly timing shared by every game (new saves). Absent = the older seeded split. */
  marketRule?: 'calendar';
  /** Explicit new-year opt-in to fictional sentiment paths; annual price returns are unchanged. */ newsFromYear?: number;
  /** Opt-in firm client contracts; absent preserves the shared legacy management fee. */ clientFees?: ClientFeeState;
  boardReviews?: { q: number; netReturn: number; target: number; returnMet: boolean; diversified: boolean; late: boolean }[];
}

const baseLedger = (): Ledger => ({ cash: 0, positions: {}, locked: 0, units: 0, founderUnits: 0, feeHwm: 100, managerCash: 0, liabilities: [], seq: 0 });

/** Hard Mode inheritances: a real stock that fell more than 40% the year before the run starts. */
export function hardCandidates(startYear: number, years: number): string[] {
  return COMPLEX_UNIVERSE_TICKERS.filter(t => {
    const prev = COMPANY[t].returns[startYear - 1];
    if (prev === undefined || prev > -40) return false;
    for (let y = startYear; y < startYear + years; y++) if (annualReturn(t, y) === undefined) return false;
    return true;
  });
}

/** Valid start years for a length/mode. Hard years also need an inheritance and a market a careful manager can climb out of. */
export function startYears(years: number, difficulty: Difficulty): number[] {
  const out: number[] = [];
  for (let y = FIRST_YEAR + (difficulty === 'hard' ? 1 : 0); y + years - 1 <= LAST_YEAR; y++) {
    if (difficulty === 'hard' && (hardCandidates(y, years).length === 0 || spxMultiple(y, years) < 3.2)) continue;
    out.push(y);
  }
  return out;
}

export function pickScenario(seed: number, years: number, difficulty: Difficulty) {
  const r = mulberry32(seed * 7 + years);
  const ys = startYears(years, difficulty);
  const startYear = ys[Math.floor(r() * ys.length)] ?? FIRST_YEAR;
  const cands = difficulty === 'hard' ? hardCandidates(startYear, years) : [];
  return { startYear, distressed: cands.length ? cands[Math.floor(r() * cands.length)] : undefined };
}

/** Fund administration, custody and audit charged to a firm-career fund (career rules v2). The management company pays its own staff and office. */
export const FUND_ADMIN_QUARTER = 0.0002;
/**
 * Fund-level costs per quarter. Classic funds (no costRule) bundle every operating expense of running the fund here, because
 * classic mode has no separate management company. Firm careers on v2 rules charge only fund administration, custody and audit.
 */
export const costPerQuarter = (s: Pick<FundState, 'difficulty' | 'ledger'> & { costRule?: FundState['costRule'] }) =>
  s.costRule === 'fund_admin' ? netAssets(s.ledger) * FUND_ADMIN_QUARTER
    : s.difficulty === 'normal' ? Math.max(1000, netAssets(s.ledger) * 0.0012) : Math.max(1200, netAssets(s.ledger) * 0.0015);
export const costLabel = (s: Pick<FundState, 'costRule'>) => s.costRule === 'fund_admin' ? 'Fund administration, custody and audit' : 'Operating costs';

/** Institutional funds start at $5B (Normal) / $4B (Hard). */
export const INSTITUTIONAL_SCALE = 10_000;

export function newFund(difficulty: Difficulty, seed: number, years: number = 10, practice = false, institutional = false): FundState {
  const Q = years * 4; const at = (f: number) => Math.max(1, Math.round(Q * f));
  const { startYear, distressed } = pickScenario(seed, years, difficulty);
  const l = baseLedger();
  let investors: Investor[]; let schedule: ScheduledRedemption[]; let confidence: number; let lockReleaseQs: number[] = [];
  if (difficulty === 'normal') {
    l.cash = 500_000; l.units = 5000; l.founderUnits = 500;
    investors = [
      { id: 'you', name: 'You (founder)', relation: 'Founder', units: 500, joinedQ: 0, lockupUntilQ: 999, note: 'Everything you had: $50,000.' },
      { id: 'mom', name: 'Mom & Dad', relation: 'Family', units: 1200, joinedQ: 0, lockupUntilQ: 0, note: 'Their retirement cushion. They need tuition money for your sister.' },
      { id: 'ray', name: 'Uncle Ray', relation: 'Family', units: 800, joinedQ: 0, lockupUntilQ: 0, note: 'Wants a chunk back to start a business.' },
      { id: 'priya', name: 'Priya', relation: 'Friend', units: 1000, joinedQ: 0, lockupUntilQ: 0, maxSingleAsset: 0.6, note: 'Wants to see her money grow every year.' },
      { id: 'jordan', name: 'Jordan', relation: 'Friend', units: 900, joinedQ: 0, lockupUntilQ: 0, note: 'Saving for a house down payment.' },
      { id: 'sam', name: 'Sam & Theo', relation: 'Friends', units: 600, joinedQ: 0, lockupUntilQ: 0, note: 'Patient money. Mostly.' },
    ];
    schedule = [
      { id: 's1', investorId: 'mom', amount: 15_000, q: at(0.15), noticeQ: 2, label: 'Mom & Dad — tuition' },
      { id: 's2', investorId: 'jordan', amount: 30_000, q: at(0.3), noticeQ: 2, label: 'Jordan — house deposit' },
      { id: 's3', investorId: 'ray', amount: 45_000, q: at(0.45), noticeQ: 2, label: 'Uncle Ray — business launch' },
      { id: 's4', investorId: 'mom', amount: 20_000, q: at(0.6), noticeQ: 2, label: 'Mom & Dad — tuition' },
      { id: 's5', investorId: 'sam', amount: 15_000, q: at(0.75), noticeQ: 2, label: 'Sam & Theo — wedding' },
      { id: 's6', investorId: 'jordan', amount: 25_000, q: at(0.9), noticeQ: 2, label: 'Jordan — renovation' },
    ];
    confidence = 65;
  } else {
    l.cash = 40_000; l.positions = distressed ? { [distressed]: 280_000 } : {}; l.locked = 80_000; l.units = 10_000; l.feeHwm = 100;
    lockReleaseQs = [1, 2, 3, 4].map(k => at(k / 8));
    investors = [
      { id: 'leg1', name: 'Original LPs', relation: 'Inherited', units: 7000, joinedQ: 0, lockupUntilQ: 0, note: 'They lost 60%. They are watching every quarter.' },
      { id: 'leg2', name: 'The Brennan trust', relation: 'Inherited', units: 2000, joinedQ: 0, lockupUntilQ: 0, note: 'Already filed redemption notices.' },
      { id: 'leg3', name: 'Coastal credit union', relation: 'Inherited', units: 1000, joinedQ: 0, lockupUntilQ: 0, maxSingleAsset: 0.7, note: 'Wants steady profits after the first year.' },
    ];
    schedule = [
      { id: 'h1', investorId: 'leg2', amount: 40_000, q: 1, noticeQ: 0, label: 'Brennan trust — redemption' },
      { id: 'h2', investorId: 'leg1', amount: 30_000, q: 2, noticeQ: 0, label: 'Original LPs — redemption' },
      { id: 'h3', investorId: 'leg2', amount: 50_000, q: 4, noticeQ: 0, label: 'Brennan trust — redemption' },
      { id: 'h4', investorId: 'leg1', amount: 40_000, q: at(0.2), noticeQ: 0, label: 'Original LPs — redemption' },
    ];
    confidence = 35;
  }
  if (institutional) {
    const scale = INSTITUTIONAL_SCALE;
    l.cash *= scale; l.locked *= scale; l.units *= scale; l.founderUnits *= scale;
    for (const t of Object.keys(l.positions)) l.positions[t] *= scale;
    for (const i of investors) i.units *= scale;
    for (const r of schedule) r.amount *= scale;
    if (difficulty === 'normal') {
      const identities = [
        ['You (managing partner)', 'Founder', 'Your $500 million co-investment.'],
        ['Chen Family Office', 'Family office', 'Long-term capital with scheduled distributions.'],
        ['Northbridge Endowment', 'Endowment', 'Funds education grants from scheduled withdrawals.'],
        ['Priya Shah', 'Private investor', 'Only cares about the profit number.'],
        ['Jordan Ellis', 'Private investor', 'Requires liquidity for scheduled capital calls.'],
        ['Summit Partners', 'Limited partner', 'Patient capital, subject to the fund mandate.'],
      ];
      investors.forEach((i, index) => { const identity = identities[index]; if (identity) [i.name, i.relation, i.note] = identity; });
      const labels = ['Chen Family Office distribution', 'Jordan Ellis capital call', 'Northbridge grant funding', 'Chen Family Office distribution', 'Summit Partners distribution', 'Jordan Ellis capital call'];
      schedule.forEach((r, index) => { r.label = labels[index] ?? r.label; });
    }
  }
  const n = nav(l);
  const s: FundState = {
    version: FUND_RULES_VERSION, marketRule: 'calendar', difficulty, seed, practice, fundName: difficulty === 'normal' ? 'Monday Capital' : 'Halvorsen Partners (inherited)',
    years, startYear, quarters: Q, q: 0, ledger: l, startNav: n, peakNav: difficulty === 'hard' ? 100 : n,
    basis: { ...l.positions }, pnl: {}, distressed, lockReleaseQs,
    investors, schedule, history: [], benchIndex: 100, confidence,
    fundraising: initialFundraising(), offers: [], inbox: [], journal: [], decisions: [],
    overdueQuarters: 0, paidCount: 0, status: 'running', milestones: {}, offerSeq: 0,
    ...(institutional ? { capitalScale: INSTITUTIONAL_SCALE, boardReviews: [] } : {}),
  };
  s.inbox.push(institutional
    ? { q: 0, from: 'Investment committee', subject: 'Your management mandate', body: `${difficulty === 'normal' ? '$5 billion' : '$4 billion'} under management. Target ${difficulty === 'normal' ? '8' : '12'}% net return each year. Invest however you like; the board judges you on money made. Keep every distribution on time. Board misses lower confidence at annual reviews.`, tone: 'neutral' }
    : difficulty === 'normal'
    ? { q: 0, from: 'You', subject: 'The fund opens Monday', body: `You put in everything you had. Then they did too. $500,000. ${years} years. Don’t let them down.`, tone: 'neutral' }
    : { q: 0, from: 'Board of the fund', subject: 'You’re in charge now', body: `You are taking over in ${s.startYear}. NAV is 40, down from 100. 70% sits in ${distressed ? assetName(distressed) : 'the inherited position'}, which fell hard last year. $80,000 is locked in a legacy deal. Redemptions start this quarter.`, tone: 'bad' });
  return s;
}

export const marketFor = (s: Pick<FundState, 'seed' | 'startYear' | 'years' | 'marketRule' | 'newsFromYear'>) => s.marketRule === 'calendar' ? buildCalendarMarket(s.startYear, s.years, s.newsFromYear) : buildFundMarket(s.seed, s.startYear, s.years);
export const liquidValue = (l: Ledger) => l.cash + Object.values(l.positions).reduce((a, b) => a + b, 0);
/** Label for quarter q (1-based); always shows the real calendar year, Hard Mode included. */
export function quarterLabel(s: FundState, q: number) {
  const y = Math.floor((q - 1) / 4); const k = ((q - 1) % 4) + 1;
  return `Q${k} ${s.startYear + y}`;
}
/** Year the next quarter trades in. */
export const currentYear = (s: FundState) => s.startYear + Math.floor(s.q / 4);
export const isTradable = (s: FundState, ticker: string) => annualReturn(ticker, currentYear(s)) !== undefined;

export function upcomingDue(s: FundState, n: number): number {
  const open = s.ledger.liabilities.filter(x => !x.paid && x.dueQ <= s.q + n).reduce((a, b) => a + b.amount, 0);
  const sched = s.schedule.filter(r => r.q > s.q && r.q <= s.q + n).reduce((a, b) => a + b.amount, 0);
  return open + sched + costPerQuarter(s) * n;
}
export interface DueLine { label: string; amount: number; basis: 'known' | 'estimate'; note?: string }
/**
 * Everything the fund is expected to pay over the next n quarters, itemised. Known amounts: open liabilities
 * (including deferred fees) and scheduled payouts. Estimates at today's mark: fund costs and the new management
 * fee accruals, plus any year-end performance fee at today's NAV. Never reads future market returns.
 */
export function dueBreakdown(s: FundState, n: number): DueLine[] {
  const l = s.ledger; const out: DueLine[] = [];
  const open = l.liabilities.filter(x => !x.paid && x.dueQ <= s.q + n);
  for (const x of open) out.push({ label: `${x.dueQ <= s.q ? 'Overdue · ' : ''}${x.label}`, amount: x.amount, basis: 'known' });
  for (const r of s.schedule.filter(r => r.q > s.q && r.q <= s.q + n)) out.push({ label: `${quarterLabel(s, r.q)} · ${r.label}`, amount: r.amount, basis: 'known' });
  const mark = netAssets(l);
  out.push({ label: `${costLabel(s)} × ${n}`, amount: costPerQuarter(s) * n, basis: 'estimate', note: 'at today\'s fund size' });
  out.push({ label: `${s.clientFees ? 'Management fees by client' : 'Management fee 0.25%'} × ${n}`, amount: Array.from({ length: n }, (_, k) => managementFee(l, s.investors, s.clientFees, s.q + k + 1, mark)).reduce((a, x) => a + x, 0), basis: 'estimate', note: 'whole invested balance; paid from fund assets; moves with the market' });
  const yearEnds = Array.from({ length: n }, (_, k) => s.q + k + 1).filter(q => q % 4 === 0 && q <= s.quarters).length;
  const perf = previewPerformanceFee(l);
  if (yearEnds > 0 && perf > 0) out.push({ label: 'Performance fee at year end', amount: perf, basis: 'estimate', note: 'only if NAV is still above the high-water mark' });
  return out;
}
export const estimatedDue = (s: FundState, n: number) => dueBreakdown(s, n).reduce((a, b) => a + b.amount, 0);
export function coverage(s: FundState, n: number): number {
  const due = upcomingDue(s, n);
  return due <= 0 ? 99 : Math.min(99, s.ledger.cash / due);
}

/** Apply orders to a copy of the positions: sells first, then buys up to available cash. */
export function applyOrders(s: FundState, orders: Order[], ctx?: ExecCtx) {
  const l = s.ledger; let traded = 0; const rejected: string[] = [];
  const cx: ExecCtx = ctx ?? { q: s.q, timing: 'between', bidx: s.benchIndex };
  const rec = (r: Omit<Receipt, 'q' | 'timing' | 'bidx'>) => { if (Array.isArray(s.receipts)) s.receipts.push({ ...r, q: cx.q, timing: cx.timing, bidx: cx.bidx }); };
  for (const o of orders.filter(o => o.sellAll || o.amount < 0)) {
    const have = l.positions[o.ticker] ?? 0; if (have <= 0) continue;
    const amt = o.sellAll ? have : Math.min(have, -o.amount);
    const cost = amt * TRADE_COST;
    l.positions[o.ticker] = have - amt; if (l.positions[o.ticker] < 0.005) delete l.positions[o.ticker];
    l.cash += amt - cost; traded += amt;
    s.basis[o.ticker] = (s.basis[o.ticker] ?? 0) * (have > 0 ? (have - amt) / have : 0);
    rec({ ref: o.ref, ticker: o.ticker, side: 'sell', requested: o.sellAll ? have : -o.amount, amount: amt, cost, before: have });
  }
  // A position cap (firm constitution) is enforced here, at the real execution boundary, against current net assets.
  const capBase = cx.maxPosition !== undefined ? netAssets(l) : 0;
  for (const o of orders.filter(o => !o.sellAll && o.amount > 0)) {
    if (!isTradable(s, o.ticker)) { rejected.push(o.ticker); rec({ ref: o.ref, ticker: o.ticker, side: 'buy', requested: o.amount, amount: 0, cost: 0, before: l.positions[o.ticker] ?? 0, note: 'not trading' }); continue; }
    let want = o.amount; let note: string | undefined;
    if (cx.maxPosition !== undefined && o.ticker !== SPX) {
      const room = Math.max(0, cx.maxPosition * capBase - (l.positions[o.ticker] ?? 0));
      if (want > room + 1) { want = room; note = `trimmed to the ${(cx.maxPosition * 100).toFixed(0)}% position limit`; }
    }
    const amt = Math.min(want, l.cash / (1 + TRADE_COST));
    if (amt < want - 1 && !note) note = 'partial fill: not enough cash';
    const before = l.positions[o.ticker] ?? 0;
    if (amt <= 0.5) { rec({ ref: o.ref, ticker: o.ticker, side: 'buy', requested: o.amount, amount: 0, cost: 0, before, note: note ?? 'no cash' }); continue; }
    l.cash -= amt * (1 + TRADE_COST);
    l.positions[o.ticker] = before + amt;
    s.basis[o.ticker] = (s.basis[o.ticker] ?? 0) + amt; traded += amt;
    rec({ ref: o.ref, ticker: o.ticker, side: 'buy', requested: o.amount, amount: amt, cost: amt * TRADE_COST, before, note });
  }
  return { traded, cost: traded * TRADE_COST, rejected };
}

export interface TradePreview { buys: number; sells: number; cost: number; cashAfter: number; coverAfter: number; maxWeight: number; maxTicker: string | null }
export function previewOrders(s: FundState, orders: Order[], dueFn: (s: FundState, n: number) => number = upcomingDue): TradePreview {
  const c: FundState = structuredClone(s);
  const before = { ...c.ledger.positions };
  applyOrders(c, orders);
  let buys = 0, sells = 0;
  for (const t of new Set([...Object.keys(before), ...Object.keys(c.ledger.positions)])) {
    const d = (c.ledger.positions[t] ?? 0) - (before[t] ?? 0); if (d > 0) buys += d; else sells -= d;
  }
  const gross = Math.max(1, grossAssets(c.ledger));
  const [maxTicker, maxWeight] = Object.entries(c.ledger.positions).filter(([k]) => k !== SPX)
    .reduce<[string | null, number]>((m, [k, v]) => (v / gross > m[1] ? [k, v / gross] : m), [null, 0]);
  const due = dueFn(s, 1);
  return { buys, sells, cost: (buys + sells) * TRADE_COST, cashAfter: c.ledger.cash, coverAfter: due > 0 ? c.ledger.cash / due : 99, maxWeight, maxTicker };
}

/** Helper presets: orders that move the fund to a target mix while keeping a cash reserve. */
export function rebalanceOrders(s: FundState, preset: 'index' | 'balanced' | 'cash', reserveQuarters = 2, dueFn: (s: FundState, n: number) => number = upcomingDue): Order[] {
  const l = s.ledger; const total = liquidValue(l) * (1 - TRADE_COST);
  const reserve = Math.min(total, dueFn(s, reserveQuarters));
  const targets: Record<string, number> = {};
  if (preset === 'index') targets[SPX] = total - reserve;
  else if (preset === 'balanced') {
    const held = Object.keys(l.positions).filter(t => t !== SPX && isTradable(s, t));
    const inv = (total - reserve) * 0.85;
    targets[SPX] = held.length ? (total - reserve) * 0.5 : inv;
    for (const t of held) targets[t] = ((total - reserve) * 0.5) / held.length;
  }
  const orders: Order[] = [];
  for (const t of Object.keys(l.positions)) if (!(t in targets)) orders.push({ ticker: t, amount: 0, sellAll: true });
  for (const [t, v] of Object.entries(targets)) { const d = v - (l.positions[t] ?? 0); if (Math.abs(d) > 1) orders.push({ ticker: t, amount: d }); }
  return orders;
}

/** income: fund income earned this quarter outside the market (firm careers: late capital-call interest). It lands after the starting NAV, so it counts in this quarter's return. */
export interface QuarterDecision { orders: Order[]; acceptOfferIds: string[]; sellLocked?: number; journal?: string; income?: number; /** Firm constitution: largest single position, enforced at execution. */ maxPosition?: number }
const fmt = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const pc = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

/** Advance one quarter. Order: offers → redemptions → early locked sale → trades → market → releases → costs/fees → settle → review → fundraising. */
export function playQuarter(input: FundState, d: QuarterDecision): FundState {
  const s: FundState = structuredClone(input);
  if (s.status === 'ended') return s;
  const q = s.q + 1; const l = s.ledger; const m = marketFor(s)[q - 1];
  const navStart = nav(l);
  // 1. Accept offers — units at current NAV (cash lands before trading, so it can be invested this quarter).
  for (const o of s.offers) {
    if (!d.acceptOfferIds.includes(o.id)) continue;
    const u = subscribe(l, o.amount);
    const tier = TIERS.find(t => t.id === o.tierId)!;
    s.investors.push({ id: `inv-${++s.offerSeq}`, name: o.investor, relation: tier.name, units: u, joinedQ: q, lockupUntilQ: q + o.terms.lockupQ, triggerLagQ: o.terms.triggerLagQ, maxSingleAsset: o.terms.maxSingleAsset, note: `${fmt(o.amount)} at NAV ${navStart.toFixed(2)}. Expects ~${Math.round(o.terms.expectedAnnual * 100)}%/yr; leaves if the fund trails the S&P 500 ${o.terms.triggerLagQ} quarters running.` });
    s.inbox.push({ q, from: o.investor, subject: 'Wire sent', body: `${fmt(o.amount)} is in your cash. New units issued at ${navStart.toFixed(2)} — this grows the fund, not your return.`, tone: 'good' });
  }
  s.offers = [];
  // 2. Scheduled redemptions and contract exits.
  for (const r of s.schedule.filter(x => x.q === q)) {
    const inv = s.investors.find(i => i.id === r.investorId);
    const units = Math.min(inv?.units ?? 0, r.amount / navStart);
    if (inv && units > 0) { inv.units -= units; redeemUnits(l, units, q, r.label, inv.id); }
  }
  for (const inv of s.investors) {
    if (!inv.triggerLagQ || inv.units <= 0 || q <= inv.lockupUntilQ) continue;
    const lastN = s.history.slice(-inv.triggerLagQ);
    if (lastN.length === inv.triggerLagQ && lastN.every(h => h.ret < h.bench)) {
      redeemUnits(l, inv.units, q + 1, `${inv.name} — contract exit`, inv.id); inv.units = 0;
      s.inbox.push({ q, from: inv.name, subject: 'We’re out', body: `You trailed the S&P 500 ${inv.triggerLagQ} quarters in a row. Per our agreement we are redeeming in full next quarter.`, tone: 'bad' });
    }
  }
  // Fund income (late capital-call interest) belongs to investors holding units after this quarter's subscriptions and redemptions.
  if (d.income && Number.isFinite(d.income) && d.income > 0) l.cash += d.income;
  // 3. Early locked sale at a 30% discount.
  if (d.sellLocked && l.locked > 0) {
    const amt = Math.min(l.locked, d.sellLocked);
    l.locked -= amt; l.cash += amt * 0.7;
    s.inbox.push({ q, from: 'Legacy deal desk', subject: 'Early exit executed', body: `Sold ${fmt(amt)} of the locked holding for ${fmt(amt * 0.7)} (30% early-exit discount).`, tone: 'neutral' });
  }
  // 4. Trades. Start-of-quarter orders trade now; mid-quarter orders trade after the first half of the move.
  const startOrders = d.orders.filter(o => o.timing !== 'mid'); const midOrders = d.orders.filter(o => o.timing === 'mid');
  const cap = d.maxPosition !== undefined && Number.isFinite(d.maxPosition) && d.maxPosition > 0 && d.maxPosition < 1 ? d.maxPosition : undefined;
  const bench0 = s.benchIndex; const benchQ = m.returns[SPX] ?? 0;
  const tr = applyOrders(s, startOrders, { q, timing: 'start', bidx: bench0, maxPosition: cap });
  const gross0 = Math.max(1, grossAssets(l));
  const [main, weight] = Object.entries(l.positions).reduce<[string, number]>((a, [k, v]) => (v / gross0 > a[1] ? [k, v / gross0] : a), ['cash', l.cash / gross0]);
  // 5. Market. Two halves compound to exactly the quarter's return, so plans without mid-quarter orders are unchanged.
  let best: [string, number] | null = null, worst: [string, number] | null = null;
  for (const t of Object.keys(m.returns)) { const r = m.returns[t]; if (!(t in l.positions) && !midOrders.some(o => o.ticker === t)) continue; if (!best || r > best[1]) best = [t, r]; if (!worst || r < worst[1]) worst = [t, r]; }
  const move = (part: (r: number) => number) => {
    for (const [t, v] of Object.entries(l.positions)) { const r = part(m.returns[t] ?? 0); s.pnl[t] = (s.pnl[t] ?? 0) + v * r; l.positions[t] = v * (1 + r); }
    l.cash *= 1 + part(m.cash);
  };
  if (midOrders.length) {
    const half = (r: number) => Math.sqrt(1 + r) - 1;
    move(half);
    const mid = applyOrders(s, midOrders, { q, timing: 'mid', bidx: bench0 * Math.sqrt(1 + benchQ), maxPosition: cap }); tr.rejected.push(...mid.rejected);
    move(half);
  } else move(r => r);
  if (tr.rejected.length) s.inbox.push({ q, from: 'Trading desk', subject: 'Order skipped', body: `${tr.rejected.join(', ')} is not trading yet.`, tone: 'neutral' });
  const bench = m.returns[SPX];
  l.locked *= 1 + bench * 0.5;
  s.benchIndex *= 1 + bench;
  if (s.marketRule === 'calendar') { const ev = eventFor(m.year, m.qInYear); if (ev) s.inbox.push({ q, from: 'Market wire', subject: `Markets in ${quarterLabel(s, q)}`, body: ev, tone: bench >= 0 ? 'neutral' : 'bad' }); }
  // 6. Locked releases in stages (Hard Mode).
  const stage = s.lockReleaseQs.indexOf(q);
  if (stage >= 0 && l.locked > 0) {
    const rel = l.locked / (s.lockReleaseQs.length - stage);
    l.locked -= rel; l.cash += rel;
    s.inbox.push({ q, from: 'Legacy deal desk', subject: 'Locked tranche released', body: `${fmt(rel)} of the legacy holding is now cash.`, tone: 'good' });
  }
  // 7. Costs and fees.
  addLiability(l, 'cost', costPerQuarter(s), q, costLabel(s));
  if (s.clientFees) accrueClientFees(l, s.investors, s.clientFees, q); else accrueManagementFee(l, q);
  if (q % 4 === 0) {
    const pf = crystallizePerformanceFee(l, q);
    if (pf) s.inbox.push({ q, from: 'Fund administrator', subject: 'Annual performance fee', body: `${fmt(pf.amount)} accrued: 10% of gains above the high-water mark. New mark: ${l.feeHwm.toFixed(2)}.`, tone: 'neutral' });
  }
  // 8. Settle. Like a real prime broker, the desk sells holdings evenly to meet investor payouts and costs
  // when cash is short, so a fully invested fund is never closed for a payment it could afford.
  const mustPay = l.liabilities.filter(x => !x.paid && x.dueQ <= q).reduce((a, b) => a + b.amount, 0);
  const forcedSale = mustPay > l.cash ? sellForCash(s, mustPay - l.cash, { q, timing: 'settle', bidx: s.benchIndex }) : 0;
  if (forcedSale > 0) s.inbox.push({ q, from: 'Prime broker', subject: 'Holdings sold to meet payments', body: `Cash was short, so ${fmt(forcedSale)} of holdings was sold evenly to pay investors, costs and fees on time. Keep a cash reserve to avoid forced selling.`, tone: 'neutral' });
  const { paid, overdue } = settleDue(l, q);
  const paidObligations = paid.filter((x: Liability) => x.kind === 'redemption');
  s.paidCount += paidObligations.length;
  for (const p of paidObligations) s.inbox.push({ q, from: p.label.split(' — ')[0], subject: 'Payment received', body: `${fmt(p.amount)} arrived on time. Thank you.`, tone: 'good' });
  const late = overdue.length > 0;
  s.overdueQuarters = late ? s.overdueQuarters + 1 : 0;
  if (late) s.inbox.push({ q, from: 'Fund administrator', subject: 'Overdue obligations', body: `${overdue.length} payment(s) totalling ${fmt(overdue.reduce((a, b) => a + b.amount, 0))} could not be paid, even after selling every liquid holding. They remain owed. Two quarters overdue closes the fund.`, tone: 'bad' });
  // 9. Review. Investors care about money: a profitable quarter always raises confidence.
  const navEnd = nav(l);
  const ret = navStart > 0 ? navEnd / navStart - 1 : -1;
  s.peakNav = Math.max(s.peakNav, navEnd);
  const drawdown = s.peakNav > 0 ? 1 - navEnd / s.peakNav : 1;
  s.q = q;
  const cov = [1, 2, 3].map(n => coverage(s, n));
  const reasons = confidenceReasons({ ret, bench, late, paidOnTime: paidObligations.length, forcedSale: forcedSale > 0 });
  const dc = reasons.reduce((a, r) => a + r.points, 0);
  const notes = reasons.map(r => `${r.text} (${r.points >= 0 ? '+' : ''}${r.points})`);
  const before = s.confidence;
  s.confidence = Math.max(0, Math.min(100, s.confidence + dc));
  const movers = best && worst ? ` Best holding ${assetName(best[0])} ${pc(best[1])}, worst ${assetName(worst[0])} ${pc(worst[1])}.` : '';
  s.inbox.push({ q, from: 'Quarterly review', subject: `${quarterLabel(s, q)}: NAV ${navEnd.toFixed(2)} (${pc(ret)})`, body: `S&P 500 ${pc(bench)}.${movers} Confidence ${Math.round(s.confidence)}: ${notes.join('; ')}.`, tone: ret >= 0 ? 'good' : 'bad' });
  s.decisions.push({ q, main, weight, ret, bench, impact: (ret - bench) * netAssets(l) });
  if (d.journal?.trim()) s.journal.push({ q, text: d.journal.trim().slice(0, 280) });
  s.history.push({ q, ret, bench, drawdown, coverage: cov, latePayment: late, confidence: s.confidence, confidenceDelta: s.confidence - before, confidenceNotes: reasons, forcedSale: forcedSale || undefined, nav: navEnd, aum: netAssets(l), benchIndex: s.benchIndex });
  if (s.boardReviews && q % 4 === 0) {
    const review = boardReview(s, true);
    const riskMet = true; // board judges money only
    s.boardReviews.push({ q, netReturn: review.netReturn, target: review.annualTarget, returnMet: review.returnMet, diversified: riskMet, late });
    const adjustment = annualReviewPoints(review.netReturn, review.annualTarget);
    const prior = s.confidence;
    s.confidence = Math.max(0, Math.min(100, s.confidence + adjustment));
    const latest = s.history.at(-1);
    if (latest) {
      latest.confidence = s.confidence;
      latest.confidenceDelta = (latest.confidenceDelta ?? 0) + (s.confidence - prior);
      latest.confidenceNotes = [...(latest.confidenceNotes ?? []), { text: review.returnMet ? 'Annual target hit' : review.netReturn > 0 ? 'Profitable year, below target' : 'Losing year', points: adjustment }];
    }
    const verdict = review.returnMet ? 'The board is thrilled with the money you made.' : review.netReturn > 0 ? 'You made money this year, so the board is still pleased. They want more next year.' : 'The fund lost money this year. The board wants profit.';
    s.inbox.push({ q, from: 'Investment committee', subject: `Annual board review: ${review.returnMet && riskMet && !late ? 'mandate met' : review.netReturn > 0 ? 'profitable, below target' : 'action required'}`, body: `Net return ${pc(review.netReturn)} against ${pc(review.annualTarget)}. ${verdict} ${late ? 'Payments overdue.' : 'No overdue payments.'} Confidence ${adjustment >= 0 ? '+' : ''}${adjustment}.`, tone: review.netReturn > 0 && !late ? 'good' : 'bad' });
  }
  if (s.difficulty === 'hard' && !s.milestones.recovered && navEnd >= HARD.recovery) { s.milestones.recovered = q; s.inbox.push({ q, from: 'Original LPs', subject: 'You got us back to even', body: 'NAV 100. We did not think this was possible.', tone: 'good' }); }
  if (s.difficulty === 'normal' && !s.milestones.doubled && navEnd >= 200) { s.milestones.doubled = q; s.inbox.push({ q, from: 'Mom & Dad', subject: 'You doubled it', body: 'Every dollar we gave you is now two. We’re proud of you.', tone: 'good' }); }
  // 10. Fundraising.
  const fr = evaluateFundraising(s.history, s.fundraising, netAssets(l), mulberry32(s.seed * 31 + q));
  for (const n of fr.notes) s.inbox.push({ q, from: 'Your network', subject: 'Reputation update', body: n, tone: 'neutral' });
  s.offers = fr.offers;
  for (const o of fr.offers) s.inbox.push({ q, from: o.investor, subject: `Offer: ${fmt(o.amount)}`, body: `Why now: ${o.reason}`, tone: 'good' });
  // 11. End conditions.
  if (s.overdueQuarters >= 2 || navEnd < 10 || (s.confidence <= 0 && late) || q >= s.quarters) s.status = 'ended';
  return s;
}

/** Normal Mode objective: unit NAV growth of at least 1.5× the S&P 500's growth, and at least doubling. */
export function normalTargetMultiple(startYear: number, years: number) {
  return Math.max(NORMAL_MIN_MULTIPLE, 1 + NORMAL_SPX_FACTOR * (spxMultiple(startYear, years) - 1));
}

export type Outcome = 'achieved' | 'survived' | 'recovered' | 'failed';
export interface FundResult {
  outcome: Outcome; nav: number; netReturn: number; benchReturn: number; margin: number; maxDrawdown: number; targetNav: number;
  paid: number; shortfall: number; managerWealth: number; founderEquity: number; managerFees: number; aum: number;
  recoveryProgress?: number; consequential: string[]; rankKey: [number, number, number];
  best: { ticker: string; pnl: number }[]; worst: { ticker: string; pnl: number }[];
}

export function fundResult(s: FundState): FundResult {
  const l = s.ledger; const n = nav(l);
  const failed = s.overdueQuarters >= 2 || n < 10 || (s.confidence <= 0 && s.overdueQuarters > 0);
  const shortfall = l.liabilities.filter(x => !x.paid && (x.kind === 'redemption' || x.kind === 'cost')).reduce((a, b) => a + b.amount, 0);
  const targetNav = s.difficulty === 'normal' ? s.startNav * normalTargetMultiple(s.startYear, s.years) : HARD.target;
  const finished = s.q >= s.quarters;
  const mandateMet = !s.boardReviews || boardReview(s, true).returnMet;
  let outcome: Outcome = failed ? 'failed' : n >= targetNav && finished && shortfall === 0 && mandateMet ? 'achieved' : s.difficulty === 'hard' && n >= HARD.recovery ? 'recovered' : 'survived';
  if (!finished && !failed) outcome = 'survived';
  const netReturn = n / s.startNav - 1;
  const benchReturn = s.benchIndex / 100 - 1;
  const maxDrawdown = s.history.reduce((a, h) => Math.max(a, h.drawdown), 0);
  const top = [...s.decisions].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 3);
  const consequential = top.map(dc => `${quarterLabel(s, dc.q)}: holding ${Math.round(dc.weight * 100)}% in ${dc.main === 'cash' ? 'cash' : assetName(dc.main)} ${dc.impact >= 0 ? 'added' : 'cost'} ${fmt(Math.abs(dc.impact))} versus the S&P 500.`);
  const tier = outcome === 'achieved' ? 3 : outcome === 'recovered' ? 2 : outcome === 'survived' ? 1 : 0;
  const pnl = Object.entries(s.pnl).map(([ticker, v]) => ({ ticker, pnl: v }));
  return {
    outcome, nav: n, netReturn, benchReturn, margin: netReturn - benchReturn, maxDrawdown, targetNav, paid: s.paidCount, shortfall,
    managerWealth: managerWealth(l), founderEquity: l.founderUnits * n, managerFees: l.managerCash, aum: netAssets(l),
    recoveryProgress: s.difficulty === 'hard' ? Math.min(1, (n - HARD.startNav) / (HARD.recovery - HARD.startNav)) : undefined, consequential,
    rankKey: [tier, netReturn, -maxDrawdown],
    best: [...pnl].sort((a, b) => b.pnl - a.pnl).filter(x => x.pnl > 0).slice(0, 3),
    worst: [...pnl].sort((a, b) => a.pnl - b.pnl).filter(x => x.pnl < 0).slice(0, 3),
  };
}

/** Successful runs first, then net investor return, then lower drawdown. AUM and fees never count. */
export const compareResults = (a: FundResult, b: FundResult) => b.rankKey[0] - a.rankKey[0] || b.rankKey[1] - a.rankKey[1] || b.rankKey[2] - a.rankKey[2];

export { nav, previewPerformanceFee, netAssets };

/** Confidence points for one quarter. Investors care about money: a profitable quarter is always positive unless a payment is overdue. */
export function confidenceReasons(x: { ret: number; bench: number; late: boolean; paidOnTime: number; forcedSale?: boolean }): { text: string; points: number }[] {
  const out: { text: string; points: number }[] = [];
  if (x.ret > 0) {
    out.push({ text: `Made ${(x.ret * 100).toFixed(x.ret < 0.001 ? 2 : 1)}% this quarter`, points: Math.min(6, Math.max(1, Math.round(1 + x.ret * 60))) });
    if (x.ret > x.bench) out.push({ text: 'Beat the S&P 500', points: Math.min(3, Math.max(1, Math.round((x.ret - x.bench) * 60))) });
  } else {
    const hit = -Math.min(8, Math.max(1, Math.round(-x.ret * 120)));
    if (x.bench < x.ret) out.push({ text: `Lost ${(-x.ret * 100).toFixed(1)}%, but less than the S&P 500`, points: Math.min(-1, Math.round(hit / 2)) });
    else out.push({ text: `Lost ${(-x.ret * 100).toFixed(1)}% this quarter`, points: hit });
  }
  if (x.late) out.push({ text: 'Investor payment overdue', points: -15 });
  else if (x.paidOnTime > 0) out.push({ text: 'Paid investors on time', points: 2 });
  return out;
}

/** Year-end board points: hitting the target is great, any profit still pleases, only a losing year costs confidence. */
export const annualReviewPoints = (netReturn: number, target: number) =>
  netReturn + 1e-8 >= target ? 3 + (netReturn >= target * 2 ? 3 : 0) : netReturn > 0 ? 1 : -5;

/** Sell liquid holdings evenly so `need` of cash arrives after trading costs. Mutates s; returns the value sold. */
export function sellForCash(s: FundState, need: number, ctx?: ExecCtx): number {
  const l = s.ledger; if (need <= 0) return 0;
  const liquid = Object.values(l.positions).reduce((a, b) => a + b, 0);
  if (liquid <= 0) return 0;
  const sell = Math.min(liquid, (need / (1 - TRADE_COST)) * 1.0001);
  const share = sell / liquid;
  applyOrders(s, Object.entries(l.positions).map(([ticker, v]) => (share >= 0.9999 ? { ticker, amount: 0, sellAll: true, ref: 'liquidity' } : { ticker, amount: -v * share, ref: 'liquidity' })), ctx);
  return sell;
}

/** Raise a chosen amount of cash now by trimming every holding evenly. Returns a new state. */
export function raiseCashNow(input: FundState, amount: number): FundState {
  const s = structuredClone(input);
  const sold = sellForCash(s, amount);
  if (sold > 0) s.inbox.push({ q: s.q, from: 'Trading desk', subject: 'Cash raised', body: `Trimmed ${fmt(sold)} of holdings evenly. Cash is now ${fmt(s.ledger.cash)}.`, tone: 'neutral' });
  return s;
}

/** Pay every overdue or currently due investor payment and cost now, selling holdings pro rata if cash is short. */
export function payInvestorsNow(input: FundState): FundState {
  const s = structuredClone(input); const l = s.ledger;
  const due = l.liabilities.filter(x => !x.paid && x.dueQ <= s.q + 1);
  const owed = due.reduce((a, b) => a + b.amount, 0);
  sellForCash(s, owed - l.cash);
  const order: Record<string, number> = { cost: 0, redemption: 1, mgmt_fee: 2, perf_fee: 3 };
  let paidTotal = 0;
  for (const d of due.sort((a, b) => order[a.kind] - order[b.kind] || a.dueQ - b.dueQ)) {
    if (payLiability(l, d)) { paidTotal += d.amount; if (d.kind === 'redemption') s.paidCount += 1; }
  }
  if (!l.liabilities.some(x => !x.paid && x.dueQ <= s.q && (x.kind === 'redemption' || x.kind === 'cost'))) s.overdueQuarters = 0;
  if (paidTotal > 0) s.inbox.push({ q: s.q, from: 'Fund administrator', subject: 'Investors paid', body: `${fmt(paidTotal)} paid out. Nothing is overdue.`, tone: 'good' });
  return s;
}
