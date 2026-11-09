import { useReducer, useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { initializeGame, gameRandom, GameAssetConfig, HISTORICAL_EVENTS, getCDRates } from '@/data/historicalData';
import { ComplexCompany, validateComplexReturns } from '@/data/complexReturns';
import { toast } from 'sonner';
import { saveStockSlot, clearSoloGame, getActiveStockSlotId, type SoloGameConfig } from '@/lib/gamePersistence';
import { buildAliasMap } from '@/lib/hardModeAlias';
import { trackGameEvent } from '@/lib/analytics';
import { calculateInvestmentReturn } from '@/lib/investmentReturn';


import { gameReducer, generateLifeEvents, getAutoInvestIds, sampleAssetPriceAtIndex, calcCDValue, type GameState, type ServerRestoreSnapshot, type ActiveCD } from '@/lib/stockEngine';
export { gameReducer, buildComplexAssetConfig, PRICE_TICK_SECONDS, PRICE_TICKS_PER_YEAR, getAutoInvestIds } from '@/lib/stockEngine';
export type { GameState, ServerRestoreSnapshot, ActiveCD, LifeEvent } from '@/lib/stockEngine';
import { buildComplexAssetConfig, PRICE_TICK_SECONDS } from '@/lib/stockEngine';

export function useGameEngine(
  presetAssets?: GameAssetConfig[],
  presetStartYear?: number,
  duration: number = 20,
  selectedStockIds?: string[],
  gameMode: 'normal' | 'complex' | 'hard' = 'normal',
  /**
   * Optional fully-hydrated GameState to resume from (e.g. restored from
   * localStorage after a tab close). Bypasses initializeGame entirely.
   */
  resumedState?: GameState,
  /** Durable save slot this run writes to. Omitted for multiplayer. */
  saveSlotId?: string,
) {
  // Solo persistence is only meaningful when this hook owns initialization
  // (i.e. no preset multiplayer session). Multiplayer state lives server-side.
  const isSoloOwned = !(presetAssets && presetStartYear);

  // Run a one-time integrity check on the complex-mode dataset before any
  // session relies on it. Logs to console; does not throw, since shipping with
  // known minor gaps shouldn't crash the game.
  useEffect(() => {
    if (gameMode !== 'complex') return;
    const issues = validateComplexReturns();
    if (issues.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('[complex-mode] returns dataset has integrity issues:', issues);
    }
  }, [gameMode]);

  const [state, dispatch] = useReducer(gameReducer, null, () => {
    if (resumedState) return resumedState;

    const initAssets = presetAssets && presetStartYear ? presetAssets : undefined;
    // CRITICAL: forward the user's chosen start year into initializeGame so the
    // generated asset price tracks match the year/news the UI will display.
    // Previously this passed `undefined`, which made initializeGame pick a
    // *random* startYear for prices while the UI still showed the user's
    // chosen year + matching news — so e.g. selecting 1996 could play 2002's
    // returns under a "Simulating 1996" header. Year-to-data alignment broke
    // for every solo run with a custom start year.
    const init = initAssets ? undefined : initializeGame(presetStartYear, duration, selectedStockIds, gameMode);
    const assets = initAssets ?? init?.assets ?? [];
    const sYear = presetStartYear ?? init?.startYear ?? 1990;
    const dur = init?.duration ?? duration;
    const eYear = sYear + dur;
    const totalGameSeconds = dur * 60;

    const initialUnlocked = new Set<string>();
    for (const a of assets) {
      if ((a.type !== 'stock' && a.type !== 'crypto') || !a.unlockYear || a.unlockYear <= 1) {
        initialUnlocked.add(a.id);
      }
    }

    return {
      phase: 'playing' as const,
      startYear: sYear,
      endYear: eYear,
      gameDuration: dur,
      totalGameSeconds,
      totalSeconds: 0,
      cash: 5000,
      holdings: {} as Record<string, number>,
      costBasis: {} as Record<string, number>,
      totalBought: {} as Record<string, number>,
      realizedPnl: {} as Record<string, number>,
      totalContributions: 5000,
      twrIndex: 1,
      twrBase: 5000,
      portfolioHistory: [5000],
      assetConfigs: assets,
      activeCDs: [] as ActiveCD[],
      nextCDId: 1,
      lifeEvents: generateLifeEvents(),
      unlockedAssetIds: initialUnlocked,
      pendingUnlock: null,
      paused: false,
      gameMode,
      complexFirstYears: {} as Record<string, number>,
      hardSeed: gameMode === 'hard' ? `hard-${sYear}-${Math.random().toString(36).slice(2, 10)}` : undefined,
      tradeLog: gameMode === 'hard' ? [] : undefined,
    };
  });



  // Auto-save solo game state to localStorage so the player can close the tab
  // and resume within IDLE_TIMEOUT_MS. Multiplayer games are skipped — they
  // sync via Supabase instead.
  const analyticsSentRef = useRef(false);
  /** Surface of the autosave for the HUD: idle | saving | saved | failed | conflict. */
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed' | 'conflict'>('idle');
  const lastSaveAtRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const saveConfig: SoloGameConfig = useMemo(() => ({
    duration: state.gameDuration,
    startYear: state.startYear,
    selectedStockIds,
    gameMode: state.gameMode,
  }), [state.gameDuration, state.startYear, state.gameMode, selectedStockIds]);
  const saveConfigRef = useRef(saveConfig);
  saveConfigRef.current = saveConfig;

  /** Write the current snapshot now. Used by autosave, Save & exit and unload. */
  const saveNow = useCallback((force = false) => {
    const slotId = saveSlotId ?? getActiveStockSlotId();
    if (!isSoloOwned || !slotId) return 'failed' as const;
    const snapshot = stateRef.current;
    if (snapshot.phase !== 'playing') return 'failed' as const;
    setSaveStatus('saving');
    const result = saveStockSlot(slotId, snapshot, saveConfigRef.current, undefined, force);
    lastSaveAtRef.current = Date.now();
    setSaveStatus(result.status === 'saved' ? 'saved' : result.status === 'conflict' ? 'conflict' : 'failed');
    return result.status;
  }, [isSoloOwned, saveSlotId]);

  useEffect(() => {
    if (!isSoloOwned) return;
    if (state.phase === 'ended') {
      clearSoloGame();
      // Fire-and-forget analytics event when a solo game finishes.
      if (!analyticsSentRef.current) {
        analyticsSentRef.current = true;
        const endVal = (state.portfolioHistory[state.portfolioHistory.length - 1] ?? 0);
        const returnPct = calculateInvestmentReturn(endVal, state.totalContributions);
        void trackGameEvent({
          game_mode: state.gameMode,
          simulation_length: state.gameDuration,
          is_multiplayer: false,
          start_year: state.startYear,
          end_year: state.endYear,
          starting_value: state.totalContributions,
          ending_value: endVal,
          return_pct: Number(returnPct.toFixed(2)),
          assets: state.assetConfigs.map(a => a.id),
          time_spent_seconds: state.totalSeconds,
          completed: true,
        }, 'analytics');
      }
      return;
    }
    // Throttle periodic autosaves; transactions and events are covered by the
    // dedicated effect below, which saves immediately.
    const since = Date.now() - lastSaveAtRef.current;
    if (since >= 5000) {
      saveNow();
      return;
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => saveNow(), 5000 - since);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [state, isSoloOwned, saveNow]);

  // Immediate autosave the moment money or positions change (completed
  // transactions, contributions, life events, CD maturities, unlocks).
  const txSignature = `${state.cash}|${JSON.stringify(state.holdings)}|${state.activeCDs.length}|${state.totalContributions}|${state.unlockedAssetIds.size}`;
  useEffect(() => {
    if (!isSoloOwned) return;
    if (stateRef.current.phase !== 'playing') return;
    saveNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txSignature, isSoloOwned]);

  // Last-gasp save when the tab is closed or hidden.
  useEffect(() => {
    if (!isSoloOwned) return;
    const flush = () => { if (stateRef.current.phase === 'playing') saveNow(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [isSoloOwned, saveNow]);

  const lastContributionRef = useRef(0);
  const lastMaturedRef = useRef<Set<string>>(new Set());
  const tutorialActiveRef = useRef(false);

  const setTutorialActive = useCallback((active: boolean) => {
    tutorialActiveRef.current = active;
  }, []);

  // Solo players can speed the clock up. Multiplayer rooms always run at 1x so
  // the shared clock stays identical for everyone.
  const [speed, setSpeedState] = useState<1 | 2 | 4>(1);
  const setSpeed = useCallback((next: 1 | 2 | 4) => {
    if (!isSoloOwned) return;
    setSpeedState(next);
  }, [isSoloOwned]);
  const effectiveSpeed = isSoloOwned ? speed : 1;

  // Multiplayer: follow the server's room clock. Each poll gives the room's
  // elapsed seconds; between polls it advances locally. A player who falls
  // behind (slow device, hidden tab, tutorial) catches up tick by tick so
  // deposits and unlocks still fire once; a player ahead waits.
  const roomClockRef = useRef<{ elapsed: number; at: number; paused: boolean } | null>(null);
  const totalSecondsRef = useRef(state.totalSeconds);
  totalSecondsRef.current = state.totalSeconds;
  const syncRoomClock = useCallback((elapsed: number, paused: boolean) => {
    if (isSoloOwned) return;
    roomClockRef.current = { elapsed, at: performance.now(), paused };
    dispatch({ type: 'ROOM_CLOCK', paused });
  }, [isSoloOwned]);

  useEffect(() => {
    if (isSoloOwned || state.phase !== 'playing') return;
    const interval = setInterval(() => {
      const rc = roomClockRef.current;
      if (!rc) {
        if (!tutorialActiveRef.current) dispatch({ type: 'TICK' });
        return;
      }
      if (rc.paused) return;
      const target = rc.elapsed + (performance.now() - rc.at) / 1000;
      const behind = Math.min(30, Math.floor(target - totalSecondsRef.current));
      for (let i = 0; i < behind; i++) dispatch({ type: 'TICK' });
      if (behind > 0) totalSecondsRef.current += behind;
    }, 250);
    return () => clearInterval(interval);
  }, [isSoloOwned, state.phase]);

  useEffect(() => {
    if (!isSoloOwned) return;
    if (state.phase !== 'playing' || state.paused) return;
    // One dispatch per simulated second at every speed, so contributions,
    // maturities and unlocks each fire exactly once — the interval shortens
    // rather than the step growing.
    const interval = setInterval(() => {
      if (!tutorialActiveRef.current) {
        dispatch({ type: 'TICK' });
      }
    }, 1000 / effectiveSpeed);
    return () => clearInterval(interval);
  }, [state.phase, state.paused, effectiveSpeed]);

  useEffect(() => {
    if (state.totalSeconds > 0 && state.totalSeconds % 15 === 0 && state.phase === 'playing') {
      if (state.totalSeconds !== lastContributionRef.current) {
        lastContributionRef.current = state.totalSeconds;
        toast.success('+$5,000 contribution received!', {
          duration: 4500,
          dismissible: true,
          closeButton: true,
          // Warm amber styling — contributions feel like a reward, not just another green toast.
          style: {
            background: 'linear-gradient(135deg, hsl(38 92% 50% / 0.18), hsl(38 92% 50% / 0.08))',
            border: '1px solid hsl(38 92% 50% / 0.45)',
            color: 'hsl(45 95% 75%)',
            fontSize: '0.95rem',
            padding: '14px 16px',
            boxShadow: '0 8px 30px -10px hsl(38 92% 50% / 0.4)',
          },
        });
      }
    }
  }, [state.totalSeconds, state.phase]);

  const lastLifeEventRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    for (const event of state.lifeEvents) {
      if (event.triggered && !lastLifeEventRef.current.has(event.second)) {
        lastLifeEventRef.current.add(event.second);
        const cost = Math.min(event.cost, state.cash + event.cost);
        toast.error(`💸 ${event.message} -$${cost.toLocaleString()}`, { duration: 5000 });
      }
    }
  }, [state.lifeEvents]);

  useEffect(() => {
    for (const cd of state.activeCDs) {
      if (cd.matured && !lastMaturedRef.current.has(cd.id)) {
        lastMaturedRef.current.add(cd.id);
        const termLabel = cd.type === '1y' ? '1-Year' : cd.type === '2y' ? '2-Year' : '5-Year';
        toast.success(`${termLabel} CD matured! Funds returned.`, { duration: 3000 });
      }
    }
  }, [state.activeCDs]);

  const setAutoInvest = useCallback((assetIds: string[]) => {
    dispatch({ type: 'SET_AUTO_INVEST', assetIds });
  }, []);

  const buy = useCallback((assetId: string, shares: number) => {
    dispatch({ type: 'BUY', assetId, shares });
  }, []);

  const sell = useCallback((assetId: string, shares: number) => {
    dispatch({ type: 'SELL', assetId, shares });
  }, []);

  const buyCD = useCallback((cdType: '1y' | '2y' | '5y', amount: number, rate: number) => {
    dispatch({ type: 'BUY_CD', cdType, amount, rate });
  }, []);

  const withdrawCD = useCallback((cdId: string, early: boolean) => {
    dispatch({ type: 'WITHDRAW_CD', cdId, early });
  }, []);

  const acknowledgeUnlock = useCallback(() => {
    dispatch({ type: 'ACKNOWLEDGE_UNLOCK' });
  }, []);

  const togglePause = useCallback(() => {
    // Multiplayer players never pause locally; only the host pauses the room.
    if (!isSoloOwned) return;
    dispatch({ type: 'TOGGLE_PAUSE' });
  }, [isSoloOwned]);

  const setPauseEachYear = useCallback((on: boolean) => {
    if (!isSoloOwned) return;
    dispatch({ type: 'SET_PAUSE_EACH_YEAR', on });
  }, [isSoloOwned]);

  /** Reconnect path: adopt the server's authoritative player state + clock. */
  const restoreFromServer = useCallback((snapshot: ServerRestoreSnapshot) => {
    dispatch({ type: 'RESTORE_SERVER_STATE', snapshot });
  }, []);

  const registerComplexAsset = useCallback((asset: GameAssetConfig, firstAvailableYear: number) => {
    dispatch({ type: 'REGISTER_COMPLEX_ASSET', asset, firstAvailableYear });
  }, []);

  // Use totalSeconds-based price sampling (matches getAssetPrice for the 6s tick cadence).
  const pointsPerYear = 24;
  const quantizedSeconds = Math.floor(state.totalSeconds / PRICE_TICK_SECONDS) * PRICE_TICK_SECONDS;
  const priceIndexNow = Math.floor((quantizedSeconds * pointsPerYear) / 60);
  const priceIndexPrev = Math.max(0, Math.floor(((quantizedSeconds - PRICE_TICK_SECONDS) * pointsPerYear) / 60));

  // Hard mode: build alias map ONCE per render from the seed. Names/tickers
  // get masked but original metadata is preserved on each asset for the reveal.
  const aliasMap = useMemo(() => {
    if (state.gameMode !== 'hard' || !state.hardSeed) return null;
    const realStocks = state.assetConfigs.filter(a => a.type === 'stock');
    if (realStocks.length === 0) return null;
    const realMeta: Record<string, { name: string; ticker: string }> = {};
    for (const a of realStocks) realMeta[a.id] = { name: a.name, ticker: a.ticker };
    return buildAliasMap(state.hardSeed, realStocks.map(s => s.id), realMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.gameMode, state.hardSeed, state.assetConfigs.length]);

  // One-time data-availability warning for Hard mode bankruptcies.
  const bankruptcyWarnedRef = useRef(false);
  useEffect(() => {
    if (state.gameMode !== 'hard' || bankruptcyWarnedRef.current) return;
    bankruptcyWarnedRef.current = true;
    const anyDelisted = state.assetConfigs.some(a => (a as unknown as { isDelisted?: boolean }).isDelisted);
    if (!anyDelisted) {
      // eslint-disable-next-line no-console
      console.warn(
        '[hard-mode] dataset has no delisted/bankrupt companies (isDelisted / bankruptcyYear). Bankruptcy mechanics are wired but inactive until such data is added.',
      );
    }
  }, [state.gameMode, state.assetConfigs]);

  const currentAssets = state.assetConfigs.map(a => {
    const currentPrice = sampleAssetPriceAtIndex(a, priceIndexNow);
    const previousPrice = sampleAssetPriceAtIndex(a, priceIndexPrev);
    // Companies that list during the game have 0 before their first trade;
    // measure their return from the first real price instead.
    const startPrice = a.prices.find(p => p > 0) ?? 0;
    const base = {
      ...a,
      currentPrice,
      previousPrice,
      startPrice,
      change: currentPrice - previousPrice,
      changePercent: previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0,
      totalReturn: startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0,
      realName: a.name,
      realTicker: a.ticker,
    };
    if (aliasMap && a.type === 'stock' && aliasMap[a.id]) {
      const alias = aliasMap[a.id];
      return { ...base, name: alias.codename, ticker: alias.alias };
    }
    return base;
  });

  const cdValue = state.activeCDs.reduce((sum, cd) =>
    cd.matured ? sum : sum + calcCDValue(cd, state.totalSeconds), 0);

  const portfolioValue = state.cash + cdValue + currentAssets.reduce((sum, a) => {
    return sum + (state.holdings[a.id] || 0) * a.currentPrice;
  }, 0);

  const currentYear = Math.min(Math.floor(state.totalSeconds / 60) + 1, state.gameDuration);
  const secondsInYear = 60 - (state.totalSeconds % 60);
  const simulatedYear = state.startYear + currentYear - 1;
  const events = HISTORICAL_EVENTS[simulatedYear] || [];
  const cdRates = getCDRates(simulatedYear);

  const visibleAssets = currentAssets.filter(a =>
    (a.type !== 'stock' && a.type !== 'crypto') || state.unlockedAssetIds.has(a.id)
  );

  return {
    ...state,
    currentYear,
    secondsInYear,
    simulatedYear,
    currentAssets: visibleAssets,
    allAssets: currentAssets,
    aliasMap,
    portfolioValue,
    cdValue,
    cdRates,
    events,
    buy,
    sell,
    setAutoInvest,
    autoInvestIds: getAutoInvestIds(state),
    setPauseEachYear,
    syncRoomClock,
    buyCD,
    withdrawCD,
    acknowledgeUnlock,
    togglePause,
    speed: effectiveSpeed,
    setSpeed,
    canChangeSpeed: isSoloOwned,
    /** False in multiplayer rooms, where the shared clock must never be paused by local UI. */
    isSoloRun: isSoloOwned,
    /** Real seconds left in the session at the current speed. */
    remainingRealSeconds: Math.max(0, state.totalGameSeconds - state.totalSeconds) / effectiveSpeed,
    registerComplexAsset,
    restoreFromServer,
    setTutorialActive,
    saveStatus,
    saveNow,
    totalReturn: calculateInvestmentReturn(portfolioValue, state.totalContributions),
  };
}


export type GameEngine = ReturnType<typeof useGameEngine>;
