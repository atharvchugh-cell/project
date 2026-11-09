import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, PieChart, TrendingDown, Layers } from "lucide-react";

const URL = "https://investmentsimulator.app/learn/how-diversification-works";
const LAST_REVIEWED = "2026-08-14";

/** Real calendar-year returns used by the simulator, quoted here as a worked example. */
const YEARS: { year: number; sp500: number; gold: number; oil: number }[] = [
  { year: 2000, sp500: -0.09, gold: -0.06, oil: 0.05 },
  { year: 2001, sp500: -0.13, gold: 0.02, oil: -0.26 },
  { year: 2002, sp500: -0.26, gold: 0.25, oil: 0.57 },
  { year: 2008, sp500: -0.58, gold: 0.06, oil: -0.54 },
  { year: 2009, sp500: 0.26, gold: 0.24, oil: 0.78 },
  { year: 2013, sp500: 0.32, gold: -0.28, oil: 0.07 },
];

const pct = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n * 100)}%`;

const Diversification = () => (
  <>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "How Diversification Works",
        description:
          "A diversification lesson built on the real historical returns used by the Rise to Riches simulator.",
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
          { "@type": "ListItem", position: 2, name: "Learn", item: "https://investmentsimulator.app/learn" },
          { "@type": "ListItem", position: 3, name: "How Diversification Works", item: URL },
        ],
      })}</script>
    </Helmet>

    <article className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <nav className="mb-8 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/learn" className="hover:text-foreground">Learn</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">How diversification works</span>
        </nav>

        <header className="mb-12">
          <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Concept</p>
          <h1 className="mb-4 text-4xl md:text-6xl font-editorial font-semibold font-normal leading-[1.05] tracking-tight">
            How diversification works
          </h1>
          <p className="text-lg text-muted-foreground">
            "Don't put all your eggs in one basket" is where most explanations stop. The useful version is
            more specific: diversification does not raise your average return, it changes how bad your worst
            year is — and that changes whether you are still invested when the recovery arrives.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Written by the Rise to Riches editorial team · Last reviewed{" "}
            <time dateTime={LAST_REVIEWED}>14 August 2026</time>
          </p>
        </header>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Layers className="h-6 w-6 text-primary" aria-hidden="true" /> Two kinds of risk
          </h2>
          <p>
            Owning one company exposes you to two separate things. The first is that company's own fate: a failed
            product, a bad quarter, an accounting scandal. The second is the market's fate: a recession hits
            everything at once.
          </p>
          <p>
            Diversification eliminates the first kind almost entirely and barely touches the second. Hold thirty
            companies and one going to zero costs you a few percent instead of everything. But if the whole market
            falls 40%, thirty companies fall with it. This is why spreading across{" "}
            <em>different kinds of assets</em> — not just more stocks — is the part people skip.
          </p>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <TrendingDown className="h-6 w-6 text-primary" aria-hidden="true" /> The years that prove it
          </h2>
          <p>
            These are the actual annual returns the simulator uses for the S&amp;P 500, gold, and crude oil.
            Look at what disagrees with what.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border/40">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Annual returns for the S&amp;P 500, gold, and crude oil in selected years
              </caption>
              <thead className="bg-card/60 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Year</th>
                  <th scope="col" className="px-4 py-3 font-semibold">S&amp;P 500</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Gold</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Crude oil</th>
                </tr>
              </thead>
              <tbody>
                {YEARS.map((r) => (
                  <tr key={r.year} className="border-t border-border/30">
                    <th scope="row" className="px-4 py-3 text-left font-mono font-medium">{r.year}</th>
                    <td className="px-4 py-3 font-mono">{pct(r.sp500)}</td>
                    <td className="px-4 py-3 font-mono">{pct(r.gold)}</td>
                    <td className="px-4 py-3 font-mono">{pct(r.oil)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            In 2002 stocks fell sharply while gold and oil both rose. In 2008 stocks and oil collapsed together
            while gold held roughly flat — a reminder that "commodities" is not one thing. And in 2013 gold fell
            hard in a year stocks had one of their best runs. No single asset is the safe one; they take turns.
          </p>
          <p>
            A portfolio split across these does worse than the best performer every single year, and that is the
            point. It also never posts the worst performer's year. Students find the first half obvious and the
            second half surprising.
          </p>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <PieChart className="h-6 w-6 text-primary" aria-hidden="true" /> The full asset menu, ranked by role
          </h2>
          <ul className="space-y-3">
            <li>
              <strong>S&amp;P 500 index fund</strong> — the growth engine, and the benchmark everything else is judged
              against. Broad by construction, but still all-equity.
            </li>
            <li>
              <strong>Individual stocks</strong> — higher ceiling, higher floor. Useful in small doses; dangerous as
              the whole portfolio.
            </li>
            <li>
              <strong>Gold</strong> — produces no earnings, but frequently moves against equities in a panic. A hedge,
              not a growth asset.
            </li>
            <li>
              <strong>Crude oil</strong> — driven by supply shocks and global demand. Volatile in both directions,
              and as 2008 shows, not a reliable crash hedge.
            </li>
            <li>
              <strong>Certificates of deposit</strong> — a contracted fixed rate with an early-withdrawal penalty.
              Return is certain; the cost is that the money is locked.
            </li>
            <li>
              <strong>High-yield savings</strong> — small variable return, instantly available. The liquidity slot.
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Where each of these figures comes from is documented on the{" "}
            <Link to="/methodology" className="text-primary underline underline-offset-4">methodology page</Link>.
          </p>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="text-2xl font-semibold">Try it as an exercise</h2>
          <p>
            Run the simulator twice over the same historical window. First put everything into one company you like
            the look of. Then replay it split across the index fund, one or two stocks, a hedge, and a CD. Compare
            the ending values — but more importantly, compare the deepest drop each portfolio took along the way.
            The second run is usually calmer, and calm is what keeps people invested.
          </p>
          <p>
            To push it further, the{" "}
            <Link to="/sandbox" className="text-primary underline underline-offset-4">Sandbox</Link>{" "}
            lets you inject a crash into any year and watch which parts of a diversified portfolio absorb it.
          </p>
          <p className="text-sm text-muted-foreground">
            This is an educational simulation using virtual money. It is not financial advice, and historical
            returns do not indicate future results.
          </p>
        </section>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-8">
          <h2 className="mb-3 text-2xl font-semibold">Test it in the simulator</h2>
          <p className="mb-6 text-muted-foreground">
            Twenty years of real market history, two strategies, about forty minutes.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all"
          >
            Open the stock simulator <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link to="/guide" className="text-primary underline underline-offset-4">Beginner's investing guide</Link>
            <Link to="/learn/stock-market-game-high-school" className="text-primary underline underline-offset-4">Run it with a class</Link>
            <Link to="/learn" className="text-primary underline underline-offset-4">All learning resources</Link>
          </div>
        </div>
      </div>
    </article>
  </>
);

export default Diversification;
