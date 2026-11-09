import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, RotateCcw, Edit3, Copy, Share2, TrendingUp, TrendingDown, Award, AlertTriangle, Sparkles, Eye, EyeOff, Activity, AreaChart as AreaIcon } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot,
  AreaChart, Area, ReferenceLine, ComposedChart,
} from "recharts";
import { encodeScenario, loadScenario, saveScenario, storeSavedScenario, makeScenarioCopy, DEFAULT_SCENARIO } from "@/lib/sandbox/state";
import { simulate } from "@/lib/sandbox/simulate";
import { appOrigin } from '@/lib/basePath';

export default function SandboxResults() {
  const nav = useNavigate();
  const scenario = useMemo(() => loadScenario(), []);
  const result = useMemo(() => simulate(scenario), [scenario]);

  const [showBaseline, setShowBaseline] = useState(true);
  const [chartView, setChartView] = useState<"line" | "area">("line");

  const delta = result.finalTotal - result.finalBaseline;
  const deltaPct = (result.finalTotal / result.finalBaseline - 1) * 100;
  const deltaSeries = useMemo(
    () => result.timeline.map((p) => ({ year: p.year, diff: p.total - p.baselineTotal, events: p.events })),
    [result.timeline],
  );
  const metrics = useMemo(() => {
    const start = scenario.startingCash || 1;
    const years = Math.max(1, scenario.endYear - scenario.startYear);
    const cagr = (final: number) => (Math.pow(final / start, 1 / years) - 1) * 100;
    // F07: the equity series must START at the opening balance, otherwise a
    // first-period loss reports 0% drawdown. Observation frequency is one
    // point per simulated year, applied identically to scenario and baseline.
    const maxDD = (key: "total" | "baselineTotal") => {
      const opening = result.openingTotal ?? start;
      const series = [opening, ...result.timeline.map((p) => p[key])];
      let peak = series[0], worst = 0;
      for (const v of series) {
        if (!Number.isFinite(v)) continue;
        if (v > peak) peak = v;
        const dd = peak > 0 ? (v - peak) / peak : 0;
        if (dd < worst) worst = dd;
      }
      return worst * 100;
    };
    return {
      scenario: { end: result.finalTotal, gain: result.finalTotal - start, cagr: cagr(result.finalTotal), dd: maxDD("total") },
      baseline: { end: result.finalBaseline, gain: result.finalBaseline - start, cagr: cagr(result.finalBaseline), dd: maxDD("baselineTotal") },
    };
  }, [result, scenario]);

  const share = () => {
    const enc = encodeScenario(scenario);
    navigator.clipboard.writeText(`${appOrigin()}/sandbox/setup?scenario=${enc}`).then(
      () => toast.success("Share link copied"),
      () => toast.error("Copy failed"),
    );
  };

  return (
    <>
      <Helmet>
        <title>Scenario Results — Sandbox · Rise to Riches</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="min-h-screen sandbox-scope">
        <header className="sticky top-0 z-40 border-b sandbox-border bg-[hsl(var(--sandbox-bg))]/85 backdrop-blur-lg">
          <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
            <Link to="/sandbox/setup" className="flex items-center gap-2 sandbox-muted hover:sandbox-text text-sm">
              <ArrowLeft className="w-4 h-4" /> Setup
            </Link>
            <span className="font-display font-bold sandbox-text text-sm">Results</span>
            <div className="w-16" />
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-8">
          <section>
            <p className="text-[10px] font-mono uppercase tracking-widest sandbox-accent">Scenario complete</p>
            <h1 className="font-display text-3xl md:text-5xl font-bold sandbox-text mt-2">{scenario.name}</h1>
            <p className="sandbox-muted mt-2">{scenario.startYear} → {scenario.endYear} · {scenario.events.length} event{scenario.events.length !== 1 ? "s" : ""}</p>
          </section>

          <section className="grid md:grid-cols-4 gap-4">
            <BigStat label="Final net worth" v={usd(result.finalTotal)} />
            <BigStat label="No-intervention baseline" v={usd(result.finalBaseline)} muted />
            <BigStat label="vs Baseline" v={`${delta >= 0 ? "+" : ""}${usd(delta)}`} accent={delta >= 0 ? "gain" : "loss"} sub={`${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`} />
            <BigStat label="Combined return" v={`${((result.finalTotal / scenario.startingCash - 1) * 100).toFixed(1)}%`} />
          </section>

          <section className="rounded-2xl sandbox-surface border overflow-hidden">
            <div className="p-6 pb-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display text-xl font-bold sandbox-text">Scenario vs baseline</h2>
                <p className="text-xs sandbox-muted mt-1">Side-by-side metrics over your {Math.max(1, scenario.endYear - scenario.startYear)}-year window.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-mono uppercase tracking-widest sandbox-muted border-t sandbox-border">
                    <th className="px-6 py-3 font-normal">Metric</th>
                    <th className="px-6 py-3 font-normal">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-sandbox-primary" /> Your scenario
                      </span>
                    </th>
                    <th className="px-6 py-3 font-normal">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: "hsl(var(--sandbox-muted))" }} /> No intervention
                      </span>
                    </th>
                    <th className="px-6 py-3 font-normal">Difference</th>
                  </tr>
                </thead>
                <tbody className="sandbox-text font-mono">
                  <CompareRow label="Ending net worth" a={usd(metrics.scenario.end)} b={usd(metrics.baseline.end)} diff={metrics.scenario.end - metrics.baseline.end} fmt={(v) => `${v >= 0 ? "+" : ""}${usd(v)}`} />
                  <CompareRow label="Total gain" a={`${metrics.scenario.gain >= 0 ? "+" : ""}${usd(metrics.scenario.gain)}`} b={`${metrics.baseline.gain >= 0 ? "+" : ""}${usd(metrics.baseline.gain)}`} diff={metrics.scenario.gain - metrics.baseline.gain} fmt={(v) => `${v >= 0 ? "+" : ""}${usd(v)}`} />
                  <CompareRow label="CAGR (annualized)" a={`${metrics.scenario.cagr.toFixed(2)}%`} b={`${metrics.baseline.cagr.toFixed(2)}%`} diff={metrics.scenario.cagr - metrics.baseline.cagr} fmt={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} pts`} />
                  <CompareRow label="Max drawdown" a={`${metrics.scenario.dd.toFixed(1)}%`} b={`${metrics.baseline.dd.toFixed(1)}%`} diff={metrics.scenario.dd - metrics.baseline.dd} fmt={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} pts`} invertColor />
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl sandbox-surface border p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="font-display text-xl font-bold sandbox-text">Your scenario vs no intervention</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex sandbox-surface-2 border rounded-md p-0.5">
                  <ToggleBtn active={chartView === "line"} onClick={() => setChartView("line")} icon={<Activity className="w-3 h-3" />} label="Line" />
                  <ToggleBtn active={chartView === "area"} onClick={() => setChartView("area")} icon={<AreaIcon className="w-3 h-3" />} label="Area" />
                </div>
                <button
                  onClick={() => setShowBaseline((v) => !v)}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition ${
                    showBaseline ? "sandbox-surface-2 sandbox-text" : "sandbox-surface-2 sandbox-muted"
                  }`}
                  aria-pressed={showBaseline}
                >
                  {showBaseline ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  Baseline
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs sandbox-muted mb-3 flex-wrap">
              <LegendSwatch color="hsl(var(--sandbox-primary))" label="Your scenario" solid />
              {showBaseline && <LegendSwatch color="hsl(var(--sandbox-muted))" label="No intervention" dashed />}
              <LegendSwatch color="hsl(var(--sandbox-accent))" label="Event" dot />
            </div>
            <div className="h-72">
              <ResponsiveContainer>
                <ComposedChart data={result.timeline}>
                  <defs>
                    <linearGradient id="sbTotalArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--sandbox-primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--sandbox-primary))" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="sbBaseArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--sandbox-muted))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--sandbox-muted))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--sandbox-border))" strokeDasharray="2 4" />
                  <XAxis dataKey="year" stroke="hsl(var(--sandbox-muted))" fontSize={11} />
                  <YAxis stroke="hsl(var(--sandbox-muted))" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--sandbox-surface-2))", border: "1px solid hsl(var(--sandbox-border))", borderRadius: 8, color: "hsl(var(--sandbox-text))" }}
                    formatter={(v: number, name: string) => [usd(v), name === "total" ? "Your scenario" : "No intervention"]}
                  />
                  {showBaseline && chartView === "area" && (
                    <Area type="monotone" dataKey="baselineTotal" name="baseline" stroke="hsl(var(--sandbox-muted))" strokeDasharray="4 4" fill="url(#sbBaseArea)" strokeWidth={1.5} />
                  )}
                  {showBaseline && chartView === "line" && (
                    <Line type="monotone" dataKey="baselineTotal" name="baseline" stroke="hsl(var(--sandbox-muted))" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                  )}
                  {chartView === "area" ? (
                    <Area type="monotone" dataKey="total" name="total" stroke="hsl(var(--sandbox-primary))" fill="url(#sbTotalArea)" strokeWidth={2.5} />
                  ) : (
                    <Line type="monotone" dataKey="total" name="total" stroke="hsl(var(--sandbox-primary))" dot={false} strokeWidth={2.5} />
                  )}
                  {result.timeline
                    .filter((p) => p.events.length > 0)
                    .map((p) => (
                      <ReferenceDot key={p.year} x={p.year} y={p.total} r={5} fill="hsl(var(--sandbox-accent))" stroke="none" />
                    ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl sandbox-surface border p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-display text-xl font-bold sandbox-text">Difference vs baseline</h2>
              <p className="text-xs sandbox-muted">
                How much your interventions moved net worth away from the untouched historical timeline.
              </p>
            </div>
            <div className="h-56">
              <ResponsiveContainer>
                <AreaChart data={deltaSeries}>
                  <defs>
                    <linearGradient id="sbGain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160 84% 45%)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="hsl(160 84% 45%)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="sbLoss" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="hsl(0 84% 60%)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="hsl(0 84% 60%)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--sandbox-border))" strokeDasharray="2 4" />
                  <XAxis dataKey="year" stroke="hsl(var(--sandbox-muted))" fontSize={11} />
                  <YAxis stroke="hsl(var(--sandbox-muted))" fontSize={11} tickFormatter={(v) => `${v >= 0 ? "+" : ""}$${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--sandbox-surface-2))", border: "1px solid hsl(var(--sandbox-border))", borderRadius: 8, color: "hsl(var(--sandbox-text))" }}
                    formatter={(v: number) => [`${v >= 0 ? "+" : ""}${usd(v)}`, "Delta"]}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--sandbox-border))" />
                  <Area
                    type="monotone"
                    dataKey="diff"
                    stroke={delta >= 0 ? "hsl(160 84% 55%)" : "hsl(0 84% 65%)"}
                    fill={delta >= 0 ? "url(#sbGain)" : "url(#sbLoss)"}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs sandbox-muted">
              Ending gap:{" "}
              <span className={`font-mono font-semibold ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {delta >= 0 ? "+" : ""}{usd(delta)} ({deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%)
              </span>{" "}
              vs. the untouched {scenario.startYear}–{scenario.endYear} historical timeline.
            </p>
          </section>


          <section className="grid md:grid-cols-2 gap-4">
            <ReturnCard label="Stock portfolio" v={result.stockReturn} icon={<TrendingUp className="w-4 h-4" />} />
            <ReturnCard label="Real-estate portfolio" v={result.reReturn} icon={<TrendingUp className="w-4 h-4" />} />
          </section>

          <section className="grid md:grid-cols-2 gap-4">
            <HighlightCard title="Best year" icon={<Award className="w-4 h-4 sandbox-accent" />}
              body={result.bestYear ? `${result.bestYear.year} · ${result.bestYear.delta >= 0 ? "+" : ""}${usd(result.bestYear.delta)}` : "—"} />
            <HighlightCard title="Worst year" icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
              body={result.worstYear ? `${result.worstYear.year} · ${usd(result.worstYear.delta)}` : "—"} />
            <HighlightCard title="Best city" icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
              body={result.bestCity ? `${result.bestCity.city} · ${result.bestCity.growth >= 0 ? "+" : ""}${result.bestCity.growth.toFixed(1)}%` : "No cities selected"} />
            <HighlightCard title="Worst city" icon={<TrendingDown className="w-4 h-4 text-red-400" />}
              body={result.worstCity ? `${result.worstCity.city} · ${result.worstCity.growth.toFixed(1)}%` : "—"} />
          </section>

          {result.biggestEvent && (
            <section className="rounded-2xl sandbox-surface border p-6 glow-sandbox-soft">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest sandbox-accent">
                <Sparkles className="w-3 h-3" /> Biggest event impact
              </div>
              <h3 className="font-display text-2xl font-bold sandbox-text mt-2">{result.biggestEvent.label}</h3>
              <p className={`mt-1 font-mono ${result.biggestEvent.impact >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {result.biggestEvent.impact >= 0 ? "+" : ""}{usd(result.biggestEvent.impact)} on your portfolio
              </p>
            </section>
          )}

          <section className="flex flex-wrap gap-3 justify-center pt-4" aria-label="Next steps">
            <button onClick={() => nav("/sandbox/setup")} className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-sandbox-primary text-[hsl(var(--sandbox-primary-foreground))] font-semibold hover:opacity-90">
              <Edit3 className="w-4 h-4" /> Edit scenario
            </button>
            <button onClick={() => { storeSavedScenario(scenario); saveScenario(makeScenarioCopy(scenario)); nav("/sandbox/setup"); }} className="inline-flex items-center gap-2 h-11 px-5 rounded-lg border sandbox-border sandbox-text hover:bg-[hsl(var(--sandbox-surface-2))]">
              <Copy className="w-4 h-4" /> Duplicate and edit
            </button>
            <button onClick={share} className="inline-flex items-center gap-2 h-11 px-5 rounded-lg border sandbox-border sandbox-text hover:bg-[hsl(var(--sandbox-surface-2))]">
              <Share2 className="w-4 h-4" /> Share
            </button>
            <button onClick={() => { saveScenario({ ...DEFAULT_SCENARIO, events: [] }); nav("/sandbox/setup"); }} className="inline-flex items-center gap-2 h-11 px-5 rounded-lg sandbox-muted hover:sandbox-text">
              <RotateCcw className="w-4 h-4" /> Start a new scenario
            </button>
          </section>

          <p className="text-center text-[10px] sandbox-muted italic pt-4">
            Educational simulation only. Not financial advice. No real-money trading.
          </p>
        </div>
      </div>
    </>
  );
}

function BigStat({ label, v, sub, muted, accent }: { label: string; v: string; sub?: string; muted?: boolean; accent?: "gain" | "loss" }) {
  const color = accent === "gain" ? "text-emerald-400" : accent === "loss" ? "text-red-400" : muted ? "sandbox-muted" : "sandbox-text";
  return (
    <div className="sandbox-surface border rounded-xl p-5">
      <p className="text-[10px] font-mono uppercase tracking-widest sandbox-muted">{label}</p>
      <p className={`font-display text-2xl md:text-3xl font-bold mt-2 tabular-nums ${color}`}>{v}</p>
      {sub && <p className={`text-xs mt-1 font-mono ${color}`}>{sub}</p>}
    </div>
  );
}

function ReturnCard({ label, v, icon }: { label: string; v: number; icon: React.ReactNode }) {
  const pos = v >= 0;
  return (
    <div className="sandbox-surface border rounded-xl p-5 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest sandbox-muted">{label}</p>
        <p className={`font-display text-2xl font-bold mt-1 tabular-nums ${pos ? "text-emerald-400" : "text-red-400"}`}>
          {pos ? "+" : ""}{v.toFixed(1)}%
        </p>
      </div>
      <div className={pos ? "text-emerald-400" : "text-red-400"}>{icon}</div>
    </div>
  );
}

function HighlightCard({ title, body, icon }: { title: string; body: string; icon: React.ReactNode }) {
  return (
    <div className="sandbox-surface border rounded-xl p-5">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest sandbox-muted">
        {icon} {title}
      </div>
      <p className="mt-2 sandbox-text font-display text-lg">{body}</p>
    </div>
  );
}

function usd(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function LegendSwatch({ color, label, solid, dashed, dot }: { color: string; label: string; solid?: boolean; dashed?: boolean; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {dot ? (
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      ) : (
        <span
          className="inline-block w-6 h-[2px]"
          style={{
            background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 8px)` : color,
          }}
          aria-hidden
        />
      )}
      {label}
    </span>
  );
}

function ToggleBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded transition ${
        active ? "bg-sandbox-primary text-[hsl(var(--sandbox-primary-foreground))]" : "sandbox-muted hover:sandbox-text"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function CompareRow({ label, a, b, diff, fmt, invertColor }: { label: string; a: string; b: string; diff: number; fmt: (v: number) => string; invertColor?: boolean }) {
  const good = invertColor ? diff > 0 : diff > 0;
  // For drawdown, less negative (higher = closer to 0) is better; diff > 0 still means "your scenario is less bad"
  const color = Math.abs(diff) < 1e-9 ? "sandbox-muted" : good ? "text-emerald-400" : "text-red-400";
  return (
    <tr className="border-t sandbox-border">
      <td className="px-6 py-3 font-body sandbox-muted">{label}</td>
      <td className="px-6 py-3 tabular-nums">{a}</td>
      <td className="px-6 py-3 tabular-nums sandbox-muted">{b}</td>
      <td className={`px-6 py-3 tabular-nums font-semibold ${color}`}>{fmt(diff)}</td>
    </tr>
  );
}
