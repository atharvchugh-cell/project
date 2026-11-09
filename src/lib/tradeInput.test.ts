import { describe, it, expect } from 'vitest';
import {
  sanitizeShareInput,
  normalizeShareOnBlur,
  getTradeBlockReason,
  parseQuantity,
} from './tradeInput';

describe('parseQuantity', () => {
  it('never concatenates digits around punctuation (F02 regression)', () => {
    expect(parseQuantity('10.5', { fractional: true })).toBe(10.5);
    expect(parseQuantity('10.5')).toBe(10); // whole-unit asset floors, never 105
    expect(sanitizeShareInput('10.5', 999)).not.toBe('105');
  });

  it('handles comma-formatted input', () => {
    expect(parseQuantity('1,250')).toBe(1250);
  });

  it('rejects blank, nonnumeric, nonfinite and negative input', () => {
    for (const bad of ['', '   ', 'abc', '1.2.3', '-5', 'Infinity', 'NaN', '.']) {
      expect(parseQuantity(bad)).toBeNull();
    }
  });

  it('rejects absurdly large input', () => {
    expect(parseQuantity('1e20')).toBeNull();
    expect(parseQuantity('999999999999999')).toBeNull();
  });

  it('respects BTC precision', () => {
    expect(parseQuantity('0.123456789', { fractional: true, precision: 8 })).toBe(0.12345678);
  });
});

describe('sanitizeShareInput', () => {
  it('strips characters that cannot belong', () => {
    expect(sanitizeShareInput('1a2b3', 999)).toBe('123');
    expect(sanitizeShareInput('-5', 999)).toBe('5');
    expect(sanitizeShareInput('  7 ', 999)).toBe('7');
  });

  it('keeps a decimal being typed for fractional assets', () => {
    expect(sanitizeShareInput('10.', 999, { fractional: true })).toBe('10.');
    expect(sanitizeShareInput('10.50', 999, { fractional: true })).toBe('10.50');
  });

  it('drops the decimal part for whole-unit assets', () => {
    expect(sanitizeShareInput('10.5', 999)).toBe('10');
  });

  it('returns empty string when no digits typed', () => {
    expect(sanitizeShareInput('', 100)).toBe('');
    expect(sanitizeShareInput('abc', 100)).toBe('');
  });

  it('clamps to max', () => {
    expect(sanitizeShareInput('9999', 50)).toBe('50');
    expect(sanitizeShareInput('50', 50)).toBe('50');
    expect(sanitizeShareInput('49', 50)).toBe('49');
    expect(sanitizeShareInput('10', 0)).toBe('0');
  });

  it('strips leading zeros', () => {
    expect(sanitizeShareInput('007', 100)).toBe('7');
    expect(sanitizeShareInput('0', 100)).toBe('0');
  });
});

describe('normalizeShareOnBlur', () => {
  it('coerces empty / invalid values back to 1 when shares are available', () => {
    expect(normalizeShareOnBlur('', 10)).toBe('1');
    expect(normalizeShareOnBlur('abc', 10)).toBe('1');
    expect(normalizeShareOnBlur('0', 10)).toBe('1');
  });

  it('keeps a fractional quantity intact', () => {
    expect(normalizeShareOnBlur('10.5', 100, { fractional: true })).toBe('10.5');
  });

  it('floors a fractional quantity for whole-unit assets', () => {
    expect(normalizeShareOnBlur('10.5', 100)).toBe('10');
  });

  it('clamps to max but never below 1 when max >= 1', () => {
    expect(normalizeShareOnBlur('99', 5)).toBe('5');
    expect(normalizeShareOnBlur('3', 5)).toBe('3');
  });

  it('falls back to 0 when max is also 0', () => {
    expect(normalizeShareOnBlur('', 0)).toBe('0');
    expect(normalizeShareOnBlur('5', 0)).toBe('0');
  });
});

describe('getTradeBlockReason', () => {
  const base = { pricePerShare: 100, cash: 500, maxBuyShares: 5, maxSellShares: 3 };

  it('blocks when shares <= 0', () => {
    const r = getTradeBlockReason({ ...base, tradeType: 'buy', shares: 0 });
    expect(r.blocked).toBe(true);
    expect(r.message).toMatch(/at least 1 share/i);
  });

  it('blocks buy when cash would go negative and explains shortfall', () => {
    const r = getTradeBlockReason({ ...base, tradeType: 'buy', shares: 6 });
    expect(r.blocked).toBe(true);
    expect(r.message).toMatch(/short by/i);
  });

  it('allows buy when within cash', () => {
    const r = getTradeBlockReason({ ...base, tradeType: 'buy', shares: 5 });
    expect(r.blocked).toBe(false);
    expect(r.message).toBeNull();
  });

  it('blocks sell when exceeding holdings', () => {
    const r = getTradeBlockReason({ ...base, tradeType: 'sell', shares: 4 });
    expect(r.blocked).toBe(true);
    expect(r.message).toMatch(/only own 3 share/i);
  });

  it('blocks on a nonfinite price', () => {
    const r = getTradeBlockReason({ ...base, pricePerShare: NaN, tradeType: 'buy', shares: 1 });
    expect(r.blocked).toBe(true);
  });

  it('allows sell when within holdings', () => {
    const r = getTradeBlockReason({ ...base, tradeType: 'sell', shares: 3 });
    expect(r.blocked).toBe(false);
  });
});
