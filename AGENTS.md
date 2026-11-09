# Project Architecture Rules

- Pearl button styling uses the shared Button component and globally defined semantic tokens, scoped to its own class, so other controls retain their styling.

- Public leaderboard reads share a bounded in-memory cache and in-flight requests by normalized filters; refresh only when stale, with explicit retry bypass, to avoid redundant reads without storing player data on disk.

- Calculate stock-game return percentages through `calculateInvestmentReturn`; this keeps deposits out of profit everywhere.
- Room chat reads and writes use credential-validated RPCs with a private message table; anonymous group players do not have auth identities and public row subscriptions could expose other rooms.
- Accounts are optional: runs attach to a user only via the submit-run bearer token, and guest runs are claimed by browser session id through `claim_device_runs`; guests must never be blocked.
- Challenge targets come only from stored runs via `create_challenge`, and attempts count only when submit-run confirms years+mode match; clients can never set a target or credit an attempt directly.
- Route head metadata lives only in `src/seo/routes.ts` and is emitted by `RouteHead` (client) and `scripts/prerender.ts` (build); pages add only page-specific JSON-LD, never title/description/canonical/robots/og/twitter tags, so initial HTML and client routing always agree.
- Sitemap <lastmod> comes only from the git commit date of each route's `sources` in `src/seo/routes.ts` (list every content file the page renders); never from the build date, so it is never fabricated.
- Prerendered HTML carries per-route head tags plus, for pages listed in `src/ssr-static.tsx`, the real server-rendered output of the same component visitors get — never crawler-only body copy; private routes get raw-head `noindex,follow` from `NOINDEX_ROUTES`.
- The postbuild validates public head/body/link parity and generates `dist/404.html` from NotFound without canonical or identity schema; this artifact is not a hosting rewrite because Lovable's SPA catch-all ignores repository redirect files.
- Every AI edge function must go through `supabase/functions/_shared/ai-guard.ts` (identify → validate → cache → `consume_ai_quota` reservation → call → shared gateway failure handling); failed payment/quota reservations are refunded and payment blocks persist the existing owner-controlled AI lock, so player allowance is preserved and requests stop until explicit recovery.
- Homepage-path code must not import game engine or return datasets eagerly (use lazy boundaries like `SoloGame.tsx`, `companyCount.ts`); this keeps the first download small.
- Admin dashboard styling is scoped to its workspace shell, and reporting helpers derive insights and CSV exports from the existing private endpoints; this preserves public styling and server-enforced access while preventing invented metrics.
- Admin reporting polling uses the visibility-aware `useAdminPolling` hook, separate from initial loads, and pauses off-screen; collection and security controls remain independent of report refresh frequency.

- Optional analytics uses the central privacy preference; requested saves, rooms and submissions remain independent to preserve guest functionality.
- Legal notices render the same page in the browser and prerenderer; Privacy and Terms are version 1.0 and state only implemented behavior, and any future unresolved fact must be marked as a draft rather than stated as settled.
- Private email queue operations are service-role-only; room polling uses credential-checked RPCs, with legacy readers retired only after the new frontend is published.
- Public suggestions require stored consent, a reviewed summary and explicit publication; responding alone never publishes an original message.
- Personal exports derive ownership from auth.uid() and device clearing preserves auth and privacy preferences.
- Finished runs that fail to save are parked in the service-only `pending_runs` table (and a device queue) and replayed through the same `_shared/runs.ts` rules as `submit-run`; `client_run_id` makes retries idempotent so no game is double-counted.

- Client Contracts fund math lives in `src/lib/fund/` (pure, deterministic per seed; `market.ts` splits real annual returns into quarters whose product equals the real year, independent of player actions); subscriptions/redemptions move units at NAV so new money is never profit, and ranking uses outcome → net investor return → drawdown, never AUM or fees.
- Fund settlement sells liquid holdings evenly to meet everything due before marking it overdue (`sellForCash` in `engine.ts`); closure for overdue payments happens only when liquid assets cannot cover them, so a fully invested fund is never closed for affordable payouts.
- Institutional Client Contracts opt in with optional save fields; board reviews and chart data derive from unit NAV and existing quarterly history, leaving legacy v2 capital and objectives intact for save compatibility.
- Client Contracts previews, stress tests, completed-quarter research and practice branches use cloned state and existing execution; branches are marked practice and never saved, so exploration cannot alter live history, prices, confidence or AI quota.
- Historical return corrections are recorded in `src/data/dataVersion.ts` with a bumped DATA_VERSION and a regression test; runs from older versions are never ranked as equivalent.
- Multiplayer time comes only from the server room clock (`get_room_clock`: server start time minus host pauses via `set_room_pause`); clients catch up or wait, never pause locally, so no player gains time.
- Classroom is a host setting on the multiplayer room record (`classroom`, `chat_enabled`, changed only via host-token `set_room_settings`), not a separate mode; `send_room_message`, `ai-guard` `classroomBlock` (via the `x-rr-room` header) and `processRun` read the room on the server, so a client cannot chat, use AI or post a classroom run to the public leaderboard.

- Social discovery and friend actions use authenticated, block-aware RPCs over private tables; presence writes are RPC-only and opt-in with visibility-aware heartbeats, so private account reads stay closed.
- Account UI consumes INITIAL_SESSION without a duplicate getUser lookup; Friends waits for auth initialization before reads to avoid auth lock contention. Server authorization remains mandatory.
- The stock reducer lives in `src/lib/stockEngine.ts`, shared by the existing hook and staged server simulation; keep solo initialization, saves and legacy room behavior in the hook.
- Social match creation, entry and rematches stay disabled at the service-role grant until private room isolation and atomic lifecycle verification are complete; never award wins from legacy client portfolio snapshots.

- Subdirectories may have their own `AGENTS.md` (e.g. `src/lib/firm/`); read it before changing files there.
- Firm-career client contracts and financing are optional saved extensions with pure accounting helpers scoped to `src/lib/firm/`; fund-paid fees settle through `src/lib/fund/clientFees.ts`, so legacy modes and saves retain their existing rules.
- Career news pricing is a versioned calendar opt-in in `src/lib/fund/news.ts`, preserving ticker annual endpoints and existing-save paths; company reporting and bulk client service reuse the journal and saved meeting rules, never fund assets.
- Sustained-performance investor demand reads completed net-return history only and creates existing capacity-limited saved offers; possession imagery and IPO journey controls are presentation layers over the existing personal-purchase and ownership accounting.
- Career presentation uses `CareerOpening`, `CareerMasthead` and unframed `CareerSection` bands; `BrandStudio` calls validated owning-account rebrands. Views read saved identities without writing money; classic play stays separate on the same route.
