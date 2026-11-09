import { describe, expect, it } from 'vitest';
import { calcCDValue } from './stockEngine';

describe('saved CD valuation compatibility', () => {
  it('uses the stored maturity time when a saved CD has matured', () => {
    expect(calcCDValue({ id: 'saved', type: '1y', principal: 1000, rate: 0.08, purchaseSecond: 0, maturitySecond: 30, matured: false }, 30)).toBe(1080);
  });
});