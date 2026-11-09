import { describe, it, expect } from 'vitest';
import { getMaxBuyUnits, getTradeBlockReason } from './tradeInput';

describe('getMaxBuyUnits', () => {
  it('uses cash for normal stocks', () => {
    expect(getMaxBuyUnits({ cash: 1000, price: 300 }).max).toBe(3);
  });
  it('applies the crypto cap and explains zero', () => {
    const r = getMaxBuyUnits({ cash: 100000, price: 30000, isCrypto: true, portfolioValue: 100000, currentCryptoValue: 0 });
    expect(r.max).toBe(0);
    expect(r.capLimited).toBe(true);
    expect(r.reason).toMatch(/can't buy any/);
  });
  it('allows buys under the cap', () => {
    const r = getMaxBuyUnits({ cash: 1e9, price: 1, isCrypto: true, portfolioValue: 1e9, currentCryptoValue: 0 });
    expect(r.max).toBe(100000);
  });
  it('confirm is blocked above the executable max', () => {
    const r = getMaxBuyUnits({ cash: 1e9, price: 1, isCrypto: true, portfolioValue: 1e9 });
    expect(getTradeBlockReason({ tradeType: 'buy', shares: 100001, maxBuyShares: r.max, maxSellShares: 0, pricePerShare: 1, cash: 1e9 }).blocked).toBe(true);
  });
});
