import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Users, Clock, ShieldCheck, ListChecks, Trophy, Building2 } from "lucide-react";
import { ClassShareKit } from "@/components/ClassShareKit";

function PrintWorksheetButton() {
  return (
    <button
      type="button"
      className="print:hidden rounded-md border border-border px-3 py-1.5 text-sm hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => {
        document.body.classList.add("print-worksheet");
        window.print();
        document.body.classList.remove("print-worksheet");
      }}
    >
      Print worksheet
    </button>
  );
}

const FAQ = [
  {
    q: "Is the stock market game free for classrooms?",
    a: "Yes. Rise to Riches is free, and students need no account, download or email address. It runs in the browser, including on Chromebooks. School web filters differ, so open the site on a student device before class.",
  },
  {
    q: "How long does one class session take?",
    a: "At normal speed one simulated year takes about a minute, so a 10-year room runs roughly 10 minutes and a 20-year room roughly 20, plus setup and any pauses. These are estimates. A 10- or 15-year room usually leaves time for a debrief in a 45-minute period.",
  },
  {
    q: "How do students join a multiplayer game?",
    a: "The host chooses Play With Friends, creates a room and shares the join code, link or QR code. Students enter a nickname and the code. Everyone plays the same years on the shared host clock. Within-year simulated paths and life events can still differ, so one result does not prove a strategy is better.",
  },
  {
    q: "Are these live prices, and what are the limitations?",
    a: "No. The stock game uses stored historical annual returns with synthetic moves within each year. It uses virtual money, omits taxes and brokerage costs, and is not investment advice. Knowing the calendar years can create hindsight. Classroom turns off AI feedback and public leaderboard posting, and chat starts off with a host control.",
  },
  {
    q: "What can students invest in?",
    a: "Individual stocks, an S&P 500 index fund, gold, crude oil, certificates of deposit, and a high-yield savings account. Each year's result follows real historical annual returns; the moves inside each year are simulated.",
  },
  {
    q: "Does it teach anything beyond stock picking?",
    a: "Yes. Quarterly cash deposits, random life-event expenses and CD early-withdrawal penalties bring in diversification, time horizon and liquidity, not only stock picking.",
  },
];

const ForTeachers = () => {
  const url = "https://investmentsimulator.app/for-teachers";
  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Free Stock Market Game for Students & Classrooms — Teacher Guide",
          url,
          description:
            "How to run a free multiplayer stock market simulation with a class using Classroom rooms, with objectives, a readiness check and a printable worksheet.",
          isPartOf: { "@id": "https://investmentsimulator.app/#website" },
          audience: { "@type": "EducationalAudience", educationalRole: "teacher" },
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://investmentsimulator.app/" },
            { "@type": "ListItem", position: 2, name: "For Teachers", item: url },
          ],
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        })}</script>
      </Helmet>

      <article className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <nav className="mb-8 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">For Teachers</span>
          </nav>

          <header className="mb-12">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Classroom</p>
            <h1 className="mb-4 text-4xl md:text-6xl font-editorial font-semibold font-normal leading-[1.05] tracking-tight">
              A stock market game you can run in one class period
            </h1>
            <p className="text-lg text-muted-foreground">
              Rise to Riches is a free investing simulation for economics, personal finance and business classes.
              Students invest virtual money using real historical annual returns. Students need no
              account and nothing to install.{" "}
              <Link to="/" className="text-primary underline underline-offset-4">Start a game</Link>{" "}
              or read the{" "}
              <Link to="/guide" className="text-primary underline underline-offset-4">beginner's investing guide</Link>{" "}
              first.
            </p>
          </header>

          <section className="mb-12 space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <ListChecks className="h-6 w-6 text-primary" /> How to run a stock market game in class, step by step
            </h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li><strong>Open the game on your screen.</strong> On the homepage choose <em>Play With Friends</em>, then create a room. You don't need an account.</li>
              <li><strong>Turn on Classroom.</strong> Switch on Classroom on the create screen. You can see it in the lobby.</li>
              <li><strong>Pick the length.</strong> Rooms run 10, 15, 20 or 35 years. At normal speed that is roughly one minute per year (an estimate).</li>
              <li><strong>Share the join code.</strong> Students enter the code or scan the QR code, then type a nickname. The join screen reminds them to use a nickname, not their full name.</li>
              <li><strong>Start the clock.</strong> Everyone trades in the same historical market at the same time, and you can pause the room from the host screen.</li>
              <li><strong>Debrief with the results.</strong> The end screen ranks students and compares every portfolio with an S&amp;P 500 index fund.</li>
            </ol>
            <h3 className="text-lg font-semibold pt-2">What Classroom changes</h3>
            <ul className="list-disc space-y-1 pl-6">
              <li>Chat starts off. Students see "Chat is turned off by the host".</li>
              <li>You can turn chat on or off at any time from the host screen.</li>
              <li>AI feedback is turned off for the room.</li>
              <li>Results from the room are not posted to the public leaderboard.</li>
            </ul>
            <p>Classroom is selected in the lobby. The host can change chat through the host controls during play; AI feedback stays off and classroom runs stay off the public leaderboard.</p>
          </section>


          <section className="mb-12 space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <Clock className="h-6 w-6 text-primary" /> How the timing works
            </h2>
            <p>
              At normal speed one simulated year takes about a minute. A 10-year room therefore runs in
              roughly ten minutes and a 20-year room in about twenty, plus setup and any pauses. Treat
              these as estimates. Rooms run 10, 15, 20 or 35 years, and the host can pause the room clock
              for everyone.
            </p>
            <p>
              Students receive a cash deposit each simulated quarter rather than one lump sum at the
              start. That structure keeps everyone making decisions throughout the run instead of
              buying once and watching.
            </p>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <Users className="h-6 w-6 text-primary" /> Running it as a whole class
            </h2>
            <p>
              In a multiplayer room, one person hosts and shares a join code. Every student plays the
              same years on the same server clock. Their decisions differ, but synthetic within-year
              moves and life-event expenses can also differ. Treat a single game's ranking as a discussion
              starting point, not proof of investing skill.
            </p>
            <p>
              Because the market period is identical for everyone, the debrief is simple: ask
              the top and bottom finishers to explain their allocation, then compare both against a
              plain S&P 500 index fund over the same years.
            </p>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <ListChecks className="h-6 w-6 text-primary" /> A 45-minute lesson plan
            </h2>
            <p>
              A one-period plan (framing, a 20-year run, benchmark comparison and debrief) is laid out minute by minute in the{" "}
              <Link to="/learn/stock-market-game-high-school" className="text-primary underline underline-offset-4">high school stock market game lesson</Link>.
              With a shorter period, use a 10-year room.
            </p>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="text-2xl font-semibold">Learning objectives</h2>
            <p>After one session students should be able to:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Explain the difference between money deposited and money earned (profit).</li>
              <li>Compare a portfolio's return with an S&amp;P 500 index fund over the same years.</li>
              <li>Describe how spreading money across investments changed their risk.</li>
              <li>Name one decision they would change, and why, using evidence from their game.</li>
            </ul>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="text-2xl font-semibold">Readiness check before class</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Open investmentsimulator.app on a student device on the school network. Filters vary by school, so confirm it loads.</li>
              <li>Create a test room with Classroom on and join it from a second device.</li>
              <li>Decide the room length that fits your period, and whether you will turn chat on.</li>
              <li>Print or share the worksheet below.</li>
            </ul>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="text-2xl font-semibold">Middle school and high school: adapt the task, not the game</h2>
            <p>
              For middle school, demonstrate a 10-year game on the teacher's screen before independent play.
              Set one learning goal: distinguish deposits from profit. Ask students to consider only the
              S&amp;P 500 fund and cash for the exercise. This is a teaching instruction, not an asset restriction
              enforced by the game. Pause the shared room clock to discuss a deposit or price change.
              End with a three-minute debrief: what changed because money was added, and what changed because
              an investment rose or fell? Review the{" "}
              <Link to="/privacy" className="text-primary underline underline-offset-4">privacy notice</Link> against your school's rules first.
            </p>
            <p>For high school, use the same Classroom room but add a diversification goal. Ask students to justify a small selection of available assets, record a decision and compare their return with the index benchmark. Debrief risk, liquidity and the effect of life events. Replays should use the same start year, length, mode and comparable deposits; within-year randomness can still differ.</p>
            <p>Classroom is a host setting in the existing room flow, not a separate game. Chat starts off and the host can change it; AI feedback and public leaderboard submission are disabled. Guest play remains available, but review the site's age rules and your school's requirements before assigning it.</p>
          </section>

          <section id="worksheet" className="mb-12 space-y-4 rounded-xl border border-border/50 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">Student worksheet</h2>
              <PrintWorksheetButton />
            </div>
            <p className="text-sm text-muted-foreground">Name or nickname: ____________________ &nbsp; Years played: ________</p>
            <ol className="list-decimal space-y-4 pl-6">
              <li><strong>Hypothesis.</strong> Before the game: how will you split your money (percent in stocks, the index fund, gold or oil, CDs and savings)? Why?</li>
              <li><strong>Decisions.</strong> Record three trades: the year, what you bought or sold, and the reason.</li>
              <li><strong>Results.</strong> Your final return: ______% &nbsp; S&amp;P 500 benchmark return: ______% &nbsp; Did you beat it?</li>
              <li><strong>Deposits versus profit.</strong> How much did you deposit in total? How much of your final wealth was profit?</li>
              <li><strong>Reflection.</strong> What would you do differently with the same years? Was your result skill, luck or both?</li>
            </ol>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <ShieldCheck className="h-6 w-6 text-primary" /> What students actually practice
            </h2>
            <p>
              The asset menu covers individual stocks, an S&P 500 index fund, gold, crude oil,
              certificates of deposit, and a high-yield savings account. CDs carry an early
              withdrawal penalty and random life events deduct cash mid-run, so students run into
              liquidity and risk tradeoffs rather than only chasing returns. Concepts are explained
              in plain language in the{" "}
              <Link to="/guide" className="text-primary underline underline-offset-4">investing guide</Link>.
            </p>
            <p className="text-sm text-muted-foreground">
              Rise to Riches is an educational simulation using virtual money. It is not financial
              advice and involves no real-money trading.
            </p>
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <Building2 className="h-6 w-6 text-primary" /> Other modes worth assigning
            </h2>
            <p>
              The{" "}
              <Link to="/real-estate-game" className="text-primary underline underline-offset-4">real estate simulation</Link>{" "}
              swaps stocks for property across U.S. cities, which works well as a follow-up lesson
              on illiquid assets. The{" "}
              <Link to="/sandbox" className="text-primary underline underline-offset-4">Sandbox</Link>{" "}
              lets students build counterfactual scenarios and see how a shock changes an otherwise
              historical timeline.
            </p>
          </section>

          <ClassShareKit />

          <section className="mb-12 space-y-6">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <Trophy className="h-6 w-6 text-primary" /> Frequently asked questions
            </h2>
            {FAQ.map((f) => (
              <div key={f.q} className="space-y-2">
                <h3 className="text-lg font-semibold">{f.q}</h3>
                <p className="text-muted-foreground">{f.a}</p>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">Check the <Link to="/methodology" className="text-primary underline underline-offset-4">methodology and limitations</Link> and <Link to="/contact" className="text-primary underline underline-offset-4">contact us for support</Link> before class.</p>
          </section>

          <div className="rounded-xl border border-border/40 bg-card/40 p-6">
            <p className="mb-3 text-sm text-muted-foreground">Ready to try it before class?</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link to="/" className="text-primary underline underline-offset-4">Play the stock simulator</Link>
              <Link to="/learn/stock-market-game-high-school" className="text-primary underline underline-offset-4">Minute-by-minute lesson plan</Link>
              <Link to="/learn/how-to-use-stock-market-simulator" className="text-primary underline underline-offset-4">How to use the simulator</Link>
              <Link to="/learn/stock-market-crashes" className="text-primary underline underline-offset-4">Stock market crashes explained</Link>
              <Link to="/learn/how-diversification-works" className="text-primary underline underline-offset-4">Diversification lesson</Link>
              <Link to="/methodology" className="text-primary underline underline-offset-4">Methodology &amp; data sources</Link>
              <Link to="/standards" className="text-primary underline underline-offset-4">National Standards alignment</Link>
              <Link to="/real-estate-game" className="text-primary underline underline-offset-4">Play the real estate game</Link>
              <Link to="/leaderboard" className="text-primary underline underline-offset-4">See the leaderboard</Link>
            </div>
          </div>
        </div>
      </article>
    </>
  );
};

export default ForTeachers;
