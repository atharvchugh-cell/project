import { CareerSection as Section } from './CareerSection';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { quarterLabel } from '@/lib/fund/engine';
import type { Career } from '@/lib/firm/career';
import { maxDistribution } from '@/lib/firm/close';
import { firmCash, reserveTarget } from '@/lib/firm/career';
import { ownershipOf, valuation } from '@/lib/firm/exit';
import { AMEND_COOLDOWN, RULES, type RuleKey, buyoutPartner, firmBuyback, governanceOf, isPartner, meetPartner, partnerState, proposeAmendment, tally } from '@/lib/firm/governance';
import { personalCash, timeLeft } from '@/lib/firm/life';
import { firmMoney as money } from './format';
import { SenderIdentity } from './SenderIdentity';
import { Rebrand } from './Rebrand';

type Set = (c: Career) => void;
const run = (setC: Set, r: { c: Career; ok: boolean; message: string }) => { if (r.ok) setC(r.c); (r.ok ? toast.success : toast.error)(r.message); };

const show = (k: RuleKey, v: number | string) => RULES.find(r => r.key === k)!.options.find(o => o.value === v)?.label ?? String(v);

export function FirmGovernance({ c, setC }: { c: Career; setC: Set }) {
  const g = governanceOf(c); const o = ownershipOf(c); const v = valuation(c).total;
  const pending = g.amendments.find(a => a.status === 'pending');
  const wait = Math.max(0, AMEND_COOLDOWN - (c.fund.q - g.lastProposalQ));
  const [draft, setDraft] = useState<Record<string, string>>({});
  return (
    <div className="space-y-4 fund-enter">
      <div><h2 className="text-lg font-semibold">Partners and rules</h2>
        <p className="text-sm text-muted-foreground">Your firm's constitution: a few standing rules that change what the game allows. Changes are voted by ownership at the next close. Client lockups, redemptions and commitments already agreed are never rewritten by a rule change.</p></div>
      <div className="flex items-center gap-3"><SenderIdentity c={c} name={c.firmName} id="firm" size={52} /><div><p className="font-semibold">{c.firmName}</p><p className="text-xs text-muted-foreground">{c.hq} headquarters</p></div></div>
      <Rebrand c={c} setC={setC} id="firm" name={c.firmName} />
      <Section title="Constitution" action={<span className="text-xs text-muted-foreground">{pending ? `Vote at the ${quarterLabel(c.fund, Math.min(pending.voteQ, c.fund.quarters))} close` : wait ? `Next proposal in ${wait} quarter(s)` : 'You can propose one change'}</span>}>
        <ul className="divide-y divide-border">{RULES.map(r => { const cur = g.constitution[r.key]; const sel = draft[r.key] ?? String(cur); const val = r.options.find(x => String(x.value) === sel)?.value ?? cur; const preview = val !== cur ? tally(c, { kind: 'amend', rule: r.key, to: val }) : null; return (
          <li key={r.key} className="py-3 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_16rem] gap-2">
            <div><p className="text-sm font-medium">{r.label}: <span className="text-primary">{show(r.key, cur)}</span></p><p className="text-xs text-muted-foreground">{r.effect}</p>
              {preview && <p className="text-xs mt-1">Expected vote: {(preview.yes * 100).toFixed(0)}% yes of {(preview.needed * 100).toFixed(0)}% needed. {preview.votes.filter(x => x.holderId !== 'founder').map(x => `${x.name} ${x.yes ? 'yes' : 'no'} (${x.reason})`).join('; ')}</p>}</div>
            <div className="flex gap-2 items-start min-w-0"><select aria-label={`New setting for ${r.label}`} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm" value={sel} onChange={e => setDraft({ ...draft, [r.key]: e.target.value })}>{r.options.map(x => <option key={String(x.value)} value={String(x.value)}>{x.label}</option>)}</select>
              <Button size="sm" className="min-h-10" variant="outline" disabled={val === cur || !!pending || wait > 0 || c.status !== 'running'} onClick={() => run(setC, proposeAmendment(c, r.key, val))}>Propose</Button></div>
          </li>); })}</ul>
        <p className="text-[11px] text-muted-foreground mt-2">Live effects: reserve {money(reserveTarget(c))} · most you can pay owners now {money(maxDistribution(c))} · firm cash {money(firmCash(c))}.</p>
      </Section>
      <Section title="Owners and partners">
        <ul className="space-y-2">{o.holders.filter(h => h.pct > 1e-6).map(h => { const ps = isPartner(h.id) ? partnerState(c, h.id) : null; const price = v * h.pct; return (
          <li key={h.id} className="rounded-md border border-border p-3 text-sm">
            <p className="flex flex-wrap justify-between gap-2"><span className="font-medium flex items-center gap-2"><SenderIdentity c={c} name={h.name} id={h.id} />{h.name}{h.employeeId ? ' (also on staff)' : ''}</span><span className="tabular-nums">{(h.pct * 100).toFixed(1)}% · vote weight {(h.pct * 100).toFixed(1)}%</span></p>
            {ps && <><p className="text-xs text-muted-foreground tabular-nums">Morale {ps.morale} · loyalty {ps.loyalty} · paid {money(h.paid)} to join{ps.grievance ? ` · grievance: ${ps.grievance}` : ''}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button size="sm" variant="outline" className="min-h-10" disabled={c.status !== 'running' || timeLeft(c) < 1 || c.fund.q - ps.lastMetQ < 2} onClick={() => run(setC, meetPartner(c, h.id))}>{c.fund.q - ps.lastMetQ < 2 ? 'Met recently' : timeLeft(c) < 1 ? 'No time left' : 'Meet (1 time point)'}</Button>
                <Button size="sm" variant="outline" className="min-h-10" disabled={c.status !== 'running' || personalCash(c) < price} onClick={() => run(setC, buyoutPartner(c, h.id, v))}>Buy their stake personally ({money(price)})</Button>
                <Button size="sm" variant="ghost" className="min-h-10" disabled={c.status !== 'running' || price > maxDistribution(c)} onClick={() => run(setC, firmBuyback(c, h.id, v, maxDistribution(c)))}>Firm buyback ({money(price)})</Button>
              </div></>}
          </li>); })}</ul>
        <p className="text-[11px] text-muted-foreground mt-2">New partner buy-ins (My Life, Ownership) pay cash into the firm and dilute every holder. Buying a stake personally pays the partner from your cash; a buyback pays from firm cash above the reserve and cancels the shares. Ownership always totals 100%.</p>
      </Section>
      <Section title="Votes">
        {g.votes.length === 0 ? <p className="text-sm text-muted-foreground">No votes yet.</p> : <ul className="text-xs space-y-1">{[...g.votes].reverse().slice(0, 10).map((x, i) => <li key={i}><span className="tabular-nums text-muted-foreground">{x.q > 0 ? quarterLabel(c.fund, x.q) : 'Opening'}</span> {x.topic}: <span className={x.passed ? 'text-gain' : 'text-loss'}>{x.passed ? 'passed' : 'failed'}</span> ({(x.yes * 100).toFixed(0)}% yes, {(x.needed * 100).toFixed(0)}% needed)</li>)}</ul>}
      </Section>
    </div>
  );
}
