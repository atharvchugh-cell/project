import { getActiveRoom } from '@/lib/roomContext';
/**
 * Lightweight analytics client. Inserts anonymous `game_events` rows directly
 * via the public Data API (table has an INSERT-only RLS policy and is
 * unreadable without the admin edge function or the `get_leaderboard` RPC).
 * Failures are swallowed so gameplay is never blocked by analytics.
 */
import { supabase } from '@/integrations/supabase/client';
import { analyticsAllowed, safeReferrer } from './privacy';

const SESSION_KEY = 'stockimulator:session';
const DISPLAY_NAME_KEY = 'stockimulator:displayName';
const LAST_RUN_KEY = 'stockimulator:lastRun';

export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) + Date.now().toString(36);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export function getStoredDisplayName(): string | null {
  try {
    const raw = localStorage.getItem(DISPLAY_NAME_KEY);
    if (!raw) return null;
    return raw.slice(0, 32);
  } catch {
    return null;
  }
}

export function setStoredDisplayName(name: string): void {
  try {
    const clean = name.trim().slice(0, 32);
    if (clean) localStorage.setItem(DISPLAY_NAME_KEY, clean);
  } catch { /* ignore */ }
}

export interface LastRunSummary {
  display_name: string;
  ending_value: number;
  return_pct: number;
  start_year: number;
  end_year: number;
  is_multiplayer: boolean;
  saved_at: string;
}

export function setLastRun(run: Omit<LastRunSummary, 'saved_at'>): void {
  try {
    localStorage.setItem(LAST_RUN_KEY, JSON.stringify({ ...run, saved_at: new Date().toISOString() }));
  } catch { /* ignore */ }
}

export function getLastRun(): LastRunSummary | null {
  try {
    const raw = localStorage.getItem(LAST_RUN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastRunSummary;
  } catch {
    return null;
  }
}

function detectDevice(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const w = window.innerWidth;
  if (w < 640) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export interface GameEventInput {
  game_mode?: string;
  simulation_length?: number;
  is_multiplayer?: boolean;
  player_count?: number;
  start_year?: number;
  end_year?: number;
  starting_value?: number;
  ending_value?: number;
  return_pct?: number;
  rank_position?: number;
  assets?: string[];
  trade_count?: number;
  time_spent_seconds?: number;
  completed?: boolean;
  display_name?: string | null;
  challenge_code?: string | null;
  /** Full game snapshot kept with a run that could not be saved yet. */
  simulation?: unknown;
  /** Stable id for one finished game; retries must reuse it so a game is never saved twice. */
  client_run_id?: string;
}

export interface TrackResult {
  /** Player-facing trace ID for this submission, or null if nothing was stored. */
  traceId: string | null;
  stored: boolean;
  /** true when the server function was unavailable and we fell back to a direct insert. */
  fallback: boolean;
  /** true when the run is kept (on the server backlog or this device) to be saved later. */
  queued?: boolean;
  beatTarget?: boolean | null;
  challengeCode?: string | null;
}

export const PENDING_RUNS_KEY = 'rtr-pending-runs-v1';
export const PENDING_RUN_TTL_MS = 60 * 24 * 60 * 60 * 1000;
type PendingRun = { payload: Record<string, unknown>; saved_at: number };

export function readPendingRuns(now = Date.now()): PendingRun[] {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_RUNS_KEY) || '[]') as PendingRun[];
    return Array.isArray(list) ? list.filter(r => r && now - r.saved_at < PENDING_RUN_TTL_MS) : [];
  } catch { return []; }
}
function writePendingRuns(list: PendingRun[]) {
  try { if (list.length) localStorage.setItem(PENDING_RUNS_KEY, JSON.stringify(list.slice(-20))); else localStorage.removeItem(PENDING_RUNS_KEY); } catch { /* storage full */ }
}
function rememberPending(payload: Record<string, unknown>) {
  const list = readPendingRuns().filter(r => r.payload.client_run_id !== payload.client_run_id);
  writePendingRuns([...list, { payload, saved_at: Date.now() }]);
}

async function sendRun(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('submit-run', { body: payload });
  return { data: data as { ok?: boolean; trace_id?: string; queued?: boolean; beat_target?: boolean | null; challenge_code?: string | null } | null, error };
}

let flushing = false;
/** Retries finished games this device couldn't save earlier (kept 60 days). */
export async function flushPendingRuns(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let saved = 0;
  try {
    for (const item of readPendingRuns()) {
      try {
        const { data, error } = await sendRun(item.payload);
        const status = (error as { context?: { status?: number } } | null)?.context?.status;
        if (data?.ok || data?.queued || status === 400) {
          writePendingRuns(readPendingRuns().filter(r => r.payload.client_run_id !== item.payload.client_run_id));
          if (data?.ok) saved++;
        }
      } catch { /* still offline; keep it */ }
    }
  } finally { flushing = false; }
  return saved;
}

/**
 * Submits a finished run via `submit-run`. If saving fails, the full run is kept
 * on the server backlog (and on this device) for 60 days so it can be replayed.
 */
export async function trackGameEvent(input: GameEventInput, purpose: 'requested' | 'analytics' = 'requested'): Promise<TrackResult> {
  if (purpose === 'analytics' && !analyticsAllowed()) return { traceId: null, stored: false, fallback: false };
  const payload: Record<string, unknown> = {
    ...input,
    display_name: input.display_name ? input.display_name.trim().slice(0, 32) : null,
    session_id: getSessionId(),
    device_type: analyticsAllowed() ? detectDevice() : null,
    referrer: analyticsAllowed() && typeof document !== 'undefined' ? safeReferrer(document.referrer) : null,
    client_run_id: input.client_run_id ?? crypto.randomUUID(),
    played_at: new Date().toISOString(),
    room_session_id: input.is_multiplayer ? getActiveRoom()?.id ?? null : null,
  };
  const keep = purpose === 'requested' && !!input.completed;
  if (!keep) delete payload.simulation;

  // Direct inserts are kept for stats but never count as a completed leaderboard run.
  const { challenge_code: _c, simulation: _s, client_run_id: _id, played_at: _p, room_session_id: _r, ...rest } = payload;
  void _r; void _c; void _s; void _id; void _p;
  const directPayload = { ...rest, completed: false };
  const fallbackInsert = async () => {
    try { const { error } = await supabase.from('game_events').insert(directPayload); return !error; } catch { return false; }
  };

  try {
    const { data, error } = await sendRun(payload);
    const traceId = data?.trace_id ?? null;
    if (!error && data?.ok) {
      return { traceId, stored: true, fallback: false, beatTarget: data.beat_target ?? null, challengeCode: data.challenge_code ?? null };
    }
    const status = (error as { context?: { status?: number } } | null)?.context?.status;
    const rejected = status === 400;
    if (keep && !rejected && !data?.queued) rememberPending(payload);
    if (!keep) await fallbackInsert();
    return { traceId, stored: false, fallback: true, queued: keep && !rejected };
  } catch {
    if (keep) rememberPending(payload); else await fallbackInsert();
    return { traceId: null, stored: false, fallback: true, queued: keep };
  }
}
