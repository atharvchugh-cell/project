# Rise to Riches — Brief implementation + Client Contracts fundraising

Client Contracts does not exist in the app yet. This plan builds the whole brief in its required order. The new fundraising side note is part of Stage 4. Nothing gets published automatically.

## Stage 1 — Data and accounting fixes
- Intel 2024 changes to −60.10% in both data sets (the advanced list and the stock pool). The source/generation step gets fixed too, and a test fails if the old +65.24% ever comes back.
- S&P 500 2008 changes to −37%.
- Add a data version (v2). Old leaderboard runs keep their saved scores and are labeled "pre-correction data". They are never ranked as if they matched corrected runs.
- Yearly recaps use the engine's real 10 entries per year. Deposits stay out of all performance feedback.

## Stage 2 — Challenge and room fairness
- New challenges store a fixed, versioned manifest: mode, years, starting money, opening stocks, unlock schedule, eligible stocks, seed, cash-flow and expense schedule, volatility profile, and data and rules versions.
- Challenges stop treating the full stock menu as opening picks. Watchlists can't change which stocks are eligible.
- Attempts are checked against the full manifest. A score is called "verified" only after the server replays the player's recorded actions.
- Old challenges that can't be reproduced exactly get a "Legacy — approximate" badge.
- Multiplayer:
  - Players can't pause or change speed. This is enforced in the game engine, not just hidden in the interface.
  - Room time comes from the server's start time.
  - Tutorials, hidden tabs and reconnects no longer freeze one player's market.
  - Trades use the room's current price.
  - Reconnecting restores CDs and other obligations.
  - Solo pause and speed stay as they are.

## Stage 3 — Client Contracts engine
- Seeded fictional market regimes: risk-on, recession, rate shock, liquidity squeeze and recovery. They mix market-wide, sector and single-stock moves, with occasional sharp shocks. Prices can never go below zero. Every scenario is clearly labeled fictional.
- Fund accounting:
  - Money is tracked as fund units at NAV (value per unit).
  - New money issues units at the current NAV. Payouts retire units.
  - 1% yearly management fee, plus a 10% performance fee only on gains above the high-water mark (the fund's previous best value per unit).
  - A fee preview before each yearly charge. Fees can be deferred when they would block a promised payout.
- Investors have payment dates, notice periods and risk limits, plus confidence that reacts to performance, drawdown, liquidity and late payments. Every change is explained.
- Unpaid obligations remain owed until they are paid.
- Normal mode: 5 years, $500k (10% founder), 4–6 investors, NAV target 100 → 200.
- Hard mode: inherited fund at NAV 40, with a 70% concentrated position, a 20% locked holding with release dates and early-exit discounts, redemptions due, and targets of NAV 100 and then 120.
- Results: achieved / survived but missed / failed, plus investor return and benchmark margin, cash-flow-adjusted drawdown, and founder wealth shown separately.
- Rankings are kept separate per scenario, difficulty and rules.

## Stage 4 — Ongoing fundraising (side note)
Fundraising repeats through the whole game:

```text
sustained strong performance -> trust rises -> optional offer -> bigger fund, tougher terms -> prove it again
```

- **Tiers:** referrals from existing investors → local professionals → wealthy families → family office → institutional allocator. Each tier offers more money with stricter terms.
- **Gate for each offer.** All of these must hold over a rolling window, and the window gets longer at higher tiers (2, 3, 4, then 6 quarters):
  - The fund beats the benchmark in most quarters of the window, and the total gain over the window clears a margin set for that tier.
  - The worst drop stays under that tier's limit.
  - Cash reserves cover the payments due in the next 2 quarters.
  - No payment is late, and every payment in the window was made on time.
  - Investor confidence is above that tier's minimum.
- **No shortcuts:**
  - One lucky trade or short rally can't unlock an offer.
  - Each offer resets that tier's window, so the next commitment needs a fresh run of strong results.
  - Unlocked tiers can lock again.
- **Poor performance** pauses new offers and can make pending offers withdraw. Rebuilding the track record reopens them.
- **Each offer is optional** and comes with a real contract:
  - amount, lock-up period, notice period
  - risk or concentration limits
  - expected return, and a redemption trigger if performance falls short
  - optionally a reduced fee
- **Milestones panel** shows:
  - the current tier and progress toward each requirement
  - why each offer appeared, for example: "Beat benchmark 3 of 4 quarters, max drawdown 9% < 15%, reserves cover 2 quarters"
  - why offers are on hold
- **Accounting rule:** accepted money issues units at the current NAV. It raises fund size (AUM) and fee base only. It never raises NAV return, investor return, score, or founder wealth.
- New offers appear in the in-game inbox as letters from fictional investors. There are no real emails or notifications.

## Stage 5 — Interface and the main game
- Fund-manager workspace in charcoal/navy with amber and crimson accents. The top bar shows NAV, fund size, high-water mark, reserves and the objective. It also includes:
  - a performance chart against the target and benchmark
  - exposure and locked-holding breakdowns
  - an investor list, payment calendar, inbox and quarterly reviews
  - trade previews showing cost, exposure, liquidity and payment coverage
- Celebration moments for big milestones, never on every trade. Works on mobile, keyboard and reduced motion. Sound is optional and starts muted.
- Main game:
  - Multi-asset auto-invest, available in Basic too, with rebalancing preview.
  - Optional pacing that pauses once a year.
  - Grouped deposit notices.
  - Timestamped trade and cash log.
  - Consistent benchmark charts.
  - Index funds labeled separately from single stocks.

## Stage 6 — Verification
- Unit tests:
  - corrected returns
  - exact challenge replay (same actions give the same result)
  - units at NAV (accepted money doesn't change NAV return)
  - fees and high-water mark
  - liabilities that persist
  - Hard Mode recovery math (40 → 100 is +150%, 40 → 120 is +200%)
  - locked-holding release rules
  - fundraising gates (a single strong quarter unlocks nothing, a drawdown blocks offers, recovery reopens them)
  - deterministic scenarios
- Browser checks: a two-client multiplayer timing test with pause, tutorial, background tab and reconnect; plus save/resume and mobile.
- Isolated test data only, never fake public leaderboard scores.

## Technical notes
- New modules: `src/lib/fund/` with engine, units, fees, investors, fundraising, regimes and replay, plus `src/pages/ClientContracts.tsx`.
- Shared seeded random generator and replay used by both the client and `_shared/runs.ts`.
- Database changes:
  - `challenges.manifest jsonb` and `game_events.data_version` / `rules_version`, all nullable or defaulted
  - room `paused_at` / `paused_total` for a host-only pause
  - a separate `fund_runs` table that is service-written
- Record decisions in AGENTS.md (manifest rule, unit accounting, server clock).
- This is a large build spread over several turns. Each stage ends with the build passing and its tests green.

## Added commitments (review round 2)

### A. Recurring fundraising fitted to 20 quarters (Normal, 5 years)
Each tier repeats; a higher tier unlocks after a set number of rounds below it. "Window" = rolling quarters measured; "cooldown" = quarters before that tier can offer again. All gates are measured net of fees.

| Tier | Window | Cooldown | Commitment | Beat benchmark | Window net return | Max drawdown | Reserves cover | Confidence | Unlocks after |
|---|---|---|---|---|---|---|---|---|---|
| 1 Referrals | 2q | 1q | 3–6% of AUM | 2 of 2 q | ≥ +4% | ≤ 12% | 1 q payments | ≥ 55 | start |
| 2 Local professionals | 3q | 2q | 6–10% | 2 of 3 | ≥ +7% | ≤ 12% | 2 q | ≥ 60 | 2 Tier 1 rounds |
| 3 Wealthy families | 4q | 2q | 10–15% | 3 of 4 | ≥ +10% | ≤ 10% | 2 q | ≥ 70 | 2 Tier 2 rounds |
| 4 Family office | 4q | 3q | 15–20% | 3 of 4 | ≥ +12% | ≤ 9% | 3 q | ≥ 75 | 1 Tier 3 round + 8q track record |
| 5 Institutional | 6q | 4q | 20–25% | 5 of 6 | ≥ +18% | ≤ 8% | 3 q | ≥ 80 | 1 Tier 4 round + 12q track record |

- Windows don't wipe out the track record. Only the cooldown blocks a repeat, so one quarter of strong results can feed offers from several tiers.
- Tier unlocks are kept, but any gate failure pauses all offers until the gates pass again. A quarter with a drawdown over 15% or a late payment drops the fund one tier.
- Example: an exceptional 5-year run gets Tier 1 offers at Q2, Q4, Q6 and so on (up to about 8), Tier 2 from around Q6 (about 4), Tier 3 from around Q10 (about 3), Tier 4 from around Q12 (about 2), and Tier 5 at Q18–20 (1). That is about 15–18 offers over the game. A unit test runs this scripted run and asserts at least 12 offers. A test also confirms a run with average results gets only 0–3 offers.
- Bigger tiers add terms: longer lock-ups, tighter concentration limits, redemption triggers when results trail the benchmark, and higher return expectations. These all feed later gates.

### B. Fee and liability accounting
- The management fee is 1% a year, charged each quarter (0.25%) and recorded as owed, which lowers NAV right away.
- The performance fee is 10% of the per-unit gain above the fee high-water mark, worked out after management fees. It is calculated once a year at year-end NAV.
- The fee high-water mark only rises to the year-end NAV at which a performance fee was actually charged. It never follows temporary peaks during the year.
- Hard Mode starts with the inherited fee high-water mark of 100.
- Late investors buy units at the current NAV, after fees already owed are taken out. All units share one high-water mark. That means an investor who buys in below the mark pays no performance fee until the fund passes it again. This simplification is shown to the player.
- Deferred fees stay owed and stay counted in NAV. Paying them later uses cash and clears the owed amount in the same step, so NAV doesn't change and nothing is taken twice.
- Redemptions:
  - Units are retired on the redemption date at that day's NAV.
  - The payout then becomes an amount owed: it leaves fund assets once, and paying it clears both cash and the owed amount.
  - A payout that isn't made stays owed and counts as overdue.

### C. Challenge manifest (complete)
- Includes: duration, starting money, starting holdings, and the exact tick of every deposit, expense, unlock, CD maturity and price path seed. Also the eligible stocks, trading rules, and data and rules versions.
- The client and the server share one deterministic simulation. Actions are timestamped by tick.
- When several things happen on the same tick, they happen in a fixed order: prices, maturities, unlocks, deposits, expenses, investor payments, then player actions in sequence order.
- New scored runs and challenges must include data and rules versions, and the server rejects them otherwise. Missing versions are allowed only on legacy records.

### D. Multiplayer authority
- The server sets the room's start time, and the host can pause or resume it through a credential-checked action.
- Trades go through a credential-checked server action. The server checks the trade's timing against room time, the price on that tick, whether the stock is eligible, and the player's cash and holdings.
- Every trade carries an id, and deposits, maturities and payments are tied to their tick, so retries and reconnects can't count anything twice.
- Optional yearly pacing works only in solo games.
- A two-client test covers pause attempts, the tutorial, a background tab and a reconnect.

### E. Hard Mode and scoring
- 4 years (16 quarters), 10,000 units at NAV 40, $400,000 in the fund.
- Holdings: 70% in one struggling liquid position, 20% in a locked holding and 10% in cash.
- The manager starts with 0 inherited units and may buy units at the current NAV.
- The fee high-water mark is 100.
- Payments: payouts of $40,000 in Q1, $30,000 in Q2, $50,000 in Q4 and $40,000 in Q8, plus $6,000 a quarter in running costs.
- The locked holding releases 25% at Q4, Q8, Q12 and Q16. Selling early costs a 30% discount.
- Reaching NAV 100 is the recovery milestone and earns a "Recovered" result. Winning requires NAV 120 or more at the end, staying solvent and having nothing overdue.
- Failure or closure:
  - any payment overdue for 2 quarters
  - NAV below 10
  - or confidence at 0 while payments are still overdue
- Rankings are kept per scenario, difficulty and rules version. Successful, fully funded runs rank above survived runs, and survived runs rank above failed ones.
  - Within each group, runs rank by net investor return.
  - A smaller cash-flow-adjusted drawdown breaks ties.
  - Fund size and manager income never affect rank.
- For each reviewed scenario, a scripted balanced, rebalancing strategy must pass the tests and reach the target. Reckless all-in strategies must fail most seeds.

### F. Gameplay requirements carried in
- Historical Play gets more labeled synthetic volatility within each year. Corrected year-end prices are kept exactly, and tests check this.
- Client Contracts gets:
  - Growth, Defensive, Balanced and Custom allocation policies, which can be edited
  - automatic placement of accepted new money
  - target rebalancing with a drift threshold and a preview
  - quarterly strategy checkpoints and a short decision journal
  - practice replay, kept separate from official attempts
  - three consequential decisions shown in the results

### G. Competitive and regression verification
- Scored fictional scenarios keep future prices and seeds that could rebuild them on the server only. The client receives prices one tick at a time.
- Checks include:
  - build and type checks
  - guest play without an account
  - keyboard use
  - save and resume
  - failed submissions and repeat submits that count only once
  - analytics that respect the privacy choice
- These run alongside the tests already listed. Everything stays in preview, and nothing is published automatically.
