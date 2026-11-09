// My Life: the founder's personal book. Possessions, upkeep, personal obligations,
// a quarterly time budget, wellbeing, a small relationship network, life actions
// and state-based life events. Every dollar moves through the shared journal
// from or to the founder entity, so personal purchases can never touch firm or
// fund money. Everything is deterministic per career seed and quarter.
import { quarterLabel } from '@/lib/fund/engine';
import { mulberry32 } from '@/lib/fund/market';
import type { Career } from './career';
import { balance, post, type TxnCategory } from './journal';
import { withAbility } from './roster';
import { type Venture, venturesValue } from './ventures';
import { familyBills } from './founderSetup';

export type ItemKind = 'car' | 'home' | 'jet' | 'yacht' | 'island' | 'art' | 'membership' | 'education';
/** Perks never stack: the best owned value of each perk applies. */
export interface Perks { travel: number; hosting: number; network: number; rest: number; learning: number }
export interface CatalogItem {
  id: string; name: string; kind: ItemKind; price: number; blurb: string;
  /** Quarterly upkeep as a share of purchase price. */ upkeep: number;
  /** Quarterly change in market value (negative = depreciation). */ drift: number;
  /** Share of market value lost to brokers and fees when sold. 1 = cannot be resold. */ saleFee: number;
  status: number; perks: Partial<Perks>;
}

const I = (id: string, name: string, kind: ItemKind, price: number, upkeep: number, drift: number, saleFee: number, status: number, perks: Partial<Perks>, blurb: string): CatalogItem => ({ id, name, kind, price, upkeep, drift, saleFee, status, perks, blurb });

/** Fictional catalog. Prices are in dollars; nothing here is a real product or listing. */
export const CATALOG: CatalogItem[] = [
  I('car-sedan', 'Executive sedan', 'car', 90e3, 0.012, -0.04, 0.08, 1, {}, 'Quiet, reliable, and no one notices it.'),
  I('car-gt', 'Grand tourer', 'car', 320e3, 0.015, -0.035, 0.1, 3, {}, 'Hand-built coupe for weekends upstate.'),
  I('car-classic', 'Restored 1960s roadster', 'car', 1.4e6, 0.01, 0.004, 0.12, 4, {}, 'A collector car. Holds value if you keep it serviced.'),
  I('home-flat', 'City apartment', 'home', 1.8e6, 0.006, 0.006, 0.07, 2, { rest: 2 }, 'Two bedrooms, ten minutes from the office.'),
  I('home-pent', 'Penthouse with terrace', 'home', 14e6, 0.007, 0.006, 0.07, 5, { rest: 3, hosting: 1 }, 'Skyline views and room for twelve at dinner.'),
  I('home-estate', 'Country estate', 'home', 38e6, 0.009, 0.005, 0.08, 6, { rest: 4, hosting: 2 }, 'Forty acres, a guest house and a long drive.'),
  I('home-villa', 'Coastal villa', 'home', 22e6, 0.01, 0.004, 0.08, 5, { rest: 4 }, 'A place to actually switch off, if you go.'),
  I('jet-light', 'Light jet share (entry)', 'jet', 6e6, 0.05, -0.025, 0.1, 4, { travel: 1 }, 'Fractional ownership. Fewer airport days, steep running costs.'),
  I('jet-large', 'Large-cabin jet', 'jet', 65e6, 0.035, -0.02, 0.1, 8, { travel: 1, hosting: 1 }, 'Crosses oceans with clients on board. Crew, hangar and fuel are on you.'),
  I('yacht-sail', 'Sailing yacht', 'yacht', 4.5e6, 0.025, -0.02, 0.12, 4, { rest: 2 }, 'Thirty metres, a small crew and calm weekends.'),
  I('yacht-super', 'Superyacht', 'yacht', 140e6, 0.03, -0.018, 0.12, 9, { hosting: 2, rest: 3 }, 'A floating venue. Its crew costs more than some funds.'),
  I('island-small', 'Small private island', 'island', 28e6, 0.012, 0.002, 0.15, 7, { hosting: 2, rest: 3 }, 'Rustic villas and a jetty. Needs constant care.'),
  I('island-resort', 'Private island resort', 'island', 240e6, 0.014, 0.002, 0.15, 10, { hosting: 3, rest: 5 }, 'Staff of sixty, an airstrip and a famous guest list.'),
  I('art-print', 'Modern print collection', 'art', 250e3, 0.002, 0.003, 0.15, 1, {}, 'Signed editions. Insured, framed and hung.'),
  I('art-paint', 'Postwar painting', 'art', 9e6, 0.003, 0.004, 0.15, 5, {}, 'A museum has asked to borrow it. Values can drift either way.'),
  I('art-masters', 'Old masters collection', 'art', 80e6, 0.003, 0.003, 0.15, 8, {}, 'Three canvases with long provenance and climate-controlled storage.'),
  I('watch', 'Collector watch', 'art', 180e3, 0.002, 0.002, 0.15, 1, {}, 'An independent maker\'s limited run.'),
  I('club-city', 'City club membership', 'membership', 120e3, 0.01, -1, 1, 2, { network: 1 }, 'Breakfasts with people who make allocation decisions.'),
  I('club-golf', 'Golf and country club', 'membership', 450e3, 0.012, -1, 1, 3, { network: 1, rest: 1 }, 'Long waiting list. Many deals start on the fourth hole.'),
  I('club-board', 'Museum board seat', 'membership', 2.5e6, 0.005, -1, 1, 5, { network: 2 }, 'A donation buys the seat; the seat brings a network.'),
  I('edu-exec', 'Executive leadership program', 'education', 95e3, 0, -1, 1, 0, { learning: 1 }, 'Eight weekends of case studies on running a firm.'),
  I('edu-cfa', 'Advanced investment course', 'education', 40e3, 0, -1, 1, 0, { learning: 1 }, 'Refresh your valuation and risk toolkit.'),
  I('ship-cruise', 'Private cruise ship', 'yacht', 1.2e9, 0.018, -0.015, 0.15, 18, { hosting: 4, rest: 5 }, 'A private ocean liner with a full crew. Personal leisure asset, not a ticket-selling business.'),
  I('yacht-expedition', 'Expedition megayacht', 'yacht', 420e6, 0.025, -0.015, 0.12, 13, { hosting: 3, rest: 5 }, 'Ice-class hull, helicopter deck and a crew ready for remote waters.'),
  I('home-castle', 'Historic château', 'home', 180e6, 0.012, 0.003, 0.1, 12, { hosting: 3, rest: 4 }, 'A restored castle and private gardens. Preservation and grounds staff are expensive.'),
  I('jet-airliner', 'Private wide-body airliner', 'jet', 380e6, 0.03, -0.02, 0.12, 14, { travel: 1, hosting: 3 }, 'A flying residence. Crew, airport slots and maintenance come out of your own pocket.'),
  I('island-retreat', 'Private beach retreat', 'island', 680e6, 0.016, 0.002, 0.15, 15, { hosting: 4, rest: 6 }, 'A hotel-scale personal retreat for family and invited guests, with no commercial bookings.'),
  I('home-circuit', 'Private racing estate', 'home', 320e6, 0.015, -0.004, 0.12, 12, { hosting: 3, rest: 3 }, 'Your own circuit, garages and guest lodge. Track upkeep never takes a holiday.'),
];
export const catalogItem = (id: string) => CATALOG.find(x => x.id === id);

export interface Possession { id: string; itemId: string; name: string; kind: ItemKind; boughtQ: number; /** What you paid. Never changes. */ price: number; /** Value multiplier from wear (charter etc.). */ wear?: number; soldQ?: number; salePrice?: number; forced?: boolean }
export interface PersonalBill { id: string; q: number; label: string; amount: number; /** Who is owed (default: outside parties). */ to?: string }
export interface Relation { id: string; name: string; role: string; closeness: number; lastQ: number; memory: string[]; kind?: 'family' | 'dating' | 'spouse' | 'ex' | 'contact'; metQ?: number; could?: string }
export interface LifeOption { id: string; label: string; hint: string }
export interface LifeEvent { id: string; q: number; template: string; title: string; text: string; options: LifeOption[]; defaultOption: string; payload: Record<string, string | number>; resolved?: string; outcome?: string }
export interface LifeLog { q: number; text: string; tone: 'good' | 'bad' | 'neutral' }

export interface LifeState {
  possessions: Possession[]; owed: PersonalBill[];
  cooldowns: Record<string, number>; timeQ: number; timeUsed: number;
  /** Future time commitments, separate from the current quarter's use. */ promises?: { q: number; points: number; label: string }[];
  wellbeing: number; stress: number; insight: number; repMod: number;
  people: Relation[]; events: LifeEvent[]; log: LifeLog[]; shortQuarters: number;
  eventCooldown: Record<string, number>; heirId?: string;
  /** Firm office tier (firm-owned, separate from personal homes). */
  officeTier: number; officeBaseQ: number; officeChangedQ: number;
  /** Businesses bought with personal cash (see ventures.ts). */ ventures?: Venture[];
}

export const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
export const lbl = (c: Career, q: number) => (q > 0 ? quarterLabel(c.fund, q) : 'Opening');
export const personalCash = (c: Career) => balance(c.journal, 'founder');

const NAMES = ['Lena', 'Marco', 'Isabel', 'Tobias', 'Noor', 'Sam', 'Rosa', 'Jonah', 'Mira', 'Calvin', 'Eva', 'Dario'];
export function newLife(seed: number, officeQ: number): LifeState {
  const r = mulberry32(seed * 41 + 3);
  const used = new Set<string>(); const pick = () => { let n = ''; do n = NAMES[Math.floor(r() * NAMES.length)]; while (used.has(n)); used.add(n); return n; };
  return {
    possessions: [], owed: [], cooldowns: {}, timeQ: -1, timeUsed: 0, wellbeing: 70, stress: 30, insight: 0, repMod: 0,
    people: [
      { id: 'partner', name: pick(), role: 'Partner', closeness: 70, lastQ: 0, memory: [] },
      { id: 'parent', name: pick(), role: 'Parent', closeness: 65, lastQ: 0, memory: [] },
      { id: 'friend', name: pick(), role: 'Oldest friend', closeness: 60, lastQ: 0, memory: [] },
      { id: 'mentor', name: pick(), role: 'Former boss and mentor', closeness: 55, lastQ: 0, memory: [] },
    ],
    events: [], log: [], shortQuarters: 0, eventCooldown: {}, officeTier: 0, officeBaseQ: officeQ, officeChangedQ: -99,
  };
}
export const lifeOf = (c: Career): LifeState => c.life ?? newLife(c.fund.seed, c.officeQ);

// ---------- Possessions ----------

export const owned = (c: Career) => lifeOf(c).possessions.filter(p => p.soldQ === undefined);
/** Market value is an estimate; memberships and education have no resale value. */
export function marketValue(p: Possession, q: number): number {
  if (p.itemId === 'venture') return p.price; // private stake, carried at cost until it resolves
  const it = catalogItem(p.itemId); if (!it || it.drift <= -1) return 0;
  return p.price * (p.wear ?? 1) * Math.pow(1 + it.drift, Math.max(0, q - p.boughtQ));
}
/** What a sale pays after fees. Always below price in the purchase quarter, so buying and reselling never makes money. */
export function resaleValue(p: Possession, q: number): number {
  const it = catalogItem(p.itemId); if (!it || it.saleFee >= 1) return 0;
  return marketValue(p, q) * (1 - it.saleFee);
}
export const upkeepQ = (c: Career) => owned(c).reduce((a, p) => a + p.price * (catalogItem(p.itemId)?.upkeep ?? 0), 0);
export const assetsValue = (c: Career) => owned(c).reduce((a, p) => a + marketValue(p, c.fund.q), 0);
export const personalOwed = (c: Career) => lifeOf(c).owed.reduce((a, b) => a + b.amount, 0);
export function perks(c: Career): Perks {
  const p: Perks = { travel: 0, hosting: 0, network: 0, rest: 0, learning: 0 };
  for (const x of owned(c)) { const it = catalogItem(x.itemId); if (!it) continue; for (const k of Object.keys(it.perks) as (keyof Perks)[]) p[k] = Math.max(p[k], it.perks[k] ?? 0); }
  return p;
}
export const statusScore = (c: Career) => owned(c).reduce((a, p) => a + (catalogItem(p.itemId)?.status ?? 0), 0);

export type ActionResult = { c: Career; ok: boolean; message: string };
export const fail = (c: Career, message: string): ActionResult => ({ c, ok: false, message });
const running = (c: Career) => c.status === 'running';

export function clone(c: Career): Career { const n: Career = structuredClone(c); n.life = lifeOf(n); return n; }
export function log(n: Career, text: string, tone: LifeLog['tone'] = 'neutral') { n.life!.log.push({ q: n.fund.q, text, tone }); if (n.life!.log.length > 200) n.life!.log.shift(); }
export function spend(n: Career, amount: number, category: TxnCategory, memo: string, source: string) {
  return post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'founder', recipient: 'external', category, amount, source, memo });
}

/** Unique per kind and item: you can own one of each item (no stacking perks or status). */
export function buyItem(c: Career, itemId: string): ActionResult {
  const it = catalogItem(itemId);
  if (!it) return fail(c, 'That item is not in the catalog.');
  if (!running(c)) return fail(c, 'This career has ended.');
  if (owned(c).some(p => p.itemId === itemId)) return fail(c, `You already own the ${it.name.toLowerCase()}.`);
  const cash = personalCash(c);
  if (cash < it.price) return fail(c, `You have ${Math.round(cash).toLocaleString('en-US')} dollars of personal cash; this costs ${Math.round(it.price).toLocaleString('en-US')}.`);
  if (personalOwed(c) > 0) return fail(c, 'Pay your overdue personal bills first.');
  const n = clone(c);
  spend(n, it.price, 'purchase', `Bought: ${it.name}`, `buy:${itemId}:${n.fund.q}`);
  n.life!.possessions.push({ id: `pos-${n.journal.seq}`, itemId, name: it.name, kind: it.kind, boughtQ: n.fund.q, price: it.price });
  log(n, `Bought the ${it.name.toLowerCase()} for ${fmt(it.price)}. Upkeep ${fmt(it.price * it.upkeep)} a quarter.`, 'good');
  return { c: n, ok: true, message: `Bought the ${it.name.toLowerCase()}.` };
}

export function sellItem(c: Career, possessionId: string, forced = false): ActionResult {
  const p = owned(c).find(x => x.id === possessionId);
  if (!p) return fail(c, 'You do not own that.');
  if (!running(c) && !forced) return fail(c, 'This career has ended.');
  const it = catalogItem(p.itemId);
  if (!it || it.saleFee >= 1) return fail(c, `${p.name} cannot be resold.`);
  const n = clone(c);
  const value = resaleValue(p, n.fund.q);
  post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'external', recipient: 'founder', category: 'asset_sale', amount: value, source: `sell:${p.id}`, memo: `${forced ? 'Forced sale' : 'Sold'}: ${p.name} (after ${Math.round(it.saleFee * 100)}% fees)` });
  const x = n.life!.possessions.find(y => y.id === p.id)!; x.soldQ = n.fund.q; x.salePrice = value; x.forced = forced;
  log(n, `${forced ? 'Forced to sell' : 'Sold'} the ${p.name.toLowerCase()} for ${fmt(value)} (paid ${fmt(p.price)}).`, forced ? 'bad' : 'neutral');
  return { c: n, ok: true, message: `Sold the ${p.name.toLowerCase()} for ${fmt(value)}.` };
}

/** Pay overdue personal bills from personal cash. */
export function payPersonalBills(n: Career, source: string, closeId?: string): number {
  let paid = 0;
  for (const b of n.life!.owed) {
    const pay = Math.min(b.amount, Math.max(0, personalCash(n)));
    if (pay <= 0.005) continue;
    post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'founder', recipient: b.to ?? 'external', category: b.to ? 'life_cost' : 'upkeep', amount: pay, source, memo: `${b.label} (overdue since ${lbl(n, b.q)})`, closeId });
    b.amount -= pay; paid += pay;
  }
  n.life!.owed = n.life!.owed.filter(b => b.amount > 0.5);
  return paid;
}
export function payOrOwePersonal(n: Career, amount: number, category: TxnCategory, memo: string, source: string, closeId?: string) {
  const pay = Math.min(amount, Math.max(0, personalCash(n)));
  if (pay > 0.005) post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'founder', recipient: 'external', category, amount: pay, source, memo, closeId });
  const left = amount - pay;
  if (left > 0.5) n.life!.owed.push({ id: `powe-${source}-${n.life!.owed.length}`, q: n.fund.q, label: memo, amount: left });
  return left;
}

// ---------- Time, actions and cooldowns ----------

export const BASE_TIME = 2;
export function timeBudget(c: Career) { const l = lifeOf(c); return Math.max(1, BASE_TIME + perks(c).travel - (l.wellbeing < 25 ? 1 : 0)); }
/** Time already promised for a quarter (e.g. to a partner). Kept apart from timeQ/timeUsed so actions never overwrite it. */
export const promisedTime = (c: Career, q = c.fund.q) => (lifeOf(c).promises ?? []).filter(p => p.q === q).reduce((a, p) => a + p.points, 0);
export function timeLeft(c: Career) { const l = lifeOf(c); return timeBudget(c) - (l.timeQ === c.fund.q ? l.timeUsed : 0) - promisedTime(c); }

export type LifeActionId = 'leave' | 'family' | 'network' | 'host' | 'study' | 'mentor' | 'philanthropy' | 'interview';
export interface LifeActionDef { id: LifeActionId; label: string; time: number; cooldown: number; blurb: string }
export const LIFE_ACTIONS: LifeActionDef[] = [
  { id: 'leave', label: 'Take a quarter of leave', time: 2, cooldown: 6, blurb: 'Wellbeing +25, stress -20. Clients notice you are away (satisfaction -1 each).' },
  { id: 'family', label: 'Spend time with someone close', time: 1, cooldown: 1, blurb: 'Closeness +15, wellbeing +6.' },
  { id: 'network', label: 'Network at an industry dinner', time: 1, cooldown: 2, blurb: 'Costs a dinner. Reputation +1, or +2 with a club membership.' },
  { id: 'host', label: 'Host your largest clients', time: 1, cooldown: 4, blurb: 'Needs a venue (penthouse, estate, yacht, island or large jet). Top 3 client satisfaction +3 to +8; stress +3.' },
  { id: 'study', label: 'Study and reflect', time: 1, cooldown: 4, blurb: 'Insight +1 (+2 with a course), up to 5. Each point speeds team research by 2%.' },
  { id: 'mentor', label: 'Mentor a team member', time: 1, cooldown: 2, blurb: 'Their ability +2 toward potential, morale +4. Your stress +4.' },
  { id: 'philanthropy', label: 'Give to charity', time: 1, cooldown: 4, blurb: 'Donate 5% of personal cash (at least $25K). Reputation +2, wellbeing +4.' },
  { id: 'interview', label: 'Do a public profile interview', time: 1, cooldown: 4, blurb: 'Reputation +2 if the fund beat the S&P 500 over the last year, otherwise -2.' },
];

/** Spend founder time this quarter (meetings, partner talks). Callers check timeLeft first. */
export function spendTime(n: Career, points: number) { n.life = lifeOf(n); const L = n.life; if (L.timeQ !== n.fund.q) { L.timeQ = n.fund.q; L.timeUsed = 0; } L.timeUsed += points; }

export function cooldownLeft(c: Career, key: string) { const until = lifeOf(c).cooldowns[key]; return until === undefined ? 0 : Math.max(0, until - c.fund.q); }

/** The fund's net return minus the S&P 500 over the last four completed quarters (completed history only). */
export function lastYearEdge(c: Career): number | null {
  const h = c.fund.history.slice(-4); if (h.length < 4) return null;
  const g = (k: 'ret' | 'bench') => h.reduce((a, x) => a * (1 + (x[k] ?? 0)), 1) - 1;
  return g('ret') - g('bench');
}

export function lifeAction(c: Career, id: LifeActionId, target?: string): ActionResult {
  const def = LIFE_ACTIONS.find(a => a.id === id); if (!def) return fail(c, 'Unknown action.');
  if (!running(c)) return fail(c, 'This career has ended.');
  const key = id === 'family' || id === 'mentor' ? `${id}:${target}` : id;
  if (cooldownLeft(c, key) > 0) return fail(c, `Available again in ${cooldownLeft(c, key)} quarter(s).`);
  if (timeLeft(c) < def.time) return fail(c, `Needs ${def.time} time point(s); you have ${timeLeft(c)} left this quarter.`);
  const n = clone(c); const L = n.life!; const pk = perks(n); const k = n.scenario === 'boutique' ? 0.2 : 1;
  const use = () => { if (L.timeQ !== n.fund.q) { L.timeQ = n.fund.q; L.timeUsed = 0; } L.timeUsed += def.time; L.cooldowns[key] = n.fund.q + def.cooldown; };
  let msg = '';
  switch (id) {
    case 'leave':
      L.wellbeing = clamp(L.wellbeing + 25); L.stress = clamp(L.stress - 20); if (n.founder) n.founder.health = Math.min(100, n.founder.health + 6);
      for (const inv of n.fund.investors) if (inv.id !== 'you') n.satisfaction[inv.id] = clamp((n.satisfaction[inv.id] ?? 60) - 1);
      msg = 'You took leave. You feel rested; clients noticed you were away.'; break;
    case 'family': {
      const p = L.people.find(x => x.id === target); if (!p) return fail(c, 'Choose someone.');
      p.closeness = clamp(p.closeness + 15); p.lastQ = n.fund.q; p.memory.push(`${lbl(n, n.fund.q)}: you made time`); L.wellbeing = clamp(L.wellbeing + 6);
      msg = `You spent real time with ${p.name}.`; break;
    }
    case 'network': {
      const cost = 40e3 * Math.max(0.25, k);
      if (personalCash(n) < cost) return fail(c, `A dinner costs ${fmt(cost)} of personal cash.`);
      spend(n, cost, 'life_cost', 'Industry dinner', `life:network:${n.fund.q}`);
      const g = 1 + pk.network + (bgOf(n) === 'ivy' ? 1 : 0); L.repMod = clamp(L.repMod + g, -10, 10); L.stress = clamp(L.stress + 2);
      const met = addContact(n, pk.network ? 'your club' : 'an industry dinner');
      msg = `Good conversations. Reputation +${g}.${met ? ` You met ${met.name}.` : ''}`; break;
    }
    case 'host': {
      if (pk.hosting < 1) return fail(c, 'You need a venue: a penthouse, estate, superyacht, island or large-cabin jet.');
      const cost = 150e3 * Math.max(0.25, k);
      if (personalCash(n) < cost) return fail(c, `Hosting costs ${fmt(cost)} of personal cash.`);
      spend(n, cost, 'life_cost', 'Hosted a client weekend', `life:host:${n.fund.q}`);
      const gain = 2 + pk.hosting * 2;
      const top = n.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01).sort((a, b) => b.units - a.units).slice(0, 3);
      for (const inv of top) n.satisfaction[inv.id] = clamp((n.satisfaction[inv.id] ?? 60) + gain);
      L.stress = clamp(L.stress + 3);
      msg = `${top.map(t => t.name).join(', ')} came for the weekend. Satisfaction +${gain} each.`; break;
    }
    case 'study': {
      if (L.insight >= 5) return fail(c, 'Insight is already at its cap of 5.');
      const add = Math.min(5 - L.insight, 1 + pk.learning); L.insight += add;
      msg = `Insight +${add} (now ${L.insight}). Team research is ${L.insight * 2}% faster.`; break;
    }
    case 'mentor': {
      const e = n.roster.find(x => x.id === target); if (!e) return fail(c, 'Choose a team member.');
      const before = e.ability; e.ability = withAbility(e, e.ability + 2); e.morale = clamp(e.morale + 4); L.stress = clamp(L.stress + 4);
      msg = e.ability > before ? `${e.name} learned a lot (ability ${before.toFixed(0)} → ${e.ability.toFixed(0)}).` : `${e.name} enjoyed it, but is already at their potential.`; break;
    }
    case 'philanthropy': {
      const amt = Math.max(25e3, personalCash(n) * 0.05);
      if (personalCash(n) < amt) return fail(c, `A gift needs at least ${fmt(amt)} of personal cash.`);
      spend(n, amt, 'life_cost', 'Charitable gift', `life:give:${n.fund.q}`);
      L.repMod = clamp(L.repMod + 2, -10, 10); L.wellbeing = clamp(L.wellbeing + 4);
      msg = `You gave ${fmt(amt)}. Reputation +2.`; break;
    }
    case 'interview': {
      const e = lastYearEdge(n); if (e === null) return fail(c, 'Journalists want a full year of results first.');
      const d = e >= 0 ? 2 : -2; L.repMod = clamp(L.repMod + d, -10, 10);
      msg = e >= 0 ? `The profile praised beating the S&P 500 by ${(e * 100).toFixed(1)} points. Reputation +2.` : `The profile focused on trailing the S&P 500 by ${(-e * 100).toFixed(1)} points. Reputation -2.`; break;
    }
  }
  use(); log(n, msg, 'neutral');
  return { c: n, ok: true, message: msg };
}

// ---------- Reputation ----------

/**
 * Firm reputation, 0-100, from real results and behavior: net return versus the S&P 500 since launch,
 * average client satisfaction, crises and late payments, plus bounded life choices (±10). AUM alone never counts.
 */
export function reputation(c: Career): { score: number; parts: { label: string; value: number }[] } {
  const h = c.fund.history; const g = (k: 'ret' | 'bench') => h.reduce((a, x) => a * (1 + (x[k] ?? 0)), 1) - 1;
  const years = Math.max(1, h.length / 4);
  const edge = h.length ? (g('ret') - g('bench')) / years : 0;
  const sats = c.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01).map(i => c.satisfaction[i.id] ?? 60);
  const sat = sats.length ? sats.reduce((a, b) => a + b, 0) / sats.length : 60;
  const late = h.filter(x => x.latePayment).length;
  const parts = [
    { label: 'Starting reputation', value: 40 },
    { label: 'Annual edge vs S&P 500', value: Math.max(-20, Math.min(20, Math.round(edge * 200))) },
    { label: 'Client service', value: Math.round((sat - 60) / 2) },
    { label: 'Late payments', value: -Math.min(15, late * 5) },
    { label: 'Life and public choices', value: lifeOf(c).repMod },
    { label: 'Public company coverage', value: Math.max(-5, Math.min(5, Math.round((c.publicFirm?.sentiment ?? 0) / 2))) },
  ];
  return { score: clamp(parts.reduce((a, p) => a + p.value, 0)), parts };
}

// ---------- Net worth ----------

export interface NetWorth { cash: number; assets: number; stake: number; equity: number; owed: number; total: number }
export function netWorth(c: Career, equityValue: number, stake: number): NetWorth {
  const cash = personalCash(c); const assets = assetsValue(c) + venturesValue(c); const owed = personalOwed(c);
  return { cash, assets, stake, equity: equityValue, owed, total: cash + assets + stake + equityValue - owed };
}

// ---------- Life events ----------

interface Template { id: string; when: (c: Career) => boolean; make: (c: Career, r: () => number) => Omit<LifeEvent, 'id' | 'q' | 'template'> }
const topClient = (c: Career) => c.fund.investors.filter(i => i.id !== 'you' && i.units > 0.01).sort((a, b) => b.units - a.units)[0];
const person = (c: Career, id: string) => lifeOf(c).people.find(p => p.id === id)!;
/** Current romantic partner id: always 'partner' on careers without a founder; null when the founder is single. */
export const partnerIdOf = (c: Career): string | null => (c.founder ? c.founder.romance.partnerId : 'partner');
const hasPartner = (c: Career) => { const id = partnerIdOf(c); return !!id && lifeOf(c).people.some(p => p.id === id); };
const bgOf = (c: Career) => c.founder?.background;
const CONTACT_NAMES = ['Harriet Vance', 'Omar Siddiqui', 'Beatrix Lowe', 'Kofi Asante', 'Lucia Ferrante', 'Henrik Dahl', 'Mei Tanaka', 'Rafael Cruz', 'Sunita Rao', 'Gideon Pryce', 'Elodie Marchand', 'Wes Calloway'];
const COULD = ['a future client', 'a possible co-founder', 'a market tipster', 'a rival'];
/** Founder careers meet new contacts at dinners, galas, reunions and clubs. Deterministic per career, quarter and place; at most 12 contacts. */
export function addContact(n: Career, where: string): Relation | null {
  if (!n.founder) return null; const L = n.life!;
  if (L.people.filter(p => p.kind === 'contact').length >= 12) return null;
  const r = mulberry32(n.fund.seed * 53 + n.fund.q * 17 + where.length * 7 + n.founder.seq++);
  const free = CONTACT_NAMES.filter(x => !L.people.some(p => p.name === x)); if (!free.length) return null;
  const name = free[Math.floor(r() * free.length)];
  const p: Relation = { id: `contact-${n.fund.q}-${n.founder.seq}`, name, role: `Met at ${where}`, closeness: 40, lastQ: n.fund.q, memory: [`${lbl(n, n.fund.q)}: you met at ${where}`], kind: 'contact', metQ: n.fund.q, could: COULD[Math.floor(r() * COULD.length)] };
  L.people.push(p); return p;
}
const o = (id: string, label: string, hint: string): LifeOption => ({ id, label, hint });
const sc = (c: Career) => (c.scenario === 'boutique' ? 0.2 : 1);

export const LIFE_TEMPLATES: Template[] = [
  { id: 'birthday', when: c => !!topClient(c) && hasPartner(c), make: c => { const p = person(c, partnerIdOf(c)!); const t = topClient(c)!; return { title: `${p.name}'s birthday clashes with a client dinner`, text: `${t.name} booked the same evening.`, options: [o('home', 'Go to the birthday', `${p.name} closeness +12; ${t.name} satisfaction -3`), o('dinner', 'Keep the dinner', `${t.name} satisfaction +4; ${p.name} closeness -10`)], defaultOption: 'dinner', payload: { inv: t.id } }; } },
  { id: 'parent_health', when: () => true, make: c => { const p = person(c, 'parent'); return { title: `${p.name} is unwell`, text: bgOf(c) === 'immigrant' ? 'Your parent back home is unwell. The flight is long, but they would love to see you.' : 'The doctors say it is not serious, but they would like to see you.', options: [o('visit', 'Fly home this week', `Costs ${fmt(20e3)}; closeness +10; stress +5`), o('help', 'Pay for help at home', `Costs ${fmt(60e3)}; closeness +3`)], defaultOption: 'help', payload: {} }; } },
  { id: 'friend_venture', when: c => personalCash(c) > 200e3, make: c => { const p = person(c, 'friend'); const amt = Math.round(Math.min(personalCash(c) * 0.1, 2e6 * sc(c)) / 1000) * 1000; return { title: `${p.name} asks you to back a startup`, text: `${p.name} is raising a seed round. Most seed rounds lose money.`, options: [o('invest', `Invest ${fmt(amt)}`, 'Personal cash; closeness +8; an uncertain result in two years'), o('decline', 'Decline kindly', 'Closeness -8')], defaultOption: 'decline', payload: { amt } }; } },
  { id: 'mentor_lunch', when: () => true, make: c => { const p = person(c, 'mentor'); return { title: `${p.name} offers lunch`, text: 'Your old boss wants to hear how the firm is going.', options: [o('go', 'Go', 'Insight +1 (cap 5); closeness +6'), o('skip', 'Too busy', 'Closeness -5')], defaultOption: 'skip', payload: {} }; } },
  { id: 'gala', when: () => true, make: c => ({ title: 'Asked to chair a charity gala', text: 'Chairing raises your profile and takes real effort.', options: [o('chair', 'Chair it', `Costs ${fmt(100e3 * sc(c))}; reputation +2; stress +4`), o('attend', 'Just attend', `Costs ${fmt(25e3 * sc(c))}; reputation +1`), o('decline', 'Decline', 'No change')], defaultOption: 'decline', payload: {} }) },
  { id: 'burnout', when: c => lifeOf(c).wellbeing < 40, make: () => ({ title: 'Your doctor is worried', text: 'Long hours are catching up with you.', options: [o('rest', 'Cut back for a while', 'Wellbeing +15; clients -1 each'), o('push', 'Push through', 'Stress +10; wellbeing -5')], defaultOption: 'push', payload: {} }) },
  { id: 'tax', when: c => c.journal.txns.some(t => t.category === 'distribution' && c.fund.q - t.q <= 4), make: c => { const d = c.journal.txns.filter(t => t.category === 'distribution' && c.fund.q - t.q <= 4).reduce((a, t) => a + t.amount, 0); const amt = Math.round(d * 0.2); return { title: 'Estimated tax on your distributions', text: `Your accountant estimates ${fmt(amt)} on last year's distributions of ${fmt(d)}.`, options: [o('pay', 'Pay now', `${fmt(amt)} from personal cash`), o('defer', 'Defer a quarter', `Owed later with 5% interest (${fmt(amt * 1.05)})`)], defaultOption: 'defer', payload: { amt } }; } },
  { id: 'profile', when: c => statusScore(c) >= 5, make: c => ({ title: 'A lifestyle magazine wants a feature', text: 'They want photos of your homes and toys.', options: [o('accept', 'Do the feature', (lastYearEdge(c) ?? 0) >= 0 ? 'Reputation +1' : 'Reputation -2: clients are losing money'), o('decline', 'Stay private', 'No change')], defaultOption: 'decline', payload: {} }) },
  { id: 'neighbor', when: c => owned(c).some(p => p.kind === 'home'), make: c => { const h = owned(c).filter(p => p.kind === 'home').sort((a, b) => b.price - a.price)[0]; return { title: 'A neighbour objects to your renovation', text: `The dispute is about the ${h.name.toLowerCase()}.`, options: [o('settle', 'Settle', `Costs ${fmt(h.price * 0.01)}`), o('fight', 'Fight it', 'Stress +8; may cost more later')], defaultOption: 'settle', payload: { price: h.price } }; } },
  { id: 'wedding', when: c => c.roster.length > 1, make: c => { const e = [...c.roster].sort((a, b) => b.ability - a.ability)[0]; return { title: `${e.name} invites you to their wedding`, text: 'It is on a weekend you had planned to work.', options: [o('attend', 'Attend', `${e.name} morale +10; uses no money`), o('gift', 'Send a gift', `Costs ${fmt(5e3)}; morale +3`)], defaultOption: 'gift', payload: { emp: e.id } }; } },
  { id: 'charter', when: c => owned(c).some(p => p.kind === 'yacht'), make: c => { const y = owned(c).find(p => p.kind === 'yacht')!; return { title: 'A charter agent wants your yacht', text: 'Paying guests for a month cover some costs but add wear.', options: [o('charter', 'Charter it out', `Earn ${fmt(y.price * 0.01)}; market value -2%`), o('keep', 'Keep it private', 'No change')], defaultOption: 'keep', payload: { pos: y.id } }; } },
  { id: 'reunion', when: () => true, make: c => ({ title: bgOf(c) === 'selftaught' ? 'Trading forum meetup' : bgOf(c) === 'banker' ? 'Old trading floor drinks' : 'University reunion', text: bgOf(c) === 'ivy' ? 'Your Ivy classmates now run pension plans and endowments.' : bgOf(c) === 'selftaught' ? 'The forum regulars finally meet in person. Some now manage real money.' : 'Some old faces now run large pension plans.', options: [o('go', 'Go', 'Reputation +1; wellbeing +5'), o('skip', 'Skip it', 'No change')], defaultOption: 'skip', payload: {} }) },
  { id: 'succession', when: c => c.fund.q >= 12 && !lifeOf(c).heirId && c.roster.length > 1, make: c => { const e = [...c.roster].sort((a, b) => b.ability - a.ability)[0]; return { title: 'The board asks about succession', text: `${e.name} is the obvious internal candidate.`, options: [o('name', `Name ${e.name} heir apparent`, `${e.name} morale +10; others -3; enables retirement`), o('defer', 'Not yet', 'No change')], defaultOption: 'defer', payload: { emp: e.id } }; } },
  { id: 'strain', when: c => hasPartner(c) && person(c, partnerIdOf(c)!).closeness < 30, make: c => { const p = person(c, partnerIdOf(c)!); return { title: `${p.name} says you are never home`, text: `They remember: ${p.memory.slice(-1)[0] ?? 'a long run of missed evenings'}.`, options: [o('commit', 'Promise more time', 'Next quarter one fewer time point; closeness +20'), o('ignore', 'Change nothing', 'Closeness -15; wellbeing -10')], defaultOption: 'ignore', payload: {} }; } },
];

export const openLifeEvents = (c: Career) => lifeOf(c).events.filter(e => !e.resolved);

export function resolveLifeEvent(c: Career, id: string, choice: string): Career {
  const ev = openLifeEvents(c).find(e => e.id === id);
  if (!ev || !ev.options.some(x => x.id === choice)) return c;
  const n = clone(c); const L = n.life!; const e = L.events.find(x => x.id === id)!;
  const src = `life:${id}:${choice}`; const pid0 = partnerIdOf(n) ?? 'partner'; const P = (pid: string) => L.people.find(x => x.id === (pid === 'partner' ? pid0 : pid)) ?? L.people[0];
  const sat = (inv: string | number, d: number) => { n.satisfaction[String(inv)] = clamp((n.satisfaction[String(inv)] ?? 60) + d); };
  const remember = (pid: string, text: string) => P(pid).memory.push(`${lbl(n, n.fund.q)}: ${text}`);
  let out = '';
  switch (`${e.template}:${choice}`) {
    case 'birthday:home': P('partner').closeness = clamp(P('partner').closeness + 12); sat(e.payload.inv, -3); remember('partner', 'you came to the birthday'); out = 'You went to the birthday.'; break;
    case 'birthday:dinner': P('partner').closeness = clamp(P('partner').closeness - 10); sat(e.payload.inv, 4); remember('partner', 'you missed the birthday for a client'); out = 'You kept the client dinner.'; break;
    case 'parent_health:visit': payOrOwePersonal(n, 20e3, 'life_cost', 'Flight home', src); P('parent').closeness = clamp(P('parent').closeness + 10); L.stress = clamp(L.stress + 5); remember('parent', 'you flew home when they were ill'); out = 'You flew home.'; break;
    case 'parent_health:help': payOrOwePersonal(n, 60e3, 'life_cost', 'Home care for a parent', src); P('parent').closeness = clamp(P('parent').closeness + 3); out = 'You paid for care at home.'; break;
    case 'friend_venture:invest': {
      const amt = Number(e.payload.amt);
      if (personalCash(n) < amt) { out = 'You no longer had the cash, so you declined.'; P('friend').closeness = clamp(P('friend').closeness - 8); break; }
      spend(n, amt, 'purchase', `Seed investment in ${P('friend').name}'s startup`, src);
      L.possessions.push({ id: `pos-${n.journal.seq}`, itemId: 'venture', name: `Stake in ${P('friend').name}'s startup`, kind: 'art', boughtQ: n.fund.q, price: amt });
      P('friend').closeness = clamp(P('friend').closeness + 8); remember('friend', 'you backed the startup'); out = `You invested ${fmt(amt)}. The result is known in two years.`; break;
    }
    case 'friend_venture:decline': P('friend').closeness = clamp(P('friend').closeness - 8); remember('friend', 'you passed on the startup'); out = 'You declined.'; break;
    case 'mentor_lunch:go': L.insight = Math.min(5, L.insight + 1); P('mentor').closeness = clamp(P('mentor').closeness + 6); out = 'Useful lunch. Insight +1.'; break;
    case 'mentor_lunch:skip': P('mentor').closeness = clamp(P('mentor').closeness - 5); out = 'You skipped lunch.'; break;
    case 'gala:chair': payOrOwePersonal(n, 100e3 * sc(n), 'life_cost', 'Charity gala chair', src); L.repMod = clamp(L.repMod + 2, -10, 10); L.stress = clamp(L.stress + 4); out = `You chaired the gala.${addContact(n, 'a charity gala') ? ' You met someone new.' : ''}`; break;
    case 'gala:attend': payOrOwePersonal(n, 25e3 * sc(n), 'life_cost', 'Charity gala ticket', src); L.repMod = clamp(L.repMod + 1, -10, 10); out = `You attended the gala.${addContact(n, 'a charity gala') ? ' You met someone new.' : ''}`; break;
    case 'burnout:rest': L.wellbeing = clamp(L.wellbeing + 15); for (const i of n.fund.investors) if (i.id !== 'you') sat(i.id, -1); out = 'You cut back.'; break;
    case 'burnout:push': L.stress = clamp(L.stress + 10); L.wellbeing = clamp(L.wellbeing - 5); out = 'You pushed through.'; break;
    case 'tax:pay': payOrOwePersonal(n, Number(e.payload.amt), 'life_cost', 'Estimated income tax', src); out = 'Tax paid.'; break;
    case 'tax:defer': L.owed.push({ id: `powe-${src}`, q: n.fund.q, label: 'Deferred income tax (with 5% interest)', amount: Number(e.payload.amt) * 1.05 }); out = 'Tax deferred; it is now an overdue bill.'; break;
    case 'profile:accept': L.repMod = clamp(L.repMod + ((lastYearEdge(n) ?? 0) >= 0 ? 1 : -2), -10, 10); out = 'The feature ran.'; break;
    case 'neighbor:settle': payOrOwePersonal(n, Number(e.payload.price) * 0.01, 'life_cost', 'Neighbour settlement', src); out = 'You settled.'; break;
    case 'neighbor:fight': L.stress = clamp(L.stress + 8); L.cooldowns['neighbor_followup'] = n.fund.q + 2; out = 'You chose to fight. Lawyers will follow up.'; break;
    case 'wedding:attend': { const x = n.roster.find(y => y.id === e.payload.emp); if (x) x.morale = clamp(x.morale + 10); out = 'You went to the wedding.'; break; }
    case 'wedding:gift': { payOrOwePersonal(n, 5e3, 'life_cost', 'Wedding gift', src); const x = n.roster.find(y => y.id === e.payload.emp); if (x) x.morale = clamp(x.morale + 3); out = 'You sent a gift.'; break; }
    case 'charter:charter': { const p = L.possessions.find(x => x.id === e.payload.pos && x.soldQ === undefined); if (p) { post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'external', recipient: 'founder', category: 'asset_sale', amount: p.price * 0.01, source: src, memo: `Charter income: ${p.name}` }); p.wear = (p.wear ?? 1) * 0.98; } out = 'The yacht was chartered.'; break; }
    case 'reunion:go': L.repMod = clamp(L.repMod + 1, -10, 10); L.wellbeing = clamp(L.wellbeing + 5); out = `Good to see old faces.${addContact(n, 'a reunion') ? ' One new contact.' : ''}`; break;
    case 'succession:name': L.heirId = String(e.payload.emp); n.roster = n.roster.map(x => ({ ...x, morale: clamp(x.morale + (x.id === L.heirId ? 10 : -3)) })); out = 'You named an heir apparent.'; break;
    case 'strain:commit': P('partner').closeness = clamp(P('partner').closeness + 20); L.promises = [...(L.promises ?? []).filter(p => p.q >= n.fund.q), { q: n.fund.q + 1, points: 1, label: `Time at home with ${P('partner').name}` }]; remember('partner', 'you promised more time'); out = 'You promised more time at home.'; break;
    case 'strain:ignore': P('partner').closeness = clamp(P('partner').closeness - 15); L.wellbeing = clamp(L.wellbeing - 10); out = 'Nothing changed at home.'; break;
    default: out = 'No change.';
  }
  e.resolved = choice; e.outcome = out; log(n, `${e.title}: ${out}`);
  return n;
}

// ---------- Close ----------

/**
 * Personal quarter close: open life events take their default, overdue bills then upkeep are paid from personal cash
 * (unpaid stays owed); two short quarters in a row force the sale of the costliest resellable possession.
 * Then wellbeing and relationships drift and at most one new life event opens. Office client effects apply here too.
 */
export function lifeAtClose(n: Career, rand: () => number, closeId: string) {
  n.life = lifeOf(n); const q = n.fund.q;
  // Resolve defaults first and only then take the life reference: each resolution returns a new life object.
  for (const e of openLifeEvents(n)) Object.assign(n, resolveLifeEvent(n, e.id, e.defaultOption));
  const L = n.life!;
  const src = `close:Q${q}:life`;
  payPersonalBills(n, src, closeId);
  const up = owned(n).map(p => ({ p, amt: p.price * (catalogItem(p.itemId)?.upkeep ?? 0) })).filter(x => x.amt > 0.5);
  let short = 0;
  for (const x of up) short += payOrOwePersonal(n, x.amt, 'upkeep', `Upkeep: ${x.p.name}`, src, closeId);
  L.shortQuarters = short > 0.5 || personalOwed(n) > 0.5 ? L.shortQuarters + 1 : 0;
  if (L.shortQuarters >= 2) {
    const sellable = owned(n).filter(p => (catalogItem(p.itemId)?.saleFee ?? 1) < 1).sort((a, b) => b.price * (catalogItem(b.itemId)!.upkeep) - a.price * (catalogItem(a.itemId)!.upkeep));
    if (sellable[0]) {
      const r = sellItem(n, sellable[0].id, true); Object.assign(n, r.c);
      payPersonalBills(n, src, closeId);
      n.notices.push({ q, from: 'Your accountant', subject: `Forced sale: ${sellable[0].name}`, body: 'Two quarters of unpaid personal bills. The sale paid what you owed first.', tone: 'bad' });
      n.life!.shortQuarters = 0;
    }
  }
  const M = n.life!;
  // Venture stakes resolve two years later with a seeded, non-market outcome.
  for (const p of M.possessions.filter(x => x.itemId === 'venture' && x.soldQ === undefined && q - x.boughtQ >= 8)) {
    const mult = [0, 0, 0.3, 1, 4][Math.floor(rand() * 5)];
    if (mult > 0) post(n.journal, { q, date: lbl(n, q), payer: 'external', recipient: 'founder', category: 'asset_sale', amount: p.price * mult, source: `${src}:venture:${p.id}`, memo: `${p.name} returned ${mult}x`, closeId });
    p.soldQ = q; p.salePrice = p.price * mult;
    M.log.push({ q, text: `${p.name}: ${mult === 0 ? 'the company failed' : `returned ${mult}x`}.`, tone: mult >= 1 ? 'good' : 'bad' });
  }
  // Neighbour dispute follow-up refers back to the earlier choice.
  if (M.cooldowns['neighbor_followup'] === q) {
    if (rand() < 0.5) { payOrOwePersonal(n, 50e3, 'life_cost', 'Legal fees: neighbour dispute', src, closeId); M.log.push({ q, text: 'The neighbour dispute you fought cost legal fees.', tone: 'bad' }); }
    else M.log.push({ q, text: 'The neighbour dropped the dispute you fought.', tone: 'good' });
  }
  const pk = perks(n);
  M.wellbeing = clamp(M.wellbeing - 3 - Math.max(0, M.stress - 50) / 10 + pk.rest);
  M.stress = clamp(M.stress + (n.arrears > 0 ? 5 : 0) - 2);
  for (const p of M.people) if (q - p.lastQ > 2) p.closeness = clamp(p.closeness - 3);
  // Office: a better office lifts every client's experience a little.
  const tier = OFFICE_TIERS[M.officeTier];
  if (tier.clientSat > 0) for (const inv of n.fund.investors) if (inv.id !== 'you' && inv.units > 0.01) n.satisfaction[inv.id] = clamp((n.satisfaction[inv.id] ?? 60) + tier.clientSat);
  if (n.status === 'running' && rand() < 0.5) {
    const avail = LIFE_TEMPLATES.filter(t => (M.eventCooldown[t.id] ?? -99) <= q && t.when(n));
    if (avail.length) {
      const t = avail[Math.floor(rand() * avail.length)];
      M.events.push({ id: `life-${q}-${t.id}`, q, template: t.id, ...t.make(n, rand) });
      M.eventCooldown[t.id] = q + 8;
    }
  }
}

// ---------- Office (firm-owned) ----------

export interface OfficeTier { name: string; blurb: string; fitOut: number; rent: number; capacity: number; research: number; clientSat: number }
/** fitOut and rent are multiples of the career's starting office cost. */
export const OFFICE_TIERS: OfficeTier[] = [
  { name: 'Serviced suite', blurb: 'Where you started. Shared reception, no frills.', fitOut: 0, rent: 1, capacity: 10, research: 0, clientSat: 0 },
  { name: 'Full floor', blurb: 'Your own reception, a research room and a proper boardroom.', fitOut: 4, rent: 1.35, capacity: 14, research: 0.05, clientSat: 0 },
  { name: 'Two-floor headquarters', blurb: 'Trading room, quiet floors for analysts, a client lounge.', fitOut: 10, rent: 1.8, capacity: 18, research: 0.1, clientSat: 1 },
  { name: 'Landmark tower floors', blurb: 'An address clients brag about. Rent to match.', fitOut: 24, rent: 2.6, capacity: 24, research: 0.15, clientSat: 1 },
];
export const officeTier = (c: Career) => OFFICE_TIERS[lifeOf(c).officeTier];
/** Research speed bonus from office and founder insight: at most +25%. */
export const researchBonus = (c: Career) => Math.min(0.25, officeTier(c).research + lifeOf(c).insight * 0.02);

export function officeQuote(c: Career, tier: number) {
  const L = lifeOf(c); const t = OFFICE_TIERS[tier];
  return { tier: t, fitOut: tier > L.officeTier ? L.officeBaseQ * (t.fitOut - OFFICE_TIERS[L.officeTier].fitOut) : 0, newRentQ: Math.round(L.officeBaseQ * t.rent) };
}

/** Move office. Upgrades pay a fit-out from firm cash and must leave the firm's reserve intact at the new rent. 4-quarter cooldown. */
export function moveOffice(c: Career, tier: number, reserveAfter: (c: Career) => number, firmCashNow: number): ActionResult {
  const L = lifeOf(c);
  if (!running(c)) return fail(c, 'This career has ended.');
  if (tier < 0 || tier >= OFFICE_TIERS.length || tier === L.officeTier) return fail(c, 'Choose a different office.');
  if (c.fund.q - L.officeChangedQ < 4) return fail(c, `Leases run a year. You can move again in ${4 - (c.fund.q - L.officeChangedQ)} quarter(s).`);
  const qt = officeQuote(c, tier);
  if (tier < L.officeTier && c.roster.length > qt.tier.capacity) return fail(c, `${qt.tier.name} seats ${qt.tier.capacity}; you have ${c.roster.length} staff.`);
  const n = clone(c); n.officeQ = qt.newRentQ;
  if (firmCashNow - qt.fitOut < reserveAfter(n) + c.arrears) return fail(c, `The fit-out costs ${fmt(qt.fitOut)} and the firm must keep ${fmt(reserveAfter(n))} in reserve at the new rent.`);
  if (qt.fitOut > 0) post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'firm', recipient: 'external', category: 'office_upgrade', amount: qt.fitOut, source: `office:${tier}:${n.fund.q}`, memo: `Fit-out: ${qt.tier.name}` });
  n.life!.officeTier = tier; n.life!.officeChangedQ = n.fund.q; n.capacity = Math.max(n.roster.length, qt.tier.capacity);
  n.notices.push({ q: n.fund.q, from: 'Chief operating officer', subject: `Moving to ${qt.tier.name}`, body: `Rent becomes ${fmt(qt.newRentQ)} a quarter from the next close.`, tone: 'neutral' });
  return { c: n, ok: true, message: `Moved to ${qt.tier.name}.` };
}

export function personalForecast(c: Career, horizon = 8, salaryAt: (q: number) => number) {
  let cash = personalCash(c); const up = upkeepQ(c); let owed = personalOwed(c);
  const rows: { q: number; label: string; salary: number; upkeep: number; family: number; cash: number; short: boolean }[] = [];
  for (let k = 1; k <= horizon && c.fund.q + k <= c.fund.quarters; k++) {
    const q = c.fund.q + k; const s = salaryAt(q);
    const family = familyBills(c, q);
    cash += s - up - family - owed; owed = 0;
    const short = cash < 0; if (short) { owed = -cash; cash = 0; }
    rows.push({ q, label: quarterLabel(c.fund, q), salary: s, upkeep: up, family, cash, short });
  }
  return rows;
}

export function fmt(v: number) { const a = Math.abs(v); return a >= 1e9 ? `$${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`; }
