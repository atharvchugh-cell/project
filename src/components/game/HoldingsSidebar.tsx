import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CompanyLogo } from './CompanyLogo';

interface Holding {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  currentPrice: number;
  costBasis: number;
}

interface Props {
  holdings: Holding[];
  onBuy: (id: string) => void;
  onSell: (id: string) => void;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 10_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

export function HoldingsSidebar({ holdings, onBuy, onSell }: Props) {
  return (
    <div className="rounded-xl bg-card border border-border/50 p-4 sm:p-5 space-y-3 shadow-lg shadow-black/10">
      <h3 className="font-display font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2.5">
        <Wallet className="w-4 h-4" /> Your Investments
      </h3>
      {holdings.length === 0 ? (
        <p className="text-xs text-muted-foreground">No stocks yet. Search and add stocks to your watchlist to start trading.</p>
      ) : (
        <ul className="space-y-2" aria-label="Your stock holdings">
          {holdings.map((h) => {
            const value = h.shares * h.currentPrice;
            const gain = value - h.costBasis;
            const gainPct = h.costBasis > 0 ? (gain / h.costBasis) * 100 : 0;
            const isUp = gain >= 0;
            return (
              <li key={h.id} className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-2 hover:border-border/60 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <CompanyLogo ticker={h.ticker} companyName={h.name} size="sm" />
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-semibold">{h.ticker}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{h.name}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-semibold">{fmt(value)}</div>
                    <div className={`font-mono text-[11px] flex items-center justify-end gap-0.5 ${isUp ? 'text-gain' : 'text-loss'}`}>
                      {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground font-mono">{h.shares} sh · ${h.currentPrice.toFixed(2)}</span>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs border-gain/30 text-gain hover:bg-gain/10" onClick={() => onBuy(h.id)}>Buy</Button>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs border-loss/30 text-loss hover:bg-loss/10" onClick={() => onSell(h.id)}>Sell</Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
