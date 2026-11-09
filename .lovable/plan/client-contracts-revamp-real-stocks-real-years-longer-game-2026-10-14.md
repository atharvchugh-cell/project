# Client Contracts revamp: real stocks, real years, longer game

## What changes for the player
- **Setup:** pick a length (10, 15 or 20 years) and Normal or Hard. The start year is picked at random (hidden in Hard mode, like the main game), so the run plays out real market history.
- **Real stocks:** the fund trades the full Advanced stock list (search by name or ticker), plus the S&P 500, bonds/HYSA and cash. A company only shows up once it went public. Company logos and stock info are the same as in the main game.
- **Step by quarter:** each turn you see the quarter's briefing, investor inbox, payments coming due and fundraising offers. Then you buy and sell (by dollars or shares, with a trade preview) and press **Simulate next quarter**. A 10-year game is 40 turns and a 20-year game is 80, so a game now lasts many minutes instead of about 30 seconds.
- **Accurate returns:** prices follow each stock's real yearly return. The four quarters of a year always multiply out to that year's real return; only the path within the year is made up, and it's labeled that way. The S&P 500 benchmark uses the real (corrected) yearly returns.
- **All fund rules stay:** investors with payout dates, lock-up periods and exit triggers; investor confidence; 1% yearly management fee and 10% performance fee above the previous fee high point; unpaid amounts stay owed and two quarters overdue closes the fund; the 5-level fundraising cycle; new money buys shares at the current fund price, so it never counts as profit; journal; the three decisions that mattered most; practice replay; save and resume.
- **Goals adjusted for length:** Normal targets about 1.5x the S&P 500's growth over the chosen years (at least doubling the fund price). Hard starts at fund price 40, recovers at 100 and wins at 120. Payout schedules and fundraising windows stretch to fit the length.
- **Hard mode** keeps the inherited mess: a real stock that was struggling in that era makes up most of the fund, one investment is locked and releases in stages, and payouts are due early.
- **Results:** fund return vs the S&P 500 for the same years, biggest drawdown, the real years revealed, your own wealth shown separately, and the best and worst holdings.

## Stages
1. Quarterly price engine built from the real stock data, with tests showing each year's quarters match the real yearly return.
2. Swap the made-up asset classes in the fund engine for real holdings; keep accounting, fees, payouts and fundraising; scale the schedules to the chosen length.
3. Rebuild the workspace: setup (length, mode), stock search and trade ticket, portfolio table, quarter briefing, Simulate button, results.
4. Tests and checks: return accuracy, new money never counted as profit, the same choices always give the same result, playable at every length in both modes. Then check on desktop and phone.

## Technical details
- New `src/lib/fund/market.ts`: for each company in `COMPLEX_UNIVERSE`, build quarterly returns from annual return r: four quarterly multipliers seeded by a deterministic RNG, rescaled so their product equals 1 + r exactly. Companies are listed from `firstAvailableYear`. SP500 uses the corrected data (version 2).
- `engine.ts`: positions keyed by ticker (shares + cost basis) instead of `AssetId` weights; `playQuarter` takes buy/sell orders instead of target weights. Allocation policies become optional "rebalance to S&P / balanced / cash" helpers. Quarters = years × 4. `FUND_RULES_VERSION` goes to 2; old v1 saves under `rtr-client-contracts-v1` get a "Start new fund" message and are never converted.
- Hard-mode seeding: pick start years where a listed stock fell more than 40% in the year before, and use it as the inherited position. Check winnable seeds per length with a strategy test, as before.
- Fundraising windows and cooldowns are measured in quarters, so they work at any length. Redemption and payout dates are spread across the run as a share of total quarters.
- Results stay unranked practice (no leaderboard), same as now.
