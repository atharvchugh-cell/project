import { grossAssets, nav } from './accounting';
import type { FundState } from './engine';
import { SPX } from './market';

export const BOARD_RULES = { normalAnnualReturn: 0.08, hardAnnualReturn: 0.12, minimumCompanies: 3, minimumWeight: 0.05, maximumWeight: 0.4 };

/** Mandates apply only to newly opened institutional funds, not legacy saves. */
export function boardReview(s: FundState, completed = false) {
  const deadlineQ = completed && s.q > 0 && s.q % 4 === 0 ? s.q : Math.min(s.quarters, (Math.floor(s.q / 4) + 1) * 4);
  const startQ = Math.max(0, deadlineQ - 4);
  const baseNav = startQ === 0 ? s.startNav : (s.history.find(h => h.q === startQ)?.nav ?? s.startNav);
  const annualTarget = s.difficulty === 'hard' ? BOARD_RULES.hardAnnualReturn : BOARD_RULES.normalAnnualReturn;
  const targetNav = baseNav * (1 + annualTarget);
  const currentNav = nav(s.ledger);
  const total = Math.max(1, grossAssets(s.ledger));
  const companies = Object.entries(s.ledger.positions).filter(([ticker, value]) => ticker !== SPX && value / total >= BOARD_RULES.minimumWeight);
  const maxWeight = Math.max(0, ...Object.entries(s.ledger.positions).filter(([ticker]) => ticker !== SPX).map(([, value]) => value / total));
  const diversified = companies.length >= BOARD_RULES.minimumCompanies && maxWeight <= BOARD_RULES.maximumWeight;
  const graceQ = s.difficulty === 'hard' ? 8 : 4;
  const late = s.ledger.liabilities.some(x => !x.paid && x.dueQ <= s.q && (x.kind === 'redemption' || x.kind === 'cost'));
  return { deadlineQ, startQ, baseNav, targetNav, annualTarget, netReturn: baseNav > 0 ? currentNav / baseNav - 1 : 0,
    companies: companies.length, maxWeight, diversified, graceQ, diversificationDue: s.q >= graceQ, late,
    returnMet: currentNav + 1e-8 >= targetNav };
}

/** NAV-based series deliberately excludes deposits and redemptions from returns. */
export function fundChartData(s: FundState) {
  const scale = s.capitalScale ?? 1;
  return [{ q: 0, return: 0, benchmark: 0, aum: (s.difficulty === 'hard' ? 400_000 : 500_000) * scale, drawdown: 0 },
    ...s.history.map(h => ({ q: h.q, return: (h.nav / s.startNav - 1) * 100, benchmark: (h.benchIndex / 100 - 1) * 100,
      aum: h.aum, drawdown: h.drawdown * 100 }))];
}