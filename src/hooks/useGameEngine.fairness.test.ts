import { describe, it, expect } from 'vitest';
import { gameReducer, type GameState } from './useGameEngine';
import type { GameAssetConfig } from '@/data/historicalData';

const flat = (id: string, price: number, type: GameAssetConfig['type'] = 'stock'): GameAssetConfig =>
  ({ id, name: id, ticker: id, type, prices: Array(24 * 10 + 1).fill(price) } as unknown as GameAssetConfig);

function base(over: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing', startYear: 2000, endYear: 2010, gameDuration: 10, totalGameSeconds: 600,
    totalSeconds: 14, cash: 0, holdings: {}, costBasis: {}, totalContributions: 10000,
    portfolioHistory: [10000], assetConfigs: [flat('A', 100), flat('B', 50), flat('BTC', 10, 'crypto')],
    activeCDs: [], nextCDId: 1, lifeEvents: [], unlockedAssetIds: new Set(['A', 'B', 'BTC']),
    pendingUnlock: null, paused: false, gameMode: 'normal', complexFirstYears: {},
    ...over,
  } as GameState;
}

describe('auto-invest', () => {
  it('splits a $5,000 deposit evenly across picks in Basic mode', () => {
    const s = gameReducer(base({ autoInvestAssetIds: ['A', 'B'] }), { type: 'TICK' });
    expect(s.holdings.A).toBeCloseTo(25, 4);
    expect(s.holdings.B).toBeCloseTo(50, 4);
    expect(s.cash).toBeCloseTo(0, 2);
    expect(s.totalContributions).toBe(15000);
  });

  it('never auto-buys Bitcoin', () => {
    const s = gameReducer(base({ autoInvestAssetIds: ['BTC'] }), { type: 'TICK' });
    expect(s.holdings.BTC ?? 0).toBe(0);
    expect(s.cash).toBe(5000);
  });

  it('keeps reading single-asset choices from older saves', () => {
    const s = gameReducer(base({ gameMode: 'complex', autoInvestAssetId: 'A' }), { type: 'TICK' });
    expect(s.holdings.A).toBeCloseTo(50, 4);
  });
});

describe('yearly pause (solo)', () => {
  it('stops the clock at the start of a new year when turned on', () => {
    const s = gameReducer(base({ totalSeconds: 59, pauseEachYear: true }), { type: 'TICK' });
    expect(s.totalSeconds).toBe(60);
    expect(s.paused).toBe(true);
  });
  it('does not stop when turned off', () => {
    const s = gameReducer(base({ totalSeconds: 59 }), { type: 'TICK' });
    expect(s.paused).toBe(false);
  });
});

describe('host room pause', () => {
  it('freezes the clock and blocks trades until the host resumes', () => {
    const paused = gameReducer(base({ cash: 1000 }), { type: 'ROOM_CLOCK', paused: true });
    expect(gameReducer(paused, { type: 'TICK' }).totalSeconds).toBe(14);
    expect(gameReducer(paused, { type: 'BUY', assetId: 'A', shares: 1 }).cash).toBe(1000);
    expect(gameReducer(paused, { type: 'TOGGLE_PAUSE' }).paused).toBe(false);
    const resumed = gameReducer(paused, { type: 'ROOM_CLOCK', paused: false });
    expect(gameReducer(resumed, { type: 'BUY', assetId: 'A', shares: 1 }).cash).toBe(900);
  });
});
