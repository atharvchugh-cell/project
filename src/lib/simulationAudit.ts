/**
 * Full-era simulation integrity audit.
 *
 * Re-runs Complex AND Normal mode price builders for the entire 1990–2025 era
 * and verifies that every consecutive year-end price ratio matches the
 * documented annual return for that asset & calendar year.
 *
 * Used by:
 *   • src/lib/simulationAudit.test.ts — vitest regression suite (blocks
 *     releases when any data or engine change breaks year-end accuracy).
 *   • src/components/game/IntegrityCheckPanel.tsx — one-click UI runner that
 *     renders the pass/fail report for every (asset, year) cell.
 *
 * Determinism: this audit calls only deterministic builders
 * (`buildComplexAssetConfig` and `generateTickPrices` via `initializeGame`
 * with a forced startYear), so its output is byte-identical across runs.
 */

import {
  COMPLEX_UNIVERSE,
  validateComplexReturns,
  type ComplexReturnsIssue,
} from '@/data/complexReturns';
import {
  STOCK_POOL,
  SP500_ANNUAL_RETURNS,
  GOLD_ANNUAL_RETURNS,
  OIL_ANNUAL_RETURNS,
  HYSA_RATES,
  BTC_ANNUAL_RETURNS,
  initializeGame,
  setGameSeed,
  clearGameSeed,
} from '@/data/historicalData';
import { buildComplexAssetConfig } from '@/hooks/useGameEngine';

export const POINTS_PER_YEAR = 24;

export interface YearCheck {
  mode: 'complex' | 'normal';
  ticker: string;
  calendarYear: number;
  gameYear: number;
  expectedReturnPct: number;
  actualReturnPct: number;
  pass: boolean;
}

export interface AuditAnomaly {
  ticker: string;
  mode: 'complex' | 'normal';
  detail: string;
}

export interface AuditReport {
  startYear: number;
  duration: number;
  totalChecks: number;
  passed: number;
  failed: number;
  mismatches: YearCheck[];
  anomalies: AuditAnomaly[];
  integrityIssues: ComplexReturnsIssue[];
  pass: boolean;
  ranAt: string;
}

const DEFAULT_TOL = 0.0005; // 0.05% relative error

const ye = (prices: number[], g: number) => prices[POINTS_PER_YEAR * g];

function ratioCheck(actual: number, expectedRatio: number, tol = DEFAULT_TOL): boolean {
  if (!isFinite(actual) || !isFinite(expectedRatio)) return false;
  if (expectedRatio === 0) return Math.abs(actual) < 1e-6;
  return Math.abs(actual - expectedRatio) / Math.abs(expectedRatio) <= tol;
}

/**
 * Run the full-era integrity audit. Defaults to startYear=1990, duration=35
 * (covers every year of source data). Pass overrides for narrower windows.
 */
export function runFullEraIntegrityAudit({
  startYear = 1990,
  duration = 35,
  tol = DEFAULT_TOL,
}: { startYear?: number; duration?: number; tol?: number } = {}): AuditReport {
  const mismatches: YearCheck[] = [];
  const anomalies: AuditAnomaly[] = [];
  let totalChecks = 0;
  let passed = 0;

  // 1) Static dataset integrity (missing years, off-by-one, etc.)
  const integrityIssues = validateComplexReturns();

  // 2) COMPLEX MODE — every company.
  for (const company of COMPLEX_UNIVERSE) {
    const cfg = buildComplexAssetConfig(company, startYear, duration);
    const expectedLen = duration * POINTS_PER_YEAR + 1;
    if (cfg.prices.length !== expectedLen) {
      anomalies.push({
        mode: 'complex', ticker: company.ticker,
        detail: `prices.length=${cfg.prices.length} expected=${expectedLen}`,
      });
    }
    for (let i = 0; i < cfg.prices.length; i++) {
      const p = cfg.prices[i];
      if (!isFinite(p)) anomalies.push({ mode: 'complex', ticker: company.ticker, detail: `NaN/Inf at index ${i}` });
      if (p < 0) anomalies.push({ mode: 'complex', ticker: company.ticker, detail: `negative price ${p} at index ${i}` });
    }
    for (let g = 1; g <= duration; g++) {
      const calYear = startYear + g - 1;
      if (calYear < company.firstAvailableYear) {
        if (ye(cfg.prices, g) !== 0) {
          anomalies.push({
            mode: 'complex', ticker: company.ticker,
            detail: `pre-IPO calYear=${calYear} expected 0 got ${ye(cfg.prices, g)}`,
          });
        }
        continue;
      }
      if (calYear === company.firstAvailableYear) continue; // anchor
      const r = company.returns[calYear];
      if (r === undefined) continue;
      const prev = ye(cfg.prices, g - 1);
      const curr = ye(cfg.prices, g);
      if (prev <= 0) continue;
      const expectedRatio = 1 + r / 100;
      const actualRatio = curr / prev;
      const pass = ratioCheck(actualRatio, expectedRatio, tol);
      const check: YearCheck = {
        mode: 'complex',
        ticker: company.ticker,
        calendarYear: calYear,
        gameYear: g,
        expectedReturnPct: r,
        actualReturnPct: (actualRatio - 1) * 100,
        pass,
      };
      totalChecks++;
      if (pass) passed++;
      else mismatches.push(check);
    }
  }

  // 3) NORMAL MODE — built via initializeGame. Seed RNG so this audit is
  //    reproducible across runs (random stock picking would otherwise vary).
  setGameSeed(0xA17D17);
  const init = initializeGame(startYear, duration, undefined, 'normal');
  clearGameSeed();

  for (const asset of init.assets) {
    const expectedLen = duration * POINTS_PER_YEAR + 1;
    if (asset.prices.length !== expectedLen && asset.id !== 'btc') {
      anomalies.push({ mode: 'normal', ticker: asset.ticker, detail: `prices.length=${asset.prices.length} expected=${expectedLen}` });
    }
    for (let i = 0; i < asset.prices.length; i++) {
      const p = asset.prices[i];
      if (!isFinite(p)) anomalies.push({ mode: 'normal', ticker: asset.ticker, detail: `NaN/Inf at index ${i}` });
      if (p < 0) anomalies.push({ mode: 'normal', ticker: asset.ticker, detail: `negative price ${p} at index ${i}` });
    }

    let lookup: Record<number, number> | null = null;
    let isHysa = false;
    if (asset.id === 'sp500') lookup = SP500_ANNUAL_RETURNS;
    else if (asset.id === 'gold') lookup = GOLD_ANNUAL_RETURNS;
    else if (asset.id === 'oil') lookup = OIL_ANNUAL_RETURNS;
    else if (asset.id === 'btc') lookup = BTC_ANNUAL_RETURNS;
    else if (asset.id === 'hysa') isHysa = true;
    else lookup = STOCK_POOL.find(s => s.id === asset.id)?.annualReturns ?? null;

    for (let g = 1; g <= duration; g++) {
      const calYear = startYear + g - 1;
      const prev = ye(asset.prices, g - 1);
      const curr = ye(asset.prices, g);
      if (!isFinite(prev) || !isFinite(curr) || prev <= 0) continue;

      let expectedRatio: number | null = null;
      if (isHysa) {
        const rate = HYSA_RATES[calYear] ?? 0.02;
        expectedRatio = 1 + rate;
      } else if (lookup) {
        const r = lookup[calYear];
        if (r !== undefined) expectedRatio = 1 + r;
        else if (asset.id === 'btc' && calYear < 2010) expectedRatio = 1;
      } else continue;
      if (expectedRatio === null) continue;

      const actualRatio = curr / prev;
      const pass = ratioCheck(actualRatio, expectedRatio, tol);
      totalChecks++;
      if (pass) passed++;
      else mismatches.push({
        mode: 'normal',
        ticker: asset.ticker,
        calendarYear: calYear,
        gameYear: g,
        expectedReturnPct: (expectedRatio - 1) * 100,
        actualReturnPct: (actualRatio - 1) * 100,
        pass,
      });
    }
  }

  const failed = mismatches.length;
  const pass = failed === 0 && anomalies.length === 0 && integrityIssues.length === 0;

  return {
    startYear,
    duration,
    totalChecks,
    passed,
    failed,
    mismatches,
    anomalies,
    integrityIssues,
    pass,
    ranAt: new Date().toISOString(),
  };
}
