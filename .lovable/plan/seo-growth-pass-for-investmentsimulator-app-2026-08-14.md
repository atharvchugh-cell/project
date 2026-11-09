# SEO growth pass for investmentsimulator.app

## What the data actually shows

Search Console (2026-07-14 → 2026-08-10, verified live just now):

- Homepage is indexed, canonical accepted, robots allowed, last crawled 2026-08-07. No indexing problem to fix.
- 87 impressions, 0 clicks, average position ~49. Nearly all impressions land on `/`.
- Real queries with demand: "invest simulation" (19), "investment simulator" (11), "investing simulator for students" (8), "invest simulator" (5), "investing simulator", "best free stock market simulator".
- `/sandbox` sits at position 2 on one impression; `/leaderboard` position 48.

Read honestly: the site is not being held back by crawling or schema. It is ranking on page 3–5 for its exact-match terms, so there is no CTR problem to fix yet — there is a relevance and page-depth problem. Every change below targets that.

Codebase findings (verified):

- `public/sitemap.xml` is hand-edited; `/for-teachers` has no `lastmod`, other dates are hand-set and will keep going stale. No generator script exists.
- No pre-rendering. `/guide`, `/for-teachers`, `/real-estate-game` depend on Helmet at runtime, so the static HTML crawlers fetch has the homepage title and description on every route.
- `index.html` carries a `keywords` meta (ignored by Google) and a large FAQPage block (no rich result since May 2026).
- Only two educational pages exist: `/guide` and `/for-teachers`. Both link to each other; no hub.
- Real H1s exist on all key pages; heading structure is sound.

## What I will change

### 1. Static pre-rendering for the SEO pages (highest impact)

Add a post-build pre-render step that boots the built app and writes real static HTML for `/`, `/guide`, `/for-teachers`, `/real-estate-game`, and the new content pages. Each file ships its own title, description, canonical, OG tags, and body copy before JavaScript runs. The app still hydrates normally, so no game behavior changes.

Guard: game routes (`/sandbox/*`, `/leaderboard`, `/share`, admin) are excluded from pre-rendering.

### 2. Generated sitemap, no stale dates

Add `scripts/generate-sitemap.ts` wired to `predev` and `prebuild`, replacing the hand-edited file. Entries derived from the actual route list. `lastmod` only where an authoritative page-specific timestamp exists; otherwise omitted rather than faked.

### 3. A real Learn hub plus two new pages

Create `/learn` as a crawlable hub linking every educational resource, and two pages that answer demand visible in the query data and add material the site does not have yet:

- **Stock market game for high school students** — what a class period actually looks like, what students do minute by minute, what they learn, links into the simulator and classroom mode.
- **How diversification works** — explained against the simulator's own asset set (S&P 500 fund, individual stocks, gold, oil, CDs, HYSA), with a worked example using the historical data the game already uses.

Both include a byline, last-reviewed date, sources, and an educational-use disclaimer. Two pages only — no keyword-variant page farm.

### 4. Methodology and About

Add `/methodology`: where the historical stock, index, gold, oil, CD, housing, and rate data come from, how the engine converts annual history into in-game price movement, what is simplified, and the educational-use disclaimer. Link it from `/guide`, the new pages, and the footer. This is the trust signal that finance content needs, and it is the page most likely to earn a link.

### 5. Internal linking and architecture

Footer and header get crawlable `<a>` links in a clear structure: Simulator, For Teachers, Learn (hub → resources), Other Simulators (Real Estate, Sandbox), Methodology. Contextual links added inside `/guide` and `/for-teachers` with descriptive anchor text. No repeated keyword anchors.

### 6. Titles and descriptions

Only where the current text is demonstrably weak: give `/leaderboard` and `/sandbox` accurate self-describing titles, and set unique ones for the new pages. Homepage title stays — it already matches the queries it ranks for; changing it now would discard the only signal we can measure.

### 7. Cleanup

Remove the `keywords` meta. Keep FAQPage markup but stop treating it as a ranking lever. Verify canonicals self-reference on every route, confirm no accidental noindex, check image alt text and lazy loading on the new pages.

## What I will not do

- No homepage redesign, no game logic changes, no rewriting of pages that already follow best practice.
- No invented statistics, testimonials, credentials, or usage counts. Any number shown publicly comes from real data or is not shown.
- No doorway pages or near-duplicate keyword pages.

## Validation

Production build, existing vitest suite, pre-rendered HTML inspected for correct per-route head, structured data validated, sitemap URLs checked against the router, and a Playwright pass over solo play, classroom host/join, and the real-estate game on mobile and desktop viewports.

## Report at the end

Findings, changes and their rationale, the Search Console opportunities above, anything still needing manual action, and the next three highest-impact actions.

## Technical notes

- Pre-rendering runs as a `postbuild` step over the Vite `dist` output; no framework migration, no SSR server. Accurate per-page social previews for non-JS crawlers become possible as a side effect.
- New pages are lazy-loaded route components matching the existing `App.tsx` pattern, with per-route `Helmet` heads for the client and pre-rendered heads for crawlers.
