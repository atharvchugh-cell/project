import { useId } from 'react';

/** Small SVG line chart for a price series; green when up from the first point, red when down. */
export function PriceChart({ points, labels, height = 160, format = (v: number) => v.toFixed(2) }: { points: number[]; labels?: string[]; height?: number; format?: (v: number) => string }) {
  const id = useId();
  if (points.length < 2) return <p className="text-xs text-muted-foreground">The price chart fills in after the first quarter as a public company.</p>;
  const w = 600; const h = height; const pad = 8;
  const lo = Math.min(...points); const hi = Math.max(...points); const span = hi - lo || hi * 0.05 || 1;
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (h - pad * 2);
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const up = points.at(-1)! >= points[0];
  const color = up ? 'hsl(var(--gain, 142 70% 45%))' : 'hsl(var(--loss, 0 72% 55%))';
  const change = (points.at(-1)! / points[0] - 1) * 100;
  return <figure className="space-y-1">
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} role="img" aria-label={`Share price moved ${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}% from ${format(points[0])} to ${format(points.at(-1)!)}`} preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${x(points.length - 1)},${h} L${x(0)},${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      <circle cx={x(points.length - 1)} cy={y(points.at(-1)!)} r="4" fill={color} />
    </svg>
    <figcaption className="flex justify-between text-[11px] text-muted-foreground tabular-nums"><span>{labels?.[0]}</span><span className={up ? 'text-gain' : 'text-loss'}>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span><span>{labels?.at(-1)}</span></figcaption>
  </figure>;
}
