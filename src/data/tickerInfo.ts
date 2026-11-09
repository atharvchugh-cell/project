export interface TickerInfoData {
  industry: string;
  description: string;
  drivers?: string; // what makes it rise/fall (for commodities/macro)
}

export const TICKER_INFO: Record<string, TickerInfoData> = {
  // === Stocks ===
  aapl: {
    industry: 'Technology / Consumer Electronics',
    description: 'Designs and sells iPhones, iPads, Macs, and digital services like the App Store and Apple Music.',
  },
  msft: {
    industry: 'Technology / Software',
    description: 'Makes Windows, Office, Azure cloud services, and Xbox gaming products.',
  },
  ibm: {
    industry: 'Technology / Enterprise IT',
    description: 'Provides enterprise computing, cloud, AI, and consulting services to businesses worldwide.',
  },
  intc: {
    industry: 'Technology / Semiconductors',
    description: 'Designs and manufactures computer processors (CPUs) used in PCs and data centers.',
  },
  nvda: {
    industry: 'Technology / Semiconductors',
    description: 'Makes graphics processing units (GPUs) used in gaming, AI, and data centers.',
  },
  csco: {
    industry: 'Technology / Networking',
    description: 'Builds networking equipment like routers and switches that power the internet and enterprise networks.',
  },
  mstr: {
    industry: 'Technology / Business Intelligence',
    description: 'Enterprise analytics and business intelligence software company, also a major Bitcoin holder.',
  },
  jpm: {
    industry: 'Finance / Banking',
    description: 'One of the largest global banks, offering investment banking, asset management, and consumer banking.',
  },
  bac: {
    industry: 'Finance / Banking',
    description: 'Major US bank providing consumer banking, wealth management, and corporate financial services.',
  },
  brk: {
    industry: 'Finance / Conglomerate',
    description: 'Warren Buffett\'s holding company owning insurance, railroads, energy, and many other businesses.',
  },
  xom: {
    industry: 'Energy / Oil & Gas',
    description: 'One of the world\'s largest oil and gas companies, involved in exploration, production, and refining.',
  },
  pfe: {
    industry: 'Healthcare / Pharmaceuticals',
    description: 'Major pharmaceutical company developing vaccines, medicines, and consumer health products.',
  },
  amgn: {
    industry: 'Healthcare / Biotechnology',
    description: 'Biotech company developing therapies for serious illnesses including cancer, heart disease, and inflammation.',
  },
  abt: {
    industry: 'Healthcare / Medical Devices',
    description: 'Makes medical devices, diagnostics, nutritional products, and branded generic pharmaceuticals.',
  },
  mcd: {
    industry: 'Consumer / Restaurants',
    description: 'World\'s largest fast-food chain operating thousands of restaurants globally through franchising.',
  },
  sears: {
    industry: 'Consumer / Retail',
    description: 'Once-iconic American department store and retail chain that struggled against e-commerce competition.',
  },
  bhe: {
    industry: 'Technology / Electronics Manufacturing',
    description: 'Contract electronics manufacturer providing design, engineering, and manufacturing services.',
  },
  bbry: {
    industry: 'Technology / Mobile',
    description: 'Formerly known for BlackBerry smartphones, now focused on cybersecurity and enterprise software.',
  },
  // === Index Funds ===
  sp500: {
    industry: 'Index Fund',
    description: 'Tracks the S&P 500 index — the 500 largest US public companies. A diversified way to invest in the broad US stock market.',
  },
  // === Commodities ===
  gold: {
    industry: 'Commodity / Precious Metal',
    description: 'Physical gold — a store of value and hedge against inflation.',
    drivers: 'Tends to rise during economic uncertainty, high inflation, falling interest rates, and geopolitical crises. Tends to fall when the economy is strong, interest rates rise, and the US dollar strengthens.',
  },
  oil: {
    industry: 'Commodity / Energy',
    description: 'Crude oil — the most traded commodity in the world, essential for transportation and industry.',
    drivers: 'Tends to rise when demand is strong, supply is constrained (OPEC cuts, geopolitical disruptions), or economies are growing fast. Tends to fall during recessions, oversupply, or shifts toward renewable energy.',
  },
  // === Savings ===
  hysa: {
    industry: 'Savings / Fixed Income',
    description: 'A high-yield savings account earning interest with no market risk. Your principal is always safe.',
    drivers: 'Interest rates rise when the Federal Reserve raises rates, and fall when the Fed cuts rates. Safe but returns are modest compared to equities.',
  },
  // === Crypto ===
  btc: {
    industry: 'Cryptocurrency',
    description: 'Bitcoin — the first and largest cryptocurrency, a decentralized digital currency.',
    drivers: 'Tends to rise with increased adoption, institutional interest, and loose monetary policy. Tends to fall during regulatory crackdowns, security breaches, and risk-off market sentiment.',
  },
};
