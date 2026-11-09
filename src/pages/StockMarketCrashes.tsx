import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { SP500_ANNUAL_RETURNS, GOLD_ANNUAL_RETURNS } from "@/data/historicalData";

const URL = "https://investmentsimulator.app/learn/stock-market-crashes";
const TITLE = "Stock Market Crashes Explained: 2000, 2008 and 2020";
const H2 = "mb-3 mt-12 text-2xl font-semibold";
const A = "text-primary underline underline-offset-4";

const pct = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
const YEARS = [1999, 2000, 2001, 2002, 2003, 2007, 2008, 2009, 2019, 2020, 2021];

export default function StockMarketCrashes() {
  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          url: URL,
          inLanguage: "en",
          isAccessibleForFree: true,
          publisher: { "@id": "https://investmentsimulator.app/#organization" },
          isPartOf: { "@id": "https://investmentsimulator.app/#website" },
        })}</script>
      </Helmet>
      <article className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-16 leading-relaxed">
          <nav className="mb-8 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <span className="mx-2">/</span>
            <Link to="/learn" className="hover:text-foreground">Learn</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">Stock market crashes</span>
          </nav>

          <header className="mb-10">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Market history</p>
            <h1 className="mb-4 text-4xl md:text-5xl font-editorial font-semibold leading-[1.05] tracking-tight">
              Three stock market crashes, and how to replay them
            </h1>
            <p className="text-lg text-muted-foreground">
              The dot-com crash, the 2008 financial crisis and the 2020 pandemic drop all fall inside the years
              this simulator covers (1990 to 2025). Here is what happened, what the game's data shows, and what
              it cannot show.
            </p>
          </header>

          <h2 className={H2}>Annual data versus what happened inside a year</h2>
          <p>
            The simulator uses one real return per year for each investment. The path inside the year is
            generated so the year ends at the right total. That means the game gets each year's result right,
            but it does not copy the real daily drops and rebounds. The{" "}
            <Link to="/methodology" className={A}>methodology page</Link> explains how.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm border border-border/50">
              <caption className="text-left text-muted-foreground mb-2">Annual returns used in the game (rounded)</caption>
              <thead><tr className="bg-card/40"><th className="p-2 text-left">Year</th><th className="p-2 text-left">S&amp;P 500 index fund</th><th className="p-2 text-left">Gold</th></tr></thead>
              <tbody>
                {YEARS.map((y) => (
                  <tr key={y} className="border-t border-border/40">
                    <td className="p-2">{y}</td>
                    <td className="p-2 tabular-nums">{pct(SP500_ANNUAL_RETURNS[y])}</td>
                    <td className="p-2 tabular-nums">{pct(GOLD_ANNUAL_RETURNS[y])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className={H2}>The dot-com crash (2000 to 2002)</h2>
          <p>
            In the late 1990s, prices of internet and technology companies rose far ahead of their profits.
            When that reversed, the market fell for three years in a row. In the game's data the S&amp;P 500
            fund loses value in 2000, 2001 and 2002. Many single technology stocks fell much further than the
            index. A Federal Reserve staff note covers this period, from the telecom and internet boom through the crash and the 2001 recession:{" "}
            <a href="https://www.federalreserve.gov/econres/notes/feds-notes/relationship-between-macroeconomic-overheating-and-financial-vulnerability-narrative-20181012.html" className={A} rel="noopener" target="_blank">FEDS Notes, "The Relationship between Macroeconomic Overheating and Financial Vulnerability: A Narrative Investigation"</a> (Federal Reserve Board, 2018).
          </p>

          <h2 className={H2}>The 2008 financial crisis</h2>
          <p>
            Losses on home loans spread through banks and the wider financial system. In the game's data 2008
            is the worst year for the S&amp;P 500 fund, and oil falls sharply too, while gold still rises. See
            Federal Reserve History on{" "}
            <a href="https://www.federalreservehistory.org/essays/great-recession-of-200709" className={A} rel="noopener" target="_blank">the Great Recession</a>.
          </p>

          <h2 className={H2}>The 2020 pandemic drop</h2>
          <p>
            In early 2020 stocks fell very quickly, then recovered within the same year. Because the game uses
            annual returns, 2020 shows up as a positive year for the S&amp;P 500 fund. The steep drop in the
            spring is not reproduced. This is a good example of why one number per year hides real risk. The Federal Reserve Board describes the 2020 market strain and its response in its{" "}
            <a href="https://www.federalreserve.gov/publications/2020-ar-financial-stability.htm" className={A} rel="noopener" target="_blank">2020 Annual Report section on financial stability</a>.
          </p>

          <h2 className={H2}>Why diversification does not remove all risk</h2>
          <p>
            Spreading money across different investments lowers the damage from any one of them failing. It
            does not stop the whole market from falling, and in 2008 most stocks fell together. Investor.gov
            explains{" "}
            <a href="https://www.investor.gov/introduction-investing/getting-started/asset-allocation" className={A} rel="noopener" target="_blank">asset allocation and diversification</a>{" "}
            and the basics of{" "}
            <a href="https://www.investor.gov/introduction-investing/investing-basics/what-risk" className={A} rel="noopener" target="_blank">investment risk</a>.
            Our <Link to="/learn/how-diversification-works" className={A}>diversification lesson</Link> uses the game's own numbers.
          </p>

          <h2 className={H2}>Why hindsight makes the game easier</h2>
          <p>
            You already know these crashes happened and that markets later recovered. Real investors did not.
            If you pick a start year on purpose to avoid a crash, you are using knowledge nobody had at the
            time. Play Now picks a random start year for this reason. Treat a great score from a hand-picked
            period with suspicion.
          </p>

          <h2 className={H2}>Exercises to try</h2>
          <ol className="list-decimal space-y-2 pl-6">
            <li>Use Customize to start in 1998 for 10 years in Basic mode. Put all deposits in the S&amp;P 500 fund. Then replay with the same settings and keep a third of each deposit in CDs or savings. Compare both returns with the benchmark. Moves inside each year and life events differ between runs, so treat one pair as a hint, not proof.</li>
            <li>Start in 2005 for 5 years. Write down what you will do if the index falls by a third in one year, before you start. Did you stick to it?</li>
            <li>Start in 2018 for 5 years. Notice that 2020 looks calm in the game, then read about what really happened that spring.</li>
            <li>Play a game with Play Now, which picks the start year for you, and compare it with a period you chose. The game still shows calendar years, so a random start stops you picking the period but does not remove hindsight.</li>
          </ol>

          <p className="mt-12 text-sm text-muted-foreground">
            This page explains history for learning. It is not investment advice and does not predict future
            markets. New to the controls? Read <Link to="/learn/how-to-use-stock-market-simulator" className={A}>how to use the simulator</Link>.
          </p>
        </div>
      </article>
    </>
  );
}
