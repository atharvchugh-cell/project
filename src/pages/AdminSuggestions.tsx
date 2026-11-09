import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Inbox, RefreshCw, Search, Trash2, MessageSquareReply, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminPolling } from "@/hooks/useAdminPolling";

interface Suggestion {
  id: string;
  message: string;
  contact: string | null;
  page: string | null;
  status: string;
  created_at: string;
  admin_reply: string | null;
  replied_at: string | null;
  publication_consent: boolean;
  public_summary: string | null;
  published: boolean;
}

const STATUSES = ["new", "planned", "done", "declined"] as const;
const FILTERS = ["all", ...STATUSES] as const;
const STORAGE_KEY = "admin_code_suggestions";

const statusTone: Record<string, string> = {
  new: "border-primary/50 text-primary",
  planned: "border-accent/50 text-accent",
  done: "border-primary/30 text-primary/80",
  declined: "border-border text-muted-foreground",
};

async function call(code: string, method: string, body?: unknown) {
  const { data, error } = await supabase.functions.invoke("feature-requests", {
    method: method as "GET" | "POST" | "PATCH" | "DELETE",
    headers: { "x-admin-code": code },
    body: body as Record<string, unknown> | undefined,
  });
  return { data, error };
}

const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

function CodeGate({ onUnlock }: { onUnlock: (c: string) => void }) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await call(value, "GET");
    setBusy(false);
    if (error) return setErr("That code wasn't accepted.");
    sessionStorage.setItem(STORAGE_KEY, value);
    onUnlock(value);
  };
  return (
    <form onSubmit={submit} className="max-w-sm mx-auto mt-24 rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2 text-foreground font-semibold"><Lock className="w-4 h-4" /> Admin access</div>
      <Input type="password" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Admin code" aria-label="Admin code" />
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-full" disabled={busy || value.length < 3}>{busy ? "Checking…" : "Open suggestions"}</Button>
    </form>
  );
}

function SuggestionCard({ s, code, onChanged, onRemoved }: {
  s: Suggestion; code: string;
  onChanged: (patch: Partial<Suggestion>) => void;
  onRemoved: () => void;
}) {
  const [reply, setReply] = useState(s.admin_reply ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState(s.public_summary ?? '');
  const [actionError, setActionError] = useState<string | null>(null);
  const publish = async (published: boolean) => {
    setSaving(true); setActionError(null);
    const { error } = await call(code, 'PATCH', { id: s.id, published, public_summary: summary });
    setSaving(false);
    if (error) { setActionError('Could not change publication. Check the summary and reply, then try again.'); return; }
    onChanged({ published, public_summary: summary.trim() });
  };

  const setStatus = async (status: string) => {
    const { error } = await call(code, "PATCH", { id: s.id, status });
    if (error) setActionError('Could not change status. Try again.');
    else onChanged({ status });
  };
  const saveReply = async () => {
    setSaving(true);
    const { error } = await call(code, "PATCH", { id: s.id, admin_reply: reply });
    setSaving(false);
    if (!error) {
      const text = reply.trim();
      onChanged({ admin_reply: text || null, replied_at: text ? new Date().toISOString() : null });
      setEditing(false);
    }
  };
  const remove = async () => {
    if (!confirm("Delete this suggestion permanently?")) return;
    const { error } = await call(code, "DELETE", { id: s.id });
    if (!error) onRemoved();
  };

  return (
    <article className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-foreground whitespace-pre-wrap break-words">{s.message}</p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase ${statusTone[s.status] ?? ""}`}>{s.status}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono text-muted-foreground">
        <span title={new Date(s.created_at).toLocaleString()}>{timeAgo(s.created_at)}</span>
        {s.page && <span>· from {s.page}</span>}
        {s.contact ? <span className="text-foreground">· contact: {s.contact}</span> : <span>· no contact left</span>}
      </div>

      {s.admin_reply && !editing && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <div className="text-[10px] font-mono uppercase text-primary mb-1">Your response{s.replied_at ? ` · ${timeAgo(s.replied_at)}` : ""}</div>
          <p className="text-foreground whitespace-pre-wrap">{s.admin_reply}</p>
        </div>
      )}
      {editing && (
        <div className="space-y-2">
          <Textarea value={reply} maxLength={2000} onChange={(e) => setReply(e.target.value)} placeholder="Replies stay private until a permitted, reviewed summary is explicitly published." rows={3} />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveReply} disabled={saving}>{saving ? "Saving…" : "Save response"}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setReply(s.admin_reply ?? ""); setEditing(false); }}>Cancel</Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{s.published ? 'Published summary' : 'Private suggestion'} · {s.publication_consent ? 'Player permitted a reviewed public summary' : 'No publication permission'}</p>
      {s.publication_consent && <div className="space-y-2"><label htmlFor={`summary-${s.id}`} className="text-xs text-muted-foreground">Reviewed public summary — remove personal information</label><Textarea id={`summary-${s.id}`} value={summary} onChange={e => setSummary(e.target.value)} maxLength={2000} rows={2} /><Button variant="outline" size="sm" onClick={() => publish(!s.published)} disabled={saving || (!s.published && (!s.admin_reply || summary.trim().length < 3))}>{s.published ? 'Unpublish' : 'Publish reviewed summary & reply'}</Button></div>}
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUSES.map((st) => (
          <Button key={st} size="sm" variant={s.status === st ? "default" : "outline"} className="h-7 px-2.5 text-xs capitalize" onClick={() => setStatus(st)} disabled={s.status === st}>{st}</Button>
        ))}
        <div className="ml-auto flex gap-1.5">
          {!editing && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(true)}>
              <MessageSquareReply className="w-3.5 h-3.5 mr-1" /> {s.admin_reply ? "Edit response" : "Respond"}
            </Button>
          )}
          {s.contact?.includes("@") && (
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
              <a href={`mailto:${s.contact}?subject=${encodeURIComponent("About your Rise to Riches suggestion")}&body=${encodeURIComponent(`You suggested: "${s.message}"\n\n${reply}`)}`}>Email</a>
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={remove} aria-label="Delete suggestion"><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
    </article>
  );
}

export default function AdminSuggestions() {
  const [code, setCode] = useState<string>(() => sessionStorage.getItem(STORAGE_KEY) ?? "");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [query, setQuery] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!code) return;
    if (!quiet) setLoading(true);
    const { data, error } = await call(code, "GET");
    setLoading(false);
    if (error) {
      // Keep the last good list on a failed background refresh.
      if (!quiet) setError("Couldn't load suggestions. Try again.");
      return;
    }
    setError(null);
    setItems((data as { requests: Suggestion[] })?.requests ?? []);
    setLastSync(new Date());
  }, [code]);

  useEffect(() => {
    if (!code) return;
    load();
  }, [code, load]);

  useAdminPolling(!!code, () => load(true));

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const s of items) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((s) =>
      (filter === "all" || s.status === filter) &&
      (!q || s.message.toLowerCase().includes(q) || (s.contact ?? "").toLowerCase().includes(q)),
    );
  }, [items, filter, query]);

  const patch = (id: string, p: Partial<Suggestion>) =>
    setItems((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Suggestions — Admin · Rise to Riches</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Home</Link>
        <Link to="/admin/ai-usage" className="ml-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">AI usage →</Link>
        {!code ? (
          <CodeGate onUnlock={setCode} />
        ) : (
          <>
            <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold text-foreground flex items-center gap-2"><Inbox className="w-7 h-7 text-primary" /> Suggestions</h1>
                <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Live · updates every 15s{lastSync ? ` · last checked ${lastSync.toLocaleTimeString()}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => load()}><RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
                <Button variant="ghost" size="sm" onClick={() => { sessionStorage.removeItem(STORAGE_KEY); setCode(""); setItems([]); }}>Lock</Button>
              </div>
            </header>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STATUSES.map((s) => (
                <div key={s} className="rounded-xl border border-border bg-card p-3">
                  <div className="text-xs font-mono uppercase text-muted-foreground">{s}</div>
                  <div className="text-2xl font-semibold tabular-nums text-foreground">{counts[s] ?? 0}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-8 capitalize" onClick={() => setFilter(f)}>
                  {f} <span className="ml-1.5 tabular-nums opacity-70">{counts[f] ?? 0}</span>
                </Button>
              ))}
              <div className="relative ml-auto w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search suggestions" className="pl-8 h-9" aria-label="Search suggestions" />
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            <div className="mt-4 space-y-3">
              {!loading && visible.length === 0 && !error && (
                <p className="text-sm text-muted-foreground py-8 text-center">No suggestions here.</p>
              )}
              {visible.map((s) => (
                <SuggestionCard
                  key={s.id}
                  s={s}
                  code={code}
                  onChanged={(p) => patch(s.id, p)}
                  onRemoved={() => setItems((l) => l.filter((x) => x.id !== s.id))}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
