import { useEffect, useRef, useState } from 'react';
import { GameScreen } from '@/components/game/GameScreen';
import { EndGameScreen } from '@/components/game/EndGameScreen';
import { MultiplayerReveal } from '@/components/game/MultiplayerReveal';
import { LiveMultiplayerLeaderboard } from '@/components/game/LiveMultiplayerLeaderboard';
import { useGameEngine } from '@/hooks/useGameEngine';
import { usePlayerSession } from '@/hooks/useMultiplayer';
import { GameAssetConfig } from '@/data/historicalData';
import { trackGameEvent } from '@/lib/analytics';
import { calculateInvestmentReturn } from '@/lib/investmentReturn';
import { RoomChat } from './RoomChat';

interface MultiplayerGameProps {
  playerSession: ReturnType<typeof usePlayerSession>;
  onPlayAgain: () => void;
}

export function MultiplayerGame({ playerSession, onPlayAgain }: MultiplayerGameProps) {
  const { session, allPlayers, updatePlayer, restoreSnapshot, consumeRestoreSnapshot } = playerSession;

  // Initialize game engine with the session's asset configs, length and mode.
  // Advanced rooms store no fixed stocks (players search the full list), so a
  // room without any 'stock' entries is an Advanced room.
  const roomAssets = session?.asset_configs as GameAssetConfig[] | undefined;
  const roomMode: 'normal' | 'complex' =
    roomAssets && roomAssets.length > 0 && !roomAssets.some(a => a.type === 'stock') ? 'complex' : 'normal';
  const roomDuration = session ? Math.max(1, session.end_year - session.start_year) : 20;
  const engine = useGameEngine(
    roomAssets,
    session?.start_year,
    roomDuration,
    undefined,
    roomMode,
  );

  // Follow the server's shared clock (start time + host pauses).
  const roomClock = playerSession.roomClock;
  const syncRoomClock = engine.syncRoomClock;
  useEffect(() => {
    if (roomClock) syncRoomClock(roomClock.elapsed + (performance.now() - roomClock.at) / 1000, roomClock.paused);
  }, [roomClock, syncRoomClock]);

  const lastSyncRef = useRef(0);
  const [revealDismissed, setRevealDismissed] = useState(false);
  const analyticsSentRef = useRef(false);
  const [reconnected, setReconnected] = useState(false);

  // Reconnect: adopt the room's authoritative portfolio and shared clock once,
  // before any sync writes the freshly-initialised (empty) local state back.
  const restoreAppliedRef = useRef(false);
  useEffect(() => {
    if (!restoreSnapshot || restoreAppliedRef.current) return;
    restoreAppliedRef.current = true;
    lastSyncRef.current = Math.floor(restoreSnapshot.totalSeconds);
    engine.restoreFromServer(restoreSnapshot);
    consumeRestoreSnapshot();
    setReconnected(true);
    const t = setTimeout(() => setReconnected(false), 6000);
    return () => clearTimeout(t);
  }, [restoreSnapshot, engine, consumeRestoreSnapshot]);

  // Sync player state every 2 seconds, and immediately after any trade, so the host screen stays live.
  const lastHoldingsRef = useRef(engine.holdings);
  useEffect(() => {
    if (!session || session.status !== 'playing') return;

    const tick = Math.floor(engine.totalSeconds);
    const traded = engine.holdings !== lastHoldingsRef.current;
    if (tick > 0 && (traded || tick - lastSyncRef.current >= 2)) {
      lastSyncRef.current = tick;
      lastHoldingsRef.current = engine.holdings;
      updatePlayer({
        cash: engine.cash,
        holdings: engine.holdings,
        total_contributions: engine.totalContributions,
        portfolio_value: engine.portfolioValue,
        portfolio_history: engine.portfolioHistory,
      }, engine.costBasis);
    }
  }, [engine.totalSeconds, engine.cash, engine.holdings, engine.totalContributions, engine.portfolioValue, engine.portfolioHistory, session, updatePlayer]);

  // Final sync when game ends + log a multiplayer analytics event (once).
  useEffect(() => {
    if (engine.phase !== 'ended') return;
    updatePlayer({
      cash: engine.cash,
      holdings: engine.holdings,
      total_contributions: engine.totalContributions,
      portfolio_value: engine.portfolioValue,
      portfolio_history: engine.portfolioHistory,
    });
    if (!analyticsSentRef.current) {
      analyticsSentRef.current = true;
      const endVal = engine.portfolioHistory[engine.portfolioHistory.length - 1] ?? engine.portfolioValue;
      const returnPct = calculateInvestmentReturn(endVal, engine.totalContributions);
      void trackGameEvent({
        game_mode: engine.gameMode,
        simulation_length: engine.gameDuration,
        is_multiplayer: true,
        player_count: allPlayers?.length ?? 1,
        start_year: engine.startYear,
        end_year: engine.endYear,
        starting_value: engine.totalContributions,
        ending_value: endVal,
        return_pct: Number(returnPct.toFixed(2)),
        assets: engine.assetConfigs.map(a => a.id),
        time_spent_seconds: engine.totalSeconds,
        completed: true,
      }, 'analytics');
    }
  }, [engine.phase]);

  // After this player's game ends, show the dramatic multiplayer reveal
  // (podium + superlatives) using all session players, then fall through to
  // the personal EndGameScreen.
  if (engine.phase === 'ended') {
    const hasMultiplayerData = allPlayers && allPlayers.length >= 2;
    if (hasMultiplayerData && !revealDismissed) {
      return <MultiplayerReveal players={allPlayers} onClose={() => setRevealDismissed(true)} />;
    }
    return <EndGameScreen engine={engine} onPlayAgain={onPlayAgain} />;
  }

  return (
    <>
      <GameScreen engine={engine} />
      {reconnected && (
        <div
          role="status"
          className="fixed top-3 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl border border-primary/40 bg-card/95 px-4 py-3 text-sm text-foreground shadow-lg backdrop-blur"
        >
          <p className="font-semibold text-primary">You're back in the game</p>
          <p className="text-muted-foreground">
            Your cash and investments were restored, and you've rejoined at year {engine.currentYear} with everyone else.
          </p>
        </div>
      )}
      <LiveMultiplayerLeaderboard players={allPlayers ?? []} currentPlayerId={playerSession.player?.id ?? null} />
      {session && playerSession.player && <RoomChat sessionId={session.id} actorId={playerSession.player.id} getToken={playerSession.getChatCredentials} roomEnded={session.status === 'ended'} chatOff={!playerSession.roomSettings.chat_enabled} />}
    </>
  );
}
