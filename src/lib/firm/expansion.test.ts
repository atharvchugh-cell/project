import { describe, expect, it } from 'vitest';
import { newCareer, firmCash, forkCareer, parseCareer, type Career, reserveTarget } from './career';
import { closeQuarter, closeIdFor } from './close';
import { addLiability, nav, netAssets, subscribe, settleDue } from '@/lib/fund/accounting';
import { accrueClientFees, managementFee } from '@/lib/fund/clientFees';
import { annualClientRate, enableClientFees, negotiateFee } from './fees';
import { refinanceBusiness, refinanceCheck } from './refinance';
import { businessQuarter, loanSchedule, COVENANT_DSCR } from './business';
import { maxDebt, managerTargets, makeOffer, runDiligence, dealsOf, closeDeal, closeCheck, loanRate } from './deals';
import { managerDebtService, settleManagerLoans, managerDebt } from './managerLoans';
import { coverageMood, clientMood, coverageEdge } from './coverage';
import { expectedContributions } from './phase4';
import { phase5AtClose } from './phase5';
import { cashForecast } from './forecast';
import { quarterEstimate, cashBridge } from './plan';
import { post } from './journal';
import { valuation } from './exit';

const opts = { firmName: 'Disposable', fundName: 'Fixture', hq: 'Boston', philosophy: 'diversified' as const, scenario: 'institutional' as const, years: 10, seed: 777 };
const none = { orders: [], acceptOfferIds: [] };
const advance = (c: Career, n: number) => { for (let i = 0; i < n; i++) c = closeQuarter(c, none); return c; };
const inject = (c: Career, amount: number) => post(c.journal, { q: c.fund.q, date: 'Fixture', payer: 'external', recipient: 'firm', category: 'capital_injection', amount, source: `fixture:${c.journal.seq}`, memo: 'Disposable fixture' });

describe('whole-balance client management fees paid by the fund', () => {
  it('charges 1% annually on $100 invested plus $40 subscribed capital, not just the wire', () => {
    const c = newCareer(opts); const f = c.fund; f.ledger.cash = 100; f.ledger.positions = {}; f.ledger.locked = 0; f.ledger.liabilities = []; f.ledger.units = 1;
    f.investors = [{ id: 'client', name: 'Client', units: 1, relation: 'Fixture', joinedQ: 0, lockupUntilQ: 0, note: '' }];
    f.investors[0].units += subscribe(f.ledger, 40);
    if (!f.clientFees) throw new Error('Missing fee state');
    expect(nav(f.ledger)).toBe(100);
    accrueClientFees(f.ledger, f.investors, f.clientFees, 1);
    expect(f.clientFees.charges[0].base).toBe(140); expect(f.clientFees.charges[0].amount).toBeCloseTo(0.35, 10);
    expect(netAssets(f.ledger)).toBeCloseTo(139.65, 10);
    settleDue(f.ledger, 1); expect(f.ledger.managerCash).toBeCloseTo(0.35, 10);
    expect(f.ledger.cash).toBeCloseTo(139.65, 10);
  });
  it('uses one shared pre-fee mark for different clients and no duplicate shared charge', () => {
    const c = newCareer(opts); const f = c.fund;
    const id = f.investors.find(i => i.id !== 'you')?.id; if (!id || !f.clientFees) throw new Error('Missing client');
    const contract = negotiateFee(c, id, 0.005); expect(contract.ok).toBe(true);
    const n = closeQuarter(contract.c, none); const charges = n.fund.clientFees?.charges.filter(x => x.q === 1) ?? [];
    expect(charges.length).toBe(n.fund.investors.filter(i => i.units > 0).length);
    const customer = charges.find(x => x.investorId === id); expect(customer?.rate).toBe(0.00125);
    const fees = n.fund.ledger.liabilities.filter(x => x.kind === 'mgmt_fee' && x.dueQ === 1);
    expect(fees.reduce((a, x) => a + x.amount, 0)).toBeCloseTo(charges.reduce((a, x) => a + x.amount, 0), 5);
    expect(n.snapshots[0].fees).toBeCloseTo(n.fund.ledger.managerCash, 2);
    expect(n.journal.txns.filter(x => x.category === 'fee_receipt').reduce((a, x) => a + x.amount, 0)).toBeCloseTo(n.fund.ledger.managerCash, 2);
    expect(cashBridge(n, 'firm', 1).reconciles).toBe(true);
  });
  it('defers fees in a shortage, pays once after cash arrives, and never accrues them twice', () => {
    const c = newCareer(opts); const f = c.fund; if (!f.clientFees) throw new Error('Missing fees');
    accrueClientFees(f.ledger, f.investors, f.clientFees, 1); const fees = f.clientFees.charges.reduce((a, x) => a + x.amount, 0);
    f.ledger.cash = 0; settleDue(f.ledger, 1); expect(f.ledger.managerCash).toBe(0);
    accrueClientFees(f.ledger, f.investors, f.clientFees, 1); expect(f.clientFees.charges.reduce((a, x) => a + x.amount, 0)).toBe(fees);
    f.ledger.cash = fees; settleDue(f.ledger, 1); settleDue(f.ledger, 1);
    expect(f.ledger.managerCash).toBeCloseTo(fees, 5);
  });
  it('legacy opt-in changes no NAV, units, liability or accrued fee and practice never mutates its source', () => {
    const c = newCareer(opts); delete c.fund.clientFees;
    addLiability(c.fund.ledger, 'mgmt_fee', 100, 1, 'Earlier fee');
    const raw = JSON.stringify(c); const migrated = enableClientFees(c);
    expect(migrated.fund.ledger).toEqual(c.fund.ledger); expect(JSON.stringify(c)).toBe(raw);
    expect(annualClientRate(migrated, c.fund.investors[1].id)).toBe(0.01);
    const practice = forkCareer(migrated); const changed = negotiateFee(practice, c.fund.investors[1].id, 0.005);
    expect(changed.ok).toBe(true); expect(migrated.fund.clientFees?.contracts).toEqual({});
    expect(parseCareer(JSON.stringify(changed.c))?.practice).toBe(true);
  });
  it('rejects invalid rates and unwarranted premiums', () => {
    const c = newCareer(opts); const id = c.fund.investors[1].id;
    for (const rate of [NaN, Infinity, -1, 0.021, 0.015]) expect(negotiateFee(c, id, rate).ok).toBe(false);
  });
  it('forecast uses negotiated fees at the same projected post-administration mark', () => {
    const c = negotiateFee(newCareer(opts), 'mom', 0.005).c;
    const row = cashForecast(c, 0, 1).rows[0];
    expect(row.fees).toBeCloseTo(managementFee(c.fund.ledger, c.fund.investors, c.fund.clientFees, 1, 5e9 * 0.9998), 5);
    expect(quarterEstimate(c).firmIn.find(x => x.label === 'Fee cash from the fund')?.amount).toBeLessThan(12.5e6);
  });
});

function businessFixture() {
  const c = advance(newCareer(opts), 4); inject(c, 100e6);
  c.subsidiaries.push({ id: 'biz', kind: 'research', name: 'Fixture Research', price: 20e6, revenueQ: 2e6, costQ: 0.8e6, acquiredQ: 0, multiple: 5, loan: { principal: 5e6, balance: 4e6, rateQ: 0.02, amortQ: 5e6 / 12, maturityQ: 12, drawnQ: 0, lastQ: 4, breaches: 0, penalty: 0 } });
  c.entities.push({ id: 'biz', name: 'Fixture Research', kind: 'company', ownerId: 'firm' });
  return c;
}
describe('business refinance payoff and shared loan service', () => {
  it('draws and pays off $4M atomically, changes rate, preserves fund NAV and costs only the transaction fee', () => {
    const c = businessFixture(); const cash = firmCash(c); const nav0 = nav(c.fund.ledger); const value = valuation(c).total;
    const check = refinanceCheck(c, 'biz', 'relationship'); expect(check.ok).toBe(true); expect(check.payoff).toBe(4e6); expect(check.fee).toBe(40e3);
    const r = refinanceBusiness(c, 'biz', 'relationship'); expect(r.ok).toBe(true);
    expect(firmCash(r.c)).toBeCloseTo(cash - 40e3, 5); expect(nav(r.c.fund.ledger)).toBe(nav0);
    expect(valuation(r.c).total).toBeCloseTo(value - 40e3, 5);
    const s = r.c.subsidiaries[0]; expect(s.loan?.rateQ).toBe(0.0175); expect(s.refinances?.[0].old.rateQ).toBe(0.02);
    expect(refinanceBusiness(r.c, 'biz', 'relationship').ok).toBe(false);
    expect(businessQuarter(s, 5).interest).toBe(70e3);
    const next = closeQuarter(r.c, none); const actual = next.subsidiaries[0].history?.at(-1)?.actual;
    expect(actual?.interestPaid).toBeCloseTo(70e3, 5); expect(actual?.principalPaid).toBeCloseTo(4e6 / 12, 5);
  });
  it('refuses an invalid offer, default, arrears, excess leverage, insufficient reserve or low coverage without mutation', () => {
    for (const mode of ['offer', 'default', 'arrears', 'leverage', 'reserve', 'coverage']) {
      const c = businessFixture(); const s = c.subsidiaries[0]; if (!s.loan) throw new Error('No fixture loan');
      if (mode === 'default') s.loan.breaches = 1;
      if (mode === 'arrears') { c.arrears = 20; c.payables.push({ id: 'old', q: 1, amount: 20, label: 'Old cost', kind: 'event', category: 'event_cost' }); }
      if (mode === 'leverage') s.loan.balance = 100e6;
      if (mode === 'reserve') post(c.journal, { q: c.fund.q, date: 'Fixture', payer: 'firm', recipient: 'external', amount: firmCash(c), category: 'event_cost', source: 'drain', memo: 'Fixture' });
      if (mode === 'coverage') s.revenueQ = 0.81e6;
      const raw = JSON.stringify(c); expect(refinanceBusiness(c, 'biz', mode === 'offer' ? 'unknown' : 'relationship').ok).toBe(false); expect(JSON.stringify(c)).toBe(raw);
    }
  });
  it('new maturity balloons and penalty interest follow the same business schedule', () => {
    const c = businessFixture(); const result = refinanceBusiness(c, 'biz', 'extended'); expect(result.ok).toBe(true);
    const loan = result.c.subsidiaries[0].loan; if (!loan) throw new Error('No loan');
    loan.penalty = 0.005;
    const schedule = loanSchedule(loan, 5); expect(schedule.interest).toBe(4e6 * 0.0275);
    expect(loanSchedule({ ...loan, amortQ: 0 }, loan.maturityQ).principal).toBe(4e6);
  });
});

function managerFixture() {
  let c = advance(newCareer(opts), 4); inject(c, 1e9);
  const target = managerTargets(c)[0]; if (!target) throw new Error('No manager');
  c = makeOffer(c, target.id, target.price).c; const deal = dealsOf(c)[0]; if (!deal) throw new Error('No deal');
  c = runDiligence(c, deal.id).c; return { c, dealId: deal.id, target };
}
describe('rival-manager loans', () => {
  it('funds a purchase with firm debt, preserving mandate NAV and reserve, then services the actual facility', () => {
    const { c, dealId } = managerFixture(); const deal = dealsOf(c)[0]; const debt = maxDebt(c, deal) / 3;
    expect(debt).toBeGreaterThan(0); expect(closeCheck(c, dealId, debt).ok).toBe(true);
    expect(closeCheck(c, dealId, maxDebt(c, deal) + 2).ok).toBe(false);
    const p = nav(c.fund.ledger); const r = closeDeal(c, dealId, debt); expect(r.ok).toBe(true);
    expect(nav(r.c.fund.ledger)).toBeCloseTo(p, 8); expect(managerDebt(r.c)).toBe(debt); expect(firmCash(r.c)).toBeGreaterThan(reserveTarget(r.c));
    const rate = loanRate(c);
    const service = managerDebtService(r.c, 5); expect(service).toBeCloseTo(debt * rate + debt / 12, 5);
    const row = cashForecast(r.c, 0, 1).rows[0]; expect(row.managerDebt).toBeCloseTo(service, 5);
    const next = closeQuarter(r.c, none); const history = next.managerFacilities?.[0].history[0];
    expect(history?.principal).toBeCloseTo(debt / 12, 5); expect(history?.interest).toBeCloseTo(debt * rate, 5);
    expect(next.managerFacilities?.[0].loan.balance).toBeCloseTo(debt - debt / 12, 5);
  });
  it('four low-coverage closes transfer fee entitlement, never client units/assets, retain owed bills, and route future fees to lender', () => {
    const { c, dealId } = managerFixture(); const debt = maxDebt(c, dealsOf(c)[0]) / 3;
    const n = closeDeal(c, dealId, debt).c; const facility = n.managerFacilities?.[0]; if (!facility) throw new Error('No facility');
    facility.margin = 0; const ledger = JSON.stringify(n.fund.ledger); const units = n.fund.investors.map(i => i.units);
    for (let q = 5; q <= 8; q++) settleManagerLoans(n, q, closeIdFor(n, q));
    expect(facility.loan.breaches).toBe(4); expect(facility.foreclosedQ).toBe(8); expect(facility.loan.balance).toBe(0);
    expect(JSON.stringify(n.fund.ledger)).toBe(ledger); expect(n.fund.investors.map(i => i.units)).toEqual(units);
    expect(n.fund.clientFees?.contracts[facility.investorId].recipient).toBe('lender');
    const state = n.fund.clientFees; if (!state) throw new Error('No fees');
    accrueClientFees(n.fund.ledger, n.fund.investors, state, 9); settleDue(n.fund.ledger, 9);
    const lender = n.fund.ledger.liabilities.filter(l => l.feeRecipient === 'lender'); expect(lender.length).toBe(1); expect(lender[0].paid).toBe(true);
    expect(managementFee(n.fund.ledger, n.fund.investors, state, 9, 5e9, true)).toBeLessThan(managementFee(n.fund.ledger, n.fund.investors, state, 9, 5e9));
    expect(negotiateFee(n, facility.investorId, 0.005).ok).toBe(false);
    expect(COVENANT_DSCR).toBe(1.2);
  });
});

describe('consequential newspaper without changed historical returns', () => {
  it('seeded coverage repeats exactly, does not mutate fund prices or rival money, and applies only once', () => {
    const c = advance(newCareer(opts), 3); const clone = structuredClone(c);
    expect(c.coverage).toEqual(clone.coverage);
    const before = JSON.stringify(c.fund); const rivals = JSON.stringify(c.rivalAum); const coverage = JSON.stringify(c.coverage);
    phase5AtClose(c, () => 0.2); expect(JSON.stringify(c.coverage)).toBe(coverage); expect(JSON.stringify(c.fund)).toBe(before); expect(JSON.stringify(c.rivalAum)).toBe(rivals);
  });
  it('bounded mood expires and changes conditional contributions and rival pitch advantage, not confidence', () => {
    const c = newCareer(opts); const confidence = c.fund.confidence;
    const base = expectedContributions(c).reduce((a, x) => a + x.amount, 0);
    c.coverage = [{ q: 0, expiresQ: 1, target: 'you', delta: 99, headline: 'Fixture' }, { q: 0, expiresQ: 1, target: 'northgate', delta: -4, headline: 'Fixture rival' }];
    expect(coverageMood(c, 'you')).toBe(12); expect(clientMood(c, 'mom')).toBe(72); expect(coverageEdge(c, 'northgate')).toBe(0.08);
    expect(expectedContributions(c).reduce((a, x) => a + x.amount, 0)).toBeGreaterThan(base);
    c.fund.q = 2; expect(coverageMood(c, 'you')).toBe(0); expect(c.fund.confidence).toBe(confidence);
  });
});