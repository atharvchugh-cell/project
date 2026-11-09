import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Database, ShieldCheck } from "lucide-react";

const URL = "https://investmentsimulator.app/about";
const LAST_REVIEWED = "2026-08-15";

const About = () => (
  <>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "About Rise to Riches",
        url: URL,
        dateModified: LAST_REVIEWED,
        mainEntity: {
          "@type": "Organization",
          name: "Rise to Riches",
          url: "https://investmentsimulator.app/",
          description:
            "An independent, free educational investing simulator built for high school classrooms and self-teaching beginners.",
        },
      })}</script>
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://investmentsimulator.app/" },
          { "@type": "ListItem", position: 2, name: "About", item: URL },
        ],
      })}</script>
    </Helmet>

    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <nav className="mb-8 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">About</span>
        </nav>

        <header className="mb-12">
          <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.3em] text-primary">About</p>
          <h1 className="mb-4 text-4xl md:text-6xl font-editorial font-semibold font-normal leading-[1.05] tracking-tight">
            About Rise to Riches
          </h1>
          <p className="text-lg text-muted-foreground">
            Rise to Riches is a free investment simulator that replays real market history with virtual money.
            It is an independent educational project — there is no brokerage behind it, nothing is for sale, and
            no account is required to play.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Last reviewed <time dateTime={LAST_REVIEWED}>15 August 2026</time>
          </p>
        </header>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" /> Why it exists
          </h2>
          <p>
            This project compresses recorded annual market history into a class period rather than waiting
            for live prices. Depending on the years chosen, students can explore a bubble, a crash or a recovery
            and compare their result with an index fund over the same period. One run is not evidence of investing skill.
          </p>
          <p>
            The simulator is free and needs no student accounts. School web filters differ, so teachers should check it loads on their network. Teachers can run a whole class from one room code; see the{" "}
            <Link to="/for-teachers" className="text-primary underline underline-offset-4">classroom page</Link>.
          </p>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Database className="h-6 w-6 text-primary" aria-hidden="true" /> Where the numbers come from
          </h2>
          <p>
            Asset paths are built from recorded annual returns for each asset in each calendar year. The
            moves inside each year are simulated, not historical daily prices, so prices move continuously during play. Within a year, the path
            wanders; the year's start and end points match the historical record. Certificates of deposit and the
            savings account use stored annual rate tables with simplified product rules.
          </p>
          <p>
            The full list of assets, the year ranges covered, the data sources and the known simplifications are
            documented on the{" "}
            <Link to="/methodology" className="text-primary underline underline-offset-4">methodology page</Link>.
            If you spot a year that looks wrong, that page is the right thing to check first — and the request box
            on the homepage is the fastest way to tell us.
          </p>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" /> Limits and disclaimer
          </h2>
          <p>
            This is a simulation for education. It is not investment advice, not a brokerage, and not a
            prediction of future returns. Simulated results ignore taxes, trading costs, spreads and the
            emotional weight of risking real money. A strategy that wins here can lose badly in a live market.
          </p>
          <p>
            Basic and Advanced stock games use visible calendar years, so recognizing an era can create hindsight.
            Hard Client Contracts conceals the historical period. All modes are practice, not a test of future investment performance.
          </p>
        </section>

        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-8">
          <h2 className="mb-3 text-2xl font-semibold">Start with the simulator</h2>
          <p className="mb-6 text-muted-foreground">
            The quickest way to understand the project is to play ten years of it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform"
            >
              Play the simulator
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/learn"
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-6 py-3 font-semibold transition-colors hover:bg-card/60"
            >
              Browse the lessons
            </Link>
          </div>
        </section>
      </div>
    </main>
  </>
);

export default About;
