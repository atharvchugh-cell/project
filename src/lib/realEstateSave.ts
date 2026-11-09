/**
 * Real Estate save payload
 * ------------------------
 * Full snapshot of a property run, stored in the same durable slot system as
 * stock runs. Everything needed to continue exactly where the player stopped
 * is captured here, including the per-city random walk cache so prices are
 * identical after a restore (no re-rolling).
 */

import {
  adoptSlot,
  defaultSlotName,
  getMeta,
  newSlotId,
  readSlot,
  writeSlot,
  type SaveMeta,
  type WriteResult,
} from '@/lib/saveSlots';

export const RE_SAVE_KIND = 'realestate' as const;

export interface RealEstateSavePayload {
  configIdx: number;
  playerName: string;
  hardMode: boolean;
  startYear: number;
  elapsed: number;
  cash: number;
  totalInvested: number;
  holdings: Record<string, number>;
  availableCities: string[];
  allCityOrder: string[];
  priceHistory: Record<string, number[]>;
  netWorthHistory: number[];
  pctHistory: number[];
  newsLog: string[];
  lastYearIdx: number;
  /** Serialized Brownian-bridge cache: "city:yearIdx" -> samples. */
  bridgeCache: Array<[string, number[]]>;
  tutorialDone: boolean;
}

export interface RealEstateSaveMetaInput {
  slotId: string;
  name?: string;
  endYear: number;
  currentYear: number;
  totalSeconds: number;
  netWorth: number;
}

export function saveRealEstateSlot(
  input: RealEstateSaveMetaInput,
  payload: RealEstateSavePayload,
  force = false,
): WriteResult {
  const existing = getMeta(input.slotId);
  return writeSlot<RealEstateSavePayload>(
    {
      id: input.slotId,
      kind: RE_SAVE_KIND,
      name: input.name ?? existing?.name ?? defaultSlotName('realestate', payload.startYear, input.endYear),
      mode: 'Property',
      difficulty: payload.hardMode ? 'Hard' : undefined,
      startYear: payload.startYear,
      endYear: input.endYear,
      currentYear: input.currentYear,
      remainingSeconds: Math.max(0, input.totalSeconds - payload.elapsed),
      totalSeconds: input.totalSeconds,
      portfolioValue: input.netWorth,
      createdAt: existing?.createdAt,
    },
    payload,
    { force },
  );
}

export interface LoadedRealEstateSave {
  slotId: string;
  meta: SaveMeta;
  payload: RealEstateSavePayload;
}

export function loadRealEstateSlot(slotId: string): LoadedRealEstateSave | null {
  const rec = readSlot<RealEstateSavePayload>(slotId);
  if (!rec || rec.meta.kind !== RE_SAVE_KIND) return null;
  const p = rec.payload;
  // Guard against truncated / hand-edited snapshots.
  if (
    !p ||
    typeof p.elapsed !== 'number' ||
    typeof p.cash !== 'number' ||
    typeof p.startYear !== 'number' ||
    !Array.isArray(p.availableCities) ||
    !p.holdings ||
    typeof p.holdings !== 'object'
  ) {
    return null;
  }
  adoptSlot(slotId);
  return {
    slotId,
    meta: rec.meta,
    payload: {
      ...p,
      allCityOrder: Array.isArray(p.allCityOrder) ? p.allCityOrder : p.availableCities,
      priceHistory: p.priceHistory ?? {},
      netWorthHistory: Array.isArray(p.netWorthHistory) ? p.netWorthHistory : [p.cash],
      pctHistory: Array.isArray(p.pctHistory) ? p.pctHistory : [0],
      newsLog: Array.isArray(p.newsLog) ? p.newsLog : [],
      bridgeCache: Array.isArray(p.bridgeCache) ? p.bridgeCache : [],
      tutorialDone: Boolean(p.tutorialDone),
      lastYearIdx: typeof p.lastYearIdx === 'number' ? p.lastYearIdx : Math.floor(p.elapsed / 60),
    },
  };
}

export function newRealEstateSlotId(): string {
  return newSlotId();
}
