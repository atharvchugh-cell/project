import { describe, it, expect } from 'vitest';
import { newCareer, firmCash, founderCash, parseCareer } from './career';
import { closeQuarter } from './close';
import { netAssets, nav } from '@/lib/fund/accounting';
import { playQuarter, TRADE_COST } from '@/lib/fund/engine';
import { staffServiceQuote, performanceProfile } from './immersion';
import { tradeCareerNow } from './trading';
import { totalOf, post } from './journal';
import { callAllClients } from './clientSessions';
import { buyItem, owned, upkeepQ } from './life';
import { cashForecast } from './forecast';
import { generateTargets } from './phase3';
import { rivalReturn } from './relations';
const opts = { firmName: 'Immersion Test', fundName: 'Fund', hq: 'Boston', scenario: 'institutional' as const, philosophy: 'diversified' as const, seed: 3, years: 10 };
const none = { orders: [], acceptOfferIds: [] };
describe('autonomous staff and performance', () => {
  it('each employee earns a distinct external retainer once at close without changing fund returns', () => {
    const c = newCareer(opts); const quotes = staffServiceQuote(c); const f = playQuarter(c.fund, none); const n = closeQuarter(c, none);
    expect(quotes.length).toBe(c.roster.length);
    expect(quotes.every(x => x.amount > 0)).toBe(true);
    expect(totalOf(n.journal, 'staff_revenue')).toBeCloseTo(quotes.reduce((a, x) => a + x.amount, 0), 2);
    expect(nav(n.fund.ledger)).toBeCloseTo(nav(f.ledger), 9);
    expect(n.journal.txns.filter(x => x.category === 'staff_revenue').every(x => x.payer === 'external')).toBe(true);
    const stale = { ...n, fund: c.fund };
    expect(closeQuarter(stale)).toBe(stale);
  });
  it('ability and morale affect revenue, but raising salary cannot manufacture revenue', () => {
    const c = newCareer(opts); const original = staffServiceQuote(c)[0].amount;
    c.roster[0].salaryQ *= 100;
    expect(staffServiceQuote(c)[0].amount).toBe(original);
    c.roster[0].ability = 20;
    expect(staffServiceQuote(c)[0].amount).toBeLessThan(original);
    c.roster[0].morale = 0;
    expect(staffServiceQuote(c)[0].amount).toBeLessThan(original);
  });
  it('old saves do not opt in or acquire fictitious back earnings', () => {
    const c = newCareer(opts); delete c.immersion;
    const p = parseCareer(JSON.stringify(c));
    expect(p?.immersion).toBeUndefined();
    expect(staffServiceQuote(c)).toEqual([]);
  });
  it('forecast discloses staff revenue separately and matches the quoted amount', () => {
    const c = newCareer(opts); const row = cashForecast(c, 0, 1).rows[0];
    expect(row.staff).toBe(staffServiceQuote(c).reduce((a, x) => a + x.amount, 0));
    expect(row.business).toBe(0);
    expect(row.cash).toBeCloseTo(row.opening + row.fees + row.staff - row.core - row.salary, 2);
  });
  it('greater real S&P outperformance increases demand, prestige and fame, not deposits', () => {
    let c = newCareer(opts); for (let i = 0; i < 4; i++) c = closeQuarter(c, none);
    c.fund.history = c.fund.history.map(x => ({ ...x, ret: 0.03, bench: 0.01, latePayment: false }));
    const modest = performanceProfile(c);
    c.fund.history = c.fund.history.map(x => ({ ...x, ret: 0.08 }));
    const strong = performanceProfile(c);
    expect(strong.demand).toBeGreaterThan(modest.demand);
    expect(strong.prestige).toBeGreaterThan(modest.prestige);
    expect(strong.fame).toBeGreaterThan(modest.fame);
    c.fund.ledger.cash += 1e12;
    expect(performanceProfile(c)).toEqual(strong);
  });
  it('rivals develop stronger completed-quarter returns only in opted-in careers', () => {
    const c = closeQuarter(newCareer(opts), none); const enhanced = rivalReturn(c, 0, 0);
    c.immersion = false;
    expect(enhanced - rivalReturn(c, 0, 0)).toBeCloseTo(0.003, 12);
  });
});
describe('fluid trading and client service', () => {
  it('selected buys and sells execute now without advancing time and with real trading fees', () => {
    const c = newCareer(opts); const q = c.fund.q; const before = c.fund.ledger.cash;
    const bought = tradeCareerNow(c, { ticker: 'SPX', amount: 1e6 });
    expect(bought.fund.q).toBe(q);
    expect(bought.fund.ledger.positions.SPX).toBe(1e6);
    expect(before - bought.fund.ledger.cash).toBeCloseTo(1e6 * (1 + TRADE_COST), 3);
    const sold = tradeCareerNow(bought, { ticker: 'SPX', amount: -5e5 });
    expect(sold.fund.ledger.positions.SPX).toBe(5e5);
    expect(sold.fund.ledger.cash - bought.fund.ledger.cash).toBeCloseTo(5e5 * (1 - TRADE_COST), 3);
    expect(sold.fills?.filter(r => r.timing === 'between').length).toBe(2);
  });
  it('bulk calls lift every active relationship once, with individually logged real wires', () => {
    const c = newCareer(opts); const before = nav(c.fund.ledger);
    const r = callAllClients(c);
    expect(r.count).toBe(c.fund.investors.filter(i => i.id !== 'you' && i.units > 0).length);
    for (const i of c.fund.investors.filter(i => i.id !== 'you')) expect(r.c.satisfaction[i.id]).toBeGreaterThan(c.satisfaction[i.id]);
    expect(callAllClients(r.c).count).toBe(0);
    expect(nav(r.c.fund.ledger)).toBeCloseTo(before, 9);
  });
  it('immediate buys cannot bypass the constitution position cap', () => {
    const c = newCareer(opts);
    c.governance = { constitution: { maxPosition: 0.2, reserveQuarters: 3, payoutShare: 1, service: 'standard', majority: 0.5 }, amendments: [], lastProposalQ: -99, partners: {}, votes: [], politicsQ: -99 };
    const n = tradeCareerNow(c, { ticker: 'MSFT', amount: 4e9 });
    expect(n.fund.ledger.positions.MSFT).toBeLessThanOrEqual(netAssets(c.fund.ledger) * 0.2);
    expect(n.fills?.at(-1)?.note).toContain('position limit');
  });
  it('fully invested funds sell holdings to pay their own fees, never firm payroll', () => {
    const c = newCareer(opts);
    const n = closeQuarter(c, { orders: [{ ticker: 'SPX', amount: 1e12 }], acceptOfferIds: [] });
    expect(n.fund.history[0].forcedSale).toBeGreaterThan(0);
    expect(n.fund.ledger.liabilities.filter(x => x.kind === 'mgmt_fee').every(x => x.paid)).toBe(true);
    expect(n.journal.txns.filter(x => x.category === 'payroll').every(x => x.payer === 'firm')).toBe(true);
    expect(n.fund.overdueQuarters).toBe(0);
  });
  it('a cruise ship costs personal cash only and incurs twenty-one-point-six million quarterly upkeep', () => {
    const c = newCareer(opts); post(c.journal, { q: 0, date: 'Test', payer: 'external', recipient: 'founder', category: 'opening', amount: 2e9, source: 'test', memo: 'Disposable funding' });
    const firm = firmCash(c); const fund = netAssets(c.fund.ledger); const personal = founderCash(c);
    const r = buyItem(c, 'ship-cruise'); expect(r.ok).toBe(true);
    expect(founderCash(r.c)).toBe(personal - 1.2e9);
    expect(firmCash(r.c)).toBe(firm); expect(netAssets(r.c.fund.ledger)).toBe(fund);
    expect(upkeepQ(r.c)).toBe(21.6e6); expect(owned(r.c)[0].itemId).toBe('ship-cruise');
  });
  it('new operating-business opportunities include software, resorts and marinas deterministically', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) { const c = newCareer({ ...opts, seed }); generateTargets(c, 4); for (const t of c.targets) kinds.add(t.kind); }
    expect(kinds.has('fintech')).toBe(true); expect(kinds.has('hospitality')).toBe(true); expect(kinds.has('marina')).toBe(true);
  });
});