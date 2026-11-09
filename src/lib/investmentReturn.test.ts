import { describe, expect, it } from 'vitest';
import { calculateInvestmentReturn } from './investmentReturn';

describe('calculateInvestmentReturn', () => {
  it('does not treat a scheduled contribution as profit', () => {
    expect(calculateInvestmentReturn(10_000, 10_000)).toBe(0);
    expect(calculateInvestmentReturn(25_000, 25_000)).toBe(0);
  });

  it('reports only profit above contributed capital', () => {
    expect(calculateInvestmentReturn(12_500, 10_000)).toBe(25);
    expect(calculateInvestmentReturn(8_000, 10_000)).toBe(-20);
  });

  it('dilutes an existing gain when new uninvested money arrives', () => {
    expect(calculateInvestmentReturn(6_000, 5_000)).toBe(20);
    expect(calculateInvestmentReturn(11_000, 10_000)).toBe(10);
  });

  it('handles invalid contribution totals safely', () => {
    expect(calculateInvestmentReturn(5_000, 0)).toBe(0);
    expect(calculateInvestmentReturn(Number.NaN, 5_000)).toBe(0);
  });
});
