# Rise to Riches — main simulator redesign

Multiplayer reconnect is already done and tested (details at the bottom). The rest below is the redesign, split into stages so you can see and react to each one. Nothing gets published.

## Stage 1 — Homepage that sparks curiosity

- One hook headline: "Your money. Twenty years of market history. What would you do?"
- A live, labelled gameplay sample right under it: a small portfolio panel, one market headline, and one visible decision (buy / hold) — real interface, not screenshots of text.
- One dominant button: **Play now**. **Play with friends** sits next to it as the clear second option.
- Returning players: **Continue game** gets equal prominence to **New game**, with the saves list one click away. Play now stays the lead action for first-time visitors.
- Real Estate and Sandbox move into a "More ways to play" row further down. Long explanations and learning links move below the entry area.

## Stage 2 — Faster, clearer setup

- One compact dialog: **Quick game (~5 min)**, **Longer game (~10 min)**, **Customize** (era, length, difficulty — tucked away).
- Basic vs Advanced explained in one sentence each.
- Guest play stays instant; no account, no artificial loading delay.
- The first solo game opens **paused** with a three-beat prompt: look at an asset, review a purchase, start the market. A visible "Skip and start" is always there.

## Stage 3 — Trading dashboard as the centrepiece

Charcoal and emerald kept; accent colour reserved for events, opportunities and progress.

Three zones:
- **My portfolio** — total value, investment gain/loss, cash. Deposits are never shown as profit.
- **The market** — focused asset list, readable movement, one-tap trade.
- **What matters now** — current headline, upcoming event, or a factual observation about the portfolio.

Desktop: market workspace + compact portfolio rail + trade panel. Mobile: sticky summary bar and three tabs (Market / Portfolio / News), so holdings are never buried under the asset list.

Charts: portfolio trajectory with an optional S&P 500 comparison; every percentage labelled with the period it covers. Purposeful empty state: "Your portfolio starts here" with a first action.

## Stage 4 — One trade ticket

Buy/Sell, cash or shares available, quantity, quick 25% / 50% / Max, estimated cost, cash and position after the trade, one confirm button, duplicate-click protection, instant confirmation.

- Whole-share assets show the resulting share count and leftover cash. No silent fractional shares.
- Solo: the clock pauses while the ticket is open and returns to its previous state on close.
- Multiplayer: the shared clock keeps running; price changes are re-checked and explained at confirm.
- Sell directly from a holding; average cost and gain/loss visible there.

## Stage 5 — Pacing

- Solo speed controls: **Pause / 1x / 2x / 4x**, with the estimated remaining time shown. One clock drives everything; contributions, maturities and unlocks each fire exactly once at every speed.
- Multiplayer timing stays shared — no personal fast-forward.
- Routine notifications become a compact activity feed; only genuinely big moments interrupt.
- Major events get a short "what happened / what changed / what you held" note, with no future prices and no trading advice.
- "Advance to next event" is only shipped if it processes every intervening change correctly; otherwise the speed controls stand in.

## Stage 6 — Reason to finish and replay

- During play: benchmark comparison, concentration, cash available, and what the last big event changed — factual, never nagging.
- Ending: final value, total contributed, actual gain or loss, benchmark result under the same contribution schedule, best and worst contributors, one plain lesson.
- Replay choices: same era different strategy, another era, or with friends — each stating clearly what stays the same. Sharing stays optional.
- Existing leaderboard behaviour is preserved exactly: submission status, retry, support reference code, and auto-refresh, with results readable while saving.

## What is preserved, untouched

Saves and slot management (only their presentation improves), save migration and recovery, multi-tab write protection, `/play`, `/host`, `/join?code=…` with prefilled codes, leaderboard submission and reference codes, and the Rise to Riches brand. Save & exit will confirm a successful save before leaving and warn instead of overwriting newer progress. No Career mode is added.

## Verification each stage

Desktop and a 390px phone: homepage → setup → first decision → buy → sell → pause → speed change → save/reload → results → replay. Plus trade validation, duplicate clicks, contribution-aware returns, clock behaviour around the ticket, event counts at 4x, existing saves still loading, multiplayer sync, and no clipped or overlapping UI.

## Already done this turn — multiplayer reconnect

Leaving a room and coming back restores the player's cash, holdings, contributions and per-position gain/loss from the room itself, and catches the clock up to the shared room time so nobody gains or loses time by leaving. Contributions and events that passed while away are counted once, never twice, and a seat that never played keeps its own starting money instead of the placeholder balance. Rooms that have finished say so in plain language instead of failing silently. Verified in a browser: host created a room, a player joined, played, left to the homepage, rejoined and landed at the same year with matching balances.
