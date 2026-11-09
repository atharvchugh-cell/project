import { marketFor, type FundState } from './engine';

/** Research sees only simulated quarters already completed, including in Hard Mode. */
export function companyTrackRecord(s: FundState, ticker: string) {
  let index = 100;
  return marketFor(s).slice(0, s.q).flatMap(m => {
    const r = m.returns[ticker];
    if (r === undefined) return [];
    index *= 1 + r;
    return [{ q: m.q, return: r * 100, growth: index - 100 }];
  });
}

/** Temporary forks retain the same market and obligations, but can never become saved runs. */
export function forkFund(s: FundState): FundState {
  return { ...structuredClone(s), practice: true };
}