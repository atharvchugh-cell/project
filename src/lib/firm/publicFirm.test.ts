import { describe, expect, it } from 'vitest';
import { newCareer, parseCareer, firmCash, founderCash, type Career } from './career';
import { closeQuarter, distribute, maxDistribution } from './close';
import { fileIpo, ipoRange, ownershipOf, priceIpo, sellStake, startRoadshow, valuation } from './exit';
import { borrowPublic, enablePublicFirm, markPublicClose, newPublicBook, publicBuyback, publicDividend, publicIssue, publicQuote, repayPublic, settlePublicDebt, shareProfit, tradePublicShares } from './publicFirm';
import { INITIAL_PUBLIC_SHARES, publicDebt, publicDebtService } from './publicBook';
import { cashForecast } from './forecast';
import { quarterEstimate } from './plan';
import { post } from './journal';
import { reputation } from './life';
import { phase5AtClose } from './phase5';
import { mulberry32 } from '@/lib/fund/market';

export function publicFixture(): Career {
  let c = newCareer({ firmName: 'Public Test', fundName: 'Flagship', hq: 'Boston', scenario: 'institutional', philosophy: 'diversified', years: 20, seed: 3 });
  for (let i = 0; i < 8; i++) c = closeQuarter(c, { orders: [], acceptOfferIds: [] });
  c.fund.history = c.fund.history.map(h => ({ ...h, ret: 0.06, bench: 0.01, latePayment: false }));
  c.satisfaction = Object.fromEntries(c.fund.investors.map(i => [i.id, 90]));
  c.decisions = []; c.roster = []; c.officeQ = 1000; c.founderSalaryQ = 0;
  c.ownership = { ...ownershipOf(c), ipo: { stage: 'roadshow', filedQ: 6, roadshowQ: 7 } };
  return c;
}
function listed() { const r = priceIpo(publicFixture(), 0.2, true); expect(r.ok).toBe(true); return r.c; }
const fundUnchanged = (a: Career, b: Career) => expect(b.fund).toEqual(a.fund);
describe('public management company equity', () => {
  it('primary IPO raises firm cash net of 6% fees, dilutes all owners and does not spend client assets', () => {
    const c = publicFixture(); const range = ipoRange(c); const r = priceIpo(c, 0.2, true);
    expect(r.ok).toBe(true); expect(r.c.publicFirm?.shares).toBe(12_500_000);
    expect(firmCash(r.c) - firmCash(c)).toBeCloseTo(range.mid * 0.25 * 0.94, 1);
    expect(founderCash(r.c)).toBe(founderCash(c)); expect(r.c.ownership?.holders.find(h => h.id === 'founder')?.pct).toBe(0.8);
    expect(r.c.publicFirm?.listingFees).toBeCloseTo(range.mid * 0.25 * 0.06, 2); fundUnchanged(c, r.c);
    expect(priceIpo(r.c, 0.2, true).ok).toBe(false);
  });
  it('secondary IPO pays founder only and preserves ten million outstanding shares', () => {
    const c = publicFixture(); const r = priceIpo(c, 0.2, false);
    expect(r.ok).toBe(true); expect(firmCash(r.c)).toBe(firmCash(c));
    expect(r.c.publicFirm?.shares).toBe(INITIAL_PUBLIC_SHARES);
    expect(founderCash(r.c) - founderCash(c)).toBeCloseTo(ipoRange(c).mid * 0.2 * 0.94, 1); fundUnchanged(c, r.c);
  });
  it('filing costs 0.5% from the firm once and roadshow requires a later quarter', () => {
    const c = publicFixture(); delete c.ownership; const value = valuation(c).total;
    const r = fileIpo(c); expect(r.ok).toBe(true);
    expect(firmCash(c) - firmCash(r.c)).toBeCloseTo(value * 0.005, 2);
    expect(fileIpo(r.c).ok).toBe(false); expect(startRoadshow(r.c).ok).toBe(false);
    fundUnchanged(c, r.c);
    r.c.fund.q++; expect(startRoadshow(r.c).ok).toBe(true);
  });
  it('legacy public activation preserves balances, ownership and history through JSON reload', () => {
    const c = publicFixture(); c.ownership = { ...ownershipOf(c), ipo: { stage: 'listed', filedQ: 6, listedQ: 8, price: 1e8 } };
    const r = enablePublicFirm(c); expect(r.ok).toBe(true);
    expect(r.c.journal).toEqual(c.journal); expect(r.c.ownership).toEqual(c.ownership); fundUnchanged(c, r.c);
    expect(parseCareer(JSON.stringify(r.c))?.publicFirm).toEqual(r.c.publicFirm);
  });
  it('secondary purchased shares retain exact basis, price gains/losses and sale-time realized profit', () => {
    const c = listed(); const buyPrice = publicQuote(c).price;
    const buy = tradePublicShares(c, 'buy', 1000); expect(buy.ok).toBe(true); fundUnchanged(c, buy.c);
    expect(shareProfit(buy.c).basis).toBeCloseTo(1000 * buyPrice, 2); expect(shareProfit(buy.c).unrealized).toBeCloseTo(0, 2);
    const good = structuredClone(buy.c); good.fund.history = good.fund.history.map(h => ({ ...h, ret: 0.12 }));
    const bad = structuredClone(buy.c); bad.fund.history = bad.fund.history.map(h => ({ ...h, ret: -0.05 }));
    expect(shareProfit(good).unrealized).toBeGreaterThan(0); expect(shareProfit(bad).unrealized).toBeLessThan(0);
    expect(tradePublicShares(good, 'sell', 500).ok).toBe(false);
    if (good.ownership?.ipo) good.ownership.ipo.lockupUntilQ = good.fund.q;
    const salePrice = publicQuote(good).price; const sale = tradePublicShares(good, 'sell', 500); expect(sale.ok).toBe(true);
    expect(shareProfit(sale.c).realized).toBeCloseTo(500 * (salePrice - buyPrice), 2);
    expect(shareProfit(sale.c).basis).toBeCloseTo(500 * buyPrice, 2);
    expect(firmCash(sale.c)).toBe(firmCash(good)); fundUnchanged(good, sale.c);
  });
  it('dividends reduce equity by cash paid, pay all owners pro rata and credit purchased-share income', () => {
    const c = tradePublicShares(listed(), 'buy', 1000).c; const value = valuation(c).total; const shares = publicQuote(c).shares;
    const r = publicDividend(c, 100000); expect(r.ok).toBe(true);
    expect(valuation(r.c).total).toBeCloseTo(value - 100000, 1);
    expect(shareProfit(r.c).dividends).toBeCloseTo(100000 / shares * 1000, 6);
    expect(r.c.journal.txns.slice(c.journal.txns.length).reduce((a, t) => a + t.amount, 0)).toBeCloseTo(100000, 2); fundUnchanged(c, r.c);
  });
  it('public buybacks cancel shares, preserve sum of ownership and are per-share neutral at fair value', () => {
    const c = listed(); const before = publicQuote(c); const r = publicBuyback(c, 1000); expect(r.ok).toBe(true);
    expect(publicQuote(r.c).shares).toBe(before.shares - 1000);
    expect(publicQuote(r.c).price).toBeCloseTo(before.price, 7);
    expect(r.c.ownership?.holders.reduce((a, h) => a + h.pct, 0)).toBeCloseTo(1, 12); fundUnchanged(c, r.c);
  });
  it('new equity issues increase firm cash net of fees, dilute owners and preserve purchased lots', () => {
    const c = tradePublicShares(listed(), 'buy', 1000).c; const r = publicIssue(c, 1e6); expect(r.ok).toBe(true);
    const gross = r.c.publicFirm?.primaryRaised ?? 0;
    expect(firmCash(r.c) - firmCash(c)).toBeCloseTo((gross - (c.publicFirm?.primaryRaised ?? 0)) * 0.94, 1);
    expect(r.c.publicFirm?.personal).toEqual(c.publicFirm?.personal);
    expect(r.c.ownership?.holders.reduce((a, h) => a + h.pct, 0)).toBeCloseTo(1, 12);
    expect(publicQuote(r.c).shares).toBeGreaterThan(publicQuote(c).shares); fundUnchanged(c, r.c);
  });
  it('corporate loan draw and principal repayment remain equity neutral and restrict all payouts', () => {
    const c = listed(); const value = valuation(c).total; const loan = borrowPublic(c, 1e6); expect(loan.ok).toBe(true);
    expect(publicDebt(loan.c)).toBe(1e6); expect(valuation(loan.c).total).toBeCloseTo(value, 2);
    expect(publicDebtService(loan.c, c.fund.q + 1)).toBeCloseTo(20000 + 1e6 / 12, 5);
    expect(publicDividend(loan.c, 1).ok).toBe(false); expect(publicBuyback(loan.c, 1).ok).toBe(false);
    expect(maxDistribution(loan.c)).toBe(0); expect(distribute(loan.c, 1e6)).toBe(loan.c);
    const pay = repayPublic(loan.c, 1e6); expect(pay.ok).toBe(true); expect(valuation(pay.c).total).toBeCloseTo(value, 2); fundUnchanged(c, pay.c);
  });
  it('public debt estimates and forecast agree with the shared schedule', () => {
    const c = borrowPublic(listed(), 1e6).c; const service = publicDebtService(c, c.fund.q + 1);
    expect(cashForecast(c, 0, 1).rows[0].managerDebt).toBeCloseTo(service, 5);
    expect(quarterEstimate(c).firmOut.find(x => x.label === 'Public corporate interest and principal')?.amount).toBeCloseTo(service, 5);
  });
  it('corporate interest settles once; unpaid debt remains owed with penalties and no fund seizure', () => {
    const c = borrowPublic(listed(), 1e6).c; const before = structuredClone(c.fund);
    post(c.journal, { q: c.fund.q, date: 'Test', payer: 'firm', recipient: 'external', category: 'acquisition', amount: firmCash(c), source: 'drain-test', memo: 'Disposable fixture' });
    const first = c.fund.q + 1; const owed = settlePublicDebt(c, first, `${c.id}:Q${first}`);
    expect(owed).toBeCloseTo(20000 + 1e6 / 12, 2); expect(c.arrears).toBeCloseTo(owed, 2);
    expect(publicDebt(c) + c.arrears).toBeCloseTo(1e6 + 20000, 2);
    expect(settlePublicDebt(c, first, `${c.id}:Q${first}`)).toBe(0);
    settlePublicDebt(c, first + 1, `${c.id}:Q${first + 1}`);
    expect(c.publicFirm?.loans[0].loan.penalty).toBe(0.005); expect(c.fund).toEqual(before);
    settlePublicDebt(c, first + 2, `${c.id}:Q${first + 2}`);
    settlePublicDebt(c, first + 3, `${c.id}:Q${first + 3}`);
    expect(c.publicFirm?.loans[0].restricted).toBe(true);
    expect(publicIssue(c, 100000).ok).toBe(false);
  });
  it('public coverage is deterministic, affects price and reputation, and records one actual closing mark', () => {
    const c = listed(); c.press = []; const n = structuredClone(c);
    phase5AtClose(c, mulberry32(111)); phase5AtClose(n, mulberry32(111));
    expect(c.publicFirm?.sentiment).toBe(n.publicFirm?.sentiment);
    const bad = structuredClone(c); if (bad.publicFirm) bad.publicFirm.sentiment = -10;
    const good = structuredClone(c); if (good.publicFirm) good.publicFirm.sentiment = 10;
    expect(publicQuote(good).price).toBeGreaterThan(publicQuote(bad).price); expect(reputation(good).score).toBeGreaterThan(reputation(bad).score);
    const fund = structuredClone(c.fund); markPublicClose(c); markPublicClose(c);
    expect(c.publicFirm?.history).toHaveLength(1); expect(c.press.at(-1)?.stories.filter(s => s.kind === 'public')).toHaveLength(1); expect(c.fund).toEqual(fund);
  });
  it('real quarter close persists public price/debt/news exactly once and survives reload', () => {
    const c = borrowPublic(listed(), 1e6).c; const n = closeQuarter(c, { orders: [], acceptOfferIds: [] });
    expect(n.publicFirm?.history.at(-1)?.price).toBeCloseTo(publicQuote(n).price, 9);
    expect(n.publicFirm?.loans[0].history).toHaveLength(1);
    expect(n.press.at(-1)?.stories.some(s => s.kind === 'public')).toBe(true);
    const loaded = parseCareer(JSON.stringify(n)); expect(loaded?.publicFirm).toEqual(n.publicFirm);
  });
  it('rejects invalid amounts, excessive float/shares, ended careers and unaffordable trades without mutation', () => {
    const c = listed(); const before = JSON.stringify(c);
    for (const amount of [NaN, Infinity, -1, 0]) for (const action of [publicDividend, publicIssue, borrowPublic, repayPublic]) expect(action(c, amount).ok).toBe(false);
    expect(publicBuyback(c, 1.5).ok).toBe(false); expect(tradePublicShares(c, 'buy', 1e12).ok).toBe(false);
    expect(tradePublicShares(c, 'sell', 1).ok).toBe(false);
    expect(JSON.stringify(c)).toBe(before); c.status = 'ended'; expect(publicDividend(c, 1).ok).toBe(false);
  });
  it('preserves public control-sale endings and releases purchased basis with net sale proceeds', () => {
    const c = tradePublicShares(listed(), 'buy', 1000).c;
    if (c.ownership?.ipo) c.ownership.ipo.lockupUntilQ = c.fund.q;
    const price = publicQuote(c).price; const basis = shareProfit(c).basis;
    const r = sellStake(c, 1); expect(r.ok).toBe(true); expect(r.c.ending?.kind).toBe('sold');
    expect(shareProfit(r.c).shares).toBe(0); expect(shareProfit(r.c).basis).toBe(0);
    expect(shareProfit(r.c).realized).toBeCloseTo(price * 1000 * 0.97 - basis, 2); fundUnchanged(c, r.c);
  });
});