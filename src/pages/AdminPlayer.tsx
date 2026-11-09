import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bot, Gamepad2, Trophy, Zap } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "admin_code_dashboard";

interface Profile {
  subject: string; guest: boolean; name: string | null; username: string | null; joined: string | null;
  games: number; best_value: number | null; month_credits: number; today_requests: number; total_requests: number;
  coach: number; sandbox: number; monthly_allowance: number | null; daily_requests: number | null;
  default_allowance: number | null; default_daily: number | null;
  daily: { day: string; credits: number }[];
  recent_games: { played_at: string; start_year: number; end_year: number; ending_value: number; return_pct: number; game_mode: string | null }[];
}

const fmt = (v: number) => (v < 1 ? Number(v).toFixed(3) : Number(v).toFixed(2));
const money = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${Math.round(v).toLocaleString()}`;
};
const tip = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" } };

export default function AdminPlayer() {
  const { subject = "" } = useParams();
  const code = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) ?? "" : "";
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [monthly, setMonthly] = useState("");
  const [daily, setDaily] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!code) return;
    const { data, error } = await supabase.functions.invoke("admin-dashboard", { headers: { "x-admin-code": code }, body: { player_profile: subject } });
    if (error || !data?.profile) { setErr("Couldn't load this player."); return; }
    const pr = data.profile as Profile;
    setP(pr);
    setMonthly(pr.monthly_allowance != null ? String(pr.monthly_allowance) : "");
    setDaily(pr.daily_requests != null ? String(pr.daily_requests) : "");
  }, [code, subject]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setMsg(null);
    const { error } = await supabase.functions.invoke("admin-dashboard", {
      headers: { "x-admin-code": code },
      body: { set_player_allowance: { subject, allowance: monthly.trim() === "" ? null : Number(monthly), daily: daily.trim() === "" ? null : Number(daily) } },
    });
    setSaving(false);
    setMsg(error ? "Couldn't save — use a number of 0 or more (whole number for daily)." : "Saved.");
    if (!error) load();
  };

  const head = <Helmet><title>Rise to Riches</title><meta name="robots" content="noindex,nofollow" /></Helmet>;
  if (!code) {
    return <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">{head}<Link to="/admin/dashboard" className="text-sm text-primary">Enter the dashboard password first</Link></main>;
  }

  const effMonthly = p?.monthly_allowance ?? p?.default_allowance ?? null;
  const effDaily = p?.daily_requests ?? p?.default_daily ?? null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      {head}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
        <div>
          <Link to="/admin/players" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Players</Link>
          <h1 className="font-display text-2xl font-bold mt-1">{p?.name ?? (p?.guest ? "Guest" : "Player")}</h1>
          <p className="text-sm text-muted-foreground">
            {p?.guest ? "Guest (no account)" : p?.username ? `@${p.username}` : "Account"}
            {p?.joined && ` · joined ${new Date(p.joined).toLocaleDateString()}`}
          </p>
        </div>
        {err && <p className="text-sm text-loss">{err}</p>}

        {p && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Gamepad2, label: "Games finished", value: p.games.toLocaleString() },
                { icon: Trophy, label: "Best result", value: p.best_value != null ? money(p.best_value) : "—" },
                { icon: Zap, label: "AI credits this month", value: fmt(p.month_credits), sub: effMonthly != null ? `of ${fmt(effMonthly)}` : "no cap" },
                { icon: Bot, label: "AI requests today", value: String(p.today_requests), sub: effDaily != null ? `of ${effDaily}` : "no limit" },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground"><c.icon className="w-3.5 h-3.5 text-primary" /> {c.label}</div>
                  <div className="font-display font-bold text-2xl mt-2 tabular-nums">{c.value}</div>
                  {c.sub && <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>}
                </div>
              ))}
            </div>

            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h2 className="font-display font-semibold">AI limits for this player</h2>
              <div className="flex items-end gap-3 flex-wrap">
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Monthly AI credits</span>
                  <Input type="number" min="0" step="0.01" value={monthly} onChange={(e) => setMonthly(e.target.value)} className="w-36"
                    placeholder={p.default_allowance != null ? `${p.default_allowance} (default)` : "Unlimited"} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">AI requests per day</span>
                  <Input type="number" min="0" step="1" value={daily} onChange={(e) => setDaily(e.target.value)} className="w-36"
                    placeholder={p.default_daily != null ? `${p.default_daily} (default)` : "Unlimited"} />
                </label>
                <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </div>
              <p className="text-xs text-muted-foreground">Leave a box empty to use the default for all players. Set 0 to block AI for this player.</p>
              {msg && <p className="text-xs text-primary">{msg}</p>}
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-display font-semibold mb-1">AI credits, last 30 days</h2>
              <p className="text-xs text-muted-foreground mb-3">{p.coach} AI Coach reviews · {p.sandbox} Sandbox events (90 days)</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={p.daily}>
                    <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} width={40} />
                    <Tooltip {...tip} formatter={(v: number) => [fmt(v), "credits"]} />
                    <Bar dataKey="credits" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-display font-semibold mb-3">Recent games</h2>
              {p.recent_games.length ? (
                <ul className="divide-y divide-border text-sm">
                  {p.recent_games.map((g, i) => (
                    <li key={i} className="flex justify-between py-2 gap-3">
                      <span>{g.start_year}–{g.end_year} <span className="text-xs text-muted-foreground capitalize">{g.game_mode ?? ""}</span></span>
                      <span className="tabular-nums">{money(Number(g.ending_value))} <span className={Number(g.return_pct) >= 0 ? "text-gain" : "text-loss"}>{Number(g.return_pct) >= 0 ? "+" : ""}{Number(g.return_pct).toLocaleString()}%</span></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No finished games linked to this player.</p>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
