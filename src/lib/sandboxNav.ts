/**
 * Single source of truth for Sandbox navigation.
 *
 * Every Sandbox CTA — landing hero, nav, footer, teaser cards, in-app
 * buttons — must route through this helper so the route can never drift and
 * every click is instrumented with its source location.
 */

/** Canonical Sandbox entry route. Do not hardcode this string elsewhere. */
import { analyticsAllowed } from '@/lib/privacy';
export const SANDBOX_SETUP_ROUTE = '/sandbox/setup' as const;

/** Landing page + overview route (marketing). Used for the top-nav item only. */
export const SANDBOX_OVERVIEW_ROUTE = '/sandbox' as const;

/**
 * Where a Sandbox CTA lives. Keep values short + stable — they land in
 * analytics dashboards and Playwright selectors.
 */
export type SandboxCtaSource =
  | 'landing-nav-desktop'
  | 'landing-nav-mobile'
  | 'landing-footer'
  | 'landing-teaser-primary'
  | 'landing-teaser-secondary'
  | 'sandbox-page-nav'
  | 'sandbox-page-teaser-primary'
  | 'sandbox-page-teaser-secondary'
  | 'sandbox-page-example-card'
  | 'sandbox-page-custom-event'
  | 'sandbox-page-back-to-stock';

interface TrackPayload {
  source: SandboxCtaSource;
  label?: string;
  target: string;
  route_from?: string;
  restart?: boolean;
  ts: number;
}

/**
 * Fire-and-forget analytics for a Sandbox CTA click. Uses `window.gtag` when
 * present, otherwise `navigator.sendBeacon` to `/__sandbox_cta` (harmless 404
 * in dev, picked up by hosting logs in prod). Also mirrors to the console in
 * dev so broken buttons show up immediately during QA.
 */
export function trackSandboxCta(source: SandboxCtaSource, opts?: { label?: string; restart?: boolean }): void {
  if (typeof window === 'undefined' || !analyticsAllowed()) return;
  const payload: TrackPayload = {
    source,
    label: opts?.label,
    target: SANDBOX_SETUP_ROUTE,
    route_from: window.location.pathname,
    restart: opts?.restart,
    ts: Date.now(),
  };

  // Custom event — tests + future in-app listeners can hook this.
  try {
    window.dispatchEvent(new CustomEvent('sandbox:cta-click', { detail: payload }));
  } catch { /* ignore */ }

  // Google Analytics / GA4 if present.
  try {
    const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    if (typeof gtag === 'function') {
      gtag('event', 'sandbox_cta_click', {
        source: payload.source,
        label: payload.label,
        target: payload.target,
        route_from: payload.route_from,
        restart: payload.restart ?? false,
      });
    }
  } catch { /* ignore */ }

  // Dev console breadcrumb.
  if (import.meta.env?.DEV) {
     
    console.info('[sandbox-cta]', payload);
  }
}

/**
 * Programmatic navigation for Sandbox CTAs that aren't rendered as links.
 * Handles the "already inside Sandbox" case by force-restarting the setup
 * flow instead of no-op'ing.
 */
export function navigateToSandboxSetup(
  navigate: (to: string, opts?: { replace?: boolean; state?: unknown }) => void,
  source: SandboxCtaSource,
  opts?: { label?: string },
): void {
  const alreadyInSandbox =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/sandbox');
  trackSandboxCta(source, { label: opts?.label, restart: alreadyInSandbox });
  navigate(SANDBOX_SETUP_ROUTE, {
    replace: false,
    state: { sandboxRestartedAt: Date.now(), source },
  });
}
