import { CareerSection as Section } from './CareerSection';
import { analysisFactors } from '@/lib/firm/analysis';
import { termsOf } from '@/lib/firm/clients';
import { ideaPnl } from '@/lib/firm/attribution';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompanyLogo } from '@/components/game/CompanyLogo';
import { nav, netAssets } from '@/lib/fund/accounting';
import { assetName, quarterLabel } from '@/lib/fund/engine';
import { type Career, firmCash, founderCash } from '@/lib/firm/career';
import { openDecisions, resolveDecision } from '@/lib/firm/close';
import { SalaryControl } from './SalaryControl';
import { SalarySchedule } from './SalarySchedule';
import { cashForecast } from '@/lib/firm/forecast';
import { approveIdea, candidates, cancelOrder, fire, giveRaise, hire, promote, rejectIdea } from '@/lib/firm/phase2';
import { growth, payroll } from '@/lib/firm/roster';
import { StaffDesk, hirePreview } from './FirmStaffDesk';
import { IdentityBadge, identitySeed } from './IdentityBadge';
import { staffServiceQuote, enableImmersion } from '@/lib/firm/immersion';
import { Portrait } from './Portrait';
import { SenderIdentity } from './SenderIdentity';
import { moodOf } from '@/lib/firm/faces';
import { brandVariant } from '@/lib/firm/brand';
import { expectedContributions } from '@/lib/firm/phase4';
import { owedBy } from '@/lib/firm/payables';
import { clientTier, CALL_TOPICS, type CallTopic, callClient, canCall, canPitch, employeeRevenue, pitchBlock, pitchChance, previewCall, pitchRival, quarterRevenue, standings } from '@/lib/firm/relations';
import { firmMoney as money, firmPct as pct } from './format';

type Set = (c: Career) => void;



const Meter = ({ value: raw, label, cap }: { value: number; label: string; cap?: number }) => { const value = Math.round(raw); return (
  <div className="flex items-center gap-2" aria-label={`${label} ${value} of 100`}>
    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden"><div className={`h-full ${value < 35 ? 'bg-loss' : value >= 70 ? 'bg-gain' : 'bg-primary'}`} style={{ width: `${value}%` }} />{cap !== undefined && cap > value && <div className="h-full -mt-1.5 border-r-2 border-foreground/60" style={{ width: `${cap}%` }} title={`Potential ${Math.round(cap)}`} />}</div>
    <span className={`text-xs tabular-nums w-8 text-right ${value < 35 ? 'text-loss' : ''}`}>{value}</span>
  </div>
); };

export function DecisionList({ c, setC }: { c: Career; setC: Set }) {
  const list = openDecisions(c);
  const resolved = c.decisions.filter(d => d.resolved && d.outcome).slice(-3).reverse();
  if (!list.length && !resolved.length) return null;
  return <ul className="space-y-3 text-sm">{list.map(d => (
    <li key={d.id} className={`rounded-md border p-3 space-y-2 ${d.kind === 'payroll_shortfall' || d.kind === 'allocation_review' || d.kind === 'poach' || d.kind === 'activist' || d.kind === 'crisis' ? 'border-loss/50' : 'border-border'}`}>
      <div className="flex items-center gap-2"><SenderIdentity c={c} name={d.from ?? 'Chief operating officer'} /><p className="text-[11px] text-muted-foreground">{d.from ?? 'Chief operating officer'}{d.kind !== 'payroll_shortfall' ? ' · decide before you close the quarter' : ''}</p></div>
      <p className="font-medium">{d.title ?? 'Firm cash ran short'}</p>
      <p className="text-muted-foreground">{d.text}{d.kind === 'payroll_shortfall' ? ` Still owed: ${owedBy(c).map(x => `${x.label.toLowerCase()} ${money(x.amount)}`).join(', ') || money(0)}.` : ''}</p>
      {(d.kind === 'top_up' || d.kind === 'new_client') && (() => { const t = termsOf(d); return <p className="text-xs tabular-nums">Saved terms: <b>{money(t.wireNow)}</b> wired now{t.commitLater > 0 ? <>, <b>{money(t.commitLater)}</b> committed for capital calls</> : ' (all cash)'} · open until the {quarterLabel(c.fund, Math.min(t.expiresQ, c.fund.quarters))} close</p>; })()}
      <div className="flex flex-wrap gap-2">
        {d.kind === 'payroll_shortfall' ? <>
          <Button size="sm" disabled={founderCash(c) <= 0} onClick={() => setC(resolveDecision(c, d.id, 'inject'))}>Cover it from personal cash</Button>
          <Button size="sm" variant="outline" onClick={() => setC(resolveDecision(c, d.id, 'defer'))}>Defer pay (morale falls)</Button>
        </> : d.options?.map(o => <Button key={o.id} size="sm" variant={o.id === d.defaultOption ? 'outline' : 'default'} className="h-auto py-1.5 flex-col items-start whitespace-normal text-left" onClick={() => setC(resolveDecision(c, d.id, o.id))}><span>{o.label}</span><span className="text-[11px] opacity-80 font-normal">{o.hint}</span></Button>)}
      </div>
      {d.defaultOption && <p className="text-[11px] text-muted-foreground">If you don't choose: {d.options?.find(o => o.id === d.defaultOption)?.label}.</p>}
    </li>))}{resolved.map(d => <li key={d.id} className="border-b border-border pb-3"><div className="flex items-center gap-2"><SenderIdentity c={c} name={d.from ?? 'Chief operating officer'} /><p className="font-medium">{d.title ?? 'Firm cash ran short'}</p></div><p className="text-xs text-muted-foreground mt-2">{d.outcome}</p></li>)}</ul>;
}

export function ForecastPanel({ c }: { c: Career }) {
  const [scenario, setScenario] = useState<'flat' | 'down'>('flat');
  const f = cashForecast(c, scenario === 'flat' ? 0 : -0.05);
  const max = Math.max(1, ...f.rows.map(r => Math.max(r.cash, r.reserve)), firmCash(c));
  const reserveNow = f.rows[0]?.reserve ?? 0;
  return (
    <Section title="Cash runway forecast" action={<div className="flex gap-1">{(['flat', 'down'] as const).map(k => <Button key={k} size="sm" variant={scenario === k ? 'secondary' : 'ghost'} aria-pressed={scenario === k} onClick={() => setScenario(k)}>{k === 'flat' ? 'Fund flat' : 'Fund −5% a quarter'}</Button>)}</div>}>
      <p className={`text-sm mb-3 ${f.firstShort ? 'text-loss' : 'text-gain'}`}>{f.firstShort ? `Firm cash may fall short of payroll and office in ${f.firstShort.label}.` : `Firm cash covers payroll and office for the next ${f.rows.length} quarters.`}</p>
      <p className={`text-xs mb-3 ${f.firstBelowReserve ? 'text-loss' : 'text-muted-foreground'}`}>Reserve target: {f.reserveQuarters} quarters of bills ({money(reserveNow)}). {f.firstBelowReserve ? `Cash may drop below it in ${f.firstBelowReserve.label}; distributions pause until it is rebuilt.` : 'Cash stays above it throughout.'}</p>
      <div className="relative flex items-end gap-1 h-28" role="img" aria-label="Projected firm cash by quarter">
        <div aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-loss/70 pointer-events-none" style={{ bottom: `${(reserveNow / max) * 100}%` }}><span className="absolute right-0 -top-4 text-[9px] text-loss">reserve</span></div>
        {f.rows.map(r => <div key={r.q} className="flex-1 h-full flex flex-col justify-end items-center gap-1 min-w-0"><div className={`w-full rounded-t ${r.short ? 'bg-loss' : r.belowReserve ? 'bg-loss/50' : 'bg-primary/70'}`} style={{ height: `${Math.max(3, (r.cash / max) * 100)}%` }} title={`${r.label}: ${money(r.cash)}`} /><span className="text-[9px] text-muted-foreground truncate w-full text-center">{r.label}</span></div>)}
      </div>
      <ul className="mt-3 grid gap-2 sm:hidden" aria-label="Forecast by quarter">{f.rows.map(r => <li key={r.q} className={`rounded-md border p-2.5 text-xs tabular-nums ${r.short ? 'border-loss/60 text-loss' : 'border-border'}`}>
        <p className="flex justify-between gap-4 font-medium text-sm"><span>{r.label}{r.short ? ' · short' : r.belowReserve ? ' · below reserve' : ''}</span><span>Firm cash {money(r.cash)}</span></p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1.5">Fund</p>
        <p className="flex justify-between gap-4"><span className="text-muted-foreground">Fund size</span><span>{money(r.aum)}</span></p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1.5">Firm</p>
        <p className="flex justify-between gap-4"><span className="text-muted-foreground">Fees in</span><span className="text-gain">+{money(r.fees)}</span></p>
        <p className="flex justify-between gap-4"><span className="text-muted-foreground">Payroll + office</span><span>−{money(r.core)}</span></p>
        <p className="flex justify-between gap-4"><span className="text-muted-foreground">Your salary</span><span>−{money(r.salary)}</span></p>
      </li>)}</ul>
      <div className="hidden sm:block overflow-x-auto mt-3"><table className="w-full min-w-[36rem] text-xs tabular-nums"><thead><tr className="text-[10px] uppercase text-muted-foreground text-left"><th className="py-1 pr-3 font-medium">Quarter</th><th className="text-right px-2 font-medium">Fund size</th><th className="text-right px-2 font-medium">Fees in</th><th className="text-right px-2 font-medium">Payroll + office</th><th className="text-right px-2 font-medium">Your salary</th><th className="text-right pl-2 font-medium">Firm cash after</th></tr></thead>
        <tbody>{f.rows.map(r => <tr key={r.q} className={`border-t border-border ${r.short ? 'text-loss' : ''}`}><td className="py-1 pr-3 whitespace-nowrap">{r.label}{r.short ? ' · short' : r.belowReserve ? ' · below reserve' : ''}</td><td className="text-right px-2">{money(r.aum)}</td><td className="text-right px-2">{money(r.fees)}</td><td className="text-right px-2">{money(r.core)}</td><td className="text-right px-2">{money(r.salary)}</td><td className="text-right pl-2">{money(r.cash)}</td></tr>)}</tbody></table></div>
      <p className="text-[11px] text-muted-foreground mt-2">Uses today's firm cash, team, office and salary, scheduled investor payouts, the fund's own costs and the 0.25% quarterly fee at the projected size. Leaves out performance fees, new money and decisions you haven't made yet. A forecast, not a promise.</p>
    </Section>
  );
}

export function Team({ c, setC }: { c: Career; setC: Set }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const pool = candidates(c);
  const full = c.roster.length >= c.capacity;
  const rev = employeeRevenue(c); const qr = quarterRevenue(c);
  const top = rev.slice().sort((a, b) => b.revenue - a.revenue)[0];
  return (
    <div className="space-y-4 fund-enter">
      <div><h2 className="text-lg font-semibold">Team</h2><p className="text-sm text-muted-foreground">{c.roster.length} of {c.capacity} desks filled · payroll {money(payroll(c.roster))} a quarter, paid by the firm.</p>
        <p className="text-xs text-muted-foreground mt-1">Fee revenue {qr.estimate ? '(estimated, before your first close)' : 'last quarter'}: <span className="text-foreground tabular-nums">{money(qr.amount)}</span>, split across the team by ability, morale and how close each role is to the money{top ? `. Top earner: ${c.roster.find(e => e.id === top.id)?.name}` : ''}.</p></div>
      {!c.immersion && <Button onClick={() => setC(enableImmersion(c))}>Enable autonomous staff services & stronger competition</Button>}
      <p className="text-xs text-muted-foreground">Outside client retainers are earned automatically at each close.</p>
      <ul className="grid lg:grid-cols-2 gap-3">{c.roster.map(e => (
        <li key={e.id} className="career-record rounded-md border border-border p-4 space-y-3">
          <div className="flex gap-3"><Portrait seed={e.seed} name={e.name} size={64} age={35 + c.fund.q / 4} mood={moodOf(e.morale)} role={e.role} /><div className="min-w-0 flex-1">
            <p className="font-medium">{e.name} <span className="text-xs text-muted-foreground">· level {e.level}</span></p>
            <p className="text-xs text-primary">{e.role} · {money(e.salaryQ)}/qtr</p>
            <p className="text-xs mt-1">{e.skill}</p>
          </div></div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><span className="text-muted-foreground">Morale</span><span className="text-muted-foreground">Ability · potential {Math.round(e.potential ?? 100)}</span><Meter value={e.morale} label="Morale" /><Meter value={e.ability} label="Ability" cap={e.potential} /></div>
          <p className="text-[11px] text-muted-foreground">{(() => { const yrs = Math.max(0, (c.fund.q - e.joinedQ) / 4); const g = growth(e, c.fund.q); return `${yrs < 1 ? 'Under a year' : `${yrs.toFixed(1)} years`} at the firm · ${g >= 0.05 ? `growing about +${g.toFixed(1)} a quarter` : 'at their potential'}`; })()}</p>
          {(() => { const r = rev.find(x => x.id === e.id); if (!r) return null; return <div className="rounded border border-border bg-muted/30 px-2 py-1.5 text-xs flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><span className="text-muted-foreground">Revenue brought in</span><span className="tabular-nums font-medium">{money(r.revenue)}/qtr · {Math.round(r.share * 100)}%</span><span className={`tabular-nums ${r.multiple >= 1 ? 'text-gain' : 'text-loss'}`}>{r.multiple.toFixed(1)}× their pay</span>{r.multiple > 2.5 && <span className="w-full text-[11px] text-loss">Underpaid for their impact: morale slips each quarter and rivals may poach them.</span>}{r.multiple < 0.8 && <span className="w-full text-[11px] text-muted-foreground">Paid more than they bring in. Happy, but pay does not raise skill.</span>}</div>; })()}
          <p className="text-xs text-gain tabular-nums">Outside client revenue next quarter: {money(staffServiceQuote(c).find(x => x.id === e.id)?.amount ?? 0)} · paid directly to the firm</p>
          <p className="text-xs tabular-nums text-muted-foreground">Last close received: {money(c.journal.txns.filter(t => t.category === 'staff_revenue' && t.q === c.fund.q && t.source === `staff:${c.fund.q}:${e.id}`).reduce((a, t) => a + t.amount, 0))}</p>
          <StaffDesk c={c} setC={setC} e={e} />
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setC(giveRaise(c, e.id))} title="Raises morale, not skill">Raise 10% (morale)</Button>
            <Button size="sm" variant="outline" disabled={e.level >= 3} onClick={() => setC(promote(c, e.id))}>Promote (+25%)</Button>
            {confirm === e.id
              ? <><Button size="sm" variant="destructive" onClick={() => { setC(fire(c, e.id)); setConfirm(null); }}>Confirm · {money(e.salaryQ)} severance</Button><Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Keep</Button></>
              : <Button size="sm" variant="ghost" disabled={c.roster.length <= 1} onClick={() => setConfirm(e.id)}>Let go</Button>}
          </div>
        </li>))}</ul>
      <Section title="Candidates this quarter">
        {full && <p className="text-xs text-loss mb-2">Every desk is full. Move to a bigger office in My Life → Office to add desks.</p>}
        <ul className="grid sm:grid-cols-3 gap-3">{pool.map(p => <li key={p.id} className="rounded-md border border-border p-3 space-y-2"><div className="flex gap-2"><Portrait seed={p.seed} name={p.name} size={40} role={p.role} /><div className="min-w-0"><p className="text-sm font-medium truncate">{p.name}</p><p className="text-xs text-primary">{p.role}</p></div></div><div className="grid grid-cols-2 gap-x-2 text-[11px] text-muted-foreground"><span>Skill now</span><span>Potential</span><Meter value={p.ability} label="Ability" /><Meter value={p.potential ?? p.ability} label="Potential" /></div><p className="text-xs text-muted-foreground">{p.bio}</p>{(() => { const pv = hirePreview(c, p.salaryQ); return <p className={`text-[11px] ${pv.short ? 'text-loss' : 'text-muted-foreground'}`}>Forecast: firm cash in 8 quarters {money(pv.delta)}{pv.short ? `; first shortfall ${pv.short}` : ''}.</p>; })()}<Button size="sm" className="w-full" disabled={full} onClick={() => setC(hire(c, p.id))}>Hire · {money(p.salaryQ)}/qtr</Button></li>)}</ul>
        <p className="text-[11px] text-muted-foreground mt-2">New candidates arrive each quarter.</p>
      </Section>
      <Section title="Your salary"><SalaryControl key={`${c.fund.q}-${c.founderSalaryQ}`} c={c} setC={setC} /><SalarySchedule c={c} setC={setC} /></Section>
    </div>
  );
}

function CallPanel({ c, setC, invId, onDone }: { c: Career; setC: Set; invId: string; onDone: () => void }) {
  const [topic, setTopic] = useState<CallTopic>('results');
  const p = previewCall(c, invId, topic);
  return <div className="rounded-md border border-primary/40 bg-background/60 p-2.5 space-y-2 fund-enter">
    <p className="text-[11px] text-muted-foreground">What do you want to talk about?</p>
    <div className="grid gap-1.5" role="radiogroup" aria-label="Call topic">{CALL_TOPICS.map(t => <button key={t.id} type="button" role="radio" aria-checked={topic === t.id} onClick={() => setTopic(t.id)} className={`text-left rounded border px-2 py-1.5 text-xs transition-colors ${topic === t.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}><span className="font-medium">{t.label}</span><span className="block text-[11px] text-muted-foreground">{t.hint}</span></button>)}</div>
    <p className={`text-xs ${p.tone === 'good' ? 'text-gain' : p.tone === 'bad' ? 'text-loss' : 'text-muted-foreground'}`}>Likely reaction: satisfaction {p.delta >= 0 ? '+' : ''}{p.delta}{topic === 'more_money' && p.tone === 'good' ? ', and they offer about 15% more money' : ''}{topic === 'lockup' ? ', locked four more quarters' : ''}{p.amount > 0 ? `, and they wire ${money(p.amount)} into the fund` : ''}.</p>
    <div className="flex gap-2"><Button size="sm" onClick={() => { setC(callClient(c, invId, topic)); onDone(); }}>Make the call</Button><Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button></div>
  </div>;
}

const FLOW_LABEL: Record<string, string> = { contribution: 'Quarterly contribution', call_bonus: 'After a call', new_client: 'New client', referral: 'Referral', won_from_rival: 'Won from a rival', lost_to_rival: 'Lost to a rival' };
function MoneyIn({ c }: { c: Career }) {
  const exp = expectedContributions(c); const expTotal = exp.reduce((a, x) => a + x.amount, 0);
  const last = c.fund.q; const recent = c.flows.filter(x => x.q >= last - 1).slice(-8).reverse();
  return <Section title="Client money">
    <p className="text-sm">Expected at the next close: <b className="tabular-nums">{money(expTotal)}</b> from {exp.length} satisfied client{exp.length === 1 ? '' : 's'}.</p>
    <p className="text-[11px] text-muted-foreground mt-1">Clients above 55 satisfaction add up to 1.5% of their position every quarter at the closing fund price. More money means more fees for the firm, not a higher return.</p>
    {recent.length > 0 && <ul className="mt-2 space-y-1 text-xs">{recent.map((x, k) => <li key={k} className="flex justify-between gap-3"><span className="min-w-0 flex items-center gap-2"><SenderIdentity c={c} name={x.name} size={24} /><span className="truncate">{x.name} · {FLOW_LABEL[x.kind]}</span></span><span className={`tabular-nums shrink-0 ${x.kind === 'lost_to_rival' ? 'text-loss' : 'text-gain'}`}>{x.kind === 'lost_to_rival' ? '−' : '+'}{money(x.amount)}</span></li>)}</ul>}
  </Section>;
}

function Rivals({ c, setC }: { c: Career; setC: Set }) {
  const rows = standings(c); const started = c.fund.history.length > 0;
  return <Section title="Rival firms · trailing year">
    {!started ? <p className="text-sm text-muted-foreground">Rankings appear after your first close. Beat a rival and you can pitch its clients.</p> : <>
      <ul className="space-y-1.5">{rows.map((r, i) => <li key={r.id} className={`flex flex-wrap items-center gap-2 rounded px-2 py-1.5 text-sm ${r.you ? 'bg-primary/10 border border-primary/40' : 'border border-transparent'}`}>
        <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}</span><IdentityBadge id={r.you ? 'firm' : `mgr-${r.id}`} name={r.name} kind="manager" variant={r.you ? brandVariant(c, 'firm') : 0} />{!r.you && !r.bench && <Portrait name={`${r.name} managing partner`} seed={identitySeed(`mgr-person-${r.id}`)} size={28} age={45 + c.fund.q / 4} mood={r.trailing >= 0 ? 'happy' : 'worried'} />}
        <span className={`flex-1 min-w-0 truncate ${r.you ? 'font-semibold' : r.bench ? 'text-muted-foreground' : ''}`}>{r.name}{r.you ? ' (you)' : ''}</span>
        {r.aum !== undefined && <span className="tabular-nums text-xs text-muted-foreground w-20 text-right">{money(r.aum)}</span>}<span className={`tabular-nums text-xs w-16 text-right ${r.trailing >= 0 ? 'text-gain' : 'text-loss'}`}>{pct(r.trailing)}</span>
        {!r.you && !r.bench && <Button size="sm" variant="outline" className="h-7" disabled={!canPitch(c, r.id)} onClick={() => setC(pitchRival(c, r.id))}>{canPitch(c, r.id) ? `Pitch their clients · ${Math.round(pitchChance(c, r.id) * 100)}%` : pitchBlock(c, r.id)}{c.rivalWins[r.id] ? ` · won ${c.rivalWins[r.id]}` : ''}</Button>}
        {!r.you && !r.bench && (c.rivalLosses[r.id] ?? 0) > 0 && <span className="w-full pl-7 text-[11px] text-loss">Has taken money from {c.rivalLosses[r.id]} of your clients</span>}
      </li>)}</ul>
      {c.rivalLog.length > 0 && <div className="mt-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Recent pitches</p><ul className="space-y-1 text-xs">{c.rivalLog.slice(-5).reverse().map((l, k) => { const rn = rows.find(r => r.id === l.rival)?.name ?? l.rival; return <li key={k} className={l.by === 'you' ? (l.won ? 'text-gain' : 'text-muted-foreground') : (l.won ? 'text-loss' : 'text-muted-foreground')}>{quarterLabel(c.fund, l.q)}: {l.by === 'you' ? `You pitched ${l.client} at ${rn}` : `${rn} pitched ${l.client}`} · {l.won ? `${l.by === 'you' ? 'won' : 'lost'} ${money(l.amount)}` : l.by === 'you' ? 'no deal' : 'they stayed'}</li>; })}</ul></div>}
      <p className="text-[11px] text-muted-foreground mt-2">Rivals are fictional firms. Their returns are the real S&amp;P 500 quarter plus a fixed style and luck, so you never see future markets. Top the table and new clients come to you; trail a rival and it may take money from your unhappy clients.</p>
    </>}
  </Section>;
}

export function Clients({ c, setC, onOffers }: { c: Career; setC: Set; onOffers: () => void }) {
  const f = c.fund; const n = nav(f.ledger);
  const [calling, setCalling] = useState<string | null>(null);
  const reviews = openDecisions(c).filter(d => d.kind === 'allocation_review' || d.kind === 'top_up' || d.kind === 'new_client');
  const recent = c.callLog.slice(-4).reverse();
  return (
    <div className="space-y-4 fund-enter">
      <h2 className="text-lg font-semibold">Clients</h2>
      {reviews.length > 0 && <Section title="Client decisions"><DecisionList c={{ ...c, decisions: reviews }} setC={x => setC({ ...x, decisions: [...c.decisions.map(d => x.decisions.find(y => y.id === d.id) ?? d), ...x.decisions.filter(y => !c.decisions.some(d => d.id === y.id))] })} /></Section>}
      {f.offers.length > 0 && <Section title="New money on the table" action={<Button size="sm" onClick={onOffers}>Review in Investments</Button>}><ul className="text-sm space-y-1">{f.offers.map(o => <li key={o.id} className="flex items-center gap-2"><SenderIdentity c={c} name={o.investor} />{o.investor} offers {money(o.amount)}. {o.reason}</li>)}</ul></Section>}
      <p className="text-xs text-muted-foreground">Clients you attract at this size: <span className="text-foreground">{clientTier(netAssets(f.ledger)).label}</span>. Grow the fund past $2B, $8B and $20B to draw bigger, wealthier clients.</p>
      <MoneyIn c={c} />
      <Rivals c={c} setC={setC} />
      <ul className="grid sm:grid-cols-2 gap-3">
        {f.investors.filter(i => i.units > 0.01).map((i, k) => {
          const due = f.schedule.filter(r => r.investorId === i.id && r.q > f.q);
          const sat = c.satisfaction[i.id] ?? 60;
          const met = c.meetings[i.id];
          return <li key={i.id} className="rounded-md border border-border bg-card p-3 flex gap-3"><SenderIdentity c={c} name={i.name} id={i.id} size={44} /><div className="min-w-0 flex-1 space-y-1">
            <div className="flex justify-between gap-2"><p className="font-medium truncate">{i.name}</p><p className="tabular-nums text-sm">{money(i.units * n)}</p></div>
            <p className="text-xs text-primary">{i.relation}{i.lockupUntilQ > f.q && i.id !== 'you' ? ` · locked until ${quarterLabel(f, i.lockupUntilQ)}` : ''}</p>
            <p className="text-xs text-muted-foreground">{i.note}</p>
            {due.length > 0 && <p className="text-xs">Upcoming: {due.map(r => `${money(r.amount)} in ${quarterLabel(f, r.q)}`).join(', ')}</p>}
            {i.id !== 'you' && <><p className="text-[11px] text-muted-foreground">Satisfaction{sat >= 80 ? ' · very happy, may invest more' : sat < 35 ? ' · at risk of leaving' : ''}</p><Meter value={sat} label="Satisfaction" />
              {calling === i.id ? <CallPanel c={c} setC={setC} invId={i.id} onDone={() => setCalling(null)} /> :
              <div className="flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">{met === undefined ? 'No call yet' : `Last call ${met ? quarterLabel(f, met) : 'at launch'}`}</span><Button size="sm" variant="outline" disabled={!canCall(c, i.id)} onClick={() => setCalling(i.id)}>{canCall(c, i.id) ? 'Call client' : 'Called this quarter'}</Button></div>}</>}
          </div></li>;
        })}
      </ul>
      {recent.length > 0 && <Section title="Recent calls"><ul className="space-y-1.5 text-xs">{recent.map((r, k) => <li key={k} className="flex gap-2"><SenderIdentity c={c} name={f.investors.find(x => x.id === r.investorId)?.name ?? 'Client'} id={r.investorId} size={28} /><span className={`tabular-nums w-8 shrink-0 ${r.delta >= 0 ? 'text-gain' : 'text-loss'}`}>{r.delta >= 0 ? '+' : ''}{r.delta}</span><span><span className="font-medium">{f.investors.find(x => x.id === r.investorId)?.name ?? 'Client'}:</span> "{r.reply}"{r.amount ? <span className="text-gain"> Wired {money(r.amount)}.</span> : null}</span></li>)}</ul></Section>}
      <p className="text-[11px] text-muted-foreground">Satisfaction is separate from fund confidence. It rises with profits, good calls and on-time payouts, and falls with losses, late payments, pushy calls and positions that break the mandate. Very happy clients add money and refer new ones.</p>
    </div>
  );
}

export function Committee({ c, setC }: { c: Career; setC: Set }) {
  const pending = c.ideas.filter(i => i.status === 'pending');
  const decided = c.ideas.filter(i => i.status !== 'pending').slice().reverse();
  const assigned = c.roster.filter(e => e.assignment);
  return (
    <div className="space-y-4 fund-enter">
      <h2 className="text-lg font-semibold">Investment committee</h2>
      <Section title="Ideas waiting for a vote">
        {pending.length === 0 ? <p className="text-sm text-muted-foreground">{assigned.length ? `${assigned.map(e => e.name).join(', ')} ${assigned.length > 1 ? 'are' : 'is'} researching. Pitches arrive as research completes.` : 'No one is researching. Assign anyone on the team to a sector in People → Team.'}</p> : (
          <ul className="space-y-3">{pending.map(i => (
            <li key={i.id} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center gap-2"><CompanyLogo ticker={i.ticker} companyName={assetName(i.ticker)} /><SenderIdentity c={c} name={i.analyst} size={32} /><div className="min-w-0 flex-1"><p className="font-medium truncate">{assetName(i.ticker)}</p><p className="text-xs text-muted-foreground">{i.sector} · pitched by {i.analyst} · conviction {'●'.repeat(i.conviction)}{'○'.repeat(5 - i.conviction)}</p></div></div>
              <p className="text-sm">{i.thesis}</p>
              {i.analysis && <details className="text-xs"><summary className="cursor-pointer text-muted-foreground min-h-8 flex items-center">How {i.analyst} got here (past quarters only)</summary><ul className="grid grid-cols-2 gap-x-3 tabular-nums mt-1">{analysisFactors(i.analysis).map(f => <li key={f.label} className="contents"><span className="text-muted-foreground">{f.label}</span><span className="text-right">{f.value}</span></li>)}</ul><p className="text-[11px] text-muted-foreground mt-1">Skill {Math.round(i.analysis.skill * 100)} (ability and tenure) sets how many names are screened, the analytical error, and how much a crowded holding is penalized. It never sees future returns and does not guarantee a profit.</p></details>}
              <IdeaApprove c={c} setC={setC} id={i.id} />
              <p className="text-[11px] text-muted-foreground">Ideas not voted on within two quarters are dropped.</p>
            </li>))}</ul>)}
      </Section>
      {c.pendingOrders.length > 0 && <Section title="Approved, buying when the quarter closes"><ul className="text-sm space-y-1">{c.pendingOrders.map(o => <li key={o.ideaId ?? o.ticker} className="flex justify-between gap-2"><span>{assetName(o.ticker)} · {money(o.amount)}</span>{o.ideaId && <Button size="sm" variant="ghost" onClick={() => setC(cancelOrder(c, o.ideaId!))}>Undo</Button>}</li>)}</ul></Section>}
      <Section title="Track record">
        {decided.length === 0 ? <p className="text-sm text-muted-foreground">Each decision is reviewed one year later against the S&P 500, including ideas you passed on.</p> : (<>
          <p className="text-[11px] text-muted-foreground mb-1">Actual P&amp;L follows the real trades (fills, sales, costs). The review column is a hypothetical buy-and-hold check, not money made.</p>
          <div className="overflow-x-auto"><table className="w-full text-xs tabular-nums"><thead><tr className="text-[10px] uppercase text-muted-foreground text-left"><th className="py-1 font-medium">Idea</th><th className="font-medium">Analyst</th><th className="font-medium">Vote</th><th className="text-right font-medium">Actual P&amp;L</th><th className="text-right font-medium">Review: 1-yr hypothetical</th><th className="text-right font-medium">S&amp;P 500</th></tr></thead>
            <tbody>{decided.map(i => <tr key={i.id} className="border-t border-border"><td className="py-1">{assetName(i.ticker)}</td><td><span className="flex items-center gap-1"><SenderIdentity c={c} name={i.analyst} size={24} />{i.analyst}</span></td><td>{i.status === 'approved' ? `${i.delegated ? 'Delegated' : 'Bought'} ${((i.size ?? 0) * 100).toFixed(1)}%${i.filled !== undefined ? ` · filled ${money(i.filled)}` : ''}` : 'Passed'}</td><td className={`text-right ${!i.lot ? '' : ideaPnl(c, i).pnl >= 0 ? 'text-gain' : 'text-loss'}`}>{i.lot ? money(ideaPnl(c, i).pnl) : i.status === 'approved' ? 'no fill' : ''}</td><td className={`text-right ${i.result === undefined ? '' : i.result >= (i.bench ?? 0) ? 'text-gain' : 'text-loss'}`}>{i.result === undefined ? 'pending' : pct(i.result)}</td><td className="text-right">{i.bench === undefined ? '' : pct(i.bench)}</td></tr>)}</tbody></table></div></>)}
      </Section>
      <Section title="Board votes">
        {c.board.length === 0 ? <p className="text-sm text-muted-foreground">The board meets after every fourth quarter. Bring a motion from Overview when it appears.</p> : (
          <ul className="space-y-2 text-sm">{c.board.slice().reverse().map((b, k) => <li key={k} className="border-l-2 pl-2 border-border"><p className="text-[11px] text-muted-foreground">{quarterLabel(c.fund, b.q)}</p><p className="font-medium">{b.motion}{b.votes.length ? ` · ${b.passed ? 'passed' : 'failed'}` : ''}</p>{b.votes.map(v => <p key={v.name} className="flex items-center gap-2 text-xs text-muted-foreground"><SenderIdentity c={c} name={v.name} size={24} />{v.name}: {v.yes ? 'yes' : 'no'}. {v.reason}</p>)}</li>)}</ul>)}
      </Section>
    </div>
  );
}

function IdeaApprove({ c, setC, id }: { c: Career; setC: Set; id: string }) {
  const [pct, setPct] = useState('2');
  const v = Number(pct) / 100; const ok = Number.isFinite(v) && v > 0 && v <= 1;
  return <div className="space-y-1.5">
    <div className="flex flex-wrap gap-2 items-center">{[0.02, 0.05, 0.1].map(s => <Button key={s} size="sm" onClick={() => setC(approveIdea(c, id, s))}>Make it {s * 100}% of the fund</Button>)}</div>
    <form className="flex flex-wrap gap-2 items-center" onSubmit={e => { e.preventDefault(); if (ok) setC(approveIdea(c, id, v)); }}>
      <Input aria-label="Custom share of the fund in percent" type="number" min="0.1" max="100" step="0.1" value={pct} onChange={e => setPct(e.target.value)} className="w-24 tabular-nums" /><span className="text-sm">%</span>
      <Button type="submit" size="sm" variant="secondary" disabled={!ok}>Approve at this size</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setC(rejectIdea(c, id))}>Pass</Button>
    </form>
    <p className="text-[11px] text-muted-foreground">At the close the stock is set to exactly this share of the fund, selling a little of everything else if cash is short.</p>
  </div>;
}
