/**
 * Path prefix the app is served under. Vite sets BASE_URL from `base` in
 * vite.config.ts: "/" for the normal root deployment (investmentsimulator.app,
 * Lovable previews), or e.g. "/project/" for a GitHub Pages project site.
 * BASE_PATH has no trailing slash, so at the root it is "" and every helper
 * below returns exactly the root-relative value it is given.
 */
export const BASE_PATH = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");

/** Prefix a root-relative path ("/company-logos/AAPL.png") with the base path. */
export const withBase = (path: string): string => `${BASE_PATH}${path}`;

/** Absolute origin + base path, for share/join/redirect links. */
export const appOrigin = (): string => `${window.location.origin}${BASE_PATH}`;
