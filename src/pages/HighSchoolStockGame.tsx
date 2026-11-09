import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Users, MessageSquare, Target } from "lucide-react";

const URL = "https://investmentsimulator.app/learn/stock-market-game-high-school";
const LAST_REVIEWED = "2026-08-14";

const HighSchoolStockGame = () => (
  <>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Stock Market Game for High School Students",
        description:
          "How to run a free online stock market simulation with a high school class in one period.",
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
          { "@type": "ListItem", position: 3, name: "Stock Market Game for High School Students", item: URL },
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
          <span className="text-foreground">Stock market game for high school</span>
        </nav>

        <header className="mb-12">
          <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Classroom lesson</p>
          <h1 className="mb-4 text-4xl md:text-6xl font-editorial font-semibold font-normal leading-[1.05] tracking-tight">
            A stock market game for high school students
          </h1>
          <p className="text-lg text-muted-foreground">
            Most classroom stock games run for a semester, require accounts, and quietly reward whoever
            gambled hardest in week three. This one runs thirty years of real market history inside one
            period, gives every student the identical market, and ends with a comparison against the S&amp;P 500.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Published by Rise to Riches · Last updated{" "}
            <time dateTime={LAST_REVIEWED}>14 August 2026</time>
          </p>
        </header>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Target className="h-6 w-6 text-primary" aria-hidden="true" /> What students actually do
          </h2>
          <p>
            Each student starts with cash and receives another deposit every simulated quarter. They allocate it
            across individual company stocks, an S&amp;P 500 index fund, gold, crude oil, certificates of deposit,
            and a high-yield savings account. One simulated year passes roughly every minute, and prices update
            every ten seconds, so the room is making decisions continuously rather than filling in a worksheet.
          </p>
          <p>
            Because deposits arrive over time, a student cannot make one allocation and coast. They have to keep
            deciding whether to add to a winner, rebalance into something safer, or lock money into a CD they
            cannot touch — which is the actual skill the lesson is about.
          </p>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Clock className="h-6 w-6 text-primary" aria-hidden="true" /> A 45-minute plan, minute by minute
          </h2>
          <ol className="list-decimal space-y-3 pl-6">
            <li>
              <strong>0–4 min — Pose the question.</strong> Write on the board: "Can you beat the index by picking
              stocks?" Ask for a show of hands. Record the count; you will come back to it.
            </li>
            <li>
              <strong>4–8 min — Host and join.</strong> Start a classroom game and put the join code on the screen.
              Students open the link and enter the code. The built-in tutorial covers the interface.
            </li>
            <li>
              <strong>8–28 min — Play a 20-year run.</strong> Circulate. When a student asks "should I buy this?",
              hand it back: "what happens to your portfolio if it drops 40% next year?"
            </li>
            <li>
              <strong>28–38 min — Read the results together.</strong> The end screen shows each portfolio against the
              S&amp;P 500 over the same years. Ask the top and bottom finishers to describe their allocation before
              anyone sees the numbers explained.
            </li>
            <li>
              <strong>38–45 min — Debrief.</strong> Return to the opening question and re-take the show of hands.
              The change in the room is the lesson.
            </li>
          </ol>
          <p className="text-sm text-muted-foreground">
            Shorter period? Run a 10-year game instead — roughly ten minutes of play, same structure. Longer block?
            The 35-year run spans multiple crashes and recoveries.
          </p>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Users className="h-6 w-6 text-primary" aria-hidden="true" /> Four things students reliably get wrong
          </h2>
          <ul className="space-y-3">
            <li>
              <strong>Everything in one stock.</strong> Someone always puts the whole balance into the company with
              the best-looking recent line. Sometimes it wins spectacularly, which is a better teaching moment than
              when it loses — ask the winner whether they would take that bet again with their own tuition money.
            </li>
            <li>
              <strong>Selling during the crash.</strong> When 2008 arrives, a chunk of the room sells into it and holds
              cash through the recovery. Their final number is usually below the students who did nothing at all.
            </li>
            <li>
              <strong>Ignoring the boring assets.</strong> CDs and the savings account look pointless until a student
              notices that deposit rates were above 5% in the early 1990s and near zero after 2010. That contrast is
              a whole macro lesson in one screen.
            </li>
            <li>
              <strong>Confusing activity with skill.</strong> The most-active traders rarely finish top three. Pull up
              the trade counts against final values and let the class find that themselves.
            </li>
          </ul>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <MessageSquare className="h-6 w-6 text-primary" aria-hidden="true" /> Five discussion questions
          </h2>
          <ol className="list-decimal space-y-2 pl-6">
            <li>Who beat the S&amp;P 500, and can they explain why in terms of decisions rather than luck?</li>
            <li>If we replayed the same twenty years, would your strategy survive a different order of events?</li>
            <li>What did holding cash during a downturn cost you, in dollars, on your own screen?</li>
            <li>Which asset felt safe and turned out not to be — and how would you have known in advance?</li>
            <li>How would your choices change if this were money you needed for college in three years?</li>
          </ol>
        </section>

        <section className="mb-12 space-y-4">
          <h2 className="text-2xl font-semibold">Why real historical data matters here</h2>
          <p>
            Games built on random price generators teach students that markets are noise. This simulation uses
            actual annual returns from 1990 to 2025, so the dot-com unwind, 2008, and the 2020 recovery land on the
            years they really happened. A student who lived through a simulated 2008 has a reference point that a
            random walk cannot give them. The exact sources and the modelling simplifications are documented on the{" "}
            <Link to="/methodology" className="text-primary underline underline-offset-4">methodology page</Link>.
          </p>
          <p className="text-sm text-muted-foreground">
            This is an educational simulation using virtual money. It is not financial advice.
          </p>
        </section>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-8">
          <h2 className="mb-3 text-2xl font-semibold">Run it with your class</h2>
          <p className="mb-6 text-muted-foreground">
            Free, no accounts, no downloads, works on school Chromebooks.
          </p>
          <Link
            to="/for-teachers"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all"
          >
            Open the teacher guide <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link to="/" className="text-primary underline underline-offset-4">Play the stock simulator</Link>
            <Link to="/learn/how-diversification-works" className="text-primary underline underline-offset-4">How diversification works</Link>
            <Link to="/guide" className="text-primary underline underline-offset-4">Beginner's investing guide</Link>
            <Link to="/learn/stock-market-crashes" className="text-primary underline underline-offset-4">Stock market crashes explained</Link>
          </div>
        </div>
      </div>
    </article>
  </>
);

export default HighSchoolStockGame;
