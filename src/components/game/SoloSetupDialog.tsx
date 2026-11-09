import { COMPANY_COUNT } from '@/data/complexReturns';
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { STOCK_POOL, NORMAL_MODE_TICKERS } from '@/data/historicalData';
import { Shuffle, Check, ChevronDown, Lock, Calendar, Info } from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';

export interface SoloConfig {
  duration: number;
  startYear: number;
  selectedStockIds: string[];
  gameMode: 'normal' | 'complex' | 'hard';
}

interface SoloSetupDialogProps {
  open: boolean;
  initialDuration: number;
  onClose: () => void;
  onStart: (config: SoloConfig) => void;
}

export function SoloSetupDialog({ open, initialDuration, onClose, onStart }: SoloSetupDialogProps) {
  const [startYear, setStartYear] = useState(() => {
    if (initialDuration >= 35) return 1990;
    const max = 2025 - initialDuration;
    return 1990 + Math.floor(Math.random() * (max - 1990 + 1));
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gameMode, setGameMode] = useState<'normal' | 'complex'>('normal');

  const duration = initialDuration >= 35 ? 35 : initialDuration;
  const endYear = Math.min(startYear + duration, 2025);

  // Reset startYear when duration changes
  useEffect(() => {
    if (initialDuration >= 35) {
      setStartYear(1990);
    } else {
      const max = 2025 - initialDuration;
      setStartYear(prev => prev > max ? max : prev);
    }
    setSelectedIds([]);
  }, [initialDuration]);

  const maxStartYear = 2025 - duration;
  const startYearOptions = useMemo(() => {
    const opts: number[] = [];
    for (let y = 1990; y <= maxStartYear; y++) opts.push(y);
    return opts;
  }, [maxStartYear]);

  const eligibleStocks = useMemo(() => {
    return STOCK_POOL.filter(s => {
      if (s.ipoYear >= endYear) return false;
      if (gameMode === 'normal' && !NORMAL_MODE_TICKERS.has(s.ticker)) return false;
      return true;
    });
  }, [endYear, gameMode]);

  const startableStocks = useMemo(() => {
    return eligibleStocks.filter(s => {
      if (s.ipoYear > startYear) return false;
      return true;
    });
  }, [eligibleStocks, startYear]);

  const handleStartYearChange = (y: number) => {
    setStartYear(y);
    setSelectedIds(prev => prev.filter(id => {
      const stock = STOCK_POOL.find(s => s.id === id);
      if (!stock) return false;
      if (stock.ipoYear > y) return false;
      return true;
    }));
  };

  const toggleStock = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const randomizeStocks = () => {
    const shuffled = [...startableStocks].sort(() => Math.random() - 0.5);
    setSelectedIds(shuffled.slice(0, 4).map(s => s.id));
  };

  const randomizeStartYear = () => {
    if (duration >= 35) return;
    const max = 2025 - duration;
    const y = 1990 + Math.floor(Math.random() * (max - 1990 + 1));
    handleStartYearChange(y);
  };

  const handleStart = () => {
    const ids = selectedIds.length > 0 ? selectedIds : undefined;
    onStart({ duration, startYear, selectedStockIds: ids || [], gameMode });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Set Up Your Stock Game</DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Choose a mode, time period, and starting stocks. You can also start with random stocks.
          </p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Game Mode */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Game Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setGameMode('normal')}
                className={`px-2.5 py-3 rounded-lg border text-sm transition-all text-left ${
                  gameMode === 'normal'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 text-muted-foreground hover:border-primary/30'
                }`}
              >
                <div className="font-medium font-mono text-xs">Basic</div>
                <div className="text-[10px] opacity-70 mt-0.5">Limited set of beginner-friendly stocks and funds</div>
              </button>
              <button
                onClick={() => setGameMode('complex')}
                className={`px-2.5 py-3 rounded-lg border text-sm transition-all text-left ${
                  gameMode === 'complex'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 text-muted-foreground hover:border-primary/30'
                }`}
              >
                <div className="font-medium font-mono text-xs">Advanced</div>
                <div className="text-[10px] opacity-70 mt-0.5">{COMPANY_COUNT} companies + Bitcoin; availability varies by year</div>
              </button>
            </div>

          </div>

          {/* Start Year */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Time Period
            </label>
            <p className="text-xs text-muted-foreground">Pick the historical market window your game will simulate.</p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={startYear}
                  onChange={e => handleStartYearChange(Number(e.target.value))}
                  disabled={duration >= 35}
                  className="w-full appearance-none bg-secondary border border-border rounded-lg px-3 py-2 pr-8 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                  {startYearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              <span className="text-muted-foreground font-mono text-sm">→</span>
              <div className="bg-secondary border border-border rounded-lg px-3 py-2 font-mono text-sm text-foreground min-w-[60px] text-center">
                {endYear}
              </div>
              {duration < 35 && (
                <Button variant="ghost" size="sm" className="h-9 px-2" onClick={randomizeStartYear} title="Random start year">
                  <Shuffle className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Stock Selection — Normal mode only */}
          {gameMode === 'normal' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Starting Stocks
                </label>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={randomizeStocks}>
                  <Shuffle className="w-3 h-3" /> Randomize
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose 4 starting stocks, or let the simulator choose for you. More stocks unlock as the game progresses.
                {selectedIds.length > 0 && (
                  <span className="ml-1 text-primary font-medium">{selectedIds.length}/4 selected</span>
                )}
              </p>
              <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                {eligibleStocks.map(stock => {
                  const isLocked = stock.ipoYear > startYear;
                  const unlockGameYear = stock.ipoYear - startYear + 1;
                  const isSelected = selectedIds.includes(stock.id);
                  const isCapDisabled = !isSelected && selectedIds.length >= 4;

                  const tileInner = (
                    <>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-primary border-primary' : isLocked ? 'border-border/40' : 'border-border'
                      }`}>
                        {isSelected ? <Check className="w-3 h-3 text-primary-foreground" /> : isLocked ? <Lock className="w-2.5 h-2.5 opacity-60" /> : null}
                      </div>
                      <CompanyLogo ticker={stock.ticker} companyName={stock.name} size="xs" className={isLocked ? 'opacity-60' : ''} />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono font-medium flex items-center gap-1.5">
                          {stock.ticker}
                          {isLocked && (
                            <span className="text-[9px] font-sans font-normal text-muted-foreground/70 uppercase tracking-wider">
                              Y{unlockGameYear}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{stock.name}</div>
                      </div>
                      {isLocked && <Info className="w-3 h-3 text-muted-foreground/70 shrink-0" />}
                    </>
                  );

                  if (isLocked) {
                    return (
                      <Popover key={stock.id}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all text-xs w-full border-border/20 bg-secondary/20 text-muted-foreground/70 hover:border-primary/30 hover:bg-secondary/40 cursor-pointer"
                            aria-label={`${stock.ticker} locked — see why`}
                          >
                            {tileInner}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="start" className="w-72 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center">
                              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-mono text-sm font-semibold truncate">{stock.ticker}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{stock.name}</div>
                            </div>
                          </div>
                          <div className="rounded-md bg-secondary/40 border border-border/40 p-2 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Unlocks</span>
                              <span className="font-mono text-foreground font-medium">
                                Game year {unlockGameYear} · {stock.ipoYear}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">Real IPO</span>
                              <span className="font-mono text-foreground font-medium">{stock.ipoYear}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">Your start year</span>
                              <span className="font-mono text-foreground font-medium">{startYear}</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            <span className="text-foreground font-medium">Why locked? </span>
                            {stock.ticker} didn't go public until {stock.ipoYear}, so it can't be traded at the start of a {startYear} simulation. It will unlock automatically when the simulated year reaches {stock.ipoYear} (in-game year {unlockGameYear}).
                          </p>
                        </PopoverContent>
                      </Popover>
                    );
                  }

                  return (
                    <button
                      key={stock.id}
                      onClick={() => toggleStock(stock.id)}
                      disabled={isCapDisabled}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all text-xs w-full ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : isCapDisabled
                          ? 'border-border/30 text-muted-foreground/40 cursor-not-allowed'
                          : 'border-border/50 text-foreground hover:border-primary/30'
                      }`}
                    >
                      {tileInner}
                    </button>
                  );
                })}
              </div>
              {eligibleStocks.some(s => s.ipoYear > startYear) && (
                <p className="text-[10px] text-muted-foreground/60 italic">
                  Locked stocks unlock automatically at their real IPO year during the game.
                </p>
              )}
            </div>
          )}

          {gameMode === 'complex' && (
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">
                <span className="text-primary font-medium">Advanced Mode:</span> {COMPANY_COUNT} real companies plus Bitcoin (from 2010). Which ones you can trade depends on the simulated year — each unlocks at its real IPO date.
              </p>
            </div>
          )}

          {/* Start Button */}
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            size="lg"
            onClick={handleStart}
          >
            {gameMode === 'complex'
              ? 'Start Advanced Mode'
              : selectedIds.length === 0
              ? 'Start with Random Stocks'
              : `Start with ${selectedIds.length} Chosen Stocks`
            }
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  );
}
