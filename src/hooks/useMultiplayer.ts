import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { GameAssetConfig } from '@/data/historicalData';
import type { ServerRestoreSnapshot } from '@/hooks/useGameEngine';
import {
  saveMultiplayerRejoin,
  clearMultiplayerRejoin,
  loadMultiplayerRejoin,
  touchMultiplayerRejoin,
  updateMultiplayerRejoin,
} from '@/lib/gamePersistence';
import { setActiveRoom } from '@/lib/roomContext';

/** Host-controlled Classroom settings, stored on the server room record. */
export interface RoomSettings { classroom: boolean; chat_enabled: boolean }

async function fetchRoomSettings(sessionId: string, actorId: string | null, token: string): Promise<RoomSettings | null> {
  const { data, error } = await (supabase.rpc('get_room_settings' as never, { p_session_id: sessionId, p_actor_id: actorId, p_token: token } as never) as unknown as Promise<{ data: any; error: unknown }>);
  if (error || !data) return null;
  return { classroom: !!data.classroom, chat_enabled: data.chat_enabled !== false };
}

/** Whitespace/case normalization shared by room creation and lookup. */
export function normalizeGameCode(code: string): string {
  return String(code ?? '').replace(/\s+/g, '').toUpperCase();
}

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export interface GameSession {
  id: string;
  game_code: string;
  host_name: string;
  status: 'lobby' | 'playing' | 'ended';
  start_year: number;
  end_year: number;
  asset_configs: GameAssetConfig[];
  game_started_at: string | null;
}

/** Server-authoritative room clock: elapsed play seconds when `at` (performance.now()) was read. */
export interface RoomClock {
  elapsed: number;
  at: number;
  paused: boolean;
}

async function fetchRoomClock(sessionId: string, token: string): Promise<(RoomClock & { status: GameSession['status']; game_started_at: string | null }) | null> {
  const sent = performance.now();
  const { data, error } = await (supabase.rpc('get_room_clock' as never, { p_session_id: sessionId, p_token: token } as never) as unknown as Promise<{ data: any; error: unknown }>);
  if (error || !data) return null;
  // Assume the server read its clock halfway through the round trip.
  const at = (sent + performance.now()) / 2;
  return { elapsed: Number(data.elapsed_seconds) || 0, at, paused: !!data.paused, status: data.status, game_started_at: data.game_started_at };
}

export interface GamePlayer {
  id: string;
  session_id: string;
  player_name: string;
  cash: number;
  holdings: Record<string, number>;
  total_contributions: number;
  portfolio_value: number;
  portfolio_history: number[];
  is_connected: boolean;
}

export function useHostSession() {
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hostTokenRef = useRef<string | null>(null);
  const getChatCredentials = useCallback(() => hostTokenRef.current, []);
  const [clock, setClock] = useState<RoomClock | null>(null);
  const [roomSettings, setRoomSettingsState] = useState<RoomSettings>({ classroom: false, chat_enabled: true });

  /** Host-only: change Classroom (lobby only) or chat on/off. The server checks the host token. */
  const updateRoomSettings = useCallback(async (sessionId: string, changes: { classroom?: boolean; chat_enabled?: boolean }) => {
    if (!hostTokenRef.current) return false;
    const { data, error: rpcError } = await (supabase.rpc('set_room_settings' as never, {
      p_session_id: sessionId, p_token: hostTokenRef.current,
      p_classroom: changes.classroom ?? null, p_chat_enabled: changes.chat_enabled ?? null,
    } as never) as unknown as Promise<{ data: any; error: unknown }>);
    if (rpcError || !data) return false;
    setRoomSettingsState({ classroom: !!data.classroom, chat_enabled: data.chat_enabled !== false });
    return true;
  }, []);

  const createSession = useCallback(async (hostName: string, duration: number = 20, gameMode: 'normal' | 'complex' | 'hard' = 'normal', classroom = false) => {
    setLoading(true);
    setError(null);
    try {
      // Loaded on demand so the homepage does not ship the full market dataset.
      const { initializeGame } = await import('@/data/historicalData');
      const { startYear, endYear, assets } = initializeGame(undefined, duration, undefined, gameMode);
      // Pick a code no open or running room is using, so joiners never land in the wrong game.
      let gameCode = generateGameCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: clash } = await supabase.rpc('find_sessions_by_code' as never, { p_game_code: gameCode } as never);
        const open = ((clash ?? []) as { status: string }[]).filter(s => s.status === 'lobby' || s.status === 'playing');
        if (open.length === 0) break;
        gameCode = generateGameCode();
      }

      // Price tracks are the bulk of the payload. Rounding to cents keeps the
      // simulation identical to the eye while cutting the stored config by
      // ~65% — a Normal 10-year room used to exceed the server size limit and
      // fail with "asset_configs too large".
      const compactAssets = assets.map(a => ({
        ...a,
        prices: a.prices.map(p => Math.round(p * 100) / 100),
      }));

      const { data, error: dbError } = await supabase
        .rpc('create_game_session', {
          p_game_code: gameCode,
          p_host_name: hostName,
          p_start_year: startYear,
          p_end_year: endYear,
          p_asset_configs: JSON.parse(JSON.stringify(compactAssets)),
        });

      if (dbError) throw dbError;
      if (!data) throw new Error('Failed to create session');

      const sessionData = data as any;

      // Store the host token for secure updates
      hostTokenRef.current = sessionData.host_token;
      setRoomSettingsState({ classroom: false, chat_enabled: true });
      if (classroom) await updateRoomSettings(sessionData.id, { classroom: true });

      setSession({
        id: sessionData.id,
        game_code: sessionData.game_code,
        host_name: sessionData.host_name,
        status: sessionData.status as GameSession['status'],
        start_year: sessionData.start_year,
        end_year: sessionData.end_year,
        asset_configs: sessionData.asset_configs as GameAssetConfig[],
        game_started_at: sessionData.game_started_at,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [updateRoomSettings]);

  const setClassroom = useCallback((on: boolean) => session ? updateRoomSettings(session.id, { classroom: on }) : Promise.resolve(false), [session, updateRoomSettings]);
  const setChatEnabled = useCallback((on: boolean) => session ? updateRoomSettings(session.id, { chat_enabled: on }) : Promise.resolve(false), [session, updateRoomSettings]);

  const startGame = useCallback(async () => {
    if (!session || !hostTokenRef.current) return;
    const { error: dbError } = await supabase.rpc('secure_update_session', {
      p_session_id: session.id,
      p_token: hostTokenRef.current,
      p_status: 'playing',
      // No start time is sent: the server always records its own.
    });

    if (!dbError) {
      const c = await fetchRoomClock(session.id, hostTokenRef.current);
      setSession(prev => prev ? { ...prev, status: 'playing', game_started_at: c?.game_started_at ?? new Date().toISOString() } : null);
      if (c) setClock({ elapsed: c.elapsed, at: c.at, paused: c.paused });
    }
  }, [session]);

  /** Host-only: pause or resume the whole room on the server clock. */
  const setRoomPaused = useCallback(async (paused: boolean) => {
    if (!session || !hostTokenRef.current) return false;
    const { error: rpcError } = await supabase.rpc('set_room_pause' as never, { p_session_id: session.id, p_token: hostTokenRef.current, p_paused: paused } as never);
    const c = await fetchRoomClock(session.id, hostTokenRef.current);
    if (c) setClock({ elapsed: c.elapsed, at: c.at, paused: c.paused });
    return !rpcError;
  }, [session]);

  const endGame = useCallback(async () => {
    if (!session || !hostTokenRef.current) return;
    await supabase.rpc('secure_update_session', {
      p_session_id: session.id,
      p_token: hostTokenRef.current,
      p_status: 'ended',
    });
    setSession(prev => prev ? { ...prev, status: 'ended' } : null);
  }, [session]);

  const resetSession = useCallback(() => {
    hostTokenRef.current = null;
    setRoomSettingsState({ classroom: false, chat_enabled: true });
    setClock(null);
    setSession(null);
    setPlayers([]);
    setLoading(false);
    setError(null);
  }, []);

  // Subscribe to players in this session
  useEffect(() => {
    if (!session) return;

    const fetchPlayers = () => {
      (supabase.rpc('get_room_players', { p_session_id: session.id, p_token: hostTokenRef.current ?? '' }) as unknown as Promise<{ data: any[] | null }>)
        .then(({ data }) => {
          if (data) {
            setPlayers(data.map(p => ({
              ...p,
              holdings: (p.holdings || {}) as Record<string, number>,
              portfolio_history: (p.portfolio_history || [10000]) as number[],
            })));
          }
        });
    };

    const fetchClock = () => {
      if (!hostTokenRef.current) return;
      void fetchRoomClock(session.id, hostTokenRef.current).then(c => {
        if (c && c.game_started_at) setClock({ elapsed: c.elapsed, at: c.at, paused: c.paused });
      });
    };

    // Initial fetch
    fetchPlayers();
    fetchClock();

    // Poll every 3 seconds as a fallback for realtime delays
    const pollInterval = setInterval(() => { if (document.visibilityState === 'visible') { fetchPlayers(); fetchClock(); } }, 2500);

    // SECURITY: postgres_changes on game_players would broadcast full rows
    // (including secret_token) to every subscriber, bypassing column REVOKEs.
    // We rely on the 3s poll above, which reads the safe game_players_public view.
    const channel = { unsubscribe: () => {} } as any;

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  return { session, players, loading, error, clock, roomSettings, setClassroom, setChatEnabled, createSession, startGame, endGame, setRoomPaused, resetSession, getChatCredentials };
}

export function usePlayerSession() {
  const [session, setSession] = useState<GameSession | null>(null);
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [allPlayers, setAllPlayers] = useState<GamePlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Plain-language explanation of the last reconnect attempt. */
  const [rejoinNotice, setRejoinNotice] = useState<string | null>(null);
  /** Server state to fold into the engine right after a successful reconnect. */
  const [restoreSnapshot, setRestoreSnapshot] = useState<ServerRestoreSnapshot | null>(null);
  const playerTokenRef = useRef<string | null>(null);
  const getChatCredentials = useCallback(() => playerTokenRef.current, []);
  const [roomClock, setRoomClock] = useState<RoomClock | null>(null);
  const [roomSettings, setRoomSettings] = useState<RoomSettings>({ classroom: false, chat_enabled: true });
  const playerIdRef = useRef<string | null>(null);

  const joinSession = useCallback(async (gameCode: string, playerName: string) => {
    setLoading(true);
    setError(null);
    try {
      // Find session
      // Codes can be reused by old finished rooms, so fetch every match and prefer
      // the open lobby, then a running game, then an ended one (for a clear message).
      const { data: matches, error: sessionError } = await (supabase.rpc('find_sessions_by_code' as never, { p_game_code: normalizeGameCode(gameCode) } as never) as unknown as Promise<{ data: any[] | null; error: unknown }>);

      if (sessionError) throw new Error("We couldn't reach the game server. Check your connection and try again.");
      const rank = (s: string | null) => (s === 'lobby' ? 0 : s === 'playing' ? 1 : 2);
      const sessionRaw = [...(matches ?? [])].sort((a, b) => rank(a.status) - rank(b.status))[0];
      if (!sessionRaw) throw new Error('No open game with that code. Double-check it with your host and try again.');
      if (sessionRaw.status === 'playing') throw new Error('Game already started');
      if (sessionRaw.status === 'ended') throw new Error('This code has expired');

      // Create player via secure RPC
      const { data: playerResult, error: playerError } = await supabase
        .rpc('create_game_player', {
          p_session_id: sessionRaw.id,
          p_player_name: playerName.trim(),
        });

      if (playerError) throw playerError;
      if (!playerResult) throw new Error('Failed to create player');

      const pd = playerResult as any;

      // Store the secret token for secure updates
      playerTokenRef.current = pd.secret_token;
      playerIdRef.current = pd.id;
      setActiveRoom({ id: sessionRaw.id!, classroom: false });

      setSession({
        id: sessionRaw.id!,
        game_code: sessionRaw.game_code!,
        host_name: sessionRaw.host_name!,
        status: sessionRaw.status as GameSession['status'],
        start_year: sessionRaw.start_year!,
        end_year: sessionRaw.end_year!,
        asset_configs: sessionRaw.asset_configs as unknown as GameAssetConfig[],
        game_started_at: sessionRaw.game_started_at,
      });
      setPlayer({
        id: pd.id,
        session_id: pd.session_id,
        player_name: pd.player_name,
        cash: pd.cash,
        holdings: (pd.holdings || {}) as Record<string, number>,
        total_contributions: pd.total_contributions,
        portfolio_value: pd.portfolio_value,
        portfolio_history: (pd.portfolio_history || [10000]) as number[],
        is_connected: pd.is_connected,
      });

      // Save rejoin credentials so the player can resume after a refresh/back nav.
      saveMultiplayerRejoin({
        sessionId: sessionRaw.id!,
        gameCode: sessionRaw.game_code!,
        playerId: pd.id,
        playerToken: pd.secret_token,
        playerName: pd.player_name,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Rejoin an in-progress room using saved credentials. The server room is the
   * authority: the player's cash, holdings and contributions come back from the
   * database, and the clock is caught up from the room's shared start time so
   * the returning player lands exactly where everyone else is. Rooms that have
   * finished (or seats that no longer exist) return a plain-language notice.
   */

  const rejoinSession = useCallback(async (): Promise<boolean> => {
    const saved = loadMultiplayerRejoin();
    if (!saved) return false;
    setLoading(true);
    setError(null);
    setRejoinNotice(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('rejoin_game_player', {
        p_player_id: saved.playerId,
        p_token: saved.playerToken,
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error('Could not rejoin');
      const result = data as any;
      const s = result.session;
      const p = result.player;
      playerTokenRef.current = saved.playerToken;
      playerIdRef.current = p.id;
      setActiveRoom({ id: s.id, classroom: false });
      setSession({
        id: s.id,
        game_code: s.game_code,
        host_name: s.host_name,
        status: s.status,
        start_year: s.start_year,
        end_year: s.end_year,
        asset_configs: s.asset_configs as GameAssetConfig[],
        game_started_at: s.game_started_at,
      });
      setPlayer({
        id: p.id,
        session_id: p.session_id,
        player_name: p.player_name,
        cash: p.cash,
        holdings: (p.holdings || {}) as Record<string, number>,
        total_contributions: p.total_contributions,
        portfolio_value: p.portfolio_value,
        portfolio_history: (p.portfolio_history || [10000]) as number[],
        is_connected: true,
      });
      // Catch the clock up to the shared room time. Elapsed time is measured
      // from the room's start, never from this device, so everyone stays in
      // sync and nobody gains time by leaving.
      const serverClock = await fetchRoomClock(s.id, saved.playerToken);
      const elapsed = serverClock
        ? Math.floor(serverClock.elapsed)
        : s.game_started_at
          ? Math.max(0, Math.floor((Date.now() - new Date(s.game_started_at).getTime()) / 1000))
          : 0;
      if (serverClock) setRoomClock({ elapsed: serverClock.elapsed, at: serverClock.at, paused: serverClock.paused });
      const duration = Math.max(1, (s.end_year - s.start_year)) * 60;
      if (s.status === 'playing' && elapsed >= duration) {
        setRejoinNotice('This game has already finished, so there is nothing left to rejoin.');
        clearMultiplayerRejoin();
        return false;
      }
      const holdings = (p.holdings || {}) as Record<string, number>;
      const history = (p.portfolio_history || []) as number[];
      // A seat that has never synced still carries the database's placeholder
      // balances. Adopting those would hand the player money they never
      // earned, so only the clock is caught up in that case.
      const neverSynced = history.length <= 1 && Object.keys(holdings).length === 0;
      setRestoreSnapshot({
        totalSeconds: elapsed,
        cash: neverSynced ? null : Number(p.cash) || 0,
        holdings,
        costBasis: saved.costBasis,
        totalContributions: neverSynced ? null : Number(p.total_contributions) || 0,
        portfolioHistory: neverSynced ? [] : history,
      });
      touchMultiplayerRejoin();
      return true;
    } catch (e: any) {
      const raw = String(e?.message ?? '');
      setRejoinNotice(
        /ended/i.test(raw)
          ? 'That game has ended, so you can no longer rejoin it.'
          : /credential|invalid/i.test(raw)
            ? 'We could not find your spot in that game any more. Ask your host for the code and join again.'
            : "We couldn't reconnect you. Check your connection, or ask your host for the code and join again.",
      );
      setError(raw);
      clearMultiplayerRejoin();
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // SECURITY: postgres_changes on game_sessions would broadcast host_token
  // to every subscriber. Poll the safe game_sessions_public view instead.
  // We also fetch all players in the session so each player can render the
  // end-of-game multiplayer reveal (podium + superlatives) — not just the host.
  useEffect(() => {
    if (!session) return;
    const id = session.id;
    const poll = async () => {
      const data = playerTokenRef.current ? await fetchRoomClock(id, playerTokenRef.current) : null;
      if (data) {
        setSession(prev => prev ? { ...prev, status: data.status, game_started_at: data.game_started_at } : null);
        if (data.game_started_at) setRoomClock({ elapsed: data.elapsed, at: data.at, paused: data.paused });
      }
      if (playerTokenRef.current && playerIdRef.current) {
        const rs = await fetchRoomSettings(id, playerIdRef.current, playerTokenRef.current);
        if (rs) {
          setRoomSettings(prev => (prev.classroom === rs.classroom && prev.chat_enabled === rs.chat_enabled ? prev : rs));
          setActiveRoom({ id, classroom: rs.classroom });
        }
      }
      const { data: playersData } = await (supabase.rpc('get_room_players', { p_session_id: id, p_token: playerTokenRef.current ?? '' }) as unknown as Promise<{ data: any[] | null }>);
      if (playersData) {
        setAllPlayers(playersData.map(p => ({
          ...p,
          holdings: (p.holdings || {}) as Record<string, number>,
          portfolio_history: (p.portfolio_history || [10000]) as number[],
        })));
      }
    };
    poll();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void poll(); }, 3000);
    const onVisible = () => { if (document.visibilityState === 'visible') void poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [session?.id]);

  // Update player data via secure RPC
  const updatePlayer = useCallback(async (
    updates: Partial<Pick<GamePlayer, 'cash' | 'holdings' | 'total_contributions' | 'portfolio_value' | 'portfolio_history'>>,
    /** Local-only, kept beside the credentials so reconnects keep gain/loss. */
    costBasis?: Record<string, number>,
  ) => {
    if (costBasis) updateMultiplayerRejoin({ costBasis });
    if (!player || !playerTokenRef.current) return;
    await supabase.rpc('secure_update_player', {
      p_player_id: player.id,
      p_token: playerTokenRef.current,
      p_cash: updates.cash ?? null,
      p_holdings: updates.holdings ? (updates.holdings as any) : null,
      p_total_contributions: updates.total_contributions ?? null,
      p_portfolio_value: updates.portfolio_value ?? null,
      p_portfolio_history: updates.portfolio_history ? (updates.portfolio_history as any) : null,
    });
    setPlayer(prev => prev ? { ...prev, ...updates } : null);
    // Refresh the rejoin idle timer on every successful sync.
    touchMultiplayerRejoin();
  }, [player]);

  const resetSession = useCallback(() => {
    playerTokenRef.current = null;
    playerIdRef.current = null;
    setActiveRoom(null);
    setRoomSettings({ classroom: false, chat_enabled: true });
    setSession(null);
    setPlayer(null);
    setAllPlayers([]);
    setLoading(false);
    setError(null);
    setRejoinNotice(null);
    setRestoreSnapshot(null);
    setRoomClock(null);
    clearMultiplayerRejoin();
  }, []);

  /** Called once the engine has adopted the restored snapshot. */
  const consumeRestoreSnapshot = useCallback(() => setRestoreSnapshot(null), []);
  const clearRejoinNotice = useCallback(() => setRejoinNotice(null), []);

  return {
    session, player, allPlayers, loading, error, roomClock, roomSettings,
    rejoinNotice, clearRejoinNotice,
    restoreSnapshot, consumeRestoreSnapshot,
    joinSession, rejoinSession, updatePlayer, resetSession, getChatCredentials,
  };
}
