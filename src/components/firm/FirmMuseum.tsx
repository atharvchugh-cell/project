import { Button } from '@/components/ui/button';
import { assetName, quarterLabel } from '@/lib/fund/engine';
import { type Career, firmCash, founderStake } from '@/lib/firm/career';
import { derivedEnding, finalNetWorth, founderEquityValue, ownershipOf } from '@/lib/firm/exit';
import { assetsValue, lifeOf, personalCash, personalOwed, reputation } from '@/lib/firm/life';
import { firmMoney as money, firmPct as pct } from './format';
import { SenderIdentity } from './SenderIdentity';

const KIND: Record<string, string> = { sold: 'Sold the firm', retired: 'Retired', failed: 'Fund closed', completed: 'Full term' };

/** Ending page and career museum: the story, inspectable numbers, and the history behind them. Read-only. */
export function CareerMuseum({ c, onNew }: { c: Career; onNew: () => void }) {
  const e = derivedEnding(c); const L = lifeOf(c);
  const snaps = c.snapshots; const best = [...c.fund.history].sort((a, b) => b.ret - a.ret)[0]; const worst = [...c.fund.history].sort((a, b) => a.ret - b.ret)[0];
  const ideas = c.ideas.filter(i => i.reviewedQ !== undefined && i.status === 'approved').sort((a, b) => (b.result ?? 0) - (a.result ?? 0));
  const peakNw = Math.max(0, ...snaps.map(s => s.netWorth ?? 0));
  return <div className="max-w-6xl mx-auto px-4 pb-10 space-y-4">
    <section className="border-y border-primary/50 py-6 space-y-3" aria-labelledby="ending-title">
      <p className="text-[11px] uppercase tracking-[0.18em] text-primary">{KIND[e.kind]} · {e.q ? quarterLabel(c.fund, e.q) : ''}</p>
      <div className="flex gap-3 items-center"><SenderIdentity c={c} name={c.firmName} id="firm" size={52} /><SenderIdentity c={c} name="You" id="founder" size={52} /></div><h2 id="ending-title" className="text-2xl font-semibold">{e.title}</h2>
      {e.story.map((s, i) => <p key={i} className="text-sm text-muted-foreground">{s}</p>)}
      <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 text-sm tabular-nums">
        {e.numbers.map(n => <li key={n.label} className="rounded border border-border p-2"><p className="text-[11px] text-muted-foreground">{n.label}</p><p className="font-semibold">{/return/i.test(n.label) ? pct(n.value) : /Quarters/.test(n.label) ? n.value : money(n.value)}</p></li>)}
        <li className="rounded border border-border p-2"><p className="text-[11px] text-muted-foreground">Your net worth</p><p className="font-semibold">{money(finalNetWorth(c))}</p><p className="text-[10px] text-muted-foreground">cash {money(personalCash(c))} + possessions {money(assetsValue(c))} + fund stake {money(founderStake(c))} + firm equity {money(founderEquityValue(c))} − debts {money(personalOwed(c))}</p></li>
        <li className="rounded border border-border p-2"><p className="text-[11px] text-muted-foreground">Firm cash left in the firm</p><p className="font-semibold">{money(firmCash(c))}</p></li>
        <li className="rounded border border-border p-2"><p className="text-[11px] text-muted-foreground">Reputation</p><p className="font-semibold">{reputation(c).score}</p></li>
        <li className="rounded border border-border p-2"><p className="text-[11px] text-muted-foreground">Peak net worth</p><p className="font-semibold">{money(peakNw)}</p></li>
      </ul>
      <Button variant="outline" onClick={onNew}>{c.practice ? 'Return to saved career' : 'New career'}</Button>
    </section>
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="border-t border-border py-5 text-sm space-y-1"><h3 className="font-semibold mb-1">Milestones</h3>
        {best && <p>Best quarter: {quarterLabel(c.fund, best.q)}, {pct(best.ret)} (S&amp;P {pct(best.bench)})</p>}
        {worst && <p>Worst quarter: {quarterLabel(c.fund, worst.q)}, {pct(worst.ret)}</p>}
        <p>Peak fund size: {money(Math.max(0, ...snaps.map(s => s.aum)))}</p>
        <p>Staff at the end: {c.roster.length}; ideas pitched: {c.ideas.length}; businesses owned: {c.subsidiaries.length}</p>
        <p>Cap table: {ownershipOf(c).holders.filter(h => h.pct > 1e-6).map(h => `${h.name} ${(h.pct * 100).toFixed(1)}%`).join(', ')}</p>
      </section>
      <section className="border-t border-border py-5 text-sm"><h3 className="font-semibold mb-1">Investment postmortems</h3>
        {ideas.length === 0 ? <p className="text-muted-foreground">No approved ideas were reviewed.</p> : <ul className="space-y-1 text-xs tabular-nums">{[...ideas.slice(0, 3), ...ideas.slice(-2)].filter((x, i, a) => a.indexOf(x) === i).map(i => <li key={i.id} className="flex items-start gap-2"><SenderIdentity c={c} name={i.analyst} size={24} />{assetName(i.ticker)} by {i.analyst}: {pct(i.result ?? 0)} vs S&amp;P {pct(i.bench ?? 0)}{i.filled ? `, on ${money(i.filled)} filled` : ''}. {(i.result ?? 0) > (i.bench ?? 0) ? 'Worked.' : 'Lagged.'}</li>)}</ul>}
      </section>
      <section className="border-t border-border py-5 text-sm"><h3 className="font-semibold mb-1">Possessions</h3>
        {L.possessions.length === 0 ? <p className="text-muted-foreground">You never bought anything big.</p> : <ul className="text-xs space-y-0.5 tabular-nums">{L.possessions.map(p => <li key={p.id}>{p.name}: bought {money(p.price)}{p.soldQ !== undefined ? `, ${p.forced ? 'force-sold' : 'sold'} for ${money(p.salePrice ?? 0)}` : ', still owned'}</li>)}</ul>}
      </section>
      <section className="border-t border-border py-5 text-sm"><h3 className="font-semibold mb-1">People</h3>
        <ul className="text-xs space-y-0.5">{L.people.map(p => <li key={p.id} className="flex items-center gap-2"><SenderIdentity c={c} name={p.name} />{p.name} ({p.role}): closeness {p.closeness}{p.memory.length ? `. Remembers ${p.memory.slice(-1)[0]}.` : ''}</li>)}</ul>
      </section>
    </div>
  </div>;
}
