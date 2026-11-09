import { useState } from 'react';
import { Lock, Unlock, AlertTriangle, Clock, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GameEngine, ActiveCD } from '@/hooks/useGameEngine';

interface CDPanelProps {
  engine: GameEngine;
}

function formatMoney(v: number) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TERM_LABELS: Record<string, string> = { '1y': '1-Year', '2y': '2-Year', '5y': '5-Year' };
const TERM_GAME_YEARS: Record<string, number> = { '1y': 1, '2y': 2, '5y': 5 };

export function CDPanel({ engine }: CDPanelProps) {
  const { cash, cdRates, activeCDs, totalSeconds, buyCD, withdrawCD } = engine;
  const [buyOpen, setBuyOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<'1y' | '2y' | '5y'>('1y');
  const [amount, setAmount] = useState('1000');
  const [earlyWithdrawCD, setEarlyWithdrawCD] = useState<ActiveCD | null>(null);

  const activeCDsLive = activeCDs.filter(cd => !cd.matured);

  const handleBuy = () => {
    const num = parseFloat(amount);
    if (num > 0 && num <= cash) {
      buyCD(selectedTerm, num, cdRates[selectedTerm]);
      setBuyOpen(false);
      setAmount('1000');
    }
  };

  const handleWithdraw = (cd: ActiveCD) => {
    if (totalSeconds < cd.maturitySecond) {
      setEarlyWithdrawCD(cd);
    } else {
      withdrawCD(cd.id, false);
    }
  };

  const confirmEarlyWithdraw = () => {
    if (earlyWithdrawCD) {
      withdrawCD(earlyWithdrawCD.id, true);
      setEarlyWithdrawCD(null);
    }
  };

  return (
    <div className="rounded-lg bg-card border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Lock className="w-4 h-4" /> CDs
        </h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBuyOpen(true)} disabled={cash < 100}>
          Buy CD
        </Button>
      </div>

      {/* Current rates */}
      <div className="grid grid-cols-3 gap-1 text-xs">
        {(['1y', '2y', '5y'] as const).map(term => (
          <div key={term} className="bg-secondary/50 rounded p-1.5 text-center">
            <div className="text-muted-foreground">{TERM_LABELS[term]}</div>
            <div className="font-mono font-medium text-accent">{(cdRates[term] * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>

      {/* Active CDs */}
      {activeCDsLive.length > 0 ? (
        <div className="space-y-2">
          {activeCDsLive.map(cd => {
            const remaining = Math.max(0, cd.maturitySecond - totalSeconds);
            const yearsLeft = (remaining / 60).toFixed(1);
            const termYears = TERM_GAME_YEARS[cd.type];
            const payout = cd.principal * (1 + cd.rate * termYears);
            const progress = ((totalSeconds - cd.purchaseSecond) / (cd.maturitySecond - cd.purchaseSecond)) * 100;

            return (
              <div key={cd.id} className="bg-secondary/30 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{TERM_LABELS[cd.type]} CD</span>
                  <span className="font-mono text-accent">{(cd.rate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Principal: {formatMoney(cd.principal)}</span>
                  <span>Payout: {formatMoney(payout)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{yearsLeft} yrs left</span>
                  <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-6 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => handleWithdraw(cd)}
                >
                  <Unlock className="w-3 h-3 mr-1" />
                  Withdraw{remaining > 0 ? ' Early (20% penalty)' : ''}
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No active CDs. Lock in guaranteed returns!</p>
      )}

      {/* Buy CD Dialog */}
      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Banknote className="w-5 h-5" /> Buy Certificate of Deposit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Select Term</label>
              <div className="grid grid-cols-3 gap-2">
                {(['1y', '2y', '5y'] as const).map(term => (
                  <button
                    key={term}
                    onClick={() => setSelectedTerm(term)}
                    className={`rounded-lg p-3 text-center border transition-colors ${
                      selectedTerm === term
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-secondary/30 text-foreground hover:border-accent/50'
                    }`}
                  >
                    <div className="font-medium text-sm">{TERM_LABELS[term]}</div>
                    <div className="font-mono text-lg font-bold">{(cdRates[term] * 100).toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">
                      {TERM_GAME_YEARS[term]} game yr{TERM_GAME_YEARS[term] > 1 ? 's' : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Investment Amount</label>
              <Input
                type="number"
                inputMode="decimal"
                min="100"
                max={cash}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="h-12 text-base font-mono bg-secondary border-border"
              />

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Available: {formatMoney(cash)}</span>
                <button className="text-primary hover:underline" onClick={() => setAmount(String(Math.floor(cash)))}>
                  Use Max
                </button>
              </div>
            </div>

            {parseFloat(amount) > 0 && (
              <div className="bg-secondary/30 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Principal</span>
                  <span className="font-mono">{formatMoney(parseFloat(amount) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interest Earned</span>
                  <span className="font-mono text-accent">
                    +{formatMoney((parseFloat(amount) || 0) * cdRates[selectedTerm] * TERM_GAME_YEARS[selectedTerm])}
                  </span>
                </div>
                <div className="flex justify-between font-medium border-t border-border pt-1">
                  <span>Total at Maturity</span>
                  <span className="font-mono">
                    {formatMoney((parseFloat(amount) || 0) * (1 + cdRates[selectedTerm] * TERM_GAME_YEARS[selectedTerm]))}
                  </span>
                </div>
                <div className="text-xs text-destructive/80 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  Early withdrawal: 20% penalty on principal
                </div>
              </div>
            )}

            <Button
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleBuy}
              disabled={!parseFloat(amount) || parseFloat(amount) > cash || parseFloat(amount) < 100}
            >
              <Lock className="w-4 h-4 mr-1" />
              Lock in {TERM_LABELS[selectedTerm]} CD at {(cdRates[selectedTerm] * 100).toFixed(1)}%
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Early Withdrawal Confirmation */}
      <AlertDialog open={!!earlyWithdrawCD} onOpenChange={(open) => !open && setEarlyWithdrawCD(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Early Withdrawal Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              {earlyWithdrawCD && (
                <>
                  Withdrawing your {TERM_LABELS[earlyWithdrawCD.type]} CD early will incur a <strong className="text-destructive">20% penalty</strong> on your principal.
                  <br /><br />
                  <span className="text-muted-foreground">Principal:</span> {formatMoney(earlyWithdrawCD.principal)}<br />
                  <span className="text-muted-foreground">You'll receive:</span> <span className="text-destructive font-mono">{formatMoney(earlyWithdrawCD.principal * 0.8)}</span><br />
                  <span className="text-muted-foreground">Loss:</span> <span className="text-destructive font-mono">-{formatMoney(earlyWithdrawCD.principal * 0.2)}</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep CD</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEarlyWithdraw} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Withdraw Early
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}