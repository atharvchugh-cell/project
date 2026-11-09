// Phase 2: people, clients, the idea pipeline, board motions and inbox events.
// Everything is deterministic per career seed and quarter, uses only completed
// market history, and moves money only through the journal or fund accounting.
import { analyze, convictionOf } from './analysis';
import { grossAssets, nav, netAssets, redeemUnits, subscribe } from '@/lib/fund/accounting';
import { SPX, assetName, currentYear, marketFor, quarterLabel } from '@/lib/fund/engine';
import { listedCompanies } from '@/lib/fund/market';
import { ensureProfiles, roomFor, settlementOf, termsPayload } from './clients';
import { recordFlow } from './phase4';
import { applyGovernance } from './governance';
import { companyTrackRecord } from '@/lib/fund/exploration';
import { type Career, type DecisionOption, type Idea, type PendingDecision, firmCash, scaleOf } from './career';
import { payOrOwe } from './payables';
import { applyNewClient, employeeRevenue, warnedCushion } from './relations';
import { type Employee, candidatesFor, growth, hasRole, withAbility } from './roster';
import { applyPhase5 } from './phase5';
import { delegateIdea, researchRate } from './staff';

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const m = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`);
const note = (c: Career, from: string, subject: string, body: string, tone: 'good' | 'bad' | 'neutral' = 'neutral') => c.notices.push({ q: c.fund.q, from, subject, body, tone });
const open = (c: Career, kind: PendingDecision['kind'], key: string) => c.decisions.some(d => !d.resolved && d.kind === kind && d.payload?.key === key);
const addDecision = (c: Career, d: Omit<PendingDecision, 'q'>) => { c.decisions.push({ ...d, q: c.fund.q }); };
const opt = (id: string, label: string, hint: string): DecisionOption => ({ id, label, hint });

// ---------- People ----------

export const candidates = (c: Career) => (c.status === 'running' ? candidatesFor(c.fund.seed, c.fund.q, c.scenario, c.hiredCandidates) : []);

export function hire(c: Career, candId: string): Career {
  const cand = candidates(c).find(x => x.id === candId);
  if (!cand || c.roster.length >= c.capacity) return c;
  const n: Career = structuredClone(c);
  n.roster.push({ ...cand, id: `emp-${n.fund.seed % 997}-${cand.id}`, joinedQ: n.fund.q });
  n.hiredCandidates.push(candId);
  note(n, (n.roster[0]?.name ?? 'Chief operating officer'), `${cand.name} has joined`, `${cand.name} starts as ${cand.role} at ${m(cand.salaryQ)} a quarter.`, 'good');
  return n;
}

export function fire(c: Career, id: string): Career {
  const e = c.roster.find(x => x.id === id);
  if (!e || c.roster.length <= 1) return c;
  const n: Career = structuredClone(c);
  // Severance is one quarter's pay. Whatever firm cash cannot cover now stays owed and is paid first at the next close.
  const r = payOrOwe(n, { q: n.fund.q, kind: 'severance', category: 'severance', amount: e.salaryQ, memo: `Severance for ${e.name}`, source: `fire:${id}` });
  n.roster = n.roster.filter(x => x.id !== id).map(x => ({ ...x, morale: clamp(x.morale - 4) }));
  note(n, (n.roster[0]?.name ?? 'Chief operating officer'), `${e.name} has left`, r.owed > 0 ? `Severance is one quarter's pay (${m(e.salaryQ)}). The firm paid ${m(r.paid)} now; ${m(r.owed)} is still owed and is paid before other bills at the next close. The rest of the team noticed.` : `Severance of one quarter's pay (${m(e.salaryQ)}) was paid. The rest of the team noticed.`, 'bad');
  return n;
}

export function giveRaise(c: Career, id: string): Career {
  return { ...c, roster: c.roster.map(e => (e.id === id ? { ...e, salaryQ: Math.round(e.salaryQ * 1.1 / 1000) * 1000, morale: clamp(e.morale + 10) } : e)) };
}

export function promote(c: Career, id: string): Career {
  return { ...c, roster: c.roster.map(e => (e.id === id && e.level < 3 ? { ...e, level: e.level + 1, salaryQ: Math.round(e.salaryQ * 1.25 / 1000) * 1000, morale: clamp(e.morale + 15), ability: withAbility(e, e.ability + 3) } : e)) };
}

export function assign(c: Career, id: string, sector: string | null): Career {
  return { ...c, roster: c.roster.map(e => (e.id === id ? { ...e, assignment: sector, progress: e.assignment === sector ? e.progress : 0 } : e)) };
}

export const sectorsNow = (c: Career) => [...new Set(listedCompanies(currentYear(c.fund)).map(x => x.sector))].sort();

function pitch(c: Career, e: Employee, rand: () => number): Idea | null {
  const pick = analyze(c, e, rand); if (!pick) return null;
  const a = pick.analysis; const conviction = convictionOf(a);
  const angle = a.evidenceQ === 0 ? 'New to the fund\'s record, so there is no completed history to lean on; low certainty.'
    : `${a.evidenceQ} completed quarter(s) show ${a.pastScore >= 0 ? 'an' : 'a negative'} excess return of ${(a.pastScore * 100).toFixed(2)}% a quarter after shrinkage; my estimate is ${(a.estimate * 100).toFixed(2)}% ± ${(a.uncertainty * 100).toFixed(2)}%.`;
  return { id: `idea-${c.fund.q}-${e.id}`, q: c.fund.q, analystId: e.id, analyst: e.name, ticker: pick.ticker, sector: pick.sector, thesis: `${pick.name}: screened ${a.considered} of ${a.universe} names. ${angle}`, conviction, status: 'pending', analysis: a };
}

// ---------- Idea pipeline ----------

export function approveIdea(c: Career, id: string, share: number): Career {
  const idea = c.ideas.find(i => i.id === id && i.status === 'pending');
  if (!idea || !(share > 0)) return c;
  const n: Career = structuredClone(c);
  const x = n.ideas.find(i => i.id === id)!;
  const amount = netAssets(n.fund.ledger) * share;
  x.status = 'approved'; x.size = share; x.decidedQ = n.fund.q;
  n.pendingOrders = [...n.pendingOrders.filter(o => o.ideaId !== id), { ticker: x.ticker, amount, ideaId: id }];
  n.roster = n.roster.map(e => (e.id === x.analystId ? { ...e, morale: clamp(e.morale + 6) } : e));
  return n;
}

export function rejectIdea(c: Career, id: string): Career {
  const n: Career = structuredClone(c);
  const x = n.ideas.find(i => i.id === id && i.status === 'pending'); if (!x) return c;
  x.status = 'rejected'; x.decidedQ = n.fund.q;
  n.roster = n.roster.map(e => (e.id === x.analystId ? { ...e, morale: clamp(e.morale - 3) } : e));
  return n;
}

export function cancelOrder(c: Career, ideaId: string): Career {
  const n: Career = structuredClone(c);
  n.pendingOrders = n.pendingOrders.filter(o => o.ideaId !== ideaId);
  const x = n.ideas.find(i => i.id === ideaId); if (x && x.status === 'approved' && x.decidedQ === n.fund.q) { x.status = 'pending'; x.size = undefined; }
  return n;
}

/** Growth of a ticker and the S&P 500 over completed quarters (from, to]. */
function realized(c: Career, ticker: string, from: number, to: number) {
  const mk = marketFor(c.fund).slice(from, to);
  const g = (t: string) => mk.reduce((a, q) => a * (1 + (q.returns[t] ?? 0)), 1) - 1;
  return { ret: g(ticker), bench: g(SPX) };
}

// ---------- Clients ----------

export function meetClient(c: Career, invId: string): Career {
  const inv = c.fund.investors.find(i => i.id === invId);
  const last = c.meetings[invId];
  if (!inv || invId === 'you' || (last !== undefined && c.fund.q - last < 4)) return c;
  const n: Career = structuredClone(c);
  const ir = hasRole(n.roster, /investor relations/i);
  const gain = 5 + (ir ? Math.round(ir.ability / 12) : 0);
  n.satisfaction[invId] = clamp((n.satisfaction[invId] ?? 60) + gain);
  n.meetings[invId] = n.fund.q;
  note(n, inv.name, 'Thanks for the call', ir ? `${ir.name} walked us through the portfolio. That helped.` : 'Good to hear from you directly.', 'good');
  return n;
}

export const canMeet = (c: Career, invId: string) => { const last = c.meetings[invId]; return invId !== 'you' && (last === undefined || c.fund.q - last >= 4); };

// ---------- Decisions ----------

export function applyDecision(n: Career, d: PendingDecision, choice: string): boolean {
  const k = scaleOf(n); const p = d.payload ?? {};
  const emp = (id: unknown) => n.roster.find(e => e.id === id);
  switch (d.kind) {
    case 'poach': {
      const e = emp(p.employeeId); if (!e) return true;
      if (choice === 'counter') { e.salaryQ = Math.round(e.salaryQ * 1.2 / 1000) * 1000; e.morale = clamp(e.morale + 25); note(n, e.name, 'I am staying', 'Thank you for the counter-offer.', 'good'); }
      else { n.roster = n.roster.filter(x => x.id !== e.id); note(n, n.roster[0]?.name ?? 'Office', `${e.name} resigned`, `${e.name} accepted the offer from ${p.rival}.`, 'bad'); }
      return true;
    }
    case 'allocation_review': {
      const inv = n.fund.investors.find(i => i.id === p.investorId); if (!inv) return true;
      if (choice === 'meet' && canMeet(n, inv.id)) {
        const before = n.satisfaction[inv.id] ?? 0;
        Object.assign(n, meetClient(n, inv.id));
        if ((n.satisfaction[inv.id] ?? 0) < 30) { n.satisfaction[inv.id] = Math.max(before, 30); }
        note(n, inv.name, 'We will stay for now', 'Your call answered our questions. We will keep our allocation and keep watching.', 'good');
      } else {
        const units = inv.units * 0.3;
        if (units > 0) { inv.units -= units; redeemUnits(n.fund.ledger, units, n.fund.q + 1, `${inv.name} — allocation cut`, inv.id); }
        note(n, inv.name, 'Reducing our allocation', `We are redeeming 30% of our position, payable next quarter.`, 'bad');
      }
      return true;
    }
    case 'top_up': {
      const inv = n.fund.investors.find(i => i.id === p.investorId); if (!inv) return true;
      if (choice !== 'accept' || n.status !== 'running' || n.fund.status === 'ended') return true;
      const st = settlementOf(n, d, inv.id); if (!(st.wire + st.commit > 0.5)) return true;
      if (st.wire > 0.5) { const u = subscribe(n.fund.ledger, st.wire); inv.units += u; recordFlow(n, { investorId: inv.id, name: inv.name, amount: st.wire, kind: 'top_up' }); }
      if (st.commit > 0.5) n.commitments.push({ id: `cm-${d.id}`, investorId: inv.id, name: inv.name, committed: st.commit, called: 0, reliability: 0.93 });
      ensureProfiles(n);
      n.clients![inv.id].history.push({ q: n.fund.q, kind: 'offer', text: `Accepted: ${m(st.wire)} wired at NAV, ${m(st.commit)} committed${st.scaled ? ' (scaled to their remaining capacity)' : ''}`, amount: st.wire + st.commit });
      n.satisfaction[inv.id] = clamp((n.satisfaction[inv.id] ?? 60) + 3);
      note(n, inv.name, 'Wire sent', `${m(st.wire)} added at today's fund price${st.commit > 0.5 ? ` and ${m(st.commit)} committed for capital calls` : ''}. This grows the fund, not the return.`, 'good');
      return true;
    }
    case 'board_motion': return resolveMotion(n, choice);
    case 'new_client': return applyNewClient(n, d, choice);
    case 'activist': case 'crisis': return applyPhase5(n, d, choice);
    case 'governance': return applyGovernance(n, d, choice);
    case 'event': {
      const cost = Number(p[`cost_${choice}`] ?? 0);
      if (cost > 0) payOrOwe(n, { q: n.fund.q, kind: 'event', category: choice === 'pay' ? 'bonus' : 'event_cost', amount: cost, source: `decision:${d.id}`, memo: String(p[`memo_${choice}`] ?? d.title ?? 'Event cost') });
      const sat = Number(p[`sat_${choice}`] ?? 0);
      if (sat) for (const id of Object.keys(n.satisfaction)) n.satisfaction[id] = clamp(n.satisfaction[id] + sat);
      const mor = Number(p[`morale_${choice}`] ?? 0); const who = p[`who_${choice}`];
      if (mor) n.roster = n.roster.map(e => (!who || e.id === who ? { ...e, morale: clamp(e.morale + mor) } : e));
      const office = Number(p[`office_${choice}`] ?? 0);
      if (office) { n.officeQ = Math.round(n.officeQ * (1 + office)); n.capacity += 4; }
      void k;
      return true;
    }
    default: return false;
  }
}

// ---------- Board ----------

const MOTIONS: Record<string, string> = { bonus: 'Fund a staff bonus pool', cut: 'Cut office costs by 15%', salary: 'Raise the founder salary by 20%', none: 'No motion this year' };

function resolveMotion(n: Career, motion: string): boolean {
  if (motion === 'none') { n.board.push({ q: n.fund.q, motion: MOTIONS.none, votes: [], passed: false }); return true; }
  const review = n.fund.boardReviews?.at(-1);
  const hit = !!review?.returnMet; const profit = (review?.netReturn ?? 0) > 0;
  const yr = n.fund.history.slice(-4); const beat = yr.reduce((a, h) => a * (1 + h.ret), 1) > yr.reduce((a, h) => a * (1 + h.bench), 1);
  const runway = firmCash(n) / Math.max(1, n.officeQ + n.roster.reduce((a, e) => a + e.salaryQ, 0));
  const votes = [
    { name: 'Evelyn Hart', yes: motion === 'cut' ? !hit : hit || (motion === 'bonus' && profit), reason: hit ? 'You hit the return target.' : 'The return target was missed.' },
    { name: 'Marcus Lee', yes: motion === 'cut' ? !beat : beat, reason: beat ? 'You beat the S&P 500 this year.' : 'You trailed the S&P 500.' },
    { name: 'Anika Rao', yes: motion === 'cut' ? true : runway >= 4, reason: `The firm has ${runway.toFixed(1)} quarters of cash.` },
  ];
  const passed = votes.filter(v => v.yes).length >= 2;
  n.board.push({ q: n.fund.q, motion: MOTIONS[motion], votes, passed });
  if (passed) {
    if (motion === 'bonus') {
      const pool = n.roster.reduce((a, e) => a + e.salaryQ, 0) * 0.5;
      payOrOwe(n, { q: n.fund.q, kind: 'event', category: 'bonus', amount: pool, source: `board:${n.fund.q}`, memo: 'Staff bonus pool approved by the board' });
      n.roster = n.roster.map(e => ({ ...e, morale: clamp(e.morale + 12) }));
    } else if (motion === 'cut') { n.officeQ = Math.round(n.officeQ * 0.85); n.roster = n.roster.map(e => ({ ...e, morale: clamp(e.morale - 6) })); }
    else if (motion === 'salary') n.founderSalaryQ = Math.round(n.founderSalaryQ * 1.2 / 1000) * 1000;
  }
  note(n, 'Board of directors', `Motion ${passed ? 'passed' : 'failed'}: ${MOTIONS[motion]}`, votes.map(v => `${v.name} ${v.yes ? 'yes' : 'no'} (${v.reason})`).join(' '), passed ? 'good' : 'bad');
  return true;
}

// ---------- Quarter-close hooks ----------

const RIVALS = ['Northgate Partners', 'Silverline Capital', 'Kestrel Asset Management', 'Meridian Peak'];

/** Runs after the fund quarter and firm payments. `rand` is seeded by career and quarter. */
export function phase2AtClose(n: Career, rand: () => number, shortPaid: boolean) {
  const f = n.fund; const q = f.q; const k = scaleOf(n);
  const last = f.history.at(-1); const ret = last?.ret ?? 0; const bench = last?.bench ?? 0;
  const gross = Math.max(1, grossAssets(f.ledger));
  const maxW = Math.max(0, ...Object.entries(f.ledger.positions).filter(([t]) => t !== SPX).map(([, v]) => v / gross));
  const late = !!last?.latePayment;

  // People: morale drift, research, poaching, quitting.
  // Pay fairness: people earning far more for the firm than they are paid lose morale; overpaid people are content but not more skilled.
  const rev = employeeRevenue(n);
  n.roster = n.roster.map(e => { const mult = rev.find(r => r.id === e.id)?.multiple ?? 1; const fair = mult > 2.5 ? -2 : mult < 0.8 ? 1 : 0;
    return { ...e, morale: clamp(e.morale + (shortPaid ? -10 : 1) + (ret > 0 ? 1 : ret < -0.05 ? -2 : 0) + fair), ability: Math.min(e.potential ?? 100, Math.round((e.ability + growth(e, q)) * 10) / 10) }; });
  for (const e of n.roster) {
    if (!e.assignment) continue;
    e.progress += researchRate(n, e);
    if (e.progress >= 1) {
      e.progress = 0;
      const idea = pitch(n, e, rand);
      if (idea) {
        n.ideas.push(idea);
        const amt = n.status === 'running' ? delegateIdea(n, e, idea) : 0;
        note(n, e.name, `New idea: ${assetName(idea.ticker)}`, amt > 0 ? `${idea.thesis} Bought within my delegated sleeve at the next close: ${m(amt)} (visible in your plan before then).` : idea.thesis, 'neutral');
      }
    }
  }
  const quitter = n.roster.find(e => e.morale < 20 && n.roster.length > 1);
  if (quitter) { n.roster = n.roster.filter(e => e.id !== quitter.id); note(n, quitter.name, 'Resignation', 'I have decided to leave the firm. Morale here has been too low for too long.', 'bad'); }
  const target = n.roster.filter(e => e.morale < 50 && !open(n, 'poach', e.id)).sort((a, b) => a.morale - b.morale)[0];
  if (target && rand() < 0.45) {
    const rival = RIVALS[Math.floor(rand() * RIVALS.length)];
    addDecision(n, { id: `poach-${q}-${target.id}`, kind: 'poach', amount: target.salaryQ * 0.2, from: (n.roster[0]?.name ?? 'Chief operating officer'), title: `${rival} approached ${target.name}`, text: `${target.name} (${target.role}) has an offer from ${rival}. A 20% raise would likely keep them.`, options: [opt('counter', 'Counter with a 20% raise', `+${m(target.salaryQ * 0.2)} a quarter`), opt('let_go', 'Let them go', 'They leave next quarter')], defaultOption: 'let_go', payload: { key: target.id, employeeId: target.id, rival } });
  }

  // Ideas: review approved and rejected ideas a year later with completed results.
  for (const idea of n.ideas) {
    if (idea.status === 'pending' && q - idea.q >= 2) { idea.status = 'rejected'; idea.decidedQ = q; }
    if (idea.status === 'pending' || idea.reviewedQ !== undefined || idea.decidedQ === undefined || q - idea.decidedQ < 4) continue;
    const r = realized(n, idea.ticker, idea.decidedQ, q);
    idea.result = r.ret; idea.bench = r.bench; idea.reviewedQ = q;
    const good = r.ret > r.bench;
    const a = n.roster.find(e => e.id === idea.analystId);
    if (a) { a.ability = withAbility(a, a.ability + (good ? 3 : -1)); a.morale = clamp(a.morale + (good ? 5 : -2)); }
    note(n, 'Investment committee', `One-year review: ${assetName(idea.ticker)} (${idea.status})`, `${assetName(idea.ticker)} returned ${(r.ret * 100).toFixed(1)}% against the S&P 500's ${(r.bench * 100).toFixed(1)}%. ${idea.status === 'approved' ? (good ? 'Good call.' : 'It lagged.') : good ? 'You passed on a winner.' : 'Passing was right.'}`, good === (idea.status === 'approved') ? 'good' : 'bad');
  }

  // Clients: satisfaction follows their mandate, risk, liquidity and promises.
  const paidIds = new Set(f.ledger.liabilities.filter(x => x.paid && x.dueQ === q && x.kind === 'redemption').map(x => x.investorId));
  const dd = last?.drawdown ?? 0;
  for (const inv of f.investors) {
    if (inv.id === 'you' || inv.units <= 0.01) continue;
    let s = n.satisfaction[inv.id] ?? 60;
    s += ret >= 0 ? 2 : -3 + warnedCushion(n, inv.id);
    if (n.philosophy === 'diversified') s += ret >= bench ? 1 : -1;
    if (n.philosophy === 'defensive' && dd > 0.1) s -= 3;
    if (n.philosophy !== 'concentrated' && maxW > 0.5) s -= 2;
    if (late) s -= 10;
    if (paidIds.has(inv.id)) s += 3;
    const met = n.meetings[inv.id];
    if (met === undefined ? q > 4 : q - met > 6) s -= 1;
    n.satisfaction[inv.id] = clamp(s);
    const locked = q < inv.lockupUntilQ;
    if (n.satisfaction[inv.id] < 30 && !locked && !open(n, 'allocation_review', inv.id)) {
      addDecision(n, { id: `review-${q}-${inv.id}`, kind: 'allocation_review', amount: inv.units * nav(f.ledger) * 0.3, from: inv.name, title: `${inv.name} is reviewing its allocation`, text: `Satisfaction is ${n.satisfaction[inv.id]}. Without a call they will redeem 30% (about ${m(inv.units * nav(f.ledger) * 0.3)}) when this quarter closes.`, options: [opt('meet', 'Call them', canMeet(n, inv.id) ? 'Your investor relations lead joins' : 'Already met this year; they will redeem'), opt('accept', 'Accept the cut', 'Pay 30% out next quarter')], defaultOption: 'accept', payload: { key: inv.id, investorId: inv.id } });
    } else if (n.satisfaction[inv.id] >= 80 && rand() < 0.25 && !open(n, 'top_up', inv.id)) {
      const amt = Math.floor(Math.min(inv.units * nav(f.ledger) * 0.1, roomFor(n, inv.id)) / 1e5) * 1e5;
      if (amt > 0) addDecision(n, { id: `topup-${q}-${inv.id}`, kind: 'top_up', amount: amt, from: inv.name, title: `${inv.name} wants to add ${m(amt)}`, text: 'They are happy with results and want to wire more at the current fund price. All cash, no commitment.', options: [opt('accept', `Accept ${m(amt)} wired now (all cash)`, 'More fees, more responsibility'), opt('decline', 'Decline politely', 'No change')], defaultOption: 'decline', payload: { key: inv.id, investorId: inv.id, ...termsPayload(amt, 0, q) } });
    }
  }

  // Annual board meeting.
  if (q % 4 === 0 && q < f.quarters) addDecision(n, { id: `board-${q}`, kind: 'board_motion', amount: 0, from: 'Board of directors', title: 'Annual board meeting: bring a motion', text: 'Each director votes on what they see in the results. Two votes pass a motion.', options: Object.entries(MOTIONS).map(([id, label]) => opt(id, label, id === 'bonus' ? 'Costs half a quarter of payroll; lifts morale' : id === 'cut' ? 'Lower rent; staff morale falls' : id === 'salary' ? 'More personal income' : 'Nothing changes')), defaultOption: 'none', payload: { key: String(q) } });

  // One random event most quarters.
  if (rand() < 0.55) {
    const pm = hasRole(n.roster, /Portfolio manager/); const risk = hasRole(n.roster, /Risk officer/);
    const kinds = ['conference', 'regulator', 'press', 'office', ...(pm && ret > 0 ? ['bonus'] : [])];
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const id = `event-${q}-${kind}`;
    const base = { id, kind: 'event' as const, amount: 0, from: (n.roster[0]?.name ?? 'Chief operating officer') };
    if (kind === 'conference') addDecision(n, { ...base, title: `Speaking slot at the ${n.hq} investor forum`, text: 'Clients and prospects will attend. Sponsorship and travel are on the firm.', options: [opt('attend', 'Attend and sponsor', `${m(250e3 * k)} from firm cash; clients +4`), opt('decline', 'Decline', 'No cost')], defaultOption: 'decline', payload: { key: kind, cost_attend: 250e3 * k, sat_attend: 4, memo_attend: 'Investor forum sponsorship' } });
    if (kind === 'regulator') addDecision(n, { ...base, title: 'Regulator data request', text: risk ? `${risk.name} can handle it in-house, but it will be a long quarter for them.` : 'You have no risk officer. Handling it yourself risks a penalty.', options: [opt('counsel', 'Hire outside counsel', `${m(400e3 * k)} from firm cash`), opt('inhouse', 'Handle in-house', risk ? `${risk.name} morale -12` : `Likely ${m(1.2e6 * k)} penalty`)], defaultOption: 'inhouse', payload: { key: kind, cost_counsel: 400e3 * k, memo_counsel: 'Outside counsel for regulator request', ...(risk ? { morale_inhouse: -12, who_inhouse: risk.id } : { cost_inhouse: 1.2e6 * k, memo_inhouse: 'Regulatory penalty' }) } });
    if (kind === 'press') addDecision(n, { ...base, title: 'A financial journalist wants an interview', text: `Coverage will reflect how the fund did last quarter (${(ret * 100).toFixed(1)}%).`, options: [opt('accept', 'Give the interview', ret >= 0 ? 'Clients +3' : 'Clients -3'), opt('decline', 'Decline', 'No change')], defaultOption: 'decline', payload: { key: kind, sat_accept: ret >= 0 ? 3 : -3 } });
    if (kind === 'office') addDecision(n, { ...base, title: 'Your landlord offers the floor above', text: 'More room for the team and a better address, at a higher rent.', options: [opt('accept', 'Take the bigger floor', 'Office cost +30%; room for 4 more staff; morale +6'), opt('decline', 'Stay put', 'No change')], defaultOption: 'decline', payload: { key: kind, office_accept: 0.3, morale_accept: 6 } });
    if (kind === 'bonus' && pm) addDecision(n, { ...base, title: `${pm.name} asks for a performance bonus`, text: 'The portfolio made money last quarter and they want it recognised.', options: [opt('pay', 'Pay one quarter of salary', `${m(pm.salaryQ)} from firm cash; morale +15`), opt('refuse', 'Refuse', 'Morale -12')], defaultOption: 'refuse', payload: { key: kind, cost_pay: pm.salaryQ, memo_pay: `Bonus for ${pm.name}`, morale_pay: 15, who_pay: pm.id, morale_refuse: -12, who_refuse: pm.id } });
  }
}
