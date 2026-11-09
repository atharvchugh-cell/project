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
      'cached_answers', (SELECT count(*) FROM ai_response_cache, w WHERE created_at > now() - make_interval(days => w.d))
    ),
    'daily', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'day') FROM (
        SELECT jsonb_build_object(
          'day', to_char(g.day, 'YYYY-MM-DD'),
          'coach', (SELECT count(*) FROM ev WHERE kind = 'analyze-game' AND date_trunc('day', created_at) = g.day),
          'sandbox', (SELECT count(*) FROM ev WHERE kind = 'sandbox-scenario' AND date_trunc('day', created_at) = g.day),
          'blocked', (SELECT count(*) FROM bl WHERE date_trunc('day', created_at) = g.day)
        ) x
        FROM generate_series(date_trunc('day', now()) - make_interval(days => (SELECT d FROM w) - 1), date_trunc('day', now()), interval '1 day') AS g(day)
      ) s), '[]'::jsonb),
    'by_kind', COALESCE((SELECT jsonb_object_agg(kind, n) FROM (SELECT kind, count(*) n FROM ev GROUP BY kind) k), '{}'::jsonb),
    'block_reasons', COALESCE((SELECT jsonb_object_agg(r, n) FROM (SELECT coalesce(detail->>'reason','unknown') r, count(*) n FROM bl GROUP BY 1) b), '{}'::jsonb),
    'top_players', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT left(split_part(subject, ':', 2), 8) AS id, (subject LIKE 'guest:%') AS guest,
               count(*) AS requests, max(created_at) AS last_used
        FROM ev GROUP BY subject ORDER BY count(*) DESC LIMIT 10
      ) t), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.admin_ai_usage_summary(integer) FROM public;
REVOKE ALL ON FUNCTION public.admin_ai_usage_summary(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_usage_summary(integer) TO service_role;