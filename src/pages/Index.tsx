import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { WelcomeScreen } from '@/components/game/WelcomeScreen';
import { useHostSession, usePlayerSession } from '@/hooks/useMultiplayer';

// Defer heavy gameplay screens — none are needed until the user leaves Welcome.
// The game engine (and its return data) loads only when a solo game starts.
const SoloGameWrapper = lazy(() => import('@/components/game/SoloGame'));
const GroupLobby = lazy(() => import('@/components/game/GroupLobby').then(m => ({ default: m.GroupLobby })));
const HostDashboard = lazy(() => import('@/components/game/HostDashboard').then(m => ({ default: m.HostDashboard })));
const MultiplayerGame = lazy(() => import('@/components/game/MultiplayerGame').then(m => ({ default: m.MultiplayerGame })));
const LoadingScreen = lazy(() => import('@/components/game/LoadingScreen').then(m => ({ default: m.LoadingScreen })));
import type { SoloConfig } from '@/components/game/SoloSetupDialog';
import { getActiveChallenge } from '@/lib/challenge';
import {
  loadSoloGame,
  loadStockSlot,
  clearSoloGame,
  releaseActiveStockSlot,
  setActiveStockSlotId,
  loadMultiplayerRejoin,
  clearMultiplayerRejoin,
  type LoadedSoloGame,
  type MultiplayerRejoinPayload,
} from '@/lib/gamePersistence';
import {
  adoptSlot, deleteSlot, listSlots, migrateLegacySaves, mostRecentSlot,
  newSlotId, type SaveMeta,
} from '@/lib/saveSlots';
import { nextOpeningFact } from '@/lib/openingFacts';
import type { OpeningFact } from '@/data/openingFacts';
import { OpeningFactCard } from '@/components/game/OpeningFactCard';
import { SaveSlotsDialog } from '@/components/game/SaveSlotsDialog';
import { useNavigate } from 'react-router-dom';
import type { GameState } from '@/hooks/useGameEngine';

type Screen = 'welcome' | 'loading' | 'fact' | 'solo' | 'group-lobby' | 'host-dashboard' | 'multiplayer-game';

function describeSoloSave(saved: LoadedSoloGame): string {
  const s = saved.state;
  const year = Math.min(Math.floor(s.totalSeconds / 60) + 1, s.gameDuration);
  const modeLabel = saved.config.gameMode === 'complex' ? 'Complex' : saved.config.gameMode === 'hard' ? 'Hard' : 'Normal';
  return `Year ${year} of ${s.gameDuration} · ${modeLabel}`;

}

export default function Index({ initialScreen, initialLobbyMode }: {
  /** Set by the /play and /join routes so multiplayer is reachable from any URL. */
  initialScreen?: Screen;
  initialLobbyMode?: 'choose' | 'create' | 'join';
} = {}) {
  const [screen, setScreen] = useState<Screen>(initialScreen ?? 'welcome');
  // Host code carried in the URL (?code=ABC123), so a shared link always lands
  // on the join form with the code already filled in.
  const joinCodeFromUrl = (() => {
    if (typeof window === 'undefined') return undefined;
    const raw = new URLSearchParams(window.location.search).get('code');
    const clean = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    return clean || undefined;
  })();
  const [gameKey, setGameKey] = useState(0);
  const [gameDuration, setGameDuration] = useState(20);
  const [gameStartYear, setGameStartYear] = useState<number | undefined>();
  const [selectedStockIds, setSelectedStockIds] = useState<string[] | undefined>();
  const [gameMode, setGameMode] = useState<'normal' | 'complex' | 'hard'>('normal');
  /** Hydrated solo state when resuming from a recent save. */
  const [resumedState, setResumedState] = useState<GameState | undefined>();

  /** Slot the running solo game writes into. */
  const [saveSlotId, setSaveSlotId] = useState<string | undefined>();
  /** Most recent save of any kind (drives the Continue card). */
  const [continueMeta, setContinueMeta] = useState<SaveMeta | null>(null);
  const [totalSaves, setTotalSaves] = useState(0);
  const [showSaves, setShowSaves] = useState(false);
  const navigate = useNavigate();
  const [openingFact, setOpeningFact] = useState<OpeningFact | null>(null);
  /** Recent multiplayer rejoin credentials (surfaced as a Rejoin banner). */
  const [savedMultiplayer, setSavedMultiplayer] = useState<MultiplayerRejoinPayload | null>(null);

  const hostSession = useHostSession();
  const playerSession = usePlayerSession();

  // Detect any recent saves on mount. Resume is now opt-in via the banner —
  // we no longer auto-restore, because that prevents the user from starting
  // a fresh game when they want to.
  const refreshSaves = useCallback(() => {
    setContinueMeta(mostRecentSlot());
    setTotalSaves(listSlots().length);
  }, []);

  useEffect(() => {
    // Bring any pre-slot save into the new system, then list what we have.
    migrateLegacySaves();
    refreshSaves();
    setSavedMultiplayer(loadMultiplayerRejoin());
    const onStorage = () => refreshSaves();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshSaves]);

  /** Resume a save of either kind. Property saves live on their own route. */
  const resumeSlot = useCallback((meta: SaveMeta) => {
    setShowSaves(false);
    if (meta.kind === 'realestate') {
      navigate(`/real-estate-game?slot=${meta.id}`);
      return;
    }
    const loaded: LoadedSoloGame | null = loadStockSlot(meta.id);
    if (!loaded) {
      // Corrupted beyond recovery — drop it rather than crash.
      deleteSlot(meta.id);
      refreshSaves();
      return;
    }
    setActiveStockSlotId(loaded.slotId);
    adoptSlot(loaded.slotId);
    setSaveSlotId(loaded.slotId);
    setGameDuration(loaded.config.duration);
    setGameStartYear(loaded.config.startYear);
    setSelectedStockIds(loaded.config.selectedStockIds);
    setGameMode(loaded.config.gameMode);
    setResumedState(loaded.state);
    setGameKey(k => k + 1);
    setScreen('solo');
  }, [navigate, refreshSaves]);

  const handleContinue = useCallback(() => {
    if (continueMeta) resumeSlot(continueMeta);
  }, [continueMeta, resumeSlot]);

  const handleRejoinMultiplayer = useCallback(async () => {
    const ok = await playerSession.rejoinSession();
    if (ok) {
      setGameKey(k => k + 1);
      setScreen('multiplayer-game');
    } else {
      setSavedMultiplayer(null);
    }
  }, [playerSession]);

  const handleDiscardMultiplayer = useCallback(() => {
    clearMultiplayerRejoin();
    setSavedMultiplayer(null);
  }, []);

  const startSolo = useCallback((config: SoloConfig) => {
    // A new game always gets its own slot — existing saves are untouched.
    const id = newSlotId();
    setActiveStockSlotId(id);
    adoptSlot(id);
    setSaveSlotId(id);
    setResumedState(undefined);
    setGameDuration(config.duration);
    setGameStartYear(config.startYear);
    setSelectedStockIds(config.selectedStockIds.length > 0 ? config.selectedStockIds : undefined);
    setGameMode(config.gameMode);
    setOpeningFact(nextOpeningFact(config.gameMode === 'hard'));
    setGameKey(k => k + 1);
    setScreen('loading');
  }, []);

  // Accepted challenge (/c/:code → /?challenge=CODE): start its frozen setup once.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('challenge');
    if (!code) return;
    const c = getActiveChallenge();
    window.history.replaceState(null, '', window.location.pathname);
    if (!c || c.code !== code.toUpperCase()) return;
    startSolo({
      duration: c.end_year - c.start_year,
      startYear: c.start_year,
      selectedStockIds: Array.isArray(c.assets) ? c.assets : [],
      gameMode: c.game_mode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlayAgain = useCallback(() => {
    clearSoloGame();
    const id = newSlotId();
    setActiveStockSlotId(id);
    adoptSlot(id);
    setSaveSlotId(id);
    setResumedState(undefined);
    setOpeningFact(nextOpeningFact(gameMode === 'hard'));
    setGameKey(k => k + 1);
    setScreen('loading');
  }, [gameMode]);

  /** Save & exit — keeps the snapshot and returns to the homepage. */
  const handleSaveAndExit = useCallback(() => {
    releaseActiveStockSlot();
    setResumedState(undefined);
    setSaveSlotId(undefined);
    setScreen('welcome');
    refreshSaves();
  }, [refreshSaves]);

  /** Show the opening fact before the game clock mounts. */
  function showFactAndPlay() {
    setScreen(openingFact ? 'fact' : 'solo');
  }

  const goHome = useCallback(() => {
    // Quitting abandons the run: its save is removed on purpose.
    clearSoloGame();
    setResumedState(undefined);
    setSaveSlotId(undefined);
    setSavedMultiplayer(null);
    refreshSaves();
    setScreen('welcome');
    hostSession.resetSession();
    playerSession.resetSession();
  }, [hostSession, playerSession, refreshSaves]);

  if (screen === 'welcome') {
    return (
      <>
        <WelcomeScreen
          onPlaySolo={startSolo}
          onPlayGroup={() => setScreen('group-lobby')}
          continueSave={
            continueMeta
              ? {
                  meta: continueMeta,
                  onResume: handleContinue,
                  onViewAll: () => setShowSaves(true),
                  totalSaves,
                }
              : null
          }
          multiplayerResume={
            savedMultiplayer
              ? {
                  label: `Code ${savedMultiplayer.gameCode} · ${savedMultiplayer.playerName}`,
                  onResume: handleRejoinMultiplayer,
                  onDiscard: handleDiscardMultiplayer,
                }
              : null
          }
          multiplayerNotice={playerSession.rejoinNotice}
          onDismissMultiplayerNotice={playerSession.clearRejoinNotice}
        />
        <SaveSlotsDialog
          open={showSaves}
          onOpenChange={o => { setShowSaves(o); if (!o) refreshSaves(); }}
          onResume={resumeSlot}
        />
      </>
    );
  }

  if (screen === 'loading') {
    return (
      <Suspense fallback={null}>
        <LoadingScreen onComplete={showFactAndPlay} />
      </Suspense>
    );
  }

  if (screen === 'fact' && openingFact) {
    return <OpeningFactCard fact={openingFact} startYear={gameStartYear} hideYear={gameMode === 'hard'} onContinue={() => { setOpeningFact(null); setScreen('solo'); }} />;
  }


  if (screen === 'group-lobby') {
    return (
      <Suspense fallback={null}>
        <GroupLobby
            hostSession={hostSession}
            playerSession={playerSession}
            initialMode={joinCodeFromUrl ? 'join' : (initialLobbyMode ?? 'choose')}
            initialCode={joinCodeFromUrl}
          onBack={goHome}
            onHostGameStart={() => {
              setScreen('host-dashboard');
            }}
            onPlayerGameStart={() => {
            setGameKey(k => k + 1);
            setScreen('multiplayer-game');
          }}
        />
      </Suspense>
    );
  }

  if (screen === 'host-dashboard' && hostSession.session) {
    return (
      <Suspense fallback={null}>
        <HostDashboard hostSession={hostSession} onEnd={goHome} />
      </Suspense>
    );
  }

  if (screen === 'multiplayer-game' && playerSession.session) {
    return (
      <Suspense fallback={null}>
        <MultiplayerGame
          key={gameKey}
          playerSession={playerSession}
          onPlayAgain={goHome}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <SoloGameWrapper key={gameKey} onPlayAgain={handlePlayAgain} onQuit={goHome} onSaveAndExit={handleSaveAndExit} saveSlotId={saveSlotId} duration={gameDuration} startYear={gameStartYear} selectedStockIds={selectedStockIds} gameMode={gameMode} resumedState={resumedState} />
    </Suspense>
  );
}
