import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Slice } from '@/lib/portfolioBreakdown';

export const PIE_PALETTE = [
  'hsl(160,84%,39%)', 'hsl(200,80%,55%)', 'hsl(45,90%,55%)', 'hsl(265,70%,65%)',
  'hsl(15,85%,58%)', 'hsl(330,70%,62%)', 'hsl(95,55%,50%)', 'hsl(215,15%,55%)',
];

export function sliceColor(s: Slice, i: number) {
  if (s.key === 'cash') return 'hsl(215,15%,45%)';
  if (s.key === 'other') return 'hsl(215,10%,35%)';
  return PIE_PALETTE[i % PIE_PALETTE.length];
}

export function PortfolioPie({ slices, size = 96 }: { slices: Slice[]; size?: number }) {
  if (slices.length === 0) return null;
  return (
    <div style={{ width: size, height: size }} className="shrink-0" role="img" aria-label={`Portfolio mix: ${slices.map(s => `${s.label} ${s.pct.toFixed(1)}%`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="100%" stroke="none" isAnimationActive={false}>
            {slices.map((s, i) => <Cell key={s.key} fill={sliceColor(s, i)} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'hsl(220,20%,10%)', border: '1px solid hsl(220,15%,20%)', borderRadius: '10px', fontSize: '11px' }}
            itemStyle={{ color: 'hsl(215,20%,85%)' }}
            formatter={(_v: number, _n: string, p: { payload?: Slice }) => [`${p.payload?.pct.toFixed(1)}%`, p.payload?.label]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SliceLegend({ slices }: { slices: Slice[] }) {
  return (
    <ul className="space-y-1 min-w-0 flex-1">
      {slices.map((s, i) => (
        <li key={s.key} className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sliceColor(s, i) }} />
            <span className="truncate text-foreground/80">{s.label}</span>
          </span>
          <span className="font-mono text-muted-foreground">{s.pct.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}
