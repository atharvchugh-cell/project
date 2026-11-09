import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { Career } from '@/lib/firm/career';
import { lifeOf, reputation, timeBudget, timeLeft } from '@/lib/firm/life';
import {
  DESTINATIONS, FOUNDER_ACTIONS, HEALTH_WARNINGS, HOBBIES, actionCost, childAge, childCostQ, divorceTerms, familyCostQ, fileForDivorce, founderAction,
  founderAge, founderBlock, healthDrift, openFounderEvents, partnerOf, resolveFounderEvent, setSchool, spouseCash, upgradeFounder, type FounderActionId,
} from '@/lib/firm/founder';
import { BACKGROUNDS, DEFAULT_LOOK, type FounderSetup, validSetup } from '@/lib/firm/founderSetup';
import { moodOf } from '@/lib/firm/faces';
import { CareerSection as Section } from './CareerSection';
import { FounderBuilder } from './FounderBuilder';
import { Portrait } from './Portrait';
import { identitySeed } from './IdentityBadge';
import { firmMoney as money } from './format';

type Set = (c: Career) => void;
const run = (setC: Set, r: { c: Career; ok: boolean; message: string }) => { if (r.ok) setC(r.c); (r.ok ? toast.success : toast.error)(r.message); };
const StatBar = ({ label, v, invert }: { label: string; v: number; invert?: boolean }) => {
  const good = invert ? v <= 35 : v >= 70; const bad = invert ? v >= 70 : v < 35;
  return <div className="space-y-1" aria-label={`${label} ${Math.round(v)} of 100`}>
    <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="tabular-nums font-medium">{Math.round(v)}</span></div>
    <div className="h-2.5 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none ${bad ? 'bg-loss' : good ? 'bg-gain' : 'bg-primary'}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></div>
  </div>;
};

export function FounderLife({ c, setC }: { c: Career; setC: Set }) {
  if (!c.founder) return <FounderUpgrade c={c} setC={setC} />;
  return <div className="space-y-4"><FounderHeader c={c} /><FounderDecisions c={c} setC={setC} /><Family c={c} setC={setC} /><FounderActions c={c} setC={setC} /></div>;
}

function FounderUpgrade({ c, setC }: { c: Career; setC: Set }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<FounderSetup>({ name: 'Alex Morgan', age: 35, background: 'ivy', look: DEFAULT_LOOK });
  if (c.status !== 'running') return null;
  return <Section title="Become a person, not just a fund">
    <p className="text-sm text-muted-foreground">Upgrade this career to add your founder: a face, age and Health, dating and marriage, children, contacts and new life actions. Your money, bills and history stay exactly as they are; the background shapes your stats, contacts and story only.</p>
    {!open ? <Button className="mt-3" onClick={() => setOpen(true)}>Upgrade this career</Button> : <div className="mt-4 space-y-4">
      <FounderBuilder value={v} onChange={setV} />
      <p className="text-xs text-muted-foreground">On an upgrade, the age you pick is your age today.</p>
      <div className="flex gap-2"><Button disabled={!!validSetup(v)} onClick={() => run(setC, upgradeFounder(c, v))}>Create my founder</Button><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
    </div>}
  </Section>;
}

function FounderHeader({ c }: { c: Career }) {
  const f = c.founder!; const L = lifeOf(c); const age = founderAge(c); const d = healthDrift(c); const rep = reputation(c).score;
  const warn = f.health < HEALTH_WARNINGS[0];
  return <section className="rounded-lg border border-border bg-card p-4 sm:p-5" aria-label="Your founder">
    <div className="flex flex-col sm:flex-row gap-5">
      <div className="flex sm:flex-col items-center gap-3 shrink-0"><Portrait seed={7} name={f.name} size={104} age={age} mood={f.health < 30 ? 'worried' : moodOf(L.wellbeing)} look={f.look} />
        <div className="sm:text-center min-w-0"><p className="font-semibold text-lg leading-tight">{f.name}</p><p className="text-sm text-muted-foreground">Age {Math.floor(age)}</p><p className="text-xs text-primary">{BACKGROUNDS[f.background].label}</p></div></div>
      <div className="flex-1 grid sm:grid-cols-2 gap-x-6 gap-y-3 content-start min-w-0">
        <StatBar label="Health" v={f.health} /><StatBar label="Wellbeing" v={L.wellbeing} /><StatBar label="Stress" v={L.stress} invert /><StatBar label={`Insight ${L.insight}/5`} v={L.insight * 20} /><StatBar label="Reputation" v={rep} />
        <div className="text-[11px] text-muted-foreground self-end">Each quarter: {d.parts.join(' · ')}. Gym, doctor, leave and vacations raise Health.</div>
      </div>
    </div>
    {warn && <p className="mt-3 text-sm text-loss border-l-2 border-loss pl-3">Your doctor is worried: Health {Math.round(f.health)}. {f.health < 12 ? 'Surgery or a long rest is urgent.' : f.health < 25 ? 'A checkup and time off would help now.' : 'Train, rest or book a checkup.'}{age >= 60 ? ' At your age, Health reaching zero can be fatal.' : ''}</p>}
  </section>;
}

function FounderDecisions({ c, setC }: { c: Career; setC: Set }) {
  const ev = openFounderEvents(c); const done = (c.founder?.events ?? []).filter(e => e.outcome).slice(-3).reverse();
  if (!ev.length && !done.length) return null;
  return <Section title="Personal decisions">
    {ev.map(e => <div key={e.id} className="space-y-2 border-b border-border pb-4 mb-3"><p className="text-sm font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{e.text}</p>
      <div className="flex flex-wrap gap-2">{e.options.map(o => <Button key={o.id} size="sm" variant={o.id === e.defaultOption ? 'outline' : 'secondary'} className="min-h-10 h-auto whitespace-normal" onClick={() => setC(resolveFounderEvent(c, e.id, o.id))}>{o.label}</Button>)}</div>
      <ul className="text-[11px] text-muted-foreground">{e.options.map(o => <li key={o.id}>{o.label}: {o.hint}{o.id === e.defaultOption ? ' (happens if you do nothing)' : ''}</li>)}</ul></div>)}
    {done.length > 0 && <ul className="text-xs space-y-1">{done.map(e => <li key={e.id}><span className="font-medium">{e.title}:</span> <span className="text-muted-foreground">{e.outcome}</span></li>)}</ul>}
  </Section>;
}

function Family({ c, setC }: { c: Career; setC: Set }) {
  const f = c.founder!; const L = lifeOf(c); const p = partnerOf(c); const q = c.fund.q; const terms = divorceTerms(c);
  const [confirm, setConfirm] = useState(false);
  const contacts = L.people.filter(x => x.kind === 'contact');
  return <div className="grid lg:grid-cols-3 gap-4">
    <Section title="Love life">
      {p ? <div className="space-y-2"><div className="flex items-center gap-3"><Portrait seed={identitySeed(p.id)} name={p.name} size={44} age={founderAge(c)} mood={moodOf(p.closeness)} role="family" /><div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{f.romance.status === 'married' ? `Married since ${q - f.romance.sinceQ} quarter(s) ago · ${f.romance.prenup ? `prenup: settlement ${money(f.romance.settlement ?? 0)}` : 'no prenup'}` : `Dating for ${q - f.romance.sinceQ} quarter(s)`}</p></div></div>
        <StatBar label="Closeness" v={p.closeness} />
        {p.memory.length > 0 && <p className="text-[11px] text-muted-foreground">Remembers: {p.memory.slice(-2).join(' · ')}</p>}
        {f.romance.status === 'married' && <p className="text-xs tabular-nums">{p.name}'s own account: {money(spouseCash(c))} <span className="text-muted-foreground">(separate from yours)</span></p>}
        {terms && <Button size="sm" variant="outline" className="min-h-10" disabled={c.status !== 'running'} onClick={() => setConfirm(true)}>File for divorce…</Button>}
      </div> : <p className="text-sm text-muted-foreground">You are single. "Go on a first date" below to meet someone.</p>}
      {f.exes.length > 0 && <p className="text-[11px] text-muted-foreground mt-2">Past: {f.exes.map(x => `${x.name} (${x.how})`).join(', ')}</p>}
    </Section>
    <Section title={`Children${f.children.length ? ` (${f.children.length})` : ''}`}>
      {f.children.length === 0 ? <p className="text-sm text-muted-foreground">No children yet. After a year of marriage, your spouse may want to talk about a family.</p> : <ul className="space-y-3">{f.children.map(ch => { const a = childAge(ch, q); const cost = childCostQ(c, ch, q + 1);
        return <li key={ch.id} className="space-y-1.5"><div className="flex items-center gap-3"><Portrait seed={identitySeed(ch.id)} name={ch.name} size={40} age={Math.max(6, a)} mood={moodOf(ch.closeness)} role="child" /><div className="min-w-0"><p className="text-sm font-medium">{ch.name}, {Math.floor(a)}</p><p className="text-[11px] text-muted-foreground">{ch.traits.join(', ')} · loves {ch.interest}</p></div></div>
          <StatBar label="Closeness" v={ch.closeness} />
          {ch.outcome ? <p className="text-xs">{ch.career?.title ?? (ch.outcome === 'firm' ? 'Works at your firm' : ch.outcome === 'business' ? 'Runs the business you backed' : ch.outcome === 'drifted' ? 'Drifted away' : 'On their own path')}</p>
            : <div className="flex flex-wrap items-center gap-2 text-xs"><span className="tabular-nums">{cost.amount ? `${cost.label.split(':')[0]} ${money(cost.amount)}/qtr` : ''}</span>
              {a < 18 && <select aria-label={`School for ${ch.name}`} className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={ch.school} onChange={e => run(setC, setSchool(c, ch.id, e.target.value as 'public' | 'private'))}><option value="public">Public school</option><option value="private">Private school</option></select>}</div>}
          {ch.memory.length > 1 && <p className="text-[11px] text-muted-foreground">Remembers: {ch.memory.slice(-1)[0]}</p>}
        </li>; })}</ul>}
      {familyCostQ(c) > 0 && <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">Family bills at the next close: {money(familyCostQ(c))} from your own cash{f.loan?.leftQ ? ` (includes the student loan, ${f.loan.leftQ} payments left)` : ''}.</p>}
    </Section>
    <Section title={`Contacts (${contacts.length})`}>
      {contacts.length === 0 ? <p className="text-sm text-muted-foreground">Meet people at dinners, galas, reunions and the golf club.</p> : <ul className="space-y-2 max-h-80 overflow-y-auto">{contacts.map(x => <li key={x.id} className="flex gap-2"><Portrait seed={identitySeed(x.id)} name={x.name} size={32} age={40} mood={moodOf(x.closeness)} /><div className="min-w-0"><p className="text-sm">{x.name} <span className="text-xs text-muted-foreground">· {x.role}</span></p>{x.could && <p className="text-[11px] text-primary">Might become {x.could} later</p>}<p className="text-[11px] text-muted-foreground">{x.memory.slice(-2).join(' · ')}</p></div></li>)}</ul>}
    </Section>
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent className="firm-theme"><AlertDialogHeader><AlertDialogTitle>File for divorce from {p?.name}?</AlertDialogTitle><AlertDialogDescription>{terms?.text} Lawyers cost {money(40e3 * (c.scenario === 'boutique' ? 0.2 : 1))}. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Stay married</AlertDialogCancel><AlertDialogAction onClick={() => run(setC, fileForDivorce(c))}>File</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function FounderActions({ c, setC }: { c: Career; setC: Set }) {
  const f = c.founder!; const kids = f.children.filter(x => !x.outcome);
  const [t, setT] = useState<Record<string, string>>({ vacation: 'lake', hobby: 'golf', child: kids[0]?.id ?? '' });
  const visible = FOUNDER_ACTIONS.filter(a => !(a.id === 'child' && !kids.length) && !(a.id === 'meet' && f.romance.status !== 'single') && !(a.id === 'date' && f.romance.status === 'single') && !(a.id === 'propose' && f.romance.status !== 'dating'));
  const target = (id: FounderActionId) => (id === 'vacation' || id === 'hobby' ? t[id] : id === 'child' ? (kids.some(k => k.id === t.child) ? t.child : kids[0]?.id) : undefined);
  return <Section title={`Personal time: ${timeLeft(c)} of ${timeBudget(c)} points left this quarter`}>
    <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{visible.map(a => { const tg = target(a.id); const why = founderBlock(c, a.id, tg); const cost = actionCost(c, a.id, tg);
      return <li key={a.id} className="rounded-md border border-border p-2.5 space-y-1.5">
        <p className="text-sm font-medium">{a.label} <span className="text-xs text-muted-foreground">· {a.time} pt{a.time > 1 ? 's' : ''}{cost ? ` · ${money(cost)}` : ''}</span></p>
        <p className="text-[11px] text-muted-foreground">{a.blurb}</p>
        {a.id === 'vacation' && <select aria-label="Destination" className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs" value={t.vacation} onChange={e => setT({ ...t, vacation: e.target.value })}>{DESTINATIONS.map(d => <option key={d.id} value={d.id}>{d.label}: wellbeing +{d.wellbeing}, health +{d.health}</option>)}</select>}
        {a.id === 'hobby' && <select aria-label="Hobby" className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs" value={t.hobby} onChange={e => setT({ ...t, hobby: e.target.value })}>{HOBBIES.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}</select>}
        {a.id === 'child' && <select aria-label="Child" className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs" value={tg} onChange={e => setT({ ...t, child: e.target.value })}>{kids.map(k => <option key={k.id} value={k.id}>{k.name} ({Math.floor(childAge(k, c.fund.q))})</option>)}</select>}
        <Button size="sm" variant="outline" className="min-h-10 w-full" disabled={!!why} aria-label={`${a.label}${why ? ` (${why})` : ''}`} onClick={() => run(setC, founderAction(c, a.id, tg))}>{why ?? a.label}</Button>
      </li>; })}</ul>
    <p className="text-[11px] text-muted-foreground mt-2">These share the same quarterly time points as the actions below. Costs come from your own cash.</p>
  </Section>;
}
