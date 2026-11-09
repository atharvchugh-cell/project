import type { Career } from './career';
import { loanSchedule, type Loan } from './business';

export const INITIAL_PUBLIC_SHARES = 10_000_000;
export interface PublicDebt { id: string; loan: Loan; restricted: boolean; history: { q: number; interest: number; principal: number; owed: number; dscr: number }[] }
export interface PublicMark { q: number; shares: number; price: number; value: number; eps: number; sentiment: number; reputation: number; dividendPerShare: number }
export interface PublicBook {
  version: 1; shares: number; listingPrice: number; primaryRaised: number; listingFees: number;
  sentiment: number; coverageQ: number; coverageHeadline: string;
  loans: PublicDebt[]; history: PublicMark[];
  /** Optional: corporate events feed (newest last). Older saves simply have none. */ events?: import('./publicEvents').PublicEvent[];
  /** Stock splits done, newest last. */
  splits?: { q: number; ratio: number }[];
  personal: { shares: number; basis: number; realized: number; dividends: number };
  dividendsPerShare: number;
}
export const publicDebt = (c: Pick<Career, 'publicFirm'>) => (c.publicFirm?.loans ?? []).reduce((a, x) => a + x.loan.balance, 0);
export const publicDebtService = (c: Pick<Career, 'publicFirm'>, q: number) => (c.publicFirm?.loans ?? []).reduce((a, x) => a + loanSchedule(x.loan, q).debtService, 0);
export const publicRestricted = (c: Pick<Career, 'publicFirm'>) => (c.publicFirm?.loans ?? []).some(x => x.restricted || x.loan.balance > 0.5);