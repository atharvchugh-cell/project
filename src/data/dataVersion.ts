// Versioned historical dataset. Bump DATA_VERSION whenever a return value changes,
// and record the correction here so regenerated data can be checked against it.
// Runs saved before a version are labelled "pre-correction" and never ranked as equivalent.
export const DATA_VERSION = 2;
export const RULES_VERSION = 2;

export interface DataCorrection { version: number; series: string; year: number; value: number; previous: number; note: string }

/** Values are percentages (price return, excluding dividends). */
export const DATA_CORRECTIONS: DataCorrection[] = [
  { version: 2, series: 'INTC', year: 2024, value: -60.10, previous: 65.24, note: '(20.05 / 50.25 − 1) × 100' },
  { version: 2, series: 'SP500', year: 2008, value: -37, previous: -58, note: 'S&P 500 2008 calendar-year return' },
];
