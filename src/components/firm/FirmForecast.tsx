import { useEffect, useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type Career, salaryAt } from '@/lib/firm/career';
import { type ForecastRow, type WhatIf, cashForecast } from '@/lib/firm/forecast';
import { expectedContributions } from '@/lib/firm/phase4';
import { personalForecast } from '@/lib/firm/life';
import { firmMoney as money } from './format';

type Scen = 'base' | 'down' | 'up';
const DEFAULT_RET: Record<Scen, number> = { base: 0, down: -5, up: 3 };
const LABEL: Record<Scen, string> = { base: 'Base', down: 'Downside', up: 'Upside' };
const parse = (v: string) => { const n = Number(v.replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };

/** Axis ticks at round numbers so the chart never hides its scale. */
function ticks(lo: number, hi: number, n = 4) {
  const span = Math.max(1, hi - lo); const raw = span / n; const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw) ?? raw;
  const out: number[] = []; const top = Math.ceil(hi / step) * step; for (let v = Math.floor(lo / step) * step; v <= top + step * 0.01; v += step) out.push(v);
  return out;
}

/** Narrow screens draw the chart at phone size so labels stay readable instead of shrinking with the SVG. */
function useNarrow() {
  const q = '(max-width: 640px)';
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(q).matches);
  useEffect(() => { const m = window.matchMedia?.(q); if (!m) return; const f = () => setN(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return !!n;
}

function BalanceChart({ rows, alt, reserve, title }: { rows: { label: string; cash: number; short?: boolean }[]; alt?: { cash: number }[]; reserve?: number; title: string }) {
  const id = useId(); const narrow = useNarrow();
  const W = narrow ? 360 : 640, H = narrow ? 220 : 200, L = narrow ? 54 : 64, R = 12, T = 12, B = 28;
  const every = narrow ? Math.ceil(rows.length / 4) : rows.length <= 8 ? 1 : 2;
  const vals = [...rows.map(r => r.cash), ...(alt ?? []).map(r => r.cash), reserve ?? 0, 0];
  const lo = Math.min(...vals), hi = Math.max(...vals, lo + 1);
  const tk = ticks(lo, hi); const y0 = tk[0], y1 = tk[tk.length - 1];
  const x = (i: number) => L + (rows.length <= 1 ? 0 : (i / (rows.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - (v - y0) / Math.max(1, y1 - y0)) * (H - T - B);
  const path = (xs: { cash: number }[]) => xs.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.cash).toFixed(1)}`).join(' ');
  return (
    <figure className="min-w-0">
      <figcaption className="text-xs text-muted-foreground mb-1">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-labelledby={id}>
        <title id={id}>{title}: {rows.map(r => `${r.label} ${money(r.cash)}`).join(', ')}</title>
        {tk.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-foreground/60' : 'stroke-border'} strokeWidth={v === 0 ? 1.2 : 1} /><text x={L - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[11px]">{money(v)}</text></g>)}
        {reserve !== undefined && reserve > 0 && <g><line x1={L} x2={W - R} y1={y(reserve)} y2={y(reserve)} className="stroke-loss" strokeDasharray="5 4" /><text x={W - R} y={y(reserve) - 4} textAnchor="end" className="fill-loss text-[11px]">reserve {money(reserve)}</text></g>}
        <path d={`${path(rows)} L${x(rows.length - 1)},${y(Math.max(y0, 0))} L${x(0)},${y(Math.max(y0, 0))} Z`} className="fill-primary/10" />
        {alt && <path d={path(alt)} fill="none" className="stroke-accent" strokeWidth={2} strokeDasharray="6 4" />}
        <path d={path(rows)} fill="none" className="stroke-primary" strokeWidth={2.2} />
        {rows.map((r, i) => <g key={i}><circle cx={x(i)} cy={y(r.cash)} r={3.2} className={r.short ? 'fill-loss' : 'fill-primary'}><title>{`${r.label}: ${money(r.cash)}`}</title></circle>
          {i % every === 0 && <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">{r.label}</text>}</g>)}
      </svg>
    </figure>
  );
}

/** Diverging bars per quarter: money in above zero, money out below, net change marked. Its own scale, labelled. */
function FlowChart({ rows }: { rows: ForecastRow[] }) {
  const id = useId(); const narrow = useNarrow();
  const W = narrow ? 360 : 640, H = narrow ? 220 : 200, L = narrow ? 54 : 64, R = 12, T = 12, B = 28;
  const every = narrow ? Math.ceil(rows.length / 4) : rows.length <= 8 ? 1 : 2;
  const inn = (r: ForecastRow) => r.fees + r.staff + Math.max(0, r.business);
  const out = (r: ForecastRow) => r.core + r.salary + Math.max(0, -r.business);
  const hi = Math.max(1, ...rows.map(inn)); const lo = -Math.max(1, ...rows.map(out));
  const tk = ticks(lo, hi); const y0 = tk[0], y1 = tk[tk.length - 1];
  const y = (v: number) => T + (1 - (v - y0) / Math.max(1, y1 - y0)) * (H - T - B);
  const bw = (W - L - R) / rows.length;
  return (
    <figure className="min-w-0">
      <figcaption className="text-xs text-muted-foreground mb-1">Firm cash flow each quarter (money in above zero, out below; ◆ = net change)</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-labelledby={id}>
        <title id={id}>Quarterly firm cash flows: {rows.map(r => `${r.label} in ${money(inn(r))}, out ${money(out(r))}`).join('; ')}</title>
        {tk.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-foreground/60' : 'stroke-border'} strokeWidth={v === 0 ? 1.2 : 1} /><text x={L - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[11px]">{money(v)}</text></g>)}
        {rows.map((r, i) => { const cx = L + bw * i + bw * 0.2; const w = bw * 0.6; const net = r.cash - r.opening;
          const segIn = [{ v: r.fees, cls: 'fill-gain/80', l: 'Fees' }, { v: r.staff, cls: 'fill-primary/80', l: 'Staff services' }, { v: Math.max(0, r.business), cls: 'fill-accent/80', l: 'Business net' }];
          const segOut = [{ v: r.core, cls: 'fill-loss/80', l: 'Payroll, office, owed bills' }, { v: r.salary, cls: 'fill-loss/45', l: 'Your salary' }, { v: Math.max(0, -r.business), cls: 'fill-accent/40', l: 'Business loss' }];
          let up = 0, dn = 0;
          return <g key={r.q}>
            {segIn.filter(s => s.v > 0).map(s => { const top = y(up + s.v), bot = y(up); up += s.v; return <rect key={s.l} x={cx} width={w} y={top} height={Math.max(0.5, bot - top)} className={s.cls}><title>{`${r.label} · ${s.l}: +${money(s.v)}`}</title></rect>; })}
            {segOut.filter(s => s.v > 0).map(s => { const top = y(-dn), bot = y(-dn - s.v); dn += s.v; return <rect key={s.l} x={cx} width={w} y={top} height={Math.max(0.5, bot - top)} className={s.cls}><title>{`${r.label} · ${s.l}: −${money(s.v)}`}</title></rect>; })}
            <path d={`M${cx + w / 2},${y(net) - 4} l4,4 l-4,4 l-4,-4 Z`} className={net >= 0 ? 'fill-foreground' : 'fill-loss'}><title>{`${r.label} net change: ${net >= 0 ? '+' : ''}${money(net)}`}</title></path>
            {i % every === 0 && <text x={cx + w / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">{r.label}</text>}
          </g>; })}
      </svg>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-1">
        <span><i className="inline-block w-2.5 h-2.5 bg-gain/80 mr-1 align-middle" />Fees</span><span><i className="inline-block w-2.5 h-2.5 bg-primary/80 mr-1 align-middle" />Staff services</span><span><i className="inline-block w-2.5 h-2.5 bg-accent/80 mr-1 align-middle" />Owned businesses</span>
        <span><i className="inline-block w-2.5 h-2.5 bg-loss/80 mr-1 align-middle" />Payroll, office, owed bills</span><span><i className="inline-block w-2.5 h-2.5 bg-loss/45 mr-1 align-middle" />Your salary</span>
      </p>
    </figure>
  );
}

export function FirmForecast({ c }: { c: Career }) {
  const [book, setBook] = useState<'firm' | 'personal'>('firm');
  const [horizon, setHorizon] = useState(8);
  const [scen, setScen] = useState<Scen>('base');
  const [rets, setRets] = useState<Record<Scen, string>>({ base: '0', down: '-5', up: '3' });
  const [extra, setExtra] = useState('');
  const [once, setOnce] = useState('');
  const ret = parse(rets[scen]) / 100;
  const w: WhatIf = { extraCostQ: parse(extra), oneTime: parse(once) };
  const hasWhatIf = (w.extraCostQ ?? 0) !== 0 || (w.oneTime ?? 0) !== 0;
  const base = useMemo(() => cashForecast(c, ret, horizon), [c, ret, horizon]);
  const what = useMemo(() => (hasWhatIf ? cashForecast(c, ret, horizon, w) : null), [c, ret, horizon, hasWhatIf, w.extraCostQ, w.oneTime]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = what ?? base;
  const personal = useMemo(() => personalForecast(c, horizon, q => salaryAt(c, q)), [c, horizon]);
  const inflow = expectedContributions(c).reduce((a, x) => a + x.amount, 0);
  const calls = c.calls.filter(k => !k.settled).reduce((a, k) => a + k.amount, 0);
  // Reasons a row changed: the biggest component moving from one quarter to the next.
  const reasons = f.rows.slice(1).map((r, i) => { const p = f.rows[i]; const d = [
    { k: 'fees', v: r.fees - p.fees, t: 'fees' }, { k: 'core', v: -(r.core - p.core), t: 'bills (owed bills paid, payroll or office)' }, { k: 'salary', v: -(r.salary - p.salary), t: 'your salary' }, { k: 'business', v: r.business - p.business, t: 'owned businesses' },
  ].sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0]; return Math.abs(d.v) > 1 ? `${r.label}: cash change ${d.v >= 0 ? 'improves' : 'worsens'} by ${money(Math.abs(d.v))} mainly from ${d.t} versus the quarter before.` : null; }).filter(Boolean) as string[];

  return (
    <section className="career-section min-w-0 space-y-4" aria-label="Cash forecast">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Cash forecast</h2>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Which book">
          {(['firm', 'personal'] as const).map(b => <Button key={b} size="sm" variant={book === b ? 'secondary' : 'ghost'} aria-pressed={book === b} onClick={() => setBook(b)}>{b === 'firm' ? 'Firm book' : 'Personal book'}</Button>)}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="grid gap-1"><span className="text-muted-foreground">Horizon</span>
          <select className="h-9 rounded-md border border-input bg-background px-2" value={horizon} onChange={e => setHorizon(Number(e.target.value))}>{[4, 8, 12, 20].map(h => <option key={h} value={h}>{h} quarters</option>)}</select></label>
        {book === 'firm' && <>
          <div className="grid gap-1"><span className="text-muted-foreground">Scenario</span><div className="flex gap-1">{(['down', 'base', 'up'] as Scen[]).map(s => <Button key={s} size="sm" variant={scen === s ? 'secondary' : 'outline'} aria-pressed={scen === s} onClick={() => setScen(s)}>{LABEL[s]}</Button>)}</div></div>
          <label className="grid gap-1"><span className="text-muted-foreground">Fund return a quarter (%)</span><Input className="h-9 w-24" inputMode="decimal" value={rets[scen]} onChange={e => setRets({ ...rets, [scen]: e.target.value })} aria-label={`${LABEL[scen]} fund return per quarter, percent (default ${DEFAULT_RET[scen]})`} /></label>
          <label className="grid gap-1"><span className="text-muted-foreground">What if: extra cost a quarter ($)</span><Input className="h-9 w-36" inputMode="decimal" placeholder="e.g. a hire" value={extra} onChange={e => setExtra(e.target.value)} /></label>
          <label className="grid gap-1"><span className="text-muted-foreground">What if: one-time payment now ($)</span><Input className="h-9 w-36" inputMode="decimal" placeholder="e.g. fit-out" value={once} onChange={e => setOnce(e.target.value)} /></label>
        </>}
      </div>

      {book === 'firm' ? <>
        <p className={`text-sm ${f.firstShort ? 'text-loss' : 'text-gain'}`} role="status">
          {f.firstShort ? `First shortfall: ${f.firstShort.label}. Firm cash cannot cover every bill.` : `Firm cash covers every bill for ${f.rows.length} quarters.`}
          {' '}{f.firstBelowReserve ? <span className="text-loss">Below the {f.reserveQuarters}-quarter reserve from {f.firstBelowReserve.label}.</span> : <span className="text-muted-foreground">Stays above the {f.reserveQuarters}-quarter reserve.</span>}
          {what && <span className="block text-xs text-accent">Dashed line = with your what-if. Ending cash {money(what.rows.at(-1)?.cash ?? 0)} vs {money(base.rows.at(-1)?.cash ?? 0)} today ({money((what.rows.at(-1)?.cash ?? 0) - (base.rows.at(-1)?.cash ?? 0))}).</span>}
        </p>
        <div className="grid xl:grid-cols-2 gap-6">
          <BalanceChart title="Firm cash balance at each close" rows={base.rows} alt={what?.rows} reserve={f.rows[0]?.reserve} />
          <FlowChart rows={f.rows} />
        </div>
        {reasons.length > 0 && <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">{reasons.slice(0, 4).map(r => <li key={r}>{r}</li>)}</ul>}
        <div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-xs tabular-nums"><thead><tr className="text-[10px] uppercase text-muted-foreground text-left"><th className="py-1 pr-3 font-medium">Quarter</th><th className="text-right px-2 font-medium">Opening</th><th className="text-right px-2 font-medium">Fees</th><th className="text-right px-2 font-medium">Staff services</th><th className="text-right px-2 font-medium">Businesses</th><th className="text-right px-2 font-medium">Bills</th><th className="text-right px-2 font-medium">Salary</th><th className="text-right px-2 font-medium">Change</th><th className="text-right pl-2 font-medium">Closing</th></tr></thead>
          <tbody>{f.rows.map(r => <tr key={r.q} className={`border-t border-border ${r.short ? 'text-loss' : ''}`}><td className="py-1 pr-3 whitespace-nowrap">{r.label}{r.short ? ' · short' : r.belowReserve ? ' · below reserve' : ''}</td><td className="text-right px-2">{money(r.opening)}</td><td className="text-right px-2 text-gain">+{money(r.fees)}</td><td className="text-right px-2 text-primary">+{money(r.staff)}</td><td className="text-right px-2">{r.business >= 0 ? '+' : ''}{money(r.business)}{r.integrating ? ' (integrating)' : ''}</td><td className="text-right px-2">−{money(r.core)}</td><td className="text-right px-2">−{money(r.salary)}{r.salary < r.plannedSalary ? ' (skipped)' : ''}</td><td className="text-right px-2">{money(r.cash - r.opening)}</td><td className="text-right pl-2 font-medium">{money(r.cash)}</td></tr>)}</tbody></table></div>
        <p className="text-[11px] text-muted-foreground">Management fees use each client's whole invested balance and agreed rate, paid from fund assets. Conditional contributions next close {money(inflow)} and open calls {money(calls)} go into the fund, never firm revenue; uncertain new money is excluded from this conservative projection. Contributions received at closing increase the following quarter's fee base. Manager acquisition loan service is included in business net cash and the reserve. The projection uses current team, salary schedule, bills, company operations and your scenario return, never future market data.</p>
        {f.rows.some(r => r.managerDebt > 0) && <p className="text-xs tabular-nums">Next manager acquisition and public corporate debt service: {money(f.rows[0]?.managerDebt ?? 0)} from firm cash, included in net cash and reserves.</p>}
      </> : <>
        <p className={`text-sm ${personal.some(r => r.short) ? 'text-loss' : 'text-gain'}`} role="status">{personal.find(r => r.short) ? `Personal cash runs short in ${personal.find(r => r.short)?.label}; personal bills would become overdue.` : 'Projected personal cash covers upkeep and family bills over this horizon.'}</p>
        <BalanceChart title="Personal cash at each close" rows={personal} />
        <div className="overflow-x-auto"><table className="w-full min-w-[28rem] text-xs tabular-nums"><thead><tr className="text-[10px] uppercase text-muted-foreground text-left"><th className="py-1 pr-3 font-medium">Quarter</th><th className="text-right px-2 font-medium">Salary</th><th className="text-right px-2 font-medium">Personal bills</th><th className="text-right pl-2 font-medium">Personal cash</th></tr></thead>
          <tbody>{personal.map(r => <tr key={r.q} className={`border-t border-border ${r.short ? 'text-loss' : ''}`}><td className="py-1 pr-3">{r.label}</td><td className="text-right px-2 text-gain">+{money(r.salary)}</td><td className="text-right px-2">−{money(r.upkeep + r.family)}</td><td className="text-right pl-2">{money(r.cash)}</td></tr>)}</tbody></table></div>
        <p className="text-[11px] text-muted-foreground">Bills include upkeep, childcare, school, college and remaining student-loan payments. Leaves out distributions, sales and life choices you have not made yet, and assumes salary is paid in full.</p>
      </>}
    </section>
  );
}
