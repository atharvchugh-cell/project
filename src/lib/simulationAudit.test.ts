/**
 * REGRESSION SUITE — runs on every CI build.
 *
 * Re-executes the full-era simulation for both Complex and Normal mode and
 * fails the build if ANY year-end price diverges from the documented annual
 * return for that asset, OR if any anomaly (NaN, negative price, off-by-one,
 * dataset gap) appears.
 *
 * This is the gate that blocks data or engine changes from shipping with
 * suspicious behavior.
 */
import { describe, it, expect } from 'vitest';
import { runFullEraIntegrityAudit } from './simulationAudit';
import { COMPLEX_TICKER_INDEX } from '@/data/complexReturns';

describe('Full-era simulation integrity (Complex + Normal)', () => {
  const report = runFullEraIntegrityAudit({ startYear: 1990, duration: 35 });

  it('runs a non-trivial number of year-end checks', () => {
    // Prevents accidental regressions where the audit silently runs zero asserts.
    expect(report.totalChecks).toBeGreaterThan(5000);
  });

  it('reports zero year-end mismatches across every asset and year', () => {
    if (report.failed > 0) {
      console.error('First 20 mismatches:', report.mismatches.slice(0, 20));
    }
    expect(report.failed).toBe(0);
  });

  it('reports zero structural anomalies (NaN, negative price, shape)', () => {
    if (report.anomalies.length > 0) console.error('Anomalies:', report.anomalies);
    expect(report.anomalies).toEqual([]);
  });

  it('reports zero dataset integrity issues (missing/off-by-one years)', () => {
    if (report.integrityIssues.length > 0) console.error('Integrity issues:', report.integrityIssues);
    expect(report.integrityIssues).toEqual([]);
  });

  it('overall pass flag is true', () => {
    expect(report.pass).toBe(true);
  });
});

describe('Deterministic seed support', () => {
  it('produces identical normal-mode initialization under the same seed', async () => {
    const { initializeGame, setGameSeed, clearGameSeed } = await import('@/data/historicalData');
    setGameSeed(42);
    const a = initializeGame(2000, 20, undefined, 'normal');
    clearGameSeed();
    setGameSeed(42);
    const b = initializeGame(2000, 20, undefined, 'normal');
    clearGameSeed();
    expect(a.assets.map(x => x.id)).toEqual(b.assets.map(x => x.id));
    expect(a.startYear).toBe(b.startYear);
    // Spot-check a price array end-to-end.
    expect(a.assets[0].prices).toEqual(b.assets[0].prices);
  });

  it('produces different stock selection under different seeds', async () => {
    const { initializeGame, setGameSeed, clearGameSeed } = await import('@/data/historicalData');
    setGameSeed(1);
    const a = initializeGame(2000, 20, undefined, 'normal');
    clearGameSeed();
    setGameSeed(999);
    const b = initializeGame(2000, 20, undefined, 'normal');
    clearGameSeed();
    // At least one differing stock id between the two seeds (extremely high probability).
    const aIds = a.assets.map(x => x.id).join(',');
    const bIds = b.assets.map(x => x.id).join(',');
    expect(aIds).not.toBe(bIds);
  });
});

describe('Canonical uploaded stock source', () => {
  it('uses +5% for N/A years from the uploaded file', () => {
    expect(COMPLEX_TICKER_INDEX['CDNS']?.returns[1993]).toBe(5);
  });

  it('treats null years as pre-IPO gaps, not 0% returns', () => {
    expect(COMPLEX_TICKER_INDEX['ABBV']?.returns[2012]).toBeUndefined();
    expect(COMPLEX_TICKER_INDEX['ABBV']?.firstAvailableYear).toBe(2013);
  });
});
