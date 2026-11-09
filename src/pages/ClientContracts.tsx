import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ShieldAlert, Inbox, Lock, Users, Landmark, RotateCcw, Play, CheckCircle2, XCircle, NotebookPen, Flag, Search, X, FastForward, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { CompanyLogo } from '@/components/game/CompanyLogo';
import { BoardPortraits, FundBoard } from '@/components/fund/FundBoard';
import { CareerOpening } from '@/components/firm/CareerOpening';
import { Portrait } from '@/components/firm/Portrait';
import { Logo } from '@/components/firm/Logo';
import { SenderIdentity } from '@/components/firm/SenderIdentity';
import { identityHash } from '@/lib/firm/faces';
import { FundScoreBar } from '@/components/fund/FundScoreBar';
import { FundPerformance, FundAllocation } from '@/components/fund/FundCharts';
import { FundStrategyLab } from '@/components/fund/FundStrategyLab';
import { FundQuarterRecap } from '@/components/fund/FundQuarterRecap';
import { FundResearch } from '@/components/fund/FundResearch';
import { FundBranch } from '@/components/fund/FundBranch';
import { forkFund } from '@/lib/fund/exploration';
import { draftFund } from '@/lib/fund/strategy';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  HARD, SPX, assetName, type Difficulty, type FundState, type Order, type QuarterDecision,
  costLabel, costPerQuarter, currentYear, fundResult, isTradable, nav, netAssets, newFund, normalTargetMultiple, playQuarter,
  payInvestorsNow, raiseCashNow, previewOrders, previewPerformanceFee, quarterLabel, rebalanceOrders, upcomingDue, estimatedDue, FUND_RULES_VERSION,
} from '@/lib/fund/engine';
import { listedCompanies } from '@/lib/fund/market';
import { TIERS, checkTier } from '@/lib/fund/fundraising';
import { useCallback, useRef } from 'react';
import { FirmOnboarding } from '@/components/firm/FirmOnboarding';
import { FirmShell, type FirmTab } from '@/components/firm/FirmShell';
import { type Career, careerFromLegacy, firmCash, forkCareer, founderCash, founderStake, loadCareer, newCareer, saveCareer } from '@/lib/firm/career';
import { toast } from 'sonner';
import { applyFundAction, closeIdFor, closeQuarter } from '@/lib/firm/close';
import { type QuarterPlan, type SaveResult, emptyPlan } from '@/lib/firm/career';
import { type PlannedOrder, plannedOrders, validatePlan, recapFor, isPlanEmpty } from '@/lib/firm/plan';
import { QuarterReview, QuarterRecapDialog, SaveBanner } from '@/components/firm/QuarterReview';
import { QuarterResult } from '@/components/firm/FirmResult';
import { CareerMuseum } from '@/components/firm/FirmMuseum';
import { tradeCareerNow } from '@/lib/firm/trading';
import { boardReview } from '@/lib/fund/board';

const KEY = 'rtr-client-contracts-v2';
const OLD_KEY = 'rtr-client-contracts-v1';
const money = (v: number) => { const a = Math.abs(v); const s = v < 0 ? '−' : ''; if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(2)}T`; if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`; return `${s}$${Math.round(a).toLocaleString('en-US')}`; };
const pct = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`;

function load(): FundState | null { try { const r = localStorage.getItem(KEY); const x = r ? JSON.parse(r) as FundState : null; return x && x.version === FUND_RULES_VERSION ? x : null; } catch { return null; } }
function save(s: FundState | null) { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* ignore */ } }
const hasOldSave = () => { try { return !!localStorage.getItem(OLD_KEY); } catch { return false; } };
function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums truncate ${tone === 'good' ? 'text-gain' : tone === 'bad' ? 'text-loss' : ''}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

function Panel({ title, icon: Icon, children, className = '' }: { title: string; icon: typeof Briefcase; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 border-t border-border py-4 ${className}`} aria-label={title}>
      <h2 className="flex items-center gap-2 text-sm font-semibold mb-3"><Icon className="w-4 h-4 text-primary" aria-hidden="true" />{title}</h2>
      {children}
    </section>
  );
}

/** Trim every holding evenly to raise a small, chosen amount of cash for payments. */
function RaiseCash({ s, due, onRaise }: { s: FundState; due: number; onRaise: (amount: number) => void }) {
  const [custom, setCustom] = useState('');
  const l = s.ledger;
  const liquid = Object.values(l.positions).reduce((a, b) => a + b, 0);
  if (liquid <= 0) return null;
  const size = netAssets(l);
  const gap = Math.max(0, due - l.cash);
  const choices: [string, number][] = [
    ...(gap > 0 ? [[`Cover next quarter · ${money(gap)}`, gap] as [string, number]] : []),
    [`0.5% · ${money(size * 0.005)}`, size * 0.005], [`1% · ${money(size * 0.01)}`, size * 0.01], [`5% · ${money(size * 0.05)}`, size * 0.05],
  ];
  const c = Number(custom.replace(/[^0-9.]/g, '')) || 0;
  return (
    <div className="mb-3 rounded-lg border border-border p-3 space-y-2">
      <p className="text-sm font-medium">Raise cash</p>
      <p className="text-xs text-muted-foreground">Sell a small slice of every holding to free up cash for investor payments. Next quarter you owe about {money(due)}; you have {money(l.cash)}.{gap > 0 ? ' If cash is short when payments are due, the prime broker sells holdings for you automatically.' : ''}</p>
      <div className="flex flex-wrap gap-2">
        {choices.map(([label, v]) => <Button key={label} size="sm" variant={label.startsWith('Cover') ? 'default' : 'outline'} onClick={() => onRaise(v)}>{label}</Button>)}
      </div>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (c > 0) { onRaise(Math.min(c, liquid)); setCustom(''); } }}>
        <Input inputMode="decimal" aria-label="Amount of cash to raise" placeholder="Custom amount, e.g. 25000000" value={custom} onChange={e => setCustom(e.target.value)} className="max-w-xs" />
        <Button type="submit" size="sm" variant="outline" disabled={c <= 0}>Sell</Button>
      </form>
    </div>
  );
}

function Setup({ onStart, saved, onResume, career, onCareer, onResumeCareer, onConvert }: { onStart: (d: Difficulty, years: number) => void; saved: FundState | null; onResume: () => void; career: Career | null; onCareer: () => void; onResumeCareer: () => void; onConvert?: () => void }) {
  const [diff, setDiff] = useState<Difficulty>('normal');
  const [old, setOld] = useState(hasOldSave);
  return (
    <div className="firm-theme min-h-screen">
      <CareerOpening career={career} onStart={onCareer} onResume={onResumeCareer} />
      <section id="classic-fund" aria-label="Classic fund setup" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 scroll-mt-4">
      <div className="flex items-center gap-3"><Logo id="classic-fund" name="Classic Fund" size={40} /><div><h2 className="text-xl font-semibold">Classic fund</h2><p className="text-sm text-muted-foreground">Just you, the portfolio and your investment committee.</p></div></div>
      {onConvert && <div className="space-y-2"><Button variant="outline" onClick={onConvert}>Start a career from this fund</Button><p className="text-xs text-muted-foreground">Converting copies your saved fund into a new career. Your classic save stays playable. Earlier fee income carries over once; no past fees or expenses are added.</p></div>}
      {old && !saved && (
        <div className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>Your earlier fund used the old invented markets and can’t continue in the new game.</p>
          <Button variant="outline" size="sm" onClick={() => { try { localStorage.removeItem(OLD_KEY); } catch { /* ignore */ } setOld(false); }}>Start new fund</Button>
        </div>
      )}
      {saved && saved.status === 'running' && (
        <div className="rounded-lg border border-primary/40 bg-card p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">{saved.fundName} · {quarterLabel(saved, saved.q + 1)} · turn {saved.q + 1}/{saved.quarters} · NAV {nav(saved.ledger).toFixed(2)}</p>
          <Button onClick={onResume}><Play className="w-4 h-4" /> Continue fund</Button>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4" role="radiogroup" aria-label="Difficulty">
        {([['normal', 'Start your fund', '$5 billion in capital · board expects 8% net return each year · 3+ companies · original benchmark objective still applies'], ['hard', 'Take over a broken fund', '$4 billion takeover · 12% annual net-return mandate · 70% in an inherited fallen stock · recover NAV 40 to 120']] as const).map(([d, t, sub]) => (
          <Button variant="outline" key={d} role="radio" aria-checked={diff === d} onClick={() => setDiff(d)}
            className={`h-auto whitespace-normal block text-left rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${diff === d ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'}`}>
            <p className="font-semibold flex items-center gap-2">{d === 'hard' && <ShieldAlert className="w-4 h-4 text-accent" />}{t}</p>
            <p className="text-sm text-muted-foreground mt-1">{sub}</p>
          </Button>
        ))}
      </div>
      <section className="border-y border-border py-5 space-y-4"><h2 className="text-lg font-semibold">Meet your investment committee</h2><BoardPortraits /><p className="text-sm text-muted-foreground">Hold at least 3 companies at 5% or more each, with no company above 40%, by year 1 (year 2 for a takeover). Annual board misses reduce confidence. All capital and people are fictional.</p></section>
      <Button size="lg" onClick={() => onStart(diff, 10)}><Briefcase /> Open the fund</Button>
      <p className="text-xs text-muted-foreground">The classic fund runs 10 years (40 quarters). The start year is picked at random. Every stock follows its real yearly return; only the path inside each year is simulated. Results are unranked practice for now. Investors and letters are fictional; market returns are real history.</p>
      </section>
    </div>
  );
}

function Results({ s, onReplay, onNew, isBranch = false, career = false }: { s: FundState; onReplay: () => void; onNew: () => void; isBranch?: boolean; career?: boolean }) {
  const r = fundResult(s);
  const label = { achieved: 'Fund and board objectives achieved', recovered: 'Recovered — missed the 120 target', survived: 'Survived — fund or board target missed', failed: 'Fund closed' }[r.outcome];
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <p className="text-xs uppercase tracking-[0.25em] text-primary">{s.fundName}{s.practice ? ' · practice replay' : ''}</p>
      <h1 className={`text-3xl font-semibold flex items-center gap-2 ${r.outcome === 'failed' ? 'text-loss' : r.outcome === 'achieved' ? 'text-gain' : ''}`}>
        {r.outcome === 'failed' ? <XCircle className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}{label}
      </h1>
      <p className="text-sm">The real years: <b>{s.startYear}–{s.startYear + s.years - 1}</b>{s.distressed ? ` · inherited stock: ${assetName(s.distressed)}` : ''}</p>
      {r.outcome === 'failed' && <p className="text-sm text-muted-foreground">Closure rules: a payment overdue two quarters running, fund price below 10, or investor confidence at zero while payments are overdue.</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Fund price (NAV)" value={r.nav.toFixed(2)} sub={`from ${s.startNav.toFixed(0)} · target ${r.targetNav.toFixed(0)}`} />
        <Stat label="Net investor return" value={pct(r.netReturn)} tone={r.netReturn >= 0 ? 'good' : 'bad'} />
        <Stat label="vs S&P 500" value={`${pct(r.margin)} pts`} sub={`S&P 500 ${pct(r.benchReturn)}`} tone={r.margin >= 0 ? 'good' : 'bad'} />
        <Stat label="Biggest drawdown" value={`${(r.maxDrawdown * 100).toFixed(1)}%`} sub="per unit, new money excluded" />
        <Stat label="Payments made" value={String(r.paid)} sub={r.shortfall ? `${money(r.shortfall)} still owed` : 'nothing outstanding'} tone={r.shortfall ? 'bad' : 'good'} />
        {r.recoveryProgress !== undefined ? <Stat label="Recovery to 100" value={`${Math.round(Math.max(0, r.recoveryProgress) * 100)}%`} /> : <Stat label="Fund size" value={money(r.aum)} sub="new money is not profit" />}
      </div>
      {s.boardReviews && <FundBoard s={s} final />}
      <FundPerformance s={s} />
      <FundAllocation s={s} />
      <div className="grid sm:grid-cols-2 gap-3">
        {([['Best holdings', r.best, 'text-gain'], ['Worst holdings', r.worst, 'text-loss']] as const).map(([t, list, tone]) => (
          <div key={t} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-semibold mb-2">{t}</p>
            {list.length ? <ul className="space-y-1.5 text-sm">{list.map(x => <li key={x.ticker} className="flex items-center gap-2"><CompanyLogo ticker={x.ticker} companyName={assetName(x.ticker)} /><span className="flex-1 truncate">{assetName(x.ticker)}</span><span className={`tabular-nums ${tone}`}>{money(x.pnl)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">None</p>}
          </div>
        ))}
      </div>
      {!career && <div className="rounded-lg border border-border bg-card p-4 space-y-1">
        <p className="text-sm font-semibold">Your wealth (separate from investor results)</p>
        <p className="text-sm text-muted-foreground tabular-nums">Founder units {money(r.founderEquity)} + fees earned {money(r.managerFees)} = <span className="text-foreground font-semibold">{money(r.managerWealth)}</span></p>
        <p className="text-xs text-muted-foreground">Ranking uses outcome, then net investor return, then lower drawdown. Fund size and fees never raise your rank.</p>
      </div>}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold mb-2">Three decisions that changed the outcome</p>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">{r.consequential.map((c, i) => <li key={i}>{c}</li>)}</ol>
      </div>
      {s.journal.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-2">Your decision journal</p>
          <ul className="space-y-1 text-sm text-muted-foreground">{s.journal.map((j, i) => <li key={i}><span className="text-primary tabular-nums">{quarterLabel(s, j.q)}</span> {j.text}</li>)}</ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!isBranch && <Button onClick={onReplay}><RotateCcw className="w-4 h-4" /> Practice replay (same market)</Button>}
        {!isBranch && <Button variant="outline" onClick={onNew}>New fund</Button>}
        <Button variant="ghost" asChild><Link to="/">Home</Link></Button>
      </div>
    </div>
  );
}

function StockSearch({ s, onPick }: { s: FundState; onPick: (t: string) => void }) {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(8);
  const [sector, setSector] = useState('All');
  const year = currentYear(s);
  const sectors = ['All', ...new Set(listedCompanies(year).map(c => c.sector))];
  const list = useMemo(() => {
    const all = [{ ticker: SPX, name: 'S&P 500 index', sector: 'Index' }, ...listedCompanies(year)];
    const k = q.trim().toLowerCase();
    return all.filter(c => (sector === 'All' || c.sector === sector) && (!k || `${c.ticker} ${c.name}`.toLowerCase().includes(k))).sort((a, b) => a.ticker === SPX ? -1 : b.ticker === SPX ? 1 : a.name.localeCompare(b.name)).slice(0, limit);
  }, [q, year, sector, limit]);
  return (
    <div className="space-y-2">
      <div className="relative"><Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" aria-hidden="true" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${listedCompanies(year).length} listed companies`} aria-label="Search stocks" className="pl-8" /></div>
      <div className="flex gap-1 overflow-x-auto pb-1">{sectors.map(v => <Button key={v} size="sm" variant={sector === v ? 'secondary' : 'ghost'} aria-pressed={sector === v} className="shrink-0 text-xs" onClick={() => { setSector(v); setLimit(8); }}>{v}</Button>)}</div>
      <ul className="grid sm:grid-cols-2 gap-1">
        {list.map(c => (
          <li key={c.ticker}><Button variant="ghost" onClick={() => onPick(c.ticker)} className="h-auto justify-start w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <CompanyLogo ticker={c.ticker} companyName={c.name} /><span className="min-w-0"><span className="block truncate">{c.name}</span><span className="block text-[11px] text-muted-foreground">{c.ticker} · {c.sector}</span></span>
          </Button></li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" onClick={() => setLimit(v => v + 12)} disabled={list.length < limit}>More companies</Button>
    </div>
  );
}

function MandateSummary({ s, onOpen }: { s: FundState; onOpen: () => void }) {
  const r = boardReview(s, false);
  return <section aria-label="Mandate" className="rounded-md border border-border bg-card px-3 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Mandate</span>
    <span className="tabular-nums">{(r.annualTarget * 100).toFixed(0)}% net this year · <b className={r.returnMet ? 'text-gain' : ''}>{(r.netReturn * 100).toFixed(1)}% so far</b></span>
    <span className="text-muted-foreground">Review {quarterLabel(s, r.deadlineQ)}</span>
    <Button size="sm" variant="outline" className="ml-auto" onClick={onOpen}>Open committee</Button>
  </section>;
}

type PlanSetter = (fn: (p: QuarterPlan) => QuarterPlan) => void;
function Game({ s, setS, onBranch, embedded = false, onAdvance, plan, setPlan, ideaOrders = [], dueFn = upcomingDue, onCommittee, onTradeNow, identityCareer }: {
  identityCareer?: Career; s: FundState; setS: (s: FundState) => void; onBranch?: () => void; embedded?: boolean; onAdvance?: () => void;
  /** Career mode: the saved quarter plan. Classic mode keeps its draft locally. */
  plan?: QuarterPlan; setPlan?: PlanSetter; ideaOrders?: PlannedOrder[]; dueFn?: (s: FundState, n: number) => number; onCommittee?: () => void; onTradeNow?: (o: Order) => void;
}) {
  const [localPlan, setLocalPlan] = useState<QuarterPlan>(() => emptyPlan(s.q));
  const p = plan ?? localPlan;
  const update: PlanSetter = setPlan ?? (fn => setLocalPlan(x => fn(x)));
  const orders = p.orders; const accept = p.acceptOfferIds; const journal = p.journal; const sellLocked = p.sellLocked;
  const setOrders = (v: Order[] | ((o: Order[]) => Order[])) => update(x => ({ ...x, orders: typeof v === 'function' ? v(x.orders) : v }));
  const setAccept = (v: (a: string[]) => string[]) => update(x => ({ ...x, acceptOfferIds: v(x.acceptOfferIds) }));
  const setJournal = (v: string) => update(x => ({ ...x, journal: v }));
  const setSellLocked = (v: number) => update(x => ({ ...x, sellLocked: v }));
  const [ticker, setTicker] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [timing, setTiming] = useState<'start' | 'mid'>('start');
  const [instantTrade, setInstantTrade] = useState(true);
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const ticketRef = useRef<HTMLDivElement>(null);
  const pickTicker = (t: string) => { setTicker(t); setWorkspace('trading'); requestAnimationFrame(() => ticketRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })); }; 
  const [workspace, setWorkspace] = useState('trading');
  const [recap, setRecap] = useState(false);
  const [reserveQ, setReserveQ] = useState(3);
  const [watchlist, setWatchlist] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('rtr-fund-watchlist') ?? '[]'); } catch { return []; } });
  const toggleWatch = (t: string) => setWatchlist(list => { const next = list.includes(t) ? list.filter(x => x !== t) : [...list, t]; try { localStorage.setItem('rtr-fund-watchlist', JSON.stringify(next)); } catch { /* ignore */ } return next; });
  const [seenQ, setSeenQ] = useState(s.q);
  useEffect(() => { if (!plan) setLocalPlan(emptyPlan(s.q)); if (s.q > seenQ && !embedded) setRecap(true); setSeenQ(s.q); }, [s.q]); // eslint-disable-line react-hooks/exhaustive-deps
  const ideaPlain: Order[] = ideaOrders.map(o => ({ ticker: o.ticker, amount: o.amount }));
  const ideaBuys = ideaPlain.reduce((a, o) => a + Math.max(0, o.amount), 0);
  const reserveDue = (x: FundState, k: number) => dueFn(x, k) + ideaBuys;

  const l = s.ledger; const n = nav(l);
  const preview = previewOrders(s, [...orders, ...ideaPlain], dueFn);
  const tiers = TIERS.map(t => checkTier(t, s.history, s.fundraising));
  const target = s.difficulty === 'normal' ? s.startNav * normalTargetMultiple(s.startYear, s.years) : HARD.target;
  const due1 = dueFn(s, 1); const cov2Due = dueFn(s, 2); const cov2 = cov2Due <= 0 ? 99 : Math.min(99, l.cash / cov2Due);
  const lastQ = s.history.at(-1);
  const hidden = s.difficulty === 'hard';

  const amt = Number(amount.replace(/[^0-9.]/g, '')) || 0;
  const typed = ticker && amt > 0 && (tradeSide === 'sell' || isTradable(s, ticker)) ? { ticker, amount: tradeSide === 'sell' ? -amt : amt } : null;
  const livePlan = [...(typed ? [...orders.filter(o => o.ticker !== typed.ticker), typed] : orders), ...ideaPlain];
  const liveLedger = livePlan.length ? draftFund(s, livePlan).ledger : l;
  const pv = liveLedger; const previewing = livePlan.length > 0;
  const gross = Math.max(1, pv.cash + pv.locked + Object.values(pv.positions).reduce((a, b) => a + b, 0));
  const holdings = Object.entries(pv.positions).sort((a, b) => b[1] - a[1]);
  const owedNow = l.liabilities.filter(x => !x.paid && x.dueQ <= s.q + 1);
  const owedTotal = owedNow.reduce((a, b) => a + b.amount, 0);
  const payNow = () => { setS(payInvestorsNow(s)); setOrders([]); setAmount(''); };
  const tickerWeight = ticker ? (liveLedger.positions[ticker] ?? 0) / Math.max(1, liveLedger.cash + liveLedger.locked + Object.values(liveLedger.positions).reduce((a, b) => a + b, 0)) : 0;
  const addOrder = (o: Order) => { if (embedded && onTradeNow && instantTrade) { onTradeNow(o); setAmount(''); toast.success('Trade executed at the current mark.'); return; } const x0 = embedded && timing === 'mid' ? { ...o, timing: 'mid' as const } : o; setOrders(x => [...x.filter(y => y.ticker !== o.ticker), x0]); setAmount(''); };
  const run = () => { if (onAdvance) { onAdvance(); return; } setS(playQuarter(s, { orders, acceptOfferIds: accept, sellLocked, journal })); setRecap(true); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); };

  return (
    <div data-investment-desk={embedded ? true : undefined} className={embedded ? 'space-y-5' : 'max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-4'}>
      {!embedded && <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">Rise to Riches</Link>
          <h1 className="text-xl sm:text-2xl font-semibold">{s.fundName}</h1>
          <p className="text-xs text-muted-foreground">{hidden ? 'Hard · takeover' : 'Normal · new fund'} · <b className="text-foreground">{quarterLabel(s, s.q + 1)}</b> · turn {s.q + 1} of {s.quarters} · Objective: fund price {hidden ? `${HARD.target} (recover to 100 first)` : `${target.toFixed(0)} (1.5× the S&P 500’s growth)`}, all payments made</p>
        </div>
      </header>}
      {embedded && <h2 className="text-lg font-semibold">{s.fundName}</h2>}
      <FundScoreBar s={s} />
      {recap && <FundQuarterRecap s={s} onClose={() => setRecap(false)} />}

      <div className={embedded ? 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3' : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2'}>
        <Stat label="Net investor return" value={pct(n / s.startNav - 1)} sub="after fees; deposits excluded" tone={n >= s.startNav ? 'good' : 'bad'} />
        <Stat label="Fund price (NAV)" value={n.toFixed(2)} sub={lastQ ? `last quarter ${pct(lastQ.ret)}` : `start ${s.startNav.toFixed(0)}`} tone={lastQ ? (lastQ.ret >= 0 ? 'good' : 'bad') : undefined} />
        <Stat label="Fund size" value={money(netAssets(l))} sub={`${Math.round(l.units).toLocaleString()} units`} />
        <Stat label="Fee high-water mark" value={l.feeHwm.toFixed(2)} sub={`perf fee if paid now ${money(previewPerformanceFee(l))}`} />
        <Stat label="Cash" value={money(l.cash)} sub={`due next quarter ${embedded ? '≈' : ''}${money(due1)}`} tone={l.cash < due1 ? 'bad' : undefined} />
        <Stat label="Founder equity" value={money(l.founderUnits * n)} sub={`${Math.round(l.founderUnits)} units`} />
        <Stat label={embedded ? 'Fees paid to firm' : 'Fee income'} value={money(l.managerCash)} sub={embedded ? 'all time, goes to firm cash' : 'paid to you'} />

      </div>

      {s.boardReviews && (onCommittee ? <MandateSummary s={s} onOpen={onCommittee} /> : <FundBoard s={s} />)}
      <Tabs value={workspace} onValueChange={setWorkspace}>
        <TabsList className="w-full h-auto grid grid-cols-2 sm:grid-cols-4"><TabsTrigger value="trading" className="text-xs sm:text-sm">Trading desk</TabsTrigger><TabsTrigger value="research" className="text-xs sm:text-sm">Research</TabsTrigger><TabsTrigger value="strategy" className="text-xs sm:text-sm">Strategy lab</TabsTrigger><TabsTrigger value="investors" className="text-xs sm:text-sm">Investors {s.offers.length > 0 ? `(${s.offers.length})` : ''}</TabsTrigger></TabsList>
        <TabsContent value="trading" className="fund-enter space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 min-w-0"><FundPerformance s={s} /></div>

        <Panel title="Quarter briefing" icon={Briefcase}>
          <p className="text-sm">You’re about to trade <b>{quarterLabel(s, s.q + 1)}</b>.</p>
          {lastQ ? <p className="text-xs text-muted-foreground mt-2">Last quarter: fund {pct(lastQ.ret)} vs S&amp;P 500 {pct(lastQ.bench)} · drawdown {(lastQ.drawdown * 100).toFixed(1)}%</p> : <p className="text-xs text-muted-foreground mt-2">No track record yet. Investors are watching your first moves.</p>}
          <p className="text-xs text-muted-foreground mt-1">Cash covers the next 2 quarters of payments {cov2 >= 99 ? 'easily' : `${cov2.toFixed(2)}×`}{embedded ? ' (payouts, fund costs and estimated fees)' : ''}.</p>
          <p className="text-xs text-muted-foreground mt-1">{listedCompanies(currentYear(s)).length} companies are trading this year.</p>
          {s.inbox.at(-1) && <p className="text-xs mt-3 border-l-2 border-primary pl-2">{s.inbox.at(-1)?.subject}</p>}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Panel title="Portfolio" icon={Landmark} className="lg:col-span-3">
          {owedTotal > 0 && (
            <div className="fund-enter mb-3 rounded-lg border border-loss/50 bg-loss/10 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm"><b>{money(owedTotal)}</b> owed {owedNow.some(x => x.dueQ <= s.q) ? 'and overdue' : 'this quarter'} · cash {money(l.cash)}</p>
                <Button size="lg" onClick={payNow}>{l.cash < owedTotal ? `Sell ${money(owedTotal - l.cash)} and pay now` : 'Pay investors now'}</Button>
              </div>
              {l.cash < owedTotal && <p className="text-xs text-muted-foreground">You are {money(owedTotal - l.cash)} short. The button trims every holding by the same share to raise exactly what is missing, then pays.</p>}
            </div>
          )}
          <RaiseCash s={s} due={due1} onRaise={v => { setS(raiseCashNow(s, v)); setOrders([]); setAmount(''); }} />
          {lastQ?.forcedSale && <p className="mb-3 text-xs text-muted-foreground">Last quarter the prime broker sold {money(lastQ.forcedSale)} of holdings to make payments on time.</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead><tr className="text-[11px] uppercase tracking-wider text-muted-foreground text-left"><th className="py-1 font-medium">Holding</th><th className="text-right font-medium">Value</th><th className="text-right font-medium">Weight</th><th className="text-right font-medium">Gain</th><th></th></tr></thead>
              <tbody>
                {holdings.map(([t, v]) => {
                  const basis = s.basis[t] ?? v; const g = basis > 0 ? v / basis - 1 : 0;
                  return (
                    <tr key={t} className="border-t border-border">
                      <td className="py-1.5"><span className="flex items-center gap-2 min-w-0"><CompanyLogo ticker={t} companyName={assetName(t)} /><span className="truncate">{assetName(t)}{t === s.distressed ? ' (inherited)' : ''}</span></span></td>
                      <td className="text-right">{money(v)}</td><td className="text-right">{((v / gross) * 100).toFixed(1)}%</td>
                      <td className={`text-right ${g >= 0 ? 'text-gain' : 'text-loss'}`}>{pct(g)}</td>
                      <td className="text-right"><Button size="sm" variant="ghost" onClick={() => pickTicker(t)}>Trade</Button></td>
                    </tr>
                  );
                })}
                <tr className="border-t border-border"><td className="py-1.5">Cash (earns savings rate){previewing && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">Preview</span>}</td><td className="text-right">{money(pv.cash)}</td><td className="text-right">{((pv.cash / gross) * 100).toFixed(1)}%</td><td></td><td></td></tr>
                {l.locked > 0 && <tr className="border-t border-border"><td className="py-1.5 flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-accent" />Locked legacy deal</td><td className="text-right">{money(l.locked)}</td><td className="text-right">{((l.locked / gross) * 100).toFixed(1)}%</td><td></td><td></td></tr>}
              </tbody>
            </table>
          </div>
          <FundAllocation s={livePlan.length ? draftFund(s, livePlan) : s} pending={livePlan.length > 0} highlight={ticker ?? undefined} />
          <div className="flex flex-wrap gap-2 mt-3">
            <div className="w-full flex flex-wrap items-center gap-3"><span className="text-xs text-muted-foreground">Cash reserve: {reserveQ} quarter{reserveQ === 1 ? '' : 's'} · {money(reserveDue(s, reserveQ))}{embedded ? ' incl. estimated fees and fund costs' : ''}{ideaBuys > 0 ? ' and approved idea buys' : ''}</span><Slider aria-label="Quick mix cash reserve quarters" value={[reserveQ]} min={1} max={8} step={1} onValueChange={([v]) => setReserveQ(v)} className="w-40 max-w-full" /></div>
            <Button size="sm" variant="outline" onClick={() => setOrders(rebalanceOrders(s, 'index', reserveQ, reserveDue))}>All S&amp;P 500</Button>
            <Button size="sm" variant="outline" onClick={() => setOrders(rebalanceOrders(s, 'balanced', reserveQ, reserveDue))}>Half S&amp;P, half my stocks</Button>
            <Button size="sm" variant="outline" onClick={() => setOrders(rebalanceOrders(s, 'cash', reserveQ, reserveDue))}>All cash</Button>
          </div>
          {l.locked > 0 && (
            <div className="mt-3 rounded-lg border border-border p-3 text-sm space-y-2">
              <p className="flex items-center gap-2"><Lock className="w-4 h-4 text-accent" /> Locked legacy deal: {money(l.locked)}. Releases in stages at {s.lockReleaseQs.filter(q => q > s.q).map(q => quarterLabel(s, q)).join(', ') || 'no remaining dates'}. Selling early costs 30%.</p>
              <div className="flex items-center gap-3"><Slider aria-label="Sell locked holding early" value={[sellLocked]} min={0} max={Math.round(l.locked)} step={5000} onValueChange={([v]) => setSellLocked(v)} className="flex-1" /><span className="tabular-nums text-xs w-40 text-right">sell {money(sellLocked)} → {money(sellLocked * 0.7)}</span></div>
            </div>
          )}
        </Panel>

        <div ref={ticketRef} className="lg:col-span-2 min-w-0"><Panel title="Trade ticket" icon={Search}>
          {embedded && onTradeNow && <div className="flex gap-1 mb-3" role="group" aria-label="Trade execution"><Button size="sm" variant={instantTrade ? 'secondary' : 'outline'} aria-pressed={instantTrade} onClick={() => setInstantTrade(true)}>Trade now</Button><Button size="sm" variant={!instantTrade ? 'secondary' : 'outline'} aria-pressed={!instantTrade} onClick={() => setInstantTrade(false)}>Plan for quarter</Button></div>}
          {ticker ? (
            <div key={ticker} className="fund-enter space-y-4">
              <div className="flex items-center gap-3"><CompanyLogo ticker={ticker} companyName={assetName(ticker)} size="lg" /><div className="min-w-0 flex-1"><p className="text-xl font-semibold truncate">{assetName(ticker)}</p><p className="text-xs text-muted-foreground">{ticker === SPX ? 'Index fund' : ticker} · you hold {money(l.positions[ticker] ?? 0)} · cash {money(l.cash)}</p></div><Button size="icon" variant="ghost" aria-label="Close ticket" onClick={() => setTicker(null)}><X className="w-4 h-4" /></Button></div>
              <div className="flex gap-1" role="group" aria-label="Trade side"><Button size="sm" variant={tradeSide === 'buy' ? 'secondary' : 'outline'} aria-pressed={tradeSide === 'buy'} onClick={() => { setTradeSide('buy'); setAmount(''); }}>Buy</Button><Button size="sm" variant={tradeSide === 'sell' ? 'secondary' : 'outline'} aria-pressed={tradeSide === 'sell'} onClick={() => { setTradeSide('sell'); setAmount(''); }}>Sell</Button></div>
              <label htmlFor="amt" className="text-sm text-muted-foreground">Amount in dollars</label>
              <Input id="amt" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000000" className="h-14 text-2xl font-semibold tabular-nums" />
              <Slider aria-label="Share of cash to use" value={[Math.min(100, (tradeSide === 'buy' ? l.cash : l.positions[ticker] ?? 0) > 0 ? Math.round(amt / (tradeSide === 'buy' ? l.cash : l.positions[ticker] ?? 0) * 100) : 0)]} min={0} max={100} step={5} onValueChange={([v]) => setAmount(String(Math.floor((tradeSide === 'buy' ? l.cash : l.positions[ticker] ?? 0) * v / 100)))} />
              <div className="grid grid-cols-4 gap-2">{[0.1, 0.25, 0.5, 1].map(f => <Button key={f} variant="outline" onClick={() => setAmount(String(Math.floor((tradeSide === 'buy' ? l.cash : l.positions[ticker] ?? 0) * f)))}>{f === 1 ? tradeSide === 'buy' ? 'Max cash' : 'Full holding' : `${f * 100}%`}</Button>)}</div>
              {amt > 0 && isTradable(s, ticker) && <p className="fund-enter text-sm rounded-md bg-primary/10 px-3 py-2">{tradeSide === 'buy' ? 'Buying' : 'Selling'} {money(amt)} makes {assetName(ticker)} <b className="text-primary tabular-nums">{(tickerWeight * 100).toFixed(1)}%</b> of your fund. See the allocation chart update live.</p>}
              {embedded && !instantTrade && <div className="flex flex-wrap items-center gap-2 text-xs" role="radiogroup" aria-label="When the order trades"><span className="text-muted-foreground">Trade at</span>{(['start', 'mid'] as const).map(t => <Button key={t} type="button" size="sm" role="radio" aria-checked={timing === t} variant={timing === t ? 'secondary' : 'outline'} onClick={() => setTiming(t)}>{t === 'start' ? 'Start of quarter' : 'Mid-quarter'}</Button>)}<span className="text-muted-foreground">{timing === 'mid' ? 'Executes after the first half of the quarter’s move.' : ''}</span></div>}
              <div className="grid grid-cols-2 gap-2">
                <Button size="lg" className="h-14 text-base" disabled={!amt || (tradeSide === 'buy' ? !isTradable(s, ticker) : !(l.positions[ticker] > 0))} onClick={() => addOrder({ ticker, amount: tradeSide === 'buy' ? amt : -amt })}>{instantTrade && embedded ? tradeSide === 'buy' ? 'Buy now' : 'Sell now' : tradeSide === 'buy' ? 'Plan buy' : 'Plan sell'}</Button>
                <Button size="lg" variant="outline" className="h-14 text-base" disabled={!(l.positions[ticker] > 0)} onClick={() => addOrder({ ticker, amount: 0, sellAll: true })}>Sell all</Button>
              </div>
            </div>
          ) : <StockSearch s={s} onPick={setTicker} />}
          <div className="mt-3 border-t border-border pt-3 space-y-1.5" aria-live="polite">
            <p className="text-xs font-medium">Orders for this quarter</p>
            {ideaOrders.length > 0 && <ul className="space-y-1 text-xs">{ideaOrders.map(o => <li key={o.ideaId ?? o.ticker} className="flex justify-between gap-2"><span className="truncate">{o.label}</span><span className="flex items-center gap-1 tabular-nums">{money(o.amount)}{onCommittee && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={onCommittee}>Committee</Button>}</span></li>)}</ul>}
            {orders.length === 0 && ideaOrders.length === 0 ? <p className="text-xs text-muted-foreground">None. Your holdings ride as they are.</p> : orders.length === 0 ? null : (
              <ul className="space-y-1 text-xs">{orders.map(o => <li key={o.ticker} className="flex justify-between gap-2"><span className="truncate">{o.sellAll ? 'Sell all' : o.amount > 0 ? 'Buy' : 'Sell'} {assetName(o.ticker)}{o.timing === 'mid' ? ' · mid-quarter' : ''}</span><span className="flex items-center gap-1 tabular-nums">{o.sellAll ? money(l.positions[o.ticker] ?? 0) : money(Math.abs(o.amount))}<Button size="icon" variant="ghost" className="h-6 w-6" aria-label={`Remove order ${o.ticker}`} onClick={() => setOrders(x => x.filter(y => y.ticker !== o.ticker))}><X className="w-3 h-3" /></Button></span></li>)}</ul>
            )}
            <p className="text-[11px] text-muted-foreground tabular-nums">Buys {money(preview.buys)} · sells {money(preview.sells)} · cost {money(preview.cost)} · cash after {money(preview.cashAfter)} (covers {preview.coverAfter >= 99 ? 'all' : `${preview.coverAfter.toFixed(2)}×`} of next payments){preview.maxTicker ? ` · biggest stock ${assetName(preview.maxTicker)} ${Math.round(preview.maxWeight * 100)}%` : ''}</p>
          </div>
        </Panel></div>
      </div>

        </TabsContent>
        <TabsContent value="research" className="fund-enter"><FundResearch s={s} watchlist={watchlist} onWatch={toggleWatch} onTrade={t => { setTicker(t); setWorkspace('trading'); }} /></TabsContent>
        <TabsContent value="strategy" className="fund-enter"><FundStrategyLab key={s.q} s={s} orders={orders} onStage={x => { setOrders(x); setWorkspace('trading'); }} /></TabsContent>
        <TabsContent value="investors" className="fund-enter">
      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Fundraising" icon={Users}>
          {s.offers.length > 0 ? (
            <ul className="space-y-3 mb-4">
              {s.offers.map(o => (
                <li key={o.id} className="rounded-lg border border-primary/40 p-3 text-sm space-y-1">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox checked={accept.includes(o.id)} onCheckedChange={c => setAccept(a => (c ? [...a, o.id] : a.filter(x => x !== o.id)))} aria-label={`Accept ${money(o.amount)} from ${o.investor}`} />
                    <>{identityCareer ? <SenderIdentity c={identityCareer} name={o.investor} size={32} /> : <Portrait seed={identityHash(s.investors.find(i => i.name === o.investor)?.id ?? o.id)} name={o.investor} size={32} />}</>
                    <span><b>{o.investor}</b> offers <b className="tabular-nums">{money(o.amount)}</b> ({TIERS.find(t => t.id === o.tierId)?.name ?? 'Investor'})</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground">Terms: locked {o.terms.lockupQ}q · {o.terms.noticeQ}q notice · expects ~{Math.round(o.terms.expectedAnnual * 100)}%/yr · leaves if you trail the S&amp;P 500 {o.terms.triggerLagQ} quarters running. Units issued at {n.toFixed(2)}; this is not profit. The cash arrives before your trades this quarter.</p>
                  <p className="text-[11px] text-muted-foreground">Why now: {o.reason}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground mb-3">{s.fundraising.paused ? `New offers on hold — ${s.fundraising.pausedReason}` : 'No offers this quarter. Keep proving yourself.'}</p>}
          <ul className="space-y-2">
            {tiers.map(t => (
              <li key={t.tier.id} className="text-xs">
                <div className="flex justify-between"><span className={t.unlocked ? 'text-foreground font-medium' : 'text-muted-foreground'}>{t.tier.id}. {t.tier.name}</span><span className="text-muted-foreground">{!t.unlocked ? 'locked' : t.cooling ? 'cooling down' : `${t.checks.filter(c => c.ok).length}/${t.checks.length} met`} · rounds {s.fundraising.rounds[t.tier.id] ?? 0}</span></div>
                {t.unlocked && <p className="text-muted-foreground truncate" title={t.checks.filter(c => !c.ok).map(c => `${c.label}: ${c.detail}`).join('; ')}>{t.checks.filter(c => !c.ok).map(c => c.label).join(', ') || 'All requirements met'}</p>}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Payments & investors" icon={Flag}>
          <ul className="space-y-1.5 text-sm">
            {l.liabilities.filter(x => !x.paid).map(x => <li key={x.id} className="flex justify-between gap-2"><span className="truncate">{x.dueQ <= s.q ? <span className="text-loss">Overdue · </span> : `${quarterLabel(s, x.dueQ)} · `}{x.label}</span><span className="tabular-nums">{money(x.amount)}</span></li>)}
            {s.schedule.filter(r => r.q > s.q).map(r => <li key={r.id} className="flex justify-between gap-2"><span className="truncate">{quarterLabel(s, r.q)} · {r.label}</span><span className="tabular-nums">{money(r.amount)}</span></li>)}
            <li className="flex justify-between gap-2 text-muted-foreground"><span>Every quarter · {costLabel(s).toLowerCase()} + 0.25% fee (estimate)</span><span className="tabular-nums">{money(costPerQuarter(s) + netAssets(l) * 0.0025)}</span></li>
          </ul>
          <p className="text-[11px] text-muted-foreground mt-2">Payments come from cash only. Unpaid payments stay owed; two quarters overdue closes the fund.</p>
          <ul className="space-y-2 text-sm mt-3 border-t border-border pt-3">
            {s.investors.filter(i => i.units > 0.01).map((i, index) => (
              <li key={i.id} className="flex items-start gap-2"><>{identityCareer ? <SenderIdentity c={identityCareer} name={i.name} id={i.id} size={32} /> : <Portrait seed={identityHash(i.id)} name={i.name} size={32} />}</><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><span className="truncate">{i.name} <span className="text-[11px] text-muted-foreground">{i.relation}</span></span><span className="tabular-nums">{money(i.units * n)}</span></div><p className="text-[11px] text-muted-foreground">{i.note}</p></div></li>
            ))}
          </ul>
        </Panel>

        <Panel title="Inbox" icon={Inbox}>
          <ul className="space-y-2 max-h-96 overflow-auto text-sm">
            {[...s.inbox].reverse().slice(0, 14).map((m, i) => (
              <li key={i} className={`border-l-2 pl-2 ${m.tone === 'good' ? 'border-gain' : m.tone === 'bad' ? 'border-loss' : 'border-border'}`}>
                <div className="flex items-center gap-2"><>{identityCareer ? <SenderIdentity c={identityCareer} name={m.from} size={28} /> : /fund|bank|capital|desk|committee|board|broker|office/i.test(m.from) ? <Logo id={`sender:${m.from}`} name={m.from} size={28} /> : <Portrait seed={identityHash(s.investors.find(i => i.name === m.from)?.id ?? m.from)} name={m.from} size={28} />}</><p className="text-[11px] text-muted-foreground">{m.q ? quarterLabel(s, m.q) : 'Day one'} · {m.from}</p></div><p className="font-medium">{m.subject}</p><p className="text-xs text-muted-foreground">{m.body}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
        </TabsContent>
      </Tabs>
      <Panel title="Quarterly checkpoint" icon={NotebookPen}>
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label htmlFor="journal" className="text-xs text-muted-foreground">Decision journal (optional) — why are you positioned this way?</label>
            <Textarea id="journal" value={journal} maxLength={280} onChange={e => setJournal(e.target.value)} rows={2} placeholder="e.g. Keeping cash for investor distributions and going big on my best idea." />
          </div>
          <div className="space-y-2"><p className="text-xs text-muted-foreground">{orders.length + ideaOrders.length} staged orders · {accept.length} investor offers selected{embedded ? (s.practice ? ' · practice, not saved' : ' · saved with your career') : ''}</p><Button size="lg" className="w-full" onClick={run}><FastForward className="w-4 h-4" /> {embedded ? 'Review and close quarter' : 'Simulate next quarter'}</Button>{embedded && orders.length + accept.length + (sellLocked ? 1 : 0) > 0 && <Button variant="ghost" className="w-full" onClick={() => update(x => ({ ...emptyPlan(x.q) }))}>Discard this quarter’s plan</Button>}{onBranch && <Button variant="outline" className="w-full" onClick={onBranch}><GitBranch className="w-4 h-4" />Try a practice branch</Button>}</div>
        </div>
      </Panel>
    </div>
  );
}

/** After a voluntary sale or retirement the fund continues under new owners: show what you actually played, unclassified. */
function HandoverRecord({ c }: { c: Career }) {
  const s = c.fund; const h = s.history; const last = h.at(-1);
  const first = h[0]; const r = fundResult(s);
  const span = first && last ? `${quarterLabel(s, first.q)} to ${quarterLabel(s, last.q)}` : 'No quarters played';
  return <div className="max-w-6xl mx-auto px-4 py-6">
    <details className="rounded-lg border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold min-h-10 flex items-center">Fund handover record (optional)</summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm">{s.fundName} was handed over in {c.ending ? quarterLabel(s, c.ending.q || 1) : '—'} and keeps running under its new {c.ending?.kind === 'retired' || c.ending?.kind === 'died' ? 'leadership' : 'owner'}. This is a handover record, not a final fund result.</p>
        <p className="text-sm">Quarters you ran it: <b>{span}</b> ({h.length} quarter{h.length === 1 ? '' : 's'})</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Fund price (NAV) at handover" value={r.nav.toFixed(2)} sub={`from ${s.startNav.toFixed(0)}`} />
          <Stat label="Net investor return" value={pct(r.netReturn)} tone={r.netReturn >= 0 ? 'good' : 'bad'} />
          <Stat label="vs S&P 500" value={`${pct(r.margin)} pts`} sub={`S&P 500 ${pct(r.benchReturn)}`} tone={r.margin >= 0 ? 'good' : 'bad'} />
          <Stat label="Fund size" value={money(r.aum)} sub="new money is not profit" />
        </div>
      </div>
    </details>
  </div>;
}

function CareerResults({ c, onNew }: { c: Career; onNew: () => void }) {
  return <CareerMuseum c={c} onNew={onNew} />;
}

function CareerMode({ initial, onExit }: { initial: Career; onExit: () => void }) {
  const [c, setC] = useState(initial);
  const [checkpoint, setCheckpoint] = useState<Career | null>(null);
  const [tab, setTab] = useState<FirmTab>('overview');
  const [review, setReview] = useState(false);
  const [recapQ, setRecapQ] = useState<number | null>(null);
  const [resultQ, setResultQ] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [saved, setSaved] = useState<SaveResult>({ ok: true });
  const settled = useRef<string | null>(null);
  // Every change, the quarter plan included, is written to the versioned career save. Practice branches never are.
  useEffect(() => { setSaved(saveCareer(c)); }, [c]);
  const setPlan = useCallback<PlanSetter>(fn => setC(prev => ({ ...prev, plan: fn(prev.plan) })), []);
  const confirmClose = () => {
    const id = closeIdFor(c, c.fund.q + 1);
    if (settled.current === id) return;
    settled.current = id;
    let next: Career;
    try { next = closeQuarter(c); } catch (e) { console.error('Quarter close failed', e); settled.current = null; setReview(false); setClosing(false); toast.error('This quarter could not close. Your game is saved; please try again.'); return; }
    // If nothing settled, allow another try instead of leaving the button dead.
    if (next.fund.q === c.fund.q && next.status === c.status) { settled.current = null; toast.error('This quarter could not close. Please try again.'); }
    setC(next); setReview(false); setClosing(false);
    if (next.fund.q > c.fund.q) setResultQ(next.fund.q);
  };
  /** One click: run the saved plan once (defaults for open choices), save, show a compact result and stay in the workspace. */
  // A double click (or key repeat) within a moment of a close never runs a second quarter.
  const lastSim = useRef(0);
  const simulate = () => { const now = Date.now(); if (closing || now - lastSim.current < 800) return; lastSim.current = now; setClosing(true); confirmClose(); setClosing(false); };
  const recap = recapQ !== null ? recapFor(c, recapQ) : null;
  if (c.status === 'ended') return <>
    <div className="firm-theme pt-6"><CareerResults c={c} onNew={() => { if (checkpoint) { setC(checkpoint); setCheckpoint(null); } else { saveCareer(null); onExit(); } }} /></div>
    {c.ending && c.ending.kind !== 'failed' && c.ending.kind !== 'completed' ? <HandoverRecord c={c} /> : <Results isBranch career s={c.fund} onReplay={() => {}} onNew={() => {}} />}
  </>;
  const banner = <>
    {!saved.ok && <div className="px-3 sm:px-5 pt-3"><SaveBanner error={"error" in saved ? saved.error : ""} career={c} onRetry={() => setSaved(saveCareer(c))} /></div>}
    {checkpoint && <div className="px-3 sm:px-5 pt-3"><FundBranch s={c.fund} checkpoint={checkpoint.fund} onReturn={() => { setC(checkpoint); setCheckpoint(null); }} onRestart={() => setC(forkCareer(checkpoint))} /></div>}
  </>;
  const ideas = plannedOrders(c).filter(o => o.source === 'idea');
  return <>
    <FirmShell c={c} setC={setC} tab={tab} setTab={setTab} closing={closing} onClose={() => setReview(true)} onSimulate={simulate} banner={banner} onExit={onExit}
      result={resultQ !== null ? <QuarterResult c={c} q={resultQ} onDismiss={() => setResultQ(null)} /> : undefined}
      planned={!isPlanEmpty(c.plan) || ideas.length > 0}
      onBranch={!checkpoint && !c.practice ? () => { setCheckpoint(structuredClone(c)); setC(forkCareer(c)); } : undefined}
      investments={<Game key={checkpoint ? 'branch' : 'live'} embedded identityCareer={c} s={c.fund} plan={c.plan} setPlan={setPlan} ideaOrders={ideas} dueFn={estimatedDue}
        onCommittee={() => setTab('committee')} onAdvance={simulate} onTradeNow={o => setC(prev => tradeCareerNow(prev, o))}
        setS={f => setC(prev => applyFundAction(prev, f, 'desk'))} />} />
    <QuarterReview open={review} c={c} issues={validatePlan(c.fund, c.plan).issues} onCancel={() => setReview(false)} onConfirm={confirmClose} onEdit={() => { setReview(false); setTab('investments'); }} />
    <QuarterRecapDialog recap={recap} c={c} onClose={() => setRecapQ(null)} />
  </>;
}

export default function ClientContracts() {
  const [s, setS] = useState<FundState | null>(null);
  const [checkpoint, setCheckpoint] = useState<FundState | null>(null);
  const [saved] = useState(load);
  const [career, setCareer] = useState<Career | null>(null);
  const [savedCareer, setSavedCareer] = useState(loadCareer);
  const [onboarding, setOnboarding] = useState(false);
  const update = (x: FundState | null) => { setS(x); if (!x?.practice) save(x); };
  const exitCareer = () => { setCareer(null); setSavedCareer(loadCareer()); };
  const canConvert = saved && saved.status === 'running' && (saved.capitalScale ?? 1) >= 10_000;
  if (career) return <main className="firm-theme min-h-screen"><CareerMode initial={career} onExit={exitCareer} /></main>;
  if (onboarding) return <main className="firm-theme min-h-screen"><FirmOnboarding onCancel={() => setOnboarding(false)} onStart={o => { const c = newCareer(o); saveCareer(c); setOnboarding(false); setCareer(c); }} /></main>;
  let body: React.ReactNode;
  if (!s) body = <Setup saved={saved} onResume={() => setS(saved)} onStart={(d, years) => update(newFund(d, Math.floor(Math.random() * 1e9), years, false, true))}
    career={savedCareer} onCareer={() => setOnboarding(true)} onResumeCareer={() => savedCareer && setCareer(savedCareer)}
    onConvert={canConvert ? () => { const c = careerFromLegacy(saved!, { firmName: `${saved!.fundName} Management`, hq: 'New York', philosophy: 'diversified' }); saveCareer(c); setCareer(c); } : undefined} />;
  else {
    const branch = checkpoint && <FundBranch s={s} checkpoint={checkpoint} onReturn={() => { setS(checkpoint); setCheckpoint(null); }} onRestart={() => setS(forkFund(checkpoint))} />;
    if (s.status === 'ended') body = <>{branch}<Results isBranch={!!checkpoint} s={s} onReplay={() => { setCheckpoint(null); setS(newFund(s.difficulty, s.seed, s.years, true, !!s.capitalScale)); }} onNew={() => { setCheckpoint(null); if (s.practice) setS(null); else update(null); }} /></>;
    else body = <>{branch}<Game key={checkpoint ? 'branch' : 'live'} s={s} setS={update} onBranch={!checkpoint && !s.practice ? () => { setCheckpoint(structuredClone(s)); setS(forkFund(s)); } : undefined} /></>;
  }
  return (
    <main className="fund-theme min-h-screen">
      {body}
    </main>
  );
}
