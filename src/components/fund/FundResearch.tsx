import { useState } from 'react';
import { Bookmark, Search, ArrowRight, Building2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CompanyLogo } from '@/components/game/CompanyLogo';
import { currentYear, quarterLabel, type FundState } from '@/lib/fund/engine';
import { listedCompanies } from '@/lib/fund/market';
import { companyTrackRecord } from '@/lib/fund/exploration';

export function FundResearch({ s, watchlist, onWatch, onTrade }: { s: FundState; watchlist: string[]; onWatch: (t: string) => void; onTrade: (t: string) => void }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('AAPL');
  const [onlyWatched, setOnlyWatched] = useState(false);
  const [limit, setLimit] = useState(18);
  const reduced = useReducedMotion();
  const all = listedCompanies(currentYear(s)).sort((a, b) => a.name.localeCompare(b.name));
  const list = all.filter(c => (!onlyWatched || watchlist.includes(c.ticker)) && `${c.name} ${c.ticker} ${c.sector}`.toLowerCase().includes(search.toLowerCase()));
  const company = all.find(c => c.ticker === selected) ?? all[0];
  if (!company) return null;
  const rows = companyTrackRecord(s, company.ticker);
  const last = rows.at(-1);
  return <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-7 py-5">
    <section aria-label="Research companies" className="min-w-0 space-y-4">
      <div className="flex flex-wrap justify-between gap-2 items-center"><h2 className="text-xl font-semibold">Company research</h2><Button size="sm" variant={onlyWatched ? 'secondary' : 'outline'} aria-pressed={onlyWatched} onClick={() => setOnlyWatched(v => !v)}><Bookmark className="h-4 w-4" />Watchlist ({watchlist.length})</Button></div>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search research companies" className="pl-9" placeholder="Company, ticker or sector" value={search} onChange={e => { setSearch(e.target.value); setLimit(18); }} /></div>
      <div className="max-h-96 overflow-y-auto divide-y divide-border">{list.slice(0, limit).map(c => <div key={c.ticker} className="flex items-center gap-1 py-1"><Button variant={company.ticker === c.ticker ? 'secondary' : 'ghost'} className="h-14 justify-start flex-1 min-w-0" onClick={() => setSelected(c.ticker)}><CompanyLogo ticker={c.ticker} companyName={c.name} /><span className="text-left min-w-0"><span className="block truncate">{c.name}</span><span className="block text-xs text-muted-foreground">{c.ticker} · {c.sector === '—' ? 'Sector not supplied' : c.sector}</span></span></Button><Button size="icon" variant="ghost" aria-label={`${watchlist.includes(c.ticker) ? 'Unwatch' : 'Watch'} ${c.name}`} aria-pressed={watchlist.includes(c.ticker)} onClick={() => onWatch(c.ticker)}><Bookmark className={`h-4 w-4 ${watchlist.includes(c.ticker) ? 'fill-primary text-primary' : 'text-muted-foreground'}`} /></Button></div>)}</div>
      {!list.length && <p className="text-sm text-muted-foreground">No matching companies.</p>}
      {list.length > limit && <Button size="sm" variant="outline" onClick={() => setLimit(v => v + 18)}>More companies</Button>}
    </section>
    <section aria-label="Company dossier" className="min-w-0 border-t lg:border-t-0 lg:border-l border-border pt-5 lg:pt-0 lg:pl-7 space-y-5">
      <div className="flex items-center gap-3"><CompanyLogo ticker={company.ticker} companyName={company.name} size="md" /><div className="min-w-0"><p className="text-xs text-primary uppercase">Research dossier · {company.ticker}</p><h2 className="text-2xl font-semibold break-words">{company.name}</h2><p className="text-sm text-muted-foreground">{company.sector === '—' ? 'Sector not supplied' : company.sector}</p></div></div>
      <div className="grid grid-cols-2 gap-4 border-y border-border py-4"><div><p className="text-xs text-muted-foreground">Growth over observed quarters</p><p className={`text-2xl tabular-nums ${last && last.growth < 0 ? 'text-loss' : 'text-gain'}`}>{last ? `${last.growth >= 0 ? '+' : ''}${last.growth.toFixed(1)}%` : 'Not observed'}</p></div><div><p className="text-xs text-muted-foreground">Last completed quarter</p><p className="text-2xl tabular-nums">{last ? `${last.return.toFixed(1)}%` : 'Not observed'}</p></div></div>
      {rows.length ? <div className="h-64" role="img" aria-label={`${company.name} growth in completed quarters`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={[{ q: Math.max(0, rows[0].q - 1), growth: 0 }, ...rows]} margin={{ right: 10, left: 0, top: 10 }}><CartesianGrid stroke="hsl(var(--border))" vertical={false} strokeDasharray="3 5" /><XAxis dataKey="q" tickFormatter={q => `Q${q}`} stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis tickFormatter={v => `${v}%`} stroke="hsl(var(--muted-foreground))" fontSize={11} /><Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} labelFormatter={q => Number(q) === 0 ? 'Start' : quarterLabel(s, Number(q))} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} /><Area type="linear" dataKey="growth" name="Observed growth" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.12} isAnimationActive={!reduced} animationDuration={500} /></AreaChart></ResponsiveContainer></div> : <div className="h-48 flex flex-col items-center justify-center gap-3 border-y border-border"><Building2 className="h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">No completed quarters for this company yet.</p></div>}
      <p className="text-xs text-muted-foreground">Completed quarters only, with simulated within-year paths. This is the asset’s growth, not your personal return. No future performance is shown.</p>
      <Button onClick={() => onTrade(company.ticker)}>Open trade ticket<ArrowRight className="h-4 w-4" /></Button>
    </section>
  </div>;
}