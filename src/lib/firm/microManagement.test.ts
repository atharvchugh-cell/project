import { describe, expect, it } from 'vitest';
import { newCareer, firmCash, parseCareer } from './career';
import { closeQuarter } from './close';
import { bookAllSessions, sessionQuote } from './clientSessions';
import { companyCash, setLever, businessQuarter } from './business';
import { post } from './journal';
import { nav } from '@/lib/fund/accounting';
import { newsYear, newsQuarter, enableNews, newsSector } from '@/lib/fund/news';
import { marketFor, playQuarter } from '@/lib/fund/engine';
import { COMPANY, annualReturn } from '@/lib/fund/market';
import { stockQuarters } from '@/lib/fund/calendar';

const opts = { firmName: 'Disposable', fundName: 'Fixture', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed: 777 };
const none = { orders: [], acceptOfferIds: [] };
describe('delegated all-client sessions', () => {
  it('services all eligible clients for $5,000 each, pays firm cash only and cannot repeat or bypass meeting cooldowns', () => {
    const c = newCareer(opts); const q = sessionQuote(c); expect(q.reason).toBeNull();
    const raw = JSON.stringify(c); const r = bookAllSessions(c); expect(r.ok).toBe(true);
    expect(firmCash(c) - firmCash(r.c)).toBe(q.clients.length * 5000);
    expect(r.c.fund.ledger).toEqual(c.fund.ledger);
    for (const i of q.clients) { expect(r.c.satisfaction[i.id]).toBe(60 + q.bump); expect(r.c.clients?.[i.id].meetingCooldown.review).toBe(2); }
    expect(bookAllSessions(r.c).ok).toBe(false); expect(JSON.stringify(c)).toBe(raw);
    const later = closeQuarter(r.c, none); expect(sessionQuote(later).clients.length).toBeLessThanOrEqual(later.fund.investors.length - q.clients.length);
    const restored = parseCareer(JSON.stringify(r.c)); if (!restored) throw new Error('No save'); expect(bookAllSessions(restored).ok).toBe(false);
  });
  it('refuses missing staff, ended careers and unaffordable costs without changing relationships', () => {
    for (const mode of ['staff', 'cash', 'ended']) {
      const c = newCareer(opts);
      if (mode === 'staff') c.roster = [];
      if (mode === 'ended') c.status = 'ended';
      if (mode === 'cash') post(c.journal, { q: 0, date: 'Fixture', payer: 'firm', recipient: 'external', category: 'event_cost', amount: firmCash(c), source: 'drain', memo: 'Fixture' });
      const raw = JSON.stringify(c); expect(bookAllSessions(c).ok).toBe(false); expect(JSON.stringify(c)).toBe(raw);
    }
  });
});
describe('owned-company cash growth and expenses', () => {
  it('100% retention accumulates actual operating surplus, expenses and principal remain paid, and fund NAV is not company profit', () => {
    let c = newCareer(opts);
    c.subsidiaries.push({ id: 'biz', kind: 'research', name: 'Fixture Company', price: 20e6, revenueQ: 2e6, costQ: 0.8e6, acquiredQ: 0, multiple: 5 });
    c.entities.push({ id: 'biz', name: 'Fixture Company', kind: 'company', ownerId: 'firm' });
    c = setLever(c, 'biz', 'retain', 1).c;
    for (let q = 1; q <= 3; q++) c = closeQuarter(c, none);
    const s = c.subsidiaries[0]; const history = s.history ?? [];
    expect(history.map(h => h.interest)).toEqual([0, 0, 0]);
    expect(companyCash(c, 'biz')).toBeCloseTo(history.reduce((a, h) => a + h.revenue - h.cost, 0), 2);
    expect(companyCash(c, 'biz')).toBeCloseTo(1.6e6, 2);
    expect(history.every(h => h.actual?.costOwed === 0 && h.actual?.toFirm === 0)).toBe(true);
    const p = nav(c.fund.ledger); const before = companyCash(c, 'biz');
    const r = setLever(c, 'biz', 'capacity', 1); expect(r.ok).toBe(true); expect(nav(r.c.fund.ledger)).toBe(p); expect(companyCash(r.c, 'biz')).toBe(before);
    expect(businessQuarter(r.c.subsidiaries[0], 4).cost).toBeCloseTo(0.92e6, 2);
    expect(setLever(c, 'biz', 'retain', 1.1).ok).toBe(false);
  });
});
describe('full quarterly news with ticker annual endpoints', () => {
  it('generates 12 sector events every quarter with signed sentiment and zero annual log shock', () => {
    const tape = newsYear(2000); expect(tape).toEqual(newsYear(2000));
    for (let q = 1; q <= 4; q++) expect(newsQuarter(2000, q).length).toBe(12);
    for (const sector of new Set(tape.map(x => x.sector))) expect(tape.filter(x => x.sector === sector).reduce((a, x) => a + x.logImpact, 0)).toBeCloseTo(0, 12);
    expect(newsSector('AKAM')).toBe('Technology');
  });
  it('changes quarterly prices for every listed ticker while exactly preserving all source annual returns', () => {
    let count = 0;
    for (const company of Object.values(COMPANY)) for (const yr of Object.keys(company.returns)) {
      const year = Number(yr); const annual = annualReturn(company.ticker, year); if (annual === undefined) continue;
      const quarters = stockQuarters(company.ticker, year, true); if (!quarters) throw new Error('No listed path');
      expect(quarters.reduce((a, x) => a * (1 + x), 1) - 1).toBeCloseTo(annual, 10); count++;
    }
    expect(count).toBe(4955);
    expect(stockQuarters('AKAM', 2000, true)).not.toEqual(stockQuarters('AKAM', 2000));
    expect(stockQuarters('AKAM', 2000, true)?.reduce((a, x) => a * (1 + x), 1)).toBeCloseTo(2.5852, 10);
  });
  it('new careers opt in; existing saves preserve current year and all prior returns until explicit next-year activation', () => {
    const c = newCareer(opts); delete c.fund.newsFromYear; c.fund.q = 2;
    const old = marketFor(c.fund); const raw = JSON.stringify(c); const n = enableNews(c);
    expect(n.fund.newsFromYear).toBe(c.fund.startYear + 1);
    expect(marketFor(n.fund).slice(0, 4)).toEqual(old.slice(0, 4)); expect(JSON.stringify(c)).toBe(raw);
    expect(marketFor(n.fund).slice(4, 8)).not.toEqual(old.slice(4, 8));
    expect(newCareer(opts).fund.newsFromYear).toBe(newCareer(opts).fund.startYear);
  });
  it('publishes only completed-quarter ticker reactions with the same prices the engine used', () => {
    const c = closeQuarter(newCareer(opts), none); const ed = c.press[0];
    for (const row of ed.stocks ?? []) expect(row.ret).toBe(marketFor(c.fund)[0].returns[row.ticker]);
    expect(ed.stocks?.length).toBe(Object.keys(marketFor(c.fund)[0].returns).length - 1);
    expect(c.press.every(e => e.q <= c.fund.q)).toBe(true);
  });
  it('the actual fund execution grows untouched Akamai holdings by 158.52% in 2000, not the benchmark return', () => {
    let f = newCareer(opts).fund;
    f.startYear = 2000; f.newsFromYear = 2000; f.years = 1; f.quarters = 4;
    f.ledger.positions = { AKAM: 1e6 }; f.ledger.cash = 4e9; f.ledger.locked = 0;
    f.basis = { AKAM: 1e6 }; f.schedule = [];
    for (let q = 1; q <= 4; q++) f = playQuarter(f, none);
    expect(f.ledger.positions.AKAM).toBeCloseTo(2585200, 4);
    expect(f.pnl.AKAM).toBeCloseTo(1585200, 4);
    expect(f.benchIndex).not.toBeCloseTo(2.5852, 4);
  });
});