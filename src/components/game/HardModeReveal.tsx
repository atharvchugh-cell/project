import { motion } from 'framer-motion';
import { Eye, AlertTriangle, TrendingUp, GraduationCap, Award } from 'lucide-react';
import type { GameEngine } from '@/hooks/useGameEngine';
import type { DecisionQualityResult } from '@/lib/decisionQuality';

interface Props {
  engine: GameEngine;
  decisionQuality: DecisionQualityResult;
}

function pct(v: number) {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

const gradeStyles: Record<string, string> = {
  A: 'text-gain border-gain/50 bg-gain/10',
  B: 'text-gain border-gain/30 bg-gain/5',
  C: 'text-foreground border-border bg-secondary',
  D: 'text-loss border-loss/30 bg-loss/5',
  F: 'text-loss border-loss/50 bg-loss/10',
};

export function HardModeReveal({ engine, decisionQuality }: Props) {
  const { aliasMap, allAssets, holdings, costBasis } = engine;
  if (!aliasMap) return null;

  // Build per-asset interaction summary.
  const stockAssets = allAssets.filter(a => a.type === 'stock');
  const interacted = stockAssets
    .map(a => {
      const alias = aliasMap[a.id];
      if (!alias) return null;
      const shares = holdings[a.id] || 0;
      const cost = costBasis?.[a.id] || 0;
      const bought = cost > 0 || shares > 0;
      const sold = cost > 0 && shares === 0;
      const finalReturn = a.startPrice > 0 ? ((a.currentPrice - a.startPrice) / a.startPrice) * 100 : 0;
      return {
        alias,
        shares,
        bought,
        sold,
        finalReturn,
        realName: alias.realName ?? a.realName ?? a.name,
        realTicker: alias.realTicker ?? a.realTicker ?? a.ticker,
        description: alias.realDescription,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .filter(x => x.bought || x.sold) // only interacted
    .sort((a, b) => b.finalReturn - a.finalReturn);

  const missedWins = interacted.filter(x => x.sold && x.finalReturn >= 50);
  const heldLosers = interacted.filter(x => x.shares > 0 && x.finalReturn <= -25);

  return (
    <div className="space-y-6">
      {/* Decision Quality grade — visually separate from money */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`rounded-2xl border-2 p-5 sm:p-6 ${gradeStyles[decisionQuality.letter] ?? gradeStyles.C}`}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest opacity-80">
              <GraduationCap className="w-3.5 h-3.5" />
              Decision Quality
            </div>
            <h3 className="font-display font-bold text-xl sm:text-2xl">How you played</h3>
            <p className="text-xs sm:text-sm opacity-80 max-w-prose">
              Independent of your final dollar amount — this grades the <span className="font-semibold">process</span>: concentration,
              chasing, panic selling, churn, and discipline.
            </p>
          </div>
          <div className="text-center shrink-0">
            <div className="font-display font-black text-6xl sm:text-7xl leading-none">{decisionQuality.letter}</div>
            <div className="font-mono text-xs opacity-70 mt-1">{decisionQuality.score} / 100</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {decisionQuality.breakdown.map(sub => (
            <div key={sub.category} className="rounded-lg bg-background/40 border border-border/40 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-display font-semibold text-xs">{sub.category}</span>
                <span className="font-mono text-xs opacity-80">{sub.score}/100</span>
              </div>
              <div className="h-1 rounded-full bg-border/50 overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${sub.score}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`h-full ${
                    sub.score >= 75 ? 'bg-gain' : sub.score >= 50 ? 'bg-gold' : 'bg-loss'
                  }`}
                />
              </div>
              <p className="text-[11px] opacity-75 leading-snug">{sub.note}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Identity reveal */}
      <div className="rounded-lg bg-card border border-border p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-sm uppercase tracking-wider">Identity Reveal</h3>
          <span className="text-[10px] text-muted-foreground/70 ml-auto">{interacted.length} companies you touched</span>
        </div>

        {interacted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You didn't trade any individual companies this run.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {interacted.map((x, i) => (
              <motion.li
                key={x.alias.realId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: i * 0.035 }}
                className="py-3 flex items-start gap-3"
              >
                <div className="font-mono text-xs text-muted-foreground w-16 shrink-0 pt-0.5">{x.alias.codename}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-sm">
                    {x.realName} <span className="font-mono text-muted-foreground text-xs">({x.realTicker})</span>
                  </div>
                  {x.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{x.description}</div>
                  )}
                </div>
                <div className={`font-mono text-xs sm:text-sm shrink-0 ${x.finalReturn >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {pct(x.finalReturn)}
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* Counterfactuals: sold winners */}
      {missedWins.length > 0 && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-accent" />
            <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-accent">Sold Winners</h4>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm">
            {missedWins.slice(0, 5).map(x => (
              <li key={x.alias.realId}>
                <span className="text-muted-foreground">{x.alias.codename}, which you sold, </span>
                <span className="text-foreground">was {x.realName}.</span>{' '}
                <span className="text-gain font-mono">Holding would have returned {pct(x.finalReturn)}.</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {heldLosers.length > 0 && (
        <div className="rounded-lg border border-loss/30 bg-loss/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-loss" />
            <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-loss">Held Losers</h4>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm">
            {heldLosers.slice(0, 5).map(x => (
              <li key={x.alias.realId}>
                <span className="text-muted-foreground">{x.alias.codename}, which you held, </span>
                <span className="text-foreground">was {x.realName}.</span>{' '}
                <span className="text-loss font-mono">Position closed at {pct(x.finalReturn)}.</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
