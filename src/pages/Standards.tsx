import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const ROWS: { code: string; know: string; does: string; coverage: string }[] = [
  { code: "Investing 8-2", know: "Common financial assets include CDs, stocks and mutual funds", does: "Choose among individual stocks, an S&P 500 index fund, CDs, a high-yield savings account and commodities", coverage: "Direct" },
  { code: "Investing 8-5, 12-6", know: "Pooled funds spread risk, and allocation should fit risk tolerance and time horizon", does: "Compare an index-fund portfolio with a few hand-picked stocks over the same years", coverage: "Direct" },
  { code: "Investing 8-6, 12-3", know: "Investments carry different risk, and riskier assets tend to earn more over the long run", does: "Compare CD and savings returns with stocks across 10 to 35 years", coverage: "Direct" },
  { code: "Investing 8-7", know: "Compounding builds the most wealth for people who invest over longer periods", does: "Hold through a 20 or 35 year game and watch growth accelerate", coverage: "Direct" },
  { code: "Investing 12-2c", know: "Assets with large price swings, such as precious metals and crypto, are speculative", does: "Track gold and oil swings against stocks and the index fund, plus Bitcoin in Advanced mode", coverage: "Direct" },
  { code: "Investing 12-5", know: "Prices respond to market conditions, and downturns hit asset prices", does: "Play through the 2000 to 2002, 2008 and 2022 down years in real annual data", coverage: "Direct" },
  { code: "Investing 12-13", know: "Investors judge results against a benchmark such as the S&P 500", does: "Compare each student's ending wealth with the S&P 500 index fund", coverage: "Direct" },
  { code: "Investing 12-9", know: "Behavioral biases lead to worse outcomes", does: "Debrief who sold in a crash or chased last year's winner, and what it cost", coverage: "With class discussion" },
  { code: "Saving 12-1", know: "Savings options like CDs differ in rates and features", does: "Compare CD and high-yield savings returns", coverage: "Partial" },
];

const Standards = () => {
  const url = "https://investmentsimulator.app/standards";
  const title = "National Standards Alignment | Rise to Riches";
  const description = "Which National Standards for Personal Financial Education the free Rise to Riches stock market simulator supports, and what students do for each.";
  return (
    <>
      
      <article className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <nav className="mb-8 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <span className="mx-2">/</span>
            <Link to="/for-teachers" className="hover:text-foreground">For Teachers</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">Standards</span>
          </nav>
          <h1 className="mb-4 text-4xl md:text-5xl font-editorial font-normal leading-[1.05] tracking-tight">National Standards Alignment</h1>
          <p className="mb-10 text-lg text-muted-foreground">The simulator is free, needs no sign-up, and fits a single class period.</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="bg-card text-foreground">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Standard</th>
                  <th scope="col" className="p-3 font-semibold">Students will know that</th>
                  <th scope="col" className="p-3 font-semibold">What they do in the simulator</th>
                  <th scope="col" className="p-3 font-semibold">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.code} className="border-t border-border align-top">
                    <th scope="row" className="p-3 font-mono text-xs font-medium whitespace-nowrap text-primary">{r.code}</th>
                    <td className="p-3 text-muted-foreground">{r.know}</td>
                    <td className="p-3 text-muted-foreground">{r.does}</td>
                    <td className="p-3 whitespace-nowrap">{r.coverage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Standard codes refer to the{" "}
            <a href="https://www.jumpstart.org/education/national-standards/" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">National Standards for Personal Financial Education</a>{" "}
            (2021), © Council for Economic Education and Jump$tart Coalition for Personal Financial Literacy.
          </p>
          <p className="mt-10 text-sm">
            <Link to="/for-teachers" className="text-primary underline underline-offset-4">Back to the teacher guide</Link>
          </p>
        </div>
      </article>
    </>
  );
};

export default Standards;
