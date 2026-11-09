import { beforeEach, expect, it } from 'vitest';
import { analyticsAllowed, savePrivacyChoice, clearDeviceGameData, safeReferrer, PRIVACY_KEY } from './privacy';
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
it('defaults off and supports opt-in, rejection and withdrawal', () => {
  expect(analyticsAllowed()).toBe(false);
  savePrivacyChoice(false); expect(analyticsAllowed()).toBe(false);
  savePrivacyChoice(true); expect(analyticsAllowed()).toBe(true);
  savePrivacyChoice(false); expect(analyticsAllowed()).toBe(false);
});
it('strips referrer queries and fragments', () => {
  expect(safeReferrer('https://example.com/path?email=secret#token')).toBe('https://example.com/path');
  expect(safeReferrer('')).toBeNull();
});
it('clears game storage while preserving sign-in and privacy preferences', () => {
  for (const key of ['rtr-saves-index-v2', 'rtr-save-v2:slot', 'mp-rejoin-v1', 'solo-game-save-v1']) localStorage.setItem(key, 'test');
  sessionStorage.setItem('sandbox-scenario-v1', 'test');
  localStorage.setItem(PRIVACY_KEY, 'rejected'); localStorage.setItem('sb-test-auth-token', 'session');
  clearDeviceGameData(); expect(localStorage.length).toBe(2); expect(sessionStorage.length).toBe(0);
  expect(localStorage.getItem(PRIVACY_KEY)).toBe('rejected'); expect(localStorage.getItem('sb-test-auth-token')).toBe('session');
});