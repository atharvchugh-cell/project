import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Career } from '@/lib/firm/career';
import { personalCash } from '@/lib/firm/life';
import { MAX_LEVEL, REINVEST_OPTIONS, VENTURES, buyVenture, expandVenture, expansionCost, firmLift, ownedVentures, sellVenture, setVentureReinvest, ventureQuarter, venturesLifetime, ventureValue, venturesOf } from '@/lib/firm/ventures';
import { CareerSection as Section } from './CareerSection';
import { IdentityBadge } from './IdentityBadge';
import { firmMoney as money } from './format';
import { ventureOps } from '@/lib/firm/ventureOps';
import { PriceChart } from './PriceChart';
import { Users, MapPin, Package, PieChart, ChevronDown } from 'lucide-react';

type Set = (c: Career) => void;
type Res = { c: Career; ok: boolean; message: string };
const run = (setC: Set, r: Res) => { if (r.ok) setC(r.c); (r.ok ? toast.success : toast.error)(r.message); };

export function PersonalVentures({ c, setC }: { c: Career; setC: Set }) {
  const mine = ownedVentures(c); const cash = personalCash(c); const live = c.status === 'running';
  const forSale = VENTURES.filter(t => !mine.some(v => v.typeId === t.id));
  const sold = venturesOf(c).filter(v => v.soldQ !== undefined);
  const [open, setOpen] = useState<string | null>(null);
  const lastQ = Math.max(-1, ...venturesOf(c).flatMap(v => v.history.map(h => h.q)));
  const lastRows = venturesOf(c).flatMap(v => v.history.filter(h => h.q === lastQ));
  const made = lastRows.reduce((a, h) => a + h.profit, 0);
  const paidLast = lastRows.reduce((a, h) => a + h.paidOut, 0);
  const next = mine.map(v => ventureQuarter(c, v));
  const fRev = next.reduce((a, r) => a + r.revenue, 0); const fPaid = next.reduce((a, r) => a + r.paidOut, 0);
  const life = venturesLifetime(c);
  const gain = (v: typeof mine[number]) => ventureValue(c, v) * 0.95 - v.invested;
  return (
    <Section title="Your personal businesses">
      <p className="text-xs text-muted-foreground mb-3 tabular-nums">Bought with your personal cash ({money(cash)}). Profits go to your personal cash every quarter and their value counts in your net worth. Businesses linked to finance earn more as your firm manages more money. All are fictional.</p>
      {mine.length > 0 && <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 text-xs tabular-nums">
        {([['Total made by all businesses', life.profit, 'every quarter since buying, kept or sold'], ['Paid to you, all time', life.paid, `${money(life.reinvested)} reinvested into growth`], ['Profit made last quarter', made, lastQ < 0 ? 'No quarter closed yet' : 'all businesses'], ['Paid to you last quarter', paidLast, 'after reinvesting'], ['Forecast revenue next quarter', fRev, `${mine.length} business${mine.length === 1 ? '' : 'es'}`], ['Forecast paid to you', fPaid, 'next close']] as [string, number, string][]).map(([k, val, sub]) => <div key={k} className="career-stat rounded-md border border-border px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className={`text-base font-semibold ${val < 0 ? 'text-loss' : ''}`}>{money(val)}</dd><dd className="text-[11px] text-muted-foreground">{sub}</dd></div>)}
      </dl>}
      {mine.length > 0 && <ul className="space-y-2 mb-4">{mine.map(v => {
        const nx = ventureQuarter(c, v); const lift = firmLift(c, v); const cost = expansionCost(v); const isOpen = open === v.id; const g = gain(v);
        return <li key={v.id} className="career-record rounded-md border border-border text-sm">
          <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : v.id)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
            <IdentityBadge id={v.id} name={v.name} kind={v.industry} stage={v.level - 1} />
            <span className="flex-1 min-w-0"><span className="font-medium block truncate">{v.name}</span><span className="text-[11px] text-muted-foreground">Level {v.level}/{MAX_LEVEL} · value ≈ {money(ventureValue(c, v))}</span></span>
            <span className="text-xs tabular-nums text-right"><span className={nx.profit < 0 ? 'text-loss' : ''}>{money(nx.profit)}</span><span className="block text-[11px] text-muted-foreground">next quarter</span></span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {isOpen && <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
            {([['Next quarter revenue', nx.revenue], ['Costs', nx.cost], ['Reinvested', nx.reinvested], ['To your cash', nx.paidOut]] as [string, number][]).map(([k, val]) => <div key={k} className="rounded border border-border/60 px-2 py-1"><dt className="text-muted-foreground">{k}</dt><dd className={val < 0 ? 'text-loss' : ''}>{money(val)}</dd></div>)}
          </dl>
          {(() => { const o = ventureOps(c, v); return <div className="space-y-3 border-t border-border/60 pt-3">
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
              <div><dt className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Employees</dt><dd className="text-base font-semibold">{o.employees.toLocaleString('en-US')}</dd><dd className="text-muted-foreground">{money(o.revenuePerEmployee)} revenue each</dd></div>
              <div><dt className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Locations</dt><dd className="text-base font-semibold">{o.locations}</dd><dd className="text-muted-foreground">{o.unit}{o.locations === 1 ? '' : 's'}</dd></div>
              <div><dt className="text-muted-foreground flex items-center gap-1"><PieChart className="h-3 w-3" />Market share</dt><dd className="text-base font-semibold">{(o.marketShare * 100).toFixed(1)}%</dd><dd className="text-muted-foreground">of {money(o.marketSizeQ)} a quarter</dd></div>
              <div><dt className="text-muted-foreground">Profit margin</dt><dd className={`text-base font-semibold ${o.margin < 0 ? 'text-loss' : ''}`}>{(o.margin * 100).toFixed(1)}%</dd><dd className="text-muted-foreground">payroll {money(o.payrollQ)}</dd></div>
            </dl>
            <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden><div className="h-full bg-primary" style={{ width: `${Math.max(1, o.marketShare * 100)}%` }} /></div>
            <div><p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Package className="h-3 w-3" />Products</p><ul className="flex flex-wrap gap-1 text-xs">{o.products.map(pr => <li key={pr.name} className={`rounded-full border px-2 py-0.5 ${pr.active ? 'border-primary/50' : 'border-border text-muted-foreground opacity-60'}`}>{pr.name}{pr.active ? ` · ${(pr.share * 100).toFixed(0)}%` : ' · unlock by expanding'}</li>)}</ul></div>
            {o.history.length > 1 && <div><p className="text-xs text-muted-foreground mb-1">Revenue by quarter</p><PriceChart points={o.history.map(h => h.revenue)} height={90} format={money} /></div>}
          </div>; })()}
          {lift > 1.001 && <p className="text-xs text-muted-foreground">Your firm's size adds {((lift - 1) * 100).toFixed(0)}% to revenue.</p>}
          <div className="text-xs"><p className="text-muted-foreground mb-1">Reinvest profit into growth</p><div className="flex flex-wrap gap-1" role="group" aria-label={`Reinvest profit for ${v.name}`}>{REINVEST_OPTIONS.map(p => <Button key={p} size="sm" className="min-h-9" variant={v.reinvestPct === p ? 'secondary' : 'outline'} aria-pressed={v.reinvestPct === p} disabled={!live} onClick={() => run(setC, setVentureReinvest(c, v.id, p))}>{p * 100}%</Button>)}</div></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!live || v.level >= MAX_LEVEL || cash < cost} onClick={() => run(setC, expandVenture(c, v.id))}>{v.level >= MAX_LEVEL ? 'Full size' : `Expand · ${money(cost)}`}</Button>
            <Button size="sm" variant="outline" disabled={!live || v.boughtQ === c.fund.q} onClick={() => run(setC, sellVenture(c, v.id))}>Sell · {money(ventureValue(c, v) * 0.95)}</Button>
          </div>
          <p className="text-xs tabular-nums">Selling now: you get {money(ventureValue(c, v) * 0.95)} after the 5% fee, versus {money(v.invested)} put in. <span className={g < 0 ? 'text-loss' : 'text-gain'}>{g < 0 ? 'Loss' : 'Profit'} {money(Math.abs(g))}</span></p>
          </div>}
        </li>;
      })}</ul>}
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{forSale.map(t => <li key={t.id} className="career-record rounded-md border border-border p-3 text-sm space-y-2">
        <p className="font-medium flex items-center gap-2"><IdentityBadge id={t.id} name={t.name} kind={t.industry} />{t.name}</p>
        <p className="text-xs text-muted-foreground">{t.blurb}</p>
        <p className="text-xs tabular-nums">Profit ≈ {money(t.revenueQ - t.costQ)} a quarter</p>
        <Button size="sm" className="w-full" disabled={!live || cash < t.price} onClick={() => run(setC, buyVenture(c, t.id))}>Buy · {money(t.price)}</Button>
      </li>)}</ul>
      {sold.length > 0 && <p className="text-xs text-muted-foreground mt-3">Sold: {sold.map(v => { const p = (v.salePrice ?? 0) - v.invested; return `${v.name} for ${money(v.salePrice ?? 0)} (${p < 0 ? 'loss' : 'profit'} ${money(Math.abs(p))})`; }).join(', ')}</p>}
    </Section>
  );
}
