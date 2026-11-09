import { GitBranch, Undo2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { nav } from '@/lib/fund/accounting';
import type { FundState } from '@/lib/fund/engine';

export function FundBranch({ s, checkpoint, onReturn, onRestart }: { s: FundState; checkpoint: FundState; onReturn: () => void; onRestart: () => void }) {
  const elapsed = s.q - checkpoint.q;
  const change = nav(s.ledger) / nav(checkpoint.ledger) - 1;
  return <section aria-label="Practice branch" className="border-y border-primary/40 bg-primary/5 py-4 px-4 space-y-3 max-w-6xl mx-auto fund-enter">
    <div className="flex flex-wrap gap-3 justify-between items-center"><div><p className="text-xs uppercase text-primary flex gap-2 items-center"><GitBranch className="h-4 w-4" />Practice branch</p><h2 className="text-lg font-semibold">A different path. Your saved fund stays safe.</h2></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={onRestart}><RotateCcw className="h-4 w-4" />Restart branch</Button><Button size="sm" onClick={onReturn}><Undo2 className="h-4 w-4" />Return to saved fund</Button></div></div>
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm tabular-nums"><p>Saved fund: quarter {checkpoint.q} · NAV {nav(checkpoint.ledger).toFixed(2)}</p><p>Branch: {elapsed} quarter{elapsed === 1 ? '' : 's'} played · NAV {nav(s.ledger).toFixed(2)}</p><p className={change < 0 ? 'text-loss' : 'text-gain'}>{change >= 0 ? '+' : ''}{(change * 100).toFixed(2)}% since branching</p></div>
    <p className="text-xs text-muted-foreground">Same market and obligations from the checkpoint. Practice progress is temporary and cannot replace your saved fund. Observed future quarters can give you hindsight when you return.</p>
  </section>;
}