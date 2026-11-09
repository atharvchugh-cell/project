// Firm constitution and partner politics. A few standing rules with real effects:
// - maxPosition: buy orders that would push one stock above this share of the fund are trimmed (planDecision, sleeves)
// - reserveQuarters: quarters of bills the firm must hold (reserveTarget, distributions, deals, office)
// - payoutShare: share of the distributable cash that can be paid to owners
// - service: 'premium' pays a quarterly client-service cost and lifts every client relationship (reviews, quotes)
// - majority: weighted vote needed for amendments and big moves (manager acquisitions, firm sale, IPO, succession)
// Amendments are proposed, voted at the next close by cap-table weight (sum 100%), and take effect after the vote.
// Locked investor obligations (lockups, liabilities, commitments) are never rewritten by a rule change.
import { netAssets } from '@/lib/fund/accounting';
import { quarterLabel, type Order, assetName, SPX } from '@/lib/fund/engine';
import { mulberry32 } from '@/lib/fund/market';
import type { Career, DecisionOption, PendingDecision } from './career';
import { RESERVE_QUARTERS, firmCash, founderCash, quarterlyExpenses } from './career';
import { post } from './journal';
import { payOrOwe } from './payables';
import { lifeOf, reputation, spendTime, timeLeft } from './life';
import { publicRestricted } from './publicBook';

export interface Constitution { maxPosition: number; reserveQuarters: number; payoutShare: number; service: 'standard' | 'premium'; majority: number }
export type RuleKey = keyof Constitution;
export interface Vote { holderId: string; name: string; weight: number; yes: boolean; reason: string }
export interface Amendment { id: string; q: number; rule: RuleKey; from: number | string; to: number | string; voteQ: number; status: 'pending' | 'passed' | 'failed'; votes?: Vote[]; yes?: number }
export interface PartnerState { morale: number; loyalty: number; lastMetQ: number; grievance?: string }
export interface Governance { constitution: Constitution; amendments: Amendment[]; lastProposalQ: number; partners: Record<string, PartnerState>; votes: { q: number; topic: string; yes: number; needed: number; passed: boolean; votes: Vote[] }[]; politicsQ: number }

export const DEFAULT_CONSTITUTION: Constitution = { maxPosition: 1, reserveQuarters: RESERVE_QUARTERS, payoutShare: 1, service: 'standard', majority: 0.5 };
export const RULES: { key: RuleKey; label: string; options: { value: number | string; label: string }[]; effect: string }[] = [
  { key: 'maxPosition', label: 'Largest single stock', options: [0.2, 0.25, 0.35, 0.5, 1].map(v => ({ value: v, label: v === 1 ? 'No limit' : `${v * 100}% of the fund` })), effect: 'Buy orders above this are trimmed before the quarter runs. Existing holdings are never force-sold.' },
  { key: 'reserveQuarters', label: 'Cash reserve', options: [2, 3, 4, 6].map(v => ({ value: v, label: `${v} quarters of bills` })), effect: 'The firm must keep this many quarters of bills before distributions, deals or office moves.' },
  { key: 'payoutShare', label: 'Owner payouts', options: [0.25, 0.5, 0.75, 1].map(v => ({ value: v, label: `${v * 100}% of distributable cash` })), effect: 'Caps how much of the cash above the reserve can be paid to owners each time.' },
  { key: 'service', label: 'Client service', options: [{ value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium (costs 0.01% of fund a quarter)' }], effect: 'Premium lifts every client relationship each close, adds a quarter of patience and improves offers.' },
  { key: 'majority', label: 'Vote needed for big decisions', options: [0.5, 0.667, 0.75].map(v => ({ value: v, label: v === 0.5 ? 'Simple majority' : `${Math.round(v * 100)}%` })), effect: 'Weighted by ownership. Applies to amendments, buying a rival manager, selling the firm, the IPO and succession.' },
];
export const AMEND_COOLDOWN = 4;
export const SERVICE_COST = 0.0001;

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
const lbl = (c: Career, q: number) => (q > 0 ? quarterLabel(c.fund, q) : 'Opening');
const m = (v: number) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`);
type R = { c: Career; ok: boolean; message: string };
const fail = (c: Career, message: string): R => ({ c, ok: false, message });

export const governanceOf = (c: Career): Governance => c.governance ?? { constitution: { ...DEFAULT_CONSTITUTION }, amendments: [], lastProposalQ: -99, partners: {}, votes: [], politicsQ: -99 };
export const rules = (c: Career) => governanceOf(c).constitution;
const holders = (c: Career) => c.ownership?.holders ?? [{ id: 'founder', name: 'You', pct: 1, paid: 0, joinedQ: 0 }];
export const isPartner = (id: string) => id.startsWith('partner-');
export function partnerState(c: Career, id: string): PartnerState { return governanceOf(c).partners[id] ?? { morale: 60, loyalty: 60, lastMetQ: -99 }; }
const employeeOf = (c: Career, holderId: string) => { const h = holders(c).find(x => x.id === holderId) as { employeeId?: string } | undefined; return h?.employeeId ? c.roster.find(e => e.id === h.employeeId) : undefined; };

// ---------- Constitution effects ----------

/** Trim buys so no single stock (index excluded) exceeds the constitution's share of the fund. Sells pass. */
export function constitutionOrders(c: Career, orders: Order[]): { orders: Order[]; issues: string[] } {
  const cap = rules(c).maxPosition; const na = netAssets(c.fund.ledger); const issues: string[] = [];
  if (!(na > 0)) return { orders, issues };
  const add: Record<string, number> = {};
  const out = orders.map(o => {
    if (o.sellAll || o.amount <= 0 || o.ticker === SPX) return o;
    const held = (c.fund.ledger.positions[o.ticker] ?? 0) + (add[o.ticker] ?? 0); const room = Math.max(0, cap * na - held);
    if (o.amount <= room + 1) { add[o.ticker] = (add[o.ticker] ?? 0) + o.amount; return o; }
    issues.push(`${assetName(o.ticker)} buy trimmed to ${m(room)}: your constitution caps one stock at ${(cap * 100).toFixed(0)}% of the fund.`);
    add[o.ticker] = (add[o.ticker] ?? 0) + room; return { ...o, amount: room };
  }).filter(o => o.sellAll || Math.abs(o.amount) >= 0.5);
  return { orders: out, issues };
}
export const payoutCap = (c: Career, distributable: number) => Math.max(0, distributable * rules(c).payoutShare);
export const serviceCostQ = (c: Career) => (rules(c).service === 'premium' ? netAssets(c.fund.ledger) * SERVICE_COST : 0);

// ---------- Votes ----------

type Topic = { kind: 'amend'; rule: RuleKey; to: number | string } | { kind: 'acquisition' | 'sale' | 'ipo' | 'succession'; successorAbility?: number };

/** Each holder's vote with a reason. Founder backs its own proposals; public shareholders follow management unless reserves are cut. */
export function castVotes(c: Career, t: Topic): Vote[] {
  const rep = reputation(c).score; const runway = quarterlyExpenses(c) > 0 ? firmCash(c) / quarterlyExpenses(c) : 99;
  return holders(c).filter(h => h.pct > 0).map(h => {
    if (h.id === 'founder') return { holderId: h.id, name: 'You', weight: h.pct, yes: true, reason: 'Your proposal' };
    if (h.id === 'public') { const yes = !(t.kind === 'amend' && t.rule === 'reserveQuarters' && Number(t.to) < RESERVE_QUARTERS); return { holderId: h.id, name: h.name, weight: h.pct, yes, reason: yes ? 'Follows management' : 'Will not back thinner reserves' }; }
    const ps = partnerState(c, h.id); const emp = employeeOf(c, h.id); const loyal = ps.loyalty >= 70; const hostile = ps.loyalty < 30;
    let yes: boolean; let reason: string;
    if (t.kind === 'amend') {
      switch (t.rule) {
        case 'payoutShare': yes = Number(t.to) >= rules(c).payoutShare || runway < 4; reason = yes ? 'Owners like being paid' : 'Wants owner payouts'; break;
        case 'reserveQuarters': yes = Number(t.to) >= rules(c).reserveQuarters ? true : emp ? false : runway >= 6; reason = yes ? 'Comfortable with the cash level' : emp ? 'Worried about job security' : 'Runway too thin to cut reserves'; break;
        case 'service': yes = t.to === 'premium' ? (emp ? ps.morale >= 50 : rep < 55) : !emp; reason = yes ? (t.to === 'premium' ? 'Clients deserve it' : 'Saves money') : (t.to === 'premium' ? 'Too expensive for now' : 'Clients will notice'); break;
        case 'maxPosition': yes = Number(t.to) <= rules(c).maxPosition || rep >= 55; reason = yes ? 'Acceptable risk' : 'Concentration risk at our reputation'; break;
        default: yes = Number(t.to) <= rules(c).majority; reason = yes ? 'Fine' : 'Gives partners less say';
      }
    } else if (t.kind === 'succession') { yes = (t.successorAbility ?? 0) >= 70 || (emp ? ps.morale >= 60 : false); reason = yes ? 'Trusts the successor' : 'The successor is not ready'; }
    else if (t.kind === 'sale') { const gain = h.paid > 0 ? (c.ownership ? 1 : 1) : 1; yes = rep >= 45 || gain > 0 && ps.morale < 50; reason = yes ? 'A good time to sell' : 'Expects more value later'; }
    else if (t.kind === 'ipo') { yes = rep >= 55; reason = yes ? 'Public markets will reward us' : 'Reputation too low to list'; }
    else { yes = runway >= 4 && rep >= 45; reason = yes ? 'Growth makes sense' : 'Too risky at our cash level'; }
    if (loyal && !yes) { yes = true; reason += ', but backs you out of loyalty'; }
    if (hostile && yes) { yes = false; reason = 'Votes against you after earlier disputes'; }
    return { holderId: h.id, name: h.name, weight: h.pct, yes, reason };
  });
}

export function tally(c: Career, t: Topic) {
  const votes = castVotes(c, t); const total = votes.reduce((a, v) => a + v.weight, 0) || 1;
  const yes = votes.filter(v => v.yes).reduce((a, v) => a + v.weight, 0) / total; const needed = rules(c).majority;
  return { votes, yes, needed, passed: yes >= needed - 1e-9 };
}
/** Immediate weighted vote for big moves. Recorded by the caller that acts on it. */
export const approval = (c: Career, kind: 'acquisition' | 'sale' | 'ipo' | 'succession', successorAbility?: number) => tally(c, { kind, successorAbility });
export function recordVote(n: Career, topic: string, v: ReturnType<typeof tally>) {
  const g = governanceOf(n); g.votes.push({ q: n.fund.q, topic, yes: v.yes, needed: v.needed, passed: v.passed, votes: v.votes }); n.governance = g;
}

// ---------- Amendments ----------

export function proposeAmendment(c: Career, rule: RuleKey, to: number | string): R {
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  const def = RULES.find(r => r.key === rule); if (!def) return fail(c, 'Unknown rule.');
  if (!def.options.some(o => o.value === to)) return fail(c, 'Choose one of the listed settings.');
  const g = governanceOf(c);
  if (g.constitution[rule] === to) return fail(c, 'That is already the rule.');
  if (g.amendments.some(a => a.status === 'pending')) return fail(c, 'One amendment at a time; the current one is voted at the next close.');
  if (c.fund.q - g.lastProposalQ < AMEND_COOLDOWN) return fail(c, `You can propose again in ${AMEND_COOLDOWN - (c.fund.q - g.lastProposalQ)} quarter(s).`);
  const n: Career = structuredClone(c); const ng = governanceOf(n);
  ng.amendments.push({ id: `amend-${n.fund.q}-${rule}`, q: n.fund.q, rule, from: ng.constitution[rule], to, voteQ: n.fund.q + 1, status: 'pending' });
  ng.lastProposalQ = n.fund.q; n.governance = ng;
  return { c: n, ok: true, message: `Proposed. Owners vote at the ${lbl(n, n.fund.q + 1)} close.` };
}

// ---------- Partners ----------

/** Founder buys a partner's whole stake with personal cash at the estimated value (a secondary: equity moves, the firm gets nothing). */
export function buyoutPartner(c: Career, holderId: string, valueOfFirm: number): R {
  if (c.publicFirm) return fail(c, 'Public share accounting uses the public share desk; private partner buyouts are unavailable.');
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  const h = holders(c).find(x => x.id === holderId && isPartner(x.id)); if (!h) return fail(c, 'Choose a partner.');
  if (!(valueOfFirm > 0) || !Number.isFinite(valueOfFirm)) return fail(c, 'The firm has no estimated value to price a buyout.');
  const price = Math.round(valueOfFirm * h.pct / 1000) * 1000;
  if (founderCash(c) < price) return fail(c, `Buying ${(h.pct * 100).toFixed(1)}% costs ${m(price)} of personal cash.`);
  const n: Career = structuredClone(c); const o = n.ownership!; const x = o.holders.find(y => y.id === holderId)!; const f = o.holders.find(y => y.id === 'founder')!;
  post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'founder', recipient: 'external', category: 'equity_secondary', amount: price, source: `buyout:${holderId}:${n.fund.q}`, memo: `Bought ${x.name}'s ${(x.pct * 100).toFixed(1)}% of the firm` });
  f.pct += x.pct; o.holders = o.holders.filter(y => y.id !== holderId);
  const g = governanceOf(n); delete g.partners[holderId]; n.governance = g;
  n.notices.push({ q: n.fund.q, from: x.name, subject: 'Stake sold to you', body: `You paid ${m(price)} from personal cash.`, tone: 'neutral' });
  return { c: n, ok: true, message: `You now own ${(f.pct * 100).toFixed(1)}%.` };
}

/** Firm buys back and cancels a partner's stake from cash above the reserve. Remaining holders' shares rise pro rata. */
export function firmBuyback(c: Career, holderId: string, valueOfFirm: number, distributable: number): R {
  if (c.publicFirm || publicRestricted(c)) return fail(c, 'Use the public buyback desk; corporate debt blocks owner payouts.');
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  const h = holders(c).find(x => x.id === holderId && isPartner(x.id)); if (!h) return fail(c, 'Choose a partner.');
  const price = Math.round(valueOfFirm * h.pct / 1000) * 1000;
  if (!(price > 0) || price > distributable) return fail(c, `A buyback costs ${m(price)}; the firm can spend ${m(distributable)} above its reserve.`);
  const n: Career = structuredClone(c); const o = n.ownership!;
  post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'firm', recipient: 'external', category: 'equity_buyback', amount: price, source: `buyback:${holderId}:${n.fund.q}`, memo: `Firm bought back ${h.name}'s ${(h.pct * 100).toFixed(1)}%` });
  o.holders = o.holders.filter(y => y.id !== holderId); const rest = o.holders.reduce((a, y) => a + y.pct, 0);
  for (const y of o.holders) y.pct /= rest;
  const g = governanceOf(n); delete g.partners[holderId]; n.governance = g;
  return { c: n, ok: true, message: `Bought back and cancelled. You now own ${((o.holders.find(y => y.id === 'founder')?.pct ?? 0) * 100).toFixed(1)}%.` };
}

/** Meet a partner: one founder time point, every two quarters. Resolves their open dispute. */
export function meetPartner(c: Career, holderId: string): R {
  if (c.status !== 'running') return fail(c, 'This career has ended.');
  if (!holders(c).some(x => x.id === holderId && isPartner(x.id))) return fail(c, 'Choose a partner.');
  const ps0 = partnerState(c, holderId); if (c.fund.q - ps0.lastMetQ < 2) return fail(c, `You can meet again in ${2 - (c.fund.q - ps0.lastMetQ)} quarter(s).`);
  if (timeLeft(c) < 1) return fail(c, 'No time left this quarter.');
  const n: Career = structuredClone(c); spendTime(n, 1); const g = governanceOf(n);
  const ps = { ...partnerState(n, holderId) }; ps.morale = clamp(ps.morale + 10); ps.loyalty = clamp(ps.loyalty + 6); ps.lastMetQ = n.fund.q; const had = ps.grievance; ps.grievance = undefined;
  g.partners[holderId] = ps; n.governance = g;
  const dec = n.decisions.find(d => !d.resolved && d.kind === 'governance' && d.payload?.holderId === holderId);
  if (dec) dec.resolved = 'met';
  const name = holders(n).find(x => x.id === holderId)!.name;
  return { c: n, ok: true, message: had ? `You sat down with ${name} and settled it: ${had}. Morale +10, loyalty +6.` : `Good talk with ${name}. Morale +10, loyalty +6.` };
}

const opt = (id: string, label: string, hint: string): DecisionOption => ({ id, label, hint });

/** Close hook: vote pending amendments, pay premium service, partner morale and politics events. Never blocks the close. */
export function governanceAtClose(n: Career, q: number, closeId: string) {
  const g = governanceOf(n); n.governance = g;
  for (const a of g.amendments.filter(x => x.status === 'pending' && x.voteQ <= q)) {
    const v = tally(n, { kind: 'amend', rule: a.rule, to: a.to }); a.votes = v.votes; a.yes = v.yes; a.status = v.passed ? 'passed' : 'failed';
    if (v.passed) (g.constitution as unknown as Record<string, number | string>)[a.rule] = a.to;
    for (const vt of v.votes) if (isPartner(vt.holderId)) { const ps = { ...partnerState(n, vt.holderId) }; ps.loyalty = clamp(ps.loyalty + (vt.yes === v.passed ? 2 : -5)); g.partners[vt.holderId] = ps; }
    g.votes.push({ q, topic: `${RULES.find(r => r.key === a.rule)!.label}: ${a.from} → ${a.to}`, yes: v.yes, needed: v.needed, passed: v.passed, votes: v.votes });
    n.notices.push({ q, from: 'Company secretary', subject: `Amendment ${v.passed ? 'passed' : 'failed'}`, body: `${RULES.find(r => r.key === a.rule)!.label}: ${(v.yes * 100).toFixed(0)}% yes, ${(v.needed * 100).toFixed(0)}% needed.`, tone: v.passed ? 'good' : 'bad' });
  }
  const svc = serviceCostQ(n);
  if (svc > 0) payOrOwe(n, { q, kind: 'event', category: 'client_service', amount: svc, memo: 'Premium client service', source: `close:Q${q}:service`, closeId });
  const partners = holders(n).filter(h => isPartner(h.id));
  const lastYear = n.fund.history.slice(-4); const beat = lastYear.length === 4 && lastYear.reduce((a, h) => a * (1 + h.ret), 1) > lastYear.reduce((a, h) => a * (1 + h.bench), 1);
  const paidOut = n.journal.txns.filter(t => t.category === 'partner_distribution' && t.q >= q - 4).length > 0;
  const best = Math.max(0, ...n.roster.map(e => e.salaryQ));
  for (const h of partners) {
    const ps = { ...partnerState(n, h.id) }; const emp = employeeOf(n, h.id);
    ps.morale = clamp(ps.morale + (beat ? 2 : -1) + (paidOut ? 1 : -1) + (emp && n.founderSalaryQ > best * 2.5 ? -3 : 0));
    if (emp) ps.morale = clamp((ps.morale + emp.morale) / 2);
    g.partners[h.id] = ps;
  }
  if (n.status !== 'running' || q - g.politicsQ < 3 || !partners.length) return;
  const r = mulberry32(n.fund.seed * 887 + q * 19);
  const unhappy = partners.map(h => ({ h, ps: g.partners[h.id] })).sort((a, b) => a.ps.morale - b.ps.morale)[0];
  if (unhappy.ps.morale < 45 && !n.decisions.some(d => !d.resolved && d.kind === 'governance')) {
    const emp = employeeOf(n, unhappy.h.id);
    const why = emp && n.founderSalaryQ > best * 2.5 ? 'your salary is far above theirs' : beat ? 'they want a bigger say' : 'results and payouts have disappointed them';
    const bonus = Math.round(Math.max(emp?.salaryQ ?? 0, quarterlyExpenses(n) * 0.05) / 1000) * 1000;
    g.partners[unhappy.h.id] = { ...unhappy.ps, grievance: why }; g.politicsQ = q;
    n.decisions.push({ id: `gov-${q}-${unhappy.h.id}`, q, kind: 'governance', amount: bonus, from: unhappy.h.name, title: `${unhappy.h.name} is unhappy: ${why}`,
      text: `They own ${(unhappy.h.pct * 100).toFixed(1)}% and vote with it. Meet them (one time point, in Partners) to settle it at no cost, or choose below. If left alone their loyalty falls, and a hostile partner may sell to an outside investor.`,
      options: [opt('bonus', `Pay a ${m(bonus)} retention bonus`, 'Firm cash; morale +15, loyalty +5'), opt('ignore', 'Do nothing', 'Loyalty -15; may sell to an outsider')], defaultOption: 'ignore', payload: { holderId: unhappy.h.id, bonus } });
  } else if (r() < 0.25) {
    const h = partners[Math.floor(r() * partners.length)]; g.politicsQ = q;
    n.notices.push({ q, from: h.name, subject: 'Partners\' dinner', body: beat ? 'A good year. The partners toasted the results.' : 'A tense dinner: the partners want better results next year.', tone: beat ? 'good' : 'neutral' });
  }
  void lifeOf;
}

export function applyGovernance(n: Career, d: PendingDecision, choice: string): boolean {
  const id = String(d.payload?.holderId ?? ''); const g = governanceOf(n); const ps = { ...partnerState(n, id) };
  if (choice === 'bonus') {
    payOrOwe(n, { q: n.fund.q, kind: 'event', category: 'bonus', amount: Number(d.payload?.bonus ?? 0), memo: `Retention bonus for ${d.from}`, source: `decision:${d.id}` });
    ps.morale = clamp(ps.morale + 15); ps.loyalty = clamp(ps.loyalty + 5); ps.grievance = undefined;
  } else if (choice === 'ignore') {
    ps.loyalty = clamp(ps.loyalty - 15);
    if (ps.loyalty < 30 && n.ownership) {
      // Secondary transfer: the partner sells to an outside investor, who pays them. The firm and cap-table total are unchanged.
      const h = n.ownership.holders.find(x => x.id === id);
      if (h) { h.id = `outside-${id}`; h.name = 'Outside investor'; delete g.partners[id]; n.notices.push({ q: n.fund.q, from: 'Company secretary', subject: `${d.from} sold out`, body: `${d.from} sold their ${(h.pct * 100).toFixed(1)}% to an outside investor. No money moved through the firm.`, tone: 'bad' }); n.governance = g; return true; }
    }
  }
  g.partners[id] = ps; n.governance = g;
  return true;
}
