// Firm career: wraps the existing fund engine with a management company and
// a founder. The fund book stays in the fund engine (unit NAV); firm and
// founder cash live only in the shared journal.
import { applyFounder, BACKGROUNDS, openingCash, validSetup, type FounderSetup, type FounderState } from './founderSetup';
import { type FundState, type InboxItem, type Order, type Receipt, newFund } from '@/lib/fund/engine';
import type { Lot } from './attribution';
import type { Analysis } from './analysis';
import { nav } from '@/lib/fund/accounting';
import { startingCommitments } from './phase3';
import { type Entity, type Journal, balance, emptyJournal, post } from './journal';
import { type Employee, payroll, startingRoster } from './roster';
import type { ClientFlow, ClientTransfer } from './phase4';
import { type Payable, legacyPayables } from './payables';
import { startingRivalAum } from './phase4';
import type { AcqTarget, CapitalCall, Commitment, Subsidiary } from './phase3';
import type { PressEdition } from './phase5';
import { type LifeState, newLife } from './life';
import type { Ending, Ownership } from './exit';
import type { FormerBusiness } from './business';
import { loanBalanceAt, prehistory } from './business';
import type { Deal } from './deals';
import type { ClientProfile } from './clients';
import type { Governance } from './governance';
import type { Coverage } from './coverage';
import { managerDebtService } from './managerLoans';
import type { ManagerFacility } from './managerLoans';
import type { Empire } from './brand';
import { publicDebtService, type PublicBook } from './publicBook';

/** v2: saved quarter plan, salary history and (new careers) fund-administration-only fund costs. v1 saves load and keep their rules. */
export const CAREER_VERSION = 2;
export const CAREER_KEY = 'rtr-firm-career-v1';

export type Scenario = 'institutional' | 'distressed' | 'boutique';
export type Philosophy = 'concentrated' | 'diversified' | 'defensive';

export interface ScenarioDef {
  label: string; blurb: string; fundSize: number; founderStake: number; firmCash: number; founderCash: number;
  officeQ: number; founderSalaryQ: number; firmSource: string; founderSource: string; fundSource: string;
}

export const SCENARIOS: Record<Scenario, ScenarioDef> = {
  institutional: {
    label: 'Launch an institutional fund', blurb: 'About $5 billion from established anchor investors.',
    fundSize: 5e9, founderStake: 50e6, firmCash: 66e6, founderCash: 2e6, officeQ: 1.5e6, founderSalaryQ: 250e3,
    firmSource: 'Partner capital to launch the management company', founderSource: 'Your personal savings', fundSource: 'Anchor investor commitments',
  },
  distressed: {
    label: 'Take over a distressed fund', blurb: 'Inherit about $4 billion, a concentrated position, a locked sleeve and redemption notices.',
    fundSize: 4e9, founderStake: 20e6, firmCash: 60e6, founderCash: 1.5e6, officeQ: 1.2e6, founderSalaryQ: 200e3,
    firmSource: 'Acquisition working capital for the management company', founderSource: 'Your personal savings', fundSource: 'Inherited investor capital',
  },
  boutique: {
    label: 'Build a boutique', blurb: 'A $400 million fund and a lean team. A longer climb to institutional scale.',
    fundSize: 4e8, founderStake: 8e6, firmCash: 8e6, founderCash: 400e3, officeQ: 150e3, founderSalaryQ: 60e3,
    firmSource: 'Founder seed capital for the management company', founderSource: 'Your personal savings', fundSource: 'Seed investor commitments',
  },
};

export const PHILOSOPHIES: Record<Philosophy, { label: string; mandate: string; blurb: string }> = {
  concentrated: { label: 'Concentrated long-term', blurb: 'A few high-conviction companies held for years.', mandate: 'Clients hired you for conviction. They accept bigger swings in exchange for long-term outperformance.' },
  diversified: { label: 'Diversified equity', blurb: 'Broad exposure across sectors and the index.', mandate: 'Clients expect steady growth that tracks or beats the S&P 500 without dramatic surprises.' },
  defensive: { label: 'Defensive', blurb: 'Capital preservation and reliable payouts first.', mandate: 'Clients value reliable payouts and smaller losses over chasing the market.' },
};

export const HQ_CITIES = ['New York', 'Boston', 'Chicago', 'San Francisco', 'London', 'Singapore'] as const;

export type DecisionKind = 'payroll_shortfall' | 'poach' | 'allocation_review' | 'top_up' | 'board_motion' | 'event' | 'new_client' | 'activist' | 'crisis' | 'governance';
export interface DecisionOption { id: string; label: string; hint: string }
export interface PendingDecision {
  id: string; q: number; kind: DecisionKind; amount: number; text: string; title?: string; from?: string;
  options?: DecisionOption[]; defaultOption?: string; payload?: Record<string, string | number>; resolved?: string; outcome?: string;
}
export interface Idea {
  id: string; q: number; analystId: string; analyst: string; ticker: string; sector: string; thesis: string; conviction: number;
  status: 'pending' | 'approved' | 'rejected'; size?: number; decidedQ?: number; reviewedQ?: number; result?: number; bench?: number;
  /** Delegated ideas: dollars proposed, and dollars actually bought at the close (from the fund's cost basis change). */
  delegated?: boolean; proposed?: number; filled?: number;
  /** Actual attributed holding from execution receipts (manual and delegated ideas). */ lot?: Lot;
  /** Past-only research process behind the pitch. */ analysis?: Analysis;
}
export interface BoardRecord { q: number; motion: string; votes: { name: string; yes: boolean; reason: string }[]; passed: boolean }
/** expenses: every firm operating outflow of the period, founder salary included (older snapshots stored payroll + office only; reports rebuild from the journal). */
export interface Snapshot { q: number; nav: number; aum: number; firmCash: number; founderCash: number; fees: number; expenses: number; unpaid?: number; /** Founder net worth at the close (cash + possessions + fund stake + estimated firm equity − personal debts). */ netWorth?: number }
/** The quarter being planned, saved with the career. q is the fund quarter it was planned at (fund.q). */
export interface QuarterPlan { q: number; orders: Order[]; acceptOfferIds: string[]; sellLocked: number; journal: string }
export interface SalaryChange { atQ: number; effectiveQ: number; fromQ: number; toQ: number }
export const emptyPlan = (q: number): QuarterPlan => ({ q, orders: [], acceptOfferIds: [], sellLocked: 0, journal: '' });

export interface Career {
  version: number; id: string; practice: boolean;
  firmName: string; fundName: string; hq: string; philosophy: Philosophy; scenario: Scenario;
  officeQ: number; founderSalaryQ: number;
  entities: Entity[]; journal: Journal; roster: Employee[];
  fund: FundState;
  /** Last seen cumulative fund fee payments. Each increase posts exactly one fee receipt to the firm. */
  feeCounter: number;
  arrears: number;
  decisions: PendingDecision[]; snapshots: Snapshot[]; notices: InboxItem[];
  /** Per-client satisfaction, reserved for the client relationship system. */
  satisfaction: Record<string, number>;
  /** Phase 2 fields; normalizeCareer fills them for older career saves. */
  ideas: Idea[]; pendingOrders: { ticker: string; amount: number; ideaId?: string }[];
  meetings: Record<string, number>; hiredCandidates: string[]; board: BoardRecord[]; capacity: number;
  status: 'running' | 'ended';
  convertedFromLegacy?: boolean;
  plan: QuarterPlan; salaryHistory: SalaryChange[];
  /** Phase 3: investor commitments and calls, firm-owned businesses and this year's targets. */
  commitments: Commitment[]; calls: CapitalCall[]; subsidiaries: Subsidiary[]; targets: AcqTarget[];
  /** Client relationships: last call quarter, loss warnings, call history, rival pitches. */
  clientCalls: Record<string, number>; warned: Record<string, number>; callLog: { q: number; investorId: string; topic: string; delta: number; reply: string; amount?: number }[];
  pitchQ: number; rivalWins: Record<string, number>; rivalLosses: Record<string, number>; rivalAlerts: Record<string, number>;
  /** Future founder salary steps: from the close of quarter fromQ, pay salaryQ. Applied one close ahead so reviews match settlement. */
  salarySchedule: { fromQ: number; salaryQ: number }[];
  /** Phase 4: every client money movement, rival firm assets and the rival pitch log. */
  flows: ClientFlow[]; rivalAum: Record<string, number>; rivalLog: { q: number; by: string; rival: string; client: string; won: boolean; amount: number }[];
  /** Money moving between rivals and you, pending until it really arrives (see phase4.ts). */
  transfers: ClientTransfer[];
  /** Itemized unpaid firm bills; `arrears` is their total (see payables.ts). */
  payables: Payable[];
  /** Phase 5: newspaper editions (one per close) and the quarter of the last activist campaign. */
  press: PressEdition[]; activistQ: number;
  /** Wealth phase (life.ts, exit.ts): personal life and office, the firm cap table, and the career ending. Filled for older saves. */
  life?: LifeState; ownership?: Ownership; ending?: Ending;
  /** Negotiated deals (businesses and rival managers), archived businesses, rival managers you bought. */
  deals?: Deal[]; formerBusinesses?: FormerBusiness[]; acquiredRivals?: string[];
  /** Persistent client profiles by investor id (and prospect key while an offer is open). */
  clients?: Record<string, ClientProfile>;
  coverage?: Coverage[]; managerFacilities?: ManagerFacility[];
  publicFirm?: PublicBook;
  /** Life and Empire opt-in; absence preserves existing careers until explicit upgrade. */ empire?: Empire;
  /** Phase 2 founder as a person (founder.ts). Absent on older careers until explicitly upgraded. */ founder?: FounderState;
  /** Opt-in autonomous service revenue and stronger competition; legacy saves retain their rules. */ immersion?: boolean;
  /** Accept every client money offer automatically at its saved terms. */ autoAcceptMoney?: boolean;
  /** Constitution, amendments, votes and partner relations. */
  governance?: Governance;
  /** Transient inside closeQuarter only: delegated orders being executed this close. */
  pendingOrdersSnapshot?: { ticker: string; amount: number; ideaId?: string }[];
  /** Bounded log of actual execution receipts (firm careers). */ fills?: Receipt[];
}

export const firmCash = (c: Career) => balance(c.journal, 'firm');
export const founderCash = (c: Career) => balance(c.journal, 'founder');
export const founderStake = (c: Career) => c.fund.ledger.founderUnits * nav(c.fund.ledger);
export const scaleOf = (c: Pick<Career, 'scenario'>) => SCENARIOS[c.scenario].fundSize / 5e9;
/** Known quarterly firm bills: payroll, office, founder salary and every owned business's costs. */
/** Debt service due at the next close on one business's acquisition loan. */
const debtServiceQ = (c: Career, s: Subsidiary) => { const l = s.loan; if (!l) return 0; const b = loanBalanceAt(s, c.fund.q + 1); return b * (l.rateQ + l.penalty) + (c.fund.q + 1 >= l.maturityQ ? b : Math.min(b, l.amortQ)); };
export const quarterlyExpenses = (c: Career) => payroll(c.roster) + c.officeQ + c.founderSalaryQ + (c.subsidiaries ?? []).reduce((a, s) => a + s.costQ + debtServiceQ(c, s), 0) + managerDebtService(c, c.fund.q + 1) + publicDebtService(c, c.fund.q + 1);
/** Quarters of firm bills (payroll, office, founder salary, business costs) kept in reserve before distributions or acquisitions. */
export const RESERVE_QUARTERS = 3;
/** Quarters of bills held in reserve: the constitution's rule, or the default three. */
export const reserveQuartersOf = (c: Pick<Career, 'governance'>) => c.governance?.constitution.reserveQuarters ?? RESERVE_QUARTERS;
export const reserveTarget = (c: Career) => quarterlyExpenses(c) * reserveQuartersOf(c);
/** Founder salary paid at the close of quarter q: the current salary, then any scheduled steps. */
export function salaryAt(c: Pick<Career, 'founderSalaryQ' | 'salarySchedule' | 'fund'>, q: number): number {
  let s = c.founderSalaryQ;
  for (const x of [...(c.salarySchedule ?? [])].sort((a, b) => a.fromQ - b.fromQ)) if (x.fromQ <= q) s = x.salaryQ;
  return s;
}
export const runwayQuarters = (c: Career) => { const e = quarterlyExpenses(c); return e > 0 ? firmCash(c) / e : 99; };

const ENTITIES = (firmName: string, fundName: string): Entity[] => [
  { id: 'fund', name: fundName, kind: 'fund', ownerId: 'investors' },
  { id: 'firm', name: firmName, kind: 'firm', ownerId: 'founder' },
  { id: 'founder', name: 'You', kind: 'person' },
  { id: 'investors', name: 'Fund investors', kind: 'investor' },
  { id: 'external', name: 'Outside parties', kind: 'external' },
];

/** Move founder units to the requested dollar value, trading units with the largest other investor. NAV and total units are unchanged. */
export function setFounderStake(f: FundState, dollars: number) {
  const l = f.ledger; const n = nav(l); if (n <= 0) return;
  const target = dollars / n;
  let you = f.investors.find(i => i.id === 'you');
  if (!you) { you = { id: 'you', name: 'You (managing partner)', relation: 'Founder', units: 0, joinedQ: 0, lockupUntilQ: 999, note: '' }; f.investors.unshift(you); }
  const other = f.investors.filter(i => i.id !== 'you').sort((a, b) => b.units - a.units)[0];
  const diff = target - l.founderUnits;
  if (!other || other.units < diff) return;
  other.units -= diff; you.units = target; l.founderUnits = target;
  you.note = `Your co-investment. Worth about $${Math.round(dollars / 1e6)}M at launch. Not spendable cash.`;
}

/** Scale every dollar amount and unit in a fund; NAV per unit is unchanged. */
function rescaleFund(f: FundState, k: number) {
  const l = f.ledger;
  l.cash *= k; l.locked *= k; l.units *= k; l.founderUnits *= k;
  for (const t of Object.keys(l.positions)) l.positions[t] *= k;
  for (const t of Object.keys(f.basis)) f.basis[t] *= k;
  for (const i of f.investors) i.units *= k;
  for (const r of f.schedule) r.amount *= k;
  f.capitalScale = (f.capitalScale ?? 1) * k;
}

export interface CareerOptions { firmName: string; fundName: string; hq: string; philosophy: Philosophy; scenario: Scenario; years: number; seed: number; /** Character creation (Phase 2). Omitted by older callers and tests. */ founder?: FounderSetup }

export function newCareer(o: CareerOptions): Career {
  const def = SCENARIOS[o.scenario];
  const fund = newFund(o.scenario === 'distressed' ? 'hard' : 'normal', o.seed, o.years, false, true);
  if (o.scenario === 'boutique') rescaleFund(fund, def.fundSize / 5e9);
  fund.fundName = o.fundName;
  fund.costRule = 'fund_admin'; fund.receipts = []; fund.clientFees = { contracts: {}, charges: [] };
  fund.newsFromYear = fund.startYear;
  setFounderStake(fund, def.founderStake);
  fund.inbox = [{ q: 0, from: 'Chief operating officer', subject: 'Your mandate', body: `${PHILOSOPHIES[o.philosophy].mandate} ${fund.inbox[0]?.body ?? ''}`, tone: 'neutral' }];
  const c = baseCareer(o, fund, def);
  c.immersion = true;
  c.empire = { version: 1, phase: 1, brands: {} };
  c.commitments = startingCommitments(c);
  const date = 'Opening';
  post(c.journal, { q: 0, date, payer: 'external', recipient: 'firm', category: 'opening', amount: def.firmCash, source: 'open:firm', memo: def.firmSource });
  const fs = o.founder && !validSetup(o.founder) ? o.founder : undefined;
  if (fs) applyFounder(c, fs, false, def.founderCash);
  post(c.journal, { q: 0, date, payer: 'external', recipient: 'founder', category: 'opening', amount: openingCash(def.founderCash, fs?.background), source: 'open:founder', memo: fs ? `${def.founderSource} (${BACKGROUNDS[fs.background].label})` : def.founderSource });
  return c;
}

function baseCareer(o: Omit<CareerOptions, 'years'>, fund: FundState, def: ScenarioDef): Career {
  const roster = startingRoster(o.seed, o.scenario, o.philosophy);
  return {
    version: CAREER_VERSION, id: `career-${o.seed}`, practice: false,
    firmName: o.firmName, fundName: fund.fundName, hq: o.hq, philosophy: o.philosophy, scenario: o.scenario,
    officeQ: def.officeQ, founderSalaryQ: def.founderSalaryQ,
    entities: ENTITIES(o.firmName, fund.fundName), journal: emptyJournal(), roster, fund,
    feeCounter: fund.ledger.managerCash, arrears: 0, decisions: [], snapshots: [], notices: [],
    satisfaction: Object.fromEntries(fund.investors.map(i => [i.id, 60])), status: fund.status === 'ended' ? 'ended' : 'running',
    ideas: [], pendingOrders: [], meetings: {}, hiredCandidates: [], board: [], capacity: 10,
    plan: emptyPlan(fund.q), salaryHistory: [],
    commitments: [], calls: [], subsidiaries: [], targets: [],
    clientCalls: {}, warned: {}, callLog: [], pitchQ: -1, rivalWins: {}, rivalLosses: {}, rivalAlerts: {}, salarySchedule: [], flows: [], rivalAum: startingRivalAum({ fund }), rivalLog: [], transfers: [], payables: [], press: [], activistQ: -99,
    life: newLife(o.seed, def.officeQ),
  };
}

/**
 * Start a separate career from a legacy fund save. The fund is copied unchanged.
 * Earlier fee cash becomes one labelled carryover entry; no fees or expenses are invented for past quarters.
 */
export function careerFromLegacy(legacy: FundState, o: { firmName: string; hq: string; philosophy: Philosophy }): Career {
  const fund: FundState = structuredClone(legacy);
  fund.practice = false;
  const scenario: Scenario = fund.difficulty === 'hard' ? 'distressed' : (fund.capitalScale ?? 1) >= 10_000 ? 'institutional' : 'boutique';
  const def = SCENARIOS[scenario];
  const c = baseCareer({ ...o, fundName: fund.fundName, scenario, seed: fund.seed }, fund, def);
  c.id = `career-${fund.seed}-from-q${fund.q}`;
  c.convertedFromLegacy = true;
  c.feeCounter = fund.ledger.managerCash;
  const date = `Conversion at quarter ${fund.q}`;
  post(c.journal, { q: fund.q, date, payer: 'external', recipient: 'firm', category: 'carryover', amount: fund.ledger.managerCash, source: 'convert:fees', memo: 'Prior manager earnings, carried over' });
  post(c.journal, { q: fund.q, date, payer: 'external', recipient: 'firm', category: 'opening', amount: def.firmCash, source: 'convert:firm', memo: def.firmSource });
  post(c.journal, { q: fund.q, date, payer: 'external', recipient: 'founder', category: 'opening', amount: def.founderCash, source: 'convert:founder', memo: def.founderSource });
  return c;
}

/** A practice copy of the entire career: fund, firm, founder and journal. Never saved. */
export function forkCareer(c: Career): Career {
  const x: Career = structuredClone(c);
  x.practice = true; x.fund.practice = true;
  return x;
}

/** Fill fields added after a career was saved, without changing any balance. v1 careers keep their fund cost rules. */
export function normalizeCareer(c: Career): Career {
  c.ideas ??= []; c.pendingOrders ??= []; c.meetings ??= {}; c.hiredCandidates ??= []; c.board ??= []; c.capacity ??= 10;
  c.satisfaction ??= {}; c.salaryHistory ??= []; c.commitments ??= []; c.calls ??= []; c.subsidiaries ??= []; c.targets ??= [];
  c.clientCalls ??= {}; c.warned ??= {}; c.callLog ??= []; c.pitchQ ??= -1; c.rivalWins ??= {}; c.rivalLosses ??= {}; c.rivalAlerts ??= {}; c.salarySchedule ??= []; c.flows ??= []; c.rivalAum ??= startingRivalAum(c); c.rivalLog ??= []; c.transfers ??= []; c.payables ??= legacyPayables(c); c.press ??= []; c.activistQ ??= -99;
  c.life ??= newLife(c.fund.seed, c.officeQ);
  if (!Array.isArray(c.fund.receipts)) c.fund.receipts = []; c.fills ??= [];
  c.deals ??= []; c.formerBusinesses ??= []; c.acquiredRivals ??= []; c.clients ??= {};
  for (const x of [...c.subsidiaries, ...c.targets]) x.history ??= prehistory(x.id, x.kind, x.revenueQ, x.costQ, x.multiple);
  if (!c.plan || c.plan.q !== c.fund.q) c.plan = emptyPlan(c.fund.q);
  c.plan.orders ??= []; c.plan.acceptOfferIds ??= []; c.plan.sellLocked ??= 0; c.plan.journal ??= '';
  for (const i of c.fund.investors) c.satisfaction[i.id] ??= 60;
  c.roster = c.roster.map((e, k) => ({ ...e, ability: e.ability ?? 65, potential: e.potential ?? Math.min(100, (e.ability ?? 65) + 10), level: e.level ?? (k < 2 ? 3 : 2), joinedQ: e.joinedQ ?? 0, assignment: e.assignment ?? null, progress: e.progress ?? 0 }));
  if (c.founder) { const f = c.founder; f.children ??= []; f.exes ??= []; f.events ??= []; f.eventCooldown ??= {}; f.seq ??= 0; f.warned ??= 0; f.highStressQ ??= 0; f.startQ ??= 0; f.romance ??= { partnerId: null, status: 'single', sinceQ: c.fund.q }; }
  c.version = CAREER_VERSION;
  return c;
}

export function parseCareer(raw: string | null): Career | null {
  if (!raw) return null;
  try { const x = JSON.parse(raw) as Career; return x && (x.version === 1 || x.version === CAREER_VERSION) && x.fund && x.journal ? normalizeCareer(x) : null; } catch { return null; }
}
export function loadCareer(): Career | null {
  try { return parseCareer(localStorage.getItem(CAREER_KEY)); } catch { return null; }
}
export type SaveResult = { ok: true } | { ok: false; error: string };
/** Practice careers are never saved. Returns a failure instead of swallowing it, so the UI can offer retry or export. */
export function saveCareer(c: Career | null, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): SaveResult {
  if (c?.practice) return { ok: true };
  try {
    if (!storage) return { ok: false, error: 'Browser storage is not available.' };
    if (c) storage.setItem(CAREER_KEY, JSON.stringify(c)); else storage.removeItem(CAREER_KEY);
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error && /quota/i.test(e.name + e.message) ? 'Browser storage is full.' : 'The browser refused to save.' }; }
}
