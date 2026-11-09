import { useState, useRef, useEffect, useMemo, KeyboardEvent } from 'react';
import { Search, Plus, X, Check, ArrowUpRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ComplexCompany, searchComplexUniverse } from '@/data/complexReturns';
import { CompanyLogo } from './CompanyLogo';

interface Props {
  watchlistTickers: string[];
  watchlistCap: number;
  currentSimYear: number;
  onAdd: (company: ComplexCompany) => void;
  /** Open the selected company in the trade ticket. */
  onSelectForTrade?: (company: ComplexCompany) => void;
}

export function ComplexStockSearch({
  watchlistTickers,
  watchlistCap,
  currentSimYear,
  onAdd,
  onSelectForTrade,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter out companies that haven't IPO'd yet in the current simulated year.
  const results = useMemo(
    () => searchComplexUniverse(query, currentSimYear, 8),
    [query, currentSimYear],
  );
  const atCap = watchlistTickers.length >= watchlistCap;

  useEffect(() => { setActiveIndex(0); }, [query]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const canAdd = (c: ComplexCompany) =>
    !watchlistTickers.includes(c.ticker) && !atCap;

  const handleRowClick = (c: ComplexCompany) => {
    onSelectForTrade?.(c);
    setOpen(false);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = results[activeIndex];
      if (!c) return;
      // Enter activates "Buy/Sell" affordance on row (consistent with click)
      handleRowClick(c);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative" data-tutorial="complex-search">
      {/* Prominent, hero-style search bar */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/40 to-secondary/40 border-2 border-primary/30 focus-within:border-primary/70 focus-within:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)] transition-all shadow-lg shadow-primary/5">
        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Search className="w-4 h-4 text-primary" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-primary/80 font-mono font-semibold leading-tight">
            Search the market
          </div>
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKey}
            placeholder="Search ticker or company (e.g. AAPL, Microsoft)"
            className="border-0 bg-transparent focus-visible:ring-0 px-0 h-7 text-sm sm:text-base font-medium placeholder:text-muted-foreground/60"
            aria-label="Search complex mode stocks"
            aria-expanded={open}
            aria-controls="complex-search-results"
            aria-autocomplete="list"
            aria-activedescendant={open && results[activeIndex] ? `complex-opt-${results[activeIndex].ticker}` : undefined}
            role="combobox"
          />
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">Watchlist</div>
          <div className="font-mono text-sm font-semibold">
            <span className={atCap ? 'text-amber-400' : 'text-foreground'}>{watchlistTickers.length}</span>
            <span className="text-muted-foreground/60">/{watchlistCap}</span>
          </div>
        </div>
      </div>

      {open && query && (
        <div
          id="complex-search-results"
          role="listbox"
          aria-label="Stock search results"
          className="absolute z-30 top-full left-0 right-0 mt-2 rounded-xl bg-popover border border-border/60 shadow-2xl shadow-black/40 max-h-80 overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No matches. Companies not yet publicly traded in {currentSimYear} are hidden.
            </div>
          ) : (
            results.map((c, i) => {
              const already = watchlistTickers.includes(c.ticker);
              const isActive = i === activeIndex;
              return (
                <div
                  key={c.ticker}
                  id={`complex-opt-${c.ticker}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => handleRowClick(c)}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 transition-colors cursor-pointer ${
                    isActive ? 'bg-secondary/60' : 'hover:bg-secondary/50'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <CompanyLogo ticker={c.ticker} companyName={c.name} size="sm" />
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-semibold flex items-center gap-2">
                        {c.ticker}
                        <span className="text-[10px] text-muted-foreground/70 font-sans font-normal">{c.sector}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{c.name}</div>
                    </div>
                  </div>
                   <div className="flex items-center gap-1.5 shrink-0">
                   <Button
                    size="sm"
                    variant={already ? 'ghost' : 'outline'}
                    disabled={already || atCap}
                    className="h-8 text-xs shrink-0"
                    aria-label={already ? `${c.ticker} already in watchlist` : `Add ${c.ticker} to watchlist`}
                    onClick={(e) => { e.stopPropagation(); onAdd(c); }}
                  >
                    {already ? <><Check className="w-3 h-3 mr-1" /> Added</> : <><Plus className="w-3 h-3 mr-1" /> Watch</>}
                  </Button>
                   <Button size="sm" variant="secondary" className="h-8 text-xs" aria-label={`Trade ${c.ticker}`} onClick={(e) => { e.stopPropagation(); handleRowClick(c); }}>
                     <ArrowUpRight className="w-3.5 h-3.5 mr-1" /> Trade
                   </Button>
                   </div>
                </div>
              );
            })
          )}
          {atCap && (
            <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border/30 bg-card/40">
              Watchlist full ({watchlistCap}). Remove a stock to add another.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WatchlistRemoveButton({ onRemove, ticker }: { onRemove: () => void; ticker?: string }) {
  return (
    <button
      onClick={onRemove}
      aria-label={ticker ? `Remove ${ticker} from watchlist` : 'Remove from watchlist'}
      className="text-muted-foreground/60 hover:text-loss transition-colors p-1 rounded-md hover:bg-loss/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  );
}
