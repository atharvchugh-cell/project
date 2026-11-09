# Rise to Riches social multiplayer

## Goal
Build the complete friends → challenge → match → results → instant rematch experience inside Rise to Riches, then expand it into the broader social and competitive ecosystem. Deliver working, tested stages, not mockups or inactive controls. Nothing will be published without approval.

## Preserve
- Free guest play and existing room codes, links, simulations, saves and account controls.
- The current dark financial design and the three main navigation links. Put social destinations in one signed-in account/social menu rather than crowding the header.
- Server-controlled multiplayer timing, deposit-excluding return calculations, historical data versions and hidden information.
- Classroom settings: host-controlled chat, no AI feedback and no public leaderboard posting. Joining a Classroom never requires an account or social profile.
- Private accounts and activity by default. Social discovery, presence and sharing are explicit choices. Never expose email or private holdings.
- Existing low-frequency leaderboard and dashboard updates. No automatic AI calls or paid ads.

## What the current app already supports
Optional accounts with unique usernames, private profiles, secure room entry, host controls, room chat, live standings, saved solo results and shareable solo challenges already exist and will be reused.

Friends, social invitations, persistent match records and rematches do not exist yet. Multiplayer results currently come from client-synced portfolio snapshots. Those snapshots alone are not sufficient proof of fair play, so verified competitive results need server-validated actions before wins, rivalry records or ratings are awarded.

## Stage 1: Complete friend challenge and rematch loop

### 1. Private social identity and friends
- Extend existing profiles with avatar, optional bio, visibility, request permissions and hidden-by-default presence.
- Add a dedicated Friends view: username search among opted-in profiles, invitation links, requests, accept/decline/cancel, remove, block and report.
- Show only permitted profile statistics and mutual friends. Guest participants keep nicknames and do not receive forced accounts.
- Provide actual connected-session status for consenting friends. Never substitute invented online players.
- Add the minimal notification inbox needed for friend requests, match invitations and rematch responses now; expand it in Stage 2.

### 2. Private friend challenges using existing rooms
- Challenge one friend or invite several friends from the Friends view, profile or existing lobby.
- Support accept/decline, expiring invite links, room codes and Quick Challenge with existing fair defaults.
- Offer historical period, duration, existing difficulty and supported asset/restriction settings. Validate equal capital and deposits on the server. Do not introduce unsupported elimination or spectator mechanics.
- Keep invitations distinct from existing beat-my-run challenges so old links continue to work.
- Use a shared match configuration and randomness so competitors get identical market movements and scheduled events, not independently randomized conditions.

### 3. Verified matches and live comparison
- Validate new social-match trades, capital movements and completion on the server using the shared match configuration and clock.
- Record an immutable, versioned result once per participant and round. Repeated saves return the same result rather than awarding another win.
- Preserve the existing game calculations through shared logic; do not silently recalculate old scores or change legacy room behavior.
- Display portfolio values, investment returns, rankings, comparison charts and subtle real overtaking updates. Never return opponents' private holdings to these views.
- Support reconnect and interrupted result saving. Pending or incomplete results never become wins or ranked points.

### 4. Instant rematches and series
- Put Rematch first on multiplayer results. Request another round with the same settings, or choose/randomize a new period.
- Keep the same lobby and participants while creating a distinct round, resetting portfolios only after participants accept.
- Add best-of 3, 5 and 7 and configurable series, with a persistent running score and round history. Ties remain ties rather than fabricated wins.
- Handle simultaneous rematch requests, declined invitations, departed players and duplicate clicks atomically.
- Show winner, validated final values and returns, performance comparison, investing highlights and head-to-head record. Offer rematch, change settings, analysis, permitted sharing and return to lobby.
- Guest rematches remain available through room credentials; account-based rivalry history applies only to linked participants.

### Stage 1 acceptance checks
Use separate host/player browser contexts with real accounts plus guest participants: find friend → accept request → invite → join → play → validate results → rematch → finish series. Also test blocking, unauthorized room/profile access, repeated result submissions, simultaneous rematch requests, reconnect, guest access and Classroom on/off behavior.

## Stage 2: Social engagement and safety
- Add private direct and group messaging, permitted lobby reactions and the expanded notification center with unread counts and preferences.
- Reuse room chat where applicable, including Classroom restrictions. Add server-enforced blocking, reporting, spam limits and moderation workflows before opening new communications.
- Build rivalry dashboards, permissioned friends/weekly/monthly/head-to-head leaderboards and opt-in result cards and activity posts with reactions/comments.
- Only show metrics supported by stored validated results. Do not invent risk-adjusted statistics or tournament history.
- Include new social data in export/deletion controls and accurately update privacy notices as each feature becomes available. Do not invent retention promises.

## Stage 3: Competitive ecosystem
- Add private leagues and clubs, membership invitations, scoped organizer/moderator permissions, scheduled competitions and season records.
- Add knockout and round-robin tournaments with server-controlled advancement, published tie/forfeit rules and reconnection handling.
- Build casual and ranked matchmaking separately using a proven skill-rating implementation. Offer existing play or private challenge links when no human opponent is available.
- Award divisions, achievements and progression only from verified eligible matches. Add anti-farming protections and atomic rating updates.
- Browser push remains optional and permission-based; no unsolicited emails or paid integrations.

## Stage 4: Refinement and regression checks
- Polish mobile layouts, keyboard access, reduced-motion animations and fast lazy-loaded social navigation.
- Verify guest play, Basic/Advanced, multiplayer, Classroom, save/resume, privacy/auth, Sandbox and Real Estate still work.
- Test authorization, action validation, result accounting, rematch idempotency, disconnects, series, messaging, league permissions and rating updates.
- Check preview errors, focused tests and generated page metadata after each stage. Report exact verified flows and limitations before requesting publication.

## Technical approach
- Reuse `profiles`, `game_sessions`, `game_players`, existing room RPCs, clock, chat and result-save conventions. Add narrowly scoped social records for relationships, invites, matches/rounds, results, series and recipient notifications; add messaging/league/rating records only in their stage.
- Verify deployed schema before migrations. Every new table gets explicit grants, row-level security and indexes. Sensitive transitions use credential-checked or authenticated server operations with locked search paths, scoped permissions, rate limits and unique idempotency keys.
- Keep guest room tokens private. Account identity comes from validated authentication, never a client-supplied user ID. Do not widen existing profile reads.
- Separate immutable public comparison fields from private action/portfolio data. Competitive replay must validate actual actions, not merely compare two client-submitted snapshots.
- Subscribe only to authorized recipient/room data while the relevant view is active; clean up connections, deduplicate reads and pause off-screen work. Presence must use a secure supported mechanism, not a globally readable channel.
- New social/private utility routes use the shared head registry with noindex and stay out of the public sitemap.
- Document structural decisions in `AGENTS.md`. Run focused accounting/security tests and multi-context browser flows for each delivered stage.

## Delivery and approval boundaries
Approval starts Stage 1 implementation, beginning with security and verified-match foundations. Later stages build on tested foundations and receive their own concise delivery plans before substantial expansion. No unrelated leaderboard edits or site-copy rewrites.

Lovable Cloud currently serves preview and the published app from the same backend. Database changes therefore take effect before frontend publication. Use additive, backward-compatible changes and isolated test records; do not overwrite existing player results or remove old room interfaces.

The app will not be published automatically. Each delivery will identify what works, what was tested, remaining blockers and any operating-cost implications. Ranked play will not be enabled until server score verification is proven.