/**
 * Central route/screen prefetchers. Each function dynamically imports a chunk
 * so it gets cached by the browser without rendering. Safe to call multiple
 * times — Vite/the browser dedupe the requests. Errors are swallowed so a
 * failed prefetch never breaks navigation.
 *
 * Use idle-time prefetching for "most likely next" routes, hover prefetching
 * to make a deliberate hover feel instant, and onClick/choice prefetching to
 * overlap the chunk download with whatever modal or transition is happening.
 */

type Prefetcher = () => Promise<unknown>;

function safe(p: Prefetcher): Prefetcher {
  return () => p().catch(() => undefined);
}

// Top-level routes
export const prefetchRealEstate = safe(() => import('@/pages/RealEstateGame'));
export const prefetchGuide = safe(() => import('@/pages/Guide'));
export const prefetchLeaderboard = safe(() => import('@/pages/Leaderboard'));

// In-flow gameplay chunks (lazy-loaded inside Index)
export const prefetchSoloGame = safe(async () => {
  await Promise.all([
    import('@/components/game/LoadingScreen'),
    import('@/components/game/SoloGame'),
    import('@/components/game/GameScreen'),
    import('@/components/game/EndGameScreen'),
  ]);
});

export const prefetchGroupLobby = safe(() => import('@/components/game/GroupLobby'));

export const prefetchHost = safe(() => import('@/components/game/HostDashboard'));

export const prefetchMultiplayerGame = safe(() => import('@/components/game/MultiplayerGame'));
