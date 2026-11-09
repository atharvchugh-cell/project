/**
 * Single source of truth for route head metadata.
 *
 * Consumed by:
 *  - src/seo/RouteHead.tsx (client, every navigation)
 *  - scripts/generate-sitemap.ts (predev/prebuild) — writes public/sitemap.xml
 *  - scripts/prerender.ts (postbuild) — writes a static HTML file per route
 *
 * Because the browser and the prerenderer read the same object, the initial
 * HTML head and the head after client-side routing always agree.
 */

export const BASE_URL = "https://investmentsimulator.app";
export const SITE_NAME = "Rise to Riches";
export const PUBLIC_ROBOTS = "index,follow,max-image-preview:large";
export const DEFAULT_IMAGE = `${BASE_URL}/__l5e/assets-v1/c43fbe83-25b5-4f97-a394-083fb6596f77/og-home.jpg`;
const GUIDE_IMAGE = `${BASE_URL}/__l5e/assets-v1/c5041e8a-1990-401f-80e0-96af7519c18b/og-guide.jpg`;
const REAL_ESTATE_IMAGE = `${BASE_URL}/__l5e/assets-v1/0fd6bfd3-b2d7-474f-8908-8303527ccdd1/og-realestate.jpg`;

export interface Crumb {
  name: string;
  path: string;
}

export interface SeoRoute {
  /** Route path exactly as declared in src/App.tsx. */
  path: string;
  title: string;
  description: string;
  /** Absolute og:image URL, when the route has a dedicated one. */
  image?: string;
  ogType: "website" | "article";
  changefreq: "daily" | "weekly" | "monthly";
  priority: string;
  /** Source file(s) whose last git commit date becomes the sitemap <lastmod>. */
  sources: string[];
  /** Visible breadcrumb trail (emitted as BreadcrumbList by RouteHead). */
  breadcrumb?: Crumb[];
}

const LEGAL_DESCRIPTIONS: Record<string, string> = {
  privacy: "How Rise to Riches collects, uses and keeps your data, with your privacy choices and how to contact us.",
  terms:
    "The terms for using Rise to Riches, a free educational stock market simulation with virtual money. Not a brokerage or investment advice.",
  cookies: "How Rise to Riches uses browser storage, what optional analytics covers and how to clear your data.",
  contact: "How to contact Rise to Riches about privacy, game support, accessibility and safety.",
};

const home: Crumb = { name: "Home", path: "/" };
const learn: Crumb = { name: "Learn", path: "/learn" };

export const SEO_ROUTES: SeoRoute[] = [
  ...["privacy", "terms", "cookies", "contact"].map((name) => ({
    path: `/${name}`,
    title: `${name[0].toUpperCase() + name.slice(1)} — Rise to Riches`,
    description: LEGAL_DESCRIPTIONS[name],
    sources: ["src/pages/Legal.tsx"],
    ogType: "website" as const,
    changefreq: "monthly" as const,
    priority: "0.3",
  })),
  {
    path: "/",
    sources: [
      "src/pages/Index.tsx",
      "src/components/game/WelcomeScreen.tsx",
      "src/components/HomeResources.tsx",
      "src/seo/HomeApplicationSchema.tsx",
      "src/components/game/HeroAnimation.tsx",
      "src/components/ui/dot-pattern.tsx",
      "src/components/SandboxCTA.tsx",
      "src/components/RequestBox.tsx",
    ],
    title: "Free Investment Simulator & Stock Market Game | Rise to Riches",
    description:
      "Practice investing with virtual money on real historical annual returns. Play solo or run a classroom game in your browser. Free, no account required.",
    image: DEFAULT_IMAGE,
    ogType: "website",
    changefreq: "weekly",
    priority: "1.0",
  },
  {
    path: "/learn",
    sources: ["src/pages/Learn.tsx"],
    title: "Learn — Investing Lessons & Classroom Resources",
    description:
      "Free investing lessons and classroom resources. Explore beginner guides, the simulator, diversification, market crashes and our data methodology.",
    ogType: "website",
    changefreq: "monthly",
    priority: "0.8",
  },
  {
    path: "/guide",
    sources: ["src/pages/Guide.tsx"],
    title: "How to Invest in Stocks — A Beginner's Guide for Students",
    description:
      "A free beginner's guide to investing in stocks for high school students. Learn how the S&P 500, stocks, gold, and CDs work — practice in our simulator.",
    image: GUIDE_IMAGE,
    ogType: "article",
    changefreq: "monthly",
    priority: "0.7",
  },
  {
    path: "/learn/how-to-use-stock-market-simulator",
    sources: ["src/pages/HowToUseSimulator.tsx"],
    title: "How to Use the Stock Market Simulator — Beginner Walkthrough",
    description:
      "Learn Rise to Riches step by step: choose a mode and era, track deposits versus profit, compare with the S&P 500, save a game or play with a class.",
    ogType: "article",
    changefreq: "monthly",
    priority: "0.7",
    breadcrumb: [home, learn, { name: "How to use the simulator", path: "/learn/how-to-use-stock-market-simulator" }],
  },
  {
    path: "/learn/stock-market-crashes",
    sources: ["src/pages/StockMarketCrashes.tsx", "src/data/historicalData.ts"],
    title: "Stock Market Crashes Explained: 2000, 2008 and 2020",
    description:
      "Explore the dot-com crash, 2008 financial crisis and 2020 market drop using annual returns and exercises you can replay in the stock simulator.",
    ogType: "article",
    changefreq: "monthly",
    priority: "0.7",
    breadcrumb: [home, learn, { name: "Stock market crashes", path: "/learn/stock-market-crashes" }],
  },
  {
    path: "/learn/stock-market-game-high-school",
    sources: ["src/pages/HighSchoolStockGame.tsx"],
    title: "Stock Market Game for High School Students — Free, One Class Period",
    description:
      "Free stock market game for high school students. Use a one-period lesson plan, discussion questions and teacher guidance. Play with virtual money.",
    ogType: "article",
    changefreq: "monthly",
    priority: "0.8",
  },
  {
    path: "/learn/how-diversification-works",
    sources: ["src/pages/Diversification.tsx"],
    title: "How Diversification Works — With Real Market Examples",
    description:
      "See how diversification changes a portfolio using historical examples for stocks, gold, oil, CDs and savings across market crashes.",
    ogType: "article",
    changefreq: "monthly",
    priority: "0.7",
  },
  {
    path: "/learn/investment-simulator",
    sources: ["src/pages/InvestmentSimulator.tsx"],
    title: "What Is an Investment Simulator? How to Practice Investing",
    description:
      "What is an investment simulator? Compare live paper trading with historical replay, learn the limitations and try a virtual-money investing routine.",
    ogType: "article",
    changefreq: "monthly",
    priority: "0.7",
  },
  {
    path: "/about",
    sources: ["src/pages/About.tsx"],
    title: "About Rise to Riches — Who Makes This Simulator",
    description:
      "Learn about the independent Rise to Riches project, how the historical simulator works and its data sources, educational goals and limitations.",
    ogType: "website",
    changefreq: "monthly",
    priority: "0.5",
  },
  {
    path: "/methodology",
    sources: ["src/pages/Methodology.tsx"],
    title: "Methodology & Data Sources — How the Simulator Works",
    description:
      "Explore stored stock returns and city-price tables, source-verification limits, synthetic price moves, deposits and simplified simulation rules.",
    ogType: "article",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/for-teachers",
    sources: ["src/pages/ForTeachers.tsx", "src/components/ClassShareKit.tsx"],
    title: "Free Stock Market Game for Students & Classrooms — Teacher Guide",
    description:
      "Run a free classroom stock market game with virtual money, join codes, no student sign-ups, a printable worksheet and teacher guidance.",
    ogType: "article",
    changefreq: "monthly",
    priority: "0.8",
  },
  {
    path: "/standards",
    sources: ["src/pages/Standards.tsx"],
    title: "National Standards Alignment | Rise to Riches",
    description:
      "Which National Standards for Personal Financial Education the free Rise to Riches stock market simulator supports, and what students do for each.",
    ogType: "article",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/real-estate-game",
    sources: [
      "src/pages/RealEstateGame.tsx",
      "src/components/RealEstateSetupExplanation.tsx",
      "src/data/realEstateData.ts",
      "src/seo/RealEstateSchema.tsx",
    ],
    title: "Real Estate Game — Build Your Property Empire",
    description:
      "Play a free property investing game across ten U.S. city markets. Trade virtual properties using stored 1990–2020 prices. No account needed.",
    image: REAL_ESTATE_IMAGE,
    ogType: "website",
    changefreq: "weekly",
    priority: "0.7",
  },
  {
    path: "/sandbox",
    sources: ["src/pages/Sandbox.tsx", "src/components/SandboxTeaser.tsx", "src/lib/sandbox/examples.ts"],
    title: "Sandbox — Control the Market · Rise to Riches",
    description:
      "Create market scenarios with stocks and property. Add crashes, booms and shocks, then compare the simulation with its baseline. Free educational tool.",
    ogType: "website",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/leaderboard",
    sources: ["src/pages/Leaderboard.tsx"],
    title: "Leaderboard — Stock Simulator Hall of Fame",
    description:
      "Top stock-simulator players ranked by final wealth and % return across historical windows like 2000–2020 and 1990–2010.",
    ogType: "website",
    changefreq: "daily",
    priority: "0.5",
  },
];

/**
 * Private, per-session or utility routes: own title plus `noindex,follow`
 * (crawlable, not indexed). Never listed in the sitemap.
 */
export const NOINDEX_ROUTES: { path: string; title: string; description: string }[] = [
  {
    path: "/auth",
    title: "Sign in — Rise to Riches",
    description:
      "Sign in or create a free Rise to Riches account to keep your game history and stats. Playing without an account stays free.",
  },
  {
    path: "/friends",
    title: "Friends — Rise to Riches",
    description: "Your private friend requests, social profile and activity preferences.",
  },
  {
    path: "/account",
    title: "Your account — Rise to Riches",
    description: "Your Rise to Riches stats, game history, achievements and profile settings.",
  },
  {
    path: "/play",
    title: "Play with friends — Rise to Riches",
    description: "Play the historical stock market game with friends: host a room or join one with a code.",
  },
  {
    path: "/join",
    title: "Join a game — Rise to Riches",
    description: "Join a friend's stock market game with a room code. No sign-up needed.",
  },
  {
    path: "/host",
    title: "Host a game — Rise to Riches",
    description: "Host a multiplayer stock market game and invite players with a room code, link or QR code.",
  },
  { path: "/share", title: "Shared result — Rise to Riches", description: "A shared Rise to Riches game result." },
  {
    path: "/client-contracts",
    title: "Client Contracts — Run a Fictional Hedge Fund | Rise to Riches",
    description:
      "Manage a fictional hedge fund: pay investors on time, beat the index and earn new capital. A free strategy game from Rise to Riches.",
  },
  {
    path: "/unsubscribe",
    title: "Unsubscribe — Rise to Riches",
    description: "Unsubscribe from Rise to Riches emails.",
  },
  {
    path: "/sandbox/setup",
    title: "Build your scenario — Rise to Riches",
    description: "Build your own economic scenario: pick years, investments and market events.",
  },
  {
    path: "/sandbox/results",
    title: "Scenario results — Rise to Riches",
    description: "Results of your custom economic scenario.",
  },
  { path: "/admin/suggestions", title: "Admin — Rise to Riches", description: "Site administration." },
  { path: "/admin/ai-usage", title: "Admin — Rise to Riches", description: "Site administration." },
  { path: "/admin/seo", title: "Admin — Rise to Riches", description: "Site administration." },
  { path: "/admin/dashboard", title: "Admin — Rise to Riches", description: "Site administration." },
  { path: "/admin/credits", title: "Admin — Rise to Riches", description: "Site administration." },
  { path: "/admin/players", title: "Admin — Rise to Riches", description: "Site administration." },
];

/** Prefixes for dynamic private routes (challenge, run result, admin player). */
export const NOINDEX_PREFIXES = ["/c/", "/r/", "/admin/"];

export const NOT_FOUND_HEAD = {
  title: "Page not found — Rise to Riches",
  description: "This page does not exist. Start a free stock market game or browse the Learn section.",
};

export function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

export type ResolvedHead =
  | { kind: "public"; route: SeoRoute }
  | { kind: "noindex"; title: string; description: string; path: string }
  | { kind: "dynamic-noindex" }
  | { kind: "not-found" };

export function resolveHead(pathname: string): ResolvedHead {
  const path = normalizePath(pathname);
  const route = SEO_ROUTES.find((r) => r.path === path);
  if (route) return { kind: "public", route };
  const priv = NOINDEX_ROUTES.find((r) => r.path === path);
  if (priv) return { kind: "noindex", ...priv };
  if (NOINDEX_PREFIXES.some((p) => path.startsWith(p))) return { kind: "dynamic-noindex" };
  return { kind: "not-found" };
}

export function breadcrumbJsonLd(trail: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${BASE_URL}${c.path}`,
    })),
  };
}
