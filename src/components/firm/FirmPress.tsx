import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { quarterLabel } from '@/lib/fund/engine';
import type { Career } from '@/lib/firm/career';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { enableNews } from '@/lib/fund/news';
import { SenderIdentity } from './SenderIdentity';
import { CompanyLogo } from '@/components/game/CompanyLogo';
import { assetName } from '@/lib/fund/engine';

/** The quarterly financial newspaper. Every figure was recorded at close from the fund history and rival standings. */
export function FirmPress({ c, setC }: { c: Career; setC?: (c: Career) => void }) {
  const [idx, setIdx] = useState<number | null>(null);
  const [sector, setSector] = useState('All');
  const [search, setSearch] = useState('');
  const editions = c.press ?? [];
  if (!editions.length) return <p className="text-sm text-muted-foreground">The first newspaper arrives after the first quarter closes.</p>;
  const i = idx ?? editions.length - 1;
  const ed = editions[i];
  const [lead, ...rest] = ed.stories;
  if (!lead) return null;
  return (
    <section className="career-newspaper border-y border-border py-5 min-w-0" aria-label="The Market Ledger newspaper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 mb-3">
        <h2 className="text-xl sm:text-2xl font-editorial font-semibold flex flex-wrap items-center gap-2"><Newspaper className="w-4 h-4" />The Market Ledger · {quarterLabel(c.fund, ed.q)}</h2>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => setIdx(i - 1)}>Earlier</Button>
          <Button size="sm" variant="ghost" disabled={i === editions.length - 1} onClick={() => setIdx(i + 1)}>Later</Button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2"><SenderIdentity c={c} name="Market Ledger reporter" /><span className="text-xs text-muted-foreground">Market Ledger reporter</span><SenderIdentity c={c} name={c.firmName} /></div>
      <p className={`text-2xl sm:text-3xl font-editorial font-semibold leading-snug ${lead.tone === 'good' ? 'text-gain' : lead.tone === 'bad' ? 'text-loss' : ''}`}>{lead.headline}</p>
      <p className="text-sm text-muted-foreground mt-1">{lead.body}</p>
      {setC && c.fund.newsFromYear === undefined && c.fund.marketRule === 'calendar' && <Button variant="outline" onClick={() => setC(enableNews(c))}>Enable sentiment prices from {c.fund.startYear + Math.ceil(c.fund.q / 4)}</Button>}
      {rest.length > 0 && <ul className="grid gap-3 sm:grid-cols-2 mt-3 pt-3 border-t border-border">{rest.map((s, k) => <li key={k} className="min-w-0"><div className="flex items-center gap-2 mb-1"><SenderIdentity c={c} name={s.kind === 'rivals' ? ed.leader : s.kind === 'public' || s.kind === 'corporate' ? c.firmName : s.kind === 'activist' ? 'Activist representative' : s.kind === 'crisis' ? 'Regulatory liaison' : 'Market Ledger reporter'} /><p className="text-sm font-medium">{s.headline}</p></div><p className="text-xs text-muted-foreground">{s.body}</p></li>)}</ul>}
      {(ed.stocks ?? []).length > 0 && <div className="mt-4 border-t border-border pt-3 space-y-3"><h3 className="font-semibold">Stock price reaction</h3><p className="text-xs text-muted-foreground">Simulated sentiment changes quarterly timing, not historical year-end prices. Net fund results also include fees, cash, and your trade timing.</p>
        <div className="flex flex-wrap gap-2"><Input aria-label="Search news tickers" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ticker" className="w-36" /><Select value={sector} onValueChange={setSector}><SelectTrigger className="w-56" aria-label="News sector"><SelectValue /></SelectTrigger><SelectContent>{['All', ...new Set(ed.stocks?.map(x => x.sector))].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{ed.stocks?.filter(x => (sector === 'All' || x.sector === sector) && x.ticker.includes(search.toUpperCase())).sort((a, b) => a.ticker.localeCompare(b.ticker)).map(x => <li key={x.ticker} className="border border-border rounded p-2 text-xs tabular-nums"><p className="font-semibold flex items-center gap-2"><CompanyLogo ticker={x.ticker} companyName={assetName(x.ticker)} />{x.ticker} <span className="text-muted-foreground font-normal">{x.sector}</span></p><p>Sentiment {x.sentiment >= 0 ? '+' : ''}{x.sentiment} · price multiplier {(1 + x.impact).toFixed(4)}×</p><p className={x.ret < 0 ? 'text-loss' : 'text-gain'}>Quarter price return {(x.ret * 100).toFixed(2)}%</p></li>)}</ul></div>}
    </section>
  );
}
