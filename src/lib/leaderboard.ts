/**
 * Stock-simulator leaderboard — typed wrapper around the get_leaderboard RPC
 * plus the small set of UI presets surfaced in chip-style window filters.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LeaderboardRow {
  display_name: string;
  ending_value: number;
  return_pct: number;
  start_year: number;
  end_year: number;
  is_multiplayer: boolean;
  game_mode: string | null;
  played_at: string;
}

export type LeaderboardKind = 'all' | 'solo' | 'group';
export type LeaderboardSort = 'wealth' | 'return';

export interface WindowPreset {
  id: string;
  label: string;
  /** null = unbounded for that side (treated as "All time" when both null). */
  startYear: number | null;
  endYear: number | null;
}

export const WINDOW_PRESETS: WindowPreset[] = [
  { id: 'all', label: 'All time', startYear: null, endYear: null },
  { id: '1990-2010', label: '1990 – 2010', startYear: 1990, endYear: 2010 },
  { id: '2000-2020', label: '2000 – 2020', startYear: 2000, endYear: 2020 },
  { id: '2010-2025', label: '2010 – 2025', startYear: 2010, endYear: 2025 },
];

export interface LeaderboardQuery {
  windowId?: string;
  kind?: LeaderboardKind;
  sort?: LeaderboardSort;
  limit?: number;
}

export const LEADERBOARD_REFRESH_MS = 2 * 60 * 60 * 1000;
const leaderboardCache = new Map<string, { rows: LeaderboardRow[]; at: number }>();
const pendingRequests = new Map<string, Promise<LeaderboardRow[]>>();

function queryKey(q: LeaderboardQuery): string {
  return JSON.stringify([q.windowId ?? 'all', q.kind ?? 'all', q.sort ?? 'wealth', q.limit ?? 25]);
}

export async function fetchLeaderboard(q: LeaderboardQuery = {}, force = false): Promise<LeaderboardRow[]> {
  const key = queryKey(q);
  const cached = leaderboardCache.get(key);
  if (!force && cached && Date.now() - cached.at < LEADERBOARD_REFRESH_MS) return cached.rows;
  const pending = pendingRequests.get(key);
  if (pending) return pending;
  const request = requestLeaderboard(q).then(rows => {
    // Bound memory even when callers request many different combinations.
    if (leaderboardCache.size >= 64) {
      const oldest = leaderboardCache.keys().next().value;
      if (oldest !== undefined) leaderboardCache.delete(oldest);
    }
    leaderboardCache.set(key, { rows, at: Date.now() });
    return rows;
  }).finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, request);
  return request;
}

async function requestLeaderboard(q: LeaderboardQuery): Promise<LeaderboardRow[]> {
  const preset = WINDOW_PRESETS.find(p => p.id === (q.windowId ?? 'all')) ?? WINDOW_PRESETS[0];
  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_start_year: preset.startYear,
    p_end_year: preset.endYear,
    p_kind: q.kind ?? 'all',
    p_sort: q.sort ?? 'wealth',
    p_limit: q.limit ?? 25,
  });
  if (error) {
    // A failed request is NOT an empty competition — let callers show an error.
    console.warn('[leaderboard] fetch failed', error.message);
    throw new Error(error.message || 'Leaderboard request failed');
  }
  return (data ?? []) as LeaderboardRow[];
}

/**
 * Public results refresh every two hours. Revisits and focus events reuse
 * recent results; error recovery can explicitly bypass the cache.
 */
export function useLeaderboard(q: LeaderboardQuery, options: { pollMs?: number } = {}) {
  const pollMs = options.pollMs ?? LEADERBOARD_REFRESH_MS;
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const key = JSON.stringify(q);

  useEffect(() => {
    let cancelled = false;
    let loadingRequest = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const load = async (background: boolean, force = false) => {
      if (cancelled || loadingRequest) return;
      loadingRequest = true;
      if (background) setRefreshing(true); else setLoading(true);
      try {
        const query = JSON.parse(key) as LeaderboardQuery;
        const r = await fetchLeaderboard(query, force);
        if (cancelled) return;
        setRows(r);
        setUpdatedAt(leaderboardCache.get(queryKey(query))?.at ?? Date.now());
        setError(null);
      } catch (e) {
        if (cancelled) return;
        // Keep the last successful rows; only the error flag changes.
        setError(e instanceof Error ? e.message : 'Request failed');
      } finally {
        loadingRequest = false;
        if (!cancelled) { setLoading(false); setRefreshing(false); }
      }
    };

    void load(false, retryToken > 0);

    const onVisible = () => {
      const cached = leaderboardCache.get(queryKey(JSON.parse(key) as LeaderboardQuery));
      if ((!cached || Date.now() - cached.at >= pollMs) && document.visibilityState === 'visible') void load(true);
    };

    if (pollMs > 0) {
      timer = setInterval(() => {
        // Don't poll a hidden tab — it can't be read and it wastes requests.
        onVisible();
      }, pollMs);
      window.addEventListener('focus', onVisible);
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', onVisible);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pollMs, retryToken]);

  const retry = () => setRetryToken(t => t + 1);
  /** 'stale' = showing earlier rows because the latest refresh failed. */
  const status: 'loading' | 'error' | 'stale' | 'empty' | 'success' =
    loading && !updatedAt ? 'loading'
      : error && !updatedAt ? 'error'
      : error ? 'stale'
      : rows.length === 0 ? 'empty' : 'success';
  return { rows, loading, refreshing, updatedAt, error, retry, status };
}
