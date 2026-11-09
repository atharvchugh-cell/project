import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { netAssets } from '@/lib/fund/accounting';
import type { Career } from '@/lib/firm/career';
import { assign, sectorsNow } from '@/lib/firm/phase2';
import type { Employee } from '@/lib/firm/roster';
import { MAX_DELEGATED, researchNote, researchRate, setMandate, trackRecord, train, trainCooldown } from '@/lib/firm/staff';
import { cashForecast } from '@/lib/firm/forecast';
import { firmMoney as money, firmPct as pct } from './format';

/** Research, training, delegated sleeve and track record for one employee. Every control changes saved state. */
export function StaffDesk({ c, setC, e }: { c: Career; setC: (c: Career) => void; e: Employee }) {
  const [open, setOpen] = useState(false);
  const sectors = sectorsNow(c);
  const rate = researchRate(c, e);
  const tr = trackRecord(c, e.id);
  const aum = netAssets(c.fund.ledger);
  const cd = trainCooldown(c, e);
  const m = e.mandate;
  const [share, setShare] = useState(m ? m.budget / Math.max(1, aum) : 0.03);
  const [maxPos, setMaxPos] = useState(m?.maxPosition ?? 0.02);
  const [minConv, setMinConv] = useState(m?.minConviction ?? 3);
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2"><span className="text-muted-foreground shrink-0">Research</span>
        <Select value={e.assignment ?? 'none'} onValueChange={v => setC(assign(c, e.id, v === 'none' ? null : v))}><SelectTrigger className="h-8 text-xs" aria-label={`Research sector for ${e.name}`}><SelectValue /></SelectTrigger><SelectContent className="firm-theme"><SelectItem value="none">Not assigned</SelectItem>{sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        {e.assignment && <span className="tabular-nums shrink-0">{Math.round(e.progress * 100)}%</span>}</div>
      <p className="text-[11px] text-muted-foreground">{researchNote(e)} · {Math.round(rate * 100)}% of a pitch a quarter{e.assignment ? `, next pitch in about ${Math.max(1, Math.ceil((1 - e.progress) / rate))} quarter(s)` : ''}. Pitches use only completed results; higher ability gives better-calibrated conviction, not guaranteed returns.</p>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" disabled={cd > 0 || c.status !== 'running'} onClick={() => { const r = train(c, e.id); setC(r.c); toast(r.message); }}>{cd > 0 ? `Training in ${cd} qtr` : `Train · ${money(e.salaryQ * 0.15)}`}</Button>
        <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(x => !x)}>{m ? `Sleeve ${money(m.budget)}` : 'Delegate a sleeve'}</Button>
      </div>
      {open && <div className="rounded border border-primary/40 p-2 space-y-2 fund-enter">
        <p className="text-[11px] text-muted-foreground">When {e.name} pitches with enough conviction, the idea is bought automatically at the next close using normal fund cash, and shows in your plan first. All sleeves together are capped at {MAX_DELEGATED * 100}% of the fund.</p>
        <label className="grid gap-1"><span>Budget: {pct(share).replace('+', '')} of fund ({money(share * aum)})</span><input type="range" min={0.01} max={MAX_DELEGATED} step={0.01} value={share} onChange={x => setShare(Number(x.target.value))} aria-label="Sleeve budget share of fund" /></label>
        <label className="grid gap-1"><span>Max per position: {(maxPos * 100).toFixed(0)}% of fund</span><input type="range" min={0.01} max={0.05} step={0.01} value={maxPos} onChange={x => setMaxPos(Number(x.target.value))} aria-label="Maximum position size" /></label>
        <label className="grid gap-1"><span>Minimum conviction: {minConv} of 5</span><input type="range" min={1} max={5} step={1} value={minConv} onChange={x => setMinConv(Number(x.target.value))} aria-label="Minimum conviction" /></label>
        <div className="flex gap-2"><Button size="sm" onClick={() => { setC(setMandate(c, e.id, { budget: share * aum, maxPosition: maxPos, minConviction: minConv })); setOpen(false); toast(`${e.name} now runs a sleeve.`); }} disabled={!e.assignment}>Save mandate</Button>
          {m && <Button size="sm" variant="ghost" onClick={() => { setC(setMandate(c, e.id, null)); setOpen(false); }}>End sleeve</Button>}</div>
        {!e.assignment && <p className="text-[11px] text-loss">Assign a research sector first; a sleeve only buys this person's own pitches.</p>}
      </div>}
      <div className="rounded border border-border bg-muted/30 px-2 py-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
        <span className="text-muted-foreground">Pitches / reviewed</span><span className="text-right">{tr.pitched} / {tr.reviewed}{tr.hitRate !== null ? ` · ${Math.round(tr.hitRate * 100)}% beat S&P` : ''}</span>
        {(m || tr.proposed > 0) && <><span className="text-muted-foreground">Sleeve proposed / filled</span><span className="text-right">{money(tr.proposed)} / {money(tr.filled)}</span>
          <span className="text-muted-foreground">Capital in open ideas</span><span className="text-right">{money(tr.open)}</span></>}
        <span className="text-muted-foreground">Bought (actual fills)</span><span className="text-right">{tr.funded ? money(tr.filled) : 'none yet'}</span>
        {tr.funded > 0 && <><span className="text-muted-foreground">Still held, market value</span><span className="text-right">{money(tr.value)}</span>
          <span className="text-muted-foreground">Realized / unrealized{tr.estimatedSplit ? ' (estimated split)' : ''}</span><span className="text-right">{money(tr.realized)} / {money(tr.unrealized)}</span>
          <span className="text-muted-foreground">Actual P&amp;L after {money(tr.costs)} costs</span><span className={`text-right ${tr.pnl >= 0 ? 'text-gain' : 'text-loss'}`}>{money(tr.pnl)}</span>
          <span className="text-muted-foreground">Same money in the S&amp;P 500</span><span className="text-right">{money(tr.benchPnl)}</span>
          <span className="text-muted-foreground">Edge vs S&amp;P 500</span><span className={`text-right ${tr.vsBench >= 0 ? 'text-gain' : 'text-loss'}`}>{money(tr.vsBench)}</span></>}
        {tr.period && <span className="col-span-2 text-[10px] text-muted-foreground">Period: {tr.period}. From actual trade receipts, including partial fills, sales and trading costs. The one-year idea review is a separate hypothetical.</span>}
      </div>
    </div>
  );
}

/** Runway change if this person were hired, previewed before committing. */
export function hirePreview(c: Career, salaryQ: number) {
  const before = cashForecast(c, 0, 8); const after = cashForecast(c, 0, 8, { extraCostQ: salaryQ });
  const end = (f: typeof before) => f.rows.at(-1)?.cash ?? 0;
  return { delta: end(after) - end(before), short: after.firstShort?.label ?? null };
}
