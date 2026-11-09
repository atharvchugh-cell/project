-- Track per-request token usage and estimated credits for AI calls.
ALTER TABLE public.ai_usage_events
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS est_credits numeric;

-- Called by AI edge functions after a successful gateway response to attach
-- token usage + estimated credits to the reservation row. Service role only.
CREATE OR REPLACE FUNCTION public.record_ai_usage(
  p_reservation uuid,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_est_credits numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_usage_events
     SET model = left(coalesce(p_model, ''), 64),
         input_tokens = greatest(coalesce(p_input_tokens, 0), 0),
         output_tokens = greatest(coalesce(p_output_tokens, 0), 0),
         est_credits = greatest(coalesce(p_est_credits, 0), 0)
   WHERE id = p_reservation;
END;
$$;
REVOKE ALL ON FUNCTION public.record_ai_usage(uuid, text, integer, integer, numeric) FROM public;
REVOKE ALL ON FUNCTION public.record_ai_usage(uuid, text, integer, integer, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_usage(uuid, text, integer, integer, numeric) TO service_role;

-- Extend the admin summary with credit/token totals and a per-day credit series.
CREATE OR REPLACE FUNCTION public.admin_ai_usage_summary(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH w AS (SELECT LEAST(GREATEST(COALESCE(p_days, 30), 1), 90) AS d),
  ev AS (SELECT * FROM ai_usage_events, w WHERE created_at > now() - make_interval(days => w.d)),
  bl AS (SELECT * FROM security_events, w WHERE event = 'ai_quota_block' AND created_at > now() - make_interval(days => w.d))
  SELECT jsonb_build_object(
    'days', (SELECT d FROM w),
    'totals', jsonb_build_object(
      'requests', (SELECT count(*) FROM ev),
      'guest_requests', (SELECT count(*) FROM ev WHERE is_guest),
      'user_requests', (SELECT count(*) FROM ev WHERE NOT is_guest),
      'unique_players', (SELECT count(DISTINCT subject) FROM ev),
      'blocked', (SELECT count(*) FROM bl),
      'today', (SELECT count(*) FROM ev WHERE created_at > date_trunc('day', now())),
      'cached_answers', (SELECT count(*) FROM ai_response_cache, w WHERE created_at > now() - make_interval(days => w.d)),
      'est_credits', (SELECT coalesce(round(sum(est_credits), 4), 0) FROM ev),
      'est_credits_today', (SELECT coalesce(round(sum(est_credits), 4), 0) FROM ev WHERE created_at > date_trunc('day', now())),
      'input_tokens', (SELECT coalesce(sum(input_tokens), 0) FROM ev),
      'output_tokens', (SELECT coalesce(sum(output_tokens), 0) FROM ev),
      'measured_requests', (SELECT count(*) FROM ev WHERE est_credits IS NOT NULL)
    ),
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'coach', coach, 'sandbox', sandbox, 'blocked', blocked, 'credits', credits) ORDER BY day), '[]'::jsonb) FROM (
      SELECT d.day::date AS day,
             coalesce((SELECT count(*) FROM ev WHERE kind = 'analyze-game' AND created_at::date = d.day::date), 0) AS coach,
             coalesce((SELECT count(*) FROM ev WHERE kind = 'sandbox-scenario' AND created_at::date = d.day::date), 0) AS sandbox,
             coalesce((SELECT count(*) FROM bl WHERE created_at::date = d.day::date), 0) AS blocked,
             coalesce((SELECT round(sum(est_credits), 4) FROM ev WHERE created_at::date = d.day::date), 0) AS credits
        FROM generate_series((now() - make_interval(days => (SELECT d FROM w) - 1))::date, now()::date, interval '1 day') d(day)
    ) s),
    'by_kind', (SELECT coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) FROM (SELECT kind, count(*) n FROM ev GROUP BY kind) k),
    'block_reasons', (SELECT coalesce(jsonb_object_agg(reason, n), '{}'::jsonb) FROM (SELECT coalesce(detail->>'reason', 'unknown') reason, count(*) n FROM bl GROUP BY 1) r),
    'top_players', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', left(subject, 12), 'guest', is_guest, 'requests', n, 'last_used', last_used)), '[]'::jsonb) FROM (
      SELECT subject, bool_or(is_guest) is_guest, count(*) n, max(created_at) last_used FROM ev GROUP BY subject ORDER BY n DESC LIMIT 8
    ) t)
  );
$$;
REVOKE ALL ON FUNCTION public.admin_ai_usage_summary(integer) FROM public;
REVOKE ALL ON FUNCTION public.admin_ai_usage_summary(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_usage_summary(integer) TO service_role;