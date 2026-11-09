import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, PiggyBank, LineChart, ShieldCheck, Coins, Building2 } from "lucide-react";

const Guide = () => {
  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "How to Invest in Stocks — A Beginner's Guide for Students",
          description:
            "A beginner-friendly guide to investing in stocks, index funds, gold, and CDs, written for high school students.",
          author: { "@type": "Organization", name: "Rise to Riches" },
          publisher: { "@type": "Organization", name: "Rise to Riches" },
          datePublished: "2026-06-10",
          mainEntityOfPage: "https://investmentsimulator.app/guide",
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://investmentsimulator.app/" },
            { "@type": "ListItem", position: 2, name: "Beginner's Guide", item: "https://investmentsimulator.app/guide" },
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
            <span className="text-foreground">Beginner's Guide</span>
          </nav>

          <header className="mb-12">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Education Center</p>
            <h1 className="mb-4 text-4xl md:text-6xl font-editorial font-semibold font-normal leading-[1.05] tracking-tight">
              How to Invest in Stocks: A Beginner's Guide for Students
            </h1>
            <p className="text-lg text-muted-foreground">
              Everything you need to know before your first trade — written for high school students,
              with zero jargon. When you're ready, practice risk-free in our{" "}
              <Link to="/" className="text-primary underline underline-offset-4">stock simulator</Link>.
              Teaching a class? See the{" "}
              <Link to="/for-teachers" className="text-primary underline underline-offset-4">classroom guide for teachers</Link>.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Published by Rise to Riches · Last updated{" "}
              <time dateTime="2026-08-14">14 August 2026</time>
            </p>
          </header>

          <section className="mb-12 space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <TrendingUp className="h-6 w-6 text-primary" /> What is a stock?
            </h2>
            <p>
              A stock is a tiny ownership slice of a real company. When you buy one share of Apple,
              you literally own a fraction of Apple. If Apple sells more iPhones and grows, your
              share becomes more valuable. If sales drop, the share is worth less. Stocks are how
              most people in the U.S. build long-term wealth — but they also go down, sometimes a
              lot, in the short term.
            </p>
            <p>
              The price of a stock changes every second the market is open. It moves based on what
              buyers are willing to pay and what sellers will accept — which depends on company
              earnings, news, the broader economy, and plain human emotion.
            </p>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <LineChart className="h-6 w-6 text-primary" /> The S&P 500: the easiest place to start
            </h2>
            <p>
              The S&P 500 is an index that tracks the 500 largest U.S. companies — Apple, Microsoft,
              Amazon, JPMorgan, Coca-Cola, and many more. Instead of trying to pick a single winner,
              you can buy a fund that holds all 500 at once. This is called an{" "}
              <strong>index fund</strong>.
            </p>
            <p>
              Historically, the S&P 500 has returned roughly 10% per year on average over long time
              periods. It's not guaranteed, and there are losing years — but it's the benchmark most
              professional investors try (and usually fail) to beat. For beginners, an S&P 500 index
              fund is often the smartest first investment.
            </p>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <Building2 className="h-6 w-6 text-primary" /> Individual stocks vs index funds
            </h2>
            <p>
              Buying an individual stock — say, just Nvidia — can pay off enormously if the company
              does well, but it's much riskier. A single company can have a bad quarter, lose a key
              customer, or get disrupted by a competitor. An index fund spreads that risk across
              hundreds of companies, so no single failure can wipe you out.
            </p>
            <p>
              A common beginner strategy: put most of your money in an index fund, then pick one or
              two individual stocks you genuinely believe in. Our simulator lets you try both
              approaches side-by-side, with real historical price data, so you can see the
              tradeoffs without risking a dollar.
            </p>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <Coins className="h-6 w-6 text-primary" /> Gold, oil, and other commodities
            </h2>
            <p>
              Commodities are physical things — gold bars, barrels of crude oil, bushels of wheat.
              Investors buy them as a hedge: gold often holds value when stocks crash, and oil
              prices respond to global events. They don't produce earnings the way a company does,
              so they're usually a small slice of a portfolio, not the foundation.
            </p>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <PiggyBank className="h-6 w-6 text-primary" /> CDs and high-yield savings
            </h2>
            <p>
              A <strong>certificate of deposit (CD)</strong> is a deal with a bank: you lock up your
              money for 1, 2, or 5 years and the bank pays you a fixed interest rate. You can't
              touch the money early without a penalty, but the return is guaranteed. A{" "}
              <strong>high-yield savings account (HYSA)</strong> pays a smaller variable rate but
              lets you withdraw anytime.
            </p>
            <p>
              These are the safe portion of a portfolio. They won't make you rich, but they won't
              lose value either — useful for money you'll need soon, or as a calm anchor when
              stocks are volatile.
            </p>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <ShieldCheck className="h-6 w-6 text-primary" /> The three rules every investor learns
            </h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                <strong>Diversify.</strong> Don't put everything in one stock. Spread your money
                across many companies, and across different asset types.
              </li>
              <li>
                <strong>Think long-term.</strong> The market goes up and down every day. The people
                who win are the ones who keep buying through both, and hold for years.
              </li>
              <li>
                <strong>Only invest money you don't need soon.</strong> If you might need it in the
                next year or two, keep it in savings — not stocks.
              </li>
            </ol>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="text-2xl font-semibold">Keep going</h2>
            <p className="text-muted-foreground">
              The single most important idea here gets its own lesson:{" "}
              <Link to="/learn/how-diversification-works" className="text-primary underline underline-offset-4">how diversification works</Link>,
              worked through with the real returns from 2000, 2008 and 2013. Teachers running this with a
              class can use the{" "}
              <Link to="/learn/stock-market-game-high-school" className="text-primary underline underline-offset-4">high school stock market game plan</Link>.
              Before your first game, read{" "}
              <Link to="/learn/how-to-use-stock-market-simulator" className="text-primary underline underline-offset-4">how to use the simulator</Link>,
              then see how three real crashes played out in{" "}
              <Link to="/learn/stock-market-crashes" className="text-primary underline underline-offset-4">stock market crashes explained</Link>.
            </p>
            <p className="text-sm text-muted-foreground">
              This guide is educational and is not financial advice. Historical returns do not indicate
              future results. Every figure used by our simulators is sourced on the{" "}
              <Link to="/methodology" className="text-primary underline underline-offset-4">methodology page</Link>.
            </p>
          </section>

          <section className="mb-12 rounded-2xl border border-border/50 bg-card/40 p-8">
            <h2 className="mb-3 text-2xl font-semibold">Ready to practice?</h2>
            <p className="mb-6 text-muted-foreground">
              The best way to learn investing is to actually do it — but with fake money first. Our
              free simulator runs 20 years of real market history in 20 minutes. Try strategies,
              make mistakes, see what works.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all"
            >
              Open the stock simulator <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </div>
      </article>
    </>
  );
};

export default Guide;
