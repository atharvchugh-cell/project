ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS player_daily_requests integer CHECK (player_daily_requests IS NULL OR player_daily_requests >= 0);
ALTER TABLE public.ai_player_allowances ALTER COLUMN monthly_allowance DROP NOT NULL;
ALTER TABLE public.ai_player_allowances ADD COLUMN IF NOT EXISTS daily_requests integer CHECK (daily_requests IS NULL OR daily_requests >= 0);

CREATE OR REPLACE FUNCTION public.ai_player_allowance_status(p_subject text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'allowance', coalesce((SELECT monthly_allowance FROM ai_player_allowances WHERE subject = p_subject),
                          (SELECT player_monthly_allowance FROM ai_settings WHERE id = 1)),
    'spent', (SELECT coalesce(sum(CASE WHEN est_credits IS NOT NULL THEN est_credits
                 WHEN kind = 'analyze-game' THEN 0.02 WHEN kind = 'sandbox-scenario' THEN 0.002 ELSE 0.01 END), 0)
              FROM ai_usage_events WHERE subject = p_subject AND created_at >= date_trunc('month', now())),
    'daily_cap', coalesce((SELECT daily_requests FROM ai_player_allowances WHERE subject = p_subject),
                          (SELECT player_daily_requests FROM ai_settings WHERE id = 1)),
    'today', (SELECT count(*) FROM ai_usage_events WHERE subject = p_subject AND created_at >= date_trunc('day', now()))
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_list_accounts(p_search text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x.credits DESC, x.created_at DESC), '[]'::jsonb) FROM (
    SELECT 'user:' || pr.id AS subject, coalesce(nullif(btrim(pr.display_name),''), pr.username, 'Player') AS name,
      pr.username, pr.created_at,
      (SELECT count(*) FROM game_events g WHERE g.user_id = pr.id AND g.completed) AS games,
      (SELECT coalesce(round(sum(CASE WHEN est_credits IS NOT NULL THEN est_credits WHEN kind='analyze-game' THEN 0.02 WHEN kind='sandbox-scenario' THEN 0.002 ELSE 0.01 END), 4), 0)
         FROM ai_usage_events e WHERE e.subject = 'user:' || pr.id AND e.created_at >= date_trunc('month', now())) AS credits,
      a.monthly_allowance, a.daily_requests
    FROM profiles pr LEFT JOIN ai_player_allowances a ON a.subject = 'user:' || pr.id
    WHERE p_search IS NULL OR btrim(p_search) = ''
       OR pr.display_name ILIKE '%' || btrim(p_search) || '%' OR pr.username ILIKE '%' || btrim(p_search) || '%'
    LIMIT 200) x;
$$;

CREATE OR REPLACE FUNCTION public.admin_player_profile(p_subject text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ev AS (
    SELECT kind, created_at, session_id, CASE WHEN est_credits IS NOT NULL THEN est_credits WHEN kind='analyze-game' THEN 0.02 WHEN kind='sandbox-scenario' THEN 0.002 ELSE 0.01 END AS c
    FROM ai_usage_events WHERE subject = p_subject AND created_at > now() - interval '90 days'),
  uid AS (SELECT CASE WHEN p_subject LIKE 'user:%' THEN substr(p_subject, 6) END AS u),
  sid AS (SELECT (array_agg(session_id ORDER BY created_at DESC) FILTER (WHERE session_id IS NOT NULL))[1] AS s FROM ev),
  g AS (SELECT * FROM game_events, uid, sid WHERE completed AND ((uid.u IS NOT NULL AND user_id::text = uid.u) OR (uid.u IS NULL AND sid.s IS NOT NULL AND session_id = sid.s)))
  SELECT jsonb_build_object(
    'subject', p_subject,
    'guest', p_subject LIKE 'guest:%',
    'name', CASE WHEN (SELECT u FROM uid) IS NOT NULL THEN (SELECT coalesce(nullif(btrim(display_name),''), username) FROM profiles WHERE id::text = (SELECT u FROM uid))
                 ELSE (SELECT nullif(btrim(display_name),'') FROM g WHERE display_name IS NOT NULL ORDER BY played_at DESC LIMIT 1) END,
    'username', (SELECT username FROM profiles WHERE id::text = (SELECT u FROM uid)),
    'joined', (SELECT created_at FROM profiles WHERE id::text = (SELECT u FROM uid)),
    'games', (SELECT count(*) FROM g),
    'best_value', (SELECT max(ending_value) FROM g),
    'month_credits', (SELECT round(coalesce(sum(c),0), 4) FROM ev WHERE created_at >= date_trunc('month', now())),
    'today_requests', (SELECT count(*) FROM ev WHERE created_at >= date_trunc('day', now())),
    'total_requests', (SELECT count(*) FROM ev),
    'coach', (SELECT count(*) FROM ev WHERE kind = 'analyze-game'),
    'sandbox', (SELECT count(*) FROM ev WHERE kind = 'sandbox-scenario'),
    'monthly_allowance', (SELECT monthly_allowance FROM ai_player_allowances WHERE subject = p_subject),
    'daily_requests', (SELECT daily_requests FROM ai_player_allowances WHERE subject = p_subject),
    'default_allowance', (SELECT player_monthly_allowance FROM ai_settings WHERE id = 1),
    'default_daily', (SELECT player_daily_requests FROM ai_settings WHERE id = 1),
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'credits', coalesce((SELECT round(sum(c),4) FROM ev WHERE created_at::date = d::date),0)) ORDER BY d), '[]'::jsonb)
              FROM generate_series(now()::date - 29, now()::date, interval '1 day') d),
    'recent_games', (SELECT coalesce(jsonb_agg(r), '[]'::jsonb) FROM (SELECT played_at, start_year, end_year, ending_value, return_pct, game_mode FROM g ORDER BY played_at DESC LIMIT 10) r)
  );
$$;

REVOKE ALL ON FUNCTION public.admin_list_accounts(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts(text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_player_profile(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_player_profile(text) TO service_role;