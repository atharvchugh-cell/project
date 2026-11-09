import { CareerSection as Section } from './CareerSection';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SPX, assetName, isTradable, quarterLabel } from '@/lib/fund/engine';
import { listedCompanies } from '@/lib/fund/market';
import { currentYear } from '@/lib/fund/engine';
import { type Career, firmCash, reserveTarget } from '@/lib/firm/career';
import { LATE_PENALTY, acquire, businessQuarter, businessesNextQ, callable, canAfford, divest, issueCall, saleValue, subsidiaryNetQ, totalUncalled, uncalled } from '@/lib/firm/phase3';
import { firmMoney as money } from './format';
import { SenderIdentity } from './SenderIdentity';


const reliabilityText = (r: number) => (r >= 0.95 ? 'Always pays on time' : r >= 0.88 ? 'Usually on time' : 'Sometimes late');

export function Deals({ c, setC }: { c: Career; setC: (c: Career) => void }) {
  const [amt, setAmt] = useState('');
  const [purpose, setPurpose] = useState<'regular' | 'deal'>('regular');
  const [ticker, setTicker] = useState<string>(SPX);
  const f = c.fund; const max = callable(c);
  const v = Number(amt.replace(/[^0-9.]/g, '')) || 0;
  const tickers = [SPX, ...listedCompanies(currentYear(f)).map(x => x.ticker)].filter(t => isTradable(f, t)).sort((a, b) => (a === SPX ? -1 : b === SPX ? 1 : assetName(a).localeCompare(assetName(b))));
  const open = c.calls.filter(k => !k.settled);
  return (
    <div className="space-y-4 fund-enter">
      <div><h2 className="text-lg font-semibold">Capital calls</h2><p className="text-sm text-muted-foreground">Investor commitments the fund can call. Calls bring new money at NAV, which is never profit.</p></div>

      <Section title="Commitments" action={<span className="text-xs text-muted-foreground tabular-nums">{money(totalUncalled(c))} uncalled · {money(max)} free to call</span>}>
        {c.commitments.length === 0 ? <p className="text-sm text-muted-foreground">This fund has no undrawn commitments.</p> : (
          <ul className="divide-y divide-border text-sm">{c.commitments.map(x => <li key={x.id} className="py-2 grid grid-cols-2 sm:grid-cols-[1fr_repeat(3,8rem)] gap-x-3 gap-y-0.5 tabular-nums">
            <span className="col-span-2 sm:col-span-1"><span className="font-medium flex items-center gap-2"><SenderIdentity c={c} name={x.name} />{x.name}</span><span className={`block text-[11px] ${x.defaulted ? 'text-loss' : 'text-muted-foreground'}`}>{x.defaulted ? 'Defaulted; commitment cancelled' : reliabilityText(x.reliability)}</span></span>
            <span><span className="block text-[10px] uppercase text-muted-foreground">Committed</span>{money(x.committed)}</span>
            <span><span className="block text-[10px] uppercase text-muted-foreground">Called</span>{money(x.called)}</span>
            <span><span className="block text-[10px] uppercase text-muted-foreground">Uncalled</span>{money(uncalled(x))}</span>
          </li>)}</ul>)}
        <p className="text-[11px] text-muted-foreground mt-2">A quarter of the original commitments is called automatically at each year end. Investors wire at the close after next. Late payers owe {LATE_PENALTY * 100}% interest a quarter later, or forfeit the rest.</p>
      </Section>

      {max > 0 && <Section title="Issue a capital call">
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (v > 0) { setC(issueCall(c, v, purpose, purpose === 'deal' ? ticker : undefined)); setAmt(''); } }}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Call purpose">
            {(['regular', 'deal'] as const).map(p => <Button key={p} type="button" size="sm" role="radio" aria-checked={purpose === p} variant={purpose === p ? 'secondary' : 'outline'} onClick={() => setPurpose(p)}>{p === 'regular' ? 'For the fund' : 'For a specific stock'}</Button>)}
          </div>
          {purpose === 'deal' && <Select value={ticker} onValueChange={setTicker}><SelectTrigger className="w-full sm:w-80" aria-label="Stock to buy"><SelectValue /></SelectTrigger><SelectContent className="firm-theme max-h-72">{tickers.map(t => <SelectItem key={t} value={t}>{assetName(t)}</SelectItem>)}</SelectContent></Select>}
          <div className="flex flex-wrap gap-2">
            <Input inputMode="decimal" aria-label="Call amount" placeholder="Amount in dollars" value={amt} onChange={e => setAmt(e.target.value)} className="w-56 tabular-nums" />
            <Button type="button" variant="outline" onClick={() => setAmt(String(Math.floor(max)))}>All free ({money(max)})</Button>
            <Button type="submit" disabled={v <= 0}>Send notice</Button>
          </div>
          <p className="text-xs text-muted-foreground">Due at the {quarterLabel(f, f.q + 2)} close, split by each investor's uncalled amount.{purpose === 'deal' ? ` Whatever arrives buys ${assetName(ticker)} that quarter.` : ''}</p>
        </form>
      </Section>}

      {open.length > 0 && <Section title="Calls outstanding">
        <ul className="space-y-2 text-sm">{open.map(k => <li key={k.id} className="rounded-md border border-border p-3">
          <p className="flex flex-wrap justify-between gap-2"><span className="font-medium">{money(k.amount)} {k.purpose === 'deal' && k.ticker ? `for ${assetName(k.ticker)}` : 'for the fund'}</span><span className="text-muted-foreground">due {quarterLabel(f, k.dueQ)} close</span></p>
          <ul className="mt-1 text-xs tabular-nums">{k.lines.map(l => <li key={l.commitmentId} className={`flex justify-between gap-2 ${l.status === 'late' ? 'text-loss' : ''}`}><span className="flex items-center gap-2"><SenderIdentity c={c} name={c.commitments.find(x => x.id === l.commitmentId)?.name ?? 'Investor'} size={24} />{c.commitments.find(x => x.id === l.commitmentId)?.name}</span><span>{money(l.amount)} · {l.status === 'due' ? 'noticed' : l.status}</span></li>)}</ul>
        </li>)}</ul>
      </Section>}

      <p className="text-sm text-muted-foreground">Buying, running and selling businesses is under Companies & deals.</p>
    </div>
  );
}
