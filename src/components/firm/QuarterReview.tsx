import { useState } from 'react';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TIERS } from '@/lib/fund/fundraising';
import { previewOrders, quarterLabel } from '@/lib/fund/engine';
import { type Career, CAREER_KEY } from '@/lib/firm/career';
import { openDecisions } from '@/lib/firm/close';
import { CATEGORY_LABEL, type Recap, plannedOrders, planDecision, quarterEstimate } from '@/lib/firm/plan';
import { SenderIdentity } from './SenderIdentity';
import { firmMoney as money, firmPct as pct } from './format';

const Row = ({ label, value, note, tone, strong }: { label: React.ReactNode; value: string; note?: string; tone?: 'good' | 'bad'; strong?: boolean }) => (
  <li className={`flex items-baseline justify-between gap-3 py-1 ${strong ? 'border-t border-border font-semibold' : ''}`}>
    <span className="min-w-0">{label}{note && <span className="block text-[11px] text-muted-foreground font-normal">{note}</span>}</span>
    <span className={`tabular-nums shrink-0 ${tone === 'good' ? 'text-gain' : tone === 'bad' ? 'text-loss' : ''}`}>{value}</span>
  </li>
);
const Est = () => <span className="ml-1 rounded bg-muted px-1 text-[10px] uppercase tracking-wider text-muted-foreground">est.</span>;

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-t border-border py-4 min-w-0"><h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{title}</h3><ul className="text-sm">{children}</ul></section>;
}

export function QuarterReview({ open, c, issues, onCancel, onConfirm, onEdit }: { open: boolean; c: Career; issues: string[]; onCancel: () => void; onConfirm: () => void; onEdit: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const f = c.fund; const q = f.q + 1;
  const orders = plannedOrders(c); const d = planDecision(c);
  const pv = previewOrders(f, d.orders);
  const midCount = d.orders.filter(o => o.timing === 'mid').length;
  const est = quarterEstimate(c, 1);
  const offers = f.offers.filter(o => d.acceptOfferIds.includes(o.id));
  const decisions = openDecisions(c);
  const salaryChange = c.salaryHistory.find(x => x.effectiveQ === q);
  const fundCashIn = offers.reduce((a, o) => a + o.amount, 0) + (d.sellLocked ?? 0) * 0.7;
  return (
    <Dialog open onOpenChange={o => { if (!o) onCancel(); }}>
      <DialogContent className="firm-theme max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2"><SenderIdentity c={c} id="firm" name={c.firmName} size={48} /><p className="text-sm font-medium">{c.firmName}</p></div><DialogTitle>Review and close {quarterLabel(f, q)}</DialogTitle>
          <DialogDescription>Confirming settles this quarter once. Amounts marked est. use today's fund size; markets decide the real figures. Fund cash and firm cash are separate.</DialogDescription>
        </DialogHeader>
        {issues.length > 0 && <p className="rounded-md border border-loss/50 bg-loss/10 p-2 text-xs flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 text-loss" />{issues.join(' ')} These are left out.</p>}
        <div className="grid md:grid-cols-2 gap-3">
          <Block title="Fund · trades">
            {orders.length === 0 ? <Row label="No trades. Holdings ride as they are." value="" /> : orders.map((o, i) => <Row key={i} label={o.label} note={o.source === 'idea' ? 'Approved in committee' : undefined} value={o.sellAll ? 'all' : money(Math.abs(o.amount))} />)}
            <Row label="Trading costs" value={money(pv.cost)} />
            {midCount > 0 && <li className="text-[11px] text-muted-foreground">{midCount} order{midCount > 1 ? 's trade' : ' trades'} halfway through the quarter, at mid-quarter prices.</li>}
            <Row label="Fund cash after trades" value={money(pv.cashAfter + fundCashIn)} strong />
          </Block>
          <Block title="Fund · money in and out">
            {offers.map(o => <Row key={o.id} label={`Subscription · ${o.investor}`} note={`${TIERS.find(t => t.id === o.tierId)?.name ?? 'Investor'} · new units at NAV, not profit`} value={`+${money(o.amount)}`} tone="good" />)}
            {est.fundIn.map((x, i) => <Row key={`in-${i}`} label={<>{x.label}<Est /></>} note={x.note} value={`+${money(x.amount)}`} tone="good" />)}
            {(d.sellLocked ?? 0) > 0 && <Row label="Early locked sale (30% discount)" value={`+${money((d.sellLocked ?? 0) * 0.7)}`} />}
            {est.fund.map((x, i) => <Row key={i} label={<>{x.label}{x.basis === 'estimate' && <Est />}</>} note={x.note} value={money(x.amount)} />)}
            <Row label="Fund owes this quarter" value={money(est.fundTotal)} note={`${money(est.fundKnown)} known, the rest estimated`} strong tone={pv.cashAfter + fundCashIn < est.fundTotal ? 'bad' : undefined} />
            {pv.cashAfter + fundCashIn < est.fundTotal && <li className="text-[11px] text-loss">Cash is short; the prime broker will sell holdings evenly to pay.</li>}
          </Block>
          <Block title={`Firm · ${c.firmName}`}>
            <Row label="Firm cash now" value={money(est.firmCashNow)} />
            {est.firmIn.map((x, i) => <Row key={i} label={<>{x.label}<Est /></>} note={x.note} value={`+${money(x.amount)}`} tone="good" />)}
            {est.firmOut.map((x, i) => <Row key={i} label={x.label} note={x.label === 'Your salary' && salaryChange ? `Changed from ${money(salaryChange.fromQ)}; effective this close` : x.note} value={`−${money(x.amount)}`} />)}
            <Row label="Firm cash after close (estimate)" value={money(est.firmCashAfter)} strong tone={est.firmCashAfter < 0 ? 'bad' : undefined} />
            {est.firmCashAfter < 0 && <li className="text-[11px] text-loss">Bills beyond firm cash become back pay owed, and your salary is skipped.</li>}
          </Block>
          <Block title="Decisions">
            {decisions.length === 0 ? <Row label="Nothing open." value="" /> : decisions.map(x => {
              const def = x.options?.find(o => o.id === x.defaultOption);
              return <Row key={x.id} label={x.title ?? 'Firm cash ran short'} note={x.kind === 'payroll_shortfall' ? 'Stays open until you decide.' : `If you do not choose: ${def?.label ?? 'no action'}`} value="" />;
            })}
            {d.journal?.trim() && <Row label="Journal note" note={d.journal} value="" />}
          </Block>
        </div>
        <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          <Button variant="ghost" onClick={onCancel}>Cancel, keep plan</Button>
          <Button variant="outline" onClick={onEdit}>Edit trades</Button>
          <Button disabled={busy} onClick={() => { setBusy(true); onConfirm(); setTimeout(() => setBusy(false), 300); }}>Confirm and close {quarterLabel(f, q)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuarterRecapDialog({ recap, c, onClose }: { recap: Recap | null; c: Career; onClose: () => void }) {
  if (!recap) return null;
  const gap = recap.fundReturn - recap.benchReturn;
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="firm-theme max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{recap.label} closed</DialogTitle><DialogDescription>Actual results posted to the books.</DialogDescription></DialogHeader>
        <div className="grid sm:grid-cols-3 gap-3">
          <Block title={c.fundName}>
            <Row label="Fund return" value={pct(recap.fundReturn)} tone={recap.fundReturn >= 0 ? 'good' : 'bad'} />
            <Row label="S&P 500" value={pct(recap.benchReturn)} />
            <Row label="Gap" value={`${gap >= 0 ? '+' : ''}${(gap * 100).toFixed(1)} pts`} tone={gap >= 0 ? 'good' : 'bad'} strong />
            <Row label="Net assets" value={money(recap.aum)} />
          </Block>
          <Block title={c.firmName}>
            <Row label="Fee cash received" value={`+${money(recap.feeCash)}`} tone="good" />
            {recap.firmOut.map(x => <Row key={x.category} label={CATEGORY_LABEL[x.category]} value={`−${money(x.amount)}`} />)}
            <Row label="Firm cash at close" value={money(recap.firmEndCash)} strong />
            {recap.unpaid > 0 && <Row label="Unpaid back pay" value={money(recap.unpaid)} tone="bad" />}
          </Block>
          <Block title="You">
            {recap.founderIn.length === 0 ? <Row label="No transfers to you" value={money(0)} /> : recap.founderIn.map(x => <Row key={x.category} label={CATEGORY_LABEL[x.category]} value={`+${money(x.amount)}`} />)}
            {recap.salaryChange && <Row label="Salary changed" note={`${money(recap.salaryChange.fromQ)} to ${money(recap.salaryChange.toQ)} a quarter`} value="" />}
            {(() => { const nx = c.salaryHistory.find(x => x.effectiveQ === c.fund.q + 1) ? { label: 'Next close', amt: c.founderSalaryQ } : c.salarySchedule[0] ? { label: `From ${quarterLabel(c.fund, c.salarySchedule[0].fromQ)}`, amt: c.salarySchedule[0].salaryQ } : null; return nx ? <Row label="Scheduled salary" note={nx.label} value={`${money(nx.amt)}/qtr`} /> : null; })()}
            <Row label="Personal cash" value={money(recap.founderEndCash)} strong />
          </Block>
        </div>
        <DialogFooter><Button onClick={onClose}>Continue</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SaveBanner({ error, career, onRetry }: { error: string; career: Career; onRetry: () => void }) {
  const exportSave = () => {
    const blob = new Blob([JSON.stringify(career)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${CAREER_KEY}-${career.fund.q}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return <div role="alert" className="rounded-md border border-loss/60 bg-loss/10 p-3 text-sm flex flex-wrap items-center gap-2">
    <AlertTriangle className="w-4 h-4 text-loss" /><span className="flex-1 min-w-[12rem]">Your career could not be saved. {error} Your progress stays on screen until you leave.</span>
    <Button size="sm" variant="outline" onClick={onRetry}><RotateCcw className="w-4 h-4" />Retry</Button>
    <Button size="sm" variant="outline" onClick={exportSave}><Download className="w-4 h-4" />Export save</Button>
  </div>;
}
