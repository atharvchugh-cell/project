ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS player_monthly_allowance numeric CHECK (player_monthly_allowance IS NULL OR player_monthly_allowance > 0);

CREATE TABLE IF NOT EXISTS public.ai_player_allowances (
  subject text PRIMARY KEY,
  monthly_allowance numeric NOT NULL CHECK (monthly_allowance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_player_allowances TO service_role;
ALTER TABLE public.ai_player_allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages player allowances" ON public.ai_player_allowances FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER ai_player_allowances_updated_at BEFORE UPDATE ON public.ai_player_allowances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Returns this player's allowance (override or default; NULL = unlimited) and this month's spend.
CREATE OR REPLACE FUNCTION public.ai_player_allowance_status(p_subject text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'allowance', coalesce((SELECT monthly_allowance FROM ai_player_allowances WHERE subject = p_subject),
                          (SELECT player_monthly_allowance FROM ai_settings WHERE id = 1)),
    'spent', (SELECT coalesce(sum(CASE WHEN est_credits IS NOT NULL THEN est_credits
                 WHEN kind = 'analyze-game' THEN 0.02 WHEN kind = 'sandbox-scenario' THEN 0.002 ELSE 0.01 END), 0)
              FROM ai_usage_events WHERE subject = p_subject AND created_at >= date_trunc('month', now()))
  );
$$;
REVOKE ALL ON FUNCTION public.ai_player_allowance_status(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_player_allowance_status(text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_ai_player_usage(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH w AS (SELECT LEAST(GREATEST(COALESCE(p_days, 30), 1), 365) AS d),
  ms AS (SELECT date_trunc('month', now()) AS s,
                extract(epoch FROM now() - date_trunc('month', now())) / 86400.0 AS elapsed,
                extract(day FROM date_trunc('month', now()) + interval '1 month' - interval '1 day') AS dim),
  ev AS (
    SELECT subject, is_guest, session_id, kind, created_at,
      CASE WHEN est_credits IS NOT NULL THEN est_credits
           WHEN kind = 'analyze-game' THEN 0.02
           WHEN kind = 'sandbox-scenario' THEN 0.002 ELSE 0.01 END AS c
    FROM ai_usage_events, w, ms
    WHERE created_at > LEAST(now() - make_interval(days => w.d), ms.s)
  ),
  per AS (
    SELECT subject, bool_or(is_guest) AS is_guest,
      (array_agg(session_id ORDER BY created_at DESC) FILTER (WHERE session_id IS NOT NULL))[1] AS session_id,
      count(*) FILTER (WHERE created_at > now() - make_interval(days => (SELECT d FROM w))) AS requests,
      count(*) FILTER (WHERE kind = 'analyze-game' AND created_at > now() - make_interval(days => (SELECT d FROM w))) AS coach,
      count(*) FILTER (WHERE kind = 'sandbox-scenario' AND created_at > now() - make_interval(days => (SELECT d FROM w))) AS sandbox,
      coalesce(sum(c) FILTER (WHERE created_at > now() - make_interval(days => (SELECT d FROM w))), 0) AS credits,
      coalesce(sum(c) FILTER (WHERE created_at >= (SELECT s FROM ms)), 0) AS month_credits,
      max(created_at) AS last_used
    FROM ev GROUP BY subject
  ),
  named AS (
    SELECT p.*,
      coalesce(a.monthly_allowance, (SELECT player_monthly_allowance FROM ai_settings WHERE id = 1)) AS allowance,
      a.monthly_allowance IS NOT NULL AS custom_allowance,
      CASE WHEN p.subject LIKE 'user:%' THEN (
             SELECT coalesce(nullif(btrim(pr.display_name),''), pr.username) FROM profiles pr WHERE pr.id::text = substr(p.subject, 6))
           ELSE (SELECT nullif(btrim(g.display_name),'') FROM game_events g WHERE g.session_id = p.session_id AND g.display_name IS NOT NULL ORDER BY g.played_at DESC LIMIT 1)
      END AS name,
      CASE WHEN p.subject LIKE 'user:%' THEN (
             SELECT count(*) FROM game_events g, w WHERE g.user_id::text = substr(p.subject, 6) AND g.completed AND g.played_at > now() - make_interval(days => w.d))
           WHEN p.session_id IS NOT NULL THEN (
             SELECT count(*) FROM game_events g, w WHERE g.session_id = p.session_id AND g.completed AND g.played_at > now() - make_interval(days => w.d))
      END AS games
    FROM per p LEFT JOIN ai_player_allowances a ON a.subject = p.subject
    WHERE p.requests > 0 OR p.month_credits > 0
  ),
  fc AS (
    SELECT n.*,
      CASE WHEN ms.elapsed > 0 THEN n.month_credits / ms.elapsed * ms.dim ELSE n.month_credits END AS forecast,
      CASE WHEN n.allowance IS NOT NULL AND n.month_credits >= n.allowance THEN 0
           WHEN n.allowance IS NOT NULL AND n.month_credits > 0 AND ms.elapsed > 0
             AND ms.elapsed + (n.allowance - n.month_credits) / (n.month_credits / ms.elapsed) <= ms.dim
           THEN ceil(ms.elapsed + (n.allowance - n.month_credits) / (n.month_credits / ms.elapsed)) END AS cap_day
    FROM named n, ms
  ),
  stats AS (SELECT coalesce(sum(credits),0) AS total, percentile_cont(0.5) WITHIN GROUP (ORDER BY credits) FILTER (WHERE credits > 0) AS med FROM per WHERE requests > 0)
  SELECT jsonb_build_object(
    'days', (SELECT d FROM w),
    'default_allowance', (SELECT player_monthly_allowance FROM ai_settings WHERE id = 1),
    'total_credits', (SELECT round(total, 4) FROM stats),
    'median_credits', (SELECT round(coalesce(med,0)::numeric, 4) FROM stats),
    'players', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'subject', f.subject, 'id', left(f.subject, 14), 'name', f.name, 'guest', f.is_guest,
        'requests', f.requests, 'coach', f.coach, 'sandbox', f.sandbox,
        'credits', round(f.credits, 4), 'games', f.games,
        'credits_per_game', CASE WHEN coalesce(f.games,0) > 0 THEN round(f.credits / f.games, 4) END,
        'share', CASE WHEN s.total > 0 THEN round(f.credits / s.total * 100, 1) ELSE 0 END,
        'heavy', (f.requests >= 5 AND (f.credits >= 4 * coalesce(s.med,0) OR (s.total > 0 AND f.credits / s.total >= 0.15))),
        'month_credits', round(f.month_credits, 4),
        'allowance', f.allowance, 'custom_allowance', f.custom_allowance,
        'remaining', CASE WHEN f.allowance IS NOT NULL THEN round(greatest(f.allowance - f.month_credits, 0), 4) END,
        'forecast', round(f.forecast, 4),
        'cap_day', f.cap_day,
        'last_used', f.last_used) ORDER BY f.credits DESC)
      FROM (SELECT * FROM fc ORDER BY credits DESC LIMIT 100) f, stats s), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.admin_ai_player_usage(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_player_usage(integer) TO service_role;