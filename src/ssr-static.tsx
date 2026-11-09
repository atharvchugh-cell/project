// Build-time renderer for static content pages (used by scripts/prerender.ts).
// Renders the exact same components visitors get, so the prerendered body
// matches the live page — no crawler-only copy. Also returns the JSON-LD the
// page and RouteHead add through Helmet, so structured data is in raw HTML.
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider, type HelmetServerState } from "react-helmet-async";
import { BASE_PATH, withBase } from "./lib/basePath";
import Guide from "./pages/Guide";
import Learn from "./pages/Learn";
import ForTeachers from "./pages/ForTeachers";
import Standards from "./pages/Standards";
import Legal from "./pages/Legal";
import HighSchoolStockGame from "./pages/HighSchoolStockGame";
import Diversification from "./pages/Diversification";
import InvestmentSimulator from "./pages/InvestmentSimulator";
import HowToUseSimulator from "./pages/HowToUseSimulator";
import StockMarketCrashes from "./pages/StockMarketCrashes";
import About from "./pages/About";
import Methodology from "./pages/Methodology";
import Sandbox from "./pages/Sandbox";
import RealEstateGame from "./pages/RealEstateGame";
import Leaderboard from "./pages/Leaderboard";
import NotFound from "./pages/NotFound";
import { WelcomeScreen } from "./components/game/WelcomeScreen";
import { RouteHead } from "./seo/RouteHead";
import { RealEstateSchema } from "./seo/RealEstateSchema";
import { PrivacyControls } from "./components/PrivacyControls";

// Homepage: the same WelcomeScreen visitors see on first load (no save/resume state yet).
const Home = () => <WelcomeScreen onPlaySolo={() => {}} onPlayGroup={() => {}} />;
const RealEstate = () => (
  <>
    <RealEstateSchema />
    <RealEstateGame />
  </>
);

const PAGES: Record<string, () => JSX.Element> = {
  "/": Home,
  "/privacy": Legal,
  "/terms": Legal,
  "/cookies": Legal,
  "/contact": Legal,
  "/guide": Guide,
  "/learn": Learn,
  "/for-teachers": ForTeachers,
  "/standards": Standards,
  "/learn/stock-market-game-high-school": HighSchoolStockGame,
  "/learn/how-diversification-works": Diversification,
  "/learn/investment-simulator": InvestmentSimulator,
  "/learn/how-to-use-stock-market-simulator": HowToUseSimulator,
  "/learn/stock-market-crashes": StockMarketCrashes,
  "/about": About,
  "/methodology": Methodology,
  "/sandbox": Sandbox,
  "/real-estate-game": RealEstate,
  "/leaderboard": Leaderboard,
  "/404.html": NotFound,
};

export const STATIC_PATHS = Object.keys(PAGES);

export function render(path: string): { body: string; scripts: string } | null {
  const Page = PAGES[path];
  if (!Page) return null;
  const ctx: { helmet?: HelmetServerState } = {};
  const body = renderToString(
    <HelmetProvider context={ctx}>
      <StaticRouter basename={BASE_PATH || "/"} location={withBase(path)}>
        <RouteHead />
        <main>
          <Page />
        </main>
        <PrivacyControls />
      </StaticRouter>
    </HelmetProvider>,
  );
  return { body, scripts: ctx.helmet?.script.toString() ?? "" };
}
