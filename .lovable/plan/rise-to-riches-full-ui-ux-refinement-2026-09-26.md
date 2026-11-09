# Rise to Riches — full UI/UX refinement

Presentation-only pass across every page. Simulation math, trading rules, saves, multiplayer, routes (/play, /host, /join) and backend stay untouched. Nothing is published.

## Phase 1 — Shared foundations
- **One font:** Instrument Sans for everything, with tabular numerals for prices, balances, ranks and years. Playfair Display kept only for the "Rise to Riches" wordmark. Remove Plus Jakarta Sans, Space Grotesk, JetBrains Mono imports and the scattered mono/serif overrides.
- **Type scale:** body 16, secondary 14, metadata 12–13, section 24–32, page 32–44, hero brand 48–64 (scales down on phones). Fewer uppercase/bold labels.
- **Tokens:** charcoal surface levels, warm off-white text, emerald primary, amber (Real Estate) and violet (Sandbox) as mode accents; borders, shadows, focus ring, 150–200ms motion timing; 4px spacing; gutters 16/24/32; marketing max width ~1200px.
- **Radii:** 8px controls, 12px panels; pills only for small status badges.
- **Buttons:** primary / secondary / ghost / icon / destructive; 44px standard, 48px major CTA; full hover, pressed, focus, disabled, loading (keeps size, blocks double clicks). No gradients, shine, shimmer, glow or scale effects. Migrate hand-styled buttons on the homepage, Sandbox, Real Estate and elsewhere to it.
- **Icons:** Lucide at consistent size and stroke; drop decorative icons on headings. Company logos unchanged.

## Phase 2 — Background motif
One "market history" treatment: charcoal base, faint grain, a few fine contour-like chart paths, sparse grid intersections, one restrained emerald highlight. Detail concentrated near the game preview and edges, masked away from text. Lightweight SVG/CSS replacing the current busy canvas layers (or a capped, pause-when-hidden canvas), static under reduced motion, never clickable. Small echoes in section transitions and secondary pages; gameplay kept much quieter.

## Phase 3 — Homepage
- Exact label **Play Now**; remove "about 5 minutes · no sign-up" and "No sign-up, about five minutes to your first run." with no replacement text.
- Hierarchy: Play Now (primary) → Play With Friends (secondary) → View Leaderboard (text link).
- Rebalance the hero around the game preview, labelled as illustrative.
- Remove the generated "online now" count (not real presence data).
- Fix "500+" vs "almost 200" to one accurate number from the actual stock list.
- Refine nav, Continue card, walkthrough, Advanced preview, multiplayer, Real Estate/Sandbox intros, request form, footer, with varied section layouts. Deliberate mobile menu (Escape, focus return).

## Phase 4 — Gameplay
- **Remove all countdowns:** "X min left", the per-year "Xs" countdown, and equivalents in the host view and Real Estate game. Keep "Year 3 of 10" (respecting hidden-year rules). Timing logic unchanged.
- **Speed control moves** out of the header into a centered row below the portfolio summary: segmented `[ 1× | 2× | 4× ]` with Pause/Resume beside it. Proper group label, selected state, keyboard behavior; changing speed never resumes a paused game. Solo only (existing restriction). On phones it sits below the summary and stays visible across Market / Portfolio / News. Tutorial targets updated.
- Compact header: save status, Save & Exit, Quit grouped as utilities, all with accessible names at narrow widths.
- Empty charts get a compact "Awaiting price history" state that transitions to the chart without layout jumps.
- Market cards: aligned logo/ticker/price/change/ownership/actions, less padding, clearer watchlist add/remove; gains/losses marked with signs, not just color.
- Trade ticket: instrument, quantity, price, total, cash after, confirm clearly laid out; one coherent paused state instead of two.
- Concise feedback for trades, invalid input, insufficient cash, save and connection failures.
- Tutorial text derived from the chosen length/mode (no more "20 years" in a 5-year game).

## Phase 5 — Every other screen
Setup dialogs, saves manager, CD panel, unlocks, quit/save confirmations, results and coach, Real Estate, Sandbox (clear stepper, inline validation, violet without glow), Leaderboard (compact filters, aligned numbers, rows sooner on mobile), Share, Learn/Guide/teacher/high-school/diversification/simulator articles (65–75 char width), About, Methodology, 404, Unsubscribe, admin. Replace vague labels like "INDEX" with clear navigation.

## Phase 6 — Verification
- Tests, type check, lint, production build; add tests for countdown removal, speed control placement/behavior (no auto-resume, blocked in multiplayer).
- Browser check at 360 / 390 / 768 / 1024 / 1440: no overflow or clipping, focus states, reduced motion, existing saves load, trade/save/finish flow works.
- Deliver desktop + mobile screenshots, change list, and what was and wasn't verified.

## Technical notes
- Fonts via Google Fonts in index.html; `tailwind.config.ts` fontFamily collapsed to `sans` (Instrument Sans) + `brand` (Playfair); global `font-variant-numeric: tabular-nums` utility `.num`.
- Button variants extended in `src/components/ui/button.tsx` (cva); size `lg`=48px, `default`=44px.
- Countdown removal in `GameScreen.tsx`, `HostDashboard.tsx`, `RealEstateGame.tsx`; `remainingRealSeconds` stays in the engine, just unrendered.
- Background as a new `MarketHistoryBackdrop` SVG component replacing `HeroAnimation` layers.
- `onlineCount.ts` UI usage removed.
