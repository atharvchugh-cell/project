import { getPlayerStats } from '@/lib/multiplayerStats';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flame, Gem, TrendingDown, Activity, PiggyBank, Rocket, Wallet, Sparkles } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { GamePlayer } from '@/hooks/useMultiplayer';

interface Props {
  players: GamePlayer[];
  onClose?: () => void;
}

function fmt(value: number): string {
  if (value >= 1_000_000_000_000) return '$' + (value / 1_000_000_000_000).toFixed(2) + 'T';
  if (value >= 1_000_000_000) return '$' + (value / 1_000_000_000).toFixed(2) + 'B';
  if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(2) + 'M';
  if (value >= 1_000) return '$' + (value / 1_000).toFixed(1) + 'K';
  return '$' + value.toFixed(0);
}

function pct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// Compute superlatives from portfolio_history alone (no trade log needed).
function computeSuperlatives(players: GamePlayer[]) {
  if (players.length === 0) return [];

  const stats = players.map(p => {
    const ps = getPlayerStats(p);
    const hist = ps.history;
    let peak = hist[0] || 0;
    let trough = hist[0] || 0;
    let maxDD = 0;
    let troughAfterPeak = peak;
    let bestRecovery = 0;
    let totalVar = 0;
    for (let i = 0; i < hist.length; i++) {
      const v = hist[i];
      if (v > peak) { peak = v; troughAfterPeak = v; }
      if (v < troughAfterPeak) troughAfterPeak = v;
      if (peak > 0) {
        const dd = (peak - v) / peak;
        if (dd > maxDD) maxDD = dd;
      }
      if (v < trough) trough = v;
      if (i > 0) totalVar += Math.abs(hist[i] - hist[i - 1]) / Math.max(1, hist[i - 1]);
      // recovery = how much value gained from this trough to end
      const fromTrough = (hist[hist.length - 1] - troughAfterPeak) / Math.max(1, troughAfterPeak);
      if (fromTrough > bestRecovery) bestRecovery = fromTrough;
    }
    const returnPct = ps.returnPct;
    const cashPct = ps.value > 0 ? (Number(p.cash) / ps.value) * 100 : 0;
    const positions = Object.values(p.holdings || {}).filter(n => (n as number) > 0).length;
    return {
      player: p,
      returnPct,
      maxDD: maxDD * 100,
      bestRecovery: bestRecovery * 100,
      volatility: totalVar / Math.max(1, hist.length),
      cashPct,
      positions,
    };
  });

  const awards: { title: string; emoji: string; icon: any; player: string; stat: string; color: string }[] = [];

  // Diamond Hands: lowest volatility with positive return
  const eligible = stats.filter(s => s.returnPct > 0);
  if (eligible.length > 0) {
    const winner = [...eligible].sort((a, b) => a.volatility - b.volatility)[0];
    awards.push({
      title: 'Diamond Hands',
      emoji: '💎',
      icon: Gem,
      player: winner.player.player_name,
      stat: `Steadiest growth · ${pct(winner.returnPct)}`,
      color: 'text-primary',
    });
  }

  // Panic Seller / Survivor of Worst Drawdown: largest drawdown
  const worstDD = [...stats].sort((a, b) => b.maxDD - a.maxDD)[0];
  if (worstDD.maxDD > 5) {
    awards.push({
      title: 'Survived the Worst Drop',
      emoji: '🌪️',
      icon: TrendingDown,
      player: worstDD.player.player_name,
      stat: `Weathered a ${worstDD.maxDD.toFixed(1)}% drawdown`,
      color: 'text-loss',
    });
  }

  // Biggest Single Bet (proxy: fewest positions held + high return)
  const concentrated = [...stats].filter(s => s.positions > 0).sort((a, b) => a.positions - b.positions)[0];
  if (concentrated) {
    awards.push({
      title: 'Biggest Single Bet',
      emoji: '🎯',
      icon: Flame,
      player: concentrated.player.player_name,
      stat: `${concentrated.positions} position${concentrated.positions === 1 ? '' : 's'} · ${pct(concentrated.returnPct)}`,
      color: 'text-accent',
    });
  }

  // Comeback Kid: biggest recovery from a trough
  const comeback = [...stats].sort((a, b) => b.bestRecovery - a.bestRecovery)[0];
  if (comeback.bestRecovery > 15) {
    awards.push({
      title: 'Comeback Kid',
      emoji: '🚀',
      icon: Rocket,
      player: comeback.player.player_name,
      stat: `Bounced back +${comeback.bestRecovery.toFixed(0)}% from low`,
      color: 'text-gain',
    });
  }

  // Day Trader: highest volatility
  const trader = [...stats].sort((a, b) => b.volatility - a.volatility)[0];
  if (trader.volatility > 0) {
    awards.push({
      title: 'Day Trader',
      emoji: '⚡',
      icon: Activity,
      player: trader.player.player_name,
      stat: `Most active swings · ${pct(trader.returnPct)}`,
      color: 'text-gold',
    });
  }

  // Cash Hoarder: highest cash % at end
  const hoarder = [...stats].sort((a, b) => b.cashPct - a.cashPct)[0];
  if (hoarder.cashPct > 30) {
    awards.push({
      title: 'Cash Hoarder',
      emoji: '🏦',
      icon: PiggyBank,
      player: hoarder.player.player_name,
      stat: `${hoarder.cashPct.toFixed(0)}% in cash at the end`,
      color: 'text-muted-foreground',
    });
  }

  return awards;
}

export function MultiplayerReveal({ players, onClose }: Props) {
  const sorted = [...players].sort((a, b) => getPlayerStats(b).value - getPlayerStats(a).value);
  const top = sorted.slice(0, 5);
  const awards = computeSuperlatives(sorted);

  // Reveal stages: drumroll → podium → awards
  const [stage, setStage] = useState<'drumroll' | 'podium' | 'awards'>('drumroll');
  useEffect(() => {
    const t1 = setTimeout(() => setStage('podium'), 1400);
    const t2 = setTimeout(() => setStage('awards'), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 sm:py-12 bg-gradient-to-b from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-mono uppercase tracking-widest text-primary">Game Over</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight">Final Results</h1>
      </motion.div>

      <AnimatePresence mode="wait">
        {stage === 'drumroll' && (
          <motion.div
            key="drumroll"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.4 }}
            className="text-center py-12"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
              transition={{ duration: 1.3, ease: 'easeInOut' }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 mb-4"
            >
              <Trophy className="w-10 h-10 text-primary" />
            </motion.div>
            <p className="text-lg font-display text-muted-foreground">Tallying the leaderboard…</p>
          </motion.div>
        )}

        {stage !== 'drumroll' && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-4xl space-y-10"
          >
            {/* Podium */}
            <div className="space-y-3">
              <h2 className="text-center font-display text-sm uppercase tracking-widest text-muted-foreground">Leaderboard</h2>
              <ul className="space-y-2.5">
                {top.map((p, i) => {
                  const ps = getPlayerStats(p);
                  const r = ps.returnPct;
                  const hist = ps.history.map((v, idx) => ({ i: idx, v }));
                  const isWinner = i === 0;
                  return (
                    <motion.li
                      key={p.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.45, delay: 0.15 * (top.length - i) }}
                      className={`relative flex items-center gap-4 rounded-xl border p-4 ${
                        isWinner
                          ? 'bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border-primary/40 shadow-lg shadow-primary/10'
                          : 'bg-card border-border/60'
                      }`}
                    >
                      <div className={`font-display font-black text-3xl sm:text-4xl w-12 text-center ${isWinner ? 'text-primary' : 'text-muted-foreground'}`}>
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-base sm:text-lg truncate">{p.player_name}</div>
                        <div className={`text-xs font-mono ${r >= 0 ? 'text-gain' : 'text-loss'}`}>{pct(r)}</div>
                      </div>
                      <div className="hidden sm:block w-32 h-10 opacity-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={hist}>
                            <Line type="monotone" dataKey="v" stroke={isWinner ? 'hsl(155, 72%, 40%)' : 'hsl(215, 15%, 50%)'} strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={`font-mono font-semibold text-base sm:text-xl ${isWinner ? 'text-primary' : 'text-foreground'}`}>
                        {fmt(ps.value)}
                      </div>
                      {isWinner && (
                        <motion.div
                          initial={{ scale: 0, rotate: -30 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ duration: 0.5, delay: 0.6, type: 'spring' }}
                          className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide shadow-md"
                        >
                          WINNER
                        </motion.div>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
            </div>

            {/* Superlatives */}
            {stage === 'awards' && awards.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-center font-display text-sm uppercase tracking-widest text-muted-foreground">Superlatives</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {awards.map((a, i) => {
                    const Icon = a.icon;
                    return (
                      <motion.div
                        key={a.title}
                        initial={{ opacity: 0, rotateY: 80, y: 12 }}
                        animate={{ opacity: 1, rotateY: 0, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-xl border border-border/60 bg-card/80 backdrop-blur p-4 flex items-start gap-3"
                      >
                        <div className="text-3xl leading-none">{a.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-mono ${a.color}`}>
                            <Icon className="w-3 h-3" />
                            {a.title}
                          </div>
                          <div className="font-display font-bold text-base mt-0.5 truncate">{a.player}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{a.stat}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {onClose && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="flex justify-center pt-2"
              >
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-display font-semibold text-sm transition-colors"
                >
                  Back to Home
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
