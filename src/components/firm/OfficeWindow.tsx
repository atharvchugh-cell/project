// Decorative office window: a quiet skyline seen through mullions. Deterministic per firm, CSS tokens only.
import { mulberry32 } from '@/lib/fund/market';

export function OfficeWindow({ seed, tier }: { seed: number; tier: string }) {
  const r = mulberry32(seed);
  const count = tier === 'boutique' ? 9 : tier === 'global' ? 16 : 12;
  const towers = Array.from({ length: count }, (_, i) => {
    const w = 34 + r() * 40; const h = (tier === 'boutique' ? 50 : 70) + r() * (tier === 'global' ? 150 : 110);
    return { x: (i / count) * 1000 + r() * 20, w, h, far: i % 2 === 0 };
  });
  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 1000 260" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="ow-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="hsl(var(--background))" /><stop offset="1" stopColor="hsl(var(--secondary))" /></linearGradient>
        <linearGradient id="ow-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="hsl(var(--primary))" stopOpacity="0.07" /><stop offset="0.5" stopColor="hsl(var(--primary))" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="1000" height="260" fill="url(#ow-sky)" />
      {towers.map((t, i) => (
        <g key={i} opacity={t.far ? 0.45 : 0.8}>
          <rect x={t.x} y={260 - t.h} width={t.w} height={t.h} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.6" />
          {Array.from({ length: Math.floor(t.h / 14) }, (_, row) => Array.from({ length: Math.floor(t.w / 10) }, (_, col) => {
            const lit = mulberry32(seed + i * 97 + row * 13 + col)() > 0.8;
            return lit ? <rect key={`${row}-${col}`} x={t.x + 4 + col * 10} y={260 - t.h + 6 + row * 14} width="4" height="5" fill="hsl(var(--primary))" opacity="0.45" /> : null;
          }))}
        </g>
      ))}
      <rect width="1000" height="260" fill="url(#ow-glass)" />
      {[250, 500, 750].map(x => <rect key={x} x={x - 3} y="0" width="6" height="260" fill="hsl(var(--background))" opacity="0.85" />)}
      <rect x="0" y="0" width="1000" height="5" fill="hsl(var(--background))" opacity="0.85" />
    </svg>
  );
}
