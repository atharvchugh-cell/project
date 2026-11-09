import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Lock, RefreshCw, Sparkles, ShieldAlert, Users, Database, Coins } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "admin_code_suggestions";
const RANGES = [7, 14, 30, 90] as const;

interface Summary {
  days: number;
  totals: {
    requests: number; guest_requests: number; user_requests: number; unique_players: number; blocked: number; today: number; cached_answers: number;
    est_credits: number; est_credits_today: number; input_tokens: number; output_tokens: number; measured_requests: number;
  };
  daily: { day: string; coach: number; sandbox: number; blocked: number; credits: number }[];
  by_kind: Record<string, number>;
  block_reasons: Record<string, number>;
  top_players: { id: string; guest: boolean; requests: number; last_used: string }[];
}

const REASON_LABEL: Record<string, string> = {
  minute: "Per-minute limit", hour: "Hourly limit", day: "Daily limit", month: "Monthly limit",
  ip_minute: "Shared network (minute)", ip_day: "Shared network (day)", invalid: "Invalid", unknown: "Other",
};

async function fetchSummary(code: string, days: number) {
  return supabase.functions.invoke("admin-ai-usage", { headers: { "x-admin-code": code }, body: { days } });
}

export default function AdminAiUsage({ embeddedCode }: { embeddedCode?: string } = {}) {
  const [code, setCode] = useState<string>(() => embeddedCode ?? sessionStorage.getItem(STORAGE_KEY) ?? "");
  const [input, setInput] = useState("");
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (c: string, d: number) => {
    setLoading(true);
    setErr(null);
    const { data: res, error } = await fetchSummary(c, d);
    setLoading(false);
    if (error) {
      setErr("That code wasn't accepted, or the summary couldn't load.");
      setData(null);
      return false;
    }
    setData(res as Summary);
    return true;
  }, []);

  useEffect(() => { if (code) load(code, days); }, [code, days, load]);

  const head = (
    <Helmet>
      <title>Admin — AI usage — Rise to Riches</title>
      <meta name="robots" content="noindex,nofollow" />
    </Helmet>
  );

  if (!code || (!data && err)) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        {head}
        <form
          className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await load(input, days)) { sessionStorage.setItem(STORAGE_KEY, input); setCode(input); }
          }}
        >
          <div className="flex items-center gap-2 font-display font-semibold"><Lock className="w-4 h-4 text-primary" /> AI usage — admin</div>
          <Input type="password" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Admin code" aria-label="Admin code" />
          {err && <p className="text-xs text-loss">{err}</p>}
          <Button type="submit" className="w-full" disabled={!input || loading}>Unlock</Button>
        </form>
      </main>
    );
  }

  const t = data?.totals;
  const cards = t ? [
    { icon: Coins, label: "Est. credits used", value: t.est_credits < 1 ? t.est_credits.toFixed(3) : t.est_credits.toFixed(2), sub: `${t.est_credits_today < 1 ? t.est_credits_today.toFixed(3) : t.est_credits_today.toFixed(2)} today · estimate at list price` },
    { icon: Sparkles, label: "AI requests", value: t.requests.toLocaleString(), sub: `${t.today} today` },
    { icon: Users, label: "Players using AI", value: t.unique_players.toLocaleString(), sub: `${t.user_requests} signed-in · ${t.guest_requests} guest` },
    { icon: ShieldAlert, label: "Blocked by limits", value: t.blocked.toLocaleString(), sub: t.requests + t.blocked ? `${Math.round((t.blocked / (t.requests + t.blocked)) * 100)}% of attempts` : "—" },
    { icon: Database, label: "Answers saved for reuse", value: t.cached_answers.toLocaleString(), sub: "Repeats served free" },
  ] : [];

  return (
    <main className={embeddedCode ? "text-foreground" : "min-h-screen bg-background text-foreground"}>
      {!embeddedCode && head}
      <div className={embeddedCode ? "space-y-6" : "max-w-6xl mx-auto px-4 py-8 space-y-6"}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            {!embeddedCode && <Link to="/admin/suggestions" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Suggestions</Link>}
            <h1 className="font-display text-2xl font-bold mt-1">AI usage</h1>
            <p className="text-sm text-muted-foreground">AI Coach and Sandbox event requests, and how often limits kicked in.</p>
          </div>
          <div className="flex items-center gap-2">
            {RANGES.map((r) => (
              <Button key={r} size="sm" variant={days === r ? "default" : "outline"} onClick={() => setDays(r)}>{r}d</Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => load(code, days)} aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground"><c.icon className="w-3.5 h-3.5 text-primary" /> {c.label}</div>
              <div className="font-display font-bold text-2xl mt-2 tabular-nums">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
            </div>
          ))}
        </div>

        {t && (
          <p className="text-xs text-muted-foreground">
            Credit figures are estimates at provider list prices. {t.measured_requests.toLocaleString()} of {t.requests.toLocaleString()} requests in this period are measured from real token counts;
            older requests use a typical per-feature cost, so past days are approximate.
            Tokens (measured): {(t.input_tokens / 1000).toFixed(0)}k in · {(t.output_tokens / 1000).toFixed(0)}k out.
          </p>
        )}

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-display font-semibold mb-3">Requests per day</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="coach" name="AI Coach" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="sandbox" name="Sandbox events" stackId="a" fill="hsl(var(--accent))" />
                <Bar dataKey="blocked" name="Blocked" fill="hsl(var(--loss))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-display font-semibold mb-3">Estimated credits per day</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v: number) => v.toFixed(3)} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => [Number(v).toFixed(4), "Est. credits"]} />
                <Bar dataKey="credits" name="Est. credits" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-display font-semibold mb-3">Why requests were blocked</h2>
            {data && Object.keys(data.block_reasons).length ? (
              <ul className="space-y-2 text-sm">
                {Object.entries(data.block_reasons).sort((a, b) => b[1] - a[1]).map(([r, n]) => (
                  <li key={r} className="flex justify-between"><span>{REASON_LABEL[r] ?? r}</span><span className="tabular-nums text-muted-foreground">{n}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No blocked requests in this period.</p>}
          </section>
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-display font-semibold mb-1">Heaviest users</h2>
            <p className="text-xs text-muted-foreground mb-3">Shown by a short anonymous ID only.</p>
            {data?.top_players.length ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground"><tr><th className="text-left font-normal">ID</th><th className="text-left font-normal">Type</th><th className="text-right font-normal">Requests</th><th className="text-right font-normal">Last used</th></tr></thead>
                <tbody>
                  {data.top_players.map((p) => (
                    <tr key={p.id + p.guest} className="border-t border-border/50">
                      <td className="py-1.5 font-mono">{p.id}</td>
                      <td>{p.guest ? "Guest" : "Signed in"}</td>
                      <td className="text-right tabular-nums">{p.requests}</td>
                      <td className="text-right text-muted-foreground">{new Date(p.last_used).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm text-muted-foreground">No AI requests in this period.</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
