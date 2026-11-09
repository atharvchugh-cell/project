/**
 * Solo Game Session Persistence
 * ------------------------------
 * Thin, game-specific layer on top of the durable save slots in
 * `@/lib/saveSlots`. Stock runs are stored as full snapshots that survive
 * refreshes, tab closes and browser restarts — they are removed only when the
 * player deletes them (the old five-minute expiry window is gone).
 */

import type { GameState } from '@/hooks/useGameEngine';
import {
  adoptSlot,
  defaultSlotName,
  deleteSlot,
  getMeta,
  listSlots,
  newSlotId,
  readSlot,
  writeSlot,
  type SaveMeta,
  type WriteResult,
} from '@/lib/saveSlots';

/** Kept for the trade draft only — drafts are short-lived by nature. */
export const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

const ACTIVE_STOCK_SLOT_KEY = 'rtr-active-stock-slot';

export interface SoloGameConfig {
  duration: number;
  startYear?: number;
  selectedStockIds?: string[];
  gameMode: 'normal' | 'complex' | 'hard';
  /** Ranked-challenge seed, preserved verbatim across resumes. */
  challengeSeed?: string;
  /** Ranked-challenge rules version, so resume rules stay comparable. */
  challengeRules?: string;
  /** True once the player has been through the tutorial in this run. */
  tutorialDone?: boolean;
}

/** Serialised GameState (Set fields flattened for JSON). */
export type SerializedGameState = Omit<GameState, 'unlockedAssetIds'> & { unlockedAssetIds: string[] };

export interface StockSavePayload {
  config: SoloGameConfig;
  state: SerializedGameState;
}

export function serializeState(state: GameState): SerializedGameState {
  return { ...state, unlockedAssetIds: Array.from(state.unlockedAssetIds) };
}

export function deserializeState(stored: SerializedGameState): GameState {
  return { ...stored, unlockedAssetIds: new Set(stored.unlockedAssetIds ?? []) };
}

function modeLabel(mode: SoloGameConfig['gameMode']): string {
  return mode === 'complex' ? 'Advanced' : mode === 'hard' ? 'Hard' : 'Basic';
}

export function getActiveStockSlotId(): string | null {
  try { return window.localStorage.getItem(ACTIVE_STOCK_SLOT_KEY); } catch { return null; }
}

export function setActiveStockSlotId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(ACTIVE_STOCK_SLOT_KEY, id);
    else window.localStorage.removeItem(ACTIVE_STOCK_SLOT_KEY);
  } catch { /* best effort */ }
}

/** Start tracking a brand new stock save; returns its slot id. */
export function createStockSlot(state: GameState, config: SoloGameConfig, name?: string): string {
  const id = newSlotId();
  setActiveStockSlotId(id);
  adoptSlot(id);
  saveStockSlot(id, state, config, name);
  return id;
}

/** Write (or overwrite) a stock snapshot into a specific slot. */
export function saveStockSlot(
  slotId: string,
  state: GameState,
  config: SoloGameConfig,
  name?: string,
  force = false,
): WriteResult {
  const existing = getMeta(slotId);
  const value = state.portfolioHistory[state.portfolioHistory.length - 1] ?? state.cash;
  const elapsedYears = Math.floor(state.totalSeconds / 60);
  return writeSlot<StockSavePayload>(
    {
      id: slotId,
      kind: 'stock',
      name: name ?? existing?.name ?? defaultSlotName('stock', state.startYear, state.endYear),
      mode: modeLabel(state.gameMode),
      difficulty: state.gameMode === 'hard' ? 'Dates hidden' : undefined,
      startYear: state.startYear,
      endYear: state.endYear,
      currentYear: state.startYear + elapsedYears,
      remainingSeconds: Math.max(0, state.totalGameSeconds - state.totalSeconds),
      totalSeconds: state.totalGameSeconds,
      portfolioValue: value,
      createdAt: existing?.createdAt,
    },
    { config, state: serializeState(state) },
    { force },
  );
}

export interface LoadedSoloGame {
  slotId: string;
  meta: SaveMeta;
  config: SoloGameConfig;
  state: GameState;
}

/** Load a specific stock save. Corrupted snapshots fall back / fail safely. */
export function loadStockSlot(slotId: string): LoadedSoloGame | null {
  const rec = readSlot<StockSavePayload>(slotId);
  if (!rec || rec.meta.kind !== 'stock') return null;
  const { config, state } = rec.payload ?? ({} as StockSavePayload);
  if (!config || !state || state.phase !== 'playing' || !Array.isArray(state.portfolioHistory)) {
    return null;
  }
  adoptSlot(slotId);
  // Restored solo games always open paused, so no simulation time is lost.
  return { slotId, meta: rec.meta, config, state: { ...deserializeState(state), paused: true } };
}

/** Most recently played stock save, if any. */
export function loadSoloGame(): LoadedSoloGame | null {
  const active = getActiveStockSlotId();
  if (active) {
    const fromActive = loadStockSlot(active);
    if (fromActive) return fromActive;
  }
  for (const meta of listSlots('stock')) {
    const loaded = loadStockSlot(meta.id);
    if (loaded) return loaded;
  }
  return null;
}

/** Legacy helper kept for the engine: writes to the active slot. */
export function saveSoloGame(state: GameState, config: SoloGameConfig, slotId?: string): WriteResult {
  // Fall back to creating a slot so a save is never silently dropped.
  let id = slotId ?? getActiveStockSlotId();
  if (!id) {
    id = createStockSlot(state, config);
  }
  return saveStockSlot(id, state, config);
}

/** Delete the currently tracked stock save (used when a run finishes). */
export function clearSoloGame(): void {
  const id = getActiveStockSlotId();
  if (id) deleteSlot(id);
  setActiveStockSlotId(null);
  try { window.localStorage.removeItem('solo-game-welcomed-v1'); } catch { /* noop */ }
}

/** Stop tracking the active save without deleting it (Save & exit). */
export function releaseActiveStockSlot(): void {
  setActiveStockSlotId(null);
}

/* ---------------- Trade draft (open dialog + quantity) ---------------- */

const TRADE_DRAFT_KEY = 'solo-trade-draft-v1';

export interface TradeDraft {
  assetId: string;
  tradeType: 'buy' | 'sell';
  shares: string;
  savedAt: number;
}

export function saveTradeDraft(draft: Omit<TradeDraft, 'savedAt'>): void {
  try {
    window.localStorage.setItem(
      TRADE_DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() }),
    );
  } catch { /* noop */ }
}

export function loadTradeDraft(): TradeDraft | null {
  try {
    const raw = window.localStorage.getItem(TRADE_DRAFT_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as TradeDraft;
    if (!payload?.savedAt || Date.now() - payload.savedAt > IDLE_TIMEOUT_MS) {
      clearTradeDraft();
      return null;
    }
    return payload;
  } catch {
    clearTradeDraft();
    return null;
  }
}

export function clearTradeDraft(): void {
  try { window.localStorage.removeItem(TRADE_DRAFT_KEY); } catch { /* noop */ }
}

/* ---------------- Multiplayer rejoin credentials ---------------- */

const MP_STORAGE_KEY = 'mp-rejoin-v1';

export interface MultiplayerRejoinPayload {
  sessionId: string;
  gameCode: string;
  playerId: string;
  playerToken: string;
  playerName: string;
  savedAt: number;
  /**
   * Per-asset cost basis. The server only stores cash/holdings/value, so this
   * rides along locally to keep per-position gain/loss correct after a
   * reconnect. Missing values simply fall back to no basis.
   */
  costBasis?: Record<string, number>;
}

export function saveMultiplayerRejoin(
  payload: Omit<MultiplayerRejoinPayload, 'savedAt'>,
): void {
  try {
    window.localStorage.setItem(
      MP_STORAGE_KEY,
      JSON.stringify({ ...payload, savedAt: Date.now() }),
    );
  } catch { /* noop */ }
}

/**
 * Multiplayer credentials do NOT expire on a timer — the room on the server is
 * the authority. They are cleared when the server says the room has ended.
 */
export function loadMultiplayerRejoin(): MultiplayerRejoinPayload | null {
  try {
    const raw = window.localStorage.getItem(MP_STORAGE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as MultiplayerRejoinPayload;
    if (!payload?.sessionId || !payload.playerId || !payload.playerToken) {
      clearMultiplayerRejoin();
      return null;
    }
    return payload;
  } catch {
    clearMultiplayerRejoin();
    return null;
  }
}

export function clearMultiplayerRejoin(): void {
  try { window.localStorage.removeItem(MP_STORAGE_KEY); } catch { /* noop */ }
}

/** Refresh the saved-at timestamp on existing multiplayer credentials. */
export function touchMultiplayerRejoin(): void {
  const existing = loadMultiplayerRejoin();
  if (existing) saveMultiplayerRejoin(existing);
}

/** Merge extra local-only fields (e.g. cost basis) into stored credentials. */
export function updateMultiplayerRejoin(
  patch: Partial<Omit<MultiplayerRejoinPayload, 'savedAt'>>,
): void {
  const existing = loadMultiplayerRejoin();
  if (!existing) return;
  saveMultiplayerRejoin({ ...existing, ...patch });
}
