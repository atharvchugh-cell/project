import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Repeat, Target, AlertTriangle } from "lucide-react";

const URL = "https://investmentsimulator.app/learn/investment-simulator";
const LAST_REVIEWED = "2026-08-15";

const InvestmentSimulator = () => (
  <>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "What is an investment simulator?",
        description:
          "How investment simulators work, the difference between live paper trading and historical replay, and a practice routine for beginners.",
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
          { "@type": "ListItem", position: 3, name: "What is an investment simulator?", item: URL },
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
          <span className="text-foreground">What is an investment simulator?</span>
        </nav>

        <header className="mb-12">
          <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Concept</p>
          <h1 className="mb-4 text-4xl md:text-6xl font-editorial font-semibold font-normal leading-[1.05] tracking-tight">
            What is an investment simulator?
          </h1>
          <p className="text-lg text-muted-foreground">
            An investment simulator is a program that lets you buy and sell assets with virtual money and
            keeps score as real market prices move. Nothing is at stake financially — which is exactly why it
            is the cheapest place to make the mistakes that everyone makes once.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Published by Rise to Riches · Last updated{" "}
            <time dateTime={LAST_REVIEWED}>15 August 2026</time>
          </p>
        </header>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Clock className="h-6 w-6 text-primary" aria-hidden="true" /> Live paper trading vs. historical replay
          </h2>
          <p>
            Simulators come in two shapes, and the difference matters more than the interface.
          </p>
          <p>
            <strong>Live paper trading</strong> mirrors today's market in real time. You place an order, and it
            fills at roughly the current quote. It is realistic, but it runs at the speed of real life: a market
            cycle takes years, so a semester of paper trading mostly teaches you what one flat quarter feels like.
          </p>
          <p>
            <strong>Historical replay</strong> — what this site does — starts you at a real past year and fast
            forwards through actual recorded returns. Twenty years of market history compresses into about twenty
            minutes, so a single session contains a bubble, a crash, and a recovery. You get to feel the part of
            investing that only shows up over decades: that the worst year and the best year are usually close
            together, and that most of the damage is self-inflicted during the gap.
          </p>
          <p>
            The trade-off is honest: replay cannot teach you today's news cycle, and if you already know what
            happened in 2008 you can cheat. That is why the years are hidden by default in classroom games.
          </p>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Target className="h-6 w-6 text-primary" aria-hidden="true" /> What makes a simulator worth your time
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">Real data, not invented prices.</span> Randomly
              generated charts teach pattern superstition. Recorded returns teach history. Ours are documented on
              the <Link to="/methodology" className="text-primary underline underline-offset-4">methodology page</Link>.
            </li>
            <li>
              <span className="text-foreground font-medium">More than one asset class.</span> If the only choice
              is which stock, you never learn allocation. Stocks, an index fund, gold, oil, CDs and a savings
              account behave differently in the same year — that disagreement is the lesson in{" "}
              <Link to="/learn/how-diversification-works" className="text-primary underline underline-offset-4">how diversification works</Link>.
            </li>
            <li>
              <span className="text-foreground font-medium">A long enough horizon.</span> Anything under about
              ten simulated years is a trading game, not an investing one.
            </li>
            <li>
              <span className="text-foreground font-medium">A scoreboard that measures the right thing.</span>{" "}
              Ending value alone rewards a lucky single-stock bet. Comparing your return against buying the
              S&amp;P 500 and holding it is the comparison that actually tells you something.
            </li>
            <li>
              <span className="text-foreground font-medium">No account required.</span> A simulator that wants
              your email before your first trade is a lead form.
            </li>
          </ul>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Repeat className="h-6 w-6 text-primary" aria-hidden="true" /> A practice routine that teaches something
          </h2>
          <ol className="list-decimal space-y-3 pl-5 text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">Run one game on instinct.</span> Trade however you
              want. Write down your ending value and your return versus the index.
            </li>
            <li>
              <span className="text-foreground font-medium">Run a second game as a pure index buyer.</span> Put
              everything in the S&amp;P 500 fund on day one and touch nothing. Many first-time players lose to
              this run, and finding that out costs nothing here.
            </li>
            <li>
              <span className="text-foreground font-medium">Run a third with a written rule.</span> For example:
              70% index, 20% individual stocks, 10% cash, rebalanced whenever a slice drifts past 10 points.
              Following a rule you wrote in advance is the whole skill.
            </li>
            <li>
              <span className="text-foreground font-medium">Compare the three.</span> The gap between game one
              and game three is a fair estimate of how much your instincts cost you.
            </li>
          </ol>
          <p>
            If you want to test a specific "what if" — a crash two years after you start, a decade of high
            inflation — the{" "}
            <Link to="/sandbox" className="text-primary underline underline-offset-4">Sandbox simulator</Link>{" "}
            lets you place those events on a timeline and re-run the same portfolio against them.
          </p>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <AlertTriangle className="h-6 w-6 text-primary" aria-hidden="true" /> What a simulator can't teach
          </h2>
          <p>
            Virtual money does not hurt. Selling a real position down 40% is a different experience from clicking
            sell on a number, and no simulator closes that gap. Simulators also tend to ignore taxes, bid-ask
            spreads, and the fact that you cannot always buy exactly what you want at exactly the closing price.
          </p>
          <p>
            Treat the result as a lesson about behaviour and allocation, not as a forecast, and definitely not as
            evidence that a strategy will work with real money. This site is an educational simulation and is not
            financial advice.
          </p>
        </section>

        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-8">
          <h2 className="mb-3 text-2xl font-semibold">Try it on real market history</h2>
          <p className="mb-6 text-muted-foreground">
            Start with a ten-year run. No account, no download, and the first trade takes about fifteen seconds.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform"
            >
              Open the investment simulator
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/for-teachers"
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-6 py-3 font-semibold transition-colors hover:bg-card/60"
            >
              Run it with a class
            </Link>
          </div>
        </section>
      </div>
    </article>
  </>
);

export default InvestmentSimulator;
