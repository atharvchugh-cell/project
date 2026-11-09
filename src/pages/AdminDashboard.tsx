import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, AlertTriangle, ArrowDownToLine, ArrowUpRight, CheckCircle2, Gamepad2, GraduationCap, Lock, LogIn, RefreshCw, Search, ShieldCheck, Sparkles, Timer, TrendingUp, UserPlus, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip as Hint, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AdminDashboardShell } from "@/components/admin/AdminDashboardShell";
import { AdminBreakdown } from "@/components/admin/AdminBreakdown";
import { adminInsights, adminMoney, adminPercent, downloadDashboardCsv, type PlayerStats } from "@/lib/adminDashboard";
import AdminAiUsage from "./AdminAiUsage";
import { useAdminPolling } from "@/hooks/useAdminPolling";

const STORAGE_KEY = "admin_code_dashboard";
const RANGES = [7, 14, 30, 90] as const;
const tip = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", borderRadius: 8 } };

export default function AdminDashboard() {
  const [code, setCode] = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? "");
  const [input, setInput] = useState("");
  const [params, setParams] = useSearchParams();
  const days = RANGES.find(r => String(r) === params.get("days")) ?? 30;
  const tab = params.get("view") === "ai" ? "ai" : "players";
  const [data, setData] = useState<PlayerStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLocked, setAiLocked] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [controlErr, setControlErr] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activityView, setActivityView] = useState<"players" | "games">("players");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");
  const requestId = useRef(0);
  const currentData = useRef<PlayerStats | null>(null);
  const aiMutation = useRef(false);
  const reportInFlight = useRef(false);
  const lastReport = useRef<{ code: string; days: number } | null>(null);
  const updateParams = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => next.set(key, value));
    setParams(next);
  };

  const load = useCallback(async (c: string, d: number) => {
    if (aiMutation.current || reportInFlight.current) return false;
    reportInFlight.current = true;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("admin-dashboard", { headers: { "x-admin-code": c }, body: { days: d } });
      if (id !== requestId.current) return false;
      if (error || !res?.players) {
        setErr(currentData.current ? "Couldn't refresh. Showing the last successful update." : "Couldn't open the dashboard. Check your password or try again.");
        return false;
      }
      currentData.current = res.players as PlayerStats;
      lastReport.current = { code: c, days: d };
      setData(currentData.current);
      setAiLocked(!!res.ai_locked);
      setLastSync(new Date());
      setErr(null);
      return true;
    } catch {
      if (id === requestId.current) setErr("Couldn't connect. Try again.");
      return false;
    } finally { reportInFlight.current = false; if (id === requestId.current) setLoading(false); }
  }, []);

  const [pending, setPending] = useState<number | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayMsg, setReplayMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!code) return;
    supabase.functions.invoke("admin-dashboard", { headers: { "x-admin-code": code }, body: { pending_summary: true } })
      .then(({ data: r }) => { if (typeof r?.pending === "number") setPending(r.pending); }).catch(() => {});
  }, [code]);
  const replayOldGames = async () => {
    setReplaying(true); setReplayMsg(null);
    try {
      const { data: r, error } = await supabase.functions.invoke("admin-dashboard", { headers: { "x-admin-code": code }, body: { reprocess_pending: true } });
      if (error || typeof r?.saved !== "number") setReplayMsg("Couldn't re-update games. Try again once saving works.");
      else {
        setPending(r.remaining);
        setReplayMsg(`${r.saved} saved to the leaderboard${r.rejected ? `, ${r.rejected} didn't qualify` : ""}${r.failed ? `, ${r.failed} still waiting` : ""}.`);
        void load(code, days);
      }
    } catch { setReplayMsg("Couldn't re-update games. Try again once saving works."); }
    finally { setReplaying(false); }
  };

  const toggleAi = async () => {
    aiMutation.current = true;
    ++requestId.current;
    setLoading(false);
    setToggling(true); setControlErr(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("admin-dashboard", { headers: { "x-admin-code": code }, body: { set_ai_locked: !aiLocked } });
      if (!error && typeof res?.ai_locked === "boolean") setAiLocked(res.ai_locked);
      else setControlErr("AI access wasn't changed. Please try again.");
    } catch { setControlErr("AI access wasn't changed. Please try again."); }
    finally { aiMutation.current = false; setToggling(false); }
  };

  useEffect(() => {
    if (!code) return;
    if (lastReport.current?.code === code && lastReport.current.days === days) return;
    void load(code, days);
  }, [code, days, load]);

  useAdminPolling(!!code && autoRefresh && tab === "players", () => load(code, days));

  const insights = useMemo(() => data ? adminInsights(data) : [], [data]);
  const recent = useMemo(() => (data?.recent ?? []).filter(r => {
    const type = r.is_multiplayer ? "group" : r.game_mode === "complex" ? "advanced" : "basic";
    return (mode === "all" || mode === type) && (r.display_name ?? "Guest").toLowerCase().includes(query.trim().toLowerCase());
  }), [data, query, mode]);

  const head = <Helmet><title>Admin Dashboard — Rise to Riches</title><meta name="robots" content="noindex,nofollow" /></Helmet>;
  if (!code || (!data && err)) return <main className="admin-dashboard-scope flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
    {head}<Helmet><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600&display=swap" /></Helmet>
    <form className="w-full max-w-sm space-y-5 rounded-lg border border-border bg-card p-8" onSubmit={async e => {
      e.preventDefault(); if (await load(input, days)) { sessionStorage.setItem(STORAGE_KEY, input); setCode(input); }
    }}>
      <ShieldCheck className="h-8 w-8 text-primary" /><div><h1 className="text-xl font-semibold">Admin workspace</h1><p className="mt-1 text-sm text-muted-foreground">Rise to Riches</p></div>
      <label className="block text-sm" htmlFor="dashboard-password">Password</label>
      <Input id="dashboard-password" type="password" autoFocus autoComplete="current-password" value={input} onChange={e => setInput(e.target.value)} />
      {err && <p role="alert" className="text-sm text-loss">{err}</p>}
      <Button type="submit" className="w-full" disabled={!input || loading}>{loading ? "Checking…" : "Enter"}<ArrowUpRight /></Button>
      <Link to="/" className="block text-center text-sm text-muted-foreground hover:text-primary">Back to game</Link>
    </form>
  </main>;

  const t = data?.totals;
  const cards = t ? [
    { icon: Users, label: "Players", value: t.players.toLocaleString(), sub: `${t.today_players.toLocaleString()} today`, accent: false },
    { icon: Gamepad2, label: "Games finished", value: t.completed.toLocaleString(), sub: `${t.all_time_completed.toLocaleString()} all-time`, accent: false },
    { icon: CheckCircle2, label: "Completion rate", value: adminPercent(t.completed, t.events), sub: `${t.completed.toLocaleString()} of ${t.events.toLocaleString()} game records`, accent: false },
    { icon: LogIn, label: "Sign-in rate", value: adminPercent(t.signed_in_players, t.players), sub: `${t.signed_in_players.toLocaleString()} signed-in players`, accent: true },
  ] : [];
  const secondary = t ? [
    { icon: UserPlus, label: "New accounts", value: t.accounts_new.toLocaleString(), sub: `${t.accounts_total} total` },
    { icon: Activity, label: "Group games", value: t.multiplayer_runs.toLocaleString(), sub: `${adminPercent(t.multiplayer_runs, t.completed)} of finished games` },
    { icon: Timer, label: "Avg. game time", value: t.avg_minutes != null ? `${t.avg_minutes}m` : "—", sub: "Finished games" },
    { icon: TrendingUp, label: "Median return", value: t.median_return != null ? `${t.median_return.toLocaleString()}%` : "—", sub: "Finished games" },
  ] : [];
  const f = data?.funnel;

  return <AdminDashboardShell tab={tab} onTab={view => updateParams({ view })} lastSync={lastSync} aiLocked={aiLocked} onLock={() => {
    ++requestId.current; sessionStorage.removeItem(STORAGE_KEY); setCode(""); setData(null); currentData.current = null; lastReport.current = null; setLastSync(null); setErr(null);
  }}>
    {head}
    {tab === "players" && <header className="flex flex-wrap items-center justify-between gap-5">
      <div><h1 className="text-3xl font-semibold lg:text-4xl">Dashboard</h1><p className="mt-2 text-sm text-muted-foreground">Player activity, sign-ins, and game completion.</p></div>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1.5" aria-label="Reporting period">
        {RANGES.map(r => <Button key={r} variant={days === r ? "default" : "ghost"} size="sm" aria-pressed={days === r} disabled={loading} onClick={() => updateParams({ days: String(r) })}>{r}d</Button>)}
      </div>
    </header>}
    <section className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
      <div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Sparkles className="h-6 w-6" /></span>
        <div><h2 className="text-base font-semibold">AI features: <span className={aiLocked ? "text-accent" : "text-primary"}>{aiLocked ? "Paused" : "Active"}</span></h2>
          <p className="mt-1 text-xs text-muted-foreground">{aiLocked ? "AI Coach and Sandbox events are paused for everyone." : "AI Coach and Sandbox events are available, subject to player limits."}</p>
          {controlErr && <p className="mt-1 text-sm text-loss" role="alert">{controlErr}</p>}
        </div>
      </div>
      <Button variant="outline" disabled={toggling} className={aiLocked ? "border-primary/30 text-primary" : "border-loss/30 bg-loss/10 text-loss hover:bg-loss/20"} onClick={toggleAi}><Lock />{toggling ? "Saving…" : aiLocked ? "Unlock AI" : "Lock AI"}</Button>
    </section>
    <section className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
      <div><h2 className="text-base font-semibold">Unsaved games</h2>
        <p className="mt-1 text-xs text-muted-foreground">{pending == null ? "Checking…" : `${pending.toLocaleString()} finished game${pending === 1 ? "" : "s"} waiting to be saved · kept for 60 days`}</p>
        {replayMsg && <p className="mt-1 text-sm" role="status">{replayMsg}</p>}
      </div>
      <Button variant="outline" disabled={replaying || !pending} onClick={replayOldGames}><RefreshCw className={replaying ? "animate-spin" : ""} />{replaying ? "Re-updating…" : "Re-update old games"}</Button>
    </section>
    {tab === "ai" ? <AdminAiUsage embeddedCode={code} /> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{data ? `Last ${days} days · players who started a game` : "Loading player activity…"}</span>
        <div className="flex items-center gap-3"><label className="flex items-center gap-2"><Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} aria-label="Auto-refresh every 15 minutes" />Auto-refresh · 15 min</label>
          <Hint><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Refresh dashboard" disabled={loading} onClick={() => load(code, days)}><RefreshCw className={loading ? "animate-spin" : ""} /></Button></TooltipTrigger><TooltipContent>Refresh dashboard</TooltipContent></Hint>
          <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="outline" className="h-9 w-9" aria-label="Export report" disabled={!data || loading}><ArrowDownToLine /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            {([['summary', 'Summary report'], ['daily', 'Daily activity'], ['games', 'Latest games']] as const).map(([section, label]) => <DropdownMenuItem key={section} onSelect={() => { if (data) downloadDashboardCsv(data, section, days); }}>{label} (CSV)</DropdownMenuItem>)}
          </DropdownMenuContent></DropdownMenu>
        </div>
      </div>
      {err && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-accent" />{err}</span><Button size="sm" variant="outline" onClick={() => load(code, days)}>Retry</Button></div>}
      {!data ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Loading statistics">{[0, 1, 2, 3].map(i => <div key={i} className="h-40 animate-pulse rounded-lg bg-card" />)}</div> : <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map(c => <article key={c.label} className="admin-metric min-w-0 rounded-lg border border-border bg-card p-4 lg:p-6">
            <div className="mb-5 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{c.label}</span><c.icon className={c.accent ? "h-4 w-4 shrink-0 text-accent" : "h-4 w-4 shrink-0 text-primary"} /></div>
            <div className={`admin-heading break-words text-2xl font-semibold tabular-nums lg:text-3xl ${c.accent ? "text-accent" : "text-foreground"}`}>{c.value}</div>
            <div className="mt-3 text-xs leading-relaxed text-muted-foreground">{c.sub}</div>
          </article>)}
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-3">
          <div className="min-w-0 space-y-8 xl:col-span-2">
            <section className="border-t border-border pt-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Daily activity</h2><div className="flex rounded-lg border border-border p-1">
                <Button size="sm" variant={activityView === "players" ? "secondary" : "ghost"} aria-pressed={activityView === "players"} onClick={() => setActivityView("players")}>Players</Button>
                <Button size="sm" variant={activityView === "games" ? "secondary" : "ghost"} aria-pressed={activityView === "games"} onClick={() => setActivityView("games")}>Games</Button>
              </div></div>
              {data.daily.length ? <div className="h-72 w-full" role="img" aria-label={activityView === "players" ? "Daily players and signed-in players" : "Daily game records, finished games and new accounts"}>
                <ResponsiveContainer width="100%" height="100%">
                  {activityView === "players" ? <AreaChart data={data.daily} margin={{ top: 8, right: 10, left: -24, bottom: 0 }}>
                    <defs><linearGradient id="admin-activity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tickFormatter={d => String(d).slice(5, 10)} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="players" name="Players" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#admin-activity-fill)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="signed_in" name="Signed in" stroke="hsl(var(--accent))" strokeWidth={2} fill="none" isAnimationActive={false} />
                  </AreaChart> : <BarChart data={data.daily} margin={{ top: 8, right: 10, left: -24, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tickFormatter={d => String(d).slice(5, 10)} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="events" name="Game records" fill="hsl(var(--muted-foreground) / 0.4)" isAnimationActive={false} />
                    <Bar dataKey="completed" name="Finished" fill="hsl(var(--primary))" isAnimationActive={false} />
                    <Bar dataKey="signups" name="New accounts" fill="hsl(var(--accent))" isAnimationActive={false} />
                  </BarChart>}
                </ResponsiveContainer>
              </div> : <p className="py-16 text-center text-sm text-muted-foreground">No activity in this period.</p>}
            </section>
            {f && <section className="border-t border-border pt-6">
              <h2 className="mb-6 text-xl font-semibold">Player conversion</h2>
              <div className="grid grid-cols-3 gap-4">
                {[{ label: "Played", value: f.visitors }, { label: "Signed in", value: f.signed_in }, { label: "Finished", value: f.completed }].map(item => <div key={item.label} className="min-w-0 space-y-3">
                  <div className="text-xs text-muted-foreground">{item.label}</div><div className="admin-heading text-xl font-semibold tabular-nums lg:text-2xl">{item.value.toLocaleString()}</div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${f.visitors ? Math.min(100, item.value / f.visitors * 100) : 0}%` }} /></div>
                  <div className="text-xs text-muted-foreground">{adminPercent(item.value, f.visitors)} of players</div>
                </div>)}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Sign-in and completion are separate outcomes; guests can finish games.</p>
              <div className="mt-6 border-t border-border pt-5"><h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><GraduationCap className="h-4 w-4 text-accent" />Tutorial outcomes</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[{ label: "Started", value: f.tutorial_started, note: "Tracked starts" }, { label: "Finished", value: f.tutorial_completed, note: adminPercent(f.tutorial_completed, f.tutorial_started) + " of starts" }, { label: "Abandoned", value: f.tutorial_abandoned, note: adminPercent(f.tutorial_abandoned, f.tutorial_started) + " of starts" }].map(item => <div key={item.label}><p className="text-xs text-muted-foreground">{item.label}</p><p className="my-2 text-xl font-semibold tabular-nums">{item.value.toLocaleString()}</p><p className="text-xs text-muted-foreground">{item.note}</p></div>)}
                </div>
              </div>
            </section>}
          </div>
          <aside className="min-w-0 space-y-8" aria-label="Activity breakdowns and insights">
            <AdminBreakdown title="Device distribution" data={data.by_device} />
            <AdminBreakdown title="Mode distribution · finished games" data={data.by_mode} label={k => k === "complex" ? "Advanced" : k === "normal" ? "Basic" : k} />
            <section className="border-t border-primary/30 pt-6"><h2 className="mb-5 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />Period insights</h2>
              {insights.length ? <ul className="space-y-5">{insights.map(item => <li key={item.title}><p className={`text-sm font-semibold ${item.warning ? "text-accent" : "text-foreground"}`}>{item.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">Insights appear when player activity is recorded.</p>}
              <Button className="mt-6 w-full" variant="secondary" onClick={() => downloadDashboardCsv(data, "summary", days)} disabled={loading}><ArrowDownToLine />Download report</Button>
            </section>
          </aside>
        </div>
        <section className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-6 lg:grid-cols-4">
          {secondary.map(c => <div key={c.label} className="min-w-0"><p className="flex items-center gap-2 text-xs text-muted-foreground"><c.icon className="h-4 w-4 shrink-0 text-primary" />{c.label}</p><p className="admin-heading my-2 break-words text-xl font-semibold tabular-nums">{c.value}</p><p className="text-xs text-muted-foreground">{c.sub}</p></div>)}
        </section>
        <div className="grid gap-8 lg:grid-cols-3"><AdminBreakdown title="Game length · finished games" data={data.by_length} label={k => `${k} years`} /><section className="border-t border-border pt-6 lg:col-span-2">
          <h2 className="mb-5 text-sm font-semibold">Manage your workspace</h2><div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild><Link to="/admin/players"><Users />Player limits<ArrowUpRight /></Link></Button>
            <Button variant="outline" asChild><Link to="/admin/credits"><TrendingUp />Budget & forecasts<ArrowUpRight /></Link></Button>
            <Button variant="outline" asChild><Link to="/admin/suggestions">Suggestions<ArrowUpRight /></Link></Button>
          </div>
        </section></div>
        <section className="border-t border-border pt-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Latest finished games</h2><p className="mt-1 text-xs text-muted-foreground">{recent.length} of {data.recent.length} recent records · selected period</p></div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto"><div className="relative min-w-0 flex-1 sm:w-48"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search player" aria-label="Search recent players" className="h-10 pl-9" /></div>
              <Select value={mode} onValueChange={setMode}><SelectTrigger className="h-10 w-36" aria-label="Filter recent game mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All modes</SelectItem><SelectItem value="basic">Basic</SelectItem><SelectItem value="advanced">Advanced</SelectItem><SelectItem value="group">Group</SelectItem></SelectContent></Select>
            </div>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-3 font-normal">Player</th><th className="font-normal">Played at</th><th className="font-normal">Years</th><th className="font-normal">Mode</th><th className="text-right font-normal">Final value</th><th className="text-right font-normal">Return</th></tr></thead><tbody>
            {recent.map((r, i) => <tr key={`${r.played_at}-${i}`} className="border-b border-border/60 hover:bg-card/50"><td className="py-4 font-medium">{r.display_name ?? "Guest"}{r.signed_in && <span className="ml-2 text-xs text-primary">Account</span>}</td><td className="text-xs text-muted-foreground">{new Date(r.played_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td><td className="tabular-nums">{r.start_year}–{r.end_year}</td><td>{r.is_multiplayer ? "Group" : r.game_mode === "complex" ? "Advanced" : "Basic"}</td><td className="text-right tabular-nums">{adminMoney(Number(r.ending_value))}</td><td className={`text-right tabular-nums ${Number(r.return_pct) >= 0 ? "text-gain" : "text-loss"}`}>{Number(r.return_pct).toLocaleString(undefined, { maximumFractionDigits: 1 })}%</td></tr>)}
            {!recent.length && <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">{data.recent.length ? "No games match your filters." : "No finished games in this period."}</td></tr>}
          </tbody></table></div>
        </section>
      </>}
    </>}
  </AdminDashboardShell>;
}
