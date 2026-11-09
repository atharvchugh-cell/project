// Firm cash runway forecast. Projects firm cash quarter by quarter from the
// current journal balance, using only known commitments: scheduled investor
// payouts (which shrink AUM and therefore fees), the 0.25% management fee,
// payroll, office, founder salary, every unpaid bill, and each owned business's
// cash from the same projection settlement uses (half revenue while integrating, full costs). Fund costs follow the fund's cost rule; fees
// deferred by the fund are counted once, in the first quarter.
// Assumptions: no performance fees, no new money, and a constant fund return per scenario.
import { netAssets } from '@/lib/fund/accounting';
import { managementFee } from '@/lib/fund/clientFees';
import { costPerQuarter, quarterLabel } from '@/lib/fund/engine';
import { type Career, firmCash, reserveQuartersOf, salaryAt } from './career';
import { companyCash } from './business';
import { serviceCostQ } from './governance';
import { payroll } from './roster';
import { businessQuarter } from './phase3';
import { clientFeeEstimate } from './fees';
import { managerDebtService } from './managerLoans';
import { expectedContributions } from './phase4';
import { staffServiceQuote } from './immersion';
import { publicDebtService } from './publicBook';


/** business: expected net cash of owned businesses that quarter (integration included, market moves excluded). */
export interface ForecastRow { q: number; label: string; aum: number; fees: number; staff: number; core: number; salary: number; business: number; integrating: boolean; cash: number; short: boolean; reserve: number; belowReserve: boolean; opening: number; plannedSalary: number; contributions: number; managerDebt: number }
export interface Forecast { rows: ForecastRow[]; firstShort: ForecastRow | null; firstBelowReserve: ForecastRow | null; reserveQuarters: number; quarterlyReturn: number }

/** What-if inputs previewed before committing: an extra quarterly firm cost (a hire, a bigger office) and a one-time firm payment now. */
export interface WhatIf { extraCostQ?: number; oneTime?: number }

export function cashForecast(c: Career, quarterlyReturn = 0, horizon = 8, w: WhatIf = {}): Forecast {
  const f = c.fund; const rows: ForecastRow[] = [];
  let cash = firmCash(c) - (w.oneTime ?? 0); let aum = netAssets(f.ledger); let arrears = c.arrears;
  const deferred = f.ledger.liabilities.filter(x => !x.paid && x.feeRecipient !== 'lender' && (x.kind === 'mgmt_fee' || x.kind === 'perf_fee')).reduce((a, x) => a + x.amount, 0);
  const core = payroll(c.roster) + c.officeQ + serviceCostQ(c) + (w.extraCostQ ?? 0);
  const RQ = reserveQuartersOf(c);
  for (let k = 1; k <= horizon; k++) {
    const q = f.q + k; if (q > f.quarters) break;
    aum = Math.max(0, aum * (1 + quarterlyReturn) - f.schedule.filter(r => r.q === q).reduce((a, r) => a + r.amount, 0));
    // Same rates as quarterEstimate: fund costs and the 0.25% fee at the projected (not future-market) size.
    const fundCost = costPerQuarter({ difficulty: f.difficulty, costRule: f.costRule, ledger: { ...f.ledger, cash: aum, positions: {}, locked: 0, liabilities: [] } });
    const fees = clientFeeEstimate(c, q, Math.max(0, aum - fundCost)) + (k === 1 ? deferred : 0);
    aum = Math.max(0, aum - fundCost - managementFee(f.ledger, f.investors, f.clientFees, q, Math.max(0, aum - fundCost)));
    const due = core + arrears; arrears = 0;
    // Same projection as the close: company cash pays its own loan in the next quarter only (conservative after that).
    const biz = c.subsidiaries.map(s => businessQuarter(s, q, 0, k === 1 ? companyCash(c, s.id) : 0));
    const managerDebt = managerDebtService(c, q) + publicDebtService(c, q);
    const bizCost = biz.reduce((a, b) => a + b.cost + b.debtService, 0) + managerDebt;
    const business = biz.reduce((a, b) => a + b.net, 0) - managerDebt;
    const staff = staffServiceQuote(c, q).reduce((a, x) => a + x.amount, 0);
    const open = cash;
    const afterCore = cash + fees + staff + business - due;
    const short = afterCore < 0;
    const planned = salaryAt(c, q);
    const salary = !short && afterCore >= planned ? planned : 0;
    cash = Math.max(0, afterCore) - salary;
    if (short) arrears = -afterCore;
    const reserve = (core + planned + bizCost) * RQ;
    // Conditional contributions are disclosed, not banked as firm income or assumed certain in later quarters.
    const contributions = k === 1 ? expectedContributions(c).reduce((a, x) => a + x.amount, 0) : 0;
    rows.push({ q, label: quarterLabel(f, q), aum, fees, staff, core: due, salary, business, integrating: biz.some(b => b.integrating), cash, short, reserve, belowReserve: cash < reserve, opening: open, plannedSalary: planned, contributions, managerDebt });
  }
  return { rows, firstShort: rows.find(r => r.short) ?? null, firstBelowReserve: rows.find(r => r.belowReserve) ?? null, reserveQuarters: RQ, quarterlyReturn };
}
