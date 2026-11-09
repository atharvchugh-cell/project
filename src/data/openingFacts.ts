/** Opening "Did you know?" facts. Stable IDs — never renumber. */
export interface OpeningFact {
  id: string;
  title: string;
  body: string;
  /** True when the fact names a historical period and would leak a hidden year. */
  revealsPeriod?: boolean;
  /** Year the fact's event happened, used to relate it to the game's start year. */
  year?: number;
}

/** One short line tying a fact to the player's start year without hinting at later years. */
export function factEraLine(fact: OpeningFact, startYear?: number): string | null {
  if (!startYear) return null;
  if (fact.year && fact.year < startYear) {
    const gap = startYear - fact.year;
    return `Your game starts in ${startYear}, ${gap} year${gap === 1 ? '' : 's'} after this.`;
  }
  return `Your game starts in ${startYear}. Keep this in mind as you invest.`;
}

export const OPENING_FACTS: OpeningFact[] = [
  { id: 'stock', title: 'A stock', body: 'When you buy a stock, you own a tiny piece of a company.' },
  { id: 'sp500', title: 'The S&P 500', body: 'The S&P 500 follows 500 leading U.S. companies. People use it to see how large U.S. stocks are doing overall.' },
  { id: 'dow', title: 'The Dow', body: 'When the news says “the Dow,” it means an index that follows 30 major U.S. companies. The S&P 500 follows a much larger group.' },
  { id: 'index-vs-fund', title: 'Index versus index fund', body: 'An index measures how a group of investments is doing. An index fund is something you can buy that aims to follow that group.' },
  { id: 'one-fund', title: 'One fund, many companies', body: 'One broad index fund can hold shares in hundreds of companies. Owning one fund doesn’t always mean betting on one company.' },
  { id: 'shared-risk', title: 'Five stocks can share one risk', body: 'Owning five stocks doesn’t always mean your money is well spread out. If they’re all technology companies, the same news could affect all five.' },
  { id: 'early-trading', year: 1792, title: 'Early stock trading', body: 'In 1792, 24 brokers agreed on rules for trading in New York. That agreement became the beginning of the New York Stock Exchange.' },
  { id: 'sp500-changes', year: 1957, title: 'The S&P 500 changes', body: 'The S&P 500 began in 1957. The companies it follows can change as businesses and the economy change.' },
  { id: 'dotcom', year: 2000, title: 'The dot-com boom', body: 'Internet stocks became very popular in the late 1990s. When the dot-com boom ended around 2000, many stock prices fell sharply.', revealsPeriod: true },
  { id: 'crisis-2008', year: 2008, title: 'The 2008 crisis', body: 'The 2008 financial crisis affected more than stocks. Homes, banks, jobs, and financial markets were all part of the story.', revealsPeriod: true },
  { id: 'recovery', title: 'Recovering from a loss', body: 'If $100 falls to $50, it has lost 50%. To get back to $100, it needs to gain 100%.' },
  { id: 'contributions', title: 'Contributions versus gains', body: 'Your portfolio can grow because you added money or because your investments earned money. Your final balance includes both.' },
  { id: 'dow-smaller', year: 1896, title: 'The Dow used to be smaller', body: 'When the Dow began in 1896, it followed just 12 companies. Today, it follows 30.' },
  { id: 'dow-points', title: 'Dow points', body: 'If you hear that “the Dow rose 300 points,” that doesn’t mean it rose 300%. Points and percentages are different ways of describing a change.' },
  { id: 'weights', title: 'Companies have different weights', body: 'The 500 companies in the S&P 500 don’t all count equally. Bigger companies generally have more influence on the index’s movement.' },
  { id: 'why-prices-move', title: 'Why prices move', body: 'A stock’s price reflects what buyers and sellers think it is worth. New information can change their minds quickly.' },
  { id: 'last-winner', title: 'Last year’s winner', body: 'The stock that did best last year won’t necessarily do best next year. Past results tell you what happened, not what comes next.' },
  { id: 'money-jobs', title: 'Different money, different jobs', body: 'Money you might need soon has a different job from money you can leave invested for years. When you need it matters.' },
  { id: 'circuit-breakers', year: 1987, title: 'Trading can pause', body: 'After a major market crash in 1987, U.S. markets introduced rules that can pause trading during severe drops. They’re called circuit breakers.' },
];
