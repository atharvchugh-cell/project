import { useEffect } from 'react';

/**
 * Readiness-based: shown only while the game screen's code is loading. There
 * is no fake progress bar or fixed delay — it hands off as soon as it mounts
 * (i.e. once its lazy chunk, and the game's, are available).
 */
export function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const id = requestAnimationFrame(() => onComplete());
    return () => cancelAnimationFrame(id);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center" role="status" aria-live="polite">
      <p className="text-sm text-muted-foreground">Loading market data…</p>
    </div>
  );
}
