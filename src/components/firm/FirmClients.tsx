import { CareerSection as Section } from './CareerSection';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { nav } from '@/lib/fund/accounting';
import { quarterLabel } from '@/lib/fund/engine';
import type { Career } from '@/lib/firm/career';
import { AGENDAS, type Agenda, KIND_LABEL, allocatedOf, capacityOf, holdMeeting, mandateFit, meetingBlock, profileOf, quote, riskLabel, roomFor, trackEdge } from '@/lib/firm/clients';
import { timeLeft } from '@/lib/firm/life';
import { firmMoney as money } from './format';
import { annualClientRate, enableClientFees, negotiateFee } from '@/lib/firm/fees';
import { clientMood } from '@/lib/firm/coverage';
import { bookAllSessions, sessionQuote, callAllClients } from '@/lib/firm/clientSessions';
import { Portrait } from './Portrait';
import { identitySeed, IdentityBadge } from './IdentityBadge';
import { canCall } from '@/lib/firm/relations';
import { CalendarCheck, Phone } from 'lucide-react';
import { moodOf } from '@/lib/firm/faces';


const Row = ({ k, v, tone }: { k: string; v: string; tone?: 'good' | 'bad' }) => <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className={`tabular-nums text-right ${tone === 'good' ? 'text-gain' : tone === 'bad' ? 'text-loss' : ''}`}>{v}</dd></div>;

/** Client book: profiles, capacity, mandates, quotes and meetings. */
export function FirmClients({ c, setC }: { c: Career; setC: (c: Career) => void }) {
  const f = c.fund; const p0 = nav(f.ledger);
  const list = f.investors.filter(i => i.id !== 'you' && i.units > 0.01).sort((a, b) => b.units - a.units);
  const [sel, setSel] = useState(list[0]?.id ?? '');
  const inv = list.find(i => i.id === sel) ?? list[0];
  const t = trackEdge(c);
  const sessions = sessionQuote(c);
  return (
    <div className="space-y-4 fund-enter">
      <div><h2 className="text-lg font-semibold">Client book</h2>
        <p className="text-sm text-muted-foreground">Client wealth and allocation limits are fictional. Units, commitments and open offers count against capacity. Quarterly management fees are paid from fund assets on the whole invested balance, including contributions; performance fees remain 10% annually above the fund high-water mark.</p>
        {!f.clientFees && <Button variant="outline" onClick={() => setC(enableClientFees(c))}>Set individual annual fees (keep current 1%)</Button>}</div>
      <p className="text-xs text-muted-foreground">Your record: {t.quarters ? `${(t.edge * 100).toFixed(1)} pts a year vs the S&P 500 over ${t.quarters} completed quarters (net of fees)` : 'no completed quarters yet'} · founder time left this quarter: {timeLeft(c)}</p>
      <div className="flex flex-wrap items-center gap-3"><Button disabled={!!sessions.reason} onClick={() => { const r = bookAllSessions(c); if (r.ok) setC(r.c); (r.ok ? toast.success : toast.error)(r.message); }}><CalendarCheck className="w-4 h-4" />Book all client sessions</Button><Button variant="outline" disabled={!list.some(i => canCall(c, i.id))} onClick={() => { const r = callAllClients(c); setC(r.c); toast.success(r.message); }}><Phone className="h-4 w-4" />Call all clients</Button><p className="text-xs text-muted-foreground" role="status">{sessions.reason ?? `${sessions.clients.length} eligible clients · ${money(sessions.cost)} firm cost · relationship +${sessions.bump} · delegated to investor relations`}</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-4">
        <Section title={`${list.length} clients`}>
          <ul className="space-y-1" role="listbox" aria-label="Clients">{list.map(i => { const p = profileOf(c, i.id); const room = roomFor(c, i.id); return (
            <li key={i.id}><button role="option" aria-selected={inv?.id === i.id} onClick={() => setSel(i.id)} className={`w-full text-left rounded-md px-2 py-2 min-h-11 text-sm hover:bg-secondary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${inv?.id === i.id ? 'bg-secondary' : ''}`}>
              <span className="flex items-center gap-2"><Portrait name={i.name} seed={identitySeed(i.id)} size={32} age={40 + c.fund.q / 4} mood={moodOf(c.satisfaction[i.id] ?? 60)} /><span className="block font-medium truncate">{i.name}</span></span><div className="h-1 bg-muted rounded-full my-2 overflow-hidden"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, c.satisfaction[i.id] ?? 60))}%` }} /></div>
              <span className="block text-[11px] text-muted-foreground tabular-nums">{KIND_LABEL[p.kind]} · {money(i.units * p0)} in · {money(room)} room · rel {c.satisfaction[i.id] ?? 60}</span>
            </button></li>); })}</ul>
        </Section>
        {inv ? <ClientCard c={c} setC={setC} id={inv.id} /> : <Section title="No clients"><p className="text-sm text-muted-foreground">The fund has no outside clients right now.</p></Section>}
      </div>
    </div>
  );
}

function ClientCard({ c, setC, id }: { c: Career; setC: (c: Career) => void; id: string }) {
  const f = c.fund; const inv = f.investors.find(i => i.id === id)!; const p = profileOf(c, id);
  const rel = c.satisfaction[id] ?? 60; const fit = mandateFit(c, p); const q = quote(c, p, rel);
  const inFund = inv.units * nav(f.ledger);
  const uncalled = c.commitments.filter(x => x.investorId === id && !x.defaulted).reduce((a, x) => a + Math.max(0, x.committed - x.called), 0);
  const open = allocatedOf(c, id) - inFund - uncalled;
  const go = (a: Agenda) => { const r = holdMeeting(c, id, a); if (r.ok) setC(r.c); (r.ok ? (r.outcome === 'declined' ? toast.error : toast.success) : toast.error)(r.message); };
  return <div className="space-y-4 min-w-0">
    <Section title={inv.name} action={<span className="flex items-center gap-3 text-xs text-muted-foreground"><Portrait name={inv.name} seed={identitySeed(inv.id)} size={64} age={40 + c.fund.q / 4} mood={moodOf(rel)} />{KIND_LABEL[p.kind]} · {inv.relation}</span>}>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
        <dl className="text-sm space-y-1">
          <Row k="Estimated wealth (fictional)" v={money(p.wealth)} />
          <Row k={`Gives one manager at most (${(p.maxShare * 100).toFixed(1)}%)`} v={money(capacityOf(p))} />
          <Row k="In the fund now (units at NAV)" v={money(inFund)} />
          <Row k="Uncalled commitments (not cash)" v={money(uncalled)} />
          {open > 0.5 && <Row k="Open offers awaiting your answer" v={money(open)} />}
          <Row k="Room left" v={money(roomFor(c, id))} tone={roomFor(c, id) > 0 ? 'good' : undefined} />
        </dl>
        <dl className="text-sm space-y-1">
          <Row k="Relationship" v={`${rel} / 100`} tone={rel >= 70 ? 'good' : rel < 45 ? 'bad' : undefined} />
          <Row k="Mood including news" v={`${clientMood(c, id)} / 100`} />
          <Row k="Annual management fee" v={`${(annualClientRate(c, id) * 100).toFixed(2)}%`} />
          <Row k="Quarterly fee at today's stake" v={money(inFund * annualClientRate(c, id) / 4)} />
          <Row k="Risk appetite" v={riskLabel(p.risk)} />
          <Row k="Largest single stock allowed" v={`${(p.maxPosition * 100).toFixed(0)}%`} />
          <Row k="Excluded sectors" v={p.excluded.length ? p.excluded.join(', ') : 'None'} />
          <Row k="Patience" v={`${p.underQ} of ${p.patience} quarters behind the index`} tone={p.underQ >= p.patience ? 'bad' : undefined} />
          <Row k="Lockup until" v={inv.lockupUntilQ > f.q ? quarterLabel(f, Math.min(inv.lockupUntilQ, f.quarters)) : 'Unlocked'} />
        </dl>
      </div>
      {fit.issues.length > 0 && <ul className="mt-3 text-xs text-loss space-y-0.5" aria-label="Mandate concerns">{fit.issues.map(x => <li key={x}>Mandate concern: {x}. Three reviews in a row redeems {25}% after lockup.</li>)}</ul>}
      {p.redeemAtQ !== undefined && <p className="mt-2 text-xs text-loss">Redemption notice: 25% when the lockup ends ({quarterLabel(f, Math.min(p.redeemAtQ, f.quarters))}) unless the relationship recovers to 70.</p>}
      {p.promise && <p className="mt-2 text-xs">Open promise: beat the S&P 500 by {quarterLabel(f, Math.min(p.promise.dueQ, f.quarters))}. Kept +6, broken −12.</p>}
    </Section>
    {f.clientFees && <Section title="What you charge to manage their money">
      <p className="text-xs text-muted-foreground mb-2">A management fee is the annual price for looking after their invested money, collected in four quarterly payments. At 1% a year, $1M invested costs $2,500 each quarter. The fund pays your firm, selling holdings if cash is short. A new rate starts next quarter and replaces the old rate; it is not a second fee.</p>
      <div className="flex flex-wrap gap-2">{[0.005, 0.0075, 0.01, 0.0125, 0.015, 0.02].map(rate => <Button key={rate} size="sm" variant="outline" onClick={() => { const result = negotiateFee(c, id, rate); if (result.ok) setC(result.c); (result.ok ? toast.success : toast.error)(result.message); }}>Propose {(rate * 100).toFixed(2)}%</Button>)}</div>
      <ul className="text-xs tabular-nums mt-2">{f.clientFees.charges.filter(x => x.investorId === id).slice(-4).map(x => <li key={x.liabilityId}>{quarterLabel(f, x.q)} · {money(x.base)} × {(x.rate * 100).toFixed(3)}% = {money(x.amount)} · {f.ledger.liabilities.find(l => l.id === x.liabilityId)?.paid ? 'paid by fund' : 'owed by fund'}</li>)}</ul>
    </Section>}
    <Section title="What they would offer today">
      <p className="text-sm">About <span className="font-semibold tabular-nums">{money(q.amount)}</span>: {(q.share * 100).toFixed(0)}% of their {money(q.room)} room. If agreed, {money(q.wireNow)} would be wired now and {money(q.commitLater)} {q.commitLater ? 'could follow later' : ''}.</p>
      <ul className="mt-2 text-xs tabular-nums space-y-0.5">{q.parts.map(x => <li key={x.label} className="flex justify-between gap-2"><span className="text-muted-foreground">{x.label}</span><span className={x.value > 0 ? 'text-gain' : x.value < 0 ? 'text-loss' : ''}>{x.value >= 0 ? '+' : ''}{(x.value * 100).toFixed(1)} pts</span></li>)}</ul>
      <ul className="mt-2 text-[11px] text-muted-foreground space-y-0.5">{q.conditions.map(x => <li key={x}>{x}</li>)}</ul>
    </Section>
    <Section title="Meet them">
      <div className="grid sm:grid-cols-2 gap-2">{AGENDAS.map(a => { const b = meetingBlock(c, id, a.id); return (
        <div key={a.id} className="rounded-md border border-border p-3 text-sm space-y-1.5"><p className="font-medium flex items-center gap-2"><IdentityBadge id={`agenda:${a.id}`} name={a.label} kind={a.id} />{a.label}</p><p className="text-xs text-muted-foreground">{a.hint} Uses {a.time} time point; again in {a.cooldown} quarters.</p>
          <Button size="sm" variant="outline" className="min-h-10" disabled={!!b} aria-describedby={b ? `why-${a.id}` : undefined} aria-label={`${a.label} with ${p.name}${b ? ` (${b})` : ''}`} onClick={() => go(a.id)}>{b ?? ({ review: 'Book the review', allocation: 'Ask for more money', lockup: 'Ask for a longer lockup', mandate: 'Ask to widen it', promise: 'Make the promise' } as Record<string, string>)[a.id]}</Button>{b && <span id={`why-${a.id}`} className="sr-only">{b}</span>}</div>); })}</div>
    </Section>
    <Section title="Relationship history">
      {p.history.length === 0 ? <p className="text-sm text-muted-foreground">Nothing recorded yet.</p> : <ul className="text-xs space-y-1">{[...p.history].reverse().slice(0, 12).map((h, i) => <li key={i}><span className="text-muted-foreground tabular-nums">{h.q > 0 ? quarterLabel(f, h.q) : 'Opening'} · {h.kind}</span> {h.text}{h.amount ? ` (${money(h.amount)})` : ''}</li>)}</ul>}
    </Section>
  </div>;
}
