import { CareerMasthead } from './CareerMasthead';
import { BrandStudio } from './BrandStudio';
import { CareerSection as Section } from './CareerSection';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Store, Swords, TrendingUp, Gavel, BarChart3, Briefcase, Building2, CalendarDays, ChevronDown, FastForward, GitBranch, Inbox, LayoutDashboard, LogOut, Handshake, MoreHorizontal, Users, UserRound, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FundPerformance } from '@/components/fund/FundCharts';
import { FundBoard } from '@/components/fund/FundBoard';
import { nav, netAssets } from '@/lib/fund/accounting';
import { costLabel, quarterLabel } from '@/lib/fund/engine';
import { type Career, PHILOSOPHIES, firmCash, founderCash, founderStake, quarterlyExpenses, runwayQuarters } from '@/lib/firm/career';
import { RESERVE_QUARTERS, acceptAllMoney, distribute, maxDistribution, moneyOffers, openDecisions, reserveTarget, setAutoAccept } from '@/lib/firm/close';
import { Switch } from '@/components/ui/switch';
import { briefing } from '@/lib/firm/briefing';
import { entriesFor, totalOf, type Txn } from '@/lib/firm/journal';
import { type Bridge, CATEGORY_LABEL, type CalcLine, bridges, fundCalc, periodOf, quarterEstimate } from '@/lib/firm/plan';
import { payroll } from '@/lib/firm/roster';
import { Portrait } from './Portrait';
import buildingImage from '@/assets/hedge-fund-headquarters.jpg';
import { PrestigeBar } from './PrestigeBar';
import { OwnShares } from './OwnShares';
import { SalaryControl } from './SalaryControl';
import { SalarySchedule } from './SalarySchedule';
import { cashForecast } from '@/lib/firm/forecast';
import { expectedContributions } from '@/lib/firm/phase4';
import { Deals } from './FirmDeals';
import { FirmCompanies } from './FirmCompanies';
import { FirmGovernance } from './FirmGovernance';
import { FirmClients } from './FirmClients';
import { FirmPress } from './FirmPress';
import { Clients, Committee, DecisionList, Team } from './FirmPeople';
import { FirmForecast } from './FirmForecast';
import { FirmLife, LIFE_TABS, type LifeTab } from './FirmLife';
import { lifeOf, openLifeEvents } from '@/lib/firm/life';
import { constitutionIssues, executionNotes, plannedOrders } from '@/lib/firm/plan';
import { governanceOf } from '@/lib/firm/governance';
const pendingVote = (c: Career) => governanceOf(c).amendments.some(a => a.status === 'pending' && a.voteQ <= c.fund.q + 1);
import { firmMoney as money, firmPct as pct } from './format';
import { investorDemand } from '@/lib/firm/demand';
import { clientFeeEstimate } from '@/lib/firm/fees';
import { managerDebtService } from '@/lib/firm/managerLoans';
import { Logo } from './Logo';
import { SenderIdentity } from './SenderIdentity';
import { brandVariant, upgradeEmpire } from '@/lib/firm/brand';

export type FirmTab = 'overview' | 'investments' | 'committee' | 'clients' | 'book' | 'deals' | 'companies' | 'governance' | 'team' | 'firm' | 'wealth' | 'press';
/** Workspaces group related tabs; each keeps its own last tab. */
const GROUPS: { id: string; label: string; icon: typeof Briefcase; tabs: { id: FirmTab; label: string }[] }[] = [
  { id: 'office', label: 'Office', icon: LayoutDashboard, tabs: [{ id: 'overview', label: 'Overview' }, { id: 'companies', label: 'Companies & deals' }, { id: 'governance', label: 'Partners & headquarters' }] },
  { id: 'invest', label: 'Investments', icon: BarChart3, tabs: [{ id: 'investments', label: 'Portfolio' }, { id: 'committee', label: 'Research & committee' }] },
  { id: 'people', label: 'People', icon: Users, tabs: [{ id: 'team', label: 'Team & hiring' }, { id: 'book', label: 'Clients & rivals' }] },
  { id: 'life', label: 'My Life', icon: Wallet, tabs: [{ id: 'wealth', label: 'My Life' }] },
  { id: 'books', label: 'Books & news', icon: Building2, tabs: [{ id: 'firm', label: 'Books, forecast & news' }] },
];
const destination = (t: FirmTab): FirmTab => t === 'deals' ? 'companies' : t === 'clients' ? 'book' : t === 'press' ? 'firm' : t;
const groupOf = (t: FirmTab) => GROUPS.find(g => g.tabs.some(x => x.id === destination(t))) ?? GROUPS[0];
const NAV: { id: FirmTab; label: string; icon: typeof Briefcase }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'investments', label: 'Investments', icon: BarChart3 },
  { id: 'committee', label: 'Committee', icon: Gavel },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'deals', label: 'Capital & deals', icon: Handshake },
  { id: 'team', label: 'Team', icon: UserRound },
  { id: 'firm', label: 'Firm', icon: Building2 },
  { id: 'wealth', label: 'My Wealth', icon: Wallet },
];
const MOBILE: FirmTab[] = ['overview', 'investments', 'firm', 'wealth'];

const tierOf = (aum: number) => (aum < 1e9 ? 'boutique' : aum < 1e10 ? 'established' : 'global');

/** A calculation shown behind a headline number: journal entries for firm/personal cash, or itemised lines for fund figures. */
type Calc = { title: string; explain: string; entity?: string; lines?: CalcLine[] } | null;

export function FirmShell({ c, setC, tab, setTab, investments, onClose, onSimulate, closing, onBranch, banner, onExit, planned = false, result }: {
  c: Career; setC: (c: Career) => void; tab: FirmTab; setTab: (t: FirmTab) => void; investments: ReactNode;
  onClose: () => void; onSimulate: () => void; closing: boolean; onBranch?: () => void; banner?: ReactNode; onExit: () => void; planned?: boolean; result?: ReactNode;
}) {
  const [lifeTab, setLifeTab] = useState<LifeTab>('wealth');
  const lastIn = useRef<Record<string, FirmTab>>({});
  const [inbox, setInbox] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [more, setMore] = useState(false);
  const [brandStudio, setBrandStudio] = useState(false);
  const [calc, setCalc] = useState<Calc>(null);
  const scrolls = useRef<Partial<Record<FirmTab, number>>>({});
  const f = c.fund; const aum = netAssets(f.ledger);
  // Each section keeps its own scroll position; a first visit starts at the top.
  const go = (t: FirmTab) => { scrolls.current[tab] = window.scrollY; lastIn.current[groupOf(tab).id] = tab; setTab(destination(t)); setMore(false); };
  const goGroup = (gid: string) => { const g = GROUPS.find(x => x.id === gid); if (!g) return; go(lastIn.current[gid] && lastIn.current[gid] !== tab ? lastIn.current[gid] : g.tabs[0].id); };
  const group = groupOf(tab);
  useEffect(() => { window.scrollTo({ top: scrolls.current[tab] ?? 0, behavior: 'instant' as ScrollBehavior }); }, [tab]);
  const messages = [...f.inbox, ...c.notices].sort((a, b) => b.q - a.q).slice(0, 30);
  const pending = openDecisions(c).length + (f.offers.length ? 1 : 0);
  const est = quarterEstimate(c, 1);

  return (
    <div className="firm-scene min-h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0" data-tier={tierOf(aum)} data-office={lifeOf(c).officeTier}>
      <div className="lg:grid lg:grid-cols-[15rem_1fr] min-h-screen">
        <aside className="career-sidebar hidden lg:flex flex-col gap-1 border-r border-border p-4 sticky top-0 h-screen">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground mb-3">Rise to Riches</Link>
          <div className="flex items-center gap-2"><Logo id="firm" name={c.firmName} variant={brandVariant(c, 'firm')} stage={c.ownership?.ipo?.stage === 'listed' ? 5 : aum >= 1e10 ? 4 : 2} /><p className="font-semibold leading-tight break-words" title={c.firmName}>{c.firmName}</p></div>
          <p className="text-xs text-muted-foreground mb-4">{c.hq} · {PHILOSOPHIES[c.philosophy].label}</p>
          <nav aria-label="All career sections" className="overflow-y-auto space-y-3">{GROUPS.map(g => <div key={g.id}><p className="text-[10px] uppercase text-muted-foreground px-2 mb-1 flex items-center gap-2"><g.icon className="w-3 h-3" />{g.label}</p>{(g.id === 'life' ? LIFE_TABS.map(t => ({ id: 'wealth' as FirmTab, label: t.label, life: t.id })) : g.tabs.map(t => ({ ...t, life: undefined }))).map(t => <Button key={t.label} size="sm" variant={tab === t.id && (!t.life || lifeTab === t.life) ? 'secondary' : 'ghost'} aria-current={tab === t.id && (!t.life || lifeTab === t.life) ? 'page' : undefined} className="career-nav-item justify-start w-full text-sm min-h-10 h-auto whitespace-normal text-left py-2" onClick={() => { go(t.id); if (t.life) setLifeTab(t.life); }}>{t.label}</Button>)}</div>)}</nav>
          <div className="mt-auto space-y-1 border-t border-border pt-3">
            <Button variant="ghost" className="justify-start w-full" onClick={() => setBrandStudio(true)}><Building2 className="w-4 h-4" />Brand studio</Button>
            {onBranch && <Button variant="ghost" className="justify-start w-full" onClick={onBranch}><GitBranch className="w-4 h-4" />Practice branch</Button>}
            <Button variant="ghost" className="justify-start w-full" onClick={onExit}><LogOut className="w-4 h-4" />Leave office</Button>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-border bg-background px-3 sm:px-5 py-2.5">
            <div className="mx-auto max-w-7xl flex flex-wrap items-center gap-1 sm:gap-2">
              <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                <div className="flex items-center gap-2"><span className="lg:hidden"><Logo id="firm" name={c.firmName} variant={brandVariant(c, 'firm')} size={28} /></span><p className="text-sm font-semibold truncate" title={c.firmName}>{c.firmName}{c.practice ? ' · practice' : ''}</p></div>
                <p className="text-xs text-muted-foreground truncate"><b className="text-foreground">{quarterLabel(f, f.q + 1)}</b> · quarter {f.q + 1} of {f.quarters}{planned ? ' · plan saved' : ''}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="All sections" onClick={() => setMore(true)}><MoreHorizontal className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Calendar" onClick={() => setCalendar(true)}><CalendarDays className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" aria-label={`Inbox, ${messages.length} messages`} onClick={() => setInbox(true)}><Inbox className="w-4 h-4" /></Button>
              <Button variant="outline" onClick={onClose} disabled={closing || c.status === 'ended'} className="shrink-0 hidden sm:inline-flex">Review plan</Button>
              <Button onClick={onSimulate} disabled={closing || c.status === 'ended'} aria-busy={closing} className="shrink-0"><FastForward className="w-4 h-4" /><span className="hidden sm:inline">{closing ? 'Simulating…' : 'Simulate quarter'}</span><span className="sm:hidden">{closing ? '…' : 'Simulate'}</span></Button>
              {onBranch && <Button size="icon" variant="ghost" className="lg:hidden" aria-label="Practice branch" onClick={onBranch}><GitBranch className="w-4 h-4" /></Button>}
              <Button size="icon" variant="ghost" className="lg:hidden" aria-label="Leave office" onClick={onExit}><LogOut className="w-4 h-4" /></Button>
            </div>
          </header>
          <PlanStrip c={c} onReview={onClose} />
          {!c.empire && c.status === 'running' && <div className="px-3 sm:px-5 py-3 border-b border-border flex flex-wrap items-center gap-3"><p className="text-xs text-muted-foreground">Life and Empire: save company brands and unlock company-funded rebranding. Your balances and history stay unchanged.</p><Button size="sm" variant="outline" onClick={() => setC(upgradeEmpire(c))}>Upgrade this career</Button></div>}
          {banner && <div className="mx-auto max-w-7xl">{banner}</div>}
          {result && <div className="mx-auto max-w-7xl px-3 sm:px-5 pt-3">{result}</div>}
          {group.tabs.length > 1 && <div role="tablist" aria-label={`${group.label} tabs`} className="mx-auto max-w-7xl px-3 sm:px-5 pt-4 flex flex-wrap gap-1">{group.tabs.map(t => <Button key={t.id} role="tab" aria-selected={tab === t.id} size="sm" variant={tab === t.id ? 'secondary' : 'ghost'} className="min-h-9" onClick={() => go(t.id)}>{t.label}</Button>)}</div>}
          <main className="career-content px-3 sm:px-5 py-5 mx-auto max-w-7xl" data-workspace={tab}>
            <CareerMasthead c={c} section={tab} />
            {tab === 'overview' && <Overview c={c} setC={setC} go={go} onCalc={setCalc} goLife={(t: LifeTab) => { go('wealth'); setLifeTab(t); }} />}
            <div className={tab === 'investments' ? '' : 'hidden'}><OwnShares c={c} setC={setC} />{investments}</div>
            {tab === 'committee' && <div className="space-y-4">{f.boardReviews && <FundBoard s={f} />}<Committee c={c} setC={setC} /></div>}
            {tab === 'clients' && <Clients c={c} setC={setC} onOffers={() => go('investments')} />}
            {tab === 'deals' && <Deals c={c} setC={setC} />}
            {tab === 'companies' && <div className="space-y-5"><FirmCompanies c={c} setC={setC} /><details className="border-t border-border py-4"><summary className="cursor-pointer font-medium">Capital calls & commitments</summary><div className="pt-4"><Deals c={c} setC={setC} /></div></details></div>}
            {tab === 'governance' && <FirmGovernance c={c} setC={setC} />}
            {tab === 'book' && <div className="space-y-5"><FirmClients c={c} setC={setC} /><details open className="border-t border-border py-4"><summary className="cursor-pointer font-medium">Calls, investor offers & winning rivals' clients</summary><div className="pt-4"><Clients c={c} setC={setC} onOffers={() => go('investments')} /></div></details></div>}
            {tab === 'team' && <Team c={c} setC={setC} />}
            {tab === 'firm' && <div className="space-y-5"><FirmBooks c={c} onCalc={setCalc} /><FirmPress c={c} setC={setC} /></div>}
            {tab === 'wealth' && <FirmLife c={c} setC={setC} tab={lifeTab} setTab={setLifeTab} />}
            {tab === 'press' && <FirmPress c={c} setC={setC} />}
          </main>
        </div>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card grid grid-cols-5 pb-[env(safe-area-inset-bottom)]" aria-label="Firm workspaces">
        {GROUPS.map(g => <Button key={g.id} variant="ghost" className={`h-14 flex-col gap-0.5 rounded-none text-[11px] px-1 ${group.id === g.id ? 'text-primary' : ''}`} aria-current={group.id === g.id ? 'page' : undefined} onClick={() => goGroup(g.id)}><g.icon className="w-4 h-4" /><span className="truncate max-w-full">{g.label.replace('Books & news', 'Books').replace('Investments', 'Invest')}</span></Button>)}
      </nav>

      <Sheet open={more} onOpenChange={setMore}><SheetContent side="bottom" className="firm-theme max-h-[85vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]"><SheetHeader><SheetTitle>All sections</SheetTitle></SheetHeader><Button variant="outline" className="mt-4" onClick={() => { setMore(false); setBrandStudio(true); }}><Building2 className="w-4 h-4" />Brand studio</Button><div className="grid sm:grid-cols-2 gap-4 mt-4">{GROUPS.map(g => <div key={g.id}><h3 className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><g.icon className="w-4 h-4" />{g.label}</h3><div className="flex flex-wrap gap-1">{g.id === 'life' ? LIFE_TABS.map(t => <Button key={t.id} size="sm" variant="outline" onClick={() => { go('wealth'); setLifeTab(t.id); }}>{t.label}</Button>) : g.tabs.map(t => <Button key={t.id} size="sm" variant="outline" onClick={() => go(t.id)}>{t.label}</Button>)}</div></div>)}</div></SheetContent></Sheet>

      <Sheet open={brandStudio} onOpenChange={setBrandStudio}><SheetContent className="firm-theme overflow-y-auto sm:max-w-lg"><SheetHeader><SheetTitle>Brand studio</SheetTitle></SheetHeader><BrandStudio c={c} setC={setC} /></SheetContent></Sheet>

      <Sheet open={inbox} onOpenChange={setInbox}><SheetContent className="firm-theme overflow-y-auto"><SheetHeader><SheetTitle>Inbox</SheetTitle></SheetHeader>
        <ul className="space-y-3 mt-4 text-sm">{messages.map((m, i) => <li key={i} className={`border-l-2 pl-2 ${m.tone === 'good' ? 'border-gain' : m.tone === 'bad' ? 'border-loss' : 'border-border'}`}><div className="flex items-center gap-2"><SenderIdentity c={c} name={m.from} /><p className="text-[11px] text-muted-foreground">{m.q ? quarterLabel(f, m.q) : 'Day one'} · {m.from}</p></div><p className="font-medium">{m.subject}</p><p className="text-xs text-muted-foreground">{m.body}</p></li>)}</ul>
      </SheetContent></Sheet>

      <Sheet open={calendar} onOpenChange={setCalendar}><SheetContent className="firm-theme overflow-y-auto"><SheetHeader><SheetTitle>Calendar</SheetTitle></SheetHeader>
        <h3 className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">{quarterLabel(f, f.q + 1)} · fund pays</h3>
        <ul className="space-y-1.5 mt-1 text-sm">{est.fund.map((x, i) => <li key={i} className="flex justify-between gap-2"><span>{x.label}{x.basis === 'estimate' ? ' (est.)' : ''}</span><span className="tabular-nums">{money(x.amount)}</span></li>)}</ul>
        <h3 className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">{quarterLabel(f, f.q + 1)} · firm pays</h3>
        <ul className="space-y-1.5 mt-1 text-sm">{est.firmOut.map((x, i) => <li key={i} className="flex justify-between gap-2"><span>{x.label}</span><span className="tabular-nums">{money(x.amount)}</span></li>)}</ul>
        <h3 className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Later</h3>
        <ul className="space-y-1.5 mt-1 text-sm">
          {f.ledger.liabilities.filter(x => !x.paid && x.dueQ > f.q + 1).map(x => <li key={x.id} className="flex justify-between gap-2"><span>{quarterLabel(f, x.dueQ)} · {x.label}</span><span className="tabular-nums">{money(x.amount)}</span></li>)}
          {f.schedule.filter(r => r.q > f.q + 1).map(r => <li key={r.id} className="flex justify-between gap-2"><span>{quarterLabel(f, r.q)} · {r.label}</span><span className="tabular-nums">{money(r.amount)}</span></li>)}
          {[4, 8, 12].map(k => { const q = Math.ceil((f.q + 1) / 4) * 4 + k - 4; return q <= f.quarters ? <li key={k} className="text-muted-foreground">{quarterLabel(f, q)} · annual board review and performance fee</li> : null; })}
        </ul>
      </SheetContent></Sheet>

      <CalcDialog c={c} calc={calc} onClose={() => setCalc(null)} />
    </div>
  );
}

function Stat({ label, value, sub, tone, onOpen, big }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad'; onOpen?: () => void; big?: boolean }) {
  const body = <><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p><p className={`${big ? 'text-2xl' : 'text-xl'} font-semibold tabular-nums break-words ${tone === 'good' ? 'text-gain' : tone === 'bad' ? 'text-loss' : ''}`}>{value}</p>{sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}</>;
  return onOpen
    ? <Button variant="outline" onClick={onOpen} className="h-auto block text-left whitespace-normal career-stat px-3 py-3.5 min-w-0 hover:bg-secondary" aria-label={`${label}: ${value}. How was this calculated?`}>{body}</Button>
    : <div className="career-stat rounded-md border border-border px-3 py-3.5 min-w-0">{body}</div>;
}



function Overview({ c, setC, go, onCalc, goLife }: { c: Career; setC: (c: Career) => void; go: (t: FirmTab) => void; onCalc: (x: Calc) => void; goLife: (t: LifeTab) => void }) {
  const [allBrief, setAllBrief] = useState(false);
  const f = c.fund; const coo = c.roster[0] ?? { name: 'Your desk', role: 'Founder', seed: c.fund.seed };
  const est = quarterEstimate(c, 1);
  const owed = est.fundTotal;
  const decisions = openDecisions(c);
  const pendingIdeas = c.ideas.filter(i => i.status === 'pending').length;
  const nextRed = f.schedule.find(r => r.q > f.q);
  const lowest = [...c.roster].sort((a, b) => a.morale - b.morale)[0];
  const lines = briefing(c);
  const ordered = [...lines.filter(b => b.tone === 'bad'), ...lines.filter(b => b.tone !== 'bad')];
  const shown = allBrief ? ordered : ordered.slice(0, 3);
  const n = nav(f.ledger);
  const dueLines: CalcLine[] = [...est.fund.map(x => ({ label: `Fund · ${x.label}${x.basis === 'estimate' ? ' (est.)' : ''}`, amount: money(x.amount), note: x.note })), { label: 'Fund total', amount: money(est.fundTotal), total: true },
    ...est.firmOut.map(x => ({ label: `Firm · ${x.label}`, amount: money(x.amount) })), { label: 'Firm total', amount: money(est.firmOutTotal), total: true }];
  return (
    <div className="space-y-4 fund-enter">


      <PrestigeBar c={c} />
      <nav aria-label="Quick moves" className="flex flex-wrap gap-2">
        {c.ownership?.ipo?.stage === 'listed' ? <Button size="sm" variant="outline" onClick={() => goLife('ownership')}><TrendingUp className="w-4 h-4" />Sell or buy shares</Button> : <Button size="sm" variant="outline" onClick={() => goLife('ownership')}><TrendingUp className="w-4 h-4" />Take the firm public</Button>}
        <Button size="sm" variant="outline" onClick={() => go('book')}><Swords className="w-4 h-4" />Win clients from rivals</Button>
        <Button size="sm" variant="outline" onClick={() => go('companies')}><Store className="w-4 h-4" />Buy a business</Button>
        <Button size="sm" variant="outline" onClick={() => goLife('wealth')}><Crown className="w-4 h-4" />Rich list</Button>
      </nav>
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <Stat big label="Fund AUM" value={money(netAssets(f.ledger))} sub="net assets; new money is not profit" onOpen={() => onCalc({ title: 'Fund AUM', explain: 'Fund assets at today\'s mark less unpaid liabilities. From the fund ledger, not the firm journal.', lines: fundCalc(f, 'aum') })} />
        <Stat big label="Net investor return" value={pct(n / f.startNav - 1)} sub={`NAV ${n.toFixed(2)} per unit, after fees`} tone={n >= f.startNav ? 'good' : 'bad'} onOpen={() => onCalc({ title: 'Net investor return', explain: 'Per-unit NAV growth since launch.', lines: fundCalc(f, 'return') })} />
        <Stat label="Due next quarter" value={money(owed)} sub={`fund, incl. est. fees · firm ${money(est.firmOutTotal)}`} tone={f.ledger.cash < owed ? 'bad' : undefined} onOpen={() => onCalc({ title: `Due in ${quarterLabel(f, f.q + 1)}`, explain: 'Known payouts and liabilities, plus fund costs and fees estimated at today\'s fund size. Fund and firm pay from separate cash.', lines: dueLines })} />
        <Stat label="Firm cash" value={money(firmCash(c))} sub={`${runwayQuarters(c).toFixed(1)} quarters of bills with no fees`} onOpen={() => onCalc({ title: 'Firm cash', entity: 'firm', explain: 'Opening capital plus fees received, minus payroll, office, your salary and distributions.' })} />
        <Stat label="Personal cash" value={money(founderCash(c))} sub="yours to spend" onOpen={() => onCalc({ title: 'Personal cash', entity: 'founder', explain: 'Savings plus salary and distributions, minus anything you put into the firm.' })} />
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_22rem] gap-4 items-start">
        <p className="xl:col-span-2 text-xs text-muted-foreground tabular-nums">Management fees next quarter: {money(clientFeeEstimate(c))} from fund assets on invested balances · conditional closing contributions {money(expectedContributions(c).reduce((a, x) => a + x.amount, 0))}, increasing the following quarter's fee base · manager loan service {money(managerDebtService(c, f.q + 1))} from firm cash.</p>
        <div className="min-w-0 py-4"><FundPerformance s={f} /></div>
        <div className="space-y-4 min-w-0">
          <Section title={`${coo.name}, ${coo.role.toLowerCase()}`}>
            <div className="flex gap-3"><Portrait seed={coo.seed} name={coo.name} size={40} />
              <div className="min-w-0 space-y-1.5">
                <ul className="space-y-1.5 text-sm">{shown.map((b, i) => <li key={i} className={b.tone === 'bad' ? 'text-loss' : b.tone === 'good' ? 'text-gain' : ''}>{b.text}</li>)}</ul>
                {ordered.length > 3 && <Button size="sm" variant="ghost" className="px-0 h-7" aria-expanded={allBrief} onClick={() => setAllBrief(x => !x)}><ChevronDown className={`w-4 h-4 transition-transform ${allBrief ? 'rotate-180' : ''}`} />{allBrief ? 'Show less' : `${ordered.length - 3} more`}</Button>}
              </div></div>
          </Section>
          <Section title="Needs your decision" action={<label className="flex items-center gap-2 text-xs"><Switch checked={!!c.autoAcceptMoney} onCheckedChange={v => setC(setAutoAccept(c, v))} aria-label="Auto-accept client money" />Auto-accept client money</label>}>
            {decisions.length === 0 && pendingIdeas === 0 && f.offers.length === 0 && owed <= f.ledger.cash ? <p className="text-sm text-muted-foreground">Nothing urgent. Review your portfolio, then simulate the quarter.</p> : (
              <ul className="space-y-3 text-sm">
                {moneyOffers(c).length > 1 && <li className="flex flex-wrap items-center justify-between gap-2"><span>{moneyOffers(c).length} clients want to give you money.</span><Button size="sm" onClick={() => setC(acceptAllMoney(c))}>Accept all</Button></li>}
                {decisions.length > 0 && <li><DecisionList c={c} setC={setC} /></li>}
                {pendingIdeas > 0 && <li className="flex flex-wrap items-center justify-between gap-2"><span>{pendingIdeas} idea{pendingIdeas > 1 ? 's' : ''} waiting for the committee.</span><Button size="sm" variant="outline" onClick={() => go('committee')}>Open committee</Button></li>}
                {f.offers.length > 0 && <li className="flex flex-wrap items-center justify-between gap-2"><span>{f.offers.length} investor offer{f.offers.length > 1 ? 's' : ''} expire at close.</span><Button size="sm" variant="outline" onClick={() => go('investments')}>Review offers</Button></li>}
                {owed > f.ledger.cash && <li className="flex flex-wrap items-center justify-between gap-2"><span>Fund cash is short of next quarter's payments.</span><Button size="sm" variant="outline" onClick={() => go('investments')}>Raise cash</Button></li>}
              </ul>)}
          </Section>
        </div>
      </div>
      <section className="border-y border-border py-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">{investorDemand(c).qualified ? 'Investors are asking for an allocation' : 'Your investor following'}</h2><p className="text-xs text-muted-foreground">{investorDemand(c).qualified ? `Both recent years beat the S&P 500 by at least 10 percentage points. ${c.decisions.filter(d => !d.resolved && (d.kind === 'new_client' || d.kind === 'top_up')).length} money offers await your decision.` : 'Positive S&P-relative results bring inbound offers; a sustained strong record makes investors seek you out.'}</p></div><Button size="sm" variant="outline" onClick={() => go('book')}>Clients & rivals</Button></section>
      <FirmPress c={c} />
      <NextQuarters c={c} go={go} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Section title="Team" action={<Button size="sm" variant="ghost" onClick={() => go('team')}>Open</Button>}><div className="flex flex-wrap gap-2 mb-3">{c.roster.slice(0, 5).map(e => <SenderIdentity key={e.id} c={c} name={e.name} id={e.id} size={36} />)}</div><p className="text-sm">{c.roster.length} staff · payroll {money(payroll(c.roster))} a quarter.</p><p className="text-xs text-muted-foreground mt-1">{lowest ? `Lowest morale: ${lowest.name} (${lowest.morale}).` : 'No employees hired yet.'}</p></Section>
        <Section title="Clients" action={<Button size="sm" variant="ghost" onClick={() => go('clients')}>Open</Button>}><div className="flex flex-wrap gap-2 mb-3">{f.investors.filter(i => i.id !== 'you' && i.units > 0.01).slice(0, 5).map(i => <SenderIdentity key={i.id} c={c} name={i.name} id={i.id} size={36} />)}</div><p className="text-sm">{f.investors.filter(i => i.units > 0.01 && i.id !== 'you').length} investors · confidence {Math.round(f.confidence)}.</p><p className="text-xs text-muted-foreground mt-1">{nextRed ? `Next payout: ${nextRed.label}, ${money(nextRed.amount)} in ${quarterLabel(f, nextRed.q)}.` : 'No scheduled payouts ahead.'}</p></Section>
      </div>
    </div>
  );
}

function NextQuarters({ c, go }: { c: Career; go: (t: FirmTab) => void }) {
  const rows = cashForecast(c).rows.slice(0, 4);
  const inflow = expectedContributions(c).reduce((a, x) => a + x.amount, 0);
  if (!rows.length) return null;
  return <Section title="Next four quarters" action={<Button size="sm" variant="ghost" onClick={() => go('firm')}>Full forecast</Button>}>
    <p className="text-xs text-muted-foreground mb-2">Client contributions expected next close: <span className="text-gain tabular-nums">+{money(inflow)}</span> into the fund (not counted below).</p>
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{rows.map(r => <li key={r.q} className={`rounded-md border p-3 text-sm tabular-nums ${r.short ? 'border-loss/60' : 'border-border'}`}>
      <p className="font-medium">{r.label}{r.short ? <span className="text-loss"> · short</span> : r.belowReserve ? <span className="text-loss"> · below reserve</span> : null}</p>
      <div className="mt-2 rounded bg-muted/40 px-2 py-1.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fund size</p><p className="text-base">{money(r.aum)}</p></div>
      <div className="mt-1.5 rounded bg-muted/40 px-2 py-1.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Firm cash after</p><p className={`text-base ${r.short ? 'text-loss' : ''}`}>{money(r.cash)}</p></div>
      <p className="mt-1.5 text-xs text-muted-foreground flex justify-between gap-3"><span>Fees in</span><span className="text-gain">+{money(r.fees)}</span></p>
      <p className="text-xs text-muted-foreground flex justify-between gap-3"><span>Staff services</span><span className="text-primary">+{money(r.staff)}</span></p>
      <p className="text-xs text-muted-foreground flex justify-between gap-3"><span>Bills + salary</span><span>−{money(r.core + r.salary)}</span></p>
    </li>)}</ul>
  </Section>;
}

function BridgeView({ b }: { b: Bridge }) {
  const opsOut = b.outflows.filter(x => x.category !== 'distribution' && x.category !== 'partner_distribution' && x.category !== 'acquisition');
  const finIn = b.inflows.filter(x => x.category !== 'fee_receipt' && x.category !== 'divestiture');
  return <ul className="text-sm space-y-0.5 tabular-nums">
    <li className="flex justify-between gap-3"><span>Opening cash</span><span>{money(b.opening)}</span></li>
    {b.fees > 0 && <li className="flex justify-between gap-3 text-gain"><span>+ Fees received</span><span>{money(b.fees)}</span></li>}
    {opsOut.map(x => <li key={x.category} className="flex justify-between gap-3"><span>− {CATEGORY_LABEL[x.category]}</span><span>{money(x.amount)}</span></li>)}
    {finIn.map(x => <li key={x.category} className="flex justify-between gap-3"><span>+ {CATEGORY_LABEL[x.category]}</span><span>{money(x.amount)}</span></li>)}
    {b.investingNet !== 0 && <li className="flex justify-between gap-3"><span>{b.investingNet >= 0 ? '+' : '−'} Business purchases and sales (investing)</span><span>{money(Math.abs(b.investingNet))}</span></li>}
    {b.financingOut > 0 && <li className="flex justify-between gap-3"><span>− Distributions to owners</span><span>{money(b.financingOut)}</span></li>}
    <li className="flex justify-between gap-3 border-t border-border pt-1 font-semibold"><span>{b.closed ? 'Closing cash' : 'Cash so far'}</span><span>{money(b.closing)}</span></li>
    {b.unpaid > 0 && <li className="flex justify-between gap-3 text-loss"><span>Unpaid back pay (owed, not cash)</span><span>{money(b.unpaid)}</span></li>}
    <li className="text-[11px] text-muted-foreground">{b.reconciles ? 'Reconciles to the journal.' : 'Does not reconcile; please report this.'}</li>
  </ul>;
}

function FirmBooks({ c, onCalc }: { c: Career; onCalc: (x: Calc) => void }) {
  const list = [...bridges(c, 'firm')].reverse();
  const [open, setOpen] = useState<number | null>(list[0]?.q ?? null);
  return (
    <div className="space-y-4 fund-enter">
      <h2 className="text-lg font-semibold break-words">{c.firmName}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Stat label="Firm cash" value={money(firmCash(c))} onOpen={() => onCalc({ title: 'Firm cash', entity: 'firm', explain: 'Every entry paid into or out of the management company.' })} />
        <Stat label="Fees received" value={money(totalOf(c.journal, 'fee_receipt'))} sub="all time" />
        <Stat label="Bills a quarter" value={money(quarterlyExpenses(c))} sub="payroll, office, your salary" />
        <Stat label="Runway" value={`${runwayQuarters(c).toFixed(1)} qtrs`} sub={c.arrears > 0 ? `${money(c.arrears)} unpaid bills owed` : 'with no new fees'} tone={runwayQuarters(c) < 3 || c.arrears > 0 ? 'bad' : undefined} />
      </div>
      <p className="text-xs text-muted-foreground">The fund pays {costLabel(c.fund).toLowerCase()} itself{c.fund.costRule === 'fund_admin' ? ' (0.02% of net assets a quarter)' : ', under the classic fund rules this career was converted with'}. Staff and office are paid by the firm.</p>
      <FirmForecast c={c} />
      <Section title="Firm cash by quarter">
        <p className="text-xs text-muted-foreground mb-3">Cash basis: opening cash, plus money in, minus money out, equals closing cash. Founder salary is an operating expense; distributions and your injections are owner financing. This is not accrual profit.</p>
        <ul className="space-y-2">{list.slice(0, 16).map(b => {
          const ops = b.outflows.filter(x => x.category !== 'distribution' && x.category !== 'acquisition').reduce((a, x) => a + x.amount, 0) - b.inflows.filter(x => x.category === 'subsidiary_revenue').reduce((a, x) => a + x.amount, 0);
          return <li key={b.q} className="rounded-md border border-border">
            <button type="button" className="w-full grid grid-cols-2 sm:grid-cols-[8rem_repeat(4,minmax(0,1fr))] gap-x-3 gap-y-1 p-3 text-left text-sm tabular-nums hover:bg-secondary rounded-md" aria-expanded={open === b.q} onClick={() => setOpen(open === b.q ? null : b.q)}>
              <span className="font-medium col-span-2 sm:col-span-1">{b.label}</span>
              <span><span className="block text-[10px] uppercase text-muted-foreground">Fees in</span><span className="text-gain">{money(b.fees)}</span></span>
              <span><span className="block text-[10px] uppercase text-muted-foreground">Operating out, net</span>{money(ops)}</span>
              <span><span className="block text-[10px] uppercase text-muted-foreground">Financing + investing</span>{money(b.financingIn - b.financingOut + b.investingNet)}</span>
              <span><span className="block text-[10px] uppercase text-muted-foreground">Closing</span>{money(b.closing)}</span>
            </button>
            {open === b.q && <div className="px-3 pb-3"><BridgeView b={b} /></div>}
          </li>;
        })}</ul>
      </Section>
      <Section title="Journal"><JournalTable txns={[...c.journal.txns].reverse().slice(0, 40)} c={c} /></Section>
      {c.salaryHistory.length > 0 && <Section title="Salary changes"><ul className="text-sm space-y-1">{[...c.salaryHistory].reverse().map((x, i) => <li key={i} className="flex justify-between gap-2 tabular-nums"><span>Effective {quarterLabel(c.fund, x.effectiveQ)} close</span><span>{money(x.fromQ)} → {money(x.toQ)} a quarter</span></li>)}</ul></Section>}
    </div>
  );
}

function Wealth({ c, setC, onCalc }: { c: Career; setC: (c: Career) => void; onCalc: (x: Calc) => void }) {
  const [amt, setAmt] = useState('');
  const max = maxDistribution(c);
  const v = Number(amt.replace(/[^0-9.]/g, '')) || 0;
  return (
    <div className="space-y-4 fund-enter">
      <h2 className="text-lg font-semibold">My Wealth</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Stat label="Personal cash" value={money(founderCash(c))} sub="spendable" onOpen={() => onCalc({ title: 'Personal cash', entity: 'founder', explain: 'Savings plus salary and distributions, minus money you put into the firm.' })} />
        <Stat label="Stake in the fund" value={money(founderStake(c))} sub="fund units, not spendable" onOpen={() => onCalc({ title: 'Stake in the fund', explain: 'Your units times NAV per unit.', lines: [...fundCalc(c.fund, 'nav'), { label: 'Your units', amount: Math.round(c.fund.ledger.founderUnits).toLocaleString('en-US') }, { label: 'Stake = your units × NAV', amount: money(founderStake(c)), total: true }] })} />
        <Stat label="Net worth" value={money(founderCash(c) + founderStake(c))} sub="cash + fund stake" />
        <Stat label="Salary + distributions" value={money(totalOf(c.journal, 'salary') + totalOf(c.journal, 'distribution'))} sub="all time" />
      </div>
      <Section title="Your salary"><SalaryControl key={`${c.fund.q}-${c.founderSalaryQ}`} c={c} setC={setC} /><SalarySchedule c={c} setC={setC} /></Section>
      <Section title="Take a distribution from the firm">
        <p className="text-xs text-muted-foreground mb-2">You can take up to {money(max)}. The firm keeps {RESERVE_QUARTERS} quarters of bills ({money(reserveTarget(c))}) in reserve and pays back pay first. Paid now, recorded as owner financing.</p>
        <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); if (v > 0) { setC(distribute(c, v)); setAmt(''); } }}>
          <Input inputMode="decimal" aria-label="Distribution amount" placeholder="Amount in dollars" value={amt} onChange={e => setAmt(e.target.value)} className="w-56" />
          <Button type="submit" disabled={v <= 0 || max <= 0}>Distribute</Button>
          <Button type="button" variant="outline" disabled={max <= 0} onClick={() => setAmt(String(Math.floor(max)))}>Maximum</Button>
        </form>
      </Section>
      <Section title="Personal history"><JournalTable txns={[...entriesFor(c.journal, 'founder')].reverse()} c={c} /></Section>
    </div>
  );
}

function JournalTable({ txns, c }: { txns: Txn[]; c: Career }) {
  const when = (t: Txn) => { const q = periodOf(t); return t.closeId ? `${quarterLabel(c.fund, q)} close` : q <= 0 || /^(open|convert):/.test(t.source) ? t.date : `During ${quarterLabel(c.fund, q)}`; };
  if (!txns.length) return <p className="text-sm text-muted-foreground">No entries yet.</p>;
  return <ul className="text-xs tabular-nums divide-y divide-border">{txns.map(t => <li key={t.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[9rem_10rem_1fr_auto] gap-x-3 py-1.5">
    <span className="text-muted-foreground">{when(t)}</span><span className="text-right sm:text-left sm:order-none order-2 text-muted-foreground">{t.payer} → {t.recipient}</span>
    <span className="col-span-1">{CATEGORY_LABEL[t.category]}: {t.memo}</span><span className="text-right font-medium">{money(t.amount)}</span>
  </li>)}</ul>;
}

function CalcDialog({ c, calc, onClose }: { c: Career; calc: Calc; onClose: () => void }) {
  const txns = calc?.entity ? entriesFor(c.journal, calc.entity) : [];
  const total = txns.reduce((a, t) => a + (t.recipient === calc?.entity ? t.amount : -t.amount), 0);
  return (
    <Dialog open={!!calc} onOpenChange={o => !o && onClose()}>
      <DialogContent className="firm-theme max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>How was this calculated? {calc?.title}</DialogTitle><DialogDescription>{calc?.explain}</DialogDescription></DialogHeader>
        {calc?.lines && <ul className="text-sm tabular-nums">{calc.lines.map((l, i) => <li key={i} className={`flex justify-between gap-3 py-1 ${l.total ? 'border-t border-border font-semibold' : ''}`}><span className="min-w-0">{l.label}{l.note && <span className="block text-[11px] text-muted-foreground font-normal">{l.note}</span>}</span><span className="shrink-0">{l.amount}</span></li>)}</ul>}
        {calc?.entity && <><JournalTable txns={[...txns].reverse()} c={c} /><p className="text-sm font-semibold tabular-nums">Total: {money(total)} from {txns.length} entries</p></>}
      </DialogContent>
    </Dialog>
  );
}

/** Always-visible summary of what Simulate quarter will do: planned orders, defaults for open choices, and cash risks. */
function PlanStrip({ c, onReview }: { c: Career; onReview: () => void }) {
  if (c.status !== 'running') return null;
  const orders = plannedOrders(c); const decs = openDecisions(c); const life = openLifeEvents(c);
  const est = quarterEstimate(c, 1); const fundShort = c.fund.ledger.cash < est.fundTotal; const firmShort = firmCash(c) < est.firmOutTotal;
  const buys = orders.filter(o => o.amount > 0).reduce((a, o) => a + o.amount, 0);
  return <div className="border-b border-border bg-muted/30 px-3 sm:px-5 py-2"><p className="mx-auto max-w-7xl text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5" aria-label="What Simulate quarter will do">
    <span>{orders.length ? `${orders.length} order${orders.length > 1 ? 's' : ''} planned${buys ? ` (buys ${money(buys)})` : ''}` : 'No trades planned'}</span>
    {decs.length + life.length > 0 && <span>{decs.length + life.length} open choice{decs.length + life.length > 1 ? 's' : ''} take their stated default</span>}
    {fundShort && <span className="text-loss">Fund cash {money(c.fund.ledger.cash)} is below {money(est.fundTotal)} due; holdings will be sold to pay</span>}
    {firmShort && <span className="text-loss">Firm cash may not cover {money(est.firmOutTotal)} of bills; the rest stays owed</span>}
    {constitutionIssues(c).map(x => <span key={x} className="text-primary">{x}</span>)}
    {pendingVote(c) && <span>Owners vote on a rule change at this close</span>}
    {executionNotes(c).map((x, i) => <span key={`ex${i}`}>Last close: {x.ticker} {money(x.filled)} of {money(x.requested)} ({x.note})</span>)}
    <Button variant="link" size="sm" className="min-h-6 h-auto py-0 px-0 text-xs" onClick={onReview}>Review plan</Button>
  </p></div>;
}
