import { TrendingUp, TrendingDown, ArrowRight, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { assetName, quarterLabel, type FundState } from '@/lib/fund/engine';

export function FundQuarterRecap({ s, onClose }: { s: FundState; onClose: () => void }) {
  const h = s.history.at(-1);
  if (!h) return null;
  const review = s.boardReviews?.find(r => r.q === s.q);
  const message = [...s.inbox].reverse().find(m => m.q === s.q && m.from === 'Quarterly review');
  const decision = s.decisions.at(-1);
  return <section aria-label="Quarter results" className="fund-enter border-y border-primary/40 bg-primary/5 py-6 px-3 sm:px-5 space-y-4" aria-live="polite">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase text-primary">Quarter closed · {quarterLabel(s, s.q)}</p><h2 className="text-2xl font-semibold">{h.ret > 0 ? (h.ret >= h.bench ? 'You made money and beat the market.' : 'You made money. Investors are happy.') : h.ret >= h.bench ? 'A loss, but smaller than the market.' : 'The fund lost money this quarter.'}</h2></div>{h.ret > 0 ? <TrendingUp className="h-9 w-9 text-gain" /> : <TrendingDown className="h-9 w-9 text-loss" />}</div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[['Fund return', `${h.ret >= 0 ? '+' : ''}${(h.ret * 100).toFixed(2)}%`], ['S&P 500', `${(h.bench * 100).toFixed(2)}%`], ['Investor confidence', `${Math.round(s.confidence)}/100${h.confidenceDelta !== undefined ? ` (${h.confidenceDelta >= 0 ? '+' : ''}${Math.round(h.confidenceDelta)})` : ''}`], ['NAV after fees', h.nav.toFixed(2)]].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="fund-number text-xl font-semibold tabular-nums">{value}</p></div>)}</div>
    {h.forcedSale ? <p className="text-sm text-muted-foreground">Cash ran short, so holdings were sold evenly to pay investors on time.</p> : null}
    {decision && <p className="text-sm text-muted-foreground">Your largest allocation: {Math.round(decision.weight * 100)}% in {decision.main === 'cash' ? 'cash' : assetName(decision.main)}.</p>}
    {review && <p className={`flex gap-2 items-center text-sm ${review.returnMet && !review.late ? 'text-gain' : 'text-primary'}`}><Trophy className="h-4 w-4 shrink-0" />Annual board review: {review.returnMet && !review.late ? 'mandate met' : 'action required'} · {(review.netReturn * 100).toFixed(1)}% against {(review.target * 100).toFixed(0)}%</p>}
    {message && <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Trading desk debrief</summary><p className="pt-2 text-muted-foreground">{message.body}</p></details>}
    <Button variant="outline" onClick={onClose}>Back to the trading desk<ArrowRight className="h-4 w-4" /></Button>
  </section>;
}