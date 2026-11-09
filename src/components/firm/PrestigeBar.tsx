import { Award, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { Career } from '@/lib/firm/career';
import { type Level, performanceProfile } from '@/lib/firm/immersion';

function Meter({ icon: Icon, label, value, level }: { icon: typeof Award; label: string; value: number; level: Level }) {
  const within = level.to > level.from ? Math.min(100, Math.max(0, ((value - level.from) / (level.to - level.from)) * 100)) : 100;
  return <div>
    <p className="flex items-center gap-2 text-sm mb-1"><Icon className="h-4 w-4 text-primary" />{label} · <span className="font-semibold">{level.name}</span><span className="ml-auto tabular-nums text-xs text-muted-foreground">Level {level.level} of {level.of}</span></p>
    <Progress value={within} aria-label={`${label} level ${level.level}, ${Math.round(within)}% to the next level`} />
    <div className="flex gap-0.5 mt-1.5" aria-hidden>{Array.from({ length: level.of }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < level.level ? 'bg-primary' : 'bg-muted'}`} />)}</div>
    <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{value}/100{level.level < level.of ? ` · next level at ${level.to}` : ' · top level'}</p>
  </div>;
}

export function PrestigeBar({ c }: { c: Career }) {
  const p = performanceProfile(c);
  return <section className="border-y border-border py-3 grid sm:grid-cols-2 gap-4" aria-label="Founder standing">
    <Meter icon={Award} label="Prestige" value={p.prestige} level={p.prestigeLevel} />
    <Meter icon={Sparkles} label="Fame" value={p.fame} level={p.fameLevel} />
    <p className="sm:col-span-2 text-xs text-muted-foreground">Last year vs S&amp;P 500: {(p.edge * 100).toFixed(1)} percentage points · {p.winningQuarters} winning quarters in a row · {p.demand > 0 ? 'Investors are noticing your results' : 'Investors await a stronger track record'}. Both climb slowly with years of beating the market.</p>
  </section>;
}
