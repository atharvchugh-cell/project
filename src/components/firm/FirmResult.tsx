import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Career } from '@/lib/firm/career';
import { recapFor } from '@/lib/firm/plan';
import { CATEGORY_LABEL } from '@/lib/firm/plan';
import { firmMoney as money, firmPct as pct } from './format';
import { SenderIdentity } from './SenderIdentity';

/** Compact, dismissible result of the last simulated quarter, announced to screen readers. Details expand in place. */
export function QuarterResult({ c, q, onDismiss }: { c: Career; q: number; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); }, [q]);
  const r = recapFor(c, q); if (!r) return null;
  const gap = r.fundReturn - r.benchReturn;
  const feed = [...c.notices.filter(n => n.q === q), ...(c.life?.log ?? []).filter(l => l.q === q).map(l => ({ q, from: 'You', subject: l.text, body: '', tone: l.tone }))];
  const decisions = c.decisions.filter(d => d.q === q && !d.resolved).length + (c.life?.events ?? []).filter(e => e.q === q && !e.resolved).length;
  return (
    <div ref={ref} role="status" aria-live="polite" className="rounded-md border border-primary/50 bg-card p-3 fund-enter" data-testid="quarter-result">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <p className="font-semibold text-sm">{r.label} simulated</p>
        <p className="text-sm tabular-nums">Fund <span className={r.fundReturn >= 0 ? 'text-gain' : 'text-loss'}>{pct(r.fundReturn)}</span> vs S&amp;P <span>{pct(r.benchReturn)}</span> (<span className={gap >= 0 ? 'text-gain' : 'text-loss'}>{gap >= 0 ? '+' : ''}{(gap * 100).toFixed(1)} pts</span>)</p>
        <p className="text-sm tabular-nums text-muted-foreground">Fees +{money(r.feeCash)} · firm cash {money(r.firmEndCash)} · personal {money(r.founderEndCash)}{r.unpaid > 0 ? <span className="text-loss"> · {money(r.unpaid)} owed</span> : null}</p>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(x => !x)}><ChevronDown className={`w-4 h-4 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`} />{open ? 'Less' : `Details${feed.length ? ` (${feed.length})` : ''}`}</Button>
          <Button size="icon" variant="ghost" aria-label="Dismiss quarter result" onClick={onDismiss}><X className="w-4 h-4" /></Button>
        </div>
      </div>
      {decisions > 0 && <p className="text-xs text-primary mt-1">{decisions} new choice{decisions > 1 ? 's' : ''} waiting. Unanswered ones take their stated default next quarter.</p>}
      {open && <div className="mt-3 grid md:grid-cols-[16rem_1fr] gap-4 text-xs">
        <ul className="tabular-nums space-y-0.5"><li className="font-medium text-[11px] uppercase text-muted-foreground">Firm cash this quarter</li>
          <li className="flex justify-between gap-2"><span>Fees received</span><span className="text-gain">+{money(r.feeCash)}</span></li>
          {r.firmOut.map(x => <li key={x.category} className="flex justify-between gap-2"><span>{CATEGORY_LABEL[x.category]}</span><span>−{money(x.amount)}</span></li>)}
          <li className="flex justify-between gap-2 border-t border-border pt-0.5 font-medium"><span>Firm cash at close</span><span>{money(r.firmEndCash)}</span></li>
          <li className="flex justify-between gap-2"><span>Fund net assets</span><span>{money(r.aum)}</span></li></ul>
        <ul className="space-y-1.5 max-h-72 overflow-y-auto">{feed.length === 0 ? <li className="text-muted-foreground">A quiet quarter.</li> : feed.map((n, i) => <li key={i} className={`border-l-2 pl-2 ${n.tone === 'good' ? 'border-gain' : n.tone === 'bad' ? 'border-loss' : 'border-border'}`}><div className="flex items-center gap-2"><SenderIdentity c={c} name={n.from} size={24} /><span className="text-muted-foreground">{n.from}: </span></div><span className="font-medium">{n.subject}</span>{n.body && <span className="block text-muted-foreground">{n.body}</span>}</li>)}</ul>
      </div>}
    </div>
  );
}
