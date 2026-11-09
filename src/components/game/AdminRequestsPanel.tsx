import { useEffect, useState, useCallback } from 'react';
import { Inbox, RefreshCw, Check, X, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface FeatureRequest {
  id: string;
  message: string;
  contact: string | null;
  page: string | null;
  status: string;
  created_at: string;
}

const STATUSES = ['new', 'planned', 'done', 'declined'] as const;

const statusTone: Record<string, string> = {
  new: 'text-primary',
  planned: 'text-sky-400',
  done: 'text-emerald-400',
  declined: 'text-muted-foreground',
};

/** Admin-only inbox of user-submitted feature requests. */
export function AdminRequestsPanel({ code }: { code: string }) {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('feature-requests', {
        method: 'GET',
        headers: { 'x-admin-code': code },
        timeout: 15000,
      });
      if (error) {
        const status = error.context instanceof Response ? error.context.status : undefined;
        setError(status === 401
          ? 'The admin code was not accepted.'
          : 'Feedback is temporarily unavailable. Please try Refresh in a moment.');
        return;
      }
      setRequests((data as { requests: FeatureRequest[] })?.requests ?? []);
    } catch {
      setError('Feedback is temporarily unavailable. Please try Refresh in a moment.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    setRequests((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    await supabase.functions.invoke('feature-requests', {
      method: 'PATCH',
      headers: { 'x-admin-code': code },
      body: { id, status },
    });
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <Inbox className="w-3.5 h-3.5" /> Feature requests
          {!loading && <span className="text-foreground">({requests.length})</span>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={load}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-primary hover:underline"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!error && !loading && requests.length === 0 && (
        <p className="text-sm text-muted-foreground">No requests yet.</p>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {requests.map((r) => (
          <div key={r.id} className="rounded-lg border border-border/30 bg-background/40 p-3">
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{r.message}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> {new Date(r.created_at).toLocaleString()}
              </span>
              {r.contact && <span>· {r.contact}</span>}
              {r.page && <span>· {r.page}</span>}
              <span className={`ml-auto uppercase ${statusTone[r.status] ?? ''}`}>{r.status}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(r.id, s)}
                  disabled={r.status === s}
                  className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition ${
                    r.status === s
                      ? 'border-primary/60 text-primary'
                      : 'border-border/40 text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {s === 'done' ? <Check className="w-3 h-3 inline mr-1" /> : null}
                  {s === 'declined' ? <X className="w-3 h-3 inline mr-1" /> : null}
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminRequestsPanel;
