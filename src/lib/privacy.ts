export const PRIVACY_KEY = 'rise-to-riches:privacy:v1';
export const PRIVACY_EVENT = 'rise-to-riches:privacy-changed';
export function privacyChoice(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(PRIVACY_KEY); } catch { return null; }
}
export function analyticsAllowed(): boolean { return privacyChoice() === 'accepted'; }
export function savePrivacyChoice(allowed: boolean): void {
  try { localStorage.setItem(PRIVACY_KEY, allowed ? 'accepted' : 'rejected'); } catch { /* fail closed */ }
  window.dispatchEvent(new Event(PRIVACY_EVENT));
}
export function safeReferrer(raw: string): string | null {
  try { const url = new URL(raw); return `${url.origin}${url.pathname}`.slice(0, 512); } catch { return null; }
}
export function clearDeviceGameData(): void {
  for (const storage of [localStorage, sessionStorage]) for (const key of Object.keys(storage)) {
    const gameKey = ['stockimulator:', 'rtr:', 'rtr-', 'rise-to-riches:', 'sandbox:', 'sandbox-', 'solo-game-', 'solo-trade-', 'games-played-'].some(prefix => key.startsWith(prefix)) || key === 'mp-rejoin-v1';
    if (gameKey && key !== PRIVACY_KEY) storage.removeItem(key);
  }
}