import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { Subsidiary } from '@/lib/firm/phase3';
import { companyCash, businessQuarter } from '@/lib/firm/business';
import type { Career } from '@/lib/firm/career';
import { firmMoney as money } from './format';

export function BusinessPerformance({ c, s }: { c: Career; s: Subsidiary }) {
  const rows = (s.history ?? []).filter(h => !h.simulated);
  const next = businessQuarter(s, c.fund.q + 1, 0, companyCash(c, s.id));
  const total = rows.reduce((a, h) => a + h.ebitda - (h.interest ?? h.actual?.interestPaid ?? h.debtService), 0);
  return <div className="space-y-3">
    <dl className="grid grid-cols-2 gap-3 tabular-nums text-xs"><div><dt className="text-muted-foreground">Cash accumulated inside</dt><dd className="text-xl font-semibold">{money(companyCash(c, s.id))}</dd></div><div><dt className="text-muted-foreground">Profit after interest{rows.some(h => h.interest === undefined) ? ' (older quarters estimated)' : ''}</dt><dd className={total < 0 ? 'text-loss' : 'text-gain'}>{money(total)}</dd></div></dl>
    {rows.length > 0 && <ChartContainer className="h-44 w-full" config={{ cash: { label: 'Company cash', color: 'hsl(var(--primary))' } }}><AreaChart data={rows}><CartesianGrid vertical={false} /><XAxis dataKey="label" minTickGap={35} /><YAxis tickFormatter={v => money(Number(v))} width={65} /><ChartTooltip content={<ChartTooltipContent formatter={v => money(Number(v))} />} /><Area dataKey="cash" type="monotone" stroke="var(--color-cash)" fill="var(--color-cash)" fillOpacity={0.15} isAnimationActive={false} /></AreaChart></ChartContainer>}
    <dl className="grid grid-cols-2 text-xs gap-x-3 gap-y-1 tabular-nums" aria-label={`${s.name} next quarter profit bridge`}>
      {([['Sales and service revenue', next.revenue], ['Staff, office and service costs', -s.costQ], ['Reinvestment, one-offs and planned cost changes', -(next.cost - s.costQ)], ['Operating profit', next.ebitda], ['Loan interest expense', -next.interest], ['Profit after interest', next.ebitda - next.interest], ['Loan principal (cash, not expense)', -next.principal], ['Cash kept in company', next.retained], ['Net cash to firm', next.net]] as [string, number][]).map(([label, value]) => <div className="contents" key={label}><dt className="text-muted-foreground">{label}</dt><dd className={`text-right ${value < 0 ? 'text-loss' : ''}`}>{money(value)}</dd></div>)}
    </dl>
  </div>;
}