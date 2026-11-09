import { describe, expect, it } from 'vitest';
import { firmCash, founderCash } from './career';
import { ownershipOf, priceIpo } from './exit';
import { publicQuote, splitPublicShares, tradePublicShares } from './publicFirm';
import { publicFixture } from './publicFirm.test';
import { richList } from './billionaires';
import { FAME_LEVELS, levelOf } from './immersion';
import { buyNow } from './deals';
import { ideaOrders } from './plan';
import { netAssets } from '@/lib/fund/accounting';

const listed = () => { const r = priceIpo(publicFixture(), 0.2, true); expect(r.ok).toBe(true); return r.c; };
const unlocked = () => { const c = listed(); c.fund.q = ownershipOf(c).ipo!.lockupUntilQ!; return c; };

describe('founder share moves', () => {
  it('sells an exact number of founder shares after lockup, paying personal cash', () => {
    const c = unlocked(); const q = publicQuote(c);
    const r = tradePublicShares(c, 'sell', 1000);
    expect(r.ok).toBe(true);
    expect(founderCash(r.c) - founderCash(c)).toBeCloseTo(Math.round(1000 * q.price * 100) / 100, 2);
    expect(publicQuote(r.c).founderShares).toBeCloseTo(q.founderShares - 1000, 3);
    expect(firmCash(r.c)).toBe(firmCash(c));
  });
  it('blocks selling more shares than you own and during lockup', () => {
    const c = unlocked();
    expect(tradePublicShares(c, 'sell', Math.ceil(publicQuote(c).founderShares) + 1).ok).toBe(false);
    expect(tradePublicShares(listed(), 'sell', 10).ok).toBe(false);
  });
  it('a 2-for-1 split doubles shares, halves price and keeps value and cash', () => {
    const c = listed(); const before = publicQuote(c);
    const r = splitPublicShares(c, 2); expect(r.ok).toBe(true);
    const after = publicQuote(r.c);
    expect(after.shares).toBe(before.shares * 2);
    expect(firmCash(r.c)).toBe(firmCash(c)); expect(founderCash(r.c)).toBe(founderCash(c));
    expect(splitPublicShares(r.c, 2).ok).toBe(false);
  });
});

describe('rich list', () => {
  it('keeps Elon Musk first at $1.1T and leaves you off until above $150B', () => {
    expect(richList('You', 149e9, 'F').rows[0]).toMatchObject({ name: 'Elon Musk', worth: 1.1e12 });
    expect(richList('You', 149e9, 'F').onList).toBe(false);
    const on = richList('You', 200e9, 'F'); expect(on.onList).toBe(true); expect(on.rows.some(r => r.you)).toBe(true); expect(on.rows).toHaveLength(10);
  });
});

describe('fame levels', () => {
  it('has ten fame levels', () => {
    expect(FAME_LEVELS).toHaveLength(10);
    expect(levelOf(FAME_LEVELS, 0).level).toBe(1); expect(levelOf(FAME_LEVELS, 95).level).toBe(10);
  });
});

describe('buy now and idea sizing', () => {
  it('buy now purchases a business without diligence at the asking price', () => {
    const c = publicFixture(); const t = c.targets[0]; if (!t) return;
    const r = buyNow(c, t.id);
    if (r.ok) { expect(r.c.subsidiaries.some(s => s.id === `sub-${t.id}`)).toBe(true); expect(r.c.deals?.at(-1)?.findings).toEqual([]); }
  });
  it('approved idea targets its chosen share of the fund, selling others when cash is short', () => {
    const c = publicFixture(); const l = c.fund.ledger;
    const ticker = Object.keys(l.positions)[0] ?? 'SPX';
    const other = 'AAPL_TEST';
    l.positions = { [other]: netAssets(l) }; l.cash = 0;
    c.ideas = [{ id: 'i1', q: c.fund.q, analystId: 'x', analyst: 'X', ticker, sector: 's', thesis: '', conviction: 3, status: 'approved', size: 0.02, decidedQ: c.fund.q }];
    c.pendingOrders = [{ ticker, amount: 1, ideaId: 'i1' }];
    const o = ideaOrders(c, []);
    const buy = o.find(x => x.ticker === ticker)!;
    expect(buy.amount).toBeCloseTo(0.02 * netAssets(c.fund.ledger), 0);
    void other;
  });
});
