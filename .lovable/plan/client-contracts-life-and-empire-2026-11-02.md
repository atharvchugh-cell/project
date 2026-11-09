# Client Contracts: Life and Empire

## Delivery
Build the uploaded eight-phase brief in order, extending the existing career rather than replacing it. Complete and verify one phase before starting the next. If a phase fills a turn, stop only when it is complete and resume the next phase when you say “continue.” Keep the eight phases in the firm roadmap.

Existing company operations, client relationships, fame, staff, loans, acquisitions and IPO journey remain in place. The recently added public valuation remains the accounting foundation, not a feature to discard.

## Safeguards
- Keep free guest play, one-click Simulate quarter, all other modes, historical stock/index data and annual endpoints unchanged.
- Keep fund, firm, founder and each company or new entity separate. Every cash movement uses the existing journal or fund subscription/redemption accounting. Bills remain owed until paid; no double charges or waived shortages.
- Add optional, versioned state. Existing careers receive new simulation systems only through an explicit **Upgrade this career** choice that preserves balances, history and status. Ended careers stay ended. Practice branches clone all expansion state without modifying the live career.
- Use seeded SVG faces/logos and template stories, not runtime AI, image generation or paid services. Preserve existing media unless replacement is required by this brief.
- Preserve charcoal/navy/ivory/brass styling, reduced motion, and readable 1280px/390px layouts without sideways scrolling.
- Use disposable careers only. Never edit Harbor Hill or publish.

## Phase 1: Faces and logos everywhere
- Upgrade Portrait while retaining existing props and recognizable seed traits; add optional age, mood and role. Add facial features, six or more hairstyles, accessories, aging and expressive outfits.
- Add seeded industry logos with shapes, palette tokens, monograms and stage-based evolution. Show logos for the player firm, owned companies, targets, rivals and competitors currently represented in the game.
- Add saved rebranding: three seeded alternatives and editable name, a cost paid by the owning company's account, and an expiring brand benefit. Renaming preserves entity IDs, ownership and history.
- Resolve identity consistently across clients, staff, prospects, rival managers, lenders, reporters, regulators, contacts, notices and stories. Later phases reuse the same system for their new people.
- Give decisions/life events a face or logo, short story, consequence-bearing choices and persisted outcome. Preserve existing rules and option sets where reducing choices would remove a valid action.
- Finish only after deterministic identity/rebrand/accounting tests, existing regression checks, and desktop/phone identity, choice, reload and upgrade flows pass.

## Phase 2: Founder as a person
- Add character creation with live portrait preview, name, age 25–35 and the four specified backgrounds. Each background has concrete opening-cash, personal-obligation, starting-contact and story differences.
- Add quarterly aging and Health alongside existing life stats, recovery activities and escalating low-health warnings/events.
- Extend existing relationships with dating, marriage/prenup, separately accounted spouse/divorce, children and education, adult careers and contacts with memories.
- Add gym, doctor, destination vacations, date night, child-specific family time, hobbies and therapy using existing time/cooldown rules.

## Phase 3: Found and scale businesses
- Add startup flow with founder/firm ownership, industry, logo, budget and optional co-founder equity. Retain purchased targets and current business operations.
- Add the requested coffee/restaurant, streetwear, app/SaaS, gym, development, hardware/EV, biotech and media economics; sports teams unlock in Phase 6.
- Add six stages from Garage/Cart to Public with actual goals, expansion costs, new operating levers and evolving logos.
- Add seeded industry events, CEOs with ability/pay/equity and founder-run time costs, company-specific funding rounds and reconciled cap tables.
- Add competitors/roll-ups, past-calendar era demand/funding modifiers and the ownership tree.
- Disclosed fund investment in an owned private business uses a separately accounted, fairly valued holding, never a fabricated historical ticker return; retain every existing historical endpoint.

## Phase 4: IPO as a new chapter
- Keep operating after IPO, as the current career already does. Add ticker/share count/float and quarterly simulated share pricing from real company earnings/growth, completed S&P quarter and bounded seeded noise.
- Keep a clear distinction between company equity, client AUM and IPO sale proceeds; founder net worth and share sales use the same saved public mark.
- Add quarterly guidance, earnings calls and portrait-bearing analyst ratings with outcomes tied to actual earnings.
- Add cash-funded buybacks, dilutive secondary offerings, staff equity, take-private, chairman transition and public activists; public-stage subsidiaries get their own listings.
- Upgrade existing listed careers explicitly without reopening ended careers or changing earlier IPO proceeds.

## Phase 5: Ethics and consequences
- Add templated temptation choices with clear upside/risk and saved seeded exposure records.
- Add delayed inquiry/investigation/charges, traceable fines, redemptions, bans/prison and legal expenses.
- Add compliance staff, staff misconduct, client/employment/product lawsuits, settlement/fight and whistleblower choices.
- Keep all wrongdoing fictional and choice-driven; no future market knowledge or operational instructions for real misconduct.

## Phase 6: Fame, power and legacy activities
- Add interviews, books/royalties, podcasts and magazine coverage connected to real results and existing capacity-limited investor flows.
- Add a fictional wealth ranking; include friend career results only where existing private permissions and available data permit it, otherwise keep it local and fictional.
- Add separately funded foundations/grants, sports teams with expenses/results/value and stadium choices, and seeded rival art bidding.
- Extend possessions through existing personal-cash/upkeep/one-copy/no-profitable-flip rules.

## Phase 7: Dynasty and endings
- Add optional heir continuation after retirement, death or prison, with inherited ownership/assets, explicit tax/account transfers, heir-specific identity/stats and retained relationships/enemies.
- Add generation tracking, family tree and real-history legacy card/obituary for each founder.
- Preserve existing ending records and existing ended saves; succession is an explicit action, never silently reopening them.

## Phase 8: Goals and polish
- Add earned ribbons for concrete saved outcomes, integrated life/family/business briefings and gradual unlocks with a short contextual guide.
- Verify the complete career journey and report exact results plus any limitations; do not present unimplemented pathways as complete.

## Technical implementation
- Keep new pure helpers scoped to `src/lib/firm/`, with tests beside each new module and one architecture rule per module in its AGENTS.md.
- Extend the existing close pipeline with seed+quarter+entity randomness and close-ID idempotency. Explicit actions validate finite inputs, affordability, ownership, cooldowns and status before atomic journal changes.
- New entity holdings, funding rounds and public shares each have one authoritative ownership/value calculation reused by transactions, net worth, forecasts and displays.
- Use stable entity identity rather than display names for seeds and references. Add safe optional-state parsing and upgrade tests before new close behavior.

## Verification gates
Each phase runs focused deterministic tests and relevant firm/fund checks, then the full existing suite with the known CDNS1993 expected-5/data-0 mismatch reported separately and unchanged. Use automatic preview typecheck/build feedback. Verify real actions and reload in disposable 1280px and 390px careers, including account reconciliation, idempotent closes, old-save upgrade and practice isolation.

The final gate spans 30+ quarters with a mid-run reload: create a founder, grow a coffee cart to at least Regional, raise funding, hire a CEO, marry/have a child, encounter ethics consequences, IPO the firm, hold an earnings call and continue into dynasty mode. Validate no runtime errors, clipping or horizontal scrolling. No publication.