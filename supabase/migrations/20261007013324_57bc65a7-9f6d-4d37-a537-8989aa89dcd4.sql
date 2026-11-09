ALTER TABLE public.ai_usage_events ADD COLUMN IF NOT EXISTS session_id text;
CREATE INDEX IF NOT EXISTS ai_usage_events_session_idx ON public.ai_usage_events (session_id);

-- Stamp the raw client session onto a reservation so usage can be matched to games/names.
CREATE OR REPLACE FUNCTION public.tag_ai_usage_session(p_reservation uuid, p_session_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE ai_usage_events SET session_id = nullif(left(regexp_replace(coalesce(p_session_id,''), '[^a-zA-Z0-9_-]', '', 'g'), 64), '')
  WHERE id = p_reservation;
$$;
REVOKE ALL ON FUNCTION public.tag_ai_usage_session(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tag_ai_usage_session(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_ai_player_usage(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH w AS (SELECT LEAST(GREATEST(COALESCE(p_days, 30), 1), 365) AS d),
  ev AS (
    SELECT subject, is_guest, session_id, kind, created_at,
      CASE WHEN est_credits IS NOT NULL THEN est_credits
           WHEN kind = 'analyze-game' THEN 0.02
           WHEN kind = 'sandbox-scenario' THEN 0.002 ELSE 0.01 END AS c
    FROM ai_usage_events, w WHERE created_at > now() - make_interval(days => w.d)
  ),
  per AS (
    SELECT subject, bool_or(is_guest) AS is_guest,
      (array_agg(session_id ORDER BY created_at DESC) FILTER (WHERE session_id IS NOT NULL))[1] AS session_id,
      count(*) AS requests,
      count(*) FILTER (WHERE kind = 'analyze-game') AS coach,
      count(*) FILTER (WHERE kind = 'sandbox-scenario') AS sandbox,
      sum(c) AS credits, max(created_at) AS last_used
    FROM ev GROUP BY subject
  ),
  named AS (
    SELECT p.*,
      CASE WHEN p.subject LIKE 'user:%' THEN (
             SELECT coalesce(nullif(btrim(pr.display_name),''), pr.username) FROM profiles pr WHERE pr.id::text = substr(p.subject, 6))
           ELSE (SELECT nullif(btrim(g.display_name),'') FROM game_events g WHERE g.session_id = p.session_id AND g.display_name IS NOT NULL ORDER BY g.played_at DESC LIMIT 1)
      END AS name,
      CASE WHEN p.subject LIKE 'user:%' THEN (
             SELECT count(*) FROM game_events g, w WHERE g.user_id::text = substr(p.subject, 6) AND g.completed AND g.played_at > now() - make_interval(days => w.d))
           WHEN p.session_id IS NOT NULL THEN (
             SELECT count(*) FROM game_events g, w WHERE g.session_id = p.session_id AND g.completed AND g.played_at > now() - make_interval(days => w.d))
      END AS games
    FROM per p
  ),
  stats AS (SELECT coalesce(sum(credits),0) AS total, percentile_cont(0.5) WITHIN GROUP (ORDER BY credits) AS med FROM per)
  SELECT jsonb_build_object(
    'days', (SELECT d FROM w),
    'total_credits', (SELECT round(total, 4) FROM stats),
    'median_credits', (SELECT round(coalesce(med,0)::numeric, 4) FROM stats),
    'players', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', left(n.subject, 14), 'name', n.name, 'guest', n.is_guest,
        'requests', n.requests, 'coach', n.coach, 'sandbox', n.sandbox,
        'credits', round(n.credits, 4), 'games', n.games,
        'credits_per_game', CASE WHEN coalesce(n.games,0) > 0 THEN round(n.credits / n.games, 4) END,
        'share', CASE WHEN s.total > 0 THEN round(n.credits / s.total * 100, 1) ELSE 0 END,
        'heavy', (n.requests >= 5 AND (n.credits >= 4 * coalesce(s.med,0) OR (s.total > 0 AND n.credits / s.total >= 0.15))),
        'last_used', n.last_used) ORDER BY n.credits DESC)
      FROM (SELECT * FROM named ORDER BY credits DESC LIMIT 100) n, stats s), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.admin_ai_player_usage(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_player_usage(integer) TO service_role;