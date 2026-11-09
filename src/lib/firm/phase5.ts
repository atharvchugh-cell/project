// Phase 5: activist investors, crises and the quarterly newspaper.
// Deterministic per career seed and quarter, uses only completed history, and moves money only through
// existing fund accounting (redeemUnits) or firm payables (payOrOwe). The newspaper reports figures taken
// from the same fund history and `standings` the rival table uses, so headlines never disagree with results.
import { publicEventsFor, eventsSentiment } from './publicEvents';
import { publicQuote } from './publicFirm';
import { nav, redeemUnits } from '@/lib/fund/accounting';
import { type Career, type DecisionOption, type PendingDecision, scaleOf } from './career';
import { payOrOwe } from './payables';
import { standings, yourRank } from './relations';
import { acceptsMoney } from './phase4';
import { eventFor } from '@/lib/fund/calendar';
import { RIVAL_FIRMS } from './relations';
import { newsQuarter, newsSector } from '@/lib/fund/news';
import { marketFor } from '@/lib/fund/engine';
import { rivalCoverageDelta } from './coverage';
import { fameEffects } from './immersion';

export interface PressStory { kind: 'lead' | 'rivals' | 'market' | 'activist' | 'crisis' | 'public' | 'corporate'; headline: string; body: string; tone: 'good' | 'bad' | 'neutral' }
export interface PressEdition { q: number; ret: number; bench: number; rank: number; firms: number; leader: string; stories: PressStory[]; stocks?: { ticker: string; sector: string; sentiment: number; impact: number; ret: number }[] }

const ACTIVISTS = ['Halcyon Activist Partners', 'Ironbridge Value Fund', 'Corvid Capital Advisors'];
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
const m = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`);
const opt = (id: string, label: string, hint: string): DecisionOption => ({ id, label, hint });
const note = (c: Career, from: string, subject: string, body: string, tone: 'good' | 'bad' | 'neutral' = 'neutral') => c.notices.push({ q: c.fund.q, from, subject, body, tone });
const isOpen = (c: Career, kind: PendingDecision['kind']) => c.decisions.some(d => !d.resolved && d.kind === kind);

/** Market crisis threshold: a completed S&P 500 quarter at or below this return. */
export const CRISIS_DROP = -0.08;
/** Activists campaign only after this many quarters and at most once every ACTIVIST_COOLDOWN quarters. */
export const ACTIVIST_FROM_Q = 4;
export const ACTIVIST_COOLDOWN = 6;

/** The largest outside investor still holding units. */
function largestOutside(c: Career) {
  return c.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01).sort((a, b) => b.units - a.units)[0];
}

/** Runs at the end of each close, after Phase 2-4 hooks and before the closing observation is recorded. */
export function phase5AtClose(n: Career, rand: () => number) {
  const f = n.fund; const q = f.q; const last = f.history.at(-1);
  if (!last || last.q !== q) return;
  if (n.press.some(x => x.q === q)) return;
  const k = scaleOf(n);
  const stories: PressStory[] = [];
  const running = acceptsMoney(n);

  // Market crisis: a real, completed S&P 500 quarter that fell hard.
  if (running && last.bench <= CRISIS_DROP && !isOpen(n, 'crisis')) {
    const cost = 150e3 * k;
    n.decisions.push({ id: `crisis-${q}-market`, q, kind: 'crisis', amount: cost, from: 'Head of client service', title: 'Market crisis: clients are calling', text: `The S&P 500 fell ${pct(last.bench)} last quarter and clients are nervous. Your fund returned ${pct(last.ret)}.`, options: [opt('calm', 'Call every client', `${m(cost)} from firm cash; satisfaction −2`), opt('quiet', 'Stay quiet', 'Satisfaction −8 for every client')], defaultOption: 'quiet', payload: { key: 'market', cost } });
    stories.push({ kind: 'crisis', headline: `Markets slide ${pct(last.bench)} in a rough quarter`, body: 'Money managers spent the quarter reassuring nervous clients.', tone: 'bad' });
  } else if (running && rand() < 0.06 && !isOpen(n, 'crisis')) {
    // Operational crisis. The fine roll is fixed now so the outcome of each choice is deterministic.
    const fix = 300e3 * k; const fine = 900e3 * k; const fined = rand() < 0.5;
    n.decisions.push({ id: `crisis-${q}-ops`, q, kind: 'crisis', amount: fix, from: 'Chief operating officer', title: 'Trading systems outage', text: 'Our order system went down for two days. Clients noticed and the regulator may ask questions.', options: [opt('fix', 'Pay for a full fix', `${m(fix)} from firm cash`), opt('patch', 'Patch it in-house', `Staff morale −8; risk of a ${m(fine)} fine`)], defaultOption: 'patch', payload: { key: 'ops', cost: fix, fine: fined ? fine : 0 } });
    stories.push({ kind: 'crisis', headline: `Outage hits ${n.firmName}`, body: 'A two-day trading systems failure left clients waiting on orders.', tone: 'bad' });
  }

  // Activist: lagging the field brings a campaign from the largest outside investor.
  const rank = yourRank(n); const table = standings(n); const firms = table.filter(s => !s.bench).length;
  const target = largestOutside(n);
  if (running && target && q >= ACTIVIST_FROM_Q && rank >= firms - 1 && q - n.activistQ >= ACTIVIST_COOLDOWN && !isOpen(n, 'activist') && rand() < 0.6) {
    const activist = ACTIVISTS[Math.floor(rand() * ACTIVISTS.length)];
    const stake = target.units * nav(f.ledger);
    const legal = 500e3 * k;
    const win = rand() < 0.25 + (n.satisfaction[target.id] ?? 50) / 200;
    n.activistQ = q;
    n.decisions.push({ id: `activist-${q}`, q, kind: 'activist', amount: stake * 0.25, from: activist, title: `${activist} is campaigning with ${target.name}`, text: `Your fund ranks ${rank} of ${firms} over the past year. ${target.name} (${m(stake)}) and ${activist} demand changes or part of the money back.`, options: [opt('return', 'Return 25% of their stake', `${m(stake * 0.25)} redeemed next quarter`), opt('cuts', 'Accept cost cuts', 'Office −10%, your salary −25%, staff morale −6'), opt('fight', 'Fight the campaign', `${m(legal)} legal fees; lose and they redeem 40%`)], defaultOption: 'cuts', payload: { key: target.id, investorId: target.id, activist, legal, win: win ? 1 : 0 } });
    stories.push({ kind: 'activist', headline: `${activist} targets ${n.firmName}`, body: `The activist wants changes after a year ranked ${rank} of ${firms}.`, tone: 'bad' });
  }

  // Newspaper: every figure comes from the closing history and the shared standings.
  const leader = table.find(s => !s.bench); if (!leader) return;
  const beat = last.ret >= last.bench;
  if (n.publicFirm && n.publicFirm.coverageQ !== q) {
    // Dedicated seed: coverage never changes the existing event/random draw stream.
    const luck = Math.sin(f.seed * 13 + q * 79);
    const edge = Math.max(-1, Math.min(1, last.ret - last.bench));
    const scandal = stories.some(s => s.kind === 'crisis' || s.kind === 'activist');
    const prevEps = n.publicFirm.history.at(-1)?.eps ?? 0; const eps = publicQuote(n).eps;
    const events = publicEventsFor(n, q, edge, prevEps > 0 ? eps / prevEps - 1 : 0);
    n.publicFirm.events = [...(n.publicFirm.events ?? []), ...events].slice(-40);
    for (const e of events) stories.push({ kind: 'corporate', headline: e.headline, body: `${e.body} Share sentiment ${e.sentiment >= 0 ? '+' : ''}${e.sentiment}.`, tone: e.sentiment > 0 ? 'good' : 'bad' });
    const delta = Math.max(-8, Math.min(8, Math.round(edge * 30 + (last.ret >= 0 ? 1 : -1) + luck * 2 - (scandal ? 3 : 0) + eventsSentiment(events))));
    n.publicFirm.sentiment = Math.max(-10, Math.min(10, Math.round(n.publicFirm.sentiment * 0.5 + delta)));
    n.publicFirm.coverageQ = q;
    n.publicFirm.coverageHeadline = events.find(e => e.kind !== 'earnings')?.headline ?? (delta >= 0 ? 'Analysts welcomed the completed fund results.' : 'Analysts questioned performance and operating risks.');
  }
  stories.unshift({ kind: 'lead', headline: rank === 1 ? `${n.fundName} leads the field` : beat ? `${n.fundName} beats the market` : `${n.fundName} trails the S&P 500`, body: `The fund returned ${pct(last.ret)} for the quarter against ${pct(last.bench)} for the S&P 500, and ranks ${rank} of ${firms} over the past year.`, tone: rank === 1 || beat ? 'good' : 'bad' });
  stories.splice(1, 0, { kind: 'rivals', headline: leader.you ? 'Rivals chase the leader' : `${leader.name} tops the rankings`, body: `${leader.name} returned ${pct(leader.trailing)} over the past year.`, tone: leader.you ? 'good' : 'neutral' });
  if (!stories.some(s => s.kind === 'crisis') && Math.abs(last.bench) >= 0.05) stories.push({ kind: 'market', headline: last.bench > 0 ? `Stocks rally ${pct(last.bench)}` : `Stocks fall ${pct(last.bench)}`, body: 'The S&P 500 had a big quarter.', tone: last.bench > 0 ? 'good' : 'bad' });
  if (running) {
    n.coverage ??= [];
    const year = f.startYear + Math.floor((q - 1) / 4); const quarter = (q - 1) % 4 + 1;
    const event = eventFor(year, quarter);
    const tape = newsQuarter(year, quarter);
    const enabled = f.newsFromYear !== undefined && year >= f.newsFromYear;
    for (const item of tape) stories.push({ kind: 'market', headline: item.headline, body: `Simulated sector coverage: sentiment ${item.sentiment >= 0 ? '+' : ''}${item.sentiment}.${enabled ? ' Buyers and sellers moved this quarter’s stock prices; the full-year historical return stayed unchanged.' : ' Sentiment price effects are not enabled for this saved career.'}`, tone: item.sentiment > 0 ? 'good' : item.sentiment < 0 ? 'bad' : 'neutral' });
    const newsMood = Math.round(tape.reduce((a, x) => a + x.sentiment, 0) / tape.length);
    if (newsMood) n.coverage.push({ q, expiresQ: q + 1, target: 'you', delta: newsMood, headline: 'Sector news affected client appetite' });
    const mood = Math.max(-8, Math.min(8, Math.round(last.bench * 50)));
    if (event || mood !== 0) {
      const headline = event ?? (last.bench >= 0 ? 'Risk appetite improved after the rally' : 'Clients grew cautious after the decline');
      n.coverage.push({ q, expiresQ: q + 1, target: 'you', delta: mood, headline });
      stories.push({ kind: 'market', headline, body: `Completed S&P 500 move ${pct(last.bench)}. Client mood ${mood >= 0 ? '+' : ''}${mood} through next quarter; the historical price move is already reflected in the portfolio.`, tone: mood < 0 ? 'bad' : 'good' });
    }
    const delta = beat ? 3 : -3;
    n.coverage.push({ q, expiresQ: q + 2, target: 'you', delta, headline: beat ? 'Positive coverage brought client attention' : 'Performance scrutiny weighed on client mood' });
    stories.push({ kind: 'lead', headline: beat ? 'Clients noticed the favourable coverage' : 'Clients questioned the performance gap', body: `Fictional firm coverage: mood ${delta > 0 ? '+' : ''}${delta} for two quarters, influencing later contributions and client pitches. Investor confidence remains tied to profit and payments.`, tone: beat ? 'good' : 'bad' });
    const rivals = RIVAL_FIRMS.filter(r => !n.acquiredRivals?.includes(r.id));
    const rival = rivals[Math.floor(rand() * rivals.length)];
    if (rival) {
      const favourable = rand() >= 0.5;
      const result = standings(n).find(x => x.id === rival.id)?.trailing ?? 0;
      const rd = rivalCoverageDelta(n, result, favourable);
      const pressured = rd !== (favourable ? 4 : -4);
      const headline = pressured ? `${rival.name} faced comparisons with ${n.firmName}` : favourable ? `${rival.name} earned favourable client-service coverage` : `${rival.name} faced questions about client service`;
      n.coverage.push({ q, expiresQ: q + 2, target: rival.id, delta: rd, headline });
      stories.push({ kind: 'rivals', headline, body: `${pressured ? `Your performance-backed fame (${fameEffects(n).fame}/100) put their weaker returns in the spotlight. ` : ''}Fictional coverage: rival mood ${rd > 0 ? '+' : ''}${rd} for two quarters. ${rd > 0 ? 'Their clients are harder to win and their pitches more persuasive.' : rd < 0 ? 'Their clients are easier to approach and their pitches less persuasive.' : 'Their coverage advantage was neutralised.'} Coverage is not investment return; money moves only through accepted offers and paid redemptions.`, tone: 'neutral' });
    }
    n.coverage = n.coverage.slice(-120);
  }
  const year = f.startYear + Math.floor((q - 1) / 4); const quarter = (q - 1) % 4 + 1;
  const mkt = marketFor(f)[q - 1];
  const stocks = newsQuarter(year, quarter).flatMap(item => Object.entries(mkt?.returns ?? {}).filter(([ticker]) => ticker !== 'SPX').filter(([ticker]) => newsSector(ticker) === item.sector).map(([ticker, ret]) => ({ ticker, sector: item.sector, sentiment: item.sentiment, impact: f.newsFromYear !== undefined && year >= f.newsFromYear ? Math.expm1(item.logImpact) : 0, ret })));
  n.press.push({ q, ret: last.ret, bench: last.bench, rank, firms, leader: leader.name, stories, stocks });
}

/** Resolve an activist or crisis decision. Returns false for other kinds. */
export function applyPhase5(n: Career, d: PendingDecision, choice: string): boolean {
  const p = d.payload ?? {}; const q = n.fund.q;
  if (d.kind === 'crisis') {
    const cost = Number(p.cost ?? 0);
    if (p.key === 'market') {
      if (choice === 'calm') payOrOwe(n, { q, kind: 'event', category: 'event_cost', amount: cost, source: `decision:${d.id}`, memo: 'Crisis client outreach' });
      const hit = choice === 'calm' ? -2 : -8;
      for (const id of Object.keys(n.satisfaction)) n.satisfaction[id] = clamp(n.satisfaction[id] + hit);
      note(n, 'Head of client service', choice === 'calm' ? 'Clients reassured' : 'Clients felt ignored', choice === 'calm' ? 'Every client got a call. Most are staying calm.' : 'Several clients said no one called them during the slide.', choice === 'calm' ? 'good' : 'bad');
    } else {
      if (choice === 'fix') payOrOwe(n, { q, kind: 'event', category: 'event_cost', amount: cost, source: `decision:${d.id}`, memo: 'Trading systems repair' });
      else {
        n.roster = n.roster.map(e => ({ ...e, morale: clamp(e.morale - 8) }));
        const fine = Number(p.fine ?? 0);
        if (fine > 0) { payOrOwe(n, { q, kind: 'event', category: 'event_cost', amount: fine, source: `decision:${d.id}`, memo: 'Regulatory fine for the outage' }); note(n, 'Chief operating officer', 'Regulator fined the firm', `The patch did not satisfy the regulator: ${m(fine)} fine.`, 'bad'); }
      }
    }
    return true;
  }
  if (d.kind === 'activist') {
    const inv = n.fund.investors.find(i => i.id === p.investorId);
    const activist = String(p.activist ?? 'The activist');
    const redeem = (share: number, label: string) => {
      if (!inv || inv.units <= 0.01) return;
      const units = inv.units * share; inv.units -= units;
      redeemUnits(n.fund.ledger, units, q + 1, `${inv.name} — ${label}`, inv.id);
    };
    if (choice === 'return') { redeem(0.25, 'activist settlement'); if (inv) n.satisfaction[inv.id] = clamp((n.satisfaction[inv.id] ?? 50) + 6); note(n, activist, 'Settlement agreed', 'Part of the stake is being returned next quarter. The campaign ends.', 'neutral'); }
    else if (choice === 'cuts') {
      n.officeQ = Math.round(n.officeQ * 0.9);
      n.founderSalaryQ = Math.round(n.founderSalaryQ * 0.75 / 1000) * 1000;
      n.roster = n.roster.map(e => ({ ...e, morale: clamp(e.morale - 6) }));
      if (inv) n.satisfaction[inv.id] = clamp((n.satisfaction[inv.id] ?? 50) + 10);
      note(n, activist, 'Cost cuts accepted', 'Office costs and your salary come down. We will keep our money in the fund.', 'neutral');
    } else {
      payOrOwe(n, { q, kind: 'event', category: 'event_cost', amount: Number(p.legal ?? 0), source: `decision:${d.id}`, memo: `Legal fees fighting ${activist}` });
      if (Number(p.win)) { if (inv) n.satisfaction[inv.id] = clamp((n.satisfaction[inv.id] ?? 50) + 4); note(n, activist, 'Campaign withdrawn', 'Other clients backed you. The activist has backed down.', 'good'); }
      else { redeem(0.4, 'activist exit'); if (inv) n.satisfaction[inv.id] = clamp((n.satisfaction[inv.id] ?? 50) - 10); note(n, activist, 'You lost the fight', 'We are redeeming 40% of the position, payable next quarter.', 'bad'); }
    }
    return true;
  }
  return false;
}

export const latestEdition = (c: Career): PressEdition | undefined => c.press.at(-1);
