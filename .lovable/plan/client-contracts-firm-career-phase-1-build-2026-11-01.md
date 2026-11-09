# Client Contracts: Firm Career, Phase 1 build

The five-phase roadmap stays as it is. This plan builds **Phase 1 only**. Phases 2 to 5 (people, companies, competition, wealth and legacy) stay listed at the end.

## What Phase 1 delivers
A complete, playable career. You open a firm, invest the client fund, earn fees, pay staff and office costs, take a founder salary, close several quarters, and resume where you left off. Today's trading desk, research, stress tests, order previews, benchmark chart and practice branches are all kept.

## 1. Opening finances (per scenario)
Every opening balance below is posted as a journal entry and labelled with where it came from.

| | Institutional | Distressed takeover | Boutique |
|---|---|---|---|
| Client fund assets | $5.0B from anchor investors | $4.0B inherited (concentrated holdings, a locked sleeve, redemption notices) | $400M from seed investors |
| Founder fund investment | $50M (fund units, not spendable) | $20M | $8M |
| Management company cash | $60M (partner capital) | $35M (acquisition working capital) | $6M (founder seed) |
| Founder personal cash | $2.0M (savings) | $1.5M | $400K |
| Starting payroll | about $9M per quarter (6 staff) | about $8M per quarter (6 staff) | about $1.1M per quarter (4 staff) |
| Office | $1.5M per quarter | $1.2M per quarter | $150K per quarter |
| Founder salary | $250K per quarter | $200K per quarter | $60K per quarter |

- Fee rates stay as they are today: 0.25% management fee per quarter, and the performance fee above the high-water mark.
- Each scenario gets at least about 6 quarters of cash runway if no fees came in. In practice, fees cover most costs.
- The founder's fund units are shown separately ("Your stake in the fund"). They are never counted as spendable cash.

## 2. One authoritative ledger
- **Entities:** `fund`, `firm` (the management company), `founder`, `investors` (one per investor) and `market`. Every entity has an `entityId` and an owner field so subsidiaries can be added in Phase 3.
- **Transaction:** id, quarter and date, payer, recipient, category, amount, and source action (e.g. `close:Q7`, `trade:ord-12`, `salary:Q7`).
- Every headline number (fund AUM, firm cash, personal cash, amounts owed) is calculated from the journal. A "How was this calculated?" drawer lists the entries behind it.

### Fee and expense handling (fixes existing double counting)
- The management fee is recognized (accrued) when earned, as an amount the fund owes the firm. Cash moves only when it is paid. The legacy `managerCash` field is no longer counted for careers: fee cash goes to firm cash only, exactly once.
- Payroll, office and founder salary are **firm** expenses. They are never charged to the fund. The fund keeps only its own costs: trading, admin, and the existing costs from today's rules.
- Founder salary and distributions are explicit transfers from the firm to the founder. A distribution is a button, limited to firm cash minus a reserve.
- Practice branches clone the whole career (fund, firm, founder, journal) and are never saved.

### Quarter-close order
```text
1 lock: quarter id must equal career.q, else no-op
2 offers -> redemptions -> locked sale -> trades     (existing engine)
3 market move -> releases                             (existing engine)
4 fund costs + fee accrual -> settle fund liabilities (existing; auto-sell keeps payments on time)
5 fee receipt: fund -> firm
6 firm expenses: payroll, office -> external
7 founder salary: firm -> founder
8 review/confidence -> fundraising                    (existing)
9 post closing balances, NAV snapshot, q += 1, save
```
- Each close carries a `closeId` (`career.id + q`), and journal entries with an already-posted `closeId` are rejected.
- The Close button is disabled while running. Refreshing or retrying cannot settle a quarter twice.
- If the firm cannot cover payroll, an "insolvency risk" decision is created (cut salary, founder capital injection, or skip pay with a morale hit). Solvency is tracked separately from fund confidence.

## 3. Saves
- Legacy fund saves stay as they are and keep playing under their current rules.
- A **"Start a career from this fund"** button creates a separate `firm-career-v1` save. It keeps investor units, NAV, holdings, liabilities, high-water mark and history.
- On conversion, earlier legacy `managerCash` becomes one labelled opening entry ("Prior manager earnings, carried over") credited to firm cash. No fees are awarded after the fact and no past expenses are invented. Starting payroll applies only from the conversion quarter onward.

## 4. Workspace and navigation (working tabs only)
- **Desktop sidebar:** Overview, Investments, Clients, Team, Firm, My Wealth. Competition and later systems are hidden until they are built.
  - **Overview:** briefing from the chief of staff, generated from state (e.g. "Payroll uses 34% of recurring fees", "Northbridge has a redemption notice for Q9"), plus key numbers, the big NAV chart and the "Needs your decision" list.
  - **Investments:** the current trading desk, research, strategy lab, stress tests and practice branches.
  - **Clients:** existing investors, their units, lockups, notices and offers.
  - **Team:** the starting roster with portraits, roles and salaries. You can set the founder salary (detailed hiring and management arrive in Phase 2).
  - **Firm:** firm balance sheet, quarterly revenue vs. expenses, runway and journal.
  - **My Wealth:** personal cash, fund stake, salary history and distributions.
- **Header:** firm name, role, quarter, Inbox, and **Close Quarter**.
- **Mobile:** bottom bar with Overview, Investments, Firm, Wealth and More (Clients, Team, Inbox). No sideways scrolling at 390px.
- **Onboarding:** firm name, fund name, HQ city, philosophy (concentrated / diversified / defensive), scenario, balance-sheet review, then the opening team meeting.
- Philosophies change mandate wording, the starting roster mix, and which offers appear. They are not just percentage bonuses.
- A distinct style used only in this mode: charcoal/navy, ivory text and brass accents. Respects reduced motion. Sound is off by default.

## 5. Room for later phases
Fund confidence (existing, follows money), client satisfaction (a field per investor, unused until Phase 2), employee morale (a field per employee) and firm solvency are kept as four separate values. Entity and owner IDs are ready for Phase 3 companies.

## 6. No runtime AI
All text comes from templates and fixed rules. Portraits are drawn in the browser from each person's seed, so no image generation is needed.

## Technical notes
- New code goes in `src/lib/firm/`: `career.ts` (state, scenarios, conversion), `journal.ts` (entities, transactions, balances, the duplicate guard), `close.ts` (wraps `playQuarter`, then steps 5–9), `briefing.ts`, `roster.ts`. Vitest files sit next to them.
- `src/lib/fund/` stays the investment engine. Fees accrued in career mode settle through `journal` instead of `managerCash`.
- UI goes in `src/components/firm/` (Shell, Sidebar, MobileBar, Onboarding, Overview, FirmBooks, Wealth, Team, Clients, CalcDrawer, Portrait), with scoped CSS. The route stays `/client-contracts` and loads only when opened.
- AGENTS.md gets one rule: career balances derive only from the journal and quarter-close is idempotent per `closeId`. Roadmap.md records the five phases.

## Verification (tests plus browser)
Each item gets a test:
- Subscriptions raise AUM but not return.
- The fee reaches firm cash exactly once.
- Payroll, office and salary hit the correct books.
- The founder's stake is never counted as spendable cash.
- Closing the same quarter twice does nothing.
- A fully invested fund still pays what it can afford.
- Save, reload and resume keep every balance and pending decision.
- Legacy saves still load.
- A branch leaves the live career unchanged.
- The chart matches the recorded NAV history.

A browser run covers a 6+ quarter career at 1280px and 390px, with a reload in the middle. The final report lists what works, which checks ran, and what is unresolved. Nothing is published.

## Later phases (unchanged)
2 People and clients · 3 Companies and acquisitions · 4 Competition and drama · 5 Wealth, office and legacy.
