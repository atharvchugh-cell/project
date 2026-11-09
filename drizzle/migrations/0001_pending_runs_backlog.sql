ALTER TABLE public.game_events ADD COLUMN IF NOT EXISTS client_run_id text;
CREATE UNIQUE INDEX IF NOT EXISTS game_events_client_run_idx ON public.game_events (client_run_id) WHERE client_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pending_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_run_id text UNIQUE,
  payload jsonb NOT NULL,
  simulation jsonb,
  user_id uuid,
  final_value numeric,
  return_pct numeric,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT ALL ON public.pending_runs TO service_role;
REVOKE ALL ON public.pending_runs FROM anon, authenticated;
ALTER TABLE public.pending_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages pending runs" ON public.pending_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS pending_runs_status_idx ON public.pending_runs (status, created_at);