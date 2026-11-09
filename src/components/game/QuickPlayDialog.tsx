import { COMPANY_COUNT } from '@/data/companyCount';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, Clock, Settings2 } from 'lucide-react';
import type { SoloConfig } from './SoloSetupDialog';

interface QuickPlayDialogProps {
  open: boolean;
  onClose: () => void;
  onStart: (config: SoloConfig) => void;
  /** Opens the full setup screen (era, starting stocks, everything). */
  onCustomize?: () => void;
}

const LENGTHS: { value: number; label: string; blurb: string }[] = [
  { value: 5, label: 'Quick game', blurb: '5 years · about 5 minutes' },
  { value: 10, label: 'Longer game', blurb: '10 years · about 10 minutes' },
  { value: 20, label: '20 years', blurb: 'a full market cycle' },
  { value: 35, label: 'Full era', blurb: '1990 to 2025' },
];

/**
 * One compact setup: how long to play, which asset set, and a link to the full
 * customisation screen. Era and starting stocks are picked automatically so a
 * first-time player is two clicks from the market opening.
 */
export function QuickPlayDialog({ open, onClose, onStart, onCustomize }: QuickPlayDialogProps) {
  const [duration, setDuration] = useState(5);
  const [gameMode, setGameMode] = useState<'normal' | 'complex'>('normal');

  useEffect(() => {
    if (open) {
      setDuration(5);
      setGameMode('normal');
    }
  }, [open]);

  const start = () => {
    const startYear = duration >= 35 ? 1990 : 1990 + Math.floor(Math.random() * (2025 - duration - 1990 + 1));
    onStart({ duration: duration >= 35 ? 35 : duration, startYear, selectedStockIds: [], gameMode });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Start playing</DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            One simulated year takes about a minute. We pick the era and your opening stocks.
          </p>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">How long</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LENGTHS.map((l) => {
                const selected = duration === l.value;
                return (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setDuration(l.value)}
                    aria-pressed={selected}
                    className={`text-left rounded-xl border p-4 min-h-[4.5rem] transition-all ${
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 text-foreground hover:border-primary/40 hover:bg-secondary/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-display font-semibold text-base">
                      <Clock className="w-4 h-4 opacity-80" aria-hidden="true" />
                      {l.label}
                      {selected && <Check className="w-4 h-4 ml-auto" aria-hidden="true" />}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{l.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">What you can buy</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGameMode('normal')}
                aria-pressed={gameMode === 'normal'}
                className={`text-left rounded-xl border p-4 transition-all ${
                  gameMode === 'normal'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 text-foreground hover:border-primary/40 hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-center gap-2 font-display font-semibold text-base">
                  Basic
                  {gameMode === 'normal' && <Check className="w-4 h-4 ml-auto" aria-hidden="true" />}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  A short list of well-known companies and funds.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setGameMode('complex')}
                aria-pressed={gameMode === 'complex'}
                className={`text-left rounded-xl border p-4 transition-all ${
                  gameMode === 'complex'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 text-foreground hover:border-primary/40 hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-center gap-2 font-display font-semibold text-base">
                  Advanced
                  {gameMode === 'complex' && <Check className="w-4 h-4 ml-auto" aria-hidden="true" />}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {COMPANY_COUNT} companies plus Bitcoin, with search.
                </div>
              </button>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            {onCustomize && (
              <Button
                variant="ghost"
                size="lg"
                className="h-12 sm:h-14 px-5 text-muted-foreground"
                onClick={() => {
                  onClose();
                  onCustomize();
                }}
              >
                <Settings2 className="w-4 h-4 mr-2" aria-hidden="true" />
                Customize
              </Button>
            )}
            <Button
              size="lg"
              className="flex-1 h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={start}
            >
              Start simulation
              <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default QuickPlayDialog;
