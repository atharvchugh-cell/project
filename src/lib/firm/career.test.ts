import { describe, expect, it } from 'vitest';
import { newFund, playQuarter, payInvestorsNow } from '@/lib/fund/engine';
import { nav, netAssets, subscribe } from '@/lib/fund/accounting';
import { SCENARIOS, careerFromLegacy, firmCash, forkCareer, founderCash, founderStake, newCareer, quarterlyExpenses, type Scenario } from './career';
import { applyFundAction, closeQuarter, distribute, maxDistribution, resolveDecision } from './close';
import { balance, totalOf } from './journal';
import { payroll } from './roster';

const opts = (scenario: Scenario = 'institutional') => ({ firmName: 'Harbor Hill', fundName: 'Harbor Hill Flagship', hq: 'Boston', philosophy: 'diversified' as const, scenario, years: 10, seed: 4242 });
const none = { orders: [], acceptOfferIds: [] };
const fees = (c: ReturnType<typeof newCareer>) => totalOf(c.journal, 'fee_receipt');

describe('firm career opening finances', () => {
  for (const sc of ['institutional', 'distressed', 'boutique'] as Scenario[]) {
    it(`${sc}: opening balances match the scenario and the founder stake is not spendable`, () => {
      const c = newCareer(opts(sc)); const def = SCENARIOS[sc];
      expect(netAssets(c.fund.ledger)).toBeCloseTo(def.fundSize, -3);
      expect(founderStake(c)).toBeCloseTo(def.founderStake, -2);
      expect(firmCash(c)).toBe(def.firmCash);
      expect(founderCash(c)).toBe(def.founderCash);
      expect(firmCash(c) / quarterlyExpenses(c)).toBeGreaterThanOrEqual(6);
      expect(c.journal.txns.every(t => t.memo.length > 0)).toBe(true);
    });
  }
});

describe('firm career ledger', () => {
  it('subscriptions increase AUM without changing NAV per unit', () => {
    const f = newFund('normal', 1, 10, false, true); const before = nav(f.ledger); const aum = netAssets(f.ledger);
    subscribe(f.ledger, 1e9);
    expect(nav(f.ledger)).toBeCloseTo(before, 9);
    expect(netAssets(f.ledger)).toBeCloseTo(aum + 1e9, 0);
  });

  it('fee cash reaches the firm exactly once and matches what the fund paid', () => {
    let c = newCareer(opts());
    for (let i = 0; i < 4; i++) c = closeQuarter(c, none);
    expect(fees(c)).toBeCloseTo(c.fund.ledger.managerCash, 1);
    const again = applyFundAction(c, c.fund, 'noop');
    expect(fees(again)).toBeCloseTo(fees(c), 6);
  });

  it('fees paid between quarters by Pay investors now are also posted once', () => {
    let c = newCareer(opts());
    c = closeQuarter(c, { orders: [{ ticker: 'SPX', amount: 4.9e9 }], acceptOfferIds: [] });
    const paid = applyFundAction(c, payInvestorsNow(c.fund), 'pay-now');
    expect(fees(paid)).toBeCloseTo(paid.fund.ledger.managerCash, 1);
  });

  it('payroll, office and founder salary hit the firm and founder books, not the fund', () => {
    const c0 = newCareer(opts());
    const plainFund = playQuarter(c0.fund, none);
    const c1 = closeQuarter(c0, none);
    expect(nav(c1.fund.ledger)).toBeCloseTo(nav(plainFund.ledger), 9);
    expect(totalOf(c1.journal, 'payroll')).toBeCloseTo(payroll(c0.roster), 2);
    expect(totalOf(c1.journal, 'office')).toBe(c0.officeQ);
    expect(founderCash(c1)).toBe(founderCash(c0) + c0.founderSalaryQ);
    expect(firmCash(c1)).toBeCloseTo(firmCash(c0) + fees(c1) + totalOf(c1.journal, 'staff_revenue') - payroll(c0.roster) - c0.officeQ - c0.founderSalaryQ, 1);
  });

  it('closing the same quarter twice does nothing', () => {
    const c0 = newCareer(opts());
    const c1 = closeQuarter(c0, none);
    const stale = { ...c1, fund: c0.fund };
    const c2 = closeQuarter(stale, none);
    expect(c2).toBe(stale);
    expect(c1.journal.closed).toHaveLength(1);
  });

  it('a fully invested fund still meets affordable payments', () => {
    let c = newCareer(opts());
    c = closeQuarter(c, { orders: [{ ticker: 'SPX', amount: 1e12 }], acceptOfferIds: [] });
    for (let i = 0; i < 6; i++) c = closeQuarter(c, none);
    expect(c.fund.overdueQuarters).toBe(0);
  });

  it('distributions stop at three quarters of expenses in reserve', () => {
    let c = newCareer(opts());
    c = distribute(c, 1e12);
    expect(firmCash(c)).toBeCloseTo(quarterlyExpenses(c) * 3, 1);
    expect(maxDistribution(c)).toBeCloseTo(0, 1);
  });

  it('a payroll shortfall creates a decision and personal capital can cover it', () => {
    let c = newCareer(opts('boutique'));
    c = distribute(c, 1e12);
    c.roster = c.roster.map(e => ({ ...e, salaryQ: e.salaryQ * 20 }));
    c = closeQuarter(c, none);
    const d = c.decisions.find(x => !x.resolved)!;
    expect(d).toBeTruthy();
    const before = c.arrears;
    const fixed = resolveDecision(c, d.id, 'inject');
    expect(fixed.arrears).toBeLessThan(before);
    expect(balance(fixed.journal, 'founder')).toBeLessThan(balance(c.journal, 'founder'));
  });
});

describe('firm career saves and branches', () => {
  it('save and resume keep every balance and pending decision', () => {
    let c = newCareer(opts());
    for (let i = 0; i < 3; i++) c = closeQuarter(c, none);
    const back = JSON.parse(JSON.stringify(c));
    expect(firmCash(back)).toBe(firmCash(c));
    expect(founderCash(back)).toBe(founderCash(c));
    expect(back.decisions).toEqual(c.decisions);
    expect(closeQuarter(back, none).fund.q).toBe(4);
  });

  it('a practice branch leaves the live career unchanged', () => {
    const live = closeQuarter(newCareer(opts()), none);
    const snap = JSON.stringify(live);
    let br = forkCareer(live);
    for (let i = 0; i < 3; i++) br = closeQuarter(br, none);
    br = distribute(br, 1e9);
    expect(JSON.stringify(live)).toBe(snap);
    expect(br.practice && br.fund.practice).toBe(true);
  });

  it('the chart history reconciles to recorded NAV', () => {
    let c = newCareer(opts());
    for (let i = 0; i < 5; i++) c = closeQuarter(c, none);
    c.snapshots.forEach((s, i) => expect(s.nav).toBeCloseTo(c.fund.history[i].nav, 9));
  });

  it('legacy fund converts without awarding past fees and stays separate', () => {
    let legacy = newFund('normal', 9, 10, false, true);
    for (let i = 0; i < 3; i++) legacy = playQuarter(legacy, none);
    const frozen = JSON.stringify(legacy);
    const c = careerFromLegacy(legacy, { firmName: 'X', hq: 'Chicago', philosophy: 'defensive' });
    expect(JSON.stringify(legacy)).toBe(frozen);
    expect(totalOf(c.journal, 'carryover')).toBeCloseTo(legacy.ledger.managerCash, 1);
    expect(totalOf(c.journal, 'fee_receipt')).toBe(0);
    expect(nav(c.fund.ledger)).toBe(nav(legacy.ledger));
    const next = closeQuarter(c, none);
    expect(fees(next)).toBeCloseTo(next.fund.ledger.managerCash - legacy.ledger.managerCash, 1);
  });
});
