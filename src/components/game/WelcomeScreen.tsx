import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { HoverGlowButton } from "@/components/ui/hover-glow-button";
import { COMPANY_COUNT } from "@/data/companyCount";
import { HomeResources } from "@/components/HomeResources";
import { HomeApplicationSchema } from "@/seo/HomeApplicationSchema";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Users,
  ArrowRight,
  ChevronDown,
  Home,
  Menu,
  Zap,
  Eye,
  Receipt,
  Search,
  Sparkles,
  Building2,
  BarChart3,
  Briefcase,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { lazy, Suspense } from "react";
import type { SoloConfig } from "./SoloSetupDialog";
// Setup dialog pulls in the full stock pool; load it only when opened.
const SoloSetupDialog = lazy(() => import("./SoloSetupDialog").then((m) => ({ default: m.SoloSetupDialog })));
import { QuickPlayDialog } from "./QuickPlayDialog";
const AdminAnalyticsPanel = lazy(() =>
  import("./AdminAnalyticsPanel").then((m) => ({ default: m.AdminAnalyticsPanel })),
);
import { prefetchRealEstate, prefetchGuide, prefetchSoloGame, prefetchGroupLobby } from "@/lib/prefetch";

import HeroAnimation from "./HeroAnimation";
import { DotPattern } from "@/components/ui/dot-pattern";
import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { SandboxCTA } from "@/components/SandboxCTA";
import RequestBox from "@/components/RequestBox";
import { formatLastPlayed, formatRemaining, type SaveMeta } from "@/lib/saveSlots";
import { useAuth } from "@/hooks/useAuth";
import { SocialAccountMenu } from "@/components/SocialAccountMenu";

interface ResumeInfo {
  /** Short label describing the saved game (e.g. "Year 5 of 20 · Complex"). */
  label: string;
  /** Resume the saved game. */
  onResume: () => void;
  /** Discard the saved game so it never restores. */
  onDiscard: () => void;
}

interface ContinueInfo {
  meta: SaveMeta;
  onResume: () => void;
  /** Open the full saved-games list. */
  onViewAll: () => void;
  /** How many saves exist in total (controls the "View all saves" link). */
  totalSaves: number;
}

interface WelcomeScreenProps {
  onPlaySolo: (config: SoloConfig) => void;
  onPlayGroup: () => void;
  /** Most recently played save, surfaced as the Continue card. */
  continueSave?: ContinueInfo | null;
  /** Surfaced when recent multiplayer credentials exist. */
  multiplayerResume?: ResumeInfo | null;
  /** Shown when rejoining a room was not possible (e.g. the game has ended). */
  multiplayerNotice?: string | null;
  onDismissMultiplayerNotice?: () => void;
}

const TICKER_ITEMS = [
  { ticker: "AAPL", change: "+2.34%" },
  { ticker: "MSFT", change: "+1.12%" },
  { ticker: "NVDA", change: "+4.56%" },
  { ticker: "GOLD", change: "-0.89%" },
  { ticker: "OIL", change: "+1.67%" },
  { ticker: "BAC", change: "-2.11%" },
  { ticker: "BRK", change: "+0.45%" },
  { ticker: "SPFUND", change: "+1.23%" },
];

function TickerBar() {
  const [changes, setChanges] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    TICKER_ITEMS.forEach((item) => {
      init[item.ticker] = item.change;
    });
    return init;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setChanges((prev) => {
        const next = { ...prev };
        const indices = [...Array(TICKER_ITEMS.length).keys()].sort(() => Math.random() - 0.5).slice(0, 3);
        for (const i of indices) {
          const item = TICKER_ITEMS[i];
          const val = (Math.random() * 8 - 3).toFixed(2);
          next[item.ticker] = (parseFloat(val) >= 0 ? "+" : "") + val + "%";
        }
        return next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full overflow-hidden border-b border-border/20 bg-card/40 backdrop-blur-md" aria-hidden="true">
      <div className="flex animate-[scroll_20s_linear_infinite] whitespace-nowrap py-3">
        {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => {
          const change = changes[item.ticker] || item.change;
          const up = change.startsWith("+");
          return (
            <span key={i} className="inline-flex items-center gap-2 mx-5 text-sm font-mono">
              <span className="text-foreground/80 font-semibold">{item.ticker}</span>
              <span className={`transition-colors duration-300 ${up ? "text-gain" : "text-loss"}`}>
                {up ? "▲" : "▼"} {change}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

const NAV_LINKS: { href: string; label: string; sandbox?: boolean; route?: boolean }[] = [
  { href: "/client-contracts", label: "Client Contracts", route: true },
  { href: "#multiplayer", label: "Multiplayer" },
  { href: "#real-estate", label: "Real Estate" },
  { href: "/sandbox/setup", label: "Sandbox", sandbox: true },
];

function TopNav() {
  const [open, setOpen] = useState(false);
  const { user: authUser } = useAuth();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/30 bg-background/80 backdrop-blur-lg">
      <div className="relative max-w-6xl mx-auto px-3 sm:px-4 md:px-8 h-14 flex items-center justify-between gap-4">
        <a
          href="#top"
          className="flex items-baseline gap-2 shrink-0 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label="Rise to Riches — home"
        >
          <span className="font-editorial font-semibold text-base sm:text-lg leading-none whitespace-nowrap">
            Rise to <span className="text-primary">Riches</span>
          </span>
          <span className="hidden xl:inline whitespace-nowrap text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/80">
            Stock Market Simulator
          </span>
        </a>
        <nav
          className="hidden lg:flex flex-1 justify-center items-center gap-5 xl:gap-7 whitespace-nowrap text-sm text-muted-foreground"
          aria-label="Primary"
        >
          {NAV_LINKS.map((l) =>
            l.sandbox ? (
              <SandboxCTA
                key={l.href}
                source="landing-nav-desktop"
                ariaLabel="Open Sandbox"
                className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {l.label}
              </SandboxCTA>
            ) : l.route ? (
              <Link
                key={l.href}
                to={l.href}
                className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.href}
                href={l.href}
                className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {l.label}
              </a>
            ),
          )}
        </nav>
        {authUser ? (
          <div className="ml-auto lg:ml-0 shrink-0">
            <SocialAccountMenu />
          </div>
        ) : (
          <Link
            to="/auth"
            className="ml-auto lg:ml-0 shrink-0 whitespace-nowrap text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Sign in
          </Link>
        )}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className="lg:hidden shrink-0 p-2 rounded-md hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open navigation menu"
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              <Menu className="w-5 h-5" />
            </button>
          </SheetTrigger>
          <SheetContent id="mobile-nav" side="right" className="bg-background border-border w-[280px]">
            <SheetTitle className="font-display">Navigate</SheetTitle>
            <SheetDescription className="sr-only">Site navigation links</SheetDescription>
            <nav className="flex flex-col gap-1 mt-6" aria-label="Mobile">
              {NAV_LINKS.map((l) =>
                l.sandbox ? (
                  <SandboxCTA
                    key={l.href}
                    source="landing-nav-mobile"
                    ariaLabel="Open Sandbox"
                    onClickExtra={() => setOpen(false)}
                    className="py-3 px-3 rounded-lg text-base hover:bg-card/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {l.label}
                  </SandboxCTA>
                ) : l.route ? (
                  <Link
                    key={l.href}
                    to={l.href}
                    onClick={() => setOpen(false)}
                    className="py-3 px-3 rounded-lg text-base hover:bg-card/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="py-3 px-3 rounded-lg text-base hover:bg-card/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {l.label}
                  </a>
                ),
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-mono uppercase tracking-widest text-primary/70 mb-3">{children}</p>;
}

const LENGTH_OPTIONS = [
  { value: 5, label: "5 Years", time: "~5 min" },
  { value: 10, label: "10 Years", time: "~10 min" },
  { value: 15, label: "15 Years", time: "~15 min" },
  { value: 20, label: "20 Years", time: "~20 min" },
  { value: 35, label: "Full Era", time: "~35 min" },
];

function ResumeBanner({ kind, info }: { kind: "solo" | "multiplayer"; info: ResumeInfo }) {
  const label = kind === "solo" ? "Resume your solo game" : "Rejoin your multiplayer game";
  return (
    <div
      role="region"
      aria-label={label}
      className="relative z-20 mx-4 md:mx-8 mt-3 mb-1 rounded-2xl border border-primary/40 bg-primary/10 backdrop-blur-md px-4 py-3 flex flex-wrap items-center gap-3 shadow-lg shadow-primary/10"
    >
      <div className="flex-1 min-w-[12rem]">
        <p className="font-display font-semibold text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground font-mono">{info.label}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="h-9 border-border/60" onClick={info.onDiscard}>
          Discard
        </Button>
        <Button
          size="sm"
          className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={info.onResume}
        >
          {kind === "solo" ? "Resume game" : "Rejoin game"}
          <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function money(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

/** Prominent "Continue game" card shown whenever a save exists. */
function ContinueCard({ info }: { info: ContinueInfo }) {
  const s = info.meta;
  return (
    <div
      role="region"
      aria-label="Continue your saved game"
      className="relative z-20 mx-4 md:mx-8 mt-3 mb-1 rounded-2xl border border-primary/50 bg-gradient-to-r from-primary/15 to-primary/5 backdrop-blur-md px-4 py-4 shadow-lg shadow-primary/10"
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[14rem]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-primary/90 font-mono">Continue game</p>
          <p className="font-display font-bold text-lg text-foreground truncate">{s.name}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {s.kind === "stock" ? "Stock market" : "Real estate"} · {s.mode} · {s.startYear}–{s.endYear} · Year{" "}
            {s.currentYear}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {money(s.portfolioValue)} · {formatRemaining(s.remainingSeconds)} · {formatLastPlayed(s.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {info.totalSaves > 1 && (
            <Button size="sm" variant="outline" className="h-10 border-border/60" onClick={info.onViewAll}>
              View all saves ({info.totalSaves})
            </Button>
          )}
          {info.totalSaves <= 1 && (
            <Button size="sm" variant="ghost" className="h-10 text-muted-foreground" onClick={info.onViewAll}>
              Manage save
            </Button>
          )}
          <Button
            size="sm"
            className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            onClick={info.onResume}
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WelcomeScreen({
  onPlaySolo,
  onPlayGroup,
  continueSave,
  multiplayerResume,
  multiplayerNotice,
  onDismissMultiplayerNotice,
}: WelcomeScreenProps) {
  const [duration, setDuration] = useState<number>(10);
  const [showSetup, setShowSetup] = useState(false);
  const [showQuickPlay, setShowQuickPlay] = useState(false);
  const [adminCode, setAdminCode] = useState<string | null>(null);
  const navigate = useNavigate();

  // Prefetch the next-most-likely route chunks once the browser is idle. This
  // warms the JS cache for /real-estate-game and /guide without competing with
  // the initial homepage paint.
  useEffect(() => {
    let cancelled = false;
    const prefetch = () => {
      if (cancelled) return;
      void prefetchRealEstate();
      void prefetchGuide();
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    const handle = w.requestIdleCallback
      ? w.requestIdleCallback(prefetch, { timeout: 3000 })
      : window.setTimeout(prefetch, 2000);
    return () => {
      cancelled = true;
      const cw = window as Window & { cancelIdleCallback?: (h: number) => void };
      if (cw.cancelIdleCallback && w.requestIdleCallback) cw.cancelIdleCallback(handle as number);
      else clearTimeout(handle as number);
    };
  }, []);

  // Meaningful-choice prefetch: warm the chunks the user is about to need so
  // the modal/transition can overlap with the network round-trip.

  const openSetup = () => {
    void prefetchSoloGame();
    setShowSetup(true);
  };
  const handlePlayGroup = () => {
    void prefetchGroupLobby();
    onPlayGroup();
  };
  // Quick Play: a short two-step dialog (length, then mode) and straight into
  // the game — era and starting stocks are randomised for the player.
  const quickPlay = () => {
    void prefetchSoloGame();
    setShowQuickPlay(true);
  };
  const goRealEstate = () => {
    void prefetchRealEstate();
    navigate("/real-estate-game");
  };

  return (
    <div id="top" className="min-h-screen flex flex-col relative bg-background">
      <HomeApplicationSchema />
      <TopNav />

      {continueSave && <ContinueCard info={continueSave} />}
      {multiplayerResume && <ResumeBanner kind="multiplayer" info={multiplayerResume} />}
      {multiplayerNotice && (
        <div
          role="status"
          className="relative z-20 mx-4 md:mx-8 mt-3 mb-1 flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-3 backdrop-blur-md"
        >
          <p className="flex-1 min-w-[12rem] text-sm text-muted-foreground">{multiplayerNotice}</p>
          <Button size="sm" variant="outline" className="h-9 border-border/60" onClick={onDismissMultiplayerNotice}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="relative overflow-hidden">
        <HeroAnimation />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
          aria-hidden="true"
        />

        {/* Hero */}
        <section className="relative z-10 px-4 md:px-8" aria-labelledby="hero-title">
          <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 lg:gap-16 items-start py-8 sm:py-10 md:py-14">
            <div className="space-y-6 sm:space-y-7">
              {/* Title row: heading left, credibility chips right */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <h1
                  id="hero-title"
                  className="text-[3rem] sm:text-6xl lg:text-7xl font-brand font-semibold tracking-tight leading-[0.95]"
                >
                  Rise to <em className="text-primary font-brand italic">Riches</em>
                  <span className="block text-base sm:text-lg lg:text-xl font-display font-medium text-muted-foreground mt-4 tracking-normal">
                    Free Historical Stock Market Simulator
                  </span>
                </h1>
              </div>

              <p className="text-lg sm:text-xl md:text-2xl font-display text-foreground leading-snug max-w-2xl">
                Your money. How would you invest?{" "}
                <span className="text-primary">Are you better than the average player?</span>
              </p>
              <p className="text-sm sm:text-base font-display text-muted-foreground leading-snug max-w-2xl -mt-2">
                Buy and sell through historical periods, including the dot-com bubble and the 2008 crash, and see how
                you did compared to the S&amp;P 500 and other players.
              </p>
              <p className="text-sm font-display text-muted-foreground leading-snug max-w-2xl -mt-2">
                A free investment simulator with virtual money. Prices follow real historical annual returns, with the
                moves inside each year simulated. Play solo or run a classroom game. No account required.
              </p>

              {/* Primary path: one click to play. Length is pre-set to 10 years;
                  everything else (era, mode, starting stocks) is randomised so a
                  first-time visitor never hits a setup dialog before playing. */}
              <div className="flex flex-col sm:flex-row gap-4 pt-1">
                <InteractiveHoverButton
                  type="button"
                  text="Play Now"
                  onClick={quickPlay}
                  onMouseEnter={prefetchSoloGame}
                  onFocus={prefetchSoloGame}
                  className="w-full sm:w-44 h-12 rounded-lg border-primary/60 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />

                <Button
                  type="button"
                  onClick={handlePlayGroup}
                  onMouseEnter={prefetchGroupLobby}
                  onFocus={prefetchGroupLobby}
                  className="w-full sm:w-44 h-12 text-base"
                >
                  Play With Friends
                </Button>
              </div>

              {/* Secondary paths */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <HoverGlowButton
                  onClick={() => navigate("/leaderboard")}
                  className="h-12 px-5 text-[15px]"
                >
                  <Trophy className="w-4.5 h-4.5" aria-hidden="true" />
                  View leaderboard
                </HoverGlowButton>
                <Link
                  to="/client-contracts"
                  className="inline-flex items-center gap-2 h-12 px-5 rounded-lg border border-primary/50 bg-primary/10 text-[15px] font-display font-semibold text-foreground transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Briefcase className="w-4.5 h-4.5 text-primary" aria-hidden="true" />
                  Client Contracts
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-primary-foreground">
                    New
                  </span>
                </Link>
              </div>
            </div>

            {/* Right: a labelled sample of the real game screen */}
            <div className="block" aria-hidden="true">
              <p className="mb-2 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground/80">
                A look at the game
              </p>
              <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-5 space-y-4 shadow-[var(--shadow-panel)] ">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="font-display font-semibold text-sm">Your portfolio</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">Year 12 of 20</span>
                </div>
                <div>
                  <div className="font-mono text-3xl font-bold">$347,892</div>
                  <div className="font-mono text-sm text-gain">+189.6% return</div>
                </div>
                <svg viewBox="0 0 200 50" className="w-full h-12">
                  <path
                    d="M0,45 Q20,42 30,38 T60,30 T90,25 T110,28 T130,15 T160,12 T180,8 T200,5"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M0,45 Q20,42 30,38 T60,30 T90,25 T110,28 T130,15 T160,12 T180,8 T200,5 V50 H0 Z"
                    fill="url(#heroGradient)"
                  />
                  <defs>
                    <linearGradient id="heroGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { t: "AAPL", v: "$84,201", c: "+312%" },
                    { t: "SPFUND", v: "$120,450", c: "+148%" },
                    { t: "NVDA", v: "$63,102", c: "+892%" },
                  ].map((h) => (
                    <div key={h.t} className="rounded-md bg-secondary/30 p-2">
                      <div className="font-mono text-muted-foreground">{h.t}</div>
                      <div className="font-mono font-medium text-foreground">{h.v}</div>
                      <div className="font-mono text-gain text-[10px]">{h.c}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-[11px] text-primary/90 font-mono">
                  Headline: the dot-com bubble burst — tech stocks fell sharply.
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
                  <span className="text-[11px] font-mono text-muted-foreground">Your move: NVDA at $41.20</span>
                  <span className="flex gap-1.5">
                    <span className="rounded bg-primary px-2.5 py-1 text-[11px] font-display font-semibold text-primary-foreground">
                      Buy
                    </span>
                    <span className="rounded border border-border/60 px-2.5 py-1 text-[11px] font-display text-muted-foreground">
                      Hold
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-center pb-2 -mt-2 sm:-mt-4" aria-hidden="true">
        <ChevronDown className="w-5 h-5 text-muted-foreground/30 animate-bounce" />
      </div>

      {/* Dotted backdrop covers everything from the walkthrough down */}
      <div className="relative isolate">
        <DotPattern className="-z-10 fill-foreground/20 md:fill-foreground/20" />

        {/* How it works — expandable guide */}
        <section id="how-it-works" className="border-t border-border/30" aria-labelledby="how-title">
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-12 sm:py-16 md:py-20">
            <div className="text-center mb-8">
              <SectionEyebrow>How it works</SectionEyebrow>
              <h2
                id="how-title"
                className="text-3xl md:text-4xl font-editorial font-semibold font-normal mb-3 tracking-tight"
              >
                A quick walkthrough
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
                Five short sections covering everything from picking a mode to competing live with friends.
              </p>
            </div>

            <Accordion
              type="single"
              collapsible
              defaultValue="mode"
              className="rounded-2xl border border-border/40 bg-card/30 divide-y divide-border/40"
            >
              <AccordionItem value="mode" className="border-0 px-4 sm:px-5">
                <AccordionTrigger className="font-display text-base sm:text-lg">1. Choose your mode</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
                  <div>
                    <span className="font-semibold text-foreground">Basic Mode.</span> A limited, curated set of
                    recognizable stocks and funds. Best for first-time players.
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Advanced Mode.</span> Built for experienced players.
                    A universe of {COMPANY_COUNT} real companies plus Bitcoin (availability varies by simulated year),
                    with fast price updates, search, and a 4-stock watchlist. Pick by ticker (AAPL, NVDA…) and unlock
                    more as their real IPO dates roll in.
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="length" className="border-0 px-4 sm:px-5">
                <AccordionTrigger className="font-display text-base sm:text-lg">
                  2. Pick your simulation length
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
                  <div>
                    <span className="font-semibold text-foreground">10 years.</span> Default — fast and focused.
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">15 years.</span> Extra runway for compounding and
                    strategy.
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">20 years.</span> A longer historical cycle through
                    booms and busts.
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Full Era.</span> Maximum challenge — the longest
                    playable window in our dataset.
                  </div>
                  <p className="text-xs text-muted-foreground/80 italic pt-1">≈ 1 minute per in-game year.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="portfolio" className="border-0 px-4 sm:px-5">
                <AccordionTrigger className="font-display text-base sm:text-lg">
                  3. Build your portfolio
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
                  <p>
                    Buy stocks, the S&P 500 index, gold, oil, or lock cash into CDs and HYSAs. Allocate however you
                    want.
                  </p>
                  <p>
                    Performance follows <span className="text-foreground">real historical returns</span> — so prices
                    move the way they actually did. Assets only become tradable when they actually existed in that era
                    (no buying Bitcoin in 1995).
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="react" className="border-0 px-4 sm:px-5">
                <AccordionTrigger className="font-display text-base sm:text-lg">
                  4. React to market history
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
                  <p>
                    Live news headlines mark real market shifts — recessions, rate cuts, bubbles, recoveries. Adjust
                    your allocations as the era unfolds.
                  </p>
                  <p>
                    You also get quarterly cash drops and the occasional life event that drains a chunk of cash — just
                    like the real world.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="compete" className="border-0 px-4 sm:px-5">
                <AccordionTrigger className="font-display text-base sm:text-lg">
                  5. Compete or play solo
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
                  <p>
                    <span className="font-semibold text-foreground">Solo.</span> Play at your own pace. Pause, resume,
                    and replay any era.
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Multiplayer.</span> Share a game code with up to 30
                    friends. Everyone plays the same market period on the same clock and you compare results at the end.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-8">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={openSetup}
                onMouseEnter={prefetchSoloGame}
                onFocus={prefetchSoloGame}
              >
                Start Playing
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </section>

        {/* Product preview — Advanced Mode showcase */}
        <section id="preview" className="border-t border-border/30 bg-card/10" aria-labelledby="preview-title">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 sm:py-16 md:py-20">
            <div className="text-center mb-8 sm:mb-10">
              <SectionEyebrow>Inside the simulator</SectionEyebrow>
              <h2 id="preview-title" className="text-3xl md:text-4xl font-editorial font-normal mb-3 tracking-tight">
                Step up to <em className="not-italic text-primary font-editorial font-semibold">Advanced Mode</em>
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                A faster, deeper version of the simulator using real 1990–2025 annual returns from {COMPANY_COUNT}{" "}
                companies. Build a focused watchlist, and track every trade against your cost basis.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-10 items-stretch">
              {/* Left: device-frame mockup */}
              <div
                className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 sm:p-5 shadow-[var(--shadow-panel)]"
                aria-hidden="true"
              >
                <div className="flex items-center gap-1.5 pb-3 border-b border-border/30">
                  <span className="w-2.5 h-2.5 rounded-full bg-loss/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-gain/60" />
                  <span className="ml-3 text-[10px] font-mono text-muted-foreground">stockimulator · complex</span>
                </div>
                <div className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 border border-border/40">
                    <Search className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground">Search ticker or company…</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">3/4</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { t: "NVDA", n: "NVIDIA", v: "+148.4%", up: true },
                      { t: "AAPL", n: "Apple", v: "+30.1%", up: true },
                      { t: "AMD", n: "AMD", v: "-18.1%", up: false },
                      { t: "MSFT", n: "Microsoft", v: "+12.7%", up: true },
                    ].map((h) => (
                      <div key={h.t} className="rounded-lg border border-border/40 bg-card/40 p-2.5">
                        <div className="font-mono text-xs font-semibold">{h.t}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{h.n}</div>
                        <div className={`font-mono text-[11px] ${h.up ? "text-gain" : "text-loss"}`}>{h.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-[11px] text-primary/90 font-mono flex items-center gap-2">
                    <Zap className="w-3 h-3" /> Prices tick every 2 seconds
                  </div>
                </div>
              </div>

              {/* Right: feature highlights */}
              <div className="space-y-3">
                {[
                  {
                    icon: Zap,
                    title: "Fast price updates",
                    desc: "Watch the market move faster and feel every decision. Annual returns stay true to history, but the action is constant.",
                    chip: "TICK · 2s",
                  },
                  {
                    icon: Eye,
                    title: "Curated watchlist",
                    desc: `Pick up to 4 stocks at a time from ${COMPANY_COUNT} real companies (availability varies by year). Add and remove freely as your strategy evolves.`,
                    chip: "WATCHLIST · 4",
                  },
                  {
                    icon: Receipt,
                    title: "Cost-basis tracking",
                    desc: "Every buy and sell updates your cost basis automatically. See unrealized gains and losses per position in real time.",
                    chip: "BASIS · LIVE",
                  },
                  {
                    icon: Search,
                    title: "Search the full universe",
                    desc: "Type a ticker or company name (AAPL, Microsoft, NVIDIA…) and register it instantly with full historical returns.",
                    chip: `${COMPANY_COUNT} STOCKS`,
                  },
                ].map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: i * 0.06 }}
                    className="rounded-2xl border border-border/40 bg-card/40 p-4 sm:p-5 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="inline-flex w-11 h-11 rounded-xl bg-primary/10 items-center justify-center shrink-0">
                        <c.icon className="w-5 h-5 text-primary" aria-hidden="true" />
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <h3 className="font-display font-semibold">{c.title}</h3>
                          <span className="text-[10px] font-mono text-primary/70 bg-primary/10 rounded-md px-1.5 py-0.5">
                            {c.chip}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Multiplayer CTA */}
        <section
          id="multiplayer"
          className="border-t border-border/30 bg-gradient-to-br from-primary/[0.04] via-transparent to-accent/[0.03]"
          aria-labelledby="mp-title"
        >
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 sm:py-16">
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 sm:p-8 md:p-10 flex flex-col items-center text-center gap-6 shadow-xl shadow-black/20">
              <div className="flex-1 space-y-2 flex flex-col items-center">
                <SectionEyebrow>Multiplayer</SectionEyebrow>
                <h2
                  id="mp-title"
                  className="text-2xl sm:text-3xl md:text-4xl font-editorial font-semibold font-normal tracking-tight"
                >
                  Compete with friends, clubs, or classes
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
                  Create a game code, share it, and play the same market period together. Compare results when the game
                  ends.
                </p>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-xs font-mono text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                    Live leaderboard
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/70" />
                    Same market for all
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                    Up to 30 players
                  </span>
                </div>
              </div>
              <Button
                size="lg"
                className="h-12 px-6 w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handlePlayGroup}
                onMouseEnter={prefetchGroupLobby}
                onFocus={prefetchGroupLobby}
              >
                <Users className="w-4 h-4 mr-2" aria-hidden="true" />
                Play With Friends
              </Button>
            </div>

            {/* Jump to Real Estate teaser */}
            <div className="mt-6 flex justify-center">
              <a
                href="#real-estate"
                className="group inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 hover:bg-accent/15 hover:border-accent/60 px-5 py-2.5 text-sm font-medium text-accent transition-all shadow-md shadow-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                <span>Try Real Estate Mode</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        {/* === More Simulators — Real Estate + Sandbox as two focused cards === */}
        <section
          id="real-estate"
          aria-labelledby="more-sims-title"
          className="relative border-y border-border/30 bg-card/20"
        >
          <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-14 sm:py-20">
            <div className="text-center mb-10">
              <SectionEyebrow>More Simulators</SectionEyebrow>
              <h2
                id="more-sims-title"
                className="text-2xl sm:text-3xl md:text-4xl font-editorial font-semibold font-normal tracking-tight"
              >
                Three more ways to play
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                The stock simulator is the main event. When you want a different market, these are free too.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Client Contracts */}
              <article className="group relative flex flex-col rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-background p-6 sm:p-7 transition-colors hover:border-primary/70">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/15 text-primary">
                    <Briefcase className="w-4.5 h-4.5" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary font-semibold">
                    Client Contracts
                  </span>
                  <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-primary-foreground">
                    New
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Run a hedge fund</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                  Manage your clients' money through real market history. Hire staff, win investors, buy businesses
                  and take your firm public.
                </p>
                <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {["Real stock returns", "Build a firm", "IPO and legacy"].map((t) => (
                    <li key={t} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/client-contracts"
                  className="mt-6 inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-primary text-primary-foreground font-display font-semibold transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Play Client Contracts
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </article>

              {/* Real Estate */}
              <article className="group relative flex flex-col rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-background p-6 sm:p-7 transition-colors hover:border-accent/60">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-accent/15 text-accent">
                    <Building2 className="w-4.5 h-4.5" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent font-semibold">
                    Real Estate
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Build a property empire</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                  Buy and sell virtual properties across 10 U.S. city markets using stored 1990–2020 price tables. Time
                  your trades and track how property values change.
                </p>
                <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {["10 cities", "1990–2020 price tables", "Up to 35 min"].map((t) => (
                    <li key={t} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/real-estate-game"
                  onMouseEnter={prefetchRealEstate}
                  onFocus={prefetchRealEstate}
                  className="mt-6 inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-accent text-accent-foreground font-display font-semibold transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Play the real estate game
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </article>

              {/* Sandbox */}
              <article className="group relative flex flex-col rounded-2xl border border-[hsl(var(--sandbox-primary))]/30 bg-gradient-to-br from-[hsl(var(--sandbox-primary))]/10 to-background p-6 sm:p-7 transition-colors hover:border-[hsl(var(--sandbox-primary))]/60">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[hsl(var(--sandbox-primary))]/15 text-[hsl(var(--sandbox-primary))]">
                    <Sparkles className="w-4.5 h-4.5" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[hsl(var(--sandbox-primary))] font-semibold">
                    Sandbox
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Rewrite market history</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                  Combine stocks and real estate, then inject your own crashes, booms and shocks into any year — and
                  compare the result against what actually happened.
                </p>
                <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {["Custom events", "Stocks + property", "Baseline comparison"].map((t) => (
                    <li key={t} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--sandbox-primary))]" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
                <SandboxCTA
                  source="landing-teaser-primary"
                  ariaLabel="Open Sandbox setup"
                  className="mt-6 inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-[hsl(var(--sandbox-primary))] text-[hsl(var(--sandbox-primary-foreground))] font-display font-semibold transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Open the sandbox
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </SandboxCTA>
              </article>
            </div>
          </div>
        </section>

        <HomeResources />

        {/* Footer */}
        <RequestBox />

        <footer className="border-t border-border/30">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 sm:py-12 grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-brand italic text-xl leading-none">
                  Rise to <span className="text-primary">Riches</span>
                </span>
              </div>
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground/80 mb-3">
                Free Stock Market Simulator
              </p>
              <p className="text-muted-foreground max-w-xs leading-relaxed">
                A free investing simulator using virtual money and real historical market data.
              </p>
            </div>
            <nav className="space-y-2" aria-label="Play">
              <p className="font-display font-semibold text-foreground/90 text-xs uppercase tracking-wider mb-3">
                Play
              </p>
              <button
                onClick={openSetup}
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Play Solo
              </button>
              <button
                onClick={handlePlayGroup}
                onMouseEnter={prefetchGroupLobby}
                onFocus={prefetchGroupLobby}
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Play With Friends
              </button>
              <Link
                to="/client-contracts"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Client Contracts
              </Link>
              <Link
                to="/real-estate-game"
                onMouseEnter={prefetchRealEstate}
                onFocus={prefetchRealEstate}
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Real Estate Game
              </Link>
              <Link
                to="/sandbox"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Sandbox
              </Link>
              <Link
                to="/leaderboard"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Leaderboard
              </Link>
            </nav>
            <nav className="space-y-2" aria-label="Learn">
              <p className="font-display font-semibold text-foreground/90 text-xs uppercase tracking-wider mb-3">
                Learn
              </p>
              <Link
                to="/learn"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Learn — All Resources
              </Link>
              <Link
                to="/guide"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                How to Invest — Beginner's Guide
              </Link>
              <Link
                to="/learn/how-diversification-works"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                How Diversification Works
              </Link>
              <Link
                to="/learn/investment-simulator"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                What Is an Investment Simulator?
              </Link>
              <Link
                to="/for-teachers"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Stock Market Game for Classrooms
              </Link>
              <Link
                to="/standards"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                National Standards Alignment
              </Link>
              <Link
                to="/learn/stock-market-game-high-school"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Stock Market Game for High School
              </Link>
              <Link
                to="/methodology"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Methodology &amp; Data Sources
              </Link>
              <Link
                to="/about"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                About Rise to Riches
              </Link>
              <a
                href="#how-it-works"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                How It Works
              </a>
              <a
                href="#multiplayer"
                className="block text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Multiplayer
              </a>
            </nav>
          </div>
          <div className="border-t border-border/20 py-5">
            <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground/70">© Rise to Riches · Free stock market simulator</span>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground font-medium">
                  Educational simulation only. Not financial advice. No real-money trading.
                </span>
              </div>
            </div>
          </div>
          {/* Admin trigger — typing the secret code unlocks the analytics dashboard.
            The code is verified server-side. */}
          <div className="max-w-6xl mx-auto px-4 md:px-8 pb-6 pt-1 flex justify-center items-center gap-2">
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="admin"
              aria-label="Admin code"
              className="w-28 h-7 text-center text-[11px] font-mono bg-card/40 border border-border/40 rounded text-muted-foreground focus:border-primary/60 focus:text-foreground focus:outline-none placeholder:text-muted-foreground/70"
              onChange={(e) => {
                const v = e.target.value;
                if (v.length >= 4) {
                  setAdminCode(v);
                  e.currentTarget.value = "";
                }
              }}
            />
            <button
              type="button"
              onClick={() => navigate("/admin/dashboard")}
              className="h-7 px-3 text-[11px] font-medium rounded border border-border/40 bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Dashboard
            </button>
          </div>
        </footer>
      </div>

      {/* Solo Setup Dialog */}
      {showSetup && (
        <Suspense fallback={null}>
          <SoloSetupDialog
            open={showSetup}
            initialDuration={duration}
            onClose={() => setShowSetup(false)}
            onStart={(config) => {
              setShowSetup(false);
              onPlaySolo(config);
            }}
          />
        </Suspense>
      )}

      {/* Quick Play: length → mode → straight into the game */}
      <QuickPlayDialog
        open={showQuickPlay}
        onCustomize={openSetup}
        onClose={() => setShowQuickPlay(false)}
        onStart={(config) => {
          setShowQuickPlay(false);
          onPlaySolo(config);
        }}
      />

      {/* Admin analytics — only renders once an admin code is supplied. */}
      {adminCode && (
        <Suspense fallback={null}>
          <AdminAnalyticsPanel open={!!adminCode} code={adminCode} onClose={() => setAdminCode(null)} />
        </Suspense>
      )}
    </div>
  );
}
