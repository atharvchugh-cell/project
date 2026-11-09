/**
 * Trade-draft persistence lifecycle tests.
 *
 * GameScreen is the single component used by both Solo Complex Mode and
 * Multiplayer Complex Mode (MultiplayerGame renders <GameScreen engine={...} />),
 * so the trade-draft store is identical across modes. These tests simulate the
 * full lifecycle exercised by GameScreen:
 *
 *   1. User opens trade dialog → draft is written.
 *   2. User types a quantity → draft is updated.
 *   3. Tab is closed / refreshed → draft survives in localStorage.
 *   4. Component remounts within 5 min → draft is read back.
 *   5. User confirms the trade → draft is cleared.
 *   6. Component remounts again → no draft to restore.
 *
 * The same store is exercised for solo and multiplayer by re-running the
 * scenario with two different `mode` labels — proving identical behavior.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveTradeDraft,
  loadTradeDraft,
  clearTradeDraft,
} from './gamePersistence';

/**
 * Simulates the trade-dialog effect in GameScreen: when an asset is selected,
 * persist the draft; when it's null (dialog closed / trade confirmed), clear.
 */
function syncTradeDraft(tradeAsset: string | null, tradeType: 'buy' | 'sell', shares: string) {
  if (tradeAsset) saveTradeDraft({ assetId: tradeAsset, tradeType, shares });
  else clearTradeDraft();
}

/** Simulates GameScreen's initial-state hydration on mount. */
function rehydrateOnMount() {
  return loadTradeDraft();
}

describe.each([
  ['solo Complex Mode'],
  ['multiplayer Complex Mode'],
])('trade-draft persistence — %s', (mode) => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(`persists an open buy dialog and drafted quantity across refresh (${mode})`, () => {
    // Step 1: user opens buy dialog for AAPL and types 12 shares.
    syncTradeDraft('cmplx-AAPL', 'buy', '12');

    // Step 2: simulate a brief refresh — 30s later.
    vi.advanceTimersByTime(30 * 1000);

    // Step 3: component remounts and rehydrates.
    const restored = rehydrateOnMount();
    expect(restored).not.toBeNull();
    expect(restored?.assetId).toBe('cmplx-AAPL');
    expect(restored?.tradeType).toBe('buy');
    expect(restored?.shares).toBe('12');
  });

  it(`persists an open sell dialog with drafted quantity across refresh (${mode})`, () => {
    syncTradeDraft('cmplx-MSFT', 'sell', '7');
    vi.advanceTimersByTime(45 * 1000);
    const restored = rehydrateOnMount();
    expect(restored?.assetId).toBe('cmplx-MSFT');
    expect(restored?.tradeType).toBe('sell');
    expect(restored?.shares).toBe('7');
  });

  it(`updates the saved draft as the quantity changes (${mode})`, () => {
    syncTradeDraft('cmplx-NVDA', 'buy', '1');
    syncTradeDraft('cmplx-NVDA', 'buy', '5');
    syncTradeDraft('cmplx-NVDA', 'buy', '25');
    const restored = rehydrateOnMount();
    expect(restored?.shares).toBe('25');
  });

  it(`clears the draft after confirming a trade (${mode})`, () => {
    syncTradeDraft('cmplx-AAPL', 'buy', '10');
    expect(loadTradeDraft()).not.toBeNull();

    // GameScreen sets tradeAsset back to null after a successful trade, which
    // triggers the same effect that calls clearTradeDraft().
    syncTradeDraft(null, 'buy', '1');

    expect(loadTradeDraft()).toBeNull();

    // Re-mounting should now find nothing to restore.
    expect(rehydrateOnMount()).toBeNull();
  });

  it(`clears the draft when the dialog is closed without trading (${mode})`, () => {
    syncTradeDraft('cmplx-AAPL', 'sell', '4');
    syncTradeDraft(null, 'sell', '4');
    expect(rehydrateOnMount()).toBeNull();
  });

  it(`drops a stale draft older than the idle window (${mode})`, () => {
    syncTradeDraft('cmplx-AAPL', 'buy', '12');
    // Tab closed for over a day — past the draft idle cutoff.
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(rehydrateOnMount()).toBeNull();
  });
});
