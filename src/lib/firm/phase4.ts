// Phase 4: client money flows. Satisfied clients send money into the fund every quarter,
// new clients arrive with a funded amount plus an uncalled commitment (Phase 3 call cycle),
// and rival firms hold real assets that rise and fall with their returns and client wins.
// Every dollar into the fund moves through `subscribe` at NAV, so new money is never profit;
// management fees follow the larger fund automatically.
//
// Client transfers between you and rivals are tracked in `Career.transfers`:
// - from_rival: money a won client is moving. It leaves the rival when the offer is made and is
//   held pending (earning nothing) until the offer is accepted (wired half + committed half) or
//   declined (returned to the rival). wired + committed + returned always equals the amount.
// - to_rival: a client of yours redeeming to a rival. The rival receives it only when the fund
//   actually pays the redemption, after that quarter's rival return, so it never earns a quarter
//   it was not invested for.
import { nav, netAssets, subscribe } from '@/lib/fund/accounting';
import type { Career } from './career';
import { RIVAL_FIRMS, rivalReturn } from './relations';
import { roomFor } from './clients';
import { clientMood } from './coverage';

export type FlowKind = 'contribution' | 'call_bonus' | 'top_up' | 'manager_acquisition' | 'new_client' | 'referral' | 'won_from_rival' | 'lost_to_rival';
export interface ClientFlow { q: number; investorId: string; name: string; amount: number; kind: FlowKind; rival?: string; pending?: boolean }
export interface ClientTransfer {
  id: string; q: number; direction: 'from_rival' | 'to_rival'; rival: string; client: string; amount: number;
  status: 'pending' | 'settled' | 'returned'; wired?: number; committed?: number; returned?: number; settledQ?: number;
  decisionId?: string; liabilityId?: string;
}

const m = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`);

/** Quarterly contribution rate: zero at satisfaction 55 or below, rising to 1.5% of the position at 100. */
export const contributionRate = (sat: number) => (sat <= 55 ? 0 : 0.015 * (sat - 55) / 45);

/** The fund can accept new money only while both the career and the fund are open. */
export const acceptsMoney = (c: Career) => c.status === 'running' && c.fund.status !== 'ended';

/** Expected contributions at the next close at today's satisfaction and NAV. */
export function expectedContributions(c: Career): { investorId: string; name: string; amount: number }[] {
  if (!acceptsMoney(c)) return [];
  const p = nav(c.fund.ledger);
  return c.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01).map(i => ({ investorId: i.id, name: i.name, amount: Math.floor(Math.min(roomFor(c, i.id), i.units * p * contributionRate(clientMood(c, i.id))) / 1e4) * 1e4 })).filter(x => x.amount > 0);
}

export function recordFlow(n: Career, f: Omit<ClientFlow, 'q'>) { n.flows.push({ ...f, q: n.fund.q }); }

/** Add money for an existing investor at NAV. Returns the amount actually added (0 once the fund is closed). */
export function addMoney(n: Career, investorId: string, amount: number, kind: FlowKind, rival?: string): number {
  const inv = n.fund.investors.find(i => i.id === investorId);
  if (!inv || !(amount > 0) || !Number.isFinite(amount) || !acceptsMoney(n)) return 0;
  // Never more than the client's remaining allocation capacity (units, commitments and open offers count against it).
  amount = Math.min(amount, roomFor(n, investorId));
  if (!(amount > 0.5)) return 0;
  const u = subscribe(n.fund.ledger, amount); if (u <= 0) return 0;
  inv.units += u;
  recordFlow(n, { investorId, name: inv.name, amount, kind, rival });
  return amount;
}

/** Rival assets earn the quarter that just completed. Runs at close before any client moves of that close. */
export function rivalsAtClose(n: Career) {
  const j = n.fund.history.length - 1;
  if (j < 0 || n.fund.history[j].q !== n.fund.q) return;
  for (let i = 0; i < RIVAL_FIRMS.length; i++) { const id = RIVAL_FIRMS[i].id; if (n.acquiredRivals?.includes(id)) continue; n.rivalAum[id] = Math.max(0, (n.rivalAum[id] ?? 0) * (1 + rivalReturn(n, i, j))); }
}

/** Redemptions to rivals reach the rival once the fund has actually paid them. */
export function settleTransfers(n: Career) {
  for (const t of n.transfers.filter(x => x.status === 'pending' && x.direction === 'to_rival')) {
    const liab = n.fund.ledger.liabilities.find(l => l.id === t.liabilityId);
    if (!liab?.paid) continue;
    // A rival you bought no longer takes money in: the redeemed client leaves the system with its cash.
    if (!n.acquiredRivals?.includes(t.rival)) n.rivalAum[t.rival] = (n.rivalAum[t.rival] ?? 0) + t.amount;
    t.status = 'settled'; t.settledQ = n.fund.q;
    const flow = n.flows.find(f => f.kind === 'lost_to_rival' && f.pending && f.investorId === t.client && f.rival === t.rival && f.q === t.q);
    if (flow) flow.pending = false;
  }
}

/** Runs at close after the quarter trades: contributions arrive at the closing fund price. */
export function phase4AtClose(n: Career) {
  if (!acceptsMoney(n)) return;
  let total = 0;
  for (const x of expectedContributions(n)) total += addMoney(n, x.investorId, x.amount, 'contribution');
  if (total > 0) n.notices.push({ q: n.fund.q, from: 'Fund administrator', subject: `${m(total)} in client contributions`, body: 'Satisfied clients added money at the closing fund price. It grows the fund and its fees, not the return.', tone: 'good' });
}

/** Rival firms start at a fixed multiple of your launch size. */
export const startingRivalAum = (c: Pick<Career, 'fund'>) => Object.fromEntries(RIVAL_FIRMS.map((r, i) => [r.id, netAssets(c.fund.ledger) * [1.4, 0.9, 1.15, 0.7][i]]));

/** Money held between a rival and you: won clients deciding, and redemptions not yet paid. */
export const pendingTransfers = (c: Career) => c.transfers.filter(t => t.status === 'pending');

export const flowsIn = (c: Career, q: number) => c.flows.filter(f => f.q === q && f.kind !== 'lost_to_rival').reduce((a, f) => a + f.amount, 0);
