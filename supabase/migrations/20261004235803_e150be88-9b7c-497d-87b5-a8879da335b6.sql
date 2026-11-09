CREATE TABLE public.tutorial_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  event text not null check (event in ('start','complete')),
  created_at timestamptz not null default now()
);
GRANT INSERT ON public.tutorial_events TO anon, authenticated;
GRANT ALL ON public.tutorial_events TO service_role;
ALTER TABLE public.tutorial_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record tutorial events" ON public.tutorial_events FOR INSERT TO anon, authenticated WITH CHECK (event in ('start','complete') AND char_length(session_id) <= 64);

CREATE OR REPLACE FUNCTION public.admin_player_stats(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH win AS (SELECT * FROM public.game_events WHERE played_at >= now() - make_interval(days => GREATEST(1, LEAST(p_days, 365)))),
tut AS (SELECT * FROM public.tutorial_events WHERE created_at >= now() - make_interval(days => GREATEST(1, LEAST(p_days, 365)))),
days AS (SELECT generate_series((now() - make_interval(days => GREATEST(1, LEAST(p_days,365)) - 1))::date, now()::date, '1 day')::date AS d),
daily AS (
  SELECT d.d,
    (SELECT count(*) FROM win w WHERE w.played_at::date = d.d) AS events,
    (SELECT count(*) FROM win w WHERE w.played_at::date = d.d AND w.completed) AS completed,
    (SELECT count(DISTINCT w.session_id) FROM win w WHERE w.played_at::date = d.d) AS players,
    (SELECT count(DISTINCT w.user_id) FROM win w WHERE w.played_at::date = d.d AND w.user_id IS NOT NULL) AS signed_in,
    (SELECT count(*) FROM auth.users u WHERE u.created_at::date = d.d) AS signups
  FROM days d)
SELECT jsonb_build_object(
  'days', p_days,
  'totals', jsonb_build_object(
    'events', (SELECT count(*) FROM win),
    'completed', (SELECT count(*) FROM win WHERE completed),
    'players', (SELECT count(DISTINCT session_id) FROM win),
    'signed_in_players', (SELECT count(DISTINCT user_id) FROM win WHERE user_id IS NOT NULL),
    'signed_in_runs', (SELECT count(*) FROM win WHERE completed AND user_id IS NOT NULL),
    'accounts_total', (SELECT count(*) FROM auth.users),
    'accounts_new', (SELECT count(*) FROM auth.users WHERE created_at >= now() - make_interval(days => GREATEST(1, LEAST(p_days,365)))),
    'multiplayer_runs', (SELECT count(*) FROM win WHERE completed AND is_multiplayer),
    'avg_minutes', (SELECT round(avg(time_spent_seconds)/60.0, 1) FROM win WHERE completed AND time_spent_seconds > 0),
    'median_return', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY return_pct))::numeric, 1) FROM win WHERE completed AND return_pct IS NOT NULL),
    'today_players', (SELECT count(DISTINCT session_id) FROM public.game_events WHERE played_at::date = now()::date),
    'all_time_completed', (SELECT count(*) FROM public.game_events WHERE completed)
  ),
  'funnel', jsonb_build_object(
    'visitors', (SELECT count(DISTINCT session_id) FROM win),
    'signed_in', (SELECT count(DISTINCT session_id) FROM win WHERE user_id IS NOT NULL),
    'completed', (SELECT count(DISTINCT session_id) FROM win WHERE completed),
    'tutorial_started', (SELECT count(DISTINCT session_id) FROM tut WHERE event = 'start'),
    'tutorial_completed', (SELECT count(DISTINCT session_id) FROM tut WHERE event = 'complete'),
    'tutorial_abandoned', (SELECT count(DISTINCT session_id) FROM tut WHERE event = 'start') - (SELECT count(DISTINCT session_id) FROM tut WHERE event = 'complete')
  ),
  'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d, 'events', events, 'completed', completed, 'players', players, 'signed_in', signed_in, 'signups', signups) ORDER BY d) FROM daily), '[]'::jsonb),
  'by_mode', COALESCE((SELECT jsonb_object_agg(k, n) FROM (SELECT COALESCE(game_mode,'unknown') k, count(*) n FROM win WHERE completed GROUP BY 1) s), '{}'::jsonb),
  'by_device', COALESCE((SELECT jsonb_object_agg(k, n) FROM (SELECT COALESCE(device_type,'unknown') k, count(DISTINCT session_id) n FROM win GROUP BY 1) s), '{}'::jsonb),
  'by_length', COALESCE((SELECT jsonb_object_agg(k, n) FROM (SELECT COALESCE(simulation_length::text,'?') k, count(*) n FROM win WHERE completed GROUP BY 1) s), '{}'::jsonb),
  'recent', COALESCE((SELECT jsonb_agg(r) FROM (SELECT played_at, display_name, game_mode, start_year, end_year, ending_value, return_pct, is_multiplayer, (user_id IS NOT NULL) AS signed_in FROM win WHERE completed ORDER BY played_at DESC LIMIT 15) r), '[]'::jsonb)
);
$function$;