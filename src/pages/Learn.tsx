import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, GraduationCap, PieChart, FlaskConical, Gamepad2 } from "lucide-react";

const URL = "https://investmentsimulator.app/learn";

const RESOURCES = [
  {
    to: "/guide",
    icon: BookOpen,
    title: "How to invest in stocks — beginner's guide",
    blurb:
      "Stocks, index funds, commodities, CDs and savings accounts explained in plain language, with three basic rules for new investors.",
  },
  {
    to: "/learn/stock-market-game-high-school",
    icon: GraduationCap,
    title: "Running a stock market game with high school students",
    blurb:
      "What a single class period actually looks like minute by minute, what students do, what they get wrong, and how to run the debrief.",
  },
  {
    to: "/learn/how-to-use-stock-market-simulator",
    icon: Gamepad2,
    title: "How to use the stock market simulator",
    blurb:
      "A walkthrough of this site's controls: Basic and Advanced modes, years and length, deposits versus profit, the benchmark, saving and classroom rooms.",
  },
  {
    to: "/learn/stock-market-crashes",
    icon: PieChart,
    title: "Stock market crashes explained: 2000, 2008 and 2020",
    blurb:
      "What happened in three crashes, what annual data shows and hides, and exercises you can replay in the simulator.",
  },
  {
    to: "/learn/how-diversification-works",
    icon: PieChart,
    title: "How diversification works",
    blurb:
      "Why spreading money across assets changes your outcome, worked through with the exact asset menu the simulator uses.",
  },
  {
    to: "/learn/investment-simulator",
    icon: Gamepad2,
    title: "What is an investment simulator?",
    blurb:
      "Live paper trading versus historical replay, what makes a simulator worth your time, and a three-run practice routine that shows what your instincts cost you.",
  },
  {
    to: "/methodology",
    icon: FlaskConical,
    title: "Methodology & data sources",
    blurb:
      "Where the historical stock, index, gold, oil, CD, rate and housing figures come from, and how the simulation turns them into prices.",
  },
];

const Learn = () => (
  <>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Learn — Investing Lessons & Classroom Resources",
        url: URL,
        description:
          "Investing explainers and classroom lessons that pair with the Rise to Riches stock market simulator.",
        isPartOf: { "@id": "https://investmentsimulator.app/#website" },
        hasPart: RESOURCES.map((r) => ({
          "@type": "WebPage",
          name: r.title,
          url: `https://investmentsimulator.app${r.to}`,
        })),
      })}</script>
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://investmentsimulator.app/" },
          { "@type": "ListItem", position: 2, name: "Learn", item: URL },
        ],
      })}</script>
    </Helmet>

    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <nav className="mb-8 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Learn</span>
        </nav>

        <header className="mb-12">
          <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Education Center</p>
          <h1 className="mb-4 text-4xl md:text-6xl font-editorial font-semibold font-normal leading-[1.05] tracking-tight">
            Learn investing by simulating it
          </h1>
          <p className="text-lg text-muted-foreground">
            Every resource here is written to pair with the{" "}
            <Link to="/" className="text-primary underline underline-offset-4">free stock market simulator</Link>{" "}
            — read the idea, then go play the thirty years of market history where it actually mattered.
            Teachers can start with the{" "}
            <Link to="/for-teachers" className="text-primary underline underline-offset-4">classroom guide</Link>.
          </p>
        </header>

        <section className="mb-12 grid gap-4">
          <h2 className="sr-only">Resources</h2>
          {RESOURCES.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="group rounded-2xl border border-border/50 bg-card/40 p-6 transition-colors hover:border-primary/40"
            >
              <div className="mb-2 flex items-center gap-3">
                <r.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="text-lg font-semibold group-hover:text-primary">{r.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{r.blurb}</p>
            </Link>
          ))}
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="text-2xl font-semibold">Where the simulators fit</h2>
          <p className="text-muted-foreground">
            The{" "}
            <Link to="/" className="text-primary underline underline-offset-4">stock simulator</Link>{" "}
            covers markets, risk and diversification. The{" "}
            <Link to="/real-estate-game" className="text-primary underline underline-offset-4">real estate game</Link>{" "}
            covers illiquid assets, leverage and holding costs. The{" "}
            <Link to="/sandbox" className="text-primary underline underline-offset-4">Sandbox</Link>{" "}
            lets a class ask counterfactual questions — what if the 2008 crash had been twice as deep —
            and watch the timeline change.
          </p>
          <p className="text-sm text-muted-foreground">
            All three use virtual money. Nothing here is financial advice; see the{" "}
            <Link to="/methodology" className="text-primary underline underline-offset-4">methodology page</Link>{" "}
            for exactly how the numbers are produced and simplified.
          </p>
        </section>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-8">
          <h2 className="mb-3 text-2xl font-semibold">Start with the simulator</h2>
          <p className="mb-6 text-muted-foreground">
            Twenty years of real market history in about twenty minutes. No account, no download.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all"
          >
            Open the stock simulator <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  </>
);

export default Learn;
