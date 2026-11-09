import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Database, Calculator, AlertTriangle, ScrollText } from "lucide-react";

const URL = "https://investmentsimulator.app/methodology";
const LAST_REVIEWED = "2026-08-14";

const SOURCES: { label: string; href: string; note: string }[] = [
  {
    label: "S&P 500 annual total returns",
    href: "https://www.slickcharts.com/sp500/returns",
    note: "Research reference for calendar-year index returns. The app stores rounded annual values; a row-by-row source reconciliation is not established here.",
  },
  {
    label: "Gold spot prices",
    href: "https://www.lbma.org.uk/prices-and-data/precious-metal-prices",
    note: "Research reference for precious-metal prices. The game uses a stored annual gold-return table, not a live LBMA feed.",
  },
  {
    label: "Crude oil (WTI) prices",
    href: "https://www.eia.gov/dnav/pet/pet_pri_spt_s1_a.htm",
    note: "Research reference for WTI spot prices. The game uses stored annual returns, not live commodity quotes.",
  },
  {
    label: "Deposit and CD interest rates",
    href: "https://fred.stlouisfed.org/",
    note: "Research reference for interest rates. The game uses stored annual savings and one-year CD rates; two- and five-year CDs add fixed spreads to the one-year rate.",
  },
  {
    label: "Housing-price research reference",
    href: "https://www.fhfa.gov/data/hpi",
    note: "FHFA publishes housing-price indices. The game stores city-price tables for 1990–2020. Their row-level provenance and absolute-price anchors are not independently reconciled; game prices are not verified FHFA data or market valuations.",
  },
  {
    label: "Individual company share prices",
    href: "https://finance.yahoo.com/",
    note: "Research reference for company prices. Game returns come from an uploaded annual-return table spanning 1990–2025 with different company starting years. Its complete provider lineage and dividend treatment are not established here.",
  },
];

const Methodology = () => (
  <>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Methodology & Data Sources — How the Simulator Works",
        description:
          "Data sources and modelling assumptions behind the Rise to Riches investing simulators.",
        author: { "@type": "Organization", name: "Rise to Riches" },
        publisher: { "@type": "Organization", name: "Rise to Riches" },
        dateModified: LAST_REVIEWED,
        mainEntityOfPage: URL,
      })}</script>
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://investmentsimulator.app/" },
          { "@type": "ListItem", position: 2, name: "Methodology", item: URL },
        ],
      })}</script>
    </Helmet>

    <article className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <nav className="mb-8 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Methodology</span>
        </nav>

        <header className="mb-12">
          <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Transparency</p>
          <h1 className="mb-4 text-4xl md:text-6xl font-editorial font-semibold font-normal leading-[1.05] tracking-tight">
            Methodology &amp; data sources
          </h1>
          <p className="text-lg text-muted-foreground">
            This page explains the stored data, source limitations and where the model
            departs from reality. If you are using this in a classroom, this is the page to read first.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Published by Rise to Riches · Last updated{" "}
            <time dateTime={LAST_REVIEWED}>14 August 2026</time>
          </p>
        </header>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Database className="h-6 w-6 text-primary" aria-hidden="true" /> Where the data comes from
          </h2>
          <p>
            The stock datasets span 1990 to 2025, with company histories starting in different years.
            Real-estate city-price tables span 1990 to 2020. Values are stored rather than fetched live.
            Runs with the same data version use the same annual tables; later corrections can change them.
            The links below are research references, not proof that every stored value has been independently verified.
          </p>
          <ul className="space-y-3">
            {SOURCES.map((s) => (
              <li key={s.label} className="rounded-xl border border-border/40 bg-card/30 p-4">
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline underline-offset-4"
                >
                  {s.label}
                </a>
                <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Index, commodity and rate tables contain rounded values; company-return precision varies.
            The stored tables and synthetic paths do not reconstruct historical trading prices to the basis point.
          </p>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Calculator className="h-6 w-6 text-primary" aria-hidden="true" /> How annual history becomes live prices
          </h2>
          <p>
            At normal speed, one stock-game year takes 60 seconds of active time and prices update every six
            simulated seconds. Solo speed controls can shorten wall-clock time; solo yearly pause is optional.
            Multiplayer uses the shared host clock, with host pauses extending the session.
            To get from one annual number to a moving price, the engine builds a path between the start and end
            price for that year, then adds intra-year variation so the line is not a straight ramp.
          </p>
          <p>
            Stored annual returns anchor year-end prices. The moves in between are synthetic, not historical ticks.
            Company availability and first-year anchoring affect the path. Your own return also depends on when
            you buy and sell; it is not automatically equal to the annual return in the table.
          </p>
          <p>
            The stock game starts with $5,000 and adds $5,000 every 15 simulated seconds, four times per year.
            Life-event expenses can deduct cash mid-run. Game CDs use fixed term rates and a 20% early-withdrawal
            penalty. Savings use the stored annual rate table. These are game rules, not real financial products.
          </p>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <AlertTriangle className="h-6 w-6 text-primary" aria-hidden="true" /> What the model simplifies
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>No brokerage commissions, bid-ask spreads, or slippage.</li>
            <li>No taxes — no capital gains, dividend, or interest tax is applied.</li>
            <li>No inflation adjustment; all figures are nominal dollars.</li>
            <li>No separate dividend payments; dividend treatment in the uploaded company-return table is not independently established.</li>
            <li>Orders fill instantly at the displayed price, subject to the game's cash, holding and asset limits.</li>
            <li>Intra-year price movement is generated, not historical tick data.</li>
            <li>The asset menu is a curated subset of the market, not the whole market.</li>
          </ul>
          <p>
            Real estate trades whole property units instantly and omits rent, mortgages, maintenance, transaction
            costs and taxes. These simplifications support discussion, not predictions of real performance.
            Calendar years can create hindsight; differing synthetic paths and life events mean a pair of runs
            is not proof of strategy.
          </p>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <ScrollText className="h-6 w-6 text-primary" aria-hidden="true" /> Educational use disclaimer
          </h2>
          <p className="text-muted-foreground">
            Rise to Riches is an educational simulation using virtual money. It is not investment advice, not a
            brokerage, and not a prediction of future returns. Past performance — including the historical
            performance reproduced here — does not indicate future results. Nothing on this site should be used
            to make real financial decisions.
          </p>
        </section>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-8">
          <h2 className="mb-3 text-2xl font-semibold">Keep reading</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link to="/learn" className="text-primary underline underline-offset-4">All learning resources</Link>
            <Link to="/guide" className="text-primary underline underline-offset-4">Beginner's investing guide</Link>
            <Link to="/for-teachers" className="text-primary underline underline-offset-4">Classroom guide for teachers</Link>
          </div>
        </div>
      </div>
    </article>
  </>
);

export default Methodology;
