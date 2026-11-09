import { PortfolioPie, SliceLegend } from './PortfolioPie';
import { portfolioSlices, assetResults, standouts } from '@/lib/portfolioBreakdown';
import { getActiveRoom } from '@/lib/roomContext';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, TrendingUp, TrendingDown, RotateCcw, ChevronLeft, Calendar, Lightbulb, Check, BarChart3, Loader2, AlertTriangle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { GameEngine, PRICE_TICK_SECONDS } from '@/hooks/useGameEngine';
import { incrementStockGamesPlayed } from '@/lib/gamesPlayedCounter';
import { computeBenchmark } from '@/data/historicalData';
import { AICoachFeedback } from './AICoachFeedback';
import { HardModeReveal } from './HardModeReveal';
import { CompanyLogo } from './CompanyLogo';
import { computeDecisionQuality } from '@/lib/decisionQuality';
import { trackGameEvent, getStoredDisplayName, setStoredDisplayName, setLastRun } from '@/lib/analytics';
import { fetchLeaderboard } from '@/lib/leaderboard';
import { supabase } from '@/integrations/supabase/client';
import { calculateInvestmentReturn } from '@/lib/investmentReturn';
import { ChallengePanel } from './ChallengePanel';
import { matchingChallenge, clearActiveChallenge } from '@/lib/challenge';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend,
} from 'recharts';


interface EndGameScreenProps {
  engine: GameEngine;
  onPlayAgain: () => void;
}

function formatMoney(value: number): string {
  if (value >= 1_000_000_000_000) return '$' + (value / 1_000_000_000_000).toFixed(2) + 'T';
  if (value >= 1_000_000_000) return '$' + (value / 1_000_000_000).toFixed(2) + 'B';
  if (value >= 10_000_000) return '$' + (value / 1_000_000).toFixed(2) + 'M';
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMoneyShort(value: number): string {
  if (value >= 1_000_000_000_000) return '$' + (value / 1_000_000_000_000).toFixed(1) + 'T';
  if (value >= 1_000_000_000) return '$' + (value / 1_000_000_000).toFixed(1) + 'B';
  if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return '$' + (value / 1_000).toFixed(0) + 'K';
  return '$' + value.toFixed(0);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function getWorldRecordMultiplier(duration: number): number {
  if (duration >= 35) return 35;
  if (duration >= 20) return 15;
  if (duration >= 15) return 10;
  if (duration >= 10) return 7;
  return 5;
}

export function EndGameScreen({ engine, onPlayAgain }: EndGameScreenProps) {
  const {
    portfolioValue, totalContributions, cash, holdings,
    currentAssets, startYear, endYear, portfolioHistory, assetConfigs, gameDuration,
  } = engine;

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [compareAssetId, setCompareAssetId] = useState<string | null>(null);
  const [showBenchmarks, setShowBenchmarks] = useState(true);

  // Count this completed stock game exactly once per mount.
  useEffect(() => { incrementStockGamesPlayed(); }, []);

  const isHard = engine.gameMode === 'hard';

  const totalReturn = engine.totalReturn;
  const gainLoss = portfolioValue - totalContributions;

  // Qualifying gate: ask for a name BEFORE showing the final summary,
  // but only when this run would actually crack the top 25 leaderboard.
  const gameIsMultiplayer = (engine as unknown as { isMultiplayer?: boolean }).isMultiplayer ?? false;
  const [gateState, setGateState] = useState<'checking' | 'qualified' | 'passed'>('checking');
  const [qualifyRank, setQualifyRank] = useState<number | null>(null);
  const [qualifyCutoff, setQualifyCutoff] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [nameEntry, setNameEntry] = useState<string>(() => getStoredDisplayName() ?? '');
  const [percentile, setPercentile] = useState<{ rank: number; total: number; pct: number } | null>(null);
  const [postedToLeaderboard, setPostedToLeaderboard] = useState(false);
  /** Leaderboard write status, surfaced to the player while it happens. */
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
  const [queued, setQueued] = useState(false);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [traceCopied, setTraceCopied] = useState(false);
  const lastSubmittedName = useRef<string | null>(null);
  // One stable id per finished game: retries reuse it so the same run can
  // never land on the leaderboard twice, even after backups are replayed.
  const clientRunId = useRef<string>(crypto.randomUUID());
  const [activeChallenge] = useState(() => (gameIsMultiplayer ? null : matchingChallenge(startYear, endYear, engine.gameMode)));
  const [beatTarget, setBeatTarget] = useState<boolean | null>(null);

  async function fetchPercentile(endingValue: number) {
    const { data, error } = await supabase.rpc('get_run_percentile', { p_ending_value: endingValue });
    if (error || !data || !Array.isArray(data) || data.length === 0) return null;
    const row = data[0] as { rank_position: number; total_runs: number; percentile: number };
    return { rank: Number(row.rank_position), total: Number(row.total_runs), pct: Number(row.percentile) };
  }

  const recordRun = async (displayName: string | null) => {
    lastSubmittedName.current = displayName;
    setSyncState('syncing');
    const result = await trackGameEvent({
      game_mode: engine.gameMode,
      simulation_length: gameDuration,
      is_multiplayer: gameIsMultiplayer,
      start_year: startYear,
      end_year: endYear,
      starting_value: totalContributions,
      ending_value: portfolioValue,
      return_pct: Number(totalReturn.toFixed(2)),
      assets: assetConfigs.map(a => a.id),
      completed: true,
      display_name: displayName,
      challenge_code: activeChallenge?.code ?? null,
      simulation: { portfolio_history: portfolioHistory, holdings, cash, trade_log: engine.tradeLog?.slice(-500) ?? [] },
      client_run_id: clientRunId.current,
    });
    setTraceId(result.traceId);
    setQueued(!!result.queued);
    if (result.challengeCode) { setBeatTarget(result.beatTarget ?? null); clearActiveChallenge(); }
    if (!result.stored) {
      setSyncState('failed');
      return;
    }
    setLastRun({
      display_name: displayName || 'Anonymous',
      ending_value: portfolioValue,
      return_pct: Number(totalReturn.toFixed(2)),
      start_year: startYear,
      end_year: endYear,
      is_multiplayer: gameIsMultiplayer,
    });
    // Refresh placement AFTER the row lands so the player sees themselves included.
    const p = await fetchPercentile(portfolioValue);
    if (p) setPercentile(p);
    setPostedToLeaderboard(true);
    setSyncState('synced');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [rows, p] = await Promise.all([
        // A failed request must not look like an empty board (which would make
        // every run "qualify"); fall back to the normal naming path instead.
        fetchLeaderboard({ windowId: 'all', kind: 'all', sort: 'wealth', limit: 25 }).catch(() => null),
        fetchPercentile(portfolioValue),
      ]);
      if (cancelled) return;
      if (p) setPercentile(p);
      if (!rows) {
        setQualifyRank(null); setQualifyCutoff(0); setGateState('qualified');
        return;
      }
      const cutoff = rows.length < 25 ? 0 : Number(rows[rows.length - 1].ending_value);
      const qualifies = portfolioValue > cutoff;
      if (qualifies) {
        const rank = rows.findIndex(r => portfolioValue > Number(r.ending_value));
        setQualifyRank(rank === -1 ? rows.length + 1 : rank + 1);
        setQualifyCutoff(cutoff);
        setGateState('qualified');
      } else {
        // Show the results (with placement) straight away; the write finishes
        // in the background behind a "finalizing" indicator.
        // Always let the player put their name on the run. Reuse a saved name.
        setQualifyRank(null);
        setQualifyCutoff(0);
        setGateState('qualified');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assetPerformance = currentAssets.map(a => {
    const start = a.startPrice > 0 ? a.startPrice : (a.prices.find(p => p > 0) ?? 0);
    return {
      ...a,
      startPrice: start,
      totalReturn: start > 0 ? ((a.currentPrice - start) / start) * 100 : 0,
    };
  });
  const bestAsset = [...assetPerformance].sort((a, b) => b.totalReturn - a.totalReturn)[0];
  const worstAsset = [...assetPerformance].sort((a, b) => a.totalReturn - b.totalReturn)[0];

  const sp500Config = assetConfigs.find(a => a.id === 'sp500');
  const goldConfig = assetConfigs.find(a => a.id === 'gold');
  const sp500Benchmark = sp500Config ? computeBenchmark(sp500Config.prices, engine.totalGameSeconds) : totalContributions;
  const goldBenchmark = goldConfig ? computeBenchmark(goldConfig.prices, engine.totalGameSeconds) : totalContributions;
  const cashBenchmark = totalContributions;

  // Decision quality is only meaningful in Hard mode (which logs trades).
  const decisionQuality = useMemo(() => {
    if (!isHard) return null;
    return computeDecisionQuality(
      engine.tradeLog ?? [],
      portfolioHistory,
      gameDuration,
      startYear,
    );
  }, [isHard, engine.tradeLog, portfolioHistory, gameDuration, startYear]);



  const sp500Prices = sp500Config?.prices || [];
  const playerVsSp500Data = portfolioHistory.map((value, i) => {
    const year = Math.floor((i * PRICE_TICK_SECONDS) / 60) + startYear;
    return {
      tick: i,
      year,
      yearLabel: `${year}`,
      player: Math.round(value),
      sp500: 0,
      compareAsset: 0,
    };
  });

  {
    let shares = 0;
    let nextContribSecond = 0;
    for (let i = 0; i < playerVsSp500Data.length; i++) {
      const priceIdx = Math.min(Math.floor((i * PRICE_TICK_SECONDS * 24) / 60), sp500Prices.length - 1);
      const price = sp500Prices[priceIdx] || 1;
      const currentSecond = i * PRICE_TICK_SECONDS;
      while (nextContribSecond <= currentSecond) {
        shares += 5000 / price;
        nextContribSecond += 15;
      }
      playerVsSp500Data[i].sp500 = Math.round(shares * price);
    }
  }

  // Individual asset comparison benchmark
  const compareConfig = compareAssetId ? assetConfigs.find(a => a.id === compareAssetId) : null;
  const compareBenchmark = useMemo(() => {
    if (!compareConfig) return 0;
    return computeBenchmark(compareConfig.prices, engine.totalGameSeconds);
  }, [compareConfig, engine.totalGameSeconds]);

  if (compareConfig) {
    const comparePrices = compareConfig.prices;
    let shares = 0;
    let nextContribSecond = 0;
    for (let i = 0; i < playerVsSp500Data.length; i++) {
      const priceIdx2 = Math.min(Math.floor((i * PRICE_TICK_SECONDS * 24) / 60), comparePrices.length - 1);
      const price = comparePrices[priceIdx2] || 1;
      const currentSecond = i * PRICE_TICK_SECONDS;
      while (nextContribSecond <= currentSecond) {
        if (price > 0) shares += 5000 / price;
        nextContribSecond += 15;
      }
      playerVsSp500Data[i].compareAsset = Math.round(shares * price);
    }
  }

  const AVERAGE_PLAYER = sp500Benchmark * 1.8;
  const WORLD_RECORD = sp500Benchmark * getWorldRecordMultiplier(gameDuration);

  const selectedConfigData = assetConfigs.find(a => a.id === selectedAssetId);
  const selectedCurrent = currentAssets.find(a => a.id === selectedAssetId);

  const assetChartData = selectedConfigData?.prices
    .filter((_, i) => i % 4 === 0) // Show only tick-aligned points for clean chart
    .map((price, i) => ({
      tick: i,
      year: startYear + Math.floor((i * 4) / 24),
      price: Math.round(price * 100) / 100,
    })) || [];

  // "Mutual Fund" = diversified equity fund tracking S&P 500 minus ~1%/yr expense + tracking drag.
  // Approximated as compounded fee drag over the contribution-weighted horizon.
  const mutualFundBenchmark = useMemo(() => {
    const feeDrag = Math.pow(0.99, gameDuration);
    return totalContributions + (sp500Benchmark - totalContributions) * feeDrag;
  }, [sp500Benchmark, totalContributions, gameDuration]);

  const comparisonData = [
    { name: 'Your Portfolio', value: portfolioValue, fill: 'hsl(155, 72%, 40%)' },
    { name: 'S&P 500 Index', value: sp500Benchmark, fill: 'hsl(210, 60%, 50%)' },
    { name: 'Mutual Fund', value: mutualFundBenchmark, fill: 'hsl(265, 60%, 60%)' },
    { name: 'All Gold', value: goldBenchmark, fill: 'hsl(45, 90%, 55%)' },
    { name: 'All Cash', value: cashBenchmark, fill: 'hsl(215, 15%, 50%)' },
  ];

  if (selectedAssetId && selectedConfigData && selectedCurrent) {
    const assetReturn = selectedCurrent.startPrice > 0
      ? ((selectedCurrent.currentPrice - selectedCurrent.startPrice) / selectedCurrent.startPrice) * 100
      : 0;
    const isUp = assetReturn >= 0;

    return (
      <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4">
        <div className="container mx-auto max-w-4xl space-y-6 animate-fade-in">
          <Button variant="ghost" onClick={() => setSelectedAssetId(null)} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> Back to Summary
          </Button>

           <div className="flex flex-col items-center text-center space-y-2">
             <CompanyLogo ticker={selectedConfigData.ticker} companyName={selectedConfigData.name} size="lg" />
            <h2 className="text-2xl sm:text-3xl font-display font-bold">{selectedConfigData.name}</h2>
            <p className="text-muted-foreground font-mono text-sm">{selectedConfigData.ticker} · {startYear}–{endYear}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <StatCard label="Start Price" value={`$${selectedCurrent.startPrice.toFixed(2)}`} />
            <StatCard label="End Price" value={`$${selectedCurrent.currentPrice.toFixed(2)}`} />
            <StatCard label="Total Return" value={formatPercent(assetReturn)} color={isUp ? 'gain' : 'loss'} />
          </div>

          <div className="rounded-lg bg-card border border-border p-3 sm:p-4">
            <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
              Price History ({startYear}–{endYear})
            </h3>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={assetChartData}>
                  <defs>
                    <linearGradient id="colorAsset" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isUp ? 'hsl(155, 72%, 40%)' : 'hsl(0, 72%, 50%)'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={isUp ? 'hsl(155, 72%, 40%)' : 'hsl(0, 72%, 50%)'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="tick" tick={{ fill: 'hsl(215, 15%, 50%)', fontSize: 10 }} tickFormatter={(t) => `${startYear + Math.floor((t * 2) / 60)}`} interval={Math.floor(assetChartData.length / 8)} />
                  <YAxis tick={{ fill: 'hsl(215, 15%, 50%)', fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(220, 20%, 10%)', border: '1px solid hsl(220, 15%, 16%)', borderRadius: '8px', color: 'hsl(210, 20%, 92%)' }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                    labelFormatter={(label) => `Year ${startYear + Math.floor((label * 2) / 60)}`}
                  />
                  <Area type="monotone" dataKey="price" stroke={isUp ? 'hsl(155, 72%, 40%)' : 'hsl(0, 72%, 50%)'} strokeWidth={2} fillOpacity={1} fill="url(#colorAsset)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {(holdings[selectedAssetId] || 0) > 0 && (
            <div className="rounded-lg bg-card border border-border p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shares Held</span>
                <span className="font-mono font-medium">{holdings[selectedAssetId]}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Position Value</span>
                <span className="font-mono font-medium">
                  {formatMoney((holdings[selectedAssetId] || 0) * selectedCurrent.currentPrice)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }


  const submitWithName = async (useName: boolean) => {
      if (submitting) return;
      setSubmitting(true);
      const display = useName ? nameEntry.trim().slice(0, 32) : '';
      if (display) setStoredDisplayName(display);
      // Reveal the placement immediately; the write completes behind the
      // "finalizing leaderboard" indicator on the results screen.
      setGateState('passed');
      void recordRun(display || null);
    };
  // Optional naming sits beneath the result — never a gate in front of it.
  const nameCard = gateState !== 'qualified' ? null : (
        <section aria-labelledby="qualify-title" className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4">
          <div className="space-y-2">
            <h2 id="qualify-title" className="text-xl font-semibold">{qualifyRank !== null ? 'You qualified for the top 25!' : 'Put your name on this run'}</h2>
            <p className="text-sm text-muted-foreground">
              {qualifyRank !== null && qualifyRank <= 25
                ? <>Projected rank <span className="text-primary font-semibold">#{qualifyRank}</span> with {formatMoney(portfolioValue)}.</>
                : <>You finished with {formatMoney(portfolioValue)}. Add a name to save this run to the leaderboard, or post it anonymously.</>}
              {qualifyCutoff > 0 && <> Top 25 cutoff: <span className="font-mono">{formatMoney(qualifyCutoff)}</span>.</>}
            </p>
            {percentile && percentile.total > 0 && (
              <p className="text-sm text-muted-foreground tabular-nums">
                Top {(100 - percentile.pct).toFixed(1)}% of {percentile.total.toLocaleString()} runs
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="qualify-name" className="text-sm text-muted-foreground font-medium">
              Public leaderboard alias
            </label>
            <Input
              id="qualify-name"
              value={nameEntry}
              onChange={e => setNameEntry(e.target.value.slice(0, 32))}
              placeholder="Your name (32 char max)"
              maxLength={32}
              onKeyDown={e => { if (e.key === 'Enter' && nameEntry.trim()) submitWithName(true); }}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => submitWithName(true)}
              disabled={submitting || !nameEntry.trim()}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Claim my spot
            </Button>
            <Button
              onClick={() => submitWithName(false)}
              disabled={submitting}
              variant="ghost"
              className="text-muted-foreground"
            >
              Post as Anonymous
            </Button>
          </div>
        </section>
  );

  return (
    <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4">
      <div className="container mx-auto max-w-4xl space-y-6 sm:space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-3 sm:space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10">
            <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold">Game Over!</h1>
          <p className="text-muted-foreground text-sm">
            {startYear}–{endYear} simulation complete
          </p>
        </div>

        {nameCard}

        {/* Placement + live leaderboard sync status */}
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Your placement</div>
                {percentile && percentile.total > 0 ? (
                  <div className="font-display font-bold text-lg sm:text-xl">
                    Beat <span className="text-primary">{percentile.pct.toFixed(1)}%</span> of players
                    <span className="text-muted-foreground text-sm font-mono ml-2">
                      #{percentile.rank.toLocaleString()} of {percentile.total.toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <div className="font-display font-bold text-lg sm:text-xl text-muted-foreground">
                    Working out your placement…
                  </div>
                )}
                {qualifyRank !== null && qualifyRank <= 25 && (
                  <div className="text-[11px] text-amber-400 mt-0.5 flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> Top 25 all-time — projected #{qualifyRank}
                  </div>
                )}
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link to="/leaderboard">View leaderboard</Link>
            </Button>
          </div>

          {syncState === 'syncing' && (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground border-t border-border/40 pt-2.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              Finalizing leaderboard — saving your result…
            </div>
          )}
          {syncState === 'synced' && postedToLeaderboard && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gain border-t border-border/40 pt-2.5">
              <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved to the leaderboard</span>
              {traceId && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(traceId);
                    setTraceCopied(true);
                    setTimeout(() => setTraceCopied(false), 1800);
                  }}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy this code — quote it if your result ever goes missing"
                >
                  <Copy className="w-3 h-3" /> {traceCopied ? 'Copied' : traceId}
                </button>
              )}
            </div>
          )}
          {syncState === 'failed' && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-loss border-t border-border/40 pt-2.5">
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> We couldn't save this result to the leaderboard.
              </span>
              {queued && <span className="text-muted-foreground">Your full game is kept safely and will be added once saving works again.</span>}
              {traceId && <span className="font-mono text-[11px] text-muted-foreground">Reference {traceId}</span>}
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => void recordRun(lastSubmittedName.current)}>
                Try again
              </Button>
            </div>
          )}
        </div>

        <ChallengePanel
          traceId={syncState === 'synced' ? traceId : null}
          isMultiplayer={gameIsMultiplayer}
          name={lastSubmittedName.current || getStoredDisplayName() || 'A player'}
          value={portfolioValue}
          ret={totalReturn}
          years={isHard ? `${gameDuration} hidden years` : `${startYear}–${endYear}`}
          challenge={activeChallenge}
          beatTarget={beatTarget}
        />

        {/* Main Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Final Portfolio" value={formatMoney(portfolioValue)} highlight />
          <StatCard label="Total Contributed" value={formatMoney(totalContributions)} />
          <StatCard label="Total Return" value={formatPercent(totalReturn)} color={totalReturn >= 0 ? 'gain' : 'loss'} />
          <StatCard label="Gain/Loss" value={formatMoney(Math.abs(gainLoss))} prefix={gainLoss >= 0 ? '+' : '-'} color={gainLoss >= 0 ? 'gain' : 'loss'} />
        </div>

        {/* Mobile-optimized portfolio growth */}
        <div className="rounded-lg bg-card border border-border p-3 sm:p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Portfolio Growth
            </h3>
            <span className="text-xs font-mono text-muted-foreground">{startYear}–{endYear}</span>
          </div>
          <div className="h-44 sm:h-56 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={playerVsSp500Data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(155, 72%, 40%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(155, 72%, 40%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="tick"
                  tick={{ fill: 'hsl(215, 15%, 50%)', fontSize: 10 }}
                  tickFormatter={(t) => `'${String((startYear + Math.floor((t * 2) / 60)) % 100).padStart(2, '0')}`}
                  interval={Math.max(1, Math.floor(playerVsSp500Data.length / 5))}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(215, 15%, 50%)', fontSize: 10 }}
                  tickFormatter={(v) => formatMoneyShort(v)}
                  width={48}
                  tickLine={false}
                  axisLine={false}
                  domain={[
                    // Anchor the baseline at 0 (or below if the player went
                    // underwater) so a 2% gain doesn't fill the entire chart.
                    (dataMin: number) => Math.min(0, dataMin),
                    (dataMax: number) => Math.max(dataMax * 1.05, dataMax + 1),
                  ]}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(220, 20%, 10%)', border: '1px solid hsl(220, 15%, 16%)', borderRadius: '8px', color: 'hsl(210, 20%, 92%)', fontSize: 12 }}
                  formatter={(value: number) => [formatMoney(value), 'Portfolio']}
                  labelFormatter={(label) => `Year ${startYear + Math.floor((Number(label) * 2) / 60)}`}
                />
                <Area type="monotone" dataKey="player" stroke="hsl(155, 72%, 40%)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPortfolio)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <ResultsComparison
          portfolioValue={portfolioValue}
          totalContributions={totalContributions}
          sp500Value={sp500Benchmark}
          startYear={startYear}
          endYear={endYear}
          percentile={percentile}
        />

        {/* Your portfolio mix + what carried you */}
        {(() => {
          const heldValue = currentAssets.reduce((sum, a) => sum + (holdings[a.id] || 0) * a.currentPrice, 0);
          const cdVal = Math.max(0, portfolioValue - cash - heldValue);
          const pieAssets = currentAssets.map(a => ({ ...a, ticker: (isHard ? (a as { realTicker?: string }).realTicker : undefined) ?? a.ticker }));
          const slices = portfolioSlices(pieAssets, holdings, cash, cdVal);
          const results = assetResults(currentAssets, holdings, engine.costBasis ?? {}, engine.totalBought, engine.realizedPnl, isHard);
          const top = standouts(results);
          if (slices.length === 0 && !top) return null;
          const money = (v: number) => (v < 0 ? '-' : '+') + formatMoneyShort(Math.abs(v));
          return (
            <div className="rounded-lg bg-card border border-border p-4 sm:p-5 grid gap-5 md:grid-cols-2">
              <div>
                <h2 className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider mb-3">Your final portfolio</h2>
                <div className="flex items-center gap-4">
                  <PortfolioPie slices={slices} size={128} />
                  <SliceLegend slices={slices} />
                </div>
              </div>
              {top && (
                <div className="space-y-3">
                  <h2 className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Who carried you</h2>
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                    <div className="text-xs text-muted-foreground">Made you the most money</div>
                    <div className="font-display font-bold text-lg">{top.mostMoney.label} <span className="text-sm font-normal text-muted-foreground">{top.mostMoney.name !== top.mostMoney.label ? top.mostMoney.name : ''}</span></div>
                    <div className={`font-mono ${top.mostMoney.profit >= 0 ? 'text-gain' : 'text-loss'}`}>{money(top.mostMoney.profit)} on {formatMoneyShort(top.mostMoney.invested)} invested</div>
                    {top.carriedShare != null && <div className="text-xs text-muted-foreground mt-1">{top.carriedShare.toFixed(0)}% of all your investment gains</div>}
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs text-muted-foreground">Highest return for you</div>
                    <div className="font-display font-bold text-lg">{top.bestPct.label} <span className="text-sm font-normal text-muted-foreground">{top.bestPct.name !== top.bestPct.label ? top.bestPct.name : ''}</span></div>
                    <div className={`font-mono ${top.bestPct.returnPct >= 0 ? 'text-gain' : 'text-loss'}`}>{formatPercent(top.bestPct.returnPct)} ({money(top.bestPct.profit)})</div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Based on what you paid and what you got back, including shares you sold. Deposits are not counted as profit.</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Best/Worst Asset */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {bestAsset && (
            <div className="rounded-lg bg-card border border-border p-4 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedAssetId(bestAsset.id)}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-gain" />
                <span className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Best Performing</span>
              </div>
               <div className="flex items-center gap-3">
                 <CompanyLogo ticker={bestAsset.ticker} companyName={bestAsset.name} size="sm" />
                 <div>
                   <div className="font-display font-bold text-base sm:text-lg">{bestAsset.name}</div>
                   <div className="font-mono text-gain">{formatPercent(bestAsset.totalReturn)}</div>
                 </div>
               </div>
              <div className="text-xs text-muted-foreground mt-1">Click to view chart →</div>
            </div>
          )}
          {worstAsset && (
            <div className="rounded-lg bg-card border border-border p-4 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedAssetId(worstAsset.id)}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-loss" />
                <span className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Worst Performing</span>
              </div>
               <div className="flex items-center gap-3">
                 <CompanyLogo ticker={worstAsset.ticker} companyName={worstAsset.name} size="sm" />
                 <div>
                   <div className="font-display font-bold text-base sm:text-lg">{worstAsset.name}</div>
                   <div className="font-mono text-loss">{formatPercent(worstAsset.totalReturn)}</div>
                 </div>
               </div>
              <div className="text-xs text-muted-foreground mt-1">Click to view chart →</div>
            </div>
          )}
        </div>

        {/* Compare Against Individual Asset */}
        <div className="rounded-lg bg-card border border-border p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Your Portfolio vs. Benchmarks
            </h3>
            <select
              value={compareAssetId || ''}
              onChange={e => setCompareAssetId(e.target.value || null)}
              className="appearance-none bg-secondary border border-border rounded-lg px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Compare with…</option>
              {assetPerformance.map(a => (
                <option key={a.id} value={a.id}>{a.ticker} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={playerVsSp500Data}>
                <XAxis dataKey="tick" tick={{ fill: 'hsl(215, 15%, 50%)', fontSize: 10 }} tickFormatter={(t) => `${startYear + Math.floor((t * 2) / 60)}`} interval={Math.floor(playerVsSp500Data.length / 8)} />
                <YAxis tick={{ fill: 'hsl(215, 15%, 50%)', fontSize: 10 }} tickFormatter={(v) => formatMoneyShort(v)} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(220, 20%, 10%)', border: '1px solid hsl(220, 15%, 16%)', borderRadius: '8px', color: 'hsl(210, 20%, 92%)' }}
                  formatter={(value: number, name: string) => [
                    formatMoney(value),
                    name === 'player' ? 'Your Portfolio' : name === 'sp500' ? 'S&P 500' : compareConfig?.name || '',
                  ]}
                  labelFormatter={(label) => `Year ${startYear + Math.floor((label * 2) / 60)}`}
                />
                <Legend formatter={(value) => (value === 'player' ? 'Your Portfolio' : value === 'sp500' ? 'S&P 500' : compareConfig?.name || '')} wrapperStyle={{ color: 'hsl(210, 20%, 85%)', fontSize: '12px' }} />
                <Line type="monotone" dataKey="player" stroke="hsl(155, 72%, 40%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sp500" stroke="hsl(210, 60%, 50%)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                {compareConfig && (
                  <Line type="monotone" dataKey="compareAsset" stroke="hsl(45, 90%, 55%)" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {compareConfig && (
            <div className="mt-2 text-center text-xs text-muted-foreground">
              All-in {compareConfig.name}: <span className="font-mono text-gold">{formatMoney(compareBenchmark)}</span>
              {' · '}
              {portfolioValue >= compareBenchmark ? (
                <span className="text-gain">You beat it by {formatPercent(((portfolioValue - compareBenchmark) / compareBenchmark) * 100)}</span>
              ) : (
                <span className="text-loss">Behind by {formatPercent(((compareBenchmark - portfolioValue) / compareBenchmark) * 100)}</span>
              )}
            </div>
          )}
        </div>

        {/* Benchmark Comparison Bar */}
        <div className="rounded-lg bg-card border border-border p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Benchmark Comparison
              </h3>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                Your portfolio vs. mutual fund, S&amp;P 500, gold, and all-cash strategies.
              </p>
            </div>
            <label className="flex items-center gap-2 shrink-0 cursor-pointer">
              <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider hidden sm:inline">
                {showBenchmarks ? 'Shown' : 'Hidden'}
              </span>
              <Switch
                checked={showBenchmarks}
                onCheckedChange={setShowBenchmarks}
                aria-label="Toggle benchmark comparison"
              />
            </label>
          </div>
          {showBenchmarks ? (
            <div className="h-48 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical">
                  <XAxis type="number" tick={{ fill: 'hsl(215, 15%, 50%)', fontSize: 10 }} tickFormatter={(v) => formatMoneyShort(v)} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'hsl(210, 20%, 85%)', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(220, 20%, 10%)', border: '1px solid hsl(220, 15%, 16%)', borderRadius: '8px', color: 'hsl(210, 20%, 92%)' }}
                    formatter={(value: number) => [formatMoney(value), 'Final Value']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60 italic py-6 text-center">
              Benchmark comparison hidden. Toggle to reveal how alternative strategies performed.
            </p>
          )}
        </div>

        {/* All Assets */}
        <div className="rounded-lg bg-card border border-border p-3 sm:p-4">
          <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
            Asset Performance — Click to View Chart
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {assetPerformance.map(asset => {
              const isUp = asset.totalReturn >= 0;
              return (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  className="rounded-lg border border-border p-2.5 sm:p-3 text-left hover:border-primary/50 hover:bg-secondary/30 transition-colors"
                >
                   <div className="flex items-center gap-2.5">
                     <CompanyLogo ticker={asset.ticker} companyName={asset.name} size="xs" />
                     <div className="min-w-0">
                       <div className="font-mono text-xs text-muted-foreground">{asset.ticker}</div>
                       <div className="font-medium text-xs sm:text-sm truncate">{asset.name}</div>
                       <div className={`font-mono text-xs sm:text-sm ${isUp ? 'text-gain' : 'text-loss'}`}>
                         {formatPercent(asset.totalReturn)}
                       </div>
                     </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Best & Worst Periods (year-by-year) */}
        <PeriodsRecap engine={engine} />

        {/* Key Lessons */}
        <KeyLessons
          engine={engine}
          totalReturn={totalReturn}
          sp500Benchmark={sp500Benchmark}
          bestAsset={bestAsset}
          worstAsset={worstAsset}
        />

        {/* Hard Mode reveal + Decision Quality */}
        {isHard && decisionQuality && (
          <HardModeReveal engine={engine} decisionQuality={decisionQuality} />
        )}

        {/* AI Coach (off in Classroom rooms; the server refuses those requests too) */}
        {!getActiveRoom()?.classroom && <AICoachFeedback
          payload={(() => {
            // Max drawdown
            let peak = portfolioHistory[0] || 0;
            let maxDD = 0;
            for (const v of portfolioHistory) {
              if (v > peak) peak = v;
              if (peak > 0) {
                const dd = ((peak - v) / peak) * 100;
                if (dd > maxDD) maxDD = dd;
              }
            }

            // Yearly trajectory from portfolio history
            const TICKS_PER_YEAR = 6;
            const yearly: { year: number; portfolioValue: number; changePct: number }[] = [];
            for (let y = 0; y < gameDuration; y++) {
              const sIdx = Math.min(y * TICKS_PER_YEAR, portfolioHistory.length - 1);
              const eIdx = Math.min((y + 1) * TICKS_PER_YEAR, portfolioHistory.length - 1);
              if (sIdx >= eIdx) continue;
              const s = portfolioHistory[sIdx];
              const e = portfolioHistory[eIdx];
              yearly.push({
                year: startYear + y,
                portfolioValue: e,
                changePct: s > 0 ? ((e - s) / s) * 100 : 0,
              });
            }
            const bestY = yearly.reduce((b, c) => (c.changePct > (b?.changePct ?? -Infinity) ? c : b), null as null | { year: number; changePct: number });
            const worstY = yearly.reduce((b, c) => (c.changePct < (b?.changePct ?? Infinity) ? c : b), null as null | { year: number; changePct: number });

            // Perfect hindsight: best-returning tradeable asset for all contributions
            const tradeableAssets = assetConfigs.filter(a => a.type !== 'hysa');
            let bestHindsight: { value: number; asset: { ticker: string; name: string } } | null = null;
            for (const a of tradeableAssets) {
              const v = computeBenchmark(a.prices, engine.totalGameSeconds);
              if (!bestHindsight || v > bestHindsight.value) {
                // Use REAL ticker/name for the AI even in Hard mode — it sees the truth.
                const realT = (a as { realTicker?: string }).realTicker ?? a.ticker;
                const realN = (a as { realName?: string }).realName ?? a.name;
                bestHindsight = { value: v, asset: { ticker: realT, name: realN } };
              }
            }

            // Per-asset enrichment with bought/sold + held-to-end return.
            // In Hard mode, send the REAL identities to the AI (the player saw codenames,
            // but the AI feedback is post-reveal and benefits from concrete names).
            const assets = assetPerformance.map(a => {
              const shares = holdings[a.id] || 0;
              const cost = engine.costBasis?.[a.id] || 0;
              const value = shares * a.currentPrice;
              const realT = (a as { realTicker?: string }).realTicker ?? a.ticker;
              const realN = (a as { realName?: string }).realName ?? a.name;
              return {
                ticker: realT,
                name: realN,
                totalReturn: a.totalReturn,
                finalShares: shares,
                finalValueUsd: value,
                allocationPct: portfolioValue > 0 ? (value / portfolioValue) * 100 : 0,
                heldToEndReturnPct: a.totalReturn,
                bought: cost > 0 || shares > 0,
                sold: cost > 0 && shares === 0,
              };
            });

            // Concentration: in Hard mode use the real peak from tradeLog; otherwise final-state proxy.
            let peakConc = Math.max(0, ...assets.map(a => a.allocationPct));
            if (isHard && engine.tradeLog) {
              for (const t of engine.tradeLog) {
                if ((t.positionPctAfter ?? 0) > peakConc) peakConc = t.positionPctAfter ?? 0;
              }
            }

            return {
              mode: isHard ? ('hard' as const) : ('stock' as const),
              startYear,
              endYear,
              durationYears: gameDuration,
              totalContributed: totalContributions,
              finalPortfolio: portfolioValue,
              totalReturnPct: totalReturn,
              cashLeftover: cash,
              cashPctOfFinal: portfolioValue > 0 ? (cash / portfolioValue) * 100 : 0,
              sp500Benchmark,
              goldBenchmark,
              bestAsset: bestAsset ? { ticker: bestAsset.realTicker ?? bestAsset.ticker, name: bestAsset.realName ?? bestAsset.name, totalReturn: bestAsset.totalReturn } : undefined,
              worstAsset: worstAsset ? { ticker: worstAsset.realTicker ?? worstAsset.ticker, name: worstAsset.realName ?? worstAsset.name, totalReturn: worstAsset.totalReturn } : undefined,
              bestYear: bestY ?? undefined,
              worstYear: worstY ?? undefined,
              maxDrawdownPct: maxDD,
              peakConcentrationPct: peakConc,
              perfectHindsightFinal: bestHindsight?.value,
              perfectHindsightAsset: bestHindsight?.asset,
              yearly,
              tradeCount: engine.tradeLog?.length,
              decisionQuality: decisionQuality ?? undefined,
              assets,
            };
          })()}
        />}







        {/* Actions */}
        <div className="flex justify-center gap-4 pt-4 pb-8">
          <Button
            size="lg"
            className="px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={onPlayAgain}
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Play Again
          </Button>
        </div>

      </div>
    </div>
  );
}

interface LeaderboardSubmitCardProps {
  startYear: number;
  endYear: number;
  gameMode: string;
  simulationLength: number;
  startingValue: number;
  endingValue: number;
  returnPct: number;
  assets: string[];
  isMultiplayer?: boolean;
}

function LeaderboardSubmitCard(props: LeaderboardSubmitCardProps) {
  const [name, setName] = useState(() => getStoredDisplayName() ?? '');
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const submit = async (withName: boolean) => {
    if (busy || submittedName !== null) return;
    setBusy(true);
    const display = withName ? name.trim().slice(0, 32) : '';
    if (display) setStoredDisplayName(display);
    await trackGameEvent({
      game_mode: props.gameMode,
      simulation_length: props.simulationLength,
      is_multiplayer: !!props.isMultiplayer,
      start_year: props.startYear,
      end_year: props.endYear,
      starting_value: props.startingValue,
      ending_value: props.endingValue,
      return_pct: Number(props.returnPct.toFixed(2)),
      assets: props.assets,
      completed: true,
      display_name: display || null,
    });
    setLastRun({
      display_name: display || 'Anonymous',
      ending_value: props.endingValue,
      return_pct: Number(props.returnPct.toFixed(2)),
      start_year: props.startYear,
      end_year: props.endYear,
      is_multiplayer: !!props.isMultiplayer,
    });
    setSubmittedName(display || 'Anonymous');
    setBusy(false);
  };

  const shareUrl = useMemo(() => {
    if (submittedName === null) return '';
    const params = new URLSearchParams({
      name: submittedName,
      value: String(Math.round(props.endingValue)),
      return: props.returnPct.toFixed(2),
      start: String(props.startYear),
      end: String(props.endYear),
      mp: props.isMultiplayer ? '1' : '0',
    });
    return `${window.location.origin}/share?${params.toString()}`;
  }, [submittedName, props]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  if (submittedName !== null) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 px-5 py-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="shrink-0 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
            <Check className="w-4 h-4 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">Posted to the leaderboard</p>
            <p className="text-xs text-muted-foreground truncate">
              as {submittedName} · share the link below or screenshot the card to brag.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1">
            <a href={shareUrl} target="_blank" rel="noopener noreferrer">
              Open share card
            </a>
          </Button>
          <Button onClick={copy} variant="outline" className="flex-1">
            {copied ? 'Copied!' : 'Copy share link'}
          </Button>
          <Button asChild variant="ghost">
            <Link to="/leaderboard">View board</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/5 to-card/40 px-5 py-5 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-400" aria-hidden="true" />
        <h2 className="font-display font-semibold text-base">Post your result to the leaderboard</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Add a display name (optional, 32 char max) to rank against other {props.startYear}–{props.endYear} runs.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={name}
          onChange={e => setName(e.target.value.slice(0, 32))}
          placeholder="Display name (optional)"
          aria-label="Leaderboard display name"
          className="flex-1"
          maxLength={32}
        />
        <Button
          onClick={() => submit(true)}
          disabled={busy}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Submit
        </Button>
        <Button
          onClick={() => submit(false)}
          disabled={busy}
          variant="ghost"
          className="text-muted-foreground"
        >
          Skip
        </Button>
      </div>
    </div>
  );
}


function StatCard({ label, value, highlight, color, prefix }: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: 'gain' | 'loss';
  prefix?: string;
}) {
  return (
    <div className={`rounded-lg border p-3 sm:p-4 ${highlight ? 'bg-primary/10 border-primary/30' : 'bg-card border-border'}`}>
      <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-mono text-sm sm:text-xl font-bold truncate ${
        color === 'gain' ? 'text-gain' : color === 'loss' ? 'text-loss' : ''
      }`}>
        {prefix}{value}
      </div>
    </div>
  );
}

function ResultsComparison({ portfolioValue, totalContributions, sp500Value, startYear, endYear, percentile }: {
  portfolioValue: number;
  totalContributions: number;
  sp500Value: number;
  startYear: number;
  endYear: number;
  percentile: { rank: number; total: number; pct: number } | null;
}) {
  const [peers, setPeers] = useState<{ runs: number; medianReturn: number } | null | 'error'>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.rpc('get_window_comparison' as never, { p_start_year: startYear, p_end_year: endYear } as never)
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (cancelled) return;
        const row = Array.isArray(data) ? (data[0] as { runs: number; median_return: number | null }) : null;
        if (error || !row) { setPeers('error'); return; }
        setPeers({ runs: Number(row.runs), medianReturn: Number(row.median_return ?? 0) });
      });
    return () => { cancelled = true; };
  }, [startYear, endYear]);

  const yourReturn = calculateInvestmentReturn(portfolioValue, totalContributions);
  const spReturn = calculateInvestmentReturn(sp500Value, totalContributions);
  const rows: { label: string; sub: string; value: number | null; note?: string }[] = [
    { label: 'You', sub: formatMoney(portfolioValue), value: yourReturn },
    { label: 'S&P 500', sub: `Same deposits, all in the index · ${formatMoney(sp500Value)}`, value: spReturn },
    peers && peers !== 'error' && peers.runs > 0
      ? { label: 'Typical player', sub: `Middle result of ${peers.runs.toLocaleString()} games, ${startYear}–${endYear}`, value: peers.medianReturn }
      : { label: 'Typical player', sub: peers === null ? 'Loading…' : peers === 'error' ? 'Couldn\u2019t load other players right now' : `No other games for ${startYear}–${endYear} yet`, value: null },
  ];
  const max = Math.max(1, ...rows.map(r => Math.abs(r.value ?? 0)));
  const beatSp = yourReturn >= spReturn;

  return (
    <section aria-labelledby="compare-heading" className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 id="compare-heading" className="text-base sm:text-lg font-semibold">How you compare</h2>
      <p className="text-xs text-muted-foreground mb-4">Return on your picks only — the $5,000 deposits and surprise expenses aren't counted as profit.</p>
      <ul className="space-y-3">
        {rows.map(r => {
          const v = r.value;
          const width = v == null ? 0 : Math.max(2, (Math.abs(v) / max) * 100);
          const gain = (v ?? 0) >= 0;
          return (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className={r.label === 'You' ? 'font-semibold text-foreground' : 'text-foreground/85'}>{r.label}</span>
                <span className={`font-mono tabular-nums font-semibold ${v == null ? 'text-muted-foreground' : gain ? 'text-gain' : 'text-loss'}`}>
                  {v == null ? '—' : formatPercent(v)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary mt-1 overflow-hidden" aria-hidden>
                <div className={`h-full rounded-full ${r.label === 'You' ? 'bg-primary' : gain ? 'bg-gain/60' : 'bg-loss/60'}`} style={{ width: `${width}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{r.sub}</p>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 pt-3 border-t border-border/60 text-sm space-y-1">
        <p>{beatSp ? '✓ You beat' : '✗ You trailed'} the S&P 500 by <span className="font-mono">{Math.abs(yourReturn - spReturn).toFixed(1)}</span> percentage points.</p>
        {percentile && percentile.total > 0 && (
          <p className="text-muted-foreground">Your ending value beat {percentile.pct.toFixed(1)}% of all {percentile.total.toLocaleString()} finished games.</p>
        )}
      </div>
    </section>
  );
}

function ComparisonCard({ label, yourValue, theirValue, theirLabel, icon }: {
  label: string;
  yourValue: number;
  theirValue: number;
  theirLabel: string;
  icon: string;
}) {
  const diff = yourValue - theirValue;
  const pct = theirValue > 0 ? (diff / theirValue) * 100 : 0;
  const beating = diff >= 0;

  return (
    <div className={`rounded-lg border p-3 sm:p-4 ${beating ? 'bg-gain/5 border-gain/20' : 'bg-loss/5 border-loss/20'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base sm:text-lg">{icon}</span>
        <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs sm:text-sm">
          <span className="text-muted-foreground">You</span>
          <span className="font-mono font-medium truncate ml-1">{formatMoney(yourValue)}</span>
        </div>
        <div className="flex justify-between text-xs sm:text-sm">
          <span className="text-muted-foreground truncate mr-1">{theirLabel}</span>
          <span className="font-mono font-medium truncate">{formatMoney(theirValue)}</span>
        </div>
        <div className={`text-center font-mono text-xs sm:text-sm font-bold pt-1 border-t border-border/50 ${beating ? 'text-gain' : 'text-loss'}`}>
          {beating ? '✅' : '❌'} {beating ? 'Beating' : 'Behind'} by {formatPercent(Math.abs(pct))}
        </div>
      </div>
    </div>
  );
}

function PeriodsRecap({ engine }: { engine: GameEngine }) {
  const { portfolioHistory, startYear, gameDuration } = engine;
  // portfolioHistory is appended every 10 in-game seconds → 6 entries per year.
  const TICKS_PER_YEAR = 6;

  const yearly = useMemo(() => {
    const out: { year: number; start: number; end: number; change: number; changePct: number }[] = [];
    for (let y = 0; y < gameDuration; y++) {
      const startIdx = Math.min(y * TICKS_PER_YEAR, portfolioHistory.length - 1);
      const endIdx = Math.min((y + 1) * TICKS_PER_YEAR, portfolioHistory.length - 1);
      if (startIdx >= endIdx) continue;
      const s = portfolioHistory[startIdx];
      const e = portfolioHistory[endIdx];
      const change = e - s;
      const changePct = s > 0 ? (change / s) * 100 : 0;
      out.push({ year: startYear + y, start: s, end: e, change, changePct });
    }
    return out;
  }, [portfolioHistory, startYear, gameDuration]);

  if (yearly.length === 0) return null;

  const best = [...yearly].sort((a, b) => b.changePct - a.changePct)[0];
  const worst = [...yearly].sort((a, b) => a.changePct - b.changePct)[0];

  return (
    <div className="rounded-lg bg-card border border-border p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-primary" aria-hidden="true" />
        <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Best & Worst Periods
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PeriodCard kind="best" period={best} />
        <PeriodCard kind="worst" period={worst} />
      </div>
    </div>
  );
}

function PeriodCard({
  kind,
  period,
}: {
  kind: 'best' | 'worst';
  period: { year: number; start: number; end: number; change: number; changePct: number };
}) {
  const isBest = kind === 'best';
  const Icon = isBest ? TrendingUp : TrendingDown;
  const color = isBest ? 'gain' : 'loss';
  const sign = period.change >= 0 ? '+' : '−';
  return (
    <div className={`rounded-lg border p-4 ${isBest ? 'bg-gain/5 border-gain/20' : 'bg-loss/5 border-loss/20'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 text-${color}`} aria-hidden="true" />
        <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {isBest ? 'Best Year' : 'Worst Year'}
        </span>
      </div>
      <div className="font-display font-bold text-lg sm:text-xl">{period.year}</div>
      <div className={`font-mono text-sm text-${color}`}>{formatPercent(period.changePct)}</div>
      <div className="text-xs text-muted-foreground mt-1 font-mono">
        {sign}{formatMoney(Math.abs(period.change))} portfolio change
      </div>
    </div>
  );
}

function KeyLessons({
  engine,
  totalReturn,
  sp500Benchmark,
  bestAsset,
  worstAsset,
}: {
  engine: GameEngine;
  totalReturn: number;
  sp500Benchmark: number;
  bestAsset?: { name: string; totalReturn: number };
  worstAsset?: { name: string; totalReturn: number };
}) {
  const { portfolioValue, totalContributions, cash, holdings, currentAssets, portfolioHistory } = engine;

  const lessons = useMemo(() => {
    const out: { title: string; body: string; tone: 'positive' | 'neutral' | 'caution' }[] = [];

    // 1. vs S&P 500
    if (sp500Benchmark > 0) {
      const delta = ((portfolioValue - sp500Benchmark) / sp500Benchmark) * 100;
      if (delta >= 5) {
        out.push({
          title: `You beat the S&P 500 by ${delta.toFixed(1)}%`,
          body: 'Strong stock picking and timing paid off. Consistently beating the index is rare even for professionals.',
          tone: 'positive',
        });
      } else if (delta <= -10) {
        out.push({
          title: `S&P 500 beat your portfolio by ${Math.abs(delta).toFixed(1)}%`,
          body: 'Index funds capture the whole market and tend to be hard to beat over time. Consider how much was concentrated vs. diversified.',
          tone: 'caution',
        });
      } else {
        out.push({
          title: 'You roughly tracked the S&P 500',
          body: 'Tracking the broad market is a respectable outcome — most investors underperform it.',
          tone: 'neutral',
        });
      }
    }

    // 2. Concentration risk
    let invested = 0;
    let topPosition = 0;
    let topName = '';
    for (const a of currentAssets) {
      const v = (holdings[a.id] || 0) * a.currentPrice;
      invested += v;
      if (v > topPosition) { topPosition = v; topName = a.name; }
    }
    if (invested > 0 && topPosition / invested > 0.5) {
      out.push({
        title: 'Your portfolio was heavily concentrated',
        body: `Over half of your invested capital sat in ${topName}. Diversifying across more assets typically reduces drawdown risk.`,
        tone: 'caution',
      });
    }

    // 3. Cash drag
    const totalAssets = portfolioValue;
    if (totalAssets > 0 && cash / totalAssets > 0.35) {
      out.push({
        title: `You held about ${Math.round((cash / totalAssets) * 100)}% in cash at the end`,
        body: 'Cash is safe but doesn\'t compound. Investing contributions sooner usually grows wealth faster over long periods.',
        tone: 'caution',
      });
    }

    // 4. Drawdown insight
    if (portfolioHistory.length > 4) {
      let peak = portfolioHistory[0];
      let maxDD = 0;
      for (const v of portfolioHistory) {
        if (v > peak) peak = v;
        if (peak > 0) {
          const dd = (peak - v) / peak;
          if (dd > maxDD) maxDD = dd;
        }
      }
      if (maxDD > 0.25) {
        out.push({
          title: `You weathered a ${(maxDD * 100).toFixed(0)}% drawdown`,
          body: 'Big swings test discipline. Selling at the bottom locks losses; staying invested usually recovers value over time.',
          tone: 'neutral',
        });
      }
    }

    // 5. Best/worst asset takeaway
    if (bestAsset && worstAsset && bestAsset.name !== worstAsset.name) {
      out.push({
        title: `${bestAsset.name} led, ${worstAsset.name} lagged`,
        body: `The spread between winners and losers is why diversification matters — picking individual stocks well is hard, but spreading bets reduces single-asset risk.`,
        tone: 'neutral',
      });
    }

    // 6. Overall return framing
    if (totalReturn >= 100) {
      out.push({
        title: `Your money more than doubled (${totalReturn.toFixed(0)}%)`,
        body: 'Strong long-term compounding. Time in the market is one of the most powerful drivers of return.',
        tone: 'positive',
      });
    } else if (totalReturn < 0) {
      out.push({
        title: 'Your portfolio finished below contributions',
        body: 'Down periods happen. In real life, continuing to invest through downturns is often what separates long-term winners.',
        tone: 'caution',
      });
    }

    return out.slice(0, 5);
  }, [portfolioValue, totalContributions, cash, holdings, currentAssets, portfolioHistory, sp500Benchmark, totalReturn, bestAsset, worstAsset]);

  if (lessons.length === 0) return null;

  return (
    <div className="rounded-lg bg-card border border-border p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-4 h-4 text-accent" aria-hidden="true" />
        <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Key Lessons From This Run
        </h3>
      </div>
      <ul className="space-y-3">
        {lessons.map((l, i) => (
          <li
            key={i}
            className={`rounded-lg border p-3 sm:p-4 ${
              l.tone === 'positive'
                ? 'bg-gain/5 border-gain/20'
                : l.tone === 'caution'
                ? 'bg-accent/5 border-accent/20'
                : 'bg-secondary/30 border-border'
            }`}
          >
            <p className="font-display font-semibold text-sm mb-1">{l.title}</p>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{l.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
