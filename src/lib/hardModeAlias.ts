/**
 * Hard Mode alias system.
 *
 * Goal: hide real company identities during play, but reveal them at game end.
 * The mapping must be:
 *   - DETERMINISTIC within a session (same fake company always maps to same real one),
 *   - RANDOMIZED across sessions (different seeds produce different mappings),
 *   - DISPLAY-ONLY (the engine and prices remain tied to the real id),
 *   - REALISTIC — fake companies should sound plausible, not "Company 7".
 */

import { TICKER_INFO } from '@/data/tickerInfo';

export interface AliasEntry {
  /** Realistic-sounding fake company name, e.g. "Helix Dynamics". */
  codename: string;
  /** Fake stock ticker, 3-4 uppercase letters. Unique within a session. */
  alias: string;
  /** Sector taken from TICKER_INFO (always safe to surface). */
  sector: string;
  /** The real asset id this alias maps to. */
  realId: string;
  /** The real ticker (only surfaced on the end-game reveal). */
  realTicker?: string;
  /** The real company name (only surfaced on the end-game reveal). */
  realName?: string;
  /** Real one-line description (reveal only). */
  realDescription?: string;
}

/** Realistic-sounding name pools. Combined gives ~600 unique pairings. */
const NAME_PREFIXES = [
  'Helix', 'Nordwind', 'Atlas', 'Vanta', 'Orion', 'Vertex', 'Lumen', 'Cipher',
  'Quantum', 'Apex', 'Meridian', 'Nimbus', 'Halcyon', 'Onyx', 'Pinnacle',
  'Argent', 'Solstice', 'Cobalt', 'Ember', 'Verdant', 'Aurora', 'Bastion',
  'Equinox', 'Granite', 'Ironclad', 'Keystone', 'Lattice', 'Monarch',
  'Northstar', 'Obsidian', 'Polaris', 'Ridgeline', 'Sable', 'Tempest',
  'Umbra', 'Vector', 'Westwind', 'Zenith', 'Citadel', 'Drift',
];

const NAME_SUFFIXES = [
  'Dynamics', 'Holdings', 'Labs', 'Industries', 'Systems', 'Group', 'Capital',
  'Logistics', 'Partners', 'Materials', 'Networks', 'Technologies', 'Ventures',
  'Forge', 'Works', 'Resources', 'Robotics', 'Bioscience',
];

const TICKER_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Deterministic 32-bit hash for a string seed. */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Mulberry32 seeded RNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function makeTicker(rng: () => number, used: Set<string>, fromName: string): string {
  // Try a 3-4 letter ticker derived from the fake name first, then fall back to random.
  const clean = fromName.replace(/[^A-Za-z]/g, '').toUpperCase();
  const candidates = [
    clean.slice(0, 4),
    clean.slice(0, 3),
    clean[0] + clean.slice(-3),
    clean[0] + clean.slice(-2),
  ].filter(c => c.length >= 3 && c.length <= 4);
  for (const c of candidates) {
    if (!used.has(c)) { used.add(c); return c; }
  }
  // Random fallback — guaranteed to terminate (24^4 = 331,776 possibilities).
  for (let attempt = 0; attempt < 200; attempt++) {
    const len = rng() < 0.6 ? 4 : 3;
    let t = '';
    for (let i = 0; i < len; i++) t += TICKER_LETTERS[Math.floor(rng() * TICKER_LETTERS.length)];
    if (!used.has(t)) { used.add(t); return t; }
  }
  // Last resort — append a digit.
  let t = clean.slice(0, 3) || 'XYZ';
  let n = 1;
  while (used.has(t + n)) n++;
  used.add(t + n);
  return t + n;
}

/**
 * Build an alias map for a set of real asset ids using a seed (e.g. a session id
 * or a per-game UUID). Same seed → same mapping every time.
 *
 * Only `stock`-type ids are masked — generic instruments (S&P, gold, oil, HYSA,
 * BTC) keep their real identity.
 */
export function buildAliasMap(
  seed: string,
  realStockIds: string[],
  realMeta: Record<string, { name: string; ticker: string; description?: string }>,
): Record<string, AliasEntry> {
  const rng = mulberry32(hashSeed(seed));
  const order = shuffled(realStockIds.slice().sort(), rng);
  const prefixOrder = shuffled(NAME_PREFIXES, rng);
  const suffixOrder = shuffled(NAME_SUFFIXES, rng);
  const usedNames = new Set<string>();
  const usedTickers = new Set<string>();
  const map: Record<string, AliasEntry> = {};

  order.forEach((realId, idx) => {
    // Pick a unique name via index walking with a wrap on suffix so we never collide.
    let codename = '';
    for (let attempt = 0; attempt < prefixOrder.length * suffixOrder.length; attempt++) {
      const p = prefixOrder[(idx + attempt) % prefixOrder.length];
      const s = suffixOrder[Math.floor((idx + attempt) / prefixOrder.length) % suffixOrder.length];
      const candidate = `${p} ${s}`;
      if (!usedNames.has(candidate)) { codename = candidate; usedNames.add(candidate); break; }
    }
    if (!codename) codename = `${prefixOrder[idx % prefixOrder.length]} ${suffixOrder[idx % suffixOrder.length]} ${idx}`;

    const alias = makeTicker(rng, usedTickers, codename);
    const meta = realMeta[realId];
    const info = TICKER_INFO[realId];

    map[realId] = {
      codename,
      alias,
      sector: info?.industry ?? 'Diversified',
      realId,
      realTicker: meta?.ticker,
      realName: meta?.name,
      realDescription: info?.description ?? meta?.description,
    };
  });
  return map;
}

/** Apply alias map to a single asset-like object, returning a display copy. */
export function maskAsset<T extends { id: string; name: string; ticker: string; type?: string }>(
  asset: T,
  aliasMap: Record<string, AliasEntry>,
): T {
  if (asset.type && asset.type !== 'stock') return asset;
  const a = aliasMap[asset.id];
  if (!a) return asset;
  return { ...asset, name: a.codename, ticker: a.alias };
}
