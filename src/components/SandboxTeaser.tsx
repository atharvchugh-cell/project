// (Link no longer used directly — all Sandbox CTAs route through <SandboxCTA />.)
import { motion } from 'framer-motion';
import { Sparkles, Zap, ArrowRight, Wand2, LineChart, Building2 } from 'lucide-react';
import { SandboxCTA } from '@/components/SandboxCTA';

interface SandboxTeaserProps {
  /** Where this teaser is rendered — controls analytics source tags. */
  context?: 'landing' | 'sandbox-page';
}

/**
 * Landing-page section that introduces Sandbox as the third product mode.
 * Distinct dark-purple identity — never uses the emerald / amber tokens
 * owned by the Stock Game and Real Estate identities.
 */
export default function SandboxTeaser({ context = 'landing' }: SandboxTeaserProps = {}) {
  // On the Sandbox page this is the page's main heading.
  const Heading = context === 'sandbox-page' ? 'h1' : 'h2';
  const primarySrc = context === 'landing' ? 'landing-teaser-primary' : 'sandbox-page-teaser-primary';
  const secondarySrc = context === 'landing' ? 'landing-teaser-secondary' : 'sandbox-page-teaser-secondary';
  return (
    <section
      id="sandbox"
      aria-label="Sandbox mode"
      className="relative overflow-hidden sandbox-scope border-y sandbox-border"
    >
      {/* Purple grid + glow backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--sandbox-primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--sandbox-primary)) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-30"
        style={{ background: 'radial-gradient(circle, hsl(var(--sandbox-primary)) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-25"
        style={{ background: 'radial-gradient(circle, hsl(var(--sandbox-accent)) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
        {/* Left — copy */}
        <div>
          <p className="text-xs font-mono uppercase tracking-widest sandbox-accent mb-4 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> New · Sandbox
          </p>
          <Heading className="font-display text-4xl md:text-5xl lg:text-6xl font-bold sandbox-text leading-[1.05] tracking-tight">
            Control the <span className="sandbox-accent">Market</span>
          </Heading>
          <p className="mt-5 text-lg sandbox-muted leading-relaxed max-w-lg">
            Build your own economic timeline. Move stocks, sectors, cities, and historical
            events to see how your portfolio would survive.
          </p>
          <p className="mt-4 text-sm sandbox-muted/90 leading-relaxed max-w-lg">
            Sandbox combines the Stock Game and Real Estate Game into one open-ended
            simulator. Start from real history, change the rules, and test any market
            scenario you can imagine.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <SandboxCTA
              source={primarySrc}
              ariaLabel="Enter Sandbox setup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-sandbox-primary text-[hsl(var(--sandbox-primary-foreground))] font-display font-semibold glow-sandbox hover:opacity-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Enter Sandbox <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </SandboxCTA>
            <SandboxCTA
              source={secondarySrc}
              ariaLabel="Build your Sandbox scenario"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border sandbox-border sandbox-text hover:bg-white/5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Build Your Scenario
            </SandboxCTA>
          </div>

          <ul className="mt-8 space-y-2 text-sm sandbox-muted">
            <li className="flex items-center gap-2"><Wand2 className="w-4 h-4 sandbox-primary" aria-hidden="true" /> Inject 9/11-style shocks, oil crises, or your own custom event</li>
            <li className="flex items-center gap-2"><LineChart className="w-4 h-4 sandbox-primary" aria-hidden="true" /> Crash Tech while Energy rallies — sector-level control</li>
            <li className="flex items-center gap-2"><Building2 className="w-4 h-4 sandbox-primary" aria-hidden="true" /> Housing crash in Miami, boom in San Francisco</li>
          </ul>
        </div>

        {/* Right — mock dashboard */}
        <MockDashboard />
      </div>
    </section>
  );
}

function MockDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative rounded-2xl sandbox-surface border p-5 md:p-6 glow-sandbox-soft"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-mono uppercase tracking-widest sandbox-muted">Sandbox · Preview</span>
        <span className="text-[10px] font-mono uppercase tracking-widest sandbox-accent flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-sandbox-primary animate-sandbox-pulse" aria-hidden="true" /> live
        </span>
      </div>

      {/* Net worth */}
      <div className="rounded-xl sandbox-surface-2 border p-4 mb-4">
        <p className="text-[11px] font-mono uppercase tracking-wider sandbox-muted">Total Net Worth</p>
        <p className="font-display text-3xl font-bold sandbox-text mt-1 tabular-nums">$1,284,650</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="sandbox-muted">Stocks</p>
            <p className="sandbox-text font-semibold tabular-nums">$842,110</p>
          </div>
          <div>
            <p className="sandbox-muted">Real Estate</p>
            <p className="sandbox-text font-semibold tabular-nums">$442,540</p>
          </div>
        </div>
      </div>

      {/* Chart mock */}
      <svg viewBox="0 0 300 90" className="w-full h-24 mb-4" aria-hidden="true">
        <defs>
          <linearGradient id="sb-stocks" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--sandbox-primary))" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(var(--sandbox-primary))" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sb-re" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--sandbox-accent))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--sandbox-accent))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,70 C40,55 60,60 90,45 C120,30 150,55 180,25 C210,10 240,35 300,15 L300,90 L0,90 Z"
          fill="url(#sb-stocks)"
        />
        <path
          d="M0,70 C40,55 60,60 90,45 C120,30 150,55 180,25 C210,10 240,35 300,15"
          stroke="hsl(var(--sandbox-primary))"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M0,80 C40,75 60,70 90,68 C120,66 150,60 180,55 C210,50 240,48 300,40"
          stroke="hsl(var(--sandbox-accent))"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="3 3"
        />
        {/* Event marker */}
        <line x1="120" y1="5" x2="120" y2="90" stroke="hsl(var(--sandbox-accent))" strokeWidth="1" strokeOpacity="0.5" />
        <circle cx="120" cy="30" r="4" fill="hsl(var(--sandbox-accent))" />
      </svg>

      {/* Timeline */}
      <div className="relative h-8 mb-4 rounded-md border sandbox-border bg-white/[0.02]">
        <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-px bg-white/10" />
        {[
          { pct: 15, label: '1990' },
          { pct: 40, label: '2001' },
          { pct: 55, label: '2008', hot: true },
          { pct: 78, label: '2020' },
          { pct: 95, label: '2025' },
        ].map((t) => (
          <div
            key={t.label}
            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${t.pct}%`, transform: `translate(-50%, -50%)` }}
          >
            <div className={`w-2 h-2 rounded-full ${t.hot ? 'bg-sandbox-primary animate-sandbox-pulse' : 'bg-white/40'}`} />
            <span className="text-[9px] font-mono sandbox-muted mt-1">{t.label}</span>
          </div>
        ))}
      </div>

      {/* Event notification */}
      <div className="rounded-lg border sandbox-border bg-sandbox-primary/10 px-3 py-2 flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 sandbox-accent shrink-0" aria-hidden="true" />
        <p className="text-xs sandbox-text">
          <span className="font-mono uppercase tracking-wider sandbox-accent text-[10px] mr-1.5">Custom event</span>
          9/11-style shock applied in <span className="tabular-nums">2008</span>
        </p>
      </div>

      {/* Impact cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Tech', v: '-8.2%', neg: true },
          { label: 'Energy', v: '+6.1%', neg: false },
          { label: 'Miami', v: '-11%', neg: true },
          { label: 'S&P 500', v: '-4.2%', neg: true },
        ].map((c) => (
          <div key={c.label} className="rounded-md sandbox-surface-2 border p-2 text-center">
            <p className="text-[9px] font-mono uppercase sandbox-muted">{c.label}</p>
            <p className={`text-xs font-semibold tabular-nums mt-0.5 ${c.neg ? 'text-red-400' : 'text-emerald-400'}`}>{c.v}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
