/**
 * Persistent counters for completed games. Stored in localStorage so the
 * value follows the user across sessions on the same device.
 */
const STOCK_KEY = 'games-played-stock-v1';
const REAL_ESTATE_KEY = 'games-played-real-estate-v1';

function read(key: string): number {
  try {
    const v = window.localStorage.getItem(key);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch { return 0; }
}

function write(key: string, n: number): void {
  try { window.localStorage.setItem(key, String(n)); } catch {}
}

export function getStockGamesPlayed(): number { return read(STOCK_KEY); }
export function getRealEstateGamesPlayed(): number { return read(REAL_ESTATE_KEY); }

export function incrementStockGamesPlayed(): number {
  const n = read(STOCK_KEY) + 1;
  write(STOCK_KEY, n);
  try { window.dispatchEvent(new Event('games-played-updated')); } catch {}
  return n;
}

export function incrementRealEstateGamesPlayed(): number {
  const n = read(REAL_ESTATE_KEY) + 1;
  write(REAL_ESTATE_KEY, n);
  try { window.dispatchEvent(new Event('games-played-updated')); } catch {}
  return n;
}
