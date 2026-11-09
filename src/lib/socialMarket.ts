import { initializeGame, getCDRates, type GameAssetConfig } from '@/data/historicalData';
import { COMPLEX_UNIVERSE } from '@/data/complexReturns';
import { DATA_VERSION } from '@/data/dataVersion';
import { gameReducer, generateLifeEvents, calcPortfolioValue, buildComplexAssetConfig, type GameState, type Action } from './stockEngine';
import { calculateInvestmentReturn } from './investmentReturn';
export { gameReducer, calcPortfolioValue, calculateInvestmentReturn, DATA_VERSION };
export const getSocialCDRates = getCDRates;
export type { GameState, Action };

/** Build once on the server; the room stores this manifest for every player. */
export function createSocialManifest(start: number, duration: number, mode: 'normal' | 'complex') {
  const init = initializeGame(start, duration, undefined, mode);
  const assets: GameAssetConfig[] = init.assets;
  if (mode === 'complex') {
    assets.push(...COMPLEX_UNIVERSE.filter(c => c.firstAvailableYear < init.endYear).map(c => {
      const a = buildComplexAssetConfig(c, start, duration);
      return { ...a, unlockYear: Math.max(1, c.firstAvailableYear - start + 1) };
    }));
  }
  return { startYear: start, duration, mode, dataVersion: DATA_VERSION, assets, lifeEvents: generateLifeEvents() };
}
export type SocialManifest = ReturnType<typeof createSocialManifest>;
export function initialSocialState(manifest: SocialManifest, capital = 5000): GameState {
  return { phase: 'playing', startYear: manifest.startYear, endYear: manifest.startYear + manifest.duration,
    gameDuration: manifest.duration, totalGameSeconds: manifest.duration * 60, totalSeconds: 0,
    cash: capital, holdings: {}, costBasis: {}, totalBought: {}, realizedPnl: {}, totalContributions: capital,
    twrIndex: 1, twrBase: capital, portfolioHistory: [capital], assetConfigs: manifest.assets, activeCDs: [], nextCDId: 1,
    lifeEvents: manifest.lifeEvents.map(e => ({ ...e })),
    unlockedAssetIds: new Set(manifest.assets.filter(a => !a.unlockYear || a.unlockYear <= 1).map(a => a.id)),
    pendingUnlock: null, paused: false, gameMode: manifest.mode, complexFirstYears: {}, autoInvestAssetIds: [], roomPaused: false };
}
export function packState(state: GameState) {
  return { ...state, assetConfigs: undefined, unlockedAssetIds: [...state.unlockedAssetIds] };
}
export function unpackState(state: ReturnType<typeof packState>, manifest: SocialManifest): GameState {
  return { ...state, assetConfigs: manifest.assets, unlockedAssetIds: new Set(state.unlockedAssetIds) };
}
export function advanceSocialState(state: GameState, elapsed: number) {
  let next: GameState = { ...state, paused: false, roomPaused: false };
  const target = Math.min(state.totalGameSeconds, Math.max(state.totalSeconds, Math.floor(elapsed)));
  while (next.totalSeconds < target) next = gameReducer(next, { type: 'TICK' });
  return next;
}
export function validateSocialAction(state: GameState, action: Action): void {
  if (state.phase === 'ended' || state.roomPaused) throw new Error('This round is not accepting trades');
  if (action.type === 'BUY' || action.type === 'SELL') {
    if (!Number.isFinite(action.shares) || action.shares <= 0 || action.shares > 1e12) throw new Error('Invalid quantity');
    if (!state.unlockedAssetIds.has(action.assetId)) throw new Error('This investment is not available yet');
    if (action.type === 'SELL' && action.shares > (state.holdings[action.assetId] ?? 0)) throw new Error('You cannot sell more than you own');
  } else if (action.type === 'SET_AUTO_INVEST') {
    if (action.assetIds.length > 5 || action.assetIds.some(id => !state.assetConfigs.some(a => a.id === id && a.type !== 'crypto'))) throw new Error('Invalid auto-invest selection');
  } else if (action.type === 'BUY_CD') {
    if (!Number.isFinite(action.amount) || action.amount <= 0 || action.amount > state.cash) throw new Error('Insufficient cash');
  } else if (action.type === 'WITHDRAW_CD') {
    const cd = state.activeCDs.find(c => c.id === action.cdId && !c.matured);
    if (!cd || (!action.early && state.totalSeconds < cd.maturitySecond)) throw new Error('This CD has not matured');
  } else throw new Error('Unsupported match action');
  if (action.type === 'BUY' && gameReducer(state, action) === state) throw new Error('Order exceeds available cash or the Bitcoin limit');
}