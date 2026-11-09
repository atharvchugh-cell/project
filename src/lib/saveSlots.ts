/**
 * Durable save slots
 * ------------------
 * Replaces the old five-minute "recovery" window with named, permanent saves
 * for both the stock simulator and the Real Estate game.
 *
 * Storage layout (localStorage):
 *   rtr-saves-index-v2        -> SaveMeta[]  (light list for menus)
 *   rtr-save-v2:<id>          -> SaveRecord  (full snapshot)
 *   rtr-save-v2:<id>:prev     -> SaveRecord  (last known-good snapshot)
 *
 * Saves never expire. They are removed only when the player deletes them.
 * Every write carries a monotonic `seq` and the writing tab's id, so a second
 * tab can never silently clobber newer progress — a stale write is reported
 * back as a conflict instead of being applied.
 */

export const SAVE_FORMAT_VERSION = 2;

const INDEX_KEY = 'rtr-saves-index-v2';
const SLOT_PREFIX = 'rtr-save-v2:';
const LEGACY_SOLO_KEY = 'solo-game-save-v1';
/** Hard cap so localStorage can't fill up with abandoned runs. */
export const MAX_SLOTS = 12;

export type SaveGameKind = 'stock' | 'realestate';

export interface SaveMeta {
  id: string;
  kind: SaveGameKind;
  name: string;
  /** Public mode label, e.g. "Basic", "Advanced", "Hard", "Property". */
  mode: string;
  /** Extra difficulty note, e.g. "Hidden dates". */
  difficulty?: string;
  startYear: number;
  endYear: number;
  /** Simulation year the player is currently living in. */
  currentYear: number;
  /** Wall-clock seconds of simulation left to play. */
  remainingSeconds: number;
  totalSeconds: number;
  portfolioValue: number;
  createdAt: number;
  updatedAt: number;
  version: number;
  /** Monotonic write counter used for multi-tab conflict detection. */
  seq: number;
  /** Id of the tab that produced this write. */
  writer: string;
}

export interface SaveRecord<T = unknown> {
  meta: SaveMeta;
  payload: T;
}

export type WriteStatus = 'saved' | 'conflict' | 'failed';

/** Per-tab identity — two tabs never share this. */
export const TAB_ID: string =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

/** Highest seq this tab knows about per slot; used to detect foreign writes. */
const localSeq = new Map<string, number>();

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function slotKey(id: string) {
  return `${SLOT_PREFIX}${id}`;
}

function isMeta(m: unknown): m is SaveMeta {
  if (!m || typeof m !== 'object') return false;
  const v = m as Partial<SaveMeta>;
  return (
    typeof v.id === 'string' &&
    (v.kind === 'stock' || v.kind === 'realestate') &&
    typeof v.name === 'string' &&
    typeof v.updatedAt === 'number' &&
    typeof v.version === 'number'
  );
}

function readIndex(): SaveMeta[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMeta);
  } catch {
    // Corrupted index — rebuild it from whatever slots survive.
    return rebuildIndex();
  }
}

function writeIndex(list: SaveMeta[]): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    /* best effort */
  }
}

/** Scan raw slot keys and regenerate the index (corruption recovery). */
function rebuildIndex(): SaveMeta[] {
  const s = storage();
  if (!s) return [];
  const found: SaveMeta[] = [];
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i);
    if (!key || !key.startsWith(SLOT_PREFIX) || key.endsWith(':prev')) continue;
    try {
      const rec = JSON.parse(s.getItem(key) || 'null');
      if (rec && isMeta(rec.meta)) found.push(rec.meta);
    } catch {
      /* skip unreadable slot */
    }
  }
  writeIndex(found);
  return found;
}

/** All saves, newest first. */
export function listSlots(kind?: SaveGameKind): SaveMeta[] {
  return readIndex()
    .filter(m => !kind || m.kind === kind)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function mostRecentSlot(kind?: SaveGameKind): SaveMeta | null {
  return listSlots(kind)[0] ?? null;
}

export function getMeta(id: string): SaveMeta | null {
  return readIndex().find(m => m.id === id) ?? null;
}

/**
 * Read a full snapshot. A corrupted or truncated slot falls back to the last
 * known-good snapshot; if that is unusable too, the slot is dropped and null
 * is returned rather than crashing the app.
 */
export function readSlot<T>(id: string): SaveRecord<T> | null {
  const s = storage();
  if (!s) return null;

  const tryParse = (key: string): SaveRecord<T> | null => {
    try {
      const raw = s.getItem(key);
      if (!raw) return null;
      const rec = JSON.parse(raw) as SaveRecord<T>;
      if (!rec || !isMeta(rec.meta) || rec.payload === undefined || rec.payload === null) return null;
      if (rec.meta.version > SAVE_FORMAT_VERSION) return null; // written by a newer app
      return rec;
    } catch {
      return null;
    }
  };

  const current = tryParse(slotKey(id));
  if (current) {
    localSeq.set(id, current.meta.seq);
    return current;
  }
  const previous = tryParse(`${slotKey(id)}:prev`);
  if (previous) {
    localSeq.set(id, previous.meta.seq);
    return previous;
  }
  deleteSlot(id);
  return null;
}

export interface WriteOptions {
  /** Accept another tab's newer write and overwrite it anyway. */
  force?: boolean;
}

export interface WriteResult {
  status: WriteStatus;
  meta?: SaveMeta;
}

export type NewSlotMeta = Omit<SaveMeta, 'createdAt' | 'updatedAt' | 'version' | 'seq' | 'writer'> &
  Partial<Pick<SaveMeta, 'createdAt'>>;

/** Create or update a slot. Returns `conflict` when a newer foreign write exists. */
export function writeSlot<T>(meta: NewSlotMeta, payload: T, options: WriteOptions = {}): WriteResult {
  const s = storage();
  if (!s) return { status: 'failed' };

  try {
    let storedSeq = -1;
    let createdAt = meta.createdAt ?? Date.now();
    try {
      const raw = s.getItem(slotKey(meta.id));
      if (raw) {
        const rec = JSON.parse(raw) as SaveRecord<T>;
        if (isMeta(rec?.meta)) {
          storedSeq = rec.meta.seq;
          createdAt = meta.createdAt ?? rec.meta.createdAt ?? createdAt;
          const known = localSeq.get(meta.id) ?? -1;
          const foreign = rec.meta.writer !== TAB_ID;
          if (!options.force && foreign && rec.meta.seq > known) {
            // Another tab advanced this save past what we last saw.
            return { status: 'conflict', meta: rec.meta };
          }
        }
      }
    } catch {
      /* unreadable current slot — it gets replaced below */
    }

    // Strictly monotonic stamp so two saves written in the same millisecond
    // still order predictably (newest first).
    const newestKnown = readIndex().reduce((max, m) => Math.max(max, m.updatedAt), 0);
    const full: SaveMeta = {
      ...meta,
      createdAt,
      updatedAt: Math.max(Date.now(), newestKnown + 1),
      version: SAVE_FORMAT_VERSION,
      seq: Math.max(storedSeq, localSeq.get(meta.id) ?? -1) + 1,
      writer: TAB_ID,
    };

    // Keep the previous good snapshot before overwriting.
    const prevRaw = s.getItem(slotKey(meta.id));
    const record: SaveRecord<T> = { meta: full, payload };
    s.setItem(slotKey(meta.id), JSON.stringify(record));
    if (prevRaw) {
      try { s.setItem(`${slotKey(meta.id)}:prev`, prevRaw); } catch { /* optional */ }
    }
    localSeq.set(meta.id, full.seq);

    const index = readIndex().filter(m => m.id !== meta.id);
    index.push(full);
    index.sort((a, b) => b.updatedAt - a.updatedAt);
    // Never silently delete saves; players remove old ones themselves.
    // If the browser runs out of space, setItem throws and we report 'failed'.
    writeIndex(index);

    return { status: 'saved', meta: full };
  } catch {
    return { status: 'failed' };
  }
}

function removeSlotStorage(id: string) {
  const s = storage();
  if (!s) return;
  try { s.removeItem(slotKey(id)); } catch { /* noop */ }
  try { s.removeItem(`${slotKey(id)}:prev`); } catch { /* noop */ }
}

export function deleteSlot(id: string): void {
  removeSlotStorage(id);
  localSeq.delete(id);
  writeIndex(readIndex().filter(m => m.id !== id));
}

export function renameSlot(id: string, name: string): SaveMeta | null {
  const clean = name.trim().slice(0, 60) || 'Untitled run';
  const rec = readSlot<unknown>(id);
  if (!rec) return null;
  const meta = { ...rec.meta, name: clean, updatedAt: Date.now() };
  const s = storage();
  if (!s) return null;
  try {
    s.setItem(slotKey(id), JSON.stringify({ meta, payload: rec.payload }));
  } catch {
    return null;
  }
  writeIndex([...readIndex().filter(m => m.id !== id), meta]);
  return meta;
}

/** Adopt a slot as "ours" so subsequent writes don't read as conflicts. */
export function adoptSlot(id: string): void {
  const meta = getMeta(id);
  localSeq.set(id, meta?.seq ?? -1);
}

export function newSlotId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Default human name for a fresh save. */
export function defaultSlotName(kind: SaveGameKind, startYear: number, endYear: number): string {
  const label = kind === 'stock' ? 'Market run' : 'Property run';
  return `${label} ${startYear}–${endYear}`;
}

/**
 * Bring a pre-slot save (the old five-minute "solo-game-save-v1" record) into
 * the slot system. Runs once; the legacy key is removed afterwards.
 * Returns the migrated slot id, if any.
 */
export function migrateLegacySaves(): string | null {
  const s = storage();
  if (!s) return null;
  let raw: string | null = null;
  try { raw = s.getItem(LEGACY_SOLO_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const legacy = JSON.parse(raw) as {
      savedAt?: number;
      config?: { duration: number; startYear?: number; selectedStockIds?: string[]; gameMode: 'normal' | 'complex' | 'hard' };
      state?: Record<string, unknown> & {
        startYear?: number; endYear?: number; totalSeconds?: number;
        totalGameSeconds?: number; portfolioHistory?: number[]; phase?: string;
      };
    };
    if (!legacy?.state || !legacy.config || legacy.state.phase !== 'playing') {
      s.removeItem(LEGACY_SOLO_KEY);
      return null;
    }
    const st = legacy.state;
    const startYear = Number(st.startYear ?? 0);
    const endYear = Number(st.endYear ?? 0);
    const totalSeconds = Number(st.totalSeconds ?? 0);
    const totalGameSeconds = Number(st.totalGameSeconds ?? 0);
    const history = Array.isArray(st.portfolioHistory) ? st.portfolioHistory : [];
    const id = newSlotId();
    writeSlot(
      {
        id,
        kind: 'stock',
        name: defaultSlotName('stock', startYear, endYear),
        mode: legacy.config.gameMode === 'complex' ? 'Advanced' : legacy.config.gameMode === 'hard' ? 'Hard' : 'Basic',
        startYear,
        endYear,
        currentYear: startYear + Math.floor(totalSeconds / 60),
        remainingSeconds: Math.max(0, totalGameSeconds - totalSeconds),
        totalSeconds: totalGameSeconds,
        portfolioValue: history[history.length - 1] ?? 0,
        createdAt: legacy.savedAt ?? Date.now(),
      },
      { config: legacy.config, state: legacy.state },
    );
    s.removeItem(LEGACY_SOLO_KEY);
    return id;
  } catch {
    try { s.removeItem(LEGACY_SOLO_KEY); } catch { /* noop */ }
    return null;
  }
}

/** Human "3 minutes ago" / "Yesterday" style stamp for save cards. */
export function formatLastPlayed(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(ts).toLocaleDateString();
}

export function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m <= 0) return `${rem}s left`;
  return `${m}m ${String(rem).padStart(2, '0')}s left`;
}
