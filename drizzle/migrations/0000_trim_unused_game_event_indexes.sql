DROP INDEX IF EXISTS public.game_events_trace_id_idx;
DROP INDEX IF EXISTS public.game_events_mode_idx;
CREATE INDEX IF NOT EXISTS ai_response_cache_created_idx ON public.ai_response_cache (created_at);