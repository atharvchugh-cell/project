import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Sparkles, Zap, Wand2, Building2, LineChart, Clock, Layers } from 'lucide-react';
import SandboxTeaser from '@/components/SandboxTeaser';
import { SandboxCTA } from '@/components/SandboxCTA';
import { SANDBOX_EXAMPLES, exampleSetupUrl } from '@/lib/sandbox/examples';
import { trackSandboxCta } from '@/lib/sandboxNav';

const EXAMPLES = SANDBOX_EXAMPLES;

const STEPS = [
  {
    n: '01',
    icon: Clock,
    title: 'Pick your era',
    body: 'Start from any real historical year between 1990 and today. Choose a preset era or a clean slate.',
  },
  {
    n: '02',
    icon: Wand2,
    title: 'Change the rules',
    body: 'Move sliders. Crash sectors. Boost cities. Drop historical events into new years. Or write your own headline.',
  },
  {
    n: '03',
    icon: LineChart,
    title: 'Watch it play out',
    body: 'Your stock and real-estate portfolios respond in real time. Compare against a "no intervention" baseline.',
  },
];

export default function Sandbox() {
  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'VideoGame',
          name: 'Sandbox — Rise to Riches',
          url: 'https://investmentsimulator.app/sandbox',
          description:
            'An open-ended economic simulator combining stocks and real estate, with sector controls, historical event injection, and custom market shocks.',
          applicationCategory: 'GameApplication',
          genre: ['Simulation', 'Educational', 'Finance'],
          operatingSystem: 'Web Browser',
          gamePlatform: 'Web Browser',
          isAccessibleForFree: true,
          inLanguage: 'en',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          publisher: { '@type': 'Organization', name: 'Rise to Riches' },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://investmentsimulator.app/' },
              { '@type': 'ListItem', position: 2, name: 'Sandbox', item: 'https://investmentsimulator.app/sandbox' },
            ],
          },
        })}</script>
      </Helmet>

      <div className="min-h-screen sandbox-scope">
        {/* Slim nav */}
        <header className="sticky top-0 z-40 border-b sandbox-border bg-[hsl(var(--sandbox-bg))]/85 backdrop-blur-lg">
          <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 sandbox-text font-display font-bold">
              <span className="w-2 h-2 rounded-full bg-sandbox-primary" aria-hidden="true" />
              Rise to Riches
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm sandbox-muted" aria-label="Primary">
              <Link to="/" className="hover:sandbox-text transition-colors">Stock Game</Link>
              <Link to="/real-estate-game" className="hover:sandbox-text transition-colors">Real Estate</Link>
              <SandboxCTA source="sandbox-page-nav" className="sandbox-accent font-semibold hover:opacity-90 transition-opacity">Sandbox</SandboxCTA>
              <Link to="/guide" className="hover:sandbox-text transition-colors">Guide</Link>
            </nav>
          </div>
        </header>

        {/* Hero — reuse the landing teaser (already themed) */}
        <SandboxTeaser context="sandbox-page" />

        {/* How it works */}
        <section className="relative max-w-6xl mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-mono uppercase tracking-widest sandbox-accent mb-3">How it works</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold sandbox-text">Three steps to your own economy</h2>
            <p className="mt-3 sandbox-muted">Move the timeline. Change the market. See what breaks.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.n} className="rounded-2xl sandbox-surface border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono uppercase tracking-widest sandbox-muted">Step {s.n}</span>
                    <Icon className="w-5 h-5 sandbox-primary" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-xl font-semibold sandbox-text">{s.title}</h3>
                  <p className="mt-2 text-sm sandbox-muted leading-relaxed">{s.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Example scenarios */}
        <section id="scenarios" className="relative border-t sandbox-border">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-20 md:py-24">
            <div className="flex items-end justify-between mb-10 flex-wrap gap-3">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest sandbox-accent mb-3">Example Scenarios</p>
                <h2 className="font-display text-3xl md:text-4xl font-bold sandbox-text">Six ways to break the market</h2>
              </div>
              <p className="sandbox-muted max-w-md text-sm">
                What happens if you put a 2008-style credit crunch into the middle of a tech boom?
                There is no right answer here — only better experiments.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {EXAMPLES.map((e) => (
                <Link
                  key={e.title}
                  to={exampleSetupUrl(e)}
                  onClick={() => trackSandboxCta("sandbox-page-example-card", { label: e.title })}
                  aria-label={`Try scenario: ${e.title}`}
                  data-testid="sandbox-cta-sandbox-page-example-card"
                  className="group block rounded-xl sandbox-surface border p-5 hover:glow-sandbox-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <div className="flex items-start gap-3">
                    <Layers className="w-4 h-4 sandbox-primary mt-1 shrink-0" aria-hidden="true" />
                    <div>
                      <h3 className="font-display text-lg font-semibold sandbox-text">{e.title}</h3>
                      <p className="mt-1.5 text-sm sandbox-muted leading-relaxed">{e.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Custom event teaser */}
        <section className="relative border-t sandbox-border">
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
            <p className="text-xs font-mono uppercase tracking-widest sandbox-accent mb-3 flex items-center justify-center gap-2">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Enter Your Own Event
            </p>
            <h2 className="font-display text-3xl md:text-5xl font-bold sandbox-text leading-tight">
              Write the headline. <span className="sandbox-accent">We&rsquo;ll simulate the fallout.</span>
            </h2>
            <p className="mt-5 sandbox-muted max-w-2xl mx-auto">
              Type any hypothetical event — from a hurricane in Miami to iPhones coming to life — and
              Sandbox generates a plausible one-year impact across sectors, cities, rates, and confidence.
              Every estimate is editable, lockable, and re-rollable.
            </p>

            <div className="mt-8 mx-auto max-w-xl rounded-2xl sandbox-surface border p-4 text-left glow-sandbox-soft">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 sandbox-accent" aria-hidden="true" />
                <span className="text-[10px] font-mono uppercase tracking-widest sandbox-accent">Custom event · preview</span>
              </div>
              <p className="text-sm sandbox-text font-mono">
                &ldquo;Godzilla attacks Brazil and shuts down major ports for six months.&rdquo;
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Impact label="Global market" v="-4.2%" neg />
                <Impact label="Energy" v="+6.1%" />
                <Impact label="Emerging markets" v="-9.8%" neg />
                <Impact label="Miami housing" v="+2.3%" />
              </div>
              <p className="mt-3 text-[10px] sandbox-muted italic">
                Fictional scenario estimate — generated for gameplay and educational experimentation. Not a real forecast.
              </p>
            </div>

            <div className="mt-10 flex flex-wrap gap-3 justify-center">
              <SandboxCTA
                source="sandbox-page-custom-event"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-sandbox-primary text-[hsl(var(--sandbox-primary-foreground))] font-display font-semibold glow-sandbox hover:opacity-95 transition"
              >
                Enter Sandbox <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </SandboxCTA>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border sandbox-border sandbox-text hover:bg-white/5 transition"
              >
                Back to Stock Game
              </Link>
            </div>
          </div>
        </section>

        {/* Combined portfolio callout */}
        <section className="relative border-t sandbox-border">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-20 md:py-24 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest sandbox-accent mb-3">One portfolio, two markets</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold sandbox-text">Stocks and real estate, in one timeline</h2>
              <p className="mt-4 sandbox-muted leading-relaxed">
                Watch your stock holdings and property values respond to the same shocks at the same time.
                See migration patterns move city prices. See rate hikes hit both bonds and mortgages. See
                a tech crash pull rent growth with it.
              </p>
              <ul className="mt-6 space-y-3 text-sm sandbox-text">
                <li className="flex items-start gap-3">
                  <LineChart className="w-4 h-4 sandbox-primary mt-0.5" aria-hidden="true" />
                  Combined net-worth chart with event markers
                </li>
                <li className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 sandbox-primary mt-0.5" aria-hidden="true" />
                  Per-city housing controls with migration, supply, and rent
                </li>
                <li className="flex items-start gap-3">
                  <Wand2 className="w-4 h-4 sandbox-primary mt-0.5" aria-hidden="true" />
                  Draggable timeline — stack multiple events in any year
                </li>
              </ul>
            </div>
            <div className="rounded-2xl sandbox-surface border p-6">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Sectors', v: '8' },
                  { label: 'Cities', v: '20+' },
                  { label: 'Events', v: '20+' },
                  { label: 'Years', v: '1990–now' },
                  { label: 'Presets', v: '6' },
                  { label: 'Custom', v: '∞' },
                ].map((s) => (
                  <div key={s.label} className="sandbox-surface-2 border rounded-lg p-3">
                    <p className="font-display text-2xl font-bold sandbox-text tabular-nums">{s.v}</p>
                    <p className="text-[10px] font-mono uppercase tracking-widest sandbox-muted mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs sandbox-muted mt-6 text-center italic">
                Setup, live dashboard, and results — coming as Sandbox rolls out. Landing preview available now.
              </p>
            </div>
          </div>
        </section>

        <footer className="border-t sandbox-border">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 flex flex-wrap items-center justify-between gap-3 text-xs sandbox-muted">
            <span>© Rise to Riches · Sandbox</span>
            <span>Educational simulation only. Not financial advice. No real-money trading.</span>
          </div>
        </footer>
      </div>
    </>
  );
}

function Impact({ label, v, neg }: { label: string; v: string; neg?: boolean }) {
  return (
    <div className="flex items-center justify-between sandbox-surface-2 border rounded-md px-2.5 py-1.5">
      <span className="text-[10px] font-mono uppercase tracking-wider sandbox-muted">{label}</span>
      <span className={`font-semibold tabular-nums ${neg ? 'text-red-400' : 'text-emerald-400'}`}>{v}</span>
    </div>
  );
}
