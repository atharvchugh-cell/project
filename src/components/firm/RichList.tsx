import { useState } from 'react';
import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Career, founderStake } from '@/lib/firm/career';
import { founderEquityValue } from '@/lib/firm/exit';
import { netWorth } from '@/lib/firm/life';
import { richList } from '@/lib/firm/billionaires';
import { firmMoney as money } from './format';
import { SenderIdentity } from './SenderIdentity';
import { CareerSection as Section } from './CareerSection';

export function RichList({ c }: { c: Career }) {
  const worth = netWorth(c, founderEquityValue(c), founderStake(c)).total;
  const list = richList('You', worth, c.firmName);
  const [view, setView] = useState<'top' | 'all' | 'timeline'>('top');
  const rows = view === 'top' ? list.rows : list.all;
  const timeline = [...list.all.filter(r => !r.you), { id: 'you', name: `You (${c.firmName})`, started: c.fund.startYear, origin: 'Opened your firm with your first clients.', you: true, worth, source: c.firmName, rank: list.you?.rank ?? 0 }].sort((a, b) => (a.started ?? 0) - (b.started ?? 0));
  const progress = Math.min(100, Math.max(0, (worth / 150e9) * 100));
  return <Section title="World's richest people">
    <p className="text-sm text-muted-foreground mb-3">{list.onList ? `You are number ${list.you!.rank} in the world.` : `Your net worth is ${money(worth)}. The list starts at ${money(150e9)}: ${money(list.toGo)} to go.`}</p>
    {!list.onList && <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to the rich list"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div>}
    <div className="flex flex-wrap gap-1 mb-3" role="tablist" aria-label="Rich list view">{([['top', 'Top 10'], ['all', `All ${list.all.length}`], ['timeline', 'Where they started']] as const).map(([k, l]) => <Button key={k} size="sm" role="tab" aria-selected={view === k} variant={view === k ? 'secondary' : 'ghost'} onClick={() => setView(k)}>{l}</Button>)}</div>
    {view === 'timeline' ? <ol className="relative border-l border-border ml-3 space-y-4">{timeline.map(r => <li key={r.id} className="pl-5 relative"><span className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ${r.you ? 'bg-primary' : 'bg-muted-foreground'}`} aria-hidden /><p className="text-xs font-semibold tabular-nums text-primary">{r.started}</p><div className="flex items-center gap-3 mt-1">{'photo' in r && r.photo ? <img src={r.photo} alt={r.name} width={40} height={40} loading="lazy" className="h-10 w-10 rounded-full object-cover object-top border border-border" /> : <SenderIdentity c={c} name="You" id="founder" size={40} />}<div className="min-w-0"><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.origin}</p><p className="text-xs tabular-nums">Today: {money(r.worth)}{r.you ? '' : ` · ${r.source}`}</p></div></div></li>)}</ol> :
    <ol className="grid sm:grid-cols-2 gap-2">{rows.map(r => <li key={r.id} className={`career-record flex items-center gap-3 rounded-md border p-2.5 ${r.you ? 'border-primary' : 'border-border'}`}>
      <span className="w-6 text-center font-semibold tabular-nums text-muted-foreground">{r.rank}</span>
      {r.photo ? <img src={r.photo} alt={r.name} width={48} height={48} loading="lazy" className="h-12 w-12 rounded-full object-cover object-top border border-border" /> : <SenderIdentity c={c} name="You" id="founder" size={48} />}
      <div className="min-w-0 flex-1"><p className="font-medium truncate flex items-center gap-1">{r.rank === 1 && <Crown className="h-3.5 w-3.5 text-primary" />}{r.name}</p><p className="text-xs text-muted-foreground truncate">{r.source}{r.started ? ` · since ${r.started}` : ''}</p></div>
      <span className="tabular-nums font-semibold text-sm">{money(r.worth)}</span>
    </li>)}</ol>}
    <p className="text-[11px] text-muted-foreground mt-2">Real people with rounded, approximate fortunes. Fortunes are rounded estimates. Photos: Wikimedia Commons.</p>
  </Section>;
}
