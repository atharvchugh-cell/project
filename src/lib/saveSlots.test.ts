import { describe, it, expect, beforeEach } from 'vitest';
import {
  SAVE_FORMAT_VERSION, listSlots, mostRecentSlot, readSlot, writeSlot,
  deleteSlot, renameSlot, adoptSlot, newSlotId, migrateLegacySaves, getMeta,
} from './saveSlots';
import { saveRealEstateSlot, loadRealEstateSlot } from './realEstateSave';

function meta(id: string, over: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    kind: 'stock' as const,
    name: 'Run ' + id,
    mode: 'Advanced',
    startYear: 1990,
    endYear: 2000,
    currentYear: 1993,
    remainingSeconds: 420,
    totalSeconds: 600,
    portfolioValue: 12345,
    ...over,
  };
}

describe('save slots', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a snapshot', () => {
    const id = newSlotId();
    const res = writeSlot(meta(id), { cash: 500, holdings: { AAPL: 2 } });
    expect(res.status).toBe('saved');
    const back = readSlot<{ cash: number; holdings: Record<string, number> }>(id);
    expect(back?.payload.cash).toBe(500);
    expect(back?.payload.holdings.AAPL).toBe(2);
    expect(back?.meta.version).toBe(SAVE_FORMAT_VERSION);
  });

  it('never expires and lists newest first', () => {
    const a = newSlotId();
    const b = newSlotId();
    writeSlot(meta(a), { n: 1 });
    writeSlot(meta(b), { n: 2 });
    expect(listSlots()).toHaveLength(2);
    expect(mostRecentSlot()?.id).toBe(b);
  });

  it('renames and deletes', () => {
    const id = newSlotId();
    writeSlot(meta(id), { n: 1 });
    renameSlot(id, 'My run');
    expect(getMeta(id)?.name).toBe('My run');
    deleteSlot(id);
    expect(readSlot(id)).toBeNull();
    expect(listSlots()).toHaveLength(0);
  });

  it('falls back to the previous good snapshot when the newest is corrupt', () => {
    const id = newSlotId();
    writeSlot(meta(id), { n: 1 });
    writeSlot(meta(id), { n: 2 });
    localStorage.setItem(`rtr-save-v2:${id}`, '{not json');
    const back = readSlot<{ n: number }>(id);
    expect(back?.payload.n).toBe(1);
  });

  it('does not crash when both snapshots are corrupt', () => {
    const id = newSlotId();
    writeSlot(meta(id), { n: 1 });
    localStorage.setItem(`rtr-save-v2:${id}`, '{bad');
    localStorage.setItem(`rtr-save-v2:${id}:prev`, '{bad');
    expect(readSlot(id)).toBeNull();
  });

  it('refuses to clobber a newer write from another tab', () => {
    const id = newSlotId();
    writeSlot(meta(id), { n: 1 });
    // Simulate another tab having written a newer sequence.
    const rec = JSON.parse(localStorage.getItem(`rtr-save-v2:${id}`)!);
    rec.meta.seq += 5;
    rec.meta.writer = 'other-tab';
    localStorage.setItem(`rtr-save-v2:${id}`, JSON.stringify(rec));
    const idx = JSON.parse(localStorage.getItem('rtr-saves-index-v2')!);
    idx[0] = rec.meta;
    localStorage.setItem('rtr-saves-index-v2', JSON.stringify(idx));
    expect(writeSlot(meta(id), { n: 2 }).status).toBe('conflict');
    adoptSlot(id);
    expect(writeSlot(meta(id), { n: 3 }).status).toBe('saved');
  });

  it('migrates a legacy single-slot save', () => {
    localStorage.setItem('solo-game-save-v1', JSON.stringify({
      savedAt: Date.now(),
      config: { duration: 10, gameMode: 'normal', startYear: 1990 },
      state: { cash: 9000, totalSeconds: 120, phase: 'playing', startYear: 1990, endYear: 2000, totalGameSeconds: 600, portfolioHistory: [10000, 11000] },
    }));
    migrateLegacySaves();
    expect(localStorage.getItem('solo-game-save-v1')).toBeNull();
    expect(listSlots('stock').length).toBe(1);
  });
});

describe('real estate saves', () => {
  beforeEach(() => localStorage.clear());

  it('preserves the price-walk cache so prices do not re-roll', () => {
    const id = newSlotId();
    const payload = {
      configIdx: 2, playerName: 'Ann', hardMode: false, startYear: 1985,
      elapsed: 137, cash: 4200, totalInvested: 20000,
      holdings: { Austin: 3 }, availableCities: ['Austin'], allCityOrder: ['Austin'],
      priceHistory: { Austin: [1, 2, 3] }, netWorthHistory: [20000, 21000],
      pctHistory: [0, 5], newsLog: ['x'], lastYearIdx: 2,
      bridgeCache: [['Austin:0', [0, 0.5, -0.2, 0]]] as Array<[string, number[]]>,
      tutorialDone: true,
    };
    const res = saveRealEstateSlot(
      { slotId: id, endYear: 2005, currentYear: 1987, totalSeconds: 1200, netWorth: 30000 },
      payload,
    );
    expect(res.status).toBe('saved');
    const back = loadRealEstateSlot(id);
    expect(back?.payload.bridgeCache).toEqual(payload.bridgeCache);
    expect(back?.payload.elapsed).toBe(137);
    expect(back?.payload.holdings.Austin).toBe(3);
    expect(back?.meta.kind).toBe('realestate');
  });

  it('rejects a stock slot as a property save', () => {
    const id = newSlotId();
    writeSlot(meta(id), { cash: 1 });
    expect(loadRealEstateSlot(id)).toBeNull();
  });
});
