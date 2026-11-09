import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSessionId } from "@/lib/analytics";
import { clearDeviceGameData } from "@/lib/privacy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Award, BarChart3, Clock, Flame, Lock, Target, TrendingDown, TrendingUp, Trophy, Users } from "lucide-react";

interface Run {
  id: string; played_at: string; game_mode: string | null; start_year: number | null; end_year: number | null;
  ending_value: number | null; return_pct: number | null; is_multiplayer: boolean | null; trace_id: string | null;
}

const money = (v: number | null) => {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e15) return `$${(v / 1e15).toFixed(2)}Q`;
  if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${Math.round(v).toLocaleString()}`;
};
const pct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`);
const modeLabel = (m: string | null) => (m === "complex" ? "Advanced" : m === "hard" ? "Hard" : "Basic");

export default function Account() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate("/auth", { replace: true }); }, [loading, user, navigate]);

  const loadRuns = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_runs" as never, { p_limit: 200 } as never);
    if (error) setErr("Couldn't load your games. Try again.");
    else { setErr(null); setRuns((data as unknown as Run[]) ?? []); }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadRuns();
    supabase.from("profiles" as never).select("username, display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        const p = data as { username: string | null; display_name: string | null } | null;
        setUsername(p?.username ?? ""); setDisplayName(p?.display_name ?? "");
      });
  }, [user, loadRuns]);

  const stats = useMemo(() => {
    if (!runs?.length) return null;
    const withRet = runs.filter(r => r.return_pct != null);
    const rets = withRet.map(r => Number(r.return_pct));
    const sorted = [...rets].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    const avg = rets.length ? rets.reduce((s, v) => s + v, 0) / rets.length : null;
    const best = runs.reduce((b, r) => (Number(r.ending_value ?? 0) > Number(b.ending_value ?? 0) ? r : b), runs[0]);
    const bestRet = withRet.length ? withRet.reduce((b, r) => (Number(r.return_pct) > Number(b.return_pct) ? r : b)) : null;
    const worstRet = withRet.length ? withRet.reduce((b, r) => (Number(r.return_pct) < Number(b.return_pct) ? r : b)) : null;
    const wins = rets.filter(v => v > 0).length;
    const yearsPlayed = runs.reduce((s, r) => s + Math.max(0, (r.end_year ?? 0) - (r.start_year ?? 0)), 0);
    const group = runs.filter(r => r.is_multiplayer).length;
    const advanced = runs.filter(r => r.game_mode === "complex").length;
    // Streak of consecutive profitable games, newest first (runs are newest-first).
    let streak = 0; for (const r of runs) { if (Number(r.return_pct) > 0) streak++; else break; }
    let bestStreak = 0, cur = 0;
    for (const r of [...runs].reverse()) { if (Number(r.return_pct) > 0) { cur++; bestStreak = Math.max(bestStreak, cur); } else cur = 0; }
    const trend = [...runs].reverse().slice(-30).map((r, i) => ({ n: i + 1, ret: Number(r.return_pct ?? 0), label: `${r.start_year}–${r.end_year}` }));
    const buckets = [
      { name: "Loss", test: (v: number) => v <= 0 },
      { name: "0–100%", test: (v: number) => v > 0 && v <= 100 },
      { name: "100–500%", test: (v: number) => v > 100 && v <= 500 },
      { name: "500–2k%", test: (v: number) => v > 500 && v <= 2000 },
      { name: "2k%+", test: (v: number) => v > 2000 },
    ].map(b => ({ name: b.name, count: rets.filter(b.test).length }));
    const eraMap = new Map<string, { n: number; sum: number }>();
    for (const r of withRet) {
      const d = r.start_year ? `${Math.floor(r.start_year / 10) * 10}s` : "?";
      const e = eraMap.get(d) ?? { n: 0, sum: 0 }; e.n++; e.sum += Number(r.return_pct); eraMap.set(d, e);
    }
    const eras = [...eraMap.entries()].sort().map(([era, e]) => ({ era, avg: e.sum / e.n, n: e.n }));
    const badges = [
      { name: "First game", desc: "Finish a game", got: runs.length >= 1 },
      { name: "Regular", desc: "Finish 10 games", got: runs.length >= 10 },
      { name: "Veteran", desc: "Finish 50 games", got: runs.length >= 50 },
      { name: "Millionaire", desc: "End with $1M+", got: Number(best.ending_value) >= 1e6 },
      { name: "Billionaire", desc: "End with $1B+", got: Number(best.ending_value) >= 1e9 },
      { name: "Tenbagger", desc: "Return 1,000%+", got: rets.some(v => v >= 1000) },
      { name: "Hot streak", desc: "3 profitable games in a row", got: bestStreak >= 3 },
      { name: "Team player", desc: "Finish a group game", got: group > 0 },
      { name: "Advanced trader", desc: "Finish an Advanced game", got: advanced > 0 },
      { name: "Time traveller", desc: "Play 100 simulated years", got: yearsPlayed >= 100 },
    ];
    return { games: runs.length, median, avg, best, bestRet, worstRet, winRate: withRet.length ? Math.round((wins / withRet.length) * 100) : null,
      yearsPlayed, group, advanced, streak, bestStreak, trend, buckets, eras, badges };
  }, [runs]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const u = username.trim().toLowerCase();
    if (u && !/^[a-z0-9_]{3,20}$/.test(u)) { setProfileMsg("Username: 3–20 letters, numbers or _"); return; }
    const { error } = await supabase.from("profiles" as never)
      .upsert({ id: user.id, username: u || null, display_name: displayName.trim().slice(0, 32) || null } as never);
    setProfileMsg(error ? (error.code === "23505" ? "That username is taken." : "Couldn't save. Try again.") : "Saved.");
  };

  const importDevice = async () => {
    setImportMsg("Importing…");
    const { data, error } = await supabase.rpc("claim_device_runs" as never, { p_session_id: getSessionId() } as never);
    if (error) { setImportMsg("Import failed. Try again."); return; }
    const n = Number(data ?? 0);
    setImportMsg(n ? `Added ${n} game${n === 1 ? "" : "s"} from this device.` : "No other games from this device to add.");
    loadRuns();
  };

  const [dataMsg, setDataMsg] = useState('');
  const [deletingRun, setDeletingRun] = useState<string | null>(null);
  const removeRun = async (id: string) => {
    if (deletingRun || !confirm('Permanently delete this run and challenges created from it? This cannot be undone.')) return;
    setDeletingRun(id);
    const { data, error } = await supabase.rpc('delete_my_run', { p_run_id: id });
    setDeletingRun(null);
    if (error || data !== true) { setDataMsg('Could not delete that run. Try again.'); return; }
    setRuns(current => current?.filter(run => run.id !== id) ?? null);
    setDataMsg('Run and its source challenges deleted.');
  };
  const exportData = async () => {
    const { data, error } = await supabase.rpc('export_my_data');
    if (error) { setDataMsg('Export failed. Try again.'); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'rise-to-riches-personal-data.json'; a.click(); URL.revokeObjectURL(url);
    setDataMsg('Exported profile, owned runs and linked AI usage. Other records need a verified contact request.');
  };
  if (!user) return null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Your account — Rise to Riches</title>
        <meta name="description" content="Your Rise to Riches stats, game history, achievements and profile settings." />
        <meta name="robots" content="noindex,follow" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Your account — Rise to Riches" />
        <meta property="og:description" content="Your Rise to Riches stats, game history, achievements and profile settings." />
        <meta property="og:url" content="https://investmentsimulator.app/account" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Your account — Rise to Riches" />
        <meta name="twitter:description" content="Your Rise to Riches stats, game history, achievements and profile settings." />
      </Helmet>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="font-editorial text-xl font-semibold">Rise to <span className="text-primary">Riches</span></Link>
          <div className="flex gap-2">
            <Button asChild size="sm"><Link to="/">Play</Link></Button>
            <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}>Sign out</Button>
          </div>
        </div>

        <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6 md:p-8">
          <p className="text-xs uppercase tracking-widest text-primary">Your investor profile</p>
          <h1 className="font-editorial text-3xl md:text-4xl font-semibold mt-1">{displayName || user.email?.split("@")[0]}</h1>
          <p className="text-sm text-muted-foreground">{username ? `@${username} · ` : ""}{user.email}</p>
          {stats && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><div className="text-xs text-muted-foreground">Best final value</div><div className="text-2xl md:text-3xl font-semibold tabular-nums text-primary truncate">{money(Number(stats.best.ending_value))}</div></div>
              <div><div className="text-xs text-muted-foreground">Games finished</div><div className="text-2xl md:text-3xl font-semibold tabular-nums">{stats.games}</div></div>
              <div><div className="text-xs text-muted-foreground">Games in profit</div><div className="text-2xl md:text-3xl font-semibold tabular-nums">{stats.winRate ?? "—"}%</div></div>
              <div><div className="text-xs text-muted-foreground">Current streak</div><div className="text-2xl md:text-3xl font-semibold tabular-nums flex items-center gap-1"><Flame className="h-6 w-6 text-accent" />{stats.streak}</div></div>
            </div>
          )}
        </header>

        {stats && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="More stats">
              {[
                ["Typical return", pct(stats.median), TrendingUp],
                ["Average return", pct(stats.avg), BarChart3],
                ["Best return", pct(stats.bestRet ? Number(stats.bestRet.return_pct) : null), Trophy],
                ["Worst return", pct(stats.worstRet ? Number(stats.worstRet.return_pct) : null), TrendingDown],
                ["Simulated years", String(stats.yearsPlayed), Clock],
                ["Best streak", String(stats.bestStreak), Flame],
                ["Group games", String(stats.group), Users],
                ["Advanced games", String(stats.advanced), Target],
              ].map(([k, v, Icon]) => {
                const I = Icon as typeof Trophy;
                return (
                  <div key={k as string} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><I className="h-3.5 w-3.5" />{k as string}</div>
                    <div className="text-lg font-semibold tabular-nums truncate mt-1">{v as string}</div>
                  </div>
                );
              })}
            </section>
            <p className="text-xs text-muted-foreground -mt-5">Returns count only profit from your picks — the $5,000 deposits don't count.</p>

            <section className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="font-semibold mb-1">Return over your last games</h2>
                <p className="text-xs text-muted-foreground mb-3">Oldest on the left, newest on the right</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.trend}>
                      <defs><linearGradient id="retFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="n" hide />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${Math.round(v)}%`} width={56} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => [pct(v), "Return"]} labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} />
                      <Area type="monotone" dataKey="ret" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#retFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="font-semibold mb-1">How your games usually end</h2>
                <p className="text-xs text-muted-foreground mb-3">Number of games in each return range</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.buckets}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={32} />
                      <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.3)" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="count" name="Games" radius={[6, 6, 0, 0]}>
                        {stats.buckets.map((b, i) => <Cell key={i} fill={i === 0 ? "hsl(var(--destructive))" : "hsl(var(--primary))"} fillOpacity={i === 0 ? 0.8 : 0.4 + i * 0.15} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {stats.eras.length > 0 && (
              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="font-semibold mb-3">Your average return by starting decade</h2>
                <div className="space-y-2">
                  {(() => { const max = Math.max(...stats.eras.map(e => Math.abs(e.avg)), 1); return stats.eras.map(e => (
                    <div key={e.era} className="flex items-center gap-3 text-sm">
                      <span className="w-12 text-muted-foreground">{e.era}</span>
                      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${e.avg >= 0 ? "bg-primary" : "bg-destructive"}`} style={{ width: `${Math.max(3, (Math.abs(e.avg) / max) * 100)}%` }} /></div>
                      <span className="w-24 text-right tabular-nums">{pct(e.avg)}</span>
                      <span className="w-16 text-right text-xs text-muted-foreground">{e.n} game{e.n === 1 ? "" : "s"}</span>
                    </div>
                  )); })()}
                </div>
              </section>
            )}

            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-semibold">Achievements</h2>
                <span className="text-xs text-muted-foreground">{stats.badges.filter(b => b.got).length} of {stats.badges.length} unlocked</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {stats.badges.map(b => (
                  <div key={b.name} className={`rounded-lg border p-3 text-center ${b.got ? "border-primary/50 bg-primary/10" : "border-border opacity-50"}`}>
                    {b.got ? <Award className="h-6 w-6 mx-auto text-primary" /> : <Lock className="h-6 w-6 mx-auto text-muted-foreground" />}
                    <div className="text-sm font-medium mt-1">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{b.desc}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h2 className="font-semibold">Games from before you signed in</h2>
            <p className="text-sm text-muted-foreground">Add finished games played as a guest on this device.</p>
          </div>
          <div className="flex items-center gap-3">
            {importMsg && <span role="status" className="text-sm text-muted-foreground">{importMsg}</span>}
            <Button variant="outline" onClick={importDevice}>Import</Button>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Game history</h2>
          {err ? (
            <div className="text-sm text-destructive">{err} <Button variant="link" onClick={loadRuns}>Retry</Button></div>
          ) : runs == null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No finished games yet. <Link to="/" className="text-primary">Play one</Link> or import games from this device.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-xs text-muted-foreground bg-card">
                  <tr><th className="text-left p-3">Date</th><th className="text-left p-3">Years</th><th className="text-left p-3 hidden sm:table-cell">Mode</th><th className="text-right p-3">Final value</th><th className="text-right p-3">Return</th><th className="p-3">Manage</th></tr>
                </thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3 whitespace-nowrap">{new Date(r.played_at).toLocaleDateString()}</td>
                      <td className="p-3 whitespace-nowrap">{r.start_year}–{r.end_year}{r.is_multiplayer ? " · Group" : ""}</td>
                      <td className="p-3 hidden sm:table-cell">{modeLabel(r.game_mode)}</td>
                      <td className="p-3 text-right">{money(r.ending_value == null ? null : Number(r.ending_value))}</td>
                      <td className={`p-3 text-right ${Number(r.return_pct) >= 0 ? "text-primary" : "text-destructive"}`}>{pct(r.return_pct == null ? null : Number(r.return_pct))}</td>
                      <td className="p-3"><Button size="sm" variant="ghost" disabled={deletingRun !== null} onClick={() => removeRun(r.id)} aria-label={`Delete run from ${new Date(r.played_at).toLocaleDateString()}`}>{deletingRun === r.id ? 'Deleting…' : 'Delete'}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="border-t border-border py-6 space-y-3"><h2 className="font-semibold">Your data</h2><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={exportData}>Download personal data</Button><Button variant="outline" onClick={() => { if (confirm('Clear unfinished games, scenarios and room rejoin access on this device? Server data and sign-in remain unchanged.')) { clearDeviceGameData(); setDataMsg('Device game data cleared.'); } }}>Clear game data on this device</Button></div><p className="text-sm text-muted-foreground">For account deletion or guest data, <a href="mailto:contact@investmentsimulator.app" className="underline text-primary">contact us</a>. Automated account deletion remains pending.</p>{dataMsg && <p role="status" className="text-sm text-muted-foreground">{dataMsg}</p>}</section>
        <section className="rounded-xl border border-border bg-card p-4 max-w-md">
          <h2 className="font-semibold mb-3">Profile</h2>
          <form onSubmit={saveProfile} className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="un">Username</Label>
              <Input id="un" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. atharv_invests" maxLength={20} /></div>
            <div className="space-y-1.5"><Label htmlFor="dn">Display name</Label>
              <Input id="dn" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={32} /></div>
            <div className="flex items-center gap-3"><Button type="submit">Save</Button>{profileMsg && <span role="status" className="text-sm text-muted-foreground">{profileMsg}</span>}</div>
          </form>
        </section>
      </div>
    </main>
  );
}
