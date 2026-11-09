import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Flag, Gauge, RefreshCw, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const STORAGE_KEY = "admin_code_dashboard";
const TOP_UP_URL = "https://lovable.dev/settings/plans";

interface Budget {
  month_start: string; month_to_date: number; requests_this_month: number; last_7_days: number;
  cap: number | null; auto_lock: boolean;
  daily: { day: string; credits: number }[];
  months: { month: string; credits: number; requests: number }[];
}

interface PlayerUsage {
  days: number; total_credits: number; median_credits: number; default_allowance: number | null;
  players: { subject: string; month_credits: number; allowance: number | null; custom_allowance: boolean; remaining: number | null; forecast: number; cap_day: number | null; id: string; name: string | null; guest: boolean; requests: number; coach: number; sandbox: number; credits: number; games: number | null; credits_per_game: number | null; share: number; heavy: boolean; last_used: string }[];
}

const fmt = (v: number) => (v < 1 ? v.toFixed(3) : v.toFixed(2));
const tip = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" } };

export default function AdminCredits() {
  const code = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) ?? "" : "";
  const [b, setB] = useState<Budget | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capInput, setCapInput] = useState("");
  const [autoLock, setAutoLock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pu, setPu] = useState<PlayerUsage | null>(null);
  const [days, setDays] = useState(30);
  const [heavyOnly, setHeavyOnly] = useState(false);
  const [defAllow, setDefAllow] = useState("");
  const [defDaily, setDefDaily] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true); setErr(null);
    const { data, error } = await supabase.functions.invoke("admin-dashboard", { headers: { "x-admin-code": code }, body: { budget: true, days } });
    setLoading(false);
    if (error || !data?.budget) { setErr("Couldn't load credit usage."); return; }
    const bd = data.budget as Budget;
    const pl = (data.players as PlayerUsage) ?? null;
    setPu(pl); setDefAllow(pl?.default_allowance != null ? String(pl.default_allowance) : "");
    setDefDaily(data.default_daily != null ? String(data.default_daily) : "");
    setB(bd); setCapInput(bd.cap != null ? String(bd.cap) : ""); setAutoLock(bd.auto_lock);
  }, [code, days]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setSaved(false);
    const { error } = await supabase.functions.invoke("admin-dashboard", {
      headers: { "x-admin-code": code }, body: { set_budget: { cap: capInput.trim() === "" ? null : Number(capInput), auto_lock: autoLock } },
    });
    setSaving(false);
    if (error) { setErr("Couldn't save the cap — use a positive number."); return; }
    setSaved(true); load();
  };

  const call = async (body: Record<string, unknown>, ok: string) => {
    setMsg(null);
    const { error } = await supabase.functions.invoke("admin-dashboard", { headers: { "x-admin-code": code }, body });
    setMsg(error ? "Couldn't save — use a positive number." : ok);
    if (!error) load();
  };

  const head = <Helmet><title>Rise to Riches</title><meta name="robots" content="noindex,nofollow" /></Helmet>;

  if (!code) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        {head}
        <Link to="/admin/dashboard" className="text-sm text-primary">Enter the dashboard password first</Link>
      </main>
    );
  }

  // Forecast: month-to-date pace extrapolated to the full month.
  const now = new Date();
  const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getDate();
  const dayOfMonth = now.getUTCDate() - 1 + (now.getUTCHours() * 60 + now.getUTCMinutes()) / 1440;
  const mtd = b?.month_to_date ?? 0;
  const forecast = dayOfMonth > 0.25 ? (mtd / dayOfMonth) * daysInMonth : (b?.last_7_days ?? 0) / 7 * daysInMonth;
  const cap = b?.cap ?? null;
  const usedPct = cap ? Math.min(100, (mtd / cap) * 100) : 0;
  const forecastPct = cap ? Math.min(100, (forecast / cap) * 100) : 0;
  const over = cap != null && forecast > cap;
  const dailyPace = dayOfMonth > 0 ? mtd / dayOfMonth : 0;
  const capDay = cap && dailyPace > 0 && mtd < cap ? Math.ceil((cap - mtd) / dailyPace + dayOfMonth) : null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      {head}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link to="/admin/dashboard" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Dashboard</Link>
            <h1 className="font-display text-2xl font-bold mt-1">Credits</h1>
            <p className="text-sm text-muted-foreground">AI credit spend, monthly budget and forecast.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load} aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
            <Button size="sm" asChild><a href={TOP_UP_URL} target="_blank" rel="noopener noreferrer"><Wallet className="w-4 h-4 mr-1.5" /> Top up credits <ExternalLink className="w-3 h-3 ml-1" /></a></Button>
          </div>
        </div>

        {err && <p className="text-sm text-loss">{err}</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Used this month", value: fmt(mtd), sub: `${(b?.requests_this_month ?? 0).toLocaleString()} AI requests` },
            { label: "Forecast for month", value: fmt(forecast), sub: `at current pace` },
            { label: "Last 7 days", value: fmt(b?.last_7_days ?? 0), sub: "credits" },
            { label: "Monthly cap", value: cap != null ? fmt(cap) : "None", sub: cap != null ? `${Math.round((mtd / cap) * 100)}% used` : "Set one below" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
              <div className="font-display font-bold text-2xl mt-2 tabular-nums">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
            </div>
          ))}
        </div>

        <section className={`rounded-xl border p-4 space-y-4 ${over ? "border-loss/50 bg-loss/10" : "border-border bg-card"}`}>
          <h2 className="font-display font-semibold flex items-center gap-2"><Gauge className="w-4 h-4 text-primary" /> Budget tracker</h2>
          {cap != null ? (
            <div className="space-y-2">
              <div className="relative h-3 rounded-full bg-secondary overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-primary/30" style={{ width: `${forecastPct}%` }} />
                <div className={`absolute inset-y-0 left-0 ${usedPct >= 100 ? "bg-loss" : "bg-primary"}`} style={{ width: `${usedPct}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">
                {fmt(mtd)} of {fmt(cap)} credits used. Forecast {fmt(forecast)} by month end —{" "}
                {over ? <span className="text-loss font-medium">on track to go over{capDay ? ` around day ${Math.min(capDay, daysInMonth)}` : ""}.</span> : <span className="text-gain font-medium">within budget.</span>}
              </p>
            </div>
          ) : <p className="text-sm text-muted-foreground">No cap set. Forecast this month: {fmt(forecast)} credits.</p>}

          <div className="flex items-end gap-3 flex-wrap">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Monthly cap (credits)</span>
              <Input type="number" min="0.01" step="0.01" value={capInput} onChange={(e) => { setCapInput(e.target.value); setSaved(false); }} placeholder="e.g. 5" className="w-36" />
            </label>
            <label className="flex items-center gap-2 text-sm pb-2">
              <Switch checked={autoLock} onCheckedChange={(v) => { setAutoLock(v); setSaved(false); }} />
              Pause AI automatically when the cap is reached
            </label>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : saved ? "Saved" : "Save"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Leave the cap empty to remove it. Auto-pause resets on the 1st of each month.</p>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-display font-semibold mb-3">This month, per day</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={b?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(8)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} width={40} />
                <Tooltip {...tip} formatter={(v: number) => [fmt(v), "credits"]} />
                <Bar dataKey="credits" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-display font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Players by AI credits</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {[7, 30, 90].map((d) => <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>{d}d</Button>)}
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={heavyOnly} onCheckedChange={setHeavyOnly} /> Heavy users only</label>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-3 mb-3 flex items-end gap-3 flex-wrap">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Monthly AI credits per player</span>
              <Input type="number" min="0.01" step="0.01" value={defAllow} onChange={(e) => setDefAllow(e.target.value)} placeholder="Unlimited" className="w-36" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">AI requests per player per day</span>
              <Input type="number" min="0" step="1" value={defDaily} onChange={(e) => setDefDaily(e.target.value)} placeholder="Unlimited" className="w-36" />
            </label>
            <Button size="sm" onClick={() => call({ set_default_allowance: defAllow.trim() === "" ? null : Number(defAllow), set_default_daily: defDaily.trim() === "" ? null : Number(defDaily) }, "Player limits saved.")}>Save</Button>
            <Button size="sm" variant="outline" asChild><Link to="/admin/players">All accounts</Link></Button>
            <p className="text-xs text-muted-foreground basis-full">Each player spends from their own monthly allowance and daily request limit; when either runs out, AI stops for that player only (monthly resets on the 1st, daily at midnight UTC). Leave empty for unlimited. Click a player's name to open their profile and set their own limits.</p>
            {msg && <p className="text-xs text-primary basis-full">{msg}</p>}
          </div>
          {pu && pu.players.length ? (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                {pu.players.length} players used {fmt(pu.total_credits)} credits in {pu.days} days · typical player {fmt(pu.median_credits)} ·{" "}
                <span className="text-loss">{pu.players.filter((p) => p.heavy).length} flagged heavy</span> (4× typical or 15%+ of all spend) ·{" "}
                <span className="text-loss">{pu.players.filter((p) => p.cap_day != null && p.cap_day - now.getUTCDate() <= 7).length} will run out within 7 days</span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-muted-foreground text-left">
                    <tr><th className="py-2 pr-3">Player</th><th className="pr-3 text-right">Credits</th><th className="pr-3 text-right">Share</th><th className="pr-3 text-right">Coach / Sandbox</th><th className="pr-3 text-right">Games</th><th className="pr-3 text-right">Per game</th><th className="pr-3 text-right">This month</th><th className="pr-3 text-right">Forecast</th><th className="pr-3 text-right">Runs out</th><th className="pr-3">Allowance</th><th className="text-right">Last used</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pu.players.filter((p) => !heavyOnly || p.heavy).map((p) => (
                      <tr key={p.id} className={p.heavy ? "bg-loss/10" : ""}>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1.5">
                            {p.heavy && <Flag className="w-3.5 h-3.5 text-loss" aria-label="Heavy user" />}
                            <Link to={`/admin/players/${encodeURIComponent(p.subject)}`} className="font-medium hover:text-primary underline-offset-2 hover:underline">{p.name ?? (p.guest ? "Guest" : "Player")}</Link>
                            <span className="text-[10px] rounded px-1 border border-border text-muted-foreground">{p.guest ? "guest" : "account"}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">{p.id}</div>
                        </td>
                        <td className="pr-3 text-right tabular-nums">{fmt(Number(p.credits))}</td>
                        <td className="pr-3 text-right tabular-nums">{p.share}%</td>
                        <td className="pr-3 text-right tabular-nums">{p.coach} / {p.sandbox}</td>
                        <td className="pr-3 text-right tabular-nums">{p.games ?? "—"}</td>
                        <td className="pr-3 text-right tabular-nums">{p.credits_per_game != null ? fmt(Number(p.credits_per_game)) : "—"}</td>
                        <td className="pr-3 text-right tabular-nums">{fmt(Number(p.month_credits))}{p.remaining != null && <div className="text-[10px] text-muted-foreground">{fmt(Number(p.remaining))} left</div>}</td>
                        <td className="pr-3 text-right tabular-nums">{fmt(Number(p.forecast))}</td>
                        <td className="pr-3 text-right text-xs">
                          {p.cap_day === 0 ? <span className="text-loss font-medium">Out</span>
                            : p.cap_day != null ? <span className={p.cap_day - now.getUTCDate() <= 7 ? "text-loss font-medium" : "text-foreground font-medium"}>{p.cap_day - now.getUTCDate() <= 7 && <Flag className="inline w-3 h-3 mr-0.5" />}Day {p.cap_day}</span>
                            : <span className="text-muted-foreground">{p.allowance != null ? "Not this month" : "No limit"}</span>}
                        </td>
                        <td className="pr-3">
                          <div className="flex items-center gap-1">
                            <Input type="number" min="0" step="0.01" className="h-7 w-20 text-xs" placeholder={pu.default_allowance != null ? String(pu.default_allowance) : "∞"}
                              value={edits[p.subject] ?? (p.custom_allowance && p.allowance != null ? String(p.allowance) : "")}
                              onChange={(e) => setEdits((x) => ({ ...x, [p.subject]: e.target.value }))} aria-label="Player allowance" />
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => call({ set_player_allowance: { subject: p.subject, allowance: (edits[p.subject] ?? "").trim() === "" ? null : Number(edits[p.subject]) } }, "Saved.")}>Set</Button>
                          </div>
                        </td>
                        <td className="text-right text-xs text-muted-foreground">{new Date(p.last_used).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Names and games are matched from now on; older guest requests can't be linked to a name or game, so they show "Guest" and "—".</p>
            </>
          ) : <p className="text-sm text-muted-foreground">No AI usage in this period.</p>}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-display font-semibold mb-3">Monthly usage</h2>
          {b?.months.length ? (
            <ul className="divide-y divide-border text-sm">
              {[...b.months].reverse().map((m) => (
                <li key={m.month} className="flex justify-between py-2"><span>{new Date(m.month + "-01T00:00:00Z").toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}</span><span className="tabular-nums text-muted-foreground">{m.requests.toLocaleString()} requests · {fmt(Number(m.credits))} credits</span></li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No AI usage yet.</p>}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-1">
          <div className="font-display font-semibold text-foreground">Total balance</div>
          <p>Your workspace credit balance isn't available to apps, so it can't be shown here live. Use <span className="text-foreground">Top up credits</span> to see your exact balance and buy more.</p>
          <p>Figures on this page are estimates from each AI request's measured size at list price; older requests use a typical cost.</p>
        </section>
      </div>
    </main>
  );
}
