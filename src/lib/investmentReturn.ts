/**
 * Investment profit as a percentage of player-contributed capital.
 * Adding cash changes both values equally, so a contribution is never profit.
 */
export function calculateInvestmentReturn(
  portfolioValue: number,
  totalContributions: number,
): number {
  if (!Number.isFinite(portfolioValue) || !Number.isFinite(totalContributions) || totalContributions <= 0) {
    return 0;
  }

  return ((portfolioValue - totalContributions) / totalContributions) * 100;
}
