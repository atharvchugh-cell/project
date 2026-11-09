import { useState } from 'react';
import { FlaskConical, Plus, X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { CompanyLogo } from '@/components/game/CompanyLogo';
import { assetName, currentYear, type FundState, type Order } from '@/lib/fund/engine';
import { listedCompanies } from '@/lib/fund/market';
import { allocationOrders, draftFund, stressPortfolio } from '@/lib/fund/strategy';
import { boardReview } from '@/lib/fund/board';
import { FundAllocation } from './FundCharts';

const money = (n: number) => `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1e6).toFixed(2)}M`;
export function FundStrategyLab({ s, orders, onStage }: { s: FundState; orders: Order[]; onStage: (orders: Order[]) => void }) {
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const planned = draftFund(s, orders).ledger;
    const liquid = Math.max(1, planned.cash + Object.values(planned.positions).reduce((sum, value) => sum + value, 0));
    return Object.fromEntries(Object.entries(planned.positions).map(([t, value]) => [t, Math.floor(value / liquid * 100)]));
  });
  const [search, setSearch] = useState('');
  const [shock, setShock] = useState(-20);
  const [tested, setTested] = useState(false);
  const total = Object.values(weights).reduce((a, w) => a + w, 0);
  const draftOrders = allocationOrders(s, weights);
  const draft = draftFund(s, draftOrders);
  const review = boardReview(draft);
  const stress = stressPortfolio(s, orders, shock);
  const companies = listedCompanies(currentYear(s)).filter(c => !(c.ticker in weights) && `${c.name} ${c.ticker} ${c.sector}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 6);
  return <div className="grid lg:grid-cols-2 gap-8 py-5">
    <section aria-label="Allocation lab" className="min-w-0 space-y-4">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><SlidersHorizontal className="text-primary h-5 w-5" />Build your own strategy</h2><p className="text-xs text-muted-foreground mt-1">Liquid capital targets · {Math.max(0, 100 - total)}% held in cash · locked assets stay locked</p></div>
      <Input aria-label="Find companies for strategy" placeholder="Find a company or sector" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="grid sm:grid-cols-2 gap-2">{companies.map(c => <Button key={c.ticker} variant="outline" className="justify-start h-12 min-w-0" onClick={() => setWeights(w => ({ ...w, [c.ticker]: Math.min(20, Math.max(0, 100 - total)) }))}><CompanyLogo ticker={c.ticker} companyName={c.name} /><span className="truncate text-xs flex-1 text-left">{c.name}</span><Plus className="h-3 w-3 shrink-0" /></Button>)}</div>
      <div className="space-y-4">{Object.entries(weights).map(([t, w]) => <div key={t} className="space-y-2"><div className="flex items-center gap-2"><CompanyLogo ticker={t} companyName={assetName(t)} /><span className="text-sm flex-1 truncate">{assetName(t)}</span><span className="text-primary tabular-nums text-sm">{w}%</span><Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remove ${t} from strategy`} onClick={() => setWeights(x => Object.fromEntries(Object.entries(x).filter(([k]) => k !== t)))}><X className="h-3 w-3" /></Button></div><Slider aria-label={`${assetName(t)} target weight`} value={[w]} min={0} max={100} step={5} onValueChange={([value]) => setWeights(x => ({ ...x, [t]: Math.min(value, Math.max(0, 100 - total + w)) }))} /></div>)}</div>
      <FundAllocation s={draft} />
      <p className="text-xs text-muted-foreground">{review.companies} companies · largest {(review.maxWeight * 100).toFixed(1)}% · go as big as you like, the board only judges profit</p>
      <Button onClick={() => onStage(draftOrders)}><SlidersHorizontal className="h-4 w-4" />Stage this allocation</Button>
    </section>
    <section aria-label="Hypothetical stress test" className="space-y-5 border-t lg:border-t-0 lg:border-l border-border pt-5 lg:pt-0 lg:pl-8 min-w-0">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><FlaskConical className="h-5 w-5 text-primary" />What if the market moves?</h2>
      <p className="text-sm text-muted-foreground">A hypothetical shock to all liquid stocks and the index after your staged orders. Cash and locked assets stay unchanged. Not a forecast; no quarter advances.</p>
      <div className="flex justify-between items-center"><label className="text-sm">Market shock</label><span className={`text-3xl tabular-nums font-semibold ${shock < 0 ? 'text-loss' : 'text-gain'}`}>{shock > 0 ? '+' : ''}{shock}%</span></div>
      <Slider aria-label="Hypothetical market shock" value={[shock]} min={-60} max={40} step={5} onValueChange={([v]) => { setShock(v); setTested(false); }} />
      <div className="flex flex-wrap gap-2">{[-40, -20, 10, 25].map(v => <Button size="sm" variant="outline" key={v} onClick={() => { setShock(v); setTested(false); }}>{v > 0 ? '+' : ''}{v}%</Button>)}</div>
      <Button variant="secondary" onClick={() => setTested(true)}><FlaskConical className="h-4 w-4" />Run stress test</Button>
      {tested && <div key={`${shock}:${JSON.stringify(orders)}`} className="fund-enter border-y border-border py-5 space-y-4" aria-live="polite"><p className="text-xs uppercase text-primary">Hypothetical outcome</p><p className={`text-3xl font-semibold tabular-nums ${stress.change < 0 ? 'text-loss' : 'text-gain'}`}>{money(stress.change)} <span className="text-base">({(stress.return * 100).toFixed(1)}%)</span></p><div className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted-foreground">Net assets after shock</p><p>{money(stress.after)}</p></div><div><p className="text-muted-foreground">NAV after shock</p><p>{stress.nav.toFixed(2)}</p></div></div><p className="text-xs text-muted-foreground">Trade fees included. Future fund fees, distributions and savings interest excluded.</p></div>}
    </section>
  </div>;
}