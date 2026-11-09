import { invokeAI } from "@/lib/aiInvoke";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft, ArrowRight, Sparkles, Wand2, Trash2, Copy, Save,
  ChevronUp, ChevronDown, Plus, Zap, Loader2, Lock, Unlock, RefreshCw, Building2, LineChart,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CITIES } from "@/data/realEstateData";
import {
  DEFAULT_SCENARIO, HISTORICAL_EVENT_LIBRARY, PORTFOLIO_PRESETS, PRESETS,
  decodeScenario, encodeScenario, loadScenario, newId, saveScenario, storeSavedScenario, makeScenarioCopy,
  type SandboxEvent, type SandboxScenario,
  checkAllocation,
  normalizeAllocation,
} from "@/lib/sandbox/state";
import { appOrigin } from '@/lib/basePath';

const STEPS = ["Starting Point", "Portfolio", "Scenario Controls", "Timeline"] as const;

export default function SandboxSetup() {
  const nav = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);

  // Restart handshake: when a Sandbox CTA is clicked from anywhere (including
  // from inside /sandbox/setup itself), <SandboxCTA> re-navigates here with
  // `state.sandboxRestartedAt`. Reset the wizard to step 0 + scroll to top so
  // the user sees a fresh entry instead of a silent no-op.
  useEffect(() => {
    const st = location.state as { sandboxRestartedAt?: number } | null;
    if (st?.sandboxRestartedAt) {
      setStep(0);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.state]);

  const [s, setS] = useState<SandboxScenario>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const enc = params.get("scenario");
      if (enc) {
        const dec = decodeScenario(enc);
        if (dec) return dec;
      }
    }
    return loadScenario();
  });
  useEffect(() => { saveScenario(s); }, [s]);
  // Once a linked scenario is loaded, drop it from the URL so later edits survive a reload.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("scenario")) {
      url.searchParams.delete("scenario");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  }, []);

  const update = (patch: Partial<SandboxScenario>) => setS((cur) => ({ ...cur, ...patch }));

  const alloc = checkAllocation(s);

  const runSim = () => {
    // F04: an allocation that doesn't total 100% must never run silently.
    if (!alloc.valid) {
      setStep(1);
      toast.error(
        alloc.remaining > 0
          ? `Your mix only adds up to ${(alloc.total * 100).toFixed(0)}% — ${(alloc.remaining * 100).toFixed(0)}% is still unallocated.`
          : `Your mix adds up to ${(alloc.total * 100).toFixed(0)}% — that's ${Math.abs(alloc.remaining * 100).toFixed(0)}% more than you have.`,
      );
      return;
    }
    saveScenario(s);
    nav("/sandbox/results");
  };

  return (
    <>
      <Helmet>
        <title>Build Your Scenario — Sandbox · Rise to Riches</title>
        <meta name="description" content="Design a custom economic scenario. Pick your era, build a portfolio, drop in historical events, and simulate custom market shocks." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="min-h-screen sandbox-scope">
        <header className="sticky top-0 z-40 border-b sandbox-border bg-[hsl(var(--sandbox-bg))]/85 backdrop-blur-lg">
          <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
            <Link to="/sandbox" className="flex items-center gap-2 sandbox-muted hover:sandbox-text text-sm">
              <ArrowLeft className="w-4 h-4" /> Sandbox
            </Link>
            <span className="font-display font-bold sandbox-text text-sm">Build Your Scenario</span>
            <button
              onClick={runSim}
              disabled={!alloc.valid}
              title={alloc.valid ? undefined : "Your portfolio mix must add up to 100%"}
              className="text-xs px-3 py-1.5 rounded-md bg-sandbox-primary text-[hsl(var(--sandbox-primary-foreground))] font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Run simulation →
            </button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
          <Stepper step={step} setStep={setStep} />

          <div className="mt-8">
            {step === 0 && <StepStartingPoint s={s} update={update} />}
            {step === 1 && <StepPortfolio s={s} update={update} />}
            {step === 2 && <StepScenarioControls s={s} update={update} />}
            {step === 3 && <StepTimeline s={s} update={update} />}
          </div>

          <div className="mt-10 flex items-center justify-between">
            <button
              onClick={() => setStep((n) => Math.max(0, n - 1))}
              disabled={step === 0}
              className="text-sm px-4 py-2 rounded-md border sandbox-border sandbox-muted hover:sandbox-text disabled:opacity-40"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((n) => Math.min(STEPS.length - 1, n + 1))}
                className="text-sm px-5 py-2 rounded-md bg-sandbox-primary text-[hsl(var(--sandbox-primary-foreground))] font-semibold hover:opacity-90"
              >
                Continue <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            ) : (
              <button
                onClick={runSim}
                disabled={!alloc.valid}
                title={alloc.valid ? undefined : "Your portfolio mix must add up to 100%"}
                className="text-sm px-5 py-2 rounded-md bg-sandbox-primary text-[hsl(var(--sandbox-primary-foreground))] font-semibold glow-sandbox hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Simulate <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] sandbox-muted italic pb-8 px-4">
          Educational simulation only. Not financial advice. No real-money trading.
        </p>
      </div>
    </>
  );
}

function Stepper({ step, setStep }: { step: number; setStep: (n: number) => void }) {
  return (
    <ol className="flex items-center gap-2 flex-wrap">
      {STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li key={label}>
            <button
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition ${
                active
                  ? "bg-sandbox-primary text-[hsl(var(--sandbox-primary-foreground))] border-transparent"
                  : done
                  ? "sandbox-surface-2 sandbox-text border"
                  : "border sandbox-border sandbox-muted hover:sandbox-text"
              }`}
            >
              <span className="font-mono">{String(i + 1).padStart(2, "0")}</span>
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Step 1 ---------- */
function StepStartingPoint({ s, update }: { s: SandboxScenario; update: (p: Partial<SandboxScenario>) => void }) {
  return (
    <div className="rounded-2xl sandbox-surface border p-6 md:p-8 space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold sandbox-text">Starting Point</h2>
        <p className="text-sm sandbox-muted mt-1">Pick when your alternate history begins and ends.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="text-[10px] uppercase tracking-widest font-mono sandbox-muted">Start year</label>
          <input
            type="number" min={1990} max={2020}
            value={s.startYear}
            onChange={(e) => update({ startYear: clamp(+e.target.value, 1990, 2020) })}
            className="mt-2 w-full sandbox-surface-2 border rounded-md px-3 py-2 sandbox-text font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest font-mono sandbox-muted">End year</label>
          <input
            type="number" min={1990} max={2020}
            value={s.endYear}
            onChange={(e) => update({ endYear: clamp(+e.target.value, s.startYear, 2020) })}
            className="mt-2 w-full sandbox-surface-2 border rounded-md px-3 py-2 sandbox-text font-mono"
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest font-mono sandbox-muted mb-3">Presets</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => update({ startYear: p.start, endYear: p.end })}
              className="text-left sandbox-surface-2 border rounded-lg px-4 py-3 hover:glow-sandbox-soft transition"
            >
              <p className="font-display font-semibold sandbox-text text-sm">{p.label}</p>
              <p className="text-[10px] font-mono sandbox-muted mt-1">{p.start}–{p.end}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest font-mono sandbox-muted">Scenario name</label>
        <input
          value={s.name}
          onChange={(e) => update({ name: e.target.value })}
          className="mt-2 w-full sandbox-surface-2 border rounded-md px-3 py-2 sandbox-text"
        />
      </div>
    </div>
  );
}

/* ---------- Step 2 ---------- */
function StepPortfolio({ s, update }: { s: SandboxScenario; update: (p: Partial<SandboxScenario>) => void }) {
  const applyPreset = (id: keyof typeof PORTFOLIO_PRESETS) => {
    const p = PORTFOLIO_PRESETS[id];
    update({ presetPortfolio: id as SandboxScenario["presetPortfolio"], stockAlloc: p.stock, reAlloc: p.re, cashAlloc: p.cash });
  };
  const toggleCity = (city: string) => {
    const has = s.cities.includes(city);
    update({ cities: has ? s.cities.filter((c) => c !== city) : [...s.cities, city] });
  };

  return (
    <div className="rounded-2xl sandbox-surface border p-6 md:p-8 space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold sandbox-text">Portfolio Builder</h2>
        <p className="text-sm sandbox-muted mt-1">How your ${(s.startingCash).toLocaleString()} is allocated at year one.</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest font-mono sandbox-muted mb-3">Preset mix</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(PORTFOLIO_PRESETS).map(([id, p]) => {
            const active = s.presetPortfolio === id;
            return (
              <button
                key={id}
                onClick={() => applyPreset(id as keyof typeof PORTFOLIO_PRESETS)}
                className={`text-left border rounded-lg px-4 py-3 transition ${
                  active ? "border-transparent bg-sandbox-primary/20 glow-sandbox-soft" : "sandbox-surface-2 border"
                }`}
              >
                <p className="font-display font-semibold sandbox-text capitalize text-sm">{id}</p>
                <p className="text-[10px] font-mono sandbox-muted mt-1">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Allocation label="Stocks" value={s.stockAlloc} onChange={(v) => update({ stockAlloc: v, presetPortfolio: "custom" })} color="text-emerald-400" />
        <Allocation label="Real Estate" value={s.reAlloc} onChange={(v) => update({ reAlloc: v, presetPortfolio: "custom" })} color="text-amber-400" />
        <Allocation label="Cash" value={s.cashAlloc} onChange={(v) => update({ cashAlloc: v, presetPortfolio: "custom" })} color="sandbox-muted" />
      </div>
      {(() => {
        const a = checkAllocation(s);
        const dollars = (pct: number) => `$${Math.round(Math.abs(pct) * (s.startingCash || 0)).toLocaleString()}`;
        return (
          <div className="flex flex-wrap items-center gap-3 text-xs sandbox-muted">
            <span>
              Total:{" "}
              <span className={`font-mono ${a.valid ? "text-emerald-400" : "text-red-400"}`}>
                {(a.total * 100).toFixed(0)}%
              </span>
            </span>
            {a.valid ? (
              <span className="text-emerald-400">Your ${(s.startingCash || 0).toLocaleString()} is fully allocated.</span>
            ) : (
              <>
                <span className="text-red-400">
                  {a.remaining > 0
                    ? `${(a.remaining * 100).toFixed(0)}% (${dollars(a.remaining)}) still unallocated`
                    : `Over-allocated by ${Math.abs(a.remaining * 100).toFixed(0)}% (${dollars(a.remaining)}) — you can't invest money you don't have`}
                </span>
                <button
                  onClick={() => {
                    const n = normalizeAllocation(s);
                    update({ stockAlloc: n.stockAlloc, reAlloc: n.reAlloc, cashAlloc: n.cashAlloc, presetPortfolio: "custom" });
                  }}
                  className="px-2.5 py-1 rounded-md border sandbox-border hover:sandbox-text"
                >
                  Scale to 100%
                </button>
              </>
            )}
          </div>
        );
      })()}

      <div>
        <p className="text-[10px] uppercase tracking-widest font-mono sandbox-muted mb-3 flex items-center gap-1">
          <Building2 className="w-3 h-3" /> Real-estate cities
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {CITIES.map((c) => {
            const on = s.cities.includes(c.city);
            return (
              <button
                key={c.city}
                onClick={() => toggleCity(c.city)}
                className={`text-xs px-3 py-2 rounded-md border transition ${
                  on ? "bg-sandbox-primary/25 border-transparent sandbox-text" : "sandbox-surface-2 border sandbox-muted hover:sandbox-text"
                }`}
              >
                {c.city}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest font-mono sandbox-muted">Starting capital</label>
        <input
          type="number" min={10_000} step={10_000}
          value={s.startingCash}
          onChange={(e) => update({ startingCash: Math.max(10_000, +e.target.value || 0) })}
          className="mt-2 w-full sandbox-surface-2 border rounded-md px-3 py-2 sandbox-text font-mono"
        />
      </div>
    </div>
  );
}

function Allocation({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div className="sandbox-surface-2 border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs sandbox-muted">{label}</span>
        <span className={`font-mono font-semibold ${color}`}>{(value * 100).toFixed(0)}%</span>
      </div>
      <input
        type="range" min={0} max={100} value={Math.round(value * 100)}
        onChange={(e) => onChange(+e.target.value / 100)}
        className="mt-3 w-full accent-purple-500"
      />
    </div>
  );
}

/* ---------- Step 3 — controls + custom event ---------- */
function StepScenarioControls({ s, update }: { s: SandboxScenario; update: (p: Partial<SandboxScenario>) => void }) {
  const addFromLibrary = (tmpl: typeof HISTORICAL_EVENT_LIBRARY[number]) => {
    const midYear = Math.round((s.startYear + s.endYear) / 2);
    update({ events: [...s.events, { ...tmpl, id: newId(), year: midYear }] });
    toast.success(`Added "${tmpl.label}"`);
  };

  return (
    <div className="space-y-6">
      <CustomEventPanel s={s} update={update} />

      <div className="rounded-2xl sandbox-surface border p-6 md:p-8">
        <h2 className="font-display text-2xl font-bold sandbox-text">Historical Event Library</h2>
        <p className="text-sm sandbox-muted mt-1">Drop any of these into your timeline — you can edit year, duration, and severity next.</p>

        <div className="mt-6 grid md:grid-cols-2 gap-2">
          {HISTORICAL_EVENT_LIBRARY.map((e) => (
            <button
              key={e.label}
              onClick={() => addFromLibrary(e)}
              className="text-left sandbox-surface-2 border rounded-lg px-4 py-3 hover:glow-sandbox-soft transition flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-display font-semibold sandbox-text text-sm truncate">{e.label}</p>
                <p className="text-[10px] font-mono sandbox-muted mt-0.5">
                  {e.duration}yr · stocks {fmt(e.stockDelta)} · RE {fmt(e.reDelta)}
                </p>
              </div>
              <Plus className="w-4 h-4 sandbox-primary shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomEventPanel({ s, update }: { s: SandboxScenario; update: (p: Partial<SandboxScenario>) => void }) {
  const [prompt, setPrompt] = useState("");
  const [year, setYear] = useState(Math.round((s.startYear + s.endYear) / 2));
  const [duration, setDuration] = useState(1);
  const [severity, setSeverity] = useState<"mild" | "moderate" | "severe">("moderate");
  const [scope, setScope] = useState<"stocks" | "real-estate" | "both">("both");
  const [unpredictable, setUnpredictable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<SandboxEvent | null>(null);
  const [locks, setLocks] = useState<Record<string, boolean>>({});

  const generate = async () => {
    if (!prompt.trim()) { toast.error("Type an event first"); return; }
    setLoading(true);
    try {
      const data = await invokeAI<{ scenario?: Record<string, any> }>("sandbox-scenario", { prompt: prompt.slice(0, 500), year, duration, severity, scope, unpredictable });
      const sc = data?.scenario ?? {};
      const ev: SandboxEvent = {
        id: newId(),
        label: sc.label || prompt.slice(0, 40),
        year, duration, scope,
        severity: severity === "severe" ? -3 : severity === "mild" ? -1 : -2,
        stockDelta: Number(sc.overallMarket ?? 0),
        reDelta: Number(sc.realEstateOverall ?? 0),
        rentDelta: Number(sc.rentDelta ?? 0),
        rates: Number(sc.rates ?? 0),
        inflation: Number(sc.inflation ?? 0),
        confidence: Number(sc.confidence ?? 0),
        volatility: Number(sc.volatility ?? 1),
        isCustom: true,
        logic: String(sc.logic ?? ""),
        winners: Array.isArray(sc.winners) ? sc.winners : [],
        losers: Array.isArray(sc.losers) ? sc.losers : [],
        sectorDeltas: sc.stockSectors ?? {},
        cityDeltas: sc.cities ?? {},
      };
      setDraft(ev);
    } catch (err: any) {
      toast.error(err?.message ?? "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const patchDraft = (patch: Partial<SandboxEvent>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const toggleLock = (k: string) => setLocks((L) => ({ ...L, [k]: !L[k] }));

  const applyToTimeline = () => {
    if (!draft) return;
    update({ events: [...s.events, draft] });
    toast.success(`"${draft.label}" added to timeline`);
    setDraft(null);
    setPrompt("");
  };

  return (
    <div className="rounded-2xl sandbox-surface border p-6 md:p-8 glow-sandbox-soft">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 sandbox-accent" />
        <span className="text-[10px] uppercase tracking-widest font-mono sandbox-accent">Enter Your Own Event</span>
      </div>
      <h2 className="font-display text-2xl font-bold sandbox-text">Write the headline. We'll simulate the fallout.</h2>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. Godzilla attacks Brazil and shuts down major ports for six months"
        rows={2}
        className="mt-5 w-full sandbox-surface-2 border rounded-md px-4 py-3 sandbox-text placeholder:sandbox-muted resize-none"
      />

      <div className="mt-4 grid sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Year">
          <input type="number" min={1990} max={2020} value={year} onChange={(e) => setYear(+e.target.value)}
            className="w-full sandbox-surface-2 border rounded-md px-2.5 py-1.5 text-sm sandbox-text font-mono" />
        </Field>
        <Field label="Duration (yr)">
          <input type="number" min={1} max={10} value={duration} onChange={(e) => setDuration(+e.target.value)}
            className="w-full sandbox-surface-2 border rounded-md px-2.5 py-1.5 text-sm sandbox-text font-mono" />
        </Field>
        <Field label="Severity">
          <select value={severity} onChange={(e) => setSeverity(e.target.value as any)}
            className="w-full sandbox-surface-2 border rounded-md px-2.5 py-1.5 text-sm sandbox-text">
            <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option>
          </select>
        </Field>
        <Field label="Scope">
          <select value={scope} onChange={(e) => setScope(e.target.value as any)}
            className="w-full sandbox-surface-2 border rounded-md px-2.5 py-1.5 text-sm sandbox-text">
            <option value="both">Both</option><option value="stocks">Stocks</option><option value="real-estate">Real estate</option>
          </select>
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-xs sandbox-muted">
          <input type="checkbox" checked={unpredictable} onChange={(e) => setUnpredictable(e.target.checked)} />
          Keep it unpredictable
        </label>
        <button
          onClick={generate}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-md bg-sandbox-primary text-[hsl(var(--sandbox-primary-foreground))] text-sm font-semibold glow-sandbox hover:opacity-95 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {loading ? "Simulating…" : "Generate scenario"}
        </button>
      </div>

      {draft && (
        <div className="mt-6 sandbox-surface-2 border rounded-xl p-5 animate-slide-up">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest sandbox-accent">Fictional scenario estimate</p>
              <h3 className="font-display text-xl font-bold sandbox-text mt-1">{draft.label}</h3>
              {draft.logic && <p className="text-sm sandbox-muted mt-2 max-w-2xl">{draft.logic}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={generate} className="text-xs px-3 py-1.5 rounded-md border sandbox-border sandbox-muted hover:sandbox-text inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Re-roll
              </button>
              <button onClick={applyToTimeline} className="text-xs px-3 py-1.5 rounded-md bg-sandbox-primary text-[hsl(var(--sandbox-primary-foreground))] font-semibold hover:opacity-90 inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add to timeline
              </button>
            </div>
          </div>

          <div className="mt-5 grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            <EditableStat label="Overall market %" v={draft.stockDelta} onChange={(v) => patchDraft({ stockDelta: v })} locked={!!locks.stockDelta} onLock={() => toggleLock("stockDelta")} />
            <EditableStat label="Real estate %" v={draft.reDelta} onChange={(v) => patchDraft({ reDelta: v })} locked={!!locks.reDelta} onLock={() => toggleLock("reDelta")} />
            <EditableStat label="Rent %" v={draft.rentDelta ?? 0} onChange={(v) => patchDraft({ rentDelta: v })} locked={!!locks.rentDelta} onLock={() => toggleLock("rentDelta")} />
            <EditableStat label="Rates (pts)" v={draft.rates ?? 0} onChange={(v) => patchDraft({ rates: v })} locked={!!locks.rates} onLock={() => toggleLock("rates")} />
            <EditableStat label="Inflation (pts)" v={draft.inflation ?? 0} onChange={(v) => patchDraft({ inflation: v })} locked={!!locks.inflation} onLock={() => toggleLock("inflation")} />
            <EditableStat label="Confidence" v={draft.confidence ?? 0} onChange={(v) => patchDraft({ confidence: v })} locked={!!locks.confidence} onLock={() => toggleLock("confidence")} />
          </div>

          {(draft.winners?.length || draft.losers?.length) ? (
            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              <TagList label="Winners" items={draft.winners ?? []} pos />
              <TagList label="Losers" items={draft.losers ?? []} />
            </div>
          ) : null}

          <p className="mt-4 text-[10px] sandbox-muted italic">
            Fictional scenario estimate — generated for gameplay and educational experimentation. Not a real forecast.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest font-mono sandbox-muted">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function EditableStat({ label, v, onChange, locked, onLock }: { label: string; v: number; onChange: (v: number) => void; locked: boolean; onLock: () => void }) {
  return (
    <div className="sandbox-surface border rounded-md px-3 py-2 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-mono sandbox-muted truncate">{label}</p>
        <input
          type="number" step="0.1" value={v} disabled={locked}
          onChange={(e) => onChange(+e.target.value)}
          className="w-full bg-transparent sandbox-text font-mono font-semibold outline-none"
        />
      </div>
      <button onClick={onLock} className="sandbox-muted hover:sandbox-text" aria-label={locked ? "Unlock" : "Lock"}>
        {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function TagList({ label, items, pos }: { label: string; items: string[]; pos?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-mono sandbox-muted mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${pos ? "text-emerald-300 border-emerald-800 bg-emerald-950/40" : "text-red-300 border-red-900 bg-red-950/40"}`}>
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Step 4 — draggable timeline ---------- */
function StepTimeline({ s, update }: { s: SandboxScenario; update: (p: Partial<SandboxScenario>) => void }) {
  const sorted = useMemo(() => [...s.events].sort((a, b) => a.year - b.year), [s.events]);

  const move = (idx: number, dir: -1 | 1) => {
    const arr = [...s.events];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    update({ events: arr });
  };
  const patch = (id: string, p: Partial<SandboxEvent>) => {
    update({ events: s.events.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  };
  const remove = (id: string) => update({ events: s.events.filter((e) => e.id !== id) });
  const duplicate = (e: SandboxEvent) => update({ events: [...s.events, { ...e, id: newId(), year: e.year + 1 }] });

  // Drag handling
  const [dragId, setDragId] = useState<string | null>(null);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const arr = [...s.events];
    const from = arr.findIndex((x) => x.id === dragId);
    const to = arr.findIndex((x) => x.id === targetId);
    if (from < 0 || to < 0) return;
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    update({ events: arr });
    setDragId(null);
  };

  const shareLink = () => {
    const enc = encodeScenario(s);
    const url = `${appOrigin()}/sandbox/setup?scenario=${enc}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Share link copied"),
      () => toast.error("Copy failed"),
    );
  };

  const saveScenarioLocal = () => {
    try {
      const raw = localStorage.getItem("sandbox-saved-scenarios");
      const arr = raw ? JSON.parse(raw) : [];
      arr.push({ ...s, savedAt: Date.now() });
      localStorage.setItem("sandbox-saved-scenarios", JSON.stringify(arr.slice(-20)));
      toast.success(`Saved "${s.name}"`);
    } catch { toast.error("Save failed"); }
  };

  const duplicateScenario = () => {
    // Keep the original in the saved list, then continue editing a distinct copy.
    storeSavedScenario(s);
    const copy = makeScenarioCopy(s);
    update(copy);
    toast.success(`Saved "${s.name}" — now editing "${copy.name}"`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl sandbox-surface border p-6 md:p-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold sandbox-text">Timeline</h2>
            <p className="text-sm sandbox-muted mt-1">Drag to reorder. Tune each event's year, duration, and severity.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={saveScenarioLocal} className="text-xs px-3 py-1.5 rounded-md border sandbox-border sandbox-muted hover:sandbox-text inline-flex items-center gap-1"><Save className="w-3 h-3" /> Save</button>
            <button onClick={duplicateScenario} className="text-xs px-3 py-1.5 rounded-md border sandbox-border sandbox-muted hover:sandbox-text inline-flex items-center gap-1"><Copy className="w-3 h-3" /> Duplicate</button>
            <button onClick={shareLink} className="text-xs px-3 py-1.5 rounded-md bg-sandbox-primary text-[hsl(var(--sandbox-primary-foreground))] font-semibold hover:opacity-90 inline-flex items-center gap-1"><LineChart className="w-3 h-3" /> Share</button>
          </div>
        </div>

        {/* Timeline strip — sparse year labels, one lane per overlapping event */}
        {(() => {
          const span = s.endYear - s.startYear + 1;
          const stepYears = Math.max(1, Math.ceil(span / 6));
          const ticks: number[] = [];
          for (let y = s.startYear; y <= s.endYear; y += stepYears) ticks.push(y);
          if (ticks[ticks.length - 1] !== s.endYear) ticks.push(s.endYear);
          const lanes: number[] = [];
          const laneOf = sorted.map((e) => {
            let l = lanes.findIndex((end) => end < e.year);
            if (l < 0) { l = lanes.length; lanes.push(0); }
            lanes[l] = e.year + Math.max(1, e.duration) - 1;
            return l;
          });
          const laneCount = Math.max(1, lanes.length);
          return (
            <div
              className="mt-6 relative sandbox-surface-2 border rounded-lg overflow-hidden"
              style={{ height: 28 + laneCount * 28 }}
              aria-hidden="true"
            >
              {ticks.map((y) => (
                <p key={y} className="absolute top-1.5 text-[10px] font-mono sandbox-muted -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `calc(${((y - s.startYear + 0.5) / span) * 94 + 3}%)` }}>{y}</p>
              ))}
              {sorted.map((e, i) => {
                const left = ((e.year - s.startYear) / span) * 94 + 3;
                const w = Math.max(3, (Math.max(1, e.duration) / span) * 94);
                return (
                  <div
                    key={e.id}
                    title={`${e.label} · ${e.year}`}
                    className="absolute h-6 rounded-md flex items-center px-2 text-[10px] font-semibold text-[hsl(var(--sandbox-primary-foreground))]"
                    style={{ left: `${left}%`, width: `${w}%`, top: 24 + laneOf[i] * 28, backgroundColor: "hsl(var(--sandbox-primary) / 0.85)" }}
                  >
                    {e.isCustom && <Sparkles className="w-3 h-3 mr-1 shrink-0" />}
                    <span className="truncate">{e.label}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
        {sorted.length > 0 && (
          <ol className="sr-only" aria-label="Events in date order">
            {sorted.map((e) => <li key={e.id}>{e.label}: {e.year}, lasting {e.duration} year{e.duration === 1 ? "" : "s"}</li>)}
          </ol>
        )}

        {s.events.length === 0 && (
          <p className="mt-6 text-center text-sm sandbox-muted italic">
            No events yet. Go back to Scenario Controls to add historical or custom events.
          </p>
        )}

        <div className="mt-6 space-y-2">
          {s.events.map((e, idx) => (
            <div
              key={e.id}
              draggable
              onDragStart={() => setDragId(e.id)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(e.id)}
              className={`sandbox-surface-2 border rounded-lg p-3 flex items-center gap-3 flex-wrap cursor-move ${dragId === e.id ? "opacity-50" : ""}`}
            >
              <div className="flex flex-col">
                <button aria-label={`Move ${e.label} up`} onClick={() => move(idx, -1)} className="sandbox-muted hover:sandbox-text"><ChevronUp className="w-3 h-3" /></button>
                <button aria-label={`Move ${e.label} down`} onClick={() => move(idx, 1)} className="sandbox-muted hover:sandbox-text"><ChevronDown className="w-3 h-3" /></button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold sandbox-text text-sm flex items-center gap-1.5 truncate">
                  {e.isCustom && <Sparkles className="w-3.5 h-3.5 sandbox-accent shrink-0" />} {e.label}
                </p>
                <p className="text-[10px] font-mono sandbox-muted">
                  stocks {fmt(e.stockDelta)} · RE {fmt(e.reDelta)} {e.rates ? ` · rates ${fmt(e.rates)}` : ""}
                </p>
              </div>
              <MiniInput label="Year" v={e.year} onChange={(v) => patch(e.id, { year: clamp(v, 1990, 2020) })} />
              <MiniInput label="Dur" v={e.duration} onChange={(v) => patch(e.id, { duration: clamp(v, 1, 10) })} />
              <MiniInput label="Sev" v={e.severity} step={1} onChange={(v) => patch(e.id, { severity: clamp(v, -3, 3) })} />
              <button onClick={() => duplicate(e)} className="text-xs sandbox-muted hover:sandbox-text" title="Duplicate" aria-label={`Duplicate ${e.label}`}><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(e.id)} className="text-xs text-red-400 hover:text-red-300" title="Remove" aria-label={`Remove ${e.label}`}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniInput({ label, v, onChange, step = 1 }: { label: string; v: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="text-[10px] font-mono sandbox-muted flex items-center gap-1">
      {label}
      <input
        type="number" value={v} step={step}
        onChange={(e) => onChange(+e.target.value)}
        className="w-16 sandbox-surface border rounded px-1.5 py-1 text-sandbox-text sandbox-text font-mono text-xs"
      />
    </label>
  );
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function fmt(n: number) { const sign = n > 0 ? "+" : ""; return `${sign}${n.toFixed(1)}%`; }
