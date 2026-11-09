// Phase 3: capital commitments and calls, and firm acquisitions of fictional businesses.
// Deterministic per career seed and quarter. Fund money moves only through fund accounting
// (subscribe at NAV), firm money only through the journal; subsidiaries are entities owned by the firm.
import { nav, netAssets, subscribe } from '@/lib/fund/accounting';
import { type Order, assetName, isTradable, marketFor, quarterLabel } from '@/lib/fund/engine';
import { mulberry32 } from '@/lib/fund/market';
import { type Career, RESERVE_QUARTERS, firmCash, reserveTarget, scaleOf } from './career';
import { payOrOwe } from './payables';
import { post } from './journal';
import { isResearcher, withAbility } from './roster';
import { type Effect, type Levers, type Loan, type OneOff, type Statement, type RefinanceRecord, applyDueEffects, businessQuarter, integrationFactor, prehistory, sellBusiness, settleBusiness } from './business';
export { type BusinessQuarter, businessQuarter, integrationFactor } from './business';

export interface Commitment { id: string; investorId: string; name: string; committed: number; called: number; reliability: number; defaulted?: boolean }
export interface CallLine { commitmentId: string; amount: number; paid: number; status: 'due' | 'paid' | 'late' | 'defaulted'; penalty?: number }
export interface CapitalCall { id: string; issuedQ: number; dueQ: number; purpose: 'regular' | 'deal'; ticker?: string; amount: number; lines: CallLine[]; settled: boolean }
export type SubsidiaryKind = 'adviser' | 'research' | 'admin' | 'fintech' | 'hospitality' | 'marina';
export interface Subsidiary {
  id: string; kind: SubsidiaryKind; name: string; price: number; revenueQ: number; costQ: number; multiple: number; acquiredQ: number;
  /** Saved statements: fictional pre-acquisition quarters (simulated) then one real statement per close. */
  history?: Statement[]; postedRevenue?: { q: number; amount: number }; loan?: Loan; levers?: Levers; effects?: Effect[]; oneOffs?: OneOff[]; risks?: string[]; dealId?: string; ownerId?: 'firm';
  /** Saved closing structure (negotiated deals). Cash-free, debt-free: the seller keeps pre-closing cash; we buy none. */
  closing?: Closing;
  /** Research-shop benefit applied once at closing (who gained what). */
  benefit?: { q: number; staff: { id: string; name: string; from: number; to: number }[] };
  refinances?: RefinanceRecord[];
  brandCampaign?: { fromQ: number; untilQ: number; lift: number };
}
export interface Closing { q: number; structure: 'cash_free_debt_free'; sellerCash: number; purchasedCash: number; price: number; equity: number; loan: number; liabilities: number }
export interface AcqTarget {
  id: string; q: number; kind: SubsidiaryKind; name: string; price: number; revenueQ: number; costQ: number; multiple: number; blurb: string;
  history?: Statement[]; customerTop?: number; renewalQ?: number; risks?: string[];
}

export const LATE_PENALTY = 0.02;
const m = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`);
const date = (c: Career) => (c.fund.q > 0 ? quarterLabel(c.fund, c.fund.q) : 'Opening');
const note = (c: Career, from: string, subject: string, body: string, tone: 'good' | 'bad' | 'neutral' = 'neutral') => c.notices.push({ q: c.fund.q, from, subject, body, tone });

// ---------- Commitments ----------

/** Undrawn commitments from the largest outside investors: a quarter of the fund (a tenth when distressed). */
export function startingCommitments(c: Pick<Career, 'fund' | 'scenario'>): Commitment[] {
  const share = c.scenario === 'distressed' ? 0.1 : 0.25;
  const total = netAssets(c.fund.ledger) * share;
  const lps = c.fund.investors.filter(i => i.id !== 'you').sort((a, b) => b.units - a.units).slice(0, 3);
  const weights = [0.45, 0.35, 0.2]; const rel = [0.97, 0.9, 0.82];
  return lps.map((i, k) => ({ id: `cm-${i.id}`, investorId: i.id, name: i.name, committed: total * weights[k], called: 0, reliability: rel[k] }));
}

export const uncalled = (x: Commitment) => (x.defaulted ? 0 : Math.max(0, x.committed - x.called));
export const totalUncalled = (c: Career) => c.commitments.reduce((a, x) => a + uncalled(x), 0);
/** Notice already sent but not yet funded, so it cannot be called twice. */
const noticed = (c: Career, id: string) => c.calls.filter(k => !k.settled).reduce((a, k) => a + k.lines.filter(l => l.commitmentId === id && (l.status === 'due' || l.status === 'late')).reduce((s, l) => s + l.amount - l.paid, 0), 0);
export const callable = (c: Career) => c.commitments.reduce((a, x) => a + Math.max(0, uncalled(x) - noticed(c, x.id)), 0);

/**
 * Send a call notice while planning quarter fund.q + 1. Investors wire at the close of the following
 * quarter (one quarter's notice). Deal calls buy the named stock with whatever arrives.
 */
export function issueCall(c: Career, amount: number, purpose: 'regular' | 'deal', ticker?: string): Career {
  const max = callable(c);
  const amt = Math.min(amount, max);
  if (!(amt > 0.5) || !Number.isFinite(amt)) return c;
  if (purpose === 'deal' && (!ticker || !isTradable(c.fund, ticker))) return c;
  const n: Career = structuredClone(c);
  const open = n.commitments.map(x => ({ x, room: Math.max(0, uncalled(x) - noticed(n, x.id)) })).filter(o => o.room > 0);
  const room = open.reduce((a, o) => a + o.room, 0);
  const lines: CallLine[] = open.map(o => ({ commitmentId: o.x.id, amount: amt * (o.room / room), paid: 0, status: 'due' }));
  const call: CapitalCall = { id: `call-${n.fund.q}-${n.calls.length + 1}`, issuedQ: n.fund.q, dueQ: n.fund.q + 2, purpose, ticker: purpose === 'deal' ? ticker : undefined, amount: amt, lines, settled: false };
  n.calls.push(call);
  note(n, 'Fund administrator', 'Capital call notice sent', `${m(amt)} called ${purpose === 'deal' ? `to buy ${assetName(ticker!)}` : 'for the fund'}. Due at the ${quarterLabel(n.fund, call.dueQ)} close.`);
  return n;
}

/** Fund cash expected from calls at the close of quarter q (before late payments). */
export const callsDueAt = (c: Career, q: number) => c.calls.filter(k => !k.settled).flatMap(k => k.lines.filter(l => (l.status === 'due' && k.dueQ === q) || (l.status === 'late' && k.dueQ < q)).map(l => ({ call: k, line: l })));

function fund(c: Career, x: Commitment, amount: number, penalty: number, call: CapitalCall, q: number, closeId?: string) {
  const inv = c.fund.investors.find(i => i.id === x.investorId);
  const u = subscribe(c.fund.ledger, amount);
  if (inv) inv.units += u;
  x.called += amount;
  post(c.journal, { q, date: quarterLabel(c.fund, q), payer: 'investors', recipient: 'fund', category: 'capital_call', amount, source: `call:${call.id}:${x.id}`, memo: `${x.name} funded a capital call at NAV ${nav(c.fund.ledger).toFixed(2)}`, closeId });
  if (penalty > 0) post(c.journal, { q, date: quarterLabel(c.fund, q), payer: 'investors', recipient: 'fund', category: 'call_penalty', amount: penalty, source: `penalty:${call.id}:${x.id}`, memo: `${x.name} late-payment interest (${LATE_PENALTY * 100}%)`, closeId });
}

/**
 * Settle capital calls due at the close of quarter q, before the quarter trades. Returns the buy orders for deal calls
 * and the late-payment interest. Interest is fund income for all investors: closeQuarter passes it to playQuarter as
 * `income`, so it lands after the quarter's starting NAV and counts in that quarter's return (principal never does).
 * Each investor pays on time with its reliability; a late payer gets one more quarter at a penalty, then defaults.
 */
export function settleCalls(n: Career, q: number, rand: () => number, closeId?: string): { orders: Order[]; income: number } {
  const orders: Order[] = []; let income = 0;
  for (const call of n.calls.filter(k => !k.settled && k.dueQ <= q)) {
    let arrived = 0;
    for (const line of call.lines) {
      const x = n.commitments.find(y => y.id === line.commitmentId); if (!x) continue;
      if (line.status === 'due' && call.dueQ === q) {
        if (rand() < x.reliability) { fund(n, x, line.amount, 0, call, q, closeId); line.paid = line.amount; line.status = 'paid'; arrived += line.amount; }
        else { line.status = 'late'; n.notices.push({ q, from: x.name, subject: 'Capital call payment late', body: `${x.name} missed the ${m(line.amount)} call. It is due next quarter with ${LATE_PENALTY * 100}% late interest, or the commitment is forfeited.`, tone: 'bad' }); n.satisfaction[x.investorId] = Math.max(0, (n.satisfaction[x.investorId] ?? 60) - 5); }
      } else if (line.status === 'late' && call.dueQ < q) {
        if (rand() < Math.min(0.99, x.reliability + 0.05)) { const pen = line.amount * LATE_PENALTY; fund(n, x, line.amount, pen, call, q, closeId); income += pen; line.paid = line.amount; line.penalty = pen; line.status = 'paid'; arrived += line.amount; }
        else { line.status = 'defaulted'; x.defaulted = true; n.notices.push({ q, from: 'Fund counsel', subject: `${x.name} defaulted`, body: `${x.name} failed to fund a capital call twice. Their remaining commitment of ${m(x.committed - x.called)} is cancelled; existing units are unaffected.`, tone: 'bad' }); }
      }
    }
    call.settled = call.lines.every(l => l.status === 'paid' || l.status === 'defaulted');
    if (call.purpose === 'deal' && call.ticker && arrived > 0) orders.push({ ticker: call.ticker, amount: arrived, ref: `call:${call.id}` });
  }
  return { orders, income };
}

/** Regular drawdown program: at each year end, notice up to a quarter of the original commitments. */
export function scheduleRegularCall(n: Career, q: number) {
  if (q % 4 !== 0 || q >= n.fund.quarters - 1) return;
  const tranche = n.commitments.reduce((a, x) => a + x.committed, 0) * 0.25;
  const amt = Math.min(tranche, callable(n));
  if (amt <= 0.5) return;
  const issued = issueCall(n, amt, 'regular');
  Object.assign(n, { calls: issued.calls, notices: issued.notices });
}

// ---------- Acquisitions ----------

const TARGETS: Record<SubsidiaryKind, { names: string[]; blurb: string; margin: number; size: number }> = {
  adviser: { names: ['Harlow Wealth Partners', 'Cedar Row Advisors', 'Northgate Family Advisory'], blurb: 'A wealth adviser. Its fees rise and fall with the market each quarter.', margin: 0.35, size: 1.2 },
  research: { names: ['Ledgerline Research', 'Quarry Street Analytics', 'Brightwater Equity Research'], blurb: 'An independent research shop. Its analysts sharpen your team: everyone on the research team at closing gains up to 4 ability once, never above their potential.', margin: 0.2, size: 0.6 },
  admin: { names: ['Keystone Fund Services', 'Arbor Fund Administration', 'Meridian Back Office'], blurb: 'A fund administrator with outside clients. Steady fees that barely move with markets.', margin: 0.3, size: 0.9 },
  fintech: { names: ['ClearLedger Payments', 'Summit Trading Systems', 'Harbor Financial Software'], blurb: 'A financial software subscription business. Manage product pricing, developers and reinvestment in growth.', margin: 0.28, size: 1.5 },
  hospitality: { names: ['Azure Coast Resorts', 'Crown Harbor Hotels', 'Summit Retreat Group'], blurb: 'An operating hotel group. Manage room pricing, service teams and renovations, with actual operating costs.', margin: 0.22, size: 2.5 },
  marina: { names: ['Bluewater Marina Group', 'Seabright Marine Services', 'Portside Yacht Harbors'], blurb: 'A marina and marine-services operator. Berth pricing, maintenance crews and reinvestment shape cash profits.', margin: 0.3, size: 1.8 },
};

/** Two fictional targets offered at each year end. Prices are a multiple of yearly profit. */
export function generateTargets(n: Career, q: number) {
  if (q % 4 !== 0) return;
  const r = mulberry32(n.fund.seed * 389 + q * 17); const k = scaleOf(n);
  const kinds = (Object.keys(TARGETS) as SubsidiaryKind[]).filter(k => n.immersion || ['adviser', 'research', 'admin'].includes(k)).sort(() => r() - 0.5).slice(0, n.immersion ? 3 : 2);
  n.targets = kinds.map((kind, i) => {
    const t = TARGETS[kind]; const name = t.names[Math.floor(r() * t.names.length)];
    const revenueQ = Math.round((1.5e6 + r() * 2.5e6) * t.size * k / 1000) * 1000;
    const costQ = Math.round(revenueQ * (1 - t.margin) / 1000) * 1000;
    const multiple = 6 + Math.round(r() * 40) / 10;
    const id = `tgt-${q}-${i}`; const customerTop = Math.round((0.08 + r() * 0.32) * 100) / 100; const renewalQ = q + 2 + Math.floor(r() * 6);
    return { id, q, kind, name, revenueQ, costQ, multiple, price: Math.round((revenueQ - costQ) * 4 * multiple / 1000) * 1000, blurb: t.blurb,
      history: prehistory(id, kind, revenueQ, costQ, multiple), customerTop, renewalQ,
      risks: [`Largest customer is ${(customerTop * 100).toFixed(0)}% of revenue`, `Key contracts renew around ${quarterLabel(n.fund, Math.min(renewalQ, n.fund.quarters))}`, kind === 'adviser' ? 'Fees move with the stock market' : kind === 'research' ? 'Subscribers can cancel each year' : 'Long contracts, thin margin'] };
  }).filter(t => !n.subsidiaries.some(s => s.name === t.name));
  if (n.targets.length) note(n, n.roster[0]?.name ?? 'Chief operating officer', 'Businesses for sale', `${n.targets.map(t => `${t.name} (${m(t.price)})`).join(' and ')} are available this year. Fictional companies.`);
}

/** Firm cash left above the reserve after paying a price. */
/** Firm cash left above the reserve (now including the new business's own bills) and every unpaid bill after paying a price. */
export const canAfford = (c: Career, price: number, costQ = 0) => firmCash(c) - price >= reserveTarget(c) + costQ * RESERVE_QUARTERS + c.arrears;

export function acquire(c: Career, id: string): Career {
  const t = c.targets.find(x => x.id === id);
  if (!t || !canAfford(c, t.price, t.costQ) || c.status !== 'running') return c;
  const n: Career = structuredClone(c);
  const sub: Subsidiary = { id: `sub-${t.id}`, kind: t.kind, name: t.name, price: t.price, revenueQ: t.revenueQ, costQ: t.costQ, multiple: t.multiple, acquiredQ: n.fund.q, history: t.history ?? prehistory(t.id, t.kind, t.revenueQ, t.costQ, t.multiple), risks: t.risks, ownerId: 'firm' };
  n.subsidiaries.push(sub); n.targets = n.targets.filter(x => x.id !== id);
  n.entities.push({ id: sub.id, name: sub.name, kind: 'company', ownerId: 'firm' });
  post(n.journal, { q: n.fund.q, date: date(n), payer: 'firm', recipient: 'external', category: 'acquisition', amount: t.price, source: `acquire:${t.id}`, memo: `Bought ${t.name}` });
  if (t.kind === 'research') n.roster = n.roster.map(e => (isResearcher(e) ? { ...e, ability: withAbility(e, e.ability + 4) } : e));
  note(n, n.roster[0]?.name ?? 'Chief operating officer', `${t.name} is ours`, `Paid ${m(t.price)}. It joins the firm next quarter; the first two quarters run at half revenue while we integrate it.`, 'good');
  return n;
}

/** Sale value: the purchase multiple on the latest quarterly profit, less a 10% discount for a quick sale. */
export const saleValue = (s: Subsidiary) => Math.max(0, (s.revenueQ - s.costQ) * 4 * s.multiple * 0.9);

/** Legacy name: sell through the full waterfall. */
export function divest(c: Career, id: string): Career { return sellBusiness(c, id).c; }

/** Quarterly revenue for a subsidiary in quarter q, using only that quarter's completed market move. */
export function subsidiaryRevenue(n: Career, s: Subsidiary, q: number): number {
  return businessQuarter(s, q, marketFor(n.fund)[q - 1]?.returns.SPX ?? 0).revenue;
}

/** Post subsidiary revenue at the close of quarter q (before any bills are paid). */
export function subsidiaryRevenueAtClose(n: Career, q: number, closeId: string) {
  for (const s of n.subsidiaries) {
    if (s.acquiredQ >= q) continue;
    applyDueEffects(s, q);
    const rev = subsidiaryRevenue(n, s, q);
    post(n.journal, { q, date: quarterLabel(n.fund, q), payer: s.id, recipient: 'firm', category: 'subsidiary_revenue', amount: rev, source: `close:Q${q}`, memo: `${s.name} revenue${integrationFactor(s, q) < 1 ? ' (integrating, half revenue)' : ''}`, closeId });
    s.postedRevenue = { q, amount: rev };
    const campaign = s.brandCampaign && q >= s.brandCampaign.fromQ && q <= s.brandCampaign.untilQ ? 1 + s.brandCampaign.lift : 1;
    s.revenueQ = Math.max(s.revenueQ * 0.5, Math.min(s.revenueQ * 1.5, rev / integrationFactor(s, q) / campaign));
  }
}

/** Pay each business's bills at the close of quarter q (costs, loan, retained cash, statement); anything unaffordable stays owed. */
export function subsidiaryCostsAtClose(n: Career, q: number, closeId: string): number {
  let owed = 0; const mr = marketFor(n.fund)[q - 1]?.returns.SPX ?? 0;
  for (const s of [...n.subsidiaries]) { if (s.acquiredQ >= q) continue; owed += settleBusiness(n, s, q, mr, closeId).owed; }
  return owed;
}

/** Run-rate net cash per quarter at today's terms, ignoring integration (label as run rate). */
export const subsidiaryNetQ = (c: Career) => c.subsidiaries.reduce((a, s) => a + s.revenueQ - s.costQ, 0);
/** Expected net business cash at the next close, integration included (market moves excluded). */
export const businessesNextQ = (c: Career) => c.subsidiaries.reduce((a, s) => a + businessQuarter(s, c.fund.q + 1).net, 0);
/** Known quarterly bills of every owned business. */
export const businessCostsQ = (c: Pick<Career, 'subsidiaries' | 'fund'>) => c.subsidiaries.reduce((a, s) => { const b = businessQuarter(s, c.fund.q + 1); return a + (b.active ? b.cost + b.debtService : s.costQ); }, 0);
