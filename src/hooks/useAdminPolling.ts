import { useEffect, useRef } from 'react';

export const ADMIN_REFRESH_MS = 15 * 60 * 1000;

/** Report reads only; never controls event collection or security mutations. */
export function useAdminPolling(enabled: boolean, refresh: () => unknown) {
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void latestRefresh.current();
    }, ADMIN_REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled]);
}