# Life and Empire expansion (Nov 2)
- [x] Full-career visual rebrand: branded workspace mastheads, shared unframed sections, charcoal/brass identity, larger staff/client portraits, company dossiers, investment layout, personal/ownership screens, forecasts, newspaper, review/ending screens and shared firm/company Brand studio. 320 firm/fund checks passed; automatic build OK. Disposable 1280px/390px/832px navigation, buy-now trade, all-client calls, rebranding, quarter close and reload passed without errors/overflow. Gameplay/accounting unchanged; founder-life expansion deferred; Harbor Hill untouched; unpublished.
- [x] Current authorized visual phase: stable portraits/logos across opening/resume, staff, investors, calls, committee votes, capital calls, rival/public coverage, offices and endings; historical rebrand receipt resolution and headquarters rebranding controls; rebuilt career-first opening with saved directory and separate classic setup. 320 firm/fund tests passed; full suite 499 passed with unchanged CDNS1993 baseline failure; automatic build OK. Disposable 1280px/390px entry, rebrand, close, reload/resume, section navigation, classic guest play and practice-save isolation passed without runtime errors/overflow. Founder-life Phase 2 remains deferred per clarified scope; no publication or Harbor Hill edits.
- [x] Authorized public-firm increment: primary/secondary IPO proceeds and fees, actual shares/price/equity and purchased-share basis/P&L, dividends, fair-value cancelled buybacks, new equity, corporate loans/interest/covenants/payables, coverage-driven price/reputation, closing history and debt forecast. 315 firm/fund checks passed; full suite 494 passed with unchanged CDNS1993 baseline failure; automatic build OK. Disposable 1280px/390px filing/roadshow/listing, purchases, dividends, buyback, issuance, borrowing, repayment, four-quarter lockup, share sale, news and reload passed without runtime errors/overflow. Own-manager shares remain outside the client fund to avoid circular NAV. Phase 2 remains paused; Harbor Hill untouched; unpublished.
- [x] Phase 1: seeded age/mood/role portraits, industry/stage logos, company-funded saved rebranding with expiring revenue/offer benefits, explicit old-career upgrade, identity-bearing decisions/news/inbox and recorded outcomes. 300 firm/fund checks passed; full suite 479 passed with unchanged CDNS1993 baseline failure. Disposable 1280px/390px upgrade, firm/company rebrand, choices/outcomes, close/reload and no-overflow flows passed; automatic build OK. Harbor Hill untouched; unpublished.
- [x] Phase 2: Founder creation, background, aging/health, relationships, spouse/children, life actions. Completed founder/family connections and personal bill forecasts; verification results below.
- [ ] Phase 3: Found and scale businesses, industries, stages, CEOs, rounds/cap tables, competitors, era sentiment, ownership tree.
- [ ] Phase 4: Public-company chapter, shares/prices, guidance/calls, buybacks/offerings, staff equity, take-private/chairman, subsidiary IPOs.
- [ ] Phase 5: Ethical choices, delayed investigations, compliance, lawsuits and whistleblowing.
- [ ] Phase 6: Media fame, fictional wealth ranking, foundation, sports teams, auctions and possessions.
- [ ] Phase 7: Heir succession, inheritance, generations/family tree and legacy cards.
- [ ] Phase 8: Ribbons, gradual unlocks, integrated briefings, guide and final 30+ quarter verification.

## Eight-phase implementation status (code audit, Nov 9)
Status describes each item in the approved Life and Empire plan, not the older firm-career phase numbering. Partial means existing related systems do not yet implement the whole item. Later phases remain unauthorized for this turn. Existing public-firm, personal-business and rich-list increments are included.

| Phase | Plan item | Status | Current evidence / remaining scope |
|---|---|---|---|
| 1 | Expressive seeded portraits with age, mood, role and hairstyles | Done | `faces.ts`, `Portrait.tsx`, avatar choices |
| 1 | Industry/stage logos across firms, targets and rivals | Done | Shared `Logo` and identity lookup |
| 1 | Saved rebranding, three alternatives, owner-paid cost and expiring benefit | Done | `brand.ts`, Brand studio |
| 1 | Consistent person/company identities in decisions and news | Done | `identity.ts`, `SenderIdentity` |
| 1 | Identity-bearing choices and persisted outcomes | Done | Life, founder and career decision records |
| 1 | Identity/rebrand/accounting and desktop/phone upgrade verification | Done | Prior Phase 1 verification recorded above |
| 2 | Character builder, live avatar, name, age 25–35 and four backgrounds | Done | `FounderBuilder`, `founderSetup.ts`; cash, loan, contacts and stats |
| 2 | Quarterly aging, Health, recovery and escalating health events | Done | `founder.ts`; warnings, hospital, surgery and age-gated death |
| 2 | Dating, marriage/prenup, spouse/divorce accounting, children, education, adult careers and contact memories | Done | Saved romance, spouse entity, owed settlements, child paths and family contacts |
| 2 | Gym, doctor, destination vacations, date night, child time, hobbies and therapy | Done | Shared time budget, cooldowns and personal journal expenses |
| 3 | Startup flow with industry, owner, budget and optional co-founder equity | Partial | Purchased personal ventures and firm targets exist; no full founding/co-founder flow |
| 3 | Specified differentiated industry economics | Partial | Coffee, software and other catalogs; not every requested industry |
| 3 | Six stages from Garage/Cart to Public with goals and evolving logos | Partial | Expansion levels, products and locations; no full six-stage path |
| 3 | Industry events, CEOs, founder time, funding rounds and company cap tables | Partial | Operating events and staff exist; subsidiary CEO/equity/round systems missing |
| 3 | Competitors, roll-ups, era modifiers and ownership tree | Partial | Rival acquisitions and competition; no complete ownership tree/era system |
| 3 | Fair-valued fund investment in an owned private business | Not started | Historical ticker endpoints remain protected; private fund holding unavailable |
| 4 | Continued public operations, ticker/shares/float and quarterly price | Done | `publicBook.ts`, `publicFirm.ts`, public events and trading screen |
| 4 | Equity/AUM/proceeds distinction and authoritative founder share mark | Done | Public ledger and shareholder basis/P&L |
| 4 | Guidance, earnings calls and portrait-bearing analyst ratings | Partial | Earnings reports, analyst events and coverage; no guidance/call action |
| 4 | Buybacks, secondary issues, staff equity, take-private, chairman, activists and subsidiary listings | Partial | Buybacks/issues and activists exist; staff equity, take-private/chairman/subsidiary IPO missing |
| 4 | Explicit listed-career upgrade preserving ended status/proceeds | Done | Public management opt-in and existing status guards |
| 5 | Temptations with saved seeded exposure | Not started | Operational crises are not the ethics expansion |
| 5 | Delayed investigations/charges, fines, redemptions, bans/prison and legal costs | Partial | Legal costs, crises and redemptions; no exposure-driven investigation lifecycle |
| 5 | Compliance staff, misconduct, lawsuits and whistleblower choices | Not started | No dedicated system |
| 5 | Fictional choice-driven wrongdoing safeguards | Not started | Constraint remains mandatory when ethics is implemented |
| 6 | Interviews, books/royalties, podcasts, magazines and investor effects | Partial | Interviews, coverage, fame and funded demand; books/podcasts missing |
| 6 | Wealth ranking with permitted friend data or local fictional fallback | Partial | Local real-person rich list from later owner request; no friend ranking |
| 6 | Foundations/grants, sports teams/stadiums and rival art bidding | Not started | Donations/possessions do not implement these entities |
| 6 | Extended personal possessions with upkeep, one-copy and anti-flip rules | Done | `life.ts` catalog and ownership/sale tests |
| 7 | Optional heir continuation, inheritance/tax transfers and retained relationships | Not started | Retirement handover exists but does not continue as an heir |
| 7 | Generations, family tree and per-founder legacy/obituary | Partial | Ending/museum records; no generations or family tree |
| 7 | Preserve endings; succession explicitly opt-in | Partial | Existing ended saves remain ended; dynasty action not built |
| 8 | Earned ribbons, integrated briefings, gradual unlocks and guide | Partial | Quarter briefing exists; ribbons/unlock journey missing |
| 8 | Full career journey and exact limitations report | Not started | Final 30+ quarter business/ethics/dynasty gate awaits those systems |

Phase 2 verification: 385 firm/fund checks passed; full suite 564 passed, with only the unchanged baseline CDNS1993 expected-5/data-0 failure. Automatic preview build passed. Disposable desktop/390px character creation, avatar choice, gym, close and save/reload passed with no page errors or horizontal overflow. Marriage, divorce, health, school, adulthood, determinism, branch isolation and ended-action guards have focused tests. No publication, live-save edits or later-phase build work.

# Client Contracts firm career (Nov 1)
- [x] Public-company valuation: live completed-return, benchmark, managed-asset scale and reputation earnings multiples, retaining consolidated cash/debt neutrality and private valuation. Seven regressions and all 288 firm/fund checks passed; disposable public career moved from $243.40M to $257.26M after a quarter and reloaded at the same value, no runtime errors. Automatic build OK; not published.
- [x] Connected performance-backed fame to capacity-limited investor offers, bounded expiring coverage of trailing rivals and incoming manager retention salaries. Six regressions and all 281 firm/fund checks passed; disposable preview accepted $328.3M at unchanged NAV, preserved it after reload and displayed pay premiums without runtime errors. Automatic build OK; no publication.
- [x] Current immersion request: autonomous external staff retainers with separate receipts/forecast, performance-driven demand/prestige/fame, bulk client calls, immediate career trading, headquarters image and avatars/emblems, navigation reduced from 16 to 11 destinations, six luxury purchases and software/resort/marina operations. All 275 firm/fund checks passed; full suite 454 passed with unchanged CDNS1993 baseline failure. Disposable desktop/390px trades, calls, staff earnings, cruise ship and reload passed without runtime errors. Existing saves opt into service revenue/stronger competition explicitly. No publication or live-save edits.
- [x] Current request: 22 individual possession photos, direct section navigation, IPO readiness/float/proceeds/opening bell, and capacity-limited investor requests after two strong benchmark-beating years. All 263 firm/fund tests passed; disposable desktop/390px purchase, IPO, reload and navigation verified without runtime errors. No publication or live-save edits.
- [x] Current request: company cash/profit bridge and chart, full retention, quarterly sector news with signed sentiment and actual ticker price reactions preserving annual endpoints, delegated all-client sessions with firm costs and cooldowns; desktop/390px purchase, losses/integration, $358K retained cash, sessions, newspaper and reload verified, no runtime errors. Firm/fund regressions passed; full suite retains the baseline CDNS1993 mismatch. No publication or live save edits.
- [x] Priority save correction: pre-trade legacy basis migration preserves proceeds and estimated split; 8 new regressions, 234 firm/fund checks, live in-memory reproduction/reload passed. Full suite: 413 passed, unchanged CDNS1993 mismatch failed. Automatic build OK; no stock data edits or publication.
- [x] Requested expansion: saved expiring newspaper mood/rival effects without changed historical prices, whole-balance fund-paid client fee contracts, rival-manager acquisition facilities and atomic business refinancing; 249 firm/fund checks and desktop/390px disposable settlement/reload flows passed. Full suite 428 passed, only baseline CDNS1993 mismatch failed; automatic compilation passed, no publishing or Harbor Hill edits.
- [x] Phase 1: firm career foundation (journal, three scenarios, onboarding, workspace, payroll/office/salary, distributions, legacy conversion, branches)
- [x] Firm cash runway forecast: project when firm cash may fall short of payroll and office
- [x] Phase 2: people and clients (hiring, morale, client relationships, idea pipeline, board votes, consequential inbox)
- [x] Firm reserve raised to three quarters of bills, shown in the forecast
- [x] Phase 3: calendar quarters with real event timing, mid-quarter trades, capital commitments/calls (regular + deal), fictional business acquisitions
- [x] Staff revenue attribution, topic-based client calls, new clients from performance, fictional rival rankings, pitching rival clients
- [x] Founder salary schedule, staff potential and tenure growth, fair-pay morale, rival alerts and client theft, size-based client tiers
- [x] Phase 4 (client money): quarterly contributions, funded calls, new clients with commitments, rival pitches/referrals with rival assets, phone quarter cards
- [x] Phase 5: activists, crises, newspaper
- [x] One-click Simulate quarter, plan strip, result card; workspaces (Office, Investments, People, My Life, Books) with tabs; 390px nav without More
- [x] My Life: 22-item catalog, upkeep/resale/forced sale, time budget, 8 life actions, 14 life event templates, relationships, reputation, net-worth chart
- [x] Firm office tiers with fit-out, rent, desks, research and client effects
- [x] Staff: research for every role, training, delegated sleeves with real fills and reviewed P&L, hire forecast preview
- [x] Cap table, partner buy-ins, stake sale, two-stage IPO, retirement, ending page and career museum
- [x] Forecast rebuilt: balance line + flow bars, horizon, scenarios, what-ifs, personal book
- [x] Client book: saved profiles (fictional wealth, one-manager cap, risk, position limit, excluded sectors, patience, history), capacity enforced on every inflow, explainable quotes, five meeting agendas with time/cost/cooldowns, lockup and mandate negotiation, promises, mandate reviews with redemption after lockup
- [x] Company deals: offer/counter/reject/rival bid, paid diligence with findings, renegotiation, expiry, loans with covenants/default/foreclosure, levers (pricing, capacity, reinvestment, cash kept), saved statements with 8 simulated pre-acquisition quarters, sale/closure waterfall and archive
- [x] Buying a rival investment manager: firm-cash price for the fee business, consenting mandates subscribe at NAV, staff join, rival removed from competition
- [x] Constitution (position limit, reserve, payouts, client service, vote threshold) with weighted amendment votes; partner morale/loyalty, disputes, meetings, personal buyouts, firm buybacks, outside sales; votes for manager deals, sale of control, IPO and succession
- [x] IPO now file -> roadshow -> list -> lockup; invalid float/share/offer/loan inputs rejected in the pure functions
- [x] Review corrections (Nov 1): receipt-based staff fills/P&L and live sleeves with firm-wide 15% cap; past-only skill-dependent research; close-period stamping, stale life state, separate time promises, immutable purchase prices; saved client offer terms settled exactly; deal closing bridge with diligence liabilities and funded-loan suggestion; position limit at execution over all orders; handover record instead of fund verdict after sale/retirement; descriptive life and meeting buttons
- [x] Per-client management fees: opt-in for existing saves, effective next quarter, paid from whole fund-invested balance; performance fees unchanged and shared management charge replaced, never duplicated
- [x] Owned-business refinancing and rival-manager financing: shared amortization/interest, reserve and coverage checks, saved payoff bridge, covenant penalties/default and fee-entitlement collateral without client-asset seizure
- [ ] Ideas approved before this update have no trade receipts, so their actual P&L shows as no fill (their old one-year review remains)

# Client Contracts deeper pathways (Oct 29)
- [x] Add past-only company research, watchlists and research-to-trade actions
- [x] Add adjustable liquidity reserves and safe temporary practice branches with live comparison
- [x] Verify guest research, branch isolation/return and completed results, reload and watchlist persistence, all four workspaces at five widths; no runtime errors; not published

# Client Contracts interactive upgrade (Oct 29)
- [x] Add a custom allocation lab, hypothetical stress tests and interactive committee conversations
- [x] Add animated quarterly recaps, focused workspace tabs and richer company discovery
- [x] Verify guest trades, quarter progression, save/resume and 40-quarter results; 38 tests, five screen widths and reduced-motion passed; not published

# Client Contracts board upgrade (Oct 29)
- [x] Add large-capital new funds, timed board mandates and diversified-company expectations without changing old saves
- [x] Add fictional board portraits, performance/allocation/risk charts and board reviews
- [x] Verify accounting, board deadlines, real stock trades, save/resume and complete fund results; 34 tests and a 40-quarter guest run passed; not published

# Focused SEO review (Oct 24)
- [x] Generate same-component noindex 404 artifact and document hosting catch-all limitation
- [x] Improve verified real-estate setup explanation, homepage schema and teacher guidance
- [x] Correct methodology facts, public preview policy and content-source sitemap dates
- [x] Run focused SEO tests, actual prerender-writer fixture and guest navigation; do not publish
- [ ] True HTTP 404 for unknown live URLs: blocked by hosting catch-all, no supported repository configuration

# Social multiplayer expansion
- [x] Re-read the re-uploaded complete specification and preserve staged implementation requirements
- [x] Friends signed-in loading, unchanged settings save/read-back and username search verified in local preview without console errors
- [x] Explicit private social grants verified: anon reads and direct presence writes denied, match create/join disabled
- [ ] Verify friend request/accept/block/presence with two consenting accounts
- [ ] Resolve private legacy-room isolation and atomic round/rematch lifecycle before enabling challenges
- [ ] Review phased implementation plan with owner
- [ ] Phase 1: profiles, friends, invitations, fair matches, instant rematches and verified head-to-head results
- [ ] Phase 2: private notifications, messaging, rivalry, friends leaderboards and opt-in activity
- [ ] Phase 3: leagues, tournaments, verified ranked matchmaking and progression
- [ ] Phase 4: accessibility, responsive polish, performance and multiplayer recovery checks

# Oct 14
- [x] Reduce dashboard automatic reporting requests and verify manual refresh (8 tests passed; real dashboard loaded once, manual refresh loaded again)
- [x] Reduce public leaderboard refreshes to two hours, add delayed-results notice, and verify caching and retry behavior (4 tests and live preview passed)
- [x] Sandbox AI payment failure: shared safe errors, refunded payment allowance, owner-controlled pause; 4 regression tests and guest UI generation passed
- [x] Growth plan: research audience and recommend where to start
- [ ] Client Contracts revamp (real stocks, quarter steps, 10/15/20y) — plan awaiting approval

# Oct 12 brief — data fixes, fairness, Client Contracts
- [x] Stage 1a: Intel 2024 → −60.10%, S&P 500 2008 → −37%, source text fixed, data version 2 + tests
- [ ] Stage 1b: label pre-correction leaderboard runs; yearly recap 10-entries fix
- [ ] Stage 2: versioned challenge manifest + server action replay; legacy challenge badge
- [x] Stage 2: multiplayer server clock, host-only pause, server-checked player syncs (live-tested)
- [x] Stage 3/4: Client Contracts engine (units at NAV, fees/HWM, liabilities, Normal + Hard, recurring 5-tier fundraising, reviewed seeds) + 18 tests
- [x] Stage 5a: Client Contracts workspace at /client-contracts (allocation policies, rebalance preview, payment calendar, inbox, journal, results, practice replay, save/resume)
- [ ] Stage 3b: server-held seeds and ranked Client Contracts scoring (runs are unranked practice until then)
- [x] Stage 5b: multi-asset auto-invest in Basic + Advanced, optional yearly pause (solo)
- [ ] Stage 5c: grouped deposit notices, labeled synthetic intra-year volatility
- [ ] Stage 6: full browser regression (keyboard, guest, saves, retries)

# Roadmap — site-wide refinement brief (Sep 29)

Privacy, security and legal foundation (Oct 7 brief):
- [x] Audit live access and current privacy behavior; provider/auth settings remain unverified
- [x] Confirm owner facts and approve staged implementation
- [ ] Secure administration and private/public data boundaries
- [ ] Add tracking choices, public-sharing controls, export/deletion and retention
- [ ] Add accurate legal/contact pages and contextual notices
- [ ] Harden public writes, account recovery, moderation and ranked verification
- [ ] Verify privacy/security behavior and record external blockers

Verified privacy increments:
- [x] Restrict private email queue RPCs to server callers
- [x] Private suggestions by default with stored publication consent
- [x] Optional analytics preference and requested AI reviews
- [x] Draft legal/contact pages and footer privacy settings
- [x] Auth-scoped export RPC and device-data clearing
- [x] Requested public aliases and individual owned-run deletion controls
- [x] 19 privacy/accounting/save regression tests and desktop/mobile consent/legal checks
- [ ] Revoke deprecated room readers after replacement frontend publication (blocked by no publish request)
- [ ] Admin account/MFA transition (blocked by owner enrollment selection)
- [ ] Retention/legal finalization (blocked by retention approval, jurisdiction, child-privacy process and provider facts)
- [ ] Full account deletion and complete competitive-score privacy/revocation (requires a scoped lifecycle design; not claimed complete)

Admin dashboard refinement (Oct 7):
- [x] Choose one of three charcoal/emerald, Sora/Manrope sidebar designs
- [x] Implement chosen dashboard with clearer navigation, actionable insights and existing admin tools
- [x] Verify navigation, live statistics, CSV exports, refresh recovery and AI control failure handling without changing live AI settings

Done (stage 1 — functional fixes):
- Advanced search has separate Watch and Trade actions; room chat is available to hosts and players in lobby and gameplay with private credential checks
- Host game: interactive chart zoom, clearer year/quarter labels, stable player colors, refreshed standings and a room invite action
- Opening fact is now a larger pre-game feature card; tutorial remains available from an unobtrusive in-game help control instead of opening automatically
- Shared buy limit (cash + Bitcoin cap) for Max, shortcuts, input, preview, confirm and execution; no silent partial fills
- Sandbox: Duplicate creates a distinct "(copy)" and keeps the original; Replay replaced with "Start a new scenario"
- Leaderboard: separate loading / empty / stale / error states, Retry, timestamp only on success; results no longer treat a failed request as an empty board
- Company count derived from the real list; random homepage ticker removed; fake loading bar removed
- Pause overlay → persistent paused bar; unlocks + year changes are in-page notes and never stop the clock
- Results show immediately with naming beneath
- Accurate solo vs multiplayer price note; shared-result link validation + "not verified" label
- Card tilt, hover lift/scale and glows removed; button text contrast fixed (dark text on emerald/violet)

Growth brief (Sep 30) — stages in order:
- [x] 1a Saves never silently deleted; leaderboard shows Return on phones when sorted by return
- [x] 1b Sandbox timeline labels + event list; Sandbox examples load their named scenario; mobile HUD labels
- [x] 2 Optional accounts (email + Google), profiles/usernames, guest stays free, run history + import, personal stats
- [x] 3 Beat-my-run challenges (frozen config, server-verified scores), public result pages + share images
- [ ] 4 Friends, presence, challenge invites, live room invites
- [ ] 5 Learn→challenge links, challenge landing pages, retention analytics

Open (stage 2+):
- Desktop side-by-side trade panel; mobile trade sheet (drawer) with keyboard clearance
- Move stock-info and Real Estate trade overlays onto Dialog/Sheet primitives
- Reduced-motion static rendering for the hero canvas and Framer Motion
- Restyle pass: Real Estate, Sandbox, Leaderboard, results, learning pages, 404/unsubscribe/admin; fewer tiny uppercase labels
- Full verification at 390/768/desktop incl. multiplayer reconnect, Hard Mode, before/after screenshots
