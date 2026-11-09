import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, CalendarDays } from 'lucide-react';
import { quarterLabel, type FundState } from '@/lib/fund/engine';

/** Investor confidence as an animated bar: slides from last quarter's score to the current one. */
export function FundScoreBar({ s }: { s: FundState }) {
  const current = Math.round(s.confidence);
  const prev = Math.round(s.history.length >= 2 ? s.history[s.history.length - 2].confidence : s.history.length === 1 ? (s.difficulty === 'hard' ? 35 : 65) : current);
  const last = s.history.at(-1);
  const delta = current - prev;
  const reasons = last?.confidenceNotes ?? [];
  const [shown, setShown] = useState(prev);
  useEffect(() => { setShown(prev); const t = window.setTimeout(() => setShown(current), 60); return () => window.clearTimeout(t); }, [prev, current, s.q]);
  const tone = current < 30 ? 'bg-loss' : current < 60 ? 'bg-primary' : 'bg-gain';
  const year = `${s.startYear + Math.floor(s.q / 4)}`;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  return (
    <section aria-label="Investor confidence score" className="rounded-lg border border-border bg-card/60 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 text-primary" /><span className="text-2xl font-semibold tabular-nums">{year}</span><span className="text-muted-foreground">{quarterLabel(s, s.q + 1)} next</span></div>
        <div className="flex items-center gap-3">
          <span key={s.q} className={`fund-enter inline-flex items-center gap-1 text-sm tabular-nums ${delta > 0 ? 'text-gain' : delta < 0 ? 'text-loss' : 'text-muted-foreground'}`}><Icon className="h-4 w-4" />{delta > 0 ? '+' : ''}{delta}</span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Investor confidence</span>
          <span className="text-2xl font-semibold tabular-nums">{current}<span className="text-sm text-muted-foreground">/100</span></span>
        </div>
      </div>
      <div className="relative h-4 rounded-full bg-muted overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={current}>
        <div className={`absolute inset-y-0 left-0 rounded-full ${tone} transition-[width] duration-1000 ease-out motion-reduce:transition-none`} style={{ width: `${shown}%` }} />
        <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: '30%' }} aria-hidden />
      </div>
      {reasons.length > 0 && <ul key={s.q} className="fund-enter flex flex-wrap gap-1.5" aria-label="Why confidence changed">{reasons.map(r => <li key={r.text} className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${r.points >= 0 ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'}`}>{r.text} {r.points >= 0 ? '+' : ''}{r.points}</li>)}</ul>}
      <p className="text-xs text-muted-foreground">Make money and it goes up. Losing quarters and late investor payments bring it down. Below 30 is the danger zone.</p>
    </section>
  );
}
