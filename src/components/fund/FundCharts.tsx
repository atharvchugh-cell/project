import { useState } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { useReducedMotion } from 'framer-motion';
import { fundChartData } from '@/lib/fund/board';
import { assetName, quarterLabel, type FundState } from '@/lib/fund/engine';

const colors = ['hsl(var(--primary))', 'hsl(var(--gain))', 'hsl(var(--accent))', 'hsl(var(--muted-foreground))', 'hsl(var(--foreground))'];
const dollars = (v: number) => { const a = Math.abs(v); const [scale, unit] = a >= 1e15 ? [1e15, 'Q'] : a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'B'] : [1e6, 'M']; return `$${(v / Number(scale)).toFixed(2)}${unit}`; };
export function FundPerformance({ s }: { s: FundState }) {
  const reducedMotion = useReducedMotion();
  const [view, setView] = useState<'return' | 'aum' | 'drawdown'>('return');
  const [range, setRange] = useState<'all' | 'year'>('all');
  const all = fundChartData(s);
  const data = range === 'year' ? all.slice(-5) : all;
  const format = (v: number) => view === 'aum' ? dollars(v) : `${v.toFixed(1)}%`;
  return <section aria-label="Fund performance" className="min-w-0 space-y-3">
    <div className="flex flex-wrap gap-3 justify-between items-center"><h2 className="text-lg font-semibold">Fund performance</h2><div className="flex flex-wrap gap-1">
      {(['return', 'aum', 'drawdown'] as const).map(v => <Button key={v} size="sm" variant={v === view ? 'secondary' : 'ghost'} aria-pressed={v === view} onClick={() => setView(v)}>{v === 'return' ? 'Net return' : v === 'aum' ? 'Fund size' : 'Drawdown'}</Button>)}
    </div></div>
    <div className="flex flex-wrap justify-between gap-2 text-xs"><p className="text-muted-foreground">{view === 'return' ? 'Your fund vs S&P 500 · after fees, per unit' : view === 'aum' ? 'Net assets · includes investor deposits and withdrawals, not a return measure' : 'Per-unit decline from peak NAV · Hard starts below its inherited peak'}</p>
      <div className="flex gap-1">{(['all', 'year'] as const).map(r => <Button key={r} size="sm" variant={range === r ? 'outline' : 'ghost'} aria-pressed={range === r} onClick={() => setRange(r)}>{r === 'all' ? 'All time' : 'Last year'}</Button>)}</div></div>
    {view === 'return' && all.length > 1 && (() => { const last = all[all.length - 1]; const gap = last.return - last.benchmark; return <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums" aria-label="Legend">
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" />Your fund {last.return.toFixed(1)}%</span>
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-muted-foreground" />S&amp;P 500 {last.benchmark.toFixed(1)}%</span>
      <span className={gap >= 0 ? 'text-gain' : 'text-loss'}>Gap {gap >= 0 ? '+' : ''}{gap.toFixed(1)} pts</span></div>; })()}
    {all.length <= 1 ? <div className="h-40 sm:h-56 rounded-md border border-dashed border-border flex items-center justify-center p-4 text-center"><p className="text-sm text-muted-foreground max-w-sm">No completed quarters yet. The first observation appears after the first quarter closes, measured from the starting NAV.</p></div> :
    <div className="h-64 sm:h-80" role="img" aria-label={`${view === 'return' ? 'Net investor return and benchmark' : view === 'aum' ? 'Fund size' : 'Drawdown'} over completed quarters`}>
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 5" vertical={false} />
        <XAxis dataKey="q" fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={q => q === 0 ? 'Start' : `Y${Math.ceil(q / 4)} Q${(q - 1) % 4 + 1}`} minTickGap={40} interval="preserveStartEnd" />
        <YAxis fontSize={11} width={56} tickCount={5} stroke="hsl(var(--muted-foreground))" tickFormatter={format} />
        <Tooltip formatter={(v: number) => format(v)} labelFormatter={q => Number(q) === 0 ? 'Start' : quarterLabel(s, Number(q))} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--primary) / 0.4)', borderRadius: 8, color: 'hsl(var(--popover-foreground))' }} labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }} itemStyle={{ color: 'hsl(var(--foreground))' }} />
        <ReferenceLine y={0} stroke="hsl(var(--border))" />
        <Area type="linear" dataKey={view} name={view === 'return' ? 'Your fund' : view === 'aum' ? 'Net assets' : 'Drawdown'} stroke={view === 'drawdown' ? 'hsl(var(--loss))' : 'hsl(var(--primary))'} fill={view === 'drawdown' ? 'hsl(var(--loss))' : 'hsl(var(--primary))'} fillOpacity={0.1} strokeWidth={2} isAnimationActive={!reducedMotion} animationDuration={650} />
        {view === 'return' && <Line type="linear" dataKey="benchmark" name="S&P 500" stroke="hsl(var(--muted-foreground))" dot={false} strokeWidth={1.5} isAnimationActive={!reducedMotion} animationDuration={650} />}
      </ComposedChart></ResponsiveContainer>
    </div>}
    <p className="text-xs text-muted-foreground">Quarter-end observations. Real annual returns; simulated within-year paths. Deposits never count as profit.</p>
  </section>;
}

export function FundAllocation({ s, pending = false, highlight }: { s: FundState; pending?: boolean; highlight?: string }) {
  const reducedMotion = useReducedMotion();
  const parts = [...Object.entries(s.ledger.positions).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([ticker, value]) => ({ key: ticker, name: assetName(ticker), value })), { key: 'cash', name: 'Cash', value: s.ledger.cash }, { key: 'locked', name: 'Locked legacy deal', value: s.ledger.locked }].filter(x => x.value > 0);
  const total = Math.max(1, parts.reduce((a, x) => a + x.value, 0));
  return <section aria-label="Fund allocation" className="border-t border-border pt-4 flex flex-wrap gap-5 items-center">
    <div className="h-56 w-56 shrink-0 mx-auto sm:mx-0 relative" role="img" aria-label="Portfolio allocation by gross asset value"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={parts} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={1} stroke="hsl(var(--background))" isAnimationActive={!reducedMotion} animationDuration={500}>{parts.map((p, i) => <Cell key={p.key} fill={p.key === 'cash' ? 'hsl(var(--muted))' : colors[i % colors.length]} opacity={highlight && p.key !== highlight ? 0.55 : 1} stroke={p.key === highlight ? 'hsl(var(--foreground))' : 'hsl(var(--background))'} strokeWidth={p.key === highlight ? 2 : 1} />)}</Pie><Tooltip formatter={(v: number) => `${(v / total * 100).toFixed(1)}%`} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} /></PieChart></ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{pending ? 'After orders' : 'Now'}</span><span className="text-lg font-semibold tabular-nums">{dollars(total)}</span></div></div>
    <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold mb-2 flex items-center gap-2">Capital allocation{pending && <span className="text-[10px] uppercase tracking-wider rounded-full bg-primary/15 text-primary px-2 py-0.5 animate-pulse motion-reduce:animate-none">Preview</span>}</h3><div className="grid sm:grid-cols-2 gap-x-5 gap-y-1.5 text-sm">{parts.map((p, i) => <p key={p.key} className={`flex justify-between gap-2 ${p.key === highlight ? 'font-semibold text-foreground' : ''}`}><span className="flex items-center gap-2 truncate text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.key === 'cash' ? 'hsl(var(--muted))' : colors[i % colors.length] }} />{p.name}</span><span className="tabular-nums">{(p.value / total * 100).toFixed(1)}%</span></p>)}</div><p className="text-xs text-muted-foreground mt-2">{pending ? 'Shows your fund after this quarter’s orders, including trade costs.' : 'Weights include cash and locked assets, before outstanding liabilities.'}</p></div>
  </section>;
}
