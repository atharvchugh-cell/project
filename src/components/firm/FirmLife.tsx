import { CareerSection as Section } from './CareerSection';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { quarterLabel } from '@/lib/fund/engine';
import { type Career, founderStake, reserveTarget } from '@/lib/firm/career';
import { RESERVE_QUARTERS, distribute, maxDistribution } from '@/lib/firm/close';
import { entriesFor } from '@/lib/firm/journal';
import { firmCash } from '@/lib/firm/career';
import {
  CATALOG, type ItemKind, LIFE_ACTIONS, OFFICE_TIERS, buyItem, catalogItem, cooldownLeft, lifeAction, lifeOf, marketValue, moveOffice, netWorth, officeQuote,
  openLifeEvents, owned, perks, personalCash, reputation, resaleValue, resolveLifeEvent, sellItem, statusScore, timeBudget, timeLeft, upkeepQ,
  promisedTime,
} from '@/lib/firm/life';
import { acceptPartner, declinePartner, fileIpo, founderEquityValue, founderPct, ipoRange, ownershipOf, partnerOffer, priceIpo, retire, sellStake, startRoadshow, successors, valuation } from '@/lib/firm/exit';
import { PossessionImage } from './PossessionImage';
import { RichList } from './RichList';
import { FounderLife } from './FounderLife';
import { IpoJourney } from './IpoJourney';
import { Portrait } from './Portrait';
import { IdentityBadge, identitySeed } from './IdentityBadge';
import { PrestigeBar } from './PrestigeBar';
import { SalaryControl } from './SalaryControl';
import { SalarySchedule } from './SalarySchedule';
import { Rebrand } from './Rebrand';
import { SenderIdentity } from './SenderIdentity';
import { moodOf } from '@/lib/firm/faces';
import { firmMoney as money } from './format';

type Set = (c: Career) => void;
export type LifeTab = 'wealth' | 'life' | 'possessions' | 'office' | 'ownership';
export const LIFE_TABS: { id: LifeTab; label: string }[] = [
  { id: 'wealth', label: 'Wealth & life' }, { id: 'possessions', label: 'Possessions' }, { id: 'ownership', label: 'Ownership & office' },
];


const Stat = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) => <div className="rounded-md border border-border bg-card px-3 py-2.5 min-w-0"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p><p className={`text-lg font-semibold tabular-nums break-words ${tone === 'good' ? 'text-gain' : tone === 'bad' ? 'text-loss' : ''}`}>{value}</p>{sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}</div>;
const Bar = ({ v, label }: { v: number; label: string }) => <div className="flex items-center gap-2 text-xs" aria-label={`${label} ${Math.round(v)} of 100`}><span className="w-20 shrink-0 text-muted-foreground">{label}</span><div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden"><div className={`h-full ${v < 35 ? 'bg-loss' : v >= 70 ? 'bg-gain' : 'bg-primary'}`} style={{ width: `${v}%` }} /></div><span className="w-8 text-right tabular-nums">{Math.round(v)}</span></div>;
const run = (c: Career, setC: Set, r: { c: Career; ok: boolean; message: string }) => { if (r.ok) setC(r.c); (r.ok ? toast.success : toast.error)(r.message); };

export function FirmLife({ c, setC, tab, setTab }: { c: Career; setC: Set; tab: LifeTab; setTab: (t: LifeTab) => void }) {
  return (
    <div className="space-y-4 fund-enter">
      <div><h2 className="text-lg font-semibold">My Life</h2><p className="text-sm text-muted-foreground">Your money, your time and your people.</p></div>
      <div role="tablist" aria-label="My Life sections" className="flex flex-wrap gap-1">{LIFE_TABS.map(t => <Button key={t.id} role="tab" aria-selected={tab === t.id} size="sm" variant={tab === t.id ? 'secondary' : 'ghost'} className="shrink-0" onClick={() => setTab(t.id)}>{t.label}</Button>)}</div>
      {tab === 'wealth' && <><FounderLife c={c} setC={setC} /><PrestigeBar c={c} /><Wealth c={c} setC={setC} /><RichList c={c} /><LifeAndPeople c={c} setC={setC} /></>}
      {tab === 'life' && <><FounderLife c={c} setC={setC} /><LifeAndPeople c={c} setC={setC} /></>}
      {tab === 'possessions' && <Possessions c={c} setC={setC} />}
      {tab === 'office' && <Office c={c} setC={setC} />}
      {tab === 'ownership' && <><Ownership c={c} setC={setC} /><Office c={c} setC={setC} /></>}
    </div>
  );
}

function NetWorthChart({ c }: { c: Career }) {
  const pts = c.snapshots.filter(s => s.netWorth !== undefined).map(s => ({ q: s.q, v: s.netWorth! }));
  if (pts.length < 2) return <p className="text-sm text-muted-foreground">Your net-worth history appears after two quarter closes.</p>;
  const W = 640, H = 170, L = 64, B = 24, T = 10, R = 10;
  const lo = Math.min(0, ...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v), lo + 1);
  const x = (i: number) => L + (i / (pts.length - 1)) * (W - L - R); const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ');
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Net worth by quarter: ${pts.map(p => `${quarterLabel(c.fund, p.q)} ${money(p.v)}`).join(', ')}`}>
    {[lo, (lo + hi) / 2, hi].map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-foreground/50' : 'stroke-border'} /><text x={L - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{money(v)}</text></g>)}
    <path d={d} fill="none" className="stroke-primary" strokeWidth={2.2} />
    {pts.map((p, i) => (pts.length <= 10 || i % Math.ceil(pts.length / 8) === 0) && <text key={p.q} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{quarterLabel(c.fund, p.q)}</text>)}
  </svg>;
}

function Wealth({ c, setC }: { c: Career; setC: Set }) {
  const [amt, setAmt] = useState('');
  const max = maxDistribution(c); const v = Number(amt.replace(/[^0-9.]/g, '')) || 0;
  const eq = founderEquityValue(c); const nw = netWorth(c, eq, founderStake(c)); const you = founderPct(c);
  const hist = [...entriesFor(c.journal, 'founder')].reverse();
  return <div className="space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
      <Stat label="Personal cash" value={money(nw.cash)} sub="spendable" />
      <Stat label="Possessions" value={money(nw.assets)} sub="estimated market value" />
      <Stat label="Fund stake" value={money(nw.stake)} sub="your units × NAV" />
      <Stat label="Firm equity" value={money(nw.equity)} sub={`${(you * 100).toFixed(1)}%, an estimate`} />
      <Stat label="Personal debts" value={money(nw.owed)} tone={nw.owed > 0 ? 'bad' : undefined} />
      <Stat label="Net worth" value={money(nw.total)} tone={nw.total >= 0 ? 'good' : 'bad'} />
    </div>
    <Section title="Net worth over time"><NetWorthChart c={c} /></Section>
    <Section title="Your salary"><SalaryControl key={`${c.fund.q}-${c.founderSalaryQ}`} c={c} setC={setC} /><SalarySchedule c={c} setC={setC} /></Section>
    <Section title="Take a distribution from the firm">
      <p className="text-xs text-muted-foreground mb-2">Up to {money(max)}. The firm keeps {RESERVE_QUARTERS} quarters of bills ({money(reserveTarget(c))}) and pays owed bills first.{you < 1 ? ` You own ${(you * 100).toFixed(1)}%, so partners receive their share of every distribution.` : ''}</p>
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); if (v > 0 && c.status === 'running') { setC(distribute(c, v)); setAmt(''); toast.success(`Distributed ${money(Math.min(v, max))}.`); } }}>
        <Input inputMode="decimal" aria-label="Distribution amount" placeholder="Amount in dollars" value={amt} onChange={e => setAmt(e.target.value)} className="w-56" />
        <Button type="submit" disabled={v <= 0 || max <= 0 || c.status !== 'running'}>Distribute</Button>
        <Button type="button" variant="outline" disabled={max <= 0} onClick={() => setAmt(String(Math.floor(max)))}>Maximum</Button>
      </form>
    </Section>
    <Section title="Personal spending and income">
      {hist.length === 0 ? <p className="text-sm text-muted-foreground">No entries yet.</p> : <ul className="text-xs tabular-nums divide-y divide-border max-h-96 overflow-y-auto">{hist.slice(0, 80).map(t => <li key={t.id} className="flex justify-between gap-3 py-1.5"><span className="min-w-0"><span className="text-muted-foreground">{t.date} · </span>{t.memo}</span><span className={t.recipient === 'founder' ? 'text-gain' : ''}>{t.recipient === 'founder' ? '+' : '−'}{money(t.amount)}</span></li>)}</ul>}
    </Section>
  </div>;
}

function LifeAndPeople({ c, setC }: { c: Career; setC: Set }) {
  const L = lifeOf(c); const left = timeLeft(c); const ev = openLifeEvents(c); const pk = perks(c);
  const [target, setTarget] = useState<Record<string, string>>({ family: L.people[0]?.id ?? '', mentor: c.roster[0]?.id ?? '' });
  const rep = reputation(c);
  return <div className="space-y-4">
    <div className="grid lg:grid-cols-3 gap-4">
      <Section title="How you are doing"><div className="space-y-2"><Bar v={L.wellbeing} label="Wellbeing" /><Bar v={L.stress} label="Stress" /><Bar v={L.insight * 20} label={`Insight ${L.insight}/5`} /></div>
        <p className="text-[11px] text-muted-foreground mt-2">Wellbeing drifts down with work and stress, and up with rest (homes, yachts, islands: +{pk.rest} a quarter). Below 25 you lose a time point.</p></Section>
      <Section title={`Reputation ${rep.score}`}><ul className="text-xs space-y-0.5 tabular-nums">{rep.parts.map(p => <li key={p.label} className="flex justify-between gap-2"><span className="text-muted-foreground">{p.label}</span><span>{p.value >= 0 ? '+' : ''}{p.value}</span></li>)}</ul><p className="text-[11px] text-muted-foreground mt-2">From real results, service and behavior. Fund size alone never counts.</p></Section>
      <Section title="People close to you"><ul className="space-y-2">{L.people.map(p => <li key={p.id}><p className="text-sm flex items-center gap-2"><Portrait seed={identitySeed(p.id)} name={p.name} size={32} age={(c.founder ? c.founder.startAge + (c.fund.q - c.founder.startQ) / 4 : 35 + c.fund.q / 4)} mood={moodOf(p.closeness)} role="family" />{p.name} <span className="text-xs text-muted-foreground">· {p.role}</span></p><Bar v={p.closeness} label="Closeness" />{p.memory.length > 0 && <p className="text-[11px] text-muted-foreground">Remembers: {p.memory.slice(-1)[0]}</p>}</li>)}</ul></Section>
    </div>
    {ev.length > 0 && <Section title="Life decisions">{ev.map(e => <div key={e.id} className="space-y-2 border-b border-border pb-4 mb-3"><p className="text-sm font-medium flex items-center gap-2"><SenderIdentity c={c} name={L.people.find(p => e.text.includes(p.name))?.name ?? 'Life adviser'} />{e.title}</p><p className="text-xs text-muted-foreground">{e.text}</p>
      <div className="flex flex-wrap gap-2">{e.options.map(o => <Button key={o.id} size="sm" variant={o.id === e.defaultOption ? 'outline' : 'secondary'} onClick={() => setC(resolveLifeEvent(c, e.id, o.id))} title={o.hint}>{o.label}</Button>)}</div>
      <ul className="text-[11px] text-muted-foreground">{e.options.map(o => <li key={o.id}>{o.label}: {o.hint}{o.id === e.defaultOption ? ' (happens if you do nothing)' : ''}</li>)}</ul></div>)}</Section>}
    {L.events.some(e => e.outcome) && <Section title="Recent life outcomes">{L.events.filter(e => e.outcome).slice(-3).reverse().map(e => <div key={e.id} className="border-b border-border py-3"><div className="flex items-center gap-2"><SenderIdentity c={c} name="Life adviser" /><p className="text-sm font-medium">{e.title}</p></div><p className="text-xs text-muted-foreground mt-2">{e.outcome}</p></div>)}</Section>}
    <Section title={`This quarter: ${left} of ${timeBudget(c)} time points left`}>
      <ul className="grid sm:grid-cols-2 gap-2">{LIFE_ACTIONS.map(a => {
        const needs = a.id === 'family' ? 'family' : a.id === 'mentor' ? 'mentor' : null;
        const key = needs ? `${a.id}:${target[needs]}` : a.id; const cd = cooldownLeft(c, key);
        const disabled = c.status !== 'running' || cd > 0 || left < a.time || (a.id === 'host' && pk.hosting < 1);
        return <li key={a.id} className="rounded-md border border-border p-2.5 space-y-1.5">
          <p className="text-sm font-medium flex items-center gap-2"><IdentityBadge name={a.label} kind={a.id} />{a.label} <span className="text-xs text-muted-foreground">· {a.time} pt{a.time > 1 ? 's' : ''}</span></p>
          <p className="text-[11px] text-muted-foreground">{a.blurb}</p>
          {needs && <select aria-label={a.id === 'family' ? 'Person to spend time with' : 'Team member to mentor'} className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs" value={target[needs]} onChange={e => setTarget({ ...target, [needs]: e.target.value })}>{(a.id === 'family' ? L.people.map(p => ({ id: p.id, n: `${p.name} (${p.role})` })) : c.roster.map(e => ({ id: e.id, n: `${e.name} (${e.role})` }))).map(o => <option key={o.id} value={o.id}>{o.n}</option>)}</select>}
          {(() => { const who = needs === 'family' ? L.people.find(p => p.id === target.family)?.name : needs === 'mentor' ? c.roster.find(e => e.id === target.mentor)?.name : undefined;
            const verb = ({ leave: 'Take leave', family: `Spend time with ${who ?? 'them'}`, network: 'Go to the dinner', host: 'Host your top clients', study: 'Study this quarter', mentor: `Mentor ${who ?? 'them'}`, philanthropy: 'Make the donation', interview: 'Give the interview' } as Record<string, string>)[a.id];
            const text = cd > 0 ? `Again in ${cd} qtr` : a.id === 'host' && pk.hosting < 1 ? 'Needs a venue' : left < a.time ? 'Not enough time' : verb;
            return <Button size="sm" variant="outline" className="min-h-10" disabled={disabled} aria-label={`${verb}: ${a.label}, ${a.time} time point${a.time > 1 ? 's' : ''}${disabled ? ` (${text})` : ''}`} onClick={() => run(c, setC, lifeAction(c, a.id, needs ? target[needs] : undefined))}>{text}</Button>; })()}
        </li>; })}</ul>
      {promisedTime(c) > 0 && <p className="text-xs mt-2">Promised this quarter: {promisedTime(c)} point(s) at home, already set aside.</p>}
      {promisedTime(c, c.fund.q + 1) > 0 && <p className="text-xs text-muted-foreground">Promised for next quarter: {promisedTime(c, c.fund.q + 1)} point(s).</p>}
      <p className="text-[11px] text-muted-foreground mt-2">Time points reset each quarter. A jet adds one point (never more than one, however many you own).</p>
    </Section>
    <Section title="Life log">{L.log.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : <ul className="text-xs space-y-1 max-h-72 overflow-y-auto">{[...L.log].reverse().slice(0, 60).map((x, i) => <li key={i} className={x.tone === 'good' ? 'text-gain' : x.tone === 'bad' ? 'text-loss' : ''}><span className="text-muted-foreground">{x.q ? quarterLabel(c.fund, x.q) : 'Day one'} · </span>{x.text}</li>)}</ul>}</Section>
  </div>;
}

const KIND_LABEL: Record<ItemKind, string> = { car: 'Cars', home: 'Homes', jet: 'Jets', yacht: 'Yachts', island: 'Islands', art: 'Art and collectibles', membership: 'Memberships', education: 'Education' };
const perkText = (p: Partial<Record<string, number>>) => Object.entries(p).filter(([, v]) => v).map(([k, v]) => ({ travel: '+1 time point', hosting: `hosting venue (level ${v})`, network: `networking +${v}`, rest: `rest +${v}/qtr`, learning: 'faster study' }[k])).join(', ');

function Possessions({ c, setC }: { c: Career; setC: Set }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const mine = owned(c); const cash = personalCash(c); const L = lifeOf(c);
  const history = L.possessions.filter(p => p.soldQ !== undefined);
  return <div className="space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2"><Stat label="Personal cash" value={money(cash)} /><Stat label="Upkeep a quarter" value={money(upkeepQ(c))} sub="paid at each close" /><Stat label="Status" value={String(statusScore(c))} /><Stat label="Overdue personal bills" value={money(L.owed.reduce((a, b) => a + b.amount, 0))} tone={L.owed.length ? 'bad' : undefined} sub={L.owed.length ? 'two short quarters force a sale' : undefined} /></div>
    <Section title="What you own">{mine.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : <ul className="divide-y divide-border">{mine.map(p => { const it = catalogItem(p.itemId); const rv = resaleValue(p, c.fund.q);
      return <li key={p.id} className="py-2 grid sm:grid-cols-[1fr_auto] gap-2 text-sm"><div className="flex gap-3 min-w-0"><PossessionImage id={p.itemId} name={p.name} tiny /><div className="min-w-0"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground tabular-nums">Bought {quarterLabel(c.fund, p.boughtQ) || 'day one'} for {money(p.price)} · value ≈ {money(marketValue(p, c.fund.q))} · upkeep {money(p.price * (it?.upkeep ?? 0))}/qtr{it && perkText(it.perks) ? ` · ${perkText(it.perks)}` : ''}</p></div></div>
        <div>{!it || it.saleFee >= 1 ? <span className="text-xs text-muted-foreground">{p.itemId === 'venture' ? 'Illiquid until it resolves' : 'Cannot be resold'}</span> : confirm === p.id ? <span className="flex gap-1"><Button size="sm" variant="destructive" onClick={() => { run(c, setC, sellItem(c, p.id)); setConfirm(null); }}>Sell for {money(rv)}</Button><Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Keep</Button></span> : <Button size="sm" variant="outline" disabled={c.status !== 'running'} onClick={() => setConfirm(p.id)}>Sell…</Button>}</div></li>; })}</ul>}</Section>
    {(Object.keys(KIND_LABEL) as ItemKind[]).map(k => <Section key={k} title={KIND_LABEL[k]}><ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{CATALOG.filter(i => i.kind === k).map(i => { const has = mine.some(p => p.itemId === i.id); const afford = cash >= i.price;
      return <li key={i.id} className="group rounded-md border border-border p-2.5 space-y-2 text-xs"><div className="overflow-hidden rounded-md"><PossessionImage id={i.id} name={i.name} /></div><p className="text-sm font-medium">{i.name}</p><p className="text-muted-foreground">{i.blurb}</p>
        <p className="tabular-nums">{money(i.price)} · upkeep {money(i.price * i.upkeep)}/qtr</p>
        <p className="text-muted-foreground">{i.saleFee >= 1 ? 'No resale value.' : `${i.drift >= 0 ? `Value drifts about +${(i.drift * 100).toFixed(1)}%` : `Loses about ${(-i.drift * 100).toFixed(1)}%`} a quarter; selling costs ${Math.round(i.saleFee * 100)}%.`}{perkText(i.perks) ? ` Benefit: ${perkText(i.perks)}.` : ''} Status +{i.status}.</p>
        <Button size="sm" className="w-full" variant={afford && !has ? 'default' : 'outline'} disabled={has || !afford || c.status !== 'running'} onClick={() => run(c, setC, buyItem(c, i.id))}>{has ? 'Owned' : afford ? `Buy · ${money(i.price)}` : `Need ${money(i.price - cash)} more`}</Button></li>; })}</ul></Section>)}
    {history.length > 0 && <Section title="Sold and resolved"><ul className="text-xs tabular-nums space-y-1">{history.map(p => <li key={p.id} className="flex justify-between gap-2"><span>{p.name}{p.forced ? ' (forced sale)' : ''}</span><span>{money(p.price)} → {money(p.salePrice ?? 0)} · {quarterLabel(c.fund, p.soldQ!)}</span></li>)}</ul></Section>}
  </div>;
}

function Office({ c, setC }: { c: Career; setC: Set }) {
  const L = lifeOf(c); const since = c.fund.q - L.officeChangedQ;
  return <div className="space-y-4">
    <Section title={`Firm office: ${OFFICE_TIERS[L.officeTier].name}`}><p className="text-sm text-muted-foreground">Owned and paid by the firm, separate from your homes. Rent {money(c.officeQ)} a quarter · {c.roster.length} of {c.capacity} desks.</p></Section>
    <ul className="grid sm:grid-cols-2 gap-3">{OFFICE_TIERS.map((t, i) => { const q = officeQuote(c, i); const cur = i === L.officeTier;
      return <li key={t.name} className={`rounded-md border p-3 space-y-1.5 text-sm ${cur ? 'border-primary' : 'border-border'}`} data-office-tier={i}>
        <p className="font-medium flex items-center gap-2"><IdentityBadge id={`office:${i}`} name={t.name} stage={i + 1} />{t.name}{cur ? ' · current' : ''}</p><p className="text-xs text-muted-foreground">{t.blurb}</p>
        <p className="text-xs tabular-nums">Rent {money(q.newRentQ)}/qtr · {t.capacity} desks · research +{Math.round(t.research * 100)}% · client satisfaction +{t.clientSat}/qtr</p>
        {!cur && <p className="text-xs tabular-nums text-muted-foreground">{q.fitOut > 0 ? `Fit-out ${money(q.fitOut)} from firm cash` : 'No fit-out; no refund of past fit-outs'}</p>}
        {!cur && <Button size="sm" variant="outline" disabled={c.status !== 'running' || since < 4} onClick={() => run(c, setC, moveOffice(c, i, reserveTarget, firmCash(c)))}>{since < 4 ? `Lease ends in ${4 - since} qtr` : 'Move here'}</Button>}
      </li>; })}</ul>
  </div>;
}

function Ownership({ c, setC }: { c: Career; setC: Set }) {
  const o = ownershipOf(c); const v = valuation(c); const offer = partnerOffer(c);
  const [terminal, setTerminal] = useState<null | { title: string; body: string; act: () => void }>(null);
  const [heir, setHeir] = useState(successors(c)[0]?.id ?? '');
  const locked = o.ipo?.lockupUntilQ !== undefined && c.fund.q < o.ipo.lockupUntilQ;
  const you = founderPct(c);
  const ask = (title: string, body: string, act: () => void) => setTerminal({ title, body, act });
  return <div className="space-y-4">
    <IpoJourney c={c} setC={setC} confirm={ask} />
    <div className="grid lg:grid-cols-2 gap-4">
      <Section title="Cap table"><ul className="text-sm tabular-nums space-y-1">{o.holders.filter(h => h.pct > 1e-6).map(h => <li key={h.id} className="flex justify-between gap-2"><span className="flex items-center gap-2"><SenderIdentity c={c} name={h.name} id={h.id} />{h.name}{h.paid ? <span className="text-xs text-muted-foreground"> · paid {money(h.paid)}</span> : null}</span><span>{(h.pct * 100).toFixed(1)}%</span></li>)}</ul>
        <p className="text-[11px] text-muted-foreground mt-2">Partners share every distribution pro rata and vote by ownership. Votes, partner meetings and buyouts are under Office, Partners & rules.</p></Section>
      <Section title="Valuation (an estimate)"><ul className="text-sm tabular-nums space-y-1">{v.lines.map(l => <li key={l.label} className={`flex justify-between gap-2 ${l.label.startsWith('Estimated') ? 'border-t border-border pt-1 font-semibold' : ''}`}><span className="min-w-0">{l.label}</span><span>{money(l.value)}</span></li>)}</ul></Section>
    </div>
    <Rebrand c={c} setC={setC} id="firm" name={c.firmName} />
    <Section title="Partner buy-in">{offer ? <div className="space-y-2 text-sm"><div className="flex items-center gap-2"><SenderIdentity c={c} name={offer.name} /><p>{offer.name} offers {money(offer.price)} paid into the firm for {(offer.pct * 100).toFixed(0)}% (90% of estimated value). Everyone is diluted by {(offer.pct * 100).toFixed(0)}%.</p></div>
      <div className="flex gap-2"><Button size="sm" onClick={() => run(c, setC, acceptPartner(c))}>Accept</Button><Button size="sm" variant="ghost" onClick={() => setC(declinePartner(c))}>Decline</Button></div></div> : <p className="text-sm text-muted-foreground">No offer right now. Offers come at most once a year after the first year, while partners own under 40%.</p>}</Section>
    <Section title="Career endings">
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-border p-3 space-y-2"><p className="font-medium">Sell your stake</p><p className="text-xs text-muted-foreground">A strategic buyer pays the estimated value for your {(you * 100).toFixed(1)}%, less 3% costs. Proceeds go to you; the fund and its clients stay with the firm.</p>
          <div className="flex flex-wrap gap-1.5"><Button size="sm" variant="outline" disabled={c.status !== 'running' || locked || you <= 0} onClick={() => ask('Sell a quarter of your stake?', `You sell ${(you * 25).toFixed(1)}% of the firm for about ${money(v.total * you * 0.25 * 0.97)} after costs. You keep running the firm.`, () => run(c, setC, sellStake(c, 0.25)))}>Sell 25%</Button>
            <Button size="sm" variant="destructive" disabled={c.status !== 'running' || locked || you <= 0} onClick={() => ask('Sell the whole firm and end your career?', `You sell your ${(you * 100).toFixed(1)}% for about ${money(v.total * you * 0.97)} after costs. This ends the career and cannot be undone.`, () => run(c, setC, sellStake(c, 1)))}>Sell everything</Button></div>
          {locked && <p className="text-[11px] text-loss">Locked up until {quarterLabel(c.fund, o.ipo!.lockupUntilQ!)}.</p>}</div>
        <div className="rounded-md border border-border p-3 space-y-2"><p className="font-medium">Retire</p><p className="text-xs text-muted-foreground">Hand the firm to a successor (level 3, ability 70+ or your named heir). Owners vote under your constitution. You keep your equity and fund units.</p>
          {successors(c).length ? <><select aria-label="Successor" className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" value={heir} onChange={e => setHeir(e.target.value)}>{successors(c).map(e => <option key={e.id} value={e.id}>{e.name} ({e.role}, {Math.round(e.ability)})</option>)}</select>
            <Button size="sm" variant="destructive" disabled={c.status !== 'running'} onClick={() => ask('Retire and hand over the firm?', 'This ends the career. Your history stays in the career museum.', () => run(c, setC, retire(c, heir)))}>Retire</Button></> : <p className="text-[11px] text-loss">No qualified successor yet. Promote or train someone.</p>}</div>
      </div>
    </Section>
    <AlertDialog open={!!terminal} onOpenChange={x => !x && setTerminal(null)}><AlertDialogContent className="firm-theme"><AlertDialogHeader><AlertDialogTitle>{terminal?.title}</AlertDialogTitle><AlertDialogDescription>{terminal?.body}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { terminal?.act(); setTerminal(null); }}>Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

export { founderEquityValue };
