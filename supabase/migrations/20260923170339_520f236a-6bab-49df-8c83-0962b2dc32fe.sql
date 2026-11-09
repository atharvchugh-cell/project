ALTER TABLE public.game_events ADD COLUMN IF NOT EXISTS trace_id text;
CREATE INDEX IF NOT EXISTS game_events_trace_id_idx ON public.game_events (trace_id);