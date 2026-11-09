import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RealEstateSchema } from "./seo/RealEstateSchema";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import { RouteHead } from "./seo/RouteHead";
import { PrivacyControls } from "./components/PrivacyControls";
import { flushPendingRuns, readPendingRuns } from "./lib/analytics";

// Retry finished games this device couldn't save earlier.
if (typeof window !== "undefined" && readPendingRuns().length) window.setTimeout(() => { void flushPendingRuns(); }, 4000);
const Legal = lazy(() => import("./pages/Legal"));

// Defer non-home routes — keeps the homepage JS bundle lean for faster TTI.
const RealEstateGame = lazy(() => import("./pages/RealEstateGame.tsx"));
const ClientContracts = lazy(() => import("./pages/ClientContracts.tsx"));
const Guide = lazy(() => import("./pages/Guide.tsx"));
const ForTeachers = lazy(() => import("./pages/ForTeachers.tsx"));
const Standards = lazy(() => import("./pages/Standards.tsx"));
const Learn = lazy(() => import("./pages/Learn.tsx"));
const Methodology = lazy(() => import("./pages/Methodology.tsx"));
const HighSchoolStockGame = lazy(() => import("./pages/HighSchoolStockGame.tsx"));
const Diversification = lazy(() => import("./pages/Diversification.tsx"));
const InvestmentSimulator = lazy(() => import("./pages/InvestmentSimulator.tsx"));
const HowToUseSimulator = lazy(() => import("./pages/HowToUseSimulator.tsx"));
const StockMarketCrashes = lazy(() => import("./pages/StockMarketCrashes.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.tsx"));
const AdminSeo = lazy(() => import("./pages/AdminSeo.tsx"));
const AdminSuggestions = lazy(() => import("./pages/AdminSuggestions.tsx"));
const AdminAiUsage = lazy(() => import("./pages/AdminAiUsage.tsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const AdminCredits = lazy(() => import("./pages/AdminCredits.tsx"));
const AdminPlayers = lazy(() => import("./pages/AdminPlayers.tsx"));
const AdminPlayer = lazy(() => import("./pages/AdminPlayer.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Leaderboard = lazy(() => import("./pages/Leaderboard.tsx"));
const Share = lazy(() => import("./pages/Share.tsx"));
const Sandbox = lazy(() => import("./pages/Sandbox.tsx"));
const SandboxSetup = lazy(() => import("./pages/SandboxSetup.tsx"));
const SandboxResults = lazy(() => import("./pages/SandboxResults.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Friends = lazy(() => import("./pages/Friends.tsx"));
const Account = lazy(() => import("./pages/Account.tsx"));
const ChallengePage = lazy(() => import("./pages/Challenge.tsx"));
const RunResult = lazy(() => import("./pages/RunResult.tsx"));

const queryClient = new QueryClient();

const RealEstateRoute = () => (
  <>
    <RealEstateSchema />
    <RealEstateGame />
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteHead />
        <main>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/play" element={<Index initialScreen="group-lobby" />} />
              <Route path="/join" element={<Index initialScreen="group-lobby" initialLobbyMode="join" />} />
              <Route path="/host" element={<Index initialScreen="group-lobby" initialLobbyMode="create" />} />
              <Route path="/real-estate-game" element={<RealEstateRoute />} />
              <Route path="/client-contracts" element={<ClientContracts />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="/for-teachers" element={<ForTeachers />} />
              <Route path="/standards" element={<Standards />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/learn/stock-market-game-high-school" element={<HighSchoolStockGame />} />
              <Route path="/learn/how-diversification-works" element={<Diversification />} />
              <Route path="/learn/investment-simulator" element={<InvestmentSimulator />} />
              <Route path="/learn/how-to-use-stock-market-simulator" element={<HowToUseSimulator />} />
              <Route path="/learn/stock-market-crashes" element={<StockMarketCrashes />} />
              <Route path="/about" element={<About />} />
              {["/privacy", "/terms", "/cookies", "/contact"].map(path => <Route key={path} path={path} element={<Legal />} />)}
              <Route path="/methodology" element={<Methodology />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/share" element={<Share />} />
              <Route path="/sandbox" element={<Sandbox />} />
              <Route path="/sandbox/setup" element={<SandboxSetup />} />
              <Route path="/sandbox/results" element={<SandboxResults />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/account" element={<Account />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/c/:code" element={<ChallengePage />} />
              <Route path="/r/:traceId" element={<RunResult />} />
              <Route path="/admin/seo" element={<AdminSeo />} />
              <Route path="/admin/suggestions" element={<AdminSuggestions />} />
              <Route path="/admin/ai-usage" element={<AdminAiUsage />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/credits" element={<AdminCredits />} />
              <Route path="/admin/players" element={<AdminPlayers />} />
              <Route path="/admin/players/:subject" element={<AdminPlayer />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
      <PrivacyControls />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
