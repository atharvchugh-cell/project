// Wealth phase: personal purchases/upkeep/resale/insolvency, life actions and cooldowns, office,
// staff research for every role, delegated sleeves, partner dilution, sale/IPO/retirement guards,
// forecast what-ifs, old saves and practice branches.
import { describe, expect, it } from 'vitest';
import { netAssets } from '@/lib/fund/accounting';
import { type Career, firmCash, founderCash, founderStake, forkCareer, newCareer, parseCareer, saveCareer } from './career';
import { closeQuarter, distribute, maxDistribution } from './close';
import { balance, post } from './journal';
import { assign } from './phase2';
import { cashForecast } from './forecast';
import { bridges } from './plan';
import { CATALOG, OFFICE_TIERS, assetsValue, buyItem, lifeAction, lifeOf, moveOffice, netWorth, perks, personalOwed, resaleValue, sellItem, timeLeft, upkeepQ } from './life';
import { reserveTarget } from './career';
import { MAX_DELEGATED, delegateIdea, researchRate, setMandate, trackRecord, train } from './staff';
import { acceptPartner, fileIpo, founderEquityValue, founderPct, partnerOffer, priceIpo, retire, sellStake, startRoadshow, successors, valuation } from './exit';

const opts = { firmName: 'Harbor Hill', fundName: 'Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed: 3 };
const none = { orders: [], acceptOfferIds: [] };
const closeN = (c: Career, k: number) => { for (let i = 0; i < k; i++) c = closeQuarter(c, none); return c; };
const give = (c: Career, amt: number) => post(c.journal, { q: c.fund.q, date: 'test', payer: 'external', recipient: 'founder', category: 'opening', amount: amt, source: `test:${c.journal.seq}`, memo: 'test' });

describe('personal purchases', () => {
  it('are paid only from personal cash, never firm or fund money', () => {
    const c = newCareer(opts); const firm = firmCash(c); const aum = netAssets(c.fund.ledger);
    const r = buyItem(c, 'car-gt');
    expect(r.ok).toBe(true);
    expect(founderCash(r.c)).toBeCloseTo(founderCash(c) - 320e3, 2);
    expect(firmCash(r.c)).toBe(firm);
    expect(netAssets(r.c.fund.ledger)).toBe(aum);
  });
  it('blocks a purchase the founder cannot afford and changes nothing', () => {
    const c = newCareer(opts); const r = buyItem(c, 'island-resort');
    expect(r.ok).toBe(false); expect(r.c).toBe(c); expect(r.message).toMatch(/personal cash; this costs/);
  });
  it('cannot own two of the same item, and perks never stack', () => {
    let c = newCareer(opts); give(c, 100e6);
    c = buyItem(c, 'jet-light').c;
    expect(buyItem(c, 'jet-light').ok).toBe(false);
    c = buyItem(c, 'jet-large').c;
    expect(perks(c).travel).toBe(1);
    expect(timeLeft(c)).toBe(3);
  });
  it('resale in the purchase quarter always returns less than the price (no buy-and-flip profit)', () => {
    let c = newCareer(opts); give(c, 400e6);
    for (const it of CATALOG) { const r = buyItem(c, it.id); if (!r.ok) continue; c = r.c; const p = lifeOf(c).possessions.at(-1)!; expect(resaleValue(p, c.fund.q)).toBeLessThan(it.price); }
    const before = founderCash(c); const p = lifeOf(c).possessions.find(x => x.itemId === 'car-gt')!;
    const s = sellItem(c, p.id);
    expect(founderCash(s.c) - before).toBeCloseTo(320e3 * 0.9, 0);
    expect(sellItem(s.c, p.id).ok).toBe(false);
  });
  it('charges upkeep at each close and keeps unpaid upkeep owed, then forces a sale after two short quarters', () => {
    let c = newCareer(opts); give(c, 70e6);
    c = buyItem(c, 'jet-large').c; // 65M, upkeep 2.275M a quarter
    c.founderSalaryQ = 0;
    const drain = founderCash(c); post(c.journal, { q: c.fund.q, date: 'test', payer: 'founder', recipient: 'external', category: 'life_cost', amount: drain, source: 'test:drain', memo: 'test' });
    expect(upkeepQ(c)).toBeCloseTo(65e6 * 0.035, 0);
    c = closeQuarter(c, none);
    expect(personalOwed(c)).toBeGreaterThan(2e6);
    expect(balance(c.journal, 'founder')).toBeGreaterThanOrEqual(-0.01);
    c = closeQuarter(c, none);
    const jet = lifeOf(c).possessions.find(p => p.itemId === 'jet-large')!;
    expect(jet.forced).toBe(true);
    expect(personalOwed(c)).toBe(0);
  });
  it('net worth reconciles: cash + possessions + stake + equity − debts', () => {
    let c = newCareer(opts); c = buyItem(c, 'home-flat').c;
    const eq = founderEquityValue(c); const n = netWorth(c, eq, founderStake(c));
    expect(n.total).toBeCloseTo(founderCash(c) + assetsValue(c) + founderStake(c) + eq - personalOwed(c), 4);
  });
});

describe('life actions', () => {
  it('spend time points and respect cooldowns', () => {
    let c = newCareer(opts);
    const r = lifeAction(c, 'study'); expect(r.ok).toBe(true); c = r.c;
    expect(timeLeft(c)).toBe(1);
    expect(lifeAction(c, 'study').ok).toBe(false);
    c = lifeAction(c, 'family', 'partner').c;
    expect(timeLeft(c)).toBe(0);
    expect(lifeAction(c, 'network').ok).toBe(false);
    c = closeQuarter(c, none);
    expect(timeLeft(c)).toBeGreaterThan(0);
  });
  it('hosting needs a venue', () => {
    const c = newCareer(opts); expect(lifeAction(c, 'host').ok).toBe(false);
  });
});

describe('office', () => {
  it('an upgrade pays fit-out from firm cash, raises rent and capacity, and keeps the reserve', () => {
    const c = newCareer(opts); const r = moveOffice(c, 1, reserveTarget, firmCash(c));
    expect(r.ok).toBe(true);
    expect(firmCash(c) - firmCash(r.c)).toBeCloseTo(c.officeQ * OFFICE_TIERS[1].fitOut, 0);
    expect(r.c.officeQ).toBe(Math.round(c.officeQ * OFFICE_TIERS[1].rent));
    expect(r.c.capacity).toBe(14);
    expect(firmCash(r.c)).toBeGreaterThanOrEqual(reserveTarget(r.c));
    expect(moveOffice(r.c, 2, reserveTarget, firmCash(r.c)).ok).toBe(false); // lease cooldown
  });
  it('raises research speed by the stated bounded amount', () => {
    const c = newCareer(opts); const e = c.roster[0];
    const up = moveOffice(c, 1, reserveTarget, firmCash(c)).c;
    expect(researchRate(up, up.roster[0]) / researchRate(c, e)).toBeCloseTo(1.05, 5);
  });
});

describe('staff research and delegation', () => {
  it('every role can research; specialists at half speed', () => {
    const c = newCareer(opts); const coo = c.roster[0];
    const a = assign(c, coo.id, 'Technology');
    expect(a.roster[0].assignment).toBe('Technology');
    const pm = c.roster.find(e => /Portfolio manager/.test(e.role))!;
    const same = { ...coo, ability: pm.ability, morale: pm.morale };
    expect(researchRate(c, same) / researchRate(c, pm)).toBeCloseTo(0.5, 5);
  });
  it('training costs firm cash, grows ability only to potential, and has a cooldown', () => {
    const c = newCareer(opts); const e = c.roster[0];
    const r = train(c, e.id);
    expect(firmCash(c) - firmCash(r.c)).toBeCloseTo(Math.round(e.salaryQ * 0.15), 0);
    expect(r.c.roster[0].ability).toBeLessThanOrEqual(e.potential);
    expect(train(r.c, e.id).ok).toBe(false);
  });
  it('a delegated sleeve is capped at 15% of the fund and creates ordinary pending orders, never separate money', () => {
    let c = newCareer(opts); const aum = netAssets(c.fund.ledger); const e = c.roster.find(x => /Portfolio manager/.test(x.role))!;
    c = setMandate(c, e.id, { budget: aum, maxPosition: 0.02, minConviction: 1 });
    expect(c.roster.find(x => x.id === e.id)!.mandate!.budget).toBeCloseTo(aum * MAX_DELEGATED, 0);
    const n: Career = structuredClone(c);
    const idea = { id: 'idea-t', q: 0, analystId: e.id, analyst: e.name, ticker: 'MSFT', sector: 'Technology', thesis: 't', conviction: 4, status: 'pending' as const };
    n.ideas.push(idea);
    const amt = delegateIdea(n, n.roster.find(x => x.id === e.id)!, n.ideas.at(-1)!);
    expect(amt).toBeCloseTo(aum * 0.02, 0);
    expect(n.pendingOrders.at(-1)).toMatchObject({ ticker: 'MSFT', ideaId: 'idea-t' });
    expect(netAssets(n.fund.ledger)).toBe(aum);
    // Filled amounts come from the engine's actual buy at the close, at most what was proposed.
    const after = closeQuarter(n, none);
    const x = after.ideas.find(i => i.id === 'idea-t')!;
    expect(x.filled).toBeGreaterThanOrEqual(0);
    expect(x.filled!).toBeLessThanOrEqual(amt + 0.01);
    // P&L is the actual attributed holding (realized + unrealized after costs), never the hypothetical review.
    const tr = trackRecord(after, e.id);
    expect(tr.pnl).toBeCloseTo(tr.realized + tr.unrealized, 2);
    expect(tr.value).toBeLessThanOrEqual((after.fund.ledger.positions.MSFT ?? 0) + 0.01);
  });
});

describe('ownership and endings', () => {
  it('a partner buy-in adds cash to the firm and dilutes; distributions split by ownership and never exceed 100%', () => {
    let c = closeN(newCareer(opts), 5);
    const off = partnerOffer(c); expect(off).not.toBeNull();
    const firm = firmCash(c);
    c = acceptPartner(c).c;
    expect(firmCash(c) - firm).toBeCloseTo(off!.price, 0);
    expect(founderPct(c)).toBeCloseTo(1 - off!.pct, 6);
    expect(c.ownership!.holders.reduce((a, h) => a + h.pct, 0)).toBeCloseTo(1, 9);
    expect(partnerOffer(c)).toBeNull(); // one a year
    const max = maxDistribution(c); const me = founderCash(c);
    const d = distribute(c, max);
    expect(founderCash(d) - me).toBeCloseTo(max * founderPct(c), 0);
    expect(firmCash(c) - firmCash(d)).toBeCloseTo(max, 0);
  });
  it('selling the whole firm pays the founder once, ends the career, and never touches the fund', () => {
    const c = closeN(newCareer(opts), 4);
    const v = valuation(c).total; const aum = netAssets(c.fund.ledger); const me = founderCash(c);
    const r = sellStake(c, 1);
    expect(r.ok).toBe(true);
    expect(founderCash(r.c) - me).toBeCloseTo(v * 0.97, 0);
    expect(netAssets(r.c.fund.ledger)).toBe(aum);
    expect(r.c.status).toBe('ended'); expect(r.c.ending?.kind).toBe('sold');
    expect(sellStake(r.c, 1).ok).toBe(false);
    expect(closeQuarter(r.c, none)).toBe(r.c);
  });
  it('a partial sale lowers the founder stake so the same equity cannot be sold twice', () => {
    const c = closeN(newCareer(opts), 4);
    const a = sellStake(c, 0.5).c; expect(founderPct(a)).toBeCloseTo(0.5, 9);
    const b = sellStake(a, 1).c; expect(founderPct(b)).toBe(0);
    expect(b.ownership!.holders.reduce((s, h) => s + h.pct, 0)).toBeCloseTo(1, 9);
  });
  it('an IPO needs filing then a later quarter, and locks up the remaining stake', () => {
    let c = closeN(newCareer(opts), 8);
    c.fund.history = c.fund.history.map(h => ({ ...h, ret: 0.04, bench: 0.0 }));
    const f = fileIpo(c);
    expect(f.message).not.toMatch(/want|cannot/); expect(f.ok).toBe(true);
    expect(priceIpo(f.c).ok).toBe(false);
    expect(startRoadshow(f.c).ok).toBe(false); // regulators need a quarter
    const later = closeQuarter(f.c, none);
    expect(priceIpo(later).ok).toBe(false); // roadshow first
    const rs = startRoadshow(later); expect(rs.ok).toBe(true);
    expect(startRoadshow(rs.c).ok).toBe(false);
    const listing = closeQuarter(rs.c, none);
    for (const bad of [0, -0.1, NaN, Infinity, 0.9]) expect(priceIpo(listing, bad).ok).toBe(false);
    const p = priceIpo(listing);
    expect(p.ok).toBe(true);
    expect(founderPct(p.c)).toBeCloseTo(0.8, 9);
    expect(sellStake(p.c, 1).ok).toBe(false);
    expect(priceIpo(p.c).ok).toBe(false);
    expect(p.c.ownership!.ipo!.lockupUntilQ).toBe(listing.fund.q + 4);
    expect(p.c.ownership!.holders.reduce((a, h) => a + h.pct, 0)).toBeCloseTo(1, 9);
  });
  it('retirement needs a qualified successor and ends once', () => {
    const c = closeN(newCareer(opts), 2);
    const s = successors(c)[0]; expect(s).toBeDefined();
    const r = retire(c, s.id);
    expect(r.c.status).toBe('ended'); expect(r.c.ending?.kind).toBe('retired');
    expect(retire(r.c, s.id).ok).toBe(false);
  });
});

describe('forecast what-ifs and books', () => {
  it('a previewed extra cost lowers projected cash by exactly that cost each quarter while cash lasts', () => {
    const c = newCareer(opts);
    const a = cashForecast(c, 0, 4); const b = cashForecast(c, 0, 4, { extraCostQ: 1e6 });
    expect(a.rows[3].cash - b.rows[3].cash).toBeCloseTo(4e6, 0);
    const o = cashForecast(c, 0, 4, { oneTime: 2e6 });
    expect(a.rows[0].cash - o.rows[0].cash).toBeCloseTo(2e6, 0);
    expect(a.rows[0].opening).toBeCloseTo(firmCash(c), 2);
  });
  it('firm and personal bridges still reconcile with purchases, upkeep and partners', () => {
    let c = newCareer(opts); c = buyItem(c, 'home-flat').c; c = closeN(c, 5);
    const off = partnerOffer(c); if (off) c = acceptPartner(c).c;
    c = distribute(c, maxDistribution(c) / 2);
    c = closeN(c, 1);
    expect(bridges(c, 'firm').every(b => b.reconciles)).toBe(true);
    expect(bridges(c, 'founder').every(b => b.reconciles)).toBe(true);
  });
});

describe('saves and branches', () => {
  it('an older save without the wealth fields loads with them and keeps balances', () => {
    const c = closeN(newCareer(opts), 2);
    const raw = JSON.parse(JSON.stringify(c)); delete raw.life; delete raw.ownership; delete raw.ending;
    const back = parseCareer(JSON.stringify(raw))!;
    expect(back.life).toBeDefined(); expect(founderPct(back)).toBe(1);
    expect(founderCash(back)).toBeCloseTo(founderCash(c), 6); expect(firmCash(back)).toBeCloseTo(firmCash(c), 6);
    expect(closeQuarter(back, none).fund.q).toBe(3);
  });
  it('practice branches never save and do not change the live career', () => {
    const c = newCareer(opts); const b = buyItem(forkCareer(c), 'car-sedan').c;
    const store = { setItem: () => { throw new Error('should not save'); }, removeItem: () => {} };
    expect(saveCareer(b, store).ok).toBe(true);
    expect(lifeOf(c).possessions.length).toBe(0);
  });
});
