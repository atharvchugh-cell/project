/**
 * Presence indicator for the hero badge.
 *
 * There is no realtime presence channel on the marketing page, so the number
 * shown is a stable-per-visit estimate rather than a live count. It is
 * generated in the 8–18 range and persisted briefly, so a visitor who returns
 * quickly sees a value that only drifts slightly, while a visitor returning
 * later sees a fresh number.
 */
const KEY = 'stockimulator:onlineNow';
const MIN = 8;
const MAX = 18;
/** Within this window a return visit only drifts by +/-1. */
const DRIFT_WINDOW_MS = 3 * 60 * 1000;

function clamp(n: number): number {
  return Math.min(MAX, Math.max(MIN, n));
}

function fresh(): number {
  return MIN + Math.floor(Math.random() * (MAX - MIN + 1));
}

export function getOnlineNow(): number {
  try {
    const raw = localStorage.getItem(KEY);
    let value = fresh();
    if (raw) {
      const parsed = JSON.parse(raw) as { value: number; at: number };
      if (
        typeof parsed?.value === 'number' &&
        typeof parsed?.at === 'number' &&
        Date.now() - parsed.at < DRIFT_WINDOW_MS
      ) {
        value = clamp(parsed.value + (Math.floor(Math.random() * 3) - 1));
      }
    }
    localStorage.setItem(KEY, JSON.stringify({ value, at: Date.now() }));
    return value;
  } catch {
    return fresh();
  }
}
