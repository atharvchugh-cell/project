import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type Career, firmCash, founderCash } from '@/lib/firm/career';
import { ownershipOf } from '@/lib/firm/exit';
import { SPLIT_RATIOS, publicBuyback, publicQuote, publicSpendable, shareProfit, splitPublicShares, tradePublicShares } from '@/lib/firm/publicFirm';
import { firmMoney as money } from './format';

/** Portfolio-page view of the founder's own public shares, with both buyback payers and splits. */
export function OwnShares({ c, setC }: { c: Career; setC: (c: Career) => void }) {
  const [shares, setShares] = useState('1000');
  if (ownershipOf(c).ipo?.stage !== 'listed' || !c.publicFirm) return null;
  const q = publicQuote(c); const p = shareProfit(c);
  const owned = Math.round(q.founderShares); const value = owned * q.price;
  const count = Number(shares); const valid = Number.isInteger(count) && count > 0;
  const run = (r: ReturnType<typeof publicBuyback>) => { if (r.ok) setC(r.c); (r.ok ? toast.success : toast.error)(r.message); };
  const running = c.status === 'running';
  const last = c.publicFirm.splits?.at(-1);
  const splitReady = !last || c.fund.q - last.q >= 4;
  return (
    <section className="border-y border-border py-4 mb-5 space-y-3" aria-labelledby="own-shares">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="own-shares" className="text-xl font-semibold">Your shares in {c.firmName}</h2>
        <span className="text-sm text-muted-foreground">Share price ${q.price.toFixed(2)}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div><p className="text-muted-foreground">Shares you own</p><p className="font-semibold">{owned.toLocaleString('en-US')}</p></div>
        <div><p className="text-muted-foreground">Value in your portfolio</p><p className="font-semibold">{money(value)}</p></div>
        <div><p className="text-muted-foreground">Your stake</p><p className="font-semibold">{q.shares > 0 ? ((owned / q.shares) * 100).toFixed(2) : '0.00'}%</p></div>
        <div><p className="text-muted-foreground">Profit on shares you bought</p><p className={`font-semibold ${p.total >= 0 ? 'text-gain' : 'text-destructive'}`}>{money(p.total)}</p></div>
      </div>
      <p className="text-xs text-muted-foreground">These shares count toward your personal net worth. They are separate from the client fund below.</p>
      <div className="space-y-2">
        <h3 className="font-semibold">Share buybacks</h3>
        <form className="flex flex-wrap gap-2" onSubmit={e => e.preventDefault()}>
          <Input aria-label="Shares to buy back" type="number" min="1" step="1" value={shares} onChange={e => setShares(e.target.value)} className="w-36" />
          <Button type="button" variant="outline" disabled={!running || !valid} onClick={() => run(tradePublicShares(c, 'buy', count))}>With your cash ({money(valid ? count * q.price : 0)})</Button>
          <Button type="button" variant="outline" disabled={!running || !valid} onClick={() => run(publicBuyback(c, count))}>With company cash</Button>
        </form>
        <p className="text-xs text-muted-foreground">Your cash: {money(founderCash(c))}, adds the shares to your stake. Company cash: {money(publicSpendable(c))} available of {money(firmCash(c))}, cancels the shares so every owner's slice grows.</p>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Split the share price</h3>
        <div className="flex flex-wrap gap-2">{SPLIT_RATIOS.map(r => <Button key={r} size="sm" variant="outline" disabled={!running || !splitReady} onClick={() => run(splitPublicShares(c, r))}>{r}-for-1 (≈${(q.price / r).toFixed(2)})</Button>)}</div>
        <p className="text-xs text-muted-foreground">{splitReady ? 'You get more shares at a lower price. Your total value stays the same.' : 'One split a year. The next split opens four quarters after the last.'}</p>
      </div>
    </section>
  );
}
