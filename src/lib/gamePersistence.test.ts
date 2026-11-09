import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveSoloGame,
  loadSoloGame,
  clearSoloGame,
  saveTradeDraft,
  loadTradeDraft,
  clearTradeDraft,
  saveMultiplayerRejoin,
  loadMultiplayerRejoin,
  clearMultiplayerRejoin,
  IDLE_TIMEOUT_MS,
} from './gamePersistence';
import type { GameState } from '@/hooks/useGameEngine';

/**
 * Build a minimal playing GameState fixture sufficient for the persistence
 * round-trip tests (the persistence layer only serialises/deserialises shape).
 */
function buildState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    startYear: 2000,
    endYear: 2020,
    gameDuration: 20,
    totalGameSeconds: 20 * 60,
    totalSeconds: 65,
    cash: 10_000,
    holdings: {},
    costBasis: {},
    totalContributions: 10_000,
    portfolioHistory: [10_000],
    assetConfigs: [],
    activeCDs: [],
    nextCDId: 1,
    lifeEvents: [],
    unlockedAssetIds: new Set(['idx-sp500']),
    pendingUnlock: null,
    paused: false,
    gameMode: 'normal',
    complexFirstYears: {},
    ...overrides,
  };
}

describe('gamePersistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('solo game', () => {
    const config = { duration: 20, gameMode: 'normal' as const };

    it('saves and restores the game when reloaded later', () => {
      saveSoloGame(buildState(), config);

      // Saves are durable: a reload days later still restores.
      vi.advanceTimersByTime(3 * 24 * 60 * 60 * 1000);

      const loaded = loadSoloGame();
      expect(loaded).not.toBeNull();
      expect(loaded?.config.duration).toBe(20);
      expect(loaded?.state.phase).toBe('playing');
      expect(loaded?.state.unlockedAssetIds).toBeInstanceOf(Set);
      expect(loaded?.state.unlockedAssetIds.has('idx-sp500')).toBe(true);
    });

    it('keeps the save available long after the old five-minute cutoff', () => {
      saveSoloGame(buildState(), config);

      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1_000);

      expect(loadSoloGame()).not.toBeNull();
      // And it should have removed the stale entry from storage.
      expect(window.localStorage.getItem('solo-game-save-v1')).toBeNull();
    });

    it('does not persist games that have already ended', () => {
      saveSoloGame(buildState({ phase: 'ended' }), config);
      expect(loadSoloGame()).toBeNull();
    });

    it('clears explicitly via clearSoloGame', () => {
      saveSoloGame(buildState(), config);
      clearSoloGame();
      expect(loadSoloGame()).toBeNull();
    });
  });

  describe('trade draft', () => {
    it('round-trips an open trade dialog and drafted quantity', () => {
      saveTradeDraft({ assetId: 'cmplx-AAPL', tradeType: 'buy', shares: '12' });
      const draft = loadTradeDraft();
      expect(draft?.assetId).toBe('cmplx-AAPL');
      expect(draft?.tradeType).toBe('buy');
      expect(draft?.shares).toBe('12');
    });

    it('expires after the 5-minute idle window', () => {
      saveTradeDraft({ assetId: 'cmplx-AAPL', tradeType: 'sell', shares: '3' });
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1_000);
      expect(loadTradeDraft()).toBeNull();
    });

    it('clears explicitly', () => {
      saveTradeDraft({ assetId: 'cmplx-AAPL', tradeType: 'buy', shares: '1' });
      clearTradeDraft();
      expect(loadTradeDraft()).toBeNull();
    });
  });

  describe('multiplayer rejoin', () => {
    const creds = {
      sessionId: 's-1',
      gameCode: 'ABC123',
      playerId: 'p-1',
      playerToken: 'tok-1',
      playerName: 'Alex',
    };

    it('round-trips rejoin credentials within the idle window', () => {
      saveMultiplayerRejoin(creds);
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(loadMultiplayerRejoin()).toMatchObject(creds);
    });

    it('does not expire — the room on the server is the authority', () => {
      saveMultiplayerRejoin(creds);
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1_000);
      expect(loadMultiplayerRejoin()).toMatchObject(creds);
    });

    it('clears explicitly', () => {
      saveMultiplayerRejoin(creds);
      clearMultiplayerRejoin();
      expect(loadMultiplayerRejoin()).toBeNull();
    });
  });
});
