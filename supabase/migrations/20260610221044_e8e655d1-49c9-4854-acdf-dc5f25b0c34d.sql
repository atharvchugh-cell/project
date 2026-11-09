CREATE TABLE IF NOT EXISTS public.seo_monitor_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  known_issues_key TEXT NOT NULL DEFAULT '',
  last_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seo_monitor_state_singleton CHECK (id = 1)
);
GRANT ALL ON public.seo_monitor_state TO service_role;
ALTER TABLE public.seo_monitor_state ENABLE ROW LEVEL SECURITY;
-- No public policies: this table is only touched by the seo-monitor edge function via service_role.
INSERT INTO public.seo_monitor_state (id, known_issues_key, last_issues)
VALUES (1, '', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;