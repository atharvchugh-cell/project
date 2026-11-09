import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "admin_code_dashboard";

interface Account {
  subject: string; name: string; username: string | null; created_at: string;
  games: number; credits: number; monthly_allowance: number | null; daily_requests: number | null;
}

const fmt = (v: number) => (v < 1 ? Number(v).toFixed(3) : Number(v).toFixed(2));

export default function AdminPlayers() {
  const code = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) ?? "" : "";
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Account[]>([]);
  const [defs, setDefs] = useState<{ a: number | null; d: number | null }>({ a: null, d: null });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (search: string) => {
    if (!code) return;
    const { data, error } = await supabase.functions.invoke("admin-dashboard", { headers: { "x-admin-code": code }, body: { list_accounts: true, search } });
    if (error || !data?.accounts) { setErr("Couldn't load accounts."); return; }
    setErr(null); setRows(data.accounts); setDefs({ a: data.default_allowance, d: data.default_daily });
  }, [code]);

  useEffect(() => { const t = setTimeout(() => load(q), 250); return () => clearTimeout(t); }, [q, load]);

  const head = <Helmet><title>Rise to Riches</title><meta name="robots" content="noindex,nofollow" /></Helmet>;
  if (!code) {
    return <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">{head}<Link to="/admin/dashboard" className="text-sm text-primary">Enter the dashboard password first</Link></main>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {head}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-5">
        <div>
          <Link to="/admin/dashboard" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Dashboard</Link>
          <h1 className="font-display text-2xl font-bold mt-1">Players</h1>
          <p className="text-sm text-muted-foreground">Every account. Open one to see its profile and set its AI limits.</p>
        </div>
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or username" className="pl-9" aria-label="Search players" />
        </div>
        {err && <p className="text-sm text-loss">{err}</p>}
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground text-left">
              <tr><th className="p-3">Player</th><th className="p-3 text-right">Games</th><th className="p-3 text-right">AI credits this month</th><th className="p-3 text-right">Monthly cap</th><th className="p-3 text-right">Daily requests</th><th className="p-3 text-right">Joined</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.subject} className="hover:bg-secondary/40">
                  <td className="p-3">
                    <Link to={`/admin/players/${encodeURIComponent(r.subject)}`} className="font-medium hover:text-primary hover:underline">{r.name}</Link>
                    {r.username && <div className="text-xs text-muted-foreground">@{r.username}</div>}
                  </td>
                  <td className="p-3 text-right tabular-nums">{r.games}</td>
                  <td className="p-3 text-right tabular-nums">{fmt(r.credits)}</td>
                  <td className="p-3 text-right tabular-nums">{r.monthly_allowance != null ? fmt(r.monthly_allowance) : <span className="text-muted-foreground">{defs.a != null ? `${fmt(defs.a)} (default)` : "Unlimited"}</span>}</td>
                  <td className="p-3 text-right tabular-nums">{r.daily_requests != null ? r.daily_requests : <span className="text-muted-foreground">{defs.d != null ? `${defs.d} (default)` : "Unlimited"}</span>}</td>
                  <td className="p-3 text-right text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {!rows.length && !err && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No accounts found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
