import { forwardRef, MouseEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  SANDBOX_SETUP_ROUTE,
  SandboxCtaSource,
  trackSandboxCta,
} from '@/lib/sandboxNav';

interface SandboxCTAProps {
  source: SandboxCtaSource;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  /** Optional extra analytics label (e.g. scenario title on card CTAs). */
  label?: string;
  /** For layout — closes mobile sheets etc. */
  onClickExtra?: () => void;
  /** Attribute for e2e tests. Defaults to `sandbox-cta-<source>`. */
  testId?: string;
}

/**
 * The single canonical Sandbox CTA. Every Sandbox button in the app must use
 * this component. Guarantees:
 *  - Always routes to `/sandbox/setup`.
 *  - Always fires `sandbox_cta_click` analytics with the source location.
 *  - When already inside `/sandbox/*`, forces a fresh setup restart instead
 *    of a no-op navigation to the same URL.
 *  - Exposes `data-sandbox-cta` + `data-testid` for Playwright coverage.
 */
export const SandboxCTA = forwardRef<HTMLAnchorElement, SandboxCTAProps>(function SandboxCTA(
  { source, children, className, ariaLabel, label, onClickExtra, testId },
  ref,
) {
  const nav = useNavigate();
  const loc = useLocation();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClickExtra?.();
    const alreadyInSandbox = loc.pathname.startsWith('/sandbox');
    trackSandboxCta(source, { label, restart: alreadyInSandbox });

    // If we're already on the setup screen, the router will no-op. Force a
    // fresh mount so the user gets a clean restart of the setup flow.
    if (loc.pathname === SANDBOX_SETUP_ROUTE) {
      e.preventDefault();
      nav(SANDBOX_SETUP_ROUTE, {
        replace: true,
        state: { sandboxRestartedAt: Date.now(), source },
      });
    }
  };

  return (
    <Link
      ref={ref}
      to={SANDBOX_SETUP_ROUTE}
      onClick={handleClick}
      aria-label={ariaLabel ?? 'Open Sandbox setup'}
      data-sandbox-cta={source}
      data-testid={testId ?? `sandbox-cta-${source}`}
      className={className ? `cursor-pointer ${className}` : 'cursor-pointer'}
    >
      {children}
    </Link>
  );
});
